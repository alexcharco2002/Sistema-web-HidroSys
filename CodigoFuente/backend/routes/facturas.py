# routes/facturas.py

import locale
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
from datetime import datetime, date
from decimal import Decimal

from models.factura import Factura
from models.detalle_factura import DetalleFactura
from models.iva import IVA
from models.servicio import Servicio
from models.user import UsuarioSistema
from models.role import RolAccion

from schemas.factura import (
    AplicarDescuentoRequest, AplicarServiciosMasivoRequest, FacturaCreate, FacturaUpdate, FacturaResponse,
    FacturaConDetalles, FacturaStats
)
from schemas.detalle_factura import (
    DetalleFacturaCreate, DetalleFacturaUpdate, DetalleFacturaResponse
)

from schemas.servicio import ServicioResponse
from utils.facturacion import (
    agregar_servicios_a_factura,
    calcular_descuento,
    generar_numero_factura,
    validar_periodo_factura,
    calcular_tarifa_consumo,
    calcular_totales_factura,
    validar_unicidad_factura,
    validar_cambio_estado_factura,
    validar_coherencia_totales_factura,
    obtener_estadisticas_facturacion,
    marcar_facturas_vencidas
)
from utils.notifications import registrar_notificacion
from utils.audit_logger import registrar_auditoria

from db.session import SessionLocal
from security.jwt import verify_token

# routes/facturas.py

from schemas.factura import FacturaResponse, FacturaConUsuarioCompleto  # Agregar aquí
from sqlalchemy.orm import joinedload  # Agregar esta importación
from models.affiliate import UsuarioAfiliado  # Agregar para joinedload


router = APIRouter(prefix="/facturas", tags=["facturas"])


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

# ========================================
# LISTAR servicios para aplicar a afiliados opcional 
# ========================================
@router.get("/activos-facturacion", response_model=List[ServicioResponse])
def listar_servicios_para_facturacion(
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Lista SOLO servicios activos y vigentes para facturación
    Requiere permiso: servicios.lectura
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "facturas", "lectura")
    
    # Solo servicios activos y vigentes
    servicios = db.query(Servicio).filter(
        Servicio.activo == True,
        Servicio.es_vigente == True
    ).order_by(Servicio.nombre).all()
    
    return servicios



