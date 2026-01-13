# schemas/configuracion.py
from pydantic import BaseModel, validator
from typing import Optional
from datetime import datetime

class ConfiguracionBase(BaseModel):
    clave: str
    valor: str
    tipo_dato: str = 'string'
    descripcion: Optional[str] = None
    categoria: str = 'general'
    modificable: bool = True
    activo: bool = True

    @validator('tipo_dato')
    def validate_tipo_dato(cls, v):
        tipos_validos = ['string', 'int', 'float', 'boolean']
        if v not in tipos_validos:
            raise ValueError(f'El tipo de dato debe ser uno de: {", ".join(tipos_validos)}')
        return v

class ConfiguracionCreate(ConfiguracionBase):
    pass

class ConfiguracionUpdate(BaseModel):
    valor: Optional[str] = None
    descripcion: Optional[str] = None
    modificable: Optional[bool] = None
    activo: Optional[bool] = None
    modificado_por: Optional[str] = None

class ConfiguracionResponse(ConfiguracionBase):
    id_configuracion: int
    fecha_creacion: datetime
    fecha_modificacion: datetime
    modificado_por: Optional[str] = None
    
    class Config:
        from_attributes = True

class ConfiguracionValorResponse(BaseModel):
    """Schema simplificado para obtener solo el valor"""
    clave: str
    valor: str
    valor_tipado: Optional[int | float | bool | str] = None
    
    class Config:
        from_attributes = True