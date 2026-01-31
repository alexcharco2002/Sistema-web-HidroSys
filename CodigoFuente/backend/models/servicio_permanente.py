"""
TITLE: models/servicio_permanente.py
Modelos SQLAlchemy para la gestión de servicios permanentes en facturación
"""

from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, Date, Text, ForeignKey, CheckConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from db.session import Base


class ConfiguracionServicioPermanente(Base):
    """
    Modelo para configuración de servicios permanentes.
    Permite definir servicios que se aplicarán automáticamente cada mes
    a usuarios específicos sin necesidad de activarlos manualmente.
    """
    __tablename__ = "t_configuracion_servicio_permanente"
    __table_args__ = {"schema": "facturacion"}

    id_configuracion_sp = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    descripcion = Column(Text, nullable=True)

    # Control de aplicación
    aplicar_servicio = Column(Boolean, default=True, nullable=False)
    activo = Column(Boolean, default=False, nullable=False)  # Inactivo por defecto

    # Servicio a aplicar
    id_servicio = Column(
        Integer,
        ForeignKey('medidores.t_servicios.id_servicio'),
        nullable=False,
        index=True
    )

    # Vigencia
    fecha_creacion = Column(DateTime(timezone=True), nullable=False, default=func.now())
    vigencia_desde = Column(Date, nullable=False)
    vigencia_hasta = Column(Date, nullable=True)
    es_vigente = Column(Boolean, default=True, nullable=False)

    # Configuración de aplicación
    aplicar_en_periodo = Column(
        String(20),
        CheckConstraint("aplicar_en_periodo IN ('mensual', 'bimestral', 'trimestral')"),
        default='mensual',
        nullable=False
    )

    # Precio override (opcional, si null usa precio_base del servicio)
    precio_override = Column(Numeric(10, 2), nullable=True)

    # Observaciones
    observaciones = Column(Text, nullable=True)

    # Relaciones
    servicio = relationship("Servicio", foreign_keys=[id_servicio])
    asignaciones = relationship(
        "AsignacionServicioPermanente",
        back_populates="configuracion",
        cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<ConfigServicioPermanente(id={self.id_configuracion_sp}, nombre='{self.nombre}', activo={self.activo})>"

    def to_dict(self):
        """Convierte el objeto a diccionario"""
        return {
            'id_configuracion_sp': self.id_configuracion_sp,
            'nombre': self.nombre,
            'descripcion': self.descripcion,
            'aplicar_servicio': self.aplicar_servicio,
            'activo': self.activo,
            'id_servicio': self.id_servicio,
            'fecha_creacion': self.fecha_creacion.isoformat() if self.fecha_creacion else None,
            'vigencia_desde': self.vigencia_desde.isoformat() if self.vigencia_desde else None,
            'vigencia_hasta': self.vigencia_hasta.isoformat() if self.vigencia_hasta else None,
            'es_vigente': self.es_vigente,
            'aplicar_en_periodo': self.aplicar_en_periodo,
            'precio_override': float(self.precio_override) if self.precio_override else None,
            'observaciones': self.observaciones
        }


class AsignacionServicioPermanente(Base):
    """
    Modelo para asignación de servicios permanentes a usuarios específicos.
    Define qué usuarios recibirán automáticamente el servicio permanente.
    """
    __tablename__ = "t_asignacion_servicio_permanente"
    __table_args__ = (
        CheckConstraint(
            "(fecha_fin IS NULL) OR (fecha_fin >= fecha_inicio)",
            name='chk_fechas_asignacion'
        ),
        {"schema": "facturacion"}
    )

    id_asignacion_sp = Column(Integer, primary_key=True, index=True)

    # Configuración a la que pertenece
    id_configuracion_sp = Column(
        Integer,
        ForeignKey('facturacion.t_configuracion_servicio_permanente.id_configuracion_sp', ondelete='CASCADE'),
        nullable=False,
        index=True
    )

    # Usuario afiliado asignado
    id_usuario_afi = Column(
        Integer,
        ForeignKey('usuarios.t_usuario_afiliado.id_usuario_afi'),
        nullable=False,
        index=True
    )

    # Control
    activo = Column(Boolean, default=True, nullable=False)

    # Vigencia específica por usuario (opcional)
    fecha_inicio = Column(Date, nullable=False, default=func.current_date)
    fecha_fin = Column(Date, nullable=True)

    # Auditoría
    fecha_asignacion = Column(DateTime(timezone=True), nullable=False, default=func.now())
    asignado_por = Column(Integer, ForeignKey('usuarios.t_usuario_sistema.id_usuario_sistema'), nullable=True)

    # Observaciones específicas del usuario
    observaciones = Column(Text, nullable=True)

    # Relaciones
    configuracion = relationship("ConfiguracionServicioPermanente", back_populates="asignaciones")
    usuario_afiliado = relationship("UsuarioAfiliado", foreign_keys=[id_usuario_afi])
    usuario_sistema = relationship("UsuarioSistema", foreign_keys=[asignado_por])

    def __repr__(self):
        return f"<AsignacionSP(id={self.id_asignacion_sp}, config={self.id_configuracion_sp}, usuario={self.id_usuario_afi}, activo={self.activo})>"

    def to_dict(self):
        """Convierte el objeto a diccionario"""
        return {
            'id_asignacion_sp': self.id_asignacion_sp,
            'id_configuracion_sp': self.id_configuracion_sp,
            'id_usuario_afi': self.id_usuario_afi,
            'activo': self.activo,
            'fecha_inicio': self.fecha_inicio.isoformat() if self.fecha_inicio else None,
            'fecha_fin': self.fecha_fin.isoformat() if self.fecha_fin else None,
            'fecha_asignacion': self.fecha_asignacion.isoformat() if self.fecha_asignacion else None,
            'asignado_por': self.asignado_por,
            'observaciones': self.observaciones
        }
