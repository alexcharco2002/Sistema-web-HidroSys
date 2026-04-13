// src/pages/Login.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Droplets, User, Lock, Eye, EyeOff, AlertCircle, Facebook, Instagram, Mail, ArrowLeft } from 'lucide-react';
import authService from '../services/authServices';
import './Login.css';

const Login = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authService.isAuthenticated()) {
      const user = authService.getCurrentUser();
      if (user) {
        const redirectRoute = authService.getRoleBasedRoute();
        navigate(redirectRoute, { replace: true });
      }
    }
  }, [navigate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleSubmit();
  };

  const handleSubmit = async () => {
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

    setIsLoading(true);
    setError('');
    try {
      const response = await authService.login({
        username: formData.username,
        password: formData.password
      });
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

  return (
    <div className="lv2-container">

      {/* ── PANEL IZQUIERDO ── */}
      <div className="lv2-left">
        <div className="lv2-left-bg" />
        <div className="lv2-left-overlay" />
        <div className="lv2-left-pattern" />

        <div className="lv2-brand">
          <div className="lv2-brand-icon">
            <Droplets className="lv2-droplets-icon" />
          </div>
          <h1 className="lv2-brand-name">TecniCobro 2.0</h1>
          <p className="lv2-brand-sub">JAAP Sanjapamba</p>

          <div className="lv2-divider-short" />

          <ul className="lv2-taglines">
            <li><span className="lv2-dot" />Gestión inteligente del agua</li>
            <li><span className="lv2-dot" />Facturación automatizada</li>
            <li><span className="lv2-dot" />Reportes en tiempo real</li>
            <li><span className="lv2-dot" />Transparencia y eficiencia</li>
          </ul>
        </div>

        <div className="lv2-left-footer">
          <span className="lv2-footer-label">Síguenos</span>
          <a href="https://facebook.com/jaapsanjapamba" target="_blank" rel="noopener noreferrer" className="lv2-social-btn" title="Facebook">
            <Facebook size={15} />
          </a>
          <a href="https://instagram.com/jaapsanjapamba" target="_blank" rel="noopener noreferrer" className="lv2-social-btn" title="Instagram">
            <Instagram size={15} />
          </a>
          <a href="mailto:sanjapambaj@gmail.com" className="lv2-social-btn" title="Email">
            <Mail size={15} />
          </a>
        </div>
      </div>

      {/* ── PANEL DERECHO ── */}
      <div className="lv2-right">
        <div className="lv2-form-card">

          <button className="lv2-back-btn" onClick={() => window.location.href = '/'}>
            <ArrowLeft size={15} />
            Volver al inicio
          </button>

          <div className="lv2-form-header">
            <h2 className="lv2-form-title">Bienvenido de vuelta</h2>
            <p className="lv2-form-subtitle">Accede a tu cuenta del sistema web TecniCobro 2.0</p>
          </div>

          {error && (
            <div className="lv2-error-alert">
              <AlertCircle size={18} className="lv2-error-icon" />
              <span>{error}</span>
            </div>
          )}

          <form className="lv2-form" onSubmit={(e) => e.preventDefault()}>

            <div className="lv2-field">
              <label htmlFor="username" className="lv2-label">Usuario</label>
              <div className="lv2-input-wrap">
                <User size={17} className="lv2-input-icon" />
                <input
                  id="username"
                  name="username"
                  type="text"
                  placeholder="Ingresa tu usuario"
                  className="lv2-input"
                  value={formData.username}
                  onChange={handleInputChange}
                  onKeyPress={handleKeyPress}
                  disabled={isLoading}
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="lv2-field">
              <label htmlFor="password" className="lv2-label">Contraseña</label>
              <div className="lv2-input-wrap">
                <Lock size={17} className="lv2-input-icon" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Ingresa tu contraseña"
                  className="lv2-input lv2-input--password"
                  value={formData.password}
                  onChange={handleInputChange}
                  onKeyPress={handleKeyPress}
                  disabled={isLoading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="lv2-eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <div className="lv2-forgot-row">
              <a href="/forgot-password" className="lv2-forgot-link">¿Olvidaste tu contraseña?</a>
            </div>

            <button
              type="button"
              className="lv2-submit-btn"
              onClick={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="lv2-loading">
                  <span className="lv2-spinner" />
                  Iniciando sesión...
                </span>
              ) : 'Iniciar Sesión'}
            </button>

          </form>

          <div className="lv2-divider">
            <span className="lv2-divider-line" />
            <span className="lv2-divider-text">Síguenos en redes sociales</span>
            <span className="lv2-divider-line" />
          </div>

          <div className="lv2-social-row">
            <a
              href="https://facebook.com/jaapsanjapamba"
              target="_blank"
              rel="noopener noreferrer"
              className="lv2-social-link-btn"
            >
              <Facebook size={17} />
              Facebook
            </a>
            <a
              href="https://instagram.com/jaapsanjapamba"
              target="_blank"
              rel="noopener noreferrer"
              className="lv2-social-link-btn"
            >
              <Instagram size={17} />
              Instagram
            </a>
          </div>

          <div className="lv2-card-footer">
            <p className="lv2-footer-brand">TecniCobro 2.0 — Sistema web de Facturación v2.0</p>
            <p className="lv2-footer-copy">JAAP Sanjapamba © 2025 — Todos los derechos reservados</p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Login;