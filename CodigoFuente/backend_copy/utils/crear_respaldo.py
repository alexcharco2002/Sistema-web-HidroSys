import os
import datetime
import subprocess
from pathlib import Path

# === CONFIGURACIÓN ===
DB_NAME = "jaap_sanjapamba"
DB_USER = "postgres"
DB_PASSWORD = "Informatico593"
DB_HOST = "localhost"
DB_PORT = "5432"

PG_DUMP_PATH = r"C:\Program Files\PostgreSQL\17\bin\pg_dump.exe"

BASE_DIR = Path(__file__).resolve().parent.parent
BACKUP_DIR = BASE_DIR / "backups"
BACKUP_DIR.mkdir(parents=True, exist_ok=True)

def crear_respaldo():
    """Genera un respaldo de la base de datos PostgreSQL"""
    fecha = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M")
    archivo_respaldo = BACKUP_DIR / f"{DB_NAME}_{fecha}.dump"

    # ✅ Usar diccionario de entorno en lugar de variable global
    env = os.environ.copy()
    env["PGPASSWORD"] = DB_PASSWORD

    comando = [
        PG_DUMP_PATH,
        "-h", DB_HOST,
        "-p", DB_PORT,
        "-U", DB_USER,
        "-F", "c",
        "-b",
        "-f", str(archivo_respaldo),
        DB_NAME,
    ]

    try:
        # ✅ Pasar env al subprocess
        subprocess.run(comando, check=True, env=env, capture_output=True, text=True)
        print(f"✅ Respaldo creado correctamente: {archivo_respaldo}")
        return archivo_respaldo
    except subprocess.CalledProcessError as e:
        print(f"❌ Error al generar respaldo: {e}")
        print(f"Stderr: {e.stderr}")
        return None

if __name__ == "__main__":
    crear_respaldo()