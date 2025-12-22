# routes/pagos.py

from io import BytesIO
import locale
from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func, extract,case, and_,  or_, select 

from typing import List, Optional
from datetime import datetime, date, timedelta
from decimal import Decimal

from models.meter import Medidor
from models.pago import Pago
from models.factura import Factura
from models.affiliate import UsuarioAfiliado
from models.user import UsuarioSistema
from models.role import RolAccion

from schemas.factura import FacturaConUsuarioCompleto, FacturaStats
from schemas.pago import (
    PagoCreate,
    PagoUpdate,
    PagoResponse,
    PagoStats,
    PagoAnular,
    FacturasPeriodoStats  
)

from utils.audit_logger import registrar_auditoria
from utils.notifications import registrar_notificacion
from db.session import SessionLocal
from security.jwt import verify_token

router = APIRouter(prefix="/pagos", tags=["pagos"])


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


def check_permission(user: UsuarioSistema, db: Session, module: str, action: str = None) -> bool:
    """Verifica si el usuario tiene permiso para una acción"""
    module = module.lower().strip()
    action = action.lower().strip() if action else None
    
    permisos = db.query(RolAccion).filter(
        RolAccion.id_rol == user.id_rol,
        RolAccion.activo == True
    ).all()
    
    acciones_usuario = set()
    for permiso in permisos:
        if not permiso.nombre_accion:
            continue
            
        perm_module = permiso.nombre_accion.lower().strip()
        perm_action = (permiso.tipo_accion or '').lower().strip()
        
        if perm_module != module:
            continue
        
        if perm_action in ['crud', 'operaciones crud']:
            return True
        
        acciones_usuario.add(perm_action)
    
    if action is None:
        return bool(acciones_usuario)
    
    if action in ['leer', 'lectura']:
        if any(a in acciones_usuario for a in ['lectura', 'leer', 'crear', 'actualizar', 'eliminar']):
            return True
    
    return action in acciones_usuario


def require_permission(user: UsuarioSistema, db: Session, module: str, action: str = None):
    """Verifica permiso y lanza excepción si no lo tiene"""
    if not check_permission(user, db, module, action):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"No tienes permisos para {action or 'acceder a'} {module}"
        )


# Intentar configurar locale español
try:
    locale.setlocale(locale.LC_TIME, 'es_ES.UTF-8')
except:
    try:
        locale.setlocale(locale.LC_TIME, 'Spanish_Spain.1252')
    except:
        pass

# Diccionario de nombres de meses en español
MESES_ES = {
    1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril",
    5: "Mayo", 6: "Junio", 7: "Julio", 8: "Agosto",
    9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre"
}

# ========================================
# FUNCIÓN HELPER PARA ESTADÍSTICAS POR PERIODO
# ========================================
def obtener_estadisticas_pagos_por_periodo(db: Session, periodos: list):
    """
    Obtiene estadísticas de pagos para múltiples periodos en una sola consulta
    """
    resultados = (
        db.query(
            Factura.periodo.label("periodo"),
            func.count(Pago.id_pago).label("total_pagos"),
            func.coalesce(func.sum(Pago.monto_pago), 0).label("monto_total"),
            func.coalesce(func.sum(
                case((Pago.metodo_pago == 'EFECTIVO', Pago.monto_pago), else_=0)
            ), 0).label("monto_efectivo"),
            func.coalesce(func.sum(
                case((Pago.metodo_pago == 'TRANSFERENCIA', Pago.monto_pago), else_=0)
            ), 0).label("monto_transferencia"),
            func.coalesce(func.sum(
                case((Pago.metodo_pago == 'TARJETA', Pago.monto_pago), else_=0)
            ), 0).label("monto_tarjeta"),
        )
        .join(Pago, Factura.id_factura == Pago.id_factura)  # ✅ Join explícito
        .filter(
            Factura.periodo.in_(periodos),
            Pago.estado_pago == 'REGISTRADO',  # ✅ Solo pagos registrados
            Pago.activo == True
        )
        .group_by(Factura.periodo)
        .all()
    )
    
    return {r.periodo: r for r in resultados}

