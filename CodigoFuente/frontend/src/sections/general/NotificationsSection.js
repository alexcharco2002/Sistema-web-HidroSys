// src/sections/NotificationsSection.js
// MÓDULO DE NOTIFICACIONES - Sistema de notificación y mantenimiento programado

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Bell, 
  Plus, 
  Search, 
  Trash2, 
  Check, 
  X,
  Save,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  Settings,
  Users,
  Mail,
  Clock,
  Calendar,
  RefreshCw, Eye, FileText
} from 'lucide-react';
import notificationsService from '../../services/notificationsService';
import authService from '../../services/authServices';
import './NotificationsSection.css';

const NotificationsSection = () => {
  // ==================== ESTADOS ====================
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedNotificationIds, setSelectedNotificationIds] = useState([]);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [notificationType, setNotificationType] = useState('normal');
  
  // Estado para el modal de visualización de notificación
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);

  // Usuarios
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [sendToAll, setSendToAll] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');

  // Permisos
  const [permissions, setPermissions] = useState({
    canCreate: false,
    canRead: false,
    canUpdate: false,
    canDelete: false
  });

  // Form data notificación normal
  const [formData, setFormData] = useState({
    titulo: '',
    mensaje: '',
    tipo: 'info',
    prioridad: 'media'
  });

  // Form data mantenimiento
  const [maintenanceData, setMaintenanceData] = useState({
  titulo: 'Mantenimiento Programado del Sistema',
  mensaje: 'Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.',
  fecha_inicio_mantenimiento: '',
  fecha_fin_mantenimiento: '',
  duracion_estimada: '2 horas',
  modulos_afectados: 'Facturación, Lecturas, Pagos',
  enviar_email: false,
  prioridad: 'alta'
});



// ==================== PERMISOS ====================


useEffect(() => {
  const canCreate = authService.hasPermission('notificaciones', 'crear') || 
                   authService.hasPermission('notificaciones', 'operaciones crud');
  const canUpdate = authService.hasPermission('notificaciones', 'actualizar') || 
                   authService.hasPermission('notificaciones', 'operaciones crud');
  const canDelete = authService.hasPermission('notificaciones', 'eliminar') || 
                   authService.hasPermission('notificaciones', 'operaciones crud');
  const canRead = authService.hasPermission('notificaciones', 'lectura') || 
                 canCreate || canUpdate || canDelete || 
                 authService.hasPermission('notificaciones', 'operaciones crud');

  setPermissions({ canCreate, canRead, canUpdate, canDelete });

  console.log('🔐 Permisos en módulo Notificaciones:', { canCreate, canRead, canUpdate, canDelete });
}, []);

  // ==================== HANDLERS MEMORIZADOS ====================
  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  }, []);

 const handleMaintenanceChange = useCallback((e) => {
  const { name, value, type, checked } = e.target;
  setMaintenanceData(prev => ({
    ...prev,
    [name]: type === 'checkbox' ? checked : value
  }));
}, []);


// ==================== CARGAR DATOS ====================
const loadNotifications = useCallback(async () => {
  if (!permissions.canRead) {
    setError('No tienes permiso para ver notificaciones');
    setLoading(false);
    return;
  }

  setLoading(true);
  setError('');
  
  console.log('📡 Cargando notificaciones...');

  try {
    const result = await notificationsService.getNotifications();
    console.log('📦 Resultado del servicio:', result);
    
    if (result.success) {
      const transformed = notificationsService.transformNotifications(result.data);
      console.log('✅ Notificaciones transformadas:', transformed);
      setNotifications(transformed);
      setSelectedNotificationIds([]);
    } else {
      console.error('❌ Error del servicio:', result.message);
      setError(result.message);
    }
  } catch (error) {
    console.error('💥 Error al cargar notificaciones:', error);
    setError('Error al cargar notificaciones');
  } finally {
    setLoading(false);
  }
}, [permissions.canRead]);

// Cargar al cambiar permisos
useEffect(() => {
  if (permissions.canRead) {
    loadNotifications();
  }
}, [loadNotifications, permissions.canRead]);

