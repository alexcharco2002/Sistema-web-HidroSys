// src/components/NotificationDropdown.js
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, 
  CheckCircle, 
  XCircle,
  Info,
  AlertTriangle,
  Check,
  Trash2
} from 'lucide-react';
import notificationsService from '../services/notificationsService';
import './NotificationDropdown.css';

const NotificationDropdown = ({ onViewAll }) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const notificationRef = useRef(null);
  const navigate = useNavigate();

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
        
        // Actualizar contador de no leídas
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
  // MAPEO DE RUTAS (igual que NotificationsSection)
  // ========================================
  const notificationRouteMap = {
    // Backups → Settings (Configuración)
    backup: "/admin/dashboard/settings",
    respaldo: "/admin/dashboard/settings",
    
    // Tarifas → Rates
    tarifa: "/admin/dashboard/rates",
    tarifas: "/admin/dashboard/rates",
    
    // Medidores → Meters
    medidor: "/admin/dashboard/meters",
    medidores: "/admin/dashboard/meters",
    
    // Sectores → Sectors
    sector: "/admin/dashboard/sectors",
    sectores: "/admin/dashboard/sectors",
    
    // Afiliados → Affiliates
    afiliado: "/admin/dashboard/affiliates",
    afiliados: "/admin/dashboard/affiliates",
    
    // Usuarios → Users
    usuario: "/admin/dashboard/users",
    usuarios: "/admin/dashboard/users",
    user: "/admin/dashboard/users",
    
    // Perfil → Profile
    perfil: "/admin/dashboard/profile",
    contraseña: "/admin/dashboard/profile",
    password: "/admin/dashboard/profile",
    
    // Roles y Permisos
    rol: "/admin/dashboard/roles",
    roles: "/admin/dashboard/roles",
    permiso: "/admin/dashboard/roles",
    permisos: "/admin/dashboard/roles",
    
    // Geolocalización
    geolocalizacion: "/admin/dashboard/geolocation",
    geolocalización: "/admin/dashboard/geolocation",
    mapa: "/admin/dashboard/geolocation",
    ubicacion: "/admin/dashboard/geolocation",
    ubicación: "/admin/dashboard/geolocation",
    
    // Notificaciones
    notificacion: "/admin/dashboard/notifications",
    notificaciones: "/admin/dashboard/notifications"
  };

  const getRouteForNotification = (notification) => {
    // Combinar título y mensaje para buscar palabras clave
    const text = `${notification.title || ''} ${notification.message || ''}`.toLowerCase();
    
    console.log('🔍 Dropdown - Analizando notificación:', {
      title: notification.title,
      message: notification.message,
      textoBusqueda: text
    });

    // Buscar coincidencias en el texto
    for (const [keyword, route] of Object.entries(notificationRouteMap)) {
      if (text.includes(keyword)) {
        console.log(`✅ Dropdown - Coincidencia encontrada: "${keyword}" → ${route}`);
        return route;
      }
    }

    // Si no encuentra nada específico, ir a notificaciones
    console.log('⚠️ Dropdown - No se encontró coincidencia, yendo a notificaciones');
    return "/admin/dashboard/notifications";
  };

  // ========================================
  // MARCAR COMO LEÍDA Y NAVEGAR
  // ========================================
  const handleNotificationClick = async (notification) => {
    try {
      console.log('📌 Dropdown - Click en notificación:', notification);

      // Si no está leída, marcarla como leída
      if (!notification.read) {
        const result = await notificationsService.markAsRead(notification.id_notificacion);
        
        if (result.success) {
          // Actualizar estado local
          setNotifications(prev => 
            prev.map(n => 
              n.id === notification.id 
                ? { ...n, read: true, estado: 'leido' }
                : n
            )
          );
          
          // Decrementar contador
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      }

      // Cerrar dropdown
      setShowNotifications(false);

      // Determinar ruta de navegación
      let targetRoute = null;

      // Si viene con ruta desde backend
      if (notification.route) {
        const routeLower = notification.route.toLowerCase();

        // Si el backend manda /dashboard para backups → redirigir correctamente
        if (routeLower === "/dashboard" || routeLower === "dashboard") {
          console.log("🚫 Dropdown - Ruta del backend ignorada (backup mal formateado)");
          targetRoute = "/admin/dashboard/settings";
        } else {
          console.log('🎯 Dropdown - Usando ruta del backend:', notification.route);
          targetRoute = notification.route;
        }
      } else {
        // Detectar ruta automáticamente según el contenido
        targetRoute = getRouteForNotification(notification);
        console.log("🎯 Dropdown - Ruta detectada automáticamente:", targetRoute);
      }

      // Asegurar que siempre sea una ruta absoluta
      const finalRoute = targetRoute.startsWith("/") 
        ? targetRoute 
        : `/admin/dashboard/${targetRoute}`;

      console.log("✅ Dropdown - Navegando a:", finalRoute);
      navigate(finalRoute);

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
        // Actualizar todas las notificaciones localmente
        setNotifications(prev => 
          prev.map(n => ({ ...n, read: true, estado: 'leido' }))
        );
        
        // Resetear contador
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
    e.stopPropagation(); // Evitar que se active el clic de navegación
    
    try {
      const result = await notificationsService.deleteNotification(notificationId);
      
      if (result.success) {
        // Remover de la lista local
        setNotifications(prev => {
          const filtered = prev.filter(n => n.id !== notificationId);
          
          // Actualizar contador
          const unread = filtered.filter(n => !n.read).length;
          setUnreadCount(unread);
          
          return filtered;
        });
      }
    } catch (error) {
      console.error('Error al eliminar notificación:', error);
    }
  };

  // ========================================
  // VER TODAS LAS NOTIFICACIONES
  // ========================================
  const handleViewAll = () => {
    setShowNotifications(false);
    if (onViewAll) {
      onViewAll();
    } else {
      // Si no hay callback, navegar directamente
      navigate('/admin/dashboard/notifications');
    }
  };

  // ========================================
  // EFECTOS
  // ========================================
  
  // Cargar notificaciones al montar
  useEffect(() => {
    loadNotifications();
    
    // Iniciar polling cada 30 segundos
    notificationsService.startPolling(30, (count) => {
      setUnreadCount(count);
    });

    // Limpiar al desmontar
    return () => {
      notificationsService.stopPolling();
    };
  }, []);

  // Recargar cuando se abre el dropdown
  useEffect(() => {
    if (showNotifications) {
      loadNotifications();
    }
  }, [showNotifications]);

  // Cerrar dropdown al hacer clic fuera
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

  // ========================================
  // FILTRAR NOTIFICACIONES NO LEÍDAS
  // ========================================
  const unreadNotifications = notifications.filter(n => !n.read);
  const hasUnread = unreadNotifications.length > 0;

  // ========================================
  // RENDER
  // ========================================
  return (
    <div className="notification-container" ref={notificationRef}>
      {/* Botón de notificaciones */}
      <button 
        className="notification-btn"
        onClick={() => setShowNotifications(!showNotifications)}
        title="Notificaciones"
      >
        <Bell className={`w-5 h-5 ${hasUnread ? 'text-blue-600' : 'text-gray-600'}`} />
        {unreadCount > 0 && (
          <span className="notification-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      
      {/* Dropdown de notificaciones */}
      {showNotifications && (
        <div className="notification-dropdown">
          {/* Header */}
          <div className="notification-header">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <h3>Notificaciones</h3>
                {unreadCount > 0 && (
                  <span className="notification-count">{unreadCount}</span>
                )}
              </div>
              
              {unreadCount > 0 && (
                <button
                  className="btn-mark-all-read"
                  onClick={handleMarkAllAsRead}
                  title="Marcar todas como leídas"
                >
                  <Check className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          
          {/* Lista de notificaciones */}
          <div className="notification-list">
            {loading ? (
              <div className="notification-loading">
                <div className="spinner"></div>
                <p>Cargando notificaciones...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="notification-empty">
                <Bell className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p>No hay notificaciones</p>
              </div>
            ) : (
              notifications.map((notification) => {
                const IconComponent = getNotificationIcon(notification.type);
                return (
                  <div 
                    key={notification.id} 
                    className={`notification-item ${notification.type} ${notification.read ? 'read' : 'unread'}`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    {/* Icono */}
                    <div className="notification-icon-wrapper">
                      <IconComponent className="notification-icon" />
                    </div>
                    
                    {/* Contenido */}
                    <div className="notification-content">
                      {notification.title && (
                        <p className="notification-title">{notification.title}</p>
                      )}
                      <p className="notification-message">{notification.message}</p>
                      <span className="notification-time">{notification.time}</span>
                    </div>
                    
                    {/* Indicador de no leída */}
                    {!notification.read && (
                      <div className="notification-dot"></div>
                    )}
                    
                    {/* Botón eliminar */}
                    <button
                      className="notification-delete"
                      onClick={(e) => handleDeleteNotification(e, notification.id)}
                      title="Eliminar notificación"
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
              <button 
                className="btn-view-all"
                onClick={handleViewAll}
              >
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