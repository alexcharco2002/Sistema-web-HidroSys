# utils/config.py
from sqlalchemy.orm import Session
from models.configuracion import ConfiguracionSistema
from typing import Optional, Dict, Any
from functools import lru_cache
import logging

logger = logging.getLogger(__name__)

class ConfigManager:
    """Gestor de configuraciones del sistema con caché"""
    
    _cache: Dict[str, Any] = {}
    _cache_timestamp: Optional[float] = None
    CACHE_TTL = 300  # 5 minutos en segundos
    
    @classmethod
    def _should_refresh_cache(cls) -> bool:
        """Determina si el caché debe refrescarse"""
        if not cls._cache or cls._cache_timestamp is None:
            return True
        
        import time
        return (time.time() - cls._cache_timestamp) > cls.CACHE_TTL
    
    @classmethod
    def _refresh_cache(cls, db: Session):
        """Refresca el caché con todas las configuraciones activas"""
        try:
            configs = db.query(ConfiguracionSistema).filter(
                ConfiguracionSistema.activo == True
            ).all()
            
            cls._cache = {
                config.clave: config.get_valor_tipado() 
                for config in configs
            }
            
            import time
            cls._cache_timestamp = time.time()
            
            logger.info(f"✅ Caché de configuraciones refrescado: {len(cls._cache)} elementos")
        except Exception as e:
            logger.error(f"❌ Error al refrescar caché de configuraciones: {e}")
    
    @classmethod
    def get(cls, db: Session, clave: str, default: Any = None) -> Any:
        """
        Obtiene una configuración por su clave
        
        Args:
            db: Sesión de base de datos
            clave: Clave de la configuración
            default: Valor por defecto si no existe
            
        Returns:
            Valor de la configuración convertido a su tipo correcto
        """
        # Refrescar caché si es necesario
        if cls._should_refresh_cache():
            cls._refresh_cache(db)
        
        # Retornar del caché
        return cls._cache.get(clave, default)
    
    @classmethod
    def get_int(cls, db: Session, clave: str, default: int = 0) -> int:
        """Obtiene una configuración como entero"""
        valor = cls.get(db, clave, default)
        try:
            return int(valor)
        except (ValueError, TypeError):
            logger.warning(f"⚠️ No se pudo convertir '{clave}' a int, usando default: {default}")
            return default
    
    @classmethod
    def get_float(cls, db: Session, clave: str, default: float = 0.0) -> float:
        """Obtiene una configuración como flotante"""
        valor = cls.get(db, clave, default)
        try:
            return float(valor)
        except (ValueError, TypeError):
            logger.warning(f"⚠️ No se pudo convertir '{clave}' a float, usando default: {default}")
            return default
    
    @classmethod
    def get_bool(cls, db: Session, clave: str, default: bool = False) -> bool:
        """Obtiene una configuración como booleano"""
        valor = cls.get(db, clave, default)
        if isinstance(valor, bool):
            return valor
        if isinstance(valor, str):
            return valor.lower() in ('true', '1', 'yes', 'si', 'sí')
        return bool(valor)
    
    @classmethod
    def get_str(cls, db: Session, clave: str, default: str = "") -> str:
        """Obtiene una configuración como string"""
        valor = cls.get(db, clave, default)
        return str(valor) if valor is not None else default
    
    @classmethod
    def set(cls, db: Session, clave: str, valor: Any, modificado_por: Optional[str] = None) -> bool:
        """
        Actualiza una configuración
        
        Args:
            db: Sesión de base de datos
            clave: Clave de la configuración
            valor: Nuevo valor
            modificado_por: Usuario que modificó la configuración
            
        Returns:
            True si se actualizó correctamente
        """
        try:
            config = db.query(ConfiguracionSistema).filter(
                ConfiguracionSistema.clave == clave
            ).first()
            
            if not config:
                logger.error(f"❌ Configuración no encontrada: {clave}")
                return False
            
            if not config.modificable:
                logger.error(f"❌ Configuración no modificable: {clave}")
                return False
            
            # Convertir valor a string para almacenar
            config.valor = str(valor)
            if modificado_por:
                config.modificado_por = modificado_por
            
            db.commit()
            
            # Invalidar caché
            cls.clear_cache()
            
            logger.info(f"✅ Configuración actualizada: {clave} = {valor}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error al actualizar configuración {clave}: {e}")
            db.rollback()
            return False
    
    @classmethod
    def get_categoria(cls, db: Session, categoria: str) -> Dict[str, Any]:
        """
        Obtiene todas las configuraciones de una categoría
        
        Args:
            db: Sesión de base de datos
            categoria: Nombre de la categoría
            
        Returns:
            Diccionario con las configuraciones de la categoría
        """
        try:
            configs = db.query(ConfiguracionSistema).filter(
                ConfiguracionSistema.categoria == categoria,
                ConfiguracionSistema.activo == True
            ).all()
            
            return {
                config.clave: config.get_valor_tipado() 
                for config in configs
            }
        except Exception as e:
            logger.error(f"❌ Error al obtener configuraciones de categoría {categoria}: {e}")
            return {}
    
    @classmethod
    def clear_cache(cls):
        """Limpia el caché de configuraciones"""
        cls._cache.clear()
        cls._cache_timestamp = None
        logger.info("🗑️ Caché de configuraciones limpiado")
    
    @classmethod
    def get_all(cls, db: Session) -> Dict[str, Any]:
        """Obtiene todas las configuraciones activas"""
        if cls._should_refresh_cache():
            cls._refresh_cache(db)
        return cls._cache.copy()


