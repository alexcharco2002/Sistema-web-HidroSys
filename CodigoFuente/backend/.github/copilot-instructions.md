# Instrucciones para agentes AI (Copilot)

Objetivo: permitir que un agente AI sea productivo rápidamente en este backend FastAPI.

- **Arquitectura general:** Aplicación FastAPI monolítica organizada por capas:
  - Rutas: [routes](routes/) — cada archivo exporta un `APIRouter` (p.ej. `routes/lecturas.py`).
  - Modelos: [models](models/) — SQLAlchemy ORM.
  - Schemas: [schemas](schemas/) — Pydantic para validación y serialización.
  - DB: [db/session.py] y `database.py` — `SessionLocal` es la dependencia para obtener sesiones.
  - Utilidades: [utils/] — auditoría (`utils.audit_logger`), notificaciones (`utils.notifications`), facturación, backups.
  - Seguridad: [security/] — `jwt.verify_token` es la dependencia que valida el JWT y devuelve el payload.

- **Puntos de integración y dependencias externas**:
  - Base de datos: SQLAlchemy; la URL proviene de `settings.DATABASE_URL` (importado desde `config.py`).
  - Servidor: `uvicorn` se inicia desde `main.py`. Soporta HTTPS si existen `certs/cert.pem` y `certs/key.pem`.
  - Operaciones auxiliares: creación y restauración de respaldos en `utils/crear_respaldo.py` y `utils/restaurar_respaldo.py`.

- **Flujo de petición / patrones comunes**
  - Autenticación: rutas usan `payload: dict = Depends(verify_token)` para extraer el JWT; luego `get_current_user(payload, db)` busca `UsuarioSistema`.
  - Permisos: función `require_permission` / `require_any_permission` (ejemplo en `routes/lecturas.py`) — comprobar permisos antes de acciones CRUD.
  - Sesión DB: depende de `get_db()` que produce `SessionLocal()`; cerrar siempre la sesión en `finally`.
  - Auditoría y notificaciones: después de mutaciones, se llama a `registrar_auditoria(...)` y `registrar_notificacion(...)`.

- **Cómo ejecutar el proyecto localmente (descubrible en `main.py`)**
  - Desarrollo HTTP (sin certificados):

    `python main.py`

    o directamente con uvicorn:

    `uvicorn main:app --host 0.0.0.0 --port 8000 --reload`

  - HTTPS: colocar `certs/cert.pem` y `certs/key.pem` en `certs/` (hay un `openssl.cnf`); `main.py` muestra el comando `openssl req -x509 -newkey rsa:4096 -nodes -out cert.pem -keyout key.pem -days 365`.

- **Patrones y convenciones de este repositorio (específicos)**
  - Rutas devuelven diccionarios planos (no siempre Pydantic models) y usan helpers `lectura_to_response` para enriquecer la salida (ver `routes/lecturas.py`).
  - Validaciones de negocio dentro de rutas: ejemplo de evitar duplicados por mes/año usando `func.extract('month', ...)` en `routes/lecturas.py`.
  - Muchas funciones dependen del `payload['sub']` del JWT como identificador del usuario; evita reemplazar ese comportamiento.
  - Logging usuario/operación: las acciones mutantes siempre llaman a `registrar_auditoria(...)` con `id_usuario` y descripciones legibles.

- **Archivos clave para cambios frecuentes**
  - Punto de entrada: [main.py](main.py)
  - Configuración DB/Settings: [database.py](database.py) y [config.py](config.py) (espera `settings.DATABASE_URL`).
  - Rutas: [routes/](routes/) (ej.: [routes/lecturas.py](routes/lecturas.py)).
  - Modelos/Esquemas: [models/], [schemas/]
  - Seguridad: [security/jwt.py], [security/password.py]

- **Ejemplos concretos que un agente puede aplicar**
  - Añadir una nueva ruta protegida: copiar patrón de `routes/lecturas.py` — usar `payload: dict = Depends(verify_token)`, `db: Session = Depends(get_db)`, luego `current_user = get_current_user(payload, db)` y `require_permission(...)`.
  - Acceso a la sesión: usar la dependencia `get_db()` y nunca crear conexiones globales fuera de `SessionLocal()`.
  - Mutaciones seguras: después de `db.add()` → `db.commit()` → `db.refresh()` y luego llamar a `registrar_auditoria` y `registrar_notificacion` si procede.

- **No asumir**
  - `config.py` tiene contenido; `settings` puede venir de un `BaseSettings` de Pydantic pero el archivo está vacío en el repo — confirma con el mantenedor antes de modificar la configuración global.
  - No crear migraciones automáticas: no encontré migrations (alembic) en el repo; coordinar con el equipo si se requiere.

Si quieres, aplico estos puntos en un `README` más largo o adapto el archivo con ejemplos de endpoints comunes (crear/actualizar/eliminar). ¿Qué sección quieres que amplíe primero?
