"""
routers/affiliate_billing.py
Router para gestión de facturas y pagos de afiliados
"""

import io
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload, load_only
from sqlalchemy import and_, desc, func, extract, or_, case
from typing import List, Optional, Dict
from datetime import date, datetime
from pathlib import Path
import shutil

from models.factura import Factura
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
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

# ============================================================
# DEPENDENCIAS
# ============================================================

def get_db():
    """Dependencia para obtener la sesión de base de datos"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(payload: dict, db: Session) -> UsuarioSistema:
    """Obtiene el usuario actual desde el payload del JWT"""
    user = db.query(UsuarioSistema).filter(
        UsuarioSistema.usuario == payload["sub"]
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado"
        )
    
    return user


def get_current_afiliado(current_user: UsuarioSistema, db: Session) -> UsuarioAfiliado:
    """Obtiene el afiliado asociado al usuario actual"""
    afiliado = db.query(UsuarioAfiliado).filter(
        UsuarioAfiliado.id_usuario_sistema == current_user.id_usuario_sistema
    ).first()
    
    if not afiliado:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se encontró información de afiliado para este usuario"
        )
    
    return afiliado


# ============================================================
# ENDPOINTS DE PERIODOS
# ============================================================

@router.get("/periodos-facturas-disponibles", response_model=Dict)
def obtener_periodos_facturas_disponibles(
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    
    """
    Obtiene los años y meses donde el afiliado tiene facturas registradas
    """
    current_user = get_current_user(payload, db)
    afiliado = get_current_afiliado(current_user, db)

    # Consulta optimizada agrupando por año y mes
    periodos = (
        db.query(
            func.extract('year', Factura.fecha_emision).label('anio'),
            func.extract('month', Factura.fecha_emision).label('mes'),
            func.count(Factura.id_factura).label('total_facturas'),
            func.coalesce(func.sum(Factura.total), 0).label('monto_total')
        )
        .filter(
            Factura.id_usuario_afi == afiliado.id_usuario_afi,
            Factura.estado_factura.in_(['pendiente', 'pagada', 'vencida'])
        )
        .group_by('anio', 'mes')
        .order_by(desc('anio'), desc('mes'))
        .all()
    )

    if not periodos:
        return {
            "anios_disponibles": [],
            "periodos": {}
        }

    # Organizar resultado
    periodos_por_anio = {}
    anios_disponibles = []

    for p in periodos:
        anio = int(p.anio)
        mes = int(p.mes)

        if anio not in periodos_por_anio:
            periodos_por_anio[anio] = []
            anios_disponibles.append(anio)

        periodos_por_anio[anio].append({
            "mes": mes,
            "nombre_mes": obtener_nombre_mes(mes),
            "total_facturas": p.total_facturas,
            "monto_total": float(p.monto_total)
        })

    return {
        "anios_disponibles": anios_disponibles,
        "periodos": periodos_por_anio
    }


# ============================================================
# ENDPOINTS DE FACTURAS
# ============================================================

from sqlalchemy.orm import selectinload, contains_eager

@router.get("/mis-facturas", response_model=List[dict])
def listar_facturas_usuario_ligero(
    anio: Optional[int] = Query(None),
    mes: Optional[int] = Query(None, ge=1, le=12),
    estado_factura: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Versión ULTRA LIGERA que solo incluye:
    - Datos de la factura
    - Nombre y cédula del usuario
    - Sector
    
    Sin pagos ni medidores para máxima velocidad
    """
    
    current_user = get_current_user(payload, db)
    afiliado = get_current_afiliado(current_user, db)

    # ===============================
    # FECHAS
    # ===============================
    fecha_inicio = fecha_fin = None
    
    if anio and mes:
        fecha_inicio = date(anio, mes, 1)
        fecha_fin = date(anio + 1, 1, 1) if mes == 12 else date(anio, mes + 1, 1)
    elif anio:
        fecha_inicio = date(anio, 1, 1)
        fecha_fin = date(anio + 1, 1, 1)

    # ===============================
    # QUERY CON JOIN OPTIMIZADO
    # ===============================
    query = (
        db.query(Factura)
        .join(
            UsuarioAfiliado,
            Factura.id_usuario_afi == UsuarioAfiliado.id_usuario_afi
        )
        .join(
            UsuarioSistema,
            UsuarioAfiliado.id_usuario_afi == UsuarioSistema.id_usuario_sistema
        )
        .outerjoin(
            Sector,
            UsuarioAfiliado.id_sector == Sector.id_sector
        )
        .with_entities(
            # Datos de factura
            Factura.id_factura,
            Factura.num_factura,
            Factura.periodo,
            Factura.fecha_emision,
            Factura.estado_factura,
            Factura.total,
            Factura.subtotal,
            Factura.impuesto,
            Factura.descuento,
            Factura.consumo_m3,
            # Datos de usuario
            UsuarioSistema.cedula,
            UsuarioSistema.nombres,
            UsuarioSistema.apellidos,
            UsuarioSistema.email,
            UsuarioSistema.telefono,
            # Datos de sector
            Sector.nombre_sector,
            # Agregar count de pagos
            func.count(Pago.id_pago).label('total_pagos')
        )
        .outerjoin(
            Pago,
            and_(
                Pago.id_factura == Factura.id_factura,
                Pago.estado_pago == 'aprobado'
            )
        )
        .filter(
            Factura.id_usuario_afi == afiliado.id_usuario_afi
        )
        .group_by(
            Factura.id_factura,
            UsuarioSistema.cedula,
            UsuarioSistema.nombres,
            UsuarioSistema.apellidos,
            UsuarioSistema.email,
            UsuarioSistema.telefono,
            Sector.nombre_sector
        )
    )

    # ===============================
    # FILTROS
    # ===============================
    if estado_factura and estado_factura != "todos":
        query = query.filter(Factura.estado_factura == estado_factura)
    
    if fecha_inicio and fecha_fin:
        query = query.filter(
            Factura.fecha_emision >= fecha_inicio,
            Factura.fecha_emision < fecha_fin
        )

    # ===============================
    # PAGINACIÓN
    # ===============================
    resultados = (
        query
        .order_by(Factura.fecha_emision.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )

    # ===============================
    # RESPUESTA ESTRUCTURADA
    # ===============================
    return [
        {
            "id_factura": r.id_factura,
            "numero_factura": r.num_factura,
            "periodo": r.periodo,
            "fecha_emision": r.fecha_emision.strftime("%Y-%m-%d") if r.fecha_emision else None,
            "estado_factura": r.estado_factura,
            "total": float(r.total) if r.total else 0,
            "subtotal": float(r.subtotal) if r.subtotal else 0,
            "impuesto": float(r.impuesto) if r.impuesto else 0,
            "descuento": float(r.descuento) if r.descuento else 0,
            "consumo_m3": r.consumo_m3,
            # Datos del usuario
            "usuario": {
                "cedula": r.cedula,
                "nombre_completo": f"{r.nombres} {r.apellidos}",
                "nombre": r.nombres,
                "apellido": r.apellidos,
                "email": r.email,
                "telefono": r.telefono
            },
            # Datos del sector
            "sector": r.nombre_sector,
            # Información de pagos
            "tiene_pagos": r.total_pagos > 0,
            "total_pagos": r.total_pagos
        }
        for r in resultados
    ]

@router.get("/factura/{id_factura}", response_model=dict)
def obtener_detalle_factura(
    id_factura: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Obtiene el detalle completo de una factura específica
    OPTIMIZADO: Carga todo en una sola consulta
    """
    current_user = get_current_user(payload, db)
    afiliado = get_current_afiliado(current_user, db)

    # ✅ Cargar todo en una sola query
    factura = (
        db.query(Factura)
        .options(
            selectinload(Factura.pagos).joinedload(Pago.cajero),  # ✅ Cargar pagos con cajero
            joinedload(Factura.usuario_afiliado).joinedload(UsuarioAfiliado.usuario_sistema),
            joinedload(Factura.usuario_afiliado).joinedload(UsuarioAfiliado.sector),
            selectinload(Factura.detalles)  # ✅ Si necesitas los detalles
        )
        .filter(
            Factura.id_factura == id_factura,
            Factura.id_usuario_afi == afiliado.id_usuario_afi
        )
        .first()
    )

    if not factura:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Factura no encontrada"
        )

    # ✅ Los pagos ya están cargados, NO hacemos query adicional
    pagos_data = [
        {
            "id_pago": pago.id_pago,
            "monto": float(pago.monto_pago),
            "fecha_pago": pago.fecha_pago.strftime('%Y-%m-%d') if pago.fecha_pago else None,
            "metodo_pago": pago.metodo_pago,
            "referencia": None,
            "comprobante_url": None,
            "estado": pago.estado_pago,
            "observacion": pago.observaciones,
            "cajero": {
                "nombres": pago.cajero.nombres if pago.cajero else None,
                "apellidos": pago.cajero.apellidos if pago.cajero else None
            }
        }
        for pago in factura.pagos
        if pago.estado_pago == 'REGISTRADO'
    ]

    usuario = factura.usuario_afiliado.usuario_sistema if factura.usuario_afiliado else None

    return {
        "id_factura": factura.id_factura,
        "numero_factura": factura.num_factura,
        "periodo": factura.periodo,
        "fecha_emision": factura.fecha_emision.strftime('%Y-%m-%d') if factura.fecha_emision else None,
        "estado_factura": factura.estado_factura,
        "subtotal": float(factura.subtotal) if factura.subtotal else 0,
        "impuestos": float(factura.impuesto) if factura.impuesto else 0,
        "descuentos": float(factura.descuento) if factura.descuento else 0,
        "total": float(factura.total) if factura.total else 0,
        "consumo_m3": float(factura.consumo_m3) if factura.consumo_m3 else None,
        "usuario": {
            "nombres": usuario.nombres if usuario else None,
            "apellidos": usuario.apellidos if usuario else None,
            "cedula": usuario.cedula if usuario else None
        },
        "sector": factura.usuario_afiliado.sector.nombre_sector if factura.usuario_afiliado and factura.usuario_afiliado.sector else None,
        "pagos": pagos_data
    }



@router.get("/estadisticas-facturas", response_model=Dict)
def obtener_estadisticas_facturas(
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Obtiene estadísticas generales de facturas del afiliado
    """
    current_user = get_current_user(payload, db)
    afiliado = get_current_afiliado(current_user, db)

    stats = (
        db.query(
            func.count(Factura.id_factura).label("total_facturas"),
            func.coalesce(func.sum(Factura.total), 0).label("monto_total"),
            func.coalesce(func.avg(Factura.total), 0).label("promedio_factura")
        )
        .filter(
            Factura.id_usuario_afi == afiliado.id_usuario_afi,
            Factura.estado_factura.in_(['pendiente', 'pagada', 'vencida'])
        )
        .first()
    )

    # Estadísticas por estado de pago
    pagadas = db.query(func.count(Factura.id_factura)).filter(
        Factura.id_usuario_afi == afiliado.id_usuario_afi,
        Factura.estado_factura == 'pagada'
    ).scalar()

    pendientes = db.query(func.count(Factura.id_factura)).filter(
        Factura.id_usuario_afi == afiliado.id_usuario_afi,
        Factura.estado_factura.in_(['pendiente', 'vencida'])
    ).scalar()

    monto_pagado = db.query(func.coalesce(func.sum(Factura.total), 0)).filter(
        Factura.id_usuario_afi == afiliado.id_usuario_afi,
        Factura.estado_factura == 'pagada'
    ).scalar()

    monto_pendiente = db.query(func.coalesce(func.sum(Factura.total), 0)).filter(
        Factura.id_usuario_afi == afiliado.id_usuario_afi,
        Factura.estado_factura.in_(['pendiente', 'vencida'])
    ).scalar()

    return {
        "total_facturas": stats.total_facturas,
        "total_pagadas": pagadas,
        "total_pendientes": pendientes,
        "monto_total": float(stats.monto_total),
        "monto_pagado": float(monto_pagado),
        "monto_pendiente": float(monto_pendiente),
        "promedio_mensual": float(stats.promedio_factura)
    }


# ============================================================
# ENDPOINTS DE PAGOS
# ============================================================

@router.get("/mis-pagos", response_model=List[dict])
def listar_mis_pagos(
    anio: Optional[int] = Query(None),
    mes: Optional[int] = Query(None, ge=1, le=12),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Lista el historial de pagos del afiliado
    """
    current_user = get_current_user(payload, db)
    afiliado = get_current_afiliado(current_user, db)

    query = (
        db.query(Pago)
        .options(
            joinedload(Pago.factura),
            joinedload(Pago.cajero)
        )
        .filter(
            Pago.id_usuario_afi == afiliado.id_usuario_afi,
            Pago.estado_pago == 'REGISTRADO'
        )
    )

    # Filtros de fecha
    if anio and mes:
        query = query.filter(
            extract('year', Pago.fecha_pago) == anio,
            extract('month', Pago.fecha_pago) == mes
        )
    elif anio:
        query = query.filter(extract('year', Pago.fecha_pago) == anio)

    pagos = query.order_by(Pago.fecha_pago.desc()).all()

    resultado = []
    for pago in pagos:
        resultado.append({
            "id_pago": pago.id_pago,
            "monto": float(pago.monto),
            "fecha_pago": pago.fecha_pago.strftime('%Y-%m-%d') if pago.fecha_pago else None,
            "metodo_pago": pago.metodo_pago,
            "referencia": pago.referencia,
            "comprobante_url": pago.comprobante_path if hasattr(pago, 'comprobante_path') else None,
            "estado": pago.estado_pago,
            "observacion": pago.observacion,
            "factura": {
                "id_factura": pago.factura.id_factura if pago.factura else None,
                "numero_factura": pago.factura.num_factura if pago.factura else None,
                "periodo": pago.factura.periodo if pago.factura else None,
                "total": float(pago.factura.total) if pago.factura else None
            },
            "cajero": {
                "nombres": pago.cajero.nombres if pago.cajero else None,
                "apellidos": pago.cajero.apellidos if pago.cajero else None
            }
        })

    return resultado


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
    payload: dict = Depends(verify_token)
):
    """
    Permite al afiliado subir un comprobante de pago para una factura
    El pago queda en estado 'PENDIENTE' hasta que un admin lo verifique
    """
    current_user = get_current_user(payload, db)
    afiliado = get_current_afiliado(current_user, db)

    # Validar factura
    factura = db.query(Factura).filter(
        Factura.id_factura == id_factura,
        Factura.id_usuario_afi == afiliado.id_usuario_afi
    ).first()

    if not factura:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Factura no encontrada"
        )

    if Factura.estado_factura == 'pagada':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Esta factura ya está pagada"
        )

    # Validar archivo
    if comprobante.content_type not in ALLOWED_FILE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tipo de archivo no permitido. Solo se aceptan JPG, PNG o PDF"
        )

    # Leer y validar tamaño
    file_content = await comprobante.read()
    if len(file_content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo no debe superar los 5MB"
        )

    # Guardar archivo
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    file_extension = ALLOWED_FILE_TYPES[comprobante.content_type]
    filename = f"comprobante_{afiliado.id_usuario_afi}_{id_factura}_{timestamp}{file_extension}"
    file_path = UPLOAD_DIR / filename

    with open(file_path, "wb") as buffer:
        buffer.write(file_content)

    # Crear registro de pago pendiente
    nuevo_pago = Pago(
        id_factura=id_factura,
        id_usuario_afi=afiliado.id_usuario_afi,
        monto=Decimal(str(monto)) if monto else factura.total,
        fecha_pago=fecha_pago or datetime.now().date(),
        metodo_pago=metodo_pago or 'transferencia',
        referencia=referencia,
        comprobante_path=str(file_path),
        estado_pago='PENDIENTE',  # Requiere verificación
        observacion=observacion or 'Comprobante subido por el afiliado'
    )

    db.add(nuevo_pago)
    
    # Actualizar estado de factura a "en revisión" o similar
    # (esto depende de tu lógica de negocio)
    
    db.commit()
    db.refresh(nuevo_pago)

    return {
        "message": "Comprobante subido exitosamente. Será verificado por el administrador.",
        "id_pago": nuevo_pago.id_pago,
        "estado": nuevo_pago.estado_pago
    }


# ============================================================
# EXPORTACIÓN
# ============================================================

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

