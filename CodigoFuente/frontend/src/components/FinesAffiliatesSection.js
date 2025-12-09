// src/components/FinesAffiliatesSection.js  
// MÓDULO DE MULTAS DE AFILIADOS - VERSIÓN MEJORADA CON ESTILOS MODERNOS

import React, { useState, useEffect, useCallback } from 'react';
import './AffiliatesSection.css';
import finesAffiliatesServices from '../services/finesAffiliatesServices';
import affiliatesService from '../services/affiliatesServices';
import fineService from '../services/fineServices';
import authService from '../services/authServices';
import {
  DollarSign, Search, Edit, Eye, Calendar, X, Save,
  RefreshCw, AlertCircle, CheckCircle, XCircle, Ban,
  FileText, UserCheck, Clock, ArrowUpDown, Receipt
} from 'lucide-react';

const FinesAffiliatesSection = () => {
  // ==================== ESTADOS ====================
  const [multas, setMultas] = useState([]);
  const [affiliates, setAffiliates] = useState([]);
  const [tiposMulta, setTiposMulta] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('all');
  const [filterAfiliado, setFilterAfiliado] = useState('all');
  const [filterTipoMulta, setFilterTipoMulta] = useState('all');
  const [sortOrder, setSortOrder] = useState('desc');
  const [sortBy, setSortBy] = useState('fecha');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('create');
  const [selectedMulta, setSelectedMulta] = useState(null);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    id_usuario_afi: null,
    id_tipo_multa: null,
    monto: '',
    fecha_multa: '',
    observaciones: ''
  });

  const [pagoData, setPagoData] = useState({
    fecha_pago: '',
    observaciones: ''
  });

  const [permissions, setPermissions] = useState({
    canCreate: false,
    canRead: false,
    canUpdate: false,
    canDelete: false
  });

  // ==================== EFECTOS ====================
  useEffect(() => {
    loadUserPermissions();
    loadInitialData();
  }, []);

  

  // ==================== FUNCIONES DE PERMISOS ====================
  const loadUserPermissions = () => {
    const canCreate = authService.hasPermission('multas', 'crear') || authService.hasPermission('multas', 'crud');
    const canUpdate = authService.hasPermission('multas', 'actualizar') || authService.hasPermission('multas', 'crud');
    const canDelete = authService.hasPermission('multas', 'eliminar') || authService.hasPermission('multas', 'crud');
    const canRead = authService.hasPermission('multas', 'lectura') || canCreate || canUpdate || canDelete || authService.hasPermission('multas', 'crud');

    setPermissions({ canCreate, canRead, canUpdate, canDelete });
  };

  // ==================== FUNCIONES DE CARGA DE DATOS ====================
  const loadInitialData = async () => {
    try {
      const affiliatesResult = await affiliatesService.getAffiliates({ activo: true });
      if (affiliatesResult.success) {
        setAffiliates(affiliatesResult.data);
      }

      const tiposResult = await fineService.getTiposMulta({ es_vigente: true, activo: true });
      if (tiposResult.success) {
        setTiposMulta(tiposResult.data);
      }
    } catch (error) {
      console.error('Error cargando datos iniciales:', error);
    }
  };

  const fetchMultas = useCallback(async () => {
    if (!permissions.canRead) {
      setError('No tienes permiso para ver multas');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const filters = {};

      if (filterEstado !== 'all') {
        filters.estado = filterEstado;
      }

      if (filterAfiliado !== 'all') {
        filters.id_usuario_afi = parseInt(filterAfiliado);
      }

      const result = await finesAffiliatesServices.getMultas(filters);

      if (result.success) {
        setMultas(result.data);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Error al cargar multas desde el servidor');
    } finally {
      setLoading(false);
    }
  }, [filterEstado, filterAfiliado, permissions.canRead]);

  useEffect(() => {
    if (permissions.canRead) {
      fetchMultas();
      fetchStats();
    }
  }, [filterEstado, filterAfiliado, permissions.canRead, fetchMultas  ]);
  
  const fetchStats = async () => {
    try {
      const result = await finesAffiliatesServices.getMultasStats();
      if (result.success) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    }
  };

  // ==================== FUNCIONES DE FILTRADO Y ORDENAMIENTO ====================
  const filteredMultas = multas
    .filter(multa => {
      const matchesSearch = searchTerm === '' ||
        multa.id_multa_afi.toString().includes(searchTerm) ||
        (multa.usuario_afi && (
          multa.usuario_afi.nombres?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          multa.usuario_afi.apellidos?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          multa.usuario_afi.cedula?.includes(searchTerm)
        ));

      const matchesEstado = filterEstado === 'all' || multa.estado === filterEstado;
      const matchesAfiliado = filterAfiliado === 'all' || multa.id_usuario_afi === parseInt(filterAfiliado);
      const matchesTipoMulta = filterTipoMulta === 'all' || multa.id_tipo_multa === parseInt(filterTipoMulta);

      return matchesSearch && matchesEstado && matchesAfiliado && matchesTipoMulta;
    })
    .sort((a, b) => {
      let compareValue = 0;
      
      switch (sortBy) {
        case 'fecha':
          compareValue = new Date(a.fecha_multa) - new Date(b.fecha_multa);
          break;
        case 'monto':
          compareValue = parseFloat(a.monto) - parseFloat(b.monto);
          break;
        case 'afiliado':
          const nombreA = getAfiliadoNombre(a).toLowerCase();
          const nombreB = getAfiliadoNombre(b).toLowerCase();
          compareValue = nombreA.localeCompare(nombreB, 'es');
          break;
        default:
          compareValue = a.id_multa_afi - b.id_multa_afi;
      }
      
      return sortOrder === 'asc' ? compareValue : -compareValue;
    });

  const toggleSortOrder = () => {
    setSortOrder(prevOrder => prevOrder === 'asc' ? 'desc' : 'asc');
  };

  // ==================== FUNCIONES DE MODAL ====================
  const openModal = (type, multa = null) => {
    if (type === 'create' && !permissions.canCreate) {
      alert('❌ No tienes permiso para crear multas');
      return;
    }

    if ((type === 'edit' || type === 'pagar') && !permissions.canUpdate) {
      alert('❌ No tienes permiso para modificar multas');
      return;
    }

    if (type === 'anular' && !permissions.canDelete) {
      alert('❌ No tienes permiso para anular multas');
      return;
    }

    setModalType(type);
    setSelectedMulta(multa);
    setError(null);

    if (type === 'create') {
      setFormData({
        id_usuario_afi: affiliates.length > 0 ? affiliates[0].id_usuario_afi : null,
        id_tipo_multa: tiposMulta.length > 0 ? tiposMulta[0].id_tipo_multa : null,
        monto: tiposMulta.length > 0 ? tiposMulta[0].monto || '' : '',
        fecha_multa: new Date().toISOString().split('T')[0],
        observaciones: ''
      });
    } else if (type === 'edit' && multa) {
      setFormData({
        monto: multa.monto,
        observaciones: multa.observaciones || ''
      });
    } else if (type === 'pagar' && multa) {
      setPagoData({
        fecha_pago: new Date().toISOString().split('T')[0],
        observaciones: ''
      });
    }

    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedMulta(null);
    setError(null);
  };

  // ==================== FUNCIONES DE CRUD ====================
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      let result;

      if (modalType === 'create') {
        if (!permissions.canCreate) {
          setError('No tienes permiso para crear multas');
          return;
        }

        result = await finesAffiliatesServices.createMulta(formData);

        if (result.success) {
          alert(`✅ Multa creada exitosamente.\n\nID: ${result.data.id_multa_afi}\nMonto: $${result.data.monto}`);
          await fetchMultas();
          await fetchStats();
          closeModal();
        } else {
          setError(result.message || 'Error al crear multa');
        }

      } else if (modalType === 'edit') {
        if (!permissions.canUpdate) {
          setError('No tienes permiso para editar multas');
          return;
        }

        result = await finesAffiliatesServices.updateMulta(selectedMulta.id_multa_afi, formData);

        if (result.success) {
          alert('✅ Multa actualizada correctamente');
          await fetchMultas();
          await fetchStats();
          closeModal();
        } else {
          setError(result.message || 'Error al actualizar multa');
        }
      }

    } catch (error) {
      console.error('Error al guardar multa:', error);
      setError(error.message || 'Error al guardar multa');
    }
  };

  const handlePago = async (e) => {
    e.preventDefault();
    setError(null);

    if (!permissions.canUpdate) {
      setError('No tienes permiso para registrar pagos');
      return;
    }

    try {
      const result = await finesAffiliatesServices.registrarPago(selectedMulta.id_multa_afi, pagoData);

      if (result.success) {
        alert(`✅ Pago registrado exitosamente.\n\nMulta ID: ${selectedMulta.id_multa_afi}\nMonto: $${selectedMulta.monto}\nFecha: ${pagoData.fecha_pago}`);
        await fetchMultas();
        await fetchStats();
        closeModal();
      } else {
        setError(result.message || 'Error al registrar pago');
      }

    } catch (error) {
      console.error('Error al registrar pago:', error);
      setError(error.message || 'Error al registrar pago');
    }
  };

  const handleAnular = async () => {
    if (!permissions.canDelete) {
      alert('❌ No tienes permiso para anular multas');
      return;
    }

    const motivo = prompt('Ingresa el motivo de anulación (mínimo 10 caracteres):');

    if (!motivo || motivo.trim().length < 10) {
      alert('❌ El motivo debe tener al menos 10 caracteres');
      return;
    }

    try {
      const result = await finesAffiliatesServices.anularMulta(selectedMulta.id_multa_afi, motivo);

      if (result.success) {
        alert('✅ Multa anulada correctamente');
        await fetchMultas();
        await fetchStats();
        closeModal();
      } else {
        alert('❌ Error: ' + result.message);
      }

    } catch (error) {
      alert('❌ Error al anular multa: ' + error.message);
    }
  };

  // ==================== FUNCIONES AUXILIARES ====================
  const getEstadoBadge = (estado) => {
    const badges = {
      pendiente: { class: 'status-badge', style: { backgroundColor: '#fef3c7', color: '#d97706' }, icon: Clock, text: 'Pendiente' },
      pagada: { class: 'status-badge', style: { backgroundColor: '#d1fae5', color: '#059669' }, icon: CheckCircle, text: 'Pagada' },
      anulada: { class: 'status-badge', style: { backgroundColor: '#fee2e2', color: '#dc2626' }, icon: XCircle, text: 'Anulada' },
      exonerada: { class: 'status-badge', style: { backgroundColor: '#e0e7ff', color: '#4f46e5' }, icon: FileText, text: 'Exonerada' }
    };

    const badge = badges[estado] || badges.pendiente;
    const IconComponent = badge.icon;

    return (
      <span className={badge.class} style={badge.style}>
        <IconComponent className="w-3 h-3" />
        {badge.text}
      </span>
    );
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD'
    }).format(value || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-EC', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getAfiliadoNombre = (multa) => {
    if (multa.usuario_afi) {
      return `${multa.usuario_afi.nombres || ''} ${multa.usuario_afi.apellidos || ''}`.trim();
    }
    return 'N/A';
  };

  const getTipoMultaNombre = (multa) => {
    if (multa.tipo_multa) {
      return multa.tipo_multa.nombre_multa || 'N/A';
    }
    return 'N/A';
  };

  const limpiarFiltros = () => {
    setSearchTerm('');
    setFilterEstado('all');
    setFilterAfiliado('all');
    setFilterTipoMulta('all');
    setSortBy('fecha');
    setSortOrder('desc');
    fetchMultas();
  };

  // ==================== RENDERIZADO ====================
  if (!permissions.canRead) {
    return (
      <div className="section-placeholder">
        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
        <h2>Acceso Denegado</h2>
        <p>No tienes permiso para acceder al módulo de multas.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="section-placeholder">
        <RefreshCw className="w-16 h-16 mx-auto mb-4 text-gray-400 animate-spin" />
        <h2>Cargando Multas</h2>
        <p>Por favor espera mientras cargamos la información...</p>
      </div>
    );
  }

  return (
    <div className="users-section">
      {/* HEADER */}
      <div className="section-header">
        <div className="section-title">
          <DollarSign className="w-6 h-6 text-blue-600" />
          <h2>Gestión de Multas de Afiliados</h2>
        </div>
        {permissions.canCreate && (
          <button
            className="btn-primary"
            onClick={() => openModal('create')}
          >
            <DollarSign className="w-4 h-4 mr-2" />
            Nueva Multa
          </button>
        )}
      </div>

      {/* MENSAJES DE ERROR */}
      {error && (
        <div className="alert alert-error mb-4">
          <AlertCircle className="w-5 h-5 mr-2" />
          {error}
        </div>
      )}

      {/* ESTADÍSTICAS */}
      {stats && (
        <div className="users-stats">
          <div className="stat-item">
            <FileText className="stat-icon text-blue-600" />
            <div>
              <p className="stat-label">Total Multas</p>
              <p className="stat-value">{stats.total_multas || 0}</p>
            </div>
          </div>

          <div className="stat-item">
            <Clock className="stat-icon text-orange-600" />
            <div>
              <p className="stat-label">Pendientes</p>
              <p className="stat-value">{stats.pendientes || 0}</p>
              <span className="stat-detail">{formatCurrency(stats.monto_total_pendiente)}</span>
            </div>
          </div>

          <div className="stat-item">
            <CheckCircle className="stat-icon text-green-600" />
            <div>
              <p className="stat-label">Pagadas</p>
              <p className="stat-value">{stats.pagadas || 0}</p>
              <span className="stat-detail">{formatCurrency(stats.monto_total_pagado)}</span>
            </div>
          </div>

          <div className="stat-item">
            <XCircle className="stat-icon text-red-600" />
            <div>
              <p className="stat-label">Anuladas</p>
              <p className="stat-value">{stats.anuladas || 0}</p>
            </div>
          </div>
        </div>
      )}

      {/* FILTROS Y BÚSQUEDA */}
      <div className="filters-section">
        <div className="search-container">
          <Search className="search-icon" />
          <input
            type="text"
            placeholder="Buscar por ID, nombre, cédula..."
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filters-right">
          <select 
            className="filter-select"
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
          >
            <option value="all">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="pagada">Pagada</option>
            <option value="anulada">Anulada</option>
            <option value="exonerada">Exonerada</option>
          </select>

          <select 
            className="filter-select"
            value={filterAfiliado}
            onChange={(e) => setFilterAfiliado(e.target.value)}
          >
            <option value="all">Todos los afiliados</option>
            {affiliates.map(aff => (
              <option key={aff.id_usuario_afi} value={aff.id_usuario_afi}>
                {aff.usuario ? `${aff.usuario.nombres} ${aff.usuario.apellidos}` : `Afiliado ${aff.id_usuario_afi}`}
              </option>
            ))}
          </select>

          <select 
            className="filter-select"
            value={filterTipoMulta}
            onChange={(e) => setFilterTipoMulta(e.target.value)}
          >
            <option value="all">Todos los tipos</option>
            {tiposMulta.map(tipo => (
              <option key={tipo.id_tipo_multa} value={tipo.id_tipo_multa}>
                {tipo.nombre_multa}
              </option>
            ))}
          </select>

          <select 
            className="filter-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="fecha">Ordenar por Fecha</option>
            <option value="monto">Ordenar por Monto</option>
            <option value="afiliado">Ordenar por Afiliado</option>
          </select>

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
            onClick={limpiarFiltros}
            title="Limpiar filtros"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* GRID DE MULTAS */}
      {filteredMultas.length === 0 ? (
        <div className="empty-state">
          <Receipt className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3>No se encontraron multas</h3>
          <p>No hay multas que coincidan con los criterios de búsqueda.</p>
        </div>
      ) : (
        <div className="users-grid">
          {filteredMultas.map((multa) => (
            <div key={multa.id_multa_afi} className="user-card">
              <div className="user-card-header">
                <div className="user-info">
                  <div className="user-icon">
                    <DollarSign className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="user-name">#{multa.id_multa_afi} - {getTipoMultaNombre(multa)}</h3>
                    <div className="flex gap-2 items-center mt-1 flex-wrap">
                      {getEstadoBadge(multa.estado)}
                      <span className="status-badge" style={{backgroundColor: '#f0f9ff', color: '#0369a1'}}>
                        <UserCheck className="w-3 h-3" />
                        {getAfiliadoNombre(multa)}
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

                  {multa.estado === 'pendiente' && permissions.canUpdate && (
                    <>
                      <button
                        className="action-btn edit"
                        onClick={() => openModal('pagar', multa)}
                        title="Registrar pago"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>

                      <button
                        className="action-btn warning"
                        onClick={() => openModal('edit', multa)}
                        title="Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </>
                  )}

                  {multa.estado === 'pendiente' && permissions.canDelete && (
                    <button
                      className="action-btn delete"
                      onClick={() => openModal('anular', multa)}
                      title="Anular multa"
                    >
                      <Ban className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="user-card-body">
                <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                  <div>
                    <span className="text-gray-500">Monto:</span>
                    <span className="font-semibold ml-1 text-lg">{formatCurrency(multa.monto)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Cédula:</span>
                    <span className="font-semibold ml-1">{multa.usuario_afi?.cedula || 'N/A'}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 text-xs text-gray-500 border-t pt-2">
                  <Calendar className="w-3 h-3" />
                  <span>Multa: {formatDate(multa.fecha_multa)}</span>
                  {multa.fecha_pago && (
                    <>
                      <span className="mx-1">|</span>
                      <span>Pago: {formatDate(multa.fecha_pago)}</span>
                    </>
                  )}
                </div>

                {multa.observaciones && (
                  <p className="text-xs text-gray-600 mt-2 pt-2 border-t">
                    {multa.observaciones}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODALES */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>
                {modalType === 'create' && 'Nueva Multa'}
                {modalType === 'edit' && 'Editar Multa'}
                {modalType === 'pagar' && 'Registrar Pago'}
                {modalType === 'anular' && 'Anular Multa'}
                {modalType === 'view' && 'Detalles de Multa'}
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

              {/* MODAL VIEW */}
              {modalType === 'view' && selectedMulta && (
                <div className="user-details">
                  <div className="detail-group">
                    <label>ID Multa:</label>
                    <p>#{selectedMulta.id_multa_afi}</p>
                  </div>

                  <div className="detail-group">
                    <label>Afiliado:</label>
                    <p>{getAfiliadoNombre(selectedMulta)}</p>
                  </div>

                  <div className="detail-group">
                    <label>Cédula:</label>
                    <p>{selectedMulta.usuario_afi?.cedula || 'N/A'}</p>
                  </div>

                  <div className="detail-group">
                    <label>Tipo de Multa:</label>
                    <p>{getTipoMultaNombre(selectedMulta)}</p>
                  </div>

                  <div className="detail-group">
                    <label>Monto:</label>
                    <p className="text-lg font-bold">{formatCurrency(selectedMulta.monto)}</p>
                  </div>

                  <div className="detail-group">
                    <label>Fecha Multa:</label>
                    <p>{formatDate(selectedMulta.fecha_multa)}</p>
                  </div>

                  <div className="detail-group">
                    <label>Fecha Pago:</label>
                    <p>{formatDate(selectedMulta.fecha_pago)}</p>
                  </div>

                  <div className="detail-group">
                    <label>Estado:</label>
                    {getEstadoBadge(selectedMulta.estado)}
                  </div>

                  {selectedMulta.observaciones && (
                    <div className="detail-group" style={{ gridColumn: '1 / -1' }}>
                      <label>Observaciones:</label>
                      <p>{selectedMulta.observaciones}</p>
                    </div>
                  )}

                  {selectedMulta.estado === 'pendiente' && permissions.canUpdate && (
                    <div style={{ gridColumn: '1 / -1', marginTop: '1rem' }}>
                      <button
                        className="btn-primary w-full"
                        onClick={() => {
                          closeModal();
                          openModal('pagar', selectedMulta);
                        }}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Registrar Pago
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* MODAL CREATE */}
              {modalType === 'create' && (
                <form onSubmit={handleSubmit} className="user-form">
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Afiliado: *</label>
                      <select
                        value={formData.id_usuario_afi || ''}
                        onChange={(e) => setFormData({ ...formData, id_usuario_afi: parseInt(e.target.value) })}
                        required
                      >
                        <option value="">Seleccionar afiliado</option>
                        {affiliates.map(aff => (
                          <option key={aff.id_usuario_afi} value={aff.id_usuario_afi}>
                            {aff.usuario ? `${aff.usuario.nombres} ${aff.usuario.apellidos} - ${aff.usuario.cedula}` : `Afiliado ${aff.id_usuario_afi}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Tipo de Multa: *</label>
                      <select
                        value={formData.id_tipo_multa || ''}
                        onChange={(e) => {
                          const tipoId = parseInt(e.target.value);
                          const tipo = tiposMulta.find(t => t.id_tipo_multa === tipoId);
                          setFormData({
                            ...formData,
                            id_tipo_multa: tipoId,
                            monto: tipo?.monto || ''
                          });
                        }}
                        required
                      >
                        <option value="">Seleccionar tipo</option>
                        {tiposMulta.map(tipo => (
                          <option key={tipo.id_tipo_multa} value={tipo.id_tipo_multa}>
                            {tipo.nombre_multa} - {formatCurrency(tipo.monto)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Monto: *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.monto}
                        onChange={(e) => setFormData({ ...formData, monto: e.target.value })}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Fecha Multa:</label>
                      <input
                        type="date"
                        value={formData.fecha_multa}
                        onChange={(e) => setFormData({ ...formData, fecha_multa: e.target.value })}
                      />
                    </div>

                    <div className="form-group form-group-full">
                      <label>Observaciones:</label>
                      <textarea
                        value={formData.observaciones}
                        onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                        rows="3"
                        placeholder="Ingrese observaciones sobre la multa..."
                      />
                    </div>
                  </div>

                  <div className="form-actions">
                    <button type="button" className="btn-secondary" onClick={closeModal}>
                      Cancelar
                    </button>
                    <button type="submit" className="btn-primary">
                      <Save className="w-4 h-4 mr-2" />
                      Crear Multa
                    </button>
                  </div>
                </form>
              )}

              {/* MODAL EDIT */}
              {modalType === 'edit' && selectedMulta && (
                <form onSubmit={handleSubmit} className="user-form">
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Monto: *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.monto}
                        onChange={(e) => setFormData({ ...formData, monto: e.target.value })}
                        required
                      />
                    </div>

                    <div className="form-group form-group-full">
                      <label>Observaciones:</label>
                      <textarea
                        value={formData.observaciones}
                        onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                        rows="3"
                        placeholder="Ingrese observaciones..."
                      />
                    </div>
                  </div>

                  <div className="form-actions">
                    <button type="button" className="btn-secondary" onClick={closeModal}>
                      Cancelar
                    </button>
                    <button type="submit" className="btn-primary">
                      <Save className="w-4 h-4 mr-2" />
                      Guardar Cambios
                    </button>
                  </div>
                </form>
              )}

              {/* MODAL PAGAR */}
              {modalType === 'pagar' && selectedMulta && (
                <form onSubmit={handlePago} className="user-form">
                  <div className="alert alert-info mb-4">
                    <FileText className="w-5 h-5 mr-2" />
                    <div>
                      <h4 className="font-semibold">Resumen de Pago</h4>
                      <p className="text-sm mt-1"><strong>Afiliado:</strong> {getAfiliadoNombre(selectedMulta)}</p>
                      <p className="text-sm"><strong>Tipo de Multa:</strong> {getTipoMultaNombre(selectedMulta)}</p>
                      <p className="text-sm"><strong>Monto a pagar:</strong> <span className="font-bold text-lg">{formatCurrency(selectedMulta.monto)}</span></p>
                    </div>
                  </div>

                  <div className="form-grid">
                    <div className="form-group">
                      <label>Fecha de Pago:</label>
                      <input
                        type="date"
                        value={pagoData.fecha_pago}
                        onChange={(e) => setPagoData({ ...pagoData, fecha_pago: e.target.value })}
                        max={new Date().toISOString().split('T')[0]}
                      />
                    </div>

                    <div className="form-group form-group-full">
                      <label>Observaciones del Pago:</label>
                      <textarea
                        value={pagoData.observaciones}
                        onChange={(e) => setPagoData({ ...pagoData, observaciones: e.target.value })}
                        rows="3"
                        placeholder="Número de comprobante, método de pago, etc..."
                      />
                    </div>
                  </div>

                  <div className="form-actions">
                    <button type="button" className="btn-secondary" onClick={closeModal}>
                      Cancelar
                    </button>
                    <button type="submit" className="btn-primary">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Confirmar Pago
                    </button>
                  </div>
                </form>
              )}

              {/* MODAL ANULAR */}
              {modalType === 'anular' && selectedMulta && (
                <div>
                  <div className="alert alert-error mb-4">
                    <AlertCircle className="w-6 h-6 mr-3" />
                    <div>
                      <h4 className="font-semibold text-lg mb-2">¿Estás seguro de anular esta multa?</h4>
                      <p className="text-sm"><strong>ID:</strong> #{selectedMulta.id_multa_afi}</p>
                      <p className="text-sm"><strong>Afiliado:</strong> {getAfiliadoNombre(selectedMulta)}</p>
                      <p className="text-sm"><strong>Monto:</strong> {formatCurrency(selectedMulta.monto)}</p>
                      <p className="text-sm font-semibold mt-2 text-red-700">Esta acción no se puede deshacer.</p>
                    </div>
                  </div>

                  <div className="form-actions">
                    <button className="btn-secondary" onClick={closeModal}>
                      Cancelar
                    </button>
                    <button className="btn-danger" onClick={handleAnular}>
                      <Ban className="w-4 h-4 mr-2" />
                      Anular Multa
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinesAffiliatesSection;