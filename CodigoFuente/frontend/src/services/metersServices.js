/**
 * src/services/metersServices.js
 * Servicio de Gestión de Medidores
 */

import authService from './authServices';

const API_CONFIG = {
baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
  endpoints: {
    meters: '/meters',
    sectoresDisponibles: '/meters/sectores-disponibles',
    availableAffiliates: '/meters/available/affiliates',
    toggleStatus: (id) => `/meters/${id}/toggle-status`,
    stats: '/meters/stats/count',
    validateLocation: '/meters/validar-ubicacion',
    services: '/servicios',
  }
};

class MetersService {
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

    // ✅ Manejo correcto de FormData y JSON
    if (finalOptions.body instanceof FormData) {
      delete finalOptions.headers['Content-Type'];
    } else if (finalOptions.body && typeof finalOptions.body === 'object') {
      finalOptions.headers['Content-Type'] = 'application/json';
      finalOptions.body = JSON.stringify(finalOptions.body);
    }

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
        
        // 🔥 GUARDAR EL DETALLE COMPLETO PARA ERRORES GEOGRÁFICOS
        const err = new Error(errorData?.error || "Error en la solicitud");
        err.backend = errorData;
        err.backendDetail = errorData.detail; // ← GUARDAR DETAIL

        if (typeof errorData.detail === 'string') {
          errorMessage = errorData.detail;
        } else if (Array.isArray(errorData.detail)) {
          errorMessage = errorData.detail.map(err => err.msg).join(', ');
        } else if (typeof errorData.detail === 'object') {
          // Para errores geográficos, usar el mensaje del detail
          errorMessage = errorData.detail.mensaje || JSON.stringify(errorData.detail);
        } else {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }

        err.message = errorMessage;
        throw err;
      }

      const data = await response.json();
      return data;

    } catch (error) {
      console.error('Error en solicitud de medidores:', error);

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
   * Formatear mensaje de error geográfico de forma amigable
   */
  formatGeoError(backendDetail) {
    if (!backendDetail || typeof backendDetail !== 'object') {
      return 'Error de validación de ubicación';
    }

    const { limite, latitud, longitud, mensaje } = backendDetail;

    // Mensaje principal amigable
    let friendlyMessage = '📍 Ubicación fuera del área permitida\n\n';
    
    if (limite) {
      friendlyMessage += `El medidor debe estar dentro del área: "${limite}"\n\n`;
    }

    // Mostrar coordenadas ingresadas
    if (latitud !== undefined && longitud !== undefined) {
      friendlyMessage += `📌 Coordenadas ingresadas:\n`;
      friendlyMessage += `• Latitud: ${latitud}\n`;
      friendlyMessage += `• Longitud: ${longitud}\n\n`;
    }

    // Extraer límites del mensaje técnico si existe
    if (mensaje && mensaje.includes('Área permitida:')) {
      const limiteTexto = mensaje.split('Área permitida:')[1].trim();
      friendlyMessage += `✅ Área permitida:\n${limiteTexto}\n\n`;
    }

    friendlyMessage += '💡 Consejo: Verifica que las coordenadas correspondan a la ubicación correcta del medidor.';

    return friendlyMessage;
  }

  /**
   * Validar ubicación antes de crear/actualizar
   */
  async validateLocation(latitud, longitud) {
    try {
      if (latitud === null || latitud === undefined || 
          longitud === null || longitud === undefined) {
        return {
          success: true,
          message: 'Coordenadas no proporcionadas'
        };
      }

      const data = await this.makeRequest(API_CONFIG.endpoints.validateLocation, {
        method: 'POST',
        body: { latitud, longitud }
      });

      return {
        success: data.valida,
        data: data,
        message: data.mensaje,
        limite: data.limite_aplicado
      };

    } catch (error) {
      console.error('Error al validar ubicacion del medidor:', error);
      return {
        success: false,
        message: error.message || 'Error al validar ubicación'
      };
    }
  }
  /**
   * Obtener sectores disponibles para medidores
   * Requiere solo permiso de medidores (no requiere permiso de sectores)
   */
  async getSectoresDisponibles() {
    try {
      const data = await this.makeRequest('/meters/sectores-disponibles');

      return {
        success: true,
        data: data
      };

    } catch (error) {
      console.error('Error al obtener sectores disponibles:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener sectores disponibles'
      };
    }
  }


  /**
   * Obtener lista de medidores con filtros opcionales
   */
  async getMeters(filters = {}) {
    try {
      const params = new URLSearchParams();
      
      if (filters.search) params.append('search', filters.search);
      if (filters.id_sector) params.append('id_sector', filters.id_sector);
      if (filters.activo !== undefined) params.append('activo', filters.activo);
      if (filters.asignado !== undefined) params.append('asignado', filters.asignado);
      if (filters.skip) params.append('skip', filters.skip);
      if (filters.limit) params.append('limit', filters.limit);

      const queryString = params.toString();
      const endpoint = queryString 
        ? `${API_CONFIG.endpoints.meters}?${queryString}` 
        : API_CONFIG.endpoints.meters;

      const data = await this.makeRequest(endpoint);

      return {
        success: true,
        data: data
      };

    } catch (error) {
      console.error('Error al obtener medidores:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener medidores',
        data: []
      };
    }
  }

  /**
   * Obtener un medidor específico por ID
   */
  async getMeterById(meterId) {
    try {
      const data = await this.makeRequest(`${API_CONFIG.endpoints.meters}/${meterId}`);

      return {
        success: true,
        data: data
      };

    } catch (error) {
      console.error('Error al obtener medidor:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener medidor'
      };
    }
  }

  /**
   * Obtener lista de afiliados disponibles (sin medidor asignado)
   */
  async getAvailableAffiliates(search = '') {
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      
      const queryString = params.toString();
      const endpoint = queryString 
        ? `${API_CONFIG.endpoints.availableAffiliates}?${queryString}` 
        : API_CONFIG.endpoints.availableAffiliates;

      const data = await this.makeRequest(endpoint);

      return {
        success: true,
        data: data
      };

    } catch (error) {
      console.error('Error al obtener afiliados disponibles:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener afiliados disponibles',
        data: []
      };
    }
  }
