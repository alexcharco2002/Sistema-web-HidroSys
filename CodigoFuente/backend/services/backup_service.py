"""
services/backup_service.py

Servicio para gestión de backups automáticos y manuales
Contiene toda la lógica de negocio para crear, validar y limpiar backups
"""

import subprocess
import os
from datetime import datetime, timedelta
from pathlib import Path
from dotenv import load_dotenv
from typing import Optional, Dict, Any
import logging

# Configurar logger
logger = logging.getLogger(__name__)

load_dotenv()

class BackupService:
    """Servicio centralizado para gestión de backups de PostgreSQL"""
    
    def __init__(self):
        # Configuración de base de datos
        self.db_name = os.getenv("DB_NAME")
        self.db_user = os.getenv("DB_USER")
        self.db_password = os.getenv("DB_PASSWORD")
        self.db_host = os.getenv("DB_HOST", "localhost")
        self.db_port = os.getenv("DB_PORT", "5432")
        
        # Rutas de herramientas PostgreSQL
        self.pg_dump_path = os.getenv(
            "PG_DUMP_PATH", 
            r"C:\Program Files\PostgreSQL\17\bin\pg_dump.exe"
        )
        
        # Directorio de backups en la raiz del proyecto (junto a backend/frontend)
        project_root = Path(__file__).resolve().parents[2]
        self.backup_dir = project_root / os.getenv("BACKUP_DIR", "backups")
        self.backup_dir.mkdir(parents=True, exist_ok=True)
        
        # Configuración de retención
        self.retention_days = int(os.getenv("BACKUP_RETENTION_DAYS", "30"))
        self.max_backups = int(os.getenv("MAX_BACKUPS", "50"))
        
        # Validar configuración
        self._validate_config()
    
    def _validate_config(self) -> None:
        """Valida que la configuración sea correcta"""
        if not self.db_name or not self.db_user:
            logger.warning("Configuración de backups no disponible - desactivado en producción")
            return  # Salir sin error

        
        if not os.path.exists(self.pg_dump_path):
            raise FileNotFoundError(
                f"pg_dump no encontrado en: {self.pg_dump_path}\n"
                "Configura PG_DUMP_PATH en tu archivo .env"
            )
    
    def crear_backup_automatico(self) -> Dict[str, Any]:
        """
        Crea un backup automático programado
        Retorna información del resultado
        """
        fecha = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        filename = f"{self.db_name}_AUTO_{fecha}.dump"
        
        logger.info(f"Iniciando backup automático: {filename}")
        
        resultado = self._ejecutar_backup(filename, es_automatico=True)
        
        if resultado["success"]:
            # Limpiar backups antiguos después de crear uno nuevo
            self._limpiar_backups_antiguos()
            logger.info(f"✅ Backup automático exitoso: {filename}")
        else:
            logger.error(f"❌ Error en backup automático: {resultado['error']}")
        
        return resultado
    
    def crear_backup_manual(self, usuario_nombre: str = "Sistema") -> Dict[str, Any]:
        """
        Crea un backup manual solicitado por un usuario
        """
        fecha = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        filename = f"{self.db_name}_MANUAL_{usuario_nombre}_{fecha}.dump"
        
        logger.info(f"Iniciando backup manual por {usuario_nombre}: {filename}")
        
        resultado = self._ejecutar_backup(filename, es_automatico=False)
        
        if resultado["success"]:
            logger.info(f"✅ Backup manual exitoso: {filename}")
        else:
            logger.error(f"❌ Error en backup manual: {resultado['error']}")
        
        return resultado
    
    def _ejecutar_backup(
        self, 
        filename: str, 
        es_automatico: bool = True
    ) -> Dict[str, Any]:
        """
        Ejecuta el proceso de backup usando pg_dump
        """
        backup_path = self.backup_dir / filename
        
        try:
            # Configurar entorno con contraseña
            env = os.environ.copy()
            env["PGPASSWORD"] = self.db_password
            
            # Comando pg_dump
            comando = [
                self.pg_dump_path,
                "-h", self.db_host,
                "-p", str(self.db_port),
                "-U", self.db_user,
                "-F", "c",  # Formato custom comprimido
                "-b",       # Incluir blobs
                "-v",       # Verbose
                "-f", str(backup_path),
                self.db_name,
            ]
            
            # Ejecutar backup con timeout
            result = subprocess.run(
                comando,
                env=env,
                capture_output=True,
                text=True,
                timeout=300  # 5 minutos
            )
            
            # Verificar resultado
            if result.returncode == 0 and backup_path.exists():
                file_size = backup_path.stat().st_size
                return {
                    "success": True,
                    "filename": filename,
                    "path": str(backup_path),
                    "size": file_size,
                    "size_mb": round(file_size / (1024 * 1024), 2),
                    "created_at": datetime.now().isoformat(),
                    "tipo": "automático" if es_automatico else "manual"
                }
            else:
                # Limpiar archivo parcial si existe
                if backup_path.exists():
                    backup_path.unlink()
                
                return {
                    "success": False,
                    "filename": filename,
                    "error": result.stderr or "Error desconocido en pg_dump"
                }
        
        except subprocess.TimeoutExpired:
            # Limpiar archivo parcial
            if backup_path.exists():
                backup_path.unlink()
            
            return {
                "success": False,
                "filename": filename,
                "error": "Timeout: El backup tardó más de 5 minutos"
            }
        
        except Exception as e:
            # Limpiar archivo parcial
            if backup_path.exists():
                backup_path.unlink()
            
            return {
                "success": False,
                "filename": filename,
                "error": str(e)
            }
    
    def _limpiar_backups_antiguos(self) -> Dict[str, Any]:
        """
        Elimina backups automáticos antiguos según la política de retención
        Mantiene siempre los backups manuales
        """
        eliminados = []
        mantenidos = []
        
        try:
            # Calcular fecha límite
            fecha_limite = datetime.now() - timedelta(days=self.retention_days)
            
            # Buscar solo backups automáticos
            backups_auto = list(self.backup_dir.glob(f"{self.db_name}_AUTO_*.dump"))
            
            for backup_file in backups_auto:
                fecha_creacion = datetime.fromtimestamp(backup_file.stat().st_mtime)
                
                if fecha_creacion < fecha_limite:
                    backup_file.unlink()
                    eliminados.append({
                        "filename": backup_file.name,
                        "fecha": fecha_creacion.isoformat()
                    })
                    logger.info(f"🗑️ Backup antiguo eliminado: {backup_file.name}")
                else:
                    mantenidos.append(backup_file.name)
            
            # Verificar límite máximo de backups
            if len(backups_auto) > self.max_backups:
                # Ordenar por fecha (más antiguos primero)
                backups_auto.sort(key=lambda x: x.stat().st_mtime)
                
                # Eliminar los más antiguos que excedan el límite
                exceso = len(backups_auto) - self.max_backups
                for i in range(exceso):
                    backup_file = backups_auto[i]
                    if backup_file.exists():  # Por si ya fue eliminado
                        backup_file.unlink()
                        eliminados.append({
                            "filename": backup_file.name,
                            "razon": "exceso_limite"
                        })
                        logger.info(f"🗑️ Backup eliminado por límite: {backup_file.name}")
            
            return {
                "success": True,
                "eliminados": len(eliminados),
                "mantenidos": len(mantenidos),
                "detalles": eliminados
            }
        
        except Exception as e:
            logger.error(f"Error limpiando backups antiguos: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def obtener_estadisticas(self) -> Dict[str, Any]:
        """Obtiene estadísticas de los backups existentes"""
        try:
            backups_auto = list(self.backup_dir.glob(f"{self.db_name}_AUTO_*.dump"))
            backups_manual = list(self.backup_dir.glob(f"{self.db_name}_MANUAL_*.dump"))
            
            total_size = sum(b.stat().st_size for b in backups_auto + backups_manual)
            
            ultimo_backup = None
            if backups_auto or backups_manual:
                todos = backups_auto + backups_manual
                todos.sort(key=lambda x: x.stat().st_mtime, reverse=True)
                ultimo = todos[0]
                ultimo_backup = {
                    "filename": ultimo.name,
                    "fecha": datetime.fromtimestamp(ultimo.stat().st_mtime).isoformat(),
                    "size_mb": round(ultimo.stat().st_size / (1024 * 1024), 2)
                }
            
            return {
                "success": True,
                "total_backups": len(backups_auto) + len(backups_manual),
                "backups_automaticos": len(backups_auto),
                "backups_manuales": len(backups_manual),
                "espacio_total_mb": round(total_size / (1024 * 1024), 2),
                "espacio_total_gb": round(total_size / (1024 * 1024 * 1024), 2),
                "ultimo_backup": ultimo_backup,
                "retention_days": self.retention_days,
                "max_backups": self.max_backups
            }
        
        except Exception as e:
            logger.error(f"Error obteniendo estadísticas: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def verificar_salud(self) -> Dict[str, Any]:
        """Verifica el estado de salud del sistema de backups"""
        problemas = []
        
        # Verificar directorio
        if not self.backup_dir.exists():
            problemas.append("Directorio de backups no existe")
        
        # Verificar pg_dump
        if not os.path.exists(self.pg_dump_path):
            problemas.append("pg_dump no encontrado")
        
        # Verificar espacio en disco
        try:
            import shutil
            stats = shutil.disk_usage(self.backup_dir)
            espacio_libre_gb = stats.free / (1024 ** 3)
            
            if espacio_libre_gb < 1:  # Menos de 1 GB
                problemas.append(f"Poco espacio en disco: {espacio_libre_gb:.2f} GB")
        except Exception:
            problemas.append("No se pudo verificar espacio en disco")
        
        # Verificar último backup
        backups = list(self.backup_dir.glob("*.dump"))
        if backups:
            backups.sort(key=lambda x: x.stat().st_mtime, reverse=True)
            ultimo = datetime.fromtimestamp(backups[0].stat().st_mtime)
            dias_sin_backup = (datetime.now() - ultimo).days
            
            if dias_sin_backup > 2:
                problemas.append(f"No hay backups recientes ({dias_sin_backup} días)")
        else:
            problemas.append("No hay backups disponibles")
        
        return {
            "healthy": len(problemas) == 0,
            "problemas": problemas,
            "configuracion": {
                "db_name": self.db_name,
                "backup_dir": str(self.backup_dir),
                "retention_days": self.retention_days
            }
        }


# Instancia singleton del servicio
backup_service = BackupService()
