# models/notification.py

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from db.session import Base
from datetime import datetime
from zoneinfo import ZoneInfo

# ✅ DEFINIR ZONA HORARIA DE ECUADOR
ECUADOR_TZ = ZoneInfo('America/Guayaquil')

class Notificacion(Base):
    """
    Modelo de Notificación
    Tabla: t_notificaciones
    Soporta notificaciones generales y mantenimientos programados
    """
    __tablename__ = "t_notificaciones"
    __table_args__ = {'schema': 'notificaciones'}

    id_notificacion = Column(Integer, primary_key=True, index=True)
    id_usuario_sistema = Column(Integer, ForeignKey("usuarios.t_usuario_sistema.id_usuario_sistema"), nullable=True)
    
    # Campos básicos
    titulo = Column(String(100), nullable=False)
    mensaje = Column(Text, nullable=False)
    tipo = Column(String(50), nullable=False, default="info")
    estado = Column(String(20), nullable=False, default="no_leido")
    
    # Campos de mantenimiento
    es_mantenimiento = Column(Boolean, default=False, nullable=False)
    fecha_inicio_mantenimiento = Column(DateTime, nullable=True)
    fecha_fin_mantenimiento = Column(DateTime, nullable=True)
    duracion_estimada = Column(String(50), nullable=True)
    modulos_afectados = Column(Text, nullable=True)
    
    # Control de email
    enviar_email = Column(Boolean, default=False, nullable=False)
    email_enviado = Column(Boolean, default=False, nullable=False)
    fecha_envio_email = Column(DateTime, nullable=True)
    
    # Prioridad
    prioridad = Column(String(20), default="media", nullable=False)
    
    # Fechas - ✅ USAR HORA DE ECUADOR EN VEZ DE UTC
    fecha_creacion = Column(
        DateTime, 
        default=lambda: datetime.now(ECUADOR_TZ),  # ✅ Cambio aquí
        nullable=False
    )
    fecha_leido = Column(DateTime, nullable=True)

    def __repr__(self):
        return f"<Notificacion {self.id_notificacion}: {self.titulo}>"
