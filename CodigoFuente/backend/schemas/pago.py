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

# schemas/pago.py - AGREGAR AL FINAL DEL ARCHIVO

# ========================================
# SCHEMAS PARA PAGO MÚLTIPLE
# ========================================

class ItemPagoMultiple(BaseModel):
    """Schema para un item individual en un pago múltiple"""
    id_factura: int = Field(..., gt=0, description="ID de la factura a pagar")
    monto_a_pagar: Decimal = Field(..., gt=0, decimal_places=2, description="Monto a pagar de esta factura")
    incluir_multas: bool = Field(True, description="Incluir multas en este pago")
    incluir_mora: bool = Field(True, description="Incluir mora en este pago")
    incluir_consumos: bool = Field(True, description="Incluir consumos y servicios en este pago")
    
    @field_validator('monto_a_pagar')
    @classmethod
    def validar_monto(cls, v: Decimal) -> Decimal:
        """Valida que el monto sea positivo"""
        if v <= 0:
            raise ValueError('El monto a pagar debe ser mayor a 0')
        return round(v, 2)
    
    class Config:
        json_schema_extra = {
            "example": {
                "id_factura": 123,
                "monto_a_pagar": 45.50,
                "incluir_multas": True,
                "incluir_mora": True,
                "incluir_consumos": True
            }
        }


class PagoMultipleCreate(BaseModel):
    """Schema para crear un pago múltiple"""
    facturas: List[ItemPagoMultiple] = Field(
        ..., 
        min_length=2, 
        max_length=5,
        description="Lista de facturas a pagar (mínimo 2, máximo 5)"
    )
    metodo_pago: str = Field(
        ..., 
        max_length=50, 
        description="Método de pago (EFECTIVO, TARJETA, TRANSFERENCIA, etc.)"
    )
    id_usuario_afi: Optional[int] = Field(
        None, 
        description="ID del usuario afiliado que realiza el pago"
    )
    id_cajero: int = Field(..., description="ID del cajero que registra el pago")
    observaciones: Optional[str] = Field(
        None, 
        max_length=1000, 
        description="Observaciones generales del pago múltiple"
    )
    
    @field_validator('facturas')
    @classmethod
    def validar_facturas(cls, v: List[ItemPagoMultiple]) -> List[ItemPagoMultiple]:
        """Valida la lista de facturas"""
        if not v or len(v) < 2:
            raise ValueError('Debe incluir al menos 2 facturas para pago múltiple')
        if len(v) > 5:
            raise ValueError('No puede incluir más de 5 facturas en un pago múltiple')
        
        # Validar que no haya facturas duplicadas
        ids_facturas = [item.id_factura for item in v]
        if len(ids_facturas) != len(set(ids_facturas)):
            raise ValueError('No puede incluir facturas duplicadas en el pago múltiple')
        
        return v
    
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
    
    class Config:
        json_schema_extra = {
            "example": {
                "facturas": [
                    {
                        "id_factura": 123,
                        "monto_a_pagar": 45.50,
                        "incluir_multas": True,
                        "incluir_mora": True,
                        "incluir_consumos": True
                    },
                    {
                        "id_factura": 124,
                        "monto_a_pagar": 38.75,
                        "incluir_multas": True,
                        "incluir_mora": True,
                        "incluir_consumos": True
                    }
                ],
                "metodo_pago": "EFECTIVO",
                "id_usuario_afi": 10,
                "id_cajero": 3,
                "observaciones": "Pago múltiple de 2 facturas atrasadas"
            }
        }


class FacturaResumenPagoMultiple(BaseModel):
    """Resumen de una factura en el pago múltiple"""
    id_factura: int
    num_factura: str
    periodo: str
    monto_pagado: Decimal
    mora_aplicada: Decimal
    estado_final: str
    esta_totalmente_pagada: bool
    
    class Config:
        json_schema_extra = {
            "example": {
                "id_factura": 123,
                "num_factura": "FACT-2024-123",
                "periodo": "12/2024",
                "monto_pagado": 45.50,
                "mora_aplicada": 2.50,
                "estado_final": "pagada",
                "esta_totalmente_pagada": True
            }
        }


