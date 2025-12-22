# routes/auth.py
from fastapi import APIRouter, Depends, HTTPException, Request, status
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
from services.session_service import crear_nueva_sesion
from utils.email import email_service

router = APIRouter(tags=["auth"])

# ========================================
# CONFIGURACIÓN DE BLOQUEO
# ========================================


MAX_INTENTOS_TEMPORALES = 5
TIEMPO_BLOQUEO_TEMPORAL = 15
MAX_INTENTOS_PERMANENTES = 8

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
# CONFIGURACIÓN OTP (Agregar al inicio con las otras constantes)
# ========================================
otp_codes = {}  # Diccionario temporal para OTPs
OTP_CODE_LENGTH = 6
OTP_CODE_EXPIRE_MINUTES = 5

def generate_otp_code() -> str:
    """Genera código OTP de 6 dígitos"""
    return ''.join(secrets.choice(string.digits) for _ in range(OTP_CODE_LENGTH))

def store_otp_code(email: str, code: str, user_id: int):
    """Almacena OTP con expiración"""
    expiration = datetime.now() + timedelta(minutes=OTP_CODE_EXPIRE_MINUTES)
    otp_codes[email] = {
        "code": code,
        "expires_at": expiration,
        "attempts": 0,
        "user_id": user_id
    }

def verify_otp_code(email: str, code: str) -> dict:
    """Verifica código OTP"""
    if email not in otp_codes:
        return {"valid": False, "message": "No se encontró código para este correo"}
    
    stored = otp_codes[email]
    
    if datetime.now() > stored["expires_at"]:
        del otp_codes[email]
        return {"valid": False, "message": "El código ha expirado"}
    
    if stored["attempts"] >= 3:
        del otp_codes[email]
        return {"valid": False, "message": "Demasiados intentos. Solicita un nuevo código"}
    
    if stored["code"] != code:
        stored["attempts"] += 1
        intentos_restantes = 3 - stored["attempts"]
        return {
            "valid": False, 
            "message": f"Código incorrecto. Te quedan {intentos_restantes} intentos"
        }
    
    return {
        "valid": True, 
        "message": "Código verificado",
        "user_id": stored["user_id"]
    }

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
def verificar_activo_bloqueo(user: UsuarioSistema) -> dict:
    """Verifica el activo de bloqueo del usuario"""
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
    """Registra un intento fallido y aplica bloqueos según corresponda"""
    if not hasattr(user, 'intentos_fallidos') or user.intentos_fallidos is None:
        user.intentos_fallidos = 0
    
    user.intentos_fallidos += 1
    intentos_actuales = user.intentos_fallidos
    
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
# LOGIN - FASE 1: VALIDACIÓN Y ENVÍO OTP
# ========================================
@router.post("/login", response_model=dict)
def login(user: UserLogin, db: Session = Depends(get_db)):
    """
    Fase 1: Valida credenciales y envía OTP.
    NO crea sesión ni token.
    """
    try:
        db_user = db.query(UsuarioSistema).filter(
            UsuarioSistema.usuario == user.username.strip().lower()
        ).first()

        if not db_user:
            return {"success": False, "message": "El usuario ingresado no existe."}

        if hasattr(db_user, 'activo') and not db_user.activo:
            return {"success": False, "message": "Su usuario está inactivo. Contacte al administrador."}

        estado_bloqueo = verificar_activo_bloqueo(db_user)
        if estado_bloqueo["bloqueado"]:
            return {
                "success": False,
                "bloqueado": True,
                "tipo_bloqueo": estado_bloqueo["tipo"],
                "message": estado_bloqueo["mensaje"],
                "bloqueado_hasta": estado_bloqueo.get("bloqueado_hasta")
            }

        # ✅ Verificar contraseña UNA SOLA VEZ
        if not verify_password(user.password.strip(), db_user.clave):
            resultado = registrar_intento_fallido(db, db_user)
            return {
                "success": False,
                "bloqueado": resultado.get("bloqueado", False),
                "message": resultado["mensaje"]
            }

        # ✅ Contraseña correcta - Generar y enviar OTP
        otp_code = generate_otp_code()
        store_otp_code(db_user.email, otp_code, db_user.id_usuario_sistema)
        
        # Enviar OTP por email
        email_sent = email_service.send_otp_code(
            to_email=db_user.email,
            code=otp_code,
            username=db_user.usuario
        )
        
        if not email_sent:
            return {
                "success": False,
                "message": "Error al enviar código de autenticación. Intenta nuevamente"
            }

        return {
            "success": True,
            "requires_otp": True,
            "message": "Credenciales correctas. Código enviado a tu correo",
            "email": db_user.email,
            "expires_in_minutes": OTP_CODE_EXPIRE_MINUTES
        }

    except Exception as e:
        print(f"❌ Error en login: {e}")
        import traceback
        traceback.print_exc()
        return {"success": False, "message": "Error interno del servidor"}