// ========================================
// CALCULAR DURACIÓN AL CAMBIAR FECHAS
// ========================================
// ==================== 3. USEEFFECT DE DURACIÓN (línea ~142) ====================
useEffect(() => {
  if (maintenanceData.fecha_inicio_mantenimiento && maintenanceData.fecha_fin_mantenimiento) {
    const duracion = calcularDuracionEstimada(
      maintenanceData.fecha_inicio_mantenimiento,
      maintenanceData.fecha_fin_mantenimiento
    );
    
    if (duracion === null) {
      setMaintenanceData(prev => ({ 
        ...prev, 
        duracion_estimada: '' 
      }));
    } else {
      setMaintenanceData(prev => ({ 
        ...prev, 
        duracion_estimada: duracion 
      }));
    }
  }
}, [maintenanceData.fecha_inicio_mantenimiento, maintenanceData.fecha_fin_mantenimiento]);


  async function loadUsers() {
    setLoadingUsers(true);
    try {
      const result = await notificationsService.getActiveUsers();
      if (result.success) {
        setUsers(result.data);
      } else {
        setError(result.message);
      }
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
      setError('Error al cargar la lista de usuarios');
    } finally {
      setLoadingUsers(false);
    }
  }


  // ==================== FILTROS MEMORIZADOS ====================
  const filteredNotifications = useMemo(() => {
    return notifications.filter(notification => {
      const matchesSearch = notification.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           notification.message?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'all' || 
                           (filterStatus === 'unread' && !notification.read) || 
                           (filterStatus === 'read' && notification.read);
      const matchesType = filterType === 'all' || 
                         notification.type?.toLowerCase() === filterType.toLowerCase();
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [notifications, searchTerm, filterStatus, filterType]);

  const filteredNotificationIds = useMemo(
    () => filteredNotifications.map(notification => notification.id),
    [filteredNotifications]
  );

  const selectedVisibleCount = selectedNotificationIds.filter(id =>
    filteredNotificationIds.includes(id)
  ).length;

  const allVisibleSelected = filteredNotificationIds.length > 0 &&
    selectedVisibleCount === filteredNotificationIds.length;

  const filteredUsers = useMemo(() => {
    if (!userSearchTerm) return users;
    
    const searchLower = userSearchTerm.toLowerCase().trim();
    return users.filter(user => {
      const nombres = user.nombres?.toLowerCase() || '';
      const apellidos = user.apellidos?.toLowerCase() || '';
      const fullName = `${nombres} ${apellidos}`;
      const cedula = user.cedula?.toString() || '';
      const email = user.email?.toLowerCase() || '';
      
      return fullName.includes(searchLower) || 
             cedula.includes(searchLower) || 
             email.includes(searchLower);
    });
  }, [users, userSearchTerm]);

  // ==================== ESTADÍSTICAS MEMORIZADAS ====================
  const stats = useMemo(() => ({
    total: notifications.length,
    unread: notifications.filter(n => !n.read).length,
    read: notifications.filter(n => n.read).length,
    maintenance: notifications.filter(n => n.es_mantenimiento).length
  }), [notifications]);



  // ==================== MODAL ====================
  
  
  // Función para abrir el modal de visualización
  const handleViewNotification = (notification) => {
    setSelectedNotification(notification);
    setShowViewModal(true);
  };

  // Función para cerrar el modal de visualización
  const closeViewModal = () => {
    setShowViewModal(false);
    setSelectedNotification(null);
  };

  const openCreateModal = () => {
    if (!permissions.canCreate) {
      setError('No tienes permisos para crear notificaciones');
      return;
    }
    
    setShowModal(true);
    setError('');
    setSuccessMessage('');
    setNotificationType('normal');
    resetForm();
    loadUsers();
  };

  const closeModal = () => {
    setShowModal(false);
    setError('');
    setSuccessMessage('');
    resetForm();
  };

const resetForm = () => {
  setFormData({
    titulo: '',
    mensaje: '',
    tipo: 'info',
    prioridad: 'media'
  });
  
  setMaintenanceData({
    titulo: 'Mantenimiento Programado del Sistema',
    mensaje: 'Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.',
    fecha_inicio_mantenimiento: '',
    fecha_fin_mantenimiento: '',
    duracion_estimada: '2 horas',
    modulos_afectados: 'Facturación, Lecturas, Pagos',
    enviar_email: false,
    prioridad: 'alta'
  });
  
  setSelectedUsers([]);
  setSendToAll(false);
};

  // ==================== HANDLERS ====================
  const handleUserSelection = (userId) => {
      console.log('🔵 Clic en usuario:', userId);
      console.log('📋 Estado actual:', selectedUsers);
      
      setSelectedUsers(prev => {
          if (prev.includes(userId)) {
              // Remover
              const newState = prev.filter(id => id !== userId);
              console.log('❌ Removiendo:', newState);
              return newState;
          } else {
              // Agregar
              const newState = [...prev, userId];
              console.log('✅ Agregando:', newState);
              return newState;
          }
      });
  };

  const handleSelectAllUsers = () => {
    const filteredUserIds = filteredUsers.map(u => u.id);
    const allFilteredSelected = filteredUserIds.every(id => selectedUsers.includes(id));
    
    if (allFilteredSelected) {
      setSelectedUsers(prev => prev.filter(id => !filteredUserIds.includes(id)));
    } else {
      setSelectedUsers(prev => {
        const newIds = filteredUserIds.filter(id => !prev.includes(id));
        return [...prev, ...newIds];
      });
    }
  };

const handleSubmit = async (e) => {
  e.preventDefault();
  setError('');
  setSuccessMessage('');

  try {
    if (notificationType === 'normal') {
      if (!sendToAll && selectedUsers.length === 0) {
        setError('Debes seleccionar al menos un usuario o marcar "Enviar a todos"');
        return;
      }

      if (sendToAll) {
        const payload = { ...formData, idusuariosistema: null };
        const result = await notificationsService.createNotification(payload);
        
        if (result.success) {
          setSuccessMessage('Notificación enviada a todos los usuarios');
          setTimeout(() => {
            closeModal();
            loadNotifications();
          }, 2000);
        } else {
          setError(result.message);
        }
      } else {
        let successCount = 0;
        let errorCount = 0;

        for (const userId of selectedUsers) {
          const payload = { ...formData, idusuariosistema: userId };
          const result = await notificationsService.createNotification(payload);
          
          if (result.success) {
            successCount++;
          } else {
            errorCount++;
          }
        }

        if (errorCount === 0) {
          setSuccessMessage(`Notificación enviada a ${successCount} usuarios`);
          setTimeout(() => {
            closeModal();
            loadNotifications();
          }, 2000);
        } else {
          setError(`${successCount} enviadas, ${errorCount} fallaron`);
        }
      }
    } else {
  // MANTENIMIENTO
  if (!maintenanceData.fecha_inicio_mantenimiento) {
    setError('⚠️ Debes ingresar la fecha de inicio del mantenimiento');
    return;
  }
  
  if (maintenanceData.fecha_fin_mantenimiento) {
    const inicio = new Date(maintenanceData.fecha_inicio_mantenimiento);
    const fin = new Date(maintenanceData.fecha_fin_mantenimiento);
    
    if (fin <= inicio) {
      setError('⚠️ La fecha de fin debe ser posterior a la fecha de inicio');
      return;
    }
    
    if (!maintenanceData.duracion_estimada) {
      setError('⚠️ No se pudo calcular la duración. Verifica las fechas ingresadas');
      return;
    }
  }

  const payload = {
    titulo: maintenanceData.titulo,
    mensaje: maintenanceData.mensaje,
    fecha_inicio_mantenimiento: maintenanceData.fecha_inicio_mantenimiento,
    fecha_fin_mantenimiento: maintenanceData.fecha_fin_mantenimiento || null,
    duracion_estimada: maintenanceData.duracion_estimada || null,
    modulos_afectados: maintenanceData.modulos_afectados || null,
    enviar_email: maintenanceData.enviar_email,
    prioridad: maintenanceData.prioridad,
    tipo: 'mantenimiento',
    idusuariosistema: null
  };

  console.log('📤 Enviando mantenimiento:', payload);

  const result = await notificationsService.createMaintenance(payload);
  
  if (result.success) {
    setSuccessMessage(result.message || 'Mantenimiento programado correctamente');
    setTimeout(() => {
      closeModal();
      loadNotifications();
    }, 2000);
  } else {
    setError(result.message);
  }
}
  } catch (error) {
    console.error('❌ Error al crear notificación:', error);
    setError('Error al crear la notificación');
  }
};




  const handleMarkAllAsRead = async () => {
    const result = await notificationsService.markAllAsRead();
    if (result.success) {
      loadNotifications();
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    const result = await notificationsService.markAsRead(notificationId);
    if (result.success) {
      setNotifications(prev =>
        prev.map(notification =>
          notification.id === notificationId
            ? { ...notification, read: true, estado: 'leido' }
            : notification
        )
      );
    }
  };

  const toggleNotificationSelection = (notificationId) => {
    setSelectedNotificationIds(prev =>
      prev.includes(notificationId)
        ? prev.filter(id => id !== notificationId)
        : [...prev, notificationId]
    );
  };

  const toggleVisibleSelection = () => {
    setSelectedNotificationIds(prev => {
      if (allVisibleSelected) {
        return prev.filter(id => !filteredNotificationIds.includes(id));
      }

      return Array.from(new Set([...prev, ...filteredNotificationIds]));
    });
  };

  const handleToggleSelectionMode = () => {
    setSelectionMode(prev => {
      if (prev) {
        setSelectedNotificationIds([]);
      }

      return !prev;
    });
    setError('');
    setSuccessMessage('');
  };

  const handleBulkDelete = async (deleteAll = false) => {
    if (!permissions.canDelete) {
      setError('No tienes permisos para eliminar notificaciones');
      return;
    }

    const idsToDelete = deleteAll ? [] : selectedNotificationIds;
    if (!deleteAll && idsToDelete.length === 0) {
      setError('Selecciona al menos una notificación para eliminar');
      return;
    }

    const message = deleteAll
      ? '⚠️ ¿Estás seguro de que quieres eliminar todas tus notificaciones?\n\n🗑️ Esta acción no se puede deshacer.'
      : `🗑️ ¿Eliminar ${idsToDelete.length} notificación(es) seleccionada(s)?`;

    if (!window.confirm(message)) return;

    const result = await notificationsService.deleteNotificationsBulk(idsToDelete, deleteAll);
    if (result.success) {
      setSelectedNotificationIds([]);
      setSelectionMode(false);
      setSuccessMessage(result.message);
      loadNotifications();
      setTimeout(() => setSuccessMessage(''), 2500);
    } else {
      setError(result.message);
    }
  };

  const handleDelete = async (notificationId) => {
    if (!permissions.canDelete) {
      setError('No tienes permisos para eliminar notificaciones');
      return;
    }

    const confirmed = window.confirm('¿Estás seguro de eliminar esta notificación?');
    if (!confirmed) return;

    const result = await notificationsService.deleteNotification(notificationId);
    if (result.success) {
      loadNotifications();
    }
  };

  // ==================== UTILIDADES ====================
  
  const getNotificationIcon = (type) => {
    switch(type?.toLowerCase()) {
      case 'exito':
      case 'success':
        return CheckCircle;
      case 'alerta':
      case 'warning':
        return AlertTriangle;
      case 'error':
        return XCircle;
      case 'mantenimiento':
        return Settings;
      case 'sistema':
      case 'info':
      default:
        return Info;
    }
  };

 
  const getMinDate = () => {
    const now = new Date();
    // Agregar exactamente 24 horas (24 * 60 * 60 * 1000 milisegundos)
    const minDate = new Date(now.getTime() + (24 * 60 * 60 * 1000));
    
    // Formatear para datetime-local (YYYY-MM-DDTHH:mm)
    const year = minDate.getFullYear();
    const month = String(minDate.getMonth() + 1).padStart(2, '0');
    const day = String(minDate.getDate()).padStart(2, '0');
    const hours = String(minDate.getHours()).padStart(2, '0');
    const minutes = String(minDate.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };



// ==================== FUNCIÓN HELPER PARA FECHAS ====================
  // ========================================
  // CALCULAR DURACIÓN ESTIMADA
  // ========================================
  const calcularDuracionEstimada = (fechaInicio, fechaFin) => {
    if (!fechaInicio || !fechaFin) return '';
    
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);
    
    // Validar que fecha fin sea mayor que fecha inicio
    if (fin <= inicio) {
      return null; // Retornamos null para indicar error
    }
    
    const diffMs = fin - inicio;
    const diffMinutos = Math.floor(diffMs / (1000 * 60));
    const diffHoras = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    // Si es menos de 1 hora
    if (diffHoras < 1) {
      return `${diffMinutos} minuto${diffMinutos !== 1 ? 's' : ''}`;
    }
    
    // Si es el mismo día (menos de 24 horas)
    if (diffDias < 1) {
      return `${diffHoras}h`;
    }
    
    // Si es 1 o más días
    const horasRestantes = diffHoras % 24;
    if (horasRestantes === 0) {
      return `${diffDias} día${diffDias !== 1 ? 's' : ''}`;
    }
    
    return `${diffDias} día${diffDias !== 1 ? 's' : ''} ${horasRestantes}h`;
  };


const formatearFecha = (fechaString, incluirSegundos = false) => {
  if (!fechaString) return 'N/A';
  
  const fecha = new Date(fechaString);
  
  const opciones = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  };
  
  if (incluirSegundos) {
    opciones.second = '2-digit';
  }
  
  return fecha.toLocaleString('es-EC', opciones);
};


// ==================== RENDERIZADO ====================
  
// 🔑 Mostrar mensaje si no tiene permiso de lectura
if (!permissions.canRead) {
  return (
    <div className="section-placeholder">
      <XCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
      <h2>Acceso Denegado</h2>
      <p>No tienes permiso para acceder al módulo de notificaciones.</p>
    </div>
  );
}

// ⏳ Mostrar indicador de carga
if (loading) {
  return (
    <div className="section-placeholder">
      <RefreshCw className="w-16 h-16 mx-auto mb-4 text-gray-400 animate-spin" />
      <h2>Cargando Notificaciones</h2>
      <p>Por favor espera mientras cargamos la información...</p>
    </div>
  );
}
return (
  <div className="users-section">
    {/* ==================== ENCABEZADO ==================== */}
    <div className="section-header">
      <div className="section-title">
        <Bell className="w-7 h-7 text-blue-600" />
        <div>
          <h2>Gestión de Notificaciones</h2>
          <p className="section-subtitle">
            Gestiona las notificaciones del sistema
          </p>
        </div>
      </div>

      <div className="actions">
        {permissions.canCreate && (
          <button className="btn-primary" onClick={openCreateModal}>
            <Plus className="w-4 h-4 mr-2" />
            Crear Notificación
          </button>
        )}
        
        {stats.unread > 0 && (
          <button className="btn-secondary" onClick={handleMarkAllAsRead}>
            <Check className="w-4 h-4 mr-2" />
            Marcar todas como leídas
          </button>
        )}
        {permissions.canDelete && notifications.length > 0 && (
          <button
            className={selectionMode ? 'btn-secondary' : 'btn-danger'}
            onClick={handleToggleSelectionMode}
          >
            {selectionMode ? (
              <X className="w-4 h-4 mr-2" />
            ) : (
              <Trash2 className="w-4 h-4 mr-2" />
            )}
            {selectionMode ? 'Cancelar selección' : 'Borrar notificaciones'}
          </button>
        )}
        
      </div>
    </div>

    {/* ==================== ESTADÍSTICAS DE NOTIFICACIONES ==================== */}
    <div className="periodo-stats-container">
      {/* Header */}
      <div className="periodo-stats-header">
        <Bell className="w-5 h-5 text-blue-600 mr-2" />
        <h3>Resumen de Notificaciones</h3>
      </div>

      {/* Grid de estadísticas */}
      <div className="users-stats">
        
        {/* 📊 Total de notificaciones */}
        <div
          className={`stat-item ${filterStatus === 'all' ? 'active' : ''}`}
          onClick={() => setFilterStatus('all')}
        >
          <Bell className="stat-icon text-blue-600" />
          <div>
            <p className="stat-label">Total</p>
            <p className="stat-value">{stats.total}</p>
          </div>
        </div>

        {/* 🔴 Notificaciones no leídas */}
        <div
          className={`stat-item ${filterStatus === 'unread' ? 'active red' : ''}`}
          onClick={() => setFilterStatus('unread')}
        >
          <AlertTriangle className="stat-icon text-red-600" />
          <div>
            <p className="stat-label">No Leídas</p>
            <p className="stat-value">{stats.unread}</p>
          </div>
        </div>

        {/* ✅ Notificaciones leídas */}
        <div
          className={`stat-item ${filterStatus === 'read' ? 'active green' : ''}`}
          onClick={() => setFilterStatus('read')}
        >
          <CheckCircle className="stat-icon text-green-600" />
          <div>
            <p className="stat-label">Leídas</p>
            <p className="stat-value">{stats.read}</p>
          </div>
        </div>

        {/* ⚙️ Mantenimientos */}
        <div
          className={`stat-item ${filterType === 'mantenimiento' ? 'active purple' : ''}`}
          onClick={() => setFilterType('mantenimiento')}
        >
          <Settings className="stat-icon text-purple-600" />
          <div>
            <p className="stat-label">Mantenimientos</p>
            <p className="stat-value">{stats.maintenance}</p>
          </div>
        </div>

      </div>
    </div>

    {/* ==================== FILTROS ==================== */}
    <div className="filters-section">
      
      {/* IZQUIERDA — Barra de búsqueda */}
      <div className="search-container">
        <Search className="search-icon" />
        <input
          type="text"
          placeholder="Buscar notificaciones..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      {/* DERECHA — Agrupamos todos los filtros */}
      <div className="filters-right">
        
        {/* 📋 Filtro por estado */}
        <select 
          className="filter-select"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="all">Todas</option>
          <option value="unread">No leídas</option>
          <option value="read">Leídas</option>
        </select>

        {/* 🏷️ Filtro por tipo */}
        <select
          className="filter-select"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="all">Todos los tipos</option>
          <option value="info">Información</option>
          <option value="alerta">Alertas</option>
          <option value="error">Errores</option>
          <option value="sistema">Sistema</option>
          <option value="mantenimiento">Mantenimiento</option>
        </select>

        {/* 🔄 Recargar */}
        <button 
          className="btn-secondary"
          onClick={loadNotifications}
          title="Recargar lista"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

      </div>
    </div>

    {selectionMode && permissions.canDelete && filteredNotifications.length > 0 && (
      <div className="notifications-bulk-bar">
        <label className="notifications-select-all">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onChange={toggleVisibleSelection}
          />
          <span>
            {allVisibleSelected ? 'Deseleccionar visibles' : 'Seleccionar visibles'}
          </span>
        </label>

        <span className="notifications-selection-count">
          {selectedNotificationIds.length} seleccionada(s)
        </span>

        <button
          className="btn-danger"
          onClick={() => handleBulkDelete(false)}
          disabled={selectedNotificationIds.length === 0}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Borrar seleccionadas
        </button>
      </div>
    )}

    {/* ==================== GRID DE NOTIFICACIONES ==================== */}
    <div className="notifications-grid">
      {loading ? (
        <div className="empty-state">
          <RefreshCw className="w-16 h-16 animate-spin text-blue-600" />
          <h3>Cargando notificaciones...</h3>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="empty-state">
          <Bell className="w-16 h-16" />
          <h3>No hay notificaciones</h3>
          <p>
            {searchTerm 
              ? 'No se encontraron resultados para tu búsqueda' 
              : filterStatus === 'unread'
                ? 'No tienes notificaciones sin leer'
                : 'No hay notificaciones para mostrar'
            }
          </p>
        </div>
      ) : (
        filteredNotifications.map(notification => {
          const Icon = getNotificationIcon(notification.type);
          return (
            <div 
              key={notification.id}
              className={`notification-card ${!notification.read ? 'notification-unread' : 'notification-read'} ${
                selectedNotificationIds.includes(notification.id) ? 'notification-selected' : ''
              }`}
            >
              {selectionMode && permissions.canDelete && (
                <label className="notification-select">
                  <input
                    type="checkbox"
                    checked={selectedNotificationIds.includes(notification.id)}
                    onChange={() => toggleNotificationSelection(notification.id)}
                  />
                  <span>Seleccionar</span>
                </label>
              )}

              {/* Header de la tarjeta */}
              <div className="notification-card-header">
                <div className="notification-header-content"> 
                  <div className="notification-icon-box">
                    <Icon className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="notification-details">
                    <h3 className="notification-title">{notification.title}</h3>
                    
                    {/* NUEVA SECCIÓN: Badge de Estado (solo si no está leída) */}
                    {!notification.read && (
                      <div className="notification-status-badge">
                        <AlertTriangle className="w-3 h-3" />
                        <span>No leída</span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Acciones */}
                <div className="notification-actions">
                  <button 
                    className="action-btn view"
                    onClick={() => handleViewNotification(notification)}
                    title="Ver detalles"
                  >
                    <Eye className="w-4 h-4" />
                  </button>

                  {!notification.read && (
                    <button 
                      className="notification-action-btn btn-mark-read"
                      onClick={() => handleMarkAsRead(notification.id)}
                      title="Marcar como leída"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  
                  {permissions.canDelete && (
                    <button
                      className="action-btn delete"
                      onClick={() => handleDelete(notification.id)}
                      title="Eliminar notificación"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* NUEVA SECCIÓN: Información del Tipo */}
              <div className={`notification-type-info notification-type-${notification.type}`}>
                <div className="notification-type-label">Tipo:</div>
                <div className="notification-type-value">{notification.type}</div>
              </div>

              {/* Body de la tarjeta */}
              <div className="notification-card-body">
                <p className="notification-message">
                  {notification.message}
                </p>
                <div className="notification-footer">
                  <Clock className="w-3 h-3" />
                  <span className="notification-time">{notification.time}</span>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>


    {/* ==================== MODAL DE CREAR NOTIFICACIÓN ==================== */}
    {showModal && (
      <div className="modal-overlay" onClick={(e) => e.target.className === 'modal-overlay' && closeModal()}>
        <div className="modal modal-large">
          <div className="modal-header">
            <h3>Crear Nueva Notificación</h3>
            <button className="btn-close" onClick={closeModal}>
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="modal-body">
            {error && (
              <div className="alert alert-error mb-4">
                <AlertTriangle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            )}

            {successMessage && (
              <div className="alert alert-success mb-4">
                <CheckCircle className="w-5 h-5" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* ==================== SELECTOR DE TIPO ==================== */}
            <div className="notif-type-selector">
              <button
                type="button"
                className={`notif-type-btn ${notificationType === 'normal' ? 'notif-type-active' : ''}`}
                onClick={() => setNotificationType('normal')}
              >
                <Bell className="w-5 h-5" />
                <span>Notificación Normal</span>
              </button>
              
              <button
                type="button"
                className={`notif-type-btn ${notificationType === 'mantenimiento' ? 'notif-type-active' : ''}`}
                onClick={() => setNotificationType('mantenimiento')}
              >
                <Settings className="w-5 h-5" />
                <span>Mantenimiento Programado</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form">
              {/* NOTIFICACIÓN NORMAL */}
              {notificationType === 'normal' && (
                <>
                  <div className="form-grid">
                    <div className="form-group form-group-full">
                      <label>Título *</label>
                      <input
                        type="text"
                        name="titulo"  
                        required
                        minLength="3"
                        value={formData.titulo}
                             onChange={handleInputChange} 
                        placeholder="Título de la notificación"
                      />
                    </div>

                    <div className="form-group form-group-full">
                      <label>Mensaje *</label>
                      <textarea
                        name="mensaje"
                        required
                        minLength="5"
                        rows="4"
                        value={formData.mensaje}
                           onChange={handleInputChange}  
                        placeholder="Escribe el mensaje..."
                      />
                    </div>

                    <div className="form-group">
                      <label>Tipo</label>
                      <select
                        value={formData.tipo}
                        onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                      >
                        <option value="info">Información</option>
                        <option value="alerta">Alerta</option>
                        <option value="error">Error</option>
                        <option value="sistema">Sistema</option>
                        <option value="exito">Éxito</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Prioridad</label>
                      <select
                        value={formData.prioridad}
                        onChange={(e) => setFormData({ ...formData, prioridad: e.target.value })}
                      >
                        <option value="baja">Baja</option>
                        <option value="media">Media</option>
                        <option value="alta">Alta</option>
                        <option value="critica">Crítica</option>
                      </select>
                    </div>
                  </div>

                  {/* DESTINATARIOS */}
                  <div className="notif-recipients-section">
                    <div className="notif-recipients-title">
                      <Users className="w-5 h-5" />
                      <h4>Destinatarios</h4>
                    </div>

                    {/* CHECKBOX "ENVIAR A TODOS" */}
                    <div className="notif-checkbox-wrapper">
                      <label className="notif-checkbox-label">
                        <input
                          type="checkbox"
                          checked={sendToAll}
                          onChange={(e) => {
                            setSendToAll(e.target.checked);
                            if (e.target.checked) {
                              setSelectedUsers([]);
                            }
                          }}
                        />
                        <span>Enviar a todos los usuarios activos</span>
                      </label>
                    </div>

                    {/* SELECCIÓN INDIVIDUAL */}
                    {!sendToAll && (
                      <>
                        {/* BUSCADOR */}
                        <div className="form-group form-group-full">
                          <label>Buscar Usuario</label>
                          <div className="notif-user-search-container">
                            <div className="notif-user-search-wrapper">
                              <Search className="w-4 h-4 text-gray-400" />
                              <input
                                type="text"
                                placeholder="Buscar por nombre, apellido o cédula..."
                                value={userSearchTerm}
                                onChange={(e) => setUserSearchTerm(e.target.value)}
                              />
                              {userSearchTerm && (
                                <button
                                  type="button"
                                  onClick={() => setUserSearchTerm('')}
                                  className="notif-user-search-clear"
                                >
                                  <X className="w-4 h-4 text-gray-400" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {loadingUsers ? (
                          <div className="notif-loading-users">
                            <div className="notif-spinner-small"></div>
                            <span>Cargando usuarios...</span>
                          </div>
                        ) : (
                          <>
                            {/* HEADER CON SELECCIONAR TODOS */}
                            <div className="notif-users-header">
                              <button
                                type="button"
                                className="notif-btn-link"
                                onClick={handleSelectAllUsers}
                              >
                                {(() => {
                                  const filteredUserIds = filteredUsers.map(u => u.id);
                                  const allSelected = filteredUserIds.length > 0 && 
                                                    filteredUserIds.every(id => selectedUsers.includes(id));
                                  return allSelected ? 'Deseleccionar todos' : 'Seleccionar todos';
                                })()}
                              </button>
                              <span className="notif-selected-count">
                                {selectedUsers.length} de {filteredUsers.length} usuario{filteredUsers.length !== 1 ? 's' : ''}
                              </span>
                            </div>

                            {/* LISTA DE USUARIOS */}
                            <div className="notif-users-list">
                              {filteredUsers.map(user => (
                                <div 
                                  key={user.id} 
                                  className="notif-user-item"
                                  onClick={() => {
                                    console.log('🔵 Clic en usuario ID:', user.id);
                                    handleUserSelection(user.id);
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedUsers.includes(user.id)}
                                    onChange={() => {}}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <div className="notif-user-info">
                                    <span className="notif-user-name">
                                      {user.nombres} {user.apellidos}
                                      {user.cedula && (
                                        <span className="notif-user-cedula"> • CI: {user.cedula}</span>
                                      )}
                                    </span>
                                    <span className="notif-user-email">{user.email}</span>
                                  </div>
                                </div>
                              ))}
                              
                              {filteredUsers.length === 0 && (
                                <div className="notif-empty-state">
                                  <Users className="w-12 h-12" />
                                  <p>No se encontraron usuarios con ese criterio</p>
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>

                </>
              )}

              {/* MANTENIMIENTO PROGRAMADO */}
              {notificationType === 'mantenimiento' && (
                <>
                  <div className="alert alert-info mb-4">
                    <Info className="w-5 h-5" />
                    <span>El mantenimiento se notificará a todos los usuarios con al menos 24 horas de anticipación</span>
                  </div>

                  <div className="form-grid">
                    <div className="form-group form-group-full">
                      <label>Título *</label>
                      <input
                        type="text"
                        name="titulo"
                        required
                        value={maintenanceData.titulo}
                        onChange={handleMaintenanceChange}
                        placeholder="Ej: Mantenimiento de Servidores"
                      />
                    </div>

                    <div className="form-group form-group-full">
                      <label>Descripción *</label>
                      <textarea
                        name="mensaje"
                        required
                        rows="4"
                        value={maintenanceData.mensaje}
                        onChange={handleMaintenanceChange}
                        placeholder="Describe las actividades de mantenimiento..."
                      />
                    </div>
                    <div className="form-group">
                      <label>Fecha y Hora de Inicio *</label>
                      <input
                        type="datetime-local"
                        name="fecha_inicio_mantenimiento"
                        required
                        min={getMinDate()}
                        value={maintenanceData.fecha_inicio_mantenimiento}
                        onChange={handleMaintenanceChange}
                      />
                      <small>Mínimo 24 horas en el futuro</small>
                    </div>

                    <div className="form-group">
                      <label>Fecha y Hora de Fin</label>
                     <input
                        type="datetime-local"
                        name="fecha_fin_mantenimiento"
                        value={maintenanceData.fecha_fin_mantenimiento}
                        onChange={handleMaintenanceChange}
                      />
                      <small>Opcional</small>
                    </div>



                    <div className="form-group">
                      <label>Duración Estimada</label>
                      <div className="input-readonly-wrapper">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={maintenanceData.duracionestimada || 'Ingresa fecha inicio y fin'}
                          readOnly
                          disabled
                          className="input-readonly"
                          placeholder="Se calculará automáticamente"
                        />
                      </div>
                      <small className="text-muted">
                        Se calcula automáticamente según las fechas
                      </small>
                    </div>



                    <div className="form-group">
                      <label>Prioridad</label>
                      <select
                        value={maintenanceData.prioridad}
                        onChange={handleMaintenanceChange}
                      >
                        <option value="baja">Baja</option>
                        <option value="media">Media</option>
                        <option value="alta">Alta</option>
                        <option value="critica">Crítica</option>
                      </select>
                    </div>

                    <div className="form-group form-group-full">
                      <label>Módulos Afectados</label>
                        <input
                          type="text"
                          name="modulos_afectados"
                          value={maintenanceData.modulos_afectados}
                          onChange={handleMaintenanceChange}
                          placeholder="Ej: Facturación, Lecturas, Reportes"
                        />
                      <small>Separa con comas los módulos afectados</small>
                    </div>

                    <div className="form-group form-group-full">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={maintenanceData.enviar_email}
                          onChange={handleMaintenanceChange}

                        />
                        <Mail className="w-4 h-4" />
                        <span>Enviar notificación por correo electrónico</span>
                      </label>
                    </div>
                  </div>
                </>
              )}

              {/* ACCIONES */}
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={closeModal}>
                  <X className="w-4 h-4" />
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  <Save className="w-4 h-4" />
                  {notificationType === 'normal' ? 'Enviar Notificación' : 'Programar Mantenimiento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    )}

    {/* ==================== MODAL DE VISUALIZACIÓN DE NOTIFICACIÓN ==================== */}
    {showViewModal && selectedNotification && (
      <div className="modal-overlay" onClick={(e) => e.target.className === 'modal-overlay' && closeViewModal()}>
        <div className="modal modal-large">
          <div className="modal-header">
            <div className="modal-header-content">
              {(() => {
                const Icon = getNotificationIcon(selectedNotification.type);
                return <Icon className="w-6 h-6 text-blue-600" />;
              })()}
              <h3>{selectedNotification.title}</h3>
            </div>
            <button className="btn-close" onClick={closeViewModal}>
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="modal-body">
            {/* BADGES DE ESTADO Y TIPO */}
            <div className="notif-view-badges">
              <span className={`notif-view-badge notif-view-badge-type notif-view-type-${selectedNotification.type}`}>
                {selectedNotification.type}
              </span>
              <span className={`notif-view-badge notif-view-badge-priority notif-view-priority-${selectedNotification.prioridad}`}>
                Prioridad: {selectedNotification.prioridad}
              </span>
              {!selectedNotification.read && (
                <span className="notif-view-badge notif-view-badge-unread">
                  <AlertTriangle className="w-3 h-3" />
                  No leída
                </span>
              )}
            </div>


            {/* INFORMACIÓN BÁSICA */}
            <div className="notification-view-section">
              <h4 className="notification-view-section-title">
                <Info className="w-5 h-5" />
                Mensaje
              </h4>
              <p className="notification-view-message">{selectedNotification.message}</p>
            </div>

            {/* DETALLES ESPECÍFICOS SEGÚN TIPO */}
            {selectedNotification.es_mantenimiento ? (
              // VISTA PARA MANTENIMIENTO
              <>
                <div className="notification-view-section">
                  <h4 className="notification-view-section-title">
                    <Settings className="w-5 h-5" />
                    Detalles del Mantenimiento
                  </h4>
                  
                  <div className="notification-details-grid">

                    {selectedNotification.fecha_inicio_mantenimiento && (
                      <div className="notification-detail-item">
                        <span className="detail-label">Fecha de inicio:</span>
                        <span className="detail-value">
                          <Calendar className="w-4 h-4" />
                          {formatearFecha(selectedNotification.fecha_inicio_mantenimiento)}
                        </span>
                      </div>
                    )}

                    {selectedNotification.fecha_fin_mantenimiento && (
                      <div className="notification-detail-item">
                        <span className="detail-label">Fecha de finalización:</span>
                        <span className="detail-value">
                          <Calendar className="w-4 h-4" />
                          {formatearFecha(selectedNotification.fecha_fin_mantenimiento)}
                        </span>
                      </div>
                    )}

                    {selectedNotification.duracion_estimada && (
                      <div className="notification-detail-item">
                        <span className="detail-label">Duración estimada:</span>
                        <span className="detail-value">
                          <Clock className="w-4 h-4" />
                          {selectedNotification.duracion_estimada}
                        </span>
                      </div>
                    )}

                    {selectedNotification.modulos_afectados && (
                      <div className="notification-detail-item notification-detail-full">
                        <span className="detail-label">Módulos afectados:</span>
                        <div className="detail-value">
                          <div className="modules-list">
                            {selectedNotification.modulos_afectados.split(',').map((modulo, idx) => (
                              <span key={idx} className="module-badge">
                                {modulo.trim()}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              // VISTA PARA NOTIFICACIÓN NORMAL
              <div className="notification-view-section">
                <h4 className="notification-view-section-title">
                  <FileText className="w-5 h-5" />
                  Información Adicional
                </h4>
                
                <div className="notification-details-grid">

                  <div className="notification-detail-item">
                    <span className="detail-label">Estado:</span>
                    <span className="detail-value">
                      {selectedNotification.read ? 'Leída' : 'No leída'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* INFORMACIÓN TEMPORAL */}
            <div className="notification-view-section">
              <h4 className="notification-view-section-title">
                <Clock className="w-5 h-5" />
                Información Temporal
              </h4>
              
              <div className="notification-details-grid">
                <div className="notification-detail-item">
                  <span className="detail-label">Recibida:</span>
                  <span className="detail-value">{selectedNotification.time}</span>
                </div>

                <div className="notification-detail-item">
                  <span className="detail-label">Fecha y hora:</span>
                  <span className="detail-value">
                    {formatearFecha(selectedNotification.timestamp, true)}
                  </span>
                </div>
              </div>
            </div>




            {/* ACCIONES DEL MODAL */}
            <div className="notification-view-actions">
              {!selectedNotification.read && (
                <button 
                  className="btn-primary"
                  onClick={() => {
                    handleMarkAsRead(selectedNotification.id);
                    closeViewModal();
                  }}
                >
                  <Check className="w-4 h-4" />
                  Marcar como leída
                </button>
              )}
              
              {permissions.canDelete && (
                <button
                  className="btn-danger"
                  onClick={() => {
                    handleDelete(selectedNotification.id);
                    closeViewModal();
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar
                </button>
              )}
              
              <button className="btn-secondary" onClick={closeViewModal}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

  </div>
);

};


export default NotificationsSection;
