"""
TITLE: routes/servicio_permanente.py
Endpoints para gestión de servicios permanentes en facturación
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
from datetime import date, datetime

from db.session import get_db
from models.meter import Medidor
from models.sector import Sector
from security.jwt import verify_token
from models.servicio_permanente import (
    ConfiguracionServicioPermanente,
    AsignacionServicioPermanente
)
from models.servicio import Servicio
from models.affiliate import UsuarioAfiliado
from models.user import UsuarioSistema
from models.role import RolAccion
from schemas.servicio_permanente import (
    ConfiguracionSPCreate,
    ConfiguracionSPUpdate,
    ConfiguracionSPResponse,
    ConfiguracionSPListResponse,
    ConfiguracionSPStats,
    AsignacionSPCreate,
    AsignacionSPCreateBulk,
    AsignacionSPUpdate,
    AsignacionSPResponse,
    AsignacionSPListResponse
)

router = APIRouter(prefix="/servicios-permanentes", tags=["Servicios Permanentes - Configuración"])


# ============================================================================
# FUNCIONES AUXILIARES (Auth y Permisos)
# ============================================================================

def get_current_user(payload: dict, db: Session) -> UsuarioSistema:
    """Obtiene el usuario actual desde el payload del JWT"""
    user = db.query(UsuarioSistema).filter(UsuarioSistema.usuario == payload["sub"]).first()
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
        perm_action = (permiso.tipo_accion or "").lower().strip()

        if perm_module != module:
            continue

        # Si tiene permisos CRUD completos
        if perm_action in ["crud", "operaciones crud"]:
            return True

        acciones_usuario.add(perm_action)

    if action is None:
        return bool(acciones_usuario)

    # Lectura incluye también crear, actualizar, eliminar
    if action in ["leer", "lectura"]:
        if any(a in acciones_usuario for a in ["lectura", "leer", "crear", "actualizar", "eliminar"]):
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
# FUNCIONES DE LÓGICA DE NEGOCIO
# ============================================================================

def obtener_configuracion_activa(db: Session) -> Optional[ConfiguracionServicioPermanente]:
    """
    Obtiene la configuración de servicio permanente activa actualmente.
    Solo puede haber una activa a la vez.
    """
    return db.query(ConfiguracionServicioPermanente).filter(
        ConfiguracionServicioPermanente.activo == True,
        ConfiguracionServicioPermanente.aplicar_servicio == True,
        ConfiguracionServicioPermanente.es_vigente == True
    ).first()


def enriquecer_configuracion_con_info(config: ConfiguracionServicioPermanente, db: Session) -> dict:
    """Agrega información adicional a una configuración"""
    config_dict = {
        "id_configuracion_sp": config.id_configuracion_sp,
        "nombre": config.nombre,
        "descripcion": config.descripcion,
        "aplicar_servicio": config.aplicar_servicio,
        "activo": config.activo,
        "id_servicio": config.id_servicio,
        "vigencia_desde": config.vigencia_desde,
        "vigencia_hasta": config.vigencia_hasta,
        "es_vigente": config.es_vigente,
        "aplicar_en_periodo": config.aplicar_en_periodo,
        "precio_override": float(config.precio_override) if config.precio_override else None,
        "observaciones": config.observaciones,
        "fecha_creacion": config.fecha_creacion
    }

    # Agregar info del servicio
    if config.servicio:
        config_dict["servicio_info"] = {
            "id_servicio": config.servicio.id_servicio,
            "nombre": config.servicio.nombre,
            "precio_base": float(config.servicio.precio_base),
            "activo": config.servicio.activo
        }

    # Contar asignaciones
    total_asignaciones = db.query(AsignacionServicioPermanente).filter(
        AsignacionServicioPermanente.id_configuracion_sp == config.id_configuracion_sp
    ).count()

    asignaciones_activas = db.query(AsignacionServicioPermanente).filter(
        AsignacionServicioPermanente.id_configuracion_sp == config.id_configuracion_sp,
        AsignacionServicioPermanente.activo == True
    ).count()

    config_dict["total_asignaciones"] = total_asignaciones
    config_dict["asignaciones_activas"] = asignaciones_activas

    return config_dict


# ============================================================================
# ENDPOINTS - CONFIGURACIÓN
# ============================================================================

@router.get("", response_model=List[ConfiguracionSPListResponse])
def listar_configuraciones(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    activo: Optional[bool] = Query(None, description="Filtrar por estado activo/inactivo"),
    es_vigente: Optional[bool] = Query(None, description="Filtrar por vigencia"),
    id_servicio: Optional[int] = Query(None, description="Filtrar por servicio"),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Lista todas las configuraciones de servicios permanentes con filtros opcionales.
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "configuracion", "lectura")

    query = db.query(ConfiguracionServicioPermanente)

    if activo is not None:
        query = query.filter(ConfiguracionServicioPermanente.activo == activo)
    if es_vigente is not None:
        query = query.filter(ConfiguracionServicioPermanente.es_vigente == es_vigente)
    if id_servicio:
        query = query.filter(ConfiguracionServicioPermanente.id_servicio == id_servicio)

    configuraciones = query.order_by(
        ConfiguracionServicioPermanente.activo.desc(),
        ConfiguracionServicioPermanente.es_vigente.desc(),
        ConfiguracionServicioPermanente.fecha_creacion.desc()
    ).offset(skip).limit(limit).all()

    # Enriquecer con contadores
    result = []
    for config in configuraciones:
        config_dict = config.__dict__.copy()
        
        # Contar asignaciones
        total_asignaciones = db.query(AsignacionServicioPermanente).filter(
            AsignacionServicioPermanente.id_configuracion_sp == config.id_configuracion_sp
        ).count()
        
        asignaciones_activas = db.query(AsignacionServicioPermanente).filter(
            AsignacionServicioPermanente.id_configuracion_sp == config.id_configuracion_sp,
            AsignacionServicioPermanente.activo == True
        ).count()
        
        config_dict["total_asignaciones"] = total_asignaciones
        config_dict["asignaciones_activas"] = asignaciones_activas
        
        result.append(ConfiguracionSPListResponse(**config_dict))

    return result


@router.get("/activa", response_model=Optional[ConfiguracionSPResponse])
def obtener_configuracion_activa_endpoint(
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Obtiene la configuración de servicio permanente activa actualmente.
    Esta es la que se aplicará automáticamente a las facturas.
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "configuracion", "lectura")

    config_activa = obtener_configuracion_activa(db)
    
    if not config_activa:
        return None
    
    return ConfiguracionSPResponse(**enriquecer_configuracion_con_info(config_activa, db))


@router.get("/stats", response_model=ConfiguracionSPStats)
def obtener_estadisticas(
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """Obtiene estadísticas sobre las configuraciones de servicios permanentes"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "configuracion", "lectura")

    total = db.query(ConfiguracionServicioPermanente).count()
    activos = db.query(ConfiguracionServicioPermanente).filter(ConfiguracionServicioPermanente.activo == True).count()
    inactivos = total - activos

    config_activa = obtener_configuracion_activa(db)
    config_activa_response = None
    if config_activa:
        config_activa_response = ConfiguracionSPResponse(**enriquecer_configuracion_con_info(config_activa, db))

    ultima = db.query(ConfiguracionServicioPermanente).order_by(
        ConfiguracionServicioPermanente.fecha_creacion.desc()
    ).first()

    total_asignaciones = db.query(AsignacionServicioPermanente).count()

    return ConfiguracionSPStats(
        total_registros=total,
        configuraciones_activas=activos,
        configuraciones_inactivas=inactivos,
        configuracion_activa_actual=config_activa_response,
        total_asignaciones_globales=total_asignaciones,
        ultima_creacion=ultima.fecha_creacion if ultima else None
    )

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
            "id_servicio": s.id_servicio,  # ✅ AGREGADO - Campo crítico
            "nombre": s.nombre,
            "descripcion": s.descripcion,
            "precio_base": float(s.precio_base) if s.precio_base else 0,
            "fecha_creacion": s.fecha_creacion.strftime('%d/%m/%Y') if s.fecha_creacion else None,
            "vigencia_desde": s.vigencia_desde.strftime('%d/%m/%Y') if s.vigencia_desde else None,
            "vigencia_hasta": s.vigencia_hasta.strftime('%d/%m/%Y') if s.vigencia_hasta else None,
            "es_vigente": s.es_vigente,  # ✅ CAMBIADO - Devuelve bool, no string
            "activo": s.activo
        }
        for s in servicios
    ]

