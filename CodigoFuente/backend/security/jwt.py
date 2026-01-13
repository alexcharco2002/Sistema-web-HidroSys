# security/jwt.py
from datetime import datetime, timedelta
from jose import jwt, JWTError
from fastapi import HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from dotenv import load_dotenv
import os

# Importar función helper de configuración
from utils.config import get_jwt_config

load_dotenv()

# ========================================
# CONFIGURACIÓN ESTÁTICA (desde .env)
# ========================================
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise ValueError("❌ SECRET_KEY no está configurada en el archivo .env")

# ⚠️ Algoritmo se lee del .env como fallback
ALGORITHM_FALLBACK = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES_FALLBACK = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 120))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")


# ========================================
# FUNCIONES PARA OBTENER DB SESSION
# ========================================
def get_db_for_jwt():
    """
    Obtiene una sesión de base de datos para JWT
    Esta función se usa internamente y cierra la sesión automáticamente
    """
    from db.session import SessionLocal
    db = SessionLocal()
    try:
        return db
    except Exception as e:
        print(f"⚠️ Error al obtener DB para JWT: {e}")
        return None
    finally:
        if db:
            db.close()


# ========================================
# CREAR TOKEN JWT CON CONFIGURACIÓN DINÁMICA
# ========================================
def create_access_token(data: dict, expires_delta: timedelta = None, db: Session = None) -> str:
    """
    Crea un token JWT con información del usuario
    
    Args:
        data: Dict con información del usuario
              Debe contener al menos 'sub' (username) e idealmente 'id_usuario_sistema'
        expires_delta: Tiempo de expiración personalizado (opcional)
        db: Sesión de base de datos (opcional, se crea una si no se provee)
    
    Returns:
        Token JWT codificado
    """
    to_encode = data.copy()
    
    # ✅ Obtener configuración de expiración desde BD
    try:
        # Si no se provee db, crear una temporal
        close_db = False
        if db is None:
            db = get_db_for_jwt()
            close_db = True
        
        if db:
            jwt_config = get_jwt_config(db)
            expire_minutes = jwt_config['ACCESS_TOKEN_EXPIRE_MINUTES']
            algorithm = jwt_config['JWT_ALGORITHM']
        else:
            # Fallback a valores del .env
            print("⚠️ No se pudo conectar a BD, usando configuración del .env")
            expire_minutes = ACCESS_TOKEN_EXPIRE_MINUTES_FALLBACK
            algorithm = ALGORITHM_FALLBACK
        
        # Cerrar db si la creamos aquí
        if close_db and db:
            db.close()
            
    except Exception as e:
        print(f"⚠️ Error al leer config JWT desde BD: {e}")
        print(f"   Usando valores fallback del .env")
        expire_minutes = ACCESS_TOKEN_EXPIRE_MINUTES_FALLBACK
        algorithm = ALGORITHM_FALLBACK
    
    # Calcular tiempo de expiración
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=expire_minutes)
    
    to_encode.update({"exp": expire})
    
    # 🔧 Asegurar que siempre tenga id_usuario_sistema
    if "id_usuario_sistema" not in to_encode and "user_id" not in to_encode:
        print("⚠️ ADVERTENCIA: Token creado sin id_usuario_sistema")
    
    # Codificar token
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=algorithm)
    
    return encoded_jwt


# ========================================
# VERIFICAR TOKEN JWT
# ========================================
def verify_token(token: str = Depends(oauth2_scheme)) -> dict:
    """
    Verifica y decodifica el token JWT
    
    Args:
        token: Token JWT desde el header Authorization
    
    Returns:
        Dict con el payload del token
    
    Raises:
        HTTPException: Si el token es inválido o ha expirado
    """
    try:
        # ✅ Obtener algoritmo desde BD o usar fallback
        try:
            db = get_db_for_jwt()
            if db:
                jwt_config = get_jwt_config(db)
                algorithm = jwt_config['JWT_ALGORITHM']
                db.close()
            else:
                algorithm = ALGORITHM_FALLBACK
        except Exception as e:
            print(f"⚠️ Error al leer algoritmo JWT desde BD: {e}")
            algorithm = ALGORITHM_FALLBACK
        
        # Decodificar token
        payload = jwt.decode(token, SECRET_KEY, algorithms=[algorithm])
        
        # Verificar que el token tenga al menos 'sub'
        if "sub" not in payload:
            raise HTTPException(
                status_code=401, 
                detail="Token inválido: falta información del usuario"
            )
        
        return payload
    
    except JWTError as e:
        print(f"❌ Error verificando token: {e}")
        raise HTTPException(
            status_code=401, 
            detail="Token inválido o expirado"
        )


# ========================================
# CREAR REFRESH TOKEN (OPCIONAL)
# ========================================
def create_refresh_token(data: dict, db: Session = None) -> str:
    """
    Crea un refresh token con mayor duración
    
    Args:
        data: Dict con información del usuario
        db: Sesión de base de datos (opcional)
    
    Returns:
        Refresh token JWT codificado
    """
    try:
        # Obtener configuración desde BD
        close_db = False
        if db is None:
            db = get_db_for_jwt()
            close_db = True
        
        if db:
            jwt_config = get_jwt_config(db)
            expire_days = jwt_config['JWT_REFRESH_TOKEN_EXPIRE_DAYS']
        else:
            expire_days = 7  # Fallback
        
        if close_db and db:
            db.close()
            
    except Exception as e:
        print(f"⚠️ Error al leer config refresh token: {e}")
        expire_days = 7  # Fallback
    
    # Crear token con expiración en días
    expires_delta = timedelta(days=expire_days)
    return create_access_token(data, expires_delta=expires_delta, db=db)


# ========================================
# OBTENER USUARIO ACTUAL DESDE TOKEN
# ========================================
def get_current_user(payload: dict = Depends(verify_token)) -> dict:
    """
    Obtiene la información del usuario actual desde el token
    
    Args:
        payload: Payload del token verificado
    
    Returns:
        Dict con información del usuario
    """
    return {
        "usuario": payload.get("sub"),
        "id_usuario_sistema": payload.get("id_usuario_sistema"),
        "id_rol": payload.get("id_rol"),
        "nombre_rol": payload.get("nombre_rol"),
        "nombres": payload.get("nombres")
    }


# ========================================
# VERIFICAR PERMISOS ESPECÍFICOS
# ========================================
def require_role(required_role: str):
    """
    Dependency para verificar que el usuario tenga un rol específico
    
    Args:
        required_role: Nombre del rol requerido (ej: "administrador")
    
    Usage:
        @router.get("/admin-only", dependencies=[Depends(require_role("administrador"))])
    """
    def role_checker(payload: dict = Depends(verify_token)):
        user_role = payload.get("nombre_rol", "").lower()
        if user_role != required_role.lower():
            raise HTTPException(
                status_code=403,
                detail=f"Se requiere rol '{required_role}' para acceder a este recurso"
            )
        return payload
    
    return role_checker


# ========================================
# DECODE TOKEN SIN VERIFICAR (ÚTIL PARA DEBUG)
# ========================================
def decode_token_unsafe(token: str) -> dict:
    """
    Decodifica un token sin verificar su firma
    ⚠️ SOLO USAR PARA DEBUG - NO USAR EN PRODUCCIÓN
    
    Args:
        token: Token JWT
    
    Returns:
        Dict con el payload del token
    """
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM_FALLBACK], options={"verify_signature": False})
    except Exception as e:
        print(f"❌ Error decodificando token: {e}")
        return {}