"""
main.py

Punto de entrada principal de la aplicación FastAPI
Configuración de middleware, routers y eventos de ciclo de vida
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from contextlib import asynccontextmanager
import logging
import os

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ========================================
# EVENTOS DE CICLO DE VIDA
# ========================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Maneja eventos de inicio y cierre de la aplicación
    """
    # 🚀 STARTUP
    logger.info("=" * 60)
    logger.info("🚀 Iniciando HidroSys API v1.0.0")
    logger.info("=" * 60)
    
    try:
        # Iniciar sistema de backups automáticos
        from services.scheduler_service import scheduler_service
        scheduler_service.iniciar()
        
        # Verificar salud del sistema de backups
        from services.backup_service import backup_service
        salud = backup_service.verificar_salud()
        
        if not salud["healthy"]:
            logger.warning("⚠️ Sistema de backups con problemas:")
            for problema in salud["problemas"]:
                logger.warning(f"   • {problema}")
        
        logger.info("✅ Aplicación iniciada correctamente")
        logger.info("=" * 60)
        
    except Exception as e:
        logger.error(f"❌ Error al iniciar servicios: {e}")
    
    yield  # La aplicación está corriendo
    
    # 🛑 SHUTDOWN
    logger.info("=" * 60)
    logger.info("🛑 Cerrando aplicación...")
    
    try:
        from services.scheduler_service import scheduler_service
        scheduler_service.detener()
        logger.info("✅ Servicios detenidos correctamente")
    except Exception as e:
        logger.error(f"❌ Error al detener servicios: {e}")
    
    logger.info("=" * 60)

# ========================================
# CREAR APLICACIÓN FASTAPI
# ========================================

app = FastAPI(
    title="HidroSys - Sistema de Facturación de Agua",
    description="API REST para el sistema de facturación JAAP Sanjapamba",
    version="1.0.0",
    lifespan=lifespan,  # ✅ Integrar eventos de ciclo de vida
    docs_url="/docs",
    redoc_url="/redoc"
)

# ========================================
# CONFIGURAR MIDDLEWARE
# ========================================

# CORS para desarrollo
import os

# Obtener orígenes permitidos desde variable de entorno o usar valores por defecto
allowed_origins = [
    origin.strip().rstrip("/")
    for origin in os.getenv(
    "ALLOWED_ORIGINS",
    "https://localhost:3000,http://localhost:3000,https://hidrosyssanjapamba.netlify.app,https://tecnicobrosanjapamba.netlify.app"
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,

    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Seguridad adicional
#app.add_middleware(
  #  TrustedHostMiddleware,
  #  allowed_hosts=["localhost", "127.0.0.1", "*.localhost"]
#)

# ========================================
# INCLUIR ROUTERS
# ========================================

from routes import (
    auth, user, roles, sectors, notifications,
    afiliates, meters, backups, tarifas, servicios,
    lecturas, multas, multas_afiliados, limite_geografico,
    iva, facturas, pagos, reports, affiliate_billing,
    afiliatesGeneral, mora, servicio_permanente, geolocation as geo_router
)
from routes.test_sqli import router as sqli_router

import os
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()


# Routers principales
app.include_router(auth.router)
app.include_router(user.router)
app.include_router(roles.router)
app.include_router(sectors.router)
app.include_router(notifications.router)
app.include_router(afiliates.router)
app.include_router(meters.router)
app.include_router(backups.router)
app.include_router(tarifas.router)
app.include_router(servicios.router)
app.include_router(lecturas.router)
app.include_router(multas.router)
app.include_router(multas_afiliados.router)
app.include_router(limite_geografico.router)
app.include_router(iva.router)
app.include_router(facturas.router)
app.include_router(pagos.router)
app.include_router(reports.router)
app.include_router(affiliate_billing.router)
app.include_router(afiliatesGeneral.router)
app.include_router(mora.router)
app.include_router(servicio_permanente.router)
app.include_router(geo_router.router)
# Router de pruebas (solo desarrollo)
if os.getenv("ENVIRONMENT", "development") == "development":
    app.include_router(sqli_router, prefix="/test")

# ========================================
# ENDPOINTS RAÍZ
# ========================================

@app.get("/")
async def root():
    """Endpoint raíz con información de la API"""
    return {
        "message": "HidroSys - API Sistema de Facturación JAAP Sanjapamba",
        "version": "1.0.0",
        "status": "online",
        "docs": "/docs",
        "health": "/health",
        "secure": "HTTPS Enabled"
    }

@app.get("/health")
async def health_check():
    """Health check detallado de la aplicación"""
    from services.scheduler_service import scheduler_service
    from services.backup_service import backup_service
    
    # Estado del scheduler
    scheduler_status = scheduler_service.obtener_estado()
    
    # Estado de backups
    backup_stats = backup_service.obtener_estadisticas()
    backup_health = backup_service.verificar_salud()
    
    return {
        "status": "healthy",
        "service": "HidroSys-api",
        "version": "1.0.0",
        "secure": True,
        "scheduler": scheduler_status,
        "backups": {
            "total": backup_stats.get("total_backups", 0),
            "healthy": backup_health.get("healthy", False),
            "ultimo_backup": backup_stats.get("ultimo_backup")
        }
    }

# ========================================
# EJECUCIÓN DIRECTA
# ========================================

if __name__ == "__main__":
    import uvicorn
    
    # Usar puerto de Render o 8000 por defecto
    port = int(os.getenv("PORT", 8000))
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=False,  # NO reload en producción
        log_level="info"
    )
