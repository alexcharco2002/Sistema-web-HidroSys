/**
 * src/services/readingsServices.js
 * Servicio de Gestión de Lecturas de Medidores
 * ✅ Con soporte para sistema de periodos mensuales
 */

import authService from './authServices';

const API_CONFIG = {
  baseURL: 'https://localhost:8000',
  endpoints: {
    lecturas: '/lecturas',
    toggleStatus: (id) => `/lecturas/${id}/toggle-status`,
    exportTemplate: '/lecturas/export/template',
    importExcel: '/lecturas/import/excel',
    importExcelPeriodo: '/lecturas/import/excel/periodo',  
    exportExcel: '/lecturas/export/excel',
    medidoresCompletos: '/lecturas/medidores/lista/completa',
    stats: '/lecturas/stats/count',
    periodosDisponibles: '/lecturas/periodos/disponibles'  ,
    misLecturas: '/lecturas/mis-lecturas',
  }
};

class ReadingsServices {
  constructor() {
    this.cachedLecturas = null;
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
      timeout: 40000,
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
 


  // ========================================
  // 🆕 GESTIÓN DE PERIODOS MENSUALES
  // ========================================

  /**
   * 🆕 Obtener periodos disponibles para cargar lecturas
   * Retorna: periodo actual sugerido + últimos meses + próximos meses
   */
  async getPeriodosDisponibles() {
    try {
      const data = await this.makeRequest(API_CONFIG.endpoints.periodosDisponibles);
      
      // Actualizar caché
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
   * 🆕 Obtener periodo sugerido (más reciente o sin completar)
   */
  async getPeriodoSugerido() {
    try {
      const result = await this.getPeriodosDisponibles();
      
      if (!result.success) {
        throw new Error(result.message);
      }

      return {
        success: true,
        data: result.data.periodo_actual
      };
    } catch (error) {
      console.error('❌ Error obteniendo periodo sugerido:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener periodo sugerido'
      };
    }
  }

  /**
   * 🆕 Importar lecturas con periodo específico (mes/año)
   * @param {File} file - Archivo Excel
   * @param {number} mes - Mes (1-12)
   * @param {number} anio - Año (ej: 2025)
   */
  async importarExcelConPeriodo(file, mes, anio) {
    try {
      // Validaciones
      if (!file) {
        throw new Error('Debe seleccionar un archivo');
      }

      if (!mes || mes < 1 || mes > 12) {
        throw new Error('Mes inválido. Debe estar entre 1 y 12');
      }

      if (!anio || anio < 2020) {
        throw new Error('Año inválido');
      }

      // 🆕 TODO VA EN FORMDATA (no mezclar con query params)
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mes', mes.toString());
      formData.append('anio', anio.toString());

      // 🆕 Endpoint SIN query params (todo va en FormData)
      const endpoint = `${API_CONFIG.endpoints.importExcelPeriodo}`;

      const data = await this.makeRequest(endpoint, {
        method: 'POST',
        body: formData
        // ✅ NO incluir headers, FormData maneja los suyos
      });

      // Limpiar cachés
      this.cachedLecturas = null;
      this.cachedPeriodos = null;

      return {
        success: true,
        data: data,
        message: `Lecturas importadas exitosamente para ${this.getNombreMes(mes)}/${anio}`
      };

    } catch (error) {
      console.error('❌ Error importando Excel con periodo:', error);
      return {
        success: false,
        message: error.message || 'Error al importar lecturas desde Excel'
      };
    }
  }

  /**
   * 🆕 Validar si un periodo ya tiene lecturas completas
   * @param {number} mes - Mes (1-12)
   * @param {number} anio - Año
   * @returns {Promise<{completo: boolean, porcentaje: number}>}
   */
  async validarPeriodoCompleto(mes, anio) {
    try {
      const result = await this.getPeriodosDisponibles();
      
      if (!result.success) {
        throw new Error(result.message);
      }

      const periodo = result.data.periodos_disponibles.find(
        p => p.mes === mes && p.anio === anio
      );

      if (!periodo) {
        return {
          success: true,
          data: {
            completo: false,
            porcentaje: 0,
            mensaje: 'Periodo no encontrado'
          }
        };
      }

      return {
        success: true,
        data: {
          completo: periodo.porcentaje_completado >= 100,
          porcentaje: periodo.porcentaje_completado,
          total_lecturas: periodo.total_lecturas,
          total_medidores: periodo.total_medidores,
          mensaje: periodo.porcentaje_completado >= 100 
            ? 'Este periodo ya está completo'
            : `Completado al ${periodo.porcentaje_completado}%`
        }
      };

    } catch (error) {
      console.error('❌ Error validando periodo:', error);
      return {
        success: false,
        message: error.message || 'Error al validar periodo'
      };
    }
  }

  /**
   * 🆕 Obtener nombre del mes en español
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
   * 🆕 Formatear periodo para mostrar (ej: "Diciembre 2025")
   */
  formatearPeriodo(mes, anio) {
    return `${this.getNombreMes(mes)} ${anio}`;
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

      const endpoint = `${API_CONFIG.endpoints.lecturas}?generarfactura=true`;

      const data = await this.makeRequest(endpoint, {
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

      // Limpiar cachés
      this.cachedLecturas = null;
      this.cachedPeriodos = null;

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

      const response = await this.makeRequest(`${API_CONFIG.endpoints.lecturas}/${lecturaId}`, {
        method: 'PUT',
        body: updateData,
      });

      // Limpiar cachés
      this.cachedLecturas = null;
      this.cachedPeriodos = null;

    
      if (response && response.success === false) {
        return {
          success: false,
          message: response.message || 'No se pudo actualizar la lectura.',
          accion: response.accion || 'no_actualizado',
          info: response.info || null
        };
      }

      return {
        success: true,
        data: response.data || response,
        message: response.message || 'Lectura actualizada exitosamente',
        accion: response.accion || 'actualizado'
      };

    } catch (error) {
      console.error('❌ Error actualizando lectura:', error);
      
      // Solo llegaremos aquí si hay error de red, 404, 500, etc
      return {
        success: false,
        message: error.message || 'Error al actualizar lectura',
        accion: 'error'
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

      // Limpiar cachés
      this.cachedLecturas = null;
      this.cachedPeriodos = null;

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

      // Limpiar cachés
      this.cachedLecturas = null;
      this.cachedPeriodos = null;

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
   * Importar lecturas desde Excel (método legacy - usa el nuevo cuando sea posible)
   */
  async importarExcel(file) {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const data = await this.makeRequest(API_CONFIG.endpoints.importExcel, {
        method: 'POST',
        body: formData
      });

      // Limpiar cachés
      this.cachedLecturas = null;
      this.cachedPeriodos = null;

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
   * Obtener periodos desde caché
   */
  getCachedPeriodos() {
    return this.cachedPeriodos || null;
  }

  /**
   * Limpiar todos los cachés
   */
  clearCache() {
    this.cachedLecturas = null;
    this.cachedPeriodos = null;
  }
  
  /**
   * Generar lecturas estimadas para medidores sin lectura
   * @param {number} mes - Mes (1-12)
   * @param {number} anio - Año
   * @param {number} mesesPromedio - Meses para calcular promedio (default: 3)
   */
  async generarLecturasEstimadas(mes, anio, mesesPromedio = 3) {
      try {
          const endpoint = `/lecturas/generar-estimadas?mes=${mes}&anio=${anio}&meses_promedio=${mesesPromedio}`;
          const data = await this.makeRequest(endpoint, {
              method: 'POST'
          });
          
          // Limpiar cachés
          this.cachedLecturas = null;
          this.cachedPeriodos = null;
          
          return {
              success: true,
              data: data,
              message: data.message || 'Lecturas estimadas generadas'
          };
      } catch (error) {
          console.error('Error generando lecturas estimadas:', error);
          return {
              success: false,
              message: error.message || 'Error al generar lecturas estimadas'
          };
      }
  }

  /**
   * Confirmar una lectura estimada con el valor real
   * @param {number} idLectura - ID de la lectura estimada
   * @param {number} lecturaReal - Valor real de la lectura
   * @param {string} observacion - Observación adicional
   */
  async confirmarLecturaEstimada(idLectura, lecturaReal, observacion = null) {
      try {
          let endpoint = `/lecturas/${idLectura}/confirmar-estimada?lectura_real=${lecturaReal}`;
          if (observacion) {
              endpoint += `&observacion=${encodeURIComponent(observacion)}`;
          }
          
          const data = await this.makeRequest(endpoint, {
              method: 'PATCH'
          });
          
          // Limpiar cachés
          this.cachedLecturas = null;
          this.cachedPeriodos = null;
          
          return {
              success: true,
              data: data,
              message: 'Lectura confirmada exitosamente'
          };
      } catch (error) {
          console.error('Error confirmando lectura:', error);
          return {
              success: false,
              message: error.message || 'Error al confirmar lectura'
          };
      }
  }
  /**
   * Confirmar todas las lecturas estimadas de un periodo
   * @param {number} mes - Mes del periodo
   * @param {number} anio - Año del periodo
   */
  async confirmarTodasLecturasEstimadas(mes, anio) {
      try {
          const endpoint = `/lecturas/confirmar-todas-estimadas?mes=${mes}&anio=${anio}`;
          
          const data = await this.makeRequest(endpoint, {
              method: 'PATCH'
          });
          
          // Limpiar cachés
          this.cachedLecturas = null;
          this.cachedPeriodos = null;
          
          return {
              success: true,
              data: data,
              message: data.mensaje || 'Lecturas confirmadas exitosamente'
          };
      } catch (error) {
          console.error('Error confirmando lecturas masivamente:', error);
          return {
              success: false,
              message: error.message || 'Error al confirmar lecturas'
          };
      }
  }
  /**
   * Verificar si existen medidores sin lectura en un periodo (mes/año)
   * @param {number} mes - Mes (1-12)
   * @param {number} anio - Año
   * @returns {Promise<{success: boolean, data?: {total: number, medidores: []}, message?: string}>}
   */
  async verificarMedidoresSinLectura(mes, anio) {
      try {
          // Endpoint del backend que devuelve los medidores sin lectura
          const endpoint = `/lecturas/faltantes?mes=${mes}&anio=${anio}`;

          const data = await this.makeRequest(endpoint);

          // data esperado:
          // { total_sin_lectura: number, medidores: number[] }

          return {
              success: true,
              data: {
                  total: data.total_sin_lectura || 0,
                  medidores: data.medidores || []
              }
          };

      } catch (error) {
          console.error('❌ Error verificando medidores sin lectura:', error);
          return {
              success: false,
              message: error.message || 'Error al verificar medidores sin lectura'
          };
      }
  }
  
  /**
 * 🆕 Obtener SOLO las lecturas del usuario autenticado (afiliado)
 * Ahora con soporte para filtros opcionales
 */
  async getMisLecturas(filtros = {}) {
    try {
      const endpoint = API_CONFIG.endpoints.misLecturas;

      // Construir query params si hay filtros
      const params = new URLSearchParams();
      
      if (filtros.fecha_desde) {
        params.append('fecha_desde', filtros.fecha_desde);
      }
      if (filtros.fecha_hasta) {
        params.append('fecha_hasta', filtros.fecha_hasta);
      }
      if (filtros.tipo_lectura && filtros.tipo_lectura !== 'todas') {
        params.append('tipo_lectura', filtros.tipo_lectura);
      }
      if (filtros.consumo_min) {
        params.append('consumo_min', filtros.consumo_min);
      }
      if (filtros.consumo_max) {
        params.append('consumo_max', filtros.consumo_max);
      }
      if (filtros.id_medidor) {
        params.append('id_medidor', filtros.id_medidor);
      }

      const queryString = params.toString();
      const url = queryString ? `${endpoint}?${queryString}` : endpoint;

      const data = await this.makeRequest(url);

      return {
        success: true,
        data
      };

    } catch (error) {
      console.error('❌ Error obteniendo mis lecturas:', error);

      return {
        success: false,
        message: error.message || 'Error al obtener tus lecturas'
      };
    }
  }
}

const readingsServices = new ReadingsServices();

export default readingsServices;
export { ReadingsServices };
