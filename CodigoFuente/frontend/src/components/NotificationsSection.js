// src/pages/NotificationsPage.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, 
  CheckCircle, 
  XCircle,
  Info,
  AlertTriangle,
  Trash2,
  Check,
  Filter,
  Search
} from 'lucide-react';
import notificationsService from '../services/notificationsService';
import './NotificationsSection.css';

const NotificationsSection = () => {
  const [notifications, setNotifications] = useState([]);
  const [filteredNotifications, setFilteredNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('todas'); // todas, no_leido, leido
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('todos'); // todos, info, alerta, error, sistema
  const navigate = useNavigate();

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

    // Filtrar por estado (leído/no leído)
    if (filterType === 'no_leido') {
      filtered = filtered.filter(n => !n.read);
    } else if (filterType === 'leido') {
      filtered = filtered.filter(n => n.read);
    }

    // Filtrar por tipo
    if (selectedType !== 'todos') {
      filtered = filtered.filter(n => n.type?.toLowerCase() === selectedType.toLowerCase());
    }

    // Filtrar por búsqueda
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
  // HANDLERS
  // ========================================
  const handleNotificationClick = async (notification) => {
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

    if (notification.route) {
      navigate(notification.route);
    }
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

  const unreadCount = notifications.filter(n => !n.read).length;

  // ========================================
  // RENDER
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
            <option value="alerta">Alerta</option>
            <option value="error">Error</option>
            <option value="sistema">Sistema</option>
          </select>
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
                  {/* Indicador de no leída */}
                  {!notification.read && (
                    <div className="unread-indicator"></div>
                  )}

                  {/* Header de la card */}
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

                  {/* Contenido */}
                  <div 
                    className="card-content"
                    onClick={() => handleNotificationClick(notification)}
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