# ============================================================================
# REPORTE DE AFILIADOS (OPTIMIZADO)
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
    
    # Query optimizado sin subconsultas innecesarias
    query = (
        db.query(
            UsuarioAfiliado.id_usuario_afi,
            UsuarioAfiliado.cod_usuario_afi,
            UsuarioAfiliado.num_medidor,
            UsuarioAfiliado.fecha_afiliacion,
            UsuarioAfiliado.activo,
            UsuarioAfiliado.id_sector,
            UsuarioSistema.nombres,
            UsuarioSistema.apellidos,
            UsuarioSistema.cedula,
            
            Sector.nombre_sector
        )
        .join(
            UsuarioSistema,
            UsuarioSistema.id_usuario_sistema == UsuarioAfiliado.id_usuario_sistema
        )
        .outerjoin(
            Sector,
            Sector.id_sector == UsuarioAfiliado.id_sector
        )
    )
    
    # Filtros
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                UsuarioSistema.nombres.ilike(search_term),
                UsuarioSistema.apellidos.ilike(search_term),
                UsuarioSistema.cedula.ilike(search_term),
                UsuarioAfiliado.cod_usuario_afi.ilike(search_term),
                UsuarioAfiliado.num_medidor.ilike(search_term),
                # busQUEDA POR SECTOR 
                Sector.nombre_sector.ilike(search_term)
            )
        )
    
    if sector:
        query = query.filter(UsuarioAfiliado.id_sector == sector)
    
    if estado == "activos":
        query = query.filter(UsuarioAfiliado.activo == True)
    elif estado == "inactivos":
        query = query.filter(UsuarioAfiliado.activo == False)
    
    if fecha_desde:
        query = query.filter(UsuarioAfiliado.fecha_afiliacion >= fecha_desde)
    
    if fecha_hasta:
        query = query.filter(UsuarioAfiliado.fecha_afiliacion <= fecha_hasta)
    
    # Ordenamiento
    query = query.order_by(
        UsuarioAfiliado.activo.desc(),
        UsuarioAfiliado.cod_usuario_afi.asc()
    )
    
    # Paginación
    results = query.offset(skip).limit(limit).all()
    
    return [
        {
            "id_usuario_afi": row.id_usuario_afi,
            "cod_usuario_afi": row.cod_usuario_afi,
            "num_medidor": row.num_medidor,
            "nombres": row.nombres,
            "apellidos": row.apellidos,
            "cedula": row.cedula,
            "id_sector": row.id_sector,
            "sector": row.nombre_sector,
            "fecha_afiliacion": row.fecha_afiliacion.strftime('%d/%m/%Y') if row.fecha_afiliacion else None,
            "activo": row.activo,
        }
        for row in results
    ]

