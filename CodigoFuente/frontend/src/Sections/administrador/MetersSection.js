// src/sections/MetersSection.js
// MÓDULO DE MEDIDORES - Con cambio de medidor como acción independiente

import React, { useState, useEffect, useCallback } from 'react';
import metersService from '../../services/metersServices';
import authService from '../../services/authServices';
import './MetersSection.css';
import { 
  Gauge, Search, CheckCircle, XCircle, MapPin, X, Save, RefreshCw, 
  AlertCircle, Map, Navigation, Mountain, UserCheck, IdCard, UserX, 
  User, Eye, Edit, Trash2, ArrowRightLeft 
} from 'lucide-react';

const MetersSection = () => {
  // ============================================================================
  // ESTADOS PRINCIPALES
  // ============================================================================
  const [meters, setMeters] = useState([]);
  const [availableAffiliates, setAvailableAffiliates] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [filterSector, setFilterSector] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterAssignment, setFilterAssignment] = useState('all');
  
  // Estados para modal principal (crear/editar/ver)
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('create');
  const [selectedMeter, setSelectedMeter] = useState(null);
  const [error, setError] = useState(null);

  // 🆕 Estados para modal de CAMBIO DE MEDIDOR
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedMeterForTransfer, setSelectedMeterForTransfer] = useState(null);
  const [availableServices, setAvailableServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [transferFormData, setTransferFormData] = useState({
    nuevoAfiliadoId: null,
    servicioId: null,
    nombreServicio: 'Cambio de Medidor',
    montoServicio: 0,
    observaciones: ''
  });

  const [formData, setFormData] = useState({
    num_medidor: '',
    latitud: '',
    longitud: '',
    altitud: '',
    id_usuario_afi: null,
    id_sector: null,
    activo: true
  });

  // PERMISOS DEL USUARIO ACTUAL
  const [permissions, setPermissions] = useState({
    canCreate: false,
    canRead: false,
    canUpdate: false,
    canDelete: false,
    canToggleStatus: false
  });

  // ============================================================================
  // EFECTOS Y CARGA INICIAL
  // ============================================================================
  useEffect(() => {
    loadUserPermissions();
    loadSectors();
  }, []);

  const loadUserPermissions = () => {
    const canCreate = authService.hasPermission('medidores', 'crear') || 
                     authService.hasPermission('medidores', 'crud');
    const canUpdate = authService.hasPermission('medidores', 'actualizar') || 
                     authService.hasPermission('medidores', 'crud');
    const canDelete = authService.hasPermission('medidores', 'eliminar') || 
                     authService.hasPermission('medidores', 'crud');
    const canRead = authService.hasPermission('medidores', 'lectura') || 
                   canCreate || canUpdate || canDelete || 
                   authService.hasPermission('medidores', 'crud');
    const canToggleStatus = canUpdate;

    setPermissions({ canCreate, canRead, canUpdate, canDelete, canToggleStatus });
  };

  const loadSectors = async () => {
    try {
      const result = await metersService.getSectoresDisponibles();
      if (result.success) {
        setSectors(result.data);
      }
    } catch (error) {
      console.error('Error al cargar sectores:', error);
    }
  };

  const fetchMeters = useCallback(async () => {
    if (!permissions.canRead) {
      setError('No tienes permiso para ver medidores');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const result = await metersService.getMeters({
        id_sector: filterSector === 'all' ? undefined : filterSector,
        activo: filterStatus === 'all' ? undefined : (filterStatus === 'active'),
        asignado: filterAssignment === 'all' ? undefined : (filterAssignment === 'assigned')
      });

      if (result.success) {
        setMeters(result.data);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Error al cargar medidores desde el servidor');
      console.error('Error en fetchMeters:', err);
    } finally {
      setLoading(false);
    }
  }, [filterSector, filterStatus, filterAssignment, permissions.canRead]);

  const fetchAvailableAffiliates = async (search) => {
    try {
      const result = await metersService.getAvailableAffiliates(search);
      if (result.success) {
        setAvailableAffiliates(result.data);
      }
    } catch (error) {
      console.error('Error al cargar afiliados disponibles:', error);
    }
  };

  useEffect(() => {
    if (permissions.canRead) {
      fetchMeters();
    }
  }, [fetchMeters, permissions.canRead]);

  // ============================================================================
  // FILTRADO Y ORDENAMIENTO
  // ============================================================================
  const filteredMeters = meters.filter(meter => {
    const matchesSearch = (
      meter.num_medidor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (meter.cod_usuario_afi && meter.cod_usuario_afi.toString().includes(searchTerm)) ||
      (meter.nombre_afiliado && meter.nombre_afiliado.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    
    const matchesSector = filterSector === 'all' || meter.id_sector === parseInt(filterSector);
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'active' ? meter.activo : !meter.activo);
    const matchesAssignment = filterAssignment === 'all' || 
                             (filterAssignment === 'assigned' ? meter.id_usuario_afi : !meter.id_usuario_afi);
    
    return matchesSearch && matchesSector && matchesStatus && matchesAssignment;
  });

  const sortedMeters = [...filteredMeters].sort((a, b) => {
    const isAssignedA = a.id_usuario_afi !== null;
    const isAssignedB = b.id_usuario_afi !== null;
    
    const priorityA = (a.activo && isAssignedA) ? 1 : 0;
    const priorityB = (b.activo && isAssignedB) ? 1 : 0;
    
    if (priorityA !== priorityB) return priorityB - priorityA;
    if (isAssignedA && isAssignedB) {
      const codA = a.cod_usuario_afi || 0;
      const codB = b.cod_usuario_afi || 0;
      return codA - codB;
    }
    if (isAssignedA && !isAssignedB) return -1;
    if (!isAssignedA && isAssignedB) return 1;
    
    return a.num_medidor.localeCompare(b.num_medidor);
  });

  // ============================================================================
  // MODALES - CREAR/EDITAR/VER
  // ============================================================================
  const openModal = async (type, meter = null) => {
    if (type === 'create' && !permissions.canCreate) {
      alert('No tienes permiso para crear medidores');
      return;
    }
    if (type === 'edit' && !permissions.canUpdate) {
      alert('No tienes permiso para editar medidores');
      return;
    }

    setModalType(type);
    setSelectedMeter(meter);
    setError(null);

    // Cargar afiliados disponibles
    await fetchAvailableAffiliates();

    if (type === 'create') {
      setFormData({
        num_medidor: '',
        latitud: '',
        longitud: '',
        altitud: '',
        id_usuario_afi: null,
        id_sector: sectors.length > 0 ? sectors[0].id_sector : null,
        activo: true
      });
    } else if (type === 'edit' && meter) {
      setFormData({
        num_medidor: meter.num_medidor,
        latitud: meter.latitud || '',
        longitud: meter.longitud || '',
        altitud: meter.altitud || '',
        id_usuario_afi: meter.id_usuario_afi || null,
        id_sector: meter.id_sector,
        activo: meter.activo
      });
    }

    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedMeter(null);
    setError(null);
    setAvailableAffiliates([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      let result;

      if (modalType === 'create') {
        if (!permissions.canCreate) {
          setError('No tienes permiso para crear medidores');
          return;
        }

        if (!formData.num_medidor.trim()) {
          setError('Debe ingresar un número de medidor');
          return;
        }

        const dataToSend = {
          num_medidor: formData.num_medidor.trim(),
          latitud: formData.latitud ? parseFloat(formData.latitud) : null,
          longitud: formData.longitud ? parseFloat(formData.longitud) : null,
          altitud: formData.altitud ? parseFloat(formData.altitud) : null,
          id_usuario_afi: formData.id_usuario_afi || null,
          id_sector: formData.id_sector || null,
          activo: formData.activo
        };

        result = await metersService.createMeter(dataToSend);

        if (result.success) {
          alert(`Medidor creado exitosamente. ${result.data.id_medidor}`);
          await fetchMeters();
          closeModal();
        } else {
          setError(result.message);
        }

      } else if (modalType === 'edit') {
        if (!permissions.canUpdate) {
          setError('No tienes permiso para editar medidores');
          return;
        }

        const dataToSend = {
          num_medidor: formData.num_medidor.trim(),
          latitud: formData.latitud ? parseFloat(formData.latitud) : null,
          longitud: formData.longitud ? parseFloat(formData.longitud) : null,
          altitud: formData.altitud ? parseFloat(formData.altitud) : null,
          id_sector: formData.id_sector || null,
          activo: formData.activo
        };

        result = await metersService.updateMeter(selectedMeter.id_medidor, dataToSend);

        if (result.success) {
          alert('Cambios guardados correctamente');
          await fetchMeters();
          closeModal();
        } else {
          setError(result.message);
        }
      }

    } catch (error) {
      console.error('Error al guardar medidor:', error);
      setError(error.message || 'Error al guardar medidor');
    }
  };

  // ============================================================================
  // 🆕 MODAL DE CAMBIO DE MEDIDOR
  // ============================================================================
  const openTransferModal = async (meter) => {
    if (!permissions.canUpdate) {
      alert('No tienes permiso para cambiar medidores');
      return;
    }

    // Cerrar cualquier otro modal
    setShowModal(false);
    setSelectedMeter(null);

    setSelectedMeterForTransfer(meter);
    setLoadingServices(true);
    setShowTransferModal(true);

    // Cargar afiliados disponibles
    await fetchAvailableAffiliates();

    // Cargar servicios activos y vigentes
    try {
      const result = await metersService.getActiveServices();
      if (result.success && result.data.length > 0) {
        setAvailableServices(result.data);
        
        // Buscar servicio de cambio de medidor
        const cambioService = result.data.find(s => 
          s.nombre.toLowerCase().includes('cambio') || 
          s.nombre.toLowerCase().includes('traspaso')
        );

        if (cambioService) {
          setTransferFormData({
            nuevoAfiliadoId: null,
            servicioId: cambioService.id_servicio,
            nombreServicio: cambioService.nombre,
            montoServicio: parseFloat(cambioService.precio_base || 0),
            observaciones: ''
          });
        } else {
          const firstService = result.data[0];
          setTransferFormData({
            nuevoAfiliadoId: null,
            servicioId: firstService.id_servicio,
            nombreServicio: firstService.nombre,
            montoServicio: parseFloat(firstService.precio_base || 0),
            observaciones: ''
          });
        }
      } else {
        setTransferFormData({
          nuevoAfiliadoId: null,
          servicioId: null,
          nombreServicio: 'Cambio de Medidor',
          montoServicio: 0,
          observaciones: ''
        });
      }
    } catch (error) {
      console.error('Error cargando servicios:', error);
      setTransferFormData({
        nuevoAfiliadoId: null,
        servicioId: null,
        nombreServicio: 'Cambio de Medidor',
        montoServicio: 0,
        observaciones: ''
      });
    } finally {
      setLoadingServices(false);
    }
  };

  const closeTransferModal = () => {
    setShowTransferModal(false);
    setSelectedMeterForTransfer(null);
    setAvailableServices([]);
    setAvailableAffiliates([]);
    setTransferFormData({
      nuevoAfiliadoId: null,
      servicioId: null,
      nombreServicio: 'Cambio de Medidor',
      montoServicio: 0,
      observaciones: ''
    });
  };

  const handleTransferSubmit = async () => {
    if (!transferFormData.nuevoAfiliadoId) {
      alert('Debe seleccionar un nuevo afiliado');
      return;
    }

    if (transferFormData.montoServicio <= 0) {
      alert('El monto del servicio debe ser mayor a 0');
      return;
    }

    try {
      // 🆕 Enviar datos completos del cambio
      const dataToSend = {
        id_usuario_afi: transferFormData.nuevoAfiliadoId,
        costo_cambio: transferFormData.montoServicio,
        motivo_cambio: transferFormData.nombreServicio,
        observaciones_cambio: transferFormData.observaciones || 
          `Cambio de medidor realizado. Servicio aplicado: ${transferFormData.nombreServicio}`
      };

      const result = await metersService.updateMeter(
        selectedMeterForTransfer.id_medidor, 
        dataToSend
      );

      if (result.success) {
        alert(
          `Cambio de medidor realizado exitosamente.\n\n` +
          `Medidor: ${selectedMeterForTransfer.num_medidor}\n` +
          `Servicio: ${transferFormData.nombreServicio}\n` +
          `Monto: $${transferFormData.montoServicio.toFixed(2)}\n\n` +
          `El cargo se registró en el historial del medidor.`
        );
        
        await fetchMeters();
        closeTransferModal();
      } else {
        alert('Error: ' + result.message);
      }
    } catch (error) {
      console.error('Error al realizar cambio de medidor:', error);
      alert('Error al realizar el cambio de medidor');
    }
  };


  // ============================================================================
  // OTRAS ACCIONES
  // ============================================================================
  const handleDelete = async (meterId) => {
    if (!permissions.canDelete) {
      alert('No tienes permiso para eliminar medidores');
      return;
    }

    const confirmed = window.confirm('¿Estás seguro de que deseas eliminar este medidor?');
    if (!confirmed) return;

    try {
      const result = await metersService.deleteMeter(meterId);
      if (result.success) {
        alert('Medidor Eliminado: ' + result.message);
        await fetchMeters();
      } else {
        alert('Error: ' + result.message);
      }
    } catch (error) {
      alert('Error inesperado al eliminar medidor: ' + error.message);
    }
  };

  const toggleMeterStatus = async (meterId) => {
    if (!permissions.canToggleStatus) {
      alert('No tienes permiso para cambiar el estado de medidores');
      return;
    }

    try {
      const result = await metersService.toggleMeterStatus(meterId);
      if (result.success) {
        await fetchMeters();
      } else {
        alert('Error: ' + result.message);
      }
    } catch (error) {
      alert('Error al cambiar estado del medidor');
    }
  };

  // ============================================================================
  // RENDER - VALIDACIONES INICIALES
  // ============================================================================
  if (!permissions.canRead) {
    return (
      <div className="section-placeholder">
        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
        <h2>Acceso Denegado</h2>
        <p>No tienes permiso para acceder al módulo de medidores.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="section-placeholder">
        <RefreshCw className="w-16 h-16 mx-auto mb-4 text-gray-400 animate-spin" />
        <h2>Cargando Medidores</h2>
        <p>Por favor espera mientras cargamos la información...</p>
      </div>
    );
  }

  if (error && meters.length === 0) {
    return (
      <div className="section-placeholder">
        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
        <h2>Error al Cargar Medidores</h2>
        <p>{error}</p>
        <button onClick={fetchMeters} className="btn-primary mt-4">
          <RefreshCw className="w-4 h-4 mr-2" />
          Reintentar
        </button>
      </div>
    );
  }

  // ============================================================================
  // RENDER PRINCIPAL
  // ============================================================================
  return (
    <div className="meters-section">
      {/* HEADER */}
      <div className="section-header">
        <div className="section-title">
          <Gauge className="w-7 h-7 text-blue-600" />
          <div>
            <h2>Gestión de Medidores</h2>
            <p className="section-subtitle">Gestiona la información de los medidores y su ubicación</p>
          </div>
        </div>

        {permissions.canCreate && (
          <button className="btn-primary" onClick={() => openModal('create')}>
            <Gauge className="w-4 h-4 mr-2" />
            Nuevo Medidor
          </button>
        )}
      </div>

      {/* ESTADÍSTICAS */}
      <div className="periodo-stats-container">
        <div className="periodo-stats-header">
          <Gauge className="w-5 h-5 text-blue-600 mr-2" />
          <h3>Resumen de Medidores</h3>
        </div>
        
        <div className="users-stats">
          <div className="stat-item">
            <Gauge className="stat-icon text-blue-600" />
            <div>
              <p className="stat-label">Total Medidores</p>
              <p className="stat-value">{meters.length}</p>
            </div>
          </div>

          <div className="stat-item active green">
            <CheckCircle className="stat-icon text-green-600" />
            <div>
              <p className="stat-label">Medidores Activos</p>
              <p className="stat-value">{meters.filter(m => m.activo).length}</p>
            </div>
          </div>

          <div className="stat-item active purple">
            <UserCheck className="stat-icon text-purple-600" />
            <div>
              <p className="stat-label">Medidores Asignados</p>
              <p className="stat-value">{meters.filter(m => m.id_usuario_afi).length}</p>
            </div>
          </div>

          <div className="stat-item active orange">
            <Map className="stat-icon text-orange-600" />
            <div>
              <p className="stat-label">Sectores con Medidores</p>
              <p className="stat-value">
                {new Set(meters.filter(m => m.activo && m.id_sector).map(m => m.id_sector)).size}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* FILTROS */}
      <div className="filters-section">
        <div className="search-container">
          <Search className="search-icon" />
          <input
            type="text"
            placeholder="Buscar por número de medidor o código de afiliado..."
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
            {sectors.map(sector => (
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
            value={filterAssignment}
            onChange={(e) => setFilterAssignment(e.target.value)}
          >
            <option value="all">Todas las asignaciones</option>
            <option value="assigned">Asignados</option>
            <option value="unassigned">Sin asignar</option>
          </select>

          <button className="btn-secondary" onClick={fetchMeters} title="Recargar lista">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* GRID DE MEDIDORES */}
      <div className="users-grid">
        {sortedMeters.map(meter => {
          const isAssigned = meter.id_usuario_afi !== null;
          
          return (
            <div 
              key={meter.id_medidor} 
              className={`user-card ${!meter.activo ? 'inactive' : ''}`}
            >
              <div className="user-card-header">
                <div className="user-info">
                  <div className="user-avatar user-avatar-empty">
                    <img 
                      src="/img/water-meter.png" 
                      alt="Medidor de agua" 
                      className="w-6 h-6" 
                    />
                  </div>
                  <div>
                    <h3 className="user-name">{meter.num_medidor}</h3>
                    <div className="user-meta">
                      <span className={`status-badge ${meter.activo ? 'active' : 'inactive'}`}>
                        {meter.activo ? (
                          <><CheckCircle className="w-3 h-3" /> Activo</>
                        ) : (
                          <><XCircle className="w-3 h-3" /> Inactivo</>
                        )}
                      </span>
                      <span className={`status-badge ${isAssigned ? 'meter-assigned' : 'meter-unassigned'}`}>
                        {isAssigned ? (
                          <><UserCheck className="w-3 h-3" /> Asignado</>
                        ) : (
                          <><UserX className="w-3 h-3" /> No Asignado</>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="user-actions">
                  <button 
                    className="action-btn view" 
                    onClick={() => openModal('view', meter)} 
                    title="Ver detalles"
                  >
                    <Eye className="w-4 h-4 icon-view" />
                  </button>

                  {/* 🆕 BOTÓN DE CAMBIO DE MEDIDOR - Solo si está asignado */}
                  {isAssigned && permissions.canUpdate && (
                    <button 
                      className="action-btn transfer" 
                      onClick={() => openTransferModal(meter)} 
                      title="Cambiar medidor a otro afiliado"
                    >
                      <ArrowRightLeft className="w-4 h-4" />
                    </button>
                  )}

                  {permissions.canUpdate && (
                    <button 
                      className="action-btn edit" 
                      onClick={() => openModal('edit', meter)} 
                      title="Editar medidor"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  )}

                  {permissions.canToggleStatus && (
                    <button 
                      className="action-btn toggle" 
                      onClick={() => toggleMeterStatus(meter.id_medidor)} 
                      title={meter.activo ? 'Desactivar' : 'Activar'}
                    >
                      {meter.activo ? (
                        <XCircle className="w-4 h-4" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                    </button>
                  )}

                  {permissions.canDelete && (
                    <button 
                      className="action-btn delete" 
                      onClick={() => handleDelete(meter.id_medidor)} 
                      title="Eliminar medidor"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="user-card-body">
                <div className="user-contact">
                  {/* Afiliado */}
                  {isAssigned && (
                    <div className="contact-item">
                      {isAssigned ? (
                        <UserCheck className="w-4 h-4 text-green-500" />
                      ) : (
                        <User className="w-4 h-4 text-amber-500" />
                      )}
                      <div className="contact-text-group flex">
                        <span className="label font-semibold mr-1">Nombre afiliado:</span>
                        <span className="value">{meter.nombre_afiliado || 'No asignado'}</span>
                      </div>
                    </div>
                  )}

                  {/* Código de Afiliado */}
                  {isAssigned && (
                    <div className="contact-item">
                      <IdCard className="w-4 h-4 text-gray-400" />
                      <div className="contact-text-group flex">
                        <span className="label font-semibold mr-1">Código Afiliado:</span>
                        <span className="value">{meter.cod_usuario_afi}</span>
                      </div>
                    </div>
                  )}

                  {/* Sector */}
                  <div className="contact-item">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <div className="contact-text-group flex">
                      <span className="label font-semibold mr-1">Sector:</span>
                      <span className="value">{meter.nombre_sector || 'Sin sector'}</span>
                    </div>
                  </div>

                  {/* Coordenadas */}
                  {!isNaN(Number(meter.latitud)) && !isNaN(Number(meter.longitud)) && (
                    <div className="contact-item">
                      <Navigation className="w-4 h-4 text-gray-400" />
                      <div className="contact-text-group flex">
                        <span className="label font-semibold mr-1">Ubicación:</span>
                        <span className="value">
                          {Number(meter.latitud).toFixed(4)}, {Number(meter.longitud).toFixed(4)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Altitud */}
                  {meter.altitud && (
                    <div className="contact-item">
                      <Mountain className="w-4 h-4 text-gray-400" />
                      <div className="contact-text-group flex">
                        <span className="label font-semibold mr-1">Altitud:</span>
                        <span className="value">{meter.altitud} msnm</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filteredMeters.length === 0 && (
          <div className="empty-state">
            <Gauge className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3>No se encontraron medidores</h3>
            <p>No hay medidores que coincidan con los criterios de búsqueda.</p>
          </div>
        )}
      </div>

      {/* ==================== MODAL PRINCIPAL (CREAR/EDITAR/VER) ==================== */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>
                {modalType === 'create' && 'Crear Nuevo Medidor'}
                {modalType === 'edit' && 'Editar Medidor'}
                {modalType === 'view' && 'Detalles del Medidor'}
              </h3>
              <button className="modal-close" onClick={closeModal}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="modal-body">
              {error && (
                <div className="alert alert-error mb-4">
                  <AlertCircle className="w-5 h-5 mr-2" />
                  {error}
                </div>
              )}

              {/* MODAL DE VISTA */}
              {modalType === 'view' && selectedMeter && (
                <div className="user-details">
                  <div className="detail-group">
                    <label>Número de Medidor</label>
                    <p>{selectedMeter.num_medidor}</p>
                  </div>

                  <div className="detail-group">
                    <label>Nombre Afiliado</label>
                    <p>{selectedMeter.nombre_afiliado || 'No asignado'}</p>
                  </div>

                  {selectedMeter.id_usuario_afi && (
                    <div className="detail-group">
                      <label>Código del afiliado</label>
                      <p>{selectedMeter.cod_usuario_afi || 'N/A'}</p>
                    </div>
                  )}

                  <div className="detail-group">
                    <label>Sector</label>
                    <p>{selectedMeter.nombre_sector || 'N/A'}</p>
                  </div>

                  <div className="detail-group">
                    <label>Coordenadas</label>
                    <p>
                      {selectedMeter.latitud && selectedMeter.longitud
                        ? `Lat: ${Number(selectedMeter.latitud).toFixed(4)}, Lng: ${Number(selectedMeter.longitud).toFixed(4)}`
                        : 'No disponibles'}
                    </p>
                  </div>

                  {selectedMeter.altitud && (
                    <div className="detail-group">
                      <label>Altitud</label>
                      <p>{selectedMeter.altitud} msnm</p>
                    </div>
                  )}

                  <div className="detail-group">
                    <label>Estado</label>
                    <span className={`status-badge ${selectedMeter.activo ? 'active' : 'inactive'}`}>
                      {selectedMeter.activo ? (
                        <><CheckCircle className="w-3 h-3 mr-1" /> Activo</>
                      ) : (
                        <><XCircle className="w-3 h-3 mr-1" /> Inactivo</>
                      )}
                    </span>
                  </div>

                  {/* 🆕 Acceso directo al cambio de medidor desde modal de ver */}
                  {selectedMeter.id_usuario_afi && permissions.canUpdate && (
                    <div className="detail-group">
                      <button 
                        className="btn-primary w-full mt-4" 
                        onClick={() => {
                          closeModal();
                          openTransferModal(selectedMeter);
                        }}
                      >
                        <ArrowRightLeft className="w-4 h-4 mr-2" />
                        Cambiar Medidor a Otro Afiliado
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* MODAL DE CREACIÓN/EDICIÓN */}
              {(modalType === 'create' || modalType === 'edit') && (
                <form onSubmit={handleSubmit} className="user-form">
                  <div className="form-grid">
                    <div className="form-group form-group-full">
                      <label>Número de Medidor</label>
                      <input
                        type="text"
                        required
                        value={formData.num_medidor}
                        onChange={(e) => setFormData({ ...formData, num_medidor: e.target.value })}
                        placeholder="Ej: MED-001"
                      />
                    </div>

                    {/* 🚫 Quitar select de afiliado en modo edición */}
                    {modalType === 'create' && (
                      <div className="form-group form-group-full">
                        <label>Asignar a Afiliado <small>(opcional)</small></label>
                        <select
                          value={formData.id_usuario_afi || ''}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            id_usuario_afi: e.target.value ? parseInt(e.target.value) : null 
                          })}
                        >
                          <option value="">Sin asignar</option>
                          {availableAffiliates.map(affiliate => (
                            <option key={affiliate.id_usuario_afi} value={affiliate.id_usuario_afi}>
                              {affiliate.cod_usuario_afi} - {affiliate.nombre_afiliado} - Sector: {affiliate.nombre_sector || 'N/A'}
                            </option>
                          ))}
                        </select>
                        <small className="text-gray-500 mt-1">
                          Solo se muestran afiliados sin medidor asignado
                        </small>
                      </div>
                    )}

                    <div className="form-group form-group-full">
                      <label>Sector</label>
                      <select
                        value={formData.id_sector || ''}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          id_sector: e.target.value ? parseInt(e.target.value) : null 
                        })}
                      >
                        <option value="">Seleccione un sector</option>
                        {sectors.map(sector => (
                          <option key={sector.id_sector} value={sector.id_sector}>
                            {sector.nombre_sector}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Latitud</label>
                      <input
                        type="number"
                        step="0.000001"
                        value={formData.latitud}
                        onChange={(e) => setFormData({ ...formData, latitud: e.target.value })}
                        placeholder="Ej: -1.234567"
                      />
                    </div>

                    <div className="form-group">
                      <label>Longitud</label>
                      <input
                        type="number"
                        step="0.000001"
                        value={formData.longitud}
                        onChange={(e) => setFormData({ ...formData, longitud: e.target.value })}
                        placeholder="Ej: -78.123456"
                      />
                    </div>

                    <div className="form-group">
                      <label>Altitud (metros)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.altitud}
                        onChange={(e) => setFormData({ ...formData, altitud: e.target.value })}
                        placeholder="Ej: 2850"
                      />
                    </div>

                    {modalType === 'edit' && (
                      <div className="form-group">
                        <label>Estado</label>
                        <select
                          value={formData.activo}
                          onChange={(e) => setFormData({ ...formData, activo: e.target.value === 'true' })}
                        >
                          <option value="true">Activo</option>
                          <option value="false">Inactivo</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="form-actions">
                    <button type="button" className="btn-secondary" onClick={closeModal}>
                      <X className="w-4 h-4 mr-2" />
                      Cancelar
                    </button>
                    <button type="submit" className="btn-primary">
                      <Save className="w-4 h-4 mr-2" />
                      {modalType === 'create' ? 'Crear Medidor' : 'Guardar Cambios'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== 🆕 MODAL DE CAMBIO DE MEDIDOR ==================== */}
      {showTransferModal && selectedMeterForTransfer && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>
                <ArrowRightLeft className="w-5 h-5 mr-2 inline" />
                Cambio de Medidor
              </h3>
              <button className="modal-close" onClick={closeTransferModal}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="modal-body">
              <form className="user-form">
                {/* Vista previa del medidor */}
                <div className="form-group form-group-full">
                  <div className="meter-info-card">
                    <h4 className="meter-info-title">
                      <Gauge className="w-4 h-4 mr-2" />
                      Medidor Actual
                    </h4>
                    <div className="meter-info-content">
                      <p><strong>No. Medidor:</strong> {selectedMeterForTransfer.num_medidor}</p>
                      <p><strong>Afiliado actual:</strong> {selectedMeterForTransfer.nombre_afiliado}</p>
                      <p><strong>Código:</strong> {selectedMeterForTransfer.cod_usuario_afi}</p>
                      <p><strong>Sector:</strong> {selectedMeterForTransfer.nombre_sector}</p>
                    </div>
                  </div>
                </div>

                {/* Selección de nuevo afiliado */}
                <div className="form-group form-group-full">
                  <label>Nuevo Afiliado *</label>
                  <select
                    value={transferFormData.nuevoAfiliadoId || ''}
                    onChange={(e) => setTransferFormData({
                      ...transferFormData,
                      nuevoAfiliadoId: e.target.value ? parseInt(e.target.value) : null
                    })}
                    required
                  >
                    <option value="">Seleccione un afiliado</option>
                    {availableAffiliates
                      .filter(a => a.id_usuario_afi !== selectedMeterForTransfer.id_usuario_afi)
                      .map(affiliate => (
                        <option key={affiliate.id_usuario_afi} value={affiliate.id_usuario_afi}>
                          {affiliate.cod_usuario_afi} - {affiliate.nombre_afiliado} - Sector: {affiliate.nombre_sector || 'N/A'}
                        </option>
                      ))}
                  </select>
                  <small className="text-gray-500 mt-1">
                    Solo se muestran afiliados sin medidor asignado
                  </small>
                </div>

                {/* Lista de servicios disponibles */}
                <div className="form-group form-group-full">
                  <label>Servicio a Aplicar</label>
                  <select
                    value={transferFormData.servicioId || ''}
                    onChange={(e) => {
                      const serviceId = parseInt(e.target.value);
                      const service = availableServices.find(s => s.id_servicio === serviceId);
                      setTransferFormData({
                        ...transferFormData,
                        servicioId: serviceId,
                        nombreServicio: service?.nombre || '',
                        montoServicio: parseFloat(service?.precio_base || 0)
                      });
                    }}
                    disabled={loadingServices}
                  >
                    <option value="">Seleccione un servicio</option>
                    {availableServices.map(service => (
                      <option key={service.id_servicio} value={service.id_servicio}>
                        {service.nombre} - ${Number(service.precio_base).toFixed(2)}
                      </option>
                    ))}
                  </select>
                  {loadingServices && (
                    <small className="text-gray-500">Cargando servicios disponibles...</small>
                  )}
                </div>

                {/* Nombre del servicio (editable) */}
                <div className="form-group form-group-full">
                  <label>Descripción del Servicio</label>
                  <input
                    type="text"
                    value={transferFormData.nombreServicio}
                    onChange={(e) => setTransferFormData({
                      ...transferFormData,
                      nombreServicio: e.target.value
                    })}
                    placeholder="Ej: Cambio de Medidor"
                    required
                  />
                  <small className="text-gray-500">
                    Puede editar la descripción si lo desea
                  </small>
                </div>

                {/* Monto del servicio */}
                <div className="form-group">
                  <label>Monto *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={transferFormData.montoServicio}
                    onChange={(e) => setTransferFormData({
                      ...transferFormData,
                      montoServicio: parseFloat(e.target.value) || 0
                    })}
                    placeholder="0.00"
                    required
                    className="font-semibold text-green-700"
                  />
                  <small className="text-gray-500">
                    Puede editar el monto si lo desea
                  </small>
                </div>

                {/* Observaciones */}
                <div className="form-group form-group-full">
                  <label>Observaciones</label>
                  <textarea
                    value={transferFormData.observaciones}
                    onChange={(e) => setTransferFormData({
                      ...transferFormData,
                      observaciones: e.target.value
                    })}
                    placeholder="Observaciones adicionales (opcional)"
                    rows="3"
                  />
                </div>

                {/* Resumen */}
                <div className="form-group form-group-full">
                  <div 
                    className="meter-info-card" 
                    style={{ backgroundColor: '#ecfdf5', borderColor: '#6ee7b7' }}
                  >
                    <h4 className="meter-info-title" style={{ color: '#065f46' }}>
                      <ArrowRightLeft className="w-4 h-4 mr-2" />
                      Resumen del Cambio
                    </h4>
                    <div className="meter-info-content">
                      <p><strong>Servicio:</strong> {transferFormData.nombreServicio}</p>
                      <div className="flex justify-between items-center mt-2">
                        <span className="font-semibold" style={{ color: '#065f46' }}>
                          Monto a Registrar:
                        </span>
                        <span className="text-2xl font-bold" style={{ color: '#059669' }}>
                          ${Number(transferFormData.montoServicio).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Botones de acción */}
                <div className="form-actions">
                  <button 
                    type="button" 
                    className="btn-secondary" 
                    onClick={closeTransferModal}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleTransferSubmit}
                    disabled={
                      !transferFormData.nuevoAfiliadoId ||
                      !transferFormData.nombreServicio ||
                      transferFormData.montoServicio <= 0
                    }
                  >
                    <ArrowRightLeft className="w-4 h-4 mr-2" />
                    Confirmar Cambio
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MetersSection;
