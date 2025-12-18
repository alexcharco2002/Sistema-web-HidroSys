# routes/iva.py

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
import unicodedata
import re

from db.session import get_db
from security.jwt import verify_token
from models.iva import IVA
from models.user import UsuarioSistema
from models.role import RolAccion
from schemas.iva import (
    IVACreate,
    IVAUpdate,
    IVAResponse,
    IVAListResponse,
    IVAStats
)

router = APIRouter(
    prefix="/iva",
    tags=["IVA - Configuración"]
)

# ============================================================================
# DEPENDENCIAS
# ============================================================================

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


def obtener_iva_activo_aplicable(db: Session) -> Optional[IVA]:
    """
    Obtiene el IVA que está actualmente activo y aplicable (para facturación).
    Solo puede haber uno.
    """
    return db.query(IVA).filter(
        IVA.activo == True,
        IVA.es_aplicable == True
    ).first()


def desactivar_todos_ivas(db: Session) -> int:
    """
    Desactiva TODOS los IVAs del sistema.
    
    Returns:
        Cantidad de IVAs desactivados
    """
    ivas_activos = db.query(IVA).filter(IVA.activo == True).all()
    cantidad = len(ivas_activos)
    
    for iva in ivas_activos:
        iva.activo = False
    
    return cantidad


def desactivar_ivas_activos_excepto(db: Session, excluir_id: int = None) -> int:
    """
    Desactiva todos los IVAs activos excepto el especificado.
    
    Args:
        db: Sesión de base de datos
        excluir_id: ID del IVA a excluir (no desactivar)
    
    Returns:
        Cantidad de IVAs desactivados
    """
    query = db.query(IVA).filter(IVA.activo == True)
    
    if excluir_id:
        query = query.filter(IVA.id_iva != excluir_id)
    
    ivas_a_desactivar = query.all()
    cantidad = len(ivas_a_desactivar)
    
    for iva in ivas_a_desactivar:
        iva.activo = False
    
    return cantidad


def verificar_iva_aplicable_existe(db: Session, excluir_id: int = None) -> bool:
    """
    Verifica si existe al menos un IVA con es_aplicable=True.
    
    Args:
        db: Sesión de base de datos
        excluir_id: ID del IVA a excluir de la búsqueda
    
    Returns:
        True si existe al menos uno
    """
    query = db.query(IVA).filter(IVA.es_aplicable == True)
    
    if excluir_id:
        query = query.filter(IVA.id_iva != excluir_id)
    
    return query.first() is not None


def obtener_iva_aplicable_activo(db: Session) -> Optional[IVA]:
    """
    Obtiene el IVA con es_aplicable=True y activo=True.
    
    Returns:
        IVA aplicable activo o None
    """
    return db.query(IVA).filter(
        IVA.es_aplicable == True,
        IVA.activo == True
    ).first()


# ============================================================================
# ENDPOINTS - LECTURA
# ============================================================================

@router.get("/", response_model=List[IVAResponse])
def listar_ivas(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    activo: Optional[bool] = Query(None, description="Filtrar por estado activo/inactivo"),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Lista todos los IVAs configurados con filtros opcionales.
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "configuracion", "lectura")
    
    query = db.query(IVA)
    
    if activo is not None:
        query = query.filter(IVA.activo == activo)
    
    # Ordenar: aplicables primero, luego por porcentaje descendente
    ivas = query.order_by(
        IVA.es_aplicable.desc(), 
        IVA.porcentaje.desc()
    ).offset(skip).limit(limit).all()
    
    return ivas


@router.get("/opciones", response_model=List[IVAListResponse])
def obtener_opciones_iva(
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Obtiene las opciones de IVA disponibles para que el usuario seleccione.
    Solo retorna IVAs activos.
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "configuracion", "lectura")
    
    ivas_activos = db.query(IVA).filter(
        IVA.activo == True
    ).order_by(
        IVA.es_aplicable.desc(),  # Aplicables primero
        IVA.porcentaje.desc()      # Luego del mayor al menor
    ).all()
    
    return ivas_activos


