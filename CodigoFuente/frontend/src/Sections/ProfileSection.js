// src/sections/ProfileSection.js
// componente para ver y editar el perfil del usuario
import React, { useState, useEffect, useRef } from 'react';


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
import userServices from '../services/userServices';
import authService from '../services/authServices';

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
// VALIDACIÓN DE CONTRASEÑAS - ISO 27002
// ======================================

// Calcular fortaleza de contraseña
const calculatePasswordStrength = (password) => {
  if (!password) return { score: 0, label: '', color: '' };
  
  let score = 0;
  const checks = {
    length: password.length >= 8,
    minLength: password.length >= 12,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    numbers: /[0-9]/.test(password),
    special: /[!@#$%^&*()_+\-=\]{};:'"\\|,.<>?]/.test(password)
  };

  // Sistema de puntuación
  if (checks.length) score += 1;
  if (checks.minLength) score += 1;
  if (checks.uppercase) score += 1;
  if (checks.lowercase) score += 1;
  if (checks.numbers) score += 1;
  if (checks.special) score += 1;

  // Determinar nivel
  if (score <= 2) {
    return { score, label: 'Débil', color: '#ef4444', percentage: 33 };
  } else if (score <= 4) {
    return { score, label: 'Media', color: '#f59e0b', percentage: 66 };
  } else {
    return { score, label: 'Fuerte', color: '#10b981', percentage: 100 };
  }
};

// Validación completa con regex según ISO 27002
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
    lowercase: {
      test: /[a-z]/.test(password),
      message: 'Al menos una minúscula (a-z)'
    },
    numbers: {
      test: /[0-9]/.test(password),
      message: 'Al menos un número (0-9)'
    },
    special: {
      test: /[!@#$%^&*()_+\-=\]{};:'"\\|,.<>?]/.test(password),
      message: 'Al menos un símbolo (!@#$%&*)'
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
    <div className="section-placeholder">
      <div className="profile-section">
        <div className="section-header">
          <div className="section-title">
            <UserCircle className="w-6 h-6 text-blue-600" />
            <h2>Mi Perfil</h2>
          </div>
          
          <div className="flex gap-2">
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
              <div className="profile-actions">
                <button 
                  className="btn-success"
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

        {/* Mensaje de error */}
        {error && (
          <div className="alert alert-error mb-4">
            <AlertCircle className="w-5 h-5 mr-2" />
            {error}
          </div>
        )}

        <div className="profile-content">
          {/* Avatar Section */}
          <div className="profile-avatar-section">
            <div className="profile-avatar-container">
              {uploadingPhoto && (
                <div className="avatar-loading-overlay">
                  <RefreshCw className="w-8 h-8 text-white animate-spin" />
                </div>
              )}
              {profileData.foto ? (
                <img
                  src={profileData.foto}
                  alt="Foto de perfil"
                  className="profile-avatar-large"
                />
              ) : (
                <div className="profile-avatar-large-fallback">
                  <span className="profile-initials-large">
                    {getUserInitials(profileData.nombres, profileData.apellidos)}
                  </span>
                </div>
              )}
              <button 
                className="avatar-edit-btn"
                onClick={handleImageUpload}
                title="Cambiar foto de perfil"
                disabled={uploadingPhoto}
              >
                <Camera className="w-4 h-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </div>
            <br />
            <p className="text-sm text-gray-500 mt-2 text-center">
              Click en el ícono de cámara para cambiar tu foto
            </p>
          </div>

          {/* Profile Form */}
          <div className="profile-form">
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">
                  <User className="w-4 h-4" />
                  Nombres *
                </label>
                {editingProfile ? (
                  <input
                    type="text"
                    className="form-input"
                    value={profileData.nombres || ''}
                    onChange={(e) => handleProfileInputChange('nombres', e.target.value)}
                    placeholder="Ingresa tus nombres"
                    required
                  />
                ) : (
                  <div className="form-value">{profileData.nombres || 'No especificado'}</div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">
                  <User className="w-4 h-4" />
                  Apellidos *
                </label>
                {editingProfile ? (
                  <input
                    type="text"
                    className="form-input"
                    value={profileData.apellidos || ''}
                    onChange={(e) => handleProfileInputChange('apellidos', e.target.value)}
                    placeholder="Ingresa tus apellidos"
                    required
                  />
                ) : (
                  <div className="form-value">{profileData.apellidos || 'No especificado'}</div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">
                  <VenusAndMars className="w-4 h-4" />
                  Sexo
                </label>
                {editingProfile ? (
                  <select
                    className="form-input"
                    value={profileData.sexo || ''}
                    onChange={(e) => handleProfileInputChange('sexo', e.target.value)}
                  >
                    <option value="">Seleccionar...</option>
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                  </select>
                ) : (
                  <div className="form-value">
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

              <div className="form-group">
                <label className="form-label">
                  <Calendar className="w-4 h-4" />
                  Fecha de Nacimiento
                </label>
                {editingProfile ? (
                  <input
                    type="date"
                    className="form-input"
                    value={formatDateForInput(profileData.fecha_nac)}
                    onChange={(e) => handleProfileInputChange('fecha_nac', e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                  />
                ) : (
                  <div className="form-value">
                    {formatDateForDisplay(profileData.fecha_nac)}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">
                  <Mail className="w-4 h-4" />
                  Correo Electrónico
                </label>
                {editingProfile ? (
                  <input
                    type="email"
                    className="form-input"
                    value={profileData.email || ''}
                    onChange={(e) => handleProfileInputChange('email', e.target.value)}
                    placeholder="email@ejemplo.com"
                  />
                ) : (
                  <div className="form-value">{profileData.email || 'No especificado'}</div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">
                  <Phone className="w-4 h-4" />
                  Teléfono
                </label>
                {editingProfile ? (
                  <input
                    type="tel"
                    className="form-input"
                    value={profileData.telefono || ''}
                    onChange={(e) => handleProfileInputChange('telefono', e.target.value)}
                    placeholder="0987654321"
                  />
                ) : (
                  <div className="form-value">{profileData.telefono || 'No especificado'}</div>
                )}
              </div>

              <div className="form-group form-group-full">
                <label className="form-label">
                  <MapPin className="w-4 h-4" />
                  Dirección
                </label>
                {editingProfile ? (
                  <textarea
                    className="form-textarea"
                    value={profileData.direccion || ''}
                    onChange={(e) => handleProfileInputChange('direccion', e.target.value)}
                    rows="3"
                    placeholder="Dirección completa"
                  />
                ) : (
                  <div className="form-value">{profileData.direccion || 'No especificado'}</div>
                )}
              </div>

              {/* Campos de solo lectura */}
              <div className="form-group">
                <label className="form-label">
                  <Shield className="w-4 h-4" />
                  Rol del Sistema
                </label>
                <div className="form-value">
                  <span className={`role-badge ${profileData.rol?.nombre_rol?.toLowerCase()}`}>
                    {profileData.rol?.nombre_rol || 'Sin rol'}
                  </span>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <Calendar className="w-4 h-4" />
                  Fecha de Registro
                </label>
                <div className="form-value">
                  {formatDateForDisplay(profileData.fecha_registro)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

{/* ==================== MODAL DE CAMBIO DE CONTRASEÑA - ISO 27002 ==================== */}
{showPasswordModal && (
  <div className="modal-overlay">
    <div className="modal">
      {/* Header */}
      <div className="modal-header">
        <h3 className="flex items-center gap-3">
          <Lock className="w-6 h-6" />
          Cambiar Contraseña
        </h3>
        <button 
          className="modal-close" 
          onClick={handleClosePasswordModal}
          disabled={changingPassword}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Body */}
      <div className="modal-body">
        {/* Política de Contraseñas - ISO 27002 */}
        <div style={{ 
          backgroundColor: '#eff6ff', 
          border: '1px solid #bfdbfe', 
          borderRadius: '8px', 
          padding: '16px',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'start', gap: '8px' }}>
            <Shield className="w-5 h-5" style={{ color: '#2563eb', marginTop: '2px', flexShrink: 0 }} />
            <div>
              <h4 style={{ fontWeight: 600, color: '#1e3a8a', fontSize: '14px', marginBottom: '8px' }}>
                Política de Contraseñas
              </h4>
              <p style={{ color: '#1e40af', fontSize: '12px', lineHeight: '1.5' }}>
                La contraseña debe tener al menos 8 caracteres e incluir: 
                mayúsculas (A-Z), minúsculas (a-z), números (0-9) y 
                símbolos especiales (!@#$%&*).
              </p>
            </div>
          </div>
        </div>

        {/* Error general */}
        {passwordError && (
          <div className="alert alert-error mb-4">
            <AlertCircle className="w-5 h-5 mr-2" />
            <span style={{ whiteSpace: 'pre-line' }}>{passwordError}</span>
          </div>
        )}

        {/* Formulario */}
        <form className="user-form" onSubmit={(e) => { e.preventDefault(); handleChangePassword(); }}>
          <div className="form-grid">
            {/* Contraseña actual */}
            <div className="form-group form-group-full">
              <label>Contraseña Actual *</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPasswords.current ? 'text' : 'password'}
                  required
                  value={passwordData.currentPassword}
                  onChange={(e) => handlePasswordInputChange('currentPassword', e.target.value)}
                  placeholder="Ingresa tu contraseña actual"
                  disabled={changingPassword}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                  disabled={changingPassword}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '18px',
                    padding: '4px'
                  }}
                >
                  {showPasswords.current ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Nueva contraseña */}
            <div className="form-group form-group-full">
              <label>Nueva Contraseña *</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPasswords.new ? 'text' : 'password'}
                  required
                  value={passwordData.newPassword}
                  onChange={(e) => handlePasswordInputChange('newPassword', e.target.value)}
                  placeholder="Crea una contraseña segura"
                  disabled={changingPassword}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                  disabled={changingPassword}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '18px',
                    padding: '4px'
                  }}
                >
                  {showPasswords.new ? '🙈' : '👁️'}
                </button>
              </div>

              {/* Indicador de Fortaleza */}
              {passwordData.newPassword && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 500, color: '#4b5563' }}>
                      Fortaleza:
                    </span>
                    <span 
                      style={{ 
                        fontSize: '12px', 
                        fontWeight: 600,
                        color: passwordStrength.color 
                      }}
                    >
                      {passwordStrength.label}
                    </span>
                  </div>
                  <div style={{ 
                    width: '100%', 
                    height: '8px', 
                    backgroundColor: '#e5e7eb', 
                    borderRadius: '9999px',
                    overflow: 'hidden'
                  }}>
                    <div
                      style={{ 
                        height: '100%',
                        width: `${passwordStrength.percentage}%`,
                        backgroundColor: passwordStrength.color,
                        transition: 'all 0.3s',
                        borderRadius: '9999px'
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Requisitos de Complejidad */}
              {passwordRequirements && passwordData.newPassword && (
                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {Object.entries(passwordRequirements).map(([key, req]) => (
                    <div 
                      key={key} 
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}
                    >
                      <span style={{ color: req.test ? '#10b981' : '#9ca3af' }}>
                        {req.test ? '✓' : '○'}
                      </span>
                      <span style={{ color: req.test ? '#047857' : '#6b7280' }}>
                        {req.message}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Confirmar contraseña */}
            <div className="form-group form-group-full">
              <label>Confirmar Nueva Contraseña *</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPasswords.confirm ? 'text' : 'password'}
                  required
                  value={passwordData.confirmPassword}
                  onChange={(e) => handlePasswordInputChange('confirmPassword', e.target.value)}
                  placeholder="Confirma tu nueva contraseña"
                  disabled={changingPassword}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                  disabled={changingPassword}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '18px',
                    padding: '4px'
                  }}
                >
                  {showPasswords.confirm ? '🙈' : '👁️'}
                </button>
              </div>

              {/* Indicador de coincidencia */}
              {passwordData.confirmPassword && (
                <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {passwordData.newPassword === passwordData.confirmPassword ? (
                    <>
                      <span style={{ color: '#10b981', fontSize: '12px' }}>✓</span>
                      <span style={{ color: '#047857', fontSize: '12px', fontWeight: 500 }}>
                        Las contraseñas coinciden
                      </span>
                    </>
                  ) : (
                    <>
                      <span style={{ color: '#ef4444', fontSize: '12px' }}>✗</span>
                      <span style={{ color: '#dc2626', fontSize: '12px', fontWeight: 500 }}>
                        Las contraseñas no coinciden
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Botones de acción */}
          <div className="form-actions">
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
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Cambiando...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 mr-2" />
                  Cambiar Contraseña
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