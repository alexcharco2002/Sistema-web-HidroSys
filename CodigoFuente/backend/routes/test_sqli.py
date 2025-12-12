from fastapi import APIRouter, Depends
from fastapi.responses import PlainTextResponse
from sqlalchemy import text
from sqlalchemy.orm import Session
from db.session import get_db

router = APIRouter()

@router.get("/prueba-sqli", response_class=PlainTextResponse)
def prueba_sqli(usuario: str, db: Session = Depends(get_db)):
    query = f"SELECT * FROM usuarios.t_usuario_sistema WHERE usuario = '{usuario}'"
    
    try:
        result = db.execute(text(query)).fetchall()
        
        # Construir respuesta como texto
        output = f"Query ejecutada: {query}\n\n"
        output += f"Resultados encontrados: {len(result)}\n\n"
        
        for i, row in enumerate(result, 1):
            output += f"--- Registro {i} ---\n"
            output += f"{row}\n\n"
        
        return output
    except Exception as e:
        return f"Query: {query}\n\nError: {str(e)}"
