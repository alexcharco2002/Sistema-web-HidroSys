// src/components/ServiciosSection.js
// MÓDULO DE SERVICIOS ADICIONALES - Con control de permisos granular y ordenamiento mejorado

import React, { useState, useEffect, useCallback } from 'react';
import serviciosService from '../services/serviciosServices';
import authService from '../services/authServices';

import { 
  Wrench, Plus, Search, Edit, Trash2, Eye, CheckCircle, XCircle,
  X, Save, RefreshCw, AlertCircle, Package, ArrowUpDown, FileText, DollarSign, Briefcase
} from 'lucide-react';

const ServiciosSection = () => {
  const [servicios, setServicios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm] = useState(searchTerm);
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortOrder, setSortOrder] = useState('asc');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('create');
  const [selectedServicio, setSelectedServicio] = useState(null);
  const [error, setError] = useState(null);
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
    canToggleStatus: false
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

    setPermissions({
      canCreate,
      canRead,
      canUpdate,
      canDelete,
      canToggleStatus
    });

    console.log('🔐 Permisos del usuario en módulo Servicios:', {
      canCreate,
      canRead,
      canUpdate,
      canDelete
    });
  };

  // Fetch servicios
  const fetchServicios = useCallback(async () => {
    if (!permissions.canRead) {
      setError('No tienes permiso para ver servicios');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const result = await serviciosService.getServicios({
        search: debouncedSearchTerm
      });

      if (result.success) {
        setServicios(result.data);
        console.log('✅ Servicios cargados:', result.data.length);
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
  }, [debouncedSearchTerm, permissions.canRead]);

  useEffect(() => {
    if (permissions.canRead) {
      console.log('🔄 Componente montado, cargando servicios...');
      fetchServicios();
    }
  }, [fetchServicios, permissions.canRead]);

  useEffect(() => {
    if (permissions.canRead) {
      fetchServicios();
    }
  }, [debouncedSearchTerm, fetchServicios, permissions.canRead]);

  // 🔄 Cambiar el orden de clasificación
  const toggleSortOrder = () => {
    setSortOrder(prevOrder => prevOrder === 'asc' ? 'desc' : 'asc');
  };

  // 🎯 Filtrar y ordenar servicios
  const filteredServicios = servicios
    .filter(servicio => {
      const matchesSearch = 
        servicio.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (servicio.descripcion && servicio.descripcion.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesStatus = 
        filterStatus === 'all' || 
        (filterStatus === 'active' && servicio.activo) ||
        (filterStatus === 'inactive' && !servicio.activo);
      
      return matchesSearch && matchesStatus;
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

        result = await serviciosService.updateServicio(selectedServicio.id_servicio, formData);
        
        if (result.success) {
          alert('✅ Cambios guardados correctamente');
          await fetchServicios();
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

  const handleDelete = async (servicioId) => {
    if (!permissions.canDelete) {
      alert('❌ No tienes permiso para eliminar servicios');
      return;
    }

    if (window.confirm('¿Estás seguro de que deseas eliminar este servicio?')) {
      try {
        const result = await serviciosService.deleteServicio(servicioId);
        
        if (result.success) {
          alert(result.message);
          await fetchServicios();
        } else {
          alert('Error: ' + result.message);
        }
      } catch (error) {
        alert('Error al eliminar servicio: ' + error.message);
      }
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

  return (
    <div className="users-section">
      <div className="section-header">
        <div className="section-title">
          <Briefcase   className="w-6 h-6 text-blue-600" />
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
            onClick={fetchServicios}
            title="Recargar lista"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tarjetas de estadísticas */}
      <div className="users-stats">
        <div className="stat-item">
          <Briefcase className="stat-icon text-blue-600" />
          <div>
            <p className="stat-label">Total Servicios</p>
            <p className="stat-value">{servicios.length}</p>
          </div>
        </div>
        <div className="stat-item">
          <CheckCircle className="stat-icon text-green-600" />
          <div>
            <p className="stat-label">Servicios Activos</p>
            <p className="stat-value">{servicios.filter(s => s.activo).length}</p>
          </div>
        </div>
        <div className="stat-item">
          <XCircle className="stat-icon text-red-600" />
          <div>
            <p className="stat-label">Servicios Inactivos</p>
            <p className="stat-value">{servicios.filter(s => !s.activo).length}</p>
          </div>
        </div>
      </div>

      <div className="users-grid">
        {filteredServicios.map(servicio => (
          <div key={servicio.id_servicio} className={`user-card ${!servicio.activo ? 'inactive' : ''}`}>
            <div className="user-card-header">
              <div className="user-info">
                <div className="user-icon">
                  <Wrench className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="user-name">{servicio.nombre}</h3>
                  <div className="flex gap-2 items-center mt-1">
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
                  </div>
                </div>
              </div>
              
              <div className="user-actions">
                <button 
                  className="action-btn view"
                  onClick={() => openModal('view', servicio)}
                  title="Ver detalles"
                >
                  <Eye className="w-4 h-4 icon-view" />
                </button>

                {permissions.canUpdate && (
                  <button 
                    className="action-btn edit"
                    onClick={() => openModal('edit', servicio)}
                    title="Editar servicio"
                  >
                    <Edit className="w-4 h-4" />
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
              <p className="user-description flex items-center gap-2 text-gray-700 mb-2">
                <FileText className="w-4 h-4 text-gray-400" />
                {servicio.descripcion?.trim() ? servicio.descripcion : 'Sin descripción'}
              </p>
              <div className="text-sm">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  <span className="text-gray-500">Precio Base: </span>
                  <span className="font-semibold text-green-700">{formatCurrency(servicio.precio_base)}</span>
                </div>
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

      {/* MODALES */}
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
                    <label>Estado:</label>
                    <span className={`status-badge ${selectedServicio.activo ? 'active' : 'inactive'}`}>
                      {selectedServicio.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                </div>
              )}

              {(modalType === 'create' || modalType === 'edit') && (
                <form onSubmit={handleSubmit} className="user-form">
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
    </div>
  );
};

export default ServiciosSection;
