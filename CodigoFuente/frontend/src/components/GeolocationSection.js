// src/components/GeolocationSection.js
// MÓDULO DE GEOLOCALIZACIÓN - Visualización de medidores en mapa
import React, { useState, useEffect, useCallback, useRef } from 'react';
import './GeolocationSection.css';
import geolocalizacionService from '../services/geolocationsServices';
import authService from '../services/authServices';
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { 
  MapPin, Search, CheckCircle, XCircle,
  RefreshCw, AlertCircle, Layers, Navigation, 
  X, User, Navigation2, Maximize2
} from 'lucide-react';

const GeolocationSection = () => {
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const markersRef = useRef([]);
  const mapInitializedRef = useRef(false);
  const shouldFitBoundsRef = useRef(true);
  
  const [medidores, setMedidores] = useState([]);
  const [sectores, setSectores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSector, setFilterSector] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterAsignacion, setFilterAsignacion] = useState('all');
  const [showSidebar, setShowSidebar] = useState(true);
  const [selectedMedidor, setSelectedMedidor] = useState(null);
  const [error, setError] = useState(null);
  const [estadisticas, setEstadisticas] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  
  const DEFAULT_ZOOM = 13;

  const [permissions, setPermissions] = useState({
    canRead: false,
    canUpdate: false
  });

  useEffect(() => {
    const canRead = authService.hasPermission('medidores', 'lectura') ||
                    authService.hasPermission('medidores', 'operaciones crud');
    
    const canUpdate = authService.hasPermission('medidores', 'actualizar') ||
                      authService.hasPermission('medidores', 'operaciones crud');

    setPermissions({ canRead, canUpdate });
    // Obtener usuario actual
    setCurrentUser(authService.getCurrentUser());
  }, []);

  // Inicializar mapa
  useEffect(() => {
    if (!mapContainerRef.current || mapInitializedRef.current) return;

    const initTimeout = setTimeout(() => {
      if (!mapContainerRef.current) return;
      const height = mapContainerRef.current.offsetHeight;
      if (height < 50) return;

      try {
        const map = L.map(mapContainerRef.current, {
          center: [-1.6635, -78.6547],
          zoom: DEFAULT_ZOOM,
          zoomControl: false,
          maxZoom: 22,
          minZoom: 10
        });

        const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap',
          maxZoom: 19
        });

        const satelliteLayer = L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          { attribution: 'Esri', maxZoom: 22 }
        );

        const hybridLayer = L.tileLayer(
          'https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}',
          { maxZoom: 22, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'], attribution: '© Google' }
        );

        hybridLayer.addTo(map);

        const baseMaps = {
          "🛰️ Satélite + Etiquetas": hybridLayer,
          "🛰️ Solo Satélite": satelliteLayer,
          "🗺️ Calles": streetLayer
        };
        
        L.control.layers(baseMaps).addTo(map);
        L.control.zoom({ position: 'topright' }).addTo(map);
        L.control.scale({ position: 'bottomleft', metric: true, imperial: false }).addTo(map);

        mapRef.current = map;
        mapInitializedRef.current = true;
        setMapReady(true);

        setTimeout(() => {
          map.invalidateSize();
        }, 300);
      } catch (err) {
        setError("Error al inicializar el mapa: " + err.message);
      }
    }, 500);

    return () => clearTimeout(initTimeout);
  }, [loading]);

  // Cargar datos
  const fetchData = useCallback(async () => {
    if (!permissions.canRead) {
      setError('No tienes permiso para ver la geolocalización');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const [medidoresResult, sectoresResult, statsResult] = await Promise.all([
        geolocalizacionService.getMedidoresGeo(),
        geolocalizacionService.getSectores(),
        geolocalizacionService.getEstadisticasGeo()
      ]);

      if (medidoresResult.success) {
        let medidoresOrdenados = [...medidoresResult.data];
        
        if (currentUser?.id_usuario) {
          medidoresOrdenados.sort((a, b) => {
            if (a.id_usuario_afi === currentUser.id_usuario) return -1;
            if (b.id_usuario_afi === currentUser.id_usuario) return 1;
            return 0;
          });
        }
        
        setMedidores(medidoresOrdenados);
      } else {
        setError(medidoresResult.message);
      }

      if (sectoresResult.success) {
        setSectores(sectoresResult.data);
      }

      if (statsResult.success) {
        setEstadisticas(statsResult.data);
      }

    } catch (err) {
      setError('Error al cargar datos de geolocalización');
    } finally {
      setLoading(false);
    }
  }, [permissions.canRead, currentUser]);

  useEffect(() => {
    if (permissions.canRead) {
      fetchData();
    }
  }, [fetchData, permissions.canRead]);

  // Filtros
  const filteredMedidores = medidores
  .filter(medidor => {
    const matchesSearch = 
      medidor.num_medidor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (medidor.usuario_afiliado?.nombre_afiliado || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSector = 
      filterSector === 'all' || 
      medidor.id_sector === parseInt(filterSector);
    
    const matchesStatus = 
      filterStatus === 'all' || 
      (filterStatus === 'active' && medidor.activo) ||
      (filterStatus === 'inactive' && !medidor.activo);
    
    const matchesAsignacion = 
      filterAsignacion === 'all' ||
      (filterAsignacion === 'assigned' && medidor.id_usuario_afi) ||
      (filterAsignacion === 'unassigned' && !medidor.id_usuario_afi);
    
    return matchesSearch && matchesSector && matchesStatus && matchesAsignacion;
  })
  .sort((a, b) => {
    if (!currentUser?.id_usuario) return 0;

    if (a.id_usuario_afi === currentUser.id_usuario) return -1;
    if (b.id_usuario_afi === currentUser.id_usuario) return 1;

    return 0;
  });


  const handleMarkerClick = useCallback((medidor) => {
    setSelectedMedidor(medidor);
  }, []);

  // Renderizar marcadores
  const renderMarkers = useCallback(() => {
    if (!mapRef.current || !mapReady) return;

    markersRef.current.forEach(marker => {
      try { marker.remove(); } catch {}
    });
    markersRef.current = [];

    filteredMedidores.forEach(medidor => {
      if (!medidor.latitud || !medidor.longitud) return;

      try {
        const isCurrentUser = medidor.id_usuario_afi === currentUser?.id_usuario;
        
        let markerColor = '#3b82f6';
        let markerSize = 30;
        let markerIcon = '📍';
        
        if (isCurrentUser) {
          markerColor = '#8b5cf6';
          markerSize = 38;
          markerIcon = '🏠';
        } else if (!medidor.activo) {
          markerColor = '#ef4444';
        } else if (!medidor.id_usuario_afi) {
          markerColor = '#f59e0b';
        } else {
          markerColor = '#10b981';
        }

        const icon = L.divIcon({
          html: `
            <div class="geo-marker" 
                 data-size="${markerSize}" 
                 data-color="${markerColor}" 
                 data-current="${isCurrentUser ? '1' : '0'}">
              ${markerIcon}
            </div>
          `,
          className: 'custom-marker',
          iconSize: [markerSize, markerSize],
          iconAnchor: [markerSize/2, markerSize/2],
        });

        const marker = L.marker(
          [parseFloat(medidor.latitud), parseFloat(medidor.longitud)],
          { icon }
        ).addTo(mapRef.current)
         .on('click', () => handleMarkerClick(medidor));

        const usuario = medidor.usuario_afiliado;
        const tooltipContent = `
          <div class="geo-tooltip">
            <strong class="geo-tooltip-medidor">${medidor.num_medidor}</strong>
            ${
              usuario
                ? `<div class="geo-tooltip-user">
                    <div class="geo-tooltip-name">${usuario.nombre_afiliado}</div>
                    <div class="geo-tooltip-code">Cód: ${usuario.cod_usuario_afi || 'N/A'}</div>
                   </div>`
                : `<div class="geo-tooltip-user geo-tooltip-user--empty">
                    Sin usuario asignado
                   </div>`
            }
            ${isCurrentUser ? '<div class="geo-tooltip-current">👤 Tu medidor</div>' : ''}
          </div>
        `;
        
        marker.bindTooltip(tooltipContent, {
          permanent: false,
          direction: 'top',
          offset: [0, -20],
          className: 'custom-tooltip'
        });

        const popupContent = `
          <div class="marker-popup">
            <h4>${markerIcon} ${medidor.num_medidor}</h4>
            ${
              isCurrentUser
                ? `<div class="marker-popup-current">👤 Tu medidor</div>`
                : ''
            }
            ${
              usuario
                ? `<p><strong>Usuario:</strong> ${usuario.nombre_afiliado}</p>
                   <p><strong>Código:</strong> ${usuario.cod_usuario_afi || 'N/A'}</p>`
                : `<p><em>Sin usuario asignado</em></p>`
            }
            ${
              medidor.sector
                ? `<p><strong>Sector:</strong> ${medidor.sector.nombre_sector}</p>`
                : ''
            }
            <p>
              <strong>Estado:</strong> 
              <span class="${medidor.activo ? 'text-success' : 'text-danger'}">
                ${medidor.activo ? 'Activo' : 'Inactivo'}
              </span>
            </p>
            <p class="marker-popup-coords">
              📍 ${parseFloat(medidor.latitud).toFixed(5)}, ${parseFloat(medidor.longitud).toFixed(5)}
            </p>
          </div>
        `;

        marker.bindPopup(popupContent, {
          maxWidth: 300,
          className: 'custom-popup'
        });

        markersRef.current.push(marker);
      } catch {}
    });

    if (shouldFitBoundsRef.current && markersRef.current.length > 0) {
  if (selectedMedidor) return;

  const group = L.featureGroup(markersRef.current);
  mapRef.current.fitBounds(group.getBounds().pad(0.1), { maxZoom: 18 });
}

  }, [filteredMedidores, handleMarkerClick, mapReady, currentUser, selectedMedidor]);

  useEffect(() => {
    if (mapReady && medidores.length > 0) {
      // Solo hacer fitBounds si NO hay medidor seleccionado
      //shouldFitBoundsRef.current = !selectedMedidor;
      const timeout = setTimeout(() => {
        renderMarkers();
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [searchTerm, filterSector, filterStatus, filterAsignacion, medidores, renderMarkers, mapReady, selectedMedidor]);

  const centrarEnMedidor = (medidor) => {
    if (mapRef.current && medidor.latitud && medidor.longitud) {
      shouldFitBoundsRef.current = false;
      mapRef.current.setView(
        [parseFloat(medidor.latitud), parseFloat(medidor.longitud)], 
        20,
        { animate: true, duration: 0.8 }
      );
      setSelectedMedidor(medidor);
      
      
    }
  };

  const handleReload = () => {
    geolocalizacionService.clearCache();
    shouldFitBoundsRef.current = true;
    fetchData();
  };

  const fitAllMarkers = () => {
    if (mapRef.current && markersRef.current.length > 0) {
      shouldFitBoundsRef.current = true;
      const group = L.featureGroup(markersRef.current);
      mapRef.current.fitBounds(group.getBounds().pad(0.1));
    }
  };

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

  return (
    <div className="users-section">
      {/* HEADER */}
      <div className="section-header">
        <div className="section-title">
          <MapPin className="w-6 h-6 text-blue-600" />
          <h2>Geolocalización de Medidores</h2>
        </div>

        <div className="flex gap-2">
          <button 
            className="btn-secondary"
            onClick={() => setShowSidebar(!showSidebar)}
            title="Mostrar/Ocultar lista"
          >
            <Layers className="w-4 h-4" />
          </button>

          <button 
            className="btn-secondary"
            onClick={fitAllMarkers}
            title="Ver todos los medidores"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          <button 
            className="btn-secondary"
            onClick={handleReload}
            title="Recargar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

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

        <div className="filters-right">
          <select 
            className="filter-select"
            value={filterSector}
            onChange={(e) => setFilterSector(e.target.value)}
          >
            <option value="all">Todos los sectores</option>
            {sectores
              .filter(s => s.activo)
              .map(sector => (
                <option key={sector.id_sector} value={sector.id_sector}>
                  {sector.nombre_sector}
                </option>
              ))
            }
          </select>

          <select 
            className="filter-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>

          <select 
            className="filter-select"
            value={filterAsignacion}
            onChange={(e) => setFilterAsignacion(e.target.value)}
          >
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
      </div>

      {/* ESTADÍSTICAS */}
      {estadisticas && (
        <div className="users-stats">
          <div className="stat-item">
            <MapPin className="stat-icon text-blue-600" />
            <div>
              <p className="stat-label">Total Medidores</p>
              <p className="stat-value">{estadisticas.total_medidores}</p>
            </div>
          </div>
          <div className="stat-item">
            <Navigation className="stat-icon text-green-600" />
            <div>
              <p className="stat-label">Con Geolocalización</p>
              <p className="stat-value">{estadisticas.medidores_con_geo}</p>
            </div>
          </div>
          <div className="stat-item">
            <CheckCircle className="stat-icon text-green-600" />
            <div>
              <p className="stat-label">Activos</p>
              <p className="stat-value">{estadisticas.medidores_activos}</p>
            </div>
          </div>
          <div className="stat-item">
            <User className="stat-icon text-purple-600" />
            <div>
              <p className="stat-label">Asignados</p>
              <p className="stat-value">{estadisticas.medidores_asignados}</p>
            </div>
          </div>
          <div className="stat-item">
            <Layers className="stat-icon text-orange-600" />
            <div>
              <p className="stat-label">Cobertura Geo</p>
              <p className="stat-value">{estadisticas.cobertura_geo}%</p>
            </div>
          </div>
        </div>
      )}

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
                const isCurrentUser = medidor.id_usuario_afi === currentUser?.id_usuario;
                
                return (
                  <div 
                    key={medidor.id_medidor}
                    className={
                      `sidebar-item ${
                        selectedMedidor?.id_medidor === medidor.id_medidor ? 'selected' : ''
                      } ${isCurrentUser ? 'current-user' : ''}`
                    }
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
                      <p className="text-xs text-purple-600 font-semibold">
                        👤 Tu medidor
                      </p>
                    )}
                    
                    {medidor.usuario_afiliado && (
                      <p className="text-sm text-gray-600">
                        <User className="w-3 h-3 inline mr-1" />
                        {medidor.usuario_afiliado.nombre_afiliado}
                      </p>
                    )}
                    
                    {medidor.sector && (
                      <p className="text-xs text-gray-500">
                        {medidor.sector.nombre_sector}
                      </p>
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
        <div ref={mapContainerRef} className="geo-map-container">
          {!mapReady && (
            <div className="loading-map">
              <div className="spinner" />
              <p>Inicializando mapa...</p>
            </div>
          )}

          <div className="map-legend">
            <div className="legend-title">Leyenda</div>
            <div className="legend-item">
              <div className="legend-dot" style={{ backgroundColor: '#8b5cf6' }}></div>
              <span>Tu medidor</span>
            </div>
            <div className="legend-item">
              <div className="legend-dot" style={{ backgroundColor: '#10b981' }}></div>
              <span>Activo y Asignado</span>
            </div>
            <div className="legend-item">
              <div className="legend-dot" style={{ backgroundColor: '#f59e0b' }}></div>
              <span>Sin Asignar</span>
            </div>
            <div className="legend-item">
              <div className="legend-dot" style={{ backgroundColor: '#ef4444' }}></div>
              <span>Inactivo</span>
            </div>
          </div>
        </div>
      </div>

      {/* PANEL DE DETALLES */}
      {selectedMedidor && (
        <div className="modal-overlay" onClick={() => {
          setSelectedMedidor(null);
          shouldFitBoundsRef.current = false;  // ← evita que el mapa se reajuste
        }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Detalles del Medidor</h3>
              <button className="modal-close" onClick={() => {
                setSelectedMedidor(null);
  shouldFitBoundsRef.current = false;  // ← evita que el mapa se reajuste
              }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="user-details">
                {selectedMedidor.id_usuario_afi === currentUser?.id_usuario && (
                  <div className="detail-group detail-group-current">
                    <p className="text-purple-700 font-semibold">
                      🏠 Este es tu medidor
                    </p>
                  </div>
                )}
                
                <div className="detail-group">
                  <label>Número de Medidor:</label>
                  <p className="font-semibold">{selectedMedidor.num_medidor}</p>
                </div>
                
                {selectedMedidor.usuario_afiliado && (
                  <>
                    <div className="detail-group">
                      <label>Usuario Asignado:</label>
                      <p>{selectedMedidor.usuario_afiliado.nombre_afiliado}</p>
                    </div>
                    <div className="detail-group">
                      <label>Código Usuario:</label>
                      <p>{selectedMedidor.usuario_afiliado.cod_usuario_afi}</p>
                    </div>
                  </>
                )}
                
                {selectedMedidor.sector && (
                  <div className="detail-group">
                    <label>Sector:</label>
                    <p>{selectedMedidor.sector.nombre_sector}</p>
                  </div>
                )}
                
                <div className="detail-group">
                  <label>Coordenadas:</label>
                  <p className="text-sm">
                    Lat: {parseFloat(selectedMedidor.latitud).toFixed(6)}<br/>
                    Lng: {parseFloat(selectedMedidor.longitud).toFixed(6)}
                    {selectedMedidor.altitud && <><br/>Alt: {parseFloat(selectedMedidor.altitud).toFixed(2)} m</>}
                  </p>
                </div>
                
                <div className="detail-group">
                  <label>Estado:</label>
                  <span className={`status-badge ${selectedMedidor.activo ? 'active' : 'inactive'}`}>
                    {selectedMedidor.activo ? (
                      <>
                        <CheckCircle className="w-3 h-3" />
                        Activo
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3" />
                        Inactivo
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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