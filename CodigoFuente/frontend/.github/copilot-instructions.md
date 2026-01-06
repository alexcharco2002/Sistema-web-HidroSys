# Instrucciones para agentes AI (Copilot) — frontend

Propósito: Guía práctica y específica para que un agente AI sea inmediatamente productivo en este repositorio React (Create React App).

Principales comandos
- Instalación y desarrollo: `npm install` y `npm start`.
- Build producción: `npm run build`.
- Tests: `npm test` (usar `setupTests.js` para mocks/globals).

Visión general y arquitectura
- SPA basada en Create React App; código en `src/`.
- Carpetas clave: `src/components` (UI reutilizable), `src/sections` (vistas por rol/sección), `src/pages` (rutas principales), `src/services` (capa HTTP), `src/utils` (interceptores y utilidades), `src/context` (contextos globales).
- El flujo esperado: `sections` usan `services` → `fetchInterceptor.js` aplica headers/errores → `authServices` gestiona permisos y token.

Patrones y convenciones importantes (proyecto)
- Idioma: todo el código y textos deben mantenerse en español.
- Nombres de API: usar `snake_case` para payloads y nombres enviados a backend (ej. `id_usuario_sistema`).
- Capa HTTP: Todas las llamadas a la API deben ir en `src/services/*.js`. Evitar `axios`/`fetch` directamente en componentes.
- Permisos: usar `authService.hasPermission(...)` antes de mostrar acciones o cargar datos (ver [src/services/authServices.js](src/services/authServices.js)).
- Modales: patrón `modal-overlay` + `modal`; cierran detectando `e.target.className === 'modal-overlay'`.
- Estilos: cada componente tiene su propio `Component.css` junto al componente; mantener co-localización.
- Iconos: usar `lucide-react` e importar iconos por nombre (no SVGs inline).

Integraciones y dependencias destacadas
- HTTP: `axios` con `src/utils/fetchInterceptor.js` (añade auth header, manejo global de errores).
- Exportes/PDF/Excel: `jspdf`, `html2canvas`, `xlsx` / `xlsx-js-style` (ve `src/components/ReportExport.js`).
- Mapas: `leaflet` (ej.: [src/sections/general/GeolocationSection.js](src/sections/general/GeolocationSection.js)).
- Docker: hay un `Dockerfile` en la raíz para construir la imagen del frontend.

Archivos y lugares de interés (ejemplos)
- `src/sections/general/NotificationsSection.js`: uso de `notificationsService`, patrón modal y permisos.
- `src/utils/fetchInterceptor.js`: centraliza headers y errores de red.
- `src/services/*`: cada servicio es la única fuente de llamadas externas (crear aquí nuevos endpoints).
- `src/components/SessionExpiredHandler.js`: gestión de sesión/expiración.
- `src/context/ModalContext.js`: patrón de modales compartidos.

Consejos prácticos para PRs y cambios automáticos
- Cuando añadas un endpoint: crear `src/services/nuevoService.js`, exportar funciones claras, y consumir desde la `section` correspondiente.
- No cambiar la convención `snake_case` en payloads sin coordinar backend.
- Antes de exponer botones/acciones, comprobar permisos con `authService.hasPermission`.
- Para cambios visuales, crear/actualizar `Componente.css` junto al componente y mantener clases existentes.

PR checklist breve
- ¿Se usó un `service` nuevo o existente para llamadas HTTP? (sí/no)
- ¿Se mantiene español y `snake_case` para payloads?
- ¿Se añadieron pruebas mínimas cuando el cambio toca lógica importante? (usar `npm test`)
- ¿Se respetan permisos (`authService.hasPermission`)?

Limitaciones y notas para el agente
- No inventar endpoints ni cambiar contratos API. Si falta información, pedir el swagger o el backend.
- No reestructurar carpetas sin aprobación humana; cambios grandes requieren PR de revisión.

Feedback
Si algo no queda claro o quieres que añada plantillas (skeletons) para `service`, `component` o ejemplo de test, dime y lo genero.
