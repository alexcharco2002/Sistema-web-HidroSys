"""
TITLE: schemas/servicio_permanente.py
Schemas Pydantic para validación de datos de servicios permanentes
"""

from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal


# ============================================================================
# CONFIGURACIÓN DE SERVICIO PERMANENTE
# ============================================================================

class ConfiguracionSPBase(BaseModel):
    """Schema base con campos comunes"""
    nombre: str = Field(..., min_length=1, max_length=100, description="Nombre de la configuración")
    descripcion: Optional[str] = Field(None, description="Descripción detallada")
    aplicar_servicio: bool = Field(True, description="Si se aplica el servicio con esta configuración")
    activo: bool = Field(False, description="Si la configuración está activa")
    
    id_servicio: int = Field(..., gt=0, description="ID del servicio a aplicar")
    
    vigencia_desde: date = Field(..., description="Fecha desde que es vigente")
    vigencia_hasta: Optional[date] = Field(None, description="Fecha hasta que es vigente")
    es_vigente: bool = Field(True, description="Si está vigente actualmente")
    
    aplicar_en_periodo: str = Field('mensual', description="Frecuencia: 'mensual', 'bimestral', 'trimestral'")
    precio_override: Optional[Decimal] = Field(None, ge=0, decimal_places=2, description="Precio personalizado")
    observaciones: Optional[str] = Field(None, description="Observaciones generales")

    @field_validator('aplicar_en_periodo')
    @classmethod
    def validar_aplicar_en_periodo(cls, v):
        periodos_validos = ['mensual', 'bimestral', 'trimestral']
        if v not in periodos_validos:
            raise ValueError(f"aplicar_en_periodo debe ser uno de: {', '.join(periodos_validos)}")
        return v

    @model_validator(mode='after')
    def validar_fechas_vigencia(self):
        """Valida que vigencia_hasta sea posterior a vigencia_desde"""
        if self.vigencia_hasta and self.vigencia_hasta < self.vigencia_desde:
            raise ValueError("La fecha vigencia_hasta debe ser posterior a vigencia_desde")
        return self


class ConfiguracionSPCreate(ConfiguracionSPBase):
    """Schema para crear nueva configuración de servicio permanente"""
    pass


class ConfiguracionSPUpdate(BaseModel):
    """Schema para actualizar configuración (todos los campos opcionales)"""
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)
    descripcion: Optional[str] = None
    aplicar_servicio: Optional[bool] = None
    activo: Optional[bool] = None
    id_servicio: Optional[int] = Field(None, gt=0)
    vigencia_desde: Optional[date] = None
    vigencia_hasta: Optional[date] = None
    es_vigente: Optional[bool] = None
    aplicar_en_periodo: Optional[str] = None
    precio_override: Optional[Decimal] = Field(None, ge=0)
    observaciones: Optional[str] = None

    @field_validator('aplicar_en_periodo')
    @classmethod
    def validar_aplicar_en_periodo(cls, v):
        if v is not None:
            periodos_validos = ['mensual', 'bimestral', 'trimestral']
            if v not in periodos_validos:
                raise ValueError(f"aplicar_en_periodo debe ser uno de: {', '.join(periodos_validos)}")
        return v


class ConfiguracionSPResponse(ConfiguracionSPBase):
    """Schema para respuesta con todos los datos"""
    id_configuracion_sp: int
    fecha_creacion: datetime
    
    # Información del servicio relacionado
    servicio_info: Optional[dict] = None
    
    # Contadores
    total_asignaciones: Optional[int] = None
    asignaciones_activas: Optional[int] = None

    class Config:
        from_attributes = True


class ConfiguracionSPListResponse(BaseModel):
    """Schema para listados"""
    id_configuracion_sp: int
    nombre: str
    descripcion: Optional[str]
    aplicar_servicio: bool
    activo: bool
    es_vigente: bool
    id_servicio: int
    vigencia_desde: date
    vigencia_hasta: Optional[date]
    aplicar_en_periodo: str
    precio_override: Optional[Decimal]
    fecha_creacion: datetime
    servicio_info: Optional[dict] = None
    
    # Contadores
    total_asignaciones: Optional[int] = 0
    asignaciones_activas: Optional[int] = 0

    class Config:
        from_attributes = True


class ConfiguracionSPStats(BaseModel):
    """Estadísticas de configuraciones de servicios permanentes"""
    total_registros: int
    configuraciones_activas: int
    configuraciones_inactivas: int
    configuracion_activa_actual: Optional[ConfiguracionSPResponse]
    total_asignaciones_globales: int
    ultima_creacion: Optional[datetime]


# ============================================================================
# ASIGNACIÓN DE SERVICIO PERMANENTE
# ============================================================================

class AsignacionSPBase(BaseModel):
    """Schema base para asignaciones"""
    id_usuario_afi: int = Field(..., gt=0, description="ID del usuario afiliado")
    activo: bool = Field(True, description="Si la asignación está activa")
    fecha_inicio: date = Field(..., description="Fecha de inicio de la asignación")
    fecha_fin: Optional[date] = Field(None, description="Fecha de fin de la asignación")
    observaciones: Optional[str] = Field(None, description="Observaciones específicas")

    @model_validator(mode='after')
    def validar_fechas(self):
        """Valida que fecha_fin sea posterior a fecha_inicio"""
        if self.fecha_fin and self.fecha_fin < self.fecha_inicio:
            raise ValueError("La fecha_fin debe ser posterior a fecha_inicio")
        return self


class AsignacionSPCreate(AsignacionSPBase):
    """Schema para crear asignación"""
    pass


class AsignacionSPCreateBulk(BaseModel):
    """Schema para crear múltiples asignaciones a la vez"""
    ids_usuarios_afi: List[int] = Field(..., min_length=1, description="Lista de IDs de usuarios")
    activo: bool = Field(True, description="Estado inicial")
    fecha_inicio: date = Field(..., description="Fecha de inicio")
    fecha_fin: Optional[date] = None
    observaciones: Optional[str] = None


class AsignacionSPUpdate(BaseModel):
    """Schema para actualizar asignación"""
    activo: Optional[bool] = None
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    observaciones: Optional[str] = None


class AsignacionSPResponse(AsignacionSPBase):
    """Schema para respuesta"""
    id_asignacion_sp: int
    id_configuracion_sp: int
    fecha_asignacion: datetime
    asignado_por: Optional[int]
    
    # Información del usuario
    usuario_info: Optional[dict] = None

    class Config:
        from_attributes = True


class AsignacionSPListResponse(BaseModel):
    """Schema para listados de asignaciones"""
    id_asignacion_sp: int
    id_configuracion_sp: int
    id_usuario_afi: int
    activo: bool
    fecha_inicio: date
    fecha_fin: Optional[date]
    fecha_asignacion: datetime
    observaciones: Optional[str]

    class Config:
        from_attributes = True
