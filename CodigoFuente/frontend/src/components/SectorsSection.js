// src/components/SectorsSection.js
// MÓDULO DE SECTORES - Con control de permisos granular y ordenamiento mejorado
import React, { useState, useEffect, useCallback } from 'react';
import './styleSectors.css';
import sectorsService from '../services/sectorServices';
import authService from '../services/authServices';

import { 
  MapPin, Plus, Search, Edit, Trash2, Eye, CheckCircle, XCircle,
  X, Save, RefreshCw, AlertCircle, Map, ArrowUpDown, FileText 
} from 'lucide-react';

const SectorsSection = () => {
  const [sectors, setSectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' o 'desc'
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('create');
  const [selectedSector, setSelectedSector] = useState(null);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    nombre_sector: '',
    descripcion: '',
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
    const canCreate = authService.hasPermission('sectores', 'crear') || 
                     authService.hasPermission('sectores', 'operaciones crud');
  
    const canUpdate = authService.hasPermission('sectores', 'actualizar') || 
                     authService.hasPermission('sectores', 'operaciones crud');
    
    const canDelete = authService.hasPermission('sectores', 'eliminar') || 
                     authService.hasPermission('sectores', 'operaciones crud');

    const canRead = authService.hasPermission('sectores', 'lectura') ||
               canCreate || canUpdate || canDelete ||
               authService.hasPermission('sectores', 'operaciones crud');

    const canToggleStatus = canUpdate;

    setPermissions({
      canCreate,
      canRead,
      canUpdate,
      canDelete,
      canToggleStatus
    });

    console.log('🔐 Permisos del usuario en módulo Sectores:', {
      canCreate,
      canRead,
      canUpdate,
      canDelete
    });
  };

  // Fetch sectors
  const fetchSectors = useCallback(async () => {
    if (!permissions.canRead) {
      setError('No tienes permiso para ver sectores');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const result = await sectorsService.getSectors({
        search: debouncedSearchTerm
      });

      if (result.success) {
        setSectors(result.data);
        console.log('✅ Sectores cargados:', result.data.length);
      } else {
        setError(result.message);
        console.error('Error al cargar sectores:', result.message);
      }
    } catch (err) {
      setError('Error al cargar sectores desde el servidor');
      console.error('Error en fetchSectors:', err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearchTerm, permissions.canRead]);

  useEffect(() => {
    if (permissions.canRead) {
      console.log('🔄 Componente montado, cargando sectores...');
      fetchSectors();
    }
  }, [fetchSectors, permissions.canRead]);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 700);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    if (permissions.canRead) {
      fetchSectors();
    }
  }, [debouncedSearchTerm, fetchSectors, permissions.canRead]);

  // 🔄 Cambiar el orden de clasificación (ascendente/descendente)
  const toggleSortOrder = () => {
    setSortOrder(prevOrder => prevOrder === 'asc' ? 'desc' : 'asc');
  };

  // 🎯 Filtrar y ordenar sectores
  const filteredSectors = sectors
    .filter(sector => {
      const matchesSearch = 
        sector.nombre_sector.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (sector.descripcion && sector.descripcion.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesStatus = 
        filterStatus === 'all' || 
        (filterStatus === 'active' && sector.activo) ||
        (filterStatus === 'inactive' && !sector.activo);
      
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      // Ordenar alfabéticamente por nombre del sector
      const nameA = a.nombre_sector.toLowerCase();
      const nameB = b.nombre_sector.toLowerCase();
      
      // Aplicar orden ascendente o descendente
      if (sortOrder === 'asc') {
        return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
      } else {
        return nameB.localeCompare(nameA, 'es', { sensitivity: 'base' });
      }
    });

  const openModal = (type, sector = null) => {
    if (type === 'create' && !permissions.canCreate) {
      alert('❌ No tienes permiso para crear sectores');
      return;
    }
    if (type === 'edit' && !permissions.canUpdate) {
      alert('❌ No tienes permiso para editar sectores');
      return;
    }

    setModalType(type);
    setSelectedSector(sector);
    setError(null);
    
    if (type === 'create') {
      setFormData({
        nombre_sector: '',
        descripcion: '',
        activo: true
      });
    } else if (type === 'edit' && sector) {
      setFormData({
        nombre_sector: sector.nombre_sector,
        descripcion: sector.descripcion || '',
        activo: sector.activo
      });
    }
    
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedSector(null);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      let result;

      if (modalType === 'create') {
        if (!permissions.canCreate) {
          setError('No tienes permiso para crear sectores');
          return;
        }

        result = await sectorsService.createSector(formData);

        if (result.success) {
          await fetchSectors();
          closeModal();
          alert('✅ Sector creado exitosamente');
        } else {
          setError(result.message || 'Error al crear el sector');
        }

      } else if (modalType === 'edit') {
        if (!permissions.canUpdate) {
          setError('No tienes permiso para editar sectores');
          return;
        }

        result = await sectorsService.updateSector(selectedSector.id_sector, formData);
        
        if (result.success) {
          alert('✅ Cambios guardados correctamente');
          await fetchSectors();
          closeModal();
        } else {
          setError(result.message || 'Error al actualizar sector');
        }
      }

    } catch (error) {
      console.error('Error al guardar sector:', error);
      setError(error.message || 'Error al guardar sector');
    }
  };

  const handleDelete = async (sectorId) => {
    if (!permissions.canDelete) {
      alert('❌ No tienes permiso para eliminar sectores');
      return;
    }

    if (window.confirm('¿Estás seguro de que deseas eliminar este sector?')) {
      try {
        const result = await sectorsService.deleteSector(sectorId);
        
        if (result.success) {
          alert(result.message);
          await fetchSectors();
        } else {
          alert('Error: ' + result.message);
        }
      } catch (error) {
        alert('Error al eliminar sector: ' + error.message);
      }
    }
  };

  const toggleSectorStatus = async (sectorId) => {
    if (!permissions.canToggleStatus) {
      alert('❌ No tienes permiso para cambiar el estado de sectores');
      return;
    }

    try {
      const result = await sectorsService.toggleSectorStatus(sectorId);
      
      if (result.success) {
        await fetchSectors();
      } else {
        alert('Error: ' + result.message);
      }
    } catch (error) {
      alert('Error al cambiar estado del sector');
    }
  };

  if (!permissions.canRead) {
    return (
      <div className="section-placeholder">
        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
        <h2>Acceso Denegado</h2>
        <p>No tienes permiso para acceder al módulo de sectores.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="section-placeholder">
        <RefreshCw className="w-16 h-16 mx-auto mb-4 text-gray-400 animate-spin" />
        <h2>Cargando Sectores</h2>
        <p>Por favor espera mientras cargamos la información...</p>
      </div>
    );
  }

  if (error && sectors.length === 0) {
    return (
      <div className="section-placeholder">
        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
        <h2>Error al Cargar Sectores</h2>
        <p>{error}</p>
        <button onClick={fetchSectors} className="btn-primary mt-4">
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
          <Map className="w-6 h-6 text-blue-600" />
          <h2>Gestión de Sectores</h2>
        </div>
        {permissions.canCreate && (
          <button 
            className="btn-primary"
            onClick={() => openModal('create')}
          >
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Sector
          </button>
        )}
      </div>

      <div className="filters-section">
        <div className="search-container">
          <Search className="search-icon" />
          <input
            type="text"
            placeholder="Buscar sectores..."
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <select 
          className="filter-select"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="all">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>

        {/* 🆕 Botón de ordenamiento */}
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

        <button 
          className="btn-secondary"
          onClick={fetchSectors}
          title="Recargar lista"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Tarjetas de estadísticas */}
      <div className="users-stats">
        <div className="stat-item">
          <MapPin className="stat-icon text-blue-600" />
          <div>
            <p className="stat-label">Total Sectores</p>
            <p className="stat-value">{sectors.length}</p>
          </div>
        </div>
        <div className="stat-item">
          <CheckCircle className="stat-icon text-green-600" />
          <div>
            <p className="stat-label">Sectores Activos</p>
            <p className="stat-value">{sectors.filter(s => s.activo).length}</p>
          </div>
        </div>
        <div className="stat-item">
          <XCircle className="stat-icon text-red-600" />
          <div>
            <p className="stat-label">Sectores Inactivos</p>
            <p className="stat-value">{sectors.filter(s => !s.activo).length}</p>
          </div>
        </div>
      </div>

      <div className="sectors-grid">
        {filteredSectors.map(sector => (
          <div key={sector.id_sector} className={`sector-card ${!sector.activo ? 'inactive' : ''}`}>
            <div className="sector-card-header">
              <div className="sector-info">
                <div className="sector-icon">
                  <MapPin className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="sector-name">{sector.nombre_sector}</h3>
                  <span className={`status-badge ${sector.activo ? 'active' : 'inactive'}`}>
                    {sector.activo ? (
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
              
              <div className="sector-actions">
                <button 
                  className="action-btn view"
                  onClick={() => openModal('view', sector)}
                  title="Ver detalles"
                >
                  <Eye className="w-4 h-4 icon-view" />
                </button>

                {permissions.canUpdate && (
                  <button 
                    className="action-btn edit"
                    onClick={() => openModal('edit', sector)}
                    title="Editar sector"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                )}

                {permissions.canToggleStatus && (
                  <button 
                    className="action-btn toggle"
                    onClick={() => toggleSectorStatus(sector.id_sector)}
                    title={sector.activo ? 'Desactivar' : 'Activar'}
                  >
                    {sector.activo ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                  </button>
                )}

                {permissions.canDelete && (
                  <button 
                    className="action-btn delete"
                    onClick={() => handleDelete(sector.id_sector)}
                    title="Eliminar sector"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="sector-card-body">
              <p className="sector-description flex items-center gap-2 text-gray-700">
                <FileText className="w-4 h-4 text-gray-400" />
                {sector.descripcion?.trim() ? sector.descripcion : 'Ninguna'}
              </p>
            </div>
          </div>
        ))}
      </div>

      {filteredSectors.length === 0 && (
        <div className="empty-state">
          <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3>No se encontraron sectores</h3>
          <p>No hay sectores que coincidan con los criterios de búsqueda.</p>
        </div>
      )}

      {/* MODALES */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>
                {modalType === 'create' && 'Crear Nuevo Sector'}
                {modalType === 'edit' && 'Editar Sector'}
                {modalType === 'view' && 'Detalles del Sector'}
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

              {modalType === 'view' && selectedSector && (
                <div className="sector-details">
                  <div className="detail-group">
                    <label>ID Sector:</label>
                    <p>{selectedSector.id_sector}</p>
                  </div>
                  <div className="detail-group">
                    <label>Nombre del Sector:</label>
                    <p>{selectedSector.nombre_sector}</p>
                  </div>
                  {selectedSector.descripcion && (
                    <div className="detail-group">
                      <label>Descripción:</label>
                      <p>{selectedSector.descripcion}</p>
                    </div>
                  )}
                  <div className="detail-group">
                    <label>Estado:</label>
                    <span className={`status-badge ${selectedSector.activo ? 'active' : 'inactive'}`}>
                      {selectedSector.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                </div>
              )}

              {(modalType === 'create' || modalType === 'edit') && (
                <form onSubmit={handleSubmit} className="sector-form">
                  <div className="form-grid">
                    <div className="form-group form-group-full">
                      <label>Nombre del Sector *</label>
                      <input
                        type="text"
                        required
                        minLength="3"
                        value={formData.nombre_sector}
                        onChange={(e) => setFormData({ ...formData, nombre_sector: e.target.value })}
                        placeholder="Ej: Sector Norte, Zona Centro, etc."
                      />
                    </div>

                    <div className="form-group form-group-full">
                      <label>Descripción</label>
                      <textarea
                        value={formData.descripcion}
                        onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                        placeholder="Descripción del sector (opcional)"
                        rows="4"
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
                      {modalType === 'create' ? 'Crear Sector' : 'Guardar Cambios'}
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

export default SectorsSection;