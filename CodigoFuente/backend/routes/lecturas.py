from fastapi import APIRouter, Depends, HTTPException, status, Query
from openpyxl import Workbook, load_workbook
from openpyxl.styles import PatternFill, Font, Alignment
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func
from typing import List, Optional
from datetime import date, datetime
import io
from fastapi.responses import StreamingResponse
from fastapi import UploadFile, File
from calendar import month_name
import locale

from openpyxl.styles import Protection  # Importar Protection para proteger/desproteger celdas
from models.lectura import Lectura
from models.meter import Medidor
from models.user import UsuarioSistema
from models.role import RolAccion
from models.affiliate import UsuarioAfiliado  # Importar modelo de UsuarioAfiliado
from schemas.lectura import (
    LecturaCreate,
    LecturaUpdate,
    LecturaResponse,
    LecturaStats,
    LecturaBulkCreate,
    LecturaBulkCreateRequest,
    LecturaBulkResponse,
    LecturaBulkResult,
    LecturaBulkError
)
from utils.notifications import registrar_notificacion
from utils.audit_logger import registrar_auditoria
from db.session import SessionLocal
from security.jwt import verify_token

from utils.facturacion import generar_factura_desde_lectura # para generar facturas automaticas 
router = APIRouter(prefix="/lecturas", tags=["lecturas"])


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

def require_any_permission(
    user: UsuarioSistema,
    db: Session,
    permissions: list[tuple[str, str | None]]
):
    """
    Permite acceso si el usuario tiene AL MENOS uno de los permisos indicados
    """
    for module, action in permissions:
        if check_permission(user, db, module, action):
            return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="No tienes permisos para acceder a este recurso"
    )


# ============================================================================
# HELPER: Convertir lectura a respuesta con información completa
# ============================================================================

def lectura_to_response(lectura: Lectura) -> dict:
    """Convierte una lectura con información del medidor y lector"""
    medidor = lectura.medidor
    lector = lectura.lector
    
    return {
        "id_lectura": lectura.id_lectura,
        "id_medidor": lectura.id_medidor,
        "lectura_actual": lectura.lectura_actual,
        "lectura_anterior": lectura.lectura_anterior,
        "consumo_m3": lectura.consumo_m3,
        "fecha_lectura": lectura.fecha_lectura.isoformat() if lectura.fecha_lectura else None,
        "id_lector": lectura.id_lector,
        "observacion": lectura.observacion,
        "activo": lectura.activo,
        "es_estimada": lectura.es_estimada,
        "medidor": {
            "id_medidor": medidor.id_medidor,
            "num_medidor": medidor.num_medidor
        } if medidor else None,
        "lector": {
            "id_usuario_sistema": lector.id_usuario_sistema,
            "nombres": lector.nombres,
            "apellidos": lector.apellidos
        } if lector else None
    }


from typing import Optional
from datetime import date

