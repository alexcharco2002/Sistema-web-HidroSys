# schemas/multa_afiliado.py

from pydantic import BaseModel, Field, field_validator
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
    """Respuesta de una multa de afiliado"""
    id_multa_afi: int
    fecha_multa: date
    fecha_pago: Optional[date] = None
    activo: bool
    estado: str
    
    # Campos relacionados opcionales (si haces JOIN)
    nombre_tipo_multa: Optional[str] = None
    nombre_usuario: Optional[str] = None
    
    class Config:
        from_attributes = True

class MultaAfiliadoPagoRequest(BaseModel):
    """Registrar pago de multa"""
    fecha_pago: Optional[date] = Field(None, description="Fecha del pago (por defecto hoy)")
    observaciones: Optional[str] = Field(None, max_length=500, description="Observaciones del pago")

class MultaAfiliadoStats(BaseModel):
    """Estadísticas de multas de afiliados"""
    total_multas: int
    pendientes: int
    pagadas: int
    anuladas: int
    exoneradas: int
    monto_total_pendiente: Decimal
    monto_total_pagado: Decimal

class MultasPorUsuario(BaseModel):
    """Multas agrupadas por usuario"""
    id_usuario_afi: int
    nombre_usuario: Optional[str] = None
    total_multas: int
    multas_pendientes: int
    monto_pendiente: Decimal
