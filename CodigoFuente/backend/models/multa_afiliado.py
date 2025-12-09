# models/multa_afiliado.py

from sqlalchemy import Column, Integer, Numeric, Date, Text, Boolean, String, ForeignKey
from sqlalchemy.orm import relationship
from db.session import Base

class MultaAfiliado(Base):
    """
    Modelo de Multas Asignadas a Afiliados
    Tabla: t_multas_afiliados en el esquema multas
    Registra las multas aplicadas a usuarios afiliados
    """
    __tablename__ = "t_multas_afiliados"
    __table_args__ = {'schema': 'multas'}
    
    id_multa_afi = Column(Integer, primary_key=True, index=True, autoincrement=True)
    id_usuario_afi = Column(Integer, ForeignKey('usuarios.t_usuario_afiliado.id_usuario_afi'), nullable=False, index=True)
    id_tipo_multa = Column(Integer, ForeignKey('multas.t_multa.id_tipo_multa'), nullable=False, index=True)
    
    monto = Column(Numeric(10, 2), nullable=False)
    fecha_multa = Column(Date, nullable=False, index=True)
    fecha_pago = Column(Date, nullable=True)
    observaciones = Column(Text, nullable=True)
    activo = Column(Boolean, default=True, nullable=False)
    estado = Column(String(20), default='pendiente', nullable=False, index=True)
    
    # Relaciones ORM
    # Relación con TipoMulta
    tipo_multa = relationship(
        "TipoMulta",
        back_populates="multas_afiliados",
        lazy="joined"
    )

    # Relación con UsuarioAfiliado
    usuario = relationship(
        "UsuarioAfiliado",
        back_populates="multas",
        lazy="joined"
    )
    
    def __repr__(self):
        return f"<MultaAfiliado(id={self.id_multa_afi}, usuario={self.id_usuario_afi}, estado={self.estado})>"
    
    def to_dict(self):
        return {
            "id_multa_afi": self.id_multa_afi,
            "id_usuario_afi": self.id_usuario_afi,
            "id_tipo_multa": self.id_tipo_multa,
            "monto": float(self.monto) if self.monto is not None else None,
            "fecha_multa": self.fecha_multa.isoformat() if self.fecha_multa else None,
            "fecha_pago": self.fecha_pago.isoformat() if self.fecha_pago else None,
            "observaciones": self.observaciones,
            "activo": self.activo,
            "estado": self.estado,
        }