@router.get("/mis-lecturas", response_model=List[dict])
def listar_mis_lecturas(
    # Parámetros opcionales de filtrado
    fecha_desde: Optional[date] = Query(None, description="Filtrar lecturas desde esta fecha"),
    fecha_hasta: Optional[date] = Query(None, description="Filtrar lecturas hasta esta fecha"),
    tipo_lectura: Optional[str] = Query(None, description="Filtrar por tipo: 'reales' o 'estimadas'"),
    consumo_min: Optional[float] = Query(None, description="Consumo mínimo en m³"),
    consumo_max: Optional[float] = Query(None, description="Consumo máximo en m³"),
    id_medidor: Optional[int] = Query(None, description="Filtrar por medidor específico"),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Lista las lecturas de los medidores del usuario autenticado (afiliado)
    Con filtros opcionales para búsqueda avanzada
    """

    current_user = get_current_user(payload, db)

    # Obtener el afiliado asociado al usuario actual
    afiliado = db.query(UsuarioAfiliado).filter(
        UsuarioAfiliado.id_usuario_sistema == current_user.id_usuario_sistema
    ).first()

    if not afiliado:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se encontró información de afiliado para este usuario"
        )

    # Obtener medidores activos del afiliado
    medidores_query = db.query(Medidor.id_medidor).filter(
        Medidor.id_usuario_afi == afiliado.id_usuario_afi,
        Medidor.activo == True
    )

    # Filtrar por medidor específico si se proporciona
    if id_medidor:
        medidores_query = medidores_query.filter(Medidor.id_medidor == id_medidor)

    medidores_ids = [m[0] for m in medidores_query.all()]

    if not medidores_ids:
        return []

    # Construir query base de lecturas
    lecturas_query = db.query(Lectura).filter(
        Lectura.id_medidor.in_(medidores_ids),
        Lectura.activo == True
    )

    # Aplicar filtros opcionales
    if fecha_desde:
        lecturas_query = lecturas_query.filter(Lectura.fecha_lectura >= fecha_desde)
    
    if fecha_hasta:
        lecturas_query = lecturas_query.filter(Lectura.fecha_lectura <= fecha_hasta)
    
    if tipo_lectura:
        if tipo_lectura.lower() == 'reales':
            lecturas_query = lecturas_query.filter(Lectura.es_estimada == False)
        elif tipo_lectura.lower() == 'estimadas':
            lecturas_query = lecturas_query.filter(Lectura.es_estimada == True)
    
    if consumo_min is not None:
        lecturas_query = lecturas_query.filter(Lectura.consumo_m3 >= consumo_min)
    
    if consumo_max is not None:
        lecturas_query = lecturas_query.filter(Lectura.consumo_m3 <= consumo_max)

    # Ordenar por fecha descendente
    lecturas = lecturas_query.order_by(Lectura.fecha_lectura.desc()).all()

    # Formatear resultados
    resultado = []

    for lectura in lecturas:
        medidor = lectura.medidor
        afiliado_data = medidor.usuario_afiliado if medidor else None

        codigo_afiliado = afiliado_data.cod_usuario_afi if afiliado_data else None

        if afiliado_data and afiliado_data.usuario_sistema:
            usuario = afiliado_data.usuario_sistema
            nombre_afiliado = f"{usuario.nombres} {usuario.apellidos}"
        else:
            nombre_afiliado = "Sin afiliado"

        sector_nombre = (
            medidor.sector.nombre_sector
            if medidor and medidor.sector
            else "Sin sector"
        )

        lector = lectura.lector
        lector_info = {
            "id_usuario_sistema": lector.id_usuario_sistema if lector else None,
            "nombres": lector.nombres if lector else None,
            "apellidos": lector.apellidos if lector else None
        }

        resultado.append({
            "id_lectura": lectura.id_lectura,
            "id_medidor": lectura.id_medidor,
            "lectura_actual": lectura.lectura_actual,
            "lectura_anterior": lectura.lectura_anterior,
            "consumo_m3": lectura.consumo_m3,
            "fecha_lectura": lectura.fecha_lectura,
            "observacion": lectura.observacion,
            "activo": lectura.activo,
            "es_estimada": lectura.es_estimada,
            "medidor": {
                "id_medidor": medidor.id_medidor if medidor else None,
                "num_medidor": medidor.num_medidor if medidor else None,
                "codigo_afiliado": codigo_afiliado,
                "nombre_afiliado": nombre_afiliado,
                "sector": sector_nombre
            },
            "lector": lector_info
        })

    return resultado
 
@router.get("", response_model=List[dict])
def listar_lecturas(
    search: Optional[str] = Query(None),
    id_medidor: Optional[int] = Query(None),
    fecha_desde: Optional[date] = Query(None),
    fecha_hasta: Optional[date] = Query(None),
    activo: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Lista todas las lecturas con información completa del medidor,
    afiliado y sector.
    """
    current_user = get_current_user(payload, db)
    require_any_permission(
        current_user,
        db,
        [
            ("lecturas", "lectura"),
            ("lecturas", "crud"),
            ("historialconsumo", "crud"),  # ← tu permiso 103
        ]
    )

    query = db.query(Lectura)

    # ============ FILTROS ============
    if search:
        query = query.filter(
            (Lectura.observacion.ilike(f"%{search}%")) |
            (Lectura.id_medidor == int(search) if search.isdigit() else False)
        )

    if id_medidor:
        query = query.filter(Lectura.id_medidor == id_medidor)

    if fecha_desde:
        query = query.filter(Lectura.fecha_lectura >= fecha_desde)

    if fecha_hasta:
        query = query.filter(Lectura.fecha_lectura <= fecha_hasta)

    if activo is not None:
        query = query.filter(Lectura.activo == activo)

    query = query.order_by(Lectura.fecha_lectura.desc())
    lecturas = query.offset(skip).limit(limit).all()

    resultado = []

    for lectura in lecturas:
        medidor = lectura.medidor

        # =========================
        # 🔵 INFORMACIÓN DEL AFILIADO
        # =========================
        afiliado = medidor.usuario_afiliado if medidor else None
        
        codigo_afiliado = afiliado.cod_usuario_afi if afiliado else None
        
        # Nombre afiliado
        if afiliado and afiliado.usuario_sistema:
            usuario_sistema = afiliado.usuario_sistema
            nombre_afiliado = f"{usuario_sistema.nombres} {usuario_sistema.apellidos}"
        else:
            nombre_afiliado = "Sin afiliado"

        # Sector
        sector_nombre = medidor.sector.nombre_sector if medidor and medidor.sector else "Sin sector"

        # =========================
        # 🟢 INFORMACIÓN DEL LECTOR
        # =========================
        lector = lectura.lector
        lector_info = {
            "id_usuario_sistema": lector.id_usuario_sistema if lector else None,
            "nombres": lector.nombres if lector else None,
            "apellidos": lector.apellidos if lector else None
        }

        # =========================
        # 🟣 ARMAR RESPUESTA FINAL
        # =========================
        resultado.append({
            "id_lectura": lectura.id_lectura,
            "id_medidor": lectura.id_medidor,
            "lectura_actual": lectura.lectura_actual,
            "lectura_anterior": lectura.lectura_anterior,
            "consumo_m3": lectura.consumo_m3,
            "fecha_lectura": lectura.fecha_lectura,
            "observacion": lectura.observacion,
            "activo": lectura.activo,
            "es_estimada": lectura.es_estimada,

            # 🔵 datos del medidor
            "medidor": {
                "id_medidor": medidor.id_medidor if medidor else None,
                "num_medidor": medidor.num_medidor if medidor else None,
                "codigo_afiliado": codigo_afiliado,
                "nombre_afiliado": nombre_afiliado,
                "sector": sector_nombre
            },

            # 🟢 datos del lector
            "lector": lector_info
        })

    return resultado


@router.get("/stats/count", response_model=LecturaStats)
def obtener_estadisticas_lecturas(
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Obtiene estadísticas de lecturas
    Requiere permiso: lecturas.lectura o lecturas.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "lecturas", "lectura")
    
    total = db.query(Lectura).count()
    activos = db.query(Lectura).filter(Lectura.activo == True).count()
    inactivos = db.query(Lectura).filter(Lectura.activo == False).count()
    
    # Consumo total
    consumo_total = db.query(db.func.sum(Lectura.consumo_m3)).scalar() or 0
    
    return {
        "total": total,
        "activos": activos,
        "inactivos": inactivos,
        "consumo_total": consumo_total
    }


@router.get("/{id_lectura}", response_model=dict)
def obtener_lectura(
    id_lectura: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Obtiene una lectura específica por ID
    Requiere permiso: lecturas.lectura o lecturas.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "lecturas", "lectura")
    
    
    lectura = db.query(Lectura).filter(Lectura.id_lectura == id_lectura).first()
    
    if not lectura:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lectura no encontrada"
        )
    
    return lectura_to_response(lectura)


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
def crear_lectura(
    lectura_data: LecturaCreate,
    generar_factura: bool = Query(True, description="Generar factura automáticamente"),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Crea una nueva lectura
    Opcionalmente genera la factura automáticamente
    Requiere permiso: lecturas.crear o lecturas.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "lecturas", "crear")
    
    # Verificar que el medidor existe
    medidor = db.query(Medidor).filter(
        Medidor.id_medidor == lectura_data.id_medidor
    ).first()
    
    if not medidor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Medidor no encontrado"
        )
    
    # Validación: evitar doble lectura en el mismo mes
    lectura_mes_existente = db.query(Lectura).filter(
        Lectura.id_medidor == lectura_data.id_medidor,
        func.extract('month', Lectura.fecha_lectura) == lectura_data.fecha_lectura.month,
        func.extract('year', Lectura.fecha_lectura) == lectura_data.fecha_lectura.year,
        Lectura.activo == True
    ).first()

    if lectura_mes_existente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Ya existe una lectura registrada para este medidor "
                f"en {lectura_data.fecha_lectura.month}/{lectura_data.fecha_lectura.year}."
            )
        )
    
    # Obtener información del afiliado
    afiliado = medidor.usuario_afiliado if medidor else None
    usuario_afiliado = afiliado.usuario_sistema if afiliado else None
    
    if usuario_afiliado:
        nombre_afiliado = f"{usuario_afiliado.nombres} {usuario_afiliado.apellidos}"
        id_usuario_afiliado = usuario_afiliado.id_usuario_sistema
    else:
        nombre_afiliado = "Usuario desconocido"
        id_usuario_afiliado = None
    
    # Crear nueva lectura
    nueva_lectura = Lectura(
        id_medidor=lectura_data.id_medidor,
        lectura_actual=lectura_data.lectura_actual,
        lectura_anterior=lectura_data.lectura_anterior,
        consumo_m3=lectura_data.consumo_m3,
        fecha_lectura=lectura_data.fecha_lectura,
        id_lector=current_user.id_usuario_sistema,
        observacion=lectura_data.observacion,
        activo=lectura_data.activo
    )
    
    try:
        db.add(nueva_lectura)
        db.flush()  # Obtener ID sin commit

        # 🆕 Guardar ID antes de cualquier error
        lectura_id = nueva_lectura.id_lectura

        # ============================================
        # 🆕 GENERAR FACTURA AUTOMÁTICAMENTE
        # ============================================
   
        factura_generada = None
        mensaje_factura = ""
        
        if generar_factura:
            exito, mensaje, factura_generada = generar_factura_desde_lectura(
                db=db,
                lectura=nueva_lectura,
                aplicar_servicios=True,
                aplicar_multas=True
            )
            
            if exito:
                mensaje_factura = f"✅ {mensaje}"
            else:
                mensaje_factura = f"⚠️ Lectura creada pero: {mensaje}"
        
        # Commit final
        db.commit()
        db.refresh(nueva_lectura)
        
        # Auditoría
        registrar_auditoria(
            db=db,
            accion="CREATE",
            descripcion=f"Lectura creada para medidor {medidor.num_medidor} (Consumo: {nueva_lectura.consumo_m3}m³) - {mensaje_factura}",
            id_usuario=current_user.id_usuario_sistema
        )
        
        # Notificación para el lector
        registrar_notificacion(
            db=db,
            id_usuario=current_user.id_usuario_sistema,
            titulo="Lectura creada",
            mensaje=f"Lectura del medidor {medidor.num_medidor} registrada. Consumo: {nueva_lectura.consumo_m3}m³. {mensaje_factura}",
            tipo="exito"
        )
        
        # Notificación para el afiliado
        if id_usuario_afiliado:
            mensaje_afiliado = f"Se registró una lectura de {nueva_lectura.consumo_m3}m³ para tu medidor N° {medidor.num_medidor}."
            
            if factura_generada:
                mensaje_afiliado += f" Factura {factura_generada.num_factura} generada por ${factura_generada.total}"
            
            registrar_notificacion(
                db=db,
                id_usuario=id_usuario_afiliado,
                titulo="Nueva lectura y factura",
                mensaje=mensaje_afiliado,
                tipo="info"
            )
        
        # Preparar respuesta
        response_data = lectura_to_response(nueva_lectura)
        
        if factura_generada:
            response_data['factura_generada'] = {
                'id_factura': factura_generada.id_factura,
                'num_factura': factura_generada.num_factura,
                'total': float(factura_generada.total),
                'periodo': factura_generada.periodo,
                'mensaje': mensaje_factura
            }
        else:
            response_data['factura_generada'] = None
            response_data['mensaje_factura'] = mensaje_factura
        
        return response_data
    
    except Exception as e:
        db.rollback()
        print(f"❌ Error al crear lectura: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear la lectura: {str(e)}"
        )


@router.put("/{id_lectura}", response_model=dict)
def actualizar_lectura(
    id_lectura: int,
    lectura_data: LecturaUpdate,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Actualiza una lectura existente
    Requiere permiso: lecturas.actualizar o lecturas.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "lecturas", "actualizar")
    
    # Buscar la lectura
    lectura = db.query(Lectura).filter(Lectura.id_lectura == id_lectura).first()
    
    if not lectura:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lectura no encontrada"
        )
    
    

    # Actualizar campos
    update_data = lectura_data.model_dump(exclude_unset=True)
    
    # Validar que no genere duplicado en el mes/año al actualizar
    if "fecha_lectura" in update_data or "id_medidor" in update_data:
        nueva_fecha = update_data.get("fecha_lectura", lectura.fecha_lectura)
        nuevo_medidor = update_data.get("id_medidor", lectura.id_medidor)

        duplicado = db.query(Lectura).filter(
            Lectura.id_medidor == nuevo_medidor,
            func.extract('month', Lectura.fecha_lectura) == nueva_fecha.month,
            func.extract('year', Lectura.fecha_lectura) == nueva_fecha.year,
            Lectura.id_lectura != id_lectura,   # excluirse a sí mismo
            Lectura.activo == True
        ).first()

        if duplicado:
            raise HTTPException(
                status_code=400,
                detail="Ya existe otra lectura para ese medidor en ese mes."
            )
        
    for key, value in update_data.items():
        setattr(lectura, key, value)
    
    try:
        db.commit()
        db.refresh(lectura)
        
        # Auditoría
        registrar_auditoria(
            db=db,
            accion="UPDATE",
            descripcion=f"Lectura {id_lectura} actualizada por '{payload['sub']}'",
            id_usuario=current_user.id_usuario_sistema
        )
        
        # Notificación
        registrar_notificacion(
            db=db,
            id_usuario=current_user.id_usuario_sistema,
            titulo="Lectura modificada",
            mensaje=f"La lectura fue modificada correctamente.",
            tipo="info"
        )
        
        return lectura_to_response(lectura)
    
    except Exception as e:
        db.rollback()
        print(f"❌ Error al actualizar lectura: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al actualizar la lectura"
        )


@router.delete("/{id_lectura}", status_code=status.HTTP_200_OK)
def eliminar_lectura(
    id_lectura: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Elimina la lectura si no tiene relaciones
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "lecturas", "eliminar")
    
    lectura = db.query(Lectura).filter(Lectura.id_lectura == id_lectura).first()
    
    if not lectura:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lectura no encontrada"
        )
    
    try:
        db.delete(lectura)
        db.commit()
        
        registrar_auditoria(
            db=db,
            accion="DELETE",
            descripcion=f"Lectura {id_lectura} eliminada por '{payload['sub']}'",
            id_usuario=current_user.id_usuario_sistema
        )
        
        registrar_notificacion(
            db=db,
            id_usuario=current_user.id_usuario_sistema,
            titulo="Lectura eliminada",
            mensaje=f"La lectura fue eliminada correctamente.",
            tipo="info"
        )
        
        return {
            "success": True,
            "accion": "eliminado",
            "message": "Lectura eliminada correctamente."
        }
    
    except IntegrityError:
        db.rollback()
        return {
            "success": False,
            "accion": "no_eliminado",
            "message": "⚠️ NO se puede eliminar la lectura porque está relacionada con otros módulos."
        }
    
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error inesperado al intentar eliminar la lectura."
        )


@router.patch("/{id_lectura}/toggle-status", response_model=dict)
def toggle_lectura_status(
    id_lectura: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Activa/Desactiva una lectura
    Requiere permiso: lecturas.actualizar o lecturas.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "lecturas", "actualizar")
    
    lectura = db.query(Lectura).filter(Lectura.id_lectura == id_lectura).first()
    
    if not lectura:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lectura no encontrada"
        )
    
    # Cambiar estado
    lectura.activo = not lectura.activo
    estado_texto = "activada" if lectura.activo else "desactivada"
    
    try:
        db.commit()
        db.refresh(lectura)
        
        # Auditoría
        registrar_auditoria(
            db=db,
            accion="UPDATE",
            descripcion=f"Lectura {id_lectura} fue {estado_texto} por '{payload['sub']}'",
            id_usuario=current_user.id_usuario_sistema
        )
        
        return lectura_to_response(lectura)
    
    except Exception as e:
        db.rollback()
        print(f"❌ Error al cambiar estado: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al cambiar el estado de la lectura"
        )


# ========================================
# ENDPOINT PARA OBTENER MEDIDORES CON INFORMACIÓN
# ========================================

@router.get("/medidores/lista/completa", response_model=List[dict])
def listar_medidores_con_info(
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Lista todos los medidores activos y con afiliados, con información del UsuarioAfiliado 
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "lecturas", "lectura")
    
    try:
        # ✅ Obtener solo medidores activos Y que tengan afiliado asignado
        medidores = db.query(Medidor).filter(
            Medidor.activo == True,
            Medidor.id_usuario_afi.isnot(None)  # Solo medidores con afiliado
        ).all()
        
        resultado = []
        
        for medidor in medidores:
            afiliado = medidor.usuario_afiliado
            codigo_afiliado = None
            nombre_afiliado = "Sin Afiliado"
            
            if afiliado:
                # Obtener código del afiliado
                codigo_afiliado = afiliado.cod_usuario_afi
                
                # Obtener información del usuario sistema
                if afiliado.usuario_sistema:
                    us = afiliado.usuario_sistema
                    nombre_afiliado = f"{us.nombres} {us.apellidos}"
            
            # Obtener información del sector
            sector_nombre = medidor.sector.nombre_sector if medidor.sector else "Sin sector"
            
            # Obtener última lectura para prellenar
            ultima_lectura = db.query(Lectura).filter(
                Lectura.id_medidor == medidor.id_medidor
            ).order_by(Lectura.fecha_lectura.desc()).first()
            
            lectura_anterior = ultima_lectura.lectura_actual if ultima_lectura else 0
            
            resultado.append({
                "id_medidor": medidor.id_medidor,
                "num_medidor": medidor.num_medidor,
                "codigo_afiliado": codigo_afiliado or "N/A",
                "nombre_afiliado": nombre_afiliado,
                "sector": sector_nombre,
                "lectura_anterior": lectura_anterior,
                "activo": medidor.activo
            })
        
        return resultado
    
    except Exception as e:
        print(f"❌ Error al obtener medidores: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener medidores: {str(e)}"
        )



# ========================================
# EXPORTAR PLANTILLA EXCEL
# ========================================


@router.get("/export/template")
def exportar_plantilla(
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Descarga una plantilla de Excel con:
    - Medidores activos con información del UsuarioAfiliado y sector
    - Última lectura registrada
    - Formato correcto para carga masiva
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "lecturas", "lectura")
    
    try:
        # ✅ FILTRAR: Solo medidores activos CON usuario afiliado
        # ✅ CORRECCIÓN: Usar .has() para filtrar por existencia de relación
        medidores = db.query(Medidor).filter(
            Medidor.activo == True,
            Medidor.usuario_afiliado.has()  # ✅ Filtra solo medidores CON usuario afiliado
        ).order_by(Medidor.num_medidor).all()

        
        print(f"📊 Generando plantilla con {len(medidores)} medidores con usuarios afiliados")
        
        # Crear libro de Excel
        wb = Workbook()
        
        # ===============================
        # HOJA 1: PLANTILLA PARA LLENAR
        # ===============================
        ws_plantilla = wb.active
        ws_plantilla.title = "Plantilla Lecturas"
        
        # Encabezados actualizados
        headers = [
            "num_medidor",
            "sector",
            "codigo_UsuarioAfiliado",
            "nombre_UsuarioAfiliado",
            "lectura_anterior",
            "lectura_actual",
            "observacion"
        ]
        
        # Estilo encabezado
        header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
        header_font = Font(color="FFFFFF", bold=True)
        
        for col_num, header in enumerate(headers, 1):
            cell = ws_plantilla.cell(row=1, column=col_num)
            cell.value = header
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center", vertical="center")
            # ✅ BLOQUEAR encabezados
            cell.protection = Protection(locked=True)
        
        # Anchos de columna
        column_widths = [20, 25, 18, 35, 18, 18, 40]
        for col, width in zip("ABCDEFG", column_widths):
            ws_plantilla.column_dimensions[col].width = width
        
        # Agregar medidores con información completa
        for row_num, medidor in enumerate(medidores, 2):
            # Obtener UsuarioAfiliado del medidor
            UsuarioAfiliado = medidor.usuario_afiliado
            usuario_sistema = None
            codigo_UsuarioAfiliado = "N/A"
            nombre_UsuarioAfiliado = "Sin UsuarioAfiliado"
            
            if UsuarioAfiliado:
                usuario_sistema = UsuarioAfiliado.usuario_sistema
                codigo_UsuarioAfiliado = UsuarioAfiliado.cod_usuario_afi if UsuarioAfiliado.cod_usuario_afi else "N/A"
                
                if usuario_sistema:
                    nombre_UsuarioAfiliado = f"{usuario_sistema.nombres} {usuario_sistema.apellidos}"
            
            # Obtener sector
            sector_nombre = medidor.sector.nombre_sector if medidor.sector else "Sin sector"
            
            # Buscar última lectura del medidor
            ultima_lectura = db.query(Lectura).filter(
                Lectura.id_medidor == medidor.id_medidor
            ).order_by(Lectura.fecha_lectura.desc()).first()
            
            lectura_anterior = ultima_lectura.lectura_actual if ultima_lectura else 0
            
            # ✅ COLUMNAS BLOQUEADAS (1-5): num_medidor, sector, codigo, nombre, lectura_anterior
            cell = ws_plantilla.cell(row=row_num, column=1, value=medidor.num_medidor)
            cell.protection = Protection(locked=True)
            
            cell = ws_plantilla.cell(row=row_num, column=2, value=sector_nombre)
            cell.protection = Protection(locked=True)
            
            cell = ws_plantilla.cell(row=row_num, column=3, value=codigo_UsuarioAfiliado)
            cell.protection = Protection(locked=True)
            
            cell = ws_plantilla.cell(row=row_num, column=4, value=nombre_UsuarioAfiliado)
            cell.protection = Protection(locked=True)
            
            cell = ws_plantilla.cell(row=row_num, column=5, value=lectura_anterior)
            cell.protection = Protection(locked=True)
            
            # ✅ COLUMNAS DESBLOQUEADAS (6-7): lectura_actual y observacion
            cell = ws_plantilla.cell(row=row_num, column=6, value="")
            cell.protection = Protection(locked=False)  # ✅ Desbloquear
            
            cell = ws_plantilla.cell(row=row_num, column=7, value="")
            cell.protection = Protection(locked=False)  # ✅ Desbloquear
        
        # ✅ ACTIVAR PROTECCIÓN DE LA HOJA
        ws_plantilla.protection.sheet = True
        #ws_plantilla.protection.password = None  # Sin contraseña para facilitar uso
        ws_plantilla.protection.enable()
        
        # ===============================
        # HOJA 2: INSTRUCCIONES
        # ===============================
        ws_instrucciones = wb.create_sheet("Instrucciones")
        
        instrucciones = [
            ["📋 INSTRUCCIONES PARA CARGA MASIVA DE LECTURAS"],
            [""],
            ["1️⃣ USO DE LA PLANTILLA:"],
            [" • Complete SOLO las columnas 'lectura_actual' y 'observacion' (las demás están bloqueadas)"],
            [" • La columna 'lectura_anterior' ya está prellenada con la última lectura"],
            [" • Solo se incluyen medidores CON usuario afiliado"],
            [" • NO modifique las columnas bloqueadas: num_medidor, sector, codigo, nombre, lectura_anterior"],
            [""],
            ["2️⃣ COLUMNAS:"],
            [" • num_medidor: Número del medidor (🔒 BLOQUEADA)"],
            [" • sector: Sector del medidor (🔒 BLOQUEADA)"],
            [" • codigo_UsuarioAfiliado: Código del UsuarioAfiliado (🔒 BLOQUEADA)"],
            [" • nombre_UsuarioAfiliado: Nombre completo del UsuarioAfiliado (🔒 BLOQUEADA)"],
            [" • lectura_anterior: Última lectura registrada (🔒 BLOQUEADA)"],
            [" • lectura_actual: ✏️ RELLENAR con el nuevo valor (EDITABLE)"],
            [" • observacion: ✏️ Comentarios opcionales (EDITABLE)"],
            [""],
            ["3️⃣ VALIDACIONES:"],
            [" • La lectura actual debe ser mayor o igual a la anterior"],
            [" • El sistema calculará automáticamente el consumo"],
            [" • Los medidores deben existir en el sistema"],
            [""],
            ["4️⃣ PROCESO AUTOMÁTICO:"],
            [" • Se registrará el usuario actual como lector"],
            [" • Se usará la fecha de importación para todas las lecturas"],
            [" • Consumo = lectura_actual - lectura_anterior"],
            [""],
            ["5️⃣ DESPUÉS DE COMPLETAR:"],
            [" • Guarde el archivo Excel"],
            [" • Súbalo en el sistema usando el botón 'Crear desde Excel'"],
            [" • El sistema validará y creará los registros"],
            [" • Recibirá un reporte de exitosos y fallidos"],
            [""],
            [f"📅 Plantilla generada: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"],
            [f"👤 Usuario: {current_user.nombres} {current_user.apellidos}"],
            [f"📊 Total medidores con usuarios afiliados: {len(medidores)}"],
        ]
        
        for row_num, fila in enumerate(instrucciones, 1):
            cell = ws_instrucciones.cell(row=row_num, column=1, value=fila[0])
            if row_num == 1:
                cell.font = Font(size=14, bold=True, color="4472C4")
            elif any(emoji in str(fila[0]) for emoji in ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"]):
                cell.font = Font(size=12, bold=True)
        
        ws_instrucciones.column_dimensions['A'].width = 80
        
        # Guardar y retornar
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        excel_data = output.getvalue()
        output.close()
        
        print(f"✅ Excel generado correctamente: {len(excel_data)} bytes")
        
        # Registrar auditoría
        registrar_auditoria(
            db=db,
            accion="DOWNLOAD_TEMPLATE",
            descripcion=f"Plantilla de lecturas descargada por '{current_user.usuario}' - {len(medidores)} medidores con usuarios afiliados",
            id_usuario=current_user.id_usuario_sistema
        )
        
        filename = f"plantilla_lecturas_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        final_output = io.BytesIO(excel_data)
        
        return StreamingResponse(
            final_output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Content-Length": str(len(excel_data))
            }
        )
    
    except Exception as e:
        print(f"❌ Error generando plantilla: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al generar la plantilla: {str(e)}"
        )