@router.get("/activo", response_model=Optional[IVAResponse])
def obtener_iva_activo_actual(
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Obtiene el IVA actualmente activo y aplicable para facturación.
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "configuracion", "lectura")
    
    iva_activo = obtener_iva_activo_aplicable(db)
    return iva_activo


@router.get("/stats", response_model=IVAStats)
def obtener_estadisticas(
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Obtiene estadísticas sobre los IVAs configurados.
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "configuracion", "lectura")
    
    total = db.query(IVA).count()
    activos = db.query(IVA).filter(IVA.activo == True).count()
    inactivos = total - activos
    
    tiene_no_aplicable = db.query(IVA).filter(
        IVA.activo == True,
        IVA.es_aplicable == False
    ).first() is not None
    
    opciones = db.query(IVA).filter(IVA.activo == True).order_by(
        IVA.es_aplicable.desc(),
        IVA.porcentaje.desc()
    ).all()
    
    return IVAStats(
        total_registros=total,
        ivas_activos=activos,
        ivas_inactivos=inactivos,
        tiene_opcion_no_aplicar=tiene_no_aplicable,
        opciones_disponibles=opciones
    )


@router.get("/{iva_id}", response_model=IVAResponse)
def obtener_iva(
    iva_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Obtiene un IVA específico por ID.
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "configuracion", "lectura")
    
    iva = db.query(IVA).filter(IVA.id_iva == iva_id).first()
    
    if not iva:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="IVA no encontrado"
        )
    
    return iva


# ============================================================================
# ENDPOINTS - CREACIÓN
# ============================================================================

@router.post("/", response_model=IVAResponse, status_code=status.HTTP_201_CREATED)
def crear_iva(
    iva_data: IVACreate,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Crea un nuevo IVA.
    
    REGLAS:
    - Se crea DESACTIVADO (activo=False) por defecto.
    - Se crea como NO APLICABLE (es_aplicable=False) por defecto.
    - El código debe ser único.
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "configuracion", "crear")
    
    # Normalizar código para evitar duplicados semánticos
    codigo_normalizado = normalize_text(iva_data.codigo)
    ivas_existentes = db.query(IVA).all()
    
    for iva in ivas_existentes:
        if normalize_text(iva.codigo) == codigo_normalizado:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ya existe un IVA con un código similar a '{iva_data.codigo}'"
            )
    
    try:
        # FORZAR valores por defecto del sistema
        datos_iva = iva_data.model_dump()
        datos_iva["activo"] = False          # 🔴 Siempre desactivado al crear
        datos_iva["es_aplicable"] = False    # 🔴 No aplicable por defecto
        
        nuevo_iva = IVA(**datos_iva)
        db.add(nuevo_iva)
        db.commit()
        db.refresh(nuevo_iva)
        
        return nuevo_iva
        
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ya existe un IVA con el código '{iva_data.codigo}'"
        )


# ============================================================================
# ENDPOINTS - ACTUALIZACIÓN
# ============================================================================

@router.put("/{iva_id}", response_model=IVAResponse)
def actualizar_iva(
    iva_id: int,
    iva_data: IVAUpdate,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Actualiza un IVA existente.
    
    REGLAS:
    - Si quiere cambiar es_aplicable=True, debe verificar que no exista otro aplicable activo.
    - Si existe otro aplicable activo, debe desactivarlo primero manualmente.
    - No permite activar directamente desde aquí (usar /activar o /toggle).
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "configuracion", "actualizar")
    
    iva = db.query(IVA).filter(IVA.id_iva == iva_id).first()
    
    if not iva:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="IVA no encontrado"
        )
    
    # Obtener los datos a actualizar
    datos_actualizacion = iva_data.model_dump(exclude_unset=True)
    
    # Verificar código duplicado si se está actualizando el código
    if 'codigo' in datos_actualizacion:
        codigo_nuevo = datos_actualizacion['codigo']
        codigo_normalizado = normalize_text(codigo_nuevo)
        
        ivas_existentes = db.query(IVA).filter(IVA.id_iva != iva_id).all()
        for iv in ivas_existentes:
            if normalize_text(iv.codigo) == codigo_normalizado:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Ya existe un IVA con un código similar a '{codigo_nuevo}'"
                )
    
    # Validar lógica de es_aplicable
    if 'es_aplicable' in datos_actualizacion or 'porcentaje' in datos_actualizacion:
        es_aplicable_nuevo = datos_actualizacion.get('es_aplicable', iva.es_aplicable)
        porcentaje_nuevo = datos_actualizacion.get('porcentaje', iva.porcentaje)
        
        # Si es NO aplicable (False), el porcentaje puede ser cualquiera
        # Si es aplicable (True), el porcentaje debe ser mayor a 0
        if es_aplicable_nuevo and porcentaje_nuevo <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Si es_aplicable es true, el porcentaje debe ser mayor a 0"
            )
    
    # Si quiere cambiar a es_aplicable=True y está activo, verificar conflictos
    if 'es_aplicable' in datos_actualizacion and datos_actualizacion['es_aplicable']:
        if iva.activo:
            # Verificar si hay otro IVA aplicable activo
            otro_aplicable = db.query(IVA).filter(
                IVA.id_iva != iva_id,
                IVA.es_aplicable == True,
                IVA.activo == True
            ).first()
            
            if otro_aplicable:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Ya existe un IVA aplicable activo: '{otro_aplicable.codigo}'. "
                           f"Desactívelo primero antes de cambiar este IVA a aplicable."
                )
    
    # Prevenir activación directa desde actualizar
    if 'activo' in datos_actualizacion and datos_actualizacion['activo']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Para activar un IVA, use el endpoint /iva/{id}/activar o /iva/toggle"
        )
    
    # Actualizar los campos del IVA
    for campo, valor in datos_actualizacion.items():
        setattr(iva, campo, valor)
    
    try:
        db.commit()
        db.refresh(iva)
        return iva
        
    except IntegrityError as e:
        db.rollback()
        if 'codigo' in str(e.orig):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ya existe un IVA con el código '{datos_actualizacion.get('codigo', '')}'"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Error al actualizar: datos inválidos"
            )


# ============================================================================
# ENDPOINTS - ACTIVACIÓN/DESACTIVACIÓN
# ============================================================================

@router.patch("/{iva_id}/activar", response_model=dict)
def activar_iva(
    iva_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Activa un IVA.
    
    COMPORTAMIENTO:
    - Desactiva todos los demás IVAs activos.
    - Activa el IVA seleccionado.
    - Solo puede haber UN IVA activo a la vez.
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "configuracion", "actualizar")
    
    iva = db.query(IVA).filter(IVA.id_iva == iva_id).first()
    
    if not iva:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="IVA no encontrado"
        )
    
    # Si ya está activo, no hacer nada
    if iva.activo:
        return {
            "mensaje": "El IVA ya está activo",
            "iva": IVAResponse.model_validate(iva).model_dump(),
            "ivas_desactivados": 0
        }
    
    # Desactivar todos los demás IVAs activos
    ivas_desactivados = desactivar_ivas_activos_excepto(db, excluir_id=iva_id)
    
    # Activar el IVA seleccionado
    iva.activo = True
    
    try:
        db.commit()
        db.refresh(iva)
        
        mensaje = f"IVA '{iva.codigo}' activado correctamente"
        if ivas_desactivados > 0:
            mensaje = f"IVA '{iva.codigo}' activado. Se desactivaron {ivas_desactivados} IVA(s)"
        
        return {
            "mensaje": mensaje,
            "iva": IVAResponse.model_validate(iva).model_dump(),
            "ivas_desactivados": ivas_desactivados
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al activar IVA: {str(e)}"
        )


