"""
TITLE: schemas/mora.py
Schemas Pydantic para validación de datos de mora
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import date, datetime
from decimal import Decimal


class ConfiguracionMoraBase(BaseModel):
    """Schema base con campos comunes"""
    nombre: str = Field(..., min_length=1, max_length=100, description="Nombre de la configuración")
    descripcion: Optional[str] = Field(None, description="Descripción detallada")
    aplicar_mora: bool = Field(True, description="Si se aplica mora con esta configuración")
    activo: bool = Field(True, description="Si la configuración está activa")
    dias_gracia: int = Field(0, ge=0, description="Días de gracia después del vencimiento")
    tipo_calculo: str = Field(..., description="Tipo: 'porcentaje', 'fijo', 'interes_diario'")
    porcentaje_mora: Optional[Decimal] = Field(None, ge=0, le=100, decimal_places=2, description="Porcentaje de mora")
    valor_fijo: Optional[Decimal] = Field(None, ge=0, decimal_places=2, description="Valor fijo de mora")
    interes_diario: Optional[Decimal] = Field(None, ge=0, decimal_places=4, description="Interés diario")
    vigencia_desde: date = Field(..., description="Fecha desde que es vigente")
    vigencia_hasta: Optional[date] = Field(None, description="Fecha hasta que es vigente")
    es_vigente: bool = Field(True, description="Si está vigente actualmente")
    mora_maxima: Optional[Decimal] = Field(None, ge=0, decimal_places=2, description="Límite máximo de mora")
    aplicar_sobre: str = Field('total', description="Sobre qué aplicar: 'total', 'consumo', 'base'")

    @field_validator('tipo_calculo')
    @classmethod
    def validar_tipo_calculo(cls, v):
        tipos_validos = ['porcentaje', 'fijo', 'interes_diario']
        if v not in tipos_validos:
            raise ValueError(f"tipo_calculo debe ser uno de: {', '.join(tipos_validos)}")
        return v

    @field_validator('aplicar_sobre')
    @classmethod
    def validar_aplicar_sobre(cls, v):
        opciones_validas = ['total', 'consumo', 'base']
        if v not in opciones_validas:
            raise ValueError(f"aplicar_sobre debe ser uno de: {', '.join(opciones_validas)}")
        return v


class ConfiguracionMoraCreate(ConfiguracionMoraBase):
    """Schema para crear nueva configuración de mora"""
    
    @field_validator('porcentaje_mora', 'valor_fijo', 'interes_diario')
    @classmethod
    def validar_valores_segun_tipo(cls, v, info):
        # Esta validación adicional se hará en el router
        return v


class ConfiguracionMoraUpdate(BaseModel):
    """Schema para actualizar configuración (todos los campos opcionales)"""
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)
    descripcion: Optional[str] = None
    aplicar_mora: Optional[bool] = None
    activo: Optional[bool] = None
    dias_gracia: Optional[int] = Field(None, ge=0)
    tipo_calculo: Optional[str] = None
    porcentaje_mora: Optional[Decimal] = Field(None, ge=0, le=100)
    valor_fijo: Optional[Decimal] = Field(None, ge=0)
    interes_diario: Optional[Decimal] = Field(None, ge=0)
    vigencia_desde: Optional[date] = None
    vigencia_hasta: Optional[date] = None
    es_vigente: Optional[bool] = None
    mora_maxima: Optional[Decimal] = Field(None, ge=0)
    aplicar_sobre: Optional[str] = None

    @field_validator('tipo_calculo')
    @classmethod
    def validar_tipo_calculo(cls, v):
        if v is not None:
            tipos_validos = ['porcentaje', 'fijo', 'interes_diario']
            if v not in tipos_validos:
                raise ValueError(f"tipo_calculo debe ser uno de: {', '.join(tipos_validos)}")
        return v

    @field_validator('aplicar_sobre')
    @classmethod
    def validar_aplicar_sobre(cls, v):
        if v is not None:
            opciones_validas = ['total', 'consumo', 'base']
            if v not in opciones_validas:
                raise ValueError(f"aplicar_sobre debe ser uno de: {', '.join(opciones_validas)}")
        return v


class ConfiguracionMoraResponse(ConfiguracionMoraBase):
    """Schema para respuesta con todos los datos"""
    id_configuracion_mora: int
    fecha_creacion: datetime

    class Config:
        from_attributes = True


class ConfiguracionMoraListResponse(BaseModel):
    """Schema para listados con todos los campos necesarios"""
    id_configuracion_mora: int
    nombre: str
    descripcion: Optional[str]
    tipo_calculo: str
    aplicar_mora: bool
    activo: bool
    es_vigente: bool
    dias_gracia: int
    
    # Valores según tipo de cálculo
    porcentaje_mora: Optional[Decimal]
    valor_fijo: Optional[Decimal]
    interes_diario: Optional[Decimal]
    
    # Configuración adicional
    vigencia_desde: date
    vigencia_hasta: Optional[date]
    mora_maxima: Optional[Decimal]
    aplicar_sobre: str
    fecha_creacion: datetime

    class Config:
        from_attributes = True



class ConfiguracionMoraStats(BaseModel):
    """Estadísticas de configuraciones de mora"""
    total_registros: int
    configuraciones_activas: int
    configuraciones_inactivas: int
    configuracion_vigente_actual: Optional[ConfiguracionMoraResponse]
    ultima_creacion: Optional[datetime]


# Schemas para MoraFactura (solo para respuestas, no se crea manualmente)
class MoraFacturaResponse(BaseModel):
    """Schema de respuesta para mora aplicada a factura"""
    id_mora: int
    id_factura: int
    id_configuracion_mora: int
    monto_base: Decimal
    dias_mora: int
    tipo_calculo: str
    tasa_aplicada: Optional[Decimal]
    monto_mora: Decimal
    fecha_calculo: datetime
    aplicada: bool
    fecha_aplicacion: Optional[datetime]
    observaciones: Optional[str]

    class Config:
        from_attributes = True
