#models/password_history.py
"""
Modelo para historial de contraseñas - ISO 27002 A.9.4.3
Previene reutilización de contraseñas recientes
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from db.session import Base


class HistorialContrasena(Base):
    __tablename__ = "t_historial_contrasenas"
    __table_args__ = {"schema": "seguridad"}

    id_historial = Column(Integer, primary_key=True, index=True)
    id_usuario_sistema = Column(
        Integer, 
        ForeignKey("usuarios.t_usuario_sistema.id_usuario_sistema"), 
        nullable=False,
        index=True
    )
    clave_hash = Column(String(255), nullable=False)
    fecha_cambio = Column(DateTime, server_default=func.now(), nullable=False)
    cambiado_por_admin = Column(Boolean, default=False)
    motivo_cambio = Column(String(100))
    ip_cambio = Column(String(45))

    # ✅ RELACIÓN INVERSA - debe coincidir con back_populates
    usuario = relationship(
        "UsuarioSistema",
        back_populates="historial_passwords"  # Debe coincidir con el nombre en UsuarioSistema
    )

    def __repr__(self):
        return f"<HistorialContrasena user_id={self.id_usuario_sistema}>"


class AuditoriaContrasena(Base):
    __tablename__ = "t_auditoria_contrasenas"
    __table_args__ = {"schema": "seguridad"}

    id_auditoria = Column(Integer, primary_key=True, index=True)
    id_usuario_sistema = Column(
        Integer, 
        ForeignKey("usuarios.t_usuario_sistema.id_usuario_sistema"),
        nullable=False,
        index=True
    )
    accion = Column(String(50), nullable=False)
    motivo_rechazo = Column(String(255))
    fecha_hora = Column(DateTime, server_default=func.now(), nullable=False, index=True)
    ip_origen = Column(String(45))
    user_agent = Column(String(255))
    exitoso = Column(Boolean, nullable=False)

    def __repr__(self):
        return f"<AuditoriaContrasena user_id={self.id_usuario_sistema} accion={self.accion}>"