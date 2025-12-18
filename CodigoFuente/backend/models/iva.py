# models/iva.py

from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, Text, CheckConstraint
from sqlalchemy.sql import func
from db.session import Base

class IVA(Base):
    """
    Modelo de IVA para facturación de agua.
    
    Reglas de negocio:
    - Solo puede haber UN IVA con es_aplicable=True activo a la vez
    - Los IVAs se crean ACTIVOS por defecto
    - Si es_aplicable=False, porcentaje debe ser 0 (no aplica IVA)
    - Si es_aplicable=True, porcentaje debe ser > 0
    
    Tabla: t_iva en el esquema configuracion
    """
    
    __tablename__ = "t_iva"
    __table_args__ = (
        # Constraint: porcentaje válido entre 0 y 100
        CheckConstraint(
            'porcentaje >= 0 AND porcentaje <= 100',
            name='check_porcentaje_valido'
        ),
        {'schema': 'configuracion'}
    )

    # ==========================================
    # COLUMNAS PRINCIPALES
    # ==========================================
    id_iva = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True,
        comment="ID único del IVA"
    )

    codigo = Column(
        String(10),
        nullable=False,
        unique=True,
        index=True,
        comment="Código único del IVA (ej: IVA12, NO_APLICA)"
    )

    descripcion = Column(
        String(100),
        nullable=False,
        comment="Descripción del IVA"
    )

    porcentaje = Column(
        Numeric(5, 2),
        nullable=False,
        comment="Porcentaje de IVA (0.00 - 100.00)"
    )

    es_aplicable = Column(
        Boolean,
        default=False,
        nullable=False,
        comment="true = opción para NO aplicar IVA, false = IVA aplicable"
    )

    observaciones = Column(
        Text,
        nullable=True,
        comment="Notas o comentarios adicionales"
    )

    # ==========================================
    # CAMPOS DE AUDITORÍA
    # ==========================================
    activo = Column(
        Boolean,
        default=True,  # Cambiado a True según tabla SQL
        nullable=False,
        index=True,
        comment="Estado activo/inactivo del IVA"
    )

    fecha_creacion = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="Fecha y hora de creación"
    )

    fecha_actualizacion = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        comment="Fecha y hora de última actualización"
    )

    # ==========================================
    # MÉTODOS
    # ==========================================
    def __repr__(self):
        estado = "ACTIVO" if self.activo else "INACTIVO"
        tipo = "NO APLICABLE" if self.es_aplicable else "APLICABLE"
        return (
            f"<IVA(id={self.id_iva}, codigo='{self.codigo}', "
            f"descripcion='{self.descripcion}', porcentaje={self.porcentaje}%, "
            f"tipo={tipo}, estado={estado})>"
        )

    def to_dict(self):
        """Convierte el objeto a diccionario para serialización"""
        return {
            'id_iva': self.id_iva,
            'codigo': self.codigo,
            'descripcion': self.descripcion,
            'porcentaje': float(self.porcentaje) if self.porcentaje else 0.0,
            'es_aplicable': self.es_aplicable,
            'observaciones': self.observaciones,
            'activo': self.activo,
            'fecha_creacion': self.fecha_creacion.isoformat() if self.fecha_creacion else None,
            'fecha_actualizacion': self.fecha_actualizacion.isoformat() if self.fecha_actualizacion else None
        }

    @property
    def porcentaje_formateado(self) -> str:
        """Retorna el porcentaje formateado como string"""
        return f"{float(self.porcentaje):.2f}%"

    @property
    def tipo_texto(self) -> str:
        """Retorna el tipo de IVA como texto"""
        return "No Aplicable" if self.es_aplicable else "Aplicable"

    @property
    def estado_texto(self) -> str:
        """Retorna el estado como texto"""
        return "Activo" if self.activo else "Inactivo"

    def puede_ser_eliminado(self) -> bool:
        """
        Verifica si el IVA puede ser eliminado.
        Normalmente se verifica si tiene facturas asociadas.
        """
        # TODO: Implementar lógica con relaciones de facturas
        return True

    def activar(self):
        """Activa el IVA"""
        self.activo = True

    def desactivar(self):
        """Desactiva el IVA"""
        self.activo = False

    def aplica_iva(self) -> bool:
        """Verifica si el IVA es aplicable (no es NO_APLICABLE)"""
        return not self.es_aplicable
