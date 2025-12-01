// src/components/MiniMapaBurbuja.js
// COMPONENTE DE MINI-MAPA FLOTANTE - UBICACIÓN Y MEDIDORES CERCANOS

import React, { useState, useEffect, useRef } from 'react';
import './MiniMapaBurbuja.css';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, Maximize2, X, Loader } from 'lucide-react';

// IMPORTAR TU SERVICIO DE GEOLOCALIZACIÓN
//import geolocalizacionService from '../services/geolocationsServices';

const MiniMapaBurbuja = () => {
  // Estados
  const [miniMapVisible, setMiniMapVisible] = useState(false);
  const [miniMapMinimized, setMiniMapMinimized] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [nearbyMeters, setNearbyMeters] = useState([]);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const miniMapRef = useRef(null);
  const miniMapContainerRef = useRef(null);

  // Obtener ubicación actual del dispositivo
  const getCurrentLocation = () => {
    setLoadingLocation(true);

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          };
          setCurrentLocation(location);
          setLoadingLocation(false);
          loadNearbyMeters(location);
        },
        (error) => {
          console.error('Error obteniendo ubicación:', error);
          alert('No se pudo obtener tu ubicación. Verifica los permisos del navegador.');
          setLoadingLocation(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    } else {
      alert('Tu navegador no soporta geolocalización');
      setLoadingLocation(false);
    }
  };

  // Calcular distancia entre dos puntos GPS (en km)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radio de la Tierra en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Cargar medidores cercanos (radio de ~1km)
  const loadNearbyMeters = async (location) => {
    try {
      // 🔧 DESCOMENTAR Y CONECTAR CON TU SERVICIO REAL:
      /*
      const result = await geolocalizacionService.getMedidoresGeo();

      if (result.success) {
        const nearby = result.data
          .map(meter => ({
            ...meter,
            distance: calculateDistance(
              location.lat, 
              location.lng,
              parseFloat(meter.latitud), 
              parseFloat(meter.longitud)
            )
          }))
          .filter(meter => meter.distance <= 1) // Radio de 1km
          .sort((a, b) => a.distance - b.distance);

        setNearbyMeters(nearby);
      }
      */

      // 📍 DATOS SIMULADOS (REEMPLAZAR ARRIBA):
      const mockMeters = [
        {
          id: 1,
          num_medidor: 'MED-001',
          latitud: location.lat + 0.001,
          longitud: location.lng + 0.001,
          usuario_afiliado: { nombre_afiliado: 'Juan Pérez' },
          activo: true
        },
        {
          id: 2,
          num_medidor: 'MED-002',
          latitud: location.lat - 0.002,
          longitud: location.lng + 0.0015,
          usuario_afiliado: { nombre_afiliado: 'María González' },
          activo: true
        },
        {
          id: 3,
          num_medidor: 'MED-003',
          latitud: location.lat + 0.0015,
          longitud: location.lng - 0.001,
          usuario_afiliado: null,
          activo: false
        }
      ];

      setNearbyMeters(mockMeters);
    } catch (error) {
      console.error('Error cargando medidores cercanos:', error);
    }
  };

  // Inicializar mini-mapa
  useEffect(() => {
    if (miniMapVisible && !miniMapMinimized && currentLocation && miniMapContainerRef.current) {
      if (miniMapRef.current) {
        miniMapRef.current.remove();
      }

      setTimeout(() => {
        if (!miniMapContainerRef.current) return;

        try {
          const map = L.map(miniMapContainerRef.current, {
            center: [currentLocation.lat, currentLocation.lng],
            zoom: 16,
            zoomControl: false,
            attributionControl: false
          });

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19
          }).addTo(map);

          // Marcador de ubicación actual
          const currentIcon = L.divIcon({
            html: '<div class="current-location-marker">📍</div>',
            className: 'custom-marker',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
          });

          L.marker([currentLocation.lat, currentLocation.lng], { icon: currentIcon })
            .addTo(map)
            .bindPopup('<strong>Tu ubicación</strong>');

          // Marcadores de medidores cercanos
          nearbyMeters.forEach(meter => {
            const meterIcon = L.divIcon({
              html: `<div class="meter-marker ${meter.activo ? 'active' : 'inactive'}">💧</div>`,
              className: 'custom-marker',
              iconSize: [24, 24],
              iconAnchor: [12, 12]
            });

            const usuario = meter.usuario_afiliado?.nombre_afiliado || 'Sin asignar';
            const estado = meter.activo ? 'Activo' : 'Inactivo';

            L.marker([meter.latitud, meter.longitud], { icon: meterIcon })
              .addTo(map)
              .bindPopup(`<strong>${meter.num_medidor}</strong><br>${usuario}<br><small>${estado}</small>`);
          });

          // Círculo de precisión
          L.circle([currentLocation.lat, currentLocation.lng], {
            radius: currentLocation.accuracy,
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.1,
            weight: 1
          }).addTo(map);

          miniMapRef.current = map;
          setTimeout(() => map.invalidateSize(), 100);
        } catch (error) {
          console.error('Error inicializando mini-mapa:', error);
        }
      }, 200);
    }

    return () => {
      if (miniMapRef.current) {
        miniMapRef.current.remove();
        miniMapRef.current = null;
      }
    };
  }, [miniMapVisible, miniMapMinimized, currentLocation, nearbyMeters]);

  // Abrir mini-mapa
  const openMiniMap = () => {
    setMiniMapVisible(true);
    if (!currentLocation) {
      getCurrentLocation();
    }
  };

  // Navegar a la sección de geolocalización
  const goToGeolocation = () => {
    window.location.href = 'https://localhost:3000/administrador/geolocation';
  };

  return (
    <>
      {/* BURBUJA DEL MINI-MAPA */}
      <div className={`mini-map-bubble ${miniMapVisible ? 'visible' : ''} ${miniMapMinimized ? 'minimized' : ''}`}>
        <div className="mini-map-header">
          <div className="mini-map-title">
            <MapPin className="w-5 h-5" />
            <span>Tu Ubicación y Medidores</span>
          </div>
          <div className="mini-map-actions">
            <button 
              className="mini-map-btn"
              onClick={() => setMiniMapMinimized(!miniMapMinimized)}
              title={miniMapMinimized ? "Expandir" : "Minimizar"}
            >
              {miniMapMinimized ? '▲' : '▼'}
            </button>
            <button 
              className="mini-map-btn"
              onClick={() => {
                setMiniMapVisible(false);
                setMiniMapMinimized(false);
              }}
              title="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {!miniMapMinimized && (
          <div className="mini-map-body">
            {loadingLocation ? (
              <div className="mini-map-loading">
                <Loader className="w-12 h-12 text-blue-500 animate-spin" />
                <p className="text-sm text-gray-600 mt-3">Obteniendo tu ubicación...</p>
              </div>
            ) : currentLocation ? (
              <>
                <div ref={miniMapContainerRef} className="mini-map-container"></div>

                <div className="mini-map-info">
                  <div className="mini-map-stats">
                    <div className="mini-stat">
                      <MapPin className="w-4 h-4 text-blue-600" />
                      <span className="text-xs text-gray-600">
                        {currentLocation.lat.toFixed(5)}, {currentLocation.lng.toFixed(5)}
                      </span>
                    </div>
                    <div className="mini-stat">
                      <Navigation className="w-4 h-4 text-green-600" />
                      <span className="text-xs text-gray-600">
                        {nearbyMeters.length} medidores cercanos
                      </span>
                    </div>
                  </div>

                  <div className="mini-map-legend">
                    <div className="legend-item-mini">
                      <span className="legend-marker current">📍</span>
                      <span className="text-xs">Tu ubicación</span>
                    </div>
                    <div className="legend-item-mini">
                      <span className="legend-marker active">💧</span>
                      <span className="text-xs">Medidor activo</span>
                    </div>
                    <div className="legend-item-mini">
                      <span className="legend-marker inactive">💧</span>
                      <span className="text-xs">Medidor inactivo</span>
                    </div>
                  </div>

                  <button className="mini-map-go-btn" onClick={goToGeolocation}>
                    <Maximize2 className="w-4 h-4" />
                    Ir a Geolocalización Completa
                  </button>
                </div>
              </>
            ) : (
              <div className="mini-map-empty">
                <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-600">No se pudo obtener tu ubicación</p>
                <button 
                  className="btn-retry mt-3"
                  onClick={getCurrentLocation}
                >
                  <Navigation className="w-4 h-4 mr-2" />
                  Reintentar
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* BOTÓN FLOTANTE (FAB) */}
      {!miniMapVisible && (
        <button 
          className="mini-map-fab"
          onClick={openMiniMap}
          title="Ver mi ubicación y medidores cercanos"
        >
          <MapPin className="w-6 h-6" />
          <span className="mini-map-fab-pulse"></span>
        </button>
      )}
    </>
  );
};

export default MiniMapaBurbuja;