# =================================================
# IMPORTAR LECTURAS DESDE EXCEL - CREAR DESDE EXCEL 
# =================================================

@router.post("/import/excel", response_model=LecturaBulkResponse, status_code=status.HTTP_201_CREATED)
async def importar_lecturas_excel(
    file: UploadFile = File(...),
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Importa lecturas desde un archivo Excel
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "lecturas", "crear")
    
    exitosos = []
    fallidos = []
    
    try:
        # Leer el archivo Excel
        contents = await file.read()
        wb = load_workbook(io.BytesIO(contents))
        ws = wb.active
        
        print(f"\n{'='*60}")
        print(f"🚀 INICIANDO IMPORTACIÓN DE LECTURAS DESDE EXCEL")
        print(f"{'='*60}\n")
        
        fecha_lectura = date.today()
        
        # Procesar cada fila (empezar desde la 2 para saltar encabezados)
        for row_num, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
            try:
                # Extraer valores (nuevas columnas)
                num_medidor = row[0]
                sector = row[1]
                codigo_UsuarioAfiliado = row[2]
                nombre_UsuarioAfiliado = row[3]
                lectura_anterior = row[4]
                lectura_actual = row[5]
                observacion = row[6] if len(row) > 6 else None
                
                # Validar datos
                if not num_medidor or not lectura_actual:
                    continue  # Saltar filas vacías
                
                lectura_actual = int(lectura_actual)
                lectura_anterior = int(lectura_anterior) if lectura_anterior else 0
                
                # Validar que la lectura actual sea mayor o igual a la anterior
                if lectura_actual < lectura_anterior:
                    raise ValueError(f"La lectura actual ({lectura_actual}) es menor que la anterior ({lectura_anterior})")
                
                # Calcular consumo
                consumo_m3 = lectura_actual - lectura_anterior
                
                # Buscar el medidor por número
                medidor = db.query(Medidor).filter(
                    Medidor.num_medidor == str(num_medidor).strip()
                ).first()
                
                if not medidor:
                    raise ValueError(f"Medidor '{num_medidor}' no encontrado en el sistema")
                
                # Crear lectura
                nueva_lectura = Lectura(
                    id_medidor=medidor.id_medidor,
                    lectura_actual=lectura_actual,
                    lectura_anterior=lectura_anterior,
                    consumo_m3=consumo_m3,
                    fecha_lectura=fecha_lectura,
                    id_lector=current_user.id_usuario_sistema,
                    observacion=observacion.strip() if observacion else None,
                    activo=True
                )
                
                db.add(nueva_lectura)
                db.flush()
                
                exitosos.append(LecturaBulkResult(
                    fila=row_num,
                    id_medidor=medidor.id_medidor,
                    num_medidor=medidor.num_medidor,
                    lectura_anterior=lectura_anterior,
                    lectura_actual=lectura_actual,
                    consumo_m3=consumo_m3,
                    id_lectura=nueva_lectura.id_lectura
                ))
                
                print(f"✅ Fila {row_num}: Lectura creada para medidor {medidor.num_medidor} - Consumo: {consumo_m3}m³")
                
            except Exception as e:
                fallidos.append(LecturaBulkError(
                    fila=row_num,
                    id_medidor=None,
                    num_medidor=num_medidor if 'num_medidor' in locals() else None,
                    error=str(e)
                ))
                print(f"❌ Fila {row_num}: Error - {str(e)}")
        
        # Commit si hubo éxitos
        if exitosos:
            db.commit()
            
            # Auditoría
            registrar_auditoria(
                db=db,
                accion="IMPORT_EXCEL",
                descripcion=f"Importación masiva de lecturas: {len(exitosos)} exitosos, {len(fallidos)} fallidos por '{current_user.usuario}'",
                id_usuario=current_user.id_usuario_sistema
            )
            
            # Notificación
            registrar_notificacion(
                db=db,
                id_usuario=current_user.id_usuario_sistema,
                titulo="Importación de lecturas completada",
                mensaje=f"Se importaron {len(exitosos)} lecturas correctamente. Errores: {len(fallidos)}",
                tipo="exito"
            )
        
        print(f"\n{'='*60}")
        print(f"✅ IMPORTACIÓN COMPLETADA")
        print(f"Total procesados: {len(exitosos) + len(fallidos)}")
        print(f"Exitosos: {len(exitosos)}")
        print(f"Fallidos: {len(fallidos)}")
        print(f"{'='*60}\n")
        
        return LecturaBulkResponse(
            exitosos=exitosos,
            fallidos=fallidos,
            total_procesados=len(exitosos) + len(fallidos),
            total_exitosos=len(exitosos),
            total_fallidos=len(fallidos)
        )
    
    except Exception as e:
        db.rollback()
        print(f"❌ Error en importación: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al importar lecturas: {str(e)}"
        )


# ========================================
# EXPORTAR LECTURAS A EXCEL
# ========================================