# ========================================
# ESTADÍSTICAS DE PAGOS (FUNCIÓN HELPER)
# ========================================
def obtener_estadisticas_pagos(
    db: Session,
    periodo: Optional[str] = None,
    id_usuario_afi: Optional[int] = None
) -> dict:
    """
    Calcula estadísticas de pagos
    """
    query = db.query(Pago).filter(Pago.activo == True)
    
    # Filtrar por periodo si se proporciona
    if periodo:
        try:
            anio, mes = periodo.split('-')
            query = query.filter(
                extract('year', Pago.fecha_pago) == int(anio),
                extract('month', Pago.fecha_pago) == int(mes)
            )
        except:
            pass
    
    # Filtrar por usuario si se proporciona
    if id_usuario_afi:
        query = query.filter(Pago.id_usuario_afi == id_usuario_afi)
    
    # Total de pagos
    total_pagos = query.count()
    
    # Pagos por estado
    pagos_activos = query.filter(Pago.activo == True).count()  # ✅ AGREGAR
    pagos_registrados = query.filter(Pago.estado_pago == 'REGISTRADO').count()
    pagos_anulados = query.filter(Pago.estado_pago == 'ANULADO').count()
    
    # Montos totales (solo REGISTRADOS)
    pagos_validos = query.filter(Pago.estado_pago == 'REGISTRADO')
    
    monto_total = db.query(func.sum(Pago.monto_pago)).filter(
        Pago.id_pago.in_([p.id_pago for p in pagos_validos])
    ).scalar() or Decimal('0.00')
    
    # Montos por método de pago
    monto_efectivo = db.query(func.sum(Pago.monto_pago)).filter(
        Pago.id_pago.in_([p.id_pago for p in pagos_validos]),
        Pago.metodo_pago == 'EFECTIVO'
    ).scalar() or Decimal('0.00')
    
    monto_transferencia = db.query(func.sum(Pago.monto_pago)).filter(
        Pago.id_pago.in_([p.id_pago for p in pagos_validos]),
        Pago.metodo_pago == 'TRANSFERENCIA'
    ).scalar() or Decimal('0.00')
    
    monto_tarjeta = db.query(func.sum(Pago.monto_pago)).filter(
        Pago.id_pago.in_([p.id_pago for p in pagos_validos]),
        Pago.metodo_pago == 'TARJETA'
    ).scalar() or Decimal('0.00')
    
    monto_otros = monto_total - (monto_efectivo + monto_transferencia + monto_tarjeta)
    
    return {
        "total_pagos": total_pagos,
        "pagos_activos": pagos_activos,  # ✅ AGREGAR
        "pagos_registrados": pagos_registrados,
        "pagos_anulados": pagos_anulados,
        "monto_total": float(monto_total),  # ✅ CAMBIAR NOMBRE
        "monto_efectivo": float(monto_efectivo),
        "monto_transferencia": float(monto_transferencia),
        "monto_tarjeta": float(monto_tarjeta),
        "monto_otros": float(monto_otros)
    }

