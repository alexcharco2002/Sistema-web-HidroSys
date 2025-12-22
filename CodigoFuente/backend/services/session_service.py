# services/session_service.py

import secrets
import hashlib
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from models.user import UsuarioSistema, AuditoriaSesion

# Configuración - ajusta según tus necesidades
SESSION_EXPIRE_HOURS = 8
SESSION_INACTIVITY_MINUTES = 30

def generar_session_token(user_id: int, username: str) -> str:
    """Genera un token de sesión único y seguro"""
    random_string = secrets.token_urlsafe(32)
    timestamp = datetime.utcnow().isoformat()
    data = f"{user_id}:{username}:{random_string}:{timestamp}"
    return hashlib.sha256(data.encode()).hexdigest()

def parse_user_agent(user_agent_string: str) -> dict:
    """Parsea el user agent para obtener info del dispositivo"""
    try:
        from user_agents import parse
        ua = parse(user_agent_string)
        return {
            "navegador": f"{ua.browser.family} {ua.browser.version_string}",
            "sistema_operativo": f"{ua.os.family} {ua.os.version_string}",
            "dispositivo": ua.device.family
        }
    except:
        # Si falla, devolver valores básicos
        return {
            "navegador": user_agent_string[:100] if user_agent_string else "Unknown",
            "sistema_operativo": "Unknown",
            "dispositivo": "Unknown"
        }

def registrar_evento_sesion(
    db: Session,
    usuario: UsuarioSistema,
    evento: str,
    session_token: str = None,
    ip_address: str = None,
    user_agent: str = None,
    motivo: str = None,
    exitoso: bool = True
):
    """Registra eventos de sesión para auditoría ISO 27002"""
    try:
        # Parsear user agent
        ua_info = parse_user_agent(user_agent) if user_agent else {}

        # Crear registro de auditoría
        auditoria = AuditoriaSesion(
            id_usuario_sistema=usuario.id_usuario_sistema,
            usuario=usuario.usuario,
            evento=evento,
            session_token=session_token,
            ip_address=ip_address or usuario.session_ip,
            user_agent=user_agent or usuario.session_user_agent,
            navegador=ua_info.get("navegador"),
            sistema_operativo=ua_info.get("sistema_operativo"),
            dispositivo=ua_info.get("dispositivo"),
            motivo=motivo,
            exitoso=exitoso
        )

        db.add(auditoria)
        db.commit()
        print(f"✅ Auditoría registrada: {evento} - {usuario.usuario}")

    except Exception as e:
        print(f"⚠️ Error registrando auditoría: {e}")
        db.rollback()

def invalidar_sesion_anterior(
    db: Session, 
    user_id: int, 
    motivo: str = "Nueva sesión iniciada"
) -> bool:
    """
    Invalida la sesión activa del usuario (si existe)
    ISO 27002: Control de sesiones concurrentes
    """
    try:
        usuario = db.query(UsuarioSistema).filter(
            UsuarioSistema.id_usuario_sistema == user_id
        ).first()

        if not usuario:
            return False

        # Si tiene sesión activa, registrar invalidación
        if usuario.session_token:
            print(f"🔄 Invalidando sesión anterior de {usuario.usuario}")
            registrar_evento_sesion(
                db=db,
                usuario=usuario,
                evento="SESSION_INVALIDATED",
                session_token=usuario.session_token,
                motivo=motivo,
                exitoso=True
            )

        # Limpiar datos de sesión
        usuario.session_token = None
        usuario.session_created_at = None
        usuario.session_expires_at = None
        usuario.session_ip = None
        usuario.session_user_agent = None
        usuario.last_activity = None

        db.commit()
        return True

    except Exception as e:
        print(f"❌ Error invalidando sesión: {e}")
        db.rollback()
        return False

