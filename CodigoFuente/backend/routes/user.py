# routes/users.py
from fastapi import APIRouter, Depends, HTTPException, Request, status, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_ , cast, String
from typing import List, Optional
from datetime import datetime
from schemas.notification import NotificacionCreate
from services.password_service import agregar_al_historial, validar_nueva_password_completa
from utils.notifications import registrar_notificacion
from sqlalchemy.exc import IntegrityError
from psycopg2.errors import ForeignKeyViolation, NotNullViolation

import base64

from db.session import SessionLocal
from models.user import UsuarioSistema
from schemas.user import (
    UserCreate, 
    UserUpdate, 
    UserResponse, 
    UserListResponse,
    ChangePasswordRequest,
    ChangePasswordFirstLoginRequest,
    UserBulkResponse,
    UserBulkCreateRequest,
    UserBulkError,
    UserBulkResult
)
from security.jwt import verify_token
from security.password import hash_password, verify_password
from utils.audit_logger import registrar_auditoria

router = APIRouter(prefix="/users", tags=["users"])

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
    from models.role import RolAccion

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

# ============================================================================
# HELPER: Procesar foto
# ============================================================================
def process_user_photo(foto_bytes):
    """Procesa la foto del usuario para enviarla al frontend"""
    if foto_bytes:
        try:
            foto_base64 = base64.b64encode(foto_bytes).decode('utf-8')
            return f"data:image/jpeg;base64,{foto_base64}"
        except Exception as e:
            print(f"Error procesando foto: {e}")
            return None
    return None

# ============================================================================
# HELPER: Convertir usuario a respuesta
# ============================================================================
def user_to_response(user: UsuarioSistema, db: Session = None) -> dict:
    """Convierte un usuario de BD a diccionario de respuesta"""
    foto_url = process_user_photo(user.foto) if user.foto else None
    
    # Obtener información del rol
    rol_info = None
    if user.rol:
        rol_info = {
            "id_rol": user.rol.id_rol,
            "nombre_rol": user.rol.nombre_rol,
            "descripcion": user.rol.descripcion
        }
    
    # Obtener permisos si se proporciona db
    permisos = []
    if db:
        permisos = user.get_permissions(db)
    
    return {
        "id": user.id_usuario_sistema,
        "usuario": user.usuario,
        "nombres": user.nombres,
        "apellidos": user.apellidos,
        "sexo": user.sexo,
        "fecha_nac": user.fecha_nac.isoformat() if user.fecha_nac else None,
        "cedula": user.cedula,
        "email": user.email,
        "telefono": user.telefono,
        "direccion": user.direccion,
        "id_rol": user.id_rol,
        "rol": rol_info,  # ✅ Objeto completo del rol
        "permisos": permisos,  # ✅ Lista de permisos
        "activo": user.activo,
        "fecha_registro": user.fecha_registro.isoformat() if user.fecha_registro else None,
        "ultimo_acceso": user.ultimo_acceso.isoformat() if user.ultimo_acceso else None,
        "foto": foto_url
    }