# ========================================
# ESTADÍSTICAS DE FACTURAS POR PERIODO
# ========================================
def obtener_estadisticas_facturas_periodo(db: Session, periodo: str) -> dict:
    """
    Calcula estadísticas desde las FACTURAS de un periodo específico.
    """
    # Query base: facturas del periodo
    facturas_query = db.query(Factura).filter(Factura.periodo == periodo)
    
    # Estadísticas de facturas
    total_facturas = facturas_query.count()
    facturas_pagadas = facturas_query.filter(Factura.estado_factura == 'pagada').count()
    facturas_anuladas = facturas_query.filter(Factura.estado_factura == 'anulada').count()
    facturas_pendientes = facturas_query.filter(Factura.estado_factura == 'pendiente').count()
    facturas_vencidas = facturas_query.filter(Factura.estado_factura == 'vencida').count()
    
    # ✅ Subquery usando select() explícitamente
    facturas_ids_subquery = select(Factura.id_factura).where(Factura.periodo == periodo).scalar_subquery()
    
    # Total recaudado (solo pagos REGISTRADOS)
    total_recaudado = db.query(
        func.coalesce(func.sum(Pago.monto_pago), 0)
    ).filter(
        Pago.id_factura.in_(facturas_ids_subquery),  # ✅ Ahora no habrá warning
        Pago.estado_pago == 'REGISTRADO'
    ).scalar()
    
    # Efectivo
    total_efectivo = db.query(
        func.coalesce(func.sum(Pago.monto_pago), 0)
    ).filter(
        Pago.id_factura.in_(facturas_ids_subquery),
        Pago.estado_pago == 'REGISTRADO',
        Pago.metodo_pago == 'EFECTIVO'
    ).scalar()
    
    # Transferencia
    total_transferencia = db.query(
        func.coalesce(func.sum(Pago.monto_pago), 0)
    ).filter(
        Pago.id_factura.in_(facturas_ids_subquery),
        Pago.estado_pago == 'REGISTRADO',
        Pago.metodo_pago == 'TRANSFERENCIA'
    ).scalar()
    
    # Tarjeta
    total_tarjeta = db.query(
        func.coalesce(func.sum(Pago.monto_pago), 0)
    ).filter(
        Pago.id_factura.in_(facturas_ids_subquery),
        Pago.estado_pago == 'REGISTRADO',
        Pago.metodo_pago == 'TARJETA'
    ).scalar()
    
    # Estadísticas de pagos
    total_pagos_registrados = db.query(Pago).filter(
        Pago.id_factura.in_(facturas_ids_subquery),
        Pago.estado_pago == 'REGISTRADO'
    ).count()
    
    total_pagos_anulados = db.query(Pago).filter(
        Pago.id_factura.in_(facturas_ids_subquery),
        Pago.estado_pago == 'ANULADO'
    ).count()
    
    return {
        "total_facturas": total_facturas,
        "facturas_pagadas": facturas_pagadas,
        "facturas_anuladas": facturas_anuladas,
        "facturas_pendientes": facturas_pendientes,
        "facturas_vencidas": facturas_vencidas,
        "total_recaudado": float(total_recaudado),
        "total_efectivo": float(total_efectivo),
        "total_transferencia": float(total_transferencia),
        "total_tarjeta": float(total_tarjeta),
        "total_pagos_registrados": total_pagos_registrados,
        "total_pagos_anulados": total_pagos_anulados
    }

# ========================================
# OBTENER ESTADÍSTICAS DE FACTURAS POR PERIODO
# ========================================
@router.get("/stats/facturas-periodo", response_model=FacturasPeriodoStats)
def obtener_estadisticas_facturas_endpoint(
    periodo: str = Query(..., description="Periodo específico (YYYY-MM)"),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Obtiene estadísticas de facturas de un periodo específico.
    Endpoint: GET /pagos/stats/facturas-periodo?periodo=2025-12
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "pagos", "lectura")
    
    stats = obtener_estadisticas_facturas_periodo(db, periodo)
    return stats


# ========================================
# OBTENER PERÍODOS DISPONIBLES DE PAGOS
# ========================================
@router.get("/periodos/disponibles", response_model=dict)
def obtener_periodos_pagos_disponibles(
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "pagos", "lectura")
    
    hoy = date.today()
    mes_actual = hoy.month
    anio_actual = hoy.year
    
    periodos = []
    periodos_str = []
    
    # Generar periodos (6 meses atrás, 2 meses adelante)
    for offset in range(-6, 3):
        mes = mes_actual + offset
        anio = anio_actual
        
        while mes > 12:
            mes -= 12
            anio += 1
        
        while mes < 1:
            mes += 12
            anio -= 1
        
        periodo_str = f"{anio}-{mes:02d}"
        periodos_str.append(periodo_str)
        periodos.append({
            "mes": mes,
            "anio": anio,
            "periodo": periodo_str,
            "sugerido": mes == mes_actual and anio == anio_actual
        })
    
    # 🔥 Obtener estadísticas en UNA SOLA consulta
    stats_map = obtener_estadisticas_pagos_por_periodo(db, periodos_str)
    
    # Agregar estadísticas a cada periodo
    for p in periodos:
        stats = stats_map.get(p["periodo"])
        p.update({
            "nombre_mes": MESES_ES.get(p["mes"]),
            "tiene_pagos": stats is not None,
            "total_pagos": stats.total_pagos if stats else 0,
            "monto_total": float(stats.monto_total) if stats else 0,
            "monto_efectivo": float(stats.monto_efectivo) if stats else 0,
            "monto_transferencia": float(stats.monto_transferencia) if stats else 0,
            "monto_tarjeta": float(stats.monto_tarjeta) if stats else 0,
            "valor": p["periodo"],
            "texto": f"{MESES_ES.get(p['mes'])} {p['anio']}"
        })
    
    # Ordenar por año y mes (más reciente primero)
    periodos.sort(key=lambda x: (x["anio"], x["mes"]), reverse=True)
    
    # Encontrar periodo actual
    periodo_actual = next((p for p in periodos if p["sugerido"]), periodos[0])
    
    return {
        "periodo_actual": periodo_actual,
        "periodos_disponibles": periodos
    }

