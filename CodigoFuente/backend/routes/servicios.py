# routes/servicios.py

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
from decimal import Decimal

from models.servicio import Servicio
from models.user import UsuarioSistema
from models.role import RolAccion
from schemas.servicio import ServicioCreate, ServicioUpdate, ServicioResponse, ServicioStats
from utils.notifications import registrar_notificacion
from utils.audit_logger import registrar_auditoria
from db.session import SessionLocal
from security.jwt import verify_token

import unicodedata
import re

router = APIRouter(prefix="/servicios", tags=["servicios"])


def get_db():
    """Dependencia para obtener la sesión de base de datos"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ============================================================================
# HELPER: Obtener usuario actual desde el token
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


# ============================================================================
# HELPER: Verificar permisos de usuario
# ============================================================================

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
        
        # Si tiene permisos CRUD completos
        if perm_action in ['crud', 'operaciones crud']:
            return True
        
        acciones_usuario.add(perm_action)
    
    # Si no se especifica acción, devolver True si tiene al menos un permiso
    if action is None:
        return bool(acciones_usuario)
    
    # Para lectura, aceptar variantes
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
# HELPER: Normalizar texto
# ============================================================================

def normalize_text(text: str) -> str:
    """
    Normaliza texto para comparación:
    - convierte a minúsculas
    - elimina espacios extras
    - elimina acentos
    """
    if not text:
        return ""
    
    text = text.lower().strip()
    
    # Quitar acentos
    text = ''.join(
        c for c in unicodedata.normalize('NFD', text)
        if unicodedata.category(c) != 'Mn'
    )
    
    # Quitar espacios internos múltiples
    text = re.sub(r"\s+", " ", text)
    
    return text


# ========================================
# CRUD SERVICIOS
# ========================================

@router.get("/", response_model=List[ServicioResponse])
def listar_servicios(
    search: Optional[str] = Query(None, description="Buscar por nombre o descripción"),
    activo: Optional[bool] = Query(None, description="Filtrar por estado activo"),
    skip: int = Query(0, ge=0, description="Número de registros a saltar"),
    limit: int = Query(100, ge=1, le=1000, description="Número máximo de registros"),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Lista todos los servicios con filtros opcionales
    Requiere permiso: servicios.lectura o servicios.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "servicios", "lectura")
    
    query = db.query(Servicio)
    
    # Filtro de búsqueda
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (Servicio.nombre.ilike(search_filter)) |
            (Servicio.descripcion.ilike(search_filter))
        )
    
    # Filtro por estado
    if activo is not None:
        query = query.filter(Servicio.activo == activo)
    
    # Ordenar por nombre
    query = query.order_by(Servicio.nombre)
    
    # Paginación
    servicios = query.offset(skip).limit(limit).all()
    
    return servicios


@router.get("/stats/count", response_model=ServicioStats)
def obtener_estadisticas_servicios(
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Obtiene estadísticas de servicios
    Requiere permiso: servicios.lectura o servicios.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "servicios", "lectura")
    
    total = db.query(Servicio).count()
    activos = db.query(Servicio).filter(Servicio.activo == True).count()
    inactivos = db.query(Servicio).filter(Servicio.activo == False).count()
    
    return {
        "total": total,
        "activos": activos,
        "inactivos": inactivos
    }


@router.get("/{id_servicio}", response_model=ServicioResponse)
def obtener_servicio(
    id_servicio: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Obtiene un servicio específico por ID
    Requiere permiso: servicios.lectura o servicios.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "servicios", "lectura")
    
    servicio = db.query(Servicio).filter(Servicio.id_servicio == id_servicio).first()
    
    if not servicio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Servicio no encontrado"
        )
    
    return servicio


@router.post("/", response_model=ServicioResponse, status_code=status.HTTP_201_CREATED)
def crear_servicio(
    servicio: ServicioCreate,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Crea un nuevo servicio
    Requiere permiso: servicios.crear o servicios.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "servicios", "crear")
    
    # Normalizar nombre para verificar duplicados
    nombre_normalizado = normalize_text(servicio.nombre)
    
    # Buscar duplicados
    servicios_existentes = db.query(Servicio).all()
    for s in servicios_existentes:
        if normalize_text(s.nombre) == nombre_normalizado:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ya existe un servicio con el nombre '{servicio.nombre}'"
            )
    
    # Crear nuevo servicio
    nuevo_servicio = Servicio(
        nombre=servicio.nombre.strip(),
        descripcion=servicio.descripcion.strip() if servicio.descripcion else None,
        precio_base=servicio.precio_base,
        activo=servicio.activo
    )
    
    try:
        db.add(nuevo_servicio)
        db.commit()
        db.refresh(nuevo_servicio)
        
        # Registrar auditoría
        registrar_auditoria(
            db=db,
            accion="CREATE",
            descripcion=f"Servicio '{nuevo_servicio.nombre}' creado por '{payload['sub']}'",
            id_usuario=current_user.id_usuario_sistema
        )
        
        # Crear notificación
        registrar_notificacion(
            db=db,
            id_usuario=current_user.id_usuario_sistema,
            titulo="Servicio creado",
            mensaje=f"El servicio '{nuevo_servicio.nombre}' fue creado correctamente.",
            tipo="exito"
        )
        
        return nuevo_servicio
    
    except Exception as e:
        db.rollback()
        print(f"❌ Error al crear servicio: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear el servicio: {str(e)}"
        )


@router.put("/{id_servicio}", response_model=ServicioResponse)
def actualizar_servicio(
    id_servicio: int,
    servicio_update: ServicioUpdate,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Actualiza un servicio existente
    Requiere permiso: servicios.actualizar o servicios.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "servicios", "actualizar")
    
    # Buscar el servicio
    servicio = db.query(Servicio).filter(Servicio.id_servicio == id_servicio).first()
    
    if not servicio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Servicio no encontrado"
        )
    
    # Validar duplicado solo si el nombre cambia
    if servicio_update.nombre and servicio_update.nombre != servicio.nombre:
        nombre_normalizado = normalize_text(servicio_update.nombre)
        servicios_existentes = db.query(Servicio).filter(Servicio.id_servicio != id_servicio).all()
        
        for s in servicios_existentes:
            if normalize_text(s.nombre) == nombre_normalizado:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Ya existe otro servicio con el nombre '{servicio_update.nombre}'"
                )
    
    # Actualizar solo los campos enviados
    update_data = servicio_update.model_dump(exclude_unset=True)
    
    for key, value in update_data.items():
        setattr(servicio, key, value)
    
    try:
        db.commit()
        db.refresh(servicio)
        
        # Registrar auditoría
        registrar_auditoria(
            db=db,
            accion="UPDATE",
            descripcion=f"Servicio '{servicio.nombre}' actualizado por '{payload['sub']}'",
            id_usuario=current_user.id_usuario_sistema
        )
        
        # Crear notificación
        registrar_notificacion(
            db=db,
            id_usuario=current_user.id_usuario_sistema,
            titulo="Servicio modificado",
            mensaje=f"El servicio '{servicio.nombre}' fue modificado correctamente.",
            tipo="info"
        )
        
        return servicio
    
    except Exception as e:
        db.rollback()
        print(f"❌ Error al actualizar servicio: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al actualizar el servicio"
        )


@router.delete("/{id_servicio}", status_code=status.HTTP_200_OK)
def eliminar_servicio(
    id_servicio: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Elimina físicamente el servicio.
    Si no se puede eliminar por una restricción FK, devuelve un mensaje claro.
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "servicios", "eliminar")
    
    servicio = db.query(Servicio).filter(Servicio.id_servicio == id_servicio).first()
    
    if not servicio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Servicio no encontrado"
        )
    
    try:
        # Intentar eliminar
        db.delete(servicio)
        db.commit()
        
        registrar_auditoria(
            db=db,
            accion="DELETE",
            descripcion=f"Servicio '{servicio.nombre}' eliminado por '{payload['sub']}'",
            id_usuario=current_user.id_usuario_sistema
        )
        
        registrar_notificacion(
            db=db,
            id_usuario=current_user.id_usuario_sistema,
            titulo="Servicio eliminado",
            mensaje=f"El servicio '{servicio.nombre}' fue eliminado correctamente.",
            tipo="info"
        )
        
        return {
            "success": True,
            "accion": "eliminado",
            "message": f"Servicio '{servicio.nombre}' eliminado correctamente."
        }
    
    except IntegrityError:
        db.rollback()
        return {
            "success": False,
            "accion": "no_eliminado",
            "message": (
                f"⚠️ NO se puede eliminar el servicio '{servicio.nombre}' porque "
                "está relacionado con facturas u otros elementos del sistema. "
                "Elimine esas relaciones antes de intentar borrar este servicio."
            )
        }
    
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error inesperado al intentar eliminar el servicio."
        )


@router.patch("/{id_servicio}/toggle-status", response_model=ServicioResponse)
def toggle_servicio_status(
    id_servicio: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Activa/Desactiva un servicio
    Requiere permiso: servicios.actualizar o servicios.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "servicios", "actualizar")
    
    servicio = db.query(Servicio).filter(Servicio.id_servicio == id_servicio).first()
    
    if not servicio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Servicio no encontrado"
        )
    
    # Cambiar estado
    servicio.activo = not servicio.activo
    estado_texto = "activado" if servicio.activo else "desactivado"
    
    try:
        db.commit()
        db.refresh(servicio)
        
        # Registrar auditoría
        registrar_auditoria(
            db=db,
            accion="UPDATE",
            descripcion=f"Servicio '{servicio.nombre}' fue {estado_texto} por '{payload['sub']}'",
            id_usuario=current_user.id_usuario_sistema
        )
        
        return servicio
    
    except Exception as e:
        db.rollback()
        print(f"❌ Error al cambiar estado del servicio: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al cambiar el estado del servicio"
        )


# ========================================
# ENDPOINTS ADICIONALES
# ========================================

@router.get("/activos/list", response_model=List[ServicioResponse])
def listar_servicios_activos(
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Lista todos los servicios activos (útil para selects y dropdowns)
    Requiere permiso: servicios.lectura o servicios.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "servicios", "lectura")
    
    servicios = db.query(Servicio).filter(
        Servicio.activo == True
    ).order_by(Servicio.nombre).all()
    
    return servicios
