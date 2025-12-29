/**
 * src/services/finesAffiliatesServices.js
 * Servicio de Gestión de Multas de Afiliados
 */

import authService from './authServices';

const API_CONFIG = {
  baseURL: 'https://localhost:8000',
  endpoints: {
    availableAffiliates: '/multas/afiliados/available',
    multas: '/multas/afiliados',
    stats: '/multas/afiliados/stats',
    pagar: (id) => `/multas/afiliados/${id}/pagar`,
    anular: (id) => `/multas/afiliados/${id}/anular`,
    anios: '/multas/afiliados/periodos/anios',  // ⭐ NUEVO
    mesesPorAnio: (anio) => `/multas/afiliados/periodos/meses/${anio}`,  // ⭐ NUEVO
  }
};

class FinesAffiliatesServices {
  constructor() {
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
      timeout: 30000,
    };

    const finalOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers,
      },
    };

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
  async getAvailableAffiliates() {
    try {
      const data = await this.makeRequest(
        API_CONFIG.endpoints.availableAffiliates
      );

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('❌ Error cargando afiliados para multas:', error);
      return {
        success: false,
        data: [],
      };
    }
  }


/**
 * Obtener años disponibles con multas registradas
 */
async getAnios() {
    try {
        const data = await this.makeRequest(API_CONFIG.endpoints.anios);
        return {
            success: true,
            data: Array.isArray(data) ? data : []
        };
    } catch (error) {
        console.error('❌ Error obteniendo años:', error);
        return {
            success: false,
            message: error.message || 'Error al obtener años',
            data: []
        };
    }
}

/**
 * Obtener meses disponibles para un año específico
 */
async getMesesPorAnio(anio) {
    try {
        const data = await this.makeRequest(API_CONFIG.endpoints.mesesPorAnio(anio));
        return {
            success: true,
            data: Array.isArray(data) ? data : []
        };
    } catch (error) {
        console.error('❌ Error obteniendo meses:', error);
        return {
            success: false,
            message: error.message || 'Error al obtener meses',
            data: []
        };
    }
}

/**
 * Obtener lista de multas con filtros opcionales (MODIFICADO)
 */
async getMultas(filters = {}) {
    try {
        const params = new URLSearchParams();
        if (filters.id_usuario_afi) params.append('id_usuario_afi', filters.id_usuario_afi);
        if (filters.estado) params.append('estado', filters.estado);
        if (filters.activo !== undefined) params.append('activo', filters.activo);
        
        // ⭐ NUEVO: Filtros de año y mes
        if (filters.anio) {
            params.append('anio', filters.anio);
            if (filters.mes) {
                params.append('mes', filters.mes);
            }
        } else {
            // Solo usar fecha_desde y fecha_hasta si no hay año/mes
            if (filters.fecha_desde) params.append('fecha_desde', filters.fecha_desde);
            if (filters.fecha_hasta) params.append('fecha_hasta', filters.fecha_hasta);
        }
        
        if (filters.skip) params.append('skip', filters.skip);
        if (filters.limit) params.append('limit', filters.limit);

        const queryString = params.toString();
        const endpoint = queryString
            ? `${API_CONFIG.endpoints.multas}?${queryString}`
            : API_CONFIG.endpoints.multas;

        const data = await this.makeRequest(endpoint);
        return {
            success: true,
            data: Array.isArray(data) ? data : []
        };
    } catch (error) {
        console.error('❌ Error obteniendo multas:', error);
        return {
            success: false,
            message: error.message || 'Error al obtener multas',
            data: []
        };
    }
}



  /**
   * Obtener una multa específica por ID
   */
  async getMultaById(multaId) {
    try {
      const data = await this.makeRequest(`${API_CONFIG.endpoints.multas}/${multaId}`);
      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error('❌ Error obteniendo multa:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener multa'
      };
    }
  }

/**
 * Obtener estadísticas de multas con filtros opcionales
 */
