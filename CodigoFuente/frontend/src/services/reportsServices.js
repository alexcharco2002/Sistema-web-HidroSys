/**
 * src/services/reportsServices.js
 * Servicio especializado para gestión de reportes y estadísticas del sistema
 */

import authService from './authServices';

const API_CONFIG = {
  baseURL: 'https://localhost:8000',
  endpoints: {
    // Endpoints de reportes por módulo - AHORA APUNTAN A /reportes
    usuarios: '/reportes/usuarios',
    roles: '/reportes/roles',
    afiliados: '/reportes/afiliados',
    medidores: '/reportes/medidores',
    sectores: '/reportes/sectores',
    tarifas: '/reportes/tarifas',
    geolocalizacion: '/reportes/geolocalizacion',
    servicios: '/reportes/servicios',
    lecturas: '/reportes/lecturas',
    facturas: '/reportes/facturas',
    pagos: '/reportes/pagos',
    multas: '/reportes/multas',
    multasAfiliados: '/reportes/multas-afiliados',
    configuracion: '/reportes/configuracion',
    notificaciones: '/reportes/notificaciones',
    estadisticas: '/reportes/estadisticas',
    historialConsumo: '/reportes/historial-consumo',
    
    // Endpoint de exportación
    exportar: (modulo) => `/reportes/exportar/${modulo}`
  }
};

class ReportsServices {
  constructor() {
    this.cachedReports = {};
  }

  // ============================================================
  // MÉTODOS DE COMUNICACIÓN HTTP
  // ============================================================

