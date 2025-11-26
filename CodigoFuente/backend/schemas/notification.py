# schemas/notificacion.py
from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime

class NotificacionBase(BaseModel):
    """Campos base comunes de notificación"""
    id_usuario_sistema: Optional[int] = None
    titulo: str
    mensaje: str
    tipo: Optional[str] = "info"
    estado: Optional[str] = "no_leido"   # valores posibles: 'no_leido', 'leido'
    fecha_creacion: Optional[datetime] = None
    fecha_leido: Optional[datetime] = None

    # 🔸 Validaciones
    @field_validator('titulo')
    @classmethod
    def validate_titulo(cls, v):
        if not v or len(v.strip()) < 3:
            raise ValueError('El título debe tener al menos 3 caracteres')
        return v.strip()

    @field_validator('mensaje')
    @classmethod
    def validate_mensaje(cls, v):
        if not v or len(v.strip()) < 5:
            raise ValueError('El mensaje debe tener al menos 5 caracteres')
        return v.strip()

    @field_validator('tipo')
    @classmethod
    def validate_tipo(cls, v):
        tipos_validos = ['info', 'alerta', 'error', 'sistema', 'exito']
        if v not in tipos_validos:
            raise ValueError(f"Tipo inválido. Debe ser uno de: {', '.join(tipos_validos)}")
        return v

    @field_validator('estado')
    @classmethod
    def validate_estado(cls, v):
        estados_validos = ['no_leido', 'leido', 'enviado']
        if v not in estados_validos:
            raise ValueError(f"Estado inválido. Debe ser uno de: {', '.join(estados_validos)}")
        return v


class NotificacionCreate(NotificacionBase):
    """Schema para crear una nueva notificación"""
    fecha_creacion: Optional[datetime] = datetime.utcnow()
    estado: Optional[str] = "no_leido"


class NotificacionUpdate(BaseModel):
    """Schema para actualizar una notificación"""
    titulo: Optional[str] = None
    mensaje: Optional[str] = None
    tipo: Optional[str] = None
    estado: Optional[str] = None
    fecha_leido: Optional[datetime] = None

    @field_validator('titulo')
    @classmethod
    def validate_titulo(cls, v):
        if v is not None and len(v.strip()) < 3:
            raise ValueError('El título debe tener al menos 3 caracteres')
        return v.strip() if v else v

    @field_validator('mensaje')
    @classmethod
    def validate_mensaje(cls, v):
        if v is not None and len(v.strip()) < 5:
            raise ValueError('El mensaje debe tener al menos 5 caracteres')
        return v.strip() if v else v

    @field_validator('estado')
    @classmethod
    def validate_estado(cls, v):
        if v is not None:
            estados_validos = ['no_leido', 'leido', 'enviado']
            if v not in estados_validos:
                raise ValueError(f"Estado inválido. Debe ser uno de: {', '.join(estados_validos)}")
        return v


class NotificacionResponse(NotificacionBase):
    """Schema de respuesta para una notificación"""
    id_notificacion: int

    class Config:
        from_attributes = True
