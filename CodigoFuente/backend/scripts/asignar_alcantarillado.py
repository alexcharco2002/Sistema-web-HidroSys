# scripts/asignar_alcantarillado.py
"""
Script para configurar los servicios permanentes de Alcantarillado
e importar las asignaciones masivas de afiliados según la lista de la comunidad.
"""

import os
import sys
import csv
from datetime import date
from decimal import Decimal

# Ajustar path al directorio backend
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
sys.path.insert(0, backend_dir)

import main  # Carga la inicialización de SQLAlchemy y modelos
from db.session import SessionLocal
from models.servicio import Servicio
from models.servicio_permanente import ConfiguracionServicioPermanente, AsignacionServicioPermanente
from models.affiliate import UsuarioAfiliado
from models.user import UsuarioSistema

CSV_PATH = os.path.join(current_dir, "datos_alcantarillado.csv")

def obtener_o_crear_configuracion(db, nombre, precio_override, id_servicio=1):
    """Busca o crea una configuración permanente con su respectivo precio_override"""
    config = db.query(ConfiguracionServicioPermanente).filter(
        ConfiguracionServicioPermanente.id_servicio == id_servicio,
        ConfiguracionServicioPermanente.precio_override == Decimal(str(precio_override)),
        ConfiguracionServicioPermanente.activo == True
    ).first()

    if not config:
        # También buscar por nombre si ya existiera
        config = db.query(ConfiguracionServicioPermanente).filter(
            ConfiguracionServicioPermanente.nombre == nombre
        ).first()

    if not config:
        config = ConfiguracionServicioPermanente(
            nombre=nombre,
            descripcion=f"Servicio permanente de alcantarillado con tarifa de ${precio_override:.2f}",
            aplicar_servicio=True,
            activo=True,
            id_servicio=id_servicio,
            vigencia_desde=date(2025, 1, 1),
            vigencia_hasta=None,
            es_vigente=True,
            aplicar_en_periodo="mensual",
            precio_override=Decimal(str(precio_override)),
            observaciones="Tarifa comunitaria asignada automáticamente"
        )
        db.add(config)
        db.flush()
        print(f"✨ Creada configuración: {nombre} (id: {config.id_configuracion_sp}, precio: ${precio_override})")
    else:
        # Asegurar valores
        config.activo = True
        config.aplicar_servicio = True
        config.es_vigente = True
        config.precio_override = Decimal(str(precio_override))
        db.flush()
        print(f"✔️ Configuración existente: {nombre} (id: {config.id_configuracion_sp}, precio: ${precio_override})")

    return config


