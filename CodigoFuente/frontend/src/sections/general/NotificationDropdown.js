// src/sections/NotificationDropdown.js
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCircle, XCircle, Info, AlertTriangle, Check, Trash2 } from 'lucide-react';
import notificationsService from '../../services/notificationsService';
import authService from '../../services/authServices'; 
import { MODULE_DEFINITIONS } from '../../utils/modulesDefinitions'; 
import './NotificationDropdown.css';

const NotificationDropdown = ({ onViewAll }) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const notificationRef = useRef(null);
  const navigate = useNavigate();

  // ======================================== 
  // 🔥 OBTENER RUTA BASE DEL ROL DINÁMICAMENTE
  // ========================================
  const getRoleBasePath = () => {
    return authService.getRoleBasePath(); // Ej: /administrador
  };

  // ======================================== 
  // CARGAR NOTIFICACIONES
  // ========================================
  const loadNotifications = async () => {
    setLoading(true);
    try {
      const result = await notificationsService.getNotifications();
      if (result.success) {
        const transformedNotifications = notificationsService.transformNotifications(result.data);
        setNotifications(transformedNotifications);
        
        const unread = transformedNotifications.filter(n => !n.read).length;
        setUnreadCount(unread);
      } else {
        console.error('Error cargando notificaciones:', result.message);
      }
    } catch (error) {
      console.error('Error al cargar notificaciones:', error);
    } finally {
      setLoading(false);
    }
  };

  // ======================================== 
  // 🔥 MAPEO DE PALABRAS CLAVE A MÓDULOS
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

    // Buscar palabra clave en el texto
    for (const [keyword, moduleKey] of Object.entries(keywordToModuleMap)) {
      if (text.includes(keyword)) {
        const moduleDef = MODULE_DEFINITIONS[moduleKey];
        
        if (moduleDef) {
          const roleBase = getRoleBasePath();
          const fullRoute = `${roleBase}/${moduleDef.path}`;
          
          console.log(`✅ Dropdown - Coincidencia: "${keyword}" → Módulo: ${moduleKey} → Ruta: ${fullRoute}`);
          return fullRoute;
        }
      }
    }

    // Si no encuentra nada, ir a notificaciones
    const roleBase = getRoleBasePath();
    const fallbackRoute = `${roleBase}/notifications`;
    
    console.log('⚠️ Dropdown - No se encontró coincidencia, redirigiendo a:', fallbackRoute);
    return fallbackRoute;
  };

  // ======================================== 
  // 🔥 MARCAR COMO LEÍDA Y NAVEGAR
  // ========================================
  const handleNotificationClick = async (notification) => {
    try {
      console.log('📌 Dropdown - Click en notificación:', notification);

      // Si no está leída, marcarla como leída
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
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      }

      // Cerrar dropdown
      setShowNotifications(false);

      let targetRoute = null;

      // 🔥 Si el backend manda una ruta, intentar adaptarla
      if (notification.route) {
        const routeLower = notification.route.toLowerCase();
        
        // Detectar si es una ruta antigua tipo /admin/dashboard/xxx
        if (routeLower.includes('/dashboard/')) {
          const parts = routeLower.split('/dashboard/');
          if (parts.length > 1) {
            const moduleSegment = parts[1].split('/')[0];
            const roleBase = getRoleBasePath();
            targetRoute = `${roleBase}/${moduleSegment}`;
            
            console.log(`🔄 Dropdown - Ruta adaptada del backend: ${notification.route} → ${targetRoute}`);
          }
        } else {
          targetRoute = notification.route;
        }
      }

      // Si no hay ruta válida, detectarla automáticamente
      if (!targetRoute) {
        targetRoute = getRouteForNotification(notification);
      }

      console.log("✅ Dropdown - Navegando a:", targetRoute);
      navigate(targetRoute);
      
    } catch (error) {
      console.error('Error al manejar clic en notificación:', error);
    }
  };

  // ======================================== 
  // MARCAR TODAS COMO LEÍDAS
  // ========================================
  const handleMarkAllAsRead = async () => {
    try {
      const result = await notificationsService.markAllAsRead();
      if (result.success) {
        setNotifications(prev =>
          prev.map(n => ({ ...n, read: true, estado: 'leido' }))
        );
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error al marcar todas como leídas:', error);
    }
  };

  // ======================================== 
  // ELIMINAR NOTIFICACIÓN
  // ========================================
  const handleDeleteNotification = async (e, notificationId) => {
    e.stopPropagation();
    
    try {
      const result = await notificationsService.deleteNotification(notificationId);
      if (result.success) {
        setNotifications(prev => {
          const filtered = prev.filter(n => n.id !== notificationId);
          const unread = filtered.filter(n => !n.read).length;
          setUnreadCount(unread);
          return filtered;
        });
      }
    } catch (error) {
      console.error('Error al eliminar notificación:', error);
    }
  };

  const handleDeleteVisibleNotifications = async () => {
    const notificationIds = notifications.slice(0, 5).map(notification => notification.id);
    if (notificationIds.length === 0) return;

    const confirmed = window.confirm(
      '⚠️ ¿Estás seguro de que quieres eliminar las notificaciones mostradas en este panel?\n\n🗑️ Esta acción no se puede deshacer.'
    );
    if (!confirmed) return;

    try {
      const result = await notificationsService.deleteNotificationsBulk(notificationIds, false);
      if (result.success) {
        setNotifications(prev => {
          const filtered = prev.filter(n => !notificationIds.includes(n.id));
          const unread = filtered.filter(n => !n.read).length;
          setUnreadCount(unread);
          return filtered;
        });
      }
    } catch (error) {
      console.error('Error al eliminar las notificaciones mostradas:', error);
    }
  };

  // ======================================== 
  // 🔥 VER TODAS LAS NOTIFICACIONES
  // ========================================
  const handleViewAll = () => {
    setShowNotifications(false);
    if (onViewAll) {
      onViewAll();
    } else {
      const roleBase = getRoleBasePath();
      navigate(`${roleBase}/notifications`);
    }
  };

  // ======================================== 
  // EFECTOS
  // ========================================
  useEffect(() => {
    loadNotifications();
    
    notificationsService.startPolling(30, (count) => {
      setUnreadCount(count);
    });
    
    return () => {
      notificationsService.stopPolling();
    };
  }, []);

  useEffect(() => {
    if (showNotifications) {
      loadNotifications();
    }
  }, [showNotifications]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };

    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  // ======================================== 
  // OBTENER ICONO SEGÚN TIPO
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

  const unreadNotifications = notifications.filter(n => !n.read);
  const hasUnread = unreadNotifications.length > 0;
  const visibleNotifications = notifications.slice(0, 5);

  // ======================================== 
  // RENDER 
  // ========================================
  return (
    <div className="notification-container" ref={notificationRef}>
      
      {/* Botón de notificaciones */}
      <button
        className={`notification-btn ${hasUnread ? 'has-unread' : ''}`}
        onClick={() => setShowNotifications(!showNotifications)}
        aria-label="Notificaciones"
      >
        <Bell className={`w-5 h-5 ${hasUnread ? 'text-blue-600' : 'text-gray-600'}`} />
        {unreadCount > 0 && (
          <span className="notification-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* PANEL / DROPDOWN */}
      {showNotifications && (
        <div className="notification-dropdown">
          
          {/* Header */}
          <div className="notification-header">
            <div className="flex items-center justify-between w-full">
              
              <div className="flex items-center gap-2">
                <h3>Notificaciones</h3>

                {unreadNotifications.length > 0 && (
                  <span className="notification-count">
                    {unreadNotifications.length}
                  </span>
                )}
              </div>

              <div className="notification-header-actions">
              {unreadNotifications.length > 0 && (
                <button
                  className="btn-mark-all-read"
                  onClick={handleMarkAllAsRead}
                  title="Marcar todas como leídas"
                >
                  <Check className="w-4 h-4" />
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  className="btn-delete-all-notifications"
                  onClick={handleDeleteVisibleNotifications}
                  title="Eliminar las mostradas"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              </div>
            </div>
          </div>

          {/* Lista */}
          <div className="notification-list">
            {loading ? (
              <div className="notification-loading">
                <div className="spinner"></div>
                <p>Cargando notificaciones...</p>
              </div>
            ) : visibleNotifications.length === 0 ? (
              <div className="notification-empty">
                <Bell className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                No hay notificaciones
              </div>
            ) : (
              visibleNotifications.map((notification) => {
                const Icon = getNotificationIcon(notification.type);

                return (
                  <div
                    key={notification.id}
                    className={`notification-item ${notification.type} ${
                      notification.read ? 'read' : 'unread'
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    {/* Icono */}
                    <div className="notification-icon-wrapper">
                      <Icon className="notification-icon" />
                    </div>

                    {/* Contenido */}
                    <div className="notification-content">
                      <div className="notification-title">{notification.title}</div>
                      <div className="notification-message">{notification.message}</div>
                      <div className="notification-time">{notification.time}</div>
                    </div>

                    {/* Indicador de no leído */}
                    {!notification.read && <div className="notification-dot"></div>}

                    {/* Botón borrar */}
                    <button
                      className="notification-delete"
                      onClick={(e) => handleDeleteNotification(e, notification.id)}
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="notification-footer">
              <button className="btn-view-all" onClick={handleViewAll}>
                Ver todas las notificaciones
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );

};

export default NotificationDropdown;
