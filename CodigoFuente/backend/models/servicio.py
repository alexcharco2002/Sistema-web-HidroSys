# models/servicio.py

from sqlalchemy import Column, Integer, String, Numeric, Boolean, Text
from db.session import Base

class Servicio(Base):
    """
    Modelo de Servicio Adicional para el sistema
    Tabla: t_servicios en el esquema medidores
    """
    
    __tablename__ = "t_servicios"
    __table_args__ = {'schema': 'medidores'}
    
    # Columnas
    id_servicio = Column(Integer, primary_key=True, index=True, autoincrement=True)
    nombre = Column(String(100), nullable=False, unique=True, index=True)
    descripcion = Column(Text, nullable=True)
    precio_base = Column(Numeric(10, 2), nullable=False)
    activo = Column(Boolean, default=True, nullable=False, index=True)
    
    def __repr__(self):
        return f"<Servicio(id={self.id_servicio}, nombre='{self.nombre}', precio={self.precio_base}, activo={self.activo})>"
    
    def to_dict(self):
        """Convierte el objeto a diccionario"""
        return {
            'id_servicio': self.id_servicio,
            'nombre': self.nombre,
            'descripcion': self.descripcion,
            'precio_base': float(self.precio_base) if self.precio_base else 0.0,
            'activo': self.activo
        }
