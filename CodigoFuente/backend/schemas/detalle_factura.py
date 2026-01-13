# schemas/detalle_factura.py

from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional
from decimal import Decimal


class DetalleFacturaBase(BaseModel):
    """Schema base para Detalle de Factura"""
    id_factura: int = Field(..., gt=0)
    tipo_detalle: str = Field('servicio', min_length=1, max_length=20)
    id_servicio: Optional[int] = Field(None, gt=0)
    id_multa_afiliados: Optional[int] = Field(None, gt=0)
    subtotal_detalle: Decimal = Field(..., ge=0, decimal_places=2)
    descripcion: Optional[str] = Field(None, max_length=500)

    @field_validator('tipo_detalle')
    @classmethod
    def validar_tipo_detalle(cls, v: str) -> str:
        tipos_validos = ['servicio', 'multa', 'consumo', 'cambio medidor' ]
        v_lower = v.lower().strip()
        if v_lower not in tipos_validos:
            raise ValueError(f'Tipo inválido. Debe ser: {", ".join(tipos_validos)}')
        return v_lower

    @model_validator(mode='after')
    def validar_coherencia_tipo(self):
        """Valida que el tipo_detalle sea coherente con los IDs"""
        if self.tipo_detalle == 'servicio':
            if self.id_servicio is None:
                raise ValueError('Para tipo_detalle="servicio" debe proporcionar id_servicio')
            if self.id_multa_afiliados is not None:
                raise ValueError('Para tipo_detalle="servicio" no debe proporcionar id_multa_afiliados')
        elif self.tipo_detalle == 'multa':
            if self.id_multa_afiliados is None:
                raise ValueError('Para tipo_detalle="multa" debe proporcionar id_multa_afiliados')
            if self.id_servicio is not None:
                raise ValueError('Para tipo_detalle="multa" no debe proporcionar id_servicio')
        return self


class DetalleFacturaCreate(DetalleFacturaBase):
    """Schema para crear un nuevo detalle de factura"""
    pass


class DetalleFacturaUpdate(BaseModel):
    """Schema para actualizar un detalle de factura"""
    subtotal_detalle: Optional[Decimal] = Field(None, ge=0, decimal_places=2)
    descripcion: Optional[str] = Field(None, max_length=500)


class DetalleFacturaResponse(DetalleFacturaBase):
    """Schema para la respuesta de detalle de factura"""
    id_detalle: int

    class Config:
        from_attributes = True
