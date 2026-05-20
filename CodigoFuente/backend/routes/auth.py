# routes/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from schemas.user import UserLogin
from models.user import UsuarioSistema
from models.role import Rol, RolAccion
from db.session import SessionLocal
from security.jwt import create_access_token, verify_token
from security.password import verify_password, hash_password
import base64
from secrets import token_urlsafe
import secrets
import string
from utils.config import get_bloqueo_config, get_verificacion_config
from utils.email import email_service

router = APIRouter(tags=["auth"])

# ========================================
# CONFIGURACIÓN DE BLOQUEO
# ========================================


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

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

# ========================================
# FUNCIONES DE ROLES Y PERMISOS
# ========================================
def get_user_role_and_permissions(db: Session, user: UsuarioSistema) -> dict:
    """
    Obtiene el rol y permisos del usuario
    El usuario tiene UN solo rol (id_rol) que tiene múltiples acciones
    """
    if not user.id_rol:
        return {
            "rol": None,
            "permisos": []
        }
    
    # Obtener información del rol
    rol = db.query(Rol).filter(
        Rol.id_rol == user.id_rol,
        Rol.activo == True
    ).first()
    
    if not rol:
        return {
            "rol": None,
            "permisos": []
        }
    
    # Obtener acciones/permisos del rol
    acciones = db.query(RolAccion).filter(
        RolAccion.id_rol == user.id_rol,
        RolAccion.activo == True
    ).all()
    
    # Formatear rol
    rol_data = {
        "id_rol": rol.id_rol,
        "nombre_rol": rol.nombre_rol,
        "descripcion": rol.descripcion
    }
    
    # Formatear permisos
    permisos_data = [
        {
            "id_rol_accion": accion.id_rol_accion,
            "nombre_accion": accion.nombre_accion,
            "tipo_accion": accion.tipo_accion
        }
        for accion in acciones
    ]
    
    return {
        "rol": rol_data,
        "permisos": permisos_data
    }

# ========================================
# FUNCIONES DE CONTROL DE BLOQUEO
# ========================================
# ========================================
# FUNCIONES DE CONTROL DE BLOQUEO (CON CONFIG DINÁMICA)
# ========================================
def verificar_activo_bloqueo(user: UsuarioSistema) -> dict:
    """Verifica el estado de bloqueo del usuario"""
    ahora = datetime.now()
    
    if hasattr(user, 'bloqueado_permanente') and user.bloqueado_permanente:
        return {
            "bloqueado": True,
            "tipo": "permanente",
            "mensaje": "Tu cuenta ha sido bloqueada permanentemente por exceso de intentos fallidos. Por favor, contacta al administrador."
        }
    
    if hasattr(user, 'bloqueado_hasta') and user.bloqueado_hasta and user.bloqueado_hasta > ahora:
        tiempo_restante = user.bloqueado_hasta - ahora
        minutos_restantes = int(tiempo_restante.total_seconds() / 60)
        return {
            "bloqueado": True,
            "tipo": "temporal",
            "mensaje": f"Cuenta bloqueada temporalmente. Intenta nuevamente en {minutos_restantes} minutos.",
            "bloqueado_hasta": user.bloqueado_hasta.isoformat()
        }
    
    if hasattr(user, 'bloqueado_hasta') and user.bloqueado_hasta and user.bloqueado_hasta <= ahora:
        user.bloqueado_hasta = None
    
    return {"bloqueado": False, "tipo": None, "mensaje": None}


