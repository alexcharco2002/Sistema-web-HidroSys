/**
 * src/services/tarifasServices.js
 * Servicio de Gestión de Tarifas
 * Tabla: t_tarifa
 */

import authService from './authServices';

const API_CONFIG = {
  baseURL: 'https://localhost:8000',
  endpoints: {
    tarifas: '/tarifas',
    toggleStatus: (id) => `/tarifas/${id}/toggle-status`,
  }
};

class TarifasService {
  constructor() {
    this.cachedTarifas = null;
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
   * Obtener lista de tarifas
   */
  async getTarifas(filters = {}) {
    try {
      const params = new URLSearchParams();
      
      if (filters.search) params.append('search', filters.search);
      if (filters.tipo_tarifa) params.append('tipo_tarifa', filters.tipo_tarifa);
      if (filters.activo !== undefined) params.append('activo', filters.activo);
      if (filters.skip) params.append('skip', filters.skip);
      if (filters.limit) params.append('limit', filters.limit);

      const queryString = params.toString();
      const endpoint = queryString 
        ? `${API_CONFIG.endpoints.tarifas}?${queryString}` 
        : API_CONFIG.endpoints.tarifas;

      const data = await this.makeRequest(endpoint);

      // Actualizar caché
      this.cachedTarifas = data;

      return {
        success: true,
        data: data
      };

    } catch (error) {
      console.error('❌ Error obteniendo tarifas:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener tarifas'
      };
    }
  }

  /**
   * Obtener una tarifa por ID
   */
  async getTarifaById(tarifaId) {
    try {
      const data = await this.makeRequest(`${API_CONFIG.endpoints.tarifas}/${tarifaId}`);

      return {
        success: true,
        data: data
      };

    } catch (error) {
      console.error('❌ Error obteniendo tarifa:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener tarifa'
      };
    }
  }

  /**
   * Crear una nueva tarifa
   */
  async createTarifa(tarifaData) {
    try {
      this.validateTarifaData(tarifaData, true);

      const data = await this.makeRequest(API_CONFIG.endpoints.tarifas, {
        method: 'POST',
        body: {
          nombre: tarifaData.nombre.trim(),
          detalle: tarifaData.detalle?.trim() || null,
          precio_por_m3: parseFloat(tarifaData.precio_por_m3),
          limite_min_m3: parseFloat(tarifaData.limite_min_m3),
          limite_max_m3: tarifaData.limite_max_m3 ? parseFloat(tarifaData.limite_max_m3) : null,
          tipo_tarifa: tarifaData.tipo_tarifa.trim(),
          activo: tarifaData.activo !== undefined ? tarifaData.activo : true
        }
      });

      // Limpiar caché
      this.cachedTarifas = null;

      return {
        success: true,
        data: data,
        message: 'Tarifa creada exitosamente'
      };

    } catch (error) {
      console.error('❌ Error creando tarifa:', error);

      let cleanMessage = 'Error al crear la tarifa';

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
   * Actualizar una tarifa existente
   */
  async updateTarifa(tarifaId, tarifaData) {
    if (!tarifaId || isNaN(tarifaId)) {
      throw new Error('ID de tarifa inválido o no definido');
    }

    try {
      this.validateTarifaData(tarifaData, false);

      const updateData = {};
      
      if (tarifaData.nombre) updateData.nombre = tarifaData.nombre.trim();
      if (tarifaData.detalle !== undefined) updateData.detalle = tarifaData.detalle?.trim() || null;
      if (tarifaData.precio_por_m3 !== undefined) updateData.precio_por_m3 = parseFloat(tarifaData.precio_por_m3);
      if (tarifaData.limite_min_m3 !== undefined) updateData.limite_min_m3 = parseFloat(tarifaData.limite_min_m3);
      if (tarifaData.limite_max_m3 !== undefined) {
        updateData.limite_max_m3 = tarifaData.limite_max_m3 ? parseFloat(tarifaData.limite_max_m3) : null;
      }
      if (tarifaData.tipo_tarifa) updateData.tipo_tarifa = tarifaData.tipo_tarifa.trim();
      if (tarifaData.activo !== undefined) updateData.activo = tarifaData.activo;

      const data = await this.makeRequest(`${API_CONFIG.endpoints.tarifas}/${tarifaId}`, {
        method: 'PUT',
        body: updateData,
      });

      // Limpiar caché
      this.cachedTarifas = null;

      return {
        success: true,
        data: data,
        message: 'Tarifa actualizada exitosamente'
      };

    } catch (error) {
      console.error('❌ Error actualizando tarifa:', error);
      return {
        success: false,
        message: error.message || 'Error al actualizar tarifa'
      };
    }
  }

  /**
   * Eliminar una tarifa
   */
  async deleteTarifa(tarifaId) {
    try {
      const response = await this.makeRequest(`${API_CONFIG.endpoints.tarifas}/${tarifaId}`, {
        method: 'DELETE'
      });

      // Limpiar caché
      this.cachedTarifas = null;

      if (response && response.success === false) {
        return {
          success: false,
          message: response.message || 'No se pudo eliminar la tarifa.',
          accion: response.accion || 'no_eliminado'
        };
      }

      return {
        success: true,
        message: response.message || 'Tarifa eliminada correctamente.',
        accion: response.accion || 'eliminado'
      };

    } catch (error) {
      console.error('❌ Error eliminando tarifa:', error);

      return {
        success: false,
        message: error.message || 'Error al eliminar tarifa'
      };
    }
  }

  /**
   * Activar/Desactivar tarifa
   */
  async toggleTarifaStatus(tarifaId) {
    try {
      const data = await this.makeRequest(API_CONFIG.endpoints.toggleStatus(tarifaId), {
        method: 'PATCH'
      });

      // Limpiar caché
      this.cachedTarifas = null;

      return {
        success: true,
        data: data,
        message: 'Estado de la tarifa actualizado'
      };

    } catch (error) {
      console.error('❌ Error cambiando estado:', error);
      return {
        success: false,
        message: error.message || 'Error al cambiar estado de la tarifa'
      };
    }
  }

  /**
   * Validar datos de tarifa
   */
  validateTarifaData(tarifaData, required = true) {
    if (required) {
      if (!tarifaData.nombre || tarifaData.nombre.trim().length < 3) {
        throw new Error('El nombre de la tarifa debe tener al menos 3 caracteres');
      }
      if (!tarifaData.tipo_tarifa || tarifaData.tipo_tarifa.trim().length < 2) {
        throw new Error('El tipo de tarifa es requerido');
      }
      if (!tarifaData.precio_por_m3 || parseFloat(tarifaData.precio_por_m3) < 0) {
        throw new Error('El precio por m³ debe ser mayor o igual a 0');
      }
      if (tarifaData.limite_min_m3 === undefined || parseFloat(tarifaData.limite_min_m3) < 0) {
        throw new Error('El límite mínimo debe ser mayor o igual a 0');
      }
      if (tarifaData.limite_max_m3 && parseFloat(tarifaData.limite_max_m3) <= parseFloat(tarifaData.limite_min_m3)) {
        throw new Error('El límite máximo debe ser mayor que el límite mínimo');
      }
    } else {
      if (tarifaData.nombre && tarifaData.nombre.trim().length < 3) {
        throw new Error('El nombre de la tarifa debe tener al menos 3 caracteres');
      }
      if (tarifaData.precio_por_m3 !== undefined && parseFloat(tarifaData.precio_por_m3) < 0) {
        throw new Error('El precio por m³ debe ser mayor o igual a 0');
      }
      if (tarifaData.limite_min_m3 !== undefined && parseFloat(tarifaData.limite_min_m3) < 0) {
        throw new Error('El límite mínimo debe ser mayor o igual a 0');
      }
      if (tarifaData.limite_max_m3 && tarifaData.limite_min_m3 && 
          parseFloat(tarifaData.limite_max_m3) <= parseFloat(tarifaData.limite_min_m3)) {
        throw new Error('El límite máximo debe ser mayor que el límite mínimo');
      }
    }
  }

  /**
   * Obtener estadísticas de tarifas
   */
  async getTarifaStats() {
    try {
      const result = await this.getTarifas();
      
      if (!result.success) {
        return result;
      }

      const tarifas = result.data;
      const tiposTarifa = [...new Set(tarifas.map(t => t.tipo_tarifa))];

      return {
        success: true,
        data: {
          total: tarifas.length,
          activos: tarifas.filter(t => t.activo).length,
          inactivos: tarifas.filter(t => !t.activo).length,
          tipos: tiposTarifa.length,
          tiposTarifa: tiposTarifa
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
   * Obtener tarifas por tipo
   */
  async getTarifasByTipo(tipoTarifa) {
    try {
      const result = await this.getTarifas({ tipo_tarifa: tipoTarifa });
      return result;
    } catch (error) {
      console.error('❌ Error obteniendo tarifas por tipo:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener tarifas por tipo'
      };
    }
  }

  /**
   * Obtener tarifas desde caché (útil para selects)
   */
  getCachedTarifas() {
    return this.cachedTarifas || [];
  }

  /**
   * Limpiar caché de tarifas
   */
  clearCache() {
    this.cachedTarifas = null;
  }
}

const tarifasService = new TarifasService();

export default tarifasService;
export { TarifasService };