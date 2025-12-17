// src/components/FinesAffiliatesSection.js  
// MÓDULO DE MULTAS DE AFILIADOS - VERSIÓN MEJORADA CON ESTILOS MODERNOS

import React, { useState, useEffect, useCallback } from 'react';
import './AffiliatesSection.css';
import finesAffiliatesServices from '../services/finesAffiliatesServices';

import fineService from '../services/fineServices';
import authService from '../services/authServices';
import {
  DollarSign, Search, Edit, Eye, Calendar, X, Save,
  RefreshCw, AlertCircle, CheckCircle, XCircle, Ban,
  FileText, UserCheck, Clock, ArrowUpDown, Receipt, 
  User, IdCard, MapPin, MessageSquare
} from 'lucide-react';

const FinesAffiliatesSection = () => {
  // ============================================================
  // ESTADOS PRINCIPALES
  // ============================================================
  const [multas, setMultas] = useState([]);
  const [affiliates, setAffiliates] = useState([]);
  const [tiposMulta, setTiposMulta] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ============================================================
  // ESTADOS DE FILTROS Y BÚSQUEDA
  // ============================================================
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('all');
  const [filterAfiliado, setFilterAfiliado] = useState('all');
  const [filterTipoMulta, setFilterTipoMulta] = useState('all');
  const [sortOrder, setSortOrder] = useState('desc');
  const [sortBy, setSortBy] = useState('fecha');

  // ============================================================
  // ESTADOS DE MODAL Y FORMULARIOS
  // ============================================================
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('create');
  const [selectedMulta, setSelectedMulta] = useState(null);
  const [affiliateSearchTerm, setAffiliateSearchTerm] = useState('');
  const [selectedAffiliateInfo, setSelectedAffiliateInfo] = useState(null);

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

  const [anulacionData, setAnulacionData] = useState({
    motivo: '',
    motivoPersonalizado: ''
  });

  const motivosAnulacion = [
    'Error en el registro de la multa',
    'Multa duplicada',
    'Afiliado incorrecto',
    'Monto incorrecto',
    'Decisión administrativa',
    'Apelación aceptada',
    'Otro (especificar)'
  ];

  // ============================================================
  // ESTADOS DE PERMISOS
  // ============================================================
  const [permissions, setPermissions] = useState({
    canCreate: false,
    canRead: false,
    canUpdate: false,
    canDelete: false
  });

  // Función separada para tipos de multa
  const loadTiposMulta = async () => {
    try {
      const tiposResult = await fineService.getTiposMulta({ 
        activo: true, 
        esvigente: true 
      });
      if (tiposResult.success) {
        setTiposMulta(tiposResult.data);
      }
    } catch (error) {
      console.error('Error cargando tipos de multa', error);
    }
  };

  

  // ============================================================
  // FUNCIONES DE PERMISOS
  // ============================================================
  const loadUserPermissions = () => {
    const canCreate = authService.hasPermission('multasafiliados', 'crear') || authService.hasPermission('multasafiliados', 'crud');
    const canUpdate = authService.hasPermission('multasafiliados', 'actualizar') || authService.hasPermission('multasafiliados', 'crud');
    const canDelete = authService.hasPermission('multasafiliados', 'eliminar') || authService.hasPermission('multasafiliados', 'crud');
    const canRead = authService.hasPermission('multasafiliados', 'lectura') || canCreate || canUpdate || canDelete || authService.hasPermission('multas', 'crud');

    setPermissions({ canCreate, canRead, canUpdate, canDelete });
  };

  // ============================================================
  // FUNCIONES DE CARGA DE DATOS
  // ============================================================
  const loadAffiliates = async () => {
    try {
      const result = await finesAffiliatesServices.getAvailableAffiliates();
      if (result.success) {
        setAffiliates(result.data);
      }
    } catch (error) {
      console.error('❌ Error cargando afiliados:', error);
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
  // ============================================================
  // EFECTOS DE INICIALIZACIÓN
  // ============================================================
  useEffect(() => {
    loadUserPermissions();
    loadTiposMulta();
    fetchStats();
  }, []);

  useEffect(() => {
    if (permissions.canRead) {
      fetchMultas();
      fetchStats();
    }
  }, [filterEstado, filterAfiliado, permissions.canRead, fetchMultas]);

  // ============================================================
  // FUNCIONES AUXILIARES DE DATOS
  // ============================================================
  
  const getAfiliadoNombre = (multa) => {
    return multa.afiliado?.nombre_completo || "N/A";
  };

  const getAfiliadoCodigo = (multa) => {
    return multa.afiliado?.cod_usuario_afi || "N/A";
  };

  const getAfiliadoCedula = (multa) => {
    return multa.afiliado?.cedula || "N/A";
  };

  const getSectorNombre = (multa) => {
    return multa.afiliado?.nombre_sector || "N/A";
  };

  const getTipoMultaNombre = (multa) => {
    return multa.tipo_multa?.nombre_multa || "N/A";
  };

  const getEstadoBadge = (estado) => {
    const badges = {
      pendiente: { 
        class: 'fine-status-badge', 
        style: { backgroundColor: '#fef3c7', color: '#d97706' }, 
        icon: Clock, 
        text: 'Pendiente' 
      },
      pagada: { 
        class: 'fine-status-badge', 
        style: { backgroundColor: '#d1fae5', color: '#059669' }, 
        icon: CheckCircle, 
        text: 'Pagada' 
      },
      anulada: { 
        class: 'fine-status-badge', 
        style: { backgroundColor: '#fee2e2', color: '#dc2626' }, 
        icon: XCircle, 
        text: 'Anulada' 
      },
      exonerada: { 
        class: 'fine-status-badge', 
        style: { backgroundColor: '#e0e7ff', color: '#4f46e5' }, 
        icon: FileText, 
        text: 'Exonerada' 
      }
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

  // ============================================================
  // FUNCIONES DE FILTRADO Y ORDENAMIENTO
  // ============================================================
  
  const filteredAffiliates = affiliates.filter(aff => {
  if (!affiliateSearchTerm) return true;
  const searchLower = affiliateSearchTerm.toLowerCase();
  // Corregido: acceder directamente a las propiedades sin .usuario
  const nombreCompleto = `${aff.nombres || ''} ${aff.apellidos || ''}`.toLowerCase();
  const cedula = aff.cedula || '';
  return nombreCompleto.includes(searchLower) || cedula.includes(searchLower);
});


  const filteredMultas = multas
    .filter(multa => {
      const matchesSearch = searchTerm === '' ||
        multa.id_multa_afi.toString().includes(searchTerm) ||
        (multa.afiliado && (
          multa.afiliado.nombre_completo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          multa.afiliado.cedula?.includes(searchTerm) ||
          multa.afiliado.cod_usuario_afi?.toString().includes(searchTerm) ||
          multa.afiliado.nombre_sector?.toLowerCase().includes(searchTerm.toLowerCase())
        )) ||
        (multa.tipo_multa && 
          multa.tipo_multa.nombre_multa?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      
      const matchesEstado = filterEstado === 'all' || multa.estado === filterEstado;
      const matchesAfiliado = filterAfiliado === 'all' || multa.id_usuario_afi === parseInt(filterAfiliado);
      const matchesTipoMulta = filterTipoMulta === 'all' || multa.id_tipo_multa === parseInt(filterTipoMulta);
      
      return matchesSearch && matchesEstado && matchesAfiliado && matchesTipoMulta;
    })
    .sort((a, b) => {
      // Primero ordenar por prioridad de estado
      const estadoPrioridad = {
        'pagada': 1,
        'pendiente': 2,
        'exonerada': 3,
        'anulada': 4
      };
      
      const prioridadA = estadoPrioridad[a.estado] || 5;
      const prioridadB = estadoPrioridad[b.estado] || 5;
      
      if (prioridadA !== prioridadB) {
        return prioridadA - prioridadB;
      }
      
      // Luego aplicar el ordenamiento seleccionado
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

  const limpiarFiltros = () => {
    setSearchTerm('');
    setFilterEstado('all');
    setFilterAfiliado('all');
    setFilterTipoMulta('all');
    setSortBy('fecha');
    setSortOrder('desc');
    fetchMultas();
  };

  // ============================================================
  // FUNCIONES DE MODAL
  // ============================================================
  
  const handleAffiliateChange = (affiliateId) => {
    const affiliate = affiliates.find(a => a.id_usuario_afi === parseInt(affiliateId));
    setFormData({ ...formData, id_usuario_afi: parseInt(affiliateId) });
    setSelectedAffiliateInfo(affiliate);
  };

  const openModal = async (type, multa = null) => {
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
      // Cargar afiliados AQUÍ
     
      await loadAffiliates();

      setFormData({
        id_usuario_afi: affiliates.length > 0 ? affiliates[0].id_usuario_afi : null,
        id_tipo_multa: tiposMulta.length > 0 ? tiposMulta[0].id_tipo_multa : null,
        monto: tiposMulta.length > 0 ? tiposMulta[0].monto || '' : '',
        fecha_multa: new Date().toLocaleDateString('en-CA'),
        observaciones: ''
      });
      setAffiliateSearchTerm('');
      setSelectedAffiliateInfo(null);
    } else if (type === 'edit' && multa) {
      setFormData({
        id_tipo_multa: multa.id_tipo_multa,
        observaciones: multa.observaciones || '',
        activo: multa.activo
      });
    } else if (type === 'pagar' && multa) {
      setPagoData({
        fecha_pago: new Date().toISOString().split('T')[0],
        observaciones: ''
      });
    } else if (type === 'anular' && multa) {
      setAnulacionData({
        motivo: '',
        motivoPersonalizado: ''
      });
    }

    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedMulta(null);
    setError(null);
    setAffiliateSearchTerm('');
    setSelectedAffiliateInfo(null);
  };

  // ============================================================
  // FUNCIONES CRUD
  // ============================================================
  
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

  const handleAnular = async (e) => {
    e.preventDefault();
    
    if (!permissions.canDelete) {
      alert('❌ No tienes permiso para anular multas');
      return;
    }

    const motivoFinal = anulacionData.motivo === 'Otro (especificar)' 
      ? anulacionData.motivoPersonalizado 
      : anulacionData.motivo;

    if (!motivoFinal || motivoFinal.trim().length < 10) {
      setError('El motivo debe tener al menos 10 caracteres');
      return;
    }

    try {
      const result = await finesAffiliatesServices.anularMulta(selectedMulta.id_multa_afi, motivoFinal);

      if (result.success) {
        alert('✅ Multa anulada correctamente');
        await fetchMultas();
        await fetchStats();
        closeModal();
      } else {
        setError(result.message || 'Error al anular multa');
      }

    } catch (error) {
      console.error('Error al anular multa:', error);
      setError(error.message || 'Error al anular multa');
    }
  };

  // ============================================================
  // RENDERIZADO CONDICIONAL
  // ============================================================
  
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

  // ============================================================
  // RENDERIZADO PRINCIPAL
  // ============================================================

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
            placeholder="Buscar por ID, nombre, cédula, sector..."
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
          {filteredMultas.map((multa) => {
            const estadoClass = multa.estado === 'pagada' ? 'fine-card-paid' : 
                               multa.estado === 'pendiente' ? 'fine-card-pending' : 
                               'fine-card-cancelled';
            
            return (
              <div key={multa.id_multa_afi} className={`user-card ${estadoClass}`}>
                
                {/* HEADER */}
                <div className="user-card-header">
                  <div className="user-info">
                    <div className="user-avatar user-avatar-empty">
                      <DollarSign className="w-6 h-6 text-blue-600" />
                    </div>

                    <div>
                      <h3 className="user-name" style={{ fontSize: '0.95rem', marginBottom: '0.35rem' }}>
                        {getTipoMultaNombre(multa)}
                      </h3>

                      <div className="user-meta flex items-center gap-3 mt-1">
                        <span
                          className={`status-badge ${
                            multa.estado === "pendiente"
                              ? "role-orange"
                              : multa.estado === "pagada"
                              ? "role-green"
                              : multa.estado === "anulada"
                              ? "inactive"
                              : multa.estado === "exonerada"
                              ? "role-purple"
                              : "role-default"
                          }`}
                        >
                          {multa.estado === "pendiente" && <Clock className="w-3 h-3" />}
                          {multa.estado === "pagada" && <CheckCircle className="w-3 h-3" />}
                          {multa.estado === "anulada" && <Ban className="w-3 h-3" />}
                          {multa.estado === "exonerada" && <FileText className="w-3 h-3" />}
                          {multa.estado.charAt(0).toUpperCase() + multa.estado.slice(1)}
                        </span>

                        <span
                          className={`status-badge flex items-center font-bold ${
                            multa.estado === 'pagada' ? 'role-green' :
                            multa.estado === 'pendiente' ? 'role-orange' :
                            'inactive'
                          }`}
                          style={{ fontSize: '0.9rem', padding: '0.3rem 0.7rem' }}
                        >
                          <DollarSign className="w-4 h-4 mr-1" />
                          {formatCurrency(multa.monto).replace("$", "")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ACCIONES */}
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

                {/* BODY */}
                <div className="user-card-body" style={{ padding: '1rem 1.25rem' }}>
                  <div className="user-contact">
                    <div className="contact-item">
                      <User className="w-4 h-4 text-blue-600" />

                      <div className="contact-text-group flex flex-col leading-tight">
                        {/* Nombre + cédula */}
                        <span className="label font-semibold">
                          {getAfiliadoNombre(multa)} • {getAfiliadoCodigo(multa)}
                        </span>
                      </div>
                    </div>

                    {/* codigo del afiliado */}
                    <div className="contact-item">
                      <IdCard className="w-4 h-4 text-purple-500" />
                      <div className="contact-text-group flex">
                        <span className="label font-semibold mr-1">Cédula:</span>
                        <span className="value">{getAfiliadoCedula(multa)}</span>
                      </div>
                    </div>


                    {/* Sector */}
                    <div className="contact-item">
                      <MapPin className="w-4 h-4 text-purple-500" />
                      <div className="contact-text-group flex">
                        <span className="label font-semibold mr-1">Sector:</span>
                        <span className="value">{getSectorNombre(multa)}</span>
                      </div>
                    </div>

                    {/* Observaciones */}
                    <div className="contact-item items-start">
                      <MessageSquare className="w-4 h-4 text-yellow-600 mt-0.5" />

                      <div className="contact-text-group flex flex-col leading-tight">
                        <span className="label font-semibold mr-1">
                          Observaciones:
                        </span>

                        <span className="value">
                          {multa.observaciones && multa.observaciones.trim() !== ""
                            ? multa.observaciones
                            : "Sin observaciones"}
                        </span>
                      </div>
                    </div>

                    {/* Fechas */}
                    <div className="flex items-start gap-2 text-sm text-gray-700 border-t pt-2 mt-2">
                      <Calendar className="w-4 h-4 text-blue-700 mt-0.5" />

                      <div className="flex flex-col">

                        {/* Línea: Multa */}
                        <div className="mb-10">
                          <span className="font-semibold mr-1">Multa:</span>
                          {formatDate(multa.fecha_multa)} ·  
                        </div>

                        {/* Línea: Pago */}
                        {multa.fecha_pago && (
                          <div>
                        
                            <span className="font-semibold text-green-800 mr-1">Pago:</span>
                            <span className="text-green-800">
                              {formatDate(multa.fecha_pago)}
                            </span>
                          </div>
                        )}

                      </div>
                    </div>



                  </div>
                </div>
              </div>
            );
          })}
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
                    <p className="font-semibold text-blue-600">#{selectedMulta.id_multa_afi}</p>
                  </div>

                  <div className="detail-group">
                    <label>Estado:</label>
                    {getEstadoBadge(selectedMulta.estado)}
                  </div>

                  <div className="detail-group" style={{gridColumn: '1 / -1', marginTop: '1rem'}}>
                    <label className="text-blue-600 font-semibold flex items-center gap-2">
                      <UserCheck className="w-4 h-4" />
                      Información del Afiliado
                    </label>
                  </div>
                  
                  <div className="detail-group">
                    <label>Nombre Completo:</label>
                    <p className="font-semibold">{getAfiliadoNombre(selectedMulta)}</p>
                  </div>
                  
                  <div className="detail-group">
                    <label>Código:</label>
                    <p className="font-semibold">{getAfiliadoCodigo(selectedMulta)}</p>
                  </div>
                  
                  <div className="detail-group">
                    <label>Cédula:</label>
                    <p className="font-semibold">{getAfiliadoCedula(selectedMulta)}</p>
                  </div>
                  
                  <div className="detail-group">
                    <label>Sector:</label>
                    <p className="font-semibold">{getSectorNombre(selectedMulta)}</p>
                  </div>

                  <div className="detail-group" style={{ gridColumn: '1 / -1', marginTop: '1rem' }}>
                    <label className="text-orange-600 font-semibold flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Detalles de la Multa
                    </label>
                  </div>

                  <div className="detail-group">
                    <label>Tipo de Multa:</label>
                    <p className="font-semibold">{getTipoMultaNombre(selectedMulta)}</p>
                  </div>

                  <div className="detail-group">
                    <label>Monto:</label>
                    <p className="text-xl font-bold text-red-600">
                      {formatCurrency(selectedMulta.monto)}
                    </p>
                  </div>

                  <div className="detail-group">
                    <label>Fecha de Multa:</label>
                    <p className="font-semibold">{formatDate(selectedMulta.fecha_multa)}</p>
                  </div>

                  <div className="detail-group">
                    <label>Fecha de Pago:</label>
                    <p className={selectedMulta.fecha_pago ? 'font-semibold text-green-600' : 'text-gray-400'}>
                      {formatDate(selectedMulta.fecha_pago)}
                    </p>
                  </div>

                  {selectedMulta.observaciones && (
                    <div className="detail-group" style={{ gridColumn: '1 / -1' }}>
                      <label>Observaciones:</label>
                      <p className="text-sm text-gray-700 bg-yellow-50 p-3 rounded border-l-4 border-yellow-400">
                        {selectedMulta.observaciones}
                      </p>
                    </div>
                  )}

                  {selectedMulta.estado === 'pendiente' && permissions.canUpdate && (
                    <div style={{ gridColumn: '1 / -1', marginTop: '1.5rem' }}>
                      <button
                        className="btn-primary w-full"
                        onClick={() => {
                          closeModal();
                          openModal('pagar', selectedMulta);
                        }}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Registrar Pago de {formatCurrency(selectedMulta.monto)}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* MODAL CREATE */}
              {modalType === 'create' && (
                <form onSubmit={handleSubmit} className="user-form">
                  <div className="form-grid">
                    <div className="form-group form-group-full">
                      <label>Afiliado: *</label>
                      
                      <div className="meter-search-container">
                        <div className="meter-search-input-wrapper">
                          <Search className="w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Buscar afiliado por nombre o cédula..."
                            value={affiliateSearchTerm}
                            onChange={(e) => setAffiliateSearchTerm(e.target.value)}
                          />
                          {affiliateSearchTerm && (
                            <button
                              type="button"
                              onClick={() => setAffiliateSearchTerm('')}
                              className="meter-search-clear-btn"
                            >
                              <X className="w-4 h-4 text-gray-400" />
                            </button>
                          )}
                        </div>
                      </div>

                      <select
                        value={formData.id_usuario_afi || ''}
                        onChange={(e) => handleAffiliateChange(e.target.value)}
                        required
                      >
                        <option value="">Seleccionar afiliado</option>
                          {filteredAffiliates.map(aff => (
                          <option key={aff.id_usuario_afi} value={aff.id_usuario_afi}>
                            {`${aff.nombres} ${aff.apellidos} - ${aff.cedula}`}
                          </option>
                        ))}
                      </select>

                      {selectedAffiliateInfo && selectedAffiliateInfo.usuario && (
                        <div className="meter-info-card">
                          <h4 className="meter-info-title">
                            <UserCheck className="w-4 h-4 mr-2" />
                            Información del Afiliado
                          </h4>
                          <div className="meter-info-content">
                            <p><strong>Nombre:</strong> {selectedAffiliateInfo.usuario.nombres} {selectedAffiliateInfo.usuario.apellidos}</p>
                            <p><strong>Cédula:</strong> {selectedAffiliateInfo.usuario.cedula}</p>
                            {selectedAffiliateInfo.usuario.email && (
                              <p><strong>Email:</strong> {selectedAffiliateInfo.usuario.email}</p>
                            )}
                          </div>
                        </div>
                      )}
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
                        readOnly
                        className="bg-gray-100 font-semibold"
                      />
                      <small className="text-gray-500 text-xs mt-1">
                        El monto se establece automáticamente según el tipo de multa
                      </small>
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
                  <div className="alert alert-info mb-4">
                    <AlertCircle className="w-5 h-5 mr-2" />
                    <div>
                      <p className="text-sm">Solo puedes modificar el tipo de multa y las observaciones. El monto se actualizará automáticamente según el tipo seleccionado.</p>
                    </div>
                  </div>

                  <div className="user-details mb-4">
                    <div className="detail-group">
                      <label>Afiliado:</label>
                      <p>{getAfiliadoNombre(selectedMulta)}</p>
                    </div>
                    <div className="detail-group">
                      <label>Cédula:</label>
                      <p>{getAfiliadoCedula(selectedMulta)}</p>
                    </div>
                    <div className="detail-group">
                      <label>Monto Actual:</label>
                      <p className="text-lg font-bold">{formatCurrency(selectedMulta.monto)}</p>
                    </div>
                    <div className="detail-group">
                      <label>Fecha Multa:</label>
                      <p>{formatDate(selectedMulta.fecha_multa)}</p>
                    </div>
                  </div>

                  <div className="form-grid">
                    <div className="form-group">
                      <label>Tipo de Multa: *</label>
                      <select
                        value={formData.id_tipo_multa || ''}
                        onChange={(e) => {
                          const tipoId = parseInt(e.target.value);
                          setFormData({
                            ...formData,
                            id_tipo_multa: tipoId
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
                      <small className="text-gray-500 text-xs mt-1">
                        Al cambiar el tipo, el monto se actualizará automáticamente
                      </small>
                    </div>

                    <div className="form-group">
                      <label>Estado:</label>
                      <select
                        value={formData.activo}
                        onChange={(e) => setFormData({ ...formData, activo: e.target.value === 'true' })}
                      >
                        <option value="true">Activo</option>
                        <option value="false">Inactivo</option>
                      </select>
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
                <form onSubmit={handleAnular} className="user-form">
                  <div className="alert alert-error mb-4">
                    <AlertCircle className="w-6 h-6 mr-3" />
                    <div>
                      <h4 className="font-semibold text-lg mb-2">¿Estás seguro de anular esta multa?</h4>
                      <p className="text-sm"><strong>ID:</strong> #{selectedMulta.id_multa_afi}</p>
                      <p className="text-sm"><strong>Afiliado:</strong> {getAfiliadoNombre(selectedMulta)}</p>
                      <p className="text-sm"><strong>Tipo:</strong> {getTipoMultaNombre(selectedMulta)}</p>
                      <p className="text-sm"><strong>Monto:</strong> {formatCurrency(selectedMulta.monto)}</p>
                      <p className="text-sm font-semibold mt-2 text-red-700">Esta acción no se puede deshacer.</p>
                    </div>
                  </div>

                  <div className="form-grid">
                    <div className="form-group form-group-full">
                      <label>Motivo de Anulación: *</label>
                      <select
                        value={anulacionData.motivo}
                        onChange={(e) => setAnulacionData({ ...anulacionData, motivo: e.target.value })}
                        required
                        className="w-full"
                      >
                        <option value="">Seleccione un motivo</option>
                        {motivosAnulacion.map((motivo, index) => (
                          <option key={index} value={motivo}>
                            {motivo}
                          </option>
                        ))}
                      </select>
                    </div>

                    {anulacionData.motivo === 'Otro (especificar)' && (
                      <div className="form-group form-group-full">
                        <label>Especifique el motivo: *</label>
                        <textarea
                          value={anulacionData.motivoPersonalizado}
                          onChange={(e) => setAnulacionData({ ...anulacionData, motivoPersonalizado: e.target.value })}
                          rows="4"
                          placeholder="Ingrese el motivo de anulación (mínimo 10 caracteres)..."
                          required
                          minLength={10}
                          className="w-full"
                        />
                        <small className="text-gray-500 text-xs mt-1">
                          {anulacionData.motivoPersonalizado.length}/10 caracteres mínimos
                        </small>
                      </div>
                    )}

                    {anulacionData.motivo && anulacionData.motivo !== 'Otro (especificar)' && (
                      <div className="form-group form-group-full">
                        <label>Observaciones adicionales (opcional):</label>
                        <textarea
                          value={anulacionData.motivoPersonalizado}
                          onChange={(e) => setAnulacionData({ ...anulacionData, motivoPersonalizado: e.target.value })}
                          rows="3"
                          placeholder="Puede agregar información adicional sobre la anulación..."
                          className="w-full"
                        />
                      </div>
                    )}
                  </div>

                  <div className="form-actions">
                    <button type="button" className="btn-secondary" onClick={closeModal}>
                      Cancelar
                    </button>
                    <button 
                      type="submit" 
                      className="btn-danger"
                      disabled={!anulacionData.motivo || (anulacionData.motivo === 'Otro (especificar)' && anulacionData.motivoPersonalizado.length < 10)}
                    >
                      <Ban className="w-4 h-4 mr-2" />
                      Confirmar Anulación
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

export default FinesAffiliatesSection;