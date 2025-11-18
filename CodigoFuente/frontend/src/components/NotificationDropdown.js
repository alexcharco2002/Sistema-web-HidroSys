// src/components/NotificationDropdown.js
import React, { useState, useEffect, useRef } from 'react';
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

const NotificationDropdown = ({onViewAll, setActiveSection,
  organizedModules,
  setExpandedCategories}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const notificationRef = useRef(null);
  const onViewAllRef = useRef(onViewAll);
  const setActiveSectionref = useRef(setActiveSection);
  const organizedModulesref = useRef(organizedModules);
  const setExpandedCategoriesref = useRef(setExpandedCategories);

  
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
// MAPEO DE TIPOS Y PALABRAS CLAVE → SECCIONES
// ========================================
const routeMap = {
  usuario: 'users',
  sector: 'sectors',
  medidor: 'meters',
  lectura: 'readings',
  factura: 'invoices',
  pago: 'payments',
  reporte: 'reports',
  auditoria: 'audit',
  sistema: 'settings',
  notificacion: 'notifications',

   // Por texto en el mensaje
      'usuario creado': 'users',
      'usuario modificado': 'users',
      'usuario eliminado': 'users',
      'sector creado': 'sectors',
      'sector modificado': 'sectors',
      'sector eliminado': 'sectors',
      'medidor instalado': 'meters',
      'lectura registrada': 'readings',
      'factura generada': 'invoices',
      'pago recibido': 'payments',
      'reporte generado': 'reports',
};


  // ========================================
  // MARCAR COMO LEÍDA Y NAVEGAR
  // ========================================
  const handleNotificationClick = async (notification) => {
    try {
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

      // Navegar a la ruta correspondiente
      //if (notification.route) {
      //  navigate(notification.route);
      //}
       // ============================
    // 🔁 Determinar módulo destino
    // ============================
    const tipo = notification.type?.toLowerCase() || '';
    const mensaje = notification.message?.toLowerCase() || '';

    let targetSection = null;

    // Buscar por tipo o palabra clave
    for (const key of Object.keys(routeMap)) {
      if (tipo.includes(key) || mensaje.includes(key)) {
        targetSection = routeMap[key];
        break;
      }
    }

    // Si no encuentra coincidencia → ir a notificaciones
    if (!targetSection) targetSection = 'notifications';

    // Cambiar sección activa
    setActiveSectionref(targetSection);

    // Expandir categoría si aplica
    const targetCategory = organizedModulesref.find(
      mod => mod.id === targetSection
    )?.category;

    if (targetCategory) {
      setExpandedCategoriesref(prev => ({
        ...prev,
        [targetCategory]: true,
      }));
    }

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
    if (onViewAllRef) onViewAll();
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
        return CheckCircle;
      case 'alerta':
      case 'warning':
        return AlertTriangle;
      case 'error':
        return XCircle;
      case 'sistema':
      case 'success':
        return CheckCircle;
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