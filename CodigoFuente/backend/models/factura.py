# models/factura.py
from sqlalchemy import Column, Integer, String, Numeric, Boolean, Date, ForeignKey, CheckConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from db.session import Base


class Factura(Base):
    """
    Modelo de Factura (Cabecera)
    Tabla: t_factura en el esquema facturacion
    Relación 1:N con DetalleFactura
    """
    __tablename__ = "t_factura"
    __table_args__ = (
        CheckConstraint(
            'total >= 0',
            name='chk_factura_total_positivo'
        ),
        CheckConstraint(
            'consumo_m3 >= 0',
            name='chk_factura_consumo_positivo'
        ),
        CheckConstraint(
            "estado_factura IN ('pendiente', 'pagada', 'anulada', 'vencida', 'facturado')",
            name='chk_estado_valido'
        ),
        {'schema': 'facturacion'}
    )

    # Columnas principales
    id_factura = Column(Integer, primary_key=True, index=True, autoincrement=True)
    num_factura = Column(String(50), unique=True, nullable=False, index=True)
    id_usuario_afi = Column(
        Integer, 
        ForeignKey('usuarios.t_usuario_afiliado.id_usuario_afi'),
        nullable=False,
        index=True
    )
    id_lectura = Column(
        Integer,
        ForeignKey('medidores.t_lecturas.id_lectura'),
        nullable=True,
        unique=True  # Si quieres 1:1 entre lectura y factura
    )
    id_tarifa = Column(
        Integer,
        ForeignKey('facturacion.t_tarifa.id_tarifa'),
        nullable=False
    )
    
    # Datos de consumo
    consumo_m3 = Column(Integer, nullable=True)
    exceso_m3 = Column(Integer, nullable=True)
    
    # Valores monetarios
    valor_consumo = Column(Numeric(10, 2), nullable=True)
    valor_exceso = Column(Numeric(10, 2), nullable=True)
    descuento = Column(Numeric(10, 2), nullable=True, default=0)
    subtotal = Column(Numeric(10, 2), nullable=True)
    impuesto = Column(Numeric(10, 2), nullable=True)
    total = Column(Numeric(10, 2), nullable=False)
    
    # Fechas y estado
    fecha_emision = Column(Date, default=func.current_date(), nullable=False)
    periodo = Column(String(7), nullable=False)  # Formato: YYYY-MM
    estado_factura = Column(
        String(20), 
        nullable=False, 
        default='pendiente',
        index=True
    )
    
    # Relaciones
    # Relaciones
    usuario_afiliado = relationship(
        "UsuarioAfiliado",
        foreign_keys=[id_usuario_afi],  # ✅ Agregar esto
        backref="facturas",
        lazy="joined"
    )


    detalles = relationship(
        "DetalleFactura",
        back_populates="factura",
        cascade="all, delete-orphan",
        lazy="select"
    )

    pagos = relationship(
        "Pago",
        back_populates="factura",
        lazy="select",
        cascade="all, delete-orphan"
    )

   

    def __repr__(self):
        return f"<Factura(id={self.id_factura}, num='{self.num_factura}', periodo='{self.periodo}', total={self.total}, estado='{self.estado_factura}')>"

    def to_dict(self):
        """Convierte el objeto a diccionario"""
        return {
            'id_factura': self.id_factura,
            'num_factura': self.num_factura,
            'id_usuario_afi': self.id_usuario_afi,
            'id_lectura': self.id_lectura,
            'id_tarifa': self.id_tarifa,
            'consumo_m3': self.consumo_m3,
            'exceso_m3': self.exceso_m3,
            'valor_consumo': float(self.valor_consumo) if self.valor_consumo else 0.0,
            'valor_exceso': float(self.valor_exceso) if self.valor_exceso else 0.0,
            'descuento': float(self.descuento) if self.descuento else 0.0,
            'subtotal': float(self.subtotal) if self.subtotal else 0.0,
            'impuesto': float(self.impuesto) if self.impuesto else 0.0,
            'total': float(self.total) if self.total else 0.0,
            'fecha_emision': self.fecha_emision.isoformat() if self.fecha_emision else None,
            'periodo': self.periodo,
            'estado_factura': self.estado_factura
        }
