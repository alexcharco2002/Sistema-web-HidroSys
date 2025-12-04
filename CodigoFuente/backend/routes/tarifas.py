# routes/tarifas.py

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
from datetime import datetime
from decimal import Decimal
from models.tarifa import Tarifa
from models.user import UsuarioSistema
from models.role import RolAccion
from schemas.tarifa import (
    TarifaCreate, TarifaUpdate, TarifaResponse, 
    TarifaStats, TarifaHistorialResponse
)
from utils.notifications import registrar_notificacion
from utils.audit_logger import registrar_auditoria
from db.session import SessionLocal
from security.jwt import verify_token
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

def check_permission(user: UsuarioSistema, db: Session, module: str, action: str = None) -> bool:
    """Verifica si el usuario tiene permiso para una acción"""
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

def normalize_text(text: str) -> str:
    """Normaliza texto para comparación"""
    if not text:
        return ""
    text = text.lower().strip()
    text = ''.join(
        c for c in unicodedata.normalize('NFD', text)
        if unicodedata.category(c) != 'Mn'
    )
    text = re.sub(r"\s+", " ", text)
    return text


# ========================================
# LISTAR TARIFAS VIGENTES
# ========================================
@router.get("/", response_model=List[TarifaResponse])
def listar_tarifas(
    search: Optional[str] = Query(None, description="Buscar por nombre, detalle o tipo"),
    tipo_tarifa: Optional[str] = Query(None, description="Filtrar por tipo de tarifa"),
    es_vigente: Optional[bool] = Query(True, description="Filtrar por vigencia (por defecto solo vigentes)"),
    activo: Optional[bool] = Query(None, description="Filtrar por estado activo"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Lista tarifas vigentes (por defecto solo muestra las activas)
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "tarifas", "lectura")

    query = db.query(Tarifa)

    # Filtro por vigencia (por defecto solo vigentes)
    if es_vigente is not None:
        query = query.filter(Tarifa.es_vigente == es_vigente)

    # Filtro por activo
    if activo is not None:
        query = query.filter(Tarifa.activo == activo)

    # Filtro de búsqueda
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (Tarifa.nombre.ilike(search_filter)) |
            (Tarifa.detalle.ilike(search_filter)) |
            (Tarifa.tipo_tarifa.ilike(search_filter))
        )

    # Filtro por tipo
    if tipo_tarifa:
        query = query.filter(Tarifa.tipo_tarifa.ilike(f"%{tipo_tarifa}%"))

    # Ordenar por vigencia y nombre
    query = query.order_by(Tarifa.es_vigente.desc(), Tarifa.nombre, Tarifa.vigencia_desde.desc())

    tarifas = query.offset(skip).limit(limit).all()
    return tarifas


# ========================================
# ESTADÍSTICAS
# ========================================
@router.get("/stats/count", response_model=TarifaStats)
def obtener_estadisticas_tarifas(
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """Obtiene estadísticas de tarifas"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "tarifas", "lectura")

    total = db.query(Tarifa).count()
    vigentes = db.query(Tarifa).filter(Tarifa.es_vigente == True).count()
    vencidas = db.query(Tarifa).filter(Tarifa.es_vigente == False).count()

    tipos = db.query(Tarifa.tipo_tarifa).distinct().all()
    tipos_tarifa = [t[0] for t in tipos if t[0]]

    return {
        "total_versiones": total,
        "tarifas_vigentes": vigentes,
        "tarifas_vencidas": vencidas,
        "tipos_unicos": len(tipos_tarifa),
        "tipos_tarifa": sorted(tipos_tarifa)
    }


# ========================================
# HISTORIAL DE VERSIONES DE UNA TARIFA
# ========================================
@router.get("/historial/{nombre_tarifa}", response_model=List[TarifaHistorialResponse])
def obtener_historial_tarifa(
    nombre_tarifa: str,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Obtiene todas las versiones históricas de una tarifa por su nombre
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "tarifas", "lectura")

    versiones = db.query(Tarifa).filter(
        Tarifa.nombre == nombre_tarifa
    ).order_by(Tarifa.vigencia_desde.desc()).all()

    if not versiones:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No se encontraron versiones de la tarifa '{nombre_tarifa}'"
        )

    return versiones


# ========================================
# LISTAR TIPOS DE TARIFA
# ========================================
@router.get("/tipos/list")
def listar_tipos_tarifa(
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Lista todos los tipos de tarifa únicos
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "tarifas", "lectura")

    tipos = db.query(Tarifa.tipo_tarifa).distinct().all()
    tipos_tarifa = sorted([t[0] for t in tipos if t[0]])

    return {
        "tipos_tarifa": tipos_tarifa,
        "total": len(tipos_tarifa)
    }


# ========================================
# OBTENER TARIFAS POR TIPO
# ========================================
@router.get("/tipo/{tipo_tarifa}", response_model=List[TarifaResponse])
def obtener_tarifas_por_tipo(
    tipo_tarifa: str,
    activo: Optional[bool] = Query(None, description="Filtrar por estado activo"),
    es_vigente: Optional[bool] = Query(True, description="Filtrar por vigencia"),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Obtiene todas las tarifas de un tipo específico
    Por defecto solo muestra las vigentes
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "tarifas", "lectura")

    query = db.query(Tarifa).filter(Tarifa.tipo_tarifa == tipo_tarifa)

    if activo is not None:
        query = query.filter(Tarifa.activo == activo)

    if es_vigente is not None:
        query = query.filter(Tarifa.es_vigente == es_vigente)

    query = query.order_by(Tarifa.limite_min_m3)

    tarifas = query.all()

    if not tarifas:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No se encontraron tarifas del tipo '{tipo_tarifa}'"
        )

    return tarifas


# ========================================
# OBTENER TARIFA POR ID
# ========================================
@router.get("/{id_tarifa}", response_model=TarifaResponse)
def obtener_tarifa(
    id_tarifa: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """Obtiene una tarifa específica por ID"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "tarifas", "lectura")

    tarifa = db.query(Tarifa).filter(Tarifa.id_tarifa == id_tarifa).first()
    if not tarifa:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tarifa no encontrada"
        )
    return tarifa


