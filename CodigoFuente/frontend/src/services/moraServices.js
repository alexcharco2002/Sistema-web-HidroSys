/**
 * src/services/moraServices.js
 * Servicio de Gestión de Mora (Intereses por pago tardío)
 */

import authService from './authServices';

const API_CONFIG = {
  baseURL: 'https://localhost:8000',
  endpoints: {
    list: '/mora/',                           // GET - Listar todas
    vigente: '/mora/vigente',                 // GET - Configuración vigente actual
    stats: '/mora/stats',                     // GET - Estadísticas
    getById: (id) => `/mora/${id}`,          // GET
    create: '/mora/',                         // POST
    update: (id) => `/mora/${id}`,           // PUT
    delete: (id) => `/mora/${id}`,           // DELETE
    activar: (id) => `/mora/${id}/activar`,  // PATCH
    desactivar: (id) => `/mora/${id}/desactivar`, // PATCH
  }
};

class MoraService {
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

      // ✅ Manejar 204 No Content (sin body)
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
  // GESTIÓN DE MORA - LECTURA
  // ========================================

  /**
   * Listar todas las configuraciones de mora
   */
  async listConfiguraciones(params = {}) {
    try {
      const queryParams = new URLSearchParams();
      if (params.skip !== undefined) queryParams.append('skip', params.skip);
      if (params.limit !== undefined) queryParams.append('limit', params.limit);
      if (params.activo !== undefined) queryParams.append('activo', params.activo);
      if (params.es_vigente !== undefined) queryParams.append('es_vigente', params.es_vigente);
      if (params.tipo_calculo !== undefined) queryParams.append('tipo_calculo', params.tipo_calculo);

      const queryString = queryParams.toString();
      const endpoint = queryString ? `${API_CONFIG.endpoints.list}?${queryString}` : API_CONFIG.endpoints.list;

      const data = await this.makeRequest(endpoint);

      return {
        success: true,
        data: Array.isArray(data) ? data : []
      };
    } catch (error) {
      console.error('❌ Error listando configuraciones de mora:', error);
      return {
        success: false,
        message: error.message || 'Error al listar configuraciones de mora',
        data: []
      };
    }
  }

  /**
   * Obtener la configuración de mora vigente actual
   */
  async getConfiguracionVigente() {
    try {
      const data = await this.makeRequest(API_CONFIG.endpoints.vigente);
      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error('❌ Error obteniendo configuración vigente:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener la configuración vigente',
        data: null
      };
    }
  }