# ========================================
# LISTAR FACTURAS
# ========================================
@router.get("/", response_model=List[FacturaConUsuarioCompleto])  # ✅ Cambio 1
def listar_facturas(
    search: Optional[str] = Query(None, description="Buscar por número de factura"),
    id_usuario_afi: Optional[int] = Query(None, description="Filtrar por usuario afiliado"),
    periodo: Optional[str] = Query(None, description="Filtrar por periodo (YYYY-MM)"),
    estado_factura: Optional[str] = Query(None, description="Filtrar por estado"),
    fecha_desde: Optional[date] = Query(None, description="Fecha de emisión desde"),
    fecha_hasta: Optional[date] = Query(None, description="Fecha de emisión hasta"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Lista facturas con múltiples filtros e información completa del usuario
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "facturas", "lectura")
    
    # ✅ Cambio 2: Agregar joinedload
    query = db.query(Factura).options(
        joinedload(Factura.usuario_afiliado)
            .joinedload(UsuarioAfiliado.usuario_sistema),
        joinedload(Factura.usuario_afiliado)
            .joinedload(UsuarioAfiliado.sector),
        joinedload(Factura.usuario_afiliado)
            .joinedload(UsuarioAfiliado.medidores)
    )
    
    # Filtros (todo igual)
    if search:
        query = query.filter(Factura.num_factura.ilike(f"%{search}%"))
    
    if id_usuario_afi:
        query = query.filter(Factura.id_usuario_afi == id_usuario_afi)
    
    if periodo:
        query = query.filter(Factura.periodo == periodo)
    
    if estado_factura:
        query = query.filter(Factura.estado_factura == estado_factura)
    
    if fecha_desde:
        query = query.filter(Factura.fecha_emision >= fecha_desde)
    
    if fecha_hasta:
        query = query.filter(Factura.fecha_emision <= fecha_hasta)
    
    # Ordenar por fecha de emisión descendente
    query = query.order_by(Factura.fecha_emision.desc(), Factura.id_factura.desc())
    
    facturas = query.offset(skip).limit(limit).all()
    return facturas


# ========================================
# ESTADÍSTICAS DE FACTURACIÓN
# ========================================
@router.get("/stats/resumen", response_model=FacturaStats)
def obtener_estadisticas(
    periodo: Optional[str] = Query(None, description="Periodo específico (YYYY-MM)"),
    id_usuario_afi: Optional[int] = Query(None, description="Usuario específico"),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """Obtiene estadísticas generales de facturación"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "facturas", "lectura")
    
    stats = obtener_estadisticas_facturacion(db, periodo, id_usuario_afi)
    return stats
#
# Intentar configurar locale español
try:
    locale.setlocale(locale.LC_TIME, 'es_ES.UTF-8')
except:
    try:
        locale.setlocale(locale.LC_TIME, 'Spanish_Spain.1252')
    except:
        pass  # Usar nombres de meses en inglés como fallback

# Diccionario de nombres de meses en español (fallback)
MESES_ES = {
    1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril",
    5: "Mayo", 6: "Junio", 7: "Julio", 8: "Agosto",
    9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre"
}

# ========================================
# 🆕 ENDPOINT: OBTENER PERIODOS DISPONIBLES DE FACTURAS
# ========================================
@router.get("/periodos/disponibles", response_model=dict)
def obtener_periodos_facturas_disponibles(
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Obtiene los periodos (mes/año) disponibles para facturación.
    Muestra:
    - Periodo actual sugerido
    - Últimos 6 meses con estadísticas
    - Próximos 2 meses
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "facturas", "lectura")

    try:
        # Fecha actual
        hoy = date.today()
        mes_actual = hoy.month
        anio_actual = hoy.year

        periodos = []

        # Generar últimos 6 meses + mes actual + próximos 2 meses
        for offset in range(-6, 3):
            # Calcular mes y año base
            mes_temp = mes_actual + offset
            anio_temp = anio_actual

            # Normalizar mes/año
            while mes_temp > 12:
                mes_temp -= 12
                anio_temp += 1
            while mes_temp < 1:
                mes_temp += 12
                anio_temp -= 1

            periodo_str = f"{anio_temp}-{mes_temp:02d}"

            # 📌 Estadísticas de facturación del periodo
            stats = obtener_estadisticas_facturacion(db, periodo_str, None)

            # stats es dict / FacturaStats → acceder por clave
            total_facturas_periodo = stats.get("total_facturas", 0) if stats else 0
            monto_total = stats.get("monto_total", 0) if stats else 0
            monto_cobrado = stats.get("monto_total_cobrado", 0) if stats else 0
            monto_pendiente = stats.get("monto_total_pendiente", 0) if stats else 0

            porcentaje_cobrado = 0.0
            if monto_total and monto_total > 0:
                porcentaje_cobrado = float(monto_cobrado / monto_total * 100)

            # Sugerido: mes actual siempre
            sugerido = (mes_temp == mes_actual and anio_temp == anio_actual)

            periodos.append({
                "mes": mes_temp,
                "anio": anio_temp,
                "nombre_mes": MESES_ES.get(mes_temp, f"Mes {mes_temp}"),
                "tiene_facturas": total_facturas_periodo > 0,
                "total_facturas": total_facturas_periodo,
                "monto_total": float(monto_total),
                "monto_cobrado": float(monto_cobrado),
                "monto_pendiente": float(monto_pendiente),
                "porcentaje_cobrado": round(porcentaje_cobrado, 1),
                "sugerido": sugerido,
                "valor": periodo_str,
                "texto": f"{MESES_ES.get(mes_temp, f'Mes {mes_temp}')} {anio_temp}",
            })

        # Ordenar por año y mes descendente (más reciente primero)
        periodos.sort(key=lambda x: (x["anio"], x["mes"]), reverse=True)

        # Identificar periodo actual sugerido
        periodo_actual = next((p for p in periodos if p["sugerido"]), periodos[0])

        return {
            "periodo_actual": periodo_actual,
            "periodos_disponibles": periodos,
        }

    except Exception as e:
        print(f"❌ Error obteniendo periodos de facturas: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener periodos de facturas: {str(e)}"
        )


# ========================================
# OBTENER FACTURA POR ID (CON DETALLES)
# ========================================
@router.get("/{id_factura}", response_model=FacturaConDetalles)
def obtener_factura(
    id_factura: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """Obtiene una factura específica con todos sus detalles"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "facturas", "lectura")
    
    factura = db.query(Factura).filter(Factura.id_factura == id_factura).first()
    
    if not factura:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Factura no encontrada"
        )
    
    return factura


# ========================================
# CREAR NUEVA FACTURA
# ========================================
@router.post("/", response_model=FacturaResponse, status_code=status.HTTP_201_CREATED)
def crear_factura(
    factura: FacturaCreate,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Crea una nueva factura
    Genera automáticamente el número de factura si no se proporciona
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "facturas", "crear")
    
    # Validar periodo
    es_valido, mensaje = validar_periodo_factura(factura.periodo)
    if not es_valido:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=mensaje
        )
    
    # Validar unicidad (usuario + periodo)
    es_valido, mensaje = validar_unicidad_factura(
        db, factura.id_usuario_afi, factura.periodo
    )
    if not es_valido:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=mensaje
        )
    
    # Generar número de factura
    num_factura = generar_numero_factura(db, factura.periodo)
    
    try:
        nueva_factura = Factura(
            num_factura=num_factura,
            id_usuario_afi=factura.id_usuario_afi,
            id_lectura=factura.id_lectura,
            id_tarifa=factura.id_tarifa,
            consumo_m3=factura.consumo_m3,
            exceso_m3=factura.exceso_m3,
            valor_consumo=factura.valor_consumo,
            valor_exceso=factura.valor_exceso,
            descuento=factura.descuento or Decimal('0.00'),
            subtotal=factura.subtotal,
            impuesto=factura.impuesto,
            total=factura.total,
            fecha_emision=factura.fecha_emision or date.today(),
            periodo=factura.periodo,
            estado_factura=factura.estado_factura
        )
        
        db.add(nueva_factura)
        db.commit()
        db.refresh(nueva_factura)
        
        # Auditoría
        registrar_auditoria(
            db=db,
            accion="CREATE",
            descripcion=f"Factura {num_factura} creada para usuario {factura.id_usuario_afi} - Periodo {factura.periodo}",
            id_usuario=current_user.id_usuario_sistema
        )
        
        registrar_notificacion(
            db=db,
            id_usuario=current_user.id_usuario_sistema,
            titulo="Factura creada",
            mensaje=f"Factura {num_factura} creada correctamente",
            tipo="exito"
        )
        
        return nueva_factura
    
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Error de integridad: verifique las relaciones (usuario, lectura, tarifa)"
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear factura: {str(e)}"
        )

# ========================================
# ACTUALIZAR FACTURA
# ========================================
@router.put("/{id_factura}", response_model=FacturaResponse)
def actualizar_factura(
    id_factura: int,
    factura_update: FacturaUpdate,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Actualiza una factura existente
    Solo permite actualizar facturas en estado 'pendiente'
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "facturas", "actualizar")
    
    factura = db.query(Factura).filter(Factura.id_factura == id_factura).first()
    
    if not factura:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Factura no encontrada"
        )
    
    # Solo permitir actualizar facturas pendientes
    if factura.estado_factura not in ['pendiente', 'vencida']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se puede modificar una factura en estado '{factura.estado_factura}'"
        )
    
    # Validar cambio de estado
    if factura_update.estado_factura:
        es_valido, mensaje = validar_cambio_estado_factura(
            factura.estado_factura,
            factura_update.estado_factura
        )
        if not es_valido:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=mensaje
            )
    
    try:
        # Actualizar campos
        if factura_update.estado_factura is not None:
            factura.estado_factura = factura_update.estado_factura
        
        if factura_update.descuento is not None:
            factura.descuento = factura_update.descuento
        
        if factura_update.total is not None:
            factura.total = factura_update.total
        
        db.commit()
        db.refresh(factura)
        
        # Auditoría
        registrar_auditoria(
            db=db,
            accion="UPDATE",
            descripcion=f"Factura {factura.num_factura} actualizada",
            id_usuario=current_user.id_usuario_sistema
        )
        
        return factura
    
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al actualizar factura: {str(e)}"
        )


# ========================================
# CAMBIAR ESTADO DE FACTURA
# ========================================
@router.patch("/{id_factura}/estado", response_model=FacturaResponse)
def cambiar_estado_factura(
    id_factura: int,
    nuevo_estado: str = Query(..., description="Nuevo estado (pendiente, pagada, anulada, vencida)"),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Cambia el estado de una factura con validaciones de transición
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "facturas", "actualizar")
    
    factura = db.query(Factura).filter(Factura.id_factura == id_factura).first()
    
    if not factura:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Factura no encontrada"
        )
    
    # Validar transición de estado
    es_valido, mensaje = validar_cambio_estado_factura(
        factura.estado_factura,
        nuevo_estado
    )
    
    if not es_valido:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=mensaje
        )
    
    try:
        estado_anterior = factura.estado_factura
        factura.estado_factura = nuevo_estado
        
        db.commit()
        db.refresh(factura)
        
        # Auditoría
        registrar_auditoria(
            db=db,
            accion="UPDATE",
            descripcion=f"Estado de factura {factura.num_factura} cambiado de '{estado_anterior}' a '{nuevo_estado}'",
            id_usuario=current_user.id_usuario_sistema
        )
        
        registrar_notificacion(
            db=db,
            id_usuario=current_user.id_usuario_sistema,
            titulo="Estado de factura actualizado",
            mensaje=f"Factura {factura.num_factura} ahora está '{nuevo_estado}'",
            tipo="info"
        )
        
        return factura
    
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al cambiar estado de la factura"
        )


