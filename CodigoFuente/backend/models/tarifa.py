# models/tarifa.py
from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, Text
from sqlalchemy.sql import func
from db.session import Base

class Tarifa(Base):
    """
    Modelo de Tarifa para el sistema de facturación
    Tabla: t_tarifa en el esquema facturacion
    """
    __tablename__ = "t_tarifa"
    __table_args__ = {'schema': 'facturacion'}
    
    # Columnas
    id_tarifa = Column(Integer, primary_key=True, index=True, autoincrement=True)
    nombre = Column(String(100), nullable=False, unique=True, index=True)
    detalle = Column(Text, nullable=True)
    precio_por_m3 = Column(Numeric(10, 2), nullable=False)
    limite_min_m3 = Column(Numeric(10, 2), nullable=False, default=0)
    limite_max_m3 = Column(Numeric(10, 2), nullable=True)  # Null = sin límite superior
    tipo_tarifa = Column(String(50), nullable=False, index=True)
    fecha_creacion = Column(
        DateTime(timezone=True),
        default=func.now(),   # <--- agrega este
        nullable=False
    )
    activo = Column(Boolean, default=True, nullable=False, index=True)
    
    def __repr__(self):
        return f"<Tarifa(id={self.id_tarifa}, nombre='{self.nombre}', tipo='{self.tipo_tarifa}', precio={self.precio_por_m3})>"
    
    def to_dict(self):
        """Convierte el objeto a diccionario"""
        return {
            'id_tarifa': self.id_tarifa,
            'nombre': self.nombre,
            'detalle': self.detalle,
            'precio_por_m3': float(self.precio_por_m3) if self.precio_por_m3 else 0.0,
            'limite_min_m3': float(self.limite_min_m3) if self.limite_min_m3 else 0.0,
            'limite_max_m3': float(self.limite_max_m3) if self.limite_max_m3 else None,
            'tipo_tarifa': self.tipo_tarifa,
            'fecha_creacion': self.fecha_creacion.isoformat() if self.fecha_creacion else None,
            'activo': self.activo
        }