# ========================================
# OBTENER LAS FACTURAS POR PERIODO
# ========================================

@router.get("/facturas-periodo", response_model=List[FacturaConUsuarioCompleto])
def obtener_facturas_periodo(
    periodo: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    estado_factura: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "pagos", "lectura")

    query = db.query(Factura)

    # 🔹 CARGAS OPTIMIZADAS
    query = query.options(
        joinedload(Factura.usuario_afiliado)
            .joinedload(UsuarioAfiliado.usuario_sistema),
        joinedload(Factura.usuario_afiliado)
            .joinedload(UsuarioAfiliado.sector),
        joinedload(Factura.usuario_afiliado)
        .joinedload(UsuarioAfiliado.medidores), 
        selectinload(Factura.detalles),
        selectinload(Factura.pagos)
    )

    # Filtros
    if periodo:
        query = query.filter(Factura.periodo == periodo)

    if estado_factura:
        query = query.filter(Factura.estado_factura == estado_factura)

    # JOIN SOLO SI HAY BÚSQUEDA
    if search:
        query = (
            query
            .join(Factura.usuario_afiliado)
            .join(UsuarioAfiliado.usuario_sistema)
            .outerjoin(UsuarioAfiliado.medidores)
            .filter(
                or_(
                    Factura.num_factura.ilike(f"%{search}%"),
                    UsuarioSistema.nombres.ilike(f"%{search}%"),
                    UsuarioSistema.apellidos.ilike(f"%{search}%"),
                    UsuarioSistema.cedula.ilike(f"%{search}%"),
                    Medidor.num_medidor.ilike(f"%{search}%")
                )
            )
        )

    estado_orden = case(
        (Factura.estado_factura == 'pendiente', 1),
        (Factura.estado_factura == 'vencida', 2),
        (Factura.estado_factura == 'pagada', 3),
        (Factura.estado_factura == 'anulada', 4),
        else_=5
    )

    query = query.order_by(
        estado_orden,
        Factura.fecha_emision.desc()
    )

    return query.offset(skip).limit(limit).all()

