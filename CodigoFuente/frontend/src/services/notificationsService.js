/**
 * src/services/notificationsService.js
 * Servicio de Gestión de Notificaciones + Usuarios
 */

import authService from './authServices';

const API_CONFIG = {
  baseURL: 'https://localhost:8000',
  endpoints: {
    notifications: '/notifications',
    notificationById: (id) => `/notifications/${id}`,
    markAsRead: (id) => `/notifications/${id}/marcar-leida`,
    markAllAsRead: '/notifications/marcar-todas-leidas',
    unreadCount: '/notifications/no-leidas/count',
    createMaintenance: '/notifications/mantenimiento',
    createNotification: '/notifications',
    users: '/notifications/usuarios', 
  }
};

class NotificationsService {
  constructor() {
    this.cachedNotifications = null;
    this.unreadCount = 0;
    this.pollingInterval = null;
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

    // Manejar FormData y JSON
    if (finalOptions.body instanceof FormData) {
      delete finalOptions.headers['Content-Type'];
    } else if (finalOptions.body && typeof finalOptions.body === 'object') {
      finalOptions.headers['Content-Type'] = 'application/json';
      finalOptions.body = JSON.stringify(finalOptions.body);
    }

    try {
      console.log(`🔔 Notifications API: ${finalOptions.method} ${url}`);
      
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

      // Manejar respuestas 204 (No Content)
      if (response.status === 204) {
        return null;
      }

      const data = await response.json();
      console.log(`✅ Notifications Response:`, data);
      return data;
      
    } catch (error) {
      console.error(`❌ Notifications Error:`, error);
      
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
  // 🔥 MÉTODOS DE USUARIOS
  // ========================================
  
  /**
   * Obtener lista de usuarios activos y no bloqueados
   */
  async getActiveUsers() {
    try {
      const endpoint = `${API_CONFIG.endpoints.users}?activo=true&limit=1000`;
      const data = await this.makeRequest(endpoint);
      
      // Filtrar solo usuarios activos y no bloqueados
      const filteredUsers = data.filter(user => 
        user.activo === true && 
        user.bloqueado_permanente === false &&
        !user.bloqueado_hasta
      );

      console.log(`✅ Usuarios activos obtenidos: ${filteredUsers.length}`);

      return {
        success: true,
        data: filteredUsers
      };
    } catch (error) {
      console.error('❌ Error obteniendo usuarios:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener usuarios'
      };
    }
  }

  // ========================================
  // 🔥 MÉTODOS DE NOTIFICACIONES
  // ========================================

  /**
   * Crear notificación general
   */
  async createNotification(notificationData) {
    try {
      const data = await this.makeRequest(API_CONFIG.endpoints.createNotification, {
        method: 'POST',
        body: notificationData
      });

      // Limpiar caché para forzar recarga
      this.cachedNotifications = null;

      return {
        success: true,
        data: data,
        message: 'Notificación creada exitosamente'
      };
    } catch (error) {
      console.error('❌ Error creando notificación:', error);
      return {
        success: false,
        message: error.message || 'Error al crear notificación'
      };
    }
  }

  /**
   * Crear mantenimiento programado
   */
  async createMaintenance(maintenanceData) {
    try {
      const data = await this.makeRequest(API_CONFIG.endpoints.createMaintenance, {
        method: 'POST',
        body: maintenanceData
      });

      // Limpiar caché para forzar recarga
      this.cachedNotifications = null;

      return {
        success: true,
        data: data,
        message: data.message || 'Mantenimiento programado creado exitosamente'
      };
    } catch (error) {
      console.error('❌ Error creando mantenimiento:', error);
      return {
        success: false,
        message: error.message || 'Error al crear mantenimiento programado'
      };
    }
  }

  /**
   * Obtener todas las notificaciones del usuario
   */
  async getNotifications(estado = null) {
    try {
      let endpoint = API_CONFIG.endpoints.notifications;
      if (estado) {
        endpoint += `?estado=${estado}`;
      }

      const data = await this.makeRequest(endpoint);
      
      // Actualizar caché
      this.cachedNotifications = data;
      this.unreadCount = data.filter(n => n.estado === 'no_leido').length;
      
      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error('❌ Error obteniendo notificaciones:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener notificaciones'
      };
    }
  }

  /**
   * Obtener contador de notificaciones no leídas
   */
  async getUnreadCount() {
    try {
      const data = await this.makeRequest(API_CONFIG.endpoints.unreadCount);
      this.unreadCount = data.no_leidas || 0;
      
      return {
        success: true,
        data: this.unreadCount
      };
    } catch (error) {
      console.error('❌ Error obteniendo contador:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener contador'
      };
    }
  }

  /**
   * Marcar notificación como leída
   */
  async markAsRead(notificationId) {
    try {
      const data = await this.makeRequest(API_CONFIG.endpoints.markAsRead(notificationId), {
        method: 'PATCH'
      });

      // Actualizar caché
      if (this.cachedNotifications) {
        const index = this.cachedNotifications.findIndex(n => n.id_notificacion === notificationId);
        if (index !== -1) {
          this.cachedNotifications[index] = data;
        }
      }

      // Decrementar contador
      if (this.unreadCount > 0) {
        this.unreadCount--;
      }

      return {
        success: true,
        data: data,
        message: 'Notificación marcada como leída'
      };
    } catch (error) {
      console.error('❌ Error marcando como leída:', error);
      return {
        success: false,
        message: error.message || 'Error al marcar notificación'
      };
    }
  }

  /**
   * Marcar todas las notificaciones como leídas
   */
  async markAllAsRead() {
    try {
      const data = await this.makeRequest(API_CONFIG.endpoints.markAllAsRead, {
        method: 'PATCH'
      });

      // Limpiar caché para forzar recarga
      this.cachedNotifications = null;
      this.unreadCount = 0;

      return {
        success: true,
        data: data,
        message: data.message || 'Todas las notificaciones fueron marcadas como leídas'
      };
    } catch (error) {
      console.error('❌ Error marcando todas como leídas:', error);
      return {
        success: false,
        message: error.message || 'Error al marcar todas las notificaciones'
      };
    }
  }

  /**
   * Eliminar una notificación
   */
  async deleteNotification(notificationId) {
    try {
      await this.makeRequest(API_CONFIG.endpoints.notificationById(notificationId), {
        method: 'DELETE'
      });

      // Actualizar caché
      if (this.cachedNotifications) {
        this.cachedNotifications = this.cachedNotifications.filter(
          n => n.id_notificacion !== notificationId
        );
      }

      return {
        success: true,
        message: 'Notificación eliminada correctamente'
      };
    } catch (error) {
      console.error('❌ Error eliminando notificación:', error);
      return {
        success: false,
        message: error.message || 'Error al eliminar notificación'
      };
    }
  }

  /**
   * Formatear tiempo relativo (ej: "hace 5 minutos")
   */
  formatRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) {
      return 'Justo ahora';
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `Hace ${diffInMinutes} minuto${diffInMinutes > 1 ? 's' : ''}`;
    }

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `Hace ${diffInHours} hora${diffInHours > 1 ? 's' : ''}`;
    }

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
      return `Hace ${diffInDays} día${diffInDays > 1 ? 's' : ''}`;
    }

    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) {
      return `Hace ${diffInWeeks} semana${diffInWeeks > 1 ? 's' : ''}`;
    }

    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  /**
   * Transformar notificaciones del backend al formato del frontend
   */