@router.get("/export/excel")
def exportar_lecturas_excel(
    fecha_desde: Optional[date] = Query(None),
    fecha_hasta: Optional[date] = Query(None),
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Exporta lecturas a Excel con filtros opcionales
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "lecturas", "lectura")
    
    try:
        # Consultar lecturas
        query = db.query(Lectura).filter(Lectura.activo == True)
        
        if fecha_desde:
            query = query.filter(Lectura.fecha_lectura >= fecha_desde)
        if fecha_hasta:
            query = query.filter(Lectura.fecha_lectura <= fecha_hasta)
        
        lecturas = query.order_by(Lectura.fecha_lectura.desc()).all()
        
        # Crear Excel
        wb = Workbook()
        ws = wb.active
        ws.title = "Lecturas"
        
        # Encabezados
        headers = [
            "ID Lectura",
            "Medidor",
            "Lectura Anterior",
            "Lectura Actual",
            "Consumo (m³)",
            "Fecha",
            "Lector",
            "Observación"
        ]
        
        header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
        header_font = Font(color="FFFFFF", bold=True)
        
        for col_num, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col_num)
            cell.value = header
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center")
        
        # Datos
        for row_num, lectura in enumerate(lecturas, 2):
            # Obtener información del medidor
            medidor = lectura.medidor
            num_medidor = medidor.num_medidor if medidor else "N/A"
            
            # Obtener información del lector
            lector = lectura.lector
            nombre_lector = f"{lector.nombres} {lector.apellidos}" if lector else "N/A"
            
            ws.cell(row=row_num, column=1, value=lectura.id_lectura)
            ws.cell(row=row_num, column=2, value=num_medidor)
            ws.cell(row=row_num, column=3, value=lectura.lectura_anterior)
            ws.cell(row=row_num, column=4, value=lectura.lectura_actual)
            ws.cell(row=row_num, column=5, value=lectura.consumo_m3)
            ws.cell(row=row_num, column=6, value=lectura.fecha_lectura.strftime('%Y-%m-%d'))
            ws.cell(row=row_num, column=7, value=nombre_lector)
            ws.cell(row=row_num, column=8, value=lectura.observacion or "")
        
        # Ajustar anchos
        for col in ["A", "B", "C", "D", "E", "F", "G", "H"]:
            ws.column_dimensions[col].width = 20
        
        # Guardar
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        excel_data = output.getvalue()
        output.close()
        
        # Registrar auditoría
        registrar_auditoria(
            db=db,
            accion="EXPORT_EXCEL",
            descripcion=f"Lecturas exportadas a Excel por '{current_user.usuario}' ({len(lecturas)} registros)",
            id_usuario=current_user.id_usuario_sistema
        )
        
        filename = f"lecturas_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        final_output = io.BytesIO(excel_data)
        
        return StreamingResponse(
            final_output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Content-Length": str(len(excel_data))
            }
        )
    
    except Exception as e:
        print(f"❌ Error exportando lecturas: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al exportar lecturas: {str(e)}"
        )
    
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
# 🆕 ENDPOINT: OBTENER PERIODOS DISPONIBLES
# ========================================
@router.get("/periodos/disponibles", response_model=dict)
def obtener_periodos_disponibles(
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Obtiene los periodos (mes/año) disponibles para cargar lecturas.
    Muestra:
    - Periodo actual sugerido
    - Últimos 6 meses con estadísticas
    - Próximos 2 meses
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "lecturas", "lectura")
    
    try:
        # Fecha actual
        hoy = date.today()
        mes_actual = hoy.month
        anio_actual = hoy.year
        
        # ✅ Total de medidores activos CON AFILIADOS
        total_medidores = db.query(func.count(Medidor.id_medidor)).filter(
            Medidor.activo == True,
            Medidor.id_usuario_afi.isnot(None)  # Solo medidores con afiliado
        ).scalar() or 0
        
        periodos = []
        
        # Generar últimos 6 meses + mes actual + próximos 2 meses
        for offset in range(-6, 3):
            # Calcular mes y año
            fecha_temp = date(anio_actual, mes_actual, 1)
            
            # Sumar/restar meses
            mes_temp = mes_actual + offset
            anio_temp = anio_actual
            
            while mes_temp > 12:
                mes_temp -= 12
                anio_temp += 1
            while mes_temp < 1:
                mes_temp += 12
                anio_temp -= 1
            
            # Contar lecturas del periodo
            total_lecturas_periodo = db.query(func.count(Lectura.id_lectura)).filter(
                func.extract('month', Lectura.fecha_lectura) == mes_temp,
                func.extract('year', Lectura.fecha_lectura) == anio_temp,
                Lectura.activo == True
            ).scalar() or 0
            
            # Determinar si es sugerido (mes actual o siguiente si ya tiene muchas lecturas)
            porcentaje = (total_lecturas_periodo / total_medidores * 100) if total_medidores > 0 else 0
            sugerido = False
            
            if mes_temp == mes_actual and anio_temp == anio_actual:
                sugerido = True  # Mes actual siempre sugerido
            elif offset == 1 and porcentaje < 80:  # Mes siguiente si el actual está completo
                sugerido = True
            
            periodos.append({
                "mes": mes_temp,
                "anio": anio_temp,
                "nombre_mes": MESES_ES.get(mes_temp, f"Mes {mes_temp}"),
                "tiene_lecturas": total_lecturas_periodo > 0,
                "total_lecturas": total_lecturas_periodo,
                "total_medidores": total_medidores,
                "porcentaje_completado": round(porcentaje, 1),
                "sugerido": sugerido
            })
        
        # Ordenar por año y mes descendente (más reciente primero)
        periodos.sort(key=lambda x: (x["anio"], x["mes"]), reverse=True)
        
        # Identificar periodo actual
        periodo_actual = next((p for p in periodos if p["sugerido"]), periodos[0])
        
        return {
            "periodo_actual": periodo_actual,
            "periodos_disponibles": periodos,
            "total_medidores_activos": total_medidores
        }
    
    except Exception as e:
        print(f"❌ Error obteniendo periodos: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener periodos disponibles: {str(e)}"
        )



# ========================================
# 🆕 ACTUALIZAR: IMPORTAR CON PERIODO
# ========================================

@router.post("/import/excel/periodo", response_model=LecturaBulkResponse, status_code=status.HTTP_201_CREATED)
async def importar_lecturas_excel_con_periodo(
    mes: int = Query(..., ge=1, le=12, description="Mes de las lecturas"),
    anio: int = Query(..., ge=2020, description="Año de las lecturas"),
    file: UploadFile = File(...),
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Importa lecturas desde Excel con periodo específico (mes/año).
    Valida que no existan lecturas duplicadas para ese periodo.
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "lecturas", "crear")
    
    exitosos = []
    fallidos = []
    
    try:
        # Crear fecha del periodo (primer día del mes)
        fecha_lectura = date(anio, mes, 1)
        
        print(f"\n{'='*60}")
        print(f"🚀 IMPORTACIÓN PARA PERIODO: {MESES_ES.get(mes, mes)}/{anio}")
        print(f"{'='*60}\n")
        
        # Leer Excel
        contents = await file.read()
        wb = load_workbook(io.BytesIO(contents))
        ws = wb.active
        
        # Procesar filas
        for row_num, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
            try:
                num_medidor = row[0]
                lectura_anterior = row[4]
                lectura_actual = row[5]
                observacion = row[6] if len(row) > 6 else None
                
                if not num_medidor or not lectura_actual:
                    continue
                
                lectura_actual = int(lectura_actual)
                lectura_anterior = int(lectura_anterior) if lectura_anterior else 0
                
                if lectura_actual < lectura_anterior:
                    raise ValueError(f"Lectura actual ({lectura_actual}) menor que anterior ({lectura_anterior})")
                
                consumo_m3 = lectura_actual - lectura_anterior
                
                # Buscar medidor
                medidor = db.query(Medidor).filter(
                    Medidor.num_medidor == str(num_medidor).strip()
                ).first()
                
                if not medidor:
                    raise ValueError(f"Medidor '{num_medidor}' no encontrado")
                
                # 🔍 VALIDAR: No permitir duplicado en el mismo mes/año
                lectura_existente = db.query(Lectura).filter(
                    Lectura.id_medidor == medidor.id_medidor,
                    func.extract('month', Lectura.fecha_lectura) == mes,
                    func.extract('year', Lectura.fecha_lectura) == anio,
                    Lectura.activo == True
                ).first()
                
                if lectura_existente:
                    raise ValueError(f"Ya existe lectura para {MESES_ES.get(mes, mes)}/{anio}")
                
                # Crear lectura
                nueva_lectura = Lectura(
                    id_medidor=medidor.id_medidor,
                    lectura_actual=lectura_actual,
                    lectura_anterior=lectura_anterior,
                    consumo_m3=consumo_m3,
                    fecha_lectura=fecha_lectura,
                    id_lector=current_user.id_usuario_sistema,
                    observacion=observacion.strip() if observacion else None,
                    activo=True
                )
                
                db.add(nueva_lectura)
                db.flush()
                
                exitosos.append(LecturaBulkResult(
                    fila=row_num,
                    id_medidor=medidor.id_medidor,
                    num_medidor=medidor.num_medidor,
                    lectura_anterior=lectura_anterior,
                    lectura_actual=lectura_actual,
                    consumo_m3=consumo_m3,
                    id_lectura=nueva_lectura.id_lectura
                ))
                
                print(f"✅ Fila {row_num}: {medidor.num_medidor} - {consumo_m3}m³")
                
            except Exception as e:
                fallidos.append(LecturaBulkError(
                    fila=row_num,
                    id_medidor=None,
                    num_medidor=num_medidor if 'num_medidor' in locals() else None,
                    error=str(e)
                ))
                print(f"❌ Fila {row_num}: {str(e)}")
        
        # Commit
        if exitosos:
            db.commit()
            
            registrar_auditoria(
                db=db,
                accion="IMPORT_EXCEL",
                descripcion=f"Importación {MESES_ES.get(mes, mes)}/{anio}: {len(exitosos)} exitosos, {len(fallidos)} fallidos",
                id_usuario=current_user.id_usuario_sistema
            )
            
            registrar_notificacion(
                db=db,
                id_usuario=current_user.id_usuario_sistema,
                titulo=f"Lecturas {MESES_ES.get(mes, mes)}/{anio} importadas",
                mensaje=f"{len(exitosos)} lecturas registradas correctamente",
                tipo="exito"
            )
        
        print(f"\n{'='*60}")
        print(f"✅ COMPLETADO - Exitosos: {len(exitosos)} | Fallidos: {len(fallidos)}")
        print(f"{'='*60}\n")
        
        return LecturaBulkResponse(
            exitosos=exitosos,
            fallidos=fallidos,
            total_procesados=len(exitosos) + len(fallidos),
            total_exitosos=len(exitosos),
            total_fallidos=len(fallidos)
        )
    
    except Exception as e:
        db.rollback()
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al importar: {str(e)}"
        )
    
