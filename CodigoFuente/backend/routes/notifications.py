# routes/notifications.py

from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlalchemy import String, cast, or_
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta

from db.session import SessionLocal
from models.notification import Notificacion
from models.user import UsuarioSistema
from routes.user import user_to_response
from schemas.notification import (
    NotificacionCreate,
    NotificacionResponse,
    NotificacionUpdate,
    MantenimientoCreate,
    NotificacionesEstadisticas
)
from schemas.user import UserListResponse
from security.jwt import verify_token
from services.email_service import email_service
from services.maintenance_logger import maintenance_logger

from zoneinfo import ZoneInfo

# Timezone for Ecuador
ECUADOR_TZ = ZoneInfo("America/Guayaquil")


router = APIRouter(
    prefix="/notifications",
    tags=["Notificaciones"]
)

# ========================================
# DEPENDENCIA DE BASE DE DATOS
# ========================================
def get_db():
    """Genera sesión de base de datos"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ========================================
# OBTENER USUARIO ACTUAL
# ========================================
def get_current_user_id(payload: dict, db: Session) -> int:
    """
    Obtiene el ID del usuario desde el payload del JWT
    """
    user_id = payload.get("id_usuario_sistema") or payload.get("user_id")
    if user_id:
        return user_id
    
    username = payload.get("sub")
    if username:
        user = db.query(UsuarioSistema).filter(
            UsuarioSistema.usuario == username
        ).first()
        if user:
            return user.id_usuario_sistema
    
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudo identificar al usuario"
    )

def get_current_user(payload: dict, db: Session) -> UsuarioSistema:
    """Obtiene el objeto usuario completo"""
    user_id = get_current_user_id(payload, db)
    user = db.query(UsuarioSistema).filter(
        UsuarioSistema.id_usuario_sistema == user_id
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    
    return user

# ========================================
# CREAR NOTIFICACIÓN GENERAL
# ========================================

@router.post("/", status_code=status.HTTP_201_CREATED)    
def crear_notificacion(
    notificacion: NotificacionCreate,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Crea una notificación general para usuario(s)
    - Si id_usuario_sistema es None, se crea para todos los usuarios
    - Soporta tipos: info, alerta, error, sistema, exito
    """
    try:
        # Obtener usuario creador
        usuario_creador = get_current_user(payload, db)
        
        # Si no se especifica usuario, crear notificación para todos
        if notificacion.id_usuario_sistema is None:
            usuarios = db.query(UsuarioSistema).filter(
                UsuarioSistema.activo == True
            ).all()
            
            notificaciones_creadas = []
            
            for usuario in usuarios:
                nueva = Notificacion(
                    id_usuario_sistema=usuario.id_usuario_sistema,
                    titulo=notificacion.titulo,
                    mensaje=notificacion.mensaje,
                    tipo=notificacion.tipo,
                    prioridad=notificacion.prioridad,
                    estado="no_leido",
                    es_mantenimiento=False,
                    fecha_creacion=datetime.nonow(ECUADOR_TZ)  
                )
                
                db.add(nueva)
                notificaciones_creadas.append(nueva)
            
            db.commit()
            
            # ✅ RETORNAR UN DICCIONARIO CON SUCCESS
            return {
                "success": True,
                "message": f"Notificación creada para {len(notificaciones_creadas)} usuarios",
                "count": len(notificaciones_creadas)
            }
        
        else:
            # Crear notificación para usuario específico
            nueva = Notificacion(
                id_usuario_sistema=notificacion.id_usuario_sistema,
                titulo=notificacion.titulo,
                mensaje=notificacion.mensaje,
                tipo=notificacion.tipo,
                prioridad=notificacion.prioridad,
                estado="no_leido",
                es_mantenimiento=False,
                fecha_creacion=datetime.now(ECUADOR_TZ)  
            )
            
            db.add(nueva)
            db.commit()
            db.refresh(nueva)
            
            # ✅ RETORNAR LA NOTIFICACIÓN COMPLETA
            return nueva
            
    except Exception as e:
        db.rollback()
        print(f"❌ Error creando notificación: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear notificación: {str(e)}"
        )

