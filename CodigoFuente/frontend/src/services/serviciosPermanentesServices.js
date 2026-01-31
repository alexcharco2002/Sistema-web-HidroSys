/**
 * src/services/serviciosPermanentesServices.js
 * Servicio de Gestión de Servicios Permanentes
 */

import authService from './authServices';

const API_CONFIG = {
    baseURL: 'https://localhost:8000',
    endpoints: {
        // Configuraciones
        list: '/servicios-permanentes',
        activa: '/servicios-permanentes/activa',
        stats: '/servicios-permanentes/stats',
        getById: (id) => `/servicios-permanentes/${id}`,
        create: '/servicios-permanentes',
        update: (id) => `/servicios-permanentes/${id}`,
        delete: (id) => `/servicios-permanentes/${id}`,
        activar: (id) => `/servicios-permanentes/${id}/activar`,
        desactivar: (id) => `/servicios-permanentes/${id}/desactivar`,
        
        // Asignaciones
        asignaciones: (configId) => `/servicios-permanentes/${configId}/asignaciones`,
        createAsignacion: (configId) => `/servicios-permanentes/${configId}/asignaciones`,
        createAsignacionBulk: (configId) => `/servicios-permanentes/${configId}/asignaciones/bulk`,
        updateAsignacion: (configId, asigId) => `/servicios-permanentes/${configId}/asignaciones/${asigId}`,
        deleteAsignacion: (configId, asigId) => `/servicios-permanentes/${configId}/asignaciones/${asigId}`,
        
        // Reportes
        reporteAfiliados: '/servicios-permanentes/afiliados',
        reporteServicios: '/servicios-permanentes/servicios',
        reporteSectores: '/servicios-permanentes/sectores'  
    }
};

