// src/sections/PaymentsSection.js
// MÓDULO DE PAGOS - Con sistema de periodos mensuales

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  const [montosFactura, setMontosFactura] = useState(null);

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
  const fetchFacturasPeriodo = useCallback(async () => {
        if (!periodoSeleccionado) return;

        setLoading(true);
        setError(null);

        try {
            const periodoStr = `${periodoSeleccionado.anio}-${String(periodoSeleccionado.mes).padStart(2, '0')}`;
            const result = await paymentsServices.getFacturasPeriodo({
            periodo: periodoStr,
            estado_factura: filterStatus !== 'all' ? filterStatus : null,
            limit: 100
            });

            if (result.success && result.data) {
            console.log('📦 Facturas cargadas:', result.data.length);
            setFacturas(result.data);
            
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
            } else {
            setError('No se pudieron cargar las facturas');
            setFacturas([]);
            }
        } catch (err) {
            setError('Error al cargar facturas');
            console.error(err);
            setFacturas([]);
        } finally {
            setLoading(false);
        }
  }, [periodoSeleccionado, filterStatus]);


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

    // ✅ FILTRO DE MÉTODO DE PAGO
    const matchesMetodo = filterMetodo === 'all' || 
      (factura.pago && factura.pago.metodo_pago === filterMetodo);

    return matchesSearch && matchesStatus && matchesMetodo;
  });

  const sortedFacturas = useMemo(() => {
    return [...filteredFacturas].sort((a, b) => {
      let comparison = 0;

      if (sortOption === 'fecha') {
        comparison = new Date(a.fecha_emision) - new Date(b.fecha_emision);
      } else if (sortOption === 'monto') {
        comparison = parseFloat(a.total) - parseFloat(b.total);
      } else if (sortOption === 'metodo') {
        // ✅ Ordenar por método de pago
        const metodoA = a.pago?.metodo_pago || '';
        const metodoB = b.pago?.metodo_pago || '';
        comparison = metodoA.localeCompare(metodoB);
      } else if (sortOption === 'estado') {
        // ✅ ORDEN PRIORITARIO: primero por estado, luego por fecha
        const estadoA = a.estado_factura || '';
        const estadoB = b.estado_factura || '';
        
        // Definir orden de prioridad de estados
        const estadoPrioridad = {
          'pendiente': 1,
          'pagada': 2,
          'anulada': 3,
          'vencida': 4
        };
        
        const prioridadA = estadoPrioridad[estadoA] || 999;
        const prioridadB = estadoPrioridad[estadoB] || 999;
        
        // Primero comparar por estado
        comparison = prioridadA - prioridadB;
        
        // Si tienen el mismo estado, ordenar por fecha (más reciente primero)
        if (comparison === 0) {
          comparison = new Date(b.fecha_emision) - new Date(a.fecha_emision);
        }
      } else if (sortOption === 'estado_fecha') {
        // ✅ NUEVA OPCIÓN: Estado + Fecha explícita
        const estadoA = a.estado_factura || '';
        const estadoB = b.estado_factura || '';
        
        const estadoPrioridad = {
          'pendiente': 1,
          'pagada': 2,
          'anulada': 3,
          'vencida': 4
        };
        
        const prioridadA = estadoPrioridad[estadoA] || 999;
        const prioridadB = estadoPrioridad[estadoB] || 999;
        
        comparison = prioridadA - prioridadB;
        
        if (comparison === 0) {
          comparison = new Date(b.fecha_emision) - new Date(a.fecha_emision);
        }
      }

      return sortOrder === 'desc' ? comparison : -comparison;
    });
  }, [filteredFacturas, sortOption, sortOrder]);

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

  // Función para abrir modal de pago CON factura específica
