# ============================================================================
# schemas/affiliate.py
# ============================================================================
from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import date
import re
class AffiliateBase(BaseModel):
    """Schema base para afiliados"""
    id_sector: int = Field(..., description="ID del sector")
    activo: bool = Field(default=True, description="Estado del afiliado")

class UserInfoSimple(BaseModel):
    """Información básica del usuario"""
    id_usuario_sistema: int  # Era 'id'
    usuario: str
    nombres: str
    apellidos: str
    cedula: str
    email: str
    telefono: Optional[str]
    direccion: Optional[str]
    activo: bool


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
    cod_usuario_afi: str
    fecha_afiliacion: Optional[date]
    id_sector: int
    id_usuario_sistema: int
    activo: bool
    usuario_sistema: Optional[UserInfoSimple] 
    sector: Optional[SectorInfoSimple]
    medidores:  List[MeterInfoSimple] = [] 
    
    class Config:
        from_attributes = True
class AffiliateCreate(BaseModel):
    """Schema para crear afiliado"""
    id_usuario_sistema: int
    id_sector: int
    fecha_afiliacion: Optional[date] = None
    cod_usuario_afi: Optional[str] = None  # ✅ Hacerlo opcional
    activo: bool = True

    @validator('cod_usuario_afi')
    def validate_cod_usuario_afi(cls, v):
        """Valida el código de afiliado si el usuario lo proporciona"""
        if v is not None:
             # Convertir a string y limpiar espacios
            v = str(v).strip().upper()
                
            # Si está vacío después de limpiar, retornar None
            if not v:
                return None
                
            # Verificar longitud máxima de 6 caracteres
            if len(v) > 6:
                raise ValueError('El código de afiliado no puede tener más de 6 caracteres')
                
            # Verificar que solo contenga letras y números
            if not re.match(r'^[A-Z0-9]+$', v):
                raise ValueError('El código de afiliado solo puede contener letras y números')
                
            return v
        return None

class AffiliateUpdate(BaseModel):
    """Schema para actualizar afiliado"""
    id_sector: Optional[int] = None
    fecha_afiliacion: Optional[date] = None
    cod_usuario_afi: Optional[str] = None  # ✅ Agregar este campo
    activo: Optional[bool] = None

    @validator('cod_usuario_afi')
    def validate_cod_usuario_afi(cls, v):
        """Valida el código de afiliado si el usuario lo proporciona"""
        if v is not None:
            v = str(v).strip().upper()
            if not v:
                return None
            if len(v) > 6:
                raise ValueError('El código de afiliado no puede tener más de 6 caracteres')
            if not re.match(r'^[A-Z0-9]+$', v):
                raise ValueError('El código de afiliado solo puede contener letras y números')
            return v
        return None


class AffiliateResponse(BaseModel):
    """Schema de respuesta de afiliado"""
    id_usuario_afi: int
    cod_usuario_afi: str
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
    cod_usuario_afi: Optional[str] = None # ✅ Hacerlo opcional
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
    
    @validator('cod_usuario_afi')
    def validate_cod_usuario_afi(cls, v):
        """Valida el código de afiliado si el usuario lo proporciona"""
        if v is not None:
            # Convertir a string y limpiar espacios
            v = str(v).strip()
            
            # Verificar que no esté vacío después de limpiar
            if not v:
                return None
            
            # Verificar longitud máxima de 6 caracteres
            if len(v) > 6:
                raise ValueError('El código de afiliado no puede tener más de 6 caracteres')
            
            # Verificar que solo contenga letras y números (sin caracteres especiales)
            if not re.match(r'^[A-Za-z0-9]+$', v):
                raise ValueError('El código de afiliado solo puede contener letras y números')
            
            return v
        return None
    
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
                "cod_usuario_afi": None,
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
        if len(v) > 500:
            raise ValueError('Máximo 500 afiliados por carga')
        return v


class AffiliateBulkResult(BaseModel):
    """Resultado de un afiliado creado en masa"""
    fila: int
    cod_usuario_afi: str
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