// src/sections/HistorialConsumos.js
// MÓDULO DE HISTORIAL DE CONSUMOS MEJORADO - Para afiliados
import React, { useState, useEffect, useCallback } from 'react';
import readingsServices from '../services/readingsServices';
import authService from '../services/authServices';
import { 
  Droplet,
  Search,
  Eye,
  Calendar,
  Activity,
  AlertCircle,
  FileText,
  ArrowUpDown,
  BarChart3,
  TrendingUp,
  RefreshCw,
  X,
  User,
  Filter,
  Download,
  ChevronDown,
  TrendingDown,
  CheckCircle,
  XCircle,
  Clock,
  Gauge
} from 'lucide-react';

const HistorialConsumos = () => {
  const [lecturas, setLecturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFechaDesde, setFilterFechaDesde] = useState('');
  const [filterFechaHasta, setFilterFechaHasta] = useState('');
  const [filterTipoLectura, setFilterTipoLectura] = useState('todas');
  const [filterConsumoMin, setFilterConsumoMin] = useState('');
  const [filterConsumoMax, setFilterConsumoMax] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [sortBy, setSortBy] = useState('fecha');
  const [showModal, setShowModal] = useState(false);
  const [selectedLectura, setSelectedLectura] = useState(null);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [stats, setStats] = useState({
    total_lecturas: 0,
    consumo_promedio: 0,
    consumo_total: 0,
    mes_mayor_consumo: null,
    mes_menor_consumo: null,
    tendencia: null
  });

  const [permissions, setPermissions] = useState({
    canRead: false
  });

  useEffect(() => {
    loadUserPermissions();
    loadCurrentUser();
  }, []);

  const loadUserPermissions = () => {
    const canRead =
      authService.hasPermission('lecturas', 'lectura') ||
      authService.hasPermission('lecturas', 'crud') ||
      authService.hasPermission('historialconsumo', 'lectura');

    setPermissions({ canRead });
  };

  const loadCurrentUser = () => {
    const user = authService.getStoredUser();
    if (user) {
      setCurrentUser(user);
    }
  };

  const fetchLecturas = useCallback(async () => {
    if (!permissions.canRead) {
      setError('No tienes permiso para ver tu historial de consumos');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await readingsServices.getMisLecturas();

      if (result.success) {
        setLecturas(result.data);
        calcularEstadisticas(result.data);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Error al cargar tu historial de consumos');
      console.error('❌ Error obteniendo mis lecturas:', err);
    } finally {
      setLoading(false);
    }
  }, [permissions.canRead]);

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

    const lecturaMayor = lecturasData.reduce((max, l) => 
      (l.consumo_m3 || 0) > (max.consumo_m3 || 0) ? l : max
    , lecturasData[0]);

    const lecturaMenor = lecturasData.reduce((min, l) => 
      (l.consumo_m3 || 0) < (min.consumo_m3 || 0) ? l : min
    , lecturasData[0]);

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

  useEffect(() => {
    if (permissions.canRead) {
      fetchLecturas();
    }
  }, [fetchLecturas, permissions.canRead]);

  const toggleSortOrder = () => {
    setSortOrder(prevOrder => prevOrder === 'asc' ? 'desc' : 'asc');
  };

  const filteredLecturas = lecturas
    .filter(lectura => {
      const matchesSearch = 
        lectura.medidor?.num_medidor?.toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
        lectura.observacion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lectura.medidor?.sector?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lectura.id_lectura?.toString().includes(searchTerm);

      const matchesTipo = 
        filterTipoLectura === 'todas' ||
        (filterTipoLectura === 'reales' && !lectura.es_estimada) ||
        (filterTipoLectura === 'estimadas' && lectura.es_estimada);

      const fechaLectura = new Date(lectura.fecha_lectura);
      const matchesFechaDesde = !filterFechaDesde || fechaLectura >= new Date(filterFechaDesde);
      const matchesFechaHasta = !filterFechaHasta || fechaLectura <= new Date(filterFechaHasta);

      const matchesConsumoMin = !filterConsumoMin || lectura.consumo_m3 >= parseFloat(filterConsumoMin);
      const matchesConsumoMax = !filterConsumoMax || lectura.consumo_m3 <= parseFloat(filterConsumoMax);

      return matchesSearch && matchesTipo && matchesFechaDesde && matchesFechaHasta && matchesConsumoMin && matchesConsumoMax;
    })
    .sort((a, b) => {
      let comparison = 0;
      
      switch(sortBy) {
        case 'fecha':
          comparison = new Date(a.fecha_lectura) - new Date(b.fecha_lectura);
          break;
        case 'consumo':
          comparison = a.consumo_m3 - b.consumo_m3;
          break;
        case 'medidor':
          comparison = (a.medidor?.num_medidor || '').localeCompare(b.medidor?.num_medidor || '');
          break;
        default:
          comparison = new Date(a.fecha_lectura) - new Date(b.fecha_lectura);
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const verDetalle = (lectura) => {
    setSelectedLectura(lectura);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedLectura(null);
  };

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
  };

  const exportarDatos = () => {
    if (filteredLecturas.length === 0) {
      alert('No hay datos para exportar');
      return;
    }

    const csvContent = [
      ['ID', 'Fecha', 'Medidor', 'Sector', 'Lectura Anterior', 'Lectura Actual', 'Consumo (m³)', 'Tipo', 'Observación'],
      ...filteredLecturas.map(l => [
        l.id_lectura,
        formatDate(l.fecha_lectura),
        l.medidor?.num_medidor || 'N/A',
        l.medidor?.sector || 'N/A',
        l.lectura_anterior,
        l.lectura_actual,
        l.consumo_m3,
        l.es_estimada ? 'Estimada' : 'Real',
        l.observacion || ''
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `historial_consumos_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

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

  return (
    <div className="users-section">
      <div className="section-header">
        <div className="section-title">
          <Clock className="w-6 h-6 text-blue-600" />
          <h2>Mi Historial de Consumos</h2>
        </div>
        <div className="flex items-center gap-3">
          {currentUser && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <User className="w-4 h-4" />
              <span>{currentUser.nombres} {currentUser.apellidos}</span>
            </div>
          )}
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

      {error && (
        <div className="alert alert-error mb-4">
          <AlertCircle className="w-5 h-5 mr-2" />
          {error}
        </div>
      )}

      {/* Tarjetas de estadísticas */}
      {stats && (
        <div className="users-stats">
          <div className="stat-item">
            <FileText className="stat-icon text-blue-600" />
            <div>
              <p className="stat-label">Total Lecturas</p>
              <p className="stat-value">{stats.total_lecturas}</p>
            </div>
          </div>
          <div className="stat-item">
            <Activity className="stat-icon text-green-600" />
            <div>
              <p className="stat-label">Consumo Total</p>
              <p className="stat-value">{stats.consumo_total} m³</p>
            </div>
          </div>
          <div className="stat-item">
            <BarChart3 className="stat-icon text-yellow-600" />
            <div>
              <p className="stat-label">Promedio Mensual</p>
              <p className="stat-value">{stats.consumo_promedio} m³</p>
            </div>
          </div>
          <div className="stat-item">
            <TrendingUp className="stat-icon text-red-600" />
            <div>
              <p className="stat-label">Mayor Consumo</p>
              <p className="stat-value">
                {stats.mes_mayor_consumo ? `${stats.mes_mayor_consumo.consumo_m3} m³` : 'N/A'}
              </p>
            </div>
          </div>
          <div className="stat-item">
            <TrendingDown className="stat-icon text-blue-600" />
            <div>
              <p className="stat-label">Menor Consumo</p>
              <p className="stat-value">
                {stats.mes_menor_consumo ? `${stats.mes_menor_consumo.consumo_m3} m³` : 'N/A'}
              </p>
            </div>
          </div>
          {stats.tendencia && (
            <div className="stat-item">
              {stats.tendencia.direccion === 'aumento' ? (
                <TrendingUp className="stat-icon text-orange-600" />
              ) : (
                <TrendingDown className="stat-icon text-green-600" />
              )}
              <div>
                <p className="stat-label">Tendencia (3 meses)</p>
                <p className={`stat-value text-sm ${stats.tendencia.direccion === 'aumento' ? 'text-orange-600' : 'text-green-600'}`}>
                  {stats.tendencia.direccion === 'aumento' ? '↑' : '↓'} {stats.tendencia.porcentaje}%
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="filters-section">
        <div className="search-container">
          <Search className="search-icon" />
          <input
            type="text"
            placeholder="Buscar por ID, medidor, sector u observación..."
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filters-right">
          <button 
            className={`btn-secondary ${showFilters ? 'bg-blue-100' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
            title="Mostrar/ocultar filtros avanzados"
          >
            <Filter className="w-4 h-4" />
            <span className="ml-1">Filtros</span>
            <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>

          <select
            className="filter-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="fecha">Ordenar por Fecha</option>
            <option value="consumo">Ordenar por Consumo</option>
            <option value="medidor">Ordenar por Medidor</option>
          </select>

          <button 
            className="btn-secondary"
            onClick={toggleSortOrder}
            title={`Orden ${sortOrder === 'asc' ? 'ascendente' : 'descendente'}`}
          >
            <ArrowUpDown className="w-4 h-4" />
            <span className="ml-1 text-xs">
              {sortOrder === 'asc' ? '↑' : '↓'}
            </span>
          </button>

          <button 
            className="btn-secondary"
            onClick={limpiarFiltros}
            title="Limpiar todos los filtros"
          >
            <X className="w-4 h-4" />
          </button>

          <button 
            className="btn-secondary"
            onClick={fetchLecturas}
            title="Recargar lista"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Panel de filtros avanzados */}
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
                Tipo de Lectura
              </label>
              <select
                className="filter-select w-full"
                value={filterTipoLectura}
                onChange={(e) => setFilterTipoLectura(e.target.value)}
              >
                <option value="todas">Todas</option>
                <option value="reales">Solo Reales</option>
                <option value="estimadas">Solo Estimadas</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Consumo Mínimo (m³)
              </label>
              <input
                type="number"
                className="filter-select w-full"
                placeholder="Ej: 10"
                value={filterConsumoMin}
                onChange={(e) => setFilterConsumoMin(e.target.value)}
                min="0"
                step="0.1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Consumo Máximo (m³)
              </label>
              <input
                type="number"
                className="filter-select w-full"
                placeholder="Ej: 50"
                value={filterConsumoMax}
                onChange={(e) => setFilterConsumoMax(e.target.value)}
                min="0"
                step="0.1"
              />
            </div>
          </div>
          <div className="mt-3 text-sm text-gray-600">
            Mostrando {filteredLecturas.length} de {lecturas.length} lecturas
          </div>
        </div>
      )}

      {/* Lista estilo historial */}
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
                {/* Columna 1: Fecha y Medidor */}
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

                {/* Columna 2: Estadísticas */}
                <div className="periodo-historial-col-stats">
                  <div className="periodo-historial-stat-item">
                    <Gauge className="w-4 h-4 text-blue-500" />
                    <span>{lectura.consumo_m3} m³</span>
                  </div>
                  <div className="periodo-historial-stat-separator">•</div>
                  <div className="periodo-historial-stat-item">
                    <Activity className="w-4 h-4 text-gray-500" />
                    <span>{lectura.lectura_actual} - {lectura.lectura_anterior}</span>
                  </div>
                </div>

                {/* Columna 3: Estado */}
                <div className="periodo-historial-col-estado">
                  {lectura.es_estimada ? (
                    <div className="periodo-historial-badge incompleto">
                      <AlertCircle className="w-4 h-4" />
                      <span>Estimada</span>
                    </div>
                  ) : (
                    <div className="periodo-historial-badge completo">
                      <CheckCircle className="w-4 h-4" />
                      <span>Real</span>
                    </div>
                  )}
                </div>

                {/* Columna 4: Acción */}
                <div className="periodo-historial-col-action">
                  <Eye className="w-4 h-4" />
                  <span>Ver</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* MODAL DE DETALLES - Sin llamada adicional */}
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

                {/* Código de Usuario */}
                <div className="detail-group">
                  <label>Código de Usuario:</label>
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
                  <label>Fecha:</label>
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

            <div className="form-actions">
              <button type="button" className="btn-primary" onClick={closeModal}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistorialConsumos;