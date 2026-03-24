/**
 * src/services/affiliatesServices.js
 * Servicio de Gestión de Afiliados - Con soporte completo para array de medidores
 */

import authService from './authServices';

const API_CONFIG = {
baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
  endpoints: {
    affiliates: '/affiliates',                    // GET - sin /
    createAffiliate: '/affiliates/create',        // POST - ruta específica
    availableUsers: '/affiliates/available/users',
    toggleStatus: (id) => `/affiliates/${id}/toggle-status`,
    stats: '/affiliates/stats/count',
    miPerfilAfiliado: '/affiliates/mi-perfil',
  }
};


class AffiliatesService {
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
   * Procesa los datos del afiliado para normalizar la información de medidores
   * El backend envía un array "medidor" con los medidores asignados
   */
  processAffiliateData(affiliate) {
    if (!affiliate) return affiliate;

    // Normalizar el nombre del campo: "medidor" → "medidores"
    if (affiliate.medidor && !affiliate.medidores) {
      affiliate.medidores = affiliate.medidor;
    }

    // Asegurar que sea un array válido
    if (!Array.isArray(affiliate.medidores)) {
      affiliate.medidores = [];
    }

    // Log para debugging
    if (affiliate.medidores.length > 0) {
      console.log(`📊 Afiliado ${affiliate.cod_usuario_afi} tiene ${affiliate.medidores.length} medidor(es)`);
    }

    return affiliate;
  }

  // mi perfil de afiliado
  async getMiPerfilAfiliado() {
    try {
      const data = await this.makeRequest(API_CONFIG.endpoints.miPerfilAfiliado);
      return {
        success: true,
        data: this.processAffiliateData(data)
      };
    } catch (error) {
      console.error('❌ Error obteniendo mi perfil de afiliado:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener mi perfil de afiliado'
      };
    }
  }

  /**
   * Obtener lista de afiliados con filtros opcionales
   */
  async getAffiliates(filters = {}) {
    try {
      const params = new URLSearchParams();
      
      if (filters.search) params.append('search', filters.search);
      if (filters.id_sector) params.append('id_sector', filters.id_sector);
      if (filters.activo !== undefined) params.append('activo', filters.activo);
      if (filters.skip) params.append('skip', filters.skip);
      if (filters.limit) params.append('limit', filters.limit);

      const queryString = params.toString();
      const endpoint = queryString 
        ? `${API_CONFIG.endpoints.affiliates}?${queryString}` 
        : API_CONFIG.endpoints.affiliates;

      const data = await this.makeRequest(endpoint);

      // Procesar cada afiliado para normalizar datos de medidores
      const processedData = Array.isArray(data) 
        ? data.map(affiliate => this.processAffiliateData(affiliate))
        : data;

      return {
        success: true,
        data: processedData
      };

    } catch (error) {
      console.error('❌ Error obteniendo afiliados:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener afiliados',
        data: []
      };
    }
  }

  /**
   * Obtener un afiliado específico por ID
   */
  async getAffiliateById(affiliateId) {
    try {
      const data = await this.makeRequest(`${API_CONFIG.endpoints.affiliates}/${affiliateId}`);

      return {
        success: true,
        data: this.processAffiliateData(data)
      };

    } catch (error) {
      console.error('❌ Error obteniendo afiliado:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener afiliado'
      };
    }
  }

