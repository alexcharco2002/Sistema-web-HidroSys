# schemas/meter.py
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, List
from datetime import date
from decimal import Decimal


# ============================================================================
# SCHEMAS AUXILIARES
# ============================================================================
class SectorInfo(BaseModel):
    id_sector: int
    nombre_sector: Optional[str] = None

    model_config = {"from_attributes": True}


class UsuarioSistemaInfo(BaseModel):
    id_usuario_sistema: int
    nombres: str
    apellidos: str
    cedula: Optional[str] = None
    email: Optional[str] = None

    model_config = {"from_attributes": True}


class UsuarioAfiliadoInfo(BaseModel):
    id_usuario_afi: int
    cod_usuario_afi: str
    fecha_afiliacion: Optional[date] = None
    id_sector: Optional[int] = None
    nombre_afiliado: Optional[str] = None
    usuario_sistema: Optional[UsuarioSistemaInfo] = None

    model_config = {"from_attributes": True}

    # ✅ Pydantic v2: model_validator reemplaza @validator con always=True
    @model_validator(mode="after")
    def generar_nombre_afiliado(self):
        if not self.nombre_afiliado and self.usuario_sistema:
            self.nombre_afiliado = (
                f"{self.usuario_sistema.nombres} {self.usuario_sistema.apellidos}"
            )
        return self


# ============================================================================
# SCHEMAS PRINCIPALES - MEDIDOR
# ============================================================================
class MedidorBase(BaseModel):
    num_medidor: str = Field(..., max_length=50, description="Número del medidor")
    latitud: Optional[Decimal] = Field(None, description="Latitud del medidor")
    longitud: Optional[Decimal] = Field(None, description="Longitud del medidor")
    altitud: Optional[Decimal] = Field(None, description="Altitud del medidor")
    id_sector: Optional[int] = Field(None, description="ID del sector")
    id_usuario_afi: Optional[int] = Field(None, description="ID del usuario afiliado")
    activo: bool = Field(True, description="Estado del medidor")


class MedidorCreate(MedidorBase):
    pass


class MedidorUpdate(BaseModel):
    num_medidor: Optional[str] = Field(None, max_length=50)
    latitud: Optional[Decimal] = None
    longitud: Optional[Decimal] = None
    altitud: Optional[Decimal] = None
    id_sector: Optional[int] = None
    id_usuario_afi: Optional[int] = None
    id_usuario_sistema_nuevo: Optional[int] = None
    activo: Optional[bool] = None
    costo_cambio: Optional[Decimal] = Field(None, description="Costo del cambio de medidor")
    motivo_cambio: Optional[str] = Field(None, max_length=255)
    observaciones_cambio: Optional[str] = None


class MedidorResponse(MedidorBase):
    id_medidor: int

    model_config = {"from_attributes": True}


class MedidorCompleto(BaseModel):
    id_medidor: int
    num_medidor: str
    latitud: Optional[Decimal] = None
    longitud: Optional[Decimal] = None
    altitud: Optional[Decimal] = None
    activo: bool
    id_usuario_afi: Optional[int] = None
    id_sector: Optional[int] = None
    sector: Optional[SectorInfo] = None
  
    usuario_afiliado: Optional[UsuarioAfiliadoInfo] = None

    model_config = {"from_attributes": True}


# ============================================================================
# SCHEMAS AUXILIARES PARA ENDPOINTS
# ============================================================================
class MedidorStats(BaseModel):
    total: int
    activos: int
    inactivos: int
    asignados: int       # medidores con id_usuario_afi != None
    sin_asignar: int     # medidores con id_usuario_afi == None
    por_sector: dict

    model_config = {"from_attributes": True}


class AfiliadoDisponible(BaseModel):
    """Afiliados que pueden recibir un medidor adicional (o sin medidores activos)"""
    id_usuario_afi: Optional[int] = None
    id_usuario_sistema: Optional[int] = None
    cod_usuario_afi: Optional[str] = None
    nombre_afiliado: Optional[str] = None
    cedula: Optional[str] = None
    fecha_afiliacion: Optional[date] = None
    id_sector: Optional[int] = None
    nombre_sector: Optional[str] = None
    total_medidores: int = 0
    medidores_activos: int = 0
    es_afiliado: bool = True
    activo: bool
    model_config = {"from_attributes": True}


class MedidorListItem(BaseModel):
    id_medidor: int
    num_medidor: Optional[str] = None
    activo: Optional[bool] = None
    latitud: Optional[float] = None
    longitud: Optional[float] = None
    altitud: Optional[float] = None
    id_sector: Optional[int] = None
    nombre_sector: Optional[str] = None
    id_usuario_afi: Optional[int] = None
    cod_usuario_afi: Optional[str] = None
    nombre_afiliado: Optional[str] = None

    model_config = {"from_attributes": True}