# ========================================
# ANULAR FACTURA
# ========================================
@router.patch("/{id_factura}/anular", response_model=FacturaResponse)
def anular_factura(
    id_factura: int,
    motivo: Optional[str] = Query(None, description="Motivo de anulación"),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Anula una factura (solo si está pendiente o vencida)
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "facturas", "eliminar")
    
    factura = db.query(Factura).filter(Factura.id_factura == id_factura).first()
    
    if not factura:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Factura no encontrada"
        )
    
    if factura.estado_factura not in ['pendiente', 'vencida']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se puede anular una factura en estado '{factura.estado_factura}'"
        )
    
    try:
        factura.estado_factura = 'anulada'
        
        db.commit()
        db.refresh(factura)
        
        # Auditoría
        registrar_auditoria(
            db=db,
            accion="UPDATE",
            descripcion=f"Factura {factura.num_factura} anulada. Motivo: {motivo or 'No especificado'}",
            id_usuario=current_user.id_usuario_sistema
        )
        
        return factura
    
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al anular la factura"
        )


# ========================================
# ELIMINAR FACTURA (Solo facturas pendientes sin detalles)
# ========================================
@router.delete("/{id_factura}", status_code=status.HTTP_200_OK)
def eliminar_factura(
    id_factura: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Elimina físicamente una factura
    Solo permite eliminar facturas pendientes sin detalles asociados
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "facturas", "eliminar")
    
    factura = db.query(Factura).filter(Factura.id_factura == id_factura).first()
    
    if not factura:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Factura no encontrada"
        )
    
    if factura.estado_factura != 'pendiente':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Solo se pueden eliminar facturas pendientes. Use 'anular' para facturas en otros estados."
        )
    
    # Verificar si tiene detalles
    tiene_detalles = db.query(DetalleFactura).filter(
        DetalleFactura.id_factura == id_factura
    ).count() > 0
    
    if tiene_detalles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede eliminar una factura con detalles asociados"
        )
    
    try:
        num_factura = factura.num_factura
        db.delete(factura)
        db.commit()
        
        # Auditoría
        registrar_auditoria(
            db=db,
            accion="DELETE",
            descripcion=f"Factura {num_factura} eliminada permanentemente",
            id_usuario=current_user.id_usuario_sistema
        )
        
        return {
            "success": True,
            "message": f"Factura {num_factura} eliminada correctamente"
        }
    
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al eliminar la factura"
        )


# ========================================
# MARCAR FACTURAS VENCIDAS (Job/Tarea)
# ========================================
@router.post("/jobs/marcar-vencidas", status_code=status.HTTP_200_OK)
def ejecutar_marcado_vencidas(
    dias_vencimiento: int = Query(30, description="Días después de emisión para considerar vencida"),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Marca como vencidas las facturas pendientes que superan el tiempo límite
    Útil para ejecutar como tarea programada
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "facturas", "actualizar")
    
    try:
        cantidad = marcar_facturas_vencidas(db, dias_vencimiento)
        
        registrar_auditoria(
            db=db,
            accion="UPDATE",
            descripcion=f"Marcadas {cantidad} facturas como vencidas (>{dias_vencimiento} días)",
            id_usuario=current_user.id_usuario_sistema
        )
        
        return {
            "success": True,
            "facturas_marcadas": cantidad,
            "message": f"Se marcaron {cantidad} facturas como vencidas"
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al marcar facturas vencidas: {str(e)}"
        )


# ========================================
# ENDPOINTS DE DETALLES DE FACTURA
# ========================================

