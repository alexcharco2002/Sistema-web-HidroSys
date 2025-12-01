/**
 * src/services/serviciosServices.js
 * Servicio de Gestión de Servicios Adicionales
 * Tabla: t_servicios
 */

import authService from './authServices';

const API_CONFIG = {
  baseURL: 'https://localhost:8000',
  endpoints: {
    servicios: '/servicios',
    toggleStatus: (id) => `/servicios/${id}/toggle-status`,
  }
};

class ServiciosService {
  constructor() {
    this.cachedServicios = null;
  }

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
      timeout: 10000,
    };

    const finalOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers,
      },
    };

    // Manejar FormData y JSON
    if (finalOptions.body instanceof FormData) {
      delete finalOptions.headers['Content-Type'];
    } else if (finalOptions.body && typeof finalOptions.body === 'object') {
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

  /**
   * Obtener lista de servicios
   */
  async getServicios(filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.activo !== undefined) params.append('activo', filters.activo);
      if (filters.skip) params.append('skip', filters.skip);
      if (filters.limit) params.append('limit', filters.limit);

      const queryString = params.toString();
      const endpoint = queryString 
        ? `${API_CONFIG.endpoints.servicios}?${queryString}`
        : API_CONFIG.endpoints.servicios;

      const data = await this.makeRequest(endpoint);

      // Actualizar caché
      this.cachedServicios = data;

      return {
        success: true,
        data: data
      };

    } catch (error) {
      console.error('❌ Error obteniendo servicios:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener servicios'
      };
    }
  }

  /**
   * Obtener un servicio por ID
   */
  async getServicioById(servicioId) {
    try {
      const data = await this.makeRequest(`${API_CONFIG.endpoints.servicios}/${servicioId}`);
      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error('❌ Error obteniendo servicio:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener servicio'
      };
    }
  }

  /**
   * Crear un nuevo servicio
   */
  async createServicio(servicioData) {
    try {
      this.validateServicioData(servicioData, true);

      const data = await this.makeRequest(API_CONFIG.endpoints.servicios, {
        method: 'POST',
        body: {
          nombre: servicioData.nombre.trim(),
          descripcion: servicioData.descripcion?.trim() || null,
          precio_base: parseFloat(servicioData.precio_base),
          activo: servicioData.activo !== undefined ? servicioData.activo : true
        }
      });

      // Limpiar caché
      this.cachedServicios = null;

      return {
        success: true,
        data: data,
        message: 'Servicio creado exitosamente'
      };

    } catch (error) {
      console.error('❌ Error creando servicio:', error);
      let cleanMessage = 'Error al crear el servicio';

      const detail = error.response?.data?.detail;
      if (Array.isArray(detail) && detail[0]?.msg) {
        cleanMessage = detail[0].msg;
      }
      else if (typeof detail === 'string') {
        cleanMessage = detail;
      }
      else if (error.message) {
        cleanMessage = error.message.replace(/^Value error,\s*/i, '');
      }

      return {
        success: false,
        message: cleanMessage
      };
    }
  }

  /**
   * Actualizar un servicio existente
   */
  async updateServicio(servicioId, servicioData) {
    if (!servicioId || isNaN(servicioId)) {
      throw new Error('ID de servicio inválido o no definido');
    }

    try {
      this.validateServicioData(servicioData, false);

      const updateData = {};
      if (servicioData.nombre) updateData.nombre = servicioData.nombre.trim();
      if (servicioData.descripcion !== undefined) updateData.descripcion = servicioData.descripcion?.trim() || null;
      if (servicioData.precio_base !== undefined) updateData.precio_base = parseFloat(servicioData.precio_base);
      if (servicioData.activo !== undefined) updateData.activo = servicioData.activo;

      const data = await this.makeRequest(`${API_CONFIG.endpoints.servicios}/${servicioId}`, {
        method: 'PUT',
        body: updateData,
      });

      // Limpiar caché
      this.cachedServicios = null;

      return {
        success: true,
        data: data,
        message: 'Servicio actualizado exitosamente'
      };

    } catch (error) {
      console.error('❌ Error actualizando servicio:', error);
      return {
        success: false,
        message: error.message || 'Error al actualizar servicio'
      };
    }
  }

  /**
   * Eliminar un servicio
   */
  async deleteServicio(servicioId) {
    try {
      const response = await this.makeRequest(`${API_CONFIG.endpoints.servicios}/${servicioId}`, {
        method: 'DELETE'
      });

      // Limpiar caché
      this.cachedServicios = null;

      if (response && response.success === false) {
        return {
          success: false,
          message: response.message || 'No se pudo eliminar el servicio.',
          accion: response.accion || 'no_eliminado'
        };
      }

      return {
        success: true,
        message: response.message || 'Servicio eliminado correctamente.',
        accion: response.accion || 'eliminado'
      };

    } catch (error) {
      console.error('❌ Error eliminando servicio:', error);
      return {
        success: false,
        message: error.message || 'Error al eliminar servicio'
      };
    }
  }

  /**
   * Activar/Desactivar servicio
   */
  async toggleServicioStatus(servicioId) {
    try {
      const data = await this.makeRequest(API_CONFIG.endpoints.toggleStatus(servicioId), {
        method: 'PATCH'
      });

      // Limpiar caché
      this.cachedServicios = null;

      return {
        success: true,
        data: data,
        message: 'Estado del servicio actualizado'
      };

    } catch (error) {
      console.error('❌ Error cambiando estado:', error);
      return {
        success: false,
        message: error.message || 'Error al cambiar estado del servicio'
      };
    }
  }

  /**
   * Validar datos de servicio
   */
  validateServicioData(servicioData, required = true) {
    if (required) {
      if (!servicioData.nombre || servicioData.nombre.trim().length < 3) {
        throw new Error('El nombre del servicio debe tener al menos 3 caracteres');
      }

      if (!servicioData.precio_base || parseFloat(servicioData.precio_base) < 0) {
        throw new Error('El precio base debe ser mayor o igual a 0');
      }
    } else {
      if (servicioData.nombre && servicioData.nombre.trim().length < 3) {
        throw new Error('El nombre del servicio debe tener al menos 3 caracteres');
      }

      if (servicioData.precio_base !== undefined && parseFloat(servicioData.precio_base) < 0) {
        throw new Error('El precio base debe ser mayor o igual a 0');
      }
    }
  }

  /**
   * Obtener estadísticas de servicios
   */
  async getServicioStats() {
    try {
      const result = await this.getServicios();

      if (!result.success) {
        return result;
      }

      const servicios = result.data;

      return {
        success: true,
        data: {
          total: servicios.length,
          activos: servicios.filter(s => s.activo).length,
          inactivos: servicios.filter(s => !s.activo).length,
        }
      };

    } catch (error) {
      console.error('❌ Error obteniendo estadísticas:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener estadísticas'
      };
    }
  }

  /**
   * Obtener servicios desde caché (útil para selects)
   */
  getCachedServicios() {
    return this.cachedServicios || [];
  }

  /**
   * Limpiar caché de servicios
   */
  clearCache() {
    this.cachedServicios = null;
  }
}

const serviciosService = new ServiciosService();

export default serviciosService;
export { ServiciosService };