class ServiciosPermanentesService {
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
            timeout: 15000,
        };

        const finalOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers,
            },
        };

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

  //  MÉTODO: Obtener sectores
    async getSectores(params = {}) {
        const queryParams = new URLSearchParams();
        if (params.skip !== undefined) queryParams.append('skip', params.skip);
        if (params.limit !== undefined) queryParams.append('limit', params.limit);
        if (params.search) queryParams.append('search', params.search);
        if (params.activo !== undefined) queryParams.append('activo', params.activo);

        try {
            const data = await this.makeRequest(
                `${API_CONFIG.endpoints.reporteSectores}?${queryParams.toString()}`
            );
            return { success: true, data };
        } catch (error) {
            console.error('❌ Error obteniendo sectores:', error);
            return { success: false, message: error.message, data: [] };
        }
    }


    // ========================================
    // CONFIGURACIONES - LECTURA
    // ========================================

    async listConfiguraciones(params = {}) {
        try {
            const queryParams = new URLSearchParams();
            if (params.skip !== undefined) queryParams.append('skip', params.skip);
            if (params.limit !== undefined) queryParams.append('limit', params.limit);
            if (params.activo !== undefined) queryParams.append('activo', params.activo);
            if (params.es_vigente !== undefined) queryParams.append('es_vigente', params.es_vigente);
            if (params.id_servicio !== undefined) queryParams.append('id_servicio', params.id_servicio);

            const queryString = queryParams.toString();
            const endpoint = queryString ? `${API_CONFIG.endpoints.list}?${queryString}` : API_CONFIG.endpoints.list;

            const data = await this.makeRequest(endpoint);
            return {
                success: true,
                data: Array.isArray(data) ? data : []
            };
        } catch (error) {
            console.error('❌ Error listando configuraciones:', error);
            return {
                success: false,
                message: error.message || 'Error al listar configuraciones',
                data: []
            };
        }
    }

    async getConfiguracionActiva() {
        try {
            const data = await this.makeRequest(API_CONFIG.endpoints.activa);
            return {
                success: true,
                data: data
            };
        } catch (error) {
            console.error('❌ Error obteniendo configuración activa:', error);
            return {
                success: false,
                message: error.message || 'Error al obtener la configuración activa',
                data: null
            };
        }
    }

    async getStats() {
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

    async getConfiguracionById(id) {
        try {
            const data = await this.makeRequest(API_CONFIG.endpoints.getById(id));
            return {
                success: true,
                data: data
            };
        } catch (error) {
            console.error('❌ Error obteniendo configuración:', error);
            return {
                success: false,
                message: error.message || 'Error al obtener la configuración'
            };
        }
    }

    // ========================================
    // CONFIGURACIONES - CREACIÓN
    // ========================================

    async createConfiguracion(configData) {
        try {
            this.validateConfigData(configData);

            const data = await this.makeRequest(
                API_CONFIG.endpoints.create,
                {
                    method: 'POST',
                    body: configData
                }
            );

            return {
                success: true,
                message: 'Configuración creada exitosamente (desactivada por defecto)',
                data: data
            };
        } catch (error) {
            console.error('❌ Error creando configuración:', error);
            return {
                success: false,
                message: error.message || 'Error al crear la configuración'
            };
        }
    }

    // ========================================
    // CONFIGURACIONES - ACTUALIZACIÓN
    // ========================================

    async updateConfiguracion(id, configData) {
        try {
            const data = await this.makeRequest(
                API_CONFIG.endpoints.update(id),
                {
                    method: 'PUT',
                    body: configData
                }
            );

            return {
                success: true,
                message: 'Configuración actualizada exitosamente',
                data: data
            };
        } catch (error) {
            console.error('❌ Error actualizando configuración:', error);
            return {
                success: false,
                message: error.message || 'Error al actualizar la configuración'
            };
        }
    }

    // ========================================
    // CONFIGURACIONES - ELIMINACIÓN
    // ========================================

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
                message: 'Configuración eliminada exitosamente'
            };
        } catch (error) {
            console.error('❌ Error eliminando configuración:', error);
            return {
                success: false,
                message: error.message || 'Error al eliminar la configuración'
            };
        }
    }

    // ========================================
    // CONFIGURACIONES - ACTIVACIÓN/DESACTIVACIÓN
    // ========================================

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
                message: data?.mensaje || 'Configuración activada exitosamente',
                data: data
            };
        } catch (error) {
            console.error('❌ Error activando configuración:', error);
            return {
                success: false,
                message: error.message || 'Error al activar la configuración'
            };
        }
    }

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
                message: data?.mensaje || 'Configuración desactivada exitosamente',
                data: data
            };
        } catch (error) {
            console.error('❌ Error desactivando configuración:', error);
            return {
                success: false,
                message: error.message || 'Error al desactivar la configuración'
            };
        }
    }

    // ========================================
    // ASIGNACIONES - LECTURA
    // ========================================

    async listAsignaciones(configId, activo = null) {
        try {
            const queryParams = new URLSearchParams();
            if (activo !== null) queryParams.append('activo', activo);

            const queryString = queryParams.toString();
            const endpoint = queryString 
                ? `${API_CONFIG.endpoints.asignaciones(configId)}?${queryString}` 
                : API_CONFIG.endpoints.asignaciones(configId);

            const data = await this.makeRequest(endpoint);
            return {
                success: true,
                data: Array.isArray(data) ? data : []
            };
        } catch (error) {
            console.error('❌ Error listando asignaciones:', error);
            return {
                success: false,
                message: error.message || 'Error al listar asignaciones',
                data: []
            };
        }
    }

    // ========================================
    // ASIGNACIONES - CREACIÓN
    // ========================================

    async createAsignacion(configId, asignacionData) {
        try {
            const data = await this.makeRequest(
                API_CONFIG.endpoints.createAsignacion(configId),
                {
                    method: 'POST',
                    body: asignacionData
                }
            );

            return {
                success: true,
                message: 'Usuario asignado exitosamente',
                data: data
            };
        } catch (error) {
            console.error('❌ Error creando asignación:', error);
            return {
                success: false,
                message: error.message || 'Error al asignar usuario'
            };
        }
    }

    async createAsignacionBulk(configId, asignacionBulkData) {
        try {
            const data = await this.makeRequest(
                API_CONFIG.endpoints.createAsignacionBulk(configId),
                {
                    method: 'POST',
                    body: asignacionBulkData
                }
            );

            return {
                success: true,
                message: 'Asignaciones masivas creadas',
                data: data
            };
        } catch (error) {
            console.error('❌ Error creando asignaciones masivas:', error);
            return {
                success: false,
                message: error.message || 'Error al crear asignaciones masivas'
            };
        }
    }

    // ========================================
    // ASIGNACIONES - ACTUALIZACIÓN
    // ========================================

    async updateAsignacion(configId, asigId, asignacionData) {
        try {
            const data = await this.makeRequest(
                API_CONFIG.endpoints.updateAsignacion(configId, asigId),
                {
                    method: 'PUT',
                    body: asignacionData
                }
            );

            return {
                success: true,
                message: 'Asignación actualizada exitosamente',
                data: data
            };
        } catch (error) {
            console.error('❌ Error actualizando asignación:', error);
            return {
                success: false,
                message: error.message || 'Error al actualizar asignación'
            };
        }
    }

    // ========================================
    // ASIGNACIONES - ELIMINACIÓN
    // ========================================

    async deleteAsignacion(configId, asigId) {
        try {
            await this.makeRequest(
                API_CONFIG.endpoints.deleteAsignacion(configId, asigId),
                {
                    method: 'DELETE'
                }
            );

            return {
                success: true,
                message: 'Asignación eliminada exitosamente'
            };
        } catch (error) {
            console.error('❌ Error eliminando asignación:', error);
            return {
                success: false,
                message: error.message || 'Error al eliminar asignación'
            };
        }
    }

    // ========================================
    // REPORTES
    // ========================================

    async getAfiliados(params = {}) {
        try {
            const queryParams = new URLSearchParams();
            if (params.search) queryParams.append('search', params.search);
            if (params.sector) queryParams.append('sector', params.sector);
            if (params.estado) queryParams.append('estado', params.estado);
            if (params.limit) queryParams.append('limit', params.limit);

            const queryString = queryParams.toString();
            const endpoint = queryString 
                ? `${API_CONFIG.endpoints.reporteAfiliados}?${queryString}` 
                : API_CONFIG.endpoints.reporteAfiliados;

            const data = await this.makeRequest(endpoint);
            return {
                success: true,
                data: Array.isArray(data) ? data : []
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

    async getServicios(params = {}) {
        try {
            const queryParams = new URLSearchParams();
            if (params.activo !== undefined) queryParams.append('activo', params.activo);
            if (params.vigente !== undefined) queryParams.append('vigente', params.vigente);
            if (params.search) queryParams.append('search', params.search);
            if (params.limit) queryParams.append('limit', params.limit);

            const queryString = queryParams.toString();
            const endpoint = queryString 
                ? `${API_CONFIG.endpoints.reporteServicios}?${queryString}` 
                : API_CONFIG.endpoints.reporteServicios;

            const data = await this.makeRequest(endpoint);
            return {
                success: true,
                data: Array.isArray(data) ? data : []
            };
        } catch (error) {
            console.error('❌ Error obteniendo servicios:', error);
            return {
                success: false,
                message: error.message || 'Error al obtener servicios',
                data: []
            };
        }
    }

    // ========================================
    // VALIDACIONES
    // ========================================

    validateConfigData(configData) {
        if (!configData.nombre || configData.nombre.trim() === '') {
            throw new Error('El nombre de la configuración es requerido');
        }

        if (!configData.id_servicio || configData.id_servicio <= 0) {
            throw new Error('Debe seleccionar un servicio válido');
        }

        if (!configData.vigencia_desde) {
            throw new Error('La fecha de vigencia desde es requerida');
        }

        const periodosValidos = ['mensual', 'bimestral', 'trimestral'];
        if (configData.aplicar_en_periodo && !periodosValidos.includes(configData.aplicar_en_periodo)) {
            throw new Error('El periodo de aplicación debe ser: mensual, bimestral o trimestral');
        }

        if (configData.precio_override && configData.precio_override < 0) {
            throw new Error('El precio override no puede ser negativo');
        }
    }

    // ========================================
    // UTILIDADES
    // ========================================

    formatPeriodo(periodo) {
        const periodos = {
            'mensual': 'Mensual',
            'bimestral': 'Bimestral',
            'trimestral': 'Trimestral'
        };
        return periodos[periodo] || periodo;
    }

    getColorBadge(config) {
        if (!config) return 'gray';
        if (config.activo && config.aplicar_servicio) {
            return 'green';
        } else if (config.activo && !config.aplicar_servicio) {
            return 'yellow';
        } else {
            return 'gray';
        }
    }

    async obtenerEstadoServicioPermanente() {
        try {
            const result = await this.getConfiguracionActiva();
            const aplicarServicio = result.success && result.data && result.data.aplicar_servicio === true;
            console.log(`🎯 Estado servicio permanente: ${aplicarServicio ? 'ACTIVADO' : 'DESACTIVADO'}`);
            return {
                success: true,
                aplicar_servicio: aplicarServicio,
                configuracion_activa: result.data
            };
        } catch (error) {
            console.error('❌ Error obteniendo estado:', error);
            return {
                success: true,
                aplicar_servicio: false,
                configuracion_activa: null
            };
        }
    }
}

const serviciosPermanentesService = new ServiciosPermanentesService();
export default serviciosPermanentesService;
export { ServiciosPermanentesService };
