// src/pages/ForgotPassword.js
// Página para recuperar la contraseña en varios pasos con CODIGO de verificación
import React, { useState, useEffect } from 'react';
import { Mail, ArrowLeft, AlertCircle, CheckCircle, Key, Lock, RefreshCw, User, Droplets } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import authService from '../services/authServices';
import './ForgotPassword.css';

const ForgotPassword = () => {
  const navigate = useNavigate();
  
  // Estados
  const [step, setStep] = useState(1); // 1: email, 2: código, 3: nueva contraseña
  const [username, setUsername] = useState(''); 
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Timer para reenvío de código
  const [canResend, setCanResend] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);

  // Efecto para el timer de reenvío
  useEffect(() => {
    if (step === 2 && resendTimer > 0) {
      const timer = setTimeout(() => {
        setResendTimer(resendTimer - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (resendTimer === 0) {
      setCanResend(true);
    }
  }, [step, resendTimer]);

  // PASO 1: Solicitar código
  const handleRequestCode = async (e) => {
    e.preventDefault();
    
    // ✅ Validar ambos campos
    if (!username.trim() || !email.trim()) {
      setMessage('Por favor ingresa tu usuario y correo electrónico.');
      setIsError(true);
      return;
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setMessage('Por favor ingresa un correo válido.');
      setIsError(true);
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      // ✅ ORDEN CORRECTO: (username, email)
      const result = await authService.forgotPassword(username, email);
      
      if (result.success) {
        setIsError(false);
        setMessage('Se ha enviado un código de verificación a tu correo.');
        setStep(2);
        setResendTimer(60);
        setCanResend(false);
      } else {
        setIsError(true);
        setMessage(result.message || 'No se pudo enviar el correo.');
      }
    } catch (error) {
      setIsError(true);
      setMessage('Error de conexión. Intenta nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // PASO 2: Verificar código
  const handleVerifyCode = async (e) => {
    e.preventDefault();

    if (!code.trim()) {
      setMessage('Por favor ingresa el código de verificación.');
      setIsError(true);
      return;
    }

    if (code.trim().length !== 6) {
      setMessage('El código debe tener 6 dígitos.');
      setIsError(true);
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      const result = await authService.verifyRecoveryCode(username, email, code);

      if (result.success) {
        setIsError(false);
        setMessage('Código verificado correctamente.');
        setResetToken(result.reset_token);
        setStep(3);
      } else {
        setIsError(true);
        setMessage(result.message || 'Código incorrecto.');
      }
    } catch (error) {
      setIsError(true);
      setMessage('Error al verificar el código.');
    } finally {
      setIsLoading(false);
    }
  };

  // PASO 3: Restablecer contraseña
  const handleResetPassword = async (e) => {
    e.preventDefault();

    // Validaciones
    if (!newPassword.trim() || !confirmPassword.trim()) {
      setMessage('Por favor completa todos los campos.');
      setIsError(true);
      return;
    }

    if (newPassword.length < 8) {
      setMessage('La contraseña debe tener al menos 8 caracteres.');
      setIsError(true);
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage('Las contraseñas no coinciden.');
      setIsError(true);
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      const result = await authService.resetPassword(username, email, resetToken, newPassword);

      if (result.success) {
        setIsError(false);
        setMessage('¡Contraseña restablecida exitosamente!');
        
        // Redirigir al login después de 2 segundos
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else {
        setIsError(true);
        setMessage(result.message || 'No se pudo restablecer la contraseña.');
      }
    } catch (error) {
      setIsError(true);
      setMessage('Error al restablecer la contraseña.');
    } finally {
      setIsLoading(false);
    }
  };

  // Reenviar código
  const handleResendCode = async () => {
    if (!canResend) return;

    setIsLoading(true);
    setMessage('');

    try {
      // ✅ ORDEN CORRECTO: (username, email)
      const result = await authService.resendCode(username, email);
      
      if (result.success) {
        setIsError(false);
        setMessage('Código reenviado exitosamente.');
        setResendTimer(60);
        setCanResend(false);
        setCode('');
      } else {
        setIsError(true);
        setMessage(result.message || 'No se pudo reenviar el código.');
      }
    } catch (error) {
      setIsError(true);
      setMessage('Error al reenviar el código.');
    } finally {
      setIsLoading(false);
    }
  };

  // Volver al paso anterior
  const handleGoBack = () => {
    if (step > 1) {
      setStep(step - 1);
      setMessage('');
      setIsError(false);
    }
  };

  return (
    <div className="forgot-container">
      <div className="forgot-background"></div>
      
      {/* Decoraciones de fondo */}
      <div className="forgot-bg-decoration forgot-bg-decoration-1"></div>
      <div className="forgot-bg-decoration forgot-bg-decoration-2"></div>
      <div className="forgot-bg-decoration forgot-bg-decoration-3"></div>

      <div className="forgot-content">
        <div className="forgot-system-header">
          <div className="forgot-system-logo">
            <Droplets className="forgot-logo-icon" />
          </div>
          <h1 className="forgot-system-title">
            {step === 1 && '🔐 Recuperar Contraseña'}
            {step === 2 && '📧 Verificar Código'}
            {step === 3 && '🔑 Nueva Contraseña'}
          </h1>
          <p className="forgot-system-subtitle">
            {step === 1 && 'Ingresa tu usuario y correo para recibir un código de verificación'}
            {step === 2 && 'Ingresa el código enviado a tu correo'}
            {step === 3 && 'Crea tu nueva contraseña segura'}
          </p>
        </div>

        <div className="forgot-form-container">
          {/* PASO 1: Solicitar código */}
          {step === 1 && (
            <form onSubmit={handleRequestCode} className="forgot-login-form">
              {message && (
                <div className={`forgot-error-message ${isError ? '' : 'forgot-success-message'}`}>
                  {isError ? <AlertCircle className="forgot-error-icon" /> : <CheckCircle className="forgot-error-icon" />}
                  <span>{message}</span>
                </div>
              )}
              <div className="forgot-input-group">
                <label htmlFor="username" className="forgot-input-label">
                  <User className="forgot-label-icon" /> Usuario
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ej: user"
                  className="forgot-form-input"
                  disabled={isLoading}
                  autoComplete="username"
                />
              </div>

              <div className="forgot-input-group">
                <label htmlFor="email" className="forgot-input-label">
                  <Mail className="forgot-label-icon" /> Correo Electrónico
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@correo.com"
                  className="forgot-form-input"
                  disabled={isLoading}
                  autoComplete="email"
                />
              </div>

              <button
                type="submit"
                className="forgot-login-button"
                disabled={isLoading || !email.trim() || !username.trim()}
              >
                {isLoading ? (
                  <div className="forgot-loading-content">
                    <div className="forgot-loading-spinner"></div>
                    <span>Enviando...</span>
                  </div>
                ) : (
                  'Enviar Código'
                )}
              </button>

              <div className="forgot-form-links">
                <Link to="/login" className="forgot-forgot-link">
                  <ArrowLeft className="forgot-inline-icon" /> Volver al inicio de sesión
                </Link>
              </div>
            </form>
          )}

          {/* PASO 2: Verificar código */}
          {step === 2 && (
            <form onSubmit={handleVerifyCode} className="forgot-login-form">
              {message && (
                <div className={`forgot-error-message ${isError ? '' : 'forgot-success-message'}`}>
                  {isError ? <AlertCircle className="forgot-error-icon" /> : <CheckCircle className="forgot-error-icon" />}
                  <span>{message}</span>
                </div>
              )}

              <div className="forgot-input-group">
                <label htmlFor="code" className="forgot-input-label">
                  <Key className="forgot-label-icon" /> Código de Verificación
                </label>
                <input
                  id="code"
                  type="text"
                  value={code}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setCode(value);
                  }}
                  placeholder="123456"
                  className="forgot-form-input forgot-code-input"
                  disabled={isLoading}
                  maxLength={6}
                  autoComplete="off"
                />
                <small className="forgot-code-hint">
                  Revisa tu bandeja de entrada y spam
                </small>
              </div>

              <button
                type="submit"
                className="forgot-login-button"
                disabled={isLoading || code.length !== 6}
              >
                {isLoading ? (
                  <div className="forgot-loading-content">
                    <div className="forgot-loading-spinner"></div>
                    <span>Verificando...</span>
                  </div>
                ) : (
                  'Verificar Código'
                )}
              </button>

              <div className="forgot-links-container">
                {canResend ? (
                  <button
                    type="button"
                    onClick={handleResendCode}
                    className="forgot-secondary-button"
                    disabled={isLoading}
                  >
                    <RefreshCw className="forgot-inline-icon" /> Reenviar código
                  </button>
                ) : (
                  <span className="forgot-resend-timer">
                    Reenviar código en {resendTimer}s
                  </span>
                )}

                <button
                  type="button"
                  onClick={handleGoBack}
                  className="forgot-secondary-button"
                  disabled={isLoading}
                >
                  <ArrowLeft className="forgot-inline-icon" /> Cambiar correo
                </button>
              </div>
            </form>
          )}

          {/* PASO 3: Nueva contraseña */}
          {step === 3 && (
            <form onSubmit={handleResetPassword} className="forgot-login-form">
              {message && (
                <div className={`forgot-error-message ${isError ? '' : 'forgot-success-message'}`}>
                  {isError ? <AlertCircle className="forgot-error-icon" /> : <CheckCircle className="forgot-error-icon" />}
                  <span>{message}</span>
                </div>
              )}

              <div className="forgot-input-group">
                <label htmlFor="newPassword" className="forgot-input-label">
                  <Lock className="forgot-label-icon" /> Nueva Contraseña
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="forgot-form-input"
                  disabled={isLoading}
                  autoComplete="new-password"
                />
              </div>

              <div className="forgot-input-group">
                <label htmlFor="confirmPassword" className="forgot-input-label">
                  <Lock className="forgot-label-icon" /> Confirmar Contraseña
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite la contraseña"
                  className="forgot-form-input"
                  disabled={isLoading}
                  autoComplete="new-password"
                />
              </div>

              {/* Indicador de fortaleza de contraseña */}
              {newPassword && (
                <div className="forgot-validation-list">
                  <div className={`forgot-validation-item ${newPassword.length >= 8 ? 'valid' : 'invalid'}`}>
                    {newPassword.length >= 8 ? '✓' : '✗'} Mínimo 8 caracteres
                  </div>
                  <div className={`forgot-validation-item ${newPassword === confirmPassword && confirmPassword ? 'valid' : 'invalid'}`}>
                    {newPassword === confirmPassword && confirmPassword ? '✓' : '✗'} Las contraseñas coinciden
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="forgot-login-button"
                disabled={
                  isLoading || 
                  !newPassword.trim() || 
                  !confirmPassword.trim() ||
                  newPassword.length < 8 ||
                  newPassword !== confirmPassword
                }
              >
                {isLoading ? (
                  <div className="forgot-loading-content">
                    <div className="forgot-loading-spinner"></div>
                    <span>Guardando...</span>
                  </div>
                ) : (
                  'Restablecer Contraseña'
                )}
              </button>

              <div className="forgot-form-links">
                <button
                  type="button"
                  onClick={handleGoBack}
                  className="forgot-secondary-button"
                  disabled={isLoading}
                >
                  <ArrowLeft className="forgot-inline-icon" /> Volver
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Indicador de progreso */}
        <div className="forgot-progress-container">
          <div className={`forgot-progress-step ${step >= 1 ? 'active' : ''}`} />
          <div className={`forgot-progress-step ${step >= 2 ? 'active' : ''}`} />
          <div className={`forgot-progress-step ${step >= 3 ? 'active' : ''}`} />
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;