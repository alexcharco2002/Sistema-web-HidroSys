# schemas/notification.py

from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime

from zoneinfo import ZoneInfo

# Timezone for Ecuador
ECUADOR_TZ = ZoneInfo("America/Guayaquil")
class NotificacionBase(BaseModel):
    """Campos base comunes de notificación"""
    id_usuario_sistema: Optional[int] = None
    titulo: str
    mensaje: str
    tipo: Optional[str] = "info"
    estado: Optional[str] = "no_leido"  # valores posibles: 'no_leido', 'leido', 'enviado'
    
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
        tipos_validos = ['info', 'alerta', 'error', 'sistema', 'exito', 'advertencia', 'mantenimiento']
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
    """Schema para crear una nueva notificación general"""
    fecha_creacion: Optional[datetime] = None
    estado: Optional[str] = "no_leido"
    prioridad: Optional[str] = "media" 
    # VALIDACIÓN
    @field_validator('prioridad')
    @classmethod
    def validate_prioridad(cls, v):
        prioridades_validas = ['baja', 'media', 'alta', 'critica']
        if v not in prioridades_validas:
            raise ValueError(f"Prioridad inválida. Debe ser: {', '.join(prioridades_validas)}")
        return v

class MantenimientoCreate(BaseModel):
    """Schema para crear notificación de mantenimiento programado"""
    # Campos básicos
    id_usuario_sistema: Optional[int] = None  # None = todos los usuarios
    titulo: str
    mensaje: str
    tipo: Optional[str] = "mantenimiento"
    prioridad: Optional[str] = "media"  # baja, media, alta, critica
    
    # Campos específicos de mantenimiento
    fecha_inicio_mantenimiento: datetime
    fecha_fin_mantenimiento: Optional[datetime] = None
    duracion_estimada: Optional[str] = None  # Ej: "2 horas", "30 minutos"
    modulos_afectados: Optional[str] = None  # Ej: "Facturación, Pagos, Lecturas"
    
    # Control de email
    enviar_email: bool = False
    
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
        if not v or len(v.strip()) < 10:
            raise ValueError('El mensaje debe tener al menos 10 caracteres')
        return v.strip()
    
    @field_validator('prioridad')
    @classmethod
    def validate_prioridad(cls, v):
        prioridades_validas = ['baja', 'media', 'alta', 'critica']
        if v not in prioridades_validas:
            raise ValueError(f"Prioridad inválida. Debe ser: {', '.join(prioridades_validas)}")
        return v
    
    @field_validator('fecha_inicio_mantenimiento')
    @classmethod
    def validate_fecha_inicio(cls, v):
        """Valida que el mantenimiento sea con al menos 24 horas de anticipación"""
        ahora = datetime.now(ECUADOR_TZ)
        diferencia = (v - ahora).total_seconds() / 3600  # Diferencia en horas
        
        if diferencia < 24:
            raise ValueError(
                f'El mantenimiento debe programarse con al menos 24 horas de anticipación. '
                f'Anticipación actual: {diferencia:.1f} horas'
            )
        
        return v
    
    @field_validator('fecha_fin_mantenimiento')
    @classmethod
    def validate_fecha_fin(cls, v, info):
        """Valida que la fecha fin sea posterior a la fecha inicio"""
        if v and 'fecha_inicio_mantenimiento' in info.data:
            if v <= info.data['fecha_inicio_mantenimiento']:
                raise ValueError('La fecha de fin debe ser posterior a la fecha de inicio')
        return v
    
    @field_validator('duracion_estimada')
    @classmethod
    def validate_duracion(cls, v):
        """Valida formato de duración"""
        if v and len(v.strip()) > 50:
            raise ValueError('La duración estimada no puede exceder 50 caracteres')
        return v.strip() if v else v


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


class NotificacionResponse(BaseModel):
    """Schema de respuesta para una notificación"""
    id_notificacion: int
    id_usuario_sistema: Optional[int]
    titulo: str
    mensaje: str
    tipo: str
    estado: str
    fecha_creacion: datetime
    fecha_leido: Optional[datetime]
    
    # Campos de mantenimiento
    es_mantenimiento: bool
    fecha_inicio_mantenimiento: Optional[datetime] = None
    fecha_fin_mantenimiento: Optional[datetime] = None
    duracion_estimada: Optional[str] = None
    modulos_afectados: Optional[str] = None
    
    # Control de email
    enviar_email: bool
    email_enviado: bool
    fecha_envio_email: Optional[datetime] = None
    
    # Prioridad
    prioridad: str
    
    class Config:
        from_attributes = True


class NotificacionesEstadisticas(BaseModel):
    """Estadísticas de notificaciones del usuario"""
    total: int
    no_leidas: int
    leidas: int
    mantenimientos_proximos: int
