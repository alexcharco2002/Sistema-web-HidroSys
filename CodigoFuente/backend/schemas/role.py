# schemas/role.py 
from pydantic import BaseModel, validator
from typing import Optional, List
from datetime import datetime

class RolBase(BaseModel):
    nombre_rol: str
    descripcion: Optional[str] = None
    activo: bool = True

class RolCreate(RolBase):
    pass

class RolUpdate(BaseModel):
    nombre_rol: Optional[str] = None
    descripcion: Optional[str] = None
    activo: Optional[bool] = None

class RolResponse(RolBase):
    id_rol: int
    fecha_creacion: datetime
    
    class Config:
        from_attributes = True

# ========================================
# SCHEMAS PARA ROL_ACCIONES
# ========================================
class RolAccionBase(BaseModel):
    id_rol: int
    nombre_accion: str
    tipo_accion: str
    activo: bool = True

    @validator('tipo_accion')
    def validate_tipo_accion(cls, v):
        tipos_validos = [
            'operaciones crud',
            'lectura',
            'crear',
            'eliminar',
            'actualizar',
            'reportes',
            'configuración'
        ]
        if v.lower() not in tipos_validos:
            raise ValueError(f'El tipo de acción debe ser uno de: {", ".join(tipos_validos)}')
        return v.lower()


class RolAccionCreate(BaseModel):
    nombre_accion: str
    tipo_accion: str
    activo: bool = True

    @validator('tipo_accion')
    def validate_tipo_accion(cls, v):
        tipos_validos = [
            'operaciones crud',
            'lectura',
            'crear',
            'eliminar',
            'actualizar',
            'reportes',
            'configuración'
        ]
        if v.lower() not in tipos_validos:
            raise ValueError(f'El tipo de acción debe ser uno de: {", ".join(tipos_validos)}')
        return v.lower()

class RolAccionUpdate(BaseModel):
    nombre_accion: Optional[str] = None
    tipo_accion: Optional[str] = None
    activo: Optional[bool] = None

class RolAccionResponse(BaseModel):
    id_rol_accion: int
    id_rol: int
    nombre_accion: str
    tipo_accion: str
    activo: bool
    fecha_asignacion: datetime
    
    class Config:
        from_attributes = True

# ========================================
# SCHEMAS COMBINADOS
# ========================================
class RolConAcciones(RolResponse):
    """Rol con sus acciones incluidas"""
    acciones: List[RolAccionResponse] = []
    
    class Config:
        from_attributes = True