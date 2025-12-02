from fastapi import APIRouter, Depends, HTTPException, status, Query
from openpyxl import Workbook, load_workbook
from openpyxl.styles import PatternFill, Font, Alignment
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
from datetime import date, datetime
import io
from fastapi.responses import StreamingResponse
from fastapi import UploadFile, File

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
        # Obtener medidores activos con sus relaciones
        medidores = db.query(Medidor).filter(
            Medidor.activo == True
        ).order_by(Medidor.num_medidor).all()
        
        print(f"📊 Generando plantilla con {len(medidores)} medidores")
        
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
            
            # Llenar datos en las columnas
            ws_plantilla.cell(row=row_num, column=1, value=medidor.num_medidor)
            ws_plantilla.cell(row=row_num, column=2, value=sector_nombre)
            ws_plantilla.cell(row=row_num, column=3, value=codigo_UsuarioAfiliado)
            ws_plantilla.cell(row=row_num, column=4, value=nombre_UsuarioAfiliado)
            ws_plantilla.cell(row=row_num, column=5, value=lectura_anterior)
            ws_plantilla.cell(row=row_num, column=6, value="")  # lectura_actual -> usuario llena
            ws_plantilla.cell(row=row_num, column=7, value="")  # observacion
        
        # ===============================
        # HOJA 2: INSTRUCCIONES
        # ===============================
        ws_instrucciones = wb.create_sheet("Instrucciones")
        
        instrucciones = [
            ["📋 INSTRUCCIONES PARA CARGA MASIVA DE LECTURAS"],
            [""],
            ["1️⃣ USO DE LA PLANTILLA:"],
            [" • Complete SOLO la columna 'lectura_actual' con los nuevos valores"],
            [" • La columna 'lectura_anterior' ya está prellenada con la última lectura"],
            [" • NO modifique las columnas: num_medidor, sector, codigo_UsuarioAfiliado, nombre_UsuarioAfiliado"],
            [" • Agregue observaciones si es necesario"],
            [""],
            ["2️⃣ COLUMNAS:"],
            [" • num_medidor: Número del medidor (NO MODIFICAR)"],
            [" • sector: Sector del medidor (NO MODIFICAR)"],
            [" • codigo_UsuarioAfiliado: Código del UsuarioAfiliado (NO MODIFICAR)"],
            [" • nombre_UsuarioAfiliado: Nombre completo del UsuarioAfiliado (NO MODIFICAR)"],
            [" • lectura_anterior: Última lectura registrada (NO MODIFICAR)"],
            [" • lectura_actual: RELLENAR con el nuevo valor"],
            [" • observacion: Comentarios opcionales"],
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
            descripcion=f"Plantilla de lecturas descargada por '{current_user.usuario}'",
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