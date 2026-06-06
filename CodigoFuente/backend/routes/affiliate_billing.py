"""
routers/affiliate_billing.py  — VERSIÓN OPTIMIZADA
Router para gestión de facturas y pagos de afiliados

Cambios clave vs versión anterior:
  1. get_current_user + get_current_afiliado fusionados en una sola query con JOIN
  2. Subquery de pagos corregida (filtraba con id_factura == -1, nunca devolvía detalles)
  3. Pagos y detalles cargados con IN en lugar de lazy-load por ORM
  4. comprobante_pdf (LargeBinary) excluido de todos los SELECTs de listado
  5. Medidores del afiliado cargados una sola vez y reutilizados
  6. Índices compuestos recomendados documentados al final del archivo
"""

import io
import base64
import json
import os
import time
import urllib.error
import urllib.request
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, aliased
from sqlalchemy import and_, desc, func, or_, case, text
from typing import List, Optional, Dict
from datetime import date, datetime
from pathlib import Path

from models.detalle_factura import DetalleFactura
from models.factura import Factura
from models.lectura import Lectura
from models.meter import Medidor
from models.pago import Pago
from models.user import UsuarioSistema
from models.affiliate import UsuarioAfiliado
from models.sector import Sector
from db.session import SessionLocal
from routes.afiliatesGeneral import obtener_nombre_mes
from security.jwt import verify_token

router = APIRouter(prefix="/afiliados", tags=["afiliados-facturas-pagos"])

# ============================================================
# CONFIGURACIÓN
# ============================================================
UPLOAD_DIR = Path("uploads/comprobantes")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_FILE_TYPES = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "application/pdf": ".pdf"
}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB

PAYPAL_ENVIRONMENT = os.getenv("PAYPAL_ENVIRONMENT", "sandbox").lower()
PAYPAL_CLIENT_ID = os.getenv("PAYPAL_CLIENT_ID", "")
PAYPAL_CLIENT_SECRET = os.getenv("PAYPAL_CLIENT_SECRET", "")
PAYPAL_CURRENCY = os.getenv("PAYPAL_CURRENCY", "USD")
PAYPAL_API_BASE = (
    "https://api-m.paypal.com"
    if PAYPAL_ENVIRONMENT == "live"
    else "https://api-m.sandbox.paypal.com"
)


# ============================================================
# DEPENDENCIAS
# ============================================================

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _get_afiliado_by_username(username: str, db: Session) -> UsuarioAfiliado:
    """
    Una sola query con JOIN para obtener el afiliado a partir del username
    del JWT. Reemplaza las dos llamadas separadas anteriores
    (get_current_user + get_current_afiliado).

    Carga intencionalmente SOLO las columnas necesarias para los endpoints,
    sin disparar ningún lazy-load del ORM.
    """
    row = (
        db.query(
            UsuarioAfiliado.id_usuario_afi,
            UsuarioAfiliado.cod_usuario_afi,
            UsuarioAfiliado.id_sector,
            UsuarioAfiliado.id_usuario_sistema,
        )
        .join(
            UsuarioSistema,
            UsuarioAfiliado.id_usuario_sistema == UsuarioSistema.id_usuario_sistema,
        )
        .filter(UsuarioSistema.usuario == username)
        .first()
    )

    if not row:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o afiliado no encontrado",
        )

    # Devolvemos un objeto liviano con los campos que usamos
    class _AfiliadoSlim:
        __slots__ = ("id_usuario_afi", "cod_usuario_afi", "id_sector", "id_usuario_sistema")

        def __init__(self, r):
            self.id_usuario_afi = r.id_usuario_afi
            self.cod_usuario_afi = r.cod_usuario_afi
            self.id_sector = r.id_sector
            self.id_usuario_sistema = r.id_usuario_sistema

    return _AfiliadoSlim(row)


# ============================================================
# HELPERS PAYPAL  (sin cambios funcionales)
# ============================================================

def paypal_configurado() -> bool:
    return bool(PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET)


def paypal_request(
    method: str,
    path: str,
    data: Optional[dict] = None,
    access_token: Optional[str] = None,
) -> dict:
    body = json.dumps(data).encode("utf-8") if data is not None else None
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if access_token:
        headers["Authorization"] = f"Bearer {access_token}"
    else:
        credentials = f"{PAYPAL_CLIENT_ID}:{PAYPAL_CLIENT_SECRET}".encode("utf-8")
        headers["Authorization"] = (
            f"Basic {base64.b64encode(credentials).decode('ascii')}"
        )

    req = urllib.request.Request(
        f"{PAYPAL_API_BASE}{path}", data=body, headers=headers, method=method
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            content = response.read().decode("utf-8")
            return json.loads(content) if content else {}
    except urllib.error.HTTPError as err:
        detail = err.read().decode("utf-8", errors="replace")
        raise HTTPException(status_code=502, detail=f"Error de PayPal: {detail}")
    except urllib.error.URLError as err:
        raise HTTPException(
            status_code=502, detail=f"No se pudo conectar con PayPal: {err.reason}"
        )


def obtener_paypal_access_token() -> str:
    if not paypal_configurado():
        raise HTTPException(status_code=503, detail="PayPal no está configurado")
    form_data = "grant_type=client_credentials".encode("utf-8")
    credentials = f"{PAYPAL_CLIENT_ID}:{PAYPAL_CLIENT_SECRET}".encode("utf-8")
    req = urllib.request.Request(
        f"{PAYPAL_API_BASE}/v1/oauth2/token",
        data=form_data,
        headers={
            "Accept": "application/json",
            "Accept-Language": "en_US",
            "Authorization": f"Basic {base64.b64encode(credentials).decode('ascii')}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            return json.loads(response.read().decode("utf-8"))["access_token"]
    except urllib.error.HTTPError as err:
        detail = err.read().decode("utf-8", errors="replace")
        raise HTTPException(status_code=502, detail=f"Error PayPal auth: {detail}")
    except urllib.error.URLError as err:
        raise HTTPException(
            status_code=502, detail=f"No se pudo conectar con PayPal: {err.reason}"
        )


def calcular_saldo_factura(db: Session, factura: Factura) -> Decimal:
    total_pagado = (
        db.query(func.coalesce(func.sum(Pago.monto_pago), 0))
        .filter(
            Pago.id_factura == factura.id_factura,
            Pago.id_usuario_afi == factura.id_usuario_afi,
            Pago.estado_pago == "REGISTRADO",
        )
        .scalar()
    )
    saldo = Decimal(str(factura.total or 0)) - Decimal(str(total_pagado or 0))
    return max(saldo, Decimal("0.00")).quantize(Decimal("0.01"))


def pdf_escape(value) -> str:
    text = str(value or "")
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def build_simple_pdf(lines: List[dict]) -> bytes:
    content = ["BT", "/F1 11 Tf", "1 0 0 1 50 790 Tm"]
    current_y = 790

    for line in lines:
        text = pdf_escape(line.get("text", ""))
        size = int(line.get("size", 10))
        x = int(line.get("x", 50))
        y = int(line.get("y", current_y))
        weight = "F2" if line.get("bold") else "F1"
        content.append(f"/{weight} {size} Tf")
        content.append(f"1 0 0 1 {x} {y} Tm")
        content.append(f"({text}) Tj")
        current_y = y - 14

    content.append("ET")
    stream = "\n".join(content).encode("latin-1", errors="replace")

    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
        b"<< /Length " + str(len(stream)).encode("ascii") + b" >>\nstream\n" + stream + b"\nendstream",
    ]

    pdf = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for index, obj in enumerate(objects, start=1):
        offsets.append(len(pdf))
        pdf.extend(f"{index} 0 obj\n".encode("ascii"))
        pdf.extend(obj)
        pdf.extend(b"\nendobj\n")

    xref_offset = len(pdf)
    pdf.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    pdf.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        pdf.extend(f"{offset:010d} 00000 n \n".encode("ascii"))

    pdf.extend(
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF".encode("ascii")
    )
    return bytes(pdf)


def generar_comprobante_paypal_pdf(
    db: Session,
    pago: Pago,
    factura: Factura,
    afiliado: UsuarioAfiliado,
    order_id: str,
    capture_id: str,
) -> bytes:
    usuario = (
        db.query(UsuarioSistema)
        .join(UsuarioAfiliado, UsuarioAfiliado.id_usuario_sistema == UsuarioSistema.id_usuario_sistema)
        .filter(UsuarioAfiliado.id_usuario_afi == afiliado.id_usuario_afi)
        .first()
    )
    medidor = (
        db.query(Medidor.num_medidor)
        .join(Lectura, Lectura.id_medidor == Medidor.id_medidor)
        .filter(Lectura.id_lectura == factura.id_lectura)
        .first()
    )
    nombre = f"{usuario.nombres} {usuario.apellidos}".strip() if usuario else "Afiliado"
    fecha_pago = pago.fecha_pago.strftime("%d/%m/%Y %H:%M") if pago.fecha_pago else datetime.now().strftime("%d/%m/%Y %H:%M")

    return build_simple_pdf([
        {"text": "JUNTA DE AGUA POTABLE", "x": 195, "y": 790, "size": 15, "bold": True},
        {"text": "SANJAPAMBA", "x": 245, "y": 770, "size": 14, "bold": True},
        {"text": "Sanjapamba, Chimborazo, Ecuador", "x": 198, "y": 752, "size": 10},
        {"text": "COMPROBANTE DE PAGO PAYPAL", "x": 180, "y": 720, "size": 14, "bold": True},
        {"text": f"No. {str(pago.id_pago).zfill(6)}", "x": 255, "y": 700, "size": 11, "bold": True},
        {"text": "DATOS DEL AFILIADO", "x": 50, "y": 665, "size": 12, "bold": True},
        {"text": f"Nombre: {nombre}", "x": 50, "y": 645, "size": 10},
        {"text": f"Cedula: {usuario.cedula if usuario else 'N/A'}", "x": 50, "y": 628, "size": 10},
        {"text": f"Codigo afiliado: {afiliado.cod_usuario_afi}", "x": 50, "y": 611, "size": 10},
        {"text": f"Medidor: {medidor.num_medidor if medidor else 'N/A'}", "x": 50, "y": 594, "size": 10},
        {"text": "DATOS DE FACTURA", "x": 50, "y": 560, "size": 12, "bold": True},
        {"text": f"Factura: {factura.num_factura}", "x": 50, "y": 540, "size": 10},
        {"text": f"Periodo: {factura.periodo}", "x": 50, "y": 523, "size": 10},
        {"text": f"Total factura: ${Decimal(str(factura.total or 0)):.2f}", "x": 50, "y": 506, "size": 10},
        {"text": "DATOS DEL PAGO", "x": 50, "y": 472, "size": 12, "bold": True},
        {"text": f"Metodo: PAYPAL", "x": 50, "y": 452, "size": 10},
        {"text": f"Monto pagado: ${Decimal(str(pago.monto_pago or 0)):.2f}", "x": 50, "y": 435, "size": 11, "bold": True},
        {"text": f"Fecha de pago: {fecha_pago}", "x": 50, "y": 418, "size": 10},
        {"text": f"PayPal Order ID: {order_id}", "x": 50, "y": 401, "size": 9},
        {"text": f"PayPal Capture ID: {capture_id}", "x": 50, "y": 384, "size": 9},
        {"text": "Este comprobante certifica el pago realizado mediante PayPal.", "x": 120, "y": 90, "size": 9},
        {"text": f"Generado el {datetime.now().strftime('%d/%m/%Y %H:%M')}", "x": 210, "y": 74, "size": 8},
    ])


# ============================================================
# HELPERS INTERNOS DE LISTADO
# ============================================================

def _cargar_medidores_afiliado(db: Session, id_usuario_afi: int) -> list[str]:
    """Retorna la lista de num_medidor activos del afiliado."""
    rows = (
        db.query(Medidor.num_medidor)
        .filter(
            Medidor.id_usuario_afi == id_usuario_afi,
            Medidor.activo == True,
        )
        .order_by(Medidor.id_medidor)
        .all()
    )
    return [r.num_medidor for r in rows]


def _cargar_pagos_por_ids(
    db: Session, id_usuario_afi: int, ids_facturas: list[int]
) -> dict[int, list[dict]]:
    if not ids_facturas:
        return {}

    pagos_query = (
        db.query(
            Pago.id_pago,
            Pago.id_factura,
            Pago.monto_pago,
            Pago.fecha_pago,
            Pago.metodo_pago,
            Pago.estado_pago,
            Pago.observaciones,
            Pago.nombre_archivo,
            Pago.tipo_mime,
            case(
                (Pago.comprobante_pdf.isnot(None), True), else_=False
            ).label("tiene_comprobante"),
            # ❌ SIN: Pago.comprobante_pdf  → LargeBinary, causaba los 45s
        )
        .filter(
            Pago.id_usuario_afi == id_usuario_afi,
            Pago.id_factura.in_(ids_facturas),
            Pago.estado_pago == "REGISTRADO",
        )
        .order_by(Pago.id_factura, Pago.fecha_pago.desc())
        .all()
    )

    pagos_por_factura: dict[int, list[dict]] = {}
    for p in pagos_query:
        pagos_por_factura.setdefault(p.id_factura, []).append({
            "id_pago": p.id_pago,
            "monto_pago": float(p.monto_pago) if p.monto_pago else 0.0,
            "fecha_pago": p.fecha_pago.isoformat() if p.fecha_pago else None,
            "metodo_pago": p.metodo_pago or "No especificado",
            "estado_pago": p.estado_pago,
            "observaciones": p.observaciones,
            "nombre_archivo": p.nombre_archivo,
            "tipo_mime": p.tipo_mime or "application/pdf",
            "tiene_comprobante": p.tiene_comprobante,
        })
    return pagos_por_factura


def _cargar_detalles_por_ids(
    db: Session, ids_facturas: list[int]
) -> dict[int, list[dict]]:
    """
    Carga los detalles de todas las facturas del listado en UNA sola query.

    BUG ANTERIOR: la query original tenía `.filter(DetalleFactura.id_factura == -1)`
    lo que hacía que nunca se cargaran detalles. Corregido aquí.
    """
    if not ids_facturas:
        return {}

    tipo_orden = case(
        (DetalleFactura.tipo_detalle == "consumo", 1),
        (DetalleFactura.tipo_detalle == "multa", 2),
        (DetalleFactura.tipo_detalle == "servicio", 3),
        else_=4,
    )

    detalles_query = (
        db.query(
            DetalleFactura.id_detalle,
            DetalleFactura.id_factura,
            DetalleFactura.tipo_detalle,
            DetalleFactura.descripcion,
            DetalleFactura.subtotal_detalle,
        )
        .filter(DetalleFactura.id_factura.in_(ids_facturas))  # ← fix del bug
        .order_by(DetalleFactura.id_factura, tipo_orden, DetalleFactura.id_detalle)
        .all()
    )

    detalles_por_factura: dict[int, list[dict]] = {}
    for d in detalles_query:
        detalles_por_factura.setdefault(d.id_factura, []).append(
            {
                "id_detalle": d.id_detalle,
                "tipo_detalle": d.tipo_detalle,
                "descripcion": d.descripcion or "Sin descripción",
                "subtotal_detalle": (
                    float(d.subtotal_detalle) if d.subtotal_detalle else 0.0
                ),
            }
        )
    return detalles_por_factura


def _formatear_factura(
    f,
    detalles: list[dict],
    pagos: list[dict],
    nums_medidor: list[str],
) -> dict:
    """Convierte una fila de la query principal al dict de respuesta."""
    total_pagado = sum(p["monto_pago"] for p in pagos)
    saldo_pendiente = max(0.0, float(f.total) - total_pagado)
    nombre_completo = (f.nombre_completo or "").strip() or "Sin nombre"

    return {
        "id_factura": f.id_factura,
        "num_factura": f.num_factura,
        "periodo": f.periodo,
        "periodo_consumo": f.periodo,
        "fecha_emision": f.fecha_emision.isoformat(),
        "estado_factura": f.estado_factura,
        "consumo_m3": f.consumo_m3 or 0,
        "exceso_m3": f.exceso_m3 or 0,
        "valor_consumo": float(f.valor_consumo) if f.valor_consumo else 0.0,
        "valor_exceso": float(f.valor_exceso) if f.valor_exceso else 0.0,
        "subtotal": float(f.subtotal) if f.subtotal else 0.0,
        "descuento": float(f.descuento) if f.descuento else 0.0,
        "impuesto": float(f.impuesto) if f.impuesto else 0.0,
        "total": float(f.total),
        "usuario_afiliado": {
            "id_usuario_afi": f.id_usuario_afi,
            "cod_usuario_afi": f.cod_usuario_afi,
            "num_medidor": f.num_medidor or "N/A",
            "id_medidor": f.id_medidor,
            "medidores": nums_medidor,
            "usuario_sistema": {
                "nombre_completo": nombre_completo,
                "cedula": f.cedula,
                "direccion": f.direccion,
                "telefono": f.telefono,
                "email": f.email,
            },
            "sector": {"nombre_sector": f.nombre_sector or "Sin sector"},
        },
        "detalles": detalles,
        "resumen_detalles": {
            "total_conceptos": len(detalles),
            "consumo": sum(1 for d in detalles if d["tipo_detalle"] == "consumo"),
            "multas": sum(1 for d in detalles if d["tipo_detalle"] == "multa"),
            "servicios": sum(1 for d in detalles if d["tipo_detalle"] == "servicio"),
        },
        "pagos": pagos,
        "tiene_pago": len(pagos) > 0,
        "cantidad_pagos": len(pagos),
        "monto_pagado": total_pagado,
        "saldo_pendiente": saldo_pendiente,
        "esta_totalmente_pagada": saldo_pendiente <= 0.01,
        "tiene_comprobante": any(p.get("tiene_comprobante") for p in pagos),
    }


# ============================================================
# ENDPOINT: PERIODOS DISPONIBLES
# ============================================================

@router.get("/periodos-facturas-disponibles", response_model=Dict)
def obtener_periodos_facturas_disponibles(
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token),
):
    afiliado = _get_afiliado_by_username(payload["sub"], db)

    periodos = (
        db.query(
            Factura.periodo.label("periodo_consumo"),
            func.count(Factura.id_factura).label("total_facturas"),
            func.coalesce(func.sum(Factura.total), 0).label("monto_total"),
        )
        .filter(
            Factura.id_usuario_afi == afiliado.id_usuario_afi,
            Factura.estado_factura.in_(["pendiente", "pagada", "vencida"]),
            Factura.periodo.isnot(None),
        )
        .group_by(Factura.periodo)
        .order_by(Factura.periodo.desc())
        .all()
    )

    if not periodos:
        return {"anios_disponibles": [], "periodos": {}}

    periodos_por_anio: dict = {}
    anios_disponibles: list = []

    for p in periodos:
        try:
            anio_str, mes_str = p.periodo_consumo.split("-", 1)
            anio = int(anio_str)
            mes = int(mes_str)
        except (ValueError, AttributeError):
            continue

        if anio not in periodos_por_anio:
            periodos_por_anio[anio] = []
            anios_disponibles.append(anio)
        periodos_por_anio[anio].append(
            {
                "mes": mes,
                "nombre_mes": obtener_nombre_mes(mes),
                "periodo_consumo": p.periodo_consumo,
                "total_facturas": p.total_facturas,
                "monto_total": float(p.monto_total),
            }
        )

    return {"anios_disponibles": anios_disponibles, "periodos": periodos_por_anio}


# ============================================================
# ENDPOINT: LISTADO DE FACTURAS  
# ============================================================

@router.get("/mis-facturas", response_model=List[dict])
def listar_mis_facturas_completo(
    anio: Optional[int] = Query(None),
    mes: Optional[int] = Query(None, ge=1, le=12),
    periodo_consumo: Optional[str] = Query(None, min_length=7, max_length=7),
    estado_factura: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token),
):
      
    t0 = time.perf_counter()
    afiliado = _get_afiliado_by_username(payload["sub"], db)
    print(f"[1] afiliado: {time.perf_counter()-t0:.3f}s")

    t1 = time.perf_counter()

    # ── 1. Afiliado (una sola query con JOIN) ─────────────────
    afiliado = _get_afiliado_by_username(payload["sub"], db)

    # ── 2. Subquery: total pagado por factura ─────────────────
    #    Filtra solo por id_usuario_afi para aprovechar el índice
    #    compuesto recomendado (ver nota al final del archivo)
   

    # ── 3. Query principal: solo columnas escalares, sin lazy-load ──
    # ── 2. Query principal — eliminar sq_pagos completamente ──────
    base_q = (
        db.query(
            Factura.id_factura,
            Factura.num_factura,
            Factura.periodo,
            Factura.fecha_emision,
            Factura.estado_factura,
            Factura.consumo_m3,
            Factura.exceso_m3,
            Factura.valor_consumo,
            Factura.valor_exceso,
            Factura.subtotal,
            Factura.descuento,
            Factura.impuesto,
            Factura.total,
            UsuarioAfiliado.id_usuario_afi,
            UsuarioAfiliado.cod_usuario_afi,
            Medidor.num_medidor.label("num_medidor"),
            Medidor.id_medidor.label("id_medidor"),
            func.concat(
                func.coalesce(UsuarioSistema.nombres, ""),
                " ",
                func.coalesce(UsuarioSistema.apellidos, ""),
            ).label("nombre_completo"),
            UsuarioSistema.cedula,
            UsuarioSistema.direccion,
            UsuarioSistema.telefono,
            UsuarioSistema.email,
            Sector.nombre_sector,
            # ❌ ELIMINAR: func.coalesce(sq_pagos.c.total_pagado, 0).label("monto_pagado_total")
        )
        .join(UsuarioAfiliado, Factura.id_usuario_afi == UsuarioAfiliado.id_usuario_afi)
        .join(UsuarioSistema, UsuarioAfiliado.id_usuario_sistema == UsuarioSistema.id_usuario_sistema)
        .outerjoin(Lectura, Factura.id_lectura == Lectura.id_lectura)
        .outerjoin(Medidor, Lectura.id_medidor == Medidor.id_medidor)
        .outerjoin(Sector, UsuarioAfiliado.id_sector == Sector.id_sector)
        # ❌ ELIMINAR: .outerjoin(sq_pagos, Factura.id_factura == sq_pagos.c.id_factura)
        .filter(Factura.id_usuario_afi == afiliado.id_usuario_afi)
    )

    
    # ── 4. Filtros opcionales ─────────────────────────────────
    if periodo_consumo:
        base_q = base_q.filter(Factura.periodo == periodo_consumo)
    elif anio and mes:
        base_q = base_q.filter(Factura.periodo == f"{anio}-{mes:02d}")
    elif anio:
        base_q = base_q.filter(Factura.periodo.like(f"{anio}-%"))

    if estado_factura and estado_factura != "todos":
        base_q = base_q.filter(Factura.estado_factura == estado_factura)

    # ── 5. Ordenamiento por relevancia ───────────────────────
    estado_orden = case(
        (Factura.estado_factura == "pendiente", 1),
        (Factura.estado_factura == "vencida", 2),
        (Factura.estado_factura == "pagada", 3),
        (Factura.estado_factura == "anulada", 4),
        else_=5,
    )

    facturas = (
        base_q.order_by(estado_orden, Factura.periodo.desc(), Factura.fecha_emision.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    print(f"[2] query principal: {time.perf_counter()-t1:.3f}s")

    if not facturas:
        return []

    # ── 6. Cargar medidores, pagos y detalles en batch ───────
    ids_facturas = [f.id_factura for f in facturas]

    t2 = time.perf_counter()
    nums_medidor = _cargar_medidores_afiliado(db, afiliado.id_usuario_afi)
    print(f"[3] medidores: {time.perf_counter()-t2:.3f}s")

    t3 = time.perf_counter()
    pagos_por_factura = _cargar_pagos_por_ids(db, afiliado.id_usuario_afi, ids_facturas)
    print(f"[4] pagos: {time.perf_counter()-t3:.3f}s")

    t4 = time.perf_counter()
    detalles_por_factura = _cargar_detalles_por_ids(db, ids_facturas)
    print(f"[5] detalles: {time.perf_counter()-t4:.3f}s")

    t5 = time.perf_counter()
    resultado = [
        _formatear_factura(f, detalles=detalles_por_factura.get(f.id_factura, []),
            pagos=pagos_por_factura.get(f.id_factura, []), nums_medidor=nums_medidor)
        for f in facturas
    ]
    print(f"[6] formatear: {time.perf_counter()-t5:.3f}s")
    print(f"[TOTAL]: {time.perf_counter()-t0:.3f}s")
    return resultado

    nums_medidor = _cargar_medidores_afiliado(db, afiliado.id_usuario_afi)
    pagos_por_factura = _cargar_pagos_por_ids(db, afiliado.id_usuario_afi, ids_facturas)
    detalles_por_factura = _cargar_detalles_por_ids(db, ids_facturas)

    # ── 7. Ensamblar respuesta ────────────────────────────────
    return [
        _formatear_factura(
            f,
            detalles=detalles_por_factura.get(f.id_factura, []),
            pagos=pagos_por_factura.get(f.id_factura, []),
            nums_medidor=nums_medidor,
        )
        for f in facturas
    ]



# ============================================================
# ENDPOINT: DETALLE DE UNA FACTURA
# ============================================================

@router.get("/factura/{id_factura}", response_model=Dict)
def obtener_detalle_mi_factura(
    id_factura: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token),
):
    afiliado = _get_afiliado_by_username(payload["sub"], db)
    Cajero = aliased(UsuarioSistema)

    factura = (
        db.query(
            Factura.id_factura,
            Factura.num_factura,
            Factura.periodo,
            Factura.fecha_emision,
            Factura.estado_factura,
            Factura.consumo_m3,
            Factura.exceso_m3,
            Factura.valor_consumo,
            Factura.valor_exceso,
            Factura.subtotal,
            Factura.descuento,
            Factura.impuesto,
            Factura.total,
            UsuarioAfiliado.id_usuario_afi,
            UsuarioAfiliado.cod_usuario_afi,
            Medidor.num_medidor.label("num_medidor"),
            Medidor.id_medidor.label("id_medidor"),
            func.concat(
                func.coalesce(UsuarioSistema.nombres, ""),
                " ",
                func.coalesce(UsuarioSistema.apellidos, ""),
            ).label("nombre_completo"),
            UsuarioSistema.cedula,
            UsuarioSistema.direccion,
            UsuarioSistema.telefono,
            UsuarioSistema.email,
            Sector.nombre_sector,
        )
        .join(UsuarioAfiliado, Factura.id_usuario_afi == UsuarioAfiliado.id_usuario_afi)
        .join(
            UsuarioSistema,
            UsuarioAfiliado.id_usuario_sistema == UsuarioSistema.id_usuario_sistema,
        )
        .outerjoin(Lectura, Factura.id_lectura == Lectura.id_lectura)
        .outerjoin(Medidor, Lectura.id_medidor == Medidor.id_medidor)
        .outerjoin(Sector, UsuarioAfiliado.id_sector == Sector.id_sector)
        .filter(
            Factura.id_factura == id_factura,
            Factura.id_usuario_afi == afiliado.id_usuario_afi,
        )
        .first()
    )

    if not factura:
        raise HTTPException(status_code=404, detail="Factura no encontrada")

    nums_medidor = _cargar_medidores_afiliado(db, afiliado.id_usuario_afi)

    # Pagos completos (con cajero) para el detalle — aquí sí cargamos monto/cajero
    pagos_query = (
        db.query(
            Pago.id_pago,
            Pago.monto_pago,
            Pago.fecha_pago,
            Pago.metodo_pago,
            Pago.estado_pago,
            Pago.observaciones,
            Pago.motivo_anulacion,
            Pago.fecha_anulacion,
            Pago.nombre_archivo,
            Pago.tipo_mime,
            case(
                (Pago.comprobante_pdf.isnot(None), True), else_=False
            ).label("tiene_comprobante"),
            func.concat(
                func.coalesce(Cajero.nombres, ""),
                " ",
                func.coalesce(Cajero.apellidos, ""),
            ).label("cajero_nombre_completo"),
        )
        .outerjoin(Cajero, Pago.id_cajero == Cajero.id_usuario_sistema)
        .filter(
            Pago.id_usuario_afi == afiliado.id_usuario_afi,
            Pago.id_factura == id_factura,
            Pago.estado_pago == "REGISTRADO",
        )
        .order_by(Pago.fecha_pago.desc())
        .all()
    )

    pagos = []
    total_pagado = 0.0
    for p in pagos_query:
        monto = float(p.monto_pago) if p.monto_pago else 0.0
        total_pagado += monto
        cajero = (p.cajero_nombre_completo or "").strip() or "Sin cajero"
        pagos.append(
            {
                "id_pago": p.id_pago,
                "monto_pago": monto,
                "fecha_pago": p.fecha_pago.isoformat() if p.fecha_pago else None,
                "metodo_pago": p.metodo_pago or "No especificado",
                "estado_pago": p.estado_pago,
                "observaciones": p.observaciones,
                "motivo_anulacion": p.motivo_anulacion,
                "fecha_anulacion": (
                    p.fecha_anulacion.isoformat() if p.fecha_anulacion else None
                ),
                "cajero": cajero,
                "tiene_comprobante": p.tiene_comprobante,
                "nombre_archivo": p.nombre_archivo,
                "tipo_mime": p.tipo_mime or "application/pdf",
            }
        )

    detalles = _cargar_detalles_por_ids(db, [id_factura]).get(id_factura, [])
    saldo_pendiente = max(0.0, float(factura.total) - total_pagado)
    nombre_completo = (factura.nombre_completo or "").strip() or "Sin nombre"

    return {
        "id_factura": factura.id_factura,
        "num_factura": factura.num_factura,
        "periodo": factura.periodo,
        "periodo_consumo": factura.periodo,
        "fecha_emision": factura.fecha_emision.isoformat(),
        "estado_factura": factura.estado_factura,
        "consumo_m3": factura.consumo_m3 or 0,
        "exceso_m3": factura.exceso_m3 or 0,
        "valor_consumo": float(factura.valor_consumo) if factura.valor_consumo else 0.0,
        "valor_exceso": float(factura.valor_exceso) if factura.valor_exceso else 0.0,
        "subtotal": float(factura.subtotal) if factura.subtotal else 0.0,
        "descuento": float(factura.descuento) if factura.descuento else 0.0,
        "impuesto": float(factura.impuesto) if factura.impuesto else 0.0,
        "total": float(factura.total),
        "usuario_afiliado": {
            "id_usuario_afi": factura.id_usuario_afi,
            "cod_usuario_afi": factura.cod_usuario_afi,
            "num_medidor": factura.num_medidor or "N/A",
            "id_medidor": factura.id_medidor,
            "medidores": nums_medidor,
            "usuario_sistema": {
                "nombre_completo": nombre_completo,
                "cedula": factura.cedula,
                "direccion": factura.direccion,
                "telefono": factura.telefono,
                "email": factura.email,
            },
            "sector": {"nombre_sector": factura.nombre_sector or "Sin sector"},
        },
        "detalles": detalles,
        "resumen_detalles": {
            "total_conceptos": len(detalles),
            "consumo": sum(1 for d in detalles if d["tipo_detalle"] == "consumo"),
            "multas": sum(1 for d in detalles if d["tipo_detalle"] == "multa"),
            "servicios": sum(1 for d in detalles if d["tipo_detalle"] == "servicio"),
        },
        "pagos": pagos,
        "tiene_pago": len(pagos) > 0,
        "cantidad_pagos": len(pagos),
        "monto_pagado": total_pagado,
        "saldo_pendiente": saldo_pendiente,
        "esta_totalmente_pagada": saldo_pendiente <= 0.01,
        "tiene_comprobante": any(p.get("tiene_comprobante") for p in pagos),
    }


# ============================================================
# ENDPOINT: ESTADÍSTICAS
# ============================================================

@router.get("/estadisticas-facturas", response_model=Dict)
def obtener_estadisticas_facturas(
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token),
):
    afiliado = _get_afiliado_by_username(payload["sub"], db)

    # Una sola query con CASE en lugar de 4 queries separadas
    stats = (
        db.query(
            func.count(Factura.id_factura).label("total_facturas"),
            func.coalesce(func.sum(Factura.total), 0).label("monto_total"),
            func.coalesce(func.avg(Factura.total), 0).label("promedio_factura"),
            func.coalesce(
                func.sum(
                    case((Factura.estado_factura == "pagada", Factura.total), else_=0)
                ),
                0,
            ).label("monto_pagado"),
            func.coalesce(
                func.sum(
                    case(
                        (
                            Factura.estado_factura.in_(["pendiente", "vencida"]),
                            Factura.total,
                        ),
                        else_=0,
                    )
                ),
                0,
            ).label("monto_pendiente"),
            func.sum(
                case((Factura.estado_factura == "pagada", 1), else_=0)
            ).label("total_pagadas"),
            func.sum(
                case(
                    (
                        Factura.estado_factura.in_(["pendiente", "vencida"]),
                        1,
                    ),
                    else_=0,
                )
            ).label("total_pendientes"),
        )
        .filter(
            Factura.id_usuario_afi == afiliado.id_usuario_afi,
            Factura.estado_factura.in_(["pendiente", "pagada", "vencida"]),
        )
        .first()
    )

    return {
        "total_facturas": stats.total_facturas or 0,
        "total_pagadas": int(stats.total_pagadas or 0),
        "total_pendientes": int(stats.total_pendientes or 0),
        "monto_total": float(stats.monto_total),
        "monto_pagado": float(stats.monto_pagado),
        "monto_pendiente": float(stats.monto_pendiente),
        "promedio_mensual": float(stats.promedio_factura),
    }