class PagoMultipleResponse(BaseModel):
    """Schema para la respuesta de pago múltiple"""
    success: bool = Field(..., description="Indica si la operación fue exitosa")
    total_pagado: Decimal = Field(..., description="Monto total pagado en todas las facturas")
    cantidad_facturas: int = Field(..., description="Cantidad de facturas procesadas")
    pagos_creados: List[int] = Field(..., description="Lista de IDs de pagos creados")
    facturas_pagadas_completas: List[int] = Field(
        ..., 
        description="IDs de facturas que quedaron totalmente pagadas"
    )
    facturas_pagadas_parciales: List[int] = Field(
        ..., 
        description="IDs de facturas con pago parcial"
    )
    detalle_mora_total: Decimal = Field(..., description="Total de mora aplicada en todas las facturas")
    observaciones: str = Field(..., description="Observaciones y detalles del pago múltiple")
    
    # Detalle de cada factura procesada
    detalle_facturas: Optional[List[FacturaResumenPagoMultiple]] = Field(
        None,
        description="Detalle de cada factura procesada"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "total_pagado": 92.75,
                "cantidad_facturas": 2,
                "pagos_creados": [501, 502],
                "facturas_pagadas_completas": [123],
                "facturas_pagadas_parciales": [124],
                "detalle_mora_total": 5.00,
                "observaciones": "Factura #FACT-2024-123: $48.00\nFactura #FACT-2024-124: $44.75",
                "detalle_facturas": [
                    {
                        "id_factura": 123,
                        "num_factura": "FACT-2024-123",
                        "periodo": "12/2024",
                        "monto_pagado": 48.00,
                        "mora_aplicada": 2.50,
                        "estado_final": "pagada",
                        "esta_totalmente_pagada": True
                    },
                    {
                        "id_factura": 124,
                        "num_factura": "FACT-2024-124",
                        "periodo": "11/2024",
                        "monto_pagado": 44.75,
                        "mora_aplicada": 2.50,
                        "estado_final": "parcial",
                        "esta_totalmente_pagada": False
                    }
                ]
            }
        }


class PagoMultipleError(BaseModel):
    """Schema para error en pago múltiple"""
    success: bool = False
    error: str = Field(..., description="Mensaje de error")
    factura_error: Optional[int] = Field(None, description="ID de la factura que causó el error")
    facturas_procesadas: List[int] = Field(
        default_factory=list,
        description="IDs de facturas que sí se procesaron antes del error"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": False,
                "error": "La factura 125 ya está completamente pagada",
                "factura_error": 125,
                "facturas_procesadas": [123, 124]
            }
        }


# ========================================
# SCHEMAS PARA COMPROBANTE DE PAGO MÚLTIPLE
# ========================================

class ComprobanteMultipleData(BaseModel):
    """Datos para generar comprobante de pago múltiple"""
    id_pago_principal: int = Field(..., description="ID del primer pago (usado como referencia)")
    total_pagado: Decimal = Field(..., description="Total pagado")
    cantidad_facturas: int = Field(..., description="Cantidad de facturas")
    metodo_pago: str = Field(..., description="Método de pago")
    fecha_pago: datetime = Field(..., description="Fecha del pago")
    cajero_nombre: str = Field(..., description="Nombre del cajero")
    afiliado_nombre: str = Field(..., description="Nombre del afiliado")
    afiliado_cedula: str = Field(..., description="Cédula del afiliado")
    afiliado_codigo: str = Field(..., description="Código del afiliado")
    facturas_detalle: List[FacturaResumenPagoMultiple] = Field(
        ...,
        description="Detalle de cada factura pagada"
    )
    observaciones: Optional[str] = Field(None, description="Observaciones del pago")


class ComprobanteMultipleUploadResponse(BaseModel):
    """Respuesta al subir comprobante múltiple"""
    success: bool
    message: str
    id_pago_principal: int
    nombre_archivo: str
    tamano_kb: float
    cantidad_facturas: int
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "Comprobante múltiple guardado exitosamente",
                "id_pago_principal": 501,
                "nombre_archivo": "Comprobante_Multiple_000501.pdf",
                "tamano_kb": 85.3,
                "cantidad_facturas": 3
            }
        }