# ========================================
# LISTAR USUARIOS
# ========================================
@router.get("", response_model=List[UserListResponse])
def get_users(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    rol: Optional[str] = None,
    activo: Optional[bool] = None,
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Obtiene lista de usuarios con filtros opcionales
    Requiere permiso: usuarios.leer o usuarios.crud
    """
    # Obtener usuario actual y verificar permisos
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "usuarios", "lectura")
    
    query = db.query(UsuarioSistema) 
    
    # Filtro de búsqueda
    if search:
        like = f"%{search}%"
        search_filter = or_(
            UsuarioSistema.nombres.ilike(like),
            UsuarioSistema.apellidos.ilike(like),
            cast(UsuarioSistema.cedula, String).ilike(like)
        )
        query = query.filter(search_filter)
    
    # Filtro de rol
    if rol and rol != "all":
        query = query.filter(UsuarioSistema.id_rol == rol)
    
    # Filtro de estado
    if activo is not None:
        query = query.filter(UsuarioSistema.activo == activo)
    
    # Ordenar por fecha de registro descendente
    query = query.order_by(UsuarioSistema.fecha_registro.desc())
    
    users = query.offset(skip).limit(limit).all()
    
    return [user_to_response(user, db) for user in users]

# ========================================
# OBTENER USUARIO POR ID
# ========================================
@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Obtiene un usuario específico por ID
    Admin o el mismo usuario pueden acceder
    """
    current_user = get_current_user(payload, db)
    
    # Admin puede ver cualquier usuario
    can_view_all = check_permission(current_user, db, "usuarios", "lectura")
    
    # Usuario normal solo puede verse a sí mismo
    if not can_view_all and current_user.id_usuario_sistema != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para ver este usuario"
        )
    
    user = db.query(UsuarioSistema).filter(
        UsuarioSistema.id_usuario_sistema == user_id
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    
    return user_to_response(user, db)

# ========================================
# CREAR USUARIO
# ========================================
@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    user_data: UserCreate,
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Crea un nuevo usuario.
    Requiere permiso: usuarios.crear o usuarios.crud
    
    ✅ Usuario: se genera automáticamente en minúsculas a partir del nombre
    ✅ Contraseña: es la cédula completa
    """
    # Verificar permisos
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "usuarios", "crear")

    # ===============================
    # 1️⃣ Normalizar y generar usuario automáticamente
    # ===============================
    primer_nombre = user_data.nombres.strip().split()[0].lower()
    # Remover acentos básicos
    primer_nombre = primer_nombre.replace('á', 'a').replace('é', 'e').replace('í', 'i')
    primer_nombre = primer_nombre.replace('ó', 'o').replace('ú', 'u').replace('ñ', 'n')
    
    base_username = primer_nombre
    username = base_username

    # Si ya existe un usuario igual, agregar año de nacimiento o contador
    counter = 1
    while db.query(UsuarioSistema).filter(UsuarioSistema.usuario == username).first():
        if user_data.fecha_nac:
            username = f"{base_username}{user_data.fecha_nac.year}"
            if db.query(UsuarioSistema).filter(UsuarioSistema.usuario == username).first():
                username = f"{base_username}{user_data.fecha_nac.year}{counter}"
                counter += 1
        else:
            username = f"{base_username}{counter}"
            counter += 1

    print(f"✅ Usuario generado: {username}")

    # ===============================
    # 2️⃣ Generar contraseña = CÉDULA
    # ===============================
    if not user_data.cedula or len(user_data.cedula.strip()) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cédula inválida (debe tener al menos 8 caracteres)."
        )

    raw_password = user_data.cedula.strip()
    hashed_password = hash_password(raw_password)
    
    print(f"✅ Contraseña generada: {raw_password}")

    # ===============================
    # 3️⃣ Verificar email o cédula duplicada
    # ===============================
    existing_user = db.query(UsuarioSistema).filter(
        or_(
            UsuarioSistema.email == user_data.email,
            UsuarioSistema.cedula == user_data.cedula
        )
    ).first()

    if existing_user:
        
        if existing_user.cedula == user_data.cedula:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La cédula ya está registrada"
            )

    # ===============================
    # 4️⃣ Crear el nuevo usuario
    # ===============================
    new_user = UsuarioSistema(
        usuario=username,
        clave=hashed_password,
        nombres=user_data.nombres.strip(),
        apellidos=user_data.apellidos.strip(),
        sexo=user_data.sexo.strip().upper(),
        fecha_nac=user_data.fecha_nac,
        cedula=user_data.cedula.strip(),
        email=user_data.email.strip().lower(),
        id_rol=user_data.id_rol,
        telefono=user_data.telefono.strip() if user_data.telefono else None,
        direccion=user_data.direccion.strip() if user_data.direccion else "Sanjapamba",
        activo=user_data.activo,
        fecha_registro=datetime.now()
    )

    # ===============================
    # 5️⃣ Guardar usuario
    # ===============================
    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        # ✅ Registrar auditoría
        registrar_auditoria(
            db=db,
            accion="CREATE",
            descripcion=f"Usuario '{new_user.usuario}' creado por '{payload['sub']}'",
            id_usuario=current_user.id_usuario_sistema
        )
        
        # ✅ Crear notificación al crear un usuario
        registrar_notificacion(
            db=db,
            id_usuario=current_user.id_usuario_sistema,
            titulo="Usuario creado",
            mensaje=f"El usuario '{new_user.usuario}' fue creado correctamente.",
            tipo="exito"
        )
        print(f"✅ Usuario creado exitosamente: {username}")

        # ✅ Devolver respuesta con datos generados
        response_data = user_to_response(new_user, db)
        response_data["contraseña_generada"] = raw_password

        return response_data
    
    except Exception as e:
        db.rollback()
        print(f"❌ Error al crear usuario: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear el usuario: {str(e)}"
        )
      
# ========================================
# ACTUALIZAR USUARIO
# ========================================
@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_data: UserUpdate,
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Actualiza un usuario existente
    Requiere permiso: usuarios.actualizar o usuarios.crud (o ser el mismo usuario)
    """
    current_user = get_current_user(payload, db)
    
    # Obtener usuario a actualizar
    user = db.query(UsuarioSistema).filter(
        UsuarioSistema.id_usuario_sistema == user_id
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    
    # Verificar permisos
    can_update_all = check_permission(current_user, db, "usuarios", "actualizar")
    
    if not can_update_all and current_user.id_usuario_sistema != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para actualizar este usuario"
        )
    
    # Usuario normal no puede cambiar su propio rol
    if not can_update_all and user_data.id_rol and user_data.id_rol != user.id_rol:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No puedes cambiar tu propio rol"
        )
    
    # Verificar unicidad de campos si se están actualizando
    if user_data.usuario and user_data.usuario != user.usuario:
        existing = db.query(UsuarioSistema).filter(
            UsuarioSistema.usuario == user_data.usuario,
            UsuarioSistema.id_usuario_sistema != user_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El nombre de usuario ya está en uso"
            )
    
 
    
    if user_data.cedula and user_data.cedula != user.cedula:
        existing = db.query(UsuarioSistema).filter(
            UsuarioSistema.cedula == user_data.cedula,
            UsuarioSistema.id_usuario_sistema != user_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La cédula ya está registrada"
            )
    
    # Actualizar campos
    update_data = user_data.dict(exclude_unset=True)
    
    for field, value in update_data.items():
        if value is not None:
            if field == "clave":
                setattr(user, field, hash_password(value))
            elif field in ["usuario", "nombres", "apellidos", "email", "cedula", "telefono", "direccion"]:
                setattr(user, field, value.strip() if isinstance(value, str) else value)
            else:
                setattr(user, field, value)
    
    try:
        db.commit()
        db.refresh(user)
        # ✅ Registrar auditoría
        registrar_auditoria(
            db=db,
            accion="UPDATE",
            descripcion=f"Usuario '{user.usuario}' actualizado por '{payload['sub']}'",
            id_usuario=current_user.id_usuario_sistema
        )
        # ✅ Crear notificación 
        registrar_notificacion(
            db=db,
            id_usuario=current_user.id_usuario_sistema,
            titulo="Usuario modificado",
            mensaje=f"El usuario '{user.usuario}' fue modificado correctamente.",
            tipo="info"
        )
        return user_to_response(user, db)
    
    except Exception as e:
        db.rollback()
        print(f"Error al actualizar usuario: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al actualizar el usuario"
        )

