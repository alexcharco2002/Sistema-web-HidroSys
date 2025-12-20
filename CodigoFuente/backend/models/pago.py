# models/pago.py

from sqlalchemy import Column, Integer, Numeric, String, Text, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from db.session import Base

class Pago(Base):
    """
    Modelo de Pago
    Tabla: t_pagos en el esquema facturacion
    """
    __tablename__ = "t_pagos"
    __table_args__ = {'schema': 'facturacion'}
    
    # Columnas
    id_pago = Column(Integer, primary_key=True, index=True, autoincrement=True)
    id_factura = Column(
        Integer, 
        ForeignKey("facturacion.t_factura.id_factura"), 
        nullable=True, 
        index=True
    )
    monto_pago = Column(Numeric(12, 2), nullable=False)
    fecha_pago = Column(DateTime, nullable=False, default=func.current_timestamp())
    metodo_pago = Column(String(50), nullable=True)
    id_usuario_afi = Column(
        Integer, 
        ForeignKey("usuarios.t_usuario_afiliado.id_usuario_afi"), 
        nullable=True,
        index=True
    )
    id_cajero = Column(
        Integer, 
        ForeignKey("usuarios.t_usuario_sistema.id_usuario_sistema"), 
        nullable=True
    )
    observaciones = Column(Text, nullable=True)
    motivo_anulacion = Column(String(200), nullable=True)
    fecha_anulacion = Column(DateTime(timezone=True), nullable=True)
    activo = Column(Boolean, default=True, nullable=False)
    estado_pago = Column(String(20), nullable=False, default='REGISTRADO', index=True)
    
    # Relaciones ORM
    factura = relationship(
        "Factura",
        back_populates="pagos",
        lazy="joined"
    )
    
    usuario_afiliado = relationship(
        "UsuarioAfiliado",
        foreign_keys=[id_usuario_afi],
        lazy="joined"
    )
    
    cajero = relationship(
        "UsuarioSistema",
        foreign_keys=[id_cajero],
        lazy="joined"
    )
    
    def __repr__(self):
        estado = f"[{self.estado_pago}]"
        return f"<Pago {self.id_pago}: ${self.monto_pago} {estado} - {self.metodo_pago}>"
    
    def to_dict(self):
        """Convierte el objeto a diccionario"""
        return {
            'id_pago': self.id_pago,
            'id_factura': self.id_factura,
            'monto_pago': float(self.monto_pago) if self.monto_pago else None,
            'fecha_pago': self.fecha_pago.isoformat() if self.fecha_pago else None,
            'metodo_pago': self.metodo_pago,
            'id_usuario_afi': self.id_usuario_afi,
            'id_cajero': self.id_cajero,
            'observaciones': self.observaciones,
            'motivo_anulacion': self.motivo_anulacion,
            'fecha_anulacion': self.fecha_anulacion.isoformat() if self.fecha_anulacion else None,
            'activo': self.activo,
            'estado_pago': self.estado_pago
        }