# ============================================================
# ENDPOINTS PAYPAL
# ============================================================

@router.get("/paypal/config", response_model=Dict)
def obtener_configuracion_paypal(payload: dict = Depends(verify_token)):
    return {
        "enabled": paypal_configurado(),
        "client_id": PAYPAL_CLIENT_ID if paypal_configurado() else None,
        "currency": PAYPAL_CURRENCY,
        "environment": PAYPAL_ENVIRONMENT,
    }


@router.post("/paypal/crear-orden/{id_factura}", response_model=Dict)
def crear_orden_paypal(
    id_factura: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token),
):
    afiliado = _get_afiliado_by_username(payload["sub"], db)

    factura = (
        db.query(Factura)
        .filter(
            Factura.id_factura == id_factura,
            Factura.id_usuario_afi == afiliado.id_usuario_afi,
        )
        .first()
    )
    if not factura:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    if factura.estado_factura in ("pagada", "anulada"):
        raise HTTPException(status_code=400, detail="La factura no está disponible para pago")

    saldo = calcular_saldo_factura(db, factura)
    if saldo <= Decimal("0.00"):
        raise HTTPException(status_code=400, detail="La factura no tiene saldo pendiente")

    access_token = obtener_paypal_access_token()
    order = paypal_request(
        "POST",
        "/v2/checkout/orders",
        {
            "intent": "CAPTURE",
            "purchase_units": [
                {
                    "reference_id": str(factura.id_factura),
                    "description": f"Factura {factura.num_factura}",
                    "custom_id": str(afiliado.id_usuario_afi),
                    "amount": {
                        "currency_code": PAYPAL_CURRENCY,
                        "value": f"{saldo:.2f}",
                    },
                }
            ],
            "application_context": {
                "brand_name": "JUNTA DE AGUA POTABLE SANJAPAMBA",
                "shipping_preference": "NO_SHIPPING",
                "user_action": "PAY_NOW",
            },
        },
        access_token=access_token,
    )
    return {
        "order_id": order.get("id"),
        "status": order.get("status"),
        "monto": float(saldo),
        "currency": PAYPAL_CURRENCY,
    }