# ========================================
# ENDPOINT: GENERAR LECTURAS ESTIMADA
# ========================================

@router.post("/generar-estimadas", response_model=dict)
def generar_lecturas_estimadas(
    mes: int = Query(..., ge=1, le=12, description="Mes para generar lecturas"),
    anio: int = Query(..., ge=2020, description="Año para generar lecturas"),
    meses_promedio: int = Query(3, ge=1, le=12, description="Meses para calcular promedio"),
    consumo_default: int = Query(10, ge=0, description="Consumo por defecto para medidores sin historial (m³)"),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Genera lecturas estimadas para medidores que NO tienen lectura en el período especificado.
    
    CASOS MANEJADOS:
    1. Medidor CON historial: Calcula promedio de últimos N meses
    2. Medidor SIN historial: Usa lectura_anterior del medidor + consumo_default
    3. Medidor nuevo (lectura_anterior = 0): Genera lectura inicial con consumo_default
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "lecturas", "crear")
    
    try:
        # 1. Obtener todos los medidores activos con usuarios
        medidores_con_usuario = db.query(Medidor).filter(
            Medidor.activo == True,
            Medidor.id_usuario_afi.isnot(None)
        ).all()
        
        if not medidores_con_usuario:
            return {
                "success": False,
                "message": "No hay medidores con usuarios asignados"
            }
        
        # 2. Obtener medidores que YA tienen lectura en el período
        medidores_con_lectura = db.query(Lectura.id_medidor).filter(
            func.extract('month', Lectura.fecha_lectura) == mes,
            func.extract('year', Lectura.fecha_lectura) == anio,
            Lectura.activo == True
        ).distinct().all()
        
        ids_con_lectura = {m[0] for m in medidores_con_lectura}
        
        # 3. Filtrar medidores SIN lectura en el período
        medidores_sin_lectura = [
            m for m in medidores_con_usuario 
            if m.id_medidor not in ids_con_lectura
        ]
        
        if not medidores_sin_lectura:
            return {
                "success": True,
                "message": "Todos los medidores ya tienen lectura registrada",
                "lecturas_generadas": 0,
                "detalles": []
            }
        
        # 4. Calcular consumo promedio del sistema (para referencia)
        consumo_promedio_sistema = db.query(
            func.avg(Lectura.consumo_m3)
        ).filter(
            Lectura.activo == True,
            Lectura.es_estimada == False,
            Lectura.consumo_m3 > 0
        ).scalar() or consumo_default
        
        consumo_promedio_sistema = round(consumo_promedio_sistema)
        
        # 5. Generar lecturas estimadas
        lecturas_generadas = []
        lecturas_fallidas = []
        
        for medidor in medidores_sin_lectura:
            try:
                # 🔹 CASO 1: Buscar historial de lecturas del medidor
                ultimas_lecturas = db.query(Lectura).filter(
                    Lectura.id_medidor == medidor.id_medidor,
                    Lectura.activo == True,
                    Lectura.es_estimada == False
                ).order_by(
                    Lectura.fecha_lectura.desc()
                ).limit(meses_promedio).all()
                
                # Variables para la lectura estimada
                lectura_anterior = 0
                consumo_estimado = 0
                metodo_calculo = ""
                
                if ultimas_lecturas:
                    # ✅ MEDIDOR CON HISTORIAL: Calcular promedio
                    consumo_estimado = sum(l.consumo_m3 for l in ultimas_lecturas) / len(ultimas_lecturas)
                    consumo_estimado = round(consumo_estimado)
                    lectura_anterior = ultimas_lecturas[0].lectura_actual
                    metodo_calculo = f"Promedio de {len(ultimas_lecturas)} meses anteriores"
                    
                else:
                    # 🔹 CASO 2: MEDIDOR SIN HISTORIAL
                    # Obtener última lectura conocida del endpoint /medidores/lista/completa
                    ultima_lectura_conocida = db.query(Lectura).filter(
                        Lectura.id_medidor == medidor.id_medidor
                    ).order_by(Lectura.fecha_lectura.desc()).first()
                    
                    if ultima_lectura_conocida:
                        # ✅ Tiene una lectura previa (aunque sea antigua)
                        lectura_anterior = ultima_lectura_conocida.lectura_actual
                        consumo_estimado = consumo_default
                        metodo_calculo = f"Sin historial reciente - Consumo sugerido: {consumo_default} m³"
                    else:
                        # ✅ MEDIDOR COMPLETAMENTE NUEVO (primera lectura)
                        lectura_anterior = 0
                        consumo_estimado = consumo_default
                        metodo_calculo = f"Primera lectura - Consumo inicial sugerido: {consumo_default} m³"
                
                # Calcular lectura estimada
                lectura_estimada = lectura_anterior + consumo_estimado
                
                # Crear lectura estimada
                nueva_lectura = Lectura(
                    id_medidor=medidor.id_medidor,
                    lectura_actual=lectura_estimada,
                    lectura_anterior=lectura_anterior,
                    consumo_m3=consumo_estimado,
                    fecha_lectura=date(anio, mes, 1),
                    id_lector=current_user.id_usuario_sistema,
                    observacion=f"⚡ Lectura estimada - {metodo_calculo}",
                    activo=True,
                    es_estimada=True
                )
                
                db.add(nueva_lectura)
                db.flush()
                
                # Obtener información del afiliado
                afiliado = medidor.usuario_afiliado
                nombre_afiliado = "Sin afiliado"
                codigo_afiliado = "N/A"
                if afiliado:
                    codigo_afiliado = afiliado.cod_usuario_afi or "N/A"
                    if afiliado.usuario_sistema:
                        us = afiliado.usuario_sistema
                        nombre_afiliado = f"{us.nombres} {us.apellidos}"
                
                lecturas_generadas.append({
                    "id_lectura": nueva_lectura.id_lectura,
                    "medidor": medidor.num_medidor,
                    "codigo_afiliado": codigo_afiliado,
                    "nombre_afiliado": nombre_afiliado,
                    "lectura_anterior": lectura_anterior,
                    "lectura_estimada": lectura_estimada,
                    "consumo_estimado": consumo_estimado,
                    "metodo_calculo": metodo_calculo,
                    "tiene_historial": len(ultimas_lecturas) > 0
                })
                
            except Exception as e:
                lecturas_fallidas.append({
                    "medidor": medidor.num_medidor,
                    "razon": str(e)
                })
                continue
        
        # 6. Confirmar transacción
        if lecturas_generadas:
            db.commit()
            
            # Contadores por tipo
            con_historial = sum(1 for l in lecturas_generadas if l["tiene_historial"])
            sin_historial = len(lecturas_generadas) - con_historial
            
            # Auditoría
            registrar_auditoria(
                db=db,
                accion="GENERAR_ESTIMADAS",
                descripcion=f"Generadas {len(lecturas_generadas)} lecturas estimadas para {MESES_ES.get(mes)}/{anio} - Con historial: {con_historial}, Sin historial: {sin_historial}",
                id_usuario=current_user.id_usuario_sistema
            )
        
        return {
            "success": True,
            "message": f"Proceso completado. Generadas {len(lecturas_generadas)} lecturas estimadas",
            "lecturas_generadas": len(lecturas_generadas),
            "lecturas_fallidas": len(lecturas_fallidas),
            "con_historial": sum(1 for l in lecturas_generadas if l["tiene_historial"]),
            "sin_historial": sum(1 for l in lecturas_generadas if not l["tiene_historial"]),
            "periodo": f"{MESES_ES.get(mes)} {anio}",
            "consumo_promedio_sistema": consumo_promedio_sistema,
            "detalles": lecturas_generadas,
            "fallidas": lecturas_fallidas
        }
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error generando lecturas estimadas: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al generar lecturas estimadas: {str(e)}"
        )


