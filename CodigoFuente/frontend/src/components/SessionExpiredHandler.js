import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const SessionExpiredHandler = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleSessionExpired = () => {
      const confirmed = window.confirm(
        "❌ Tu sesión ha expirado. ¿Deseas ir a la pantalla de inicio de sesión?"
      );
      if (confirmed) {
        navigate('/login', { replace: true });
      }
    };

    window.addEventListener('sessionExpired', handleSessionExpired);

    return () => {
      window.removeEventListener('sessionExpired', handleSessionExpired);
    };
  }, [navigate]);

  return null;
};

export default SessionExpiredHandler;
