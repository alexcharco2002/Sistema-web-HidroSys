// src/sections/administrador/ReportsSection.js
// MÓDULO DE GENERACIÓN DE REPORTES DEL SISTEMA
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import authService from '../../services/authServices';
import reportsServices from '../../services/reportsServices';
import './ReportsSection.css';

// Iconos de Lucide React
import { FileText, Calendar, Search, BarChart3, Users, Droplet, 
  DollarSign, AlertCircle, CheckCircle, RefreshCw, Loader, Settings, 
  Database, MapPin, CreditCard, Shield, Activity, Clock, ArrowLeft, 
  Eraser, XCircle, User, TrendingUp, FileSpreadsheet, Printer, FileDown, ChevronDown, Wallet, X
} from 'lucide-react'


import { ReportExport } from '../../components/ReportExport';

import ReportStats from '../../components/ReportStats';

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

  const [filterEstado, setFilterEstado] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');

  // FILTROS ESPECÍFICOS POR MÓDULO 
  const [filterSector, setFilterSector] = useState('todos');        // Para Medidores
  const [filterTipoLectura, setFilterTipoLectura] = useState('todos'); // Para Lecturas (real/estimada)
  const [filterPagoCompleto, setFilterPagoCompleto] = useState('todos'); // Para Pagos
  const [sectoresDisponibles, setSectoresDisponibles] = useState([]); // Lista de sectores
  // estados para multas
  const [filterActivoMultas, ] = useState('todos');  

  // estados para ordenamiento
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');

  // ============================================================
  // ESTADOS ESPECÍFICOS DE CAJA
  // ============================================================
  const [cajaMensualData, setCajaMensualData] = useState(null);
  const [cajaAnualData, setCajaAnualData] = useState(null);
  const [, setCajaDetalleDiario] = useState([]);
  const [cajaAniosDisponibles, setCajaAniosDisponibles] = useState([]);
  const [, setCajaVistaActiva] = useState('mensual'); // 'mensual' | 'anual' | 'diario'
  const [cajaMesFiltro, setCajaMesFiltro] = useState(null);
  const [cajaAnioFiltro, setCajaAnioFiltro] = useState(null);
  const [cajaMesesDisponibles, setCajaMesesDisponibles] = useState({}); 

  // ── ESTADO DEL MODAL INDIVIDUAL ──────────────────────────────
  const [modalIndividual, setModalIndividual] = useState(false);
  const [pasoModal, setPasoModal] = useState(1);
  const [afiliadosModal, setAfiliadosModal] = useState([]);
  const [searchAfiliado, setSearchAfiliado] = useState('');
  const [afiliadoSeleccionado, setAfiliadoSeleccionado] = useState(null);
  const [loadingReporteIndividual, setLoadingReporteIndividual] = useState(false);
  const [periodosIndividuales, setPeriodosIndividuales] = useState({});
  // estado para controlar selección de periodo individual (mes, rango, año) y sus valores
  const [periodoIndividualSeleccionado, setPeriodoIndividualSeleccionado] = useState(null);
  const [modoSeleccion, setModoSeleccion] = useState('mes'); 
  const [rangoDesdeInd, setRangoDesdeInd] = useState(null);   
  const [rangoHastaInd, setRangoHastaInd] = useState(null);    
  const [anioSeleccionado, setAnioSeleccionado] = useState(null);  

  // estados para filtros dinámicos de módulos con relaciones (lecturas por sector, medidores por sector, etc)
  const [medidoresDisponibles, setMedidoresDisponibles] = useState([])  // lista única
  const [filterMedidor, setFilterMedidor] = useState('todos')           // medidor seleccionado

  const [esReporteIndividual, setEsReporteIndividual] = useState(false);
  
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
  // ESTADOS para estadsiticas avanzadas
  // ============================================================
  const [mostrarEstadisticas, setMostrarEstadisticas] = useState(false);
  // ============================================================
  // ESTADOS DE COLUMNAS
  // ============================================================
  const [columnasVisibles, setColumnasVisibles] = useState({});
  const [mostrarSelectorColumnas, setMostrarSelectorColumnas] = useState(false);  

  // ============================================================
  // ESTADOS DE FILTROS DE PERIODO (solo para Lecturas, Facturas, Pagos)
  // ============================================================
  const [periodos, setPeriodos] = useState([]);
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState('');
  const [aniosExpandidos, setAniosExpandidos] = useState({})  // para controlar expansión de años en selector de periodos
  const [historialExpandido, setHistorialExpandido] = useState(true)

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
      value: 'Servicios', 
      label: 'Servicios', 
      icon: Settings, 
      color: '#14b8a6',
      description: 'Gestión de servicios adicionales ofrecidos'
    },
     { 
      value: 'Multas', 
      label: 'Multas', 
      icon: AlertCircle, 
      color: '#ef4444',
      description: 'Registro de multas y penalizaciones'
    },
    { 
      value: 'Lecturas', 
      label: 'Lecturas', 
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
      label: 'Pagos', 
      icon: CreditCard, 
      color: '#22c55e',
      description: 'Control de pagos y transacciones realizadas'
    },
   
    { 
      value: 'MultasAfiliados', 
      label: 'Multas a Afiliados', 
      icon: AlertCircle, 
      color: '#f97316',
      description: 'Multas específicas aplicadas a usuarios'
    },
    { 
      value: 'Caja', 
      label: 'Caja General', 
      icon: Wallet, 
      color: '#10b981',
      description: 'Resumen de ingresos por cobros de agua y multas'
    },

    
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
      
        // caso de tarifas
      case 'Tarifas': {
        const precios = reporteData.map(t => Number(t.precio_por_m3) || 0);
        const max = precios.length ? Math.max(...precios) : 0;
        const min = precios.length ? Math.min(...precios) : 0;
        const avg = precios.length ? (precios.reduce((a, b) => a + b, 0) / precios.length) : 0;
        
        const tarifasActivas = reporteData.filter(t => t.activo === 'Sí' || t.activo === true).length;
        const tarifasInactivas = reporteData.filter(t => t.activo === 'No' || t.activo === false).length;

        stats.push(
          { label: 'Precio máximo', value: `$${max.toFixed(2)}`, icon: 'DollarSign', color: 'text-green-600' },
          { label: 'Precio mínimo', value: `$${min.toFixed(2)}`, icon: 'DollarSign', color: 'text-red-600' },
          { label: 'Precio promedio', value: `$${avg.toFixed(2)}`, icon: 'TrendingUp', color: 'text-blue-600' },
          { label: 'Tarifas activas', value: tarifasActivas, icon: 'CheckCircle', color: 'text-green-600' },
          { label: 'Tarifas inactivas', value: tarifasInactivas, icon: 'XCircle', color: 'text-red-600' }
        );
        break;
      }

      case 'Servicios': {
        const precios = reporteData.map(s => Number(s.precio_base) || 0);
        const max = precios.length ? Math.max(...precios) : 0;
        const min = precios.length ? Math.min(...precios) : 0;
        const avg = precios.length ? (precios.reduce((a, b) => a + b, 0) / precios.length) : 0;
        
        const serviciosActivos = reporteData.filter(s => s.activo === 'Sí' || s.activo === true).length;
        const serviciosInactivos = reporteData.filter(s => s.activo === 'No' || s.activo === false).length;
        const vigentes = reporteData.filter(s => s.es_vigente === 'Sí' || s.es_vigente === true).length;

        stats.push(
          { label: 'Precio máximo', value: `$${max.toFixed(2)}`, icon: 'DollarSign', color: 'text-green-600' },
          { label: 'Precio mínimo', value: `$${min.toFixed(2)}`, icon: 'DollarSign', color: 'text-red-600' },
          { label: 'Precio promedio', value: `$${avg.toFixed(2)}`, icon: 'TrendingUp', color: 'text-blue-600' },
          { label: 'Servicios vigentes', value: vigentes, icon: 'CheckCircle', color: 'text-green-600' },
          { label: 'Servicios activos', value: serviciosActivos, icon: 'Activity', color: 'text-blue-600' },
          { label: 'Servicios inactivos', value: serviciosInactivos, icon: 'XCircle', color: 'text-red-600' }
        );
        break;
      }

      case 'Lecturas': {
        const consumos = reporteData.map(l => parseFloat(l.consumo_m3 || l.consumo) || 0);
        const totalConsumo = consumos.reduce((sum, c) => sum + c, 0);
        const promedioConsumo = reporteData.length > 0 ? (totalConsumo / reporteData.length) : 0;
        const consumoMax = consumos.length > 0 ? Math.max(...consumos) : 0;
        const consumoMin = consumos.length > 0 ? Math.min(...consumos) : 0;
        
        // Mediana de consumo
        const consumosOrdenados = [...consumos].sort((a, b) => a - b);
        const mediana = consumosOrdenados.length > 0 
          ? consumosOrdenados.length % 2 === 0
            ? (consumosOrdenados[consumosOrdenados.length / 2 - 1] + consumosOrdenados[consumosOrdenados.length / 2]) / 2
            : consumosOrdenados[Math.floor(consumosOrdenados.length / 2)]
          : 0;
        
        // Tipos de lectura
        const reales = reporteData.filter(l => l.tipo_lectura === 'Real' || l.es_estimada === false || l.es_estimada === 'No').length;
        const estimadas = reporteData.filter(l => l.tipo_lectura === 'Estimada' || l.es_estimada === true || l.es_estimada === 'Sí').length;
        const porcentajeEstimadas = reporteData.length > 0 ? ((estimadas / reporteData.length) * 100).toFixed(1) : 0;
        
        // Medidores únicos
        const medidoresUnicos = new Set(reporteData.map(l => l.num_medidor).filter(Boolean)).size;

        stats.push(
          { label: 'Total Lecturas', value: reporteData.length, icon: 'Database', color: 'text-purple-600' },
          { label: 'Medidores', value: medidoresUnicos, icon: 'Activity', color: 'text-indigo-600' },
          { label: 'Consumo Total', value: `${totalConsumo.toFixed(2)} m³`, icon: 'Droplet', color: 'text-blue-600' },
          { label: 'Consumo Promedio', value: `${promedioConsumo.toFixed(2)} m³`, icon: 'TrendingUp', color: 'text-green-600' },
          { label: 'Consumo Mediano', value: `${mediana.toFixed(2)} m³`, icon: 'TrendingUp', color: 'text-teal-600' },
          { label: 'Consumo Máximo', value: `${consumoMax.toFixed(2)} m³`, icon: 'AlertCircle', color: 'text-red-600' },
          { label: 'Consumo Mínimo', value: `${consumoMin.toFixed(2)} m³`, icon: 'CheckCircle', color: 'text-green-700' },
          { label: 'Lecturas Reales', value: `${reales} (${(100 - parseFloat(porcentajeEstimadas)).toFixed(1)}%)`, icon: 'CheckCircle', color: 'text-green-600' },
          { label: 'Lecturas Estimadas', value: `${estimadas} (${porcentajeEstimadas}%)`, icon: 'Clock', color: 'text-orange-600' }
        );
        break;
      }

      case 'Facturas':
        const totalFacturado = reporteData.reduce((sum, f) => sum + (parseFloat(f.total || f.monto_total) || 0), 0);
        
        // Contar por estado real del campo 'estado'
        const pagadas = reporteData.filter(f => 
          f.estado?.toLowerCase() === 'pagada' || f.estado_factura?.toLowerCase() === 'pagada'
        ).length;
        
        const pendientes = reporteData.filter(f => 
          f.estado?.toLowerCase() === 'pendiente' || f.estado_factura?.toLowerCase() === 'pendiente'
        ).length;
        
        const vencidas = reporteData.filter(f => 
          f.estado?.toLowerCase() === 'vencida' || f.estado_factura?.toLowerCase() === 'vencida'
        ).length;
        
        const promedioFactura = reporteData.length > 0 
          ? (totalFacturado / reporteData.length).toFixed(2) 
          : '0.00';

        // 🚨 ESTADÍSTICAS DE MORA
        const facturasConMora = reporteData.filter(f => f.tiene_mora === true).length;
        const totalMora = reporteData.reduce((sum, f) => sum + (parseFloat(f.valor_mora) || 0), 0);
        const porcentajeConMora = reporteData.length > 0 
          ? ((facturasConMora / reporteData.length) * 100).toFixed(1) 
          : 0;
        const totalConMora = totalFacturado + totalMora;
        const promedioMesesAdeudo = facturasConMora > 0
          ? (reporteData.filter(f => f.tiene_mora).reduce((sum, f) => sum + (parseInt(f.meses_adeudo) || 0), 0) / facturasConMora).toFixed(1)
          : 0;

        stats.push(
          { 
            label: 'Total Facturado', 
            value: `$${totalFacturado.toFixed(2)}`, 
            icon: 'DollarSign', 
            color: 'text-green-600',
            subtitle: `Con mora: $${totalConMora.toFixed(2)}`
          },
          { 
            label: 'Promedio', 
            value: `$${promedioFactura}`, 
            icon: 'TrendingUp', 
            color: 'text-blue-600',
            subtitle: `${reporteData.length} facturas`
          },
          { 
            label: 'Pagadas', 
            value: pagadas, 
            icon: 'CheckCircle', 
            color: 'text-green-600',
            subtitle: `${((pagadas / reporteData.length) * 100).toFixed(1)}%`
          },
          { 
            label: 'Pendientes', 
            value: pendientes, 
            icon: 'Clock', 
            color: 'text-orange-600',
            subtitle: `${((pendientes / reporteData.length) * 100).toFixed(1)}%`
          },
          { 
            label: 'Vencidas', 
            value: vencidas, 
            icon: 'AlertCircle', 
            color: 'text-red-600',
            subtitle: `${((vencidas / reporteData.length) * 100).toFixed(1)}%`
          },
          { 
            label: 'Con Mora', 
            value: `${facturasConMora} (${porcentajeConMora}%)`, 
            icon: 'AlertTriangle', 
            color: 'text-red-600',
            subtitle: `Promedio: ${promedioMesesAdeudo} meses`
          },
          { 
            label: 'Total Mora', 
            value: `$${totalMora.toFixed(2)}`, 
            icon: 'DollarSign', 
            color: 'text-red-700',
            subtitle: `${facturasConMora} facturas afectadas`
          }
        );
        break;

      case 'Pagos':
        // 💰 MONTOS Y PROMEDIOS
        const totalRecaudado = reporteData.reduce((sum, p) => sum + (parseFloat(p.monto_pagado) || 0), 0);
        const promedioPago = reporteData.length > 0 ? (totalRecaudado / reporteData.length).toFixed(2) : 0;
        const pagoMayor = Math.max(...reporteData.map(p => parseFloat(p.monto_pagado) || 0));
        
        // 💳 MÉTODOS DE PAGO
        const efectivo = reporteData.filter(p => p.metodo_pago?.toLowerCase().includes('efectivo')).length;
        const transferencia = reporteData.filter(p => p.metodo_pago?.toLowerCase().includes('transferencia')).length;
        
        // 🧾 COMPROBANTES
        const conComprobante = reporteData.filter(p => p.tiene_comprobante === true).length;
        const sinComprobante = reporteData.filter(p => p.tiene_comprobante === false).length;
        
        // ✅ PAGOS COMPLETOS
        const pagosParciales = reporteData.filter(p => p.pago_completo === false).length;
        
        // 💵 SALDOS
        const saldoPendiente = reporteData.reduce((sum, p) => sum + (parseFloat(p.saldo) || 0), 0);
        
        // 🎯 PORCENTAJES
        const porcentajeEfectivo = reporteData.length > 0 
          ? ((efectivo / reporteData.length) * 100).toFixed(1) 
          : 0;
        const porcentajeTransferencia = reporteData.length > 0 
          ? ((transferencia / reporteData.length) * 100).toFixed(1) 
          : 0;
        const porcentajeComprobantes = reporteData.length > 0 
          ? ((conComprobante / reporteData.length) * 100).toFixed(1) 
          : 0;

        // 🚨 ESTADÍSTICAS DE MORA EN PAGOS
        const pagosMora = reporteData.filter(p => p.tiene_mora === true).length;
        const totalMoraPagos = reporteData.reduce((sum, p) => sum + (parseFloat(p.valor_mora) || 0), 0);
        const porcentajePagosMora = reporteData.length > 0 
          ? ((pagosMora / reporteData.length) * 100).toFixed(1) 
          : 0;
        const totalFacturadoConMora = reporteData.reduce((sum, p) => sum + (parseFloat(p.total_con_mora) || 0), 0);
        const promedioMesesAdeudoPagos = pagosMora > 0
          ? (reporteData.filter(p => p.tiene_mora).reduce((sum, p) => sum + (parseInt(p.meses_adeudo) || 0), 0) / pagosMora).toFixed(1)
          : 0;

        stats.push(
          { 
            label: 'Total Recaudado', 
            value: `$${totalRecaudado.toFixed(2)}`, 
            icon: 'DollarSign', 
            color: 'text-green-600',
            subtitle: `${reporteData.length} pagos`
          },
          { 
            label: 'Promedio por Pago', 
            value: `$${promedioPago}`, 
            icon: 'TrendingUp', 
            color: 'text-blue-600',
            subtitle: `Mayor: $${pagoMayor.toFixed(2)}`
          },
          { 
            label: 'Efectivo', 
            value: `${efectivo} (${porcentajeEfectivo}%)`, 
            icon: 'Banknote', 
            color: 'text-purple-600',
            subtitle: `$${reporteData.filter(p => p.metodo_pago?.toLowerCase().includes('efectivo')).reduce((sum, p) => sum + parseFloat(p.monto_pagado || 0), 0).toFixed(2)}`
          },
          { 
            label: 'Transferencia', 
            value: `${transferencia} (${porcentajeTransferencia}%)`, 
            icon: 'ArrowRightLeft', 
            color: 'text-indigo-600',
            subtitle: `$${reporteData.filter(p => p.metodo_pago?.toLowerCase().includes('transferencia')).reduce((sum, p) => sum + parseFloat(p.monto_pagado || 0), 0).toFixed(2)}`
          },
          { 
            label: 'Con Comprobante', 
            value: `${conComprobante} (${porcentajeComprobantes}%)`, 
            icon: 'FileCheck', 
            color: 'text-emerald-600',
            subtitle: `Sin: ${sinComprobante}`
          },
          { 
            label: 'Saldo Pendiente', 
            value: `$${saldoPendiente.toFixed(2)}`, 
            icon: 'AlertCircle', 
            color: 'text-orange-600',
            subtitle: `${pagosParciales} parciales`
          },
          { 
            label: 'Pagos con Mora', 
            value: `${pagosMora} (${porcentajePagosMora}%)`, 
            icon: 'AlertTriangle', 
            color: 'text-red-600',
            subtitle: `Promedio: ${promedioMesesAdeudoPagos} meses`
          },
          { 
            label: 'Total Mora', 
            value: `$${totalMoraPagos.toFixed(2)}`, 
            icon: 'DollarSign', 
            color: 'text-red-700',
            subtitle: `Total con mora: $${totalFacturadoConMora.toFixed(2)}`
          }
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

      case 'MultasAfiliados': {
        const activas = reporteData.filter(m => m.activo === true).length;
        const pendientes = reporteData.filter(m => m.estado === 'pendiente').length;
        const pagadas = reporteData.filter(m => m.estado === 'pagada').length;
        const facturadas = reporteData.filter(m => m.facturado === true).length;
        
        const montoTotal = reporteData.reduce((sum, m) => sum + (parseFloat(m.monto) || 0), 0);
        const montoPendiente = reporteData
          .filter(m => m.estado === 'pendiente')
          .reduce((sum, m) => sum + (parseFloat(m.monto) || 0), 0);
        const montoPagado = reporteData
          .filter(m => m.estado === 'pagada')
          .reduce((sum, m) => sum + (parseFloat(m.monto) || 0), 0);
        const montoPromedio = reporteData.length > 0 ? (montoTotal / reporteData.length) : 0;

        stats.push(
          { label: 'Total Multas', value: reporteData.length, icon: 'AlertCircle', color: 'text-red-600' },
          { label: 'Multas Activas', value: activas, icon: 'CheckCircle', color: 'text-green-600' },
          { label: 'Pendientes', value: pendientes, icon: 'Clock', color: 'text-orange-600' },
          { label: 'Pagadas', value: pagadas, icon: 'DollarSign', color: 'text-green-600' },
          { label: 'Facturadas', value: facturadas, icon: 'FileText', color: 'text-blue-600' },
          { label: 'Monto Total', value: `$${montoTotal.toFixed(2)}`, icon: 'TrendingUp', color: 'text-purple-600' },
          { label: 'Monto Pendiente', value: `$${montoPendiente.toFixed(2)}`, icon: 'AlertTriangle', color: 'text-orange-600' },
          { label: 'Monto Pagado', value: `$${montoPagado.toFixed(2)}`, icon: 'CheckCircle', color: 'text-green-700' },
          { label: 'Monto Promedio', value: `$${montoPromedio.toFixed(2)}`, icon: 'TrendingUp', color: 'text-indigo-600' }
        );
        break;
      }

      case 'Caja': {
  const resumen   = cajaMensualData?.resumen;
  const facturacion = cajaMensualData?.facturacion;
  const meses     = cajaAnualData?.meses || [];

  // ── Vista MENSUAL (hay resumen de un mes específico) ─────────
  if (resumen) {
    const totalGeneral   = parseFloat(resumen.total_general  || 0);
    const totalAgua      = parseFloat(resumen.total_agua     || 0);
    const totalMultas    = parseFloat(resumen.total_multas   || 0);
    const totalMora      = parseFloat(resumen.total_mora     || 0);
    const cantidadPagos  = resumen.cantidad_pagos || 0;
    const promedioPago   = cantidadPagos > 0 ? (totalGeneral / cantidadPagos) : 0;

    stats.push(
      {
        label: 'Total Ingresado',
        value: `$${totalGeneral.toFixed(2)}`,
        icon: 'DollarSign',
        color: 'text-green-600',
        subtitle: `${cantidadPagos} pagos registrados`
      },
      {
        label: 'Cobros de Agua',
        value: `$${totalAgua.toFixed(2)}`,
        icon: 'Droplet',
        color: 'text-blue-600',
        subtitle: `${((totalAgua / (totalGeneral || 1)) * 100).toFixed(1)}% del total`
      },
      {
        label: 'Multas Cobradas',
        value: `$${totalMultas.toFixed(2)}`,
        icon: 'AlertCircle',
        color: 'text-red-600',
        subtitle: `${((totalMultas / (totalGeneral || 1)) * 100).toFixed(1)}% del total`
      },
      {
        label: 'Mora Cobrada',
        value: `$${totalMora.toFixed(2)}`,
        icon: 'Clock',
        color: 'text-orange-600',
        subtitle: `${((totalMora / (totalGeneral || 1)) * 100).toFixed(1)}% del total`
      },
      {
        label: 'N° de Pagos',
        value: cantidadPagos,
        icon: 'CreditCard',
        color: 'text-purple-600',
        subtitle: `Promedio $${promedioPago.toFixed(2)} / pago`
      }
    );

    if (facturacion) {
      const totalFacturado  = parseFloat(facturacion.total_facturado  || 0);
      const totalPendiente  = parseFloat(facturacion.total_pendiente  || 0);
      const porcentajeCobrado = parseFloat(facturacion.porcentaje_cobrado || 0);

      stats.push(
        {
          label: 'Total Facturado',
          value: `$${totalFacturado.toFixed(2)}`,
          icon: 'FileText',
          color: 'text-gray-700',
          subtitle: `Pendiente: $${totalPendiente.toFixed(2)}`
        },
        {
          label: '% Cobrado',
          value: `${porcentajeCobrado.toFixed(1)}%`,
          icon: 'TrendingUp',
          color: porcentajeCobrado >= 80 ? 'text-green-600' : porcentajeCobrado >= 50 ? 'text-orange-500' : 'text-red-600',
          subtitle: porcentajeCobrado >= 80 ? '✅ Buena recaudación' : '⚠️ Recaudación baja'
        }
      );
    }

  // ── Vista ANUAL (solo hay datos de meses) ───────────────────
  } else if (meses.length > 0) {
    const totalAnualAgua   = meses.reduce((s, m) => s + (parseFloat(m.total_agua)   || 0), 0);
    const totalAnualMultas = meses.reduce((s, m) => s + (parseFloat(m.total_multas) || 0), 0);
    const totalAnualMora   = meses.reduce((s, m) => s + (parseFloat(m.total_mora)   || 0), 0);
    const totalAnual       = totalAnualAgua + totalAnualMultas + totalAnualMora;
    const totalPagos       = meses.reduce((s, m) => s + (parseInt(m.cantidad_pagos) || 0), 0);
    const mesConMasIngresos = meses.reduce(
      (max, m) => (parseFloat(m.total_general || 0) > parseFloat(max.total_general || 0) ? m : max),
      meses[0] || {}
    );
    const nombreMeses = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
                              'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    stats.push(
      {
        label: 'Total Anual',
        value: `$${totalAnual.toFixed(2)}`,
        icon: 'DollarSign',
        color: 'text-green-600',
        subtitle: `${totalPagos} pagos en el año`
      },
      {
        label: 'Total Agua (año)',
        value: `$${totalAnualAgua.toFixed(2)}`,
        icon: 'Droplet',
        color: 'text-blue-600',
        subtitle: `${((totalAnualAgua / (totalAnual || 1)) * 100).toFixed(1)}% del total`
      },
      {
        label: 'Total Multas (año)',
        value: `$${totalAnualMultas.toFixed(2)}`,
        icon: 'AlertCircle',
        color: 'text-red-600',
        subtitle: `${((totalAnualMultas / (totalAnual || 1)) * 100).toFixed(1)}% del total`
      },
      {
        label: 'Total Mora (año)',
        value: `$${totalAnualMora.toFixed(2)}`,
        icon: 'Clock',
        color: 'text-orange-600',
        subtitle: `${((totalAnualMora / (totalAnual || 1)) * 100).toFixed(1)}% del total`
      },
      {
        label: 'Mejor Mes',
        value: nombreMeses[mesConMasIngresos.mes] || '—',
        icon: 'TrendingUp',
        color: 'text-teal-600',
        subtitle: `$${parseFloat(mesConMasIngresos.total_general || 0).toFixed(2)}`
      },
      {
        label: 'Meses con datos',
        value: meses.filter(m => parseFloat(m.total_general || 0) > 0).length,
        icon: 'Calendar',
        color: 'text-indigo-600',
        subtitle: `de ${meses.length} meses`
      }
    );

  // ── Fallback — datos planos del reporteData ─────────────────
  } else {
    const totalAgua   = reporteData.reduce((s, r) => s + (parseFloat(r.total_agua)   || 0), 0);
    const totalMultas = reporteData.reduce((s, r) => s + (parseFloat(r.total_multas) || 0), 0);
    const totalMora   = reporteData.reduce((s, r) => s + (parseFloat(r.total_mora)   || 0), 0);
    stats.push(
      { label: 'Total Agua',   value: `$${totalAgua.toFixed(2)}`,   icon: 'Droplet',      color: 'text-blue-600'   },
      { label: 'Total Multas', value: `$${totalMultas.toFixed(2)}`, icon: 'AlertCircle',  color: 'text-red-600'    },
      { label: 'Total Mora',   value: `$${totalMora.toFixed(2)}`,   icon: 'Clock',        color: 'text-orange-600' }
    );
  }
  break;
}



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
  }, [reporteData, selectedModulo, cajaMensualData, cajaAnualData]);

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

  // cargar periodos disponibles cuando se selecciona un módulo que los requiere
  useEffect(() => {
    const cargarPeriodos = async () => {
      if (!['Lecturas', 'Facturas', 'Pagos', 'MultasAfiliados'].includes(selectedModulo)) {
        setPeriodos([]);
        setPeriodoSeleccionado('');
        return;
      }

      let result;
      switch (selectedModulo) {
        case 'Lecturas':
          result = await reportsServices.getPeriodosLecturas();
          break;
        case 'Facturas':
          result = await reportsServices.getPeriodosFacturas();
          break;
        case 'Pagos':
          result = await reportsServices.getPeriodosPagos();
          break;
        case 'MultasAfiliados':
          result = await reportsServices.getPeriodosMultasAfiliados();
          break;
        
        default:
          return;
      }
      if (result.success && result.data.length > 0) {
        setPeriodos(result.data);

        const fechaActual = new Date();
        const mesActual = fechaActual.getMonth() + 1;
        const anioActual = fechaActual.getFullYear();

        // ── Filtrar solo periodos válidos (no futuros) ──
        const periodosValidos = result.data.filter(p => {
          const esFuturo =
            p.anio > anioActual ||
            (p.anio === anioActual && p.mes > mesActual);
          return !esFuturo;
        });

        // ── Buscar el periodo actual exacto ──
        const periodoActual = periodosValidos.find(
          p => p.mes === mesActual && p.anio === anioActual
        );

        let periodoValue;
        if (periodoActual) {
          // Hay datos del mes actual → seleccionarlo
          periodoValue = `${periodoActual.mes}-${periodoActual.anio}`;
        } else if (periodosValidos.length > 0) {
          // No hay datos del mes actual → el más reciente válido
          const masReciente = periodosValidos[0];
          periodoValue = `${masReciente.mes}-${masReciente.anio}`;
        } else {
          // No hay periodos válidos
          periodoValue = '';
        }

        setPeriodoSeleccionado(periodoValue);
      } else {
        setPeriodos([]);
        setPeriodoSeleccionado('');
      }
    };

    if (['Lecturas', 'Facturas', 'Pagos', 'MultasAfiliados'].includes(selectedModulo)) {
      cargarPeriodos();
    } else {
      setPeriodos([]);
      setPeriodoSeleccionado('');
    }
  }, [selectedModulo]);



  // Cargar sectores cuando se selecciona Medidores
  useEffect(() => {
    const cargarSectores = async () => {
      if (selectedModulo !== 'Medidores' && selectedModulo !== 'Afiliados' && selectedModulo !== 'Lecturas') {
        setSectoresDisponibles([]);
        return;
      }
      
      try {
        const result = await reportsServices.getReporteSectores({ skip: 0, limit: 100 });
        if (result.success && result.data) {
          setSectoresDisponibles(result.data);
        }
      } catch (error) {
        console.error('Error cargando sectores:', error);
      }
    };
    
    cargarSectores();
  }, [selectedModulo]);

  // ============================================================
  // CARGAR AÑOS DISPONIBLES DE CAJA AL SELECCIONAR EL MÓDULO
  // ============================================================
  useEffect(() => {
    if (selectedModulo !== 'Caja') {
      setCajaAniosDisponibles([]);
      return;
    }
    const cargarAniosCaja = async () => {
      const result = await reportsServices.getCajaAniosDisponibles();
      if (result.success && result.data.length > 0) {
        setCajaAniosDisponibles(result.data);
        // ← NUEVO: guardar meses disponibles desde el primer request
        setCajaMesesDisponibles(result.mesesPorAnio || {});
        if (!cajaAnioFiltro) {
          setCajaAnioFiltro(result.data[0]); // año más reciente
          // cajaMesFiltro queda null → vista anual por defecto
        }
      }
    };
    cargarAniosCaja();
  }, [selectedModulo, cajaAnioFiltro]);

  useEffect(() => {
  if (!['Lecturas', 'Facturas', 'Pagos'].includes(selectedModulo)) {
    setMedidoresDisponibles([]);
    setFilterMedidor('todos');
    return;
  }
  if (reporteData.length === 0) return;

  const unicos = [...new Set(
    reporteData
      .map(r => r.num_medidor)
      .filter(Boolean)
  )].sort();

  setMedidoresDisponibles(unicos);
  setFilterMedidor('todos'); // reset al recargar datos
}, [reporteData, selectedModulo]);


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
        estado: filterEstado !== 'todos' ? filterEstado : undefined,
        skip: 0,
        limit: 1000
      };
      // Agregar mes y año si hay periodo seleccionado
      if (periodoSeleccionado && ['Lecturas', 'Facturas', 'Pagos', 'MultasAfiliados'].includes(selectedModulo)) {
        const [mes, anio] = periodoSeleccionado.split('-');
        filtros.mes = parseInt(mes);
        filtros.anio = parseInt(anio);
      }

   
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
          result = await reportsServices.getReporteAfiliados({
            ...filtros,
            activo: filterEstado === 'activos' ? true : (filterEstado === 'inactivos' ? false : undefined),
            sector: filterSector !== 'todos' ? filterSector : undefined
          });
          break;

        case 'Medidores':
          result = await reportsServices.getReporteMedidores({
            ...filtros,
            activo: filterEstado === 'activos' ? true : (filterEstado === 'inactivos' ? false : undefined),
            sector: filterSector !== 'todos' ? filterSector : undefined
          });
          break;

        case 'Sectores':
          result = await reportsServices.getReporteSectores({
            ...filtros,
            activo: filtros.estado === 'activos' ? true : (filtros.estado === 'inactivos' ? false : undefined)
          });
          break;

        case 'Lecturas':
        result = await reportsServices.getReporteLecturas({
          ...filtros,
          es_estimada: filterTipoLectura === 'estimadas' ? true : (filterTipoLectura === 'reales' ? false : undefined),
          sector: filterSector !== 'todos' ? filterSector : undefined
        });
        break;

        case 'Facturas':
          result = await reportsServices.getReporteFacturas({
            ...filtros,
            estado: filterEstado !== 'todos' ? filterEstado : undefined
          });
        break;
        case 'Pagos':
                result = await reportsServices.getReportePagos({
                  ...filtros,
                  estado_pago: filterEstado !== 'todos' ? filterEstado : undefined,
                  pago_completo: filterPagoCompleto === 'completos' ? true : (filterPagoCompleto === 'parciales' ? false : undefined)
                });
                break;

        case 'Multas':
          result = await reportsServices.getReporteMultas({
            ...filtros,
            activo: filtros.estado === 'activos' ? true : (filtros.estado === 'inactivos' ? false : undefined)
          });
          break;
        case 'Tarifas':
          result = await reportsServices.getReporteTarifas({
            ...filtros,
            activo: filtros.estado === 'activos' ? true : (filtros.estado === 'inactivos' ? false : undefined)
          });
          break;

        case 'Roles':
          result = await reportsServices.getReporteRoles({
            ...filtros,
            activo: filtros.estado === 'activos' ? true : (filtros.estado === 'inactivos' ? false : undefined)
          });
          break;

        case 'Servicios':
          result = await reportsServices.getReporteServicios({
            ...filtros,
            activo: filtros.estado === 'activos' ? true : (filtros.estado === 'inactivos' ? false : undefined)
          });
          break;

        case 'MultasAfiliados':
          result = await reportsServices.getReporteMultasAfiliados({
            ...filtros,  
            estado: filterEstado !== 'todos' ? filterEstado : undefined,
            activo: filterActivoMultas === 'activos' ? true : (filterActivoMultas === 'inactivos' ? false : undefined)
          });
          break;

        case 'Caja': {
          const hoy = new Date();
          const anioActual = cajaAnioFiltro || hoy.getFullYear();
          const mesActual  = cajaMesFiltro ?? null; // null = vista anual

          const [anualRes, mensualRes, diarioRes] = await Promise.all([
            reportsServices.getCajaAnual({ anio: anioActual }),
            mesActual !== null
              ? reportsServices.getCajaMensual({ mes: mesActual, anio: anioActual })
              : Promise.resolve({ success: false, data: null }),
            mesActual !== null
              ? reportsServices.getCajaDetalleDiario({ mes: mesActual, anio: anioActual })
              : Promise.resolve({ success: false, data: null }),
          ]);

          // Siempre cargar anual
          if (anualRes.success) {
            setCajaAnualData(anualRes.data);
            // Actualizar meses que tienen datos reales
            const mesesConDatos = (anualRes.data?.meses || [])
              .filter(m => m.total_general > 0)
              .map(m => m.mes);
            setCajaMesesDisponibles(prev => ({
              ...prev,
              [anioActual]: mesesConDatos
            }));
          }

          // Mensual y diario: solo si hay mes seleccionado
          if (mensualRes.success && mensualRes.data) {
            setCajaMensualData(mensualRes.data);
          } else {
            setCajaMensualData(null);
          }

          const detalleDiario = diarioRes?.success ? (diarioRes.data?.detalle || []) : [];
          setCajaDetalleDiario(detalleDiario);

          // ─── DECIDIR QUÉ MUESTRA LA TABLA ───────────────────────────────
          // Vista mensual → detalle diario formateado para la tabla
          // Vista anual   → meses del año
          if (mesActual !== null && detalleDiario.length > 0) {
            // Formatear detalle diario para que la tabla lo entienda
            const detalleFormateado = detalleDiario.map(d => ({
              dia:             d.dia,
              total_agua:      d.total_agua,
              total_multas:    d.total_multas,
              total_general:   d.total_general,
              cantidad_pagos:  d.cantidad_pagos,
              cantidad_multas: d.cantidad_multas,
              // Métodos de pago como columnas separadas
              ...(d.metodos
                ? Object.fromEntries(
                    Object.entries(d.metodos).map(([k, v]) => [`metodo_${k}`, v])
                  )
                : {}),
            }));
            result = {
              success: true,
              data:  detalleFormateado,
              total: detalleFormateado.length,
            };
          } else {
            // Vista anual: solo meses con movimiento
            const mesesConMovimiento = (anualRes.data?.meses || [])
              .filter(m => m.total_general > 0)
              .map(m => ({
                mes:                m.mes,
                nombre_mes:         m.nombre_mes,
                total_agua:         m.total_agua,
                total_multas:       m.total_multas,
                total_mora:         m.total_mora,
                total_general:      m.total_general,
                cantidad_pagos:     m.cantidad_pagos,
                cantidad_multas:    m.cantidad_multas,
                total_facturado:    m.total_facturado,
                porcentaje_cobrado: m.porcentaje_cobrado,
              }));
            result = {
              success: true,
              data:  mesesConMovimiento,
              total: mesesConMovimiento.length,
            };
          }
          break;
        }

        default:
          // Fallback genérico
          result = await reportsServices.getReporteByModulo(selectedModulo, filtros);
      }
      if (result.success) {
            setReporteData(result.data);
            setEsReporteIndividual(false);  
            setStats({
              total_registros: result.total || result.data.length,
              periodo: periodoSeleccionado
                ? ` ${periodoSeleccionado.replace('-', '/')}`
                : 'Todos los periodos',
              modulo: modulosSistema.find(m => m.value === selectedModulo)?.label || selectedModulo,
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
  }, [selectedModulo, filterEstado, searchTerm, modulosSistema, periodoSeleccionado, filterSector, filterPagoCompleto, filterTipoLectura, filterActivoMultas, cajaMesFiltro, cajaAnioFiltro]);

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
  // GENERAR REPORTE CUANDO CAMBIA EL PERIODO SELECCIONADO
  // ============================================================

 // cargar reporte automáticamente al cambiar filtros o periodo, pero solo para módulos que requieren periodo
  useEffect(() => {
    if (!selectedModulo || !permissions.canRead) return;

    const esModuloConPeriodo = ['Lecturas', 'Facturas', 'Pagos', 'MultasAfiliados'].includes(selectedModulo);
    
    if (esModuloConPeriodo) {
      // Solo disparar cuando hay un periodo seleccionado válido
      if (!periodoSeleccionado) return;
      generarReporte();
      return;
    }

    // Módulos sin periodo ni caja — debounce para búsqueda/filtros
    if (selectedModulo === 'Caja') return;

    const timer = setTimeout(() => {
      generarReporte();
    }, 500);

    return () => clearTimeout(timer);
  }, [
    searchTerm,
    filterEstado,
    filterSector,
    filterTipoLectura,
    filterPagoCompleto,
    periodoSeleccionado,   // ← agregado aquí
    generarReporte,
    permissions.canRead,
    selectedModulo,
  ]);

  // Generar reporte de Caja cuando cambian los filtros de año/mes
  useEffect(() => {
    if (selectedModulo !== 'Caja') return;
    if (!permissions.canRead) return;
    if (!cajaAnioFiltro) return;   // esperar hasta tener año

    generarReporte();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cajaAnioFiltro, cajaMesFiltro, selectedModulo, permissions.canRead]);

  // Cargar periodos del afiliado seleccionado cuando se avanza al paso 2
  useEffect(() => {
    if (!afiliadoSeleccionado || pasoModal !== 2) return;

    const cargar = async () => {
      let result;
      switch (selectedModulo) {
        case 'Lecturas':
          result = await reportsServices.getPeriodosLecturas();
          break;
        case 'Facturas':
          result = await reportsServices.getPeriodosFacturas();
          break;
        case 'Pagos':
          result = await reportsServices.getPeriodosPagos();
          break;
        case 'MultasAfiliados':
          result = await reportsServices.getPeriodosMultasAfiliados();
          break;
        default:
          return;
      }
      if (result.success) {
        setPeriodosIndividuales(prev => ({
          ...prev,
          [selectedModulo]: result.data

        }));
      }
    };

    cargar();
  }, [afiliadoSeleccionado, pasoModal, selectedModulo]);

  // ============================================================
  // FUNCIONES DE EXPORTACIÓN - CONECTADAS AL BACKEND
  // ============================================================
  // Columnas activas para exportación
  const columnasActivas = useMemo(() => {
    return Object.keys(columnasVisibles).filter(col => columnasVisibles[col]);
  }, [columnasVisibles]);

  // Opciones de ordenamiento por módulo
  const sortOptions = {
    Usuarios: [                                                     
      { value: 'nombres',         label: 'Nombres' },
      { value: 'apellidos',       label: 'Apellidos' },
      { value: 'usuario',         label: 'Usuario' },
      { value: 'direccion',       label: 'Dirección' },
      { value: 'sexo',            label: 'Sexo' },
      { value: 'rol',             label: 'Rol' },
      { value: 'fecharegistro',   label: 'Fecha de Registro' },
    ],   
    Afiliados: [
      { value: 'apellidos',        label: 'Apellido' },
      { value: 'nombres',          label: 'Nombre' },
      { value: 'cedula',           label: 'Cédula' },
      { value: 'sector',           label: 'Sector' },
      { value: 'fecha_afiliacion', label: 'Fecha Afiliación' },
      { value: 'cod_usuario_afi',  label: 'Código' },
      { value: 'total_medidores',  label: 'N° Medidores' },
    ],
    Medidores: [
      { value: 'num_medidor', label: 'N° Medidor' },
      { value: 'sector',      label: 'Sector' },
      { value: 'afiliado',    label: 'Afiliado' },
      { value: 'activo',      label: 'Estado' },
    ],
  };

  // Función de ordenamiento genérica
  const sortedData = useMemo(() => {
    // Primero filtrar por medidor
    let datos = reporteData;
    if (filterMedidor !== 'todos' && ['Lecturas', 'Facturas', 'Pagos'].includes(selectedModulo)) {
      datos = datos.filter(r => String(r.num_medidor) === String(filterMedidor));
    }

    if (!sortBy || !datos.length) return datos;
    return [...datos].sort((a, b) => {
      let aVal = a[sortBy] ?? '';
      let bVal = b[sortBy] ?? '';
      if (sortBy.includes('fecha')) {
        aVal = aVal ? new Date(aVal) : new Date(0);
        bVal = bVal ? new Date(bVal) : new Date(0);
      } else if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal ?? '').toString().toLowerCase();
      }
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [reporteData, sortBy, sortOrder, filterMedidor, selectedModulo]);


  // Exportar a Excel con columnas seleccionadas
  const exportarExcel = useCallback(() => {
    if (sortedData.length === 0) {           
      alert('No hay datos para exportar');
      return;
    }
    const datosFiltrados = sortedData.map(row => {  
      const rowFiltrada = {};
      columnasActivas.forEach(col => { rowFiltrada[col] = row[col]; });
      return rowFiltrada;
    });
    const moduloInfo = modulosSistema.find(m => m.value === selectedModulo);
    ReportExport.exportarExcel(datosFiltrados, moduloInfo?.label || selectedModulo, moduloInfo?.description || '');
  }, [sortedData, selectedModulo, modulosSistema, columnasActivas]); 

  // Exportar a PDF con columnas seleccionadas
  const exportarPDF = useCallback(() => {
    if (sortedData.length === 0) {            
      alert('No hay datos para exportar');
      return;
    }
    const datosFiltrados = sortedData.map(row => {   
      const rowFiltrada = {};
      columnasActivas.forEach(col => { rowFiltrada[col] = row[col]; });
      return rowFiltrada;
    });
    const moduloInfo = modulosSistema.find(m => m.value === selectedModulo);
    ReportExport.exportarPDF(datosFiltrados, moduloInfo?.label || selectedModulo, moduloInfo?.description || '');
  }, [sortedData, selectedModulo, modulosSistema, columnasActivas]);  

  // Imprimir reporte con columnas seleccionadas
  const imprimirReporte = useCallback(() => {
    if (sortedData.length === 0) {           
      alert('No hay datos para imprimir');
      return;
    }
    const datosFiltrados = sortedData.map(row => {  
      const rowFiltrada = {};
      columnasActivas.forEach(col => { rowFiltrada[col] = row[col]; });
      return rowFiltrada;
    });
    const moduloInfo = modulosSistema.find(m => m.value === selectedModulo);
    ReportExport.imprimirReporte(datosFiltrados, moduloInfo?.label || selectedModulo, moduloInfo?.description || '');
  }, [sortedData, selectedModulo, modulosSistema, columnasActivas]);  

  // ============================================================
  // FUNCIONES DE LIMPIEZA DE FILTROS
  // ============================================================
  
  // Limpiar filtros sin cambiar módulo (para módulos sin periodo o sector)
  const limpiarFiltrosSinModulo = useCallback(() => {
    setFilterEstado('todos');
    setSearchTerm('');
    setPeriodoSeleccionado('');
    setFilterSector('todos');
    setFilterTipoLectura('todos');
    setFilterPagoCompleto('todos');
    setError(null);
    setSortBy('');
    setSortOrder('asc');
    setAniosExpandidos({});
    setFilterMedidor('todos');
    
  }, []);

  // Helper: colapsar/expandir año en el historial
  const toggleAnio = (anio) => {
    setAniosExpandidos(prev => ({
      ...prev,
      [anio]: prev[anio] === false ? true : false
    }))
  }

  // Limpiar filtros y módulo seleccionado
  const limpiarFiltros = useCallback(() => {
    setSelectedModulo('');
    setReporteData([]);
    setEsReporteIndividual(false);
    setFilterEstado('todos');
    setSearchTerm('');
    setError(null);
  }, []);


  // ============================================================
  // FUNCIONES AUXILIARES
  // ============================================================

  const handleModuloSelect = (moduloValue) => {
    setSelectedModulo(moduloValue);
    setReporteData([]);
    setEsReporteIndividual(false);
    setError(null);
    // limpiar estados de caja
    setCajaMensualData(null);
    setCajaAnualData(null);
    setCajaDetalleDiario([]);
    setCajaMesesDisponibles({});
    setCajaVistaActiva('mensual');
    setCajaAnioFiltro(null);   
    setCajaMesFiltro(null);    
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
  // FUNCIONES DE FORMATEO DE COLUMNAS
  // ============================================================

  // Formatear nombre de columna
  const formatColumnName = (key) => {
    const specialNames = {
      'num_medidor': 'N° Medidor',
      'cod_usuario_afi': 'Código',
      'consumo_m3': 'Consumo (m³)',
      'fecha_emision': 'F. Emisión',
      'fecha_lectura': 'F. Lectura',
      'num_factura': 'N° Factura',
      'metodo_pago': 'Método',
      'estado_factura': 'Estado',
      'tipo_lectura': 'Tipo'
    };
    
    return specialNames[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Obtener clase CSS según tipo de columna
  const getColumnClass = (key, value) => {
    // Columnas de código
    if (key.includes('cod_') || key.includes('num_')) {
      return 'col-code';
    }
    
    // Columnas de fecha
    if (key.includes('fecha')) {
      return 'col-date';
    }
    
    // Columnas de estado
    if (key === 'estado' || key === 'estado_factura' || key === 'activo') {
      return 'col-status';
    }
    
    // Columnas numéricas (consumo, monto, total, etc.)
    if (
      key.includes('consumo') || 
      key.includes('total') || 
      key.includes('monto') || 
      key.includes('valor') ||
      key.includes('precio') ||
      key.includes('exceso')
    ) {
      return 'col-numeric';
    }
    
    // Columnas booleanas
    if (typeof value === 'boolean') {
      return 'col-boolean';
    }
    
    // Columnas de texto por defecto
    return 'col-text';
  };

  // Formatear valor de celda
  const formatCellValue = (key, value) => {
    // Valores nulos
    if (value === null || value === undefined || value === '') {
      return <span className="value-empty">N/A</span>;
    }
    
    // Valores booleanos
    if (typeof value === 'boolean') {
      return value ? (
        <CheckCircle className="w-4 h-4 text-green-600" />
      ) : (
        <XCircle className="w-4 h-4 text-red-600" />
      );
    }
    
    // Estado de factura/lectura
    if (key === 'estado' || key === 'estado_factura') {
      const estadoLower = value?.toLowerCase();
      return (
        <span className={`status-badge status-${estadoLower}`}>
          {value}
        </span>
      );
    }
    
    // Activo/Inactivo
    if (key === 'activo') {
      const isActive = value === true || value === 'Sí' || value === 'S';
      return (
        <span className={`status-badge ${isActive ? 'status-active' : 'status-inactive'}`}>
          {isActive ? 'Activo' : 'Inactivo'}
        </span>
      );
    }
    
    // Valores monetarios
    if (
      key.includes('total') || 
      key.includes('monto') || 
      key.includes('valor') ||
      key.includes('precio') ||
      key.includes('descuento') ||
      key.includes('impuesto') 

    ) {
      const num = parseFloat(value);
      return isNaN(num) ? value : `$${num.toFixed(2)}`;
    }
    
    // Valores de consumo
    if (key.includes('consumo') && key.includes('m3')) {
      const num = parseFloat(value);
      return isNaN(num) ? value : `${num.toFixed(2)} m³`;
    }
    
  
    
    // Valor por defecto
    return <span className="value-text">{value.toString()}</span>;
  };

  // Formatear tooltip
  const formatTooltip = (key, value) => {
    if (value === null || value === undefined || value === '') {
      return 'Sin datos';
    }
    
    const columnName = formatColumnName(key);
    return `${columnName}: ${value.toString()}`;
  };

  // Abrir modal de reporte individual (para Afiliados)
  const abrirModalIndividual = async () => {
    const modulosIndividuales = ['Lecturas', 'Facturas', 'Pagos', 'MultasAfiliados'];
    if (!modulosIndividuales.includes(selectedModulo)) return;

    setModalIndividual(true);
    setPasoModal(1);
    setAfiliadoSeleccionado(null);
    setSearchAfiliado('');
    setLoadingReporteIndividual(false);

    const result = await reportsServices.getReporteAfiliados({ limit: 1000 });
    if (result.success) setAfiliadosModal(result.data);
  };

  const generarReporteIndividual = async () => {
    if (!afiliadoSeleccionado) return;
    setLoadingReporteIndividual(true);

    let filtrosPeriodo = { limit: 1000 };

    if (modoSeleccion === 'mes' && periodoIndividualSeleccionado) {
      const [mes, anio] = periodoIndividualSeleccionado.split('-').map(Number);
      filtrosPeriodo.mes  = mes;
      filtrosPeriodo.anio = anio;
    } else if (modoSeleccion === 'rango' && rangoDesdeInd && rangoHastaInd) {
      const [mesdesde, aniodesde] = rangoDesdeInd.split('-').map(Number);
      const [meshasta, aniohasta] = rangoHastaInd.split('-').map(Number);
      filtrosPeriodo.mesdesde  = mesdesde;
      filtrosPeriodo.aniodesde = aniodesde;
      filtrosPeriodo.meshasta  = meshasta;
      filtrosPeriodo.aniohasta = aniohasta;
    } else if (modoSeleccion === 'anio' && anioSeleccionado) {
      filtrosPeriodo.anio = anioSeleccionado;
    } else {
      setError('Selecciona un período válido');
      setLoadingReporteIndividual(false);
      return;
    }

    const codusuarioafi = afiliadoSeleccionado.cod_usuario_afi;

    if (!codusuarioafi) {
      setError('No se pudo obtener el código del afiliado');
      setLoadingReporteIndividual(false);
      return;
    }

    try {
      let result = { success: false, data: [], total: 0 };

      if (selectedModulo === 'Lecturas') {
        result = await reportsServices.getReporteIndividualLecturas(codusuarioafi, filtrosPeriodo);
      } else if (selectedModulo === 'Facturas') {
        result = await reportsServices.getReporteIndividualFacturas(codusuarioafi, filtrosPeriodo);
      } else if (selectedModulo === 'Pagos') {
        result = await reportsServices.getReporteIndividualPagos(codusuarioafi, filtrosPeriodo);
      } else if (selectedModulo === 'MultasAfiliados') {
        result = await reportsServices.getReporteIndividualMultasAfiliados(codusuarioafi, filtrosPeriodo);
      }

      console.log('📊 Resultado individual:', result);
      console.log('📊 Total:', result?.total);
      console.log('📊 Data[0]:', result?.data?.[0]);

      if (result.success) {
        setReporteData(result.data);
        setEsReporteIndividual(true); 
        setStats({
          totalregistros: result.total ?? result.data.length,
          periodo: `${afiliadoSeleccionado.nombres} ${afiliadoSeleccionado.apellidos}`,
          modulo: `Reporte Individual · ${selectedModulo}`,
        });
        setModalIndividual(false);
      } else {
        setError(result.message || 'Error al generar el reporte individual');
      }
    } catch (err) {
      console.error('Error generando reporte individual:', err);
      setError('Error inesperado al generar el reporte individual');
    } finally {
      setLoadingReporteIndividual(false);
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
              <div>
                <h2>Reportes y Estadística</h2>
                <p className="section-subtitle">
                  Visualiza reportes y estadisticas de los diferentes modulos del sistema
                </p>
              </div>
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
                  {/* Botón Excel */}
                  <button
                    onClick={exportarExcel}
                    className="btn-secondary btn-export"
                    title={`Exportar ${sortedData.length} registros a Excel`}
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span className="btn-export-label">Excel</span>
                  </button>

                  {/* Botón PDF */}
                  <button
                    onClick={exportarPDF}
                    className="btn-secondary btn-export btn-export-pdf"
                    title={`Exportar ${sortedData.length} registros a PDF`}
                  >
                    <FileDown className="w-4 h-4" />
                    <span className="btn-export-label">PDF</span>
                  </button>

                  {/* Botón Imprimir */}
                  <button
                    onClick={imprimirReporte}
                    className="btn-secondary btn-export"
                    title="Imprimir reporte"
                  >
                    <Printer className="w-4 h-4" />
                    <span className="btn-export-label">Imprimir</span>
                  </button>
                </>
              )}

              {/* Botón reporte individual: SOLO para módulos con período */}
              {['Lecturas', 'Facturas', 'Pagos', 'MultasAfiliados'].includes(selectedModulo) && (
                <button onClick={abrirModalIndividual} className="btn-primary" disabled={loading}>
                  <User className="w-4 h-4" />
                  <span className="ml-2">Reporte individual</span>
                </button>
              )}
            </div>

          </div>

          {/* MENSAJE DE ERROR */}
          {error && (
            <div className="alert alert-error mb-4">
              <AlertCircle className="w-5 h-5 mr-2" />
              {error}
            </div>
          )}

          {/* ─── HISTORIAL DE PERÍODOS (DESPLEGABLE) ──────────────────────── */}
          {['Lecturas', 'Facturas', 'Pagos', 'MultasAfiliados'].includes(selectedModulo) && periodos.length > 0 && (
            <div className="periodo-historial-container">

              {/* ENCABEZADO */}
              <button
                className="periodo-historial-header periodo-historial-toggle"
                onClick={() => setHistorialExpandido(prev => !prev)}
              >
                <div>
                  <h3 className="font-semibold text-[16px] leading-[1.2] flex items-center">
                    <Clock className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0" />
                    Historial de Períodos
                    <span className="historial-anio-badge ml-2">
                      {periodos.filter(p => {
                        const hoy = new Date();
                        // Filtrar futuros y el año actual no mayor al mes actual
                        const esFuturo =
                          p.anio > hoy.getFullYear() ||
                          (p.anio === hoy.getFullYear() && p.mes > hoy.getMonth() + 1);
                        return !esFuturo;
                      }).length} periodos disponibles
                    </span>
                  </h3>
                  <p className="periodo-historial-subtitle text-[14px]">
                    Selecciona el período que deseas visualizar
                  </p>
                </div>
                <ChevronDown
                  className={`w-5 h-5 historial-chevron text-blue-500 ${historialExpandido ? 'open' : ''}`}
                />
              </button>

              {/* CONTENIDO */}
              {historialExpandido && (() => {
                const hoy = new Date();
                const mesActual = hoy.getMonth() + 1;
                const anioActual = hoy.getFullYear();

                // ── 1. Filtrar solo periodos pasados + actual (descartar futuros/erróneos) ──
                const periodosValidos = periodos.filter(p => {
                  const esFuturo =
                    p.anio > anioActual ||
                    (p.anio === anioActual && p.mes > mesActual);
                  return !esFuturo;
                });

                if (periodosValidos.length === 0) {
                  return (
                    <div className="periodo-historial-empty">
                      <AlertCircle className="w-12 h-12 text-gray-300 mb-2" />
                      <p>No hay períodos disponibles</p>
                    </div>
                  );
                }

                // ── 2. Agrupar por año — solo los meses que vienen del backend ──
                const agrupado = periodosValidos.reduce((acc, p) => {
                  if (!acc[p.anio]) acc[p.anio] = [];
                  acc[p.anio].push(p.mes); // guardar solo el número de mes
                  return acc;
                }, {});

                const aniosOrdenados = Object.keys(agrupado)
                  .map(Number)
                  .sort((a, b) => b - a); // más reciente primero

                const nombresMeses = {
                  1: 'Ene', 2: 'Feb', 3: 'Mar', 4: 'Abr', 5: 'May', 6: 'Jun',
                  7: 'Jul', 8: 'Ago', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dic'
                };
                const nombresMesesCompletos = {
                  1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril', 5: 'Mayo',
                  6: 'Junio', 7: 'Julio', 8: 'Agosto', 9: 'Septiembre',
                  10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre'
                };

                return (
                  <div className="historial-anios-lista">
                    {aniosOrdenados.map(anio => {
                      const mesesDelAnio = agrupado[anio].sort((a, b) => b - a); // desc
                      const estaExpandido = aniosExpandidos[anio] !== false;

                      return (
                        <div key={anio} className="historial-anio-bloque">

                          {/* CABECERA DEL AÑO */}
                          <button
                            className="historial-anio-header"
                            onClick={() => toggleAnio(anio)}
                          >
                            <span className="historial-anio-label">
                              <Calendar className="w-4 h-4" />
                              {anio}
                              <span className="historial-anio-badge">
                                {mesesDelAnio.length} {mesesDelAnio.length === 1 ? 'periodo' : 'periodos'}
                              </span>
                            </span>
                            <ChevronDown
                              className={`w-4 h-4 historial-chevron ${estaExpandido ? 'open' : ''}`}
                            />
                          </button>

                          {/* CHIPS — solo los meses que existen en el backend */}
                          {estaExpandido && (
                            <div className="historial-meses-grid">
                              {mesesDelAnio.map(mes => {
                                const valorChip = `${mes}-${anio}`;
                                const esSeleccionado = periodoSeleccionado === valorChip;
                                const esActual = mes === mesActual && anio === anioActual;

                                return (
                                  <button
                                    key={valorChip}
                                    className={`historial-mes-chip ${esSeleccionado ? 'seleccionado' : 'incompleto'}`}
                                    onClick={() => setPeriodoSeleccionado(valorChip)}
                                    title={`${nombresMesesCompletos[mes]} ${anio}${esActual ? ' (mes actual)' : ''}`}
                                  >
                                    <span
                                      className={`historial-mes-dot ${esSeleccionado ? 'completo' : esActual ? 'completo' : 'incompleto'}`}
                                    />
                                    <span className="historial-mes-nombre">{nombresMeses[mes]}</span>
                                    <span className="historial-mes-pct">{anio}</span>
                                    {esActual && !esSeleccionado && (
                                      <span style={{ fontSize: '9px', color: '#3b82f6', fontWeight: 700 }}>●</span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* SELECTOR DE AÑO/MES solo para Caja */}
          {selectedModulo === 'Caja' && cajaAniosDisponibles.length > 0 && (
            <div className="periodo-historial-container">
              {/* ENCABEZADO */}
              <button
                className="periodo-historial-header periodo-historial-toggle"
                onClick={() => setHistorialExpandido(prev => !prev)}
              >
                <div>
                  <h3 className="font-semibold text-[16px] leading-[1.2] flex items-center">
                    <Wallet className="w-5 h-5 text-green-600 mr-2 flex-shrink-0" />
                    Caja General
                    <span className="historial-anio-badge ml-2">
                      {cajaAniosDisponibles.length} {cajaAniosDisponibles.length === 1 ? 'año' : 'años'} disponibles
                    </span>
                  </h3>
                  <p className="periodo-historial-subtitle text-[14px]">
                    Selecciona el año y mes que deseas visualizar
                  </p>
                </div>
                <ChevronDown className={`w-5 h-5 historial-chevron text-green-500 ${historialExpandido ? 'open' : ''}`} />
              </button>

              {/* CONTENIDO */}
              {historialExpandido && (
                <div className="historial-anios-lista">
                  {cajaAniosDisponibles.map(anio => {
                    const estaExpandido = aniosExpandidos[anio] !== false;

                    //  Meses que tienen datos para este año (del backend)
                    const mesesConDatos = cajaMesesDisponibles?.[anio] ?? [];
                    const sinInfoAun = mesesConDatos.length === 0;

                    const mesesDisponibles = [
                      { num: null, label: 'Todo el año',   abrev: 'Año' },
                      { num: 1,    label: 'Enero',          abrev: 'Ene' },
                      { num: 2,    label: 'Febrero',         abrev: 'Feb' },
                      { num: 3,    label: 'Marzo',           abrev: 'Mar' },
                      { num: 4,    label: 'Abril',           abrev: 'Abr' },
                      { num: 5,    label: 'Mayo',            abrev: 'May' },
                      { num: 6,    label: 'Junio',           abrev: 'Jun' },
                      { num: 7,    label: 'Julio',           abrev: 'Jul' },
                      { num: 8,    label: 'Agosto',          abrev: 'Ago' },
                      { num: 9,    label: 'Septiembre',      abrev: 'Sep' },
                      { num: 10,   label: 'Octubre',         abrev: 'Oct' },
                      { num: 11,   label: 'Noviembre',       abrev: 'Nov' },
                      { num: 12,   label: 'Diciembre',       abrev: 'Dic' },
                    ];

                    //filtrar igual que el bloque de Lecturas/Pagos/Facturas
                    const mesesFiltrados = mesesDisponibles.filter(({ num }) => {
                      if (num === null) return true;   // "Todo el año" siempre visible
                      if (sinInfoAun)  return true;    // aún cargando → mostrar todos
                      return mesesConDatos.includes(num); // solo meses con movimiento
                    });

                    return (
                      <div key={anio} className="historial-anio-bloque">
                        {/* CABECERA DEL AÑO */}
                        <button
                          className="historial-anio-header"
                          onClick={() => toggleAnio(anio)}
                        >
                          <span className="historial-anio-label">
                            <Calendar className="w-4 h-4" />
                            {anio}
                          </span>
                          <span className="historial-anio-badge">
                            {cajaAnioFiltro === anio
                              ? cajaMesFiltro
                                ? mesesDisponibles.find(m => m.num === cajaMesFiltro)?.label
                                : 'Vista anual'
                              : `${mesesFiltrados.filter(m => m.num !== null).length} meses`}
                          </span>
                          <span>
                            <ChevronDown className={`w-4 h-4 historial-chevron ${estaExpandido ? 'open' : ''}`} />
                          </span>
                        </button>

                        {/* CHIPS DE MES — solo meses con datos */}
                        {estaExpandido && (
                          <div className="historial-meses-grid">
                            {mesesFiltrados.map(({ num, label, abrev }) => {
                              const esSeleccionado = cajaAnioFiltro === anio && cajaMesFiltro === num;
                              return (
                                <button
                                  key={num ?? 'all'}
                                  className={`historial-mes-chip ${esSeleccionado ? 'seleccionado' : 'incompleto'}`}
                                  onClick={() => { setCajaAnioFiltro(anio); setCajaMesFiltro(num); }}
                                  title={label}
                                >
                                  <span className={`historial-mes-dot ${esSeleccionado ? 'completo' : 'incompleto'}`} />
                                  <span className="historial-mes-nombre">{abrev}</span>
                                  <span className="historial-mes-pct">{anio}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
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
            {/* FILTRO PARA MEDIDORES: Sector */}
            {selectedModulo === 'Afiliados' && (
              <select
                className="filter-select"
                value={filterSector}
                onChange={(e) => setFilterSector(e.target.value)}
              >
                <option value="todos">Todos los sectores</option>
                {sectoresDisponibles.map((sector) => (
                  <option key={sector.id_sector} value={sector.nombre_sector}>
                    {sector.nombre_sector}
                  </option>
                ))}
              </select>
            )}

            {/* FILTRO PARA MEDIDORES: Sector */}
            {selectedModulo === 'Medidores' && (
              <select
                className="filter-select"
                value={filterSector}
                onChange={(e) => setFilterSector(e.target.value)}
              >
                <option value="todos">Todos los sectores</option>
                {sectoresDisponibles.map((sector) => (
                  <option key={sector.id_sector} value={sector.nombre_sector}>
                    {sector.nombre_sector}
                  </option>
                ))}
              </select>
            )}

            {/* FILTRO PARA LECTURAS: Tipo (Real/Estimada) */}
            {selectedModulo === 'Lecturas' && (
              <>
                <select
                  className="filter-select"
                  value={filterTipoLectura}
                  onChange={(e) => setFilterTipoLectura(e.target.value)}
                >
                  <option value="todos">Todos los tipos</option>
                  <option value="reales">Reales</option>
                  <option value="estimadas">Estimadas</option>
                </select>

                <select
                  className="filter-select"
                  value={filterSector}
                  onChange={(e) => setFilterSector(e.target.value)}
                >
                  <option value="todos">Todos los sectores</option>
                  {sectoresDisponibles.map((sector) => (
                    <option key={sector.id_sector} value={sector.nombre_sector}>
                      {sector.nombre_sector}
                    </option>
                  ))}
                </select>
              </>
            )}


            {/* FILTRO PARA FACTURAS: Estado */}
            {selectedModulo === 'Facturas' && (
              <select
                className="filter-select"
                value={filterEstado}
                onChange={(e) => setFilterEstado(e.target.value)}
              >
                <option value="todos">Todos los estados</option>
                <option value="pendiente">Pendiente</option>
                <option value="pagada">Pagada</option>
                <option value="vencida">Vencida</option>
                <option value="anulada">Anulada</option>
              </select>
            )}

            {/* FILTRO PARA PAGOS: Estado */}
            {selectedModulo === 'Pagos' && (
              <>
                <select
                className="filter-select"
                value={filterEstado}
                onChange={(e) => setFilterEstado(e.target.value)}
              >
                <option value="todos">Todos los estados</option>
                <option value="REGISTRADO">Registrado</option>
                <option value="ANULADO">Anulado</option>

              </select>

                <select
                  className="filter-select"
                  value={filterPagoCompleto}
                  onChange={(e) => setFilterPagoCompleto(e.target.value)}
                >
                  <option value="todos">Tipo de pago</option>
                  <option value="completos">Pagos completos</option>
                  <option value="parciales">Pagos parciales</option>
                </select>
              </>
            )}

            {/* FILTRO PARA MULTAS AFILIADOS: Estado */}
            {selectedModulo === 'MultasAfiliados' && (
              <select
                className="filter-select"
                value={filterEstado}
                onChange={(e) => setFilterEstado(e.target.value)}
              >
                <option value="todos">Todos los estados</option>
                <option value="pendiente">Pendiente</option>
                <option value="pagada">Pagada</option>
                <option value="anulada">Anulada</option>
                <option value="exonerada">Exonerada</option>
                <option value="facturado">Facturado</option>
              </select>
            )}

            {/* FILTRO GENÉRICO PARA OTROS MÓDULOS: Activo/Inactivo */}
            {['Usuarios', 'Roles', 'Sectores', 'Tarifas', 'Afiliados', 'Medidores', 'Servicios', 'Multas'].includes(selectedModulo) && (
              <select
                className="filter-select"
                value={filterEstado}
                onChange={(e) => setFilterEstado(e.target.value)}
              >
                <option value="todos">Todos</option>
                <option value="activos">Activos</option>
                <option value="inactivos">Inactivos</option>
              </select>
            )}

            {/* ── ORDENAMIENTO ── Afiliados y Medidores */}
            {['Usuarios', 'Afiliados', 'Medidores'].includes(selectedModulo) && (
              <>
                <select
                  className="filter-select"
                  value={sortBy}
                  onChange={(e) => { setSortBy(e.target.value); setSortOrder('asc'); }}
                  title="Ordenar por"
                >
                  <option value="">↕ Ordenar por...</option>
                  {(sortOptions[selectedModulo] || []).map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>

                {sortBy && (
                  <button
                    type="button"
                    className="filter-select"
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    title={sortOrder === 'asc' ? 'Orden ascendente' : 'Orden descendente'}
                    style={{ cursor: 'pointer', fontWeight: 600, minWidth: 80 }}
                  >
                    {sortOrder === 'asc' ? '↑ A → Z' : '↓ Z → A'}
                  </button>
                )}
              </>
            )}
            
            {/* Botón Actualizar */}
            <button
              onClick={generarReporte}
              className="btn-secondary"
              disabled={loading}
              title="Actualizar reporte"
            >
              {loading ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </button>
        
            {/* Botón limpiar filtros */}
            <button
              onClick={limpiarFiltrosSinModulo}
              className="btn-secondary"
              title="Limpiar filtros"
            >
              <Eraser className="w-4 h-4" />
            </button>
          </div>
          </div>

          <div className="filters-section">
            {reporteData.length > 0 && (
              <div className="filters-actions-container2">
                {/* ── FILTRO POR MEDIDOR (Lecturas / Facturas / Pagos) ── */}
                {['Lecturas', 'Facturas', 'Pagos'].includes(selectedModulo) && esReporteIndividual &&
                  medidoresDisponibles.length > 1 && (
                    <select
                      className="filter-select"
                      value={filterMedidor}
                      onChange={e => setFilterMedidor(e.target.value)}
                      title="Filtrar por medidor"
                    >
                      <option value="todos">Todos los medidores</option>
                      {medidoresDisponibles.map(m => (
                        <option key={m} value={m}>Medidor {m}</option>
                      ))}
                    </select>
                )}

                {/* Botón selector de columnas */}
                <button
                  onClick={() => setMostrarSelectorColumnas(!mostrarSelectorColumnas)}
                  className={`filter-control-btn ${mostrarSelectorColumnas ? 'active' : ''}`}
                  title={mostrarSelectorColumnas ? 'Ocultar selector de columnas' : 'Mostrar selector de columnas'}
                >
                  <Settings className="w-5 h-5" />
                  <span>Personalizar columnas</span>
                  <span className="control-badge">
                    {columnasActivas.length}/{Object.keys(columnasVisibles).length}
                  </span>
                  {mostrarSelectorColumnas ? (
                    <XCircle className="w-4 h-4 ml-auto" />
                  ) : (
                    <span className="control-arrow">▼</span>
                  )}
                </button>

                {/* Botón estadísticas - SOLO para Lecturas, Facturas, Pagos, MultasAfiliados */}
                {['Lecturas', 'Facturas', 'Pagos', 'MultasAfiliados', 'Caja'].includes(selectedModulo) && (
                  <button
                    onClick={() => setMostrarEstadisticas(!mostrarEstadisticas)}
                    className={`filter-control-btn ${mostrarEstadisticas ? 'active' : ''}`}
                    title={mostrarEstadisticas ? 'Ocultar estadísticas' : 'Mostrar estadísticas'}
                  >
                    <TrendingUp className="w-5 h-5" />
                    <span>Estadísticas detalladas</span>
                    <span className="control-badge control-badge-stats">
                      {estadisticasDinamicas.length} métricas
                    </span>
                    {mostrarEstadisticas ? (
                      <XCircle className="w-4 h-4 ml-auto" />
                    ) : (
                      <span className="control-arrow">▼</span>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* SELECTOR DE COLUMNAS - PANEL EXPANDIBLE (FUERA DE FILTERS-SECTION) */}
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

          {/* PANEL DE ESTADÍSTICAS AVANZADAS (FUERA DE FILTERS-SECTION) */}
          {reporteData.length > 0 && 
          mostrarEstadisticas && 
          ['Lecturas', 'Facturas', 'Pagos', 'MultasAfiliados', 'Caja'].includes(selectedModulo) && (
            <div className="stats-panel">
              <ReportStats 
                 data={
                    selectedModulo === 'Caja'
                      // Vista anual → array de meses
                      ? (cajaAnualData?.meses ?? [])
                      // Vista mensual → envolver resumen en array para que tenga estructura
                      : reporteData
                  }
                moduloInfo={modulosSistema.find(m => m.value === selectedModulo)} 
                stats={estadisticasDinamicas}
              />
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
            const hasFiltros = searchTerm  || filterEstado !== 'todos';
            
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
            
            {/* WRAPPER QUE COMPARTE SCROLL HORIZONTAL */}
            <div className="reports-list-scroll-wrapper">
              
              {/* HEADER DINÁMICO - Solo columnas visibles */}
              <div
                className="reports-list-header"
                style={{
                  gridTemplateColumns: `60px ${columnasActivas
                    .map(() => 'minmax(150px, 1fr)')
                    .join(' ')}`
                }}
              >
                <span className="header-cell header-id">#</span>
                {columnasActivas.map((key) => (
                  <span
                    key={key}
                    className="header-cell"
                    title={key.replace(/_/g, ' ')}
                  >
                    {formatColumnName(key)}
                  </span>
                ))}
              </div>

              {/* BODY DE DATOS - Solo columnas visibles */}
              <div className="reports-list-body">
                {sortedData.map((row, index) => (
                  <div
                    key={index}
                    className={`reports-list-item ${
                      row.activo === false || row.activo === 'No' ? 'inactive' : ''
                    }`}
                    style={{
                      gridTemplateColumns: `60px ${columnasActivas
                        .map(() => 'minmax(150px, 1fr)')
                        .join(' ')}`
                    }}
                  >
                    {/* Número de fila */}
                    <div className="report-col-id">{index + 1}</div>

                    {/* Valores dinámicos - Solo columnas seleccionadas */}
                    {columnasActivas.map((key, i) => {
                      const value = row[key];
                      return (
                        <div
                          key={i}
                          className={`report-col-data ${getColumnClass(key, value)}`}
                          data-label={formatColumnName(key)}
                          title={formatTooltip(key, value)}
                        >
                          {formatCellValue(key, value)}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
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
                  Mostrando <strong>{sortedData.length}</strong> registros
                </span>
                <span className="text-gray-400">|</span>
                <span>
                  <strong>{columnasActivas.length}</strong> de{' '}
                  <strong>{Object.keys(columnasVisibles).length}</strong> columnas
                </span>
              </div>
            </div>
          </div>
        )}


        </div>
      )}
      {/* MODAL DE REPORTE INDIVIDUAL */ }
      {modalIndividual && (
        <div className="modal-overlay" onClick={() => setModalIndividual(false)}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>

            {/* HEADER */}
            <div className="modal-header">
              <div className="modal-title-row">
                <div>
                  <h2> 
                    <FileText className="w-5 h-5 text-blue-600" /> Reporte individual
                  </h2>
                  <p>Genera un reporte por afiliado y periodo</p>
                </div>
              </div>
              <button className='modal-close' onClick={() => setModalIndividual(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* STEPS */}
            <div className="modal-steps">
              {['Afiliado', 'Periodo', 'Confirmar'].map((label, i) => (
                <React.Fragment key={i}>
                  <div className={`step ${pasoModal === i+1 ? 'active' : ''} ${pasoModal > i+1 ? 'done' : ''}`}>
                    <div className="step-num">
                      {pasoModal > i+1 ? <CheckCircle className="w-3 h-3" /> : i+1}
                    </div>
                    <span>{label}</span>
                  </div>
                  {i < 2 && <div className="step-line" />}
                </React.Fragment>
              ))}
            </div>

            {/* PASO 1: AFILIADO */}
            {pasoModal === 1 && (
              <div className="modal-body">
                <div className="search-container">
                  <Search className="search-icon" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre, código o cédula..."
                    value={searchAfiliado}
                    onChange={e => setSearchAfiliado(e.target.value)}
                    className="search-input"
                    autoFocus
                  />
                </div>

                <div className="affiliates-modal-list">
                  {afiliadosModal
                    .filter(a => {
                      const q = searchAfiliado.toLowerCase();
                      return (
                        `${a.nombres} ${a.apellidos}`.toLowerCase().includes(q) ||
                        String(a.cod_usuario_afi).includes(q) ||
                        String(a.cedula).includes(q)
                      );
                    })
                    .map((a) => {
                      const isSelected = afiliadoSeleccionado?.cod_usuario_afi === a.cod_usuario_afi;
                      return (
                        <div
                          key={a.cod_usuario_afi}
                          className={`affiliate-modal-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => setAfiliadoSeleccionado(a)}
                        >
                          <div className="avatar-circle">
                            {`${a.nombres?.[0] || ''}${a.apellidos?.[0] || ''}`}
                          </div>
                          <div className="affiliate-info">
                            <p className="affiliate-name">{a.nombres} {a.apellidos}</p>
                            {/* ✅ Usar `a` no `afiliadoSeleccionado` */}
                            <p className="affiliate-meta">
                              {a.cod_usuario_afi} · {a.cedula} · {a.sector}
                            </p>
                          </div>
                          {isSelected && <CheckCircle className="w-4 h-4 text-blue-600" />}
                        </div>
                      );
                    })
                  }

                  {/* Empty state si no hay resultados */}
                  {afiliadosModal.filter(a => {
                    const q = searchAfiliado.toLowerCase();
                    return (
                      `${a.nombres} ${a.apellidos}`.toLowerCase().includes(q) ||
                      String(a.cod_usuario_afi).includes(q) ||
                      String(a.cedula).includes(q)
                    );
                  }).length === 0 && (
                    <div className="empty-state" style={{ padding: '24px 0' }}>
                      <Users className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--color-text-faint)' }} />
                      <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
                        No se encontraron afiliados con "{searchAfiliado}"
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* PASO 2: PERIODO */}
            {pasoModal === 2 && (() => {
              const periodos = periodosIndividuales[selectedModulo] || [];
              const hoy = new Date();
              const mesActual = hoy.getMonth() + 1;
              const anioActual = hoy.getFullYear();

              // Filtrar futuros y agrupar
              const validos = periodos.filter(p => {
                const esFuturo = p.anio > anioActual || (p.anio === anioActual && p.mes > mesActual);
                return !esFuturo;
              });

              const agrupado = validos.reduce((acc, p) => {
                if (!acc[p.anio]) acc[p.anio] = [];
                acc[p.anio].push(p.mes);
                return acc;
              }, {});

              const aniosOrdenados = Object.keys(agrupado).map(Number).sort((a, b) => b - a);
              const nm = { 1:'Ene',2:'Feb',3:'Mar',4:'Abr',5:'May',6:'Jun',7:'Jul',8:'Ago',9:'Sep',10:'Oct',11:'Nov',12:'Dic' };

              // ── Helpers para rango ──────────────────────────────────────────
              // Convierte "mes-anio" a número comparable: anio*100 + mes
              const toNum = (val) => { if (!val) return 0; const [m,a] = val.split('-'); return Number(a)*100+Number(m); };

              const isEnRango = (mes, anio) => {
                if (!rangoDesdeInd || !rangoHastaInd) return false;
                const v = anio*100 + mes;
                return v >= toNum(rangoDesdeInd) && v <= toNum(rangoHastaInd);
              };

              const handleChipRango = (valor) => {
                if (!rangoDesdeInd || (rangoDesdeInd && rangoHastaInd)) {
                  // Primer clic: limpiar y poner inicio
                  setRangoDesdeInd(valor);
                  setRangoHastaInd(null);
                } else {
                  // Segundo clic: poner fin (en orden)
                  if (toNum(valor) >= toNum(rangoDesdeInd)) {
                    setRangoHastaInd(valor);
                  } else {
                    setRangoHastaInd(rangoDesdeInd);
                    setRangoDesdeInd(valor);
                  }
                }
              };

              return (
                <div className="modal-body">
                  {/* Tarjeta afiliado */}
                  <div className="selected-affiliate-card">
                    <div className="avatar-circle">
                      {afiliadoSeleccionado?.nombres?.[0]}{afiliadoSeleccionado?.apellidos?.[0]}
                    </div>
                    <div>
                      <p className="affiliate-name">
                        {afiliadoSeleccionado?.nombres} {afiliadoSeleccionado?.apellidos}
                      </p>
                      <p className="affiliate-meta">
                        {afiliadoSeleccionado?.cod_usuario_afi} · {afiliadoSeleccionado?.cedula}
                      </p>
                    </div>
                  </div>

                  {/* Selector de modo */}
                  <div className="period-type-grid" style={{ marginBottom: 16 }}>
                    {[
                      { key: 'mes',  label: 'Mes específico', sub: '1 mes exacto',       Icon: Calendar   },
                      { key: 'rango',label: 'Rango',           sub: 'Desde → Hasta',      Icon: BarChart3  },
                      { key: 'anio', label: 'Año completo',    sub: 'Todos los meses',    Icon: FileText   },
                    ].map(({ key, label, sub, Icon }) => (
                      <div
                        key={key}
                        className={`period-type-card ${modoSeleccion === key ? 'selected' : ''}`}
                        onClick={() => {
                          setModoSeleccion(key);
                          // Reset selecciones al cambiar modo
                          setPeriodoIndividualSeleccionado(null);
                          setRangoDesdeInd(null);
                          setRangoHastaInd(null);
                          setAnioSeleccionado(null);
                        }}
                      >
                        <Icon className="w-5 h-5 mb-1" />
                        <p className="opt-label">{label}</p>
                        <p className="opt-sub">{sub}</p>
                      </div>
                    ))}
                  </div>

                  {/* Loading */}
                  {validos.length === 0 && (
                    <div className="empty-state" style={{ padding: '16px 0' }}>
                      <Loader className="w-6 h-6 animate-spin text-blue-500 mx-auto mb-2" />
                      <p>Cargando períodos de {selectedModulo}...</p>
                    </div>
                  )}

                  {/* ── MODO: AÑO COMPLETO ── */}
                  {modoSeleccion === 'anio' && validos.length > 0 && (
                    <div>
                      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 8 }}>
                        Selecciona el año:
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {aniosOrdenados.map(anio => (
                          <button
                            key={anio}
                            className={`historial-mes-chip ${anioSeleccionado === anio ? 'seleccionado' : 'incompleto'}`}
                            onClick={() => setAnioSeleccionado(anio)}
                            style={{ minWidth: 64, justifyContent: 'center' }}
                          >
                            <span className="historial-mes-nombre">{anio}</span>
                            <span className="historial-mes-pct">{agrupado[anio].length} meses</span>
                          </button>
                        ))}
                      </div>
                      {anioSeleccionado && (
                        <p style={{ fontSize: 12, color: 'var(--color-primary)', marginTop: 8 }}>
                          ✓ Se incluirán {agrupado[anioSeleccionado]?.length} períodos de {anioSeleccionado}
                        </p>
                      )}
                    </div>
                  )}

                  {/* ── MODO: MES ESPECÍFICO ── */}
                  {modoSeleccion === 'mes' && validos.length > 0 && (
                    <div>
                      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 8 }}>
                        Selecciona el período:
                      </p>
                      {aniosOrdenados.map(anio => (
                        <div key={anio} style={{ marginBottom: 10 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-faint)', marginRight: 8 }}>
                            {anio}
                          </span>
                          <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6 }}>
                            {agrupado[anio].sort((a, b) => b - a).map(mes => {
                              const valor = `${mes}-${anio}`;
                              const sel = periodoIndividualSeleccionado === valor;
                              return (
                                <button
                                  key={valor}
                                  className={`historial-mes-chip ${sel ? 'seleccionado' : 'incompleto'}`}
                                  onClick={() => setPeriodoIndividualSeleccionado(valor)}
                                >
                                  <span className="historial-mes-nombre">{nm[mes]}</span>
                                  <span className="historial-mes-pct">{anio}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── MODO: RANGO ── */}
                  {modoSeleccion === 'rango' && validos.length > 0 && (
                    <div>
                      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                        {!rangoDesdeInd
                          ? '① Clic en el período de inicio'
                          : !rangoHastaInd
                          ? '② Clic en el período de fin'
                          : `✓ Rango: ${nm[+rangoDesdeInd.split('-')[0]]} ${rangoDesdeInd.split('-')[1]} → ${nm[+rangoHastaInd.split('-')[0]]} ${rangoHastaInd.split('-')[1]}`
                        }
                      </p>
                      {(rangoDesdeInd || rangoHastaInd) && (
                        <button
                          style={{ fontSize: 11, color: 'var(--color-error)', marginBottom: 8, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
                          onClick={() => { setRangoDesdeInd(null); setRangoHastaInd(null); }}
                        >
                          Limpiar selección
                        </button>
                      )}
                      {aniosOrdenados.map(anio => (
                        <div key={anio} style={{ marginBottom: 10 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-faint)', marginRight: 8 }}>
                            {anio}
                          </span>
                          <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6 }}>
                            {agrupado[anio].sort((a, b) => b - a).map(mes => {
                              const valor = `${mes}-${anio}`;
                              const esInicio = rangoDesdeInd === valor;
                              const esFin    = rangoHastaInd === valor;
                              const enRango  = isEnRango(mes, anio);
                              return (
                                <button
                                  key={valor}
                                  className={`historial-mes-chip ${
                                    esInicio || esFin ? 'seleccionado' :
                                    enRango ? 'en-rango' : 'incompleto'
                                  }`}
                                  onClick={() => handleChipRango(valor)}
                                  title={esInicio ? 'Inicio' : esFin ? 'Fin' : nm[mes] + ' ' + anio}
                                >
                                  <span className="historial-mes-nombre">{nm[mes]}</span>
                                  <span className="historial-mes-pct">{anio}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* PASO 3: CONFIRMAR */}
            {pasoModal === 3 && (
              <div className="modal-body">
                <div className="preview-summary">
                  {[
                    [
                      'Afiliado',
                      `${afiliadoSeleccionado?.nombres} ${afiliadoSeleccionado?.apellidos}`,
                    ],
                    [
                      'Código',
                      afiliadoSeleccionado?.cod_usuario_afi,
                    ],
                    [
                      'Módulo',
                      modulosSistema.find(m => m.value === selectedModulo)?.label ?? selectedModulo,
                    ],
                    [
                      'Tipo de período',
                      { mes: 'Mes específico', rango: 'Rango de períodos', anio: 'Año completo' }[modoSeleccion],
                    ],
                    [
                      'Período',
                      (() => {
                        const nm = {
                          1:'Enero', 2:'Febrero', 3:'Marzo', 4:'Abril', 5:'Mayo', 6:'Junio',
                          7:'Julio', 8:'Agosto', 9:'Septiembre', 10:'Octubre', 11:'Noviembre', 12:'Diciembre',
                        };
                        if (modoSeleccion === 'mes' && periodoIndividualSeleccionado) {
                          const [m, a] = periodoIndividualSeleccionado.split('-').map(Number);
                          return `${nm[m]} ${a}`;
                        }
                        if (modoSeleccion === 'anio' && anioSeleccionado) {
                          return `Año completo ${anioSeleccionado}`;
                        }
                        if (modoSeleccion === 'rango' && rangoDesdeInd && rangoHastaInd) {
                          const [md, ad] = rangoDesdeInd.split('-').map(Number);
                          const [mh, ah] = rangoHastaInd.split('-').map(Number);
                          return `${nm[md]} ${ad} → ${nm[mh]} ${ah}`;
                        }
                        return '—';
                      })(),
                    ],
                    [
                      'Total períodos',
                      (() => {
                        if (modoSeleccion === 'mes') return '1 mes';
                        if (modoSeleccion === 'anio' && anioSeleccionado) {
                          const periodos = periodosIndividuales[selectedModulo] || [];
                          const count = periodos.filter(p => p.anio === anioSeleccionado).length;
                          return `${count} mes${count !== 1 ? 'es' : ''}`;
                        }
                        if (modoSeleccion === 'rango' && rangoDesdeInd && rangoHastaInd) {
                          const toNum = v => { const [m,a] = v.split('-'); return Number(a)*100+Number(m); };
                          const periodos = periodosIndividuales[selectedModulo] || [];
                          const count = periodos.filter(p => {
                            const v = p.anio * 100 + p.mes;
                            return v >= toNum(rangoDesdeInd) && v <= toNum(rangoHastaInd);
                          }).length;
                          return `${count} mes${count !== 1 ? 'es' : ''}`;
                        }
                        return '—';
                      })(),
                    ],
                  ].map(([k, v]) => (
                    <div key={k} className="preview-row">
                      <span className="preview-key">{k}</span>
                      <span className="preview-val">{v}</span>
                    </div>
                  ))}
                </div>

                {/* Advertencia si falta selección */}
                {(modoSeleccion === 'mes' && !periodoIndividualSeleccionado) ||
                (modoSeleccion === 'anio' && !anioSeleccionado) ||
                (modoSeleccion === 'rango' && (!rangoDesdeInd || !rangoHastaInd)) ? (
                  <div style={{
                    marginTop: 12,
                    padding: '8px 12px',
                    borderRadius: 6,
                    background: 'color-mix(in oklch, var(--color-warning) 10%, transparent)',
                    border: '1px solid color-mix(in oklch, var(--color-warning) 30%, transparent)',
                    color: 'var(--color-warning)',
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}>
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    Vuelve al paso anterior y completa la selección de período.
                  </div>
                ) : (
                  <div style={{
                    marginTop: 12,
                    padding: '8px 12px',
                    borderRadius: 6,
                    background: 'color-mix(in oklch, var(--color-success) 10%, transparent)',
                    border: '1px solid color-mix(in oklch, var(--color-success) 30%, transparent)',
                    color: 'var(--color-success)',
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}>
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    Todo listo. Haz clic en <strong>&nbsp;"Generar"&nbsp;</strong> para continuar.
                  </div>
                )}
              </div>
            )}

            {/* FOOTER */}
            <div className="modal-footer">
              <span className="footer-step-info">Paso {pasoModal} de 3</span>
              <div className="footer-btn-row">
                {pasoModal > 1 && (
                  <button className="btn-secondary" onClick={() => setPasoModal(p => p - 1)}>
                    <ArrowLeft className="w-4 h-4 mr-1" /> Atrás
                  </button>
                )}
                {pasoModal < 3 ? (
                  <button
                    className="btn-primary"
                    disabled={pasoModal === 1 && !afiliadoSeleccionado}
                    onClick={() => setPasoModal(p => p + 1)}
                  >
                    Siguiente →
                  </button>
                ) : (
                  <button
                    className="btn-primary"
                    disabled={loadingReporteIndividual}
                    onClick={generarReporteIndividual}
                  >
                    {loadingReporteIndividual ? (
                      <><Loader className="w-4 h-4 animate-spin mr-1" /> Generando...</>
                    ) : (
                      <><FileText className="w-4 h-4 mr-1" /> Generar reporte</>
                    )}
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>

    
  );
};

export default ReportsSection;
