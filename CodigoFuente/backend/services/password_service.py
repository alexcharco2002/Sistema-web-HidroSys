#services/password_service.py
"""
Servicio de gestión de contraseñas según ISO 27002
Integrado con sistema existente de bcrypt y bloqueos
"""
import re
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Tuple, Optional
from security.password import verify_password  # Tu función existente


# ========================================
# CONFIGURACIÓN ISO 27002
# ========================================
PASSWORD_HISTORY_COUNT = 5  # Últimas 5 contraseñas (ISO recomienda 3-5)
CONTRASEÑAS_COMUNES = {
    'password', 'password123', '12345678', 'qwerty123', 
    'abc123456', 'password1', 'admin123', 'welcome123',
    '123456789', 'Password1', 'Password123@', 'Admin123',
    'Abcd1234', 'Test1234', 'User1234', 'Sistema1',
    'Sistema123', 'Ecuador123', 'Quito123'
}


# ========================================
# VALIDADOR DE COMPLEJIDAD ISO 27002
# ========================================
def validar_complejidad_iso27002(password: str, usuario_info: dict = None) -> Tuple[bool, str]:
    """
    Validación completa según ISO 27002 A.9.4.3

    Args:
        password: Contraseña a validar
        usuario_info: dict con 'usuario', 'email', 'nombres', 'apellidos' (opcional)

    Returns:
        Tuple[bool, str]: (es_válida, mensaje_error)
    """
    # 1. Longitud mínima
    if len(password) < 8:
        return False, "La contraseña debe tener al menos 8 caracteres"

    if len(password) > 128:
        return False, "La contraseña no puede exceder 128 caracteres"

    # 2. Mayúsculas
    if not re.search(r'[A-Z]', password):
        return False, "Debe contener al menos una letra mayúscula (A-Z)"

    # 3. Minúsculas
    if not re.search(r'[a-z]', password):
        return False, "Debe contener al menos una letra minúscula (a-z)"

    # 4. Números
    if not re.search(r'[0-9]', password):
        return False, "Debe contener al menos un número (0-9)"

    # 5. Caracteres especiales
    if not re.search(r"[!@#$%^&*()_+\-=\[\]{};:'\"\\|,./<>?]", password):
        return False, "Debe contener al menos un carácter especial (!@#$%...)"

    # 6. Verificar contra contraseñas comunes
    if password.lower() in CONTRASEÑAS_COMUNES or password in CONTRASEÑAS_COMUNES:
        return False, "Esta contraseña es muy común y no está permitida por seguridad"

    # 7. Verificar contra información personal del usuario
    if usuario_info:
        password_lower = password.lower()

        # Verificar username
        if 'usuario' in usuario_info and usuario_info['usuario']:
            if len(usuario_info['usuario']) >= 3 and usuario_info['usuario'].lower() in password_lower:
                return False, "La contraseña no puede contener tu nombre de usuario"

        # Verificar email (parte antes del @)
        if 'email' in usuario_info and usuario_info['email']:
            email_user = usuario_info['email'].split('@')[0].lower()
            if len(email_user) >= 3 and email_user in password_lower:
                return False, "La contraseña no puede contener tu correo electrónico"

        # Verificar nombres
        if 'nombres' in usuario_info and usuario_info['nombres']:
            nombres_parts = usuario_info['nombres'].lower().split()
            for part in nombres_parts:
                if len(part) >= 3 and part in password_lower:
                    return False, "La contraseña no puede contener tu nombre"

        # Verificar apellidos
        if 'apellidos' in usuario_info and usuario_info['apellidos']:
            apellidos_parts = usuario_info['apellidos'].lower().split()
            for part in apellidos_parts:
                if len(part) >= 3 and part in password_lower:
                    return False, "La contraseña no puede contener tu apellido"

    return True, "Contraseña válida según ISO 27002"


# ========================================
# GESTIÓN DE HISTORIAL
# ========================================
def agregar_al_historial(
    db: Session, 
    user_id: int, 
    password_hash: str,
    motivo: str = "cambio_voluntario",
    by_admin: bool = False,
    ip: str = None
):
    """
    Agrega una contraseña al historial del usuario
    Mantiene solo las últimas N contraseñas

    Args:
        db: Sesión de base de datos
        user_id: ID del usuario
        password_hash: Hash bcrypt de la contraseña
        motivo: Razón del cambio
        by_admin: Si fue cambio administrativo
        ip: Dirección IP del cambio
    """
    from models.password_history import HistorialContrasena

    # Crear nueva entrada
    nueva_entrada = HistorialContrasena(
        id_usuario_sistema=user_id,
        clave_hash=password_hash,
        fecha_cambio=datetime.now(),
        cambiado_por_admin=by_admin,
        motivo_cambio=motivo,
        ip_cambio=ip
    )
    db.add(nueva_entrada)

    # Limpiar historial antiguo (mantener solo las últimas N)
    historial = db.query(HistorialContrasena).filter(
        HistorialContrasena.id_usuario_sistema == user_id
    ).order_by(HistorialContrasena.fecha_cambio.desc()).all()

    # Si ya hay más de N, eliminar las más antiguas
    if len(historial) >= PASSWORD_HISTORY_COUNT:
        for vieja_entrada in historial[PASSWORD_HISTORY_COUNT-1:]:
            db.delete(vieja_entrada)

    db.commit()


