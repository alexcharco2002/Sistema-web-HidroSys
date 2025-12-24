# routes/reports.py
"""
Router centralizado para generación de reportes y estadísticas del sistema
Maneja todos los módulos de reportes de forma unificada
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, desc, or_, cast, String, func, extract
from typing import List, Optional
from datetime import datetime, date
import io
import csv

from db.session import SessionLocal
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
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
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

    if fecha_desde:
        filtros.append(UsuarioSistema.fecha_registro >= fecha_desde)

    if fecha_hasta:
        filtros.append(UsuarioSistema.fecha_registro <= fecha_hasta)

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
            "sexo": u.sexo,
            "rol": u.rol,
            "activo": u.activo,
            "fecha_registro": (
                u.fecha_registro.strftime("%d/%m/%Y")
                if u.fecha_registro else None
            ),
            "ultimo_acceso": (
                u.ultimo_acceso.strftime("%d/%m/%Y")
                if u.ultimo_acceso else None
            )
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
    
    # Query optimizado con joinedload para evitar N+1
    query = db.query(UsuarioAfiliado).options(
        joinedload(UsuarioAfiliado.usuario_sistema),
        joinedload(UsuarioAfiliado.sector),
        joinedload(UsuarioAfiliado.medidores)  # Cargar medidores
    )
    
    if search:
        like = f"%{search}%"
        query = query.join(UsuarioAfiliado.usuario_sistema).filter(or_(
            UsuarioSistema.nombres.ilike(like),
            UsuarioSistema.apellidos.ilike(like),
            cast(UsuarioSistema.cedula, String).ilike(like)
        ))
    
    if sector:
        query = query.filter(UsuarioAfiliado.id_sector == sector)
    
    if estado:
        query = query.filter(UsuarioAfiliado.activo == (estado.lower() == 'activo'))
    
    if fecha_desde:
        query = query.filter(UsuarioAfiliado.fecha_afiliacion >= fecha_desde)
    
    if fecha_hasta:
        query = query.filter(UsuarioAfiliado.fecha_afiliacion <= fecha_hasta)
    
    afiliados = query.offset(skip).limit(limit).all()

    return [
        {
            "cod_usuario_afi": a.cod_usuario_afi,
            "nombres": a.usuario_sistema.nombres if a.usuario_sistema else None,
            "apellidos": a.usuario_sistema.apellidos if a.usuario_sistema else None,
            "cedula": a.usuario_sistema.cedula if a.usuario_sistema else None,
            "sector": a.sector.nombre_sector if a.sector else None,
            "num_medidor": a.medidores[0].num_medidor if a.medidores else None,
            "fecha_afiliacion": a.fecha_afiliacion.isoformat() if a.fecha_afiliacion else None,
            "activo": a.activo,
        }
        for a in afiliados
    ]

# ============================================================================
# 4. REPORTE DE MEDIDORES
# ============================================================================
@router.get("/medidores")
def get_reporte_medidores(
    skip: int = 0,
    limit: int = 1000,
    search: Optional[str] = None,
    estado: Optional[str] = None,  # ✅ Cambio: de activo a estado
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
    
    # ✅ Filtro de estado corregido
    if estado == "activos":
        query = query.filter(Medidor.activo == True)
    elif estado == "inactivos":
        query = query.filter(Medidor.activo == False)
    
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
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
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
    
    # Filtros de fecha
    if fecha_desde:
        query = query.filter(Lectura.fecha_lectura >= fecha_desde)
    
    if fecha_hasta:
        query = query.filter(Lectura.fecha_lectura <= fecha_hasta)
    
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
# 6.1. OBTENER PERIODOS DISPONIBLES (MES/AÑO)
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
# 7. REPORTE DE FACTURAS - OPTIMIZADO
# ============================================================================

@router.get("/facturas")
def get_reporte_facturas(
    skip: int = 0,
    limit: int = 1000,
    search: Optional[str] = None,
    mes: Optional[int] = None,
    anio: Optional[int] = None,
    estado: Optional[str] = None,
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """📊 Reporte completo de facturas con información de afiliado y medidor"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "reportes", "lectura")
    
    # Query optimizado con joins
    query = db.query(Factura).options(
        joinedload(Factura.usuario_afiliado)
            .joinedload(UsuarioAfiliado.usuario_sistema),
        joinedload(Factura.usuario_afiliado)
            .joinedload(UsuarioAfiliado.medidores),
        joinedload(Factura.detalles),
    )
    
    # ============================================================
    # FILTRO POR MES Y AÑO (PRIORIDAD)
    # ============================================================
    if mes and anio:
        periodo_buscado = f"{anio}-{mes:02d}"
        query = query.filter(Factura.periodo == periodo_buscado)
        print(f"🔍 Filtrando facturas por periodo: {periodo_buscado}")
    
    
    # ============================================================
    # FILTRO DE BÚSQUEDA
    # ============================================================
    if search:
        search_pattern = f"%{search}%"
        query = query.join(Factura.usuario_afiliado).outerjoin(UsuarioAfiliado.usuario_sistema).filter(
            or_(
                UsuarioSistema.nombres.ilike(search_pattern),
                UsuarioSistema.apellidos.ilike(search_pattern),
                cast(UsuarioAfiliado.cod_usuario_afi, String).ilike(search_pattern)
            )
        )
    
    # ============================================================
    # FILTRO POR ESTADO
    # ============================================================
    if estado and estado.lower() != 'todos':
        query = query.filter(Factura.estado_factura == estado.lower())
    
    # ============================================================
    # ORDENAR Y PAGINAR
    # ============================================================
    query = query.order_by(Factura.fecha_emision.desc(), Factura.num_factura.desc())
    
    # Contar total antes de paginar
    total_count = query.count()
    
    # Aplicar paginación
    facturas = query.offset(skip).limit(limit).all()
    
    # ============================================================
    # CALCULAR ESTADÍSTICAS
    # ============================================================
    total_facturado = sum(float(f.total or 0) for f in facturas)
    total_pagado = sum(
        float(f.total or 0) for f in facturas 
        if f.estado_factura == 'pagada'
    )
    total_pendiente = sum(
        float(f.total or 0) for f in facturas 
        if f.estado_factura == 'pendiente'
    )
    total_vencido = sum(
        float(f.total or 0) for f in facturas 
        if f.estado_factura == 'vencida'
    )
    
    # ============================================================
    # FORMATEAR RESPUESTA
    # ============================================================
    facturas_formateadas = []
    for f in facturas:
        # Obtener datos del afiliado
        afiliado = f.usuario_afiliado
        usuario_sistema = afiliado.usuario_sistema if afiliado else None
        
        # Obtener número de medidor
        num_medidor = "N/A"
        if afiliado and afiliado.medidores:
            # Como la relación es 1:1 (unique=True), tomamos el primer medidor
            num_medidor = afiliado.medidores[0].num_medidor if len(afiliado.medidores) > 0 else "N/A"
        
        factura_dict = {
            # Identificación
            "num_factura": f.num_factura,
            
            # Datos del afiliado
            "num_medidor": num_medidor,
            "cod_usuario_afi": afiliado.cod_usuario_afi,
            "nombres": usuario_sistema.nombres if usuario_sistema else "N/A",
            "apellidos": usuario_sistema.apellidos if usuario_sistema else "N/A",
            
            # Datos de consumo
            "consumo_m3": f.consumo_m3 or 0,
            "exceso_m3": f.exceso_m3 or 0,
            
            # Valores monetarios
            "valor_consumo": float(f.valor_consumo) if f.valor_consumo else 0.0,
            "valor_exceso": float(f.valor_exceso) if f.valor_exceso else 0.0,
            "descuento": float(f.descuento) if f.descuento else 0.0,
            "subtotal": float(f.subtotal) if f.subtotal else 0.0,
            "impuesto": float(f.impuesto) if f.impuesto else 0.0,
            "total": float(f.total) if f.total else 0.0,
            
            # Estado y fechas
            "fecha_emision": f.fecha_emision.isoformat() if f.fecha_emision else None,
            "estado": f.estado_factura,

        }
        
        facturas_formateadas.append(factura_dict)
    
    return {
        "success": True,
        "data": facturas_formateadas,
        "total": total_count,
        "skip": skip,
        "limit": limit,
        "estadisticas": {
            "total_facturas": len(facturas),
            "total_facturado": round(total_facturado, 2),
            "total_pagado": round(total_pagado, 2),
            "total_pendiente": round(total_pendiente, 2),
            "total_vencido": round(total_vencido, 2)
        }
    }


