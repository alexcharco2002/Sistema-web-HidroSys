# ============================================================================
# schemas/affiliate.py
# ============================================================================
from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import date

class AffiliateBase(BaseModel):
    """Schema base para afiliados"""
    id_sector: int = Field(..., description="ID del sector")
    activo: bool = Field(default=True, description="Estado del afiliado")

class AffiliateCreate(AffiliateBase):
    """Schema para crear un afiliado"""
    id_usuario_sistema: int = Field(..., description="ID del usuario del sistema a afiliar")

class AffiliateUpdate(BaseModel):
    """Schema para actualizar un afiliado"""
    id_sector: Optional[int] = Field(None, description="ID del sector")
    activo: Optional[bool] = Field(None, description="Estado del afiliado")

class AffiliateResponse(BaseModel):
    """Schema de respuesta para afiliados"""
    id_usuario_afi: int
    cod_usuario_afi: int
    fecha_afiliacion: Optional[date]
    id_sector: int
    id_usuario_sistema: int
    activo: bool
    
    
    class Config:
        from_attributes = True

class UserInfoSimple(BaseModel):
    """Información básica del usuario"""
    id: int
    usuario: str
    nombres: str
    apellidos: str
    cedula: str
    email: str
    telefono: Optional[str]
    direccion: Optional[str]
    activo: bool
    foto: Optional[str]

class SectorInfoSimple(BaseModel):
    """Información básica del sector"""
    id_sector: int
    nombre_sector: str
    descripcion: Optional[str]
    activo: bool
class MeterInfoSimple(BaseModel):
    """Información básica del medidor"""
    id_medidor: int
    num_medidor: str
    latitud: Optional[float]
    longitud: Optional[float]
    altitud: Optional[float]
    activo: bool
    
    class Config:
        from_attributes = True
class AffiliateWithUserInfo(BaseModel):
    """Schema completo con información del usuario y sector"""
    id_usuario_afi: int
    cod_usuario_afi: int
    fecha_afiliacion: Optional[date]
    id_sector: int
    id_usuario_sistema: int
    activo: bool
    usuario: Optional[UserInfoSimple]
    sector: Optional[SectorInfoSimple]
    medidores:  List[MeterInfoSimple] = [] 
    
    class Config:
        from_attributes = True
# ========================================
# SCHEMAS DE AFILIADO
# ========================================
class AffiliateCreate(BaseModel):
    """Schema para crear afiliado"""
    id_usuario_sistema: int
    id_sector: int
    fecha_afiliacion: Optional[date] = None
    cod_usuario_afi: int
    activo: bool = True


class AffiliateUpdate(BaseModel):
    """Schema para actualizar afiliado"""
    id_sector: Optional[int] = None
    fecha_afiliacion: Optional[date] = None
    activo: Optional[bool] = None


class AffiliateResponse(BaseModel):
    """Schema de respuesta de afiliado"""
    id_usuario_afi: int
    cod_usuario_afi: int
    fecha_afiliacion: Optional[date] = None
    activo: bool
    id_sector: int
    id_usuario_sistema: int
    
    class Config:
        from_attributes = True


# ========================================
# SCHEMAS PARA CARGA MASIVA DESDE EXCEL
# ========================================
class AffiliateBulkCreate(BaseModel):
    """Schema para crear afiliado desde Excel"""
    id_usuario_sistema: int
    id_sector: int
    num_medidor: str
    latitud: Optional[float] = None
    longitud: Optional[float] = None
    altitud: Optional[float] = None
    
    @validator('id_usuario_sistema', 'id_sector')
    def validate_ids(cls, v):
        if v <= 0:
            raise ValueError('El ID debe ser mayor a 0')
        return v
    
    @validator('num_medidor')
    def validate_num_medidor(cls, v):
        v = v.strip()
        if len(v) < 3:
            raise ValueError('El número de medidor debe tener al menos 3 caracteres')
        if len(v) > 50:
            raise ValueError('El número de medidor es demasiado largo')
        return v
    
    @validator('latitud')
    def validate_latitud(cls, v):
        if v is not None:
            if v < -90 or v > 90:
                raise ValueError('Latitud debe estar entre -90 y 90')
        return v
    
    @validator('longitud')
    def validate_longitud(cls, v):
        if v is not None:
            if v < -180 or v > 180:
                raise ValueError('Longitud debe estar entre -180 y 180')
        return v
    
    class Config:
        json_schema_extra = {
            "example": {
                "id_usuario_sistema": 5,
                "id_sector": 1,
                "num_medidor": "MED-001",
                "latitud": -1.234567,
                "longitud": -78.123456,
                "altitud": 2850.00
            }
        }


class AffiliateBulkCreateRequest(BaseModel):
    """Request para crear múltiples afiliados con medidores"""
    affiliates: list[AffiliateBulkCreate]
    
    @validator('affiliates')
    def validate_affiliates_list(cls, v):
        if not v or len(v) == 0:
            raise ValueError('La lista de afiliados no puede estar vacía')
        if len(v) > 100:
            raise ValueError('Máximo 100 afiliados por carga')
        return v


class AffiliateBulkResult(BaseModel):
    """Resultado de un afiliado creado en masa"""
    fila: int
    cod_usuario_afi: int
    nombre_usuario: str
    cedula: str
    sector: str
    num_medidor: str
    id_usuario_afi: int
    id_medidor: int


class AffiliateBulkError(BaseModel):
    """Error al crear un afiliado en masa"""
    fila: int
    id_usuario_sistema: Optional[int] = None
    nombre_usuario: Optional[str] = None
    num_medidor: Optional[str] = None
    error: str


class AffiliateBulkResponse(BaseModel):
    """Respuesta de creación masiva"""
    exitosos: list[AffiliateBulkResult]
    fallidos: list[AffiliateBulkError]
    total_procesados: int
    total_exitosos: int
    total_fallidos: int