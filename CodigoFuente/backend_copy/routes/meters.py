# routes/meters.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func, or_, cast, String
from psycopg2.errors import ForeignKeyViolation, UniqueViolation
from typing import List, Optional

from models.meter import Medidor
from models.user import UsuarioSistema
from models.affiliate import UsuarioAfiliado
from models.sector import Sector
from schemas.meter import (
    MedidorCreate, MedidorUpdate, MedidorResponse, 
    MedidorCompleto, MedidorStats, AfiliadoDisponible
)
from utils.notifications import registrar_notificacion
from utils.audit_logger import registrar_auditoria
from db.session import SessionLocal
from security.jwt import verify_token

router = APIRouter(prefix="/meters", tags=["medidores"])

def get_db():
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
    Si tiene permiso de crear, actualizar o eliminar, también tiene lectura.
    """
    from models.role import RolAccion
    
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
# CRUD MEDIDORES
# ========================================
@router.get("/", response_model=List[MedidorCompleto])
def listar_medidores(
    search: Optional[str] = Query(None, description="Búsqueda por número de medidor"),
    id_sector: Optional[int] = Query(None, description="Filtrar por sector"),
    activo: Optional[bool] = Query(None, description="Filtrar por estado"),
    asignado: Optional[bool] = Query(None, description="Filtrar por asignación"),
    skip: int = Query(0, ge=0, description="Registros a saltar"),
    limit: int = Query(100, ge=1, le=500, description="Límite de registros"),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Lista todos los medidores con filtros opcionales
    Requiere permiso: medidores.lectura o medidores.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "medidores", "lectura")
    
    # 🔥 CAMBIO CLAVE: Cargar explícitamente las relaciones anidadas
    query = db.query(Medidor).options(
        joinedload(Medidor.sector),
        joinedload(Medidor.usuario_afiliado).joinedload(UsuarioAfiliado.usuario_sistema)
    )
    
    # Aplicar filtros
    if search:
        like = f"%{search}%"
        query = query.filter(
            or_(
                Medidor.num_medidor.ilike(like),
                cast(UsuarioAfiliado.cod_usuario_afi, String).ilike(like),
                UsuarioAfiliado.nombre_afiliado.ilike(like)
            )
        )
    
    if id_sector is not None:
        query = query.filter(Medidor.id_sector == id_sector)
    
    if activo is not None:
        query = query.filter(Medidor.activo == activo)
    
    if asignado is not None:
        if asignado:
            query = query.filter(Medidor.id_usuario_afi.isnot(None))
        else:
            query = query.filter(Medidor.id_usuario_afi.is_(None))
    
    medidores = query.offset(skip).limit(limit).all()
    
    return medidores


@router.get("/stats/count", response_model=MedidorStats)
def obtener_estadisticas_medidores(
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Obtiene estadísticas de medidores
    Requiere permiso: medidores.lectura o medidores.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "medidores", "lectura")
    
    total = db.query(Medidor).count()
    activos = db.query(Medidor).filter(Medidor.activo == True).count()
    inactivos = db.query(Medidor).filter(Medidor.activo == False).count()
    asignados = db.query(Medidor).filter(Medidor.id_usuario_afi.isnot(None)).count()
    sin_asignar = db.query(Medidor).filter(Medidor.id_usuario_afi.is_(None)).count()
    
    # Estadísticas por sector
    por_sector = {}
    sectores_stats = db.query(
        Sector.nombre_sector,
        func.count(Medidor.id_medidor).label('total')
    ).outerjoin(Medidor, Sector.id_sector == Medidor.id_sector)\
     .group_by(Sector.nombre_sector).all()
    
    for sector, count in sectores_stats:
        por_sector[sector] = count
    
    return MedidorStats(
        total=total,
        activos=activos,
        inactivos=inactivos,
        asignados=asignados,
        sin_asignar=sin_asignar,
        por_sector=por_sector
    )


@router.get("/available/affiliates", response_model=List[AfiliadoDisponible])
def listar_afiliados_disponibles(
    search: Optional[str] = Query(None, description="Búsqueda por código de afiliado"),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Lista afiliados sin medidor asignado
    Requiere permiso: medidores.lectura o medidores.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "medidores", "lectura")
    
    # Subconsulta para obtener IDs de afiliados que ya tienen medidor
    subquery = db.query(Medidor.id_usuario_afi).filter(
        Medidor.id_usuario_afi.isnot(None)
    ).subquery()
    
    # 🔥 CAMBIO: Cargar explícitamente usuario_sistema
    query = db.query(UsuarioAfiliado).options(
        joinedload(UsuarioAfiliado.usuario_sistema),
        joinedload(UsuarioAfiliado.sector)
    ).filter(
        UsuarioAfiliado.id_usuario_afi.notin_(subquery)
    )
    
    if search:
        query = query.filter(UsuarioAfiliado.cod_usuario_afi.ilike(f"%{search}%"))
    
    afiliados = query.limit(100).all()
    
    # Transformar a schema
    resultado = []
    for afiliado in afiliados:
        usuario_sistema = afiliado.usuario_sistema
        sector_nombre = None
        if afiliado.sector:
            sector_nombre = getattr(afiliado.sector, 'nombre_sector', None)
        
        resultado.append(AfiliadoDisponible(
            id_usuario_afi=afiliado.id_usuario_afi,
            cod_usuario_afi=afiliado.cod_usuario_afi,
            nombre_afiliado=(
                f"{usuario_sistema.nombres} {usuario_sistema.apellidos}"
                if usuario_sistema else None
            ),
            fecha_afiliacion=afiliado.fecha_afiliacion,
            id_sector=afiliado.id_sector,
            nombre_sector=sector_nombre
        ))
    
    return resultado


@router.get("/{id_medidor}", response_model=MedidorCompleto)
def obtener_medidor(
    id_medidor: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Obtiene un medidor específico por ID
    Requiere permiso: medidores.lectura o medidores.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "medidores", "lectura")
    
    # 🔥 CAMBIO: Cargar explícitamente las relaciones anidadas
    medidor = db.query(Medidor).options(
        joinedload(Medidor.sector),
        joinedload(Medidor.usuario_afiliado).joinedload(UsuarioAfiliado.usuario_sistema)
    ).filter(Medidor.id_medidor == id_medidor).first()
    
    if not medidor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Medidor no encontrado"
        )
    
    return MedidorCompleto.from_orm(medidor)


@router.post("/", response_model=MedidorCompleto, status_code=status.HTTP_201_CREATED)
def crear_medidor(
    medidor: MedidorCreate,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Crea un nuevo medidor
    Requiere permiso: medidores.crear o medidores.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "medidores", "crear")
    
    # Verificar que no exista el número de medidor
    existe = db.query(Medidor).filter(
        Medidor.num_medidor == medidor.num_medidor
    ).first()
    
    if existe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ya existe un medidor con el número '{medidor.num_medidor}'"
        )
    
    # Verificar que el afiliado no tenga medidor asignado
    if medidor.id_usuario_afi:
        medidor_existente = db.query(Medidor).filter(
            Medidor.id_usuario_afi == medidor.id_usuario_afi
        ).first()
        
        if medidor_existente:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El afiliado ya tiene un medidor asignado"
            )
    
    # Verificar que el sector existe si se proporciona
    if medidor.id_sector:
        sector = db.query(Sector).filter(Sector.id_sector == medidor.id_sector).first()
        if not sector:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Sector no encontrado"
            )
    
    nuevo_medidor = Medidor(**medidor.dict())
    
    try:
        db.add(nuevo_medidor)
        db.commit()
        db.refresh(nuevo_medidor)
        
        # 🔥 CAMBIO: Cargar las relaciones después del refresh
        db.query(Medidor).options(
            joinedload(Medidor.sector),
            joinedload(Medidor.usuario_afiliado).joinedload(UsuarioAfiliado.usuario_sistema)
        ).filter(Medidor.id_medidor == nuevo_medidor.id_medidor).first()
        
        # Registrar auditoría
        registrar_auditoria(
            db=db,
            accion="CREATE",
            descripcion=f"Medidor '{nuevo_medidor.num_medidor}' creado por '{payload['sub']}'",
            id_usuario=current_user.id_usuario_sistema
        )
        
        # Crear notificación
        registrar_notificacion(
            db=db,
            id_usuario=current_user.id_usuario_sistema,
            titulo="Medidor creado",
            mensaje=f"El medidor '{nuevo_medidor.num_medidor}' fue creado correctamente.",
            tipo="exito"
        )
        
        return MedidorCompleto.from_orm(nuevo_medidor)
    
    except IntegrityError as e:
        db.rollback()
        if isinstance(e.orig, UniqueViolation):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ya existe un medidor con ese número o afiliado"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear el medidor: {str(e)}"
        )
    
    except Exception as e:
        db.rollback()
        print(f"❌ Error al crear medidor: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear el medidor: {str(e)}"
        )


@router.put("/{id_medidor}", response_model=MedidorCompleto)
def actualizar_medidor(
    id_medidor: int,
    medidor_update: MedidorUpdate,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Actualiza un medidor
    Requiere permiso: medidores.actualizar o medidores.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "medidores", "actualizar")
    
    # 🔥 CAMBIO: Cargar con las relaciones desde el inicio
    medidor = db.query(Medidor).options(
        joinedload(Medidor.sector),
        joinedload(Medidor.usuario_afiliado).joinedload(UsuarioAfiliado.usuario_sistema)
    ).filter(Medidor.id_medidor == id_medidor).first()
    
    if not medidor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Medidor no encontrado"
        )
    
    # Validar número de medidor único
    if medidor_update.num_medidor and medidor_update.num_medidor != medidor.num_medidor:
        existe = db.query(Medidor).filter(
            Medidor.num_medidor == medidor_update.num_medidor,
            Medidor.id_medidor != id_medidor
        ).first()
        if existe:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ya existe otro medidor con el número '{medidor_update.num_medidor}'"
            )
    
    # Validar afiliado único
    if medidor_update.id_usuario_afi and medidor_update.id_usuario_afi != medidor.id_usuario_afi:
        existe = db.query(Medidor).filter(
            Medidor.id_usuario_afi == medidor_update.id_usuario_afi,
            Medidor.id_medidor != id_medidor
        ).first()
        if existe:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El afiliado ya tiene un medidor asignado"
            )
    
    # Actualizar solo los campos enviados
    for key, value in medidor_update.dict(exclude_unset=True).items():
        setattr(medidor, key, value)
    
    try:
        db.commit()
        db.refresh(medidor)
        
        # 🔥 CAMBIO: Recargar con las relaciones después del commit
        medidor = db.query(Medidor).options(
            joinedload(Medidor.sector),
            joinedload(Medidor.usuario_afiliado).joinedload(UsuarioAfiliado.usuario_sistema)
        ).filter(Medidor.id_medidor == id_medidor).first()
        
        # Registrar auditoría
        registrar_auditoria(
            db=db,
            accion="UPDATE",
            descripcion=f"Medidor '{medidor.num_medidor}' actualizado por '{payload['sub']}'",
            id_usuario=current_user.id_usuario_sistema
        )
        
        # Crear notificación
        registrar_notificacion(
            db=db,
            id_usuario=current_user.id_usuario_sistema,
            titulo="Medidor modificado",
            mensaje=f"El medidor '{medidor.num_medidor}' fue modificado correctamente.",
            tipo="info"
        )
        
        return MedidorCompleto.from_orm(medidor)
    
    except Exception as e:
        db.rollback()
        print(f"❌ Error al actualizar medidor: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al actualizar el medidor"
        )


@router.delete("/{id_medidor}", status_code=status.HTTP_200_OK)
def eliminar_medidor(
    id_medidor: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Elimina el medidor si no tiene relaciones.
    Si tiene relaciones, lo desactiva (borrado lógico).
    Requiere permiso: medidores.eliminar o medidores.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "medidores", "eliminar")
    
    medidor = db.query(Medidor).filter(Medidor.id_medidor == id_medidor).first()
    
    if not medidor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Medidor no encontrado"
        )
    
    try:
        # Intentar eliminar físicamente
        db.delete(medidor)
        db.commit()
        
        # Auditoría
        registrar_auditoria(
            db=db,
            accion="DELETE",
            descripcion=f"Medidor '{medidor.num_medidor}' eliminado por '{payload['sub']}'",
            id_usuario=current_user.id_usuario_sistema
        )
        
        # Notificación
        registrar_notificacion(
            db=db,
            id_usuario=current_user.id_usuario_sistema,
            titulo="Medidor eliminado",
            mensaje=f"El medidor '{medidor.num_medidor}' fue eliminado correctamente.",
            tipo="info"
        )
        
        return {
            "success": True,
            "message": f"✅ El medidor '{medidor.num_medidor}' fue eliminado correctamente.",
            "accion": "eliminado",
            "medidor": medidor.to_dict()
        }
    
    except IntegrityError as e:
        db.rollback()
        
        # Si es por relación, desactivar
        if isinstance(e.orig, ForeignKeyViolation):
            print(f"⚠️ No se puede eliminar por relaciones, se desactiva el medidor: {e}")
            
            if not medidor.activo:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"El medidor '{medidor.num_medidor}' ya está inactivo."
                )
            
            medidor.activo = False
            db.commit()
            db.refresh(medidor)
            
            # Auditoría
            registrar_auditoria(
                db=db,
                accion="UPDATE",
                descripcion=f"Medidor '{medidor.num_medidor}' fue desactivado (por relaciones) por '{payload['sub']}'",
                id_usuario=current_user.id_usuario_sistema
            )
            
            # Notificación
            registrar_notificacion(
                db=db,
                id_usuario=current_user.id_usuario_sistema,
                titulo="Medidor desactivado",
                mensaje=f"El medidor '{medidor.num_medidor}' no se pudo eliminar porque está relacionado con otros módulos. Fue desactivado automáticamente.",
                tipo="alerta"
            )
            
            return {
                "success": True,
                "message": f"⚠️ El medidor '{medidor.num_medidor}' no se pudo eliminar porque está relacionado con otros módulos, solo fue desactivado.",
                "accion": "desactivado",
                "medidor": medidor.to_dict()
            }
        
        # Otros errores
        print(f"Error inesperado al eliminar medidor: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al intentar eliminar el medidor"
        )
    
    except Exception as e:
        db.rollback()
        print(f"❌ Error al eliminar medidor: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al eliminar el medidor"
        )


@router.patch("/{id_medidor}/toggle-status", response_model=MedidorCompleto)
def toggle_medidor_status(
    id_medidor: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Activa/Desactiva un medidor
    Requiere permiso: medidores.actualizar o medidores.crud
    """
    current_user = get_current_user(payload, db)
    require_permission(current_user, db, "medidores", "actualizar")
    
    # 🔥 CAMBIO: Cargar con las relaciones
    medidor = db.query(Medidor).options(
        joinedload(Medidor.sector),
        joinedload(Medidor.usuario_afiliado).joinedload(UsuarioAfiliado.usuario_sistema)
    ).filter(Medidor.id_medidor == id_medidor).first()
    
    if not medidor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Medidor no encontrado"
        )
    
    # Cambiar estado
    medidor.activo = not medidor.activo
    estado_texto = "activado" if medidor.activo else "desactivado"
    
    try:
        db.commit()
        db.refresh(medidor)
        
        # Registrar auditoría
        registrar_auditoria(
            db=db,
            accion="UPDATE",
            descripcion=f"Medidor '{medidor.num_medidor}' fue {estado_texto} por '{payload['sub']}'",
            id_usuario=current_user.id_usuario_sistema
        )
        
        return medidor
    
    except Exception as e:
        db.rollback()
        print(f"❌ Error al cambiar estado del medidor: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al cambiar el estado del medidor"
        )