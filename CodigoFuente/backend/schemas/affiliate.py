# schemas/affiliate.py
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, List
from datetime import date
import re


class AffiliateBase(BaseModel):
    id_sector: int = Field(..., description="ID del sector")
    activo: bool = Field(default=True, description="Estado del afiliado")


class UserInfoSimple(BaseModel):
    id_usuario_sistema: int
    usuario: str
    nombres: str
    apellidos: str
    cedula: str
    email: str
    telefono: Optional[str] = None
    direccion: Optional[str] = None
    activo: bool

    model_config = {"from_attributes": True}


class SectorInfoSimple(BaseModel):
    id_sector: int
    nombre_sector: str
    descripcion: Optional[str] = None
    activo: bool

    model_config = {"from_attributes": True}


class MeterInfoSimple(BaseModel):
    id_medidor: int
    num_medidor: str
    latitud: Optional[float] = None
    longitud: Optional[float] = None
    altitud: Optional[float] = None
    activo: bool

    model_config = {"from_attributes": True}


class AffiliateWithUserInfo(BaseModel):
    """Schema completo con información del usuario, sector y medidores (1:N)"""
    id_usuario_afi: int
    cod_usuario_afi: str
    fecha_afiliacion: Optional[date] = None
    id_sector: int
    id_usuario_sistema: int
    activo: bool
    usuario_sistema: Optional[UserInfoSimple] = None
    sector: Optional[SectorInfoSimple] = None
    total_medidores: int = 0  # ✅ Contar medidores para mostrar en la lista
    medidores_activos: int = 0  # ✅ Contar medidores activos
    # ✅ Lista de medidores — soporta 1:N correctamente

    medidores: List[MeterInfoSimple] = []
    model_config = {"from_attributes": True}


# ✅ Helper reutilizable para validar cod_usuario_afi
def _validar_cod(v: Optional[str], uppercase: bool = True) -> Optional[str]:
    if v is None:
        return None
    v = v.strip()
    if uppercase:
        v = v.upper()
    if not v:
        return None
    if len(v) > 6:
        raise ValueError("El código de afiliado no puede tener más de 6 caracteres")
    pattern = r'^[A-Z0-9]+$' if uppercase else r'^[A-Za-z0-9]+$'
    if not re.match(pattern, v):
        raise ValueError("El código de afiliado solo puede contener letras y números")
    return v


class AffiliateCreate(BaseModel):
    id_usuario_sistema: int
    id_sector: int
    fecha_afiliacion: Optional[date] = None
    cod_usuario_afi: Optional[str] = None
    activo: bool = True

    # ✅ Pydantic v2: @field_validator reemplaza @validator
    @field_validator("cod_usuario_afi", mode="before")
    @classmethod
    def validate_cod_usuario_afi(cls, v):
        return _validar_cod(v, uppercase=True)


class AffiliateUpdate(BaseModel):
    id_sector: Optional[int] = None
    fecha_afiliacion: Optional[date] = None
    cod_usuario_afi: Optional[str] = None
    activo: Optional[bool] = None

    @field_validator("cod_usuario_afi", mode="before")
    @classmethod
    def validate_cod_usuario_afi(cls, v):
        return _validar_cod(v, uppercase=True)


class AffiliateResponse(BaseModel):
    id_usuario_afi: int
    cod_usuario_afi: str
    fecha_afiliacion: Optional[date] = None
    activo: bool
    id_sector: int
    id_usuario_sistema: int

    model_config = {"from_attributes": True}


# ============================================================================
# SCHEMAS PARA CARGA MASIVA DESDE EXCEL
# ============================================================================
class AffiliateBulkCreate(BaseModel):
    """Cada fila del Excel crea 1 afiliado + 1 medidor"""
    id_usuario_sistema: int
    id_sector: int
    cod_usuario_afi: Optional[str] = None
    num_medidor: str   # Para crear el medidor — no se guarda en t_usuario_afiliado
    latitud: Optional[float] = None
    longitud: Optional[float] = None
    altitud: Optional[float] = None

    @field_validator("id_usuario_sistema", "id_sector", mode="before")
    @classmethod
    def validate_ids(cls, v):
        if int(v) <= 0:
            raise ValueError("El ID debe ser mayor a 0")
        return v

    @field_validator("num_medidor", mode="before")
    @classmethod
    def validate_num_medidor(cls, v):
        v = str(v).strip()
        if len(v) < 3:
            raise ValueError("El número de medidor debe tener al menos 3 caracteres")
        if len(v) > 50:
            raise ValueError("El número de medidor es demasiado largo")
        return v

    @field_validator("cod_usuario_afi", mode="before")
    @classmethod
    def validate_cod_usuario_afi(cls, v):
        return _validar_cod(v, uppercase=False)

    @field_validator("latitud", mode="before")
    @classmethod
    def validate_latitud(cls, v):
        if v is not None and not (-90 <= float(v) <= 90):
            raise ValueError("Latitud debe estar entre -90 y 90")
        return v

    @field_validator("longitud", mode="before")
    @classmethod
    def validate_longitud(cls, v):
        if v is not None and not (-180 <= float(v) <= 180):
            raise ValueError("Longitud debe estar entre -180 y 180")
        return v

    model_config = {
        "json_schema_extra": {
            "example": {
                "id_usuario_sistema": 5,
                "id_sector": 1,
                "cod_usuario_afi": None,
                "num_medidor": "MED-001",
                "latitud": -1.234567,
                "longitud": -78.123456,
                "altitud": 2850.00
            }
        }
    }


class AffiliateBulkCreateRequest(BaseModel):
    affiliates: list[AffiliateBulkCreate]

    @field_validator("affiliates", mode="before")
    @classmethod
    def validate_affiliates_list(cls, v):
        if not v:
            raise ValueError("La lista de afiliados no puede estar vacía")
        if len(v) > 500:
            raise ValueError("Máximo 500 afiliados por carga")
        return v


class AffiliateBulkResult(BaseModel):
    fila: int
    cod_usuario_afi: str
    nombre_usuario: str
    cedula: str
    sector: str
    num_medidor: str
    id_usuario_afi: int
    id_medidor: int


class AffiliateBulkError(BaseModel):
    fila: int
    id_usuario_sistema: Optional[int] = None
    nombre_usuario: Optional[str] = None
    num_medidor: Optional[str] = None
    error: str


class AffiliateBulkResponse(BaseModel):
    exitosos: list[AffiliateBulkResult]
    fallidos: list[AffiliateBulkError]
    total_procesados: int
    total_exitosos: int
    total_fallidos: int
