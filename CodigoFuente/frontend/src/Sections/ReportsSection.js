// src/sections/ReportsSection.js
// MÓDULO DE GENERACIÓN DE REPORTES DEL SISTEMA
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import authService from '../services/authServices';
import reportsServices from '../services/reportsServices';
import './ReportsSection.css';
import { 
  FileText, Calendar, Search, BarChart3, Users, Droplet,
  DollarSign, AlertCircle, CheckCircle,
  RefreshCw, Loader, Settings, Database, MapPin, CreditCard,
  Bell, Shield, Activity, Clock, ArrowLeft, Eraser, XCircle, User, TrendingUp
} from 'lucide-react';

import { ReportExport } from '../components/ReportExport';

const ReportsSection = () => {
  // ============================================================
  // ESTADOS PRINCIPALES
  // ============================================================
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [permissions, setPermissions] = useState({ canRead: false });
  const [selectedModulo, setSelectedModulo] = useState('');
  
  // ============================================================
  // ESTADOS DE FILTROS
  // ============================================================
  const [filterFechaDesde, setFilterFechaDesde] = useState('');
  const [filterFechaHasta, setFilterFechaHasta] = useState('');
  const [filterEstado, setFilterEstado] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');
  
  // ============================================================
  // ESTADOS DE DATOS
  // ============================================================
  const [reporteData, setReporteData] = useState([]);
  const [stats, setStats] = useState({
    total_registros: 0,
    periodo: '',
    modulo: ''
  });
  // ============================================================
  // ESTADOS DE COLUMNAS
  // ============================================================
  const [columnasVisibles, setColumnasVisibles] = useState({});
  const [mostrarSelectorColumnas, setMostrarSelectorColumnas] = useState(false);  

  // ============================================================
  // CONFIGURACIÓN DE MÓDULOS DEL SISTEMA 
  // ============================================================
  const modulosSistema = useMemo(() => [
    { 
      value: 'Usuarios', 
      label: 'Usuarios del Sistema', 
      icon: Users, 
      color: '#3b82f6',
      description: 'Reportes de usuarios del sistema'
    },
    { 
      value: 'Roles', 
      label: 'Roles y Permisos', 
      icon: Shield, 
      color: '#a855f7',
      description: 'Reportes de roles y niveles de acceso'
    },
    { 
      value: 'Afiliados', 
      label: 'Afiliados', 
      icon: Users, 
      color: '#22c55e',
      description: 'Reportes de afiliados '
    },
    { 
      value: 'Medidores', 
      label: 'Medidores', 
      icon: Activity, 
      color: '#6366f1',
      description: 'Reportes de medidores'
    },
    { 
      value: 'Sectores', 
      label: 'Sectores', 
      icon: MapPin, 
      color: '#ec4899',
      description: 'Reportes de sectores'
    },
    { 
      value: 'Tarifas', 
      label: 'Tarifas', 
      icon: DollarSign, 
      color: '#eab308',
      description: 'Reportes de tarifas y precios'
    },
    { 
      value: 'Geolocalizacion', 
      label: 'Geolocalización', 
      icon: MapPin, 
      color: '#ef4444',
      description: 'Reportes de ubicación GPS de medidores y afiliados'
    },
    { 
      value: 'Servicios', 
      label: 'Servicios', 
      icon: Settings, 
      color: '#14b8a6',
      description: 'Gestión de servicios adicionales ofrecidos'
    },
    { 
      value: 'Lecturas', 
      label: 'Lecturas de Consumo', 
      icon: Droplet, 
      color: '#3b82f6',
      description: 'Registro histórico de lecturas de medidores'
    },
    { 
      value: 'Facturas', 
      label: 'Facturas', 
      icon: FileText, 
      color: '#f97316',
      description: 'Facturación mensual y estados de cuenta'
    },
    { 
      value: 'Pagos', 
      label: 'Pagos Recibidos', 
      icon: CreditCard, 
      color: '#22c55e',
      description: 'Control de pagos y transacciones realizadas'
    },
    { 
      value: 'Multas', 
      label: 'Multas', 
      icon: AlertCircle, 
      color: '#ef4444',
      description: 'Registro de multas y penalizaciones'
    },
    { 
      value: 'MultasAfiliados', 
      label: 'Multas a Afiliados', 
      icon: AlertCircle, 
      color: '#f97316',
      description: 'Multas específicas aplicadas a usuarios'
    },
    { 
      value: 'Configuracion', 
      label: 'Configuración', 
      icon: Settings, 
      color: '#6b7280',
      description: 'Parámetros y configuración del sistema'
    },
    { 
      value: 'Notificaciones', 
      label: 'Notificaciones', 
      icon: Bell, 
      color: '#3b82f6',
      description: 'Historial de notificaciones enviadas'
    },
    { 
      value: 'Estadisticas', 
      label: 'Estadísticas', 
      icon: BarChart3, 
      color: '#a855f7',
      description: 'Análisis estadístico y métricas del sistema'
    },
    { 
      value: 'HistorialConsumo', 
      label: 'Historial de Consumo', 
      icon: Clock, 
      color: '#6366f1',
      description: 'Histórico detallado de consumos por periodo'
    }
  ], []);

  
  // ============================================================
  // ESTADISTICAS DINAMICAS
  // ============================================================
  const estadisticasDinamicas = useMemo(() => {
    if (!reporteData || reporteData.length === 0) return [];

    const stats = [];

    switch (selectedModulo) {
      case 'Usuarios':
        // Contar hombres y mujeres
        const hombres = reporteData.filter(u => u.sexo?.toLowerCase() === 'm' || u.sexo?.toLowerCase() === 'masculino').length;
        const mujeres = reporteData.filter(u => u.sexo?.toLowerCase() === 'f' || u.sexo?.toLowerCase() === 'femenino').length;
        const activos = reporteData.filter(u => u.activo === true || u.activo === 'Sí').length;
        const inactivos = reporteData.length - activos;

        stats.push(
          { label: 'Usuarios Activos', value: activos, icon: 'CheckCircle', color: 'text-green-600' },
          { label: 'Usuarios Inactivos', value: inactivos, icon: 'XCircle', color: 'text-red-600' },
          { label: 'Hombres', value: hombres, icon: 'User', color: 'text-blue-600' },
          { label: 'Mujeres', value: mujeres, icon: 'User', color: 'text-pink-600' }
        );
        break;

      case 'Roles':
          // Contar roles activos e inactivos
          const rolesActivos = reporteData.filter(r => r.activo === true || r.activo === 'Sí').length;
          const rolesInactivos = reporteData.length - rolesActivos;
          
          // Sumar total de usuarios asignados a roles
          const totalUsuariosAsignados = reporteData.reduce((sum, r) => sum + (r.total_usuarios || 0), 0);
          
          // Obtener todos los módulos únicos
          const modulosUnicos = new Set();
          reporteData.forEach(r => {
            if (r.modulos && Array.isArray(r.modulos)) {
              r.modulos.forEach(m => modulosUnicos.add(m));
            }
          });

          stats.push(
            { label: 'Roles Activos', value: rolesActivos, icon: 'CheckCircle', color: 'text-green-600' },
            { label: 'Roles Inactivos', value: rolesInactivos, icon: 'XCircle', color: 'text-red-600' },
            { label: 'Usuarios Asignados', value: totalUsuariosAsignados, icon: 'Users', color: 'text-blue-600' },
            { label: 'Módulos Totales', value: modulosUnicos.size, icon: 'Grid', color: 'text-purple-600' }
          );
          break;

      case 'Afiliados':
  const afiliadosActivos = reporteData.filter(a => a.activo === true || a.activo === 'Sí').length;
  const afiliadosInactivos = reporteData.length - afiliadosActivos;
  const conMedidor = reporteData.filter(a => a.num_medidor).length;

  stats.push(
    { label: 'Total Afiliados', value: reporteData.length, icon: 'Users', color: 'text-blue-600' },
    { label: 'Activos', value: afiliadosActivos, icon: 'CheckCircle', color: 'text-green-600' },
    { label: 'Inactivos', value: afiliadosInactivos, icon: 'XCircle', color: 'text-red-600' },
    { label: 'Con Medidor', value: conMedidor, icon: 'Activity', color: 'text-purple-600' }
  );
  break;

      case 'Medidores':
        const medidoresActivos = reporteData.filter(m => m.activo === true || m.activo === 'Sí').length;
        const medidoresInactivos = reporteData.length - medidoresActivos;
        const sectoresUnicos = new Set(reporteData.map(m => m.sector).filter(Boolean)).size;

        stats.push(
          { label: 'Medidores Activos', value: medidoresActivos, icon: 'Activity', color: 'text-green-600' },
          { label: 'Medidores Inactivos', value: medidoresInactivos, icon: 'XCircle', color: 'text-red-600' },
          { label: 'Sectores', value: sectoresUnicos, icon: 'MapPin', color: 'text-purple-600' }
        );
        break;

      case 'Lecturas':
        const totalConsumo = reporteData.reduce((sum, l) => sum + (parseFloat(l.consumo_m3 || l.consumo) || 0), 0);
        const promedioConsumo = (totalConsumo / reporteData.length).toFixed(2);
        const estimadas = reporteData.filter(l => l.es_estimada === true || l.es_estimada === 'Sí').length;
        const reales = reporteData.length - estimadas;

        stats.push(
          { label: 'Consumo Total', value: `${totalConsumo.toFixed(2)} m³`, icon: 'Droplet', color: 'text-blue-600' },
          { label: 'Promedio', value: `${promedioConsumo} m³`, icon: 'TrendingUp', color: 'text-green-600' },
          { label: 'Lecturas Reales', value: reales, icon: 'CheckCircle', color: 'text-green-600' },
          { label: 'Estimadas', value: estimadas, icon: 'AlertCircle', color: 'text-orange-600' }
        );
        break;

      case 'Facturas':
        const totalFacturado = reporteData.reduce((sum, f) => sum + (parseFloat(f.total || f.monto_total) || 0), 0);
        const pagadas = reporteData.filter(f => f.estado?.toLowerCase() === 'pagada' || f.pagado === true).length;
        const pendientes = reporteData.filter(f => f.estado?.toLowerCase() === 'pendiente' || f.pagado === false).length;
        const promedioFactura = (totalFacturado / reporteData.length).toFixed(2);

        stats.push(
          { label: 'Total Facturado', value: `$${totalFacturado.toFixed(2)}`, icon: 'DollarSign', color: 'text-green-600' },
          { label: 'Promedio', value: `$${promedioFactura}`, icon: 'TrendingUp', color: 'text-blue-600' },
          { label: 'Pagadas', value: pagadas, icon: 'CheckCircle', color: 'text-green-600' },
          { label: 'Pendientes', value: pendientes, icon: 'Clock', color: 'text-orange-600' }
        );
        break;

      case 'Pagos':
        const totalRecaudado = reporteData.reduce((sum, p) => sum + (parseFloat(p.monto || p.valor) || 0), 0);
        const promedioPago = (totalRecaudado / reporteData.length).toFixed(2);
        const efectivo = reporteData.filter(p => p.metodo_pago?.toLowerCase() === 'efectivo').length;
        const transferencia = reporteData.filter(p => p.metodo_pago?.toLowerCase() === 'transferencia').length;

        stats.push(
          { label: 'Total Recaudado', value: `$${totalRecaudado.toFixed(2)}`, icon: 'DollarSign', color: 'text-green-600' },
          { label: 'Promedio', value: `$${promedioPago}`, icon: 'TrendingUp', color: 'text-blue-600' },
          { label: 'Efectivo', value: efectivo, icon: 'CreditCard', color: 'text-purple-600' },
          { label: 'Transferencia', value: transferencia, icon: 'CreditCard', color: 'text-indigo-600' }
        );
        break;

      case 'Multas':
        const totalMultas = reporteData.reduce((sum, m) => sum + (parseFloat(m.monto || m.valor) || 0), 0);
        const multasPagadas = reporteData.filter(m => m.pagado === true || m.estado === 'pagada').length;
        const multasPendientes = reporteData.length - multasPagadas;

        stats.push(
          { label: 'Total en Multas', value: `$${totalMultas.toFixed(2)}`, icon: 'AlertCircle', color: 'text-red-600' },
          { label: 'Multas Pagadas', value: multasPagadas, icon: 'CheckCircle', color: 'text-green-600' },
          { label: 'Pendientes', value: multasPendientes, icon: 'Clock', color: 'text-orange-600' }
        );
        break;

      case 'Sectores':
        const sectoresActivos = reporteData.filter(s => s.activo === true).length;
        const totalAfiliados = reporteData.reduce((sum, s) => sum + (s.total_afiliados || 0), 0);
        const totalMedidores = reporteData.reduce((sum, s) => sum + (s.total_medidores || 0), 0);
        
 

        stats.push(
          { label: 'Total Sectores', value: reporteData.length, icon: 'MapPin', color: 'text-blue-600' },
          { label: 'Sectores Activos', value: sectoresActivos, icon: 'CheckCircle', color: 'text-green-600' },
          { label: 'Total Afiliados', value: totalAfiliados, icon: 'Users', color: 'text-purple-600' },
          { label: 'Total Medidores', value: totalMedidores, icon: 'Activity', color: 'text-orange-600' }
        );
        break;


      default:
        // Estadísticas genéricas para módulos sin configuración específica
        const activosGenerico = reporteData.filter(item => item.activo === true || item.activo === 'Sí').length;
        if (activosGenerico > 0) {
          stats.push(
            { label: 'Activos', value: activosGenerico, icon: 'CheckCircle', color: 'text-green-600' },
            { label: 'Inactivos', value: reporteData.length - activosGenerico, icon: 'XCircle', color: 'text-red-600' }
          );
        }
        break;
    }

    return stats;
  }, [reporteData, selectedModulo]);

  /**
   * Mapeo de iconos
   */
  const getIconComponent = (iconName) => {
    const icons = {
      CheckCircle, XCircle, User, Activity, AlertCircle, MapPin, 
      Droplet, TrendingUp, DollarSign, Clock, CreditCard, Database,
      Calendar, FileText
    };
    return icons[iconName] || Database;
  };


  // ============================================================
  // INICIALIZACIÓN
  // ============================================================

  useEffect(() => {
    loadUserPermissions();
  }, []);

  const loadUserPermissions = () => {
    const canRead =
      authService.hasPermission('reportes', 'lectura') ||
      authService.hasPermission('reportes', 'crud') ||
      authService.hasPermission('all', 'crud');
    setPermissions({ canRead });
  };

  // ============================================================
  // FUNCIONES DE GENERACIÓN DE REPORTES 
  // ============================================================
  
  /**
   * Generar reporte del módulo seleccionado
   */
  const generarReporte = useCallback(async () => {
    if (!selectedModulo) {
      setError('Por favor selecciona un módulo');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const filtros = {
        search: searchTerm || undefined,
        fecha_desde: filterFechaDesde || undefined,
        fecha_hasta: filterFechaHasta || undefined,
        estado: filterEstado !== 'todos' ? filterEstado : undefined,
        skip: 0,
        limit: 1000
      };

      let result;

      // ============================================================
      // ROUTER DE MÓDULOS - Llamada al servicio específico
      // ============================================================
      switch (selectedModulo) {
        case 'Usuarios':
          result = await reportsServices.getReporteUsuarios({
            ...filtros,
            activo: filtros.estado === 'activos' ? true : filtros.estado === 'inactivos' ? false : undefined
          });
          break;


        case 'Afiliados':
          result = await reportsServices.getReporteAfiliados(filtros);
          break;

        case 'Medidores':
          result = await reportsServices.getReporteMedidores(filtros);
          break;

        case 'Sectores':
          result = await reportsServices.getReporteSectores(filtros);
          break;

        case 'Lecturas':
          result = await reportsServices.getReporteLecturas(filtros);
          break;

        case 'Facturas':
          result = await reportsServices.getReporteFacturas(filtros);
          break;

        case 'Pagos':
          result = await reportsServices.getReportePagos(filtros);
          break;

        case 'Multas':
          result = await reportsServices.getReporteMultas(filtros);
          break;

        case 'Tarifas':
          result = await reportsServices.getReporteTarifas(filtros);
          break;

        case 'Roles':
          result = await reportsServices.getReporteRoles(filtros);
          break;

        case 'Servicios':
          result = await reportsServices.getReporteServicios(filtros);
          break;

        case 'Notificaciones':
          result = await reportsServices.getReporteNotificaciones(filtros);
          break;

        case 'Geolocalizacion':
          result = await reportsServices.getReporteGeolocalizacion(filtros);
          break;

        case 'MultasAfiliados':
          result = await reportsServices.getReporteMultasAfiliados(filtros);
          break;

        case 'Configuracion':
          result = await reportsServices.getReporteConfiguracion(filtros);
          break;

        case 'Estadisticas':
          result = await reportsServices.getReporteEstadisticas(filtros);
          break;

        case 'HistorialConsumo':
          result = await reportsServices.getReporteHistorialConsumo(filtros);
          break;

        default:
          // Fallback genérico
          result = await reportsServices.getReporteByModulo(selectedModulo, filtros);
      }

      if (result.success) {
        setReporteData(result.data);
        
        setStats({
          total_registros: result.total || result.data.length,
          periodo: filterFechaDesde && filterFechaHasta 
            ? `${formatDate(filterFechaDesde)} a ${formatDate(filterFechaHasta)}` 
            : 'Todos los periodos',
          modulo: modulosSistema.find(m => m.value === selectedModulo)?.label || selectedModulo
        });
      } else {
        setError(result.message);
        setReporteData([]);
      }

    } catch (err) {
      setError('Error al generar el reporte');
      console.error('❌ Error:', err);
      setReporteData([]);
    } finally {
      setLoading(false);
    }
  }, [selectedModulo, filterFechaDesde, filterFechaHasta, filterEstado, searchTerm, modulosSistema]);

    // Agregar este useEffect después de loadUserPermissions
  useEffect(() => {
    if (selectedModulo && permissions.canRead) {
      generarReporte();
    }
  }, [selectedModulo, generarReporte, permissions.canRead]);

  useEffect(() => {
  if (reporteData.length > 0) {
    const todasColumnas = Object.keys(reporteData[0]);
    const columnasIniciales = {};
    todasColumnas.forEach(col => {
      columnasIniciales[col] = true; // Todas visibles por defecto
    });
    setColumnasVisibles(columnasIniciales);
  }
}, [reporteData]);


  // ============================================================
  // FUNCIONES DE EXPORTACIÓN - CONECTADAS AL BACKEND
  // ============================================================
  /**
 * Obtener columnas filtradas
 */
const columnasActivas = useMemo(() => {
  return Object.keys(columnasVisibles).filter(col => columnasVisibles[col]);
}, [columnasVisibles]);

  const exportarExcel = useCallback(() => {
    if (reporteData.length === 0) {
      alert('No hay datos para exportar');
      return;
    }

    // Filtrar datos para incluir solo columnas visibles
    const datosFiltrados = reporteData.map(row => {
      const rowFiltrada = {};
      columnasActivas.forEach(col => {
        rowFiltrada[col] = row[col];
      });
      return rowFiltrada;
    });

    const moduloInfo = modulosSistema.find(m => m.value === selectedModulo);
    ReportExport.exportarExcel(
      datosFiltrados, 
      moduloInfo?.label || selectedModulo, 
      moduloInfo?.description
    );
  }, [reporteData, selectedModulo, modulosSistema, columnasActivas]);

/**
 * Imprimir reporte con columnas seleccionadas
 */
const imprimirReporte = useCallback(() => {
  if (reporteData.length === 0) {
    alert('No hay datos para imprimir');
    return;
  }

  // Filtrar datos para incluir solo columnas visibles
  const datosFiltrados = reporteData.map(row => {
    const rowFiltrada = {};
    columnasActivas.forEach(col => {
      rowFiltrada[col] = row[col];
    });
    return rowFiltrada;
  });

  const moduloInfo = modulosSistema.find(m => m.value === selectedModulo);
  ReportExport.imprimirReporte(
    datosFiltrados, 
    moduloInfo?.label || selectedModulo, 
    moduloInfo?.description
  );
}, [reporteData, selectedModulo, modulosSistema, columnasActivas]);

  // ============================================================
  // FUNCIONES DE LIMPIEZA DE FILTROS
  // ============================================================
  
  /**
   * Limpiar filtros SIN cambiar el módulo
   */
  const limpiarFiltrosSinModulo = useCallback(() => {
    setFilterFechaDesde('');
    setFilterFechaHasta('');
    setFilterEstado('todos');
    setSearchTerm('');
    setError(null);
  }, []);

  /**
   * Volver a la selección (limpia TODO)
   */
  const limpiarFiltros = useCallback(() => {
    setSelectedModulo('');
    setReporteData([]);
    setFilterFechaDesde('');
    setFilterFechaHasta('');
    setFilterEstado('todos');
    setSearchTerm('');
    setError(null);
  }, []);


  // ============================================================
  // FUNCIONES AUXILIARES
  // ============================================================
  
  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('es-EC', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleModuloSelect = (moduloValue) => {
    setSelectedModulo(moduloValue);
    setReporteData([]);
    setError(null);
  };

  const toggleColumna = (columna) => {
  setColumnasVisibles(prev => ({
    ...prev,
    [columna]: !prev[columna]
  }));
};

/**
 * Seleccionar/Deseleccionar todas las columnas
 */
const toggleTodasColumnas = (seleccionar) => {
  const nuevasColumnas = {};
  Object.keys(columnasVisibles).forEach(col => {
    nuevasColumnas[col] = seleccionar;
  });
  setColumnasVisibles(nuevasColumnas);
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
          <p>No tienes permiso para acceder a los reportes del sistema.</p>
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDERIZADO PRINCIPAL
  // ============================================================

  return (
    <div className="users-section">
      
      {/* ==================== PASO 1: SELECCIÓN DE MÓDULO ==================== */}
      {!selectedModulo && (
        <div className="periodo-selection-page">
          <div className="section-header">
            <div className="section-title">
              <BarChart3 className="w-7 h-7 text-blue-600" />
              <h2>Reportes y Estadísticas</h2>
            </div>
          </div>

          {/* SECCIÓN: MÓDULOS DISPONIBLES */}
          <div className="periodo-selector-container">
            <div className="periodo-selector-header">
              <div>
                <h3 className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-blue-600" />
                  Selecciona un módulo para generar el reporte
                </h3>
                <p className="periodo-selector-subtitle">
                  Elige el tipo de reporte que deseas visualizar
                </p>
              </div>
            </div>

            <div className="reports-modules-grid">
              {modulosSistema.map((modulo) => {
                const Icon = modulo.icon;
                return (
                  <div
                    key={modulo.value}
                    className="report-module-card"
                    onClick={() => handleModuloSelect(modulo.value)}
                  >
                    <div className="report-module-header">
                      <div className="report-module-icon">
                        <Icon size={32} style={{ color: modulo.color }} />
                      </div>
                      <div className="report-module-text">
                        <h3 className="report-module-title">{modulo.label}</h3>
                        <p className="report-module-description">{modulo.description}</p>
                      </div>
                    </div>

                    <div className="report-module-footer">
                      <span className="report-module-footer-text">
                        Ver reportes
                      </span>
                      <span className="report-module-footer-arrow">→</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==================== PASO 2: GESTIÓN DEL REPORTE SELECCIONADO ==================== */}
      {selectedModulo && (
        <div className="periodo-management-page">
          
          {/* ENCABEZADO CON BOTÓN VOLVER */}
          <div className="section-header">
            <div className="section-title-with-back">
              <button 
                className="btn-back" 
                onClick={limpiarFiltros}
                title="Volver a selección de módulos"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Volver</span>
              </button>
              
              <div className="section-title">
                {(() => {
                  const moduloInfo = modulosSistema.find(m => m.value === selectedModulo);
                  const Icon = moduloInfo?.icon || FileText;
                  return (
                    <>
                      <Icon className="w-7 h-7 text-blue-600" />
                      <div>
                        <h2>Reporte de {moduloInfo?.label}</h2>
                        <p className="section-subtitle">
                          {moduloInfo?.description}
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* BOTONES DE ACCIÓN */}
            <div className="actions">
              {reporteData.length > 0 && (
                <>
                  <button onClick={exportarExcel} className="btn-secondary" title="Exportar a CSV">
                    <FileText className="w-4 h-4" />
                  </button>
                  <button onClick={imprimirReporte} className="btn-secondary" title="Imprimir">
                    <FileText className="w-4 h-4" />
                  </button>
                </>
              )}
              {/* Botón de refrescar/actualizar */}
              <button 
                onClick={generarReporte} 
                className="btn-primary"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    <span className="ml-2">Actualizando...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span className="ml-2">Actualizar Reporte</span>
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

          {/* ==================== RESUMEN DEL REPORTE ==================== */}
          {reporteData.length > 0 && (
            <div className="periodo-stats-container">
              <div className="periodo-stats-header">
                <BarChart3 className="w-5 h-5 text-blue-600 mr-2" />
                <h3>Resumen del Reporte </h3>
              </div>

              <div className="users-stats">
                {/* Estadística básica: Total de registros */}
                <div className="stat-item">
                  <Database className="stat-icon text-blue-600" />
                  <div>
                    <p className="stat-label">Total de Registros</p>
                    <p className="stat-value">{stats.total_registros}</p>
                  </div>
                </div>

                {/* Estadísticas dinámicas según el módulo */}
                {estadisticasDinamicas.map((stat, index) => {
                  const IconComponent = getIconComponent(stat.icon);
                  return (
                    <div key={index} className="stat-item">
                      <IconComponent className={`stat-icon ${stat.color}`} />
                      <div>
                        <p className="stat-label">{stat.label}</p>
                        <p className="stat-value">{stat.value}</p>
                      </div>
                    </div>
                  );
                })}

                {/* Periodo */}
                <div className="stat-item">
                  <Calendar className="stat-icon text-purple-600" />
                  <div>
                    <p className="stat-label">Periodo</p>
                    <p className="stat-value text-sm">{stats.periodo}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== BARRA DE BÚSQUEDA Y FILTROS ==================== */}
          <div className="filters-section">
            <div className="search-container">
              <Search className="search-icon" />
              <input
                type="text"
                placeholder="Buscar en resultados del reporte..."
                className="search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
       

            <div className="filters-right">
              <input
                type="date"
                className="filter-input"
                value={filterFechaDesde}
                onChange={(e) => setFilterFechaDesde(e.target.value)}
                title="Fecha desde"
              />
              <input
                type="date"
                className="filter-input"
                value={filterFechaHasta}
                onChange={(e) => setFilterFechaHasta(e.target.value)}
                title="Fecha hasta"
              />

              <select
                className="filter-select"
                value={filterEstado}
                onChange={(e) => setFilterEstado(e.target.value)}
              >
                <option value="todos">Todos</option>
                <option value="activos">Activos</option>
                <option value="inactivos">Inactivos</option>
              </select>

              <button onClick={limpiarFiltrosSinModulo} className="btn-secondary" title="Limpiar filtros">
                <Eraser  className="w-4 h-4" />
              </button>

              {/* BOTÓN TOGGLE COLUMNAS */}
              {reporteData.length > 0 && (
                <button 
                  className={`btn-filter ${mostrarSelectorColumnas ? 'active' : ''}`}
                  onClick={() => setMostrarSelectorColumnas(!mostrarSelectorColumnas)}
                  title="Seleccionar columnas"
                >
                  <Settings className="w-4 h-4" />
                  <span>Columnas ({columnasActivas.length})</span>
                </button>
              )}
              
            </div>
          </div>
          {/* SELECTOR DE COLUMNAS - PANEL EXPANDIBLE */}
          {reporteData.length > 0 && mostrarSelectorColumnas && (
            <div className="column-selector-panel">
              <div className="column-selector-panel-header">
                <div className="column-selector-title">
                  <Settings className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold">Columnas visibles</span>
                </div>
                <div className="column-selector-actions">
                  <button 
                    onClick={() => toggleTodasColumnas(true)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Seleccionar todas
                  </button>
                  <span className="text-gray-400">|</span>
                  <button 
                    onClick={() => toggleTodasColumnas(false)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Deseleccionar todas
                  </button>
                </div>
              </div>

              <div className="column-selector-grid">
                {Object.keys(columnasVisibles).map((columna) => (
                  <label key={columna} className="column-checkbox-item">
                    <input
                      type="checkbox"
                      checked={columnasVisibles[columna]}
                      onChange={() => toggleColumna(columna)}
                    />
                    <span>{columna.replace(/_/g, ' ').toUpperCase()}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          
          {/* ESTADOS DE CARGA */}
          {loading && (
            <div className="empty-state">
              <Loader className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
              <p>Generando reporte...</p>
            </div>
          )}

          {/* SIN DATOS  */}
          {!loading && reporteData.length === 0 && (() => {
            const hasFiltros = searchTerm || filterFechaDesde || filterFechaHasta || filterEstado !== 'todos';
            
            return (
              <div className="empty-state">
                {hasFiltros ? (
                  <>
                    <Search className="w-16 h-16 text-gray-300 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">
                      No se encontraron resultados
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">
                      No hay datos que coincidan con los filtros aplicados.
                    </p>
                    <button 
                      onClick={limpiarFiltrosSinModulo}
                      className="btn-secondary"
                    >
                      <Eraser  className="w-4 h-4" />
                      Limpiar filtros
                    </button>
                  </>
                ) : (
                  <>
                    <Database className="w-16 h-16 text-gray-300 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">
                      Sin datos disponibles
                    </h3>
                    <p className="text-sm text-gray-500">
                      No hay registros en este módulo o aún no se ha generado el reporte.
                    </p>
                  </>
                )}
              </div>
            );
          })()}

          {/* LISTA DE REPORTES - COLUMNAS DINÁMICAS */}
          {!loading && reporteData.length > 0 && (
            <div className="reports-list-container">
              {/* HEADER DINÁMICO - Solo columnas visibles */}
              <div className="reports-list-header" style={{
                gridTemplateColumns: `55px repeat(${columnasActivas.length}, 1fr)`
              }}>
                <span>#</span>
                {columnasActivas.map((key) => (
                  <span key={key}>
                    {key.replace(/_/g, ' ').toUpperCase()}
                  </span>
                ))}
              </div>

              {/* BODY DE DATOS - Solo columnas visibles */}
              <div className="reports-list-body">
                {reporteData.map((row, index) => (
                  <div 
                    key={index} 
                    className="reports-list-item"
                    style={{
                      gridTemplateColumns: `55px repeat(${columnasActivas.length}, 1fr)`
                    }}
                  >
                    {/* Número de fila */}
                    <div className="report-col-id">{index + 1}</div>

                    {/* Valores dinámicos - Solo columnas seleccionadas */}
                    {columnasActivas.map((key, i) => {
                      const value = row[key];
                      return (
                        <div key={i} className="report-col-data">
                          {typeof value === 'boolean' ? (
                            value ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-red-600" />
                            )
                          ) : (
                            <span>{value?.toString() || 'N/A'}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* FOOTER */}
              <div className="reports-list-footer">
                <button 
                  className="btn-secondary"
                  onClick={limpiarFiltros}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Cambiar módulo
                </button>
                
                <div className="reports-list-footer-stats">
                  <span>
                    Mostrando <strong>{reporteData.length}</strong> registros
                  </span>
                  <span className="text-gray-400">|</span>
                  <span>
                    <strong>{columnasActivas.length}</strong> de <strong>{Object.keys(columnasVisibles).length}</strong> columnas
                  </span>
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
};

export default ReportsSection;