# models/configuracion.py
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.sql import func
from db.session import Base

class ConfiguracionSistema(Base):
    """Modelo para almacenar configuraciones del sistema"""
    __tablename__ = "t_configuracion_sistema"
    __table_args__ = {"schema": "seguridad"}
    
    id_configuracion = Column(Integer, primary_key=True, index=True)
    clave = Column(String(100), unique=True, nullable=False, index=True)
    valor = Column(String(500), nullable=False)
    tipo_dato = Column(String(20), nullable=False, default='string')  # string, int, float, boolean
    descripcion = Column(Text, nullable=True)
    categoria = Column(String(50), default='general', index=True)
    modificable = Column(Boolean, default=True)
    activo = Column(Boolean, default=True, index=True)
    fecha_creacion = Column(DateTime, server_default=func.now())
    fecha_modificacion = Column(DateTime, server_default=func.now(), onupdate=func.now())
    modificado_por = Column(String(100), nullable=True)
    
    def __repr__(self):
        return f"<ConfiguracionSistema {self.clave}={self.valor}>"
    
    def get_valor_tipado(self):
        """Convierte el valor string al tipo de dato correcto"""
        if self.tipo_dato == 'int':
            return int(self.valor)
        elif self.tipo_dato == 'float':
            return float(self.valor)
        elif self.tipo_dato == 'boolean':
            return self.valor.lower() in ('true', '1', 'yes', 'si', 'sí')
        else:
            return self.valor