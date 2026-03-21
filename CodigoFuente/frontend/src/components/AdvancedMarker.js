// src/components/AdvancedMarker.js
import { useEffect, useRef } from 'react';

const AdvancedMarker = ({ map, position, icon, onClick, zIndex = 0, title = '' }) => {
  const markerRef = useRef(null);

  useEffect(() => {
    if (!map || !position || !window.google?.maps?.marker?.AdvancedMarkerElement) return;

    // Crear contenido visual con el SVG
    const content = document.createElement('img');
    if (icon?.url) {
      content.src = icon.url;
      content.style.width  = `${icon.scaledSize?.width  || 30}px`;
      content.style.height = `${icon.scaledSize?.height || 30}px`;
      content.style.cursor = 'pointer';
      content.draggable = false;
    }

    const marker = new window.google.maps.marker.AdvancedMarkerElement({
      map,
      position,
      content: icon?.url ? content : undefined,
      title,
      zIndex,
    });

    markerRef.current = marker;

    return () => {
        marker.removeEventListener('gmp-click', onClick);
        marker.map = null;
        markerRef.current = null;
        };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, position?.lat, position?.lng, icon?.url, zIndex]);

    useEffect(() => {
        if (!markerRef.current || !onClick) return;
        const marker = markerRef.current;
        marker.addEventListener('gmp-click', onClick);
        return () => {
            marker.removeEventListener('gmp-click', onClick);
        };
    }, [onClick]);
  return null;
};

export default AdvancedMarker;
