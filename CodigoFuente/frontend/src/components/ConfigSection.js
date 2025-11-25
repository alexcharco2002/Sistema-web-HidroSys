// src/components/ConfigSection.js
// MÓDULO DE CONFIGURACIÓN - Con control de permisos granular similar a SectorsSection
import React, { useState, useEffect,  useMemo, useCallback} from 'react';
import './styleRoles.css'; // Reutilizamos los estilos de roles
import configService from '../services/configServices';
import authService from '../services/authServices';

import {
  Settings, Lock, Key, Database, Download, Upload, Trash2,
  AlertCircle, CheckCircle, RefreshCw, Save, Eye, EyeOff,
  HardDrive, Calendar, FileText, Shield
} from 'lucide-react';

const ConfigSection = () => {
  const [selectedSection, setSelectedSection] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Estado para cambio de contraseña
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Estado para backups
  const [backups, setBackups] = useState([]);
  const [loadingBackups, setLoadingBackups] = useState(false);

  // 🔑 PERMISOS DEL USUARIO ACTUAL
  const [permissions, setPermissions] = useState({
    canRead: false,
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    canChangePassword: false,
    canManageBackups: false
  });

  // 🔑 Cargar permisos al montar el componente
  useEffect(() => {
    loadUserPermissions();
  }, []);

  const loadUserPermissions = () => {
    // Verificar permisos CRUD del módulo de configuración
    const canCreate = authService.hasPermission('configuracion', 'crear') || 
                     authService.hasPermission('configuracion', 'operaciones crud');
  
    const canUpdate = authService.hasPermission('configuracion', 'actualizar') || 
                     authService.hasPermission('configuracion', 'operaciones crud');
    
    const canDelete = authService.hasPermission('configuracion', 'eliminar') || 
                     authService.hasPermission('configuracion', 'operaciones crud');

    const canRead = authService.hasPermission('configuracion', 'lectura') ||
                   canCreate || canUpdate || canDelete ||
                   authService.hasPermission('configuracion', 'operaciones crud');

    // Todos los usuarios pueden cambiar su propia contraseña
    const canChangePassword = true;
    
    // Para gestionar backups se requiere permiso de crear/actualizar/eliminar en configuración
    const canManageBackups = canCreate || canUpdate || canDelete;

    setPermissions({
      canRead,
      canCreate,
      canUpdate,
      canDelete,
      canChangePassword,
      canManageBackups
    });

    console.log('🔐 Permisos del usuario en módulo Configuración:', {
      canRead,
      canCreate,
      canUpdate,
      canDelete,
      canChangePassword,
      canManageBackups
    });
  };

  // Definición de secciones disponibles
  const configSections = useMemo(() => [
  {
    id: 'security',
    nombre: 'Seguridad',
    descripcion: 'Cambiar contraseña y configuraciones de seguridad',
    icon: Shield,
    visible: permissions.canChangePassword
  },
  {
    id: 'backups',
    nombre: 'Respaldos',
    descripcion: 'Gestión de backups de la base de datos',
    icon: Database,
    visible: permissions.canManageBackups
  }
], [permissions]);


  

  // Seleccionar la primera sección visible por defecto
  useEffect(() => {
    if (permissions.canChangePassword || permissions.canManageBackups) {
      const firstVisible = configSections.find(s => s.visible);
if (firstVisible && !selectedSection) {
    setSelectedSection(firstVisible.id);
}

    }
  }, [permissions, configSections, selectedSection]);

  // ========================================
  // CAMBIO DE CONTRASEÑA
  // ========================================

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!permissions.canChangePassword) {
      setError('No tienes permiso para cambiar la contraseña');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('Las contraseñas nuevas no coinciden');
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }

    setLoading(true);

    try {
      const currentUser = authService.getCurrentUser();
      const result = await configService.changePassword(
        currentUser.id_usuario_sistema,
        {
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
          confirmPassword: passwordForm.confirmPassword
        }
      );

      if (result.success) {
        setSuccess(result.message);
        setPasswordForm({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
        
        setTimeout(() => setSuccess(null), 5000);
      } else {
        setError(result.message);
      }

    } catch (err) {
      setError('Error inesperado al cambiar la contraseña');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = (field) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  // ========================================
  // GESTIÓN DE BACKUPS
  // ========================================

  const loadBackups = useCallback(async () => {
    if (!permissions.canManageBackups) {
      setError('No tienes permiso para gestionar backups');
      return;
    }

    setLoadingBackups(true);
    setError(null);

    try {
      const result = await configService.listBackups();

      if (result.success) {
        setBackups(result.data);
        console.log('✅ Backups cargados:', result.data.length);
      } else {
        setError(result.message);
      }

    } catch (err) {
      setError('Error al cargar la lista de backups');
      console.error('Error:', err);
    } finally {
      setLoadingBackups(false);
    }
  }, [permissions.canManageBackups]);


  // Cargar backups al seleccionar la sección de backups
  useEffect(() => {
    if (selectedSection?.id === 'backups' && permissions.canManageBackups) {
      loadBackups();
    }
  }, [selectedSection, permissions.canManageBackups,loadBackups ]);

  const handleCreateBackup = async () => {
    if (!permissions.canCreate) {
      alert('❌ No tienes permiso para crear backups');
      return;
    }

    if (!window.confirm('¿Deseas crear un nuevo backup de la base de datos?')) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await configService.createBackup();

      if (result.success) {
        setSuccess(result.message);
        await loadBackups();
        
        setTimeout(() => setSuccess(null), 5000);
      } else {
        setError(result.message);
      }

    } catch (err) {
      setError('Error al crear el backup');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreBackup = async (filename) => {
    if (!permissions.canUpdate) {
      alert('❌ No tienes permiso para restaurar backups');
      return;
    }

    if (!window.confirm(
      `⚠️ ADVERTENCIA: Esta acción restaurará la base de datos y reemplazará todos los datos actuales.\n\n` +
      `¿Estás seguro de que deseas restaurar el backup:\n"${filename}"?`
    )) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await configService.restoreBackup(filename);

      if (result.success) {
        setSuccess(result.message);
        
        setTimeout(() => {
          alert('La base de datos ha sido restaurada. Por seguridad, se cerrará tu sesión.');
          authService.logout();
          window.location.reload();
        }, 3000);
      } else {
        setError(result.message);
      }

    } catch (err) {
      setError('Error al restaurar el backup');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBackup = async (filename) => {
    if (!permissions.canDelete) {
      alert('❌ No tienes permiso para eliminar backups');
      return;
    }

    if (!window.confirm(`¿Estás seguro de que deseas eliminar el backup "${filename}"?`)) {
      return;
    }

    try {
      const result = await configService.deleteBackup(filename);

      if (result.success) {
        setSuccess(result.message);
        await loadBackups();
        
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.message);
      }

    } catch (err) {
      setError('Error al eliminar el backup');
      console.error('Error:', err);
    }
  };

  const handleDownloadBackup = async (filename) => {
    if (!permissions.canRead) {
      alert('❌ No tienes permiso para descargar backups');
      return;
    }

    try {
      const result = await configService.downloadBackup(filename);

      if (result.success) {
        setSuccess(result.message);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.message);
      }

    } catch (err) {
      setError('Error al descargar el backup');
      console.error('Error:', err);
    }
  };

  // ========================================
  // RENDER
  // ========================================

  // Verificar acceso al módulo
  if (!permissions.canRead && !permissions.canChangePassword) {
    return (
      <div className="section-placeholder">
        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
        <h2>Acceso Denegado</h2>
        <p>No tienes permiso para acceder al módulo de configuración.</p>
      </div>
    );
  }

  if (loading && !selectedSection) {
    return (
      <div className="section-placeholder">
        <RefreshCw className="w-16 h-16 mx-auto mb-4 text-gray-400 animate-spin" />
        <h2>Cargando Configuración</h2>
        <p>Por favor espera mientras cargamos la información...</p>
      </div>
    );
  }

  const stats = {
    secciones: configSections.filter(s => s.visible).length,
    backupsTotal: backups.length,
    ultimoBackup: backups.length > 0 ? backups[0].filename : 'N/A'
  };

  const currentSection = configSections.find(
  (section) => section.id === selectedSection
);


  return (
    <div className="roles-section">
      {/* Header */}
      <div className="section-header">
        <div className="section-title">
          <Settings className="w-6 h-6 text-blue-600" />
          <h2>Configuración del Sistema</h2>
        </div>
      </div>

      {/* Stats */}
      <div className="users-stats">
        <div className="stat-item">
          <Settings className="stat-icon text-blue-600" />
          <div>
            <p className="stat-label">Secciones</p>
            <p className="stat-value">{stats.secciones}</p>
          </div>
        </div>

        <div className="stat-item">
          <Database className="stat-icon text-green-600" />
          <div>
            <p className="stat-label">Backups Totales</p>
            <p className="stat-value">{stats.backupsTotal}</p>
          </div>
        </div>

        <div className="stat-item">
          <HardDrive className="stat-icon text-purple-600" />
          <div>
            <p className="stat-label">Último Backup</p>
            <p className="stat-value text-xs truncate" style={{maxWidth: '150px'}}>
              {stats.ultimoBackup}
            </p>
          </div>
        </div>
      </div>

      {/* Mensajes globales */}
      {error && (
        <div className="alert alert-error mb-4">
          <AlertCircle className="w-5 h-5 mr-2" />
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success mb-4">
          <CheckCircle className="w-5 h-5 mr-2" />
          {success}
        </div>
      )}

      {/* Layout de dos columnas similar a RolesSection */}
      <div className="roles-layout">
        {/* Panel de Secciones (Izquierda) */}
        <div className="roles-list-panel">
          <h3 className="panel-title">
            <Settings className="w-5 h-5" />
            Secciones de Configuración
          </h3>
          
          <div className="roles-list">
            {configSections
              .filter(section => section.visible)
              .map(section => {
                const Icon = section.icon;
                return (
                  <div
                    key={section.id}
                    className={`role-item ${selectedSection === section.id ? 'selected' : ''}`}
                    onClick={() => setSelectedSection(section.id)}

                  >
                    <div className="role-item-header">
                      <div className="role-item-title">
                        <Icon className="w-5 h-5 mr-2" />
                        {section.nombre}
                      </div>
                    </div>
                    
                    <div className="role-item-description">
                      {section.descripcion}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Panel de Contenido (Derecha) */}
        <div className="actions-panel">
        {currentSection ? (
            <>
              {/* SECCIÓN: SEGURIDAD */}
              {selectedSection === 'security' && permissions.canChangePassword && (
                <>
                  <div className="actions-header">
                    <div>
                      <h3 className="panel-title">
                        <Shield className="w-5 h-5 mr-2" />
                        Seguridad
                      </h3>
                      <p className="panel-subtitle">
                        Gestiona tu contraseña y configuraciones de seguridad
                      </p>
                    </div>
                  </div>

                  <div className="action-card">
                    <div className="action-card-header">
                      <div className="action-info">
                        <Lock className="w-6 h-6 text-blue-600 mr-3" />
                        <div>
                          <div className="action-name">Cambiar Contraseña</div>
                          <div className="action-type">Actualiza tu contraseña regularmente</div>
                        </div>
                      </div>
                    </div>

                    <form onSubmit={handlePasswordChange} className="user-form" style={{marginTop: '1rem'}}>
                      <div className="form-grid">
                        <div className="form-group form-group-full">
                          <label>
                            <Key className="w-4 h-4 mr-2" style={{display: 'inline-block', verticalAlign: 'middle'}} />
                            Contraseña Actual *
                          </label>
                          <div style={{position: 'relative'}}>
                            <input
                              type={showPasswords.current ? 'text' : 'password'}
                              required
                              value={passwordForm.currentPassword}
                              onChange={(e) => setPasswordForm({
                                ...passwordForm,
                                currentPassword: e.target.value
                              })}
                              placeholder="Ingresa tu contraseña actual"
                              style={{paddingRight: '2.5rem'}}
                            />
                            <button
                              type="button"
                              onClick={() => togglePasswordVisibility('current')}
                              style={{
                                position: 'absolute',
                                right: '0.5rem',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#9ca3af'
                              }}
                            >
                              {showPasswords.current ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                          </div>
                        </div>

                        <div className="form-group form-group-full">
                          <label>
                            <Lock className="w-4 h-4 mr-2" style={{display: 'inline-block', verticalAlign: 'middle'}} />
                            Nueva Contraseña *
                          </label>
                          <div style={{position: 'relative'}}>
                            <input
                              type={showPasswords.new ? 'text' : 'password'}
                              required
                              minLength="8"
                              value={passwordForm.newPassword}
                              onChange={(e) => setPasswordForm({
                                ...passwordForm,
                                newPassword: e.target.value
                              })}
                              placeholder="Mínimo 8 caracteres"
                              style={{paddingRight: '2.5rem'}}
                            />
                            <button
                              type="button"
                              onClick={() => togglePasswordVisibility('new')}
                              style={{
                                position: 'absolute',
                                right: '0.5rem',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#9ca3af'
                              }}
                            >
                              {showPasswords.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                          </div>
                          <small style={{fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem', display: 'block'}}>
                            La contraseña debe tener al menos 8 caracteres
                          </small>
                        </div>

                        <div className="form-group form-group-full">
                          <label>
                            <Lock className="w-4 h-4 mr-2" style={{display: 'inline-block', verticalAlign: 'middle'}} />
                            Confirmar Nueva Contraseña *
                          </label>
                          <div style={{position: 'relative'}}>
                            <input
                              type={showPasswords.confirm ? 'text' : 'password'}
                              required
                              minLength="8"
                              value={passwordForm.confirmPassword}
                              onChange={(e) => setPasswordForm({
                                ...passwordForm,
                                confirmPassword: e.target.value
                              })}
                              placeholder="Repite la nueva contraseña"
                              style={{paddingRight: '2.5rem'}}
                            />
                            <button
                              type="button"
                              onClick={() => togglePasswordVisibility('confirm')}
                              style={{
                                position: 'absolute',
                                right: '0.5rem',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#9ca3af'
                              }}
                            >
                              {showPasswords.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="form-actions">
                        <button type="submit" className="btn-primary" disabled={loading}>
                          {loading ? (
                            <>
                              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                              Cambiando...
                            </>
                          ) : (
                            <>
                              <Save className="w-4 h-4 mr-2" />
                              Cambiar Contraseña
                            </>
                          )}
                        </button>
                      </div>
                    </form>

                    {/* Consejos de seguridad */}
                    <div className="alert alert-info" style={{marginTop: '1.5rem'}}>
                      <AlertCircle className="w-5 h-5 mr-2" />
                      <div>
                        <strong>Consejos de Seguridad:</strong>
                        <ul style={{marginTop: '0.5rem', marginLeft: '1.5rem', fontSize: '0.875rem'}}>
                          <li>Usa una contraseña única que no uses en otros sitios</li>
                          <li>Combina letras mayúsculas, minúsculas, números y símbolos</li>
                          <li>Cambia tu contraseña regularmente</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* SECCIÓN: BACKUPS */}
              {selectedSection === 'backups' && permissions.canManageBackups && (
                <>
                  <div className="actions-header">
                    <div>
                      <h3 className="panel-title">
                        <Database className="w-5 h-5 mr-2" />
                        Gestión de Respaldos
                      </h3>
                      <p className="panel-subtitle">
                        {backups.length} backup{backups.length !== 1 ? 's' : ''} disponible{backups.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div style={{display: 'flex', gap: '0.5rem'}}>
                      <button
                        className="btn-secondary"
                        onClick={loadBackups}
                        disabled={loadingBackups}
                        title="Recargar lista"
                      >
                        <RefreshCw className={`w-4 h-4 ${loadingBackups ? 'animate-spin' : ''}`} />
                      </button>
                      {permissions.canCreate && (
                        <button
                          className="btn-primary"
                          onClick={handleCreateBackup}
                          disabled={loading}
                        >
                          <Database className="w-4 h-4 mr-2" />
                          Crear Backup
                        </button>
                      )}
                    </div>
                  </div>

                  {loadingBackups ? (
                    <div className="section-placeholder">
                      <RefreshCw className="w-8 h-8 mx-auto mb-2 text-blue-600 animate-spin" />
                      <p>Cargando backups...</p>
                    </div>
                  ) : backups.length === 0 ? (
                    <div className="empty-state">
                      <Database className="w-16 h-16 text-gray-300 mx-auto mb-2" />
                      <h3>No hay backups disponibles</h3>
                      <p>Crea tu primer backup haciendo clic en el botón superior</p>
                    </div>
                  ) : (
                    <>
                      <div className="actions-grid">
                        {backups.map((backup, index) => (
                          <div key={index} className="action-card">
                            <div className="action-card-header">
                              <div className="action-info">
                                <FileText className="w-6 h-6 text-blue-600 mr-3" />
                                <div>
                                  <div className="action-name">{backup.filename}</div>
                                  <div className="action-type">
                                    {configService.formatFileSize(backup.size)}
                                  </div>
                                </div>
                              </div>
                              <div className="action-buttons">
                                {permissions.canRead && (
                                  <button
                                    className="action-btn view"
                                    onClick={() => handleDownloadBackup(backup.filename)}
                                    title="Descargar"
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                )}
                                {permissions.canUpdate && (
                                  <button
                                    className="action-btn edit"
                                    onClick={() => handleRestoreBackup(backup.filename)}
                                    title="Restaurar"
                                    disabled={loading}
                                  >
                                    <Upload className="w-4 h-4" />
                                  </button>
                                )}
                                {permissions.canDelete && (
                                  <button
                                    className="action-btn delete"
                                    onClick={() => handleDeleteBackup(backup.filename)}
                                    title="Eliminar"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="action-card-footer">
                              <span className="date-badge">
                                <Calendar className="w-3 h-3" />
                                {configService.formatBackupDate(backup.created_at)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Advertencia */}
                      <div className="alert alert-warning" style={{marginTop: '1.5rem'}}>
                        <AlertCircle className="w-5 h-5 mr-2" />
                        <div>
                          <strong>⚠️ Advertencia Importante:</strong>
                          <p style={{marginTop: '0.5rem', fontSize: '0.875rem'}}>
                            Restaurar un backup reemplazará todos los datos actuales de la base de datos.
                            Asegúrate de crear un backup reciente antes de restaurar uno antiguo.
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </>
          ) : (
            <div className="empty-state">
              <Eye className="w-16 h-16 text-gray-300 mx-auto mb-2" />
              <h3>Selecciona una Sección</h3>
              <p>Selecciona una sección de configuración de la lista.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConfigSection;