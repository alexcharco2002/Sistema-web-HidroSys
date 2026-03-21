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
  Plus, ChevronDown,
  Wallet, XCircle, FileCheck
} from 'lucide-react';

const PaymentsSection = () => {
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

    return total;
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
      const existe = prev.find(f => f.id_factura === factura.id_factura);
      
      if (existe) {
        return prev.filter(f => f.id_factura !== factura.id_factura);
      } else {
        // Limitar a 5 facturas
        if (prev.length >= 5) {
          alert('⚠️ Solo puede seleccionar hasta 5 facturas para pago múltiple');
          return prev;
        }
        return [...prev, factura];
      }
    });
  };

  // ============================================================
  // FUNCIÓN PARA CALCULAR TOTAL DE FACTURAS SELECCIONADAS
  // ============================================================
  const calcularTotalFacturasSeleccionadas = () => {
    return facturasSeleccionadasPago.reduce((sum, factura) => {
      const totalFactura = factura.total_con_mora || 
                          (factura.saldo_pendiente + (factura.mora_monto || 0));
      
      return sum + parseFloat(totalFactura || 0);
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

  const cargarFacturasPendientesAfiliado = useCallback(async (idUsuarioAfi) => {
    if (!idUsuarioAfi || !periodoSeleccionado) {
      console.warn('⚠️ No hay periodo seleccionado');
      return null;
    }

    const periodoStr = `${periodoSeleccionado.anio}-${String(periodoSeleccionado.mes).padStart(2, '0')}`;
    const cacheKey = `${idUsuarioAfi}-${periodoStr}`;
    
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
        false
      );

      if (result.success && result.data) {
        // ✅ Guardar en caché sin causar re-render
        facturasPendientesCache.current[cacheKey] = result.data;
        
        // Actualizar estado para UI
        setFacturasPendientesPorAfiliado(prev => ({
          ...prev,
          [idUsuarioAfi]: result.data
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
          f => f.estado_factura === 'pendiente' || f.estado_factura === 'vencida' ||  f.estado_factura === 'anulada' 
        );
        
        console.log(`🔍 Facturas pendientes/vencidas: ${facturasPendientesOVencidas.length} de ${result.data.length}`);

        // ✅ Extraer afiliados únicos SOLO de facturas pendientes/vencidas
        const afiliadosUnicos = [
          ...new Set(
            facturasPendientesOVencidas
              .map(f => f.usuario_afiliado?.id_usuario_afi)
              .filter(Boolean)
          )
        ];
        
        console.log(`👥 Cargando adeudos para ${afiliadosUnicos.length} afiliados con facturas pendientes`);
        
        // Cargar en paralelo con manejo de errores
        const promesas = afiliadosUnicos.map(idAfi => 
          cargarFacturasPendientesAfiliado(idAfi).catch(err => {
            console.error(`Error cargando adeudos del afiliado ${idAfi}:`, err);
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


  /**
   * Obtiene un valor seguro, retornando un default si es null/undefined/NaN
   */
  const getSafeValue = (value, defaultValue = 0) => {
    if (value === null || value === undefined || isNaN(value)) {
      return defaultValue;
    }
    return parseFloat(value);
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
    setSelectedPago(pago);
    setShowModal(true);
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
  if (!datosAdeudo || !datosAdeudo.meses_adeudo || datosAdeudo.meses_adeudo < 1) {
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
  setSelectedAfiliadoAdeudos(factura.usuario_afiliado);
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
      const idAfiliado = factura.usuario_afiliado?.id_usuario_afi;
      
      if (!idAfiliado) {
        throw new Error('No se pudo identificar el afiliado de la factura');
      }

      //  1. Cargar todas las facturas pendientes del afiliado
      const facturasPendientes = await cargarFacturasPendientesAfiliado(idAfiliado);
      
      //  2. Calcular resumen con mora de la factura seleccionada
      const resultado = await paymentsServices.calcularResumenPago(factura.id_factura);
      
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
        
        // 🔍 VALIDAR ESTRUCTURA
        if (!resultado.data.totales) {
          console.error('❌ Falta propiedad "totales" en el resumen');
        }
        if (!resultado.data.totales?.opcion_completa) {
          console.error('❌ Falta propiedad "opcion_completa" en totales');
        }
        if (!resultado.data.totales?.opcion_sin_multas) {
          console.error('❌ Falta propiedad "opcion_sin_multas" en totales');
        }
        
        setResumenPago(resultado.data);
      } else {
        console.error('❌ Error al cargar resumen:', resultado.message);
        console.warn('⚠️ Continuando sin resumen de pago detallado');
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

      setSelectedFactura(factura);
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
    const montoAPagar = calcularTotalAPagar();
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
      if (!currentUser?.id_usuario_sistema) {
        throw new Error('No se pudo identificar al usuario actual');
      }

      // PREPARAR DATOS DEL PAGO
      const pagoData = {
        id_factura: nuevoPago.id_factura ? parseInt(nuevoPago.id_factura) : null,
        monto_pago: montoAPagar,
        metodo_pago: nuevoPago.metodo_pago || 'EFECTIVO',
        id_usuario_afi: nuevoPago.id_usuario_afi ? parseInt(nuevoPago.id_usuario_afi) : null,
        id_cajero: currentUser.id_usuario_sistema,
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
      Promise.all([
        // Generar y guardar PDF
        (async () => {
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
        })(),
        
        // Recargar datos del servidor (verificar valores reales)
        (async () => {
          try {
            console.log('🔄 Recargando datos del servidor...');
            await fetchFacturasPeriodo();
            await fetchStats();
            
            // Limpiar caché de adeudos
            const idAfiliado = selectedFactura.usuario_afiliado?.id_usuario_afi;
            if (idAfiliado) {
              const periodoStr = `${periodoSeleccionado.anio}-${String(periodoSeleccionado.mes).padStart(2, '0')}`;
              const cacheKey = `${idAfiliado}-${periodoStr}`;
              if (facturasPendientesCache.current) {
                delete facturasPendientesCache.current[cacheKey];
              }
              setFacturasPendientesPorAfiliado(prev => {
                const { [idAfiliado]: _, ...rest } = prev;
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
  facturasSeleccionadasPago.forEach((f, idx) => {
    mensaje += `${idx + 1}. ${f.num_factura} (${f.periodo}) - ${formatCurrency(f.saldo_pendiente || f.total_con_mora)}\n`;
  });
  mensaje += `\nMétodo de pago: ${nuevoPago.metodo_pago}`;

  const confirmar = window.confirm(mensaje);
  if (!confirmar) return;

  setLoading(true);
  setError(null);

  try {
    const currentUser = authService.getCurrentUser();
    if (!currentUser?.id_usuario_sistema) {
      throw new Error('No se pudo identificar al usuario actual');
    }

    // ========== PREPARAR DATOS ==========
    const pagoMultipleData = {
      facturas: facturasSeleccionadasPago.map(f => ({
        id_factura: f.id_factura,
        monto_a_pagar: f.saldo_pendiente || f.total_con_mora,
        incluir_multas: true,
        incluir_mora: true,
        incluir_consumos: true
      })),
      metodo_pago: nuevoPago.metodo_pago || 'EFECTIVO',
      id_usuario_afi: selectedAfiliadoAdeudos.id_usuario_afi,
      id_cajero: currentUser.id_usuario_sistema,
      observaciones: nuevoPago.observaciones || `Pago múltiple de ${facturasSeleccionadasPago.length} facturas`
    };

    console.log('💰 Procesando pago múltiple...', pagoMultipleData);

    // 🚀 PASO 1: CREAR EL PAGO (operación crítica)
    const result = await paymentsServices.createPagoMultiple(pagoMultipleData);

    if (!result.success) {
      throw new Error(result.message || 'Error al procesar pago múltiple');
    }

    const response = result.data;
    console.log('✅ Pago múltiple registrado:', response.pagos_creados);

    // ✅ ACTUALIZACIÓN OPTIMISTA - Actualizar facturas inmediatamente
    const facturasIds = facturasSeleccionadasPago.map(f => f.id_factura);
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
          if (idAfiliado) {
            const periodoStr = `${periodoSeleccionado.anio}-${String(periodoSeleccionado.mes).padStart(2, '0')}`;
            const cacheKey = `${idAfiliado}-${periodoStr}`;
            if (facturasPendientesCache.current) {
              delete facturasPendientesCache.current[cacheKey];
            }
            setFacturasPendientesPorAfiliado(prev => {
              const { [idAfiliado]: _, ...rest } = prev;
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

    setMultipleReceiptData({
      pagoMultiple: comprobanteDataModal,
      facturas: facturasSeleccionadasPago,
      afiliado: selectedAfiliadoAdeudos
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
{/* SECCIÓN 1: PERÍODOS RECIENTES — PAGOS
    Ahora muestra barras de cobrado/pendiente igual que facturas,
    más el conteo de facturas pagadas vs total.

    CSS: reutiliza periodos-recientes-facturas.css (cobrado + pendiente).
    No necesitas CSS nuevo.
*/}

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
        const pctPendiente   = periodo.porcentaje_pendiente ?? 0;
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

            {/* INFO: facturas pagadas / total */}
            <div className="periodo-card-info">
              {tieneFacturas
                ? `${periodo.total_pagadas} / ${periodo.total_facturas} facturas cobradas`
                : 'Sin facturas aún'}
            </div>

            {/* BARRAS DE PROGRESO — solo si tiene facturas */}
            {tieneFacturas && (
              <>
                {/* Barra cobrado */}
                <div className="periodo-progress-section">
                  <div className="periodo-progress-label">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span>Cobrado</span>
                    <span className="periodo-progress-value">{pctCobrado}%</span>
                  </div>
                  <div className="periodo-progress-bar">
                    <div
                      className={`periodo-progress-fill cobrado ${todoCobrado ? 'complete' : ''}`}
                      style={{ width: `${pctCobrado}%` }}
                    />
                  </div>
                </div>

                {/* Barra pendiente */}
                <div className="periodo-progress-section">
                  <div className="periodo-progress-label">
                    <Clock className="w-3 h-3 text-yellow-600" />
                    <span>Pendiente</span>
                    <span className="periodo-progress-value">{pctPendiente}%</span>
                  </div>
                  <div className="periodo-progress-bar">
                    <div
                      className="periodo-progress-fill pendiente"
                      style={{ width: `${pctPendiente}%` }}
                    />
                  </div>
                </div>
              </>
            )}

            {/* ACCIÓN */}
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
                                title={`${periodo.total_pagos} pagos`}
                              >
                                <span className="historial-mes-dot completo" />
                                <span className="historial-mes-nombre">
                                  {nombresMeses[periodo.mes]}
                                </span>
                                <span className="historial-mes-pct">
                                  {periodo.total_pagos}
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

          {/*  CONTADOR DE RESULTADOS */}
          {searchTerm || filterStatus !== 'all' || filterMetodo !== 'all' ? (
            <div className="filter-results-info">
              <span>
                Mostrando <strong>{sortedFacturas.length}</strong> de <strong>{facturas.length}</strong> facturas
              </span>
              {(searchTerm || filterStatus !== 'all' || filterMetodo !== 'all') && (
                <button 
                  className="btn-clear-filters"
                  onClick={() => {
                    setSearchTerm('');
                    setFilterStatus('all');
                    setFilterMetodo('all');
                  }}
                >
                  <X className="w-3 h-3" />
                  Limpiar filtros
                </button>
              )}
            </div>
          ) : null}


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
                      sortedFacturas.map((factura, index) => {
                        
                        const saldoPendiente = calcularSaldoPendiente(factura);
                        const puedeRecibirPago = factura.estado_factura === 'pendiente' || factura.estado_factura === 'vencida';
                        const idAfiliado = factura.usuario_afiliado?.id_usuario_afi;
                        const datosAdeudo = facturasPendientesPorAfiliado[idAfiliado];

                        //  CALCULAR ADEUDO TOTAL (periodos anteriores + factura actual)
                        const calcularAdeudoTotal = () => {
                          // Adeudo de periodos anteriores
                          const adeudoAnterior = datosAdeudo?.total_adeudado || 0;
                          
                          // Saldo pendiente de la factura actual
                          const saldoActual = saldoPendiente > 0 ? saldoPendiente : 0;
                          
                          // Total = adeudo anterior + saldo actual
                          return adeudoAnterior + saldoActual;
                        };

                        const adeudoTotal = calcularAdeudoTotal();

                        //  CALCULAR MESES DE ADEUDO (incluir mes actual si tiene saldo)
                        const calcularMesesAdeudo = () => {
                          const mesesAnteriores = datosAdeudo?.meses_adeudo || 0;
                          
                          // Si la factura actual tiene saldo pendiente, sumar 1 mes
                          const mesActual = saldoPendiente > 0 ? 1 : 0;
                          
                          return mesesAnteriores + mesActual;
                        };

                        const mesesAdeudoTotal = calcularMesesAdeudo();

                        return (
                          <div 
                            key={factura.id_factura} 
                            className={`payments-invoices-item ${
                              factura.estado_factura === 'anulada' ? 'pmt-inv-anulada' : 
                              factura.estado_factura === 'pagada' ? 'pmt-inv-pagada' :
                              factura.estado_factura === 'vencida' ? 'pmt-inv-vencida' : ''
                            }`}
                          >
                            {/* Columna 1: # */}
                            <div className="pmt-inv-col-index">
                              <span className="pmt-inv-index-badge">{index + 1}</span>
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

                            {/* Columna 4: Código Afiliado */}
                            <div className="pmt-inv-col-codigo">
                              {factura.usuario_afiliado?.cod_usuario_afi ?? '—'}
                            </div>

                            {/* Columna 5: Afiliado */}
                            <div className="pmt-inv-col-usuario">
                              {factura.usuario_afiliado?.usuario_sistema ? (
                                <div className="pmt-inv-usuario-info">
                                  <span className="pmt-inv-usuario-nombre">
                                    {factura.usuario_afiliado.usuario_sistema.nombre_completo} 
                                  </span>
                                </div>
                              ) : (
                                <span className="pmt-inv-sin-dato">-</span>
                              )}
                            </div>

                            {/* Columna 6: Meses Adeudo */}
                            <div className="pmt-inv-col-meses-adeudo">
                              {mesesAdeudoTotal > 0 &&
                              (factura.estado_factura === 'pendiente' ||
                              factura.estado_factura === 'vencida') ? (

                                <span
                                  className={`pmt-meses-badge ${
                                    mesesAdeudoTotal === 1
                                      ? 'normal'      
                                      : mesesAdeudoTotal > 2
                                        ? 'urgente'  
                                        : 'warning'   
                                  }`}
                                  onClick={() => {
                                    if (mesesAdeudoTotal > 1) {
                                      openAdeudosModal(factura, datosAdeudo);
                                    }
                                  }}
                                  style={{
                                    cursor: mesesAdeudoTotal > 1 ? 'pointer' : 'default',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                  }}
                                  title={
                                    mesesAdeudoTotal === 1
                                      ? 'Mes actual (sin adeudos)'
                                      : 'Ver detalle de adeudos'
                                  }
                                >
                                  <Eye className="w-3 h-3" />

                                  {mesesAdeudoTotal === 1
                                    ? 'Mes actual'
                                    : `${mesesAdeudoTotal} meses`
                                  }
                                </span>

                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </div>


                            {/* Columna 8: Total Factura */}
                            <div className="pmt-inv-col-total">
                              <span className="pmt-inv-monto">{formatCurrency(factura.total)}</span>
                            </div>

                            {/* Columna 9: Saldo Pendiente Factura Actual */}
                            <div className="pmt-inv-col-total">
                              <span 
                                className="pmt-inv-monto font-bold" 
                                style={{ color: saldoPendiente > 0 ? '#ef4444' : '#10b981' }}
                              >
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
                              <button 
                                className="pmt-inv-btn pmt-inv-btn-view" 
                                onClick={() => openModal('view-factura', factura)} 
                                title="Ver factura y pagos"
                              >
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
                                factura.pagos && 
                                factura.pagos.length > 0 && 
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
                            : `No hay facturas para ${formatearPeriodo(periodoSeleccionado.mes, periodoSeleccionado.anio)}`
                          }
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
                      Mostrando <strong>{sortedFacturas.length}</strong> facturas
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
            </div>
          )}

        </div>
      )}
      
      {/* MODAL DETALLE FACTURA CON PAGOS */}
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

              {/* SECCIÓN DE AFILIADO */}
              {selectedPago.usuario_afiliado && (
                <div className="factura-section">
                <br/> 
                  <h4 className="section-title">
                    <User className="w-4 h-4" />
                    Datos del Afiliado
                  </h4>
                   <br/> 
                  <div className="user-details">
                    <div className="detail-group form-group-full">
                      <label>Nombre Afiliado:</label>
                      <p>
                        {selectedPago.usuario_afiliado.usuario_sistema?.nombre_completo}{' '}
                        - {selectedPago.usuario_afiliado.usuario_sistema?.cedula || 'N/A'}
                        
                      </p>
                    </div>

                    <div className="detail-group">
                      <label>Código Afiliado:</label>
                      <p className="font-mono">{selectedPago.usuario_afiliado.cod_usuario_afi}</p>
                    </div>

                    <div className="detail-group">
                      <label>Medidor:</label>
                      <p className="font-mono">{selectedPago.usuario_afiliado.num_medidor}</p>
                    </div>

                    {/*  AGREGAR NÚMERO DE MEDIDOR */}
                    {selectedPago.usuario_afiliado.medidores && 
                    selectedPago.usuario_afiliado.medidores.length > 0 && (
                      <div className="detail-group">
                        <label>Número de Medidor</label>
                        <p className="font-mono font-semibold text-green-600">
                          {selectedPago.usuario_afiliado.medidores[0].num_medidor}
                        </p>
                      </div>
                    )}
                    {selectedPago.usuario_afiliado.sector && (
                      <div className="detail-group form-group-full">
                        <label>Sector:</label>
                        <p>{selectedPago.usuario_afiliado.sector.nombre_sector}</p>
                      </div>
                    )}
                  </div>
                   <br/> 
                  <h4 className="section-title">
                    <FileText className="w-4 h-4" />
                    Conceptos de Facturación
                  </h4>
                  <br/> 
                </div>
              )}


              {/* Sección de CONCEPTOS DE FACTURACIÓN */}
              {selectedPago.detalles && selectedPago.detalles.length > 0 && (
                <div className="conceptos-section">
                  <h4 className="conceptos-section-title">
                    Conceptos ({selectedPago.detalles.length})
                  </h4>
                  <div className="conceptos-factura-lista">
                    {selectedPago.detalles.map((detalle, index) => {
                      const getTipoConfig = (tipo) => {
                        switch(tipo?.toLowerCase()) {
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
                        <div key={detalle.id_detalle} className="concepto-item">
                          <div className="concepto-header">
                            <div className="concepto-tipo" style={{ color: tipoConfig.color }}>
                              {tipoConfig.icon}
                              <span className="concepto-tipo-label">{tipoConfig.label}</span>
                            </div>
                            <span className="concepto-numero">#{index + 1}</span>
                          </div>
                          <div className="concepto-body">
                            <p className="concepto-descripcion">{detalle.descripcion}</p>
                            <div className="concepto-footer">
                              <span className="concepto-subtotal-label">Subtotal:</span>
                              <span className="concepto-subtotal-value" style={{ color: tipoConfig.color }}>
                                {formatCurrency(detalle.subtotal_detalle)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    
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
              {selectedPago.pagos && selectedPago.pagos.length > 0 && (
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
              {(!selectedPago.pagos || selectedPago.pagos.length === 0) && (
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
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL CREAR PAGO ==================== */}
      {showCreateModal && selectedFactura && (
        <div className="modal-overlay">
          <div className="modal modal-payment">
            <div className="modal-header">
              <h3>
                <Plus className="w-5 h-5 inline mr-2" />
                Registrar Pago - {selectedFactura.num_factura}
              </h3>
              <button className="modal-close" onClick={closeCreateModal}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="modal-body">
              {/* ========== INFORMACIÓN DE LA FACTURA ACTUAL ========== */}
              {selectedFactura && (
                <div className="payment-factura-actual-section">
                  <div className="payment-factura-actual-header">
                    <div className="payment-header-left">
                      <FileText className="w-5 h-5" />
                      <h4>Información de la Factura</h4>
                    </div>
                  </div>

                  {loadingResumen ? (
                    <div className="payment-resumen-loading">
                      <RefreshCw className="w-6 h-6 animate-spin" />
                      <p>Calculando resumen...</p>
                    </div>
                  ) : resumenPago ? (
                    <>
                      {/* Tarjeta compacta de la factura actual */}
                      <div className="payment-factura-actual-card">
                        <div className="payment-factura-actual-info">
                          <div className="payment-info-row">
                            <span className="payment-info-label">Número de Factura:</span>
                            <span className="payment-info-value">{selectedFactura.num_factura}</span>
                          </div>
                          <div className="payment-info-row">
                            <span className="payment-info-label">Periodo:</span>
                            <span className="payment-info-value">{selectedFactura.periodo}</span>
                          </div>
                          <div className="payment-info-row">
                            <span className="payment-info-label">Fecha de Emisión:</span>
                            <span className="payment-info-value">{formatDateShort(selectedFactura.fecha_emision)}</span>
                          </div>
                          <div className="payment-info-row">
                            <span className="payment-info-label">Afiliado:</span>
                            <span className="payment-info-value">
                              {selectedFactura.usuario_afiliado?.usuario_sistema?.nombre_completo}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* ========== SELECCIÓN DE ITEMS A PAGAR ========== */}
                      <div className="payment-items-section">
                        <div className="payment-items-header">
                          <h5>
                            <DollarSign className="w-5 h-5" />
                            Seleccione los items a pagar
                          </h5>
                          <button 
                            className="payment-select-all-btn"
                            onClick={() => {
                              const consumoTotal = getSafeValue(resumenPago.totales?.opcion_sin_multas?.total_final, 0) - 
                                                  (getSafeValue(resumenPago.mora?.monto, 0));
                              
                              const allChecked = (consumoTotal <= 0 || itemsAPagar.consumos) && 
                                                (!resumenPago.multas?.tiene_multas || itemsAPagar.multas) &&
                                                (!resumenPago.mora?.aplica || itemsAPagar.mora);
                              
                              setItemsAPagar({
                                consumos: consumoTotal > 0 ? !allChecked : false,
                                multas: resumenPago.multas?.tiene_multas ? !allChecked : false,
                                mora: resumenPago.mora?.aplica ? !allChecked : false
                              });
                            }}
                          >
                            {(() => {
                              const consumoTotal = getSafeValue(resumenPago.totales?.opcion_sin_multas?.total_final, 0) - 
                                                  (getSafeValue(resumenPago.mora?.monto, 0));
                              const allChecked = (consumoTotal <= 0 || itemsAPagar.consumos) && 
                                                (!resumenPago.multas?.tiene_multas || itemsAPagar.multas) &&
                                                (!resumenPago.mora?.aplica || itemsAPagar.mora);
                              return allChecked ? '☑️ Deseleccionar Todo' : '☐ Seleccionar Todo';
                            })()}
                          </button>

                        </div>

                        {/* LISTA DE CONSUMOS Y SERVICIOS - SOLO SI HAY MONTO */}
                        {(() => {
                          const consumoTotal = getSafeValue(resumenPago.totales?.opcion_sin_multas?.total_final, 0) - 
                                              (getSafeValue(resumenPago.mora?.monto, 0));
                          
                          const detallesConsumoServicios = selectedFactura?.detalles?.filter(
                            detalle => detalle.tipo_detalle === 'consumo' || detalle.tipo_detalle === 'servicio'
                          ) || [];
                          
                          // 🆕 OBTENER INFO DEL IVA DESDE EL RESUMEN (calculado por el backend)
                          const ivaInfo = resumenPago?.iva || {};
                          const porcentajeIVA = getSafeValue(ivaInfo.porcentaje, 0);
                          const esExento = ivaInfo.es_exento || false;
                          
                          // Calcular IVA de consumos
                          const subtotalConsumos = getSafeValue(resumenPago.totales?.opcion_sin_multas?.subtotal, 0);
                          const ivaConsumos = getSafeValue(resumenPago.totales?.opcion_sin_multas?.iva, 0);
                          const descuentoConsumos = getSafeValue(resumenPago.totales?.opcion_sin_multas?.descuento, 0);
                          const baseImponibleConsumos = getSafeValue(resumenPago.totales?.opcion_sin_multas?.base, 0);
                          
                          return consumoTotal > 0 && (
                            <div className="payment-item-card">
                              <div className="payment-item-row">
                                <div className="payment-item-check">
                                  <input
                                    type="checkbox"
                                    id="check-consumos"
                                    checked={itemsAPagar.consumos}
                                    onChange={(e) => setItemsAPagar({...itemsAPagar, consumos: e.target.checked})}
                                    className="payment-checkbox"
                                  />
                                  <label htmlFor="check-consumos" className="payment-item-label">
                                    <span className="payment-item-icon">💧</span>
                                    <div className="payment-item-details">
                                      <span className="payment-item-title">Consumos y Servicios</span>
                                      
                                      {/* Lista de detalles */}
                                      {detallesConsumoServicios.length > 0 ? (
                                        <div className="payment-consumos-mini-list">
                                          {detallesConsumoServicios.map((detalle, idx) => (
                                            <span key={idx} className="payment-consumo-mini">
                                              • {detalle.tipo_detalle === 'consumo' ? '💧' : '🔧'} {detalle.descripcion}: {formatCurrencySafe(detalle.subtotal_detalle)}
                                            </span>
                                          ))}
                                        </div>
                                      ) : (
                                        <span className="payment-item-description">
                                          Subtotal: {formatCurrencySafe(subtotalConsumos)}
                                        </span>
                                      )}
                                      
                                      {/* 🆕 INFORMACIÓN DETALLADA DEL IVA - Usando datos del backend */}
                                      <span className="payment-item-meta">
                                        {descuentoConsumos > 0 && 
                                          `Descuento: -${formatCurrencySafe(descuentoConsumos)} | `
                                        }
                                        Base imponible: {formatCurrencySafe(baseImponibleConsumos)}
                                        {' | '}
                                        {!esExento && porcentajeIVA > 0 ? (
                                          <>IVA ({porcentajeIVA.toFixed(1)}%): {formatCurrencySafe(ivaConsumos)}</>
                                        ) : (
                                          <>Sin IVA (0%)</>
                                        )}
                                      </span>
                                    </div>
                                  </label>
                                </div>
                                <span className="payment-item-amount">
                                  {formatCurrencySafe(consumoTotal)}
                                </span>
                              </div>
                            </div>
                          );
                        })()}

                        {/* LISTA DE MULTAS */}
                        {resumenPago.multas?.tiene_multas && resumenPago.multas?.detalles?.length > 0 && (
                          <div className="payment-item-card payment-item-card-warning">
                            <div className="payment-item-row">
                              <div className="payment-item-check">
                                <input
                                  type="checkbox"
                                  id="check-multas"
                                  checked={itemsAPagar.multas}
                                  onChange={(e) => setItemsAPagar({...itemsAPagar, multas: e.target.checked})}
                                  className="payment-checkbox"
                                />
                                <label htmlFor="check-multas" className="payment-item-label">
                                  <span className="payment-item-icon">🚨</span>
                                  <div className="payment-item-details">
                                    <span className="payment-item-title">
                                      Multas ({resumenPago.multas.cantidad})
                                    </span>
                                    <div className="payment-multas-mini-list">
                                      {resumenPago.multas.detalles.map((multa, idx) => (
                                        <span key={idx} className="payment-multa-mini">
                                          • {multa.descripcion}: {formatCurrencySafe(multa.subtotal)}
                                        </span>
                                      ))}
                                    </div>
                                    {/* 🆕 Mostrar desglose de IVA para multas */}
                                    <span className="payment-item-meta">
                                      Subtotal: {formatCurrencySafe(resumenPago.multas.subtotal_sin_iva)}
                                      {' | '}
                                      {!resumenPago.iva?.es_exento && resumenPago.iva?.porcentaje > 0 ? (
                                        <>IVA ({resumenPago.iva.porcentaje.toFixed(1)}%): {formatCurrencySafe(resumenPago.multas.iva)}</>
                                      ) : (
                                        <>Sin IVA (0%)</>
                                      )}
                                    </span>
                                  </div>
                                </label>
                              </div>
                              <span className="payment-item-amount payment-item-amount-danger">
                                {formatCurrencySafe(resumenPago.multas.total_con_iva)}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* MORA */}
                        {resumenPago?.mora?.aplica && getSafeValue(resumenPago.mora?.monto) > 0 && (
                          <div className="payment-item-card payment-item-card-danger">
                            <div className="payment-item-row">
                              <div className="payment-item-check">
                                <input
                                  type="checkbox"
                                  id="check-mora"
                                  checked={itemsAPagar.mora}
                                  onChange={(e) => setItemsAPagar({...itemsAPagar, mora: e.target.checked})}
                                  className="payment-checkbox"
                                />
                                <label htmlFor="check-mora" className="payment-item-label">
                                  <span className="payment-item-icon">⏰</span>
                                  <div className="payment-item-details">
                                    <span className="payment-item-title">Mora por Pago Tardío</span>
                                    <span className="payment-item-description">
                                      {getSafeValue(resumenPago.mora.dias_transcurridos, 0)} días desde emisión | 
                                      {' '}{getSafeValue(resumenPago.mora.dias_mora_efectivos, 0)} días de mora efectivos
                                    </span>
                                    <span className="payment-item-meta">
                                      {resumenPago.mora.configuracion_nombre && `Config: ${resumenPago.mora.configuracion_nombre}`}
                                    </span>
                                  </div>
                                </label>
                              </div>
                              <span className="payment-item-amount payment-item-amount-danger">
                                {formatCurrencySafe(resumenPago.mora.monto)}
                              </span>
                            </div>
                          </div>
                        )}

                      </div>

                      {/* ========== DETALLES DEL PAGO ========== */}
                      <div className="payment-form-section">
                        <h5 className="payment-form-title">
                          <DollarSign className="w-5 h-5" />
                          Detalles del Pago
                        </h5>

                        {/* Método de Pago */}
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

                        {/* Observaciones */}
                        <div className="payment-form-group">
                          <label className="payment-form-label">Observaciones (Opcional)</label>
                          <textarea
                            className="payment-form-input payment-form-textarea"
                            rows="3"
                            value={nuevoPago.observaciones}
                            onChange={(e) => setNuevoPago({ ...nuevoPago, observaciones: e.target.value })}
                            placeholder="Ingresa notas adicionales sobre este pago..."
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="payment-resumen-error">No se pudo cargar el resumen del pago</p>
                  )}
                </div>
              )}
            </div>

            {/* ========== FOOTER CON TOTAL Y BOTÓN DE PAGO ========== */}
            <div className="payment-modal-footer">
              <div className="payment-footer-total-display">
                <div className="payment-total-breakdown">
                  <span className="payment-total-label">Total a Pagar:</span>
                  <span className="payment-total-counter">
                    {formatCurrency(calcularTotalAPagar())}
                  </span>
                </div>
                {!itemsAPagar.consumos && !itemsAPagar.multas && !itemsAPagar.mora && (
                  <p className="payment-warning-text">
                    <AlertCircle className="w-4 h-4" />
                    Debe seleccionar al menos un item para pagar
                  </p>
                )}
              </div>

              <div className="payment-footer-actions">
                <button className="btn-secondary" onClick={closeCreateModal} disabled={loading}>
                  <X className="w-4 h-4 mr-2" />
                  Cancelar
                </button>

                <button
                  className="btn-primary"
                  onClick={handleCreatePago}
                  disabled={loading || (!itemsAPagar.consumos && !itemsAPagar.multas && !itemsAPagar.mora)}
                  title="Registrar el pago de los items seleccionados"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2"/>
                      Registrar Pago
                      <span className="payment-btn-amount">
                        {formatCurrency(calcularTotalAPagar())}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

{/* ============================================================ */}
{/* MODAL DESGLOSE DE ADEUDOS POR PERIODOS - MEJORADO */}
{/* ============================================================ */}
{showAdeudosModal && selectedFacturaAdeudos && selectedAfiliadoAdeudos && (
  <div className="modal-overlay">
    <div className="modal modal-adeudos-desglose" style={{ maxWidth: '1100px' }}>
      <div className="modal-header">
        <h3>
          <Clock className="w-5 h-5 inline mr-2" />
          Detalles de Adeudos por Periodo - {selectedAfiliadoAdeudos.cod_usuario_afi}
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
          <div className="user-details">
            <div className="detail-group">
              <label>Nombre</label>
              <p>{selectedAfiliadoAdeudos.usuario_sistema?.nombre_completo || 'N/A'}</p>
            </div>
            <div className="detail-group">
              <label>Código Afiliado</label>
              <p className="font-mono">{selectedAfiliadoAdeudos.cod_usuario_afi}</p>
            </div>
            <div className="detail-group">
              <label>Cédula</label>
              <p>{selectedAfiliadoAdeudos.usuario_sistema?.cedula || 'N/A'}</p>
            </div>
            <div className="detail-group">
              <label>Medidor</label>
              <p className="font-mono">{selectedAfiliadoAdeudos.num_medidor || 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* ✅ RESUMEN GENERAL CON DESGLOSE POR CONCEPTOS */}
        {(() => {
          const datosAdeudo = facturasPendientesPorAfiliado[selectedAfiliadoAdeudos.id_usuario_afi];
          const saldoActual = calcularSaldoPendiente(selectedFacturaAdeudos);
          
          // Totales de facturas anteriores
          const consumoAnterior = datosAdeudo?.total_consumo || 0;
          const serviciosAnterior = datosAdeudo?.total_servicios || 0;
          const multasAnterior = datosAdeudo?.total_multas || 0;
          const moraAnterior = datosAdeudo?.total_mora || 0;
          const totalAnterior = datosAdeudo?.total_adeudado || 0;
          
          // Totales de factura actual (del resumen)
          const consumoActual = resumenPago?.desglose?.consumo_subtotal || 0;
          const serviciosActual = resumenPago?.desglose?.servicios_subtotal || 0;
          const multasActual = resumenPago?.multas?.subtotal_sin_iva || 0;
          const moraActual = resumenPago?.mora?.monto || 0;
          
          // Totales generales
          const totalGeneral = totalAnterior + saldoActual;
          const totalConsumo = consumoAnterior + consumoActual;
          const totalServicios = serviciosAnterior + serviciosActual;
          const totalMultas = multasAnterior + multasActual;
          const totalMora = moraAnterior + moraActual;
          
          return (
            <>
              {/* RESUMEN DE MESES */}
              <div className="factura-section">
                <h4 className="section-title">
                  <TrendingUp className="w-4 h-4" />
                  Resumen General
                </h4>
                <div className="adeudos-resumen" style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(4, 1fr)', 
                  gap: '12px',
                  marginBottom: '20px' 
                }}>
                  <div className="adeudo-stat">
                    <span className="adeudo-label">Meses Adeudo</span>
                    <span className="adeudo-value urgente">
                      {datosAdeudo?.meses_adeudo || 0} + 1
                    </span>
                    <span className="text-xs text-gray-500">
                      {(datosAdeudo?.meses_adeudo || 0) + 1} periodos
                    </span>
                  </div>
                  <div className="adeudo-stat">
                    <span className="adeudo-label">Adeudo Anterior</span>
                    <span className="adeudo-value monto">
                      {formatCurrency(totalAnterior)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {datosAdeudo?.total_facturas_pendientes || 0} facturas
                    </span>
                  </div>
                  <div className="adeudo-stat">
                    <span className="adeudo-label">Factura Actual</span>
                    <span className="adeudo-value monto">
                      {formatCurrency(saldoActual)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {selectedFacturaAdeudos.periodo}
                    </span>
                  </div>
                  <div className="adeudo-stat">
                    <span className="adeudo-label">Total General</span>
                    <span className="adeudo-value total">
                      {formatCurrency(totalGeneral)}
                    </span>
                    <span className="text-xs text-red-500 font-semibold">
                      A pagar
                    </span>
                  </div>
                </div>

                {/* ✅ DESGLOSE POR CONCEPTOS */}
                <div style={{
                  backgroundColor: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '16px'
                }}>
                  <h5 style={{ 
                    fontSize: '14px', 
                    fontWeight: 'bold', 
                    color: '#374151',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <DollarSign className="w-4 h-4" />
                    Desglose por Conceptos
                  </h5>
                  
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(4, 1fr)', 
                    gap: '12px' 
                  }}>
                    {/* CONSUMO */}
                    <div style={{
                      backgroundColor: 'white',
                      border: '2px solid #10b981',
                      borderRadius: '8px',
                      padding: '12px',
                      textAlign: 'center'
                    }}>
                      <div style={{ 
                        fontSize: '24px', 
                        marginBottom: '4px' 
                      }}>
                        💧
                      </div>
                      <div style={{ 
                        fontSize: '11px', 
                        color: '#6b7280',
                        marginBottom: '4px',
                        fontWeight: '600'
                      }}>
                        CONSUMO AGUA
                      </div>
                      <div style={{ 
                        fontSize: '18px', 
                        fontWeight: 'bold',
                        color: '#10b981',
                        marginBottom: '2px'
                      }}>
                        {formatCurrency(totalConsumo)}
                      </div>
                      <div style={{ fontSize: '10px', color: '#9ca3af' }}>
                        Ant: {formatCurrency(consumoAnterior)} | 
                        Act: {formatCurrency(consumoActual)}
                      </div>
                    </div>

                    {/* SERVICIOS */}
                    <div style={{
                      backgroundColor: 'white',
                      border: '2px solid #3b82f6',
                      borderRadius: '8px',
                      padding: '12px',
                      textAlign: 'center'
                    }}>
                      <div style={{ 
                        fontSize: '24px', 
                        marginBottom: '4px' 
                      }}>
                        🔧
                      </div>
                      <div style={{ 
                        fontSize: '11px', 
                        color: '#6b7280',
                        marginBottom: '4px',
                        fontWeight: '600'
                      }}>
                        SERVICIOS
                      </div>
                      <div style={{ 
                        fontSize: '18px', 
                        fontWeight: 'bold',
                        color: '#3b82f6',
                        marginBottom: '2px'
                      }}>
                        {formatCurrency(totalServicios)}
                      </div>
                      <div style={{ fontSize: '10px', color: '#9ca3af' }}>
                        Ant: {formatCurrency(serviciosAnterior)} | 
                        Act: {formatCurrency(serviciosActual)}
                      </div>
                    </div>

                    {/* MULTAS */}
                    <div style={{
                      backgroundColor: 'white',
                      border: '2px solid #ef4444',
                      borderRadius: '8px',
                      padding: '12px',
                      textAlign: 'center'
                    }}>
                      <div style={{ 
                        fontSize: '24px', 
                        marginBottom: '4px' 
                      }}>
                        🚨
                      </div>
                      <div style={{ 
                        fontSize: '11px', 
                        color: '#6b7280',
                        marginBottom: '4px',
                        fontWeight: '600'
                      }}>
                        MULTAS
                      </div>
                      <div style={{ 
                        fontSize: '18px', 
                        fontWeight: 'bold',
                        color: '#ef4444',
                        marginBottom: '2px'
                      }}>
                        {formatCurrency(totalMultas)}
                      </div>
                      <div style={{ fontSize: '10px', color: '#9ca3af' }}>
                        Ant: {formatCurrency(multasAnterior)} | 
                        Act: {formatCurrency(multasActual)}
                      </div>
                    </div>

                    {/* MORA */}
                    <div style={{
                      backgroundColor: 'white',
                      border: '2px solid #f59e0b',
                      borderRadius: '8px',
                      padding: '12px',
                      textAlign: 'center'
                    }}>
                      <div style={{ 
                        fontSize: '24px', 
                        marginBottom: '4px' 
                      }}>
                        ⏰
                      </div>
                      <div style={{ 
                        fontSize: '11px', 
                        color: '#6b7280',
                        marginBottom: '4px',
                        fontWeight: '600'
                      }}>
                        MORA
                      </div>
                      <div style={{ 
                        fontSize: '18px', 
                        fontWeight: 'bold',
                        color: '#f59e0b',
                        marginBottom: '2px'
                      }}>
                        {formatCurrency(totalMora)}
                      </div>
                      <div style={{ fontSize: '10px', color: '#9ca3af' }}>
                        Ant: {formatCurrency(moraAnterior)} | 
                        Act: {formatCurrency(moraActual)}
                      </div>
                    </div>
                  </div>

                  {/* TOTAL RESUMIDO */}
                  <div style={{
                    backgroundColor: '#1e293b',
                    color: 'white',
                    borderRadius: '8px',
                    padding: '12px',
                    marginTop: '12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span style={{ fontSize: '14px', fontWeight: 'bold' }}>
                      TOTAL A PAGAR
                    </span>
                    <span style={{ fontSize: '24px', fontWeight: 'bold' }}>
                      {formatCurrency(totalGeneral)}
                    </span>
                  </div>
                </div>
              </div>
            </>
          );
        })()}

        {(() => {
          const datosAdeudo = facturasPendientesPorAfiliado[selectedAfiliadoAdeudos.id_usuario_afi];
          
          if (!datosAdeudo || !datosAdeudo.facturas || datosAdeudo.facturas.length === 0) {
            return (
              <div className="factura-section">
                <div className="empty-state-small">
                  <AlertCircle className="w-8 h-8 text-gray-400" />
                  <p>No hay facturas pendientes anteriores</p>
                </div>
              </div>
            );
          }

          const calcularDiasTranscurridos = (fechaEmision) => {
            // fechaEmision = "2026-01-08"

            const [year, month, day] = fechaEmision.split("-").map(Number);

            // Fecha emisión local REAL (sin UTC)
            const emision = new Date(year, month - 1, day);
            emision.setHours(0, 0, 0, 0);

            // Hoy local REAL
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);

            const diffTime = hoy - emision;
            const diffDays = diffTime / (1000 * 60 * 60 * 24);

            return diffDays;
          };



          // Ordenar facturas por fecha y calcular días transcurridos
          const facturasOrdenadas = [...datosAdeudo.facturas]
            .sort((a, b) => new Date(a.fecha_emision) - new Date(b.fecha_emision))
            .map(factura => ({
              ...factura,
              // ✅ CALCULAR DÍAS TRANSCURRIDOS CORRECTAMENTE
              dias_transcurridos: calcularDiasTranscurridos(factura.fecha_emision)
            }));

          // Debug: verificar cálculos
          console.log('📅 Verificación de días transcurridos:');
          facturasOrdenadas.forEach(f => {
            console.log(`  ${f.periodo}: Emisión ${f.fecha_emision} = ${f.dias_transcurridos} días`);
          });

          // Incluir la factura actual
          const diasActual = calcularDiasTranscurridos(selectedFacturaAdeudos.fecha_emision);
          console.log(`  ACTUAL ${selectedFacturaAdeudos.periodo}: Emisión ${selectedFacturaAdeudos.fecha_emision} = ${diasActual} días`);

          const todasLasFacturas = [
            ...facturasOrdenadas,
            {
              id_factura: selectedFacturaAdeudos.id_factura,
              num_factura: selectedFacturaAdeudos.num_factura,
              periodo: selectedFacturaAdeudos.periodo,
              fecha_emision: selectedFacturaAdeudos.fecha_emision,
              total_factura: parseFloat(selectedFacturaAdeudos.total),
              saldo_pendiente: calcularSaldoPendiente(selectedFacturaAdeudos),
              consumo_m3: selectedFacturaAdeudos.consumo_m3,
              estado_factura: selectedFacturaAdeudos.estado_factura,
              // ✅ USAR LA FUNCIÓN CORREGIDA
              dias_transcurridos: diasActual,
              es_actual: true,
              
              desglose: {
                consumo: {
                  subtotal: resumenPago?.desglose?.consumo_subtotal || 0,
                  iva: (resumenPago?.desglose?.consumo_subtotal || 0) * (resumenPago?.iva?.tasa || 0),
                  total: (resumenPago?.desglose?.consumo_subtotal || 0) * (1 + (resumenPago?.iva?.tasa || 0))
                },
                servicios: {
                  cantidad: 0,
                  subtotal: resumenPago?.desglose?.servicios_subtotal || 0,
                  iva: (resumenPago?.desglose?.servicios_subtotal || 0) * (resumenPago?.iva?.tasa || 0),
                  total: (resumenPago?.desglose?.servicios_subtotal || 0) * (1 + (resumenPago?.iva?.tasa || 0))
                },
                multas: {
                  cantidad: resumenPago?.multas?.cantidad || 0,
                  subtotal: resumenPago?.multas?.subtotal_sin_iva || 0,
                  iva: resumenPago?.multas?.iva || 0,
                  total: resumenPago?.multas?.total_con_iva || 0
                }
              },
              iva: resumenPago?.iva || { tasa: 0, porcentaje: 0 },
              mora: {
                dias_mora_efectivos: resumenPago?.mora?.dias_mora_efectivos || 0,
                aplica: resumenPago?.mora?.aplica || false,
                monto: resumenPago?.mora?.monto || 0
              },
              total_con_mora: calcularSaldoPendiente(selectedFacturaAdeudos) + (resumenPago?.mora?.monto || 0)
            }
          ];
          // Función de cálculo de total
          const calcularTotalSeleccionadas = () => {
            if (facturasSeleccionadasPago.length === 0) return 0;
            
            if (facturasSeleccionadasPago.length === todasLasFacturas.length) {
              const saldoActual = calcularSaldoPendiente(selectedFacturaAdeudos);
              const totalGeneral = (datosAdeudo?.total_adeudado || 0) + saldoActual;
              return totalGeneral;
            }
            
            const soloAnteriores = facturasSeleccionadasPago.every(f => !f.es_actual);
            if (soloAnteriores) {
              return facturasSeleccionadasPago.reduce((sum, f) => 
                sum + parseFloat(f.total_con_mora || f.saldo_pendiente || 0), 0
              );
            }
            
            const incluyeActual = facturasSeleccionadasPago.some(f => f.es_actual);
            if (incluyeActual) {
              let total = 0;
              
              facturasSeleccionadasPago.forEach(f => {
                if (f.es_actual) {
                  total += calcularSaldoPendiente(selectedFacturaAdeudos);
                } else {
                  total += parseFloat(f.total_con_mora || f.saldo_pendiente || 0);
                }
              });
              
              return total;
            }
            
            return 0;
          };

          return (
            <div className="factura-section">
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '16px' 
              }}>
                <h4 className="section-title">
                  <FileText className="w-4 h-4" />
                  Detalles por Periodos ({todasLasFacturas.length})
                </h4>
                
                {/* BOTONES DE SELECCIÓN */}
                {todasLasFacturas.length <= 5 && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                      onClick={() => {
                        if (facturasSeleccionadasPago.length === todasLasFacturas.length) {
                          setFacturasSeleccionadasPago([]);
                        } else {
                          setFacturasSeleccionadasPago(todasLasFacturas);
                        }
                      }}
                    >
                      {facturasSeleccionadasPago.length === todasLasFacturas.length ? 
                        '☑️ Deseleccionar Todas' : 
                        '☐ Seleccionar Todas'
                      }
                    </button>
                    
                    {facturasSeleccionadasPago.length > 0 && (
                      <span style={{
                        padding: '6px 12px',
                        backgroundColor: '#eff6ff',
                        color: '#2563eb',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}>
                        {facturasSeleccionadasPago.length} seleccionadas
                      </span>
                    )}
                  </div>
                )}

                {todasLasFacturas.length > 5 && (
                  <div style={{
                    backgroundColor: '#fef3c7',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#92400e'
                  }}>
                    ⚠️ Más de 5 facturas. Pago múltiple no disponible.
                  </div>
                )}
              </div>
              
              <div className="adeudos-desglose-list">
                {todasLasFacturas.map((factura, index) => {
                  const esActual = factura.es_actual === true;
                  const estaSeleccionada = facturasSeleccionadasPago.some(f => f.id_factura === factura.id_factura);
                  const puedeSeleccionar = todasLasFacturas.length <= 5;
                  
                  // ✅ Usar desglose del endpoint
                  const desglose = factura.desglose || { consumo: {}, servicios: {}, multas: {} };
                  const consumoTotal = desglose.consumo?.total || 0;
                  const serviciosTotal = desglose.servicios?.total || 0;
                  const multasTotal = desglose.multas?.total || 0;
                  const moraTotal = factura.mora?.monto || 0;
                    // ✅ CALCULAR DÍAS DE MORA (para facturas anteriores)
                  //const diasMoraEfectivos = factura.mora?.dias_mora_efectivos || 0;
                  //const diasTranscurridos = factura.dias_transcurridos || 0;
                  
                  return (
                    <div 
                      key={factura.id_factura} 
                      className={`adeudo-periodo-card ${esActual ? 'periodo-actual' : ''} ${estaSeleccionada ? 'factura-seleccionada' : ''}`}
                      style={{
                        border: estaSeleccionada ? '2px solid #10b981' : 
                                esActual ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                        backgroundColor: estaSeleccionada ? '#f0fdf4' :
                                        esActual ? '#eff6ff' : 'white',
                        padding: '16px',
                        borderRadius: '8px',
                        marginBottom: '12px',
                        position: 'relative',
                        cursor: puedeSeleccionar ? 'pointer' : 'default'
                      }}
                      onClick={() => puedeSeleccionar && toggleFacturaParaPago(factura)}
                    >
                      {/* CHECKBOX */}
                      {puedeSeleccionar && (
                        <div style={{
                          position: 'absolute',
                          top: '12px',
                          right: '12px'
                        }}>
                          <input
                            type="checkbox"
                            checked={estaSeleccionada}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleFacturaParaPago(factura);
                            }}
                            style={{
                              width: '20px',
                              height: '20px',
                              cursor: 'pointer'
                            }}
                          />
                        </div>
                      )}

                      {/* Header */}
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        marginBottom: '12px',
                        paddingBottom: '12px',
                        borderBottom: '1px solid #e5e7eb',
                        paddingRight: puedeSeleccionar ? '40px' : '0'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{
                            backgroundColor: esActual ? '#3b82f6' : '#6b7280',
                            color: 'white',
                            padding: '4px 12px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}>
                            {esActual ? 'PERIODO ACTUAL' : `PERIODO ${index + 1}`}
                          </span>
                          <span style={{ 
                            fontFamily: 'monospace', 
                            fontSize: '14px',
                            fontWeight: 'bold'
                          }}>
                            {factura.num_factura}
                          </span>
                          <span style={{
                            backgroundColor: factura.estado_factura === 'vencida' ? '#fef3c7' : '#e5e7eb',
                            color: factura.estado_factura === 'vencida' ? '#d97706' : '#6b7280',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '600',
                            textTransform: 'uppercase'
                          }}>
                            {factura.estado_factura}
                          </span>
                        </div>
                        <span style={{ 
                          fontSize: '16px', 
                          fontWeight: 'bold',
                          color: esActual ? '#3b82f6' : '#1f2937'
                        }}>
                          {factura.periodo}
                        </span>
                      </div>

                      {/* ✅ DESGLOSE POR CONCEPTOS */}
                      <div style={{
                        backgroundColor: '#f9fafb',
                        borderRadius: '6px',
                        padding: '12px',
                        marginBottom: '12px'
                      }}>
                        <div style={{ 
                          fontSize: '12px', 
                          fontWeight: '600', 
                          color: '#6b7280',
                          marginBottom: '8px'
                        }}>
                          Desglose de Conceptos:
                        </div>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(2, 1fr)',
                          gap: '8px'
                        }}>
                          {/* Consumo */}
                          {consumoTotal > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                              <span style={{ color: '#10b981' }}>💧 Consumo ({factura.consumo_m3 || 0} m³):</span>
                              <span style={{ fontWeight: 'bold', color: '#10b981' }}>
                                {formatCurrency(consumoTotal)}
                              </span>
                            </div>
                          )}
                          
                          {/* Servicios */}
                          {serviciosTotal > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                              <span style={{ color: '#3b82f6' }}>🔧 Servicios:</span>
                              <span style={{ fontWeight: 'bold', color: '#3b82f6' }}>
                                {formatCurrency(serviciosTotal)}
                              </span>
                            </div>
                          )}
                          
                          {/* Multas */}
                          {multasTotal > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                              <span style={{ color: '#ef4444' }}>
                                🚨 Multas ({desglose.multas?.cantidad || 0}):
                              </span>
                              <span style={{ fontWeight: 'bold', color: '#ef4444' }}>
                                {formatCurrency(multasTotal)}
                              </span>
                            </div>
                          )}
                          
                          {/* Mora */}
                          {moraTotal > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                              <span style={{ color: '#f59e0b' }}>
                                ⏰ Mora ({factura.mora?.dias_mora_efectivos || 0} días):
                              </span>
                              <span style={{ fontWeight: 'bold', color: '#f59e0b' }}>
                                {formatCurrency(moraTotal)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Información básica */}
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(3, 1fr)', 
                        gap: '12px',
                        marginBottom: '12px'
                      }}>
                        <div>
                          <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>
                            <Calendar className="w-3 h-3 inline mr-1" />
                            Fecha Emisión
                          </div>
                          <div style={{ fontSize: '13px', fontWeight: '500' }}>
                            {formatDateShort(factura.fecha_emision)}
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>
                            <Clock className="w-3 h-3 inline mr-1" />
                            Días Transcurridos
                          </div>
                          <div style={{ 
                            fontSize: '13px', 
                            fontWeight: 'bold',
                            color: factura.dias_transcurridos > 30 ? '#ef4444' : '#f59e0b'
                          }}>
                            {factura.dias_transcurridos} días
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>
                            IVA ({factura.iva?.porcentaje || 0}%)
                          </div>
                         
                        </div>
                      </div>

                      {/* Total con mora */}
                      <div style={{
                        backgroundColor: estaSeleccionada ? '#d1fae5' :
                                        esActual ? '#dbeafe' : '#f3f4f6',
                        padding: '10px',
                        borderRadius: '6px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                          Total a Pagar (este periodo)
                        </span>
                        <span style={{ 
                          fontSize: '16px', 
                          fontWeight: 'bold', 
                          color: estaSeleccionada ? '#059669' :
                                  esActual ? '#2563eb' : '#1f2937'
                        }}>
                          {formatCurrency(factura.total_con_mora)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* PANEL DE PAGO MÚLTIPLE */}
              {todasLasFacturas.length <= 5 && facturasSeleccionadasPago.length > 1 && (
                <div style={{
                  backgroundColor: '#eff6ff',
                  border: '2px solid #3b82f6',
                  padding: '16px',
                  borderRadius: '8px',
                  marginTop: '16px'
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
                      <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                        Total a Pagar
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e40af' }}>
                        {formatCurrency(calcularTotalSeleccionadas())}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Recomendación */}
              <div style={{
                backgroundColor: '#fef3c7',
                border: '1px solid #fde68a',
                padding: '12px',
                borderRadius: '8px',
                marginTop: '16px',
                display: 'flex',
                gap: '12px'
              }}>
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <div>
                  <p style={{ fontSize: '13px', color: '#92400e', fontWeight: '600', marginBottom: '4px' }}>
                    Recomendación
                  </p>
                  <p style={{ fontSize: '12px', color: '#78350f' }}>
                    {todasLasFacturas.length <= 5 ? (
                      <>
                        Puede seleccionar múltiples facturas para pagar todo de una vez. 
                        Los conceptos mostrados incluyen IVA. La mora se calcula automáticamente.
                      </>
                    ) : (
                      <>
                        Tiene más de 5 facturas pendientes. Para pagar todo, deberá hacerlo en varios pagos.
                        Recomendamos pagar las facturas más antiguas primero.
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>
          );
        })()}

      </div>

      <div className="modal-footer">
        <button className="btn-secondary" onClick={closeAdeudosModal}>
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

      {/* MODAL CONFIRMACIÓN PAGO MÚLTIPLE */}
      {showPagoMultipleModal && facturasSeleccionadasPago.length > 1 && (() => {
        // ========================================
        // 🔧 CALCULAR TOTAL CORRECTO AQUÍ
        // ========================================
        const datosAdeudo = facturasPendientesPorAfiliado[selectedAfiliadoAdeudos?.id_usuario_afi];
        
        const calcularTotalPagoMultiple = () => {
          if (facturasSeleccionadasPago.length === 0) return 0;
          
          // Contar cuántas facturas hay en total (anteriores + actual)
          const totalFacturasDisponibles = (datosAdeudo?.facturas?.length || 0) + 1;
          
          // Si están TODAS seleccionadas, usar el total del resumen general
          if (facturasSeleccionadasPago.length === totalFacturasDisponibles) {
            const saldoActual = calcularSaldoPendiente(selectedFacturaAdeudos);
            const totalGeneral = (datosAdeudo?.total_adeudado || 0) + saldoActual;
            return totalGeneral;
          }
          
          // Si son SOLO facturas anteriores (sin la actual)
          const soloAnteriores = facturasSeleccionadasPago.every(f => !f.es_actual);
          if (soloAnteriores) {
            return facturasSeleccionadasPago.reduce((sum, f) => 
              sum + parseFloat(f.total_con_mora || f.saldo_pendiente || 0), 0
            );
          }
          
          // Si incluye la factura actual
          const incluyeActual = facturasSeleccionadasPago.some(f => f.es_actual);
          if (incluyeActual) {
            let total = 0;
            
            facturasSeleccionadasPago.forEach(f => {
              if (f.es_actual) {
                // Para la factura actual, usar saldo pendiente
                total += calcularSaldoPendiente(selectedFacturaAdeudos);
              } else {
                // Para facturas anteriores, usar total_con_mora
                total += parseFloat(f.total_con_mora || f.saldo_pendiente || 0);
              }
            });
            
            return total;
          }
          
          return 0;
        };

        const totalAPagar = calcularTotalPagoMultiple();

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
                {/* RESUMEN DE FACTURAS */}
                <div className="factura-section">
                  <h4 className="section-title">
                    <FileText className="w-4 h-4" />
                    Facturas a Pagar
                  </h4>
                  
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {facturasSeleccionadasPago.map((factura, idx) => {
                      // 🔧 CALCULAR MONTO CORRECTO POR FACTURA
                      let montoFactura;
                      if (factura.es_actual) {
                        // Factura actual: usar saldo pendiente
                        montoFactura = calcularSaldoPendiente(selectedFacturaAdeudos);
                      } else {
                        // Facturas anteriores: usar total_con_mora
                        montoFactura = factura.total_con_mora || factura.saldo_pendiente || 0;
                      }

                      return (
                        <div 
                          key={factura.id_factura}
                          style={{
                            backgroundColor: '#f9fafb',
                            padding: '12px',
                            borderRadius: '8px',
                            marginBottom: '8px',
                            border: '1px solid #e5e7eb'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <span style={{ fontWeight: 'bold', fontSize: '14px' }}>
                                {idx + 1}. {factura.num_factura}
                              </span>
                              <span style={{ 
                                marginLeft: '12px',
                                fontSize: '12px',
                                color: '#6b7280'
                              }}>
                                {factura.periodo}
                              </span>
                              {/* 🔧 MOSTRAR SI ES ACTUAL */}
                              {factura.es_actual && (
                                <span style={{
                                  marginLeft: '8px',
                                  backgroundColor: '#3b82f6',
                                  color: 'white',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '10px',
                                  fontWeight: 'bold'
                                }}>
                                  ACTUAL
                                </span>
                              )}
                              {/* 🔧 MOSTRAR SI TIENE MORA */}
                              {factura.mora_aplicable && factura.mora_monto > 0 && (
                                <span style={{
                                  marginLeft: '8px',
                                  backgroundColor: '#fef3c7',
                                  color: '#92400e',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '10px',
                                  fontWeight: 'bold'
                                }}>
                                  + Mora: {formatCurrency(factura.mora_monto)}
                                </span>
                              )}
                            </div>
                            <span style={{ fontWeight: 'bold', fontSize: '15px', color: '#1f2937' }}>
                              {formatCurrency(montoFactura)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* TOTAL */}
                  <div style={{
                    backgroundColor: '#eff6ff',
                    padding: '16px',
                    borderRadius: '8px',
                    marginTop: '16px',
                    border: '2px solid #3b82f6'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e40af' }}>
                        TOTAL A PAGAR
                      </span>
                      <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e40af' }}>
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
                  backgroundColor: '#fef3c7',
                  border: '1px solid #fde68a',
                  padding: '12px',
                  borderRadius: '8px',
                  marginTop: '16px',
                  display: 'flex',
                  gap: '12px'
                }}>
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <div>
                    <p style={{ fontSize: '13px', color: '#92400e', fontWeight: '600', marginBottom: '4px' }}>
                      Importante
                    </p>
                    <p style={{ fontSize: '12px', color: '#78350f' }}>
                      Este pago se aplicará a todas las facturas seleccionadas. 
                      Se generará un comprobante único con el detalle de todas las facturas pagadas.
                      {facturasSeleccionadasPago.some(f => f.mora_aplicable) && (
                        <strong> La mora ya está incluida en el total mostrado.</strong>
                      )}
                      {facturasSeleccionadasPago.some(f => f.es_actual) && (
                        <strong> La mora de la factura actual se calculará automáticamente al procesar el pago.</strong>
                      )}
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
                      <CheckCircle className="w-4 h-4 mr-2"/>
                      Confirmar Pago Múltiple
                      <span style={{
                        marginLeft: '8px',
                        padding: '4px 8px',
                        backgroundColor: 'rgba(255,255,255,0.3)',
                        borderRadius: '4px',
                        fontWeight: 'bold'
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

      {/* COMPROBANTE DE PAGO */}
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