# ========================================
# CREAR NUEVA TARIFA
# ========================================
@router.post("/", response_model=TarifaResponse, status_code=status.HTTP_201_CREATED)
def crear_tarifa(
    tarifa: TarifaCreate,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Crea una nueva tarifa (primera versión)
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "tarifas", "crear")

    # Verificar si ya existe una tarifa vigente con el mismo nombre
    tarifa_vigente = db.query(Tarifa).filter(
        Tarifa.nombre == tarifa.nombre.strip(),
        Tarifa.es_vigente == True
    ).first()

    if tarifa_vigente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ya existe una tarifa vigente con el nombre '{tarifa.nombre}'. Use la opción de actualización para crear una nueva versión."
        )

    # Validar solapamiento de rangos
    if tarifa.limite_max_m3:
        rangos_existentes = db.query(Tarifa).filter(
            Tarifa.tipo_tarifa == tarifa.tipo_tarifa,
            Tarifa.es_vigente == True
        ).all()

        for t in rangos_existentes:
            if t.limite_max_m3 is None:
                if tarifa.limite_min_m3 >= t.limite_min_m3:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"El rango se cruza con la tarifa '{t.nombre}'"
                    )
            else:
                if not (tarifa.limite_max_m3 <= t.limite_min_m3 or tarifa.limite_min_m3 >= t.limite_max_m3):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"El rango se cruza con la tarifa '{t.nombre}'"
                    )

    # Crear nueva tarifa
    nueva_tarifa = Tarifa(
        nombre=tarifa.nombre.strip(),
        detalle=tarifa.detalle.strip() if tarifa.detalle else None,
        precio_por_m3=tarifa.precio_por_m3,
        limite_min_m3=tarifa.limite_min_m3,
        limite_max_m3=tarifa.limite_max_m3,
        tipo_tarifa=tarifa.tipo_tarifa.strip(),
        activo=True,
        es_vigente=True,
        vigencia_desde=tarifa.vigencia_desde or datetime.now()
    )

    try:
        db.add(nueva_tarifa)
        db.commit()
        db.refresh(nueva_tarifa)

        registrar_auditoria(
            db=db,
            accion="CREATE",
            descripcion=f"Tarifa '{nueva_tarifa.nombre}' creada por '{payload['sub']}'",
            id_usuario=current_user.id_usuario_sistema
        )

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


