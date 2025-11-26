# security/jwt.py
from datetime import datetime, timedelta
from jose import jwt, JWTError
from fastapi import HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer
from dotenv import load_dotenv
import os

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")

def create_access_token(data: dict, expires_delta: timedelta = None):
    """
    Crea un token JWT con información del usuario
    
    Args:
        data: Dict con información del usuario
              Debe contener al menos 'sub' (username) e idealmente 'id_usuario_sistema'
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    
    # 🔧 Asegurar que siempre tenga id_usuario_sistema
    # Si no viene en data, se debe agregar en el endpoint de login
    if "id_usuario_sistema" not in to_encode and "user_id" not in to_encode:
        print("⚠️ ADVERTENCIA: Token creado sin id_usuario_sistema")
    
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str = Depends(oauth2_scheme)):
    """
    Verifica y decodifica el token JWT
    
    Returns:
        Dict con el payload del token
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
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