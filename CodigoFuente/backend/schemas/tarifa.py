# schemas/tarifa.py

from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional
from datetime import datetime
from decimal import Decimal
import re

class TarifaBase(BaseModel):
    """Schema base para Tarifa"""
    nombre: str = Field(..., min_length=3, max_length=100)
    detalle: Optional[str] = Field(None, max_length=500)
    precio_por_m3: Decimal = Field(..., ge=0)
    limite_min_m3: Decimal = Field(..., ge=0)
    limite_max_m3: Decimal = Field(..., ge=0)  # ⬅ obligatorio
    tipo_tarifa: str = Field(..., min_length=2, max_length=50)

    @model_validator(mode='before')
    def validar_limites_before(self):
        if self.limite_max_m3 <= self.limite_min_m3:
            raise ValueError(
                f'El límite máximo ({self.limite_max_m3} m³) debe ser mayor que el límite mínimo ({self.limite_min_m3} m³)'
            )
        return self


    @field_validator('nombre')
    @classmethod
    def validar_nombre(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError('El nombre de la tarifa no puede estar vacío')
        nombre_limpio = v.strip()
        if not re.match(r'^[A-Za-zÁÉÍÓÚáéíóúÑñ0-9 ]+$', nombre_limpio):
            raise ValueError('El nombre solo puede contener letras, números y espacios')
        if len(nombre_limpio) < 3:
            raise ValueError('El nombre debe tener al menos 3 caracteres')
        return nombre_limpio

    @field_validator('tipo_tarifa')
    @classmethod
    def validar_tipo_tarifa(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError('El tipo de tarifa no puede estar vacío')
        tipo_limpio = v.strip()
        if not re.match(r'^[A-Za-zÁÉÍÓÚáéíóúÑñ ]+$', tipo_limpio):
            raise ValueError('El tipo de tarifa solo puede contener letras y espacios')
        if len(tipo_limpio) < 2:
            raise ValueError('El tipo de tarifa debe tener al menos 2 caracteres')
        return tipo_limpio

    @field_validator('detalle')
    @classmethod
    def validar_detalle(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not v.strip():
            return None
        return v.strip()

    @field_validator('precio_por_m3', 'limite_min_m3', 'limite_max_m3')
    @classmethod
    def validar_valores_numericos(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is not None and v < 0:
            raise ValueError('Los valores numéricos no pueden ser negativos')
        return v

    @model_validator(mode='after')
    def validar_limites_after(self):
        if self.limite_max_m3 is not None:
            if self.limite_max_m3 <= self.limite_min_m3:
                raise ValueError(
                    f'El límite máximo ({self.limite_max_m3} m³) debe ser mayor que el límite mínimo ({self.limite_min_m3} m³)'
                )
        return self


class TarifaCreate(TarifaBase):
    """Schema para crear una nueva tarifa"""
    vigencia_desde: Optional[datetime] = Field(None, description="Fecha desde la cual la tarifa es vigente")


class TarifaUpdate(TarifaBase):
    """
    Schema para crear una NUEVA VERSIÓN de la tarifa
    NO actualiza la existente, crea una nueva y desactiva la anterior
    """
    vigencia_desde: Optional[datetime] = Field(None, description="Fecha desde la cual la nueva versión es vigente")
    motivo_cambio: Optional[str] = Field(None, max_length=500, description="Motivo del cambio de versión")


class TarifaResponse(TarifaBase):
    """Schema para la respuesta de tarifa"""
    id_tarifa: int
    fecha_creacion: datetime
    activo: bool
    vigencia_desde: datetime
    vigencia_hasta: Optional[datetime] = None
    es_vigente: bool

    class Config:
        from_attributes = True


class TarifaHistorialResponse(BaseModel):
    """Schema para respuesta del historial de versiones"""
    id_tarifa: int
    nombre: str
    precio_por_m3: Decimal
    limite_min_m3: Decimal
    limite_max_m3: Decimal   # ⬅ obligatorio, no opcional
    tipo_tarifa: str
    vigencia_desde: datetime
    vigencia_hasta: Optional[datetime]
    es_vigente: bool
    activo: bool
    
    class Config:
        from_attributes = True



class TarifaStats(BaseModel):
    """Schema para estadísticas de tarifas"""
    total_versiones: int
    tarifas_vigentes: int
    tarifas_vencidas: int
    tipos_unicos: int
    tipos_tarifa: list[str]