# ============================================================================
# REPORTE DE SECTORES 
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
    
    # Ordenar por nombre
    query = query.order_by(Sector.nombre_sector.asc())
    
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
            "id_sector": s.id_sector,  # ✅ AGREGADO - Campo crítico
            "nombre_sector": s.nombre_sector,
            "descripcion": s.descripcion,
            "num_afiliados": afiliados_por_sector.get(s.id_sector, 0),  # ✅ Lowercase
            "num_medidores": medidores_por_sector.get(s.id_sector, 0),  # ✅ Lowercase
            "activo": s.activo
        }
        for s in sectores
    ]


@router.get("/{config_id}", response_model=ConfiguracionSPResponse)
def obtener_configuracion(
    config_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """Obtiene una configuración específica por ID"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "configuracion", "lectura")

    config = db.query(ConfiguracionServicioPermanente).filter(
        ConfiguracionServicioPermanente.id_configuracion_sp == config_id
    ).first()

    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuración no encontrada"
        )

    return ConfiguracionSPResponse(**enriquecer_configuracion_con_info(config, db))


@router.post("", response_model=ConfiguracionSPResponse, status_code=status.HTTP_201_CREATED)
def crear_configuracion(
    config_data: ConfiguracionSPCreate,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Crea una nueva configuración de servicio permanente.
    REGLAS:
    - Se crea como INACTIVA por defecto (activo=False)
    - Se debe activar manualmente después de crear
    - Debe validar que el servicio existe y está activo
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "configuracion", "crear")

    # Validar que el servicio existe
    servicio = db.query(Servicio).filter(Servicio.id_servicio == config_data.id_servicio).first()
    if not servicio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"El servicio con ID {config_data.id_servicio} no existe"
        )

    if not servicio.activo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El servicio '{servicio.nombre}' no está activo"
        )

    try:
        datos_config = config_data.model_dump()
        
        # FORZAR que se cree inactiva
        datos_config["activo"] = False
        datos_config["aplicar_servicio"] = False

        nueva_config = ConfiguracionServicioPermanente(**datos_config)
        db.add(nueva_config)
        db.commit()
        db.refresh(nueva_config)

        return ConfiguracionSPResponse(**enriquecer_configuracion_con_info(nueva_config, db))

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Error al crear configuración. Verifique los datos."
        )


@router.put("/{config_id}", response_model=ConfiguracionSPResponse)
def actualizar_configuracion(
    config_id: int,
    config_data: ConfiguracionSPUpdate,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Actualiza una configuración existente.
    REGLAS:
    - No permite activar directamente (usar endpoint /activar)
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "configuracion", "actualizar")

    config = db.query(ConfiguracionServicioPermanente).filter(
        ConfiguracionServicioPermanente.id_configuracion_sp == config_id
    ).first()

    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuración no encontrada"
        )

    datos_actualizacion = config_data.model_dump(exclude_unset=True)

    # Prevenir activación directa
    if "activo" in datos_actualizacion and datos_actualizacion["activo"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Para activar una configuración, use el endpoint /{config_id}/activar"
        )

    # Validar servicio si se está cambiando
    if "id_servicio" in datos_actualizacion:
        servicio = db.query(Servicio).filter(Servicio.id_servicio == datos_actualizacion["id_servicio"]).first()
        if not servicio:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"El servicio con ID {datos_actualizacion['id_servicio']} no existe"
            )

    # Actualizar campos
    for campo, valor in datos_actualizacion.items():
        setattr(config, campo, valor)

    try:
        db.commit()
        db.refresh(config)
        return ConfiguracionSPResponse(**enriquecer_configuracion_con_info(config, db))

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Error al actualizar: datos inválidos"
        )


@router.patch("/{config_id}/activar", response_model=dict)
def activar_configuracion(
    config_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Activa una configuración de servicio permanente.
    COMPORTAMIENTO:
    - Desactiva todas las demás configuraciones activas
    - Activa la configuración seleccionada
    - Solo puede haber UNA configuración activa a la vez
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "configuracion", "actualizar")

    config = db.query(ConfiguracionServicioPermanente).filter(
        ConfiguracionServicioPermanente.id_configuracion_sp == config_id
    ).first()

    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuración no encontrada"
        )

    if config.activo and config.aplicar_servicio:
        return {
            "mensaje": "La configuración ya está activa",
            "configuracion": ConfiguracionSPResponse(**enriquecer_configuracion_con_info(config, db)),
            "configs_desactivadas": 0
        }

    # Desactivar todas las demás
    configs_a_desactivar = db.query(ConfiguracionServicioPermanente).filter(
        ConfiguracionServicioPermanente.id_configuracion_sp != config_id,
        ConfiguracionServicioPermanente.activo == True
    ).all()

    cantidad_desactivadas = len(configs_a_desactivar)

    for c in configs_a_desactivar:
        c.activo = False
        c.aplicar_servicio = False

    # Activar la seleccionada
    config.activo = True
    config.aplicar_servicio = True

    try:
        db.commit()
        db.refresh(config)

        mensaje = f"Configuración '{config.nombre}' activada correctamente"
        if cantidad_desactivadas > 0:
            mensaje += f". Se desactivaron {cantidad_desactivadas} configuración(es)"

        return {
            "mensaje": mensaje,
            "configuracion": ConfiguracionSPResponse(**enriquecer_configuracion_con_info(config, db)),
            "configs_desactivadas": cantidad_desactivadas
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al activar configuración: {str(e)}"
        )


@router.patch("/{config_id}/desactivar", response_model=dict)
def desactivar_configuracion(
    config_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Desactiva una configuración de servicio permanente específica.
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "configuracion", "actualizar")

    config = db.query(ConfiguracionServicioPermanente).filter(
        ConfiguracionServicioPermanente.id_configuracion_sp == config_id
    ).first()

    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuración no encontrada"
        )

    if not config.activo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La configuración ya está inactiva"
        )

    config.activo = False
    config.aplicar_servicio = False

    try:
        db.commit()
        db.refresh(config)
        return {
            "mensaje": f"Configuración '{config.nombre}' desactivada correctamente",
            "configuracion": ConfiguracionSPResponse(**enriquecer_configuracion_con_info(config, db))
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al desactivar configuración: {str(e)}"
        )


@router.delete("/{config_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_configuracion(
    config_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Elimina una configuración de servicio permanente (eliminación física).
    RESTRICCIONES:
    - Eliminará en cascada todas las asignaciones asociadas
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "configuracion", "eliminar")

    config = db.query(ConfiguracionServicioPermanente).filter(
        ConfiguracionServicioPermanente.id_configuracion_sp == config_id
    ).first()

    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuración no encontrada"
        )

    try:
        db.delete(config)
        db.commit()
        return None

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede eliminar: error de integridad referencial"
        )


# ============================================================================
# ENDPOINTS - ASIGNACIONES
# ============================================================================
from sqlalchemy import cast, String

@router.get("/{config_id}/asignaciones")
def listar_asignaciones(
    config_id: int,
    activo: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """Lista todas las asignaciones de una configuración con datos completos del usuario"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "configuracion", "lectura")

    # Verificar que la configuración existe
    config = db.query(ConfiguracionServicioPermanente).filter(
        ConfiguracionServicioPermanente.id_configuracion_sp == config_id
    ).first()

    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuración no encontrada"
        )

    # Query optimizado seleccionando columnas específicas con joins
    query = (
        db.query(
            # Datos de la asignación
            AsignacionServicioPermanente.id_asignacion_sp,
            AsignacionServicioPermanente.id_configuracion_sp,
            AsignacionServicioPermanente.id_usuario_afi,
            AsignacionServicioPermanente.activo,
            AsignacionServicioPermanente.fecha_inicio,
            AsignacionServicioPermanente.fecha_fin,
            AsignacionServicioPermanente.fecha_asignacion,
            AsignacionServicioPermanente.asignado_por,
            AsignacionServicioPermanente.observaciones,
            
            # Datos del usuario afiliado
            UsuarioAfiliado.cod_usuario_afi,
            UsuarioAfiliado.num_medidor,
            
            # Datos del usuario sistema
            UsuarioSistema.nombres,
            UsuarioSistema.apellidos,
            UsuarioSistema.cedula,
            UsuarioSistema.telefono,
            
            # Datos del sector (opcional)
            Sector.nombre_sector
        )
        .join(
            UsuarioAfiliado,
            UsuarioAfiliado.id_usuario_afi == AsignacionServicioPermanente.id_usuario_afi
        )
        .outerjoin(
            UsuarioSistema,
            UsuarioSistema.id_usuario_sistema == UsuarioAfiliado.id_usuario_sistema
        )
        .outerjoin(
            Sector,
            Sector.id_sector == UsuarioAfiliado.id_sector
        )
        .filter(AsignacionServicioPermanente.id_configuracion_sp == config_id)
    )

    # Filtro de estado activo/inactivo
    if activo is not None:
        query = query.filter(AsignacionServicioPermanente.activo == activo)

    # Ordenamiento
    query = query.order_by(
        AsignacionServicioPermanente.activo.desc(),
        UsuarioSistema.apellidos.asc(),
        AsignacionServicioPermanente.fecha_asignacion.desc()
    )

    # Ejecución de query
    results = query.all()

    # Respuesta optimizada con datos completos
    return [
        {
            # Datos de asignación
            "id_asignacion_sp": row.id_asignacion_sp,
            "id_configuracion_sp": row.id_configuracion_sp,
            "id_usuario_afi": row.id_usuario_afi,
            "activo": row.activo,
            "fecha_inicio": row.fecha_inicio.isoformat() if row.fecha_inicio else None,
            "fecha_fin": row.fecha_fin.isoformat() if row.fecha_fin else None,
            "fecha_asignacion": row.fecha_asignacion.isoformat() if row.fecha_asignacion else None,
            "asignado_por": row.asignado_por,
            "observaciones": row.observaciones,
            
            # Datos del usuario afiliado
            "cod_usuario_afi": row.cod_usuario_afi,
            "num_medidor": row.num_medidor,
            
            # Datos del usuario sistema
            "nombres": row.nombres,
            "apellidos": row.apellidos,
            "cedula": row.cedula,
            "telefono": row.telefono,
            
            # Datos adicionales
            "nombre_sector": row.nombre_sector,
            "nombre_completo": f"{row.nombres} {row.apellidos}" if row.nombres and row.apellidos else None
        }
        for row in results
    ]



