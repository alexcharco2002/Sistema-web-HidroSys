// src/sections/FinesSection.js
// MÓDULO DE TIPOS DE MULTA - Con control de versiones y vigencia

import React, { useState, useEffect, useCallback } from 'react';
import multasService from '../../services/fineServices';
import authService from '../../services/authServices';
import {
  AlertTriangle,
  Plus,
  Search,
  Edit,
  Eye,
  CheckCircle,
  XCircle,
  X,
  Save,
  RefreshCw,
  AlertCircle,
  Calendar,
  Clock,
  History,
  ArrowUpDown,
  FileText, Trash2
} from 'lucide-react';


const FinesSection = () => {
  const [tiposMulta, setTiposMulta] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm] = useState(searchTerm);

  const [filterStatus, setFilterStatus] = useState('all'); // all | active | inactive
  const [filterVigencia, setFilterVigencia] = useState('all'); // vigentes | vencidas | all

  const [sortOrder, setSortOrder] = useState('asc');

  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('create'); // create | edit | view
  const [selectedTipoMulta, setSelectedTipoMulta] = useState(null);

  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);

  const [historialVersiones, setHistorialVersiones] = useState([]);
  const [showHistorialModal, setShowHistorialModal] = useState(false);

  const [formData, setFormData] = useState({
    nombre_multa: '',
    descripcion: '',
    monto: '',
    vigencia_desde: '',
    activo: true,
  });
  

  // PERMISOS
  const [permissions, setPermissions] = useState({
    canCreate: false,
    canRead: false,
    canUpdate: false,
    canDelete: false,
    canToggleStatus: false,
    canViewHistory: false,
  });

  useEffect(() => {
    loadUserPermissions();
  }, []);

  const loadUserPermissions = () => {
    const canCreate =
      authService.hasPermission('multas', 'crear') ||
      authService.hasPermission('multas', 'operaciones crud');
    const canUpdate =
      authService.hasPermission('multas', 'actualizar') ||
      authService.hasPermission('multas', 'operaciones crud');
    const canDelete =
      authService.hasPermission('multas', 'eliminar') ||
      authService.hasPermission('multas', 'operaciones crud');
    const canRead =
      authService.hasPermission('multas', 'lectura') ||
      canCreate ||
      canUpdate ||
      canDelete ||
      authService.hasPermission('multas', 'operaciones crud');

    const canToggleStatus = canUpdate;
    const canViewHistory = canRead;

    setPermissions({ 
      canCreate, 
      canRead, 
      canDelete,
      canUpdate, 
      canToggleStatus,
      canViewHistory 
    });
    console.log('🔐 Permisos del usuario en módulo Multas:', {
      canCreate,
      canRead,
      canUpdate,
      canDelete,
      canToggleStatus,
      canViewHistory,
    });
  };

  // FETCH TIPOS DE MULTA
  const fetchTiposMulta = useCallback(async () => {
    if (!permissions.canRead) {
      setError('No tienes permiso para ver tipos de multa');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const filters = { search: debouncedSearchTerm };

      if (filterVigencia === 'vigentes') {
        filters.es_vigente = true;
      } else if (filterVigencia === 'vencidas') {
        filters.es_vigente = false;
      }

      const result = await multasService.getTiposMulta(filters);

      if (result.success) {
        setTiposMulta(result.data);
        console.log('✅ Tipos de multa cargados:', result.data.length);
      } else {
        setError(result.message);
        console.error('Error al cargar tipos de multa:', result.message);
      }
    } catch (err) {
      setError('Error al cargar tipos de multa desde el servidor');
      console.error('Error en fetchTiposMulta:', err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearchTerm, filterVigencia, permissions.canRead]);

  // FETCH STATS
  const fetchStats = useCallback(async () => {
    if (!permissions.canRead) return;
    try {
      const result = await multasService.getMultaStats();
      if (result.success) {
        setStats(result.data);
      }
    } catch (err) {
      console.error('Error al cargar estadísticas de multas:', err);
    }
  }, [permissions.canRead]);

  useEffect(() => {
    if (permissions.canRead) {
      console.log('🔄 Componente Multas montado, cargando datos...');
      fetchTiposMulta();
      fetchStats();
    }
  }, [fetchTiposMulta, fetchStats, permissions.canRead]);

  useEffect(() => {
    if (permissions.canRead) {
      fetchTiposMulta();
    }
  }, [debouncedSearchTerm, filterVigencia, fetchTiposMulta, permissions.canRead]);

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  // FILTRADO Y ORDENAMIENTO
  const filteredTiposMulta = tiposMulta
    .filter((m) => {
      const search = searchTerm.toLowerCase();

      const matchesSearch = 
        m.nombre_multa.toLowerCase().includes(search) ||
        (m.descripcion && m.descripcion.toLowerCase().includes(search));
      
      const matchesStatus = 
        filterStatus === 'all' ||
        (filterStatus === 'active' && m.activo) ||
        (filterStatus === 'inactive' && !m.activo);
      
      const matchesVigencia = 
        filterVigencia === 'all' ||
        (filterVigencia === 'vigentes' && m.es_vigente === true) ||
        (filterVigencia === 'vencidas' && m.es_vigente === false);
      
      return matchesSearch && matchesStatus && matchesVigencia;
    })
    .sort((a, b) => {
      // 🚨 PRIMERO ORDENAR POR VIGENCIA (vigentes arriba)
      if (a.es_vigente !== b.es_vigente) {
        return a.es_vigente ? -1 : 1; 
        // a.es_vigente true → va primero
        // a.es_vigente false → va al final
      }

      // 👇 SI tienen la misma vigencia, ordenar por nombre
      const nameA = a.nombre_multa.toLowerCase();
      const nameB = b.nombre_multa.toLowerCase();

      return sortOrder === 'asc'
        ? nameA.localeCompare(nameB, 'es', { sensitivity: 'base' })
        : nameB.localeCompare(nameA, 'es', { sensitivity: 'base' });
    });



  // HISTORIAL
  const verHistorial = async (nombreMulta) => {
    if (!permissions.canViewHistory) {
      alert('❌ No tienes permiso para ver historial de multas');
      return;
    }

    try {
      const result = await multasService.getHistorialTipoMulta(nombreMulta);
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

  // MODAL
  const openModal = (type, tipo = null) => {
    if (type === 'create' && !permissions.canCreate) {
      alert('❌ No tienes permiso para crear tipos de multa');
      return;
    }
    if (type === 'edit' && !permissions.canUpdate) {
      alert('❌ No tienes permiso para editar tipos de multa');
      return;
    }

    setModalType(type);
    setSelectedTipoMulta(tipo);
    setError(null);

    if (type === 'create') {
      setFormData({
        nombre_multa: '',
        descripcion: '',
        monto: '',
        vigencia_desde: new Date().toLocaleDateString('en-CA'),
        activo: true,
      });
    } else if (type === 'edit' && tipo) {
      setFormData({
        nombre_multa: tipo.nombre_multa,
        descripcion: tipo.descripcion || '',
        monto: tipo.monto !== null ? tipo.monto : '',
        vigencia_desde: tipo.vigencia_desde
          ? new Date(tipo.vigencia_desde).toISOString().split('T')[0]
          : '',
        activo: tipo.activo,
      });
    }

    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedTipoMulta(null);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      let result;

      if (modalType === 'create') {
        if (!permissions.canCreate) {
          setError('No tienes permiso para crear tipos de multa');
          return;
        }
        result = await multasService.createTipoMulta(formData);
        if (result.success) {
          await fetchTiposMulta();
          await fetchStats();
          closeModal();
          alert('✅ Tipo de multa creado exitosamente');
        } else {
          setError(result.message || 'Error al crear el tipo de multa');
        }
      } else if (modalType === 'edit') {
        if (!permissions.canUpdate) {
          setError('No tienes permiso para editar tipos de multa');
          return;
        }
        result = await multasService.updateTipoMulta(
          selectedTipoMulta.id_tipo_multa,
          formData
        );
        if (result.success) {
          alert('✅ Nueva versión de tipo de multa creada correctamente');
          await fetchTiposMulta();
          await fetchStats();
          closeModal();
        } else {
          setError(result.message || 'Error al actualizar tipo de multa');
        }
      }
    } catch (error) {
      console.error('Error al guardar tipo de multa:', error);
      setError(error.message || 'Error al guardar tipo de multa');
    }
  };

  const toggleTipoMultaStatus = async (id) => {
    if (!permissions.canToggleStatus) {
      alert('❌ No tienes permiso para cambiar el estado de tipos de multa');
      return;
    }
    try {
      const result = await multasService.toggleTipoMultaStatus(id);
      if (result.success) {
        await fetchTiposMulta();
      } else {
        alert('Error: ' + result.message);
      }
    } catch (error) {
      alert('Error al cambiar estado del tipo de multa: ' + error.message);
    }
  };

  // FUNCIÓN ELIMINAR TIPO DE MULTA
  const handleDelete = async (tipoMultaId) => {
    if (!permissions.canDelete) {
      alert("❌ No tienes permiso para eliminar tipos de multa.");
      return;
    }

    const confirmado = window.confirm("¿Estás seguro de que deseas eliminar este tipo de multa?");
    if (!confirmado) return;

    try {
      const result = await multasService.deleteTipoMulta(tipoMultaId);

      if (result.success) {
        alert("✅ Tipo de multa eliminado: " + result.message);
        await fetchTiposMulta();
        await fetchStats();
      } else {
        alert("❌ Advertencia: " + result.message);
      }

    } catch (error) {
      alert("❌ Error al eliminar tipo de multa: " + error.message);
    }
  };


  const formatCurrency = (value) => {
    if (value === null || value === undefined || value === '') return 'N/A';
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-EC', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // SIN PERMISOS DE LECTURA
  if (!permissions.canRead) {
    return (
      <div className="section-placeholder">
        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
        <h2>Acceso Denegado</h2>
        <p>No tienes permiso para acceder al módulo de tipos de multa.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="section-placeholder">
        <RefreshCw className="w-16 h-16 mx-auto mb-4 text-gray-400 animate-spin" />
        <h2>Cargando Tipos de Multa</h2>
        <p>Por favor espera mientras cargamos la información...</p>
      </div>
    );
  }

  if (error && tiposMulta.length === 0) {
    return (
      <div className="section-placeholder">
        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
        <h2>Error al Cargar Tipos de Multa</h2>
        <p>{error}</p>
        <button onClick={fetchTiposMulta} className="btn-primary mt-4">
          <RefreshCw className="w-4 h-4 mr-2" />
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="users-section">
      <div className="section-header">
        <div className="section-title">
          <AlertTriangle className="w-7 h-7 text-amber-600" />
          <div>
            <h2>Gestión de tipos de multas</h2>
            <p className="section-subtitle">
              Gestiona la información de los tipos de multas
            </p>
          </div>
        </div>
        {permissions.canCreate && (
          <button 
            className="btn-primary"
            onClick={() => openModal('create')}
          >
            <Plus className="w-4 h-4 mr-2" />
            Nueva Multa
          </button>
        )}
      </div>
      {/* ==================== ESTADÍSTICAS ==================== */}
      {stats && (
        <div className="periodo-stats-container">

          {/* Header */}
          <div className="periodo-stats-header">
            <AlertTriangle className="w-5 h-5 text-amber-600 mr-2" />
            <h3>Resumen de Versiones</h3>
          </div>

          {/* Cards */}
          <div className="users-stats">

            {/* 📦 Total versiones */}
            <div className="stat-item">
              <AlertTriangle className="stat-icon text-amber-600" />
              <div>
                <p className="stat-label">Total Versiones</p>
                <p className="stat-value">{stats.total_versiones}</p>
              </div>
            </div>

            {/* ✅ Tipos vigentes */}
            <div className="stat-item active green">
              <CheckCircle className="stat-icon text-green-600" />
              <div>
                <p className="stat-label">Tipos Vigentes</p>
                <p className="stat-value">{stats.tipos_vigentes}</p>
              </div>
            </div>

            {/* ⏳ Tipos vencidos */}
            <div className="stat-item active orange">
              <Clock className="stat-icon text-orange-600" />
              <div>
                <p className="stat-label">Tipos Vencidos</p>
                <p className="stat-value">{stats.tipos_vencidos}</p>
              </div>
            </div>

          </div>
        </div>
      )}

      <div className="filters-section">
        {/* IZQUIERDA — Barra de búsqueda */}
        <div className="search-container">
          <Search className="search-icon" />
          <input
            type="text"
            placeholder="Buscar tipos de multa..."
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* DERECHA — Filtros y acciones */}
        <div className="filters-right">
          {/* 🟢 Vigencia */}
          <select 
            className="filter-select"
            value={filterVigencia}
            onChange={(e) => setFilterVigencia(e.target.value)}
          >
            <option value="all">Todas las vigencias</option>
            <option value="vigentes">Solo vigentes</option>
            <option value="vencidas">Solo vencidas</option>
          </select>

          {/* 🔧 Estado */}
          <select 
            className="filter-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>

          {/* ⬆⬇ Ordenamiento */}
          <button 
            className="btn-secondary"
            onClick={toggleSortOrder}
            title={`Ordenar ${sortOrder === 'asc' ? 'descendente' : 'ascendente'}`}
          >
            <ArrowUpDown className="w-4 h-4" />
            <span className="ml-1 text-xs">
              {sortOrder === 'asc' ? '↑' : '↓'}
            </span>
          </button>

          {/* 🔄 Recargar */}
          <button 
            className="btn-secondary"
            onClick={() => {
              fetchTiposMulta();
              fetchStats();
            }}
            title="Recargar lista"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="users-grid">
        {filteredTiposMulta.map(multa => (
          <div key={multa.id_tipo_multa} className={`user-card ${!multa.activo ? 'inactive' : ''} ${!multa.es_vigente ? 'vencida' : ''}`}>
            <div className="user-card-header">
              <div className="user-info">
                <div className="user-icon">
                  <AlertTriangle className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h3 className="user-name">{multa.nombre_multa}</h3>
                  <div className="flex gap-2 items-center mt-1 flex-wrap">
                    <span className={`status-badge ${multa.activo ? 'active' : 'inactive'}`}>
                      {multa.activo ? (
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
                    <span className={`status-badge ${multa.es_vigente ? 'vigente' : 'vencida'}`} 
                          style={{
                            backgroundColor: multa.es_vigente ? '#f0fdf4' : '#fef2f2',
                            color: multa.es_vigente ? '#16a34a' : '#dc2626'
                          }}>
                      {multa.es_vigente ? (
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
              
              <div className="user-actions">
                <button 
                  className="action-btn view"
                  onClick={() => openModal('view', multa)}
                  title="Ver detalles"
                >
                  <Eye className="w-4 h-4 icon-view" />
                </button>

                {permissions.canViewHistory && (
                  <button 
                    className="action-btn history"
                    onClick={() => verHistorial(multa.nombre_multa)}
                    title="Ver historial de versiones"
                  >
                    <History className="w-4 h-4" />
                  </button>
                )}

                {permissions.canUpdate && multa.es_vigente && (
                  <button 
                    className="action-btn edit"
                    onClick={() => openModal('edit', multa)}
                    title="Editar multa (crear nueva versión)"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                )}

                {permissions.canToggleStatus && (
                  <button 
                    className="action-btn toggle"
                    onClick={() => toggleTipoMultaStatus(multa.id_tipo_multa)}
                    title={multa.activo ? 'Desactivar' : 'Activar'}
                  >
                    {multa.activo ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                  </button>
                )}
                {permissions.canDelete && (
                  <button 
                    className="action-btn delete"
                    onClick={() => handleDelete(multa.id_tipo_multa)}
                    title="Eliminar tipo de multa"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}


              </div>
            </div>
            <div className="user-card-body">
              <p className="user-description flex items-center gap-2 text-gray-700 mb-2">
                <FileText className="w-4 h-4 text-gray-400" />
                {multa.descripcion?.trim() ? multa.descripcion : 'Sin descripción'}
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                <div>
                  <span className="text-gray-500">Monto base: </span>
                  <span className="font-semibold ml-1">{formatCurrency(multa.monto)}</span>
                </div>
                
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500 border-t pt-2">
                <Calendar className="w-3 h-3" />
                <span>
                  Desde: {formatDate(multa.vigencia_desde)}
                  {multa.vigencia_hasta && ` | Hasta: ${formatDate(multa.vigencia_hasta)}`}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredTiposMulta.length === 0 && (
        <div className="empty-state">
          <AlertTriangle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3>No se encontraron tipos de multa</h3>
          <p>No hay tipos de multa que coincidan con los criterios de búsqueda.</p>
        </div>
      )}

      {/* MODAL DE DETALLES/CREAR/EDITAR */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>
                {modalType === 'create' && 'Crear Nuevo Tipo de Multa'}
                {modalType === 'edit' && 'Editar Tipo de Multa (Nueva Versión)'}
                {modalType === 'view' && 'Detalles del Tipo de Multa'}
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
              {/*MODAL  VISTA DE DETALLES */}
              {modalType === 'view' && selectedTipoMulta && (
                <div className="user-details">                 
                  <div className="detail-group">
                    <label>Nombre:</label>
                    <p>{selectedTipoMulta.nombre_multa}</p>
                  </div>
                  {selectedTipoMulta.descripcion && (
                    <div className="detail-group">
                      <label>Descripción:</label>
                      <p>{selectedTipoMulta.descripcion}</p>
                    </div>
                  )}
                  <div className="detail-group">
                    <label>Monto Base:</label>
                    <p>{formatCurrency(selectedTipoMulta.monto)}</p>
                  </div>
                  <div className="detail-group">
                    <label>Vigencia Desde:</label>
                    <p>{formatDate(selectedTipoMulta.vigencia_desde)}</p>
                  </div>
                  {selectedTipoMulta.vigencia_hasta && (
                    <div className="detail-group">
                      <label>Vigencia Hasta:</label>
                      <p>{formatDate(selectedTipoMulta.vigencia_hasta)}</p>
                    </div>
                  )}
                  <div className="detail-group">
                    <label>Estado de Vigencia:</label>
                    <span className={`status-badge ${selectedTipoMulta.es_vigente ? 'active' : 'inactive'}`}>
                      {selectedTipoMulta.es_vigente ? (
                        <>
                          <CheckCircle className="inline-block w-4 h-4 mr-1 text-green-600" />
                          Vigente
                        </>
                      ) : (
                        <>
                          <XCircle className="inline-block w-4 h-4 mr-1 text-red-600" />
                          Vencida
                        </>
                      )}
                    </span>
                  </div>

                  <div className="detail-group">
                    <label>Estado Activo:</label>
                    <span className={`status-badge ${selectedTipoMulta.activo ? 'active' : 'inactive'}`}>
                      {selectedTipoMulta.activo ? (
                        <>
                          <CheckCircle className="inline-block w-4 h-4 mr-1 text-green-600" />
                          Activo
                        </>
                      ) : (
                        <>
                          <XCircle className="inline-block w-4 h-4 mr-1 text-red-600" />
                          Inactivo
                        </>
                      )}
                    </span>
                  </div>
                </div>
              )}

               {/*MODAL  VISTA DE CREACION */}
              {(modalType === 'create' || modalType === 'edit') && (
                <form onSubmit={handleSubmit} className="user-form">
                  {modalType === 'edit' && (
                    <div className="alert alert-info mb-4">
                      <AlertCircle className="w-5 h-5 mr-2" />
                      Al guardar, se creará una nueva versión de este tipo de multa. La versión actual quedará marcada como vencida.
                    </div>
                  )}
                  
                  <div className="form-grid">
                    <div className="form-group form-group-full">
                      <label>Nombre del Tipo de Multa *</label>
                      <input
                        type="text"
                        required
                        minLength="3"
                        value={formData.nombre_multa}
                        onChange={(e) => setFormData({ ...formData, nombre_multa: e.target.value })}
                        placeholder="Ej: Multa por Reconexión Ilegal"
                      />
                    </div>

                    <div className="form-group form-group-full">
                      <label>Descripción</label>
                      <textarea
                        value={formData.descripcion}
                        onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                        placeholder="Descripción del tipo de multa (opcional)"
                        rows="3"
                      />
                    </div>

                    <div className="form-group">
                      <label>Monto Base ($)</label>
                      <input
                        type="number"
                        required
                        step="0.01"
                        min="0"
                        value={formData.monto}
                        onChange={(e) => setFormData({ ...formData, monto: e.target.value })}
                        placeholder="0.00 (opcional)"
                      />
                    </div>

                    <div className="form-group">
                      <label>Fecha de Vigencia *</label>
                      <input
                        type="date"
                        required
                        value={formData.vigencia_desde}
                        onChange={(e) => setFormData({ ...formData, vigencia_desde: e.target.value })}
                      />
                      <small className="text-gray-500 text-xs mt-1">
                        {modalType === 'create' 
                          ? 'Fecha desde la cual este tipo de multa estará vigente'
                          : 'Fecha de inicio de la nueva versión'}
                      </small>
                    </div>

                    <div className="form-group form-group-full">
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
                      {modalType === 'create' ? 'Crear Tipo de Multa' : 'Crear Nueva Versión'}
                    </button>
                  </div>
                </form>
              )}
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
                Historial de Versiones
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
                      key={version.id_tipo_multa} 
                      className={`border rounded-lg p-4 ${version.es_vigente ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-gray-50'}`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-semibold text-lg">{version.nombre_multa}</h4>
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
                          <span className="text-gray-600">Monto base:</span>
                          <span className="font-semibold ml-2">{formatCurrency(version.monto)}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">ID:</span>
                          <span className="font-semibold ml-2">{version.id_tipo_multa}</span>
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
                      
                      {version.descripcion && (
                        <p className="text-sm text-gray-700 mt-2 pt-2 border-t">
                          {version.descripcion}
                        </p>
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

export default FinesSection;