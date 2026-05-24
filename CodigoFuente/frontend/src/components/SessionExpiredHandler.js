// src/sections/SessionExpiredHandler.js  
// Componente para manejar la expiración de sesión globalmente
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const SessionExpiredHandler = () => {
  const navigate = useNavigate();

useEffect(() => {
    // ✅ Handler para logout forzado (sesión iniciada en otro dispositivo)
    const handleForceLogout = (event) => {
      const reason = event.detail?.reason || 'unknown';
      const message = reason === 'concurrent_login'
        ? "🔒 Tu sesión ha sido cerrada porque iniciaste sesión en otro dispositivo"
        : "🔒 Tu sesión ha sido cerrada. Por favor, inicia sesión de nuevo.";

      alert(message);
      
      // Redirigir SIEMPRE, sin opción a cancelar
      navigate('/login', { replace: true });
    };

    // ✅ Handler para sesión expirada normal (por tiempo)
    const handleSessionExpired = () => {
      alert("❌ Tu sesión ha expirado. Por favor, inicia sesión de nuevo.");
      
      // Redirigir SIEMPRE, sin opción a cancelar
      navigate('/login', { replace: true });
    };

    // ✅ Registrar ambos eventos
    window.addEventListener('sessionForceLogout', handleForceLogout);
    window.addEventListener('sessionExpired', handleSessionExpired);

    return () => {
      window.removeEventListener('sessionForceLogout', handleForceLogout);
      window.removeEventListener('sessionExpired', handleSessionExpired);
    };
  }, [navigate]);

  return null;
};

export default SessionExpiredHandler;
