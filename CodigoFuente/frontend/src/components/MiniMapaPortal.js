// src/components/MiniMapaPortal.js
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const MiniMapaPortal = ({ children }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  // Renderizar directamente en el body, fuera del árbol de componentes
  return createPortal(children, document.body);
};

export default MiniMapaPortal;
