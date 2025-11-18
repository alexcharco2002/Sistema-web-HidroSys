# models/affiliate.py
from sqlalchemy import Column, Integer, Boolean, Date, ForeignKey
from sqlalchemy.orm import relationship
from db.session import Base

class UsuarioAfiliado(Base):
    __tablename__ = "t_usuario_afiliado"
    __table_args__ = {"schema": "usuarios"}

    id_usuario_afi = Column(Integer, primary_key=True, index=True)
    fecha_afiliacion = Column(Date, nullable=True)
    activo = Column(Boolean, default=True)
    cod_usuario_afi = Column(Integer, nullable=False)
    
    id_sector = Column(Integer, ForeignKey("medidores.t_sector.id_sector"), nullable=False)
    id_usuario_sistema = Column(Integer, ForeignKey("usuarios.t_usuario_sistema.id_usuario_sistema"), nullable=False)
    
    # Relaciones ORM
    usuario_sistema = relationship(
        "UsuarioSistema", 
        back_populates="afiliaciones", 
        lazy="joined"
    )
    
    sector = relationship(
        "Sector", 
        backref="afiliados", 
        lazy="joined"
    )
    
    # ✅ NUEVA RELACIÓN CON MEDIDORES
    # Relación correcta (1 usuario afiliado → muchos medidores)
    medidores = relationship(
        "Medidor",
        back_populates="usuario_afiliado",
        lazy="joined"
    )

