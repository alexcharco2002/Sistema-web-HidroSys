# routes/pagos.py
# funciones de control y de 
import locale
import time
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status, Query
from sqlalchemy.orm import Session, aliased, joinedload, selectinload, load_only
from sqlalchemy.exc import IntegrityError
from typing import List, Optional, Tuple as TypingTuple  
from sqlalchemy import  String, cast, func, extract,case, and_,  or_
from typing import List, Optional
from datetime import datetime, date, timedelta
from decimal import Decimal


from models.detalle_factura import DetalleFactura
from models.lectura import Lectura
from models.meter import Medidor
from models.multa_afiliado import MultaAfiliado
from models.pago import Pago
from models.factura import Factura
from models.affiliate import UsuarioAfiliado
from models.sector import Sector
from models.user import UsuarioSistema
from models.role import RolAccion

from schemas.factura import FacturaConUsuarioCompleto
from schemas.pago import (
    PagoCreate,
    PagoUpdate,
    PagoResponse,
    PagoStats,
    PagoAnular,
    ValidacionFacturaMultiple
)

from utils.audit_logger import registrar_auditoria
from utils.config_mora import calcular_dias_mora, calcular_monto_mora, calcular_mora_factura, evaluar_y_aplicar_mora, obtener_configuracion_mora_activa, obtener_monto_base_mora, registrar_mora_en_bd
from utils.pago_utils import calcular_montos_con_multas, liberar_multas_no_pagadas, procesar_multas_pagadas, validar_afiliado, validar_factura_para_pago, validar_monto_pago
from utils.facturacion import calcular_iva_sobre_detalles, detalle_grava_iva, obtener_configuracion_iva
from utils.notifications import registrar_notificacion
from db.session import SessionLocal
from security.jwt import verify_token

router = APIRouter(prefix="/pagos", tags=["pagos"])

CENTAVOS = Decimal("0.01")


def _log_pago_tiempo(scope: str, paso: str, inicio: float) -> None:
    print(f"[{scope}] {paso}: {time.perf_counter() - inicio:.3f}s")


def redondear_dinero(valor) -> Decimal:
    return Decimal(str(valor or "0")).quantize(CENTAVOS)


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


# Intentar configurar locale español
try:
    locale.setlocale(locale.LC_TIME, 'es_ES.UTF-8')
except:
    try:
        locale.setlocale(locale.LC_TIME, 'Spanish_Spain.1252')
    except:
        pass

# Diccionario de nombres de meses en español
MESES_ES = {
    1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril",
    5: "Mayo", 6: "Junio", 7: "Julio", 8: "Agosto",
    9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre"
}

from sqlalchemy import func

def obtener_estadisticas_pagos_por_periodo(db: Session, periodos: list[str]):
    """
    Obtiene estadísticas de pagos para múltiples periodos en una sola consulta
    """
    resultados = (
        db.query(
            Factura.periodo.label("periodo"),
            func.count(Pago.id_pago).label("total_pagos"),
            func.coalesce(func.sum(Pago.monto_pago), 0).label("monto_total"),
            
            #  Usar case() directamente, no func.case()
            func.coalesce(func.sum(
                case((Pago.metodo_pago == 'EFECTIVO', Pago.monto_pago), else_=0)
            ), 0).label("monto_efectivo"),
            
            func.coalesce(func.sum(
                case((Pago.metodo_pago == 'TRANSFERENCIA', Pago.monto_pago), else_=0)
            ), 0).label("monto_transferencia"),
            
            func.coalesce(func.sum(
                case((Pago.metodo_pago == 'TARJETA', Pago.monto_pago), else_=0)
            ), 0).label("monto_tarjeta"),
        )
        .join(Pago, Factura.id_factura == Pago.id_factura)  
        .filter(
            Factura.periodo.in_(periodos),
            Pago.estado_pago == 'REGISTRADO',   
            Pago.activo == True
        )
        .group_by(Factura.periodo)
        .all()
    )

    return {r.periodo: r for r in resultados}

# ========================================
# ESTADÍSTICAS DE PAGOS (FUNCIÓN HELPER)
# ========================================
def obtener_estadisticas_pagos(
    db: Session,
    periodo: Optional[str] = None,
    id_usuario_afi: Optional[int] = None
) -> dict:
    """
    Calcula estadísticas de pagos
    """
    query = db.query(Pago).filter(Pago.activo == True)
    
    # Filtrar por periodo si se proporciona
    if periodo:
        try:
            anio, mes = periodo.split('-')
            query = query.filter(
                extract('year', Pago.fecha_pago) == int(anio),
                extract('month', Pago.fecha_pago) == int(mes)
            )
        except:
            pass
    
    # Filtrar por usuario si se proporciona
    if id_usuario_afi:
        query = query.filter(Pago.id_usuario_afi == id_usuario_afi)
    
    # Total de pagos
    total_pagos = query.count()
    
    # Pagos por estado
    pagos_activos = query.filter(Pago.activo == True).count()  #  
    pagos_registrados = query.filter(Pago.estado_pago == 'REGISTRADO').count()
    pagos_anulados = query.filter(Pago.estado_pago == 'ANULADO').count()
    
    # Montos totales (solo REGISTRADOS)
    pagos_validos = query.filter(Pago.estado_pago == 'REGISTRADO')
    
    monto_total = db.query(func.sum(Pago.monto_pago)).filter(
        Pago.id_pago.in_([p.id_pago for p in pagos_validos])
    ).scalar() or Decimal('0.00')
    
    # Montos por método de pago
    monto_efectivo = db.query(func.sum(Pago.monto_pago)).filter(
        Pago.id_pago.in_([p.id_pago for p in pagos_validos]),
        Pago.metodo_pago == 'EFECTIVO'
    ).scalar() or Decimal('0.00')
    
    monto_transferencia = db.query(func.sum(Pago.monto_pago)).filter(
        Pago.id_pago.in_([p.id_pago for p in pagos_validos]),
        Pago.metodo_pago == 'TRANSFERENCIA'
    ).scalar() or Decimal('0.00')
    
    monto_tarjeta = db.query(func.sum(Pago.monto_pago)).filter(
        Pago.id_pago.in_([p.id_pago for p in pagos_validos]),
        Pago.metodo_pago == 'TARJETA'
    ).scalar() or Decimal('0.00')
    
    monto_otros = monto_total - (monto_efectivo + monto_transferencia + monto_tarjeta)
    
    return {
        "total_pagos": total_pagos,
        "pagos_activos": pagos_activos,  #  
        "pagos_registrados": pagos_registrados,
        "pagos_anulados": pagos_anulados,
        "monto_total": float(monto_total),  #  
        "monto_efectivo": float(monto_efectivo),
        "monto_transferencia": float(monto_transferencia),
        "monto_tarjeta": float(monto_tarjeta),
        "monto_otros": float(monto_otros)
    }


# ========================================
# FUNCIONES HELPER PARA ESTADÍSTICAS DE PAGOS
# ========================================

def obtener_estadisticas_pagos_enriquecidas(db: Session, periodos_str: list[str]) -> dict:
    """
    Por cada periodo devuelve:
      - total_facturas      : cuántas facturas existen en ese periodo
      - total_pagadas       : facturas con estado 'pagada'
      - total_pendientes    : facturas con estado 'pendiente' o 'vencida'
      - total_anuladas      : facturas con estado 'anulada'
      - monto_total         : suma de total de TODAS las facturas del periodo
      - monto_cobrado       : suma de total de facturas pagadas
      - monto_pendiente     : suma de total de facturas pendientes/vencidas
      - porcentaje_cobrado  : monto_cobrado / monto_total * 100
      - total_pagos         : número de registros en t_pagos (pagos activos)
      - monto_pagos         : suma de monto_pago en t_pagos activos
    """

    if not periodos_str:
        return {}

    # ── Consulta 1: estadísticas desde t_factura ────────────────────────────
    stats_facturas = (
        db.query(
            Factura.periodo,
            func.count(Factura.id_factura).label("total_facturas"),
            func.sum(
                case((Factura.estado_factura == "pagada", 1), else_=0)
            ).label("total_pagadas"),
            func.sum(
                case(
                    (Factura.estado_factura.in_(["pendiente", "vencida"]), 1),
                    else_=0
                )
            ).label("total_pendientes"),
            func.sum(
                case((Factura.estado_factura == "anulada", 1), else_=0)
            ).label("total_anuladas"),
            func.sum(Factura.total).label("monto_total"),
            func.sum(
                case((Factura.estado_factura == "pagada", Factura.total), else_=0)
            ).label("monto_cobrado"),
            func.sum(
                case(
                    (Factura.estado_factura.in_(["pendiente", "vencida"]), Factura.total),
                    else_=0
                )
            ).label("monto_pendiente"),
        )
        .filter(Factura.periodo.in_(periodos_str))
        .group_by(Factura.periodo)
        .all()
    )

    # ── Consulta 2: pagos registrados desde t_pagos ──────────────────────────
    # (un pago puede existir aunque la factura esté en otro estado)
    stats_pagos = (
        db.query(
            Factura.periodo,
            func.count(Pago.id_pago).label("total_pagos"),
            func.sum(Pago.monto_pago).label("monto_pagos"),
        )
        .join(Factura, Pago.id_factura == Factura.id_factura)
        .filter(
            Factura.periodo.in_(periodos_str),
            Pago.activo == True,
            Pago.estado_pago == "REGISTRADO",
        )
        .group_by(Factura.periodo)
        .all()
    )

    # ── Combinar resultados ──────────────────────────────────────────────────
    pagos_map = {row.periodo: row for row in stats_pagos}
    resultado = {}

    for row in stats_facturas:
        monto_total  = float(row.monto_total  or 0)
        monto_cobrado = float(row.monto_cobrado or 0)
        monto_pendiente = float(row.monto_pendiente or 0)

        pct_cobrado = round(monto_cobrado / monto_total * 100, 1) if monto_total > 0 else 0.0
        pct_pendiente = round(monto_pendiente / monto_total * 100, 1) if monto_total > 0 else 0.0

        pagos_row = pagos_map.get(row.periodo)

        resultado[row.periodo] = {
            # Facturas
            "total_facturas":   int(row.total_facturas  or 0),
            "total_pagadas":    int(row.total_pagadas   or 0),
            "total_pendientes": int(row.total_pendientes or 0),
            "total_anuladas":   int(row.total_anuladas  or 0),
            "monto_total":      monto_total,
            "monto_cobrado":    monto_cobrado,
            "monto_pendiente":  monto_pendiente,
            "porcentaje_cobrado":  pct_cobrado,
            "porcentaje_pendiente": pct_pendiente,
            # Pagos
            "total_pagos":  int(pagos_row.total_pagos or 0) if pagos_row else 0,
            "monto_pagos":  float(pagos_row.monto_pagos or 0) if pagos_row else 0.0,
        }

    return resultado


# ========================================
# OBTENER PERÍODOS DISPONIBLES DE PAGOS
# ========================================
@router.get("/periodos/disponibles", response_model=dict)
def obtener_periodos_pagos_disponibles(
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Periodos disponibles para el módulo de PAGOS.
    Incluye estadísticas de facturas (pagadas vs pendientes)
    y total de pagos registrados por periodo.
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "pagos", "lectura")

    hoy = date.today()
    mes_actual = hoy.month
    anio_actual = hoy.year

    periodos = []
    periodos_str = []

    # Generar ventana: 6 meses atrás + actual + 2 adelante
    for offset in range(-6, 3):
        mes = mes_actual + offset
        anio = anio_actual

        while mes > 12:
            mes -= 12
            anio += 1
        while mes < 1:
            mes += 12
            anio -= 1

        periodo_str = f"{anio}-{mes:02d}"
        periodos_str.append(periodo_str)

        periodos.append({
            "mes": mes,
            "anio": anio,
            "periodo": periodo_str,
            "sugerido": mes == mes_actual and anio == anio_actual,
        })

    # Una sola llamada con las dos consultas combinadas
    stats_map = obtener_estadisticas_pagos_enriquecidas(db, periodos_str)

    for p in periodos:
        stats = stats_map.get(p["periodo"], {})

        p.update({
            "nombre_mes": MESES_ES.get(p["mes"], f"Mes {p['mes']}"),
            "valor": p["periodo"],
            "texto": f"{MESES_ES.get(p['mes'])} {p['anio']}",

            # ¿Tiene actividad?
            "tiene_pagos":    stats.get("total_pagos", 0) > 0,
            "tiene_facturas": stats.get("total_facturas", 0) > 0,

            # Conteos de facturas
            "total_facturas":   stats.get("total_facturas", 0),
            "total_pagadas":    stats.get("total_pagadas", 0),
            "total_pendientes": stats.get("total_pendientes", 0),
            "total_anuladas":   stats.get("total_anuladas", 0),

            # Montos de facturas
            "monto_total":      stats.get("monto_total", 0.0),
            "monto_cobrado":    stats.get("monto_cobrado", 0.0),
            "monto_pendiente":  stats.get("monto_pendiente", 0.0),

            # Porcentajes
            "porcentaje_cobrado":   stats.get("porcentaje_cobrado", 0.0),
            "porcentaje_pendiente": stats.get("porcentaje_pendiente", 0.0),

            # Pagos registrados (registros en t_pagos)
            "total_pagos":  stats.get("total_pagos", 0),
            "monto_pagos":  stats.get("monto_pagos", 0.0),
        })

    periodos.sort(key=lambda x: (x["anio"], x["mes"]), reverse=True)
    periodo_actual = next((p for p in periodos if p["sugerido"]), periodos[0])

    return {
        "periodo_actual": periodo_actual,
        "periodos_disponibles": periodos,
    }


# ========================================
# OBTENER FACTURAS POR PERIODO CON PAGOS
# ========================================
@router.get("/facturas-periodo", response_model=List[dict])
def obtener_facturas_periodo_con_pagos(
    periodo: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    estado_factura: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "pagos", "lectura")

    try:
        from utils.facturacion import obtener_configuracion_iva
        porcentaje_iva, config_iva = obtener_configuracion_iva(db)

        Cajero = aliased(UsuarioSistema)

        # ========================================
        # SUBQUERY: TOTAL PAGADO POR FACTURA
        # ========================================
        subquery_pagos = (
            db.query(
                Pago.id_factura,
                func.sum(Pago.monto_pago).label('total_pagado')
            )
            .filter(Pago.estado_pago == 'REGISTRADO')
            .group_by(Pago.id_factura)
            .subquery()
        )

        # ========================================
        # QUERY PRINCIPAL — Factura → Lectura → Medidor ✅
        # ========================================
        query = (
            db.query(
                # ===== FACTURA =====
                Factura.id_factura,
                Factura.num_factura,
                Factura.periodo,
                Factura.fecha_emision,
                Factura.estado_factura,
                Factura.consumo_m3,
                Factura.exceso_m3,
                Factura.valor_consumo,
                Factura.valor_exceso,
                Factura.subtotal,
                Factura.descuento,
                Factura.impuesto,
                Factura.total,

                # ===== MEDIDOR ✅ (viene de Lectura, no de Afiliado) =====
                Medidor.id_medidor,
                Medidor.num_medidor,

                # ===== AFILIADO =====
                UsuarioAfiliado.id_usuario_afi,
                UsuarioAfiliado.cod_usuario_afi,

                # ===== USUARIO SISTEMA =====
                func.concat(
                    func.coalesce(UsuarioSistema.nombres, ''),
                    ' ',
                    func.coalesce(UsuarioSistema.apellidos, '')
                ).label('nombre_completo'),
                UsuarioSistema.cedula,
                UsuarioSistema.direccion,
                UsuarioSistema.telefono,
                UsuarioSistema.email,

                # ===== SECTOR =====
                Sector.nombre_sector,

                # ===== TOTAL PAGADO =====
                func.coalesce(subquery_pagos.c.total_pagado, 0).label('monto_pagado_total')
            )
            # ✅ Ruta correcta: Factura → Lectura → Medidor → Afiliado → UsuarioSistema
            .join(Lectura, Factura.id_lectura == Lectura.id_lectura)
            .join(Medidor, Lectura.id_medidor == Medidor.id_medidor)
            .join(UsuarioAfiliado, Medidor.id_usuario_afi == UsuarioAfiliado.id_usuario_afi)
            .join(UsuarioSistema, UsuarioAfiliado.id_usuario_sistema == UsuarioSistema.id_usuario_sistema)
            .outerjoin(Sector, UsuarioAfiliado.id_sector == Sector.id_sector)
            .outerjoin(subquery_pagos, Factura.id_factura == subquery_pagos.c.id_factura)
        )

        # ========================================
        # FILTROS
        # ========================================
        if periodo:
            query = query.filter(Factura.periodo == periodo)

        if estado_factura:
            query = query.filter(Factura.estado_factura == estado_factura)

        if search:
            search_pattern = f"%{search}%"
            query = query.filter(
                or_(
                    Factura.num_factura.ilike(search_pattern),
                    func.concat(
                        func.coalesce(UsuarioSistema.nombres, ''),
                        ' ',
                        func.coalesce(UsuarioSistema.apellidos, '')
                    ).ilike(search_pattern),
                    UsuarioSistema.cedula.ilike(search_pattern),
                    # ✅ Medidor.num_medidor en lugar de UsuarioAfiliado.num_medidor
                    Medidor.num_medidor.ilike(search_pattern),
                    cast(UsuarioAfiliado.cod_usuario_afi, String).ilike(search_pattern),
                )
            )

        # ========================================
        # ORDENAMIENTO
        # ========================================
        estado_orden = case(
            (Factura.estado_factura == 'anulada', 5),
            (Factura.estado_factura == 'pagada', 4),
            (
                and_(
                    subquery_pagos.c.total_pagado.isnot(None),
                    subquery_pagos.c.total_pagado > 0,
                    subquery_pagos.c.total_pagado < Factura.total,
                    Factura.estado_factura != 'anulada'
                ),
                3
            ),
            (
                and_(
                    Factura.estado_factura == 'vencida',
                    or_(
                        subquery_pagos.c.total_pagado.is_(None),
                        subquery_pagos.c.total_pagado == 0
                    )
                ),
                2
            ),
            (Factura.estado_factura == 'pendiente', 1),
            else_=999
        )

        facturas = (
            query
            .order_by(estado_orden, Factura.fecha_emision.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

        if not facturas:
            return []

        ids_facturas = [f.id_factura for f in facturas]

        # ========================================
        # PAGOS POR FACTURA
        # ========================================
        pagos_query = (
            db.query(
                Pago.id_pago,
                Pago.id_factura,
                Pago.monto_pago,
                Pago.fecha_pago,
                Pago.metodo_pago,
                Pago.estado_pago,
                Pago.observaciones,
                Pago.nombre_archivo,
                Pago.tipo_mime,
                case(
                    (Pago.comprobante_pdf.isnot(None), True),
                    else_=False
                ).label('tiene_comprobante'),
                func.concat(
                    func.coalesce(Cajero.nombres, ''),
                    ' ',
                    func.coalesce(Cajero.apellidos, '')
                ).label('cajero_nombre_completo')
            )
            .outerjoin(Cajero, Pago.id_cajero == Cajero.id_usuario_sistema)
            .filter(
                Pago.id_factura.in_(ids_facturas),
                Pago.estado_pago == 'REGISTRADO'
            )
            .order_by(Pago.fecha_pago.desc())
            .all()
        )

        pagos_por_factura = {}
        for p in pagos_query:
            if p.id_factura not in pagos_por_factura:
                pagos_por_factura[p.id_factura] = []
            pagos_por_factura[p.id_factura].append({
                "id_pago": p.id_pago,
                "monto_pago": float(p.monto_pago) if p.monto_pago else 0.0,
                "fecha_pago": p.fecha_pago.isoformat() if p.fecha_pago else None,
                "metodo_pago": p.metodo_pago or "No especificado",
                "estado_pago": p.estado_pago,
                "observaciones": p.observaciones,
                "cajero": p.cajero_nombre_completo.strip() if p.cajero_nombre_completo and p.cajero_nombre_completo.strip() else "Sin cajero",
                "tiene_comprobante": p.tiene_comprobante,
                "nombre_archivo": p.nombre_archivo,
                "tipo_mime": p.tipo_mime or "application/pdf"
            })

        # ========================================
        # TOTAL PAGADO POR FACTURA
        # ========================================
        total_pagado_por_factura = {
            tp.id_factura: float(tp.total_pagado) if tp.total_pagado else 0.0
            for tp in db.query(
                Pago.id_factura,
                func.sum(Pago.monto_pago).label('total_pagado')
            )
            .filter(Pago.id_factura.in_(ids_facturas), Pago.estado_pago == 'REGISTRADO')
            .group_by(Pago.id_factura)
            .all()
        }

        # ========================================
        # DETALLES POR FACTURA
        # ========================================
        detalles_por_factura = {}
        for d in (
            db.query(
                DetalleFactura.id_detalle,
                DetalleFactura.id_factura,
                DetalleFactura.tipo_detalle,
                DetalleFactura.descripcion,
                DetalleFactura.subtotal_detalle,
            )
            .filter(DetalleFactura.id_factura.in_(ids_facturas))
            .order_by(
                DetalleFactura.id_factura,
                case(
                    (DetalleFactura.tipo_detalle == 'consumo', 1),
                    (DetalleFactura.tipo_detalle == 'multa', 2),
                    (DetalleFactura.tipo_detalle == 'servicio', 3),
                    else_=4
                ),
                DetalleFactura.id_detalle
            )
            .all()
        ):
            if d.id_factura not in detalles_por_factura:
                detalles_por_factura[d.id_factura] = []
            detalles_por_factura[d.id_factura].append({
                "id_detalle": d.id_detalle,
                "tipo_detalle": d.tipo_detalle,
                "descripcion": d.descripcion or "Sin descripción",
                "subtotal_detalle": float(d.subtotal_detalle) if d.subtotal_detalle else 0.0,
            })

        print(f"📊 Facturas: {len(facturas)} | Pagos: {len(pagos_query)}")

        # ========================================
        # FORMATEAR RESPUESTA
        # ========================================
        resultado = []
        for f in facturas:
            detalles_factura = detalles_por_factura.get(f.id_factura, [])
            pagos_factura = pagos_por_factura.get(f.id_factura, [])
            total_pagado = total_pagado_por_factura.get(f.id_factura, 0.0)
            saldo_pendiente = max(0.0, float(f.total) - total_pagado)
            impuesto_valor = float(f.impuesto) if f.impuesto else 0.0
            subtotal_valor = float(f.subtotal) if f.subtotal else 0.0

            resultado.append({
                "id_factura":       f.id_factura,
                "num_factura":      f.num_factura,
                "periodo":          f.periodo,
                "fecha_emision":    f.fecha_emision.isoformat(),
                "estado_factura":   f.estado_factura,

                "consumo_m3":       f.consumo_m3 or 0,
                "exceso_m3":        f.exceso_m3 or 0,
                "valor_consumo":    float(f.valor_consumo) if f.valor_consumo else 0.0,
                "valor_exceso":     float(f.valor_exceso) if f.valor_exceso else 0.0,

                "subtotal":         subtotal_valor,
                "descuento":        float(f.descuento) if f.descuento else 0.0,
                "impuesto":         impuesto_valor,
                "total":            float(f.total),

                "iva_info": {
                    "porcentaje":       float(config_iva.porcentaje) if config_iva else 0.0,
                    "valor":            impuesto_valor,
                    "base_imponible":   subtotal_valor - (float(f.descuento) if f.descuento else 0.0),
                    "es_aplicable":     config_iva.es_aplicable if config_iva else False,
                    "codigo":           config_iva.codigo if config_iva else "N/A",
                    "descripcion":      config_iva.descripcion if config_iva else "Sin IVA"
                },

                # ✅ PLANO — igual que listar_facturas_optimizado
                "id_medidor":       f.id_medidor,
                "num_medidor":      f.num_medidor or "Sin medidor",
                "id_usuario_afi":   f.id_usuario_afi,
                "cod_usuario_afi":  f.cod_usuario_afi,
                "nombre_completo":  f.nombre_completo.strip() if f.nombre_completo else "Sin nombre",
                "cedula":           f.cedula,
                "direccion":        f.direccion,
                "telefono":         f.telefono,
                "email":            f.email,
                "nombre_sector":    f.nombre_sector or "Sin sector",

                "detalles":         detalles_factura,
                "resumen_detalles": {
                    "total_conceptos":  len(detalles_factura),
                    "consumo":          len([d for d in detalles_factura if d['tipo_detalle'] == 'consumo']),
                    "multas":           len([d for d in detalles_factura if d['tipo_detalle'] == 'multa']),
                    "servicios":        len([d for d in detalles_factura if d['tipo_detalle'] == 'servicio']),
                },

                "pagos":                    pagos_factura,
                "tiene_pago":               len(pagos_factura) > 0,
                "cantidad_pagos":           len(pagos_factura),
                "monto_pagado":             total_pagado,
                "saldo_pendiente":          saldo_pendiente,
                "esta_totalmente_pagada":   saldo_pendiente <= 0.01,
                "tiene_comprobante":        any(p.get('tiene_comprobante', False) for p in pagos_factura)
            })

        return resultado

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Error al obtener facturas del periodo: {str(e)}"
        )


# ========================================
# LISTAR PAGOS
# ========================================
@router.get("/", response_model=List[dict])
def listar_pagos(
    search: Optional[str] = Query(None),
    id_usuario_afi: Optional[int] = Query(None),
    periodo: Optional[str] = Query(None, description="Filtrar por periodo de la FACTURA (YYYY-MM)"),
    estado_pago: Optional[str] = Query(None),
    metodo_pago: Optional[str] = Query(None),
    fecha_desde: Optional[date] = Query(None),
    fecha_hasta: Optional[date] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "pagos", "lectura")

    try:
        # Alias para el cajero (usuario sistema que registró el pago)
        CajeroUsuario = aliased(UsuarioSistema)

        # Query principal con joins correctos y campos necesarios para filtros y respuesta
        query = (
            db.query(
                # ===== PAGO =====
                Pago.id_pago,
                Pago.fecha_pago,
                Pago.monto_pagado,
                Pago.metodo_pago,
                Pago.estado_pago,
                Pago.referencia,
                Pago.observacion,

                # ===== FACTURA =====
                Factura.id_factura,
                Factura.num_factura,
                Factura.periodo,
                Factura.total.label('total_factura'),
                Factura.estado_factura,

                # ===== MEDIDOR =====
                Medidor.id_medidor,
                Medidor.num_medidor,

                # ===== AFILIADO =====
                UsuarioAfiliado.id_usuario_afi,
                UsuarioAfiliado.cod_usuario_afi,

                # ===== USUARIO SISTEMA =====
                func.concat(
                    func.coalesce(UsuarioSistema.nombres, ''),
                    ' ',
                    func.coalesce(UsuarioSistema.apellidos, '')
                ).label('nombre_completo'),
                UsuarioSistema.cedula,
                UsuarioSistema.direccion,
                UsuarioSistema.telefono,
                UsuarioSistema.email,

                # ===== SECTOR =====
                Sector.nombre_sector,

                # ===== CAJERO =====
                func.concat(
                    func.coalesce(CajeroUsuario.nombres, ''),
                    ' ',
                    func.coalesce(CajeroUsuario.apellidos, '')
                ).label('nombre_cajero'),
            )
            # Cadena principal: Pago → Factura → Lectura → Medidor
            .join(Factura, Pago.id_factura == Factura.id_factura)
            .join(Lectura, Factura.id_lectura == Lectura.id_lectura)
            .join(Medidor, Lectura.id_medidor == Medidor.id_medidor)

            # Unir con UsuarioAfiliado a través de Medidor (no de Factura) para obtener datos del afiliado correcto
            .join(UsuarioAfiliado, Medidor.id_usuario_afi == UsuarioAfiliado.id_usuario_afi)
            .join(UsuarioSistema, UsuarioAfiliado.id_usuario_sistema == UsuarioSistema.id_usuario_sistema)
            .outerjoin(Sector, UsuarioAfiliado.id_sector == Sector.id_sector)

            # Cajero con alias correcto
            .outerjoin(CajeroUsuario, Pago.id_cajero == CajeroUsuario.id_usuario_sistema)
        )

        # ========================================
        # FILTROS
        # ========================================
        if search:
            search_pattern = f"%{search}%"
            query = query.filter(
                or_(
                    Pago.id_pago == int(search) if search.isdigit() else False,
                    Factura.num_factura.ilike(search_pattern),
                    Medidor.num_medidor.ilike(search_pattern),
                    func.concat(
                        func.coalesce(UsuarioSistema.nombres, ''),
                        ' ',
                        func.coalesce(UsuarioSistema.apellidos, '')
                    ).ilike(search_pattern),
                    UsuarioSistema.cedula.ilike(search_pattern),
                    cast(UsuarioAfiliado.cod_usuario_afi, String).ilike(search_pattern),
                )
            )

        if id_usuario_afi:
            query = query.filter(UsuarioAfiliado.id_usuario_afi == id_usuario_afi)

        if periodo:
            # ✅ Filtra por periodo de la factura, no de la fecha del pago
            query = query.filter(Factura.periodo == periodo)

        if estado_pago:
            query = query.filter(Pago.estado_pago == estado_pago)

        if metodo_pago:
            query = query.filter(Pago.metodo_pago == metodo_pago)

        if fecha_desde:
            query = query.filter(Pago.fecha_pago >= fecha_desde)

        if fecha_hasta:
            fecha_hasta_completa = datetime.combine(fecha_hasta, datetime.max.time())
            query = query.filter(Pago.fecha_pago <= fecha_hasta_completa)

        # ========================================
        # ORDENAR Y PAGINAR
        # ========================================
        resultados = (
            query
            .order_by(Pago.fecha_pago.desc(), Pago.id_pago.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

        print(f"✅ Total pagos encontrados: {len(resultados)}")

        # ========================================
        # RESPUESTA PLANA ✅
        # ========================================
        return [
            {
                # ===== PAGO =====
                "id_pago":          r.id_pago,
                "fecha_pago":       r.fecha_pago.isoformat(),
                "monto_pagado":     float(r.monto_pagado),
                "metodo_pago":      r.metodo_pago,
                "estado_pago":      r.estado_pago,
                "referencia":       r.referencia,
                "observacion":      r.observacion,

                # ===== FACTURA =====
                "id_factura":       r.id_factura,
                "num_factura":      r.num_factura,
                "periodo":          r.periodo,
                "total_factura":    float(r.total_factura),
                "estado_factura":   r.estado_factura,

                # ===== MEDIDOR =====
                "id_medidor":       r.id_medidor,
                "num_medidor":      r.num_medidor or "Sin medidor",

                # ===== AFILIADO =====
                "id_usuario_afi":   r.id_usuario_afi,
                "cod_usuario_afi":  r.cod_usuario_afi,
                "nombre_completo":  r.nombre_completo.strip() if r.nombre_completo else "Sin nombre",
                "cedula":           r.cedula,
                "direccion":        r.direccion,
                "telefono":         r.telefono,
                "email":            r.email,
                "nombre_sector":    r.nombre_sector or "Sin sector",

                # ===== CAJERO =====
                "nombre_cajero":    r.nombre_cajero.strip() if r.nombre_cajero else "Sin cajero",
            }
            for r in resultados
        ]

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Error al listar pagos: {str(e)}"
        )



# ========================================
# ESTADÍSTICAS DE FACTURAS POR PERIODO
# ========================================
@router.get("/stats/facturas-periodo")
def obtener_estadisticas_facturas_periodo(
    periodo: str = Query(..., description="Periodo (YYYY-MM)"),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Obtiene estadísticas de facturas para un periodo específico
    Incluye: total facturas, estados, montos, pagos
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "pagos", "lectura")
    
    try:
        # ========================================
        # QUERY DE FACTURAS DEL PERIODO
        # ========================================
        facturas_query = db.query(Factura).filter(
            Factura.periodo == periodo
        )
        
        total_facturas = facturas_query.count()
        
        # ========================================
        # FACTURAS POR ESTADO
        # ========================================
        facturas_pendientes = facturas_query.filter(
            Factura.estado_factura == 'pendiente'
        ).count()
        
        facturas_pagadas = facturas_query.filter(
            Factura.estado_factura == 'pagada'
        ).count()
        
        facturas_vencidas = facturas_query.filter(
            Factura.estado_factura == 'vencida'
        ).count()
        
        facturas_anuladas = facturas_query.filter(
            Factura.estado_factura == 'anulada'
        ).count()
        
        # ========================================
        # MONTOS TOTALES
        # ========================================
        # Total facturado (sin incluir anuladas)
        total_facturado = db.query(func.sum(Factura.total)).filter(
            Factura.periodo == periodo,
            Factura.estado_factura != 'anulada'
        ).scalar() or Decimal('0.00')
        
        # Total pendiente (pendientes + vencidas)
        total_pendiente = db.query(func.sum(Factura.total)).filter(
            Factura.periodo == periodo,
            Factura.estado_factura.in_(['pendiente', 'vencida'])
        ).scalar() or Decimal('0.00')
        
        # Total cobrado (facturas pagadas)
        total_cobrado = db.query(func.sum(Factura.total)).filter(
            Factura.periodo == periodo,
            Factura.estado_factura == 'pagada'
        ).scalar() or Decimal('0.00')
        
        # ========================================
        # ESTADÍSTICAS DE PAGOS DEL PERIODO
        # ========================================
        # Obtener IDs de facturas del periodo
        ids_facturas = [f.id_factura for f in facturas_query.all()]
        
        if ids_facturas:
            # Total de pagos registrados
            pagos_query = db.query(Pago).filter(
                Pago.id_factura.in_(ids_facturas),
                Pago.activo == True,
                Pago.estado_pago == 'REGISTRADO'
            )
            
            total_pagos_registrados = pagos_query.count()
            
            # Monto total recaudado (suma de pagos REGISTRADOS)
            total_recaudado = db.query(func.sum(Pago.monto_pago)).filter(
                Pago.id_factura.in_(ids_facturas),
                Pago.activo == True,
                Pago.estado_pago == 'REGISTRADO'
            ).scalar() or Decimal('0.00')
            
            # Recaudación por método de pago
            total_efectivo = db.query(func.sum(Pago.monto_pago)).filter(
                Pago.id_factura.in_(ids_facturas),
                Pago.activo == True,
                Pago.estado_pago == 'REGISTRADO',
                Pago.metodo_pago == 'EFECTIVO'
            ).scalar() or Decimal('0.00')
            
            total_transferencia = db.query(func.sum(Pago.monto_pago)).filter(
                Pago.id_factura.in_(ids_facturas),
                Pago.activo == True,
                Pago.estado_pago == 'REGISTRADO',
                Pago.metodo_pago == 'TRANSFERENCIA'
            ).scalar() or Decimal('0.00')
            
            total_tarjeta = db.query(func.sum(Pago.monto_pago)).filter(
                Pago.id_factura.in_(ids_facturas),
                Pago.activo == True,
                Pago.estado_pago == 'REGISTRADO',
                Pago.metodo_pago == 'TARJETA'
            ).scalar() or Decimal('0.00')
        else:
            total_pagos_registrados = 0
            total_recaudado = Decimal('0.00')
            total_efectivo = Decimal('0.00')
            total_transferencia = Decimal('0.00')
            total_tarjeta = Decimal('0.00')
        
        # ========================================
        # CONSTRUIR RESPUESTA
        # ========================================
        estadisticas = {
            # Facturas
            "total_facturas": total_facturas,
            "facturas_pendientes": facturas_pendientes,
            "facturas_pagadas": facturas_pagadas,
            "facturas_vencidas": facturas_vencidas,
            "facturas_anuladas": facturas_anuladas,
            
            # Montos
            "total_facturado": float(total_facturado),
            "total_pendiente": float(total_pendiente),
            "total_cobrado": float(total_cobrado),
            
            # Pagos
            "total_pagos_registrados": total_pagos_registrados,
            "total_recaudado": float(total_recaudado),
            "total_efectivo": float(total_efectivo),
            "total_transferencia": float(total_transferencia),
            "total_tarjeta": float(total_tarjeta),
            
            # Periodo
            "periodo": periodo
        }
        
        print(f" Estadísticas del periodo {periodo}:")
        print(f"   📊 Total facturas: {total_facturas}")
        print(f"   💰 Total recaudado: ${total_recaudado}")
        print(f"    Facturas pagadas: {facturas_pagadas}")
        
        return estadisticas
        
    except Exception as e:
        print(f"❌ Error obteniendo estadísticas: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Error al obtener estadísticas: {str(e)}"
        )



# ========================================
# OBTENER PAGO POR ID
# ========================================
@router.get("/{id_pago}", response_model=PagoResponse)
def obtener_pago(
    id_pago: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """Obtiene un pago específico con todos sus detalles"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "pagos", "lectura")
    
    pago = db.query(Pago).options(
        joinedload(Pago.factura),
        joinedload(Pago.usuario_afiliado).joinedload(UsuarioAfiliado.usuario_sistema),
        joinedload(Pago.cajero)
    ).filter(Pago.id_pago == id_pago).first()
    
    if not pago:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pago no encontrado"
        )
    
    return pago


# ========================================
# OBTENER UNA FACTURA ESPECÍFICA POR ID
# ========================================
@router.get("/facturas/{id_factura}", response_model=dict)
def obtener_factura_por_id(
    id_factura: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Obtiene una factura específica con sus pagos, detalles y saldo actualizado
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "pagos", "lectura")
    
    try:
        # 🔹 OBTENER LA FACTURA
        factura = db.query(Factura).options(
            joinedload(Factura.usuario_afiliado).joinedload(UsuarioAfiliado.usuario_sistema),
            joinedload(Factura.usuario_afiliado).joinedload(UsuarioAfiliado.sector),
            joinedload(Factura.detalles)
        ).filter(Factura.id_factura == id_factura).first()
        
        if not factura:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Factura no encontrada"
            )
        
        # 🔹 OBTENER TODOS LOS PAGOS DE LA FACTURA
        pagos = db.query(Pago).options(
            joinedload(Pago.cajero)
        ).filter(
            Pago.id_factura == id_factura,
            Pago.estado_pago == 'REGISTRADO'
        ).order_by(Pago.fecha_pago.desc()).all()
        
        # 🔹 CALCULAR TOTAL PAGADO (solo pagos REGISTRADOS)
        total_pagado = sum(float(pago.monto_pago) for pago in pagos)
        
        # 🔹 CALCULAR SALDO PENDIENTE
        saldo_pendiente = max(0, float(factura.total) - total_pagado)
        
        # 🔹 DETERMINAR ESTADO REAL DE LA FACTURA
        if factura.estado_factura == 'anulada':
            estado_final = 'anulada'
        elif saldo_pendiente <= 0.01:  # Tolerancia de 1 centavo
            estado_final = 'pagada'
        elif total_pagado > 0 and saldo_pendiente > 0:
            estado_final = 'parcial'
        elif getattr(factura, "fecha_vencimiento", None) and factura.fecha_vencimiento < date.today():
            estado_final = 'vencida'
        else:
            estado_final = 'pendiente'
        
        # 🔹 CONSTRUIR RESPUESTA
        usuario_afiliado = factura.usuario_afiliado
        usuario_sistema = usuario_afiliado.usuario_sistema if usuario_afiliado else None
        sector = usuario_afiliado.sector if usuario_afiliado and usuario_afiliado.sector else None
        medidor = None
        if factura.id_lectura:
            medidor = (
                db.query(Medidor)
                .join(Lectura, Medidor.id_medidor == Lectura.id_medidor)
                .filter(Lectura.id_lectura == factura.id_lectura)
                .first()
            )

        tasa_iva, iva_config = obtener_configuracion_iva(db)
        base_iva_detalles, iva_calculado_detalles = calcular_iva_sobre_detalles(
            factura.detalles or [],
            tasa_iva,
            factura.descuento or Decimal("0.00")
        )
        detalles_gravados_iva = [
            detalle for detalle in (factura.detalles or [])
            if detalle_grava_iva(detalle)
        ]
        
        resultado = {
            "id_factura": factura.id_factura,
            "num_factura": factura.num_factura,
            "fecha_emision": factura.fecha_emision.isoformat() if factura.fecha_emision else None,
            "fecha_vencimiento": getattr(factura, "fecha_vencimiento", None).isoformat() if getattr(factura, "fecha_vencimiento", None) else None,
            "periodo": factura.periodo,
            "mes_facturado": getattr(factura, "mes_facturado", None),
            "anio_facturado": getattr(factura, "anio_facturado", None),
            "consumo_m3": float(factura.consumo_m3) if factura.consumo_m3 else 0,
            "subtotal": float(factura.subtotal) if factura.subtotal else 0.0,
            "descuento": float(factura.descuento) if factura.descuento else 0,
            "impuesto": float(factura.impuesto) if factura.impuesto else 0,
            "total": float(factura.total),
            "estado_factura": estado_final,  # ✅ Estado calculado dinámicamente
            "observaciones": getattr(factura, "observaciones", None),
            "saldo_pendiente": saldo_pendiente,  # ✅ Saldo real calculado
            "monto_pagado": total_pagado,
            "esta_totalmente_pagada": saldo_pendiente <= 0.01,
            "id_usuario_afi": usuario_afiliado.id_usuario_afi if usuario_afiliado else None,
            "cod_usuario_afi": usuario_afiliado.cod_usuario_afi if usuario_afiliado else None,
            "nombre_completo": f"{usuario_sistema.nombres or ''} {usuario_sistema.apellidos or ''}".strip() if usuario_sistema else None,
            "cedula": usuario_sistema.cedula if usuario_sistema else None,
            "direccion": usuario_sistema.direccion if usuario_sistema else None,
            "telefono": usuario_sistema.telefono if usuario_sistema else None,
            "email": usuario_sistema.email if usuario_sistema else None,
            "id_medidor": medidor.id_medidor if medidor else None,
            "num_medidor": medidor.num_medidor if medidor else None,
            "nombre_sector": sector.nombre_sector if sector else None,
            "iva_info": {
                "id_iva": iva_config.id_iva if iva_config else None,
                "codigo": iva_config.codigo if iva_config else "N/A",
                "descripcion": iva_config.descripcion if iva_config else "Sin IVA activo",
                "porcentaje": float(iva_config.porcentaje) if iva_config else 0.0,
                "tasa": float(tasa_iva),
                "activo": bool(iva_config.activo) if iva_config else False,
                "es_aplicable": bool(iva_config.es_aplicable) if iva_config else False,
                "base_imponible": float(base_iva_detalles),
                "monto_calculado": float(iva_calculado_detalles),
                "valor": float(factura.impuesto) if factura.impuesto else 0.0,
                "monto_factura": float(factura.impuesto) if factura.impuesto else 0.0,
                "conceptos_gravados": len(detalles_gravados_iva),
                "regla": "Solo servicios externos/adicionales; no consumo de agua, multas, mora, aportes ni convenios"
            },
            
            # Usuario afiliado
            "usuario_afiliado": {
                "id_usuario_afi": usuario_afiliado.id_usuario_afi,
                "cod_usuario_afi": usuario_afiliado.cod_usuario_afi,
                "num_medidor": medidor.num_medidor if medidor else None,
                "usuario_sistema": {
                    "nombre_completo": f"{usuario_sistema.nombres or ''} {usuario_sistema.apellidos or ''}".strip() if usuario_sistema else None,
                    "nombres": usuario_sistema.nombres if usuario_sistema else None,
                    "apellidos": usuario_sistema.apellidos if usuario_sistema else None,
                    "cedula": usuario_sistema.cedula if usuario_sistema else None,
                    "direccion": usuario_sistema.direccion if usuario_sistema else None,
                    "telefono": usuario_sistema.telefono if usuario_sistema else None,
                    "email": usuario_sistema.email if usuario_sistema else None,
                } if usuario_sistema else None,
                "sector": {
                    "nombre_sector": sector.nombre_sector if sector else None
                } if sector else None
            } if usuario_afiliado else None,
            
            # Detalles de la factura
            "detalles": [
                {
                    "id_detalle": detalle.id_detalle,
                    "tipo_detalle": detalle.tipo_detalle,
                    "descripcion": detalle.descripcion,
                    "subtotal_detalle": float(detalle.subtotal_detalle) if detalle.subtotal_detalle else 0,
                    "grava_iva": detalle_grava_iva(detalle),
                    "id_servicio": detalle.id_servicio,
                    "id_multa_afiliados": detalle.id_multa_afiliados
                }
                for detalle in factura.detalles
            ] if factura.detalles else [],
            
            # Pagos de la factura
            "pagos": [
                {
                    "id_pago": pago.id_pago,
                    "monto_pago": float(pago.monto_pago),
                    "metodo_pago": pago.metodo_pago,
                    "fecha_pago": pago.fecha_pago.isoformat() if pago.fecha_pago else None,
                    "estado_pago": pago.estado_pago,
                    "observaciones": pago.observaciones,
                    "tiene_comprobante": pago.comprobante_pdf is not None,
                    "nombre_archivo": pago.nombre_archivo,
                    "usuario_cajero": {
                        "nombres": pago.cajero.nombres if pago.cajero else None,
                        "apellidos": pago.cajero.apellidos if pago.cajero else None,
                        "nombre_completo": f"{pago.cajero.nombres or ''} {pago.cajero.apellidos or ''}".strip() if pago.cajero else None
                    } if pago.cajero else None
                }
                for pago in pagos
            ],
            "cantidad_pagos": len(pagos)
        }
        
        return resultado
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Error al obtener factura: {str(e)}"
        )



# ========================================
# OBTENER PAGOS DE UN AFILIADO
# ========================================
@router.get("/afiliado/{id_usuario_afi}", response_model=List[PagoResponse])
def obtener_pagos_por_afiliado(
    id_usuario_afi: int,
    periodo: Optional[str] = Query(None, description="Filtrar por periodo (YYYY-MM)"),
    estado_pago: Optional[str] = Query(None, description="Filtrar por estado"),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """Obtiene todos los pagos de un afiliado específico"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "pagos", "lectura")
    
    # Verificar que el afiliado existe
    afiliado = db.query(UsuarioAfiliado).filter(
        UsuarioAfiliado.id_usuario_afi == id_usuario_afi
    ).first()
    
    if not afiliado:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Afiliado no encontrado"
        )
    
    query = db.query(Pago).options(
        joinedload(Pago.factura),
        joinedload(Pago.cajero)
    ).filter(Pago.id_usuario_afi == id_usuario_afi)
    
    # Filtros opcionales
    if periodo:
        try:
            anio, mes = periodo.split('-')
            query = query.filter(
                extract('year', Pago.fecha_pago) == int(anio),
                extract('month', Pago.fecha_pago) == int(mes)
            )
        except:
            pass
    
    if estado_pago:
        query = query.filter(Pago.estado_pago == estado_pago)
    
    pagos = query.order_by(Pago.fecha_pago.desc()).all()
    return pagos


@router.get("/calcular-resumen/{factura_id}")
def calcular_resumen_pago(
    factura_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Calcula el resumen completo del pago incluyendo mora ANTES de registrarlo.
    CONSIDERA PAGOS ANTERIORES para calcular el saldo pendiente real.
    FILTRA MULTAS YA PAGADAS usando el estado en MultaAfiliado.
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "pagos", "lectura")
    
    try:
        # ========================================
        # PASO 1: VALIDAR Y OBTENER FACTURA
        # ========================================
        factura = validar_factura_para_pago(factura_id, db)
        
        # 🔹 CALCULAR PAGOS ANTERIORES
        from sqlalchemy import func
        total_pagado_anterior = db.query(func.sum(Pago.monto_pago)).filter(
            Pago.id_factura == factura_id,
            Pago.estado_pago == 'REGISTRADO'
        ).scalar() or Decimal('0.00')
        
        print(f"\n{'='*60}")
        print(f"📊 CALCULANDO RESUMEN - Factura #{factura.num_factura}")
        print(f"{'='*60}")
        print(f"   Total factura original: ${factura.total}")
        print(f"   Total pagado anteriormente: ${total_pagado_anterior}")
        print(f"   Subtotal factura: ${factura.subtotal}")
        print(f"   Impuesto factura: ${factura.impuesto}")
        
        tasa_impuesto, _ = obtener_configuracion_iva(db)
        print(f"   IVA configurado: {float(tasa_impuesto * 100):.2f}% (solo servicios gravados)")
        
        # ========================================
        # PASO 2: OBTENER DETALLES DE LA FACTURA
        # ========================================
        from models.multa_afiliado import MultaAfiliado
        from sqlalchemy.orm import outerjoin
        
        detalles_query = db.query(
            DetalleFactura,
            MultaAfiliado.estado.label('estado_multa'),
            MultaAfiliado.id_multa_afi
        ).outerjoin(
            MultaAfiliado,
            DetalleFactura.id_multa_afiliados == MultaAfiliado.id_multa_afi
        ).filter(
            DetalleFactura.id_factura == factura_id
        ).all()
        
        # 🔹 SEPARAR DETALLES POR TIPO Y ESTADO DE PAGO
        subtotal_consumo = Decimal('0.00')
        subtotal_servicios = Decimal('0.00')
        subtotal_servicios_gravados = Decimal('0.00')
        subtotal_multas_pendientes = Decimal('0.00')
        subtotal_multas_pagadas = Decimal('0.00')
        detalles_multas_pendientes = []
        detalles_multas_pagadas = []
        
        for result in detalles_query:
            detalle = result.DetalleFactura
            estado_multa = result.estado_multa
            
            if detalle.tipo_detalle == 'consumo':
                subtotal_consumo += detalle.subtotal_detalle
                
            elif detalle.tipo_detalle == 'servicio':
                subtotal_servicios += detalle.subtotal_detalle
                if detalle_grava_iva(detalle):
                    subtotal_servicios_gravados += detalle.subtotal_detalle
                
            elif detalle.tipo_detalle == 'multa':
                if estado_multa and estado_multa in ('pagada', 'liberada'):
                    subtotal_multas_pagadas += detalle.subtotal_detalle
                    detalles_multas_pagadas.append({
                        "id_detalle": detalle.id_detalle,
                        "id_multa_afi": result.id_multa_afi,
                        "descripcion": detalle.descripcion or "Multa",
                        "subtotal": float(detalle.subtotal_detalle),
                        "estado": estado_multa
                    })
                else:
                    subtotal_multas_pendientes += detalle.subtotal_detalle
                    detalles_multas_pendientes.append({
                        "id_detalle": detalle.id_detalle,
                        "id_multa_afi": result.id_multa_afi,
                        "descripcion": detalle.descripcion or "Multa",
                        "subtotal": float(detalle.subtotal_detalle),
                        "estado": estado_multa or 'pendiente'
                    })
        
        print(f"\n📋 DETALLES:")
        print(f"   Consumo: ${subtotal_consumo}")
        print(f"   Servicios: ${subtotal_servicios} (gravados IVA: ${subtotal_servicios_gravados})")
        print(f"   Multas pendientes: ${subtotal_multas_pendientes} ({len(detalles_multas_pendientes)} items)")
        print(f"   Multas pagadas/liberadas: ${subtotal_multas_pagadas} ({len(detalles_multas_pagadas)} items)")
        
        # ========================================
        # PASO 3: CALCULAR MONTOS CON/SIN MULTAS
        # ========================================
        
        # 🔹 SIN MULTAS: Solo consumo y servicios
        subtotal_sin_multas = subtotal_consumo + subtotal_servicios
        
        # Aplicar descuento proporcional si existe
        descuento_sin_multas = Decimal('0.00')
        if factura.descuento and factura.descuento > 0 and factura.subtotal > 0:
            # Calcular proporción del subtotal sin multas sobre el subtotal total (excluyendo multas pagadas)
            subtotal_base = factura.subtotal - subtotal_multas_pagadas
            if subtotal_base > 0:
                proporcion = subtotal_sin_multas / subtotal_base
                descuento_sin_multas = factura.descuento * proporcion
        
        # 🆕 Calcular con IVA usando la tasa de la factura
        base_sin_multas = subtotal_sin_multas - descuento_sin_multas
        detalles_sin_multas = [r.DetalleFactura for r in detalles_query if r.DetalleFactura.tipo_detalle != 'multa']
        _, iva_sin_multas = calcular_iva_sobre_detalles(
            detalles_sin_multas,
            tasa_impuesto,
            descuento_sin_multas
        )
        total_sin_multas = base_sin_multas + iva_sin_multas
        
        # 🔹 CON MULTAS PENDIENTES: Consumo + servicios + multas pendientes
        subtotal_con_multas_pendientes = subtotal_sin_multas + subtotal_multas_pendientes
        
        # Aplicar descuento sobre el subtotal completo
        descuento_aplicable = factura.descuento if factura.descuento else Decimal('0.00')
        base_con_multas = subtotal_con_multas_pendientes - descuento_aplicable
        
        # 🆕 Calcular IVA sobre la base con multas
        _, iva_con_multas = calcular_iva_sobre_detalles(
            [r.DetalleFactura for r in detalles_query],
            tasa_impuesto,
            descuento_aplicable
        )
        total_con_multas_pendientes = base_con_multas + iva_con_multas
        
        # 🔹 SOLO MULTAS PENDIENTES sin IVA
        iva_multas_pendientes = Decimal('0.00')
        total_solo_multas_pendientes = subtotal_multas_pendientes + iva_multas_pendientes
        
        # ========================================
        # 🔹 CÁLCULO INTELIGENTE DE SALDOS
        # ========================================
        
        # Calcular cuánto se pagó de MULTAS y cuánto de CONSUMOS
        total_multas_con_iva = subtotal_multas_pagadas
        
        # Si ya pagaste las multas, ese dinero NO cuenta para consumos
        if total_pagado_anterior >= total_multas_con_iva:
            # Se pagaron las multas completas, el resto fue para consumos
            monto_pagado_consumos = total_pagado_anterior - total_multas_con_iva
            print(f"   📊 Multas pagadas (con IVA): ${total_multas_con_iva}")
            print(f"   📊 Monto aplicado a consumos: ${monto_pagado_consumos}")
        else:
            # Solo se pagaron multas parcialmente
            monto_pagado_consumos = Decimal('0.00')
            print(f"   📊 Pago parcial de multas: ${total_pagado_anterior}")
            print(f"   📊 Monto aplicado a consumos: $0.00")
        
        # 🔹 CALCULAR SALDOS REALES
        saldo_sin_multas = max(Decimal('0.00'), total_sin_multas - monto_pagado_consumos)
        saldo_con_multas_pendientes = max(Decimal('0.00'), total_con_multas_pendientes - monto_pagado_consumos)
        
        print(f"\n💰 CÁLCULOS:")
        print(f"   Subtotal sin multas: ${subtotal_sin_multas}")
        print(f"   Descuento sin multas: ${descuento_sin_multas}")
        print(f"   Base sin multas: ${base_sin_multas}")
        print(f"   IVA sin multas: ${iva_sin_multas}")
        print(f"   Total sin multas (con IVA): ${total_sin_multas}")
        print(f"   ---")
        print(f"   Subtotal con multas pendientes: ${subtotal_con_multas_pendientes}")
        print(f"   Descuento aplicable: ${descuento_aplicable}")
        print(f"   Base con multas: ${base_con_multas}")
        print(f"   IVA con multas: ${iva_con_multas}")
        print(f"   Total con multas pendientes (con IVA): ${total_con_multas_pendientes}")
        print(f"   ---")
        print(f"   Total multas pagadas (con IVA): ${total_multas_con_iva}")
        print(f"   Monto pagado para consumos: ${monto_pagado_consumos}")
        print(f"   ✅ SALDO SIN MULTAS: ${saldo_sin_multas}")
        print(f"   ✅ SALDO CON MULTAS PENDIENTES: ${saldo_con_multas_pendientes}")
        print(f"   Solo multas pendientes: ${total_solo_multas_pendientes}")
        
        # ========================================
        # PASO 4: CALCULAR MORA (solo si hay saldo)
        # ========================================
        from utils.config_mora import (
            obtener_configuracion_mora_activa,
            calcular_dias_mora,  # ✅ FIRMA ACTUALIZADA
            calcular_fecha_inicio_mora,
            calcular_monto_mora,
            factura_tiene_mora_aplicada
        )

        monto_mora = Decimal('0.00')
        dias_mora_efectivos = 0
        dias_transcurridos = 0
        detalle_mora = ""
        tiene_mora_activa = False
        config_mora_nombre = None
        tipo_periodo_mora = None  
        periodo_gracia = None  
        fecha_inicio_mora = None

        # Solo calcular mora si hay saldo pendiente
        saldo_para_mora = saldo_sin_multas if subtotal_multas_pendientes == 0 else saldo_con_multas_pendientes

        if saldo_para_mora > 0:
            if not factura_tiene_mora_aplicada(factura_id, db):
                config_mora = obtener_configuracion_mora_activa(db)
                
                if config_mora:
                    tiene_mora_activa = True
                    config_mora_nombre = config_mora.nombre
                    tipo_periodo_mora = config_mora.tipo_periodo  
                    
                    # Información del periodo de gracia
                    if config_mora.tipo_periodo == 'dias':
                        periodo_gracia = f"{config_mora.dias_gracia} días"
                    else:
                        periodo_gracia = f"{config_mora.meses_gracia} meses"
                    
                    #  Ahora recibe 3 parámetros y retorna tupla
                    fecha_inicio_mora = calcular_fecha_inicio_mora(factura, config_mora)
                    fecha_emision_date = factura.fecha_emision.date() if isinstance(factura.fecha_emision, datetime) else factura.fecha_emision
                    if fecha_emision_date:
                        dias_transcurridos = max(0, (date.today() - fecha_emision_date).days)

                    dias_mora_efectivos, aplica_mora = calcular_dias_mora(
                        factura, 
                        datetime.now(),
                        config_mora
                    )
                    
                    #  Verificar si aplica mora según la nueva lógica
                    if aplica_mora and dias_mora_efectivos > 0:
                        monto_mora, detalle_mora = calcular_monto_mora(
                            saldo_para_mora, 
                            dias_mora_efectivos, 
                            config_mora
                        )
                        print(f"   💰 Mora calculada sobre saldo de ${saldo_para_mora}: ${monto_mora}")
                        print(f"   📅 Días efectivos de mora: {dias_mora_efectivos}")
                    else:
                        if config_mora.tipo_periodo == 'dias':
                            detalle_mora = f"Sin mora (dentro de {config_mora.dias_gracia} días de gracia)"
                        else:
                            detalle_mora = f"Sin mora (dentro de {config_mora.meses_gracia} meses de gracia)"
                        print(f"   ✅ {detalle_mora}")
                else:
                    detalle_mora = "No hay configuración de mora activa"
                    print(f"   ⚠️ {detalle_mora}")
            else:
                # Mora ya aplicada anteriormente
                from utils.config_mora import obtener_mora_de_factura
                mora_existente = obtener_mora_de_factura(factura_id, db)
                if mora_existente:
                    monto_mora = mora_existente.monto_mora
                    dias_mora_efectivos = mora_existente.dias_mora
                    detalle_mora = "Mora ya aplicada previamente"
                    print(f"   ⚠️ Mora existente: ${monto_mora}")
        else:
            detalle_mora = "Sin saldo pendiente, no aplica mora"
            print(f"   ✅ {detalle_mora}")


        # ========================================
        # PASO 5: CONSTRUIR RESUMEN COMPLETO
        # ========================================
        
        # 🔹 OPCIÓN 1: TODO (saldo con multas pendientes + mora)
        total_opcion_completa = saldo_con_multas_pendientes + monto_mora
        
        # 🔹 OPCIÓN 2: SIN MULTAS (saldo sin multas + mora)
        total_opcion_sin_multas = saldo_sin_multas + monto_mora
        
        print(f"\n📋 TOTALES A PAGAR:")
        print(f"   COMPLETO (con multas pendientes + mora): ${total_opcion_completa}")
        print(f"   SIN MULTAS (solo consumos + mora): ${total_opcion_sin_multas}")
        print(f"   Mora aplicable: ${monto_mora}")
        print(f"{'='*60}\n")
        
        resumen = {
            "factura": {
                "id_factura": factura.id_factura,
                "num_factura": factura.num_factura,
                "fecha_emision": factura.fecha_emision.isoformat(),
                "estado": factura.estado_factura,
                "periodo": factura.periodo,
                "total_original": float(factura.total),
                "total_pagado_anterior": float(total_pagado_anterior),
                "saldo_pendiente": float(saldo_con_multas_pendientes)
            },
            
            "iva": {
                "tasa": float(tasa_impuesto),
                "porcentaje": float(tasa_impuesto * 100),
                "es_exento": float(tasa_impuesto) == 0.0,
                "monto_original": float(factura.impuesto or 0)
            },
            
            "mora": {
                "tiene_configuracion_activa": tiene_mora_activa,
                "configuracion_nombre": config_mora_nombre,
                "tipo_periodo": tipo_periodo_mora,
                "periodo_gracia": periodo_gracia,
                "tiene_mora_aplicada": factura_tiene_mora_aplicada(factura_id, db),
                "monto": float(monto_mora),
                "dias_mora_efectivos": dias_mora_efectivos,
                "dias_transcurridos": dias_transcurridos,
                "detalle": detalle_mora,
                "aplica": float(monto_mora) > 0,
                "fecha_emision": factura.fecha_emision.isoformat() if factura.fecha_emision else None,
                "fecha_inicio_mora": fecha_inicio_mora.isoformat() if fecha_inicio_mora else None,
                "fecha_base_calculo": "fecha_emision"  
            },
            
            "multas": {
                "tiene_multas": len(detalles_multas_pendientes) > 0,
                "cantidad": len(detalles_multas_pendientes),
                "subtotal_sin_iva": float(subtotal_multas_pendientes),
                "iva": float(iva_multas_pendientes),
                "total_con_iva": float(total_solo_multas_pendientes),
                "detalles": detalles_multas_pendientes,
                "multas_pagadas": len(detalles_multas_pagadas),
                "subtotal_pagadas": float(subtotal_multas_pagadas)
            },
            
            "desglose": {
                "consumo_subtotal": float(subtotal_consumo),
                "servicios_subtotal": float(subtotal_servicios),
                "multas_pendientes_subtotal": float(subtotal_multas_pendientes),
                "multas_pagadas_subtotal": float(subtotal_multas_pagadas),
                "subtotal_total": float(factura.subtotal),
                "descuento": float(factura.descuento or 0),
                "base_imponible": float(factura.subtotal - (factura.descuento or 0)),
                "iva": float(factura.impuesto or 0),
                "total_factura": float(factura.total)
            },
            
            "totales": {
                "factura_original": float(factura.total),
                "pagado_anteriormente": float(total_pagado_anterior),
                "monto_pagado_multas": float(total_multas_con_iva),
                "monto_pagado_consumos": float(monto_pagado_consumos),
                
                "opcion_completa": {
                    "descripcion": "Pagar TODO (consumo + servicios + multas pendientes + mora)",
                    "subtotal": float(subtotal_con_multas_pendientes),
                    "descuento": float(descuento_aplicable),
                    "base": float(base_con_multas),
                    "iva": float(iva_con_multas),
                    "subtotal_con_iva": float(total_con_multas_pendientes),
                    "saldo_pendiente": float(saldo_con_multas_pendientes),
                    "mora": float(monto_mora),
                    "total_final": float(total_opcion_completa),
                    "incluye_multas": True
                },
                
                "opcion_sin_multas": {
                    "descripcion": "Pagar SIN multas (consumo + servicios + mora)",
                    "subtotal": float(subtotal_sin_multas),
                    "descuento": float(descuento_sin_multas),
                    "base": float(base_sin_multas),
                    "iva": float(iva_sin_multas),
                    "subtotal_con_iva": float(total_sin_multas),
                    "saldo_pendiente": float(saldo_sin_multas),
                    "mora": float(monto_mora),
                    "total_final": float(total_opcion_sin_multas),
                    "incluye_multas": False,
                    "multas_pendientes": float(total_solo_multas_pendientes)
                }
            },
            
            "recomendacion": {
                "mostrar_opciones": len(detalles_multas_pendientes) > 0,
                "mensaje": "Puede pagar sin multas. Las multas quedarán pendientes para la próxima factura." if len(detalles_multas_pendientes) > 0 else "Esta factura no tiene multas pendientes."
            }
        }
        
        return resumen
    
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al calcular resumen de pago: {str(e)}"
        )


# ========================================
# HELPER: CALCULAR MONTO PAGADO DE FACTURA
# ========================================

def calcular_monto_pagado_factura(factura: Factura) -> Decimal:
    """
    Calcula el monto total pagado de una factura sumando
    todos los pagos registrados (estado_pago = 'REGISTRADO').
    
    Args:
        factura: Objeto Factura
    
    Returns:
        Decimal: Monto total pagado
    """
    if not factura.pagos or len(factura.pagos) == 0:
        return Decimal('0.00')
    
    # Sumar solo pagos registrados (no anulados)
    monto_total = sum(
        Decimal(str(pago.monto_pago)) 
        for pago in factura.pagos 
        if pago.estado_pago == 'REGISTRADO' and pago.activo
    )
    
    return monto_total


def calcular_saldo_pendiente_factura(factura: Factura) -> Decimal:
    """
    Calcula el saldo pendiente de una factura.
    
    Args:
        factura: Objeto Factura
    
    Returns:
        Decimal: Saldo pendiente (total - monto_pagado)
    """
    total = Decimal(str(factura.total))
    monto_pagado = calcular_monto_pagado_factura(factura)
    saldo = total - monto_pagado
    
    return max(Decimal('0.00'), saldo)  # No puede ser negativo


# ========================================
# ENDPOINT: OBTENER FACTURAS PENDIENTES PARA MODAL DE DESGLOSE DE PENDIENTES
# ========================================
@router.get("/afiliado/{id_afiliado}/facturas-pendientes")
def obtener_facturas_pendientes_afiliado(
    id_afiliado: int,
    id_medidor: Optional[int] = Query(None, description="Número de medidor para filtrar facturas"),
    periodo_actual: Optional[str] = Query(None, description="Periodo actual en formato YYYY-MM"),
    aplicar_mora: bool = Query(False, description="Si True, registra mora en BD"),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Obtiene todas las facturas pendientes de un afiliado con desglose detallado.
    ✅ NUEVO: Incluye totales de consumo, servicios, multas y mora por factura
    """
    try:
        # 1. Validar y obtener periodo actual
        if not periodo_actual:
            hoy = date.today()
            periodo_actual = f"{hoy.year}-{hoy.month:02d}"
        
        # Validar formato de periodo (YYYY-MM)
        try:
            anio, mes = periodo_actual.split('-')
            if not (1 <= int(mes) <= 12 and len(anio) == 4):
                raise ValueError("Formato inválido")
        except:
            raise HTTPException(
                status_code=400,
                detail=f"Formato de periodo inválido. Use YYYY-MM (ej: 2026-01)"
            )
        
        print(f"\n{'='*60}")
        print(f"📋 CONSULTANDO FACTURAS PENDIENTES CON DESGLOSE")
        print(f"{'='*60}")
        print(f"Afiliado ID: {id_afiliado}")
        print(f"Periodo actual: {periodo_actual}")
        print(f"Aplicar mora: {aplicar_mora}")
        
        # 2. Buscar configuración de mora activa
        config_mora = obtener_configuracion_mora_activa(db)
        
        if config_mora:
            if config_mora.tipo_periodo == 'dias':
                print(f"⚙️ Configuración mora: {config_mora.nombre} ({config_mora.dias_gracia} días de gracia)")
            else:
                print(f"⚙️ Configuración mora: {config_mora.nombre} ({config_mora.meses_gracia} meses de gracia)")
        else:
            print(f"⚠️ No hay configuración de mora activa")
        
        # 3. Consultar facturas pendientes con relaciones
        from models.multa_afiliado import MultaAfiliado

        # ✅ CORRECTO: definir siempre como facturas_query desde el inicio
        facturas_query = db.query(Factura).filter(
            Factura.id_usuario_afi == id_afiliado,
            or_(
                Factura.estado_factura == 'pendiente',
                Factura.estado_factura == 'vencida',
                Factura.estado_factura == 'parcial'
            ),
            Factura.periodo < periodo_actual
        )

        # ✅ Filtrar por medidor si se proporciona
        if id_medidor:
            facturas_query = (
                facturas_query
                .join(Lectura, Factura.id_lectura == Lectura.id_lectura)
                .filter(Lectura.id_medidor == id_medidor)
            )

        # ✅ Cargar relaciones y ejecutar
        facturas_pendientes = facturas_query.options(
            joinedload(Factura.pagos),
            joinedload(Factura.detalles)
        ).order_by(Factura.fecha_emision.asc()).all()
        
        # 4. Procesar cada factura con desglose detallado
        facturas_procesadas = []
        
        # Totales generales
        total_adeudado_general = Decimal('0.00')
        total_consumo_general = Decimal('0.00')
        total_servicios_general = Decimal('0.00')
        total_multas_general = Decimal('0.00')
        total_mora_general = Decimal('0.00')
        
        fecha_actual = datetime.now()
        
        for factura in facturas_pendientes:
            # Verificar periodo
            if factura.periodo >= periodo_actual:
                print(f"⚠️ Factura {factura.num_factura} omitida (periodo {factura.periodo} >= {periodo_actual})")
                continue
            
            print(f"\n--- Procesando Factura {factura.num_factura} ---")
            
            tasa_impuesto, _ = obtener_configuracion_iva(db)
            
            # ========================================
            # OBTENER Y CLASIFICAR DETALLES
            # ========================================
            detalles_query = db.query(
                DetalleFactura,
                MultaAfiliado.estado.label('estado_multa')
            ).outerjoin(
                MultaAfiliado,
                DetalleFactura.id_multa_afiliados == MultaAfiliado.id_multa_afi
            ).filter(
                DetalleFactura.id_factura == factura.id_factura
            ).all()
            
            # Clasificar detalles por tipo
            subtotal_consumo = Decimal('0.00')
            subtotal_servicios = Decimal('0.00')
            subtotal_servicios_gravados = Decimal('0.00')
            subtotal_multas_pendientes = Decimal('0.00')
            subtotal_multas_pagadas = Decimal('0.00')
            cantidad_multas_pendientes = 0
            cantidad_servicios = 0
            
            for result in detalles_query:
                detalle = result.DetalleFactura
                estado_multa = result.estado_multa
                
                if detalle.tipo_detalle == 'consumo':
                    subtotal_consumo += detalle.subtotal_detalle
                    
                elif detalle.tipo_detalle == 'servicio':
                    subtotal_servicios += detalle.subtotal_detalle
                    if detalle_grava_iva(detalle):
                        subtotal_servicios_gravados += detalle.subtotal_detalle
                    cantidad_servicios += 1
                    
                elif detalle.tipo_detalle == 'multa':
                    if estado_multa and estado_multa in ('pagada', 'liberada'):
                        subtotal_multas_pagadas += detalle.subtotal_detalle
                    else:
                        subtotal_multas_pendientes += detalle.subtotal_detalle
                        cantidad_multas_pendientes += 1
            
            # ========================================
            # CALCULAR PAGOS ANTERIORES
            # ========================================
            from sqlalchemy import func
            total_pagado_anterior = db.query(func.sum(Pago.monto_pago)).filter(
                Pago.id_factura == factura.id_factura,
                Pago.estado_pago == 'REGISTRADO'
            ).scalar() or Decimal('0.00')
            
            # ========================================
            # CALCULAR MONTOS CON/SIN MULTAS
            # ========================================
            
            # SIN MULTAS: Solo consumo y servicios
            subtotal_sin_multas = subtotal_consumo + subtotal_servicios
            
            # Aplicar descuento proporcional
            descuento_sin_multas = Decimal('0.00')
            if factura.descuento and factura.descuento > 0 and factura.subtotal > 0:
                subtotal_base = factura.subtotal - subtotal_multas_pagadas
                if subtotal_base > 0:
                    proporcion = subtotal_sin_multas / subtotal_base
                    descuento_sin_multas = factura.descuento * proporcion
            
            base_sin_multas = subtotal_sin_multas - descuento_sin_multas
            detalles_sin_multas = [r.DetalleFactura for r in detalles_query if r.DetalleFactura.tipo_detalle != 'multa']
            _, iva_sin_multas = calcular_iva_sobre_detalles(
                detalles_sin_multas,
                tasa_impuesto,
                descuento_sin_multas
            )
            total_sin_multas = base_sin_multas + iva_sin_multas
            
            # CON MULTAS PENDIENTES
            subtotal_con_multas = subtotal_sin_multas + subtotal_multas_pendientes
            descuento_aplicable = factura.descuento if factura.descuento else Decimal('0.00')
            base_con_multas = subtotal_con_multas - descuento_aplicable
            _, iva_con_multas = calcular_iva_sobre_detalles(
                [r.DetalleFactura for r in detalles_query],
                tasa_impuesto,
                descuento_aplicable
            )
            total_con_multas = base_con_multas + iva_con_multas
            
            # ========================================
            # CALCULAR DISTRIBUCIÓN DE PAGOS
            # ========================================
            total_multas_con_iva = subtotal_multas_pagadas
            
            if total_pagado_anterior >= total_multas_con_iva:
                monto_pagado_consumos = total_pagado_anterior - total_multas_con_iva
            else:
                monto_pagado_consumos = Decimal('0.00')
            
            # Calcular saldos reales
            saldo_sin_multas = max(Decimal('0.00'), total_sin_multas - monto_pagado_consumos)
            saldo_con_multas = max(Decimal('0.00'), total_con_multas - monto_pagado_consumos)
            
            # ========================================
            # CALCULAR MORA
            # ========================================
            monto_mora = Decimal('0.00')
            dias_mora_efectivos = 0
            aplica_mora_flag = False
            mora_registrada = False
            
            saldo_para_mora = saldo_sin_multas if subtotal_multas_pendientes == 0 else saldo_con_multas
            
            if saldo_para_mora > 0:
                if aplicar_mora and config_mora:
                    # Aplicar y registrar mora en BD
                    monto_mora, mora_aplicada, detalle_mora = evaluar_y_aplicar_mora(
                        factura=factura,
                        fecha_pago=fecha_actual,
                        db=db
                    )
                    mora_registrada = mora_aplicada
                    
                elif config_mora:
                    # Solo calcular sin registrar
                    dias_mora_efectivos, aplica_mora_flag = calcular_dias_mora(
                        factura,
                        fecha_actual,
                        config_mora
                    )
                    
                    if aplica_mora_flag and dias_mora_efectivos > 0:
                        from utils.config_mora import obtener_monto_base_mora
                        monto_base = obtener_monto_base_mora(factura, config_mora, db)
                        monto_mora, detalle_mora = calcular_monto_mora(
                            monto_base=monto_base,
                            dias_mora=dias_mora_efectivos,
                            config_mora=config_mora
                        )
            
            # ========================================
            # CALCULAR TOTALES CON IVA
            # ========================================
            iva_consumo = Decimal('0.00')
            total_consumo_con_iva = subtotal_consumo + iva_consumo
            
            iva_servicios = subtotal_servicios_gravados * tasa_impuesto
            total_servicios_con_iva = subtotal_servicios + iva_servicios
            
            iva_multas = Decimal('0.00')
            total_multas_con_iva_pendientes = subtotal_multas_pendientes + iva_multas
            
            # Total con mora
            total_con_mora = saldo_con_multas + monto_mora
            
            # ========================================
            # AGREGAR A LISTA
            # ========================================
            factura_data = {
                "id_factura": factura.id_factura,
                "num_factura": factura.num_factura,
                "periodo": factura.periodo,
                "fecha_emision": factura.fecha_emision.isoformat(),
                "estado_factura": factura.estado_factura,
                "consumo_m3": float(factura.consumo_m3 or 0),
                
                # Totales de la factura
                "total_factura": float(factura.total),
                "monto_pagado": float(total_pagado_anterior),
                "saldo_pendiente": float(saldo_con_multas),
                
                # ✅ DESGLOSE POR CONCEPTOS (con IVA incluido)
                "desglose": {
                    "consumo": {
                        "subtotal": float(subtotal_consumo),
                        "iva": float(iva_consumo),
                        "total": float(total_consumo_con_iva)
                    },
                    "servicios": {
                        "cantidad": cantidad_servicios,
                        "subtotal": float(subtotal_servicios),
                        "iva": float(iva_servicios),
                        "total": float(total_servicios_con_iva)
                    },
                    "multas": {
                        "cantidad": cantidad_multas_pendientes,
                        "subtotal": float(subtotal_multas_pendientes),
                        "iva": float(iva_multas),
                        "total": float(total_multas_con_iva_pendientes)
                    }
                },
                
                # ✅ IVA
                "iva": {
                    "tasa": float(tasa_impuesto),
                    "porcentaje": float(tasa_impuesto * 100),
                    "monto_total": float(factura.impuesto or 0)
                },
                
                # ✅ MORA
                "mora": {
                    "dias_mora_efectivos": dias_mora_efectivos,
                    "aplica": float(monto_mora) > 0,
                    "monto": float(monto_mora),
                    "registrada": mora_registrada
                },
                
                # Total a pagar (saldo + mora)
                "total_con_mora": float(total_con_mora)
            }
            
            facturas_procesadas.append(factura_data)
            
            # Acumular totales generales
            total_adeudado_general += total_con_mora
            total_consumo_general += total_consumo_con_iva
            total_servicios_general += total_servicios_con_iva
            total_multas_general += total_multas_con_iva_pendientes
            total_mora_general += monto_mora
            
            print(f"   Consumo: ${total_consumo_con_iva}")
            print(f"   Servicios: ${total_servicios_con_iva}")
            print(f"   Multas: ${total_multas_con_iva_pendientes}")
            print(f"   Mora: ${monto_mora}")
            print(f"   Total: ${total_con_mora}")
        
        # 5. Calcular meses de adeudo
        periodos_unicos = set(f.periodo for f in facturas_pendientes if f.periodo < periodo_actual)
        meses_adeudo = len(periodos_unicos)
        
        # 6. Commit si se aplicó mora
        if aplicar_mora:
            db.commit()
            print(f"✅ Mora aplicada y registrada en BD")
        
        print(f"\n{'='*60}")
        print(f"📊 RESUMEN GENERAL DE ADEUDOS")
        print(f"{'='*60}")
        print(f"Periodo referencia: {periodo_actual}")
        print(f"Meses adeudados: {meses_adeudo}")
        print(f"Facturas pendientes: {len(facturas_procesadas)}")
        print(f"Total adeudado: ${total_adeudado_general:.2f}")
        print(f"  • Consumo: ${total_consumo_general:.2f}")
        print(f"  • Servicios: ${total_servicios_general:.2f}")
        print(f"  • Multas: ${total_multas_general:.2f}")
        print(f"  • Mora: ${total_mora_general:.2f}")
        print(f"{'='*60}\n")
        
        # 7. Retornar resultado con desglose
        return {
            "tiene_deuda": len(facturas_procesadas) > 0,
            "meses_adeudo": meses_adeudo,
            
            # ✅ TOTALES GENERALES CON DESGLOSE
            "total_adeudado": float(total_adeudado_general),
            "total_consumo": float(total_consumo_general),
            "total_servicios": float(total_servicios_general),
            "total_multas": float(total_multas_general),
            "total_mora": float(total_mora_general),
            
            "total_facturas_pendientes": len(facturas_procesadas),
            "periodo_referencia": periodo_actual,
            "mora_aplicada_en_bd": aplicar_mora,
            
            # Configuración de mora
            "configuracion_mora": {
                "activa": config_mora is not None,
                "nombre": config_mora.nombre if config_mora else None,
                "tipo_periodo": config_mora.tipo_periodo if config_mora else None,
                "periodo_gracia": (
                    f"{config_mora.dias_gracia} días" if config_mora and config_mora.tipo_periodo == 'dias' 
                    else f"{config_mora.meses_gracia} meses" if config_mora 
                    else None
                )
            } if config_mora else None,
            
            # ✅ FACTURAS CON DESGLOSE DETALLADO
            "facturas": facturas_procesadas
        }
        
    except HTTPException:
        raise
    except Exception as e:
        if aplicar_mora:
            db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Error al obtener facturas pendientes: {str(e)}"
        )


# ========================================
# CREAR NUEVO PAGO CON MORA
# ========================================
@router.post("/", response_model=PagoResponse, status_code=status.HTTP_201_CREATED)
def crear_pago(
    pago: PagoCreate,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Registra un nuevo pago con:
    - Opción de incluir/excluir multas
    - Cálculo y aplicación automática de mora
    - IVA dinámico de la configuración
    - Soporte para múltiples pagos parciales
    """
    t0 = time.perf_counter()
    t1 = time.perf_counter()
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "pagos", "crear")
    current_user_id = current_user.id_usuario_sistema
    _log_pago_tiempo("PAGO IND", "1 usuario/permisos", t1)
    
    # ========================================
    # PASO 1: OBTENER CONFIGURACIÓN DE IVA
    # ========================================
    t1 = time.perf_counter()
    from utils.facturacion import obtener_configuracion_iva
    tasa_impuesto, iva_config = obtener_configuracion_iva(db)
    _log_pago_tiempo("PAGO IND", "2 config iva", t1)
    print(f"📊 IVA aplicado: {float(tasa_impuesto * 100):.2f}%")
    
    # Variables de control
    factura = None
    monto_sin_multas = None
    multas_en_factura = []
    total_multas = Decimal('0.00')
    multas_liberadas = 0
    multas_procesadas = 0
    
    # Mora
    monto_mora = Decimal('0.00')
    mora_aplicada = False
    detalle_mora = ""
    
    # ========================================
    # PASO 2: VALIDAR FACTURA Y AFILIADO
    # ========================================
    t1 = time.perf_counter()
    if pago.id_factura:
        factura = validar_factura_para_pago(pago.id_factura, db)
        
        # Calcular montos con/sin multas
        monto_sin_multas, multas_en_factura, total_multas = calcular_montos_con_multas(
            factura, pago.incluir_multas, tasa_impuesto, db
        )
        
        # Validar monto del pago
        if not pago.incluir_multas and not pago.incluir_mora:
            validar_monto_pago(pago.monto_pago, monto_sin_multas, pago.incluir_multas)
    
    if pago.id_usuario_afi:
        validar_afiliado(pago.id_usuario_afi, db)
    _log_pago_tiempo("PAGO IND", "3 validar factura/afiliado/montos", t1)
    
    # ========================================
    # PASO 3: EVALUAR Y CALCULAR MORA
    # ========================================
    t1 = time.perf_counter()
    if pago.id_factura and factura and pago.incluir_mora:
        # ✅ Primero obtener la configuración para mostrar info
        from utils.config_mora import obtener_configuracion_mora_activa
        config_mora = obtener_configuracion_mora_activa(db)
        
        if config_mora:
            # ✅ NUEVO: Mostrar tipo de periodo en los logs
            if config_mora.tipo_periodo == 'dias':
                print(f"⚙️ Configuración mora: {config_mora.nombre} ({config_mora.dias_gracia} días de gracia)")
            else:
                print(f"⚙️ Configuración mora: {config_mora.nombre} ({config_mora.meses_gracia} meses de gracia)")
        
        # Evaluar y aplicar mora (esto ya funciona correctamente)
        monto_mora, mora_aplicada, detalle_mora = evaluar_y_aplicar_mora(
            factura=factura,
            fecha_pago=datetime.now(),
            db=db
        )
        monto_mora = redondear_dinero(monto_mora)
        if not mora_aplicada:
            from utils.config_mora import obtener_mora_de_factura
            mora_existente = obtener_mora_de_factura(factura.id_factura, db)
            if mora_existente:
                monto_mora = redondear_dinero(mora_existente.monto_mora)
                detalle_mora = "Mora aplicada previamente"
        
        if mora_aplicada:
            print(f"💰 MORA APLICADA: ${monto_mora}")
            print(f"   Detalle: {detalle_mora}")  # ✅ Mostrar detalle completo
        else:
            print(f"✅ Sin mora: {detalle_mora}")

    
    if factura and not pago.incluir_multas and pago.incluir_mora:
        validar_monto_pago(
            pago.monto_pago,
            redondear_dinero(monto_sin_multas + monto_mora),
            pago.incluir_multas
        )
    _log_pago_tiempo("PAGO IND", "4 calcular mora", t1)

    # ========================================
    # PASO 4: CALCULAR MONTO TOTAL A COBRAR
    # ========================================
    t1 = time.perf_counter()
    monto_total_cobrar = redondear_dinero(pago.monto_pago)
    
    print(f"\n{'='*60}")
    print(f"💰 RESUMEN DE COBRO")
    print(f"{'='*60}")
    print(f"   Monto a pagar: ${pago.monto_pago}")
    print(f"   Incluye multas: {pago.incluir_multas}")
    print(f"   Incluye mora: {pago.incluir_mora}")
    if mora_aplicada:
        print(f"   Mora incluida en el monto: ${monto_mora}")
    print(f"   = TOTAL A COBRAR: ${monto_total_cobrar}")
    print(f"{'='*60}\n")
    _log_pago_tiempo("PAGO IND", "5 preparar resumen", t1)
    
    try:
        # ========================================
        # PASO 5: CREAR REGISTRO DE PAGO
        # ========================================
        t1 = time.perf_counter()
        
        # Construir observaciones del pago
        observaciones_pago = pago.observaciones or ""

        if mora_aplicada:
            # ✅ MEJORADO: Incluir tipo de periodo en observaciones
            from utils.config_mora import obtener_configuracion_mora_activa
            config_mora = obtener_configuracion_mora_activa(db)
            
            if config_mora:
                if config_mora.tipo_periodo == 'dias':
                    tipo_periodo_txt = f"{config_mora.dias_gracia} días de gracia"
                else:
                    tipo_periodo_txt = f"{config_mora.meses_gracia} meses de gracia"
                
                obs_mora = f"[MORA APLICADA] ${monto_mora}. Configuración: {config_mora.nombre} ({tipo_periodo_txt}). {detalle_mora}"
            else:
                obs_mora = f"[MORA APLICADA] ${monto_mora}. {detalle_mora}"
            
            observaciones_pago = f"{obs_mora}\n{observaciones_pago}" if observaciones_pago else obs_mora

        
        nuevo_pago = Pago(
            id_factura=pago.id_factura,
            monto_pago=monto_total_cobrar,  
            fecha_pago=datetime.now(),
            metodo_pago=pago.metodo_pago,
            id_usuario_afi=pago.id_usuario_afi,
            id_cajero=pago.id_cajero,
            observaciones=observaciones_pago,
            activo=True,
            estado_pago='REGISTRADO'
        )
        
        db.add(nuevo_pago)
        db.flush()
        _log_pago_tiempo("PAGO IND", "6 insert pago/flush", t1)
        
        print(f"✅ Pago registrado: ID={nuevo_pago.id_pago}, Monto=${monto_total_cobrar}")
        
        # ========================================
        # PASO 6: PROCESAR FACTURA Y MULTAS
        # ========================================
        t1 = time.perf_counter()
        if pago.id_factura and factura:
            #  CALCULAR TOTAL PAGADO ACUMULADO
            total_pagado = db.query(func.sum(Pago.monto_pago)).filter(
                Pago.id_factura == pago.id_factura,
                Pago.estado_pago == 'REGISTRADO'
            ).scalar() or Decimal('0.00')
            
            print(f"\n{'='*70}")
            print(f"📊 ANÁLISIS DE PAGOS - Factura #{factura.num_factura}")
            print(f"{'='*70}")
            print(f"   Total factura (con todo): ${factura.total}")
            print(f"   Total sin multas: ${monto_sin_multas}")
            print(f"   Total solo multas: ${total_multas}")
            print(f"   Total pagado acumulado: ${total_pagado}")
            print(f"   Mora: ${monto_mora}")
            
            # Calcular totales esperados
            total_completo_esperado = factura.total + monto_mora
            total_sin_multas_esperado = monto_sin_multas + monto_mora
            
            print(f"   Total esperado completo: ${total_completo_esperado}")
            print(f"   Total esperado sin multas: ${total_sin_multas_esperado}")
            
            #  CALCULAR SALDO PENDIENTE (solo para logging)
            saldo_pendiente = max(Decimal('0.00'), total_completo_esperado - total_pagado)
            print(f"   Saldo pendiente calculado: ${saldo_pendiente}")
            
            #  DECISIÓN 1: ¿Se pagó TODO (consumo + servicios + multas)?
            if total_pagado >= total_completo_esperado:
                print(f"\n✅ FACTURA PAGADA COMPLETAMENTE")
                factura.estado_factura = 'pagada'
                
                # Procesar todas las multas como pagadas
                if len(multas_en_factura) > 0:
                    multas_procesadas = procesar_multas_pagadas(multas_en_factura, db)
                    print(f"   ✅ {multas_procesadas} multa(s) marcada(s) como pagadas")
            
            #  DECISIÓN 2: Pago ACTUAL incluye multas?
            elif pago.incluir_multas and len(multas_en_factura) > 0:
                print(f"\n🔄 PAGO INCLUYE MULTAS")
                # Si el pago actual incluye multas, procesarlas
                multas_procesadas = procesar_multas_pagadas(multas_en_factura, db)
                print(f"   ✅ {multas_procesadas} multa(s) marcada(s) como pagadas")
                
                # Verificar si ahora está completamente pagada
                if total_pagado >= total_completo_esperado:
                    factura.estado_factura = 'pagada'
                    print(f"   ✅ Factura ahora está PAGADA COMPLETA")
                else:
                    print(f"   ⚠️ Aún falta: ${saldo_pendiente}")
            
            #  DECISIÓN 3: Pago NO incluye multas
            elif not pago.incluir_multas:
                print(f"\n⚠️ PAGO SIN MULTAS")
                
                # Si se pagó el monto sin multas completo, liberar multas
                if total_pagado >= total_sin_multas_esperado:
                    print(f"   ✔ Se completó el pago sin multas")
                    
                    if len(multas_en_factura) > 0:
                        multas_liberadas = liberar_multas_no_pagadas(multas_en_factura, db)
                        
                        #  info a observaciones
                        obs_parcial = f"\n[PAGO PARCIAL SIN MULTAS] {multas_liberadas} multa(s) liberada(s) (${total_multas}). Pendientes para próxima facturación."
                        nuevo_pago.observaciones = (nuevo_pago.observaciones or "") + obs_parcial
                        print(f"   ⚠️ {multas_liberadas} multa(s) liberada(s) para próxima factura")
                        print(f"   📊 Saldo pendiente (solo multas): ${total_multas}")
                else:
                    # Aún no se completó el pago sin multas
                    saldo_restante = total_sin_multas_esperado - total_pagado
                    print(f"   ⏳ Pago parcial - Falta: ${saldo_restante}")
                    print(f"   📊 Saldo pendiente total: ${saldo_restante + total_multas}")
            
            print(f"   🔄 ACTUALIZANDO FACTURA:")
            print(f"      - Estado: {factura.estado_factura}")
            print(f"{'='*70}\n")
        _log_pago_tiempo("PAGO IND", "7 actualizar factura/multas", t1)
        
                # ========================================
        # PASO 7: COMMIT Y AUDITORÍA
        # ========================================
        t1 = time.perf_counter()
        
        # Guardar el ID ANTES del commit para no depender de refresh
        id_pago_nuevo = nuevo_pago.id_pago
        monto_pago_nuevo = nuevo_pago.monto_pago
        
        # ✅ Commit limpio — sin refresh dentro de la transacción con locks
        db.commit()
        _log_pago_tiempo("PAGO IND", "8 commit", t1)
        
        t1 = time.perf_counter()
        # ✅ Auditoría y notificación DESPUÉS del commit — nueva transacción limpia
        desc_auditoria = (
            f"Pago #{id_pago_nuevo} - Monto: ${monto_total_cobrar}"
            f" - Método: {pago.metodo_pago}"
        )
        
        if mora_aplicada and config_mora:  # config_mora ya existe del paso 3 ← reutilizar
            tipo_periodo_info = (
                f"{config_mora.dias_gracia}d"
                if config_mora.tipo_periodo == 'dias'
                else f"{config_mora.meses_gracia}m"
            )
            desc_auditoria += f" (Mora: ${monto_mora}, Config: {config_mora.nombre} [{tipo_periodo_info}])"
        elif mora_aplicada:
            desc_auditoria += f" (Mora: ${monto_mora})"

        if pago.incluir_multas and multas_procesadas > 0:
            desc_auditoria += f" ({multas_procesadas} multa(s) pagada(s))"
        if not pago.incluir_multas and multas_liberadas > 0:
            desc_auditoria += f" ({multas_liberadas} multa(s) liberada(s))"

        registrar_auditoria(
            db=db,
            accion="CREATE",
            descripcion=desc_auditoria,
            id_usuario=current_user_id
        )
        print(f"🟢 Auditoría registrada: {desc_auditoria}")

        mensaje_notif = f"Pago de ${monto_total_cobrar} registrado"
        if mora_aplicada:
            mensaje_notif += f" (incluye mora de ${monto_mora})"
        if pago.incluir_multas and multas_procesadas > 0:
            mensaje_notif += f". {multas_procesadas} multa(s) pagada(s)"
        if not pago.incluir_multas and multas_liberadas > 0:
            mensaje_notif += f". {multas_liberadas} multa(s) liberada(s)"

        registrar_notificacion(
            db=db,
            id_usuario=current_user_id,
            titulo="Pago registrado",
            mensaje=mensaje_notif,
            tipo="exito"
        )
        _log_pago_tiempo("PAGO IND", "9 auditoria/notificacion", t1)
        _log_pago_tiempo("PAGO IND", "TOTAL", t0)

        # ✅ Query nueva y limpia para retornar el pago — sin locks
        pago_final = db.query(Pago).filter(Pago.id_pago == id_pago_nuevo).first()
        return pago_final
        
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Error de integridad: verifique las relaciones"
        )
    except Exception as e:
        db.rollback()
        print(f"❌ ERROR CRÍTICO: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear pago: {str(e)}"
        )



# routes/pagos.py

from schemas.pago import (
    PagoMultipleCreate, 
    PagoMultipleResponse,
    PagoMultipleError,
    ValidacionPagoMultipleRequest,
    ValidacionPagoMultipleResponse,
    FacturaResumenPagoMultiple
)

# ========================================
# ENDPOINT PARA VALIDAR PAGO MÚLTIPLE
# ========================================

@router.post(
    "/multiple/validar",
    response_model=ValidacionPagoMultipleResponse,
    summary="Validar facturas para pago múltiple",
    description="Valida que las facturas seleccionadas puedan ser pagadas en un pago múltiple"
)
def validar_pago_multiple(
    request: ValidacionPagoMultipleRequest,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Valida las facturas antes de realizar el pago múltiple:
    - Verifica que todas existan y estén activas
    - Verifica que todas sean del mismo afiliado
    - Calcula saldos pendientes y mora
    - Detecta multas pendientes
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "pagos", "crear")
    
    from utils.facturacion import obtener_configuracion_iva
    from utils.config_mora import calcular_mora_factura, obtener_configuracion_mora_activa
    
    facturas_validacion = []
    errores = []
    advertencias = []
    total_a_pagar = Decimal('0.00')
    total_mora = Decimal('0.00')
    id_afiliado_verificado = request.id_usuario_afi
    
    try:
        tasa_impuesto, _ = obtener_configuracion_iva(db)
        
        for id_factura in request.ids_facturas:
            try:
                # Obtener factura
                factura = db.query(Factura).filter(
                    Factura.id_factura == id_factura,
                    Factura.activo == True  # 🔧 ASEGÚRATE QUE EL MODELO TENGA ESTE CAMPO
                ).first()
                
                if not factura:
                    errores.append(f"Factura {id_factura} no encontrada o inactiva")
                    facturas_validacion.append(ValidacionFacturaMultiple(
                        id_factura=id_factura,
                        es_valida=False,
                        saldo_pendiente=Decimal('0.00'),
                        tiene_multas=False,
                        mora_aplicable=Decimal('0.00'),
                        mensaje="Factura no encontrada o inactiva"
                    ))
                    continue
                
                # Validar mismo afiliado
                if id_afiliado_verificado and factura.id_usuario_afi != id_afiliado_verificado:
                    errores.append(f"Factura {id_factura} pertenece a otro afiliado")
                    facturas_validacion.append(ValidacionFacturaMultiple(
                        id_factura=id_factura,
                        es_valida=False,
                        saldo_pendiente=Decimal('0.00'),
                        tiene_multas=False,
                        mora_aplicable=Decimal('0.00'),
                        mensaje="Pertenece a otro afiliado"
                    ))
                    continue
                
                if not id_afiliado_verificado:
                    id_afiliado_verificado = factura.id_usuario_afi
                
                # Calcular saldo pendiente
                total_pagado = db.query(func.sum(Pago.monto_pago)).filter(
                    Pago.id_factura == id_factura,
                    Pago.estado_pago == 'REGISTRADO'
                ).scalar() or Decimal('0.00')
                
                saldo_pendiente = max(Decimal('0.00'), Decimal(str(factura.total)) - total_pagado)
                
                if saldo_pendiente <= 0:
                    errores.append(f"Factura {factura.num_factura} ya está totalmente pagada")
                    facturas_validacion.append(ValidacionFacturaMultiple(
                        id_factura=id_factura,
                        es_valida=False,
                        saldo_pendiente=Decimal('0.00'),
                        tiene_multas=False,
                        mora_aplicable=Decimal('0.00'),
                        mensaje="Ya está totalmente pagada"
                    ))
                    continue
                
                # Calcular mora para la validacion sin registrarla en BD.
                monto_mora = Decimal('0.00')
                config_mora = obtener_configuracion_mora_activa(db)
                if config_mora:
                    monto_mora, _, _ = calcular_mora_factura(
                        factura=factura,
                        fecha_pago=datetime.now(),
                        config_mora=config_mora,
                        db=db
                    )
                
                # Detectar multas
                multas = db.query(DetalleFactura).filter(
                    DetalleFactura.id_factura == id_factura,
                    DetalleFactura.tipo_detalle == 'multa',
                    DetalleFactura.activo == True
                ).all()
                
                tiene_multas = len(multas) > 0
                
                if tiene_multas:
                    advertencias.append(f"Factura {factura.num_factura} tiene multas pendientes")
                
                # Agregar a totales
                total_a_pagar += saldo_pendiente + monto_mora
                total_mora += monto_mora
                
                # Agregar validación exitosa
                facturas_validacion.append(ValidacionFacturaMultiple(
                    id_factura=id_factura,
                    es_valida=True,
                    saldo_pendiente=saldo_pendiente,
                    tiene_multas=tiene_multas,
                    mora_aplicable=monto_mora,
                    mensaje=None
                ))
                
            except Exception as e:
                errores.append(f"Error validando factura {id_factura}: {str(e)}")
                facturas_validacion.append(ValidacionFacturaMultiple(
                    id_factura=id_factura,
                    es_valida=False,
                    saldo_pendiente=Decimal('0.00'),
                    tiene_multas=False,
                    mora_aplicable=Decimal('0.00'),
                    mensaje=f"Error: {str(e)}"
                ))
        
        es_valido = len(errores) == 0 and len([f for f in facturas_validacion if f.es_valida]) >= 2
        
        return ValidacionPagoMultipleResponse(
            es_valido=es_valido,
            total_a_pagar=total_a_pagar,
            total_mora=total_mora,
            facturas=facturas_validacion,
            errores=errores,
            advertencias=advertencias
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al validar pago múltiple: {str(e)}"
        )


# ========================================
# ENDPOINT PARA CREAR PAGO MÚLTIPLE
# ========================================

@router.post(
    "/multiple",
    response_model=PagoMultipleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crear pago múltiple",
    description="Registra un pago que abarca múltiples facturas (2-5 facturas)"
)
def crear_pago_multiple(
    pago_multiple: PagoMultipleCreate,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Registra un pago múltiple para varias facturas:
    - Procesa cada factura individualmente
    - Calcula mora por factura
    - Maneja multas independientemente
    - Todo en una sola transacción (atomicidad)
    """
    t0 = time.perf_counter()
    t1 = time.perf_counter()
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "pagos", "crear")
    _log_pago_tiempo("PAGO MULT", "1 usuario/permisos", t1)
    
    # Obtener configuración de IVA
    t1 = time.perf_counter()
    from utils.facturacion import obtener_configuracion_iva
    from utils.config_mora import evaluar_y_aplicar_mora
    
    tasa_impuesto, iva_config = obtener_configuracion_iva(db)
    _log_pago_tiempo("PAGO MULT", "2 config iva/imports", t1)
    
    # Inicializar variables de control
    pagos_creados = []
    facturas_pagadas_completas = []
    facturas_pagadas_parciales = []
    detalle_facturas = []
    total_general = Decimal('0.00')
    total_mora = Decimal('0.00')
    detalles_texto = []
    
    try:
        print(f"\n{'='*80}")
        print(f"💰 INICIANDO PAGO MÚLTIPLE - {len(pago_multiple.facturas)} facturas")
        print(f"{'='*80}")
        
        # ========================================
        # PROCESAR CADA FACTURA
        # ========================================
        t_loop = time.perf_counter()
        for idx, item in enumerate(pago_multiple.facturas, 1):
            t_iter = time.perf_counter()
            print(f"\n📄 [{idx}/{len(pago_multiple.facturas)}] Procesando factura ID: {item.id_factura}")
            
            # Validar factura
            t_step = time.perf_counter()
            factura = validar_factura_para_pago(item.id_factura, db)
            _log_pago_tiempo("PAGO MULT", f"3.{idx} validar factura {item.id_factura}", t_step)
            
            # Calcular montos con/sin multas
            t_step = time.perf_counter()
            monto_sin_multas, multas_en_factura, total_multas = calcular_montos_con_multas(
                factura, item.incluir_multas, tasa_impuesto, db
            )
            _log_pago_tiempo("PAGO MULT", f"4.{idx} calcular montos/multas", t_step)
            
            # Evaluar mora solo si fue seleccionada en el pago
            monto_mora = Decimal('0.00')
            mora_aplicada = False
            detalle_mora = "Mora no incluida en este pago"
            if item.incluir_mora:
                t_step = time.perf_counter()
                monto_mora, mora_aplicada, detalle_mora = evaluar_y_aplicar_mora(
                    factura=factura,
                    fecha_pago=datetime.now(),
                    db=db
                )
                monto_mora = redondear_dinero(monto_mora)
                if not mora_aplicada:
                    from utils.config_mora import obtener_mora_de_factura
                    mora_existente = obtener_mora_de_factura(factura.id_factura, db)
                    if mora_existente:
                        monto_mora = redondear_dinero(mora_existente.monto_mora)
                        detalle_mora = "Mora aplicada previamente"
                _log_pago_tiempo("PAGO MULT", f"5.{idx} evaluar mora", t_step)
            
            # El frontend envia el monto final seleccionado para esta factura.
            monto_total_factura = redondear_dinero(item.monto_a_pagar)
            total_general += monto_total_factura
            total_mora += monto_mora
            
            print(f"   💵 Monto base: ${item.monto_a_pagar}")
            if mora_aplicada:
                print(f"   ⏱️ Mora: ${monto_mora}")
            print(f"   📊 Total factura: ${monto_total_factura}")
            
            # Construir observaciones
            obs_factura = f"[PAGO MÚLTIPLE {idx}/{len(pago_multiple.facturas)}]"
            if mora_aplicada:
                obs_factura += f" Mora: ${monto_mora}. {detalle_mora}"
            if pago_multiple.observaciones:
                obs_factura += f" | {pago_multiple.observaciones}"
            
            # Crear registro de pago
            t_step = time.perf_counter()
            nuevo_pago = Pago(
                id_factura=item.id_factura,
                monto_pago=monto_total_factura,
                fecha_pago=datetime.now(),
                metodo_pago=pago_multiple.metodo_pago,
                id_usuario_afi=pago_multiple.id_usuario_afi,
                id_cajero=pago_multiple.id_cajero,
                observaciones=obs_factura,
                activo=True,
                estado_pago='REGISTRADO'
            )
            
            db.add(nuevo_pago)
            db.flush()
            
            pagos_creados.append(nuevo_pago.id_pago)
            _log_pago_tiempo("PAGO MULT", f"6.{idx} insert pago/flush", t_step)
            print(f"   ✅ Pago registrado: ID={nuevo_pago.id_pago}")
            
            # Actualizar estado de factura
            t_step = time.perf_counter()
            total_pagado = db.query(func.sum(Pago.monto_pago)).filter(
                Pago.id_factura == item.id_factura,
                Pago.estado_pago == 'REGISTRADO'
            ).scalar() or Decimal('0.00')
            
            total_completo_esperado = Decimal(str(factura.total)) + monto_mora
            total_sin_multas_esperado = monto_sin_multas + monto_mora
            
            # Determinar estado
            esta_totalmente_pagada = False
            if total_pagado >= total_completo_esperado:
                factura.estado_factura = 'pagada'
                facturas_pagadas_completas.append(item.id_factura)
                esta_totalmente_pagada = True
                print(f"   ✅ Factura PAGADA COMPLETA")
                
                # Procesar multas como pagadas
                if len(multas_en_factura) > 0 and item.incluir_multas:
                    multas_procesadas = procesar_multas_pagadas(multas_en_factura, db)
                    print(f"   ✅ {multas_procesadas} multa(s) pagadas")
            
            elif item.incluir_multas and len(multas_en_factura) > 0:
                multas_procesadas = procesar_multas_pagadas(multas_en_factura, db)
                facturas_pagadas_parciales.append(item.id_factura)
                print(f"   🔄 Pago PARCIAL con multas ({multas_procesadas} multa(s))")
            
            elif not item.incluir_multas and total_pagado >= total_sin_multas_esperado:
                if len(multas_en_factura) > 0:
                    multas_liberadas = liberar_multas_no_pagadas(multas_en_factura, db)
                    obs_adicional = f"\n{multas_liberadas} multa(s) liberadas (${total_multas})"
                    nuevo_pago.observaciones += obs_adicional
                    facturas_pagadas_parciales.append(item.id_factura)
                    print(f"   ⚠️ Pago sin multas - {multas_liberadas} multa(s) liberadas")
            else:
                facturas_pagadas_parciales.append(item.id_factura)
                print(f"   🔄 Pago PARCIAL")
            
            # ========================================
            # 🔧 CORRECCIÓN: EXTRAER MES Y AÑO DEL CAMPO PERIODO
            # ========================================
            # El campo periodo tiene formato "YYYY-MM" (ejemplo: "2025-12")
            periodo_str = factura.periodo or "0000-00"
            
            try:
                # Separar año y mes
                if '-' in periodo_str:
                    anio_str, mes_str = periodo_str.split('-')
                    periodo_formato = f"{mes_str}/{anio_str}"  # Formato: MM/YYYY
                else:
                    periodo_formato = periodo_str  # Usar tal cual si no tiene formato esperado
            except:
                periodo_formato = periodo_str  # Fallback
            
            # Agregar detalle para respuesta
            detalles_texto.append(f"Factura #{factura.num_factura}: ${monto_total_factura}")
            
            detalle_facturas.append(FacturaResumenPagoMultiple(
                id_factura=factura.id_factura,
                num_factura=factura.num_factura,
                periodo=periodo_formato,  # 🔧 Usar el periodo formateado
                monto_pagado=monto_total_factura,
                mora_aplicada=monto_mora,
                estado_final=factura.estado_factura,
                esta_totalmente_pagada=esta_totalmente_pagada
            ))
            _log_pago_tiempo("PAGO MULT", f"7.{idx} actualizar factura/multas/respuesta", t_step)
            _log_pago_tiempo("PAGO MULT", f"ITER {idx}/{len(pago_multiple.facturas)}", t_iter)
        _log_pago_tiempo("PAGO MULT", "8 procesar todas facturas", t_loop)
        
        # ========================================
        # COMMIT TRANSACCIÓN
        # ========================================
        t1 = time.perf_counter()
        db.commit()
        _log_pago_tiempo("PAGO MULT", "9 commit", t1)
        
        print(f"\n{'='*80}")
        print(f"✅ PAGO MÚLTIPLE COMPLETADO")
        print(f"   💰 Total pagado: ${total_general}")
        print(f"   📋 Facturas procesadas: {len(pago_multiple.facturas)}")
        print(f"   ✅ Pagadas completas: {len(facturas_pagadas_completas)}")
        print(f"   🔄 Pagadas parciales: {len(facturas_pagadas_parciales)}")
        if total_mora > 0:
            print(f"   ⏱️ Mora total: ${total_mora}")
        print(f"{'='*80}\n")
        
        # Notificación
        registrar_notificacion(
            db=db,
            id_usuario=current_user.id_usuario_sistema,
            titulo="Pago múltiple registrado",
            mensaje=f"${total_general} pagados en {len(pago_multiple.facturas)} facturas. Mora: ${total_mora}",
            tipo="exito"
        )
        
        # Construir respuesta
        _log_pago_tiempo("PAGO MULT", "TOTAL antes respuesta", t0)
        return PagoMultipleResponse(
            success=True,
            total_pagado=total_general,
            cantidad_facturas=len(pago_multiple.facturas),
            pagos_creados=pagos_creados,
            facturas_pagadas_completas=facturas_pagadas_completas,
            facturas_pagadas_parciales=facturas_pagadas_parciales,
            detalle_mora_total=total_mora,
            observaciones="\n".join(detalles_texto),
            detalle_facturas=detalle_facturas
        )
        
    except Exception as e:
        db.rollback()
        print(f"❌ ERROR EN PAGO MÚLTIPLE: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al procesar pago múltiple: {str(e)}"
        )


# ========================================
# CALCULAR MONTOS DE FACTURA CON IVA DINÁMICO
# ========================================
@router.get("/factura/{id_factura}/montos", response_model=dict)
def obtener_montos_factura(
    id_factura: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Obtiene el desglose de montos de una factura (con y sin multas)
    USA IVA DINÁMICO de la configuración del sistema
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "pagos", "lectura")
    
    factura = db.query(Factura).filter(
        Factura.id_factura == id_factura
    ).first()
    
    if not factura:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Factura no encontrada"
        )
    
    #  OBTENER IVA DINÁMICO
    tasa_impuesto, iva_config = obtener_configuracion_iva(db)
    
    if not iva_config:
        print("⚠️ Advertencia: No hay configuración de IVA activa, usando 0%")
        tasa_impuesto = Decimal('0.00')
    
    print(f"📊 IVA Configurado: {float(tasa_impuesto * 100):.2f}%")
    
    # Obtener detalles
    detalles = db.query(DetalleFactura).filter(
        DetalleFactura.id_factura == id_factura
    ).all()
    
    #  SEPARAR MONTOS POR TIPO
    monto_multas = Decimal('0.00')
    subtotal_sin_multas = Decimal('0.00')
    detalles_multas = []
    detalles_consumo = []
    detalles_sin_multas = []
    
    for detalle in detalles:
        if detalle.tipo_detalle == 'multa':
            monto_multas += detalle.subtotal_detalle
            detalles_multas.append({
                'id_detalle': detalle.id_detalle,
                'id_multa_afiliados': detalle.id_multa_afiliados,
                'descripcion': detalle.descripcion,
                'monto': float(detalle.subtotal_detalle)
            })
        else:
            # Consumo, servicios, etc.
            subtotal_sin_multas += detalle.subtotal_detalle
            detalles_sin_multas.append(detalle)
            detalles_consumo.append({
                'id_detalle': detalle.id_detalle,
                'tipo': detalle.tipo_detalle,
                'descripcion': detalle.descripcion,
                'monto': float(detalle.subtotal_detalle)
            })
    
    #  CALCULAR DESCUENTO PROPORCIONAL
    descuento_sin_multas = Decimal('0.00')
    if factura.descuento and factura.descuento > 0 and factura.subtotal > 0:
        proporcion_sin_multas = subtotal_sin_multas / factura.subtotal
        descuento_sin_multas = factura.descuento * proporcion_sin_multas
    
    #  CALCULAR MONTOS SIN MULTAS
    base_imponible_sin_multas = subtotal_sin_multas - descuento_sin_multas
    _, impuesto_sin_multas = calcular_iva_sobre_detalles(
        detalles_sin_multas,
        tasa_impuesto,
        descuento_sin_multas
    )
    total_sin_multas = base_imponible_sin_multas + impuesto_sin_multas
    
    #  CALCULAR MONTOS SOLO MULTAS
    base_imponible_multas = monto_multas
    impuesto_multas = Decimal('0.00')
    total_multas_con_iva = monto_multas + impuesto_multas
    
    #  INFORMACIÓN DE IVA
    iva_info = None
    if iva_config:
        iva_info = {
            'id_iva': iva_config.id_iva,
            'porcentaje': float(iva_config.porcentaje),
            'descripcion': iva_config.descripcion,
            'activo': iva_config.activo,
            'es_aplicable': iva_config.es_aplicable
        }
    
    return {
        'id_factura': factura.id_factura,
        'num_factura': factura.num_factura,
        
        # Totales de la factura completa
        'total_factura': float(factura.total),
        'subtotal_factura': float(factura.subtotal),
        'impuesto_factura': float(factura.impuesto or 0),
        'descuento_factura': float(factura.descuento or 0),
        
        # Desglose de multas
        'subtotal_multas': float(monto_multas),
        'impuesto_multas': float(impuesto_multas),
        'total_multas': float(total_multas_con_iva),
        'cantidad_multas': len(detalles_multas),
        'detalles_multas': detalles_multas,
        
        # Desglose sin multas (CORRECTO con recalculo de IVA)
        'subtotal_sin_multas': float(subtotal_sin_multas),
        'descuento_sin_multas': float(descuento_sin_multas),
        'base_imponible_sin_multas': float(base_imponible_sin_multas),
        'impuesto_sin_multas': float(impuesto_sin_multas),
        'total_sin_multas': float(total_sin_multas),
        'detalles_consumo': detalles_consumo,
        
        # Flags
        'tiene_multas': monto_multas > 0,
        'tasa_impuesto': float(tasa_impuesto * 100),  # Como porcentaje
        'iva_aplicado': tasa_impuesto > 0,
        
        # Configuración de IVA
        'iva_config': iva_info,
        
        # Resumen completo
        'resumen': {
            'con_multas': {
                'subtotal': float(factura.subtotal),
                'descuento': float(factura.descuento or 0),
                'base_imponible': float((factura.subtotal or 0) - (factura.descuento or 0)),
                'impuesto': float(factura.impuesto or 0),
                'total': float(factura.total)
            },
            'sin_multas': {
                'subtotal': float(subtotal_sin_multas),
                'descuento': float(descuento_sin_multas),
                'base_imponible': float(base_imponible_sin_multas),
                'impuesto': float(impuesto_sin_multas),
                'total': float(total_sin_multas)
            },
            'solo_multas': {
                'subtotal': float(monto_multas),
                'impuesto': float(impuesto_multas),
                'total': float(total_multas_con_iva)
            }
        }
    }


# ========================================
# ACTUALIZAR PAGO
# ========================================
@router.put("/{id_pago}", response_model=PagoResponse)
def actualizar_pago(
    id_pago: int,
    pago_update: PagoUpdate,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Actualiza un pago existente
    Solo permite actualizar pagos en estado 'REGISTRADO'
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "pagos", "actualizar")
    
    pago = db.query(Pago).filter(Pago.id_pago == id_pago).first()
    
    if not pago:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pago no encontrado"
        )
    
    # Solo permitir actualizar pagos registrados
    if pago.estado_pago != 'REGISTRADO':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se puede modificar un pago en estado '{pago.estado_pago}'"
        )
    
    try:
        # Actualizar campos
        if pago_update.monto_pago is not None:
            pago.monto_pago = pago_update.monto_pago
        
        if pago_update.metodo_pago is not None:
            pago.metodo_pago = pago_update.metodo_pago
        
        if pago_update.observaciones is not None:
            pago.observaciones = pago_update.observaciones
        
        db.commit()
        db.refresh(pago)
        
        # Auditoría
        registrar_auditoria(
            db=db,
            accion="UPDATE",
            descripcion=f"Pago #{pago.id_pago} actualizado",
            id_usuario=current_user.id_usuario_sistema
        )
        
        return pago
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al actualizar pago: {str(e)}"
        )


def regenerar_factura_desde_factura_anulada(
    db: Session,
    factura_original: Factura,
    motivo_regeneracion: str = "Regenerada por anulación de pago"
) -> TypingTuple[bool, str, Optional[Factura], int]:
    """
    Regenera una factura con los mismos datos de una factura original
    Se usa cuando se anula un pago
    
    Args:
        db: Sesión de base de datos
        factura_original: Factura a duplicar
        motivo_regeneracion: Motivo de la regeneración
    
    Returns:
        (exito, mensaje, factura_nueva, multas_reactivadas)
    """
    try:
        from models.multa_afiliado import MultaAfiliado
        
        print(f"\n{'='*60}")
        print(f"🔄 REGENERANDO FACTURA")
        print(f"   Original: {factura_original.num_factura}")
        print(f"   Periodo: {factura_original.periodo}")
        print(f"   Motivo: {motivo_regeneracion}")
        print(f"{'='*60}\n")
        
        # ============================================
        # PASO 1: OBTENER DATOS DE LA FACTURA ORIGINAL
        # ============================================
        id_usuario_afi = factura_original.id_usuario_afi
        periodo = factura_original.periodo
        
        # ============================================
        # PASO 2: GENERAR NUEVO NÚMERO DE FACTURA
        # ============================================
        periodo_parts = periodo.split('-')
        anio = periodo_parts[0]
        mes = periodo_parts[1]
        
        # Buscar último número del periodo
        ultima_factura = (
            db.query(Factura)
            .filter(Factura.periodo == periodo)
            .filter(Factura.num_factura.like(f'FACT-{periodo}-%'))
            .order_by(Factura.num_factura.desc())
            .first()
        )
        
        if ultima_factura:
            ultimo_numero = int(ultima_factura.num_factura.split('-')[-1])
            nuevo_numero = ultimo_numero + 1
        else:
            nuevo_numero = 1
        
        nuevo_num_factura = f"FACT-{periodo}-{str(nuevo_numero).zfill(4)}"
        id_lectura_original = factura_original.id_lectura
        factura_original.estado_factura = 'anulada'
        factura_original.id_lectura = None
        db.flush()
        
        print(f"📝 Nuevo número de factura: {nuevo_num_factura}")
        
        # ============================================
        # PASO 3: CREAR NUEVA FACTURA
        # ============================================
        nueva_factura = Factura(
            num_factura=nuevo_num_factura,
            id_usuario_afi=id_usuario_afi,
            id_tarifa=factura_original.id_tarifa,
            id_lectura=id_lectura_original,
            periodo=periodo,
            fecha_emision=datetime.now().date(),
            consumo_m3=factura_original.consumo_m3,
            exceso_m3=factura_original.exceso_m3,
            valor_consumo=factura_original.valor_consumo,
            valor_exceso=factura_original.valor_exceso,
            subtotal=factura_original.subtotal,
            descuento=factura_original.descuento,
            impuesto=factura_original.impuesto,
            total=factura_original.total,
            estado_factura='pendiente'
        )
        
        db.add(nueva_factura)
        db.flush()
        
        print(f"✅ Nueva factura creada: {nueva_factura.num_factura}")
        print(f"   ID: {nueva_factura.id_factura}")
        print(f"   Total: ${nueva_factura.total}")
        
        # ============================================
        # PASO 4: COPIAR DETALLES Y REACTIVAR MULTAS
        # ============================================
        detalles_originales = db.query(DetalleFactura).filter(
            DetalleFactura.id_factura == factura_original.id_factura
        ).all()

        detalles_creados = 0
        multas_reactivadas = 0
        
        for detalle_orig in detalles_originales:
            # 🔹 Copiar el detalle con el nombre CORRECTO del campo
            nuevo_detalle = DetalleFactura(
                id_factura=nueva_factura.id_factura,
                tipo_detalle=detalle_orig.tipo_detalle,
                id_servicio=detalle_orig.id_servicio,
                id_multa_afiliados=detalle_orig.id_multa_afiliados,
                subtotal_detalle=detalle_orig.subtotal_detalle,
                descripcion=detalle_orig.descripcion
            )
            db.add(nuevo_detalle)
            detalles_creados += 1
            
            # 🔹 SI ES UNA MULTA, REACTIVARLA COMO PENDIENTE
            if detalle_orig.tipo_detalle == 'multa' and detalle_orig.id_multa_afiliados:
                multa_afiliado = db.query(MultaAfiliado).filter(
                    MultaAfiliado.id_multa_afi == detalle_orig.id_multa_afiliados 
                ).first()
                
                if multa_afiliado:
                    # Reactivar la multa
                    multa_afiliado.estado = 'pendiente'
                    multa_afiliado.facturado = False 
                    multa_afiliado.fecha_pago = None  # Limpiar fecha de pago
                    
                    multas_reactivadas += 1
                    print(f"   🚨 Multa Afiliado #{multa_afiliado.id_multa_afi} reactivada como PENDIENTE")
                else:
                    print(f"   ⚠️ Multa Afiliado #{detalle_orig.id_multa_afiliados} no encontrada en la tabla multas_afiliados")
            
            print(f"   📋 Detalle copiado: {detalle_orig.tipo_detalle} - "
                  f"id_servicio={detalle_orig.id_servicio}, "
                  f"id_multa_afiliados={detalle_orig.id_multa_afiliados}")

        print(f"✅ {detalles_creados} detalle(s) copiado(s)")
        if multas_reactivadas > 0:
            print(f"✅ {multas_reactivadas} multa(s) reactivada(s) como PENDIENTES")
        
        # ============================================
        # PASO 5: MARCAR FACTURA ORIGINAL COMO ANULADA
        # ============================================
        factura_original.estado_factura = 'anulada'
        
        print(f"✅ Factura original {factura_original.num_factura} marcada como ANULADA")
        
        # ============================================
        # PASO 6: DEJAR CAMBIOS LISTOS PARA EL COMMIT DEL ENDPOINT
        # ============================================
        db.flush()
        db.refresh(nueva_factura)
        
        print(f"\n{'='*60}")
        print(f"✅ FACTURA REGENERADA EXITOSAMENTE")
        print(f"   Original: {factura_original.num_factura} (ANULADA)")
        print(f"   Nueva: {nueva_factura.num_factura} (PENDIENTE)")
        print(f"   Total: ${nueva_factura.total}")
        print(f"   Periodo: {nueva_factura.periodo}")
        print(f"   Detalles: {detalles_creados}")
        print(f"   Multas reactivadas: {multas_reactivadas}")
        print(f"{'='*60}\n")
        
        return True, f"Factura {nueva_factura.num_factura} regenerada", nueva_factura, multas_reactivadas
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error regenerando factura: {e}")
        import traceback
        traceback.print_exc()
        return False, f"Error al regenerar factura: {str(e)}", None, 0


# ========================================
# ANULAR PAGO
# ========================================
@router.patch("/{id_pago}/anular")
def anular_pago(
    id_pago: int,
    request: dict,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Anula un pago y opcionalmente regenera la factura.
    Si no regenera, reactiva multas y cambios de medidor como pendientes.
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "pagos", "eliminar")
    
    # Extraer parámetros
    motivo = request.get('motivo', 'Anulado por usuario')
    regenerar_factura = request.get('regenerar_factura', False)
    
    print(f"\n{'='*60}")
    print(f"🔄 ANULANDO PAGO #{id_pago}")
    print(f"   Motivo: {motivo}")
    print(f"   Regenerar factura: {'SÍ' if regenerar_factura else 'NO'}")
    print(f"{'='*60}\n")
    
    # Buscar pago
    pago = db.query(Pago).filter(Pago.id_pago == id_pago).first()
    
    if not pago:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pago no encontrado"
        )
    
    if pago.estado_pago != 'REGISTRADO':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se puede anular un pago en estado '{pago.estado_pago}'"
        )
    
    try:
        from models.multa_afiliado import MultaAfiliado
        from models.HistorialMedidor import HistorialMedidor
        
        # ============================================
        # PASO 1: ANULAR EL PAGO
        # ============================================
        pago.estado_pago = 'ANULADO'
        pago.motivo_anulacion = motivo
        pago.fecha_anulacion = datetime.now()
        pago.activo = False
        
        print(f"✅ Pago #{pago.id_pago} anulado")
        
        # ============================================
        # PASO 2: BUSCAR LA FACTURA ASOCIADA
        # ============================================
        factura_original = None
        nueva_factura = None
        items_reactivados = 0
        
        if pago.id_factura:
            factura_original = db.query(Factura).filter(
                Factura.id_factura == pago.id_factura
            ).first()
            
            if factura_original:
                print(f"📄 Factura asociada: {factura_original.num_factura}")
                
                # ============================================
                # PASO 3: REGENERAR O SOLO ANULAR
                # ============================================
                if regenerar_factura:
                    # Regenerar factura completa con multas y cambios
                    exito, mensaje, nueva_factura, items_reactivados = regenerar_factura_desde_factura_anulada(
                        db=db,
                        factura_original=factura_original,
                        motivo_regeneracion=f"Regenerada por anulación de pago #{pago.id_pago}. Motivo: {motivo}"
                    )
                    
                    if not exito:
                        raise Exception(f"Error al regenerar factura: {mensaje}")
                else:
                    # 🆕 SOLO ANULAR: Marcar factura como anulada Y reactivar multas/cambios
                    factura_original.estado_factura = 'anulada'
                    print(f"⚠️ Factura {factura_original.num_factura} marcada como ANULADA (sin regeneración)")
                    
                    # 🆕 REACTIVAR MULTAS Y CAMBIOS DE MEDIDOR
                    id_usuario_afi = factura_original.id_usuario_afi
                    multas_reactivadas = 0
                    cambios_reactivados = 0
                    
                    # Buscar detalles de la factura anulada
                    detalles = db.query(DetalleFactura).filter(
                        DetalleFactura.id_factura == factura_original.id_factura
                    ).all()
                    
                    print(f"\n🔄 Reactivando items de la factura anulada...")
                    
                    for detalle in detalles:
                        # REACTIVAR MULTAS
                        if detalle.tipo_detalle == 'multa' and detalle.id_multa_afiliados:
                            multa = db.query(MultaAfiliado).filter(
                                MultaAfiliado.id_multa_afi == detalle.id_multa_afiliados
                            ).first()
                            
                            if multa:
                                multa.estado = 'pendiente'
                                multa.facturado = False
                                multa.fecha_pago = None
                                multas_reactivadas += 1
                                print(f"   🚨 Multa #{multa.id_multa_afi} reactivada (pendiente, no facturado)")
                        
                        # REACTIVAR CAMBIOS DE MEDIDOR
                        if detalle.tipo_detalle == 'servicio':
                            descripcion = (detalle.descripcion or '').lower()
                            
                            if 'cambio' in descripcion and 'medidor' in descripcion:
                                # Buscar cambios facturados que coincidan
                                cambios = db.query(HistorialMedidor).filter(
                                    HistorialMedidor.id_usuario_afi_nuevo == id_usuario_afi,
                                    HistorialMedidor.facturado == True,
                                    HistorialMedidor.costo_cambio == detalle.subtotal_detalle
                                ).all()
                                
                                for cambio in cambios:
                                    cambio.facturado = False
                                    cambios_reactivados += 1
                                    print(f"   🔄 Cambio Medidor #{cambio.id_historial} reactivado (no facturado)")
                                    break  # Solo el primero
                    
                    items_reactivados = multas_reactivadas + cambios_reactivados
                    
                    print(f"\n   ✅ Total items reactivados: {items_reactivados}")
                    print(f"      - Multas: {multas_reactivadas}")
                    print(f"      - Cambios de medidor: {cambios_reactivados}")
        
        # ============================================
        # PASO 4: COMMIT
        # ============================================
        db.commit()
        db.refresh(pago)
        
        # ============================================
        # PASO 5: AUDITORÍA
        # ============================================
        desc_auditoria = f"Pago #{pago.id_pago} anulado. Motivo: {motivo}."
        if nueva_factura:
            desc_auditoria += f" Nueva factura: {nueva_factura.num_factura}. Items reactivados: {items_reactivados}"
        else:
            desc_auditoria += f" Factura anulada sin regeneración. Items reactivados: {items_reactivados}"
        
        registrar_auditoria(
            db=db,
            accion="UPDATE",
            descripcion=desc_auditoria,
            id_usuario=current_user.id_usuario_sistema
        )
        
        # ============================================
        # PASO 6: PREPARAR RESPUESTA
        # ============================================
        response = {
            "pago_anulado": {
                "id_pago": pago.id_pago,
                "monto_pago": float(pago.monto_pago),
                "estado_pago": pago.estado_pago,
                "motivo_anulacion": pago.motivo_anulacion,
                "fecha_anulacion": pago.fecha_anulacion.isoformat() if pago.fecha_anulacion else None
            },
            "factura_original": {
                "id_factura": factura_original.id_factura,
                "num_factura": factura_original.num_factura,
                "estado_factura": factura_original.estado_factura
            } if factura_original else None,
            "nueva_factura": {
                "id_factura": nueva_factura.id_factura,
                "num_factura": nueva_factura.num_factura,
                "periodo": nueva_factura.periodo,
                "total": float(nueva_factura.total),
                "estado_factura": nueva_factura.estado_factura,
                "fecha_emision": nueva_factura.fecha_emision.isoformat()
            } if nueva_factura else None,
            "items_reactivados": items_reactivados,
            "regenerado": regenerar_factura
        }
        
        print(f"\n{'='*60}")
        print(f"✅ ANULACIÓN COMPLETADA")
        print(f"   Pago #{pago.id_pago}: ANULADO")
        if nueva_factura:
            print(f"   Nueva factura: {nueva_factura.num_factura}")
        else:
            print(f"   Factura original: {factura_original.num_factura} (ANULADA)")
        print(f"   Items reactivados: {items_reactivados}")
        print(f"{'='*60}\n")
        
        return response
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al anular el pago: {str(e)}"
        )



# ========================================
# ELIMINAR PAGO (Solo administradores)
# ========================================
@router.delete("/{id_pago}", status_code=status.HTTP_200_OK)
def eliminar_pago(
    id_pago: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Elimina físicamente un pago de la base de datos.
    Solo disponible para administradores.
    El pago debe estar anulado previamente.
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "pagos", "eliminar")
    
    pago = db.query(Pago).filter(Pago.id_pago == id_pago).first()
    
    if not pago:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pago no encontrado"
        )
    
    # Verificar que el pago esté anulado
    if pago.estado_pago != 'ANULADO':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo se pueden eliminar pagos anulados. Primero anule el pago."
        )
    
    try:
        # Guardar información para auditoría
        id_eliminado = pago.id_pago
        monto = pago.monto_pago
        
        # Eliminar el pago
        db.delete(pago)
        db.commit()
        
        # Auditoría
        registrar_auditoria(
            db=db,
            accion="DELETE",
            descripcion=f"Pago #{id_eliminado} eliminado físicamente - Monto: ${monto}",
            id_usuario=current_user.id_usuario_sistema
        )
        
        return {
            "success": True,
            "message": f"Pago #{id_eliminado} eliminado correctamente",
            "id_pago": id_eliminado
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al eliminar pago: {str(e)}"
        )


# ========================================
# REPORTE DE PAGOS POR RANGO DE FECHAS
# ========================================
@router.get("/reportes/por-fecha", response_model=dict)
def reporte_pagos_por_fecha(
    fecha_inicio: date = Query(..., description="Fecha de inicio del reporte"),
    fecha_fin: date = Query(..., description="Fecha de fin del reporte"),
    metodo_pago: Optional[str] = Query(None, description="Filtrar por método de pago"),
    estado_pago: Optional[str] = Query(None, description="Filtrar por estado"),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Genera un reporte de pagos en un rango de fechas
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "pagos", "lectura")
    
    # Construir query
    query = db.query(Pago).options(
        joinedload(Pago.factura),
        joinedload(Pago.usuario_afiliado).joinedload(UsuarioAfiliado.usuario_sistema),
        joinedload(Pago.cajero)
    ).filter(
        Pago.fecha_pago >= fecha_inicio,
        Pago.fecha_pago <= datetime.combine(fecha_fin, datetime.max.time())
    )
    
    if metodo_pago:
        query = query.filter(Pago.metodo_pago == metodo_pago)
    
    if estado_pago:
        query = query.filter(Pago.estado_pago == estado_pago)
    
    pagos = query.order_by(Pago.fecha_pago.desc()).all()
    
    # Calcular totales
    total_registrados = sum(1 for p in pagos if p.estado_pago == 'REGISTRADO')
    total_anulados = sum(1 for p in pagos if p.estado_pago == 'ANULADO')
    
    monto_total = sum(float(p.monto_pago) for p in pagos if p.estado_pago == 'REGISTRADO')
    monto_efectivo = sum(float(p.monto_pago) for p in pagos if p.estado_pago == 'REGISTRADO' and p.metodo_pago == 'EFECTIVO')
    monto_tarjeta = sum(float(p.monto_pago) for p in pagos if p.estado_pago == 'REGISTRADO' and p.metodo_pago == 'TARJETA')
    monto_transferencia = sum(float(p.monto_pago) for p in pagos if p.estado_pago == 'REGISTRADO' and p.metodo_pago == 'TRANSFERENCIA')
    
    return {
        "fecha_inicio": fecha_inicio.isoformat(),
        "fecha_fin": fecha_fin.isoformat(),
        "total_pagos": len(pagos),
        "total_registrados": total_registrados,
        "total_anulados": total_anulados,
        "monto_total": monto_total,
        "monto_efectivo": monto_efectivo,
        "monto_tarjeta": monto_tarjeta,
        "monto_transferencia": monto_transferencia,
        "pagos": pagos
    }

@router.post("/{id_pago}/comprobante", status_code=status.HTTP_200_OK)
async def subir_comprobante(
    id_pago: int,
    comprobante: UploadFile = File(...),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Subir comprobante PDF para un pago registrado
    
    - **id_pago**: ID del pago
    - **comprobante**: Archivo PDF del comprobante (máximo 5MB)
    """
    t0 = time.perf_counter()
    t1 = time.perf_counter()
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "pagos", "actualizar")
    current_user_id = current_user.id_usuario_sistema
    _log_pago_tiempo("COMP PAGO", f"1 usuario/permisos pago={id_pago}", t1)
    
    # Validar que el pago existe
    t1 = time.perf_counter()
    pago = (
        db.query(Pago)
        .options(load_only(Pago.id_pago, Pago.activo, Pago.estado_pago, Pago.nombre_archivo, Pago.tipo_mime))
        .filter(Pago.id_pago == id_pago)
        .first()
    )
    _log_pago_tiempo("COMP PAGO", f"2 buscar pago={id_pago}", t1)
    if not pago:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pago con ID {id_pago} no encontrado"
        )
    
    # Validar que el pago está activo
    if not pago.activo or pago.estado_pago != 'REGISTRADO':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se puede subir comprobante para pago en estado '{pago.estado_pago}'"
        )
    
    # Validar tipo de archivo
    t1 = time.perf_counter()
    if not comprobante.content_type or comprobante.content_type != 'application/pdf':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo debe ser un PDF"
        )
    _log_pago_tiempo("COMP PAGO", f"3 validar archivo pago={id_pago}", t1)
    
    try:
        # Leer el contenido del archivo
        t1 = time.perf_counter()
        pdf_content = await comprobante.read()
        _log_pago_tiempo("COMP PAGO", f"4 leer archivo pago={id_pago} bytes={len(pdf_content)}", t1)
        
        # Validar tamaño (máximo 5MB)
        t1 = time.perf_counter()
        size_mb = len(pdf_content) / (1024 * 1024)
        if size_mb > 5:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El archivo excede el límite de 5MB (tamaño: {size_mb:.2f} MB)"
            )
        _log_pago_tiempo("COMP PAGO", f"5 validar tamano pago={id_pago}", t1)
        
        # Guardar en la base de datos
        t1 = time.perf_counter()
        pago.comprobante_pdf = pdf_content
        pago.nombre_archivo = comprobante.filename
        pago.tipo_mime = comprobante.content_type
        _log_pago_tiempo("COMP PAGO", f"6 asignar campos pago={id_pago}", t1)
        
        t1 = time.perf_counter()
        db.commit()
        _log_pago_tiempo("COMP PAGO", f"7 commit pdf pago={id_pago}", t1)
        
        # Auditoría
        registrar_auditoria(
            db=db,
            accion="UPDATE",
            descripcion=f"Comprobante PDF subido para pago #{id_pago} - Archivo: {comprobante.filename} ({size_mb:.2f} MB)",
            id_usuario=current_user_id
        )
        _log_pago_tiempo("COMP PAGO", f"9 auditoria pago={id_pago}", t1)
        
        t1 = time.perf_counter()
        registrar_notificacion(
            db=db,
            id_usuario=current_user_id,
            titulo="Comprobante guardado",
            mensaje=f"Comprobante del pago #{id_pago} guardado exitosamente",
            tipo="exito"
        )
        _log_pago_tiempo("COMP PAGO", f"10 notificacion pago={id_pago}", t1)
        _log_pago_tiempo("COMP PAGO", f"TOTAL pago={id_pago}", t0)
        
        return {
            "success": True,
            "message": "Comprobante guardado exitosamente",
            "data": {
                "id_pago": id_pago,
                "nombre_archivo": comprobante.filename,
                "tamano_kb": round(len(pdf_content) / 1024, 2),
                "tamano_mb": round(size_mb, 2)
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"❌ Error al guardar comprobante: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al guardar comprobante: {str(e)}"
        )


# ========================================
# DESCARGAR COMPROBANTE PDF
# ========================================
@router.get("/{id_pago}/comprobante", status_code=status.HTTP_200_OK)
def descargar_comprobante(
    id_pago: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Descargar comprobante PDF de un pago
    """
    from fastapi.responses import Response
    
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "pagos", "lectura")
    
    # Buscar el pago
    pago = db.query(Pago).filter(Pago.id_pago == id_pago).first()
    if not pago:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pago con ID {id_pago} no encontrado"
        )
    
    # Verificar que tenga comprobante
    if not pago.comprobante_pdf:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Este pago no tiene comprobante PDF"
        )
    
    # Retornar el PDF
    return Response(
        content=pago.comprobante_pdf,
        media_type=pago.tipo_mime or "application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={pago.nombre_archivo or f'comprobante_{id_pago}.pdf'}"
        }
    )


# ========================================
# ELIMINAR COMPROBANTE PDF
# ========================================
@router.delete("/{id_pago}/comprobante", status_code=status.HTTP_200_OK)
def eliminar_comprobante(
    id_pago: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Eliminar comprobante PDF de un pago
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "pagos", "eliminar")
    
    # Buscar el pago
    pago = db.query(Pago).filter(Pago.id_pago == id_pago).first()
    if not pago:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pago con ID {id_pago} no encontrado"
        )
    
    # Verificar que tenga comprobante
    if not pago.comprobante_pdf:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Este pago no tiene comprobante PDF"
        )
    
    try:
        # Eliminar comprobante
        nombre_archivo_anterior = pago.nombre_archivo
        pago.comprobante_pdf = None
        pago.nombre_archivo = None
        pago.tipo_mime = None
        
        db.commit()
        
        # Auditoría
        registrar_auditoria(
            db=db,
            accion="DELETE",
            descripcion=f"Comprobante PDF eliminado del pago #{id_pago} - Archivo: {nombre_archivo_anterior}",
            id_usuario=current_user.id_usuario_sistema
        )
        
        return {
            "success": True,
            "message": "Comprobante eliminado exitosamente",
            "id_pago": id_pago
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al eliminar comprobante: {str(e)}"
        )