# ========================================
# LISTAR PAGOS
# ========================================
@router.get("/", response_model=List[PagoResponse])
def listar_pagos(
    search: Optional[str] = Query(None, description="Buscar por ID o número de factura"),
    id_usuario_afi: Optional[int] = Query(None, description="Filtrar por usuario afiliado"),
    periodo: Optional[str] = Query(None, description="Filtrar por periodo (YYYY-MM)"),
    estado_pago: Optional[str] = Query(None, description="Filtrar por estado (REGISTRADO, ANULADO)"),
    metodo_pago: Optional[str] = Query(None, description="Filtrar por método de pago"),
    fecha_desde: Optional[date] = Query(None, description="Fecha de pago desde"),
    fecha_hasta: Optional[date] = Query(None, description="Fecha de pago hasta"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Lista pagos con múltiples filtros e información completa
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "pagos", "lectura")
    
    # Query con joinedload para optimizar
    query = db.query(Pago).options(
        joinedload(Pago.factura),
        joinedload(Pago.usuario_afiliado).joinedload(UsuarioAfiliado.usuario_sistema),
        joinedload(Pago.cajero)
    )
    
    # Filtros
    if search:
        query = query.filter(
            (Pago.id_pago == int(search) if search.isdigit() else False) |
            (Pago.factura.has(Factura.num_factura.ilike(f"%{search}%")))
        )
    
    if id_usuario_afi:
        query = query.filter(Pago.id_usuario_afi == id_usuario_afi)
    
    if periodo:
        # Filtrar por periodo (año-mes de fecha_pago)
        try:
            anio, mes = periodo.split('-')
            query = query.filter(
                extract('year', Pago.fecha_pago) == int(anio),
                extract('month', Pago.fecha_pago) == int(mes)
            )
        except:
            pass
    
    if estado_pago:
        query = query.filter(Pago.estado_pago == estado_pago)
    
    if metodo_pago:
        query = query.filter(Pago.metodo_pago == metodo_pago)
    
    if fecha_desde:
        query = query.filter(Pago.fecha_pago >= fecha_desde)
    
    if fecha_hasta:
        # Incluir todo el día
        fecha_hasta_completa = datetime.combine(fecha_hasta, datetime.max.time())
        query = query.filter(Pago.fecha_pago <= fecha_hasta_completa)
    
    # Ordenar por fecha de pago descendente
    query = query.order_by(Pago.fecha_pago.desc(), Pago.id_pago.desc())
    
    pagos = query.offset(skip).limit(limit).all()
    return pagos


# ========================================
# OBTENER ESTADÍSTICAS
# ========================================
@router.get("/stats/resumen", response_model=PagoStats)
def obtener_estadisticas(
    periodo: Optional[str] = Query(None, description="Periodo específico (YYYY-MM)"),
    id_usuario_afi: Optional[int] = Query(None, description="Usuario específico"),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """Obtiene estadísticas generales de pagos"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "pagos", "lectura")
    
    stats = obtener_estadisticas_pagos(db, periodo, id_usuario_afi)
    return stats


# ========================================
# OBTENER PAGO POR ID
# ========================================
@router.get("/{id_pago}", response_model=PagoResponse)
def obtener_pago(
    id_pago: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """Obtiene un pago específico con todos sus detalles"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "pagos", "lectura")
    
    pago = db.query(Pago).options(
        joinedload(Pago.factura),
        joinedload(Pago.usuario_afiliado).joinedload(UsuarioAfiliado.usuario_sistema),
        joinedload(Pago.cajero)
    ).filter(Pago.id_pago == id_pago).first()
    
    if not pago:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pago no encontrado"
        )
    
    return pago


# ========================================
# OBTENER PAGOS DE UNA FACTURA
# ========================================
@router.get("/factura/{id_factura}", response_model=List[PagoResponse])
def obtener_pagos_por_factura(
    id_factura: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """Obtiene todos los pagos asociados a una factura específica"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "pagos", "lectura")
    
    # Verificar que la factura existe
    factura = db.query(Factura).filter(Factura.id_factura == id_factura).first()
    if not factura:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Factura no encontrada"
        )
    
    pagos = db.query(Pago).options(
        joinedload(Pago.usuario_afiliado).joinedload(UsuarioAfiliado.usuario_sistema),
        joinedload(Pago.cajero)
    ).filter(
        Pago.id_factura == id_factura
    ).order_by(Pago.fecha_pago.desc()).all()
    
    return pagos


# ========================================
# OBTENER PAGOS DE UN AFILIADO
# ========================================
@router.get("/afiliado/{id_usuario_afi}", response_model=List[PagoResponse])
def obtener_pagos_por_afiliado(
    id_usuario_afi: int,
    periodo: Optional[str] = Query(None, description="Filtrar por periodo (YYYY-MM)"),
    estado_pago: Optional[str] = Query(None, description="Filtrar por estado"),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """Obtiene todos los pagos de un afiliado específico"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "pagos", "lectura")
    
    # Verificar que el afiliado existe
    afiliado = db.query(UsuarioAfiliado).filter(
        UsuarioAfiliado.id_usuario_afi == id_usuario_afi
    ).first()
    
    if not afiliado:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Afiliado no encontrado"
        )
    
    query = db.query(Pago).options(
        joinedload(Pago.factura),
        joinedload(Pago.cajero)
    ).filter(Pago.id_usuario_afi == id_usuario_afi)
    
    # Filtros opcionales
    if periodo:
        try:
            anio, mes = periodo.split('-')
            query = query.filter(
                extract('year', Pago.fecha_pago) == int(anio),
                extract('month', Pago.fecha_pago) == int(mes)
            )
        except:
            pass
    
    if estado_pago:
        query = query.filter(Pago.estado_pago == estado_pago)
    
    pagos = query.order_by(Pago.fecha_pago.desc()).all()
    return pagos


# ========================================
# CREAR NUEVO PAGO
# ========================================
@router.post("/", response_model=PagoResponse, status_code=status.HTTP_201_CREATED)
def crear_pago(
    pago: PagoCreate,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Registra un nuevo pago
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "pagos", "crear")
    
    # Validar que la factura existe (si se proporciona)
    if pago.id_factura:
        factura = db.query(Factura).filter(
            Factura.id_factura == pago.id_factura
        ).first()
        
        if not factura:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Factura no encontrada"
            )
        
        # Validar que la factura esté pendiente o vencida
        if factura.estado_factura not in ['pendiente', 'vencida']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No se puede registrar pago para factura en estado '{factura.estado_factura}'"
            )
    
    # Validar que el afiliado existe (si se proporciona)
    if pago.id_usuario_afi:
        afiliado = db.query(UsuarioAfiliado).filter(
            UsuarioAfiliado.id_usuario_afi == pago.id_usuario_afi
        ).first()
        
        if not afiliado:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Afiliado no encontrado"
            )
    
    try:
        nuevo_pago = Pago(
            id_factura=pago.id_factura,
            monto_pago=pago.monto_pago,
            fecha_pago=datetime.now(),
            metodo_pago=pago.metodo_pago,
            id_usuario_afi=pago.id_usuario_afi,
            id_cajero=pago.id_cajero,
            observaciones=pago.observaciones,
            activo=True,
            estado_pago='REGISTRADO'
        )
        
        db.add(nuevo_pago)
        db.flush()  # Para obtener el ID antes del commit
        
        # Si hay factura asociada, verificar si se debe marcar como pagada
        if pago.id_factura:
            factura = db.query(Factura).filter(
                Factura.id_factura == pago.id_factura
            ).first()
            
            # Calcular total pagado de la factura
            total_pagado = db.query(func.sum(Pago.monto_pago)).filter(
                Pago.id_factura == pago.id_factura,
                Pago.estado_pago == 'REGISTRADO'
            ).scalar() or Decimal('0.00')
            
            # Si el pago cubre el total, marcar factura como pagada
            if total_pagado >= factura.total:
                factura.estado_factura = 'pagada'
                print(f"✅ Factura {factura.num_factura} marcada como PAGADA")
        
        db.commit()
        db.refresh(nuevo_pago)
        
        # Auditoría
        registrar_auditoria(
            db=db,
            accion="CREATE",
            descripcion=f"Pago #{nuevo_pago.id_pago} registrado - Monto: ${pago.monto_pago} - Método: {pago.metodo_pago}",
            id_usuario=current_user.id_usuario_sistema
        )
        
        registrar_notificacion(
            db=db,
            id_usuario=current_user.id_usuario_sistema,
            titulo="Pago registrado",
            mensaje=f"Pago de ${pago.monto_pago} registrado correctamente",
            tipo="exito"
        )
        
        return nuevo_pago
        
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Error de integridad: verifique las relaciones (factura, afiliado, cajero)"
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear pago: {str(e)}"
        )


