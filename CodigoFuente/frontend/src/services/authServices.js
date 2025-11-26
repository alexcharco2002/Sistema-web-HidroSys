/**
 * Servicio de Autenticación con Sistema de Roles y Permisos
 */
// authServices.js
import axios from "axios";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
});

// Interceptor general
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response && error.response.status === 401) {
      // Emitimos evento global
      window.dispatchEvent(new Event("sessionExpired"));
    }
    return Promise.reject(error);
  }
);

const API_CONFIG = {
  baseURL: process.env.REACT_APP_API_URL || 'https://localhost:8000',
  timeout: 10000,
  endpoints: {
    login: '/login',
    logout: '/logout',
    verifySession: '/verify-session',
    profile: '/profile',
    checkPermission: '/check-permission',
    changePassword: '/change-password',
    healthCheck: '/health',
    forgotPassword: '/forgot-password',
    verifyCode: '/verify-code',
    resetPassword: '/reset-password',
    resendCode: '/resend-code'
  }
};

class AuthService {
  constructor() {
    this.token = this.getStoredToken();
    this.user = this.getStoredUser();
    this.permissions = this.getStoredPermissions();
  }

  /**
   * Obtener token almacenado
   */
  getStoredToken() {
    try {
      return sessionStorage.getItem('auth_token') || null;
    } catch {
      return null;
    }
  }

  /**
   * Obtener usuario almacenado
   */
  getStoredUser() {
    try {
      const userData = sessionStorage.getItem('user_data');
      if (!userData || userData === 'undefined') {
        return null;
      }
      return JSON.parse(userData);
    } catch {
      return null;
    }
  }

  /**
   * Obtener permisos almacenados
   */
  getStoredPermissions() {
    try {
      const permsData = sessionStorage.getItem('user_permissions');
      if (!permsData || permsData === 'undefined') {
        return [];
      }
      return JSON.parse(permsData);
    } catch {
      return [];
    }
  }

  /**
   * Realizar petición HTTP
   */
  async makeRequest(endpoint, options = {}) {
    const url = `${API_CONFIG.baseURL}${endpoint}`;
    
    const defaultOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: API_CONFIG.timeout,
      mode: 'cors',
      credentials: 'include'
    };

    if (this.token && !options.skipAuth) {
      defaultOptions.headers['Authorization'] = `Bearer ${this.token}`;
    }

    const finalOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers,
      },
    };

    try {
      console.log(`🔒 Request: ${finalOptions.method} ${url}`);
      
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

          // -------------------------
          // 🔥 Control automático de token expirado
          // -------------------------
          if (response.status === 401) {
              console.warn("⚠️ Token expirado o inválido, cerrando sesión…");

              // Limpiar datos
              this.clearLocalData();

              // Emitir evento global para cualquier listener
              window.dispatchEvent(new Event("sessionExpired"));

              // Detener aquí
              return Promise.reject(new Error("Sesión expirada"));
          }
          // -------------------------

          if (typeof errorData.detail === 'string') {
              errorMessage = errorData.detail;
          } else if (typeof errorData.detail === 'object') {
              errorMessage = JSON.stringify(errorData.detail);
          } else {
              errorMessage = `HTTPS ${response.status}: ${response.statusText}`;
          }

          throw new Error(errorMessage);
      }


      const data = await response.json();
      return data;

    } catch (error) {
      console.error(`❌ Error:`, error);
      
      if (error.name === 'AbortError') {
        throw new Error('La petición tardó demasiado tiempo');
      }
      
      if (error.message.includes('Failed to fetch')) {
        throw new Error('No se pudo conectar con el servidor.');
      }

      throw error;
    }
  }

  /**
   * Iniciar sesión
   */
  async login(credentials) {
    try {
      this.validateLoginCredentials(credentials);

      const response = await this.makeRequest(API_CONFIG.endpoints.login, {
        method: 'POST',
        body: JSON.stringify({
          username: credentials.username.trim(),
          password: credentials.password.trim()
        }),
        skipAuth: true,
      });
      
      if (response.success) {
        this.user = response.data.user;
        this.token = response.data.token;
        this.permissions = response.data.user.permisos || [];

        // Almacenar en sessionStorage
        sessionStorage.setItem('auth_token', this.token);
        sessionStorage.setItem('user_data', JSON.stringify(this.user));
        sessionStorage.setItem('user_permissions', JSON.stringify(this.permissions));
        sessionStorage.setItem('login_time', new Date().toISOString());

        console.log('✅ Login exitoso:', {
          user: this.user.nombre_completo,
          rol: this.user.rol?.nombre_rol || 'Sin rol',
          permisos: this.permissions.length
        });
        
        return {
          success: true,
          data: {
            user: this.user,
            token: this.token,
            permissions: this.permissions
          }
        };
      } else {
        return {
          success: false,
          message: response.message || 'Credenciales inválidas'
        };
      }

    } catch (error) {
      console.error('❌ Error en login:', error);
      return {
        success: false,
        message: error.message || 'Error de conexión'
      };
    }
  }

