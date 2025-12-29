"""
routers/affiliate_billing.py
Router para gestión de facturas y pagos de afiliados
"""

import io
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, logger, status, Query, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload, load_only, aliased
from sqlalchemy import and_, desc, func, extract, or_, case
from typing import List, Optional, Dict
from datetime import date, datetime
from pathlib import Path
import shutil

from models.detalle_factura import DetalleFactura
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

@router.get("/mis-facturas", response_model=List[dict])
def listar_mis_facturas_completo(
    anio: Optional[int] = Query(None),
    mes: Optional[int] = Query(None, ge=1, le=12),
    estado_factura: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Obtener facturas del usuario afiliado actual con información completa:
    - Datos de la factura
    - Información del afiliado (nombres, medidor)
    - Detalles de factura
    - Pago asociado (si existe)
    """
    current_user = get_current_user(payload, db)
    afiliado = get_current_afiliado(current_user, db)

    try:
        # ✅ Crear alias para el cajero
        Cajero = aliased(UsuarioSistema)
        
        # ========================================
        # 🔥 QUERY PRINCIPAL - FACTURAS DEL AFILIADO
        # ========================================
        query = (
            db.query(
                # Factura
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
                # Afiliado
                UsuarioAfiliado.id_usuario_afi,
                UsuarioAfiliado.cod_usuario_afi,
                UsuarioAfiliado.num_medidor,
                # Usuario sistema (del afiliado)
                UsuarioSistema.nombres,
                UsuarioSistema.apellidos,
                UsuarioSistema.cedula,
                UsuarioSistema.direccion,
                UsuarioSistema.telefono,
                UsuarioSistema.email,
                # Sector
                Sector.nombre_sector,
                # ✅ PAGO (relación 1:1)
                Pago.id_pago,
                Pago.monto_pago,
                Pago.fecha_pago,
                Pago.metodo_pago,
                Pago.estado_pago,
                Pago.observaciones,
                # ✅ COMPROBANTE
                Pago.nombre_archivo,
                Pago.tipo_mime,
                case(
                    (Pago.comprobante_pdf.isnot(None), True),
                    else_=False
                ).label('tiene_comprobante'),
                # ✅ CAJERO (usando alias)
                Cajero.nombres.label('cajero_nombres'),
                Cajero.apellidos.label('cajero_apellidos')
            )
            .join(UsuarioAfiliado, Factura.id_usuario_afi == UsuarioAfiliado.id_usuario_afi)
            .join(UsuarioSistema, UsuarioAfiliado.id_usuario_sistema == UsuarioSistema.id_usuario_sistema)
            .outerjoin(Sector, UsuarioAfiliado.id_sector == Sector.id_sector)
            # ✅ JOIN con pagos (puede no tener pago)
            .outerjoin(Pago, Factura.id_factura == Pago.id_factura)
            # ✅ JOIN con cajero usando alias
            .outerjoin(Cajero, Pago.id_cajero == Cajero.id_usuario_sistema)
            # ✅ FILTRAR POR AFILIADO ACTUAL
            .filter(Factura.id_usuario_afi == afiliado.id_usuario_afi)
        )

        # ===============================
        # FILTROS
        # ===============================
        if anio and mes:
            fecha_inicio = date(anio, mes, 1)
            fecha_fin = date(anio + 1, 1, 1) if mes == 12 else date(anio, mes + 1, 1)
            query = query.filter(
                Factura.fecha_emision >= fecha_inicio,
                Factura.fecha_emision < fecha_fin
            )
        elif anio:
            fecha_inicio = date(anio, 1, 1)
            fecha_fin = date(anio + 1, 1, 1)
            query = query.filter(
                Factura.fecha_emision >= fecha_inicio,
                Factura.fecha_emision < fecha_fin
            )

        if estado_factura and estado_factura != "todos":
            query = query.filter(Factura.estado_factura == estado_factura)

        # Ordenar
        estado_orden = case(
            (Factura.estado_factura == 'pendiente', 1),
            (Factura.estado_factura == 'vencida', 2),
            (Factura.estado_factura == 'pagada', 3),
            (Factura.estado_factura == 'anulada', 4),
            else_=5
        )

        facturas = (
            query
            .order_by(estado_orden, Factura.fecha_emision.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

        if not facturas:
            return []

        ids_facturas = [f.id_factura for f in facturas]

        # ========================================
        # 🔥 QUERY: DETALLES
        # ========================================
        detalles_query = (
            db.query(
                DetalleFactura.id_detalle,
                DetalleFactura.id_factura,
                DetalleFactura.tipo_detalle,
                DetalleFactura.descripcion,
                DetalleFactura.subtotal_detalle,
            )
            .filter(DetalleFactura.id_factura.in_(ids_facturas))
            .order_by(
                DetalleFactura.id_factura,
                case(
                    (DetalleFactura.tipo_detalle == 'consumo', 1),
                    (DetalleFactura.tipo_detalle == 'multa', 2),
                    (DetalleFactura.tipo_detalle == 'servicio', 3),
                    else_=4
                ),
                DetalleFactura.id_detalle
            )
            .all()
        )
        
        detalles_por_factura = {}
        for d in detalles_query:
            if d.id_factura not in detalles_por_factura:
                detalles_por_factura[d.id_factura] = []
            detalles_por_factura[d.id_factura].append({
                "id_detalle": d.id_detalle,
                "tipo_detalle": d.tipo_detalle,
                "descripcion": d.descripcion or "Sin descripción",
                "subtotal_detalle": float(d.subtotal_detalle) if d.subtotal_detalle else 0.0,
            })

        print(f"✅ Facturas: {len(facturas)} | Detalles: {len(detalles_query)}")

        # ========================================
        # 🔄 FORMATEAR RESPUESTA
        # ========================================
        resultado = []
        
        for f in facturas:
            detalles_factura = detalles_por_factura.get(f.id_factura, [])
            
            # ✅ Construir nombre del cajero
            cajero_nombre = None
            if f.cajero_nombres and f.cajero_apellidos:
                cajero_nombre = f"{f.cajero_nombres} {f.cajero_apellidos}"
            elif f.cajero_nombres:
                cajero_nombre = f.cajero_nombres
            elif f.cajero_apellidos:
                cajero_nombre = f.cajero_apellidos
            
            # ✅ PAGO (puede ser None si no tiene pago)
            pago = None
            if f.id_pago:
                pago = {
                    "id_pago": f.id_pago,
                    "monto_pago": float(f.monto_pago) if f.monto_pago else 0.0,
                    "fecha_pago": f.fecha_pago.isoformat() if f.fecha_pago else None,
                    "metodo_pago": f.metodo_pago or "No especificado",
                    "estado_pago": f.estado_pago,
                    "observaciones": f.observaciones,
                    "cajero": cajero_nombre or "Sin cajero",
                    # ✅ COMPROBANTE
                    "tiene_comprobante": f.tiene_comprobante,
                    
                    "nombre_archivo": f.nombre_archivo,
                    "tipo_mime": f.tipo_mime or "application/pdf"
                }
            
            # Calcular totales
            monto_pagado = float(f.monto_pago) if f.monto_pago else 0.0
            saldo_pendiente = float(f.total) - monto_pagado
            
            resultado.append({
                "id_factura": f.id_factura,
                "num_factura": f.num_factura,
                "periodo": f.periodo,
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
                    
                    "usuario_sistema": {
                        "nombres": f.nombres,
                        "apellidos": f.apellidos,
                        "cedula": f.cedula,
                        "direccion": f.direccion,
                        "telefono": f.telefono,
                        "email": f.email,
                    },
                    
                    "sector": {
                        "nombre_sector": f.nombre_sector or "Sin sector"
                    }
                },
                
                "detalles": detalles_factura,
                
                "resumen_detalles": {
                    "total_conceptos": len(detalles_factura),
                    "consumo": len([d for d in detalles_factura if d['tipo_detalle'] == 'consumo']),
                    "multas": len([d for d in detalles_factura if d['tipo_detalle'] == 'multa']),
                    "servicios": len([d for d in detalles_factura if d['tipo_detalle'] == 'servicio']),
                },
                
                # ✅ UN SOLO PAGO (no array)
                "pago": pago,
                
                # ✅ RESUMEN SIMPLIFICADO
                "tiene_pago": pago is not None,
                "monto_pagado": monto_pagado,
                "saldo_pendiente": saldo_pendiente,
                "esta_totalmente_pagada": saldo_pendiente <= 0,
                "tiene_comprobante": f.tiene_comprobante if f.id_pago else False
            })

        return resultado

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Error al obtener mis facturas: {str(e)}"
        )





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


@router.get("/comprobante/{id_pago}", status_code=status.HTTP_200_OK)
def descargar_comprobante_afiliado(
    id_pago: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Descargar comprobante PDF de un pago (solo del afiliado actual)
    """
    from fastapi.responses import Response
    
    current_user = get_current_user(payload, db)
    afiliado = get_current_afiliado(current_user, db)
    
    # Buscar el pago
    pago = db.query(Pago).filter(Pago.id_pago == id_pago).first()
    if not pago:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pago con ID {id_pago} no encontrado"
        )
    
    # ✅ VALIDAR QUE EL PAGO PERTENECE AL AFILIADO ACTUAL
    factura = db.query(Factura).filter(Factura.id_factura == pago.id_factura).first()
    if not factura or factura.id_usuario_afi != afiliado.id_usuario_afi:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para acceder a este comprobante"
        )
    
    # Verificar que tenga comprobante
    if not pago.comprobante_pdf:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Este pago no tiene comprobante PDF"
        )
    
    # Retornar el PDF
    return Response(
        content=pago.comprobante_pdf,
        media_type=pago.tipo_mime or "application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={pago.nombre_archivo or f'comprobante_{id_pago}.pdf'}",
            "Cache-Control": "no-cache"
        }
    )
