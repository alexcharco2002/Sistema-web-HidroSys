# schemas/lectura.py

from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional
from datetime import date

class LecturaBase(BaseModel):
    """Schema base para Lectura"""
    id_medidor: int = Field(..., description="ID del medidor")
    lectura_actual: int = Field(..., ge=0, description="Lectura actual en m³")
    lectura_anterior: int = Field(..., ge=0, description="Lectura anterior en m³")
    consumo_m3: int = Field(..., ge=0, description="Consumo en m³")
    fecha_lectura: date = Field(..., description="Fecha de la lectura")
    observacion: Optional[str] = Field(None, max_length=500, description="Observaciones")
    activo: bool = Field(default=True, description="Estado de la lectura")
    
    @field_validator('observacion')
    @classmethod
    def validar_observacion(cls, v: Optional[str]) -> Optional[str]:
        """Valida y limpia la observación"""
        if v is None or not v.strip():
            return None
        return v.strip()
    
    @model_validator(mode='after')
    def validar_lecturas(self):
        """Valida que la lectura actual sea mayor o igual a la anterior"""
        if self.lectura_actual < self.lectura_anterior:
            raise ValueError(
                f'La lectura actual ({self.lectura_actual}) no puede ser menor que la anterior ({self.lectura_anterior})'
            )
        
        # Validar que el consumo sea correcto
        consumo_calculado = self.lectura_actual - self.lectura_anterior
        if self.consumo_m3 != consumo_calculado:
            raise ValueError(
                f'El consumo ({self.consumo_m3}) no coincide con la diferencia de lecturas ({consumo_calculado})'
            )
        
        return self


class LecturaCreate(LecturaBase):
    """Schema para crear una nueva lectura"""
    pass


class LecturaUpdate(BaseModel):
    """Schema para actualizar una lectura existente"""
    id_medidor: Optional[int] = None
    lectura_actual: Optional[int] = Field(None, ge=0)
    lectura_anterior: Optional[int] = Field(None, ge=0)
    consumo_m3: Optional[int] = Field(None, ge=0)
    fecha_lectura: Optional[date] = None
    observacion: Optional[str] = Field(None, max_length=500)
    activo: Optional[bool] = None
    
    @field_validator('observacion')
    @classmethod
    def validar_observacion(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if not v.strip():
                return None
            return v.strip()
        return v


class MedidorInfo(BaseModel):
    """Información básica del medidor"""
    id_medidor: int
    num_medidor: str
    
    class Config:
        from_attributes = True


class LectorInfo(BaseModel):
    """Información básica del lector"""
    id_usuario_sistema: int
    nombres: str
    apellidos: str
    
    class Config:
        from_attributes = True


class LecturaResponse(LecturaBase):
    """Schema para la respuesta de lectura"""
    id_lectura: int
    id_lector: Optional[int] = None
    medidor: Optional[MedidorInfo] = None
    lector: Optional[LectorInfo] = None
    
    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id_lectura": 1,
                "id_medidor": 5,
                "lectura_actual": 120,
                "lectura_anterior": 100,
                "consumo_m3": 20,
                "fecha_lectura": "2025-01-15",
                "id_lector": 3,
                "observacion": "Lectura normal",
                "activo": True
            }
        }


class LecturaStats(BaseModel):
    """Schema para estadísticas de lecturas"""
    total: int
    activos: int
    inactivos: int
    consumo_total: int
    
    class Config:
        json_schema_extra = {
            "example": {
                "total": 150,
                "activos": 145,
                "inactivos": 5,
                "consumo_total": 3500
            }
        }


# ========================================
# SCHEMAS PARA CARGA MASIVA DESDE EXCEL
# ========================================

class LecturaBulkCreate(BaseModel):
    """Schema para crear lectura desde Excel"""
    id_medidor: int
    lectura_actual: int = Field(..., ge=0)
    observacion: Optional[str] = None
    
    @field_validator('id_medidor')
    @classmethod
    def validate_id_medidor(cls, v):
        if v <= 0:
            raise ValueError('El ID del medidor debe ser mayor a 0')
        return v
    
    @field_validator('lectura_actual')
    @classmethod
    def validate_lectura_actual(cls, v):
        if v < 0:
            raise ValueError('La lectura actual no puede ser negativa')
        return v
    
    @field_validator('observacion')
    @classmethod
    def validate_observacion(cls, v):
        if v is not None:
            v = v.strip()
            if len(v) > 500:
                raise ValueError('La observación es demasiado larga (máx 500 caracteres)')
            return v if v else None
        return None


class LecturaBulkCreateRequest(BaseModel):
    """Request para crear múltiples lecturas"""
    lecturas: list[LecturaBulkCreate]
    fecha_lectura: date = Field(..., description="Fecha común para todas las lecturas")
    
    @field_validator('lecturas')
    @classmethod
    def validate_lecturas_list(cls, v):
        if not v or len(v) == 0:
            raise ValueError('La lista de lecturas no puede estar vacía')
        if len(v) > 500:
            raise ValueError('Máximo 500 lecturas por carga')
        return v


class LecturaBulkResult(BaseModel):
    """Resultado de una lectura creada en masa"""
    fila: int
    id_medidor: int
    num_medidor: str
    lectura_anterior: int
    lectura_actual: int
    consumo_m3: int
    id_lectura: int


class LecturaBulkError(BaseModel):
    """Error al crear una lectura en masa"""
    fila: int
    id_medidor: Optional[int] = None
    num_medidor: Optional[str] = None
    error: str


class LecturaBulkResponse(BaseModel):
    """Respuesta de creación masiva"""
    exitosos: list[LecturaBulkResult]
    fallidos: list[LecturaBulkError]
    total_procesados: int
    total_exitosos: int
    total_fallidos: int