/**
 * Verificar si el usuario tiene un permiso específico
 * @param {string} moduleName - Nombre del módulo (ej: 'usuarios', 'lecturas')
 * @param {string} actionType - Tipo de acción (ej: 'lectura', 'crear', 'eliminar')
 */
hasPermission(moduleName, actionType = null) {
  if (!this.permissions || this.permissions.length === 0) {
    console.warn('⚠️ No hay permisos cargados');
    return false;
  }

  // Normalizar los parámetros
  moduleName = moduleName.toLowerCase();
  const requestedAction = actionType ? actionType.toLowerCase() : null;

  // Recorremos los permisos del usuario
  const hasAccess = this.permissions.some(perm => {
    if (!perm.nombre_accion || !perm.tipo_accion) return false;

    const permModule = perm.nombre_accion.toLowerCase();
    const permAction = perm.tipo_accion.toLowerCase();

    // ✅ Si coincide el módulo y no se especifica una acción, ya tiene acceso
    if (permModule === moduleName && !requestedAction) {
      return true;
    }

    // ✅ Si el permiso es CRUD, tiene todas las acciones básicas
    if (permModule === moduleName && permAction === 'operaciones crud') {
      const basicActions = [
        'lectura',
        'escritura',
        'eliminacion',
        'administracion',
        'reportes',
        'configuracion',
        'crear',
        'editar',
        'actualizar',
        'borrar',
        'eliminar'
      ];
      return basicActions.includes(requestedAction);
    }

    // ✅ Coincidencia exacta de módulo + tipo de acción
    if (permModule === moduleName && permAction === requestedAction) {
      return true;
    }

    return false;
  });

  console.log(`🔐 Verificando permiso: ${moduleName}${actionType ? '.' + actionType : '.*'} = ${hasAccess}`);
  return hasAccess;
}


/**
 * Verificar acción específica en un módulo
 */
canPerformAction(moduleName, actionType) {
  return this.hasPermission(moduleName, actionType);
}

/**
 * Obtener acciones disponibles para un módulo específico
 */
getModuleActions(moduleName) {
  if (!this.permissions || this.permissions.length === 0) {
    return [];
  }

  moduleName = moduleName.toLowerCase();
  const actions = [];

  this.permissions.forEach(perm => {
    if (!perm.nombre_accion) return;

    const [permModule, permAction] = perm.nombre_accion.split('.');
    
    if (permModule.toLowerCase() === moduleName) {
      if (permAction.toLowerCase() === 'crud') {
        // Si tiene CRUD, agregar todas las acciones básicas
        actions.push('crear', 'leer', 'actualizar', 'eliminar');
      } else {
        actions.push(permAction.toLowerCase());
      }
    }
  });

  // Retornar acciones únicas
  return [...new Set(actions)];
}

/**
 * Verificar si tiene permiso CRUD completo sobre un módulo
 */