# ========================================
# SCHEMAS PARA VALIDACIÓN DE PAGO MÚLTIPLE
# ========================================

class ValidacionFacturaMultiple(BaseModel):
    """Resultado de validación de una factura para pago múltiple"""
    id_factura: int
    es_valida: bool
    saldo_pendiente: Decimal
    tiene_multas: bool
    mora_aplicable: Decimal
    mensaje: Optional[str] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "id_factura": 123,
                "es_valida": True,
                "saldo_pendiente": 45.50,
                "tiene_multas": True,
                "mora_aplicable": 2.50,
                "mensaje": None
            }
        }


class ValidacionPagoMultipleRequest(BaseModel):
    """Request para validar facturas antes de pago múltiple"""
    ids_facturas: List[int] = Field(
        ...,
        min_length=2,
        max_length=5,
        description="Lista de IDs de facturas a validar"
    )
    id_usuario_afi: Optional[int] = Field(
        None,
        description="ID del afiliado (para validar que todas sean del mismo afiliado)"
    )
    
    @field_validator('ids_facturas')
    @classmethod
    def validar_ids_facturas(cls, v: List[int]) -> List[int]:
        """Valida la lista de IDs de facturas"""
        if not v or len(v) < 2:
            raise ValueError('Debe incluir al menos 2 facturas')
        if len(v) > 5:
            raise ValueError('No puede validar más de 5 facturas')
        
        # Validar que no haya IDs duplicados
        if len(v) != len(set(v)):
            raise ValueError('No puede incluir IDs de facturas duplicados')
        
        # Validar que todos sean positivos
        if any(id_factura <= 0 for id_factura in v):
            raise ValueError('Todos los IDs de facturas deben ser mayores a 0')
        
        return v


class ValidacionPagoMultipleResponse(BaseModel):
    """Respuesta de validación de pago múltiple"""
    es_valido: bool = Field(..., description="Indica si todas las facturas son válidas para pago múltiple")
    total_a_pagar: Decimal = Field(..., description="Total que se pagaría en todas las facturas")
    total_mora: Decimal = Field(..., description="Total de mora en todas las facturas")
    facturas: List[ValidacionFacturaMultiple] = Field(..., description="Detalle de validación de cada factura")
    errores: List[str] = Field(default_factory=list, description="Lista de errores encontrados")
    advertencias: List[str] = Field(default_factory=list, description="Lista de advertencias")
    
    class Config:
        json_schema_extra = {
            "example": {
                "es_valido": True,
                "total_a_pagar": 92.75,
                "total_mora": 5.00,
                "facturas": [
                    {
                        "id_factura": 123,
                        "es_valida": True,
                        "saldo_pendiente": 45.50,
                        "tiene_multas": True,
                        "mora_aplicable": 2.50,
                        "mensaje": None
                    },
                    {
                        "id_factura": 124,
                        "es_valida": True,
                        "saldo_pendiente": 42.25,
                        "tiene_multas": False,
                        "mora_aplicable": 2.50,
                        "mensaje": None
                    }
                ],
                "errores": [],
                "advertencias": ["La factura 123 tiene multas pendientes"]
            }
        }


# ========================================
# SCHEMAS PARA ESTADÍSTICAS DE PAGO MÚLTIPLE
# ========================================

class PagoMultipleStats(BaseModel):
    """Estadísticas de pagos múltiples"""
    total_pagos_multiples: int = Field(..., description="Total de pagos múltiples realizados")
    promedio_facturas_por_pago: float = Field(..., description="Promedio de facturas por pago múltiple")
    monto_total_pagos_multiples: Decimal = Field(..., description="Monto total en pagos múltiples")
    pago_multiple_mas_grande: int = Field(..., description="Mayor cantidad de facturas en un solo pago")
    
    class Config:
        json_schema_extra = {
            "example": {
                "total_pagos_multiples": 45,
                "promedio_facturas_por_pago": 2.8,
                "monto_total_pagos_multiples": 4567.89,
                "pago_multiple_mas_grande": 5
            }
        }
