// src/sections/general/GeolocationSection.js
// MÓDULO DE GEOLOCALIZACIÓN - Visualización de medidores en mapa (Google Maps)
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import './GeolocationSection.css';
import geolocalizacionService from '../../services/geolocationsServices';
import authService from '../../services/authServices';

import { GoogleMap, InfoWindow, Rectangle, Polygon } from '@react-google-maps/api';
import useGoogleMaps from '../../components/useGoogleMaps';
import AdvancedMarker from '../../components/AdvancedMarker';

import {
  MapPin, Search, CheckCircle,
  RefreshCw, AlertCircle, Layers, Navigation,
  X, User, Navigation2, ChevronDown, ChevronUp,
  LocateFixed, Crosshair, Check, Loader2, Move, Map, Plus, Save, Trash2
} from 'lucide-react';
import metersService from '../../services/metersServices';

// ─── Constantes del mapa ────────────────────────────────────────────────────
const MAP_CENTER  = { lat: -1.5524640784867034, lng: -78.76020826859998 };
const DEFAULT_ZOOM = 13;

// ─── Paleta de colores por estado ───────────────────────────────────────────
const MARKER_COLORS = {
  currentUser: '#8b5cf6',
  active:      '#10b981',
  unassigned:  '#f59e0b',
  inactive:    '#ef4444',
};

// ─── SVG pins ───────────────────────────────────────────────────────────────
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

const buildLocationPinSvg = () => `
  <svg xmlns="http://www.w3.org/2000/svg" width="42" height="50" viewBox="0 0 42 50">
    <circle cx="21" cy="19" r="17" fill="#2563eb" stroke="#fff" stroke-width="3"/>
    <circle cx="21" cy="19" r="8" fill="#fff" opacity="0.9"/>
    <circle cx="21" cy="19" r="4" fill="#2563eb"/>
    <polygon points="15,32 27,32 21,46" fill="#2563eb"/>
  </svg>
`;

// SVG del marcador de preview al seleccionar punto en el mapa
const buildPreviewPinSvg = () => `
  <svg width="36" height="36" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
    <circle cx="18" cy="18" r="14" fill="#f59e0b" stroke="white" stroke-width="3"/>
    <circle cx="18" cy="18" r="5" fill="white"/>
    <line x1="18" y1="2"  x2="18" y2="10" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="18" y1="26" x2="18" y2="34" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="2"  y1="18" x2="10" y2="18" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="26" y1="18" x2="34" y2="18" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
  </svg>
`;

const svgToDataUrl = (svg) =>
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

// ─── Estilo del marcador según estado ───────────────────────────────────────
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
const getAffiliateCode = (item) =>
  item?.cod_usuario_afi ??
  item?.codigo_afiliado ??
  item?.codigo_usuario_afi ??
  item?.codigo_usuarioafi ??
  item?.codigo ??
  '';

const getAffiliateCodeSortValue = (item) => {
  const rawCode = getAffiliateCode(item);
  const numericCode = Number.parseInt(rawCode, 10);
  return Number.isFinite(numericCode) ? numericCode : Number.MAX_SAFE_INTEGER;
};

const sortByAffiliateCode = (a, b) => {
  const codeDiff = getAffiliateCodeSortValue(a) - getAffiliateCodeSortValue(b);
  if (codeDiff !== 0) return codeDiff;
  return (a?.nombre_afiliado || '').localeCompare(b?.nombre_afiliado || '');
};

const sortMetersByAffiliateCode = (a, b) => {
  const codeDiff = getAffiliateCodeSortValue(a) - getAffiliateCodeSortValue(b);
  if (codeDiff !== 0) return codeDiff;
  return (a?.num_medidor || '').localeCompare(b?.num_medidor || '', undefined, { numeric: true });
};

const getInitials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase() || 'AF';

const meterHasCoordinates = (meter) => meter?.latitud != null && meter?.longitud != null;

const normalizeSearchText = (value = '') =>
  value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const hasAffiliateCode = (affiliate) => {
  const code = normalizeSearchText(getAffiliateCode(affiliate));
  return code.length > 0 && !['sin codigo', 'sin código', 's/c', 'n/a', 'null', 'undefined'].includes(code);
};

