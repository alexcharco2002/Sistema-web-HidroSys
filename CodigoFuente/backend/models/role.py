# models/role.py
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from db.session import Base

class Rol(Base):
    __tablename__ = "t_roles"
    __table_args__ = {"schema": "seguridad"}
    
    id_rol = Column(Integer, primary_key=True, index=True)
    nombre_rol = Column(String(50), unique=True, nullable=False)
    descripcion = Column(String(255), nullable=True)
    activo = Column(Boolean, default=True)
    fecha_creacion = Column(DateTime, server_default=func.now())
    
    # Relación con acciones del rol
    acciones = relationship("RolAccion", back_populates="rol", lazy="joined")
    
    def __repr__(self):
        return f"<Rol {self.nombre_rol}>"


class RolAccion(Base):
    __tablename__ = "t_rol_acciones"
    __table_args__ = {"schema": "seguridad"}
    
    id_rol_accion = Column(Integer, primary_key=True, index=True)
    id_rol = Column(Integer, ForeignKey("seguridad.t_roles.id_rol"), nullable=False)
    nombre_accion = Column(String(100), nullable=False)  # ej: "usuarios.crear", "lecturas.ver"
    tipo_accion = Column(String(50), nullable=False)  # ej: "crear", "leer", "actualizar", "eliminar"
    activo = Column(Boolean, default=True)
    fecha_asignacion = Column(DateTime, server_default=func.now())
    
    # Relación con rol
    rol = relationship("Rol", back_populates="acciones")
    
    def __repr__(self):
        return f"<RolAccion {self.nombre_accion}>"