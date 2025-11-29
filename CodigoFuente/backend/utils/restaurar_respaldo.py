import os
import subprocess
from pathlib import Path

# === CONFIGURACIÓN ===
DB_NAME = "jaap_sanjapamba"
DB_USER = "postgres"
DB_PASSWORD = "TecniCobro2024"
DB_HOST = "localhost"
DB_PORT = "5432"

PG_RESTORE_PATH = r"C:\Program Files\PostgreSQL\17\bin\pg_restore.exe"

BASE_DIR = Path(__file__).resolve().parent.parent
BACKUP_DIR = BASE_DIR / "backups"

def restaurar_respaldo(nombre_archivo: str):
    """Restaura la base de datos desde un archivo de respaldo"""
    archivo_respaldo = BACKUP_DIR / nombre_archivo

    if not archivo_respaldo.exists():
        print(f"❌ No se encontró el archivo: {archivo_respaldo}")
        return False

    # ✅ Usar diccionario de entorno
    env = os.environ.copy()
    env["PGPASSWORD"] = DB_PASSWORD

    comando = [
        PG_RESTORE_PATH,
        "-h", DB_HOST,
        "-p", str(DB_PORT),
        "-U", DB_USER,
        "-d", DB_NAME,
        "-c",  # limpia la base
        "--if-exists",
        "--disable-triggers",  # evita errores de FK
        str(archivo_respaldo),
    ]


    try:
        result = subprocess.run(comando, env=env, capture_output=True, text=True)
        
        # ✅ pg_restore puede tener warnings pero ser exitoso
        if result.returncode == 0 or "ERROR" not in result.stderr.upper():
            print(f"✅ Base de datos '{DB_NAME}' restaurada desde {nombre_archivo}")
            return True
        else:
            print(f"❌ Error al restaurar: {result.stderr}")
            return False
            
    except subprocess.CalledProcessError as e:
        print(f"❌ Error al restaurar respaldo: {e}")
        print(f"Stderr: {e.stderr}")
        return False

if __name__ == "__main__":
    # Listar backups disponibles
    backups = list(BACKUP_DIR.glob("*.dump"))
    if backups:
        print("📦 Backups disponibles:")
        for i, backup in enumerate(backups, 1):
            print(f"{i}. {backup.name}")
        
        # Restaurar el más reciente
        restaurar_respaldo(backups[0].name)
    else:
        print("❌ No hay backups disponibles")