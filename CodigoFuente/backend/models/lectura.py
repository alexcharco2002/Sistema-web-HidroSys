# models/lectura.py

from sqlalchemy import Column, Integer, String, Date, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from db.session import Base


class Lectura(Base):
    """
    Modelo de Lectura de Medidor
    Tabla: t_lecturas en el esquema medidores
    """
    
    __tablename__ = "t_lecturas"
    __table_args__ = {'schema': 'medidores'}
    
    # Columnas
    id_lectura = Column(Integer, primary_key=True, index=True, autoincrement=True)
    id_medidor = Column(Integer, ForeignKey("medidores.t_medidor.id_medidor"), nullable=False, index=True)
    lectura_actual = Column(Integer, nullable=False)
    lectura_anterior = Column(Integer, nullable=False)
    consumo_m3 = Column(Integer, nullable=False)
    fecha_lectura = Column(Date, nullable=False, index=True)
    periodo_consumo = Column(String(7), nullable=False, index=True)
    id_lector = Column(Integer, ForeignKey("usuarios.t_usuario_sistema.id_usuario_sistema"), nullable=True)
    observacion = Column(Text, nullable=True)
    activo = Column(Boolean, default=True, nullable=False, index=True)
    es_estimada = Column(Boolean, default=False, nullable=False, index=True)  # ✅ AGREGADO index=True, nullable=False
    
    # Relaciones ORM
    medidor = relationship(
        "Medidor",
        back_populates="lecturas",
        lazy="joined"
    )
    
    lector = relationship(
        "UsuarioSistema",
        foreign_keys=[id_lector],
        lazy="joined"
    )
    
    def __repr__(self):
        tipo = "ESTIMADA" if self.es_estimada else "REAL"  # ✅ MEJORADO
        return f"<Lectura(id={self.id_lectura}, medidor={self.id_medidor}, consumo={self.consumo_m3}m³, fecha={self.fecha_lectura}, tipo={tipo})>"
    
    def to_dict(self):
        """Convierte el objeto a diccionario"""
        return {
            'id_lectura': self.id_lectura,
            'id_medidor': self.id_medidor,
            'lectura_actual': self.lectura_actual,
            'lectura_anterior': self.lectura_anterior,
            'consumo_m3': self.consumo_m3,
            'fecha_lectura': self.fecha_lectura.isoformat() if self.fecha_lectura else None,
            'periodo_consumo': self.periodo_consumo,
            'id_lector': self.id_lector,
            'observacion': self.observacion,
            'activo': self.activo,
            'es_estimada': self.es_estimada  
        }
