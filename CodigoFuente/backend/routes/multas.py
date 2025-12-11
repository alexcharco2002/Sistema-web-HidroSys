# routes/multas.py

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import unicodedata
import re

from models.multa import TipoMulta
from models.user import UsuarioSistema
from models.role import RolAccion
from schemas.multa import (
    TipoMultaCreate, TipoMultaUpdate, TipoMultaResponse,
    TipoMultaHistorialResponse, TipoMultaStats
)

from utils.notifications import registrar_notificacion
from utils.audit_logger import registrar_auditoria
from db.session import SessionLocal
from security.jwt import verify_token

router = APIRouter(prefix="/multas/tipos", tags=["multas-tipos"])

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ==========================
# PERMISSIONS UTILITIES
# ==========================
def get_current_user(payload: dict, db: Session) -> UsuarioSistema:
    user = db.query(UsuarioSistema).filter(
        UsuarioSistema.usuario == payload["sub"]
    ).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado"
        )
    return user

# ==========================
# PERMISSION CHECKING
# ==========================
def check_permission(user: UsuarioSistema, db: Session, module: str, action: str = None) -> bool:
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
        perm_action = (permiso.tipo_accion or "").lower().strip()

        if perm_module != module:
            continue

        if perm_action in ["crud", "operaciones crud"]:
            return True

        acciones_usuario.add(perm_action)

    if action is None:
        return bool(acciones_usuario)

    if action in ["leer", "lectura"]:
        if any(a in acciones_usuario for a in ["lectura", "leer", "crear", "actualizar", "eliminar"]):
            return True

    return action in acciones_usuario

# ==========================
# Funcion PARA REQUERIR PERMISOS
# ==========================
def require_permission(user: UsuarioSistema, db: Session, module: str, action: str = None):
    if not check_permission(user, db, module, action):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"No tienes permisos para {action or 'acceder a'} {module}"
        )

# ==========================
# NORMALIZACION DE TEXTO
# =========================  
def normalize_text(text: str) -> str:
    """Normaliza texto para comparación sin afectar el valor original."""
    if not text:
        return ""
    text = text.lower().strip()

    # Quitar acentos
    text = ''.join(
        c for c in unicodedata.normalize('NFD', text)
        if unicodedata.category(c) != 'Mn'
    )

    # Normalizar múltiples espacios
    text = re.sub(r"\s+", " ", text)

    return text

# ==========================
# LISTAR TIPOS DE MULTA
# ==========================

@router.get("/", response_model=List[TipoMultaResponse])
def listar_tipos_multa(
    search: Optional[str] = Query(None, description="Buscar por nombre o descripción"),
    es_vigente: Optional[bool] = Query(None, description="Filtrar por vigencia (None = todas, True = vigentes, False = vencidas)"),
    activo: Optional[bool] = Query(None, description="Filtrar por estado activo"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "multas", "lectura")

    query = db.query(TipoMulta)

    if es_vigente is not None:
        query = query.filter(TipoMulta.es_vigente == es_vigente)

    if activo is not None:
        query = query.filter(TipoMulta.activo == activo)

    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (TipoMulta.nombre_multa.ilike(search_filter)) |
            (TipoMulta.descripcion.ilike(search_filter))
        )

    query = query.order_by(TipoMulta.es_vigente.desc(), TipoMulta.nombre_multa, TipoMulta.vigencia_desde.desc())
    return query.offset(skip).limit(limit).all()

# ==========================
# STATS
# ==========================

@router.get("/stats/count", response_model=TipoMultaStats)
def obtener_estadisticas_tipos_multa(
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "multas", "lectura")

    total = db.query(TipoMulta).count()
    vigentes = db.query(TipoMulta).filter(TipoMulta.es_vigente == True).count()
    vencidos = db.query(TipoMulta).filter(TipoMulta.es_vigente == False).count()

    return {
        "total_versiones": total,
        "tipos_vigentes": vigentes,
        "tipos_vencidos": vencidos,
    }

# ==========================
# HISTORIAL POR NOMBRE
# ==========================

@router.get("/historial/{nombre_multa}", response_model=List[TipoMultaHistorialResponse])
def obtener_historial_tipo_multa(
    nombre_multa: str,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "multas", "lectura")

    versiones = db.query(TipoMulta).filter(
        TipoMulta.nombre_multa == nombre_multa
    ).order_by(TipoMulta.vigencia_desde.desc()).all()

    if not versiones:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No se encontraron versiones del tipo de multa '{nombre_multa}'"
        )

    return versiones

# ==========================
# OBTENER POR ID
# ==========================

@router.get("/{id_tipo_multa}", response_model=TipoMultaResponse)
def obtener_tipo_multa(
    id_tipo_multa: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "multas", "lectura")

    tipo = db.query(TipoMulta).filter(TipoMulta.id_tipo_multa == id_tipo_multa).first()
    if not tipo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tipo de multa no encontrado"
        )
    return tipo

