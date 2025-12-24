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
  Filter,
  Download,
  Upload,
  CheckCircle,
  Clock,
  Receipt,
  Paperclip,
  Info, XCircle
} from 'lucide-react';

const AffiliateBillingSection = () => {
  // ============================================================
  // ESTADOS PRINCIPALES
  // ============================================================
  const [facturas, setFacturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
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
  const [filterEstadoPago, setFilterEstadoPago] = useState('todos');
  const [filterEstadoFactura, setFilterEstadoFactura] = useState('todos');
  const [filterMontoMin, setFilterMontoMin] = useState('');
  const [filterMontoMax, setFilterMontoMax] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [sortBy, setSortBy] = useState('fecha_emision');
  const [showFilters, setShowFilters] = useState(false);

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
    authService.hasPermission('Facturasypagos', 'lectura') ||
    authService.hasPermission('Facturasypagos', 'crud');

  const canUpload =
    authService.hasPermission('Facturasypagos', 'escritura') ||
    authService.hasPermission('Facturasypagos', 'crud');

  console.log('🔐 Permisos cargados:', { canRead, canUpload });
  setPermissions({ canRead, canUpload });
};


  const loadCurrentUser = () => {
    const user = authService.getStoredUser();
    if (user) {
      setCurrentUser(user);
    }
  };

  // ============================================================
  // FUNCIONES DE PERIODOS (AÑOS Y MESES DISPONIBLES)
  // ============================================================
  
  const fetchPeriodosDisponibles = useCallback(async () => {
    try {
      const result = await affiliateBillingServices.getPeriodosFacturasDisponibles();
      
      if (result.success) {
        setAniosDisponibles(result.data.anios_disponibles || []);
        setPeriodosDisponibles(result.data.periodos || {});
        
        if (result.data.anios_disponibles && result.data.anios_disponibles.length > 0) {
          const anioReciente = result.data.anios_disponibles[0];
          setSelectedAnio(anioReciente);
          setMesesDelAnio(result.data.periodos[anioReciente] || []);
        }
      } else {
        console.error('Error al cargar periodos:', result.message);
      }
    } catch (error) {
      console.error('❌ Error obteniendo periodos:', error);
    }
  }, []);

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
  
  const fetchFacturasPorPeriodo = useCallback(async () => {
    if (!permissions.canRead) {
      setError('No tienes permiso para ver tus facturas');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await affiliateBillingServices.getMisFacturasPorPeriodo(
        selectedAnio || null,
        selectedMes || null,
        { 
          estado_pago: filterEstadoPago,
          estado_factura: filterEstadoFactura 
        }
      );

      if (result.success) {
        setFacturas(result.data);
        calcularEstadisticas(result.data);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Error al cargar tus facturas');
      console.error('❌ Error cargando facturas:', err);
    } finally {
      setLoading(false);
    }
  }, [permissions.canRead, selectedAnio, selectedMes, filterEstadoPago, filterEstadoFactura]);

  // ============================================================
  // EFECTOS - CARGA INICIAL Y ACTUALIZACIÓN
  // ============================================================
  
// ============================================================
// EFECTOS - CARGA INICIAL Y ACTUALIZACIÓN
// ============================================================
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
          setSelectedAnio(anioReciente);
          setMesesDelAnio(resultPeriodos.data.periodos[anioReciente] || []);
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
}, [permissions.canRead]); // Solo depende de permissions

// Recargar facturas cuando cambien los filtros
useEffect(() => {
  if (permissions.canRead && aniosDisponibles.length > 0) {
    cargarFacturas();
  }
}, [selectedAnio, selectedMes, filterEstadoPago, filterEstadoFactura]);

