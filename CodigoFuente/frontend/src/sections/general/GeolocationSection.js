// src/sections/general/GeolocationSection.js
// MÓDULO DE GEOLOCALIZACIÓN - Visualización de medidores en mapa (Google Maps)
import React, { useState, useEffect, useCallback, useRef } from 'react';
import './GeolocationSection.css';
import geolocalizacionService from '../../services/geolocationsServices';
import authService from '../../services/authServices';

import { GoogleMap, InfoWindow } from '@react-google-maps/api';
import useGoogleMaps from '../../components/useGoogleMaps';
import AdvancedMarker from '../../components/AdvancedMarker';

import { 
  MapPin, Search, CheckCircle,
  RefreshCw, AlertCircle, Layers, Navigation, 
  X, User, Navigation2, ChevronDown, ChevronUp
} from 'lucide-react';

// ─── Constantes del mapa ────────────────────────────────────────────────────
const MAP_CENTER = { lat: -1.5524640784867034, lng: -78.76020826859998 }; 
const DEFAULT_ZOOM = 13;

// ─── Paleta de colores por estado ───────────────────────────────────────────
const MARKER_COLORS = {
  currentUser: '#8b5cf6',   // Morado – tu medidor
  active:      '#10b981',   // Verde  – activo y asignado
  unassigned:  '#f59e0b',   // Ámbar  – sin asignar
  inactive:    '#ef4444',   // Rojo   – inactivo
};

// ─── SVG para el pin de Google Maps ─────────────────────────────────────────
const buildPinSvg = (color, size = 30, isCurrentUser = false) => {
  const s     = isCurrentUser ? size + 8 : size;
  const emoji = isCurrentUser ? '🏠' : '📍';
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s + 8}" viewBox="0 0 40 48">
      <circle cx="20" cy="18" r="16" fill="${color}" stroke="#fff" stroke-width="2.5"/>
      <text x="20" y="23" text-anchor="middle" font-size="14">${emoji}</text>
      <polygon points="14,30 26,30 20,44" fill="${color}"/>
    </svg>
  `;
};

// Pin especial para la ubicación del dispositivo
const buildLocationPinSvg = () => `
  <svg xmlns="http://www.w3.org/2000/svg" width="42" height="50" viewBox="0 0 42 50">
    <circle cx="21" cy="19" r="17" fill="#2563eb" stroke="#fff" stroke-width="3"/>
    <circle cx="21" cy="19" r="8" fill="#fff" opacity="0.9"/>
    <circle cx="21" cy="19" r="4" fill="#2563eb"/>
    <polygon points="15,32 27,32 21,46" fill="#2563eb"/>
  </svg>
