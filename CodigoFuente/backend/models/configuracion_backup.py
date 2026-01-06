"""
models/configuracion_backup.py

Modelo para configuración de backups automáticos
"""

from sqlalchemy import (
    Column, Integer, String, Boolean, 
    TIMESTAMP, CheckConstraint, Text, JSON
)
from sqlalchemy.sql import func
from db.session import Base


class ConfiguracionBackup(Base):
    """
    Tabla de configuración para el sistema de backups automáticos
    Permite configurar horarios, retención y notificaciones sin modificar código
    """
    
    __tablename__ = "t_configuracion_backup"
    __table_args__ = (
        CheckConstraint(
            "retention_days > 0",
            name="chk_retention_positivo"
        ),
        CheckConstraint(
            "max_backups > 0",
            name="chk_max_backups_positivo"
        ),
        CheckConstraint(
            "backup_hour >= 0 AND backup_hour <= 23",
            name="chk_hora_valida"
        ),
        CheckConstraint(
            "backup_minute >= 0 AND backup_minute <= 59",
            name="chk_minuto_valido"
        ),
        {"schema": "configuracion"}
    )
    
    # ================================
    # IDENTIFICACIÓN
    # ================================
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(
        String(100), 
        unique=True, 
        nullable=False,
        comment="Nombre descriptivo de la configuración"
    )
    descripcion = Column(
        Text,
        nullable=True,
        comment="Descripción detallada"
    )
    activo = Column(
        Boolean, 
        default=True,
        comment="Si esta configuración está activa"
    )
    
    # ================================
    # CONFIGURACIÓN DE HORARIOS
    # ================================
    backup_diario_habilitado = Column(
        Boolean,
        default=True,
        comment="Activar backup automático diario"
    )
    backup_hour = Column(
        Integer,
        default=2,
        nullable=False,
        comment="Hora del backup diario (0-23)"
    )
    backup_minute = Column(
        Integer,
        default=0,
        nullable=False,
        comment="Minuto del backup diario (0-59)"
    )
    
    # ================================
    # BACKUPS ADICIONALES
    # ================================
    backup_12h_habilitado = Column(
        Boolean,
        default=False,
        comment="Backup cada 12 horas"
    )
    backup_semanal_habilitado = Column(
        Boolean,
        default=True,
        comment="Backup semanal completo"
    )
    backup_semanal_dia = Column(
        String(10),
        default='sun',
        comment="Día de la semana para backup semanal (mon, tue, wed, thu, fri, sat, sun)"
    )
    backup_semanal_hora = Column(
        Integer,
        default=3,
        comment="Hora del backup semanal"
    )
    
    # ================================
    # RETENCIÓN Y LIMPIEZA
    # ================================
    retention_days = Column(
        Integer,
        default=30,
        nullable=False,
        comment="Días de retención de backups"
    )
    max_backups = Column(
        Integer,
        default=50,
        nullable=False,
        comment="Número máximo de backups a mantener"
    )
    limpieza_habilitada = Column(
        Boolean,
        default=True,
        comment="Habilitar limpieza automática de backups antiguos"
    )
    limpieza_dia = Column(
        String(10),
        default='sun',
        comment="Día para ejecutar limpieza"
    )
    limpieza_hora = Column(
        Integer,
        default=3,
        comment="Hora de limpieza"
    )
    
    # ================================
    # VERIFICACIÓN DE SALUD
    # ================================
    verificacion_salud_habilitada = Column(
        Boolean,
        default=True,
        comment="Habilitar verificación de salud del sistema"
    )
    verificacion_salud_hora = Column(
        Integer,
        default=8,
        comment="Hora de verificación de salud"
    )
    
    # ================================
    # NOTIFICACIONES
    # ================================
    notificar_exito = Column(
        Boolean,
        default=False,
        comment="Notificar cuando un backup es exitoso"
    )
    notificar_error = Column(
        Boolean,
        default=True,
        comment="Notificar cuando hay errores"
    )
    notificar_espacio_bajo = Column(
        Boolean,
        default=True,
        comment="Notificar cuando hay poco espacio en disco"
    )
    umbral_espacio_gb = Column(
        Integer,
        default=5,
        comment="GB mínimos de espacio libre para notificar"
    )
    
    # ================================
    # EXCEPCIONES Y DÍAS ESPECIALES
    # ================================
    dias_excepciones = Column(
        JSON,
        nullable=True,
        comment="Días en los que NO se ejecutan backups (formato: ['2026-01-01', '2026-12-25'])"
    )
    horarios_personalizados = Column(
        JSON,
        nullable=True,
        comment="Horarios adicionales personalizados (formato: [{'hour': 14, 'minute': 30, 'days': ['mon', 'wed']}])"
    )
    
    # ================================
    # ALMACENAMIENTO
    # ================================
    backup_local_habilitado = Column(
        Boolean,
        default=True,
        comment="Guardar backups en disco local"
    )
    backup_nube_habilitado = Column(
        Boolean,
        default=False,
        comment="Subir backups a la nube"
    )
    backup_nube_provider = Column(
        String(50),
        nullable=True,
        comment="Proveedor de nube (s3, gcs, azure)"
    )
    backup_nube_config = Column(
        JSON,
        nullable=True,
        comment="Configuración de conexión a la nube"
    )
    
    # ================================
    # CIFRADO
    # ================================
    cifrado_habilitado = Column(
        Boolean,
        default=False,
        comment="Cifrar backups con AES-256"
    )
    cifrado_algoritmo = Column(
        String(50),
        default='aes-256-cbc',
        comment="Algoritmo de cifrado"
    )
    
    # ================================
    # AUDITORÍA
    # ================================
    creado_en = Column(
        TIMESTAMP,
        server_default=func.now(),
        comment="Fecha de creación"
    )
    actualizado_en = Column(
        TIMESTAMP,
        server_default=func.now(),
        onupdate=func.now(),
        comment="Última actualización"
    )
    actualizado_por = Column(
        Integer,
        nullable=True,
        comment="ID del usuario que hizo la última modificación"
    )
    
    # ================================
    # MÉTODOS
    # ================================
    
    def es_dia_excepcion(self, fecha) -> bool:
        """Verifica si una fecha es día de excepción"""
        if not self.dias_excepciones:
            return False
        
        fecha_str = fecha.strftime("%Y-%m-%d")
        return fecha_str in self.dias_excepciones
    
    def to_dict(self):
        """Convierte el modelo a diccionario"""
        return {
            "id": self.id,
            "nombre": self.nombre,
            "descripcion": self.descripcion,
            "activo": self.activo,
            
            # Horarios
            "backup_diario_habilitado": self.backup_diario_habilitado,
            "backup_hour": self.backup_hour,
            "backup_minute": self.backup_minute,
            "backup_12h_habilitado": self.backup_12h_habilitado,
            "backup_semanal_habilitado": self.backup_semanal_habilitado,
            "backup_semanal_dia": self.backup_semanal_dia,
            "backup_semanal_hora": self.backup_semanal_hora,
            
            # Retención
            "retention_days": self.retention_days,
            "max_backups": self.max_backups,
            "limpieza_habilitada": self.limpieza_habilitada,
            "limpieza_dia": self.limpieza_dia,
            "limpieza_hora": self.limpieza_hora,
            
            # Verificación
            "verificacion_salud_habilitada": self.verificacion_salud_habilitada,
            "verificacion_salud_hora": self.verificacion_salud_hora,
            
            # Notificaciones
            "notificar_exito": self.notificar_exito,
            "notificar_error": self.notificar_error,
            "notificar_espacio_bajo": self.notificar_espacio_bajo,
            "umbral_espacio_gb": self.umbral_espacio_gb,
            
            # Excepciones
            "dias_excepciones": self.dias_excepciones,
            "horarios_personalizados": self.horarios_personalizados,
            
            # Almacenamiento
            "backup_local_habilitado": self.backup_local_habilitado,
            "backup_nube_habilitado": self.backup_nube_habilitado,
            "backup_nube_provider": self.backup_nube_provider,
            
            # Cifrado
            "cifrado_habilitado": self.cifrado_habilitado,
            "cifrado_algoritmo": self.cifrado_algoritmo,
            
            # Auditoría
            "creado_en": self.creado_en,
            "actualizado_en": self.actualizado_en,
            "actualizado_por": self.actualizado_por
        }
    
    def __repr__(self):
        return f"<ConfiguracionBackup(nombre='{self.nombre}', activo={self.activo})>"