# ============================================================================
# 7.1 PERIODOS DISPONIBLES POR FACTURA (DESDE CAMPO PERIODO)
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



# ============================================================================
# 8. REPORTE DE PAGOS 
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


@router.get("/pagos")
def get_reporte_pagos(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    estado_pago: Optional[str] = None,
    estado_factura: Optional[str] = None,
    metodo_pago: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    🚀 Reporte SIMPLE y RÁPIDO
    SOLO JOIN pagos + facturas
    """

    query = (
        db.query(
            Pago.id_pago,
            Pago.fecha_pago,
            Pago.monto_pago,
            Pago.metodo_pago,
            Pago.estado_pago,

            Factura.id_factura,
            Factura.num_factura,
            Factura.periodo,
            Factura.total.label("total_factura"),
            Factura.estado_factura
        )
        .join(Factura, Factura.id_factura == Pago.id_factura)
        .filter(Pago.activo == True)
    )

    # =========================
    # Filtros simples
    # =========================
    if estado_pago:
        query = query.filter(Pago.estado_pago == estado_pago)

    if estado_factura:
        query = query.filter(Factura.estado_factura == estado_factura)

    if metodo_pago:
        query = query.filter(Pago.metodo_pago == metodo_pago)

    # =========================
    # Orden + paginación
    # =========================
    rows = (
        query
        .order_by(Pago.fecha_pago.desc(), Pago.id_pago.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    # =========================
    # Formato plano (rápido)
    # =========================
    data = [
        {
            "id_pago": r.id_pago,
            "fecha_pago": r.fecha_pago,
            "monto_pago": float(r.monto_pago),
            "metodo_pago": r.metodo_pago,
            "estado_pago": r.estado_pago,

            "factura": {
                "id_factura": r.id_factura,
                "num_factura": r.num_factura,
                "periodo": r.periodo,
                "total": float(r.total_factura),
                "estado": r.estado_factura
            }
        }
        for r in rows
    ]

    return {
        "success": True,
        "skip": skip,
        "limit": limit,
        "total_registros": len(data),
        "data": data
    }

@router.get("/pagos/periodos")
def get_periodos_pagos(
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """📅 Obtiene los periodos (mes/año) disponibles de pagos"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "reportes", "lectura")
    
    periodos = db.query(
        extract('year', Pago.fecha_pago).label('anio'),
        extract('month', Pago.fecha_pago).label('mes')
    ).filter(
        Pago.fecha_pago.isnot(None)
    ).distinct().order_by(
        desc(extract('year', Pago.fecha_pago)),
        desc(extract('month', Pago.fecha_pago))
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
# 9. REPORTE DE MULTAS - OPTIMIZADO (con versionamiento)
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
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """📊 Reporte completo de multas con versionamiento y filtros"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "reportes", "lectura")
    
    query = db.query(TipoMulta)
    
    # Filtros
    if fecha_desde:
        query = query.filter(TipoMulta.fecha_creacion >= fecha_desde)
    
    if fecha_hasta:
        query = query.filter(TipoMulta.fecha_creacion <= fecha_hasta)
    
    if estado:
        query = query.filter(TipoMulta.estado == estado)
    
    if tipo:
        query = query.filter(TipoMulta.tipo.ilike(f"%{tipo}%"))
    
    if activo is not None:
        query = query.filter(TipoMulta.activo == activo)
    
    if vigente is not None:
        query = query.filter(TipoMulta.es_vigente == vigente)
    
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
            "id_tipo_multa": m.id_tipo_multa,
            "nombre_multa": m.nombre_multa,
            "descripcion": m.descripcion,
            "monto": float(m.monto) if m.monto is not None else None,
            "fecha_creacion": m.fecha_creacion.strftime('%d/%m/%Y') if m.fecha_creacion else None,
            "vigencia_desde": m.vigencia_desde.strftime('%d/%m/%Y') if m.vigencia_desde else None,
            "vigencia_hasta": m.vigencia_hasta.strftime('%d/%m/%Y') if m.vigencia_hasta else None,
            "es_vigente": m.es_vigente,
            "activo": m.activo,
        }
        for m in multas
    ]
    
    return {
        "success": True,
        "data": multas_formateadas,
        "total": len(multas),
        "skip": skip,
        "limit": limit,
        "estadisticas": {
            "total_multas": len(multas),
            "total_vigentes": sum(1 for m in multas if m.es_vigente),
            "total_activos": sum(1 for m in multas if m.activo),
            "total_inactivos": sum(1 for m in multas if not m.activo)
        }
    }

# ============================================================================
# 11. REPORTE DE MULTAS AFILIADOS
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
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """📊 Reporte de multas asignadas a afiliados"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "reportes", "lectura")
    
    query = db.query(MultaAfiliado).options(
        joinedload(MultaAfiliado.tipo_multa),
        joinedload(MultaAfiliado.usuario)
    )
    
    # Filtros
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
    
    # Ordenar por fecha de multa descendente
    query = query.order_by(
        MultaAfiliado.fecha_multa.desc(),
        MultaAfiliado.id_multa_afi.desc()
    )
    
    # Aplicar paginación
    multas = query.offset(skip).limit(limit).all()
    
    # Formatear respuesta
    multas_formateadas = [
        {
            "nombre_afiliado": f"{m.usuario.usuario_sistema.nombres} {m.usuario.usuario_sistema.apellidos}" if m.usuario and m.usuario.usuario_sistema else "N/A",
            "nombre_multa": m.tipo_multa.nombre_multa if m.tipo_multa else "N/A",
            "monto": float(m.monto),
            "fecha_multa": m.fecha_multa.isoformat() if m.fecha_multa else None,
            "fecha_pago": m.fecha_pago.isoformat() if m.fecha_pago else None,
            "observaciones": m.observaciones,
            "estado": m.estado,
            "activo": m.activo,
        }
        for m in multas
    ]
    
    return {
        "success": True,
        "data": multas_formateadas,
        "total": len(multas),
        "skip": skip,
        "limit": limit,
        "estadisticas": {
            "total_multas": len(multas),
            "total_pendientes": sum(1 for m in multas if m.estado == 'pendiente'),
            "total_pagadas": sum(1 for m in multas if m.estado == 'pagada'),
            "total_facturadas": sum(1 for m in multas if m.facturado),
            "total_activas": sum(1 for m in multas if m.activo)
        }
    }


# ============================================================================
# 10. REPORTE DE TARIFAS
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
# 11. REPORTE DE SERVICIOS
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