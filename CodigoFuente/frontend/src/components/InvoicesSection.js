// src/components/invoices/InvoicesSection.js
// MÓDULO DE FACTURAS - Con sistema de periodos mensuales mejorado

import React, { useState, useEffect, useMemo, useCallback } from 'react';

import './InvoicesSection.css'; // Reutilizar estilos de lecturas

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
  Gauge, User, IdCard  ,Tag, Percent, Package, ChevronDown, Check
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
  const [, setPeriodoActual] = useState(null);
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState(null);
  const [loadingPeriodos, setLoadingPeriodos] = useState(false);
  const [periodosInicializados, setPeriodosInicializados] = useState(false); // 🔥 NUEVO FLAG

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
  // ESTADOS PARA IVA Y DESCUENTOS
  // ============================================================
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentData, setPaymentData] = useState({
    factura: null,
    descuentoTipo: 'ninguno', // 'ninguno' | 'porcentaje' | 'valor'
    descuentoValor: 0
  });
  // ============================================================
  // ESTADOS  MANEJAR SERVICOS ADICIONALES 
  // ============================================================
  const [showServicios, setShowServicios] = useState(false);
  const [serviciosDisponibles, setServiciosDisponibles] = useState([]);
  const [serviciosSeleccionados, setServiciosSeleccionados] = useState([]);

    // Después de los estados existentes de servicios
  const [showServiciosModal, setShowServiciosModal] = useState(false);
  const [facturaSeleccionadaServicios, setFacturaSeleccionadaServicios] = useState(null);
  const [serviciosSeleccionadosModal, setServiciosSeleccionadosModal] = useState([]);

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
    // ✅ Si ya se cargaron, no volver a cargar
    if (periodosInicializados) {
      console.log('⏭️ Períodos ya cargados, omitiendo...');
      return;
    }
    
    setLoadingPeriodos(true);
    try {
      console.log('🔄 Cargando períodos...');
      
      const periodosData = await invoicesServices.getPeriodosDisponibles();

      const periodosBase = periodosData.map(p => {
        const [anio, mes] = p.valor.split('-');
        return {
          mes: parseInt(mes),
          anio: parseInt(anio),
          nombre_mes: p.texto.split(' ')[0],
          valor: p.valor,
          tiene_facturas: false,
          total_facturas: 0,
          monto_total: 0,
          monto_cobrado: 0,
          monto_pendiente: 0,
          porcentaje_completado: 0
        };
      });

      const periodosConStats = await Promise.all(
        periodosBase.map(async (periodo) => {
          try {
            const periodoStr = `${periodo.anio}-${String(periodo.mes).padStart(2, '0')}`;
            const statsResult = await invoicesServices.getStats(periodoStr);
            
            if (statsResult.success && statsResult.data) {
              const stats = statsResult.data;
              return {
                ...periodo,
                tiene_facturas: stats.total_facturas > 0,
                total_facturas: stats.total_facturas,
                monto_total: stats.monto_total,
                monto_cobrado: stats.monto_total_cobrado,
                monto_pendiente: stats.monto_total_pendiente,
                porcentaje_completado: stats.total_facturas > 0 ? 100 : 0
              };
            }
            return periodo;
          } catch (error) {
            console.error(`Error stats ${periodo.nombre_mes}:`, error);
            return periodo;
          }
        })
      );

      console.log('✅ Períodos cargados:', periodosConStats.length);
      setPeriodos(periodosConStats);
      setPeriodosInicializados(true); // 🔥 MARCAR COMO INICIALIZADO

      if (periodosConStats.length > 0) {
        const actual = periodosConStats[0];
        setPeriodoActual({
          mes: actual.mes,
          anio: actual.anio,
          nombre_mes: actual.nombre_mes
        });
      }

    } catch (error) {
      console.error('❌ Error:', error);
      setError('Error al cargar periodos disponibles');
    } finally {
      setLoadingPeriodos(false);
    }
  }, [periodosInicializados]); // 🔥 Depende del flag

  const fetchFacturasByPeriodo = useCallback(async () => {
    if (!periodoSeleccionado) return;
    setLoading(true);
    setError(null);
    
    try {
      const periodoStr = `${periodoSeleccionado.anio}-${String(periodoSeleccionado.mes).padStart(2, '0')}`;
      
      const result = await invoicesServices.getFacturas({
        periodo: periodoStr,
        limit: 1000,
        incluir_detalles: true
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
        
        setPeriodos(prevPeriodos => 
          prevPeriodos.map(p => 
            p.mes === periodoSeleccionado.mes && p.anio === periodoSeleccionado.anio 
              ? {
                  ...p,
                  total_facturas: result.data.length,
                  monto_total: montoTotal,
                  monto_cobrado: montoCobrado,
                  monto_pendiente: montoPendiente,
                  tiene_facturas: result.data.length > 0
                }
              : p
          )
        );
      } else {
        setError('No se pudieron cargar las facturas');
        setFacturas([]);
      }
      
    } catch (err) {
      setError('Error al cargar facturas del periodo');
      console.error(err);
      setFacturas([]);
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

    // Calcular porcentaje cobrado
  const getPorcentajeCobrado = (periodo) => {
    if (!periodo || !periodo.monto_total || periodo.monto_total === 0) return 0;
    return Math.round((periodo.monto_cobrado / periodo.monto_total) * 100);
  };

  // Calcular porcentaje pendiente
  const getPorcentajePendiente = (periodo) => {
    if (!periodo || !periodo.monto_total || periodo.monto_total === 0) return 0;
    return Math.round((periodo.monto_pendiente / periodo.monto_total) * 100);
  };




  // ============================================================
  // EFECTOS
  // ============================================================
  useEffect(() => {
    loadUserPermissions();
    fetchPeriodosDisponibles();
  }, [fetchPeriodosDisponibles]);

  // Cargar servicios activos
useEffect(() => {
  const fetchServicios = async () => {
    try {
      console.log('🔄 Cargando servicios activos...');
      const response = await invoicesServices.getServiciosActivos();
      console.log('📦 Respuesta servicios:', response);
      
      if (response.success && response.data) {
        console.log(`✅ ${response.data.length} servicios cargados`);
        setServiciosDisponibles(response.data);
      } else {
        console.warn('⚠️ No se cargaron servicios:', response.message);
        setServiciosDisponibles([]);
      }
    } catch (error) {
      console.error('❌ Error cargando servicios:', error);
      setServiciosDisponibles([]);
    }
  };

  // Solo ejecutar si ya se cargaron los permisos
  if (permissions.canRead) {
    fetchServicios();
  }
}, [permissions]); // ← Cambiar a [permissions] completo


  useEffect(() => {
    if (permissions.canRead && periodoSeleccionado) {
      fetchFacturasByPeriodo();
      fetchStats();

    }
  }, [
    periodoSeleccionado,
    permissions.canRead,
    fetchFacturasByPeriodo,
    fetchStats
  ]);
  




  // ============================================================
  // FUNCIONES DE FILTRADO Y ORDENAMIENTO
  // ============================================================
  const filteredFacturas = facturas.filter(factura => {
    const searchLower = searchTerm.toLowerCase();
    
    // Buscar en múltiples campos
    const matchesSearch =
      factura.num_factura?.toLowerCase().includes(searchLower) ||
      factura.id_factura?.toString().includes(searchTerm) ||
      factura.usuario_afiliado?.usuario_sistema?.nombres?.toLowerCase().includes(searchLower) ||
      factura.usuario_afiliado?.usuario_sistema?.apellidos?.toLowerCase().includes(searchLower) ||
      factura.usuario_afiliado?.usuario_sistema?.cedula?.includes(searchTerm);
    
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
    setError(null);
    setSelectedFactura(factura);
    setShowModal(true);
    
  };

  // Agregar junto a las otras funciones de modal
  const openServiciosModal = (factura) => {
    if (!permissions.canUpdate) {
      alert('❌ No tienes permiso para agregar servicios');
      return;
    }
    
    if (factura.estado_factura !== 'pendiente' && factura.estado_factura !== 'vencida') {
      alert('⚠️ Solo se pueden agregar servicios a facturas pendientes o vencidas');
      return;
    }
    
    setFacturaSeleccionadaServicios(factura);
    setServiciosSeleccionadosModal([]);
    setShowServiciosModal(true);
  };

  const closeServiciosModal = () => {
    setShowServiciosModal(false);
    setFacturaSeleccionadaServicios(null);
    setServiciosSeleccionadosModal([]);
  };

  const closeModal = () => {
    setShowModal(false);
    setModalType('');
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
  // FUNCIONES DE servicos 
  // ============================================================

  const handleAplicarServiciosIndividual = async () => {
    if (serviciosSeleccionadosModal.length === 0) {
      alert('⚠️ Selecciona al menos un servicio');
      return;
    }
    
    if (!facturaSeleccionadaServicios) return;
    
    const confirmado = window.confirm(
      `¿Agregar ${serviciosSeleccionadosModal.length} servicio(s) a la factura ${facturaSeleccionadaServicios.num_factura}?`
    );
    
    if (!confirmado) return;
    
    setLoading(true);
    try {
      const result = await invoicesServices.aplicarServiciosIndividual(
        facturaSeleccionadaServicios.id_factura,
        serviciosSeleccionadosModal
      );
      
      if (result.success) {
        alert(`✅ ${result.message}\n\nNuevo total: $${result.data.factura.total.toFixed(2)}`);
        closeServiciosModal();
        await fetchFacturasByPeriodo();
        await fetchStats();
      } else {
        alert(`❌ ${result.message}`);
      }
    } catch (error) {
      console.error('Error aplicando servicios:', error);
      alert('❌ Error al aplicar servicios');
    } finally {
      setLoading(false);
    }
  };

  const toggleServicioSeleccion = (idServicio) => {
    setServiciosSeleccionadosModal(prev => {
      if (prev.includes(idServicio)) {
        return prev.filter(id => id !== idServicio);
      } else {
        return [...prev, idServicio];
      }
    });
  };

  const handleAplicarServiciosMasivo = async () => {
    if (serviciosSeleccionados.length === 0) {
      alert('⚠️ Selecciona al menos un servicio');
      return;
    }
    
    if (!periodoSeleccionado) {
      alert('⚠️ No hay período seleccionado');
      return;
    }
    
    const periodoStr = `${periodoSeleccionado.anio}-${String(periodoSeleccionado.mes).padStart(2, '0')}`;
    
    const confirmado = window.confirm(
      `¿Aplicar ${serviciosSeleccionados.length} servicio(s) a TODAS las facturas pendientes del período ${formatearPeriodo(periodoSeleccionado.mes, periodoSeleccionado.anio)}?\n\n` +
      `Esto afectará todas las facturas pendientes y vencidas.`
    );
    
    if (!confirmado) return;
    
    setLoading(true);
    try {
      const data = {
        id_servicios: serviciosSeleccionados,
        periodo: periodoStr
      };
      
      console.log('📤 Enviando:', data);
      
      const result = await invoicesServices.aplicarServiciosMasivo(data);
      
      if (result.success) {
        alert(
          `✅ Servicios aplicados correctamente\n\n` +
          `Facturas afectadas: ${result.facturas_afectadas}\n` +
          `Detalles creados: ${result.detalles_creados}`
        );
        
        // Limpiar selección
        setServiciosSeleccionados([]);
        setShowServicios(false);
        
        // Recargar datos
        await fetchFacturasByPeriodo();
        await fetchStats();
      } else {
        alert(`❌ ${result.message}`);
      }
    } catch (error) {
      console.error('Error aplicando servicios:', error);
      alert('❌ Error al aplicar servicios masivamente');
    } finally {
      setLoading(false);
    }
  };


  // ============================================================
  // FUNCIONES DE MODAL DE PAGO
  // ============================================================
  const openPaymentModal = (factura) => {
    setPaymentData({
      factura: factura,
      descuentoTipo: 'ninguno',
      descuentoValor: 0
    });
    setShowPaymentModal(true);
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setPaymentData({
      factura: null,
      descuentoTipo: 'ninguno',
      descuentoValor: 0
    });
  };

  const handleConfirmPayment = async () => {
    if (!paymentData.factura) return;

    // Validación: si hay descuento, debe tener valor
    if (paymentData.descuentoTipo !== 'ninguno' && paymentData.descuentoValor <= 0) {
      alert('⚠️ Debes ingresar un valor de descuento mayor a 0');
      return;
    }

    // Validación: porcentaje no puede ser mayor a 100
    if (paymentData.descuentoTipo === 'porcentaje' && paymentData.descuentoValor > 100) {
      alert('⚠️ El porcentaje de descuento no puede ser mayor a 100%');
      return;
    }

    // Confirmación
    let mensajeConfirmacion = `¿Confirmar pago de la factura ${paymentData.factura.num_factura}?`;
    
    if (paymentData.descuentoTipo === 'porcentaje' && paymentData.descuentoValor > 0) {
      mensajeConfirmacion += `\n\nDescuento: ${paymentData.descuentoValor}%`;
    } else if (paymentData.descuentoTipo === 'valor' && paymentData.descuentoValor > 0) {
      mensajeConfirmacion += `\n\nDescuento: $${paymentData.descuentoValor.toFixed(2)}`;
    }

    const confirmado = window.confirm(mensajeConfirmacion);
    if (!confirmado) return;

    setLoading(true);

    try {
      const descuentoData = {
        tipo_descuento: paymentData.descuentoTipo,
        valor_descuento: paymentData.descuentoTipo !== 'ninguno' ? paymentData.descuentoValor : 0,
        marcar_como_pagada: true  // ✅ Siempre marcar como pagada al procesar pago
      };

      console.log('📤 Enviando datos de descuento:', descuentoData);

      const result = await invoicesServices.aplicarDescuento(
        paymentData.factura.id_factura,
        descuentoData
      );

      if (result.success) {
        // Mostrar mensaje de éxito con el nuevo total
        const nuevoTotal = result.data?.factura?.total || 0;
        const descuentoAplicado = result.data?.factura?.descuento_aplicado || 0;
        
        let mensaje = `✅ Factura ${paymentData.factura.num_factura} marcada como PAGADA`;
        
        if (descuentoAplicado > 0) {
          mensaje += `\n\n💰 Descuento aplicado: $${descuentoAplicado.toFixed(2)}`;
        }
        
        mensaje += `\n💵 Total final: $${nuevoTotal.toFixed(2)}`;
        
        alert(mensaje);
        
        // Cerrar modal y recargar datos
        closePaymentModal();
        await fetchFacturasByPeriodo();
        await fetchStats();
        
      } else {
        setError(result.message || 'Error al procesar el pago');
        alert(`❌ ${result.message || 'Error al procesar el pago'}`);
      }

    } catch (error) {
      console.error('❌ Error al confirmar pago:', error);
      setError('Error al procesar el pago');
      alert('❌ Error al procesar el pago. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };




  // ============================================================
  // HELPER FUNCTIONS
  // ============================================================
  const getStatusBadge = (estado) => {
    const configs = {
      pendiente: { icon: Clock, texto: 'Pendiente' },
      pagada: { icon: CheckCircle, texto: 'Pagada' },
      vencida: { icon: XCircle, texto: 'Vencida' },
      anulada: { icon: Ban, texto: 'Anulada' }
    };

    const config = configs[estado] || configs.pendiente;
    const IconComponent = config.icon;

    return (
      <span className={`status-badge ${estado}`}>
        <IconComponent />
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
// HELPER FUNCTIONS PARA DETALLES
// ============================================================

// 🔥 Función para agrupar detalles por tipo
const agruparDetallesPorTipo = (detalles) => {
  if (!detalles || detalles.length === 0) return null;
  
  const grupos = {
    consumo: [],
    multas: [],
    servicios: [],
    otros: []
  };
  
  detalles.forEach(detalle => {
    const tipo = detalle.tipo_detalle?.toLowerCase() || 'otros';
    
    if (tipo === 'consumo') {
      grupos.consumo.push(detalle);
    } else if (tipo === 'multa') {
      grupos.multas.push(detalle);
    } else if (tipo === 'servicio') {
      grupos.servicios.push(detalle);
    } else {
      grupos.otros.push(detalle);
    }
  });
  
  return grupos;
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
                  const tieneFacturas = periodo.tiene_facturas;
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
                        {periodo.total_facturas} facturas
                      </div>

                      {/* Indicador de Cobrado */}
                      {tieneFacturas && (
                        <div className="periodo-progress-section">
                          <div className="periodo-progress-label">
                            <CheckCircle className="w-3 h-3 text-green-600" />
                            <span>Cobrado</span>
                            <span className="periodo-progress-value">
                              {getPorcentajeCobrado(periodo)}%
                            </span>
                          </div>
                          <div className="periodo-progress-bar">
                            <div
                              className="periodo-progress-fill cobrado"
                              style={{ width: `${getPorcentajeCobrado(periodo)}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Indicador de Pendiente */}
                      {tieneFacturas && (
                        <div className="periodo-progress-section">
                          <div className="periodo-progress-label">
                            <Clock className="w-3 h-3 text-yellow-600" />
                            <span>Pendiente</span>
                            <span className="periodo-progress-value">
                              {getPorcentajePendiente(periodo)}%
                            </span>
                          </div>
                          <div className="periodo-progress-bar">
                            <div
                              className="periodo-progress-fill pendiente"
                              style={{ width: `${getPorcentajePendiente(periodo)}%` }}
                            />
                          </div>
                        </div>
                      )}

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
              <div className="stat-item">
                <Ban className="stat-icon text-red-600" />
                <div>
                  <p className="stat-label">Anuladas</p>
                  <p className="stat-value">{stats.facturas_anuladas}</p>
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
          
          {/* SECCIÓN DE SERVICIOS MASIVOS */}
          <div className="filters-section">
            <div 
              className="filter-header" 
              onClick={() => setShowServicios(!showServicios)}
            >
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                <span>Aplicar Servicios a Todas las Facturas</span>
                {serviciosSeleccionados.length > 0 && (
                  <span className="badge badge-primary">
                    {serviciosSeleccionados.length} seleccionados
                  </span>
                )}
              </div>
              <ChevronDown 
                className={`w-4 h-4 transition-transform ${showServicios ? 'rotate-180' : ''}`} 
              />
            </div>
            
            {showServicios && (
              <div className="filter-content">
                {/* Lista de servicios disponibles */}
                <div className="bulk-services-list">

                  {serviciosDisponibles.length === 0 ? (
                    <div className="bulk-services-empty">

                      <Package className="w-8 h-8 text-gray-300 mb-2" />
                      <p className="text-sm text-gray-500">No hay servicios disponibles</p>
                    </div>
                  ) : (
                    serviciosDisponibles.map((servicio) => (
                      <label key={servicio.id_servicio} className="bulk-service-item">
                        <input
                          type="checkbox"
                          checked={serviciosSeleccionados.includes(servicio.id_servicio)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setServiciosSeleccionados([...serviciosSeleccionados, servicio.id_servicio]);
                            } else {
                              setServiciosSeleccionados(
                                serviciosSeleccionados.filter(id => id !== servicio.id_servicio)
                              );
                            }
                          }}
                        />
                        <div className="flex-1">
                          <span className="font-semibold">{servicio.nombre}</span>
                          <span className="text-sm text-gray-500 ml-2">
                            ${parseFloat(servicio.precio_base).toFixed(2)}
                          </span>
                        </div>
                      </label>
                    ))
                  )}
                </div>
                
                {/* Botón de aplicar */}
                {serviciosSeleccionados.length > 0 && (
                  <div className="mt-4">
                    <button
                      onClick={handleAplicarServiciosMasivo}
                      className="btn btn-primary w-full"
                      disabled={loading}
                    >
                      <Package className="w-4 h-4 mr-2" />
                      {loading 
                        ? 'Aplicando...' 
                        : `Aplicar ${serviciosSeleccionados.length} servicio(s) a todas las facturas pendientes`
                      }
                    </button>
                    
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      Se aplicarán solo a facturas pendientes o vencidas del período
                    </p>
                  </div>
                )}
              </div>
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
              <h3>Cargando facturas...</h3>
            </div>
          )}

          {/* LISTA DE FACTURAS */}
          {!loading && (
            <div className="invoices-list-container">
             {/* HEADER */}
              <div className="invoices-list-header">
                <span>#</span>
                <span><FileText className="w-4 h-4" /> Número</span>
                <span><Calendar className="w-4 h-4" /> Fecha</span>
                <span><IdCard  className="w-4 h-4" /> Código Afi</span>
                <span><User className="w-4 h-4" /> Usuario</span>
                <span><Gauge className="w-4 h-4" /> Consumo</span>
                <span><FileText className="w-4 h-4" /> Detalles</span>
                <span><DollarSign className="w-4 h-4" /> Total</span>
                <span>Estado</span>
                <span>Acciones</span>
              </div>


              {/* BODY */}
              <div className="invoices-list-body">
                {sortedFacturas.length > 0 ? (
                  sortedFacturas.map((factura, index) => (
                    <div 
                      key={factura.id_factura} 
                      className={`invoices-list-item ${factura.estado_factura === 'anulada' ? 'inv-anulada' : ''}`}
                    >
                      {/* Columna 1: # */}
                      <div className="inv-col-index">
                        <span className="inv-index-badge">{index + 1}</span>
                      </div>

                      {/* Columna 2: Número */}
                      <div className="inv-col-numero">
                        <div className="inv-numero-icon">
                          <FileText className="w-4 h-4" />
                        </div>
                        <span className="inv-numero-text">
                          {factura.num_factura}
                        </span>
                      </div>

                      {/* Columna 3: Fecha */}
                      <div className="inv-col-fecha">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDateShort(factura.fecha_emision)}</span>
                      </div>

                      {/* Columna 4: Código Afiliado */}
                      <div className="inv-col-codigo">
                        {factura.usuario_afiliado?.cod_usuario_afi ?? '—'}
                      </div>

                      {/* Columna 5: Usuario */}
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

                      {/* Columna 6: Consumo */}
                      <div className="inv-col-consumo">
                        <span className="inv-consumo-badge">{factura.consumo_m3 || 0} m³</span>
                      </div>

                      {/* Columna 7: Detalles */}
                      <div className="inv-col-detalles">
                        {factura.detalles && factura.detalles.length > 0 ? (
                          <div className="inv-detalles-container">
                            {(() => {
                              const grupos = agruparDetallesPorTipo(factura.detalles);
                              const totalDetalles = factura.detalles.length;
                              
                              return (
                                <>
                                  {grupos.consumo.length > 0 && (
                                    <span 
                                      className="inv-badge inv-badge-consumo" 
                                      title={grupos.consumo.map(d => d.descripcion).join('\n')}
                                    >
                                      💧 {grupos.consumo.length}
                                    </span>
                                  )}
                                  {grupos.multas.length > 0 && (
                                    <span 
                                      className="inv-badge inv-badge-multa" 
                                      title={grupos.multas.map(d => d.descripcion).join('\n')}
                                    >
                                      ⚠️ {grupos.multas.length}
                                    </span>
                                  )}
                                  {grupos.servicios.length > 0 && (
                                    <span 
                                      className="inv-badge inv-badge-servicio" 
                                      title={grupos.servicios.map(d => d.descripcion).join('\n')}
                                    >
                                      🔧 {grupos.servicios.length}
                                    </span>
                                  )}
                                  {grupos.otros.length > 0 && (
                                    <span 
                                      className="inv-badge inv-badge-otro" 
                                      title={grupos.otros.map(d => d.descripcion).join('\n')}
                                    >
                                      📄 {grupos.otros.length}
                                    </span>
                                  )}
                                  <span className="inv-detalles-count">
                                    ({totalDetalles})
                                  </span>
                                </>
                              );
                            })()}
                          </div>
                        ) : (
                          <span className="inv-sin-dato">Sin detalles</span>
                        )}
                      </div>

                      {/* Columna 8: Total */}
                      <div className="inv-col-total">
                        <span className="inv-monto">{formatCurrency(factura.total)}</span>
                      </div>

                      {/* Columna 9: Estado */}
                      <div className="inv-col-estado">
                        {getStatusBadge(factura.estado_factura)}
                      </div>

                      {/* Columna 10: Acciones */}
                      <div className="inv-col-acciones">
                        <button 
                          className="inv-btn inv-btn-view" 
                          onClick={() => openModal('view', factura)} 
                          title="Ver detalles"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {permissions.canUpdate && factura.estado_factura === 'pendiente' && (
                          <button
                            className="inv-btn inv-btn-edit"
                            onClick={() => openPaymentModal(factura)}
                            title="Procesar pago"
                          >
                            <DollarSign className="w-4 h-4" />
                          </button>
                        )}                   

                        {permissions.canDelete && ['pendiente', 'vencida'].includes(factura.estado_factura) && (
                          <button
                            className="inv-btn inv-btn-delete"
                            onClick={() => handleAnularFactura(factura.id_factura)}
                            title="Anular factura"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}

                        {/* Botón Agregar Servicios */}
                        {permissions.canUpdate && 
                        (factura.estado_factura === 'pendiente' || factura.estado_factura === 'vencida') && (
                          <button
                            onClick={() => openServiciosModal(factura)}
                            className="inv-btn inv-btn-service"
                            title="Agregar servicios"
                          >
                            <Package className="w-4 h-4"  />
                          </button>
                        )}

                      </div>
                    </div>
                  ))
                ) : (
                  <div className="invoices-list-empty">
                    <FileText className="inv-empty-icon" />
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
                      Total: <strong>{formatCurrency(sortedFacturas.reduce((sum, f) => sum + parseFloat(f.total || 0), 0))}</strong>
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

            
          
        </div>
      )}
      {/* MODAL DETALLE FACTURA */}
      {/* ==================== MODAL DETALLE FACTURA ==================== */}
      {showModal && modalType === 'view' && selectedFactura && (
        <div className="modal-overlay">
          <div className="modal modal-factura">
            <div className="modal-header">
              <h3>
                <FileText className="w-5 h-5 inline mr-2" />
                Detalle de Factura #{selectedFactura.num_factura}
              </h3>
              <button className="modal-close" onClick={closeModal}>
                <X className="w-5 h-5" />
              </button>
            </div>
          <div className="modal-body" >
          {/* SECCIÓN DE DATOS DEL CLIENTE */}
          <div className="factura-section">
            <h4 className="section-title">
              <User className="w-4 h-4" />
              Datos del Cliente
            </h4>
            <div className="user-details">
              <div className="detail-group">
                <label>Afiliado:</label>
                <p>
                  {selectedFactura.usuario_afiliado?.usuario_sistema?.nombres || 'N/A'}{' '}
                  {selectedFactura.usuario_afiliado?.usuario_sistema?.apellidos || ''}
                </p>
              </div>
              <div className="detail-group">
                <label>Código Afiliado:</label>
                <p className="font-mono">
                  {selectedFactura.usuario_afiliado?.cod_usuario_afi ?? 'N/A'}
                </p>
              </div>
              <div className="detail-group">
                <label>Número de Medidor:</label>
                <p className="font-mono">
                  {selectedFactura.usuario_afiliado?.medidores?.[0]?.num_medidor ?? 'N/A'}
                </p>
              </div>

              <div className="detail-group">
                <label>Cédula:</label>
                <p className="font-mono">
                  {selectedFactura.usuario_afiliado?.usuario_sistema?.cedula || 'N/A'}
                </p>
              </div>

              <div className="detail-group form-group-full">
                <label>Dirección:</label>
                <p>{selectedFactura.usuario_afiliado?.usuario_sistema?.direccion || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* SECCIÓN DE INFORMACIÓN DE LA FACTURA */}
          <div className="factura-section">
            <h4 className="section-title">
              <FileText className="w-4 h-4" />
              Información de la Factura
            </h4>
            <div className="user-details">
              <div className="detail-group">
                <label>N° Factura:</label>
                <p className="font-mono font-semibold text-blue-600">
                  {selectedFactura.num_factura}
                </p>
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
            </div>
          </div>

          {/* SECCIÓN DE CONSUMO */}
          <div className="factura-section">
            <h4 className="section-title">
              <Gauge className="w-4 h-4" />
              Detalles de Consumo
            </h4>
            <div className="user-details">
              <div className="detail-group">
                <label>Consumo (m³):</label>
                <p className="font-bold text-blue-600">{selectedFactura.consumo_m3 || 0} m³</p>
              </div>

              <div className="detail-group">
                <label>Exceso (m³):</label>
                <p className="font-bold text-orange-600">{selectedFactura.exceso_m3 || 0} m³</p>
              </div>

              <div className="detail-group">
                <label>Valor Consumo:</label>
                <p>{formatCurrency(selectedFactura.valor_consumo)}</p>
              </div>

              <div className="detail-group">
                <label>Valor Exceso:</label>
                <p>{formatCurrency(selectedFactura.valor_exceso)}</p>
              </div>
            </div>
          </div>

          {/* SECCIÓN DE CÁLCULO */}
          <div className="factura-section">
            <h4 className="section-title">
              <DollarSign className="w-4 h-4" />
              Resumen de Cobro
            </h4>
            <div className="user-details">
              <div className="detail-group">
                <label>Subtotal:</label>
                <p>{formatCurrency(selectedFactura.subtotal)}</p>
              </div>

              <div className="detail-group">
                <label>Descuento:</label>
                <p className="text-green-600 font-semibold">
                  -{formatCurrency(selectedFactura.descuento || 0)}
                </p>
              </div>

              <div className="detail-group">
                <label>Impuesto (IVA):</label>
                <p>{formatCurrency(selectedFactura.impuesto)}</p>
              </div>

              <div className="detail-group highlight-total">
                <label>Total a Pagar:</label>
                <p className="font-bold text-xl text-blue-600">
                  {formatCurrency(selectedFactura.total)}
                </p>
              </div>
            </div>
          </div>

          {/* DETALLES ADICIONALES */}
        {selectedFactura.detalles && selectedFactura.detalles.length > 0 && (
          <div className="factura-section">
            <h4 className="section-title">
              <FileText className="w-4 h-4" />
              Conceptos de Facturación ({selectedFactura.detalles.length})
            </h4>
            
            {(() => {
              const grupos = agruparDetallesPorTipo(selectedFactura.detalles);
              
              return (
                <div className="detalles-agrupados">
                  {/* CONSUMOS */}
                  {grupos.consumo.length > 0 && (
                    <div className="detalle-grupo">
                      <div className="detalle-grupo-header">
                        <span className="detalle-grupo-icon">💧</span>
                        <h5>Consumo de Agua ({grupos.consumo.length})</h5>
                      </div>
                      <div className="detalles-lista">
                        {grupos.consumo.map((detalle, idx) => (
                          <div key={idx} className="detalle-item">
                            <span className="detalle-desc">{detalle.descripcion}</span>
                            <span className="detalle-precio">
                              {formatCurrency(detalle.subtotal_detalle)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* MULTAS */}
                  {grupos.multas.length > 0 && (
                    <div className="detalle-grupo">
                      <div className="detalle-grupo-header multa">
                        <span className="detalle-grupo-icon">⚠️</span>
                        <h5>Multas ({grupos.multas.length})</h5>
                      </div>
                      <div className="detalles-lista">
                        {grupos.multas.map((detalle, idx) => (
                          <div key={idx} className="detalle-item">
                            <span className="detalle-desc">{detalle.descripcion}</span>
                            <span className="detalle-precio text-red-600">
                              {formatCurrency(detalle.subtotal_detalle)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SERVICIOS */}
                  {grupos.servicios.length > 0 && (
                    <div className="detalle-grupo">
                      <div className="detalle-grupo-header servicio">
                        <span className="detalle-grupo-icon">🔧</span>
                        <h5>Servicios Adicionales ({grupos.servicios.length})</h5>
                      </div>
                      <div className="detalles-lista">
                        {grupos.servicios.map((detalle, idx) => (
                          <div key={idx} className="detalle-item">
                            <span className="detalle-desc">{detalle.descripcion}</span>
                            <span className="detalle-precio">
                              {formatCurrency(detalle.subtotal_detalle)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* OTROS */}
                  {grupos.otros.length > 0 && (
                    <div className="detalle-grupo">
                      <div className="detalle-grupo-header">
                        <span className="detalle-grupo-icon">📄</span>
                        <h5>Otros Conceptos ({grupos.otros.length})</h5>
                      </div>
                      <div className="detalles-lista">
                        {grupos.otros.map((detalle, idx) => (
                          <div key={idx} className="detalle-item">
                            <span className="detalle-desc">{detalle.descripcion}</span>
                            <span className="detalle-precio">
                              {formatCurrency(detalle.subtotal_detalle)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
        </div>

    </div>
  </div>
      )}

      {/* MODAL DE PAGO CON DESCUENTO */}
      {showPaymentModal && paymentData.factura && (
        <div className="modal-overlay">
          <div className="modal modal-payment">
            <div className="modal-header">
              <h3>
                <DollarSign className="w-5 h-5 inline mr-2" />
                Procesar Pago - {paymentData.factura.num_factura}
              </h3>
              <button className="modal-close" onClick={closePaymentModal}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="modal-body">
              {/* INFORMACIÓN DEL CLIENTE */}
              <div className="payment-info-section">
                <div className="payment-client">
                 
                  <h4 className="discount-title">
                    <User className="w-4 h-4 text-blue-600" />
                     Detalles de usuario
                  </h4>
                    <div>
                      <p className="client-name">
                        <strong>Nombre Afiliado:</strong>{' '}
                        {paymentData.factura.usuario_afiliado?.usuario_sistema?.nombres}{' '}
                        {paymentData.factura.usuario_afiliado?.usuario_sistema?.apellidos}
                      </p>

                      <p className="client-code">
                        <strong>Código:</strong>{' '}
                        {paymentData.factura.usuario_afiliado?.cod_usuario_afi}
                      </p>
                    </div>

                </div>
              </div>

              {/* RESUMEN SIMPLE */}
              <div className="payment-summary">
                <div className="summary-row">
                  <span><strong>Total Factura:</strong></span>
                  <span className="amount">
                    {formatCurrency(paymentData.factura.total)}
                  </span>
                </div>
              </div>

              {/* SECCIÓN DE DESCUENTO */}
              <div className="discount-section">
                <h4 className="discount-title">
                  <Tag className="w-4 h-4 text-blue-600" />
                  Descuento (Opcional)
                </h4>

                <div className="discount-type-selector">
                  <label className="discount-option">
                    <input
                      type="radio"
                      name="descuentoTipo"
                      value="ninguno"
                      checked={paymentData.descuentoTipo === 'ninguno'}
                      onChange={(e) => setPaymentData({
                        ...paymentData,
                        descuentoTipo: e.target.value,
                        descuentoValor: 0
                      })}
                    />
                    <div className="option-content">
                      <X className="w-5 h-5" />
                      <span>Sin descuento</span>
                    </div>
                  </label>

                  <label className="discount-option">
                    <input
                      type="radio"
                      name="descuentoTipo"
                      value="porcentaje"
                      checked={paymentData.descuentoTipo === 'porcentaje'}
                      onChange={(e) => setPaymentData({
                        ...paymentData,
                        descuentoTipo: e.target.value,
                        descuentoValor: 0
                      })}
                    />
                    <div className="option-content">
                      <Percent className="w-5 h-5" />
                      <span>Porcentaje (%)</span>
                    </div>
                  </label>

                  <label className="discount-option">
                    <input
                      type="radio"
                      name="descuentoTipo"
                      value="valor"
                      checked={paymentData.descuentoTipo === 'valor'}
                      onChange={(e) => setPaymentData({
                        ...paymentData,
                        descuentoTipo: e.target.value,
                        descuentoValor: 0
                      })}
                    />
                    <div className="option-content">
                      <DollarSign className="w-5 h-5" />
                      <span>Valor Fijo ($)</span>
                    </div>
                  </label>
                </div>

                {paymentData.descuentoTipo !== 'ninguno' && (
                  <div className="discount-input-container">
                    <label>
                      {paymentData.descuentoTipo === 'porcentaje' 
                        ? 'Porcentaje de descuento:' 
                        : 'Monto del descuento:'}
                    </label>
                    <div className="discount-input-group">
                      <input
                        type="number"
                        min="0"
                        max={paymentData.descuentoTipo === 'porcentaje' ? 100 : paymentData.factura.subtotal}
                        step={paymentData.descuentoTipo === 'porcentaje' ? 1 : 0.01}
                        value={paymentData.descuentoValor}
                        onChange={(e) => setPaymentData({
                          ...paymentData,
                          descuentoValor: parseFloat(e.target.value) || 0
                        })}
                        className="discount-input"
                        placeholder={paymentData.descuentoTipo === 'porcentaje' ? '0-100' : '0.00'}
                      />
                      <span className="discount-suffix">
                        {paymentData.descuentoTipo === 'porcentaje' ? '%' : '$'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* VISTA PREVIA DEL CÁLCULO - ✅ LÓGICA CORRECTA */}
              {paymentData.descuentoTipo !== 'ninguno' && paymentData.descuentoValor > 0 && (() => {
                // 1️⃣ Subtotal SIN IVA (base imponible original)
                const subtotalOriginal = paymentData.factura.subtotal || 0;
                
                // 2️⃣ Calcular descuento sobre el subtotal
                const montoDescuento = paymentData.descuentoTipo === 'porcentaje'
                  ? subtotalOriginal * (paymentData.descuentoValor / 100)
                  : Math.min(paymentData.descuentoValor, subtotalOriginal); // No puede ser mayor al subtotal
                
                // 3️⃣ Subtotal CON descuento (nueva base imponible)
                const subtotalConDescuento = subtotalOriginal - montoDescuento;
                
                // 4️⃣ Calcular IVA sobre el subtotal CON descuento
                const porcentajeIVA = paymentData.factura.impuesto > 0 
                  ? (paymentData.factura.impuesto / paymentData.factura.subtotal) * 100
                  : 0;
                const nuevoIVA = subtotalConDescuento * (porcentajeIVA / 100);
                
                // 5️⃣ Total final
                const totalFinal = subtotalConDescuento + nuevoIVA;

                return (
                  <div className="payment-preview">
                    <h4 className="preview-title">📊 Vista Previa del Cálculo</h4>
                    <div className="preview-calculation">
                      <div className="preview-row">
                        <span>Subtotal original (sin IVA):</span>
                        <span>{formatCurrency(subtotalOriginal)}</span>
                      </div>
                      
                      <div className="preview-row highlight">
                        <span>
                          Descuento ({paymentData.descuentoTipo === 'porcentaje' 
                            ? `${paymentData.descuentoValor}%` 
                            : 'Fijo'}):
                        </span>
                        <span className="text-green-600">
                          -{formatCurrency(montoDescuento)}
                        </span>
                      </div>
                      
                      <div className="preview-row">
                        <span>Subtotal con descuento:</span>
                        <span>{formatCurrency(subtotalConDescuento)}</span>
                      </div>
                      
                      <div className="preview-row">
                        <span>IVA ({porcentajeIVA.toFixed(0)}% sobre ${formatCurrency(subtotalConDescuento)}):</span>
                        <span>{formatCurrency(nuevoIVA)}</span>
                      </div>
                      
                      <div className="preview-divider"></div>
                      
                      <div className="preview-row total">
                        <span><strong>Total a pagar:</strong></span>
                        <span className="total-amount">
                          {formatCurrency(totalFinal)}
                        </span>
                      </div>
                      
                      {/* Comparación con el total original */}
                      <div className="preview-comparison">
                        <div className="comparison-item">
                          <span className="label">Total original:</span>
                          <span className="value old">{formatCurrency(paymentData.factura.total)}</span>
                        </div>
                        <div className="comparison-item">
                          <span className="label">Ahorro:</span>
                          <span className="value savings">
                            {formatCurrency(paymentData.factura.total - totalFinal)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* NOTA INFORMATIVA */}
              <div className="payment-note">
                <AlertCircle className="w-4 h-4" />
                <p>
                  El descuento se aplica sobre el subtotal (sin IVA). 
                  Luego se calcula el IVA sobre el nuevo subtotal con descuento.
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={closePaymentModal}>
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </button>
              <button className="btn-primary" onClick={handleConfirmPayment}>
                <CheckCircle className="w-4 h-4 mr-2" />
                Confirmar Pago
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================
      MODAL: AGREGAR SERVICIOS A FACTURA
      ======================================== */}
      {showServiciosModal && facturaSeleccionadaServicios && (
        <div className="modal-overlay">
          <div className="modal modal-payment">
            <div className="modal-header">
              <h3>
                <Package  className="w-5 h-5 inline mr-2" />
                Agregar Servicios a Factura
              </h3>
              <button onClick={closeServiciosModal} className="modal-close">
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {/* Información de la factura */}
              <div className="payment-info-section">
                <div className="payment-client">

                  <h4 className="discount-title">
                    <FileText className="w-4 h-4 text-blue-600" />
                    Detalles de la factura
                  </h4>

                  <div>
                    <p className="client-name">
                      <strong>Factura:</strong>{' '}
                      {facturaSeleccionadaServicios.num_factura}
                    </p>

                    <p className="client-name">
                      <strong>Nombre Afiliado:</strong>{' '}
                      {facturaSeleccionadaServicios.usuario_afiliado?.usuario_sistema?.nombres}{' '}
                      {facturaSeleccionadaServicios.usuario_afiliado?.usuario_sistema?.apellidos}
                    </p>

                    <p className="client-code">
                      <strong>Total actual:</strong>{' '}
                      {formatCurrency(facturaSeleccionadaServicios.total)}
                    </p>
                  </div>

                </div>
              </div>

              {/* Lista de servicios disponibles */}
              <div className="servicios-selection">
                <h4>Selecciona los servicios a aplicar:</h4>
                
                {serviciosDisponibles.length === 0 ? (
                  <div className="empty-state">
                    <Package size={48} />
                    <p>No hay servicios disponibles</p>
                  </div>
                ) : (
                  <div className="servicios-grid">
                    {serviciosDisponibles.map(servicio => (
                      <div
                        key={servicio.id_servicio}
                        className={`servicio-card ${
                          serviciosSeleccionadosModal.includes(servicio.id_servicio) 
                            ? 'selected' 
                            : ''
                        }`}
                        onClick={() => toggleServicioSeleccion(servicio.id_servicio)}
                      >
                        <div className="servicio-header">
                          <div className="servicio-checkbox">
                            {serviciosSeleccionadosModal.includes(servicio.id_servicio) && (
                              <Check size={16} />
                            )}
                          </div>
                          <h4>{servicio.nombre}</h4>
                        </div>
                        
                        <p className="servicio-descripcion">
                          {servicio.descripcion || 'Sin descripción'}
                        </p>
                        
                        <div className="servicio-precio">
                          <Tag size={16} />
                          <span>{formatCurrency(servicio.precio_base)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Resumen de selección */}
              {serviciosSeleccionadosModal.length > 0 && (
                <div className="selection-summary">
                  <div className="summary-item">
                    <Package size={20} />
                    <span>Servicios seleccionados: <strong>{serviciosSeleccionadosModal.length}</strong></span>
                  </div>
                  <div className="summary-item">
                    <DollarSign size={20} />
                    <span>
                      Monto adicional: <strong>
                        {formatCurrency(
                          serviciosDisponibles
                            .filter(s => serviciosSeleccionadosModal.includes(s.id_servicio))
                            .reduce((sum, s) => sum + parseFloat(s.precio_base || 0), 0)
                        )}
                      </strong>
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                onClick={closeServiciosModal}
                className="btn btn-secondary"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                onClick={handleAplicarServiciosIndividual}
                className="btn btn-primary"
                disabled={loading || serviciosSeleccionadosModal.length === 0}
              >
                {loading ? 'Aplicando...' : `Aplicar ${serviciosSeleccionadosModal.length} Servicio(s)`}
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
};

export default InvoicesSection;