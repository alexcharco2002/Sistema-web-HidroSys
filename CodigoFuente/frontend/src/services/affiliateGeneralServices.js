/**
 * src/services/affiliateGeneralServices.js
 * Servicio para gestión de lecturas de afiliados
 */

import authService from './authServices';

const API_CONFIG = {
  baseURL: 'https://localhost:8000',
  endpoints: {
    misLecturas: '/afiliados/mis-lecturas',
    periodosDisponibles: '/afiliados/periodos-disponibles',
    consumoPorPeriodo: '/afiliados/consumo-por-periodo',
    estadisticasGenerales: '/afiliados/estadisticas',
    exportarLecturas: '/afiliados/exportar-lecturas' 
  }
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
      console.error('❌ Error obteniendo periodos:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener periodos disponibles'
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
      
      if (anio) params.append('anio', anio);
      if (mes) params.append('mes', mes);
      
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

      return {
        success: true,
        data
      };
    } catch (error) {
      console.error('❌ Error obteniendo lecturas:', error);
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
      console.error('❌ Error obteniendo consumo:', error);
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
      console.error('❌ Error obteniendo estadísticas:', error);
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
      
      if (anio) params.append('anio', anio);
      if (mes) params.append('mes', mes);
      
      if (filtrosAdicionales.tipo_lectura && filtrosAdicionales.tipo_lectura !== 'todas') {
        params.append('tipo_lectura', filtrosAdicionales.tipo_lectura);
      }
      
      if (filtrosAdicionales.id_medidor) {
        params.append('id_medidor', filtrosAdicionales.id_medidor);
      }
      
      const queryString = params.toString();
      const url = `${API_CONFIG.baseURL}${API_CONFIG.endpoints.exportarLecturas}${queryString ? '?' + queryString : ''}`;
      
      console.log(`📥 Descargando CSV: ${url}`);
      
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
      
      console.log(`✅ CSV descargado: ${filename}`);
      
      return {
        success: true,
        filename
      };
      
    } catch (error) {
      console.error('❌ Error exportando lecturas:', error);
      return {
        success: false,
        message: error.message || 'Error al exportar las lecturas'
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
