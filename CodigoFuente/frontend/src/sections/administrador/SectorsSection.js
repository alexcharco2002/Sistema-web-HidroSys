// src/sections/SectorsSection.js
// MÓDULO DE SECTORES - Con control de permisos granular y ordenamiento mejorado
import React, { useState, useEffect, useCallback } from 'react';
import './SectorsSection.css';
import sectorsService from '../../services/sectorServices';
import authService from '../../services/authServices';

import { 
  MapPin, Plus, Search, Edit, Trash2, Eye, CheckCircle, XCircle,
  X, Save, RefreshCw, AlertCircle, ArrowUpDown, FileText, Layers
} from 'lucide-react';

const SectorsSection = () => {
  const [sectors, setSectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm] = useState(searchTerm);
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
    } else {
      setError(result.message);
      console.error('Error al cargar sectores:', result.message);
    }
  } catch (err) {
    setError('Error al cargar sectores desde el servidor');
    console.error('Error al cargar sectores desde el servidor:', err);
  } finally {
    setLoading(false);
  }
}, [debouncedSearchTerm, permissions.canRead]);

// ✅ SOLO UN useEffect - se ejecuta al montar y cuando cambian los permisos
useEffect(() => {
  if (permissions.canRead) {
    fetchSectors();
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [permissions.canRead]); // Solo cuando cambian permisos, NO fetchSectors

// ✅ Separado: solo para búsqueda con debounce
useEffect(() => {
  if (!permissions.canRead) return;
  
  const timeoutId = setTimeout(() => {
    fetchSectors();
  }, 300); // 300ms de debounce

  return () => clearTimeout(timeoutId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [debouncedSearchTerm]); // Solo cuando cambia el término de búsqueda


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
      alert("❌ No tienes permiso para eliminar sectores");
      return;
    }

    const confirmed = window.confirm("¿Estás seguro de que deseas eliminar este sector?");
    if (!confirmed) return;

    try {
      const result = await sectorsService.deleteSector(sectorId);

      if (result.success) {
        alert("✅ Sector Eliminado: " + result.message);
        await fetchSectors();
      } else {
        alert("❌ Error: " + result.message);
      }
    } catch (error) {
      alert("❌ Error inesperado al eliminar sector: " + error.message);
    }
  };

  const toggleSectorStatus = async (sectorId) => {
    if (!permissions.canToggleStatus) {
      alert("❌ No tienes permiso para cambiar el estado de sectores");
      return;
    }

    const sector = sectors.find(s => s.id_sector === sectorId);
    const actionText = sector.activo ? "desactivar" : "activar";

    const confirmed = window.confirm(`¿Estás seguro de que deseas ${actionText} este sector?`);
    if (!confirmed) return;

    try {
      const result = await sectorsService.toggleSectorStatus(sectorId);

      if (result.success) {
        alert("✅ Estado actualizado: " + (result.message || "El sector se actualizó correctamente"));
        await fetchSectors();
      } else {
        alert("❌ Error: " + result.message);
      }
    } catch (error) {
      alert("❌ Error inesperado al cambiar estado del sector: " + error.message);
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
    <>
    <div className="users-section">
      <div className="section-header">

        <div className="section-title">
          <Layers className="w-7 h-7 text-blue-600" />
          <div>
            <h2>Gestión de Sectores</h2>
            <p className="section-subtitle">
              Gestiona la información de los sectores
            </p>
          </div>
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

      {/* ==================== ESTADÍSTICAS DE SECTORES ==================== */}
      <div className="periodo-stats-container">

        {/* Header */}
        <div className="periodo-stats-header">
          <MapPin className="w-5 h-5 text-blue-600 mr-2" />
          <h3>Resumen de Sectores</h3>
        </div>

        {/* Cards */}
        <div className="users-stats">

          {/* 📍 Total sectores */}
          <div className="stat-item">
            <MapPin className="stat-icon text-blue-600" />
            <div>
              <p className="stat-label">Total Sectores</p>
              <p className="stat-value">{sectors.length}</p>
            </div>
          </div>

          {/* ✅ Sectores activos */}
          <div className="stat-item">
            <CheckCircle className="stat-icon text-green-600" />
            <div>
              <p className="stat-label">Sectores Activos</p>
              <p className="stat-value">
                {sectors.filter(s => s.activo).length}
              </p>
            </div>
          </div>

          {/* ❌ Sectores inactivos */}
          <div className="stat-item">
            <XCircle className="stat-icon text-red-600" />
            <div>
              <p className="stat-label">Sectores Inactivos</p>
              <p className="stat-value">
                {sectors.filter(s => !s.activo).length}
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* ==================== SECCION DE FILTRO Y BUSQUEDA ==================== */}
      <div className="filters-section">
        {/* IZQUIERDA — Barra de búsqueda */}
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

          {/* 🔄 Recargar */}
          <button 
            className="btn-secondary"
            onClick={fetchSectors}
            title="Recargar lista"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

        </div>
      </div>


      <div className="sectors-grid">
        {filteredSectors.map(sector => (
          <div key={sector.id_sector} className={`user-card ${!sector.activo ? 'inactive' : ''}`}>
            <div className="user-card-header">
              <div className="user-info">
                <div className="sector-icon">
                  <MapPin className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="user-name">{sector.nombre_sector}</h3>
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
              
              <div className="user-actions">
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
            <div className="user-card-body">
              <p className="user-description flex items-center gap-2 text-gray-700">
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
                      <X className="w-4 h-4 mr-2" />
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

  </>
  );
};

export default SectorsSection;
