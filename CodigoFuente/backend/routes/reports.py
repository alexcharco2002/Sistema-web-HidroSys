# routes/reports.py
"""
Router centralizado para generación de reportes y estadísticas del sistema
Maneja todos los módulos de reportes de forma unificada
"""

from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, cast, String, func, extract
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
            "activo": r.activo,
            "total_usuarios": usuarios_por_rol.get(r.id_rol, 0),
            "total_modulos": len(modulos),
            "modulos": modulos  # Solo lista de nombres de módulos
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
            "activo": a.activo,
            "fecha_afiliacion": a.fecha_afiliacion.isoformat() if a.fecha_afiliacion else None
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
    sector: Optional[int] = None,
    activo: Optional[bool] = None,
    con_usuario: Optional[bool] = None,
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """📊 Reporte de medidores instalados"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "reportes", "lectura")
    
    # Query optimizado con joinedload para many-to-one
    query = db.query(Medidor).options(
        joinedload(Medidor.usuario_afiliado).joinedload(UsuarioAfiliado.usuario_sistema),
        joinedload(Medidor.sector)
    )
    
    # Filtros
    if search:
        query = query.filter(Medidor.num_medidor.ilike(f"%{search}%"))
    
    if sector:
        query = query.filter(Medidor.id_sector == sector)
    
    if activo is not None:
        query = query.filter(Medidor.activo == activo)
    
    # Filtro para medidores con/sin usuario asignado
    if con_usuario is not None:
        if con_usuario:
            query = query.filter(Medidor.id_usuario_afi.isnot(None))
        else:
            query = query.filter(Medidor.id_usuario_afi.is_(None))
    
    medidores = query.offset(skip).limit(limit).all()
    
    return [
        {
            "num_medidor": m.num_medidor,
            "latitud": float(m.latitud) if m.latitud else None,
            "longitud": float(m.longitud) if m.longitud else None,
            "altitud": float(m.altitud) if m.altitud else None,

            
            # Información del sector
            "sector": m.sector.nombre_sector if m.sector else None,
            
            # Información del afiliado
            "cod_usuario_afi": m.usuario_afiliado.cod_usuario_afi if m.usuario_afiliado else None,
            "nombre_afiliado": (
                f"{m.usuario_afiliado.usuario_sistema.nombres} {m.usuario_afiliado.usuario_sistema.apellidos}"
                if m.usuario_afiliado and m.usuario_afiliado.usuario_sistema
                else None
            ),
            "cedula": (
                m.usuario_afiliado.usuario_sistema.cedula
                if m.usuario_afiliado and m.usuario_afiliado.usuario_sistema
                else None
            ),
            "activo": m.activo,
        }
        for m in medidores
    ]

# ============================================================================
# 5. REPORTE DE SECTORES
# ============================================================================

from sqlalchemy import func

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
            "total_afiliados": afiliados_por_sector.get(s.id_sector, 0),
            "total_medidores": medidores_por_sector.get(s.id_sector, 0),
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
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    sector: Optional[str] = None,
    tipo_lectura: Optional[str] = None,
    lector_id: Optional[int] = None,
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """📊 Reporte de lecturas de consumo"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "reportes", "lectura")
    
    query = db.query(Lectura)
    
    if fecha_desde:
        query = query.filter(Lectura.fecha_lectura >= fecha_desde)
    
    if fecha_hasta:
        query = query.filter(Lectura.fecha_lectura <= fecha_hasta)
    
    if sector:
        query = query.join(Medidor).filter(Medidor.sector == sector)
    
    if tipo_lectura:
        query = query.filter(Lectura.tipo_lectura == tipo_lectura)
    
    if lector_id:
        query = query.filter(Lectura.lector_id == lector_id)
    
    query = query.order_by(Lectura.fecha_lectura.desc())
    lecturas = query.offset(skip).limit(limit).all()
    
    registrar_auditoria(
        db=db,
        usuario_id=current_user.id_usuario_sistema,
        accion="CONSULTA",
        tabla="reportes_lecturas",
        descripcion=f"Generó reporte de lecturas con {len(lecturas)} registros"
    )
    
    return [
        {
            "id_lectura": l.id_lectura,
            "medidor": l.medidor.numero_medidor if l.medidor else None,
            "lectura_anterior": l.lectura_anterior,
            "lectura_actual": l.lectura_actual,
            "consumo": l.consumo,
            "fecha_lectura": l.fecha_lectura.isoformat() if l.fecha_lectura else None,
            "tipo_lectura": l.tipo_lectura,
            "lector": f"{l.lector.nombres} {l.lector.apellidos}" if l.lector else None
        }
        for l in lecturas
    ]

# ============================================================================
# 7. REPORTE DE FACTURAS
# ============================================================================