@router.get("/{id_factura}/detalles", response_model=List[DetalleFacturaResponse])
def listar_detalles_factura(
    id_factura: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """Lista todos los detalles de una factura específica"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "facturas", "lectura")
    
    # Verificar que la factura existe
    factura = db.query(Factura).filter(Factura.id_factura == id_factura).first()
    if not factura:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Factura no encontrada"
        )
    
    detalles = db.query(DetalleFactura).filter(
        DetalleFactura.id_factura == id_factura
    ).all()
    
    return detalles


@router.post("/{id_factura}/detalles", response_model=DetalleFacturaResponse, status_code=status.HTTP_201_CREATED)
def crear_detalle_factura(
    id_factura: int,
    detalle: DetalleFacturaCreate,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """Crea un nuevo detalle para una factura"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "facturas", "crear")
    
    # Verificar que la factura existe y está pendiente
    factura = db.query(Factura).filter(Factura.id_factura == id_factura).first()
    if not factura:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Factura no encontrada"
        )
    
    if factura.estado_factura != 'pendiente':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se pueden agregar detalles a una factura en estado '{factura.estado_factura}'"
        )
    
    try:
        nuevo_detalle = DetalleFactura(
            id_factura=id_factura,
            tipo_detalle=detalle.tipo_detalle,
            id_servicio=detalle.id_servicio,
            id_multa_afiliados=detalle.id_multa_afiliados,
            subtotal_detalle=detalle.subtotal_detalle,
            descripcion=detalle.descripcion
        )
        
        db.add(nuevo_detalle)
        db.commit()
        db.refresh(nuevo_detalle)
        
        # Auditoría
        registrar_auditoria(
            db=db,
            accion="CREATE",
            descripcion=f"Detalle agregado a factura {factura.num_factura} - Tipo: {detalle.tipo_detalle}",
            id_usuario=current_user.id_usuario_sistema
        )
        
        return nuevo_detalle
    
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Error de integridad: verifique las relaciones (servicio/multa)"
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear detalle: {str(e)}"
        )

