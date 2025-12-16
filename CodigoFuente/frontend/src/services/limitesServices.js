/**
 * src/services/limitesServices.js
 * Servicio de Gestión de Límites Geográficos
 */

import authService from './authServices';

const API_CONFIG = {
  baseURL: 'https://localhost:8000',
  endpoints: {
    list: '/limites-geograficos/', // GET
    getById: (id) => `/limites-geograficos/${id}`, // GET
    getActive: '/limites-geograficos/activo', // GET
    create: '/limites-geograficos/', // POST
    update: (id) => `/limites-geograficos/${id}`, // PUT
    delete: (id) => `/limites-geograficos/${id}`, // DELETE
    activate: (id) => `/limites-geograficos/${id}/activar`, // POST
    validateCoords: '/limites-geograficos/validar-coordenadas', // POST
  }
};

class LimitesService {
  /**
   * Realizar petición HTTPS con configuración común
   */
/**
 * Realizar petición HTTPS con configuración común
 */
  async makeRequest(endpoint, options = {}) {
    const url = `${API_CONFIG.baseURL}${endpoint}`;
    
    const defaultOptions = {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${authService.getToken()}`
      },
      timeout: 15000, // 15 segundos
    };

    const finalOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers,
      },
    };
    
    // Manejar JSON
    if (finalOptions.body && typeof finalOptions.body === 'object') {
      finalOptions.headers['Content-Type'] = 'application/json';
      finalOptions.body = JSON.stringify(finalOptions.body);
    }

    try {
      console.log(`🌐 API Request: ${finalOptions.method} ${url}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), finalOptions.timeout);

      const response = await fetch(url, {
        ...finalOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // ✅ Manejar 204 No Content (sin body) - DEBE IR ANTES de response.ok
      if (response.status === 204) {
        console.log(`✅ API Response: 204 No Content`);
        return null;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let errorMessage = '';
        
        if (typeof errorData.detail === 'string') {
          errorMessage = errorData.detail;
        } else if (Array.isArray(errorData.detail)) {
          errorMessage = errorData.detail.map(err => err.msg).join(', ');
        } else if (typeof errorData.detail === 'object') {
          errorMessage = JSON.stringify(errorData.detail);
        } else {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log(`✅ API Response:`, data);
      return data;
      
    } catch (error) {
      console.error(`❌ API Error:`, error);
      
      if (error.name === 'AbortError') {
        throw new Error('La petición tardó demasiado tiempo');
      }
      
      if (error.message.includes('Failed to fetch')) {
        throw new Error('No se pudo conectar con el servidor');
      }
      
      throw error;
    }
  }


  // ========================================
  // GESTIÓN DE LÍMITES GEOGRÁFICOS
  // ========================================

  /**
   * Listar todos los límites geográficos
   */
  async listLimites(params = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.skip !== undefined) queryParams.append('skip', params.skip);
      if (params.limit !== undefined) queryParams.append('limit', params.limit);
      if (params.activo !== undefined) queryParams.append('activo', params.activo);
      
      const queryString = queryParams.toString();
      const endpoint = queryString ? `${API_CONFIG.endpoints.list}?${queryString}` : API_CONFIG.endpoints.list;
      
      const data = await this.makeRequest(endpoint);
      
      return {
        success: true,
        data: Array.isArray(data) ? data : []
      };
    } catch (error) {
      console.error('❌ Error listando límites:', error);
      return {
        success: false,
        message: error.message || 'Error al listar límites geográficos',
        data: []
      };
    }
  }

  /**
   * Obtener un límite por ID
   */
  async getLimiteById(id) {
    try {
      const data = await this.makeRequest(API_CONFIG.endpoints.getById(id));
      
      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error('❌ Error obteniendo límite:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener el límite geográfico'
      };
    }
  }

  /**
   * Obtener el límite activo
   */
  async getActiveLimite() {
    try {
      const data = await this.makeRequest(API_CONFIG.endpoints.getActive);
      
      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error('❌ Error obteniendo límite activo:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener el límite activo'
      };
    }
  }

  /**
   * Crear un nuevo límite geográfico
   */
  async createLimite(limiteData) {
    try {
      this.validateLimiteData(limiteData);
      
      const data = await this.makeRequest(
        API_CONFIG.endpoints.create,
        {
          method: 'POST',
          body: limiteData
        }
      );
      
      return {
        success: true,
        message: 'Límite geográfico creado exitosamente',
        data: data
      };
    } catch (error) {
      console.error('❌ Error creando límite:', error);
      return {
        success: false,
        message: error.message || 'Error al crear el límite geográfico'
      };
    }
  }

