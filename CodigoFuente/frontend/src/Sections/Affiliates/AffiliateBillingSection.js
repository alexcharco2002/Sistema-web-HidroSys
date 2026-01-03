// src/sections/AffiliateBillingSection.js

// MÓDULO DE FACTURAS Y PAGOS - Para afiliados

import React, { useState, useEffect, useCallback } from 'react';
import affiliateBillingServices from '../../services/affiliateBillingServices';
import authService from '../../services/authServices';

import {
  FileText,
  Eye,
  Calendar,
  DollarSign,
  AlertCircle,
  TrendingUp,
  RefreshCw,
  X,
  Upload,
  CheckCircle,
  Clock,
  Receipt,
  Paperclip,
  User,
  MapPin,
  Activity,
  CreditCard,
  Ban,
  BarChart3,
  TrendingDown, XCircle, Gauge,
  ArrowUpDown, FileCheck , Search, SlidersHorizontal
} from 'lucide-react';

import './AffiliateBillingSection.css';

const AffiliateBillingSection = () => {
  // ============================================================
  // ESTADOS PRINCIPALES
  // ============================================================
  const [facturas, setFacturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [, setCurrentUser] = useState(null);

  const [permissions, setPermissions] = useState({
    canRead: false,
    canUpload: false
  });

  // ============================================================
  // ESTADOS DE FILTROS Y BÚSQUEDA
  // ============================================================
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFechaDesde, setFilterFechaDesde] = useState('');
  const [filterFechaHasta, setFilterFechaHasta] = useState('');
  const [filterEstadoFactura, setFilterEstadoFactura] = useState('todos');
  const [filterMontoMin, setFilterMontoMin] = useState('');
  const [filterMontoMax, setFilterMontoMax] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [sortBy, setSortBy] = useState('fecha_emision');

  // ============================================================
  // ESTADOS DE PERIODOS (AÑO/MES)
  // ============================================================
  const [aniosDisponibles, setAniosDisponibles] = useState([]);
  const [periodosDisponibles, setPeriodosDisponibles] = useState({});
  const currentYear = new Date().getFullYear();
  const [selectedAnio, setSelectedAnio] = useState(currentYear);
  const [selectedMes, setSelectedMes] = useState('');
  const [mesesDelAnio, setMesesDelAnio] = useState([]);

  // ============================================================
  // ESTADOS DE MODAL Y ESTADÍSTICAS
  // ============================================================
  const [showModal, setShowModal] = useState(false);
  const [selectedFactura, setSelectedFactura] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadingPago, setUploadingPago] = useState(null);
  const [comprobante, setComprobante] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [stats, setStats] = useState({
    total_facturas: 0,
    total_pagadas: 0,
    total_pendientes: 0,
    monto_total: 0,
    monto_pagado: 0,
    monto_pendiente: 0,
    promedio_mensual: 0
  });

  // ============================================================
  // INICIALIZACIÓN - PERMISOS Y USUARIO
  // ============================================================
  useEffect(() => {
    loadUserPermissions();
    loadCurrentUser();
  }, []);

  const loadUserPermissions = () => {
    const canRead =
      authService.hasPermission('Facturas_pagos', 'lectura') ||
      authService.hasPermission('Facturas_pagos', 'crud');

    const canUpload =
      authService.hasPermission('Facturas_pagos', 'escritura') ||
      authService.hasPermission('Facturas_pagos', 'crud');

    console.log('🔐 Permisos cargados:', { canRead, canUpload });
    setPermissions({ canRead, canUpload });
  };

  const loadCurrentUser = () => {
    const user = authService.getStoredUser();
    if (user) {
      setCurrentUser(user);
    }
  };

  const getStatusBadge = (estado) => {
    const configs = {
      pendiente: { icon: Clock, texto: 'Pendiente' },
      pagada: { icon: CheckCircle, texto: 'Pagada' },
      vencida: { icon: XCircle, texto: 'Vencida' },
      anulada: { icon: Ban, texto: 'Anulada' }
    };

    const config = configs[estado] || configs.pendiente;
    const IconComponent = config.icon;

    return (
      <span className={`status-badge ${estado}`}>
        <IconComponent className="status-icon" />
        {config.texto}
      </span>
    );
  };


  // ============================================================
  // FUNCIONES DE PERIODOS (AÑOS Y MESES DISPONIBLES)
  // ============================================================
  const handleAnioChange = (e) => {
    const anio = e.target.value;
    setSelectedAnio(anio);
    setSelectedMes('');

    if (anio && periodosDisponibles[anio]) {
      setMesesDelAnio(periodosDisponibles[anio]);
    } else {
      setMesesDelAnio([]);
    }
  };

  // ============================================================
  // FUNCIONES DE CARGA DE DATOS
  // ============================================================
  const cargarFacturas = useCallback(async () => {
    if (!permissions.canRead) {
      setError('No tienes permiso para ver tus facturas');
      setLoading(false);
      return;
    }

    console.log('📊 Cargando facturas con filtros:', {
      anio: selectedAnio,
      mes: selectedMes,
      estadoFactura: filterEstadoFactura
    });

    setLoading(true);
    setError(null);

    try {
      const result = await affiliateBillingServices.getMisFacturasPorPeriodo(
        selectedAnio || null,
        selectedMes || null,
        {
          estado_factura: filterEstadoFactura
        }
      );

      console.log('✅ Facturas recibidas:', result);

      if (result.success) {
        setFacturas(result.data);
        calcularEstadisticas(result.data);
      } else {
        setError(result.message);
        console.error('❌ Error en respuesta:', result.message);
      }
    } catch (err) {
      setError('Error al cargar tus facturas');
      console.error('❌ Error cargando facturas:', err);
    } finally {
      setLoading(false);
    }
  }, [
    permissions.canRead,
    selectedAnio,
    selectedMes,
    filterEstadoFactura
  ]);

  useEffect(() => {
      const inicializar = async () => {
          console.log('🚀 Iniciando carga de datos...');
          
          // Cargar periodos disponibles
          try {
              const resultPeriodos = await affiliateBillingServices.getPeriodosFacturasDisponibles();
              console.log('📅 Periodos obtenidos:', resultPeriodos);
              
              if (resultPeriodos.success) {
                  setAniosDisponibles(resultPeriodos.data.anios_disponibles || []);
                  setPeriodosDisponibles(resultPeriodos.data.periodos || {});
                  
                  if (resultPeriodos.data.anios_disponibles && resultPeriodos.data.anios_disponibles.length > 0) {
                      const anioReciente = resultPeriodos.data.anios_disponibles[0];
                      const mesesDelAnioReciente = resultPeriodos.data.periodos[anioReciente] || [];
                      
                      setSelectedAnio(anioReciente);
                      setMesesDelAnio(mesesDelAnioReciente);
                      
                      // ✅ ESTABLECER EL MES MÁS RECIENTE
                      if (mesesDelAnioReciente.length > 0) {
                          const mesReciente = Math.max(...mesesDelAnioReciente);
                          setSelectedMes(mesReciente);
                          console.log(`📅 Periodo inicial: ${anioReciente}/${mesReciente}`);
                      }
                  }
              } else {
                  console.error('❌ Error al cargar periodos:', resultPeriodos.message);
                  setError(resultPeriodos.message);
              }
          } catch (error) {
              console.error('❌ Error obteniendo periodos:', error);
              setError('Error al cargar periodos disponibles');
          }

          // Cargar facturas iniciales
          await cargarFacturas();
      };

      if (permissions.canRead) {
          inicializar();
      }
  }, [permissions.canRead, cargarFacturas]);


  // Recargar facturas cuando cambien los filtros
  useEffect(() => {
    if (permissions.canRead && aniosDisponibles.length > 0) {
      cargarFacturas();
    }
  }, [selectedAnio, selectedMes, filterEstadoFactura, cargarFacturas, permissions.canRead, aniosDisponibles.length]);

  // ============================================================
  // CÁLCULO DE ESTADÍSTICAS
  // ============================================================
  const calcularEstadisticas = (facturasData) => {
    if (!facturasData || facturasData.length === 0) {
      setStats({
        total_facturas: 0,
        total_pagadas: 0,
        total_pendientes: 0,
        monto_total: 0,
        monto_pagado: 0,
        monto_pendiente: 0,
        promedio_mensual: 0
      });
      return;
    }

    const total = facturasData.length;
    const pagadas = facturasData.filter(f => f.esta_totalmente_pagada).length;
    const pendientes = facturasData.filter(f => !f.esta_totalmente_pagada).length;

    const montoTotal = facturasData.reduce((sum, f) => sum + (f.total || 0), 0);
    const montoPagado = facturasData.reduce((sum, f) => sum + (f.monto_pagado || 0), 0);
    const montoPendiente = facturasData.reduce((sum, f) => sum + (f.saldo_pendiente || 0), 0);

    const promedioMensual = total > 0 ? (montoTotal / total).toFixed(2) : 0;

    setStats({
      total_facturas: total,
      total_pagadas: pagadas,
      total_pendientes: pendientes,
      monto_total: montoTotal.toFixed(2),
      monto_pagado: montoPagado.toFixed(2),
      monto_pendiente: montoPendiente.toFixed(2),
      promedio_mensual: parseFloat(promedioMensual)
    });
  };

  // ============================================================
  // FUNCIONES DE FILTRADO Y ORDENAMIENTO
  // ============================================================
  const toggleSortOrder = () => {
    const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    console.log(`🔄 Cambiando orden: ${sortOrder} → ${newOrder}`);
    setSortOrder(newOrder);
  };

  const filteredFacturas = facturas
    .filter(factura => {
      const matchesSearch =
        factura.num_factura?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        factura.id_factura?.toString().includes(searchTerm) ||
        factura.usuario_afiliado?.usuario_sistema?.nombres?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        factura.usuario_afiliado?.usuario_sistema?.apellidos?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        factura.usuario_afiliado?.usuario_sistema?.cedula?.includes(searchTerm) ||
        factura.usuario_afiliado?.num_medidor?.includes(searchTerm) ||
        factura.usuario_afiliado?.sector?.nombre_sector?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesEstadoFactura =
        filterEstadoFactura === 'todos' || factura.estado_factura === filterEstadoFactura;

      const fechaEmision = new Date(factura.fecha_emision);
      const matchesFechaDesde = !filterFechaDesde || fechaEmision >= new Date(filterFechaDesde);
      const matchesFechaHasta = !filterFechaHasta || fechaEmision <= new Date(filterFechaHasta);

      const matchesMontoMin = !filterMontoMin || factura.total >= parseFloat(filterMontoMin);
      const matchesMontoMax = !filterMontoMax || factura.total <= parseFloat(filterMontoMax);

      return matchesSearch && matchesEstadoFactura &&
        matchesFechaDesde && matchesFechaHasta && matchesMontoMin && matchesMontoMax;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'fecha_emision':
          comparison = new Date(a.fecha_emision) - new Date(b.fecha_emision);
          break;
        case 'monto':
          comparison = a.total - b.total;
          break;
        case 'numero':
          comparison = (a.num_factura || '').localeCompare(b.num_factura || '');
          break;
        default:
          comparison = new Date(a.fecha_emision) - new Date(b.fecha_emision);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  // ============================================================
  // FUNCIONES DE MODAL
  // ============================================================
  const verDetalle = async (factura) => {
    setSelectedFactura(factura);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedFactura(null);
  };

  const closeUploadModal = () => {
    setShowUploadModal(false);
    setUploadingPago(null);
    setComprobante(null);
    setUploadProgress(0);
  };

  // ============================================================
  // FUNCIONES DE SUBIDA DE COMPROBANTE
  // ============================================================
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validar tipo de archivo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      alert('Solo se permiten archivos JPG, PNG o PDF');
      return;
    }

    // Validar tamaño (5MB máximo)
    if (file.size > 5 * 1024 * 1024) {
      alert('El archivo no debe superar los 5MB');
      return;
    }

    setComprobante(file);
  };

  const subirComprobante = async () => {
    if (!comprobante || !uploadingPago) {
      alert('Debes seleccionar un archivo');
      return;
    }

    setLoading(true);
    setUploadProgress(10);

    try {
      const result = await affiliateBillingServices.subirComprobantePago(
        uploadingPago.id_factura,
        comprobante,
        (progress) => setUploadProgress(progress)
      );

      if (result.success) {
        alert('Comprobante subido exitosamente. Será verificado por el administrador.');
        closeUploadModal();
        cargarFacturas(); // Recargar facturas
      } else {
        alert(result.message || 'Error al subir el comprobante');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al subir el comprobante');
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };


  // ============================================================
  // ✅ FUNCIÓN PARA DESCARGAR COMPROBANTE
  // ============================================================
  const descargarComprobante = async (idPago, nombreArchivo = null) => {
    try {
      console.log(`📥 Iniciando descarga del comprobante del pago #${idPago}`);
      
      const result = await affiliateBillingServices.descargarComprobante(idPago);
      
      if (result.success) {
        console.log(`✅ Comprobante descargado: ${result.filename}`);
        // Opcional: mostrar notificación de éxito
      } else {
        alert(`❌ ${result.message}`);
      }
    } catch (error) {
      console.error('Error descargando comprobante:', error);
      alert('Error al descargar el comprobante');
    }
  };

  // ============================================================
  // FUNCIONES DE UTILIDAD (SIN BUG DE ZONA HORARIA)
  // ============================================================

  const parseSafeDate = (dateString) => {
    // YYYY-MM-DD → fecha local
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [year, month, day] = dateString.split('-');
      return new Date(year, month - 1, day);
    }
    // Fechas con hora / timezone
    return new Date(dateString);
  };

  // Formatear fecha completa
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = parseSafeDate(dateString);
    return date.toLocaleDateString('es-EC', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Formatear fecha corta
  const formatDateShort = (dateString) => {
    if (!dateString) return 'N/A';
    const date = parseSafeDate(dateString);
    return date.toLocaleDateString('es-EC', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };


  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const limpiarFiltros = () => {
    setSearchTerm('');
    setFilterFechaDesde('');
    setFilterFechaHasta('');
    setFilterEstadoFactura('todos');
    setFilterMontoMin('');
    setFilterMontoMax('');
    setSortBy('fecha_emision');
    setSortOrder('desc');
    setSelectedAnio('');
    setSelectedMes('');
  };

  const handleRecargar = () => {
    cargarFacturas();
  };


  const getMetodoIcon = (metodo) => {
    switch (metodo?.toLowerCase()) {
      case 'efectivo':
        return <DollarSign className="w-3 h-3" />;
      case 'transferencia':
        return <CreditCard className="w-3 h-3" />;
      case 'tarjeta':
        return <CreditCard className="w-3 h-3" />;
      default:
        return <DollarSign className="w-3 h-3" />;
    }
  };

  // ============================================================
  // RENDERIZADO
  // ============================================================
  if (!permissions.canRead) {
    return (
      <div className="error-state">
        <div className="error-content">
          <AlertCircle className="error-icon" />
          <p>No tienes permiso para acceder a tus facturas.</p>
        </div>
      </div>
    );
  }

  if (loading && facturas.length === 0) {
    return (
      <div className="loading-state">
        <div className="loading-content">
          <RefreshCw className="loading-icon" />
          <p>Cargando tus facturas...</p>
        </div>
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
          <FileText className="w-7 h-7 text-blue-600" />
          <div>
            <h2>Mis Facturas y Pagos</h2>
            <p className="section-subtitle">Consulta y gestiona tus facturas de consumo de agua</p>
          </div>
        </div>
      </div>

      {/* MENSAJE DE ERROR */}
      {error && (
        <div className="alert alert-error mb-4">
          <AlertCircle className="w-5 h-5 mr-2" />
          {error}
        </div>
      )}

      {/* ==================== ESTADÍSTICAS DE FACTURAS ==================== */}
      {stats && (
        <div className="periodo-stats-container">
          {/* Header */}
          <div className="periodo-stats-header">
            <BarChart3 className="w-5 h-5 text-blue-600 mr-2" />
            <h3>Resumen de mis Facturas</h3>
          </div>

          {/* Cards */}
          <div className="users-stats">
            {/* 📄 Total facturas */}
            <div className="stat-item">
              <FileText className="stat-icon text-blue-600" />
              <div>
                <p className="stat-label">Total Facturas</p>
                <p className="stat-value">{stats.total_facturas}</p>
              </div>
            </div>

            {/* ✅ Facturas pagadas */}
            <div className="stat-item active green">
              <CheckCircle className="stat-icon text-green-600" />
              <div>
                <p className="stat-label">Pagadas</p>
                <p className="stat-value">{stats.total_pagadas}</p>
              </div>
            </div>

            {/* ⏳ Facturas pendientes */}
            <div className="stat-item active yellow">
              <Clock className="stat-icon text-yellow-600" />
              <div>
                <p className="stat-label">Pendientes</p>
                <p className="stat-value">{stats.total_pendientes}</p>
              </div>
            </div>

            {/* 💰 Monto total */}
            <div className="stat-item active blue">
              <DollarSign className="stat-icon text-blue-600" />
              <div>
                <p className="stat-label">Monto Total</p>
                <p className="stat-value">{formatCurrency(stats.monto_total)}</p>
              </div>
            </div>

            {/* 💵 Monto pagado */}
            <div className="stat-item active green">
              <TrendingUp className="stat-icon text-green-600" />
              <div>
                <p className="stat-label">Pagado</p>
                <p className="stat-value">{formatCurrency(stats.monto_pagado)}</p>
              </div>
            </div>

            {/* 💸 Por pagar */}
            <div className="stat-item active red">
              <TrendingDown className="stat-icon text-red-600" />
              <div>
                <p className="stat-label">Por Pagar</p>
                <p className="stat-value">{formatCurrency(stats.monto_pendiente)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== FILTROS PRINCIPALES — FACTURAS ==================== */}
      <div className="filters-main-container">
        
        {/* ✅ SECCIÓN 1: FILTRO POR PERIODO */}
        <div className="filters-section-card">
          <div className="filters-section-header">
            <Search className="w-4 h-4 text-blue-600" />
            <h4 className="filters-section-title">Filtro por periodo</h4>
          </div>
          
          <div className="filters-section-content-full">

            <div className="filter-group-row">
              {/* 📅 Año */}
              <div className="filter-group">
                <label className="filter-label">Año</label>
                <select
                  className="filter-select"
                  value={selectedAnio}
                  onChange={handleAnioChange}
                >
                  <option value="">Todos los años</option>
                  {aniosDisponibles.map(anio => (
                    <option key={anio} value={anio}>{anio}</option>
                  ))}
                </select>
              </div>

              {/* 📆 Mes */}
              <div className="filter-group">
                <label className="filter-label">Mes</label>
                <select
                  className="filter-select"
                  value={selectedMes}
                  onChange={(e) => setSelectedMes(e.target.value)}
                  disabled={!selectedAnio}
                >
                  <option value="">Todos los meses</option>
                  {mesesDelAnio.map(periodo => (
                    <option key={periodo.mes} value={periodo.mes}>
                      {periodo.nombre_mes} ({periodo.total_facturas})
                    </option>
                  ))}
                </select>
              </div>

            </div>
          </div>
        </div>

        {/* ✅ SECCIÓN 2: FILTROS Y ACCIONES */}
        <div className="filters-section-card">
          <div className="filters-section-header">
            <SlidersHorizontal className="w-4 h-4 text-purple-600" />
            <h4 className="filters-section-title">Filtros y Ordenamiento</h4>
          </div>
          
          <div className="filters-section-content">
            {/* 🎯 Estado de factura */}
            <div className="filter-group">
              <label className="filter-label">Estado</label>
              <select
                className="filter-select"
                value={filterEstadoFactura}
                onChange={(e) => setFilterEstadoFactura(e.target.value)}
              >
                <option value="todos">Todos</option>
                <option value="pendiente">Pendiente</option>
                <option value="pagada">Pagada</option>
                <option value="vencida">Vencida</option>
                <option value="anulada">Anulada</option>
              </select>
            </div>

            {/* 📊 Ordenar por */}
            <div className="filter-group">
              <label className="filter-label">Ordenar por</label>
              <select
                className="filter-select"
                value={sortBy}
                onChange={(e) => {
                  console.log(`📊 Nuevo criterio de orden: ${e.target.value}`);
                  setSortBy(e.target.value);
                }}
              >
                <option value="fecha_emision">Fecha</option>
                <option value="monto">Monto</option>
                <option value="numero">Número</option>
              </select>
            </div>

            {/* ⬆️⬇️ Dirección de orden */}
            <div className="filter-group">
              <label className="filter-label">Dirección</label>
              <button 
                className="filter-btn-toggle"
                onClick={toggleSortOrder}
                title={`${sortOrder === 'asc' ? 'Ascendente (menor a mayor)' : 'Descendente (mayor a menor)'}`}
              >
                <ArrowUpDown className="w-4 h-4" />
                <span>{sortOrder === 'asc' ? 'Ascendente' : 'Descendente'}</span>
              </button>
            </div>

            {/* Espacio vacío para mantener el grid */}
            <div />

            {/* Botones de acción */}
            <div className="filter-actions-group">
              {/* ❌ Limpiar filtros */}
              <button 
                className="filter-btn-action filter-btn-clear"
                onClick={limpiarFiltros}
                title="Limpiar todos los filtros"
              >
                <X className="w-4 h-4" />
                <span>Limpiar</span>
              </button>

              {/* 🔄 Recargar */}
              <button 
                className="filter-btn-action filter-btn-reload"
                onClick={handleRecargar}
                disabled={loading}
                title="Recargar lista"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Recargar</span>
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* LISTA DE FACTURAS */}
      <div className="facturas-container">
        <div className="facturas-header-row">
          <div className="facturas-header-title">
            <Receipt className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-lg">Registro de Facturas</h3>
          </div>
          <p className="facturas-count-text">
            {filteredFacturas.length} {filteredFacturas.length === 1 ? 'factura' : 'facturas'}
          </p>
        </div>

        {filteredFacturas.length === 0 ? (
          <div className="facturas-empty-state">
            <Receipt className="w-12 h-12 text-gray-300 mb-2" />
            <p>
              {facturas.length === 0
                ? 'No tienes facturas registradas aún.'
                : 'No hay facturas que coincidan con los filtros aplicados.'}
            </p>
          </div>
        ) : (
          <div className="facturas-grid-list">
            {filteredFacturas.map(factura => (
              <div
                key={factura.id_factura}
                className="factura-card-item"
              >
                {/* Columna 1: Información de la factura */}
                <div 
                  className="factura-info-section factura-clickable"
                  onClick={() => verDetalle(factura)}
                >
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <div className="factura-info-text">
                    <span className="factura-numero">
                      {factura.num_factura || `#${factura.id_factura}`}
                    </span>
                    <span className="factura-fecha-periodo">
                      {formatDateShort(factura.fecha_emision)} • {factura.periodo}
                    </span>
                  </div>
                </div>

                {/* Columna 2: Consumo y Total */}
                <div 
                  className="factura-stats-section factura-clickable"
                  onClick={() => verDetalle(factura)}
                >
                  <div className="factura-stat-box">
                    <Activity className="w-4 h-4 text-blue-500" />
                    <span>{factura.consumo_m3} m³</span>
                  </div>
                  <div className="factura-stat-box">
                    <DollarSign className="w-4 h-4 text-green-500" />
                    <span>{formatCurrency(factura.total)}</span>
                  </div>
                </div>

                {/* Columna 3: Usuario y Medidor */}
                <div 
                  className="factura-user-section factura-clickable"
                  onClick={() => verDetalle(factura)}
                >
                  <div className="factura-stat-box">
                    <User className="w-4 h-4 text-gray-500" />
                    <span className="factura-user-name">
                      {factura.usuario_afiliado?.usuario_sistema?.nombres}{' '}
                      {factura.usuario_afiliado?.usuario_sistema?.apellidos}
                    </span>
                  </div>
                  <div className="factura-stat-box">
                    <Gauge className="w-4 h-4 text-gray-500" />
                    <span className="factura-medidor-text">
                      Medidor: {factura.usuario_afiliado?.num_medidor || 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Columna 4: Estado de Pago */}
                <div 
                  className="factura-estado-section factura-clickable"
                  onClick={() => verDetalle(factura)}
                >
                  <div className="status-wrapper">
                    {getStatusBadge(factura.estado_factura)}
                  </div>
                </div>


                {/* ✅ Columna 5: Comprobante */}
                <div className="factura-comprobante-section">
                  {factura.pago && factura.pago.tiene_comprobante ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        descargarComprobante(factura.pago.id_pago, factura.pago.nombre_archivo);
                      }}
                      className="factura-comprobante-download"
                      title={`Descargar: ${factura.pago.nombre_archivo || 'comprobante.pdf'}`}
                    >
                      <FileCheck className="w-4 h-4" />
                      <span>Descargar</span>
                    </button>
                  ) : factura.pago && !factura.pago.tiene_comprobante ? (
                    <div 
                      className="factura-comprobante-none" 
                      title="Este pago no tiene comprobante"
                    >
                      <Paperclip className="w-4 h-4" />
                      <span>Sin comprobante</span>
                    </div>
                  ) : (
                    <div 
                      className="factura-comprobante-none" 
                      title="Sin pago registrado"
                    >
                      <Ban className="w-4 h-4" />
                      <span>Sin pago</span>
                    </div>
                  )}
                </div>

                {/* Columna 6: Ver Detalle */}
                <div className="factura-actions-section">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      verDetalle(factura);
                    }}
                    className="factura-btn-ver"
                  >
                    <Eye className="w-4 h-4" />
                    <span>Ver</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>


      {/* ============================================================ */}
      {/* MODAL DE DETALLE DE FACTURA */}
      {/* ============================================================ */}
      {showModal && selectedFactura && (
        <div className="modal-overlay">
          <div className="modal modal-factura">
            <div className="modal-header">
              <h3>
                <FileText className="w-5 h-5 inline mr-2" />
                Detalle de Factura {selectedFactura.num_factura}
              </h3>
              <button className="modal-close" onClick={closeModal}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="modal-body">
              {/* SECCIÓN DE INFORMACIÓN DE LA FACTURA */}
              <div className="factura-section">
                <h4 className="section-title">
                  <FileText className="w-4 h-4" />
                  Información de la Factura
                </h4>
                <div className="user-details">
                  <div className="detail-group">
                    <label>Número de Factura</label>
                    <p className="font-mono font-semibold">{selectedFactura.num_factura}</p>
                  </div>
                  <div className="detail-group">
                    <label>Fecha de Emisión</label>
                    <p>{formatDateShort(selectedFactura.fecha_emision)}</p>
                  </div>
                  <div className="detail-group">
                    <label>Periodo</label>
                    <p>{selectedFactura.periodo}</p>
                  </div>
                  <div className="detail-group">
                    <label>Estado</label>
                    {selectedFactura.estado_factura}
                  </div>
                </div>
              </div>

              {/* SECCIÓN DE AFILIADO */}
              {selectedFactura.usuario_afiliado && (
                <div className="factura-section">
                  <h4 className="section-title">
                    <User className="w-4 h-4" />
                    Datos del Afiliado
                  </h4>
                  <div className="user-details">
                    <div className="detail-group form-group-full">
                      <label>Nombre Afiliado:</label>
                      <p>
                        {selectedFactura.usuario_afiliado.usuario_sistema?.nombres}{' '}
                        {selectedFactura.usuario_afiliado.usuario_sistema?.apellidos}{' '}
                        - {selectedFactura.usuario_afiliado.usuario_sistema?.cedula || 'N/A'}
                      </p>
                    </div>

                    <div className="detail-group">
                      <label>Código Afiliado:</label>
                      <p className="font-mono">{selectedFactura.usuario_afiliado.cod_usuario_afi}</p>
                    </div>

                    <div className="detail-group">
                      <label>Medidor:</label>
                      <p className="font-mono font-semibold text-green-600">
                        {selectedFactura.usuario_afiliado.num_medidor}
                      </p>
                    </div>

                    <div className="detail-group">
                      <label>Email:</label>
                      <p>{selectedFactura.usuario_afiliado.usuario_sistema?.email || 'N/A'}</p>
                    </div>

                    <div className="detail-group">
                      <label>Teléfono:</label>
                      <p>{selectedFactura.usuario_afiliado.usuario_sistema?.telefono || 'N/A'}</p>
                    </div>

                    {selectedFactura.usuario_afiliado.sector && (
                      <div className="detail-group form-group-full">
                        <label>Sector</label>
                        <p className="flex items-center gap-1">
                          <MapPin className="w-4 h-4 text-blue-500" />
                          {selectedFactura.usuario_afiliado.sector.nombre_sector}
                        </p>
                      </div>
                    )}

                    {selectedFactura.usuario_afiliado.usuario_sistema?.direccion && (
                      <div className="detail-group form-group-full">
                        <label>Dirección</label>
                        <p>{selectedFactura.usuario_afiliado.usuario_sistema.direccion}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Sección de CONSUMO */}
              <div className="factura-section">
                <h4 className="section-title">
                  <Activity className="w-4 h-4" />
                  Consumo del Periodo
                </h4>
                <div className="user-details">
                  <div className="detail-group">
                    <label>Consumo Total</label>
                    <p className="font-bold text-lg">{selectedFactura.consumo_m3} m³</p>
                  </div>
                  <div className="detail-group">
                    <label>Exceso</label>
                    <p className="font-bold text-lg">{selectedFactura.exceso_m3 || 0} m³</p>
                  </div>
                  <div className="detail-group">
                    <label>Valor Consumo</label>
                    <p>{formatCurrency(selectedFactura.valor_consumo)}</p>
                  </div>
                  <div className="detail-group">
                    <label>Valor Exceso</label>
                    <p>{formatCurrency(selectedFactura.valor_exceso)}</p>
                  </div>
                </div>
              </div>

              {/* Sección de DETALLES/CONCEPTOS DE FACTURACIÓN */}
              {selectedFactura.detalles && selectedFactura.detalles.length > 0 && (
                <div className="factura-section">
                  <h4 className="section-title">
                    <FileText className="w-4 h-4" />
                    Conceptos de Facturación ({selectedFactura.detalles.length})
                  </h4>
                  <div className="detalles-factura-list">
                    {selectedFactura.detalles.map((detalle, index) => {
                      // Determinar el ícono y color según el tipo
                      const getTipoConfig = (tipo) => {
                        switch (tipo?.toLowerCase()) {
                          case 'consumo':
                            return {
                              icon: <DollarSign className="w-4 h-4" />,
                              color: '#10b981',
                              label: 'Consumo'
                            };
                          case 'servicio':
                            return {
                              icon: <CreditCard className="w-4 h-4" />,
                              color: '#3b82f6',
                              label: 'Servicio'
                            };
                          case 'multa':
                            return {
                              icon: <AlertCircle className="w-4 h-4" />,
                              color: '#ef4444',
                              label: 'Multa'
                            };
                          case 'otros':
                            return {
                              icon: <FileText className="w-4 h-4" />,
                              color: '#6b7280',
                              label: 'Otros'
                            };
                          default:
                            return {
                              icon: <FileText className="w-4 h-4" />,
                              color: '#6b7280',
                              label: tipo || 'Concepto'
                            };
                        }
                      };

                      const tipoConfig = getTipoConfig(detalle.tipo_detalle);

                      return (
                        <div key={detalle.id_detalle} className="detalle-factura-item">
                          <div className="detalle-header">
                            <div className="detalle-tipo" style={{ color: tipoConfig.color }}>
                              {tipoConfig.icon}
                              <span className="detalle-tipo-label">{tipoConfig.label}</span>
                            </div>
                            <span className="detalle-numero">#{index + 1}</span>
                          </div>
                          <div className="detalle-body">
                            <p className="detalle-descripcion">{detalle.descripcion}</p>
                            <div className="detalle-footer">
                              <span className="detalle-subtotal-label">Subtotal:</span>
                              <span className="detalle-subtotal-value" style={{ color: tipoConfig.color }}>
                                {formatCurrency(detalle.subtotal_detalle)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* TOTALES DE LA FACTURA */}
                    <div className="detalles-totales">
                      <div className="total-row">
                        <span>Subtotal:</span>
                        <span>{formatCurrency(selectedFactura.subtotal)}</span>
                      </div>
                      {parseFloat(selectedFactura.descuento) > 0 && (
                        <div className="total-row descuento">
                          <span>Descuento:</span>
                          <span className="text-green-600">
                            - {formatCurrency(selectedFactura.descuento)}
                          </span>
                        </div>
                      )}
                      {parseFloat(selectedFactura.impuesto) > 0 && (
                        <div className="total-row">
                          <span>Impuesto:</span>
                          <span>{formatCurrency(selectedFactura.impuesto)}</span>
                        </div>
                      )}
                      <div className="total-row total">
                        <span>Total:</span>
                        <span className="font-bold text-xl">
                          {formatCurrency(selectedFactura.total)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SECCIÓN DE PAGO */}
              {selectedFactura.pago && (
                <div className="factura-section">
                  <h4 className="section-title">
                    <DollarSign className="w-4 h-4" />
                    Información del Pago
                  </h4>
                  <div className="pagos-list">
                    <div
                      className={`pago-item ${selectedFactura.pago.estado_pago === 'ANULADO' ? 'pago-anulado' : ''}`}
                    >
                      {/* CABECERA DEL PAGO */}
                      <div className="pago-header">
                        <div className="pago-header-left">
                          <span className="pago-numero">Pago #{selectedFactura.pago.id_pago}</span>
                        </div>
                        {getStatusBadge(selectedFactura.pago.estado_pago)}
                      </div>

                      {/* DETALLES DEL PAGO */}
                      <div className="pago-details">
                        <div className="pago-detail">
                          <span className="pago-label">
                            <Calendar className="w-3 h-3" />
                            Fecha:
                          </span>
                          <span className="pago-value">{formatDate(selectedFactura.pago.fecha_pago)}</span>
                        </div>

                        <div className="pago-detail">
                          <span className="pago-label">
                            <DollarSign className="w-3 h-3" />
                            Monto:
                          </span>
                          <span className="pago-value font-bold text-green-600">
                            {formatCurrency(selectedFactura.pago.monto_pago)}
                          </span>
                        </div>

                        <div className="pago-detail">
                          <span className="pago-label">
                            {getMetodoIcon(selectedFactura.pago.metodo_pago)}
                            Método:
                          </span>
                          <span className="pago-value">
                            {selectedFactura.pago.metodo_pago}
                          </span>
                        </div>

                        {/* CAJERO */}
                        {selectedFactura.pago.cajero && (
                          <div className="pago-detail">
                            <span className="pago-label">
                              <User className="w-3 h-3" />
                              Cajero:
                            </span>
                            <span className="pago-value">
                              {selectedFactura.pago.cajero}
                            </span>
                          </div>
                        )}

                        {/* COMPROBANTE */}
                        {selectedFactura.pago.tiene_comprobante && (
                          <div className="pago-detail">
                            <span className="pago-label">
                              <Paperclip className="w-3 h-3" />
                              Comprobante:
                            </span>
                            <span className="pago-value text-green-600">
                              {selectedFactura.pago.nombre_archivo}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* OBSERVACIONES */}
                      {selectedFactura.pago.observaciones && (
                        <div className="pago-observaciones">
                          <span className="pago-obs-label">
                            <FileText className="w-3 h-3" />
                            Observaciones:
                          </span>
                          <p className="pago-obs-text">{selectedFactura.pago.observaciones}</p>
                        </div>
                      )}

                      {/* INFORMACIÓN DE ANULACIÓN */}
                      {selectedFactura.pago.estado_pago === 'ANULADO' && (
                        <div className="pago-anulacion-info">
                          <div className="anulacion-header">
                            <Ban className="w-4 h-4" />
                            <span>Pago Anulado</span>
                          </div>
                          {selectedFactura.pago.fecha_anulacion && (
                            <div className="anulacion-detail">
                              <span className="anulacion-label">Fecha de anulación:</span>
                              <span className="anulacion-value">
                                {formatDate(selectedFactura.pago.fecha_anulacion)}
                              </span>
                            </div>
                          )}
                          {selectedFactura.pago.motivo_anulacion && (
                            <div className="anulacion-detail">
                              <span className="anulacion-label">Motivo:</span>
                              <span className="anulacion-value">{selectedFactura.pago.motivo_anulacion}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* RESUMEN DE PAGOS */}
                  <div className="pagos-summary">
                    <div className="summary-header">
                      <TrendingUp className="w-4 h-4" />
                      <span>Resumen de Pago</span>
                    </div>
                    <div className="summary-row">
                      <span>Total Factura:</span>
                      <span className="font-bold">{formatCurrency(selectedFactura.total)}</span>
                    </div>
                    <div className="summary-row pagado">
                      <span>Total Pagado:</span>
                      <span className="font-bold text-green-600">
                        {formatCurrency(selectedFactura.monto_pagado)}
                      </span>
                    </div>
                    <div className="summary-row total">
                      <span>Saldo Pendiente:</span>
                      <span className={`font-bold ${
                        selectedFactura.saldo_pendiente > 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {formatCurrency(selectedFactura.saldo_pendiente)}
                      </span>
                    </div>

                    {/* INDICADOR VISUAL DEL PROGRESO */}
                    <div className="payment-progress">
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${(selectedFactura.monto_pagado / parseFloat(selectedFactura.total)) * 100}%`
                          }}
                        />
                      </div>
                      <span className="progress-percentage">
                        {((selectedFactura.monto_pagado / parseFloat(selectedFactura.total)) * 100).toFixed(1)}% pagado
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* MENSAJE SI NO HAY PAGO */}
              {!selectedFactura.pago && (
                <div className="factura-section">
                  <div className="empty-state-small">
                    <AlertCircle className="w-8 h-8 text-gray-400" />
                    <p>No hay pago registrado para esta factura</p>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeModal}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL DE SUBIDA DE COMPROBANTE */}
      {/* ============================================================ */}
      {showUploadModal && uploadingPago && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>
                <Upload className="w-5 h-5 inline mr-2" />
                Subir Comprobante de Pago
              </h3>
              <button className="modal-close" onClick={closeUploadModal}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-group">
                <label>Factura:</label>
                <p className="font-medium">
                  {uploadingPago.num_factura || `#${uploadingPago.id_factura}`}
                </p>
              </div>

              <div className="detail-group">
                <label>Monto a pagar:</label>
                <p className="font-bold text-lg text-blue-600">
                  {formatCurrency(uploadingPago.saldo_pendiente)}
                </p>
              </div>

              <div className="detail-group">
                <label className="filter-label">
                  Seleccionar comprobante (JPG, PNG, PDF - máx. 5MB)
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,application/pdf"
                  onChange={handleFileSelect}
                  className="filter-input"
                />
                {comprobante && (
                  <p className="mt-2 text-sm text-green-600 flex items-center gap-1">
                    <Paperclip className="w-4 h-4" />
                    {comprobante.name}
                  </p>
                )}
              </div>

              {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              )}

              <div className="alert alert-warning">
                <AlertCircle className="w-4 h-4" />
                <p className="text-sm">
                  <strong>Importante:</strong> El comprobante será revisado por el administrador
                  antes de aprobar tu pago.
                </p>
              </div>
            </div>

            <div className="modal-footer">
              <button
                onClick={closeUploadModal}
                className="btn-secondary"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                onClick={subirComprobante}
                disabled={!comprobante || loading}
                className="btn-primary"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 spin-animation" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Subir Comprobante
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AffiliateBillingSection;
