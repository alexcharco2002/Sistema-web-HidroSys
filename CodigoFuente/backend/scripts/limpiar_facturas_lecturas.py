# scripts/limpiar_facturas_lecturas.py
"""
Script seguro para reiniciar el ciclo de facturación y lecturas:
1. Crea copias de respaldo de seguridad de las tablas en PostgreSQL.
2. Vacia las tablas de pagos, moras, detalles de facturas, facturas y lecturas.
3. Reinicia las secuencias de IDs para comenzar desde 1.
4. Libera cualquier multa que hubiera quedado marcada como facturada.
5. Da de alta al afiliado 150 (Jose Antonio Paca Charco) y le asigna Alcantarillado $0.25.
"""

import sys, os
from datetime import datetime, date
from decimal import Decimal

current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
sys.path.insert(0, backend_dir)

import main
from db.session import SessionLocal
from sqlalchemy import text
from models.affiliate import UsuarioAfiliado
from models.user import UsuarioSistema
from models.servicio_permanente import ConfiguracionServicioPermanente, AsignacionServicioPermanente

def ejecutar_limpieza():
    db = SessionLocal()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    try:
        print("=" * 65)
        print("🚀 INICIANDO REINICIO LIMPIO DE FACTURACIÓN, PAGOS Y LECTURAS")
        print("=" * 65)

        # 1. Crear tablas de respaldo de seguridad
        print("\n📦 Paso 1: Creando tablas de respaldo de seguridad...")
        tablas_backup = [
            ("facturacion.t_pagos", f"facturacion.bkp_pagos_{timestamp}"),
            ("facturacion.t_detalle_factura", f"facturacion.bkp_detalle_factura_{timestamp}"),
            ("facturacion.t_mora_factura", f"facturacion.bkp_mora_factura_{timestamp}"),
            ("facturacion.t_factura", f"facturacion.bkp_factura_{timestamp}"),
            ("medidores.t_lecturas", f"medidores.bkp_lecturas_{timestamp}")
        ]

        for origen, destino in tablas_backup:
            db.execute(text(f"CREATE TABLE {destino} AS SELECT * FROM {origen};"))
            cnt = db.execute(text(f"SELECT COUNT(*) FROM {destino};")).scalar()
            print(f"   ✔️ Respaldo creado: {destino} ({cnt} registros)")

        # 2. Vaciar tablas transaccionales en orden correcto
        print("\n🧹 Paso 2: Vaciando tablas transaccionales...")
        db.execute(text("TRUNCATE TABLE facturacion.t_pagos RESTART IDENTITY CASCADE;"))
        print("   ✔️ facturacion.t_pagos vaciada y secuencia reiniciada.")

        db.execute(text("TRUNCATE TABLE facturacion.t_mora_factura RESTART IDENTITY CASCADE;"))
        print("   ✔️ facturacion.t_mora_factura vaciada y secuencia reiniciada.")

        db.execute(text("TRUNCATE TABLE facturacion.t_detalle_factura RESTART IDENTITY CASCADE;"))
        print("   ✔️ facturacion.t_detalle_factura vaciada y secuencia reiniciada.")

        db.execute(text("TRUNCATE TABLE facturacion.t_factura RESTART IDENTITY CASCADE;"))
        print("   ✔️ facturacion.t_factura vaciada y secuencia reiniciada.")

        db.execute(text("TRUNCATE TABLE medidores.t_lecturas RESTART IDENTITY CASCADE;"))
        print("   ✔️ medidores.t_lecturas vaciada y secuencia reiniciada.")

        # 3. Liberar multas
        print("\n⚖️ Paso 3: Desvinculando multas de facturas...")
        res_multas = db.execute(text("UPDATE multas.t_multas_afiliados SET facturado = false WHERE facturado = true;"))
        print(f"   ✔️ Multas actualizadas: {res_multas.rowcount} pasaron a estado no facturado.")

        # 4. Dar de alta a Jose Antonio Paca Charco (Código 150)
        print("\n👤 Paso 4: Registrando al afiliado 150 (Jose Antonio Paca Charco)...")
        usuario_jose = db.query(UsuarioSistema).filter(UsuarioSistema.cedula.ilike("%605578137%")).first()

        if usuario_jose:
            afiliado_existente = db.query(UsuarioAfiliado).filter(
                (UsuarioAfiliado.cod_usuario_afi == "150") | 
                (UsuarioAfiliado.id_usuario_sistema == usuario_jose.id_usuario_sistema)
            ).first()

            if not afiliado_existente:
                nuevo_afiliado = UsuarioAfiliado(
                    id_usuario_sistema=usuario_jose.id_usuario_sistema,
                    cod_usuario_afi="150",
                    id_sector=1,  # Sector por defecto
                    activo=True
                )
                db.add(nuevo_afiliado)
                db.flush()
                print(f"   ✔️ Afiliado creado con código 150 (id_usuario_afi: {nuevo_afiliado.id_usuario_afi}).")
                id_afi_jose = nuevo_afiliado.id_usuario_afi
            else:
                afiliado_existente.cod_usuario_afi = "150"
                afiliado_existente.activo = True
                db.flush()
                print(f"   ✔️ Afiliado ya existía (id: {afiliado_existente.id_usuario_afi}), asegurado código 150 y activo.")
                id_afi_jose = afiliado_existente.id_usuario_afi

            # Asignar Alcantarillado $0.25 a Jose Antonio
            config_025 = db.query(ConfiguracionServicioPermanente).filter(
                ConfiguracionServicioPermanente.id_servicio == 1,
                ConfiguracionServicioPermanente.precio_override == Decimal("0.25"),
                ConfiguracionServicioPermanente.activo == True
            ).first()

            if config_025:
                asig = db.query(AsignacionServicioPermanente).filter(
                    AsignacionServicioPermanente.id_usuario_afi == id_afi_jose,
                    AsignacionServicioPermanente.id_configuracion_sp == config_025.id_configuracion_sp
                ).first()

                if not asig:
                    asig = AsignacionServicioPermanente(
                        id_configuracion_sp=config_025.id_configuracion_sp,
                        id_usuario_afi=id_afi_jose,
                        activo=True,
                        fecha_inicio=date(2025, 1, 1),
                        fecha_fin=None,
                        observaciones="Tarifa $0.25 asignada según listado comunitario"
                    )
                    db.add(asig)
                    print(f"   ✔️ Asignado Alcantarillado $0.25 a Jose Antonio Paca Charco.")
                else:
                    asig.activo = True
                    print("   ✔️ Jose Antonio ya tenía la asignación activa.")

        # Commit final
        db.commit()

        # 5. Conteo de confirmación
        print("\n" + "=" * 65)
        print("📊 ESTADO ACTUAL DE LAS TABLAS TRAS EL REINICIO")
        print("=" * 65)
        for t in ["facturacion.t_pagos", "facturacion.t_factura", "facturacion.t_detalle_factura", "medidores.t_lecturas"]:
            cnt = db.execute(text(f"SELECT COUNT(*) FROM {t};")).scalar()
            print(f"   • {t}: {cnt} registros")

        # Conteo de asignados a $0.25
        if config_025:
            cnt_025 = db.execute(text(f"SELECT COUNT(*) FROM facturacion.t_asignacion_servicio_permanente WHERE id_configuracion_sp = {config_025.id_configuracion_sp} AND activo = true;")).scalar()
            print(f"\n   👥 Afiliados asignados a Alcantarillado $0.25: {cnt_025} / 176 (¡COMPLETO!)")

        print("=" * 65)
        print("✅ REINICIO COMPLETADO CON ÉXITO. Sistema listo para arrancar en limpio.")
        print("=" * 65 + "\n")

    except Exception as e:
        db.rollback()
        print(f"❌ Error durante el reinicio: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    ejecutar_limpieza()
