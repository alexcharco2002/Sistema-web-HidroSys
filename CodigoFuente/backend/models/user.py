# models/user.py
from sqlalchemy import Column, Integer, String, Boolean, DateTime, LargeBinary, Date, ForeignKey, Text
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
    # 
    session_token = Column(String(255), unique=True, nullable=True, index=True)
    session_created_at = Column(DateTime, nullable=True)
    session_expires_at = Column(DateTime, nullable=True)
    session_ip = Column(String(50), nullable=True)
    session_user_agent = Column(Text, nullable=True)
    last_activity = Column(DateTime, nullable=True)
   
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

    # ✅ AGREGAR ESTA RELACIÓN NUEVA (ISO 27002)
    historial_passwords = relationship(
        "HistorialContrasena",
        back_populates="usuario",
        cascade="all, delete-orphan",
        lazy="dynamic"
    )

    
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
    
    # ========================================
    # ✅ NUEVOS MÉTODOS PARA HISTORIAL (ISO 27002)
    # ========================================

    def obtener_historial_passwords(self, db, limite=5):
        """
        Obtiene el historial de contraseñas del usuario
        ISO 27002: Trazabilidad de cambios de credenciales

        Args:
            db: Sesión de base de datos
            limite: Cantidad de registros a retornar

        Returns:
            Lista de diccionarios con historial
        """
        from models.password_history import HistorialContrasena

        historial = db.query(HistorialContrasena).filter(
            HistorialContrasena.id_usuario_sistema == self.id_usuario_sistema
        ).order_by(HistorialContrasena.fecha_cambio.desc()).limit(limite).all()

        return [
            {
                "fecha_cambio": h.fecha_cambio.isoformat() if h.fecha_cambio else None,
                "motivo": h.motivo_cambio,
                "por_admin": h.cambiado_por_admin,
                "ip": h.ip_cambio
            }
            for h in historial
        ]

    def tiene_password_en_historial(self, db, password_plano: str) -> bool:
        """
        Verifica si una contraseña está en el historial del usuario
        ISO 27002: Prevenir reutilización de contraseñas

        Args:
            db: Sesión de base de datos
            password_plano: Contraseña en texto plano a verificar

        Returns:
            True si la contraseña está en el historial, False si no
        """
        from services.password_service import verificar_en_historial
        return verificar_en_historial(db, self.id_usuario_sistema, password_plano)

    def contar_cambios_password(self, db) -> int:
        """Cuenta cuántas veces el usuario ha cambiado su contraseña"""
        from models.password_history import HistorialContrasena

        return db.query(HistorialContrasena).filter(
            HistorialContrasena.id_usuario_sistema == self.id_usuario_sistema
        ).count()

    # ========================================
    # to_dict ACTUALIZADO (AGREGAR HISTORIAL)
    # ========================================

    def to_dict(self, db=None, incluir_historial=False):
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

            # ✅ NUEVO: Agregar info de historial de passwords si se solicita
            if incluir_historial:
                base_dict["cambios_password_count"] = self.contar_cambios_password(db)
                base_dict["historial_passwords"] = self.obtener_historial_passwords(db, limite=5)

        return base_dict
    
   # ========================================
   # NUEVO MODELO: AUDITORÍA DE SESIONES
    # ========================================

class AuditoriaSesion(Base):
    """
    Modelo para auditoría de sesiones
    ISO 27002: Logging y monitoreo de accesos
    """
    __tablename__ = "t_auditoria_sesiones"
    __table_args__ = {"schema": "usuarios"}

    id_auditoria = Column(Integer, primary_key=True, index=True)
    id_usuario_sistema = Column(Integer, ForeignKey("usuarios.t_usuario_sistema.id_usuario_sistema"), nullable=False)
    usuario = Column(String(50), nullable=False)
    evento = Column(String(50), nullable=False)
    session_token = Column(String(255), nullable=True)
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(Text, nullable=True)
    navegador = Column(String(100), nullable=True)
    sistema_operativo = Column(String(100), nullable=True)
    dispositivo = Column(String(50), nullable=True)
    fecha_evento = Column(DateTime, server_default=func.now())
    motivo = Column(Text, nullable=True)
    exitoso = Column(Boolean, default=True)

    # Relación con usuario
    usuario_rel = relationship("UsuarioSistema", foreign_keys=[id_usuario_sistema])

    def __repr__(self):
        return f"<AuditoriaSesion {self.usuario} - {self.evento} @ {self.fecha_evento}>"

    def to_dict(self):
        return {
            "id_auditoria": self.id_auditoria,
            "id_usuario_sistema": self.id_usuario_sistema,
            "usuario": self.usuario,
            "evento": self.evento,
            "ip_address": self.ip_address,
            "navegador": self.navegador,
            "sistema_operativo": self.sistema_operativo,
            "dispositivo": self.dispositivo,
            "fecha_evento": self.fecha_evento.isoformat() if self.fecha_evento else None,
            "motivo": self.motivo,
            "exitoso": self.exitoso
        }