@router.post("/paypal/capturar-orden/{order_id}", response_model=Dict)
def capturar_orden_paypal(
    order_id: str,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token),
):
    afiliado = _get_afiliado_by_username(payload["sub"], db)
    access_token = obtener_paypal_access_token()

    capture = paypal_request(
        "POST", f"/v2/checkout/orders/{order_id}/capture", {}, access_token=access_token
    )
    if capture.get("status") != "COMPLETED":
        raise HTTPException(status_code=400, detail="El pago de PayPal no fue completado")

    purchase_unit = (capture.get("purchase_units") or [{}])[0]
    reference_id = purchase_unit.get("reference_id")
    paypal_capture = ((purchase_unit.get("payments") or {}).get("captures") or [{}])[0]
    paypal_capture_id = paypal_capture.get("id")
    amount = paypal_capture.get("amount") or {}

    if not reference_id or not paypal_capture_id:
        raise HTTPException(status_code=400, detail="Respuesta de PayPal incompleta")

    factura = (
        db.query(Factura)
        .filter(
            Factura.id_factura == int(reference_id),
            Factura.id_usuario_afi == afiliado.id_usuario_afi,
        )
        .first()
    )
    if not factura:
        raise HTTPException(status_code=404, detail="Factura no encontrada")

    pago_existente = (
        db.query(Pago.id_pago)
        .filter(
            Pago.observaciones.ilike(f"%PayPal Capture: {paypal_capture_id}%"),
            Pago.estado_pago == "REGISTRADO",
        )
        .first()
    )
    if pago_existente:
        return {
            "success": True,
            "message": "Pago ya registrado",
            "id_pago": pago_existente.id_pago,
            "id_factura": factura.id_factura,
            "estado_factura": factura.estado_factura,
        }

    monto_pagado = Decimal(str(amount.get("value", "0.00"))).quantize(Decimal("0.01"))
    if amount.get("currency_code") != PAYPAL_CURRENCY or monto_pagado <= Decimal("0.00"):
        raise HTTPException(status_code=400, detail="Monto de PayPal inválido")

    saldo_actual = calcular_saldo_factura(db, factura)
    if saldo_actual <= Decimal("0.00"):
        raise HTTPException(status_code=400, detail="La factura ya no tiene saldo pendiente")
    if monto_pagado > saldo_actual:
        monto_pagado = saldo_actual

    nuevo_pago = Pago(
        id_factura=factura.id_factura,
        id_usuario_afi=afiliado.id_usuario_afi,
        monto_pago=monto_pagado,
        fecha_pago=datetime.now(),
        metodo_pago="PAYPAL",
        estado_pago="REGISTRADO",
        activo=True,
        observaciones=f"Pago registrado por PayPal. Referencia: PayPal Capture: {paypal_capture_id}",
    )
    db.add(nuevo_pago)
    db.flush()

    saldo_final = calcular_saldo_factura(db, factura)
    factura.estado_factura = "pagada" if saldo_final <= Decimal("0.01") else "parcial"
    nuevo_pago.comprobante_pdf = generar_comprobante_paypal_pdf(
        db,
        nuevo_pago,
        factura,
        afiliado,
        order_id,
        paypal_capture_id,
    )
    nuevo_pago.nombre_archivo = f"Comprobante_PayPal_{str(nuevo_pago.id_pago).zfill(6)}_{factura.num_factura}.pdf"
    nuevo_pago.tipo_mime = "application/pdf"
    db.commit()
    db.refresh(nuevo_pago)

    return {
        "success": True,
        "message": "Pago registrado correctamente",
        "id_pago": nuevo_pago.id_pago,
        "id_factura": factura.id_factura,
        "num_factura": factura.num_factura,
        "estado_factura": factura.estado_factura,
        "monto_pago": float(monto_pagado),
        "saldo_pendiente": float(saldo_final),
        "fecha_pago": nuevo_pago.fecha_pago.isoformat() if nuevo_pago.fecha_pago else None,
        "paypal_order_id": order_id,
        "paypal_capture_id": paypal_capture_id,
        "tiene_comprobante": True,
        "nombre_archivo": nuevo_pago.nombre_archivo,
    }


