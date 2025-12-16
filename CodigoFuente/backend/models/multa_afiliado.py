# models/multa_afiliado.py

from sqlalchemy import Column, Integer, Numeric, Date, Text, Boolean, String, ForeignKey
from sqlalchemy.orm import relationship
from db.session import Base


class MultaAfiliado(Base):
    """Modelo de Multas Asignadas a Afiliados"""
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
    facturado = Column(Boolean, default=False, nullable=False, index=True)
    
    # ⭐ Relaciones ORM - IGUAL QUE EN MEDIDORES
    tipo_multa = relationship(
        "TipoMulta",
        back_populates="multas_afiliados",
        lazy="joined"
    )

    # ⭐ IMPORTANTE: usar lazy="joined" para eager loading
    usuario = relationship(
        "UsuarioAfiliado",
        back_populates="multas",
        lazy="joined"
    )
    
    def __repr__(self):
        return f"<MultaAfiliado(id={self.id_multa_afi}, usuario={self.id_usuario_afi}, estado={self.estado})>"
