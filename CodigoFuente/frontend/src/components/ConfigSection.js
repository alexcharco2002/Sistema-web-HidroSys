// src/components/ConfigSection.js
// MÓDULO DE CONFIGURACIÓN - Solo Backups
import React, { useState, useEffect, useMemo, useCallback } from 'react';

import './RolesSection.css';
import configService from '../services/configServices';
import authService from '../services/authServices';
// Importar el servicio de limitesgeograficos
import limitesService from '../services/limitesServices';

import './ConfigSection.css';

import {
  Settings, Database, Download, Upload, Trash2, Map,
  AlertCircle, CheckCircle, RefreshCw, Calendar, FileText, Clock, Edit, XCircle
} from 'lucide-react';

const ConfigSection = () => {
  const [selectedSection, setSelectedSection] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);


  // Estado para backups
  const [backups, setBackups] = useState([]);
  const [loadingBackups, setLoadingBackups] = useState(false);

  // Estados para limites geograficos
  const [limites, setLimites] = useState([]);
  const [loadingLimites, setLoadingLimites] = useState(false);
  const [editingLimite, setEditingLimite] = useState(null);
  const [showLimiteModal, setShowLimiteModal] = useState(false);
  const [limiteFormData, setLimiteFormData] = useState({
    nombre: '',
    norte: '',
    sur: '',
    este: '',
    oeste: '',
    altitud_min: '',
    altitud_max: '',
    activo: true
  });

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
    },
    {
      id: 'limites',
      nombre: 'Límites Geográficos',
      descripcion: 'Gestión de límites geográficos para el sistema',
      icon: Map, // Importar: import { Map } from 'lucide-react';
      visible: permissions.canManageBackups // O crear permisos específicos
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
  // 🔑 Verificar permisos
  if (!permissions.canCreate) {
    window.alert("❌ No tienes permiso para crear backups.");
    return;
  }

  // 🔥 Confirmación nativa
  const confirmed = window.confirm("¿Deseas crear un nuevo backup de la base de datos?");
    if (!confirmed) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await configService.createBackup();

      if (result.success) {
        // 🎉 Éxito nativo
        window.alert(`✔ Backup creado:\n${result.message}`);

        await loadBackups();
        setSuccess(result.message);

        setTimeout(() => setSuccess(null), 5000);
      } else {
        // ❌ Error nativo
        window.alert(`❌ Error al crear el backup:\n${result.message}`);
        setError(result.message);
      }

    } catch (err) {
      window.alert("❌ Error inesperado al crear el backup.");
      setError("Error al crear el backup");
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };
  const handleRestoreBackup = async (filename) => {
    // 🔑 Verificar permisos
    if (!permissions.canUpdate) {
      window.alert("❌ No tienes permiso para restaurar backups.");
      return;
    }

    // ⚠️ Advertencia seria (nativo)
    const confirmed = window.confirm(
      `⚠ Esta acción restaurará la base de datos y reemplazará todos los datos actuales.\n\n` +
      `¿Deseas restaurar el backup:\n"${filename}"?`
    );

    if (!confirmed) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await configService.restoreBackup(filename);

      if (result.success) {
        // 🎉 Mensaje de éxito nativo
        window.alert(`✔ Base de datos restaurada:\n${result.message}`);
      } else {
        // ❌ Error nativo
        window.alert(`❌ Error al restaurar el backup:\n${result.message}`);
        setError(result.message);
      }

    } catch (err) {
      window.alert("❌ Error inesperado al restaurar el backup.");
      setError("Error al restaurar el backup");
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBackup = async (filename) => {
    // 🔑 Verificar permisos
    if (!permissions.canDelete) {
      window.alert("❌ No tienes permiso para eliminar backups.");
      return;
    }

    // ⚠ Confirmación nativa
    const confirmed = window.confirm(
      `¿Estás seguro de que deseas eliminar el backup "${filename}"?`
    );

    if (!confirmed) return;

    try {
      const result = await configService.deleteBackup(filename);

      if (result.success) {
        // 🎉 Éxito nativo
        window.alert(`✔ Backup eliminado:\n${result.message}`);

        setSuccess(result.message);
        await loadBackups();
        setTimeout(() => setSuccess(null), 3000);

      } else {
        // ❌ Error nativo
        window.alert(`❌ Error al eliminar el backup:\n${result.message}`);
        setError(result.message);
      }

    } catch (err) {
      window.alert("❌ Error inesperado al eliminar el backup.");
      setError("Error al eliminar el backup");
      console.error("Error:", err);
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
  // GESTION DE LIMITES GEOGRAFICOS
  // ========================================
  
  // Cargar límites cuando se seleccione la sección
  const loadLimites = useCallback(async () => {
    setLoadingLimites(true);
    setError(null);

    try {
      const result = await limitesService.listLimites();

      if (result.success) {
        const limitesOrdenados = [...result.data].sort(
          (a, b) => Number(b.activo) - Number(a.activo)
        );

        setLimites(limitesOrdenados);
        console.log('✅ Límites cargados:', limitesOrdenados.length);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Error al cargar la lista de límites');
      console.error('Error:', err);
    } finally {
      setLoadingLimites(false);
    }
  }, []);


  useEffect(() => {
    if (selectedSection === 'limites') {
      loadLimites();
    }
  }, [selectedSection, loadLimites]);

  // Función para abrir modal de crear/editar
  const openLimiteModal = (limite = null) => {
    if (limite) {
      setEditingLimite(limite);
      setLimiteFormData({
        nombre: limite.nombre || '',
        norte: limite.norte || '',
        sur: limite.sur || '',
        este: limite.este || '',
        oeste: limite.oeste || '',
        altitud_min: limite.altitud_min || '',
        altitud_max: limite.altitud_max || '',
        activo: limite.activo !== undefined ? limite.activo : true
      });
    } else {
      setEditingLimite(null);
      setLimiteFormData({
        nombre: '',
        norte: '',
        sur: '',
        este: '',
        oeste: '',
        altitud_min: '',
        altitud_max: '',
        activo: true
      });
    }
    setShowLimiteModal(true);
  };

  const closeLimiteModal = () => {
    setShowLimiteModal(false);
    setEditingLimite(null);
    setLimiteFormData({
      nombre: '',
      norte: '',
      sur: '',
      este: '',
      oeste: '',
      altitud_min: '',
      altitud_max: '',
      activo: true
    });
  };

  // Guardar límite (crear o actualizar)
  const handleSaveLimite = async (e) => {
    e.preventDefault(); // ✅ Prevenir el comportamiento por defecto del form
    
    if (!permissions.canCreate && !editingLimite) {
      window.alert("❌ No tienes permiso para crear límites geográficos.");
      return;
    }

    if (!permissions.canUpdate && editingLimite) {
      window.alert("❌ No tienes permiso para actualizar límites geográficos.");
      return;
    }

    // ✅ Validaciones personalizadas adicionales
    const norte = parseFloat(limiteFormData.norte);
    const sur = parseFloat(limiteFormData.sur);
    const este = parseFloat(limiteFormData.este);
    const oeste = parseFloat(limiteFormData.oeste);
    
    // Validar que Sur < Norte
    if (sur >= norte) {
      window.alert("❌ El límite Sur debe ser menor que el límite Norte");
      return;
    }
    
    // Validar altitudes si están presentes
    if (limiteFormData.altitud_min !== '' && limiteFormData.altitud_max !== '') {
      const altMin = parseFloat(limiteFormData.altitud_min);
      const altMax = parseFloat(limiteFormData.altitud_max);
      if (altMin > altMax) {
        window.alert("❌ La altitud mínima debe ser menor o igual a la altitud máxima");
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      // Preparar datos
      const dataToSend = {
        nombre: limiteFormData.nombre.trim(),
        norte: norte,
        sur: sur,
        este: este,
        oeste: oeste,
        activo: limiteFormData.activo
      };

      // Agregar altitudes solo si tienen valor
      if (limiteFormData.altitud_min !== '') {
        dataToSend.altitud_min = parseFloat(limiteFormData.altitud_min);
      }
      if (limiteFormData.altitud_max !== '') {
        dataToSend.altitud_max = parseFloat(limiteFormData.altitud_max);
      }

      let result;
      if (editingLimite) {
        result = await limitesService.updateLimite(editingLimite.id, dataToSend);
      } else {
        result = await limitesService.createLimite(dataToSend);
      }

      if (result.success) {
        window.alert(`✔ Límite geográfico ${editingLimite ? 'actualizado' : 'creado'} exitosamente`);
        setSuccess(result.message);
        
        // ✅ Cerrar modal primero
        closeLimiteModal();
        
        // ✅ Recargar los límites con loading spinner
        await loadLimites();
        
        // ✅ Limpiar mensaje de éxito después de 3 segundos
        setTimeout(() => setSuccess(null), 3000);
      } else {
        window.alert(`❌ Error: ${result.message}`);
        setError(result.message);
      }
    } catch (err) {
      window.alert("❌ Error inesperado al guardar el límite.");
      setError("Error al guardar el límite");
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };


  // Activar límite
  const handleActivateLimite = async (id, nombre) => {
    if (!permissions.canUpdate) {
      window.alert("❌ No tienes permiso para activar límites geográficos.");
      return;
    }

    const confirmed = window.confirm(
      `¿Deseas activar el límite geográfico "${nombre}"?\n\nEsto desactivará cualquier otro límite activo.`
    );
    if (!confirmed) return;

    setLoading(true);
    setError(null);

    try {
      const result = await limitesService.activateLimite(id);
      if (result.success) {
        window.alert(`✔ Límite "${nombre}" activado exitosamente`);
        setSuccess(result.message);
        await loadLimites();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        window.alert(`❌ Error: ${result.message}`);
        setError(result.message);
      }
    } catch (err) {
      window.alert("❌ Error inesperado al activar el límite.");
      setError("Error al activar el límite");
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Eliminar límite
  const handleDeleteLimite = async (id, nombre) => {
    if (!permissions.canDelete) {
      window.alert("❌ No tienes permiso para eliminar límites geográficos.");
      return;
    }

    const confirmed = window.confirm(
      `¿Estás seguro de que deseas eliminar el límite "${nombre}"?`
    );
    if (!confirmed) return;

    setLoading(true); // ✅ Agregado para consistencia
    setError(null); // ✅ Agregado para limpiar errores previos

    try {
      const result = await limitesService.deleteLimite(id);
      if (result.success) {
        window.alert(`✔ Límite "${nombre}" eliminado exitosamente`);
        setSuccess(result.message);
        
        // ✅ Recargar automáticamente con spinner
        await loadLimites();
        
        setTimeout(() => setSuccess(null), 3000);
      } else {
        window.alert(`❌ Error: ${result.message}`);
        setError(result.message);
      }
    } catch (err) {
      window.alert("❌ Error inesperado al eliminar el límite.");
      setError("Error al eliminar el límite");
      console.error("Error:", err);
    } finally {
      setLoading(false); // ✅ Agregado para desactivar loading
    }
  };


  // ========================================
  // RENDER  PRINCIPAL 
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
                          Nuevo Backup
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
              {selectedSection === 'limites' && (
              <div className="content-section">
                {/* SECCIÓN: LÍMITES GEOGRÁFICOS */}
                <div className="section-header">
                  <div className="section-title-group">
                    <h2>Límites Geográficos</h2>
                    <p className="section-subtitle">
                      Gestiona los límites geográficos del sistema
                    </p>
                  </div>
                  <div style={{display: 'flex', gap: '0.5rem'}}>
                    <button
                      className="btn-secondary"
                      onClick={loadLimites}
                      disabled={loadingLimites}
                      title="Recargar lista de límites"
                    >
                      <RefreshCw className={`w-4 h-4 ${loadingLimites ? 'animate-spin' : ''}`} />
                    </button>
                    
                    {permissions.canCreate && (
                      <button 
                        className="btn-primary"
                        onClick={() => openLimiteModal()}
                        disabled={loading}
                      >
                        <Map className='w-4 h-4 mr-2'/>
                        Nuevo Límite
                      </button>
                    )}
                 </div>
                </div>

                {/* Alertas */}
                {error && (
                  <div className="alert alert-error">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                  </div>
                )}

                {success && (
                  <div className="alert alert-success">
                    <CheckCircle size={18} />
                    <span>{success}</span>
                  </div>
                )}

                {/* Información */}
                <div className="info-card">
                  <div className="info-item">
                    <span className="info-label">Total de Límites</span>
                    <span className="info-value">{limites.length}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Límite Activo</span>
                    <span className="info-value">
                      {limites.find(l => l.activo)?.nombre || 'Ninguno'}
                    </span>
                  </div>
                </div>

                {/* Lista de límites */}
                {loadingLimites ? (
                  <div className="loading-container">
                    <RefreshCw className="spinner" size={32} />
                    <p>Cargando límites...</p>
                  </div>
                ) : limites.length === 0 ? (
                  <div className="empty-state">
                    <Database size={48} />
                    <p>No hay límites geográficos configurados</p>
                    {permissions.canCreate && (
                      <button 
                        className="btn-primary"
                        onClick={() => openLimiteModal()}
                      >
                        Crear Primer Límite
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Nombre</th>
                          <th>Coordenadas</th>
                          <th>Altitud (m)</th>
                          <th>Estado</th>
                          <th>Creado</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {limites.map(limite => (
                          <tr key={limite.id}>
                            <td>
                              <div className="limite-nombre">
                                {limite.nombre}
                                
                              </div>
                            </td>
                            <td>
                              <div className="coordenadas-cell">
                                <div>N: {limite.norte}°</div>
                                <div>S: {limite.sur}°</div>
                                <div>E: {limite.este}°</div>
                                <div>O: {limite.oeste}°</div>
                              </div>
                            </td>
                            <td>
                              {limite.altitud_min !== null && limite.altitud_max !== null
                                ? `${limite.altitud_min} - ${limite.altitud_max}`
                                : 'No definida'}
                            </td>
                            <td>
                              {limite.activo ? (
                                <span className="badge badge-success flex items-center gap-1">
                                  <CheckCircle className="w-4 h-4" />
                                  Activo
                                </span>
                              ) : (
                                <span className="badge badge-inactive flex items-center gap-1">
                                  <XCircle className="w-4 h-4" />
                                  Inactivo
                                </span>
                              )}
                            </td>

                            <td>
                              {new Date(limite.creado_en).toLocaleDateString('es-EC')}
                            </td>
                            <td>
                              <div className="action-buttons">
                                {!limite.activo && permissions.canUpdate && (
                                  <button
                                    className="btn-icon btn-success"
                                    onClick={() => handleActivateLimite(limite.id, limite.nombre)}
                                    title="Activar límite"
                                  >
                                    <CheckCircle size={16} />
                                  </button>
                                )}
                                {permissions.canUpdate && (
                                  <button
                                    className="btn-icon btn-primary"
                                    onClick={() => openLimiteModal(limite)}
                                    title="Editar"
                                  >
                                    <Edit size={16} />
                                  </button>
                                )}
                                {permissions.canDelete && (
                                  <button
                                    className="btn-icon btn-danger"
                                    onClick={() => handleDeleteLimite(limite.id, limite.nombre)}
                                    title="Eliminar"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* MODAL DE CREACIÓN / EDICIÓN DE LÍMITE */}
                {showLimiteModal && (
                  <div className="modal-overlay" onClick={closeLimiteModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                      <div className="modal-header">
                        <h3>{editingLimite ? 'Editar' : 'Nuevo'} Límite Geográfico</h3>
                        <button type="button" className="btn-close" onClick={closeLimiteModal}>×</button>
                      </div>
                      
                      <form onSubmit={handleSaveLimite} className="limite-form">
                        <div className="modal-body">
                          <div className="form-group">
                            <label>Nombre del Límite *</label>
                            <input
                              type="text"
                              className="form-input"
                              value={limiteFormData.nombre}
                              onChange={(e) => setLimiteFormData({...limiteFormData, nombre: e.target.value})}
                              placeholder="Ej: Ecuador Continental"
                              required
                              minLength={3}
                              maxLength={150}
                            />
                          </div>

                          <div className="form-row">
                            <div className="form-group">
                              <label>Límite Norte (Latitud) *</label>
                              <input
                                type="number"
                                step="0.0000001"
                                min="-90"
                                max="90"
                                className="form-input"
                                value={limiteFormData.norte}
                                onChange={(e) => setLimiteFormData({...limiteFormData, norte: e.target.value})}
                                placeholder="-90 a 90"
                                required
                              />
                            </div>
                            <div className="form-group">
                              <label>Límite Sur (Latitud) *</label>
                              <input
                                type="number"
                                step="0.0000001"
                                min="-90"
                                max="90"
                                className="form-input"
                                value={limiteFormData.sur}
                                onChange={(e) => setLimiteFormData({...limiteFormData, sur: e.target.value})}
                                placeholder="-90 a 90"
                                required
                              />
                            </div>
                          </div>

                          <div className="form-row">
                            <div className="form-group">
                              <label>Límite Este (Longitud) *</label>
                              <input
                                type="number"
                                step="0.0000001"
                                min="-180"
                                max="180"
                                className="form-input"
                                value={limiteFormData.este}
                                onChange={(e) => setLimiteFormData({...limiteFormData, este: e.target.value})}
                                placeholder="-180 a 180"
                                required
                              />
                            </div>
                            <div className="form-group">
                              <label>Límite Oeste (Longitud) *</label>
                              <input
                                type="number"
                                step="0.0000001"
                                min="-180"
                                max="180"
                                className="form-input"
                                value={limiteFormData.oeste}
                                onChange={(e) => setLimiteFormData({...limiteFormData, oeste: e.target.value})}
                                placeholder="-180 a 180"
                                required
                              />
                            </div>
                          </div>

                          <div className="form-row">
                            <div className="form-group">
                              <label>Altitud Mínima (m)</label>
                              <input
                                type="number"
                                step="0.01"
                                className="form-input"
                                value={limiteFormData.altitud_min}
                                onChange={(e) => setLimiteFormData({...limiteFormData, altitud_min: e.target.value})}
                                placeholder="Opcional"
                              />
                            </div>
                            <div className="form-group">
                              <label>Altitud Máxima (m)</label>
                              <input
                                type="number"
                                step="0.01"
                                className="form-input"
                                value={limiteFormData.altitud_max}
                                onChange={(e) => setLimiteFormData({...limiteFormData, altitud_max: e.target.value})}
                                placeholder="Opcional"
                              />
                            </div>
                          </div>

                          <div className="form-group">
                            <label className="checkbox-label">
                              <input
                                type="checkbox"
                                checked={limiteFormData.activo}
                                onChange={(e) => setLimiteFormData({...limiteFormData, activo: e.target.checked})}
                              />
                              <span>Activar este límite</span>
                            </label>
                          </div>
                        </div>

                        <div className="modal-footer">
                          <button 
                            type="button"
                            className="btn-secondary" 
                            onClick={closeLimiteModal}
                            disabled={loading}
                          >
                            Cancelar
                          </button>
                          <button 
                            type="submit"
                            className="btn-primary" 
                            disabled={loading}
                          >
                            {loading ? 'Guardando...' : 'Guardar'}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}



              </div>
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