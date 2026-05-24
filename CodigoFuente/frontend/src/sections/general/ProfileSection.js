// src/sections/ProfileSection.js
import React, { useState, useEffect, useRef } from 'react';
import "./ProfileSection.css"
import "./profile.fhot.css"
import { 
  User, Edit, Save, X, Camera, Mail, Phone, MapPin, CheckCircle,
  Calendar, RefreshCw, AlertCircle, Lock, Eye, EyeOff , Wallet, Shield, BookOpen, Users, UserCog
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
  const [showPhotoPreview, setShowPhotoPreview] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  // 👇 NUEVA FUNCIÓN: Iconos para roles
  const roleIcons = {
    administrador: <UserCog className="w-4 h-4"/>,
    'super administrador': <Shield className="w-4 h-4" />,
    cajero: <Wallet className="w-4 h-4" />,
    lector: <BookOpen className="w-4 h-4"/>,
    afiliado: <Users className="w-4 h-4" />,
    cliente: <User className="w-4 h-4" />,
  };

  /**
   * 🎨 Genera el badge visual del rol con iconos y colores específicos
   */
  const getRoleBadge = (user) => {
    const roleName = user?.rol?.nombre_rol?.toLowerCase() || 'sin rol';
    
    // Determinar la clase del badge
    let badgeClass = 'badge';
    if (roleName.includes('admin')) badgeClass += ' badge--administrador';
    else if (roleName.includes('cajero')) badgeClass += ' badge--cajero';
    else if (roleName.includes('lector')) badgeClass += ' badge--lector';
    else if (roleName.includes('afiliado')) badgeClass += ' badge--afiliado';
    else badgeClass += ' badge--default';

    // Obtener icono
    const icon = roleIcons[roleName] || <User size={16} />;

    return (
      <span className={badgeClass}>
        <span className="badge-icon">
          {icon}
        </span>
        <span className="badge-text">
          {user?.rol?.nombre_rol || 'Sin rol'}
        </span>
      </span>
    );
  };


  /**
 * 🎨 Genera el badge para el estado con icono (✔ / ✖)
 */
const getEstadoBadge = (estado) => {
  const isActive = estado === 'Activo';

  return (
    <span className={`badge ${isActive ? 'badge--success' : 'badge--error'}`}>
      <span className="badge-icon">
        {isActive ? (
          <CheckCircle size={14} />
        ) : (
          <X size={14} />
        )}
      </span>

      <span className="badge-text">
        {estado || 'Desconocido'}
      </span>
    </span>
  );
};



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
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, label: '', color: '', percentage: 0 });

  useEffect(() => {
    loadUserProfile();
  }, []);

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
        console.info('Informacion de perfil cargada');
      } else {
        setError(result.message || 'Error al cargar el perfil');
      }
    } catch (err) {
      console.error('Error cargando informacion de perfil:', err);
      setError(err.message || 'Error al cargar el perfil');
    } finally {
      setLoading(false);
    }
  };

  const getUserInitials = (nombres, apellidos) => {
    const firstInitial = nombres ? nombres.charAt(0).toUpperCase() : '';
    const lastInitial = apellidos ? apellidos.charAt(0).toUpperCase() : '';
    return firstInitial + lastInitial || 'U';
  };

  const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0];
    } catch (error) {
      return '';
    }
  };

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

  const validateProfileData = () => {
    const errors = [];
    if (!profileData.nombres?.trim()) errors.push('El nombre es requerido');
    if (!profileData.apellidos?.trim()) errors.push('Los apellidos son requeridos');
    if (profileData.email && !profileData.email.includes('@')) errors.push('El email no es válido');
    if (profileData.telefono && profileData.telefono.length < 7) errors.push('El teléfono debe tener al menos 7 dígitos');
    return errors;
  };

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

      const dataToSave = {
        nombres: profileData.nombres.trim(),
        apellidos: profileData.apellidos.trim(),
        sexo: profileData.sexo || null,
        fecha_nac: profileData.fecha_nac || null,
        email: profileData.email?.trim() || null,
        telefono: profileData.telefono?.trim() || null,
        direccion: profileData.direccion?.trim() || null
      };

      const result = await userServices.updateUser(userId, dataToSave);
      
      if (result.success) {
        setUser(result.data);
        setProfileData(result.data);
        setEditingProfile(false);
        authService.updateUserInfo(result.data);
        console.info('Informacion de perfil actualizada');
        alert('✅ Perfil actualizado correctamente');
      } else {
        throw new Error(result.message || 'Error al actualizar el perfil');
      }
    } catch (error) {
      console.error('Error actualizando informacion de perfil:', error);
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
    setProfileData(prev => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('❌ Por favor selecciona un archivo de imagen válido');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('❌ La imagen no debe superar los 2MB');
      return;
    }

    try {
      setUploadingPhoto(true);
      setError(null);
      const userId = user.id;
      const result = await userServices.uploadUserPhoto(userId, file);
      
      if (result.success) {
        const updatedUser = { ...user, foto: result.data.foto_url };
        setUser(updatedUser);
        setProfileData(updatedUser);
        authService.updateUserInfo(updatedUser);
        console.info('Foto de perfil actualizada');
        alert('✅ Foto actualizada correctamente');
      } else {
        throw new Error(result.message || 'Error al subir la foto');
      }
    } catch (error) {
      console.error('Error actualizando foto de perfil:', error);
      alert('Error al subir la foto: ' + error.message);
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // PASSWORD FUNCTIONS
  const calculatePasswordStrength = (password) => {
    if (!password) return { score: 0, label: '', color: '', percentage: 0 };
    
    const checks = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      number: /[0-9]/.test(password)
    };
    
    const score = Object.values(checks).filter(Boolean).length;
    
    if (score <= 1) return { score, label: 'Débil', color: '#ef4444', percentage: 33 };
    if (score === 2) return { score, label: 'Aceptable', color: '#f59e0b', percentage: 66 };
    return { score, label: 'Fuerte', color: '#10b981', percentage: 100 };
  };

  const validatePasswordComplexity = (password) => {
    return {
      minLength: { test: password.length >= 8, message: 'Mínimo 8 caracteres' },
      uppercase: { test: /[A-Z]/.test(password), message: 'Al menos una mayúscula' },
      numbers: { test: /[0-9]/.test(password), message: 'Al menos un número' }
    };
  };

  const validatePasswordData = () => {
    if (!passwordData.currentPassword.trim()) return 'La contraseña actual es requerida';
    if (!passwordData.newPassword.trim()) return 'La nueva contraseña es requerida';
    
    const requirements = validatePasswordComplexity(passwordData.newPassword);
    const failed = Object.values(requirements).filter(r => !r.test);
    
    if (failed.length > 0) return `La contraseña debe cumplir:\n${failed.map(r => r.message).join('\n')}`;
    if (passwordData.newPassword === passwordData.currentPassword) return 'La nueva contraseña no puede ser igual a la actual';
    if (passwordData.newPassword !== passwordData.confirmPassword) return 'Las contraseñas no coinciden';
    
    return null;
  };

  const handlePasswordInputChange = (field, value) => {
    setPasswordData(prev => ({ ...prev, [field]: value }));
    setPasswordError(null);
    
    if (field === 'newPassword') {
      setPasswordStrength(calculatePasswordStrength(value));
    }
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
      const result = await userServices.changeUserPassword(user.id, {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      
      if (result.success) {
        alert('✅ Contraseña actualizada correctamente');
        setShowPasswordModal(false);
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        setPasswordError(result.message || 'Error al cambiar la contraseña');
      }
    } catch (error) {
      setPasswordError(error.message || 'Error al cambiar la contraseña');
    } finally {
      setChangingPassword(false);
    }
  };
    if (loading) {
      return (
        <div className="affiliates-section">
          <div className="empty-state">
            <RefreshCw className="w-16 h-16 text-blue-400 mx-auto mb-4 animate-spin" />
            <h3>Cargando perfil...</h3>
          </div>
        </div>
      );
    }

  if (error && !user) {
    return (
      <div className="profile-error">
        <AlertCircle size={48} />
        <h3>Error al cargar el perfil</h3>
        <p>{error}</p>
        <button onClick={loadUserProfile} className="btn-primary">
          <RefreshCw size={16} />
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-layout">
        {/* SIDEBAR CON INFO DEL USUARIO */}
        <div className="profile-sidebar">
          <div className="profile-sidebar-card">
            {/* Avatar */}
            <div className="profile-avatar-container">
              <div 
                className={`profile-avatar-wrapper ${showPhotoPreview ? 'preview-active' : ''}`}
                onClick={() => setShowPhotoPreview(!showPhotoPreview)}
              >
                {uploadingPhoto && (
                  <div className="avatar-loading-overlay">
                    <RefreshCw className="spinner" size={24} />
                  </div>
                )}
                {user.foto ? (
                  <img 
                    src={user.foto} 
                    alt={`${user.nombres} ${user.apellidos}`}
                    className="profile-avatar-image"
                  />
                ) : (
                  <div className="profile-avatar-placeholder">
                    <span className="avatar-initials">
                      {getUserInitials(user.nombres, user.apellidos)}
                    </span>
                  </div>
                )}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleImageUpload();
                  }}
                  disabled={uploadingPhoto}
                  className="avatar-edit-button"
                  title="Cambiar foto"
                >
                  <Camera size={16} />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </div>
            </div>

            {/* Información del usuario */}
            <div className="profile-user-info">
              <h2 className="profile-user-name">
                {user.nombres} {user.apellidos}
              </h2>
              <p className="profile-user-email">{user.email || 'Sin email'}</p>
            </div>

            {/* Detalles adicionales */}
            <div className="profile-details-list">
              <div className="profile-detail-item">
                <span className="detail-label">Rol</span>
                {getRoleBadge(user)}
              </div>

              <div className="profile-detail-item">
                <span className="detail-label">Estado</span>
                {getEstadoBadge(user.activo ? 'Activo' : 'Inactivo')}
              </div>

              <div className="profile-detail-item">
                <Phone size={16} className="detail-icon" />
                <div className="detail-content">
                  <span className="detail-label">Celular</span>
                  <span className="detail-value">{user.telefono || 'No especificado'}</span>
                </div>
              </div>

              <div className="profile-detail-item">
                <Calendar size={16} className="detail-icon" />
                <div className="detail-content">
                  <span className="detail-label">Miembro desde</span>
                  <span className="detail-value">
                    {user.fecha_registro ? formatDateForDisplay(user.fecha_registro) : 'No disponible'}
                  </span>
                </div>
              </div>
            </div>


          </div>
        </div>

        {/* PANEL PRINCIPAL CON FORMULARIO */}
        <div className="profile-main">
          <div className="profile-main-card">
            {/* Header */}
            <div className="profile-card-header">
              <div className="profile-card-title-group">
                <User size={24} />
                <h2>Editar Información</h2>
              </div>
              {!editingProfile ? (
                <button onClick={handleEditProfile} className="btn-primary">
                  <Edit size={16} />
                  Editar Perfil
                </button>
              ) : (
                <div className="button-group">
                  <button onClick={handleCancelEdit} className="btn-secondary" disabled={saving}>
                    <X className="w-4 h-4 mr-2" />
                    Cancelar
                  </button>
                  <button onClick={handleSaveProfile} className="btn-primary" disabled={saving}>
                    {saving ? <RefreshCw size={16} className="spinner" /> : <Save size={16} />}
                    {saving ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                </div>
              )}
            </div>

            {/* Formulario */}
            <div className="profile-form-body">
              <div className="profile-form-grid">
                {/* Nombre */}
                <div className="form-group">
                  <label className="form-label">
                    <User size={14} />
                     {" "}  Nombre*
                  </label>
                  <input
                    type="text"
                    value={profileData?.nombres || ''}
                    onChange={(e) => handleProfileInputChange('nombres', e.target.value)}
                    disabled={!editingProfile || saving}
                    className="form-input"
                    placeholder="Ingresa tu nombre"
                  />
                </div>

                {/* Apellido */}
                <div className="form-group">
                  <label className="form-label">
                    <User size={14} />
                     {" "} Apellido*
                  </label>
                  <input
                    type="text"
                    value={profileData?.apellidos || ''}
                    onChange={(e) => handleProfileInputChange('apellidos', e.target.value)}
                    disabled={!editingProfile || saving}
                    className="form-input"
                    placeholder="Ingresa tu apellido"
                  />
                </div>

                {/* Email */}
                <div className="form-group form-group-full">
                  <label className="form-label">
                    <Mail size={14} />
                    {" "} Correo electrónico
                  </label>
                  <input
                    type="email"
                    value={profileData?.email || ''}
                    onChange={(e) => handleProfileInputChange('email', e.target.value)}
                    disabled={!editingProfile || saving}
                    className="form-input"
                    placeholder="correo@email.com"
                  />
                </div>

                {/* Celular */}
                <div className="form-group">
                  <label className="form-label">
                    <Phone size={14} />
                     {" "} Celular
                  </label>
                  <input
                    type="tel"
                    value={profileData?.telefono || ''}
                    onChange={(e) => handleProfileInputChange('telefono', e.target.value)}
                    disabled={!editingProfile || saving}
                    className="form-input"
                    placeholder="+593123456780"
                  />
                </div>

                {/* Fecha de Nacimiento */}
                <div className="form-group">
                  <label className="form-label">
                    <Calendar size={14} />
                     {" "}  Fecha de Nacimiento
                  </label>
                  <input
                    type="date"
                    value={formatDateForInput(profileData?.fecha_nac)}
                    onChange={(e) => handleProfileInputChange('fecha_nac', e.target.value)}
                    disabled={!editingProfile || saving}
                    className="form-input"
                  />
                </div>

                {/* Sexo */}
                <div className="form-group">
                  <label className="form-label">
                    <User size={14} />
                     {" "}  Sexo
                  </label>
                  <select
                    value={profileData?.sexo || ''}
                    onChange={(e) => handleProfileInputChange('sexo', e.target.value)}
                    disabled={!editingProfile || saving}
                    className="form-input"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                  </select>
                </div>

                {/* Dirección */}
                <div className="form-group form-group-full">
                  <label className="form-label">
                    <MapPin size={14} />
                     {" "}  Dirección
                  </label>
                  <input
                    type="text"
                    value={profileData?.direccion || ''}
                    onChange={(e) => handleProfileInputChange('direccion', e.target.value)}
                    disabled={!editingProfile || saving}
                    className="form-input"
                    placeholder="Ingresa tu dirección"
                  />
                </div>
              </div>
            </div>

            {/* Sección de cambio de contraseña */}
            <div className="profile-password-section">
              <div className="password-section-header">
                <div>
                  <h3>Cambiar Contraseña</h3>
                  <p className="text-sm text-gray-500">
                    Deja estos campos vacíos si no deseas cambiar tu contraseña
                  </p>
                </div>
              </div>
              
              <button 
                onClick={() => setShowPasswordModal(true)} 
                className="btn-primary"
              >
                <Lock size={16} />
                Cambiar Contraseña
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL DE CAMBIO DE CONTRASEÑA */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <Lock size={20} />
                Cambiar Contraseña
              </h3>
              <button 
                onClick={() => setShowPasswordModal(false)} 
                className="modal-close-btn"
                disabled={changingPassword}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {passwordError && (
                <div className="alert alert-error">
                  <AlertCircle size={16} />
                  <span>{passwordError}</span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Nueva Contraseña</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPasswords.new ? 'text' : 'password'}
                    value={passwordData.newPassword}
                    onChange={(e) => handlePasswordInputChange('newPassword', e.target.value)}
                    className="form-input"
                    placeholder="Mínimo 14 caracteres"
                    disabled={changingPassword}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                    className="password-toggle-btn"
                    disabled={changingPassword}
                  >
                    {showPasswords.new ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                
                {passwordData.newPassword && (
                  <div className="password-strength-indicator">
                    <div className="strength-bar-container">
                      <div 
                        className="strength-bar-fill" 
                        style={{ 
                          width: `${passwordStrength.percentage}%`,
                          backgroundColor: passwordStrength.color 
                        }}
                      />
                    </div>
                    <span className="strength-label" style={{ color: passwordStrength.color }}>
                      {passwordStrength.label}
                    </span>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Confirmar Contraseña</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPasswords.confirm ? 'text' : 'password'}
                    value={passwordData.confirmPassword}
                    onChange={(e) => handlePasswordInputChange('confirmPassword', e.target.value)}
                    className="form-input"
                    placeholder="Repite la nueva contraseña"
                    disabled={changingPassword}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                    className="password-toggle-btn"
                    disabled={changingPassword}
                  >
                    {showPasswords.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="password-requirements">
                {Object.entries(validatePasswordComplexity(passwordData.newPassword)).map(([key, req]) => (
                  <div key={key} className={`requirement-item ${req.test ? 'valid' : ''}`}>
                    <span className="requirement-icon">{req.test ? '✓' : '○'}</span>
                    <span className="requirement-text">{req.message}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-footer">
              <button 
                onClick={() => setShowPasswordModal(false)} 
                className="btn-secondary"
                disabled={changingPassword}
              >
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </button>
              <button 
                onClick={handleChangePassword} 
                className="btn-primary"
                disabled={changingPassword}
              >
                {changingPassword ? (
                  <>
                    <RefreshCw size={16} className="spinner" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Guardar Cambios
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileSection;
