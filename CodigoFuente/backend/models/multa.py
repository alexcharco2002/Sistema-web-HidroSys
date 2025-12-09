# models/multa.py
from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from db.session import Base

class TipoMulta(Base):
    """
    Modelo de Tipo de Multa con versionamiento
    Tabla: t_multa en el esquema multas
    Cada cambio crea una NUEVA versión, nunca se modifica la existente
    """
    __tablename__ = "t_multa"
    __table_args__ = {'schema': 'multas'}

    id_tipo_multa = Column(Integer, primary_key=True, index=True, autoincrement=True)
    nombre_multa = Column(String(100), nullable=False, index=True)   # permite versiones
    descripcion = Column(Text, nullable=True)
    monto = Column(Numeric(10, 2), nullable=True)                    # monto base (opcional)
    activo = Column(Boolean, default=True, nullable=False, index=True)

    # Campos de versionamiento (mismo patrón que Tarifa)
    fecha_creacion = Column(
        DateTime(timezone=True),
        default=func.now(),
        nullable=False
    )
    vigencia_desde = Column(
        DateTime(timezone=True),
        default=func.now(),
        nullable=False,
        index=True
    )
    vigencia_hasta = Column(DateTime(timezone=True), nullable=True)
    es_vigente = Column(Boolean, default=True, nullable=False, index=True)
    # Relaciones ORM - Multas asignadas a afiliados
    multas_afiliados = relationship(
        "MultaAfiliado",
        back_populates="tipo_multa",
        lazy="joined"
    )

    def __repr__(self):
        return f"<TipoMulta(id={self.id_tipo_multa}, nombre='{self.nombre_multa}', vigente={self.es_vigente})>"

    def to_dict(self):
        return {
            "id_tipo_multa": self.id_tipo_multa,
            "nombre_multa": self.nombre_multa,
            "descripcion": self.descripcion,
            "monto": float(self.monto) if self.monto is not None else None,
            "activo": self.activo,
            "fecha_creacion": self.fecha_creacion.isoformat() if self.fecha_creacion else None,
            "vigencia_desde": self.vigencia_desde.isoformat() if self.vigencia_desde else None,
            "vigencia_hasta": self.vigencia_hasta.isoformat() if self.vigencia_hasta else None,
            "es_vigente": self.es_vigente,
        }