# ========================================
# ACTUALIZAR PAGO
# ========================================
@router.put("/{id_pago}", response_model=PagoResponse)
def actualizar_pago(
    id_pago: int,
    pago_update: PagoUpdate,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Actualiza un pago existente
    Solo permite actualizar pagos en estado 'REGISTRADO'
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "pagos", "actualizar")
    
    pago = db.query(Pago).filter(Pago.id_pago == id_pago).first()
    
    if not pago:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pago no encontrado"
        )
    
    # Solo permitir actualizar pagos registrados
    if pago.estado_pago != 'REGISTRADO':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se puede modificar un pago en estado '{pago.estado_pago}'"
        )
    
    try:
        # Actualizar campos
        if pago_update.monto_pago is not None:
            pago.monto_pago = pago_update.monto_pago
        
        if pago_update.metodo_pago is not None:
            pago.metodo_pago = pago_update.metodo_pago
        
        if pago_update.observaciones is not None:
            pago.observaciones = pago_update.observaciones
        
        db.commit()
        db.refresh(pago)
        
        # Auditoría
        registrar_auditoria(
            db=db,
            accion="UPDATE",
            descripcion=f"Pago #{pago.id_pago} actualizado",
            id_usuario=current_user.id_usuario_sistema
        )
        
        return pago
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al actualizar pago: {str(e)}"
        )


