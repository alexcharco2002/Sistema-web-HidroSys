"""
routers/backups.py
Router para gestión de backups de base de datos
Sigue el patrón del router de sectores con permisos granulares
"""

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from pathlib import Path
import os
from dotenv import load_dotenv
import subprocess
import re

from db.session import SessionLocal
from security.jwt import verify_token
from models.user import UsuarioSistema
from models.role import RolAccion
from utils.audit_logger import registrar_auditoria
from utils.notifications import registrar_notificacion
from pydantic import BaseModel

from sqlalchemy import text

def cerrar_conexiones(db_name: str, db: Session):
    db.execute(
        text(
            f"SELECT pg_terminate_backend(pid) "
            f"FROM pg_stat_activity "
            f"WHERE datname='{db_name}' AND pid <> pg_backend_pid();"
        )
    )
    db.commit()


router = APIRouter(prefix="/backups", tags=["Backups"])

# ========================================
# CONFIGURACIÓN
# ========================================

load_dotenv()

DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")

# Rutas de herramientas PostgreSQL
PG_DUMP_PATH = os.getenv("PG_DUMP_PATH", "pg_dump")


def resolve_pg_tool(tool_name: str, configured_path: str = None) -> str:
    if configured_path:
        return configured_path

    dump_path = Path(PG_DUMP_PATH)
    if dump_path.name.lower().startswith("pg_dump"):
        suffix = ".exe" if os.name == "nt" else ""
        candidate = dump_path.with_name(f"{tool_name}{suffix}")
        if candidate.exists():
            return str(candidate)

    return tool_name


PG_RESTORE_PATH = resolve_pg_tool("pg_restore", os.getenv("PG_RESTORE_PATH"))
PG_PSQL_PATH = resolve_pg_tool("psql", os.getenv("PG_PSQL_PATH"))

# Directorio de backups
PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKUP_DIR_CONFIG = Path(os.getenv("BACKUP_DIR", "backups"))
BACKUP_DIR = BACKUP_DIR_CONFIG if BACKUP_DIR_CONFIG.is_absolute() else PROJECT_ROOT / BACKUP_DIR_CONFIG

# Crear carpeta si no existe
BACKUP_DIR.mkdir(parents=True, exist_ok=True)

MAX_UPLOAD_MB = int(os.getenv("BACKUP_UPLOAD_MAX_MB", "200"))
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024
SAFE_FILENAME_RE = re.compile(r"[^A-Za-z0-9_.-]+")
SAFE_IDENTIFIER_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")

# ========================================
# DEPENDENCIAS
# ========================================

