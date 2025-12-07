//src/components/RolesSection.js
/**
 * Componente para la gestión de roles y permisos del sistema
 * Permite crear, editar, eliminar roles y asignarles permisos específicos
 * Con control de permisos granular
*/
import React, { useState, useEffect, useCallback } from 'react';
import { useModal } from '../context/ModalContext';
import './RolesSection.css';

import rolesService from '../services/rolesServices';
import authService from '../services/authServices'; // 🔑 Importar authService

import {
  ShieldCheck,
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  Save,
  X,
  RefreshCw,
  AlertCircle,
  Lock,
  Unlock,
  CheckCircle,
  XCircle,
  Settings,
  Calendar,
} from 'lucide-react';

// ============================================
// COMPONENTE PRINCIPAL
// ============================================
const RolesSection = () => {
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [roleActions, setRoleActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingActions, setLoadingActions] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('create');
  const [selectedAction, setSelectedAction] = useState(null);
  const [error, setError] = useState(null);
  const [editingRoleId, setEditingRoleId] = useState(null);
  const { showConfirm, showAlert, showSuccess } = useModal();

  const [roleFormData, setRoleFormData] = useState({
    nombre_rol: '',
    descripcion: '',
    activo: true
  });

  const [actionFormData, setActionFormData] = useState({
    nombre_accion: '',
    tipo_accion: 'Operaciones CRUD',
    activo: true
  });

  // 🔑 PERMISOS DEL USUARIO ACTUAL
  const [permissions, setPermissions] = useState({
    canCreate: false,
    canRead: false,
    canUpdate: false,
    canDelete: false,
    canToggleStatus: false
  });

  const tiposAccion = [
    { value: 'Operaciones CRUD', label: 'Todas los permisos (Lectura, Crear, Actualizar y Eliminar)' },
    { value: 'Lectura', label: 'Lectura' },
    { value: 'Crear', label: 'Crear' },
    { value: 'Actualizar', label: 'Actualizar' },
    { value: 'Eliminar', label: 'Eliminar' }
  ];

  const modulosSistema = [
    { value: 'Usuarios', label: 'Usuarios' },
    { value: 'Roles', label: 'Roles' },
    { value: 'Afiliados', label: 'Afiliados' },
    { value: 'Medidores', label: 'Medidores' },
    { value: 'Sectores', label: 'Sectores' },
    { value: 'Tarifas', label: 'Tarifas' },
    { value: 'Geolocalizacion', label: 'Geolocalización' },
    { value: 'Servicios', label: 'Servicios' },

    { value: 'Lecturas', label: 'Lecturas' },
    { value: 'Facturas', label: 'Facturas' },
    { value: 'Pagos', label: 'Pagos' },
    { value: 'Multas', label: 'Multas' },
    { value: 'Configuracion', label: 'Configuración' },
    { value: 'Notificaciones', label: 'Notificaciones' },
    { value: 'Notificaciones', label: 'Notificaciones' },

  ];

  // 🔑 Cargar permisos al montar el componente
  useEffect(() => {
    loadUserPermissions();
  }, []);

  const loadUserPermissions = () => {
    // Verificar permisos sobre el módulo 'roles'
    const canCreate = authService.hasPermission('roles', 'crear') || 
                     authService.hasPermission('roles', 'crud');
    
    const canUpdate = authService.hasPermission('roles', 'actualizar') || 
                     authService.hasPermission('roles', 'crud');
    
    const canDelete = authService.hasPermission('roles', 'eliminar') || 
                     authService.hasPermission('roles', 'crud');
    
    // ✅ Si puede crear, actualizar o eliminar, también debe poder leer
    const canRead = authService.hasPermission('usuarios', 'lectura') ||
               canCreate || canUpdate || canDelete ||
               authService.hasPermission('usuarios', 'operaciones crud');
    // Permisos adicionales
    const canToggleStatus = canUpdate; // Cambiar estado requiere actualizar

    setPermissions({
      canCreate,
      canRead,
      canUpdate,
      canDelete,
      canToggleStatus
    });

    console.log('🔐 Permisos del usuario en módulo Roles:', {
      canCreate,
      canRead,
      canUpdate,
      canDelete
    });
  };

  

  const fetchRoles = useCallback(async () => {
    // 🔑 Verificar si tiene permiso de lectura
    if (!permissions.canRead) {
      setError('No tienes permiso para ver roles');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const result = await rolesService.getRoles();
      
      if (result.success) {
        setRoles(result.data);
        console.log('✅ Roles cargados:', result.data);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Error al cargar roles');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [permissions.canRead]);
  useEffect(() => {
    if (permissions.canRead) {
      fetchRoles();
    }
  }, [permissions.canRead, fetchRoles]);
  const fetchRoleActions = async (roleId) => {
    setLoadingActions(true);
    setError(null);
    
    try {
      const result = await rolesService.getRoleActions(roleId);
      
      if (result.success) {
        setRoleActions(result.data);
        console.log('✅ Acciones cargadas:', result.data);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Error al cargar acciones');
      console.error(err);
    } finally {
      setLoadingActions(false);
    }
  };

  const handleSelectRole = (role) => {
    setSelectedRole(role);
    fetchRoleActions(role.id_rol);
  };

  const openModal = (type, item = null) => {
    // 🔑 Verificar permisos antes de abrir modal
    if ((type === 'create-role' || type === 'create-action') && !permissions.canCreate) {
      alert('❌ No tienes permiso para crear roles o acciones');
      return;
    }
    if ((type === 'edit-role' || type === 'edit-action') && !permissions.canUpdate) {
      alert('❌ No tienes permiso para editar roles o acciones');
      return;
    }

    console.log('openModal llamado con:', { type, item });
    setModalType(type);
    setError(null);
    
    if (type === 'create-role') {
      setEditingRoleId(null);
      setRoleFormData({
        nombre_rol: '',
        descripcion: '',
        activo: true
      });
      setShowModal(true);
    } else if (type === 'edit-role' && item) {
      console.log('Abriendo modal de edición para rol:', item);
      setEditingRoleId(item.id_rol);
      setRoleFormData({
        nombre_rol: item.nombre_rol,
        descripcion: item.descripcion || '',
        activo: item.activo
      });
      setShowModal(true);
    } else if (type === 'create-action') {
      setActionFormData({
        nombre_accion: '',
        tipo_accion: 'Operaciones CRUD',
        activo: true
      });
      setShowModal(true);
    } else if (type === 'edit-action' && item) {
      setSelectedAction(item);
      setActionFormData({
        nombre_accion: item.nombre_accion,
        tipo_accion: item.tipo_accion,
        activo: item.activo
      });
      setShowModal(true);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setError(null);
    setSelectedAction(null);
    setEditingRoleId(null);
    setRoleFormData({
      nombre_rol: '',
      descripcion: '',
      activo: true
    });
    setActionFormData({
      nombre_accion: '',
      tipo_accion: 'Operaciones CRUD',
      activo: true
    });
  };

  const handleSubmitRole = async (e) => {
    e.preventDefault();
    setError(null);
    
    console.log('🔍 Modal Type:', modalType);
    console.log('🔍 Editing Role ID:', editingRoleId);
    console.log('🔍 Form Data:', roleFormData);
    
    try {
      let result;

      if (modalType === 'create-role') {
        if (!permissions.canCreate) {
          setError('No tienes permiso para crear roles');
          return;
        }
        result = await rolesService.createRole(roleFormData);
      } else if (modalType === 'edit-role') {
        if (!permissions.canUpdate) {
          setError('No tienes permiso para editar roles');
          return;
        }
        if (!editingRoleId) {
          setError('No hay un rol seleccionado para editar');
          return;
        }
        console.log('📝 Actualizando rol con ID:', editingRoleId);
        result = await rolesService.updateRole(editingRoleId, roleFormData);
      }

      if (result.success) {
        alert(result.message);
        await fetchRoles();
        
        // Actualizar el rol seleccionado si se editó el rol que estaba activo
        if (modalType === 'edit-role' && result.data && selectedRole?.id_rol === editingRoleId) {
          setSelectedRole(result.data);
          await fetchRoleActions(result.data.id_rol);
        }
        
        closeModal();
      } else {
        setError(result.message);
      }
    } catch (error) {
      console.error('❌ Error al guardar rol:', error);
      setError(error.message);
    }
  };

  const handleSubmitAction = async (e) => {
    e.preventDefault();
    setError(null);

    if (!selectedRole) {
      setError('Debe seleccionar un rol primero');
      return;
    }

    try {
      let result;

      if (modalType === 'create-action') {
        if (!permissions.canCreate) {
          setError('No tienes permiso para crear acciones');
          return;
        }
        result = await rolesService.createRoleAction(selectedRole.id_rol, actionFormData);
      } else if (modalType === 'edit-action' && selectedAction) {
        if (!permissions.canUpdate) {
          setError('No tienes permiso para editar acciones');
          return;
        }
        result = await rolesService.updateRoleAction(selectedAction.id_rol_accion, actionFormData);
      }

      if (result.success) {
        alert(result.message);
        await fetchRoleActions(selectedRole.id_rol);
        closeModal();
      } else {
        setError(result.message);
      }
    } catch (error) {
      console.error('Error al guardar acción:', error);
      setError(error.message);
    }
  };

  const handleDeleteRole = async (roleId) => {
    // 🔑 Verificar permisos
    if (!permissions.canDelete) {
      showAlert({
        title: "Permiso denegado",
        message: "❌ No tienes permiso para eliminar roles",
        confirmText: "Entendido"
      });
      return;
    }

    // 🔥 Confirmación personalizada
    const confirmed = await showConfirm({
      title: "Eliminar Rol",
      message: "¿Está seguro de eliminar este rol? Esta acción eliminará todas sus acciones asociadas.",
      confirmText: "Sí, eliminar rol",
      cancelText: "Cancelar"
    });

    if (!confirmed) return;

    try {
      const result = await rolesService.deleteRole(roleId);

      if (result.success) {

        // 🎉 Modal de éxito
        await showSuccess({
          title: "Rol Eliminado",
          message: result.message
        });

        // Si el rol eliminado es el seleccionado, limpiar
        if (selectedRole?.id_rol === roleId) {
          setSelectedRole(null);
          setRoleActions([]);
        }

        await fetchRoles();

      } else {
        showAlert({
          title: "Error",
          message: result.message
        });
      }

    } catch (error) {
      showAlert({
        title: "Error inesperado",
        message: "Error al eliminar rol: " + error.message
      });
    }
  };


  const handleDeleteAction = async (actionId) => {
    // 🔑 Verificar permiso
    if (!permissions.canDelete) {
      showAlert({
        title: "Permiso denegado",
        message: "❌ No tienes permiso para eliminar acciones",
        confirmText: "Entendido"
      });
      return;
    }

    // 🔥 Confirmación
    const confirmed = await showConfirm({
      title: "Eliminar Acción",
      message: "¿Está seguro de eliminar esta acción?",
      confirmText: "Sí, eliminar",
      cancelText: "Cancelar"
    });

    if (!confirmed) return;

    try {
      const result = await rolesService.deleteRoleAction(actionId);

      if (result.success) {

        await showSuccess({
          title: "Acción Eliminada",
          message: result.message
        });

        await fetchRoleActions(selectedRole.id_rol);

      } else {
        showAlert({
          title: "Error",
          message: result.message
        });
      }

    } catch (error) {
      showAlert({
        title: "Error inesperado",
        message: "Error al eliminar acción: " + error.message
      });
    }
  };


  const handleToggleActionStatus = async (actionId) => {
    // 🔑 Verificar permiso antes de cambiar estado
    if (!permissions.canToggleStatus) {
      alert('❌ No tienes permiso para cambiar el estado de acciones');
      return;
    }

    try {
      const result = await rolesService.toggleActionStatus(actionId);
      
      if (result.success) {
        await fetchRoleActions(selectedRole.id_rol);
      } else {
        alert('Error: ' + result.message);
      }
    } catch (error) {
      alert('Error al cambiar estado');
    }
  };
  // Filtrar roles según término de búsqueda
  const filteredRoles = roles.filter(role =>
    role.nombre_rol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (role.descripcion && role.descripcion.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  // datos para Estadísticas
  const stats = {
    totalRoles: roles.length,
    rolesActivos: roles.filter(r => r.activo).length,
    totalAcciones: roleActions.length,
    accionesActivas: roleActions.filter(a => a.activo).length
  };

  // 🔑 Mostrar mensaje si no tiene permiso de lectura
  if (!permissions.canRead) {
    return (
      <div className="section-placeholder">
        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
        <h2>Acceso Denegado</h2>
        <p>No tienes permiso para acceder al módulo de roles.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="section-placeholder">
        <RefreshCw className="w-16 h-16 mx-auto mb-4 text-gray-400 animate-spin" />
        <h2>Cargando Roles</h2>
        <p>Por favor espera mientras cargamos la información...</p>
      </div>
    );
  }

  if (error && roles.length === 0) {
    return (
      <div className="section-placeholder">
        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
        <h2>Error al Cargar Roles</h2>
        <p>{error}</p>
        <button onClick={fetchRoles} className="btn-primary mt-4">
          <RefreshCw className="w-4 h-4 mr-2" />
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="roles-section">
      {/* Header */}
      <div className="section-header">
        <div className="section-title">
          <ShieldCheck className="w-6 h-6 text-blue-600" />
          <h2>Gestión de Roles y Permisos</h2>
        </div>
        {/* 🔑 Botón "Nuevo Rol" solo si tiene permiso de crear */}
        {permissions.canCreate && (
          <button 
            className="btn-primary"
            onClick={() => openModal('create-role')}
          >
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Rol
          </button>
        )}
      </div>

      {/* Search */}
      <div className="filters-section">
        <div className="search-container">
          <Search className="search-icon" />
          <input
            type="text"
            placeholder="Buscar roles..."
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <button 
          className="btn-secondary"
          onClick={fetchRoles}
          title="Recargar lista"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Stats */}
      <div className="users-stats">
        <div className="stat-item">
          <ShieldCheck className="stat-icon text-blue-600" />
          <div>
            <p className="stat-label">Total Roles</p>
            <p className="stat-value">{stats.totalRoles}</p>
          </div>
        </div>

        <div className="stat-item">
          <CheckCircle className="stat-icon text-green-600" />
          <div>
            <p className="stat-label">Roles Activos</p>
            <p className="stat-value">{stats.rolesActivos}</p>
          </div>
        </div>

        <div className="stat-item">
          <Settings className="stat-icon text-purple-600" />
          <div>
            <p className="stat-label">Total Acciones</p>
            <p className="stat-value">{stats.totalAcciones}</p>
          </div>
        </div>

        <div className="stat-item">
          <Lock className="stat-icon text-amber-600" />
          <div>
            <p className="stat-label">Acciones Activas</p>
            <p className="stat-value">{stats.accionesActivas}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error mb-4">
          <AlertCircle className="w-5 h-5 mr-2" />
          {error}
        </div>
      )}

      {/* Layout de dos columnas */}
      <div className="roles-layout">
        {/* Panel de Roles (Izquierda) */}
        <div className="roles-list-panel">
          <h3 className="panel-title">
            <ShieldCheck className="w-5 h-5" />
            Roles del Sistema
          </h3>
          
          {filteredRoles.length === 0 ? (
            <div className="empty-state">
              <ShieldCheck className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p>No se encontraron roles</p>
            </div>
          ) : (
            <div className="roles-list">
              {filteredRoles.map(role => (
                <div
                  key={role.id_rol}
                  className={`role-item ${selectedRole?.id_rol === role.id_rol ? 'selected' : ''} ${!role.activo ? 'inactive' : ''}`}
                  onClick={() => handleSelectRole(role)}
                >
                  <div className="role-item-header">
                    <div className="role-item-title">{role.nombre_rol}</div>
                    <div className="role-item-actions">
                      {/* 🔑 Botón "Editar" - solo si tiene permiso de actualizar */}
                      {permissions.canUpdate && (
                        <button
                          className="action-btn edit"
                          onClick={(e) => {
                            e.stopPropagation();
                            openModal('edit-role', role);
                          }}
                          title="Editar rol"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                      {/* 🔑 Botón "Eliminar" - solo si tiene permiso de eliminar */}
                      {permissions.canDelete && (
                        <button
                          className="action-btn delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRole(role.id_rol);
                          }}
                          title="Eliminar rol"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {role.descripcion && (
                    <div className="role-item-description">{role.descripcion}</div>
                  )}
                  
                  <div className="role-item-footer">
                    <span className={`status-badge ${role.activo ? 'active' : 'inactive'}`}>
                      {role.activo ? 'Activo' : 'Inactivo'}
                    </span>
                    {role.fecha_creacion && (
                      <span className="date-badge">
                        <Calendar className="w-3 h-3" />
                        {new Date(role.fecha_creacion).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Panel de Acciones (Derecha) */}
        <div className="actions-panel">
          {selectedRole ? (
            <>
              <div className="actions-header">
                <div>
                  <h3 className="panel-title">
                    Permisos de: {selectedRole.nombre_rol}
                  </h3>
                  <p className="panel-subtitle">
                    {roleActions.length} {roleActions.length === 1 ? 'permiso configurado' : 'permisos configurados'}
                  </p>
                </div>
                {/* 🔑 Botón "Nueva Acción" solo si tiene permiso de crear */}
                {permissions.canCreate && (
                  <button
                    className="btn-primary"
                    onClick={() => openModal('create-action')}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Nueva Acción
                  </button>
                )}
              </div>

              {loadingActions ? (
                <div className="section-placeholder">
                  <RefreshCw className="w-8 h-8 mx-auto mb-2 text-blue-600 animate-spin" />
                  <p>Cargando permisos...</p>
                </div>
              ) : roleActions.length === 0 ? (
                <div className="empty-state">
                  <Lock className="w-16 h-16 text-gray-300 mx-auto mb-2" />
                  <h3>Sin permisos asignados</h3>
                  <p>Este rol no tiene permisos configurados aún.</p>
                  {permissions.canCreate && (
                    <button
                      className="btn-primary mt-4"
                      onClick={() => openModal('create-action')}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Agregar Primer Permiso
                    </button>
                  )}
                </div>
              ) : (
                <div className="actions-grid">
                  {roleActions.map(action => (
                    <div
                      key={action.id_rol_accion}
                      className={`action-card ${!action.activo ? 'inactive' : ''}`}
                    >
                      <div className="action-card-header">
                        <div className="action-info">
                          <div className="action-name">{action.nombre_accion}</div>
                          <div className="action-type">{action.tipo_accion}</div>
                        </div>
                        <div className="action-buttons">
                          {/* 🔑 Botón "Toggle Status" - solo si tiene permiso */}
                          {permissions.canToggleStatus && (
                            <button
                              className="action-btn toggle"
                              onClick={() => handleToggleActionStatus(action.id_rol_accion)}
                              title={action.activo ? 'Desactivar' : 'Activar'}
                            >
                              {action.activo ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                            </button>
                          )}
                          {/* 🔑 Botón "Editar" - solo si tiene permiso de actualizar */}
                          {permissions.canUpdate && (
                            <button
                              className="action-btn edit"
                              onClick={() => openModal('edit-action', action)}
                              title="Editar acción"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          {/* 🔑 Botón "Eliminar" - solo si tiene permiso de eliminar */}
                          {permissions.canDelete && (
                            <button
                              className="action-btn delete"
                              onClick={() => handleDeleteAction(action.id_rol_accion)}
                              title="Eliminar acción"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="action-card-footer">
                        <span className={`status-badge ${action.activo ? 'active' : 'inactive'}`}>
                          {action.activo ? (
                            <>
                              <CheckCircle className="w-3 h-3" />
                              Activo
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3" />
                              Inactivo
                            </>
                          )}
                        </span>
                        {action.fecha_asignacion && (
                          <span className="date-badge">
                            <Calendar className="w-3 h-3" />
                            {new Date(action.fecha_asignacion).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="empty-state">
              <Eye className="w-16 h-16 text-gray-300 mx-auto mb-2" />
              <h3>Selecciona un Rol</h3>
              <p>Selecciona un rol de la lista para ver y gestionar sus permisos.</p>
            </div>
          )}
        </div>
      </div>

      {/* MODALES */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>
                {modalType === 'create-role' && '➕ Crear Nuevo Rol'}
                {modalType === 'edit-role' && '✏️ Editar Rol'}
                {modalType === 'create-action' && '➕ Crear Nueva Acción'}
                {modalType === 'edit-action' && '✏️ Editar Acción'}
              </h3>
              <button className="modal-close" onClick={closeModal}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="modal-body">
              {error && (
                <div className="alert alert-error mb-4">
                  <AlertCircle className="w-5 h-5 mr-2" />
                  {error}
                </div>
              )}

              {/* FORMULARIO DE ROL */}
              {(modalType === 'create-role' || modalType === 'edit-role') && (
                <form onSubmit={handleSubmitRole} className="user-form">
                  <div className="form-grid">
                    <div className="form-group form-group-full">
                      <label>Nombre del Rol *</label>
                      <input
                        type="text"
                        required
                        value={roleFormData.nombre_rol}
                        onChange={(e) => setRoleFormData({...roleFormData, nombre_rol: e.target.value})}
                        placeholder="Ej: Administrador, Cajero, Lector..."
                      />
                    </div>

                    <div className="form-group form-group-full">
                      <label>Descripción</label>
                      <textarea
                        value={roleFormData.descripcion}
                        onChange={(e) => setRoleFormData({...roleFormData, descripcion: e.target.value})}
                        placeholder="Describe las responsabilidades de este rol..."
                        rows="3"
                      />
                    </div>

                    <div className="form-group form-group-full">
                      <label>Estado</label>
                      <select
                        value={roleFormData.activo}
                        onChange={(e) => setRoleFormData({...roleFormData, activo: e.target.value === 'true'})}
                      >
                        <option value="true">Activo</option>
                        <option value="false">Inactivo</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-actions">
                    <button type="button" className="btn-secondary" onClick={closeModal}>
                      Cancelar
                    </button>
                    <button type="submit" className="btn-primary">
                      <Save className="w-4 h-4 mr-2" />
                      {modalType === 'create-role' ? 'Crear Rol' : 'Guardar Cambios'}
                    </button>
                  </div>
                </form>
              )}

              {/* FORMULARIO DE ACCIÓN */}
              {(modalType === 'create-action' || modalType === 'edit-action') && (
                <form onSubmit={handleSubmitAction} className="user-form">
                  <div className="form-grid">
                    <div className="form-group form-group-full">
                      <label>Nombre de la Acción *</label>
                      <select
                        required
                        value={actionFormData.nombre_accion}
                        onChange={(e) => setActionFormData({...actionFormData, nombre_accion: e.target.value})}
                      >
                        <option value="">Seleccione un módulo...</option>
                        {modulosSistema.map(modulo => (
                          <option key={modulo.value} value={modulo.value}>
                            {modulo.label}
                          </option>
                        ))}
                      </select>
                      <small className="text-gray-500 mt-1">
                        💡 Selecciona el módulo y nivel de acceso
                      </small>
                    </div>

                    <div className="form-group form-group-full">
                      <label>Tipo de Acción *</label>
                      <select
                        required
                        value={actionFormData.tipo_accion}
                        onChange={(e) => setActionFormData({...actionFormData, tipo_accion: e.target.value})}
                      >
                        <option value="">Seleccione un tipo de acciones...</option>
                        {tiposAccion.map(tipo => (
                          <option key={tipo.value} value={tipo.value}>
                            {tipo.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group form-group-full">
                      <label>Estado</label>
                      <select
                        value={actionFormData.activo}
                        onChange={(e) => setActionFormData({...actionFormData, activo: e.target.value === 'true'})}
                      >
                        <option value="true">Activo</option>
                        <option value="false">Inactivo</option>
                      </select>
                    </div>

                    {selectedRole && (
                      <div className="form-group form-group-full">
                        <div className="alert alert-info">
                          <strong>Rol:</strong> {selectedRole.nombre_rol}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="form-actions">
                    <button type="button" className="btn-secondary" onClick={closeModal}>
                      Cancelar
                    </button>
                    <button type="submit" className="btn-primary">
                      <Save className="w-4 h-4 mr-2" />
                      {modalType === 'create-action' ? 'Crear Acción' : 'Guardar Cambios'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RolesSection;