# routes/reports.py
"""
Router centralizado para generación de reportes y estadísticas del sistema
Maneja todos los módulos de reportes de forma unificada
"""

import math
from fastapi import APIRouter, Depends, HTTPException, Query, status, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload, aliased
from sqlalchemy import and_, case, desc, extract, or_, cast, String, func, select
from typing import List, Optional
from datetime import datetime, date
import io
import csv

from db.session import SessionLocal
from models.detalle_factura import DetalleFactura
from models.mora import MoraFactura
from models.user import UsuarioSistema
from models.role import Rol, RolAccion
from models.affiliate import UsuarioAfiliado
from models.meter import Medidor
from models.sector import Sector
from models.tarifa import Tarifa
from models.lectura import Lectura
from models.factura import Factura
from models.pago import Pago
from models.multa import TipoMulta
from models.multa_afiliado import MultaAfiliado
from models.servicio import Servicio
from models.notification import Notificacion

from routes.afiliatesGeneral import get_current_afiliado, obtener_nombre_mes
from schemas.pago import ReportePagosResponse
from security.jwt import verify_token
from utils.audit_logger import registrar_auditoria

router = APIRouter(prefix="/reportes", tags=["reportes"])

# ============================================================================
# DEPENDENCIAS
# ============================================================================

def get_db():
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
    from models.role import RolAccion

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

# ============================================================================
# UTILIDADES DE EXPORTACIÓN
# ============================================================================

def export_to_csv(data: List[dict], filename: str) -> StreamingResponse:
    """Exporta datos a CSV"""
    if not data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No hay datos para exportar"
        )
    
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=data[0].keys())
    writer.writeheader()
    writer.writerows(data)
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}.csv"
        }
    )

# ============================================================================
# 1. REPORTE DE USUARIOS
# ============================================================================