@router.post("/{config_id}/asignaciones", response_model=AsignacionSPResponse, status_code=status.HTTP_201_CREATED)
def crear_asignacion(
    config_id: int,
    asignacion_data: AsignacionSPCreate,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """Crea una nueva asignación de servicio permanente a un usuario"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "configuracion", "crear")

    # Verificar que la configuración existe
    config = db.query(ConfiguracionServicioPermanente).filter(
        ConfiguracionServicioPermanente.id_configuracion_sp == config_id
    ).first()

    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuración no encontrada"
        )

    # Verificar que el usuario existe
    usuario = db.query(UsuarioAfiliado).filter(
        UsuarioAfiliado.id_usuario_afi == asignacion_data.id_usuario_afi
    ).first()

    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Usuario afiliado con ID {asignacion_data.id_usuario_afi} no existe"
        )

    # Verificar si ya existe una asignación activa
    asignacion_existente = db.query(AsignacionServicioPermanente).filter(
        AsignacionServicioPermanente.id_configuracion_sp == config_id,
        AsignacionServicioPermanente.id_usuario_afi == asignacion_data.id_usuario_afi,
        AsignacionServicioPermanente.activo == True
    ).first()

    if asignacion_existente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El usuario ya tiene una asignación activa para esta configuración"
        )

    try:
        datos_asignacion = asignacion_data.model_dump()
        datos_asignacion["id_configuracion_sp"] = config_id
        datos_asignacion["asignado_por"] = current_user.id_usuario_sistema

        nueva_asignacion = AsignacionServicioPermanente(**datos_asignacion)
        db.add(nueva_asignacion)
        db.commit()
        db.refresh(nueva_asignacion)

        return nueva_asignacion

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Error al crear asignación"
        )


@router.post("/{config_id}/asignaciones/bulk", response_model=dict, status_code=status.HTTP_201_CREATED)
def crear_asignaciones_masivas(
    config_id: int,
    asignacion_data: AsignacionSPCreateBulk,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """Crea asignaciones masivas para múltiples usuarios"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "configuracion", "crear")

    # Verificar que la configuración existe
    config = db.query(ConfiguracionServicioPermanente).filter(
        ConfiguracionServicioPermanente.id_configuracion_sp == config_id
    ).first()

    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuración no encontrada"
        )

    # Verificar que todos los usuarios existen
    usuarios = db.query(UsuarioAfiliado).filter(
        UsuarioAfiliado.id_usuario_afi.in_(asignacion_data.ids_usuarios_afi)
    ).all()

    if len(usuarios) != len(asignacion_data.ids_usuarios_afi):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uno o más usuarios no existen"
        )

    creadas = 0
    omitidas = 0
    errores = []

    for id_usuario in asignacion_data.ids_usuarios_afi:
        # Verificar si ya existe asignación activa
        existe = db.query(AsignacionServicioPermanente).filter(
            AsignacionServicioPermanente.id_configuracion_sp == config_id,
            AsignacionServicioPermanente.id_usuario_afi == id_usuario,
            AsignacionServicioPermanente.activo == True
        ).first()

        if existe:
            omitidas += 1
            continue

        try:
            nueva_asignacion = AsignacionServicioPermanente(
                id_configuracion_sp=config_id,
                id_usuario_afi=id_usuario,
                activo=asignacion_data.activo,
                fecha_inicio=asignacion_data.fecha_inicio,
                fecha_fin=asignacion_data.fecha_fin,
                observaciones=asignacion_data.observaciones,
                asignado_por=current_user.id_usuario_sistema
            )
            db.add(nueva_asignacion)
            creadas += 1

        except Exception as e:
            errores.append(f"Usuario {id_usuario}: {str(e)}")

    try:
        db.commit()
        return {
            "mensaje": f"Proceso completado",
            "creadas": creadas,
            "omitidas": omitidas,
            "errores": errores
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear asignaciones: {str(e)}"
        )


