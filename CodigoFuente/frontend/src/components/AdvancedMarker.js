// src/components/AdvancedMarker.js
import { useEffect, useRef } from 'react';

const AdvancedMarker = ({ map, position, icon, onClick, zIndex = 0, title = '' }) => {
  const markerRef  = useRef(null);
  const onClickRef = useRef(onClick);

  // Mantener el ref actualizado sin recrear el marcador
  useEffect(() => { onClickRef.current = onClick; }, [onClick]);

  useEffect(() => {
    if (!map || !position || !window.google?.maps?.marker?.AdvancedMarkerElement) return;

    // Contenido visual
    let content;
    if (icon?.url) {
      content = document.createElement('img');
      content.src           = icon.url;
      content.style.width   = `${icon.scaledSize?.width  || 30}px`;
      content.style.height  = `${icon.scaledSize?.height || 30}px`;
      content.style.cursor  = 'pointer';
      content.draggable     = false;
    }

    const marker = new window.google.maps.marker.AdvancedMarkerElement({
      map,
      position,
      content,
      title,
      zIndex,
    });

    const handleClick = (e) => {
      // Detener propagación para que el onClick del mapa no limpie la selección
      e.stopPropagation?.();
      onClickRef.current?.(e);
    };

    // Listener en el marcador (evento de Google Maps)
    marker.addEventListener('gmp-click', handleClick);

    // Listener directo en el <img> — necesario porque gmp-click no siempre
    // se dispara cuando el content es un elemento DOM (imagen)
    if (content) {
      content.addEventListener('click', handleClick);
    }

    markerRef.current = marker;

    return () => {
      marker.removeEventListener('gmp-click', handleClick);
      if (content) {
        content.removeEventListener('click', handleClick);
      }
      marker.map = null;
      markerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, position?.lat, position?.lng, icon?.url, zIndex, title]);

  return null;
};

export default AdvancedMarker;