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
    PagoAnular
)

from utils.audit_logger import registrar_auditoria
from utils.config_mora import calcular_monto_mora, calcular_mora_factura, evaluar_y_aplicar_mora, obtener_configuracion_mora_activa, obtener_monto_base_mora, registrar_mora_en_bd
from utils.pago_utils import calcular_montos_con_multas, liberar_multas_no_pagadas, procesar_multas_pagadas, validar_afiliado, validar_factura_para_pago, validar_monto_pago
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
        .join(Pago, Factura.id_factura == Pago.id_factura)  #  Join explícito
        .filter(
            Factura.periodo.in_(periodos),
            Pago.estado_pago == 'REGISTRADO',  #  Solo pagos registrados
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
    pagos_activos = query.filter(Pago.activo == True).count()  #  AGREGAR
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
        "pagos_activos": pagos_activos,  #  AGREGAR
        "pagos_registrados": pagos_registrados,
        "pagos_anulados": pagos_anulados,
        "monto_total": float(monto_total),  #  CAMBIAR NOMBRE
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

    #  UNA SOLA CONSULTA
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


from sqlalchemy.orm import aliased  #  Importar aliased
# ========================================
# OBTENER FACTURAS POR PERIODO CON PAGOS
# ========================================
from sqlalchemy.orm import aliased
from sqlalchemy import func, case, or_

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

    """
    Obtener facturas por periodo con información completa:
    - Una factura puede tener MÚLTIPLES pagos
    - El saldo se calcula sumando TODOS los pagos
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "pagos", "lectura")

    try:
        # Crear alias para el cajero
        Cajero = aliased(UsuarioSistema)
        # ========================================
        # CALCULAR ESTADO REAL (INCLUYENDO PARCIAL)
        # ========================================

        # Primero obtener los totales pagados para determinar estado real
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
        # QUERY PRINCIPAL - FACTURAS CON ESTADO REAL
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
                # Total pagado (para calcular estado parcial)
                func.coalesce(subquery_pagos.c.total_pagado, 0).label('monto_pagado_total')
            )
            .join(UsuarioAfiliado, Factura.id_usuario_afi == UsuarioAfiliado.id_usuario_afi)
            .join(UsuarioSistema, UsuarioAfiliado.id_usuario_sistema == UsuarioSistema.id_usuario_sistema)
            .outerjoin(Sector, UsuarioAfiliado.id_sector == Sector.id_sector)
            .outerjoin(subquery_pagos, Factura.id_factura == subquery_pagos.c.id_factura)
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

        # ========================================
        # ⭐ ORDENAMIENTO MEJORADO CON ESTADO PARCIAL
        # ========================================
        estado_orden = case(
            # Si está anulada -> 5
            (Factura.estado_factura == 'anulada', 5),
            
            # Si está pagada completamente -> 4
            (Factura.estado_factura == 'pagada', 4),
            
            # Si tiene pago parcial (monto_pagado > 0 pero < total) -> 3
            (
                and_(
                    subquery_pagos.c.total_pagado.isnot(None),
                    subquery_pagos.c.total_pagado > 0,
                    subquery_pagos.c.total_pagado < Factura.total,
                    Factura.estado_factura != 'anulada'
                ),
                3
            ),
            
            # Si está vencida sin pago -> 2
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
            
            # Pendiente (sin pago) -> 1
            (Factura.estado_factura == 'pendiente', 1),
            
            # Cualquier otro caso -> 999
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
        # ⭐ QUERY: TODOS LOS PAGOS DE LAS FACTURAS
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
                Cajero.nombres.label('cajero_nombres'),
                Cajero.apellidos.label('cajero_apellidos')
            )
            .outerjoin(Cajero, Pago.id_cajero == Cajero.id_usuario_sistema)
            .filter(
                Pago.id_factura.in_(ids_facturas),
                Pago.estado_pago == 'REGISTRADO'  # Solo pagos válidos
            )
            .order_by(Pago.fecha_pago.desc())
            .all()
        )

        # Agrupar pagos por factura
        pagos_por_factura = {}
        for p in pagos_query:
            if p.id_factura not in pagos_por_factura:
                pagos_por_factura[p.id_factura] = []
            
            # Construir nombre del cajero
            cajero_nombre = None
            if p.cajero_nombres and p.cajero_apellidos:
                cajero_nombre = f"{p.cajero_nombres} {p.cajero_apellidos}"
            elif p.cajero_nombres:
                cajero_nombre = p.cajero_nombres
            elif p.cajero_apellidos:
                cajero_nombre = p.cajero_apellidos
            
            pagos_por_factura[p.id_factura].append({
                "id_pago": p.id_pago,
                "monto_pago": float(p.monto_pago) if p.monto_pago else 0.0,
                "fecha_pago": p.fecha_pago.isoformat() if p.fecha_pago else None,
                "metodo_pago": p.metodo_pago or "No especificado",
                "estado_pago": p.estado_pago,
                "observaciones": p.observaciones,
                "cajero": cajero_nombre or "Sin cajero",
                "tiene_comprobante": p.tiene_comprobante,
                "nombre_archivo": p.nombre_archivo,
                "tipo_mime": p.tipo_mime or "application/pdf"
            })

        # ========================================
        # ⭐ QUERY: TOTAL PAGADO POR FACTURA (SUMA)
        # ========================================
        total_pagado_query = (
            db.query(
                Pago.id_factura,
                func.sum(Pago.monto_pago).label('total_pagado')
            )
            .filter(
                Pago.id_factura.in_(ids_facturas),
                Pago.estado_pago == 'REGISTRADO'
            )
            .group_by(Pago.id_factura)
            .all()
        )

        # Diccionario: id_factura -> total_pagado
        total_pagado_por_factura = {
            tp.id_factura: float(tp.total_pagado) if tp.total_pagado else 0.0
            for tp in total_pagado_query
        }

        # ========================================
        # QUERY: DETALLES
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

        print(f"📊 Facturas: {len(facturas)} | Pagos: {len(pagos_query)} | Detalles: {len(detalles_query)}")

        # ========================================
        # FORMATEAR RESPUESTA
        # ========================================
        resultado = []
        
        for f in facturas:
            detalles_factura = detalles_por_factura.get(f.id_factura, [])
            pagos_factura = pagos_por_factura.get(f.id_factura, [])
            
            # ⭐ CALCULAR TOTALES CORRECTAMENTE
            total_pagado = total_pagado_por_factura.get(f.id_factura, 0.0)
            saldo_pendiente = float(f.total) - total_pagado
            
            # Asegurar que no sea negativo
            saldo_pendiente = max(0.0, saldo_pendiente)
            
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
                
                # ⭐ ARRAY DE PAGOS (puede tener múltiples)
                "pagos": pagos_factura,
                
                # ⭐ RESUMEN CORRECTO
                "tiene_pago": len(pagos_factura) > 0,
                "cantidad_pagos": len(pagos_factura),
                "monto_pagado": total_pagado,
                "saldo_pendiente": saldo_pendiente,
                "esta_totalmente_pagada": saldo_pendiente <= 0.01,  # Tolerancia por decimales
                "tiene_comprobante": any(p.get('tiene_comprobante', False) for p in pagos_factura)
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

# ===========================================
# Obtener resumen de un factura 
# ============================================
@router.get("/calcular-resumen/{factura_id}")
def calcular_resumen_pago(
    factura_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Calcula el resumen completo del pago incluyendo mora ANTES de registrarlo.
    CONSIDERA PAGOS ANTERIORES para calcular el saldo pendiente real.
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "pagos", "lectura")
    
    try:
        # ========================================
        # PASO 1: VALIDAR Y OBTENER FACTURA
        # ========================================
        factura = validar_factura_para_pago(factura_id, db)
        
        # ⭐ CALCULAR PAGOS ANTERIORES
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
        
        # Obtener configuración de IVA
        from utils.facturacion import obtener_configuracion_iva
        tasa_impuesto, iva_config = obtener_configuracion_iva(db)
        print(f"   IVA: {float(tasa_impuesto * 100):.2f}%")
        
        # ========================================
        # PASO 2: OBTENER DETALLES DE LA FACTURA
        # ========================================
        detalles = db.query(DetalleFactura).filter(
            DetalleFactura.id_factura == factura_id
        ).all()
        
        # Separar detalles por tipo
        subtotal_consumo = Decimal('0.00')
        subtotal_servicios = Decimal('0.00')
        subtotal_multas = Decimal('0.00')
        detalles_multas = []
        
        for detalle in detalles:
            if detalle.tipo_detalle == 'consumo':
                subtotal_consumo += detalle.subtotal_detalle
            elif detalle.tipo_detalle == 'servicio':
                subtotal_servicios += detalle.subtotal_detalle
            elif detalle.tipo_detalle == 'multa':
                subtotal_multas += detalle.subtotal_detalle
                detalles_multas.append({
                    "id_detalle": detalle.id_detalle,
                    "descripcion": detalle.descripcion or "Multa",
                    "subtotal": float(detalle.subtotal_detalle)
                })
        
        # ========================================
        # PASO 3: CALCULAR MONTOS CON/SIN MULTAS
        # ========================================
        
        # SIN MULTAS: Solo consumo y servicios
        subtotal_sin_multas = subtotal_consumo + subtotal_servicios
        
        # Aplicar descuento proporcional si existe
        descuento_sin_multas = Decimal('0.00')
        if factura.descuento and factura.descuento > 0 and factura.subtotal > 0:
            proporcion = subtotal_sin_multas / factura.subtotal
            descuento_sin_multas = factura.descuento * proporcion
        
        # Calcular con IVA
        base_sin_multas = subtotal_sin_multas - descuento_sin_multas
        iva_sin_multas = base_sin_multas * tasa_impuesto
        total_sin_multas = base_sin_multas + iva_sin_multas
        
        # CON MULTAS: Todo incluido
        total_con_multas = factura.total
        
        # SOLO MULTAS con IVA
        iva_multas = subtotal_multas * tasa_impuesto
        total_solo_multas = subtotal_multas + iva_multas
        
        # ⭐ CALCULAR SALDOS PENDIENTES (considerando pagos anteriores)
        saldo_sin_multas = max(Decimal('0.00'), total_sin_multas - total_pagado_anterior)
        saldo_con_multas = max(Decimal('0.00'), total_con_multas - total_pagado_anterior)
        
        print(f"   Sin multas: ${total_sin_multas} (Saldo: ${saldo_sin_multas})")
        print(f"   Con multas: ${total_con_multas} (Saldo: ${saldo_con_multas})")
        print(f"   Solo multas: ${total_solo_multas}")
        
        # ========================================
        # PASO 4: CALCULAR MORA (solo si hay saldo)
        # ========================================
        from utils.config_mora import (
            obtener_configuracion_mora_activa,
            calcular_dias_mora,
            obtener_monto_base_mora,
            calcular_monto_mora,
            factura_tiene_mora_aplicada
        )
        
        monto_mora = Decimal('0.00')
        dias_mora_efectivos = 0
        dias_transcurridos = 0
        detalle_mora = ""
        tiene_mora_activa = False
        config_mora_nombre = None
        
        # Solo calcular mora si hay saldo pendiente
        if saldo_con_multas > 0:
            if not factura_tiene_mora_aplicada(factura_id, db):
                config_mora = obtener_configuracion_mora_activa(db)
                
                if config_mora:
                    tiene_mora_activa = True
                    config_mora_nombre = config_mora.nombre
                    
                    dias_transcurridos = calcular_dias_mora(factura, datetime.now())
                    dias_mora_efectivos = max(0, dias_transcurridos - config_mora.dias_gracia)
                    
                    if dias_mora_efectivos > 0:
                        # ⭐ Calcular mora sobre el SALDO PENDIENTE, no sobre el total
                        from utils.facturacion import obtener_configuracion_iva
                        tasa_impuesto_temp, _ = obtener_configuracion_iva(db)
                        
                        # Usar el saldo pendiente como base para la mora
                        monto_mora, detalle_mora = calcular_monto_mora(
                            saldo_con_multas, dias_transcurridos, config_mora
                        )
                        print(f"   💰 Mora calculada: ${monto_mora}")
                    else:
                        detalle_mora = f"Sin mora (dentro de {config_mora.dias_gracia} días de gracia)"
                else:
                    detalle_mora = "No hay configuración de mora activa"
            else:
                from utils.config_mora import obtener_mora_de_factura
                mora_existente = obtener_mora_de_factura(factura_id, db)
                if mora_existente:
                    monto_mora = mora_existente.monto_mora
                    dias_mora_efectivos = mora_existente.dias_mora
                    detalle_mora = "Mora ya aplicada previamente"
                    print(f"   ⚠️ Mora existente: ${monto_mora}")
        
        # ========================================
        # PASO 5: CONSTRUIR RESUMEN COMPLETO
        # ========================================
        
        # OPCIÓN 1: TODO (saldo con multas + mora)
        total_opcion_completa = saldo_con_multas + monto_mora
        
        # OPCIÓN 2: SIN MULTAS (saldo sin multas + mora)
        total_opcion_sin_multas = saldo_sin_multas + monto_mora
        
        print(f"   📋 Total a pagar COMPLETO: ${total_opcion_completa}")
        print(f"   📋 Total a pagar SIN MULTAS: ${total_opcion_sin_multas}")
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
                "saldo_pendiente": float(saldo_con_multas)
            },
            
            "iva": {
                "tasa": float(tasa_impuesto),
                "porcentaje": float(tasa_impuesto * 100),
                "es_exento": float(tasa_impuesto) == 0.0
            },
            
            "mora": {
                "tiene_configuracion_activa": tiene_mora_activa,
                "configuracion_nombre": config_mora_nombre,
                "tiene_mora_aplicada": factura_tiene_mora_aplicada(factura_id, db),
                "monto": float(monto_mora),
                "dias_transcurridos": dias_transcurridos,
                "dias_mora_efectivos": dias_mora_efectivos,
                "detalle": detalle_mora,
                "aplica": float(monto_mora) > 0
            },
            
            "multas": {
                "tiene_multas": len(detalles_multas) > 0,
                "cantidad": len(detalles_multas),
                "subtotal_sin_iva": float(subtotal_multas),
                "iva": float(iva_multas),
                "total_con_iva": float(total_solo_multas),
                "detalles": detalles_multas
            },
            
            "desglose": {
                "consumo_subtotal": float(subtotal_consumo),
                "servicios_subtotal": float(subtotal_servicios),
                "multas_subtotal": float(subtotal_multas),
                "subtotal_total": float(factura.subtotal),
                "descuento": float(factura.descuento or 0),
                "base_imponible": float(factura.subtotal - (factura.descuento or 0)),
                "iva": float(factura.impuesto or 0),
                "total_factura": float(factura.total)
            },
            
            "totales": {
                # Base
                "factura_original": float(factura.total),
                "pagado_anteriormente": float(total_pagado_anterior),
                
                # OPCIÓN 1: Pagar TODO (con multas) - SALDO PENDIENTE
                "opcion_completa": {
                    "descripcion": "Pagar TODO (consumo + servicios + multas + mora)",
                    "subtotal": float(factura.subtotal),
                    "descuento": float(factura.descuento or 0),
                    "base": float(factura.subtotal - (factura.descuento or 0)),
                    "iva": float(factura.impuesto or 0),
                    "subtotal_con_iva": float(total_con_multas),
                    "saldo_pendiente": float(saldo_con_multas),
                    "mora": float(monto_mora),
                    "total_final": float(total_opcion_completa),
                    "incluye_multas": True
                },
                
                # OPCIÓN 2: Pagar SIN MULTAS - SALDO PENDIENTE
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
                    "multas_pendientes": float(total_solo_multas)
                }
            },
            
            "recomendacion": {
                "mostrar_opciones": len(detalles_multas) > 0,
                "mensaje": "Puede pagar sin multas. Las multas quedarán pendientes para la próxima factura." if len(detalles_multas) > 0 else "Esta factura no tiene multas."
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
# ENDPOINT: OBTENER FACTURAS PENDIENTES (CORREGIDO)
# ========================================

@router.get("/afiliado/{id_afiliado}/facturas-pendientes")
def obtener_facturas_pendientes_afiliado(
    id_afiliado: int,
    periodo_actual: Optional[str] = Query(None, description="Periodo actual en formato YYYY-MM"),
    aplicar_mora: bool = Query(False, description="Si True, registra mora en BD"),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Obtiene todas las facturas pendientes de un afiliado,
    excluyendo el periodo actual y periodos futuros.
    Calcula la mora aplicable para cada factura.
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
        print(f"📋 CONSULTANDO FACTURAS PENDIENTES")
        print(f"{'='*60}")
        print(f"Afiliado ID: {id_afiliado}")
        print(f"Periodo actual: {periodo_actual}")
        print(f"Aplicar mora: {aplicar_mora}")
        
        # 2. Buscar configuración de mora activa
        config_mora = obtener_configuracion_mora_activa(db)
        
        # 3. Consultar facturas pendientes con pagos cargados
        facturas_pendientes = db.query(Factura).filter(
            Factura.id_usuario_afi == id_afiliado,
            or_(
                Factura.estado_factura == 'pendiente',
                Factura.estado_factura == 'vencida'
            ),
            Factura.periodo < periodo_actual
        ).options(
            # ✅ Cargar relación de pagos para calcular monto pagado
            joinedload(Factura.pagos)
        ).order_by(Factura.fecha_emision.asc()).all()
        
        if not facturas_pendientes:
            print(f"✅ No hay facturas pendientes (periodos anteriores a {periodo_actual})")
            print(f"{'='*60}\n")
            return {
                "tiene_deuda": False,
                "meses_adeudo": 0,
                "total_adeudado": 0.0,
                "total_facturas_pendientes": 0,
                "periodo_referencia": periodo_actual,
                "facturas": []
            }
        
        print(f"📊 Facturas encontradas: {len(facturas_pendientes)}")
        
        # 4. Procesar cada factura y calcular mora
        facturas_procesadas = []
        total_adeudado = Decimal('0.00')
        hoy = date.today()
        
        for factura in facturas_pendientes:
            # Verificar periodo
            if factura.periodo >= periodo_actual:
                print(f"⚠️ Factura {factura.num_factura} omitida (periodo {factura.periodo} >= {periodo_actual})")
                continue
            
            print(f"\n--- Procesando Factura {factura.num_factura} ---")
            print(f"Periodo: {factura.periodo}")
            print(f"Estado: {factura.estado_factura}")
            print(f"Total: ${factura.total}")
            
            # ✅ Calcular monto pagado usando la función helper
            monto_pagado = calcular_monto_pagado_factura(factura)
            saldo_pendiente = calcular_saldo_pendiente_factura(factura)
            
            print(f"Monto pagado: ${monto_pagado}")
            print(f"Saldo pendiente: ${saldo_pendiente}")
            
            # Calcular días transcurridos
            dias_transcurridos = (hoy - factura.fecha_emision).days
            print(f"Días transcurridos: {dias_transcurridos}")
            
            # Evaluar y aplicar mora
            mora_monto = Decimal('0.00')
            mora_aplicada = False
            mora_registrada = False
            
            if aplicar_mora and config_mora:
                # Aplicar mora usando función principal (registra en BD)
                mora_monto, mora_aplicada, detalle_mora = evaluar_y_aplicar_mora(
                    factura=factura,
                    fecha_pago=datetime.now(),
                    db=db
                )
                mora_registrada = mora_aplicada
            elif config_mora:
                # Solo calcular sin registrar
                if dias_transcurridos > config_mora.dias_gracia:
                    monto_base = obtener_monto_base_mora(factura, config_mora, db)
                    mora_monto, _ = calcular_monto_mora(
                        monto_base=monto_base,
                        dias_transcurridos=dias_transcurridos,
                        config_mora=config_mora
                    )
                    mora_aplicada = mora_monto > 0
                    
                    if mora_aplicada:
                        print(f"💰 Mora calculada: ${mora_monto}")
                    else:
                        print(f"✅ Sin mora")
                else:
                    print(f"✅ Sin mora (días de gracia: {config_mora.dias_gracia})")
            else:
                print(f"⚠️ No hay configuración de mora activa")
            
            # Calcular total con mora
            total_con_mora = saldo_pendiente + mora_monto
            
            # Agregar a lista
            facturas_procesadas.append({
                "id_factura": factura.id_factura,
                "num_factura": factura.num_factura,
                "periodo": factura.periodo,
                "fecha_emision": factura.fecha_emision.isoformat(),
                "estado_factura": factura.estado_factura,
                "total_factura": float(factura.total),
                "monto_pagado": float(monto_pagado),
                "saldo_pendiente": float(saldo_pendiente),
                "dias_transcurridos": dias_transcurridos,
                "mora_aplicable": mora_aplicada,
                "mora_monto": float(mora_monto),
                "total_con_mora": float(total_con_mora),
                "mora_registrada": mora_registrada
            })
            
            # Acumular total adeudado (saldo + mora)
            total_adeudado += total_con_mora
        
        # 5. Calcular meses de adeudo
        periodos_unicos = set(f.periodo for f in facturas_pendientes if f.periodo < periodo_actual)
        meses_adeudo = len(periodos_unicos)
        
        # 6. Commit si se aplicó mora
        if aplicar_mora:
            db.commit()
            print(f"✅ Mora aplicada y registrada en BD")
        
        print(f"\n{'='*60}")
        print(f"📊 RESUMEN DE ADEUDOS")
        print(f"{'='*60}")
        print(f"Periodo referencia: {periodo_actual}")
        print(f"Meses adeudados: {meses_adeudo}")
        print(f"Facturas pendientes: {len(facturas_procesadas)}")
        print(f"Total adeudado: ${total_adeudado:.2f}")
        print(f"{'='*60}\n")
        
        # 7. Retornar resultado
        return {
            "tiene_deuda": len(facturas_procesadas) > 0,
            "meses_adeudo": meses_adeudo,
            "total_adeudado": float(total_adeudado),
            "total_facturas_pendientes": len(facturas_procesadas),
            "periodo_referencia": periodo_actual,
            "mora_aplicada_en_bd": aplicar_mora,
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
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "pagos", "crear")
    
    # ========================================
    # PASO 1: OBTENER CONFIGURACIÓN DE IVA
    # ========================================
    from utils.facturacion import obtener_configuracion_iva
    tasa_impuesto, iva_config = obtener_configuracion_iva(db)
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
    if pago.id_factura:
        factura = validar_factura_para_pago(pago.id_factura, db)
        
        # Calcular montos con/sin multas
        monto_sin_multas, multas_en_factura, total_multas = calcular_montos_con_multas(
            factura, pago.incluir_multas, tasa_impuesto, db
        )
        
        # Validar monto del pago
        if not pago.incluir_multas:
            validar_monto_pago(pago.monto_pago, monto_sin_multas, pago.incluir_multas)
    
    if pago.id_usuario_afi:
        validar_afiliado(pago.id_usuario_afi, db)
    
    # ========================================
    # PASO 3: EVALUAR Y CALCULAR MORA
    # ========================================
    if pago.id_factura and factura:
        monto_mora, mora_aplicada, detalle_mora = evaluar_y_aplicar_mora(
            factura=factura,
            fecha_pago=datetime.now(),
            db=db
        )
        
        if mora_aplicada:
            print(f"💰 MORA APLICADA: ${monto_mora}")
    
    # ========================================
    # PASO 4: CALCULAR MONTO TOTAL A COBRAR
    # ========================================
    monto_total_cobrar = pago.monto_pago + monto_mora
    
    print(f"\n{'='*60}")
    print(f"💰 RESUMEN DE COBRO")
    print(f"{'='*60}")
    print(f"   Monto a pagar: ${pago.monto_pago}")
    print(f"   Incluye multas: {pago.incluir_multas}")
    if mora_aplicada:
        print(f"   + Mora aplicada: ${monto_mora}")
    print(f"   = TOTAL A COBRAR: ${monto_total_cobrar}")
    print(f"{'='*60}\n")
    
    try:
        # ========================================
        # PASO 5: CREAR REGISTRO DE PAGO
        # ========================================
        
        # Construir observaciones del pago
        observaciones_pago = pago.observaciones or ""
        
        if mora_aplicada:
            obs_mora = f"[MORA APLICADA] ${monto_mora}. {detalle_mora}"
            observaciones_pago = f"{obs_mora}\n{observaciones_pago}" if observaciones_pago else obs_mora
        
        nuevo_pago = Pago(
            id_factura=pago.id_factura,
            monto_pago=monto_total_cobrar,  # ✅ INCLUYE MORA
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
        
        print(f"✅ Pago registrado: ID={nuevo_pago.id_pago}, Monto=${monto_total_cobrar}")
        
        # ========================================
        # PASO 6: PROCESAR FACTURA Y MULTAS
        # ========================================
        if pago.id_factura and factura:
            # ⭐ CALCULAR TOTAL PAGADO ACUMULADO
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
            
            # ⭐ CALCULAR SALDO PENDIENTE (solo para logging)
            saldo_pendiente = max(Decimal('0.00'), total_completo_esperado - total_pagado)
            print(f"   Saldo pendiente calculado: ${saldo_pendiente}")
            
            # ⭐ DECISIÓN 1: ¿Se pagó TODO (consumo + servicios + multas)?
            if total_pagado >= total_completo_esperado:
                print(f"\n✅ FACTURA PAGADA COMPLETAMENTE")
                factura.estado_factura = 'pagada'
                
                # Procesar todas las multas como pagadas
                if len(multas_en_factura) > 0:
                    multas_procesadas = procesar_multas_pagadas(multas_en_factura, db)
                    print(f"   ✅ {multas_procesadas} multa(s) marcada(s) como pagadas")
            
            # ⭐ DECISIÓN 2: Pago ACTUAL incluye multas?
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
            
            # ⭐ DECISIÓN 3: Pago NO incluye multas
            elif not pago.incluir_multas:
                print(f"\n⚠️ PAGO SIN MULTAS")
                
                # Si se pagó el monto sin multas completo, liberar multas
                if total_pagado >= total_sin_multas_esperado:
                    print(f"   ✔ Se completó el pago sin multas")
                    
                    if len(multas_en_factura) > 0:
                        multas_liberadas = liberar_multas_no_pagadas(multas_en_factura, db)
                        
                        # Agregar info a observaciones
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
        
        # ========================================
        # PASO 7: COMMIT Y AUDITORÍA
        # ========================================
        db.commit()
        db.refresh(nuevo_pago)
        
        # Auditoría
        desc_auditoria = f"Pago #{nuevo_pago.id_pago} - Monto: ${monto_total_cobrar} - Método: {pago.metodo_pago}"
        if mora_aplicada:
            desc_auditoria += f" (Mora: ${monto_mora})"
        if pago.incluir_multas and multas_procesadas > 0:
            desc_auditoria += f" ({multas_procesadas} multa(s) pagada(s))"
        if not pago.incluir_multas and multas_liberadas > 0:
            desc_auditoria += f" ({multas_liberadas} multa(s) liberada(s))"
        
        registrar_auditoria(
            db=db,
            accion="CREATE",
            descripcion=desc_auditoria,
            id_usuario=current_user.id_usuario_sistema
        )
        
        # Notificación
        mensaje_notif = f"Pago de ${monto_total_cobrar} registrado"
        if mora_aplicada:
            mensaje_notif += f" (incluye mora de ${monto_mora})"
        if pago.incluir_multas and multas_procesadas > 0:
            mensaje_notif += f". {multas_procesadas} multa(s) pagada(s)"
        if not pago.incluir_multas and multas_liberadas > 0:
            mensaje_notif += f". {multas_liberadas} multa(s) liberada(s)"
        
        registrar_notificacion(
            db=db,
            id_usuario=current_user.id_usuario_sistema,
            titulo="Pago registrado",
            mensaje=mensaje_notif,
            tipo="exito"
        )
        
        return nuevo_pago
        
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

@router.post("/pago-masivo", status_code=status.HTTP_201_CREATED)
def crear_pago_masivo(
    pago_masivo: dict,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Procesa un pago masivo para múltiples facturas del mismo afiliado.
    El periodo actual es obligatorio.
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "pagos", "crear")
    
    try:
        print(f"\n{'='*70}")
        print(f"💰 PROCESANDO PAGO MASIVO")
        print(f"{'='*70}")
        print(f"Afiliado: {pago_masivo['id_usuario_afi']}")
        print(f"Facturas a procesar: {len(pago_masivo['facturas'])}")
        print(f"Monto total: ${pago_masivo['monto_total']}")
        
        pagos_creados = []
        facturas_procesadas = 0
        mora_total_aplicada = Decimal('0.00')
        
        # Procesar cada factura
        for item_factura in pago_masivo['facturas']:
            id_factura = item_factura['id_factura']
            monto = Decimal(str(item_factura['monto']))
            incluir_multas = item_factura.get('incluir_multas', True)
            es_actual = item_factura.get('es_factura_actual', False)
            
            print(f"\n--- Procesando Factura {id_factura} ---")
            print(f"Monto: ${monto}")
            print(f"Incluye multas: {incluir_multas}")
            print(f"Es periodo actual: {es_actual}")
            
            # Crear pago individual
            pago_data = PagoCreate(
                id_factura=id_factura,
                monto_pago=float(monto),
                metodo_pago=pago_masivo['metodo_pago'],
                id_usuario_afi=pago_masivo['id_usuario_afi'],
                id_cajero=pago_masivo['id_cajero'],
                observaciones=f"[PAGO MASIVO] {pago_masivo.get('observaciones', '')}",
                incluir_multas=incluir_multas
            )
            
            # Llamar a la función de crear pago individual
            pago_creado = crear_pago(pago_data, db, payload)
            pagos_creados.append(pago_creado)
            facturas_procesadas += 1
            
            print(f"✅ Pago creado: ID={pago_creado.id_pago}")
        
        print(f"\n{'='*70}")
        print(f"✅ PAGO MASIVO COMPLETADO")
        print(f"{'='*70}")
        print(f"Facturas procesadas: {facturas_procesadas}")
        print(f"Pagos creados: {len(pagos_creados)}")
        print(f"{'='*70}\n")
        
        # Registrar auditoría
        registrar_auditoria(
            db=db,
            accion="CREATE",
            descripcion=f"Pago masivo: {facturas_procesadas} facturas - Total: ${pago_masivo['monto_total']}",
            id_usuario=current_user.id_usuario_sistema
        )
        
        return {
            "success": True,
            "facturas_procesadas": facturas_procesadas,
            "pagos_creados": len(pagos_creados),
            "monto_total": float(pago_masivo['monto_total']),
            "pagos": [
                {
                    "id_pago": p.id_pago,
                    "id_factura": p.id_factura,
                    "monto": float(p.monto_pago)
                } for p in pagos_creados
            ]
        }
        
    except Exception as e:
        db.rollback()
        print(f"❌ ERROR EN PAGO MASIVO: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al procesar pago masivo: {str(e)}"
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
    from utils.facturacion import obtener_configuracion_iva  # Ajustar ruta según tu proyecto
    
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
    impuesto_sin_multas = base_imponible_sin_multas * tasa_impuesto
    total_sin_multas = base_imponible_sin_multas + impuesto_sin_multas
    
    #  CALCULAR MONTOS SOLO MULTAS
    base_imponible_multas = monto_multas
    impuesto_multas = base_imponible_multas * tasa_impuesto
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
        print(f" REGENERANDO FACTURA")
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
            fecha_emision=datetime.now().date(),  #  Usar .date() para tipo Date
            
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
        
        print(f" Nueva factura creada: {nueva_factura.num_factura}")
        print(f"   ID: {nueva_factura.id_factura}")
        print(f"   Total: ${nueva_factura.total}")
        
        # ============================================
        # PASO 4: COPIAR DETALLES (CORREGIDO)
        # ============================================
        detalles_originales = db.query(DetalleFactura).filter(
            DetalleFactura.id_factura == factura_original.id_factura
        ).all()

        detalles_creados = 0
        for detalle_orig in detalles_originales:
            #  COPIAR TODOS LOS CAMPOS NECESARIOS
            nuevo_detalle = DetalleFactura(
                id_factura=nueva_factura.id_factura,
                tipo_detalle=detalle_orig.tipo_detalle,
                id_servicio=detalle_orig.id_servicio,           #  AGREGAR
                id_multa_afiliados=detalle_orig.id_multa_afiliados,  #  AGREGAR
                subtotal_detalle=detalle_orig.subtotal_detalle,
                descripcion=detalle_orig.descripcion
            )
            db.add(nuevo_detalle)
            detalles_creados += 1
            
            # Debug opcional
            print(f"   📋 Detalle copiado: {detalle_orig.tipo_detalle} - "
                f"id_servicio={detalle_orig.id_servicio}, "
                f"id_multa_afi={detalle_orig.id_multa_afiliados}")

        print(f" {detalles_creados} detalle(s) copiado(s)")


        
        # ============================================
        # PASO 5: MARCAR FACTURA ORIGINAL COMO ANULADA
        # ============================================
        factura_original.estado_factura = 'anulada'
        # No cambiar activo porque no existe
        
        print(f" Factura original {factura_original.num_factura} marcada como ANULADA")
        
        # ============================================
        # PASO 6: COMMIT
        # ============================================
        db.commit()
        db.refresh(nueva_factura)
        
        print(f"\n{'='*60}")
        print(f" FACTURA REGENERADA EXITOSAMENTE")
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
    request: dict,  #  Recibir body con motivo y flag
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
        
        print(f" Pago #{pago.id_pago} anulado")
        
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