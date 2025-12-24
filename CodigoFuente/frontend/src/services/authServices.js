/**
 * Servicio de Autenticación con Sistema de Roles y Permisos
 * Maneja login, logout, verificación de sesión
 * services/authServices.js
 */

import axios from "axios";

// ========================================
// CONFIGURACIÓN DE AXIOS 
// ========================================
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
});

// ✅ Interceptor simplificado de axios (opcional, solo si usas axios)
// authServices.js - MODIFICAR interceptor de axios (línea ~15)

// authServices.js (o donde configuras axios)

api.interceptors.response.use(
    response => response,
    error => {
        if (error.response && error.response.status === 401) {
            console.warn("⚠️ 401 detectado - Sesión inválida");

            // Verificar si el backend forzó el cierre de sesión
            const forceLogout = error.response.headers['x-force-logout'];

            if (forceLogout) {
                // Limpiar datos locales
                authService.clearLocalData();

                // Avisar al usuario
                alert('Tu sesión ha sido cerrada porque iniciaste sesión en otro dispositivo');

                // Redirigir al login
                window.location.href = '/login';
            }
        }

        return Promise.reject(error);
    }
);



// ========================================
// CONFIGURACIÓN DE API
// ========================================
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
    resendCode: '/resend-code',
    // API_CONFIG.endpoints
    verifyOtp: '/verify-otp',
    resendOtpOtp: '/resend-otp',

  }
};

// ========================================
// CLASE PRINCIPAL
// ========================================
class AuthService {
  constructor() {
    this.token = this.getStoredToken();
    this.sessionToken = this.getStoredSessionToken(); 
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
  getStoredSessionToken() {
      try {
          return sessionStorage.getItem('session_token') || null;
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
   * ✅ Realizar petición HTTP - SIMPLIFICADO
   * El fetchInterceptor global maneja los 401 automáticamente
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

    // ✅ NUEVO: Incluir session_token si existe
    if (this.sessionToken && !options.skipAuth) {
        defaultOptions.headers['X-Session-Token'] = this.sessionToken;
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

      // ✅ Manejo simplificado - fetchInterceptor maneja 401 globalmente
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

  // ========================================
  // 🔥 MÉTODOS DE ROLES Y RUTAS DINÁMICAS
  // ========================================

  /**
   * Obtener la ruta completa del dashboard con /home
   */
  getRoleBasedRoute() {
    const basePath = this.getRoleBasePath();
    return `${basePath}/home`;
  }

  /**
   * Convertir nombre de rol a ruta válida
   * Ej: "Super Administrador" -> "super-administrador"
   */
  normalizeRoleToRoute(roleName) {
    if (!roleName) return 'dashboard';
    return roleName
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Obtener la ruta del dashboard según el rol del usuario (DINÁMICO)
   */
  getRoleBasePath() {
    if (!this.user || !this.user.rol) {
      console.warn('⚠️ Usuario sin rol definido');
      return '/dashboard';
    }

    const roleName = this.user.rol.nombre_rol;
    if (!roleName) {
      return '/dashboard';
    }

    const routePath = this.normalizeRoleToRoute(roleName);
    return `/${routePath}`;
  }

  /**
   * Obtener información del rol actual
   */
  getCurrentRole() {
    if (!this.user || !this.user.rol) {
      return null;
    }

    return {
      id: this.user.rol.id_rol,
      nombre: this.user.rol.nombre_rol,
      ruta: this.getRoleBasedRoute(),
      rutaNormalizada: this.normalizeRoleToRoute(this.user.rol.nombre_rol)
    };
  }

  /**
   * Verificar si el usuario puede acceder a una ruta específica
   */
  canAccessRoute(route) {
    if (!this.user || !this.user.rol) {
      return false;
    }

    const cleanRoute = route.startsWith('/') ? route.slice(1) : route;
    const allowedRoute = this.getRoleBasedRoute().slice(1);
    const currentRole = this.user.rol.nombre_rol?.toLowerCase() || '';

    const publicRoutes = ['dashboard', 'perfil', 'configuracion'];
    if (publicRoutes.includes(cleanRoute)) {
      return true;
    }

    if (currentRole === 'administrador' || currentRole === 'admin') {
      return true;
    }

    return cleanRoute === allowedRoute;
  }

  /**
   * Verificar si dos roles son equivalentes
   */
  rolesMatch(role1, role2) {
    if (!role1 || !role2) return false;
    const normalized1 = this.normalizeRoleToRoute(role1);
    const normalized2 = this.normalizeRoleToRoute(role2);
    return normalized1 === normalized2;
  }

  // ========================================
  // 🔐 AUTENTICACIÓN
  // ========================================

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

      // Nuevo: flujo 2FA
      if (response.success && response.requires_otp) {
        const pending = {
          email: response.email,
          username: credentials.username.trim(),
          expiresAt: Date.now() + (response.expires_in_minutes || 5) * 60 * 1000
        };
        sessionStorage.setItem('pending_otp', JSON.stringify(pending));
        return {
          success: true,
          requiresOtp: true,
          email: response.email,
          expiresInMinutes: response.expires_in_minutes || 5
        };
      }

      // Flujo legacy (sin 2FA)
      if (response.success) {
        this.user = response.data.user;
        this.token = response.data.token;
        this.permissions = response.data.user.permisos || [];
        sessionStorage.setItem('auth_token', this.token);
        sessionStorage.setItem('user_data', JSON.stringify(this.user));
        sessionStorage.setItem('user_permissions', JSON.stringify(this.permissions));
        sessionStorage.setItem('login_time', new Date().toISOString());
        const redirectRoute = this.getRoleBasedRoute();
        return { success: true, redirectTo: redirectRoute, data: { user: this.user, token: this.token, permissions: this.permissions } };
      }

      return { success: false, message: response.message || 'Credenciales inválidas' };
    } catch (error) {
      return { success: false, message: error.message || 'Error de conexión' };
    }
  }

  getPendingOtp() {
  try { return JSON.parse(sessionStorage.getItem('pending_otp') || 'null'); } catch { return null; }
}
clearPendingOtp() { sessionStorage.removeItem('pending_otp'); }

// authServices.js - MODIFICAR método verifyOtp (línea ~120)

async verifyOtp(email, code) {
    const response = await this.makeRequest(API_CONFIG.endpoints.verifyOtp, {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim() }),
        skipAuth: true,
    });

    if (response.success) {
        // Guardar sesión como en login OK
        this.user = response.data.user;
        this.token = response.data.token;
        this.permissions = response.data.user.permisos || [];
        
        // ✅ NUEVO: Guardar session_token
        this.sessionToken = response.data.session_token;

        sessionStorage.setItem('auth_token', this.token);
        sessionStorage.setItem('session_token', this.sessionToken); // ✅ NUEVO
        sessionStorage.setItem('user_data', JSON.stringify(this.user));
        sessionStorage.setItem('user_permissions', JSON.stringify(this.permissions));
        sessionStorage.setItem('login_time', new Date().toISOString());
        
        this.clearPendingOtp();
        const redirectRoute = this.getRoleBasedRoute();
        return { success: true, redirectTo: redirectRoute, data: response.data };
    }

    return { success: false, message: response.message || 'OTP inválido' };
}


async resendOtp(email) {
  return this.makeRequest(API_CONFIG.endpoints.resendOtpOtp, {
    method: 'POST',
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
    skipAuth: true,
  });
}

// Limpia pending_otp en clearLocalData()
// authServices.js - MODIFICAR clearLocalData (línea ~140)

clearLocalData() {
    this.token = null;
    this.sessionToken = null; // ✅ NUEVO
    this.user = null;
    this.permissions = [];
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('session_token'); // ✅ NUEVO
    sessionStorage.removeItem('user_data');
    sessionStorage.removeItem('user_permissions');
    sessionStorage.removeItem('login_time');
    sessionStorage.removeItem('pending_otp');
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
   * Actualizar información del usuario en sessionStorage
   */
  updateUserInfo(updatedUserData) {
    try {
      const currentUser = this.getCurrentUser();
      if (!currentUser) {
        console.warn('⚠️ No hay usuario en sesión para actualizar');
        return false;
      }

      const updatedUser = {
        ...currentUser,
        ...updatedUserData
      };

      this.user = updatedUser;
      sessionStorage.setItem('user_data', JSON.stringify(updatedUser));
      console.log('✅ Información del usuario actualizada');
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

  // ========================================
  // 🔑 PERMISOS Y ROLES
  // ========================================

  /**
   * Verificar si el usuario tiene un permiso específico
   */
  hasPermission(moduleName, actionType = null) {
    if (!this.permissions || this.permissions.length === 0) {
      console.warn('⚠️ No hay permisos cargados');
      return false;
    }

    moduleName = moduleName.toLowerCase();
    const requestedAction = actionType ? actionType.toLowerCase() : null;

    const hasAccess = this.permissions.some(perm => {
      if (!perm.nombre_accion || !perm.tipo_accion) return false;

      const permModule = perm.nombre_accion.toLowerCase();
      const permAction = perm.tipo_accion.toLowerCase();

      if (permModule === moduleName && !requestedAction) {
        return true;
      }

      if (permModule === moduleName && permAction === 'operaciones crud') {
        const basicActions = [
          'lectura', 'escritura', 'eliminacion', 'administracion',
          'reportes', 'configuracion', 'crear', 'editar',
          'actualizar', 'borrar', 'eliminar'
        ];
        return basicActions.includes(requestedAction);
      }

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
          actions.push('crear', 'leer', 'actualizar', 'eliminar');
        } else {
          actions.push(permAction.toLowerCase());
        }
      }
    });

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
   * Verificar si puede acceder a un módulo
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

    const modules = new Set();
    this.permissions.forEach(perm => {
      const [module] = perm.nombre_accion.split('.');
      modules.add(module);
    });

    return Array.from(modules);
  }

  /**
   * Verificar permiso en el servidor
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

  // ========================================
  // 🔄 RECUPERACIÓN DE CONTRASEÑA
  // ========================================

  /**
   * Solicitar recuperación de contraseña
   */
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

  /**
   * Verificar código de recuperación
   */
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

  /**
   * Restablecer contraseña
   */
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

  /**
   * Reenviar código de verificación
   */
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

// ========================================
// EXPORTAR INSTANCIA ÚNICA
// ========================================
const authService = new AuthService();

export default authService;
export { AuthService, api };
