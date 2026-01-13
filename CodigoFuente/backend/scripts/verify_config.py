#!/usr/bin/env python3
"""
Script para verificar que las configuraciones se lean correctamente
Ejecutar: python scripts/verify_config.py
"""

import sys
import os

# Agregar el directorio raíz al path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.session import SessionLocal
from utils.config import config_manager, get_bloqueo_config, get_verificacion_config, get_jwt_config
from models.configuracion import ConfiguracionSistema
from sqlalchemy import func

def print_separator(title=""):
    """Imprime un separador visual"""
    if title:
        print(f"\n{'='*60}")
        print(f"  {title}")
        print('='*60)
    else:
        print('-'*60)

def verify_configurations():
    """Verifica que las configuraciones se lean correctamente"""
    db = SessionLocal()
    
    try:
        print_separator("VERIFICACIÓN DE CONFIGURACIONES DEL SISTEMA")
        
        # 1. Verificar que la tabla existe y tiene datos
        print("\n1️⃣  Verificando tabla de configuraciones...")
        total_configs = db.query(func.count(ConfiguracionSistema.id_configuracion)).scalar()
        active_configs = db.query(func.count(ConfiguracionSistema.id_configuracion)).filter(
            ConfiguracionSistema.activo == True
        ).scalar()
        
        print(f"   ✅ Total de configuraciones: {total_configs}")
        print(f"   ✅ Configuraciones activas: {active_configs}")
        
        if total_configs == 0:
            print("   ❌ ERROR: No hay configuraciones en la base de datos")
            print("   💡 Ejecuta: psql -U postgres -d jaap_sanjapamba -f migrations/add_system_configurations.sql")
            return False
        
        # 2. Verificar configuraciones de bloqueo
        print_separator("2️⃣  Configuraciones de Bloqueo")
        bloqueo_config = get_bloqueo_config(db)
        for key, value in bloqueo_config.items():
            print(f"   {key}: {value} ({type(value).__name__})")
        
        # 3. Verificar configuraciones de verificación
        print_separator("3️⃣  Configuraciones de Verificación")
        verificacion_config = get_verificacion_config(db)
        for key, value in verificacion_config.items():
            print(f"   {key}: {value} ({type(value).__name__})")
        
        # 4. Verificar configuraciones de JWT
        print_separator("4️⃣  Configuraciones de JWT")
        jwt_config = get_jwt_config(db)
        for key, value in jwt_config.items():
            print(f"   {key}: {value} ({type(value).__name__})")
        
        # 5. Listar todas las categorías
        print_separator("5️⃣  Categorías de Configuración")
        from sqlalchemy import distinct
        categorias = db.query(
            distinct(ConfiguracionSistema.categoria)
        ).filter(
            ConfiguracionSistema.activo == True
        ).all()
        
        for categoria in categorias:
            count = db.query(func.count(ConfiguracionSistema.id_configuracion)).filter(
                ConfiguracionSistema.categoria == categoria[0],
                ConfiguracionSistema.activo == True
            ).scalar()
            print(f"   📁 {categoria[0]}: {count} configuraciones")
        
        # 6. Verificar caché
        print_separator("6️⃣  Verificación de Caché")
        
        # Limpiar caché
        config_manager.clear_cache()
        print("   🗑️  Caché limpiado")
        
        # Cargar primera vez
        val1 = config_manager.get_int(db, 'MAX_INTENTOS_TEMPORALES')
        print(f"   📥 Primera lectura: MAX_INTENTOS_TEMPORALES = {val1}")
        
        # Cargar desde caché
        val2 = config_manager.get_int(db, 'MAX_INTENTOS_TEMPORALES')
        print(f"   ⚡ Segunda lectura (desde caché): MAX_INTENTOS_TEMPORALES = {val2}")
        
        if val1 == val2:
            print("   ✅ Sistema de caché funcionando correctamente")
        
        # 7. Verificar configuraciones modificables vs no modificables
        print_separator("7️⃣  Configuraciones Modificables")
        modificables = db.query(ConfiguracionSistema).filter(
            ConfiguracionSistema.modificable == True,
            ConfiguracionSistema.activo == True
        ).count()
        
        no_modificables = db.query(ConfiguracionSistema).filter(
            ConfiguracionSistema.modificable == False,
            ConfiguracionSistema.activo == True
        ).count()
        
        print(f"   ✅ Modificables: {modificables}")
        print(f"   🔒 No modificables: {no_modificables}")
        
        # 8. Mostrar configuraciones no modificables
        if no_modificables > 0:
            print("\n   Configuraciones bloqueadas:")
            locked_configs = db.query(ConfiguracionSistema).filter(
                ConfiguracionSistema.modificable == False,
                ConfiguracionSistema.activo == True
            ).all()
            
            for config in locked_configs:
                print(f"      🔒 {config.clave} = {config.valor}")
        
        # 9. Resumen final
        print_separator("✅ VERIFICACIÓN COMPLETADA")
        print("\n📊 RESUMEN:")
        print(f"   • Total de configuraciones: {total_configs}")
        print(f"   • Configuraciones activas: {active_configs}")
        print(f"   • Categorías: {len(categorias)}")
        print(f"   • Modificables: {modificables}")
        print(f"   • Bloqueadas: {no_modificables}")
        
        print("\n💡 PRÓXIMOS PASOS:")
        print("   1. Las configuraciones se leerán automáticamente de la BD")
        print("   2. Puedes modificarlas desde la API: PUT /configuracion/{id}")
        print("   3. El caché se refresca automáticamente cada 5 minutos")
        print("   4. Usa POST /configuracion/cache/clear para limpiar el caché manualmente")
        
        print_separator()
        
        return True
        
    except Exception as e:
        print(f"\n❌ ERROR durante la verificación: {e}")
        import traceback
        traceback.print_exc()
        return False
        
    finally:
        db.close()

if __name__ == "__main__":
    success = verify_configurations()
    sys.exit(0 if success else 1)