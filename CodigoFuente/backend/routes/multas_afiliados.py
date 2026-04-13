# routes/multas_afiliados.py
from sqlite3 import IntegrityError
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, distinct
from typing import List, Optional
from datetime import date, datetime
from decimal import Decimal
from sqlalchemy.orm import joinedload

from models.meter import Medidor
from models.multa_afiliado import MultaAfiliado
from models.multa import TipoMulta
from models.user import UsuarioSistema
from models.affiliate import UsuarioAfiliado  
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

# ============================================
# TIPOS DE MULTA DISPONIBLES PARA AFILIADOS
# ============================================
@router.get("/tipos", response_model=List[dict])
def listar_tipos_multa_afiliados(
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """Retorna todos los tipos de multa vigentes y activos."""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "multasafiliados", "lectura")

    tipos = (
        db.query(TipoMulta)
        .filter(TipoMulta.es_vigente == True, TipoMulta.activo == True)
        .order_by(TipoMulta.nombre_multa)
        .all()
    )

    return [
        {
            "id_tipo_multa": t.id_tipo_multa,
            "nombre_multa": t.nombre_multa,
            "monto": float(t.monto),
        }
        for t in tipos
    ]


# ========================================
# AFILIADOS DISPONIBLES — FIX DUPLICADOS
# El join con Medidor es 1-a-muchos, se usa subquery para
# traer solo UN medidor por afiliado (el primero activo)
# ========================================
@router.get("/available", response_model=List[dict])
def listar_afiliados_para_multas(
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Lista todos los afiliados activos SIN DUPLICADOS.
    Usa subquery para tomar solo un medidor por afiliado.
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "multasafiliados", "lectura")

    try:
        # Subquery: un solo medidor por afiliado (el de menor id activo)
        subq_medidor = (
            db.query(
                Medidor.id_usuario_afi,
                func.min(Medidor.num_medidor).label("num_medidor")
            )
            .filter(Medidor.activo == True)
            .group_by(Medidor.id_usuario_afi)
            .subquery()
        )

        resultados = (
            db.query(
                UsuarioAfiliado.id_usuario_afi,
                UsuarioAfiliado.cod_usuario_afi,
                UsuarioSistema.nombres,
                UsuarioSistema.apellidos,
                UsuarioSistema.cedula,
                subq_medidor.c.num_medidor
            )
            .join(
                UsuarioSistema,
                UsuarioAfiliado.id_usuario_sistema == UsuarioSistema.id_usuario_sistema
            )
            .outerjoin(
                subq_medidor,
                subq_medidor.c.id_usuario_afi == UsuarioAfiliado.id_usuario_afi
            )
            .filter(UsuarioAfiliado.activo == True)
            .order_by(UsuarioAfiliado.cod_usuario_afi)
            .all()
        )

        if not resultados:
            return []

        afiliados = [
            {
                "id_usuario_afi": r.id_usuario_afi,
                "cod_usuario_afi": r.cod_usuario_afi,
                "nombres": r.nombres,
                "apellidos": r.apellidos,
                "cedula": r.cedula,
                "num_medidor": r.num_medidor
            }
            for r in resultados
        ]

        return afiliados

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener lista de afiliados para multas: {str(e)}"
        )


# ============================================
#  OBTENER AÑOS DISPONIBLES
# ============================================
@router.get("/periodos/anios", response_model=List[int])
def obtener_anios_disponibles(
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "multasafiliados", "lectura")
    
    try:
        anios = (
            db.query(func.extract('year', MultaAfiliado.fecha_multa).label('anio'))
            .filter(MultaAfiliado.activo == True)
            .distinct()
            .order_by(func.extract('year', MultaAfiliado.fecha_multa).desc())
            .all()
        )
        return [int(anio.anio) for anio in anios]
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener años: {str(e)}"
        )


# ============================================
#  OBTENER MESES DE UN AÑO
# ============================================
@router.get("/periodos/meses/{anio}", response_model=List[dict])
def obtener_meses_por_anio(
    anio: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "multasafiliados", "lectura")
    
    try:
        meses = (
            db.query(func.extract('month', MultaAfiliado.fecha_multa).label('mes'))
            .filter(
                MultaAfiliado.activo == True,
                func.extract('year', MultaAfiliado.fecha_multa) == anio
            )
            .distinct()
            .order_by(func.extract('month', MultaAfiliado.fecha_multa).desc())
            .all()
        )
        
        meses_nombres = {
            1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
            5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
            9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre'
        }
        
        return [
            {'mes': int(mes.mes), 'mes_nombre': meses_nombres[int(mes.mes)]}
            for mes in meses
        ]
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener meses: {str(e)}"
        )


# ============================================
#  RESUMEN POR PERÍODO (para tarjetas de selección)
#  Devuelve total, pendientes y pagadas de un mes/año
# ============================================
@router.get("/periodos/resumen", response_model=dict)
def obtener_resumen_periodo(
    anio: int = Query(..., description="Año del período"),
    mes: int = Query(..., ge=1, le=12, description="Mes del período"),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Devuelve contadores rápidos (total, pendientes, pagadas) de un período.
    Se usa en las tarjetas de selección de período.
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "multasafiliados", "lectura")

    def base():
        return (
            db.query(MultaAfiliado)
            .filter(
                MultaAfiliado.activo == True,
                func.extract('year', MultaAfiliado.fecha_multa) == anio,
                func.extract('month', MultaAfiliado.fecha_multa) == mes
            )
        )

    total     = base().count()
    pendientes = base().filter(MultaAfiliado.estado == "pendiente").count()
    pagadas    = base().filter(MultaAfiliado.estado == "pagada").count()
    anuladas   = base().filter(MultaAfiliado.estado == "anulada").count()

    monto_pendiente = base().filter(
        MultaAfiliado.estado == "pendiente"
    ).with_entities(func.sum(MultaAfiliado.monto)).scalar() or Decimal("0.00")

    return {
        "total": total,
        "pendientes": pendientes,
        "pagadas": pagadas,
        "anuladas": anuladas,
        "monto_pendiente": float(monto_pendiente),
    }


# ============================================
#  ENDPOINT LISTAR MULTAS 
# ============================================
@router.get("/", response_model=List[MultaAfiliadoCompleto])
def listar_multas_afiliados(
    id_usuario_afi: Optional[int] = Query(None),
    estado: Optional[EstadoMulta] = Query(None),
    activo: Optional[bool] = Query(None),
    fecha_desde: Optional[date] = Query(None),
    fecha_hasta: Optional[date] = Query(None),
    anio: Optional[int] = Query(None),
    mes: Optional[int] = Query(None, ge=1, le=12),
    id_tipo_multa: Optional[int] = Query(None, description="Filtrar por tipo de multa"),   # ← NUEVO
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "multasafiliados", "lectura")
    
    query = db.query(MultaAfiliado).options(
        joinedload(MultaAfiliado.usuario).joinedload(UsuarioAfiliado.usuario_sistema),
        joinedload(MultaAfiliado.usuario).joinedload(UsuarioAfiliado.sector),
        joinedload(MultaAfiliado.tipo_multa)
    )
    
    if id_usuario_afi is not None:
        query = query.filter(MultaAfiliado.id_usuario_afi == id_usuario_afi)
    
    if estado is not None:
        query = query.filter(MultaAfiliado.estado == estado.value)
    
    if activo is not None:
        query = query.filter(MultaAfiliado.activo == activo)

    # NUEVO: filtro por tipo de multa
    if id_tipo_multa is not None:
        query = query.filter(MultaAfiliado.id_tipo_multa == id_tipo_multa)
    
    if anio:
        query = query.filter(func.extract('year', MultaAfiliado.fecha_multa) == anio)
        if mes:
            query = query.filter(func.extract('month', MultaAfiliado.fecha_multa) == mes)
    elif fecha_desde or fecha_hasta:
        if fecha_desde:
            query = query.filter(MultaAfiliado.fecha_multa >= fecha_desde)
        if fecha_hasta:
            query = query.filter(MultaAfiliado.fecha_multa <= fecha_hasta)
    
    query = query.order_by(MultaAfiliado.fecha_multa.desc())
    multas = query.offset(skip).limit(limit).all()
    
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
            tipo_multa_info = {"nombre_multa": multa.tipo_multa.nombre_multa}
        
        resultado.append({
            "id_multa_afi": multa.id_multa_afi,
            "id_tipo_multa": multa.id_tipo_multa,
            "monto": multa.monto,
            "fecha_multa": multa.fecha_multa,
            "fecha_pago": multa.fecha_pago,
            "observaciones": multa.observaciones,
            "estado": multa.estado,
            "afiliado": afiliado_info,
            "tipo_multa": tipo_multa_info
        })
    
    return resultado


# ============================================
#  STATS
# ============================================
@router.get("/stats", response_model=MultaAfiliadoStats)
def obtener_estadisticas_multas(
    anio: Optional[int] = Query(None),
    mes: Optional[int] = Query(None, ge=1, le=12),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "multasafiliados", "lectura")
    
    def get_base_query():
        query = db.query(MultaAfiliado).filter(MultaAfiliado.activo == True)
        if anio:
            query = query.filter(func.extract('year', MultaAfiliado.fecha_multa) == anio)
            if mes:
                query = query.filter(func.extract('month', MultaAfiliado.fecha_multa) == mes)
        return query
    
    total      = get_base_query().count()
    pendientes = get_base_query().filter(MultaAfiliado.estado == "pendiente").count()
    pagadas    = get_base_query().filter(MultaAfiliado.estado == "pagada").count()
    anuladas   = get_base_query().filter(MultaAfiliado.estado == "anulada").count()
    exoneradas = get_base_query().filter(MultaAfiliado.estado == "exonerada").count()
    facturado  = get_base_query().filter(MultaAfiliado.estado == "facturado").count()
    
    facturadas             = get_base_query().filter(MultaAfiliado.facturado == True).count()
    pendientes_facturacion = get_base_query().filter(
        MultaAfiliado.facturado == False,
        MultaAfiliado.estado.in_(["pendiente", "pagada", "exonerada", "anulada"]),
    ).count()
    
    monto_pendiente = get_base_query().filter(
        MultaAfiliado.estado == "pendiente"
    ).with_entities(func.sum(MultaAfiliado.monto)).scalar() or Decimal("0.00")
    
    monto_pagado = get_base_query().filter(
        MultaAfiliado.estado == "pagada"
    ).with_entities(func.sum(MultaAfiliado.monto)).scalar() or Decimal("0.00")
    
    monto_total = get_base_query().with_entities(
        func.sum(MultaAfiliado.monto)
    ).scalar() or Decimal("0.00")
    
    monto_facturado = get_base_query().filter(
        MultaAfiliado.facturado == True
    ).with_entities(func.sum(MultaAfiliado.monto)).scalar() or Decimal("0.00")
    
    monto_pendiente_facturacion = get_base_query().filter(
        MultaAfiliado.facturado == False,
        MultaAfiliado.estado.in_(["pendiente", "pagada"])
    ).with_entities(func.sum(MultaAfiliado.monto)).scalar() or Decimal("0.00")
    
    return {
        "total_multas": total,
        "pendientes": pendientes,
        "pagadas": pagadas,
        "anuladas": anuladas,
        "exoneradas": exoneradas,
        "facturado": facturado,
        "facturadas": facturadas,
        "pendientes_facturacion": pendientes_facturacion,
        "monto_total": monto_total,
        "monto_pendiente": monto_pendiente,
        "monto_pagado": monto_pagado,
        "monto_facturado": monto_facturado,
        "monto_pendiente_facturacion": monto_pendiente_facturacion,
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
    require_permission(current_user, db, "multasafiliados", "lectura")
    
    multa = db.query(MultaAfiliado).filter(
        MultaAfiliado.id_multa_afi == id_multa_afi
    ).first()
    
    if not multa:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Multa no encontrada")
    
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
    require_permission(current_user, db, "multasafiliados", "crear")

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
        db.flush()
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
    require_permission(current_user, db, "multasafiliados", "actualizar")
    
    multa = db.query(MultaAfiliado).filter(
        MultaAfiliado.id_multa_afi == id_multa_afi
    ).first()
    
    if not multa:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Multa no encontrada")
    
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
            db=db, accion="UPDATE",
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
    require_permission(current_user, db, "multasafiliados", "actualizar")
    
    multa = db.query(MultaAfiliado).filter(
        MultaAfiliado.id_multa_afi == id_multa_afi
    ).first()
    
    if not multa:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Multa no encontrada")
    
    if multa.estado == "pagada":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Esta multa ya fue pagada")
    
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
            db=db, accion="UPDATE",
            descripcion=f"Pago registrado para multa {id_multa_afi}",
            id_usuario=current_user.id_usuario_sistema
        )
        registrar_notificacion(
            db=db, id_usuario=current_user.id_usuario_sistema,
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
    require_permission(current_user, db, "multasafiliados", "eliminar")
    
    multa = db.query(MultaAfiliado).filter(
        MultaAfiliado.id_multa_afi == id_multa_afi
    ).first()
    
    if not multa:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Multa no encontrada")
    
    if multa.estado == "anulada":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Esta multa ya está anulada")
    
    multa.estado = "anulada"
    multa.activo = False
    multa.observaciones = f"{multa.observaciones or ''}\nAnulada: {motivo}".strip()
    
    try:
        db.commit()
        db.refresh(multa)
        registrar_auditoria(
            db=db, accion="DELETE",
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


# ========================================
# ELIMINAR MULTA (Solo si está anulada)
# ========================================
@router.delete("/{id_multa_afi}", status_code=status.HTTP_200_OK)
def eliminar_multa_afiliado(
    id_multa_afi: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "multasafiliados", "eliminar")

    multa = db.query(MultaAfiliado).filter(
        MultaAfiliado.id_multa_afi == id_multa_afi
    ).first()

    if not multa:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Multa no encontrada")

    if multa.estado != "anulada":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"No se puede eliminar la multa porque está en estado '{multa.estado}'. Solo se pueden eliminar multas anuladas."
        )

    from models.detalle_factura import DetalleFactura
    
    tiene_detalles = db.query(DetalleFactura).filter(
        DetalleFactura.id_multa_afiliados == id_multa_afi
    ).first() is not None

    if tiene_detalles:
        return {
            "success": False,
            "accion": "no_eliminado",
            "message": f"⚠️ No se puede eliminar la multa ID {id_multa_afi} porque está relacionada con detalles de factura."
        }

    nombre_afiliado = "N/A"
    codigo_afiliado = "N/A"
    
    if multa.usuario and multa.usuario.usuario_sistema:
        usuario_sistema = multa.usuario.usuario_sistema
        nombre_afiliado = f"{usuario_sistema.nombres or ''} {usuario_sistema.apellidos or ''}".strip()
        codigo_afiliado = multa.usuario.cod_usuario_afi or "N/A"
    
    tipo_multa = multa.tipo_multa.nombre_multa if multa.tipo_multa else "N/A"
    monto = float(multa.monto)

    try:
        db.delete(multa)
        db.commit()

        registrar_auditoria(
            db=db, accion="DELETE",
            descripcion=(
                f"Multa anulada ID {id_multa_afi} eliminada. "
                f"Afiliado: {nombre_afiliado} (Código: {codigo_afiliado}), "
                f"Tipo: {tipo_multa}, Monto: ${monto:.2f}. "
                f"Eliminado por: '{payload['sub']}'"
            ),
            id_usuario=current_user.id_usuario_sistema
        )

        registrar_notificacion(
            db=db, id_usuario=current_user.id_usuario_sistema,
            titulo="Multa eliminada",
            mensaje=f"La multa anulada ID {id_multa_afi} de {nombre_afiliado} fue eliminada correctamente.",
            tipo="info"
        )

        return {"success": True, "accion": "eliminado", "message": f"Multa ID {id_multa_afi} eliminada correctamente."}

    except IntegrityError:
        db.rollback()
        return {
            "success": False,
            "accion": "no_eliminado",
            "message": f"⚠️ No se puede eliminar la multa ID {id_multa_afi} porque está relacionada con otros registros del sistema."
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al intentar eliminar la multa: {str(e)}"
        )