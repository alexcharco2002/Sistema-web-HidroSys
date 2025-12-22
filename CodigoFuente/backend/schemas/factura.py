# schemas/factura.py

from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Literal, Optional, List
from datetime import date
from decimal import Decimal
import re
from schemas.detalle_factura import DetalleFacturaResponse
from schemas.pago import PagoResponse

class FacturaBase(BaseModel):
    """Schema base para Factura"""
    num_factura: str = Field(..., min_length=1, max_length=50)
    id_usuario_afi: int = Field(..., gt=0)
    id_lectura: Optional[int] = Field(None, gt=0)
    id_tarifa: int = Field(..., gt=0)
    consumo_m3: Optional[int] = Field(None, ge=0)
    exceso_m3: Optional[int] = Field(None, ge=0)
    valor_consumo: Optional[Decimal] = Field(None, ge=0, decimal_places=2)
    valor_exceso: Optional[Decimal] = Field(None, ge=0, decimal_places=2)
    descuento: Optional[Decimal] = Field(0, ge=0, decimal_places=2)
    subtotal: Optional[Decimal] = Field(None, ge=0, decimal_places=2)
    impuesto: Optional[Decimal] = Field(None, ge=0, decimal_places=2)
    total: Decimal = Field(..., ge=0, decimal_places=2)
    periodo: str = Field(..., min_length=7, max_length=7)
    estado_factura: str = Field('pendiente', min_length=1, max_length=20)

    detalles: List[DetalleFacturaResponse] = []

    @field_validator('num_factura')
    @classmethod
    def validar_num_factura(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError('El número de factura no puede estar vacío')
        num_limpio = v.strip().upper()
        if not re.match(r'^[A-Z0-9-]+$', num_limpio):
            raise ValueError('El número de factura solo puede contener letras, números y guiones')
        return num_limpio

    @field_validator('periodo')
    @classmethod
    def validar_periodo(cls, v: str) -> str:
        if not re.match(r'^\d{4}-\d{2}$', v):
            raise ValueError('El periodo debe tener formato YYYY-MM (ej: 2025-12)')
        anio, mes = v.split('-')
        if not (1 <= int(mes) <= 12):
            raise ValueError('El mes debe estar entre 01 y 12')
        if not (2000 <= int(anio) <= 2100):
            raise ValueError('El año debe estar entre 2000 y 2100')
        return v

    @field_validator('estado_factura')
    @classmethod
    def validar_estado(cls, v: str) -> str:
        estados_validos = ['pendiente', 'pagada', 'anulada', 'vencida']
        v_lower = v.lower().strip()
        if v_lower not in estados_validos:
            raise ValueError(f'Estado inválido. Debe ser uno de: {", ".join(estados_validos)}')
        return v_lower

    @model_validator(mode='after')
    def validar_coherencia_valores(self):
        """Valida que los cálculos sean coherentes"""
        if self.subtotal and self.impuesto and self.total:
            calculado = self.subtotal + self.impuesto
            if abs(calculado - self.total) > Decimal('0.01'):
                raise ValueError(
                    f'Total incoherente: subtotal ({self.subtotal}) + impuesto ({self.impuesto}) '
                    f'- descuento ({self.descuento or 0}) ≠ total ({self.total})'
                )
        return self


class FacturaCreate(FacturaBase):
    """Schema para crear una nueva factura"""
    fecha_emision: Optional[date] = Field(None, description="Fecha de emisión de la factura")


class FacturaUpdate(BaseModel):
    """Schema para actualizar una factura (campos opcionales)"""
    estado_factura: Optional[str] = Field(None, min_length=1, max_length=20)
    descuento: Optional[Decimal] = Field(None, ge=0, decimal_places=2)
    total: Optional[Decimal] = Field(None, ge=0, decimal_places=2)

    @field_validator('estado_factura')
    @classmethod
    def validar_estado(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        estados_validos = ['pendiente', 'pagada', 'anulada', 'vencida']
        v_lower = v.lower().strip()
        if v_lower not in estados_validos:
            raise ValueError(f'Estado inválido. Debe ser uno de: {", ".join(estados_validos)}')
        return v_lower


class FacturaResponse(FacturaBase):
    """Schema para la respuesta de factura"""
    id_factura: int
    fecha_emision: date

    class Config:
        from_attributes = True


class FacturaConDetalles(FacturaResponse):
    """Schema para factura con sus detalles"""
    detalles: List['DetalleFacturaResponse'] = []

    class Config:
        from_attributes = True


class FacturaStats(BaseModel):
    """Schema para estadísticas de facturas"""
    total_facturas: int
    facturas_pendientes: int
    facturas_pagadas: int
    facturas_anuladas: int
    facturas_vencidas: int
    monto_total_pendiente: Decimal
    monto_total_cobrado: Decimal


class AplicarDescuentoRequest(BaseModel):
    tipo_descuento: Literal['ninguno', 'porcentaje', 'valor'] = Field(
        ..., 
        description="Tipo de descuento a aplicar"
    )
    valor_descuento: float = Field(
        0.0, 
        ge=0, 
        description="Valor del descuento (porcentaje o monto fijo)"
    )
    marcar_como_pagada: bool = Field(
        False, 
        description="Marcar la factura como pagada después de aplicar descuento"
    )
    
# ========================================
# SCHEMAS CON INFORMACIÓN DE USUARIO
# ========================================

# Importar DESPUÉS de definir los schemas básicos
from schemas.affiliate import AffiliateWithUserInfo


class FacturaConUsuarioCompleto(FacturaResponse):
    """
    Schema para factura con datos completos del usuario afiliado.
    Incluye información del usuario_sistema, sector y medidores.
    """
    usuario_afiliado: AffiliateWithUserInfo
    pagos: List['PagoResponse'] = []
    
    class Config:
        from_attributes = True


class FacturaConTodo(FacturaConUsuarioCompleto):
    """Schema para factura con usuario y detalles"""
    detalles: List['DetalleFacturaResponse'] = []
    
    class Config:
        from_attributes = True



FacturaConDetalles.model_rebuild()
FacturaConTodo.model_rebuild()

class AplicarServiciosMasivoRequest(BaseModel):
    id_servicios: List[int]
    periodo: str  # Formato: "YYYY-MM"
    
    class Config:
        json_schema_extra = {
            "example": {
                "id_servicios": [1, 2, 3],
                "periodo": "2024-12"
            }
        }
