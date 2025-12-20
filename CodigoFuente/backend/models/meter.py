# models/meter.py
from sqlalchemy import Column, Integer, String, Numeric, Boolean, ForeignKey, Float
from sqlalchemy.orm import relationship
from db.session import Base


class Medidor(Base):
    __tablename__ = "t_medidor"
    __table_args__ = {"schema": "medidores"}

    # Campos principales
    id_medidor = Column(Integer, primary_key=True, index=True)
    num_medidor = Column(String(50), nullable=False)
    latitud = Column(Float(precision=53), nullable=True)   
    longitud = Column(Float(precision=53), nullable=True)
    altitud = Column(Numeric(10, 2), nullable=True, default=3374)
    activo = Column(Boolean, default=True)

    # 🔗 Relaciones foráneas
    id_usuario_afi = Column(Integer, ForeignKey("usuarios.t_usuario_afiliado.id_usuario_afi"), unique=True, nullable=True)
    id_sector = Column(Integer, ForeignKey("medidores.t_sector.id_sector"), nullable=True)

    # Relaciones ORM -  
    usuario_afiliado = relationship(
        "UsuarioAfiliado", 
        back_populates="medidores", 
        lazy="joined"
    )
    
    sector = relationship(
        "Sector", 
        backref="medidores", 
        lazy="joined"
    )

    lecturas = relationship(
        "Lectura",
        back_populates="medidor",
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    

    def __repr__(self):
        return f"<Medidor id={self.id_medidor}, num_medidor={self.num_medidor}, usuario_afi={self.id_usuario_afi}, sector={self.id_sector}>"

    def to_dict(self):
        """Convierte el objeto a un diccionario legible"""
        # Información básica del medidor
        base_dict = {
            "id_medidor": self.id_medidor,
            "num_medidor": self.num_medidor,
            "latitud": str(self.latitud) if self.latitud is not None else None,
            "longitud": str(self.longitud) if self.longitud is not None else None,
            "altitud": float(self.altitud) if self.altitud is not None else None,
            "activo": self.activo,
            "id_usuario_afi": self.id_usuario_afi,
            "id_sector": self.id_sector,
        }
        
        # Información del usuario afiliado
        if self.usuario_afiliado:
            afiliado = self.usuario_afiliado
            usuario_dict = None
            nombre_afiliado = None
            
            # Obtener datos del usuario sistema si existe
            if afiliado.usuario_sistema:
                us = afiliado.usuario_sistema
                usuario_dict = {
                    "id_usuario_sistema": us.id_usuario_sistema,
                    "nombres": us.nombres,
                    "apellidos": us.apellidos,
                    "cedula": us.cedula,
                    "email": us.email
                }
                nombre_afiliado = f"{us.nombres} {us.apellidos}"
            
            base_dict["usuario_afiliado"] = {
                "id_usuario_afi": afiliado.id_usuario_afi,
                "cod_usuario_afi": afiliado.cod_usuario_afi,
                "nombre_afiliado": nombre_afiliado,
                "fecha_afiliacion": (
                    afiliado.fecha_afiliacion.strftime("%Y-%m-%d")
                    if afiliado.fecha_afiliacion else None
                ),
                "id_sector": afiliado.id_sector,
                "usuario_sistema": usuario_dict
            }
        else:
            base_dict["usuario_afiliado"] = None
        
        # Información del sector
        if self.sector:
            base_dict["sector"] = {
                "id_sector": self.sector.id_sector,
                "nombre_sector": getattr(self.sector, "nombre_sector", None)
            }
        else:
            base_dict["sector"] = None
        
        return base_dict