def verificar_en_historial(db: Session, user_id: int, nueva_password: str) -> bool:
    """
    Verifica si la contraseña ya fue usada recientemente
    ISO 27002: Prevenir reutilización de contraseñas

    Args:
        db: Sesión de base de datos
        user_id: ID del usuario
        nueva_password: Contraseña en texto plano a verificar

    Returns:
        bool: True si la contraseña está en el historial, False si no
    """
    from models.password_history import HistorialContrasena

    historial = db.query(HistorialContrasena).filter(
        HistorialContrasena.id_usuario_sistema == user_id
    ).order_by(HistorialContrasena.fecha_cambio.desc()).limit(
        PASSWORD_HISTORY_COUNT
    ).all()

    # Verificar contra cada hash del historial
    for entrada in historial:
        if verify_password(nueva_password, entrada.clave_hash):
            return True  # Contraseña encontrada en historial

    return False  # Contraseña no está en historial


# ========================================
# AUDITORÍA DE CAMBIOS
# ========================================
def registrar_auditoria_password(
    db: Session,
    user_id: int,
    accion: str,
    exitoso: bool,
    motivo_rechazo: str = None,
    ip: str = None,
    user_agent: str = None
):
    """
    Registra intento de cambio de contraseña para auditoría
    ISO 27002: Trazabilidad de cambios de seguridad

    Args:
        db: Sesión de base de datos
        user_id: ID del usuario
        accion: Tipo de acción ('CAMBIO_EXITOSO', 'CAMBIO_RECHAZADO', etc.)
        exitoso: Si la acción fue exitosa
        motivo_rechazo: Razón si fue rechazado
        ip: IP del usuario
        user_agent: Navegador/cliente
    """
    from models.password_history import AuditoriaContrasena

    auditoria = AuditoriaContrasena(
        id_usuario_sistema=user_id,
        accion=accion,
        motivo_rechazo=motivo_rechazo,
        fecha_hora=datetime.now(),
        ip_origen=ip,
        user_agent=user_agent,
        exitoso=exitoso
    )
    db.add(auditoria)
    db.commit()


# ========================================
# FUNCIÓN COMPLETA DE VALIDACIÓN
# ========================================
def validar_nueva_password_completa(
    db: Session,
    user_id: int,
    nueva_password: str,
    password_actual: str = None,
    usuario_info: dict = None
) -> Tuple[bool, str]:
    """
    Validación completa de nueva contraseña
    Incluye todas las verificaciones ISO 27002

    Args:
        db: Sesión de base de datos
        user_id: ID del usuario
        nueva_password: Nueva contraseña a validar
        password_actual: Contraseña actual (para verificar que no sea igual)
        usuario_info: Información del usuario para validar

    Returns:
        Tuple[bool, str]: (es_válida, mensaje)
    """
    # 1. Validar complejidad
    es_valida, mensaje = validar_complejidad_iso27002(nueva_password, usuario_info)
    if not es_valida:
        return False, mensaje

    # 2. Verificar que no sea igual a la actual
    if password_actual:
        from models.user import UsuarioSistema
        user = db.query(UsuarioSistema).filter(
            UsuarioSistema.id_usuario_sistema == user_id
        ).first()

        if user and verify_password(nueva_password, user.clave):
            return False, "La nueva contraseña no puede ser igual a la actual"

    # 3. Verificar historial
    if verificar_en_historial(db, user_id, nueva_password):
        return False, f"No puedes reutilizar las últimas {PASSWORD_HISTORY_COUNT} contraseñas"

    return True, "Contraseña válida según ISO 27002"


# ========================================
# REPORTES DE SEGURIDAD
# ========================================
def obtener_historial_usuario(db: Session, user_id: int) -> list:
    """Obtiene el historial de contraseñas de un usuario"""
    from models.password_history import HistorialContrasena

    historial = db.query(HistorialContrasena).filter(
        HistorialContrasena.id_usuario_sistema == user_id
    ).order_by(HistorialContrasena.fecha_cambio.desc()).all()

    return [entrada.to_dict() for entrada in historial]


def obtener_auditoria_cambios(db: Session, user_id: int = None, dias: int = 30) -> list:
    """Obtiene auditoría de cambios de contraseñas"""
    from models.password_history import AuditoriaContrasena
    from datetime import timedelta

    query = db.query(AuditoriaContrasena)

    if user_id:
        query = query.filter(AuditoriaContrasena.id_usuario_sistema == user_id)

    fecha_inicio = datetime.now() - timedelta(days=dias)
    query = query.filter(AuditoriaContrasena.fecha_hora >= fecha_inicio)

    auditorias = query.order_by(AuditoriaContrasena.fecha_hora.desc()).all()

    return [
        {
            "id_usuario_sistema": a.id_usuario_sistema,
            "accion": a.accion,
            "exitoso": a.exitoso,
            "motivo_rechazo": a.motivo_rechazo,
            "fecha_hora": a.fecha_hora.isoformat(),
            "ip_origen": a.ip_origen
        }
        for a in auditorias
    ]