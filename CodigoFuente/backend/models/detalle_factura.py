# models/detalle_factura.py

from sqlalchemy import Column, Integer, String, Numeric, Text, ForeignKey, CheckConstraint
from sqlalchemy.orm import relationship
from db.session import Base


class DetalleFactura(Base):
    """
    Modelo de Detalle de Factura (Líneas de la factura)
    Tabla: t_detalle_factura en el esquema facturacion
    Relación N:1 con Factura
    """
    __tablename__ = "t_detalle_factura"
    __table_args__ = (
        CheckConstraint(
            "(tipo_detalle = 'servicio' AND id_servicio IS NOT NULL AND id_multa_afiliados IS NULL) OR "
            "(tipo_detalle = 'multa' AND id_multa_afiliados IS NOT NULL AND id_servicio IS NULL)",
            name='chk_detalle_tipo_coherente'
        ),
        CheckConstraint(
            'subtotal_detalle >= 0',
            name='chk_subtotal_positivo'
        ),
        CheckConstraint(
            "tipo_detalle IN ('servicio', 'multa', 'consumo', 'cambio medidor')",
            name='chk_tipo_detalle_valido'
        ),
        {'schema': 'facturacion'}
    )

    # Columnas principales
    id_detalle = Column(Integer, primary_key=True, index=True, autoincrement=True)
    id_factura = Column(
        Integer,
        ForeignKey('facturacion.t_factura.id_factura', ondelete='CASCADE'),
        nullable=False,
        index=True
    )
    tipo_detalle = Column(
        String(20),
        nullable=False,
        default='servicio'
    )
    
    # Foreign keys opcionales según tipo
    id_servicio = Column(
        Integer,
        ForeignKey('medidores.t_servicios.id_servicio'),
        nullable=True
    )
    id_multa_afiliados = Column(
        Integer,
        ForeignKey('multas.t_multas_afiliados.id_multa_afi'),
        nullable=True
    )
    
    # Valores
    subtotal_detalle = Column(Numeric(10, 2), nullable=False)
    descripcion = Column(Text, nullable=True)
    id_asignacion_sp = Column(
        Integer,
        ForeignKey('facturacion.t_asignacion_servicio_permanente.id_asignacion_sp'),
        nullable=True
    )
    # Relaciones
    factura = relationship(
        "Factura",
        back_populates="detalles"
    )

    def __repr__(self):
        return f"<DetalleFactura(id={self.id_detalle}, factura_id={self.id_factura}, tipo='{self.tipo_detalle}', subtotal={self.subtotal_detalle})>"

    def to_dict(self):
        """Convierte el objeto a diccionario"""
        return {
            'id_detalle': self.id_detalle,
            'id_factura': self.id_factura,
            'tipo_detalle': self.tipo_detalle,
            'id_servicio': self.id_servicio,
            'id_multa_afiliados': self.id_multa_afiliados,
            'id_asignacion_sp': self.id_asignacion_sp,
            'subtotal_detalle': float(self.subtotal_detalle) if self.subtotal_detalle else 0.0,
            'descripcion': self.descripcion
        }
