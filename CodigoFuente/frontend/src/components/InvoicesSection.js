// src/components/invoices/InvoicesSection.js
// MÓDULO DE FACTURAS - Con sistema de periodos mensuales mejorado

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './ReadingsList.css'; // Reutilizar estilos de lecturas
import invoicesServices from '../services/invoicesServices';
import authService from '../services/authServices';
import {
  FileText,
  Search,
  Eye,
  DollarSign,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  X,
  RefreshCw,
  ArrowUpDown,
  TrendingUp,
  Ban,
  CalendarDays,
  Gauge,
} from 'lucide-react';

const InvoicesSection = () => {
  // ============================================================
  // ESTADOS PRINCIPALES
  // ============================================================
  const [facturas, setFacturas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ============================================================
  // ESTADOS DE PERIODOS
  // ============================================================
  const [periodos, setPeriodos] = useState([]);
  const [periodoActual, setPeriodoActual] = useState(null);
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState(null);
  const [loadingPeriodos, setLoadingPeriodos] = useState(false);

  // ============================================================
  // ESTADOS DE BÚSQUEDA Y FILTROS
  // ============================================================
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortOption, setSortOption] = useState('fecha');
  const [sortOrder, setSortOrder] = useState('desc');

  // ============================================================
  // ESTADOS DE ESTADÍSTICAS
  // ============================================================
  const [stats, setStats] = useState({
    total_facturas: 0,
    facturas_pendientes: 0,
    facturas_pagadas: 0,
    facturas_vencidas: 0,
    facturas_anuladas: 0,
    monto_total_pendiente: 0,
    monto_total_cobrado: 0,
    monto_total: 0
  });

  // ============================================================
  // ESTADOS DE MODAL
  // ============================================================
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('view');
  const [selectedFactura, setSelectedFactura] = useState(null);

  // ============================================================
  // ESTADOS DE PERMISOS
  // ============================================================
  const [permissions, setPermissions] = useState({
    canCreate: false,
    canRead: false,
    canUpdate: false,
    canDelete: false
  });



  // ============================================================
  // FUNCIONES DE PERMISOS
  // ============================================================
  const loadUserPermissions = () => {
    const canCreate = authService.hasPermission('facturas', 'crear') || 
                     authService.hasPermission('facturas', 'crud');
    const canUpdate = authService.hasPermission('facturas', 'actualizar') || 
                     authService.hasPermission('facturas', 'crud');
    const canDelete = authService.hasPermission('facturas', 'eliminar') || 
                     authService.hasPermission('facturas', 'crud');
    const canRead = authService.hasPermission('facturas', 'lectura') || 
                   canCreate || canUpdate || canDelete || 
                   authService.hasPermission('facturas', 'crud');

    setPermissions({ canCreate, canRead, canUpdate, canDelete });
  };

  // ============================================================
  // FUNCIONES DE PERIODOS
  // ============================================================
  const fetchPeriodosDisponibles = useCallback(async () => {
  setLoadingPeriodos(true);
  try {
    const periodosData = await invoicesServices.getPeriodosDisponibles();

    const periodosConInfo = periodosData.map(p => {
      const [anio, mes] = p.valor.split('-');
      return {
        mes: parseInt(mes),
        anio: parseInt(anio),
        nombre_mes: p.texto.split(' ')[0],
        valor: p.valor,
        tiene_facturas: false,
        total_facturas: 0,
        porcentaje_completado: 0
      };
    });

    setPeriodos(periodosConInfo);

    if (periodosConInfo.length > 0) {
      const actual = periodosConInfo[0];
      setPeriodoActual({
        mes: actual.mes,
        anio: actual.anio,
        nombre_mes: actual.nombre_mes
      });
    }

    await fetchPeriodosInfo(periodosConInfo);

  } catch (error) {
    console.error('Error al cargar periodos:', error);
    setError('Error al cargar periodos disponibles');
  } finally {
    setLoadingPeriodos(false);
  }
}, [setLoadingPeriodos]); // ✅ AQUÍ VA EL ARRAY


  const fetchPeriodosInfo = async (periodosBase) => {
    try {
      // Obtener todas las facturas para contar por periodo
      const result = await invoicesServices.getFacturas({ limit: 10000 });
      
      if (result.success) {
        const todasFacturas = result.data;
        
        const periodosActualizados = periodosBase.map(periodo => {
          const facturasDelPeriodo = todasFacturas.filter(f => 
            f.periodo === `${periodo.anio}-${String(periodo.mes).padStart(2, '0')}`
          );
          
          return {
            ...periodo,
            tiene_facturas: facturasDelPeriodo.length > 0,
            total_facturas: facturasDelPeriodo.length,
            porcentaje_completado: facturasDelPeriodo.length > 0 ? 100 : 0
          };
        });
        
        setPeriodos(periodosActualizados);
      }
    } catch (error) {
      console.error('Error al obtener info de periodos:', error);
    }
  };

  const fetchFacturasByPeriodo = useCallback(async () => {
    if (!periodoSeleccionado) return;

    setLoading(true);
    setError(null);

    try {
      const periodoStr = `${periodoSeleccionado.anio}-${String(periodoSeleccionado.mes).padStart(2, '0')}`;
      
      const result = await invoicesServices.getFacturas({
        periodo: periodoStr,
        limit: 1000
      });

      if (result.success) {
        setFacturas(result.data);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Error al cargar facturas del periodo');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [periodoSeleccionado]);

const fetchStats = useCallback(async () => {
  if (!periodoSeleccionado) return;

  try {
    const periodoStr = `${periodoSeleccionado.anio}-${String(periodoSeleccionado.mes).padStart(2, '0')}`;
    const result = await invoicesServices.getStats(periodoStr);

    if (result.success) {
      setStats(result.data);
    }
  } catch (err) {
    console.error('Error al cargar estadísticas:', err);
  }
}, [periodoSeleccionado]);


  const handlePeriodoChange = (mes, anio) => {
    setPeriodoSeleccionado({ mes, anio });
  };

  const getPorcentajeCompletado = (periodo) => {
    if (!periodo) return 0;
    return periodo.porcentaje_completado || 0;
  };

    // ============================================================
  // EFECTOS
  // ============================================================
  useEffect(() => {
    loadUserPermissions();
    fetchPeriodosDisponibles();
  }, [fetchPeriodosDisponibles]);

  useEffect(() => {
    if (permissions.canRead && periodoSeleccionado) {
      fetchFacturasByPeriodo();
      fetchStats();
    }
  }, [periodoSeleccionado, permissions.canRead, fetchFacturasByPeriodo, fetchStats]);

  // ============================================================
  // FUNCIONES DE FILTRADO Y ORDENAMIENTO
  // ============================================================
  const filteredFacturas = facturas.filter(factura => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      factura.num_factura?.toLowerCase().includes(searchLower) ||
      factura.id_factura?.toString().includes(searchTerm);

    const matchesStatus = 
      filterStatus === 'all' || 
      factura.estado_factura === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const sortedFacturas = useMemo(() => {
    return [...filteredFacturas].sort((a, b) => {
      let comparison = 0;

      if (sortOption === 'fecha') {
        comparison = new Date(a.fecha_emision) - new Date(b.fecha_emision);
      } else if (sortOption === 'numero') {
        comparison = a.num_factura.localeCompare(b.num_factura);
      } else if (sortOption === 'total') {
        comparison = parseFloat(a.total) - parseFloat(b.total);
      } else if (sortOption === 'estado') {
        comparison = a.estado_factura.localeCompare(b.estado_factura);
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredFacturas, sortOption, sortOrder]);

  const toggleSortOrder = () => {
    setSortOrder(prevOrder => prevOrder === 'asc' ? 'desc' : 'asc');
  };

  // ============================================================
  // FUNCIONES DE MODAL
  // ============================================================
  const openModal = async (type, factura = null) => {
    if (type === 'view' && !factura) return;
    if (type === 'edit' && !permissions.canUpdate) {
      alert('❌ No tienes permiso para editar facturas');
      return;
    }

    setModalType(type);
    setSelectedFactura(factura);
    setError(null);

    if (type === 'view' && factura) {
      try {
        const result = await invoicesServices.getFacturaById(factura.id_factura);
        if (result.success) {
          setSelectedFactura(result.data);
        }
      } catch (err) {
        console.error('Error cargando detalles:', err);
      }
    }

    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedFactura(null);
    setError(null);
  };

  // ============================================================
  // FUNCIONES DE ACCIONES
  // ============================================================
  const handleCambiarEstado = async (facturaId, nuevoEstado) => {
    if (!permissions.canUpdate) {
      alert('❌ No tienes permiso para cambiar estados');
      return;
    }

    const confirmado = window.confirm(
      `¿Marcar factura como ${nuevoEstado}?`
    );
    
    if (!confirmado) return;

    setLoading(true);
    try {
      const result = await invoicesServices.cambiarEstado(facturaId, nuevoEstado);
      
      if (result.success) {
        alert(`✅ Factura marcada como ${nuevoEstado}`);
        await fetchFacturasByPeriodo();
        await fetchStats();
      } else {
        alert(`❌ Error: ${result.message}`);
      }
    } catch (error) {
      alert('❌ Error al cambiar estado de factura');
    } finally {
      setLoading(false);
    }
  };

  const handleAnularFactura = async (facturaId) => {
    if (!permissions.canDelete) {
      alert('❌ No tienes permiso para anular facturas');
      return;
    }

    const motivo = window.prompt('Motivo de anulación (opcional):');
    if (motivo === null) return;

    setLoading(true);
    try {
      const result = await invoicesServices.anularFactura(facturaId, motivo);
      
      if (result.success) {
        alert('✅ Factura anulada correctamente');
        closeModal();
        await fetchFacturasByPeriodo();
        await fetchStats();
      } else {
        alert(`❌ Error: ${result.message}`);
      }
    } catch (error) {
      alert('❌ Error al anular factura');
    } finally {
      setLoading(false);
    }
  };

  const handleEliminarFactura = async (facturaId) => {
    if (!permissions.canDelete) {
      alert('❌ No tienes permiso para eliminar facturas');
      return;
    }

    const confirmado = window.confirm(
      '¿Eliminar esta factura?\n\n' +
      'Solo se pueden eliminar facturas pendientes sin detalles.\n' +
      'Esta acción no se puede deshacer.'
    );
    
    if (!confirmado) return;

    setLoading(true);
    try {
      const result = await invoicesServices.deleteFactura(facturaId);
      
      if (result.success) {
        alert('✅ Factura eliminada correctamente');
        closeModal();
        await fetchFacturasByPeriodo();
        await fetchStats();
      } else {
        alert(`❌ Error: ${result.message}`);
      }
    } catch (error) {
      alert('❌ Error al eliminar factura');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // HELPER FUNCTIONS
  // ============================================================
  const getStatusBadge = (estado) => {
    const configs = {
      pendiente: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, texto: 'Pendiente' },
      pagada: { color: 'bg-green-100 text-green-800', icon: CheckCircle, texto: 'Pagada' },
      vencida: { color: 'bg-red-100 text-red-800', icon: XCircle, texto: 'Vencida' },
      anulada: { color: 'bg-gray-100 text-gray-800', icon: Ban, texto: 'Anulada' }
    };

    const config = configs[estado] || configs.pendiente;
    const IconComponent = config.icon;

    return (
      <span className={`status-badge ${estado === 'pagada' ? 'active' : estado === 'anulada' ? 'inactive' : ''}`}>
        <IconComponent className="w-3 h-3" />
        {config.texto}
      </span>
    );
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString + 'T00:00:00').toLocaleDateString('es-EC', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateShort = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString + 'T00:00:00').toLocaleDateString('es-EC', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatearPeriodo = (mes, anio) => {
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                   'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return `${meses[mes - 1]} ${anio}`;
  };

  // ============================================================
  // RENDERIZADO - VERIFICACIÓN DE PERMISOS
  // ============================================================
  if (!permissions.canRead) {
    return (
      <div className="affiliates-section">
        <div className="empty-state">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h3>Sin Acceso</h3>
          <p>No tienes permiso para acceder al módulo de facturas.</p>
        </div>
      </div>
    );
  }

  if (loadingPeriodos) {
    return (
      <div className="affiliates-section">
        <div className="empty-state">
          <RefreshCw className="w-16 h-16 text-blue-400 mx-auto mb-4 animate-spin" />
          <h3>Cargando periodos...</h3>
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDERIZADO PRINCIPAL
  // ============================================================
  return (
    <div className="affiliates-section">
      
      {/* ==================== PASO 1: SELECCIÓN DE PERIODO ==================== */}
      {!periodoSeleccionado && (
        <div className="periodo-selection-page">
          <div className="section-header">
            <div className="section-title">
              <FileText className="w-7 h-7 text-blue-600" />
              <h2>Gestión de Facturas</h2>
            </div>
          </div>

          {/* SECCIÓN 1: PERÍODOS RECIENTES */}
          <div className="periodo-selector-container">
            <div className="periodo-selector-header">
              <div>
                <h3>
                  <CalendarDays className="w-5 h-5 text-blue-600 mr-2" />
                  Períodos de Facturación
                </h3>
                <p className="periodo-selector-subtitle">
                  Selecciona el período para gestionar facturas
                </p>
              </div>
            </div>

            <div className="periodos-grid">
              {(() => {
                const hoy = new Date();
                const mesActual = hoy.getMonth() + 1;
                const anioActual = hoy.getFullYear();
                
                const calcularDiferenciaMeses = (mes, anio) => {
                  return (anio - anioActual) * 12 + (mes - mesActual);
                };
                
                const periodosRecientes = periodos
                  .filter(periodo => {
                    const diff = calcularDiferenciaMeses(periodo.mes, periodo.anio);
                    return diff >= -2 && diff <= 2;
                  })
                  .sort((a, b) => {
                    if (a.anio !== b.anio) return b.anio - a.anio;
                    return b.mes - a.mes;
                  });

                return periodosRecientes.map(periodo => {
                  const porcentaje = getPorcentajeCompletado(periodo);
                  const tieneFacturas = periodo.tiene_facturas;
                  // REEMPLÁZALA CON:
const esMesActual = (periodo.mes === mesActual && periodo.anio === anioActual) || 
                    (periodoActual && periodo.mes === periodoActual.mes && periodo.anio === periodoActual.anio);

                  return (
                    <button
                      key={`${periodo.mes}-${periodo.anio}`}
                      onClick={() => handlePeriodoChange(periodo.mes, periodo.anio)}
                      className={`periodo-card hoverable ${esMesActual ? 'mes-actual' : ''}`}
                    >
                      <div className="periodo-card-header">
                        <span className="periodo-card-title">
                          {periodo.nombre_mes} {periodo.anio}
                        </span>
                        {esMesActual && (
                          <span className="periodo-badge-actual">Actual</span>
                        )}
                      </div>

                      <div className="periodo-card-info">
                        {periodo.total_facturas} facturas
                      </div>

                      <div className={`periodo-percentage ${tieneFacturas ? 'complete' : ''}`}>
                        {tieneFacturas 
                          ? `${periodo.total_facturas} factura${periodo.total_facturas !== 1 ? 's' : ''} registrada${periodo.total_facturas !== 1 ? 's' : ''}`
                          : 'Sin facturas registradas'
                        }
                      </div>

                      <div className={`periodo-percentage ${tieneFacturas ? 'complete' : ''}`}>
                        {tieneFacturas ? 'Con facturas' : 'Sin facturas'}
                      </div>

                      <div className="periodo-card-action">
                        <span>{tieneFacturas ? 'Ver facturas' : 'Periodo vacío'}</span>
                      </div>
                    </button>
                  );
                });
              })()}
            </div>
          </div>

          {/* SECCIÓN 2: HISTORIAL DE PERÍODOS */}
          <div className="periodo-historial-container">
            <div className="flex items-center">
              <div>
                <h3 className="font-semibold text-[16px] leading-[1.2]">
                  <Clock className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0 self-center" />
                  Historial de Períodos
                </h3>
                <p className="periodo-historial-subtitle text-[14px]">
                  Períodos anteriores con facturas registradas
                </p>
              </div>
            </div>

            {(() => {
              const hoy = new Date();
              const mesActual = hoy.getMonth() + 1;
              const anioActual = hoy.getFullYear();
              
              const calcularDiferenciaMeses = (mes, anio) => {
                return (anio - anioActual) * 12 + (mes - mesActual);
              };
              
              const periodosHistorial = periodos
                .filter(periodo => {
                  const diff = calcularDiferenciaMeses(periodo.mes, periodo.anio);
                  return diff < -2 && periodo.tiene_facturas;
                })
                .sort((a, b) => {
                  if (a.anio !== b.anio) return b.anio - a.anio;
                  return b.mes - a.mes;
                });

              if (periodosHistorial.length === 0) {
                return (
                  <div className="periodo-historial-empty">
                    <AlertCircle className="w-12 h-12 text-gray-300 mb-2" />
                    <p>No hay períodos anteriores con facturas registradas</p>
                  </div>
                );
              }

              return (
                <div className="periodo-historial-list">
                  {periodosHistorial.map(periodo => (
                    <button
                      key={`hist-${periodo.mes}-${periodo.anio}`}
                      onClick={() => handlePeriodoChange(periodo.mes, periodo.anio)}
                      className="periodo-historial-list-item"
                    >
                      <div className="periodo-historial-col-fecha">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <span className="periodo-historial-mes-nombre">
                          {periodo.nombre_mes} {periodo.anio}
                        </span>
                      </div>

                      <div className="periodo-historial-col-stats">
                        <div className="periodo-historial-stat-item">
                          <FileText className="w-4 h-4 text-blue-500" />
                          <span>{periodo.total_facturas} facturas</span>
                        </div>
                      </div>

                      <div className="periodo-historial-col-estado">
                        <div className="periodo-historial-badge completo">
                          <CheckCircle className="w-4 h-4" />
                          <span>Disponible</span>
                        </div>
                      </div>

                      <div className="periodo-historial-col-action">
                        <Eye className="w-4 h-4" />
                        <span>Ver</span>
                      </div>
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ==================== PASO 2: GESTIÓN DE FACTURAS DEL PERIODO ==================== */}
      {periodoSeleccionado && (
        <div className="periodo-management-page">
          
          {/* ENCABEZADO CON BOTÓN VOLVER */}
          <div className="section-header">
            <div className="section-title-with-back">
              <button 
                className="btn-back" 
                onClick={() => setPeriodoSeleccionado(null)}
                title="Volver a selección de periodos"
              >
                <ArrowUpDown className="w-5 h-5" style={{ transform: 'rotate(90deg)' }} />
                <span>Volver</span>
              </button>
              
              <div className="section-title">
                <FileText className="w-7 h-7 text-blue-600" />
                <div>
                  <h2>Facturas de {formatearPeriodo(periodoSeleccionado.mes, periodoSeleccionado.anio)}</h2>
                  <p className="section-subtitle">
                    Gestiona las facturas de este periodo
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ESTADÍSTICAS DEL PERIODO */}
          <div className="periodo-stats-container">
            <div className="periodo-stats-header">
              <TrendingUp className="w-5 h-5 text-blue-600 mr-2" />
              <h3>Resumen del Periodo</h3>
            </div>

            <div className="users-stats">
              <div className="stat-item">
                <DollarSign className="stat-icon text-blue-600" />
                <div>
                  <p className="stat-label">Total Facturado</p>
                  <p className="stat-value">{formatCurrency(stats.monto_total)}</p>
                </div>
              </div>

              <div className="stat-item">
                <CheckCircle className="stat-icon text-green-600" />
                <div>
                  <p className="stat-label">Cobrado</p>
                  <p className="stat-value">{formatCurrency(stats.monto_total_cobrado)}</p>
                  <p className="stat-detail">{stats.facturas_pagadas} facturas</p>
                </div>
              </div>

              <div className="stat-item">
                <Clock className="stat-icon text-yellow-600" />
                <div>
                  <p className="stat-label">Pendiente</p>
                  <p className="stat-value">{formatCurrency(stats.monto_total_pendiente)}</p>
                  <p className="stat-detail">{stats.facturas_pendientes} facturas</p>
                </div>
              </div>

              <div className="stat-item">
                <XCircle className="stat-icon text-red-600" />
                <div>
                  <p className="stat-label">Vencidas</p>
                  <p className="stat-value">{stats.facturas_vencidas}</p>
                  <p className="stat-detail">facturas</p>
                </div>
              </div>
            </div>
          </div>

          {/* BARRA DE BÚSQUEDA Y FILTROS */}
          <div className="filters-section">
            <div className="search-container">
              <Search className="search-icon" />
              <input
                type="text"
                placeholder="Buscar por número de factura..."
                className="search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="filters-right">
              <select
                className="filter-select"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">Todos los estados</option>
                <option value="pendiente">Pendientes</option>
                <option value="pagada">Pagadas</option>
                <option value="vencida">Vencidas</option>
                <option value="anulada">Anuladas</option>
              </select>

              <select
                className="filter-select"
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
              >
                <option value="fecha">Ordenar por Fecha</option>
                <option value="numero">Ordenar por Número</option>
                <option value="total">Ordenar por Monto</option>
                <option value="estado">Ordenar por Estado</option>
              </select>

              <button
                className="btn-secondary"
                onClick={toggleSortOrder}
                title={sortOrder === 'asc' ? 'Orden Ascendente' : 'Orden Descendente'}
              >
                <ArrowUpDown className="w-4 h-4" />
                <span className="ml-1 text-xs">{sortOrder === 'asc' ? '↑' : '↓'}</span>
              </button>

              <button 
                className="btn-secondary" 
                onClick={() => {
                  fetchFacturasByPeriodo();
                  fetchStats();
                }} 
                title="Recargar"
              >
                <RefreshCw className="w-4 h-4" />
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

          {/* INDICADOR DE CARGA */}
          {loading && (
            <div className="empty-state">
              <RefreshCw className="w-12 h-12 text-blue-400 mx-auto mb-4 animate-spin" />
              <h3>Cargando facturas...</h3>
            </div>
          )}

          {/* LISTA DE FACTURAS */}
          {!loading && (
            <div className="readings-list-container">
              <div className="readings-list-header">
                <span>#</span>
                <span><FileText className="w-4 h-4" /> Número</span>
                <span><Calendar className="w-4 h-4" /> Fecha</span>
                <span><Gauge className="w-4 h-4" /> Consumo</span>
                <span><DollarSign className="w-4 h-4" /> Total</span>
                <span>Estado</span>
                <span>Acciones</span>
              </div>

              <div className="readings-list-body">
                {sortedFacturas.length > 0 ? (
                  sortedFacturas.map((factura, index) => (
                    <div 
                      key={factura.id_factura} 
                      className={`readings-list-item ${factura.estado_factura === 'anulada' ? 'inactive' : ''}`}
                    >
                      <div className="list-col-id">{index + 1}</div>

                      <div className="list-col-medidor">
                        <div className="medidor-icon">
                          <FileText className="w-4 h-4" />
                        </div>
                        <span className="medidor-numero font-mono">
                          {factura.num_factura}
                        </span>
                      </div>

                      <div className="list-col-fecha">
                        <Calendar className="w-3 h-3" />
                        {formatDateShort(factura.fecha_emision)}
                      </div>

                      <div className="list-col-consumo">
                        {factura.consumo_m3 || 0} m³
                      </div>

                      <div className="list-col-lectura font-bold text-lg">
                        {formatCurrency(factura.total)}
                      </div>

                      <div className="status-wrapper">
                        {getStatusBadge(factura.estado_factura)}
                      </div>

                      <div className="list-actions">
                        <button 
                          className="list-action-btn view" 
                          onClick={() => openModal('view', factura)} 
                          title="Ver detalles"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {permissions.canUpdate && factura.estado_factura === 'pendiente' && (
                          <button
                            className="list-action-btn edit"
                            onClick={() => handleCambiarEstado(factura.id_factura, 'pagada')}
                            title="Marcar como pagada"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}

                        {permissions.canDelete && ['pendiente', 'vencida'].includes(factura.estado_factura) && (
                          <button
                            className="list-action-btn delete"
                            onClick={() => handleAnularFactura(factura.id_factura)}
                            title="Anular factura"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="readings-list-empty">
                    <FileText />
                    <h3>No hay facturas en este periodo</h3>
                    <p>
                      {searchTerm || filterStatus !== 'all'
                        ? 'No se encontraron facturas con los criterios de búsqueda.'
                        : `No hay facturas registradas para ${formatearPeriodo(periodoSeleccionado.mes, periodoSeleccionado.anio)}`
                      }
                    </p>
                  </div>
                )}
              </div>

              {sortedFacturas.length > 0 && (
                <div className="readings-list-footer">
                  <button 
                    className="btn-secondary"
                    onClick={() => setPeriodoSeleccionado(null)}
                  >
                    <ArrowUpDown className="w-4 h-4 mr-2" style={{ transform: 'rotate(90deg)' }} />
                    Cambiar periodo
                  </button>
                  
                  <div className="readings-list-footer-stats">
                    <span>
                      Mostrando <strong>{sortedFacturas.length}</strong> facturas
                    </span>
                    <span>
                      Total: <strong>{formatCurrency(sortedFacturas.reduce((sum, f) => sum + parseFloat(f.total || 0), 0))}</strong>
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================== MODAL DE DETALLES ==================== */}
      {showModal && modalType === 'view' && selectedFactura && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>
                <FileText className="w-5 h-5 inline mr-2" />
                Detalle de Factura
              </h3>
              <button className="modal-close" onClick={closeModal}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="modal-body">
              <div className="user-details">
                {/* Información General */}
                <div className="detail-group">
                  <label>Número de Factura:</label>
                  <p className="font-mono font-bold">{selectedFactura.num_factura}</p>
                </div>

                <div className="detail-group">
                  <label>Periodo:</label>
                  <p>{invoicesServices.formatearPeriodo(selectedFactura.periodo)}</p>
                </div>

                <div className="detail-group">
                  <label>Fecha de Emisión:</label>
                  <p>{formatDate(selectedFactura.fecha_emision)}</p>
                </div>

                <div className="detail-group">
                  <label>Estado:</label>
                  {getStatusBadge(selectedFactura.estado_factura)}
                </div>

                {/* Consumo */}
                <div className="detail-group">
                  <label>Consumo:</label>
                  <p className="font-semibold">{selectedFactura.consumo_m3 || 0} m³</p>
                </div>

                <div className="detail-group">
                  <label>Exceso:</label>
                  <p>{selectedFactura.exceso_m3 || 0} m³</p>
                </div>

                <div className="detail-group">
                  <label>Valor Consumo:</label>
                  <p>{formatCurrency(selectedFactura.valor_consumo)}</p>
                </div>

                <div className="detail-group">
                  <label>Valor Exceso:</label>
                  <p>{formatCurrency(selectedFactura.valor_exceso)}</p>
                </div>

                {/* Totales */}
                <div className="detail-group">
                  <label>Subtotal:</label>
                  <p>{formatCurrency(selectedFactura.subtotal)}</p>
                </div>

                <div className="detail-group">
                  <label>Descuento:</label>
                  <p className="text-green-600">
                    -{formatCurrency(selectedFactura.descuento || 0)}
                  </p>
                </div>

                <div className="detail-group">
                  <label>Impuesto (IVA):</label>
                  <p>{formatCurrency(selectedFactura.impuesto)}</p>
                </div>

                <div className="detail-group">
                  <label>TOTAL:</label>
                  <p className="font-bold text-2xl text-blue-600">
                    {formatCurrency(selectedFactura.total)}
                  </p>
                </div>

                {/* Detalles adicionales */}
                {selectedFactura.detalles && selectedFactura.detalles.length > 0 && (
                  <div className="detail-group form-group-full">
                    <label>Detalles de la Factura:</label>
                    <div className="bg-gray-50 p-3 rounded border border-gray-200">
                      {selectedFactura.detalles.map((detalle, idx) => (
                        <div key={idx} className="flex justify-between items-center py-2 border-b last:border-b-0">
                          <span className="text-sm">{detalle.descripcion || detalle.tipo_detalle}</span>
                          <span className="font-semibold">{formatCurrency(detalle.subtotal_detalle)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="form-actions">
              {permissions.canUpdate && selectedFactura.estado_factura === 'pendiente' && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    closeModal();
                    handleCambiarEstado(selectedFactura.id_factura, 'pagada');
                  }}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Marcar como Pagada
                </button>
              )}

              {permissions.canDelete && ['pendiente', 'vencida'].includes(selectedFactura.estado_factura) && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => handleAnularFactura(selectedFactura.id_factura)}
                >
                  <Ban className="w-4 h-4 mr-2" />
                  Anular Factura
                </button>
              )}

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

export default InvoicesSection;