  /**
   * Realizar petición HTTP con configuración común
   */
  async makeRequest(endpoint, options = {}) {
    const url = `${API_CONFIG.baseURL}${endpoint}`;
    
    const defaultOptions = {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authService.getToken()}`
      },
      timeout: 30000
    };

    const finalOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers
      }
    };

    if (finalOptions.body && typeof finalOptions.body === 'object') {
      finalOptions.body = JSON.stringify(finalOptions.body);
    }

    try {
      console.log(`🌐 API Request: ${finalOptions.method} ${url}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), finalOptions.timeout);
      
      const response = await fetch(url, {
        ...finalOptions,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let errorMessage = '';

        if (typeof errorData.detail === 'string') {
          errorMessage = errorData.detail;
        } else if (Array.isArray(errorData.detail)) {
          errorMessage = errorData.detail.map(err => err.msg).join(', ');
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

  // ============================================================
  // FUNCIONES DE GENERACIÓN DE REPORTES POR MÓDULO
  // ============================================================

  /**
   * Construir query string desde filtros
   */
  buildQueryString(filtros = {}) {
    const params = new URLSearchParams();
    
    Object.keys(filtros).forEach(key => {
      if (filtros[key] !== undefined && filtros[key] !== null && filtros[key] !== '') {
        params.append(key, filtros[key]);
      }
    });
    
    return params.toString();
  }

  /**
   * 1. Obtener reporte de USUARIOS
   */
  async getReporteUsuarios(filtros = {}) {
    try {
      const queryString = this.buildQueryString({
        skip: filtros.skip || 0,
        limit: filtros.limit || 1000,
        search: filtros.search,
        rol: filtros.rol,
        activo: filtros.activo,
        fecha_desde: filtros.fecha_desde,
        fecha_hasta: filtros.fecha_hasta
      });

      const url = queryString 
        ? `${API_CONFIG.endpoints.usuarios}?${queryString}`
        : API_CONFIG.endpoints.usuarios;

      const data = await this.makeRequest(url);

      return {
        success: true,
        data: Array.isArray(data) ? data : [],
        total: Array.isArray(data) ? data.length : 0
      };
    } catch (error) {
      console.error('❌ Error obteniendo reporte de usuarios:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener reporte de usuarios',
        data: []
      };
    }
  }

  /**
   * 2. Obtener reporte de ROLES
   */
  async getReporteRoles(filtros = {}) {
    try {
      const queryString = this.buildQueryString({
        skip: filtros.skip || 0,
        limit: filtros.limit || 1000,
        search: filtros.search,
        activo: filtros.activo
      });

      const url = queryString 
        ? `${API_CONFIG.endpoints.roles}?${queryString}`
        : API_CONFIG.endpoints.roles;

      const data = await this.makeRequest(url);

      return {
        success: true,
        data: Array.isArray(data) ? data : [],
        total: Array.isArray(data) ? data.length : 0
      };
    } catch (error) {
      console.error('❌ Error obteniendo reporte de roles:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener reporte de roles',
        data: []
      };
    }
  }

  /**
   * 3. Obtener reporte de AFILIADOS
   */
  async getReporteAfiliados(filtros = {}) {
    try {
      const queryString = this.buildQueryString({
        skip: filtros.skip || 0,
        limit: filtros.limit || 1000,
        search: filtros.search,
        sector: filtros.sector,
        estado: filtros.estado,
        fecha_desde: filtros.fecha_desde,
        fecha_hasta: filtros.fecha_hasta
      });

      const url = queryString 
        ? `${API_CONFIG.endpoints.afiliados}?${queryString}`
        : API_CONFIG.endpoints.afiliados;

      const data = await this.makeRequest(url);

      return {
        success: true,
        data: Array.isArray(data) ? data : [],
        total: Array.isArray(data) ? data.length : 0
      };
    } catch (error) {
      console.error('❌ Error obteniendo reporte de afiliados:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener reporte de afiliados',
        data: []
      };
    }
  }

  /**
   * 4. Obtener reporte de MEDIDORES
   */
  async getReporteMedidores(filtros = {}) {
    try {
      const queryString = this.buildQueryString({
        skip: filtros.skip || 0,
        limit: filtros.limit || 1000,
        search: filtros.search,
        sector: filtros.sector,
        estado: filtros.estado,
        tipo: filtros.tipo
      });

      const url = queryString 
        ? `${API_CONFIG.endpoints.medidores}?${queryString}`
        : API_CONFIG.endpoints.medidores;

      const data = await this.makeRequest(url);

      return {
        success: true,
        data: Array.isArray(data) ? data : [],
        total: Array.isArray(data) ? data.length : 0
      };
    } catch (error) {
      console.error('❌ Error obteniendo reporte de medidores:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener reporte de medidores',
        data: []
      };
    }
  }

  /**
   * 5. Obtener reporte de SECTORES
   */
  async getReporteSectores(filtros = {}) {
    try {
      const queryString = this.buildQueryString({
        skip: filtros.skip || 0,
        limit: filtros.limit || 1000,
        search: filtros.search,
        activo: filtros.activo
      });

      const url = queryString 
        ? `${API_CONFIG.endpoints.sectores}?${queryString}`
        : API_CONFIG.endpoints.sectores;

      const data = await this.makeRequest(url);

      return {
        success: true,
        data: Array.isArray(data) ? data : [],
        total: Array.isArray(data) ? data.length : 0
      };
    } catch (error) {
      console.error('❌ Error obteniendo reporte de sectores:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener reporte de sectores',
        data: []
      };
    }
  }

  /**
   * 6. Obtener reporte de LECTURAS
   */
  async getReporteLecturas(filtros = {}) {
    try {
      const queryString = this.buildQueryString({
        skip: filtros.skip || 0,
        limit: filtros.limit || 1000,
        fecha_desde: filtros.fecha_desde,
        fecha_hasta: filtros.fecha_hasta,
        sector: filtros.sector,
        tipo_lectura: filtros.tipo_lectura,
        lector_id: filtros.lector_id
      });

      const url = queryString 
        ? `${API_CONFIG.endpoints.lecturas}?${queryString}`
        : API_CONFIG.endpoints.lecturas;

      const data = await this.makeRequest(url);

      return {
        success: true,
        data: Array.isArray(data) ? data : [],
        total: Array.isArray(data) ? data.length : 0
      };
    } catch (error) {
      console.error('❌ Error obteniendo reporte de lecturas:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener reporte de lecturas',
        data: []
      };
    }
  }

  /**
   * 7. Obtener reporte de FACTURAS
   */
  async getReporteFacturas(filtros = {}) {
    try {
      const queryString = this.buildQueryString({
        skip: filtros.skip || 0,
        limit: filtros.limit || 1000,
        fecha_desde: filtros.fecha_desde,
        fecha_hasta: filtros.fecha_hasta,
        estado: filtros.estado,
        periodo: filtros.periodo
      });

      const url = queryString 
        ? `${API_CONFIG.endpoints.facturas}?${queryString}`
        : API_CONFIG.endpoints.facturas;

      const data = await this.makeRequest(url);

      // Las facturas pueden venir con estadísticas
      if (data.facturas && data.estadisticas) {
        return {
          success: true,
          data: data.facturas,
          total: data.facturas.length,
          estadisticas: data.estadisticas
        };
      }

      return {
        success: true,
        data: Array.isArray(data) ? data : [],
        total: Array.isArray(data) ? data.length : 0
      };
    } catch (error) {
      console.error('❌ Error obteniendo reporte de facturas:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener reporte de facturas',
        data: []
      };
    }
  }

  /**
   * 8. Obtener reporte de PAGOS
   */
  async getReportePagos(filtros = {}) {
    try {
      const queryString = this.buildQueryString({
        skip: filtros.skip || 0,
        limit: filtros.limit || 1000,
        fecha_desde: filtros.fecha_desde,
        fecha_hasta: filtros.fecha_hasta,
        metodo_pago: filtros.metodo_pago,
        estado: filtros.estado
      });

      const url = queryString 
        ? `${API_CONFIG.endpoints.pagos}?${queryString}`
        : API_CONFIG.endpoints.pagos;

      const data = await this.makeRequest(url);

      // Los pagos pueden venir con estadísticas
      if (data.pagos && data.estadisticas) {
        return {
          success: true,
          data: data.pagos,
          total: data.pagos.length,
          estadisticas: data.estadisticas
        };
      }

      return {
        success: true,
        data: Array.isArray(data) ? data : [],
        total: Array.isArray(data) ? data.length : 0
      };
    } catch (error) {
      console.error('❌ Error obteniendo reporte de pagos:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener reporte de pagos',
        data: []
      };
    }
  }

  /**
   * 9. Obtener reporte de MULTAS
   */
  async getReporteMultas(filtros = {}) {
    try {
      const queryString = this.buildQueryString({
        skip: filtros.skip || 0,
        limit: filtros.limit || 1000,
        fecha_desde: filtros.fecha_desde,
        fecha_hasta: filtros.fecha_hasta,
        estado: filtros.estado,
        tipo: filtros.tipo
      });

      const url = queryString 
        ? `${API_CONFIG.endpoints.multas}?${queryString}`
        : API_CONFIG.endpoints.multas;

      const data = await this.makeRequest(url);

      return {
        success: true,
        data: Array.isArray(data) ? data : [],
        total: Array.isArray(data) ? data.length : 0
      };
    } catch (error) {
      console.error('❌ Error obteniendo reporte de multas:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener reporte de multas',
        data: []
      };
    }
  }

  /**
   * 10. Obtener reporte de TARIFAS
   */
  async getReporteTarifas(filtros = {}) {
    try {
      const queryString = this.buildQueryString({
        skip: filtros.skip || 0,
        limit: filtros.limit || 1000,
        activo: filtros.activo
      });

      const url = queryString 
        ? `${API_CONFIG.endpoints.tarifas}?${queryString}`
        : API_CONFIG.endpoints.tarifas;

      const data = await this.makeRequest(url);

      return {
        success: true,
        data: Array.isArray(data) ? data : [],
        total: Array.isArray(data) ? data.length : 0
      };
    } catch (error) {
      console.error('❌ Error obteniendo reporte de tarifas:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener reporte de tarifas',
        data: []
      };
    }
  }

  /**
   * 11. Obtener reporte de SERVICIOS
   */
  async getReporteServicios(filtros = {}) {
    try {
      const queryString = this.buildQueryString(filtros);
      const url = queryString 
        ? `${API_CONFIG.endpoints.servicios}?${queryString}`
        : API_CONFIG.endpoints.servicios;

      const data = await this.makeRequest(url);
      return {
        success: true,
        data: Array.isArray(data) ? data : [],
        total: Array.isArray(data) ? data.length : 0
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        data: []
      };
    }
  }

  /**
   * 12-17. Reportes pendientes de implementación en backend
   */
  async getReporteNotificaciones(filtros = {}) {
    return this.getReporteGenerico('notificaciones', filtros);
  }

  async getReporteGeolocalizacion(filtros = {}) {
    return this.getReporteGenerico('geolocalizacion', filtros);
  }

  async getReporteMultasAfiliados(filtros = {}) {
    return this.getReporteGenerico('multasAfiliados', filtros);
  }

  async getReporteConfiguracion(filtros = {}) {
    return this.getReporteGenerico('configuracion', filtros);
  }

  async getReporteEstadisticas(filtros = {}) {
    return this.getReporteGenerico('estadisticas', filtros);
  }

  async getReporteHistorialConsumo(filtros = {}) {
    return this.getReporteGenerico('historialConsumo', filtros);
  }

  // ============================================================
  // FUNCIÓN GENÉRICA PARA MÓDULOS
  // ============================================================

  /**
   * Función genérica para módulos sin implementación específica
   */
  async getReporteGenerico(modulo, filtros = {}) {
    try {
      const endpoint = API_CONFIG.endpoints[modulo];
      if (!endpoint) {
        throw new Error(`Endpoint no configurado para ${modulo}`);
      }

      const queryString = this.buildQueryString(filtros);
      const url = queryString ? `${endpoint}?${queryString}` : endpoint;

      const data = await this.makeRequest(url);

      return {
        success: true,
        data: Array.isArray(data) ? data : [],
        total: Array.isArray(data) ? data.length : 0
      };
    } catch (error) {
      console.error(`❌ Error obteniendo reporte de ${modulo}:`, error);
      return {
        success: false,
        message: error.message || `Error al obtener reporte de ${modulo}`,
        data: []
      };
    }
  }

  /**
   * Router principal - Obtener reporte por módulo
   */
  async getReporteByModulo(modulo, filtros = {}) {
    const moduloLower = modulo.toLowerCase();
    
    const reporteFunctions = {
      'usuarios': () => this.getReporteUsuarios(filtros),
      'roles': () => this.getReporteRoles(filtros),
      'afiliados': () => this.getReporteAfiliados(filtros),
      'medidores': () => this.getReporteMedidores(filtros),
      'sectores': () => this.getReporteSectores(filtros),
      'tarifas': () => this.getReporteTarifas(filtros),
      'lecturas': () => this.getReporteLecturas(filtros),
      'facturas': () => this.getReporteFacturas(filtros),
      'pagos': () => this.getReportePagos(filtros),
      'multas': () => this.getReporteMultas(filtros),
      'servicios': () => this.getReporteServicios(filtros),
      'multasafiliados': () => this.getReporteMultasAfiliados(filtros),
      'geolocalizacion': () => this.getReporteGeolocalizacion(filtros),
      'configuracion': () => this.getReporteConfiguracion(filtros),
      'notificaciones': () => this.getReporteNotificaciones(filtros),
      'estadisticas': () => this.getReporteEstadisticas(filtros),
      'historialconsumo': () => this.getReporteHistorialConsumo(filtros)
    };

    const reporteFunction = reporteFunctions[moduloLower];
    
    if (reporteFunction) {
      return await reporteFunction();
    } else {
      return {
        success: false,
        message: `Módulo ${modulo} no implementado`,
        data: []
      };
    }
  }

  // ============================================================
  // FUNCIONES DE EXPORTACIÓN
  // ============================================================

  /**
   * Exportar reporte a CSV o Excel
   */
  async exportarReporte(modulo, formato = 'csv', filtros = {}) {
    try {
      const queryString = this.buildQueryString(filtros);
      const url = `${API_CONFIG.baseURL}${API_CONFIG.endpoints.exportar(modulo)}?formato=${formato}${queryString ? '&' + queryString : ''}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authService.getToken()}`
        }
      });

      if (!response.ok) {
        throw new Error('Error al exportar reporte');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `reporte_${modulo}_${new Date().toISOString().split('T')[0]}.${formato}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      return {
        success: true,
        message: 'Reporte exportado exitosamente'
      };
    } catch (error) {
      console.error('❌ Error exportando reporte:', error);
      return {
        success: false,
        message: error.message || 'Error al exportar reporte'
      };
    }
  }

  // ============================================================
  // FUNCIONES DE UTILIDAD
  // ============================================================

  /**
   * Limpiar caché de reportes
   */
  clearCache() {
    this.cachedReports = {};
  }

  /**
   * Obtener caché de un reporte
   */
  getCachedReport(key) {
    return this.cachedReports[key];
  }

  /**
   * Guardar reporte en caché
   */
  setCachedReport(key, data) {
    this.cachedReports[key] = {
      data,
      timestamp: Date.now()
    };
  }
}

// Exportar instancia única del servicio
const reportsServices = new ReportsServices();
export default reportsServices;
export { ReportsServices };