/**
 * Transformar notificaciones del backend al formato del frontend
 */
transformNotifications(notifications) {
    return notifications.map(n => ({
      id: n.id_notificacion,
      id_notificacion: n.id_notificacion,
      type: n.tipo || 'info',
      message: n.mensaje,
      title: n.titulo,
      time: this.formatRelativeTime(n.fecha_creacion),
      timestamp: n.fecha_creacion,
      read: n.estado === 'leido',
      estado: n.estado,
      es_mantenimiento: n.es_mantenimiento,
      prioridad: n.prioridad,
      
      // ✅ AGREGAR CAMPOS DE MANTENIMIENTO
      fecha_inicio_mantenimiento: n.fecha_inicio_mantenimiento,
      fecha_fin_mantenimiento: n.fecha_fin_mantenimiento,
      duracion_estimada: n.duracion_estimada,
      modulos_afectados: n.modulos_afectados,
      enviar_email: n.enviar_email,
      email_enviado: n.email_enviado,
      fecha_envio_email: n.fecha_envio_email
    }));
}


  /**
   * Iniciar polling de notificaciones
   */
  startPolling(intervalSeconds = 30, callback = null) {
    this.stopPolling();

    this.getUnreadCount().then(result => {
      if (callback && result.success) {
        callback(result.data);
      }
    });

    this.pollingInterval = setInterval(async () => {
      const result = await this.getUnreadCount();
      if (callback && result.success) {
        callback(result.data);
      }
    }, intervalSeconds * 1000);

    console.log(`🔔 Polling iniciado (cada ${intervalSeconds}s)`);
  }

  /**
   * Detener polling
   */
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * Limpiar todo
   */
  cleanup() {
    this.stopPolling();
    this.cachedNotifications = null;
    this.unreadCount = 0;
  }
}

const notificationsService = new NotificationsService();
export default notificationsService;
export { NotificationsService };