const openPaymentModal = async (factura) => {
  if (!permissions.canCreate) {
    alert('No tienes permiso para registrar pagos');
    return;
  }

  const saldoPendiente = calcularSaldoPendiente(factura);

  // ⭐ CALCULAR RESUMEN CON MORA
  if (factura) {
    setLoadingResumen(true);
    const resultado = await paymentsServices.calcularResumenPago(factura.id_factura);
    
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
      alert('No se pudo calcular el resumen del pago: ' + resultado.message);
      setResumenPago(null);
    }
    setLoadingResumen(false);
  }

  setNuevoPago({
    id_factura: factura.id_factura,
    id_usuario_afi: factura.id_usuario_afi,
    monto_pago: getSafeValue(saldoPendiente, 0).toFixed(2),
    metodo_pago: 'EFECTIVO',
    observaciones: ''
  });

  setSelectedFactura(factura);
  setShowCreateModal(true);
};




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
        <div className="invoices-list-container">
            {/* HEADER */}
            <div className="invoices-list-header">
            <span>#</span>
            <span><FileText className="w-4 h-4" /> Factura</span>
            <span><Calendar className="w-4 h-4" /> Emisión</span>
            <span><IdCard className="w-4 h-4" /> Código</span>
            <span><User className="w-4 h-4" /> Afiliado</span>
            <span><DollarSign className="w-4 h-4" /> Total</span>
            <span><DollarSign className="w-4 h-4" /> Pagado</span>
            <span><DollarSign className="w-4 h-4" /> Saldo</span>
            <span>Estado</span>
            <span>Comprobante</span> 
            <span>Acciones</span>
            </div>

            {/* BODY */}
            <div className="invoices-list-body">
              {sortedFacturas.length > 0 ? (
                sortedFacturas.map((factura, index) => {
                  const totalPagado = calcularTotalPagado(factura);
                  const saldoPendiente = calcularSaldoPendiente(factura);
                  const puedeRecibirPago = factura.estado_factura === 'pendiente' || factura.estado_factura === 'vencida';

                  return (
                      <div 
                      key={factura.id_factura} 
                      className={`invoices-list-item ${
                          factura.estado_factura === 'anulada' ? 'inv-anulada' : 
                          factura.estado_factura === 'pagada' ? 'inv-pagada' :
                          factura.estado_factura === 'vencida' ? 'inv-vencida' : ''
                      }`}
                      >
                      {/* Columna 1: # */}
                      <div className="inv-col-index">
                          <span className="inv-index-badge">{index + 1}</span>
                      </div>

                      {/* Columna 2: Número Factura */}
                      <div className="inv-col-numero">
                          <FileText className="w-4 h-4" />
                          <span className="inv-numero-text">
                          {factura.num_factura}
                          </span>
                      </div>

                      {/* Columna 3: Fecha Emisión */}
                      <div className="inv-col-fecha">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDateShort(factura.fecha_emision)}</span>
                      </div>

                      {/* Columna 4: Código Afiliado */}
                      <div className="inv-col-codigo">
                          {factura.usuario_afiliado?.cod_usuario_afi ?? '—'}
                      </div>

                      {/* Columna 5: Afiliado */}
                      <div className="inv-col-usuario">
                          {factura.usuario_afiliado?.usuario_sistema ? (
                          <div className="inv-usuario-info">
                              <span className="inv-usuario-nombre">
                              {factura.usuario_afiliado.usuario_sistema.nombres} {factura.usuario_afiliado.usuario_sistema.apellidos}
                              </span>
                          </div>
                          ) : (
                          <span className="inv-sin-dato">-</span>
                          )}
                      </div>

                      {/* Columna 6: Total */}
                      <div className="inv-col-total">
                          <span className="inv-monto">{formatCurrency(factura.total)}</span>
                      </div>

                      {/* Columna 7: Total Pagado */}
                      <div className="inv-col-total">
                          <span className="inv-monto" style={{ color: totalPagado > 0 ? '#10b981' : '#6b7280' }}>
                          {formatCurrency(totalPagado)}
                          </span>
                          
                      </div>

                      {/* Columna 8: Saldo Pendiente */}
                      <div className="inv-col-total">
                          <span 
                          className="inv-monto font-bold" 
                          style={{ 
                              color: saldoPendiente > 0 ? '#ef4444' : '#10b981'
                          }}
                          >
                          {formatCurrency(saldoPendiente)}
                          </span>
                      </div>

                      {/* Columna 9: Estado */}
                      <div className="inv-col-estado">
                          {getEstadoPagoBadge(factura)}
                      </div>
                      
                      {/* Columna 10: Comprobante */}
                      <div className="inv-col-comprobante">
                        {factura.pago && factura.pago.tiene_comprobante ? (
                          <button
                            className="inv-btn inv-btn-edit"
                            onClick={() => descargarComprobante(factura.pago.id_pago)}
                            title={`Descargar: ${factura.pago.nombre_archivo || 'comprobante.pdf'}`}
                          >
                            <FileCheck className="w-4 h-4 text-green-600" />
                          </button>
                        ) : factura.pago && !factura.pago.tiene_comprobante ? (
                          <span className="text-xs text-gray-400">Sin comprobante</span>
                        ) : (
                          <span className="text-xs text-gray-400">Sin pago</span>
                        )}
                      </div>

                      {/* Columna 11: Acciones */}
                      <div className="inv-col-acciones">
                        <button 
                          className="inv-btn inv-btn-view" 
                          onClick={() => openModal('view-factura', factura)} 
                          title="Ver factura y pagos"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {permissions.canCreate && puedeRecibirPago && saldoPendiente > 0 && (
                          <button
                            className="inv-btn inv-btn-edit"
                            onClick={() => openPaymentModal(factura)}
                            title={`Registrar pago - Saldo: ${formatCurrency(saldoPendiente)}`}
                            style={{ backgroundColor: '#10b981', color: 'white' }}
                          >
                            <DollarSign className="w-4 h-4" />
                          </button>
                        )}
                        
                        {/* ✅ Anular pago - Solo si está pagada */}
                        {permissions.canDelete && factura.estado_factura === 'pagada' && factura.pago && (
                          <button
                            className="inv-btn inv-btn-delete"
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
                <div className="invoices-list-empty">
                <FileText className="inv-empty-icon" />
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

            {/* FOOTER */}
            {sortedFacturas.length > 0 && (
            <div className="invoices-list-footer">
                <button 
                className="btn-secondary"
                onClick={() => setPeriodoSeleccionado(null)}
                >
                <ArrowUpDown className="w-4 h-4 mr-2" style={{ transform: 'rotate(90deg)' }} />
                Cambiar periodo
                </button>
                
                <div className="invoices-footer-stats">
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

              {/* SECCIÓN DE PAGO */}
              {selectedPago.pago && (
                <div className="factura-section">
                  <h4 className="section-title">
                    <DollarSign className="w-4 h-4" />
                    Información del Pago
                  </h4>
                  <div className="pagos-list">
                    <div 
                      className={`pago-item ${selectedPago.pago.estado_pago === 'ANULADO' ? 'pago-anulado' : ''}`}
                    >
                      {/* CABECERA DEL PAGO */}
                      <div className="pago-header">
                        <div className="pago-header-left">
                          <span className="pago-numero">Pago #{selectedPago.pago.id_pago}</span>
                        </div>
                        {getStatusBadge(selectedPago.pago.estado_pago)}
                      </div>
                      
                      {/* DETALLES DEL PAGO */}
                      <div className="pago-details">
                        <div className="pago-detail">
                          <span className="pago-label">
                            <Calendar className="w-3 h-3" />
                            Fecha:
                          </span>
                          <span className="pago-value">{formatDate(selectedPago.pago.fecha_pago)}</span>
                        </div>
                        
                        <div className="pago-detail">
                          <span className="pago-label">
                            <DollarSign className="w-3 h-3" />
                            Monto:
                          </span>
                          <span className="pago-value font-bold text-green-600">
                            {formatCurrency(selectedPago.pago.monto_pago)}
                          </span>
                        </div>
                        
                        <div className="pago-detail">
                          <span className="pago-label">
                            {getMetodoIcon(selectedPago.pago.metodo_pago)}
                            Método:
                          </span>
                          <span className="pago-value">
                            {selectedPago.pago.metodo_pago}
                          </span>
                        </div>

                        {/* CAJERO */}
                        {selectedPago.pago.cajero && (
                          <div className="pago-detail">
                            <span className="pago-label">
                              <User className="w-3 h-3" />
                              Cajero:
                            </span>
                            <span className="pago-value">
                              {selectedPago.pago.cajero}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* OBSERVACIONES */}
                      {selectedPago.pago.observaciones && (
                        <div className="pago-observaciones">
                          <span className="pago-obs-label">
                            <FileText className="w-3 h-3" />
                            Observaciones:
                          </span>
                          <p className="pago-obs-text">{selectedPago.pago.observaciones}</p>
                        </div>
                      )}

                      {/* INFORMACIÓN DE ANULACIÓN */}
                      {selectedPago.pago.estado_pago === 'ANULADO' && (
                        <div className="pago-anulacion-info">
                          <div className="anulacion-header">
                            <Ban className="w-4 h-4" />
                            <span>Pago Anulado</span>
                          </div>
                          {selectedPago.pago.fecha_anulacion && (
                            <div className="anulacion-detail">
                              <span className="anulacion-label">Fecha de anulación:</span>
                              <span className="anulacion-value">
                                {formatDate(selectedPago.pago.fecha_anulacion)}
                              </span>
                            </div>
                          )}
                          {selectedPago.pago.motivo_anulacion && (
                            <div className="anulacion-detail">
                              <span className="anulacion-label">Motivo:</span>
                              <span className="anulacion-value">{selectedPago.pago.motivo_anulacion}</span>
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
                      <span className="font-bold">{formatCurrency(selectedPago.total)}</span>
                    </div>
                    <div className="summary-row pagado">
                      <span>Total Pagado:</span>
                      <span className="font-bold text-green-600">
                        {formatCurrency(selectedPago.monto_pagado)}
                      </span>
                    </div>
                    <div className="summary-row total">
                      <span>Saldo Pendiente:</span>
                      <span className={`font-bold ${
                        selectedPago.saldo_pendiente > 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {formatCurrency(selectedPago.saldo_pendiente)}
                      </span>
                    </div>
                    
                    {/* INDICADOR VISUAL DEL PROGRESO */}
                    <div className="payment-progress">
                      <div className="progress-bar">
                        <div 
                          className="progress-fill"
                          style={{
                            width: `${(selectedPago.monto_pagado / parseFloat(selectedPago.total)) * 100}%`
                          }}
                        />
                      </div>
                      <span className="progress-percentage">
                        {((selectedPago.monto_pagado / parseFloat(selectedPago.total)) * 100).toFixed(1)}% pagado
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* MENSAJE SI NO HAY PAGO */}
              {!selectedPago.pago && (
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


{/* ==================== MODAL CREAR PAGO CON MORA ==================== */}
{showCreateModal && (
  <div className="modal-overlay">
    <div className="modal modal-payment">
      <div className="modal-header">
        <h3>
          <Plus className="w-5 h-5 inline mr-2" />
          Registrar Nuevo Pago
        </h3>
        <button className="modal-close" onClick={closeCreateModal}>
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="modal-body">
        {/* Información de la factura */}
        {selectedFactura && (
          <div className="factura-info-card">
            <div className="factura-info-header">
              <FileText className="w-5 h-5 text-blue-600" style={{ marginRight: '8px' }} />
              <h4>Factura: {selectedFactura.num_factura}</h4>
            </div>

            {loadingResumen ? (
              <div className="resumen-loading">
                <RefreshCw className="w-6 h-6 animate-spin" style={{ margin: '0 auto' }} />
                <p>Calculando resumen...</p>
              </div>
            ) : resumenPago ? (
              <>
                {/* ⭐ INFORMACIÓN DE MORA */}
                {resumenPago?.mora?.aplica && getSafeValue(resumenPago.mora?.monto) > 0 && (
                  <div className="mora-card">
                    <div className="mora-card-header">
                      <AlertCircle className="w-4 h-4 text-orange-600" style={{ marginRight: '6px' }} />
                      <span>⚠️ Mora por Pago Tardío</span>
                    </div>
                    <div className="mora-card-body">
                      <p><strong>Monto de mora:</strong> {formatCurrencySafe(resumenPago.mora.monto)}</p>
                      <p><strong>Días transcurridos:</strong> {getSafeValue(resumenPago.mora.dias_transcurridos, 0)} días desde emisión</p>
                      <p><strong>Días de mora:</strong> {getSafeValue(resumenPago.mora.dias_mora_efectivos, 0)} días efectivos</p>
                      <p className="mora-detalle">{resumenPago.mora.detalle || 'Sin detalles'}</p>
                    </div>
                  </div>
                )}

                {/* ⭐ DETALLES DE MULTAS */}
                {resumenPago.multas?.tiene_multas && resumenPago.multas?.detalles?.length > 0 && (
                  <div className="multas-card">
                    <div className="multas-card-header">
                      <AlertCircle className="w-4 h-4 text-red-600" style={{ marginRight: '6px' }} />
                      <span>Multas Incluidas ({resumenPago.multas.cantidad || 0})</span>
                    </div>
                    <div className="multas-list">
                      {resumenPago.multas.detalles.map((multa, idx) => (
                        <div key={idx} className="multa-item">
                          <span>{multa.descripcion || 'Multa'}</span>
                          <span>{formatCurrencySafe(multa.subtotal)}</span>
                        </div>
                      ))}
                      <div className="multas-total">
                        <span>Total Multas (+ IVA {getSafeValue(resumenPago.iva?.porcentaje, 0).toFixed(1)}%):</span>
                        <span>{formatCurrencySafe(resumenPago.multas.total_con_iva)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ⭐ RESUMEN DE OPCIONES */}
                <div className="opciones-pago-container">
                  <h5 className="opciones-pago-title">💰 Opciones de Pago</h5>

                  <table className="resumen-table">
                    <tbody>
                      {/* OPCIÓN 1: TODO */}
                      <tr>
                        <td colSpan="2" className="opcion-header-completa">
                          📊 Opción 1: Pagar TODO {resumenPago.multas?.tiene_multas && '(incluye multas)'}
                        </td>
                      </tr>
                      <tr>
                        <td>Subtotal:</td>
                        <td>{formatCurrencySafe(resumenPago.totales?.opcion_completa?.subtotal)}</td>
                      </tr>
                      {getSafeValue(resumenPago.totales?.opcion_completa?.descuento) > 0 && (
                        <tr className="descuento-row">
                          <td>- Descuento:</td>
                          <td>{formatCurrencySafe(resumenPago.totales.opcion_completa.descuento)}</td>
                        </tr>
                      )}
                      <tr>
                        <td>Base imponible:</td>
                        <td>{formatCurrencySafe(resumenPago.totales?.opcion_completa?.base)}</td>
                      </tr>
                      <tr>
                        <td>+ IVA ({getSafeValue(resumenPago.iva?.porcentaje, 0).toFixed(1)}%):</td>
                        <td>{formatCurrencySafe(resumenPago.totales?.opcion_completa?.iva)}</td>
                      </tr>
                      <tr className="subtotal-row">
                        <td>= Subtotal con IVA:</td>
                        <td>{formatCurrencySafe(resumenPago.totales?.opcion_completa?.subtotal_con_iva)}</td>
                      </tr>
                      {resumenPago.mora?.aplica && getSafeValue(resumenPago.mora?.monto) > 0 && (
                        <tr className="mora-row">
                          <td>+ Mora:</td>
                          <td>{formatCurrencySafe(resumenPago.mora.monto)}</td>
                        </tr>
                      )}
                      <tr className="total-final-completa">
                        <td>TOTAL A PAGAR:</td>
                        <td>{formatCurrencySafe(resumenPago.totales?.opcion_completa?.total_final)}</td>
                      </tr>

                      {/* OPCIÓN 2: SIN MULTAS */}
                      {resumenPago.multas?.tiene_multas && (
                        <>
                          <tr className="table-separator"></tr>
                          <tr>
                            <td colSpan="2" className="opcion-header-parcial">
                              ✨ Opción 2: Pagar SIN multas
                            </td>
                          </tr>
                          <tr>
                            <td>Subtotal (sin multas):</td>
                            <td>{formatCurrencySafe(resumenPago.totales?.opcion_sin_multas?.subtotal)}</td>
                          </tr>
                          {getSafeValue(resumenPago.totales?.opcion_sin_multas?.descuento) > 0 && (
                            <tr className="descuento-row">
                              <td>- Descuento:</td>
                              <td>{formatCurrencySafe(resumenPago.totales.opcion_sin_multas.descuento)}</td>
                            </tr>
                          )}
                          <tr>
                            <td>Base imponible:</td>
                            <td>{formatCurrencySafe(resumenPago.totales?.opcion_sin_multas?.base)}</td>
                          </tr>
                          <tr>
                            <td>+ IVA ({getSafeValue(resumenPago.iva?.porcentaje, 0).toFixed(1)}%):</td>
                            <td>{formatCurrencySafe(resumenPago.totales?.opcion_sin_multas?.iva)}</td>
                          </tr>
                          <tr className="subtotal-row">
                            <td>= Subtotal con IVA:</td>
                            <td>{formatCurrencySafe(resumenPago.totales?.opcion_sin_multas?.subtotal_con_iva)}</td>
                          </tr>
                          {resumenPago.mora?.aplica && getSafeValue(resumenPago.mora?.monto) > 0 && (
                            <tr className="mora-row">
                              <td>+ Mora:</td>
                              <td>{formatCurrencySafe(resumenPago.mora.monto)}</td>
                            </tr>
                          )}
                          <tr className="total-final-parcial">
                            <td>TOTAL A PAGAR:</td>
                            <td>{formatCurrencySafe(resumenPago.totales?.opcion_sin_multas?.total_final)}</td>
                          </tr>
                          <tr>
                            <td colSpan="2" className="multas-pendientes-info">
                              💡 Multas pendientes: {formatCurrencySafe(resumenPago.totales?.opcion_sin_multas?.multas_pendientes)}
                            </td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>

                  {resumenPago.recomendacion?.mostrar_opciones && (
                    <div className="recomendacion-box">
                      💡 {resumenPago.recomendacion?.mensaje || 'Seleccione una opción de pago'}
                    </div>
                  )}
                </div>

              
              </>
            ) : (
              <p className="resumen-error">No se pudo cargar el resumen del pago</p>
            )}
          </div>
        )}
        {/*  MONTO PERSONALIZADO */}
        <div className="form-group">
          <label>
            <DollarSign className="w-4 h-4 mr-1" />
            Monto a Pagar *
          </label>

          <input
            type="number"
            step="0.01"
            min="0"
            className={`form-input ${
              parseFloat(nuevoPago.monto_pago) >
              getSafeValue(resumenPago.totales?.opcion_completa?.total_final, 0)
                ? 'error'
                : ''
            }`}
            value={nuevoPago.monto_pago}
            onChange={(e) =>
              setNuevoPago({ ...nuevoPago, monto_pago: e.target.value })
            }
            placeholder="0.00"
          />

          {parseFloat(nuevoPago.monto_pago) >
            getSafeValue(resumenPago.totales?.opcion_completa?.total_final, 0) && (
            <p className="form-error">
              ⚠️ El monto excede el total de la factura
            </p>
          )}

          <small className="form-helper">
            💡 Puede ingresar un monto personalizado o usar los botones de abajo
          </small>
        </div>



        {/* Método de pago */}
        <div className="form-group">
          <label>Método de Pago *</label>
          <select
            className="form-input"
            value={nuevoPago.metodo_pago}
            onChange={(e) => setNuevoPago({ ...nuevoPago, metodo_pago: e.target.value })}
          >
            <option value="EFECTIVO">Efectivo</option>
            <option value="TRANSFERENCIA">Transferencia</option>
            <option value="TARJETA">Tarjeta</option>
          </select>
        </div>

        {/* Observaciones */}
        <div className="form-group">
          <label>Observaciones</label>
          <textarea
            className="form-input"
            rows="2"
            value={nuevoPago.observaciones}
            onChange={(e) => setNuevoPago({ ...nuevoPago, observaciones: e.target.value })}
            placeholder="Observaciones adicionales..."
          />
        </div>
      </div>

      {/* ⭐ BOTONES */}
      <div className="modal-footer" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button className="btn-secondary" onClick={closeCreateModal}>
          Cancelar
        </button>
          {resumenPago && resumenPago.totales ? (
            <>
              {resumenPago.multas?.tiene_multas ? (
                <>
                  {/* 👉 SOLO aparece si el monto sin multas es mayor a 0 */}
                  {getSafeValue(
                    resumenPago.totales.opcion_sin_multas?.total_final,
                    0
                  ) > 0 && (
                    <button
                      className="btn-primary"
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
                    >
                      <DollarSign className="w-4 h-4" />
                      {loading
                        ? 'Registrando...'
                        : `Pagar Sin Multas (${formatCurrencySafe(
                            resumenPago.totales.opcion_sin_multas?.total_final
                          )})`}
                    </button>
                  )}

                  {/* 👉 Botón pagar TODO */}
                  <button
                    className="btn-pagar-sin-multas"
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
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {loading
                      ? 'Registrando...'
                      : `Pagar TODO (${formatCurrencySafe(
                          resumenPago.totales.opcion_completa?.total_final
                        )})`}
                  </button>
                </>
              ) : (
                <button
                  className="btn-primary"
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
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  {loading
                    ? 'Registrando...'
                    : `Registrar Pago (${formatCurrencySafe(
                        resumenPago.totales.opcion_completa?.total_final
                      )})`}
                </button>
              )}
            </>
          ) : (
            <button className="btn-secondary" disabled>
              Cargando opciones...
            </button>
          )}

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