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

class UsuarioSistemaInfo(BaseModel):
    """Info básica del usuario del sistema"""
    id_usuario_sistema: int
    nombres: str
    apellidos: str
    cedula: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


class UsuarioAfiliadoInfo(BaseModel):
    """Info del usuario afiliado con datos del usuario del sistema"""
    id_usuario_afi: int
    cod_usuario_afi: int  # ⭐ Código del afiliado
    fecha_afiliacion: Optional[date] = None
    id_sector: Optional[int] = None
    activo: Optional[bool] = None
    
    # Relación con UsuarioSistema
    usuario: Optional[UsuarioSistemaInfo] = Field(None, alias="usuario_sistema")
    
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True
    )
    
    # ⭐ Campos calculados para facilitar acceso en frontend
    @computed_field
    @property
    def nombres(self) -> Optional[str]:
        """Retorna nombres del usuario sistema"""
        return self.usuario.nombres if self.usuario else None
    
    @computed_field
    @property
    def apellidos(self) -> Optional[str]:
        """Retorna apellidos del usuario sistema"""
        return self.usuario.apellidos if self.usuario else None
    
    @computed_field
    @property
    def cedula(self) -> Optional[str]:
        """Retorna cédula del usuario sistema"""
        return self.usuario.cedula if self.usuario else None
    
    @computed_field
    @property
    def nombre_completo(self) -> Optional[str]:
        """Retorna nombre completo del afiliado"""
        if self.usuario:
            return f"{self.usuario.nombres} {self.usuario.apellidos}".strip()
        return None


class TipoMultaInfo(BaseModel):
    """Info del tipo de multa"""
    id_tipo_multa: int
    nombre_multa: str
    monto: Decimal
    descripcion: Optional[str] = None
    es_vigente: Optional[bool] = None
    
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
    """Schema completo con relaciones anidadas"""
    id_multa_afi: int
    id_usuario_afi: int
    id_tipo_multa: int
    monto: Decimal
    fecha_multa: date
    fecha_pago: Optional[date] = None
    observaciones: Optional[str] = None
    activo: bool
    estado: str
    
    # Relaciones anidadas
    usuario_afi: Optional[UsuarioAfiliadoInfo] = Field(None, alias="usuario")
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
    """Estadísticas de multas de afiliados"""
    total_multas: int
    pendientes: int
    pagadas: int
    anuladas: int
    exoneradas: int
    monto_total_pendiente: Decimal
    monto_total_pagado: Decimal
