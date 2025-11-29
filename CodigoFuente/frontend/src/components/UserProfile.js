// src/components/UserProfile.js
// Componente para mostrar el perfil del usuario con un dropdown para opciones como ver perfil, configuración y cerrar sesión

import React, { useState, useRef, useEffect } from 'react';
import { LogOut, ChevronDown, User, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const UserProfile = ({ user, onLogout, onViewProfile }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Cerrar dropdown cuando se hace click fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Función para obtener las iniciales del usuario
  const getUserInitials = (nombres, apellidos) => {
    const firstInitial = nombres ? nombres.charAt(0).toUpperCase() : '';
    const lastInitial = apellidos ? apellidos.charAt(0).toUpperCase() : '';
    return firstInitial + lastInitial || 'U';
  };

  // Función para manejar errores al cargar la imagen
  const handleImageError = (e) => {
    e.target.style.display = 'none';
    if (e.target.nextSibling) {
      e.target.nextSibling.style.display = 'flex';
    }
  };

  // Función para manejar cuando la imagen se carga correctamente
  const handleImageLoad = (e) => {
    e.target.style.display = 'block';
    if (e.target.nextSibling) {
      e.target.nextSibling.style.display = 'none';
    }
  };
  // Navegación a ver perfil
   const handleViewProfile = () => {
    setShowDropdown(false);
    if (onViewProfile) onViewProfile(); // 🔥 notifica al AdminDashboard
  };
  
  // Navegación a configuración
  const handleSettings = () => {
    setShowDropdown(false);
    navigate('/admin/dashboard/settings');
  };


  // Toggle dropdown
  const toggleDropdown = () => {
    setShowDropdown(!showDropdown);
  };

  return (
    <div className="user-profile-container" ref={dropdownRef}>
      <div 
        className="user-profile" 
        data-role={user.rol}
        onClick={toggleDropdown}
      >
        {/* Avatar del usuario */}
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
              {/* Fallback con iniciales si la imagen falla */}
              <div className="user-avatar-fallback" style={{ display: 'none' }}>
                <span className="user-initials">
                  {getUserInitials(user.nombres, user.apellidos)}
                </span>
              </div>
            </>
          ) : (
            /* Avatar por defecto con iniciales */
            <div className="user-avatar-fallback">
              <span className="user-initials">
                {getUserInitials(user.nombres, user.apellidos)}
              </span>
            </div>
          )}
        </div>

        {/* Información del usuario */}
        <div className="user-info">
          <p className="user-name">
            { `${user.nombres || ''} ${user.apellidos || ''}`.trim() || 'Usuario'}
          </p>
          <p className="user-role">{user.rol?.nombre_rol || 'Sin rol'}</p>
        </div>

        {/* Icono dropdown */}
        <div className={`dropdown-arrow ${showDropdown ? 'open' : ''}`}>
          <ChevronDown className="w-4 h-4" />
        </div>
      </div>

      {/* Dropdown Menu */}
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
            <button 
              className="dropdown-item"
              onClick={handleViewProfile}
            >
              <User className="dropdown-icon" />
              <span>Mi Perfil</span>
            </button>
            
            <button 
              className="dropdown-item"
              onClick={handleSettings}
            >
              <Settings className="dropdown-icon" />
              <span>Configuración</span>
            </button>
            
            <div className="dropdown-divider"></div>
            
            <button 
              className="dropdown-item logout-item"
              onClick={onLogout}
            >
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