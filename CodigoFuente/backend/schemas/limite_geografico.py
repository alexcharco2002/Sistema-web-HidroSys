# schemas/limite_geografico.py
from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class LimiteGeograficoBase(BaseModel):
    nombre: str = Field(..., max_length=150, description="Nombre del límite geográfico")

    norte: Decimal = Field(..., ge=-90, le=90, description="Límite norte (latitud)")
    sur: Decimal = Field(..., ge=-90, le=90, description="Límite sur (latitud)")
    este: Decimal = Field(..., ge=-180, le=180, description="Límite este (longitud)")
    oeste: Decimal = Field(..., ge=-180, le=180, description="Límite oeste (longitud)")

    # 🔹 NUEVOS CAMPOS DE ALTITUD
    altitud_min: Optional[Decimal] = Field(
        None, ge=0, description="Altitud mínima permitida (m)"
    )
    altitud_max: Optional[Decimal] = Field(
        None, ge=0, description="Altitud máxima permitida (m)"
    )

    poligono_geojson: Optional[dict] = Field(
        None, description="Polígono GeoJSON para límites complejos"
    )
    activo: bool = Field(True, description="Estado del límite")

    # ================================
    # VALIDACIONES EXISTENTES
    # ================================

    @validator('norte')
    def validar_norte_mayor_sur(cls, v, values):
        if 'sur' in values and v <= values['sur']:
            raise ValueError('El límite norte debe ser mayor que el límite sur')
        return v

    @validator('este')
    def validar_este_mayor_oeste(cls, v, values):
        if 'oeste' in values and v <= values['oeste']:
            raise ValueError('El límite este debe ser mayor que el límite oeste')
        return v

    # ================================
    # 🔹 VALIDACIÓN DE ALTITUD
    # ================================

    @validator('altitud_max')
    def validar_altitud_max_mayor_min(cls, v, values):
        if v is not None and 'altitud_min' in values:
            alt_min = values.get('altitud_min')
            if alt_min is not None and v <= alt_min:
                raise ValueError(
                    'La altitud máxima debe ser mayor que la altitud mínima'
                )
        return v


class LimiteGeograficoCreate(LimiteGeograficoBase):
    """Schema para crear un límite geográfico"""
    pass


class LimiteGeograficoUpdate(BaseModel):
    """Schema para actualizar un límite geográfico (campos opcionales)"""
    nombre: Optional[str] = Field(None, max_length=150)
    norte: Optional[Decimal] = Field(None, ge=-90, le=90)
    sur: Optional[Decimal] = Field(None, ge=-90, le=90)
    este: Optional[Decimal] = Field(None, ge=-180, le=180)
    oeste: Optional[Decimal] = Field(None, ge=-180, le=180)

    # 🔹 NUEVOS CAMPOS
    altitud_min: Optional[Decimal] = Field(None, ge=0)
    altitud_max: Optional[Decimal] = Field(None, ge=0)

    poligono_geojson: Optional[dict] = None
    activo: Optional[bool] = None

    @validator('altitud_max')
    def validar_altitud_max_update(cls, v, values):
        if v is not None and 'altitud_min' in values:
            alt_min = values.get('altitud_min')
            if alt_min is not None and v <= alt_min:
                raise ValueError(
                    'La altitud máxima debe ser mayor que la altitud mínima'
                )
        return v


class LimiteGeograficoResponse(LimiteGeograficoBase):
    id: int
    creado_en: datetime
    actualizado_en: datetime

    class Config:
        from_attributes = True


class CoordenadaValidacion(BaseModel):
    latitud: Decimal = Field(..., ge=-90, le=90)
    longitud: Decimal = Field(..., ge=-180, le=180)
    altitud: Optional[Decimal] = Field(
        None, ge=0, description="Altitud a validar (m)"
    )


class CoordenadaValidacionResponse(BaseModel):
    valida: bool
    latitud: Decimal
    longitud: Decimal
    altitud: Optional[Decimal] = None
    limite_aplicado: Optional[str] = None
    mensaje: str

    class Config:
        from_attributes = True
