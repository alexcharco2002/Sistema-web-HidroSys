// src/components/MiniMapaBurbuja.js
// COMPONENTE DE MINI-MAPA FLOTANTE - UBICACIÓN Y MEDIDORES CERCANOS
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './MiniMapaBurbuja.css';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, Maximize2, X, Loader, User, MapPinned } from 'lucide-react';
import geolocalizacionService from '../services/geolocationsServices';
import authService from '../services/authServices';
import { createPortal } from 'react-dom';

const MiniMapaBurbuja = () => {
  const navigate = useNavigate();
  
  // Estados
  const [miniMapVisible, setMiniMapVisible] = useState(false);
  const [miniMapMinimized, setMiniMapMinimized] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [nearbyMeters, setNearbyMeters] = useState([]);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [showMetersList, setShowMetersList] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  const miniMapRef = useRef(null);
  const miniMapContainerRef = useRef(null);

  // Obtener ruta base del rol actual
  const roleBasePath = authService.getRoleBasePath();

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
    const R = 6371;
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
      console.log('🔍 Cargando medidores cercanos...', location);
      const result = await geolocalizacionService.getMedidoresGeo();
      console.log('📊 Resultado de medidores:', result);
      
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
        
        console.log('✅ Medidores cercanos encontrados:', nearby.length);
        setNearbyMeters(nearby);
      }
    } catch (error) {
      console.error('❌ Error cargando medidores cercanos:', error);
    }
  };

  // 🔥 CORRECCIÓN: Inicializar mini-mapa con cleanup apropiado
  useEffect(() => {
    let timeoutId = null; // 🔥 GUARDAR el ID del timeout
    
    if (miniMapVisible && !miniMapMinimized && !showMetersList && currentLocation && miniMapContainerRef.current) {
      
      // Limpiar mapa existente
      if (miniMapRef.current) {
        try {
          miniMapRef.current.remove();
          miniMapRef.current = null;
        } catch (error) {
          console.error('Error limpiando mapa:', error);
        }
      }

      // 🔥 GUARDAR el timeoutId
      timeoutId = setTimeout(() => {
        if (!miniMapContainerRef.current) return;

        try {
          console.log('🗺️ Inicializando mapa con', nearbyMeters.length, 'medidores');
          
          const map = L.map(miniMapContainerRef.current, {
            center: [currentLocation.lat, currentLocation.lng],
            zoom: 16,
            zoomControl: false,
            attributionControl: false,
            preferCanvas: true
          });

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            updateWhenIdle: true
          }).addTo(map);

          // Marcador de ubicación actual
          const currentIcon = L.divIcon({
            html: `
              <div class="current-location-marker">
                <svg width="38" height="38" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z" fill="#1A73E8"/>
                  <circle cx="12" cy="9" r="3" fill="white"/>
                  <path d="M12 22s-3.5-4-5.5-7.5C4.3 12.2 4 10.7 4 9c0-4.4 3.6-8 8-8s8 3.6 8 8c0 1.7-.3 3.2-2.5 5.5C15.5 18 12 22 12 22z" fill="#EA4335" opacity="0.9"/>
                </svg>
              </div>
            `,
            className: "",
            iconSize: [38, 38],
            iconAnchor: [19, 38]
          });

          L.marker([currentLocation.lat, currentLocation.lng], {
            icon: currentIcon
          }).addTo(map).bindPopup('<b>Tu ubicación actual</b>');

          // Agregar marcadores de medidores cercanos
          console.log('📍 Agregando', nearbyMeters.length, 'marcadores al mapa');
          nearbyMeters.forEach(meter => {
            const meterIcon = L.divIcon({
              html: `<div class="meter-marker ${meter.activo ? 'active' : 'inactive'}">${meter.activo ? '💧' : '🚫'}</div>`,
              className: '',
              iconSize: [24, 24],
              iconAnchor: [12, 12]
            });

            const marker = L.marker([parseFloat(meter.latitud), parseFloat(meter.longitud)], {
              icon: meterIcon
            }).addTo(map);

            const popupContent = `
              <div style="text-align: center;">
                <b>${meter.num_medidor}</b><br>
                <small>${meter.usuario_afiliado?.nombre_afiliado || 'Sin propietario'}</small><br>
                <small>${(meter.distance * 1000).toFixed(0)}m de distancia</small>
              </div>
            `;

            marker.bindPopup(popupContent);

            // Eventos de hover
            marker.on('mouseover', function(e) {
              this.openPopup();
            });

            marker.on('mouseout', function(e) {
              this.closePopup();
            });
          });

          miniMapRef.current = map;

          setTimeout(() => {
            if (map && miniMapContainerRef.current) {
              map.invalidateSize();
            }
          }, 100);

        } catch (err) {
          console.error('❌ Error inicializando mini-mapa:', err);
        }
      }, 150); // Tiempo suficiente para que el DOM esté listo
    }

    // 🔥 CLEANUP CORRECTO
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId); // 🔥 Limpiar el timeout
      }
      if (miniMapRef.current) {
        try {
          miniMapRef.current.remove();
          miniMapRef.current = null;
        } catch (error) {
          console.error('Error en cleanup del mapa:', error);
        }
      }
    };
  }, [miniMapVisible, miniMapMinimized, showMetersList, currentLocation, nearbyMeters]);

  // Alternar visibilidad del mini-mapa
  const toggleMiniMap = () => {
    if (!miniMapVisible) {
      setMiniMapVisible(true);
      setShowMetersList(false);
      if (!currentLocation) {
        getCurrentLocation();
      }
    } else {
      setMiniMapVisible(false);
      setMiniMapMinimized(false);
      setShowMetersList(false);
    }
  };

  // Ir a vista completa de geolocalización
  const handleGoToFullGeolocation = () => {
    navigate(`${roleBasePath}/geolocation`);
  };

  // Alternar entre mapa y lista
  const toggleView = () => {
    setShowMetersList(!showMetersList);
  };

  // Montar componente
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Botón flotante FAB */}
      {!miniMapVisible && (
        <button className="mini-map-fab" onClick={toggleMiniMap}>
          <div className="mini-map-fab-pulse" />
          <MapPin className="w-8 h-8" />
        </button>
      )}

      {/* Burbuja del mini-mapa */}
      <div className={`mini-map-bubble ${miniMapVisible ? 'visible' : ''} ${miniMapMinimized ? 'minimized' : ''}`}>
        {/* Header */}
        <div className="mini-map-header" onClick={() => setMiniMapMinimized(!miniMapMinimized)}>
          <div className="mini-map-title">
            <MapPin className="w-5 h-5" />
            <span>Medidores Cercanos</span>
          </div>
          <div className="mini-map-actions">
            <button 
              className="mini-map-btn" 
              onClick={(e) => { e.stopPropagation(); toggleView(); }}
              title={showMetersList ? "Ver Mapa" : "Ver Lista"}
            >
              {showMetersList ? <MapPin className="w-4 h-4" /> : <User className="w-4 h-4" />}
            </button>
            <button 
              className="mini-map-btn" 
              onClick={(e) => { e.stopPropagation(); setMiniMapVisible(false); }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        {!miniMapMinimized && (
          <div className="mini-map-body">
            {loadingLocation ? (
              <div className="mini-map-loading">
                <Loader className="w-12 h-12 text-blue-500 animate-spin mb-3" />
                <p className="text-sm text-gray-600">Obteniendo tu ubicación...</p>
              </div>
            ) : !currentLocation ? (
              <div className="mini-map-empty">
                <Navigation className="w-16 h-16 text-gray-300 mb-3" />
                <p className="text-sm text-gray-600 mb-3">No se pudo obtener tu ubicación</p>
                <button className="btn-retry" onClick={getCurrentLocation}>
                  <Navigation className="w-4 h-4 mr-2" />
                  Reintentar
                </button>
              </div>
            ) : (
              <>
                {/* Vista de Mapa */}
                {!showMetersList && (
                  <div ref={miniMapContainerRef} className="mini-map-container" />
                )}

                {/* Vista de Lista de Medidores */}
                {showMetersList && (
                  <div className="meters-list-container">
                    <div className="meters-list-header">
                      <h3 className="meters-list-title">
                        <MapPinned className="w-4 h-4" />
                        {nearbyMeters.length} Medidores Cercanos
                      </h3>
                    </div>
                    
                    <div className="meters-list-scroll">
                      {nearbyMeters.length === 0 ? (
                        <div className="meters-list-empty">
                          <MapPin className="w-12 h-12 text-gray-300" />
                          <p className="text-sm text-gray-500">
                            No hay medidores en un radio de 1km
                          </p>
                        </div>
                      ) : (
                        nearbyMeters.map((meter) => (
                          <div key={meter.id_medidor} className="meter-list-item">
                            <div className="meter-item-icon">
                              {meter.activo ? '💧' : '🚫'}
                            </div>
                            <div className="meter-item-info">
                              <div className="meter-item-number">
                                {meter.num_medidor}
                              </div>
                              <div className="meter-item-owner">
                                <User className="w-3 h-3" />
                                {meter.usuario_afiliado?.nombre_afiliado || 'Sin propietario'}
                              </div>
                              {meter.usuario_afiliado?.cod_usuario_afi && (
                                <div className="meter-item-code">
                                  Código: {meter.usuario_afiliado.cod_usuario_afi}
                                </div>
                              )}
                              <div className="meter-item-distance">
                                📍 {(meter.distance * 1000).toFixed(0)}m de distancia
                              </div>
                            </div>
                            <div className={`meter-item-status ${meter.activo ? 'active' : 'inactive'}`}>
                              {meter.activo ? 'Activo' : 'Inactivo'}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Info y botón */}
                <div className="mini-map-info">
                  <div className="mini-map-stats">
                    <div className="mini-stat">
                      <MapPin className="w-4 h-4 text-blue-500" />
                      <span className="text-sm text-gray-600">
                        <strong>{nearbyMeters.length}</strong> cercanos
                      </span>
                    </div>
                    <div className="mini-stat">
                      <Navigation className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-gray-600">
                        Radio <strong>1km</strong>
                      </span>
                    </div>
                  </div>

                  <button className="mini-map-go-btn" onClick={handleGoToFullGeolocation}>
                    <Maximize2 className="w-4 h-4" />
                    Ir a Geolocalización Completa
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>,
    document.body
  );
};

export default MiniMapaBurbuja;
