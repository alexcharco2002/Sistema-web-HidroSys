/**
 * src/services/geolocationsServices.js
 * Servicio de Geolocalización de Medidores
 * Consume endpoints de medidores pero enfocado en visualización de mapas
 */

import authService from './authServices';

const API_CONFIG = {
baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
  endpoints: {
    medidores: '/meters',
    sectores: '/sectors',
    medidoresGeo: '/meters/geo/all', // Endpoint optimizado para geo
    medidorGeo: (id) => `/meters/${id}/geo`, // Geo de un medidor específico
    stats: '/meters/stats/geo', // Estadísticas geográficas
  }
};

class GeolocalizacionService {
  constructor() {
    this.cachedMedidores = null;
    this.cachedSectores = null;
    this.lastUpdate = null;
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
      timeout: 15000, // Más tiempo para cargas geográficas
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
      console.log(`🌐 GEO API Request: ${finalOptions.method} ${url}`);
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
      console.log(`✅ GEO API Response:`, data.length || 'OK');
      return data;

    } catch (error) {
      console.error(`❌ GEO API Error:`, error);

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
   * Obtener todos los medidores con información geográfica
   */
  async getMedidoresGeo(filters = {}) {
  try {
    const allMedidores = [];
    let skip = 0;
    const limit = 500; // máximo permitido
    let hasMore = true;

    while (hasMore) {
      const params = new URLSearchParams();

      if (filters.search) params.append('search', filters.search);
      if (filters.id_sector) params.append('id_sector', filters.id_sector);
      if (filters.activo !== undefined) params.append('activo', filters.activo);
      if (filters.asignado !== undefined) params.append('asignado', filters.asignado);

      params.append('limit', limit);
      params.append('skip', skip);

      const queryString = params.toString();
      const endpoint = queryString 
        ? `${API_CONFIG.endpoints.medidores}?${queryString}` 
        : API_CONFIG.endpoints.medidores;

      const data = await this.makeRequest(endpoint);

      if (!data || data.length === 0) {
        hasMore = false;
        break;
      }

      // Filtrar solo medidores con coordenadas válidas
      const medidoresConGeo = data.filter(m => 
        m.latitud !== null && m.longitud !== null &&
        !isNaN(parseFloat(m.latitud)) && !isNaN(parseFloat(m.longitud))
      );

      allMedidores.push(...medidoresConGeo);

      // Preparar siguiente batch
      skip += limit;
      hasMore = data.length === limit;
    }

    // Actualizar caché
    this.cachedMedidores = allMedidores;
    this.lastUpdate = new Date();

    return {
      success: true,
      data: allMedidores,
      total: allMedidores.length,
      lastUpdate: this.lastUpdate
    };

  } catch (error) {
    console.error('❌ Error obteniendo medidores geo:', error);
    return {
      success: false,
      message: error.message || 'Error al obtener medidores',
      data: []
    };
  }
}


  /**
   * Obtener medidor específico con info geográfica
   */
  async getMedidorGeoById(medidorId) {
    try {
      const data = await this.makeRequest(`${API_CONFIG.endpoints.medidores}/${medidorId}`);

      return {
        success: true,
        data: data
      };

    } catch (error) {
      console.error('❌ Error obteniendo medidor geo:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener medidor'
      };
    }
  }

  /**
   * Obtener todos los sectores
   */
  async getSectores() {
    try {
      const data = await this.makeRequest(API_CONFIG.endpoints.sectores);

      this.cachedSectores = data;

      return {
        success: true,
        data: data
      };

    } catch (error) {
      console.error('❌ Error obteniendo sectores:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener sectores',
        data: []
      };
    }
  }

  /**
   * Obtener medidores agrupados por sector
   */
  async getMedidoresPorSector() {
    try {
      const medidoresResult = await this.getMedidoresGeo();
      
      if (!medidoresResult.success) {
        return medidoresResult;
      }

      const medidores = medidoresResult.data;
      const agrupados = {};

      medidores.forEach(medidor => {
        const sectorId = medidor.id_sector || 'sin_sector';
        const sectorNombre = medidor.sector?.nombre_sector || 'Sin Sector';

        if (!agrupados[sectorId]) {
          agrupados[sectorId] = {
            id_sector: sectorId === 'sin_sector' ? null : sectorId,
            nombre_sector: sectorNombre,
            medidores: [],
            total: 0,
            activos: 0,
            inactivos: 0,
            asignados: 0,
            sin_asignar: 0
          };
        }

        agrupados[sectorId].medidores.push(medidor);
        agrupados[sectorId].total++;
        
        if (medidor.activo) agrupados[sectorId].activos++;
        else agrupados[sectorId].inactivos++;
        
        if (medidor.id_usuario_afi) agrupados[sectorId].asignados++;
        else agrupados[sectorId].sin_asignar++;
      });

      return {
        success: true,
        data: Object.values(agrupados)
      };

    } catch (error) {
      console.error('❌ Error agrupando medidores por sector:', error);
      return {
        success: false,
        message: error.message || 'Error al agrupar medidores'
      };
    }
  }

  /**
   * Obtener estadísticas geográficas
   */
  async getEstadisticasGeo() {
    try {
      const result = await this.getMedidoresGeo();
      
      if (!result.success) {
        return result;
      }

      const medidores = result.data;

      const stats = {
        total_medidores: medidores.length,
        medidores_con_geo: medidores.filter(m => m.latitud && m.longitud).length,
        medidores_sin_geo: medidores.filter(m => !m.latitud || !m.longitud).length,
        medidores_activos: medidores.filter(m => m.activo).length,
        medidores_inactivos: medidores.filter(m => !m.activo).length,
        medidores_asignados: medidores.filter(m => m.id_usuario_afi).length,
        medidores_sin_asignar: medidores.filter(m => !m.id_usuario_afi).length,
        sectores_unicos: [...new Set(medidores.map(m => m.id_sector).filter(Boolean))].length,
        cobertura_geo: 0
      };

      stats.cobertura_geo = stats.total_medidores > 0 
        ? ((stats.medidores_con_geo / stats.total_medidores) * 100).toFixed(1)
        : 0;

      // Calcular centro geográfico (centroide)
      if (medidores.length > 0) {
        const latitudes = medidores.map(m => parseFloat(m.latitud)).filter(Boolean);
        const longitudes = medidores.map(m => parseFloat(m.longitud)).filter(Boolean);

        if (latitudes.length > 0 && longitudes.length > 0) {
          stats.centro = {
            lat: latitudes.reduce((a, b) => a + b, 0) / latitudes.length,
            lng: longitudes.reduce((a, b) => a + b, 0) / longitudes.length
          };

          // Calcular bounds (límites del mapa)
          stats.bounds = {
            norte: Math.max(...latitudes),
            sur: Math.min(...latitudes),
            este: Math.max(...longitudes),
            oeste: Math.min(...longitudes)
          };
        }
      }

      return {
        success: true,
        data: stats
      };

    } catch (error) {
      console.error('❌ Error obteniendo estadísticas geo:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener estadísticas'
      };
    }
  }

  /**
   * Buscar medidores cercanos a una coordenada
   */
  async getMedidoresCercanos(lat, lng, radioKm = 1) {
    try {
      const result = await this.getMedidoresGeo();
      
      if (!result.success) {
        return result;
      }

      const medidores = result.data;

      // Calcular distancia usando fórmula de Haversine
      const calcularDistancia = (lat1, lon1, lat2, lon2) => {
        const R = 6371; // Radio de la Tierra en km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
      };

      const medidoresCercanos = medidores
        .map(medidor => ({
          ...medidor,
          distancia: calcularDistancia(
            lat, 
            lng, 
            parseFloat(medidor.latitud), 
            parseFloat(medidor.longitud)
          )
        }))
        .filter(medidor => medidor.distancia <= radioKm)
        .sort((a, b) => a.distancia - b.distancia);

      return {
        success: true,
        data: medidoresCercanos,
        total: medidoresCercanos.length
      };

    } catch (error) {
      console.error('❌ Error buscando medidores cercanos:', error);
      return {
        success: false,
        message: error.message || 'Error al buscar medidores cercanos'
      };
    }
  }

  /**
   * Actualizar coordenadas de un medidor
   */
  async actualizarCoordenadas(medidorId, coordenadas) {
    try {
      const data = await this.makeRequest(`${API_CONFIG.endpoints.medidores}/${medidorId}`, {
        method: 'PUT',
        body: {
          latitud: coordenadas.latitud,
          longitud: coordenadas.longitud,
          altitud: coordenadas.altitud || null
        }
      });

      // Limpiar caché
      this.clearCache();

      return {
        success: true,
        data: data,
        message: 'Coordenadas actualizadas exitosamente'
      };

    } catch (error) {
      console.error('❌ Error actualizando coordenadas:', error);
      return {
        success: false,
        message: error.message || 'Error al actualizar coordenadas'
      };
    }
  }

  /**
   * Validar coordenadas
   */
  validarCoordenadas(lat, lng) {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);

    if (isNaN(latNum) || isNaN(lngNum)) {
      return {
        valido: false,
        mensaje: 'Las coordenadas deben ser números válidos'
      };
    }

    if (latNum < -90 || latNum > 90) {
      return {
        valido: false,
        mensaje: 'La latitud debe estar entre -90 y 90'
      };
    }

    if (lngNum < -180 || lngNum > 180) {
      return {
        valido: false,
        mensaje: 'La longitud debe estar entre -180 y 180'
      };
    }

    // Validación específica para Ecuador (aproximada)
    if (latNum < -5 || latNum > 2) {
      return {
        valido: false,
        mensaje: 'La latitud parece estar fuera de Ecuador',
        advertencia: true
      };
    }

    if (lngNum < -92 || lngNum > -75) {
      return {
        valido: false,
        mensaje: 'La longitud parece estar fuera de Ecuador',
        advertencia: true
      };
    }

    return {
      valido: true,
      mensaje: 'Coordenadas válidas'
    };
  }

  /**
   * Obtener medidores desde caché
   */
  getCachedMedidores() {
    return this.cachedMedidores || [];
  }

  /**
   * Obtener sectores desde caché
   */
  getCachedSectores() {
    return this.cachedSectores || [];
  }

  /**
   * Limpiar caché
   */
  clearCache() {
    this.cachedMedidores = null;
    this.cachedSectores = null;
    this.lastUpdate = null;
  }

  /**
   * Verificar si el caché es reciente (< 5 minutos)
   */
  isCacheReciente() {
    if (!this.lastUpdate) return false;
    const ahora = new Date();
    const diferencia = (ahora - this.lastUpdate) / 1000 / 60; // en minutos
    return diferencia < 5;
  }
}

const geolocalizacionService = new GeolocalizacionService();

export default geolocalizacionService;
export { GeolocalizacionService };