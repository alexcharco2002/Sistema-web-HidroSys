// src/compontes/ChangePasswordModal.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Lock, Eye, EyeOff, AlertCircle, CheckCircle, Mail, Key, RefreshCw, Shield, Check, X as XIcon } from 'lucide-react';
import authService from '../services/authServices';
import userService from '../services/userServices';
import './ChangePasswordModal.css';

const ChangePasswordModal = ({ isOpen, onClose, userId, userEmail, isPrimerLogin = false, onSuccess }) => {
  // Estados principales
  const hasRequestedCodeRef = useRef(false);
  const [step, setStep] = useState(1);
  const [code, setCode] = useState('');
  const [, setResetToken] = useState('');

  // Contraseñas
  const [, setCurrentPassword] = useState('');
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

  // Estados para validación de contraseña
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, label: '', color: '' });
  const [passwordValidation, setPasswordValidation] = useState({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecial: false
  });

  // ============================================================
  // VALIDACIÓN DE CONTRASEÑA - POLÍTICAS DE SEGURIDAD
  // ============================================================

  const validatePassword = useCallback((password) => {
    // Regex para cada requisito
    const minLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\]{};':"\\|,.<>?]/.test(password);

    // Actualizar estado de validación
    setPasswordValidation({
      minLength,
      hasUppercase,
      hasLowercase,
      hasNumber,
      hasSpecial
    });

    // Calcular fortaleza
    const metCriteria = [minLength, hasUppercase, hasLowercase, hasNumber, hasSpecial].filter(Boolean).length;

    let strength = { score: 0, label: '', color: '' };

    if (password.length === 0) {
      strength = { score: 0, label: '', color: '' };
    } else if (metCriteria <= 2) {
      strength = { score: 1, label: 'Débil', color: '#ef4444' }; // rojo
    } else if (metCriteria === 3 || metCriteria === 4) {
      strength = { score: 2, label: 'Media', color: '#f59e0b' }; // naranja
    } else if (metCriteria === 5) {
      strength = { score: 3, label: 'Fuerte', color: '#10b981' }; // verde
    }

    setPasswordStrength(strength);

    // Retornar si cumple TODOS los requisitos
    return minLength && hasUppercase && hasLowercase && hasNumber && hasSpecial;
  }, []);

  // Actualizar validación cuando cambia la contraseña
  useEffect(() => {
    if (newPassword) {
      validatePassword(newPassword);
    } else {
      setPasswordValidation({
        minLength: false,
        hasUppercase: false,
        hasLowercase: false,
        hasNumber: false,
        hasSpecial: false
      });
      setPasswordStrength({ score: 0, label: '', color: '' });
    }
  }, [newPassword, validatePassword]);

  // ============================================================
  // RESTO DEL CÓDIGO ORIGINAL
  // ============================================================

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
  const handleRequestCode = useCallback(async () => {
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

      if (isPrimerLogin && !hasRequestedCodeRef.current) {
        hasRequestedCodeRef.current = true;
        handleRequestCode();
      }
    } else {
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

  // PASO 2: Cambiar contraseña (CON VALIDACIÓN MEJORADA)
  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (!newPassword.trim() || !confirmPassword.trim()) {
      setMessage('Por favor completa todos los campos.');
      setIsError(true);
      return;
    }

    // Validación completa de complejidad
    const isValid = validatePassword(newPassword);
    if (!isValid) {
      setMessage('La contraseña no cumple con todos los requisitos de seguridad.');
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
    <div className="modal-overlay">
      <div className="modal-container">
        {/* Header */}
        <div className="modal-header">
          <div className="modal-header-content">
            <Shield className="modal-icon" />
            <div>
              <h2 className="modal-title">
                {step === 1 ? 'Verificación de Identidad' : 'Cambio de Contraseña'}
              </h2>
              <p className="modal-subtitle">
                {step === 1
                  ? 'Verifica tu identidad con el código enviado a tu correo'
                  : 'Crea una contraseña segura'}
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="modal-close-btn" disabled={isLoading}>
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {/* PASO 1: Verificación de código */}
          {step === 1 && (
            <form onSubmit={handleVerifyCode} className="modal-form">
              <div className="form-group">
                <label className="form-label">
                  <Mail size={18} />
                  Correo electrónico
                </label>
                <input
                  type="email"
                  value={userEmail}
                  disabled
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  <Key size={18} />
                  Código de verificación (6 dígitos)
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  className="form-input"
                  maxLength={6}
                  disabled={isLoading}
                />
              </div>

              <div className="resend-container">
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={!canResend || isLoading}
                  className="resend-btn"
                >
                  <RefreshCw size={16} />
                  {canResend ? 'Reenviar código' : `Reenviar en ${resendTimer}s`}
                </button>
              </div>

              <button type="submit" className="submit-btn" disabled={isLoading || code.length !== 6}>
                {isLoading ? 'Verificando...' : 'Verificar código'}
              </button>
            </form>
          )}

          {/* PASO 2: Cambio de contraseña CON POLÍTICAS */}
          {step === 2 && (
            <form onSubmit={handleChangePassword} className="modal-form">
              {/* POLÍTICA DE CONTRASEÑAS - REQUISITOS */}
              <div className="password-policy-box">
                <h3 className="policy-title">📋 Requisitos de contraseña</h3>
                <ul className="policy-list">
                  <li className={passwordValidation.minLength ? 'policy-met' : 'policy-unmet'}>
                    {passwordValidation.minLength ? <Check size={16} /> : <XIcon size={16} />}
                    Mínimo 8 caracteres
                  </li>
                  <li className={passwordValidation.hasUppercase ? 'policy-met' : 'policy-unmet'}>
                    {passwordValidation.hasUppercase ? <Check size={16} /> : <XIcon size={16} />}
                    Al menos una letra mayúscula (A-Z)
                  </li>
                  <li className={passwordValidation.hasLowercase ? 'policy-met' : 'policy-unmet'}>
                    {passwordValidation.hasLowercase ? <Check size={16} /> : <XIcon size={16} />}
                    Al menos una letra minúscula (a-z)
                  </li>
                  <li className={passwordValidation.hasNumber ? 'policy-met' : 'policy-unmet'}>
                    {passwordValidation.hasNumber ? <Check size={16} /> : <XIcon size={16} />}
                    Al menos un número (0-9)
                  </li>
                  <li className={passwordValidation.hasSpecial ? 'policy-met' : 'policy-unmet'}>
                    {passwordValidation.hasSpecial ? <Check size={16} /> : <XIcon size={16} />}
                    Al menos un carácter especial (!@#$%^&*)
                  </li>
                </ul>
              </div>

              {/* Nueva contraseña */}
              <div className="form-group">
                <label className="form-label">
                  <Lock size={18} />
                  Nueva contraseña
                </label>
                <div className="password-input-container">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Ingresa tu nueva contraseña"
                    className="form-input"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="password-toggle-btn"
                  >
                    {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>

                {/* INDICADOR DE FORTALEZA */}
                {newPassword && (
                  <div className="password-strength-container">
                    <div className="strength-bars">
                      <div
                        className={`strength-bar ${passwordStrength.score >= 1 ? 'active' : ''}`}
                        style={{ backgroundColor: passwordStrength.score >= 1 ? passwordStrength.color : '#e5e7eb' }}
                      />
                      <div
                        className={`strength-bar ${passwordStrength.score >= 2 ? 'active' : ''}`}
                        style={{ backgroundColor: passwordStrength.score >= 2 ? passwordStrength.color : '#e5e7eb' }}
                      />
                      <div
                        className={`strength-bar ${passwordStrength.score >= 3 ? 'active' : ''}`}
                        style={{ backgroundColor: passwordStrength.score >= 3 ? passwordStrength.color : '#e5e7eb' }}
                      />
                    </div>
                    <span className="strength-label" style={{ color: passwordStrength.color }}>
                      {passwordStrength.label}
                    </span>
                  </div>
                )}
              </div>

              {/* Confirmar contraseña */}
              <div className="form-group">
                <label className="form-label">
                  <Lock size={18} />
                  Confirmar contraseña
                </label>
                <div className="password-input-container">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirma tu nueva contraseña"
                    className="form-input"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="password-toggle-btn"
                  >
                    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <button type="submit" className="submit-btn" disabled={isLoading}>
                {isLoading ? 'Cambiando...' : 'Cambiar contraseña'}
              </button>
            </form>
          )}

          {/* Mensajes de estado */}
          {message && (
            <div className={`message ${isError ? 'message-error' : 'message-success'}`}>
              {isError ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
              <span>{message}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChangePasswordModal;