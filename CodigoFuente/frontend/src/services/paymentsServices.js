/**
 * src/services/paymentsServices.js
 * Servicio de Gestión de Pagos
 * ✅ Integrado con router FastAPI de pagos
 */

import authService from './authServices';

const API_CONFIG = {
  baseURL: 'https://localhost:8000',
  endpoints: {
    pagos: '/pagos',                         
    stats: '/pagos/stats/resumen',             
    anular: id => `/pagos/${id}/anular`,       
    periodos: '/pagos/periodos/disponibles',
    porFactura: idFactura => `/pagos/factura/${idFactura}`,
    porAfiliado: idAfiliado => `/pagos/afiliado/${idAfiliado}`,
    facturasPeriodo: '/pagos/facturas-periodo'
  }
};

class PaymentsServices {
  constructor() {
    this.cachedPagos = null;
    this.cachedStats = null;
    this.cachedPeriodos = null;
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
      timeout: 50000,
    };

    const finalOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers,
      },
    };

    // Manejar JSON body
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
     * Obtener TODAS las facturas del periodo
     */
    async getFacturasPeriodo(filters = {}) {
    try {
        const params = new URLSearchParams();
        if (filters.periodo) params.append('periodo', filters.periodo);
        if (filters.search) params.append('search', filters.search);
        if (filters.estado_factura) params.append('estado_factura', filters.estado_factura);
        if (filters.skip) params.append('skip', filters.skip);
        if (filters.limit) params.append('limit', filters.limit);

        const queryString = params.toString();
        const endpoint = queryString
        ? `${API_CONFIG.endpoints.facturasPeriodo}?${queryString}`
        : API_CONFIG.endpoints.facturasPeriodo;

        const data = await this.makeRequest(endpoint);

        return {
        success: true,
        data: data
        };
    } catch (error) {
        console.error('❌ Error obteniendo facturas del periodo:', error);
        return {
        success: false,
        message: error.message || 'Error al obtener facturas'
        };
    }
    }

  // ========================================
  // OBTENER PAGOS
  // ========================================
  
  /**
   * Obtener lista de pagos con filtros
   */
  async getPagos(filters = {}) {
    try {
      const params = new URLSearchParams();
      
      if (filters.search) params.append('search', filters.search);
      if (filters.id_usuario_afi) params.append('id_usuario_afi', filters.id_usuario_afi);
      if (filters.periodo) params.append('periodo', filters.periodo);
      if (filters.estado_pago) params.append('estado_pago', filters.estado_pago);
      if (filters.metodo_pago) params.append('metodo_pago', filters.metodo_pago);
      if (filters.fecha_desde) params.append('fecha_desde', filters.fecha_desde);
      if (filters.fecha_hasta) params.append('fecha_hasta', filters.fecha_hasta);
      if (filters.skip) params.append('skip', filters.skip);
      if (filters.limit) params.append('limit', filters.limit);

      const queryString = params.toString();
      const endpoint = queryString 
        ? `${API_CONFIG.endpoints.pagos}?${queryString}` 
        : API_CONFIG.endpoints.pagos;

      const data = await this.makeRequest(endpoint);
      
      // Actualizar caché
      this.cachedPagos = data;
      
      return {
        success: true,
        data: data
      };
      
    } catch (error) {
      console.error('❌ Error obteniendo pagos:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener pagos'
      };
    }
  }

  /**
   * Obtener un pago por ID
   */
  async getPagoById(pagoId) {
    try {
      const data = await this.makeRequest(`${API_CONFIG.endpoints.pagos}/${pagoId}`);
      
      return {
        success: true,
        data: data
      };
      
    } catch (error) {
      console.error('❌ Error obteniendo pago:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener pago'
      };
    }
  }

  /**
   * Obtener pagos de una factura específica
   */
  async getPagosByFactura(idFactura) {
    try {
      const data = await this.makeRequest(API_CONFIG.endpoints.porFactura(idFactura));
      
      return {
        success: true,
        data: data
      };
      
    } catch (error) {
      console.error('❌ Error obteniendo pagos de factura:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener pagos'
      };
    }
  }

  /**
   * Obtener pagos de un afiliado
   */
  async getPagosByAfiliado(idAfiliado, filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.periodo) params.append('periodo', filters.periodo);
      if (filters.estado_pago) params.append('estado_pago', filters.estado_pago);
      
      const queryString = params.toString();
      const endpoint = queryString
        ? `${API_CONFIG.endpoints.porAfiliado(idAfiliado)}?${queryString}`
        : API_CONFIG.endpoints.porAfiliado(idAfiliado);

      const data = await this.makeRequest(endpoint);
      
      return {
        success: true,
        data: data
      };
      
    } catch (error) {
      console.error('❌ Error obteniendo pagos del afiliado:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener pagos'
      };
    }
  }

  /**
   * Obtener estadísticas de pagos
   */
  async getStats(periodo = null, id_usuario_afi = null) {
    try {
      const params = new URLSearchParams();
      if (periodo) params.append('periodo', periodo);
      if (id_usuario_afi) params.append('id_usuario_afi', id_usuario_afi);

      const queryString = params.toString();
      const endpoint = queryString
        ? `${API_CONFIG.endpoints.stats}?${queryString}`
        : API_CONFIG.endpoints.stats;

      const data = await this.makeRequest(endpoint);
      
      // Actualizar caché
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

  // ========================================
  // CREAR Y ACTUALIZAR PAGOS
  // ========================================
  
  /**
   * Registrar un nuevo pago
   */
  async createPago(pagoData) {
    try {
      const data = await this.makeRequest(API_CONFIG.endpoints.pagos, {
        method: 'POST',
        body: {
          id_factura: pagoData.id_factura ? parseInt(pagoData.id_factura) : null,
          monto_pago: parseFloat(pagoData.monto_pago),
          fecha_pago: pagoData.fecha_pago || new Date().toISOString(),
          metodo_pago: pagoData.metodo_pago || 'EFECTIVO',
          id_usuario_afi: pagoData.id_usuario_afi ? parseInt(pagoData.id_usuario_afi) : null,
          id_cajero: pagoData.id_cajero ? parseInt(pagoData.id_cajero) : null,
          observaciones: pagoData.observaciones || null,
          estado_pago: pagoData.estado_pago || 'REGISTRADO'
        }
      });

      // Limpiar cachés
      this.cachedPagos = null;
      this.cachedStats = null;

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
   * Actualizar un pago existente
   */
  async updatePago(pagoId, pagoData) {
    try {
      const updateData = {};
      
      if (pagoData.monto_pago !== undefined) {
        updateData.monto_pago = parseFloat(pagoData.monto_pago);
      }
      if (pagoData.metodo_pago !== undefined) {
        updateData.metodo_pago = pagoData.metodo_pago;
      }
      if (pagoData.observaciones !== undefined) {
        updateData.observaciones = pagoData.observaciones;
      }
      if (pagoData.estado_pago !== undefined) {
        updateData.estado_pago = pagoData.estado_pago;
      }

      const data = await this.makeRequest(`${API_CONFIG.endpoints.pagos}/${pagoId}`, {
        method: 'PUT',
        body: updateData
      });

      // Limpiar cachés
      this.cachedPagos = null;
      this.cachedStats = null;

      return {
        success: true,
        data: data,
        message: 'Pago actualizado exitosamente'
      };
      
    } catch (error) {
      console.error('❌ Error actualizando pago:', error);
      return {
        success: false,
        message: error.message || 'Error al actualizar pago'
      };
    }
  }

  /**
   * Anular un pago
   */
  async anularPago(pagoId, motivo = null) {
    try {
      const endpoint = motivo
        ? `${API_CONFIG.endpoints.anular(pagoId)}?motivo=${encodeURIComponent(motivo)}`
        : API_CONFIG.endpoints.anular(pagoId);

      const data = await this.makeRequest(endpoint, {
        method: 'PATCH'
      });

      // Limpiar cachés
      this.cachedPagos = null;
      this.cachedStats = null;

      return {
        success: true,
        data: data,
        message: 'Pago anulado exitosamente'
      };
      
    } catch (error) {
      console.error('❌ Error anulando pago:', error);
      return {
        success: false,
        message: error.message || 'Error al anular pago'
      };
    }
  }

  // ========================================
  // UTILIDADES
  // ========================================
  
  /**
   * Formatear periodo (mes, año) a texto legible
   */
  formatearPeriodo(periodo) {
    if (!periodo) return '';
    
    const [anio, mes] = periodo.split('-');
    const meses = {
      '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
      '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
      '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre'
    };
    
    return `${meses[mes]} ${anio}`;
  }

  /**
   * Obtener periodos disponibles para pagos
   */
  async getPeriodosDisponibles() {
    try {
      const data = await this.makeRequest(API_CONFIG.endpoints.periodos);
      this.cachedPeriodos = data;
      return {
        success: true,
        data
      };
    } catch (error) {
      console.error('❌ Error obteniendo periodos de pagos:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener periodos disponibles'
      };
    }
  }

  /**
   * Obtener caché de pagos
   */
  getCachedPagos() {
    return this.cachedPagos || [];
  }

  /**
   * Obtener caché de estadísticas
   */
  getCachedStats() {
    return this.cachedStats || null;
  }

  /**
   * Limpiar todos los cachés
   */
  clearCache() {
    this.cachedPagos = null;
    this.cachedStats = null;
    this.cachedPeriodos = null;
  }
}

const paymentsServices = new PaymentsServices();
export default paymentsServices;
export { PaymentsServices };