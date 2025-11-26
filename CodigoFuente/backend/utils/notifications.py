# utils/notifications.py (ARCHIVO NUEVO)
from sqlalchemy.orm import Session
from models.notification import Notificacion
from datetime import datetime
from typing import Optional

def registrar_notificacion(
    db: Session,
    id_usuario: int,
    titulo: str,
    mensaje: str,
    tipo: str = "info"
) -> Notificacion:
    """
    Función auxiliar para registrar notificaciones desde cualquier parte del sistema
    
    Args:
        db: Sesión de base de datos
        id_usuario: ID del usuario que recibirá la notificación
        titulo: Título de la notificación
        mensaje: Contenido del mensaje
        tipo: Tipo de notificación (info, alerta, error, sistema)
    
    Returns:
        Notificacion: La notificación creada
    """
    try:
        notificacion = Notificacion(
            id_usuario_sistema=id_usuario,
            titulo=titulo,
            mensaje=mensaje,
            tipo=tipo,
            estado="no_leido",
            fecha_creacion=datetime.utcnow()
        )
        db.add(notificacion)
        db.commit()
        db.refresh(notificacion)
        return notificacion
    except Exception as e:
        db.rollback()
        print(f"Error al registrar notificación: {e}")
        return None