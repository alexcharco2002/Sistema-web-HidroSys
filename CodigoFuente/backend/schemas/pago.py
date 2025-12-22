# schemas/pago.py

from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, List
from datetime import datetime
from decimal import Decimal

from schemas.meter import UsuarioSistemaInfo

class PagoBase(BaseModel):
    """Schema base para Pago"""
    id_factura: Optional[int] = Field(None, description="ID de la factura asociada")
    monto_pago: Decimal = Field(..., gt=0, decimal_places=2, description="Monto del pago")
    metodo_pago: str = Field(..., max_length=50, description="Método de pago (EFECTIVO, TARJETA, TRANSFERENCIA, etc.)")
    id_usuario_afi: Optional[int] = Field(None, description="ID del usuario afiliado que realiza el pago")
    observaciones: Optional[str] = Field(None, max_length=1000, description="Observaciones del pago")
    
    nombre_archivo: Optional[str] = Field(None, max_length=255, description="Nombre del archivo PDF")
    tipo_mime: Optional[str] = Field('application/pdf', max_length=50, description="Tipo MIME del archivo")
    

    @field_validator('metodo_pago')
    @classmethod
    def validar_metodo_pago(cls, v: str) -> str:
        """Valida que el método de pago sea válido"""
        metodos_validos = ['EFECTIVO', 'TARJETA', 'z', 'CHEQUE', 'DEPOSITO', 'OTRO']
        v_upper = v.strip().upper()
        if v_upper not in metodos_validos:
            raise ValueError(f'Método de pago inválido. Debe ser uno de: {", ".join(metodos_validos)}')
        return v_upper
    
    @field_validator('observaciones')
    @classmethod
    def validar_observaciones(cls, v: Optional[str]) -> Optional[str]:
        """Valida y limpia las observaciones"""
        if v is None or not v.strip():
            return None
        return v.strip()
    
    @field_validator('monto_pago')
    @classmethod
    def validar_monto(cls, v: Decimal) -> Decimal:
        """Valida que el monto sea positivo"""
        if v <= 0:
            raise ValueError('El monto del pago debe ser mayor a 0')
        return round(v, 2)


class PagoCreate(PagoBase):
    """Schema para crear un nuevo pago"""
    id_cajero: int = Field(..., description="ID del cajero que registra el pago")