hasCRUDAccess(moduleName) {
  if (!this.permissions || this.permissions.length === 0) {
    return false;
  }

  moduleName = moduleName.toLowerCase();
  
  return this.permissions.some(perm => {
    if (!perm.nombre_accion) return false;
    const [permModule, permAction] = perm.nombre_accion.split('.');
    return permModule.toLowerCase() === moduleName && 
           permAction.toLowerCase() === 'crud';
  });
}

  /**
   * Verificar si puede acceder a un módulo (cualquier acción)
   */
  canAccessModule(moduleName) {
    return this.hasPermission(moduleName);
  }

  /**
   * Obtener todos los permisos del usuario
   */
  getUserPermissions() {
    return this.permissions;
  }

  /**
   * Verificar si el usuario tiene un rol específico
   */
  hasRole(roleName) {
    if (!this.user || !this.user.rol) {
      return false;
    }
    
    const userRole = this.user.rol.nombre_rol || '';
    return userRole.toLowerCase() === roleName.toLowerCase();
  }

  /**
   * Verificar si es administrador
   */
  isAdmin() {
    return this.hasRole('administrador');
  }

  /**
   * Obtener módulos accesibles para el usuario
   */
  getAccessibleModules() {
    if (!this.permissions || this.permissions.length === 0) {
      return [];
    }

    // Extraer módulos únicos de los permisos
    const modules = new Set();
    this.permissions.forEach(perm => {
      const [module] = perm.nombre_accion.split('.');
      modules.add(module);
    });

    return Array.from(modules);
  }

  /**
   * Verificar permiso en el servidor (opcional, para seguridad adicional)
   */
  async checkPermissionOnServer(nombreAccion, tipoAccion) {
    try {
      const response = await this.makeRequest(API_CONFIG.endpoints.checkPermission, {
        method: 'POST',
        body: JSON.stringify({
          nombre_accion: nombreAccion,
          tipo_accion: tipoAccion
        })
      });

      return response.has_permission || false;
    } catch (error) {
      console.error('Error verificando permiso en servidor:', error);
      return false;
    }
  }

  /**
   * Cerrar sesión
   */
  async logout() {
    try {
      if (this.token) {
        await this.makeRequest(API_CONFIG.endpoints.logout, {
          method: 'POST',
        });
      }

      this.clearLocalData();
      console.log('✅ Logout exitoso');
      return { success: true, message: 'Sesión cerrada correctamente' };

    } catch (error) {
      console.error('❌ Error en logout:', error);
      this.clearLocalData();
      return { success: true, message: 'Sesión cerrada (con errores)' };
    }
  }

  /**
   * Verificar sesión
   */
  async verifySession() {
    if (!this.token) {
      return { success: false, message: 'No hay token de sesión' };
    }

    try {
      const response = await this.makeRequest(API_CONFIG.endpoints.verifySession);
      
      if (response && !response.detail) {
        this.user = response;
        this.permissions = response.permisos || [];
        
        sessionStorage.setItem('user_data', JSON.stringify(this.user));
        sessionStorage.setItem('user_permissions', JSON.stringify(this.permissions));
        
        return { success: true, user: this.user };
      } else {
        this.clearLocalData();
        return { success: false, message: 'Sesión expirada' };
      }

    } catch (error) {
      console.error('❌ Error verificando sesión:', error);
      this.clearLocalData();
      return { success: false, message: 'Error verificando sesión' };
    }
  }

  /**
   * Limpiar datos locales
   */
  clearLocalData() {
    this.token = null;
    this.user = null;
    this.permissions = [];
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('user_data');
    sessionStorage.removeItem('user_permissions');
    sessionStorage.removeItem('login_time');
  }

  /**
   * Verificar autenticación
   */
  isAuthenticated() {
    return !!(this.token && this.user);
  }

  /**
   * Obtener usuario actual
   */
  getCurrentUser() {
    return this.user;
  }

  /**
   * Obtener token
   */
  getToken() {
    return this.token;
  }
   /**
   * ✅ Actualizar información del usuario en localStorage
   * Este método se usa cuando el usuario actualiza su perfil
   */
  updateUserInfo(updatedUserData) {
    try {
      const currentUser = this.getCurrentUser();
      
      if (!currentUser) {
        console.warn('⚠️ No hay usuario en sesión para actualizar');
        return false;
      }

      // Combinar datos existentes con los nuevos
      const updatedUser = {
        ...currentUser,
        ...updatedUserData
      };

      // Guardar en localStorage
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      console.log('✅ Información del usuario actualizada en localStorage');
      
      return true;
    } catch (error) {
      console.error('❌ Error actualizando información del usuario:', error);
      return false;
    }
  }
  /**
   * Validar credenciales
   */
  validateLoginCredentials(credentials) {
    if (!credentials.username || !credentials.password) {
      throw new Error('Usuario y contraseña son requeridos');
    }

    if (credentials.username.length < 3) {
      throw new Error('El usuario debe tener al menos 3 caracteres');
    }

    if (credentials.password.length < 4) {
      throw new Error('La contraseña debe tener al menos 4 caracteres');
    }
  }

  // Métodos de recuperación de contraseña (mantener los existentes)
  async forgotPassword(email) {
    try {
      if (!email || !email.trim()) {
        throw new Error('El correo electrónico es requerido');
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Formato de correo electrónico inválido');
      }

      const response = await this.makeRequest(API_CONFIG.endpoints.forgotPassword, {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
        skipAuth: true,
      });

      return response;
    } catch (error) {
      console.error('❌ Error en forgotPassword:', error);
      return {
        success: false,
        message: error.message || 'Error al solicitar recuperación de contraseña'
      };
    }
  }

  async verifyRecoveryCode(email, code) {
    try {
      if (!email || !code) {
        throw new Error('Email y código son requeridos');
      }

      const response = await this.makeRequest(API_CONFIG.endpoints.verifyCode, {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: code.trim()
        }),
        skipAuth: true,
      });

      return response;
    } catch (error) {
      console.error('❌ Error en verifyRecoveryCode:', error);
      return {
        success: false,
        message: error.message || 'Error al verificar el código'
      };
    }
  }

  async resetPassword(email, resetToken, newPassword) {
    try {
      if (!email || !resetToken || !newPassword) {
        throw new Error('Todos los campos son requeridos');
      }

      const response = await this.makeRequest(API_CONFIG.endpoints.resetPassword, {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          reset_token: resetToken,
          new_password: newPassword
        }),
        skipAuth: true,
      });

      return response;
    } catch (error) {
      console.error('❌ Error en resetPassword:', error);
      return {
        success: false,
        message: error.message || 'Error al restablecer la contraseña'
      };
    }
  }

  async resendCode(email) {
    try {
      if (!email || !email.trim()) {
        throw new Error('El correo electrónico es requerido');
      }

      const response = await this.makeRequest(API_CONFIG.endpoints.resendCode, {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
        skipAuth: true,
      });

      return response;
    } catch (error) {
      console.error('❌ Error en resendCode:', error);
      return {
        success: false,
        message: error.message || 'Error al reenviar el código'
      };
    }
  }
}

const authService = new AuthService();

export default authService;
export { AuthService };