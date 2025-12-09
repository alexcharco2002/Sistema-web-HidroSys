# schemas/multa.py

from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime
from decimal import Decimal
import re

class TipoMultaBase(BaseModel):
    """Schema base para Tipo de Multa"""
    nombre_multa: str = Field(..., min_length=3, max_length=100)
    descripcion: Optional[str] = Field(None, max_length=500)
    monto: Optional[Decimal] = Field(None, ge=0)

    @field_validator("nombre_multa")
    @classmethod
    def validar_nombre(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("El nombre de la multa no puede estar vacío")
        nombre_limpio = v.strip()
        if len(nombre_limpio) < 3:
            raise ValueError("El nombre debe tener al menos 3 caracteres")
        # Si quieres restringir caracteres, descomenta:
        # if not re.match(r"^[A-Za-zÁÉÍÓÚáéíóúÑñ0-9 ]+$", nombre_limpio):
        #     raise ValueError("El nombre solo puede contener letras, números y espacios")
        return nombre_limpio

    @field_validator("descripcion")
    @classmethod
    def validar_descripcion(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not v.strip():
            return None
        return v.strip()

class TipoMultaCreate(TipoMultaBase):
    """Crear nueva multa (primera versión)"""
    vigencia_desde: Optional[datetime] = Field(
        None, description="Fecha desde la cual el tipo de multa es vigente"
    )

class TipoMultaUpdate(TipoMultaBase):
    """Crear NUEVA VERSIÓN de la multa (no se edita la vieja)"""
    vigencia_desde: Optional[datetime] = Field(
        None, description="Fecha desde la cual la nueva versión es vigente"
    )
    motivo_cambio: Optional[str] = Field(
        None, max_length=500, description="Motivo del cambio de versión"
    )

class TipoMultaResponse(TipoMultaBase):
    """Respuesta de un tipo de multa"""
    id_tipo_multa: int
    fecha_creacion: datetime
    activo: bool
    vigencia_desde: datetime
    vigencia_hasta: Optional[datetime] = None
    es_vigente: bool

    class Config:
        from_attributes = True  # igual que en Tarifa

class TipoMultaHistorialResponse(BaseModel):
    """Historial de versiones de un tipo de multa"""
    id_tipo_multa: int
    nombre_multa: str
    monto: Optional[Decimal]
    vigencia_desde: datetime
    vigencia_hasta: Optional[datetime]
    es_vigente: bool
    activo: bool

    class Config:
        from_attributes = True

class TipoMultaStats(BaseModel):
    """Estadísticas de tipos de multa"""
    total_versiones: int
    tipos_vigentes: int
    tipos_vencidos: int