@router.get("/usuarios")
def get_reporte_usuarios(
    skip: int = 0,
    limit: int = 1000,
    search: Optional[str] = None,
    rol: Optional[str] = None,
    activo: Optional[bool] = None,
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "reportes", "lectura")

    query = (
        db.query(
            UsuarioSistema.usuario,
            UsuarioSistema.nombres,
            UsuarioSistema.apellidos,
            UsuarioSistema.cedula,
            UsuarioSistema.email,
            UsuarioSistema.telefono,
            UsuarioSistema.direccion,
            UsuarioSistema.sexo,
            UsuarioSistema.activo,
            UsuarioSistema.fecha_registro,
            UsuarioSistema.ultimo_acceso,
            Rol.nombre_rol.label("rol")
        )
        .outerjoin(Rol, UsuarioSistema.id_rol == Rol.id_rol)
    )

    filtros = []

    if search:
        like = f"%{search}%"
        filtros.append(or_(
            UsuarioSistema.nombres.ilike(like),
            UsuarioSistema.apellidos.ilike(like),
            UsuarioSistema.usuario.ilike(like),
            UsuarioSistema.cedula.ilike(like)
        ))

    if rol and rol != "all":
        filtros.append(UsuarioSistema.id_rol == rol)

    if activo is not None:
        filtros.append(UsuarioSistema.activo == activo)

    if filtros:
        query = query.filter(*filtros)

    usuarios = (
        query
        .order_by(UsuarioSistema.fecha_registro.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return [
        {
            "usuario": u.usuario,
            "nombres": u.nombres,
            "apellidos": u.apellidos,
            "cedula": u.cedula,
            "email": u.email,
            "telefono": u.telefono,
            "direccion": u.direccion,
            "sexo": (
                "Masculino" if u.sexo == "M"
                else "Femenino" if u.sexo == "F"
                else "Otro"
            ),
            "rol": u.rol,
            "fecha_registro": (
                u.fecha_registro.strftime("%d/%m/%Y")
                if u.fecha_registro else None
            ),
            "ultimo_acceso": (
                u.ultimo_acceso.strftime("%d/%m/%Y")
                if u.ultimo_acceso else None
            ),
            "activo": u.activo
        }
        for u in usuarios
    ]


# ============================================================================
# 2. REPORTE DE ROLES
# ============================================================================

from sqlalchemy import func

@router.get("/roles")
def get_reporte_roles(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    activo: Optional[bool] = None,
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """📊 Reporte de roles y módulos (solo nombre del módulo)"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "reportes", "lectura")

    # --------- BASE QUERY ROLES ----------
    query = db.query(Rol)

    if search:
        query = query.filter(Rol.nombre_rol.ilike(f"%{search}%"))

    if activo is not None:
        query = query.filter(Rol.activo == activo)

    roles = query.offset(skip).limit(limit).all()

    if not roles:
        return []

    ids_roles = [r.id_rol for r in roles]

    # --------- TOTAL USUARIOS POR ROL ----------
    from models.user import UsuarioSistema
    usuarios_por_rol = {
        id_rol: total
        for id_rol, total in db.query(
            UsuarioSistema.id_rol,
            func.count(UsuarioSistema.id_usuario_sistema)
        )
        .filter(UsuarioSistema.id_rol.in_(ids_roles))
        .group_by(UsuarioSistema.id_rol)
        .all()
    }

    # --------- ACCIONES POR ROL (AGRUPADAS POR MÓDULO) ----------
    acciones_raw = db.query(
        RolAccion.id_rol,
        RolAccion.nombre_accion,
        RolAccion.tipo_accion,
        RolAccion.activo
    ).filter(
        RolAccion.id_rol.in_(ids_roles),
        RolAccion.activo == True
    ).all()

    modulos_por_rol = {}
    for id_rol, nombre_accion, _, _ in acciones_raw:
        partes = nombre_accion.split(".", 1)
        modulo = partes[0] if len(partes) > 1 else nombre_accion

        if id_rol not in modulos_por_rol:
            modulos_por_rol[id_rol] = set()

        modulos_por_rol[id_rol].add(modulo)

    # --------- ARMAR RESPUESTA CON SOLO NOMBRE DE MÓDULOS ---------
    resultado = []
    for r in roles:
        modulos = list(modulos_por_rol.get(r.id_rol, set()))
        resultado.append({
            "nombre_rol": r.nombre_rol,
            "descripcion": r.descripcion,
            "Num_usuarios": usuarios_por_rol.get(r.id_rol, 0),
            "Num_modulos": len(modulos),
            "modulos": modulos,  # Solo lista de nombres de módulos
            "activo": r.activo,

        })

    return resultado

# ============================================================================
# 3. REPORTE DE AFILIADOS
# ============================================================================

@router.get("/afiliados")
def get_reporte_afiliados(
    skip: int = 0,
    limit: int = 1000,
    search: Optional[str] = None,
    sector: Optional[str] = None,
    estado: Optional[str] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """📊 Reporte completo de afiliados"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "reportes", "lectura")

    # Subconsulta: cantidad de medidores
    total_medidores_sq = (
        db.query(func.count(Medidor.id_medidor))
        .filter(Medidor.id_usuario_afi == UsuarioAfiliado.id_usuario_afi)
        .correlate(UsuarioAfiliado)
        .scalar_subquery()
        .label("total_medidores")
    )

    # Subconsulta: todos los números de medidor concatenados con " - "
    medidores_sq = (
        db.query(func.string_agg(Medidor.num_medidor, ' - '))
        .filter(Medidor.id_usuario_afi == UsuarioAfiliado.id_usuario_afi)
        .correlate(UsuarioAfiliado)
        .scalar_subquery()
        .label("medidores")
    )

    query = (
        db.query(
            UsuarioAfiliado.cod_usuario_afi,
            UsuarioAfiliado.fecha_afiliacion,
            UsuarioAfiliado.activo,

            UsuarioSistema.nombres,
            UsuarioSistema.apellidos,
            UsuarioSistema.cedula,

            Sector.nombre_sector,

            # ✅ Cantidad de medidores
            total_medidores_sq,

            # ✅ Todos los números separados por " - "
            medidores_sq,
        )
        .outerjoin(
            UsuarioSistema,
            UsuarioSistema.id_usuario_sistema == UsuarioAfiliado.id_usuario_sistema
        )
        .outerjoin(
            Sector,
            Sector.id_sector == UsuarioAfiliado.id_sector
        )
    )

    # Filtro de búsqueda
    if search:
        like = f"%{search}%"
        query = query.filter(
            or_(
                UsuarioSistema.nombres.ilike(like),
                UsuarioSistema.apellidos.ilike(like),
                cast(UsuarioSistema.cedula, String).ilike(like),
                cast(UsuarioAfiliado.cod_usuario_afi, String).ilike(like)
            )
        )

    # ✅ FIX: filtrar por nombre del sector, no por id_sector
    if sector:
        query = query.filter(Sector.nombre_sector == sector)

    # Filtro de estado
    if estado == "activos":
        query = query.filter(UsuarioAfiliado.activo == True)
    elif estado == "inactivos":
        query = query.filter(UsuarioAfiliado.activo == False)

    # Filtro de rango de fechas
    if fecha_desde:
        query = query.filter(UsuarioAfiliado.fecha_afiliacion >= fecha_desde)
    if fecha_hasta:
        query = query.filter(UsuarioAfiliado.fecha_afiliacion <= fecha_hasta)

    query = query.order_by(
        UsuarioAfiliado.cod_usuario_afi.asc(),
        UsuarioSistema.apellidos.asc()
    )

    results = query.offset(skip).limit(limit).all()

    return [
        {
            "cod_usuario_afi": row.cod_usuario_afi,
            "nombres": row.nombres,
            "apellidos": row.apellidos,
            "cedula": row.cedula,
            "sector": row.nombre_sector,
            "fecha_afiliacion": row.fecha_afiliacion.isoformat() if row.fecha_afiliacion else None,
            "activo": row.activo,
            "n*_medidores": row.total_medidores or 0,
            "medidores": row.medidores or "Sin medidor",
        }
        for row in results
    ]

# ============================================================================
# 4. REPORTE DE MEDIDORES
# ============================================================================
@router.get("/medidores")
def get_reporte_medidores(
    skip: int = 0,
    limit: int = 1000,
    search: Optional[str] = None,
    estado: Optional[str] = None,
    sector: Optional[str] = None,  # ✅ NUEVO: Filtro por sector
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """📊 Reporte de medidores instalados"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "reportes", "lectura")
    
    # Query optimizado seleccionando solo columnas necesarias
    query = (
        db.query(
            Medidor.num_medidor,
            Medidor.latitud,
            Medidor.longitud,
            Medidor.altitud,
            Medidor.activo,
            
            Sector.nombre_sector,
            
            UsuarioAfiliado.cod_usuario_afi,
            UsuarioSistema.cedula,
            
            func.concat(
                UsuarioSistema.nombres,
                ' ',
                UsuarioSistema.apellidos
            ).label("nombre_afiliado")
        )
        .outerjoin(Sector, Sector.id_sector == Medidor.id_sector)
        .outerjoin(
            UsuarioAfiliado,
            UsuarioAfiliado.id_usuario_afi == Medidor.id_usuario_afi
        )
        .outerjoin(
            UsuarioSistema,
            UsuarioSistema.id_usuario_sistema == UsuarioAfiliado.id_usuario_sistema
        )
    )
    
    # Filtro de búsqueda
    if search:
        like = f"%{search}%"
        query = query.filter(
            or_(
                Medidor.num_medidor.ilike(like),
                cast(UsuarioAfiliado.cod_usuario_afi, String).ilike(like),
                UsuarioSistema.nombres.ilike(like),
                UsuarioSistema.apellidos.ilike(like),
                UsuarioSistema.cedula.ilike(like),
            )
        )
    
    # ✅ Filtro de estado (activo/inactivo)
    if estado == "activos":
        query = query.filter(Medidor.activo == True)
    elif estado == "inactivos":
        query = query.filter(Medidor.activo == False)
    
    # ✅ NUEVO: Filtro por sector
    if sector:
        query = query.filter(Sector.nombre_sector == sector)
    
    # ✅ Ordenamiento: cod_usuario_afi ascendente, NULL al final
    query = query.order_by(
        UsuarioAfiliado.cod_usuario_afi.asc().nullslast(),
        Medidor.num_medidor.asc()
    )

    results = query.offset(skip).limit(limit).all()

    return [
        {
            "num_medidor": row.num_medidor,
            "cod_usuario_afi": row.cod_usuario_afi,
            "nombre_afiliado": row.nombre_afiliado,
            "sector": row.nombre_sector,
            "latitud": float(row.latitud) if row.latitud is not None else None,
            "longitud": float(row.longitud) if row.longitud is not None else None,
            "altitud": float(row.altitud) if row.altitud is not None else None,
            "activo": row.activo,
        }
        for row in results
    ]


# ============================================================================
# 5. REPORTE DE SECTORES
# ============================================================================

@router.get("/sectores")
def get_reporte_sectores(
    skip: int = 0,
    limit: int = 1000,
    search: Optional[str] = None,
    activo: Optional[bool] = None,
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """📊 Reporte de sectores geográficos"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "reportes", "lectura")
    
    # Query base
    query = db.query(Sector)
    
    if search:
        query = query.filter(Sector.nombre_sector.ilike(f"%{search}%"))
    
    if activo is not None:
        query = query.filter(Sector.activo == activo)
    
    sectores = query.offset(skip).limit(limit).all()
    
    if not sectores:
        return []
    
    # IDs de sectores para consultas agregadas
    ids_sectores = [s.id_sector for s in sectores]
    
    # Contar afiliados por sector en una sola query
    afiliados_por_sector = dict(
        db.query(
            UsuarioAfiliado.id_sector,
            func.count(UsuarioAfiliado.id_usuario_afi)
        )
        .filter(UsuarioAfiliado.id_sector.in_(ids_sectores))
        .group_by(UsuarioAfiliado.id_sector)
        .all()
    )
    
    # Contar medidores por sector en una sola query
    medidores_por_sector = dict(
        db.query(
            Medidor.id_sector,
            func.count(Medidor.id_medidor)
        )
        .filter(Medidor.id_sector.in_(ids_sectores))
        .group_by(Medidor.id_sector)
        .all()
    )
    
    # Construir respuesta
    return [
        {
            "nombre_sector": s.nombre_sector,
            "descripcion": s.descripcion,
            "Num_afiliados": afiliados_por_sector.get(s.id_sector, 0),
            "Num_medidores": medidores_por_sector.get(s.id_sector, 0),
            "activo": s.activo
        }
        for s in sectores
    ]


# ============================================================================
# 6. REPORTE DE LECTURAS
# ============================================================================
@router.get("/lecturas")
def get_reporte_lecturas(
    skip: int = 0,
    limit: int = 1000,
    search: Optional[str] = None,
    mes: Optional[int] = None,
    anio: Optional[int] = None,
    activo: Optional[bool] = None,
    es_estimada: Optional[bool] = None,
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """📊 Reporte completo de lecturas con información de afiliado y medidor"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "reportes", "lectura")
    
    # Query optimizado con joins y joinedload
    query = db.query(Lectura).options(
        joinedload(Lectura.medidor).joinedload(Medidor.usuario_afiliado).joinedload(UsuarioAfiliado.usuario_sistema),
        joinedload(Lectura.medidor).joinedload(Medidor.sector),
        joinedload(Lectura.lector)
    )
    
    # ============================================================
    # FILTRO DE BÚSQUEDA - CORREGIDO
    # ============================================================
    if search:
        search_pattern = f"%{search}%"
        query = query.join(Lectura.medidor).outerjoin(Medidor.usuario_afiliado).outerjoin(UsuarioAfiliado.usuario_sistema).filter(
            or_(
                UsuarioSistema.nombres.ilike(search_pattern),
                UsuarioSistema.apellidos.ilike(search_pattern),
                Medidor.num_medidor.ilike(search_pattern),
                cast(UsuarioAfiliado.cod_usuario_afi, String).ilike(search_pattern)
            )
        )
    
    # Filtro por mes y año
    if mes and anio:
        query = query.filter(
            extract('month', Lectura.fecha_lectura) == mes,
            extract('year', Lectura.fecha_lectura) == anio
        )
    elif anio:
        query = query.filter(extract('year', Lectura.fecha_lectura) == anio)
    
    # Filtro por estado activo
    if activo is not None:
        query = query.filter(Lectura.activo == activo)
    
    # Filtro por tipo de lectura
    if es_estimada is not None:
        query = query.filter(Lectura.es_estimada == es_estimada)
    
    query = query.order_by(Lectura.fecha_lectura.desc())
    lecturas = query.offset(skip).limit(limit).all()
    
    return [
        {
            "cod_usuario_afi": l.medidor.usuario_afiliado.cod_usuario_afi if l.medidor and l.medidor.usuario_afiliado else None,
            "nombres": f"{l.medidor.usuario_afiliado.usuario_sistema.nombres} {l.medidor.usuario_afiliado.usuario_sistema.apellidos}" if l.medidor and l.medidor.usuario_afiliado and l.medidor.usuario_afiliado.usuario_sistema else "Sin afiliado",
            "num_medidor": l.medidor.num_medidor if l.medidor else None,
            "sector": l.medidor.sector.nombre_sector if l.medidor and l.medidor.sector else "Sin sector",
            "lectura_anterior": l.lectura_anterior,
            "lectura_actual": l.lectura_actual,
            "consumo_m3": l.consumo_m3,
            "fecha_lectura": l.fecha_lectura.strftime('%d/%m/%Y') if l.fecha_lectura else None,
            "tipo_lectura": "Estimada" if l.es_estimada else "Real",
            "lector": f"{l.lector.nombres} {l.lector.apellidos}" if l.lector else "Sin lector",
            "observacion": l.observacion,
            "activo": l.activo
        }
        for l in lecturas
    ]


# ============================================================================
# 6.1. OBTENER PERIODOS DISPONIBLES LECTURAS (MES/AÑO)
# ============================================================================
@router.get("/lecturas/periodos")
def get_periodos_lecturas(
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """📅 Obtiene los periodos (mes/año) disponibles de lecturas"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "reportes", "lectura")
    
    # Consulta optimizada para obtener periodos únicos
    periodos = db.query(
        extract('year', Lectura.fecha_lectura).label('anio'),
        extract('month', Lectura.fecha_lectura).label('mes')
    ).filter(
        Lectura.fecha_lectura.isnot(None)  # ← Filtra nulls
    ).distinct().order_by(
        desc(extract('year', Lectura.fecha_lectura)),  # ← Corregido
        desc(extract('month', Lectura.fecha_lectura))  # ← Corregido
    ).all()
    
    meses_nombres = {
        1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
        5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
        9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre'
    }
    
    return [
        {
            "anio": int(p.anio),
            "mes": int(p.mes),
            "mes_nombre": meses_nombres.get(int(p.mes), 'Desconocido'),
            "periodo": f"{meses_nombres.get(int(p.mes), 'Mes')} {int(p.anio)}"
        }
        for p in periodos if p.anio and p.mes
    ]


# ============================================================================
# 7. REPORTE DE FACTURAS
# ============================================================================
@router.get("/facturas")
def get_reporte_facturas(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = Query(None),
    mes: Optional[int] = Query(None, ge=1, le=12),
    anio: Optional[int] = Query(None, ge=2020),
    periodo: Optional[str] = Query(None),
    estado: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "reportes", "lectura")

    try:
        import math
        from sqlalchemy import cast, String, func as sql_func
        from models.mora import MoraFactura

        # SUBQUERY: SUMA DE MORAS POR FACTURA
        mora_subquery = (
            db.query(
                MoraFactura.id_factura,
                sql_func.sum(MoraFactura.monto_mora).label('total_mora'),
                sql_func.max(MoraFactura.dias_mora).label('max_dias_mora'),
                sql_func.count(MoraFactura.id_mora).label('cantidad_moras')
            )
            .filter(MoraFactura.aplicada == True)
            .group_by(MoraFactura.id_factura)
            .subquery()
        )

        # ✅ QUERY CORREGIDO — join por Lectura → Medidor (igual que listar_facturas)
        query = (
            db.query(
                Medidor.num_medidor,                    # ← viene de Medidor directamente
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
                UsuarioAfiliado.cod_usuario_afi,
                UsuarioSistema.nombres,
                UsuarioSistema.apellidos,
                UsuarioSistema.cedula,
                UsuarioSistema.direccion,
                UsuarioSistema.telefono,
                UsuarioSistema.email,
                Sector.nombre_sector,
                mora_subquery.c.total_mora,
                mora_subquery.c.max_dias_mora,
                mora_subquery.c.cantidad_moras
            )
            # ✅ Cadena correcta: Factura → Lectura → Medidor → Afiliado → Usuario → Sector
            .join(Lectura, Factura.id_lectura == Lectura.id_lectura)
            .join(Medidor, Lectura.id_medidor == Medidor.id_medidor)
            .join(UsuarioAfiliado, Medidor.id_usuario_afi == UsuarioAfiliado.id_usuario_afi)
            .join(UsuarioSistema, UsuarioAfiliado.id_usuario_sistema == UsuarioSistema.id_usuario_sistema)
            .outerjoin(Sector, UsuarioAfiliado.id_sector == Sector.id_sector)
            .outerjoin(mora_subquery, Factura.id_factura == mora_subquery.c.id_factura)
        )

        # FILTROS
        if mes and anio:
            query = query.filter(Factura.periodo == f"{anio}-{mes:02d}")
        elif periodo:
            query = query.filter(Factura.periodo == periodo)

        if search:
            search_pattern = f"%{search}%"
            query = query.filter(
                or_(
                    UsuarioSistema.nombres.ilike(search_pattern),
                    UsuarioSistema.apellidos.ilike(search_pattern),
                    UsuarioSistema.cedula.ilike(search_pattern),
                    cast(UsuarioAfiliado.cod_usuario_afi, String).ilike(search_pattern),
                    Medidor.num_medidor.ilike(search_pattern),   # ← Medidor, no UsuarioAfiliado
                    Factura.num_factura.ilike(search_pattern)
                )
            )

        if estado and estado.lower() != 'todos':
            query = query.filter(Factura.estado_factura == estado.lower())

        query = query.order_by(Factura.fecha_emision.desc(), Factura.num_factura.desc())

        total_count = query.count()
        facturas = query.offset(skip).limit(limit).all()

        if not facturas:
            return {
                "success": True, "data": [], "total": 0,
                "skip": skip, "limit": limit, "pages": 0,
                "estadisticas": {
                    "total_facturas": 0, "total_facturado": 0.0,
                    "total_pagado": 0.0, "total_pendiente": 0.0,
                    "total_vencido": 0.0, "facturas_con_mora": 0, "total_mora": 0.0
                }
            }

        # DETALLES DE FACTURAS
        ids_facturas = [f.id_factura for f in facturas]
        detalles_query = (
            db.query(
                DetalleFactura.id_factura,
                DetalleFactura.tipo_detalle,
                DetalleFactura.descripcion,
                DetalleFactura.subtotal_detalle
            )
            .filter(DetalleFactura.id_factura.in_(ids_facturas))
            .order_by(
                DetalleFactura.id_factura,
                case(
                    (DetalleFactura.tipo_detalle == 'consumo', 1),
                    (DetalleFactura.tipo_detalle == 'servicio', 2),
                    (DetalleFactura.tipo_detalle == 'multa', 3),
                    else_=4
                )
            ).all()
        )

        detalles_por_factura = {}
        for d in detalles_query:
            if d.id_factura not in detalles_por_factura:
                detalles_por_factura[d.id_factura] = []
            detalles_por_factura[d.id_factura].append({
                "tipo": d.tipo_detalle,
                "descripcion": d.descripcion or "Sin descripción",
                "monto": float(d.subtotal_detalle) if d.subtotal_detalle else 0.0
            })

        # FORMATEAR + ESTADÍSTICAS
        facturas_formateadas = []
        total_facturado = total_pagado = total_pendiente = total_vencido = 0.0
        facturas_con_mora = 0
        total_mora_acumulado = 0.0

        for f in facturas:
            detalles = detalles_por_factura.get(f.id_factura, [])
            conceptos_texto = " | ".join([
                f"{d['tipo'].upper()} (${d['monto']:.2f})" for d in detalles
            ]) if detalles else "Sin conceptos"

            nombre_completo = f"{f.nombres} {f.apellidos}".strip()
            total_factura = float(f.total) if f.total else 0.0
            total_facturado += total_factura

            if f.estado_factura == 'pagada':     total_pagado    += total_factura
            elif f.estado_factura == 'pendiente': total_pendiente += total_factura
            elif f.estado_factura == 'vencida':   total_vencido   += total_factura

            valor_mora = float(f.total_mora) if f.total_mora else 0.0
            dias_mora  = int(f.max_dias_mora) if f.max_dias_mora else 0
            tiene_mora = valor_mora > 0
            meses_adeudo   = math.ceil(dias_mora / 30) if dias_mora > 0 else 0
            total_con_mora = total_factura + valor_mora

            if tiene_mora:
                facturas_con_mora     += 1
                total_mora_acumulado  += valor_mora

            facturas_formateadas.append({
                "num_factura":           f.num_factura,
                "cod_usuario_afi":       f.cod_usuario_afi,
                "num_medidor":           f.num_medidor or "N/A",  # ← ahora sí existe
                "cedula":                f.cedula,
                "Nombres":               nombre_completo,
                "direccion":             f.direccion,
                "telefono":              f.telefono,
                "email":                 f.email,
                "sector":                f.nombre_sector or "Sin sector",
                "consumo_m3":            f.consumo_m3 or 0,
                "exceso_m3":             f.exceso_m3 or 0,
                "valor_consumo":         float(f.valor_consumo)  if f.valor_consumo  else 0.0,
                "valor_exceso":          float(f.valor_exceso)   if f.valor_exceso   else 0.0,
                "descuento":             float(f.descuento)       if f.descuento      else 0.0,
                "subtotal":              float(f.subtotal)        if f.subtotal       else 0.0,
                "impuesto":              float(f.impuesto)        if f.impuesto       else 0.0,
                "total_factura":         total_factura,
                "tiene_mora":            tiene_mora,
                "meses_adeudo":          meses_adeudo,
                "valor_mora":            valor_mora,
                "total_con_mora":        total_con_mora,
                "fecha_emision":         f.fecha_emision.strftime("%d/%m/%Y") if f.fecha_emision else None,
                "estado":                f.estado_factura,
                "conceptos_facturacion": conceptos_texto
            })

        return {
            "success": True,
            "data": facturas_formateadas,
            "total": total_count,
            "skip": skip, "limit": limit,
            "pages": (total_count + limit - 1) // limit,
            "estadisticas": {
                "total_facturas":    len(facturas_formateadas),
                "total_facturado":   round(total_facturado, 2),
                "total_pagado":      round(total_pagado, 2),
                "total_pendiente":   round(total_pendiente, 2),
                "total_vencido":     round(total_vencido, 2),
                "facturas_con_mora": facturas_con_mora,
                "total_mora":        round(total_mora_acumulado, 2)
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error al generar reporte de facturas: {str(e)}")


# ============================================================================
# 7.1 PERIODOS DISPONIBLES POR FACTURA 
# ============================================================================
@router.get("/facturas/periodos")
def get_periodos_facturas(
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """📅 Obtiene los periodos disponibles desde t_factura.periodo"""
    
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "reportes", "lectura")

    # 🔥 Consulta MUY ligera (solo una columna)
    periodos = (
        db.query(Factura.periodo)
        .filter(Factura.periodo.isnot(None))
        .distinct()
        .order_by(desc(Factura.periodo))
        .all()
    )

    meses_nombres = {
        1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
        5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
        9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre'
    }

    resultado = []

    for (periodo,) in periodos:
        try:
            anio, mes = periodo.split("-")
            mes = int(mes)

            resultado.append({
                "anio": int(anio),
                "mes": mes,
                "mes_nombre": meses_nombres.get(mes, "Desconocido"),
                #"periodo": periodo,
                "periodo": f"{meses_nombres.get(mes, 'Mes')} {anio}"
            })
        except Exception:
            continue  # evita periodos mal formados

    return resultado

#===========================================================================
# 8. REPORTE DE PAGOS
# ===========================================================================

@router.get("/pagos")
def get_reporte_pagos(
    periodo: Optional[str] = Query(None, description="Formato: YYYY-MM"),
    mes: Optional[int] = Query(None, ge=1, le=12),
    anio: Optional[int] = Query(None, ge=2020),
    metodo_pago: Optional[str] = Query(None),
    estado_pago: Optional[str] = Query(None),
    pago_completo: Optional[bool] = Query(None),
    search: Optional[str] = Query(None, description="Buscar por nombre, cédula, cod_afiliado, medidor"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    📊 REPORTE DE PAGOS CON INFORMACIÓN DE MORA
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "pagos", "lectura")
    
    try:
        import math
        from datetime import datetime
        from sqlalchemy import cast, String, func as sql_func
        from models.mora import MoraFactura
        
        Cajero = aliased(UsuarioSistema)
        
        # SUBQUERY: SUMA DE MORAS POR FACTURA
        mora_subquery = (
            db.query(
                MoraFactura.id_factura,
                sql_func.sum(MoraFactura.monto_mora).label('total_mora'),
                sql_func.max(MoraFactura.dias_mora).label('max_dias_mora'),
                sql_func.count(MoraFactura.id_mora).label('cantidad_moras')
            )
            .filter(MoraFactura.aplicada == True)
            .group_by(MoraFactura.id_factura)
            .subquery()
        )
        
        # QUERY PRINCIPAL
        query = (
            db.query(
                UsuarioSistema.cedula,
                UsuarioSistema.nombres,
                UsuarioSistema.apellidos,
                UsuarioSistema.direccion,
                UsuarioSistema.telefono,
                UsuarioSistema.email,
                UsuarioAfiliado.cod_usuario_afi,
                Medidor.num_medidor,                   # ← viene de Medidor, no de UsuarioAfiliado
                Sector.nombre_sector,
                Factura.id_factura,
                Factura.num_factura,
                Factura.periodo,
                Factura.fecha_emision,
                Factura.consumo_m3,
                Factura.exceso_m3,
                Factura.subtotal,
                Factura.descuento,
                Factura.impuesto,
                Factura.total,
                Factura.estado_factura,
                Pago.id_pago,
                Pago.monto_pago,
                Pago.fecha_pago,
                Pago.metodo_pago,
                Pago.estado_pago,
                Pago.observaciones,
                Cajero.nombres.label('cajero_nombres'),
                Cajero.apellidos.label('cajero_apellidos'),
                Pago.nombre_archivo,
                case(
                    (Pago.comprobante_pdf.isnot(None), True),
                    else_=False
                ).label('tiene_comprobante'),
                mora_subquery.c.total_mora,
                mora_subquery.c.max_dias_mora,
                mora_subquery.c.cantidad_moras
            )
            # ✅ Cadena correcta: Pago → Factura → Lectura → Medidor → Afiliado → Usuario
            .join(Factura,        Pago.id_factura         == Factura.id_factura)
            .join(Lectura,        Factura.id_lectura       == Lectura.id_lectura)
            .join(Medidor,        Lectura.id_medidor       == Medidor.id_medidor)
            .join(UsuarioAfiliado, Medidor.id_usuario_afi  == UsuarioAfiliado.id_usuario_afi)
            .join(UsuarioSistema,  UsuarioAfiliado.id_usuario_sistema == UsuarioSistema.id_usuario_sistema)
            .outerjoin(Sector,   UsuarioAfiliado.id_sector == Sector.id_sector)
            .outerjoin(Cajero,   Pago.id_cajero            == Cajero.id_usuario_sistema)
            .outerjoin(mora_subquery, Factura.id_factura   == mora_subquery.c.id_factura)
        )
        
        # FILTROS
        if periodo:
            query = query.filter(Factura.periodo == periodo)
        
        # ✅ AGREGAR ESTO — igual que en get_reporte_facturas
        if mes and anio:
            query = query.filter(Factura.periodo == f"{anio}-{mes:02d}")
            
        if metodo_pago:
            query = query.filter(Pago.metodo_pago.ilike(f"%{metodo_pago}%"))
        
        if estado_pago:
            estado_upper = estado_pago.upper()
            if estado_upper != 'TODOS':
                query = query.filter(Pago.estado_pago == estado_upper)
        
        if pago_completo is not None:
            if pago_completo:
                query = query.filter(Pago.monto_pago >= Factura.total)
            else:
                query = query.filter(Pago.monto_pago < Factura.total)
        
        if search:
            search_pattern = f"%{search}%"
            query = query.filter(
                or_(
                    UsuarioSistema.nombres.ilike(search_pattern),
                    UsuarioSistema.apellidos.ilike(search_pattern),
                    UsuarioSistema.cedula.ilike(search_pattern),
                    cast(UsuarioAfiliado.cod_usuario_afi, String).ilike(search_pattern),
                    Medidor.num_medidor.ilike(search_pattern),
                    Factura.num_factura.ilike(search_pattern)
                )
            )
        
        total_registros = query.count()
        
        pagos = (
            query
            .order_by(Pago.fecha_pago.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
        
        if not pagos:
            return {
                "success": True,
                "data": [],
                "total": 0,
                "skip": skip,
                "limit": limit,
                "pages": 0,
                "estadisticas": {
                    "total_pagos": 0,
                    "total_facturado": 0.0,
                    "total_pagado": 0.0,
                    "facturas_con_mora": 0,
                    "total_mora": 0.0
                }
            }
        
        # Obtener detalles de facturas
        ids_facturas = list(set([p.id_factura for p in pagos]))
        
        detalles_query = (
            db.query(
                DetalleFactura.id_factura,
                DetalleFactura.tipo_detalle,
                DetalleFactura.descripcion,
                DetalleFactura.subtotal_detalle
            )
            .filter(DetalleFactura.id_factura.in_(ids_facturas))
            .order_by(
                DetalleFactura.id_factura,
                case(
                    (DetalleFactura.tipo_detalle == 'consumo', 1),
                    (DetalleFactura.tipo_detalle == 'servicio', 2),
                    (DetalleFactura.tipo_detalle == 'multa', 3),
                    else_=4
                )
            )
            .all()
        )
        
        detalles_por_factura = {}
        for d in detalles_query:
            if d.id_factura not in detalles_por_factura:
                detalles_por_factura[d.id_factura] = []
            detalles_por_factura[d.id_factura].append({
                "tipo": d.tipo_detalle,
                "descripcion": d.descripcion or "Sin descripción",
                "monto": float(d.subtotal_detalle) if d.subtotal_detalle else 0.0
            })
        
        # ========================================
        # 📋 FORMATEAR RESPUESTA + CALCULAR ESTADÍSTICAS
        # ========================================
        resultado = []
        
        # ✅ VARIABLES PARA ESTADÍSTICAS
        total_facturado = 0.0
        total_pagado = 0.0
        facturas_con_mora = 0
        total_mora_acumulado = 0.0
        
        for p in pagos:
            detalles = detalles_por_factura.get(p.id_factura, [])
            conceptos_texto = " | ".join([
                f"{d['tipo'].upper()} (${d['monto']:.2f})"
                for d in detalles
            ]) if detalles else "Sin conceptos"

            nombre_completo = f"{p.nombres} {p.apellidos}".strip()
            
            cajero_nombre = None
            if p.cajero_nombres and p.cajero_apellidos:
                cajero_nombre = f"{p.cajero_nombres} {p.cajero_apellidos}"
            elif p.cajero_nombres:
                cajero_nombre = p.cajero_nombres
            elif p.cajero_apellidos:
                cajero_nombre = p.cajero_apellidos
            
            # CALCULAR DATOS DE MORA
            total_factura = float(p.total)
            valor_mora = float(p.total_mora) if p.total_mora else 0.0
            dias_mora = int(p.max_dias_mora) if p.max_dias_mora else 0
            tiene_mora = valor_mora > 0
            
            meses_adeudo = math.ceil(dias_mora / 30) if dias_mora > 0 else 0
            total_con_mora = total_factura + valor_mora
            
            # ✅ ACUMULAR ESTADÍSTICAS
            total_facturado += total_factura
            total_pagado += float(p.monto_pago)
            if tiene_mora:
                facturas_con_mora += 1
                total_mora_acumulado += valor_mora
            
            resultado.append({
                "cod_afiliado": p.cod_usuario_afi,
                "num_medidor": p.num_medidor or "N/A",
                "cedula": p.cedula,
                "Nombre": nombre_completo,
                "direccion": p.direccion,
                "telefono": p.telefono,
                "email": p.email,
                "num_factura": p.num_factura,
                "fecha_emision": p.fecha_emision.strftime("%d/%m/%Y") if p.fecha_emision else None,
                "total_factura": total_factura,
                "tiene_mora": tiene_mora,
                "meses_adeudo": meses_adeudo,
                "valor_mora": valor_mora,
                "total_con_mora": total_con_mora,
                "monto_pagado": float(p.monto_pago),
                "fecha_pago": p.fecha_pago.strftime("%d/%m/%Y") if p.fecha_pago else None,
                "metodo_pago": p.metodo_pago or "No especificado",
                "estado_factura": p.estado_factura,
                "estado_pago": p.estado_pago,
                "observaciones": p.observaciones,
                "conceptos_facturacion": conceptos_texto,
                "descuento": float(p.descuento) if p.descuento else 0.0,
                "impuesto": float(p.impuesto) if p.impuesto else 0.0,
                "tiene_comprobante": p.tiene_comprobante,
                "cajero": cajero_nombre or "Sin cajero",
                "saldo": total_con_mora - float(p.monto_pago),
                "pago_completo": float(p.monto_pago) >= total_con_mora
            })
        
        print(f"✅ Reporte generado: {len(resultado)} de {total_registros} pagos")
        print(f"📊 Estadísticas: {facturas_con_mora} facturas con mora, total mora: ${total_mora_acumulado:.2f}")
        
        # ✅ RESPUESTA CON ESTADÍSTICAS DE MORA
        return {
            "success": True,
            "data": resultado,
            "total": total_registros,
            "skip": skip,
            "limit": limit,
            "pages": (total_registros + limit - 1) // limit,
            "estadisticas": {
                "total_pagos": len(resultado),
                "total_facturado": round(total_facturado, 2),
                "total_pagado": round(total_pagado, 2),
                "facturas_con_mora": facturas_con_mora,
                "total_mora": round(total_mora_acumulado, 2)
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Error al generar reporte de pagos: {str(e)}"
        )



# ============================================================================
# 8.1 ESTADÍSTICAS DE PAGOS 
# ============================================================================
@router.get("/pagos/estadisticas")
def get_estadisticas_pagos(
    mes: Optional[int] = None,
    anio: Optional[int] = None,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """📊 Estadísticas globales de pagos (con caché)"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "reportes", "lectura")
    
    # ============================================================
    # USAR AGGREGATE QUERIES - MÁS RÁPIDO QUE COUNT
    # ============================================================
    query = db.query(
        func.count(Pago.id_pago).label('total_pagos'),
        func.sum(Pago.monto_pago).label('total_recaudado'),
        Pago.metodo_pago,
        Pago.estado_pago
    ).filter(Pago.activo == True)
    
    # Aplicar filtros
    if mes and anio:
        fecha_inicio = date(anio, mes, 1)
        if mes == 12:
            fecha_fin = date(anio + 1, 1, 1)
        else:
            fecha_fin = date(anio, mes + 1, 1)
        query = query.filter(
            and_(
                Pago.fecha_pago >= fecha_inicio,
                Pago.fecha_pago < fecha_fin
            )
        )
    
    # Agrupar
    resultados = query.group_by(
        Pago.metodo_pago, 
        Pago.estado_pago
    ).all()
    
    # Formatear
    total_general = sum(r.total_recaudado or 0 for r in resultados)
    count_general = sum(r.total_pagos for r in resultados)
    
    por_metodo = {}
    por_estado = {}
    
    for r in resultados:
        # Por método
        if r.metodo_pago not in por_metodo:
            por_metodo[r.metodo_pago] = {'cantidad': 0, 'monto': 0}
        por_metodo[r.metodo_pago]['cantidad'] += r.total_pagos
        por_metodo[r.metodo_pago]['monto'] += float(r.total_recaudado or 0)
        
        # Por estado
        if r.estado_pago not in por_estado:
            por_estado[r.estado_pago] = {'cantidad': 0, 'monto': 0}
        por_estado[r.estado_pago]['cantidad'] += r.total_pagos
        por_estado[r.estado_pago]['monto'] += float(r.total_recaudado or 0)
    
    return {
        "success": True,
        "estadisticas_globales": {
            "total_pagos": count_general,
            "total_recaudado": round(float(total_general), 2),
            "por_metodo_pago": por_metodo,
            "por_estado": por_estado
        }
    }

# ============================================================================
# 8.2. OBTENER PERIODOS DISPONIBLES (MES/AÑO) DE PAGOS
# ============================================================================
@router.get("/pagos/periodos")
def get_periodos_pagos(
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """📅 Periodos disponibles para reporte de pagos (misma lógica que módulo pagos)"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "reportes", "lectura")

    hoy = date.today()
    mes_actual = hoy.month
    anio_actual = hoy.year

    meses_nombres = {
        1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
        5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
        9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre'
    }

    # ── 1. Generar ventana: igual que /periodos/disponibles ──────────────
    periodos_ventana = []
    for offset in range(-6, 3):
        mes = mes_actual + offset
        anio = anio_actual
        while mes > 12:
            mes -= 12
            anio += 1
        while mes < 1:
            mes += 12
            anio -= 1
        periodos_ventana.append((mes, anio, f"{anio}-{mes:02d}"))

    # ── 2. Periodos que tienen facturas (fuente de verdad) ───────────────
    periodos_con_facturas = {
        row.periodo
        for row in db.query(Factura.periodo)
        .filter(Factura.periodo.isnot(None))
        .distinct()
        .all()
        if row.periodo
    }

    # ── 3. Periodos que tienen pagos registrados ─────────────────────────
    periodos_con_pagos = set()
    for row in (
        db.query(
            extract('year',  Pago.fecha_pago).label('anio'),
            extract('month', Pago.fecha_pago).label('mes')
        )
        .filter(Pago.fecha_pago.isnot(None), Pago.activo == True)
        .distinct()
        .all()
    ):
        if row.anio and row.mes:
            periodos_con_pagos.add(f"{int(row.anio)}-{int(row.mes):02d}")

    # ── 4. Unión: ventana + todos los periodos reales ─────────────────────
    todos_los_periodos = set(p[2] for p in periodos_ventana)
    todos_los_periodos |= periodos_con_facturas   # agrega periodos históricos
    todos_los_periodos |= periodos_con_pagos       # agrega periodos con pagos

    # ── 5. Construir respuesta ordenada desc ──────────────────────────────
    resultado = []
    for periodo_str in sorted(todos_los_periodos, reverse=True):
        try:
            anio_str, mes_str = periodo_str.split("-")
            anio = int(anio_str)
            mes  = int(mes_str)
            resultado.append({
                "anio":      anio,
                "mes":       mes,
                "mes_nombre": meses_nombres.get(mes, "Desconocido"),
                "periodo":   f"{meses_nombres.get(mes, 'Mes')} {anio}",
                "tiene_facturas": periodo_str in periodos_con_facturas,
                "tiene_pagos":    periodo_str in periodos_con_pagos,
            })
        except Exception:
            continue

    return resultado

# ============================================================================
# 9. REPORTE DE MULTAS 
# ============================================================================
@router.get("/multas")
def get_reporte_multas(
    skip: int = 0,
    limit: int = 1000,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    estado: Optional[str] = None,
    tipo: Optional[str] = None,
    activo: Optional[bool] = None,
    vigente: Optional[bool] = None,
    search: Optional[str] = None,  # ⭐ NUEVO: Búsqueda por texto
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """📊 Reporte completo de multas con versionamiento, filtros y búsqueda"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "reportes", "lectura")
    
    query = db.query(TipoMulta)
    
    # ⭐ BÚSQUEDA POR TEXTO
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                # Buscar en nombre de la multa
                TipoMulta.nombre_multa.ilike(search_pattern),
                # Buscar en descripción
                TipoMulta.descripcion.ilike(search_pattern),
                # Buscar por ID (si es numérico)
                cast(TipoMulta.id_tipo_multa, String).ilike(search_pattern)
            )
        )
    
    # Filtros adicionales
    if fecha_desde:
        query = query.filter(TipoMulta.fecha_creacion >= fecha_desde)
    
    if fecha_hasta:
        query = query.filter(TipoMulta.fecha_creacion <= fecha_hasta)
    
    if tipo:
        query = query.filter(TipoMulta.tipo.ilike(f"%{tipo}%"))
    
    if activo is not None:
        query = query.filter(TipoMulta.activo == activo)
    
    if vigente is not None:
        query = query.filter(TipoMulta.es_vigente == vigente)
    
    # ⭐ Obtener total ANTES de paginar
    total = query.count()
    
    # Ordenar por vigencia y fecha de creación
    query = query.order_by(
        TipoMulta.es_vigente.desc(),
        TipoMulta.fecha_creacion.desc(),
        TipoMulta.nombre_multa
    )
    
    # Aplicar paginación
    multas = query.offset(skip).limit(limit).all()
    
    # Formatear respuesta
    multas_formateadas = [
        {
            "nombre_multa": m.nombre_multa,
            "descripcion": m.descripcion,
            "monto": float(m.monto) if m.monto is not None else None,
            "fecha_creacion": m.fecha_creacion.strftime('%d/%m/%Y') if m.fecha_creacion else None,
            "vigencia_desde": m.vigencia_desde.strftime('%d/%m/%Y') if m.vigencia_desde else None,
            "vigencia_hasta": m.vigencia_hasta.strftime('%d/%m/%Y') if m.vigencia_hasta else None,
            "es_vigente": "Sí" if m.es_vigente else "No",  # ⭐ Formato legible
            "activo": m.activo
        }
        for m in multas
    ]
    
    return {
        "success": True,
        "data": multas_formateadas,
        "total": total,  # ⭐ Usar el total real
        "skip": skip,
        "limit": limit,
        "estadisticas": {
            "total_multas": total,
            "total_vigentes": sum(1 for m in multas if m.es_vigente),
            "total_activos": sum(1 for m in multas if m.activo),
            "total_inactivos": sum(1 for m in multas if not m.activo)
        }
    }


# ============================================================================
# 10. REPORTE DE MULTAS AFILIADOS
# ============================================================================
@router.get("/multas-afiliados")
def get_reporte_multas_afiliados(
    skip: int = 0,
    limit: int = 1000,
    id_usuario_afi: Optional[int] = None,
    id_tipo_multa: Optional[int] = None,
    estado: Optional[str] = None,
    facturado: Optional[bool] = None,
    activo: Optional[bool] = None,
    search: Optional[str] = None,
    mes: Optional[int] = None,
    anio: Optional[int] = None,
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """📊 Reporte de multas asignadas a afiliados"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "reportes", "lectura")

    try:
        # Query base con eager loading — agrega medidores para accederlos en la respuesta
        query = db.query(MultaAfiliado).options(
            joinedload(MultaAfiliado.tipo_multa),
            joinedload(MultaAfiliado.usuario)
                .joinedload(UsuarioAfiliado.usuario_sistema),
            joinedload(MultaAfiliado.usuario)
                .joinedload(UsuarioAfiliado.sector),
            joinedload(MultaAfiliado.usuario)
                .joinedload(UsuarioAfiliado.medidores),   # ← carga la lista de medidores
        )

        # BÚSQUEDA POR TEXTO — necesita joins explícitos
        if search:
            search_pattern = f"%{search}%"
            query = (
                query
                .join(MultaAfiliado.usuario)
                .join(UsuarioAfiliado.usuario_sistema)
                .join(MultaAfiliado.tipo_multa)
                .outerjoin(Medidor, Medidor.id_usuario_afi == UsuarioAfiliado.id_usuario_afi)  # ← join a Medidor
                .filter(
                    or_(
                        cast(UsuarioAfiliado.cod_usuario_afi, String).ilike(search_pattern),
                        func.concat(
                            UsuarioSistema.nombres, ' ', UsuarioSistema.apellidos
                        ).ilike(search_pattern),
                        UsuarioSistema.cedula.ilike(search_pattern),
                        TipoMulta.nombre_multa.ilike(search_pattern),
                        MultaAfiliado.observaciones.ilike(search_pattern),
                        Medidor.num_medidor.ilike(search_pattern),   # ← Medidor, no UsuarioAfiliado
                    )
                )
                .distinct()   # ← evita duplicados si el afiliado tiene varios medidores
            )

        # FILTROS ADICIONALES
        if mes and anio:
            query = query.filter(
                extract('month', MultaAfiliado.fecha_multa) == mes,
                extract('year',  MultaAfiliado.fecha_multa) == anio
            )

        if id_usuario_afi:
            query = query.filter(MultaAfiliado.id_usuario_afi == id_usuario_afi)

        if id_tipo_multa:
            query = query.filter(MultaAfiliado.id_tipo_multa == id_tipo_multa)

        if estado:
            query = query.filter(MultaAfiliado.estado == estado)

        if facturado is not None:
            query = query.filter(MultaAfiliado.facturado == facturado)

        if activo is not None:
            query = query.filter(MultaAfiliado.activo == activo)

        total = query.count()

        multas = (
            query
            .order_by(MultaAfiliado.fecha_multa.desc(), MultaAfiliado.id_multa_afi.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

        # ✅ HELPER: primer medidor activo del afiliado, o el primero disponible
        def get_num_medidor(usuario_afiliado):
            if not usuario_afiliado or not usuario_afiliado.medidores:
                return None
            activos = [m for m in usuario_afiliado.medidores if m.activo]
            fuente = activos if activos else usuario_afiliado.medidores
            return fuente[0].num_medidor

        # FORMATEAR RESPUESTA
        multas_formateadas = [
            {
                "medidor":         get_num_medidor(m.usuario),          # ← corregido
                "cod_usuario_afi": m.usuario.cod_usuario_afi if m.usuario else None,
                "nombres":         m.usuario.usuario_sistema.nombres if m.usuario and m.usuario.usuario_sistema else "N/A",
                "apellidos":       m.usuario.usuario_sistema.apellidos if m.usuario and m.usuario.usuario_sistema else "",
                "cedula":          m.usuario.usuario_sistema.cedula if m.usuario and m.usuario.usuario_sistema else None,
                "sector":          m.usuario.sector.nombre_sector if m.usuario and m.usuario.sector else None,
                "nombre_multa":    m.tipo_multa.nombre_multa if m.tipo_multa else "N/A",
                "monto":           float(m.monto),
                "fecha_multa":     m.fecha_multa.isoformat() if m.fecha_multa else None,
                "fecha_pago":      m.fecha_pago.isoformat()  if m.fecha_pago  else None,
                "observaciones":   m.observaciones,
                "estado":          m.estado,
                "facturado":       m.facturado,
                "activo":          m.activo,
            }
            for m in multas
        ]

        print(f"✅ Reporte multas: {len(multas_formateadas)} de {total}")

        return {
            "success": True,
            "data":    multas_formateadas,
            "total":   total,
            "skip":    skip,
            "limit":   limit
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Error al generar reporte de multas: {str(e)}"
        )

# ============================================================================
# 10.1 PERIODOS DE MULTAS AFILIADOS
# ============================================================================
@router.get("/multas-afiliados/periodos")
def get_periodos_multas_afiliados(
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """📅 Obtiene los periodos (mes/año) disponibles de multas a afiliados"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "reportes", "lectura")
    
    periodos = db.query(
        extract('year', MultaAfiliado.fecha_multa).label('anio'),
        extract('month', MultaAfiliado.fecha_multa).label('mes')
    ).filter(
        MultaAfiliado.fecha_multa.isnot(None),
        MultaAfiliado.activo == True
    ).distinct().order_by(
        desc(extract('year', MultaAfiliado.fecha_multa)),
        desc(extract('month', MultaAfiliado.fecha_multa))
    ).all()
    
    meses_nombres = {
        1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
        5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
        9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre'
    }
    
    return [
        {
            "anio": int(p.anio),
            "mes": int(p.mes),
            "mes_nombre": meses_nombres.get(int(p.mes), 'Desconocido'),
            "periodo": f"{meses_nombres.get(int(p.mes), 'Mes')} {int(p.anio)}"
        }
        for p in periodos if p.anio and p.mes
    ]


# ============================================================================
# 11. REPORTE DE TARIFAS
# ============================================================================

@router.get("/tarifas")
def get_reporte_tarifas(
    skip: int = 0,
    limit: int = 1000,
    activo: Optional[bool] = None,
    vigente: Optional[bool] = None,
    tipo_tarifa: Optional[str] = None,
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """📊 Reporte completo de tarifas"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "reportes", "lectura")
    
    query = db.query(Tarifa)
    
    if activo is not None:
        query = query.filter(Tarifa.activo == activo)
    
    if vigente is not None:
        query = query.filter(Tarifa.es_vigente == vigente)
    
    if tipo_tarifa:
        query = query.filter(Tarifa.tipo_tarifa.ilike(f"%{tipo_tarifa}%"))
    
    query = query.order_by(
        Tarifa.es_vigente.desc(),
        Tarifa.tipo_tarifa,
        Tarifa.limite_min_m3
    )
    
    tarifas = query.offset(skip).limit(limit).all()
    
    return [
        {
            "nombre": t.nombre,
            "detalle": t.detalle,
            "tipo_tarifa": t.tipo_tarifa,
            "precio_por_m3": float(t.precio_por_m3) if t.precio_por_m3 else 0,
            "limite_min_m3": float(t.limite_min_m3) if t.limite_min_m3 else 0,
            "limite_max_m3": float(t.limite_max_m3) if t.limite_max_m3 else None,
            "vigencia_desde": t.vigencia_desde.strftime('%d/%m/%Y') if t.vigencia_desde else None,
            "vigencia_hasta": t.vigencia_hasta.strftime('%d/%m/%Y') if t.vigencia_hasta else None,
            "es_vigente": t.es_vigente ,
            "activo": t.activo 
        }
        for t in tarifas
    ]

# ============================================================================
# 12. REPORTE DE SERVICIOS
# ============================================================================

@router.get("/servicios")
def get_reporte_servicios(
    skip: int = 0,
    limit: int = 1000,
    activo: Optional[bool] = None,
    vigente: Optional[bool] = None,
    search: Optional[str] = None,
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """📊 Reporte completo de servicios adicionales"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "reportes", "lectura")
    
    query = db.query(Servicio)
    
    if activo is not None:
        query = query.filter(Servicio.activo == activo)
    
    if vigente is not None:
        query = query.filter(Servicio.es_vigente == vigente)
    
    if search:
        like = f"%{search}%"
        query = query.filter(or_(
            Servicio.nombre.ilike(like),
            Servicio.descripcion.ilike(like)
        ))
    
    query = query.order_by(
        Servicio.es_vigente.desc(),
        Servicio.nombre
    )
    
    servicios = query.offset(skip).limit(limit).all()
    
    return [
        {
            "nombre": s.nombre,
            "descripcion": s.descripcion,
            "precio_base": float(s.precio_base) if s.precio_base else 0,
            "fecha_creacion": s.fecha_creacion.strftime('%d/%m/%Y') if s.fecha_creacion else None,
            "vigencia_desde": s.vigencia_desde.strftime('%d/%m/%Y') if s.vigencia_desde else None,
            "vigencia_hasta": s.vigencia_hasta.strftime('%d/%m/%Y') if s.vigencia_hasta else None,
            "es_vigente": "Sí" if s.es_vigente else "No",
            "activo":  s.activo
        }
        for s in servicios
    ]

# ============================================================================
# EXPORTACIÓN DE REPORTES
# ============================================================================

@router.get("/exportar/{modulo}")
def exportar_reporte(
    modulo: str,
    formato: str = "csv",
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    📥 Exportar reporte a CSV o Excel
    Módulos: usuarios, afiliados, medidores, lecturas, facturas, pagos, multas
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "reportes", "lectura")
    
    # Mapeo de módulos a funciones de consulta
    modulo_map = {
        "usuarios": get_reporte_usuarios,
        "afiliados": get_reporte_afiliados,
        "medidores": get_reporte_medidores,
        "lecturas": get_reporte_lecturas,
        "facturas": get_reporte_facturas,
        "pagos": get_reporte_pagos,
        "multas": get_reporte_multas
    }
    
    if modulo not in modulo_map:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Módulo {modulo} no disponible para exportación"
        )
    
    # Obtener datos del reporte
    data = modulo_map[modulo](
        skip=0,
        limit=10000,
        payload=payload,
        db=db
    )
    
    # Procesar según formato
    if formato == "csv":
        return export_to_csv(data, f"reporte_{modulo}_{datetime.now().strftime('%Y%m%d')}")
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato no soportado. Use 'csv'"
        )


# ============================================================================
# 9. REPORTE DE CAJA GENERAL
# Incluye: cobros de agua, multas cobradas, resumen mensual, anual y diario
# ============================================================================

# ============================================================================
# 9.1 RESUMEN MENSUAL DE CAJA
# ============================================================================
@router.get("/caja/mensual")
def get_caja_mensual(
    mes: Optional[int] = Query(None, ge=1, le=12),
    anio: Optional[int] = Query(None, ge=2020),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    💰 Resumen mensual de caja
    - Total recaudado por cobros de agua (pagos registrados)
    - Total recaudado por multas cobradas
    - Desglose por método de pago
    - Desglose por sector
    - Comparativa con mes anterior
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "reportes", "lectura")

    hoy = date.today()
    mes_ref = mes or hoy.month
    anio_ref = anio or hoy.year

    mes_ant = mes_ref - 1 if mes_ref > 1 else 12
    anio_ant = anio_ref if mes_ref > 1 else anio_ref - 1

    try:
        def filtro_periodo_pago(m, a):
            return and_(
                extract('month', Pago.fecha_pago) == m,
                extract('year', Pago.fecha_pago) == a,
                Pago.estado_pago == 'REGISTRADO'
            )

        def filtro_periodo_multa(m, a):
            return and_(
                extract('month', MultaAfiliado.fecha_pago) == m,
                extract('year', MultaAfiliado.fecha_pago) == a,
                MultaAfiliado.estado == 'pagada',
                MultaAfiliado.activo == True
            )

        # A. PAGOS DE AGUA
        pagos_agua = (
            db.query(
                func.count(Pago.id_pago).label('cantidad'),
                func.sum(Pago.monto_pago).label('total'),
                Pago.metodo_pago
            )
            .filter(filtro_periodo_pago(mes_ref, anio_ref))
            .group_by(Pago.metodo_pago)
            .all()
        )

        total_agua = sum(float(r.total or 0) for r in pagos_agua)
        cantidad_agua = sum(r.cantidad for r in pagos_agua)
        desglose_agua = {
            r.metodo_pago or 'SIN_METODO': {
                "cantidad": r.cantidad,
                "total": round(float(r.total or 0), 2)
            }
            for r in pagos_agua
        }

        # B. MULTAS COBRADAS
        multas_row = (
            db.query(
                func.count(MultaAfiliado.id_multa_afi).label('cantidad'),
                func.sum(MultaAfiliado.monto).label('total')
            )
            .filter(filtro_periodo_multa(mes_ref, anio_ref))
            .one()
        )
        total_multas = round(float(multas_row.total or 0), 2)
        cantidad_multas = multas_row.cantidad or 0

        # C. MORA COBRADA
        mora_sq = (
            db.query(
                MoraFactura.id_factura,
                func.sum(MoraFactura.monto_mora).label('total_mora')
            )
            .filter(MoraFactura.aplicada == True)
            .group_by(MoraFactura.id_factura)
            .subquery()
        )
        mora_cobrada = (
            db.query(func.sum(mora_sq.c.total_mora))
            .join(Pago, Pago.id_factura == mora_sq.c.id_factura)
            .filter(filtro_periodo_pago(mes_ref, anio_ref))
            .scalar()
        )
        total_mora = round(float(mora_cobrada or 0), 2)

        # D. DESGLOSE POR SECTOR
        sector_rows = (
            db.query(
                Sector.nombre_sector,
                func.count(Pago.id_pago).label('cantidad'),
                func.sum(Pago.monto_pago).label('total')
            )
            .join(Factura, Pago.id_factura == Factura.id_factura)
            .join(Lectura, Factura.id_lectura == Lectura.id_lectura)
            .join(Medidor, Lectura.id_medidor == Medidor.id_medidor)
            .join(UsuarioAfiliado, Medidor.id_usuario_afi == UsuarioAfiliado.id_usuario_afi)
            .outerjoin(Sector, UsuarioAfiliado.id_sector == Sector.id_sector)
            .filter(filtro_periodo_pago(mes_ref, anio_ref))
            .group_by(Sector.nombre_sector)
            .all()
        )
        desglose_sector = [
            {
                "sector": r.nombre_sector or "Sin sector",
                "cantidad": r.cantidad,
                "total": round(float(r.total or 0), 2)
            }
            for r in sorted(sector_rows, key=lambda x: -(x.total or 0))
        ]

        # E. COMPARATIVA MES ANTERIOR
        pagos_ant = (
            db.query(func.sum(Pago.monto_pago))
            .filter(filtro_periodo_pago(mes_ant, anio_ant))
            .scalar()
        )
        multas_ant = (
            db.query(func.sum(MultaAfiliado.monto))
            .filter(filtro_periodo_multa(mes_ant, anio_ant))
            .scalar()
        )
        total_ant = round(float(pagos_ant or 0) + float(multas_ant or 0), 2)
        total_mes_actual = round(total_agua + total_multas, 2)
        variacion_pct = (
            round(((total_mes_actual - total_ant) / total_ant) * 100, 1)
            if total_ant > 0 else 0.0
        )

        # F. FACTURAS PENDIENTES DEL MES
        periodo_str = f"{anio_ref}-{mes_ref:02d}"
        pendientes_row = (
            db.query(
                func.count(Factura.id_factura).label('cantidad'),
                func.sum(Factura.total).label('total')
            )
            .filter(
                Factura.periodo == periodo_str,
                Factura.estado_factura.in_(['pendiente', 'vencida'])
            )
            .one()
        )
        total_pendiente = round(float(pendientes_row.total or 0), 2)
        cantidad_pendiente = pendientes_row.cantidad or 0

        # G. TOTAL FACTURADO DEL MES
        facturado_row = (
            db.query(func.sum(Factura.total))
            .filter(Factura.periodo == periodo_str)
            .scalar()
        )
        total_facturado = round(float(facturado_row or 0), 2)
        porcentaje_cobrado = (
            round((total_agua / total_facturado) * 100, 1)
            if total_facturado > 0 else 0.0
        )

        meses_nombres = {
            1:'Enero', 2:'Febrero', 3:'Marzo', 4:'Abril', 5:'Mayo', 6:'Junio',
            7:'Julio', 8:'Agosto', 9:'Septiembre', 10:'Octubre', 11:'Noviembre', 12:'Diciembre'
        }

        return {
            "success": True,
            "periodo": {
                "mes": mes_ref,
                "anio": anio_ref,
                "nombre": f"{meses_nombres[mes_ref]} {anio_ref}",
                "periodo_str": periodo_str
            },
            "resumen": {
                "total_general": round(total_mes_actual + total_mora, 2),
                "total_agua": round(total_agua, 2),
                "total_multas": total_multas,
                "total_mora": total_mora,
                "cantidad_pagos": cantidad_agua,
                "cantidad_multas": cantidad_multas,
            },
            "facturacion": {
                "total_facturado": total_facturado,
                "total_cobrado": round(total_agua, 2),
                "total_pendiente": total_pendiente,
                "cantidad_pendiente": cantidad_pendiente,
                "porcentaje_cobrado": porcentaje_cobrado,
                "porcentaje_pendiente": round(100 - porcentaje_cobrado, 1)
            },
            "metodos_pago": desglose_agua,
            "desglose_sector": desglose_sector,
            "comparativa": {
                "mes_anterior": {
                    "nombre": f"{meses_nombres[mes_ant]} {anio_ant}",
                    "total": total_ant
                },
                "variacion_monto": round(total_mes_actual - total_ant, 2),
                "variacion_porcentaje": variacion_pct,
                "tendencia": "subida" if variacion_pct > 0 else "bajada" if variacion_pct < 0 else "igual"
            }
        }

    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error en reporte de caja mensual: {str(e)}")


# ============================================================================
# 9.2 RESUMEN ANUAL DE CAJA
# ============================================================================
@router.get("/caja/anual")
def get_caja_anual(
    anio: Optional[int] = Query(None, ge=2020),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """📅 Resumen anual de caja mes a mes"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "reportes", "lectura")

    anio_ref = anio or date.today().year

    try:
        meses_nombres = {
            1:'Enero', 2:'Febrero', 3:'Marzo', 4:'Abril', 5:'Mayo', 6:'Junio',
            7:'Julio', 8:'Agosto', 9:'Septiembre', 10:'Octubre', 11:'Noviembre', 12:'Diciembre'
        }

        pagos_por_mes = (
            db.query(
                extract('month', Pago.fecha_pago).label('mes'),
                func.sum(Pago.monto_pago).label('total'),
                func.count(Pago.id_pago).label('cantidad')
            )
            .filter(
                extract('year', Pago.fecha_pago) == anio_ref,
                Pago.estado_pago == 'REGISTRADO'
            )
            .group_by(extract('month', Pago.fecha_pago))
            .all()
        )
        agua_por_mes = {int(r.mes): {"total": float(r.total or 0), "cantidad": r.cantidad}
                        for r in pagos_por_mes}

        multas_por_mes = (
            db.query(
                extract('month', MultaAfiliado.fecha_pago).label('mes'),
                func.sum(MultaAfiliado.monto).label('total'),
                func.count(MultaAfiliado.id_multa_afi).label('cantidad')
            )
            .filter(
                extract('year', MultaAfiliado.fecha_pago) == anio_ref,
                MultaAfiliado.estado == 'pagada',
                MultaAfiliado.activo == True
            )
            .group_by(extract('month', MultaAfiliado.fecha_pago))
            .all()
        )
        multas_mes = {int(r.mes): {"total": float(r.total or 0), "cantidad": r.cantidad}
                      for r in multas_por_mes}

        mora_sq = (
            db.query(
                MoraFactura.id_factura,
                func.sum(MoraFactura.monto_mora).label('total_mora')
            )
            .filter(MoraFactura.aplicada == True)
            .group_by(MoraFactura.id_factura)
            .subquery()
        )
        mora_por_mes_rows = (
            db.query(
                extract('month', Pago.fecha_pago).label('mes'),
                func.sum(mora_sq.c.total_mora).label('total_mora')
            )
            .join(mora_sq, Pago.id_factura == mora_sq.c.id_factura)
            .filter(
                extract('year', Pago.fecha_pago) == anio_ref,
                Pago.estado_pago == 'REGISTRADO'
            )
            .group_by(extract('month', Pago.fecha_pago))
            .all()
        )
        mora_mes = {int(r.mes): float(r.total_mora or 0) for r in mora_por_mes_rows}

        facturado_por_mes = (
            db.query(
                func.substring(Factura.periodo, 6, 2).label('mes_str'),
                func.sum(Factura.total).label('total'),
                func.count(Factura.id_factura).label('cantidad')
            )
            .filter(Factura.periodo.like(f"{anio_ref}-%"))
            .group_by(func.substring(Factura.periodo, 6, 2))
            .all()
        )
        facturado_mes = {
            int(r.mes_str): {"total": float(r.total or 0), "cantidad": r.cantidad}
            for r in facturado_por_mes
        }

        # ── Construir lista SOLO con meses que tienen movimiento ──────────────
        meses_data = []
        for m in range(1, 13):
            agua  = agua_por_mes.get(m,  {"total": 0, "cantidad": 0})
            multa = multas_mes.get(m,    {"total": 0, "cantidad": 0})
            mora  = mora_mes.get(m, 0)
            fact  = facturado_mes.get(m, {"total": 0, "cantidad": 0})

            # ✅ FILTRO CORREGIDO: solo mostrar si hay algún INGRESO real
            # (no basta con que haya facturación, debe haber al menos un cobro o multa)
            tiene_ingresos = agua["total"] > 0 or multa["total"] > 0 or mora > 0
            if not tiene_ingresos:
                continue

            # ── En get_caja_anual, reemplazar el bloque del % cobrado ──────────────────

            total_cobrado = round(agua["total"] + multa["total"] + mora, 2)

            # ✅ % COBRADO: total cobrado (agua + multas + mora) vs total facturado
            # Si hay cobros pero no hay facturación del mes = pagos/multas de otro período
            if fact["total"] > 0:
                pct = round((total_cobrado / fact["total"]) * 100, 1)
                pct = min(pct, 100.0)
            elif total_cobrado > 0:
                # Hubo cobros (ej: solo multas) pero sin factura del mes
                # Mostramos 100% porque todo lo cobrable se cobró
                pct = 100.0
            else:
                pct = 0.0

            meses_data.append({
                "mes": m,
                "nombre_mes": meses_nombres[m],
                "total_agua": round(agua["total"], 2),
                "total_multas": round(multa["total"], 2),
                "total_mora": round(mora, 2),
                "total_general": total_cobrado,
                "cantidad_pagos": agua["cantidad"],
                "cantidad_multas": multa["cantidad"],
                "total_facturado": round(fact["total"], 2),
                "total_pendiente": round(max(fact["total"] - agua["total"], 0), 2),
                "porcentaje_cobrado": pct
            })
            
        total_anual_agua = sum(m["total_agua"] for m in meses_data)
        total_anual_multas = sum(m["total_multas"] for m in meses_data)
        total_anual_mora = sum(m["total_mora"] for m in meses_data)
        total_anual_fact = sum(m["total_facturado"] for m in meses_data)
        total_anual_gral = round(total_anual_agua + total_anual_multas + total_anual_mora, 2)
        mejor_mes = max(meses_data, key=lambda x: x["total_general"], default=None)

        pagos_anio_ant = (
            db.query(func.sum(Pago.monto_pago))
            .filter(
                extract('year', Pago.fecha_pago) == anio_ref - 1,
                Pago.estado_pago == 'REGISTRADO'
            )
            .scalar()
        )
        multas_anio_ant = (
            db.query(func.sum(MultaAfiliado.monto))
            .filter(
                extract('year', MultaAfiliado.fecha_pago) == anio_ref - 1,
                MultaAfiliado.estado == 'pagada'
            )
            .scalar()
        )
        total_anio_ant = round(float(pagos_anio_ant or 0) + float(multas_anio_ant or 0), 2)
        variacion_anual = (
            round(((total_anual_gral - total_anio_ant) / total_anio_ant) * 100, 1)
            if total_anio_ant > 0 else 0.0
        )

        return {
            "success": True,
            "anio": anio_ref,
            "meses": meses_data,
            "totales": {
                "total_general": total_anual_gral,
                "total_agua": round(total_anual_agua, 2),
                "total_multas": round(total_anual_multas, 2),
                "total_mora": round(total_anual_mora, 2),
                "total_facturado": round(total_anual_fact, 2),
                "total_pendiente": round(total_anual_fact - total_anual_agua, 2),
                "porcentaje_cobrado": round(
                    (total_anual_agua / total_anual_fact * 100) if total_anual_fact > 0 else 0, 1
                )
            },
            "mejor_mes": mejor_mes,
            "comparativa_anio_anterior": {
                "anio": anio_ref - 1,
                "total": total_anio_ant,
                "variacion_monto": round(total_anual_gral - total_anio_ant, 2),
                "variacion_porcentaje": variacion_anual,
                "tendencia": "subida" if variacion_anual > 0 else "bajada" if variacion_anual < 0 else "igual"
            }
        }

    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error en reporte de caja anual: {str(e)}")


# ============================================================================
# 9.3 DETALLE DIARIO DE CAJA
# ============================================================================
@router.get("/caja/detalle-diario")
def get_caja_detalle_diario(
    mes: int = Query(..., ge=1, le=12),
    anio: int = Query(..., ge=2020),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """📋 Detalle día a día de ingresos en un mes"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "reportes", "lectura")

    try:
        pagos_diarios = (
            db.query(
                func.date(Pago.fecha_pago).label('dia'),
                func.sum(Pago.monto_pago).label('total_agua'),
                func.count(Pago.id_pago).label('cantidad_pagos'),
                Pago.metodo_pago
            )
            .filter(
                extract('month', Pago.fecha_pago) == mes,
                extract('year', Pago.fecha_pago) == anio,
                Pago.estado_pago == 'REGISTRADO'
            )
            .group_by(func.date(Pago.fecha_pago), Pago.metodo_pago)
            .order_by(func.date(Pago.fecha_pago))
            .all()
        )

        multas_diarias = (
            db.query(
                func.date(MultaAfiliado.fecha_pago).label('dia'),
                func.sum(MultaAfiliado.monto).label('total_multas'),
                func.count(MultaAfiliado.id_multa_afi).label('cantidad_multas')
            )
            .filter(
                extract('month', MultaAfiliado.fecha_pago) == mes,
                extract('year', MultaAfiliado.fecha_pago) == anio,
                MultaAfiliado.estado == 'pagada',
                MultaAfiliado.activo == True
            )
            .group_by(func.date(MultaAfiliado.fecha_pago))
            .order_by(func.date(MultaAfiliado.fecha_pago))
            .all()
        )

        dias = {}
        for r in pagos_diarios:
            dia_str = str(r.dia)
            if dia_str not in dias:
                dias[dia_str] = {"dia": dia_str, "total_agua": 0, "total_multas": 0,
                                 "total_general": 0, "cantidad_pagos": 0,
                                 "cantidad_multas": 0, "metodos": {}}
            dias[dia_str]["total_agua"] += float(r.total_agua or 0)
            dias[dia_str]["cantidad_pagos"] += r.cantidad_pagos
            metodo = r.metodo_pago or "SIN_METODO"
            dias[dia_str]["metodos"][metodo] = (
                dias[dia_str]["metodos"].get(metodo, 0) + float(r.total_agua or 0)
            )

        for r in multas_diarias:
            dia_str = str(r.dia)
            if dia_str not in dias:
                dias[dia_str] = {"dia": dia_str, "total_agua": 0, "total_multas": 0,
                                 "total_general": 0, "cantidad_pagos": 0,
                                 "cantidad_multas": 0, "metodos": {}}
            dias[dia_str]["total_multas"] += float(r.total_multas or 0)
            dias[dia_str]["cantidad_multas"] += r.cantidad_multas

        detalle = []
        for dia_str, d in sorted(dias.items()):
            d["total_agua"] = round(d["total_agua"], 2)
            d["total_multas"] = round(d["total_multas"], 2)
            d["total_general"] = round(d["total_agua"] + d["total_multas"], 2)
            d["metodos"] = {k: round(v, 2) for k, v in d["metodos"].items()}
            detalle.append(d)

        return {
            "success": True,
            "mes": mes,
            "anio": anio,
            "detalle": detalle,
            "totales": {
                "total_agua": round(sum(d["total_agua"] for d in detalle), 2),
                "total_multas": round(sum(d["total_multas"] for d in detalle), 2),
                "total_general": round(sum(d["total_general"] for d in detalle), 2),
                "dias_con_movimiento": len(detalle)
            }
        }

    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error en detalle diario: {str(e)}")


# ============================================================================
# 9.4 AÑOS DISPONIBLES EN CAJA
# ============================================================================
@router.get("/caja/anios-disponibles")
def get_anios_disponibles(
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """📅 Lista de años con movimientos en caja, y meses disponibles por año"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "reportes", "lectura")

    # ── Años con pagos de agua ──────────────────────────────────────────
    anios_pagos = (
        db.query(extract('year', Pago.fecha_pago).label('anio'))
        .filter(Pago.fecha_pago.isnot(None), Pago.estado_pago == 'REGISTRADO')
        .distinct().all()
    )
    # ── Años con multas cobradas ────────────────────────────────────────
    anios_multas = (
        db.query(extract('year', MultaAfiliado.fecha_pago).label('anio'))
        .filter(MultaAfiliado.fecha_pago.isnot(None), MultaAfiliado.estado == 'pagada')
        .distinct().all()
    )

    todos = sorted(
        set(int(r.anio) for r in anios_pagos if r.anio)
        | set(int(r.anio) for r in anios_multas if r.anio),
        reverse=True
    )

    # ── Meses con datos por año (pagos de agua) ─────────────────────────
    meses_pagos = (
        db.query(
            extract('year',  Pago.fecha_pago).label('anio'),
            extract('month', Pago.fecha_pago).label('mes'),
        )
        .filter(Pago.fecha_pago.isnot(None), Pago.estado_pago == 'REGISTRADO')
        .distinct()
        .all()
    )
    # ── Meses con datos por año (multas cobradas) ───────────────────────
    meses_multas = (
        db.query(
            extract('year',  MultaAfiliado.fecha_pago).label('anio'),
            extract('month', MultaAfiliado.fecha_pago).label('mes'),
        )
        .filter(MultaAfiliado.fecha_pago.isnot(None), MultaAfiliado.estado == 'pagada')
        .distinct()
        .all()
    )

    # Unir y agrupar: { anio: sorted([meses]) }
    meses_por_anio: dict[int, set] = {}
    for r in (*meses_pagos, *meses_multas):
        a, m = int(r.anio), int(r.mes)
        if a not in meses_por_anio:
            meses_por_anio[a] = set()
        meses_por_anio[a].add(m)

    meses_por_anio_sorted = {
        a: sorted(meses)
        for a, meses in meses_por_anio.items()
    }

    return {
        "success": True,
        "anios": todos,                        # lista de años  (igual que antes)
        "meses_por_anio": meses_por_anio_sorted  # { 2024: [1,3,5], 2025: [1,2] }
    }