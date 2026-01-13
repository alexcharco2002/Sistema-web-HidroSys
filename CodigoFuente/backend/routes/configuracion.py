# routes/configuracion.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from models.configuracion import ConfiguracionSistema
from models.user import UsuarioSistema
from models.role import Rol
from schemas.configuracion import (
    ConfiguracionResponse,
    ConfiguracionUpdate,
    ConfiguracionCreate,
    ConfiguracionValorResponse
)
from db.session import SessionLocal
from security.jwt import verify_token
from utils.config import config_manager

router = APIRouter(prefix="/configuracion", tags=["configuracion"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def verificar_es_admin(payload: dict, db: Session):
    """Verifica que el usuario sea administrador"""
    db_user = db.query(UsuarioSistema).filter(
        UsuarioSistema.usuario == payload["sub"]
    ).first()
    
    if not db_user or not db_user.id_rol:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No autorizado"
        )
    
    rol = db.query(Rol).filter(
        Rol.id_rol == db_user.id_rol,
        Rol.nombre_rol == "administrador"
    ).first()
    
    if not rol:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requieren permisos de administrador"
        )
    
    return db_user


# ========================================
# OBTENER CONFIGURACIONES
# ========================================

@router.get("/todas", response_model=List[ConfiguracionResponse])
def get_todas_configuraciones(
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Obtiene todas las configuraciones del sistema - Solo Admin"""
    verificar_es_admin(payload, db)
    
    configs = db.query(ConfiguracionSistema).filter(
        ConfiguracionSistema.activo == True
    ).order_by(ConfiguracionSistema.categoria, ConfiguracionSistema.clave).all()
    
    return configs


@router.get("/categoria/{categoria}", response_model=List[ConfiguracionResponse])
def get_configuraciones_por_categoria(
    categoria: str,
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Obtiene configuraciones de una categoría específica - Solo Admin"""
    verificar_es_admin(payload, db)
    
    configs = db.query(ConfiguracionSistema).filter(
        ConfiguracionSistema.categoria == categoria,
        ConfiguracionSistema.activo == True
    ).order_by(ConfiguracionSistema.clave).all()
    
    return configs


@router.get("/clave/{clave}", response_model=ConfiguracionValorResponse)
def get_configuracion_por_clave(
    clave: str,
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Obtiene una configuración específica por su clave"""
    config = db.query(ConfiguracionSistema).filter(
        ConfiguracionSistema.clave == clave,
        ConfiguracionSistema.activo == True
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Configuración '{clave}' no encontrada"
        )
    
    return {
        "clave": config.clave,
        "valor": config.valor,
        "valor_tipado": config.get_valor_tipado()
    }


@router.get("/categorias")
def get_categorias(
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Obtiene todas las categorías de configuración disponibles"""
    verificar_es_admin(payload, db)
    
    from sqlalchemy import distinct
    
    categorias = db.query(
        distinct(ConfiguracionSistema.categoria)
    ).filter(
        ConfiguracionSistema.activo == True
    ).all()
    
    return {
        "success": True,
        "categorias": [cat[0] for cat in categorias]
    }


# ========================================
# ACTUALIZAR CONFIGURACIONES
# ========================================

@router.put("/{id_configuracion}", response_model=ConfiguracionResponse)
def actualizar_configuracion(
    id_configuracion: int,
    config_update: ConfiguracionUpdate,
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Actualiza una configuración - Solo Admin"""
    db_user = verificar_es_admin(payload, db)
    
    config = db.query(ConfiguracionSistema).filter(
        ConfiguracionSistema.id_configuracion == id_configuracion
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuración no encontrada"
        )
    
    if not config.modificable:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Esta configuración no es modificable"
        )
    
    # Actualizar campos
    update_data = config_update.model_dump(exclude_unset=True)
    
    # Validar tipo de dato si se actualiza el valor
    if 'valor' in update_data:
        try:
            if config.tipo_dato == 'int':
                int(update_data['valor'])
            elif config.tipo_dato == 'float':
                float(update_data['valor'])
            elif config.tipo_dato == 'boolean':
                if update_data['valor'].lower() not in ('true', 'false', '1', '0', 'yes', 'no', 'si', 'sí'):
                    raise ValueError("Valor booleano inválido")
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Valor inválido para tipo de dato '{config.tipo_dato}': {str(e)}"
            )
    
    # Registrar quién modificó
    update_data['modificado_por'] = db_user.usuario
    
    for field, value in update_data.items():
        setattr(config, field, value)
    
    db.commit()
    db.refresh(config)
    
    # Limpiar caché
    config_manager.clear_cache()
    
    return config


@router.put("/clave/{clave}/valor")
def actualizar_valor_por_clave(
    clave: str,
    request: dict,
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Actualiza el valor de una configuración por su clave - Solo Admin"""
    db_user = verificar_es_admin(payload, db)
    
    nuevo_valor = request.get("valor")
    if nuevo_valor is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El campo 'valor' es requerido"
        )
    
    config = db.query(ConfiguracionSistema).filter(
        ConfiguracionSistema.clave == clave
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Configuración '{clave}' no encontrada"
        )
    
    if not config.modificable:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Esta configuración no es modificable"
        )
    
    # Validar tipo de dato
    try:
        if config.tipo_dato == 'int':
            int(nuevo_valor)
        elif config.tipo_dato == 'float':
            float(nuevo_valor)
        elif config.tipo_dato == 'boolean':
            if str(nuevo_valor).lower() not in ('true', 'false', '1', '0', 'yes', 'no', 'si', 'sí'):
                raise ValueError("Valor booleano inválido")
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Valor inválido para tipo de dato '{config.tipo_dato}': {str(e)}"
        )
    
    config.valor = str(nuevo_valor)
    config.modificado_por = db_user.usuario
    
    db.commit()
    db.refresh(config)
    
    # Limpiar caché
    config_manager.clear_cache()
    
    return {
        "success": True,
        "message": f"Configuración '{clave}' actualizada correctamente",
        "clave": config.clave,
        "valor_anterior": request.get("valor_anterior"),
        "valor_nuevo": config.valor,
        "valor_tipado": config.get_valor_tipado()
    }