  /**
   * Actualizar un límite geográfico
   */
  async updateLimite(id, limiteData) {
    try {
      const data = await this.makeRequest(
        API_CONFIG.endpoints.update(id),
        {
          method: 'PUT',
          body: limiteData
        }
      );
      
      return {
        success: true,
        message: 'Límite geográfico actualizado exitosamente',
        data: data
      };
    } catch (error) {
      console.error('❌ Error actualizando límite:', error);
      return {
        success: false,
        message: error.message || 'Error al actualizar el límite geográfico'
      };
    }
  }

  /**
   * Eliminar un límite geográfico
   */
  async deleteLimite(id) {
    try {
      await this.makeRequest(
        API_CONFIG.endpoints.delete(id),
        {
          method: 'DELETE'
        }
      );
      
      return {
        success: true,
        message: 'Límite geográfico eliminado exitosamente'
      };
    } catch (error) {
      console.error('❌ Error eliminando límite:', error);
      return {
        success: false,
        message: error.message || 'Error al eliminar el límite geográfico'
      };
    }
  }

  /**
   * Activar un límite geográfico
   */
  async activateLimite(id) {
    try {
      const data = await this.makeRequest(
        API_CONFIG.endpoints.activate(id),
        {
          method: 'POST'
        }
      );
      
      return {
        success: true,
        message: 'Límite geográfico activado exitosamente',
        data: data
      };
    } catch (error) {
      console.error('❌ Error activando límite:', error);
      return {
        success: false,
        message: error.message || 'Error al activar el límite geográfico'
      };
    }
  }

  /**
   * Validar coordenadas contra el límite activo
   */
  async validateCoordenadas(coordenada) {
    try {
      const data = await this.makeRequest(
        API_CONFIG.endpoints.validateCoords,
        {
          method: 'POST',
          body: coordenada
        }
      );
      
      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error('❌ Error validando coordenadas:', error);
      return {
        success: false,
        message: error.message || 'Error al validar las coordenadas'
      };
    }
  }

  /**
   * Validar datos del límite
   */
  validateLimiteData(limiteData) {
    if (!limiteData.nombre || limiteData.nombre.trim() === '') {
      throw new Error('El nombre del límite es requerido');
    }

    if (limiteData.norte === undefined || limiteData.norte === null) {
      throw new Error('El límite norte es requerido');
    }

    if (limiteData.sur === undefined || limiteData.sur === null) {
      throw new Error('El límite sur es requerido');
    }

    if (limiteData.este === undefined || limiteData.este === null) {
      throw new Error('El límite este es requerido');
    }

    if (limiteData.oeste === undefined || limiteData.oeste === null) {
      throw new Error('El límite oeste es requerido');
    }

    // Validaciones de rangos
    if (limiteData.norte < -90 || limiteData.norte > 90) {
      throw new Error('El límite norte debe estar entre -90 y 90');
    }

    if (limiteData.sur < -90 || limiteData.sur > 90) {
      throw new Error('El límite sur debe estar entre -90 y 90');
    }

    if (limiteData.este < -180 || limiteData.este > 180) {
      throw new Error('El límite este debe estar entre -180 y 180');
    }

    if (limiteData.oeste < -180 || limiteData.oeste > 180) {
      throw new Error('El límite oeste debe estar entre -180 y 180');
    }

    // Validaciones lógicas
    if (limiteData.norte <= limiteData.sur) {
      throw new Error('El límite norte debe ser mayor que el límite sur');
    }

    if (limiteData.este <= limiteData.oeste) {
      throw new Error('El límite este debe ser mayor que el límite oeste');
    }

    // Validar altitudes si están presentes
    if (limiteData.altitud_min !== undefined && limiteData.altitud_min !== null) {
      if (limiteData.altitud_min < 0) {
        throw new Error('La altitud mínima debe ser mayor o igual a 0');
      }
    }

    if (limiteData.altitud_max !== undefined && limiteData.altitud_max !== null) {
      if (limiteData.altitud_max < 0) {
        throw new Error('La altitud máxima debe ser mayor o igual a 0');
      }

      if (limiteData.altitud_min !== undefined && limiteData.altitud_min !== null) {
        if (limiteData.altitud_max <= limiteData.altitud_min) {
          throw new Error('La altitud máxima debe ser mayor que la altitud mínima');
        }
      }
    }
  }

  /**
   * Formatear coordenadas para mostrar
   */
  formatCoordinate(value, type = 'lat') {
    if (value === undefined || value === null) return 'N/A';
    
    const absValue = Math.abs(value);
    const degrees = Math.floor(absValue);
    const minutes = Math.floor((absValue - degrees) * 60);
    const seconds = ((absValue - degrees - minutes / 60) * 3600).toFixed(2);
    
    let direction = '';
    if (type === 'lat') {
      direction = value >= 0 ? 'N' : 'S';
    } else {
      direction = value >= 0 ? 'E' : 'O';
    }
    
    return `${degrees}° ${minutes}' ${seconds}" ${direction}`;
  }
}

const limitesService = new LimitesService();
export default limitesService;
export { LimitesService };
