# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from routes import auth
from routes import user
from routes import roles
from routes import sectors
from routes import notifications
from routes import afiliates
from routes import meters
from routes import backups
from routes import tarifas
import os

app = FastAPI(
    title="Sistema de Facturación de Agua",
    description="API para el sistema de facturación JAAP Sanjapamba",
    version="1.0.0"
)

# Configurar CORS para HTTPS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://localhost:3000",  # React dev server HTTPS
        "https://127.0.0.1:3000",
        "http://localhost:3000",   # Fallback para desarrollo
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Middleware de seguridad adicional
app.add_middleware(
    TrustedHostMiddleware, 
    allowed_hosts=["localhost", "127.0.0.1", "*.localhost"]
)

# Incluir rutas
app.include_router(auth.router)
app.include_router(user.router)
app.include_router(roles.router)
app.include_router(sectors.router)
app.include_router(notifications.router)
app.include_router(afiliates.router)
app.include_router(meters.router)
app.include_router(backups.router)
app.include_router(tarifas.router)


# Health check general
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "jaap-sanjapamba-api",
        "version": "1.0.0",
        "secure": True
    }

# Endpoint de información de la API
@app.get("/")
async def root():
    return {
        "message": "API Sistema de Facturación JAAP Sanjapamba",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
        "secure": "HTTPS Enabled"
    }

if __name__ == "__main__":
    import uvicorn
    
    # Verificar si existen los certificados
    cert_file = "certs/cert.pem"
    key_file = "certs/key.pem"
    
    if not os.path.exists(cert_file) or not os.path.exists(key_file):
        print("⚠️  ADVERTENCIA: Certificados SSL no encontrados")
        print("📝 Genera certificados con:")
        print("   mkdir certs && cd certs")
        print("   openssl req -x509 -newkey rsa:4096 -nodes -out cert.pem -keyout key.pem -days 365")
        print("\n🔄 Iniciando en modo HTTP...")
        
        uvicorn.run(
            "main:app", 
            host="0.0.0.0", 
            port=8000, 
            reload=True,
            log_level="info"
        )
    else:
        print("🔒 Iniciando servidor HTTPS...")
        print("📍 URL: https://localhost:8000")
        print("📚 Docs: https://localhost:8000/docs")
        
        uvicorn.run(
            "main:app", 
            host="0.0.0.0", 
            port=8000,
            reload=True,
            log_level="info",
            ssl_keyfile=key_file,
            ssl_certfile=cert_file,
            ssl_keyfile_password=None
        )