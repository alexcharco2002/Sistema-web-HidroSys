/**
 * src/services/configServices.js
 * Servicio de Configuración del Sistema
 * Gestión de contraseñas y backups
 */

import authService from './authServices';

const API_CONFIG = {
  baseURL: 'https://localhost:8000',
  endpoints: {
    changePassword: (userId) => `/users/${userId}/change-password`,

    // ---------------- BACKUPS CORRECTOS ----------------
    listBackups: '/backups/',          // GET
    createBackup: '/backups/',         // POST
    restoreBackup: '/backups/restore', // PUT
    deleteBackup: (filename) => `/backups/${filename}`, // DELETE
    downloadBackup: (filename) => `/backups/download/${filename}`, // GET
    backupStats: '/backups/stats/info' // GET
  }
};


class ConfigService {
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
      timeout: 30000, // 30 segundos para backups
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

  // ========================================
  // GESTIÓN DE CONTRASEÑAS
  // ========================================

  /**
   * Cambiar contraseña del usuario actual
   */
  async changePassword(userId, passwordData) {
    try {
      this.validatePasswordData(passwordData);

      const data = await this.makeRequest(
        API_CONFIG.endpoints.changePassword(userId),
        {
          method: 'PUT',
          body: {
            current_password: passwordData.currentPassword,
            new_password: passwordData.newPassword,
          }
        }
      );

      return {
        success: true,
        message: data.message || 'Contraseña actualizada exitosamente'
      };

    } catch (error) {
      console.error('❌ Error cambiando contraseña:', error);
      
      let cleanMessage = 'Error al cambiar la contraseña';
      
      if (error.message.includes('incorrecta')) {
        cleanMessage = 'La contraseña actual es incorrecta';
      } else if (error.message.includes('8 caracteres')) {
        cleanMessage = 'La nueva contraseña debe tener al menos 8 caracteres';
      } else if (error.message.includes('igual a la actual')) {
        cleanMessage = 'La nueva contraseña no puede ser igual a la actual';
      } else if (error.message) {
        cleanMessage = error.message;
      }

      return {
        success: false,
        message: cleanMessage
      };
    }
  }

  /**
   * Validar datos de contraseña
   */
  validatePasswordData(passwordData) {
    if (!passwordData.currentPassword || passwordData.currentPassword.trim() === '') {
      throw new Error('La contraseña actual es requerida');
    }

    if (!passwordData.newPassword || passwordData.newPassword.trim() === '') {
      throw new Error('La nueva contraseña es requerida');
    }

    if (passwordData.newPassword.length < 8) {
      throw new Error('La nueva contraseña debe tener al menos 8 caracteres');
    }

    if (passwordData.newPassword === passwordData.currentPassword) {
      throw new Error('La nueva contraseña debe ser diferente a la actual');
    }

    if (passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword) {
      throw new Error('Las contraseñas no coinciden');
    }
  }

  // ========================================
  // GESTIÓN DE BACKUPS
  // ========================================

  /**
   * Listar todos los backups disponibles
   */
  async listBackups() {
  try {
    const data = await this.makeRequest(API_CONFIG.endpoints.listBackups);

    return {
      success: true,
      data: data.data || []
    };

  } catch (error) {
    console.error('❌ Error listando backups:', error);
    return {
      success: false,
      message: error.message || 'Error al listar backups',
      data: []
    };
  }
}


  /**
   * Crear un nuevo backup manual
   */
  async createBackup() {
    try {
      const data = await this.makeRequest(
        API_CONFIG.endpoints.createBackup,
        {
          method: 'POST',
          timeout: 60000 // 60 segundos para crear backup
        }
      );

      return {
        success: true,
        message: data.message || 'Backup creado exitosamente',
        data: data
      };

    } catch (error) {
      console.error('❌ Error creando backup:', error);
      return {
        success: false,
        message: error.message || 'Error al crear el backup'
      };
    }
  }

  /**
   * Restaurar un backup
   */
  async restoreBackup(filename) {
    try {
      if (!filename || filename.trim() === '') {
        throw new Error('El nombre del archivo es requerido');
      }

      const data = await this.makeRequest(
        API_CONFIG.endpoints.restoreBackup,
        {
          method: 'POST',
          body: { filename: filename },
          timeout: 120000 // 2 minutos para restaurar
        }
      );

      return {
        success: true,
        message: data.message || 'Backup restaurado exitosamente',
        data: data
      };

    } catch (error) {
      console.error('❌ Error restaurando backup:', error);
      return {
        success: false,
        message: error.message || 'Error al restaurar el backup'
      };
    }
  }

  /**
   * Eliminar un backup
   */
  async deleteBackup(filename) {
    try {
      if (!filename || filename.trim() === '') {
        throw new Error('El nombre del archivo es requerido');
      }

      const data = await this.makeRequest(
        API_CONFIG.endpoints.deleteBackup(filename),
        {
          method: 'DELETE'
        }
      );

      return {
        success: true,
        message: data.message || 'Backup eliminado exitosamente'
      };

    } catch (error) {
      console.error('❌ Error eliminando backup:', error);
      return {
        success: false,
        message: error.message || 'Error al eliminar el backup'
      };
    }
  }

  /**
   * Descargar un backup
   */
  async downloadBackup(filename) {
    try {
      if (!filename || filename.trim() === '') {
        throw new Error('El nombre del archivo es requerido');
      }

      const url = `${API_CONFIG.baseURL}${API_CONFIG.endpoints.downloadBackup(filename)}`;
      
      // Crear un enlace temporal para descargar
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      return {
        success: true,
        message: 'Descarga iniciada'
      };

    } catch (error) {
      console.error('❌ Error descargando backup:', error);
      return {
        success: false,
        message: error.message || 'Error al descargar el backup'
      };
    }
  }

  /**
   * Formatear tamaño de archivo
   */
  formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Formatear fecha de backup
   */
  formatBackupDate(dateString) {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('es-EC', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return dateString;
    }
  }
}

const configService = new ConfigService();

export default configService;
export { ConfigService };