# ========================================
# CREAR CONFIGURACIONES
# ========================================

@router.post("/", response_model=ConfiguracionResponse, status_code=status.HTTP_201_CREATED)
def crear_configuracion(
    config_create: ConfiguracionCreate,
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Crea una nueva configuración - Solo Admin"""
    db_user = verificar_es_admin(payload, db)
    
    # Verificar que no exista
    existing = db.query(ConfiguracionSistema).filter(
        ConfiguracionSistema.clave == config_create.clave
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ya existe una configuración con la clave '{config_create.clave}'"
        )
    
    # Validar valor según tipo de dato
    try:
        if config_create.tipo_dato == 'int':
            int(config_create.valor)
        elif config_create.tipo_dato == 'float':
            float(config_create.valor)
        elif config_create.tipo_dato == 'boolean':
            if config_create.valor.lower() not in ('true', 'false', '1', '0', 'yes', 'no', 'si', 'sí'):
                raise ValueError("Valor booleano inválido")
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Valor inválido para tipo de dato '{config_create.tipo_dato}': {str(e)}"
        )
    
    # Crear configuración
    nueva_config = ConfiguracionSistema(
        **config_create.model_dump(),
        modificado_por=db_user.usuario
    )
    
    db.add(nueva_config)
    db.commit()
    db.refresh(nueva_config)
    
    # Limpiar caché
    config_manager.clear_cache()
    
    return nueva_config


# ========================================
# ELIMINAR (DESACTIVAR) CONFIGURACIONES
# ========================================

@router.delete("/{id_configuracion}")
def desactivar_configuracion(
    id_configuracion: int,
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Desactiva una configuración (soft delete) - Solo Admin"""
    db_user = verificar_es_admin(payload, db)
    
    config = db.query(ConfiguracionSistema).filter(
        ConfiguracionSistema.id_configuracion == id_configuracion
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuración no encontrada"
        )
    
    if not config.modificable:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Esta configuración no puede ser eliminada"
        )
    
    config.activo = False
    config.modificado_por = db_user.usuario
    
    db.commit()
    
    # Limpiar caché
    config_manager.clear_cache()
    
    return {
        "success": True,
        "message": f"Configuración '{config.clave}' desactivada correctamente"
    }


# ========================================
# LIMPIAR CACHÉ
# ========================================

@router.post("/cache/clear")
def limpiar_cache(
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Limpia el caché de configuraciones - Solo Admin"""
    verificar_es_admin(payload, db)
    
    config_manager.clear_cache()
    
    return {
        "success": True,
        "message": "Caché de configuraciones limpiado correctamente"
    }