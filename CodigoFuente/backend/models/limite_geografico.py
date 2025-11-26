from sqlalchemy import (
    Column, Integer, String, Numeric, Boolean,
    TIMESTAMP, JSON
)
from sqlalchemy.sql import func
from db.session import Base


class LimiteGeografico(Base):
    __tablename__ = "t_limites_geograficos"
    __table_args__ = {"schema": "configuracion"}

    # ID autoincremental moderno (igual a SERIAL, pero recomendado)
    id = Column(Integer, primary_key=True, index=True)

    # Datos principales
    nombre = Column(String(150), unique=True, nullable=False)

    norte = Column(Numeric(10, 7), nullable=False)
    sur = Column(Numeric(10, 7), nullable=False)
    este = Column(Numeric(10, 7), nullable=False)
    oeste = Column(Numeric(10, 7), nullable=False)

    # Polígono opcional en formato GeoJSON
    poligono_geojson = Column(JSON, nullable=True)

    activo = Column(Boolean, default=True)

    creado_en = Column(TIMESTAMP, server_default=func.now())
    actualizado_en = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    # ================================
    # MÉTODOS DEL MODELO
    # ================================

    def contiene_coordenada(self, latitud: float, longitud: float) -> bool:
        """
        Verifica si una coordenada está dentro del rectángulo de límites.
        Devuelve True si está dentro, False si está fuera.
        """
        return (
            float(self.sur) <= latitud <= float(self.norte) and
            float(self.oeste) <= longitud <= float(self.este)
        )

    def to_dict(self):
        """Convierte el objeto en un diccionario JSON serializable."""
        return {
            "id": self.id,
            "nombre": self.nombre,
            "norte": float(self.norte),
            "sur": float(self.sur),
            "este": float(self.este),
            "oeste": float(self.oeste),
            "poligono_geojson": self.poligono_geojson,
            "activo": self.activo,
            "creado_en": (
                self.creado_en.strftime("%Y-%m-%d %H:%M:%S")
                if self.creado_en else None
            ),
            "actualizado_en": (
                self.actualizado_en.strftime("%Y-%m-%d %H:%M:%S")
                if self.actualizado_en else None
            )
        }

    def __repr__(self):
        return f"<LimiteGeografico id={self.id} nombre='{self.nombre}'>"
