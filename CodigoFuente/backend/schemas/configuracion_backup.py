"""
schemas/configuracion_backup.py

Schemas de validación para configuración de backups
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict
from datetime import datetime


class ConfiguracionBackupBase(BaseModel):
    """Schema base con campos comunes"""
    
    nombre: str = Field(..., max_length=100, description="Nombre de la configuración")
    descripcion: Optional[str] = Field(None, description="Descripción detallada")
    activo: bool = Field(True, description="Estado de la configuración")
    
    # Horarios
    backup_diario_habilitado: bool = Field(True, description="Activar backup diario")
    backup_hour: int = Field(2, ge=0, le=23, description="Hora del backup (0-23)")
    backup_minute: int = Field(0, ge=0, le=59, description="Minuto del backup (0-59)")
    
    backup_12h_habilitado: bool = Field(False, description="Backup cada 12 horas")
    backup_semanal_habilitado: bool = Field(True, description="Backup semanal")
    backup_semanal_dia: str = Field('sun', description="Día del backup semanal")
    backup_semanal_hora: int = Field(3, ge=0, le=23)
    
    # Retención
    retention_days: int = Field(30, gt=0, description="Días de retención")
    max_backups: int = Field(50, gt=0, description="Máximo de backups")
    limpieza_habilitada: bool = Field(True, description="Limpieza automática")
    limpieza_dia: str = Field('sun', description="Día de limpieza")
    limpieza_hora: int = Field(3, ge=0, le=23)
    
    # Verificación
    verificacion_salud_habilitada: bool = Field(True)
    verificacion_salud_hora: int = Field(8, ge=0, le=23)
    
    # Notificaciones
    notificar_exito: bool = Field(False)
    notificar_error: bool = Field(True)
    notificar_espacio_bajo: bool = Field(True)
    umbral_espacio_gb: int = Field(5, gt=0)
    
    # Excepciones
    dias_excepciones: Optional[List[str]] = Field(
        None,
        description="Días sin backups (formato: YYYY-MM-DD)"
    )
    horarios_personalizados: Optional[List[Dict]] = Field(
        None,
        description="Horarios adicionales personalizados"
    )
    
    # Almacenamiento
    backup_local_habilitado: bool = Field(True)
    backup_nube_habilitado: bool = Field(False)
    backup_nube_provider: Optional[str] = Field(None, max_length=50)
    backup_nube_config: Optional[Dict] = None
    
    # Cifrado
    cifrado_habilitado: bool = Field(False)
    cifrado_algoritmo: str = Field('aes-256-cbc', max_length=50)
    
    @validator('backup_semanal_dia', 'limpieza_dia')
    def validar_dia_semana(cls, v):
        """Valida que el día de la semana sea válido"""
        dias_validos = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
        if v not in dias_validos:
            raise ValueError(
                f"Día inválido. Debe ser uno de: {', '.join(dias_validos)}"
            )
        return v
    
    @validator('dias_excepciones')
    def validar_formato_fechas(cls, v):
        """Valida que las fechas estén en formato correcto"""
        if v:
            from datetime import datetime
            for fecha in v:
                try:
                    datetime.strptime(fecha, "%Y-%m-%d")
                except ValueError:
                    raise ValueError(
                        f"Fecha '{fecha}' inválida. Use formato YYYY-MM-DD"
                    )
        return v


class ConfiguracionBackupCreate(ConfiguracionBackupBase):
    """Schema para crear configuración"""
    pass


class ConfiguracionBackupUpdate(BaseModel):
    """Schema para actualizar configuración (todos los campos opcionales)"""
    
    nombre: Optional[str] = Field(None, max_length=100)
    descripcion: Optional[str] = None
    activo: Optional[bool] = None
    
    backup_diario_habilitado: Optional[bool] = None
    backup_hour: Optional[int] = Field(None, ge=0, le=23)
    backup_minute: Optional[int] = Field(None, ge=0, le=59)
    
    backup_12h_habilitado: Optional[bool] = None
    backup_semanal_habilitado: Optional[bool] = None
    backup_semanal_dia: Optional[str] = None
    backup_semanal_hora: Optional[int] = Field(None, ge=0, le=23)
    
    retention_days: Optional[int] = Field(None, gt=0)
    max_backups: Optional[int] = Field(None, gt=0)
    limpieza_habilitada: Optional[bool] = None
    limpieza_dia: Optional[str] = None
    limpieza_hora: Optional[int] = Field(None, ge=0, le=23)
    
    verificacion_salud_habilitada: Optional[bool] = None
    verificacion_salud_hora: Optional[int] = Field(None, ge=0, le=23)
    
    notificar_exito: Optional[bool] = None
    notificar_error: Optional[bool] = None
    notificar_espacio_bajo: Optional[bool] = None
    umbral_espacio_gb: Optional[int] = Field(None, gt=0)
    
    dias_excepciones: Optional[List[str]] = None
    horarios_personalizados: Optional[List[Dict]] = None
    
    backup_local_habilitado: Optional[bool] = None
    backup_nube_habilitado: Optional[bool] = None
    backup_nube_provider: Optional[str] = None
    backup_nube_config: Optional[Dict] = None
    
    cifrado_habilitado: Optional[bool] = None
    cifrado_algoritmo: Optional[str] = None


class ConfiguracionBackupResponse(ConfiguracionBackupBase):
    """Schema para respuestas de configuración"""
    
    id: int
    creado_en: datetime
    actualizado_en: datetime
    actualizado_por: Optional[int]
    
    class Config:
        from_attributes = True
