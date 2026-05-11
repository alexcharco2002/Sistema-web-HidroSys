"""
TITLE: routes/mora.py
Endpoints para gestión de configuración de mora en facturación
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
from datetime import date, datetime

from db.session import get_db
from security.jwt import verify_token
from models.mora import ConfiguracionMora
from models.user import UsuarioSistema
from models.role import RolAccion
from schemas.mora import (
    ConfiguracionMoraCreate,
    ConfiguracionMoraUpdate,
    ConfiguracionMoraResponse,
    ConfiguracionMoraListResponse,
    ConfiguracionMoraStats
)

router = APIRouter(prefix="/mora", tags=["Mora - Configuración"])


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

def obtener_configuracion_vigente_activa(db: Session, fecha_referencia: date = None) -> Optional[ConfiguracionMora]:
    """
    Obtiene la configuración de mora vigente y activa para una fecha.
    Si no se especifica fecha, usa la fecha actual.
    """
    if fecha_referencia is None:
        fecha_referencia = date.today()
    
    return db.query(ConfiguracionMora).filter(
        ConfiguracionMora.activo == True,
        ConfiguracionMora.aplicar_mora == True,
        ConfiguracionMora.es_vigente == True,
        ConfiguracionMora.vigencia_desde <= fecha_referencia,
        (ConfiguracionMora.vigencia_hasta.is_(None)) | (ConfiguracionMora.vigencia_hasta >= fecha_referencia)
    ).first()


def validar_valores_tipo_calculo(tipo_calculo: str, porcentaje: float = None, valor_fijo: float = None, interes_diario: float = None):
    """Valida que los valores correspondan con el tipo de cálculo"""
    if tipo_calculo == 'porcentaje':
        if porcentaje is None or porcentaje <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Para tipo_calculo 'porcentaje' debe especificar porcentaje_mora mayor a 0"
            )
    elif tipo_calculo == 'fijo':
        if valor_fijo is None or valor_fijo <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Para tipo_calculo 'fijo' debe especificar valor_fijo mayor a 0"
            )
    elif tipo_calculo == 'interes_diario':
        if interes_diario is None or interes_diario <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Para tipo_calculo 'interes_diario' debe especificar interes_diario mayor a 0"
            )


# FUNCIÓN: Validar tipo_periodo
def validar_tipo_periodo(tipo_periodo: str, dias_gracia: int = None, meses_gracia: int = None):
    """Valida que los valores correspondan con el tipo de periodo"""
    if tipo_periodo == 'dias':
        if dias_gracia is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Para tipo_periodo 'dias' debe especificar dias_gracia"
            )
        if dias_gracia < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="dias_gracia no puede ser negativo"
            )
    elif tipo_periodo == 'meses':
        if meses_gracia is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Para tipo_periodo 'meses' debe especificar meses_gracia"
            )
        if meses_gracia < 0 or meses_gracia > 12:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="meses_gracia debe estar entre 0 y 12"
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="tipo_periodo debe ser 'dias' o 'meses'"
        )


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("", response_model=List[ConfiguracionMoraListResponse])
def listar_configuraciones(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    activo: Optional[bool] = Query(None, description="Filtrar por estado activo/inactivo"),
    es_vigente: Optional[bool] = Query(None, description="Filtrar por vigencia"),
    tipo_calculo: Optional[str] = Query(None, description="Filtrar por tipo de cálculo"),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Lista todas las configuraciones de mora con filtros opcionales.
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "configuracion", "lectura")
    
    query = db.query(ConfiguracionMora)
    
    if activo is not None:
        query = query.filter(ConfiguracionMora.activo == activo)
    
    if es_vigente is not None:
        query = query.filter(ConfiguracionMora.es_vigente == es_vigente)
    
    if tipo_calculo:
        query = query.filter(ConfiguracionMora.tipo_calculo == tipo_calculo)
    
    configuraciones = query.order_by(
        ConfiguracionMora.es_vigente.desc(),
        ConfiguracionMora.activo.desc(),
        ConfiguracionMora.fecha_creacion.desc()
    ).offset(skip).limit(limit).all()
    
    return configuraciones


@router.get("/vigente", response_model=Optional[ConfiguracionMoraResponse])
def obtener_configuracion_vigente(
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Obtiene la configuración de mora vigente y activa actualmente.
    Esta es la que se aplicará a las facturas vencidas.
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "configuracion", "lectura")
    
    config_vigente = obtener_configuracion_vigente_activa(db)
    return config_vigente


@router.get("/stats", response_model=ConfiguracionMoraStats)
def obtener_estadisticas(
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """Obtiene estadísticas sobre las configuraciones de mora"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "configuracion", "lectura")
    
    total = db.query(ConfiguracionMora).count()
    activos = db.query(ConfiguracionMora).filter(ConfiguracionMora.activo == True).count()
    inactivos = total - activos
    
    config_vigente = obtener_configuracion_vigente_activa(db)
    
    ultima = db.query(ConfiguracionMora).order_by(
        ConfiguracionMora.fecha_creacion.desc()
    ).first()
    
    return ConfiguracionMoraStats(
        total_registros=total,
        configuraciones_activas=activos,
        configuraciones_inactivas=inactivos,
        configuracion_vigente_actual=config_vigente,
        ultima_creacion=ultima.fecha_creacion if ultima else None
    )


