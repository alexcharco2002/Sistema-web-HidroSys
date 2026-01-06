"""
app/routers/backups.py
Router para gestión de backups de base de datos
Sigue el patrón del router de sectores con permisos granulares
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from pathlib import Path
import os
from dotenv import load_dotenv
from pathlib import Path
import subprocess

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
PG_DUMP_PATH = r"C:\Program Files\PostgreSQL\17\bin\pg_dump.exe"
PG_RESTORE_PATH = r"C:\Program Files\PostgreSQL\17\bin\pg_restore.exe"

# Directorio de backups
BASE_DIR = Path(__file__).resolve().parent.parent  # /backend
BACKUP_DIR = BASE_DIR / os.getenv("BACKUP_DIR", "backups")

# Crear carpeta si no existe
BACKUP_DIR.mkdir(parents=True, exist_ok=True)

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
    
    backup_path = BACKUP_DIR / restore_data.filename
    
    # Verificar que el archivo existe
    if not backup_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Backup no encontrado: {restore_data.filename}"
        )
    
    # Verificar que es un archivo .dump
    if not restore_data.filename.endswith('.dump'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo se pueden restaurar archivos .dump"
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
        
        # ✅ PASO 5: Comando de restauración
        comando = [
            PG_RESTORE_PATH,
            "-h", DB_HOST,
            "-p", str(DB_PORT),
            "-U", DB_USER,
            "-d", DB_NAME,
            "-c",  # limpia la base
            "--if-exists",
            "--disable-triggers",  # evita errores de FK
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
        if result.returncode == 0 or "ERROR" not in result.stderr.upper():
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
    
    backup_path = BACKUP_DIR / filename
    
    # Verificar que el archivo existe
    if not backup_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Backup no encontrado: {filename}"
        )
    
    # Verificar que es un archivo .dump
    if not filename.endswith('.dump'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo se pueden eliminar archivos .dump"
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
    
    backup_path = BACKUP_DIR / filename
    
    # Verificar que el archivo existe
    if not backup_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Backup no encontrado: {filename}"
        )
    
    # Verificar que es un archivo .dump
    if not filename.endswith('.dump'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo se pueden descargar archivos .dump"
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