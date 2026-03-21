// src/sections/MiniMapaBurbuja.js
// COMPONENTE DE MINI-MAPA FLOTANTE - Google Maps API
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './MiniMapaBurbuja.css';

import { GoogleMap, InfoWindow } from '@react-google-maps/api';
import useGoogleMaps from '../../components/useGoogleMaps';
import AdvancedMarker from '../../components/AdvancedMarker'; // ← importar el componente de marcador avanzado

import { MapPin, Navigation, Maximize2, X, Loader, User, MapPinned } from 'lucide-react';
import geolocalizacionService from '../../services/geolocationsServices';
import authService from '../../services/authServices';
import { createPortal } from 'react-dom';

// ─── Constantes ──────────────────────────────────────────────────────────────
const MAP_CONTAINER_STYLE = { width: '100%', height: '100%' };
const MAP_OPTIONS = {
  mapId: 'ee4b5fdd2e16cee3b6900950', 
  mapTypeId:          'roadmap',
  zoom:               16,
  zoomControl:        false,
  mapTypeControl:     false,
  streetViewControl:  false,
  fullscreenControl:  false,
  scaleControl:       false,
  attributionControl: false,
};

// ─── SVG helpers ─────────────────────────────────────────────────────────────
const buildCurrentLocationSvg = () => `
  <svg width="38" height="46" viewBox="0 0 38 46" xmlns="http://www.w3.org/2000/svg">
    <path d="M19 1C10.7 1 4 7.7 4 16c0 10 15 29 15 29s15-19 15-29C34 7.7 27.3 1 19 1z" fill="#1A73E8" stroke="#fff" stroke-width="2"/>
    <circle cx="19" cy="16" r="6" fill="white"/>
  </svg>
`;

const buildMeterSvg = (active) => `
  <svg width="28" height="34" viewBox="0 0 28 34" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 1C7.4 1 2 6.4 2 13c0 8.2 12 21 12 21s12-12.8 12-21C26 6.4 20.6 1 14 1z"
          fill="${active ? '#10b981' : '#ef4444'}" stroke="#fff" stroke-width="1.5"/>
    <text x="14" y="17" text-anchor="middle" font-size="12">${active ? '💧' : '🚫'}</text>
  </svg>
`;

const svgToUrl = (svg) =>
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

// ─── Cálculo de distancia Haversine ──────────────────────────────────────────
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ════════════════════════════════════════════════════════════════════════════
const MiniMapaBurbuja = () => {
  const navigate = useNavigate();
  const roleBasePath = authService.getRoleBasePath();

  const [miniMapVisible,   setMiniMapVisible]   = useState(false);
  const [miniMapMinimized, setMiniMapMinimized] = useState(false);
  const [currentLocation,  setCurrentLocation]  = useState(null);
  const [nearbyMeters,     setNearbyMeters]     = useState([]);
  const [loadingLocation,  setLoadingLocation]  = useState(false);
  const [showMetersList,   setShowMetersList]   = useState(false);
  const [mounted,          setMounted]          = useState(false);
  const [selectedMeter,    setSelectedMeter]    = useState(null); // InfoWindow

  const mapRef = useRef(null);

  // ── Cargar Google Maps API ─────────────────────────────────────────────────
 const { isLoaded, loadError } = useGoogleMaps();

  // ── Montar ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // ── Cargar medidores cercanos ──────────────────────────────────────────────
  const loadNearbyMeters = useCallback(async (location) => {
    try {
      const result = await geolocalizacionService.getMedidoresGeo();
      if (result.success) {
        const nearby = result.data
          .filter(m => m.latitud && m.longitud)
          .map(m => ({
            ...m,
            distance: calculateDistance(
              location.lat, location.lng,
              parseFloat(m.latitud), parseFloat(m.longitud)
            ),
          }))
          .filter(m => m.distance <= 1)
          .sort((a, b) => a.distance - b.distance);

        setNearbyMeters(nearby);
      }
    } catch (err) {
      console.error('Error cargando medidores cercanos:', err);
    }
  }, []);

  // ── Obtener ubicación del dispositivo ─────────────────────────────────────
  const getCurrentLocation = useCallback(() => {
    setLoadingLocation(true);
    if (!('geolocation' in navigator)) {
      alert('Tu navegador no soporta geolocalización');
      setLoadingLocation(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCurrentLocation(location);
        setLoadingLocation(false);
        loadNearbyMeters(location);
      },
      (err) => {
        console.error('Error obteniendo ubicación:', err);
        alert('No se pudo obtener tu ubicación. Verifica los permisos del navegador.');
        setLoadingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [loadNearbyMeters]);

  // ── Centrar mapa cuando cambia la ubicación ────────────────────────────────
  useEffect(() => {
    if (mapRef.current && currentLocation) {
      mapRef.current.panTo(currentLocation);
    }
  }, [currentLocation]);

  // ── Acciones ──────────────────────────────────────────────────────────────
  const toggleMiniMap = () => {
    if (!miniMapVisible) {
      setMiniMapVisible(true);
      setShowMetersList(false);
      if (!currentLocation) getCurrentLocation();
    } else {
      setMiniMapVisible(false);
      setMiniMapMinimized(false);
      setShowMetersList(false);
      setSelectedMeter(null);
    }
  };

  const handleGoToFullGeolocation = () => navigate(`${roleBasePath}/geolocation`);
  const toggleView = () => { setShowMetersList(v => !v); setSelectedMeter(null); };

  if (!mounted) return null;

  // ─────────────────────────────────────────────────────────────────────────
  return createPortal(
    <>
      {/* FAB flotante */}
      {!miniMapVisible && (
        <button className="mini-map-fab" onClick={toggleMiniMap}>
          <div className="mini-map-fab-pulse" />
          <MapPin className="w-8 h-8" />
        </button>
      )}

      {/* Burbuja */}
      <div className={`mini-map-bubble ${miniMapVisible ? 'visible' : ''} ${miniMapMinimized ? 'minimized' : ''}`}>

        {/* Header */}
        <div className="mini-map-header" onClick={() => setMiniMapMinimized(v => !v)}>
          <div className="mini-map-title">
            <MapPin className="w-5 h-5" />
            <span>Medidores Cercanos</span>
          </div>
          <div className="mini-map-actions">
            <button
              className="mini-map-btn"
              onClick={(e) => { e.stopPropagation(); toggleView(); }}
              title={showMetersList ? 'Ver Mapa' : 'Ver Lista'}
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

            {/* ── Cargando ubicación ────────────────────────────────────── */}
            {loadingLocation && (
              <div className="mini-map-loading">
                <Loader className="w-12 h-12 text-blue-500 animate-spin mb-3" />
                <p className="text-sm text-gray-600">Obteniendo tu ubicación...</p>
              </div>
            )}

            {/* ── Sin ubicación ─────────────────────────────────────────── */}
            {!loadingLocation && !currentLocation && (
              <div className="mini-map-empty">
                <Navigation className="w-16 h-16 text-gray-300 mb-3" />
                <p className="text-sm text-gray-600 mb-3">No se pudo obtener tu ubicación</p>
                <button className="btn-retry" onClick={getCurrentLocation}>
                  <Navigation className="w-4 h-4 mr-2" />
                  Reintentar
                </button>
              </div>
            )}

            {/* ── Con ubicación ─────────────────────────────────────────── */}
            {!loadingLocation && currentLocation && (
              <>
                {/* Vista Mapa */}
                {!showMetersList && (
                  <div className="mini-map-container">
                    {loadError && (
                      <div className="mini-map-loading">
                        <p className="text-sm text-red-500">Error al cargar Google Maps</p>
                      </div>
                    )}

                    {!isLoaded && !loadError && (
                      <div className="mini-map-loading">
                        <Loader className="w-8 h-8 text-blue-400 animate-spin mb-2" />
                        <p className="text-sm text-gray-500">Cargando mapa...</p>
                      </div>
                    )}

                    {isLoaded && !loadError && (
                      <GoogleMap
                        mapContainerStyle={MAP_CONTAINER_STYLE}
                        center={currentLocation}
                        zoom={16}
                        options={MAP_OPTIONS}
                        onLoad={(map) => { mapRef.current = map; }}
                        onUnmount={() => { mapRef.current = null; }}
                        onClick={() => setSelectedMeter(null)}
                      >
                        {/* Marcador: ubicación actual */}
                        <AdvancedMarker
                          map={mapRef.current}
                          position={currentLocation}
                          icon={{
                            url: svgToUrl(buildCurrentLocationSvg()),
                            scaledSize: { width: 40, height: 40 },
                          }}
                          zIndex={10}
                          title="Tu ubicación"
                        />

                        {/* Marcadores: medidores cercanos */}
                        {nearbyMeters.map(meter => (  
                          <AdvancedMarker
                            key={meter.id_medidor}
                            map={mapRef.current}
                            position={{ lat: parseFloat(meter.latitud), lng: parseFloat(meter.longitud) }}
                            icon={{
                              url: svgToUrl(buildMeterSvg(meter.activo)),
                              scaledSize: { width: 28, height: 28 },
                            }}
                            onClick={() => setSelectedMeter(meter)}
                            zIndex={5}
                            title={meter.num_medidor}
                          />
                        ))}

                        {/* InfoWindow al hacer click en un medidor */}
                        {selectedMeter && (
                          <InfoWindow
                            position={{
                              lat: parseFloat(selectedMeter.latitud),
                              lng: parseFloat(selectedMeter.longitud),
                            }}
                            onCloseClick={() => setSelectedMeter(null)}
                          >
                            <div style={{ textAlign: 'center', minWidth: 130 }}>
                              <strong>{selectedMeter.num_medidor}</strong><br />
                              <small style={{ color: '#6b7280' }}>
                                {selectedMeter.nombre_afiliado || 'Sin propietario'}
                              </small><br />
                              <small style={{ color: '#3b82f6' }}>
                                📍 {(selectedMeter.distance * 1000).toFixed(0)}m de distancia
                              </small>
                            </div>
                          </InfoWindow>
                        )}
                      </GoogleMap>
                    )}
                  </div>
                )}

                {/* Vista Lista */}
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
                        nearbyMeters.map(meter => (
                          <div key={meter.id_medidor} className="meter-list-item">
                            <div className="meter-item-icon">
                              {meter.activo ? '💧' : '🚫'}
                            </div>
                            <div className="meter-item-info">
                              <div className="meter-item-number">{meter.num_medidor}</div>
                              <div className="meter-item-owner">
                                <User className="w-3 h-3" />
                                {meter.nombre_afiliado || 'Sin propietario'}
                              </div>
                              {meter.cod_usuario_afi && (
                                <div className="meter-item-code">
                                  Código: {meter.cod_usuario_afi}
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

                {/* Footer: stats + botón */}
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