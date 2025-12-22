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
      
      console.log('🚨 Logout forzado detectado:', reason);
      
      alert("🔒 Tu sesión ha sido cerrada porque iniciaste sesión en otro dispositivo");
      
      // Redirigir SIEMPRE, sin opción a cancelar
      navigate('/login', { replace: true });
    };

    // ✅ Handler para sesión expirada normal (por tiempo)
    const handleSessionExpired = () => {
      console.log('⏰ Sesión expirada por tiempo');
      
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
