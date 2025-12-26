// src/sections/HistorialConsumos.js
// MÓDULO DE HISTORIAL DE CONSUMOS MEJORADO - Para afiliados
import React, { useState, useEffect, useCallback } from 'react';
import affiliateGeneralServices from '../../services/affiliateGeneralServices';
import authService from '../../services/authServices';
import { 
  Droplet,
  Eye,
  Calendar,
  Activity,
  AlertCircle,
  FileText,
  BarChart3,
  TrendingUp,
  RefreshCw,
  X,
  Download,
  TrendingDown,
  CheckCircle,
  XCircle,
  Clock,
  Gauge, ArrowUpDown
} from 'lucide-react';

const HistorialConsumos = () => {

  // ============================================================
  // ESTADOS PRINCIPALES
  // ============================================================
  const [lecturas, setLecturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingExport, setLoadingExport] = useState(false); // ✅ NUEVO ESTADO
  const [error, setError] = useState(null);
  const [, setCurrentUser] = useState(null);
  const [permissions, setPermissions] = useState({ canRead: false });
  const [isInitialized, setIsInitialized] = useState(false);


  // ============================================================
  // ESTADOS DE FILTROS Y BÚSQUEDA
  // ============================================================
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFechaDesde, setFilterFechaDesde] = useState('');
  const [filterFechaHasta, setFilterFechaHasta] = useState('');
  const [filterTipoLectura, setFilterTipoLectura] = useState('todas');
  const [filterConsumoMin, setFilterConsumoMin] = useState('');
  const [filterConsumoMax, setFilterConsumoMax] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [sortBy, setSortBy] = useState('fecha');

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
  const [selectedLectura, setSelectedLectura] = useState(null);
  const [stats, setStats] = useState({
    total_lecturas: 0,
    consumo_promedio: 0,
    consumo_total: 0,
    mes_mayor_consumo: null,
    mes_menor_consumo: null,
    tendencia: null
  });

  // 
  const fetchPeriodosDisponibles = useCallback(async () => {
    try {
      const result = await affiliateGeneralServices.getPeriodosMisLecturas();
      if (result.success) {
        setAniosDisponibles(result.data.anios_disponibles || []);
        setPeriodosDisponibles(result.data.periodos || {});
        
        // ✅ Retornar el año reciente en lugar de setearlo
        if (result.data.anios_disponibles && result.data.anios_disponibles.length > 0) {
          return result.data.anios_disponibles[0];
        }
      }
      return null;
    } catch (error) {
      console.error('❌ Error obteniendo periodos:', error);
      return null;
    }
  }, []);

  // ============================================================
  // EFECTOS - CARGA INICIAL Y ACTUALIZACIÓN
  // ============================================================


  // ✅ 2. Cargar periodos una sola vez al inicio
  useEffect(() => {
    const inicializar = async () => {
      if (permissions.canRead && !isInitialized) {
        const anioReciente = await fetchPeriodosDisponibles();
        if (anioReciente) {
          setSelectedAnio(anioReciente);
          setMesesDelAnio(periodosDisponibles[anioReciente] || []);
        }
        setIsInitialized(true);
      }
    };
    
    inicializar();
  }, [permissions.canRead, isInitialized,fetchPeriodosDisponibles, periodosDisponibles]); 

  // ✅ 3. Cargar lecturas solo cuando cambien los filtros reales
  useEffect(() => {
    const cargarLecturas = async () => {
      if (!permissions.canRead || !isInitialized) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await affiliateGeneralServices.getMisLecturasPorPeriodo(
          selectedAnio || null,
          selectedMes || null,
          { tipo_lectura: filterTipoLectura }
        );

        if (result.success) {
          setLecturas(result.data);
          calcularEstadisticas(result.data);
        } else {
          setError(result.message);
        }
      } catch (err) {
        setError('Error al cargar tu historial de consumos');
        console.error('❌ Error cargando lecturas:', err);
      } finally {
        setLoading(false);
      }
    };

    cargarLecturas();
  }, [permissions.canRead, isInitialized, selectedAnio, selectedMes, filterTipoLectura]);

  // ============================================================
  // INICIALIZACIÓN - PERMISOS Y USUARIO
  // ============================================================
  useEffect(() => {
    loadUserPermissions();
    loadCurrentUser();
  }, []);

  const loadUserPermissions = () => {
    const canRead =
      authService.hasPermission('historialconsumo', 'lectura') ||
      authService.hasPermission('historialconsumo', 'crud') ||
      authService.hasPermission('historialconsumo', 'lectura');

    setPermissions({ canRead });
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
  
  /**
   * Manejar cambio de año seleccionado
   * Actualiza la lista de meses disponibles para ese año
   */
  const handleAnioChange = (e) => {
    const anio = e.target.value;
    setSelectedAnio(anio);
    setSelectedMes(''); // Resetear mes al cambiar año
    
    if (anio && periodosDisponibles[anio]) {
      setMesesDelAnio(periodosDisponibles[anio]);
    } else {
      setMesesDelAnio([]);
    }
  };

  // ============================================================
  // CÁLCULO DE ESTADÍSTICAS
  // ============================================================
  
  /**
   * Calcular estadísticas generales del historial de consumos
   * Incluye totales, promedios y tendencias
   */
  const calcularEstadisticas = (lecturasData) => {
    if (!lecturasData || lecturasData.length === 0) {
      setStats({
        total_lecturas: 0,
        consumo_promedio: 0,
        consumo_total: 0,
        mes_mayor_consumo: null,
        mes_menor_consumo: null,
        tendencia: null
      });
      return;
    }

    const total = lecturasData.length;
    const consumoTotal = lecturasData.reduce((sum, l) => sum + (l.consumo_m3 || 0), 0);
    const consumoPromedio = total > 0 ? (consumoTotal / total).toFixed(2) : 0;

    // Encontrar mayor y menor consumo
    const lecturaMayor = lecturasData.reduce((max, l) => 
      (l.consumo_m3 || 0) > (max.consumo_m3 || 0) ? l : max
    , lecturasData[0]);

    const lecturaMenor = lecturasData.reduce((min, l) => 
      (l.consumo_m3 || 0) < (min.consumo_m3 || 0) ? l : min
    , lecturasData[0]);

    // Calcular tendencia (comparar últimos 3 meses vs 3 anteriores)
    const lecturasOrdenadas = [...lecturasData].sort((a, b) => 
      new Date(b.fecha_lectura) - new Date(a.fecha_lectura)
    );
    
    let tendencia = null;
    if (lecturasOrdenadas.length >= 6) {
      const ultimos3 = lecturasOrdenadas.slice(0, 3);
      const anteriores3 = lecturasOrdenadas.slice(3, 6);
      
      const promedioUltimos = ultimos3.reduce((sum, l) => sum + l.consumo_m3, 0) / 3;
      const promedioAnteriores = anteriores3.reduce((sum, l) => sum + l.consumo_m3, 0) / 3;
      
      const diferencia = ((promedioUltimos - promedioAnteriores) / promedioAnteriores * 100).toFixed(1);
      tendencia = {
        direccion: promedioUltimos > promedioAnteriores ? 'aumento' : 'disminucion',
        porcentaje: Math.abs(diferencia)
      };
    }

    setStats({
      total_lecturas: total,
      consumo_promedio: parseFloat(consumoPromedio),
      consumo_total: consumoTotal.toFixed(2),
      mes_mayor_consumo: lecturaMayor,
      mes_menor_consumo: lecturaMenor,
      tendencia
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

  /**
   * Aplicar filtros y ordenamiento a las lecturas
   */
  const filteredLecturas = React.useMemo(() => {
    console.log(`🔍 Filtrando y ordenando: sortBy="${sortBy}", sortOrder="${sortOrder}"`);
    
    return lecturas
      .filter(lectura => {
        // Filtro de búsqueda por texto
        const matchesSearch = 
          lectura.medidor?.num_medidor?.toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
          lectura.observacion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          lectura.medidor?.sector?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          lectura.id_lectura?.toString().includes(searchTerm);

        // Filtro por tipo de lectura
        const matchesTipo = 
          filterTipoLectura === 'todas' ||
          (filterTipoLectura === 'reales' && !lectura.es_estimada) ||
          (filterTipoLectura === 'estimadas' && lectura.es_estimada);

        // Filtros por rango de fechas
        const fechaLectura = new Date(lectura.fecha_lectura);
        const matchesFechaDesde = !filterFechaDesde || fechaLectura >= new Date(filterFechaDesde);
        const matchesFechaHasta = !filterFechaHasta || fechaLectura <= new Date(filterFechaHasta);

        // Filtros por rango de consumo
        const matchesConsumoMin = !filterConsumoMin || lectura.consumo_m3 >= parseFloat(filterConsumoMin);
        const matchesConsumoMax = !filterConsumoMax || lectura.consumo_m3 <= parseFloat(filterConsumoMax);

        return matchesSearch && matchesTipo && matchesFechaDesde && matchesFechaHasta && 
              matchesConsumoMin && matchesConsumoMax;
      })
      .sort((a, b) => {
        let comparison = 0;
        
        switch(sortBy) {
          case 'fecha':
            comparison = new Date(a.fecha_lectura) - new Date(b.fecha_lectura);
            break;
          case 'consumo':
            comparison = (a.consumo_m3 || 0) - (b.consumo_m3 || 0);
            break;
          case 'medidor':
            comparison = (a.medidor?.num_medidor || '').localeCompare(b.medidor?.num_medidor || '');
            break;
          default:
            comparison = new Date(a.fecha_lectura) - new Date(b.fecha_lectura);
        }
        
        return sortOrder === 'asc' ? comparison : -comparison;
      });
  }, [
    lecturas, 
    searchTerm, 
    filterTipoLectura, 
    filterFechaDesde, 
    filterFechaHasta, 
    filterConsumoMin, 
    filterConsumoMax,
    sortBy,       
    sortOrder    
  ]);



  // ============================================================
  // FUNCIONES DE MODAL
  // ============================================================
  
  const verDetalle = (lectura) => {
    setSelectedLectura(lectura);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedLectura(null);
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

  const limpiarFiltros = () => {
    setSearchTerm('');
    setFilterFechaDesde('');
    setFilterFechaHasta('');
    setFilterTipoLectura('todas');
    setFilterConsumoMin('');
    setFilterConsumoMax('');
    setSortBy('fecha');
    setSortOrder('desc');
    setSelectedAnio('');
    setSelectedMes('');
  };

  /**
 * Exportar datos a CSV (ahora desde backend)
 */
 /**
 * Exportar datos a Excel desde backend
 */
  const exportarDatos = async () => {
    if (lecturas.length === 0) {
      alert('No hay datos para exportar');
      return;
    }

    setLoadingExport(true); // ✅ Usar estado separado
    
    try {
      const result = await affiliateGeneralServices.exportarLecturas(
        selectedAnio || null,
        selectedMes || null,
        { tipo_lectura: filterTipoLectura }
      );

      if (result.success) {
        console.log(`✅ Archivo descargado: ${result.filename}`);
        // Opcional: mostrar notificación de éxito
      } else {
        alert(result.message || 'Error al exportar datos');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al descargar el archivo');
    } finally {
      setLoadingExport(false); // ✅ Desactivar estado de exportación
    }
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
          <p>No tienes permiso para acceder al historial de consumos.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="users-section">
        <div className="empty-state">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Cargando tu historial de consumos...</p>
        </div>
      </div>
    );
  }

  // ============================================================
  // FUNCIÓN DE RECARGA
  // ============================================================
  const handleRecargar = async () => {
    console.log('🔄 Recargando datos...');
    setLoading(true);
    setError(null);

    try {
      
      // 2️⃣ Recargar lecturas con los filtros actuales
      const result = await affiliateGeneralServices.getMisLecturasPorPeriodo(
        selectedAnio || null,
        selectedMes || null,
        { tipo_lectura: filterTipoLectura }
      );

      if (result.success) {
        setLecturas(result.data);
        calcularEstadisticas(result.data);
        console.log(`✅ Recargado: ${result.data.length} lecturas`);
      } else {
        setError(result.message);
      }
    } catch (err) {
      console.error('❌ Error recargando:', err);
      setError('Error al recargar los datos');
    } finally {
      setLoading(false);
    }
  };


  // ============================================================
  // RENDERIZADO PRINCIPAL
  // ============================================================
  return (
    <div className="users-section">

    {/* HEADER */}
    <div className="section-header">
      <div className="section-title">
        <Clock className="w-7 h-7 text-blue-600" />
        <div>
          <h2>Mi Historial de Lecturas</h2>
          <p className="section-subtitle">Información de mi historial de Lecturas</p>
        </div>
      </div>
      
      <div className="flex items-center gap-3">

      <button 
        className={`btn-primary ${loadingExport ? 'opacity-75 cursor-wait' : ''}`}
        onClick={exportarDatos}
        disabled={loadingExport || lecturas.length === 0}
        title={
          lecturas.length === 0 
            ? 'No hay datos para exportar' 
            : 'Exportar a Excel'
        }
      >
        {loadingExport ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
            <span>Generando Excel...</span>
          </>
        ) : (
          <>
            <Download className="w-4 h-4 mr-2" />
            <span>Descargar Excel</span>
          </>
        )}
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

      {/* ==================== ESTADÍSTICAS DE LECTURAS ==================== */}
      {stats && (
        <div className="periodo-stats-container">

          {/* Header */}
          <div className="periodo-stats-header">
            <FileText className="w-5 h-5 text-blue-600 mr-2" />
            <h3>Resumen de mis Lecturas</h3>
          </div>

          {/* Cards */}
          <div className="users-stats">

            {/* 📄 Total lecturas */}
            <div className="stat-item">
              <FileText className="stat-icon text-blue-600" />
              <div>
                <p className="stat-label">Total Lecturas</p>
                <p className="stat-value">{stats.total_lecturas}</p>
              </div>
            </div>

            {/* 💧 Consumo total */}
            <div className="stat-item active green">
              <Activity className="stat-icon text-green-600" />
              <div>
                <p className="stat-label">Consumo Total</p>
                <p className="stat-value">{stats.consumo_total} m³</p>
              </div>
            </div>

            {/* 📊 Promedio mensual */}
            <div className="stat-item active yellow">
              <BarChart3 className="stat-icon text-yellow-600" />
              <div>
                <p className="stat-label">Promedio Mensual</p>
                <p className="stat-value">{stats.consumo_promedio} m³</p>
              </div>
            </div>

            {/* 🔺 Mayor consumo */}
            <div className="stat-item active red">
              <TrendingUp className="stat-icon text-red-600" />
              <div>
                <p className="stat-label">Mayor Consumo</p>
                <p className="stat-value">
                  {stats.mes_mayor_consumo
                    ? `${stats.mes_mayor_consumo.consumo_m3} m³`
                    : 'N/A'}
                </p>
              </div>
            </div>

            {/* 🔻 Menor consumo */}
            <div className="stat-item active blue">
              <TrendingDown className="stat-icon text-blue-600" />
              <div>
                <p className="stat-label">Menor Consumo</p>
                <p className="stat-value">
                  {stats.mes_menor_consumo
                    ? `${stats.mes_menor_consumo.consumo_m3} m³`
                    : 'N/A'}
                </p>
              </div>
            </div>

            {/* 📈 Tendencia */}
            {stats.tendencia && (
              <div
                className={`stat-item active ${
                  stats.tendencia.direccion === 'aumento' ? 'orange' : 'green'
                }`}
              >
                {stats.tendencia.direccion === 'aumento' ? (
                  <TrendingUp className="stat-icon text-orange-600" />
                ) : (
                  <TrendingDown className="stat-icon text-green-600" />
                )}
                <div>
                  <p className="stat-label">Tendencia (3 meses)</p>
                  <p className="stat-value text-sm">
                    {stats.tendencia.direccion === 'aumento' ? '↑' : '↓'}{' '}
                    {stats.tendencia.porcentaje}%
                  </p>
                </div>
              </div>
            )}

          </div>
        </div>
      )}


      {/* ==================== FILTROS PRINCIPALES — PERIODO ==================== */}
      <div className="filters-section">

        {/* IZQUIERDA — (vacío o futuro buscador si quieres) */}
        <div />

        {/* Filtros de período */}
        <div className="filters-right">

          {/* 📅 Año */}
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

          {/* 📆 Mes */}
          <select
            className="filter-select"
            value={selectedMes}
            onChange={(e) => setSelectedMes(e.target.value)}
            disabled={!selectedAnio}
          >
            <option value="">Todos los meses</option>
            {mesesDelAnio.map(periodo => (
              <option key={periodo.mes} value={periodo.mes}>
                {periodo.nombre_mes} ({periodo.total_lecturas})
              </option>
            ))}
          </select>

          {/* 🎯 Tipo de lectura */}
          <select
            className="filter-select"
            value={filterTipoLectura}
            onChange={(e) => setFilterTipoLectura(e.target.value)}
          >
            <option value="todas">Tipos de lectura</option>
            <option value="reales">Reales</option>
            <option value="estimadas">Estimadas</option>
          </select>

          {/* 📊 Ordenar por */}
          <select
            className="filter-select"
            value={sortBy}
            onChange={(e) => {
              console.log(`📊 Nuevo criterio de orden: ${e.target.value}`);
              setSortBy(e.target.value);
            }}
            title="Ordenar por"
          >
            <option value="fecha">Ordenar por Fecha</option>
            <option value="consumo">Ordenar por Consumo</option>
          </select>

          {/* ⬆️⬇️ Dirección de orden */}
          <button 
            className="btn-secondary"
            onClick={toggleSortOrder}
            title={`Actualmente: ${sortOrder === 'asc' ? 'Ascendente (menor a mayor)' : 'Descendente (mayor a menor)'}`}
            style={{ minWidth: '60px' }}
          >
            <ArrowUpDown className="w-4 h-4" />
            <span className="ml-1 text-xs">
              {sortOrder === 'asc' ? '↑' : '↓'}
            </span>
          </button>

          {/* ❌ Limpiar filtros */}
          <button 
            className="btn-secondary"
            onClick={limpiarFiltros}
            title="Limpiar filtros"
          >
            <X className="w-4 h-4" />
          </button>

          {/* 🔄 Recargar */}
          <button 
            className="btn-secondary"
            onClick={handleRecargar}
            disabled={loading}
            title="Recargar lista"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

        </div>


      </div>

      {/* LISTA DE LECTURAS */}
      <div className="periodo-historial-container">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Droplet className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-lg">Registro de Lecturas</h3>
          </div>
          <p className="text-sm text-gray-600">
            {filteredLecturas.length} {filteredLecturas.length === 1 ? 'lectura' : 'lecturas'}
          </p>
        </div>

        {filteredLecturas.length === 0 ? (
          <div className="periodo-historial-empty">
            <Droplet className="w-12 h-12 text-gray-300 mb-2" />
            <p>
              {lecturas.length === 0 
                ? 'No tienes lecturas registradas aún.' 
                : 'No hay lecturas que coincidan con los filtros aplicados.'}
            </p>
          </div>
        ) : (
          <div className="periodo-historial-list">
            {filteredLecturas.map(lectura => (
              <button
                key={lectura.id_lectura}
                onClick={() => verDetalle(lectura)}
                className="periodo-historial-list-item"
              >
                <div className="periodo-historial-col-fecha">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <div className="flex flex-col">
                    <span className="periodo-historial-mes-nombre">
                      {formatDateShort(lectura.fecha_lectura)}
                    </span>
                    <span className="text-xs text-gray-500">
                      Medidor: {lectura.medidor?.num_medidor || 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="periodo-historial-col-stats">
                  <div className="periodo-historial-stat-item">
                    <Gauge className="w-4 h-4 text-blue-500" />
                    <span>{lectura.consumo_m3} m³</span>
                  </div>                  
                </div>
                 <div className="periodo-historial-col-stats">
                  
                  <div className="periodo-historial-stat-item">
                    <Activity className="w-4 h-4 text-gray-500" />
                    <span>Lecturas • Actual: {lectura.lectura_actual} - Anterior: {lectura.lectura_anterior}</span>
                  </div>
                </div>

                <div className="periodo-historial-col-estado">
                  {lectura.es_estimada ? (
                    <div className="periodo-historial-badge incompleto">
                      <AlertCircle className="w-4 h-4 text-red-600" />
                      <span>Estimada</span>
                    </div>
                  ) : (
                    <div className="periodo-historial-badge completo">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>Real</span>
                    </div>
                  )}
                </div>


                <div className="periodo-historial-col-action">
                  <Eye className="w-4 h-4" />
                  <span>Ver</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* MODAL DE DETALLES*/}
      {showModal && selectedLectura && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>
                <Eye className="w-5 h-5 inline mr-2" />
                Detalle de Lectura
              </h3>
              <button className="modal-close" onClick={closeModal}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="user-details">
                {/* Medidor */}
                <div className="detail-group">
                  <label>Medidor:</label>
                  <p>{selectedLectura.medidor?.num_medidor || 'N/A'}</p>
                </div>

                {/* Sector */}
                <div className="detail-group">
                  <label>Sector:</label>
                  <p>{selectedLectura.medidor?.sector || 'Sin sector'}</p>
                </div>

                {/* Código de Afiliado */}
                <div className="detail-group">
                  <label>Código de Afiliado:</label>
                  <p>{selectedLectura.medidor?.codigo_afiliado || 'N/A'}</p>
                </div>

                {/* Nombre Afiliado */}
                <div className="detail-group">
                  <label>Nombre Afiliado:</label>
                  <p>{selectedLectura.medidor?.nombre_afiliado || 'Sin afiliado'}</p>
                </div>

                {/* Lecturas */}
                <div className="detail-group">
                  <label>Lectura Anterior:</label>
                  <p>{selectedLectura.lectura_anterior} m³</p>
                </div>

                <div className="detail-group">
                  <label>Lectura Actual:</label>
                  <p>{selectedLectura.lectura_actual} m³</p>
                </div>

                {/* Consumo */}
                <div className="detail-group">
                  <label>Consumo:</label>
                  <p className="text-blue-600 font-semibold text-xl">{selectedLectura.consumo_m3} m³</p>
                </div>

                {/* Fecha */}
                <div className="detail-group">
                  <label>Fecha lectura:</label>
                  <p>{formatDate(selectedLectura.fecha_lectura)}</p>
                </div>

                {/* Tipo de Lectura */}
                <div className="detail-group">
                  <label>Tipo de Lectura:</label>
                  {selectedLectura.es_estimada ? (
                    <span className="status-badge" style={{backgroundColor: '#fef3c7', color: '#92400e'}}>
                      <AlertCircle className="w-3 h-3 mr-1" />
                      Estimada
                    </span>
                  ) : (
                    <span className="status-badge active">
                      <Activity className="w-3 h-3 mr-1" />
                      Real
                    </span>
                  )}
                </div>

                {/* Lector */}
                <div className="detail-group">
                  <label>Lector:</label>
                  <p>
                    {selectedLectura.lector
                      ? `${selectedLectura.lector.nombres} ${selectedLectura.lector.apellidos}`
                      : 'No registrado'}
                  </p>
                </div>

                {/* Observación */}
                <div className="detail-group">
                  <label>Observación:</label>
                  <p className={selectedLectura.observacion ? "bg-gray-50 p-3 rounded border border-gray-200" : ""}>
                    {selectedLectura.observacion || 'Sin observaciones'}
                  </p>
                </div>

                {/* Estado  */}
                <div className="detail-group">
                  <label>Estado:</label>
                  <span
                    className={`status-badge ${selectedLectura.activo ? 'active' : 'inactive'}`}
                  >
                    {selectedLectura.activo ? (
                      <>
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Activo
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3 mr-1" />
                        Inactivo
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistorialConsumos;