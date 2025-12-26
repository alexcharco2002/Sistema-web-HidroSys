# routes/pagos.py

import locale
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status, Query
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy.exc import IntegrityError
from typing import List, Optional, Tuple as TypingTuple  
from sqlalchemy import  func, extract,case, and_,  or_
from typing import List, Optional
from datetime import datetime, date, timedelta
from decimal import Decimal


from models.detalle_factura import DetalleFactura
from models.meter import Medidor
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
    PagoAnular
)

from utils.audit_logger import registrar_auditoria
from utils.notifications import registrar_notificacion
from db.session import SessionLocal
from security.jwt import verify_token

router = APIRouter(prefix="/pagos", tags=["pagos"])


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
            
            # ✅ Usar case() directamente, no func.case()
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
        .join(Pago, Factura.id_factura == Pago.id_factura)  # ✅ Join explícito
        .filter(
            Factura.periodo.in_(periodos),
            Pago.estado_pago == 'REGISTRADO',  # ✅ Solo pagos registrados
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
    pagos_activos = query.filter(Pago.activo == True).count()  # ✅ AGREGAR
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
        "pagos_activos": pagos_activos,  # ✅ AGREGAR
        "pagos_registrados": pagos_registrados,
        "pagos_anulados": pagos_anulados,
        "monto_total": float(monto_total),  # ✅ CAMBIAR NOMBRE
        "monto_efectivo": float(monto_efectivo),
        "monto_transferencia": float(monto_transferencia),
        "monto_tarjeta": float(monto_tarjeta),
        "monto_otros": float(monto_otros)
    }


# ========================================
# OBTENER PERÍODOS DISPONIBLES DE PAGOS
# ========================================
@router.get("/periodos/disponibles", response_model=dict)
def obtener_periodos_pagos_disponibles(
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "pagos", "lectura")

    hoy = date.today()
    mes_actual = hoy.month
    anio_actual = hoy.year

    periodos = []
    periodos_str = []

    # Generar periodos
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
            "sugerido": mes == mes_actual and anio == anio_actual
        })

    # 🔥 UNA SOLA CONSULTA
    stats_map = obtener_estadisticas_pagos_por_periodo(db, periodos_str)

    for p in periodos:
        stats = stats_map.get(p["periodo"])

        p.update({
            "nombre_mes": MESES_ES.get(p["mes"]),
            "tiene_pagos": stats is not None,
            "total_pagos": stats.total_pagos if stats else 0,
            "monto_total": float(stats.monto_total) if stats else 0,
            "monto_efectivo": float(stats.monto_efectivo) if stats else 0,
            "monto_transferencia": float(stats.monto_transferencia) if stats else 0,
            "monto_tarjeta": float(stats.monto_tarjeta) if stats else 0,
            "valor": p["periodo"],
            "texto": f"{MESES_ES.get(p['mes'])} {p['anio']}"
        })

    periodos.sort(key=lambda x: (x["anio"], x["mes"]), reverse=True)
    periodo_actual = next((p for p in periodos if p["sugerido"]), periodos[0])

    return {
        "periodo_actual": periodo_actual,
        "periodos_disponibles": periodos
    }


from sqlalchemy.orm import aliased  # ✅ Importar aliased

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
    """
    Obtener facturas por periodo con información completa:
    - Una factura tiene UN solo pago (relación 1:1)
    - El comprobante está en la tabla t_pagos
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "pagos", "lectura")

    try:
        # ✅ Crear alias para el cajero
        Cajero = aliased(UsuarioSistema)
        
        # ========================================
        # 🔥 QUERY PRINCIPAL - FACTURAS CON PAGO
        # ========================================
        query = (
            db.query(
                # Factura
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
                # Afiliado
                UsuarioAfiliado.id_usuario_afi,
                UsuarioAfiliado.cod_usuario_afi,
                UsuarioAfiliado.num_medidor,
                # Usuario sistema (del afiliado)
                UsuarioSistema.nombres,
                UsuarioSistema.apellidos,
                UsuarioSistema.cedula,
                UsuarioSistema.direccion,
                UsuarioSistema.telefono,
                UsuarioSistema.email,
                # Sector
                Sector.nombre_sector,
                # ✅ PAGO (relación 1:1)
                Pago.id_pago,
                Pago.monto_pago,
                Pago.fecha_pago,
                Pago.metodo_pago,
                Pago.estado_pago,
                Pago.observaciones,
                # ✅ COMPROBANTE
                Pago.nombre_archivo,
                Pago.tipo_mime,
                case(
                    (Pago.comprobante_pdf.isnot(None), True),
                    else_=False
                ).label('tiene_comprobante'),
                # ✅ CAJERO (usando alias)
                Cajero.nombres.label('cajero_nombres'),
                Cajero.apellidos.label('cajero_apellidos')
            )
            .join(UsuarioAfiliado, Factura.id_usuario_afi == UsuarioAfiliado.id_usuario_afi)
            .join(UsuarioSistema, UsuarioAfiliado.id_usuario_sistema == UsuarioSistema.id_usuario_sistema)
            .outerjoin(Sector, UsuarioAfiliado.id_sector == Sector.id_sector)
            # ✅ JOIN con pagos (puede no tener pago)
            .outerjoin(Pago, Factura.id_factura == Pago.id_factura)
            # ✅ JOIN con cajero usando alias
            .outerjoin(Cajero, Pago.id_cajero == Cajero.id_usuario_sistema)
        )

        # Filtros
        if periodo:
            query = query.filter(Factura.periodo == periodo)

        if estado_factura:
            query = query.filter(Factura.estado_factura == estado_factura)

        if search:
            query = query.filter(
                or_(
                    Factura.num_factura.ilike(f"%{search}%"),
                    UsuarioSistema.nombres.ilike(f"%{search}%"),
                    UsuarioSistema.apellidos.ilike(f"%{search}%"),
                    UsuarioSistema.cedula.ilike(f"%{search}%"),
                    UsuarioAfiliado.num_medidor.ilike(f"%{search}%")
                )
            )

        # Ordenar
        estado_orden = case(
            (Factura.estado_factura == 'pendiente', 1),
            (Factura.estado_factura == 'vencida', 2),
            (Factura.estado_factura == 'pagada', 3),
            (Factura.estado_factura == 'anulada', 4),
            else_=5
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
        # 🔥 QUERY: DETALLES
        # ========================================
        detalles_query = (
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
        )
        
        detalles_por_factura = {}
        for d in detalles_query:
            if d.id_factura not in detalles_por_factura:
                detalles_por_factura[d.id_factura] = []
            detalles_por_factura[d.id_factura].append({
                "id_detalle": d.id_detalle,
                "tipo_detalle": d.tipo_detalle,
                "descripcion": d.descripcion or "Sin descripción",
                "subtotal_detalle": float(d.subtotal_detalle) if d.subtotal_detalle else 0.0,
            })

        print(f"✅ Facturas: {len(facturas)} | Detalles: {len(detalles_query)}")

        # ========================================
        # 🔄 FORMATEAR RESPUESTA
        # ========================================
        resultado = []
        
        for f in facturas:
            detalles_factura = detalles_por_factura.get(f.id_factura, [])
            
            # ✅ Construir nombre del cajero
            cajero_nombre = None
            if f.cajero_nombres and f.cajero_apellidos:
                cajero_nombre = f"{f.cajero_nombres} {f.cajero_apellidos}"
            elif f.cajero_nombres:
                cajero_nombre = f.cajero_nombres
            elif f.cajero_apellidos:
                cajero_nombre = f.cajero_apellidos
            
            # ✅ PAGO (puede ser None si no tiene pago)
            pago = None
            if f.id_pago:
                pago = {
                    "id_pago": f.id_pago,
                    "monto_pago": float(f.monto_pago) if f.monto_pago else 0.0,
                    "fecha_pago": f.fecha_pago.isoformat() if f.fecha_pago else None,
                    "metodo_pago": f.metodo_pago or "No especificado",
                    "estado_pago": f.estado_pago,
                    "observaciones": f.observaciones,
                    "cajero": cajero_nombre or "Sin cajero",
                    # ✅ COMPROBANTE
                    "tiene_comprobante": f.tiene_comprobante,
                    "nombre_archivo": f.nombre_archivo,
                    "tipo_mime": f.tipo_mime or "application/pdf"
                }
            
            # Calcular totales
            monto_pagado = float(f.monto_pago) if f.monto_pago else 0.0
            saldo_pendiente = float(f.total) - monto_pagado
            
            resultado.append({
                "id_factura": f.id_factura,
                "num_factura": f.num_factura,
                "periodo": f.periodo,
                "fecha_emision": f.fecha_emision.isoformat(),
                "estado_factura": f.estado_factura,
                
                "consumo_m3": f.consumo_m3 or 0,
                "exceso_m3": f.exceso_m3 or 0,
                "valor_consumo": float(f.valor_consumo) if f.valor_consumo else 0.0,
                "valor_exceso": float(f.valor_exceso) if f.valor_exceso else 0.0,
                
                "subtotal": float(f.subtotal) if f.subtotal else 0.0,
                "descuento": float(f.descuento) if f.descuento else 0.0,
                "impuesto": float(f.impuesto) if f.impuesto else 0.0,
                "total": float(f.total),
                
                "usuario_afiliado": {
                    "id_usuario_afi": f.id_usuario_afi,
                    "cod_usuario_afi": f.cod_usuario_afi,
                    "num_medidor": f.num_medidor or "N/A",
                    
                    "usuario_sistema": {
                        "nombres": f.nombres,
                        "apellidos": f.apellidos,
                        "cedula": f.cedula,
                        "direccion": f.direccion,
                        "telefono": f.telefono,
                        "email": f.email,
                    },
                    
                    "sector": {
                        "nombre_sector": f.nombre_sector or "Sin sector"
                    }
                },
                
                "detalles": detalles_factura,
                
                "resumen_detalles": {
                    "total_conceptos": len(detalles_factura),
                    "consumo": len([d for d in detalles_factura if d['tipo_detalle'] == 'consumo']),
                    "multas": len([d for d in detalles_factura if d['tipo_detalle'] == 'multa']),
                    "servicios": len([d for d in detalles_factura if d['tipo_detalle'] == 'servicio']),
                },
                
                # ✅ UN SOLO PAGO (no array)
                "pago": pago,
                
                # ✅ RESUMEN SIMPLIFICADO
                "tiene_pago": pago is not None,
                "monto_pagado": monto_pagado,
                "saldo_pendiente": saldo_pendiente,
                "esta_totalmente_pagada": saldo_pendiente <= 0,
                "tiene_comprobante": f.tiene_comprobante if f.id_pago else False
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
@router.get("/", response_model=List[PagoResponse])
def listar_pagos(
    search: Optional[str] = Query(None, description="Buscar por ID o número de factura"),
    id_usuario_afi: Optional[int] = Query(None, description="Filtrar por usuario afiliado"),
    periodo: Optional[str] = Query(None, description="Filtrar por periodo (YYYY-MM)"),
    estado_pago: Optional[str] = Query(None, description="Filtrar por estado (REGISTRADO, ANULADO)"),
    metodo_pago: Optional[str] = Query(None, description="Filtrar por método de pago"),
    fecha_desde: Optional[date] = Query(None, description="Fecha de pago desde"),
    fecha_hasta: Optional[date] = Query(None, description="Fecha de pago hasta"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Lista pagos con múltiples filtros e información completa
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "pagos", "lectura")
    
    # Query con joinedload para optimizar
    query = db.query(Pago).options(
        joinedload(Pago.factura),
        joinedload(Pago.usuario_afiliado).joinedload(UsuarioAfiliado.usuario_sistema),
        joinedload(Pago.cajero)
    )
    
    # Filtros
    if search:
        query = query.filter(
            (Pago.id_pago == int(search) if search.isdigit() else False) |
            (Pago.factura.has(Factura.num_factura.ilike(f"%{search}%")))
        )
    
    if id_usuario_afi:
        query = query.filter(Pago.id_usuario_afi == id_usuario_afi)
    
    if periodo:
        # Filtrar por periodo (año-mes de fecha_pago)
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
    
    if metodo_pago:
        query = query.filter(Pago.metodo_pago == metodo_pago)
    
    if fecha_desde:
        query = query.filter(Pago.fecha_pago >= fecha_desde)
    
    if fecha_hasta:
        # Incluir todo el día
        fecha_hasta_completa = datetime.combine(fecha_hasta, datetime.max.time())
        query = query.filter(Pago.fecha_pago <= fecha_hasta_completa)
    
    # Ordenar por fecha de pago descendente
    query = query.order_by(Pago.fecha_pago.desc(), Pago.id_pago.desc())
    
    pagos = query.offset(skip).limit(limit).all()
    return pagos

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
        
        print(f"✅ Estadísticas del periodo {periodo}:")
        print(f"   📊 Total facturas: {total_facturas}")
        print(f"   💰 Total recaudado: ${total_recaudado}")
        print(f"   ✅ Facturas pagadas: {facturas_pagadas}")
        
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
# OBTENER PAGOS DE UNA FACTURA
# ========================================
@router.get("/factura/{id_factura}", response_model=List[PagoResponse])
def obtener_pagos_por_factura(
    id_factura: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """Obtiene todos los pagos asociados a una factura específica"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "pagos", "lectura")
    
    # Verificar que la factura existe
    factura = db.query(Factura).filter(Factura.id_factura == id_factura).first()
    if not factura:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Factura no encontrada"
        )
    
    pagos = db.query(Pago).options(
        joinedload(Pago.usuario_afiliado).joinedload(UsuarioAfiliado.usuario_sistema),
        joinedload(Pago.cajero)
    ).filter(
        Pago.id_factura == id_factura
    ).order_by(Pago.fecha_pago.desc()).all()
    
    return pagos


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


# ========================================
# CREAR NUEVO PAGO
# ========================================
@router.post("/", response_model=PagoResponse, status_code=status.HTTP_201_CREATED)
def crear_pago(
    pago: PagoCreate,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Registra un nuevo pago
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "pagos", "crear")
    
    # Validar que la factura existe (si se proporciona)
    if pago.id_factura:
        factura = db.query(Factura).filter(
            Factura.id_factura == pago.id_factura
        ).first()
        
        if not factura:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Factura no encontrada"
            )
        
        # Validar que la factura esté pendiente o vencida
        if factura.estado_factura not in ['pendiente', 'vencida']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No se puede registrar pago para factura en estado '{factura.estado_factura}'"
            )
    
    # Validar que el afiliado existe (si se proporciona)
    if pago.id_usuario_afi:
        afiliado = db.query(UsuarioAfiliado).filter(
            UsuarioAfiliado.id_usuario_afi == pago.id_usuario_afi
        ).first()
        
        if not afiliado:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Afiliado no encontrado"
            )
    
    try:
        nuevo_pago = Pago(
            id_factura=pago.id_factura,
            monto_pago=pago.monto_pago,
            fecha_pago=datetime.now(),
            metodo_pago=pago.metodo_pago,
            id_usuario_afi=pago.id_usuario_afi,
            id_cajero=pago.id_cajero,
            observaciones=pago.observaciones,
            activo=True,
            estado_pago='REGISTRADO'
        )
        
        db.add(nuevo_pago)
        db.flush()  # Para obtener el ID antes del commit
        
        # Si hay factura asociada, verificar si se debe marcar como pagada
        if pago.id_factura:
            factura = db.query(Factura).filter(
                Factura.id_factura == pago.id_factura
            ).first()
            
            # Calcular total pagado de la factura
            total_pagado = db.query(func.sum(Pago.monto_pago)).filter(
                Pago.id_factura == pago.id_factura,
                Pago.estado_pago == 'REGISTRADO'
            ).scalar() or Decimal('0.00')
            
            # Si el pago cubre el total, marcar factura como pagada
            if total_pagado >= factura.total:
                factura.estado_factura = 'pagada'
                print(f"✅ Factura {factura.num_factura} marcada como PAGADA")
        
        db.commit()
        db.refresh(nuevo_pago)
        
        # Auditoría
        registrar_auditoria(
            db=db,
            accion="CREATE",
            descripcion=f"Pago #{nuevo_pago.id_pago} registrado - Monto: ${pago.monto_pago} - Método: {pago.metodo_pago}",
            id_usuario=current_user.id_usuario_sistema
        )
        
        registrar_notificacion(
            db=db,
            id_usuario=current_user.id_usuario_sistema,
            titulo="Pago registrado",
            mensaje=f"Pago de ${pago.monto_pago} registrado correctamente",
            tipo="exito"
        )
        
        return nuevo_pago
        
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Error de integridad: verifique las relaciones (factura, afiliado, cajero)"
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear pago: {str(e)}"
        )


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
) -> TypingTuple[bool, str, Optional[Factura]]:
    """
    Regenera una factura con los mismos datos de una factura original
    Se usa cuando se anula un pago
    
    Args:
        db: Sesión de base de datos
        factura_original: Factura a duplicar
        motivo_regeneracion: Motivo de la regeneración
    
    Returns:
        (exito, mensaje, factura_nueva)
    """
    try:
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
        # Formato: FACT-YYYYMM-XXXX
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
        
        print(f"📝 Nuevo número de factura: {nuevo_num_factura}")
        
        # ============================================
        # PASO 3: CREAR NUEVA FACTURA
        # ============================================
        nueva_factura = Factura(
            # Identificación
            num_factura=nuevo_num_factura,
            id_usuario_afi=id_usuario_afi,
            id_tarifa=factura_original.id_tarifa,
            id_lectura=factura_original.id_lectura,
            periodo=periodo,
            
            # Fecha - solo fecha_emision existe
            fecha_emision=datetime.now().date(),  # ✅ Usar .date() para tipo Date
            
            # Copiar consumos
            consumo_m3=factura_original.consumo_m3,
            exceso_m3=factura_original.exceso_m3,
            valor_consumo=factura_original.valor_consumo,
            valor_exceso=factura_original.valor_exceso,
            
            # Copiar totales
            subtotal=factura_original.subtotal,
            descuento=factura_original.descuento,
            impuesto=factura_original.impuesto,
            total=factura_original.total,
            
            # Estado inicial
            estado_factura='pendiente'
            # activo ya no existe en el modelo
        )
        
        db.add(nueva_factura)
        db.flush()  # Para obtener el ID
        
        print(f"✅ Nueva factura creada: {nueva_factura.num_factura}")
        print(f"   ID: {nueva_factura.id_factura}")
        print(f"   Total: ${nueva_factura.total}")
        
        # ============================================
        # PASO 4: COPIAR DETALLES
        # ============================================
        detalles_originales = db.query(DetalleFactura).filter(
            DetalleFactura.id_factura == factura_original.id_factura
        ).all()
        
        detalles_creados = 0
        for detalle_orig in detalles_originales:
            nuevo_detalle = DetalleFactura(
                id_factura=nueva_factura.id_factura,
                tipo_detalle=detalle_orig.tipo_detalle,
                descripcion=detalle_orig.descripcion,
                subtotal_detalle=detalle_orig.subtotal_detalle
                # activo ya no existe en el modelo
            )
            db.add(nuevo_detalle)
            detalles_creados += 1
        
        print(f"✅ {detalles_creados} detalle(s) copiado(s)")
        
        # ============================================
        # PASO 5: MARCAR FACTURA ORIGINAL COMO ANULADA
        # ============================================
        factura_original.estado_factura = 'anulada'
        # No cambiar activo porque no existe
        
        print(f"✅ Factura original {factura_original.num_factura} marcada como ANULADA")
        
        # ============================================
        # PASO 6: COMMIT
        # ============================================
        db.commit()
        db.refresh(nueva_factura)
        
        print(f"\n{'='*60}")
        print(f"✅ FACTURA REGENERADA EXITOSAMENTE")
        print(f"   Original: {factura_original.num_factura} (ANULADA)")
        print(f"   Nueva: {nueva_factura.num_factura} (PENDIENTE)")
        print(f"   Total: ${nueva_factura.total}")
        print(f"   Periodo: {nueva_factura.periodo}")
        print(f"{'='*60}\n")
        
        return True, f"Factura {nueva_factura.num_factura} regenerada", nueva_factura
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error regenerando factura: {e}")
        import traceback
        traceback.print_exc()
        return False, f"Error al regenerar factura: {str(e)}", None


# ========================================
# ANULAR PAGO
# ========================================
@router.patch("/{id_pago}/anular")
def anular_pago(
    id_pago: int,
    request: dict,  # ✅ Recibir body con motivo y flag
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Anula un pago y opcionalmente regenera la factura
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "pagos", "eliminar")
    
    # Extraer parámetros
    motivo = request.get('motivo', 'Anulado por usuario')
    regenerar_factura = request.get('regenerar_factura', False)
    
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
        
        if pago.id_factura:
            factura_original = db.query(Factura).filter(
                Factura.id_factura == pago.id_factura
            ).first()
            
            if factura_original:
                print(f"📄 Factura asociada: {factura_original.num_factura}")
                
                # ============================================
                # PASO 3: REGENERAR FACTURA (SI SE SOLICITA)
                # ============================================
                if regenerar_factura:
                    exito, mensaje, nueva_factura = regenerar_factura_desde_factura_anulada(
                        db=db,
                        factura_original=factura_original,
                        motivo_regeneracion=f"Regenerada por anulación de pago #{pago.id_pago}. Motivo: {motivo}"
                    )
                    
                    if not exito:
                        raise Exception(f"Error al regenerar factura: {mensaje}")
                else:
                    # Solo cambiar estado a pendiente si no se regenera
                    factura_original.estado_factura = 'pendiente'
                    print(f"⚠️ Factura {factura_original.num_factura} devuelta a PENDIENTE")
        
        # ============================================
        # PASO 4: COMMIT
        # ============================================
        db.commit()
        db.refresh(pago)
        
        # ============================================
        # PASO 5: AUDITORÍA
        # ============================================
        registrar_auditoria(
            db=db,
            accion="UPDATE",
            descripcion=f"Pago #{pago.id_pago} anulado. Motivo: {motivo}. " + 
                       (f"Nueva factura: {nueva_factura.num_factura}" if nueva_factura else "Sin regeneración"),
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
            } if nueva_factura else None
        }
        
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
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "pagos", "actualizar")
    
    # Validar que el pago existe
    pago = db.query(Pago).filter(Pago.id_pago == id_pago).first()
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
    if not comprobante.content_type or comprobante.content_type != 'application/pdf':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo debe ser un PDF"
        )
    
    try:
        # Leer el contenido del archivo
        pdf_content = await comprobante.read()
        
        # Validar tamaño (máximo 5MB)
        size_mb = len(pdf_content) / (1024 * 1024)
        if size_mb > 5:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El archivo excede el límite de 5MB (tamaño: {size_mb:.2f} MB)"
            )
        
        # Guardar en la base de datos
        pago.comprobante_pdf = pdf_content
        pago.nombre_archivo = comprobante.filename
        pago.tipo_mime = comprobante.content_type
        
        db.commit()
        db.refresh(pago)
        
        # Auditoría
        registrar_auditoria(
            db=db,
            accion="UPDATE",
            descripcion=f"Comprobante PDF subido para pago #{id_pago} - Archivo: {comprobante.filename} ({size_mb:.2f} MB)",
            id_usuario=current_user.id_usuario_sistema
        )
        
        registrar_notificacion(
            db=db,
            id_usuario=current_user.id_usuario_sistema,
            titulo="Comprobante guardado",
            mensaje=f"Comprobante del pago #{id_pago} guardado exitosamente",
            tipo="exito"
        )
        
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