# ========================================
# ENDPOINT PARA CONFIRMAR LECTURA ESTIMADA
# ========================================

@router.patch("/{id_lectura}/confirmar-estimada", response_model=dict)
def confirmar_lectura_estimada(
    id_lectura: int,
    lectura_real: int = Query(..., description="Lectura real tomada"),
    observacion: Optional[str] = Query(None, description="Observación adicional"),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Convierte una lectura estimada en lectura real con el valor correcto.
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "lecturas", "actualizar")
    
    try:
        lectura = db.query(Lectura).filter(
            Lectura.id_lectura == id_lectura
        ).first()
        
        if not lectura:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Lectura no encontrada"
            )
        
        if not lectura.es_estimada:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Esta lectura no es estimada"
            )
        
        # Validar que la lectura real sea mayor o igual a la anterior
        if lectura_real < lectura.lectura_anterior:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La lectura real no puede ser menor que la lectura anterior"
            )
        
        # Actualizar lectura
        lectura.lectura_actual = lectura_real
        lectura.consumo_m3 = lectura_real - lectura.lectura_anterior
        lectura.es_estimada = False  # Ya no es estimada
        lectura.id_lector = current_user.id_usuario_sistema
        
        if observacion:
            lectura.observacion = f"Confirmada - {observacion}"
        else:
            lectura.observacion = "Lectura confirmada y corregida"
        
        db.commit()
        db.refresh(lectura)
        
        # Auditoría
        registrar_auditoria(
            db=db,
            accion="CONFIRMAR_ESTIMADA",
            descripcion=f"Lectura {id_lectura} confirmada - Real: {lectura_real}m³",
            id_usuario=current_user.id_usuario_sistema
        )
        
        return lectura_to_response(lectura)
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"❌ Error confirmando lectura: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al confirmar lectura: {str(e)}"
        )

# ========================================
# ENDPOINT PARA CONFIRMAR TODAS LAS LECTURAS ESTIMADAS
# ========================================

@router.patch("/confirmar-todas-estimadas", response_model=dict)
def confirmar_todas_lecturas_estimadas(
    mes: int = Query(..., ge=1, le=12, description="Mes del periodo"),
    anio: int = Query(..., ge=2020, le=2100, description="Año del periodo"),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Confirma todas las lecturas estimadas de un periodo específico.
    Convierte las lecturas estimadas en lecturas reales con los valores actuales.
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "lecturas", "actualizar")
    
    try:
        from datetime import date
        import calendar
        
        # Calcular rango de fechas del periodo
        fecha_inicio = date(anio, mes, 1)
        ultimo_dia = calendar.monthrange(anio, mes)[1]
        fecha_fin = date(anio, mes, ultimo_dia)
        
        print(f"🔍 Buscando lecturas estimadas entre {fecha_inicio} y {fecha_fin}")
        
        # Obtener todas las lecturas estimadas del periodo
        lecturas_estimadas = db.query(Lectura).filter(
            Lectura.fecha_lectura >= fecha_inicio,
            Lectura.fecha_lectura <= fecha_fin,
            Lectura.es_estimada == True,
            Lectura.activo == True
        ).all()
        
        print(f"✅ Encontradas {len(lecturas_estimadas)} lecturas estimadas")
        
        if not lecturas_estimadas:
            return {
                "success": True,
                "mensaje": "No hay lecturas estimadas en este periodo",
                "periodo": f"{mes:02d}/{anio}",
                "lecturas_confirmadas": 0,
                "lecturas_fallidas": 0,
                "detalles": [],
                "fallidas": []
            }
        
        confirmadas = []
        fallidas = []
        
        # Procesar cada lectura estimada
        for lectura in lecturas_estimadas:
            try:
                medidor = lectura.medidor
                
                # Validar que tenga medidor
                if not medidor:
                    fallidas.append({
                        "id_lectura": lectura.id_lectura,
                        "medidor": "N/A",
                        "razon": "Medidor no encontrado"
                    })
                    continue
                
                # =========================
                # 🔵 INFORMACIÓN DEL AFILIADO (igual que en listar_lecturas)
                # =========================
                afiliado = medidor.usuario_afiliado if medidor else None
                
                # Nombre afiliado
                if afiliado and afiliado.usuario_sistema:
                    usuario_sistema = afiliado.usuario_sistema
                    nombre_afiliado = f"{usuario_sistema.nombres} {usuario_sistema.apellidos}"
                else:
                    nombre_afiliado = "Sin afiliado"
                
                # Convertir a lectura real
                lectura.es_estimada = False
                lectura.id_lector = current_user.id_usuario_sistema
                
                # Actualizar observación
                if lectura.observacion:
                    lectura.observacion += " | Confirmada automáticamente"
                else:
                    lectura.observacion = "Lectura estimada confirmada automáticamente"
                
                confirmadas.append({
                    "id_lectura": lectura.id_lectura,
                    "medidor": medidor.num_medidor,
                    "nombre_afiliado": nombre_afiliado,
                    "lectura_anterior": lectura.lectura_anterior,
                    "lectura_confirmada": lectura.lectura_actual,
                    "consumo": lectura.consumo_m3
                })
                
                print(f"✅ Lectura {lectura.id_lectura} confirmada: {medidor.num_medidor} - {nombre_afiliado}")
                
            except Exception as e:
                print(f"❌ Error procesando lectura {lectura.id_lectura}: {e}")
                import traceback
                traceback.print_exc()
                
                # Intentar obtener el número de medidor de forma segura
                num_medidor = "N/A"
                try:
                    if lectura.medidor:
                        num_medidor = lectura.medidor.num_medidor
                except:
                    pass
                
                fallidas.append({
                    "id_lectura": lectura.id_lectura,
                    "medidor": num_medidor,
                    "razon": str(e)
                })
        
        # Guardar cambios
        if confirmadas:
            db.commit()
            print(f"💾 Guardadas {len(confirmadas)} lecturas confirmadas")
            
            # Auditoría
            registrar_auditoria(
                db=db,
                accion="CONFIRMAR_TODAS_ESTIMADAS",
                descripcion=f"Confirmadas {len(confirmadas)} lecturas estimadas del periodo {mes:02d}/{anio}",
                id_usuario=current_user.id_usuario_sistema
            )
        else:
            db.rollback()
            print("⚠️ No hay lecturas para confirmar, todas fallaron")
        
        mensaje = f"Se confirmaron {len(confirmadas)} de {len(lecturas_estimadas)} lecturas"
        if fallidas:
            mensaje += f" ({len(fallidas)} fallidas)"
        
        return {
            "success": True,
            "mensaje": mensaje,
            "periodo": f"{mes:02d}/{anio}",
            "lecturas_confirmadas": len(confirmadas),
            "lecturas_fallidas": len(fallidas),
            "detalles": confirmadas[:50],
            "fallidas": fallidas[:10]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"❌ Error confirmando lecturas masivamente: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al confirmar lecturas: {str(e)}"
        )


