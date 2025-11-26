# routes/sectors.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from psycopg2.errors import ForeignKeyViolation, NotNullViolation
from typing import List, Optional
from models.sector import Sector
from models.user import UsuarioSistema
from models.role import RolAccion
from schemas.sector import SectorCreate, SectorUpdate, SectorResponse
from schemas.notification import NotificacionCreate
from utils.notifications import registrar_notificacion
from utils.audit_logger import registrar_auditoria
from db.session import SessionLocal
from security.jwt import verify_token

import unicodedata, re

router = APIRouter(prefix="/sectors", tags=["sectors"])

def get_db():
    """Dependencia para obtener la sesión de base de datos"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ============================================================================
# HELPER: Obtener usuario actual desde el token
# ============================================================================
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

# ============================================================================
# HELPER: Verificar permisos de usuario
# ============================================================================
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
# CRUD SECTORES
# ========================================

@router.get("/", response_model=List[SectorResponse])
def listar_sectores(
    search: Optional[str] = Query(None, description="Buscar por nombre o descripción"),
    activo: Optional[bool] = Query(None, description="Filtrar por estado activo"),
    skip: int = Query(0, ge=0, description="Número de registros a saltar"),
    limit: int = Query(100, ge=1, le=1000, description="Número máximo de registros"),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Lista todos los sectores con filtros opcionales
    Requiere permiso: sectores.lectura o sectores.crud
    """
    # Obtener usuario actual y verificar permisos
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "sectores", "lectura")
    
    query = db.query(Sector)
    
    # Filtro de búsqueda
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (Sector.nombre_sector.ilike(search_filter)) |
            (Sector.descripcion.ilike(search_filter))
        )
    
    # Filtro por estado
    if activo is not None:
        query = query.filter(Sector.activo == activo)
    
    # Ordenar por nombre
    query = query.order_by(Sector.nombre_sector)
    
    # Paginación
    sectores = query.offset(skip).limit(limit).all()
    
    return sectores

@router.get("/{id_sector}", response_model=SectorResponse)
def obtener_sector(
    id_sector: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Obtiene un sector específico por ID
    Requiere permiso: sectores.lectura o sectores.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "sectores", "lectura")
    
    sector = db.query(Sector).filter(Sector.id_sector == id_sector).first()
    
    if not sector:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sector no encontrado"
        )
    
    return sector
# para normalizar textos y validar 
def normalize_text(text: str) -> str:
    """
    Normaliza texto para comparación:
    - convierte a minúsculas
    - elimina espacios extras
    - elimina acentos
    - reduce múltiple espacios a uno
    """
    if not text:
        return ""

    # Convertir a minúsculas
    text = text.lower().strip()

    # Quitar acentos
    text = ''.join(
        c for c in unicodedata.normalize('NFD', text)
        if unicodedata.category(c) != 'Mn'
    )

    # Quitar espacios internos múltiples
    text = re.sub(r"\s+", " ", text)

    return text

@router.post("/", response_model=SectorResponse, status_code=status.HTTP_201_CREATED)
def crear_sector(
    sector: SectorCreate,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Crea un nuevo sector
    Requiere permiso: sectores.crear o sectores.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "sectores", "crear")
    
     # Normalizar nombre
    nombre_normalizado = normalize_text(sector.nombre_sector)

    # Buscar duplicados normalizando en SQL también
    sectores = db.query(Sector).all()

    for s in sectores:
        if normalize_text(s.nombre_sector) == nombre_normalizado:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ya existe un sector con el nombre '{sector.nombre_sector}'"
            )

    # Crear nuevo sector
    nuevo_sector = Sector(
        nombre_sector=sector.nombre_sector.strip()
    )
    
    try:
        db.add(nuevo_sector)
        db.commit()
        db.refresh(nuevo_sector)
        
        # ✅ Registrar auditoría
        registrar_auditoria(
            db=db,
            accion="CREATE",
            descripcion=f"Sector '{nuevo_sector.nombre_sector}' creado por '{payload['sub']}'",
            id_usuario=current_user.id_usuario_sistema
        )
        
        # ✅ Crear notificación
        registrar_notificacion(
            db=db,
            id_usuario=current_user.id_usuario_sistema,
            titulo="Sector creado",
            mensaje=f"El sector '{nuevo_sector.nombre_sector}' fue creado correctamente.",
            tipo="exito"
        )
        
        return nuevo_sector
    
    except Exception as e:
        db.rollback()
        print(f"❌ Error al crear sector: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear el sector: {str(e)}"
        )