@router.patch("/{factura_id}/aplicar-descuento", response_model=dict)
def aplicar_descuento_factura(
    factura_id: int,
    descuento_data: AplicarDescuentoRequest, 
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Aplica descuento a una factura existente y opcionalmente la marca como pagada
    RECALCULA: subtotal desde detalles + descuento + IVA dinámico
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "facturas", "actualizar")
    
    # Obtener factura
    factura = db.query(Factura).filter(
        Factura.id_factura == factura_id
    ).first()
    
    if not factura:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Factura no encontrada"
        )
    
    # Solo se puede aplicar descuento a facturas pendientes o vencidas
    if factura.estado_factura not in ['pendiente', 'vencida']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se puede aplicar descuento a factura con estado '{factura.estado_factura}'"
        )
    
    try:
        print(f"\n{'='*60}")
        print(f"💸 APLICANDO DESCUENTO A FACTURA {factura.num_factura}")
        print(f"{'='*60}")
        
        # ============================================
        # 1. ✅ SUMAR TODOS LOS DETALLES (NO SOLO CONSUMO)
        # ============================================
        detalles = db.query(DetalleFactura).filter(
            DetalleFactura.id_factura == factura_id
        ).all()
        
        subtotal_base = Decimal('0.00')
        
        print(f"\n📋 DETALLES DE LA FACTURA:")
        for detalle in detalles:
            subtotal_base += detalle.subtotal_detalle
            print(f"   {detalle.tipo_detalle}: ${detalle.subtotal_detalle} - {detalle.descripcion}")
        
        print(f"\n💰 SUBTOTAL BASE (sin descuento): ${subtotal_base}")
        
        # ============================================
        # 2. ✅ CALCULAR NUEVO DESCUENTO
        # ============================================
        valor_descuento_decimal = Decimal(str(descuento_data.valor_descuento))
        nuevo_descuento, subtotal_con_descuento = calcular_descuento(
            subtotal=subtotal_base,
            tipo_descuento=descuento_data.tipo_descuento,
            valor_descuento=valor_descuento_decimal
        )
        
        if descuento_data.tipo_descuento == 'porcentaje':
            print(f"💸 Descuento ({descuento_data.valor_descuento}%): -${nuevo_descuento}")
        elif descuento_data.tipo_descuento == 'valor':
            print(f"💸 Descuento (fijo): -${nuevo_descuento}")
        else:
            print(f"💸 Sin descuento")
        
        print(f"💰 SUBTOTAL CON DESCUENTO: ${subtotal_con_descuento}")
        
        # ============================================
        # 3. ✅ CALCULAR IVA DINÁMICAMENTE DESDE T_IVA
        # ============================================
        iva_config = db.query(IVA).filter(
            IVA.activo == True,
            IVA.es_aplicable == True
        ).first()
        
        if iva_config:
            porcentaje_iva = Decimal(str(iva_config.porcentaje)) / Decimal('100')
            nuevo_impuesto = subtotal_con_descuento * porcentaje_iva
            print(f"💰 IVA ({iva_config.porcentaje}%): ${nuevo_impuesto}")
        else:
            nuevo_impuesto = Decimal('0.00')
            print(f"💰 IVA: $0.00 (no hay config activa y aplicable)")
        
        # ============================================
        # 4. ✅ CALCULAR TOTAL FINAL
        # ============================================
        nuevo_total = subtotal_con_descuento + nuevo_impuesto
        
        print(f"\n{'='*60}")
        print(f"📊 RESUMEN FINAL:")
        print(f"   Subtotal base: ${subtotal_base}")
        print(f"   Descuento: -${nuevo_descuento}")
        print(f"   Subtotal con descuento: ${subtotal_con_descuento}")
        print(f"   IVA: ${nuevo_impuesto}")
        print(f"   ✅ TOTAL: ${nuevo_total}")
        print(f"{'='*60}\n")
        
        # ============================================
        # 5. ✅ ACTUALIZAR FACTURA
        # ============================================
        factura.descuento = nuevo_descuento
        factura.subtotal = subtotal_con_descuento
        factura.impuesto = nuevo_impuesto
        factura.total = nuevo_total
        
        mensaje_descuento = ""
        if descuento_data.tipo_descuento == 'porcentaje':
            mensaje_descuento = f"Descuento del {descuento_data.valor_descuento}% aplicado (-${nuevo_descuento})"
        elif descuento_data.tipo_descuento == 'valor':
            mensaje_descuento = f"Descuento de ${descuento_data.valor_descuento} aplicado"
        else:
            mensaje_descuento = "Descuento removido"
        
        # Marcar como pagada si se solicitó
        if descuento_data.marcar_como_pagada:
            factura.estado_factura = 'pagada'
            mensaje_descuento += " - Factura marcada como PAGADA"
            print(f"✅ Estado cambiado a: PAGADA")
        
        # ============================================
        # 6. ✅ COMMIT A LA BASE DE DATOS
        # ============================================
        db.commit()
        db.refresh(factura)
        
        print(f"✅ Factura actualizada en BD: {factura.num_factura}")
        print(f"   Descuento: ${factura.descuento}")
        print(f"   Subtotal: ${factura.subtotal}")
        print(f"   Impuesto: ${factura.impuesto}")
        print(f"   Total: ${factura.total}")
        print(f"   Estado: {factura.estado_factura}\n")
        
        # Auditoría
        registrar_auditoria(
            db=db,
            accion="UPDATE",
            descripcion=f"Factura {factura.num_factura}: {mensaje_descuento}. Nuevo total: ${nuevo_total}",
            id_usuario=current_user.id_usuario_sistema
        )
        
        return {
            "success": True,
            "message": mensaje_descuento,
            "factura": {
                "id_factura": factura.id_factura,
                "num_factura": factura.num_factura,
                "descuento_aplicado": float(nuevo_descuento),
                "subtotal": float(subtotal_con_descuento),
                "impuesto": float(nuevo_impuesto),
                "total": float(nuevo_total),
                "estado": factura.estado_factura
            }
        }
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error al aplicar descuento: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al aplicar descuento: {str(e)}"
        )


