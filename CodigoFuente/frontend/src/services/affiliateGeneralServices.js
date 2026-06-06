/**
 * src/services/affiliateGeneralServices.js
 * Servicio para gestión de lecturas de afiliados
 */

import authService from './authServices';

const API_CONFIG = {
baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
  endpoints: {
    misLecturas: '/afiliados/mis-lecturas',
    periodosDisponibles: '/afiliados/periodos-disponibles',
    consumoPorPeriodo: '/afiliados/consumo-por-periodo',
    estadisticasGenerales: '/afiliados/estadisticas',
    exportarLecturas: '/afiliados/exportar-lecturas',
    misLecturasPeriodosDisponibles: '/afiliados/mis-lecturas/periodos-disponibles',
     tarifasVigentes: '/afiliados/tarifas-vigentes' ,
    // mis medidores: '/afiliados/mis-medidores' (si se necesita)
    misMedidores: '/afiliados/mis-medidores'

  }
};

const buildPeriodoConsumo = (anio, mes) => {
  if (!anio || !mes) return '';
  return `${anio}-${String(mes).padStart(2, '0')}`;
};

const getPeriodoFromDate = (fecha) => {
  if (!fecha || typeof fecha !== 'string') return '';
  const match = fecha.match(/^(\d{4})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}` : '';
};

const normalizePeriodoValue = (periodo) => {
  if (!periodo) return '';
  if (typeof periodo === 'object') {
    const periodoValue = periodo.periodo_consumo ||
      periodo.periodoconsumo ||
      periodo.periodoConsumo ||
      periodo.periodo_lectura ||
      periodo.periodolectura ||
      periodo.periodo;

    if (periodoValue) return normalizePeriodoValue(periodoValue);

    return buildPeriodoConsumo(
      periodo.anio_consumo || periodo.anioconsumo || periodo.anio_lectura || periodo.anio_periodo || periodo.anio || periodo.year,
      periodo.mes_consumo || periodo.mesconsumo || periodo.mes_lectura || periodo.mes_periodo || periodo.mes || periodo.month
    );
  }

  return String(periodo);
};

const normalizePeriodoConsumo = (item, fallbackPeriodo = '') => {
  const periodo = item?.periodo_consumo ||
    item?.periodoconsumo ||
    item?.periodoConsumo ||
    item?.periodo_lectura ||
    item?.periodolectura ||
    item?.periodo_facturacion ||
    item?.periodofacturacion ||
    item?.periodo;

  if (periodo) return normalizePeriodoValue(periodo);

  const anio = item?.anio_consumo || item?.anioconsumo || item?.anio_lectura || item?.anio_periodo || item?.anio || item?.year;
  const mes = item?.mes_consumo || item?.mesconsumo || item?.mes_lectura || item?.mes_periodo || item?.mes || item?.month;
  const periodoDesdeCampos = buildPeriodoConsumo(anio, mes);
  if (periodoDesdeCampos) return periodoDesdeCampos;

  return fallbackPeriodo || getPeriodoFromDate(item?.fecha_lectura || item?.fechalectura);
};

const normalizeLecturasPeriodoConsumo = (data, fallbackPeriodo = '') => {
  const normalizeOne = (lectura) => ({
    ...lectura,
    periodo_consumo: normalizePeriodoConsumo(lectura, fallbackPeriodo)
  });

  if (Array.isArray(data)) return data.map(normalizeOne);
  if (Array.isArray(data?.lecturas)) {
    return {
      ...data,
      lecturas: data.lecturas.map(normalizeOne)
    };
  }

  return data;
};

class AffiliateGeneralServices {
  constructor() {
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
        'Authorization': `Bearer ${authService.getToken()}`,
        'X-Skip-Session-Expired': 'true'
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
        } else {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data;

    } catch (error) {
      console.error('Error en solicitud del afiliado:', error);
      
      if (error.name === 'AbortError') {
        throw new Error('La petición tardó demasiado tiempo');
      }
      
      if (error.message.includes('Failed to fetch')) {
        throw new Error('No se pudo conectar con el servidor');
      }
      
      throw error;
    }
  }

  // funcion para obtener mis medidores
  async getMisMedidores() {
    try {
      const data = await this.makeRequest(API_CONFIG.endpoints.misMedidores);
      return { success: true, data };
    } catch (error) {
      console.error('Error al obtener mis medidores:', error);
      return {  success: false, message: error.message || 'Error al obtener mis medidores' };
    }
  }

  /**
   * Obtener años y meses disponibles con lecturas
   */
  async getPeriodosDisponibles() {
    try {
      const data = await this.makeRequest(API_CONFIG.endpoints.periodosDisponibles);
      this.cachedPeriodos = data;
      
      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error('Error al obtener periodos:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener periodos disponibles'
      };
    }
  }

  /**
   * Obtener tarifas vigentes (básica y exceso)
   */
  async getTarifasVigentes() {
    try {
      const data = await this.makeRequest(API_CONFIG.endpoints.tarifasVigentes);
      return { success: true, data };
    } catch (error) {
      console.error('Error al obtener tarifas vigentes:', error);
      return { 
        success: false, 
        message: error.message || 'Error al obtener tarifas'
      };
    }
  }


  /**
   * Obtener lecturas filtradas por año y mes
   * @param {number} anio - Año (opcional)
   * @param {number} mes - Mes 1-12 (opcional)
   * @param {object} filtrosAdicionales - Filtros adicionales
   */
  async getMisLecturasPorPeriodo(anio = null, mes = null, filtrosAdicionales = {}) {
    try {
      const params = new URLSearchParams();
      const periodoConsumo = buildPeriodoConsumo(anio, mes);
      
      if (anio) params.append('anio', anio);
      if (mes) params.append('mes', mes);
      if (periodoConsumo) params.append('periodo_consumo', periodoConsumo);
      
      // Filtros adicionales
      if (filtrosAdicionales.tipo_lectura && filtrosAdicionales.tipo_lectura !== 'todas') {
        params.append('tipo_lectura', filtrosAdicionales.tipo_lectura);
      }
      
      if (filtrosAdicionales.id_medidor) {
        params.append('id_medidor', filtrosAdicionales.id_medidor);
      }
     
      const queryString = params.toString();
      const url = queryString 
        ? `${API_CONFIG.endpoints.misLecturas}?${queryString}`
        : API_CONFIG.endpoints.misLecturas;

      const data = await this.makeRequest(url);
      const normalizedData = normalizeLecturasPeriodoConsumo(data, periodoConsumo);

      return {
        success: true,
        data: normalizedData
      };
    } catch (error) {
      console.error('Error al obtener lecturas:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener tus lecturas'
      };
    }
  }

  /**
   * Obtener consumo total por periodo específico
   */
  async getConsumoPorPeriodo(anio, mes) {
    try {
      const params = new URLSearchParams();
      params.append('anio', anio);
      params.append('mes', mes);

      const url = `${API_CONFIG.endpoints.consumoPorPeriodo}?${params.toString()}`;
      const data = await this.makeRequest(url);

      return {
        success: true,
        data
      };
    } catch (error) {
      console.error('Error al obtener consumo:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener consumo del periodo'
      };
    }
  }

  /**
   * Obtener estadísticas generales del afiliado
   */
  async getEstadisticasGenerales() {
    try {
      const data = await this.makeRequest(API_CONFIG.endpoints.estadisticasGenerales);

      return {
        success: true,
        data
      };
    } catch (error) {
      console.error('Error al obtener estadisticas:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener estadísticas'
      };
    }
  }
   /**
   * ✅ EXPORTAR LECTURAS A CSV
   * Descarga un archivo CSV con las lecturas del afiliado
   * @param {number} anio - Año opcional
   * @param {number} mes - Mes (1-12) opcional
   * @param {object} filtrosAdicionales - Filtros adicionales (tipo_lectura, id_medidor)
   */
  async exportarLecturas(anio = null, mes = null, filtrosAdicionales = {}) {
    try {
      const params = new URLSearchParams();
      const periodoConsumo = buildPeriodoConsumo(anio, mes);
      
      if (anio) params.append('anio', anio);
      if (mes) params.append('mes', mes);
      if (periodoConsumo) params.append('periodo_consumo', periodoConsumo);
      
      if (filtrosAdicionales.tipo_lectura && filtrosAdicionales.tipo_lectura !== 'todas') {
        params.append('tipo_lectura', filtrosAdicionales.tipo_lectura);
      }
      
      if (filtrosAdicionales.id_medidor) {
        params.append('id_medidor', filtrosAdicionales.id_medidor);
      }
      
      const queryString = params.toString();
      const url = `${API_CONFIG.baseURL}${API_CONFIG.endpoints.exportarLecturas}${queryString ? '?' + queryString : ''}`;
      
      // ⚠️ NO usar makeRequest porque necesitamos blob, no JSON
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authService.getToken()}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Error ${response.status}: ${response.statusText}`);
      }
      
      // ✅ Obtener el blob (archivo binario)
      const blob = await response.blob();
      
      // ✅ Extraer nombre del archivo desde los headers
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'historial_consumos.csv';
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }
      
      // ✅ Crear URL temporal y disparar descarga
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      
      // ✅ Limpiar recursos
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      
      return {
        success: true,
        filename
      };
      
    } catch (error) {
      console.error('Error al exportar lecturas:', error);
      return {
        success: false,
        message: error.message || 'Error al exportar las lecturas'
      };
    }
  }

  /**
   * Obtener periodos disponibles SOLO para mis lecturas
   */
  async getPeriodosMisLecturas() {
    try {
      const data = await this.makeRequest(
        API_CONFIG.endpoints.misLecturasPeriodosDisponibles
      );

      return {
        success: true,
        data
      };
    } catch (error) {
      console.error('Error al obtener periodos de mis lecturas:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener periodos de lecturas'
      };
    }
  }

  

  /**
   * Obtener información del medidor del usuario logueado
   */
  async getMiMedidor() {
    try {
      const data = await this.makeRequest('/afiliados/mis-medidores');
      return {
        success: true,
        data
      };
    } catch (error) {
      console.error('Error al obtener informacion del medidor:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener información del medidor'
      };
    }
  }


  /**
   * Obtener nombre del mes en español
   */
  getNombreMes(mes) {
    const meses = {
      1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
      5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
      9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre'
    };
    return meses[mes] || `Mes ${mes}`;
  }

  /**
   * Formatear periodo para mostrar (ej: "Diciembre 2025")
   */
  formatearPeriodo(mes, anio) {
    return `${this.getNombreMes(mes)} ${anio}`;
  }

  /**
   * Limpiar caché
   */
  clearCache() {
    this.cachedPeriodos = null;
  }
}

const affiliateGeneralServices = new AffiliateGeneralServices();
export default affiliateGeneralServices;
export { AffiliateGeneralServices };
