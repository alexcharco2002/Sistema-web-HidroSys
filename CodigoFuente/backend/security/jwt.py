# security/jwt.py - MODIFICAR verify_token

from datetime import datetime, timedelta
from jose import jwt, JWTError
from fastapi import HTTPException, Depends, Header
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from db.session import SessionLocal
from services.session_service import verificar_sesion_activa
from dotenv import load_dotenv
import os

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 120))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")

def create_access_token(data: dict, expires_delta: timedelta = None):
    """
    Crea un token JWT con información del usuario
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    
    # ✅ ADVERTENCIA si falta id_usuario_sistema
    if "id_usuario_sistema" not in to_encode:
        print("⚠️ ADVERTENCIA: Token creado sin id_usuario_sistema")
    
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(
    token: str = Depends(oauth2_scheme),
    x_session_token: str = Header(None, alias="X-Session-Token")
):
    """
    Verifica JWT y valida sesión activa (ISO 27002)
    ✅ MODIFICADO para incluir verificación de sesión
    """
    try:
        # 1. Decodificar JWT
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        if "sub" not in payload:
            raise HTTPException(
                status_code=401,
                detail="Token inválido: falta información del usuario"
            )

        # 2. ✅ VERIFICAR SESIÓN ACTIVA (ISO 27002)
        user_id = payload.get("id_usuario_sistema")
        
        if user_id and x_session_token:
            db = SessionLocal()
            try:
                resultado = verificar_sesion_activa(db, user_id, x_session_token)
                
                if not resultado.get("valida"):
                    raise HTTPException(
                        status_code=401,
                        detail=resultado.get("motivo", "Sesión inválida"),
                        headers={"X-Force-Logout": "true"}
                    )
            finally:
                db.close()
        
        return payload

    except JWTError as e:
        print(f"❌ Error verificando token: {e}")
        raise HTTPException(
            status_code=401,
            detail="Token inválido o expirado"
        )

# ✅ NUEVA FUNCIÓN: Obtener usuario actual con sesión validada
def get_current_user_with_session(payload: dict = Depends(verify_token)):
    """
    Retorna información del usuario actual después de verificar sesión
    """
    return {
        "username": payload.get("sub"),
        "id_usuario_sistema": payload.get("id_usuario_sistema"),
        "id_rol": payload.get("id_rol"),
        "nombres": payload.get("nombres")
    }
