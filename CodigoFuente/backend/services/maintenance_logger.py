# services/maintenance_logger.py

import logging
import os
from datetime import datetime
from typing import Optional

class MaintenanceLogger:
    """
    Sistema de logging específico para mantenimientos programados
    Cumple con RNF-14 - Registro y auditoría de mantenimientos
    """
    
    def __init__(self, log_dir: str = "logs"):
        """
        Inicializa el logger de mantenimientos
        
        Args:
            log_dir: Directorio donde se guardarán los logs
        """
        self.log_dir = log_dir
        
        # Crear directorio si no existe
        if not os.path.exists(log_dir):
            os.makedirs(log_dir)
        
        # Configurar logger
        self.logger = logging.getLogger('maintenance')
        self.logger.setLevel(logging.INFO)
        
        # Archivo de log con fecha
        log_file = os.path.join(
            log_dir,
            f"maintenance_{datetime.now().strftime('%Y%m')}.log"
        )
        
        # Handler para archivo
        file_handler = logging.FileHandler(log_file, encoding='utf-8')
        file_handler.setLevel(logging.INFO)
        
        # Formato del log
        formatter = logging.Formatter(
            '%(asctime)s | %(levelname)s | %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        file_handler.setFormatter(formatter)
        
        # Agregar handler si no existe
        if not self.logger.handlers:
            self.logger.addHandler(file_handler)
    
    def log_mantenimiento_creado(
        self,
        id_notificacion: int,
        titulo: str,
        fecha_inicio: datetime,
        fecha_fin: Optional[datetime],
        usuario_creador: str,
        enviar_email: bool,
        destinatarios_count: int = 0
    ):
        """Registra la creación de un mantenimiento programado"""
        self.logger.info(
            f"CREADO | ID: {id_notificacion} | "
            f"Título: '{titulo}' | "
            f"Inicio: {fecha_inicio.strftime('%Y-%m-%d %H:%M')} | "
            f"Fin: {fecha_fin.strftime('%Y-%m-%d %H:%M') if fecha_fin else 'No especificado'} | "
            f"Creador: {usuario_creador} | "
            f"Email: {'Sí' if enviar_email else 'No'} | "
            f"Destinatarios: {destinatarios_count}"
        )
    
    def log_email_enviado(
        self,
        id_notificacion: int,
        titulo: str,
        destinatarios_count: int,
        exitoso: bool,
        error: Optional[str] = None
    ):
        """Registra el envío de emails de notificación"""
        if exitoso:
            self.logger.info(
                f"EMAIL ENVIADO | ID: {id_notificacion} | "
                f"Título: '{titulo}' | "
                f"Destinatarios: {destinatarios_count}"
            )
        else:
            self.logger.error(
                f"EMAIL FALLIDO | ID: {id_notificacion} | "
                f"Título: '{titulo}' | "
                f"Error: {error}"
            )
    
    def log_mantenimiento_iniciado(self, id_notificacion: int, titulo: str):
        """Registra el inicio de un mantenimiento"""
        self.logger.info(
            f"INICIADO | ID: {id_notificacion} | Título: '{titulo}'"
        )
    
    def log_mantenimiento_finalizado(
        self,
        id_notificacion: int,
        titulo: str,
        duracion_real: Optional[str] = None
    ):
        """Registra la finalización de un mantenimiento"""
        self.logger.info(
            f"FINALIZADO | ID: {id_notificacion} | "
            f"Título: '{titulo}' | "
            f"Duración real: {duracion_real or 'No registrada'}"
        )
    
    def log_mantenimiento_cancelado(
        self,
        id_notificacion: int,
        titulo: str,
        motivo: str,
        usuario: str
    ):
        """Registra la cancelación de un mantenimiento"""
        self.logger.warning(
            f"CANCELADO | ID: {id_notificacion} | "
            f"Título: '{titulo}' | "
            f"Motivo: {motivo} | "
            f"Usuario: {usuario}"
        )
    
    def log_error(self, operacion: str, error: str):
        """Registra un error en las operaciones de mantenimiento"""
        self.logger.error(f"ERROR | Operación: {operacion} | Error: {error}")


# Instancia global del logger
maintenance_logger = MaintenanceLogger()
