// src/sections/PaymentsSection.js
// MÓDULO DE PAGOS - Con sistema de periodos mensuales

import React, { useState, useEffect, useCallback } from 'react';
import './PaymentsSection.css'; // Reutilizar estilos similares a InvoicesSection

import PaymentReceipt, { generatePaymentPDF } from '../../components/PaymentReceipt';

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
  Plus,
  Wallet, XCircle, FileCheck, ChevronDown, Calculator
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
  const [montosFactura, ] = useState(null);

  // Estado para almacenar facturas pendientes por afiliado
  const [facturasPendientesPorAfiliado, setFacturasPendientesPorAfiliado] = useState({});
  const [, setLoadingFacturasPendientes] = useState(false);
 // Estado para controlar qué sección de adeudos está expandida
  const [adeudosExpandidoPorAfiliado, setAdeudosExpandidoPorAfiliado] = useState({});

    // Función helper para toggle
  const toggleAdeudos = (idAfiliado) => {
    setAdeudosExpandidoPorAfiliado(prev => ({
      ...prev,
      [idAfiliado]: !prev[idAfiliado]
    }));
  };

  // ✅ Estados para pago masivo
  const [facturasPendientesExpandido, setFacturasPendientesExpandido] = useState(false);
  const [facturasSeleccionadas, setFacturasSeleccionadas] = useState({});
  const [montoPagoMasivo, setMontoPagoMasivo] = useState(0);

  /**
   * Toggle selección de factura
   */
  const toggleSeleccionFactura = (idFactura, esObligatoria) => {
    if (esObligatoria) {
      alert('⚠️ La factura del periodo actual es obligatoria y no puede ser deseleccionada.');
      return;
    }
    
    setFacturasSeleccionadas(prev => ({
      ...prev,
      [idFactura]: !prev[idFactura]
    }));
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
  };

  // ============================================================
  // FUNCIÓN PARA CARGAR TODAS LAS FACTURAS
  // ============================================================

 /**
 * Cargar facturas pendientes de un afiliado específico
 */