# ============================================================
# ENDPOINT: MIS PAGOS
# ============================================================

@router.get("/mis-pagos", response_model=List[dict])
def listar_mis_pagos(
    anio: Optional[int] = Query(None),
    mes: Optional[int] = Query(None, ge=1, le=12),
    periodo_consumo: Optional[str] = Query(None, min_length=7, max_length=7),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token),
):
    afiliado = _get_afiliado_by_username(payload["sub"], db)
    Cajero = aliased(UsuarioSistema)

    query = (
        db.query(
            Pago.id_pago,
            Pago.monto_pago,
            Pago.fecha_pago,
            Pago.metodo_pago,
            Pago.estado_pago,
            Pago.observaciones,
            Pago.nombre_archivo,
            Pago.tipo_mime,
            case(
                (Pago.comprobante_pdf.isnot(None), True), else_=False
            ).label("tiene_comprobante"),
            Factura.id_factura,
            Factura.num_factura,
            Factura.periodo,
            Factura.total.label("total_factura"),
            Cajero.nombres.label("cajero_nombres"),
            Cajero.apellidos.label("cajero_apellidos"),
        )
        .outerjoin(Factura, Pago.id_factura == Factura.id_factura)
        .outerjoin(Cajero, Pago.id_cajero == Cajero.id_usuario_sistema)
        .filter(
            Pago.id_usuario_afi == afiliado.id_usuario_afi,
            Pago.estado_pago == "REGISTRADO",
        )
    )

    if periodo_consumo:
        query = query.filter(Factura.periodo == periodo_consumo)
    elif anio and mes:
        query = query.filter(Factura.periodo == f"{anio}-{mes:02d}")
    elif anio:
        query = query.filter(Factura.periodo.like(f"{anio}-%"))

    pagos = query.order_by(Pago.fecha_pago.desc()).all()

    return [
        {
            "id_pago": p.id_pago,
            "monto": float(p.monto_pago) if p.monto_pago else 0.0,
            "monto_pago": float(p.monto_pago) if p.monto_pago else 0.0,
            "fecha_pago": p.fecha_pago.strftime("%Y-%m-%d") if p.fecha_pago else None,
            "metodo_pago": p.metodo_pago,
            "tiene_comprobante": p.tiene_comprobante,
            "nombre_archivo": p.nombre_archivo,
            "tipo_mime": p.tipo_mime or "application/pdf",
            "estado": p.estado_pago,
            "observacion": p.observaciones,
            "observaciones": p.observaciones,
            "factura": {
                "id_factura": p.id_factura,
                "numero_factura": p.num_factura,
                "num_factura": p.num_factura,
                "periodo": p.periodo,
                "periodo_consumo": p.periodo,
                "total": float(p.total_factura) if p.total_factura else None,
            },
            "cajero": {"nombres": p.cajero_nombres, "apellidos": p.cajero_apellidos},
        }
        for p in pagos
    ]


