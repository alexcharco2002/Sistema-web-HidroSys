/**
 * src/services/invoicesServices.js
 * Servicio de Gestión de Facturas
 * ✅ Integrado con router FastAPI de facturas
 */

import authService from './authServices';

const API_CONFIG = {
  baseURL: 'https://localhost:8000',
  endpoints: {
    facturas: '/facturas',                         
    stats: '/facturas/stats/resumen',             
    cambiarEstado: id => `/facturas/${id}/estado`,
    anular: id => `/facturas/${id}/anular`,       
    detalles: id => `/facturas/${id}/detalles`,   
    marcarVencidas: '/facturas/jobs/marcar-vencidas',
    serviciosActivos: '/facturas/activos-facturacion',
    facturasPeriodosDisponibles: '/facturas/periodos/disponibles',
  }
};


class InvoicesServices {
  constructor() {
    this.cachedFacturas = null;
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

  // ========================================
  // OBTENER FACTURAS
  // ========================================
  
  /**
   * Obtener lista de facturas con filtros
   */
  async getFacturas(filters = {}) {
    try {
      const params = new URLSearchParams();
      
      if (filters.search) params.append('search', filters.search);
      if (filters.id_usuario_afi) params.append('id_usuario_afi', filters.id_usuario_afi);
      if (filters.periodo) params.append('periodo', filters.periodo);
      if (filters.estado_factura) params.append('estado_factura', filters.estado_factura);
      if (filters.fecha_desde) params.append('fecha_desde', filters.fecha_desde);
      if (filters.fecha_hasta) params.append('fecha_hasta', filters.fecha_hasta);
      if (filters.skip) params.append('skip', filters.skip);
      if (filters.limit) params.append('limit', filters.limit);

      const queryString = params.toString();
      const endpoint = queryString 
        ? `${API_CONFIG.endpoints.facturas}?${queryString}` 
        : API_CONFIG.endpoints.facturas;

      const data = await this.makeRequest(endpoint);
      
      // Actualizar caché
      this.cachedFacturas = data;
      
      return {
        success: true,
        data: data
      };
      
    } catch (error) {
      console.error('❌ Error obteniendo facturas:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener facturas'
      };
    }
  }

  /**
   * Obtener una factura por ID con detalles
   */
  async getFacturaById(facturaId) {
    try {
      const data = await this.makeRequest(`${API_CONFIG.endpoints.facturas}/${facturaId}`);
      
      return {
        success: true,
        data: data
      };
      
    } catch (error) {
      console.error('❌ Error obteniendo factura:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener factura'
      };
    }
  }

  /**
   * Aplicar descuento a una factura y opcionalmente marcarla como pagada
   */

  async aplicarDescuento(facturaId, descuentoData) {
    try {
      const data = await this.makeRequest(
        `${API_CONFIG.endpoints.facturas}/${facturaId}/aplicar-descuento`,
        {
          method: 'PATCH',
          body: descuentoData  // ✅ Pasar el objeto directamente, NO JSON.stringify
        }
      );
      
      return {
        success: true,
        data: data,
        message: data.message || 'Descuento aplicado correctamente'
      };
      
    } catch (error) {
      console.error('❌ Error aplicando descuento:', error);
      return {
        success: false,
        message: error.message || 'Error al aplicar descuento'
      };
    }
  }

  /**
   * Obtener estadísticas de facturación
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
  // CREAR Y ACTUALIZAR FACTURAS
  // ========================================
  
  /**
   * Crear una nueva factura
   */
  async createFactura(facturaData) {
    try {
      const data = await this.makeRequest(API_CONFIG.endpoints.facturas, {
        method: 'POST',
        body: {
          id_usuario_afi: parseInt(facturaData.id_usuario_afi),
          id_lectura: facturaData.id_lectura ? parseInt(facturaData.id_lectura) : null,
          id_tarifa: parseInt(facturaData.id_tarifa),
          consumo_m3: facturaData.consumo_m3 ? parseInt(facturaData.consumo_m3) : null,
          exceso_m3: facturaData.exceso_m3 ? parseInt(facturaData.exceso_m3) : null,
          valor_consumo: facturaData.valor_consumo ? parseFloat(facturaData.valor_consumo) : null,
          valor_exceso: facturaData.valor_exceso ? parseFloat(facturaData.valor_exceso) : null,
          descuento: facturaData.descuento ? parseFloat(facturaData.descuento) : 0,
          subtotal: facturaData.subtotal ? parseFloat(facturaData.subtotal) : null,
          impuesto: facturaData.impuesto ? parseFloat(facturaData.impuesto) : null,
          total: parseFloat(facturaData.total),
          fecha_emision: facturaData.fecha_emision || null,
          periodo: facturaData.periodo,
          estado_factura: facturaData.estado_factura || 'pendiente'
        }
      });

      // Limpiar cachés
      this.cachedFacturas = null;
      this.cachedStats = null;

      return {
        success: true,
        data: data,
        message: 'Factura creada exitosamente'
      };
      
    } catch (error) {
      console.error('❌ Error creando factura:', error);
      return {
        success: false,
        message: error.message || 'Error al crear factura'
      };
    }
  }

  /**
   * Actualizar una factura existente
   */
  async updateFactura(facturaId, facturaData) {
    try {
      const updateData = {};
      
      if (facturaData.estado_factura !== undefined) {
        updateData.estado_factura = facturaData.estado_factura;
      }
      if (facturaData.descuento !== undefined) {
        updateData.descuento = parseFloat(facturaData.descuento);
      }
      if (facturaData.total !== undefined) {
        updateData.total = parseFloat(facturaData.total);
      }

      const data = await this.makeRequest(`${API_CONFIG.endpoints.facturas}/${facturaId}`, {
        method: 'PUT',
        body: updateData
      });

      // Limpiar cachés
      this.cachedFacturas = null;
      this.cachedStats = null;

      return {
        success: true,
        data: data,
        message: 'Factura actualizada exitosamente'
      };
      
    } catch (error) {
      console.error('❌ Error actualizando factura:', error);
      return {
        success: false,
        message: error.message || 'Error al actualizar factura'
      };
    }
  }

  
  /**
   * Anular una factura
   */
  async anularFactura(facturaId, motivo = null) {
    try {
      const endpoint = motivo
        ? `${API_CONFIG.endpoints.anular(facturaId)}?motivo=${encodeURIComponent(motivo)}`
        : API_CONFIG.endpoints.anular(facturaId);

      const data = await this.makeRequest(endpoint, {
        method: 'PATCH'
      });

      // Limpiar cachés
      this.cachedFacturas = null;
      this.cachedStats = null;

      return {
        success: true,
        data: data,
        message: 'Factura anulada exitosamente'
      };
      
    } catch (error) {
      console.error('❌ Error anulando factura:', error);
      return {
        success: false,
        message: error.message || 'Error al anular factura'
      };
    }
  }

  /**
   * Marcar facturas vencidas (job programado)
   */
  async marcarFacturasVencidas(diasVencimiento = 30) {
    try {
      const endpoint = `${API_CONFIG.endpoints.marcarVencidas}?dias_vencimiento=${diasVencimiento}`;
      
      const data = await this.makeRequest(endpoint, {
        method: 'POST'
      });

      // Limpiar cachés
      this.cachedFacturas = null;
      this.cachedStats = null;

      return {
        success: true,
        data: data,
        message: data.message || 'Facturas vencidas marcadas'
      };
      
    } catch (error) {
      console.error('❌ Error marcando vencidas:', error);
      return {
        success: false,
        message: error.message || 'Error al marcar facturas vencidas'
      };
    }
  }

  // ========================================
  // GESTIÓN DE DETALLES
  // ========================================
  
  /**
   * Obtener detalles de una factura
   */
  async getDetallesFactura(facturaId) {
    try {
      const data = await this.makeRequest(API_CONFIG.endpoints.detalles(facturaId));
      
      return {
        success: true,
        data: data
      };
      
    } catch (error) {
      console.error('❌ Error obteniendo detalles:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener detalles'
      };
    }
  }

  /**
   * Crear un detalle de factura
   */
  async createDetalle(facturaId, detalleData) {
    try {
      const data = await this.makeRequest(API_CONFIG.endpoints.detalles(facturaId), {
        method: 'POST',
        body: {
          id_factura: parseInt(facturaId),
          tipo_detalle: detalleData.tipo_detalle,
          id_servicio: detalleData.id_servicio ? parseInt(detalleData.id_servicio) : null,
          id_multa_afiliados: detalleData.id_multa_afiliados ? parseInt(detalleData.id_multa_afiliados) : null,
          subtotal_detalle: parseFloat(detalleData.subtotal_detalle),
          descripcion: detalleData.descripcion || null
        }
      });

      // Limpiar cachés
      this.cachedFacturas = null;

      return {
        success: true,
        data: data,
        message: 'Detalle agregado exitosamente'
      };
      
    } catch (error) {
      console.error('❌ Error creando detalle:', error);
      return {
        success: false,
        message: error.message || 'Error al crear detalle'
      };
    }
  }

  /**
   * Actualizar un detalle de factura
   */
  async updateDetalle(facturaId, detalleId, detalleData) {
    try {
      const endpoint = `${API_CONFIG.endpoints.detalles(facturaId)}/${detalleId}`;
      
      const updateData = {};
      if (detalleData.subtotal_detalle !== undefined) {
        updateData.subtotal_detalle = parseFloat(detalleData.subtotal_detalle);
      }
      if (detalleData.descripcion !== undefined) {
        updateData.descripcion = detalleData.descripcion;
      }

      const data = await this.makeRequest(endpoint, {
        method: 'PUT',
        body: updateData
      });

      // Limpiar cachés
      this.cachedFacturas = null;

      return {
        success: true,
        data: data,
        message: 'Detalle actualizado exitosamente'
      };
      
    } catch (error) {
      console.error('❌ Error actualizando detalle:', error);
      return {
        success: false,
        message: error.message || 'Error al actualizar detalle'
      };
    }
  }

  /**
   * Eliminar un detalle de factura
   */
  async deleteDetalle(facturaId, detalleId) {
    try {
      const endpoint = `${API_CONFIG.endpoints.detalles(facturaId)}/${detalleId}`;
      
      const data = await this.makeRequest(endpoint, {
        method: 'DELETE'
      });

      // Limpiar cachés
      this.cachedFacturas = null;

      return {
        success: true,
        data: data,
        message: 'Detalle eliminado exitosamente'
      };
      
    } catch (error) {
      console.error('❌ Error eliminando detalle:', error);
      return {
        success: false,
        message: error.message || 'Error al eliminar detalle'
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
   * Obtener periodos disponibles para facturas (últimos 12 meses)
   */
async getPeriodosDisponibles() {
  try {
    const data = await this.makeRequest(API_CONFIG.endpoints.facturasPeriodosDisponibles);
    // data = { periodo_actual, periodos_disponibles }
    this.cachedPeriodos = data;
    return {
      success: true,
      data
    };
  } catch (error) {
    console.error('❌ Error obteniendo periodos de facturas:', error);
    return {
      success: false,
      message: error.message || 'Error al obtener periodos disponibles'
    };
  }
}


   /**
   * Listr los servicos adicionales 
   */
  async getServiciosActivos() {
    try {
      // ✅ USAR EL ENDPOINT CORRECTO DEFINIDO EN API_CONFIG
      const data = await this.makeRequest(
        API_CONFIG.endpoints.serviciosActivos,  // ← Cambiar esta línea
        { method: 'GET' }
      );
      
      console.log('✅ Servicios activos cargados:', data);
      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error('❌ Error obteniendo servicios activos:', error);
      return {
        success: false,
        data: [],
        message: error.message || 'Error al obtener servicios'
      };
    }
  }

  /**
   * Aplicar servicios a una factura individual
   */
  async aplicarServiciosIndividual(facturaId, servicios) {
    try {
      const data = await this.makeRequest(
        `${API_CONFIG.endpoints.facturas}/${facturaId}/aplicar-servicios`,
        {
          method: 'POST',
          body: servicios // Array de IDs
        }
      );

      // Limpiar cachés
      this.cachedFacturas = null;
      this.cachedStats = null;

      return {
        success: true,
        data: data,
        message: data.message || 'Servicios aplicados correctamente'
      };
    } catch (error) {
      console.error('❌ Error aplicando servicios:', error);
      return {
        success: false,
        message: error.message || 'Error al aplicar servicios'
      };
    }
  }
   /**
   * Aplicar servicios a TODAS LAS  factura
   */
  async aplicarServiciosMasivo(data) {
    try {
      const result = await this.makeRequest(
        `${API_CONFIG.endpoints.facturas}/aplicar-servicios-masivo`,
        {
          method: 'POST',
          body: data  // { id_servicios: [...], periodo: "2024-12" }
        }
      );
      
      // Limpiar cachés
      this.cachedFacturas = null;
      this.cachedStats = null;
      
      return {
        success: true,
        ...result
      };
    } catch (error) {
      console.error('❌ Error aplicando servicios masivo:', error);
      return {
        success: false,
        message: error.message || 'Error al aplicar servicios'
      };
    }
  }

  /**
   * Obtener caché de facturas
   */
  getCachedFacturas() {
    return this.cachedFacturas || [];
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
    this.cachedFacturas = null;
    this.cachedStats = null;
  }
 

}

const invoicesServices = new InvoicesServices();
export default invoicesServices;
export { InvoicesServices };
