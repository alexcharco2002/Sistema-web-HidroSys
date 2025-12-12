# routes/multas_afiliados.py

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional
from datetime import date, datetime
from decimal import Decimal
from sqlalchemy.orm import joinedload

# ⭐ IMPORTANTE: Importar TODOS los modelos que vas a usar en joinedload
from models.multa_afiliado import MultaAfiliado
from models.multa import TipoMulta
from models.user import UsuarioSistema
from models.affiliate import UsuarioAfiliado  # ⭐ IMPORTAR DESDE affiliate.py
from models.role import RolAccion

from schemas.multa_afiliado import (
    MultaAfiliadoCompleto, MultaAfiliadoCreate, MultaAfiliadoUpdate, MultaAfiliadoResponse,
    MultaAfiliadoPagoRequest, MultaAfiliadoStats, EstadoMulta
)

from utils.notifications import registrar_notificacion
from utils.audit_logger import registrar_auditoria
from db.session import SessionLocal
from security.jwt import verify_token

router = APIRouter(prefix="/multas/afiliados", tags=["multas-afiliados"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

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

def require_permission(user: UsuarioSistema, db: Session, module: str, action: str = None):
    if not check_permission(user, db, module, action):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"No tienes permisos para {action or 'acceder a'} {module}"
        )

# ==========================
# LISTAR MULTAS DE AFILIADOS
# ==========================

@router.get("/", response_model=List[MultaAfiliadoCompleto])
def listar_multas_afiliados(
    id_usuario_afi: Optional[int] = Query(None, description="Filtrar por usuario"),
    estado: Optional[EstadoMulta] = Query(None, description="Filtrar por estado"),
    activo: Optional[bool] = Query(None, description="Filtrar por estado activo"),
    fecha_desde: Optional[date] = Query(None, description="Fecha multa desde"),
    fecha_hasta: Optional[date] = Query(None, description="Fecha multa hasta"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Lista todas las multas con filtros opcionales
    Requiere permiso: multas.lectura o multas.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "multas", "lectura")
    
    # ⭐ Cargar relaciones con joinedload
    query = db.query(MultaAfiliado).options(
        joinedload(MultaAfiliado.usuario).joinedload(UsuarioAfiliado.usuario_sistema),
        joinedload(MultaAfiliado.usuario).joinedload(UsuarioAfiliado.sector),  # ⭐ Cargar sector
        joinedload(MultaAfiliado.tipo_multa)
    )
    
    if id_usuario_afi is not None:
        query = query.filter(MultaAfiliado.id_usuario_afi == id_usuario_afi)
    
    if estado is not None:
        query = query.filter(MultaAfiliado.estado == estado.value)
    
    if activo is not None:
        query = query.filter(MultaAfiliado.activo == activo)
    
    if fecha_desde:
        query = query.filter(MultaAfiliado.fecha_multa >= fecha_desde)
    
    if fecha_hasta:
        query = query.filter(MultaAfiliado.fecha_multa <= fecha_hasta)
    
    query = query.order_by(MultaAfiliado.fecha_multa.desc())
    multas = query.offset(skip).limit(limit).all()
    
    # ⭐ Transformar a estructura optimizada
    resultado = []
    for multa in multas:
        afiliado_info = None
        if multa.usuario and multa.usuario.usuario_sistema:
            us = multa.usuario.usuario_sistema
            afiliado_info = {
                "cod_usuario_afi": multa.usuario.cod_usuario_afi,
                "nombre_completo": f"{us.nombres} {us.apellidos}".strip(),
                "cedula": us.cedula or "N/A",
                "id_sector": multa.usuario.id_sector,
                "nombre_sector": multa.usuario.sector.nombre_sector if multa.usuario.sector else "N/A"
            }
        
        tipo_multa_info = None
        if multa.tipo_multa:
            tipo_multa_info = {
                "nombre_multa": multa.tipo_multa.nombre_multa
            }
        
        resultado.append({
            "id_multa_afi": multa.id_multa_afi,
            "monto": multa.monto,
            "fecha_multa": multa.fecha_multa,
            "fecha_pago": multa.fecha_pago,
            "observaciones": multa.observaciones,
            "estado": multa.estado,
            "afiliado": afiliado_info,
            "tipo_multa": tipo_multa_info
        })
    
    return resultado

# ==========================
# ESTADÍSTICAS
# ==========================
@router.get("/stats", response_model=MultaAfiliadoStats)
def obtener_estadisticas_multas(
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "multas", "lectura")
    
    total = db.query(MultaAfiliado).filter(MultaAfiliado.activo == True).count()
    pendientes = db.query(MultaAfiliado).filter(
        MultaAfiliado.estado == "pendiente",
        MultaAfiliado.activo == True
    ).count()
    pagadas = db.query(MultaAfiliado).filter(MultaAfiliado.estado == "pagada").count()
    anuladas = db.query(MultaAfiliado).filter(MultaAfiliado.estado == "anulada").count()
    exoneradas = db.query(MultaAfiliado).filter(MultaAfiliado.estado == "exonerada").count()
    
    monto_pendiente = db.query(func.sum(MultaAfiliado.monto)).filter(
        MultaAfiliado.estado == "pendiente",
        MultaAfiliado.activo == True
    ).scalar() or Decimal("0.00")
    
    monto_pagado = db.query(func.sum(MultaAfiliado.monto)).filter(
        MultaAfiliado.estado == "pagada"
    ).scalar() or Decimal("0.00")
    
    return {
        "total_multas": total,
        "pendientes": pendientes,
        "pagadas": pagadas,
        "anuladas": anuladas,
        "exoneradas": exoneradas,
        "monto_total_pendiente": monto_pendiente,
        "monto_total_pagado": monto_pagado,
    }

# ==========================
# OBTENER POR ID
# ==========================
@router.get("/{id_multa_afi}", response_model=MultaAfiliadoResponse)
def obtener_multa_afiliado(
    id_multa_afi: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "multas", "lectura")
    
    multa = db.query(MultaAfiliado).filter(
        MultaAfiliado.id_multa_afi == id_multa_afi
    ).first()
    
    if not multa:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Multa no encontrada"
        )
    
    return multa

# ==========================
# CREAR MULTA
# ==========================
@router.post("/", response_model=MultaAfiliadoResponse, status_code=status.HTTP_201_CREATED)
def crear_multa_afiliado(
    multa: MultaAfiliadoCreate,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "multas", "crear")
    
    # Validar que el tipo de multa existe y está vigente
    tipo_multa = db.query(TipoMulta).filter(
        TipoMulta.id_tipo_multa == multa.id_tipo_multa,
        TipoMulta.es_vigente == True,
        TipoMulta.activo == True
    ).first()
    
    if not tipo_multa:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tipo de multa no encontrado o no vigente"
        )
    
    nueva_multa = MultaAfiliado(
        id_usuario_afi=multa.id_usuario_afi,
        id_tipo_multa=multa.id_tipo_multa,
        monto=multa.monto,
        fecha_multa=multa.fecha_multa or date.today(),
        observaciones=multa.observaciones,
        estado=multa.estado.value if multa.estado else "pendiente",
        activo=True
    )
    
    try:
        db.add(nueva_multa)
        db.commit()
        db.refresh(nueva_multa)
        
        registrar_auditoria(
            db=db,
            accion="CREATE",
            descripcion=f"Multa creada para usuario {multa.id_usuario_afi} - Tipo: {tipo_multa.nombre_multa}",
            id_usuario=current_user.id_usuario_sistema
        )
        
        return nueva_multa
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear la multa: {str(e)}"
        )