`;

const svgToDataUrl = (svg) =>
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

// ─── Obtener color y tamaño según el estado del medidor ─────────────────────
const getMedidorStyle = (medidor, isCurrentUser) => {
  if (isCurrentUser)           return { color: MARKER_COLORS.currentUser, size: 38 };
  if (!medidor.activo)         return { color: MARKER_COLORS.inactive,    size: 30 };
  if (!medidor.id_usuario_afi) return { color: MARKER_COLORS.unassigned,  size: 30 };
  return                              { color: MARKER_COLORS.active,       size: 30 };
};

const mapContainerStyle = { width: '100%', height: '100%' };

const mapOptions = {
  mapId: 'ee4b5fdd2e16cee3b6900950', 
  mapTypeId: 'hybrid',
  mapTypeControl: true,
  mapTypeControlOptions: {
    style: 2,
    position: 3,
    mapTypeIds: ['hybrid', 'satellite', 'roadmap'],
  },
  zoomControl: true,
  zoomControlOptions: { position: 9 },
  scaleControl: true,
  streetViewControl: false,
  fullscreenControl: true,
  maxZoom: 22,
  minZoom: 10,
};

// ════════════════════════════════════════════════════════════════════════════
const GeolocationSection = () => {
  const mapRef             = useRef(null);
  const shouldFitBoundsRef = useRef(true);

  const [medidores,        setMedidores]        = useState([]);
  const [sectores,         setSectores]         = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [searchTerm,       setSearchTerm]       = useState('');
  const [filterSector,     setFilterSector]     = useState('all');
  const [filterStatus,     setFilterStatus]     = useState('all');
  const [filterAsignacion, setFilterAsignacion] = useState('all');
  const [showSidebar,      setShowSidebar]      = useState(true);
  const [selectedMedidor,  setSelectedMedidor]  = useState(null);
  const [error,            setError]            = useState(null);
  const [estadisticas,     setEstadisticas]     = useState(null);
  const [,                 setCurrentUser]      = useState(null);
  const [permissions,      setPermissions]      = useState({ canRead: false, canUpdate: false });
  const [mapInstance,      setMapInstance]      = useState(null);
  const [userLocation,     setUserLocation]     = useState(null);
  const [,                 setLocationError]    = useState(null);

  // ── ✅ CORREGIDO: Set de IDs de los medidores del usuario autenticado ─────
  // Antes: const [miMedidor, setMiMedidor] = useState(null);  → solo 1
  // Ahora: Set con todos los id_medidor que le pertenecen     → N medidores
  const [misMedidoresIds, setMisMedidoresIds] = useState(new Set());

  // ── Estado de la leyenda desplegable ──────────────────────────────────────
  const [legendaAbierta, setLegendaAbierta] = useState(false);

  const { isLoaded, loadError } = useGoogleMaps();

  // ── Permisos y usuario ────────────────────────────────────────────────────
  useEffect(() => {
    const canRead   = authService.hasPermission('geolocalizacion', 'lectura') ||
                      authService.hasPermission('geolocalizacion', 'operaciones crud');
    const canUpdate = authService.hasPermission('geolocalizacion', 'actualizar') ||
                      authService.hasPermission('geolocalizacion', 'operaciones crud');
    setPermissions({ canRead, canUpdate });
    setCurrentUser(authService.getCurrentUser());
  }, []);

  // ── Cargar datos ──────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!permissions.canRead) {
      setError('No tienes permiso para ver la geolocalización');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [medidoresResult, sectoresResult, statsResult, misMedidoresResult] = await Promise.all([
        geolocalizacionService.getMedidoresGeo(),
        geolocalizacionService.getSectores(),
        geolocalizacionService.getEstadisticasGeo(),
        // ✅ CORREGIDO: getMisMedidores() retorna array
        geolocalizacionService.getMisMedidores(),
      ]);

      // ✅ Construir Set de IDs a partir del array retornado
      const idsSet = new Set(
        misMedidoresResult.success && Array.isArray(misMedidoresResult.data)
          ? misMedidoresResult.data.map(m => m.id_medidor)
          : []
      );
      setMisMedidoresIds(idsSet);

      if (medidoresResult.success) {
        const sorted = [...medidoresResult.data].sort((a, b) => {
          // ✅ CORREGIDO: usar Set para el sort
          const isA = idsSet.has(a.id_medidor);
          const isB = idsSet.has(b.id_medidor);
          if (isA && !isB) return -1;
          if (!isA && isB) return  1;
          const isAssA = a.id_usuario_afi != null;
          const isAssB = b.id_usuario_afi != null;
          if (isAssA && !isAssB) return -1;
          if (!isAssA && isAssB) return  1;
          if (isAssA && isAssB)  return (a.cod_usuario_afi || 0) - (b.cod_usuario_afi || 0);
          return (a.num_medidor || '').localeCompare(b.num_medidor || '');
        });
        setMedidores(sorted);
      } else {
        setError(medidoresResult.message);
      }

      if (sectoresResult.success) setSectores(sectoresResult.data);
      if (statsResult.success)    setEstadisticas(statsResult.data);

    } catch {
      setError('Error al cargar datos de geolocalización');
    } finally {
      setLoading(false);
    }
  }, [permissions.canRead]);

  useEffect(() => {
    if (permissions.canRead) fetchData();
  }, [fetchData, permissions.canRead]);

  // ── Ubicación del dispositivo ─────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocalización no soportada');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({
        lat:      pos.coords.latitude,
        lng:      pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }),
      (err) => {
        console.warn('No se pudo obtener ubicación:', err.message);
        setLocationError(err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // ── Filtros ───────────────────────────────────────────────────────────────
  const filteredMedidores = medidores
    .filter(m => {
      const matchesSearch =
        m.num_medidor.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.nombre_afiliado || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.cod_usuario_afi || '').toString().includes(searchTerm);
      const matchesSector =
        filterSector === 'all' || m.id_sector === parseInt(filterSector);
      const matchesStatus =
        filterStatus === 'all' ||
        (filterStatus === 'active'   &&  m.activo) ||
        (filterStatus === 'inactive' && !m.activo);
      const matchesAsig =
        filterAsignacion === 'all' ||
        (filterAsignacion === 'assigned'   &&  m.id_usuario_afi) ||
        (filterAsignacion === 'unassigned' && !m.id_usuario_afi);
      return matchesSearch && matchesSector && matchesStatus && matchesAsig;
    })
    .sort((a, b) => {
      // ✅ CORREGIDO: usar Set para el sort del filtro
      const isA = misMedidoresIds.has(a.id_medidor);
      const isB = misMedidoresIds.has(b.id_medidor);
      if (isA && !isB) return -1;
      if (!isA && isB) return  1;
      const isAssA = a.id_usuario_afi != null;
      const isAssB = b.id_usuario_afi != null;
      if (isAssA && !isAssB) return -1;
      if (!isAssA && isAssB) return  1;
      if (isAssA && isAssB)  return (a.cod_usuario_afi || 0) - (b.cod_usuario_afi || 0);
      return (a.num_medidor || '').localeCompare(b.num_medidor || '');
    });

  // ── Ajustar bounds ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapInstance || !shouldFitBoundsRef.current) return;
    const visible = filteredMedidores.filter(m => m.latitud && m.longitud);
    if (visible.length === 0) {
      mapInstance.panTo(MAP_CENTER);
      mapInstance.setZoom(DEFAULT_ZOOM);
      return;
    }
    const bounds = new window.google.maps.LatLngBounds();
    visible.forEach(m =>
      bounds.extend({ lat: parseFloat(m.latitud), lng: parseFloat(m.longitud) })
    );
    mapInstance.fitBounds(bounds, 40);
  }, [filteredMedidores, mapInstance]);

  // ── Centrar en medidor desde el sidebar ──────────────────────────────────
  const centrarEnMedidor = (medidor) => {
    if (!mapInstance || !medidor.latitud || !medidor.longitud) return;
    shouldFitBoundsRef.current = false;
    mapInstance.panTo({ lat: parseFloat(medidor.latitud), lng: parseFloat(medidor.longitud) });
    mapInstance.setZoom(20);
    setSelectedMedidor(medidor);
  };

  const handleReload = () => {
    geolocalizacionService.clearCache();
    shouldFitBoundsRef.current = true;
    fetchData();
  };

  // ─────────────────────────────────────────────────────────────────────────
  if (!permissions.canRead) {
    return (
      <div className="section-placeholder">
        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
        <h2>Acceso Denegado</h2>
        <p>No tienes permiso para acceder al módulo de geolocalización.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="section-placeholder">
        <RefreshCw className="w-16 h-16 mx-auto mb-4 text-gray-400 animate-spin" />
        <h2>Cargando Datos</h2>
        <p>Cargando medidores geolocalizados...</p>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="users-section">

      {/* HEADER */}
      <div className="section-header">
        <div className="section-title">
          <MapPin className="w-7 h-7 text-blue-600" />
          <div>
            <h2>Geolocalización de Medidores</h2>
            <p className="section-subtitle">Ubicación en el mapa de los medidores</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setShowSidebar(!showSidebar)} title="Mostrar/Ocultar lista">
            <Layers className="w-4 h-4" />
          </button>
          <button className="btn-secondary" onClick={handleReload} title="Recargar">
            <RefreshCw className="w-4 h-4" />
          </button>
          {userLocation && (
            <button
              className="btn-secondary"
              onClick={() => {
                if (!mapInstance) return;
                shouldFitBoundsRef.current = false;
                mapInstance.panTo(userLocation);
                mapInstance.setZoom(18);
              }}
              title="Ir a mi ubicación"
            >
              <Navigation className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ESTADÍSTICAS */}
      {estadisticas && permissions.canUpdate && (
        <div className="periodo-stats-container">
          <div className="periodo-stats-header">
            <MapPin className="w-5 h-5 text-blue-600 mr-2" />
            <h3>Resumen de Geolocalización</h3>
          </div>
          <div className="users-stats">
            <div className="stat-item">
              <MapPin className="stat-icon text-blue-600" />
              <div>
                <p className="stat-label">Total Medidores</p>
                <p className="stat-value">{estadisticas.total_medidores}</p>
              </div>
            </div>
            <div className="stat-item active green">
              <Navigation className="stat-icon text-green-600" />
              <div>
                <p className="stat-label">Con Geolocalización</p>
                <p className="stat-value">{estadisticas.medidores_con_geo}</p>
              </div>
            </div>
            <div className="stat-item active emerald">
              <CheckCircle className="stat-icon text-emerald-600" />
              <div>
                <p className="stat-label">Activos</p>
                <p className="stat-value">{estadisticas.medidores_activos}</p>
              </div>
            </div>
            <div className="stat-item active purple">
              <User className="stat-icon text-purple-600" />
              <div>
                <p className="stat-label">Asignados</p>
                <p className="stat-value">{estadisticas.medidores_asignados}</p>
              </div>
            </div>
            <div className="stat-item active orange">
              <Layers className="stat-icon text-orange-600" />
              <div>
                <p className="stat-label">Cobertura Geo</p>
                <p className="stat-value">{estadisticas.cobertura_geo}%</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FILTROS */}
      <div className="filters-section">
        <div className="search-container">
          <Search className="search-icon" />
          <input
            type="text"
            placeholder="Buscar medidor o usuario..."
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {permissions.canUpdate && (
          <div className="filters-right">
            <select className="filter-select" value={filterSector} onChange={(e) => setFilterSector(e.target.value)}>
              <option value="all">Todos los sectores</option>
              {sectores.filter(s => s.activo).map(s => (
                <option key={s.id_sector} value={s.id_sector}>{s.nombre_sector}</option>
              ))}
            </select>
            <select className="filter-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="all">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
            <select className="filter-select" value={filterAsignacion} onChange={(e) => setFilterAsignacion(e.target.value)}>
              <option value="all">Todas las asignaciones</option>
              <option value="assigned">Asignados</option>
              <option value="unassigned">Sin asignar</option>
            </select>
            <button
              className="btn-secondary"
              onClick={() => {
                setSearchTerm('');
                setFilterSector('all');
                setFilterStatus('all');
                setFilterAsignacion('all');
                shouldFitBoundsRef.current = true;
              }}
              title="Limpiar filtros"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="alert alert-error mb-4">
          <AlertCircle className="w-5 h-5 mr-2" />
          {error}
        </div>
      )}

      {/* CONTENEDOR PRINCIPAL */}
      <div className="geo-main">

        {/* SIDEBAR */}
        {showSidebar && (
          <div className="geo-sidebar">
            <h3 className="sidebar-title">
              <MapPin className="w-5 h-5" />
              Medidores ({filteredMedidores.length})
            </h3>
            <div className="sidebar-list">
              {filteredMedidores.map(medidor => {
                // ✅ CORREGIDO: consulta en el Set en O(1)
                const isCurrentUser = misMedidoresIds.has(medidor.id_medidor);
                return (
                  <div
                    key={medidor.id_medidor}
                    className={`sidebar-item ${selectedMedidor?.id_medidor === medidor.id_medidor ? 'selected' : ''} ${isCurrentUser ? 'current-user' : ''}`}
                    onClick={() => centrarEnMedidor(medidor)}
                  >
                    <div className="sidebar-item-header">
                      <div className="flex items-center gap-2">
                        <div className={`status-dot ${medidor.activo ? 'active' : 'inactive'}`} />
                        <span className="font-semibold">
                          {isCurrentUser && '🏠 '}
                          {medidor.num_medidor}
                        </span>
                      </div>
                      <Navigation2 className="w-4 h-4 text-gray-400" />
                    </div>
                    {isCurrentUser && (
                      <p className="text-xs text-purple-600 font-semibold">👤 Tu medidor</p>
                    )}
                    {medidor.nombre_afiliado && (
                      <p className="text-sm text-gray-600">
                        <User className="w-3 h-3 inline mr-1" />
                        {medidor.nombre_afiliado}
                        {medidor.cod_usuario_afi && (
                          <span className="text-xs text-gray-500 ml-1">(Cód: {medidor.cod_usuario_afi})</span>
                        )}
                      </p>
                    )}
                    {medidor.nombre_sector && (
                      <p className="text-xs text-gray-500">{medidor.nombre_sector}</p>
                    )}
                    {medidor.latitud && medidor.longitud && (
                      <div className="text-xs text-gray-400 mt-1">
                        📍 {parseFloat(medidor.latitud).toFixed(6)}, {parseFloat(medidor.longitud).toFixed(6)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* MAPA */}
        <div className="geo-map-container" style={{ position: 'relative' }}>

          {loadError && (
            <div className="loading-map">
              <AlertCircle className="w-10 h-10 text-red-400 mb-2" />
              <p>Error al cargar Google Maps. Verifica tu API key.</p>
            </div>
          )}

          {!isLoaded && !loadError && (
            <div className="loading-map">
              <div className="spinner" />
              <p>Inicializando mapa...</p>
            </div>
          )}

          {isLoaded && !loadError && (
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={MAP_CENTER}
              zoom={DEFAULT_ZOOM}
              options={mapOptions}
              onLoad={(map) => {
                mapRef.current = map;
                setMapInstance(map);
              }}
              onUnmount={() => {
                mapRef.current = null;
                setMapInstance(null);
              }}
              onClick={() => setSelectedMedidor(null)}
            >
              {filteredMedidores.map((medidor) => {
                if (!medidor.latitud || !medidor.longitud) return null;
                // ✅ CORREGIDO: consulta en el Set
                const isCurrentUser = misMedidoresIds.has(medidor.id_medidor);
                const { color, size } = getMedidorStyle(medidor, isCurrentUser);
                return (
                  <AdvancedMarker
                    key={medidor.id_medidor}
                    map={mapInstance}
                    position={{ lat: parseFloat(medidor.latitud), lng: parseFloat(medidor.longitud) }}
                    icon={{
                      url: svgToDataUrl(buildPinSvg(color, size, isCurrentUser)),
                      scaledSize: { width: size, height: size },
                    }}
                    onClick={() => setSelectedMedidor(medidor)}
                    zIndex={isCurrentUser ? 100 : 1}
                    title={medidor.num_medidor}
                  />
                );
              })}

              {/* Marcador de ubicación actual del dispositivo */}
              {userLocation && mapInstance && (
                <AdvancedMarker
                  map={mapInstance}
                  position={userLocation}
                  icon={{
                    url: svgToDataUrl(buildLocationPinSvg()),
                    scaledSize: { width: 42, height: 50 },
                  }}
                  zIndex={200}
                  title="Tu ubicación actual"
                  onClick={() => {
                    mapInstance.panTo(userLocation);
                    mapInstance.setZoom(18);
                  }}
                />
              )}

              {/* InfoWindow */}
              {selectedMedidor && selectedMedidor.latitud && selectedMedidor.longitud && (
                <InfoWindow
                  position={{
                    lat: parseFloat(selectedMedidor.latitud),
                    lng: parseFloat(selectedMedidor.longitud),
                  }}
                  onCloseClick={() => setSelectedMedidor(null)}
                >
                  <div className="marker-popup" style={{ minWidth: 200 }}>
                    <h4 style={{ margin: '0 0 6px', fontWeight: 700 }}>
                      {/* ✅ CORREGIDO: consulta en el Set */}
                      {misMedidoresIds.has(selectedMedidor.id_medidor) ? '🏠' : '📍'}{' '}
                      {selectedMedidor.num_medidor}
                    </h4>
                    {misMedidoresIds.has(selectedMedidor.id_medidor) && (
                      <p style={{ color: '#7c3aed', fontWeight: 600, margin: '0 0 4px' }}>👤 Tu medidor</p>
                    )}
                    {selectedMedidor.nombre_afiliado ? (
                      <>
                        <p style={{ margin: '2px 0' }}><strong>Usuario:</strong> {selectedMedidor.nombre_afiliado}</p>
                        {selectedMedidor.cod_usuario_afi && (
                          <p style={{ margin: '2px 0' }}><strong>Código:</strong> {selectedMedidor.cod_usuario_afi}</p>
                        )}
                      </>
                    ) : (
                      <p style={{ margin: '2px 0', fontStyle: 'italic', color: '#6b7280' }}>Sin usuario asignado</p>
                    )}
                    {selectedMedidor.nombre_sector && (
                      <p style={{ margin: '2px 0' }}><strong>Sector:</strong> {selectedMedidor.nombre_sector}</p>
                    )}
                    <p style={{ margin: '4px 0 2px' }}>
                      <strong>Estado:</strong>{' '}
                      <span style={{ color: selectedMedidor.activo ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                        {selectedMedidor.activo ? '✅ Activo' : '❌ Inactivo'}
                      </span>
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9ca3af' }}>
                      📍 {parseFloat(selectedMedidor.latitud).toFixed(5)},{' '}
                      {parseFloat(selectedMedidor.longitud).toFixed(5)}
                      {selectedMedidor.altitud && (
                        <> · Alt: {parseFloat(selectedMedidor.altitud).toFixed(2)} m</>
                      )}
                    </p>
                  </div>
                </InfoWindow>
              )}
            </GoogleMap>
          )}

          {/* ── LEYENDA DESPLEGABLE ────────────────────────────────────── */}
          {isLoaded && (
            <div className="map-legend">
              <button
                className="legend-toggle"
                onClick={() => setLegendaAbierta(prev => !prev)}
                title={legendaAbierta ? 'Ocultar leyenda' : 'Mostrar leyenda'}
              >
                <span className="legend-title">Leyenda</span>
                {legendaAbierta
                  ? <ChevronUp   className="w-3 h-3" />
                  : <ChevronDown className="w-3 h-3" />
                }
              </button>

              {legendaAbierta && (
                <div className="legend-items">
                  {[
                    { color: MARKER_COLORS.currentUser, label: 'Tu medidor'        },
                    { color: MARKER_COLORS.active,      label: 'Activo y Asignado' },
                    { color: MARKER_COLORS.unassigned,  label: 'Sin Asignar'       },
                    { color: MARKER_COLORS.inactive,    label: 'Inactivo'          },
                  ].map(({ color, label }) => (
                    <div key={label} className="legend-item">
                      <div className="legend-dot" style={{ backgroundColor: color }} />
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {filteredMedidores.length === 0 && !loading && (
        <div className="empty-state">
          <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3>No se encontraron medidores</h3>
          <p>No hay medidores con geolocalización que coincidan con los filtros.</p>
        </div>
      )}
    </div>
  );
};

export default GeolocationSection;