# models/user.py
from sqlalchemy import Column, Integer, String, Boolean, DateTime, LargeBinary, Date, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from db.session import Base

class UsuarioSistema(Base):
    __tablename__ = "t_usuario_sistema"
    __table_args__ = {"schema": "usuarios"}
    
    # Campos originales
    id_usuario_sistema = Column(Integer, primary_key=True, index=True)
    usuario = Column(String(50), unique=True, nullable=False, index=True)
    clave = Column(String(255), nullable=False)
    nombres = Column(String(100), nullable=False)
    apellidos = Column(String(100), nullable=False)
    cedula = Column(String(15), unique=True, nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    telefono = Column(String(20), nullable=True)
    direccion = Column(String(255), nullable=True)
    
    # RELACIÓN CON ROL (FK)
    id_rol = Column(Integer, ForeignKey("seguridad.t_roles.id_rol"), nullable=False)
    afiliaciones = relationship("UsuarioAfiliado", back_populates="usuario_sistema")

    activo = Column(Boolean, default=True)
    sexo = Column(String(1), nullable=True)
    fecha_nac = Column(Date, nullable=True)
    fecha_registro = Column(DateTime, server_default=func.now())
    ultimo_acceso = Column(DateTime, nullable=True)
    foto = Column(LargeBinary, nullable=True)
    
    # Campos para control de intentos fallidos y bloqueos
    intentos_fallidos = Column(Integer, default=0)
    bloqueado_hasta = Column(DateTime, nullable=True)
    bloqueado_permanente = Column(Boolean, default=False)
 
    
    # Relación con el rol
    rol = relationship("Rol", backref="usuarios", lazy="joined")
    
    def __repr__(self):
        return f"<Usuario {self.usuario}>"
    
    def get_rol_info(self, db=None):
        """Obtiene información del rol del usuario"""
        if self.rol:
            return {
                "id_rol": self.rol.id_rol,
                "nombre_rol": self.rol.nombre_rol,
                "descripcion": self.rol.descripcion
            }
        return None
    
    def get_permissions(self, db):
        """Obtiene todas las acciones permitidas para el usuario según su rol"""
        from models.role import RolAccion
        
        if not self.id_rol:
            return []
        
        acciones = db.query(RolAccion).filter(
            RolAccion.id_rol == self.id_rol,
            RolAccion.activo == True
        ).all()
        
        return [
            {
                "nombre_accion": accion.nombre_accion,
                "tipo_accion": accion.tipo_accion
            }
            for accion in acciones
        ]
    
    def has_permission(self, db, nombre_accion: str, tipo_accion: str = None) -> bool:
        """Verifica si el usuario tiene un permiso específico"""
        from models.role import RolAccion
        
        if not self.id_rol:
            return False
        
        query = db.query(RolAccion).filter(
            RolAccion.id_rol == self.id_rol,
            RolAccion.nombre_accion == nombre_accion,
            RolAccion.activo == True
        )
        
        if tipo_accion:
            query = query.filter(RolAccion.tipo_accion == tipo_accion)
        
        return query.first() is not None
    
    def to_dict(self, db=None):
        """Convierte el objeto a diccionario"""
        base_dict = {
            "id_usuario_sistema": self.id_usuario_sistema,
            "usuario": self.usuario,
            "nombres": self.nombres,
            "apellidos": self.apellidos,
            "cedula": self.cedula,
            "email": self.email,
            "telefono": self.telefono,
            "direccion": self.direccion,
            "id_rol": self.id_rol,
            "activo": self.activo,
            "sexo": self.sexo,
            "fecha_nac": self.fecha_nac.strftime("%Y-%m-%d") if self.fecha_nac else None,
            "fecha_registro": self.fecha_registro.isoformat() if self.fecha_registro else None,
            "ultimo_acceso": self.ultimo_acceso.isoformat() if self.ultimo_acceso else None,
            "intentos_fallidos": self.intentos_fallidos,
            "bloqueado_hasta": self.bloqueado_hasta.isoformat() if self.bloqueado_hasta else None,
            "bloqueado_permanente": self.bloqueado_permanente
        }
        
        # Agregar información de rol y permisos
        if db:
            base_dict["rol"] = self.get_rol_info(db)
            base_dict["permisos"] = self.get_permissions(db)
        
        return base_dict