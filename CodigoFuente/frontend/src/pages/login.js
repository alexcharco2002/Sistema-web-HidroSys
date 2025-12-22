// src/pages/Login.js 
// Login actualizado para funcionar con el dashboard universal
import React, { useState, useEffect } from 'react'; 
import { useNavigate } from 'react-router-dom';
import { User, Lock, Eye, EyeOff, Droplets, AlertCircle } from 'lucide-react';
import authService from '../services/authServices';
import './Login.css';


const Login = () => {
  const navigate = useNavigate();
  //const location = useLocation();

  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [step, setStep] = useState('credentials'); // 'credentials' | 'otp'
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);


  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    const pending = authService.getPendingOtp?.();
    if (pending) {
      setStep('otp');
      setOtpEmail(pending.email);
      const remaining = Math.max(0, Math.floor((pending.expiresAt - Date.now()) / 1000));
      setTimeLeft(remaining);
    }
  }, []);


  // Verificar si ya está autenticado
  useEffect(() => {
    if (authService.isAuthenticated()) {
      const user = authService.getCurrentUser();
      
      if (user) {
        console.log('✅ Usuario ya autenticado, redirigiendo...');
        // 🔥 Obtener ruta dinámica según el rol
        const redirectRoute = authService.getRoleBasedRoute();
        console.log(`🔀 Redirigiendo a: ${redirectRoute}`);
        navigate(redirectRoute, { replace: true });
      }
    }
  }, [navigate]);

  useEffect(() => {
    if (step !== 'otp' || !timeLeft) return;
    const t = setInterval(() => setTimeLeft(prev => (prev > 0 ? prev - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [step, timeLeft]);

  const maskEmail = (email) => {
    if (!email) return '';
    const [user, domain] = email.split('@');
    const u = user.length <= 2 ? user[0] + '*' : user[0] + '*'.repeat(Math.max(1, user.length-2)) + user.slice(-1);
    return `${u}@${domain}`;
  };


  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Limpiar error cuando el usuario empieza a escribir
    if (error) setError('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    // Validaciones básicas
    if (!formData.username.trim() || !formData.password) {
      setError('Por favor completa todos los campos');
      return;
    }

    if (formData.username.length < 3) {
      setError('El usuario debe tener al menos 3 caracteres');
      return;
    }

    if (formData.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    setIsLoading(true); setError('');
    try {
      const response = await authService.login({ username: formData.username, password: formData.password });
      if (response.success && response.requiresOtp) {
        setStep('otp');
        setOtpEmail(response.email);
        setTimeLeft((response.expiresInMinutes || 5) * 60);
        setFormData({ username: '', password: '' });
        return;
      }
      if (response.success) {
        const redirectRoute = authService.getRoleBasedRoute();
        setTimeout(() => navigate(redirectRoute, { replace: true }), 300);
      } else {
        setError(response.message || 'Error en el login');
      }
    } catch (err) {
      setError(typeof err.message === 'string' ? err.message : 'Error de conexión.');
    } finally {
      setIsLoading(false);
    }

  };

  const handleVerifyOtp = async () => {
  if (!otpCode || otpCode.trim().length < 6) {
    setOtpError('Ingresa el código de 6 dígitos');
    return;
  }
  setOtpLoading(true); setOtpError('');
  try {
    const result = await authService.verifyOtp(otpEmail, otpCode);
    if (result.success) {
      const redirectRoute = result.redirectTo || authService.getRoleBasedRoute();
      navigate(redirectRoute, { replace: true });
    } else {
      setOtpError(result.message || 'Código inválido');
    }
  } catch (e) {
    setOtpError('No se pudo verificar el código');
  } finally {
    setOtpLoading(false);
  }
};

const handleResendOtp = async () => {
  if (!otpEmail) return;
  try {
    const r = await authService.resendOtp(otpEmail);
    if (r.success) {
      setTimeLeft(((r.expires_in_minutes || 5) * 60));
    } else {
      setOtpError(r.message || 'No se pudo reenviar el código');
    }
  } catch {
    setOtpError('Error reenviando el código');
  }
};


// Formatear tiempo restante MM:SS
const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

// Cancelar verificación OTP y volver a credenciales
const handleCancelOtp = () => {
  authService.clearLocalData();
  setStep('credentials');
  setOtpCode('');
  setOtpError('');
  setOtpEmail('');
  setTimeLeft(0);
  setFormData({ username: '', password: '' });
};


  return (
  <div className="login-container">
    <div className="login-background">
      <div className="bg-decoration bg-decoration-1"></div>
      <div className="bg-decoration bg-decoration-2"></div>
      <div className="bg-decoration bg-decoration-3"></div>
    </div>
    
    <div className="login-content">
      {/* Header del sistema */}
      <div className="system-header">
        <div className="system-logo">
          <Droplets className="logo-icon" />
        </div>
        <h1 className="system-title">
          TecniCobro
        </h1>
        <p className="system-subtitle">JAAP Sanjapamba - Sistema de Facturación</p>
      </div>

      {/* Formulario de login */}
      <div className="login-form-container">
        <div className="login-form">
          
          {/* ========================================
              PASO 1: CREDENCIALES (Usuario + Contraseña)
          ======================================== */}
          {step === 'credentials' && (
            <>
              <div className="form-header">
                <h2 className="form-title">Iniciar Sesión</h2>
                <p className="form-subtitle">Accede a tu cuenta</p>
              </div>

              {error && (
                <div className="error-message">
                  <AlertCircle className="error-icon" />
                  <span>{error}</span>
                </div>
              )}

              {/* Campo Usuario */}
              <div className="input-group">
                <label htmlFor="username" className="input-label">
                  <User className="label-icon" />
                  Usuario
                </label>
                <input
                  id="username"
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  onKeyPress={handleKeyPress}
                  className="form-input"
                  placeholder="Ingresa tu usuario"
                  disabled={isLoading}
                  autoComplete="username"
                />
              </div>

              {/* Campo Contraseña */}
              <div className="input-group">
                <label htmlFor="password" className="input-label">
                  <Lock className="label-icon" />
                  Contraseña
                </label>
                <div className="input-container">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    onKeyPress={handleKeyPress}
                    className="form-input password-input"
                    placeholder="Ingresa tu contraseña"
                    disabled={isLoading}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="password-toggle"
                    disabled={isLoading}
                    tabIndex="-1"
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showPassword ? <EyeOff className="toggle-icon" /> : <Eye className="toggle-icon" />}
                  </button>
                </div>
              </div>

              {/* Botón de login */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isLoading || !formData.username.trim() || !formData.password}
                className="login-button"
              >
                {isLoading ? (
                  <div className="loading-content">
                    <div className="loading-spinner"></div>
                    <span>Verificando credenciales...</span>
                  </div>
                ) : (
                  'Continuar'
                )}
              </button>

              {/* Enlaces adicionales */}
              <div className="form-links">
                <a href="/forgot-password" className="forgot-link">
                  ¿Olvidaste tu contraseña?
                </a>
              </div>
            </>
          )}

          {/* ========================================
              PASO 2: VERIFICACIÓN OTP (Doble Factor)
          ======================================== */}
          {step === 'otp' && (
            <>
              <div className="form-header">
                <h2 className="form-title">🔐 Verificación en dos pasos</h2>
                <p className="form-subtitle">
                  Hemos enviado un código de 6 dígitos a:<br />
                  <strong>{maskEmail(otpEmail)}</strong>
                </p>
                {timeLeft > 0 && (
                  <p className="form-subtitle" style={{ marginTop: '8px', color: '#22c55e', fontWeight: '500' }}>
                    ⏱️ Expira en: {formatTime(timeLeft)}
                  </p>
                )}
                {timeLeft === 0 && (
                  <p className="form-subtitle" style={{ marginTop: '8px', color: '#ef4444', fontWeight: '500' }}>
                    ⏱️ Código expirado
                  </p>
                )}
              </div>

              {otpError && (
                <div className="error-message">
                  <AlertCircle className="error-icon" />
                  <div className="error-content">
                    <strong>Error de verificación</strong>
                    <p>{otpError}</p>
                  </div>
                </div>
              )}

              {/* Input código OTP */}
              <div className="input-group">
                <label htmlFor="otp" className="input-label">
                  Código de verificación
                </label>
                <div className="input-container">
                  <input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    className="form-input otp-input"
                    placeholder="000000"
                    value={otpCode}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      setOtpCode(value);
                      if (otpError) setOtpError('');
                    }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && otpCode.length === 6) {
                        handleVerifyOtp();
                      }
                    }}
                    disabled={otpLoading || timeLeft === 0}
                    autoComplete="off"
                    autoFocus
                  />
                </div>
                <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem', textAlign: 'center' }}>
                  Ingresa el código de 6 dígitos que recibiste por correo
                </p>
              </div>

              {/* Botón verificar OTP */}
              <button
                type="button"
                onClick={handleVerifyOtp}
                disabled={otpLoading || otpCode.length !== 6 || timeLeft === 0}
                className="login-button"
              >
                {otpLoading ? (
                  <div className="loading-content">
                    <div className="loading-spinner"></div>
                    <span>Verificando código...</span>
                  </div>
                ) : (
                  'Verificar código'
                )}
              </button>

              {/* Acciones OTP */}
              <div className="form-links" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="forgot-link"
                    onClick={handleResendOtp}
                    disabled={timeLeft > 240 || resendLoading}
                    style={{ opacity: timeLeft > 240 ? 0.5 : 1, cursor: timeLeft > 240 ? 'not-allowed' : 'pointer' }}
                  >
                    {resendLoading ? 'Reenviando...' : timeLeft > 240 ? `Reenviar en ${Math.ceil((timeLeft - 240) / 60)}m` : '🔄 Reenviar código'}
                  </button>
                  
                  <span style={{ color: '#cbd5e1' }}>|</span>
                  
                  <button
                    type="button"
                    className="forgot-link"
                    onClick={handleCancelOtp}
                    disabled={otpLoading}
                  >
                    ← Volver
                  </button>
                </div>

                {timeLeft === 0 && (
                  <div style={{ 
                    background: '#fef3c7', 
                    border: '1px solid #fbbf24', 
                    borderRadius: '8px', 
                    padding: '12px',
                    fontSize: '0.875rem',
                    color: '#92400e',
                    textAlign: 'center'
                  }}>
                    <strong>⚠️ Código expirado</strong><br />
                    Solicita un nuevo código o vuelve a iniciar sesión
                  </div>
                )}
              </div>
            </>
          )}

        </div>
      </div>

      {/* Footer */}
      <div className="system-footer">
        <p>Sistema de Facturación de Agua v2.0</p>
        <p className="footer-tech">Todos los derechos reservados @2025</p>
      </div>
    </div>
  </div>
);

};

export default Login;