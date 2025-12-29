# schemas/multa_afiliado.py

from pydantic import BaseModel, Field, field_validator, ConfigDict, computed_field
from typing import Optional
from datetime import date
from decimal import Decimal
from enum import Enum


class EstadoMulta(str, Enum):
    """Estados válidos de una multa"""
    PENDIENTE = "pendiente"
    PAGADA = "pagada"
    ANULADA = "anulada"
    EXONERADA = "exonerada"


# ============================================================================
# SCHEMAS AUXILIARES
# ============================================================================

class SectorInfo(BaseModel):
    """Info básica del sector"""
    id_sector: int
    nombre_sector: str
    
    model_config = ConfigDict(from_attributes=True)


class UsuarioAfiliadoInfo(BaseModel):
    """Info simplificada del afiliado para respuestas"""
    cod_usuario_afi: int
    nombre_completo: str
    cedula: str
    id_sector: Optional[int] = None
    nombre_sector: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


class TipoMultaInfo(BaseModel):
    """Info del tipo de multa - Solo campos esenciales"""
    nombre_multa: str
    
    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# SCHEMAS BASE
# ============================================================================

class MultaAfiliadoBase(BaseModel):
    """Schema base para Multa de Afiliado"""
    id_usuario_afi: int = Field(..., gt=0, description="ID del usuario afiliado")
    id_tipo_multa: int = Field(..., gt=0, description="ID del tipo de multa")
    monto: Decimal = Field(..., gt=0, decimal_places=2, description="Monto de la multa")
    observaciones: Optional[str] = Field(None, max_length=1000)
    
    @field_validator("observaciones")
    @classmethod
    def validar_observaciones(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not v.strip():
            return None
        return v.strip()


class MultaAfiliadoCreate(MultaAfiliadoBase):
    """Crear nueva multa para un afiliado"""
    fecha_multa: Optional[date] = Field(None, description="Fecha de la multa (por defecto hoy)")
    estado: Optional[EstadoMulta] = Field(EstadoMulta.PENDIENTE, description="Estado inicial")


class MultaAfiliadoUpdate(BaseModel):
    """Actualizar multa existente"""
    monto: Optional[Decimal] = Field(None, gt=0, decimal_places=2)
    fecha_pago: Optional[date] = None
    observaciones: Optional[str] = Field(None, max_length=1000)
    estado: Optional[EstadoMulta] = None
    activo: Optional[bool] = None
    
    @field_validator("fecha_pago")
    @classmethod
    def validar_fecha_pago(cls, v: Optional[date]) -> Optional[date]:
        if v and v > date.today():
            raise ValueError("La fecha de pago no puede ser futura")
        return v


class MultaAfiliadoResponse(MultaAfiliadoBase):
    """Schema básico de respuesta"""
    id_multa_afi: int
    fecha_multa: date
    fecha_pago: Optional[date] = None
    activo: bool
    estado: str
    
    model_config = ConfigDict(from_attributes=True)


class MultaAfiliadoCompleto(BaseModel):
    """Schema completo con relaciones anidadas - OPTIMIZADO"""
    id_multa_afi: int
    monto: Decimal
    fecha_multa: date
    fecha_pago: Optional[date] = None
    observaciones: Optional[str] = None
    estado: str
    
    # Información del afiliado (simplificada)
    afiliado: Optional[UsuarioAfiliadoInfo] = None
    
    # Información del tipo de multa (simplificada)
    tipo_multa: Optional[TipoMultaInfo] = None
    
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True
    )


class MultaAfiliadoPagoRequest(BaseModel):
    """Registrar pago de multa"""
    fecha_pago: Optional[date] = Field(None, description="Fecha del pago (por defecto hoy)")
    observaciones: Optional[str] = Field(None, max_length=500, description="Observaciones del pago")


class MultaAfiliadoStats(BaseModel):
    # Contadores por estado
    total_multas: int
    pendientes: int
    pagadas: int
    anuladas: int
    exoneradas: int
    
    # Contadores de facturación
    facturadas: int
    pendientes_facturacion: int
    
    # Montos
    monto_total: Decimal
    monto_pendiente: Decimal
    monto_pagado: Decimal
    monto_facturado: Decimal
    monto_pendiente_facturacion: Decimal
    
    class Config:
        from_attributes = True