@router.put("/{id_factura}/detalles/{id_detalle}", response_model=DetalleFacturaResponse)
def actualizar_detalle_factura(
    id_factura: int,
    id_detalle: int,
    detalle_update: DetalleFacturaUpdate,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """Actualiza un detalle de factura existente"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "facturas", "actualizar")
    
    # Verificar factura
    factura = db.query(Factura).filter(Factura.id_factura == id_factura).first()
    if not factura:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Factura no encontrada"
        )
    
    if factura.estado_factura != 'pendiente':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se pueden modificar detalles de una factura en estado '{factura.estado_factura}'"
        )
    
    # Buscar detalle
    detalle = db.query(DetalleFactura).filter(
        DetalleFactura.id_detalle == id_detalle,
        DetalleFactura.id_factura == id_factura
    ).first()
    
    if not detalle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Detalle no encontrado"
        )
    
    try:
        # Actualizar campos
        if detalle_update.subtotal_detalle is not None:
            detalle.subtotal_detalle = detalle_update.subtotal_detalle
        
        if detalle_update.descripcion is not None:
            detalle.descripcion = detalle_update.descripcion
        
        db.commit()
        db.refresh(detalle)
        
        # Auditoría
        registrar_auditoria(
            db=db,
            accion="UPDATE",
            descripcion=f"Detalle {id_detalle} de factura {factura.num_factura} actualizado",
            id_usuario=current_user.id_usuario_sistema
        )
        
        return detalle
    
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al actualizar detalle: {str(e)}"
        )


@router.delete("/{id_factura}/detalles/{id_detalle}", status_code=status.HTTP_200_OK)
def eliminar_detalle_factura(
    id_factura: int,
    id_detalle: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """Elimina un detalle de factura"""
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "facturas", "eliminar")
    
    # Verificar factura
    factura = db.query(Factura).filter(Factura.id_factura == id_factura).first()
    if not factura:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Factura no encontrada"
        )
    
    if factura.estado_factura != 'pendiente':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se pueden eliminar detalles de una factura en estado '{factura.estado_factura}'"
        )
    
    # Buscar detalle
    detalle = db.query(DetalleFactura).filter(
        DetalleFactura.id_detalle == id_detalle,
        DetalleFactura.id_factura == id_factura
    ).first()
    
    if not detalle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Detalle no encontrado"
        )
    
    try:
        db.delete(detalle)
        db.commit()
        
        # Auditoría
        registrar_auditoria(
            db=db,
            accion="DELETE",
            descripcion=f"Detalle {id_detalle} eliminado de factura {factura.num_factura}",
            id_usuario=current_user.id_usuario_sistema
        )
        
        return {
            "success": True,
            "message": "Detalle eliminado correctamente"
        }
    
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al eliminar detalle"
        )
    
# ========================================
# ENDPOINT: APLICAR SERVICIOS A TODAS LAS FACTURA 
# ========================================
@router.post("/aplicar-servicios-masivo", response_model=dict)
def aplicar_servicios_a_usuarios(
    data: AplicarServiciosMasivoRequest,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Aplica servicios adicionales a TODAS las facturas del período
    Crea detalles de factura para servicios seleccionados
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "facturas", "crud")
    
    try:
        # Validar servicios existen
        servicios = db.query(Servicio).filter(
            Servicio.id_servicio.in_(data.id_servicios),
            Servicio.activo == True,
            Servicio.es_vigente == True
        ).all()
        
        if len(servicios) != len(data.id_servicios):
            raise HTTPException(
                status_code=400,
                detail="Algunos servicios no existen o están inactivos"
            )
        
        print(f"\n{'='*60}")
        print(f"💼 APLICANDO SERVICIOS MASIVO - PERIODO: {data.periodo}")
        print(f"{'='*60}")
        
        # 🔥 APLICAR A TODAS LAS FACTURAS DEL PERÍODO
        facturas = db.query(Factura).filter(
            Factura.periodo == data.periodo,
            Factura.estado_factura.in_(['pendiente', 'vencida'])  # Solo pendientes/vencidas
        ).all()
        
        if not facturas:
            raise HTTPException(
                status_code=404,
                detail=f"No se encontraron facturas pendientes o vencidas para el período {data.periodo}"
            )
        
        print(f"📋 Facturas a procesar: {len(facturas)}")
        
        # Obtener IVA config
        iva_config = db.query(IVA).filter(
            IVA.activo == True,
            IVA.es_aplicable == True
        ).first()
        
        porcentaje_iva = Decimal('0.00')
        if iva_config:
            porcentaje_iva = Decimal(str(iva_config.porcentaje)) / Decimal('100')
        
        detalles_creados = 0
        facturas_afectadas = 0
        
        for factura in facturas:
            detalles_nuevos = []
            
            for servicio in servicios:
                # Verificar que no exista ya este servicio
                existe = db.query(DetalleFactura).filter(
                    DetalleFactura.id_factura == factura.id_factura,
                    DetalleFactura.tipo_detalle == 'servicio',
                    DetalleFactura.id_servicio == servicio.id_servicio
                ).first()
                
                if not existe:
                    detalle = DetalleFactura(
                        id_factura=factura.id_factura,
                        tipo_detalle='servicio',
                        id_servicio=servicio.id_servicio,
                        subtotal_detalle=servicio.precio_base,
                        descripcion=f"{servicio.nombre} - ${float(servicio.precio_base):.2f}"
                    )
                    
                    db.add(detalle)
                    detalles_nuevos.append(detalle)
                    detalles_creados += 1
                    
                    print(f"   ✅ Factura {factura.num_factura}: {servicio.nombre}")
            
            # 🔥 RECALCULAR TOTALES SI SE AGREGARON SERVICIOS
            if detalles_nuevos:
                # Obtener detalles existentes
                detalles_existentes = db.query(DetalleFactura).filter(
                    DetalleFactura.id_factura == factura.id_factura
                ).all()
                
                # Sumar existentes + nuevos
                nuevo_subtotal = sum(d.subtotal_detalle for d in detalles_existentes) + \
                                sum(d.subtotal_detalle for d in detalles_nuevos)
                
                subtotal_con_descuento = nuevo_subtotal - (factura.descuento or Decimal('0.00'))
                nuevo_impuesto = subtotal_con_descuento * porcentaje_iva
                nuevo_total = subtotal_con_descuento + nuevo_impuesto
                
                # Actualizar factura
                factura.subtotal = nuevo_subtotal
                factura.impuesto = nuevo_impuesto
                factura.total = nuevo_total
                
                facturas_afectadas += 1
        
        db.commit()
        
        print(f"\n{'='*60}")
        print(f"✅ RESUMEN:")
        print(f"   Facturas afectadas: {facturas_afectadas}")
        print(f"   Detalles creados: {detalles_creados}")
        print(f"{'='*60}\n")
        
        # Auditoría
        registrar_auditoria(
            db=db,
            accion="UPDATE",
            descripcion=f"Servicios masivos aplicados - Período: {data.periodo} - Facturas: {facturas_afectadas}",
            id_usuario=current_user.id_usuario_sistema
        )
        
        return {
            "success": True,
            "message": f"Servicios aplicados correctamente a {facturas_afectadas} facturas",
            "facturas_afectadas": facturas_afectadas,
            "detalles_creados": detalles_creados
        }
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"❌ Error aplicando servicios: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Error al aplicar servicios: {str(e)}"
        )


# ========================================
# ENDPOINT: APLICAR SERVICIOS A FACTURA ESPECÍFICA
# ========================================

@router.post("/{id_factura}/aplicar-servicios", response_model=dict)
def aplicar_servicios_a_factura_individual(
    id_factura: int,
    servicios: List[int] = Body(..., description="Lista de IDs de servicios"),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Aplica servicios adicionales a UNA factura específica
    Recalcula totales automáticamente
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "facturas", "actualizar")
    
    try:
        # Verificar factura
        factura = db.query(Factura).filter(
            Factura.id_factura == id_factura
        ).first()
        
        if not factura:
            raise HTTPException(
                status_code=404,
                detail="Factura no encontrada"
            )
        
        if factura.estado_factura not in ['pendiente', 'vencida']:
            raise HTTPException(
                status_code=400,
                detail=f"No se pueden agregar servicios a factura en estado '{factura.estado_factura}'"
            )
        
        # Agregar servicios
        cantidad = agregar_servicios_a_factura(db, id_factura, servicios)
        
        if cantidad == 0:
            return {
                "success": False,
                "message": "No se agregaron servicios (ya existen o no son válidos)",
                "servicios_agregados": 0
            }
        
        # RECALCULAR TOTALES DE LA FACTURA
        detalles = db.query(DetalleFactura).filter(
            DetalleFactura.id_factura == id_factura
        ).all()
        
        nuevo_subtotal = sum(d.subtotal_detalle for d in detalles)
        
        # Aplicar descuento si existe
        subtotal_con_descuento = nuevo_subtotal - (factura.descuento or Decimal('0.00'))
        
        # Calcular IVA
        iva_config = db.query(IVA).filter(
            IVA.activo == True,
            IVA.es_aplicable == True
        ).first()
        
        if iva_config:
            porcentaje_iva = Decimal(str(iva_config.porcentaje)) / Decimal('100')
            nuevo_impuesto = subtotal_con_descuento * porcentaje_iva
        else:
            nuevo_impuesto = Decimal('0.00')
        
        nuevo_total = subtotal_con_descuento + nuevo_impuesto
        
        # Actualizar factura
        factura.subtotal = nuevo_subtotal
        factura.impuesto = nuevo_impuesto
        factura.total = nuevo_total
        
        db.commit()
        db.refresh(factura)
        
        # Auditoría
        registrar_auditoria(
            db=db,
            accion="UPDATE",
            descripcion=f"Servicios agregados a factura {factura.num_factura} - Cantidad: {cantidad}",
            id_usuario=current_user.id_usuario_sistema
        )
        
        return {
            "success": True,
            "message": f"Se agregaron {cantidad} servicio(s) correctamente",
            "servicios_agregados": cantidad,
            "factura": {
                "id_factura": factura.id_factura,
                "num_factura": factura.num_factura,
                "subtotal": float(factura.subtotal),
                "impuesto": float(factura.impuesto),
                "total": float(factura.total)
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"❌ Error aplicando servicios: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error al aplicar servicios: {str(e)}"
        )