async getMultasStats(filters = {}) {
    try {
        const params = new URLSearchParams();
        
        // ⭐ NUEVO: Agregar filtros de período
        if (filters.anio) {
            params.append('anio', filters.anio);
            if (filters.mes) {
                params.append('mes', filters.mes);
            }
        }
        
        const queryString = params.toString();
        const endpoint = queryString
            ? `${API_CONFIG.endpoints.stats}?${queryString}`
            : API_CONFIG.endpoints.stats;
        
        const data = await this.makeRequest(endpoint);
        this.cachedStats = data;
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
   * Crear una nueva multa
   */
  async createMulta(multaData) {
    try {
      this.validateMultaData(multaData);

      const body = {
        id_usuario_afi: multaData.id_usuario_afi,
        id_tipo_multa: multaData.id_tipo_multa,
        monto: parseFloat(multaData.monto),
        observaciones: multaData.observaciones?.trim() || null,
        fecha_multa: multaData.fecha_multa || null,
        estado: multaData.estado || 'pendiente'
      };

      const data = await this.makeRequest(API_CONFIG.endpoints.multas, {
        method: 'POST',
        body: body
      });

      this.clearCache();

      return {
        success: true,
        data: data,
        message: 'Multa creada exitosamente'
      };

    } catch (error) {
      console.error('❌ Error creando multa:', error);
      return {
        success: false,
        message: error.message || 'Error al crear multa'
      };
    }
  }

  /**
   * Actualizar una multa existente
   */
  async updateMulta(multaId, multaData) {
    if (!multaId || isNaN(multaId)) {
      throw new Error('ID de multa inválido');
    }

    try {
      const updateData = {};

      if (multaData.monto !== undefined) {
        updateData.monto = parseFloat(multaData.monto);
      }
      if (multaData.fecha_pago !== undefined) {
        updateData.fecha_pago = multaData.fecha_pago;
      }
      if (multaData.observaciones !== undefined) {
        updateData.observaciones = multaData.observaciones?.trim() || null;
      }
      if (multaData.estado !== undefined) {
        updateData.estado = multaData.estado;
      }
      if (multaData.activo !== undefined) {
        updateData.activo = multaData.activo;
      }

      const data = await this.makeRequest(`${API_CONFIG.endpoints.multas}/${multaId}`, {
        method: 'PUT',
        body: updateData
      });

      this.clearCache();

      return {
        success: true,
        data: data,
        message: 'Multa actualizada exitosamente'
      };

    } catch (error) {
      console.error('❌ Error actualizando multa:', error);
      return {
        success: false,
        message: error.message || 'Error al actualizar multa'
      };
    }
  }

  /**
   * Registrar pago de una multa
   */
  async registrarPago(multaId, pagoData = {}) {
    try {
      const body = {
        fecha_pago: pagoData.fecha_pago || null,
        observaciones: pagoData.observaciones?.trim() || null
      };

      const data = await this.makeRequest(API_CONFIG.endpoints.pagar(multaId), {
        method: 'PATCH',
        body: body
      });

      this.clearCache();

      return {
        success: true,
        data: data,
        message: 'Pago registrado exitosamente'
      };

    } catch (error) {
      console.error('❌ Error registrando pago:', error);
      return {
        success: false,
        message: error.message || 'Error al registrar pago'
      };
    }
  }

  /**
   * Anular una multa
   */
  async anularMulta(multaId, motivo) {
    try {
      if (!motivo || motivo.trim().length < 10) {
        throw new Error('El motivo de anulación debe tener al menos 10 caracteres');
      }

      const params = new URLSearchParams();
      params.append('motivo', motivo.trim());

      const data = await this.makeRequest(`${API_CONFIG.endpoints.anular(multaId)}?${params.toString()}`, {
        method: 'PATCH'
      });

      this.clearCache();

      return {
        success: true,
        data: data,
        message: 'Multa anulada exitosamente'
      };

    } catch (error) {
      console.error('❌ Error anulando multa:', error);
      return {
        success: false,
        message: error.message || 'Error al anular multa'
      };
    }
  }
  /**
   * Eliminar una multa (solo si está anulada)
   */
  async deleteMulta(multaId) {
    if (!multaId || isNaN(multaId)) {
      throw new Error('ID de multa inválido');
    }

    try {
      const data = await this.makeRequest(`${API_CONFIG.endpoints.multas}/${multaId}`, {
        method: 'DELETE'
      });

      this.clearCache();

      return {
        success: data.success !== false,
        accion: data.accion || 'eliminado',
        message: data.message || 'Multa eliminada exitosamente',
        data: data
      };
    } catch (error) {
      console.error('❌ Error eliminando multa:', error);
      return {
        success: false,
        message: error.message || 'Error al eliminar multa'
      };
    }
  }

  /**
   * Validar datos de multa
   */
  validateMultaData(multaData) {
    if (!multaData.id_usuario_afi || typeof multaData.id_usuario_afi !== 'number') {
      throw new Error('Debe seleccionar un afiliado válido');
    }

    if (!multaData.id_tipo_multa || typeof multaData.id_tipo_multa !== 'number') {
      throw new Error('Debe seleccionar un tipo de multa válido');
    }

    if (!multaData.monto || isNaN(multaData.monto) || parseFloat(multaData.monto) <= 0) {
      throw new Error('El monto debe ser mayor a 0');
    }
  }


  /**
   * Obtener el badge de color según el estado
   */
  getEstadoBadgeClass(estado) {
    const badgeClasses = {
      pendiente: 'badge-warning',
      pagada: 'badge-success',
      anulada: 'badge-danger',
      exonerada: 'badge-info'
    };

    return badgeClasses[estado] || 'badge-secondary';
  }

  /**
   * Limpiar caché
   */
  clearCache() {
    this.cachedStats = null;
  }
}

const finesAffiliatesServices = new FinesAffiliatesServices();
export default finesAffiliatesServices;
export { FinesAffiliatesServices };