# ========================================
# ANULAR PAGO
# ========================================
@router.patch("/{id_pago}/anular", response_model=PagoResponse)
def anular_pago(
    id_pago: int,
    motivo: Optional[str] = Query(None, description="Motivo de anulación"),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Anula un pago (solo si está REGISTRADO)
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "pagos", "eliminar")
    
    pago = db.query(Pago).filter(Pago.id_pago == id_pago).first()
    
    if not pago:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pago no encontrado"
        )
    
    if pago.estado_pago != 'REGISTRADO':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se puede anular un pago en estado '{pago.estado_pago}'"
        )
    
    try:
        pago.estado_pago = 'ANULADO'
        pago.motivo_anulacion = motivo or 'Anulado por usuario'
        pago.fecha_anulacion = datetime.now()
        pago.activo = False
        
        # Si el pago tiene factura asociada, verificar si debe cambiar su estado
        if pago.id_factura:
            factura = db.query(Factura).filter(
                Factura.id_factura == pago.id_factura
            ).first()
            
            if factura and factura.estado_factura == 'pagada':
                # Calcular total pagado sin este pago
                total_pagado = db.query(func.sum(Pago.monto_pago)).filter(
                    Pago.id_factura == pago.id_factura,
                    Pago.estado_pago == 'REGISTRADO',
                    Pago.id_pago != id_pago
                ).scalar() or Decimal('0.00')
                
                # Si ya no cubre el total, volver a pendiente
                if total_pagado < factura.total:
                    factura.estado_factura = 'pendiente'
                    print(f"⚠️ Factura {factura.num_factura} devuelta a estado PENDIENTE")
        
        db.commit()
        db.refresh(pago)
        
        # Auditoría
        registrar_auditoria(
            db=db,
            accion="UPDATE",
            descripcion=f"Pago #{pago.id_pago} anulado. Motivo: {motivo or 'No especificado'}",
            id_usuario=current_user.id_usuario_sistema
        )
        
        return pago
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al anular el pago: {str(e)}"
        )


# ========================================
# ELIMINAR PAGO (Solo administradores)
# ========================================
@router.delete("/{id_pago}", status_code=status.HTTP_200_OK)
def eliminar_pago(
    id_pago: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Elimina físicamente un pago de la base de datos.
    Solo disponible para administradores.
    El pago debe estar anulado previamente.
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "pagos", "eliminar")
    
    pago = db.query(Pago).filter(Pago.id_pago == id_pago).first()
    
    if not pago:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pago no encontrado"
        )
    
    # Verificar que el pago esté anulado
    if pago.estado_pago != 'ANULADO':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo se pueden eliminar pagos anulados. Primero anule el pago."
        )
    
    try:
        # Guardar información para auditoría
        id_eliminado = pago.id_pago
        monto = pago.monto_pago
        
        # Eliminar el pago
        db.delete(pago)
        db.commit()
        
        # Auditoría
        registrar_auditoria(
            db=db,
            accion="DELETE",
            descripcion=f"Pago #{id_eliminado} eliminado físicamente - Monto: ${monto}",
            id_usuario=current_user.id_usuario_sistema
        )
        
        return {
            "success": True,
            "message": f"Pago #{id_eliminado} eliminado correctamente",
            "id_pago": id_eliminado
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al eliminar pago: {str(e)}"
        )


