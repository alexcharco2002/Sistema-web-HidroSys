"""
TITLE: models/mora.py
Modelos SQLAlchemy para la gestión de mora en facturación
"""

from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, Date, Text, ForeignKey, CheckConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from db.session import Base


class ConfiguracionMora(Base):
    """
    Modelo para configuración de mora (intereses por pago tardío).
    Permite definir reglas de cálculo de mora que los administradores
    pueden activar/desactivar.
    """
    __tablename__ = "t_configuracion_mora"
    __table_args__ = {"schema": "facturacion"}

    id_configuracion_mora = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    descripcion = Column(Text, nullable=True)
    
    # Control de aplicación
    aplicar_mora = Column(Boolean, default=True, nullable=False)
    activo = Column(Boolean, default=True, nullable=False)
    
    # Tiempo de gracia
    dias_gracia = Column(Integer, default=0, nullable=False)
    
    # Tipo de cálculo
    tipo_calculo = Column(
        String(20), 
        CheckConstraint("tipo_calculo IN ('porcentaje', 'fijo', 'interes_diario')"),
        nullable=False
    )
    
    # Valores de mora
    porcentaje_mora = Column(Numeric(5, 2), nullable=True)  # Ej: 3.75 para 3.75%
    valor_fijo = Column(Numeric(10, 2), nullable=True)
    interes_diario = Column(Numeric(5, 4), nullable=True)  # Para interés diario acumulado
    
    # Vigencia
    fecha_creacion = Column(DateTime, server_default=func.now(), nullable=False)
    vigencia_desde = Column(Date, nullable=False)
    vigencia_hasta = Column(Date, nullable=True)
    es_vigente = Column(Boolean, default=True, nullable=False)
    
    # Límites opcionales
    mora_maxima = Column(Numeric(10, 2), nullable=True)
    aplicar_sobre = Column(
        String(20),
        CheckConstraint("aplicar_sobre IN ('total', 'consumo', 'base')"),
        default='total',
        nullable=False
    )
    
    # Relación con moras aplicadas
    moras_aplicadas = relationship("MoraFactura", back_populates="configuracion")

    def __repr__(self):
        return f"<ConfiguracionMora(id={self.id_configuracion_mora}, nombre='{self.nombre}', tipo='{self.tipo_calculo}')>"


class MoraFactura(Base):
    """
    Modelo para registro histórico de moras aplicadas a facturas.
    Se crea automáticamente cuando se calcula y aplica mora a una factura.
    """
    __tablename__ = "t_mora_factura"
    __table_args__ = {"schema": "facturacion"}

    id_mora = Column(Integer, primary_key=True, index=True)
    id_factura = Column(Integer, ForeignKey("facturacion.t_factura.id_factura"), nullable=False, index=True)
    id_configuracion_mora = Column(
        Integer, 
        ForeignKey("facturacion.t_configuracion_mora.id_configuracion_mora"),
        nullable=False
    )
    
    # Datos del cálculo
    monto_base = Column(Numeric(10, 2), nullable=False)
    dias_mora = Column(Integer, nullable=False)
    tipo_calculo = Column(String(20), nullable=False)
    tasa_aplicada = Column(Numeric(5, 2), nullable=True)
    
    # Resultado
    monto_mora = Column(Numeric(10, 2), nullable=False)
    fecha_calculo = Column(DateTime, server_default=func.now(), nullable=False)
    
    # Control
    aplicada = Column(Boolean, default=False, nullable=False)
    fecha_aplicacion = Column(DateTime, nullable=True)
    observaciones = Column(Text, nullable=True)
    
    # Relaciones
    configuracion = relationship("ConfiguracionMora", back_populates="moras_aplicadas")
    # factura = relationship("Factura", back_populates="moras")  # Descomentar si tienes el modelo Factura

    def __repr__(self):
        return f"<MoraFactura(id={self.id_mora}, factura={self.id_factura}, monto=${self.monto_mora})>"
