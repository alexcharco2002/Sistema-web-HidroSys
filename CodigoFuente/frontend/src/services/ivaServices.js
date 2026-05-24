/**
 * src/services/ivaServices.js
 * Servicio de Gestión de IVA - Actualizado
 */

import authService from './authServices';

const API_CONFIG = {
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
    endpoints: {
        list: '/iva/',                          // GET - Listar todos
        opciones: '/iva/opciones',              // GET - Opciones activas
        activo: '/iva/activo',                  // GET - IVA activo actual
        stats: '/iva/stats',                    // GET - Estadísticas
        getById: (id) => `/iva/${id}`,          // GET
        create: '/iva/',                        // POST
        update: (id) => `/iva/${id}`,           // PUT
        delete: (id) => `/iva/${id}`,           // DELETE
        activar: (id) => `/iva/${id}/activar`,  // PATCH
        desactivar: (id) => `/iva/${id}/desactivar`, // PATCH
        toggle: '/iva/toggle',                  // POST - Toggle general
    }
};

class IVAService {
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
                        
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), finalOptions.timeout);
            
            const response = await fetch(url, {
                ...finalOptions,
                signal: controller.signal,
            });
            
            clearTimeout(timeoutId);

            // ✅ Manejar 204 No Content (sin body) - DEBE IR ANTES de response.ok
            if (response.status === 204) {
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
                        return data;

        } catch (error) {
            console.error('Error en solicitud API:', error);
            
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
    // GESTIÓN DE IVA - LECTURA
    // ========================================

    /**
     * Listar todos los IVAs
     */
    async listIVAs(params = {}) {
        try {
            const queryParams = new URLSearchParams();
            
            if (params.skip !== undefined) queryParams.append('skip', params.skip);
            if (params.limit !== undefined) queryParams.append('limit', params.limit);
            if (params.activo !== undefined) queryParams.append('activo', params.activo);
            
            const queryString = queryParams.toString();
            const endpoint = queryString ? `${API_CONFIG.endpoints.list}?${queryString}` : API_CONFIG.endpoints.list;
            
            const data = await this.makeRequest(endpoint);
            
            return {
                success: true,
                data: Array.isArray(data) ? data : []
            };
        } catch (error) {
            console.error('Error listando IVAs:', error);
            return {
                success: false,
                message: error.message || 'Error al listar IVAs',
                data: []
            };
        }
    }

    /**
     * Obtener opciones de IVA activas (para selección)
     */
    async getOpcionesIVA() {
        try {
            const data = await this.makeRequest(API_CONFIG.endpoints.opciones);
            
            return {
                success: true,
                data: Array.isArray(data) ? data : []
            };
        } catch (error) {
            console.error('Error obteniendo opciones de IVA:', error);
            return {
                success: false,
                message: error.message || 'Error al obtener opciones de IVA',
                data: []
            };
        }
    }

    /**
     * Obtener el IVA activo actual (aplicable para facturación)
     */
    async getIVAActivo() {
        try {
            const data = await this.makeRequest(API_CONFIG.endpoints.activo);
            
            return {
                success: true,
                data: data
            };
        } catch (error) {
            console.error('Error obteniendo IVA activo:', error);
            return {
                success: false,
                message: error.message || 'Error al obtener el IVA activo',
                data: null
            };
        }
    }

    /**
     * Obtener estadísticas de IVAs
     */
    async getStats() {
        try {
            const data = await this.makeRequest(API_CONFIG.endpoints.stats);
            
            return {
                success: true,
                data: data
            };
        } catch (error) {
            console.error('Error obteniendo estadísticas de IVA:', error);
            return {
                success: false,
                message: error.message || 'Error al obtener estadísticas'
            };
        }
    }

    /**
     * Obtener un IVA por ID
     */
    async getIVAById(id) {
        try {
            const data = await this.makeRequest(API_CONFIG.endpoints.getById(id));
            
            return {
                success: true,
                data: data
            };
        } catch (error) {
            console.error('Error obteniendo IVA:', error);
            return {
                success: false,
                message: error.message || 'Error al obtener el IVA'
            };
        }
    }

    // ========================================
    // GESTIÓN DE IVA - CREACIÓN
    // ========================================

    /**
     * Crear un nuevo IVA
     * NOTA: Siempre se crea desactivado (activo=false) y no aplicable (es_aplicable=false)
     */
    async createIVA(ivaData) {
        try {
            this.validateIVAData(ivaData);
            
            const data = await this.makeRequest(
                API_CONFIG.endpoints.create,
                {
                    method: 'POST',
                    body: ivaData
                }
            );
            
            return {
                success: true,
                message: 'IVA creado exitosamente (desactivado por defecto)',
                data: data
            };
        } catch (error) {
            console.error('Error creando IVA:', error);
            return {
                success: false,
                message: error.message || 'Error al crear el IVA'
            };
        }
    }

    // ========================================
    // GESTIÓN DE IVA - ACTUALIZACIÓN
    // ========================================

    /**
     * Actualizar un IVA
     * NOTA: No permite activar directamente desde aquí, use /activar o /toggle
     */
    async updateIVA(id, ivaData) {
        try {
            const data = await this.makeRequest(
                API_CONFIG.endpoints.update(id),
                {
                    method: 'PUT',
                    body: ivaData
                }
            );
            
            return {
                success: true,
                message: 'IVA actualizado exitosamente',
                data: data
            };
        } catch (error) {
            console.error('Error actualizando IVA:', error);
            return {
                success: false,
                message: error.message || 'Error al actualizar el IVA'
            };
        }
    }

    // ========================================
    // GESTIÓN DE IVA - ELIMINACIÓN
    // ========================================

    /**
     * Eliminar un IVA
     * NOTA: No se puede eliminar si es el único con es_aplicable=true
     */
    async deleteIVA(id) {
        try {
            await this.makeRequest(
                API_CONFIG.endpoints.delete(id),
                {
                    method: 'DELETE'
                }
            );
            
            return {
                success: true,
                message: 'IVA eliminado exitosamente'
            };
        } catch (error) {
            console.error('Error eliminando IVA:', error);
            return {
                success: false,
                message: error.message || 'Error al eliminar el IVA'
            };
        }
    }

    // ========================================
    // GESTIÓN DE IVA - ACTIVACIÓN/DESACTIVACIÓN
    // ========================================

    /**
     * Activar un IVA específico
     * Desactiva automáticamente todos los demás IVAs
     */
    async activarIVA(id) {
        try {
            const data = await this.makeRequest(
                API_CONFIG.endpoints.activar(id),
                {
                    method: 'PATCH'
                }
            );
            
            return {
                success: true,
                message: data?.mensaje || 'IVA activado exitosamente',
                data: data
            };
        } catch (error) {
            console.error('Error activando IVA:', error);
            return {
                success: false,
                message: error.message || 'Error al activar el IVA'
            };
        }
    }

    /**
     * Desactivar un IVA específico
     * NOTA: Si es el único con es_aplicable=true, no se puede desactivar
     */
    async desactivarIVA(id) {
        try {
            const data = await this.makeRequest(
                API_CONFIG.endpoints.desactivar(id),
                {
                    method: 'PATCH'
                }
            );
            
            return {
                success: true,
                message: data?.mensaje || 'IVA desactivado exitosamente',
                data: data
            };
        } catch (error) {
            console.error('Error desactivando IVA:', error);
            return {
                success: false,
                message: error.message || 'Error al desactivar el IVA'
            };
        }
    }

    /**
     * Toggle general de IVA
     * @param {boolean} activar - true = activar solo el IVA aplicable, false = desactivar todos
     */
    async toggleIVA(activar) {
        try {
            const endpoint = `${API_CONFIG.endpoints.toggle}?activar=${activar}`;
            
            const data = await this.makeRequest(endpoint, {
                method: 'POST'
            });
            
            return {
                success: true,
                message: data?.mensaje || (activar ? 'IVA activado' : 'IVAs desactivados'),
                data: data
            };
        } catch (error) {
            console.error('Error en toggle de IVA:', error);
            return {
                success: false,
                message: error.message || 'Error al cambiar estado del IVA'
            };
        }
    }

    // ========================================
    // VALIDACIONES
    // ========================================

    /**
     * Validar datos del IVA
     */
    validateIVAData(ivaData) {
        if (!ivaData.codigo || ivaData.codigo.trim() === '') {
            throw new Error('El código del IVA es requerido');
        }

        if (!ivaData.descripcion || ivaData.descripcion.trim() === '') {
            throw new Error('La descripción del IVA es requerida');
        }

        if (ivaData.porcentaje === undefined || ivaData.porcentaje === null) {
            throw new Error('El porcentaje del IVA es requerido');
        }

        // Validaciones de rangos
        if (ivaData.porcentaje < 0 || ivaData.porcentaje > 100) {
            throw new Error('El porcentaje debe estar entre 0 y 100');
        }

        // ⚠️ LÓGICA INVERTIDA: es_aplicable
        // es_aplicable=true  → IVA SÍ se aplica (porcentaje > 0)
        // es_aplicable=false → IVA NO se aplica (puede tener cualquier porcentaje)
        
        if (ivaData.es_aplicable !== undefined) {
            if (ivaData.es_aplicable && ivaData.porcentaje <= 0) {
                throw new Error('Si es aplicable (true), el porcentaje debe ser mayor a 0');
            }
        }
    }

    // ========================================
    // UTILIDADES
    // ========================================

    /**
     * Formatear porcentaje para mostrar
     */
    formatPorcentaje(value) {
        if (value === undefined || value === null) return '0%';
        return `${parseFloat(value).toFixed(2)}%`;
    }

    /**
     * Verificar si un IVA es el activo actual
     */
    async isIVAActivo(id) {
        try {
            const result = await this.getIVAActivo();
            if (result.success && result.data) {
                return result.data.id_iva === id;
            }
            return false;
        } catch (error) {
            console.error('Error verificando IVA activo:', error);
            return false;
        }
    }

    /**
     * Obtener el estado actual del toggle
     * Retorna si hay un IVA con es_aplicable=true activo
     */
    async obtenerEstadoToggle() {
        try {
            const result = await this.getIVAActivo();
            
            // Si hay un IVA activo con es_aplicable=true, el toggle está ON
            const aplicarIva = result.success && result.data && result.data.es_aplicable === true;
            
                        
            return {
                success: true,
                aplicar_iva: aplicarIva,
                iva_activo: result.data
            };
        } catch (error) {
            console.error('Error obteniendo estado toggle:', error);
            return {
                success: true, // No fallar, solo asumir desactivado
                aplicar_iva: false,
                iva_activo: null
            };
        }
    }

    /**
     * Método helper para manejar el toggle desde el frontend
     * @param {boolean} activar - Estado deseado del toggle
     */
    async manejarToggleIVA(activar) {
        try {
                        
            // Usar el endpoint toggle del backend
            return await this.toggleIVA(activar);
            
        } catch (error) {
            console.error('Error manejando toggle de IVA:', error);
            return {
                success: false,
                message: error.message || 'Error al cambiar el estado del IVA'
            };
        }
    }

    /**
     * Obtener texto descriptivo del tipo de IVA
     * @param {object} iva - Objeto IVA
     */
    getTipoIVATexto(iva) {
        if (!iva) return 'Desconocido';
        
        // es_aplicable=true  → IVA aplicable (se aplica a facturas)
        // es_aplicable=false → NO aplicable (no se aplica)
        return iva.es_aplicable ? 'Aplicable' : 'No Aplicable';
    }

    /**
     * Obtener color para badge según tipo de IVA
     * @param {object} iva - Objeto IVA
     */
    getColorBadge(iva) {
        if (!iva) return 'gray';
        
        if (iva.es_aplicable) {
            return iva.activo ? 'green' : 'yellow';
        } else {
            return iva.activo ? 'blue' : 'gray';
        }
    }
}

const ivaService = new IVAService();

export default ivaService;
export { IVAService };
