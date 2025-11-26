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
    poligono_geojson: Optional[dict] = Field(None, description="Polígono GeoJSON para límites complejos")
    activo: bool = Field(True, description="Estado del límite")

    @validator('norte')
    def validar_norte_mayor_sur(cls, v, values):
        """Valida que el límite norte sea mayor que el sur"""
        if 'sur' in values and v <= values['sur']:
            raise ValueError('El límite norte debe ser mayor que el límite sur')
        return v

    @validator('este')
    def validar_este_mayor_oeste(cls, v, values):
        """Valida que el límite este sea mayor que el oeste"""
        if 'oeste' in values and v <= values['oeste']:
            raise ValueError('El límite este debe ser mayor que el límite oeste')
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
    poligono_geojson: Optional[dict] = None
    activo: Optional[bool] = None


class LimiteGeograficoResponse(LimiteGeograficoBase):
    """Schema de respuesta"""
    id: int
    creado_en: datetime
    actualizado_en: datetime

    class Config:
        from_attributes = True


class CoordenadaValidacion(BaseModel):
    """Schema para validar coordenadas"""
    latitud: Decimal = Field(..., ge=-90, le=90, description="Latitud a validar")
    longitud: Decimal = Field(..., ge=-180, le=180, description="Longitud a validar")


class CoordenadaValidacionResponse(BaseModel):
    """Respuesta de validación de coordenadas"""
    valida: bool
    latitud: Decimal
    longitud: Decimal
    limite_aplicado: Optional[str] = None
    mensaje: str

    class Config:
        from_attributes = True