/**
 * Crear un nuevo medidor
 */
async createMeter(meterData) {
  try {
    this.validateMeterData(meterData);

    const data = await this.makeRequest(API_CONFIG.endpoints.meters, {
      method: 'POST',
      body: {
        num_medidor: meterData.num_medidor,
        latitud: meterData.latitud,
        longitud: meterData.longitud,
        altitud: meterData.altitud,
        id_usuario_afi: meterData.id_usuario_afi,
        id_sector: meterData.id_sector,
        activo: meterData.activo !== undefined ? meterData.activo : true
      }
    });

    // Limpia la caché para forzar la actualización de los datos
    this.clearStatsCache();
    return {
      success: true,
      data,
      message: '✅ Medidor creado exitosamente'
    };

  } catch (error) {
    console.error('Error al crear medidor:', error);
    // Manejo de errores geográficos
    return this.handleGeoError(error);
  }
}

/**
 * Actualizar un medidor existente
 */
async updateMeter(meterId, meterData) {
  if (!meterId || isNaN(meterId)) {
    throw new Error('ID de medidor inválido o no definido');
  }

  try {
    const updateData = {
      num_medidor: meterData.num_medidor,
      latitud: meterData.latitud,
      longitud: meterData.longitud,
      altitud: meterData.altitud,
      id_usuario_afi: meterData.id_usuario_afi,
      id_sector: meterData.id_sector,
      activo: meterData.activo,
      costo_cambio: meterData.costo_cambio,
      motivo_cambio: meterData.motivo_cambio,
      observaciones_cambio: meterData.observaciones_cambio
    };

    // Limpiar campos undefined/null
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined || updateData[key] === null) {
        delete updateData[key];
      }
    });

    const data = await this.makeRequest(`${API_CONFIG.endpoints.meters}/${meterId}`, {
      method: 'PUT',
      body: updateData
    });

    // Limpia la caché para forzar la actualización de los datos
    this.clearStatsCache();

    return {
      success: true,
      data,
      message: '✅ Medidor actualizado exitosamente'
    };

  } catch (error) {
    console.error('Error al actualizar medidor:', error);
    // Manejo de errores geográficos
    return this.handleGeoError(error);
  }
}

/**
 * Manejo de errores geográficos
 */
