# routes/notifications.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from db.session import SessionLocal
from models.notification import Notificacion  # ✅ CORREGIDO: notificacion en lugar de notification
from models.user import UsuarioSistema  # Para obtener el usuario
from schemas.notification import NotificacionCreate, NotificacionResponse, NotificacionUpdate
from security.jwt import verify_token

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
# OBTENER USUARIO ACTUAL (COMPATIBLE CON USERS.PY)
# ========================================
def get_current_user(payload: dict, db: Session) -> UsuarioSistema:
    """
    Obtiene el usuario actual desde el payload del JWT
    Compatible con la función de routes/users.py
    """
    user = db.query(UsuarioSistema).filter(
        UsuarioSistema.usuario == payload["sub"]
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado"
        )
    
    return user

def get_current_user_id(payload: dict, db: Session) -> int:
    """
    Obtiene el ID del usuario desde el payload del JWT
    Maneja diferentes formatos de payload
    """
    # Opción 1: Viene directamente en el payload (después del fix del login)
    user_id = payload.get("id_usuario_sistema") or payload.get("user_id")
    
    if user_id:
        print(f"✅ ID de usuario obtenido del token: {user_id}")
        return user_id
    
    # Opción 2: Buscar por username (compatibilidad con tokens antiguos)
    username = payload.get("sub")
    if username:
        print(f"🔍 Buscando usuario por username: {username}")
        user = db.query(UsuarioSistema).filter(
            UsuarioSistema.usuario == username
        ).first()
        
        if user:
            print(f"✅ Usuario encontrado: {username} (ID: {user.id_usuario_sistema})")
            return user.id_usuario_sistema
    
    print(f"❌ No se pudo identificar al usuario. Payload: {payload}")
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudo identificar al usuario"
    )


# ========================================
# CREAR NOTIFICACIÓN
# ========================================
@router.post("/", response_model=NotificacionResponse, status_code=status.HTTP_201_CREATED)
def crear_notificacion_endpoint(
    notificacion: NotificacionCreate,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Crea una notificación manualmente
    - Si no se proporciona id_usuario_sistema, se usa el del usuario autenticado
    """
    try:
        # Obtener ID del usuario
        id_usuario = notificacion.id_usuario_sistema or get_current_user_id(payload, db)
        
        # Crear notificación
        nueva = Notificacion(
            id_usuario_sistema=id_usuario,
            titulo=notificacion.titulo,
            mensaje=notificacion.mensaje,
            tipo=notificacion.tipo or "info",
            estado="no_leido",
            fecha_creacion=datetime.utcnow()
        )
        
        db.add(nueva)
        db.commit()
        db.refresh(nueva)
        
        return nueva
    
    except Exception as e:
        db.rollback()
        print(f"❌ Error creando notificación: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear notificación: {str(e)}"
        )


# ========================================
# LISTAR NOTIFICACIONES
# ========================================
@router.get("/", response_model=List[NotificacionResponse])
def listar_notificaciones(
    estado: Optional[str] = None,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Lista todas las notificaciones del usuario autenticado
    - estado: Filtro opcional (no_leido, leido, enviado)
    """
    try:
        # Obtener ID del usuario
        id_usuario = get_current_user_id(payload, db)
        
        print(f"🔍 Buscando notificaciones para usuario ID: {id_usuario}")
        
        # Query base
        query = db.query(Notificacion).filter(
            Notificacion.id_usuario_sistema == id_usuario
        )
        
        # Aplicar filtro de estado si existe
        if estado:
            query = query.filter(Notificacion.estado == estado)
        
        # Ordenar por fecha (más recientes primero)
        notificaciones = query.order_by(
            Notificacion.fecha_creacion.desc()
        ).all()
        
        print(f"✅ Encontradas {len(notificaciones)} notificaciones")
        
        return notificaciones
    
    except Exception as e:
        print(f"❌ Error listando notificaciones: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al listar notificaciones: {str(e)}"
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
        
        print(f"✅ Usuario {id_usuario} tiene {count} notificaciones no leídas")
        
        return {"no_leidas": count}
    
    except Exception as e:
        print(f"❌ Error contando notificaciones: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al contar notificaciones: {str(e)}"
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
        
        # Actualizar estado
        notificacion.estado = "leido"
        notificacion.fecha_leido = datetime.utcnow()
        
        db.commit()
        db.refresh(notificacion)
        
        print(f"✅ Notificación {id_notificacion} marcada como leída")
        
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
        
        # Actualizar todas las no leídas
        count = db.query(Notificacion).filter(
            Notificacion.id_usuario_sistema == id_usuario,
            Notificacion.estado == "no_leido"
        ).update({
            "estado": "leido",
            "fecha_leido": datetime.utcnow()
        }, synchronize_session=False)
        
        db.commit()
        
        print(f"✅ {count} notificaciones marcadas como leídas para usuario {id_usuario}")
        
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
        
        print(f"✅ Notificación {id_notificacion} eliminada")
        
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


# ========================================
# ENDPOINT DE DEBUG (SOLO DESARROLLO)
# ========================================
@router.get("/debug/info")
def debug_info(
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token)
):
    """
    Endpoint de debug para verificar configuración
    ⚠️ ELIMINAR EN PRODUCCIÓN
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
        
        return {
            "usuario_id": id_usuario,
            "payload": payload,
            "total_notificaciones": total,
            "no_leidas": no_leidas,
            "ultima_notificacion": db.query(Notificacion).filter(
                Notificacion.id_usuario_sistema == id_usuario
            ).order_by(Notificacion.fecha_creacion.desc()).first()
        }
    
    except Exception as e:
        return {
            "error": str(e),
            "payload": payload
        }