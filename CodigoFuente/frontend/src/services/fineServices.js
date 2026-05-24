// src/services/fineServices.js
// Servicio de Gestión de Tipos de Multa con Versionamiento
// Tabla: multas.t_multa

import authService from './authServices';

const API_CONFIG = {
baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
  endpoints: {
    tiposMulta: '/multas/tipos/', // ✅ CON /
    stats: '/multas/tipos/stats/count',
    historial: (nombre) =>
      `/multas/tipos/historial/${encodeURIComponent(nombre)}`,
    toggleStatus: (id) =>
      `/multas/tipos/${id}/toggle-status`,
  },
};


class MultasService {
  constructor() {
    this.cachedTiposMulta = null;
    this.cachedStats = null;
  }

  // Petición genérica
  async makeRequest(endpoint, options = {}) {
    const url = `${API_CONFIG.baseURL}${endpoint}`;

    const defaultOptions = {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${authService.getToken()}`,
      },
      timeout: 30000,
    };

    const finalOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...(options.headers || {}),
      },
    };

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
          errorMessage = errorData.detail.map((err) => err.msg).join(', ');
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
      console.error('Error en solicitud de multas:', error);

      if (error.name === 'AbortError') {
        throw new Error('La petición tardó demasiado tiempo');
      }

      if (error.message.includes('Failed to fetch')) {
        throw new Error('No se pudo conectar con el servidor');
      }

      throw error;
    }
  }

  // =============================
  // LISTAR TIPOS DE MULTA
  // =============================
  async getTiposMulta(filters = {}) {
    try {
      const params = new URLSearchParams();

      if (filters.search) params.append('search', filters.search);
      if (filters.activo !== undefined) params.append('activo', filters.activo);
      if (filters.es_vigente !== undefined) params.append('es_vigente', filters.es_vigente);
      if (filters.skip) params.append('skip', filters.skip);
      if (filters.limit) params.append('limit', filters.limit);

      const queryString = params.toString();
      const endpoint = queryString
        ? `${API_CONFIG.endpoints.tiposMulta}?${queryString}`
        : API_CONFIG.endpoints.tiposMulta;

      const data = await this.makeRequest(endpoint);
      this.cachedTiposMulta = data;

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('Error al obtener tipos de multa:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener tipos de multa',
      };
    }
  }

  // HISTORIAL DE VERSIONES
  async getHistorialTipoMulta(nombreMulta) {
    try {
      const data = await this.makeRequest(API_CONFIG.endpoints.historial(nombreMulta));
      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('Error al obtener historial de multas:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener historial de la multa',
      };
    }
  }

  // ESTADÍSTICAS
  async getMultaStats() {
    try {
      const data = await this.makeRequest(API_CONFIG.endpoints.stats);
      this.cachedStats = data;
      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('Error al obtener estadisticas de multas:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener estadísticas de multas',
      };
    }
  }

  // OBTENER POR ID
  async getTipoMultaById(id) {
    try {
      const data = await this.makeRequest(`${API_CONFIG.endpoints.tiposMulta}/${id}`);
      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('Error al obtener tipo de multa:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener tipo de multa',
      };
    }
  }

  // CREAR NUEVO TIPO DE MULTA
  async createTipoMulta(multaData) {
    try {
      this.validateTipoMultaData(multaData, true);

      const body = {
        nombre_multa: multaData.nombre_multa.trim(),
        descripcion: multaData.descripcion?.trim() || null,
        monto: multaData.monto !== '' && multaData.monto !== null
          ? parseFloat(multaData.monto)
          : null,
        activo: multaData.activo !== undefined ? multaData.activo : true,
      };

      if (multaData.vigencia_desde) {
        body.vigencia_desde = multaData.vigencia_desde;
      }

      const data = await this.makeRequest(API_CONFIG.endpoints.tiposMulta, {
        method: 'POST',
        body,
      });

      this.clearCache();

      return {
        success: true,
        data,
        message: 'Tipo de multa creado exitosamente',
      };
    } catch (error) {
      console.error('Error al crear tipo de multa:', error);
      let cleanMessage = 'Error al crear el tipo de multa';

      if (error.message) {
        cleanMessage = error.message.replace(/^Value error,\s*/i, '');
      }

      return {
        success: false,
        message: cleanMessage,
      };
    }
  }

  // CREAR NUEVA VERSIÓN
  async updateTipoMulta(id, multaData) {
    if (!id || isNaN(id)) {
      throw new Error('ID de tipo de multa inválido o no definido');
    }

    try {
      this.validateTipoMultaData(multaData, false);

      const updateData = {};

      if (multaData.nombre_multa) {
        updateData.nombre_multa = multaData.nombre_multa.trim();
      }
      if (multaData.descripcion !== undefined) {
        updateData.descripcion = multaData.descripcion?.trim() || null;
      }
      if (multaData.monto !== undefined) {
        updateData.monto =
          multaData.monto === '' || multaData.monto === null
            ? null
            : parseFloat(multaData.monto);
      }
      if (multaData.activo !== undefined) {
        updateData.activo = multaData.activo;
      }
      if (multaData.vigencia_desde) {
        updateData.vigencia_desde = multaData.vigencia_desde;
      }

      const data = await this.makeRequest(`${API_CONFIG.endpoints.tiposMulta}/${id}`, {
        method: 'PUT',
        body: updateData,
      });

      this.clearCache();

      return {
        success: true,
        data,
        message: 'Nueva versión de tipo de multa creada exitosamente',
      };
    } catch (error) {
      console.error('Error al actualizar tipo de multa:', error);
      return {
        success: false,
        message: error.message || 'Error al actualizar tipo de multa',
      };
    }
  }

  // ACTIVAR / DESACTIVAR
  async toggleTipoMultaStatus(id) {
    try {
      const data = await this.makeRequest(API_CONFIG.endpoints.toggleStatus(id), {
        method: 'PATCH',
      });

      this.clearCache();

      return {
        success: true,
        data,
        message: 'Estado del tipo de multa actualizado',
      };
    } catch (error) {
      console.error('Error al cambiar estado del tipo de multa:', error);
      return {
        success: false,
        message: error.message || 'Error al cambiar estado del tipo de multa',
      };
    }
  }

  // VALIDACIÓN
  validateTipoMultaData(multaData, required = true) {
    if (required) {
      if (!multaData.nombre_multa || multaData.nombre_multa.trim().length < 3) {
        throw new Error('El nombre de la multa debe tener al menos 3 caracteres');
      }
    } else {
      if (multaData.nombre_multa && multaData.nombre_multa.trim().length < 3) {
        throw new Error('El nombre de la multa debe tener al menos 3 caracteres');
      }
    }

    if (multaData.monto !== undefined && multaData.monto !== null && multaData.monto !== '') {
      const value = parseFloat(multaData.monto);
      if (isNaN(value) || value < 0) {
        throw new Error('El monto de la multa debe ser mayor o igual a 0');
      }
    }
  }

  getCachedTiposMulta() {
    return this.cachedTiposMulta || [];
  }

  clearCache() {
    this.cachedTiposMulta = null;
    this.cachedStats = null;
  }

  /**
   * Eliminar un tipo de multa
   */
  async deleteTipoMulta(tipoMultaId) {
    try {
      const response = await this.makeRequest(
        `${API_CONFIG.endpoints.tiposMulta}/${tipoMultaId}`,  // ✅ CORRECTO
        { method: 'DELETE' }
      );
      
      this.clearCache();
      
      if (response && response.success === false) {
        return {
          success: false,
          message: response.message || 'No se pudo eliminar el tipo de multa.',
          accion: response.accion || 'no_eliminado'
        };
      }
      
      return {
        success: true,
        message: response.message || 'Tipo de multa eliminado correctamente.',
        accion: response.accion || 'eliminado'
      };
    } catch (error) {
      console.error('Error al eliminar tipo de multa:', error);
      return {
        success: false,
        message: error.message || 'Error al eliminar tipo de multa'
      };
    }
  }


}

const multasService = new MultasService();
export default multasService;
export { MultasService };
