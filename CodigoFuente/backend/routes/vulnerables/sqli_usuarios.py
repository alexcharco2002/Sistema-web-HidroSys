from fastapi import APIRouter, Depends
from sqlalchemy import text
from db.session import Base

router = APIRouter(prefix="/lab", tags=["SQL Injection Lab Usuarios"])

# ⚠️ Endpoint deliberadamente vulnerable (educativo)
@router.get("/sqli_usuarios_low")
def sqli_usuarios_low(id: str, db=Depends(Base)):
    # Consulta cruda vulnerable
    query = f"""
        SELECT id_usuario_sistema, usuario, nombres, apellidos
        FROM usuarios.t_usuario_sistema
        WHERE id_usuario_sistema = {id}
    """

    result = db.execute(text(query)).fetchall()

    return {
        "query_ejecutada": query,
        "resultado": [dict(row._mapping) for row in result]
    }


# ⚠️ Nivel medium (filtro superficial, sigue vulnerable)
@router.get("/sqli_usuarios_medium")
def sqli_usuarios_medium(id: str, db=Depends(Base)):
    if not id.isdigit():
        return {"error": "Solo números permitidos"}

    query = f"""
        SELECT id_usuario_sistema, usuario, nombres, apellidos
        FROM usuarios.t_usuario_sistema
        WHERE id_usuario_sistema = {id}
    """

    result = db.execute(text(query)).fetchall()

    return {
        "query_ejecutada": query,
        "resultado": [dict(row) for row in result]
    }


# ✔ Nivel seguro (imposible)
@router.get("/sqli_usuarios_impossible")
def sqli_usuarios_impossible(id: int, db=Depends(Base)):
    query = text("""
        SELECT id_usuario_sistema, usuario, nombres, apellidos
        FROM usuarios.t_usuario_sistema
        WHERE id_usuario_sistema = :id
    """)

    result = db.execute(query, {"id": id}).fetchall()

    return {
        "query_ejecutada": str(query),
        "resultado": [dict(row) for row in result]
    }