  /**
   * Obtener lista de usuarios disponibles para afiliar (no afiliados)
   */
  async getAvailableUsers(search = '') {
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      
      const queryString = params.toString();
      const endpoint = queryString 
        ? `${API_CONFIG.endpoints.availableUsers}?${queryString}` 
        : API_CONFIG.endpoints.availableUsers;

      const data = await this.makeRequest(endpoint);

      return {
        success: true,
        data: data
      };

    } catch (error) {
      console.error('❌ Error obteniendo usuarios disponibles:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener usuarios disponibles',
        data: []
      };
    }
  }

  async createAffiliate(affiliateData) {
    try {
      this.validateAffiliateData(affiliateData);

      const idUsuarioSistema = parseInt(affiliateData.id_usuario_sistema, 10);
      const idSector = parseInt(affiliateData.id_sector, 10);

      if (isNaN(idUsuarioSistema) || isNaN(idSector)) {
        console.error('❌ Valores inválidos:', {
          id_usuario_sistema: affiliateData.id_usuario_sistema,
          id_sector: affiliateData.id_sector,
          convertidos: { idUsuarioSistema, idSector }
        });
        throw new Error('Los IDs deben ser números válidos');
      }
      const payload = {
        id_usuario_sistema: idUsuarioSistema,
        id_sector: idSector,
        activo: affiliateData.activo !== undefined ? affiliateData.activo : true
      };

      // ✅ AGREGAR código de afiliado si fue proporcionado
      if (affiliateData.cod_usuario_afi && affiliateData.cod_usuario_afi.trim() !== '') {
        payload.cod_usuario_afi = affiliateData.cod_usuario_afi.trim().toUpperCase();
      }
    
      console.log('📤 Payload final:', payload);

      // ✅ CORRECCIÓN: pasar como objeto options
      const data = await this.makeRequest(
        API_CONFIG.endpoints.createAffiliate,
        {
          method: 'POST',
          body: payload
        }
      );

      return {
        success: true,
        data: this.processAffiliateData(data),
        message: 'Afiliado creado exitosamente'
      };

    } catch (error) {
      console.error('❌ Error creando afiliado:', error);
      return {
        success: false,
        message: error.message || 'Error al crear afiliado'
      };
    }
  }

  /**
   * Actualizar un afiliado existente
   */
  async updateAffiliate(affiliateId, affiliateData) {
    if (!affiliateId || isNaN(affiliateId)) {
      throw new Error('ID de afiliado inválido o no definido');
    }

    try {
      const updateData = {};
      
      if (affiliateData.id_sector) updateData.id_sector = affiliateData.id_sector;
      if (affiliateData.activo !== undefined) updateData.activo = affiliateData.activo;
      if (affiliateData.cod_usuario_afi && affiliateData.cod_usuario_afi.trim() !== '') {
        updateData.cod_usuario_afi = affiliateData.cod_usuario_afi.trim().toUpperCase();
      }
      const data = await this.makeRequest(`${API_CONFIG.endpoints.affiliates}/${affiliateId}`, {
        method: 'PUT',
        body: updateData
      });

      return {
        success: true,
        data: this.processAffiliateData(data),
        message: 'Afiliado actualizado exitosamente'
      };

    } catch (error) {
      console.error('❌ Error actualizando afiliado:', error);
      return {
        success: false,
        message: error.message || 'Error al actualizar afiliado'
      };
    }
  }

  /**
 * Eliminar un afiliado
 */
  async deleteAffiliate(affiliateId) {
    try {
      const data = await this.makeRequest(
        `${API_CONFIG.endpoints.affiliates}/${affiliateId}`,
        { method: 'DELETE' }
      );

      console.log("🔎 Respuesta del backend:", data);

      // Normalización de mensajes y campos comunes
      const backendMessage =
        data?.message ||
        data?.msg ||
        data?.detail ||
        data?.error ||
        data?.descripcion ||
        null;

      const cod = data?.afiliado?.cod_usuario_afi || '';

      // ------ CASOS CONTROLADOS ------
      if (data?.accion === 'eliminado') {
        return {
          success: true,
          message: `El afiliado con código "${cod}" fue eliminado correctamente.`,
          data
        };
      }

      if (data?.accion === 'desactivado') {
        return {
          success: true,
          message: `El afiliado con código "${cod}" no se pudo eliminar porque está relacionado con otros módulos. Fue desactivado.`,
          data
        };
      }

      // Caso éxito genérico
      if (data?.success === true) {
        return {
          success: true,
          message: backendMessage || "Operación completada correctamente.",
          data
        };
      }

      // Caso error explícito desde el backend
      if (backendMessage) {
        return {
          success: false,
          message: backendMessage,
          data
        };
      }

      // Respuesta inesperada
      return {
        success: false,
        message: "No se pudo completar la operación.",
        data
      };

    } catch (error) {
      console.error("❌ Error eliminando afiliado:", error);

      // Manejo de errores de red, timeouts, etc.
      return {
        success: false,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Error al eliminar afiliado."
      };
    }
  }


  /**
   * Cambiar estado de un afiliado (activo/inactivo)
   */
  async toggleAffiliateStatus(affiliateId) {
    try {
      const data = await this.makeRequest(API_CONFIG.endpoints.toggleStatus(affiliateId), {
        method: 'PATCH'
      });

      return {
        success: true,
        data: this.processAffiliateData(data),
        message: 'Estado del afiliado actualizado'
      };

    } catch (error) {
      console.error('❌ Error cambiando estado:', error);
      return {
        success: false,
        message: error.message || 'Error al cambiar estado del afiliado'
      };
    }
  }

  /**
   * Obtener estadísticas de afiliados
   */
  async getAffiliatesStats() {
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
   * Verificar si un afiliado tiene medidor asignado
   */
  hasMeter(affiliate) {
    if (!affiliate) return false;
    
    // Normalizar nombre del campo
    const medidores = affiliate.medidores || affiliate.medidor;
    
    return Array.isArray(medidores) && 
           medidores.length > 0 &&
           medidores.some(m => m.activo);
  }

  /**
   * Obtener el número de medidor de un afiliado
   */
  getMeterNumber(affiliate) {
    if (!affiliate) return null;
    
    // Normalizar nombre del campo
    const medidores = affiliate.medidores || affiliate.medidor;
    
    if (!Array.isArray(medidores)) return null;
    
    const activeMeters = medidores.filter(m => m.activo);
    
    if (activeMeters.length === 0) return null;
    if (activeMeters.length === 1) return activeMeters[0].num_medidor;
    
    return `${activeMeters.length} medidores`;
  }

  /**
   * Obtener información completa de medidores de un afiliado
   */
  getMeterInfo(affiliate) {
    if (!affiliate) return null;
    
    // Normalizar nombre del campo
    const medidores = affiliate.medidores || affiliate.medidor;
    
    if (!Array.isArray(medidores)) return null;
    
    const activeMeters = medidores.filter(m => m.activo);
    
    if (activeMeters.length === 0) return null;
    
    if (activeMeters.length === 1) {
      return {
        count: 1,
        primary: activeMeters[0],
        all: activeMeters
      };
    }
    
    return {
      count: activeMeters.length,
      primary: activeMeters[0],
      all: activeMeters
    };
  }

  /**
   * Validar datos de afiliado
   */
  validateAffiliateData(affiliateData) {
    if (!affiliateData.id_usuario_sistema || typeof affiliateData.id_usuario_sistema !== 'number') {
      throw new Error('Debe seleccionar un usuario válido');
    }

    if (!affiliateData.id_sector || typeof affiliateData.id_sector !== 'number') {
      throw new Error('Debe seleccionar un sector válido');
    }
  }

  /**
   * Limpiar caché de estadísticas
   */
  clearStatsCache() {
    this.cachedStats = null;
  }


/**
 * ✅ Descargar plantilla - MÉTODO ALTERNATIVO (más seguro)
 */
async downloadTemplate() {
  try {
    const token = authService.getToken('token');
    
    console.log('📥 Iniciando descarga de plantilla...');
    
    const response = await fetch(`${API_CONFIG.baseURL}/affiliates/template/download`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Error al descargar plantilla');
    }

    // Obtener el blob
    const blob = await response.blob();
    
    console.log(`📦 Blob recibido: ${blob.size} bytes`);
    
    if (blob.size === 0) {
      throw new Error('El archivo descargado está vacío');
    }

    // ✅ MÉTODO ALTERNATIVO: Usar el API de File System (más moderno)
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: `plantilla_afiliados_${new Date().getTime()}.xlsx`,
          types: [{
            description: 'Excel Files',
            accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }
          }]
        });
        
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        
        console.log('✅ Archivo guardado con File System API');
      } catch (fsError) {
        // Si el usuario cancela o hay error, usar método fallback
        console.log('Usuario canceló o error en File System API, usando método fallback');
        throw fsError;
      }
    } else {
      // ✅ FALLBACK para navegadores que no soportan showSaveFilePicker
      this.downloadBlobFallback(blob, `plantilla_afiliados_${new Date().getTime()}.xlsx`);
    }

    return {
      success: true,
      message: 'Plantilla descargada correctamente'
    };

  } catch (error) {
    // Si falla el método moderno, usar fallback
    if (error.name === 'AbortError') {
      return {
        success: false,
        message: 'Descarga cancelada por el usuario'
      };
    }
    
    console.error('❌ Error descargando plantilla:', error);
    return {
      success: false,
      message: error.message || 'Error al descargar plantilla'
    };
  }
}