@router.put("/{config_id}/asignaciones/{asignacion_id}", response_model=AsignacionSPResponse)
def actualizar_asignacion(
    config_id: int,
    asignacion_id: int,
    asignacion_data: AsignacionSPUpdate,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """Actualiza una asignación existente"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "configuracion", "actualizar")

    asignacion = db.query(AsignacionServicioPermanente).filter(
        AsignacionServicioPermanente.id_asignacion_sp == asignacion_id,
        AsignacionServicioPermanente.id_configuracion_sp == config_id
    ).first()

    if not asignacion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asignación no encontrada"
        )

    datos_actualizacion = asignacion_data.model_dump(exclude_unset=True)

    for campo, valor in datos_actualizacion.items():
        setattr(asignacion, campo, valor)

    try:
        db.commit()
        db.refresh(asignacion)
        return asignacion

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Error al actualizar asignación"
        )


@router.delete("/{config_id}/asignaciones/{asignacion_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_asignacion(
    config_id: int,
    asignacion_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """Elimina una asignación"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "configuracion", "eliminar")

    asignacion = db.query(AsignacionServicioPermanente).filter(
        AsignacionServicioPermanente.id_asignacion_sp == asignacion_id,
        AsignacionServicioPermanente.id_configuracion_sp == config_id
    ).first()

    if not asignacion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asignación no encontrada"
        )

    try:
        db.delete(asignacion)
        db.commit()
        return None

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede eliminar la asignación"
        )
