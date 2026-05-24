/**
 * src/services/serviciosServices.js
 * Servicio de Gestión de Servicios Adicionales con Versionamiento
 * Tabla: t_servicios
 */

import authService from './authServices';

const API_CONFIG = {
baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
  endpoints: {
    servicios: '/servicios',
    toggleStatus: (id) => `/servicios/${id}/toggle-status`,
    historial: (nombre) => `/servicios/${nombre}/historial`,
    editarBase: (id) => `/servicios/${id}/editar`,
    actualizarPrecio: (id) => `/servicios/${id}/precio`,
    stats: '/servicios/stats/count',
    activos: '/servicios/activos/list'
  }
};

class ServiciosService {
  constructor() {
    this.cachedServicios = null;
    this.cachedStats = null;
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
      return data;

    } catch (error) {
      console.error('Error en solicitud de servicios:', error);
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
   * Obtener lista de servicios con filtros de vigencia
   */
  async getServicios(filters = {}) {
    try {
      const params = new URLSearchParams();
      
      if (filters.search) params.append('search', filters.search);
      if (filters.activo !== undefined) params.append('activo', filters.activo);
      if (filters.solo_vigentes !== undefined) params.append('solo_vigentes', filters.solo_vigentes);
      if (filters.skip) params.append('skip', filters.skip);
      if (filters.limit) params.append('limit', filters.limit);

      const queryString = params.toString();
      const endpoint = queryString 
        ? `${API_CONFIG.endpoints.servicios}?${queryString}`
        : API_CONFIG.endpoints.servicios;

      const data = await this.makeRequest(endpoint);

      this.cachedServicios = data;

      return {
        success: true,
        data: data
      };

    } catch (error) {
      console.error('Error al obtener servicios:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener servicios'
      };
    }
  }

  /**
   * Obtener historial de versiones de un servicio
   */
  async getHistorialServicio(nombreServicio) {
    try {
      const data = await this.makeRequest(API_CONFIG.endpoints.historial(nombreServicio));

      return {
        success: true,
        data: data
      };

    } catch (error) {
      console.error('Error al obtener historial del servicio:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener historial del servicio'
      };
    }
  }

  /**
   * Obtener estadísticas de servicios
   */
  async getServicioStats() {
    try {
      const data = await this.makeRequest(API_CONFIG.endpoints.stats);

      this.cachedStats = data;

      return {
        success: true,
        data: data
      };

    } catch (error) {
      console.error('Error al obtener estadisticas de servicios:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener estadísticas'
      };
    }
  }

  /**
   * Obtener solo servicios activos y vigentes (para dropdowns)
   */
  async getServiciosActivos() {
    try {
      const data = await this.makeRequest(API_CONFIG.endpoints.activos);

      return {
        success: true,
        data: data
      };

    } catch (error) {
      console.error('Error al obtener servicios activos:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener servicios activos'
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
      console.error('Error al obtener servicio:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener servicio'
      };
    }
  }

  /**
   * Crear un nuevo servicio (primera versión)
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

      this.clearCache();

      return {
        success: true,
        data: data,
        message: 'Servicio creado exitosamente'
      };

    } catch (error) {
      console.error('Error al crear servicio:', error);
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
   * Actualizar precio del servicio (crea nueva versión)
   */
  async updatePrecioServicio(servicioId, nuevoPrecio) {
    if (!servicioId || isNaN(servicioId)) {
      throw new Error('ID de servicio inválido o no definido');
    }

    try {
      if (nuevoPrecio === undefined || parseFloat(nuevoPrecio) < 0) {
        throw new Error('El precio debe ser mayor o igual a 0');
      }

      const data = await this.makeRequest(API_CONFIG.endpoints.actualizarPrecio(servicioId), {
        method: 'PUT',
        body: {
          precio_base: parseFloat(nuevoPrecio)
        },
      });

      this.clearCache();

      return {
        success: true,
        data: data,
        message: 'Nueva versión de servicio creada con nuevo precio'
      };

    } catch (error) {
      console.error('Error al actualizar precio del servicio:', error);
      return {
        success: false,
        message: error.message || 'Error al actualizar precio del servicio'
      };
    }
  }

  /**
   * Editar información base del servicio (nombre, descripción, estado)
   * NO crea nueva versión, solo actualiza la versión vigente
   */
  async editarServicioBase(servicioId, servicioData) {
    if (!servicioId || isNaN(servicioId)) {
      throw new Error('ID de servicio inválido o no definido');
    }

    try {
      const updateData = {};
      
      if (servicioData.nombre) updateData.nombre = servicioData.nombre.trim();
      if (servicioData.descripcion !== undefined) {
        updateData.descripcion = servicioData.descripcion?.trim() || null;
      }
      if (servicioData.activo !== undefined) updateData.activo = servicioData.activo;

      const data = await this.makeRequest(API_CONFIG.endpoints.editarBase(servicioId), {
        method: 'PATCH',
        body: updateData,
      });

      this.clearCache();

      return {
        success: true,
        data: data,
        message: 'Servicio actualizado exitosamente'
      };

    } catch (error) {
      console.error('Error al editar servicio:', error);
      return {
        success: false,
        message: error.message || 'Error al editar servicio'
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

      this.clearCache();

      return {
        success: true,
        data: data,
        message: 'Estado del servicio actualizado'
      };

    } catch (error) {
      console.error('Error al cambiar estado del servicio:', error);
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
 * Eliminar un servicio
 */
  async deleteServicio(servicioId) {
    try {
      const response = await this.makeRequest(
        `${API_CONFIG.endpoints.servicios}/${servicioId}`,
        {
          method: 'DELETE'
        }
      );

      this.clearCache();

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
      console.error('Error al eliminar servicio:', error);

      return {
        success: false,
        message: error.message || 'Error al eliminar servicio'
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
    this.cachedStats = null;
  }
}

const serviciosService = new ServiciosService();

export default serviciosService;
export { ServiciosService };