  /**
   * Obtener estadísticas de configuraciones de mora
   */
  async getStats() {
    try {
      const data = await this.makeRequest(API_CONFIG.endpoints.stats);
      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas de mora:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener estadísticas'
      };
    }
  }

  /**
   * Obtener una configuración de mora por ID
   */
  async getConfiguracionById(id) {
    try {
      const data = await this.makeRequest(API_CONFIG.endpoints.getById(id));
      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error('❌ Error obteniendo configuración de mora:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener la configuración'
      };
    }
  }

  // ========================================
  // GESTIÓN DE MORA - CREACIÓN
  // ========================================

  /**
   * Crear una nueva configuración de mora
   * NOTA: Siempre se crea desactivada (activo=false) y no aplicable (aplicar_mora=false)
   */
  async createConfiguracion(moraData) {
    try {
      this.validateMoraData(moraData);

      const data = await this.makeRequest(
        API_CONFIG.endpoints.create,
        {
          method: 'POST',
          body: moraData
        }
      );

      return {
        success: true,
        message: 'Configuración de mora creada exitosamente (desactivada por defecto)',
        data: data
      };
    } catch (error) {
      console.error('❌ Error creando configuración de mora:', error);
      return {
        success: false,
        message: error.message || 'Error al crear la configuración de mora'
      };
    }
  }

  // ========================================
  // GESTIÓN DE MORA - ACTUALIZACIÓN
  // ========================================

  /**
   * Actualizar una configuración de mora
   * NOTA: No permite activar directamente desde aquí, use /activar
   */
  async updateConfiguracion(id, moraData) {
    try {
      const data = await this.makeRequest(
        API_CONFIG.endpoints.update(id),
        {
          method: 'PUT',
          body: moraData
        }
      );

      return {
        success: true,
        message: 'Configuración de mora actualizada exitosamente',
        data: data
      };
    } catch (error) {
      console.error('❌ Error actualizando configuración de mora:', error);
      return {
        success: false,
        message: error.message || 'Error al actualizar la configuración'
      };
    }
  }

  // ========================================
  // GESTIÓN DE MORA - ELIMINACIÓN
  // ========================================

  /**
   * Eliminar una configuración de mora
   */
  async deleteConfiguracion(id) {
    try {
      await this.makeRequest(
        API_CONFIG.endpoints.delete(id),
        {
          method: 'DELETE'
        }
      );

      return {
        success: true,
        message: 'Configuración de mora eliminada exitosamente'
      };
    } catch (error) {
      console.error('❌ Error eliminando configuración de mora:', error);
      return {
        success: false,
        message: error.message || 'Error al eliminar la configuración'
      };
    }
  }

  // ========================================
  // GESTIÓN DE MORA - ACTIVACIÓN/DESACTIVACIÓN
  // ========================================

  /**
   * Activar una configuración de mora específica
   * Desactiva automáticamente todas las demás configuraciones
   */
  async activarConfiguracion(id) {
    try {
      const data = await this.makeRequest(
        API_CONFIG.endpoints.activar(id),
        {
          method: 'PATCH'
        }
      );

      return {
        success: true,
        message: data?.mensaje || 'Configuración de mora activada exitosamente',
        data: data
      };
    } catch (error) {
      console.error('❌ Error activando configuración de mora:', error);
      return {
        success: false,
        message: error.message || 'Error al activar la configuración'
      };
    }
  }

  /**
   * Desactivar una configuración de mora específica
   */
  async desactivarConfiguracion(id) {
    try {
      const data = await this.makeRequest(
        API_CONFIG.endpoints.desactivar(id),
        {
          method: 'PATCH'
        }
      );

      return {
        success: true,
        message: data?.mensaje || 'Configuración de mora desactivada exitosamente',
        data: data
      };
    } catch (error) {
      console.error('❌ Error desactivando configuración de mora:', error);
      return {
        success: false,
        message: error.message || 'Error al desactivar la configuración'
      };
    }
  }

  // ========================================
  // VALIDACIONES
  // ========================================

  /**
   * Validar datos de configuración de mora
   */
validateMoraData(moraData) {
  if (!moraData.nombre || moraData.nombre.trim() === '') {
    throw new Error('El nombre de la configuración es requerido');
  }

  // ✅ NUEVO: Validar tipo_periodo
  if (!moraData.tipo_periodo) {
    throw new Error('El tipo de periodo es requerido');
  }

  const periodosValidos = ['dias', 'meses'];
  if (!periodosValidos.includes(moraData.tipo_periodo)) {
    throw new Error('El tipo de periodo debe ser: dias o meses');
  }

  // ✅ NUEVO: Validar que tenga el campo correcto según tipo_periodo
  if (moraData.tipo_periodo === 'dias' && moraData.dias_gracia === undefined) {
    throw new Error('Para tipo dias debe especificar dias_gracia');
  }

  if (moraData.tipo_periodo === 'meses' && moraData.meses_gracia === undefined) {
    throw new Error('Para tipo meses debe especificar meses_gracia');
  }

  if (!moraData.tipo_calculo) {
    throw new Error('El tipo de cálculo es requerido');
  }

  const tiposValidos = ['porcentaje', 'fijo', 'interes_diario'];
  if (!tiposValidos.includes(moraData.tipo_calculo)) {
    throw new Error('El tipo de cálculo debe ser: porcentaje, fijo o interes_diario');
  }

  // Validar según tipo de cálculo
  if (moraData.tipo_calculo === 'porcentaje') {
    if (!moraData.porcentaje_mora || moraData.porcentaje_mora <= 0) {
      throw new Error('Para tipo porcentaje debe especificar porcentaje_mora mayor a 0');
    }
  }

  if (moraData.tipo_calculo === 'fijo') {
    if (!moraData.valor_fijo || moraData.valor_fijo <= 0) {
      throw new Error('Para tipo fijo debe especificar valor_fijo mayor a 0');
    }
  }

  if (moraData.tipo_calculo === 'interes_diario') {
    if (!moraData.interes_diario || moraData.interes_diario <= 0) {
      throw new Error('Para tipo interes_diario debe especificar interes_diario mayor a 0');
    }
  }

  if (!moraData.vigencia_desde) {
    throw new Error('La fecha de vigencia desde es requerida');
  }

  // ✅ Validaciones específicas por tipo de periodo
  if (moraData.tipo_periodo === 'dias' && moraData.dias_gracia < 0) {
    throw new Error('Los días de gracia no pueden ser negativos');
  }

  if (moraData.tipo_periodo === 'meses') {
    if (moraData.meses_gracia < 0) {
      throw new Error('Los meses de gracia no pueden ser negativos');
    }
    if (moraData.meses_gracia > 12) {
      throw new Error('Los meses de gracia no pueden ser mayores a 12');
    }
  }
}

/**
 * Formatear periodo de gracia para mostrar
 */
formatPeriodoGracia(config) {
  if (!config) return '-';
  
  if (config.tipo_periodo === 'meses') {
    const meses = config.meses_gracia || 0;
    return `${meses} ${meses === 1 ? 'mes' : 'meses'}`;
  } else {
    const dias = config.dias_gracia || 0;
    return `${dias} ${dias === 1 ? 'día' : 'días'}`;
  }
}

/**
 * Obtener descripción detallada del periodo de gracia
 */
getDescripcionPeriodo(config) {
  if (!config) return '';
  
  if (config.tipo_periodo === 'meses') {
    if (config.meses_gracia === 0) {
      return 'Mora aplica el primer día del siguiente mes';
    } else {
      return `Mora aplica después de ${config.meses_gracia} ${config.meses_gracia === 1 ? 'mes' : 'meses'} de cambio de mes`;
    }
  } else {
    if (config.dias_gracia === 0) {
      return 'Mora aplica al día siguiente del vencimiento';
    } else {
      return `${config.dias_gracia} ${config.dias_gracia === 1 ? 'día' : 'días'} de gracia después del vencimiento`;
    }
  }
}



  // ========================================
  // UTILIDADES
  // ========================================

  /**
   * Formatear tipo de cálculo para mostrar
   */
  formatTipoCalculo(tipo) {
    const tipos = {
      'porcentaje': 'Porcentaje',
      'fijo': 'Valor Fijo',
      'interes_diario': 'Interés Diario'
    };
    return tipos[tipo] || tipo;
  }

  /**
   * Formatear valor de mora para mostrar
   */
  formatValorMora(config) {
    if (!config) return '-';

    switch (config.tipo_calculo) {
      case 'porcentaje':
        return `${parseFloat(config.porcentaje_mora || 0).toFixed(2)}%`;
      case 'fijo':
        return `$${parseFloat(config.valor_fijo || 0).toFixed(2)}`;
      case 'interes_diario':
        return `${parseFloat(config.interes_diario || 0).toFixed(4)}% diario`;
      default:
        return '-';
    }
  }

  /**
   * Obtener color para badge según estado
   */
  getColorBadge(config) {
    if (!config) return 'gray';
    
    if (config.activo && config.aplicar_mora) {
      return 'green'; // Activa y aplicando mora
    } else if (config.activo && !config.aplicar_mora) {
      return 'yellow'; // Activa pero no aplicando
    } else {
      return 'gray'; // Inactiva
    }
  }

  /**
   * Verificar si hay una configuración activa
   */
  async obtenerEstadoMora() {
    try {
      const result = await this.getConfiguracionVigente();
      const aplicarMora = result.success && result.data && result.data.aplicar_mora === true;
      
      console.log(`🎯 Estado mora: ${aplicarMora ? 'ACTIVADO' : 'DESACTIVADO'}`);
      
      return {
        success: true,
        aplicar_mora: aplicarMora,
        configuracion_activa: result.data
      };
    } catch (error) {
      console.error('❌ Error obteniendo estado de mora:', error);
      return {
        success: true, // No fallar, solo asumir desactivado
        aplicar_mora: false,
        configuracion_activa: null
      };
    }
  }
}

const moraService = new MoraService();
export default moraService;
export { MoraService };
