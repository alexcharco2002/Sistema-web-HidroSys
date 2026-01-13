"""
services/scheduler_service.py

Configuración y gestión del scheduler para tareas programadas
"""

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.events import EVENT_JOB_EXECUTED, EVENT_JOB_ERROR
import logging
from typing import Optional
from .backup_service import backup_service

# Configurar logger
logger = logging.getLogger(__name__)

class SchedulerService:
    """Servicio para gestión de tareas programadas"""
    
    def __init__(self):
        self.scheduler: Optional[BackgroundScheduler] = None
        self._jobs_config = []
    
    def iniciar(self) -> None:
        """Inicializa y arranca el scheduler con todas las tareas programadas"""
        if self.scheduler is not None:
            logger.warning("El scheduler ya está iniciado")
            return
        
        logger.info("🔧 Iniciando sistema de tareas programadas...")
        
        # Crear scheduler
        self.scheduler = BackgroundScheduler(
            job_defaults={
                'coalesce': True,  # Combinar ejecuciones perdidas
                'max_instances': 1,  # Solo una instancia por trabajo
                'misfire_grace_time': 300  # 5 minutos 
            }
        )
        
        # Agregar listeners para logging
        self.scheduler.add_listener(
            self._job_executed_listener,
            EVENT_JOB_EXECUTED
        )
        self.scheduler.add_listener(
            self._job_error_listener,
            EVENT_JOB_ERROR
        )
        
        # Configurar tareas programadas
        self._configurar_tareas()
        
        # Iniciar scheduler
        self.scheduler.start()
        logger.info("✅ Scheduler iniciado exitosamente")
        
        # Mostrar próximas ejecuciones
        self._mostrar_proximas_ejecuciones()
    
    def detener(self) -> None:
        """Detiene el scheduler de forma segura"""
        if self.scheduler is None:
            return
        
        logger.info("🔄 Deteniendo scheduler...")
        self.scheduler.shutdown(wait=True)
        self.scheduler = None
        logger.info("✅ Scheduler detenido")

    def _configurar_tareas(self) -> None:
        """Configura todas las tareas programadas desde base de datos"""
        
        from services.config_loader import config_loader
        
        # ✅ Cargar configuración desde BD
        config = config_loader.get_config_activa()
        
        logger.info(f"📋 Cargando configuración: {config.nombre}")
        
        # ✅ TAREA 1: Backup automático diario
        if config.backup_diario_habilitado:
            self.scheduler.add_job(
                func=self._ejecutar_backup_automatico,
                trigger=CronTrigger(
                    hour=config.backup_hour,
                    minute=config.backup_minute
                ),
                id="backup_diario",
                name=f"Backup Diario {config.backup_hour}:{config.backup_minute:02d}",
                replace_existing=True
            )
        
        # ✅ TAREA 2: Backup cada 12 horas (opcional)
        if config.backup_12h_habilitado:
            self.scheduler.add_job(
                func=self._ejecutar_backup_automatico,
                trigger=CronTrigger(
                    hour=f'{config.backup_hour},{(config.backup_hour + 12) % 24}',
                    minute=config.backup_minute
                ),
                id="backup_12h",
                name="Backup Cada 12 Horas",
                replace_existing=True
            )
        
        # ✅ TAREA 3: Limpieza de backups antiguos
        if config.limpieza_habilitada:
            self.scheduler.add_job(
                func=self._limpiar_backups_antiguos,
                trigger=CronTrigger(
                    day_of_week=config.limpieza_dia,
                    hour=config.limpieza_hora,
                    minute=0
                ),
                id="limpieza_backups",
                name=f"Limpieza {config.limpieza_dia.upper()}",
                replace_existing=True
            )
        
        # ✅ TAREA 4: Verificación de salud
        if config.verificacion_salud_habilitada:
            self.scheduler.add_job(
                func=self._verificar_salud_sistema,
                trigger=CronTrigger(
                    hour=config.verificacion_salud_hora,
                    minute=0
                ),
                id="verificacion_salud",
                name=f"Verificación Salud {config.verificacion_salud_hora}:00",
                replace_existing=True
            )
        
        logger.info(f"✅ {len(self.scheduler.get_jobs())} tareas programadas desde BD")


    def _ejecutar_backup_automatico(self) -> None:
        """Ejecuta el backup automático diario"""
        logger.info("⏰ Ejecutando backup automático programado...")
        
        try:
            resultado = backup_service.crear_backup_automatico()
            
            if resultado["success"]:
                logger.info(
                    f"✅ Backup completado: {resultado['filename']} "
                    f"({resultado['size_mb']} MB)"
                )
            else:
                logger.error(f"❌ Error en backup: {resultado['error']}")
        
        except Exception as e:
            logger.error(f"❌ Excepción en backup automático: {e}")
    
    def _limpiar_backups_antiguos(self) -> None:
        """Limpia backups antiguos según política de retención"""
        logger.info("🧹 Ejecutando limpieza de backups antiguos...")
        
        try:
            resultado = backup_service._limpiar_backups_antiguos()
            
            if resultado["success"]:
                logger.info(
                    f"✅ Limpieza completada: {resultado['eliminados']} eliminados, "
                    f"{resultado['mantenidos']} mantenidos"
                )
        except Exception as e:
            logger.error(f"❌ Error en limpieza de backups: {e}")
    
    def _verificar_salud_sistema(self) -> None:
        """Verifica la salud del sistema de backups"""
        logger.info("🏥 Verificando salud del sistema de backups...")
        
        try:
            salud = backup_service.verificar_salud()
            
            if salud["healthy"]:
                logger.info("✅ Sistema de backups saludable")
            else:
                logger.warning(
                    f"⚠️ Problemas detectados en backups: {salud['problemas']}"
                )
        except Exception as e:
            logger.error(f"❌ Error verificando salud: {e}")
    
    def _job_executed_listener(self, event) -> None:
        """Listener para trabajos ejecutados exitosamente"""
        job = self.scheduler.get_job(event.job_id)
        if job:
            logger.info(f"✅ Tarea completada: {job.name}")
    
    def _job_error_listener(self, event) -> None:
        """Listener para trabajos con errores"""
        job = self.scheduler.get_job(event.job_id)
        if job:
            logger.error(f"❌ Error en tarea: {job.name} - {event.exception}")
    
    def _mostrar_proximas_ejecuciones(self) -> None:
        """Muestra las próximas ejecuciones programadas"""
        jobs = self.scheduler.get_jobs()
        
        if jobs:
            logger.info("📅 Próximas ejecuciones programadas:")
            for job in jobs:
                if job.next_run_time:
                    logger.info(f"  • {job.name}: {job.next_run_time}")
    
    def obtener_estado(self) -> dict:
        """Obtiene el estado actual del scheduler"""
        if self.scheduler is None:
            return {"running": False}
        
        jobs = self.scheduler.get_jobs()
        
        return {
            "running": self.scheduler.running,
            "total_jobs": len(jobs),
            "jobs": [
                {
                    "id": job.id,
                    "name": job.name,
                    "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
                    "trigger": str(job.trigger)
                }
                for job in jobs
            ]
        }


# Instancia singleton del scheduler
scheduler_service = SchedulerService()
