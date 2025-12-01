/**
 * src/services/readingsServices.js
 * Servicio de Gestión de Lecturas de Medidores
 */

import authService from './authServices';

const API_CONFIG = {
  baseURL: 'https://localhost:8000',
  endpoints: {
    lecturas: '/lecturas',
    toggleStatus: (id) => `/lecturas/${id}/toggle-status`,
    exportTemplate: '/lecturas/export/template',
    importExcel: '/lecturas/import/excel',
    exportExcel: '/lecturas/export/excel',
    medidoresCompletos: '/lecturas/medidores/lista/completa',  // ✅ NUEVO
    stats: '/lecturas/stats/count'  // ✅ NUEVO
  }
};

class ReadingsServices {
  constructor() {
    this.cachedLecturas = null;
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
 * Obtener lista completa de medidores con información de afiliados
 */
async getMedidoresParaLecturas() {
  try {
    const data = await this.makeRequest(API_CONFIG.endpoints.medidoresCompletos);
    return {
      success: true,
      data: data
    };
  } catch (error) {
    console.error('❌ Error obteniendo medidores:', error);
    return {
      success: false,
      message: error.message || 'Error al obtener medidores'
    };
  }
}

/**
 * Obtener estadísticas de lecturas desde el backend
 */
async getStatsFromBackend() {
  try {
    const data = await this.makeRequest(API_CONFIG.endpoints.stats);
    return {
      success: true,
      data: data
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
   * Obtener lista de lecturas
   */
  async getLecturas(filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.id_medidor) params.append('id_medidor', filters.id_medidor);
      if (filters.fecha_desde) params.append('fecha_desde', filters.fecha_desde);
      if (filters.fecha_hasta) params.append('fecha_hasta', filters.fecha_hasta);
      if (filters.activo !== undefined) params.append('activo', filters.activo);
      if (filters.skip) params.append('skip', filters.skip);
      if (filters.limit) params.append('limit', filters.limit);

      const queryString = params.toString();
      const endpoint = queryString 
        ? `${API_CONFIG.endpoints.lecturas}?${queryString}`
        : API_CONFIG.endpoints.lecturas;

      const data = await this.makeRequest(endpoint);

      // Actualizar caché
      this.cachedLecturas = data;

      return {
        success: true,
        data: data
      };

    } catch (error) {
      console.error('❌ Error obteniendo lecturas:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener lecturas'
      };
    }
  }

  /**
   * Obtener una lectura por ID
   */
  async getLecturaById(lecturaId) {
    try {
      const data = await this.makeRequest(`${API_CONFIG.endpoints.lecturas}/${lecturaId}`);
      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error('❌ Error obteniendo lectura:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener lectura'
      };
    }
  }

  /**
   * Crear una nueva lectura
   */
  async createLectura(lecturaData) {
    try {
      const data = await this.makeRequest(API_CONFIG.endpoints.lecturas, {
        method: 'POST',
        body: {
          id_medidor: parseInt(lecturaData.id_medidor),
          lectura_actual: parseInt(lecturaData.lectura_actual),
          lectura_anterior: parseInt(lecturaData.lectura_anterior),
          consumo_m3: parseInt(lecturaData.consumo_m3),
          fecha_lectura: lecturaData.fecha_lectura,
          observacion: lecturaData.observacion?.trim() || null,
          activo: lecturaData.activo !== undefined ? lecturaData.activo : true
        }
      });

      // Limpiar caché
      this.cachedLecturas = null;

      return {
        success: true,
        data: data,
        message: 'Lectura creada exitosamente'
      };

    } catch (error) {
      console.error('❌ Error creando lectura:', error);
      return {
        success: false,
        message: error.message || 'Error al crear la lectura'
      };
    }
  }

  /**
   * Actualizar una lectura existente
   */
  async updateLectura(lecturaId, lecturaData) {
    if (!lecturaId || isNaN(lecturaId)) {
      throw new Error('ID de lectura inválido o no definido');
    }

    try {
      const updateData = {};
      if (lecturaData.id_medidor !== undefined) updateData.id_medidor = parseInt(lecturaData.id_medidor);
      if (lecturaData.lectura_actual !== undefined) updateData.lectura_actual = parseInt(lecturaData.lectura_actual);
      if (lecturaData.lectura_anterior !== undefined) updateData.lectura_anterior = parseInt(lecturaData.lectura_anterior);
      if (lecturaData.consumo_m3 !== undefined) updateData.consumo_m3 = parseInt(lecturaData.consumo_m3);
      if (lecturaData.fecha_lectura) updateData.fecha_lectura = lecturaData.fecha_lectura;
      if (lecturaData.observacion !== undefined) updateData.observacion = lecturaData.observacion?.trim() || null;
      if (lecturaData.activo !== undefined) updateData.activo = lecturaData.activo;

      const data = await this.makeRequest(`${API_CONFIG.endpoints.lecturas}/${lecturaId}`, {
        method: 'PUT',
        body: updateData,
      });

      // Limpiar caché
      this.cachedLecturas = null;

      return {
        success: true,
        data: data,
        message: 'Lectura actualizada exitosamente'
      };

    } catch (error) {
      console.error('❌ Error actualizando lectura:', error);
      return {
        success: false,
        message: error.message || 'Error al actualizar lectura'
      };
    }
  }

  /**
   * Eliminar una lectura
   */
  async deleteLectura(lecturaId) {
    try {
      const response = await this.makeRequest(`${API_CONFIG.endpoints.lecturas}/${lecturaId}`, {
        method: 'DELETE'
      });

      // Limpiar caché
      this.cachedLecturas = null;

      if (response && response.success === false) {
        return {
          success: false,
          message: response.message || 'No se pudo eliminar la lectura.',
          accion: response.accion || 'no_eliminado'
        };
      }

      return {
        success: true,
        message: response.message || 'Lectura eliminada correctamente.',
        accion: response.accion || 'eliminado'
      };

    } catch (error) {
      console.error('❌ Error eliminando lectura:', error);
      return {
        success: false,
        message: error.message || 'Error al eliminar lectura'
      };
    }
  }

  /**
   * Activar/Desactivar lectura
   */
  async toggleLecturaStatus(lecturaId) {
    try {
      const data = await this.makeRequest(API_CONFIG.endpoints.toggleStatus(lecturaId), {
        method: 'PATCH'
      });

      // Limpiar caché
      this.cachedLecturas = null;

      return {
        success: true,
        data: data,
        message: 'Estado de la lectura actualizado'
      };

    } catch (error) {
      console.error('❌ Error cambiando estado:', error);
      return {
        success: false,
        message: error.message || 'Error al cambiar estado de la lectura'
      };
    }
  }

  /**
   * Exportar plantilla Excel para lecturas
   */
  async exportarPlantilla() {
    try {
      const url = `${API_CONFIG.baseURL}${API_CONFIG.endpoints.exportTemplate}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authService.getToken()}`
        }
      });

      if (!response.ok) {
        throw new Error('Error al exportar plantilla');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `plantilla_lecturas_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      return {
        success: true,
        message: 'Plantilla exportada correctamente'
      };

    } catch (error) {
      console.error('❌ Error exportando plantilla:', error);
      return {
        success: false,
        message: error.message || 'Error al exportar plantilla'
      };
    }
  }

  /**
   * Importar lecturas desde Excel
   */
  async importarExcel(file) {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const data = await this.makeRequest(API_CONFIG.endpoints.importExcel, {
        method: 'POST',
        body: formData
      });

      // Limpiar caché
      this.cachedLecturas = null;

      return {
        success: true,
        data: data,
        message: 'Lecturas importadas exitosamente'
      };

    } catch (error) {
      console.error('❌ Error importando Excel:', error);
      return {
        success: false,
        message: error.message || 'Error al importar lecturas desde Excel'
      };
    }
  }

  /**
   * Exportar lecturas a Excel
   */
  async exportarExcel(filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.fecha_desde) params.append('fecha_desde', filters.fecha_desde);
      if (filters.fecha_hasta) params.append('fecha_hasta', filters.fecha_hasta);

      const queryString = params.toString();
      const endpoint = queryString 
        ? `${API_CONFIG.endpoints.exportExcel}?${queryString}`
        : API_CONFIG.endpoints.exportExcel;

      const url = `${API_CONFIG.baseURL}${endpoint}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authService.getToken()}`
        }
      });

      if (!response.ok) {
        throw new Error('Error al exportar lecturas');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `lecturas_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      return {
        success: true,
        message: 'Lecturas exportadas correctamente'
      };

    } catch (error) {
      console.error('❌ Error exportando lecturas:', error);
      return {
        success: false,
        message: error.message || 'Error al exportar lecturas'
      };
    }
  }

  /**
   * Obtener estadísticas de lecturas
   */
  async getLecturaStats() {
    try {
      const result = await this.getLecturas();

      if (!result.success) {
        return result;
      }

      const lecturas = result.data;

      return {
        success: true,
        data: {
          total: lecturas.length,
          activos: lecturas.filter(l => l.activo).length,
          inactivos: lecturas.filter(l => !l.activo).length,
          consumo_total: lecturas.reduce((sum, l) => sum + (l.consumo_m3 || 0), 0)
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
   * Obtener lecturas desde caché
   */
  getCachedLecturas() {
    return this.cachedLecturas || [];
  }

  /**
   * Limpiar caché
   */
  clearCache() {
    this.cachedLecturas = null;
  }
}

const readingsServices = new ReadingsServices();

export default readingsServices;
export { ReadingsServices };
