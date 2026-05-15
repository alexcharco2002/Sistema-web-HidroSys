/**
 * src/services/paymentsServices.js
 * Servicio de Gestión de Pagos
 * ✅ Integrado con router FastAPI de pagos
 */

import authService from './authServices';

const API_CONFIG = {
baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
  endpoints: {
    pagos: '/pagos',                         
    stats: '/pagos/stats/resumen',             
    anular: id => `/pagos/${id}/anular`,       
    periodos: '/pagos/periodos/disponibles',
    porFactura: idFactura => `/pagos/factura/${idFactura}`,
    porAfiliado: idAfiliado => `/pagos/afiliado/${idAfiliado}`,
    statsFacturasPeriodo: '/pagos/stats/facturas-periodo', 
    facturasPeriodo: '/pagos/facturas-periodo',
    facturasmontos: '/pagos/facturas-montos',
    calcularResumen: (facturaId) => `/pagos/calcular-resumen/${facturaId}`,
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
    const requestStart = performance.now();
    
    const defaultOptions = {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${authService.getToken()}`
      },
      timeout: 120000,
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
      console.log(`[PAYMENTS API] fetch ${finalOptions.method} ${endpoint}: ${((performance.now() - requestStart) / 1000).toFixed(3)}s`);
      
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
      console.log(`[PAYMENTS API] parse json ${finalOptions.method} ${endpoint}: ${((performance.now() - requestStart) / 1000).toFixed(3)}s`);
      console.log(`✅ API Response:`, data);
      return data;
      
    } catch (error) {
      console.error(`❌ API Error:`, error);
      
      console.error(`[PAYMENTS API] error ${finalOptions.method} ${endpoint}: ${((performance.now() - requestStart) / 1000).toFixed(3)}s`);
      if (error.name === 'AbortError') {
        throw new Error('La petición tardó demasiado tiempo');
      }
      
      if (error.message.includes('Failed to fetch')) {
        throw new Error('No se pudo conectar con el servidor');
      }
      
      throw error;
    }
  }

  // 
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

      console.log('🔍 Fetching facturas desde:', endpoint); 
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

  // Obtener montos de una factura (total, adeudo, mora, etc)
  async getFacturaMontos(idFactura) {
    try {
      const endpoint = `/pagos/factura/${idFactura}/montos`;
      const data = await this.makeRequest(endpoint);
      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error('❌ Error obteniendo montos de factura:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener montos'
      };
    }
  }

  // Obtener facturas pendientes de un afiliado para el periodo actual
 async getFacturasPendientesAfiliado(idUsuarioAfi, periodoActual, aplicarMora, idMedidor) {
    // ✅ Validación de parámetros
    if (!idUsuarioAfi) {
      console.error('❌ idUsuarioAfi es requerido');
      return { 
        success: false, 
        message: 'ID de afiliado es requerido' 
      };
    }

    if (!periodoActual) {
      console.error('❌ periodoActual es requerido');
      return { 
        success: false, 
        message: 'Periodo actual es requerido' 
      };
    }

    if (!idMedidor) {
        console.warn(`getFacturasPendientesAfiliado: sin id_medidor para afiliado ${idUsuarioAfi} — puede mezclar datos`);
    }

    // ✅ Validar formato del periodo (YYYY-MM)
    const periodoRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
    if (!periodoRegex.test(periodoActual)) {
      console.error('❌ Formato de periodo inválido:', periodoActual);
      return { 
        success: false, 
        message: 'Formato de periodo inválido. Use YYYY-MM (ej: 2026-01)' 
      };
    }

    try {
      // Construir URL con parámetros
      const params = new URLSearchParams();
      params.append('periodo_actual', periodoActual);
      
      if (aplicarMora) {
        params.append('aplicar_mora', 'true');
      }

      if (idMedidor) params.append('id_medidor', idMedidor);
      
      const endpoint = `/pagos/afiliado/${idUsuarioAfi}/facturas-pendientes?${params.toString()}`;
      
      console.log('🔍 Consultando facturas pendientes:', {
        idUsuarioAfi,
        periodoActual,
        aplicarMora,
        idMedidor,
        endpoint
      });
      
      const data = await this.makeRequest(endpoint);
      
      console.log('✅ Facturas pendientes obtenidas:', {
        afiliado: idUsuarioAfi,
        medidor: idMedidor,
        tiene_deuda: data.tiene_deuda,
        meses_adeudo: data.meses_adeudo,
        total_adeudado: data.total_adeudado,
        facturas: data.total_facturas_pendientes
      });
      
      return { 
        success: true, 
        data: data 
      };
    } catch (error) {
      console.error('❌ Error obteniendo facturas pendientes del afiliado:', {
        idUsuarioAfi,
        periodoActual,
        error: error.message
      });
      
      return { 
        success: false, 
        message: error.message || 'Error al obtener facturas pendientes' 
      };
    }
  }

  // Obtener periodo actual en formato YYYY-MM
  static getPeriodoActual() {
    const hoy = new Date();
    const anio = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    return `${anio}-${mes}`;
  }

  // Validar formato de periodo (YYYY-MM) 
  static validarPeriodo(periodo) {
    const regex = /^\d{4}-(0[1-9]|1[0-2])$/;
    return regex.test(periodo);
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
   * Obtener una factura completa con conceptos y pagos
   */
  async getFacturaDetalle(idFactura) {
    try {
      const data = await this.makeRequest(`${API_CONFIG.endpoints.pagos}/facturas/${idFactura}`);
      
      return {
        success: true,
        data: data
      };
      
    } catch (error) {
      console.error('Error obteniendo detalle de factura:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener detalle de factura'
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

  // En paymentsServices.js
  async getStatsByPeriodo(periodo) {
    try {
      // Usa el endpoint correcto
      const endpoint = `${API_CONFIG.endpoints.statsFacturasPeriodo}?periodo=${periodo}`;
      const data = await this.makeRequest(endpoint);
      
      this.cachedStats = data;
      
      return {
        success: true,
        data: data
      };
      
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas del periodo:', error);
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
   * Calcular resumen de pago con mora (ANTES de registrar)
   */
  async calcularResumenPago(facturaId) {
    try {
      const data = await this.makeRequest(`${API_CONFIG.endpoints.calcularResumen(facturaId)}`);
      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error('❌ Error calculando resumen de pago:', error);
      return {
        success: false,
        message: error.message || 'Error al calcular el resumen',
        data: null
      };
    }
  }

  /**
   * Registrar un nuevo pago
   */
  async createPago(pagoData) {
    const t0 = performance.now();
    try {
      const montoPago = Number.parseFloat(Number(pagoData.monto_pago || 0).toFixed(2));
      console.log('[PAGO IND FRONT] 1 preparar payload:', {
        segundos: ((performance.now() - t0) / 1000).toFixed(3),
        id_factura: pagoData.id_factura,
        id_usuario_afi: pagoData.id_usuario_afi,
        monto_pago: montoPago
      });
      const data = await this.makeRequest(API_CONFIG.endpoints.pagos, {
        method: 'POST',
        body: {
          id_factura: pagoData.id_factura ? parseInt(pagoData.id_factura) : null,
          monto_pago: montoPago,
          fecha_pago: pagoData.fecha_pago || new Date().toISOString(),
          metodo_pago: pagoData.metodo_pago || 'EFECTIVO',
          id_usuario_afi: pagoData.id_usuario_afi ? parseInt(pagoData.id_usuario_afi) : null,
          id_cajero: pagoData.id_cajero ? parseInt(pagoData.id_cajero) : null,
          observaciones: pagoData.observaciones || null,
          estado_pago: pagoData.estado_pago || 'REGISTRADO',
          incluir_multas: pagoData.incluir_multas !== undefined ? pagoData.incluir_multas : true,
          incluir_mora: pagoData.incluir_mora !== undefined ? pagoData.incluir_mora : true,
          incluir_consumos: pagoData.incluir_consumos !== undefined ? pagoData.incluir_consumos : true
        }
      });
      console.log(`[PAGO IND FRONT] 2 backend respondio: ${((performance.now() - t0) / 1000).toFixed(3)}s`);

      console.log('📤 Datos enviados al backend:', {
        monto_pago: montoPago,
        incluir_multas: pagoData.incluir_multas,
        incluir_mora: pagoData.incluir_mora,
        incluir_consumos: pagoData.incluir_consumos,
        id_factura: pagoData.id_factura
      });

      // Limpiar cachés
      this.cachedPagos = null;
      this.cachedStats = null;
      console.log(`[PAGO IND FRONT] TOTAL: ${((performance.now() - t0) / 1000).toFixed(3)}s`);

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
   * Anula un pago con opción de regenerar factura
   */
  async anularPagoConRegeneracion(idPago, motivo, regenerarFactura = true) {
    try {
      const endpoint = `${API_CONFIG.endpoints.anular(idPago)}`;
      
      const data = await this.makeRequest(endpoint, {
        method: 'PATCH',
        body: {
          motivo: motivo,
          regenerar_factura: regenerarFactura  // ✅ Flag controlado por el usuario
        }
      });
      
      return {
        success: true,
        data: data
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
 * Subir comprobante PDF para un pago
 */
async uploadComprobante(idPago, file) {
  const t0 = performance.now();
  try {
    console.log(`📤 Subiendo comprobante para pago ${idPago}...`);
    console.log('📄 Archivo:', file.name, `(${(file.size / 1024).toFixed(2)} KB)`);

    // Validar archivo
    if (!file) {
      throw new Error('No se proporcionó ningún archivo');
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      throw new Error('Solo se permiten archivos PDF');
    }

    // Validar tamaño (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      throw new Error(`El archivo excede 5MB (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    }

    // Crear FormData con el nombre correcto del campo
    const formData = new FormData();
    formData.append('comprobante', file); // ✅ CAMBIAR DE 'file' A 'comprobante'

    console.log(`[COMP FRONT] 1 formData pago=${idPago}: ${((performance.now() - t0) / 1000).toFixed(3)}s`);
    const url = `${API_CONFIG.baseURL}/pagos/${idPago}/comprobante`;
    
    console.log('🌐 Enviando a:', url);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authService.getToken()}`
        // NO incluir 'Content-Type' - fetch lo establece automáticamente
      },
      body: formData
    });

    console.log('📡 Response status:', response.status);

    console.log(`[COMP FRONT] 2 fetch pago=${idPago}: ${((performance.now() - t0) / 1000).toFixed(3)}s`);
    if (!response.ok) {
      let errorMessage = 'Error al subir comprobante';
      try {
        const errorData = await response.json();
        console.error('❌ Error del servidor:', errorData);
        errorMessage = errorData.detail || errorData.message || errorMessage;
      } catch (e) {
        errorMessage = `Error HTTP ${response.status}`;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log(`[COMP FRONT] 3 parse json pago=${idPago}: ${((performance.now() - t0) / 1000).toFixed(3)}s`);
    console.log(`[COMP FRONT] TOTAL pago=${idPago}: ${((performance.now() - t0) / 1000).toFixed(3)}s`);
    console.log('✅ Respuesta del servidor:', data);
    
    return {
      success: true,
      data: data.data || data,
      message: data.message || 'Comprobante subido exitosamente'
    };
    
  } catch (error) {
    console.error(`[COMP FRONT] ERROR pago=${idPago}: ${((performance.now() - t0) / 1000).toFixed(3)}s`);
    console.error('❌ Error subiendo comprobante:', error);
    throw error; // ✅ Lanzar el error para que handleCreatePago lo capture
  }
}

/**
 * Descargar comprobante PDF de un pago
 */
async downloadComprobante(idPago) {
  try {
    console.log(`📥 Descargando comprobante del pago ${idPago}...`);
    
    const url = `${API_CONFIG.baseURL}/pagos/${idPago}/comprobante`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authService.getToken()}`
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('El pago no tiene comprobante');
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'No se pudo descargar el comprobante');
    }

    // Obtener el nombre del archivo desde los headers
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = `comprobante_pago_${idPago}.pdf`;
    
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].replace(/['"]/g, '');
      }
    }

    // Convertir la respuesta a blob
    const blob = await response.blob();

    console.log('📄 Blob recibido:', {
      size: blob.size,
      type: blob.type,
      filename: filename
    });

    if (blob.size === 0) {
      throw new Error('El PDF está vacío');
    }

    // Crear URL temporal y descargar
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Limpiar URL después de un segundo
    setTimeout(() => {
      window.URL.revokeObjectURL(blobUrl);
    }, 1000);

    console.log('✅ Descarga iniciada:', filename);

    return {
      success: true,
      message: 'Comprobante descargado exitosamente',
      filename: filename
    };
    
  } catch (error) {
    console.error('❌ Error descargando comprobante:', error);
    return {
      success: false,
      message: error.message || 'No se pudo descargar el comprobante'
    };
  }
}
// services/paymentsServices.js

