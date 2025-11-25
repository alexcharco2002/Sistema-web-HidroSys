# schemas/tarifa.py
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional
from datetime import datetime
from decimal import Decimal
import re

class TarifaBase(BaseModel):
    """Schema base para Tarifa"""
    nombre: str = Field(..., min_length=3, max_length=100, description="Nombre de la tarifa")
    detalle: Optional[str] = Field(None, max_length=500, description="Descripción detallada de la tarifa")
    precio_por_m3: Decimal = Field(..., ge=0, description="Precio por metro cúbico")
    limite_min_m3: Decimal = Field(..., ge=0, description="Límite mínimo en metros cúbicos")
    limite_max_m3: Optional[Decimal] = Field(None, ge=0, description="Límite máximo en metros cúbicos (opcional)")
    tipo_tarifa: str = Field(..., min_length=2, max_length=50, description="Tipo de tarifa (ej: Residencial, Comercial)")
    activo: bool = Field(default=True, description="Estado de la tarifa")
    
    @field_validator('nombre')
    @classmethod
    def validar_nombre(cls, v: str) -> str:
        """Valida que el nombre solo tenga letras y espacios"""
        if not v or not v.strip():
            raise ValueError('El nombre de la tarifa no puede estar vacío')

        nombre_limpio = v.strip()

        # Regex: solo letras (incluye acentos) y espacios
        if not re.match(r'^[A-Za-zÁÉÍÓÚáéíóúÑñ ]+$', nombre_limpio):
            raise ValueError('El nombre solo puede contener letras y espacios')

        if len(nombre_limpio) < 3:
            raise ValueError('El nombre debe tener al menos 3 caracteres')

        return nombre_limpio


    @field_validator('tipo_tarifa')
    @classmethod
    def validar_tipo_tarifa(cls, v: str) -> str:
        """Valida que el tipo de tarifa solo tenga letras y espacios"""
        if not v or not v.strip():
            raise ValueError('El tipo de tarifa no puede estar vacío')

        tipo_limpio = v.strip()

        # Regex: solo letras, acentos y espacios
        if not re.match(r'^[A-Za-zÁÉÍÓÚáéíóúÑñ ]+$', tipo_limpio):
            raise ValueError('El tipo de tarifa solo puede contener letras y espacios')

        if len(tipo_limpio) < 2:
            raise ValueError('El tipo de tarifa debe tener al menos 2 caracteres')

        return tipo_limpio
    
    @field_validator('detalle')
    @classmethod
    def validar_detalle(cls, v: Optional[str]) -> Optional[str]:
        """Valida y limpia el detalle (opcional)"""
        if v is None or not v.strip():
            return None
        return v.strip()
    
    @field_validator('precio_por_m3', 'limite_min_m3', 'limite_max_m3')
    @classmethod
    def validar_valores_numericos(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        """Valida que los valores numéricos sean válidos"""
        if v is not None and v < 0:
            raise ValueError('Los valores numéricos no pueden ser negativos')
        return v
    
    @model_validator(mode='after')
    def validar_limites(self):
        """Valida que el límite máximo sea mayor que el mínimo"""
        if self.limite_max_m3 is not None:
            if self.limite_max_m3 <= self.limite_min_m3:
                raise ValueError(
                    f'El límite máximo ({self.limite_max_m3} m³) debe ser mayor que el límite mínimo ({self.limite_min_m3} m³)'
                )
        return self


class TarifaCreate(TarifaBase):
    """Schema para crear una nueva tarifa"""
    pass


class TarifaUpdate(BaseModel):
    """Schema para actualizar una tarifa existente (campos opcionales)"""
    nombre: Optional[str] = Field(None, min_length=3, max_length=100)
    detalle: Optional[str] = Field(None, max_length=500)
    precio_por_m3: Optional[Decimal] = Field(None, ge=0)
    limite_min_m3: Optional[Decimal] = Field(None, ge=0)
    limite_max_m3: Optional[Decimal] = Field(None, ge=0)
    tipo_tarifa: Optional[str] = Field(None, min_length=2, max_length=50)
    activo: Optional[bool] = None
    
    @field_validator('nombre')
    @classmethod
    def validar_nombre(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            nombre_limpio = v.strip()
            if len(nombre_limpio) < 3:
                raise ValueError('El nombre de la tarifa debe tener al menos 3 caracteres')
            return nombre_limpio
        return v
    
    @field_validator('tipo_tarifa')
    @classmethod
    def validar_tipo_tarifa(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            tipo_limpio = v.strip()
            if len(tipo_limpio) < 2:
                raise ValueError('El tipo de tarifa debe tener al menos 2 caracteres')
            return tipo_limpio
        return v
    
    @field_validator('detalle')
    @classmethod
    def validar_detalle(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if not v.strip():
                return None
            return v.strip()
        return v
    
    @model_validator(mode='after')
    def validar_limites(self):
        """Valida que el límite máximo sea mayor que el mínimo si ambos están presentes"""
        if self.limite_max_m3 is not None and self.limite_min_m3 is not None:
            if self.limite_max_m3 <= self.limite_min_m3:
                raise ValueError(
                    f'El límite máximo ({self.limite_max_m3} m³) debe ser mayor que el límite mínimo ({self.limite_min_m3} m³)'
                )
        return self


class TarifaResponse(TarifaBase):
    """Schema para la respuesta de tarifa"""
    id_tarifa: int
    fecha_creacion: datetime
    
    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id_tarifa": 1,
                "nombre": "Tarifa Residencial Básica",
                "detalle": "Tarifa para consumo residencial de 0 a 15 m³",
                "precio_por_m3": 0.50,
                "limite_min_m3": 0,
                "limite_max_m3": 15,
                "tipo_tarifa": "Residencial",
                "fecha_creacion": "2024-01-15T10:30:00",
                "activo": True
            }
        }


class TarifaStats(BaseModel):
    """Schema para estadísticas de tarifas"""
    total: int
    activos: int
    inactivos: int
    tipos_unicos: int
    tipos_tarifa: list[str]
    
    class Config:
        json_schema_extra = {
            "example": {
                "total": 10,
                "activos": 8,
                "inactivos": 2,
                "tipos_unicos": 3,
                "tipos_tarifa": ["Residencial", "Comercial", "Industrial"]
            }
        }