const cargarFacturasPendientesAfiliado = useCallback(async (idUsuarioAfi) => {
  if (!idUsuarioAfi) return null;
  
  // ✅ Verificar que periodoSeleccionado existe
  if (!periodoSeleccionado) {
    console.warn('⚠️ No hay periodo seleccionado para cargar facturas pendientes');
    return null;
  }
  
  // Si ya está cacheado, retornar
  if (facturasPendientesPorAfiliado[idUsuarioAfi]) {
    console.log('💾 Usando facturas pendientes desde caché');
    return facturasPendientesPorAfiliado[idUsuarioAfi];
  }
  
  setLoadingFacturasPendientes(true);
  
  try {
    // ✅ Generar periodo de forma segura
    const periodoStr = `${periodoSeleccionado.anio}-${String(periodoSeleccionado.mes).padStart(2, '0')}`;
    
    console.log(`🔍 Cargando facturas pendientes para afiliado ${idUsuarioAfi}, periodo: ${periodoStr}`);
    
    const result = await paymentsServices.getFacturasPendientesAfiliado(
      idUsuarioAfi, 
      periodoStr, 
      false  // No aplicar mora en BD
    );
    
    if (result.success && result.data) {
      console.log(`✅ Facturas pendientes cargadas:`, {
        afiliado: idUsuarioAfi,
        meses_adeudo: result.data.meses_adeudo,
        total_adeudado: result.data.total_adeudado
      });
      
      // Cachear resultado
      setFacturasPendientesPorAfiliado(prev => ({
        ...prev,
        [idUsuarioAfi]: result.data
      }));
      
      return result.data;
    } else {
      console.warn(`⚠️ No se pudieron cargar facturas pendientes para afiliado ${idUsuarioAfi}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error cargando facturas pendientes para afiliado ${idUsuarioAfi}:`, error);
    return null;
  } finally {
    setLoadingFacturasPendientes(false);
  }
}, [periodoSeleccionado, facturasPendientesPorAfiliado]);  // ✅ Agregar dependencias


const fetchFacturasPeriodo = useCallback(async () => {
  // ✅ Validación temprana
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

      // ✅ Cargar facturas pendientes de cada afiliado único
      const afiliadosUnicos = [
        ...new Set(
          result.data
            .map(f => f.usuario_afiliado?.id_usuario_afi)
            .filter(Boolean)
        )
      ];
      
      console.log(`👥 Cargando adeudos para ${afiliadosUnicos.length} afiliados únicos`);
      
      // Cargar en paralelo con manejo de errores
      const promesas = afiliadosUnicos.map(idAfi => 
        cargarFacturasPendientesAfiliado(idAfi).catch(err => {
          console.error(`Error cargando adeudos del afiliado ${idAfi}:`, err);
          return null; // No fallar todo si uno falla
        })
      );
      
      await Promise.all(promesas);
      
      console.log('✅ Adeudos cargados para todos los afiliados');
      
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
  cargarFacturasPendientesAfiliado  // ✅ Incluir dependencia
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
  
  // ✅ BÚSQUEDA: Solo por factura, afiliado, cédula, medidor, código
  const matchesSearch =
    factura.num_factura?.toLowerCase().includes(searchLower) ||
    factura.usuario_afiliado?.cod_usuario_afi?.toString().includes(searchTerm) ||
    factura.usuario_afiliado?.num_medidor?.toLowerCase().includes(searchLower) ||
    factura.usuario_afiliado?.usuario_sistema?.nombres?.toLowerCase().includes(searchLower) ||
    factura.usuario_afiliado?.usuario_sistema?.apellidos?.toLowerCase().includes(searchLower) ||
    factura.usuario_afiliado?.usuario_sistema?.cedula?.includes(searchTerm);

  // ✅ FILTRO DE ESTADO DE FACTURA
  const matchesStatus = filterStatus === 'all' || factura.estado_factura === filterStatus;

  // ✅ FILTRO DE MÉTODO DE PAGO (corregido para array de pagos)
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
  // FUNCIONES DE CREAR PAGO
  // ============================================================
  const openCreateModal = () => {
    if (!permissions.canCreate) {
      alert('❌ No tienes permiso para registrar pagos');
      return;
    }

    setNuevoPago({
      id_factura: '',
      id_usuario_afi: '',
      monto_pago: '',
      metodo_pago: 'EFECTIVO',
      observaciones: ''
    });
    setSelectedFactura(null);
    setShowCreateModal(true);
  };

/**
 * Función para abrir modal de pago CON factura específica
 * Ahora incluye todas las facturas pendientes del afiliado
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

    // ✅ 1. Cargar todas las facturas pendientes del afiliado
    const facturasPendientes = await cargarFacturasPendientesAfiliado(idAfiliado);
    
    // ✅ 2. Calcular resumen con mora de la factura seleccionada
    const resultado = await paymentsServices.calcularResumenPago(factura.id_factura);
    
    // Variables para las facturas a pagar
    let facturasOrdenadas = [];
    let facturasSeleccionadas = [];
    let totalAdeudado = saldoPendiente;
    
    // ✅ 3. Procesar facturas pendientes si existen
    if (facturasPendientes && facturasPendientes.tiene_deuda && facturasPendientes.facturas.length > 0) {
      // Ordenar por fecha (más antiguas primero)
      facturasOrdenadas = facturasPendientes.facturas.sort((a, b) => 
        new Date(a.fecha_emision) - new Date(b.fecha_emision)
      );
      
      // Por defecto, seleccionar todas las facturas pendientes
      facturasSeleccionadas = facturasOrdenadas.map(f => f.id_factura);
      
      // Usar el total calculado por el backend (incluye mora)
      totalAdeudado = facturasPendientes.total_adeudado;
      
      console.log('✅ Facturas pendientes cargadas:', {
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

    // ✅ 4. Validar y guardar resumen de pago
    if (resultado.success) {
      console.log('✅ Resumen de pago cargado:', resultado.data);
      
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

  /**
   * Seleccionar todas las facturas
   */
  const seleccionarTodasFacturas = () => {
    const idAfiliado = selectedFactura?.usuario_afiliado?.id_usuario_afi;
    const datos = facturasPendientesPorAfiliado[idAfiliado];
    
    if (datos && datos.facturas) {
      const todasSeleccionadas = {};
      datos.facturas.forEach(f => {
        todasSeleccionadas[f.id_factura] = true;
      });
      todasSeleccionadas[selectedFactura.id_factura] = true;
      setFacturasSeleccionadas(todasSeleccionadas);
    }
  };

  /**
   * Deseleccionar facturas (excepto la obligatoria)
   */
  const deseleccionarFacturas = () => {
    // Solo mantener la factura actual seleccionada
    setFacturasSeleccionadas({
      [selectedFactura.id_factura]: true
    });
  };

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
  // FUNCIÓN PARA CREAR PAGO CON OPCIÓN DE MULTAS
  // ============================================================
  /**
 * Procesar pago masivo de múltiples facturas
 */
const handlePagoMasivo = async () => {
  try {
    // Validar que haya facturas seleccionadas
    const facturasAPagar = Object.keys(facturasSeleccionadas).filter(
      id => facturasSeleccionadas[id]
    );
    
    if (facturasAPagar.length === 0) {
      alert('❌ Debe seleccionar al menos una factura para pagar');
      return;
    }
    
    // Validar que la factura actual esté incluida
    if (!facturasSeleccionadas[selectedFactura.id_factura]) {
      alert('❌ La factura del periodo actual es obligatoria');
      return;
    }
    
    // Confirmar pago
    const idAfiliado = selectedFactura.usuario_afiliado?.id_usuario_afi;
    const datosAdeudo = facturasPendientesPorAfiliado[idAfiliado];
    
    let mensaje = `¿Confirma el pago de ${facturasAPagar.length} factura(s)?\n\n`;
    mensaje += `💰 Total a pagar: ${formatCurrency(montoPagoMasivo)}\n`;
    mensaje += `💳 Método: ${nuevoPago.metodo_pago}\n\n`;
    mensaje += `Facturas a pagar:\n`;
    
    // Listar facturas pendientes seleccionadas
    if (datosAdeudo && datosAdeudo.facturas) {
      datosAdeudo.facturas.forEach(f => {
        if (facturasSeleccionadas[f.id_factura]) {
          mensaje += `• ${f.num_factura} - ${f.periodo}: ${formatCurrency(f.total_con_mora)}\n`;
        }
      });
    }
    
    // Factura actual
    const saldoActual = calcularSaldoPendiente(selectedFactura);
    const moraActual = resumenPago?.mora?.monto || 0;
    mensaje += `• ${selectedFactura.num_factura} - ${selectedFactura.periodo} (ACTUAL): ${formatCurrency(saldoActual + moraActual)}\n`;
    
    if (!window.confirm(mensaje)) return;
    
    setLoading(true);
    setError(null);
    
    const currentUser = authService.getCurrentUser();
    if (!currentUser || !currentUser.id_usuario_sistema) {
      throw new Error('No se pudo identificar al usuario actual');
    }
    
    // Preparar datos para pago masivo
    const pagoMasivoData = {
      id_usuario_afi: selectedFactura.usuario_afiliado.id_usuario_afi,
      monto_total: montoPagoMasivo,
      metodo_pago: nuevoPago.metodo_pago || 'EFECTIVO',
      id_cajero: currentUser.id_usuario_sistema,
      observaciones: nuevoPago.observaciones || null,
      facturas: []
    };
    
    // Agregar facturas pendientes seleccionadas
    if (datosAdeudo && datosAdeudo.facturas) {
      datosAdeudo.facturas.forEach(f => {
        if (facturasSeleccionadas[f.id_factura]) {
          pagoMasivoData.facturas.push({
            id_factura: f.id_factura,
            monto: f.total_con_mora,
            incluir_multas: true,
            es_factura_actual: false
          });
        }
      });
    }
    
    // Agregar factura actual
    pagoMasivoData.facturas.push({
      id_factura: selectedFactura.id_factura,
      monto: saldoActual + moraActual,
      incluir_multas: resumenPago?.multas?.tiene_multas || false,
      es_factura_actual: true
    });
    
    console.log('📤 Procesando pago masivo:', pagoMasivoData);
    
    // Llamar al servicio
    const result = await paymentsServices.createPagoMasivo(pagoMasivoData);
    
    if (!result.success) {
      throw new Error(result.message || 'Error al procesar el pago masivo');
    }
    
    console.log('✅ Pago masivo procesado:', result.data);
    
    // Cerrar modal
    closeCreateModal();
    
    // Recargar datos
    await Promise.all([fetchFacturasPeriodo(), fetchStats()]);
    
    // Limpiar selección
    setFacturasSeleccionadas({});
    setMontoPagoMasivo(0);
    
    // Mensaje de éxito
    alert(
      `✅ Pago masivo registrado exitosamente\n\n` +
      `💵 Total pagado: ${formatCurrency(montoPagoMasivo)}\n` +
      `📝 Facturas pagadas: ${result.data.facturas_procesadas}\n` +
      `💳 Método: ${nuevoPago.metodo_pago}`
    );
    
  } catch (error) {
    console.error('❌ Error en pago masivo:', error);
    setError(error.message);
    alert(`❌ Error al procesar pago masivo:\n${error.message}`);
  } finally {
    setLoading(false);
  }
};


    const handleCreatePago = async (incluirMultas = true) => {
      // VALIDACIONES INICIALES
      if (!nuevoPago.monto_pago || parseFloat(nuevoPago.monto_pago) <= 0) {
        alert('❌ El monto debe ser mayor a 0');
        return;
      }

      let montoAPagar = parseFloat(nuevoPago.monto_pago);
      
      // Si hay una factura seleccionada, validar y ajustar montos
      if (selectedFactura && montosFactura) {
        const totalSinMultas = montosFactura.total_sin_multas || 0;
        const totalConMultas = montosFactura.total_factura || 0;
        const totalMultas = montosFactura.total_multas || 0;

        // ⭐ AJUSTAR MONTO AUTOMÁTICAMENTE SI NO INCLUYE MULTAS
        if (!incluirMultas) {
          // Usar el total sin multas como monto a pagar
          montoAPagar = totalSinMultas;

          // Confirmación con el monto correcto
          const confirmar = window.confirm(
            `¿Confirma el pago de $${montoAPagar.toFixed(2)} SIN incluir multas?\n\n` +
            `📊 Desglose:\n` +
            `• Total sin multas: $${totalSinMultas.toFixed(2)}\n` +
            `• Multas pendientes: $${totalMultas.toFixed(2)}\n\n` +
            `⚠️ Las multas quedarán pendientes para la próxima factura.`
          );
          
          if (!confirmar) return;
        } else {
          // Validar que el monto no exceda el total con multas
          if (montoAPagar > totalConMultas) {
            const confirmar = window.confirm(
              `⚠️ El monto $${montoAPagar.toFixed(2)} excede el total de la factura $${totalConMultas.toFixed(2)}.\n\n` +
              `¿Desea continuar de todas formas?`
            );
            if (!confirmar) return;
          }
        }
      }

      setLoading(true);
      setError(null);

      try {
        const currentUser = authService.getCurrentUser();
        if (!currentUser || !currentUser.id_usuario_sistema) {
          throw new Error('No se pudo identificar al usuario actual');
        }

        // PREPARAR DATOS DEL PAGO CON EL MONTO AJUSTADO
        const pagoData = {
          id_factura: nuevoPago.id_factura ? parseInt(nuevoPago.id_factura) : null,
          monto_pago: montoAPagar,  // ⭐ USAR EL MONTO AJUSTADO
          metodo_pago: nuevoPago.metodo_pago || 'EFECTIVO',
          id_usuario_afi: nuevoPago.id_usuario_afi ? parseInt(nuevoPago.id_usuario_afi) : null,
          id_cajero: currentUser.id_usuario_sistema,
          observaciones: nuevoPago.observaciones || null,
          incluir_multas: incluirMultas  // ⭐ PARÁMETRO CLAVE
        };

        console.log('📤 Creando pago:', pagoData);

        // CREAR EL PAGO
        const result = await paymentsServices.createPago(pagoData);

        if (!result.success) {
          throw new Error(result.message || 'Error al crear el pago');
        }

        const pagoCreado = result.data;
        console.log('✅ Pago creado exitosamente:', pagoCreado);

        // GENERAR Y GUARDAR COMPROBANTE PDF
        let comprobanteGuardado = false;
        let errorComprobante = null;

        try {
          console.log('📄 Generando comprobante PDF...');
          const pdfFile = await generatePaymentPDF(pagoCreado, selectedFactura);
          
          if (!pdfFile || pdfFile.size === 0) {
            throw new Error('El PDF generado está vacío');
          }

          console.log('📤 Subiendo comprobante...');
          await paymentsServices.uploadComprobante(pagoCreado.id_pago, pdfFile);
          console.log('✅ Comprobante guardado');
          comprobanteGuardado = true;
        } catch (pdfError) {
          errorComprobante = pdfError.message;
          console.error('⚠️ Error con el comprobante:', pdfError);
        }

        // CERRAR MODAL Y ACTUALIZAR
        closeCreateModal();
        setPagoRegistrado(pagoCreado);
        setFacturaDelPago(selectedFactura);

        // RECARGAR DATOS
        await Promise.all([fetchFacturasPeriodo(), fetchStats()]);
        console.log('✅ Datos recargados');

        // MENSAJE DE ÉXITO
        let mensaje = '✅ Pago registrado exitosamente\n\n';
        mensaje += `💵 Monto: $${montoAPagar.toFixed(2)}\n`;
        mensaje += `💳 Método: ${pagoData.metodo_pago}\n`;
        
        if (!incluirMultas && montosFactura && montosFactura.tiene_multas) {
          mensaje += `\n⚠️ Las multas ($${montosFactura.total_multas.toFixed(2)}) quedaron pendientes para la próxima factura.`;
        }
        
        if (comprobanteGuardado) {
          mensaje += '\n\n📄 Comprobante guardado correctamente.';
        } else if (errorComprobante) {
          mensaje += `\n\n⚠️ Advertencia: ${errorComprobante}`;
        }
        
        alert(mensaje);
        
        // MOSTRAR COMPROBANTE VISUAL
        setShowReceipt(true);

      } catch (error) {
        console.error('❌ Error al registrar pago:', error);
        setError(error.message || 'Error al registrar el pago');
        alert(`❌ Error al registrar pago:\n${error.message || 'Error desconocido'}`);
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

    if (!factura.pago) {
      alert('❌ Esta factura no tiene pago registrado');
      return;
    }

    // Confirmación
    const confirmar = window.confirm(
      `⚠️ ¿Estás seguro de anular el pago de la factura ${factura.num_factura}?\n\n` +
      `• Monto: ${formatCurrency(factura.pago.monto_pago)}\n` +
      `• Método: ${factura.pago.metodo_pago}\n` +
      `• Cajero: ${factura.pago.cajero}\n\n` +
      `Se generará una nueva factura con los mismos datos.`
    );

    if (!confirmar) return;

    // Solicitar motivo
    const motivo = window.prompt(
      'Motivo de anulación (requerido):',
      'Anulación solicitada por cliente'
    );

    if (motivo === null) return;
    
    if (!motivo || motivo.trim() === '') {
      alert('❌ Debes especificar un motivo de anulación');
      return;
    }

    setLoading(true);

    try {
      console.log('🔄 Anulando pago y regenerando factura...');
      
      const result = await paymentsServices.anularPagoConRegeneracion(
        factura.pago.id_pago,
        motivo.trim()
      );
      
      if (result.success) {
        alert(
          `✅ Pago anulado correctamente\n\n` +
          `Nueva factura generada: ${result.data.nueva_factura.num_factura}\n` +
          `Periodo: ${result.data.nueva_factura.periodo}`
        );
        
        closeModal();
        
        // Recargar datos
        await Promise.all([
          fetchFacturasPeriodo(),
          fetchStats()
        ]);
        
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

  // 📅 29 nov 2024
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
                  const tienePagos = periodo.tiene_pagos;
                  const esMesActual = periodo.mes === mesActual && periodo.anio === anioActual;

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
                        {periodo.total_pagos || 0} pagos registrados
                      </div>

                      {tienePagos && (
                        <div className="periodo-payment-stats">
                          <div className="payment-stat">
                            <DollarSign className="w-3 h-3" />
                            <span>Total: {formatCurrency(periodo.monto_total)}</span>
                          </div>
                        </div>
                      )}

                      <div className="periodo-card-action">
                        <span>{tienePagos ? 'Ver pagos' : 'Periodo vacío'}</span>
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
                  Períodos anteriores con pagos registrados
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
                  return diff < -2 && periodo.tiene_pagos;
                })
                .sort((a, b) => {
                  if (a.anio !== b.anio) return b.anio - a.anio;
                  return b.mes - a.mes;
                });

              if (periodosHistorial.length === 0) {
                return (
                  <div className="periodo-historial-empty">
                    <AlertCircle className="w-12 h-12 text-gray-300 mb-2" />
                    <p>No hay períodos anteriores con pagos registrados</p>
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
                          <DollarSign className="w-4 h-4 text-green-500" />
                          <span>{periodo.total_pagos} pagos</span>
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

            {permissions.canCreate && (
              <button className="btn-primary" onClick={openCreateModal}>
                <Plus className="w-4 h-4 mr-2" />
                Registrar Pago
              </button>
            )}
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
              {/* ✅ FILTRO DE ESTADO DE FACTURA */}
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

              {/* ✅ FILTRO DE MÉTODO DE PAGO */}
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

              {/* ✅ ORDENAMIENTO */}
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

          {/* ✅ CONTADOR DE RESULTADOS */}
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
    {/* ✅ CONTENEDOR DE SCROLL UNIFICADO */}
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
          <span><DollarSign className="w-4 h-4" /> Total Adeudo</span>
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

              // ✅ CALCULAR ADEUDO TOTAL (periodos anteriores + factura actual)
              const calcularAdeudoTotal = () => {
                // Adeudo de periodos anteriores
                const adeudoAnterior = datosAdeudo?.total_adeudado || 0;
                
                // Saldo pendiente de la factura actual
                const saldoActual = saldoPendiente > 0 ? saldoPendiente : 0;
                
                // Total = adeudo anterior + saldo actual
                return adeudoAnterior + saldoActual;
              };

              const adeudoTotal = calcularAdeudoTotal();

              // ✅ CALCULAR MESES DE ADEUDO (incluir mes actual si tiene saldo)
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
                          {factura.usuario_afiliado.usuario_sistema.nombres} {factura.usuario_afiliado.usuario_sistema.apellidos}
                        </span>
                      </div>
                    ) : (
                      <span className="pmt-inv-sin-dato">-</span>
                    )}
                  </div>

                  {/* Columna 6: Meses Adeudo - ✅ INCLUYE MES ACTUAL */}
                  <div className="pmt-inv-col-meses-adeudo">
                    {mesesAdeudoTotal > 0 ? (
                      <span 
                        className={`pmt-meses-badge ${
                          mesesAdeudoTotal > 2 ? 'urgente' : 
                          mesesAdeudoTotal > 0 ? 'warning' : ''
                        }`}
                        title={`${datosAdeudo?.meses_adeudo || 0} meses anteriores + ${saldoPendiente > 0 ? 1 : 0} mes actual`}
                      >
                        {mesesAdeudoTotal} {mesesAdeudoTotal === 1 ? 'mes' : 'meses'}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>
                  
                  {/* Columna 7: Total Adeudo - ✅ INCLUYE FACTURA ACTUAL */}
                  <div className="pmt-inv-col-total-adeudo">
                    {adeudoTotal > 0 ? (
                      <span 
                        className="pmt-inv-monto font-bold" 
                        style={{ 
                          color: adeudoTotal > saldoPendiente ? '#ef4444' : '#f59e0b' 
                        }}
                        title={`Adeudos anteriores: ${formatCurrency(datosAdeudo?.total_adeudado || 0)} + Factura actual: ${formatCurrency(saldoPendiente)}`}
                      >
                        {formatCurrency(adeudoTotal)}
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
                    
                    {permissions.canDelete && factura.estado_factura === 'pagada' && factura.pago && (
                      <button
                        className="pmt-inv-btn pmt-inv-btn-delete"
                        onClick={() => handleAnularPagoConRegeneracion(factura)}
                        title={`Anular pago y regenerar factura`}
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
              {/* ✅ SECCIÓN DE ADEUDOS DESPLEGABLE */}
              {(() => {
                const idAfiliado = selectedPago.usuario_afiliado?.id_usuario_afi;
                const datosAdeudo = facturasPendientesPorAfiliado[idAfiliado];
                
                // ✅ Obtener estado de expansión desde el estado del componente
                const estaExpandido = adeudosExpandidoPorAfiliado[idAfiliado] || false;
                
                // Solo mostrar si tiene adeudos
                if (datosAdeudo && datosAdeudo.meses_adeudo >= 1) {
                  return (
                    <div className="factura-section adeudos-alert-section">
                      <div className="adeudos-card">
                        {/* Header Clickeable */}
                        <div 
                          className="adeudos-card-header"
                          onClick={() => toggleAdeudos(idAfiliado)}
                        >
                          <div className="adeudos-header-left">
                            <AlertCircle className="w-5 h-5" />
                            <span>Adeudos Pendientes</span>
                            
                            {/* Badge de resumen en el header */}
                            <div className="adeudos-header-badge">
                              <span>
                                <Clock className="w-3 h-3" />
                                {datosAdeudo.meses_adeudo} {datosAdeudo.meses_adeudo === 1 ? 'mes' : 'meses'}
                              </span>
                              <span>•</span>
                              <span>
                                <DollarSign className="w-3 h-3" />
                                {formatCurrency(datosAdeudo.total_adeudado)}
                              </span>
                            </div>
                          </div>
                          
                          {/* Icono de toggle */}
                          <ChevronDown 
                            className={`w-5 h-5 adeudos-toggle-icon ${estaExpandido ? 'expanded' : ''}`}
                          />
                        </div>
                        
                        {/* Body Desplegable */}
                        <div className={`adeudos-card-body ${estaExpandido ? 'expanded' : ''}`}>
                          {/* Resumen compacto */}
                          <div className="adeudos-resumen">
                            <div className="adeudo-stat">
                              <span className="adeudo-label">Meses</span>
                              <span className="adeudo-value urgente">
                                {datosAdeudo.meses_adeudo}
                              </span>
                            </div>
                            <div className="adeudo-stat">
                              <span className="adeudo-label">Total Adeudo</span>
                              <span className="adeudo-value monto">
                                {formatCurrency(datosAdeudo.total_adeudado)}
                              </span>
                            </div>
                            <div className="adeudo-stat">
                              <span className="adeudo-label">Facturas</span>
                              <span className="adeudo-value">
                                {datosAdeudo.total_facturas_pendientes}
                              </span>
                            </div>
                          </div>

                          {/* Lista de facturas pendientes */}
                          {datosAdeudo.facturas && datosAdeudo.facturas.length > 0 && (
                            <div className="adeudos-facturas-list">
                              <div className="adeudos-list-title">
                                <FileText className="w-4 h-4" />
                                Detalle de Facturas Pendientes
                              </div>
                              
                              {datosAdeudo.facturas.map((factura, index) => (
                                <div key={factura.id_factura} className="adeudo-factura-item">
                                  {/* Header compacto */}
                                  <div className="adeudo-factura-header">
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                      <span className="adeudo-factura-numero">
                                        {factura.num_factura}
                                      </span>
                                      <span className="adeudo-factura-periodo">
                                        {factura.periodo}
                                      </span>
                                    </div>
                                    <span className={`adeudo-factura-estado ${factura.estado_factura}`}>
                                      {factura.estado_factura === 'vencida' ? (
                                        <>
                                          <Clock className="w-3 h-3" />
                                          Vencida
                                        </>
                                      ) : (
                                        <>
                                          <AlertCircle className="w-3 h-3" />
                                          Pendiente
                                        </>
                                      )}
                                    </span>
                                  </div>
                                  
                                  {/* Detalles en una fila */}
                                  <div className="adeudo-factura-detalles">
                                    <div className="adeudo-factura-info">
                                      <Calendar className="w-3 h-3 text-gray-400" />
                                      <span className="info-label">Emisión:</span>
                                      <span className="info-value">{formatDateShort(factura.fecha_emision)}</span>
                                    </div>
                                    
                                    <div className="adeudo-factura-info-divider"></div>
                                    
                                    <div className="adeudo-factura-info">
                                      <Clock className="w-3 h-3 text-gray-400" />
                                      <span className="info-label">Días:</span>
                                      <span className="info-value urgente">
                                        {factura.dias_transcurridos}
                                      </span>
                                    </div>
                                    
                                    <div className="adeudo-factura-info-divider"></div>
                                    
                                    <div className="adeudo-factura-info">
                                      <DollarSign className="w-3 h-3 text-gray-400" />
                                      <span className="info-label">Total:</span>
                                      <span className="info-value">
                                        {formatCurrency(factura.total_factura)}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Montos en una fila */}
                                  <div className="adeudo-factura-montos">
                                    <div className="adeudo-monto-item">
                                      <span className="label">Saldo</span>
                                      <span className="value">{formatCurrency(factura.saldo_pendiente)}</span>
                                    </div>
                                    
                                    {factura.mora_aplicable && factura.mora_monto > 0 && (
                                      <>
                                        <span style={{ color: '#d1d5db' }}>+</span>
                                        <div className="adeudo-monto-item mora">
                                          <span className="label">Mora</span>
                                          <span className="value">{formatCurrency(factura.mora_monto)}</span>
                                        </div>
                                      </>
                                    )}
                                    
                                    <span style={{ color: '#d1d5db' }}>=</span>
                                    
                                    <div className="adeudo-monto-item total">
                                      <span className="label">Total</span>
                                      <span className="value">{formatCurrency(factura.total_con_mora)}</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Mensaje de recomendación */}
                          <div className="adeudos-recomendacion">
                            <AlertCircle className="w-4 h-4" />
                            <p>
                              Se recomienda ponerse al día con los pagos anteriores para evitar acumulación de mora.
                              {datosAdeudo.facturas?.some(f => f.mora_aplicable) && (
                                <span className="highlight"> Algunas facturas ya tienen mora aplicable.</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
      
              {/* SECCIÓN DE INFORMACIÓN DE LA FACTURA */}
              <div className="factura-section">
                <h4 className="section-title">
                  <FileText className="w-4 h-4" />
                  Información de la Factura
                </h4>
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
                  <h4 className="section-title">
                    <User className="w-4 h-4" />
                    Datos del Afiliado
                  </h4>
                  <div className="user-details">
                    <div className="detail-group form-group-full">
                      <label>Nombre Afiliado:</label>
                      <p>
                        {selectedPago.usuario_afiliado.usuario_sistema?.nombres}{' '}
                        {selectedPago.usuario_afiliado.usuario_sistema?.apellidos}  {' '} 
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

                    {/* ✅ AGREGAR NÚMERO DE MEDIDOR */}
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
                        <label>Sector</label>
                        <p>{selectedPago.usuario_afiliado.sector.nombre_sector}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Seccion de DETALLES/CONCEPTOS DE FACTURACIÓN */}
              {selectedPago.detalles && selectedPago.detalles.length > 0 && (
                <div className="factura-section">
                  <h4 className="section-title">
                    <FileText className="w-4 h-4" />
                    Conceptos de Facturación ({selectedPago.detalles.length})
                  </h4>
                  <div className="detalles-factura-list">
                    {selectedPago.detalles.map((detalle, index) => {
                      // Determinar el ícono y color según el tipo
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
                        <span>{formatCurrency(selectedPago.subtotal)}</span>
                      </div>
                      {parseFloat(selectedPago.descuento) > 0 && (
                        <div className="total-row descuento">
                          <span>Descuento:</span>
                          <span className="text-green-600">
                            - {formatCurrency(selectedPago.descuento)}
                          </span>
                        </div>
                      )}
                      <div className="total-row">
                        <span>Impuesto (15%):</span>
                        <span>{formatCurrency(selectedPago.impuesto)}</span>
                      </div>
                      <div className="total-row total">
                        <span>Total:</span>
                        <span className="font-bold text-xl">
                          {formatCurrency(selectedPago.total)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {/* SECCIÓN DE PAGOS - Mostrar historial de todos los pagos */}
              {selectedPago.pagos && selectedPago.pagos.length > 0 && (
                <div className="factura-section">
                  <h4 className="section-title">
                    <DollarSign className="w-4 h-4" />
                    Historial de Pagos ({selectedPago.pagos.length})
                  </h4>
                  <div className="pagos-list">
                    {selectedPago.pagos.map((pago, index) => (
                      <div 
                        key={pago.id_pago} 
                        className={`pago-item ${pago.estado_pago === 'ANULADO' ? 'pago-anulado' : ''}`}
                      >
                        {/* CABECERA DEL PAGO */}
                        <div className="pago-header">
                          <div className="pago-header-left">
                            <span className="pago-numero">Pago #{pago.id_pago}</span>
                          </div>
                          {getStatusBadge(pago.estado_pago)}
                        </div>

                        {/* DETALLES DEL PAGO */}
                        <div className="pago-details">
                          <div className="pago-detail">
                            <span className="pago-label">
                              <Calendar className="w-3 h-3" /> Fecha
                            </span>
                            <span className="pago-value">
                              {formatDate(pago.fecha_pago)}
                            </span>
                          </div>

                          <div className="pago-detail">
                            <span className="pago-label">
                              <DollarSign className="w-3 h-3" /> Monto
                            </span>
                            <span className="pago-value font-bold text-green-600">
                              {formatCurrency(pago.monto_pago)}
                            </span>
                          </div>

                          <div className="pago-detail">
                            <span className="pago-label">
                              {getMetodoIcon(pago.metodo_pago)} Método
                            </span>
                            <span className="pago-value">
                              {pago.metodo_pago}
                            </span>
                          </div>

                          {/* CAJERO */}
                          {pago.cajero && (
                            <div className="pago-detail">
                              <span className="pago-label">
                                <User className="w-3 h-3" /> Cajero
                              </span>
                              <span className="pago-value">
                                {pago.cajero}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* OBSERVACIONES */}
                        {pago.observaciones && (
                          <div className="pago-observaciones">
                            <span className="pago-obs-label">
                              <FileText className="w-3 h-3" /> Observaciones
                            </span>
                            <p className="pago-obs-text">{pago.observaciones}</p>
                          </div>
                        )}

                        {/* INFORMACIÓN DE ANULACIÓN */}
                        {pago.estado_pago === 'ANULADO' && (
                          <div className="pago-anulacion-info">
                            <div className="anulacion-header">
                              <Ban className="w-4 h-4" />
                              <span>Pago Anulado</span>
                            </div>

                            {pago.fecha_anulacion && (
                              <div className="anulacion-detail">
                                <span className="anulacion-label">Fecha de anulación</span>
                                <span className="anulacion-value">
                                  {formatDate(pago.fecha_anulacion)}
                                </span>
                              </div>
                            )}

                            {pago.motivo_anulacion && (
                              <div className="anulacion-detail">
                                <span className="anulacion-label">Motivo</span>
                                <span className="anulacion-value">{pago.motivo_anulacion}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* BOTÓN DESCARGAR COMPROBANTE */}
                        {pago.tiene_comprobante && (
                          <div className="pago-comprobante-btn">
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
                  <div className="pagos-summary">
                    <div className="summary-header">
                      <TrendingUp className="w-4 h-4" />
                      <span>Resumen de Pago</span>
                    </div>
                    <div className="summary-row">
                      <span>Total Factura</span>
                      <span className="font-bold">{formatCurrency(selectedPago.total)}</span>
                    </div>
                    <div className="summary-row pagado">
                      <span>Total Pagado</span>
                      <span className="font-bold text-green-600">
                        {formatCurrency(selectedPago.monto_pagado)}
                      </span>
                    </div>
                    <div className="summary-row total">
                      <span>Saldo Pendiente</span>
                      <span className={`font-bold ${selectedPago.saldo_pendiente > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(selectedPago.saldo_pendiente)}
                      </span>
                    </div>

                    {/* INDICADOR VISUAL DEL PROGRESO */}
                    <div className="payment-progress">
                      <div className="progress-bar">
                        <div 
                          className="progress-fill" 
                          style={{ width: `${(selectedPago.monto_pagado / parseFloat(selectedPago.total)) * 100}%` }}
                        />
                      </div>
                      <span className="progress-percentage">
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



{/* ==================== MODAL CREAR PAGO CON MORA ==================== */}
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
        {/* ✅ SECCIÓN DE FACTURAS PENDIENTES DESPLEGABLE */}
        {(() => {
          const idAfiliado = selectedFactura.usuario_afiliado?.id_usuario_afi;
          const datosAdeudo = facturasPendientesPorAfiliado[idAfiliado];
          
          if (datosAdeudo && datosAdeudo.facturas && datosAdeudo.facturas.length > 0) {
            return (
              <div className="payment-facturas-pendientes-section">
                {/* Header Clickeable */}
                <div 
                  className="payment-pendientes-header"
                  onClick={() => setFacturasPendientesExpandido(!facturasPendientesExpandido)}
                >
                  <div className="payment-pendientes-header-left">
                    <AlertCircle className="w-5 h-5" />
                    <span>Facturas Pendientes de Periodos Anteriores</span>
                  </div>
                  
                  <div className="payment-pendientes-header-right">
                    <div className="payment-pendientes-badge">
                      <span className="payment-badge-count">{datosAdeudo.total_facturas_pendientes}</span>
                      <span className="payment-badge-divider">|</span>
                      <span className="payment-badge-total">{formatCurrency(datosAdeudo.total_adeudado)}</span>
                    </div>
                    <ChevronDown 
                      className={`payment-toggle-icon ${facturasPendientesExpandido ? 'expanded' : ''}`}
                    />
                  </div>
                </div>
                
                {/* Body Desplegable */}
                <div className={`payment-pendientes-body ${facturasPendientesExpandido ? 'expanded' : ''}`}>
                  {/* Acciones rápidas */}
                  <div className="payment-facturas-acciones">
                    <button 
                      className="payment-btn-accion payment-btn-seleccionar"
                      onClick={seleccionarTodasFacturas}
                      title="Seleccionar todas las facturas pendientes"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Seleccionar Todas
                    </button>
                    <button 
                      className="payment-btn-accion payment-btn-deseleccionar"
                      onClick={deseleccionarFacturas}
                      title="Deseleccionar solo las facturas opcionales"
                    >
                      <XCircle className="w-4 h-4" />
                      Deseleccionar
                    </button>
                  </div>

                  {/* Lista de facturas */}
                  <div className="payment-seleccion-list">
                    {datosAdeudo.facturas.map((factura) => {
                      const estaSeleccionada = facturasSeleccionadas[factura.id_factura] || false;
                      
                      return (
                        <div 
                          key={factura.id_factura}
                          className={`payment-factura-item ${estaSeleccionada ? 'selected' : ''}`}
                          onClick={() => toggleSeleccionFactura(factura.id_factura, false)}
                        >
                          <input
                            type="checkbox"
                            className="payment-factura-checkbox"
                            checked={estaSeleccionada}
                            onChange={() => {}}
                            onClick={(e) => e.stopPropagation()}
                          />
                          
                          <div className="payment-factura-content">
                            <div className="payment-factura-main">
                              <div className="payment-factura-info-left">
                                <span className="payment-factura-numero">{factura.num_factura}</span>
                                <span className="payment-factura-periodo">Periodo: {factura.periodo}</span>
                              </div>
                              
                              <div className="payment-factura-info-right">
                                <span className={`payment-factura-estado payment-estado-${factura.estado_factura.toLowerCase()}`}>
                                  {factura.estado_factura}
                                </span>
                                <span className="payment-factura-monto">{formatCurrency(factura.total_con_mora)}</span>
                              </div>
                            </div>
                            
                            <div className="payment-factura-detalles">
                              <div className="payment-detalle-item">
                                <span className="payment-detalle-icon">📅</span>
                                <span className="payment-detalle-text">{formatDateShort(factura.fecha_emision)}</span>
                              </div>
                              <div className="payment-detalle-item">
                                <span className="payment-detalle-icon">⏰</span>
                                <span className="payment-detalle-text">{factura.dias_transcurridos} días</span>
                              </div>
                              {factura.mora_aplicable && (
                                <div className="payment-detalle-item payment-detalle-mora">
                                  <span className="payment-detalle-icon">⚠️</span>
                                  <span className="payment-detalle-text">Mora: {formatCurrency(factura.mora_monto)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Resumen de selección */}
                  {Object.values(facturasSeleccionadas).filter(Boolean).length > 0 && (
                    <div className="payment-seleccion-resumen">
                      <div className="payment-resumen-header">
                        <Calculator className="w-5 h-5" />
                        <span>Resumen de Facturas Seleccionadas</span>
                      </div>
                      <div className="payment-resumen-content">
                        <div className="payment-resumen-item">
                          <span className="payment-resumen-label">Facturas anteriores:</span>
                          <span className="payment-resumen-value">
                            {Object.values(facturasSeleccionadas).filter(Boolean).length}
                          </span>
                        </div>
                        <div className="payment-resumen-item payment-resumen-total">
                          <span className="payment-resumen-label">Subtotal periodos anteriores:</span>
                          <span className="payment-resumen-value">{formatCurrency(montoPagoMasivo)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          }
          return null;
        })()}

        {/* ========== INFORMACIÓN DE LA FACTURA ACTUAL ========== */}
        {selectedFactura && (
          <div className="payment-factura-actual-section">
            <div className="payment-factura-actual-header">
              <div className="payment-header-left">
                <FileText className="w-5 h-5" />
                <h4>Factura del Periodo Actual</h4>
              </div>
              <span className="payment-badge-obligatorio">OBLIGATORIO</span>
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
                  </div>
                </div>

                {/* ⚠️ ALERTAS DE MORA */}
                {resumenPago?.mora?.aplica && getSafeValue(resumenPago.mora?.monto) > 0 && (
                  <div className="payment-alert-card payment-alert-warning">
                    <div className="payment-alert-header">
                      <AlertCircle className="w-5 h-5" />
                      <span>Mora por Pago Tardío</span>
                    </div>
                    <div className="payment-alert-content">
                      <div className="payment-alert-row">
                        <span className="payment-alert-label">Monto de mora:</span>
                        <span className="payment-alert-value payment-alert-value-danger">
                          {formatCurrencySafe(resumenPago.mora.monto)}
                        </span>
                      </div>
                      <div className="payment-alert-details">
                        <span>• {getSafeValue(resumenPago.mora.dias_transcurridos, 0)} días desde emisión</span>
                        <span>• {getSafeValue(resumenPago.mora.dias_mora_efectivos, 0)} días de mora efectivos</span>
                      </div>
                      {resumenPago.mora.detalle && (
                        <p className="payment-alert-note">{resumenPago.mora.detalle}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* 🚨 ALERTAS DE MULTAS */}
                {resumenPago.multas?.tiene_multas && resumenPago.multas?.detalles?.length > 0 && (
                  <div className="payment-alert-card payment-alert-danger">
                    <div className="payment-alert-header">
                      <AlertCircle className="w-5 h-5" />
                      <span>Multas Incluidas ({resumenPago.multas.cantidad || 0})</span>
                    </div>
                    <div className="payment-alert-content">
                      <div className="payment-multas-list-compact">
                        {resumenPago.multas.detalles.map((multa, idx) => (
                          <div key={idx} className="payment-multa-item-compact">
                            <span className="payment-multa-desc">{multa.descripcion || 'Multa'}</span>
                            <span className="payment-multa-monto">{formatCurrencySafe(multa.subtotal)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="payment-multas-total-compact">
                        <span className="payment-multas-total-label">
                          Total Multas (+ IVA {getSafeValue(resumenPago.iva?.porcentaje, 0).toFixed(1)}%):
                        </span>
                        <span className="payment-multas-total-value">
                          {formatCurrencySafe(resumenPago.multas.total_con_iva)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 💰 OPCIONES DE PAGO - MEJORADO */}
                <div className="payment-opciones-section">
                  <h5 className="payment-opciones-title">
                    <DollarSign className="w-5 h-5" />
                    Opciones de Pago
                  </h5>

                  <div className="payment-opciones-grid">
                    {/* OPCIÓN 1: PAGO COMPLETO */}
                    <div className="payment-opcion-card payment-opcion-completa">
                      <div className="payment-opcion-header">
                        <div className="payment-opcion-title">
                          <span className="payment-opcion-icon">✅</span>
                          <span>Opción 1: Pagar TODO</span>
                        </div>
                        {resumenPago.multas?.tiene_multas && (
                          <span className="payment-opcion-badge">Incluye multas</span>
                        )}
                      </div>
                      
                      <div className="payment-opcion-desglose">
                        <div className="payment-desglose-row">
                          <span>Subtotal:</span>
                          <span>{formatCurrencySafe(resumenPago.totales?.opcion_completa?.subtotal)}</span>
                        </div>
                        
                        {getSafeValue(resumenPago.totales?.opcion_completa?.descuento) > 0 && (
                          <div className="payment-desglose-row payment-desglose-descuento">
                            <span>- Descuento:</span>
                            <span>{formatCurrencySafe(resumenPago.totales.opcion_completa.descuento)}</span>
                          </div>
                        )}
                        
                        <div className="payment-desglose-row">
                          <span>Base imponible:</span>
                          <span>{formatCurrencySafe(resumenPago.totales?.opcion_completa?.base)}</span>
                        </div>
                        
                        <div className="payment-desglose-row">
                          <span>+ IVA ({getSafeValue(resumenPago.iva?.porcentaje, 0).toFixed(1)}%):</span>
                          <span>{formatCurrencySafe(resumenPago.totales?.opcion_completa?.iva)}</span>
                        </div>
                        
                        {resumenPago.mora?.aplica && getSafeValue(resumenPago.mora?.monto) > 0 && (
                          <div className="payment-desglose-row payment-desglose-mora">
                            <span>+ Mora:</span>
                            <span>{formatCurrencySafe(resumenPago.mora.monto)}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="payment-opcion-total">
                        <span>TOTAL A PAGAR:</span>
                        <span className="payment-total-amount">
                          {formatCurrencySafe(resumenPago.totales?.opcion_completa?.total_final)}
                        </span>
                      </div>
                    </div>

                    {/* OPCIÓN 2: SIN MULTAS */}
                    {resumenPago.multas?.tiene_multas && getSafeValue(resumenPago.totales?.opcion_sin_multas?.total_final, 0) > 0 && (
                      <div className="payment-opcion-card payment-opcion-parcial">
                        <div className="payment-opcion-header">
                          <div className="payment-opcion-title">
                            <span className="payment-opcion-icon">⚡</span>
                            <span>Opción 2: Pagar SIN Multas</span>
                          </div>
                          <span className="payment-opcion-badge payment-opcion-badge-warning">Multas quedan pendientes</span>
                        </div>
                        
                        <div className="payment-opcion-desglose">
                          <div className="payment-desglose-row">
                            <span>Subtotal (sin multas):</span>
                            <span>{formatCurrencySafe(resumenPago.totales?.opcion_sin_multas?.subtotal)}</span>
                          </div>
                          
                          {getSafeValue(resumenPago.totales?.opcion_sin_multas?.descuento) > 0 && (
                            <div className="payment-desglose-row payment-desglose-descuento">
                              <span>- Descuento:</span>
                              <span>{formatCurrencySafe(resumenPago.totales.opcion_sin_multas.descuento)}</span>
                            </div>
                          )}
                          
                          <div className="payment-desglose-row">
                            <span>Base imponible:</span>
                            <span>{formatCurrencySafe(resumenPago.totales?.opcion_sin_multas?.base)}</span>
                          </div>
                          
                          <div className="payment-desglose-row">
                            <span>+ IVA ({getSafeValue(resumenPago.iva?.porcentaje, 0).toFixed(1)}%):</span>
                            <span>{formatCurrencySafe(resumenPago.totales?.opcion_sin_multas?.iva)}</span>
                          </div>
                          
                          {resumenPago.mora?.aplica && getSafeValue(resumenPago.mora?.monto) > 0 && (
                            <div className="payment-desglose-row payment-desglose-mora">
                              <span>+ Mora:</span>
                              <span>{formatCurrencySafe(resumenPago.mora.monto)}</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="payment-opcion-total">
                          <span>TOTAL A PAGAR:</span>
                          <span className="payment-total-amount">
                            {formatCurrencySafe(resumenPago.totales?.opcion_sin_multas?.total_final)}
                          </span>
                        </div>
                        
                        <div className="payment-opcion-warning">
                          <span>⚠️ Quedarán pendientes: {formatCurrencySafe(resumenPago.totales?.opcion_sin_multas?.multas_pendientes)}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {resumenPago.recomendacion?.mostrar_opciones && (
                    <div className="payment-recomendacion-box">
                      <span className="payment-recomendacion-icon">💡</span>
                      <span>{resumenPago.recomendacion?.mensaje || 'Seleccione una opción de pago'}</span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="payment-resumen-error">No se pudo cargar el resumen del pago</p>
            )}
          </div>
        )}

        {/* ========== FORMULARIO DE PAGO ========== */}
        <div className="payment-form-section">
          <h5 className="payment-form-title">
            <DollarSign className="w-5 h-5" />
            Detalles del Pago
          </h5>

          {/* Monto a Pagar */}
          <div className="payment-form-group">
            <label className="payment-form-label">
              Monto a Pagar *
              <span className="payment-label-hint">(Puedes ajustar el monto manualmente)</span>
            </label>

            <div className="payment-input-with-icon">
              <DollarSign className="payment-input-icon" />
              <input
                type="number"
                step="0.01"
                min="0"
                className={`payment-form-input ${
                  parseFloat(nuevoPago.monto_pago) >
                  getSafeValue(resumenPago.totales?.opcion_completa?.total_final, 0)
                    ? 'payment-input-error'
                    : ''
                }`}
                value={nuevoPago.monto_pago}
                onChange={(e) =>
                  setNuevoPago({ ...nuevoPago, monto_pago: e.target.value })
                }
                placeholder="0.00"
              />
            </div>

            {parseFloat(nuevoPago.monto_pago) >
              getSafeValue(resumenPago.totales?.opcion_completa?.total_final, 0) && (
              <p className="payment-form-error-message">
                <AlertCircle className="w-4 h-4" />
                El monto excede el total de la factura
              </p>
            )}
          </div>

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
      </div>

      {/* ========== FOOTER CON BOTONES DE ACCIÓN ========== */}
      <div className="payment-modal-footer">
        <div className="payment-footer-info">
          <div className="payment-footer-total">
            <span className="payment-footer-total-label">Total del Pago:</span>
            <span className="payment-footer-total-amount">
              {nuevoPago.monto_pago ? formatCurrency(parseFloat(nuevoPago.monto_pago)) : '$0.00'}
            </span>
          </div>
        </div>

        <div className="payment-footer-actions">
          <button className="payment-btn-secondary" onClick={closeCreateModal} disabled={loading}>
            <X className="w-4 h-4" />
            Cancelar
          </button>

          {resumenPago && resumenPago.totales ? (
            <>
              {resumenPago.multas?.tiene_multas ? (
                <>
                  {/* Botón Pagar SIN Multas */}
                  {getSafeValue(resumenPago.totales.opcion_sin_multas?.total_final, 0) > 0 && (
                    <button
                      className="payment-btn-pago payment-btn-pago-parcial"
                      onClick={() => {
                        const montoSinMultas = getSafeValue(
                          resumenPago.totales.opcion_sin_multas?.total_final,
                          0
                        );
                        setNuevoPago({
                          ...nuevoPago,
                          monto_pago: montoSinMultas.toFixed(2),
                          incluir_multas: false
                        });
                        handleCreatePago(false);
                      }}
                      disabled={loading || !resumenPago.totales.opcion_sin_multas}
                      title="Pagar sin incluir las multas (quedarán pendientes)"
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Procesando...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Pagar Sin Multas
                          <span className="payment-btn-amount">
                            {formatCurrencySafe(resumenPago.totales.opcion_sin_multas?.total_final)}
                          </span>
                        </>
                      )}
                    </button>
                  )}

                  {/* Botón Pagar TODO */}
                  <button
                    className="payment-btn-pago payment-btn-pago-completo"
                    onClick={() => {
                      const montoCompleto = getSafeValue(
                        resumenPago.totales.opcion_completa?.total_final,
                        0
                      );
                      setNuevoPago({
                        ...nuevoPago,
                        monto_pago: montoCompleto.toFixed(2),
                        incluir_multas: true
                      });
                      handleCreatePago(true);
                    }}
                    disabled={loading || !resumenPago.totales.opcion_completa}
                    title="Pagar el monto completo incluyendo multas"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Pagar TODO
                        <span className="payment-btn-amount">
                          {formatCurrencySafe(resumenPago.totales.opcion_completa?.total_final)}
                        </span>
                      </>
                    )}
                  </button>
                </>
              ) : (
                <button
                  className="payment-btn-pago payment-btn-pago-completo"
                  onClick={() => {
                    const montoCompleto = getSafeValue(
                      resumenPago.totales.opcion_completa?.total_final,
                      0
                    );
                    setNuevoPago({
                      ...nuevoPago,
                      monto_pago: montoCompleto.toFixed(2),
                      incluir_multas: true
                    });
                    handleCreatePago(true);
                  }}
                  disabled={loading || !resumenPago.totales.opcion_completa}
                  title="Registrar el pago"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Registrar Pago
                      <span className="payment-btn-amount">
                        {formatCurrencySafe(resumenPago.totales.opcion_completa?.total_final)}
                      </span>
                    </>
                  )}
                </button>
              )}
            </>
          ) : (
            <button className="payment-btn-secondary" disabled>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Cargando opciones...
            </button>
          )}
        </div>
      </div>
    </div>
  </div>
)}



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
    
    </div>
  );
};

export default PaymentsSection;