// 
async createPagoMultiple(pagoMultipleData) {
  const t0 = performance.now();
  try {
    // ✅ El payload ya viene bien formado desde handlePagoMultiple,
    //    solo aseguramos los tipos críticos que Pydantic valida como integer > 0
    const body = {
      facturas: pagoMultipleData.facturas.map(f => ({
        id_factura:       parseInt(f.id_factura, 10),           // ✅ ya viene con underscore
        monto_a_pagar:    parseFloat(f.monto_a_pagar) || 0.01,  // fallback mínimo
        incluir_multas:   f.incluir_multas  ?? true,
        incluir_mora:     f.incluir_mora    ?? true,
        incluir_consumos: f.incluir_consumos ?? true,
      })),
      metodo_pago:    pagoMultipleData.metodo_pago    || 'EFECTIVO',
      id_usuario_afi: pagoMultipleData.id_usuario_afi
                        ? parseInt(pagoMultipleData.id_usuario_afi, 10)
                        : null,
      id_cajero:      pagoMultipleData.id_cajero
                        ? parseInt(pagoMultipleData.id_cajero, 10)
                        : null,
      observaciones:  pagoMultipleData.observaciones  || null,
    };

    body.facturas = body.facturas.map(f => ({
      ...f,
      monto_a_pagar: Number.parseFloat(Number(f.monto_a_pagar || 0.01).toFixed(2)),
    }));
    console.log('[PAGO MULT FRONT] 1 preparar payload:', {
      segundos: ((performance.now() - t0) / 1000).toFixed(3),
      cantidad_facturas: body.facturas.length,
      id_usuario_afi: body.id_usuario_afi,
      id_cajero: body.id_cajero
    });

    // 🔍 Verificar antes de enviar
    console.log('📤 Body enviado al backend:', JSON.stringify(body, null, 2));

    // Validación previa — detectar IDs inválidos antes de que falle Pydantic
    body.facturas.forEach((f, i) => {
      if (!f.id_factura || f.id_factura <= 0 || isNaN(f.id_factura)) {
        throw new Error(`Factura [${i}]: id_factura inválido → ${f.id_factura}`);
      }
    });
    if (!body.id_cajero || body.id_cajero <= 0) {
      throw new Error(`id_cajero inválido → ${body.id_cajero}`);
    }

    const data = await this.makeRequest(
      `${API_CONFIG.endpoints.pagos}/multiple`,
      { method: 'POST', body }
    );
    console.log(`[PAGO MULT FRONT] 2 backend respondio: ${((performance.now() - t0) / 1000).toFixed(3)}s`);

    this.cachedPagos = null;
    this.cachedStats = null;
    console.log(`[PAGO MULT FRONT] TOTAL: ${((performance.now() - t0) / 1000).toFixed(3)}s`);

    return {
      success: true,
      data,
      message: 'Pago múltiple registrado exitosamente'
    };

  } catch (error) {
    console.error('❌ Error registrando pago múltiple:', error);
    // ✅ Re-lanzar para que handlePagoMultiple lo capture en su try/catch
    throw error;
  }
}


/**
 * Eliminar comprobante de un pago
 */
async deleteComprobante(idPago) {
  try {
    console.log(`🗑️ Eliminando comprobante del pago ${idPago}...`);
    
    const url = `${API_CONFIG.baseURL}/pagos/${idPago}/comprobante`;
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authService.getToken()}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Error al eliminar comprobante');
    }

    const data = await response.json();
    console.log('✅ Comprobante eliminado');

    return {
      success: true,
      data: data,
      message: data.message || 'Comprobante eliminado exitosamente'
    };
    
  } catch (error) {
    console.error('❌ Error eliminando comprobante:', error);
    throw error;
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
