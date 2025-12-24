// src/sections/ProfileSection.js
// componente para ver y editar el perfil del usuario
import React, { useState, useEffect, useRef } from 'react';

import "./ProfileSection.css"

import {
  User,
  Edit,
  Save,
  X,
  Camera,
  Mail,
  Phone,
  MapPin,
  Shield,
  Calendar, 
  VenusAndMars,
  RefreshCw,
  AlertCircle,
  Lock,
  UserCircle
} from 'lucide-react';
import userServices from '../../services/userServices';
import authService from '../../services/authServices';

const ProfileSection = () => {
  const [user, setUser] = useState(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  // Estados para cambio de contraseña
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState(null);

  // Cargar datos del usuario al montar el componente
  useEffect(() => {
    loadUserProfile();
  }, []);

  // Cargar perfil del usuario
  const loadUserProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const currentUser = authService.getCurrentUser();
      
      if (!currentUser || !currentUser.id_usuario_sistema) {
        throw new Error('No se pudo obtener la información del usuario');
      }

      const result = await userServices.getUserById(currentUser.id_usuario_sistema);
      
      if (result.success) {
        setUser(result.data);
        setProfileData(result.data);
      } else {
        setError(result.message || 'Error al cargar el perfil');
      }
    } catch (err) {
      console.error('Error cargando perfil:', err);
      setError(err.message || 'Error al cargar el perfil');
    } finally {
      setLoading(false);
    }
  };

  // Función para obtener las iniciales del usuario
  const getUserInitials = (nombres, apellidos) => {
    const firstInitial = nombres ? nombres.charAt(0).toUpperCase() : '';
    const lastInitial = apellidos ? apellidos.charAt(0).toUpperCase() : '';
    return firstInitial + lastInitial || 'U';
  };

  // Formatear fecha para input type="date" (YYYY-MM-DD)
  const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0];
    } catch (error) {
      console.error('Error formateando fecha:', error);
      return '';
    }
  };

  // Formatear fecha para visualización
  const formatDateForDisplay = (dateString) => {
    if (!dateString) return 'No especificado';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-EC', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch (error) {
      return 'Fecha inválida';
    }
  };

  // Validar datos antes de guardar
  const validateProfileData = () => {
    const errors = [];
    
    if (!profileData.nombres?.trim()) {
      errors.push('El nombre es requerido');
    }
    
    if (!profileData.apellidos?.trim()) {
      errors.push('Los apellidos son requeridos');
    }
    
    if (profileData.email && !profileData.email.includes('@')) {
      errors.push('El email no es válido');
    }
    
    if (profileData.telefono && profileData.telefono.length < 7) {
      errors.push('El teléfono debe tener al menos 7 dígitos');
    }

    return errors;
  };

  // Handlers para el perfil
  const handleEditProfile = () => {
    setEditingProfile(true);
    setError(null);
  };

  const handleSaveProfile = async () => {
    const errors = validateProfileData();
    if (errors.length > 0) {
      alert('Por favor corrige los siguientes errores:\n\n' + errors.join('\n'));
      return;
    }

    try {
      setSaving(true);
      setError(null);
      
      const userId = user.id;
      
      if (!userId) {
        throw new Error('No se pudo encontrar el ID del usuario');
      }
      
      const dataToSave = {
        nombres: profileData.nombres.trim(),
        apellidos: profileData.apellidos.trim(),
        sexo: profileData.sexo || null,
        fecha_nac: profileData.fecha_nac || null,
        email: profileData.email?.trim() || null,
        telefono: profileData.telefono?.trim() || null,
        direccion: profileData.direccion?.trim() || null
      };
      
      console.log('📤 Actualizando perfil:', dataToSave);
      
      const result = await userServices.updateUser(userId, dataToSave);
      
      if (result.success) {
        setUser(result.data);
        setProfileData(result.data);
        setEditingProfile(false);
        
        // Actualizar información en localStorage
        authService.updateUserInfo(result.data);
        
        alert('✅ Perfil actualizado correctamente');
      } else {
        throw new Error(result.message || 'Error al actualizar el perfil');
      }
    } catch (error) {
      console.error('❌ Error al actualizar perfil:', error);
      setError(error.message);
      alert('Error al actualizar el perfil: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setProfileData(user);
    setEditingProfile(false);
    setError(null);
  };

  const handleProfileInputChange = (field, value) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Manejador para cambio de foto
  const handleImageUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    
    if (!file) return;

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      alert('❌ Por favor selecciona un archivo de imagen válido');
      return;
    }

    // Validar tamaño (2MB máximo)
    if (file.size > 2 * 1024 * 1024) {
      alert('❌ La imagen no debe superar los 2MB');
      return;
    }

    try {
      setUploadingPhoto(true);
      setError(null);

      const userId = user.id;
      
      console.log('📸 Subiendo foto para usuario:', userId);
      
      const result = await userServices.uploadUserPhoto(userId, file);
      
      if (result.success) {
        // Actualizar el estado local con la nueva foto
        const updatedUser = { ...user, foto: result.data.foto_url };
        setUser(updatedUser);
        setProfileData(updatedUser);
        
        // Actualizar en localStorage
        authService.updateUserInfo(updatedUser);
        
        alert('✅ Foto actualizada correctamente');
      } else {
        throw new Error(result.message || 'Error al subir la foto');
      }
    } catch (error) {
      console.error('❌ Error al subir foto:', error);
      setError(error.message);
      alert('Error al subir la foto: ' + error.message);
    } finally {
      setUploadingPhoto(false);
      // Limpiar el input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // ========================================
  // HANDLERS PARA CAMBIO DE CONTRASEÑA
  // ========================================
  
  const handleOpenPasswordModal = () => {
    setShowPasswordModal(true);
    setPasswordData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setPasswordError(null);
  };

  const handleClosePasswordModal = () => {
    setShowPasswordModal(false);
    setPasswordData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setPasswordError(null);
    setShowPasswords({
      current: false,
      new: false,
      confirm: false
    });
  };



  const handleChangePassword = async () => {
    const validationError = validatePasswordData();
    if (validationError) {
      setPasswordError(validationError);
      return;
    }

    try {
      setChangingPassword(true);
      setPasswordError(null);
      
      const userId = user.id;
      
      console.log('🔒 Cambiando contraseña para usuario:', userId);
      
      const result = await userServices.changeUserPassword(userId, {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      
      if (result.success) {
        alert('✅ Contraseña actualizada correctamente');
        handleClosePasswordModal();
      } else {
        setPasswordError(result.message || 'Error al cambiar la contraseña');
      }
    } catch (error) {
      console.error('❌ Error al cambiar contraseña:', error);
      setPasswordError(error.message || 'Error al cambiar la contraseña');
    } finally {
      setChangingPassword(false);
    }
  };

  // ======================================
  // VALIDACIÓN DE CONTRASEÑAS 
  // ======================================
  // Calcular fortaleza de contraseña
  const calculatePasswordStrength = (password) => {
    if (!password) {
      return { score: 0, label: '', color: '', percentage: 0 };
    }

    const checks = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      number: /[0-9]/.test(password)
    };

    // Contar reglas cumplidas
    const score = Object.values(checks).filter(Boolean).length;

    // Determinar nivel
    if (score <= 1) {
      return {
        score,
        label: 'Débil',
        color: '#ef4444',
        percentage: 33
      };
    }

    if (score === 2) {
      return {
        score,
        label: 'Aceptable',
        color: '#f59e0b',
        percentage: 66
      };
    }

    return {
      score,
      label: 'Fuerte',
      color: '#10b981',
      percentage: 100
    };
  };

  // Validación completa 
  const validatePasswordComplexity = (password) => {
    const requirements = {
      minLength: {
        test: password.length >= 8,
        message: 'Mínimo 8 caracteres'
      },
      uppercase: {
        test: /[A-Z]/.test(password),
        message: 'Al menos una mayúscula (A-Z)'
      },
      numbers: {
        test: /[0-9]/.test(password),
        message: 'Al menos un número (0-9)'
      }

    };

    return requirements;
  };

// Validación mejorada
const validatePasswordData = () => {
  if (!passwordData.currentPassword.trim()) {
    return 'La contraseña actual es requerida';
  }

  if (!passwordData.newPassword.trim()) {
    return 'La nueva contraseña es requerida';
  }

  // Validar complejidad según ISO 27002
  const requirements = validatePasswordComplexity(passwordData.newPassword);
  const failedRequirements = Object.entries(requirements)
    .filter(([_, req]) => !req.test)
    .map(([_, req]) => req.message);

  if (failedRequirements.length > 0) {
    return `La contraseña debe cumplir:\n${failedRequirements.join('\n')}`;
  }

  if (passwordData.newPassword === passwordData.currentPassword) {
    return 'La nueva contraseña no puede ser igual a la actual';
  }

  if (passwordData.newPassword !== passwordData.confirmPassword) {
    return 'Las contraseñas no coinciden';
  }

  return null;
};

// Estado adicional para mostrar requisitos
const [passwordRequirements, setPasswordRequirements] = useState(null);
const [passwordStrength, setPasswordStrength] = useState({ score: 0, label: '', color: '' });

// Modificar handlePasswordInputChange para actualizar validaciones en tiempo real
const handlePasswordInputChange = (field, value) => {
  setPasswordData(prev => ({ ...prev, [field]: value }));
  setPasswordError(null);
  
  // Actualizar requisitos y fortaleza en tiempo real para nueva contraseña
  if (field === 'newPassword') {
    setPasswordRequirements(validatePasswordComplexity(value));
    setPasswordStrength(calculatePasswordStrength(value));
  }
};


  // Estados de carga
  if (loading) {
    return (
      <div className="section-placeholder">
        <RefreshCw className="w-16 h-16 mx-auto mb-4 text-gray-400 animate-spin" />
        <h2>Cargando Perfil</h2>
        <p>Por favor espera mientras cargamos tu información...</p>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="section-placeholder">
        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
        <h2>Error al Cargar Perfil</h2>
        <p>{error}</p>
        <button onClick={loadUserProfile} className="btn-primary mt-4">
          <RefreshCw className="w-4 h-4 mr-2" />
          Reintentar
        </button>
      </div>
    );
  }

  if (!user || !profileData) {
    return (
      <div className="section-placeholder">
        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
        <h2>Usuario no encontrado</h2>
        <p>No se pudo cargar la información del perfil</p>
      </div>
    );
  }

return (
  <div className="profile-wrapper">
    <div className="profile-container">
      {/* Header Section */}
      <div className="profile-header">
        <div className="profile-header__title-group">
          <UserCircle className="profile-header__icon" />
          <h2 className="section-title">Mi Perfil</h2>
        </div>
        
        <div className="profile-header__actions">
          {!editingProfile ? (
            <>
              <button 
                className="btn-primary"
                onClick={handleEditProfile}
              >
                <Edit className="w-4 h-4 mr-2" />
                Editar Perfil
              </button>
              <button 
                className="btn-primary"
                onClick={handleOpenPasswordModal}
              >
                <Lock className="w-4 h-4 mr-2" />
                Cambiar Contraseña
              </button>
            </>
          ) : (
            <div className="profile-header__edit-actions">
              <button 
                className="btn-primary"
                onClick={handleSaveProfile}
                disabled={saving}
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button 
                className="btn-secondary"
                onClick={handleCancelEdit}
                disabled={saving}
              >
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="alert alert--error">
          <AlertCircle className="alert__icon" />
          <span className="alert__message">{error}</span>
        </div>
      )}

      <div className="profile-body">
        {/* Avatar Section */}
        <div className="profile-avatar">
          <div className="profile-avatar__wrapper">
            {uploadingPhoto && (
              <div className="profile-avatar__loading-overlay">
                <RefreshCw className="profile-avatar__loading-spinner" />
              </div>
            )}
            {profileData.foto ? (
              <img
                src={profileData.foto}
                alt="Foto de perfil"
                className="profile-avatar__image"
              />
            ) : (
              <div className="profile-avatar__placeholder">
                <span className="profile-avatar__initials">
                  {getUserInitials(profileData.nombres, profileData.apellidos)}
                </span>
              </div>
            )}
            <button 
              className="profile-avatar__edit-btn"
              onClick={handleImageUpload}
              title="Cambiar foto de perfil"
              disabled={uploadingPhoto}
            >
              <Camera className="profile-avatar__edit-icon" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="profile-avatar__input"
            />
          </div>
          <p className="profile-avatar__hint">
            Click en el ícono de cámara para cambiar tu foto
          </p>
        </div>

        {/* Profile Form */}
        <div className="profile-form">
          <div className="profile-form__grid">
            {/* Nombres */}
            <div className="form-field">
              <label className="form-field__label">
                <User className="form-field__label-icon" />
                <span className="form-field__label-text">Nombres *</span>
              </label>
              {editingProfile ? (
                <input
                  type="text"
                  className="form-field__input"
                  value={profileData.nombres || ''}
                  onChange={(e) => handleProfileInputChange('nombres', e.target.value)}
                  placeholder="Ingresa tus nombres"
                  required
                />
              ) : (
                <div className="form-field__value">
                  {profileData.nombres || 'No especificado'}
                </div>
              )}
            </div>

            {/* Apellidos */}
            <div className="form-field">
              <label className="form-field__label">
                <User className="form-field__label-icon" />
                <span className="form-field__label-text">Apellidos *</span>
              </label>
              {editingProfile ? (
                <input
                  type="text"
                  className="form-field__input"
                  value={profileData.apellidos || ''}
                  onChange={(e) => handleProfileInputChange('apellidos', e.target.value)}
                  placeholder="Ingresa tus apellidos"
                  required
                />
              ) : (
                <div className="form-field__value">
                  {profileData.apellidos || 'No especificado'}
                </div>
              )}
            </div>

            {/* Sexo */}
            <div className="form-field">
              <label className="form-field__label">
                <VenusAndMars className="form-field__label-icon" />
                <span className="form-field__label-text">Sexo</span>
              </label>
              {editingProfile ? (
                <select
                  className="form-field__select"
                  value={profileData.sexo || ''}
                  onChange={(e) => handleProfileInputChange('sexo', e.target.value)}
                >
                  <option value="">Seleccionar...</option>
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                </select>
              ) : (
                <div className="form-field__value">
                  {profileData.sexo 
                    ? (profileData.sexo.toUpperCase() === 'M' 
                        ? 'Masculino' 
                        : profileData.sexo.toUpperCase() === 'F' 
                          ? 'Femenino' 
                          : profileData.sexo)
                    : 'No especificado'}
                </div>
              )}
            </div>

            {/* Fecha de Nacimiento */}
            <div className="form-field">
              <label className="form-field__label">
                <Calendar className="form-field__label-icon" />
                <span className="form-field__label-text">Fecha de Nacimiento</span>
              </label>
              {editingProfile ? (
                <input
                  type="date"
                  className="form-field__input form-field__input--date"
                  value={formatDateForInput(profileData.fecha_nac)}
                  onChange={(e) => handleProfileInputChange('fecha_nac', e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                />
              ) : (
                <div className="form-field__value">
                  {formatDateForDisplay(profileData.fecha_nac)}
                </div>
              )}
            </div>

            {/* Email */}
            <div className="form-field">
              <label className="form-field__label">
                <Mail className="form-field__label-icon" />
                <span className="form-field__label-text">Correo Electrónico</span>
              </label>
              {editingProfile ? (
                <input
                  type="email"
                  className="form-field__input"
                  value={profileData.email || ''}
                  onChange={(e) => handleProfileInputChange('email', e.target.value)}
                  placeholder="email@ejemplo.com"
                />
              ) : (
                <div className="form-field__value">
                  {profileData.email || 'No especificado'}
                </div>
              )}
            </div>

            {/* Teléfono */}
            <div className="form-field">
              <label className="form-field__label">
                <Phone className="form-field__label-icon" />
                <span className="form-field__label-text">Teléfono</span>
              </label>
              {editingProfile ? (
                <input
                  type="tel"
                  className="form-field__input"
                  value={profileData.telefono || ''}
                  onChange={(e) => handleProfileInputChange('telefono', e.target.value)}
                  placeholder="0987654321"
                />
              ) : (
                <div className="form-field__value">
                  {profileData.telefono || 'No especificado'}
                </div>
              )}
            </div>

            {/* Dirección */}
            <div className="form-field form-field--full-width">
              <label className="form-field__label">
                <MapPin className="form-field__label-icon" />
                <span className="form-field__label-text">Dirección</span>
              </label>
              {editingProfile ? (
                <textarea
                  className="form-field__textarea"
                  value={profileData.direccion || ''}
                  onChange={(e) => handleProfileInputChange('direccion', e.target.value)}
                  rows="3"
                  placeholder="Dirección completa"
                />
              ) : (
                <div className="form-field__value">
                  {profileData.direccion || 'No especificado'}
                </div>
              )}
            </div>

            {/* Rol del Sistema (Read-only) */}
            <div className="form-field">
              <label className="form-field__label">
                <Shield className="form-field__label-icon" />
                <span className="form-field__label-text">Rol del Sistema</span>
              </label>
              <div className="form-field__value">
                <span className={`badge badge--role badge--${profileData.rol?.nombre_rol?.toLowerCase()}`}>
                  {profileData.rol?.nombre_rol || 'Sin rol'}
                </span>
              </div>
            </div>

            {/* Fecha de Registro (Read-only) */}
            <div className="form-field">
              <label className="form-field__label">
                <Calendar className="form-field__label-icon" />
                <span className="form-field__label-text">Fecha de Registro</span>
              </label>
              <div className="form-field__value">
                {formatDateForDisplay(profileData.fecha_registro)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* ==================== PASSWORD CHANGE MODAL ==================== */}
    {showPasswordModal && (
      <div className="modal-overlay">
        <div className="modal modal--large">
          {/* Modal Header */}
          <div className="modal__header">
            <h3 className="modal__title">
              <Lock className="modal__title-icon" />
              <span>Cambiar Contraseña</span>
            </h3>
            <button 
              className="modal__close-btn" 
              onClick={handleClosePasswordModal}
              disabled={changingPassword}
              aria-label="Cerrar modal"
            >
              <X className="modal__close-icon" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="modal__body">
            {/* Password Policy Card */}
            <div className="security-policy-card">
              <div className="security-policy-card__content">
                <Shield className="security-policy-card__icon" />
                <div className="security-policy-card__text">
                  <h4 className="security-policy-card__title">
                    Política de Contraseñas
                  </h4>
                  <p className="security-policy-card__description">
                    La contraseña debe tener al menos 8 caracteres e incluir: 
                    mayúsculas (A-Z), minúsculas (a-z), números (0-9) y 
                    símbolos especiales (!@#$%&*).
                  </p>
                </div>
              </div>
            </div>

            {/* Error Alert */}
            {passwordError && (
              <div className="alert alert--error">
                <AlertCircle className="alert__icon" />
                <span className="alert__message" style={{ whiteSpace: 'pre-line' }}>
                  {passwordError}
                </span>
              </div>
            )}

            {/* Password Form */}
            <form 
              className="password-form" 
              onSubmit={(e) => { e.preventDefault(); handleChangePassword(); }}
            >
              <div className="password-form__grid">
                {/* Current Password */}
                <div className="form-field form-field--full-width">
                  <label className="form-field__label">
                    <span className="form-field__label-text">Contraseña Actual *</span>
                  </label>
                  <div className="form-field__password-wrapper">
                    <input
                      type={showPasswords.current ? 'text' : 'password'}
                      className="form-field__input form-field__input--password"
                      required
                      value={passwordData.currentPassword}
                      onChange={(e) => handlePasswordInputChange('currentPassword', e.target.value)}
                      placeholder="Ingresa tu contraseña actual"
                      disabled={changingPassword}
                    />
                    <button
                      type="button"
                      className="form-field__password-toggle"
                      onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                      disabled={changingPassword}
                      aria-label={showPasswords.current ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div className="form-field form-field--full-width">
                  <label className="form-field__label">
                    <span className="form-field__label-text">Nueva Contraseña *</span>
                  </label>
                  <div className="form-field__password-wrapper">
                    <input
                      type={showPasswords.new ? 'text' : 'password'}
                      className="form-field__input form-field__input--password"
                      required
                      value={passwordData.newPassword}
                      onChange={(e) => handlePasswordInputChange('newPassword', e.target.value)}
                      placeholder="Crea una contraseña segura"
                      disabled={changingPassword}
                    />
                    <button
                      type="button"
                      className="form-field__password-toggle"
                      onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                      disabled={changingPassword}
                      aria-label={showPasswords.new ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                    </button>
                  </div>

                  {/* Password Strength Indicator */}
                  {passwordData.newPassword && (
                    <div className="password-strength">
                      <div className="password-strength__header">
                        <span className="password-strength__label">Fortaleza:</span>
                        <span 
                          className="password-strength__value" 
                          style={{ color: passwordStrength.color }}
                        >
                          {passwordStrength.label}
                        </span>
                      </div>
                      <div className="password-strength__bar-track">
                        <div
                          className="password-strength__bar-fill"
                          style={{ 
                            width: `${passwordStrength.percentage}%`,
                            backgroundColor: passwordStrength.color
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Password Requirements Checklist */}
                  {passwordRequirements && passwordData.newPassword && (
                    <div className="password-requirements">
                      {Object.entries(passwordRequirements).map(([key, req]) => (
                        <div 
                          key={key} 
                          className={`password-requirements__item ${req.test ? 'password-requirements__item--valid' : ''}`}
                        >
                          <span className="password-requirements__icon">
                            {req.test ? '✓' : '○'}
                          </span>
                          <span className="password-requirements__text">
                            {req.message}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="form-field form-field--full-width">
                  <label className="form-field__label">
                    <span className="form-field__label-text">Confirmar Nueva Contraseña *</span>
                  </label>
                  <div className="form-field__password-wrapper">
                    <input
                      type={showPasswords.confirm ? 'text' : 'password'}
                      className="form-field__input form-field__input--password"
                      required
                      value={passwordData.confirmPassword}
                      onChange={(e) => handlePasswordInputChange('confirmPassword', e.target.value)}
                      placeholder="Confirma tu nueva contraseña"
                      disabled={changingPassword}
                    />
                    <button
                      type="button"
                      className="form-field__password-toggle"
                      onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                      disabled={changingPassword}
                      aria-label={showPasswords.confirm ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                    </button>
                  </div>

                  {/* Password Match Indicator */}
                  {passwordData.confirmPassword && (
                    <div className={`password-match ${passwordData.newPassword === passwordData.confirmPassword ? 'password-match--valid' : 'password-match--invalid'}`}>
                      <span className="password-match__icon">
                        {passwordData.newPassword === passwordData.confirmPassword ? '✓' : '✗'}
                      </span>
                      <span className="password-match__text">
                        {passwordData.newPassword === passwordData.confirmPassword 
                          ? 'Las contraseñas coinciden'
                          : 'Las contraseñas no coinciden'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Form Actions */}
              <div className="modal__actions">
                <button 
                  type="button" 
                  className="btn-secondary" 
                  onClick={handleClosePasswordModal}
                  disabled={changingPassword}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={changingPassword}
                >
                  {changingPassword ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 w-4 h-4 mr-2--spin" />
                      <span>Cambiando...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 mr-2" />
                      <span>Cambiar Contraseña</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    )}
  </div>
);

};

export default ProfileSection;