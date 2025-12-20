// src/sections/ServiciosSection.js
// MÓDULO DE SERVICIOS ADICIONALES - Con versionamiento de precios

import React, { useState, useEffect, useCallback } from 'react';
import serviciosService from '../services/serviciosServices';
import authService from '../services/authServices';

import { 
  Wrench, Plus, Search, Edit, Eye, CheckCircle, XCircle,
  X, Save, RefreshCw, AlertCircle, Package, ArrowUpDown, FileText, 
  DollarSign, Briefcase, Calendar, Clock, History, TrendingUp, Trash2
} from 'lucide-react';

const ServiciosSection = () => {
  const [servicios, setServicios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm] = useState(searchTerm);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterVigencia, setFilterVigencia] = useState('all'); // o 'all' para mostrar todas
  const [sortOrder, setSortOrder] = useState('asc');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('create');
  const [selectedServicio, setSelectedServicio] = useState(null);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [historialVersiones, setHistorialVersiones] = useState([]);
  const [showHistorialModal, setShowHistorialModal] = useState(false);
  const [showPrecioModal, setShowPrecioModal] = useState(false);
  const [nuevoPrecio, setNuevoPrecio] = useState('');
  
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    precio_base: '',
    activo: true
  });

  // 🔑 PERMISOS DEL USUARIO ACTUAL
  const [permissions, setPermissions] = useState({
    canCreate: false,
    canRead: false,
    canUpdate: false,
    canDelete: false,
    canToggleStatus: false,
    canViewHistory: false
  });

  // 🔑 Cargar permisos al montar el componente
  useEffect(() => {
    loadUserPermissions();
  }, []);

  const loadUserPermissions = () => {
    const canCreate = authService.hasPermission('servicios', 'crear') || 
                     authService.hasPermission('servicios', 'operaciones crud');
  
    const canUpdate = authService.hasPermission('servicios', 'actualizar') || 
                     authService.hasPermission('servicios', 'operaciones crud');
    
    const canDelete = authService.hasPermission('servicios', 'eliminar') || 
                     authService.hasPermission('servicios', 'operaciones crud');

    const canRead = authService.hasPermission('servicios', 'lectura') ||
               canCreate || canUpdate || canDelete ||
               authService.hasPermission('servicios', 'operaciones crud');

    const canToggleStatus = canUpdate;
    const canViewHistory = canRead;

    setPermissions({
      canCreate,
      canRead,
      canUpdate,
      canDelete,
      canToggleStatus,
      canViewHistory
    });

    console.log('🔐 Permisos del usuario en módulo Servicios:', {
      canCreate,
      canRead,
      canUpdate,
      canDelete,
      canViewHistory
    });
  };

  const fetchServicios = useCallback(async () => {
    if (!permissions.canRead) {
      setError('No tienes permiso para ver servicios');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const filters = { search: debouncedSearchTerm };

      // Aplicar filtro de vigencia
      if (filterVigencia === 'vigentes') {
        filters.es_vigente = true;
      } else if (filterVigencia === 'vencidas') {
        filters.es_vigente = false;
      }
      
      // 🔍 AGREGAR ESTE CONSOLE.LOG

      const result = await serviciosService.getServicios(filters);
      
      if (result.success) {
        setServicios(result.data);
      } else {
        setError(result.message);
        console.error('Error al cargar servicios:', result.message);
      }
    } catch (err) {
      setError('Error al cargar servicios desde el servidor');
      console.error('Error en fetchServicios:', err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearchTerm, filterVigencia, permissions.canRead]);

  // Fetch estadísticas
  const fetchStats = useCallback(async () => {
    if (!permissions.canRead) return;

    try {
      const result = await serviciosService.getServicioStats();
      if (result.success) {
        setStats(result.data);
      }
    } catch (err) {
      console.error('Error al cargar estadísticas:', err);
    }
  }, [permissions.canRead]);

  useEffect(() => {
    if (permissions.canRead) {
      console.log('🔄 Componente montado, cargando servicios...');
      fetchServicios();
      fetchStats();
    }
  }, [fetchServicios, fetchStats, permissions.canRead]);

  useEffect(() => {
    if (permissions.canRead) {
      fetchServicios();
    }
  }, [debouncedSearchTerm, filterVigencia, fetchServicios, permissions.canRead]);

  // 🔄 Cambiar el orden de clasificación
  const toggleSortOrder = () => {
    setSortOrder(prevOrder => prevOrder === 'asc' ? 'desc' : 'asc');
  };

  // 🎯 Filtrar y ordenar servicios
  const filteredServicios = servicios
    .filter(servicio => {
      const matchesSearch =
        servicio.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (servicio.descripcion &&
          servicio.descripcion.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus =
        filterStatus === 'all' ||
        (filterStatus === 'active' && servicio.activo) ||
        (filterStatus === 'inactive' && !servicio.activo);

      // ✅ Filtro de vigencia
      const matchesVigencia =
        filterVigencia === 'all' ||
        (filterVigencia === 'vigentes' && servicio.es_vigente === true) ||
        (filterVigencia === 'vencidas' && servicio.es_vigente === false);

      return matchesSearch && matchesStatus && matchesVigencia;
    })
    .sort((a, b) => {
      // 🔥 1. Vigentes primero, vencidos al final
      if (a.es_vigente && !b.es_vigente) return -1;
      if (!a.es_vigente && b.es_vigente) return 1;

      // 🔥 2. Entre vigentes o entre vencidos → ordenar por nombre
      const nameA = a.nombre.toLowerCase();
      const nameB = b.nombre.toLowerCase();

      return sortOrder === 'asc'
        ? nameA.localeCompare(nameB, 'es', { sensitivity: 'base' })
        : nameB.localeCompare(nameA, 'es', { sensitivity: 'base' });
    });


  // 📜 Ver historial de versiones
  const verHistorial = async (nombreServicio) => {
    if (!permissions.canViewHistory) {
      alert('❌ No tienes permiso para ver el historial');
      return;
    }

    try {
      const result = await serviciosService.getHistorialServicio(nombreServicio);
      if (result.success) {
        setHistorialVersiones(result.data);
        setShowHistorialModal(true);
      } else {
        alert('Error: ' + result.message);
      }
    } catch (error) {
      alert('Error al cargar historial: ' + error.message);
    }
  };

  // 💵 Abrir modal para cambiar precio
  const abrirModalPrecio = (servicio) => {
    if (!permissions.canUpdate) {
      alert('❌ No tienes permiso para actualizar precios');
      return;
    }

    setSelectedServicio(servicio);
    setNuevoPrecio(servicio.precio_base);
    setShowPrecioModal(true);
  };

  // 💵 Actualizar precio (crea nueva versión)
  const actualizarPrecio = async () => {
    if (!selectedServicio) return;

    try {
      const result = await serviciosService.updatePrecioServicio(
        selectedServicio.id_servicio, 
        nuevoPrecio
      );

      if (result.success) {
        alert('✅ Nueva versión creada con el nuevo precio');
        setShowPrecioModal(false);
        setSelectedServicio(null);
        setNuevoPrecio('');
        await fetchServicios();
        await fetchStats();
      } else {
        alert('Error: ' + result.message);
      }
    } catch (error) {
      alert('Error al actualizar precio: ' + error.message);
    }
  };

  const openModal = (type, servicio = null) => {
    if (type === 'create' && !permissions.canCreate) {
      alert('❌ No tienes permiso para crear servicios');
      return;
    }
    if (type === 'edit' && !permissions.canUpdate) {
      alert('❌ No tienes permiso para editar servicios');
      return;
    }

    setModalType(type);
    setSelectedServicio(servicio);
    setError(null);
    
    if (type === 'create') {
      setFormData({
        nombre: '',
        descripcion: '',
        precio_base: '',
        activo: true
      });
    } else if (type === 'edit' && servicio) {
      setFormData({
        nombre: servicio.nombre,
        descripcion: servicio.descripcion || '',
        precio_base: servicio.precio_base,
        activo: servicio.activo
      });
    }
    
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedServicio(null);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      let result;

      if (modalType === 'create') {
        if (!permissions.canCreate) {
          setError('No tienes permiso para crear servicios');
          return;
        }

        result = await serviciosService.createServicio(formData);

        if (result.success) {
          await fetchServicios();
          await fetchStats();
          closeModal();
          alert('✅ Servicio creado exitosamente');
        } else {
          setError(result.message || 'Error al crear el servicio');
        }

      } else if (modalType === 'edit') {
        if (!permissions.canUpdate) {
          setError('No tienes permiso para editar servicios');
          return;
        }

        // Editar solo nombre, descripción y estado (NO precio)
        const editData = {
          nombre: formData.nombre,
          descripcion: formData.descripcion,
          activo: formData.activo
        };

        result = await serviciosService.editarServicioBase(selectedServicio.id_servicio, editData);
        
        if (result.success) {
          alert('✅ Cambios guardados correctamente');
          await fetchServicios();
          await fetchStats();
          closeModal();
        } else {
          setError(result.message || 'Error al actualizar servicio');
        }
      }

    } catch (error) {
      console.error('Error al guardar servicio:', error);
      setError(error.message || 'Error al guardar servicio');
    }
  };

  const toggleServicioStatus = async (servicioId) => {
    if (!permissions.canToggleStatus) {
      alert('❌ No tienes permiso para cambiar el estado de servicios');
      return;
    }

    try {
      const result = await serviciosService.toggleServicioStatus(servicioId);
      
      if (result.success) {
        await fetchServicios();
      } else {
        alert('Error: ' + result.message);
      }
    } catch (error) {
      alert('Error al cambiar estado del servicio');
    }
  };

  // FUNCIONALIDAD DE ELIMINAR SERVICIO
  const handleDelete = async (servicioId) => {
    if (!permissions.canDelete) {
      alert("❌ No tienes permiso para eliminar servicios.");
      return;
    }

    const confirmado = window.confirm("¿Estás seguro de que deseas eliminar este servicio?");
    if (!confirmado) return;

    try {
      const result = await serviciosService.deleteServicio(servicioId);

      if (result.success) {
        alert("✅ Servicio eliminado: " + result.message);
        await fetchServicios();
        await fetchStats();
      } else {
        alert("❌ Advertencia: " + result.message);
      }

    } catch (error) {
      alert("❌ Error al eliminar servicio: " + error.message);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-EC', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (!permissions.canRead) {
    return (
      <div className="section-placeholder">
        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
        <h2>Acceso Denegado</h2>
        <p>No tienes permiso para acceder al módulo de servicios.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="section-placeholder">
        <RefreshCw className="w-16 h-16 mx-auto mb-4 text-gray-400 animate-spin" />
        <h2>Cargando Servicios</h2>
        <p>Por favor espera mientras cargamos la información...</p>
      </div>
    );
  }

  if (error && servicios.length === 0) {
    return (
      <div className="section-placeholder">
        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
        <h2>Error al Cargar Servicios</h2>
        <p>{error}</p>
        <button onClick={fetchServicios} className="btn-primary mt-4">
          <RefreshCw className="w-4 h-4 mr-2" />
          Reintentar
        </button>
      </div>
    );
  }

  // ==================== RENDERIZADO PRINCIPAL ====================
  return (
    <div className="users-section">
      <div className="section-header">
        <div className="section-title">
          <Briefcase className="w-6 h-6 text-blue-600" />
          <h2>Gestión de Servicios Adicionales</h2>
        </div>
        {permissions.canCreate && (
          <button 
            className="btn-primary"
            onClick={() => openModal('create')}
          >
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Servicio
          </button>
        )}
      </div>

      <div className="filters-section">
        {/* IZQUIERDA — Barra de búsqueda */}
        <div className="search-container">
          <Search className="search-icon" />
          <input
            type="text"
            placeholder="Buscar servicios..."
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* DERECHA — Filtros y acciones */}
        <div className="filters-right">
          {/* Vigencia */}
          <select 
            className="filter-select" 
            value={filterVigencia} 
            onChange={(e) => setFilterVigencia(e.target.value)}
          >
            <option value="all">Todas las vigencias</option>
            <option value="vigentes">Solo vigentes</option>
            <option value="vencidas">Solo vencidas</option>
          </select>

          {/* Estado */}
          <select 
            className="filter-select" 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>

          {/* Ordenamiento */}
          <button 
            className="btn-secondary" 
            onClick={toggleSortOrder}
            title={`Ordenar ${sortOrder === 'asc' ? 'descendente' : 'ascendente'}`}
          >
            <ArrowUpDown className="w-4 h-4" />
            <span className="ml-1 text-xs">{sortOrder === 'asc' ? '↑' : '↓'}</span>
          </button>

          {/* Recargar */}
          <button 
            className="btn-secondary" 
            onClick={() => { fetchServicios(); fetchStats(); }}
            title="Recargar lista"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

      </div>

      {/* Tarjetas de estadísticas */}
      {stats && (
        <div className="users-stats">
          <div className="stat-item">
            <Briefcase className="stat-icon text-blue-600" />
            <div>
              <p className="stat-label">Total Versiones</p>
              <p className="stat-value">{stats.total}</p>
            </div>
          </div>
          <div className="stat-item">
            <CheckCircle className="stat-icon text-green-600" />
            <div>
              <p className="stat-label">Servicios Vigentes</p>
              <p className="stat-value">{stats.vigentes}</p>
            </div>
          </div>
          <div className="stat-item">
            <CheckCircle className="stat-icon text-emerald-600" />
            <div>
              <p className="stat-label">Activos</p>
              <p className="stat-value">{stats.activos}</p>
            </div>
          </div>
          <div className="stat-item">
            <XCircle className="stat-icon text-red-600" />
            <div>
              <p className="stat-label">Inactivos</p>
              <p className="stat-value">{stats.inactivos}</p>
            </div>
          </div>
        </div>
      )}

      <div className="users-grid">
        {filteredServicios.map(servicio => (
          <div 
            key={servicio.id_servicio} 
            className={`user-card ${!servicio.activo ? 'inactive' : ''} ${!servicio.es_vigente ? 'vencida' : ''}`}
          >
            <div className="user-card-header">
              <div className="user-info">
                
                <div className="user-icon">
                  <Wrench className="w-6 h-6 text-blue-600" />
                </div>

                <div>
                  <h3 className="user-name">{servicio.nombre}</h3>

                  <div className="flex gap-2 items-center mt-1 flex-wrap">

                    {/* Estado Activo / Inactivo */}
                    <span className={`status-badge ${servicio.activo ? 'active' : 'inactive'}`}>
                      {servicio.activo ? (
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

                    {/* Vigente / Vencida (con los mismos estilos de tarifas) */}
                    <span
                      className={`status-badge ${servicio.es_vigente ? 'vigente' : 'vencida'}`}
                      style={{
                        backgroundColor: servicio.es_vigente ? '#f0fdf4' : '#fef2f2',
                        color: servicio.es_vigente ? '#16a34a' : '#dc2626'
                      }}
                    >
                      {servicio.es_vigente ? (
                        <>
                          <CheckCircle className="w-3 h-3" />
                          Vigente
                        </>
                      ) : (
                        <>
                          <Clock className="w-3 h-3" />
                          Vencida
                        </>
                      )}
                    </span>

                  </div>
                </div>
              </div>

              {/* ACCIONES */}
              <div className="user-actions">

                <button 
                  className="action-btn view"
                  onClick={() => openModal('view', servicio)}
                  title="Ver detalles"
                >
                  <Eye className="w-4 h-4 icon-view" />
                </button>

                {permissions.canViewHistory && (
                  <button 
                    className="action-btn history"
                    onClick={() => verHistorial(servicio.nombre)}
                    title="Ver historial de precios"
                  >
                    <History className="w-4 h-4" />
                  </button>
                )}

                {permissions.canUpdate && servicio.es_vigente && (
                  <button 
                    className="action-btn edit"
                    onClick={() => openModal('edit', servicio)}
                    title="Editar información"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                )}

                {permissions.canUpdate && servicio.es_vigente && (
                  <button 
                    className="action-btn warning"
                    onClick={() => abrirModalPrecio(servicio)}
                    title="Actualizar precio (crear nueva versión)"
                    style={{color: '#059669'}}
                  >
                    <TrendingUp className="w-4 h-4" />
                  </button>
                )}

                {permissions.canToggleStatus && (
                  <button 
                    className="action-btn toggle"
                    onClick={() => toggleServicioStatus(servicio.id_servicio)}
                    title={servicio.activo ? 'Desactivar' : 'Activar'}
                  >
                    {servicio.activo ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                  </button>
                )}
                {permissions.canDelete && (
                  <button 
                    className="action-btn delete"
                    onClick={() => handleDelete(servicio.id_servicio)}
                    title="Eliminar servicio"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}

              </div>
            </div>

            <div className="user-card-body">
              
              {/* Descripción */}
              <p className="user-description flex items-center gap-2 text-gray-700 mb-2">
                <FileText className="w-4 h-4 text-gray-400" />
                {servicio.descripcion?.trim() ? servicio.descripcion : 'Sin descripción'}
              </p>

              {/* Precio */}
              <div className="text-sm mb-2">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  <span className="text-gray-500">Precio Base: </span>
                  <span className="font-semibold text-green-700">
                    {formatCurrency(servicio.precio_base)}
                  </span>
                </div>
              </div>

              {/* Fechas */}
              <div className="flex items-center gap-2 text-xs text-gray-500 border-t pt-2">
                <Calendar className="w-3 h-3" />
                <span>
                  Desde: {formatDate(servicio.vigencia_desde)}
                  {servicio.vigencia_hasta && ` | Hasta: ${formatDate(servicio.vigencia_hasta)}`}
                </span>
              </div>

            </div>
          </div>
        ))}
      </div>


      {filteredServicios.length === 0 && (
        <div className="empty-state">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3>No se encontraron servicios</h3>
          <p>No hay servicios que coincidan con los criterios de búsqueda.</p>
        </div>
      )}

      {/* MODAL DE DETALLES/CREAR/EDITAR */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>
                {modalType === 'create' && 'Crear Nuevo Servicio'}
                {modalType === 'edit' && 'Editar Servicio'}
                {modalType === 'view' && 'Detalles del Servicio'}
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

              {modalType === 'view' && selectedServicio && (
                <div className="user-details">
                  <div className="detail-group">
                    <label>ID Servicio:</label>
                    <p>{selectedServicio.id_servicio}</p>
                  </div>
                  <div className="detail-group">
                    <label>Nombre:</label>
                    <p>{selectedServicio.nombre}</p>
                  </div>
                  {selectedServicio.descripcion && (
                    <div className="detail-group">
                      <label>Descripción:</label>
                      <p>{selectedServicio.descripcion}</p>
                    </div>
                  )}
                  <div className="detail-group">
                    <label>Precio Base:</label>
                    <p>{formatCurrency(selectedServicio.precio_base)}</p>
                  </div>
                  <div className="detail-group">
                    <label>Vigencia Desde:</label>
                    <p>{formatDate(selectedServicio.vigencia_desde)}</p>
                  </div>
                  {selectedServicio.vigencia_hasta && (
                    <div className="detail-group">
                      <label>Vigencia Hasta:</label>
                      <p>{formatDate(selectedServicio.vigencia_hasta)}</p>
                    </div>
                  )}
                  <div className="detail-group">
                    <label>Estado de Vigencia:</label>
                    <span className={`status-badge ${selectedServicio.es_vigente ? 'active' : 'inactive'}`}>
                      {selectedServicio.es_vigente ? 'Vigente' : 'Vencida'}
                    </span>
                  </div>
                  <div className="detail-group">
                    <label>Estado:</label>
                    <span className={`status-badge ${selectedServicio.activo ? 'active' : 'inactive'}`}>
                      {selectedServicio.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <div className="detail-group">
                    <label>Fecha de Creación:</label>
                    <p>{formatDate(selectedServicio.fecha_creacion)}</p>
                  </div>
                </div>
              )}

              {(modalType === 'create' || modalType === 'edit') && (
                <form onSubmit={handleSubmit} className="user-form">
                  {modalType === 'edit' && (
                    <div className="alert alert-info mb-4">
                      <AlertCircle className="w-5 h-5 mr-2" />
                      Para cambiar el precio, usa el botón "Actualizar Precio" en la tarjeta del servicio.
                    </div>
                  )}
                  
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Nombre del Servicio *</label>
                      <input
                        type="text"
                        required
                        minLength="3"
                        value={formData.nombre}
                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                        placeholder="Ej: Instalación de medidor"
                      />
                    </div>

                    {modalType === 'create' && (
                      <div className="form-group">
                        <label>Precio Base ($) *</label>
                        <input
                          type="number"
                          required
                          step="0.01"
                          min="0"
                          value={formData.precio_base}
                          onChange={(e) => setFormData({ ...formData, precio_base: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                    )}

                    <div className="form-group form-group-full">
                      <label>Descripción</label>
                      <textarea
                        value={formData.descripcion}
                        onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                        placeholder="Descripción del servicio (opcional)"
                        rows="3"
                      />
                    </div>

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
                  </div>

                  <div className="form-actions">
                    <button type="button" className="btn-secondary" onClick={closeModal}>
                      Cancelar
                    </button>
                    <button type="submit" className="btn-primary">
                      <Save className="w-4 h-4 mr-2" />
                      {modalType === 'create' ? 'Crear Servicio' : 'Guardar Cambios'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ACTUALIZAR PRECIO */}
      {showPrecioModal && selectedServicio && (
        <div className="modal-overlay">
          <div className="modal modal-sm">
            <div className="modal-header">
              <h3>
                <TrendingUp className="w-5 h-5 inline mr-2" />
                Actualizar Precio
              </h3>
              <button className="modal-close" onClick={() => setShowPrecioModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="alert alert-info mb-4">
                <AlertCircle className="w-5 h-5 mr-2" />
                Al actualizar el precio, se creará una nueva versión del servicio. La versión actual quedará como histórica.
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">Servicio: <strong>{selectedServicio.nombre}</strong></p>
                <p className="text-sm text-gray-600 mb-2">Precio actual: <strong className="text-green-700">{formatCurrency(selectedServicio.precio_base)}</strong></p>
              </div>

              <div className="form-group">
                <label>Nuevo Precio Base ($) *</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0"
                  value={nuevoPrecio}
                  onChange={(e) => setNuevoPrecio(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="form-actions mt-4">
                <button 
                  type="button" 
                  className="btn-secondary" 
                  onClick={() => {
                    setShowPrecioModal(false);
                    setSelectedServicio(null);
                    setNuevoPrecio('');
                  }}
                >
                  Cancelar
                </button>
                <button 
                  type="button" 
                  className="btn-primary"
                  onClick={actualizarPrecio}
                  disabled={!nuevoPrecio || parseFloat(nuevoPrecio) === parseFloat(selectedServicio.precio_base)}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Guardar Nuevo Precio
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE HISTORIAL DE VERSIONES */}
      {showHistorialModal && (
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <div className="modal-header">
              <h3>
                <History className="w-5 h-5 inline mr-2" />
                Historial de Precios
              </h3>
              <button className="modal-close" onClick={() => setShowHistorialModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="modal-body">
              {historialVersiones.length > 0 ? (
                <div className="space-y-4">
                  {historialVersiones.map((version, index) => (
                    <div 
                      key={version.id_servicio} 
                      className={`border rounded-lg p-4 ${version.es_vigente ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-gray-50'}`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-semibold text-lg">{version.nombre}</h4>
                          {version.descripcion && (
                            <p className="text-sm text-gray-600 mt-1">{version.descripcion}</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <span className={`status-badge ${version.es_vigente ? 'active' : 'inactive'}`}>
                            {version.es_vigente ? 'Vigente' : 'Vencida'}
                          </span>
                          <span className="status-badge" style={{backgroundColor: '#f0f9ff', color: '#0369a1'}}>
                            Versión {historialVersiones.length - index}
                          </span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-gray-600">Precio Base:</span>
                          <span className="font-semibold ml-2 text-green-700">{formatCurrency(version.precio_base)}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Estado:</span>
                          <span className={`ml-2 font-semibold ${version.activo ? 'text-green-600' : 'text-red-600'}`}>
                            {version.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Vigencia Desde:</span>
                          <span className="font-semibold ml-2">{formatDate(version.vigencia_desde)}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Vigencia Hasta:</span>
                          <span className="font-semibold ml-2">
                            {version.vigencia_hasta ? formatDate(version.vigencia_hasta) : 'Actual'}
                          </span>
                        </div>
                      </div>
                      
                      {index > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="flex items-center gap-2 text-sm">
                            <TrendingUp className="w-4 h-4 text-blue-600" />
                            <span className="text-gray-600">Cambio de precio:</span>
                            <span className="font-semibold">
                              {formatCurrency(historialVersiones[index - 1].precio_base)} → {formatCurrency(version.precio_base)}
                            </span>
                            <span className={`ml-2 ${version.precio_base > historialVersiones[index - 1].precio_base ? 'text-red-600' : 'text-green-600'}`}>
                              ({version.precio_base > historialVersiones[index - 1].precio_base ? '+' : ''}
                              {((version.precio_base - historialVersiones[index - 1].precio_base) / historialVersiones[index - 1].precio_base * 100).toFixed(2)}%)
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <History className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p>No hay historial disponible</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiciosSection;