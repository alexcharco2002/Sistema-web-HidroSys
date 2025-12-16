# models/limite_geografico.py

from sqlalchemy import (
    Column, Integer, String, Numeric, Boolean,
    TIMESTAMP, JSON, CheckConstraint
)
from sqlalchemy.sql import func
from db.session import Base


class LimiteGeografico(Base):
    __tablename__ = "t_limites_geograficos"
    __table_args__ = (
        CheckConstraint(
            "altitud_min <= altitud_max",
            name="chk_altitud_valida"
        ),
        {"schema": "configuracion"}
    )

    # ================================
    # CAMPOS PRINCIPALES
    # ================================
    id = Column(Integer, primary_key=True, index=True)

    nombre = Column(String(150), unique=True, nullable=False)

    norte = Column(Numeric(10, 7), nullable=False)
    sur = Column(Numeric(10, 7), nullable=False)
    este = Column(Numeric(10, 7), nullable=False)
    oeste = Column(Numeric(10, 7), nullable=False)

    # 🔹 NUEVOS CAMPOS DE ALTITUD
    altitud_min = Column(Numeric(10, 2), nullable=True)
    altitud_max = Column(Numeric(10, 2), nullable=True)

    poligono_geojson = Column(JSON, nullable=True)

    activo = Column(Boolean, default=True)

    creado_en = Column(TIMESTAMP, server_default=func.now())
    actualizado_en = Column(
        TIMESTAMP,
        server_default=func.now(),
        onupdate=func.now()
    )

    # ================================
    # MÉTODOS
    # ================================
    def contiene_coordenada(self, latitud: float, longitud: float) -> bool:
        return (
            float(self.sur) <= latitud <= float(self.norte) and
            float(self.oeste) <= longitud <= float(self.este)
        )

    def contiene_altitud(self, altitud: float) -> bool:
        if self.altitud_min is None or self.altitud_max is None:
            return True  # no valida si no hay rango
        return float(self.altitud_min) <= altitud <= float(self.altitud_max)

    def to_dict(self):
        return {
            "id": self.id,
            "nombre": self.nombre,
            "norte": float(self.norte),
            "sur": float(self.sur),
            "este": float(self.este),
            "oeste": float(self.oeste),
            "altitud_min": (
                float(self.altitud_min) if self.altitud_min is not None else None
            ),
            "altitud_max": (
                float(self.altitud_max) if self.altitud_max is not None else None
            ),
            "poligono_geojson": self.poligono_geojson,
            "activo": self.activo,
            "creado_en": self.creado_en,
            "actualizado_en": self.actualizado_en
        }

    def __repr__(self):
        return f"<LimiteGeografico id={self.id} nombre='{self.nombre}'>"