/**
 * ✅ Método fallback para descargar blob (sin conflictos con React)
 */
downloadBlobFallback(blob, filename) {
  // Crear URL temporal
  const url = URL.createObjectURL(blob);
  
  // Crear un iframe invisible para la descarga
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = url;
  
  document.body.appendChild(iframe);
  
  // Limpiar después de 2 segundos
  setTimeout(() => {
    try {
      document.body.removeChild(iframe);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn('Error limpiando iframe:', e);
    }
  }, 2000);
  
  // Método tradicional como backup
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
}

  /**
   * ✅ Crear múltiples afiliados con medidores desde Excel
   */
  async createManyAffiliates(affiliatesArray) {
    try {
      if (!Array.isArray(affiliatesArray) || affiliatesArray.length === 0) {
        return {
          success: false,
          message: 'Debe proporcionar un array de afiliados válido'
        };
      }

      // ✅ Validar máximo 500 afiliados
      if (affiliatesArray.length > 500) {
        return {
          success: false,
          message: 'Máximo 500 afiliados por carga. Actualmente: ' + affiliatesArray.length
        };
      }
      
      // Validar estructura básica
      const afiliadosValidados = affiliatesArray.map((aff, index) => {
        if (!aff.id_usuario_sistema || !aff.id_sector || !aff.num_medidor) {
          throw new Error(`Fila ${index + 1}: Faltan campos obligatorios`);
        }

        const afiliado = {
          id_usuario_sistema: parseInt(aff.id_usuario_sistema),
          id_sector: parseInt(aff.id_sector),
          num_medidor: String(aff.num_medidor).trim(),
          latitud: aff.latitud ? parseFloat(aff.latitud) : null,
          longitud: aff.longitud ? parseFloat(aff.longitud) : null,
          altitud: aff.altitud ? parseFloat(aff.altitud) : null
        };

        // ✅ AGREGAR código de afiliado si existe (sin validación duplicada)
        if (aff.cod_usuario_afi) {
          const codigo = String(aff.cod_usuario_afi).trim().toUpperCase();
          
          if (codigo !== '') {
            // Validar formato
            if (codigo.length > 6) {
              throw new Error(`Fila ${index + 1}: Código de afiliado no puede tener más de 6 caracteres`);
            }
            
            if (!/^[A-Z0-9]+$/.test(codigo)) {
              throw new Error(`Fila ${index + 1}: Código de afiliado solo puede contener letras y números`);
            }
            
            afiliado.cod_usuario_afi = codigo;
            console.log(`📋 Fila ${index + 1}: Código personalizado '${codigo}' será enviado al backend`);
          }
        }
        return afiliado;
      });

      console.log('📤 Enviando afiliados al backend:', afiliadosValidados.length);

      const data = await this.makeRequest(`${API_CONFIG.endpoints.affiliates}/bulk`, {
        method: 'POST',
        body: {
          affiliates: afiliadosValidados
        }
      });

      console.log('📥 Respuesta del backend:', data);

      return {
        success: true,
        data: data,
        message: `Proceso completado: ${data.total_exitosos} exitosos, ${data.total_fallidos} fallidos`
      };

    } catch (error) {
      console.error('❌ Error en carga masiva:', error);
      return {
        success: false,
        message: error.message || 'Error al crear afiliados masivamente'
      };
    }
  }
}

const affiliatesService = new AffiliatesService();

export default affiliatesService;
export { AffiliatesService };