@router.put("/{id_sector}", response_model=SectorResponse)
def actualizar_sector(
    id_sector: int,
    sector_update: SectorUpdate,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Actualiza un sector existente
    Requiere permiso: sectores.actualizar o sectores.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "sectores", "actualizar")
    
    # Buscar el sector
    sector = db.query(Sector).filter(Sector.id_sector == id_sector).first()
    
    if not sector:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sector no encontrado"
        )
    
    # Validar duplicado solo si el nombre cambia
    if sector_update.nombre_sector and sector_update.nombre_sector != sector.nombre_sector:
        existe = db.query(Sector).filter(
            Sector.nombre_sector == sector_update.nombre_sector,
            Sector.id_sector != id_sector
        ).first()
        
        if existe:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ya existe otro sector con el nombre '{sector_update.nombre_sector}'"
            )
    
    # Actualizar solo los campos enviados
    update_data = sector_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(sector, key, value)
    
    try:
        db.commit()
        db.refresh(sector)
        
        # ✅ Registrar auditoría
        registrar_auditoria(
            db=db,
            accion="UPDATE",
            descripcion=f"Sector '{sector.nombre_sector}' actualizado por '{payload['sub']}'",
            id_usuario=current_user.id_usuario_sistema
        )
        
        # ✅ Crear notificación
        registrar_notificacion(
            db=db,
            id_usuario=current_user.id_usuario_sistema,
            titulo="Sector modificado",
            mensaje=f"El sector '{sector.nombre_sector}' fue modificado correctamente.",
            tipo="info"
        )
        
        return sector
    
    except Exception as e:
        db.rollback()
        print(f"❌ Error al actualizar sector: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al actualizar el sector"
        )

@router.delete("/{id_sector}", status_code=status.HTTP_200_OK)
def eliminar_sector(
    id_sector: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Elimina físicamente el sector.
    Si no se puede eliminar por una restricción FK, devuelve un mensaje
    claro indicando qué lo bloquea.
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "sectores", "eliminar")
    
    sector = db.query(Sector).filter(Sector.id_sector == id_sector).first()
    
    if not sector:
        raise HTTPException(
            status_code=404,
            detail="Sector no encontrado"
        )
    
    try:
        # Intentar eliminar
        db.delete(sector)
        db.commit()

        registrar_auditoria(
            db=db,
            accion="DELETE",
            descripcion=f"Sector '{sector.nombre_sector}' eliminado por '{payload['sub']}'",
            id_usuario=current_user.id_usuario_sistema
        )

        registrar_notificacion(
            db=db,
            id_usuario=current_user.id_usuario_sistema,
            titulo="Sector eliminado",
            mensaje=f"El sector '{sector.nombre_sector}' fue eliminado correctamente.",
            tipo="info"
        )

        return {
            "success": True,
            "accion": "eliminado",
            "message": f"Sector '{sector.nombre_sector}' eliminado correctamente."
        }

    except IntegrityError as e:
        db.rollback()

        return {
            "success": False,
            "accion": "no_eliminado",
            "message": (
                f"⚠️ NO se puede eliminar el sector '{sector.nombre_sector}' porque "
                "está relacionado con otros modulos del sistema. Elimine esos elementos antes "
                "de intentar borrar este sector."
            )
        }

    except Exception as e:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Error inesperado al intentar eliminar el sector."
        )


@router.patch("/{id_sector}/toggle-status", response_model=SectorResponse)
def toggle_sector_status(
    id_sector: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Activa/Desactiva un sector
    Requiere permiso: sectores.actualizar o sectores.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "sectores", "actualizar")
    
    sector = db.query(Sector).filter(Sector.id_sector == id_sector).first()
    
    if not sector:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sector no encontrado"
        )
    
    # Cambiar estado
    sector.activo = not sector.activo
    estado_texto = "activado" if sector.activo else "desactivado"
    
    try:
        db.commit()
        db.refresh(sector)
        
        # ✅ Registrar auditoría
        registrar_auditoria(
            db=db,
            accion="UPDATE",
            descripcion=f"Sector '{sector.nombre_sector}' fue {estado_texto} por '{payload['sub']}'",
            id_usuario=current_user.id_usuario_sistema
        )
        
        return sector
    
    except Exception as e:
        db.rollback()
        print(f"❌ Error al cambiar estado del sector: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al cambiar el estado del sector"
        )

# ========================================
# ENDPOINTS ADICIONALES
# ========================================

@router.get("/stats/count")
def obtener_estadisticas_sectores(
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Obtiene estadísticas de sectores
    Requiere permiso: sectores.lectura o sectores.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "sectores", "lectura")
    
    total = db.query(Sector).count()
    activos = db.query(Sector).filter(Sector.activo == True).count()
    inactivos = db.query(Sector).filter(Sector.activo == False).count()
    
    return {
        "total": total,
        "activos": activos,
        "inactivos": inactivos
    }