/**
 * src/services/rolesService.js
 * Servicio de Gestión de Roles y Permisos del Sistema
 * Tablas: t_roles, t_rol_acciones
 */

import authService from './authServices';

const API_CONFIG = {
baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
  endpoints: {
    // Endpoints de Roles
    roles: '/roles',
    roleById: (id) => `/roles/${id}`,
    toggleRoleStatus: (id) => `/roles/${id}/toggle-status`,
    
    // Endpoints de Acciones (Permisos)
    roleActions: (roleId) => `/roles/${roleId}/acciones`,
    actionById: (actionId) => `/roles/acciones/${actionId}`,
    toggleActionStatus: (actionId) => `/roles/acciones/${actionId}/toggle-status`,

  }
};

class RolesService {
  constructor() {
    this.cachedRoles = null;
  }

  /**
   * Realizar petición HTTPS con configuración común
   */
  async makeRequest(endpoint, options = {}) {
    const url = `${API_CONFIG.baseURL}${endpoint}`;
    
    const defaultOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${authService.getToken()}`
      },
      timeout: 10000,
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
      console.error('Error en solicitud de roles:', error);
      
      if (error.name === 'AbortError') {
        throw new Error('La petición tardó demasiado tiempo');
      }
      
      if (error.message.includes('Failed to fetch')) {
        throw new Error('No se pudo conectar con el servidor');
      }

      throw error;
    }
  }

  // ============================================
  // OPERACIONES CRUD - ROLES
  // ============================================

  /**
   * Obtener lista de roles
   */
  async getRoles(filters = {}) {
    try {
      const params = new URLSearchParams();
      
      if (filters.search) params.append('search', filters.search);
      if (filters.estado !== undefined) params.append('estado', filters.estado);
      if (filters.skip) params.append('skip', filters.skip);
      if (filters.limit) params.append('limit', filters.limit);

      const queryString = params.toString();
      const endpoint = queryString 
        ? `${API_CONFIG.endpoints.roles}?${queryString}` 
        : API_CONFIG.endpoints.roles;

      const data = await this.makeRequest(endpoint);

      // Actualizar caché
      if (!filters.search && !filters.estado) {
        this.cachedRoles = data;
      }

      return {
        success: true,
        data: data
      };

    } catch (error) {
      console.error('Error al obtener roles:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener roles',
        data: []
      };
    }
  }

  /**
   * Obtener un rol por ID
   */
  async getRoleById(roleId) {
    try {
      if (!roleId || isNaN(roleId)) {
        throw new Error('ID de rol inválido');
      }

      const data = await this.makeRequest(API_CONFIG.endpoints.roleById(roleId));

      return {
        success: true,
        data: data
      };

    } catch (error) {
      console.error('Error al obtener rol:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener rol'
      };
    }
  }

  /**
   * Crear un nuevo rol
   */
  async createRole(roleData) {
    try {
      // Validar datos
      this.validateRoleData(roleData, true);

      const data = await this.makeRequest(API_CONFIG.endpoints.roles, {
        method: 'POST',
        body: JSON.stringify({
          nombre_rol: roleData.nombre_rol.trim(),
          descripcion: roleData.descripcion?.trim() || null,
          activo: roleData.activo !== undefined ? roleData.activo : true
        })
      });

      // Limpiar caché
      this.clearRolesCache();

      return {
        success: true,
        data: data,
        message: 'Rol creado exitosamente'
      };

    } catch (error) {
      console.error('Error al crear rol:', error);
      return {
        success: false,
        message: error.message || 'Error al crear rol'
      };
    }
  }

  /**
   * Actualizar un rol existente
   */
  async updateRole(roleId, roleData) {
    try {
      if (!roleId || isNaN(roleId)) {
        throw new Error('ID de rol inválido');
      }

      // Validar datos (no todos son requeridos en actualización)
      this.validateRoleData(roleData, false);

      const updateData = {};
      
      if (roleData.nombre_rol) updateData.nombre_rol = roleData.nombre_rol.trim();
      if (roleData.descripcion !== undefined) updateData.descripcion = roleData.descripcion?.trim() || null;
      if (roleData.activo !== undefined) updateData.activo = roleData.activo;

      const data = await this.makeRequest(API_CONFIG.endpoints.roleById(roleId), {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });

      // Limpiar caché
      this.clearRolesCache();

      return {
        success: true,
        data: data,
        message: 'Rol actualizado exitosamente'
      };

    } catch (error) {
      console.error('Error al actualizar rol:', error);
      return {
        success: false,
        message: error.message || 'Error al actualizar rol'
      };
    }
  }

  /**
   * Eliminar un rol
   */
  async deleteRole(roleId) {
    try {
      if (!roleId || isNaN(roleId)) {
        throw new Error('ID de rol inválido');
      }

      const data = await this.makeRequest(API_CONFIG.endpoints.roleById(roleId), {
        method: 'DELETE'
      });

      // Limpiar caché
      this.clearRolesCache();

      return {
        success: true,
        data: data,
        message: data?.message || 'Rol eliminado exitosamente'
      };

    } catch (error) {
      console.error('Error al eliminar rol:', error);
      return {
        success: false,
        message: error.message || 'Error al eliminar rol'
      };
    }
  }

  /**
   * Activar/Desactivar rol
   */
  async toggleRoleStatus(roleId) {
    try {
      if (!roleId || isNaN(roleId)) {
        throw new Error('ID de rol inválido');
      }

      const data = await this.makeRequest(API_CONFIG.endpoints.toggleRoleStatus(roleId), {
        method: 'PATCH'
      });

      // Limpiar caché
      this.clearRolesCache();

      return {
        success: true,
        data: data,
        message: 'Estado del rol actualizado'
      };

    } catch (error) {
      console.error('Error al cambiar estado del rol:', error);
      return {
        success: false,
        message: error.message || 'Error al cambiar estado del rol'
      };
    }
  }

  // ============================================
  // OPERACIONES CRUD - ACCIONES (PERMISOS)
  // ============================================

  /**
   * Obtener acciones de un rol específico
   */
  async getRoleActions(roleId) {
    try {
      if (!roleId || isNaN(roleId)) {
        throw new Error('ID de rol inválido');
      }

      const data = await this.makeRequest(API_CONFIG.endpoints.roleActions(roleId));

      return {
        success: true,
        data: data
      };

    } catch (error) {
      console.error('Error al obtener acciones del rol:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener acciones del rol',
        data: []
      };
    }
  }

  /**
   * Crear una nueva acción para un rol
   */
  async createRoleAction(roleId, actionData) {
    try {
      if (!roleId || isNaN(roleId)) {
        throw new Error('ID de rol inválido');
      }

      // Validar datos
      this.validateActionData(actionData, true);

      const data = await this.makeRequest(API_CONFIG.endpoints.roleActions(roleId), {
        method: 'POST',
        body: JSON.stringify({
          nombre_accion: actionData.nombre_accion.trim(),
          tipo_accion: actionData.tipo_accion.trim(),
          estado: actionData.estado !== undefined ? actionData.estado : true
        })
      });

      return {
        success: true,
        data: data,
        message: 'Acción creada exitosamente'
      };

    } catch (error) {
      console.error('Error al crear accion:', error);
      return {
        success: false,
        message: error.message || 'Error al crear acción'
      };
    }
  }

  /**
   * Actualizar una acción existente
   */
  async updateRoleAction(actionId, actionData) {
    try {
      if (!actionId || isNaN(actionId)) {
        throw new Error('ID de acción inválido');
      }

      // Validar datos
      this.validateActionData(actionData, false);

      const updateData = {};
      
      if (actionData.nombre_accion) updateData.nombre_accion = actionData.nombre_accion.trim();
      if (actionData.tipo_accion) updateData.tipo_accion = actionData.tipo_accion.trim();
      if (actionData.estado !== undefined) updateData.estado = actionData.estado;

      const data = await this.makeRequest(API_CONFIG.endpoints.actionById(actionId), {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });

      return {
        success: true,
        data: data,
        message: 'Acción actualizada exitosamente'
      };

    } catch (error) {
      console.error('Error al actualizar accion:', error);
      return {
        success: false,
        message: error.message || 'Error al actualizar acción'
      };
    }
  }

  /**
   * Eliminar una acción
   */
  async deleteRoleAction(actionId) {
    try {
      if (!actionId || isNaN(actionId)) {
        throw new Error('ID de acción inválido');
      }

      const data = await this.makeRequest(API_CONFIG.endpoints.actionById(actionId), {
        method: 'DELETE'
      });

      return {
        success: true,
        data: data,
        message: 'Acción eliminada exitosamente'
      };

    } catch (error) {
      console.error('Error al eliminar accion:', error);
      return {
        success: false,
        message: error.message || 'Error al eliminar acción'
      };
    }
  }

  /**
   * Activar/Desactivar acción
   */
  async toggleActionStatus(actionId) {
    try {
      if (!actionId || isNaN(actionId)) {
        throw new Error('ID de acción inválido');
      }

      const data = await this.makeRequest(API_CONFIG.endpoints.toggleActionStatus(actionId), {
        method: 'PATCH'
      });

      return {
        success: true,
        data: data,
        message: 'Estado de la acción actualizado'
      };

    } catch (error) {
      console.error('Error al cambiar estado de la accion:', error);
      return {
        success: false,
        message: error.message || 'Error al cambiar estado de la acción'
      };
    }
  }

  // ============================================
  // VALIDACIONES
  // ============================================

  /**
   * Validar datos de rol
   */
  validateRoleData(roleData, required = true) {
    if (required) {
      if (!roleData.nombre_rol || roleData.nombre_rol.trim().length < 3) {
        throw new Error('El nombre del rol debe tener al menos 3 caracteres');
      }
    } else {
      if (roleData.nombre_rol && roleData.nombre_rol.trim().length < 3) {
        throw new Error('El nombre del rol debe tener al menos 3 caracteres');
      }
    }
  }

  /**
   * Validar datos de acción
   */
  validateActionData(actionData, required = true) {
    if (required) {
      if (!actionData.nombre_accion || actionData.nombre_accion.trim().length < 3) {
        throw new Error('El nombre de la acción debe tener al menos 3 caracteres');
      }

      if (!actionData.tipo_accion || actionData.tipo_accion.trim().length < 3) {
        throw new Error('El tipo de acción debe tener al menos 3 caracteres');
      }
    } else {
      if (actionData.nombre_accion && actionData.nombre_accion.trim().length < 3) {
        throw new Error('El nombre de la acción debe tener al menos 3 caracteres');
      }

      if (actionData.tipo_accion && actionData.tipo_accion.trim().length < 3) {
        throw new Error('El tipo de acción debe tener al menos 3 caracteres');
      }
    }
  }

  // ============================================
  // UTILIDADES
  // ============================================

  /**
   * Obtener estadísticas de roles y acciones
   */
  async getRolesStats() {
    try {
      const result = await this.getRoles();
      
      if (!result.success) {
        return result;
      }

      const roles = result.data;

      // Obtener acciones de cada rol
      const rolesWithActions = await Promise.all(
        roles.map(async (role) => {
          const actionsResult = await this.getRoleActions(role.id_rol);
          return {
            ...role,
            acciones: actionsResult.success ? actionsResult.data : []
          };
        })
      );

      const totalAcciones = rolesWithActions.reduce(
        (sum, role) => sum + role.acciones.length,
        0
      );

      const accionesActivas = rolesWithActions.reduce(
        (sum, role) => sum + role.acciones.filter(a => a.estado).length,
        0
      );

      return {
        success: true,
        data: {
          totalRoles: roles.length,
          rolesActivos: roles.filter(r => r.estado).length,
          rolesInactivos: roles.filter(r => !r.estado).length,
          totalAcciones: totalAcciones,
          accionesActivas: accionesActivas,
          accionesInactivas: totalAcciones - accionesActivas,
          rolesConAcciones: rolesWithActions
        }
      };

    } catch (error) {
      console.error('Error al obtener estadisticas de roles:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener estadísticas'
      };
    }
  }

  /**
   * Verificar si un rol tiene una acción específica
   */
  async hasPermission(roleId, actionName) {
    try {
      const result = await this.getRoleActions(roleId);
      
      if (!result.success) {
        return false;
      }

      const actions = result.data;
      return actions.some(
        action => action.nombre_accion === actionName && action.activo
      );

    } catch (error) {
      console.error('Error al verificar permiso del rol:', error);
      return false;
    }
  }

  /**
   * Limpiar caché de roles
   */
  clearRolesCache() {
    this.cachedRoles = null;
  }
}

const rolesService = new RolesService();

export default rolesService;
export { RolesService };
