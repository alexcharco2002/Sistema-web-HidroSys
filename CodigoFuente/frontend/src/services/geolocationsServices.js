// src/services/geolocationsServices.js

import authService from './authServices';

const API_CONFIG = {
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
   endpoints: {
    medidoresGeo:     '/geo/medidores',
    misMedidores:     '/geo/medidores/mis-medidores',
    medidoresCercanos:'/geo/medidores/cercanos',
    sectores:         '/geo/sectores',
    estadisticas:     '/geo/estadisticas',
    validarUbicacion: '/geo/validar-ubicacion',
    actualizarCoords: '/geo/medidores', // + /{id}/
    baseGeoMedidores:    '/geo/medidores', // para PUT con ID
    limitesGeograficos: '/geo/limites',
  },
  // ← Cuántos minutos se considera válido el caché en memoria
  CACHE_TTL_MIN: 5,
};

class GeolocalizacionService {
  constructor() {
    this._cache = {};          // { [key]: { data, expiresAt } }
    this._inflight = {};       // promesas en vuelo para deduplicar
  }

  // ── Caché en memoria con TTL ─────────────────────────────────────────
  _getCache(key) {
    const entry = this._cache[key];
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      delete this._cache[key];
      return null;
    }
    return entry.data;
  }

  _setCache(key, data, ttlMin = API_CONFIG.CACHE_TTL_MIN) {
    this._cache[key] = {
      data,
      expiresAt: Date.now() + ttlMin * 60 * 1000,
    };
  }

  // ── Request base con deduplicación ──────────────────────────────────
  async makeRequest(endpoint, options = {}) {
    const url = `${API_CONFIG.baseURL}${endpoint}`;
    const key  = `${options.method || 'GET'}::${url}`;

    // Si ya hay una petición igual en vuelo, reutilizarla
    if (options.method === undefined || options.method === 'GET') {
      if (this._inflight[key]) return this._inflight[key];
    }

    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 15000);

    const promise = fetch(url, {
      method: 'GET',
      ...options,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${authService.getToken()}`,
        ...options.headers,
      },
      signal: controller.signal,
    })
      .then(async (res) => {
        clearTimeout(timeoutId);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(
            typeof err.detail === 'string' ? err.detail : `HTTP ${res.status}`
          );
        }
        return res.json();
      })
      .catch((err) => {
        if (err.name === 'AbortError') throw new Error('Tiempo de espera agotado');
        if (err.message?.includes('Failed to fetch'))
          throw new Error('No se pudo conectar con el servidor');
        throw err;
      })
      .finally(() => {
        delete this._inflight[key];
      });

    if (options.method === undefined || options.method === 'GET') {
      this._inflight[key] = promise;
    }

    return promise;
  }

  // ── Medidores con coordenadas — con caché real ───────────────────────
  async getMedidoresGeo() {
    const CACHE_KEY = 'medidores_geo';

    // ✅ Verificar caché antes de ir al servidor
    const cached = this._getCache(CACHE_KEY);
    if (cached) {
      console.log('📦 GEO: usando caché de medidores');
      return { success: true, data: cached, fromCache: true };
    }

    try {
      const data = await this.makeRequest(API_CONFIG.endpoints.medidoresGeo);
      const lista = Array.isArray(data) ? data : [];
      // Solo almacenar en caché si hay datos
      if (lista.length > 0) this._setCache(CACHE_KEY, lista);
      return { success: true, data: lista, fromCache: false };
    } catch (error) {
      console.error('❌ Error obteniendo medidores geo:', error);
      // ── Fallback: devolver caché expirado si existe ──────────────
      const stale = this._cache[CACHE_KEY]?.data;
      if (stale) {
        console.warn('⚠️ GEO: usando caché expirado como fallback');
        return { success: true, data: stale, fromCache: true, stale: true };
      }
      return { success: false, message: error.message, data: [] };
    }
  }

  // función para obtener los límites geográficos del área de cobertura, 
  // sin caché (cambia poco pero es importante tenerlo actualizado)
  async getLimitesGeograficos() {
    const cacheKey = 'limites_geograficos';
    const cached = this._getCache(cacheKey);

    if (cached) {
      return { success: true, data: cached };
    }

    try {
      const res = await this._fetch(API_CONFIG.endpoints.limitesGeograficos);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return {
          success: false,
          data: [],
          message: err.detail || `HTTP ${res.status}`,
        };
      }

      const payload = await res.json();
      const data = Array.isArray(payload) ? payload : (payload.data ?? []);

      this._setCache(cacheKey, data);
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        data: [],
        message: error.message,
      };
    }
  }

  // ── Mis medidores — caché de 10 min (cambia poco) ───────────────────
  async getMisMedidores() {
    const CACHE_KEY = 'mis_medidores';
    const cached = this._getCache(CACHE_KEY);
    if (cached) return { success: true, data: cached };

    try {
      const data = await this.makeRequest(API_CONFIG.endpoints.misMedidores);
      const lista = Array.isArray(data) ? data : (data ? [data] : []);
      this._setCache(CACHE_KEY, lista, 10);
      return { success: true, data: lista };
    } catch (error) {
      if (error.message?.includes('404')) return { success: true, data: [], sinMedidor: true };
      return { success: false, data: [], message: error.message };
    }
  }

  // ── Sectores — caché de 30 min (cambia muy poco) ────────────────────
  async getSectores() {
    const CACHE_KEY = 'sectores';
    const cached = this._getCache(CACHE_KEY);
    if (cached) return { success: true, data: cached };

    try {
      const data = await this.makeRequest(API_CONFIG.endpoints.sectores);
      this._setCache(CACHE_KEY, data, 30);
      return { success: true, data };
    } catch (error) {
      return { success: false, message: error.message, data: [] };
    }
  }

  // ── Estadísticas — calculadas del caché de medidores ────────────────
  async getEstadisticasGeo() {
    const result = await this.getMedidoresGeo();
    if (!result.success) return result;
    const meds = result.data;
    const stats = {
      total_medidores:     meds.length,
      medidores_con_geo:   meds.length,    // ya vienen filtrados
      medidores_activos:   meds.filter(m => m.activo).length,
      medidores_inactivos: meds.filter(m => !m.activo).length,
      medidores_asignados: meds.filter(m => m.id_usuario_afi).length,
      sectores_unicos:     new Set(meds.map(m => m.id_sector).filter(Boolean)).size,
      cobertura_geo:       '100.0',
    };
    return { success: true, data: stats };
  }

  // ── Medidores cercanos (Haversine — sin llamada extra) ───────────────
  async getMedidoresCercanos(lat, lng, radioKm = 1) {
    const result = await this.getMedidoresGeo();
    if (!result.success) return result;
    const R = 6371;
    const dist = (la1, lo1, la2, lo2) => {
      const dLat = (la2 - la1) * Math.PI / 180;
      const dLon = (lo2 - lo1) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 +
        Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dLon/2)**2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    };
    const cercanos = result.data
      .map(m => ({ ...m, distancia: dist(lat, lng, m.latitud, m.longitud) }))
      .filter(m => m.distancia <= radioKm)
      .sort((a, b) => a.distancia - b.distancia);
    return { success: true, data: cercanos };
  }

  // ── Actualizar SOLO coordenadas de un medidor ────────────────────────────
  async actualizarCoordenadas(medidorId, coordenadas) {
    try {
      const res = await fetch(
        `${API_CONFIG.baseURL}${API_CONFIG.endpoints.baseGeoMedidores}/${medidorId}/coordenadas`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authService.getToken()}`,
          },
          body: JSON.stringify({
            latitud:  coordenadas.latitud,
            longitud: coordenadas.longitud,
            altitud:  coordenadas.altitud ?? null,
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const detalle = err.detail;
        // El backend puede devolver detail como objeto {error, mensaje}
        const msg = typeof detalle === 'string'
          ? detalle
          : detalle?.mensaje || detalle?.error || `HTTP ${res.status}`;
        return { success: false, message: msg };
      }

      const data = await res.json();

      // ── Invalidar el caché para que el próximo getMedidoresGeo
      //    traiga las coords actualizadas (R03: no-store en la respuesta)
      this.clearCache('medidores_geo');
      this.clearCache('mis_medidores');

      return { success: true, data, message: data.message || 'Coordenadas actualizadas' };

    } catch (error) {
      if (error.name === 'AbortError') return { success: false, message: 'Tiempo de espera agotado' };
      if (error.message?.includes('Failed to fetch'))
        return { success: false, message: 'No se pudo conectar con el servidor' };
      return { success: false, message: error.message };
    }
  }


  validarCoordenadas(lat, lng) {
    const la = parseFloat(lat), ln = parseFloat(lng);
    if (isNaN(la) || isNaN(ln)) return { valido: false, mensaje: 'Coordenadas inválidas' };
    if (la < -5 || la > 2)      return { valido: false, mensaje: 'Latitud fuera de Ecuador', advertencia: true };
    if (ln < -92 || ln > -75)   return { valido: false, mensaje: 'Longitud fuera de Ecuador', advertencia: true };
    return { valido: true, mensaje: 'Coordenadas válidas' };
  }

  // ── Utilidades de caché ──────────────────────────────────────────────
  clearCache(key = null) {
    if (key) delete this._cache[key];
    else this._cache = {};
  }

  isCacheReciente(key = 'medidores_geo') {
    return this._getCache(key) !== null;
  }

  getCacheInfo() {
    return Object.entries(this._cache).map(([k, v]) => ({
      key: k,
      expiresIn: Math.round((v.expiresAt - Date.now()) / 1000) + 's',
    }));
  }
}

const geolocalizacionService = new GeolocalizacionService();
export default geolocalizacionService;
export { GeolocalizacionService };