# ========================================
# LISTAR USUARIOS
# ========================================
@router.get("/usuarios", response_model=List[UserListResponse])
def get_users(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    rol: Optional[str] = None,
    activo: Optional[bool] = None,
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Obtiene lista de usuarios con filtros opcionales
    Requiere permiso: usuarios.leer o usuarios.crud
    """
    # Obtener usuario actual y verificar permisos
    current_user = get_current_user(payload, db)
    
    query = db.query(UsuarioSistema) 
    
    # Filtro de búsqueda
    if search:
        like = f"%{search}%"
        search_filter = or_(
            UsuarioSistema.nombres.ilike(like),
            UsuarioSistema.apellidos.ilike(like),
            cast(UsuarioSistema.cedula, String).ilike(like)
        )
        query = query.filter(search_filter)
    
    # Filtro de rol
    if rol and rol != "all":
        query = query.filter(UsuarioSistema.id_rol == rol)
    
    # Filtro de estado
    if activo is not None:
        query = query.filter(UsuarioSistema.activo == activo)
    
    # Ordenar por fecha de registro descendente
    query = query.order_by(UsuarioSistema.fecha_registro.desc())
    
    users = query.offset(skip).limit(limit).all()
    
    return [user_to_response(user, db) for user in users]

# ========================================
# 🔥 CREAR MANTENIMIENTO PROGRAMADO
# ========================================
@router.post("/mantenimiento", response_model=dict, status_code=status.HTTP_201_CREATED)
def crear_mantenimiento_programado(
    mantenimiento: MantenimientoCreate,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Crea una notificación de mantenimiento programado
    
    - Validación: Debe programarse con al menos 24 horas de anticipación
    - Envío opcional por correo electrónico
    - Registro en logs de auditoría
    - Notifica a todos los usuarios activos o a uno específico
    """
    try:
        # Obtener usuario creador
        usuario_creador = get_current_user(payload, db)
        
        # Validar que sea con 24 horas de anticipación (ya validado en schema)
        ahora = datetime.now(ECUADOR_TZ)
        horas_anticipacion = (mantenimiento.fecha_inicio_mantenimiento - ahora).total_seconds() / 3600
        
        if horas_anticipacion < 24:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El mantenimiento debe programarse con al menos 24 horas de anticipación. Anticipación actual: {horas_anticipacion:.1f} horas"
            )
        
        # Determinar usuarios destinatarios
        if mantenimiento.id_usuario_sistema is None:
            # Notificar a todos los usuarios activos
            usuarios = db.query(UsuarioSistema).filter(
                UsuarioSistema.activo == True
            ).all()
        else:
            # Notificar a usuario específico
            usuario = db.query(UsuarioSistema).filter(
                UsuarioSistema.id_usuario_sistema == mantenimiento.id_usuario_sistema,
                UsuarioSistema.activo == True
            ).first()
            
            if not usuario:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Usuario no encontrado o inactivo"
                )
            usuarios = [usuario]
        
        # Crear notificaciones para cada usuario
        notificaciones_creadas = []
        emails_enviados = 0
        emails_fallidos = 0
        
        for usuario in usuarios:
            # Crear notificación en BD
            nueva_notificacion = Notificacion(
                id_usuario_sistema=usuario.id_usuario_sistema,
                titulo=mantenimiento.titulo,
                mensaje=mantenimiento.mensaje,
                tipo="mantenimiento",
                prioridad=mantenimiento.prioridad,
                estado="no_leido",
                es_mantenimiento=True,
                fecha_inicio_mantenimiento=mantenimiento.fecha_inicio_mantenimiento,
                fecha_fin_mantenimiento=mantenimiento.fecha_fin_mantenimiento,
                duracion_estimada=mantenimiento.duracion_estimada,
                modulos_afectados=mantenimiento.modulos_afectados,
                enviar_email=mantenimiento.enviar_email,
                email_enviado=False,
                fecha_creacion=datetime.now(ECUADOR_TZ) 
            )
            
            db.add(nueva_notificacion)
            db.flush()  # Para obtener el ID
            
            notificaciones_creadas.append(nueva_notificacion)
            
            # Enviar email si está habilitado
            if mantenimiento.enviar_email and usuario.email:
                try:
                    email_exitoso = email_service.enviar_notificacion_mantenimiento(
                        destinatarios=[usuario.email],
                        titulo=mantenimiento.titulo,
                        mensaje=mantenimiento.mensaje,
                        fecha_inicio=mantenimiento.fecha_inicio_mantenimiento,
                        fecha_fin=mantenimiento.fecha_fin_mantenimiento,
                        duracion=mantenimiento.duracion_estimada,
                        modulos_afectados=mantenimiento.modulos_afectados
                    )
                    
                    if email_exitoso:
                        nueva_notificacion.email_enviado = True
                        nueva_notificacion.fecha_envio_email = datetime.now(ECUADOR_TZ)  
                        emails_enviados += 1
                        
                        # Log exitoso
                        maintenance_logger.log_email_enviado(
                            id_notificacion=nueva_notificacion.id_notificacion,
                            titulo=mantenimiento.titulo,
                            destinatarios_count=1,
                            exitoso=True
                        )
                    else:
                        emails_fallidos += 1
                        
                except Exception as e:
                    emails_fallidos += 1
                    maintenance_logger.log_email_enviado(
                        id_notificacion=nueva_notificacion.id_notificacion,
                        titulo=mantenimiento.titulo,
                        destinatarios_count=1,
                        exitoso=False,
                        error=str(e)
                    )
        
        # Commit de todas las notificaciones
        db.commit()
        
        # Registrar en logs
        maintenance_logger.log_mantenimiento_creado(
            id_notificacion=notificaciones_creadas[0].id_notificacion if notificaciones_creadas else 0,
            titulo=mantenimiento.titulo,
            fecha_inicio=mantenimiento.fecha_inicio_mantenimiento,
            fecha_fin=mantenimiento.fecha_fin_mantenimiento,
            usuario_creador=usuario_creador.usuario,
            enviar_email=mantenimiento.enviar_email,
            destinatarios_count=len(usuarios)
        )
        
        return {
            "success": True,
            "message": "Mantenimiento programado creado exitosamente",
            "data": {
                "notificaciones_creadas": len(notificaciones_creadas),
                "usuarios_notificados": len(usuarios),
                "emails_enviados": emails_enviados,
                "emails_fallidos": emails_fallidos,
                "fecha_inicio": mantenimiento.fecha_inicio_mantenimiento.isoformat(),
                "horas_anticipacion": round(horas_anticipacion, 1)
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        maintenance_logger.log_error("crear_mantenimiento", str(e))
        print(f"❌ Error creando mantenimiento programado: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear mantenimiento: {str(e)}"
        )

# ========================================
# LISTAR NOTIFICACIONES
# ========================================
@router.get("/", response_model=List[NotificacionResponse])
def listar_notificaciones(
    estado: Optional[str] = None,
    tipo: Optional[str] = None,
    es_mantenimiento: Optional[bool] = None,    
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Lista todas las notificaciones del usuario autenticado
    
    Filtros opcionales:
    - estado: no_leido, leido
    - tipo: info, alerta, error, sistema, mantenimiento
    - es_mantenimiento: true/false
    """
    try:
        id_usuario = get_current_user_id(payload, db)
        
        # Query base
        query = db.query(Notificacion).filter(
            Notificacion.id_usuario_sistema == id_usuario
        )
        
        # Aplicar filtros
        if estado:
            query = query.filter(Notificacion.estado == estado)
        
        if tipo:
            query = query.filter(Notificacion.tipo == tipo)
        
        if es_mantenimiento is not None:
            query = query.filter(Notificacion.es_mantenimiento == es_mantenimiento)
        
        # Ordenar por fecha (más recientes primero)
        notificaciones = query.order_by(
            Notificacion.fecha_creacion.desc()
        ).all()
        
        return notificaciones
        
    except Exception as e:
        print(f"❌ Error listando notificaciones: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al listar notificaciones: {str(e)}"
        )

# ========================================
# 🔥 LISTAR MANTENIMIENTOS PROGRAMADOS
# ========================================
@router.get("/mantenimientos", response_model=List[NotificacionResponse])
def listar_mantenimientos(
    proximos: bool = True,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Lista mantenimientos programados
    
    - proximos=true: Solo mantenimientos futuros
    - proximos=false: Todos los mantenimientos (histórico)
    """
    try:
        id_usuario = get_current_user_id(payload, db)
        
        query = db.query(Notificacion).filter(
            Notificacion.id_usuario_sistema == id_usuario,
            Notificacion.es_mantenimiento == True
        )
        
        if proximos:
            # Solo mantenimientos futuros
            query = query.filter(
                Notificacion.fecha_inicio_mantenimiento > datetime.now(ECUADOR_TZ) 
            )
        
        mantenimientos = query.order_by(
            Notificacion.fecha_inicio_mantenimiento.asc()
        ).all()
        
        return mantenimientos
        
    except Exception as e:
        print(f"❌ Error listando mantenimientos: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al listar mantenimientos: {str(e)}"
        )

# ========================================
# OBTENER UNA NOTIFICACIÓN
# ========================================
@router.get("/{id_notificacion}", response_model=NotificacionResponse)
def obtener_notificacion(
    id_notificacion: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """Obtiene una notificación específica"""
    try:
        id_usuario = get_current_user_id(payload, db)
        
        notificacion = db.query(Notificacion).filter(
            Notificacion.id_notificacion == id_notificacion,
            Notificacion.id_usuario_sistema == id_usuario
        ).first()
        
        if not notificacion:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notificación no encontrada"
            )
        
        return notificacion
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error obteniendo notificación: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener notificación: {str(e)}"
        )

# ========================================
# CONTADOR DE NO LEÍDAS
# ========================================
@router.get("/no-leidas/count")
def contar_no_leidas(
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """Cuenta las notificaciones no leídas del usuario"""
    try:
        id_usuario = get_current_user_id(payload, db)
        
        count = db.query(Notificacion).filter(
            Notificacion.id_usuario_sistema == id_usuario,
            Notificacion.estado == "no_leido"
        ).count()
        
        return {"no_leidas": count}
        
    except Exception as e:
        print(f"❌ Error contando notificaciones: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al contar notificaciones: {str(e)}"
        )

# ========================================
# 🔥 ESTADÍSTICAS DE NOTIFICACIONES
# ========================================
@router.get("/estadisticas/resumen", response_model=NotificacionesEstadisticas)
def obtener_estadisticas(
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Obtiene estadísticas de notificaciones del usuario
    """
    try:
        id_usuario = get_current_user_id(payload, db)
        
        total = db.query(Notificacion).filter(
            Notificacion.id_usuario_sistema == id_usuario
        ).count()
        
        no_leidas = db.query(Notificacion).filter(
            Notificacion.id_usuario_sistema == id_usuario,
            Notificacion.estado == "no_leido"
        ).count()
        
        leidas = total - no_leidas
        
        # Mantenimientos próximos (en las próximas 48 horas)
        fecha_limite = datetime.now(ECUADOR_TZ)  + timedelta(hours=48)
        mantenimientos_proximos = db.query(Notificacion).filter(
            Notificacion.id_usuario_sistema == id_usuario,
            Notificacion.es_mantenimiento == True,
            Notificacion.fecha_inicio_mantenimiento.between(
                datetime.now(ECUADOR_TZ) ,
                fecha_limite
            )
        ).count()
        
        return {
            "total": total,
            "no_leidas": no_leidas,
            "leidas": leidas,
            "mantenimientos_proximos": mantenimientos_proximos
        }
        
    except Exception as e:
        print(f"❌ Error obteniendo estadísticas: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener estadísticas: {str(e)}"
        )

# ========================================
# MARCAR COMO LEÍDA
# ========================================
@router.patch("/{id_notificacion}/marcar-leida", response_model=NotificacionResponse)
def marcar_como_leida(
    id_notificacion: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """Marca una notificación como leída"""
    try:
        id_usuario = get_current_user_id(payload, db)
        
        notificacion = db.query(Notificacion).filter(
            Notificacion.id_notificacion == id_notificacion,
            Notificacion.id_usuario_sistema == id_usuario
        ).first()
        
        if not notificacion:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notificación no encontrada"
            )
        
        notificacion.estado = "leido"
        notificacion.fecha_leido = datetime.now(ECUADOR_TZ)
        
        db.commit()
        db.refresh(notificacion)
        
        return notificacion
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"❌ Error marcando como leída: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al marcar notificación: {str(e)}"
        )

# ========================================
# MARCAR TODAS COMO LEÍDAS
# ========================================
@router.patch("/marcar-todas-leidas")
def marcar_todas_leidas(
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """Marca todas las notificaciones del usuario como leídas"""
    try:
        id_usuario = get_current_user_id(payload, db)
        
        count = db.query(Notificacion).filter(
            Notificacion.id_usuario_sistema == id_usuario,
            Notificacion.estado == "no_leido"
        ).update({
            "estado": "leido",
            "fecha_leido": datetime.now(ECUADOR_TZ) 
        }, synchronize_session=False)
        
        db.commit()
        
        return {
            "success": True,
            "message": f"{count} notificaciones marcadas como leídas",
            "count": count
        }
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error marcando todas como leídas: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al marcar todas las notificaciones: {str(e)}"
        )

# ========================================
# ELIMINAR NOTIFICACIÓN
# ========================================
@router.delete("/bulk")
def eliminar_notificaciones_masivo(
    ids: Optional[List[int]] = Body(None, embed=True),
    eliminar_todas: bool = Body(False, embed=True),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """Elimina varias notificaciones del usuario autenticado."""
    try:
        id_usuario = get_current_user_id(payload, db)

        query = db.query(Notificacion).filter(
            Notificacion.id_usuario_sistema == id_usuario
        )

        if not eliminar_todas:
            ids_limpios = sorted({int(item) for item in (ids or []) if item})
            if not ids_limpios:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Debe enviar al menos una notificacion para eliminar"
                )
            query = query.filter(Notificacion.id_notificacion.in_(ids_limpios))

        count = query.delete(synchronize_session=False)
        db.commit()

        return {
            "success": True,
            "message": f"{count} notificaciones eliminadas",
            "count": count
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"âŒ Error eliminando notificaciones masivamente: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al eliminar notificaciones: {str(e)}"
        )


@router.delete("/{id_notificacion}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_notificacion(
    id_notificacion: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """Elimina una notificación específica"""
    try:
        id_usuario = get_current_user_id(payload, db)
        
        notificacion = db.query(Notificacion).filter(
            Notificacion.id_notificacion == id_notificacion,
            Notificacion.id_usuario_sistema == id_usuario
        ).first()
        
        if not notificacion:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notificación no encontrada"
            )
        
        db.delete(notificacion)
        db.commit()
        
        return None
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"❌ Error eliminando notificación: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al eliminar notificación: {str(e)}"
        )