@router.get("/{config_id}", response_model=ConfiguracionMoraResponse)
def obtener_configuracion(
    config_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """Obtiene una configuración de mora específica por ID"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "configuracion", "lectura")
    
    config = db.query(ConfiguracionMora).filter(
        ConfiguracionMora.id_configuracion_mora == config_id
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuración de mora no encontrada"
        )
    
    return config


@router.post("", response_model=ConfiguracionMoraResponse, status_code=status.HTTP_201_CREATED)
def crear_configuracion(
    config_data: ConfiguracionMoraCreate,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Crea una nueva configuración de mora.
    REGLAS:
    - Debe especificar el valor correcto según tipo_calculo
    - Debe especificar el campo correcto según tipo_periodo (dias_gracia o meses_gracia)
    - Se crea como INACTIVA por defecto (activo=False)
    - Se debe activar manualmente después de crear
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "configuracion", "crear")

    # Validar tipo_periodo y valores
    validar_tipo_periodo(
        config_data.tipo_periodo,
        config_data.dias_gracia,
        config_data.meses_gracia
    )

    # Validar que los valores correspondan con el tipo de cálculo
    validar_valores_tipo_calculo(
        config_data.tipo_calculo,
        config_data.porcentaje_mora,
        config_data.valor_fijo,
        config_data.interes_diario
    )

    # Validar fechas de vigencia
    if config_data.vigencia_hasta and config_data.vigencia_hasta < config_data.vigencia_desde:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La fecha vigencia_hasta debe ser posterior a vigencia_desde"
        )

    try:
        datos_config = config_data.model_dump()
        
        #  Limpiar campos no usados según tipo_periodo
        if config_data.tipo_periodo == 'dias':
            datos_config['meses_gracia'] = 0
        else:  # tipo_periodo == 'meses'
            datos_config['dias_gracia'] = 0
        
        # FORZAR que se cree inactiva
        datos_config["activo"] = False
        datos_config["aplicar_mora"] = False

        nueva_config = ConfiguracionMora(**datos_config)
        db.add(nueva_config)
        db.commit()
        db.refresh(nueva_config)
        return nueva_config

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Error al crear configuración. Verifique los datos."
        )


@router.put("/{config_id}", response_model=ConfiguracionMoraResponse)
def actualizar_configuracion(
    config_id: int,
    config_data: ConfiguracionMoraUpdate,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Actualiza una configuración de mora existente.
    REGLAS:
    - No permite activar directamente (usar endpoint /activar)
    - Valida coherencia entre tipo_calculo y valores
    - Valida coherencia entre tipo_periodo y valores
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "configuracion", "actualizar")

    config = db.query(ConfiguracionMora).filter(
        ConfiguracionMora.id_configuracion_mora == config_id
    ).first()

    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuración de mora no encontrada"
        )

    datos_actualizacion = config_data.model_dump(exclude_unset=True)

    # Prevenir activación directa
    if "activo" in datos_actualizacion and datos_actualizacion["activo"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Para activar una configuración, use el endpoint /{config_id}/activar"
        )

    # Validar tipo_periodo si se está cambiando
    if "tipo_periodo" in datos_actualizacion:
        tipo_nuevo = datos_actualizacion["tipo_periodo"]
        dias = datos_actualizacion.get("dias_gracia", config.dias_gracia)
        meses = datos_actualizacion.get("meses_gracia", config.meses_gracia)
        validar_tipo_periodo(tipo_nuevo, dias, meses)
        
        # Limpiar campos no usados según tipo_periodo
        if tipo_nuevo == 'dias':
            datos_actualizacion['meses_gracia'] = 0
        else:  # tipo_periodo == 'meses'
            datos_actualizacion['dias_gracia'] = 0

    # Validar tipo_calculo si se está cambiando
    if "tipo_calculo" in datos_actualizacion:
        tipo_nuevo = datos_actualizacion["tipo_calculo"]
        porcentaje = datos_actualizacion.get("porcentaje_mora", config.porcentaje_mora)
        valor_fijo = datos_actualizacion.get("valor_fijo", config.valor_fijo)
        interes = datos_actualizacion.get("interes_diario", config.interes_diario)
        validar_valores_tipo_calculo(tipo_nuevo, porcentaje, valor_fijo, interes)

    # Validar fechas de vigencia
    if "vigencia_hasta" in datos_actualizacion or "vigencia_desde" in datos_actualizacion:
        vigencia_desde = datos_actualizacion.get("vigencia_desde", config.vigencia_desde)
        vigencia_hasta = datos_actualizacion.get("vigencia_hasta", config.vigencia_hasta)
        if vigencia_hasta and vigencia_hasta < vigencia_desde:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La fecha vigencia_hasta debe ser posterior a vigencia_desde"
            )

    # Actualizar campos
    for campo, valor in datos_actualizacion.items():
        setattr(config, campo, valor)

    try:
        db.commit()
        db.refresh(config)
        return config
    except IntegrityError as e:
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
    Activa una configuración de mora.
    
    COMPORTAMIENTO:
    - Desactiva todas las demás configuraciones activas
    - Activa la configuración seleccionada
    - Solo puede haber UNA configuración activa a la vez
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "configuracion", "actualizar")
    
    config = db.query(ConfiguracionMora).filter(
        ConfiguracionMora.id_configuracion_mora == config_id
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuración de mora no encontrada"
        )
    
    validar_tipo_periodo(config.tipo_periodo, config.dias_gracia, config.meses_gracia)
    validar_valores_tipo_calculo(
        config.tipo_calculo,
        config.porcentaje_mora,
        config.valor_fijo,
        config.interes_diario
    )
    if config.vigencia_hasta and config.vigencia_hasta < config.vigencia_desde:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La fecha vigencia_hasta debe ser posterior a vigencia_desde"
        )

    if config.activo and config.aplicar_mora:
        return {
            "mensaje": "La configuración ya está activa",
            "configuracion": ConfiguracionMoraResponse.model_validate(config),
            "configs_desactivadas": 0
        }
    
    # Desactivar todas las demás
    configs_a_desactivar = db.query(ConfiguracionMora).filter(
        ConfiguracionMora.id_configuracion_mora != config_id,
        ConfiguracionMora.activo == True
    ).all()
    
    cantidad_desactivadas = len(configs_a_desactivar)
    
    for c in configs_a_desactivar:
        c.activo = False
        c.aplicar_mora = False
    
    # Activar la seleccionada
    config.activo = True
    config.aplicar_mora = True
    
    try:
        db.commit()
        db.refresh(config)
        
        mensaje = f"Configuración '{config.nombre}' activada correctamente"
        if cantidad_desactivadas > 0:
            mensaje += f". Se desactivaron {cantidad_desactivadas} configuración(es)"
        
        return {
            "mensaje": mensaje,
            "configuracion": ConfiguracionMoraResponse.model_validate(config),
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
    Desactiva una configuración de mora específica.
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "configuracion", "actualizar")
    
    config = db.query(ConfiguracionMora).filter(
        ConfiguracionMora.id_configuracion_mora == config_id
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuración de mora no encontrada"
        )
    
    if not config.activo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La configuración ya está inactiva"
        )
    
    config.activo = False
    config.aplicar_mora = False
    
    try:
        db.commit()
        db.refresh(config)
        
        return {
            "mensaje": f"Configuración '{config.nombre}' desactivada correctamente",
            "configuracion": ConfiguracionMoraResponse.model_validate(config)
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
    Elimina una configuración de mora (eliminación física).
    
    RESTRICCIONES:
    - No se puede eliminar si tiene moras aplicadas asociadas
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "configuracion", "eliminar")
    
    config = db.query(ConfiguracionMora).filter(
        ConfiguracionMora.id_configuracion_mora == config_id
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuración de mora no encontrada"
        )
    
    try:
        db.delete(config)
        db.commit()
        return None
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede eliminar: existen moras aplicadas que usan esta configuración"
        )
