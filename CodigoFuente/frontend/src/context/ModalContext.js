// src/context/ModalContext.js
import React, { createContext, useContext, useState, useRef } from 'react';
import { AlertCircle, CheckCircle, Info, AlertTriangle, LogOut } from 'lucide-react';
import './ModalContext.css';

const ModalContext = createContext();

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal debe usarse dentro de ModalProvider');
  }
  return context;
};

const MODAL_TYPES = {
  confirm: { icon: AlertTriangle, iconClass: 'text-amber-500' },
  alert: { icon: AlertCircle, iconClass: 'text-red-500' },
  success: { icon: CheckCircle, iconClass: 'text-green-500' },
  info: { icon: Info, iconClass: 'text-blue-500' },
  sessionExpired: { icon: LogOut, iconClass: 'text-red-500' }
};

export const ModalProvider = ({ children }) => {
  // Estado único y completo (no mezclar prev)
  const [modalState, setModalState] = useState({
    isOpen: false,
    type: 'info',
    title: '',
    message: '',
    confirmText: 'Aceptar',
    cancelText: 'Cancelar',
    showCancel: false,
    // onConfirm/onCancel no son usados desde el estado para resolver promesas;
    // usamos resolverRef para evitar closures y condiciones de carrera.
  });

  // Ref para mantener el resolve de la promesa actual
  const resolverRef = useRef(null);

  const closeModal = () => {
    // limpiar resolve si existe (resuelve con false por seguridad)
    if (resolverRef.current) {
      // No resolver aquí automáticamente: dejamos que los handlers controlen la resolución.
      resolverRef.current = null;
    }
    setModalState({
      isOpen: false,
      type: 'info',
      title: '',
      message: '',
      confirmText: 'Aceptar',
      cancelText: 'Cancelar',
      showCancel: false
    });
  };

  // FUNCIONES PARA ABRIR MODALES (devuelven Promise donde aplica)
  const showConfirm = ({ title = 'Confirmar', message = '', confirmText = 'Sí', cancelText = 'No' } = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setModalState({
        isOpen: true,
        type: 'confirm',
        title,
        message,
        confirmText,
        cancelText,
        showCancel: true
      });
    });
  };

  const showAlert = ({ title = 'Error', message = '', confirmText = 'Entendido' } = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setModalState({
        isOpen: true,
        type: 'alert',
        title,
        message,
        confirmText,
        cancelText: '',
        showCancel: false
      });
    });
  };

  const showSuccess = ({ title = 'Éxito', message = '', confirmText = 'Aceptar' } = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setModalState({
        isOpen: true,
        type: 'success',
        title,
        message,
        confirmText,
        cancelText: '',
        showCancel: false
      });
    });
  };

  const showInfo = ({ title = 'Información', message = '', confirmText = 'Entendido' } = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setModalState({
        isOpen: true,
        type: 'info',
        title,
        message,
        confirmText,
        cancelText: '',
        showCancel: false
      });
    });
  };

  const showSessionExpired = ({ onConfirm } = {}) => {
    // Aquí no retornamos promesa porque en tu uso original redirigías directamente
    setModalState({
      isOpen: true,
      type: 'sessionExpired',
      title: 'Sesión Expirada',
      message: 'Tu sesión ha expirado por seguridad. Por favor, inicia sesión nuevamente para continuar.',
      confirmText: 'Ir al Login',
      cancelText: '',
      showCancel: false
    });

    // Guardamos un resolver que llamará onConfirm si existe (opcional)
    resolverRef.current = (result) => {
      if (result && typeof onConfirm === 'function') onConfirm();
      resolverRef.current = null;
    };
  };

  // HANDLERS llamados desde los botones / backdrop
  const handleConfirmClick = (e) => {
    if (e && e.preventDefault) { e.preventDefault(); e.stopPropagation(); }
    // resolver si existe
    if (resolverRef.current) {
      try { resolverRef.current(true); } catch (err) { /* ignore */ }
      resolverRef.current = null;
    }
    closeModal();
  };

  const handleCancelClick = (e) => {
    if (e && e.preventDefault) { e.preventDefault(); e.stopPropagation(); }
    if (resolverRef.current) {
      try { resolverRef.current(false); } catch (err) { /* ignore */ }
      resolverRef.current = null;
    }
    closeModal();
  };

  const handleBackdropClick = (e) => {
    // solo cerrar por backdrop si el modal permite cancelar (showCancel === true)
    if (e.target === e.currentTarget && modalState.showCancel) {
      handleCancelClick();
    }
    // si no showCancel, ignoramos clic en backdrop (no cerrar)
  };

  // Icono según tipo
  const IconComponent = MODAL_TYPES[modalState.type]?.icon || Info;
  const iconClass = MODAL_TYPES[modalState.type]?.iconClass || 'text-blue-500';

  return (
    <ModalContext.Provider value={{
      showConfirm,
      showAlert,
      showSuccess,
      showInfo,
      showSessionExpired,
      closeModal
    }}>
      {children}

      {modalState.isOpen && (
        <div className="modal-overlay" onClick={handleBackdropClick}>
          <div className="modal-container">
            <div className="modal-content">
              <div className="modal-icon-wrapper">
                <IconComponent className={`modal-icon ${iconClass}`} />
              </div>

              <h2 className="modal-title">{modalState.title}</h2>
              <p className="modal-message">{modalState.message}</p>

              <div className="modal-buttons">
                {modalState.showCancel && (
                  <button
                    type="button"
                    onClick={handleCancelClick}
                    className="modal-button modal-button-cancel"
                  >
                    {modalState.cancelText}
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleConfirmClick}
                  className={`modal-button modal-button-confirm ${modalState.type}`}
                >
                  {modalState.confirmText}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
};
