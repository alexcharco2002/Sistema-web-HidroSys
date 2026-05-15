// src/sections/PaymentsSection.js
// MÓDULO DE PAGOS - Con sistema de periodos mensuales

import React, { useState, useEffect, useCallback , useRef} from 'react';
import './PaymentsSection.css'; // Reutilizar estilos similares a InvoicesSection

// ✅ CORRECTO
import PaymentReceipt from '../../components/PaymentReceipt';
import { 
  generatePaymentPDF, 
  generateMultiplePaymentPDF
} from '../../components/PaymentReceipt';

// 🆕 IMPORTAR EL NUEVO COMPONENTE
import MultiplePaymentReceipt from '../../components/MultiplePaymentReceipt';


import paymentsServices from '../../services/paymentsServices';
import authService from '../../services/authServices';

import {
  DollarSign,
  Search,
  Eye,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  X,
  RefreshCw,
  ArrowUpDown,
  TrendingUp,
  Ban,
  CalendarDays,
  User,
  IdCard,
  FileText,
  CreditCard,
  Plus, ChevronDown, ChevronLeft, ChevronRight,
  Wallet, XCircle, FileCheck, Gauge, CheckSquare, Square, AlertTriangle, Wrench, Droplets
} from 'lucide-react';

const PaymentsSection = () => {
  const pageSizeOptions = [10, 20, 50];

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
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState(null);
  const [loadingPeriodos, setLoadingPeriodos] = useState(false);

  // ============================================================
  // ESTADOS DE BÚSQUEDA Y FILTROS
  // ============================================================
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterMetodo, setFilterMetodo] = useState('all');
  const [sortOption, setSortOption] = useState('fecha');
  const [sortOrder, setSortOrder] = useState('desc');
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // Estado para almacenar facturas pendientes por afiliado
  const [facturasPendientesPorAfiliado, setFacturasPendientesPorAfiliado] = useState({});
  const [, setLoadingFacturasPendientes] = useState(false);


  // Estado para modal de desglose de adeudos
  const [showAdeudosModal, setShowAdeudosModal] = useState(false);
  const [selectedAfiliadoAdeudos, setSelectedAfiliadoAdeudos] = useState(null);
  const [selectedFacturaAdeudos, setSelectedFacturaAdeudos] = useState(null);


  const [facturasSeleccionadas, ] = useState({});
  const [, setMontoPagoMasivo] = useState(0);

  // Estado para controlar items seleccionados (agregar al componente)
  const [itemsAPagar, setItemsAPagar] = useState({
    consumos: true,   
    multas: true,      
    mora: true      
  });

  // Estado para controlar qué años están expandidos en la sección de periodos
   const [aniosExpandidos, setAniosExpandidos] = useState({});
      const toggleAnio = (anio) => {
        setAniosExpandidos(prev => ({ ...prev, [anio]: !prev[anio] }));
      };
    

  // Función para calcular el total dinámicamente [web:6][web:9]
  const calcularTotalAPagar = () => {
    if (!resumenPago || !resumenPago.totales) return 0;

    let total = 0;

    // Calcular monto de consumo
    const totalConsumo = getSafeValue(resumenPago.totales.opcion_sin_multas?.total_final, 0) - 
                        (getSafeValue(resumenPago.mora?.monto, 0));

    // Agregar consumo si está seleccionado Y tiene monto
    if (itemsAPagar.consumos && totalConsumo > 0) {
      total += totalConsumo;
    }

    // Agregar multas si están seleccionadas
    if (itemsAPagar.multas && resumenPago.multas?.tiene_multas) {
      total += getSafeValue(resumenPago.multas.total_con_iva, 0);
    }

    // Agregar mora si está seleccionada
    if (itemsAPagar.mora && resumenPago.mora?.aplica) {
      total += getSafeValue(resumenPago.mora.monto, 0);
    }

    return Number(total.toFixed(2));
  };

  // ============================================================
  // AGREGAR ESTADOS PARA PAGO MÚLTIPLE
  // ============================================================
  const [facturasSeleccionadasPago, setFacturasSeleccionadasPago] = useState([]);
  const [showPagoMultipleModal, setShowPagoMultipleModal] = useState(false);

  // 🆕 ESTADOS PARA MODAL MÚLTIPLE (agregar con tus otros useState)
  const [showMultipleReceiptModal, setShowMultipleReceiptModal] = useState(false);
  const [multipleReceiptData, setMultipleReceiptData] = useState(null);


  // ============================================================
  // FUNCIÓN PARA SELECCIONAR/DESELECCIONAR FACTURAS
  // ============================================================
  const toggleFacturaParaPago = (factura) => {
    setFacturasSeleccionadasPago(prev => {
      const existe = prev.find(f => f.idfactura === factura.idfactura);
      if (existe) return prev.filter(f => f.idfactura !== factura.idfactura);
      if (prev.length >= 5) { alert('Solo puede seleccionar hasta 5 facturas'); return prev; }

      // ✅ Normalizar campos al momento de agregar
      const facturaNomalizada = {
        ...factura,
        numfactura: factura.numfactura || factura.num_factura || 'Sin número',
        periodo: factura.periodo || factura.periodo_factura || 'Sin periodo',
        // Usar el campo correcto para el monto
        totalconmora: parseFloat(factura.totalconmora || factura.total_con_mora || factura.saldopendiente || factura.saldo_pendiente || factura.totalfactura || 0),
        saldopendiente: parseFloat(factura.saldopendiente || factura.saldo_pendiente || factura.total || 0),
      };
      return [...prev, facturaNomalizada];
    });
  };

  // ============================================================
  // FUNCIÓN PARA CALCULAR TOTAL DE FACTURAS SELECCIONADAS
  // ============================================================
  const calcularTotalFacturasSeleccionadas = () => {
    return facturasSeleccionadasPago.reduce((sum, factura) => {
      // Asegurarse de usar el campo correcto para el total, con fallback a 0
      const total = parseFloat(
        factura.totalconmora
        || factura.saldopendiente
        || factura.totalfactura
        || 0
      );
      return sum + (isNaN(total) ? 0 : total);   
    }, 0);
  };

  // ============================================================
  // ESTADOS DE ESTADÍSTICAS
  // ============================================================
  const [stats, setStats] = useState({
    // Facturas
    total_facturas: 0,
    facturas_pendientes: 0,
    facturas_pagadas: 0,
    facturas_vencidas: 0,
    facturas_anuladas: 0,
    
    // Montos
    total_facturado: 0,
    total_pendiente: 0,
    total_cobrado: 0,
    
    // Pagos
    total_pagos_registrados: 0,
    total_recaudado: 0,
    total_efectivo: 0,
    total_transferencia: 0,
    total_tarjeta: 0
  });



  // ============================================================
  // ESTADOS DE MODAL
  // ============================================================
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('view');
  const [selectedPago, setSelectedPago] = useState(null);
  const [selectedFactura, setSelectedFactura] = useState(null);

  // ============================================================
  // ESTADOS PARA CREAR PAGO
  // ============================================================
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [nuevoPago, setNuevoPago] = useState({
    id_factura: '',
    monto_pago: '',
    metodo_pago: 'EFECTIVO',
    observaciones: ''
  });
  // ============================================================
  // ESTADOS PARA COMPROBANTES 
  // ============================================================
  const [showReceipt, setShowReceipt] = useState(false);
  const [pagoRegistrado, setPagoRegistrado] = useState(null);
  const [facturaDelPago, setFacturaDelPago] = useState(null);

  // Estados para comprobante
  const [, setComprobanteFile] = useState(null);

  // Estados para resumen de pago
  const [resumenPago, setResumenPago] = useState(null);
  const [loadingResumen, setLoadingResumen] = useState(false);


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
    const canCreate = authService.hasPermission('pagos', 'crear') || 
                     authService.hasPermission('pagos', 'crud');
    const canUpdate = authService.hasPermission('pagos', 'actualizar') || 
                     authService.hasPermission('pagos', 'crud');
    const canDelete = authService.hasPermission('pagos', 'eliminar') || 
                     authService.hasPermission('pagos', 'crud');
    const canRead = authService.hasPermission('pagos', 'lectura') || 
                   canCreate || canUpdate || canDelete || 
                   authService.hasPermission('pagos', 'crud');

    setPermissions({ canCreate, canRead, canUpdate, canDelete });
  };

  // ============================================================
  // FUNCIONES DE PERIODOS
  // ============================================================

  const fetchPeriodosDisponibles = useCallback(async () => {
    setLoadingPeriodos(true);
    try {
      const result = await paymentsServices.getPeriodosDisponibles();
      if (result.success && result.data) {
        setPeriodos(result.data.periodos_disponibles || []);
      } else {
        setError(result.message || 'Error al cargar periodos disponibles');
      }
    } catch (err) {
      console.error('Error al cargar periodos disponibles:', err);
      setError('Error al cargar periodos disponibles');
    } finally {
      setLoadingPeriodos(false);
    }
  }, []);


  //  función para cargar estadísticas del periodo seleccionado
  const fetchStats = useCallback(async () => {
    if (!periodoSeleccionado) return;

    try {
      const periodoStr = `${periodoSeleccionado.anio}-${String(periodoSeleccionado.mes).padStart(2, '0')}`;
      const result = await paymentsServices.getStatsByPeriodo(periodoStr);

      if (result.success) {
        setStats(result.data);
      }
    } catch (err) {
      console.error('Error al cargar estadísticas:', err);
    }
  }, [periodoSeleccionado]);

  const handlePeriodoChange = (mes, anio) => {
    setPeriodoSeleccionado({ mes, anio });
    
    // ✅ Limpiar caché al cambiar período
    facturasPendientesCache.current = {};
    setFacturasPendientesPorAfiliado({});
  };


  // ============================================================
  // FUNCIÓN PARA CARGAR TODAS LAS FACTURAS
  // ============================================================

  const facturasPendientesCache = useRef({});

  const cargarFacturasPendientesAfiliado = useCallback(async (idUsuarioAfi, idMedidor) => {
    if (!idUsuarioAfi || !idMedidor || !periodoSeleccionado) {
      console.warn('⚠️ No hay periodo seleccionado');
      return null;
    }

    const periodoStr = `${periodoSeleccionado.anio}-${String(periodoSeleccionado.mes).padStart(2, '0')}`;
    const cacheKey = `${idUsuarioAfi}-${idMedidor}-${periodoStr}`;
    
    // ✅ Verificar caché sin causar re-renders
    if (facturasPendientesCache.current[cacheKey]) {
      console.log('💾 Usando facturas pendientes desde caché');
      return facturasPendientesCache.current[cacheKey];
    }

    setLoadingFacturasPendientes(true);
    try {
      console.log(`🔍 Cargando facturas pendientes para afiliado ${idUsuarioAfi}, periodo: ${periodoStr}`);
      
      const result = await paymentsServices.getFacturasPendientesAfiliado(
        idUsuarioAfi,
        periodoStr,
        false,
        idMedidor
      );

      if (result.success && result.data) {
        // ✅ Guardar en caché sin causar re-render
        facturasPendientesCache.current[cacheKey] = result.data;
        
        // Actualizar estado para UI
        setFacturasPendientesPorAfiliado(prev => ({
          ...prev,
          [`${idUsuarioAfi}-${idMedidor}`]: result.data
        }));
        
        return result.data;
      }
      return null;
    } catch (error) {
      console.error(`❌ Error cargando facturas pendientes:`, error);
      return null;
    } finally {
      setLoadingFacturasPendientes(false);
    }
  }, [periodoSeleccionado]); 


  const fetchFacturasPeriodo = useCallback(async () => {
    //  Validación temprana
    if (!periodoSeleccionado) {
      console.warn('⚠️ No hay periodo seleccionado');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const periodoStr = `${periodoSeleccionado.anio}-${String(periodoSeleccionado.mes).padStart(2, '0')}`;
      
      console.log(`📅 Cargando facturas del periodo: ${periodoStr}`);
      
      const result = await paymentsServices.getFacturasPeriodo({
        periodo: periodoStr,
        estado_factura: filterStatus !== 'all' ? filterStatus : null,
        sort_by: sortOption,      
        sort_order: sortOrder,   
        limit: 100
      });

      if (result.success && result.data) {
        console.log('📦 Facturas cargadas:', result.data.length);
        setFacturas(result.data);

        // ✅ FILTRAR SOLO FACTURAS PENDIENTES/VENCIDAS ANTES DE CARGAR ADEUDOS
        const facturasPendientesOVencidas = result.data.filter(
          f => f.estado_factura === 'pendiente' || f.estado_factura === 'vencida'
        );
        
        console.log(`🔍 Facturas pendientes/vencidas: ${facturasPendientesOVencidas.length} de ${result.data.length}`);

        // ✅ Extraer afiliados únicos SOLO de facturas pendientes/vencidas
        const paresUnicos = [
            ...new Map(
                facturasPendientesOVencidas.map(f => [
                    `${f.id_usuario_afi}-${f.id_medidor}`,
                    { idAfi: f.id_usuario_afi, idMedidor: f.id_medidor }
                ])
            ).values()
        ];

        const promesas = paresUnicos.map(({ idAfi, idMedidor }) =>
            cargarFacturasPendientesAfiliado(idAfi, idMedidor).catch(err => {
                console.error(`Error cargando adeudos del afiliado ${idAfi} medidor ${idMedidor}`, err);
                return null;
            })
        );
        await Promise.all(promesas);

        
        console.log('✅ Adeudos cargados solo para afiliados con deuda activa');
        
        // 🔥 ACTUALIZAR EL PERIODO CON LOS DATOS REALES
        const montoTotal = result.data.reduce((sum, f) => 
          sum + parseFloat(f.total || 0), 0
        );
        
        const montoCobrado = result.data
          .filter(f => f.estado_factura === 'pagada')
          .reduce((sum, f) => sum + parseFloat(f.total || 0), 0);
        
        const montoPendiente = result.data
          .filter(f => f.estado_factura === 'pendiente' || f.estado_factura === 'vencida')
          .reduce((sum, f) => sum + parseFloat(f.total || 0), 0);
        
        // Calcular total de pagos registrados en este periodo
        const totalPagosRegistrados = result.data.reduce((sum, f) => {
          if (f.pagos && f.pagos.length > 0) {
            const pagosFact = f.pagos
              .filter(p => p.estado_pago === 'REGISTRADO')
              .reduce((s, p) => s + parseFloat(p.monto_pago || 0), 0);
            return sum + pagosFact;
          }
          return sum;
        }, 0);
        
        const cantidadPagos = result.data.reduce((sum, f) => {
          if (f.pagos && f.pagos.length > 0) {
            return sum + f.pagos.filter(p => p.estado_pago === 'REGISTRADO').length;
          }
          return sum;
        }, 0);
        
        // Actualizar periodo con estadísticas
        setPeriodos(prevPeriodos => 
          prevPeriodos.map(p => 
            p.mes === periodoSeleccionado.mes && p.anio === periodoSeleccionado.anio 
              ? {
                  ...p,
                  total_facturas: result.data.length,
                  monto_total: montoTotal,
                  monto_cobrado: montoCobrado,
                  monto_pendiente: montoPendiente,
                  total_pagos: cantidadPagos,
                  monto_total_pagos: totalPagosRegistrados,
                  tiene_facturas: result.data.length > 0,
                  tiene_pagos: cantidadPagos > 0
                }
              : p
          )
        );
        
        console.log('📊 Estadísticas actualizadas:', {
          total_facturas: result.data.length,
          monto_total: montoTotal,
          monto_cobrado: montoCobrado,
          monto_pendiente: montoPendiente
        });
        
      } else {
        setError('No se pudieron cargar las facturas');
        setFacturas([]);
      }
    } catch (err) {
      setError('Error al cargar facturas');
      console.error('❌ Error en fetchFacturasPeriodo:', err);
      setFacturas([]);
    } finally {
      setLoading(false);
    }
  }, [
    periodoSeleccionado, 
    filterStatus, 
    sortOption, 
    sortOrder, 
    cargarFacturasPendientesAfiliado   
  ]);

    // ============================================================
    // FUNCIÓN PARA CALCULAR TOTAL PAGADO DE UNA FACTURA
    // ============================================================

    const calcularTotalPagado = (factura) => {
      return factura.monto_pagado || 0;
    };

    const calcularSaldoPendiente = (factura) => {
      return factura.saldo_pendiente || 0;
    };

    // Helper para obtener badge de estado de pago
    const getEstadoPagoBadge = (factura) => {
      if (factura.estado_factura === 'anulada') {
          return (
          <span className="status-badge anulada">
              <Ban className="w-3 h-3" />
              Anulada
          </span>
          );
      }

      if (factura.estado_factura === 'pagada') {
          return (
          <span className="status-badge pagada">
              <CheckCircle className="w-3 h-3" />
              Pagada
          </span>
          );
      }

      const saldo = calcularSaldoPendiente(factura);
      const totalPagado = calcularTotalPagado(factura);

      if (totalPagado > 0 && saldo > 0) {
          return (
          <span className="status-badge parcial" style={{ backgroundColor: '#f59e0b', color: 'white' }}>
              <Clock className="w-3 h-3" />
              Parcial
          </span>
          );
      }

      if (factura.estado_factura === 'vencida') {
          return (
          <span className="status-badge vencida">
              <XCircle className="w-3 h-3" />
              Vencida
          </span>
          );
      }

      return (
          <span className="status-badge pendiente">
          <Clock className="w-3 h-3" />
          Pendiente
          </span>
      );
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
      fetchFacturasPeriodo();
      fetchStats();
    }
  }, [periodoSeleccionado, permissions.canRead, fetchFacturasPeriodo, fetchStats]);


  // ============================================================
  // FILTRADO Y ORDENAMIENTO DE FACTURAS
  // ============================================================
  const toggleSortOrder = () => {
    setSortOrder(prevOrder => prevOrder === 'asc' ? 'desc' : 'asc');
  };

  const filteredFacturas = facturas.filter(factura => {
    const searchLower = searchTerm.toLowerCase();
    
    // BÚSQUEDA: Por factura, afiliado, cédula, medidor, código y nombre completo
    const matchesSearch =
      factura.num_factura?.toLowerCase().includes(searchLower) ||
      factura.usuario_afiliado?.cod_usuario_afi?.toString().includes(searchTerm) ||
      factura.usuario_afiliado?.num_medidor?.toLowerCase().includes(searchLower) ||
      factura.usuario_afiliado?.usuario_sistema?.nombre_completo?.toLowerCase().includes(searchLower) ||
      factura.usuario_afiliado?.usuario_sistema?.cedula?.includes(searchTerm);

    // FILTRO DE ESTADO DE FACTURA
    const matchesStatus = filterStatus === 'all' || factura.estado_factura === filterStatus;

    // FILTRO DE MÉTODO DE PAGO (corregido para array de pagos)
    const matchesMetodo = filterMetodo === 'all' || 
      (factura.pagos && factura.pagos.some(p => p.metodo_pago === filterMetodo));

    return matchesSearch && matchesStatus && matchesMetodo;
  });

  // constante para ordenar facturas
  const sortedFacturas = filteredFacturas;
  const totalPages = Math.max(1, Math.ceil(sortedFacturas.length / pageSize));
  const normalizedCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (normalizedCurrentPage - 1) * pageSize;
  const pageEndIndex = pageStartIndex + pageSize;
  const paginatedFacturas = sortedFacturas.slice(pageStartIndex, pageEndIndex);
  const showingFrom = sortedFacturas.length === 0 ? 0 : pageStartIndex + 1;
  const showingTo = Math.min(pageEndIndex, sortedFacturas.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterMetodo, sortOption, sortOrder, pageSize, periodoSeleccionado]);


  /**
   * Obtiene un valor seguro, retornando un default si es null/undefined/NaN
   */
  const getSafeValue = (value, defaultValue = 0) => {
    if (value === null || value === undefined || isNaN(value)) {
      return defaultValue;
    }
    return parseFloat(value);
  };

  const roundMoney = (value) => {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) return 0;
    return Number(numberValue.toFixed(2));
  };

  const agruparDetallesPago = (detalles = []) => {
    return detalles.reduce((grupos, detalle) => {
      const tipo = (detalle?.tipo_detalle || 'otros').toLowerCase();
      const descripcion = (detalle?.descripcion || '').toLowerCase();

      if (tipo === 'consumo' && descripcion.includes('exceso')) {
        grupos.exceso.push(detalle);
      } else if (tipo === 'consumo') {
        grupos.consumo.push(detalle);
      } else if (tipo === 'multa') {
        grupos.multas.push(detalle);
      } else if (tipo === 'servicio' || tipo === 'cambio medidor') {
        grupos.servicios.push(detalle);
      } else {
        grupos.otros.push(detalle);
      }

      return grupos;
    }, {
      consumo: [],
      exceso: [],
      multas: [],
      servicios: [],
      otros: []
    });
  };

  const normalizarDetallesFactura = (detalles = []) => {
    if (!Array.isArray(detalles)) return [];

    return detalles.map((detalle, index) => ({
      id_detalle: detalle?.id_detalle ?? detalle?.id_detalle_factura ?? detalle?.iddetalle ?? `detalle-${index}`,
      tipo_detalle: detalle?.tipo_detalle ?? detalle?.tipo ?? detalle?.tipodetalle ?? 'otros',
      descripcion: detalle?.descripcion ?? detalle?.concepto ?? detalle?.detalle ?? 'Concepto sin descripcion',
      subtotal_detalle: detalle?.subtotal_detalle ?? detalle?.subtotal ?? detalle?.monto ?? detalle?.valor ?? 0,
      id_servicio: detalle?.id_servicio ?? detalle?.idservicio ?? null,
      id_multa_afiliados: detalle?.id_multa_afiliados ?? detalle?.id_multa_afi ?? detalle?.idmultaafiliados ?? null,
    }));
  };

  const normalizarFacturaDetalle = (facturaDetalle, fallback = {}) => {
    const detalles = normalizarDetallesFactura(
      facturaDetalle?.detalles || facturaDetalle?.detalles_factura || facturaDetalle?.conceptos || fallback?.detalles || []
    );
    const pagos = Array.isArray(facturaDetalle?.pagos)
      ? facturaDetalle.pagos
      : (Array.isArray(fallback?.pagos) ? fallback.pagos : []);

    return {
      ...fallback,
      ...facturaDetalle,
      id_factura: facturaDetalle?.id_factura ?? fallback?.id_factura ?? fallback?.idfactura,
      num_factura: facturaDetalle?.num_factura ?? fallback?.num_factura ?? fallback?.numfactura,
      detalles,
      pagos: pagos.map((pago) => ({
        ...pago,
        monto_pago: pago?.monto_pago ?? pago?.monto_pagado ?? 0,
        observaciones: pago?.observaciones ?? pago?.observacion ?? '',
        cajero: pago?.cajero
          || pago?.nombre_cajero
          || pago?.usuario_cajero?.nombre_completo
          || [pago?.usuario_cajero?.nombres, pago?.usuario_cajero?.apellidos].filter(Boolean).join(' ')
          || '',
      })),
      iva_info: facturaDetalle?.iva_info || fallback?.iva_info,
      nombre_completo: facturaDetalle?.nombre_completo || fallback?.nombre_completo,
      cod_usuario_afi: facturaDetalle?.cod_usuario_afi || fallback?.cod_usuario_afi,
      num_medidor: facturaDetalle?.num_medidor || fallback?.num_medidor,
      nombre_sector: facturaDetalle?.nombre_sector || fallback?.nombre_sector,
    };
  };

  /**
   * Formatea un valor como moneda de forma segura
   */
  const formatCurrencySafe = (value) => {
    const safeValue = getSafeValue(value, 0);
    return `$${safeValue.toFixed(2)}`;
  };


  // ============================================================
  // FUNCIONES DE MODAL
  // ============================================================
  const openModal = async (type, pago = null) => {
    if (type === 'view' && !pago) return;
    
    if (type === 'edit' && !permissions.canUpdate) {
      alert('❌ No tienes permiso para editar pagos');
      return;
    }

    setModalType(type);
    setError(null);
    setSelectedPago(type === 'view-factura' ? normalizarFacturaDetalle(pago, pago) : pago);
    setShowModal(true);

    const idFacturaDetalle = pago?.id_factura ?? pago?.idfactura;
    if (type === 'view-factura' && idFacturaDetalle) {
      try {
        const result = await paymentsServices.getFacturaDetalle(idFacturaDetalle);
        if (result.success && result.data) {
          console.log('Detalle factura cargado para modal de pagos:', {
            idFactura: idFacturaDetalle,
            detalles_backend: result.data?.detalles?.length || 0,
            detalles_lista: pago?.detalles?.length || 0,
            data: result.data
          });
          setSelectedPago(prev => normalizarFacturaDetalle(result.data, prev || pago));
        }
      } catch (error) {
        console.error('Error cargando detalle completo de factura:', error);
      }
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setModalType('');
    setError(null);
    setSelectedPago(null);
  };


// ============================================================
// FUNCIÓN PARA ABRIR MODAL DE ADEUDOS (MEJORADA)
// ============================================================
const openAdeudosModal = async (factura, datosAdeudo) => {
  // Validación de facturas pendientes 
  if (!datosAdeudo || !datosAdeudo.meses_adeudo || datosAdeudo.meses_adeudo <= 0) {
    alert('ℹ️ No hay adeudos pendientes anteriores para mostrar');
    return;
  }
  
  console.log('📊 Abriendo modal de adeudos:', {
    meses: datosAdeudo.meses_adeudo,
    total: datosAdeudo.total_adeudado,
    facturas: datosAdeudo.facturas?.length
  });
  
  // ✅ CARGAR RESUMEN DE LA FACTURA ACTUAL
  setLoadingResumen(true);
  
  try {
    console.log('📊 Cargando resumen de factura actual:', factura.id_factura);
    const resultado = await paymentsServices.calcularResumenPago(factura.id_factura);
    
    if (resultado.success) {
      setResumenPago(resultado.data);
      console.log('✅ Resumen de factura actual cargado:', resultado.data);
      
      // Validar estructura
      if (!resultado.data.totales) {
        console.warn('⚠️ Falta propiedad "totales" en el resumen');
      }
      if (!resultado.data.desglose) {
        console.warn('⚠️ Falta propiedad "desglose" en el resumen');
      }
    } else {
      console.error('❌ Error al cargar resumen:', resultado.message);
      setResumenPago(null);
      alert('⚠️ No se pudo cargar el desglose de la factura actual. Continuando con datos básicos.');
    }
  } catch (error) {
    console.error('❌ Error al calcular resumen:', error);
    setResumenPago(null);
    alert('⚠️ Error al calcular desglose. Mostrando solo totales.');
  } finally {
    setLoadingResumen(false);
  }
  
  // Abrir modal
  setSelectedFacturaAdeudos(factura);
  setSelectedAfiliadoAdeudos({
    id_usuario_afi:  factura.id_usuario_afi,
    id_medidor:     factura.id_medidor,
    cod_usuario_afi: factura.cod_usuario_afi,
    nombre_completo: factura.nombre_completo,
    cedula:          factura.cedula,
    num_medidor:     factura.num_medidor,
    nombre_sector:   factura.nombre_sector,
    telefono:        factura.telefono,
    email:           factura.email,
    direccion:       factura.direccion,
  });

  setShowAdeudosModal(true);
};

const closeAdeudosModal = () => {
  setShowAdeudosModal(false);
  setSelectedFacturaAdeudos(null);
  setSelectedAfiliadoAdeudos(null);
  setFacturasSeleccionadasPago([]);
  setResumenPago(null); // ✅ Limpiar resumen
  closePagoMultipleModal();
};

const closePagoMultipleModal = () => {
  setShowPagoMultipleModal(false);
};


  // ============================================================
  // FUNCIONES DE ABRIR MODAL DE PAGO
  // ============================================================

  /**
  * Función para abrir modal de pago CON factura específica
  */
  const openPaymentModal = async (factura) => {
    if (!permissions.canCreate) {
      alert('No tienes permiso para registrar pagos');
      return;
    }

    setLoadingResumen(true);
    
    try {
      const saldoPendiente = calcularSaldoPendiente(factura);
      const idAfiliado = factura.id_usuario_afi 
        ?? factura.usuarioafiliado?.id_usuario_afi;
      if (!idAfiliado) throw new Error('No se pudo identificar el afiliado de la factura');

      const idMedidor = factura.id_medidor        ?? factura.usuarioafiliado?.num_medidor;
      if (!idMedidor) throw new Error('No se pudo identificar el medidor de la factura');

      //  1. Cargar todas las facturas pendientes del afiliado
      const facturasPendientes = await cargarFacturasPendientesAfiliado(idAfiliado, idMedidor);
      
      //  2. Calcular resumen con mora de la factura seleccionada
      const [resultado, resultDetalle] = await Promise.all([
        paymentsServices.calcularResumenPago(factura.id_factura),
        paymentsServices.getFacturaDetalle(factura.id_factura)
      ]);
      
      let facturaConDetalles = normalizarFacturaDetalle(
        resultDetalle.success ? resultDetalle.data : {}, 
        factura
      );
      
      // Variables para las facturas a pagar
      let facturasOrdenadas = [];
      let facturasSeleccionadas = [];
      let totalAdeudado = saldoPendiente;
      
      //  3. Procesar facturas pendientes si existen
      if (facturasPendientes && facturasPendientes.tiene_deuda && facturasPendientes.facturas.length > 0) {
        // Ordenar por fecha (más antiguas primero)
        facturasOrdenadas = facturasPendientes.facturas.sort((a, b) => 
          new Date(a.fecha_emision) - new Date(b.fecha_emision)
        );
        
        // Por defecto, seleccionar todas las facturas pendientes
        facturasSeleccionadas = facturasOrdenadas.map(f => f.id_factura);
        
        // Usar el total calculado por el backend (incluye mora)
        totalAdeudado = facturasPendientes.total_adeudado;
        
        console.log(' Facturas pendientes cargadas:', {
          total: facturasOrdenadas.length,
          meses_adeudo: facturasPendientes.meses_adeudo,
          total_adeudado: totalAdeudado
        });
      } else {
        // Si no hay facturas pendientes, solo usar la factura actual
        facturasOrdenadas = [{
          id_factura: factura.id_factura,
          num_factura: factura.num_factura,
          periodo: factura.periodo,
          fecha_emision: factura.fecha_emision,
          total_factura: parseFloat(factura.total),
          saldo_pendiente: saldoPendiente,
          mora_aplicable: false,
          mora_monto: 0,
          total_con_mora: saldoPendiente,
          estado_factura: factura.estado_factura
        }];
        
        facturasSeleccionadas = [factura.id_factura];
        totalAdeudado = saldoPendiente;
      }

      //  4. Validar y guardar resumen de pago
      if (resultado.success) {
        console.log(' Resumen de pago cargado:', resultado.data);
        setResumenPago(resultado.data);
      } else {
        console.error('❌ Error al cargar resumen:', resultado.message);
        setResumenPago(null);
      }

      setNuevoPago({
        id_factura: factura.id_factura,                  
        id_usuario_afi: idAfiliado,                        
        facturas_a_pagar: facturasSeleccionadas,           
        facturas_pendientes: facturasOrdenadas,           
        total_seleccionado: totalAdeudado,                 
        monto_pago: totalAdeudado.toFixed(2),            
        metodo_pago: 'EFECTIVO',
        observaciones: ''
      });

      setSelectedFactura(facturaConDetalles);
      setShowCreateModal(true);

    } catch (error) {
      console.error('❌ Error al abrir modal de pago:', error);
      alert('Error al cargar información de pago: ' + error.message);
      setResumenPago(null);
    } finally {
      setLoadingResumen(false);
    }
  };
  // Resetear selección cuando se abre el modal
  useEffect(() => {
    if (showCreateModal && resumenPago) {
      setItemsAPagar({
        consumos: true,
        multas: true,
        mora: true
      });
    }
  }, [showCreateModal, resumenPago]);


  /**
   * Calcular monto total de facturas seleccionadas
   */
  useEffect(() => {
    const calcularMontoTotal = () => {
      const idAfiliado = selectedFactura?.usuario_afiliado?.id_usuario_afi;
      const datos = facturasPendientesPorAfiliado[idAfiliado];
      
      let total = 0;
      
      // Sumar facturas pendientes seleccionadas
      if (datos && datos.facturas) {
        datos.facturas.forEach(f => {
          if (facturasSeleccionadas[f.id_factura]) {
            total += f.total_con_mora || 0;
          }
        });
      }
      
      // Sumar factura actual si está seleccionada
      if (selectedFactura && facturasSeleccionadas[selectedFactura.id_factura]) {
        const saldoActual = calcularSaldoPendiente(selectedFactura);
        const moraActual = resumenPago?.mora?.monto || 0;
        total += saldoActual + moraActual;
      }
      
      setMontoPagoMasivo(total);
    };
    
    calcularMontoTotal();
  }, [facturasSeleccionadas, facturasPendientesPorAfiliado, selectedFactura, resumenPago]);


  const closeCreateModal = () => {
    setShowCreateModal(false);
    setComprobanteFile(null);
    setSelectedFactura(null);
    setNuevoPago({
      id_factura: '',
      id_usuario_afi: '',
      monto_pago: '',
      metodo_pago: 'EFECTIVO',
      observaciones: ''
    });
  };

  // ============================================================
  // FUNCIÓN PARA CREAR PAGO 
  // ============================================================
  const handleCreatePago = async () => {
    // VALIDACIONES INICIALES
    const montoAPagar = roundMoney(calcularTotalAPagar());
    if (montoAPagar <= 0) {
      alert('Debe seleccionar al menos un item para pagar');
      return;
    }

    // Confirmación del pago
    let mensajeConfirmacion = `¿Confirma el pago de ${formatCurrency(montoAPagar)}?\n\nDesglose:\n`;
    
    if (itemsAPagar.consumos) {
      const consumoTotal = getSafeValue(resumenPago.totales.opcion_sin_multas?.total_final, 0) - 
                          getSafeValue(resumenPago.mora?.monto, 0);
      mensajeConfirmacion += `• Consumo: ${formatCurrency(consumoTotal)}\n`;
    }
    if (itemsAPagar.multas && resumenPago.multas?.tiene_multas) {
      mensajeConfirmacion += `• Multas: ${formatCurrency(resumenPago.multas.total_con_iva)}\n`;
    }
    if (itemsAPagar.mora && resumenPago.mora?.aplica) {
      mensajeConfirmacion += `• Mora: ${formatCurrency(resumenPago.mora.monto)}\n`;
    }

    if (!itemsAPagar.multas && resumenPago.multas?.tiene_multas) {
      mensajeConfirmacion += `\n⚠️ Las multas (${formatCurrency(resumenPago.multas.total_con_iva)}) quedarán pendientes.`;
    }

    const confirmar = window.confirm(mensajeConfirmacion);
    if (!confirmar) return;

    setLoading(true);
    setError(null);

    try {
      const currentUser = authService.getCurrentUser();
          // ✅ Después — acepta cualquiera de los dos formatos
    const idCajero = parseInt(
      currentUser?.id_usuario_sistema ?? currentUser?.idusuariosistema ?? 0, 10
    );
    if (!idCajero || isNaN(idCajero)) {
      throw new Error('No se pudo identificar al usuario actual');
    }

      // PREPARAR DATOS DEL PAGO
      const pagoData = {
        id_factura: nuevoPago.id_factura ? parseInt(nuevoPago.id_factura) : null,
        monto_pago: montoAPagar,
        metodo_pago: nuevoPago.metodo_pago || 'EFECTIVO',
        id_usuario_afi: nuevoPago.id_usuario_afi ? parseInt(nuevoPago.id_usuario_afi) : null,
        id_cajero: idCajero,
        observaciones: nuevoPago.observaciones || null,
        incluir_multas: itemsAPagar.multas,
        incluir_mora: itemsAPagar.mora,
        incluir_consumos: itemsAPagar.consumos
      };

      console.log('💰 Registrando pago...', pagoData);

      // 🚀 PASO 1: CREAR EL PAGO (operación crítica)
      const result = await paymentsServices.createPago(pagoData);
      
      if (!result.success) {
        throw new Error(result.message || 'Error al crear el pago');
      }

      const pagoCreado = result.data;
      console.log('✅ Pago registrado:', pagoCreado.id_pago);

      // ✅ CALCULAR CORRECTAMENTE considerando pagos ANTERIORES
      const montoPagadoAnterior = parseFloat(selectedFactura.monto_pagado) || 0;
      const nuevoMontoPagado = montoPagadoAnterior + montoAPagar;
      const totalFactura = parseFloat(selectedFactura.total) || 0;
      const nuevoSaldoPendiente = Math.max(0, totalFactura - nuevoMontoPagado);
      
      // Determinar estado correcto
      const estadoReal = nuevoSaldoPendiente <= 0.01 ? 'pagada' : 
                        nuevoMontoPagado > 0 ? 'parcial' : 
                        selectedFactura.estado_factura;

      console.log('📊 Cálculo optimista:', {
        total_factura: totalFactura,
        pagado_anterior: montoPagadoAnterior,
        pago_nuevo: montoAPagar,
        nuevo_total_pagado: nuevoMontoPagado,
        nuevo_saldo: nuevoSaldoPendiente,
        nuevo_estado: estadoReal
      });

      // Crear factura actualizada con los valores correctos
      const facturaOptimista = {
        ...selectedFactura,
        estado_factura: estadoReal,
        saldo_pendiente: nuevoSaldoPendiente,
        monto_pagado: nuevoMontoPagado,
        esta_totalmente_pagada: nuevoSaldoPendiente <= 0.01,
        // Agregar el nuevo pago a la lista de pagos
        pagos: [
          ...(selectedFactura.pagos || []),
          {
            id_pago: pagoCreado.id_pago,
            monto_pago: montoAPagar,
            fecha_pago: new Date().toISOString(),
            metodo_pago: pagoData.metodo_pago,
            estado_pago: 'REGISTRADO',
            cajero: currentUser.nombre_completo || 'Usuario actual',
            observaciones: pagoData.observaciones
          }
        ],
        cantidad_pagos: (selectedFactura.cantidad_pagos || 0) + 1
      };

      // ✅ Actualizar UI inmediatamente
      setFacturas(prev => prev.map(f => 
        f.id_factura === selectedFactura.id_factura ? facturaOptimista : f
      ));

      // Cerrar modal inmediatamente
      closeCreateModal();
      
      // Mostrar mensaje de éxito
      let mensaje = `✅ Pago registrado exitosamente\n\n`;
      mensaje += `💵 Monto: ${formatCurrency(montoAPagar)}\n`;
      mensaje += `💳 Método: ${pagoData.metodo_pago}\n`;
      mensaje += `📊 Estado: ${estadoReal.toUpperCase()}\n`;
      mensaje += `💰 Total pagado: ${formatCurrency(nuevoMontoPagado)} de ${formatCurrency(totalFactura)}\n`;
      mensaje += `💰 Saldo pendiente: ${formatCurrency(nuevoSaldoPendiente)}`;
      
      if (!itemsAPagar.multas && resumenPago.multas?.tiene_multas) {
        mensaje += `\n\n⚠️ Multas pendientes: ${formatCurrency(resumenPago.multas.total_con_iva)}`;
      }

      alert(mensaje);

      // 🔄 OPERACIONES EN SEGUNDO PLANO (no bloquean UI)
      (async () => {
        try {
        // Generar y guardar PDF
        await (async () => {
          try {
            console.log('📄 Generando comprobante PDF...');
            const pdfFile = await generatePaymentPDF(pagoCreado, facturaOptimista);
            
            if (pdfFile && pdfFile.size > 0) {
              console.log('☁️ Subiendo comprobante...');
              await paymentsServices.uploadComprobante(pagoCreado.id_pago, pdfFile);
              console.log('✅ Comprobante guardado');
            }
          } catch (pdfError) {
            console.error('⚠️ Error con comprobante:', pdfError);
            // No mostramos error al usuario, el pago ya se registró
          }
        })();
        
        // Recargar datos del servidor (verificar valores reales)
        await (async () => {
          try {
            console.log('🔄 Recargando datos del servidor...');
            await fetchFacturasPeriodo();
            await fetchStats();
            
            // Limpiar caché de adeudos
            const idAfiliado = selectedFactura.usuario_afiliado?.id_usuario_afi;
            const idMedidor = selectedFactura.id_medidor;
            if (idAfiliado && idMedidor ) {
              const periodoStr = `${periodoSeleccionado.anio}-${String(periodoSeleccionado.mes).padStart(2, '0')}`;
              const cacheKey = `${idAfiliado}-${idMedidor}-${periodoStr}`;
              if (facturasPendientesCache.current) {
                delete facturasPendientesCache.current[cacheKey];
              }
              setFacturasPendientesPorAfiliado(prev => {
                const { [`${idAfiliado}-${idMedidor}`]: _, ...rest } = prev;
                return rest;
              });
            }
            
            console.log('✅ Datos recargados del servidor');
          } catch (err) {
            console.error('⚠️ Error al recargar datos:', err);
          }
        })();
        console.log('Todas las operaciones completadas');
        } catch (backgroundError) {
          console.error('Error en operaciones en segundo plano:', backgroundError);
        }
      })();
        console.log('🎉 Todas las operaciones completadas');
      // Preparar datos para mostrar comprobante
      setPagoRegistrado(pagoCreado);
      setFacturaDelPago(facturaOptimista);
      
      // Mostrar comprobante después de un breve delay
      setTimeout(() => {
        setShowReceipt(true);
      }, 300);

    } catch (error) {
      console.error('❌ Error al registrar pago:', error);
      setError(error.message || 'Error al registrar el pago');
      alert(`Error al registrar pago:\n${error.message || 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // FUNCIONES DE ACCIONES
  // ============================================================

  /**
   * Anula un pago y regenera la factura
   */

  const handleAnularPagoConRegeneracion = async (factura) => {
    if (!permissions.canDelete) {
      alert('❌ No tienes permiso para anular pagos');
      return;
    }

    // ✅ Validar que haya pagos registrados
    const pagosRegistrados = factura.pagos?.filter(p => p.estado_pago === 'REGISTRADO') || [];

    if (pagosRegistrados.length === 0) {
      alert('❌ Esta factura no tiene pagos registrados para anular');
      return;
    }

    // ✅ Si hay múltiples pagos, obtener el último
    const pagoAAnular = pagosRegistrados[pagosRegistrados.length - 1];

    // 🔹 PRIMERA CONFIRMACIÓN: Anular el pago
    const confirmarAnulacion = window.confirm(
      `¿Estás seguro de anular el pago de la factura ${factura.num_factura}?\n\n` +
      `💵 Monto: ${formatCurrency(pagoAAnular.monto_pago)}\n` +
      `💳 Método: ${pagoAAnular.metodo_pago}\n` +
      `👤 Cajero: ${pagoAAnular.cajero || 'N/A'}\n` +
      `📅 Fecha: ${formatDate(pagoAAnular.fecha_pago)}`
    );

    if (!confirmarAnulacion) return;

    // 🔹 SEGUNDA CONFIRMACIÓN: Regenerar factura o solo anular
    const regenerarFactura = window.confirm(
      `¿Deseas REGENERAR una nueva factura?\n\n` +
      `✅ SÍ: Se creará una nueva factura con los mismos datos.\n` +
      `   - La factura original se marcará como ANULADA\n` +
      `   - Las multas volverán a estar PENDIENTES\n` +
      `   - Se generará una nueva factura en estado PENDIENTE\n\n` +
      `❌ NO: Solo se marcará la factura como ANULADA.\n` +
      `   - No se creará nueva factura\n` +
      `   - La factura quedará como ANULADA\n\n` +
      `¿Regenerar nueva factura?`
    );

    // Solicitar motivo
    const motivo = window.prompt(
      'Motivo de anulación (requerido):',
      'Anulación solicitada por cliente'
    );

    if (motivo === null) return;

    if (!motivo || !motivo.trim()) {
      alert('❌ Debes especificar un motivo de anulación');
      return;
    }

    setLoading(true);

    try {
      console.log('🔄 Anulando pago...');
      console.log(`   Regenerar factura: ${regenerarFactura ? 'SÍ' : 'NO'}`);

      // ✅ Llamar al servicio con el flag de regeneración
      const result = await paymentsServices.anularPagoConRegeneracion(
        pagoAAnular.id_pago,
        motivo.trim(),
        regenerarFactura  // 🔹 Pasar el flag
      );

      if (result.success) {
        let mensaje = '✅ Pago anulado correctamente\n\n';
        
        if (result.data.nueva_factura) {
          // Se regeneró la factura
          mensaje += `📄 Nueva factura generada: ${result.data.nueva_factura.num_factura}\n`;
          mensaje += `📅 Periodo: ${result.data.nueva_factura.periodo}\n`;
          mensaje += `💰 Total: ${formatCurrency(result.data.nueva_factura.total)}\n`;
          mensaje += `📊 Estado: ${result.data.nueva_factura.estado_factura.toUpperCase()}\n\n`;
          
          if (result.data.multas_reactivadas > 0) {
            mensaje += `🚨 ${result.data.multas_reactivadas} multa(s) reactivada(s) como PENDIENTES`;
          }
        } else {
          // Solo se anuló la factura
          mensaje += `📄 Factura ${result.data.factura_original.num_factura} marcada como ANULADA\n`;
          mensaje += `⚠️ No se generó nueva factura`;
        }
        
        alert(mensaje);

        closeModal();

        // Recargar datos
        await Promise.all([fetchFacturasPeriodo(), fetchStats()]);
        console.log('✅ Datos recargados');
      } else {
        alert(`❌ Error: ${result.message}`);
      }
    } catch (error) {
      console.error('❌ Error al anular pago:', error);
      alert(`❌ Error al anular pago: ${error.message || 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };


  // Función simplificada para descargar
  const descargarComprobante = async (idPago) => {
    const result = await paymentsServices.downloadComprobante(idPago);
    if (!result.success) {
      alert(`❌ ${result.message}`);
    }
  };

  const handlePagoMultiple = async () => {
    // ========== VALIDACIONES ==========
    if (facturasSeleccionadasPago.length < 2) {
      alert('Debe seleccionar al menos 2 facturas para pago múltiple');
      return;
    }

    if (facturasSeleccionadasPago.length > 5) {
      alert('No puede seleccionar más de 5 facturas para pago múltiple');
      return;
    }

    const totalAPagar = calcularTotalFacturasSeleccionadas();

    // Confirmación
    let mensaje = `¿Confirma el pago múltiple de ${formatCurrency(totalAPagar)}?\n\n`;
    mensaje += `Facturas a pagar:\n`;

    // Listar facturas seleccionadas
    facturasSeleccionadasPago.forEach((f, idx) => {
      const numFact = f.numfactura || f.num_factura || 'Sin número';
      const periodo = f.periodo || f.periodo_factura || 'Sin periodo';
      const monto = parseFloat(f.totalconmora || f.saldopendiente || f.totalfactura || 0);
      mensaje += `\n${idx + 1}. ${numFact} (${periodo}) - ${formatCurrency(monto)}`;
    });
    mensaje += `\nMétodo de pago: ${nuevoPago.metodo_pago}`;

    const confirmar = window.confirm(mensaje);
    if (!confirmar) return;

    setLoading(true);
    setError(null);

    try {
      const currentUser = authService.getCurrentUser();
      console.log('👤 currentUser completo:', JSON.stringify(currentUser));
      const idCajero = parseInt(
        currentUser?.id_usuario_sistema ?? currentUser?.idusuariosistema ?? 0,
        10
      );
      if (!idCajero || isNaN(idCajero)) {
        throw new Error('No se pudo identificar al usuario actual');
      }

      // PREPARAR DATOS PARA PAGO MÚLTIPLE
// ✅ FIX COMPLETO — nombres de campos corregidos
const pagoMultipleData = {
  facturas: facturasSeleccionadasPago.map(f => {
    const monto = parseFloat(
      f.totalconmora ?? f.saldopendiente ?? f.totalfactura ?? f.total ?? 0
    );
    return {
      id_factura:       parseInt(f.idfactura ?? f.id_factura, 10),
      monto_a_pagar:    isNaN(monto) || monto <= 0 ? 0.01 : parseFloat(monto.toFixed(2)),
      incluir_multas:   true,
      incluir_mora:     true,
      incluir_consumos: true,
    };
  }),

  metodo_pago: (
    nuevoPago.metodo_pago ||    // ✅ nombre correcto del estado
    nuevoPago.metodopago ||     // fallback por si acaso
    'EFECTIVO'
  ).toUpperCase(),

  id_usuario_afi: selectedAfiliadoAdeudos
    ? parseInt(
        selectedAfiliadoAdeudos.idusuarioafi ??     // nombre del estado local
        selectedAfiliadoAdeudos.id_usuario_afi ??   // fallback
        0,
        10
      ) || null
    : null,

  // ✅ FIX PRINCIPAL — usar el campo correcto de currentUser
  id_cajero: idCajero,
  id_cajero_legacy: parseInt(
    currentUser?.id_usuario_sistema ??   // ← campo que SÍ existe (lo ves en el JSON del usuario)
    currentUser?.idusuariosistema ??     // fallback legacy
    0,
    10
  ) || null,

  observaciones: nuevoPago.observaciones || null,
};

// 🔍 Log para verificar (puedes quitarlo después)
console.log('📦 Payload pago múltiple:', JSON.stringify(pagoMultipleData, null, 2));
      console.log('💰 Procesando pago múltiple...', pagoMultipleData);

      // 🚀 PASO 1: CREAR EL PAGO (operación crítica)
      const result = await paymentsServices.createPagoMultiple(pagoMultipleData);

      if (!result.success) {
        throw new Error(result.message || 'Error al procesar pago múltiple');
      }

      const response = result.data;
      console.log('✅ Pago múltiple registrado:', response.pagos_creados);

      // ✅ ACTUALIZACIÓN OPTIMISTA - Actualizar facturas inmediatamente
      const facturasIds = facturasSeleccionadasPago.map(f => f.id_factura ?? f.idfactura);
      setFacturas(prev => prev.map(factura => {
        if (facturasIds.includes(factura.id_factura)) {
          // Marcar como pagada
          return {
            ...factura,
            estado_factura: 'pagada',
            saldo_pendiente: 0,
            monto_pagado: parseFloat(factura.total || 0),
            esta_totalmente_pagada: true,
            cantidad_pagos: (factura.cantidad_pagos || 0) + 1
          };
        }
        return factura;
      }));

      // ✅ CERRAR MODALES INMEDIATAMENTE
      setShowPagoMultipleModal(false);
      closeAdeudosModal();
      setFacturasSeleccionadasPago([]);

      // ✅ MENSAJE DE ÉXITO
      let mensajeExito = `✅ Pago múltiple registrado exitosamente\n\n`;
      mensajeExito += `💰 Total pagado: ${formatCurrency(response.total_pagado)}\n`;
      mensajeExito += `📋 Facturas procesadas: ${response.cantidad_facturas}\n`;
      mensajeExito += `✅ Pagadas completas: ${response.facturas_pagadas_completas?.length || 0}\n`;
      
      if (response.facturas_pagadas_parciales?.length > 0) {
        mensajeExito += `🔄 Pagadas parciales: ${response.facturas_pagadas_parciales.length}\n`;
      }
      
      if (response.detalle_mora_total > 0) {
        mensajeExito += `⏱️ Mora aplicada: ${formatCurrency(response.detalle_mora_total)}\n`;
      }

      mensajeExito += `\n💳 Método: ${pagoMultipleData.metodo_pago}`;

      alert(mensajeExito);

      // 🔄 OPERACIONES EN SEGUNDO PLANO
      Promise.all([
        // Generar y guardar PDF EN TODOS LOS PAGOS
        (async () => {
          try {
            console.log('📄 Generando comprobante múltiple...');
            
            // ✅ INCLUIR TODOS LOS IDs
            const comprobanteData = {
              id_pago: response.pagos_creados[0],  // ID principal
              ids_pagos: response.pagos_creados,   // ✅ TODOS LOS IDs
              monto_pago: parseFloat(response.total_pagado),
              fecha_pago: new Date().toISOString(),
              metodo_pago: pagoMultipleData.metodo_pago,
              cajero: currentUser.nombre_completo || 'Usuario actual',
              observaciones: pagoMultipleData.observaciones,
              cantidad_facturas: response.cantidad_facturas,
              facturas_pagadas_completas: response.facturas_pagadas_completas?.length || 0,
              detalle_mora_total: parseFloat(response.detalle_mora_total || 0)
            };

            const pdfFile = await generateMultiplePaymentPDF(
              comprobanteData,
              facturasSeleccionadasPago,
              selectedAfiliadoAdeudos
            );

            if (pdfFile && pdfFile.size > 0) {
              console.log(`☁️ Subiendo comprobante a ${response.pagos_creados.length} pagos...`);
              
              // ✅ SUBIR A TODOS LOS PAGOS
              const uploadPromises = response.pagos_creados.map(async (idPago) => {
                try {
                  await paymentsServices.uploadComprobante(idPago, pdfFile);
                  console.log(`✅ Comprobante guardado en pago ${idPago}`);
                  return { idPago, success: true };
                } catch (error) {
                  console.error(`❌ Error en pago ${idPago}:`, error);
                  return { idPago, success: false };
                }
              });

              const resultados = await Promise.all(uploadPromises);
              const exitosos = resultados.filter(r => r.success).length;
              console.log(`✅ Comprobantes guardados: ${exitosos}/${response.pagos_creados.length}`);
            }
          } catch (pdfError) {
            console.error('⚠️ Error con comprobante:', pdfError);
          }
        })(),


        // Recargar datos del servidor
        (async () => {
          try {
            console.log('🔄 Recargando datos del servidor...');
            await fetchFacturasPeriodo();
            await fetchStats();
            
            // Limpiar caché de adeudos
            const idAfiliado = selectedAfiliadoAdeudos.id_usuario_afi;
            const idMedidor = selectedAfiliadoAdeudos.id_medidor ?? selectedFacturaAdeudos?.id_medidor; 
            if (idAfiliado && idMedidor) {
              const periodoStr = `${periodoSeleccionado.anio}-${String(periodoSeleccionado.mes).padStart(2, '0')}`;
              const cacheKey = `${idAfiliado}-${idMedidor}-${periodoStr}`; 
              if (facturasPendientesCache.current) {
                delete facturasPendientesCache.current[cacheKey];
              }
              setFacturasPendientesPorAfiliado(prev => {
                const { [`${idAfiliado}-${idMedidor}`]: _, ...rest } = prev;
                return rest;
              });
            }
            
            console.log('✅ Datos recargados del servidor');
          } catch (err) {
            console.error('⚠️ Error al recargar datos:', err);
          }
        })()
      ]).then(() => {
        console.log('🎉 Todas las operaciones completadas');
      });

      // ✅ PREPARAR Y MOSTRAR COMPROBANTE
      const comprobanteDataModal = {
        id_pago: response.pagos_creados[0],
          ids_pagos: response.pagos_creados,   // ✅ TODOS LOS IDs
        monto_pago: parseFloat(response.total_pagado),
        fecha_pago: new Date().toISOString(),
        metodo_pago: pagoMultipleData.metodo_pago,
        cajero: currentUser.nombre_completo || 'Usuario actual',
        observaciones: pagoMultipleData.observaciones,
        cantidad_facturas: response.cantidad_facturas,
        facturas_pagadas_completas: response.facturas_pagadas_completas?.length || 0,
        detalle_mora_total: parseFloat(response.detalle_mora_total || 0)
      };

      // ✅ DESPUÉS — construir afiliado desde la factura actual (estructura plana)
      const facturaReferencia = facturasSeleccionadasPago[0] ?? selectedFacturaAdeudos;

      setMultipleReceiptData({
        pagoMultiple: comprobanteDataModal,
        facturas: facturasSeleccionadasPago,
        afiliado: {
          // Intentar desde selectedAfiliadoAdeudos primero (ya corregido antes)
          // con fallback a la factura de referencia
          id_usuario_afi:  selectedAfiliadoAdeudos?.id_usuario_afi  ?? facturaReferencia?.id_usuario_afi,
          cod_usuario_afi: selectedAfiliadoAdeudos?.cod_usuario_afi ?? facturaReferencia?.cod_usuario_afi,
          nombre_completo: selectedAfiliadoAdeudos?.nombre_completo ?? facturaReferencia?.nombre_completo,
          cedula:          selectedAfiliadoAdeudos?.cedula          ?? facturaReferencia?.cedula,
          num_medidor:     selectedAfiliadoAdeudos?.num_medidor     ?? facturaReferencia?.num_medidor,
          nombre_sector:   selectedAfiliadoAdeudos?.nombre_sector   ?? facturaReferencia?.nombre_sector,
          telefono:        selectedAfiliadoAdeudos?.telefono        ?? facturaReferencia?.telefono,
          email:           selectedAfiliadoAdeudos?.email           ?? facturaReferencia?.email,
          direccion:       selectedAfiliadoAdeudos?.direccion       ?? facturaReferencia?.direccion,
        }
      });


      // Mostrar comprobante después de un breve delay
      setTimeout(() => {
        setShowMultipleReceiptModal(true);
      }, 300);

    } catch (error) {
      console.error('❌ Error al procesar pago múltiple:', error);
      setError(error.message || 'Error al procesar pago múltiple');
      alert(`Error al procesar pago múltiple:\n${error.message || 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // HELPER FUNCTIONS
  // ============================================================
  const getStatusBadge = (estado) => {
    const configs = {
      REGISTRADO: { icon: CheckCircle, texto: 'Registrado', class: 'pagada' },
      ANULADO: { icon: Ban, texto: 'Anulado', class: 'anulada' },
      PENDIENTE: { icon: Clock, texto: 'Pendiente', class: 'pendiente' }
    };

    const config = configs[estado] || configs.REGISTRADO;
    const IconComponent = config.icon;

    return (
      <span className={`status-badge ${config.class}`}>
        <IconComponent />
        {config.texto}
      </span>
    );
  };

  const getMetodoIcon = (metodo) => {
    switch(metodo) {
      case 'EFECTIVO':
        return <DollarSign className="w-4 h-4" />;
      case 'TRANSFERENCIA':
        return <Wallet className="w-4 h-4" />;
      case 'TARJETA':
        return <CreditCard className="w-4 h-4" />;
      default:
        return <DollarSign className="w-4 h-4" />;
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  // 🔒 Parser seguro para fechas sin bug de zona horaria
  const parseLocalDate = (dateString) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [year, month, day] = dateString.split('-');
      return new Date(year, month - 1, day); // fecha LOCAL
    }
    return new Date(dateString);
  };

  // 📅 DD/MM/YYYY
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = parseLocalDate(dateString);
    return date.toLocaleDateString('es-EC', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  //  
  const formatDateShort = (dateString) => {
    if (!dateString) return '-';
    const date = parseLocalDate(dateString);
    return date.toLocaleDateString('es-EC', {
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
          <p>No tienes permiso para acceder al módulo de pagos.</p>
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
              <DollarSign className="w-7 h-7 text-blue-600" />
              <div>
                <h2>Gestión de Pagos</h2>
                <p className="section-subtitle">
                  Gestiona la información de los pagos
                </p>
              </div>
            </div>
          </div>

          {/* SECCIÓN 1: PERÍODOS RECIENTES */}
          <div className="periodo-selector-container">
            <div className="periodo-selector-header">
              <div>
                <h3>
                  <CalendarDays className="w-5 h-5 text-blue-600 mr-2" />
                  Períodos de Pagos
                </h3>
                <p className="periodo-selector-subtitle">
                  Selecciona el período para gestionar pagos
                </p>
              </div>
            </div>

            <div className="periodos-grid">
              {(() => {
                const hoy = new Date();
                const mesActual = hoy.getMonth() + 1;
                const anioActual = hoy.getFullYear();

                const calcularDiferenciaMeses = (mes, anio) =>
                  (anio - anioActual) * 12 + (mes - mesActual);

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
                  const tieneFacturas  = periodo.tiene_facturas;
                  const esMesActual    = periodo.mes === mesActual && periodo.anio === anioActual;
                  const pctCobrado     = periodo.porcentaje_cobrado   ?? 0;
                  //const pctPendiente   = periodo.porcentaje_pendiente ?? 0;
                  const todoCobrado    = pctCobrado >= 100;

                  return (
                    <button
                      key={`${periodo.mes}-${periodo.anio}`}
                      onClick={() => handlePeriodoChange(periodo.mes, periodo.anio)}
                      className={`periodo-card hoverable ${esMesActual ? 'mes-actual' : ''}`}
                    >
                      {/* CABECERA */}
                      <div className="periodo-card-header">
                        <span className="periodo-card-title">
                          {periodo.nombre_mes} {periodo.anio}
                        </span>
                        {esMesActual && (
                          <span className="periodo-badge-actual">Actual</span>
                        )}
                      </div>

                      {/* INFO PRINCIPAL / BARRA DE PROGRESO ÚNICA — Estilo Lectura */}
                      <div className="periodo-progress-container">
                        <div className="periodo-card-info">
                          {periodo.total_pagadas || 0} / {periodo.total_facturas || 0} facturas cobradas
                        </div>
                        <div className="periodo-progress-bar">
                          <div
                            className={`periodo-progress-fill ${todoCobrado ? 'complete' : ''}`}
                            style={{ width: `${pctCobrado}%` }}
                          />
                        </div>
                        <div className={`periodo-percentage ${todoCobrado ? 'complete' : ''}`}>
                          {Math.round(pctCobrado)}% recaudado
                        </div>
                      </div>                      {/* ACCIÓN */}
                      <div className="periodo-card-action">
                        <span>
                          {!tieneFacturas
                            ? 'Sin actividad'
                            : todoCobrado
                              ? 'Ver pagos ✓'
                              : 'Gestionar pagos'}
                        </span>
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
                <h3 className="font-semibold text-[16px] leading-[1.2] flex items-center">
                  <Clock className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0" />
                  Historial de Períodos
                </h3>
                <p className="periodo-historial-subtitle text-[14px]">
                  Períodos anteriores con pagos registrados
                </p>
                <br />
              </div>
            </div>
          
            {(() => {
              const hoy = new Date();
              const mesActual = hoy.getMonth() + 1;
              const anioActual = hoy.getFullYear();
          
              const calcularDiferenciaMeses = (mes, anio) =>
                (anio - anioActual) * 12 + (mes - mesActual);
          
              const periodosHistorial = periodos.filter(periodo => {
                const diff = calcularDiferenciaMeses(periodo.mes, periodo.anio);
                const tienePagos = periodo.tiene_pagos ?? (periodo.total_pagos > 0);
                return diff < -2 && tienePagos;
              });
          
              if (periodosHistorial.length === 0) {
                return (
                  <div className="periodo-historial-empty">
                    <AlertCircle className="w-12 h-12 text-gray-300 mb-2" />
                    <p>No hay períodos anteriores con pagos registrados</p>
                  </div>
                );
              }
          
              // Agrupar por año
              const agrupado = periodosHistorial.reduce((acc, periodo) => {
                if (!acc[periodo.anio]) acc[periodo.anio] = [];
                acc[periodo.anio].push(periodo);
                return acc;
              }, {});
          
              const aniosOrdenados = Object.keys(agrupado)
                .map(Number)
                .sort((a, b) => b - a);
          
              const nombresMeses = [
                '', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
                'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
              ];
          
              return (
                <div className="historial-anios-lista">
                  {aniosOrdenados.map(anio => {
                    const mesesDelAnio = agrupado[anio].sort((a, b) => b.mes - a.mes);
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
                              {mesesDelAnio.length} periodos
                            </span>
                          </span>
                          <ChevronDown
                            className={`w-4 h-4 historial-chevron ${estaExpandido ? 'open' : ''}`}
                          />
                        </button>
          
                        {/* CHIPS DE MESES */}
                        {estaExpandido && (
                          <div className="historial-meses-grid">
                            {mesesDelAnio.map(periodo => (
                              <button
                                key={`${periodo.mes}-${periodo.anio}`}
                                className="historial-mes-chip completo"
                                onClick={() => handlePeriodoChange(periodo.mes, periodo.anio)}
                                title={`${Math.round(periodo.porcentaje_cobrado ?? 0)}% recaudado (${periodo.total_pagos} pagos)`}
                              >
                                <span className="historial-mes-dot completo" />
                                <span className="historial-mes-nombre">
                                  {nombresMeses[periodo.mes]}
                                </span>
                                <span className="historial-mes-pct">
                                  {Math.round(periodo.porcentaje_cobrado ?? 0)}%
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
          
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ==================== PASO 2: GESTIÓN DE PAGOS DEL PERIODO ==================== */}
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
                <DollarSign className="w-7 h-7 text-green-600" />
                <div>
                  <h2>Pagos de {formatearPeriodo(periodoSeleccionado.mes, periodoSeleccionado.anio)}</h2>
                  <p className="section-subtitle">
                    Gestiona los pagos de este periodo
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ESTADÍSTICAS DEL PERIODO */}
          <div className="periodo-stats-container">
            <div className="periodo-stats-header">
              <TrendingUp className="w-5 h-5 text-green-600 mr-2" />
              <h3>Resumen del Periodo</h3>
            </div>

            {/* Estadísticas del periodo */}
            <div className="users-stats">
              {/* Facturas Totales */}
              <div className="stat-item">
                <FileText className="stat-icon text-blue-600" />
                <div>
                  <p className="stat-label">Total Facturas</p>
                  <p className="stat-value">{stats.total_facturas || 0}</p>
                  <p className="stat-detail">{stats.facturas_pendientes || 0} pendientes</p>
                </div>
              </div>

              {/* Facturas Pagadas */}
              <div className="stat-item">
                <CheckCircle className="stat-icon text-green-600" />
                <div>
                  <p className="stat-label">Facturas Pagadas</p>
                  <p className="stat-value">{stats.facturas_pagadas || 0}</p>
                  <p className="stat-detail">Completadas</p>
                </div>
              </div>

              {/* Facturas Anuladas */}
              <div className="stat-item">
                <Ban className="stat-icon text-red-600" />
                <div>
                  <p className="stat-label">Facturas Anuladas</p>
                  <p className="stat-value">{stats.facturas_anuladas || 0}</p>
                </div>
              </div>

              {/* Total Recaudado */}
              <div className="stat-item">
                <DollarSign className="stat-icon text-green-600" />
                <div>
                  <p className="stat-label">Total Recaudado</p>
                  <p className="stat-value">{formatCurrency(stats.total_recaudado || 0)}</p>
                  <p className="stat-detail">{stats.total_pagos_registrados || 0} pagos</p>
                </div>
              </div>

              {/* Efectivo */}
              <div className="stat-item">
                <DollarSign className="stat-icon text-blue-600" />
                <div>
                  <p className="stat-label">Efectivo</p>
                  <p className="stat-value">{formatCurrency(stats.total_efectivo || 0)}</p>
                </div>
              </div>

              {/* Transferencias */}
              <div className="stat-item">
                <Wallet className="stat-icon text-purple-600" />
                <div>
                  <p className="stat-label">Transferencias</p>
                  <p className="stat-value">{formatCurrency(stats.total_transferencia || 0)}</p>
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
                placeholder="Buscar por factura, afiliado, cédula, medidor..."
                className="search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="filters-right">
              {/*  FILTRO DE ESTADO DE FACTURA */}
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

              {/*  FILTRO DE MÉTODO DE PAGO */}
              <select
                className="filter-select"
                value={filterMetodo}
                onChange={(e) => setFilterMetodo(e.target.value)}
              >
                <option value="all">Todos los métodos</option>
                <option value="EFECTIVO">Efectivo</option>
                <option value="TRANSFERENCIA">Transferencia</option>
                <option value="TARJETA">Tarjeta</option>
              </select>

              {/* ORDENAMIENTO */}
              <select
                className="filter-select"
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
              >
                <option value="fecha">Ordenar por Fecha</option>
                <option value="monto">Ordenar por Monto</option>
                <option value="metodo">Ordenar por Método</option>
                <option value="estado">Ordenar por Estado</option>
              </select>

              <select
                className="filter-select page-size-select"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                title="Facturas por pagina"
              >
                {pageSizeOptions.map(size => (
                  <option key={size} value={size}>
                    {size} por pagina
                  </option>
                ))}
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
                  fetchFacturasPeriodo();
                  fetchStats();
                }} 
                title="Recargar"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {facturas.length > 100 && (
            <div className="payments-search-advice">
              <AlertCircle className="w-4 h-4" />
              <span>
                Hay {facturas.length} facturas cargadas en este periodo. Para listas grandes, busca por factura, medidor, codigo, afiliado o cedula y usa los filtros para encontrar el registro mas rapido.
              </span>
            </div>
          )}

          <div className="payments-list-summary">
            <span>
              Mostrando {showingFrom}-{showingTo} de {sortedFacturas.length} factura{sortedFacturas.length !== 1 ? 's' : ''}
            </span>
            {(searchTerm.trim() || filterStatus !== 'all' || filterMetodo !== 'all') && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => {
                  setSearchTerm('');
                  setFilterStatus('all');
                  setFilterMetodo('all');
                }}
              >
                Limpiar busqueda
              </button>
            )}
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
              <h3>Cargando pagos...</h3>
            </div>
          )}

         {/* LISTA DE FACTURAS */}
          {!loading && (
            <div className="payments-invoices-wrapper">
              {/*  CONTENEDOR DE SCROLL UNIFICADO */}
              <div className="payments-invoices-scroll-wrapper">
                <div className="payments-invoices-inner">
                  
                  {/* HEADER */}
                  <div className="payments-invoices-header">
                    <span>#</span>
                    <span><FileText className="w-4 h-4" /> Factura</span>
                    <span><Calendar className="w-4 h-4" /> Emisión</span>
                    <span><Gauge className="w-4 h-4" /> Medidor</span>
                    <span><IdCard className="w-4 h-4" /> Código</span>
                    <span><User className="w-4 h-4" /> Afiliado</span>
                    <span><Clock className="w-4 h-4" /> Meses Adeudo</span>
                    <span><DollarSign className="w-4 h-4" /> Total</span>
                    <span><DollarSign className="w-4 h-4" /> Saldo</span>
                    <span>Estado</span>
                    <span>Comprobante</span> 
                    <span>Acciones</span>
                  </div>

                  {/* BODY */}
                  <div className="payments-invoices-body">
                    {sortedFacturas.length > 0 ? (
                      paginatedFacturas.map((factura, index) => {

                        const saldoPendiente = calcularSaldoPendiente(factura);
                        const puedeRecibirPago = factura.estado_factura === 'pendiente' || factura.estado_factura === 'vencida';
                        const idAfiliado = factura.id_usuario_afi;
                        const idMedidor = factura.id_medidor;
                        const datosAdeudo = facturasPendientesPorAfiliado[`${idAfiliado}-${idMedidor}`]; // Clave única para cachear adeudos por afiliado+medidor 

                        const calcularAdeudoTotal = () => {
                          const adeudoAnterior = datosAdeudo?.total_adeudado || 0;
                          const saldoActual = saldoPendiente > 0 ? saldoPendiente : 0;
                          return adeudoAnterior + saldoActual;
                        };

                        const calcularMesesAdeudo = () => {
                          return datosAdeudo?.meses_adeudo || 0;
                        };

                        const adeudoTotal = calcularAdeudoTotal();
                        const mesesAdeudoTotal = calcularMesesAdeudo();

                        return (
                          <div
                            key={factura.id_factura}
                            className={`payments-invoices-item ${
                              factura.estado_factura === 'anulada' ? 'pmt-inv-anulada' :
                              factura.estado_factura === 'pagada'  ? 'pmt-inv-pagada'  :
                              factura.estado_factura === 'vencida' ? 'pmt-inv-vencida' : ''
                            }`}
                          >
                            {/* Columna 1: # */}
                            <div className="pmt-inv-col-index">
                              <span className="pmt-inv-index-badge">{pageStartIndex + index + 1}</span>
                            </div>

                            {/* Columna 2: Número Factura */}
                            <div className="pmt-inv-col-numero">
                              <div className="pmt-inv-numero-icon">
                                <FileText className="w-4 h-4" />
                              </div>
                              <span className="pmt-inv-numero-text">{factura.num_factura}</span>
                            </div>

                            {/* Columna 3: Fecha Emisión */}
                            <div className="pmt-inv-col-fecha">
                              <Calendar className="w-3 h-3" />
                              <span>{formatDateShort(factura.fecha_emision)}</span>
                            </div>

                            {/* Columna 4: Medidor */}
                            <div className="pmt-inv-col-medidor">
                              {factura.num_medidor ? (
                                <span className="pmt-inv-medidor-badge">
                                  <Gauge className="w-3 h-3" />
                                  {factura.num_medidor}
                                </span>
                              ) : (
                                <span className="pmt-inv-sin-dato">—</span>
                              )}
                            </div>

                            {/* Columna 5: Código Afiliado */}
                            <div className="pmt-inv-col-codigo">
                              {factura.cod_usuario_afi ?? '—'}
                            </div>

                            {/* Columna 6: Afiliado */}
                            <div className="pmt-inv-col-usuario">
                              {factura.nombre_completo ? (
                                <div className="pmt-inv-usuario-info">
                                  <span className="pmt-inv-usuario-nombre">
                                    {factura.nombre_completo}
                                  </span>
                                </div>
                              ) : (
                                <span className="pmt-inv-sin-dato">-</span>
                              )}
                            </div>

                            {/* Columna 7: Meses Adeudo */}
                            <div className="pmt-inv-col-meses-adeudo">
                              {(factura.estado_factura === 'pendiente' || factura.estado_factura === 'vencida') ? (
                                <span
                                  className={`pmt-meses-badge ${
                                    mesesAdeudoTotal === 0 ? 'normal' :       // sin deuda anterior
                                    mesesAdeudoTotal === 1 ? 'warning' :      // 1 mes anterior
                                    'urgente'                                  // 2+ meses anteriores
                                  }`}
                                  onClick={() => { if (mesesAdeudoTotal > 0) openAdeudosModal(factura, datosAdeudo); }}
                                  style={{ 
                                    cursor: mesesAdeudoTotal > 0 ? 'pointer' : 'default', 
                                    display: 'inline-flex', 
                                    alignItems: 'center', 
                                    gap: '6px' 
                                  }}
                                  title={
                                    mesesAdeudoTotal === 0 
                                      ? 'Al día - sin adeudos anteriores' 
                                      : `${mesesAdeudoTotal} mes(es) de adeudo anterior - Ver detalle`
                                  }
                                >
                                  <Eye className="w-3 h-3" />
                                  {mesesAdeudoTotal === 0 
                                    ? 'Al día' 
                                    : `${mesesAdeudoTotal}`}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </div>

                            {/* Columna 8: Total */}
                            <div className="pmt-inv-col-total">
                              <span className="pmt-inv-monto">{formatCurrency(factura.total)}</span>
                            </div>

                            {/* Columna 9: Saldo */}
                            <div className="pmt-inv-col-total">
                              <span className="pmt-inv-monto font-bold" style={{ color: saldoPendiente > 0 ? '#ef4444' : '#10b981' }}>
                                {formatCurrency(saldoPendiente)}
                              </span>
                            </div>

                            {/* Columna 10: Estado */}
                            <div className="pmt-inv-col-estado">
                              {getEstadoPagoBadge(factura)}
                            </div>

                            {/* Columna 11: Comprobante */}
                            <div className="pmt-inv-col-comprobante">
                              {factura.pagos && factura.pagos.length > 0 ? (
                                factura.pagos.some(p => p.tiene_comprobante) ? (
                                  <div className="pmt-comprobantes-container">
                                    {factura.pagos
                                      .filter(p => p.tiene_comprobante && p.estado_pago === 'REGISTRADO')
                                      .map((pago, idx) => (
                                        <button
                                          key={pago.id_pago}
                                          className="pmt-inv-btn pmt-inv-btn-edit"
                                          onClick={() => descargarComprobante(pago.id_pago)}
                                          title={`Descargar: ${pago.nombre_archivo || 'comprobante.pdf'}`}
                                        >
                                          <FileCheck className="w-4 h-4 text-green-600" />
                                          {factura.pagos.length > 1 && (
                                            <span className="text-xs ml-1">#{idx + 1}</span>
                                          )}
                                        </button>
                                      ))}
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400">Sin comprobante</span>
                                )
                              ) : (
                                <span className="text-xs text-gray-400">Sin pago</span>
                              )}
                            </div>

                            {/* Columna 12: Acciones */}
                            <div className="pmt-inv-col-acciones">
                              <button className="pmt-inv-btn pmt-inv-btn-view" onClick={() => openModal('view-factura', factura)} title="Ver factura y pagos">
                                <Eye className="w-4 h-4" />
                              </button>

                              {permissions.canCreate && puedeRecibirPago && saldoPendiente > 0 && (
                                <button
                                  className="pmt-inv-btn pmt-inv-btn-edit"
                                  onClick={() => openPaymentModal(factura)}
                                  title={`Registrar pago - Saldo: ${formatCurrency(saldoPendiente)} | Adeudo total: ${formatCurrency(adeudoTotal)}`}
                                  style={{ backgroundColor: '#10b981', color: 'white' }}
                                >
                                  <DollarSign className="w-4 h-4" />
                                </button>
                              )}

                              {permissions.canDelete &&
                                factura.estado_factura === 'pagada' &&
                                factura.pagos?.length > 0 &&
                                factura.pagos.some(p => p.estado_pago === 'REGISTRADO') && (
                                  <button
                                    className="pmt-inv-btn pmt-inv-btn-delete"
                                    onClick={() => handleAnularPagoConRegeneracion(factura)}
                                    title="Anular pago y regenerar factura"
                                    style={{ backgroundColor: '#ef4444', color: 'white' }}
                                  >
                                    <Ban className="w-4 h-4" />
                                  </button>
                                )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="payments-invoices-empty">
                        <FileText className="pmt-inv-empty-icon" />
                        <h3>No hay facturas en este periodo</h3>
                        <p>
                          {searchTerm || filterStatus !== 'all'
                            ? 'No se encontraron facturas con los criterios de búsqueda.'
                            : `No hay facturas para ${formatearPeriodo(periodoSeleccionado.mes, periodoSeleccionado.anio)}`}
                        </p>
                      </div>
                    )}
                  </div>

                </div>
              </div>

              {/* FOOTER */}
              {sortedFacturas.length > 0 && (
                <div className="payments-invoices-footer">
                  <button 
                    className="btn-secondary"
                    onClick={() => setPeriodoSeleccionado(null)}
                  >
                    <ArrowUpDown className="w-4 h-4 mr-2" style={{ transform: 'rotate(90deg)' }} />
                    Cambiar periodo
                  </button>
                  
                  <div className="payments-invoices-footer-stats">
                    <span>
                      Mostrando <strong>{showingFrom}-{showingTo}</strong> de <strong>{sortedFacturas.length}</strong> facturas
                    </span>
                    <span>
                      Total facturado: <strong>{formatCurrency(sortedFacturas.reduce((sum, f) => sum + parseFloat(f.total || 0), 0))}</strong>
                    </span>
                    <span>
                      Total cobrado: <strong className="text-green-600">{formatCurrency(sortedFacturas.reduce((sum, f) => sum + calcularTotalPagado(f), 0))}</strong>
                    </span>
                    <span>
                      Saldo pendiente: <strong className="text-red-600">{formatCurrency(sortedFacturas.reduce((sum, f) => sum + calcularSaldoPendiente(f), 0))}</strong>
                    </span>
                  </div>
                </div>
              )}

              {sortedFacturas.length > 0 && (
                <div className="payments-pagination-controls">
                  <button
                    type="button"
                    className="pagination-btn"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={normalizedCurrentPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Anterior
                  </button>

                  <span className="pagination-status">
                    Pagina {normalizedCurrentPage} de {totalPages}
                  </span>

                  <button
                    type="button"
                    className="pagination-btn"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={normalizedCurrentPage === totalPages}
                  >
                    Siguiente
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
      )}
      
      {/* MODAL DE DETALLE FACTURA CON PAGOS */}
      {showModal && modalType === 'view-factura' && selectedPago && (
        <div className="modal-overlay">
          <div className="modal modal-factura">
            <div className="modal-header">
              <h3>
                <FileText className="w-5 h-5 inline mr-2" />
                Detalle de Factura {selectedPago.num_factura}
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
                <br/> 

                <div className="user-details">
                  <div className="detail-group">
                    <label>Número de Factura</label>
                    <p className="font-mono font-semibold">{selectedPago.num_factura}</p>
                  </div>
                  <div className="detail-group">
                    <label>Fecha de Emisión</label>
                    <p>{formatDateShort(selectedPago.fecha_emision)}</p>
                  </div>
                  
                  <div className="detail-group">
                    <label>Total Factura</label>
                    <p className="font-bold text-xl text-blue-600">
                      {formatCurrency(selectedPago.total)}
                    </p>
                  </div>
                  <div className="detail-group">
                    <label>Estado</label>
                    {getEstadoPagoBadge(selectedPago)}
                  </div>
                </div>
              </div>

              {/* SECCIÓN DE AFILIADO  */}
              {(selectedPago.nombre_completo || selectedPago.cod_usuario_afi) && (
                <div className="factura-section">
                  <br />
                  <h4 className="section-title">
                    <User className="w-4 h-4" />
                    Datos del Afiliado
                  </h4>
                  <br />
                  <div className="user-details">

                    <div className="detail-group form-group-full">
                      <label>Nombre Afiliado:</label>
                      <p>
                        {selectedPago.nombre_completo || 'N/A'}
                        {selectedPago.cedula ? ` - ${selectedPago.cedula}` : ''}
                      </p>
                    </div>

                    <div className="detail-group">
                      <label>Código Afiliado:</label>
                      <p className="font-mono">
                        {selectedPago.cod_usuario_afi || 'N/A'}
                      </p>
                    </div>

                    <div className="detail-group">
                      <label>Número de Medidor:</label>
                      <p className="font-mono font-semibold text-green-600">
                        {selectedPago.num_medidor || 'N/A'}
                      </p>
                    </div>

                    {selectedPago.direccion && (
                      <div className="detail-group">
                        <label>Dirección:</label>
                        <p>{selectedPago.direccion}</p>
                      </div>
                    )}

                    {selectedPago.nombre_sector && (
                      <div className="detail-group form-group-full">
                        <label>Sector:</label>
                        <p>{selectedPago.nombre_sector}</p>
                      </div>
                    )}

                    {selectedPago.telefono && (
                      <div className="detail-group">
                        <label>Teléfono:</label>
                        <p>{selectedPago.telefono}</p>
                      </div>
                    )}

                    {selectedPago.email && (
                      <div className="detail-group">
                        <label>Email:</label>
                        <p>{selectedPago.email}</p>
                      </div>
                    )}

                  </div>
                  <br />
                  <h4 className="section-title">
                    <FileText className="w-4 h-4" />
                    Conceptos de Facturación ({normalizarDetallesFactura(selectedPago.detalles).length})
                  </h4>
                </div>
              )}

              {/* Sección de CONCEPTOS DE FACTURACIÓN */}
              {normalizarDetallesFactura(selectedPago.detalles).length > 0 && (
                <div className="factura-section">
                  
                  <br />
                  
                  <div className="pmt-detalles-agrupados">
                    {normalizarDetallesFactura(selectedPago.detalles).map((detalle, index) => {
                      const tipo = (detalle.tipo_detalle || 'otros').toLowerCase();
                      const descripcion = (detalle.descripcion || '').toLowerCase();
                      
                      // Diferenciar entre consumo normal y exceso
                      let color = '#64748b'; // default otros
                      
                      if (tipo === 'multa') {
                        color = '#dc2626';
                      } else if (tipo === 'servicio' || tipo === 'cambio medidor') {
                        color = '#2563eb';
                      } else if (tipo === 'consumo') {
                        if (descripcion.includes('exceso')) {
                          color = '#ea580c'; // Naranja para exceso
                        } else {
                          color = '#059669'; // Verde para consumo normal
                        }
                      }

                      return (
                        <div
                          key={detalle.id_detalle || `concepto-visible-${index}`}
                          className="pmt-detalle-visible-item"
                          style={{ borderLeft: `4px solid ${color}`, background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', marginBottom: '10px', border: '1px solid #e5e7eb', borderLeftWidth: '4px' }}
                        >
                          <div style={{minWidth: 0}}>
                            <div style={{fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color, marginBottom: 4}}>
                              {detalle.tipo_detalle || 'concepto'} #{index + 1}
                            </div>
                            <div style={{fontSize: 14, lineHeight: 1.4, overflowWrap: 'anywhere'}}>
                              {detalle.descripcion || 'Concepto sin descripcion'}
                            </div>
                          </div>
                          <strong style={{fontSize: 15, color, whiteSpace: 'nowrap'}}>
                            {formatCurrency(getSafeValue(detalle.subtotal_detalle, 0))}
                          </strong>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {(() => {
                const ivaInfo = selectedPago.iva_info || selectedPago.iva_config || {};
                const pagosFactura = Array.isArray(selectedPago.pagos) ? selectedPago.pagos : [];
                const subtotal = getSafeValue(selectedPago.subtotal, 0);
                const descuento = getSafeValue(selectedPago.descuento, 0);
                const impuesto = getSafeValue(selectedPago.impuesto ?? ivaInfo.valor ?? ivaInfo.monto_factura, 0);
                const total = getSafeValue(selectedPago.total, 0);
                const montoPagado = getSafeValue(selectedPago.monto_pagado, 0);
                const saldoPendiente = getSafeValue(selectedPago.saldo_pendiente, Math.max(0, total - montoPagado));
                const porcentajeIVA = getSafeValue(ivaInfo.porcentaje ?? (getSafeValue(ivaInfo.tasa, 0) * 100), 0);
                const baseIVA = getSafeValue(ivaInfo.base_imponible, 0);
                const progresoPago = total > 0 ? Math.min(100, (montoPagado / total) * 100) : 0;
                const pagosRegistrados = pagosFactura.filter((pago) => (pago.estado_pago || '').toUpperCase() === 'REGISTRADO');

                return (
                  <div style={{display: 'flex', flexDirection: 'column', gap: 16, marginTop: 18, marginBottom: 18}}>
                    <div
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: 18,
                        background: '#ffffff',
                        border: '2px solid #7c3aed',
                        borderRadius: 10,
                        overflow: 'visible',
                        visibility: 'visible',
                        opacity: 1,
                        color: '#111827'
                      }}
                    >
                      <h4 style={{margin: '0 0 14px', fontSize: 16, fontWeight: 800, color: '#111827'}}>
                        IVA y Totales
                      </h4>
                      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 14}}>
                        <div style={{padding: 12, background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 8}}>
                          <div style={{fontSize: 12, fontWeight: 700, color: '#6b7280'}}>Configuracion IVA</div>
                          <div style={{fontSize: 15, fontWeight: 800, color: ivaInfo.es_aplicable ? '#047857' : '#6b7280'}}>
                            {ivaInfo.es_aplicable ? 'Activa' : 'No aplicable'} {porcentajeIVA > 0 ? `(${porcentajeIVA.toFixed(2)}%)` : ''}
                          </div>
                        </div>
                        <div style={{padding: 12, background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 8}}>
                          <div style={{fontSize: 12, fontWeight: 700, color: '#6b7280'}}>Base gravada</div>
                          <div style={{fontSize: 15, fontWeight: 800, color: '#111827'}}>{formatCurrency(baseIVA)}</div>
                        </div>
                        <div style={{padding: 12, background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 8}}>
                          <div style={{fontSize: 12, fontWeight: 700, color: '#6b7280'}}>IVA factura</div>
                          <div style={{fontSize: 15, fontWeight: 800, color: '#7c3aed'}}>{formatCurrency(impuesto)}</div>
                        </div>
                        <div style={{padding: 12, background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 8}}>
                          <div style={{fontSize: 12, fontWeight: 700, color: '#6b7280'}}>Conceptos gravados</div>
                          <div style={{fontSize: 15, fontWeight: 800, color: '#111827'}}>{ivaInfo.conceptos_gravados ?? 0}</div>
                        </div>
                      </div>
                      <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
                        {[
                          ['Subtotal', subtotal],
                          ['Descuento', -descuento],
                          ['IVA', impuesto],
                          ['Total factura', total],
                          ['Total pagado', montoPagado],
                          ['Saldo pendiente', saldoPendiente],
                        ].map(([label, value]) => (
                          <div key={label} style={{display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, padding: '8px 0', borderBottom: '1px solid #eef2f7'}}>
                            <span style={{fontSize: 14, color: '#374151', fontWeight: label === 'Total factura' ? 800 : 600}}>{label}</span>
                            <strong style={{fontSize: 14, color: value < 0 ? '#059669' : label === 'Saldo pendiente' && value > 0 ? '#dc2626' : '#111827'}}>
                              {formatCurrency(value)}
                            </strong>
                          </div>
                        ))}
                      </div>
                      <p style={{margin: '12px 0 0', fontSize: 12, lineHeight: 1.5, color: '#4b5563'}}>
                        {ivaInfo.regla || 'El IVA se aplica solo a servicios externos/adicionales; no a consumo de agua, multas, mora, aportes ni convenios.'}
                      </p>
                    </div>

                    <div
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: 18,
                        background: '#ffffff',
                        border: '2px solid #059669',
                        borderRadius: 10,
                        overflow: 'visible',
                        visibility: 'visible',
                        opacity: 1,
                        color: '#111827'
                      }}
                    >
                      <div style={{display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap'}}>
                        <h4 style={{margin: 0, fontSize: 16, fontWeight: 800, color: '#111827'}}>
                          Historial de Pagos ({pagosFactura.length})
                        </h4>
                        {permissions.canDelete && pagosRegistrados.length > 0 && (
                          <button
                            type="button"
                            onClick={() => handleAnularPagoConRegeneracion(selectedPago)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 8,
                              border: 0,
                              borderRadius: 8,
                              padding: '9px 12px',
                              background: '#dc2626',
                              color: '#ffffff',
                              fontWeight: 800,
                              cursor: 'pointer'
                            }}
                          >
                            <Ban className="w-4 h-4" />
                            Anular pago / regenerar
                          </button>
                        )}
                      </div>

                      {pagosFactura.length > 0 ? (
                        <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
                          {pagosFactura.map((pago, index) => {
                            const estado = (pago.estado_pago || 'REGISTRADO').toUpperCase();
                            const esAnulado = estado === 'ANULADO';
                            const cajero = pago.cajero || pago.usuario_cajero?.nombre_completo || pago.nombre_cajero || 'N/A';

                            return (
                              <div
                                key={pago.id_pago || `pago-visible-${index}`}
                                style={{
                                  padding: 14,
                                  background: esAnulado ? '#fef2f2' : '#f8fafc',
                                  border: `1px solid ${esAnulado ? '#fecaca' : '#e5e7eb'}`,
                                  borderLeft: `4px solid ${esAnulado ? '#dc2626' : '#059669'}`,
                                  borderRadius: 8,
                                  color: '#111827'
                                }}
                              >
                                <div style={{display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap'}}>
                                  <strong style={{fontSize: 15}}>Pago #{pago.id_pago || index + 1}</strong>
                                  <span style={{fontSize: 12, fontWeight: 800, color: esAnulado ? '#dc2626' : '#059669'}}>{estado}</span>
                                </div>
                                <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10}}>
                                  <div><span style={{fontSize: 12, color: '#6b7280', fontWeight: 700}}>Fecha</span><div style={{fontWeight: 700}}>{formatDate(pago.fecha_pago)}</div></div>
                                  <div><span style={{fontSize: 12, color: '#6b7280', fontWeight: 700}}>Monto</span><div style={{fontWeight: 800, color: '#059669'}}>{formatCurrency(pago.monto_pago)}</div></div>
                                  <div><span style={{fontSize: 12, color: '#6b7280', fontWeight: 700}}>Metodo</span><div style={{fontWeight: 700}}>{pago.metodo_pago || 'N/A'}</div></div>
                                  <div><span style={{fontSize: 12, color: '#6b7280', fontWeight: 700}}>Cajero</span><div style={{fontWeight: 700}}>{cajero}</div></div>
                                </div>
                                {pago.observaciones && (
                                  <div style={{marginTop: 10, padding: 10, background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13}}>
                                    <strong>Observaciones: </strong>{pago.observaciones}
                                  </div>
                                )}
                                {esAnulado && (pago.fecha_anulacion || pago.motivo_anulacion) && (
                                  <div style={{marginTop: 10, padding: 10, background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 8, fontSize: 13, color: '#991b1b'}}>
                                    <strong>Anulacion:</strong> {pago.fecha_anulacion ? formatDate(pago.fecha_anulacion) : ''}
                                    {pago.motivo_anulacion ? ` - ${pago.motivo_anulacion}` : ''}
                                  </div>
                                )}
                                <div style={{display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap'}}>
                                  {pago.tiene_comprobante ? (
                                    <button
                                      type="button"
                                      onClick={() => descargarComprobante(pago.id_pago)}
                                      title={pago.nombre_archivo || 'Descargar comprobante'}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        border: 0,
                                        borderRadius: 8,
                                        padding: '9px 12px',
                                        background: '#2563eb',
                                        color: '#ffffff',
                                        fontWeight: 800,
                                        cursor: 'pointer'
                                      }}
                                    >
                                      <FileCheck className="w-4 h-4" />
                                      Descargar comprobante
                                    </button>
                                  ) : (
                                    <span style={{fontSize: 13, color: '#6b7280', fontWeight: 700}}>Sin comprobante registrado</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}

                          <div style={{padding: 14, background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8}}>
                            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 10}}>
                              <div><span style={{fontSize: 12, color: '#047857', fontWeight: 700}}>Total factura</span><div style={{fontWeight: 800}}>{formatCurrency(total)}</div></div>
                              <div><span style={{fontSize: 12, color: '#047857', fontWeight: 700}}>Pagado</span><div style={{fontWeight: 800}}>{formatCurrency(montoPagado)}</div></div>
                              <div><span style={{fontSize: 12, color: '#047857', fontWeight: 700}}>Pendiente</span><div style={{fontWeight: 800}}>{formatCurrency(saldoPendiente)}</div></div>
                            </div>
                            <div style={{height: 10, background: '#d1fae5', borderRadius: 999, overflow: 'hidden'}}>
                              <div style={{height: '100%', width: `${progresoPago}%`, background: '#059669'}} />
                            </div>
                            <div style={{marginTop: 6, fontSize: 12, fontWeight: 800, color: '#047857'}}>{progresoPago.toFixed(1)}% pagado</div>
                          </div>
                        </div>
                      ) : (
                        <div style={{padding: 14, background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 8, color: '#6b7280', fontWeight: 700}}>
                          No hay pagos registrados para esta factura
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {false && selectedPago.detalles && selectedPago.detalles.length > 0 && (
                <div className="conceptos-section">
                  <h4 className="conceptos-section-title">
                    Conceptos ({selectedPago.detalles.length})
                  </h4>
                  <div className="pmt-detalles-agrupados">
                    {(() => {
                      const grupos = agruparDetallesPago(selectedPago.detalles);
                      const renderGrupo = (items, titulo, Icon, color) => {
                        if (!items.length) return null;

                        return (
                          <div className="pmt-detalle-grupo" style={{ borderTopColor: color }}>
                            <div className="pmt-detalle-grupo-header" style={{ backgroundColor: color }}>
                              <Icon className="w-4 h-4" />
                              <h5>{titulo} ({items.length})</h5>
                            </div>
                            <div className="pmt-detalles-lista-visible">
                              {items.map((detalle, idx) => {
                                const descripcion = detalle?.descripcion || detalle?.concepto || 'Concepto sin descripcion';
                                const subtotal = getSafeValue(
                                  detalle?.subtotal_detalle ?? detalle?.subtotal ?? detalle?.monto,
                                  0
                                );

                                return (
                                  <div
                                    key={detalle.id_detalle || detalle.id_detalle_factura || `${titulo}-${idx}`}
                                    className="pmt-detalle-visible-item"
                                  >
                                    <span className="pmt-detalle-visible-desc">{descripcion}</span>
                                    <span className="pmt-detalle-visible-precio">{formatCurrency(subtotal)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      };

                      return (
                        <>
                          {renderGrupo(grupos.consumo, 'Consumo de Agua', Droplets, '#059669')}
                          {renderGrupo(grupos.exceso, 'Exceso de Consumo', TrendingUp, '#ea580c')}
                          {renderGrupo(grupos.multas, 'Multas', AlertCircle, '#dc2626')}
                          {renderGrupo(grupos.servicios, 'Servicios', Wrench, '#2563eb')}
                          {renderGrupo(grupos.otros, 'Otros Conceptos', FileText, '#64748b')}
                        </>
                      );
                    })()}
                    
                    {/* TOTALES DE LA FACTURA */}
                    <div className="conceptos-totales">
                      <div className="conceptos-total-row">
                        <span>Subtotal:</span>
                        <span>{formatCurrency(selectedPago.subtotal)}</span>
                      </div>
                      
                      {parseFloat(selectedPago.descuento) > 0 && (
                        <div className="conceptos-total-row descuento">
                          <span>Descuento:</span>
                          <span className="text-green-600">
                            - {formatCurrency(selectedPago.descuento)}
                          </span>
                        </div>
                      )}
                      
                      {/* MOSTRAR IVA DINÁMICAMENTE */}
                      {(() => {
                        const ivaInfo = selectedPago.iva_info || {};
                        const porcentajeIVA = ivaInfo.porcentaje || 0;
                        const valorIVA = parseFloat(selectedPago.impuesto) || 0;
                        const esAplicable = ivaInfo.es_aplicable;
                        
                        if (esAplicable && valorIVA > 0) {
                          return (
                            <div className="conceptos-total-row">
                              <span>
                                {ivaInfo.descripcion || 'IVA'} ({porcentajeIVA.toFixed(1)}%):
                              </span>
                              <span>{formatCurrency(valorIVA)}</span>
                            </div>
                          );
                        } else if (valorIVA > 0) {
                          return (
                            <div className="conceptos-total-row">
                              <span>Impuesto (IVA):</span>
                              <span>{formatCurrency(valorIVA)}</span>
                            </div>
                          );
                        }
                        return null;
                      })()}
                      
                      <div className="conceptos-total-row total">
                        <span>Total:</span>
                        <span className="font-bold text-xl">
                          {formatCurrency(selectedPago.total)}
                        </span>
                      </div>
                      
                      {/* INFORMACIÓN ADICIONAL DEL IVA */}
                      {selectedPago.iva_info && selectedPago.iva_info.es_aplicable && (
                        <div className="conceptos-total-row info-adicional">
                          <span className="text-xs text-gray-500">
                            Base imponible: {formatCurrency(selectedPago.iva_info.base_imponible)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* SECCIÓN DE HISTORIAL DE PAGOS */}
              {(!selectedPago.detalles || selectedPago.detalles.length === 0) && (
                <div className="factura-section">
                  <div className="empty-state-small">
                    <AlertCircle className="w-8 h-8 text-gray-400" />
                    <p>No hay conceptos de facturacion registrados para esta factura</p>
                  </div>
                </div>
              )}

              {false && selectedPago.pagos && selectedPago.pagos.length > 0 && (
                <div className="historial-pagos-section">
                  <h4 className="historial-pagos-title">
                    <DollarSign className="w-4 h-4" />
                    Historial de Pagos ({selectedPago.pagos.length})
                  </h4>
                  <div className="historial-pagos-lista">
                    {selectedPago.pagos.map((pago, index) => (
                      <div 
                        key={pago.id_pago} 
                        className={`historial-pago-item ${pago.estado_pago === 'ANULADO' ? 'anulado' : ''}`}
                      >
                        {/* CABECERA DEL PAGO */}
                        <div className="historial-pago-header">
                          <div className="historial-pago-header-left">
                            <span className="historial-pago-numero">Pago #{pago.id_pago}</span>
                          </div>
                          {getStatusBadge(pago.estado_pago)}
                        </div>

                        {/* DETALLES DEL PAGO */}
                        <div className="historial-pago-detalles">
                          <div className="historial-pago-detalle">
                            <span className="historial-pago-label">
                              <Calendar className="w-3 h-3" /> Fecha
                            </span>
                            <span className="historial-pago-value">
                              {formatDate(pago.fecha_pago)}
                            </span>
                          </div>

                          <div className="historial-pago-detalle">
                            <span className="historial-pago-label">
                              <DollarSign className="w-3 h-3" /> Monto
                            </span>
                            <span className="historial-pago-value font-bold text-green-600">
                              {formatCurrency(pago.monto_pago)}
                            </span>
                          </div>

                          <div className="historial-pago-detalle">
                            <span className="historial-pago-label">
                              {getMetodoIcon(pago.metodo_pago)} Método
                            </span>
                            <span className="historial-pago-value">
                              {pago.metodo_pago}
                            </span>
                          </div>

                          {/* CAJERO */}
                          {pago.cajero && (
                            <div className="historial-pago-detalle">
                              <span className="historial-pago-label">
                                <User className="w-3 h-3" /> Cajero
                              </span>
                              <span className="historial-pago-value">
                                {pago.cajero}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* OBSERVACIONES */}
                        {pago.observaciones && (
                          <div className="historial-pago-observaciones">
                            <span className="historial-pago-obs-label">
                              <FileText className="w-3 h-3" /> Observaciones
                            </span>
                            <p className="historial-pago-obs-text">{pago.observaciones}</p>
                          </div>
                        )}

                        {/* INFORMACIÓN DE ANULACIÓN */}
                        {pago.estado_pago === 'ANULADO' && (
                          <div className="historial-pago-anulacion-info">
                            <div className="historial-anulacion-header">
                              <Ban className="w-4 h-4" />
                              <span>Pago Anulado</span>
                            </div>

                            {pago.fecha_anulacion && (
                              <div className="historial-anulacion-detalle">
                                <span className="historial-anulacion-label">Fecha de anulación</span>
                                <span className="historial-anulacion-value">
                                  {formatDate(pago.fecha_anulacion)}
                                </span>
                              </div>
                            )}

                            {pago.motivo_anulacion && (
                              <div className="historial-anulacion-detalle">
                                <span className="historial-anulacion-label">Motivo</span>
                                <span className="historial-anulacion-value">{pago.motivo_anulacion}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* BOTÓN DESCARGAR COMPROBANTE */}
                        {pago.tiene_comprobante && (
                          <div className="historial-pago-comprobante-btn">
                            <button
                              className="btn-secondary"
                              onClick={() => descargarComprobante(pago.id_pago)}
                              title={pago.nombre_archivo || 'Descargar comprobante'}
                            >
                              <FileCheck className="w-4 h-4 mr-2" />
                              Descargar Comprobante
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* RESUMEN DE PAGOS */}
                  <div className="historial-pagos-resumen">
                    <div className="resumen-header">
                      <TrendingUp className="w-4 h-4" />
                      <span>Resumen de Pago</span>
                    </div>
                    <div className="resumen-row">
                      <span>Total Factura</span>
                      <span className="font-bold">{formatCurrency(selectedPago.total)}</span>
                    </div>
                    <div className="resumen-row pagado">
                      <span>Total Pagado</span>
                      <span className="font-bold text-green-600">
                        {formatCurrency(selectedPago.monto_pagado)}
                      </span>
                    </div>
                    <div className="resumen-row total">
                      <span>Saldo Pendiente</span>
                      <span className={`font-bold ${selectedPago.saldo_pendiente > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(selectedPago.saldo_pendiente)}
                      </span>
                    </div>

                    {/* INDICADOR VISUAL DEL PROGRESO */}
                    <div className="historial-payment-progress">
                      <div className="historial-progress-bar">
                        <div 
                          className="historial-progress-fill" 
                          style={{ width: `${(selectedPago.monto_pagado / parseFloat(selectedPago.total)) * 100}%` }}
                        />
                      </div>
                      <span className="historial-progress-percentage">
                        {((selectedPago.monto_pagado / parseFloat(selectedPago.total)) * 100).toFixed(1)}% pagado
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* MENSAJE SI NO HAY PAGOS */}
              {false && (!selectedPago.pagos || selectedPago.pagos.length === 0) && (
                <div className="factura-section">
                  <div className="empty-state-small">
                    <AlertCircle className="w-8 h-8 text-gray-400" />
                    <p>No hay pagos registrados para esta factura</p>
                  </div>
                </div>
              )}

            </div>
    

            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeModal}>
                <X className="w-5 h-5" />
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PARA CREAR PAGO  */}
      {showCreateModal && selectedFactura && (
        <div className="modal-overlay">
          <div className="modal modal-payment">

            {/* ── HEADER ── */}
            <div className="modal-header">
              <h3>
                <Plus className="w-5 h-5 inline mr-2" />
                Registrar Pago — {selectedFactura.num_factura}
              </h3>
              <button className="modal-close" onClick={closeCreateModal}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ── BODY ── */}
            <div className="modal-body">

              {/* Datos del afiliado */}
              <div className="form-grid" style={{ marginBottom: '1.25rem' }}>
                <div className="form-group">
                  <label>Afiliado</label>
                  <p style={{ margin: 0, fontWeight: 600, color: '#1f2937', fontSize: '0.95rem' }}>
                    {selectedFactura.nombre_completo || '—'}
                  </p>
                </div>
                <div className="form-group">
                  <label>Cédula</label>
                  <p style={{ margin: 0, fontWeight: 600, color: '#1f2937', fontSize: '0.95rem' }}>
                    {selectedFactura.cedula || '—'}
                  </p>
                </div>
                <div className="form-group">
                  <label>Periodo</label>
                  <p style={{ margin: 0, fontWeight: 600, color: '#1f2937', fontSize: '0.95rem' }}>
                    {selectedFactura.periodo || '—'}
                  </p>
                </div>
                <div className="form-group">
                  <label>Número de factura</label>
                  <p style={{ margin: 0, fontWeight: 600, color: '#1f2937', fontSize: '0.95rem',
                              fontFamily: 'monospace' }}>
                    {selectedFactura.num_factura || '—'}
                  </p>
                </div>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '0 0 1.25rem' }} />

              {/* Loading */}
              {loadingResumen && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                              justifyContent: 'center', padding: '2.5rem 0', gap: '0.75rem',
                              color: '#6b7280' }}>
                  <RefreshCw className="w-8 h-8 animate-spin" style={{ color: '#3b82f6' }} />
                  <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                    Calculando desglose del pago…
                  </span>
                </div>
              )}

              {/* Sin resumen */}
              {!loadingResumen && !resumenPago && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem',
                              padding: '0.75rem 1rem', background: '#fee2e2', borderRadius: '0.5rem',
                              color: '#991b1b', fontSize: '0.875rem', fontWeight: 600,
                              marginBottom: '1rem' }}>
                  <AlertCircle className="w-4 h-4" style={{ flexShrink: 0 }} />
                  No se pudo cargar el desglose. Intenta recargar.
                </div>
              )}

              {/* ── CONTENIDO PRINCIPAL ── */}
              {!loadingResumen && resumenPago && (() => {

                const moraMonto   = getSafeValue(resumenPago.mora?.monto, 0);
                const tieneMora   = resumenPago.mora?.aplica && moraMonto > 0;
                const tieneMultas = resumenPago.multas?.tiene_multas;
                const multasTotal = getSafeValue(resumenPago.multas?.total_con_iva, 0);
                const consumoTotal = Math.max(
                  0,
                  getSafeValue(resumenPago.totales?.opcion_sin_multas?.total_final, 0) - moraMonto
                );
                const detallesConsumo = normalizarDetallesFactura(
                  selectedFactura?.detalles || []
                ).filter(d => (d.tipo_detalle || '').toLowerCase() !== 'multa');

                return (
                  <>
                    {/* ── ITEMS A PAGAR ── */}
                    <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center',
                                    justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <label style={{ marginBottom: 0 }}>Items a pagar</label>
                        <button
                          type="button"
                          style={{ fontSize: '0.8rem', fontWeight: 600, color: '#3b82f6',
                                  background: '#eff6ff', border: '1px solid #bfdbfe',
                                  borderRadius: '0.375rem', padding: '3px 10px', cursor: 'pointer' }}
                          onClick={() => {
                            const allOn =
                              (consumoTotal <= 0 || itemsAPagar.consumos) &&
                              (!tieneMultas    || itemsAPagar.multas) &&
                              (!tieneMora      || itemsAPagar.mora);
                            setItemsAPagar({
                              consumos: consumoTotal > 0 ? !allOn : false,
                              multas:   tieneMultas      ? !allOn : false,
                              mora:     tieneMora        ? !allOn : false,
                            });
                          }}
                        >
                          {(() => {
                            const allOn =
                              (consumoTotal <= 0 || itemsAPagar.consumos) &&
                              (!tieneMultas    || itemsAPagar.multas) &&
                              (!tieneMora      || itemsAPagar.mora);
                            return allOn ? '☑ Deseleccionar todo' : '☐ Seleccionar todo';
                          })()}
                        </button>
                      </div>

                      <div className="pmt-items-wrap">

                        {/* Consumo */}
                        {consumoTotal > 0 && (
                          <div
                            className={`pmt-item ${itemsAPagar.consumos ? 'pmt-item-checked' : ''}`}
                            onClick={() => setItemsAPagar(p => ({ ...p, consumos: !p.consumos }))}
                          >
                            <input
                              type="checkbox"
                              className="pmt-item-cb"
                              checked={itemsAPagar.consumos}
                              onChange={e => setItemsAPagar(p => ({ ...p, consumos: e.target.checked }))}
                              onClick={e => e.stopPropagation()}
                            />
                            <div className="pmt-item-body">
                              <div className="pmt-item-top">
                                <span className="pmt-item-ico">💧</span>
                                <span className="pmt-item-name">Consumos y servicios</span>
                                <span className="pmt-item-amt" style={{ color: '#059669' }}>
                                  {formatCurrencySafe(consumoTotal)}
                                </span>
                              </div>
                              {detallesConsumo.length > 0 && (
                                <div className="pmt-item-rows">
                                  {detallesConsumo.slice(0, 3).map((d, i) => (
                                    <div key={i} className="pmt-item-row">
                                      <span>{d.descripcion}</span>
                                      <span className="pmt-item-row-val">
                                        {formatCurrencySafe(d.subtotal_detalle)}
                                      </span>
                                    </div>
                                  ))}
                                  {detallesConsumo.length > 3 && (
                                    <div className="pmt-item-row">
                                      <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                                        +{detallesConsumo.length - 3} concepto(s) más
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Multas */}
                        {tieneMultas && (
                          <div
                            className={`pmt-item ${itemsAPagar.multas ? 'pmt-item-checked' : ''}`}
                            onClick={() => setItemsAPagar(p => ({ ...p, multas: !p.multas }))}
                          >
                            <input
                              type="checkbox"
                              className="pmt-item-cb"
                              checked={itemsAPagar.multas}
                              onChange={e => setItemsAPagar(p => ({ ...p, multas: e.target.checked }))}
                              onClick={e => e.stopPropagation()}
                            />
                            <div className="pmt-item-body">
                              <div className="pmt-item-top">
                                <span className="pmt-item-ico">🚨</span>
                                <span className="pmt-item-name">
                                  Multas ({resumenPago.multas?.cantidad || 0})
                                </span>
                                <span className="pmt-item-amt" style={{ color: '#dc2626' }}>
                                  {formatCurrencySafe(multasTotal)}
                                </span>
                              </div>
                              {resumenPago.multas?.detalles?.length > 0 && (
                                <div className="pmt-item-rows">
                                  {resumenPago.multas.detalles.map((m, i) => (
                                    <div key={i} className="pmt-item-row">
                                      <span>{m.descripcion}</span>
                                      <span className="pmt-item-row-val">
                                        {formatCurrencySafe(m.subtotal)}
                                      </span>
                                    </div>
                                  ))}
                                  <div className="pmt-item-row" style={{ marginTop: 2 }}>
                                    <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                                      Subtotal: {formatCurrencySafe(resumenPago.multas?.subtotal_sin_iva)}
                                      {' · '}IVA: {formatCurrencySafe(resumenPago.multas?.iva)}
                                    </span>
                                  </div>
                                </div>
                              )}
                              {!itemsAPagar.multas && (
                                <span style={{ display: 'inline-block', marginTop: 6, fontSize: '0.75rem',
                                              fontWeight: 600, color: '#b45309', background: '#fef3c7',
                                              padding: '2px 8px', borderRadius: 4 }}>
                                  ⚠ Quedarán pendientes si no se incluyen
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Mora */}
                        {tieneMora && (
                          <div
                            className={`pmt-item ${itemsAPagar.mora ? 'pmt-item-checked' : ''}`}
                            onClick={() => setItemsAPagar(p => ({ ...p, mora: !p.mora }))}
                          >
                            <input
                              type="checkbox"
                              className="pmt-item-cb"
                              checked={itemsAPagar.mora}
                              onChange={e => setItemsAPagar(p => ({ ...p, mora: e.target.checked }))}
                              onClick={e => e.stopPropagation()}
                            />
                            <div className="pmt-item-body">
                              <div className="pmt-item-top">
                                <span className="pmt-item-ico">⏰</span>
                                <span className="pmt-item-name">Mora por pago tardío</span>
                                <span className="pmt-item-amt" style={{ color: '#d97706' }}>
                                  {formatCurrencySafe(moraMonto)}
                                </span>
                              </div>
                              <div className="pmt-item-rows">
                                <div className="pmt-item-row">
                                  <span>Días desde emisión</span>
                                  <span className="pmt-item-row-val">
                                    {getSafeValue(resumenPago.mora?.dias_transcurridos, 0)} días
                                  </span>
                                </div>
                                <div className="pmt-item-row">
                                  <span>Días de mora efectivos</span>
                                  <span className="pmt-item-row-val">
                                    {getSafeValue(resumenPago.mora?.dias_mora_efectivos, 0)} días
                                  </span>
                                </div>
                                {resumenPago.mora?.fecha_inicio_mora && (
                                  <div className="pmt-item-row">
                                    <span>Mora desde</span>
                                    <span className="pmt-item-row-val">
                                      {formatDateShort(resumenPago.mora.fecha_inicio_mora)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Sin items */}
                        {consumoTotal <= 0 && !tieneMultas && !tieneMora && (
                          <div style={{ padding: '1rem', color: '#94a3b8', fontSize: '0.875rem',
                                        textAlign: 'center' }}>
                            No hay conceptos pendientes para esta factura.
                          </div>
                        )}

                      </div>
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb',
                                margin: '0 0 1.25rem' }} />

                    {/* ── MÉTODO DE PAGO ── */}
                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                      <label>Método de pago *</label>
                      <div className="pmt-metodo-grid">
                        {[
                          { value: 'EFECTIVO',      label: 'Efectivo',      ico: '💵' },
                          { value: 'TRANSFERENCIA', label: 'Transferencia', ico: '🏦' },
                          { value: 'TARJETA',       label: 'Tarjeta',       ico: '💳' },
                        ].map(op => (
                          <button
                            key={op.value}
                            type="button"
                            className={`pmt-metodo-btn ${nuevoPago.metodo_pago === op.value ? 'pmt-metodo-btn-active' : ''}`}
                            onClick={() => setNuevoPago(p => ({ ...p, metodo_pago: op.value }))}
                          >
                            <span style={{ fontSize: 20, lineHeight: 1 }}>{op.ico}</span>
                            {op.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* ── OBSERVACIONES ── */}
                    <div className="form-group">
                      <label>Observaciones <span style={{ fontWeight: 400, color: '#9ca3af' }}>(opcional)</span></label>
                      <textarea
                        rows={3}
                        placeholder="Notas adicionales sobre este pago…"
                        value={nuevoPago.observaciones}
                        onChange={e => setNuevoPago(p => ({ ...p, observaciones: e.target.value }))}
                      />
                    </div>

                  </>
                );
              })()}
            </div>
            {/* fin modal-body */}

            {/* ── FOOTER ── */}
            <div className="modal-footer">
              {/* Total a pagar (izquierda) */}
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280',
                              textTransform: 'uppercase', letterSpacing: '0.4px',
                              display: 'block', marginBottom: 2 }}>
                  Total a pagar
                </span>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'monospace',
                              color: calcularTotalAPagar() > 0 ? '#1e40af' : '#94a3b8',
                              lineHeight: 1 }}>
                  {formatCurrency(calcularTotalAPagar())}
                </span>
                {!itemsAPagar.consumos && !itemsAPagar.multas && !itemsAPagar.mora && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4,
                                fontSize: '0.75rem', fontWeight: 600, color: '#d97706' }}>
                    <AlertCircle className="w-3 h-3" />
                    Selecciona al menos un item
                  </span>
                )}
              </div>

              {/* Botones (derecha) */}
              <button className="btn-secondary" onClick={closeCreateModal} disabled={loading}>
                <X className="w-4 h-4 mr-1" />
                Cancelar
              </button>

              <button
                className="btn-primary"
                onClick={handleCreatePago}
                disabled={
                  loading ||
                  (!itemsAPagar.consumos && !itemsAPagar.multas && !itemsAPagar.mora)
                }
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin mr-1" />
                    Procesando…
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Registrar pago
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL DE DESGLOSE DE ADEUDOS POR PERIODOS */}
      {showAdeudosModal && selectedFacturaAdeudos && selectedAfiliadoAdeudos && (
        <div className="modal-overlay">
          <div className="modal modal-adeudos-desglose" style={{ maxWidth: '1100px' }}>
            <div className="modal-header">
              <h3>
                <Clock className="w-5 h-5 inline mr-2" />
                Detalles de Adeudos por Periodo - {selectedAfiliadoAdeudos?.cod_usuario_afi ?? selectedFacturaAdeudos?.cod_usuario_afi} - {selectedAfiliadoAdeudos?.nombre_completo ?? selectedFacturaAdeudos?.nombre_completo ?? 'N/A'}
              </h3>
              <button className="modal-close" onClick={closeAdeudosModal}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="modal-body">
              {/* INFORMACIÓN DEL AFILIADO */}
              <div className="factura-section">
                <h4 className="section-title">
                  <User className="w-4 h-4" />
                  Información del Afiliado
                </h4>
                <br />
                <div className="user-details">

                  <div className="detail-group">
                    <label>Nombre</label>
                    <p>
                      {selectedAfiliadoAdeudos?.nombre_completo 
                        ?? selectedFacturaAdeudos?.nombre_completo 
                        ?? 'N/A'}
                    </p>
                  </div>

                  <div className="detail-group">
                    <label>Código Afiliado</label>
                    {/* ✅ Este ya era correcto */}
                    <p className="font-mono">
                      {selectedAfiliadoAdeudos?.cod_usuario_afi 
                        ?? selectedFacturaAdeudos?.cod_usuario_afi}
                    </p>
                  </div>

                  <div className="detail-group">
                    <label>Cédula</label>
                    <p>
                      {selectedAfiliadoAdeudos?.cedula 
                        ?? selectedFacturaAdeudos?.cedula 
                        ?? 'N/A'}
                    </p>
                  </div>

                  <div className="detail-group">
                    <label>Medidor</label>
                    <p className="font-mono">
                      {selectedAfiliadoAdeudos?.num_medidor 
                        ?? selectedFacturaAdeudos?.num_medidor 
                        ?? 'N/A'}
                    </p>
                  </div>

                  {(selectedAfiliadoAdeudos?.nombre_sector ?? selectedFacturaAdeudos?.nombre_sector) && (
                    <div className="detail-group">
                      <label>Sector</label>
                      <p>
                        {selectedAfiliadoAdeudos?.nombre_sector 
                          ?? selectedFacturaAdeudos?.nombre_sector}
                      </p>
                      <br />
                    </div>
                  )}

                </div>
              </div>
              
              {/* RESUMEN GENERAL CON DESGLOSE POR CONCEPTOS */}
              {(() => {
                // ─── DATOS BASE ───────────────────────────────────────────────────────────
                const datosAdeudo = facturasPendientesPorAfiliado[
                  `${selectedAfiliadoAdeudos?.id_usuario_afi}-${selectedAfiliadoAdeudos?.id_medidor}`
                ];

                // ─── PASO 1: días transcurridos ──────────────────────────────────────────
                const calcularDiasTranscurridos = (fechaEmision) => {
                  if (!fechaEmision || typeof fechaEmision !== 'string') return 0;
                  const partes = fechaEmision.split('-');
                  if (partes.length !== 3) return 0;
                  const [year, month, day] = partes.map(Number);
                  if (!year || !month || !day) return 0;
                  const emision = new Date(year, month - 1, day);
                  emision.setHours(0, 0, 0, 0);
                  const hoy = new Date();
                  hoy.setHours(0, 0, 0, 0);
                  return Math.floor((hoy - emision) / (1000 * 60 * 60 * 24));
                };

                // ─── PASO 2: facturas anteriores — usar campos snake_case directamente ────
                const facturasAnteriores = (datosAdeudo?.facturas || [])
                  .map(f => ({
                    // Guardar referencia original
                    ...f,
                    // Alias normalizados para el render (todos desde snake_case del back)
                    idfactura:      f.id_factura,
                    numfactura:     f.num_factura,
                    fechaemision:   f.fecha_emision,
                    estadofactura:  f.estado_factura,
                    saldopendiente: parseFloat(f.saldo_pendiente || 0),
                    totalconmora:   parseFloat(f.total_con_mora || 0),
                    consumom3:      f.consumo_m3 || 0,
                    esactual:       false,
                    // desglose ya viene correcto desde el back
                    desglose:       f.desglose || { consumo: {}, servicios: {}, multas: {} },
                    iva:            f.iva || { tasa: 0, porcentaje: 0 },
                    mora: {
                      diasmoraefectivos: f.mora?.dias_mora_efectivos || 0,
                      aplica:            f.mora?.aplica || false,
                      monto:             parseFloat(f.mora?.monto || 0),
                    },
                    dias_transcurridos: calcularDiasTranscurridos(f.fecha_emision),
                  }))
                  .sort((a, b) => new Date(a.fechaemision) - new Date(b.fechaemision));

                // ─── PASO 3: factura actual ───────────────────────────────────────────────
                const fechaEmisionActual = selectedFacturaAdeudos?.fecha_emision || '';
                const saldoActual        = parseFloat(calcularSaldoPendiente(selectedFacturaAdeudos) || 0);
                const moraMonto          = parseFloat(resumenPago?.mora?.monto || 0);

                // Desglose real de la factura actual desde resumenPago
                const consumoActualTotal   = parseFloat(resumenPago?.totales?.opcion_sin_multas?.total_final || 0) - moraMonto;
                const multasActualTotal    = parseFloat(resumenPago?.multas?.total_con_iva || 0);

                const facturaActualItem = {
                  idfactura:      selectedFacturaAdeudos?.id_factura,
                  numfactura:     selectedFacturaAdeudos?.num_factura,
                  periodo:        selectedFacturaAdeudos?.periodo,
                  fechaemision:   fechaEmisionActual,
                  totalfactura:   parseFloat(selectedFacturaAdeudos?.total || 0),
                  saldopendiente: saldoActual,
                  consumom3:      selectedFacturaAdeudos?.consumo_m3 || 0,
                  estadofactura:  selectedFacturaAdeudos?.estado_factura,
                  dias_transcurridos: calcularDiasTranscurridos(fechaEmisionActual),
                  esactual: true,
                  desglose: {
                    consumo:   { total: consumoActualTotal },
                    servicios: { total: 0 },
                    multas:    { cantidad: resumenPago?.multas?.cantidad || 0, total: multasActualTotal },
                  },
                  iva:  resumenPago?.iva || { tasa: 0, porcentaje: 0 },
                  mora: {
                    diasmoraefectivos: resumenPago?.mora?.dias_mora_efectivos || 0,
                    aplica:            resumenPago?.mora?.aplica || false,
                    monto:             moraMonto,
                  },
                  // ✅ total_con_mora de la factura actual = saldo + mora actual
                  totalconmora: saldoActual + moraMonto,
                };

                // ─── PASO 4: array final ──────────────────────────────────────────────────
                const todasLasFacturas = [...facturasAnteriores, facturaActualItem];

                // ─── PASO 5: totales coordinados ─────────────────────────────────────────
                // total_adeudado del back YA incluye mora de facturas anteriores
                const totalAnteriorConMora = parseFloat(datosAdeudo?.total_adeudado || 0);
                const totalActualConMora   = facturaActualItem.totalconmora;
                // ✅ Total real = suma de todas las facturas con mora incluida
                const totalGeneralReal     = todasLasFacturas.reduce(
                  (sum, f) => sum + parseFloat(f.totalconmora || 0), 0
                );

                // Desglose por conceptos (anterior + actual)
                const consumoAnterior   = parseFloat(datosAdeudo?.total_consumo || 0);
                const serviciosAnterior = parseFloat(datosAdeudo?.total_servicios || 0);
                const multasAnterior    = parseFloat(datosAdeudo?.total_multas || 0);
                const moraAnterior      = parseFloat(datosAdeudo?.total_mora || 0);

                const consumoActual2    = consumoActualTotal;
                const multasActual2     = multasActualTotal;
                const moraActual2       = moraMonto;

                const totalConsumo   = consumoAnterior + consumoActual2;
                const totalServicios = serviciosAnterior;
                const totalMultas    = multasAnterior + multasActual2;
                const totalMora      = moraAnterior + moraActual2;

                // ─── CÁLCULO TOTAL SELECCIONADAS ─────────────────────────────────────────
                const calcularTotalSeleccionadas = () =>
                  facturasSeleccionadasPago.reduce(
                    (sum, f) => sum + parseFloat(f.totalconmora || f.saldopendiente || 0), 0
                  );

                // ─── RENDER ──────────────────────────────────────────────────────────────
                return (
                  <div className="factura-section">

                    {/* ── RESUMEN GENERAL ── */}
                    <div style={{
                      backgroundColor: '#f9fafb',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '16px',
                      marginBottom: '20px'
                    }}>
                      <h4 className="section-title" style={{ marginBottom: '12px' }}>
                        <TrendingUp className="w-4 h-4" />
                        Resumen General
                      </h4>

                      {/* Cuadros de resumen */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
                        <div className="adeudo-stat">
                          <span className="adeudo-label">Periodos con Deuda</span>
                          <span className="adeudo-value urgente">
                            {todasLasFacturas.length}
                          </span>
                          <span className="text-xs text-gray-500">
                            {facturasAnteriores.length} anterior(es) + actual
                          </span>
                        </div>
                        <div className="adeudo-stat">
                          <span className="adeudo-label">Adeudo Anterior</span>
                          <span className="adeudo-value monto">
                            {formatCurrency(totalAnteriorConMora)}
                          </span>
                          <span className="text-xs text-gray-500">
                            {datosAdeudo?.total_facturas_pendientes || 0} facturas (con mora)
                          </span>
                        </div>
                        <div className="adeudo-stat">
                          <span className="adeudo-label">Factura Actual</span>
                          <span className="adeudo-value monto">
                            {formatCurrency(totalActualConMora)}
                          </span>
                          <span className="text-xs text-gray-500">
                            {selectedFacturaAdeudos?.periodo} (con mora)
                          </span>
                        </div>
                        <div className="adeudo-stat">
                          <span className="adeudo-label">TOTAL A PAGAR</span>
                          <span className="adeudo-value total">
                            {formatCurrency(totalGeneralReal)}
                          </span>
                          <span className="text-xs text-red-500 font-semibold">Incluye mora</span>
                        </div>
                      </div>

                      {/* Desglose por conceptos */}
                      <h5 style={{ fontSize: '13px', fontWeight: 'bold', color: '#374151', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <DollarSign className="w-4 h-4" /> Desglose por Conceptos
                      </h5>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                        {[
                          { emoji: '💧', label: 'CONSUMO',   color: '#10b981', total: totalConsumo,   ant: consumoAnterior,   act: consumoActual2 },
                          { emoji: '🔧', label: 'SERVICIOS', color: '#3b82f6', total: totalServicios, ant: serviciosAnterior, act: 0 },
                          { emoji: '🚨', label: 'MULTAS',    color: '#ef4444', total: totalMultas,    ant: multasAnterior,    act: multasActual2 },
                          { emoji: '⏰', label: 'MORA',      color: '#f59e0b', total: totalMora,      ant: moraAnterior,      act: moraActual2 },
                        ].map(({ emoji, label, color, total, ant, act }) => (
                          <div key={label} style={{
                            backgroundColor: 'white', border: `2px solid ${color}`,
                            borderRadius: '8px', padding: '10px', textAlign: 'center'
                          }}>
                            <div style={{ fontSize: '22px', marginBottom: '4px' }}>{emoji}</div>
                            <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: '600', marginBottom: '4px' }}>{label}</div>
                            <div style={{ fontSize: '16px', fontWeight: 'bold', color, marginBottom: '2px' }}>{formatCurrency(total)}</div>
                            <div style={{ fontSize: '10px', color: '#9ca3af' }}>
                              Ant: {formatCurrency(ant)} | Act: {formatCurrency(act)}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Barra total */}
                      <div style={{
                        backgroundColor: '#1e293b', color: 'white', borderRadius: '8px',
                        padding: '12px', marginTop: '12px',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}>
                        <span style={{ fontSize: '14px', fontWeight: 'bold' }}>TOTAL A PAGAR (con mora incluida)</span>
                        <span style={{ fontSize: '24px', fontWeight: 'bold' }}>{formatCurrency(totalGeneralReal)}</span>
                      </div>
                    </div>

                    {/* ── LISTA DE FACTURAS ── */}
                    <div className="payment-period-list-header">
                      <h4 className="payment-period-list-title">
                        <FileText className="w-4 h-4" />
                        Detalles por Periodos
                        <span className="payment-period-count-badge">{todasLasFacturas.length}</span>
                      </h4>

                      <div className="payment-period-controls">
                        {todasLasFacturas.length <= 5 ? (
                          <>
                            <button
                              className="payment-period-btn-select-all"
                              onClick={() => {
                                if (facturasSeleccionadasPago.length === todasLasFacturas.length) {
                                  setFacturasSeleccionadasPago([]);
                                } else {
                                  setFacturasSeleccionadasPago(todasLasFacturas);
                                }
                              }}
                            >
                              {facturasSeleccionadasPago.length === todasLasFacturas.length
                                ? <CheckSquare className="w-3 h-3" />
                                : <Square className="w-3 h-3" />}
                              {facturasSeleccionadasPago.length === todasLasFacturas.length
                                ? 'Deseleccionar todas'
                                : 'Seleccionar todas'}
                            </button>

                            {facturasSeleccionadasPago.length > 0 && (
                              <span className="payment-period-selected-pill">
                                {facturasSeleccionadasPago.length} seleccionada{facturasSeleccionadasPago.length > 1 ? 's' : ''}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="payment-period-warn-pill">
                            <AlertTriangle className="w-3 h-3" />
                            Pago múltiple no disponible
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="payment-period-list">
                      {todasLasFacturas.map((factura, index) => {
                        const esActual         = factura.esactual === true;
                        const estaSeleccionada = facturasSeleccionadasPago.some(f => f.idfactura === factura.idfactura);
                        const puedeSeleccionar = todasLasFacturas.length <= 5;
                        const desglose         = factura.desglose || { consumo: {}, servicios: {}, multas: {} };
                        const consumoTotal     = parseFloat(desglose.consumo?.total || 0);
                        const serviciosTotal   = parseFloat(desglose.servicios?.total || 0);
                        const multasTotal      = parseFloat(desglose.multas?.total || 0);
                        const moraTotal        = parseFloat(factura.mora?.monto || 0);
                        const diasColor        = factura.dias_transcurridos > 30 ? 'dias-alto'
                                              : factura.dias_transcurridos > 15 ? 'dias-med' : '';

                        const cardClasses = [
                          'payment-period-card',
                          puedeSeleccionar ? 'is-selectable' : '',
                          esActual         ? 'is-actual'     : '',
                          estaSeleccionada ? 'is-selected'   : '',
                        ].filter(Boolean).join(' ');

                        return (
                          <div
                            key={factura.idfactura ?? index}
                            className={cardClasses}
                            onClick={() => puedeSeleccionar && toggleFacturaParaPago(factura)}
                          >
                            {/* ── Header ── */}
                            <div className="payment-period-card-header">
                              <span className={`payment-period-tag${esActual ? ' is-actual' : ''}`}>
                                {esActual ? 'Periodo actual' : `Periodo ${index + 1}`}
                              </span>

                              <span className="payment-period-num">{factura.numfactura}</span>

                              <span className={`payment-period-estado-tag ${factura.estadofactura === 'vencida' ? 'vencida' : 'pendiente'}`}>
                                {factura.estadofactura}
                              </span>

                              <span className="payment-period-periodo-label">{factura.periodo}</span>

                              {puedeSeleccionar && (
                                <input
                                  type="checkbox"
                                  className="payment-period-checkbox"
                                  checked={estaSeleccionada}
                                  onChange={e => { e.stopPropagation(); toggleFacturaParaPago(factura); }}
                                />
                              )}
                            </div>

                            {/* ── Body ── */}
                            <div className="payment-period-card-body">

                              {/* Columna conceptos */}
                              <div className="payment-period-conceptos">
                                <span className="payment-period-conceptos-label">Desglose</span>

                                {consumoTotal > 0 && (
                                  <div className="payment-period-concepto-row">
                                    <span className="payment-period-concepto-name">
                                      <Droplets className="w-3 h-3" style={{ color: '#059669' }} />
                                      Consumo ({factura.consumom3 || 0} m³)
                                    </span>
                                    <span className="payment-period-concepto-val consumo">{formatCurrency(consumoTotal)}</span>
                                  </div>
                                )}

                                {serviciosTotal > 0 && (
                                  <div className="payment-period-concepto-row">
                                    <span className="payment-period-concepto-name">
                                      <Wrench className="w-3 h-3" style={{ color: '#2563eb' }} />
                                      Servicios
                                    </span>
                                    <span className="payment-period-concepto-val servicios">{formatCurrency(serviciosTotal)}</span>
                                  </div>
                                )}

                                {multasTotal > 0 && (
                                  <div className="payment-period-concepto-row">
                                    <span className="payment-period-concepto-name">
                                      <AlertCircle className="w-3 h-3" style={{ color: '#dc2626' }} />
                                      Multas ({desglose.multas?.cantidad || 0})
                                    </span>
                                    <span className="payment-period-concepto-val multas">{formatCurrency(multasTotal)}</span>
                                  </div>
                                )}

                                {moraTotal > 0 && (
                                  <div className="payment-period-concepto-row">
                                    <span className="payment-period-concepto-name">
                                      <Clock className="w-3 h-3" style={{ color: '#d97706' }} />
                                      Mora ({factura.mora?.diasmoraefectivos || 0} días)
                                    </span>
                                    <span className="payment-period-concepto-val mora">{formatCurrency(moraTotal)}</span>
                                  </div>
                                )}

                                {consumoTotal === 0 && serviciosTotal === 0 && multasTotal === 0 && moraTotal === 0 && (
                                  <span className="payment-period-sin-desglose">Sin desglose disponible</span>
                                )}
                              </div>

                              {/* Columna meta */}
                              <div className="payment-period-meta">
                                <div className="payment-period-meta-item">
                                  <span className="payment-period-meta-label">
                                    <Calendar className="w-3 h-3" /> Emisión
                                  </span>
                                  <span className="payment-period-meta-val">{formatDateShort(factura.fechaemision)}</span>
                                </div>

                                <div className="payment-period-meta-item">
                                  <span className="payment-period-meta-label">
                                    <Clock className="w-3 h-3" /> Días transcurridos
                                  </span>
                                  <span className={`payment-period-meta-val ${diasColor}`}>
                                    {factura.dias_transcurridos} días
                                  </span>
                                </div>

                                <div className="payment-period-meta-item">
                                  <span className="payment-period-meta-label">IVA</span>
                                  <span className="payment-period-meta-val">
                                    {factura.iva?.porcentaje > 0 ? `${factura.iva.porcentaje}%` : 'Exento'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* ── Footer total ── */}
                            <div className="payment-period-card-footer">
                              <span className="payment-period-footer-label">
                                <DollarSign className="w-3 h-3" />
                                Total con mora
                              </span>
                              <span className="payment-period-footer-total">
                                {formatCurrency(factura.totalconmora)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Panel pago múltiple */}
                    {todasLasFacturas.length <= 5 && facturasSeleccionadasPago.length > 1 && (
                      <div style={{
                        backgroundColor: '#eff6ff', border: '2px solid #3b82f6',
                        padding: '16px', borderRadius: '8px', marginTop: '16px',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <h5 style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e40af', marginBottom: '4px' }}>
                              💰 Pago Múltiple
                            </h5>
                            <p style={{ fontSize: '12px', color: '#3b82f6' }}>
                              {facturasSeleccionadasPago.length} facturas seleccionadas
                            </p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Total a Pagar</div>
                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e40af' }}>
                              {/* ✅ Total = suma de totalconmora de cada factura seleccionada */}
                              {formatCurrency(calcularTotalSeleccionadas())}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Recomendación */}
                    <div style={{
                      backgroundColor: '#fef3c7', border: '1px solid #fde68a',
                      padding: '12px', borderRadius: '8px', marginTop: '16px',
                      display: 'flex', gap: '12px',
                    }}>
                      <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                      <div>
                        <p style={{ fontSize: '13px', color: '#92400e', fontWeight: '600', marginBottom: '4px' }}>
                          Recomendación
                        </p>
                        <p style={{ fontSize: '12px', color: '#78350f' }}>
                          {todasLasFacturas.length <= 5
                            ? 'Puede seleccionar múltiples facturas para pagar todo de una vez. Los totales mostrados ya incluyen mora calculada.'
                            : 'Tiene más de 5 facturas pendientes. Deberá hacer varios pagos. Recomendamos pagar las facturas más antiguas primero.'
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}

            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeAdeudosModal}>
                <X className="w-4 h-4 mr-2" />
                Cerrar
              </button>

              {/* BOTÓN PAGO MÚLTIPLE */}
              {permissions.canCreate && facturasSeleccionadasPago.length > 1 && (
                <button
                  className="btn-success"
                  onClick={() => {
                    setShowPagoMultipleModal(true);
                  }}
                  style={{ backgroundColor: '#10b981' }}
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  Pagar {facturasSeleccionadasPago.length} Facturas ({formatCurrency(calcularTotalFacturasSeleccionadas())})
                </button>
              )}

              {/* Botón pago individual */}
              {permissions.canCreate && facturasSeleccionadasPago.length === 0 && calcularSaldoPendiente(selectedFacturaAdeudos) > 0 && (
                <button
                  className="btn-primary"
                  onClick={() => {
                    closeAdeudosModal();
                    openPaymentModal(selectedFacturaAdeudos);
                  }}
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  Registrar Pago Individual
                </button>
              )}

            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN PAGO MÚLTIPLE */}
      {showPagoMultipleModal && facturasSeleccionadasPago.length > 1 && (() => {

        // Total a pagar = suma de totalconmora de cada factura seleccionada (con fallback a saldopendiente)
        const totalAPagar = facturasSeleccionadasPago.reduce((sum, f) => {
          return sum + parseFloat(f.totalconmora || f.total_con_mora || f.saldopendiente || f.saldo_pendiente || 0);
        }, 0);

        return (
          <div className="modal-overlay">
            <div className="modal modal-payment" style={{ maxWidth: '700px' }}>
              <div className="modal-header">
                <h3>
                  <DollarSign className="w-5 h-5 inline mr-2" />
                  Confirmar Pago Múltiple - {facturasSeleccionadasPago.length} Facturas
                </h3>
                <button className="modal-close" onClick={() => setShowPagoMultipleModal(false)}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="modal-body">
                {/* LISTA DE FACTURAS */}
                <div className="factura-section">
                  <h4 className="section-title">
                    <FileText className="w-4 h-4" />
                    Facturas a Pagar
                  </h4>

                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {facturasSeleccionadasPago.map((factura, idx) => {
                      // ✅ Usar campos normalizados, con fallback a snake_case
                      const esActual    = factura.esactual === true;
                      const numFactura  = factura.numfactura  || factura.num_factura;
                      const periodo     = factura.periodo;
                      const montoFactura = parseFloat(
                        factura.totalconmora || factura.total_con_mora ||
                        factura.saldopendiente || factura.saldo_pendiente || 0
                      );
                      const moraMonto   = parseFloat(factura.mora?.monto || 0);
                      const tieneMora   = moraMonto > 0;

                      return (
                        <div
                          key={factura.idfactura || factura.id_factura || idx}
                          style={{
                            backgroundColor: esActual ? '#eff6ff' : '#f9fafb',
                            padding: '12px',
                            borderRadius: '8px',
                            marginBottom: '8px',
                            border: esActual ? '1px solid #3b82f6' : '1px solid #e5e7eb'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 'bold', fontSize: '14px' }}>
                                {idx + 1}. {numFactura}
                              </span>
                              <span style={{ fontSize: '12px', color: '#6b7280' }}>
                                {periodo}
                              </span>

                              {esActual && (
                                <span style={{
                                  backgroundColor: '#3b82f6', color: 'white',
                                  padding: '2px 6px', borderRadius: '4px',
                                  fontSize: '10px', fontWeight: 'bold'
                                }}>
                                  ACTUAL
                                </span>
                              )}

                              {tieneMora && (
                                <span style={{
                                  backgroundColor: '#fef3c7', color: '#92400e',
                                  padding: '2px 6px', borderRadius: '4px',
                                  fontSize: '10px', fontWeight: 'bold'
                                }}>
                                  + Mora: {formatCurrency(moraMonto)}
                                </span>
                              )}
                            </div>

                            <span style={{ fontWeight: 'bold', fontSize: '15px', color: '#1f2937', whiteSpace: 'nowrap' }}>
                              {formatCurrency(montoFactura)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* TOTAL */}
                  <div style={{
                    backgroundColor: '#eff6ff', padding: '16px',
                    borderRadius: '8px', marginTop: '16px', border: '2px solid #3b82f6'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e40af' }}>
                          TOTAL A PAGAR
                        </span>
                        <div style={{ fontSize: '12px', color: '#3b82f6', marginTop: '2px' }}>
                          {facturasSeleccionadasPago.length} facturas · mora incluida
                        </div>
                      </div>
                      <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#1e40af' }}>
                        {formatCurrency(totalAPagar)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* MÉTODO DE PAGO */}
                <div className="payment-form-section" style={{ marginTop: '20px' }}>
                  <h5 className="payment-form-title">
                    <DollarSign className="w-5 h-5" />
                    Detalles del Pago
                  </h5>

                  <div className="payment-form-group">
                    <label className="payment-form-label">Método de Pago *</label>
                    <select
                      className="payment-form-input"
                      value={nuevoPago.metodo_pago}
                      onChange={(e) => setNuevoPago({ ...nuevoPago, metodo_pago: e.target.value })}
                    >
                      <option value="EFECTIVO">💵 Efectivo</option>
                      <option value="TRANSFERENCIA">🏦 Transferencia Bancaria</option>
                      <option value="TARJETA">💳 Tarjeta</option>
                    </select>
                  </div>

                  <div className="payment-form-group">
                    <label className="payment-form-label">Observaciones (Opcional)</label>
                    <textarea
                      className="payment-form-input payment-form-textarea"
                      rows="3"
                      value={nuevoPago.observaciones}
                      onChange={(e) => setNuevoPago({ ...nuevoPago, observaciones: e.target.value })}
                      placeholder="Observaciones para el pago múltiple..."
                    />
                  </div>
                </div>

                {/* ADVERTENCIA */}
                <div style={{
                  backgroundColor: '#fef3c7', border: '1px solid #fde68a',
                  padding: '12px', borderRadius: '8px', marginTop: '16px',
                  display: 'flex', gap: '12px'
                }}>
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <div>
                    <p style={{ fontSize: '13px', color: '#92400e', fontWeight: '600', marginBottom: '4px' }}>
                      Importante
                    </p>
                    <p style={{ fontSize: '12px', color: '#78350f' }}>
                      Este pago se aplicará a todas las facturas seleccionadas.
                      Se generará un comprobante único con el detalle de todas las facturas pagadas.
                      Los totales mostrados ya incluyen mora calculada.
                    </p>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  className="btn-secondary"
                  onClick={() => setShowPagoMultipleModal(false)}
                  disabled={loading}
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancelar
                </button>

                <button
                  className="btn-success"
                  onClick={handlePagoMultiple}
                  disabled={loading}
                  style={{ backgroundColor: '#10b981' }}
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Confirmar Pago Múltiple
                      <span style={{
                        marginLeft: '8px', padding: '4px 8px',
                        backgroundColor: 'rgba(255,255,255,0.3)',
                        borderRadius: '4px', fontWeight: 'bold'
                      }}>
                        {formatCurrency(totalAPagar)}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL DE COMPROBANTE DE PAGO */}
      {showReceipt && pagoRegistrado && (
        <PaymentReceipt
          pago={pagoRegistrado}
          factura={facturaDelPago}
          onClose={() => {
            setShowReceipt(false);
            setPagoRegistrado(null);
            setFacturaDelPago(null);
          }}
        />
      )}

      {/* MODAL DE COMPROBANTE DE PAGO MÚLTIPLE */}
      {showMultipleReceiptModal && multipleReceiptData && (
        <MultiplePaymentReceipt
          pagoMultiple={multipleReceiptData.pagoMultiple}
          facturas={multipleReceiptData.facturas}
          afiliado={multipleReceiptData.afiliado}
          onClose={() => {
            setShowMultipleReceiptModal(false);
            setMultipleReceiptData(null);
            // Limpiar selección después de cerrar
            setFacturasSeleccionadasPago([]);
          }}
          onSave={async (comprobanteData) => {
            try {
              await paymentsServices.uploadComprobante(
                comprobanteData.id_pago, 
                comprobanteData.pdf_base64
              );
              console.log('✅ Comprobante guardado en base de datos');
            } catch (error) {
              console.error('Error guardando comprobante:', error);
            }
          }}
        />
      )}
    
    </div>
  );
};

export default PaymentsSection;
