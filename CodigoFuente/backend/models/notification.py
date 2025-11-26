# models/notificacion.py
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from db.session import Base
from datetime import datetime

class Notificacion(Base):
    """
    Modelo de Notificación
    Tabla: t_notificaciones
    """
    __tablename__ = "t_notificaciones"
    __table_args__ = {'schema': 'notificaciones'}
    
    id_notificacion = Column(Integer, primary_key=True, index=True)
    id_usuario_sistema = Column(Integer, ForeignKey("usuarios.t_usuario_sistema.id_usuario_sistema"), nullable=True)
    titulo = Column(String(100), nullable=False)
    mensaje = Column(Text, nullable=False)
    tipo = Column(String(50), nullable=True)
    estado = Column(String(20), nullable=False, default="no_leido")  # ejemplo: 'no_leido', 'leido'
    fecha_creacion = Column(DateTime, default=datetime.utcnow, nullable=False)
    fecha_leido = Column(DateTime, default=datetime.utcnow, nullable=True)

    # Relación (si tienes un modelo UsuarioSistema)
    # usuario = relationship("UsuarioSistema", back_populates="notificaciones")

    def __repr__(self):
        return (
            f"<Notificacion(id={self.id_notificacion}, titulo='{self.titulo}', "
            f"tipo='{self.tipo}', estado='{self.estado}')>"
        )
