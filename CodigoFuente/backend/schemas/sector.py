# schemas/sector.py
from pydantic import BaseModel, field_validator
from typing import Optional
import re

class SectorBase(BaseModel):
    nombre_sector: str
    descripcion: Optional[str] = None
    activo: bool = True
    
    @field_validator('nombre_sector')
    @classmethod
    def validate_nombre_sector(cls, v):
        if not v or len(v.strip()) < 3:
            raise ValueError('El nombre del sector debe tener al menos 3 caracteres')
        
        nombre = v.strip()

        # 🔥 Solo letras, números y espacios
        if not re.match(r'^[A-Za-zÁÉÍÓÚáéíóúÑñ0-9 ]+$', nombre):
            raise ValueError('El nombre del sector solo puede contener letras, números y espacios')

        return nombre


class SectorCreate(SectorBase):
    pass


class SectorUpdate(BaseModel):
    nombre_sector: Optional[str] = None
    descripcion: Optional[str] = None
    activo: Optional[bool] = None
    
    @field_validator('nombre_sector')
    @classmethod
    def validate_nombre_sector(cls, v):
        if v is None:
            return v
        
        nombre = v.strip()

        if len(nombre) < 3:
            raise ValueError('El nombre del sector debe tener al menos 3 caracteres')

        # 🔥 Solo letras, números y espacios
        if not re.match(r'^[A-Za-zÁÉÍÓÚáéíóúÑñ0-9 ]+$', nombre):
            raise ValueError('El nombre del sector solo puede contener letras, números y espacios')

        return nombre


class SectorResponse(SectorBase):
    id_sector: int

    class Config:
        from_attributes = True