def crear_nueva_sesion(
    db: Session,
    usuario: UsuarioSistema,
    ip_address: str,
    user_agent: str
) -> dict:
    """
    Crea una nueva sesión para el usuario
    ISO 27002: Gestión de sesiones seguras con control de concurrencia
    """
    try:
        # 1. Invalidar sesión anterior (control de sesión única)
        invalidar_sesion_anterior(db, usuario.id_usuario_sistema, "Login desde nuevo dispositivo")

        # 2. Generar nuevo token de sesión
        session_token = generar_session_token(usuario.id_usuario_sistema, usuario.usuario)
        
        # 3. Calcular tiempos de expiración
        now = datetime.utcnow()
        expires_at = now + timedelta(hours=SESSION_EXPIRE_HOURS)

        # 4. Actualizar usuario con nueva sesión
        usuario.session_token = session_token
        usuario.session_created_at = now
        usuario.session_expires_at = expires_at
        usuario.session_ip = ip_address
        usuario.session_user_agent = user_agent
        usuario.last_activity = now

        db.commit()
        db.refresh(usuario)

        # 5. Registrar en auditoría
        registrar_evento_sesion(
            db=db,
            usuario=usuario,
            evento="LOGIN",
            session_token=session_token,
            ip_address=ip_address,
            user_agent=user_agent,
            motivo="Login exitoso con OTP",
            exitoso=True
        )

        print(f"✅ Nueva sesión creada para {usuario.usuario}")
        print(f"   Token: {session_token[:16]}...")
        print(f"   Expira: {expires_at.isoformat()}")

        return {
            "success": True,
            "session_token": session_token,
            "expires_at": expires_at.isoformat(),
            "expires_in_seconds": SESSION_EXPIRE_HOURS * 3600
        }

    except Exception as e:
        print(f"❌ Error creando sesión: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return {"success": False, "message": str(e)}

def verificar_sesion_activa(db: Session, user_id: int, session_token: str) -> dict:
    """
    Verifica si una sesión es válida
    ISO 27002: Validación continua de sesiones
    """
    try:
        usuario = db.query(UsuarioSistema).filter(
            UsuarioSistema.id_usuario_sistema == user_id
        ).first()

        if not usuario:
            return {"valida": False, "motivo": "Usuario no encontrado", "accion": "LOGOUT"}

        # Verificar token
        if usuario.session_token != session_token:
            print(f"⚠️ Token de sesión no coincide para usuario {user_id}")
            return {"valida": False, "motivo": "Token de sesión inválido", "accion": "LOGOUT"}

        # Verificar expiración
        now = datetime.utcnow()
        if usuario.session_expires_at and now > usuario.session_expires_at:
            print(f"⏰ Sesión expirada para usuario {user_id}")
            invalidar_sesion_anterior(db, user_id, "Sesión expirada por tiempo")
            return {"valida": False, "motivo": "Sesión expirada", "accion": "LOGOUT"}

        # Verificar inactividad
        if usuario.last_activity:
            inactivity = now - usuario.last_activity
            if inactivity > timedelta(minutes=SESSION_INACTIVITY_MINUTES):
                print(f"💤 Sesión cerrada por inactividad para usuario {user_id}")
                invalidar_sesion_anterior(db, user_id, "Sesión cerrada por inactividad")
                return {"valida": False, "motivo": "Sesión cerrada por inactividad", "accion": "LOGOUT"}

        # ✅ Sesión válida - Actualizar última actividad
        usuario.last_activity = now
        db.commit()

        return {"valida": True, "usuario": usuario}

    except Exception as e:
        print(f"❌ Error verificando sesión: {e}")
        return {"valida": False, "motivo": "Error interno", "accion": "LOGOUT"}

def cerrar_sesion(db: Session, user_id: int, session_token: str, motivo: str = "Logout manual"):
    """Cierra la sesión del usuario"""
    try:
        resultado = verificar_sesion_activa(db, user_id, session_token)
        
        if resultado.get("valida"):
            usuario = resultado["usuario"]
            registrar_evento_sesion(
                db=db,
                usuario=usuario,
                evento="LOGOUT",
                session_token=session_token,
                motivo=motivo,
                exitoso=True
            )
            invalidar_sesion_anterior(db, user_id, motivo)
            return {"success": True, "message": "Sesión cerrada correctamente"}

        return {"success": False, "message": "Sesión no válida"}

    except Exception as e:
        print(f"❌ Error cerrando sesión: {e}")
        return {"success": False, "message": str(e)}
