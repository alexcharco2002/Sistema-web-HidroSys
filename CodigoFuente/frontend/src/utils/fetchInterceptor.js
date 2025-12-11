/**
 * src/utils/fetchInterceptor.js
 * Interceptor global para fetch API - Maneja tokens expirados centralizadamente
 */

let isHandlingExpiredSession = false;

/**
 * Wrapper de fetch con interceptor automático para 401
 */
const createFetchInterceptor = () => {
  const originalFetch = window.fetch;

  window.fetch = async (...args) => {
    const [url, config = {}] = args;

    try {
      const response = await originalFetch(url, config);

      // 🔥 Interceptar respuestas 401 globalmente
      if (response.status === 401 && !isHandlingExpiredSession) {
        isHandlingExpiredSession = true;
        
        console.warn("⚠️ Token expirado detectado en interceptor global");
        
        // Limpiar datos de sesión
        sessionStorage.removeItem('auth_token');
        sessionStorage.removeItem('user_data');
        sessionStorage.removeItem('user_permissions');
        
        // Emitir evento global para SessionExpiredHandler
        window.dispatchEvent(new Event("sessionExpired"));
        
        // Resetear flag después de 2 segundos
        setTimeout(() => {
          isHandlingExpiredSession = false;
        }, 2000);
        
        // Retornar respuesta original para que el servicio también maneje el error
        return response;
      }

      return response;
      
    } catch (error) {
      // Propagar errores de red
      throw error;
    }
  };
};

/**
 * Inicializar interceptor (llamar solo UNA vez al inicio de la app)
 */
export const initializeFetchInterceptor = () => {
  createFetchInterceptor();
  console.log('✅ Fetch interceptor inicializado');
};

export default initializeFetchInterceptor;