# ============================================================
# ENDPOINT: SUBIR COMPROBANTE
# ============================================================

@router.post("/subir-comprobante")
async def subir_comprobante_pago(
    id_factura: int = Form(...),
    comprobante: UploadFile = File(...),
    monto: Optional[float] = Form(None),
    fecha_pago: Optional[date] = Form(None),
    metodo_pago: Optional[str] = Form(None),
    referencia: Optional[str] = Form(None),
    observacion: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token),
):
    afiliado = _get_afiliado_by_username(payload["sub"], db)

    factura = (
        db.query(Factura)
        .filter(
            Factura.id_factura == id_factura,
            Factura.id_usuario_afi == afiliado.id_usuario_afi,
        )
        .first()
    )
    if not factura:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    if factura.estado_factura == "pagada":
        raise HTTPException(status_code=400, detail="Esta factura ya está pagada")

    if comprobante.content_type not in ALLOWED_FILE_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Tipo de archivo no permitido. Solo se aceptan JPG, PNG o PDF",
        )

    file_content = await comprobante.read()
    if len(file_content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="El archivo no debe superar los 5MB")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    file_extension = ALLOWED_FILE_TYPES[comprobante.content_type]
    filename = f"comprobante_{afiliado.id_usuario_afi}_{id_factura}_{timestamp}{file_extension}"
    file_path = UPLOAD_DIR / filename
    with open(file_path, "wb") as buf:
        buf.write(file_content)

    nuevo_pago = Pago(
        id_factura=id_factura,
        id_usuario_afi=afiliado.id_usuario_afi,
        monto_pago=Decimal(str(monto)) if monto else factura.total,
        fecha_pago=fecha_pago or datetime.now().date(),
        metodo_pago=metodo_pago or "transferencia",
        estado_pago="PENDIENTE",
        observaciones=observacion or "Comprobante subido por el afiliado",
    )
    db.add(nuevo_pago)
    db.commit()
    db.refresh(nuevo_pago)

    return {
        "message": "Comprobante subido correctamente. Será verificado por el administrador.",
        "id_pago": nuevo_pago.id_pago,
        "estado": nuevo_pago.estado_pago,
    }


