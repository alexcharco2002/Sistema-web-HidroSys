import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useModal } from '../context/ModalContext';

const SessionExpiredHandler = () => {
  const { showSessionExpired } = useModal();
  const navigate = useNavigate();

  useEffect(() => {
    const handleSessionExpired = () => {
      console.log('🔔 Sesión expirada detectada');
      showSessionExpired({
        onConfirm: () => {
          navigate('/login', { replace: true });
        }
      });
    };

    window.addEventListener('sessionExpired', handleSessionExpired);

    return () => {
      window.removeEventListener('sessionExpired', handleSessionExpired);
    };
  }, [showSessionExpired, navigate]);

  return null;
};

export default SessionExpiredHandler;
