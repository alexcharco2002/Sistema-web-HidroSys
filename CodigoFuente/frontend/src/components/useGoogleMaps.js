// src/components/useGoogleMaps.js
// Hook centralizado para cargar Google Maps API UNA SOLA VEZ
import { useJsApiLoader } from '@react-google-maps/api';

// ⚠️ IMPORTANTE: Este array debe estar FUERA del hook (referencia estable)
// Si se define dentro, React crea un nuevo array en cada render → error del Loader
const LIBRARIES = ['marker'];

const useGoogleMaps = () => {
  return useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES,
  });
};

export default useGoogleMaps;