const GeolocationSection = () => {
  const mapRef             = useRef(null);
  const mapSectionRef      = useRef(null);
  const shouldFitBoundsRef = useRef(true);
  const medidorItemRefs    = useRef({});

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
  const [permissions,      setPermissions]      = useState({ canRead: false, canUpdate: false, canDelete: false });
  const [mapInstance,      setMapInstance]      = useState(null);
  const [userLocation,     setUserLocation]     = useState(null);
  const [,                 setLocationError]    = useState(null);
  const [misMedidoresIds,  setMisMedidoresIds]  = useState(new Set());
  const [legendaAbierta,   setLegendaAbierta]   = useState(false);

  // ── Modo actualizar coordenadas ──────────────────────────────────────────
  const [modoUbicacion, setModoUbicacion] = useState(null);   // medidor en edición
  const [coordPreview,  setCoordPreview]  = useState(null);   // {lat, lng} del clic
  const [confirmDialog, setConfirmDialog] = useState(false);  // dialog visible
  const [savingCoords,  setSavingCoords]  = useState(false);  // petición en curso
  const [toastGeo,      setToastGeo]      = useState(null);   // {tipo, msg}
  const [deletingMedidorId, setDeletingMedidorId] = useState(null);
  const [activatingMedidorId, setActivatingMedidorId] = useState(null);

  // Limites geográficos
  const [limitesGeo, setLimitesGeo] = useState([]);
  const [showLimites, setShowLimites] = useState(true);
  const [selectedLimite, setSelectedLimite] = useState(null);

  // estados para crear medidor
  const [modoCrearMedidor,   setModoCrearMedidor]   = useState(false);   // modo selección punto
  const [coordNuevoMedidor,  setCoordNuevoMedidor]  = useState(null);    // {lat, lng} del clic
  const [showCreateModal,    setShowCreateModal]    = useState(false);   // modal crear medidor
  const [availableAffiliates,setAvailableAffiliates]= useState([]);      // lista afiliados
  const [affiliateSearchTerm,setAffiliateSearchTerm]= useState('');      // buscador afiliado
  const [selectedAffiliateInfo, setSelectedAffiliateInfo] = useState(null);
  const [createForm,         setCreateForm]         = useState({         // datos del form
    num_medidor: '',
    id_usuario_afi: null,
    id_sector: null,
    altitud: '',
  });
  const [createError,  setCreateError]  = useState(null);
  const [createSaving, setCreateSaving] = useState(false);

  const [showAssignCoordsModal, setShowAssignCoordsModal] = useState(false);
  const [assignableMeters, setAssignableMeters] = useState([]);
  const [assignSearchTerm, setAssignSearchTerm] = useState('');
  const [assignCoordsError, setAssignCoordsError] = useState(null);
  const [loadingAssignableMeters, setLoadingAssignableMeters] = useState(false);


  const { isLoaded, loadError } = useGoogleMaps();

  const permissionsRef = useRef({ canRead: false, canUpdate: false, canDelete: false });

  const scrollToMedidorInList = useCallback((medidorId) => {
    const item = medidorItemRefs.current[medidorId];
    if (!item) return;
    item.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  // ── Permisos ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const canRead   = authService.hasPermission('geolocalizacion', 'lectura') ||
                      authService.hasPermission('geolocalizacion', 'operaciones crud');
    const canUpdate = authService.hasPermission('geolocalizacion', 'actualizar') ||
                      authService.hasPermission('geolocalizacion', 'operaciones crud') ||
                      authService.hasPermission('medidores', 'actualizar');
    const canDelete = authService.hasPermission('geolocalizacion', 'eliminar') ||
                      authService.hasPermission('geolocalizacion', 'operaciones crud') ||
                      authService.hasPermission('medidores', 'eliminar');
    permissionsRef.current = { canRead, canUpdate, canDelete };
    setPermissions({ canRead, canUpdate, canDelete });
    setCurrentUser(authService.getCurrentUser());
  }, []);

  // no dependen entre sí.
  const fetchData = useCallback(async (force = false) => {
    if (!permissionsRef.current.canRead) {
      setError('No tienes permiso para ver la geolocalización');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // ── 1. Medidores primero cuando force=true (evita race con estadísticas) ──
      const medidoresResult = await geolocalizacionService.getMedidoresGeo(force);

      // ── 2. El resto en paralelo — estadísticas reutiliza el cache recién cargado ──
      const [
        sectoresResult,
        statsResult,
        misMedidoresResult,
        limitesResult,
      ] = await Promise.all([
        geolocalizacionService.getSectores(),
        geolocalizacionService.getEstadisticasGeo(force),
        geolocalizacionService.getMisMedidores(force),    // ✅ pasa force
        geolocalizacionService.getLimitesGeograficos(),
      ]);

      if (limitesResult.success) setLimitesGeo(limitesResult.data || []);

      const idsSet = new Set(
        misMedidoresResult.success && Array.isArray(misMedidoresResult.data)
          ? misMedidoresResult.data.map(m => m.id_medidor)
          : []
      );
      setMisMedidoresIds(idsSet);

      if (medidoresResult.success) {
        const sorted = [...medidoresResult.data].sort((a, b) => {
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
  }, []);
  
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
        setLocationError(err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // ── Filtros ───────────────────────────────────────────────────────────────
const filteredMedidores = useMemo(() => {
  return medidores
    .filter(m => {
      const matchesSearch =
        m.num_medidor.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.nombre_afiliado || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.cod_usuario_afi || '').toString().includes(searchTerm);
      const matchesSector     = filterSector     === 'all' || m.id_sector === parseInt(filterSector);
      const matchesStatus     = filterStatus     === 'all' || (filterStatus === 'active' && m.activo) || (filterStatus === 'inactive' && !m.activo);
      const matchesAsignacion = filterAsignacion === 'all' || (filterAsignacion === 'assigned' && m.id_usuario_afi) || (filterAsignacion === 'unassigned' && !m.id_usuario_afi);
      return matchesSearch && matchesSector && matchesStatus && matchesAsignacion;
    })
    .sort((a, b) => {
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
}, [medidores, searchTerm, filterSector, filterStatus, filterAsignacion, misMedidoresIds]);

  useEffect(() => {
    if (!selectedMedidor || !showSidebar) return undefined;
    const timer = setTimeout(() => {
      scrollToMedidorInList(selectedMedidor.id_medidor);
    }, 80);
    return () => clearTimeout(timer);
  }, [selectedMedidor, showSidebar, scrollToMedidorInList]);

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

  // ── Centrar en medidor desde sidebar ─────────────────────────────────────
  const centrarEnMedidor = (medidor) => {
    if (!mapInstance || !medidor.latitud || !medidor.longitud) return;
    shouldFitBoundsRef.current = false;
    mapInstance.panTo({ lat: parseFloat(medidor.latitud), lng: parseFloat(medidor.longitud) });
    mapInstance.setZoom(20);
    setSelectedMedidor(medidor);
  };

  const ubicarMedidorEnLista = (medidor) => {
    if (!medidor) return;
    setShowSidebar(true);
    setTimeout(() => {
      scrollToMedidorInList(medidor.id_medidor);
    }, 120);
  };

  const handleReload = () => {
    geolocalizacionService.clearCache();
    shouldFitBoundsRef.current = true;
    fetchData(true);
  };

  // ── MODO ACTUALIZAR COORDENADAS ───────────────────────────────────────────
  const iniciarModoUbicacion = (medidor, e) => {
    e?.stopPropagation?.();
    setModoUbicacion(medidor);
    setCoordPreview(null);
    setConfirmDialog(false);
    setSelectedMedidor(null);
    if (mapInstance && medidor.latitud && medidor.longitud) {
      shouldFitBoundsRef.current = false;
      mapInstance.panTo({
        lat: parseFloat(medidor.latitud),
        lng: parseFloat(medidor.longitud),
      });
      mapInstance.setZoom(19);
    }
  };

  const cancelarModoUbicacion = () => {
    setModoUbicacion(null);
    setCoordPreview(null);
    setConfirmDialog(false);
  };

  // Clic en el mapa: solo actúa si hay modo activo; si no, cierra InfoWindow
  const handleMapClick = (event) => {
    // — Modo actualizar coordenadas  —
    if (modoUbicacion) {
      setCoordPreview({ lat: event.latLng.lat(), lng: event.latLng.lng() });
      setConfirmDialog(true);
      return;
    }

    // — Modo crear nuevo medidor —
    if (modoCrearMedidor) {
      const coord = { lat: event.latLng.lat(), lng: event.latLng.lng() };
      setCoordNuevoMedidor(coord);
      setCreateForm(f => ({ ...f, latitud: coord.lat, longitud: coord.lng }));
      setModoCrearMedidor(false);    
      fetchAffiliates();           
      setShowCreateModal(true);      
      return;
    }

    // — Caso base: cerrar InfoWindow —
    setSelectedMedidor(null);
  };

  // ── CREAR MEDIDOR ─────────────────────────────────────────────────────────
const handleCreateMedidor = async (e) => {
  e.preventDefault();
  if (!createForm.num_medidor.trim()) {
    setCreateError('El número de medidor es obligatorio.');
    return;
  }
  setCreateSaving(true);
  setCreateError(null);
  try {
    const payload = {
      num_medidor:    createForm.num_medidor.trim(),
      id_usuario_afi: createForm.id_usuario_afi || null,
      id_sector:      createForm.id_sector || null,
      latitud:        coordNuevoMedidor.lat,
      longitud:       coordNuevoMedidor.lng,
      altitud:        createForm.altitud !== '' ? parseFloat(createForm.altitud) : null,
    };
    const result = await metersService.createMeter(payload);
    if (result.success) {
      // Limpia caché y fuerza la recarga de los datos
      geolocalizacionService.clearCacheAndInflight('medidores_geo', '/geo/medidores');
      geolocalizacionService.clearCacheAndInflight('mis_medidores', '/geo/medidores/mis-medidores');
      geolocalizacionService.clearCacheAndInflight('estadisticas_geo', '/geo/estadisticas');
      setToastGeo({ tipo: 'exito', msg: `Medidor ${payload.num_medidor} creado correctamente` });
      cancelarModoCrearMedidor();
      shouldFitBoundsRef.current = true;
      await fetchData(true); // Forzar actualización
    } else {
      setCreateError(result.message || 'Error al crear el medidor');
    }
  } catch (err) {
    console.error('Error al crear medidor desde geolocalizacion:', err);
    setCreateError('Error de conexión al crear el medidor');
  } finally {
    setCreateSaving(false);
    setTimeout(() => setToastGeo(null), 4000);
  }
};


// ── CONFIRMAR ACTUALIZACIÓN ───────────────────────────────────────────────
const confirmarActualizacion = async () => {
  if (!modoUbicacion || !coordPreview) return;
  setSavingCoords(true);
  try {
    const result = await geolocalizacionService.actualizarCoordenadas(
      modoUbicacion.id_medidor,
      { latitud: coordPreview.lat, longitud: coordPreview.lng }
    );
    if (result.success) {
 
      cancelarModoUbicacion();
      shouldFitBoundsRef.current = true;
      setToastGeo({ tipo: 'exito', msg: `Ubicación de ${modoUbicacion.num_medidor} actualizada` });
      await fetchData(true);  
    } else {
      setToastGeo({ tipo: 'error', msg: result.message || 'Error al actualizar' });
    }
  } catch {
    setToastGeo({ tipo: 'error', msg: 'Error de conexión' });
  } finally {
    setSavingCoords(false);
    setConfirmDialog(false);
    setTimeout(() => setToastGeo(null), 4000);
  }
};


const eliminarMedidor = async (medidor, e) => {
  e.stopPropagation();
  if (!medidor || deletingMedidorId) return;

  const confirmar = window.confirm(
    `¿Eliminar el medidor ${medidor.num_medidor}?\n\nSi tiene registros relacionados, el sistema lo desactivará para conservar el historial.`
  );
  if (!confirmar) return;

  setDeletingMedidorId(medidor.id_medidor);
  try {
    const result = await geolocalizacionService.eliminarMedidor(medidor.id_medidor);

    if (!result.success) {
      setToastGeo({ tipo: 'error', msg: result.message || 'No se pudo eliminar el medidor' });
      return;
    }

    if (result.accion === 'eliminado') {
      setMedidores(prev => prev.filter(m => m.id_medidor !== medidor.id_medidor));
      if (selectedMedidor?.id_medidor === medidor.id_medidor) setSelectedMedidor(null);
    } else if (result.accion === 'desactivado') {
      const medidorActualizado = result.data?.medidor;
      setMedidores(prev => prev.map(m =>
        m.id_medidor === medidor.id_medidor
          ? { ...m, activo: false, ...(medidorActualizado || {}) }
          : m
      ));
    }

    shouldFitBoundsRef.current = true;
    setToastGeo({ tipo: 'exito', msg: result.message || 'Medidor actualizado' });
    await fetchData(true);
  } catch {
    setToastGeo({ tipo: 'error', msg: 'Error de conexión al eliminar medidor' });
  } finally {
    setDeletingMedidorId(null);
    setTimeout(() => setToastGeo(null), 4500);
  }
};


const activarMedidor = async (medidor, e) => {
  e.stopPropagation();
  if (!medidor || medidor.activo || activatingMedidorId) return;

  const confirmar = window.confirm(`Activar el medidor ${medidor.num_medidor}?`);
  if (!confirmar) return;

  setActivatingMedidorId(medidor.id_medidor);
  try {
    const result = await geolocalizacionService.activarMedidor(medidor.id_medidor);

    if (!result.success) {
      setToastGeo({ tipo: 'error', msg: result.message || 'No se pudo activar el medidor' });
      return;
    }

    const medidorActualizado = result.data?.medidor;
    setMedidores(prev => prev.map(m =>
      m.id_medidor === medidor.id_medidor
        ? { ...m, activo: true, ...(medidorActualizado || {}) }
        : m
    ));

    if (selectedMedidor?.id_medidor === medidor.id_medidor) {
      setSelectedMedidor(prev => prev ? { ...prev, activo: true, ...(medidorActualizado || {}) } : prev);
    }

    shouldFitBoundsRef.current = true;
    setToastGeo({ tipo: 'exito', msg: result.message || 'Medidor activado' });
    await fetchData(true);
  } catch {
    setToastGeo({ tipo: 'error', msg: 'Error de conexion al activar medidor' });
  } finally {
    setActivatingMedidorId(null);
    setTimeout(() => setToastGeo(null), 4500);
  }
};



  const fetchAffiliates = useCallback(async () => {
    try {
      const res = await metersService.getAvailableAffiliates();    
      if (res?.success) {
        setAvailableAffiliates(
          [...(res.data || [])]
            .filter(hasAffiliateCode)
            .sort(sortByAffiliateCode)
        );
      }
    } catch { /* silencioso */ }
  }, []);

  const affiliateSearchQuery = normalizeSearchText(affiliateSearchTerm);

  // Afiliados filtrados por buscador
  const filteredAffiliates = availableAffiliates.filter(a => {
    if (!hasAffiliateCode(a)) return false;
    if (!affiliateSearchQuery) return true;

    const searchableText = normalizeSearchText([
      a.nombre_afiliado,
      getAffiliateCode(a),
      a.cedula,
      a.nombre_sector,
    ].filter(Boolean).join(' '));

    return affiliateSearchQuery
      .split(/\s+/)
      .every(term => searchableText.includes(term));
  }).sort(sortByAffiliateCode);

  const clearSelectedAffiliate = useCallback(() => {
    setCreateForm(f => ({ ...f, id_usuario_afi: null }));
    setSelectedAffiliateInfo(null);
  }, []);

  const handleSelectAffiliate = useCallback((affiliate) => {
    const alreadySelected = createForm.id_usuario_afi === affiliate.id_usuario_afi;
    setCreateForm(f => ({
      ...f,
      id_usuario_afi: alreadySelected ? null : affiliate.id_usuario_afi,
    }));
    setSelectedAffiliateInfo(alreadySelected ? null : affiliate);
  }, [createForm.id_usuario_afi]);

  const fetchAssignableMeters = useCallback(async () => {
    setLoadingAssignableMeters(true);
    setAssignCoordsError(null);

    try {
      const limit = 500;
      let skip = 0;
      let allMeters = [];
      let keepLoading = true;

      while (keepLoading) {
        const result = await metersService.getMeters({ asignado: true, skip, limit });

        if (!result.success) {
          setAssignCoordsError(result.message || 'No se pudieron cargar los medidores asignados.');
          setAssignableMeters([]);
          return;
        }

        const page = result.data || [];
        allMeters = [...allMeters, ...page];
        keepLoading = page.length === limit;
        skip += limit;
      }

      const meters = allMeters
        .filter(meter => meter.id_usuario_afi)
        .sort(sortMetersByAffiliateCode);

      setAssignableMeters(meters);
    } catch {
      setAssignCoordsError('No se pudieron cargar los medidores asignados.');
      setAssignableMeters([]);
    } finally {
      setLoadingAssignableMeters(false);
    }
  }, []);

  const filteredAssignableMeters = assignableMeters.filter(meter => {
    const q = assignSearchTerm.trim().toLowerCase();
    if (!q) return true;

    return (
      (meter.nombre_afiliado || '').toLowerCase().includes(q) ||
      (meter.cod_usuario_afi || '').toString().includes(q) ||
      (meter.cedula || '').includes(q) ||
      (meter.num_medidor || '').toLowerCase().includes(q) ||
      (meter.nombre_sector || '').toLowerCase().includes(q)
    );
  }).sort(sortMetersByAffiliateCode);

  const abrirModalAsignarCoordenadas = () => {
    cancelarModoCrearMedidor();
    cancelarModoUbicacion();
    setAssignSearchTerm('');
    setShowAssignCoordsModal(true);
    fetchAssignableMeters();
  };

  const cerrarModalAsignarCoordenadas = () => {
    setShowAssignCoordsModal(false);
    setAssignSearchTerm('');
    setAssignCoordsError(null);
  };

  const seleccionarMedidorParaCoordenadas = (medidor) => {
    cerrarModalAsignarCoordenadas();
    iniciarModoUbicacion(medidor);

    if (window.matchMedia('(max-width: 1024px)').matches) {
      window.requestAnimationFrame(() => {
        mapSectionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      });
    }
  };

  const iniciarModoCrearMedidor = () => {
    // Cancela cualquier otro modo activo
    cancelarModoUbicacion();
    setModoCrearMedidor(true);
    setCoordNuevoMedidor(null);

    if (window.matchMedia('(max-width: 1024px)').matches) {
      window.requestAnimationFrame(() => {
        mapSectionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      });
    }
  };

  const cancelarModoCrearMedidor = () => {
    setModoCrearMedidor(false);
    setCoordNuevoMedidor(null);
    setShowCreateModal(false);
    setCreateForm({ num_medidor: '', id_usuario_afi: null, id_sector: null, altitud: '' });
    setCreateError(null);
    setSelectedAffiliateInfo(null);
    setAffiliateSearchTerm('');
  };
  // ✅ Correcto — solo corre cuando permissions.canRead cambia a true
useEffect(() => {
  if (permissions.canRead) {
    fetchData();
  }
}, [permissions.canRead, fetchData]); // no incluir fetchData aquí
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
const getRectangleBounds = (limite) => ({
  north: parseFloat(limite.norte),
  south: parseFloat(limite.sur),
  east: parseFloat(limite.este),
  west: parseFloat(limite.oeste),
});

const getRectangleCenter = (limite) => ({
  lat: (parseFloat(limite.norte) + parseFloat(limite.sur)) / 2,
  lng: (parseFloat(limite.este) + parseFloat(limite.oeste)) / 2,
});

const geoJsonToPaths = (geojson) => {
  if (!geojson) return [];

  if (geojson.type === 'Polygon') {
    return geojson.coordinates.map((ring) =>
      ring.map(([lng, lat]) => ({
        lat: parseFloat(lat),
        lng: parseFloat(lng),
      }))
    );
  }

  if (geojson.type === 'MultiPolygon') {
    return geojson.coordinates.flatMap((polygon) =>
      polygon.map((ring) =>
        ring.map(([lng, lat]) => ({
          lat: parseFloat(lat),
          lng: parseFloat(lng),
        }))
      )
    );
  }

  return [];
};

const limiteStyle = {
  fillColor: '#3b82f6',
  fillOpacity: 0.08,
  strokeColor: '#1d4ed8',
  strokeOpacity: 0.9,
  strokeWeight: 2.5,
  clickable: true,
  draggable: false,
  editable: false,
  zIndex: 2,
};

const limiteStyleHover = {
  ...limiteStyle,
  fillOpacity: 0.16,
  strokeWeight: 3,
};

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="users-section">

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div className="section-header">
        <div className="section-title">
          <MapPin className="w-7 h-7 text-blue-600" />
          <div>
            <h2>Geolocalización de Medidores</h2>
            <p className="section-subtitle">Ubicación en el mapa de los medidores</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            className={`btn-secondary ${showLimites ? 'geo-limites-toggle active' : 'geo-limites-toggle'}`}
            onClick={() => setShowLimites(prev => !prev)}
            title={showLimites ? 'Ocultar límites geográficos' : 'Mostrar límites geográficos'}
          >
            <Map className="w-4 h-4" />
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

          {permissions.canUpdate && (
            <>
              <button
                className="btn-secondary"
                onClick={abrirModalAsignarCoordenadas}
                title="Asignar coordenadas a un afiliado con medidor"
              >
                <Crosshair className="w-4 h-4 mr-1" />
                Asignar Coordenadas
              </button>
              <button
                className="btn-primary"
                onClick={iniciarModoCrearMedidor}
                title="Registrar nuevo medidor en el mapa"
              >
                <Plus className="w-4 h-4 mr-1" />
                Nuevo Medidor
              </button>
            </>
          )}

        </div>
      </div>

      {/* ── ESTADÍSTICAS ───────────────────────────────────────────────── */}
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
            <div className="stat-item">
              <Navigation className="stat-icon text-green-600" />
              <div>
                <p className="stat-label">Con Geolocalización</p>
                <p className="stat-value">{estadisticas.medidores_con_geo}</p>
              </div>
            </div>
            <div className="stat-item">
              <CheckCircle className="stat-icon text-emerald-600" />
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
        </div>
      )}

      {/* ── FILTROS ─────────────────────────────────────────────────────── */}
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
            <select
              className="filter-select"
              value={filterSector}
              onChange={(e) => setFilterSector(e.target.value)}
            >
              <option value="all">Todos los sectores</option>
              {sectores.map(s => (                              // ← sin .filter(s => s.activo)
                <option key={s.id_sector} value={s.id_sector}>{s.nombre_sector}</option>
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

      {/* ── CONTENEDOR PRINCIPAL: sidebar + mapa ────────────────────────── */}
      <div className="geo-main">

        {/* SIDEBAR */}
        {showSidebar && (
          <div className="geo-sidebar">
            <h3 className="sidebar-title">
              <span className="sidebar-title-text">
                <MapPin className="w-5 h-5" />
                Medidores ({filteredMedidores.length})
              </span>
            </h3>

            <div className="sidebar-list">
              {filteredMedidores.map(medidor => {
                const isCurrentUser  = misMedidoresIds.has(medidor.id_medidor);
                const isModoActivo   = modoUbicacion?.id_medidor === medidor.id_medidor;

                return (
                  <div
                    key={medidor.id_medidor}
                    ref={(el) => {
                      if (el) medidorItemRefs.current[medidor.id_medidor] = el;
                      else delete medidorItemRefs.current[medidor.id_medidor];
                    }}
                    className={[
                      'sidebar-item',
                      selectedMedidor?.id_medidor === medidor.id_medidor ? 'selected'     : '',
                      isCurrentUser                                       ? 'current-user' : '',
                      isModoActivo                                        ? 'modo-ubicacion-activo' : '',
                    ].join(' ')}
                    onClick={() => centrarEnMedidor(medidor)}
                  >
                    {/* Cabecera del card */}
                    <div className="sidebar-item-header">
                      <div className="geo-meter-title">
                        <div className={`status-dot ${medidor.activo ? 'active' : 'inactive'}`} />
                        <span className="geo-meter-number">
                          {isCurrentUser && '🏠 '}
                          {medidor.num_medidor}
                        </span>
                      </div>
                      <div className="geo-card-actions">
                        {permissions.canUpdate && (
                          <button
                            type="button"
                            className={`geo-card-icon-btn update ${isModoActivo ? 'active' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              isModoActivo
                                ? cancelarModoUbicacion()
                                : iniciarModoUbicacion(medidor, e);
                            }}
                            title={isModoActivo ? 'Cancelar actualización de ubicación' : 'Actualizar ubicación en el mapa'}
                            aria-label={isModoActivo ? 'Cancelar actualización de ubicación' : 'Actualizar ubicación en el mapa'}
                          >
                            {isModoActivo ? <X size={15} /> : <Move size={15} />}
                          </button>
                        )}

                        {permissions.canUpdate && !medidor.activo && (
                          <button
                            type="button"
                            className="geo-card-icon-btn activate"
                            onClick={(e) => activarMedidor(medidor, e)}
                            disabled={activatingMedidorId === medidor.id_medidor}
                            title="Activar medidor"
                            aria-label="Activar medidor"
                          >
                            {activatingMedidorId === medidor.id_medidor ? (
                              <Loader2 size={15} className="spin" />
                            ) : (
                              <CheckCircle size={15} />
                            )}
                          </button>
                        )}

                        {permissions.canDelete && (
                          <button
                            type="button"
                            className="geo-card-icon-btn delete"
                            onClick={(e) => eliminarMedidor(medidor, e)}
                            disabled={deletingMedidorId === medidor.id_medidor}
                            title="Eliminar medidor"
                            aria-label="Eliminar medidor"
                          >
                            {deletingMedidorId === medidor.id_medidor ? (
                              <Loader2 size={15} className="spin" />
                            ) : (
                              <Trash2 size={15} />
                            )}
                          </button>
                        )}

                        <Navigation2 className="geo-card-nav-icon" />
                      </div>
                    </div>

                    {isCurrentUser && (
                      <p className="text-xs text-purple-600 font-semibold">👤 Tu medidor</p>
                    )}

                    {medidor.nombre_afiliado && (
                      <p className="text-sm text-gray-600">
                        <User className="w-3 h-3 inline mr-1" />
                        {medidor.nombre_afiliado}
                        {medidor.cod_usuario_afi && (
                          <span className="text-xs text-gray-500 ml-1">
                            (Cód: {medidor.cod_usuario_afi})
                          </span>
                        )}
                      </p>
                    )}

                    {medidor.nombre_sector && (
                      <p className="text-xs text-gray-500">{medidor.nombre_sector}</p>
                    )}

                    {medidor.latitud && medidor.longitud && (
                      <div className="text-xs text-gray-400 mt-1">
                        📍 {parseFloat(medidor.latitud).toFixed(6)},{' '}
                        {parseFloat(medidor.longitud).toFixed(6)}
                      </div>
                    )}

                    {/* ── Botón actualizar coordenadas ──────────────────── */}
                    {permissions.canUpdate && (
                      <button
                        className={`geo-card-update-btn ${isModoActivo ? 'active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          isModoActivo
                            ? cancelarModoUbicacion()
                            : iniciarModoUbicacion(medidor, e);
                        }}
                        title={
                          isModoActivo
                            ? 'Cancelar actualización de ubicación'
                            : 'Actualizar ubicación en el mapa'
                        }
                      >
                        {isModoActivo ? (
                          <><X size={12} /> Cancelar</>
                        ) : (
                          <><Move size={12} />Actualizar Ubicación</>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}

              {filteredMedidores.length === 0 && !loading && (
                <div className="geo-sidebar-empty-state">
                  <MapPin className="w-10 h-10 text-gray-400" />
                  <h4>No se encontraron medidores</h4>
                  <p>No hay medidores con geolocalizacion que coincidan con los filtros.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── MAPA ────────────────────────────────────────────────────── */}
        <div
          ref={mapSectionRef}
          className="geo-map-container"
          style={{
            position: 'relative',
            cursor: (modoUbicacion || modoCrearMedidor) ? 'crosshair' : 'default',
          }}
        >
          <button
            type="button"
            className="geo-map-sidebar-toggle"
            onClick={() => setShowSidebar(prev => !prev)}
            title={showSidebar ? 'Ocultar lista' : 'Mostrar lista'}
          >
            <Layers className="w-4 h-4" />
          </button>

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
              onClick={handleMapClick}
              
            >
              {selectedLimite?.position && (
                <InfoWindow
                  position={selectedLimite.position}
                  onCloseClick={() => setSelectedLimite(null)}
                >
                  <div className="marker-popup" style={{ minWidth: 240 }}>
                    <h4 style={{ margin: '0 0 8px', fontWeight: 700, color: '#1d4ed8' }}>
                      🗺️ {selectedLimite.nombre}
                    </h4>

                    <p style={{ margin: '4px 0' }}>
                      <strong>Norte:</strong> {parseFloat(selectedLimite.norte).toFixed(7)}
                    </p>
                    <p style={{ margin: '4px 0' }}>
                      <strong>Sur:</strong> {parseFloat(selectedLimite.sur).toFixed(7)}
                    </p>
                    <p style={{ margin: '4px 0' }}>
                      <strong>Este:</strong> {parseFloat(selectedLimite.este).toFixed(7)}
                    </p>
                    <p style={{ margin: '4px 0' }}>
                      <strong>Oeste:</strong> {parseFloat(selectedLimite.oeste).toFixed(7)}
                    </p>

                    {selectedLimite.altitud_min != null && selectedLimite.altitud_max != null && (
                      <p style={{ margin: '6px 0', color: '#6b7280' }}>
                        <strong>Altitud:</strong> {selectedLimite.altitud_min} m - {selectedLimite.altitud_max} m
                      </p>
                    )}

                    <p style={{ margin: '6px 0 0', fontSize: 12, color: '#6b7280' }}>
                      {selectedLimite.poligono_geojson ? 'Límite por polígono GeoJSON' : 'Límite rectangular'}
                    </p>
                  </div>
                </InfoWindow>
              )}
              {
                modoCrearMedidor && coordNuevoMedidor && (
                  <AdvancedMarker
                    map={mapInstance}
                    position={coordNuevoMedidor}
                    icon={{
                      url: svgToDataUrl(buildPreviewPinSvg()),
                      scaledSize: { width: 36, height: 36 },
                    }}
                    zIndex={1000}
                    title="Nuevo medidor — punto seleccionado"
                  />
                )
              }

              {showLimites && limitesGeo.map((limite) => {
                const hasPolygon =
                  limite.poligono_geojson &&
                  (
                    limite.poligono_geojson.type === 'Polygon' ||
                    limite.poligono_geojson.type === 'MultiPolygon'
                  );

                if (hasPolygon) {
                  return (
                    <Polygon
                      key={`limite-poly-${limite.id}`}
                      paths={geoJsonToPaths(limite.poligono_geojson)}
                      options={selectedLimite?.id === limite.id ? limiteStyleHover : limiteStyle}
                      onClick={(e) => {
                        setSelectedLimite({
                          ...limite,
                          position: {
                            lat: e.latLng.lat(),
                            lng: e.latLng.lng(),
                          },
                        });
                      }}
                    />
                  );
                }

                return (
                  <Rectangle
                    key={`limite-rect-${limite.id}`}
                    bounds={getRectangleBounds(limite)}
                    options={selectedLimite?.id === limite.id ? limiteStyleHover : limiteStyle}
                    onClick={() => {
                      setSelectedLimite({
                        ...limite,
                        position: getRectangleCenter(limite),
                      });
                    }}
                  />
                );
              })}

              {/* ── Markers de medidores ─────────────────────────── */}
              {filteredMedidores.map((medidor) => {
                if (!medidor.latitud || !medidor.longitud) return null;
                const isCurrentUser    = misMedidoresIds.has(medidor.id_medidor);
                const { color, size }  = getMedidorStyle(medidor, isCurrentUser);
                return (
                  <AdvancedMarker
                    key={medidor.id_medidor}
                    map={mapInstance}
                    position={{
                      lat: parseFloat(medidor.latitud),
                      lng: parseFloat(medidor.longitud),
                    }}
                    icon={{
                      url: svgToDataUrl(buildPinSvg(color, size, isCurrentUser)),
                      scaledSize: { width: size, height: size },
                    }}
                    onClick={() => {
                      if (modoUbicacion) return; // no abrir InfoWindow en modo ubicación
                      setSelectedMedidor(medidor);
                    }}
                    zIndex={isCurrentUser ? 100 : 1}
                    title={medidor.num_medidor}
                  />
                );
              })}

              {/* ── Marker de ubicación del dispositivo ─────────── */}
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

              {/* ── Marker de preview al seleccionar nuevo punto ─── */}
              {modoUbicacion && coordPreview && (
                <AdvancedMarker
                  map={mapInstance}
                  position={coordPreview}
                  icon={{
                    url: svgToDataUrl(buildPreviewPinSvg()),
                    scaledSize: { width: 36, height: 36 },
                  }}
                  zIndex={1000}
                  title="Nueva ubicación seleccionada"
                />
              )}

              {/* ── InfoWindow ──────────────────────────────────── */}
              {selectedMedidor && selectedMedidor.latitud && selectedMedidor.longitud && (
                <InfoWindow
                  position={{
                    lat: parseFloat(selectedMedidor.latitud),
                    lng: parseFloat(selectedMedidor.longitud),
                  }}
                  onCloseClick={() => setSelectedMedidor(null)}
                >
                  <div
                    className="marker-popup"
                    style={{ minWidth: 200, cursor: 'pointer' }}
                    onClick={() => ubicarMedidorEnLista(selectedMedidor)}
                    title="Ubicar en la lista de medidores"
                  >
                    <h4 style={{ margin: '0 0 6px', fontWeight: 700 }}>
                      {misMedidoresIds.has(selectedMedidor.id_medidor) ? '🏠' : '📍'}{' '}
                      {selectedMedidor.num_medidor}
                    </h4>
                    {misMedidoresIds.has(selectedMedidor.id_medidor) && (
                      <p style={{ color: '#7c3aed', fontWeight: 600, margin: '0 0 4px' }}>
                        👤 Tu medidor
                      </p>
                    )}
                    {selectedMedidor.nombre_afiliado ? (
                      <>
                        <p style={{ margin: '2px 0' }}>
                          <strong>Usuario:</strong> {selectedMedidor.nombre_afiliado}
                        </p>
                        {selectedMedidor.cod_usuario_afi && (
                          <p style={{ margin: '2px 0' }}>
                            <strong>Código:</strong> {selectedMedidor.cod_usuario_afi}
                          </p>
                        )}
                      </>
                    ) : (
                      <p style={{ margin: '2px 0', fontStyle: 'italic', color: '#6b7280' }}>
                        Sin usuario asignado
                      </p>
                    )}
                    {selectedMedidor.nombre_sector && (
                      <p style={{ margin: '2px 0' }}>
                        <strong>Sector:</strong> {selectedMedidor.nombre_sector}
                      </p>
                    )}
                    <p style={{ margin: '4px 0 2px' }}>
                      <strong>Estado:</strong>{' '}
                      <span style={{
                        color:      selectedMedidor.activo ? '#10b981' : '#ef4444',
                        fontWeight: 600,
                      }}>
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

          {/* ── Banner "modo ubicación activo" ──────────────────── */}
          {modoUbicacion && (
            <div className="geo-modo-ubicacion-banner">
              <span className="geo-modo-ubicacion-icon">
                <Crosshair size={15} />
              </span>
              <span>
                Clic en el mapa para ubicar el medidor{' '}
                <strong>{modoUbicacion.num_medidor}</strong>
              </span>
              <button
                className="geo-modo-cancel-btn"
                onClick={cancelarModoUbicacion}
              >
                <X size={13} /> Cancelar
              </button>
            </div>
          )}
{
  modoCrearMedidor && (
  <div className="geo-modo-ubicacion-banner" style={{ background: '#065f46' }}>
    <span className="geo-modo-ubicacion-icon">
      <Plus size={15} />
    </span>
    <span>Haz clic en el mapa para colocar el <strong>nuevo medidor</strong></span>
    <button className="geo-modo-cancel-btn" onClick={cancelarModoCrearMedidor}>
      <X size={13} /> Cancelar
    </button>
  </div>
)
}
          {/* ── Toast de resultado ───────────────────────────────── */}
          {toastGeo && (
            <div className={`geo-toast ${toastGeo.tipo}`}>
              {toastGeo.tipo === 'exito' ? '✅' : '❌'} {toastGeo.msg}
            </div>
          )}

          {/* ── Leyenda desplegable ──────────────────────────────── */}
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

      {false && filteredMedidores.length === 0 && !loading && (
        <div className="empty-state">
          <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3>No se encontraron medidores</h3>
          <p>No hay medidores con geolocalización que coincidan con los filtros.</p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          DIALOG — CONFIRMAR ACTUALIZACIÓN DE COORDENADAS
          Aparece fuera del contenedor del mapa para no quedar cortado
      ══════════════════════════════════════════════════════════════════ */}
      {confirmDialog && coordPreview && modoUbicacion && (
        <div className="geo-confirm-overlay" onClick={cancelarModoUbicacion}>
          <div
            className="geo-confirm-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera */}
            <div className="geo-confirm-header">
              <div className="geo-confirm-icon">
                <LocateFixed size={22} />
              </div>
              <div>
                <h3>¿Actualizar ubicación?</h3>
                <p>
                  Medidor <strong>{modoUbicacion.num_medidor}</strong>
                  {modoUbicacion.nombre_afiliado && (
                    <> · {modoUbicacion.nombre_afiliado}</>
                  )}
                </p>
              </div>
            </div>

            {/* Coordenadas nuevas */}
            <div className="geo-confirm-coords">
              <div className="geo-confirm-coord-row">
                <span className="geo-confirm-label">Latitud</span>
                <span className="geo-confirm-value">
                  {coordPreview.lat.toFixed(7)}
                </span>
              </div>
              <div className="geo-confirm-coord-row">
                <span className="geo-confirm-label">Longitud</span>
                <span className="geo-confirm-value">
                  {coordPreview.lng.toFixed(7)}
                </span>
              </div>
            </div>

            {/* Botones */}
            <div className="geo-confirm-actions">
              <button
                className="geo-confirm-btn-cancel"
                onClick={cancelarModoUbicacion}
                disabled={savingCoords}
              >
                <X size={14} /> Cancelar
              </button>
              <button
                className="geo-confirm-btn-ok"
                onClick={confirmarActualizacion}
                disabled={savingCoords}
              >
                {savingCoords ? (
                  <><Loader2 size={14} className="spin" /> Guardando…</>
                ) : (
                  <><Check size={14} /> Confirmar</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAssignCoordsModal && (
        <div className="geo-confirm-overlay" onClick={cerrarModalAsignarCoordenadas}>
          <div
            className="geo-confirm-dialog geo-create-dialog geo-assign-dialog"
            style={{ maxWidth: 560, width: '95%' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="geo-confirm-header">
              <div className="geo-confirm-icon" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
                <Crosshair size={22} />
              </div>
              <div>
                <h3>Asignar Coordenadas</h3>
                <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
                  Selecciona un afiliado con medidor y luego marca su punto en el mapa.
                </p>
              </div>
              <button
                style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={cerrarModalAsignarCoordenadas}
              >
                <X size={18} />
              </button>
            </div>

            <div className="geo-create-form">
              {assignCoordsError && (
                <div className="alert alert-error" style={{ margin: 0 }}>
                  <AlertCircle className="w-4 h-4 mr-2" />
                  {assignCoordsError}
                </div>
              )}

              <div className="geo-affiliate-search-container">
                <div className="geo-affiliate-search-input-wrapper">
                  <Search className="geo-affiliate-search-icon" />
                  <input
                    type="text"
                    placeholder="Buscar por codigo, afiliado, cedula, medidor o sector..."
                    value={assignSearchTerm}
                    onChange={e => setAssignSearchTerm(e.target.value)}
                    className="geo-affiliate-search-input"
                  />
                  {assignSearchTerm && (
                    <button type="button" onClick={() => setAssignSearchTerm('')} className="geo-affiliate-search-clear">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="geo-affiliates-modal-list geo-assign-list">
                {loadingAssignableMeters ? (
                  <div className="geo-affiliate-empty-state">
                    <Loader2 className="w-8 h-8 spin" />
                    <p>Cargando medidores asignados...</p>
                  </div>
                ) : (
                  <>
                    {filteredAssignableMeters.map(meter => {
                      const nombre = meter.nombre_afiliado || 'Sin nombre';
                      const hasCoords = meterHasCoordinates(meter);

                      return (
                        <button
                          type="button"
                          key={meter.id_medidor}
                          className="geo-affiliate-modal-item geo-assign-item"
                          onClick={() => seleccionarMedidorParaCoordenadas(meter)}
                        >
                          <div className="geo-avatar-circle">{getInitials(nombre)}</div>
                          <div className="geo-affiliate-info">
                            <p className="geo-affiliate-name">{nombre}</p>
                            <p className="geo-affiliate-meta">
                              {meter.cod_usuario_afi || 'Sin codigo'} · {meter.cedula || 'Sin cedula'} · Medidor {meter.num_medidor || 'S/N'}
                            </p>
                            <p className="geo-affiliate-meta">
                              {meter.nombre_sector || 'Sin sector'}
                            </p>
                          </div>
                          <span className={`geo-coordinate-status ${hasCoords ? 'has-coords' : 'no-coords'}`}>
                            {hasCoords ? 'Actualizar' : 'Asignar'}
                          </span>
                        </button>
                      );
                    })}

                    {filteredAssignableMeters.length === 0 && (
                      <div className="geo-affiliate-empty-state">
                        <User className="w-8 h-8" />
                        <p>No se encontraron afiliados con medidor.</p>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="geo-confirm-actions geo-create-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={cerrarModalAsignarCoordenadas}
                >
                  <X className="w-4 h-4 mr-2" /> Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

  {showCreateModal && coordNuevoMedidor && (
  <div className="geo-confirm-overlay" onClick={cancelarModoCrearMedidor}>
    <div
      className="geo-confirm-dialog geo-create-dialog geo-new-meter-dialog"
      style={{ maxWidth: 480, width: '95%' }}
      onClick={e => e.stopPropagation()}
    >
      {/* Cabecera */}
      <div className="geo-confirm-header">
        <div className="geo-confirm-icon" style={{ background: '#d1fae5', color: '#065f46' }}>
          <Plus size={22} />
        </div>
        <div>
          <h3>Nuevo Medidor</h3>
          <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
            📍 {coordNuevoMedidor.lat.toFixed(6)}, {coordNuevoMedidor.lng.toFixed(6)}
          </p>
        </div>
        <button
          style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}
          onClick={cancelarModoCrearMedidor}
        >
          <X size={18} />
        </button>
      </div>

      {createError && (
        <div className="alert alert-error" style={{ margin: '8px 0' }}>
          <AlertCircle className="w-4 h-4 mr-2" />
          {createError}
        </div>
      )}

      <form onSubmit={handleCreateMedidor} className="geo-create-form geo-new-meter-form">
        <div className="geo-new-meter-scroll">

        {/* Número de medidor */}
        <div className="form-group" style={{ margin: 0 }}>
          <label>Número de Medidor <span style={{ color: '#ef4444' }}>*</span></label>
          <input
            type="text"
            required
            placeholder="Ej: MED-001"
            value={createForm.num_medidor}
            onChange={e => setCreateForm(f => ({ ...f, num_medidor: e.target.value }))}
          />
        </div>

        {/* Sector */}
        <div className="form-group" style={{ margin: 0 }}>
          <label>Sector</label>
          <select
  className="filter-select"
  value={createForm.id_sector ?? ''}
  onChange={e => setCreateForm(f => ({
    ...f,
    id_sector: e.target.value !== '' ? parseInt(e.target.value) : null,
  }))}
>
  <option value="">— Sin sector —</option>
  {sectores.map(s => (                              // ← sin .filter(s => s.activo)
    <option key={s.id_sector} value={s.id_sector}>{s.nombre_sector}</option>
  ))}
</select>
        </div>

        {/* Altitud */}
        <div className="form-group" style={{ margin: 0 }}>
          <label>Altitud (m) <small style={{ color: '#9ca3af' }}>opcional</small></label>
          <input
            type="number"
            step="0.01"
            placeholder="Ej: 2850"
            value={createForm.altitud}
            onChange={e => setCreateForm(f => ({ ...f, altitud: e.target.value }))}
          />
        </div>

        {/* Asignar afiliado */}
        <div className="form-group" style={{ margin: 0, order: -5 }}>
          <label>Asignar a Afiliado <small style={{ color: '#9ca3af' }}>opcional</small></label>

          {/* Buscador */}
          <div className="geo-affiliate-search-container">
            <div className="geo-affiliate-search-input-wrapper">
              <Search className="geo-affiliate-search-icon" />
              <input
                type="text"
                placeholder="Buscar por nombre, código o cédula..."
                value={affiliateSearchTerm}
                onChange={e => setAffiliateSearchTerm(e.target.value)}
                className="geo-affiliate-search-input"
              />
              {affiliateSearchTerm && (
                <button type="button" onClick={() => setAffiliateSearchTerm('')} className="geo-affiliate-search-clear">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="geo-affiliates-modal-list">
            {!affiliateSearchQuery && (
              <button
                type="button"
                className={`geo-affiliate-modal-item ${!createForm.id_usuario_afi ? 'selected' : ''}`}
                onClick={clearSelectedAffiliate}
              >
                <div className="geo-avatar-circle">SA</div>
                <div className="geo-affiliate-info">
                  <p className="geo-affiliate-name">Sin asignar</p>
                  <p className="geo-affiliate-meta">Crear medidor sin afiliado asociado</p>
                </div>
                {!createForm.id_usuario_afi && <CheckCircle className="w-4 h-4 text-blue-600" />}
              </button>
            )}

            {filteredAffiliates.length > 0 ? (
              filteredAffiliates.map(a => {
                const isSelected = createForm.id_usuario_afi === a.id_usuario_afi;
                const nombre = a.nombre_afiliado || 'Sin nombre';
                const codigoAfiliado = getAffiliateCode(a);
                const iniciales = nombre
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map(parte => parte[0])
                  .join('');

                return (
                  <button
                    type="button"
                    key={a.id_usuario_afi}
                    className={`geo-affiliate-modal-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelectAffiliate(a)}
                    title={isSelected ? 'Quitar selección' : 'Seleccionar afiliado'}
                  >
                    <div className="geo-avatar-circle">{iniciales}</div>
                    <div className="geo-affiliate-info">
                      <p className="geo-affiliate-name">{nombre}</p>
                      <p className="geo-affiliate-meta">
                        {codigoAfiliado} · {a.cedula || 'Sin cédula'} · {a.nombre_sector || 'Sin sector'}
                      </p>
                    </div>
                    {isSelected && <CheckCircle className="w-4 h-4 text-blue-600" />}
                  </button>
                );
              })
            ) : (
              <div className="geo-affiliate-empty-state">
                <User className="w-8 h-8" />
                <p>
                  {affiliateSearchQuery
                    ? `No se encontraron afiliados con "${affiliateSearchTerm}"`
                    : 'No hay afiliados disponibles para asignar'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Tarjeta info afiliado seleccionado */}
        {selectedAffiliateInfo && (
          <div className="meter-info-card" style={{ order: -4 }}>
            <div className="meter-info-title-row">
              <h4 className="meter-info-title">
                <User className="w-4 h-4 mr-2" />
                Información del Afiliado
              </h4>
              <button
                type="button"
                className="geo-affiliate-remove-btn"
                onClick={clearSelectedAffiliate}
                title="Quitar afiliado seleccionado"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="meter-info-content">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 13 }}>
                <p><strong>Código:</strong> {getAffiliateCode(selectedAffiliateInfo) || '—'}</p>
                <p><strong>Nombre:</strong> {selectedAffiliateInfo.nombre_afiliado || '—'}</p>
                <p><strong>Cédula:</strong> {selectedAffiliateInfo.cedula || '—'}</p>
                <p><strong>Sector:</strong> {selectedAffiliateInfo.nombre_sector || '—'}</p>
                <p>
                  <strong>Estado:</strong>{' '}
                  <span style={{ color: selectedAffiliateInfo.activo ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                    {selectedAffiliateInfo.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </p>
                <p>
                  <strong>Medidores:</strong> {selectedAffiliateInfo.total_medidores}{' '}
                  <span style={{ color: '#6b7280', fontSize: 11 }}>
                    ({selectedAffiliateInfo.medidores_activos} activo{selectedAffiliateInfo.medidores_activos !== 1 ? 's' : ''})
                  </span>
                </p>
              </div>
            </div>
          </div>
        )}
        </div>

        {/* Botones */}
        <div className="geo-confirm-actions geo-create-actions geo-new-meter-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={cancelarModoCrearMedidor}
            disabled={createSaving}
          >
            <X className="w-4 h-4 mr-2" /> Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={createSaving}>
            {createSaving ? (
              <><Loader2 size={14} className="spin" /> Guardando…</>
            ) : (
              <><Save size={14} className="mr-1" /> Crear Medidor</>
            )}
          </button>
        </div>
      </form>
    </div>
  </div>
)}

    </div>


  );
};

export default GeolocationSection;