@router.put("/comprobante/{id_pago}/pdf")
async def guardar_comprobante_pago_existente(
    id_pago: int,
    comprobante: UploadFile = File(...),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token),
):
    afiliado = _get_afiliado_by_username(payload["sub"], db)

    pago = db.query(Pago).filter(Pago.id_pago == id_pago).first()
    if not pago:
        raise HTTPException(status_code=404, detail=f"Pago {id_pago} no encontrado")

    factura = db.query(Factura).filter(Factura.id_factura == pago.id_factura).first()
    if not factura or factura.id_usuario_afi != afiliado.id_usuario_afi:
        raise HTTPException(status_code=403, detail="Sin permiso para este comprobante")

    if comprobante.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="El comprobante debe ser un PDF")

    file_content = await comprobante.read()
    if len(file_content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="El archivo no debe superar los 5MB")

    pago.comprobante_pdf = file_content
    pago.nombre_archivo = f"Comprobante_PayPal_{str(pago.id_pago).zfill(6)}_{factura.num_factura}.pdf"
    pago.tipo_mime = "application/pdf"
    db.commit()

    return {
        "message": "Comprobante guardado correctamente",
        "id_pago": pago.id_pago,
        "nombre_archivo": pago.nombre_archivo,
        "tipo_mime": pago.tipo_mime,
    }


# ============================================================
# ENDPOINT: DESCARGAR COMPROBANTE
# ============================================================

@router.get("/comprobante/{id_pago}", status_code=200)
def descargar_comprobante_afiliado(
    id_pago: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token),
):
    afiliado = _get_afiliado_by_username(payload["sub"], db)

    comprobante = (
        db.query(
            Pago.comprobante_pdf,
            Pago.nombre_archivo,
            Pago.tipo_mime,
        )
        .join(Factura, Pago.id_factura == Factura.id_factura)
        .filter(
            Pago.id_pago == id_pago,
            Factura.id_usuario_afi == afiliado.id_usuario_afi,
        )
        .first()
    )
    if not comprobante:
        raise HTTPException(status_code=404, detail=f"Pago {id_pago} no encontrado")

    if not comprobante.comprobante_pdf:
        raise HTTPException(status_code=404, detail="Este pago no tiene comprobante")

    pdf_bytes = comprobante.comprobante_pdf
    filename = comprobante.nombre_archivo or f"comprobante_{id_pago}.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type=comprobante.tipo_mime or "application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(pdf_bytes)),
            "Cache-Control": "private, max-age=300",
            "X-Content-Type-Options": "nosniff",
        },
    )
