# routes/limite_geografico.py

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Optional

import unicodedata
import re

from db.session import SessionLocal
from security.jwt import verify_token
from models.limite_geografico import LimiteGeografico
from models.user import UsuarioSistema
from models.role import RolAccion
from schemas.limite_geografico import (
    LimiteGeograficoCreate,
    LimiteGeograficoUpdate,
    LimiteGeograficoResponse,
    CoordenadaValidacion,
    CoordenadaValidacionResponse
)

router = APIRouter(
    prefix="/limites-geograficos",
    tags=["Límites Geográficos"]
)


# ============================================================================
# DEPENDENCIAS
# ============================================================================

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
    """
    Verifica si el usuario tiene permiso para una acción.
    """
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

def normalize_text(text: str) -> str:
    """Normaliza texto para comparación"""
    if not text:
        return ""
    text = text.lower().strip()
    text = ''.join(
        c for c in unicodedata.normalize('NFD', text)
        if unicodedata.category(c) != 'Mn'
    )
    text = re.sub(r"\s+", " ", text)
    return text


def construir_poligono_geojson(norte, sur, este, oeste) -> dict:
    """Construye un poligono GeoJSON rectangular desde los limites cardinales."""
    norte = float(norte)
    sur = float(sur)
    este = float(este)
    oeste = float(oeste)

    return {
        "type": "Polygon",
        "coordinates": [[
            [oeste, norte],
            [este, norte],
            [este, sur],
            [oeste, sur],
            [oeste, norte],
        ]]
    }


def validar_limites_cardinales(norte, sur, este, oeste):
    if norte <= sur:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El limite norte debe ser mayor que el limite sur"
        )

    if este <= oeste:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El limite este debe ser mayor que el limite oeste"
        )


def validar_rango_altitud(altitud_min, altitud_max):
    if (
        altitud_min is not None and
        altitud_max is not None and
        altitud_max <= altitud_min
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La altitud maxima debe ser mayor que la altitud minima"
        )
# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("/", response_model=List[LimiteGeograficoResponse])
def listar_limites(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    activo: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """Lista todos los límites geográficos con filtros opcionales"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "configuracion", "lectura")
    
    query = db.query(LimiteGeografico)
    
    if activo is not None:
        query = query.filter(LimiteGeografico.activo == activo)
    
    limites = query.offset(skip).limit(limit).all()
    return limites


@router.get("/activo", response_model=Optional[LimiteGeograficoResponse])
def obtener_limite_activo(
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """Obtiene el límite geográfico actualmente activo"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "configuracion", "lectura")
    
    limite = db.query(LimiteGeografico).filter(
        LimiteGeografico.activo == True
    ).first()
    
    return limite


@router.get("/{limite_id}", response_model=LimiteGeograficoResponse)
def obtener_limite(
    limite_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """Obtiene un límite geográfico por ID"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "configuracion", "lectura")
    
    limite = db.query(LimiteGeografico).filter(
        LimiteGeografico.id == limite_id
    ).first()
    
    if not limite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Límite geográfico no encontrado"
        )
    
    return limite


@router.post("/", response_model=LimiteGeograficoResponse, status_code=status.HTTP_201_CREATED)
def crear_limite(
    limite_data: LimiteGeograficoCreate,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Crea un nuevo límite geográfico.
    Si no hay límites activos, el nuevo se crea activo.
    Si ya existe uno activo, el nuevo se crea inactivo.
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "configuracion", "crear")
    
    # Normalizar el nombre para verificar duplicados
    nombre_normalizado = normalize_text(limite_data.nombre)
    
    # Verificar si ya existe un límite con nombre similar
    limites_existentes = db.query(LimiteGeografico).all()
    for limite in limites_existentes:
        if normalize_text(limite.nombre) == nombre_normalizado:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ya existe un límite con un nombre similar a '{limite_data.nombre}'"
            )
    
    try:
        # Verificar si existe algún límite activo
        limite_activo_existe = db.query(LimiteGeografico).filter(
            LimiteGeografico.activo == True
        ).first()
        
        # Crear el nuevo límite
        datos_limite = limite_data.model_dump()

        if datos_limite.get('poligono_geojson') is None:
            datos_limite['poligono_geojson'] = construir_poligono_geojson(
                datos_limite['norte'],
                datos_limite['sur'],
                datos_limite['este'],
                datos_limite['oeste']
            )
        
        # Limpiar espacios del nombre original (mantener capitalización)
        datos_limite['nombre'] = limite_data.nombre.strip()
        
        # Si no hay límites activos, activar este automáticamente
        if not limite_activo_existe:
            datos_limite['activo'] = True
        else:
            # Si ya existe uno activo, crear este desactivado
            datos_limite['activo'] = False
        
        nuevo_limite = LimiteGeografico(**datos_limite)
        db.add(nuevo_limite)
        db.commit()
        db.refresh(nuevo_limite)
        
        return nuevo_limite
        
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ya existe un límite con el nombre '{limite_data.nombre}'"
        )


@router.put("/{limite_id}", response_model=LimiteGeograficoResponse)
def actualizar_limite(
    limite_id: int,
    limite_data: LimiteGeograficoUpdate,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Actualiza un límite geográfico existente.
    Si se intenta activar, desactiva automáticamente los demás.
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "configuracion", "actualizar")
    
    limite = db.query(LimiteGeografico).filter(
        LimiteGeografico.id == limite_id
    ).first()
    
    if not limite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Límite geográfico no encontrado"
        )
    
    # Obtener los datos a actualizar
    datos_actualizacion = limite_data.model_dump(exclude_unset=True)
    campos_limite = {'norte', 'sur', 'este', 'oeste'}
    
    # Verificar nombre duplicado si se está actualizando el nombre
    if 'nombre' in datos_actualizacion:
        nombre_nuevo = datos_actualizacion['nombre'].strip()
        nombre_normalizado = normalize_text(nombre_nuevo)
        
        # Verificar contra todos los límites excepto el actual
        limites_existentes = db.query(LimiteGeografico).filter(
            LimiteGeografico.id != limite_id
        ).all()
        
        for lim in limites_existentes:
            if normalize_text(lim.nombre) == nombre_normalizado:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Ya existe un límite con un nombre similar a '{nombre_nuevo}'"
                )
        
        # Actualizar con nombre limpio
        datos_actualizacion['nombre'] = nombre_nuevo
    
    # Si se está intentando activar este límite
    if datos_actualizacion.get('activo') == True:
        # Desactivar todos los demás límites
        db.query(LimiteGeografico).filter(
            LimiteGeografico.id != limite_id
        ).update({LimiteGeografico.activo: False})

    norte_final = datos_actualizacion.get('norte', limite.norte)
    sur_final = datos_actualizacion.get('sur', limite.sur)
    este_final = datos_actualizacion.get('este', limite.este)
    oeste_final = datos_actualizacion.get('oeste', limite.oeste)
    altitud_min_final = datos_actualizacion.get('altitud_min', limite.altitud_min)
    altitud_max_final = datos_actualizacion.get('altitud_max', limite.altitud_max)

    validar_limites_cardinales(norte_final, sur_final, este_final, oeste_final)
    validar_rango_altitud(altitud_min_final, altitud_max_final)

    if campos_limite.intersection(datos_actualizacion):
        datos_actualizacion['poligono_geojson'] = construir_poligono_geojson(
            norte_final,
            sur_final,
            este_final,
            oeste_final
        )
    
    # Actualizar los campos del límite
    for campo, valor in datos_actualizacion.items():
        setattr(limite, campo, valor)
    
    try:
        db.commit()
        db.refresh(limite)
        return limite
        
    except IntegrityError as e:
        db.rollback()
        # Identificar si es error de nombre duplicado
        if 'nombre' in str(e.orig):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ya existe un límite con el nombre '{datos_actualizacion.get('nombre', '')}'"
            )
        # Error de altitudes
        elif 'altitud' in str(e.orig):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La altitud mínima debe ser menor o igual a la altitud máxima"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Error al actualizar: datos inválidos"
            )

@router.delete("/{limite_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_limite(
    limite_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """Elimina un límite geográfico"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "configuracion", "eliminar")
    
    limite = db.query(LimiteGeografico).filter(
        LimiteGeografico.id == limite_id
    ).first()
    
    if not limite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Límite geográfico no encontrado"
        )
    
    db.delete(limite)
    db.commit()
    return None


@router.post("/{limite_id}/activar", response_model=LimiteGeograficoResponse)
def activar_limite(
    limite_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Activa un límite geográfico y desactiva todos los demás.
    Solo puede haber un límite activo a la vez.
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "configuracion", "actualizar")
    
    # Desactivar todos los límites
    db.query(LimiteGeografico).update({LimiteGeografico.activo: False})
    
    # Activar el límite seleccionado
    limite = db.query(LimiteGeografico).filter(
        LimiteGeografico.id == limite_id
    ).first()
    
    if not limite:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Límite geográfico no encontrado"
        )
    
    limite.activo = True
    db.commit()
    db.refresh(limite)
    return limite


@router.post("/validar-coordenadas", response_model=CoordenadaValidacionResponse)
def validar_coordenadas(
    coordenada: CoordenadaValidacion,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Valida si unas coordenadas están dentro del límite geográfico activo.
    Incluye validación de altitud si se proporciona.
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "configuracion", "lectura")
    
    # Obtener límite activo
    limite_activo = db.query(LimiteGeografico).filter(
        LimiteGeografico.activo == True
    ).first()
    
    if not limite_activo:
        # Si no hay límite activo, permitir cualquier coordenada
        return CoordenadaValidacionResponse(
            valida=True,
            latitud=coordenada.latitud,
            longitud=coordenada.longitud,
            altitud=coordenada.altitud,
            limite_aplicado=None,
            mensaje="Coordenadas válidas (no hay límite geográfico configurado)"
        )
    
    # Validar coordenadas geográficas
    es_valida = limite_activo.contiene_coordenada(
        float(coordenada.latitud),
        float(coordenada.longitud)
    )
    
    # Validar altitud si se proporciona
    if es_valida and coordenada.altitud is not None:
        es_valida = limite_activo.contiene_altitud(float(coordenada.altitud))
        if not es_valida:
            mensaje = f"Coordenadas fuera del rango de altitud del límite '{limite_activo.nombre}'"
        else:
            mensaje = f"Coordenadas válidas (incluida altitud) dentro del límite '{limite_activo.nombre}'"
    else:
        mensaje = (
            f"Coordenadas válidas dentro del límite '{limite_activo.nombre}'" 
            if es_valida 
            else f"Coordenadas fuera del límite geográfico '{limite_activo.nombre}'"
        )
    
    return CoordenadaValidacionResponse(
        valida=es_valida,
        latitud=coordenada.latitud,
        longitud=coordenada.longitud,
        altitud=coordenada.altitud,
        limite_aplicado=limite_activo.nombre,
        mensaje=mensaje
    )
