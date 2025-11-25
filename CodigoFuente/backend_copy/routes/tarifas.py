# routes/tarifas.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
from decimal import Decimal
from models.tarifa import Tarifa
from models.user import UsuarioSistema
from models.role import RolAccion
from schemas.tarifa import TarifaCreate, TarifaUpdate, TarifaResponse, TarifaStats
from utils.notifications import registrar_notificacion
from utils.audit_logger import registrar_auditoria
from db.session import SessionLocal
from security.jwt import verify_token
import unicodedata

import unicodedata
import re

router = APIRouter(prefix="/tarifas", tags=["tarifas"])

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
    """
    module = module.lower().strip()
    action = action.lower().strip() if action else None

    permisos = db.query(RolAccion).filter(
        RolAccion.id_rol == user.id_rol,
        RolAccion.activo == True
    ).all()

    acciones_usuario = set()

    for permiso in permisos:
        if not permiso.nombre_accion:
            continue

        perm_module = permiso.nombre_accion.lower().strip()
        perm_action = (permiso.tipo_accion or '').lower().strip()

        if perm_module != module:
            continue

        if perm_action in ['crud', 'operaciones crud']:
            return True

        acciones_usuario.add(perm_action)

    if action is None:
        return bool(acciones_usuario)

    if action in ['leer', 'lectura']:
        if any(a in acciones_usuario for a in ['lectura', 'leer', 'crear', 'actualizar', 'eliminar']):
            return True

    return action in acciones_usuario


def require_permission(user: UsuarioSistema, db: Session, module: str, action: str = None):
    """Verifica permiso y lanza excepción si no lo tiene"""
    if not check_permission(user, db, module, action):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"No tienes permisos para {action or 'acceder a'} {module}"
        )


# ============================================================================
# HELPER: Normalizar texto
# ============================================================================
def normalize_text(text: str) -> str:
    """
    Normaliza texto para comparación:
    - convierte a minúsculas
    - elimina espacios extras
    - elimina acentos
    """
    if not text:
        return ""

    text = text.lower().strip()

    # Quitar acentos
    text = ''.join(
        c for c in unicodedata.normalize('NFD', text)
        if unicodedata.category(c) != 'Mn'
    )

    # Quitar espacios internos múltiples
    text = re.sub(r"\s+", " ", text)

    return text

# ========================================
# CRUD TARIFAS
# ========================================

@router.get("/", response_model=List[TarifaResponse])
def listar_tarifas(
    search: Optional[str] = Query(None, description="Buscar por nombre, detalle o tipo"),
    tipo_tarifa: Optional[str] = Query(None, description="Filtrar por tipo de tarifa"),
    activo: Optional[bool] = Query(None, description="Filtrar por estado activo"),
    skip: int = Query(0, ge=0, description="Número de registros a saltar"),
    limit: int = Query(100, ge=1, le=1000, description="Número máximo de registros"),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Lista todas las tarifas con filtros opcionales
    Requiere permiso: tarifas.lectura o tarifas.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "tarifas", "lectura")
    
    query = db.query(Tarifa)
    
    # Filtro de búsqueda
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (Tarifa.nombre.ilike(search_filter)) |
            (Tarifa.detalle.ilike(search_filter)) |
            (Tarifa.tipo_tarifa.ilike(search_filter))
        )
    
    # Filtro por tipo de tarifa
    if tipo_tarifa:
        query = query.filter(Tarifa.tipo_tarifa.ilike(f"%{tipo_tarifa}%"))
    
    # Filtro por estado
    if activo is not None:
        query = query.filter(Tarifa.activo == activo)
    
    # Ordenar por nombre
    query = query.order_by(Tarifa.nombre)
    
    # Paginación
    tarifas = query.offset(skip).limit(limit).all()
    
    return tarifas


@router.get("/stats/count", response_model=TarifaStats)
def obtener_estadisticas_tarifas(
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Obtiene estadísticas de tarifas
    Requiere permiso: tarifas.lectura o tarifas.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "tarifas", "lectura")
    
    total = db.query(Tarifa).count()
    activos = db.query(Tarifa).filter(Tarifa.activo == True).count()
    inactivos = db.query(Tarifa).filter(Tarifa.activo == False).count()
    
    # Obtener tipos únicos
    tipos = db.query(Tarifa.tipo_tarifa).distinct().all()
    tipos_tarifa = [t[0] for t in tipos if t[0]]
    
    return {
        "total": total,
        "activos": activos,
        "inactivos": inactivos,
        "tipos_unicos": len(tipos_tarifa),
        "tipos_tarifa": sorted(tipos_tarifa)
    }


@router.get("/{id_tarifa}", response_model=TarifaResponse)
def obtener_tarifa(
    id_tarifa: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Obtiene una tarifa específica por ID
    Requiere permiso: tarifas.lectura o tarifas.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "tarifas", "lectura")
    
    tarifa = db.query(Tarifa).filter(Tarifa.id_tarifa == id_tarifa).first()
    
    if not tarifa:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tarifa no encontrada"
        )
    
    return tarifa


@router.post("/", response_model=TarifaResponse, status_code=status.HTTP_201_CREATED)
def crear_tarifa(
    tarifa: TarifaCreate,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Crea una nueva tarifa
    Requiere permiso: tarifas.crear o tarifas.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "tarifas", "crear")
    
    # Normalizar nombre para verificar duplicados
    nombre_normalizado = normalize_text(tarifa.nombre)

    # Buscar duplicados
    tarifas_existentes = db.query(Tarifa).all()
    for t in tarifas_existentes:
        if normalize_text(t.nombre) == nombre_normalizado:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ya existe una tarifa con el nombre '{tarifa.nombre}'"
            )
    
    # Validar que no haya solapamiento de rangos para el mismo tipo
    if tarifa.limite_max_m3:
        rangos_existentes = db.query(Tarifa).filter(
            Tarifa.tipo_tarifa == tarifa.tipo_tarifa,
            Tarifa.activo == True
        ).all()
        
        for t in rangos_existentes:

            # Caso: una tarifa existente no tiene límite superior
            if t.limite_max_m3 is None:
                if tarifa.limite_min_m3 >= t.limite_min_m3:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=(
                            f"No se puede crear esta tarifa porque el rango "
                            f"se cruza con la tarifa '{t.nombre}', la cual cubre "
                            f"todos los consumos desde {t.limite_min_m3} m³ en adelante."
                        )
                    )

            else:
                # Validar solapamiento de rangos
                if not (tarifa.limite_max_m3 <= t.limite_min_m3 or tarifa.limite_min_m3 >= t.limite_max_m3):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=(
                            f"No se puede crear esta tarifa porque el rango ingresado "
                            f"({tarifa.limite_min_m3}–{tarifa.limite_max_m3} m³) se cruza "
                            f"con el rango de la tarifa existente '{t.nombre}' "
                            f"({t.limite_min_m3}–{t.limite_max_m3} m³)."
                        )
                    )

    
    # Crear nueva tarifa
    nueva_tarifa = Tarifa(
        nombre=tarifa.nombre.strip(),
        detalle=tarifa.detalle.strip() if tarifa.detalle else None,
        precio_por_m3=tarifa.precio_por_m3,
        limite_min_m3=tarifa.limite_min_m3,
        limite_max_m3=tarifa.limite_max_m3,
        tipo_tarifa=tarifa.tipo_tarifa.strip(),
        activo=tarifa.activo
    )
    
    try:
        db.add(nueva_tarifa)
        db.commit()
        db.refresh(nueva_tarifa)
        
        # Registrar auditoría
        registrar_auditoria(
            db=db,
            accion="CREATE",
            descripcion=f"Tarifa '{nueva_tarifa.nombre}' creada por '{payload['sub']}'",
            id_usuario=current_user.id_usuario_sistema
        )
        
        # Crear notificación
        registrar_notificacion(
            db=db,
            id_usuario=current_user.id_usuario_sistema,
            titulo="Tarifa creada",
            mensaje=f"La tarifa '{nueva_tarifa.nombre}' fue creada correctamente.",
            tipo="exito"
        )
        
        return nueva_tarifa
    
    except Exception as e:
        db.rollback()
        print(f"❌ Error al crear tarifa: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear la tarifa: {str(e)}"
        )


@router.put("/{id_tarifa}", response_model=TarifaResponse)
def actualizar_tarifa(
    id_tarifa: int,
    tarifa_update: TarifaUpdate,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Actualiza una tarifa existente
    Requiere permiso: tarifas.actualizar o tarifas.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "tarifas", "actualizar")
    
    # Buscar la tarifa
    tarifa = db.query(Tarifa).filter(Tarifa.id_tarifa == id_tarifa).first()
    
    if not tarifa:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tarifa no encontrada"
        )
    
    # Validar duplicado solo si el nombre cambia
    if tarifa_update.nombre and tarifa_update.nombre != tarifa.nombre:
        nombre_normalizado = normalize_text(tarifa_update.nombre)
        tarifas_existentes = db.query(Tarifa).filter(Tarifa.id_tarifa != id_tarifa).all()
        
        for t in tarifas_existentes:
            if normalize_text(t.nombre) == nombre_normalizado:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Ya existe otra tarifa con el nombre '{tarifa_update.nombre}'"
                )
    
    # Validar rangos si se actualizan los límites
    update_data = tarifa_update.model_dump(exclude_unset=True)
    
    # Verificar coherencia de límites después de la actualización
    limite_min = update_data.get('limite_min_m3', tarifa.limite_min_m3)
    limite_max = update_data.get('limite_max_m3', tarifa.limite_max_m3)
    
    if limite_max is not None and limite_max <= limite_min:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El límite máximo ({limite_max} m³) debe ser mayor que el límite mínimo ({limite_min} m³)"
        )
    
    # Actualizar solo los campos enviados
    for key, value in update_data.items():
        setattr(tarifa, key, value)
    
    try:
        db.commit()
        db.refresh(tarifa)
        
        # Registrar auditoría
        registrar_auditoria(
            db=db,
            accion="UPDATE",
            descripcion=f"Tarifa '{tarifa.nombre}' actualizada por '{payload['sub']}'",
            id_usuario=current_user.id_usuario_sistema
        )
        
        # Crear notificación
        registrar_notificacion(
            db=db,
            id_usuario=current_user.id_usuario_sistema,
            titulo="Tarifa modificada",
            mensaje=f"La tarifa '{tarifa.nombre}' fue modificada correctamente.",
            tipo="info"
        )
        
        return tarifa
    
    except Exception as e:
        db.rollback()
        print(f"❌ Error al actualizar tarifa: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al actualizar la tarifa"
        )


@router.delete("/{id_tarifa}", status_code=status.HTTP_200_OK)
def eliminar_tarifa(
    id_tarifa: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Elimina físicamente la tarifa.
    Si no se puede eliminar por una restricción FK, devuelve un mensaje claro.
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "tarifas", "eliminar")
    
    tarifa = db.query(Tarifa).filter(Tarifa.id_tarifa == id_tarifa).first()
    
    if not tarifa:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tarifa no encontrada"
        )
    
    try:
        # Intentar eliminar
        db.delete(tarifa)
        db.commit()

        registrar_auditoria(
            db=db,
            accion="DELETE",
            descripcion=f"Tarifa '{tarifa.nombre}' eliminada por '{payload['sub']}'",
            id_usuario=current_user.id_usuario_sistema
        )

        registrar_notificacion(
            db=db,
            id_usuario=current_user.id_usuario_sistema,
            titulo="Tarifa eliminada",
            mensaje=f"La tarifa '{tarifa.nombre}' fue eliminada correctamente.",
            tipo="info"
        )

        return {
            "success": True,
            "accion": "eliminado",
            "message": f"Tarifa '{tarifa.nombre}' eliminada correctamente."
        }

    except IntegrityError:
        db.rollback()

        return {
            "success": False,
            "accion": "no_eliminado",
            "message": (
                f"⚠️ NO se puede eliminar la tarifa '{tarifa.nombre}' porque "
                "está relacionada con facturas u otros elementos del sistema. "
                "Elimine esas relaciones antes de intentar borrar esta tarifa."
            )
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error inesperado al intentar eliminar la tarifa."
        )


@router.patch("/{id_tarifa}/toggle-status", response_model=TarifaResponse)
def toggle_tarifa_status(
    id_tarifa: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Activa/Desactiva una tarifa
    Requiere permiso: tarifas.actualizar o tarifas.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "tarifas", "actualizar")
    
    tarifa = db.query(Tarifa).filter(Tarifa.id_tarifa == id_tarifa).first()
    
    if not tarifa:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tarifa no encontrada"
        )
    
    # Cambiar estado
    tarifa.activo = not tarifa.activo
    estado_texto = "activada" if tarifa.activo else "desactivada"
    
    try:
        db.commit()
        db.refresh(tarifa)
        
        # Registrar auditoría
        registrar_auditoria(
            db=db,
            accion="UPDATE",
            descripcion=f"Tarifa '{tarifa.nombre}' fue {estado_texto} por '{payload['sub']}'",
            id_usuario=current_user.id_usuario_sistema
        )
        
        return tarifa
    
    except Exception as e:
        db.rollback()
        print(f"❌ Error al cambiar estado de la tarifa: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al cambiar el estado de la tarifa"
        )


# ========================================
# ENDPOINTS ADICIONALES
# ========================================

@router.get("/tipos/list")
def listar_tipos_tarifa(
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Lista todos los tipos de tarifa únicos
    Requiere permiso: tarifas.lectura o tarifas.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "tarifas", "lectura")
    
    tipos = db.query(Tarifa.tipo_tarifa).distinct().all()
    tipos_tarifa = sorted([t[0] for t in tipos if t[0]])
    
    return {
        "tipos_tarifa": tipos_tarifa,
        "total": len(tipos_tarifa)
    }


@router.get("/tipo/{tipo_tarifa}", response_model=List[TarifaResponse])
def obtener_tarifas_por_tipo(
    tipo_tarifa: str,
    activo: Optional[bool] = Query(None, description="Filtrar por estado activo"),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Obtiene todas las tarifas de un tipo específico
    Requiere permiso: tarifas.lectura o tarifas.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "tarifas", "lectura")
    
    query = db.query(Tarifa).filter(Tarifa.tipo_tarifa == tipo_tarifa)
    
    if activo is not None:
        query = query.filter(Tarifa.activo == activo)
    
    query = query.order_by(Tarifa.limite_min_m3)
    
    tarifas = query.all()
    
    if not tarifas:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No se encontraron tarifas del tipo '{tipo_tarifa}'"
        )
    
    return tarifas