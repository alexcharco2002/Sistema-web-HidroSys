/**
 * src/services/userServices.js
 * Servicio de Gestión de Usuarios
 */

import authService from './authServices';

import * as XLSX from "xlsx";

const API_CONFIG = {
baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
  endpoints: {
    users: '/users',
    roles: '/roles',
    toggleStatus: (id) => `/users/${id}/toggle-status`,
    changePassword: (id) => `/users/${id}/change-password`,
    uploadPhoto: (id) => `/users/${id}/upload-photo`,
    changePasswordFirstLogin: (userId) => `/users/${userId}/change-password-first-login`,
    miPerfil: '/users/mi-perfil',
  }
};

class UsersService {
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

    // ✅ CORRECCIÓN: Solo manejar FormData aquí
    if (finalOptions.body instanceof FormData) {
      delete finalOptions.headers['Content-Type'];
    } else if (finalOptions.body && typeof finalOptions.body === 'object') {
      // ✅ Si es un objeto normal, agregar Content-Type y convertir a JSON
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
          // Manejar errores de validación de Pydantic
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
   * Obtener perfil del usuario autenticado
   */
  async getMiPerfil() {
    try {
      const data = await this.makeRequest(API_CONFIG.endpoints.miPerfil);
      return { success: true, data };
    } catch (error) {
      console.error('Error obteniendo mi perfil:', error);
      return { success: false, data: null };
    }
  }

  /**
   * Obtener lista de roles disponibles desde t_roles
   */
  async getRoles() {
    try {
      if (this.cachedRoles) {
        return {
          success: true,
          data: this.cachedRoles
        };
      }

      const data = await this.makeRequest(API_CONFIG.endpoints.roles);
      this.cachedRoles = data;

      return {
        success: true,
        data: data
      };

    } catch (error) {
      console.error('❌ Error obteniendo roles:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener roles',
        data: []
      };
    }
  }

  /**
   * Obtener lista de usuarios
   */
  async getUsers(filters = {}) {
    try {
      const params = new URLSearchParams();
      
      if (filters.search) params.append('search', filters.search);
      if (filters.id_rol && filters.id_rol !== 'all') params.append('id_rol', filters.id_rol);
      if (filters.activo !== undefined) params.append('activo', filters.activo);
      if (filters.skip) params.append('skip', filters.skip);
      if (filters.limit) params.append('limit', filters.limit);

      const queryString = params.toString();
      const endpoint = queryString 
        ? `${API_CONFIG.endpoints.users}?${queryString}` 
        : API_CONFIG.endpoints.users;

      const data = await this.makeRequest(endpoint);

      return {
        success: true,
        data: data
      };

    } catch (error) {
      console.error('❌ Error obteniendo usuarios:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener usuarios'
      };
    }
  }

  /**
   * Obtener un usuario por ID
   */
  async getUserById(userId) {
    try {
      const data = await this.makeRequest(`${API_CONFIG.endpoints.users}/${userId}`);

      return {
        success: true,
        data: data
      };

    } catch (error) {
      console.error('❌ Error obteniendo usuario:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener usuario'
      };
    }
  }

  /**
   * ✅ Crear un nuevo usuario 
   */
  async createUser(userData) {
    try {
      this.validateUserData(userData, true);

      // ✅ NO usar JSON.stringify aquí, makeRequest lo hace
      const data = await this.makeRequest(API_CONFIG.endpoints.users, {
        method: 'POST',
        body: {
          nombres: userData.nombres.trim(),
          apellidos: userData.apellidos.trim(),
          sexo: userData.sexo || 'O',
          fecha_nac: userData.fecha_nac || null,
          cedula: userData.cedula.trim(),
          email: userData.email.trim().toLowerCase(),
          telefono: userData.telefono?.trim() || null,
          direccion: userData.direccion?.trim() || 'Sanjapamba',
          id_rol: userData.id_rol,
          activo: userData.activo !== undefined ? userData.activo : true
        }
      });

      return {
        success: true,
        data: data,
        message: 'Usuario creado exitosamente'
      };

    } catch (error) {
      console.error('❌ Error creando usuario:', error);
      return {
        success: false,
        message: error.message || 'Error al crear usuario'
      };
    }
  }

  /**
 * ✅ Crear múltiples usuarios desde Excel
 */
  async createManyUsers(usersArray) {
    try {
      // Validar que sea un array
      if (!Array.isArray(usersArray) || usersArray.length === 0) {
        return {
          success: false,
          message: 'Debe proporcionar un array de usuarios válido'
        };
      }

      // ✅ Validar máximo 500 usuarios
      if (usersArray.length > 500) {
        return {
          success: false,
          message: 'Máximo 500 usuarios por carga. Actualmente: ' + usersArray.length
        };
      }

      // Validar estructura básica de cada usuario
      const usuariosValidados = usersArray.map((user, index) => {
        // Validaciones mínimas (ya filtradas en frontend)
        if (!user.nombres || !user.apellidos || !user.cedula || !user.email) {
          throw new Error(`Fila ${index + 1}: Faltan campos obligatorios (nombres, apellidos, cedula, email)`);
        }

        return {
          nombres: String(user.nombres).trim(),
          apellidos: String(user.apellidos).trim(),
          sexo: user.sexo ? String(user.sexo).trim().toUpperCase() : 'O',
          fecha_nac: user.fecha_nac || null,
          cedula: String(user.cedula).trim(),
          email: String(user.email).trim().toLowerCase(),
          telefono: user.telefono ? String(user.telefono).trim() : null,
          direccion: user.direccion ? String(user.direccion).trim() : 'Sanjapamba'
        };
      });

      console.log('📤 Enviando usuarios al backend:', usuariosValidados.length);

      // Enviar al endpoint bulk
      const data = await this.makeRequest(`${API_CONFIG.endpoints.users}/bulk`, {
        method: 'POST',
        body: {
          users: usuariosValidados
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
        message: error.message || 'Error al crear usuarios masivamente'
      };
    }
  }


  /**
   * ✅ Actualizar un usuario existente - CORREGIDO
   */
  async updateUser(userId, userData) {
    if (!userId || isNaN(userId)) {
      throw new Error('ID de usuario inválido o no definido');
    }

    try {
      this.validateUserData(userData, false);

      // Filtrar solo los campos que se van a actualizar
      const updateData = {};
      
      if (userData.usuario) updateData.usuario = userData.usuario.trim().toLowerCase();
      if (userData.nombres) updateData.nombres = userData.nombres.trim();
      if (userData.apellidos) updateData.apellidos = userData.apellidos.trim();
      if (userData.sexo) updateData.sexo = userData.sexo.toUpperCase();
      if (userData.fecha_nac) updateData.fecha_nac = userData.fecha_nac;
      if (userData.cedula) updateData.cedula = userData.cedula.trim();
      if (userData.email) updateData.email = userData.email.trim().toLowerCase();
      if (userData.telefono !== undefined) updateData.telefono = userData.telefono?.trim() || null;
      if (userData.direccion !== undefined) updateData.direccion = userData.direccion?.trim() || null;
      if (userData.id_rol) updateData.id_rol = userData.id_rol;
      if (userData.activo !== undefined) updateData.activo = userData.activo;

      // ✅ NO usar JSON.stringify aquí, makeRequest lo hace
      const data = await this.makeRequest(`${API_CONFIG.endpoints.users}/${userId}`, {
        method: 'PUT',
        body: updateData,
      });

      return {
        success: true,
        data: data,
        message: 'Usuario actualizado exitosamente'
      };

    } catch (error) {
      console.error('❌ Error actualizando usuario:', error);
      return {
        success: false,
        message: error.message || 'Error al actualizar usuario'
      };
    }
  }

  /**
 * Eliminar un usuario
 */
  async deleteUser(userId) {
    try {
      const data = await this.makeRequest(`${API_CONFIG.endpoints.users}/${userId}`, {
        method: 'DELETE'
      });

      // === CASO 1: Eliminado correctamente ===
      if (data?.accion === 'eliminado') {
        return {
          success: true,
          message: `✅ El usuario fue eliminado correctamente.`,
          data
        };
      }

      // === CASO 2: No se pudo eliminar porque tiene relaciones ===
      if (data?.accion === 'no_eliminado') {
        return {
          success: false, // OJO → FALSE porque no se eliminó
          message: `⚠️ ${data.message || 'El usuario no se puede eliminar porque tiene relaciones con otros módulos.'}`,
          data
        };
      }

      // === CASO 3: Respuesta exitosa sin "accion" (muy raro pero posible) ===
      if (data?.success === true) {
        return {
          success: true,
          message: data.message || 'Operación completada correctamente.',
          data
        };
      }

      // === CASO 4: Error explícito del backend ===
      if (data?.detail) {
        return {
          success: false,
          message: data.detail
        };
      }

      // === CASO 5: Respuesta inesperada ===
      return {
        success: false,
        message: 'No se pudo completar la operación.'
      };

    } catch (error) {
      console.error('❌ Error eliminando usuario:', error);

      return {
        success: false,
        message: error.message || 'Error al eliminar usuario'
      };
    }
  }


  /**
   * Activar/Desactivar usuario
   */
  async toggleUserStatus(userId) {
    try {
      const data = await this.makeRequest(API_CONFIG.endpoints.toggleStatus(userId), {
        method: 'PATCH'
      });

      return {
        success: true,
        data: data,
        message: 'Estado del usuario actualizado'
      };

    } catch (error) {
      console.error('❌ Error cambiando estado:', error);
      return {
        success: false,
        message: error.message || 'Error al cambiar estado del usuario'
      };
    }
  }

  /**
   * Cambiar contraseña de usuario
   */
  async changeUserPassword(userId, passwords) {
    try {
      if (!passwords.currentPassword && authService.getCurrentUser()?.rol !== 'Administrador') {
        throw new Error('Contraseña actual es requerida');
      }

      if (!passwords.newPassword) {
        throw new Error('Nueva contraseña es requerida');
      }

      if (passwords.newPassword.length < 8) {
        throw new Error('La nueva contraseña debe tener al menos 8 caracteres');
      }

      // ✅ NO usar JSON.stringify aquí
      const data = await this.makeRequest(API_CONFIG.endpoints.changePassword(userId), {
        method: 'PUT',
        body: {
          current_password: passwords.currentPassword || '',
          new_password: passwords.newPassword
        }
      });

      return {
        success: true,
        data: data,
        message: 'Contraseña actualizada exitosamente'
      };

    } catch (error) {
      console.error('❌ Error cambiando contraseña:', error);
      return {
        success: false,
        message: error.message || 'Error al cambiar contraseña'
      };
    }
  }
  /**
 * Cambiar contraseña en primer inicio 
 */
  async changePasswordFirstLogin(userId, newPassword ) {
    try {
      if (!newPassword) {
        throw new Error('Nueva contraseña es requerida');
      }

      if (newPassword.length < 8) {
        throw new Error('La nueva contraseña debe tener al menos 8 caracteres');
      }

      const data = await this.makeRequest(API_CONFIG.endpoints.changePasswordFirstLogin(userId), {
        method: 'PUT',
       
        body: { 
          new_password: newPassword 
        }
      });

      return {
        success: true,
        data: data,
        message: 'Contraseña actualizada exitosamente (primer login)'
      };

    } catch (error) {
      console.error('❌ Error cambiando contraseña (primer login):', error);
      return {
        success: false,
        message: error.message || 'Error al cambiar contraseña en primer login'
      };
    }
  }


  /**
   * ✅ Subir foto de perfil - CORREGIDO
   */
  async uploadUserPhoto(userId, file) {
    try {
      if (!file) {
        throw new Error('Debe seleccionar un archivo');
      }

      if (!file.type.startsWith('image/')) {
        throw new Error('El archivo debe ser una imagen');
      }

      if (file.size > 2 * 1024 * 1024) {
        throw new Error('La imagen no debe superar los 2MB');
      }

      const formData = new FormData();
      formData.append('file', file);

      // ✅ makeRequest detectará automáticamente el FormData
      const data = await this.makeRequest(API_CONFIG.endpoints.uploadPhoto(userId), {
        method: 'POST',
        body: formData
      });

      return {
        success: true,
        data: data,
        message: 'Foto actualizada exitosamente'
      };

    } catch (error) {
      console.error('❌ Error subiendo foto:', error);
      return {
        success: false,
        message: error.message || 'Error al subir foto'
      };
    }
  }

  /**
   * Validar datos de usuario
   */
  validateUserData(userData, required = true) {
    if (required) {
      if (!userData.nombres || userData.nombres.trim().length < 2) {
        throw new Error('El nombre debe tener al menos 2 caracteres');
      }

      if (!userData.apellidos || userData.apellidos.trim().length < 2) {
        throw new Error('Los apellidos deben tener al menos 2 caracteres');
      }

      if (!userData.sexo || !['M', 'F', 'O'].includes(userData.sexo.toUpperCase())) {
        throw new Error('Debe seleccionar un sexo válido (M, F u O)');
      }

      if (!userData.fecha_nac) {
        throw new Error('Debe proporcionar una fecha de nacimiento');
      }

      if (!userData.cedula || userData.cedula.trim().length < 8) {
        throw new Error('La cédula debe tener al menos 8 caracteres');
      }

      if (!userData.email || !this.isValidEmail(userData.email)) {
        throw new Error('Debe proporcionar un Correo Electrónico válido');
      }

      if (!userData.id_rol || typeof userData.id_rol !== 'number') {
        throw new Error('Debe seleccionar un rol válido');
      }

    } else {
      if (userData.usuario && userData.usuario.trim().length < 3) {
        throw new Error('El usuario debe tener al menos 3 caracteres');
      }

      if (userData.email && !this.isValidEmail(userData.email)) {
        throw new Error('Debe proporcionar un Correo Electrónico válido');
      }

      if (userData.sexo && !['M', 'F', 'O'].includes(userData.sexo.toUpperCase())) {
        throw new Error('El sexo debe ser M, F u O');
      }

      if (userData.fecha_nac) {
        const fechaNac = new Date(userData.fecha_nac);
        const hoy = new Date();
        if (fechaNac > hoy) {
          throw new Error('La fecha de nacimiento no puede ser mayor a la fecha actual');
        }
      }

      if (userData.id_rol && typeof userData.id_rol !== 'number') {
        throw new Error('El ID del rol debe ser un número válido');
      }
    }
  }

  /**
   * Validar formato de email
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Obtener estadísticas de usuarios
   */
  async getUserStats() {
    try {
      const result = await this.getUsers();
      
      if (!result.success) {
        return result;
      }

      const users = result.data;

      return {
        success: true,
        data: {
          total: users.length,
          activos: users.filter(u => u.activo).length,
          inactivos: users.filter(u => !u.activo).length,
          porRol: users.reduce((acc, user) => {
            const rolName = user.rol?.nombre_rol || 'sin_rol';
            acc[rolName] = (acc[rolName] || 0) + 1;
            return acc;
          }, {})
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
   * Actualizar usuario actual en sessionStorage
   */
  updateCurrentUser(userData) {
    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        return { success: false, message: 'No hay usuario autenticado' };
      }

      const updatedUser = {
        ...currentUser,
        ...userData
      };

      sessionStorage.setItem('user_data', JSON.stringify(updatedUser));

      console.log('✅ Usuario actualizado en sessionStorage');
      
      return { success: true, data: updatedUser };
    } catch (error) {
      console.error('❌ Error actualizando usuario:', error);
      return { success: false, message: error.message };
    }
  }

  /**
 * Desbloquear usuario y resetear intentos fallidos
 */
async unlockUser(userId) {
  try {
    const data = await this.makeRequest(`${API_CONFIG.endpoints.users}/${userId}/unlock`, {
      method: 'POST'
    });
    
    return {
      success: true,
      data: data,
      message: data.message || 'Usuario desbloqueado exitosamente'
    };
  } catch (error) {
    console.error('❌ Error desbloqueando usuario:', error);
    return {
      success: false,
      message: error.message || 'Error al desbloquear usuario'
    };
  }
}

/**
 * Obtener estado de bloqueo de un usuario
 */
async getUserLockStatus(userId) {
  try {
    const data = await this.makeRequest(`${API_CONFIG.endpoints.users}/${userId}/lock-status`, {
      method: 'GET'
    });
    
    return {
      success: true,
      data: data.data
    };
  } catch (error) {
    console.error('❌ Error obteniendo estado de bloqueo:', error);
    return {
      success: false,
      message: error.message || 'Error al obtener estado de bloqueo'
    };
  }
}

/**
 * Listar todos los usuarios bloqueados (solo admin)
 */
async getBlockedUsers() {
  try {
    const data = await this.makeRequest(`${API_CONFIG.endpoints.users}/admin/blocked-users`, {
      method: 'GET'
    });
    
    return {
      success: true,
      data: data.data
    };
  } catch (error) {
    console.error('❌ Error obteniendo usuarios bloqueados:', error);
    return {
      success: false,
      message: error.message || 'Error al obtener usuarios bloqueados'
    };
  }
}


  /**
   * Limpiar caché de roles
   */
  clearRolesCache() {
    this.cachedRoles = null;
  }
    /**
   * ===============================
   * 📄 CLASE INTERNA: Plantilla Excel
   * ===============================
   */
  ExcelTemplate = class {

    /**
     * Generar plantilla Excel para carga masiva
     */
    static generateTemplate() {
      try {
        const headers = [
          "nombres",
          "apellidos",
          "sexo",
          "fecha_nac",
          "cedula",
          "email",
          "telefono",
          "direccion"
        ];

        const exampleRow = [{
          nombres: "",
          apellidos: "",
          sexo: "M / F / O",
          fecha_nac: "YYYY-MM-DD",
          cedula: "",
          email: "",
          telefono: "",
          direccion: ""
        }];

        const worksheet = XLSX.utils.json_to_sheet(exampleRow, {
          header: headers
        });

        // Ancho de columnas
        worksheet["!cols"] = headers.map(() => ({ wch: 20 }));

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Plantilla");

        XLSX.writeFile(workbook, "plantilla_usuarios.xlsx");

        return {
          success: true,
          message: "Plantilla generada correctamente"
        };

      } catch (error) {
        console.error("❌ Error generando plantilla Excel:", error);
        return {
          success: false,
          message: error.message || "Error al generar plantilla"
        };
      }
    }
  };

}

const usersService = new UsersService();

export default usersService;
export { UsersService };