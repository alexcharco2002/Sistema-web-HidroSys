"""
services/config_loader.py

Servicio para cargar configuración de backups desde base de datos
"""

from sqlalchemy.orm import Session
from models.configuracion_backup import ConfiguracionBackup
from db.session import SessionLocal
import logging

logger = logging.getLogger(__name__)


class ConfigLoader:
    """Carga configuración de backups desde base de datos"""
    
    def __init__(self):
        self._config_cache = None
        self._cache_timestamp = None
    
    def get_config_activa(self, db: Session = None) -> ConfiguracionBackup:
        """
        Obtiene la configuración activa de backups
        Usa cache para no consultar la BD en cada llamada
        """
        # Crear sesión si no se proporciona
        should_close = False
        if db is None:
            db = SessionLocal()
            should_close = True
        
        try:
            # Buscar configuración activa
            config = db.query(ConfiguracionBackup).filter(
                ConfiguracionBackup.activo == True
            ).first()
            
            if not config:
                logger.warning("No hay configuración de backup activa. Usando valores por defecto.")
                # Retornar configuración por defecto
                return self._get_default_config()
            
            logger.info(f"✅ Configuración cargada: {config.nombre}")
            return config
            
        except Exception as e:
            logger.error(f"Error cargando configuración: {e}")
            return self._get_default_config()
        
        finally:
            if should_close:
                db.close()
    
    def _get_default_config(self) -> ConfiguracionBackup:
        """Retorna configuración por defecto si no hay en BD"""
        config = ConfiguracionBackup()
        config.nombre = "Configuración por Defecto"
        config.backup_hour = 2
        config.backup_minute = 0
        config.retention_days = 30
        config.max_backups = 50
        config.limpieza_habilitada = True
        config.verificacion_salud_habilitada = True
        return config
    
    def reload_config(self):
        """Fuerza recarga de configuración desde BD"""
        self._config_cache = None
        self._cache_timestamp = None
        logger.info("🔄 Cache de configuración limpiado")


# Instancia singleton
config_loader = ConfigLoader()
