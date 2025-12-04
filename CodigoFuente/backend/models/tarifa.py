# models/tarifa.py

from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, Text, CheckConstraint
from sqlalchemy.sql import func
from db.session import Base

class Tarifa(Base):
    """
    Modelo de Tarifa con versionamiento
    Cada cambio de tarifa crea una NUEVA versión, nunca se modifica una existente
    Tabla: t_tarifa en el esquema facturacion
    """
    __tablename__ = "t_tarifa"
    __table_args__ = (
        CheckConstraint(
            'limite_max_m3 IS NULL OR limite_max_m3 > limite_min_m3',
            name='check_limites_coherentes'
        ),
        {'schema': 'facturacion'}
    )

    # Columnas principales
    id_tarifa = Column(Integer, primary_key=True, index=True, autoincrement=True)
    nombre = Column(String(100), nullable=False, index=True)  # Ya no es UNIQUE, permite versiones
    detalle = Column(Text, nullable=True)
    precio_por_m3 = Column(Numeric(10, 2), nullable=False)
    limite_min_m3 = Column(Numeric(10, 2), nullable=False, default=0)
    limite_max_m3 = Column(Numeric(10, 2), nullable=True)
    tipo_tarifa = Column(String(50), nullable=False, index=True)
    fecha_creacion = Column(
        DateTime(timezone=True),
        default=func.now(),
        nullable=False
    )
    activo = Column(Boolean, default=True, nullable=False, index=True)
    
    # Campos de versionamiento
    vigencia_desde = Column(
        DateTime(timezone=True),
        default=func.now(),
        nullable=False,
        index=True
    )
    vigencia_hasta = Column(DateTime(timezone=True), nullable=True)
    es_vigente = Column(Boolean, default=True, nullable=False, index=True)

    def __repr__(self):
        return f"<Tarifa(id={self.id_tarifa}, nombre='{self.nombre}', vigente={self.es_vigente}, desde={self.vigencia_desde})>"

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
            'activo': self.activo,
            'vigencia_desde': self.vigencia_desde.isoformat() if self.vigencia_desde else None,
            'vigencia_hasta': self.vigencia_hasta.isoformat() if self.vigencia_hasta else None,
            'es_vigente': self.es_vigente
        }
