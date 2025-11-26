// src/components/GeolocationSection.js
// MÓDULO DE GEOLOCALIZACIÓN - Visualización de medidores en mapa
import React, { useState, useEffect, useCallback, useRef } from 'react';
import './GeolocationSection.css';
import geolocalizacionService from '../services/geolocationsServices';
import authService from '../services/authServices';
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { 
  Map, MapPin, Search, CheckCircle, XCircle,
  RefreshCw, AlertCircle, Layers, Navigation, 
  X, User, Navigation2, ZoomIn, ZoomOut, Maximize2
} from 'lucide-react';

const GeolocationSection = () => {
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const markersRef = useRef([]);
  const mapInitializedRef = useRef(false);
  
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
  
  // 📍 Coordenadas de Riobamba, Chimborazo, Ecuador
  const DEFAULT_ZOOM = 13;

  // 🔑 PERMISOS
  const [permissions, setPermissions] = useState({
    canRead: false,
    canUpdate: false
  });

  useEffect(() => {
    loadUserPermissions();
  }, []);

  const loadUserPermissions = () => {
    const canRead = authService.hasPermission('medidores', 'lectura') ||
                     authService.hasPermission('medidores', 'operaciones crud');
    
    const canUpdate = authService.hasPermission('medidores', 'actualizar') ||
                      authService.hasPermission('medidores', 'operaciones crud');

    setPermissions({ canRead, canUpdate });
    console.log('🔐 Permisos en módulo Geolocalización:', { canRead, canUpdate });
  };

  // 🗺️ INICIALIZAR MAPA (UNA SOLA VEZ)
  useEffect(() => {
    console.log("📌 useEffect MAPA - Entrada");
    console.log("📌 mapContainerRef.current:", mapContainerRef.current);
    console.log("📌 mapInitializedRef.current:", mapInitializedRef.current);
    console.log("📌 loading:", loading);

    if (!mapContainerRef.current || mapInitializedRef.current) {
      console.log("❌ Saliendo - No hay contenedor o ya inicializado");
      return;
    }

    // Esperar a que termine de cargar y el contenedor tenga tamaño
    const initTimeout = setTimeout(() => {
      if (!mapContainerRef.current) {
        console.log("❌ No hay contenedor después del timeout");
        return;
      }
      
      const height = mapContainerRef.current.offsetHeight;
      console.log("📏 Altura del contenedor:", height);
      
      if (height < 50) {
        console.warn("⏳ Contenedor sin tamaño aún, reintentando...");
        return;
      }

      try {
        console.log("✅ INICIANDO MAPA - Contenedor listo");
        
        // Crear mapa con centro en Riobamba
        const map = L.map(mapContainerRef.current, {
          center: [-1.6635, -78.6547],
          zoom: DEFAULT_ZOOM,
          zoomControl: false,
          maxZoom: 22,
          minZoom: 10
        });

        // 🛰️ MÚLTIPLES CAPAS DE TILES (Usuario puede elegir)
        const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap',
          maxZoom: 19
        });

        const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          attribution: 'Esri',
          maxZoom: 22
        });

        const hybridLayer = L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
          maxZoom: 22,
          subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
          attribution: '© Google'
        });

        // Agregar capa híbrida por defecto (satélite + etiquetas)
        hybridLayer.addTo(map);

        // Control de capas
        const baseMaps = {
          "🛰️ Satélite + Etiquetas": hybridLayer,
          "🛰️ Solo Satélite": satelliteLayer,
          "🗺️ Calles": streetLayer
        };
        
        L.control.layers(baseMaps).addTo(map);

        // Controles de zoom personalizados
        L.control.zoom({
          position: 'topright'
        }).addTo(map);

        // Escala
        L.control.scale({
          position: 'bottomleft',
          metric: true,
          imperial: false
        }).addTo(map);

        mapRef.current = map;
        mapInitializedRef.current = true;
        setMapReady(true);

        console.log("✅ Mapa inicializado correctamente");
        console.log("✅ mapRef.current asignado:", !!mapRef.current);
        console.log("✅ mapReady será true en un momento");

        // Invalidar tamaño después de un momento
        setTimeout(() => {
          if (map) {
            map.invalidateSize();
            console.log("✅ invalidateSize ejecutado");
          }
        }, 300);

      } catch (err) {
        console.error("❌ Error inicializando mapa:", err);
        setError("Error al inicializar el mapa: " + err.message);
      }
    }, 500); // Aumentado a 500ms para dar tiempo al DOM

    return () => {
      console.log("🧹 Limpieza del useEffect del mapa");
      clearTimeout(initTimeout);
    };
  }, [loading ]); // ⚠️ Array vacío - solo se ejecuta UNA VEZ al montar

  // 📡 CARGAR DATOS
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
        setMedidores(medidoresResult.data);
        console.log('✅ Medidores geo cargados:', medidoresResult.data.length);
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
      console.error('Error en fetchData:', err);
    } finally {
      setLoading(false);
    }
  }, [permissions.canRead]);

  useEffect(() => {
    if (permissions.canRead) {
      console.log('🔄 Cargando datos geo...');
      fetchData();
    }
  }, [fetchData, permissions.canRead]);

  // 🎯 FILTRAR MEDIDORES
  const filteredMedidores = medidores.filter(medidor => {
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
  });

  const handleMarkerClick = useCallback((medidor) => {
    setSelectedMedidor(medidor);
  }, []);

  // 🗺️ RENDERIZAR MARCADORES
  const renderMarkers = useCallback(() => {
    if (!mapRef.current || !mapReady) return;

    // Limpiar marcadores anteriores
    markersRef.current.forEach(marker => {
      try {
        marker.remove();
      } catch (e) {
        console.warn('Error removiendo marcador:', e);
      }
    });
    markersRef.current = [];

    console.log(`🗺️ Renderizando ${filteredMedidores.length} marcadores...`);

    filteredMedidores.forEach(medidor => {
      if (!medidor.latitud || !medidor.longitud) return;

      try {
        // Determinar color según estado
        let markerColor = '#3b82f6';
        if (!medidor.activo) markerColor = '#ef4444'; // Rojo: Inactivo
        else if (!medidor.id_usuario_afi) markerColor = '#f59e0b'; // Amarillo: Sin asignar
        else markerColor = '#10b981'; // Verde: Activo y asignado

        // Icono personalizado más visible
        const icon = L.divIcon({
          html: `
            <div style="
              background-color: ${markerColor};
              width: 30px;
              height: 30px;
              border-radius: 50%;
              border: 3px solid white;
              box-shadow: 0 3px 8px rgba(0,0,0,0.4);
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 14px;
              font-weight: bold;
              color: white;
            ">📍</div>
          `,
          className: 'custom-marker',
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });

        const marker = L.marker(
          [parseFloat(medidor.latitud), parseFloat(medidor.longitud)],
          { icon }
        )
          .addTo(mapRef.current)
          .on('click', () => handleMarkerClick(medidor));

        // Popup mejorado
        const popupContent = `
          <div style="padding: 12px; min-width: 220px; font-family: system-ui;">
            <h4 style="margin: 0 0 10px 0; font-size: 15px; font-weight: 600; color: #1f2937;">
              📍 ${medidor.num_medidor}
            </h4>
            ${medidor.usuario_afiliado ? 
              `<p style="margin: 6px 0; font-size: 13px; color: #374151;">
                <strong>👤 Usuario:</strong> ${medidor.usuario_afiliado.nombre_afiliado}
              </p>` : 
              '<p style="margin: 6px 0; font-size: 13px; color: #9ca3af;"><em>⚠️ Sin asignar</em></p>'
            }
            ${medidor.sector ? 
              `<p style="margin: 6px 0; font-size: 13px; color: #374151;">
                <strong>📂 Sector:</strong> ${medidor.sector.nombre_sector}
              </p>` : 
              ''
            }
            <p style="margin: 6px 0; font-size: 13px; color: #374151;">
              <strong>Estado:</strong> 
              <span style="color: ${medidor.activo ? '#10b981' : '#ef4444'}; font-weight: 600;">
                ${medidor.activo ? '✅ Activo' : '❌ Inactivo'}
              </span>
            </p>
            <p style="margin: 8px 0 0 0; font-size: 11px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 6px;">
              📍 ${parseFloat(medidor.latitud).toFixed(5)}, ${parseFloat(medidor.longitud).toFixed(5)}
            </p>
          </div>
        `;

        marker.bindPopup(popupContent, {
          maxWidth: 300,
          className: 'custom-popup'
        });

        markersRef.current.push(marker);
      } catch (e) {
        console.warn('Error creando marcador:', e);
      }
    });

    // Ajustar vista a todos los marcadores
    if (markersRef.current.length > 0) {
      try {
        const group = L.featureGroup(markersRef.current);
        mapRef.current.fitBounds(group.getBounds().pad(0.1), {
          maxZoom: 22 // No hacer zoom excesivo
        });
      } catch (e) {
        console.warn('Error ajustando bounds:', e);
      }
    }

    console.log(`✅ ${markersRef.current.length} marcadores renderizados`);

  }, [filteredMedidores, handleMarkerClick, mapReady]);

  // Actualizar marcadores cuando cambian filtros
  useEffect(() => {
    if (mapReady && medidores.length > 0) {
      const timeout = setTimeout(() => {
        renderMarkers();
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [medidores, renderMarkers, mapReady]);

  // 📍 CENTRAR EN MEDIDOR
  const centrarEnMedidor = (medidor) => {
    if (mapRef.current && medidor.latitud && medidor.longitud) {
      mapRef.current.setView(
        [parseFloat(medidor.latitud), parseFloat(medidor.longitud)], 
        22, // Zoom alto para ver detalles
        { animate: true, duration: 0.5 }
      );
      setSelectedMedidor(medidor);
      
      // Abrir popup del marcador
      const marker = markersRef.current.find(m => {
        const pos = m.getLatLng();
        return pos.lat === parseFloat(medidor.latitud) && pos.lng === parseFloat(medidor.longitud);
      });
      if (marker) {
        marker.openPopup();
      }
    }
  };

  // 🔄 RECARGAR DATOS
  const handleReload = () => {
    geolocalizacionService.clearCache();
    fetchData();
  };

  // 🔍 AJUSTAR A TODOS LOS MARCADORES
  const fitAllMarkers = () => {
    if (mapRef.current && markersRef.current.length > 0) {
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
    console.log("⏳ Componente en estado LOADING");
    return (
      <div className="section-placeholder">
        <RefreshCw className="w-16 h-16 mx-auto mb-4 text-gray-400 animate-spin" />
        <h2>Cargando Datos</h2>
        <p>Cargando medidores geolocalizados...</p>
      </div>
    );
  }

  console.log("🎨 Renderizando componente principal");
  console.log("🗺️ Estado mapReady:", mapReady);
  console.log("📊 Medidores cargados:", medidores.length);

  return (
    <div className="users-section">
      {/* HEADER */}
      <div className="section-header">
        <div className="section-title">
          <Map className="w-6 h-6 text-blue-600" />
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
        
        <select 
          className="filter-select"
          value={filterSector}
          onChange={(e) => setFilterSector(e.target.value)}
        >
          <option value="all">Todos los sectores</option>
          {sectores.filter(s => s.activo).map(sector => (
            <option key={sector.id_sector} value={sector.id_sector}>
              {sector.nombre_sector}
            </option>
          ))}
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
          }}
          title="Limpiar filtros"
        >
          <X className="w-4 h-4" />
        </button>
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

      {/* ERROR */}
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
              {filteredMedidores.map(medidor => (
                <div 
                  key={medidor.id_medidor}
                  className={`sidebar-item ${selectedMedidor?.id_medidor === medidor.id_medidor ? 'selected' : ''}`}
                  onClick={() => centrarEnMedidor(medidor)}
                >
                  <div className="sidebar-item-header">
                    <div className="flex items-center gap-2">
                      <div className={`status-dot ${medidor.activo ? 'active' : 'inactive'}`} />
                      <span className="font-semibold">{medidor.num_medidor}</span>
                    </div>
                    <Navigation2 className="w-4 h-4 text-gray-400" />
                  </div>
                  
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
                      📍 {parseFloat(medidor.latitud).toFixed(10)}, {parseFloat(medidor.longitud).toFixed(10)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MAPA */}
        <div 
          ref={mapContainerRef}
          className="geo-map-container"
          style={{
            flex: 1,
            minHeight: "600px",
            height: "100%",
            position: "relative",
            backgroundColor: "#e5e7eb"
          }}
        >
          {!mapReady && (
            <div style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              textAlign: "center",
              zIndex: 1000
            }}>
              <RefreshCw className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-2" />
              <p className="text-gray-600">Inicializando mapa...</p>
            </div>
          )}

          {/* LEYENDA */}
          <div className="map-legend" style={{
            position: "absolute",
            bottom: "40px",
            right: "10px",
            background: "white",
            padding: "12px",
            borderRadius: "8px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            zIndex: 1000,
            fontSize: "13px"
          }}>
            <div style={{ fontWeight: "600", marginBottom: "8px" }}>Leyenda</div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <div style={{ width: "16px", height: "16px", borderRadius: "50%", background: "#10b981" }}></div>
              <span>Activo y Asignado</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <div style={{ width: "16px", height: "16px", borderRadius: "50%", background: "#f59e0b" }}></div>
              <span>Sin Asignar</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "16px", height: "16px", borderRadius: "50%", background: "#ef4444" }}></div>
              <span>Inactivo</span>
            </div>
          </div>
        </div>
      </div>

      {/* PANEL DE DETALLES */}
      {selectedMedidor && (
        <div className="modal-overlay" onClick={() => setSelectedMedidor(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Detalles del Medidor</h3>
              <button className="modal-close" onClick={() => setSelectedMedidor(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="user-details">
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