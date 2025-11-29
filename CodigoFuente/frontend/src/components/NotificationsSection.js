// src/pages/NotificationsPage.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, CheckCircle, XCircle, Info, AlertTriangle,
  Trash2, Check, Filter, Search
} from 'lucide-react';
import notificationsService from '../services/notificationsService';
import authService from '../services/authServices'; // 🔥 IMPORTAR
import { MODULE_DEFINITIONS } from '../utils/modulesDefinitions'; // 🔥 IMPORTAR
import './NotificationsSection.css';

const NotificationsSection = () => {
  const [notifications, setNotifications] = useState([]);
  const [filteredNotifications, setFilteredNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('todos');
  const navigate = useNavigate();

  // ========================================
  // 🔥 OBTENER RUTA BASE DEL ROL DINÁMICAMENTE
  // ========================================
  const getRoleBasePath = () => {
    return authService.getRoleBasePath(); // Ej: /administrador
  };

  // ========================================
  // 🔥 MAPEO DE PALABRAS CLAVE A MÓDULOS (USA modulesDefinitions.js)
  // ========================================
  const keywordToModuleMap = {
    // Backups → Settings
    backup: 'settings',
    respaldo: 'settings',
    configuracion: 'settings',
    
    // Tarifas
    tarifa: 'rates',
    tarifas: 'rates',
    
    // Medidores
    medidor: 'meters',
    medidores: 'meters',
    
    // Sectores
    sector: 'sectors',
    sectores: 'sectors',
    
    // Afiliados
    afiliado: 'affiliates',
    afiliados: 'affiliates',
    
    // Usuarios
    usuario: 'users',
    usuarios: 'users',
    user: 'users',
    
    // Perfil
    perfil: 'profile',
    contraseña: 'profile',
    password: 'profile',
    
    // Roles
    rol: 'roles',
    roles: 'roles',
    permiso: 'roles',
    permisos: 'roles',
    
    // Lecturas
    lectura: 'readings',
    lecturas: 'readings',
    
    // Facturación
    factura: 'invoices',
    facturas: 'invoices',
    facturacion: 'invoices',
    
    // Pagos
    pago: 'payments',
    pagos: 'payments',
    
    // Geolocalización
    geolocalizacion: 'geolocation',
    geolocalización: 'geolocation',
    mapa: 'geolocation',
    ubicacion: 'geolocation',
    ubicación: 'geolocation',
    
    // Notificaciones
    notificacion: 'notifications',
    notificaciones: 'notifications',
    
    // Inventario
    inventario: 'inventory',
    
    // Reportes
    reporte: 'reports',
    reportes: 'reports',
    
    // Estadísticas
    estadistica: 'statistics',
    estadisticas: 'statistics',
    
    // Auditoría
    auditoria: 'audit',
    auditoría: 'audit',
    
    // Clientes
    cliente: 'customers',
    clientes: 'customers',
    
    // Multas
    multa: 'fines',
    multas: 'fines',
    
    // Cobranzas
    cobranza: 'collections',
    cobranzas: 'collections',
    
    // Cajas
    caja: 'cashboxes',
    cajas: 'cashboxes',
    
    // Servicios
    servicio: 'services',
    servicios: 'services',
    
    // Base de datos
    'base de datos': 'database',
    database: 'database'
  };

  // ========================================
  // 🔥 DETECTAR MÓDULO Y CONSTRUIR RUTA DINÁMICA
  // ========================================
  const getRouteForNotification = (notification) => {
    const text = `${notification.title || ''} ${notification.message || ''}`.toLowerCase();
    
    console.log('🔍 Analizando notificación:', {
      title: notification.title,
      message: notification.message,
      textoBusqueda: text
    });

    // Buscar palabra clave en el texto
    for (const [keyword, moduleKey] of Object.entries(keywordToModuleMap)) {
      if (text.includes(keyword)) {
        const moduleDef = MODULE_DEFINITIONS[moduleKey];
        
        if (moduleDef) {
          const roleBase = getRoleBasePath(); // /administrador
          const fullRoute = `${roleBase}/${moduleDef.path}`;
          
          console.log(`✅ Coincidencia: "${keyword}" → Módulo: ${moduleKey} → Ruta: ${fullRoute}`);
          return fullRoute;
        }
      }
    }

    // Si no encuentra nada, ir a notificaciones
    const roleBase = getRoleBasePath();
    const fallbackRoute = `${roleBase}/notifications`;
    
    console.log('⚠️ No se encontró coincidencia, redirigiendo a:', fallbackRoute);
    return fallbackRoute;
  };

  // ========================================
  // CARGAR NOTIFICACIONES
  // ========================================
  const loadNotifications = async () => {
    setLoading(true);
    try {
      const result = await notificationsService.getNotifications();
      
      if (result.success) {
        const transformed = notificationsService.transformNotifications(result.data);
        setNotifications(transformed);
        setFilteredNotifications(transformed);
      }
    } catch (error) {
      console.error('Error al cargar notificaciones:', error);
    } finally {
      setLoading(false);
    }
  };

  // ========================================
  // APLICAR FILTROS
  // ========================================
  useEffect(() => {
    let filtered = [...notifications];

    if (filterType === 'no_leido') {
      filtered = filtered.filter(n => !n.read);
    } else if (filterType === 'leido') {
      filtered = filtered.filter(n => n.read);
    }

    if (selectedType !== 'todos') {
      filtered = filtered.filter(n => n.type?.toLowerCase() === selectedType.toLowerCase());
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(n => 
        n.message?.toLowerCase().includes(query) ||
        n.title?.toLowerCase().includes(query)
      );
    }

    setFilteredNotifications(filtered);
  }, [notifications, filterType, selectedType, searchQuery]);

  // ========================================
  // 🔥 HANDLER DE CLICK EN NOTIFICACIÓN
  // ========================================
  const handleNotificationClick = async (notification) => {
    console.log('📌 Click en notificación:', notification);
    
    // Marcar como leída
    if (!notification.read) {
      const result = await notificationsService.markAsRead(notification.id_notificacion);
      
      if (result.success) {
        setNotifications(prev => 
          prev.map(n => 
            n.id === notification.id 
              ? { ...n, read: true, estado: 'leido' }
              : n
          )
        );
      }
    }

    let targetRoute = null;

    // 🔥 Si el backend manda una ruta, intentar adaptarla
    if (notification.route) {
      const routeLower = notification.route.toLowerCase();
      
      // Detectar si es una ruta antigua tipo /admin/dashboard/xxx
      if (routeLower.includes('/dashboard/')) {
        // Extraer el módulo: /admin/dashboard/settings → settings
        const parts = routeLower.split('/dashboard/');
        if (parts.length > 1) {
          const moduleSegment = parts[1].split('/')[0]; // settings
          const roleBase = getRoleBasePath();
          targetRoute = `${roleBase}/${moduleSegment}`;
          console.log(`🔄 Ruta adaptada del backend: ${notification.route} → ${targetRoute}`);
        }
      } else {
        targetRoute = notification.route;
      }
    }
    
    // Si no hay ruta válida, detectarla automáticamente
    if (!targetRoute) {
      targetRoute = getRouteForNotification(notification);
    }

    console.log("✅ Navegando a:", targetRoute);
    navigate(targetRoute);
  };

  const handleMarkAsRead = async (notificationId) => {
    const result = await notificationsService.markAsRead(notificationId);
    
    if (result.success) {
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId 
            ? { ...n, read: true, estado: 'leido' }
            : n
        )
      );
    }
  };

  const handleMarkAllAsRead = async () => {
    const result = await notificationsService.markAllAsRead();
    
    if (result.success) {
      setNotifications(prev => 
        prev.map(n => ({ ...n, read: true, estado: 'leido' }))
      );
    }
  };

  const handleDelete = async (notificationId) => {
    const result = await notificationsService.deleteNotification(notificationId);
    
    if (result.success) {
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    }
  };

  // ========================================
  // MONTAR COMPONENTE
  // ========================================
  useEffect(() => {
    loadNotifications();
  }, []);

  // ========================================
  // UTILIDADES
  // ========================================
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
      case 'sistema':
        return Info;
      case 'info':
      default:
        return Info;
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  // ========================================
  // RENDER (MANTENER TU UI ACTUAL)
  // ========================================
  return (
    <div className="notifications-section">
      {/* Header */}
      <div className="section-header">
        <div className="section-content">
          <div className="header-title">
            <Bell className="w-7 h-7" />
            <div>
              <h1>Notificaciones</h1>
              <p className="subtitle">
                {unreadCount > 0 
                  ? `${unreadCount} notificación${unreadCount > 1 ? 'es' : ''} sin leer`
                  : 'No hay notificaciones sin leer'
                }
              </p>
            </div>
          </div>

          {unreadCount > 0 && (
            <button 
              className="btn-primary"
              onClick={handleMarkAllAsRead}
            >
              <Check className="w-4 h-4" />
              Marcar todas como leídas
            </button>
          )}
        </div>
      </div>

      {/* Filtros y búsqueda */}
      <div className="filters-section">
        <div className="search-container">
          <Search className="search-icon" />
          <input
            type="text"
            placeholder="Buscar notificaciones..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filters-right">
          <div className="filter-buttons">
            <button
              className={`filter-btn ${filterType === 'todas' ? 'active' : ''}`}
              onClick={() => setFilterType('todas')}
            >
              Todas ({notifications.length})
            </button>

            <button
              className={`filter-btn ${filterType === 'no_leido' ? 'active' : ''}`}
              onClick={() => setFilterType('no_leido')}
            >
              No leídas ({unreadCount})
            </button>

            <button
              className={`filter-btn ${filterType === 'leido' ? 'active' : ''}`}
              onClick={() => setFilterType('leido')}
            >
              Leídas ({notifications.length - unreadCount})
            </button>
          </div>

          <div className="type-filters">
            <Filter className="w-4 h-4 text-gray-500" />
            <select 
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="type-select"
            >
              <option value="todos">Todos los tipos</option>
              <option value="info">Info</option>
              <option value="exito">Éxito</option>
              <option value="alerta">Alerta</option>
              <option value="error">Error</option>
              <option value="sistema">Sistema</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lista de notificaciones */}
      <div className="notifications-list-container">
        {loading ? (
          <div className="loading-state">
            <div className="spinner-large"></div>
            <p>Cargando notificaciones...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="empty-state">
            <Bell className="w-16 h-16 text-gray-300 mb-4" />
            <h3>No hay notificaciones</h3>
            <p>
              {searchQuery 
                ? 'No se encontraron resultados para tu búsqueda'
                : filterType === 'no_leido'
                ? 'No tienes notificaciones sin leer'
                : 'No hay notificaciones para mostrar'
              }
            </p>
          </div>
        ) : (
          <div className="notifications-grid">
            {filteredNotifications.map((notification) => {
              const IconComponent = getNotificationIcon(notification.type);
              
              return (
                <div 
                  key={notification.id}
                  className={`notification-card ${notification.type} ${notification.read ? 'read' : 'unread'}`}
                >
                  {!notification.read && (
                    <div className="unread-indicator"></div>
                  )}

                  <div className="card-header">
                    <div className="icon-wrapper">
                      <IconComponent className="icon" />
                    </div>
                    <div className="card-actions">
                      {!notification.read && (
                        <button
                          className="action-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsRead(notification.id);
                          }}
                          title="Marcar como leída"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        className="action-btn delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(notification.id);
                        }}
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div 
                    className="card-content"
                    onClick={() => handleNotificationClick(notification)}
                    style={{ cursor: 'pointer' }}
                  >
                    {notification.title && (
                      <h3 className="card-title">{notification.title}</h3>
                    )}
                    <p className="card-message">{notification.message}</p>
                    <div className="card-footer">
                      <span className="card-time">{notification.time}</span>
                      <span className={`card-badge ${notification.type}`}>
                        {notification.type || 'info'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsSection;