# ========================================
# ELIMINAR USUARIO (SOLO SI NO TIENE RELACIONES)
# ========================================
@router.delete("/{user_id}", status_code=status.HTTP_200_OK)
def delete_user(
    user_id: int,
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Elimina el usuario solo si NO tiene relaciones.
    Además NO permite que un usuario se elimine a sí mismo.
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "usuarios", "eliminar")

    # 🚫 No permitir auto-eliminación
    if current_user.id_usuario_sistema == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes eliminar tu propio usuario"
        )

    # Buscar usuario
    user = db.query(UsuarioSistema).filter(
        UsuarioSistema.id_usuario_sistema == user_id
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )

    try:
        # Intentar eliminar físicamente
        db.delete(user)
        db.commit()

        # Auditoría
        registrar_auditoria(
            db=db,
            accion="DELETE",
            descripcion=f"Usuario '{user.usuario}' eliminado por '{payload['sub']}'",
            id_usuario=current_user.id_usuario_sistema
        )

        # Notificación
        registrar_notificacion(
            db=db,
            id_usuario=current_user.id_usuario_sistema,
            titulo="Usuario eliminado",
            mensaje=f"El usuario '{user.usuario}' fue eliminado correctamente.",
            tipo="info"
        )

        return {
            "success": True,
            "accion": "eliminado",
            "message": f"Usuario '{user.usuario}' eliminado correctamente."
        }

    except IntegrityError as e:
        db.rollback()

        if isinstance(e.orig, (ForeignKeyViolation, NotNullViolation)):
            return {
                "success": False,
                "accion": "no_eliminado",
                "message": (
                    f"NO se puede eliminar el usuario '{user.usuario}', porque "
                    f"tiene relaciones con otros módulos del sistema. Elimine esos elementos antes "
                    "de intentar borrar este usuario."
                )
            }

        raise HTTPException(
            status_code=500,
            detail="Error al intentar eliminar el usuario"
        )


