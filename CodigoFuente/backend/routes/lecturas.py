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


# ========================================
# CRUD LECTURAS
# ========================================

@router.get("/", response_model=List[dict])
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
    require_permission(current_user, db, "lecturas", "lectura")

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


@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
def crear_lectura(
    lectura_data: LecturaCreate,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Crea una nueva lectura
    Requiere permiso: lecturas.crear o lecturas.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "lecturas", "crear")
    
    # Verificar que el medidor existe
    medidor = db.query(Medidor).filter(
        Medidor.id_medidor == lectura_data.id_medidor
    ).first()
    
    # ---------------------------------------------------
    # 🔍 Validación: evitar doble lectura en el mismo mes
    # ---------------------------------------------------
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

    if not medidor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Medidor no encontrado"
        )
    
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
        db.commit()
        db.refresh(nueva_lectura)
        
        # Auditoría
        registrar_auditoria(
            db=db,
            accion="CREATE",
            descripcion=f"Lectura creada para medidor {medidor.num_medidor} (Consumo: {nueva_lectura.consumo_m3}m³) por '{payload['sub']}'",
            id_usuario=current_user.id_usuario_sistema
        )
        
        # Notificación
        registrar_notificacion(
            db=db,
            id_usuario=current_user.id_usuario_sistema,
            titulo="Lectura creada",
            mensaje=f"Lectura del medidor {medidor.num_medidor} registrada correctamente.",
            tipo="exito"
        )
        
        return lectura_to_response(nueva_lectura)
    
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
    Lista todos los medidores activos con información del UsuarioAfiliado y sector
    Necesario para llenar el select en el frontend
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "lecturas", "lectura")
    
    try:
        # Obtener medidores activos con sus relaciones
        medidores = db.query(Medidor).filter(
            Medidor.activo == True
        ).all()
        
        resultado = []
        
        for medidor in medidores:
            # ✅ CORRECCIÓN: Usar la relación correcta
            afiliado = medidor.usuario_afiliado  # Cambio de usuario_UsuarioAfiliado a usuario_afiliado
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

from openpyxl.styles import Protection  # Agregar esta importación al inicio del archivo

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


# ========================================
# IMPORTAR LECTURAS DESDE EXCEL
# ========================================

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
        
        # Total de medidores activos
        total_medidores = db.query(func.count(Medidor.id_medidor)).filter(
            Medidor.activo == True
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