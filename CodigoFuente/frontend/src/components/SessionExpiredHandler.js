// src/components/SessionExpiredHandler.js  
// Componente para manejar la expiración de sesión globalmente
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const SessionExpiredHandler = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleSessionExpired = () => {
      alert("❌ Tu sesión ha expirado. Por favor, inicia sesión de nuevo.");

      // Redirigir SIEMPRE, sin opción a cancelar
      navigate('/login', { replace: true });
    };

    window.addEventListener('sessionExpired', handleSessionExpired);

    return () => {
      window.removeEventListener('sessionExpired', handleSessionExpired);
    };
  }, [navigate]);


  return null;
};

export default SessionExpiredHandler;