@router.get("/facturas")
def get_reporte_facturas(
    skip: int = 0,
    limit: int = 1000,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    estado: Optional[str] = None,
    periodo: Optional[str] = None,
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """📊 Reporte de facturación"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "reportes", "lectura")
    
    query = db.query(Factura)
    
    if fecha_desde:
        query = query.filter(Factura.fecha_emision >= fecha_desde)
    
    if fecha_hasta:
        query = query.filter(Factura.fecha_emision <= fecha_hasta)
    
    if estado:
        query = query.filter(Factura.estado == estado)
    
    if periodo:
        query = query.filter(Factura.periodo == periodo)
    
    query = query.order_by(Factura.fecha_emision.desc())
    facturas = query.offset(skip).limit(limit).all()
    
    # Calcular estadísticas
    total_facturado = sum(f.total or 0 for f in facturas)
    total_pendiente = sum(f.total or 0 for f in facturas if f.estado == 'pendiente')
    
    registrar_auditoria(
        db=db,
        usuario_id=current_user.id_usuario_sistema,
        accion="CONSULTA",
        tabla="reportes_facturas",
        descripcion=f"Generó reporte de facturas con {len(facturas)} registros"
    )
    
    return {
        "facturas": [
            {
                "id_factura": f.id_factura,
                "numero_factura": f.numero_factura,
                "afiliado": f"{f.afiliado.nombres} {f.afiliado.apellidos}" if f.afiliado else None,
                "periodo": f.periodo,
                "consumo": f.consumo,
                "valor_consumo": f.valor_consumo,
                "otros_cargos": f.otros_cargos,
                "total": f.total,
                "estado": f.estado,
                "fecha_emision": f.fecha_emision.isoformat() if f.fecha_emision else None,
                "fecha_vencimiento": f.fecha_vencimiento.isoformat() if f.fecha_vencimiento else None
            }
            for f in facturas
        ],
        "estadisticas": {
            "total_facturas": len(facturas),
            "total_facturado": float(total_facturado),
            "total_pendiente": float(total_pendiente)
        }
    }

# ============================================================================
# 8. REPORTE DE PAGOS
# ============================================================================

@router.get("/pagos")
def get_reporte_pagos(
    skip: int = 0,
    limit: int = 1000,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    metodo_pago: Optional[str] = None,
    estado: Optional[str] = None,
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """📊 Reporte de pagos recibidos"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "reportes", "lectura")
    
    query = db.query(Pago)
    
    if fecha_desde:
        query = query.filter(Pago.fecha_pago >= fecha_desde)
    
    if fecha_hasta:
        query = query.filter(Pago.fecha_pago <= fecha_hasta)
    
    if metodo_pago:
        query = query.filter(Pago.metodo_pago == metodo_pago)
    
    if estado:
        query = query.filter(Pago.estado == estado)
    
    query = query.order_by(Pago.fecha_pago.desc())
    pagos = query.offset(skip).limit(limit).all()
    
    # Estadísticas
    total_recaudado = sum(p.monto or 0 for p in pagos)
    
    registrar_auditoria(
        db=db,
        usuario_id=current_user.id_usuario_sistema,
        accion="CONSULTA",
        tabla="reportes_pagos",
        descripcion=f"Generó reporte de pagos con {len(pagos)} registros"
    )
    
    return {
        "pagos": [
            {
                "id_pago": p.id_pago,
                "numero_comprobante": p.numero_comprobante,
                "afiliado": f"{p.afiliado.nombres} {p.afiliado.apellidos}" if p.afiliado else None,
                "factura": p.factura.numero_factura if p.factura else None,
                "monto": float(p.monto) if p.monto else 0,
                "metodo_pago": p.metodo_pago,
                "fecha_pago": p.fecha_pago.isoformat() if p.fecha_pago else None,
                "estado": p.estado
            }
            for p in pagos
        ],
        "estadisticas": {
            "total_pagos": len(pagos),
            "total_recaudado": float(total_recaudado)
        }
    }

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
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """📊 Reporte de multas generales"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "reportes", "lectura")
    
    query = db.query(TipoMulta)
    
    if fecha_desde:
        query = query.filter(TipoMulta.fecha_creacion >= fecha_desde)
    
    if fecha_hasta:
        query = query.filter(TipoMulta.fecha_creacion <= fecha_hasta)
    
    if estado:
        query = query.filter(TipoMulta.estado == estado)
    
    if tipo:
        query = query.filter(TipoMulta.tipo == tipo)
    
    multas = query.offset(skip).limit(limit).all()
    
    registrar_auditoria(
        db=db,
        usuario_id=current_user.id_usuario_sistema,
        accion="CONSULTA",
        tabla="reportes_multas",
        descripcion=f"Generó reporte de multas con {len(multas)} registros"
    )
    
    return [
        {
            "id_multa": m.id_multa,
            "nombre": m.nombre,
            "descripcion": m.descripcion,
            "monto": float(m.monto) if m.monto else 0,
            "tipo": m.tipo,
            "estado": m.estado,
            "fecha_creacion": m.fecha_creacion.isoformat() if m.fecha_creacion else None
        }
        for m in multas
    ]

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
    """📊 Reporte de tarifas con estadísticas"""
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
    
    # Calcular estadísticas (precio mínimo y máximo)
    if tarifas:
        precios = [float(t.precio_por_m3) for t in tarifas if t.precio_por_m3]
        precio_min = min(precios) if precios else 0
        precio_max = max(precios) if precios else 0
        precio_promedio = sum(precios) / len(precios) if precios else 0
    else:
        precio_min = precio_max = precio_promedio = 0
    
    return {
        "estadisticas": {
            "total": len(tarifas),
            "precio_minimo": round(precio_min, 2),
            "precio_maximo": round(precio_max, 2),
            "precio_promedio": round(precio_promedio, 2)
        },
        "tarifas": [
            {
                "id_tarifa": t.id_tarifa,
                "nombre": t.nombre,
                "detalle": t.detalle,
                "precio_por_m3": float(t.precio_por_m3) if t.precio_por_m3 else 0,
                "limite_min_m3": float(t.limite_min_m3) if t.limite_min_m3 else 0,
                "limite_max_m3": float(t.limite_max_m3) if t.limite_max_m3 else None,
                "tipo_tarifa": t.tipo_tarifa,
                "activo": t.activo,
                "es_vigente": t.es_vigente,
                "vigencia_desde": t.vigencia_desde.isoformat() if t.vigencia_desde else None,
                "vigencia_hasta": t.vigencia_hasta.isoformat() if t.vigencia_hasta else None
            }
            for t in tarifas
        ]
    }

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