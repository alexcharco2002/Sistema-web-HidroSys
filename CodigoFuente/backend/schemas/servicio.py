# schemas/servicio.py

from pydantic import BaseModel, Field, field_validator
from typing import Optional
from decimal import Decimal
from datetime import datetime
import re

class ServicioBase(BaseModel):
    """Schema base para Servicio"""
    nombre: str = Field(..., min_length=3, max_length=100, description="Nombre del servicio")
    descripcion: Optional[str] = Field(None, max_length=1000, description="Descripción detallada del servicio")
    precio_base: Decimal = Field(..., ge=0, description="Precio base del servicio")
    activo: bool = Field(default=True, description="Estado del servicio")

    @field_validator('nombre')
    @classmethod
    def validar_nombre(cls, v: str) -> str:
        """Valida que el nombre solo tenga letras, números y espacios"""
        if not v or not v.strip():
            raise ValueError('El nombre del servicio no puede estar vacío')
        
        nombre_limpio = v.strip()
        
        # Regex: letras (incluye acentos), números y espacios
        if not re.match(r'^[A-Za-zÁÉÍÓÚáéíóúÑñ0-9 ]+$', nombre_limpio):
            raise ValueError('El nombre solo puede contener letras, números y espacios')
        
        if len(nombre_limpio) < 3:
            raise ValueError('El nombre debe tener al menos 3 caracteres')
        
        return nombre_limpio

    @field_validator('descripcion')
    @classmethod
    def validar_descripcion(cls, v: Optional[str]) -> Optional[str]:
        """Valida y limpia la descripción (opcional)"""
        if v is None or not v.strip():
            return None
        return v.strip()

    @field_validator('precio_base')
    @classmethod
    def validar_precio(cls, v: Decimal) -> Decimal:
        """Valida que el precio sea válido"""
        if v < 0:
            raise ValueError('El precio base no puede ser negativo')
        return v


class ServicioCreate(ServicioBase):
    """Schema para crear un nuevo servicio"""
    pass


class ServicioUpdate(BaseModel):
    """Schema para actualizar precio (crea nueva versión)"""
    precio_base: Decimal = Field(..., ge=0, description="Nuevo precio base del servicio")
    
    @field_validator('precio_base')
    @classmethod
    def validar_precio(cls, v: Decimal) -> Decimal:
        if v < 0:
            raise ValueError('El precio base no puede ser negativo')
        return v


class ServicioEditBase(BaseModel):
    """Schema para editar datos básicos SIN versionar (nombre, descripción)"""
    nombre: Optional[str] = Field(None, min_length=3, max_length=100)
    descripcion: Optional[str] = Field(None, max_length=1000)
    activo: Optional[bool] = None

    @field_validator('nombre')
    @classmethod
    def validar_nombre(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            nombre_limpio = v.strip()
            if len(nombre_limpio) < 3:
                raise ValueError('El nombre del servicio debe tener al menos 3 caracteres')
            
            # Validar caracteres permitidos
            if not re.match(r'^[A-Za-zÁÉÍÓÚáéíóúÑñ0-9 ]+$', nombre_limpio):
                raise ValueError('El nombre solo puede contener letras, números y espacios')
            return nombre_limpio
        return v

    @field_validator('descripcion')
    @classmethod
    def validar_descripcion(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if not v.strip():
                return None
            return v.strip()
        return v


class ServicioResponse(ServicioBase):
    """Schema para la respuesta de servicio"""
    id_servicio: int
    fecha_creacion: datetime
    vigencia_desde: datetime
    vigencia_hasta: Optional[datetime]
    es_vigente: bool

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id_servicio": 1,
                "nombre": "Instalación de medidor",
                "descripcion": "Servicio de instalación de medidor de agua",
                "precio_base": 25.00,
                "activo": True,
                "fecha_creacion": "2025-12-03T16:00:00",
                "vigencia_desde": "2025-12-03T16:00:00",
                "vigencia_hasta": None,
                "es_vigente": True
            }
        }


class ServicioStats(BaseModel):
    """Schema para estadísticas de servicios"""
    total: int
    activos: int
    inactivos: int
    vigentes: int

    class Config:
        json_schema_extra = {
            "example": {
                "total": 15,
                "activos": 8,
                "inactivos": 2,
                "vigentes": 8
            }
        }