class PagoUpdate(BaseModel):
    """Schema para actualizar un pago existente"""
    id_factura: Optional[int] = None
    monto_pago: Optional[Decimal] = Field(None, gt=0, decimal_places=2)
    metodo_pago: Optional[str] = Field(None, max_length=50)
    id_usuario_afi: Optional[int] = None
    id_cajero: Optional[int] = None
    observaciones: Optional[str] = Field(None, max_length=1000)
    estado_pago: Optional[str] = Field(None, max_length=20)
    
    @field_validator('observaciones')
    @classmethod
    def validar_observaciones(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if not v.strip():
                return None
            return v.strip()
        return v
    
    @field_validator('monto_pago')
    @classmethod
    def validar_monto(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is not None:
            if v <= 0:
                raise ValueError('El monto del pago debe ser mayor a 0')
            return round(v, 2)
        return v


class PagoAnular(BaseModel):
    """Schema para anular un pago"""
    motivo_anulacion: str = Field(..., min_length=10, max_length=200, description="Motivo de la anulación")
    
    @field_validator('motivo_anulacion')
    @classmethod
    def validar_motivo(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 10:
            raise ValueError('El motivo de anulación debe tener al menos 10 caracteres')
        return v


class FacturaInfo(BaseModel):
    """Información básica de la factura"""
    id_factura: int
    num_factura: str
    
    class Config:
        from_attributes = True


class UsuarioAfiliadoInfo(BaseModel):
    """Información básica del usuario afiliado"""
    id_usuario_afi: int
    cod_usuario_afi: int
    usuario_sistema: Optional[UsuarioSistemaInfo] = None
    
    class Config:
        from_attributes = True


class CajeroInfo(BaseModel):
    """Información básica del cajero"""
    id_usuario_sistema: int
    nombres: str
    apellidos: str
    
    class Config:
        from_attributes = True


class PagoResponse(BaseModel):
    """Schema para la respuesta de pago"""
    id_pago: int
    id_factura: Optional[int] = None
    monto_pago: Decimal
    fecha_pago: datetime
    metodo_pago: str
    id_usuario_afi: Optional[int] = None
    id_cajero: Optional[int] = None
    observaciones: Optional[str] = None
    motivo_anulacion: Optional[str] = None
    fecha_anulacion: Optional[datetime] = None
    activo: bool
    estado_pago: str
    
    nombre_archivo: Optional[str] = None
    tipo_mime: Optional[str] = None
    tiene_comprobante: bool = False  

    # Relaciones
    factura: Optional[FacturaInfo] = None
    usuario_afiliado: Optional[UsuarioAfiliadoInfo] = None
    cajero: Optional[CajeroInfo] = None
    
    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id_pago": 1,
                "id_factura": 15,
                "monto_pago": 25.50,
                "fecha_pago": "2025-12-19T14:30:00",
                "metodo_pago": "EFECTIVO",
                "id_usuario_afi": 10,
                "id_cajero": 3,
                "observaciones": "Pago completo de la factura",
                "motivo_anulacion": None,
                "fecha_anulacion": None,
                "activo": True,
                "estado_pago": "REGISTRADO"
            }
        }

class PagoStats(BaseModel):
    """Schema para estadísticas de pagos"""
    total_pagos: int
    pagos_activos: int  # ✅ AGREGAR
    pagos_registrados: int
    pagos_anulados: int
    monto_total: float  # ✅ CAMBIAR de monto_total_pagado a monto_total
    monto_efectivo: float
    monto_transferencia: float
    monto_tarjeta: float
    monto_otros: float
    
    class Config:
        json_schema_extra = {
            "example": {
                "total_pagos": 150,
                "pagos_activos": 145,  # ✅ AGREGAR
                "pagos_registrados": 145,
                "pagos_anulados": 5,
                "monto_total": 3875.50,  # ✅ CAMBIAR
                "monto_efectivo": 2100.00,
                "monto_transferencia": 1200.50,
                "monto_tarjeta": 500.00,
                "monto_otros": 75.00
            }
        }
class FacturasPeriodoStats(BaseModel):
    """
    Schema para estadísticas de facturas de un periodo específico.
    Se usa en la vista de pagos para mostrar resumen del periodo.
    """
    # Estadísticas de facturas
    total_facturas: int = Field(..., description="Total de facturas en el periodo")
    facturas_pagadas: int = Field(..., description="Facturas con estado 'pagada'")
    facturas_anuladas: int = Field(..., description="Facturas con estado 'anulada'")
    facturas_pendientes: int = Field(..., description="Facturas con estado 'pendiente'")
    facturas_vencidas: int = Field(..., description="Facturas con estado 'vencida'")
    
    # Estadísticas financieras (calculadas desde pagos)
    total_recaudado: float = Field(..., description="Total recaudado (solo pagos REGISTRADOS)")
    total_efectivo: float = Field(..., description="Total recaudado en efectivo")
    total_transferencia: float = Field(..., description="Total recaudado en transferencias")
    total_tarjeta: float = Field(..., description="Total recaudado en tarjetas")
    
    # Estadísticas de pagos
    total_pagos_registrados: int = Field(..., description="Cantidad de pagos registrados")
    total_pagos_anulados: int = Field(..., description="Cantidad de pagos anulados")
    
    class Config:
        json_schema_extra = {
            "example": {
                "total_facturas": 150,
                "facturas_pagadas": 120,
                "facturas_anuladas": 5,
                "facturas_pendientes": 20,
                "facturas_vencidas": 5,
                "total_recaudado": 45000.00,
                "total_efectivo": 20000.00,
                "total_transferencia": 15000.00,
                "total_tarjeta": 10000.00,
                "total_pagos_registrados": 180,
                "total_pagos_anulados": 8
            }
        }

class PagoPorPeriodo(BaseModel):
    """Schema para pagos agrupados por periodo"""
    periodo: str = Field(..., description="Periodo en formato YYYY-MM")
    cantidad_pagos: int
    monto_total: Decimal
    
    class Config:
        json_schema_extra = {
            "example": {
                "periodo": "2025-12",
                "cantidad_pagos": 45,
                "monto_total": 1250.75
            }
        }


class PagoPorMetodo(BaseModel):
    """Schema para pagos agrupados por método"""
    metodo_pago: str
    cantidad: int
    monto_total: Decimal
    porcentaje: float = Field(..., ge=0, le=100, description="Porcentaje del total")
    
    class Config:
        json_schema_extra = {
            "example": {
                "metodo_pago": "EFECTIVO",
                "cantidad": 80,
                "monto_total": 2100.00,
                "porcentaje": 54.19
            }
        }


class PagoEstadisticasDetalladas(BaseModel):
    """Estadísticas detalladas de pagos"""
    resumen_general: PagoStats
    por_periodo: List[PagoPorPeriodo]
    por_metodo: List[PagoPorMetodo]
    promedio_pago: Decimal
    pago_mayor: Decimal
    pago_menor: Decimal


# ========================================
# SCHEMAS PARA REPORTES DE PAGOS
# ========================================

class PagoReporteItem(BaseModel):
    """Item para reporte de pagos"""
    id_pago: int
    fecha_pago: datetime
    numero_factura: Optional[str] = None
    codigo_afiliado: str
    nombre_afiliado: str
    monto_pago: Decimal
    metodo_pago: str
    cajero: str
    estado_pago: str


class PagoReporteResponse(BaseModel):
    """Respuesta de reporte de pagos"""
    fecha_inicio: datetime
    fecha_fin: datetime
    total_registros: int
    monto_total: Decimal
    pagos: List[PagoReporteItem]


# ========================================
# SCHEMAS PARA PAGOS MÚLTIPLES/BATCH
# ========================================

class PagoBatchCreate(BaseModel):
    """Schema para crear pago en lote"""
    id_factura: int = Field(..., gt=0)
    monto_pago: Decimal = Field(..., gt=0, decimal_places=2)
    metodo_pago: str = Field(..., max_length=50)
    id_usuario_afi: int = Field(..., gt=0)
    observaciones: Optional[str] = Field(None, max_length=1000)


class PagoBatchRequest(BaseModel):
    """Request para crear múltiples pagos"""
    pagos: List[PagoBatchCreate]
    id_cajero: int = Field(..., description="ID del cajero que registra los pagos")
    
    @field_validator('pagos')
    @classmethod
    def validate_pagos_list(cls, v):
        if not v or len(v) == 0:
            raise ValueError('La lista de pagos no puede estar vacía')
        if len(v) > 100:
            raise ValueError('Máximo 100 pagos por lote')
        return v


class PagoBatchResult(BaseModel):
    """Resultado de un pago creado en lote"""
    index: int
    id_pago: int
    id_factura: int
    monto_pago: Decimal
    estado: str


class PagoBatchError(BaseModel):
    """Error al crear un pago en lote"""
    index: int
    id_factura: Optional[int] = None
    error: str


class PagoBatchResponse(BaseModel):
    """Respuesta de creación en lote"""
    exitosos: List[PagoBatchResult]
    fallidos: List[PagoBatchError]
    total_procesados: int
    total_exitosos: int
    total_fallidos: int
    monto_total_procesado: Decimal

# Schema específico para subir comprobante
class ComprobanteUpload(BaseModel):
    """Schema para subir un comprobante PDF"""
    nombre_archivo: str = Field(..., max_length=255)
    tipo_mime: str = Field('application/pdf', max_length=50)
    
    @field_validator('nombre_archivo')
    @classmethod
    def validar_pdf(cls, v: str) -> str:
        if not v.lower().endswith('.pdf'):
            raise ValueError('Solo se permiten archivos PDF')
        return v
    
    @field_validator('tipo_mime')
    @classmethod
    def validar_mime(cls, v: str) -> str:
        if v != 'application/pdf':
            raise ValueError('Solo se permite tipo MIME application/pdf')
        return v
    