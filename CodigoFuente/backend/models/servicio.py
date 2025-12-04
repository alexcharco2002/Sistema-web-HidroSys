# models/servicio.py

from sqlalchemy import Column, Integer, String, Numeric, Boolean, Text, DateTime
from datetime import datetime
from db.session import Base

class Servicio(Base):
    """
    Modelo de Servicio Adicional con versionado
    Tabla: t_servicios en el esquema medidores
    """
    __tablename__ = "t_servicios"
    __table_args__ = {'schema': 'medidores'}

    # Columnas
    id_servicio = Column(Integer, primary_key=True, index=True, autoincrement=True)
    nombre = Column(String(100), nullable=False, index=True)
    descripcion = Column(Text, nullable=True)
    precio_base = Column(Numeric(10, 2), nullable=False)
    activo = Column(Boolean, default=True, nullable=False, index=True)
    
    # Campos de versionado
    fecha_creacion = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    vigencia_desde = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, index=True)
    vigencia_hasta = Column(DateTime(timezone=True), nullable=True)
    es_vigente = Column(Boolean, default=True, nullable=False, index=True)

    def __repr__(self):
        return f"<Servicio(id={self.id_servicio}, nombre='{self.nombre}', precio={self.precio_base}, vigente={self.es_vigente})>"

    def to_dict(self):
        """Convierte el objeto a diccionario"""
        return {
            'id_servicio': self.id_servicio,
            'nombre': self.nombre,
            'descripcion': self.descripcion,
            'precio_base': float(self.precio_base) if self.precio_base else 0.0,
            'activo': self.activo,
            'fecha_creacion': self.fecha_creacion.isoformat() if self.fecha_creacion else None,
            'vigencia_desde': self.vigencia_desde.isoformat() if self.vigencia_desde else None,
            'vigencia_hasta': self.vigencia_hasta.isoformat() if self.vigencia_hasta else None,
            'es_vigente': self.es_vigente
        }
