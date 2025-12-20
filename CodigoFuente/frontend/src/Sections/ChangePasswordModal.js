// src/sections/ChangePasswordModal.js
import React, { useState, useEffect , useCallback, useRef } from 'react';
import { 
  X, 
  Lock, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  CheckCircle, 
  Mail,
  Key,
  RefreshCw,
  Shield
} from 'lucide-react';
import authService from '../services/authServices';
import userService from '../services/userServices';
import './ChangePasswordModal.css';

const ChangePasswordModal = ({ 
  isOpen, 
  onClose, 
  userId, 
  userEmail,
  isPrimerLogin = false,
  onSuccess 
}) => {
  // Estados principales
  const hasRequestedCodeRef = useRef(false); 
  const [step, setStep] = useState(1); // 1: verificación email, 2: cambio contraseña
  const [code, setCode] = useState('');
  const [, setResetToken] = useState('');
  
  // Contraseñas
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Visibilidad de contraseñas

  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Estados de UI
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Timer para reenvío de código
  const [canResend, setCanResend] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);

  // Timer para reenvío
  useEffect(() => {
    if (step === 1 && resendTimer > 0) {
      const timer = setTimeout(() => {
        setResendTimer(resendTimer - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (resendTimer === 0) {
      setCanResend(true);
    }
  }, [step, resendTimer]);

  // PASO 1: Solicitar código de verificación
  const handleRequestCode = useCallback (async () => {
    setIsLoading(true);
    setMessage('');

    try {
      const result = await authService.forgotPassword(userEmail);

      if (result.success) {
        setIsError(false);
        setMessage('Se ha enviado un código de verificación a tu correo.');
        setResendTimer(60);
        setCanResend(false);
      } else {
        setIsError(true);
        setMessage(result.message || 'No se pudo enviar el correo.');
      }
    } catch (error) {
      setIsError(true);
      setMessage('Error al enviar el código de verificación.');
    } finally {
      setIsLoading(false);
    }
  }, [userEmail]);

  // Resetear estados al abrir/cerrar
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setCode('');
      setResetToken('');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage('');
      setIsError(false);
      setResendTimer(60);
      setCanResend(false);
      
      // Si es primer login, solicitar código automáticamente
      if (isPrimerLogin && !hasRequestedCodeRef.current) {
        hasRequestedCodeRef.current = true;
        handleRequestCode();
      }
    }else {
      hasRequestedCodeRef.current = false;
    }
  }, [isOpen, isPrimerLogin, handleRequestCode]);

  

  // PASO 1: Verificar código
  const handleVerifyCode = async (e) => {
    e.preventDefault();

    if (!code.trim() || code.length !== 6) {
      setMessage('Por favor ingresa el código de 6 dígitos.');
      setIsError(true);
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      const result = await authService.verifyRecoveryCode(userEmail, code);

      if (result.success) {
        setIsError(false);
        setMessage('Código verificado correctamente.');
        setResetToken(result.reset_token);
        setStep(2);
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

  // PASO 2: Cambiar contraseña
  const handleChangePassword = async (e) => {
    e.preventDefault();

    

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
      const result = await userService.changePasswordFirstLogin(userId, newPassword);


      if (result.success) {
        setIsError(false);
        setMessage('¡Contraseña actualizada exitosamente!');
        
        setTimeout(() => {
          if (onSuccess) {
            onSuccess();
          }
          handleClose();
        }, 1500);
      } else {
        setIsError(true);
        setMessage(result.message || 'No se pudo cambiar la contraseña.');
      }
    } catch (error) {
      setIsError(true);
      setMessage('Error al cambiar la contraseña.');
    } finally {
      setIsLoading(false);
    }
  };

  // Reenviar código
  const handleResendCode = async () => {
    if (!canResend) return;
    await handleRequestCode();
  };

  // Cerrar modal
  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-section">
            <Shield className="modal-icon" />
            <div>
              <h2 className="modal-title">
                {isPrimerLogin ? 'Cambio de Contraseña Obligatorio' : 'Cambiar Contraseña'}
              </h2>
              <p className="modal-subtitle">
                {step === 1 
                  ? 'Verifica tu identidad con el código enviado a tu correo' 
                  : 'Crea una contraseña segura'
                }
              </p>
            </div>
          </div>
          {!isPrimerLogin && (
            <button onClick={handleClose} className="modal-close-btn" disabled={isLoading}>
              <X size={20} />
            </button>
          )}
        </div>

        {/* Contenido */}
        <div className="modal-body">
          {/* Mensaje de primer login */}
          {isPrimerLogin && step === 1 && (
            <div className="first-login-notice">
              <AlertCircle size={20} />
              <span>
                Por seguridad, debes cambiar tu contraseña en el primer inicio de sesión.
              </span>
            </div>
          )}

          {/* Mensaje de feedback */}
          {message && (
            <div className={`alert-message ${isError ? 'alert-error' : 'alert-success'}`}>
              {isError ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
              <span>{message}</span>
            </div>
          )}

          {/* PASO 1: Verificar código */}
          {step === 1 && (
            <form onSubmit={handleVerifyCode} className="password-form">
              <div className="form-group">
                <label className="form-label">
                  <Key size={16} />
                  Código de Verificación
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setCode(value);
                  }}
                  placeholder="123456"
                  className="form-input code-input"
                  disabled={isLoading}
                  maxLength={6}
                  autoComplete="off"
                  autoFocus
                />
                <small className="form-hint">
                  <Mail size={14} /> Enviado a: {userEmail}
                </small>
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={isLoading || code.length !== 6}
              >
                {isLoading ? 'Verificando...' : 'Verificar Código'}
              </button>

              {/* Reenviar código */}
              <div className="resend-section">
                {canResend ? (
                  <button
                    type="button"
                    onClick={handleResendCode}
                    className="btn-link"
                    disabled={isLoading}
                  >
                    <RefreshCw size={16} />
                    Reenviar código
                  </button>
                ) : (
                  <span className="timer-text">
                    Reenviar código en {resendTimer}s
                  </span>
                )}
              </div>
            </form>
          )}

          {/* PASO 2: Cambiar contraseña */}
          {step === 2 && (
            <form onSubmit={handleChangePassword} className="password-form">
            
              {/* Nueva contraseña */}
              <div className="form-group">
                <label className="form-label">
                  <Lock size={16} />
                  Nueva Contraseña
                </label>
                <div className="input-with-icon">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="form-input"
                    disabled={isLoading}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="icon-btn"
                    tabIndex={-1}
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Confirmar contraseña */}
              <div className="form-group">
                <label className="form-label">
                  <Lock size={16} />
                  Confirmar Nueva Contraseña
                </label>
                <div className="input-with-icon">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite la nueva contraseña"
                    className="form-input"
                    disabled={isLoading}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="icon-btn"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Indicadores de validación */}
              {newPassword && (
                <div className="password-requirements">
                  <div className={newPassword.length >= 8 ? 'requirement-met' : 'requirement-unmet'}>
                    {newPassword.length >= 8 ? '✓' : '✗'} Mínimo 8 caracteres
                  </div>
                  <div className={
                    newPassword === confirmPassword && confirmPassword 
                      ? 'requirement-met' 
                      : 'requirement-unmet'
                  }>
                    {newPassword === confirmPassword && confirmPassword ? '✓' : '✗'} Las contraseñas coinciden
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="btn-primary"
                disabled={
                  isLoading ||
                  (!isPrimerLogin && !currentPassword.trim()) ||
                  !newPassword.trim() ||
                  !confirmPassword.trim() ||
                  newPassword.length < 8 ||
                  newPassword !== confirmPassword
                }
              >
                {isLoading ? 'Guardando...' : 'Cambiar Contraseña'}
              </button>
            </form>
          )}
        </div>

        {/* Indicador de progreso */}
        <div className="progress-indicator">
          <div className={`progress-step ${step >= 1 ? 'active' : ''}`} />
          <div className={`progress-step ${step >= 2 ? 'active' : ''}`} />
        </div>
      </div>
    </div>
  );
};

export default ChangePasswordModal;