# ==========================
# CREAR NUEVO TIPO
# ==========================

@router.post("/", response_model=TipoMultaResponse, status_code=status.HTTP_201_CREATED)
def crear_tipo_multa(
    tipo: TipoMultaCreate,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "multas", "crear")

    # ============================
    # 🔍 Normalizar nombre ingresado
    # ============================
    nombre_original = tipo.nombre_multa.strip()
    nombre_normalizado = normalize_text(nombre_original)

    # ============================
    # 🔍 Buscar coincidencias normalizadas
    # ============================
    tipos_existentes = db.query(TipoMulta).filter(
        TipoMulta.es_vigente == True
    ).all()

    for t in tipos_existentes:
        if normalize_text(t.nombre_multa) == nombre_normalizado:
            raise HTTPException(
                status_code=400,
                detail=f"Ya existe un tipo de multa vigente con el nombre '{t.nombre_multa}' similar."
            )

    # Crear el registro
    nuevo_tipo = TipoMulta(
        nombre_multa=nombre_original,
        descripcion=tipo.descripcion.strip() if tipo.descripcion else None,
        monto=tipo.monto,
        activo=True,
        es_vigente=True,
        vigencia_desde=tipo.vigencia_desde or datetime.now()
    )

    try:
        db.add(nuevo_tipo)
        db.commit()
        db.refresh(nuevo_tipo)

        registrar_auditoria(
            db=db,
            accion="CREATE",
            descripcion=f"Tipo de multa '{nuevo_tipo.nombre_multa}' creado por '{payload['sub']}'",
            id_usuario=current_user.id_usuario_sistema
        )

        registrar_notificacion(
            db=db,
            id_usuario=current_user.id_usuario_sistema,
            titulo="Tipo de multa creado",
            mensaje=f"El tipo de multa '{nuevo_tipo.nombre_multa}' fue creado correctamente.",
            tipo="exito"
        )

        return nuevo_tipo

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Error al crear el tipo de multa: {str(e)}"
        )


# ==========================
# VERSIONAR (UPDATE)
# ==========================

@router.put("/{id_tipo_multa}", response_model=TipoMultaResponse)
def versionar_tipo_multa(
    id_tipo_multa: int,
    tipo_update: TipoMultaUpdate,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "multas", "actualizar")

    tipo_actual = db.query(TipoMulta).filter(TipoMulta.id_tipo_multa == id_tipo_multa).first()
    if not tipo_actual:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tipo de multa no encontrado"
        )

    if not tipo_actual.es_vigente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes crear una nueva versión de un tipo de multa ya vencido. Selecciona la versión vigente."
        )

    try:
        fecha_vencimiento = datetime.now()
        tipo_actual.activo = False
        tipo_actual.es_vigente = False
        tipo_actual.vigencia_hasta = fecha_vencimiento

        nueva_version = TipoMulta(
            nombre_multa=tipo_update.nombre_multa.strip(),
            descripcion=tipo_update.descripcion.strip() if tipo_update.descripcion else None,
            monto=tipo_update.monto,
            activo=True,
            es_vigente=True,
            vigencia_desde=tipo_update.vigencia_desde or datetime.now(),
            vigencia_hasta=None
        )

        db.add(nueva_version)
        db.commit()
        db.refresh(nueva_version)

        registrar_auditoria(
            db=db,
            accion="VERSION",
            descripcion=f"Nueva versión de tipo de multa '{nueva_version.nombre_multa}' creada. ID anterior: {id_tipo_multa}, ID nuevo: {nueva_version.id_tipo_multa}",
            id_usuario=current_user.id_usuario_sistema
        )

        return nueva_version
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear nueva versión: {str(e)}"
        )

# ==========================
# TOGGLE ACTIVO
# ==========================

@router.patch("/{id_tipo_multa}/toggle-status", response_model=TipoMultaResponse)
def toggle_tipo_multa_status(
    id_tipo_multa: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "multas", "actualizar")

    tipo = db.query(TipoMulta).filter(TipoMulta.id_tipo_multa == id_tipo_multa).first()
    if not tipo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tipo de multa no encontrado"
        )

    tipo.activo = not tipo.activo
    estado_texto = "activado" if tipo.activo else "desactivado"

    try:
        db.commit()
        db.refresh(tipo)

        registrar_auditoria(
            db=db,
            accion="UPDATE",
            descripcion=f"Tipo de multa '{tipo.nombre_multa}' fue {estado_texto} por '{payload['sub']}'",
            id_usuario=current_user.id_usuario_sistema
        )

        return tipo
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al cambiar el estado del tipo de multa"
        )