# ========================================
# CAMBIAR ESTADO (ACTIVAR/DESACTIVAR)
# ========================================
@router.patch("/{user_id}/toggle-status", response_model=UserResponse)
def toggle_user_status(
    user_id: int,
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Activa o desactiva un usuario
    Requiere permiso: usuarios.actualizar o usuarios.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "usuarios", "actualizar")
    
    # ✅ Validar que no intente cambiar su propio estado
    if current_user.id_usuario_sistema == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes activar/desactivar tu propio usuario"
        )

    
    user = db.query(UsuarioSistema).filter(
        UsuarioSistema.id_usuario_sistema == user_id
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    
    # Cambiar estado
    user.activo = not user.activo
    estado_texto = "activado" if user.activo else "desactivado"
    
    try:
        db.commit()
        db.refresh(user)
        
        # ✅ Registrar auditoría
        registrar_auditoria(
            db=db,
            accion="UPDATE",
            descripcion=f"Usuario '{user.usuario}' fue {estado_texto} por '{payload['sub']}'",
            id_usuario=current_user.id_usuario_sistema
        )
        return user_to_response(user, db)
    
    except Exception as e:
        db.rollback()
        print(f"Error al cambiar estado: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al cambiar el estado del usuario"
        )
    

# ========================================
# SCHEMAS
# ========================================
class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class ChangePasswordFirstLoginRequest(BaseModel):
    new_password: str


class ResetPasswordRequest(BaseModel):
    user_id: int
    new_password: str


# ========================================
# CAMBIAR CONTRASEÑA
# ========================================
# ========================================
# CAMBIAR CONTRASEÑA - ISO 27002
# ========================================
@router.put("/{user_id}/change-password", response_model=dict)
def change_user_password(
    user_id: int,
    password_data: ChangePasswordRequest,
    request: Request,
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Cambia la contraseña de un usuario con validaciones ISO 27002:
    - Complejidad estricta (mayúsculas, minúsculas, números, símbolos)
    - No reutilización de últimas 5 contraseñas
    - No información personal (usuario, email, nombres)
    - Auditoría completa con IP y User-Agent
    - Historial de contraseñas
    
    Permisos:
    - Usuario puede cambiar su propia contraseña
    - Admin con 'usuarios.actualizar' puede cambiar cualquier contraseña
    """
    try:
        # Obtener usuario actual desde token
        current_user = get_current_user(payload, db)
        
        # Verificar permisos
        can_change_all = check_permission(current_user, db, "usuarios", "actualizar")
        
        if not can_change_all and current_user.id_usuario_sistema != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para cambiar esta contraseña"
            )
        
        # Obtener usuario a actualizar
        user = db.query(UsuarioSistema).filter(
            UsuarioSistema.id_usuario_sistema == user_id
        ).first()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuario no encontrado"
            )
        
        # Verificar que usuario esté activo
        if not user.activo:
            # Registrar intento en usuario inactivo
            descripcion = (
                "Intento de cambio de contraseña | "
                "Resultado: RECHAZADO | "
                "Motivo: Usuario inactivo | "
                f"Usuario afectado: {user.usuario} | "
                f"IP: {request.client.host if request.client else 'N/A'} | "
                f"User-Agent: {request.headers.get('user-agent', 'N/A')}"
            )
            
            registrar_auditoria(
                db=db,
                accion="CAMBIO_RECHAZADO",
                descripcion=descripcion,
                id_usuario=current_user.id_usuario_sistema
            )
            
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El usuario está inactivo"
            )
        
        # ✅ Verificar contraseña actual
        # (Solo si el usuario cambia su propia contraseña o no es admin)
        if not can_change_all or current_user.id_usuario_sistema == user_id:
            if not verify_password(password_data.current_password, user.clave):
                # Registrar intento fallido
                descripcion = (
                    "Intento de cambio de contraseña | "
                    "Resultado: RECHAZADO | "
                    "Motivo: Contraseña actual incorrecta | "
                    f"Usuario afectado: {user.usuario} | "
                    f"Intentado por: {current_user.usuario} | "
                    f"IP: {request.client.host if request.client else 'N/A'} | "
                    f"User-Agent: {request.headers.get('user-agent', 'N/A')}"
                )
                
                registrar_auditoria(
                    db=db,
                    accion="CAMBIO_RECHAZADO",
                    descripcion=descripcion,
                    id_usuario=current_user.id_usuario_sistema
                )
                
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="La contraseña actual es incorrecta"
                )
        
        # ✅ VALIDACIÓN COMPLETA ISO 27002
        usuario_info = {
            'usuario': user.usuario,
            'email': user.email or '',
            'nombres': user.nombres or '',
            'apellidos': user.apellidos or ''
        }
        
        es_valida, mensaje = validar_nueva_password_completa(
            db=db,
            user_id=user.id_usuario_sistema,
            nueva_password=password_data.new_password,
            password_actual=user.clave,
            usuario_info=usuario_info
        )
        
        if not es_valida:
            # Registrar rechazo por validación
            descripcion = (
                "Intento de cambio de contraseña | "
                "Resultado: RECHAZADO | "
                f"Motivo: {mensaje} | "
                f"Usuario afectado: {user.usuario} | "
                f"Intentado por: {current_user.usuario} | "
                f"IP: {request.client.host if request.client else 'N/A'} | "
                f"User-Agent: {request.headers.get('user-agent', 'N/A')}"
            )
            
            registrar_auditoria(
                db=db,
                accion="CAMBIO_RECHAZADO",
                descripcion=descripcion,
                id_usuario=current_user.id_usuario_sistema
            )
            
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=mensaje
            )
        
        # ✅ GUARDAR CONTRASEÑA ANTERIOR EN HISTORIAL
        is_admin_change = can_change_all and current_user.id_usuario_sistema != user.id_usuario_sistema
        
        agregar_al_historial(
            db=db,
            user_id=user.id_usuario_sistema,
            password_hash=user.clave,  # Hash actual antes de cambiar
            motivo="cambio_admin" if is_admin_change else "cambio_voluntario",
            by_admin=is_admin_change,
            ip=request.client.host if request.client else None
        )
        
        # ✅ ACTUALIZAR CONTRASEÑA
        user.clave = hash_password(password_data.new_password)
        user.ultimo_acceso = datetime.now()
        
        db.commit()
        
        # ✅ REGISTRAR AUDITORÍA DE ÉXITO
        if is_admin_change:
            descripcion = (
                "Cambio de contraseña administrativo | "
                "Resultado: EXITOSO | "
                f"Usuario afectado: {user.usuario} | "
                f"Cambiado por admin: {current_user.usuario} | "
                f"IP: {request.client.host if request.client else 'N/A'} | "
                f"User-Agent: {request.headers.get('user-agent', 'N/A')}"
            )
        else:
            descripcion = (
                "Cambio de contraseña | "
                "Resultado: EXITOSO | "
                f"Usuario: {user.usuario} | "
                "Cambio realizado por el propio usuario | "
                f"IP: {request.client.host if request.client else 'N/A'} | "
                f"User-Agent: {request.headers.get('user-agent', 'N/A')}"
            )
        
        registrar_auditoria(
            db=db,
            accion="CAMBIO_EXITOSO",
            descripcion=descripcion,
            id_usuario=current_user.id_usuario_sistema
        )
        
        return {
            "success": True,
            "message": "Contraseña actualizada exitosamente. La nueva contraseña cumple con las políticas de seguridad ISO 27002."
        }
    
    except HTTPException:
        # Re-raise HTTP exceptions (ya tienen el formato correcto)
        raise
    
    except Exception as e:
        db.rollback()
        print(f"❌ Error al cambiar contraseña: {e}")
        import traceback
        traceback.print_exc()
        
        # Registrar error en auditoría
        try:
            descripcion = (
                "Error al cambiar contraseña | "
                f"Usuario afectado ID: {user_id} | "
                f"Error: {str(e)[:200]} | "
                f"IP: {request.client.host if request.client else 'N/A'}"
            )
            
            registrar_auditoria(
                db=db,
                accion="ERROR",
                descripcion=descripcion,
                id_usuario=current_user.id_usuario_sistema if 'current_user' in locals() else None
            )
        except:
            pass
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al cambiar contraseña"
        )

# ========================================
# CAMBIAR CONTRASEÑA (Usuario Autenticado)
# ========================================
@router.put("/change-password", response_model=dict)
def change_password(
    password_data: ChangePasswordRequest,
    request: Request,
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Cambia la contraseña del usuario autenticado
    Incluye validaciones ISO 27002:
    - Complejidad estricta
    - No reutilización (últimas 5)
    - No información personal
    - Auditoría completa
    """
    try:
        # Obtener usuario desde token
        usuario = payload.get("sub")
        db_user = db.query(UsuarioSistema).filter(
            UsuarioSistema.usuario == usuario
        ).first()

        if not db_user:
            return {
                "success": False,
                "message": "Usuario no encontrado"
            }

        # Verificar que usuario esté activo
        if not db_user.activo:
            return {
                "success": False,
                "message": "Usuario inactivo"
            }

        # Verificar contraseña actual
        if not verify_password(password_data.current_password, db_user.clave):
            # Registrar intento fallido en auditoría
            descripcion = (
                "Cambio de contraseña | "
                "Resultado: RECHAZADO | "
                "Motivo: Contraseña actual incorrecta | "
                f"IP: {request.client.host if request.client else 'N/A'} | "
                f"User-Agent: {request.headers.get('user-agent', 'N/A')}"
            )

            registrar_auditoria(
                db=db,
                accion="CAMBIO_RECHAZADO",
                descripcion=descripcion,
                id_usuario=db_user.id_usuario_sistema
            )

            return {
                "success": False,
                "message": "La contraseña actual es incorrecta"
            }

        # ✅ VALIDACIÓN COMPLETA ISO 27002
        usuario_info = {
            'usuario': db_user.usuario,
            'email': db_user.email,
            'nombres': db_user.nombres,
            'apellidos': db_user.apellidos
        }

        es_valida, mensaje = validar_nueva_password_completa(
            db=db,
            user_id=db_user.id_usuario_sistema,
            nueva_password=password_data.new_password,
            password_actual=db_user.clave,
            usuario_info=usuario_info
        )

        if not es_valida:
            # Registrar rechazo
            # Registrar intento fallido en auditoría
            descripcion = (
                "Cambio de contraseña | "
                "Resultado: RECHAZADO | "
                f"Motivo: {mensaje} | "
                f"IP: {request.client.host if request.client else 'N/A'} | "
                f"User-Agent: {request.headers.get('user-agent', 'N/A')}"
            )

            registrar_auditoria(
                db=db,
                accion="CAMBIO_RECHAZADO",
                descripcion=descripcion,
                id_usuario=db_user.id_usuario_sistema
            )


            return {
                "success": False,
                "message": mensaje
            }

        # ✅ GUARDAR CONTRASEÑA ANTERIOR EN HISTORIAL
        agregar_al_historial(
            db=db,
            user_id=db_user.id_usuario_sistema,
            password_hash=db_user.clave,  # Hash actual antes de cambiar
            motivo="cambio_voluntario",
            by_admin=False,
            ip=request.client.host if request.client else None
        )

        # ✅ ACTUALIZAR CONTRASEÑA (usar tu función de hash existente)
        db_user.clave = hash_password(password_data.new_password)
        db_user.ultimo_acceso = datetime.now()
        db.commit()

        # ✅ REGISTRAR AUDITORÍA DE ÉXITO
        descripcion = (
            "Auditoría cambio de contraseña | "
            "Resultado: EXITOSO | "
            "Cambio realizado por el usuario | "
            f"IP: {request.client.host if request.client else 'N/A'} | "
            f"User-Agent: {request.headers.get('user-agent', 'N/A')}"
        )

        registrar_auditoria(
            db=db,
            accion="CAMBIO_EXITOSO",
            descripcion=descripcion,
            id_usuario=db_user.id_usuario_sistema
        )


        return {
            "success": True,
            "message": "Contraseña actualizada exitosamente. Tu nueva contraseña cumple con las políticas de seguridad ISO 27002."
        }

    except Exception as e:
        print(f"❌ Error al cambiar contraseña: {e}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "message": "Error interno al cambiar contraseña"
        }


# ========================================
# CAMBIAR CONTRASEÑA (PRIMER LOGIN)
# ========================================
@router.put("/change-password-first-login/{user_id}", response_model=dict)
def change_password_first_login(
    user_id: int,
    password_data: ChangePasswordFirstLoginRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Permite cambiar contraseña en primer login
    Sin verificar contraseña actual
    Con validaciones ISO 27002 completas
    """
    try:
        db_user = db.query(UsuarioSistema).filter(
            UsuarioSistema.id_usuario_sistema == user_id
        ).first()

        if not db_user:
            return {
                "success": False,
                "message": "Usuario no encontrado"
            }

        # ✅ VALIDACIÓN COMPLETA ISO 27002
        usuario_info = {
            'usuario': db_user.usuario,
            'email': db_user.email,
            'nombres': db_user.nombres,
            'apellidos': db_user.apellidos
        }

        es_valida, mensaje = validar_nueva_password_completa(
            db=db,
            user_id=db_user.id_usuario_sistema,
            nueva_password=password_data.new_password,
            password_actual=None,  # No verificar actual en primer login
            usuario_info=usuario_info
        )

        if not es_valida:
            # Registrar rechazo
            descripcion = (
                "Primer login | "
                "Resultado: RECHAZADO | "
                f"Motivo: {mensaje} | "
                f"IP: {request.client.host if request.client else 'N/A'} | "
                f"User-Agent: {request.headers.get('user-agent', 'N/A')}"
            )

            registrar_auditoria(
                db=db,
                accion="PRIMER_LOGIN_RECHAZADO",
                descripcion=descripcion,
                id_usuario=db_user.id_usuario_sistema
            )


            return {
                "success": False,
                "message": mensaje
            }

        # ✅ GUARDAR CONTRASEÑA TEMPORAL EN HISTORIAL
        agregar_al_historial(
            db=db,
            user_id=db_user.id_usuario_sistema,
            password_hash=db_user.clave,
            motivo="primer_login",
            by_admin=False,
            ip=request.client.host if request.client else None
        )

        # ✅ ACTUALIZAR CONTRASEÑA
        db_user.clave = hash_password(password_data.new_password)
        db_user.ultimo_acceso = datetime.now()

        # Marcar primer login como completado si existe el campo
        if hasattr(db_user, 'primer_login'):
            db_user.primer_login = False

        db.commit()

        # ✅ REGISTRAR AUDITORÍA
        descripcion = (
            "Primer login | "
            "Resultado: EXITOSO | "
            "Cambio de contraseña inicial realizado | "
            f"IP: {request.client.host if request.client else 'N/A'} | "
            f"User-Agent: {request.headers.get('user-agent', 'N/A')}"
        )

        registrar_auditoria(
            db=db,
            accion="PRIMER_LOGIN_EXITOSO",
            descripcion=descripcion,
            id_usuario=db_user.id_usuario_sistema
        )

        return {
            "success": True,
            "message": "Contraseña actualizada exitosamente. Ya puedes iniciar sesión con tu nueva contraseña."
        }

    except Exception as e:
        print(f"❌ Error en primer login: {e}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "message": "Error interno al cambiar contraseña"
        }


# ========================================
# RESETEAR CONTRASEÑA (Admin)
# ========================================
@router.put("/admin/reset-password", response_model=dict)
def admin_reset_password(
    password_data: ResetPasswordRequest,
    request: Request,
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Permite a un administrador resetear la contraseña de cualquier usuario
    Requiere permisos de administrador
    """
    try:
        # Verificar que quien hace el reset es admin
        admin_user = payload.get("sub")
        db_admin = db.query(UsuarioSistema).filter(
            UsuarioSistema.usuario == admin_user
        ).first()

        if not db_admin:
            return {
                "success": False,
                "message": "Administrador no encontrado"
            }

        # Verificar rol de admin (ajustar según tu sistema)
        if not hasattr(db_admin, 'id_rol') or db_admin.id_rol != 1:  # Ajustar ID del rol admin
            return {
                "success": False,
                "message": "No tienes permisos de administrador"
            }

        # Obtener usuario a resetear
        db_user = db.query(UsuarioSistema).filter(
            UsuarioSistema.id_usuario_sistema == password_data.user_id
        ).first()

        if not db_user:
            return {
                "success": False,
                "message": "Usuario no encontrado"
            }

        # ✅ VALIDACIÓN ISO 27002
        usuario_info = {
            'usuario': db_user.usuario,
            'email': db_user.email,
            'nombres': db_user.nombres,
            'apellidos': db_user.apellidos
        }

        es_valida, mensaje = validar_nueva_password_completa(
            db=db,
            user_id=db_user.id_usuario_sistema,
            nueva_password=password_data.new_password,
            password_actual=None,
            usuario_info=usuario_info
        )

        if not es_valida:
            descripcion = (
                "Reset de contraseña por administrador | "
                "Resultado: RECHAZADO | "
                f"Admin: {admin_user} | "
                f"Motivo: {mensaje} | "
                f"IP: {request.client.host if request.client else 'N/A'} | "
                f"User-Agent: {request.headers.get('user-agent', 'N/A')}"
            )

            registrar_auditoria(
                db=db,
                accion="ADMIN_RESET_RECHAZADO",
                descripcion=descripcion,
                id_usuario=db_user.id_usuario_sistema
            )


            return {
                "success": False,
                "message": mensaje
            }

        # ✅ GUARDAR EN HISTORIAL
        agregar_al_historial(
            db=db,
            user_id=db_user.id_usuario_sistema,
            password_hash=db_user.clave,
            motivo="admin_reset",
            by_admin=True,
            ip=request.client.host if request.client else None
        )

        # ✅ ACTUALIZAR CONTRASEÑA
        db_user.clave = hash_password(password_data.new_password)

        # Forzar cambio en próximo login
        if hasattr(db_user, 'primer_login'):
            db_user.primer_login = True

        # Desbloquear cuenta si estaba bloqueada
        if hasattr(db_user, 'intentos_fallidos'):
            db_user.intentos_fallidos = 0
        if hasattr(db_user, 'bloqueado_hasta'):
            db_user.bloqueado_hasta = None
        if hasattr(db_user, 'bloqueado_permanente'):
            db_user.bloqueado_permanente = False

        db.commit()

        # ✅ AUDITORÍA
        descripcion = (
            "Reset de contraseña por administrador | "
            "Resultado: EXITOSO | "
            f"Admin: {admin_user} | "
            "Contraseña restablecida correctamente | "
            f"IP: {request.client.host if request.client else 'N/A'} | "
            f"User-Agent: {request.headers.get('user-agent', 'N/A')}"
        )

        registrar_auditoria(
            db=db,
            accion="ADMIN_RESET_EXITOSO",
            descripcion=descripcion,
            id_usuario=db_user.id_usuario_sistema
        )


        return {
            "success": True,
            "message": f"Contraseña de {db_user.usuario} reseteada exitosamente. El usuario deberá cambiarla en su próximo login."
        }

    except Exception as e:
        print(f"❌ Error en reset de contraseña: {e}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "message": "Error interno al resetear contraseña"
        }


# ========================================
# OBTENER HISTORIAL (Admin)
# ========================================
@router.get("/admin/password-history/{user_id}", response_model=dict)
def get_password_history(
    user_id: int,
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Obtiene el historial de contraseñas de un usuario (solo admin)"""
    try:
        from services.password_service import obtener_historial_usuario

        # Verificar permisos de admin
        admin_user = payload.get("sub")
        db_admin = db.query(UsuarioSistema).filter(
            UsuarioSistema.usuario == admin_user
        ).first()

        if not db_admin or db_admin.id_rol != 1:
            return {
                "success": False,
                "message": "No tienes permisos"
            }

        historial = obtener_historial_usuario(db, user_id)

        return {
            "success": True,
            "data": historial
        }

    except Exception as e:
        print(f"❌ Error obteniendo historial: {e}")
        return {
            "success": False,
            "message": "Error al obtener historial"
        }

# ========================================
# SUBIR FOTO DE PERFIL
# ========================================
@router.post("/{user_id}/upload-photo", response_model=UserResponse)
async def upload_user_photo(
    user_id: int,
    file: UploadFile = File(...),
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Sube o actualiza la foto de perfil de un usuario
    Admin o el mismo usuario pueden actualizar
    """
    current_user = get_current_user(payload, db)
    
    # Verificar permisos
    can_update_all = check_permission(current_user, db, "usuarios", "actualizar")
    
    if not can_update_all and current_user.id_usuario_sistema != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para actualizar esta foto"
        )
    
    # Obtener usuario
    user = db.query(UsuarioSistema).filter(
        UsuarioSistema.id_usuario_sistema == user_id
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    
    # Validar tipo de archivo
    if not file.content_type.startswith('image/'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo debe ser una imagen"
        )
    
    # Leer archivo
    contents = await file.read()
    
    # Validar tamaño (máximo 2MB)
    if len(contents) > 2 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La imagen no debe superar los 2MB"
        )
    
    # Guardar foto en la base de datos
    user.foto = contents
    
    try:
        db.commit()
        db.refresh(user)
        
        return user_to_response(user, db)
    
    except Exception as e:
        db.rollback()
        print(f"Error al subir foto: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al guardar la foto"
        )

# ========================================
# DESBLOQUEAR USUARIO (ADMINISTRADOR)
# ========================================
@router.post("/{user_id}/unlock", status_code=status.HTTP_200_OK)
def unlock_user_account(
    user_id: int,
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Desbloquea un usuario y resetea sus intentos fallidos
    Requiere permiso: usuarios.actualizar o usuarios.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "usuarios", "actualizar")
    
    user = db.query(UsuarioSistema).filter(
        UsuarioSistema.id_usuario_sistema == user_id
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    
    was_permanently_blocked = user.bloqueado_permanente
    was_temporarily_blocked = user.bloqueado_hasta is not None
    previous_attempts = user.intentos_fallidos
    
    # Resetear bloqueos
    user.intentos_fallidos = 0
    user.bloqueado_hasta = None
    user.bloqueado_permanente = False
    
    try:
        db.commit()
        db.refresh(user)
        
        if was_permanently_blocked:
            message = f"Usuario '{user.usuario}' desbloqueado exitosamente (bloqueo permanente removido)"
        elif was_temporarily_blocked:
            message = f"Usuario '{user.usuario}' desbloqueado exitosamente (bloqueo temporal removido)"
        else:
            message = f"Intentos fallidos reseteados para '{user.usuario}'"
        
        return {
            "success": True,
            "message": message,
            "data": {
                "usuario": user.usuario,
                "intentos_previos": previous_attempts,
                "bloqueado_permanente_previo": was_permanently_blocked,
                "bloqueado_temporal_previo": was_temporarily_blocked
            }
        }
    
    except Exception as e:
        db.rollback()
        print(f"Error al desbloquear usuario: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al desbloquear el usuario"
        )

# ========================================
# OBTENER ESTADO DE BLOQUEO
# ========================================
@router.get("/{user_id}/lock-status", status_code=status.HTTP_200_OK)
def get_user_lock_status(
    user_id: int,
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Obtiene el estado de bloqueo de un usuario
    Admin puede ver cualquier usuario, usuario normal solo el suyo
    """
    # Verificar permisos
    if payload.get("rol") != "administrador":
        current_user = db.query(UsuarioSistema).filter(
            UsuarioSistema.usuario == payload["sub"]
        ).first()
        
        if not current_user or current_user.id_usuario_sistema != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para ver este estado"
            )
    
    user = db.query(UsuarioSistema).filter(
        UsuarioSistema.id_usuario_sistema == user_id
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    
    # Calcular si el bloqueo temporal está activo
    bloqueado_temporal_activo = False
    tiempo_restante_minutos = None
    
    if user.bloqueado_hasta:
        ahora = datetime.now()
        if user.bloqueado_hasta > ahora:
            bloqueado_temporal_activo = True
            tiempo_restante = user.bloqueado_hasta - ahora
            tiempo_restante_minutos = int(tiempo_restante.total_seconds() / 60)
    
    return {
        "success": True,
        "data": {
            "usuario": user.usuario,
            "intentos_fallidos": user.intentos_fallidos,
            "bloqueado_permanente": user.bloqueado_permanente,
            "bloqueado_temporal_activo": bloqueado_temporal_activo,
            "bloqueado_hasta": user.bloqueado_hasta.isoformat() if user.bloqueado_hasta else None,
            "tiempo_restante_minutos": tiempo_restante_minutos,
            "intentos_restantes_para_bloqueo_temporal": max(0, 5 - (user.intentos_fallidos % 5)),
            "intentos_restantes_para_bloqueo_permanente": max(0, 10 - user.intentos_fallidos)
        }
    }


# ========================================
# LISTAR USUARIOS BLOQUEADOS
# ========================================
@router.get("/admin/blocked-users", status_code=status.HTTP_200_OK)
def get_blocked_users(
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Lista todos los usuarios bloqueados
    Solo admin puede acceder
    """
    # Verificar que el usuario sea admin
    if payload.get("rol") != "administrador":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para ver usuarios bloqueados"
        )
    
    ahora = datetime.now()
    
    # Usuarios con bloqueo permanente
    permanently_blocked = db.query(UsuarioSistema).filter(
        UsuarioSistema.bloqueado_permanente == True
    ).all()
    
    # Usuarios con bloqueo temporal activo
    temporarily_blocked = db.query(UsuarioSistema).filter(
        UsuarioSistema.bloqueado_hasta > ahora,
        UsuarioSistema.bloqueado_permanente == False
    ).all()
    
    # Usuarios con intentos fallidos pero no bloqueados
    users_with_attempts = db.query(UsuarioSistema).filter(
        UsuarioSistema.intentos_fallidos > 0,
        UsuarioSistema.bloqueado_permanente == False,
        or_(
            UsuarioSistema.bloqueado_hasta == None,
            UsuarioSistema.bloqueado_hasta <= ahora
        )
    ).all()
    
    def format_user_lock_info(user):
        tiempo_restante = None
        if user.bloqueado_hasta and user.bloqueado_hasta > ahora:
            tiempo_restante = int((user.bloqueado_hasta - ahora).total_seconds() / 60)
        
        return {
            "id": user.id_usuario_sistema,
            "usuario": user.usuario,
            "nombre_completo": f"{user.nombres} {user.apellidos}",
            "email": user.email,
            "intentos_fallidos": user.intentos_fallidos,
            "bloqueado_permanente": user.bloqueado_permanente,
            "bloqueado_hasta": user.bloqueado_hasta.isoformat() if user.bloqueado_hasta else None,
            "tiempo_restante_minutos": tiempo_restante
        }
    
    return {
        "success": True,
        "data": {
            "permanently_blocked": [format_user_lock_info(u) for u in permanently_blocked],
            "temporarily_blocked": [format_user_lock_info(u) for u in temporarily_blocked],
            "users_with_attempts": [format_user_lock_info(u) for u in users_with_attempts],
            "total_permanently_blocked": len(permanently_blocked),
            "total_temporarily_blocked": len(temporarily_blocked),
            "total_with_attempts": len(users_with_attempts)
        }
    }
# ========================================
# CREAR USUARIOS MASIVAMENTE DESDE EXCEL
# ========================================
# En el endpoint, reemplaza la validación de máximo:

@router.post("/bulk", response_model=UserBulkResponse, status_code=status.HTTP_201_CREATED)
def create_users_bulk(
    request: UserBulkCreateRequest,
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Crea múltiples usuarios desde Excel.
    
    ✅ AHORA SOPORTA:
       - Máximo: 500 usuarios por carga (mejorado de 100)
       - Procesamiento en lotes para mejor rendimiento
       - Validaciones de duplicados más eficientes
    """
    
    # Verificar permisos
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "usuarios", "crear")
    
    # ✅ VALIDAR MÁXIMO 500 USUARIOS
    if len(request.users) > 500:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Máximo 500 usuarios por carga. Enviaste: {len(request.users)}"
        )
    
    exitosos = []
    fallidos = []
    
    print(f"\n{'='*60}")
    print(f"🚀 INICIANDO CARGA MASIVA DE {len(request.users)} USUARIOS")
    print(f"{'='*60}\n")
    
    # ===============================
    # 🔄 Procesar cada usuario
    # ===============================
    for index, user_data in enumerate(request.users, start=1):
        fila_numero = index
        
        try:
            print(f"📝 Procesando fila {fila_numero}: {user_data.nombres} {user_data.apellidos}")
            
            # ===============================
            # 1️⃣ Normalizar y generar usuario
            # ===============================
            primer_nombre = user_data.nombres.strip().split()[0].lower()
            # Remover acentos
            primer_nombre = (primer_nombre
                .replace('á', 'a').replace('é', 'e').replace('í', 'i')
                .replace('ó', 'o').replace('ú', 'u').replace('ñ', 'n'))
            
            base_username = primer_nombre
            username = base_username
            
            # Si existe, agregar año o contador
            counter = 1
            while db.query(UsuarioSistema).filter(UsuarioSistema.usuario == username).first():
                if user_data.fecha_nac:
                    username = f"{base_username}{user_data.fecha_nac.year}"
                    if db.query(UsuarioSistema).filter(UsuarioSistema.usuario == username).first():
                        username = f"{base_username}{user_data.fecha_nac.year}{counter}"
                        counter += 1
                else:
                    username = f"{base_username}{counter}"
                    counter += 1
            
            # ===============================
            # 2️⃣ Generar contraseña = CÉDULA
            # ===============================
            raw_password = user_data.cedula.strip()
            hashed_password = hash_password(raw_password)
            
            # ===============================
            # 3️⃣ Verificar duplicados
            # ===============================
            existing = db.query(UsuarioSistema).filter(
                or_(
                    UsuarioSistema.email == user_data.email.lower(),
                    UsuarioSistema.cedula == user_data.cedula
                )
            ).first()
            
            if existing:
                if existing.email == user_data.email.lower():
                    error_msg = "Email ya registrado"
                else:
                    error_msg = "Cédula ya registrada"
                
                print(f"   ❌ Error: {error_msg}")
                fallidos.append(UserBulkError(
                    fila=fila_numero,
                    nombre=f"{user_data.nombres} {user_data.apellidos}",
                    email=user_data.email,
                    cedula=user_data.cedula,
                    error=error_msg
                ))
                continue
            
            # ===============================
            # 4️⃣ Crear usuario con ROL CLIENTE (4) y ACTIVO
            # ===============================
            new_user = UsuarioSistema(
                usuario=username,
                clave=hashed_password,
                nombres=user_data.nombres.strip(),
                apellidos=user_data.apellidos.strip(),
                sexo=user_data.sexo.strip().upper(),
                fecha_nac=user_data.fecha_nac,
                cedula=user_data.cedula.strip(),
                email=user_data.email.strip().lower(),
                telefono=user_data.telefono.strip() if user_data.telefono else None,
                direccion=user_data.direccion.strip() if user_data.direccion else "Sanjapamba",
                id_rol=4,  # ✅ SIEMPRE ROL CLIENTE
                activo=True,  # ✅ SIEMPRE ACTIVO
                fecha_registro=datetime.now()
            )
            
            db.add(new_user)
            db.flush()  # Guardar sin hacer commit aún
            
            print(f"   ✅ Usuario creado: {username}")
            
            # Agregar a exitosos
            exitosos.append(UserBulkResult(
                fila=fila_numero,
                usuario=username,
                contraseña=raw_password,
                nombre=f"{user_data.nombres} {user_data.apellidos}",
                email=user_data.email,
                cedula=user_data.cedula
            ))
            
        except ValueError as ve:
            # Error de validación
            print(f"   ❌ Error de validación: {str(ve)}")
            fallidos.append(UserBulkError(
                fila=fila_numero,
                nombre=f"{user_data.nombres} {user_data.apellidos}",
                email=user_data.email,
                cedula=user_data.cedula,
                error=f"Validación: {str(ve)}"
            ))
            
        except IntegrityError as ie:
            db.rollback()
            print(f"   ❌ Error de integridad: {str(ie)}")
            
            # Determinar el tipo de error
            if "email" in str(ie).lower():
                error_msg = "Email duplicado"
            elif "cedula" in str(ie).lower():
                error_msg = "Cédula duplicada"
            elif "usuario" in str(ie).lower():
                error_msg = "Usuario duplicado"
            else:
                error_msg = "Error de base de datos"
            
            fallidos.append(UserBulkError(
                fila=fila_numero,
                nombre=f"{user_data.nombres} {user_data.apellidos}",
                email=user_data.email,
                cedula=user_data.cedula,
                error=error_msg
            ))
            
        except Exception as e:
            db.rollback()
            print(f"   ❌ Error inesperado: {str(e)}")
            fallidos.append(UserBulkError(
                fila=fila_numero,
                nombre=f"{user_data.nombres} {user_data.apellidos}",
                email=user_data.email if hasattr(user_data, 'email') else None,
                cedula=user_data.cedula if hasattr(user_data, 'cedula') else None,
                error=f"Error: {str(e)}"
            ))
    
    # ===============================
    # 5️⃣ Guardar todos los cambios
    # ===============================
    try:
        db.commit()
        print(f"\n✅ Commit exitoso - {len(exitosos)} usuarios guardados")
        
        # Registrar auditoría
        registrar_auditoria(
            db=db,
            accion="BULK_CREATE",
            descripcion=f"Carga masiva: {len(exitosos)} usuarios creados por '{payload['sub']}'",
            id_usuario=current_user.id_usuario_sistema
        )
        
        # Notificación
        registrar_notificacion(
            db=db,
            id_usuario=current_user.id_usuario_sistema,
            titulo="Carga masiva completada",
            mensaje=f"Se crearon {len(exitosos)} usuarios correctamente. {len(fallidos)} errores.",
            tipo="exito" if len(fallidos) == 0 else "advertencia"
        )
        
    except Exception as e:
        db.rollback()
        print(f"\n❌ Error al hacer commit: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al guardar usuarios: {str(e)}"
        )
    
    # ===============================
    # 6️⃣ Retornar resumen
    # ===============================
    print(f"\n{'='*60}")
    print(f"📊 RESUMEN DE CARGA MASIVA")
    print(f"{'='*60}")
    print(f"✅ Exitosos: {len(exitosos)}")
    print(f"❌ Fallidos: {len(fallidos)}")
    print(f"📝 Total procesados: {len(request.users)}")
    print(f"{'='*60}\n")
    
    return UserBulkResponse(
        exitosos=exitosos,
        fallidos=fallidos,
        total_procesados=len(request.users),
        total_exitosos=len(exitosos),
        total_fallidos=len(fallidos)
    )
