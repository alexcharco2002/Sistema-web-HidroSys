# test_relacion.py (en la raíz del proyecto)

from models.factura import Factura
from models.affiliate import UsuarioAfiliado

print("=== DIAGNÓSTICO DE RELACIÓN ===")
print(f"1. ¿Factura tiene 'usuario_afiliado'? {hasattr(Factura, 'usuario_afiliado')}")
print(f"2. Tipo: {type(Factura.usuario_afiliado) if hasattr(Factura, 'usuario_afiliado') else 'NO EXISTE'}")
print(f"3. Atributos de Factura: {[attr for attr in dir(Factura) if not attr.startswith('_')]}")
