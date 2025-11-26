# routes/roles.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from psycopg2.errors import ForeignKeyViolation
from typing import List
from models.role import Rol, RolAccion
from models.user import UsuarioSistema
from schemas.role import (
    RolCreate, RolUpdate, RolResponse, RolConAcciones,
    RolAccionCreate, RolAccionUpdate, RolAccionResponse
)
from schemas.notification import NotificacionCreate
from utils.notifications import registrar_notificacion
from utils.audit_logger import registrar_auditoria
from db.session import SessionLocal
from security.jwt import verify_token

router = APIRouter(prefix="/roles", tags=["roles"])

def get_db():
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

    Si el usuario tiene permiso de crear, actualizar o eliminar, 
    automáticamente también se le concede permiso de lectura.
    """
    # Normalizar
    module = module.lower().strip()
    action = action.lower().strip() if action else None

    permisos = db.query(RolAccion).filter(
        RolAccion.id_rol == user.id_rol,
        RolAccion.activo == True
    ).all()

    # Determinar todas las acciones que el usuario tiene sobre el módulo
    acciones_usuario = set()

    for permiso in permisos:
        if not permiso.nombre_accion:
            continue

        perm_module = permiso.nombre_accion.lower().strip()
        perm_action = (permiso.tipo_accion or '').lower().strip()

        if perm_module != module:
            continue

        if perm_action in ['crud', 'operaciones crud']:
            # Acceso completo
            return True

        acciones_usuario.add(perm_action)

    # ✅ Si no se pide acción específica, basta con que tenga cualquier permiso
    if action is None:
        return bool(acciones_usuario)

    # ✅ Si la acción es "lectura", damos acceso si tiene lectura o cualquier otro CRUD
    if action in ['leer', 'lectura']:
        if any(a in acciones_usuario for a in ['lectura', 'leer', 'crear', 'actualizar', 'eliminar']):
            return True

    # ✅ Caso normal: la acción debe coincidir exactamente
    return action in acciones_usuario


def require_permission(user: UsuarioSistema, db: Session, module: str, action: str = None):
    """
    Verifica permiso y lanza excepción si no lo tiene
    """
    if not check_permission(user, db, module, action):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"No tienes permisos para {action or 'acceder a'} {module}"
        )

# ========================================
# CRUD ROLES
# ========================================
@router.get("/", response_model=List[RolResponse])
def listar_roles(
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Lista todos los roles
    Requiere permiso: roles.lectura o roles.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "roles", "lectura")
    
    roles = db.query(Rol).all()
    return roles

@router.get("/{id_rol}", response_model=RolConAcciones)
def obtener_rol(
    id_rol: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Obtiene un rol específico con sus acciones
    Requiere permiso: roles.lectura o roles.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "roles", "lectura")
    
    rol = db.query(Rol).filter(Rol.id_rol == id_rol).first()
    
    if not rol:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rol no encontrado"
        )
    
    return rol

@router.post("/", response_model=RolResponse, status_code=status.HTTP_201_CREATED)
def crear_rol(
    rol: RolCreate,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Crea un nuevo rol
    Requiere permiso: roles.crear o roles.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "roles", "crear")
    
    # Verificar que no exista
    existe = db.query(Rol).filter(
        Rol.nombre_rol == rol.nombre_rol
    ).first()
    
    if existe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe un rol con ese nombre"
        )
    
    nuevo_rol = Rol(**rol.dict())
    
    try:
        db.add(nuevo_rol)
        db.commit()
        db.refresh(nuevo_rol)
        
        # ✅ Registrar auditoría
        registrar_auditoria(
            db=db,
            accion="CREATE",
            descripcion=f"Rol '{nuevo_rol.nombre_rol}' creado por '{payload['sub']}'",
            id_usuario=current_user.id_usuario_sistema
        )
        
        # ✅ Crear notificación
        registrar_notificacion(
            db=db,
            id_usuario=current_user.id_usuario_sistema,
            titulo="Rol creado",
            mensaje=f"El rol '{nuevo_rol.nombre_rol}' fue creado correctamente.",
            tipo="exito"
        )
        
        return nuevo_rol
    
    except Exception as e:
        db.rollback()
        print(f"❌ Error al crear rol: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear el rol: {str(e)}"
        )

@router.put("/{id_rol}", response_model=RolResponse)
def actualizar_rol(
    id_rol: int,
    rol_update: RolUpdate,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Actualiza un rol
    Requiere permiso: roles.actualizar o roles.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "roles", "actualizar")
    
    rol = db.query(Rol).filter(Rol.id_rol == id_rol).first()
    
    if not rol:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rol no encontrado"
        )
    
    # Validar duplicado solo si el nombre cambia
    if rol_update.nombre_rol and rol_update.nombre_rol != rol.nombre_rol:
        existe = db.query(Rol).filter(
            Rol.nombre_rol == rol_update.nombre_rol,
            Rol.id_rol != id_rol
        ).first()
        if existe:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ya existe otro rol con el nombre '{rol_update.nombre_rol}'."
            )

    # Actualizar solo los campos enviados
    for key, value in rol_update.dict(exclude_unset=True).items():
        setattr(rol, key, value)

    try:
        db.commit()
        db.refresh(rol)
        
        # ✅ Registrar auditoría
        registrar_auditoria(
            db=db,
            accion="UPDATE",
            descripcion=f"Rol '{rol.nombre_rol}' actualizado por '{payload['sub']}'",
            id_usuario=current_user.id_usuario_sistema
        )
        
        # ✅ Crear notificación
        registrar_notificacion(
            db=db,
            id_usuario=current_user.id_usuario_sistema,
            titulo="Rol modificado",
            mensaje=f"El rol '{rol.nombre_rol}' fue modificado correctamente.",
            tipo="info"
        )
        
        return rol
    
    except Exception as e:
        db.rollback()
        print(f"❌ Error al actualizar rol: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al actualizar el rol"
        )

@router.delete("/{id_rol}", status_code=status.HTTP_200_OK)
def eliminar_rol(
    id_rol: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Elimina el rol si no tiene relaciones.
    Si tiene relaciones (usuarios asignados), lo desactiva (borrado lógico).
    Requiere permiso: roles.eliminar o roles.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "roles", "eliminar")
    
    rol = db.query(Rol).filter(Rol.id_rol == id_rol).first()
    
    if not rol:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rol no encontrado"
        )
    
    # Verificar si hay usuarios con este rol
    usuarios_con_rol = db.query(UsuarioSistema).filter(
        UsuarioSistema.id_rol == id_rol
    ).count()
    
    try:
        if usuarios_con_rol > 0:
            # ✅ Si hay usuarios, desactivar en lugar de eliminar
            if not rol.activo:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"El rol '{rol.nombre_rol}' ya está inactivo."
                )
            
            rol.activo = False
            db.commit()
            db.refresh(rol)
            
            # Auditoría
            registrar_auditoria(
                db=db,
                accion="UPDATE",
                descripcion=f"Rol '{rol.nombre_rol}' fue desactivado (tiene {usuarios_con_rol} usuarios asignados) por '{payload['sub']}'",
                id_usuario=current_user.id_usuario_sistema
            )
            
            # Notificación
            registrar_notificacion(
                db=db,
                id_usuario=current_user.id_usuario_sistema,
                titulo="Rol desactivado",
                mensaje=f"El rol '{rol.nombre_rol}' no se pudo eliminar porque tiene {usuarios_con_rol} usuario(s) asignados. Fue desactivado automáticamente.",
                tipo="alerta"
            )
            
            return {
                "success": True,
                "message": f"⚠️ El rol '{rol.nombre_rol}' no se pudo eliminar porque tiene {usuarios_con_rol} usuario(s) asignados, por lo que fue desactivado automáticamente.",
                "accion": "desactivado",
                "usuarios_afectados": usuarios_con_rol
            }
        
        # ✅ Si no hay usuarios, eliminar físicamente
        db.delete(rol)
        db.commit()
        
        # Auditoría
        registrar_auditoria(
            db=db,
            accion="DELETE",
            descripcion=f"Rol '{rol.nombre_rol}' eliminado por '{payload['sub']}'",
            id_usuario=current_user.id_usuario_sistema
        )
        
        # Notificación
        registrar_notificacion(
            db=db,
            id_usuario=current_user.id_usuario_sistema,
            titulo="Rol eliminado",
            mensaje=f"El rol '{rol.nombre_rol}' fue eliminado correctamente.",
            tipo="info"
        )
        
        return {
            "success": True,
            "message": f"Rol '{rol.nombre_rol}' eliminado correctamente.",
            "accion": "eliminado"
        }
    
    except IntegrityError as e:
        db.rollback()
        
        # ✅ Si es por relación de clave foránea, desactivar
        if isinstance(e.orig, ForeignKeyViolation):
            print(f"⚠️ No se puede eliminar por relaciones, se desactiva el rol: {e}")
            
            if not rol.activo:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"El rol '{rol.nombre_rol}' ya está inactivo."
                )
            
            rol.activo = False
            db.commit()
            db.refresh(rol)
            
            # Auditoría
            registrar_auditoria(
                db=db,
                accion="UPDATE",
                descripcion=f"Rol '{rol.nombre_rol}' fue desactivado (por relaciones) por '{payload['sub']}'",
                id_usuario=current_user.id_usuario_sistema
            )
            
            # Notificación
            registrar_notificacion(
                db=db,
                id_usuario=current_user.id_usuario_sistema,
                titulo="Rol desactivado",
                mensaje=f"El rol '{rol.nombre_rol}' no se pudo eliminar porque está relacionado con otros módulos. Fue desactivado automáticamente.",
                tipo="alerta"
            )
            
            return {
                "success": True,
                "message": f"⚠️ El rol '{rol.nombre_rol}' no se pudo eliminar porque tiene relación con otros módulos, por lo que fue desactivado automáticamente.",
                "accion": "desactivado"
            }
        
        # Otros errores no esperados
        print(f"Error inesperado al eliminar rol: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al intentar eliminar el rol"
        )
    
    except Exception as e:
        db.rollback()
        print(f"❌ Error al eliminar rol: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al eliminar el rol"
        )

@router.patch("/{id_rol}/toggle-status", response_model=RolResponse)
def toggle_rol_status(
    id_rol: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Activa/Desactiva un rol
    Requiere permiso: roles.actualizar o roles.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "roles", "actualizar")
    
    rol = db.query(Rol).filter(Rol.id_rol == id_rol).first()
    
    if not rol:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rol no encontrado"
        )
    
    # Cambiar estado
    rol.activo = not rol.activo
    estado_texto = "activado" if rol.activo else "desactivado"
    
    try:
        db.commit()
        db.refresh(rol)
        
        # ✅ Registrar auditoría
        registrar_auditoria(
            db=db,
            accion="UPDATE",
            descripcion=f"Rol '{rol.nombre_rol}' fue {estado_texto} por '{payload['sub']}'",
            id_usuario=current_user.id_usuario_sistema
        )
        
        return rol
    
    except Exception as e:
        db.rollback()
        print(f"❌ Error al cambiar estado del rol: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al cambiar el estado del rol"
        )

# ========================================
# CRUD ROL_ACCIONES
# ========================================
@router.get("/{id_rol}/acciones", response_model=List[RolAccionResponse])
def listar_acciones_rol(
    id_rol: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Lista las acciones de un rol
    Requiere permiso: roles.lectura o roles.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "roles", "lectura")
    
    acciones = db.query(RolAccion).filter(
        RolAccion.id_rol == id_rol
    ).all()
    
    return acciones

@router.post("/{id_rol}/acciones", response_model=RolAccionResponse, status_code=status.HTTP_201_CREATED)
def agregar_accion_rol(
    id_rol: int,
    accion: RolAccionCreate,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Agrega una acción a un rol
    Requiere permiso: roles.crear o roles.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "roles", "crear")
    
    # Verificar que el rol existe
    rol = db.query(Rol).filter(Rol.id_rol == id_rol).first()
    if not rol:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rol no encontrado"
        )
    
    # Verificar que no exista la misma acción
    existe = db.query(RolAccion).filter(
        RolAccion.id_rol == id_rol,
        RolAccion.nombre_accion == accion.nombre_accion,
        RolAccion.tipo_accion == accion.tipo_accion
    ).first()
    
    if existe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Esta acción ya existe para este rol"
        )
    
    nueva_accion = RolAccion(id_rol=id_rol, **accion.dict())
    
    try:
        db.add(nueva_accion)
        db.commit()
        db.refresh(nueva_accion)
        
        # ✅ Registrar auditoría
        registrar_auditoria(
            db=db,
            accion="CREATE",
            descripcion=f"Acción '{accion.nombre_accion}/{accion.tipo_accion}' agregada al rol '{rol.nombre_rol}' por '{payload['sub']}'",
            id_usuario=current_user.id_usuario_sistema
        )
        
        return nueva_accion
    
    except Exception as e:
        db.rollback()
        print(f"❌ Error al agregar acción: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al agregar la acción"
        )

@router.put("/acciones/{id_rol_accion}", response_model=RolAccionResponse)
def actualizar_accion(
    id_rol_accion: int,
    accion_update: RolAccionUpdate,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Actualiza una acción
    Requiere permiso: roles.actualizar o roles.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "roles", "actualizar")
    
    accion = db.query(RolAccion).filter(
        RolAccion.id_rol_accion == id_rol_accion
    ).first()
    
    if not accion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Acción no encontrada"
        )
    
    for key, value in accion_update.dict(exclude_unset=True).items():
        setattr(accion, key, value)
    
    try:
        db.commit()
        db.refresh(accion)
        
        # ✅ Registrar auditoría
        registrar_auditoria(
            db=db,
            accion="UPDATE",
            descripcion=f"Acción '{accion.nombre_accion}/{accion.tipo_accion}' actualizada por '{payload['sub']}'",
            id_usuario=current_user.id_usuario_sistema
        )
        
        return accion
    
    except Exception as e:
        db.rollback()
        print(f"❌ Error al actualizar acción: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al actualizar la acción"
        )

@router.delete("/acciones/{id_rol_accion}", status_code=status.HTTP_200_OK)
def eliminar_accion(
    id_rol_accion: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Elimina una acción si no tiene relaciones.
    Si tiene relaciones, la desactiva (borrado lógico).
    Requiere permiso: roles.eliminar o roles.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "roles", "eliminar")
    
    accion = db.query(RolAccion).filter(
        RolAccion.id_rol_accion == id_rol_accion
    ).first()
    
    if not accion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Acción no encontrada"
        )
    
    try:
        # ✅ Intentar eliminar físicamente
        db.delete(accion)
        db.commit()
        
        # Auditoría
        registrar_auditoria(
            db=db,
            accion="DELETE",
            descripcion=f"Acción '{accion.nombre_accion}/{accion.tipo_accion}' eliminada por '{payload['sub']}'",
            id_usuario=current_user.id_usuario_sistema
        )
        
        return {
            "success": True,
            "message": "Acción eliminada correctamente",
            "accion": "eliminado"
        }
    
    except IntegrityError as e:
        db.rollback()
        
        # ✅ Si es por relación, desactivar
        if isinstance(e.orig, ForeignKeyViolation):
            print("⚠️ No se puede eliminar por relaciones, se desactiva la acción")
            
            if not accion.activo:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="La acción ya está inactiva."
                )
            
            accion.activo = False
            db.commit()
            db.refresh(accion)
            
            # Auditoría
            registrar_auditoria(
                db=db,
                accion="UPDATE",
                descripcion=f"Acción '{accion.nombre_accion}/{accion.tipo_accion}' fue desactivada (por relaciones) por '{payload['sub']}'",
                id_usuario=current_user.id_usuario_sistema
            )
            
            return {
                "success": True,
                "message": "⚠️ La acción no se pudo eliminar porque tiene relación con otros módulos, por lo que fue desactivada automáticamente.",
                "accion": "desactivado"
            }
        
        # Otros errores
        print(f"Error inesperado al eliminar acción: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al intentar eliminar la acción"
        )

@router.patch("/acciones/{id_rol_accion}/toggle-status", response_model=RolAccionResponse)
def toggle_accion_status(
    id_rol_accion: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Activa/Desactiva una acción
    Requiere permiso: roles.actualizar o roles.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "roles", "actualizar")
    
    accion = db.query(RolAccion).filter(
        RolAccion.id_rol_accion == id_rol_accion
    ).first()
    
    if not accion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Acción no encontrada"
        )
    
    # Cambiar estado
    accion.activo = not accion.activo
    estado_texto = "activada" if accion.activo else "desactivada"
    
    try:
        db.commit()
        db.refresh(accion)
        
        # ✅ Registrar auditoría
        registrar_auditoria(
            db=db,
            accion="UPDATE",
            descripcion=f"Acción '{accion.nombre_accion}/{accion.tipo_accion}' fue {estado_texto} por '{payload['sub']}'",
            id_usuario=current_user.id_usuario_sistema
        )
        
        return accion
    
    except Exception as e:
        db.rollback()
        print(f"❌ Error al cambiar estado de la acción: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al cambiar el estado de la acción"
        )