# ========================================
# ACTUALIZAR = CREAR NUEVA VERSIÓN
# ========================================
@router.put("/{id_tarifa}", response_model=TarifaResponse)
def actualizar_tarifa(
    id_tarifa: int,
    tarifa_update: TarifaUpdate,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    CREA UNA NUEVA VERSIÓN de la tarifa (NO modifica la existente)
    - Marca la tarifa anterior como: activo=False, es_vigente=False, vigencia_hasta=ahora
    - Crea una nueva tarifa con los datos actualizados
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "tarifas", "actualizar")

    # Buscar la tarifa actual
    tarifa_actual = db.query(Tarifa).filter(Tarifa.id_tarifa == id_tarifa).first()
    if not tarifa_actual:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tarifa no encontrada"
        )

    # No se puede versionar una tarifa ya vencida
    if not tarifa_actual.es_vigente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes crear una nueva versión de una tarifa ya vencida. Selecciona la versión vigente."
        )

    try:
        # 1. MARCAR LA TARIFA ACTUAL COMO VENCIDA
        fecha_vencimiento = datetime.now()
        tarifa_actual.activo = False
        tarifa_actual.es_vigente = False
        tarifa_actual.vigencia_hasta = fecha_vencimiento

        # 2. CREAR NUEVA VERSIÓN
        nueva_version = Tarifa(
            nombre=tarifa_update.nombre.strip(),
            detalle=tarifa_update.detalle.strip() if tarifa_update.detalle else None,
            precio_por_m3=tarifa_update.precio_por_m3,
            limite_min_m3=tarifa_update.limite_min_m3,
            limite_max_m3=tarifa_update.limite_max_m3,
            tipo_tarifa=tarifa_update.tipo_tarifa.strip(),
            activo=True,
            es_vigente=True,
            vigencia_desde=tarifa_update.vigencia_desde or datetime.now(),
            vigencia_hasta=None
        )

        db.add(nueva_version)
        db.commit()
        db.refresh(nueva_version)

        # Auditoría
        registrar_auditoria(
            db=db,
            accion="VERSION",
            descripcion=f"Nueva versión de tarifa '{nueva_version.nombre}' creada. ID anterior: {id_tarifa}, ID nuevo: {nueva_version.id_tarifa}",
            id_usuario=current_user.id_usuario_sistema
        )

        registrar_notificacion(
            db=db,
            id_usuario=current_user.id_usuario_sistema,
            titulo="Tarifa versionada",
            mensaje=f"Se creó una nueva versión de la tarifa '{nueva_version.nombre}'.",
            tipo="info"
        )

        return nueva_version

    except Exception as e:
        db.rollback()
        print(f"❌ Error al versionar tarifa: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear nueva versión: {str(e)}"
        )


# ========================================
# ELIMINAR TARIFA (Solo si no tiene facturas)
# ========================================
@router.delete("/{id_tarifa}", status_code=status.HTTP_200_OK)
def eliminar_tarifa(
    id_tarifa: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Elimina físicamente la tarifa SOLO si no está asociada a ninguna factura
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
        db.delete(tarifa)
        db.commit()

        registrar_auditoria(
            db=db,
            accion="DELETE",
            descripcion=f"Tarifa ID {id_tarifa} ('{tarifa.nombre}') eliminada por '{payload['sub']}'",
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
                f"⚠️ No se puede eliminar la tarifa '{tarifa.nombre}' porque está "
                "relacionada con facturas u otros elementos. Por integridad histórica, "
                "las tarifas con facturas asociadas no deben eliminarse."
            )
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error inesperado al intentar eliminar la tarifa."
        )


# ========================================
# ACTIVAR/DESACTIVAR TARIFA (toggle status)
# ========================================
@router.patch("/{id_tarifa}/toggle-status", response_model=TarifaResponse)
def toggle_tarifa_status(
    id_tarifa: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Activa/Desactiva una tarifa (cambia el campo activo)
    NOTA: Esto NO afecta la vigencia, solo el estado activo/inactivo
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "tarifas", "actualizar")

    tarifa = db.query(Tarifa).filter(Tarifa.id_tarifa == id_tarifa).first()
    if not tarifa:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tarifa no encontrada"
        )

    # Cambiar estado activo
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
# MARCAR TARIFA COMO NO VIGENTE MANUALMENTE
# ========================================
@router.patch("/{id_tarifa}/finalizar-vigencia", response_model=TarifaResponse)
def finalizar_vigencia_tarifa(
    id_tarifa: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Finaliza manualmente la vigencia de una tarifa sin crear una nueva versión
    Marca: es_vigente=False, activo=False, vigencia_hasta=ahora
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "tarifas", "actualizar")

    tarifa = db.query(Tarifa).filter(Tarifa.id_tarifa == id_tarifa).first()
    if not tarifa:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tarifa no encontrada"
        )

    if not tarifa.es_vigente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Esta tarifa ya no está vigente"
        )

    try:
        tarifa.es_vigente = False
        tarifa.activo = False
        tarifa.vigencia_hasta = datetime.now()

        db.commit()
        db.refresh(tarifa)

        registrar_auditoria(
            db=db,
            accion="UPDATE",
            descripcion=f"Vigencia de tarifa '{tarifa.nombre}' finalizada manualmente por '{payload['sub']}'",
            id_usuario=current_user.id_usuario_sistema
        )

        registrar_notificacion(
            db=db,
            id_usuario=current_user.id_usuario_sistema,
            titulo="Vigencia finalizada",
            mensaje=f"La vigencia de la tarifa '{tarifa.nombre}' fue finalizada.",
            tipo="info"
        )

        return tarifa

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al finalizar vigencia"
        )
