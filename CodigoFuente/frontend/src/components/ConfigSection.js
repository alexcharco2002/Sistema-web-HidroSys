// src/components/ConfigSection.js
// MÓDULO DE CONFIGURACIÓN - Solo Backups
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './RolesSection.css';
import configService from '../services/configServices';
import authService from '../services/authServices';

import {
  Settings, Database, Download, Upload, Trash2,
  AlertCircle, CheckCircle, RefreshCw, Calendar, FileText, Clock
} from 'lucide-react';

const ConfigSection = () => {
  const [selectedSection, setSelectedSection] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Estado para backups
  const [backups, setBackups] = useState([]);
  const [loadingBackups, setLoadingBackups] = useState(false);

  // 🔑 PERMISOS DEL USUARIO ACTUAL
  const [permissions, setPermissions] = useState({
    canRead: false,
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    canManageBackups: false
  });

  // 🔑 Cargar permisos al montar el componente
  useEffect(() => {
    loadUserPermissions();
  }, []);

  const loadUserPermissions = () => {
    const canCreate = authService.hasPermission('configuracion', 'crear') || 
                     authService.hasPermission('configuracion', 'operaciones crud');
  
    const canUpdate = authService.hasPermission('configuracion', 'actualizar') || 
                     authService.hasPermission('configuracion', 'operaciones crud');
    
    const canDelete = authService.hasPermission('configuracion', 'eliminar') || 
                     authService.hasPermission('configuracion', 'operaciones crud');

    const canRead = authService.hasPermission('configuracion', 'lectura') ||
                   canCreate || canUpdate || canDelete ||
                   authService.hasPermission('configuracion', 'operaciones crud');

    const canManageBackups = canCreate || canUpdate || canDelete;

    setPermissions({
      canRead,
      canCreate,
      canUpdate,
      canDelete,
      canManageBackups
    });

    console.log('🔐 Permisos del usuario en módulo Configuración:', {
      canRead,
      canCreate,
      canUpdate,
      canDelete,
      canManageBackups
    });
  };

  // Definición de secciones disponibles (solo backups)
  const configSections = useMemo(() => [
    {
      id: 'backups',
      nombre: 'Respaldos',
      descripcion: 'Gestión de backups de la base de datos',
      icon: Database,
      visible: permissions.canManageBackups
    }
  ], [permissions]);

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

  useEffect(() => {
    if (selectedSection === 'backups' && permissions.canManageBackups) {
      loadBackups();
    }
  }, [selectedSection, permissions.canManageBackups, loadBackups]);

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

  if (!permissions.canRead && !permissions.canManageBackups) {
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
          <Clock className="stat-icon text-purple-600" />
          <div>
            <p className="stat-label">Último Backup</p>
              <p className="text-[30px] font-bold truncate max-w-[150px]">
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

      {/* Layout de dos columnas */}
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
              <Settings className="w-16 h-16 text-gray-300 mx-auto mb-2" />
              <h3>Selecciona una Sección</h3>
              <p>Selecciona una sección de configuración de la lista para ver su contenido.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConfigSection;