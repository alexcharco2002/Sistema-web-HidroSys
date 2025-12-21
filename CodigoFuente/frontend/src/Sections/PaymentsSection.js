// src/sections/PaymentsSection.js
// MÓDULO DE PAGOS - Con sistema de periodos mensuales

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './PaymentsSection.css'; // Reutilizar estilos similares a InvoicesSection

import PaymentReceipt, { generatePaymentPDF } from '../components/PaymentReceipt';

import paymentsServices from '../services/paymentsServices';
import authService from '../services/authServices';

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
  const [facturas, setFacturas] = useState([]); // ✅ NUEVO
  const [, setPagos] = useState([]);
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

  // ============================================================
  // ESTADOS DE ESTADÍSTICAS
  // ============================================================
  const [stats, setStats] = useState({
    total_pagos: 0,
    pagos_registrados: 0,
    pagos_activos: 0,  // ✅ AGREGAR
    pagos_anulados: 0,
     monto_total: 0,
    monto_total_pagado: 0,
    monto_efectivo: 0,
    monto_transferencia: 0,
    monto_tarjeta: 0
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

  const fetchPagosByPeriodo = useCallback(async () => {
    if (!periodoSeleccionado) return;
    setLoading(true);
    setError(null);
    
    try {
      const periodoStr = `${periodoSeleccionado.anio}-${String(periodoSeleccionado.mes).padStart(2, '0')}`;
      
      const result = await paymentsServices.getPagos({
        periodo: periodoStr,
        limit: 1000
      });

      if (result.success && result.data) {
        console.log('📦 Pagos cargados:', result.data.length);
        setPagos(result.data);
        
        // Actualizar el periodo con los datos reales
        const montoTotal = result.data.reduce((sum, p) => 
          sum + parseFloat(p.monto_pago || 0), 0
        );
        
        const montoEfectivo = result.data
          .filter(p => p.metodo_pago === 'EFECTIVO')
          .reduce((sum, p) => sum + parseFloat(p.monto_pago || 0), 0);
        
        const montoTransferencia = result.data
          .filter(p => p.metodo_pago === 'TRANSFERENCIA')
          .reduce((sum, p) => sum + parseFloat(p.monto_pago || 0), 0);

        const montoTarjeta = result.data
          .filter(p => p.metodo_pago === 'TARJETA')
          .reduce((sum, p) => sum + parseFloat(p.monto_pago || 0), 0);
        
        setPeriodos(prevPeriodos => 
          prevPeriodos.map(p => 
            p.mes === periodoSeleccionado.mes && p.anio === periodoSeleccionado.anio 
              ? {
                  ...p,
                  total_pagos: result.data.length,
                  monto_total: montoTotal,
                  monto_efectivo: montoEfectivo,
                  monto_transferencia: montoTransferencia,
                  monto_tarjeta: montoTarjeta,
                  tiene_pagos: result.data.length > 0
                }
              : p
          )
        );
      } else {
        setError('No se pudieron cargar los pagos');
        setPagos([]);
      }
      
    } catch (err) {
      setError('Error al cargar pagos del periodo');
      console.error(err);
      setPagos([]);
    } finally {
      setLoading(false);
    }
  }, [periodoSeleccionado]);

  // 
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
            limit: 1000
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
    
    if (!factura.pagos || factura.pagos.length === 0) {
      console.log('   ⚠️ No hay pagos asociados');
      return 0;
    }
    
    const total = factura.pagos
      .filter(pago => {
        return pago.estado_pago === 'REGISTRADO';
      })
      .reduce((sum, pago) => sum + parseFloat(pago.monto_pago || 0), 0);
    
    return total;
  };

  const calcularSaldoPendiente = (factura) => {
    const totalPagado = calcularTotalPagado(factura);
    const saldo = parseFloat(factura.total || 0) - totalPagado;
    return saldo;
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
    
    const matchesSearch =
      factura.num_factura?.toLowerCase().includes(searchLower) ||
      factura.usuario_afiliado?.cod_usuario_afi?.toString().includes(searchTerm) ||
      factura.usuario_afiliado?.usuario_sistema?.nombres?.toLowerCase().includes(searchLower) ||
      factura.usuario_afiliado?.usuario_sistema?.apellidos?.toLowerCase().includes(searchLower) ||
      factura.usuario_afiliado?.usuario_sistema?.cedula?.includes(searchTerm);

    const matchesStatus = filterStatus === 'all' || factura.estado_factura === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const sortedFacturas = useMemo(() => {
    return [...filteredFacturas].sort((a, b) => {
      let comparison = 0;

      if (sortOption === 'fecha') {
        comparison = new Date(a.fecha_emision) - new Date(b.fecha_emision);
      } else if (sortOption === 'monto') {
        comparison = parseFloat(a.total) - parseFloat(b.total);
      } else if (sortOption === 'vencimiento') {
        comparison = new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento);
      } else if (sortOption === 'estado') {
        comparison = (a.estado_factura || '').localeCompare(b.estado_factura || '');
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredFacturas, sortOption, sortOrder]);

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
  const openPaymentModal = (factura) => {
    if (!permissions.canCreate) {
      alert('❌ No tienes permiso para registrar pagos');
      return;
    }

    const saldoPendiente = calcularSaldoPendiente(factura);

    setNuevoPago({
      id_factura: factura.id_factura,
      id_usuario_afi: factura.id_usuario_afi,
      monto_pago: saldoPendiente.toFixed(2), 
      metodo_pago: 'EFECTIVO',
      observaciones: ''
    });
    setSelectedFactura(factura); // Guardar referencia
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


  const handleCreatePago = async () => {
    // ============================================================
    // VALIDACIONES INICIALES
    // ============================================================
    if (!nuevoPago.monto_pago || parseFloat(nuevoPago.monto_pago) <= 0) {
      alert('⚠️ El monto debe ser mayor a 0');
      return;
    }

    // Si hay una factura seleccionada, validar que el monto no exceda el saldo
    if (selectedFactura) {
      const saldoPendiente = calcularSaldoPendiente(selectedFactura);
      const montoPago = parseFloat(nuevoPago.monto_pago);
      
      if (montoPago > saldoPendiente) {
        const confirmar = window.confirm(
          `⚠️ El monto ($${montoPago.toFixed(2)}) excede el saldo pendiente ($${saldoPendiente.toFixed(2)}).\n\n¿Desea continuar de todas formas?`
        );
        if (!confirmar) return;
      }
    }

    setLoading(true);
    setError(null);
    
    try {
      const currentUser = authService.getCurrentUser();
      
      if (!currentUser || !currentUser.id_usuario_sistema) {
        throw new Error('No se pudo identificar al usuario actual');
      }

      // ============================================================
      // PASO 1: PREPARAR DATOS DEL PAGO
      // ============================================================
      const pagoData = {
        ...nuevoPago,
        id_cajero: currentUser.id_usuario_sistema,
        monto_pago: parseFloat(nuevoPago.monto_pago).toFixed(2)
      };

      console.log('📝 Creando pago con datos:', pagoData);

      // ============================================================
      // PASO 2: CREAR EL PAGO EN LA BASE DE DATOS
      // ============================================================
      const result = await paymentsServices.createPago(pagoData);
      
      if (!result.success) {
        throw new Error(result.message || 'Error al crear el pago');
      }

      const pagoCreado = result.data;
      console.log('✅ Pago creado exitosamente:', pagoCreado);

      // ============================================================
      // PASO 3: GENERAR Y GUARDAR COMPROBANTE PDF
      // ============================================================
      let comprobanteGuardado = false;
      let errorComprobante = null;

      try {
        console.log('📄 Generando comprobante PDF...');
        
        // Generar el archivo PDF
        const pdfFile = await generatePaymentPDF(pagoCreado, selectedFactura);
        console.log('✅ PDF generado:', pdfFile.name, `(${pdfFile.size} bytes)`);

        // 🔽 DESCARGAR PARA VERIFICAR CONTENIDO
        const blobUrl = URL.createObjectURL(pdfFile);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = pdfFile.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

        // Guardar el comprobante en la base de datos
        console.log('☁️ Guardando comprobante en la base de datos...');
        const uploadResult = await paymentsServices.uploadComprobante(
          pagoCreado.id_pago, 
          pdfFile
        );
        
        if (uploadResult.success) {
          console.log('✅ Comprobante guardado exitosamente');
          comprobanteGuardado = true;
        } else {
          errorComprobante = uploadResult.message || 'Error desconocido al guardar';
          console.warn('⚠️ El pago se creó pero el comprobante no se pudo guardar:', errorComprobante);
        }
        
      } catch (pdfError) {
        errorComprobante = pdfError.message;
        console.error('❌ Error generando/guardando PDF:', pdfError);
      }

      // ============================================================
      // PASO 4: ACTUALIZAR INTERFAZ Y MOSTRAR RESULTADO
      // ============================================================
      
      // Cerrar modal de creación
      closeCreateModal();
      
      // Preparar datos para mostrar comprobante
      setPagoRegistrado(pagoCreado);
      setFacturaDelPago(selectedFactura);

      // Recargar datos actualizados
      console.log('🔄 Recargando datos...');
      await Promise.all([
        fetchFacturasPeriodo(),
        fetchStats()
      ]);
      console.log('✅ Datos recargados');

      // Mostrar mensaje de éxito
      if (comprobanteGuardado) {
        alert('✅ Pago registrado exitosamente\n📄 Comprobante guardado en la base de datos');
      } else if (errorComprobante) {
        alert(`✅ Pago registrado exitosamente\n⚠️ Advertencia: ${errorComprobante}\n\nPuede generar el comprobante más tarde desde la lista de pagos.`);
      }

      // Mostrar comprobante visual en pantalla
      setShowReceipt(true);

    } catch (error) {
      // ============================================================
      // MANEJO DE ERRORES
      // ============================================================
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
  const handleAnularPago = async (pagoId) => {
    if (!permissions.canDelete) {
      alert('❌ No tienes permiso para anular pagos');
      return;
    }

    const motivo = window.prompt('Motivo de anulación (opcional):');
    if (motivo === null) return;

    setLoading(true);
    try {
      const result = await paymentsServices.anularPago(pagoId, motivo);
      
      if (result.success) {
        alert('✅ Pago anulado correctamente');
        closeModal();
        await fetchPagosByPeriodo();
        await fetchStats();
      } else {
        alert(`❌ Error: ${result.message}`);
      }
    } catch (error) {
      alert('❌ Error al anular pago');
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

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('es-EC', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateShort = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('es-EC', {
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
              <DollarSign className="w-7 h-7 text-green-600" />
              <h2>Gestión de Pagos</h2>
            </div>
          </div>

          {/* SECCIÓN 1: PERÍODOS RECIENTES */}
          <div className="periodo-selector-container">
            <div className="periodo-selector-header">
              <div>
                <h3>
                  <CalendarDays className="w-5 h-5 text-green-600 mr-2" />
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
                  <Clock className="w-5 h-5 text-green-600 mr-2 flex-shrink-0 self-center" />
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

            <div className="users-stats">
              {/* Facturas Mostradas */}
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
                placeholder="Buscar por ID, factura, afiliado..."
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
                <option value="REGISTRADO">Registrados</option>
                <option value="ANULADO">Anulados</option>
              </select>

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
                  fetchPagosByPeriodo();
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
                      {factura.pagos && factura.pagos.length > 0 ? (
                        <div className="comprobantes-list">
                          {factura.pagos.map((pago) => {
                            const tieneArchivo =
                              pago.tiene_comprobante || (pago.nombre_archivo && pago.nombre_archivo.trim() !== '');

                            if (!tieneArchivo) return null;

                            return (
                              <div key={pago.id_pago} className="flex gap-1">

                                {/* Descargar comprobante */}
                                <button
                                  className="inv-btn inv-btn-edit"
                                  onClick={() => descargarComprobante(pago.id_pago)}
                                  title={`Descargar comprobante de pago #${pago.id_pago} - ${
                                    pago.nombre_archivo || 'comprobante.pdf'
                                  }`}
                                >
                                  <FileCheck className="w-4 h-4" />
                                </button>
                              </div>
                            );
                          })}

                          {factura.pagos.filter(
                            (p) => p.tiene_comprobante || (p.nombre_archivo && p.nombre_archivo.trim() !== '')
                          ).length === 0 && (
                            <span className="text-xs text-gray-400">Sin comprobantes</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
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

                      {factura.estado_factura === 'pagada' && (
                        <span className="text-xs text-green-600 font-semibold px-2">
                          ✓ Completa
                        </span>
                      )}

                      {factura.estado_factura === 'anulada' && (
                        <span className="text-xs text-red-600 font-semibold px-2">
                          ✗ Anulada
                        </span>
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
                    <div className="detail-group">
                      <label>Código</label>
                      <p className="font-mono">{selectedPago.usuario_afiliado.cod_usuario_afi}</p>
                    </div>
                    <div className="detail-group form-group-full">
                      <label>Nombre</label>
                      <p>
                        {selectedPago.usuario_afiliado.usuario_sistema?.nombres}{' '}
                        {selectedPago.usuario_afiliado.usuario_sistema?.apellidos}
                      </p>
                    </div>
                    <div className="detail-group">
                      <label>Cédula</label>
                      <p className="font-mono">
                        {selectedPago.usuario_afiliado.usuario_sistema?.cedula || 'N/A'}
                      </p>
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

              {/* SECCIÓN DE PAGOS ASOCIADOS */}
              {selectedPago.pagos && selectedPago.pagos.length > 0 && (
                <div className="factura-section">
                  <h4 className="section-title">
                    <DollarSign className="w-4 h-4" />
                    Pagos Registrados ({selectedPago.pagos.length})
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
                            <span className="pago-numero">Pago #{index + 1}</span>
                            <span className="pago-id">ID: {pago.id_pago}</span>
                          </div>
                          {getStatusBadge(pago.estado_pago)}
                        </div>
                        
                        {/* DETALLES DEL PAGO */}
                        <div className="pago-details">
                          <div className="pago-detail">
                            <span className="pago-label">
                              <Calendar className="w-3 h-3" />
                              Fecha:
                            </span>
                            <span className="pago-value">{formatDate(pago.fecha_pago)}</span>
                          </div>
                          
                          <div className="pago-detail">
                            <span className="pago-label">
                              <DollarSign className="w-3 h-3" />
                              Monto:
                            </span>
                            <span className="pago-value font-bold text-green-600">
                              {formatCurrency(pago.monto_pago)}
                            </span>
                          </div>
                          
                          <div className="pago-detail">
                            <span className="pago-label">
                              {getMetodoIcon(pago.metodo_pago)}
                              Método:
                            </span>
                            <span className="pago-value">
                              {pago.metodo_pago}
                            </span>
                          </div>

                          {/* CAJERO (si existe) */}
                          {pago.cajero && (
                            <div className="pago-detail">
                              <span className="pago-label">
                                <User className="w-3 h-3" />
                                Cajero:
                              </span>
                              <span className="pago-value">
                                {pago.cajero.nombres} {pago.cajero.apellidos}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* OBSERVACIONES */}
                        {pago.observaciones && (
                          <div className="pago-observaciones">
                            <span className="pago-obs-label">
                              <FileText className="w-3 h-3" />
                              Observaciones:
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
                                <span className="anulacion-label">Fecha de anulación:</span>
                                <span className="anulacion-value">
                                  {formatDate(pago.fecha_anulacion)}
                                </span>
                              </div>
                            )}
                            {pago.motivo_anulacion && (
                              <div className="anulacion-detail">
                                <span className="anulacion-label">Motivo:</span>
                                <span className="anulacion-value">{pago.motivo_anulacion}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {/* RESUMEN DE PAGOS */}
                  <div className="pagos-summary">
                    <div className="summary-header">
                      <TrendingUp className="w-4 h-4" />
                      <span>Resumen de Pagos</span>
                    </div>
                    <div className="summary-row">
                      <span>Total Factura:</span>
                      <span className="font-bold">{formatCurrency(selectedPago.total)}</span>
                    </div>
                    <div className="summary-row pagado">
                      <span>Total Pagado:</span>
                      <span className="font-bold text-green-600">
                        {formatCurrency(calcularTotalPagado(selectedPago))}
                      </span>
                    </div>
                    <div className="summary-row total">
                      <span>Saldo Pendiente:</span>
                      <span className={`font-bold ${
                        calcularSaldoPendiente(selectedPago) > 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {formatCurrency(calcularSaldoPendiente(selectedPago))}
                      </span>
                    </div>
                    
                    {/* INDICADOR VISUAL DEL PROGRESO */}
                    <div className="payment-progress">
                      <div className="progress-bar">
                        <div 
                          className="progress-fill"
                          style={{
                            width: `${(calcularTotalPagado(selectedPago) / parseFloat(selectedPago.total)) * 100}%`
                          }}
                        />
                      </div>
                      <span className="progress-percentage">
                        {((calcularTotalPagado(selectedPago) / parseFloat(selectedPago.total)) * 100).toFixed(1)}% pagado
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
              <div className="form-group">
                <label>ID Factura (opcional):</label>
                <input
                  type="number"
                  className="form-input"
                  value={nuevoPago.id_factura}
                  onChange={(e) => setNuevoPago({...nuevoPago, id_factura: e.target.value})}
                  placeholder="Ingrese ID de la factura"
                />
              </div>

              <div className="form-group">
                <label>Monto: *</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={nuevoPago.monto_pago}
                  onChange={(e) => setNuevoPago({...nuevoPago, monto_pago: e.target.value})}
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="form-group">
                <label>Método de Pago: *</label>
                <select
                  className="form-input"
                  value={nuevoPago.metodo_pago}
                  onChange={(e) => setNuevoPago({...nuevoPago, metodo_pago: e.target.value})}
                >
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="TRANSFERENCIA">Transferencia</option>
                  <option value="TARJETA">Tarjeta</option>
                </select>
              </div>

              <div className="form-group">
                <label>Observaciones:</label>
                <textarea
                  className="form-input"
                  rows="3"
                  value={nuevoPago.observaciones}
                  onChange={(e) => setNuevoPago({...nuevoPago, observaciones: e.target.value})}
                  placeholder="Observaciones adicionales..."
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeCreateModal}>
                Cancelar
              </button>
              <button 
                className="btn-primary" 
                onClick={handleCreatePago}
                disabled={loading || !nuevoPago.monto_pago}
              >
                {loading ? 'Registrando...' : 'Registrar Pago'}
              </button>
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