def registrar_intento_fallido(db: Session, user: UsuarioSistema) -> dict:
    """
    Registra un intento fallido y aplica bloqueos según configuración dinámica
    ✅ AHORA LEE DE LA BASE DE DATOS
    """
    # ✅ Obtener configuraciones dinámicas
    config = get_bloqueo_config(db)
    MAX_INTENTOS_TEMPORALES = config['MAX_INTENTOS_TEMPORALES']
    TIEMPO_BLOQUEO_TEMPORAL = config['TIEMPO_BLOQUEO_TEMPORAL']
    MAX_INTENTOS_PERMANENTES = config['MAX_INTENTOS_PERMANENTES']
    
    if not hasattr(user, 'intentos_fallidos') or user.intentos_fallidos is None:
        user.intentos_fallidos = 0
    
    user.intentos_fallidos += 1
    intentos_actuales = user.intentos_fallidos
    
    # Bloqueo permanente
    if intentos_actuales >= MAX_INTENTOS_PERMANENTES:
        if hasattr(user, 'bloqueado_permanente'):
            user.bloqueado_permanente = True
        if hasattr(user, 'bloqueado_hasta'):
            user.bloqueado_hasta = None
        db.commit()
        return {
            "bloqueado": True,
            "tipo": "permanente",
            "intentos": intentos_actuales,
            "mensaje": "Tu cuenta ha sido bloqueada permanentemente. Contacta al administrador."
        }
    
    # Bloqueo temporal
    if intentos_actuales % MAX_INTENTOS_TEMPORALES == 0:
        if hasattr(user, 'bloqueado_hasta'):
            user.bloqueado_hasta = datetime.now() + timedelta(minutes=TIEMPO_BLOQUEO_TEMPORAL)
        db.commit()
        return {
            "bloqueado": True,
            "tipo": "temporal",
            "intentos": intentos_actuales,
            "mensaje": f"Cuenta bloqueada temporalmente por {TIEMPO_BLOQUEO_TEMPORAL} minutos debido a múltiples intentos fallidos.",
            "bloqueado_hasta": user.bloqueado_hasta.isoformat() if hasattr(user, 'bloqueado_hasta') and user.bloqueado_hasta else None,
            "intentos_restantes": MAX_INTENTOS_PERMANENTES - intentos_actuales
        }
    
    db.commit()
    intentos_restantes_temporal = MAX_INTENTOS_TEMPORALES - (intentos_actuales % MAX_INTENTOS_TEMPORALES)
    intentos_restantes_permanente = MAX_INTENTOS_PERMANENTES - intentos_actuales
    
    return {
        "bloqueado": False,
        "tipo": "advertencia",
        "intentos": intentos_actuales,
        "mensaje": f"Contraseña Incorrecta. Te quedan {intentos_restantes_temporal} intentos antes de que tu cuenta sea bloqueada temporalmente.",
        "intentos_restantes_temporal": intentos_restantes_temporal,
        "intentos_restantes_permanente": intentos_restantes_permanente
    }

def resetear_intentos_fallidos(db: Session, user: UsuarioSistema):
    """Resetea los intentos fallidos tras un login exitoso"""
    if hasattr(user, 'intentos_fallidos'):
        user.intentos_fallidos = 0
    if hasattr(user, 'bloqueado_hasta'):
        user.bloqueado_hasta = None
    if hasattr(user, 'ultimo_acceso'):
        user.ultimo_acceso = datetime.now()
    db.commit()
    

# ========================================
# LOGIN - CON CONFIGURACIÓN DINÁMICA
# ========================================
@router.post("/login", response_model=dict)
def login(user: UserLogin, db: Session = Depends(get_db)):
    """Inicia sesión con usuario y contraseña usando configuración dinámica"""
    try:
        db_user = db.query(UsuarioSistema).filter(
            UsuarioSistema.usuario == user.username.strip().lower()
        ).first()

        if not db_user:
            return {"success": False, "message": "El usuario ingresado no existe."}

        if hasattr(db_user, 'activo') and not db_user.activo:
            return {"success": False, "message": "Su usuario está inactivo. Contactese con al administrador."}

        estado_bloqueo = verificar_activo_bloqueo(db_user)
        if estado_bloqueo["bloqueado"]:
            return {
                "success": False,
                "bloqueado": True,
                "tipo_bloqueo": estado_bloqueo["tipo"],
                "message": estado_bloqueo["mensaje"],
                "bloqueado_hasta": estado_bloqueo.get("bloqueado_hasta")
            }

        # Verificar contraseña
        if not verify_password(user.password.strip(), db_user.clave):
            resultado = registrar_intento_fallido(db, db_user)  # ✅ USA CONFIG DINÁMICA
            return {
                "success": False,
                "bloqueado": resultado.get("bloqueado", False),
                "message": resultado["mensaje"]
            }

        primer_login = getattr(db_user, "primer_login", False) or db_user.ultimo_acceso is None

        db_user.ultimo_acceso = datetime.now()
        if hasattr(db_user, "primer_login"):
            db_user.primer_login = False
        db.commit()
        db.refresh(db_user)

        resetear_intentos_fallidos(db, db_user)

        rol_permisos = get_user_role_and_permissions(db, db_user)
        foto_url = process_user_photo(db_user.foto) if hasattr(db_user, 'foto') and db_user.foto else None

        token_data = {
            "sub": db_user.usuario,
            "id_rol": db_user.id_rol,
            "nombre_rol": rol_permisos["rol"]["nombre_rol"] if rol_permisos["rol"] else None,
            "nombres": db_user.nombres
        }
        access_token = create_access_token(data=token_data)

        return {
            "success": True,
            "message": "Inicio de sesión exitoso",
            "data": {
                "token": access_token,
                "user": {
                    "id_usuario_sistema": db_user.id_usuario_sistema,
                    "usuario": db_user.usuario,
                    "nombres": db_user.nombres,
                    "apellidos": db_user.apellidos,
                    "sexo": db_user.sexo,
                    "cedula": db_user.cedula,
                    "telefono": getattr(db_user, 'telefono', None),
                    "direccion": getattr(db_user, 'direccion', None),
                    "fecha_nac": db_user.fecha_nac.isoformat() if db_user.fecha_nac else None,
                    "nombre_completo": f"{db_user.nombres} {db_user.apellidos}",
                    "id_rol": db_user.id_rol,
                    "rol": rol_permisos["rol"],
                    "permisos": rol_permisos["permisos"],
                    "email": db_user.email,
                    "foto": foto_url,
                    "ultimo_acceso": db_user.ultimo_acceso.isoformat(),
                    "primer_login": primer_login
                }
            }
        }

    except Exception as e:
        print(f"❌ Error en login: {e}")
        import traceback
        traceback.print_exc()
        return {"success": False, "message": "Error interno del servidor"}


# ========================================
# VERIFICAR SESIÓN
# ========================================
@router.get("/verify-session")
def verify_session(payload: dict = Depends(verify_token), db: Session = Depends(get_db)):
    """Verifica que el token sea válido y devuelve datos del usuario con rol y permisos"""
    db_user = db.query(UsuarioSistema).filter(
        UsuarioSistema.usuario == payload["sub"]
    ).first()
    
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado"
        )
    
    if hasattr(db_user, 'activo') and not db_user.activo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario inactivo"
        )
    
    activo_bloqueo = verificar_activo_bloqueo(db_user)
    if activo_bloqueo["bloqueado"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=activo_bloqueo["mensaje"]
        )

    # ====================================================
    # ⚙️ Detectar si es el primer login y actualizar fecha
    # ====================================================
    primer_login = getattr(db_user, "primer_login", False)

    # Solo actualiza ultimo_acceso, no cambies primer_login aquí
    primer_login = db_user.ultimo_acceso is None
    if primer_login:
        db_user.ultimo_acceso = datetime.now()
        db.commit()



    # Obtener rol y permisos actualizados
    rol_permisos = get_user_role_and_permissions(db, db_user)
    foto_url = process_user_photo(db_user.foto) if hasattr(db_user, 'foto') and db_user.foto else None

    return {
        "id_usuario_sistema": db_user.id_usuario_sistema,
        "usuario": db_user.usuario,
        "nombres": db_user.nombres,
        "apellidos": db_user.apellidos,
        "sexo": db_user.sexo,
        "fecha_nac": db_user.fecha_nac.isoformat() if db_user.fecha_nac else None,
        "cedula": db_user.cedula,
        "telefono": getattr(db_user, 'telefono', None),
        "direccion": getattr(db_user, 'direccion', None),
        "nombre_completo": f"{db_user.nombres} {db_user.apellidos}",
        "email": db_user.email,
        "id_rol": db_user.id_rol,
        "rol": rol_permisos["rol"],
        "permisos": rol_permisos["permisos"],
        "fecha_registro": db_user.fecha_registro.isoformat() if db_user.fecha_registro else None,
        "foto": foto_url,
        "ultimo_acceso": db_user.ultimo_acceso.isoformat() if db_user.ultimo_acceso else None,
        "primer_login": primer_login
    }