# ==========================
# ACTUALIZAR MULTA
# ==========================
@router.put("/{id_multa_afi}", response_model=MultaAfiliadoResponse)
def actualizar_multa_afiliado(
    id_multa_afi: int,
    multa_update: MultaAfiliadoUpdate,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "multas", "actualizar")
    
    multa = db.query(MultaAfiliado).filter(
        MultaAfiliado.id_multa_afi == id_multa_afi
    ).first()
    
    if not multa:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Multa no encontrada"
        )
    
    # Validar fecha de pago
    if multa_update.fecha_pago and multa_update.fecha_pago < multa.fecha_multa:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La fecha de pago no puede ser anterior a la fecha de la multa"
        )
    
    update_data = multa_update.model_dump(exclude_unset=True)
    
    for field, value in update_data.items():
        if field == "estado" and value:
            setattr(multa, field, value.value)
        else:
            setattr(multa, field, value)
    
    try:
        db.commit()
        db.refresh(multa)
        
        registrar_auditoria(
            db=db,
            accion="UPDATE",
            descripcion=f"Multa {id_multa_afi} actualizada",
            id_usuario=current_user.id_usuario_sistema
        )
        
        return multa
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al actualizar la multa: {str(e)}"
        )

# ==========================
# REGISTRAR PAGO
# ==========================
@router.patch("/{id_multa_afi}/pagar", response_model=MultaAfiliadoResponse)
def registrar_pago_multa(
    id_multa_afi: int,
    pago: MultaAfiliadoPagoRequest,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "multas", "actualizar")
    
    multa = db.query(MultaAfiliado).filter(
        MultaAfiliado.id_multa_afi == id_multa_afi
    ).first()
    
    if not multa:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Multa no encontrada"
        )
    
    if multa.estado == "pagada":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Esta multa ya fue pagada"
        )
    
    if multa.estado in ["anulada", "exonerada"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se puede registrar pago de una multa {multa.estado}"
        )
    
    multa.fecha_pago = pago.fecha_pago or date.today()
    multa.estado = "pagada"
    
    if pago.observaciones:
        multa.observaciones = f"{multa.observaciones or ''}\nPago: {pago.observaciones}".strip()
    
    try:
        db.commit()
        db.refresh(multa)
        
        registrar_auditoria(
            db=db,
            accion="UPDATE",
            descripcion=f"Pago registrado para multa {id_multa_afi}",
            id_usuario=current_user.id_usuario_sistema
        )
        
        registrar_notificacion(
            db=db,
            id_usuario=current_user.id_usuario_sistema,
            titulo="Pago de multa registrado",
            mensaje=f"Se registró el pago de la multa #{id_multa_afi}",
            tipo="exito"
        )
        
        return multa
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al registrar el pago: {str(e)}"
        )

# ==========================
# ANULAR MULTA
# ==========================
@router.patch("/{id_multa_afi}/anular", response_model=MultaAfiliadoResponse)
def anular_multa(
    id_multa_afi: int,
    motivo: str = Query(..., min_length=10, description="Motivo de anulación"),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "multas", "eliminar")
    
    multa = db.query(MultaAfiliado).filter(
        MultaAfiliado.id_multa_afi == id_multa_afi
    ).first()
    
    if not multa:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Multa no encontrada"
        )
    
    if multa.estado == "anulada":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Esta multa ya está anulada"
        )
    
    multa.estado = "anulada"
    multa.activo = False
    multa.observaciones = f"{multa.observaciones or ''}\nAnulada: {motivo}".strip()
    
    try:
        db.commit()
        db.refresh(multa)
        
        registrar_auditoria(
            db=db,
            accion="DELETE",
            descripcion=f"Multa {id_multa_afi} anulada. Motivo: {motivo}",
            id_usuario=current_user.id_usuario_sistema
        )
        
        return multa
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al anular la multa: {str(e)}"
        )