# Instancia global del gestor
config_manager = ConfigManager()


# ========================================
# FUNCIONES DE AYUDA ESPECÍFICAS
# ========================================

def get_bloqueo_config(db: Session) -> Dict[str, int]:
    """
    Obtiene todas las configuraciones de bloqueo
    
    Returns:
        Dict con MAX_INTENTOS_TEMPORALES, TIEMPO_BLOQUEO_TEMPORAL, MAX_INTENTOS_PERMANENTES
    """
    return {
        'MAX_INTENTOS_TEMPORALES': config_manager.get_int(db, 'MAX_INTENTOS_TEMPORALES', 5),
        'TIEMPO_BLOQUEO_TEMPORAL': config_manager.get_int(db, 'TIEMPO_BLOQUEO_TEMPORAL', 15),
        'MAX_INTENTOS_PERMANENTES': config_manager.get_int(db, 'MAX_INTENTOS_PERMANENTES', 8),
    }


def get_verificacion_config(db: Session) -> Dict[str, int]:
    """
    Obtiene todas las configuraciones de verificación
    
    Returns:
        Dict con configuraciones de códigos de verificación
    """
    return {
        'VERIFICATION_CODE_LENGTH': config_manager.get_int(db, 'VERIFICATION_CODE_LENGTH', 6),
        'VERIFICATION_CODE_EXPIRE_MINUTES': config_manager.get_int(db, 'VERIFICATION_CODE_EXPIRE_MINUTES', 15),
        'RESET_TOKEN_EXPIRE_MINUTES': config_manager.get_int(db, 'RESET_TOKEN_EXPIRE_MINUTES', 10),
        'MAX_VERIFICATION_ATTEMPTS': config_manager.get_int(db, 'MAX_VERIFICATION_ATTEMPTS', 3),
    }


def get_jwt_config(db: Session) -> Dict[str, Any]:
    """
    Obtiene todas las configuraciones de JWT
    
    Returns:
        Dict con configuraciones de JWT
    """
    return {
        'ACCESS_TOKEN_EXPIRE_MINUTES': config_manager.get_int(db, 'ACCESS_TOKEN_EXPIRE_MINUTES', 120),
        'JWT_ALGORITHM': config_manager.get_str(db, 'JWT_ALGORITHM', 'HS256'),
        'JWT_REFRESH_TOKEN_EXPIRE_DAYS': config_manager.get_int(db, 'JWT_REFRESH_TOKEN_EXPIRE_DAYS', 7),
    }