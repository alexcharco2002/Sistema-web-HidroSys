# schemas/lectura.py

from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional
from datetime import date
from typing import List  # Para listas en los schemas


class LecturaBase(BaseModel):
    """Schema base para Lectura"""
    id_medidor: int = Field(..., description="ID del medidor")
    lectura_actual: int = Field(..., ge=0, description="Lectura actual en m³")
    lectura_anterior: int = Field(..., ge=0, description="Lectura anterior en m³")
    consumo_m3: int = Field(..., ge=0, description="Consumo en m³")
    fecha_lectura: date = Field(..., description="Fecha de la lectura")
    observacion: Optional[str] = Field(None, max_length=500, description="Observaciones")
    activo: bool = Field(default=True, description="Estado de la lectura")
    es_estimada: bool = Field(default=False, description="Si es una lectura estimada/sugerida")  # ✅ NUEVO
    
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
    es_estimada: Optional[bool] = None  # ✅ NUEVO
    
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
                "activo": True,
                "es_estimada": False  # ✅ AGREGADO AL EJEMPLO
            }
        }


class LecturaStats(BaseModel):
    """Schema para estadísticas de lecturas"""
    total: int
    activos: int
    inactivos: int
    consumo_total: int
    # ✅ NUEVAS ESTADÍSTICAS PARA ESTIMADAS
    total_estimadas: int = Field(default=0, description="Total de lecturas estimadas")
    total_reales: int = Field(default=0, description="Total de lecturas reales")
    
    class Config:
        json_schema_extra = {
            "example": {
                "total": 150,
                "activos": 145,
                "inactivos": 5,
                "consumo_total": 3500,
                "total_estimadas": 15,  # ✅ NUEVO
                "total_reales": 135  # ✅ NUEVO
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
    es_estimada: bool = Field(default=False, description="Si fue estimada o real")  # ✅ NUEVO


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


# ========================================
# SCHEMAS PARA PERIODOS DE LECTURA
# ========================================

class PeriodoDisponible(BaseModel):
    """Schema para periodo de lectura disponible"""
    mes: int = Field(..., ge=1, le=12, description="Número de mes (1-12)")
    anio: int = Field(..., ge=2020, description="Año")
    nombre_mes: str = Field(..., description="Nombre del mes en español")
    tiene_lecturas: bool = Field(default=False, description="Si ya tiene lecturas registradas")
    total_lecturas: int = Field(default=0, description="Total de lecturas en ese periodo")
    total_medidores: int = Field(default=0, description="Total de medidores activos")
    porcentaje_completado: float = Field(default=0.0, description="Porcentaje de medidores con lectura")
    sugerido: bool = Field(default=False, description="Si es el periodo sugerido")
    
    class Config:
        json_schema_extra = {
            "example": {
                "mes": 12,
                "anio": 2025,
                "nombre_mes": "Diciembre",
                "tiene_lecturas": True,
                "total_lecturas": 45,
                "total_medidores": 50,
                "porcentaje_completado": 90.0,
                "sugerido": False
            }
        }


class PeriodosResponse(BaseModel):
    """Respuesta con periodos disponibles"""
    periodo_actual: PeriodoDisponible
    periodos_disponibles: List[PeriodoDisponible]
    total_medidores_activos: int


class LecturaBulkCreateWithPeriod(BaseModel):
    """Request para crear múltiples lecturas con periodo específico"""
    lecturas: List[LecturaBulkCreate]
    mes: int = Field(..., ge=1, le=12, description="Mes de las lecturas")
    anio: int = Field(..., ge=2020, description="Año de las lecturas")
    
    @field_validator('lecturas')
    @classmethod
    def validate_lecturas_list(cls, v):
        if not v or len(v) == 0:
            raise ValueError('La lista de lecturas no puede estar vacía')
        if len(v) > 500:
            raise ValueError('Máximo 500 lecturas por carga')
        return v


# ========================================
# SCHEMAS PARA LECTURAS ESTIMADAS
# ========================================

class LecturaEstimadaGenerar(BaseModel):
    """Request para generar lecturas estimadas"""
    mes: int = Field(..., ge=1, le=12, description="Mes para generar lecturas")
    anio: int = Field(..., ge=2020, description="Año para generar lecturas")
    meses_promedio: int = Field(default=3, ge=1, le=12, description="Meses para calcular promedio")
    consumo_default: int = Field(default=10, ge=0, description="Consumo por defecto para medidores sin historial")
    
    class Config:
        json_schema_extra = {
            "example": {
                "mes": 12,
                "anio": 2025,
                "meses_promedio": 3,
                "consumo_default": 10
            }
        }


class LecturaEstimadaDetalle(BaseModel):
    """Detalle de una lectura estimada generada"""
    id_lectura: int
    medidor: str
    codigo_afiliado: str
    nombre_afiliado: str
    lectura_anterior: int
    lectura_estimada: int
    consumo_estimado: int
    metodo_calculo: str
    tiene_historial: bool


class LecturaEstimadaFallida(BaseModel):
    """Detalle de una lectura estimada que falló"""
    medidor: str
    razon: str


class LecturaEstimadaResponse(BaseModel):
    """Respuesta de generación de lecturas estimadas"""
    success: bool
    message: str
    lecturas_generadas: int
    lecturas_fallidas: int
    con_historial: int
    sin_historial: int
    periodo: str
    consumo_promedio_sistema: int
    detalles: List[LecturaEstimadaDetalle]
    fallidas: List[LecturaEstimadaFallida]


class LecturaEstimadaConfirmar(BaseModel):
    """Request para confirmar una lectura estimada"""
    lectura_real: int = Field(..., ge=0, description="Lectura real tomada")
    observacion: Optional[str] = Field(None, max_length=500, description="Observación adicional")
    
    @field_validator('observacion')
    @classmethod
    def validar_observacion(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if not v.strip():
                return None
            return v.strip()
        return v
