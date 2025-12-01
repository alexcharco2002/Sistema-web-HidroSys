// src/components/TarifasSection.js
// MÓDULO DE TARIFAS - Con control de permisos granular y ordenamiento mejorado
import React, { useState, useEffect, useCallback } from 'react';

import tarifasService from '../services/tarifasServices';
import authService from '../services/authServices';

import { 
  DollarSign, Plus, Search, Edit, Trash2, Eye, CheckCircle, XCircle,
  X, Save, RefreshCw, AlertCircle, Receipt, ArrowUpDown, FileText, Tag
} from 'lucide-react';

const TarifasSection = () => {
  const [tarifas, setTarifas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm] = useState(searchTerm);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterTipo, setFilterTipo] = useState('all');
  const [sortOrder, setSortOrder] = useState('asc');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('create');
  const [selectedTarifa, setSelectedTarifa] = useState(null);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '',
    detalle: '',
    precio_por_m3: '',
    limite_min_m3: '',
    limite_max_m3: '',
    tipo_tarifa: '',
    activo: true
  });

  // 🔑 PERMISOS DEL USUARIO ACTUAL
  const [permissions, setPermissions] = useState({
    canCreate: false,
    canRead: false,
    canUpdate: false,
    canDelete: false,
    canToggleStatus: false
  });

  // 🔑 Cargar permisos al montar el componente
  useEffect(() => {
    loadUserPermissions();
  }, []);

  const loadUserPermissions = () => {
    const canCreate = authService.hasPermission('tarifas', 'crear') || 
                     authService.hasPermission('tarifas', 'operaciones crud');
  
    const canUpdate = authService.hasPermission('tarifas', 'actualizar') || 
                     authService.hasPermission('tarifas', 'operaciones crud');
    
    const canDelete = authService.hasPermission('tarifas', 'eliminar') || 
                     authService.hasPermission('tarifas', 'operaciones crud');

    const canRead = authService.hasPermission('tarifas', 'lectura') ||
               canCreate || canUpdate || canDelete ||
               authService.hasPermission('tarifas', 'operaciones crud');

    const canToggleStatus = canUpdate;

    setPermissions({
      canCreate,
      canRead,
      canUpdate,
      canDelete,
      canToggleStatus
    });

    console.log('🔐 Permisos del usuario en módulo Tarifas:', {
      canCreate,
      canRead,
      canUpdate,
      canDelete
    });
  };

  // Fetch tarifas
  const fetchTarifas = useCallback(async () => {
    if (!permissions.canRead) {
      setError('No tienes permiso para ver tarifas');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const result = await tarifasService.getTarifas({
        search: debouncedSearchTerm
      });

      if (result.success) {
        setTarifas(result.data);
        console.log('✅ Tarifas cargadas:', result.data.length);
      } else {
        setError(result.message);
        console.error('Error al cargar tarifas:', result.message);
      }
    } catch (err) {
      setError('Error al cargar tarifas desde el servidor');
      console.error('Error en fetchTarifas:', err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearchTerm, permissions.canRead]);

  useEffect(() => {
    if (permissions.canRead) {
      console.log('🔄 Componente montado, cargando tarifas...');
      fetchTarifas();
    }
  }, [fetchTarifas, permissions.canRead]);

  useEffect(() => {
    if (permissions.canRead) {
      fetchTarifas();
    }
  }, [debouncedSearchTerm, fetchTarifas, permissions.canRead]);

  // 🔄 Cambiar el orden de clasificación
  const toggleSortOrder = () => {
    setSortOrder(prevOrder => prevOrder === 'asc' ? 'desc' : 'asc');
  };

  // 🎯 Filtrar y ordenar tarifas
  const filteredTarifas = tarifas
    .filter(tarifa => {
      const matchesSearch = 
        tarifa.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (tarifa.detalle && tarifa.detalle.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (tarifa.tipo_tarifa && tarifa.tipo_tarifa.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesStatus = 
        filterStatus === 'all' || 
        (filterStatus === 'active' && tarifa.activo) ||
        (filterStatus === 'inactive' && !tarifa.activo);
      
      const matchesTipo = 
        filterTipo === 'all' || 
        tarifa.tipo_tarifa === filterTipo;
      
      return matchesSearch && matchesStatus && matchesTipo;
    })
    .sort((a, b) => {
      const nameA = a.nombre.toLowerCase();
      const nameB = b.nombre.toLowerCase();
      
      if (sortOrder === 'asc') {
        return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
      } else {
        return nameB.localeCompare(nameA, 'es', { sensitivity: 'base' });
      }
    });

  // Obtener tipos únicos para el filtro
  const tiposTarifa = [...new Set(tarifas.map(t => t.tipo_tarifa).filter(Boolean))];

  const openModal = (type, tarifa = null) => {
    if (type === 'create' && !permissions.canCreate) {
      alert('❌ No tienes permiso para crear tarifas');
      return;
    }
    if (type === 'edit' && !permissions.canUpdate) {
      alert('❌ No tienes permiso para editar tarifas');
      return;
    }

    setModalType(type);
    setSelectedTarifa(tarifa);
    setError(null);
    
    if (type === 'create') {
      setFormData({
        nombre: '',
        detalle: '',
        precio_por_m3: '',
        limite_min_m3: '',
        limite_max_m3: '',
        tipo_tarifa: '',
        activo: true
      });
    } else if (type === 'edit' && tarifa) {
      setFormData({
        nombre: tarifa.nombre,
        detalle: tarifa.detalle || '',
        precio_por_m3: tarifa.precio_por_m3,
        limite_min_m3: tarifa.limite_min_m3,
        limite_max_m3: tarifa.limite_max_m3 || '',
        tipo_tarifa: tarifa.tipo_tarifa,
        activo: tarifa.activo
      });
    }
    
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedTarifa(null);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      let result;

      if (modalType === 'create') {
        if (!permissions.canCreate) {
          setError('No tienes permiso para crear tarifas');
          return;
        }

        result = await tarifasService.createTarifa(formData);

        if (result.success) {
          await fetchTarifas();
          closeModal();
          alert('✅ Tarifa creada exitosamente');
        } else {
          setError(result.message || 'Error al crear la tarifa');
        }

      } else if (modalType === 'edit') {
        if (!permissions.canUpdate) {
          setError('No tienes permiso para editar tarifas');
          return;
        }

        result = await tarifasService.updateTarifa(selectedTarifa.id_tarifa, formData);
        
        if (result.success) {
          alert('✅ Cambios guardados correctamente');
          await fetchTarifas();
          closeModal();
        } else {
          setError(result.message || 'Error al actualizar tarifa');
        }
      }

    } catch (error) {
      console.error('Error al guardar tarifa:', error);
      setError(error.message || 'Error al guardar tarifa');
    }
  };

  const handleDelete = async (tarifaId) => {
    if (!permissions.canDelete) {
      alert('❌ No tienes permiso para eliminar tarifas');
      return;
    }

    if (window.confirm('¿Estás seguro de que deseas eliminar esta tarifa?')) {
      try {
        const result = await tarifasService.deleteTarifa(tarifaId);
        
        if (result.success) {
          alert(result.message);
          await fetchTarifas();
        } else {
          alert('Error: ' + result.message);
        }
      } catch (error) {
        alert('Error al eliminar tarifa: ' + error.message);
      }
    }
  };

  const toggleTarifaStatus = async (tarifaId) => {
    if (!permissions.canToggleStatus) {
      alert('❌ No tienes permiso para cambiar el estado de tarifas');
      return;
    }

    try {
      const result = await tarifasService.toggleTarifaStatus(tarifaId);
      
      if (result.success) {
        await fetchTarifas();
      } else {
        alert('Error: ' + result.message);
      }
    } catch (error) {
      alert('Error al cambiar estado de la tarifa');
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  if (!permissions.canRead) {
    return (
      <div className="section-placeholder">
        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
        <h2>Acceso Denegado</h2>
        <p>No tienes permiso para acceder al módulo de tarifas.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="section-placeholder">
        <RefreshCw className="w-16 h-16 mx-auto mb-4 text-gray-400 animate-spin" />
        <h2>Cargando Tarifas</h2>
        <p>Por favor espera mientras cargamos la información...</p>
      </div>
    );
  }

  if (error && tarifas.length === 0) {
    return (
      <div className="section-placeholder">
        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
        <h2>Error al Cargar Tarifas</h2>
        <p>{error}</p>
        <button onClick={fetchTarifas} className="btn-primary mt-4">
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
          <DollarSign className="w-6 h-6 text-blue-600" />
          <h2>Gestión de Tarifas</h2>
        </div>
        {permissions.canCreate && (
          <button 
            className="btn-primary"
            onClick={() => openModal('create')}
          >
            <Plus className="w-4 h-4 mr-2" />
            Nueva Tarifa
          </button>
        )}
      </div>

      <div className="filters-section">

      {/* IZQUIERDA — Barra de búsqueda */}
      <div className="search-container">
        <Search className="search-icon" />
        <input
          type="text"
          placeholder="Buscar tarifas..."
          className="search-input"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* DERECHA — Filtros y acciones */}
      <div className="filters-right">

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

        {/* 🏷️ Tipo de tarifa */}
        <select 
          className="filter-select"
          value={filterTipo}
          onChange={(e) => setFilterTipo(e.target.value)}
        >
          <option value="all">Todos los tipos</option>
          {tiposTarifa.map(tipo => (
            <option key={tipo} value={tipo}>{tipo}</option>
          ))}
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
          onClick={fetchTarifas}
          title="Recargar lista"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

      </div>
    </div>

      {/* Tarjetas de estadísticas */}
      <div className="users-stats">
        <div className="stat-item">
          <DollarSign className="stat-icon text-blue-600" />
          <div>
            <p className="stat-label">Total Tarifas</p>
            <p className="stat-value">{tarifas.length}</p>
          </div>
        </div>
        <div className="stat-item">
          <CheckCircle className="stat-icon text-green-600" />
          <div>
            <p className="stat-label">Tarifas Activas</p>
            <p className="stat-value">{tarifas.filter(t => t.activo).length}</p>
          </div>
        </div>
        <div className="stat-item">
          <XCircle className="stat-icon text-red-600" />
          <div>
            <p className="stat-label">Tarifas Inactivas</p>
            <p className="stat-value">{tarifas.filter(t => !t.activo).length}</p>
          </div>
        </div>
      </div>

      <div className="users-grid">
        {filteredTarifas.map(tarifa => (
          <div key={tarifa.id_tarifa} className={`user-card ${!tarifa.activo ? 'inactive' : ''}`}>
            <div className="user-card-header">
              <div className="user-info">
                <div className="user-icon">
                  <DollarSign className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="user-name">{tarifa.nombre}</h3>
                  <div className="flex gap-2 items-center mt-1">
                    <span className={`status-badge ${tarifa.activo ? 'active' : 'inactive'}`}>
                      {tarifa.activo ? (
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
                    {tarifa.tipo_tarifa && (
                      <span className="status-badge" style={{backgroundColor: '#f0f9ff', color: '#0369a1'}}>
                        <Tag className="w-3 h-3" />
                        {tarifa.tipo_tarifa}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="user-actions">
                <button 
                  className="action-btn view"
                  onClick={() => openModal('view', tarifa)}
                  title="Ver detalles"
                >
                  <Eye className="w-4 h-4 icon-view" />
                </button>

                {permissions.canUpdate && (
                  <button 
                    className="action-btn edit"
                    onClick={() => openModal('edit', tarifa)}
                    title="Editar tarifa"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                )}

                {permissions.canToggleStatus && (
                  <button 
                    className="action-btn toggle"
                    onClick={() => toggleTarifaStatus(tarifa.id_tarifa)}
                    title={tarifa.activo ? 'Desactivar' : 'Activar'}
                  >
                    {tarifa.activo ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                  </button>
                )}

                {permissions.canDelete && (
                  <button 
                    className="action-btn delete"
                    onClick={() => handleDelete(tarifa.id_tarifa)}
                    title="Eliminar tarifa"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="user-card-body">
              <p className="user-description flex items-center gap-2 text-gray-700 mb-2">
                <FileText className="w-4 h-4 text-gray-400" />
                {tarifa.detalle?.trim() ? tarifa.detalle : 'Sin descripción'}
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">Precio/m³ : </span>
                  <span className="font-semibold ml-1">{formatCurrency(tarifa.precio_por_m3)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Rango: </span>
                  <span className="font-semibold ml-1">
                    {tarifa.limite_min_m3} - {tarifa.limite_max_m3 || '∞'} m³
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredTarifas.length === 0 && (
        <div className="empty-state">
          <Receipt className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3>No se encontraron tarifas</h3>
          <p>No hay tarifas que coincidan con los criterios de búsqueda.</p>
        </div>
      )}

      {/* MODALES */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>
                {modalType === 'create' && 'Crear Nueva Tarifa'}
                {modalType === 'edit' && 'Editar Tarifa'}
                {modalType === 'view' && 'Detalles de la Tarifa'}
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

              {modalType === 'view' && selectedTarifa && (
                <div className="user-details">
                  <div className="detail-group">
                    <label>ID Tarifa:</label>
                    <p>{selectedTarifa.id_tarifa}</p>
                  </div>
                  <div className="detail-group">
                    <label>Nombre:</label>
                    <p>{selectedTarifa.nombre}</p>
                  </div>
                  {selectedTarifa.detalle && (
                    <div className="detail-group">
                      <label>Detalle:</label>
                      <p>{selectedTarifa.detalle}</p>
                    </div>
                  )}
                  <div className="detail-group">
                    <label>Tipo de Tarifa:</label>
                    <p>{selectedTarifa.tipo_tarifa}</p>
                  </div>
                  <div className="detail-group">
                    <label>Precio por m³:</label>
                    <p>{formatCurrency(selectedTarifa.precio_por_m3)}</p>
                  </div>
                  <div className="detail-group">
                    <label>Límite Mínimo:</label>
                    <p>{selectedTarifa.limite_min_m3} m³</p>
                  </div>
                  <div className="detail-group">
                    <label>Límite Máximo:</label>
                    <p>{selectedTarifa.limite_max_m3 || 'Sin límite'} {selectedTarifa.limite_max_m3 && 'm³'}</p>
                  </div>
                  <div className="detail-group">
                    <label>Fecha de Creación:</label>
                    <p>{new Date(selectedTarifa.fecha_creacion).toLocaleDateString('es-EC')}</p>
                  </div>
                  <div className="detail-group">
                    <label>Estado:</label>
                    <span className={`status-badge ${selectedTarifa.activo ? 'active' : 'inactive'}`}>
                      {selectedTarifa.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                </div>
              )}

              {(modalType === 'create' || modalType === 'edit') && (
                <form onSubmit={handleSubmit} className="user-form">
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Nombre de la Tarifa *</label>
                      <input
                        type="text"
                        required
                        minLength="3"
                        value={formData.nombre}
                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                        placeholder="Ej: Tarifa Residencial"
                      />
                    </div>

                    <div className="form-group">
                      <label>Tipo de Tarifa *</label>
                      {modalType === 'create' ? (
                        <input
                          type="text"
                          required
                          value={formData.tipo_tarifa}
                          onChange={(e) => setFormData({ ...formData, tipo_tarifa: e.target.value })}
                          placeholder="Ej: Residencial, Comercial"
                          list="tipos-tarifa"
                        />
                      ) : (
                        <select
                          required
                          value={formData.tipo_tarifa}
                          onChange={(e) => setFormData({ ...formData, tipo_tarifa: e.target.value })}
                        >
                          <option value="">Seleccionar tipo</option>
                          {tiposTarifa.map(tipo => (
                            <option key={tipo} value={tipo}>{tipo}</option>
                          ))}
                        </select>
                      )}
                      <datalist id="tipos-tarifa">
                        {tiposTarifa.map(tipo => (
                          <option key={tipo} value={tipo} />
                        ))}
                      </datalist>
                    </div>

                    <div className="form-group form-group-full">
                      <label>Detalle</label>
                      <textarea
                        value={formData.detalle}
                        onChange={(e) => setFormData({ ...formData, detalle: e.target.value })}
                        placeholder="Descripción de la tarifa (opcional)"
                        rows="3"
                      />
                    </div>

                    <div className="form-group">
                      <label>Precio por m³ ($)*</label>
                      <input
                        type="number"
                        required
                        step="0.01"
                        min="0"
                        value={formData.precio_por_m3}
                        onChange={(e) => setFormData({ ...formData, precio_por_m3: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>

                    <div className="form-group">
                      <label>Límite Mínimo (m³) *</label>
                      <input
                        type="number"
                        required
                        step="0.01"
                        min="0"
                        value={formData.limite_min_m3}
                        onChange={(e) => setFormData({ ...formData, limite_min_m3: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>

                    <div className="form-group">
                      <label>Límite Máximo (m³)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.limite_max_m3}
                        onChange={(e) => setFormData({ ...formData, limite_max_m3: e.target.value })}
                        placeholder="Dejar vacío si no tiene límite"
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
                      {modalType === 'create' ? 'Crear Tarifa' : 'Guardar Cambios'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TarifasSection;