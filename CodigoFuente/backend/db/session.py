# db/
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

# Cargar variables del .env
load_dotenv()

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

# Validar variable obligatoria
if SQLALCHEMY_DATABASE_URL is None:
    raise ValueError("❌ ERROR: No se encontró DATABASE_URL en el archivo .env")

# Crear conexion asegurando UTF-8
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"client_encoding": "utf8"}
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

Base = declarative_base()

# 🔥 ESTA FUNCIÓN ES LA QUE TE FALTABA
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