handleGeoError(error) {
  const backendDetail = error.backendDetail || error.backend?.detail || error.backend || null;

  if (backendDetail && typeof backendDetail === 'object') {
    if (backendDetail.error === "Coordenadas fuera del límite geográfico permitido" ||
        backendDetail.limite || 
        (backendDetail.mensaje && backendDetail.mensaje.includes('límite geográfico'))) {
      
      return {
        success: false,
        isGeoError: true,
        backend: backendDetail,
        message: this.formatGeoError(backendDetail),
        limite: backendDetail.limite,
        coordenadas: {
          latitud: backendDetail.latitud,
          longitud: backendDetail.longitud
        }
      };
    }
  }

  // Otros errores
  return {
    success: false,
    isGeoError: false,
    backend: error.backend,
    message: error.message || "Error al crear o actualizar medidor"
  };
}

  /**
   * Eliminar un medidor
   */
  async deleteMeter(meterId) {
    try {
      const data = await this.makeRequest(`${API_CONFIG.endpoints.meters}/${meterId}`, {
        method: 'DELETE'
      });

      // Analiza la respuesta del backend
      if (data?.accion === 'eliminado') {
        return {
          success: true,
          message: `✅ El medidor "${data.medidor?.num_medidor || ''}" fue eliminado correctamente.`,
          data
        };
      }

      if (data?.accion === 'desactivado') {
        return {
          success: true,
          message: `⚠️ El medidor "${data.medidor?.num_medidor || ''}" no se pudo eliminar porque está relacionado con otros módulos, solo fue desactivado.`,
          data
        };
      }

      if (data?.success) {
        return {
          success: true,
          message: data.message || 'Operación completada correctamente.',
          data
        };
      }

      if (data?.detail) {
        return {
          success: false,
          message: data.detail
        };
      }

      return {
        success: false,
        message: 'No se pudo completar la operación.'
      };

    } catch (error) {
      console.error('Error al eliminar medidor:', error);
      return {
        success: false,
        message: error.message || 'Error al eliminar medidor'
      };
    }
  }

  /**
   * Cambiar estado de un medidor (activo/inactivo)
   */
  async toggleMeterStatus(meterId) {
    try {
      const data = await this.makeRequest(API_CONFIG.endpoints.toggleStatus(meterId), {
        method: 'PATCH'
      });

      return {
        success: true,
        data: data,
        message: 'Estado del medidor actualizado'
      };

    } catch (error) {
      console.error('Error al cambiar estado del medidor:', error);
      return {
        success: false,
        message: error.message || 'Error al cambiar estado del medidor'
      };
    }
  }

  /**
   * Obtener estadísticas de medidores
   */
  async getMetersStats() {
    try {
      const data = await this.makeRequest(API_CONFIG.endpoints.stats);

      return {
        success: true,
        data: data
      };

    } catch (error) {
      console.error('Error al obtener estadisticas de medidores:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener estadísticas'
      };
    }
  }

  /**
   * Validar datos de medidor
   */
  validateMeterData(meterData) {
    if (!meterData.num_medidor || typeof meterData.num_medidor !== 'string' || !meterData.num_medidor.trim()) {
      throw new Error('El número de medidor es requerido');
    }

    // Validar coordenadas si están presentes
    if (meterData.latitud !== null && meterData.latitud !== undefined) {
      const lat = parseFloat(meterData.latitud);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        throw new Error('La latitud debe estar entre -90 y 90');
      }
    }

    if (meterData.longitud !== null && meterData.longitud !== undefined) {
      const lng = parseFloat(meterData.longitud);
      if (isNaN(lng) || lng < -180 || lng > 180) {
        throw new Error('La longitud debe estar entre -180 y 180');
      }
    }

    if (meterData.altitud !== null && meterData.altitud !== undefined) {
      const alt = parseFloat(meterData.altitud);
      if (isNaN(alt)) {
        throw new Error('La altitud debe ser un número válido');
      }
    }

    // Validar que id_usuario_afi sea un número si está presente
    if (meterData.id_usuario_afi !== null && meterData.id_usuario_afi !== undefined) {
      if (typeof meterData.id_usuario_afi !== 'number' || isNaN(meterData.id_usuario_afi)) {
        throw new Error('El ID de afiliado debe ser un número válido');
      }
    }

    // Validar que id_sector sea un número si está presente
    if (meterData.id_sector !== null && meterData.id_sector !== undefined) {
      if (typeof meterData.id_sector !== 'number' || isNaN(meterData.id_sector)) {
        throw new Error('El ID de sector debe ser un número válido');
      }
    }
  }

  // Obtener servicios activos y vigentes
  async getActiveServices() {
    try {
      const params = new URLSearchParams({
        activo: 'true',
        es_vigente: 'true',
        limit: '100'
      });

      const data = await this.makeRequest(`${API_CONFIG.endpoints.services}?${params.toString()}`);
      
      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error('Error obteniendo servicios:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener servicios',
        data: []
      };
    }
  }
  

  /**
   * Limpiar caché de estadísticas
   */
  clearStatsCache() {
    this.cachedStats = null;
  }
}

const metersService = new MetersService();

export default metersService;
export { MetersService };
