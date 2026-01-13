# models/historial_medidor.py
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Numeric, Boolean, Text, DateTime, ForeignKey
)
from sqlalchemy.orm import relationship
from db.session import Base


class HistorialMedidor(Base):
    __tablename__ = "t_historial_medidor"
    __table_args__ = {"schema": "medidores"}

    id_historial = Column(Integer, primary_key=True, index=True, autoincrement=True)

    id_medidor = Column(
        Integer,
        ForeignKey("medidores.t_medidor.id_medidor", onupdate="CASCADE", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    id_usuario_afi_anterior = Column(
        Integer,
        ForeignKey("usuarios.t_usuario_afiliado.id_usuario_afi", onupdate="CASCADE", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    id_usuario_afi_nuevo = Column(
        Integer,
        ForeignKey("usuarios.t_usuario_afiliado.id_usuario_afi", onupdate="CASCADE", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    fecha_cambio = Column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        index=True,
    )

    motivo_cambio = Column(String(255), nullable=True)
    costo_cambio = Column(Numeric(10, 2), nullable=True)

    # 👈 OJO: coincide exactamente con tu modelo UsuarioSistema
    id_usuario_sistema = Column(
        Integer,
        ForeignKey("usuarios.t_usuario_sistema.id_usuario_sistema", onupdate="CASCADE", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    observaciones = Column(Text, nullable=True)
    activo = Column(Boolean, default=True, nullable=False, index=True)

    # 🆕 Campo para control de facturación
    facturado = Column(Boolean, default=False, nullable=False, index=True)


    # Relaciones ORM: nombres de clases SQLAlchemy
    medidor = relationship(
        "Medidor",
        backref="historial_cambios",
        lazy="joined",
    )

    usuario_afi_anterior = relationship(
        "UsuarioAfiliado",
        foreign_keys=[id_usuario_afi_anterior],
        lazy="joined",
    )

    usuario_afi_nuevo = relationship(
        "UsuarioAfiliado",
        foreign_keys=[id_usuario_afi_nuevo],
        lazy="joined",
    )

    usuario_sistema = relationship(
        "UsuarioSistema",
        lazy="joined",
    )

    def __repr__(self):
        return (
            f"<HistorialMedidor(id_historial={self.id_historial}, "
            f"id_medidor={self.id_medidor}, "
            f"afi_anterior={self.id_usuario_afi_anterior}, "
            f"afi_nuevo={self.id_usuario_afi_nuevo}, "
            f"fecha_cambio={self.fecha_cambio})>"
        )

    def to_dict(self):
        return {
            "id_historial": self.id_historial,
            "id_medidor": self.id_medidor,
            "id_usuario_afi_anterior": self.id_usuario_afi_anterior,
            "id_usuario_afi_nuevo": self.id_usuario_afi_nuevo,
            "fecha_cambio": self.fecha_cambio.isoformat() if self.fecha_cambio else None,
            "motivo_cambio": self.motivo_cambio,
            "costo_cambio": float(self.costo_cambio) if self.costo_cambio is not None else None,
            "id_usuario_sistema": self.id_usuario_sistema,
            "observaciones": self.observaciones,
            "activo": self.activo,
        }