def get_db():
    """Dependencia para obtener la sesión de base de datos"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ========================================
# HELPER: Obtener usuario actual desde el token
# ========================================
def get_current_user(payload: dict, db: Session) -> UsuarioSistema:
    """Obtiene el usuario actual desde el payload del JWT"""
    user = db.query(UsuarioSistema).filter(
        UsuarioSistema.usuario == payload["sub"]
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado"
        )
    
    return user

# ========================================
# HELPER: Verificar permisos de usuario
# ========================================
def check_permission(user: UsuarioSistema, db: Session, module: str, action: str = None) -> bool:
    """
    Verifica si el usuario tiene permiso para una acción.
    
    Si el usuario tiene permiso de crear, actualizar o eliminar, 
    automáticamente también se le concede permiso de lectura.
    """
    # Normalizar
    module = module.lower().strip()
    action = action.lower().strip() if action else None

    permisos = db.query(RolAccion).filter(
        RolAccion.id_rol == user.id_rol,
        RolAccion.activo == True
    ).all()

    # Determinar todas las acciones que el usuario tiene sobre el módulo
    acciones_usuario = set()

    for permiso in permisos:
        if not permiso.nombre_accion:
            continue

        perm_module = permiso.nombre_accion.lower().strip()
        perm_action = (permiso.tipo_accion or '').lower().strip()

        if perm_module != module:
            continue

        if perm_action in ['crud', 'operaciones crud']:
            # Acceso completo
            return True

        acciones_usuario.add(perm_action)

    # ✅ Si no se pide acción específica, basta con que tenga cualquier permiso
    if action is None:
        return bool(acciones_usuario)

    # ✅ Si la acción es "lectura", damos acceso si tiene lectura o cualquier otro CRUD
    if action in ['leer', 'lectura']:
        if any(a in acciones_usuario for a in ['lectura', 'leer', 'crear', 'actualizar', 'eliminar']):
            return True

    # ✅ Caso normal: la acción debe coincidir exactamente
    return action in acciones_usuario


def require_permission(user: UsuarioSistema, db: Session, module: str, action: str = None):
    """
    Verifica permiso y lanza excepción si no lo tiene
    """
    if not check_permission(user, db, module, action):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"No tienes permisos para {action or 'acceder a'} {module}"
        )

# ========================================
# MODELOS PYDANTIC
# ========================================

class BackupInfo(BaseModel):
    filename: str
    size: int
    created_at: str
    
class BackupResponse(BaseModel):
    success: bool
    message: str
    filename: str = None
    
class BackupListResponse(BaseModel):
    success: bool
    data: List[BackupInfo]
    total: int

class RestoreBackupRequest(BaseModel):
    filename: str

# ========================================
# FUNCIONES AUXILIARES
# ========================================

def get_backup_files():
    """Obtener lista de archivos de backup disponibles"""
    backups = []
    
    for file in BACKUP_DIR.glob("*.dump"):
        stat = file.stat()
        backups.append({
            "filename": file.name,
            "size": stat.st_size,
            "created_at": datetime.fromtimestamp(stat.st_mtime).isoformat()
        })
    
    # Ordenar por fecha de creación (más reciente primero)
    backups.sort(key=lambda x: x["created_at"], reverse=True)
    
    return backups


def sanitize_backup_filename(filename: str) -> str:
    original_name = Path(filename or "").name.strip()

    if not original_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debe seleccionar un archivo de respaldo"
        )

    if Path(original_name).suffix.lower() != ".dump":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo se permiten archivos .dump"
        )

    safe_name = SAFE_FILENAME_RE.sub("_", original_name)
    safe_name = safe_name.strip("._")

    if not safe_name or Path(safe_name).suffix.lower() != ".dump":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nombre de archivo de respaldo no válido"
        )

    return safe_name


def get_available_backup_path(filename: str) -> Path:
    backup_path = BACKUP_DIR / filename
    if not backup_path.exists():
        return backup_path

    stem = Path(filename).stem
    suffix = Path(filename).suffix
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return BACKUP_DIR / f"{stem}_{timestamp}{suffix}"


def get_backup_path_from_filename(filename: str) -> Path:
    safe_name = sanitize_backup_filename(filename)
    backup_path = (BACKUP_DIR / safe_name).resolve()
    backup_root = BACKUP_DIR.resolve()

    if backup_root not in backup_path.parents and backup_path != backup_root:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nombre de archivo de respaldo no válido"
        )

    return backup_path


def validate_custom_dump(backup_path: Path):
    result = subprocess.run(
        [PG_RESTORE_PATH, "-l", str(backup_path)],
        capture_output=True,
        text=True,
        timeout=60
    )

    if result.returncode != 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo no es un respaldo PostgreSQL válido en formato .dump"
        )


def quote_identifier(identifier: str) -> str:
    if not SAFE_IDENTIFIER_RE.match(identifier):
        raise ValueError(f"Identificador no válido en el respaldo: {identifier}")

    return f'"{identifier}"'


def get_restore_cleanup_sql(backup_path: Path) -> str:
    result = subprocess.run(
        [PG_RESTORE_PATH, "-l", str(backup_path)],
        capture_output=True,
        text=True,
        timeout=60
    )

    if result.returncode != 0:
        raise Exception(result.stderr or "No se pudo leer el índice del respaldo")

    schemas = []
    public_tables = []
    public_sequences = []
    public_functions = []

    for raw_line in result.stdout.splitlines():
        line = raw_line.strip()
        if not line or line.startswith(";"):
            continue

        parts = line.split()
        if len(parts) < 6:
            continue

        object_type = parts[3]

        if object_type == "SCHEMA":
            schema_name = parts[5]
            if schema_name not in {"public", "pg_catalog", "information_schema"}:
                schemas.append(schema_name)
            continue

        object_schema = parts[4]
        object_name = parts[5]

        if object_schema != "public":
            continue

        if object_type == "TABLE":
            public_tables.append(object_name)
        elif object_type == "SEQUENCE":
            public_sequences.append(object_name)
        elif object_type == "FUNCTION":
            public_functions.append(object_name)

    statements = []
    if schemas:
        schema_list = ", ".join(quote_identifier(schema) for schema in sorted(set(schemas)))
        statements.append(f"DROP SCHEMA IF EXISTS {schema_list} CASCADE")

    for function_name in sorted(set(public_functions)):
        if not re.match(r"^[A-Za-z_][A-Za-z0-9_]*\(.*\)$", function_name):
            raise ValueError(f"Función no válida en el respaldo: {function_name}")
        statements.append(f"DROP FUNCTION IF EXISTS public.{function_name} CASCADE")

    for table_name in sorted(set(public_tables)):
        statements.append(f"DROP TABLE IF EXISTS public.{quote_identifier(table_name)} CASCADE")

    for sequence_name in sorted(set(public_sequences)):
        statements.append(f"DROP SEQUENCE IF EXISTS public.{quote_identifier(sequence_name)} CASCADE")

    return "; ".join(statements) + (";" if statements else "")


def limpiar_objetos_antes_de_restaurar(backup_path: Path, env: dict):
    cleanup_sql = get_restore_cleanup_sql(backup_path)
    if not cleanup_sql:
        return

    result = subprocess.run(
        [
            PG_PSQL_PATH,
            "-v", "ON_ERROR_STOP=1",
            "-h", DB_HOST,
            "-p", str(DB_PORT),
            "-U", DB_USER,
            "-d", DB_NAME,
            "-c", cleanup_sql,
        ],
        env=env,
        capture_output=True,
        text=True,
        timeout=180
    )

    if result.returncode != 0:
        raise Exception(result.stderr or "No se pudo limpiar la base antes de restaurar")

# ========================================
# ENDPOINTS
# ========================================

@router.get("/", response_model=BackupListResponse)
def listar_backups(
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Listar todos los backups disponibles
    Requiere permiso: configuracion.lectura o configuracion.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "configuracion", "lectura")
    
    try:
        backups = get_backup_files()
        
        return {
            "success": True,
            "data": backups,
            "total": len(backups)
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al listar backups: {str(e)}"
        )

@router.post("/", response_model=BackupResponse, status_code=status.HTTP_201_CREATED)
def crear_backup(
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Crear un nuevo backup manual de la base de datos
    Requiere permiso: configuracion.crear o configuracion.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "configuracion", "crear")
    
    # Generar nombre de archivo con timestamp
    fecha = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    filename = f"{DB_NAME}_{fecha}.dump"
    backup_path = BACKUP_DIR / filename
    
    # Configurar variable de entorno para la contraseña
    env = os.environ.copy()
    env["PGPASSWORD"] = DB_PASSWORD
    
    # Comando para crear backup
    comando = [
        PG_DUMP_PATH,
        "-h", DB_HOST,
        "-p", DB_PORT,
        "-U", DB_USER,
        "-F", "c",  # formato personalizado comprimido
        "-b",       # incluye blobs
        "-f", str(backup_path),
        DB_NAME,
    ]
    
    try:
        # Ejecutar pg_dump
        result = subprocess.run(
            comando,
            env=env,
            capture_output=True,
            text=True,
            timeout=300  # 5 minutos de timeout
        )
        
        if result.returncode != 0:
            error_msg = result.stderr or "Error desconocido al crear backup"
            raise Exception(error_msg)
        
        # Verificar que el archivo se creó
        if not backup_path.exists():
            raise Exception("El archivo de backup no se creó correctamente")
        
        # ✅ Registrar auditoría
        registrar_auditoria(
            db=db,
            accion="CREATE_BACKUP",
            descripcion=f"Backup manual creado: {filename}",
            id_usuario=current_user.id_usuario_sistema
        )
        
        # ✅ Crear notificación
        registrar_notificacion(
            db=db,
            id_usuario=current_user.id_usuario_sistema,
            titulo="Backup creado",
            mensaje=f"El backup '{filename}' fue creado correctamente.",
            tipo="exito"
        )
        
        return {
            "success": True,
            "message": f"Backup creado exitosamente: {filename}",
            "filename": filename
        }
        
    except subprocess.TimeoutExpired:
        # Eliminar archivo parcial si existe
        if backup_path.exists():
            backup_path.unlink()
            
        raise HTTPException(
            status_code=status.HTTP_408_REQUEST_TIMEOUT,
            detail="La creación del backup tardó demasiado tiempo"
        )
    except Exception as e:
        # Eliminar archivo parcial si existe
        if backup_path.exists():
            backup_path.unlink()
            
        print(f"❌ Error al crear backup: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear backup: {str(e)}"
        )


@router.post("/upload", response_model=BackupResponse, status_code=status.HTTP_201_CREATED)
async def subir_backup(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Subir un archivo .dump local para dejarlo disponible en la lista de respaldos.
    Requiere permiso: configuracion.crear o configuracion.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "configuracion", "crear")

    filename = sanitize_backup_filename(file.filename)
    backup_path = get_available_backup_path(filename)
    bytes_written = 0

    try:
        with backup_path.open("wb") as buffer:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break

                bytes_written += len(chunk)
                if bytes_written > MAX_UPLOAD_BYTES:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"El respaldo supera el tamaño máximo permitido de {MAX_UPLOAD_MB} MB"
                    )

                buffer.write(chunk)

        if bytes_written == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El archivo de respaldo está vacío"
            )

        validate_custom_dump(backup_path)

        registrar_auditoria(
            db=db,
            accion="UPLOAD_BACKUP",
            descripcion=f"Backup subido: {backup_path.name}",
            id_usuario=current_user.id_usuario_sistema
        )

        registrar_notificacion(
            db=db,
            id_usuario=current_user.id_usuario_sistema,
            titulo="Backup subido",
            mensaje=f"El backup '{backup_path.name}' fue subido correctamente.",
            tipo="exito"
        )

        return {
            "success": True,
            "message": f"Backup subido correctamente: {backup_path.name}",
            "filename": backup_path.name
        }

    except HTTPException:
        if backup_path.exists():
            backup_path.unlink()
        raise
    except subprocess.TimeoutExpired:
        if backup_path.exists():
            backup_path.unlink()
        raise HTTPException(
            status_code=status.HTTP_408_REQUEST_TIMEOUT,
            detail="La validación del backup tardó demasiado tiempo"
        )
    except Exception as e:
        if backup_path.exists():
            backup_path.unlink()
        print(f"Error al subir backup: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al subir backup: {str(e)}"
        )


@router.put("/restore", response_model=BackupResponse)
def restaurar_backup(
    restore_data: RestoreBackupRequest,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Restaurar la base de datos desde un backup
    ⚠️ ADVERTENCIA: Esta operación reemplaza todos los datos actuales
    Requiere permiso: configuracion.actualizar o configuracion.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "configuracion", "actualizar")
    
    # ✅ CRÍTICO: Guardar ID del usuario ANTES de cerrar la sesión
    user_id = current_user.id_usuario_sistema
    username = current_user.usuario
    
    backup_path = get_backup_path_from_filename(restore_data.filename)
    
    # Verificar que el archivo existe
    if not backup_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Backup no encontrado: {restore_data.filename}"
        )
    
    try:
        # ✅ PASO 1: Registrar auditoría ANTES de cerrar conexiones
        registrar_auditoria(
            db=db,
            accion="RESTORE_BACKUP_INICIADO",
            descripcion=f"Iniciando restauración desde: {restore_data.filename}",
            id_usuario=user_id  # ✅ Usar el ID guardado
        )
        
        # ✅ PASO 2: Cerrar TODAS las conexiones activas
        print(f"🔄 Cerrando conexiones activas a {DB_NAME}...")
        try:
            cerrar_conexiones(DB_NAME, db)
        except Exception as e:
            print(f"⚠️ Advertencia al cerrar conexiones: {e}")
        
        # ✅ PASO 3: Cerrar la sesión de SQLAlchemy ANTES de restaurar
        db.close()
        
        # ✅ PASO 4: Configurar entorno con contraseña
        env = os.environ.copy()
        env["PGPASSWORD"] = DB_PASSWORD

        # Limpiar previamente los objetos incluidos en el respaldo.
        # Evita errores de dependencias cruzadas al restaurar con pg_restore -c.
        limpiar_objetos_antes_de_restaurar(backup_path, env)
        
        # ✅ PASO 5: Comando de restauración
        comando = [
            PG_RESTORE_PATH,
            "-h", DB_HOST,
            "-p", str(DB_PORT),
            "-U", DB_USER,
            "-d", DB_NAME,
            "--no-owner",
            "--no-acl",
            str(backup_path),
        ]
        
        print(f"🔄 Restaurando backup: {restore_data.filename}")
        
        # ✅ PASO 6: Ejecutar pg_restore
        result = subprocess.run(
            comando,
            env=env,
            capture_output=True,
            text=True,
            timeout=600  # 10 minutos
        )
        
        # ✅ PASO 7: Evaluar resultado
        if result.returncode == 0:
            print(f"✅ Base de datos restaurada exitosamente")
            
            # ✅ PASO 8: Crear NUEVA sesión para registrar éxito
            new_db = SessionLocal()
            try:
                registrar_auditoria(
                    db=new_db,
                    accion="RESTORE_BACKUP",
                    descripcion=f"Base de datos restaurada desde: {restore_data.filename} por {username}",
                    id_usuario=user_id  # ✅ Usar el ID guardado, no current_user
                )
                
                registrar_notificacion(
                    db=new_db,
                    id_usuario=user_id,  # ✅ Usar el ID guardado
                    titulo="✅ Backup Restaurado",
                    mensaje=f"La base de datos fue restaurada exitosamente desde '{restore_data.filename}'.",
                    tipo="info"
                )
                
                new_db.commit()  # ✅ Confirmar los cambios
                
            except Exception as e:
                print(f"⚠️ Error al registrar auditoría final: {e}")
                new_db.rollback()
            finally:
                new_db.close()
            
            return {
                "success": True,
                "message": f"Base de datos restaurada exitosamente desde: {restore_data.filename}",
                "filename": restore_data.filename
            }
        else:
            # Error real en la restauración
            print(f"❌ Error al restaurar: {result.stderr}")
            raise Exception(result.stderr)
    
    except subprocess.TimeoutExpired:
        print("❌ Timeout en la restauración")
        
        # Registrar timeout en nueva sesión
        try:
            new_db = SessionLocal()
            registrar_auditoria(
                db=new_db,
                accion="RESTORE_BACKUP_TIMEOUT",
                descripcion=f"Timeout al restaurar {restore_data.filename}",
                id_usuario=user_id
            )
            new_db.commit()
            new_db.close()
        except:
            pass
        
        raise HTTPException(
            status_code=status.HTTP_408_REQUEST_TIMEOUT,
            detail="La restauración del backup tardó demasiado tiempo"
        )
    
    except Exception as e:
        error_msg = str(e)
        print(f"❌ Error al restaurar backup: {error_msg}")
        
        # Intentar registrar el error en nueva sesión
        try:
            new_db = SessionLocal()
            registrar_auditoria(
                db=new_db,
                accion="RESTORE_BACKUP_ERROR",
                descripcion=f"Error al restaurar {restore_data.filename}: {error_msg}",
                id_usuario=user_id
            )
            
            registrar_notificacion(
                db=new_db,
                id_usuario=user_id,
                titulo="❌ Error en Restauración",
                mensaje=f"Error al restaurar '{restore_data.filename}': {error_msg}",
                tipo="error"
            )
            
            new_db.commit()
            new_db.close()
        except Exception as audit_error:
            print(f"⚠️ No se pudo registrar error en auditoría: {audit_error}")
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al restaurar backup: {error_msg}"
        )


@router.delete("/{filename}", response_model=BackupResponse)
def eliminar_backup(
    filename: str,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Eliminar un archivo de backup
    Requiere permiso: configuracion.eliminar o configuracion.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "configuracion", "eliminar")
    
    backup_path = get_backup_path_from_filename(filename)
    
    # Verificar que el archivo existe
    if not backup_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Backup no encontrado: {filename}"
        )
    
    try:
        # Eliminar archivo
        backup_path.unlink()
        
        # ✅ Registrar auditoría
        registrar_auditoria(
            db=db,
            accion="DELETE_BACKUP",
            descripcion=f"Backup eliminado: {filename}",
            id_usuario=current_user.id_usuario_sistema
        )
        
        # ✅ Crear notificación
        registrar_notificacion(
            db=db,
            id_usuario=current_user.id_usuario_sistema,
            titulo="Backup eliminado",
            mensaje=f"El backup '{filename}' fue eliminado correctamente.",
            tipo="info"
        )
        
        return {
            "success": True,
            "message": f"Backup eliminado exitosamente: {filename}",
            "filename": filename
        }
        
    except Exception as e:
        print(f"❌ Error al eliminar backup: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al eliminar backup: {str(e)}"
        )

@router.get("/download/{filename}")
def descargar_backup(
    filename: str,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Descargar un archivo de backup
    Requiere permiso: configuracion.lectura o configuracion.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "configuracion", "lectura")
    
    backup_path = get_backup_path_from_filename(filename)
    
    # Verificar que el archivo existe
    if not backup_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Backup no encontrado: {filename}"
        )
    
    # ✅ Registrar auditoría
    registrar_auditoria(
        db=db,
        accion="DOWNLOAD_BACKUP",
        descripcion=f"Backup descargado: {filename}",
        id_usuario=current_user.id_usuario_sistema
    )
    
    # ✅ Crear notificación
    registrar_notificacion(
        db=db,
        id_usuario=current_user.id_usuario_sistema,
        titulo="Backup descargado",
        mensaje=f"El backup '{filename}' fue descargado.",
        tipo="info"
    )
    
    return FileResponse(
        path=backup_path,
        filename=filename,
        media_type="application/octet-stream"
    )

# ========================================
# ENDPOINTS ADICIONALES
# ========================================

@router.get("/stats/info")
def obtener_estadisticas_backups(
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Obtiene estadísticas de backups
    Requiere permiso: configuracion.lectura o configuracion.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "configuracion", "lectura")
    
    try:
        backups = get_backup_files()
        
        total_size = sum(b['size'] for b in backups)
        ultimo_backup = backups[0] if backups else None
        
        return {
            "success": True,
            "total": len(backups),
            "total_size": total_size,
            "total_size_mb": round(total_size / (1024 * 1024), 2),
            "ultimo_backup": ultimo_backup['filename'] if ultimo_backup else None,
            "ultima_fecha": ultimo_backup['created_at'] if ultimo_backup else None
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener estadísticas: {str(e)}"
        )