# ========================================
# LOGIN - FASE 2: VERIFICACIÓN OTP
# ========================================
@router.post("/verify-otp")
def verify_otp_and_create_session(
    request: Request,  # ✅ AGREGAR para obtener IP y User-Agent
    data: dict,  # Cambiar de 'request' a 'data' para evitar conflicto
    db: Session = Depends(get_db)
):
    """
    Fase 2: Verifica OTP y crea sesión ÚNICA.
    ISO 27002: Control de sesiones concurrentes
    """
    try:
        email = data.get("email", "").strip().lower()
        code = data.get("code", "").strip()
        
        if not email or not code:
            return {"success": False, "message": "Email y código son requeridos"}
        
        # Verificar OTP
        result = verify_otp_code(email, code)
        
        if not result["valid"]:
            return {"success": False, "message": result["message"]}
        
        # Obtener usuario desde la BD
        db_user = db.query(UsuarioSistema).filter(
            UsuarioSistema.id_usuario_sistema == result["user_id"]
        ).first()
        
        if not db_user:
            return {"success": False, "message": "Usuario no encontrado"}
        
        # ✅ OBTENER INFORMACIÓN DE LA REQUEST (IP y User-Agent)
        client_ip = request.client.host if request.client else "Unknown"
        user_agent = request.headers.get("user-agent", "Unknown")

        print(f"🔐 Login desde IP: {client_ip}")
        print(f"🌐 User-Agent: {user_agent[:50]}...")

        # ✅ CREAR SESIÓN ÚNICA (invalida automáticamente sesiones anteriores)
        session_result = crear_nueva_sesion(
            db=db,
            usuario=db_user,
            ip_address=client_ip,
            user_agent=user_agent
        )

        if not session_result.get("success"):
            return {
                "success": False,
                "message": "Error al crear sesión"
            }

        # Detectar primer login
        primer_login = getattr(db_user, "primer_login", False) or db_user.ultimo_acceso is None

        # Actualizar último acceso
        db_user.ultimo_acceso = datetime.now()
        if hasattr(db_user, "primer_login"):
            db_user.primer_login = False
        db.commit()
        db.refresh(db_user)

        # Resetear intentos fallidos
        resetear_intentos_fallidos(db, db_user)

        # Obtener rol y permisos
        rol_permisos = get_user_role_and_permissions(db, db_user)
        foto_url = process_user_photo(db_user.foto) if hasattr(db_user, 'foto') and db_user.foto else None

        # ✅ CREAR TOKEN JWT (incluir id_usuario_sistema)
        token_data = {
            "sub": db_user.usuario,
            "id_usuario_sistema": db_user.id_usuario_sistema,  # ✅ IMPORTANTE para middleware
            "id_rol": db_user.id_rol,
            "nombre_rol": rol_permisos["rol"]["nombre_rol"] if rol_permisos["rol"] else None,
            "nombres": db_user.nombres
        }
        access_token = create_access_token(data=token_data)

        # Limpiar OTP usado
        if email in otp_codes:
            del otp_codes[email]

        return {
            "success": True,
            "message": "✅ Autenticación completada exitosamente",
            "data": {
                "token": access_token,
                "session_token": session_result["session_token"],  # ✅ NUEVO
                "session_expires_at": session_result["expires_at"],  # ✅ NUEVO
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
        print(f"❌ Error en verify_otp: {e}")
        import traceback
        traceback.print_exc()
        return {"success": False, "message": "Error interno del servidor"}

# ========================================
# REENVIAR OTP
# ========================================
@router.post("/resend-otp")
def resend_otp_code(request: dict, db: Session = Depends(get_db)):
    """Reenvía código OTP"""
    try:
        email = request.get("email", "").strip().lower()
        
        if not email:
            return {"success": False, "message": "Email requerido"}
        
        # Verificar que existe una solicitud pendiente
        if email not in otp_codes:
            return {"success": False, "message": "No hay solicitud pendiente para este correo"}
        
        user_id = otp_codes[email]["user_id"]
        
        db_user = db.query(UsuarioSistema).filter(
            UsuarioSistema.id_usuario_sistema == user_id
        ).first()
        
        if not db_user:
            return {"success": False, "message": "Usuario no encontrado"}
        
        # Generar nuevo código
        new_otp = generate_otp_code()
        store_otp_code(email, new_otp, user_id)
        
        # Enviar por correo
        email_sent = email_service.send_otp_code(
            to_email=email,
            code=new_otp,
            username=db_user.usuario
        )
        
        if not email_sent:
            return {"success": False, "message": "Error al enviar el código"}
        
        return {
            "success": True,
            "message": "Nuevo código enviado",
            "expires_in_minutes": OTP_CODE_EXPIRE_MINUTES
        }
        
    except Exception as e:
        print(f"❌ Error en resend_otp: {e}")
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
        Rol.nombre_rol == "administrador"
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
        Rol.nombre_rol == "administrador"
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
VERIFICATION_CODE_LENGTH = 6
VERIFICATION_CODE_EXPIRE_MINUTES = 15

def generate_verification_code() -> str:
    """Genera un código de verificación numérico de 6 dígitos"""
    return ''.join(secrets.choice(string.digits) for _ in range(VERIFICATION_CODE_LENGTH))

def store_verification_code(email: str, code: str):
    """Almacena el código con su tiempo de expiración"""
    expiration = datetime.now() + timedelta(minutes=VERIFICATION_CODE_EXPIRE_MINUTES)
    verification_codes[email] = {
        "code": code,
        "expires_at": expiration,
        "attempts": 0
    }

def verify_code(email: str, code: str) -> dict:
    """Verifica si el código es válido"""
    if email not in verification_codes:
        return {"valid": False, "message": "No se encontró un código para este correo"}
    
    stored_data = verification_codes[email]
    
    if datetime.now() > stored_data["expires_at"]:
        del verification_codes[email]
        return {"valid": False, "message": "El código ha expirado. Solicita uno nuevo"}
    
    if stored_data["attempts"] >= 3:
        del verification_codes[email]
        return {"valid": False, "message": "Demasiados intentos fallidos. Solicita un nuevo código"}
    
    if stored_data["code"] != code:
        stored_data["attempts"] += 1
        intentos_restantes = 3 - stored_data["attempts"]
        return {
            "valid": False,
            "message": f"Código incorrecto. Te quedan {intentos_restantes} intentos"
        }
    
    return {"valid": True, "message": "Código verificado correctamente"}

@router.post("/forgot-password")
def forgot_password(request: dict, db: Session = Depends(get_db)):
    """Envía un código de verificación al correo del usuario"""
    try:
        email = request.get("email", "").strip().lower()
        
        if not email:
            return {
                "success": False,
                "message": "El correo electrónico es requerido"
            }
        
        user = db.query(UsuarioSistema).filter(
            UsuarioSistema.email == email
        ).first()
        
        if not user:
            return {
                "success": False,
                "message": "El correo ingresado no se encuentra registrado en el sistema.",
                "email_sent": False
            }
        
        if hasattr(user, 'activo') and not user.activo:
            return {
                "success": False,
                "message": "Esta cuenta está inactiva. Contacta al administrador"
            }
        
        verification_code = generate_verification_code()
        store_verification_code(email, verification_code)
        
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
        
        return {
            "success": True,
            "message": "Se ha enviado un código de verificación a tu correo",
            "email_sent": True,
            "expires_in_minutes": VERIFICATION_CODE_EXPIRE_MINUTES
        }
    
    except Exception as e:
        print(f"❌ Error en forgot_password: {e}")
        return {
            "success": False,
            "message": "Error interno del servidor"
        }

@router.post("/verify-code")
def verify_recovery_code(request: dict):
    """Verifica el código de recuperación"""
    try:
        email = request.get("email", "").strip().lower()
        code = request.get("code", "").strip()
        
        if not email or not code:
            return {
                "success": False,
                "message": "Email y código son requeridos"
            }
        
        result = verify_code(email, code)
        
        if not result["valid"]:
            return {
                "success": False,
                "message": result["message"]
            }
        
        reset_token = secrets.token_urlsafe(32)
        
        verification_codes[f"reset_{email}"] = {
            "token": reset_token,
            "expires_at": datetime.now() + timedelta(minutes=10)
        }
        
        return {
            "success": True,
            "message": "Código verificado correctamente",
            "reset_token": reset_token
        }
    
    except Exception as e:
        print(f"❌ Error en verify_code: {e}")
        return {
            "success": False,
            "message": "Error interno del servidor"
        }

@router.post("/reset-password")
def reset_password(request: dict, db: Session = Depends(get_db)):
    """Restablece la contraseña del usuario"""
    try:
        email = request.get("email", "").strip().lower()
        reset_token = request.get("reset_token", "").strip()
        new_password = request.get("new_password", "").strip()
        
        if not all([email, reset_token, new_password]):
            return {
                "success": False,
                "message": "Todos los campos son requeridos"
            }
        
        if len(new_password) < 8:
            return {
                "success": False,
                "message": "La contraseña debe tener al menos 8 caracteres"
            }
        
        reset_key = f"reset_{email}"
        if reset_key not in verification_codes:
            return {
                "success": False,
                "message": "Token de recuperación inválido o expirado"
            }
        
        stored_data = verification_codes[reset_key]
        
        if datetime.now() > stored_data["expires_at"]:
            del verification_codes[reset_key]
            return {
                "success": False,
                "message": "El token ha expirado. Solicita un nuevo código"
            }
        
        if stored_data["token"] != reset_token:
            return {
                "success": False,
                "message": "Token de recuperación inválido"
            }
        
        user = db.query(UsuarioSistema).filter(
            UsuarioSistema.email == email
        ).first()
        
        if not user:
            return {
                "success": False,
                "message": "Usuario no encontrado"
            }
        
        hashed_password = hash_password(new_password)
        user.clave = hashed_password
        
        if hasattr(user, 'intentos_fallidos'):
            user.intentos_fallidos = 0
        if hasattr(user, 'bloqueado_hasta'):
            user.bloqueado_hasta = None
        if hasattr(user, 'bloqueado_permanente'):
            user.bloqueado_permanente = False
        
        db.commit()
        
        if email in verification_codes:
            del verification_codes[email]
        if reset_key in verification_codes:
            del verification_codes[reset_key]
        
        return {
            "success": True,
            "message": "Contraseña restablecida exitosamente"
        }
    
    except Exception as e:
        print(f"❌ Error en reset_password: {e}")
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
        
        if not email:
            return {
                "success": False,
                "message": "El correo electrónico es requerido"
            }
        
        if email in verification_codes:
            del verification_codes[email]
        
        return forgot_password(request, db)
    
    except Exception as e:
        print(f"❌ Error en resend_code: {e}")
        return {
            "success": False,
            "message": "Error interno del servidor"
        }