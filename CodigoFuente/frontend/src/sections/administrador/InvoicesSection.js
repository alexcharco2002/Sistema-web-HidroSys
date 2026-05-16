// src/sections/invoices/InvoicesSection.js
// MÓDULO DE FACTURAS - Con sistema de periodos mensuales

import React, { useState, useEffect, useMemo, useCallback } from 'react';

import './InvoicesSection.css'; // Reutilizar estilos de lecturas

import invoicesServices from '../../services/invoicesServices';
import authService from '../../services/authServices';

import {
  FileText,
  ClipboardList,
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
  CalendarDays, ChevronDown, ChevronLeft, ChevronRight,
  Gauge, User, IdCard  ,Tag, Percent, Package, Briefcase
} from 'lucide-react';

const InvoicesSection = () => {
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
  const [, setPeriodoActual] = useState(null);
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState(null);
  const [loadingPeriodos, setLoadingPeriodos] = useState(false);
  const [periodosInicializados, ] = useState(false);  

  // ============================================================
  // ESTADOS DE BÚSQUEDA Y FILTROS
  // ============================================================
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortOption, setSortOption] = useState('codigo');
  const [sortOrder, setSortOrder] = useState('desc');
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

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
  const [shouldScrollToDetails, setShouldScrollToDetails] = useState(false);

  // Ref para hacer scroll a la sección de detalles
  const detallesRef = React.useRef(null);

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
  const [showServiciosModal, setShowServiciosModal] = useState(false);
  const [facturaSeleccionadaServicios, setFacturaSeleccionadaServicios] = useState(null);
  const [serviciosSeleccionadosModal, setServiciosSeleccionadosModal] = useState([]);

  // ============================================================
  // ESTADOS  MANEJAR ANULACION DE MULTAS
  // ============================================================
  // Estados para modal de anulación
  const [anulacionData, setAnulacionData] = useState({
    motivo: '',
    motivoPersonalizado: ''
  });

  // Estado para controlar qué años están expandidos en la sección de periodos
   const [aniosExpandidos, setAniosExpandidos] = useState({});
      const toggleAnio = (anio) => {
        setAniosExpandidos(prev => ({ ...prev, [anio]: !prev[anio] }));
      };

  // Motivos predefinidos para anulación de facturas
  const motivosAnulacionFactura = [
    'Error en el cálculo del consumo',
    'Lectura de medidor incorrecta',
    'Factura duplicada',
    'Usuario solicita corrección',
    'Error en datos del afiliado',
    'Aplicación incorrecta de tarifa',
    'Problemas técnicos del sistema',
    'Otro (especificar)'
  ];



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
    if (periodosInicializados) return;

    setLoadingPeriodos(true);
    try {
      const result = await invoicesServices.getPeriodosDisponibles();
      if (result.success && result.data) {
        setPeriodos(result.data.periodos_disponibles || []);
        setPeriodoActual(result.data.periodo_actual || null);

        
      } else {
        setError(result.message || 'Error al cargar periodos disponibles');
      }
    } catch (err) {
      console.error('Error al cargar periodos disponibles:', err);
      setError('Error al cargar periodos disponibles');
    } finally {
      setLoadingPeriodos(false);
    }
  }, [periodosInicializados]);



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
  const getFacturaNombre = (factura) =>
    factura.nombre_completo ||
    factura.usuario_afiliado?.usuario_sistema?.nombre_completo ||
    '';

  const getFacturaCodigo = (factura) =>
    factura.cod_usuario_afi ??
    factura.usuario_afiliado?.cod_usuario_afi ??
    '';

  const getFacturaMedidor = (factura) =>
    factura.num_medidor ??
    factura.usuario_afiliado?.num_medidor ??
    '';

  const getFacturaCedula = (factura) =>
    factura.cedula ||
    factura.usuario_afiliado?.usuario_sistema?.cedula ||
    '';

  const filteredFacturas = facturas.filter(factura => {
    const searchLower = searchTerm.toLowerCase();
    
    // 🔥 Helper para convertir valores a string de forma segura
    const toString = (value) => {
      if (value === null || value === undefined) return '';
      return String(value).toLowerCase();
    };
    
    // Buscar en múltiples campos
    const matchesSearch = 
      // Número de factura
      toString(factura.num_factura).includes(searchLower) ||
      toString(factura.id_factura).includes(searchTerm) ||
      
      // 🔥 Código de afiliado (convertido a string)
      toString(getFacturaCodigo(factura)).includes(searchLower) ||
      
      // 🔥 Número de medidor
      toString(getFacturaMedidor(factura)).includes(searchLower) ||
      
      // 🔹 CAMBIO: Buscar en nombre completo
      toString(getFacturaNombre(factura)).includes(searchLower) ||
      
      // Cédula
      toString(getFacturaCedula(factura)).includes(searchTerm);
    
    const matchesStatus = filterStatus === 'all' || factura.estado_factura === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  // Función auxiliar para determinar prioridad de estado
  const getEstadoPrioridad = (estado) => {
    const prioridades = {
      'pendiente': 1,
      'vencida': 2,
      'pagada': 3,
      'anulada': 4
    };
    return prioridades[estado] || 5;
  };

  const sortedFacturas = useMemo(() => {
    return [...filteredFacturas].sort((a, b) => {
      let comparison = 0;

      // Primero ordenar por estado (pendiente → vencida → pagada → anulada)
      const estadoA = getEstadoPrioridad(a.estado_factura);
      const estadoB = getEstadoPrioridad(b.estado_factura);
      
      if (estadoA !== estadoB) {
        return estadoA - estadoB; // Siempre ascendente para estados
      }

      // Luego ordenar por el criterio seleccionado
      if (sortOption === 'fecha') {
        comparison = new Date(a.fecha_emision) - new Date(b.fecha_emision);
      } else if (sortOption === 'numero') {
        comparison = a.num_factura.localeCompare(b.num_factura);
      } else if (sortOption === 'total') {
        comparison = parseFloat(a.total) - parseFloat(b.total);
      } else if (sortOption === 'estado') {
        comparison = a.estado_factura.localeCompare(b.estado_factura);
      } else if (sortOption === 'codigo') {
        // Ordenar por código de afiliado - CONVERTIR A STRING
        const codigoA = String(getFacturaCodigo(a) || '');
        const codigoB = String(getFacturaCodigo(b) || '');
        comparison = codigoA.localeCompare(codigoB, undefined, { numeric: true });
      } else if (sortOption === 'medidor') {
        const medidorA = String(getFacturaMedidor(a) || '');
        const medidorB = String(getFacturaMedidor(b) || '');
        comparison = medidorA.localeCompare(medidorB, undefined, { numeric: true });
      } else if (sortOption === 'nombre') {
        comparison = getFacturaNombre(a).localeCompare(getFacturaNombre(b));
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredFacturas, sortOption, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(sortedFacturas.length / pageSize));
  const normalizedCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (normalizedCurrentPage - 1) * pageSize;
  const pageEndIndex = pageStartIndex + pageSize;
  const paginatedFacturas = sortedFacturas.slice(pageStartIndex, pageEndIndex);
  const showingFrom = sortedFacturas.length === 0 ? 0 : pageStartIndex + 1;
  const showingTo = Math.min(pageEndIndex, sortedFacturas.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, sortOption, sortOrder, pageSize, periodoSeleccionado]);

  const toggleSortOrder = () => {
    setSortOrder(prevOrder => prevOrder === 'asc' ? 'desc' : 'asc');
  };


 // ============================================================
  // FUNCIONES DE MODAL
  // ============================================================
  const openModal = async (type, factura = null, scrollDetails = false) => {
    if (type === 'view' && !factura) return;
    
    if (type === 'edit' && !permissions.canUpdate) {
      alert('❌ No tienes permiso para editar facturas');
      return;
    }

    setModalType(type);
    setError(null);
    setSelectedFactura(factura);
    setShouldScrollToDetails(scrollDetails);
    setShowModal(true);
    
  };

  // Efecto para hacer scroll a los detalles cuando se abre el modal
  useEffect(() => {
    if (showModal && modalType === 'view' && shouldScrollToDetails && detallesRef.current) {
      // Un pequeño delay para asegurar que el modal se haya renderizado
      const timer = setTimeout(() => {
        detallesRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setShouldScrollToDetails(false); // Resetear el estado
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [showModal, modalType, shouldScrollToDetails]);

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
  // FUNCIONES DE ACCIONES facturas 
  // ============================================================

 const handleAnularFactura = (factura) => {
  if (!permissions.canDelete) {
    alert('❌ No tienes permiso para anular facturas');
    return;
  }
  
  // Abrir modal con la factura seleccionada
  setSelectedFactura(factura);
  setModalType('anular');
  setAnulacionData({ motivo: '', motivoPersonalizado: '' });
};

const handleConfirmarAnulacion = async (e) => {
  e.preventDefault();
  
  if (!selectedFactura) return;
  
  // Determinar el motivo final
  let motivoFinal = anulacionData.motivo;
  if (anulacionData.motivo === 'Otro (especificar)') {
    motivoFinal = anulacionData.motivoPersonalizado;
  } else if (anulacionData.motivoPersonalizado.trim()) {
    // Si hay observaciones adicionales, agregarlas
    motivoFinal = `${anulacionData.motivo} - ${anulacionData.motivoPersonalizado}`;
  }

  setLoading(true);
  try {
    const result = await invoicesServices.anularFactura(
      selectedFactura.id_factura, 
      motivoFinal
    );
    
    if (result.success) {
      alert('✅ Factura anulada correctamente');
      closeModal();
      await fetchFacturasByPeriodo();
      await fetchStats();
      // Resetear datos
      setAnulacionData({ motivo: '', motivoPersonalizado: '' });
    } else {
      alert(`❌ Error: ${result.message}`);
    }
  } catch (error) {
    console.error('Error al anular factura:', error);
    alert('❌ Error al anular factura');
  } finally {
    setLoading(false);
  }
};
  
  // ============================================================
  // FUNCIONES DE servicios 
  // ============================================================

  const handleAplicarServiciosIndividual = async () => {
    if (serviciosSeleccionadosModal.length === 0) {
      alert('⚠️ Selecciona al menos un servicio');
      return;
    }
    
    if (!facturaSeleccionadaServicios) return;
    
    // ✅ VALIDACIÓN: Verificar servicios ya aplicados
    const serviciosYaAplicados = [];
    const serviciosAAplicar = [];
    
    const detallesFactura = facturaSeleccionadaServicios.detalles || [];
    
    serviciosSeleccionadosModal.forEach(idServicio => {
      // Buscar si el servicio ya está en los detalles
      const servicioEnFactura = detallesFactura.find(detalle => 
        detalle.tipo_detalle?.toLowerCase() === 'servicio' && 
        detalle.id_servicio === idServicio
      );
      
      if (servicioEnFactura) {
        // Servicio ya aplicado
        const nombreServicio = serviciosDisponibles.find(s => s.id_servicio === idServicio)?.nombre || `ID: ${idServicio}`;
        serviciosYaAplicados.push(nombreServicio);
      } else {
        // Servicio no aplicado, se puede agregar
        serviciosAAplicar.push(idServicio);
      }
    });
    
    // Si todos los servicios ya están aplicados
    if (serviciosAAplicar.length === 0) {
      alert(`❌ Todos los servicios seleccionados ya están aplicados en esta factura:\n\n${serviciosYaAplicados.join('\n')}`);
      return;
    }
    
    // Construir mensaje de confirmación
    let mensaje = `¿Agregar ${serviciosAAplicar.length} servicio(s) a la factura ${facturaSeleccionadaServicios.num_factura}?`;
    
    if (serviciosYaAplicados.length > 0) {
      mensaje = `⚠️ ${serviciosYaAplicados.length} servicio(s) ya están aplicados y serán omitidos:\n${serviciosYaAplicados.join(', ')}\n\n` + mensaje;
    }
    
    const confirmado = window.confirm(mensaje);
    
    if (!confirmado) return;
    
    setLoading(true);
    try {
      // Enviar solo los servicios que no están aplicados
      const result = await invoicesServices.aplicarServiciosIndividual(
        facturaSeleccionadaServicios.id_factura,
        serviciosAAplicar
      );
      
      if (result.success) {
        let resultadoMensaje = `✅ ${result.message}\n\nNuevo total: $${result.data.factura.total.toFixed(2)}`;
        
        if (serviciosYaAplicados.length > 0) {
          resultadoMensaje += `\n\n⚠️ Servicios omitidos (ya aplicados): ${serviciosYaAplicados.length}`;
        }
        
        alert(resultadoMensaje);
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


  // funcion para aplicar servicos masivo
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
    
    // ✅ VALIDACIÓN: Analizar facturas que ya tienen servicios
    const facturasPendientesYVencidas = facturas.filter(
      f => f.estado_factura === 'pendiente' || f.estado_factura === 'vencida'
    );
    
    let facturasConServiciosYaAplicados = 0;
    
    facturasPendientesYVencidas.forEach(factura => {
      const detallesFactura = factura.detalles || [];
      
      // Verificar si la factura ya tiene alguno de los servicios seleccionados
      const tieneAlgunServicio = serviciosSeleccionados.some(idServicio => 
        detallesFactura.some(detalle => 
          detalle.tipo_detalle?.toLowerCase() === 'servicio' && 
          detalle.id_servicio === idServicio
        )
      );
      
      if (tieneAlgunServicio) {
        facturasConServiciosYaAplicados++;
      }
    });
    
    // Construir mensaje de confirmación
    let mensaje = `¿Aplicar ${serviciosSeleccionados.length} servicio(s) a TODAS las facturas pendientes del periodo de consumo ${formatearPeriodo(periodoSeleccionado.mes, periodoSeleccionado.anio)}?\n\n`;
    mensaje += `📋 Total facturas pendientes/vencidas: ${facturasPendientesYVencidas.length}\n`;
    
    if (facturasConServiciosYaAplicados > 0) {
      mensaje += `\n⚠️ NOTA: ${facturasConServiciosYaAplicados} factura(s) ya tienen algunos de estos servicios.\n`;
      mensaje += `El sistema evitará duplicar servicios.\n`;
    }
    
    const confirmado = window.confirm(mensaje);
    
    if (!confirmado) return;
    
    setLoading(true);
    try {
      const data = {
        id_servicios: serviciosSeleccionados,
        periodo: periodoStr,
        validar_duplicados: true // ✅ Flag para backend
      };
      
      console.log('📤 Enviando:', data);
      
      const result = await invoicesServices.aplicarServiciosMasivo(data);
      
      if (result.success) {
        let mensaje = `✅ Servicios aplicados correctamente\n\n`;
        mensaje += `Facturas afectadas: ${result.facturas_afectadas}\n`;
        mensaje += `Detalles creados: ${result.detalles_creados}`;
        
        if (result.facturas_omitidas && result.facturas_omitidas > 0) {
          mensaje += `\n\n⚠️ Facturas omitidas (servicios ya aplicados): ${result.facturas_omitidas}`;
        }
        
        alert(mensaje);
        
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

  // funcion para aplicar descuento 
  const handleAplicarDescuento = async () => {
    if (!paymentData.factura) return;

    // Validación: debe haber un tipo de descuento
    if (paymentData.descuentoTipo === 'ninguno') {
      alert('⚠️ Selecciona un tipo de descuento');
      return;
    }

    // Validación: si hay descuento, debe tener valor
    if (paymentData.descuentoValor <= 0) {
      alert('⚠️ Debes ingresar un valor de descuento mayor a 0');
      return;
    }

    // Validación: porcentaje no puede ser mayor a 100
    if (paymentData.descuentoTipo === 'porcentaje' && paymentData.descuentoValor > 100) {
      alert('⚠️ El porcentaje de descuento no puede ser mayor a 100%');
      return;
    }

    // Confirmación
    let mensajeConfirmacion = `¿Aplicar descuento a la factura ${paymentData.factura.num_factura}?`;
    
    if (paymentData.descuentoTipo === 'porcentaje') {
      mensajeConfirmacion += `\n\n💰 Descuento: ${paymentData.descuentoValor}%`;
      const montoDescuento = (paymentData.factura.total * paymentData.descuentoValor) / 100;
      mensajeConfirmacion += `\n💵 Monto: $${montoDescuento.toFixed(2)}`;
    } else if (paymentData.descuentoTipo === 'valor') {
      mensajeConfirmacion += `\n\n💰 Descuento: $${paymentData.descuentoValor.toFixed(2)}`;
    }

    const nuevoTotal = paymentData.descuentoTipo === 'porcentaje' 
      ? paymentData.factura.total - ((paymentData.factura.total * paymentData.descuentoValor) / 100)
      : paymentData.factura.total - paymentData.descuentoValor;

    mensajeConfirmacion += `\n\n📊 Total actual: $${paymentData.factura.total.toFixed(2)}`;
    mensajeConfirmacion += `\n✨ Nuevo total: $${nuevoTotal.toFixed(2)}`;

    const confirmado = window.confirm(mensajeConfirmacion);
    if (!confirmado) return;

    setLoading(true);

    try {
      const descuentoData = {
        tipo_descuento: paymentData.descuentoTipo,
        valor_descuento: paymentData.descuentoValor,
        marcar_como_pagada: false  // ❌ NO marcar como pagada
      };

      console.log('📤 Aplicando descuento:', descuentoData);

      const result = await invoicesServices.aplicarDescuento(
        paymentData.factura.id_factura,
        descuentoData
      );

      if (result.success) {
        const nuevoTotal = result.data?.factura?.total || 0;
        const descuentoAplicado = result.data?.factura?.descuento_aplicado || 0;
        
        let mensaje = `✅ Descuento aplicado exitosamente`;
        mensaje += `\n\n💰 Descuento: $${descuentoAplicado.toFixed(2)}`;
        mensaje += `\n💵 Nuevo total: $${nuevoTotal.toFixed(2)}`;
        mensaje += `\n\n⚠️ La factura permanece PENDIENTE`;
        
        alert(mensaje);
        
        // Cerrar modal y recargar datos
        closePaymentModal();
        await fetchFacturasByPeriodo();
        await fetchStats();
        
      } else {
        setError(result.message || 'Error al aplicar descuento');
        alert(`❌ ${result.message || 'Error al aplicar descuento'}`);
      }

    } catch (error) {
      console.error('❌ Error al aplicar descuento:', error);
      setError('Error al aplicar descuento');
      alert('❌ Error al aplicar descuento. Intenta nuevamente.');
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

    const safeDate = dateString.includes('T')
      ? new Date(dateString)
      : new Date(dateString + 'T00:00:00');

    return safeDate.toLocaleDateString('es-EC', {
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

// Función para agrupar detalles por tipo
const agruparDetallesPorTipo = (detalles) => {
  if (!detalles || detalles.length === 0) return null;
  
  const grupos = {
    consumo: [],
    exceso: [],
    multas: [],
    servicios: [],
    otros: []
  };
  
  detalles.forEach(detalle => {
    const tipo = detalle.tipo_detalle?.toLowerCase() || 'otros';
    
    const descripcion = detalle.descripcion?.toLowerCase() || '';

    if (tipo === 'consumo' && descripcion.includes('exceso')) {
      grupos.exceso.push(detalle);
    } else if (tipo === 'consumo') {
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
          <ClipboardList className="w-7 h-7 text-blue-600" />
          <div>
            <h2>Gestión de Facturas</h2>
            <p className="section-subtitle">
              Gestiona la información de las facturas
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
                  
                  // Cálculos para la barra de progreso
                  const totalFacturas = periodo.total_facturas || 0;
                  const pagadas = periodo.total_pagadas || 0;
                  const pctCobrado = totalFacturas > 0 ? (pagadas / totalFacturas) * 100 : 0;
                  const todoCobrado = pctCobrado >= 100;
                  const pendientesTotal = (periodo.total_pendientes ?? 0) + (periodo.total_vencidas ?? 0);

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
                          {pagadas} / {totalFacturas} facturas pagadas
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
                      </div>

                      {/* ACCIÓN */}
                      <div className="periodo-card-action">
                        <span>
                          {!tieneFacturas
                            ? 'Periodo vacío'
                            : pendientesTotal === 0
                              ? 'Ver facturas ✓'
                              : 'Gestionar facturas'}
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
                  Períodos anteriores con facturas registradas
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
                const tieneFacturas = periodo.tiene_facturas ?? (periodo.total_facturas > 0);
                return diff < -2 && tieneFacturas;
              });
          
              if (periodosHistorial.length === 0) {
                return (
                  <div className="periodo-historial-empty">
                    <AlertCircle className="w-12 h-12 text-gray-300 mb-2" />
                    <p>No hay períodos anteriores con facturas registradas</p>
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
                            {mesesDelAnio.map(periodo => {
                              const pct = periodo.total_facturas > 0 
                                ? Math.round((periodo.total_pagadas / periodo.total_facturas) * 100) 
                                : 0;
                              return (
                                <button
                                  key={`${periodo.mes}-${periodo.anio}`}
                                  className="historial-mes-chip completo"
                                  onClick={() => handlePeriodoChange(periodo.mes, periodo.anio)}
                                  title={`${pct}% recaudado (${periodo.total_facturas} facturas)`}
                                >
                                  <span className="historial-mes-dot completo" />
                                  <span className="historial-mes-nombre">
                                    {nombresMeses[periodo.mes]}
                                  </span>
                                  <span className="historial-mes-pct">
                                    {pct}%
                                  </span>
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
                    Gestiona las facturas de este periodo de consumo
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ESTADÍSTICAS DEL PERIODO */}
          <div className="periodo-stats-container">
            <div className="periodo-stats-header">
              <TrendingUp className="w-5 h-5 text-blue-600 mr-2" />
              <h3>Resumen del Periodo de Consumo</h3>
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
                placeholder="Buscar por factura, medidor, codigo, afiliado o cedula..."
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
                <option value="fecha">Ordenar por Fecha de emision</option>
                <option value="numero">Ordenar por Número</option>
                <option value="codigo">Ordenar por Codigo afiliado</option>
                <option value="medidor">Ordenar por Medidor</option>
                <option value="nombre">Ordenar por Nombre afiliado</option>
                <option value="total">Ordenar por Monto</option>
                <option value="estado">Ordenar por Estado</option>
              </select>

              <select
                className="filter-select page-size-select"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                title="Facturas por página"
              >
                {pageSizeOptions.map(size => (
                  <option key={size} value={size}>
                    {size} por página
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
                  fetchFacturasByPeriodo();
                  fetchStats();
                }} 
                title="Recargar"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          {/* SECCIÓN DE SERVICIOS MASIVOS CON TOGGLE */}
          {facturas.length > 100 && (
            <div className="invoices-search-advice">
              <AlertCircle className="w-4 h-4" />
              <span>
                Hay {facturas.length} facturas cargadas en este período. Para listas grandes, busca por factura, medidor, código, afiliado o cédula y usa los filtros para encontrar el registro más rápido.
              </span>
            </div>
          )}

          <div className="invoices-list-summary">
            <span>
              Mostrando {showingFrom}-{showingTo} de {sortedFacturas.length} factura{sortedFacturas.length !== 1 ? 's' : ''}
            </span>
            {(searchTerm.trim() || filterStatus !== 'all') && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => {
                  setSearchTerm('');
                  setFilterStatus('all');
                }}
              >
                Limpiar búsqueda
              </button>
            )}
          </div>

          {permissions.canUpdate && (
            <div className="services-bulk-section">
              <div className="services-toggle-header">
                <div className="toggle-left flex flex-col">
                  <div className="toggle-left flex flex-col items-start">
                    
                    {/* Línea del título */}
                    <div className="flex items-center gap-2">
                      <Package className="w-5 h-5 text-indigo-600" />
                      <span className="toggle-title font-semibold">
                        Servicios Masivos -
                      </span>

                      {serviciosSeleccionados.length > 0 && (
                        <span className="counter-badge animate-pop">
                          {serviciosSeleccionados.length}
                        </span>
                      )}
                      {/* Descripción alineada con el texto (no con el ícono) */}
                      <p className="text-sm text-gray-500 ml-7 mt-1">
                        Selecciona múltiples servicios para aplicar acciones de forma rápida.
                      </p>
                    </div>

                  </div>
                </div>
                
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={showServicios}
                    onChange={(e) => setShowServicios(e.target.checked)}
                    disabled={loading}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              {/* CONTENIDO EXPANDIBLE */}
              {showServicios && (
                <div className="services-content">
                  {serviciosDisponibles.length === 0 ? (
                    <div className="services-empty">
                      <Package className="w-12 h-12 text-gray-300" />
                      <p className="text-gray-500">No hay servicios disponibles</p>
                    </div>
                  ) : (
                    <>
                      {/* PILLS DE SERVICIOS */}
                      <div className="services-pills-container">
                        {serviciosDisponibles.map((servicio) => (
                          <button
                            key={servicio.id_servicio}
                            className={`service-pill ${
                              serviciosSeleccionados.includes(servicio.id_servicio) ? 'active' : ''
                            }`}
                            onClick={() => {
                              if (loading) return; // Prevenir cambios durante carga
                              
                              if (serviciosSeleccionados.includes(servicio.id_servicio)) {
                                setServiciosSeleccionados(
                                  serviciosSeleccionados.filter(id => id !== servicio.id_servicio)
                                );
                              } else {
                                setServiciosSeleccionados([...serviciosSeleccionados, servicio.id_servicio]);
                              }
                            }}
                            disabled={loading}
                          >
                            <span className="pill-name">{servicio.nombre}</span>
                            <span className="pill-price">${parseFloat(servicio.precio_base).toFixed(2)}</span>
                            {serviciosSeleccionados.includes(servicio.id_servicio) && (
                              <span className="pill-check">✓</span>
                            )}
                          </button>
                        ))}
                      </div>

                      {/* BARRA DE ACCIONES */}
                      {serviciosSeleccionados.length > 0 && (
                        <div className="services-action-bar">
                          <div className="action-info">
                            <span className="action-text">
                              <strong>{serviciosSeleccionados.length}</strong> servicio{serviciosSeleccionados.length !== 1 ? 's' : ''} seleccionado{serviciosSeleccionados.length !== 1 ? 's' : ''}
                            </span>
                            {periodoSeleccionado && (
                              <span className="period-badge">
                                📅 {formatearPeriodo(periodoSeleccionado.mes, periodoSeleccionado.anio)}
                              </span>
                            )}
                          </div>
                          <div className="action-buttons">
                            <button
                              className="btn-clear"
                              onClick={() => setServiciosSeleccionados([])}
                              disabled={loading}
                            >
                              Limpiar
                            </button>
                            <button
                              className="btn-apply"
                              onClick={handleAplicarServiciosMasivo}
                              disabled={loading}
                            >
                              {loading ? (
                                <>
                                  <span className="spinner"></span>
                                  <span>Aplicando...</span>
                                </>
                              ) : (
                                <>
                                  <span>Aplicar a Todas</span>
                                  <span className="arrow">→</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}


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
                <span><Calendar className="w-4 h-4" /> F Emisión</span>
                <span><Gauge className="w-4 h-4" /> Medidor</span>
                <span><IdCard  className="w-4 h-4" /> Código Afi</span>
                <span><User className="w-4 h-4" /> Nombre Afi</span>
                <span><Gauge className="w-4 h-4" /> Consumo</span>
                <span><FileText className="w-4 h-4" /> Detalles</span>
                <span><DollarSign className="w-4 h-4" /> Total</span>
                <span>Estado</span>
                <span>Acciones</span>
              </div>


              {/* BODY */}
              <div className="invoices-list-body">
                {sortedFacturas.length > 0 ? (
                  paginatedFacturas.map((factura, index) => (
                    <div
                        key={factura.id_factura}
                        className={`invoices-list-item ${factura.estado_factura === 'anulada' ? 'inv-anulada' : ''}`}
                      >
                        {/* Columna 1: # */}
                        <div className="inv-col-index">
                          <span className="inv-index-badge">{pageStartIndex + index + 1}</span>
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

                        {/* Columna 3: Fecha de emisión */}
                        <div className="inv-col-fecha">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDateShort(factura.fecha_emision)}</span>
                        </div>

                        {/* Columna 4: Medidor ✅ acceso directo */}
                        <div className="inv-col-codigo">
                          {factura.num_medidor ?? '—'}
                        </div>

                        {/* Columna 5: Código Afiliado ✅ acceso directo */}
                        <div className="inv-col-codigo">
                          {factura.cod_usuario_afi ?? '—'}
                        </div>

                        {/* Columna 6: Nombre ✅ acceso directo */}
                        <div className="inv-col-usuario">
                          {factura.nombre_completo ? (
                            <div className="inv-usuario-info">
                              <span className="inv-usuario-nombre">
                                {factura.nombre_completo}
                              </span>
                            </div>
                          ) : (
                            <span className="inv-sin-dato">-</span>
                          )}
                        </div>

                        {/* Columna 7: Consumo */}
                        <div className="inv-col-consumo">
                          <span className={`inv-consumo-badge ${parseFloat(factura.exceso_m3 || 0) > 0 ? 'has-exceso' : ''}`}>
                            {factura.consumo_m3 || 0} m³
                          </span>
                        </div>

                      {/* Columna 8: Detalles — sin cambios en lógica */}
                        <div className="inv-col-detalles">
                          {factura.detalles && factura.detalles.length > 0 ? (
                            <div className="inv-detalles-container">
                              {(() => {
                                const grupos = agruparDetallesPorTipo(factura.detalles);
                                const totalDetalles = factura.detalles.length;

                                return (
                                  <>
                                    {grupos.consumo.length > 0 && (
                                      <button
                                        type="button"
                                        className="inv-badge inv-badge-consumo"
                                        title={grupos.consumo.map(d => d.descripcion).join('\n')}
                                        onClick={() => openModal('view', factura, true)}
                                      >
                                        💧 {grupos.consumo.length}
                                      </button>
                                    )}
                                    {grupos.exceso.length > 0 && (
                                      <button
                                        type="button"
                                        className="inv-badge inv-badge-exceso"
                                        title={grupos.exceso.map(d => d.descripcion).join('\n')}
                                        onClick={() => openModal('view', factura, true)}
                                      >
                                        Exceso {grupos.exceso.length}
                                      </button>
                                    )}
                                    {grupos.multas.length > 0 && (
                                      <button
                                        type="button"
                                        className="inv-badge inv-badge-multa"
                                        title={grupos.multas.map(d => d.descripcion).join('\n')}
                                        onClick={() => openModal('view', factura, true)}
                                      >
                                        ⚠️ {grupos.multas.length}
                                      </button>
                                    )}
                                    {grupos.servicios.length > 0 && (
                                      <button
                                        type="button"
                                        className="inv-badge inv-badge-servicio"
                                        title={grupos.servicios.map(d => d.descripcion).join('\n')}
                                        onClick={() => openModal('view', factura, true)}
                                      >
                                        🔧 {grupos.servicios.length}
                                      </button>
                                    )}
                                    {grupos.otros.length > 0 && (
                                      <button
                                        type="button"
                                        className="inv-badge inv-badge-otro"
                                        title={grupos.otros.map(d => d.descripcion).join('\n')}
                                        onClick={() => openModal('view', factura, true)}
                                      >
                                        📄 {grupos.otros.length}
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      className="inv-detalles-count"
                                      onClick={() => openModal('view', factura, true)}
                                      title="Ver detalle completo"
                                    >
                                      ({totalDetalles})
                                    </button>
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
                            title="Aplicar descuento"
                          >
                            <Percent className="w-4 h-4" />
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
                            <Briefcase className="w-4 h-4"  />
                          </button>
                        )}

                        {permissions.canDelete && ['pendiente', 'vencida'].includes(factura.estado_factura) && (
                          <button
                            className="inv-btn inv-btn-delete"
                            onClick={() => handleAnularFactura(factura)}
                            title="Anular factura"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}

                        

                      </div>
                    </div>
                  ))
                ) : (
                  <div className="invoices-list-empty">
                    <FileText className="inv-empty-icon" />
                    <h3>No hay facturas en este periodo de consumo</h3>
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
                      Mostrando <strong>{showingFrom}-{showingTo}</strong> de <strong>{sortedFacturas.length}</strong> facturas
                    </span>
                    <span>
                      Total: <strong>{formatCurrency(sortedFacturas.reduce((sum, f) => sum + parseFloat(f.total || 0), 0))}</strong>
                    </span>
                  </div>
                </div>
              )}

              {sortedFacturas.length > 0 && (
                <div className="invoices-pagination-controls">
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
      {/* MODAL DETALLE FACTURA */}
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

            <div className="modal-body">

              {/* SECCIÓN DE DATOS DEL CLIENTE */}
              <div className="factura-section">
                <h4 className="section-title">
                  <User className="w-4 h-4" />
                  Datos del Cliente
                </h4>
                <br />
                <div className="user-details">

                  <div className="detail-group">
                    <label>Afiliado:</label>
                    <p>{selectedFactura.nombre_completo || 'N/A'}</p>
                  </div>

                  <div className="detail-group">
                    <label>Código Afiliado:</label>
                    <p className="font-mono">{selectedFactura.cod_usuario_afi ?? 'N/A'}</p>
                  </div>

                  <div className="detail-group">
                    <label>Número de Medidor:</label>
                    <p className="font-mono">{selectedFactura.num_medidor ?? 'N/A'}</p>
                  </div>

                  <div className="detail-group">
                    <label>Cédula:</label>
                    <p className="font-mono">{selectedFactura.cedula || 'N/A'}</p>
                  </div>

                  <div className="detail-group">
                    <label>Sector:</label>
                    <p>{selectedFactura.nombre_sector || 'N/A'}</p>
                  </div>

                  <div className="detail-group form-group-full">
                    <label>Dirección:</label>
                    <p>{selectedFactura.direccion || 'N/A'}</p>
                  </div>

                </div>
              </div>
              <br />

              {/* SECCIÓN DE INFORMACIÓN DE LA FACTURA */}
              <div className="factura-section">
                <h4 className="section-title">
                  <FileText className="w-4 h-4" />
                  Información de la Factura
                </h4>
                <br />
                <div className="user-details">

                  <div className="detail-group">
                    <label>N° Factura:</label>
                    <p className="font-mono font-semibold text-blue-600">
                      {selectedFactura.num_factura}
                    </p>
                  </div>

                  <div className="detail-group">
                    <label>Periodo de consumo:</label>
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
                <br />
                <h4 className="section-title">
                  <Gauge className="w-4 h-4" />
                  Detalles de Consumo
                </h4>
                <br />
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
                <br />
                <h4 className="section-title">
                  <DollarSign className="w-4 h-4" />
                  Resumen de Cobro
                </h4>
                <br />
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
                <div className="factura-section" ref={detallesRef}>
                  <br />
                  <h4 className="section-title">
                    <FileText className="w-4 h-4" />
                    Conceptos de Facturación ({selectedFactura.detalles.length})
                  </h4>
                  <br />
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
                                  <span className="detalle-precio">{formatCurrency(detalle.subtotal_detalle)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* EXCESO DE CONSUMO */}
                        {grupos.exceso.length > 0 && (
                          <div className="detalle-grupo detalle-grupo-exceso">
                            <div className="detalle-grupo-header exceso">
                              <TrendingUp className="w-4 h-4" />
                              <h5>Exceso de Consumo ({grupos.exceso.length})</h5>
                            </div>
                            <div className="detalles-lista">
                              {grupos.exceso.map((detalle, idx) => (
                                <div key={idx} className="detalle-item detalle-item-exceso">
                                  <span className="detalle-desc">{detalle.descripcion}</span>
                                  <span className="detalle-precio text-orange-600">{formatCurrency(detalle.subtotal_detalle)}</span>
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
                                  <span className="detalle-precio text-red-600">{formatCurrency(detalle.subtotal_detalle)}</span>
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
                                  <span className="detalle-precio">{formatCurrency(detalle.subtotal_detalle)}</span>
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
                                  <span className="detalle-precio">{formatCurrency(detalle.subtotal_detalle)}</span>
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
                        {getFacturaNombre(paymentData.factura) || 'N/A'}
                      </p>

                      <p className="client-code">
                        <strong>Código:</strong>{' '}
                        {getFacturaCodigo(paymentData.factura) || 'N/A'}
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
                <br />
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
              {/* Botón para aplicar descuento solamente */}
              {paymentData.descuentoTipo !== 'ninguno' && paymentData.descuentoValor > 0 && (
                <button 
                  className="btn-primary" 
                  onClick={handleAplicarDescuento}
                  disabled={loading}
                >
                  <Tag className="w-4 h-4 mr-2" />
                  {loading ? 'Aplicando...' : 'Aplicar Descuento'}
                </button>
              )}
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
                  <div className='servicios-header'> 
                    <h4 >
                    <FileText className="w-4 h-4 text-blue-600" />
                   {" "} Detalles de la factura
                    </h4>

                  </div>
                  <br />   
                  <div>
                    <p className="client-name">
                      <strong>Factura:</strong>{' '}
                      {facturaSeleccionadaServicios.num_factura}
                    </p>

                    <p className="client-name">
                      <strong>Nombre Afiliado:</strong>{' '}
                      {getFacturaNombre(facturaSeleccionadaServicios) || 'N/A'}
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
              <div className="servicios-header">
                <br />
                <h4>
                  <Briefcase className="w-4 h-4 text-blue-600" />
                  {" "}Selecciona los servicios a aplicar</h4>
              </div>
                <br />
            
              {serviciosDisponibles.length === 0 ? (
                <div className="empty-state-modal">
                  <Briefcase size={48} className="empty-icon" />
                  <p>No hay servicios disponibles</p>
                </div>
              ) : (
                <>
                  {/* PILLS DE SERVICIOS */}
                  <div className="services-pills-container">
                  {serviciosDisponibles.map((servicio) => (
                    <button
                      key={servicio.id_servicio}
                      className={`service-pill ${
                        serviciosSeleccionadosModal.includes(servicio.id_servicio)
                          ? 'active'
                          : ''
                      }`}
                      onClick={() => toggleServicioSeleccion(servicio.id_servicio)}
                    >
                      <span className="pill-name">{servicio.nombre}</span>

                      <span className="pill-price">
                        ${parseFloat(servicio.precio_base).toFixed(2)}
                      </span>

                      {serviciosSeleccionadosModal.includes(servicio.id_servicio) && (
                        <span className="pill-check">✓</span>
                      )}
                    </button>
                  ))}
                </div>
                  
                  {/* INFORMACIÓN DE SELECCIÓN */}
                  {serviciosSeleccionadosModal.length > 0 && (
                    <div className="servicios-info-bar">
                      <p>
                        <Tag size={16} />
                        {" "}Se aplicará{serviciosSeleccionadosModal.length !== 1 ? 'n' : ''} <strong>{serviciosSeleccionadosModal.length}</strong> servicio{serviciosSeleccionadosModal.length !== 1 ? 's' : ''} a la factura seleccionada
                      </p>
                    </div>
                  )}
                </>
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
                <X className="w-4 h-4 mr-2" />
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

{/* MODAL ANULAR FACTURA */}
{modalType === 'anular' && selectedFactura && (
  <div className="modal-overlay">
    <div className="modal modal-danger" style={{ maxWidth: '650px' }}> {/* 👈 Modal más ancho */}

      {/* HEADER */}
      <div className="modal-header">
        <h3>
          <Ban className="w-5 h-5 inline mr-2 text-red-600" />
          Anular Factura - {selectedFactura.num_factura}
        </h3>
        <button className="modal-close" onClick={closeModal}>
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* BODY */}
      <div className="modal-body">

        {/* INFORMACIÓN DE LA FACTURA */}
        <div className="payment-info-section">
          <div className="payment-client">
            <h4 className="discount-title text-red-600">
              <AlertCircle className="w-4 h-4" />
              Detalles de la factura
            </h4>

            <div className="grid grid-cols-2 gap-3"> {/* 👈 Grid de 2 columnas */}
              <div>
                <p className="client-name">
                  <strong>Afiliado:</strong>{' '}
                  {getFacturaNombre(selectedFactura) || 'No registrado'}
                </p>

                <p className="client-code">
                  <strong>Código:</strong>{' '}
                  {getFacturaCodigo(selectedFactura) || 'N/A'}
                </p>

                <p className="client-code">
                  <strong>Medidor:</strong>{' '}
                  {getFacturaMedidor(selectedFactura) || 'N/A'}
                </p>
              </div>

              <div>
                <p className="client-code">
                  <strong>Periodo de consumo:</strong>{' '}
                  <span className="text-blue-600 font-semibold">
                    {selectedFactura.periodo 
                      ? (() => {
                          const [anio, mes] = selectedFactura.periodo.split('-');
                          return formatearPeriodo(parseInt(mes), anio);
                        })()
                      : 'N/A'
                    }
                  </span>
                </p>

                <p className="client-code">
                  <strong>Consumo:</strong>{' '}
                  {selectedFactura.consumo_m3 || 0} m³
                </p>

                <p className="client-code">
                  <strong>Fecha emisión:</strong>{' '}
                  {formatDateShort(selectedFactura.fecha_emision)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* RESUMEN */}
        <div className="payment-summary">
          <div className="client-code">
            <span><strong>Total Factura:</strong> {' '} </span>
            <span className="amount text-red-600 font-bold text-lg">
              {formatCurrency(selectedFactura.total_factura || selectedFactura.total)}
            </span>
          </div>
        </div>

        {/* ALERTA */}
        <div className="payment-note warning">
          <AlertCircle className="w-4 h-4" />
          <p>
            Esta acción <strong>no se puede deshacer</strong>.  
            La factura quedará anulada permanentemente en el sistema.
          </p>
        </div>

        {/* FORMULARIO */}
        <div className="discount-section">
          <br />
          <h4 className="discount-title">
            <Ban className="w-4 h-4 text-red-600" />
            Motivo de anulación
          </h4>

          <div className="discount-input-container">
            <label>Motivo de anulación *</label>
            <select
              value={anulacionData.motivo}
              onChange={(e) =>
                setAnulacionData({ ...anulacionData, motivo: e.target.value })
              }
              required
              className="discount-input"
              style={{ 
                width: '100%', 
                minHeight: '45px',   
                fontSize: '14px',      
                padding: '10px 14px'   
              }}
            >
              <option value="">-- Seleccione un motivo de anulación --</option>
              {motivosAnulacionFactura.map((motivo, index) => (
                <option key={index} value={motivo}>
                  {motivo}
                </option>
              ))}
            </select>
          </div>

          {anulacionData.motivo === 'Otro (especificar)' && (
            <div className="discount-input-container mt-3">
              <label>Especifique el motivo de anulación *</label>
              <textarea
                rows={5} 
                value={anulacionData.motivoPersonalizado}
                onChange={(e) =>
                  setAnulacionData({
                    ...anulacionData,
                    motivoPersonalizado: e.target.value
                  })
                }
                minLength={10}
                required
                className="discount-input"
                placeholder="Describa el motivo de la anulación de esta factura..."
                style={{ 
                  width: '95%',
                  fontSize: '14px',       /* 👈 Texto más grande */
                  padding: '12px 12px',   /* 👈 Más padding */
                  lineHeight: '1.5'       /* 👈 Mejor espaciado */
                }}
              />

              <small className="text-gray-500 text-xs mt-1 block">
                {anulacionData.motivoPersonalizado.length}/10 caracteres mínimos requeridos
              </small>
            </div>
          )}

     
        </div>
      </div>

      {/* FOOTER */}
      <div className="modal-footer">
        <button className="btn-secondary" onClick={closeModal}>
          <X className="w-4 h-4 mr-2" />
          Cancelar
        </button>

        <button
          type="submit"
           className="btn-confirm-anulacion"
          disabled={
            !anulacionData.motivo ||
            (anulacionData.motivo === 'Otro (especificar)' &&
              anulacionData.motivoPersonalizado.length < 10) ||
            loading
          }
          onClick={handleConfirmarAnulacion}
        >
          <Ban className="w-4 h-4 mr-2" />
          {loading ? 'Anulando factura...' : 'Confirmar Anulación'}
        </button>
      </div>
    </div>
  </div>
)}



    </div>
  );
};

export default InvoicesSection;
