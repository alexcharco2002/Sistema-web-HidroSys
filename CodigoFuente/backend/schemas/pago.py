# schemas/pago.py

from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Dict, Optional, List
from datetime import datetime
from decimal import Decimal

from models.pago import Pago
from schemas.meter import UsuarioSistemaInfo

class PagoBase(BaseModel):
    """Schema base para Pago"""
    id_factura: Optional[int] = Field(None, description="ID de la factura asociada")
    monto_pago: Decimal = Field(..., gt=0, decimal_places=2, description="Monto del pago")
    metodo_pago: str = Field(..., max_length=50, description="Método de pago (EFECTIVO, TARJETA, TRANSFERENCIA, etc.)")
    id_usuario_afi: Optional[int] = Field(None, description="ID del usuario afiliado que realiza el pago")
    observaciones: Optional[str] = Field(None, max_length=1000, description="Observaciones del pago")
    
    @field_validator('metodo_pago')
    @classmethod
    def validar_metodo_pago(cls, v: str) -> str:
        """Valida que el método de pago sea válido"""
        metodos_validos = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'DEPOSITO', 'OTRO']
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
    incluir_multas: bool = Field(True, description="Indica si el pago incluye multas o solo consumo/servicios") 

    @field_validator('incluir_multas')
    @classmethod
    def validar_incluir_multas(cls, v: bool) -> bool:
        """Valida el flag de inclusión de multas"""
        if not isinstance(v, bool):
            raise ValueError('incluir_multas debe ser un valor booleano')
        return v


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
    
    #
    tiene_comprobante: bool = False
    nombre_archivo: Optional[str] = None
    tipo_mime: Optional[str] = None

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

# schemas/pago.py - Solo actualiza esta clase

class PagoStats(BaseModel):
    """Schema para estadísticas de pagos"""
    total_pagos: int
    pagos_activos: int  
    pagos_registrados: int
    pagos_anulados: int
    monto_total: float   
    monto_efectivo: float
    monto_transferencia: float
    monto_tarjeta: float
    monto_otros: float
    
    class Config:
        json_schema_extra = {
            "example": {
                "total_pagos": 150,
                "pagos_activos": 145,   
                "pagos_registrados": 145,
                "pagos_anulados": 5,
                "monto_total": 3875.50,   
                "monto_efectivo": 2100.00,
                "monto_transferencia": 1200.50,
                "monto_tarjeta": 500.00,
                "monto_otros": 75.00
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

class PagoEnReporte(BaseModel):
    id_pago: int
    cod_usuario_afi: Optional[str]
    nombres: Optional[str]
    apellidos: Optional[str]
    monto_pago: float
    fecha_pago: datetime
    metodo_pago: Optional[str]
    estado_pago: str
    num_factura: Optional[str]
    cajero_nombre: Optional[str]
    
    class Config:
        from_attributes = True
        
    @classmethod
    def from_orm(cls, pago: Pago):
        afiliado = pago.usuario_afiliado
        usuario = afiliado.usuario_sistema if afiliado else None
        cajero = pago.cajero
        
        return cls(
            id_pago=pago.id_pago,
            cod_usuario_afi=afiliado.cod_usuario_afi if afiliado else None,
            nombres=usuario.nombres if usuario else None,
            apellidos=usuario.apellidos if usuario else None,
            monto_pago=float(pago.monto_pago or 0),
            fecha_pago=pago.fecha_pago,
            metodo_pago=pago.metodo_pago,
            estado_pago=pago.estado_pago,
            num_factura=pago.factura.num_factura if pago.factura else None,
            cajero_nombre=f"{cajero.nombres} {cajero.apellidos}" if cajero else None
        )

class ReportePagosResponse(BaseModel):
    success: bool
    data: List[PagoEnReporte]
    skip: int
    limit: int
    estadisticas: Dict

class ComprobanteUploadResponse(BaseModel):
    """Respuesta al subir un comprobante"""
    success: bool
    message: str
    id_pago: int
    nombre_archivo: str
    tamano_kb: float