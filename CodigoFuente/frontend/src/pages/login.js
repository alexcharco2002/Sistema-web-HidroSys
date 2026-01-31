// src/pages/Login.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Eye, EyeOff, Droplets, AlertCircle, Facebook, Instagram, Mail, ChevronLeft, ChevronRight } from 'lucide-react';
import authService from '../services/authServices';
import './Login.css';

const Login = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentSlide, setCurrentSlide] = useState(0);

  // Carrusel de imágenes/contenido
  const slides = [
    {
      title: "Gestión Inteligente del Agua",
      description: "Sistema integrado de facturación y control para la Junta de Agua Potable de Sanjapamba.",
      image: "/img/imagenjaap1.jpg"
    },
    {
      title: "Tecnología al Servicio de la Comunidad",
      description: "Automatización de procesos de facturación, lectura de medidores y gestión de pagos.",
      image: "/img/imagenjaap2.jpeg"
    },
    {
      title: "Transparencia y Eficiencia",
      description: "Control total de consumos, reportes en tiempo real y atención ágil a la comunidad.",
      image: "/img/imagenjaap3.jpeg"
    }
  ];

  useEffect(() => {
    if (authService.isAuthenticated()) {
      const user = authService.getCurrentUser();
      if (user) {
        console.log('✅ Usuario ya autenticado, redirigiendo...');
        const redirectRoute = authService.getRoleBasedRoute();
        console.log(`🔀 Redirigiendo a: ${redirectRoute}`);
        navigate(redirectRoute, { replace: true });
      }
    }
  }, [navigate]);

  // Auto-avance del carrusel cada 5 segundos
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 25000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
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

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const goToSlide = (index) => {
    setCurrentSlide(index);
  };

  return (
    <div className="login-main-container">
      <div className="login-main-background"></div>
      
      <div className="login-main-wrapper">
        {/* Panel Izquierdo - Carrusel */}
        <div className="login-l1-hero-panel">
          <div className="login-l1-carousel-container">
            {/* Logo fijo en la parte superior izquierda */}
            <div className="login-l1-fixed-logo">
              <div className="login-l1-logo-container">
                <Droplets className="login-l1-logo-icon" />
              </div>
              <div className="login-l1-brand-text">
                <h1 className="login-l1-brand-name">TecniCobro</h1>
                <p className="login-l1-brand-subtitle">JAAP Sanjapamba</p>
              </div>
            </div>

            {/* Slides */}
            <div className="login-l1-carousel-slides">
              {slides.map((slide, index) => (
                <div
                  key={index}
                  className={`login-l1-carousel-slide ${index === currentSlide ? 'active' : ''}`}
                  style={{
                    backgroundImage: `url(${slide.image})`
                  }}
                >
                  
                </div>
              ))}
            </div>

            {/* Controles de navegación */}
            <button
              className="login-l1-carousel-control login-l1-control-prev"
              onClick={prevSlide}
              aria-label="Anterior"
            >
              <ChevronLeft size={28} />
            </button>
            <button
              className="login-l1-carousel-control login-l1-control-next"
              onClick={nextSlide}
              aria-label="Siguiente"
            >
              <ChevronRight size={28} />
            </button>

            {/* Indicadores */}
            <div className="login-l1-carousel-indicators">
              {slides.map((_, index) => (
                <button
                  key={index}
                  className={`login-l1-indicator ${index === currentSlide ? 'active' : ''}`}
                  onClick={() => goToSlide(index)}
                  aria-label={`Ir a slide ${index + 1}`}
                />
              ))}
            </div>

            {/* Footer con redes sociales */}
            <div className="login-l1-hero-footer">
              <p className="login-l1-social-title">Encuéntranos en:</p>
              <div className="login-l1-social-links">
                <a href="https://facebook.com/jaapsanjapamba" target="_blank" rel="noopener noreferrer" className="login-l1-social-link facebook" title="Facebook">
                  <Facebook size={18} />
                </a>
                <a href="https://instagram.com/jaapsanjapamba" target="_blank" rel="noopener noreferrer" className="login-l1-social-link instagram" title="Instagram">
                  <Instagram size={18} />
                </a>
                <a href="mailto:sanjapambaj@gmail.com" className="login-l1-social-link email" title="Email">
                  <Mail size={18} />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Panel Derecho - Formulario */}
        <div className="login-main-form-panel">
          <div className="login-main-form-card">
            <div className="login-main-back-button">
              <button onClick={() => window.location.href = '/'} className="login-main-btn-back">
                ← Volver al inicio
              </button>
            </div>

            <div className="login-main-form-header">
              <h2 className="login-main-form-title">Iniciar Sesión</h2>
              <p className="login-main-form-subtitle">
                Accede a tu cuenta del sistema TecniCobro
              </p>
            </div>

            {error && (
              <div className="login-main-error-alert">
                <AlertCircle className="login-main-error-icon" />
                <span>{error}</span>
              </div>
            )}

            <form className="login-main-form" onSubmit={(e) => e.preventDefault()}>
              <div className="login-main-input-field">
                <label htmlFor="username" className="login-main-input-label">
                  Usuario
                </label>
                <div className="login-main-input-wrapper">
                  <User className="login-main-input-icon" />
                  <input
                    id="username"
                    name="username"
                    type="text"
                    placeholder="Ingresa tu usuario"
                    className="login-main-form-control"
                    value={formData.username}
                    onChange={handleInputChange}
                    onKeyPress={handleKeyPress}
                    disabled={isLoading}
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="login-main-input-field">
                <label htmlFor="password" className="login-main-input-label">
                  Contraseña
                </label>
                <div className="login-main-input-wrapper">
                  <Lock className="login-main-input-icon" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Ingresa tu contraseña"
                    className="login-main-form-control login-main-password-field"
                    value={formData.password}
                    onChange={handleInputChange}
                    onKeyPress={handleKeyPress}
                    disabled={isLoading}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="login-main-toggle-password"
                    disabled={isLoading}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? (
                      <EyeOff className="login-main-eye-icon" />
                    ) : (
                      <Eye className="login-main-eye-icon" />
                    )}
                  </button>
                </div>
              </div>

              <div className="login-main-forgot-password">
                <a href="/forgot-password" className="login-main-forgot-link">
                  ¿Olvidaste tu contraseña?
                </a>
              </div>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={isLoading}
                className="login-main-btn-submit"
              >
                {isLoading ? (
                  <div className="login-main-loading-container">
                    <div className="login-main-spinner"></div>
                    <span>Iniciando sesión...</span>
                  </div>
                ) : (
                  'Iniciar Sesión'
                )}
              </button>
            </form>

            <div className="login-main-divider">
              <span className="login-main-divider-text">Síguenos en redes sociales</span>
            </div>

            <div className="login-main-social-buttons">
              <a 
                href="https://facebook.com/jaapsanjapamba" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="login-main-social-btn facebook-btn"
              >
                <Facebook size={20} />
                <span>Facebook</span>
              </a>
              <a 
                href="https://instagram.com/jaapsanjapamba" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="login-main-social-btn instagram-btn"
              >
                <Instagram size={20} />
                <span>Instagram</span>
              </a>
            </div>

            <div className="login-main-form-footer">
              <p className="login-main-footer-brand">TecniCobro - Sistema de Facturación v1.0</p>
              <p className="login-main-footer-copyright">JAAP Sanjapamba © 2025 - Todos los derechos reservados</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;