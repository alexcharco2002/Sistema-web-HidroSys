# schemas/historial_medidor.py
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from decimal import Decimal


class HistorialMedidorBase(BaseModel):
    id_medidor: int
    id_usuario_afi_anterior: Optional[int] = None
    id_usuario_afi_nuevo: Optional[int] = None
    motivo_cambio: Optional[str] = None
    costo_cambio: Optional[Decimal] = None
    observaciones: Optional[str] = None
    activo: bool = True


class HistorialMedidorCreate(HistorialMedidorBase):
    pass


class HistorialMedidorResponse(HistorialMedidorBase):
    id_historial: int
    fecha_cambio: datetime
    id_usuario_sistema: int

    class Config:
        from_attributes = True