@router.patch("/{iva_id}/desactivar", response_model=dict)
def desactivar_iva(
    iva_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Desactiva un IVA específico.
    
    COMPORTAMIENTO:
    - Si el IVA es aplicable (es_aplicable=True), NO se permite desactivar
      si es el único aplicable en el sistema.
    - Desactiva solo el IVA seleccionado.
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "configuracion", "actualizar")
    
    iva = db.query(IVA).filter(IVA.id_iva == iva_id).first()
    
    if not iva:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="IVA no encontrado"
        )
    
    if not iva.activo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El IVA ya está inactivo"
        )
    
    # Si es aplicable, verificar que no sea el único aplicable en el sistema
    if iva.es_aplicable:
        tiene_otros_aplicables = verificar_iva_aplicable_existe(db, excluir_id=iva_id)
        
        if not tiene_otros_aplicables:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se puede desactivar. Debe existir al menos un IVA con es_aplicable=True en el sistema. "
                       "Cree o configure otro IVA como aplicable antes de desactivar este."
            )
    
    iva.activo = False
    
    try:
        db.commit()
        db.refresh(iva)
        
        return {
            "mensaje": f"IVA '{iva.codigo}' desactivado correctamente",
            "iva": IVAResponse.model_validate(iva).model_dump()
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al desactivar IVA: {str(e)}"
        )


@router.post("/toggle", response_model=dict)
def toggle_iva(
    activar: bool = Query(..., description="True para activar, False para desactivar"),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Toggle general para IVAs.
    
    COMPORTAMIENTO:
    - Si activar=False: Desactiva TODOS los IVAs del sistema (activo=False para todos).
    - Si activar=True: Activa SOLO el IVA con es_aplicable=True.
    
    REGLA IMPORTANTE:
    - Siempre debe existir al menos UN IVA con es_aplicable=True en el sistema.
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "configuracion", "actualizar")
    
    if not activar:
        # Desactivar TODOS los IVAs
        cantidad_desactivados = desactivar_todos_ivas(db)
        
        try:
            db.commit()
            return {
                "mensaje": f"Todos los IVAs han sido desactivados",
                "accion": "desactivar_todos",
                "ivas_desactivados": cantidad_desactivados
            }
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al desactivar IVAs: {str(e)}"
            )
    
    else:
        # Activar SOLO el IVA con es_aplicable=True
        iva_aplicable = db.query(IVA).filter(IVA.es_aplicable == True).first()
        
        if not iva_aplicable:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No existe ningún IVA con es_aplicable=True. "
                       "Debe configurar al menos uno antes de usar esta opción."
            )
        
        # Desactivar todos primero
        desactivar_todos_ivas(db)
        
        # Activar solo el aplicable
        iva_aplicable.activo = True
        
        try:
            db.commit()
            db.refresh(iva_aplicable)
            
            return {
                "mensaje": f"IVA aplicable '{iva_aplicable.codigo}' activado correctamente",
                "accion": "activar_aplicable",
                "iva": IVAResponse.model_validate(iva_aplicable).model_dump()
            }
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al activar IVA aplicable: {str(e)}"
            )


# ============================================================================
# ENDPOINTS - ELIMINACIÓN
# ============================================================================

@router.delete("/{iva_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_iva(
    iva_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Elimina un IVA (eliminación física).
    
    RESTRICCIONES:
    - No se puede eliminar si es el único IVA con es_aplicable=True.
    - Usar con precaución si hay facturas que lo referencian.
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "configuracion", "eliminar")
    
    iva = db.query(IVA).filter(IVA.id_iva == iva_id).first()
    
    if not iva:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="IVA no encontrado"
        )
    
    # Si es aplicable, verificar que no sea el único aplicable
    if iva.es_aplicable:
        tiene_otros_aplicables = verificar_iva_aplicable_existe(db, excluir_id=iva_id)
        
        if not tiene_otros_aplicables:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se puede eliminar. Debe existir al menos un IVA con es_aplicable=True en el sistema."
            )
    
    try:
        db.delete(iva)
        db.commit()
        return None
        
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede eliminar: existen registros que utilizan este IVA"
        )
