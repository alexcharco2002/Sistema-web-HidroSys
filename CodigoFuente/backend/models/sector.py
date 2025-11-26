# models/sector.py
from sqlalchemy import Column, Integer, String, Boolean
from sqlalchemy.orm import relationship
from db.session import Base

class Sector(Base):
    """
    Modelo de Sector
    Tabla: t_sector
    """
    __tablename__ = "t_sector"
    __table_args__ = {'schema': 'medidores'}
    
    id_sector = Column(Integer, primary_key=True, index=True)
    nombre_sector = Column(String(100), nullable=False, unique=True)
    descripcion = Column(String(255), nullable=True)
    activo = Column(Boolean, default=True, nullable=False)
    
    # Relaciones (si tienes tabla de medidores u otras que dependan de sector)
    # medidores = relationship("Medidor", back_populates="sector")
    
    def __repr__(self):
        return f"<Sector(id={self.id_sector}, nombre='{self.nombre_sector}', activo={self.activo})>"