# schemas/meter.py
from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import date, datetime
from decimal import Decimal


# ============================================================================
# SCHEMAS AUXILIARES
# ============================================================================
class SectorInfo(BaseModel):
    id_sector: int
    nombre_sector: Optional[str] = None

    class Config:
        from_attributes = True


class UsuarioSistemaInfo(BaseModel):
    """Info básica del usuario del sistema"""
    id_usuario_sistema: int
    nombres: str
    apellidos: str
    cedula: Optional[str] = None
    email: Optional[str] = None

    class Config:
        from_attributes = True


class UsuarioAfiliadoInfo(BaseModel):
    """Info del usuario afiliado con datos del usuario del sistema"""
    id_usuario_afi: int
    cod_usuario_afi: int
    fecha_afiliacion: Optional[date] = None
    id_sector: Optional[int] = None
    nombre_afiliado: Optional[str] = None
    usuario_sistema: Optional[UsuarioSistemaInfo] = None

    class Config:
        from_attributes = True

    @validator('nombre_afiliado', always=True)
    def generar_nombre_afiliado(cls, v, values):
        """Genera el nombre completo desde usuario_sistema si existe"""
        if v:
            return v
        
        # Si no hay nombre_afiliado pero hay usuario_sistema, generarlo
        usuario_sistema = values.get('usuario_sistema')
        if usuario_sistema:
            return f"{usuario_sistema.nombres} {usuario_sistema.apellidos}"
        
        return None


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
    """Schema para crear un medidor"""
    pass


class MedidorUpdate(BaseModel):
    """Schema para actualizar un medidor (todos los campos opcionales)"""
    num_medidor: Optional[str] = Field(None, max_length=50)
    latitud: Optional[Decimal] = None
    longitud: Optional[Decimal] = None
    altitud: Optional[Decimal] = None
    id_sector: Optional[int] = None
    id_usuario_afi: Optional[int] = None
    activo: Optional[bool] = None

  
    # 🆕 Campos para cambio de medidor (opcionales)
    costo_cambio: Optional[Decimal] = Field(None, description="Costo del cambio de medidor")
    motivo_cambio: Optional[str] = Field(None, max_length=255, description="Motivo del cambio")
    observaciones_cambio: Optional[str] = Field(None, description="Observaciones del cambio")
    

class MedidorResponse(MedidorBase):
    """Schema básico de respuesta"""
    id_medidor: int

    class Config:
        from_attributes = True


class MedidorCompleto(BaseModel):
    """Schema completo con relaciones"""
    id_medidor: int
    num_medidor: str
    latitud: Optional[Decimal] = None
    longitud: Optional[Decimal] = None
    altitud: Optional[Decimal] = None
    activo: bool
    id_usuario_afi: Optional[int] = None
    id_sector: Optional[int] = None
    
    # Relaciones
    sector: Optional[SectorInfo] = None
    usuario_afiliado: Optional[UsuarioAfiliadoInfo] = None

    class Config:
        from_attributes = True

    @validator('usuario_afiliado', pre=True, always=True)
    def cargar_usuario_afiliado(cls, v):
        """Asegura que usuario_afiliado incluya usuario_sistema"""
        if v is None:
            return None
        
        # Si es un objeto ORM, convertirlo manualmente
        if hasattr(v, '__dict__'):
            usuario_sistema = None
            if hasattr(v, 'usuario_sistema') and v.usuario_sistema:
                us = v.usuario_sistema
                usuario_sistema = UsuarioSistemaInfo(
                    id_usuario_sistema=us.id_usuario_sistema,
                    nombres=us.nombres,
                    apellidos=us.apellidos,
                    cedula=us.cedula,
                    email=us.email
                )
            
            return UsuarioAfiliadoInfo(
                id_usuario_afi=v.id_usuario_afi,
                cod_usuario_afi=v.cod_usuario_afi,
                fecha_afiliacion=v.fecha_afiliacion,
                id_sector=v.id_sector,
                usuario_sistema=usuario_sistema,
                nombre_afiliado=(
                    f"{usuario_sistema.nombres} {usuario_sistema.apellidos}"
                    if usuario_sistema else None
                )
            )
        
        return v


# ============================================================================
# SCHEMAS AUXILIARES PARA ENDPOINTS
# ============================================================================
class MedidorStats(BaseModel):
    """Estadísticas de medidores"""
    total: int
    activos: int
    inactivos: int
    asignados: int
    sin_asignar: int
    por_sector: dict

    class Config:
        from_attributes = True


class AfiliadoDisponible(BaseModel):
    """Afiliados sin medidor asignado"""
    id_usuario_afi: int
    cod_usuario_afi: int
    nombre_afiliado: Optional[str] = None
    fecha_afiliacion: Optional[date] = None
    id_sector: Optional[int] = None
    nombre_sector: Optional[str] = None

    class Config:
        from_attributes = True

class MedidorListItem(BaseModel):
    id_medidor: int
    num_medidor: str | None
    activo: bool | None
    latitud: float | None
    longitud: float | None
    altitud: float | None

    id_sector: int | None
    nombre_sector: str | None

    id_usuario_afi: int | None
    cod_usuario_afi: int | None    # ✅ Agregado
    nombre_afiliado: str | None

    class Config:
        from_attributes = True