# ========================================
# REPORTE DE PAGOS POR RANGO DE FECHAS
# ========================================
@router.get("/reportes/por-fecha", response_model=dict)
def reporte_pagos_por_fecha(
    fecha_inicio: date = Query(..., description="Fecha de inicio del reporte"),
    fecha_fin: date = Query(..., description="Fecha de fin del reporte"),
    metodo_pago: Optional[str] = Query(None, description="Filtrar por método de pago"),
    estado_pago: Optional[str] = Query(None, description="Filtrar por estado"),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Genera un reporte de pagos en un rango de fechas
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "pagos", "lectura")
    
    # Construir query
    query = db.query(Pago).options(
        joinedload(Pago.factura),
        joinedload(Pago.usuario_afiliado).joinedload(UsuarioAfiliado.usuario_sistema),
        joinedload(Pago.cajero)
    ).filter(
        Pago.fecha_pago >= fecha_inicio,
        Pago.fecha_pago <= datetime.combine(fecha_fin, datetime.max.time())
    )
    
    if metodo_pago:
        query = query.filter(Pago.metodo_pago == metodo_pago)
    
    if estado_pago:
        query = query.filter(Pago.estado_pago == estado_pago)
    
    pagos = query.order_by(Pago.fecha_pago.desc()).all()
    
    # Calcular totales
    total_registrados = sum(1 for p in pagos if p.estado_pago == 'REGISTRADO')
    total_anulados = sum(1 for p in pagos if p.estado_pago == 'ANULADO')
    
    monto_total = sum(float(p.monto_pago) for p in pagos if p.estado_pago == 'REGISTRADO')
    monto_efectivo = sum(float(p.monto_pago) for p in pagos if p.estado_pago == 'REGISTRADO' and p.metodo_pago == 'EFECTIVO')
    monto_tarjeta = sum(float(p.monto_pago) for p in pagos if p.estado_pago == 'REGISTRADO' and p.metodo_pago == 'TARJETA')
    monto_transferencia = sum(float(p.monto_pago) for p in pagos if p.estado_pago == 'REGISTRADO' and p.metodo_pago == 'TRANSFERENCIA')
    
    return {
        "fecha_inicio": fecha_inicio.isoformat(),
        "fecha_fin": fecha_fin.isoformat(),
        "total_pagos": len(pagos),
        "total_registrados": total_registrados,
        "total_anulados": total_anulados,
        "monto_total": monto_total,
        "monto_efectivo": monto_efectivo,
        "monto_tarjeta": monto_tarjeta,
        "monto_transferencia": monto_transferencia,
        "pagos": pagos
    }


# ========================================
# ENPOINS PARA LA GESTION DE COMPROBANTES
# ========================================

@router.post("/{id_pago}/comprobante", status_code=200)
async def subir_comprobante_pago(
    id_pago: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """Sube un comprobante PDF para un pago"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "pagos", "actualizar")
    
    # Verificar que el pago existe
    pago = db.query(Pago).filter(Pago.id_pago == id_pago).first()
    if not pago:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    
    # Validar tipo de archivo
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos PDF")
    
    # Validar tamaño (máximo 5MB)
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="El archivo no debe superar 5MB")
    
    try:
        # Guardar en la base de datos
        pago.comprobante_pdf = content
        pago.nombre_archivo = file.filename
        pago.tipo_mime = file.content_type or 'application/pdf'
        
        db.commit()
        
        return {
            "success": True,
            "message": "Comprobante subido exitosamente",
            "filename": file.filename,
            "size_bytes": len(content)
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al subir comprobante: {str(e)}")


@router.get("/{id_pago}/comprobante")
def descargar_comprobante_pago(
    id_pago: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "pagos", "lectura")

    pago = db.query(Pago).filter(Pago.id_pago == id_pago).first()
    if not pago:
        raise HTTPException(status_code=404, detail="Pago no encontrado")

    if not pago.comprobante_pdf:
        raise HTTPException(status_code=404, detail="El pago no tiene comprobante")

    pdf_content = pago.comprobante_pdf
    if isinstance(pdf_content, memoryview):
        pdf_content = pdf_content.tobytes()

    filename = pago.nombre_archivo or f"comprobante_pago_{id_pago}.pdf"

    return StreamingResponse(
        BytesIO(pdf_content),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(pdf_content)),
            "Cache-Control": "no-store",
            "Pragma": "no-cache"
        }
    )


@router.delete("/{id_pago}/comprobante", status_code=200)
def eliminar_comprobante_pago(
    id_pago: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """Elimina el comprobante PDF de un pago"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "pagos", "eliminar")
    
    pago = db.query(Pago).filter(Pago.id_pago == id_pago).first()
    if not pago:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    
    if not pago.comprobante_pdf:
        raise HTTPException(status_code=404, detail="El pago no tiene comprobante")
    
    try:
        pago.comprobante_pdf = None
        pago.nombre_archivo = None
        pago.tipo_mime = None
        
        db.commit()
        
        return {
            "success": True,
            "message": "Comprobante eliminado exitosamente"
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al eliminar comprobante: {str(e)}")