// Función simplificada para cargar facturas
const cargarFacturas = async () => {
  if (!permissions.canRead) {
    setError('No tienes permiso para ver tus facturas');
    setLoading(false);
    return;
  }

  console.log('📊 Cargando facturas con filtros:', {
    anio: selectedAnio,
    mes: selectedMes,
    estadoPago: filterEstadoPago,
    estadoFactura: filterEstadoFactura
  });

  setLoading(true);
  setError(null);
  
  try {
    const result = await affiliateBillingServices.getMisFacturasPorPeriodo(
      selectedAnio || null,
      selectedMes || null,
      {
        estado_pago: filterEstadoPago,
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
};


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
    const pagadas = facturasData.filter(f => f.estado_pago === 'pagada').length;
    const pendientes = facturasData.filter(f => f.estado_pago === 'pendiente').length;
    
    const montoTotal = facturasData.reduce((sum, f) => sum + (f.total || 0), 0);
    const montoPagado = facturasData
      .filter(f => f.estado_pago === 'pagada')
      .reduce((sum, f) => sum + (f.total || 0), 0);
    const montoPendiente = facturasData
      .filter(f => f.estado_pago === 'pendiente')
      .reduce((sum, f) => sum + (f.total || 0), 0);
    
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
  
 const filteredFacturas = facturas
  .filter(factura => {
    const matchesSearch =
      factura.numero_factura?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      factura.id_factura?.toString().includes(searchTerm) ||
      factura.observacion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      // 🆕 BUSCAR POR DATOS DE USUARIO
      factura.usuario?.nombre_completo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      factura.usuario?.cedula?.includes(searchTerm) ||
      factura.usuario?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      factura.sector?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesEstadoPago =
      filterEstadoPago === 'todos' || factura.estado_factura === filterEstadoPago;

    const matchesEstadoFactura =
      filterEstadoFactura === 'todos' || factura.estado_factura === filterEstadoFactura;

    const fechaEmision = new Date(factura.fecha_emision);
    const matchesFechaDesde = !filterFechaDesde || fechaEmision >= new Date(filterFechaDesde);
    const matchesFechaHasta = !filterFechaHasta || fechaEmision <= new Date(filterFechaHasta);
    const matchesMontoMin = !filterMontoMin || factura.total >= parseFloat(filterMontoMin);
    const matchesMontoMax = !filterMontoMax || factura.total <= parseFloat(filterMontoMax);

    return matchesSearch && matchesEstadoPago && matchesEstadoFactura &&
      matchesFechaDesde && matchesFechaHasta && matchesMontoMin && matchesMontoMax;
  })
  .sort((a, b) => {
    let comparison = 0;
    switch(sortBy) {
      case 'fecha_emision':
        comparison = new Date(a.fecha_emision) - new Date(b.fecha_emision);
        break;
      case 'monto':
        comparison = a.total - b.total;
        break;
      case 'numero':
        comparison = (a.numero_factura || '').localeCompare(b.numero_factura || '');
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

  const openUploadModal = (factura) => {
    setUploadingPago(factura);
    setShowUploadModal(true);
    setComprobante(null);
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
        fetchFacturasPorPeriodo(); // Recargar facturas
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
  // FUNCIONES DE UTILIDAD
  // ============================================================
  
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString + 'T00:00:00').toLocaleDateString('es-EC', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateShort = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString + 'T00:00:00').toLocaleDateString('es-EC', {
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
    setFilterEstadoPago('todos');
    setFilterEstadoFactura('todos');
    setFilterMontoMin('');
    setFilterMontoMax('');
    setSortBy('fecha_emision');
    setSortOrder('desc');
    setSelectedAnio('');
    setSelectedMes('');
  };

  const exportarDatos = async () => {
    if (facturas.length === 0) {
      alert('No hay datos para exportar');
      return;
    }

    setLoading(true);
    
    try {
      const result = await affiliateBillingServices.exportarFacturas(
        selectedAnio || null,
        selectedMes || null,
        {
          estado_pago: filterEstadoPago,
          estado_factura: filterEstadoFactura
        }
      );
      
      if (result.success) {
        console.log(`✅ Archivo descargado: ${result.filename}`);
      } else {
        alert(result.message || 'Error al exportar datos');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al descargar el archivo');
    } finally {
      setLoading(false);
    }
  };

  const getEstadoPagoBadge = (estadoPago) => {
    const badges = {
      'pagada': { color: 'bg-green-100 text-green-800', icon: CheckCircle, text: 'Pagada' },
      'pendiente': { color: 'bg-yellow-100 text-yellow-800', icon: Clock, text: 'Pendiente' },
      'vencida': { color: 'bg-red-100 text-red-800', icon: AlertCircle, text: 'Vencida' },
      'parcial': { color: 'bg-blue-100 text-blue-800', icon: Info, text: 'Pago Parcial' }
    };
    
    const badge = badges[estadoPago] || badges['pendiente'];
    const Icon = badge.icon;
    
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="w-3 h-3" />
        {badge.text}
      </span>
    );
  };

  // ============================================================
  // RENDERIZADO - ESTADOS ESPECIALES
  // ============================================================
  
  if (!permissions.canRead) {
    return (
      <div className="users-section">
        <div className="empty-state">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3>Sin permisos</h3>
          <p>No tienes permiso para acceder a tus facturas.</p>
        </div>
      </div>
    );
  }

  if (loading && facturas.length === 0) {
    return (
      <div className="users-section">
        <div className="empty-state">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
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
          <Receipt className="w-6 h-6 text-blue-600" />
          <h2>Mis Facturas y Pagos</h2>
        </div>
        <div className="flex items-center gap-3">
          <button 
            className="btn-primary"
            onClick={exportarDatos}
            title="Exportar a CSV"
          >
            <Download className="w-4 h-4" />
            <span className="ml-2">Exportar</span>
          </button>
        </div>
      </div>

      {/* MENSAJE DE ERROR */}
      {error && (
        <div className="alert alert-error mb-4">
          <AlertCircle className="w-5 h-5 mr-2" />
          {error}
        </div>
      )}

      {/* ==================== ESTADÍSTICAS ==================== */}
      {stats && (
        <div className="periodo-stats-container">

          {/* Header */}
          <div className="periodo-stats-header">
            <FileText className="w-5 h-5 text-blue-600 mr-2" />
            <h3>Resumen de Facturación</h3>
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

            {/* ✅ Pagadas */}
            <div className="stat-item active green">
              <CheckCircle className="stat-icon text-green-600" />
              <div>
                <p className="stat-label">Pagadas</p>
                <p className="stat-value">{stats.total_pagadas}</p>
              </div>
            </div>

            {/* ⏳ Pendientes */}
            <div className="stat-item active orange">
              <Clock className="stat-icon text-orange-600" />
              <div>
                <p className="stat-label">Pendientes</p>
                <p className="stat-value">{stats.total_pendientes}</p>
              </div>
            </div>

            {/* 💰 Monto total */}
            <div className="stat-item active purple">
              <DollarSign className="stat-icon text-purple-600" />
              <div>
                <p className="stat-label">Monto Total</p>
                <p className="stat-value text-sm">
                  {formatCurrency(stats.monto_total)}
                </p>
              </div>
            </div>

            {/* 📈 Pagado */}
            <div className="stat-item active green">
              <TrendingUp className="stat-icon text-green-600" />
              <div>
                <p className="stat-label">Pagado</p>
                <p className="stat-value text-sm">
                  {formatCurrency(stats.monto_pagado)}
                </p>
              </div>
            </div>

            {/* ⚠️ Por pagar */}
            <div className="stat-item active red">
              <AlertCircle className="stat-icon text-red-600" />
              <div>
                <p className="stat-label">Por Pagar</p>
                <p className="stat-value text-sm">
                  {formatCurrency(stats.monto_pendiente)}
                </p>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* FILTROS PRINCIPALES */}
      <div className="filters-section">
        <div />
        <div className="filters-right">
          <select
            className="filter-select"
            value={selectedAnio}
            onChange={handleAnioChange}
          >
            <option value="">Todos los años</option>
            {aniosDisponibles.map(anio => (
              <option key={anio} value={anio}>
                {anio}
              </option>
            ))}
          </select>

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

          <select
            className="filter-select"
            value={filterEstadoPago}
            onChange={(e) => setFilterEstadoPago(e.target.value)}
          >
            <option value="todos">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="pagada">Pagada</option>
            <option value="vencida">Vencida</option>
            <option value="parcial">Pago Parcial</option>
          </select>

          <button
            className="btn-secondary"
            onClick={() => setShowFilters(!showFilters)}
            title="Más filtros"
          >
            <Filter className="w-4 h-4" />
          </button>

          <button
            className="btn-secondary"
            onClick={limpiarFiltros}
            title="Limpiar filtros"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* FILTROS AVANZADOS */}
      {showFilters && (
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha Desde
              </label>
              <input
                type="date"
                className="filter-select w-full"
                value={filterFechaDesde}
                onChange={(e) => setFilterFechaDesde(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha Hasta
              </label>
              <input
                type="date"
                className="filter-select w-full"
                value={filterFechaHasta}
                onChange={(e) => setFilterFechaHasta(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Monto Mínimo ($)
              </label>
              <input
                type="number"
                className="filter-select w-full"
                placeholder="Ej: 10"
                value={filterMontoMin}
                onChange={(e) => setFilterMontoMin(e.target.value)}
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Monto Máximo ($)
              </label>
              <input
                type="number"
                className="filter-select w-full"
                placeholder="Ej: 100"
                value={filterMontoMax}
                onChange={(e) => setFilterMontoMax(e.target.value)}
                min="0"
                step="0.01"
              />
            </div>
          </div>
          <div className="mt-3 text-sm text-gray-600">
            Mostrando {filteredFacturas.length} de {facturas.length} facturas
          </div>
        </div>
      )}

{/* LISTA DE FACTURAS */}
<div className="periodo-historial-container">
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-2">
      <Receipt className="w-5 h-5 text-blue-600" />
      <h3 className="font-semibold text-lg">Registro de Facturas</h3>
    </div>
    <p className="text-sm text-gray-600">
      {filteredFacturas.length} {filteredFacturas.length === 1 ? 'factura' : 'facturas'}
    </p>
  </div>

  {filteredFacturas.length === 0 ? (
    <div className="periodo-historial-empty">
      <Receipt className="w-12 h-12 text-gray-300 mb-2" />
      <p>
        {facturas.length === 0
          ? 'No tienes facturas registradas aún.'
          : 'No hay facturas que coincidan con los filtros aplicados.'}
      </p>
    </div>
  ) : (
    <div className="periodo-historial-list">
      {filteredFacturas.map(factura => (
        <button
          key={factura.id_factura}
          onClick={() => verDetalle(factura)}
          className="periodo-historial-list-item"
        >
          {/* COLUMNA 1: USUARIO */}
          <div className="periodo-historial-col-usuario">
            <div className="periodo-historial-avatar">
              {factura.usuario?.nombre?.charAt(0)?.toUpperCase() || 'U'}
              {factura.usuario?.apellido?.charAt(0)?.toUpperCase() || ''}
            </div>
            <div className="periodo-historial-usuario-info">
              <span className="periodo-historial-usuario-nombre">
                {factura.usuario?.nombre_completo || 'Usuario'}
              </span>
              <span className="periodo-historial-usuario-meta">
                CI: {factura.usuario?.cedula || 'N/A'}
              </span>
              <span className="periodo-historial-usuario-meta">
                📍 {factura.sector || 'Sin sector'}
              </span>
            </div>
          </div>

          {/* COLUMNA 2: FACTURA */}
          <div className="periodo-historial-col-factura">
            <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <div className="periodo-historial-factura-info">
              <span className="periodo-historial-fecha">
                {formatDateShort(factura.fecha_emision)}
              </span>
              <span className="periodo-historial-numero">
                {factura.numero_factura || `#${factura.id_factura}`}
              </span>
              <span className="periodo-historial-periodo">
                {factura.periodo}
              </span>
            </div>
          </div>

          {/* COLUMNA 3: ESTADÍSTICAS */}
          <div className="periodo-historial-col-stats">
            <div className="periodo-historial-stat-item">
              <DollarSign className="w-4 h-4 text-green-500" />
              <div className="flex flex-col">
                <span className="periodo-historial-stat-valor">
                  {formatCurrency(factura.total)}
                </span>
                {factura.consumo_m3 && (
                  <span className="periodo-historial-stat-label">
                    {factura.consumo_m3} m³
                  </span>
                )}
              </div>
            </div>

            {factura.fecha_vencimiento && (
              <>
                <span className="periodo-historial-stat-separator">•</span>
                <div className="periodo-historial-stat-item">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="periodo-historial-stat-label">
                    {formatDateShort(factura.fecha_vencimiento)}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* COLUMNA 4: ESTADO */}
          <div className="periodo-historial-col-estado">
            <div className={`periodo-historial-badge ${factura.estado_factura}`}>
              {factura.estado_factura === 'pagada' && (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Pagada</span>
                </>
              )}
              {factura.estado_factura === 'pendiente' && (
                <>
                  <Clock className="w-4 h-4" />
                  <span>Pendiente</span>
                </>
              )}
              {factura.estado_factura === 'vencida' && (
                <>
                  <AlertCircle className="w-4 h-4" />
                  <span>Vencida</span>
                </>
              )}
              {factura.estado_factura === 'anulada' && (
                <>
                  <XCircle className="w-4 h-4" />
                  <span>Anulada</span>
                </>
              )}
            </div>
            
            {factura.tiene_pagos && (
              <div className="periodo-historial-badge-pagos">
                <CheckCircle className="w-3 h-3" />
                <span>{factura.total_pagos} pago{factura.total_pagos > 1 ? 's' : ''}</span>
              </div>
            )}
          </div>

          {/* COLUMNA 5: ACCIÓN */}
          <div className="periodo-historial-col-action">
            <Eye className="w-4 h-4" />
            <span>Ver</span>
          </div>
        </button>
      ))}
    </div>
  )}
</div>


{/* BOTÓN FLOTANTE PARA SUBIR COMPROBANTE (OPCIONAL) */}
{permissions.canUpload && filteredFacturas.some(f => f.estado_factura !== 'pagada') && (
  <div className="fixed bottom-6 right-6 z-10">
    <button
      onClick={() => {
        const facturaPendiente = filteredFacturas.find(f => f.estado_factura !== 'pagada');
        if (facturaPendiente) openUploadModal(facturaPendiente);
      }}
      className="btn-primary rounded-full w-14 h-14 flex items-center justify-center shadow-lg hover:shadow-xl transition-shadow"
      title="Subir comprobante"
    >
      <Upload className="w-6 h-6" />
    </button>
  </div>
)}


      {/* ==================== MODAL DE DETALLES DE FACTURA ==================== */}
      {showModal && selectedFactura && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>
                <Eye className="w-5 h-5 inline mr-2" />
                Detalle de Factura
              </h3>
              <button className="modal-close" onClick={closeModal}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="modal-body">
              <div className="user-details">

                {/* INFORMACIÓN DEL USUARIO */}
                <div className="detail-group">
                  <label>Nombre Completo:</label>
                  <p>{selectedFactura.usuario?.nombre_completo || 'N/A'}</p>
                </div>

                <div className="detail-group">
                  <label>Cédula:</label>
                  <p>{selectedFactura.usuario?.cedula || 'N/A'}</p>
                </div>

                <div className="detail-group">
                  <label>Email:</label>
                  <p>{selectedFactura.usuario?.email || 'N/A'}</p>
                </div>

                {selectedFactura.usuario?.telefono && (
                  <div className="detail-group">
                    <label>Teléfono:</label>
                    <p>{selectedFactura.usuario?.telefono}</p>
                  </div>
                )}

                <div className="detail-group">
                  <label>Sector:</label>
                  <p>📍 {selectedFactura.sector || 'Sin sector asignado'}</p>
                </div>

                {/* SEPARADOR */}
                <div className="detail-separator"></div>

                {/* INFORMACIÓN DE LA FACTURA */}
                <div className="detail-group">
                  <label>Número de Factura:</label>
                  <p className="font-mono font-semibold text-blue-600">
                    {selectedFactura.numero_factura || `#${selectedFactura.id_factura}`}
                  </p>
                </div>

                <div className="detail-group">
                  <label>Periodo:</label>
                  <p className="font-semibold">{selectedFactura.periodo}</p>
                </div>

                <div className="detail-group">
                  <label>Fecha de Emisión:</label>
                  <p>{formatDate(selectedFactura.fecha_emision)}</p>
                </div>

                <div className="detail-group">
                  <label>Fecha de Vencimiento:</label>
                  <p>{formatDate(selectedFactura.fecha_vencimiento)}</p>
                </div>

                <div className="detail-group">
                  <label>Estado de Factura:</label>
                  <p>{getEstadoPagoBadge(selectedFactura.estado_factura)}</p>
                </div>

                {selectedFactura.consumo_m3 && (
                  <div className="detail-group">
                    <label>Consumo:</label>
                    <p className="font-semibold">{selectedFactura.consumo_m3} m³</p>
                  </div>
                )}

                {/* SEPARADOR */}
                <div className="detail-separator"></div>

                {/* DETALLE DE COBRO */}
                <div className="detail-group">
                  <label>Subtotal:</label>
                  <p className="font-semibold">{formatCurrency(selectedFactura.subtotal)}</p>
                </div>

                {selectedFactura.impuesto > 0 && (
                  <div className="detail-group">
                    <label>Impuestos:</label>
                    <p className="font-semibold">{formatCurrency(selectedFactura.impuesto)}</p>
                  </div>
                )}

                {selectedFactura.descuento > 0 && (
                  <div className="detail-group">
                    <label>Descuentos:</label>
                    <p className="font-semibold text-green-600">
                      -{formatCurrency(selectedFactura.descuento)}
                    </p>
                  </div>
                )}

                <div className="detail-group">
                  <label className="text-lg">Total a Pagar:</label>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(selectedFactura.total)}
                  </p>
                </div>

                {/* INFORMACIÓN DE PAGOS */}
                {selectedFactura.tiene_pagos && (
                  <>
                    <div className="detail-separator"></div>
                    <div className="detail-group">
                      <label>Pagos Registrados:</label>
                      <span className="status-badge active">
                        <CheckCircle className="w-3 h-3" />
                        {selectedFactura.total_pagos} pago{selectedFactura.total_pagos > 1 ? 's' : ''}
                      </span>
                    </div>
                  </>
                )}

                {selectedFactura.observacion && (
                  <>
                    <div className="detail-separator"></div>
                    <div className="detail-group">
                      <label>Observación:</label>
                      <p className="bg-gray-50 p-3 rounded border border-gray-200">
                        {selectedFactura.observacion}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ==================== MODAL DE SUBIDA DE COMPROBANTE ==================== */}
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
              <div className="user-form">
                {/* INFORMACIÓN DE LA FACTURA */}
                <div className="form-section">
                  <h4 className="section-title">Información de la Factura</h4>
                  
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Número de Factura</label>
                      <input
                        type="text"
                        value={uploadingPago.numero_factura || `#${uploadingPago.id_factura}`}
                        readOnly
                        className="readonly-input"
                      />
                    </div>

                    <div className="form-group">
                      <label>Monto Total</label>
                      <input
                        type="text"
                        value={formatCurrency(uploadingPago.total)}
                        readOnly
                        className="readonly-input font-bold text-blue-600"
                      />
                    </div>

                    <div className="form-group form-group-full">
                      <label>Fecha de Emisión</label>
                      <input
                        type="text"
                        value={formatDateShort(uploadingPago.fecha_emision)}
                        readOnly
                        className="readonly-input"
                      />
                    </div>
                  </div>
                </div>

                {/* SUBIDA DE ARCHIVO */}
                <div className="form-section">
                  <div className="form-group form-group-full">
                    <label>Seleccionar Comprobante *</label>
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,application/pdf"
                      onChange={handleFileSelect}
                      className="block w-full text-sm text-gray-500
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-full file:border-0
                        file:text-sm file:font-semibold
                        file:bg-blue-50 file:text-blue-700
                        hover:file:bg-blue-100 cursor-pointer"
                    />
                    <p className="mt-2 text-xs text-gray-500">
                      Formatos permitidos: JPG, PNG, PDF (máx. 5MB)
                    </p>
                  </div>

                  {comprobante && (
                    <div className="form-group form-group-full">
                      <div className="alert alert-success">
                        <Paperclip className="w-4 h-4" />
                        <div className="flex flex-col">
                          <span className="font-medium">{comprobante.name}</span>
                          <span className="text-xs">
                            {(comprobante.size / 1024).toFixed(2)} KB
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {uploadProgress > 0 && (
                    <div className="form-group form-group-full">
                      <label>Progreso de subida</label>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                          className="bg-blue-600 h-3 rounded-full transition-all duration-300 flex items-center justify-end pr-2"
                          style={{ width: `${uploadProgress}%` }}
                        >
                          <span className="text-xs text-white font-semibold">
                            {uploadProgress}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ADVERTENCIA */}
                <div className="form-section">
                  <div className="alert alert-warning">
                    <AlertCircle className="w-4 h-4" />
                    <span>
                      El comprobante será verificado por el administrador antes de confirmar el pago.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button 
                type="button" 
                className="btn-secondary"
                onClick={closeUploadModal}
                disabled={loading}
              >
                Cancelar
              </button>
              <button 
                type="button" 
                className="btn-primary"
                onClick={subirComprobante}
                disabled={!comprobante || loading}
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
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