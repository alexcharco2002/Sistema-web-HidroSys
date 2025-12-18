# schemas/iva.py

from datetime import datetime
from decimal import Decimal
from typing import Optional, List
import re
from pydantic import BaseModel, Field, field_validator, model_validator

class IVABase(BaseModel):
    """Schema base para IVA"""
    codigo: str = Field(..., min_length=2, max_length=10)
    descripcion: str = Field(..., min_length=3, max_length=100)
    porcentaje: Decimal = Field(..., ge=0, le=100, description="Porcentaje de IVA (0-100)")
    es_aplicable: bool = Field(default=False, description="true = IVA aplicable, false = no aplicable")
    observaciones: Optional[str] = Field(None, max_length=500)

    # ---------------------------
    # Validadores
    # ---------------------------
    @field_validator('codigo')
    @classmethod
    def validar_codigo(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError('El código del IVA no puede estar vacío')
        
        codigo_limpio = v.strip().upper()
        if not re.match(r'^[A-Z0-9_]+$', codigo_limpio):
            raise ValueError('El código solo puede contener letras mayúsculas, números y guiones bajos')
        
        if len(codigo_limpio) < 2:
            raise ValueError('El código debe tener al menos 2 caracteres')
        
        return codigo_limpio

    @field_validator('descripcion')
    @classmethod
    def validar_descripcion(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError('La descripción del IVA no puede estar vacía')
        
        descripcion_limpia = v.strip()
        if len(descripcion_limpia) < 3:
            raise ValueError('La descripción debe tener al menos 3 caracteres')
        
        return descripcion_limpia

    @field_validator('observaciones')
    @classmethod
    def validar_observaciones(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not v.strip():
            return None
        return v.strip()

    @field_validator('porcentaje')
    @classmethod
    def validar_porcentaje(cls, v: Decimal) -> Decimal:
        if v < 0 or v > 100:
            raise ValueError('El porcentaje debe estar entre 0 y 100')
        
        # Verificar máximo 2 decimales
        if v.as_tuple().exponent < -2:
            raise ValueError('El porcentaje solo puede tener hasta 2 decimales')
        
        return v

    @model_validator(mode='after')
    def validar_logica_iva(self):
        """Validar la lógica de negocio del IVA"""
        # ⚠️ LÓGICA CORRECTA:
        # es_aplicable=true  → IVA SÍ se aplica (porcentaje > 0)
        # es_aplicable=false → IVA NO se aplica (porcentaje puede ser cualquiera)
        
        if self.es_aplicable and self.porcentaje <= 0:
            raise ValueError('Si es_aplicable es true (IVA aplicable), el porcentaje debe ser mayor a 0')
        
        # No validamos el caso contrario (es_aplicable=false) porque puede tener cualquier porcentaje
        
        return self


# ===========================
# Schemas de operaciones
# ===========================

class IVACreate(IVABase):
    """
    Schema para crear un nuevo IVA.
    NOTA: Siempre se crea DESACTIVADO y NO APLICABLE por defecto en el backend.
    """
    pass


class IVAUpdate(BaseModel):
    """Schema para actualizar IVA (todos los campos opcionales)"""
    codigo: Optional[str] = Field(None, min_length=2, max_length=10)
    descripcion: Optional[str] = Field(None, min_length=3, max_length=100)
    porcentaje: Optional[Decimal] = Field(None, ge=0, le=100)
    es_aplicable: Optional[bool] = None
    observaciones: Optional[str] = Field(None, max_length=500)
    activo: Optional[bool] = None

    @field_validator('codigo')
    @classmethod
    def validar_codigo(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        
        codigo_limpio = v.strip().upper()
        if not re.match(r'^[A-Z0-9_]+$', codigo_limpio):
            raise ValueError('El código solo puede contener letras mayúsculas, números y guiones bajos')
        
        if len(codigo_limpio) < 2:
            raise ValueError('El código debe tener al menos 2 caracteres')
        
        return codigo_limpio

    @field_validator('descripcion')
    @classmethod
    def validar_descripcion(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        
        descripcion_limpia = v.strip()
        if len(descripcion_limpia) < 3:
            raise ValueError('La descripción debe tener al menos 3 caracteres')
        
        return descripcion_limpia

    @field_validator('observaciones')
    @classmethod
    def validar_observaciones(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not v.strip():
            return None
        return v.strip()

    @field_validator('porcentaje')
    @classmethod
    def validar_porcentaje(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is None:
            return None
        
        if v < 0 or v > 100:
            raise ValueError('El porcentaje debe estar entre 0 y 100')
        
        if v.as_tuple().exponent < -2:
            raise ValueError('El porcentaje solo puede tener hasta 2 decimales')
        
        return v

    @model_validator(mode='after')
    def validar_logica_iva(self):
        """Validar la lógica de negocio del IVA en actualización"""
        # Solo validar si ambos campos están presentes
        if self.es_aplicable is not None and self.porcentaje is not None:
            if self.es_aplicable and self.porcentaje <= 0:
                raise ValueError('Si es_aplicable es true (IVA aplicable), el porcentaje debe ser mayor a 0')
        
        return self


# ===========================
# Schemas de respuesta
# ===========================

class IVAResponse(IVABase):
    """Schema para la respuesta completa de IVA"""
    id_iva: int
    activo: bool
    fecha_creacion: datetime
    fecha_actualizacion: datetime

    class Config:
        from_attributes = True


class IVAListResponse(BaseModel):
    """Schema simplificado para listar IVAs (usado en selectores)"""
    id_iva: int
    codigo: str
    descripcion: str
    porcentaje: Decimal
    es_aplicable: bool
    activo: bool

    class Config:
        from_attributes = True


# ===========================
# Schema de estadísticas
# ===========================

class IVAStats(BaseModel):
    """Schema para estadísticas de IVAs"""
    total_registros: int
    ivas_activos: int
    ivas_inactivos: int
    tiene_opcion_no_aplicar: bool
    opciones_disponibles: List[IVAListResponse]

    class Config:
        from_attributes = True


# ===========================
# Schema para respuesta de activación
# ===========================

class IVAActivacionResponse(BaseModel):
    """Schema para la respuesta de activación de IVA"""
    mensaje: str
    iva: IVAResponse
    requiere_confirmacion: bool = False
    iva_anterior: Optional[IVAListResponse] = None

    class Config:
        from_attributes = True


# ===========================
# Schema para conflicto de activación
# ===========================

class IVAConflictoDetail(BaseModel):
    """Schema para detalles de conflicto al activar IVA"""
    mensaje: str
    iva_actual: IVAListResponse
    requiere_confirmacion: bool = True
    instruccion: str = "Para activar este IVA y desactivar el actual, envíe forzar=true"