def ejecutar_asignacion():
    db = SessionLocal()
    try:
        # 1. Validar que exista el servicio base id=1 (Alcantarillado)
        servicio_alcantarillado = db.query(Servicio).filter(Servicio.id_servicio == 1).first()
        if not servicio_alcantarillado:
            # Buscar por nombre si tiene otro ID
            servicio_alcantarillado = db.query(Servicio).filter(Servicio.nombre.ilike("%alcantarillado%")).first()

        if not servicio_alcantarillado:
            print("❌ Error: No se encontró el servicio 'Alcantarillado' en t_servicios.")
            return

        id_servicio = servicio_alcantarillado.id_servicio
        print(f"✅ Servicio base: {servicio_alcantarillado.nombre} (ID: {id_servicio})")

        # 2. Configurar las 3 tarifas de alcantarillado
        config_010 = obtener_o_crear_configuracion(db, "Alcantarillado $0.10", 0.10, id_servicio)
        config_025 = obtener_o_crear_configuracion(db, "Alcantarillado $0.25", 0.25, id_servicio)
        config_050 = obtener_o_crear_configuracion(db, "Alcantarillado $0.50", 0.50, id_servicio)

        mapa_configs = {
            "0.1": config_010,
            "0.10": config_010,
            "0.25": config_025,
            "0.5": config_050,
            "0.50": config_050
        }

        # Conjunto de IDs de configs de alcantarillado para gestionar
        ids_configs_alcantarillado = [
            config_010.id_configuracion_sp,
            config_025.id_configuracion_sp,
            config_050.id_configuracion_sp
        ]

        # 3. Leer CSV
        if not os.path.exists(CSV_PATH):
            print(f"❌ Error: Archivo CSV no encontrado en {CSV_PATH}")
            return

        total_leidos = 0
        asignados_010 = 0
        asignados_025 = 0
        asignados_050 = 0
        socios_sin_cobro = 0
        no_encontrados = []

        with open(CSV_PATH, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                total_leidos += 1
                cod = (row.get("cod_usuario_afi") or "").strip()
                nombre = (row.get("nombre") or "").strip()
                cedula = (row.get("cedula") or "").strip()
                tarifa_str = (row.get("tarifa") or "").strip().lower()

                # Buscar al afiliado primero por código
                afiliado = None
                if cod and cod != "---":
                    afiliado = db.query(UsuarioAfiliado).filter(
                        UsuarioAfiliado.cod_usuario_afi == cod,
                        UsuarioAfiliado.activo == True
                    ).first()

                # Si no se encontró por código, intentar por cédula
                if not afiliado and cedula and cedula not in ("N/A", "---", ""):
                    afiliado = (
                        db.query(UsuarioAfiliado)
                        .join(UsuarioSistema, UsuarioAfiliado.id_usuario_sistema == UsuarioSistema.id_usuario_sistema)
                        .filter(
                            UsuarioSistema.cedula == cedula,
                            UsuarioAfiliado.activo == True
                        )
                        .first()
                    )

                if not afiliado:
                    no_encontrados.append(f"Cod: {cod} | Cédula: {cedula} | Nombre: {nombre} | Tarifa: {tarifa_str}")
                    continue

                id_usuario_afi = afiliado.id_usuario_afi

                # Caso 1: Es socio (sin tarifa de alcantarillado)
                if tarifa_str in ("socio", "0", "0.0", "sin servicio", ""):
                    # Desactivar cualquier asignación de alcantarillado activa previa
                    db.query(AsignacionServicioPermanente).filter(
                        AsignacionServicioPermanente.id_usuario_afi == id_usuario_afi,
                        AsignacionServicioPermanente.id_configuracion_sp.in_(ids_configs_alcantarillado)
                    ).update({"activo": False}, synchronize_session=False)
                    socios_sin_cobro += 1
                    continue

                # Caso 2: Tiene tarifa asignada
                target_config = mapa_configs.get(tarifa_str)
                if not target_config:
                    print(f"⚠️ Tarifa no reconocida '{tarifa_str}' para {nombre} (cod {cod})")
                    continue

                # Desactivar otras tarifas de alcantarillado que no sean la elegida
                otras_configs = [c_id for c_id in ids_configs_alcantarillado if c_id != target_config.id_configuracion_sp]
                if otras_configs:
                    db.query(AsignacionServicioPermanente).filter(
                        AsignacionServicioPermanente.id_usuario_afi == id_usuario_afi,
                        AsignacionServicioPermanente.id_configuracion_sp.in_(otras_configs)
                    ).update({"activo": False}, synchronize_session=False)

                # Buscar si ya tiene asignada la configuración correcta
                asignacion = db.query(AsignacionServicioPermanente).filter(
                    AsignacionServicioPermanente.id_usuario_afi == id_usuario_afi,
                    AsignacionServicioPermanente.id_configuracion_sp == target_config.id_configuracion_sp
                ).first()

                if not asignacion:
                    asignacion = AsignacionServicioPermanente(
                        id_configuracion_sp=target_config.id_configuracion_sp,
                        id_usuario_afi=id_usuario_afi,
                        activo=True,
                        fecha_inicio=date(2025, 1, 1),
                        fecha_fin=None,
                        observaciones=f"Tarifa {tarifa_str} asignada según listado comunitario"
                    )
                    db.add(asignacion)
                else:
                    asignacion.activo = True
                    asignacion.fecha_fin = None

                if tarifa_str in ("0.1", "0.10"):
                    asignados_010 += 1
                elif tarifa_str == "0.25":
                    asignados_025 += 1
                elif tarifa_str in ("0.5", "0.50"):
                    asignados_050 += 1

        db.commit()

        print("\n" + "=" * 60)
        print("📊 RESUMEN DE ASIGNACIONES DE ALCANTARILLADO")
        print("=" * 60)
        print(f"Total registros leídos:          {total_leidos}")
        print(f"Afiliados con tarifa $0.10:     {asignados_010}")
        print(f"Afiliados con tarifa $0.25:     {asignados_025}")
        print(f"Afiliados con tarifa $0.50:     {asignados_050}")
        print(f"Socios sin cobro (omitidos):     {socios_sin_cobro}")
        print(f"Total procesados con éxito:      {asignados_010 + asignados_025 + asignados_050 + socios_sin_cobro}")

        if no_encontrados:
            print(f"\n⚠️ Afiliados no encontrados en BD ({len(no_encontrados)}):")
            for item in no_encontrados:
                print(f"   • {item}")
        print("=" * 60 + "\n")

    except Exception as e:
        db.rollback()
        print(f"❌ Error durante la asignación: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    ejecutar_asignacion()