# ========================================
# VERIFICAR PERMISO ESPECÍFICO
# ========================================
@router.post("/check-permission")
def check_permission(
    request: dict,
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Verifica si el usuario tiene un permiso específico
    Request body: {"nombre_accion": "usuarios.crear", "tipo_accion": "crear"}
    """
    db_user = db.query(UsuarioSistema).filter(
        UsuarioSistema.usuario == payload["sub"]
    ).first()
    
    if not db_user:
        return {"success": False, "has_permission": False}
    
    nombre_accion = request.get("nombre_accion")
    tipo_accion = request.get("tipo_accion")
    
    if not nombre_accion:
        return {"success": False, "message": "nombre_accion es requerido"}
    
    if not db_user.id_rol:
        return {"success": True, "has_permission": False}
    
    # Buscar la acción en el rol del usuario
    query = db.query(RolAccion).filter(
        RolAccion.id_rol == db_user.id_rol,
        RolAccion.nombre_accion == nombre_accion,
        RolAccion.activo == True
    )
    
    if tipo_accion:
        query = query.filter(RolAccion.tipo_accion == tipo_accion)
    
    accion = query.first()
    
    return {
        "success": True,
        "has_permission": accion is not None,
        "accion": {
            "nombre_accion": accion.nombre_accion,
            "tipo_accion": accion.tipo_accion
        } if accion else None
    }

# ========================================
# OBTENER PERFIL
# ========================================
@router.get("/profile")
def get_profile(payload: dict = Depends(verify_token), db: Session = Depends(get_db)):
    """Obtiene el perfil completo del usuario autenticado con rol y permisos"""
    db_user = db.query(UsuarioSistema).filter(
        UsuarioSistema.usuario == payload["sub"]
    ).first()
    
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    
    rol_permisos = get_user_role_and_permissions(db, db_user)
    foto_url = process_user_photo(db_user.foto) if hasattr(db_user, 'foto') and db_user.foto else None
    
    return {
        "id_usuario_sistema": db_user.id_usuario_sistema,
        "usuario": db_user.usuario,
        "nombres": db_user.nombres,
        "apellidos": db_user.apellidos,
        "sexo": db_user.sexo,
        "fecha_nac": db_user.fecha_nac.isoformat() if db_user.fecha_nac else None,
        "nombre_completo": f"{db_user.nombres} {db_user.apellidos}",
        "cedula": db_user.cedula,
        "email": db_user.email,
        "telefono": getattr(db_user, 'telefono', None),
        "direccion": getattr(db_user, 'direccion', None),
        "id_rol": db_user.id_rol,
        "rol": rol_permisos["rol"],
        "permisos": rol_permisos["permisos"],
        "activo": getattr(db_user, 'activo', True),
        "fecha_registro": db_user.fecha_registro.isoformat() if db_user.fecha_registro else None,
        "foto": foto_url
    }

# ========================================
# LOGOUT
# ========================================
@router.post("/logout")
def logout():
    """Cierra sesión del usuario"""
    return {
        "success": True,
        "message": "Sesión cerrada exitosamente"
    }

# ========================================
# DESBLOQUEAR USUARIO (ADMINISTRADOR)
# ========================================
@router.post("/admin/unlock-user/{user_id}")
def unlock_user(
    user_id: int,
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Permite al administrador desbloquear un usuario"""
    # Verificar si es administrador
    db_admin = db.query(UsuarioSistema).filter(
        UsuarioSistema.usuario == payload["sub"]
    ).first()
    
    if not db_admin or not db_admin.id_rol:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    # Verificar rol de administrador
    rol_admin = db.query(Rol).filter(
        Rol.id_rol == db_admin.id_rol,
        Rol.nombre_rol.ilike("administrador")
    ).first()
    
    if not rol_admin:
        raise HTTPException(status_code=403, detail="No tienes permisos para desbloquear usuarios")
    
    user = db.query(UsuarioSistema).filter(
        UsuarioSistema.id_usuario_sistema == user_id
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    
    was_permanently_blocked = getattr(user, 'bloqueado_permanente', False)
    was_temporarily_blocked = getattr(user, 'bloqueado_hasta', None) is not None
    previous_attempts = getattr(user, 'intentos_fallidos', 0)
    
    if hasattr(user, 'intentos_fallidos'):
        user.intentos_fallidos = 0
    if hasattr(user, 'bloqueado_hasta'):
        user.bloqueado_hasta = None
    if hasattr(user, 'bloqueado_permanente'):
        user.bloqueado_permanente = False
    
    db.commit()
    
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

# ========================================
# OBTENER USUARIOS BLOQUEADOS (ADMIN)
# ========================================
@router.get("/admin/blocked-users")
def get_blocked_users(
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Lista todos los usuarios bloqueados - Solo admin"""
    db_admin = db.query(UsuarioSistema).filter(
        UsuarioSistema.usuario == payload["sub"]
    ).first()
    
    if not db_admin or not db_admin.id_rol:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    rol_admin = db.query(Rol).filter(
        Rol.id_rol == db_admin.id_rol,
        Rol.nombre_rol.ilike("administrador")
    ).first()
    
    if not rol_admin:
        raise HTTPException(status_code=403, detail="No tienes permisos")
    
    ahora = datetime.now()
    query = db.query(UsuarioSistema)
    
    permanently_blocked = []
    if hasattr(UsuarioSistema, 'bloqueado_permanente'):
        permanently_blocked = query.filter(
            UsuarioSistema.bloqueado_permanente == True
        ).all()
    
    temporarily_blocked = []
    if hasattr(UsuarioSistema, 'bloqueado_hasta'):
        temporarily_blocked = query.filter(
            UsuarioSistema.bloqueado_hasta > ahora
        ).all()
        if hasattr(UsuarioSistema, 'bloqueado_permanente'):
            temporarily_blocked = [u for u in temporarily_blocked if not u.bloqueado_permanente]
    
    users_with_attempts = []
    if hasattr(UsuarioSistema, 'intentos_fallidos'):
        users_with_attempts = query.filter(
            UsuarioSistema.intentos_fallidos > 0
        ).all()
        
        users_with_attempts = [
            u for u in users_with_attempts
            if not getattr(u, 'bloqueado_permanente', False)
            and (not hasattr(u, 'bloqueado_hasta') or not u.bloqueado_hasta or u.bloqueado_hasta <= ahora)
        ]
    
    def format_user_lock_info(user):
        tiempo_restante = None
        if hasattr(user, 'bloqueado_hasta') and user.bloqueado_hasta and user.bloqueado_hasta > ahora:
            tiempo_restante = int((user.bloqueado_hasta - ahora).total_seconds() / 60)
        
        return {
            "id": user.id_usuario_sistema,
            "usuario": user.usuario,
            "nombre_completo": f"{user.nombres} {user.apellidos}",
            "email": user.email,
            "intentos_fallidos": getattr(user, 'intentos_fallidos', 0),
            "bloqueado_permanente": getattr(user, 'bloqueado_permanente', False),
            "bloqueado_hasta": user.bloqueado_hasta.isoformat() if hasattr(user, 'bloqueado_hasta') and user.bloqueado_hasta else None,
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
# HEALTH CHECK
# ========================================
@router.get("/health")
def health_check():
    """Verifica que el servidor esté funcionando"""
    return {
        "success": True,
        "status": "healthy",
        "message": "Servidor API funcionando correctamente"
    }

# ========================================
# RECUPERACIÓN DE CONTRASEÑA
# ========================================

verification_codes = {}

def generate_verification_code(db: Session) -> str:
    """Genera un código de verificación con longitud dinámica"""
    config = get_verificacion_config(db)
    length = config['VERIFICATION_CODE_LENGTH']
    return ''.join(secrets.choice(string.digits) for _ in range(length))

def store_verification_code(db: Session, key: str, code: str):
    """Almacena el código con tiempo de expiración dinámico"""
    config = get_verificacion_config(db)
    expire_minutes = config['VERIFICATION_CODE_EXPIRE_MINUTES']
    
    expiration = datetime.now() + timedelta(minutes=expire_minutes)
    verification_codes[key] = {
        "code": code,
        "expires_at": expiration,
        "attempts": 0
    }
    print(f"✅ Código almacenado para clave: {key} (expira en {expire_minutes} min)")

def verify_code(db: Session, key: str, code: str) -> dict:
    """Verifica si el código es válido con intentos máximos dinámicos"""
    config = get_verificacion_config(db)
    MAX_ATTEMPTS = config['MAX_VERIFICATION_ATTEMPTS']
    
    if key not in verification_codes:
        return {
            "valid": False, 
            "message": "No se encontró un código de verificación. Solicita uno nuevo"
        }
    
    stored_data = verification_codes[key]
    
    if datetime.now() > stored_data["expires_at"]:
        del verification_codes[key]
        return {
            "valid": False, 
            "message": "El código ha expirado. Solicita uno nuevo"
        }
    
    if stored_data["attempts"] >= MAX_ATTEMPTS:
        del verification_codes[key]
        return {
            "valid": False, 
            "message": "Demasiados intentos fallidos. Solicita un nuevo código"
        }
    
    if stored_data["code"] != code:
        stored_data["attempts"] += 1
        intentos_restantes = MAX_ATTEMPTS - stored_data["attempts"]
        
        if intentos_restantes == 0:
            del verification_codes[key]
            return {
                "valid": False,
                "message": "Demasiados intentos fallidos. Solicita un nuevo código"
            }
        
        return {
            "valid": False,
            "message": f"Código incorrecto. Te quedan {intentos_restantes} {'intento' if intentos_restantes == 1 else 'intentos'}"
        }
    
    print(f"✅ Código verificado correctamente para clave: {key}")
    return {"valid": True, "message": "Código verificado correctamente"}



def cleanup_expired_codes():
    """
    Limpia códigos expirados del diccionario
    Puedes llamar esta función periódicamente con un scheduler
    """
    expired_keys = []
    now = datetime.now()
    
    for key, data in verification_codes.items():
        if now > data["expires_at"]:
            expired_keys.append(key)
    
    for key in expired_keys:
        del verification_codes[key]
        print(f"🗑️ Código expirado eliminado: {key}")
    
    if expired_keys:
        print(f"✅ Se eliminaron {len(expired_keys)} códigos expirados")


@router.post("/forgot-password")
def forgot_password(request: dict, db: Session = Depends(get_db)):
    """Envía un código de verificación al correo del usuario"""
    try:
        email = request.get("email", "").strip().lower()
        username = request.get("username", "").strip().lower()   
        
        if not email or not username:
            return {
                "success": False,
                "message": "Usuario y correo electrónico son requeridos"
            }
        
        user = db.query(UsuarioSistema).filter(
            UsuarioSistema.usuario == username,
            UsuarioSistema.email == email
        ).first()
        
        if not user:
            return {
                "success": False,
                "message": "Usuario o correo incorrecto",
                "email_sent": False
            }

        if getattr(user, 'bloqueado_permanente', False):
            return {
                "success": False,
                "message": "Esta cuenta esta bloqueada permanentemente. Contacta al administrador para desbloquearla"
            }
        
        if hasattr(user, 'activo') and not user.activo:
            return {
                "success": False,
                "message": "Esta cuenta está inactiva. Contacta al administrador"
            }
        
        # ✅ Generar código con configuración dinámica
        verification_code = generate_verification_code(db)
        store_verification_code(db, f"{username}_{email}", verification_code)
        
        email_sent = email_service.send_verification_code(
            to_email=email,
            code=verification_code,
            username=user.usuario
        )
        
        if not email_sent:
            return {
                "success": False,
                "message": "Error al enviar el correo. Intenta nuevamente"
            }
        
        # ✅ Obtener tiempo de expiración dinámico
        config = get_verificacion_config(db)
        expire_minutes = config['VERIFICATION_CODE_EXPIRE_MINUTES']
        
        print(f"✅ Código enviado a usuario: {username} ({email})")
        
        return {
            "success": True,
            "message": "Se ha enviado un código de verificación a tu correo",
            "email_sent": True,
            "expires_in_minutes": expire_minutes
        }
    
    except Exception as e:
        print(f"❌ Error en forgot_password: {e}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "message": "Error interno del servidor"
        }
    
    
@router.post("/verify-code")
def verify_recovery_code(request: dict, db: Session = Depends(get_db)):
    """Verifica el código de recuperación"""
    try:
        email = request.get("email", "").strip().lower()
        username = request.get("username", "").strip().lower()
        code = request.get("code", "").strip()
        
        if not email or not username or not code:
            return {
                "success": False,
                "message": "Usuario, email y código son requeridos"
            }
        
        # ✅ Verificar código con configuración dinámica
        result = verify_code(db, f"{username}_{email}", code)
        
        if not result["valid"]:
            return {
                "success": False,
                "message": result["message"]
            }
        
        # ✅ Generar reset_token con tiempo de expiración dinámico
        config = get_verificacion_config(db)
        reset_expire_minutes = config['RESET_TOKEN_EXPIRE_MINUTES']
        
        reset_token = secrets.token_urlsafe(32)
        reset_key = f"reset_{username}_{email}"
        
        verification_codes[reset_key] = {
            "token": reset_token,
            "username": username,
            "email": email,
            "expires_at": datetime.now() + timedelta(minutes=reset_expire_minutes)
        }
        
        print(f"✅ Código verificado para usuario: {username} ({email})")
        
        return {
            "success": True,
            "message": "Código verificado correctamente",
            "reset_token": reset_token
        }
    
    except Exception as e:
        print(f"❌ Error en verify_code: {e}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "message": "Error interno del servidor"
        }
    
@router.post("/reset-password")
def reset_password(request: dict, db: Session = Depends(get_db)):
    """Restablece la contraseña del usuario"""
    try:
        email = request.get("email", "").strip().lower()
        username = request.get("username", "").strip().lower()  # ✅ NUEVO
        reset_token = request.get("reset_token", "").strip()
        new_password = request.get("new_password", "").strip()
        
        # ✅ Validaciones - Ahora incluye username
        if not all([email, username, reset_token, new_password]):
            return {
                "success": False,
                "message": "Todos los campos son requeridos"
            }
        
        if len(new_password) < 8:
            return {
                "success": False,
                "message": "La contraseña debe tener al menos 8 caracteres"
            }
        
        # ✅ Verificar token con clave única (username + email)
        reset_key = f"reset_{username}_{email}"  # ✅ Clave única
        
        if reset_key not in verification_codes:
            return {
                "success": False,
                "message": "Token de recuperación inválido o expirado"
            }
        
        stored_data = verification_codes[reset_key]
        
        # ✅ Verificar expiración
        if datetime.now() > stored_data["expires_at"]:
            del verification_codes[reset_key]
            return {
                "success": False,
                "message": "El token ha expirado. Solicita un nuevo código"
            }
        
        # ✅ Verificar que el token coincida
        if stored_data["token"] != reset_token:
            return {
                "success": False,
                "message": "Token de recuperación inválido"
            }
        
        # ✅ Verificar que username y email coincidan con los almacenados
        if stored_data.get("username") != username or stored_data.get("email") != email:
            return {
                "success": False,
                "message": "Datos de verificación inválidos"
            }
        
        # ✅ Buscar usuario específico por USUARIO Y EMAIL
        user = db.query(UsuarioSistema).filter(
            UsuarioSistema.usuario == username,
            UsuarioSistema.email == email
        ).first()
        
        if not user:
            return {
                "success": False,
                "message": "Usuario no encontrado"
            }
        
        # ✅ Actualizar contraseña con manejo de errores
        if getattr(user, 'bloqueado_permanente', False):
            return {
                "success": False,
                "message": "Esta cuenta esta bloqueada permanentemente. Contacta al administrador para desbloquearla"
            }

        try:
            hashed_password = hash_password(new_password)
            user.clave = hashed_password
            
            # Resetear intentos fallidos
            if hasattr(user, 'intentos_fallidos'):
                user.intentos_fallidos = 0
            if hasattr(user, 'bloqueado_hasta'):
                user.bloqueado_hasta = None
            
            # Hacer commit
            db.commit()
            db.refresh(user)
            
            # ✅ Verificar que se guardó correctamente
            user_check = db.query(UsuarioSistema).filter(
                UsuarioSistema.usuario == username,
                UsuarioSistema.email == email
            ).first()
            
            if not verify_password(new_password, user_check.clave):
                db.rollback()
                print(f"❌ ERROR: La contraseña no se guardó para {username} ({email})")
                return {
                    "success": False,
                    "message": "Error al guardar la contraseña. Intenta nuevamente."
                }
            
            print(f"✅ Contraseña actualizada exitosamente para: {username} ({email})")
            
            # ✅ Limpiar todos los códigos relacionados con este usuario
            keys_to_delete = []
            for key in verification_codes.keys():
                if key == f"{username}_{email}" or key == reset_key:
                    keys_to_delete.append(key)
            
            for key in keys_to_delete:
                del verification_codes[key]
            
            return {
                "success": True,
                "message": "Contraseña restablecida exitosamente"
            }
            
        except Exception as commit_error:
            db.rollback()
            print(f"❌ Error al hacer commit: {commit_error}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "message": "Error al guardar la contraseña en la base de datos"
            }
    
    except Exception as e:
        print(f"❌ Error en reset_password: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return {
            "success": False,
            "message": "Error interno del servidor"
        }


@router.post("/resend-code")
def resend_verification_code(request: dict, db: Session = Depends(get_db)):
    """Reenvía un nuevo código de verificación"""
    try:
        email = request.get("email", "").strip().lower()
        username = request.get("username", "").strip().lower()  # ✅ AGREGAR
        
        if not email or not username:  # ✅ VALIDAR ambos
            return {
                "success": False,
                "message": "Usuario y correo electrónico son requeridos"
            }
        
        # ✅ Limpiar códigos anteriores con clave única
        keys_to_delete = []
        for key in list(verification_codes.keys()):
            if f"{username}_{email}" in key:
                keys_to_delete.append(key)
        
        for key in keys_to_delete:
            del verification_codes[key]
        
        # ✅ Reenviar código usando la misma lógica de forgot_password
        return forgot_password(request, db)
        
    except Exception as e:
        print(f"❌ Error en resend_code: {e}")
        return {
            "success": False,
            "message": "Error interno del servidor"
        }
