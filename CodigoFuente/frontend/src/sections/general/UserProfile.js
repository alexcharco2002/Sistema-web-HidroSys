// src/sections/UserProfile.js
// Componente para mostrar el perfil del usuario con opciones dinamicas.

import React, { useState, useRef, useEffect } from 'react';
import { LogOut, ChevronDown, User, Settings, Bell } from 'lucide-react';
import authService from '../../services/authServices';

import './UserProfile.css';

const UserProfile = ({ user, onLogout, onViewProfile, onSettingsClick, onNotificationsClick }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  const canAccessSettings =
    authService.hasPermission('configuracion', 'lectura') ||
    authService.hasPermission('configuracion', 'operaciones crud') ||
    authService.hasPermission('configuracion');

  const canAccessNotifications =
    authService.hasPermission('notificaciones', 'lectura') ||
    authService.hasPermission('notificaciones', 'operaciones crud') ||
    authService.hasPermission('notificaciones');

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getUserInitials = (nombres, apellidos) => {
    const firstInitial = nombres ? nombres.charAt(0).toUpperCase() : '';
    const lastInitial = apellidos ? apellidos.charAt(0).toUpperCase() : '';
    return firstInitial + lastInitial || 'U';
  };

  const handleImageError = (e) => {
    e.target.style.display = 'none';
    if (e.target.nextSibling) {
      e.target.nextSibling.style.display = 'flex';
    }
  };

  const handleImageLoad = (e) => {
    e.target.style.display = 'block';
    if (e.target.nextSibling) {
      e.target.nextSibling.style.display = 'none';
    }
  };

  const handleViewProfile = () => {
    setShowDropdown(false);
    if (onViewProfile) onViewProfile();
  };

  const handleSettings = () => {
    setShowDropdown(false);
    if (onSettingsClick) onSettingsClick();
  };

  const handleNotifications = () => {
    setShowDropdown(false);
    if (onNotificationsClick) onNotificationsClick();
  };

  const toggleDropdown = () => {
    setShowDropdown(!showDropdown);
  };

  const renderSecondaryAction = () => {
    if (canAccessSettings) {
      return (
        <button className="dropdown-item" onClick={handleSettings}>
          <Settings className="dropdown-icon" />
          <span>Configuración</span>
        </button>
      );
    }

    if (canAccessNotifications) {
      return (
        <button className="dropdown-item" onClick={handleNotifications}>
          <Bell className="dropdown-icon" />
          <span>Notificaciones</span>
        </button>
      );
    }

    return null;
  };

  return (
    <div className="user-profile-container" ref={dropdownRef}>
      <div
        className="user-profile"
        data-role={user.rol}
        onClick={toggleDropdown}
      >
        <div className="user-avatar-container">
          {user.foto ? (
            <>
              <img
                src={user.foto}
                alt={`Foto de ${user.nombre_completo || user.nombres}`}
                className="user-avatar-image"
                onError={handleImageError}
                onLoad={handleImageLoad}
              />
              <div className="user-avatar-fallback" style={{ display: 'none' }}>
                <span className="user-initials">
                  {getUserInitials(user.nombres, user.apellidos)}
                </span>
              </div>
            </>
          ) : (
            <div className="user-avatar-fallback">
              <span className="user-initials">
                {getUserInitials(user.nombres, user.apellidos)}
              </span>
            </div>
          )}
        </div>

        <div className="user-info">
          <p className="user-name header-user-profile-name">
            {`${user.nombres || ''} ${user.apellidos || ''}`.trim() || 'Usuario'}
          </p>
          <p className="user-role">{user.rol?.nombre_rol || 'Sin rol'}</p>
        </div>

        <div className={`dropdown-arrow ${showDropdown ? 'open' : ''}`}>
          <ChevronDown className="w-4 h-4" />
        </div>
      </div>

      {showDropdown && (
        <div className="user-dropdown">
          <div className="dropdown-header">
            <div className="dropdown-user-info">
              <div className="dropdown-avatar">
                {user.foto ? (
                  <img src={user.foto} alt="Avatar" />
                ) : (
                  <div className="dropdown-avatar-fallback">
                    {getUserInitials(user.nombres, user.apellidos)}
                  </div>
                )}
              </div>
              <div className="dropdown-details">
                <p className="dropdown-name">
                  {user.nombre_completo || `${user.nombres} ${user.apellidos}`}
                </p>
                <p className="dropdown-email">{user.email || 'Sin email'}</p>
              </div>
            </div>
          </div>

          <div className="dropdown-divider"></div>

          <div className="dropdown-menu">
            <button className="dropdown-item" onClick={handleViewProfile}>
              <User className="dropdown-icon" />
              <span>Mi Perfil</span>
            </button>

            {renderSecondaryAction()}

            <div className="dropdown-divider"></div>

            <button className="dropdown-item logout-item" onClick={onLogout}>
              <LogOut className="dropdown-icon" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfile;
