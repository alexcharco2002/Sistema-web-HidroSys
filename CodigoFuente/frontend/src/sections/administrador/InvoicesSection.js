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
  Gauge, User, IdCard, Hash, Tag, Percent, Package, Briefcase,
  CheckSquare, Users
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
  const [searchType, setSearchType] = useState('all'); // 'all', 'codigo', 'nombre', 'cedula', 'medidor', 'factura'
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortOption, setSortOption] = useState('codigo');
  const [sortOrder, setSortOrder] = useState('desc');
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [showSearchAdvice, setShowSearchAdvice] = useState(true);

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
  const [serviciosSinLecturaInfo, setServiciosSinLecturaInfo] = useState(null);
  const [loadingServiciosSinLectura, setLoadingServiciosSinLectura] = useState(false);
  const [generatingServiciosSinLectura, setGeneratingServiciosSinLectura] = useState(false);

  // Estados modal preview de facturación de servicios
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewTab, setPreviewTab] = useState('todas');
  const [searchPreview, setSearchPreview] = useState('');
  const [selectedAfiliadosPreview, setSelectedAfiliadosPreview] = useState([]);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewPageSize, setPreviewPageSize] = useState(10);

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

  const periodoSeleccionadoStr = useMemo(() => {
    if (!periodoSeleccionado) return null;
    return `${periodoSeleccionado.anio}-${String(periodoSeleccionado.mes).padStart(2, '0')}`;
  }, [periodoSeleccionado]);



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
      console.error('Error al cargar facturas del periodo:', err);
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

  const fetchServiciosSinLecturaInfo = useCallback(async () => {
    if (!periodoSeleccionadoStr || !permissions.canRead) {
      setServiciosSinLecturaInfo(null);
      return;
    }

    setLoadingServiciosSinLectura(true);
    try {
      const result = await invoicesServices.validarServiciosSinLectura(periodoSeleccionadoStr);
      if (result.success) {
        setServiciosSinLecturaInfo(result.data);
      } else {
        setServiciosSinLecturaInfo(null);
      }
    } catch (err) {
      console.error('Error validando servicios sin lectura:', err);
      setServiciosSinLecturaInfo(null);
    } finally {
      setLoadingServiciosSinLectura(false);
    }
  }, [periodoSeleccionadoStr, permissions.canRead]);


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
        const response = await invoicesServices.getServiciosActivos();
        
        if (response.success && response.data) {
          setServiciosDisponibles(response.data);
        } else {
          setServiciosDisponibles([]);
        }
      } catch (error) {
        console.error('Error al cargar servicios activos:', error);
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
      fetchServiciosSinLecturaInfo();

    }
  }, [
    periodoSeleccionado,
    permissions.canRead,
    fetchFacturasByPeriodo,
    fetchStats,
    fetchServiciosSinLecturaInfo
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

    const getSearchPlaceholder = () => {
    switch (searchType) {
      case 'codigo':
        return 'Escribe el código del afiliado (ej. 1, 24, 150)...';
      case 'nombre':
        return 'Escribe el nombre o apellido del afiliado...';
      case 'cedula':
        return 'Escribe el número de cédula del afiliado...';
      case 'medidor':
        return 'Escribe el número de medidor...';
      case 'factura':
        return 'Escribe el folio de la factura (ej. 0130)...';
      default:
        return 'Buscar por factura, medidor, código, afiliado o cédula...';
    }
  };

  const filteredFacturas = facturas.filter(factura => {
    const searchTrim = searchTerm.trim().toLowerCase();
    
    // Si no hay término de búsqueda, solo evaluar filtro de estado
    if (!searchTrim) {
      return filterStatus === 'all' || factura.estado_factura === filterStatus;
    }

    const toString = (value) => {
      if (value === null || value === undefined) return '';
      return String(value).toLowerCase();
    };

    let matchesSearch = false;

    if (searchType === 'codigo') {
      const cod = toString(getFacturaCodigo(factura));
      // Búsqueda puntual por código: coincidencia exacta o prefijo
      matchesSearch = cod === searchTrim || cod.startsWith(searchTrim);
    } else if (searchType === 'cedula') {
      const ced = toString(getFacturaCedula(factura));
      // Búsqueda puntual por cédula
      matchesSearch = ced === searchTrim || ced.startsWith(searchTrim);
    } else if (searchType === 'nombre') {
      const nom = toString(getFacturaNombre(factura));
      // Búsqueda por nombre o apellido
      matchesSearch = nom.includes(searchTrim);
    } else if (searchType === 'medidor') {
      const med = toString(getFacturaMedidor(factura));
      // Búsqueda puntual por número de medidor
      matchesSearch = med === searchTrim || med.startsWith(searchTrim);
    } else if (searchType === 'factura') {
      const fac = toString(factura.num_factura);
      // Búsqueda por número de factura
      matchesSearch = fac.includes(searchTrim);
    } else {
      // 'all' - Búsqueda general en todos los campos
      matchesSearch =
        toString(factura.num_factura).includes(searchTrim) ||
        toString(factura.id_factura).includes(searchTrim) ||
        toString(getFacturaCodigo(factura)).includes(searchTrim) ||
        toString(getFacturaMedidor(factura)).includes(searchTrim) ||
        toString(getFacturaNombre(factura)).includes(searchTrim) ||
        toString(getFacturaCedula(factura)).includes(searchTrim);
    }

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
      // Prioridad exacta para búsqueda por código
      if (searchTerm.trim() && searchType === 'codigo') {
        const aCod = String(getFacturaCodigo(a) || '').toLowerCase();
        const bCod = String(getFacturaCodigo(b) || '').toLowerCase();
        const term = searchTerm.trim().toLowerCase();
        if (aCod === term && bCod !== term) return -1;
        if (bCod === term && aCod !== term) return 1;
      }

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
  }, [filteredFacturas, sortOption, sortOrder, searchTerm, searchType]);

  const totalPages = Math.max(1, Math.ceil(sortedFacturas.length / pageSize));
  const normalizedCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (normalizedCurrentPage - 1) * pageSize;
  const pageEndIndex = pageStartIndex + pageSize;
  const paginatedFacturas = sortedFacturas.slice(pageStartIndex, pageEndIndex);
  const showingFrom = sortedFacturas.length === 0 ? 0 : pageStartIndex + 1;
  const showingTo = Math.min(pageEndIndex, sortedFacturas.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, searchType, filterStatus, sortOption, sortOrder, pageSize, periodoSeleccionado]);

  useEffect(() => {
    if (facturas.length <= 100) {
      setShowSearchAdvice(false);
      return undefined;
    }

    setShowSearchAdvice(true);
    const timer = setTimeout(() => setShowSearchAdvice(false), 12000);
    return () => clearTimeout(timer);
  }, [facturas.length, searchTerm, searchType, filterStatus, periodoSeleccionado]);

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


  const handleAbrirModalPreview = async () => {
    if (!periodoSeleccionadoStr) return;

    let info = serviciosSinLecturaInfo;
    if (!info || !info.detalles) {
      setLoadingServiciosSinLectura(true);
      try {
        const result = await invoicesServices.validarServiciosSinLectura(periodoSeleccionadoStr);
        if (result.success && result.data) {
          info = result.data;
          setServiciosSinLecturaInfo(result.data);
        }
      } catch (err) {
        console.error('Error cargando preview de servicios:', err);
      } finally {
        setLoadingServiciosSinLectura(false);
      }
    }

    if (info?.detalles) {
      setSelectedAfiliadosPreview(info.detalles.map(d => d.id_usuario_afi));
    }
    setPreviewTab('todas');
    setSearchPreview('');
    setPreviewPage(1);
    setShowPreviewModal(true);
  };

  const listaDetallesPreview = useMemo(() => {
    return serviciosSinLecturaInfo?.detalles || [];
  }, [serviciosSinLecturaInfo]);

  const categoriasTarifasPreview = useMemo(() => {
    const map = {};
    listaDetallesPreview.forEach(item => {
      const tarifaKey = Number(item.precio).toFixed(2);
      if (!map[tarifaKey]) {
        map[tarifaKey] = {
          precio: Number(item.precio),
          key: tarifaKey,
          label: `$${Number(item.precio).toFixed(2)}`,
          count: 0,
          total: 0
        };
      }
      map[tarifaKey].count += 1;
      map[tarifaKey].total += Number(item.precio);
    });
    return Object.values(map).sort((a, b) => a.precio - b.precio);
  }, [listaDetallesPreview]);

  const detallesFiltradosPreview = useMemo(() => {
    return listaDetallesPreview.filter(item => {
      if (previewTab !== 'todas') {
        if (Number(item.precio).toFixed(2) !== previewTab) return false;
      }
      if (searchPreview.trim()) {
        const term = searchPreview.toLowerCase().trim();
        const nombre = (item.nombre_completo || '').toLowerCase();
        const cedula = (item.cedula || '').toLowerCase();
        const cod = String(item.cod_usuario_afi || '').toLowerCase();
        const medidor = String(item.num_medidor || '').toLowerCase();
        return nombre.includes(term) || cedula.includes(term) || cod.includes(term) || medidor.includes(term);
      }
      return true;
    });
  }, [listaDetallesPreview, previewTab, searchPreview]);

  const totalPaginasPreview = Math.ceil(detallesFiltradosPreview.length / previewPageSize) || 1;
  const itemsPaginaPreview = useMemo(() => {
    const inicio = (previewPage - 1) * previewPageSize;
    return detallesFiltradosPreview.slice(inicio, inicio + previewPageSize);
  }, [detallesFiltradosPreview, previewPage, previewPageSize]);

  const totalSeleccionadosPreview = selectedAfiliadosPreview.length;
  const montoSeleccionadoPreview = useMemo(() => {
    const setIds = new Set(selectedAfiliadosPreview);
    return listaDetallesPreview
      .filter(item => setIds.has(item.id_usuario_afi))
      .reduce((sum, item) => sum + Number(item.precio), 0);
  }, [selectedAfiliadosPreview, listaDetallesPreview]);

  const toggleSelectAfiliadoPreview = (idUsuarioAfi) => {
    setSelectedAfiliadosPreview(prev => {
      if (prev.includes(idUsuarioAfi)) {
        return prev.filter(id => id !== idUsuarioAfi);
      } else {
        return [...prev, idUsuarioAfi];
      }
    });
  };

  const toggleSelectTodosFiltradosPreview = () => {
    const idsFiltrados = detallesFiltradosPreview.map(item => item.id_usuario_afi);
    const todosSeleccionados = idsFiltrados.length > 0 && idsFiltrados.every(id => selectedAfiliadosPreview.includes(id));

    if (todosSeleccionados) {
      setSelectedAfiliadosPreview(prev => prev.filter(id => !idsFiltrados.includes(id)));
    } else {
      setSelectedAfiliadosPreview(prev => Array.from(new Set([...prev, ...idsFiltrados])));
    }
  };

  const handleConfirmarGeneracionServicios = async () => {
    if (!periodoSeleccionadoStr || selectedAfiliadosPreview.length === 0) {
      alert('⚠️ Debes seleccionar al menos un afiliado para generar facturas');
      return;
    }

    const mensaje = [
      `¿Confirmar la generación de facturas para ${formatearPeriodo(periodoSeleccionado.mes, periodoSeleccionado.anio)}?`,
      '',
      `• Afiliados seleccionados: ${totalSeleccionadosPreview}`,
      `• Monto total estimado: ${formatCurrency(montoSeleccionadoPreview)}`,
      '',
      'El sistema generará las facturas correspondientes sin duplicados.'
    ].join('\n');

    if (!window.confirm(mensaje)) return;

    setGeneratingServiciosSinLectura(true);
    try {
      const result = await invoicesServices.generarServiciosSinLectura(
        periodoSeleccionadoStr,
        selectedAfiliadosPreview
      );

      if (result.success) {
        alert(
          `✅ ${result.message}\n\n` +
          `• Facturas creadas: ${result.data?.facturas_creadas ?? 0}\n` +
          `• Servicios facturados: ${result.data?.detalles_creados ?? 0}\n` +
          `• Total generado: ${formatCurrency(result.data?.monto_total || 0)}`
        );
        setShowPreviewModal(false);
        await fetchFacturasByPeriodo();
        await fetchStats();
        await fetchServiciosSinLecturaInfo();
        await fetchPeriodosDisponibles();
      } else {
        alert(`❌ ${result.message}`);
      }
    } catch (error) {
      console.error('Error generando facturas de servicios:', error);
      alert('❌ Error al generar facturas de servicios');
    } finally {
      setGeneratingServiciosSinLectura(false);
    }
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
      console.error('Error al aplicar descuento:', error);
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

                    {/* PÍLDORAS DE CRITERIO DE BÚSQUEDA PUNTUAL (Opción 2) */}
          <div className="search-criteria-pills">
            <span className="search-criteria-label">Buscar por:</span>
            <button
              type="button"
              className={`search-pill ${searchType === 'all' ? 'active' : ''}`}
              onClick={() => setSearchType('all')}
              title="Buscar en todos los campos"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Todos</span>
            </button>
            <button
              type="button"
              className={`search-pill ${searchType === 'codigo' ? 'active' : ''}`}
              onClick={() => setSearchType('codigo')}
              title="Búsqueda puntual por código de afiliado"
            >
              <Hash className="w-3.5 h-3.5" />
              <span>Código</span>
            </button>
            <button
              type="button"
              className={`search-pill ${searchType === 'nombre' ? 'active' : ''}`}
              onClick={() => setSearchType('nombre')}
              title="Búsqueda por nombre o apellido"
            >
              <User className="w-3.5 h-3.5" />
              <span>Nombre</span>
            </button>
            <button
              type="button"
              className={`search-pill ${searchType === 'cedula' ? 'active' : ''}`}
              onClick={() => setSearchType('cedula')}
              title="Búsqueda puntual por cédula"
            >
              <IdCard className="w-3.5 h-3.5" />
              <span>Cédula</span>
            </button>
            <button
              type="button"
              className={`search-pill ${searchType === 'medidor' ? 'active' : ''}`}
              onClick={() => setSearchType('medidor')}
              title="Búsqueda por número de medidor"
            >
              <Gauge className="w-3.5 h-3.5" />
              <span>Medidor</span>
            </button>
            <button
              type="button"
              className={`search-pill ${searchType === 'factura' ? 'active' : ''}`}
              onClick={() => setSearchType('factura')}
              title="Búsqueda por folio de factura"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>N° Factura</span>
            </button>
          </div>

          {/* BARRA DE BÚSQUEDA Y FILTROS */}
          <div className="filters-section">
            <div className="search-container">
              <Search className="search-icon" />
              <input
                type="text"
                placeholder={getSearchPlaceholder()}
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
          {facturas.length > 100 && showSearchAdvice && (
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
                  setSearchType('all');
                  setFilterStatus('all');
                }}
              >
                Limpiar búsqueda
              </button>
            )}
          </div>

          {permissions.canCreate && serviciosSinLecturaInfo?.hay_pendientes && (
            <div className="services-permanent-section">
                <div className="services-no-reading-card">
                  <div className="services-no-reading-info">
                    <Briefcase className="w-5 h-5 text-emerald-600" />
                    <div>
                      <h4>Servicios permanentes sin lectura pendientes</h4>
                      <p>
                        {serviciosSinLecturaInfo.total_afiliados} afiliado(s), {' '}
                        {serviciosSinLecturaInfo.total_servicios} servicio(s), {' '}
                        estimado {formatCurrency(serviciosSinLecturaInfo.monto_estimado || 0)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleAbrirModalPreview}
                    disabled={generatingServiciosSinLectura || loadingServiciosSinLectura}
                  >
                    {loadingServiciosSinLectura ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Cargando...</span>
                      </>
                    ) : (
                      <>
                        <FileText className="w-4 h-4" />
                        <span>Previsualizar y Generar</span>
                      </>
                    )}
                  </button>
                </div>
            </div>
          )}

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

            {/* FOOTER */}
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={closeModal}>
                <X className="w-4 h-4 mr-1.5" />
                Cerrar
              </button>
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
              {/* INFORMACIÓN DE LA FACTURA */}
              <div className="modal-info-card">
                <h4 className="modal-section-title">
                  <FileText className="w-4 h-4" />
                  Detalles de la factura
                </h4>
                <div className="modal-info-grid">
                  <div className="modal-info-item">
                    <span className="modal-info-label">Afiliado</span>
                    <span className="modal-info-val">{getFacturaNombre(paymentData.factura) || 'No registrado'}</span>
                  </div>
                  <div className="modal-info-item">
                    <span className="modal-info-label">Código</span>
                    <span className="modal-info-val font-mono">{getFacturaCodigo(paymentData.factura) || 'N/A'}</span>
                  </div>
                  <div className="modal-info-item">
                    <span className="modal-info-label">Medidor</span>
                    <span className="modal-info-val font-mono">{getFacturaMedidor(paymentData.factura) || 'N/A'}</span>
                  </div>
                  <div className="modal-info-item">
                    <span className="modal-info-label">Factura</span>
                    <span className="modal-info-val font-mono">{paymentData.factura.num_factura}</span>
                  </div>
                  <div className="modal-info-item">
                    <span className="modal-info-label">Periodo de consumo</span>
                    <span className="modal-info-val text-blue-600 font-semibold">
                      {paymentData.factura.periodo 
                        ? (() => {
                            const [anio, mes] = paymentData.factura.periodo.split('-');
                            return formatearPeriodo(parseInt(mes), anio);
                          })()
                        : 'N/A'
                      }
                    </span>
                  </div>
                  <div className="modal-info-item">
                    <span className="modal-info-label">Fecha emisión</span>
                    <span className="modal-info-val">{formatDateShort(paymentData.factura.fecha_emision)}</span>
                  </div>
                  <div className="modal-info-divider"></div>
                  <div className="modal-info-item col-span-2">
                    <span className="modal-info-label">Total Factura</span>
                    <span className="modal-info-val text-total">
                      {formatCurrency(paymentData.factura.total)}
                    </span>
                  </div>
                </div>
              </div>

              {/* SECCIÓN DE DESCUENTO */}
              <div className="discount-section">
                <h4 className="modal-section-title">
                  <Tag className="w-4 h-4" />
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
              <button type="button" className="btn btn-secondary" onClick={closePaymentModal}>
                <X className="w-4 h-4 mr-1.5" />
                Cancelar
              </button>
              {/* Botón para aplicar descuento solamente */}
              {paymentData.descuentoTipo !== 'ninguno' && paymentData.descuentoValor > 0 && (
                <button 
                  type="button"
                  className="btn btn-primary" 
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
              {/* INFORMACIÓN DE LA FACTURA */}
              <div className="modal-info-card">
                <h4 className="modal-section-title">
                  <FileText className="w-4 h-4" />
                  Detalles de la factura
                </h4>
                <div className="modal-info-grid">
                  <div className="modal-info-item">
                    <span className="modal-info-label">Afiliado</span>
                    <span className="modal-info-val">{getFacturaNombre(facturaSeleccionadaServicios) || 'No registrado'}</span>
                  </div>
                  <div className="modal-info-item">
                    <span className="modal-info-label">Código</span>
                    <span className="modal-info-val font-mono">{getFacturaCodigo(facturaSeleccionadaServicios) || 'N/A'}</span>
                  </div>
                  <div className="modal-info-item">
                    <span className="modal-info-label">Medidor</span>
                    <span className="modal-info-val font-mono">{getFacturaMedidor(facturaSeleccionadaServicios) || 'N/A'}</span>
                  </div>
                  <div className="modal-info-item">
                    <span className="modal-info-label">Factura</span>
                    <span className="modal-info-val font-mono">{facturaSeleccionadaServicios.num_factura}</span>
                  </div>
                  <div className="modal-info-item">
                    <span className="modal-info-label">Periodo de consumo</span>
                    <span className="modal-info-val text-blue-600 font-semibold">
                      {facturaSeleccionadaServicios.periodo 
                        ? (() => {
                            const [anio, mes] = facturaSeleccionadaServicios.periodo.split('-');
                            return formatearPeriodo(parseInt(mes), anio);
                          })()
                        : 'N/A'
                      }
                    </span>
                  </div>
                  <div className="modal-info-item">
                    <span className="modal-info-label">Fecha emisión</span>
                    <span className="modal-info-val">{formatDateShort(facturaSeleccionadaServicios.fecha_emision)}</span>
                  </div>
                  <div className="modal-info-divider"></div>
                  <div className="modal-info-item col-span-2">
                    <span className="modal-info-label">Total Actual</span>
                    <span className="modal-info-val text-total">
                      {formatCurrency(facturaSeleccionadaServicios.total)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Lista de servicios disponibles */}
              <div className="servicios-selection">
                <h4 className="modal-section-title">
                  <Briefcase className="w-4 h-4" />
                  Selecciona los servicios a aplicar
                </h4>
            
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
                <CheckCircle className="w-4 h-4 mr-2 inline" />{loading ? 'Aplicando...' : `Aplicar ${serviciosSeleccionadosModal.length} Servicio(s)`}
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
          <Ban className="w-5 h-5 inline mr-2" />
          Anular Factura - {selectedFactura.num_factura}
        </h3>
        <button className="modal-close" onClick={closeModal} title="Cerrar modal">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* BODY */}
      <div className="modal-body">

        {/* INFORMACIÓN DE LA FACTURA */}
        <div className="modal-info-card">
          <h4 className="modal-section-title">
            <FileText className="w-4 h-4" />
            Detalles de la factura
          </h4>

          <div className="modal-info-grid">
            <div className="modal-info-item">
              <span className="modal-info-label">Afiliado</span>
              <span className="modal-info-val">{getFacturaNombre(selectedFactura) || 'No registrado'}</span>
            </div>

            <div className="modal-info-item">
              <span className="modal-info-label">Código</span>
              <span className="modal-info-val font-mono">{getFacturaCodigo(selectedFactura) || 'N/A'}</span>
            </div>

            <div className="modal-info-item">
              <span className="modal-info-label">Medidor</span>
              <span className="modal-info-val font-mono">{getFacturaMedidor(selectedFactura) || 'N/A'}</span>
            </div>

            <div className="modal-info-item">
              <span className="modal-info-label">Factura</span>
              <span className="modal-info-val font-mono">{selectedFactura.num_factura}</span>
            </div>

            <div className="modal-info-item">
              <span className="modal-info-label">Periodo de consumo</span>
              <span className="modal-info-val text-blue-600 font-semibold">
                {selectedFactura.periodo 
                  ? (() => {
                      const [anio, mes] = selectedFactura.periodo.split('-');
                      return formatearPeriodo(parseInt(mes), anio);
                    })()
                  : 'N/A'
                }
              </span>
            </div>

            <div className="modal-info-item">
              <span className="modal-info-label">Consumo</span>
              <span className="modal-info-val">{selectedFactura.consumo_m3 || 0} m³</span>
            </div>

            <div className="modal-info-item">
              <span className="modal-info-label">Fecha emisión</span>
              <span className="modal-info-val">{formatDateShort(selectedFactura.fecha_emision)}</span>
            </div>

            <div className="modal-info-divider"></div>

            <div className="modal-info-item col-span-2">
              <span className="modal-info-label">Total Factura</span>
              <span className="modal-info-val text-red-600 font-bold text-lg">
                {formatCurrency(selectedFactura.total_factura || selectedFactura.total)}
              </span>
            </div>
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
          <h4 className="modal-section-title">
            <Ban className="w-4 h-4" />
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
              className="discount-input w-full"
              style={{ 
                width: '100%', 
                minHeight: '42px',   
                fontSize: '14px',      
                padding: '8px 12px'   
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
                rows={4} 
                value={anulacionData.motivoPersonalizado}
                onChange={(e) =>
                  setAnulacionData({
                    ...anulacionData,
                    motivoPersonalizado: e.target.value
                  })
                }
                minLength={10}
                required
                className="discount-input w-full"
                placeholder="Describa el motivo de la anulación de esta factura..."
                style={{ 
                  width: '100%',
                  fontSize: '14px',
                  padding: '10px 12px',
                  lineHeight: '1.5'
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
        <button type="button" className="btn btn-secondary" onClick={closeModal}>
          <X className="w-4 h-4 mr-1.5" />
          Cancelar
        </button>

        <button
          type="button"
          className="btn btn-danger"
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

      {/* ============================================================ */}
      {/* MODAL PREVIEW Y CONFIRMACIÓN DE GENERACIÓN DE SERVICIOS */}
      {/* ============================================================ */}
      {showPreviewModal && serviciosSinLecturaInfo && (
        <div className="modal-overlay">
          <div className="modal modal-preview-services">
            {/* HEADER */}
            <div className="modal-header">
              <h3>
                <Briefcase className="w-5 h-5 inline mr-2 text-blue-600" />
                Previsualización de Facturación — {formatearPeriodo(periodoSeleccionado.mes, periodoSeleccionado.anio)}
              </h3>
              <button 
                type="button"
                className="modal-close"
                onClick={() => setShowPreviewModal(false)}
                disabled={generatingServiciosSinLectura}
                title="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* BODY */}
            <div className="modal-body">
              {/* Tarjetas resumen */}
              <div className="preview-stats-grid">
                <div className="preview-stat-card">
                  <div className="preview-stat-icon emerald">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="preview-stat-content">
                    <h5>Total Afiliados</h5>
                    <div className="preview-stat-val">{serviciosSinLecturaInfo.total_afiliados}</div>
                  </div>
                </div>

                <div className="preview-stat-card">
                  <div className="preview-stat-icon blue">
                    <CheckSquare className="w-5 h-5" />
                  </div>
                  <div className="preview-stat-content">
                    <h5>Seleccionados</h5>
                    <div className="preview-stat-val text-blue-600">
                      {totalSeleccionadosPreview} / {serviciosSinLecturaInfo.total_afiliados}
                    </div>
                  </div>
                </div>

                <div className="preview-stat-card">
                  <div className="preview-stat-icon amber">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div className="preview-stat-content">
                    <h5>Monto a Facturar</h5>
                    <div className="preview-stat-val text-amber-700">
                      {formatCurrency(montoSeleccionadoPreview)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Pestañas de grupo / tarifa */}
              <div className="preview-tabs-container">
                <button
                  type="button"
                  className={`preview-tab-btn ${previewTab === 'todas' ? 'active' : ''}`}
                  onClick={() => { setPreviewTab('todas'); setPreviewPage(1); }}
                >
                  <span>Todas las tarifas</span>
                  <span className="preview-tab-badge">
                    {listaDetallesPreview.length} • {formatCurrency(serviciosSinLecturaInfo.monto_estimado || 0)}
                  </span>
                </button>
                {categoriasTarifasPreview.map(cat => (
                  <button
                    key={cat.key}
                    type="button"
                    className={`preview-tab-btn ${previewTab === cat.key ? 'active' : ''}`}
                    onClick={() => { setPreviewTab(cat.key); setPreviewPage(1); }}
                  >
                    <span>Tarifa {cat.label}</span>
                    <span className="preview-tab-badge">
                      {cat.count} • {formatCurrency(cat.total)}
                    </span>
                  </button>
                ))}
              </div>

              {/* Barra de herramientas: buscador y selector de tamaño */}
              <div className="preview-toolbar">
                <div className="preview-search-box">
                  <Search className="preview-search-icon" />
                  <input
                    type="text"
                    placeholder="Buscar por código, nombre o cédula..."
                    value={searchPreview}
                    onChange={(e) => { setSearchPreview(e.target.value); setPreviewPage(1); }}
                  />
                  {searchPreview && (
                    <button
                      type="button"
                      className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                      onClick={() => { setSearchPreview(''); setPreviewPage(1); }}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="preview-page-size-selector">
                    <span>Ver:</span>
                    <select
                      value={previewPageSize}
                      onChange={(e) => {
                        setPreviewPageSize(Number(e.target.value));
                        setPreviewPage(1);
                      }}
                    >
                      <option value={10}>10 por grupo</option>
                      <option value={20}>20 por grupo</option>
                      <option value={50}>50 por grupo</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    className="btn-secondary text-xs py-1 px-2.5 flex items-center gap-1.5"
                    onClick={toggleSelectTodosFiltradosPreview}
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>Invertir Selección</span>
                  </button>
                </div>
              </div>

              {/* Tabla de afiliados a facturar */}
              <div className="preview-table-container">
                <table className="preview-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={
                            detallesFiltradosPreview.length > 0 &&
                            detallesFiltradosPreview.every(item => selectedAfiliadosPreview.includes(item.id_usuario_afi))
                          }
                          onChange={toggleSelectTodosFiltradosPreview}
                        />
                      </th>
                      <th>Cód.</th>
                      <th>Afiliado</th>
                      <th>Cédula</th>
                      <th>Medidor</th>
                      <th>Servicio / Categoría</th>
                      <th style={{ textAlign: 'right' }}>Tarifa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemsPaginaPreview.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="text-center py-6 text-gray-400">
                          No se encontraron afiliados que coincidan con el filtro.
                        </td>
                      </tr>
                    ) : (
                      itemsPaginaPreview.map((item) => {
                        const isChecked = selectedAfiliadosPreview.includes(item.id_usuario_afi);
                        return (
                          <tr 
                            key={item.id_usuario_afi}
                            onClick={() => toggleSelectAfiliadoPreview(item.id_usuario_afi)}
                            style={{ cursor: 'pointer' }}
                          >
                            <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleSelectAfiliadoPreview(item.id_usuario_afi)}
                              />
                            </td>
                            <td className="font-semibold text-gray-700">{item.cod_usuario_afi}</td>
                            <td className="font-medium text-gray-900">{item.nombre_completo}</td>
                            <td className="text-gray-500 font-mono text-xs">{item.cedula || 'S/C'}</td>
                            <td className="text-gray-500 text-xs">
                              {item.num_medidor !== 'S/M' ? (
                                <span className="text-indigo-600 font-medium">{item.num_medidor}</span>
                              ) : (
                                <span className="text-gray-400">Sin medidor</span>
                              )}
                            </td>
                            <td>
                              <span className="text-gray-700 text-xs font-medium">{item.servicio_nombre}</span>
                              <span className="text-gray-400 text-xs block">({item.tarifa_nombre})</span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <span className="preview-badge-tarifa">
                                {formatCurrency(item.precio)}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Paginador */}
              {totalPaginasPreview > 1 && (
                <div className="preview-pagination">
                  <div>
                    Mostrando {(previewPage - 1) * previewPageSize + 1} a {Math.min(previewPage * previewPageSize, detallesFiltradosPreview.length)} de {detallesFiltradosPreview.length} afiliados
                  </div>
                  <div className="preview-pagination-actions">
                    <button
                      type="button"
                      className="preview-page-btn"
                      disabled={previewPage <= 1}
                      onClick={() => setPreviewPage(prev => Math.max(1, prev - 1))}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-2 font-semibold">
                      Página {previewPage} de {totalPaginasPreview}
                    </span>
                    <button
                      type="button"
                      className="preview-page-btn"
                      disabled={previewPage >= totalPaginasPreview}
                      onClick={() => setPreviewPage(prev => Math.min(totalPaginasPreview, prev + 1))}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* FOOTER */}
            <div className="modal-footer">
              <div className="footer-left-info">
                <span>Total a generar: </span>
                <strong>{totalSeleccionadosPreview} facturas</strong> por un total de <strong>{formatCurrency(montoSeleccionadoPreview)}</strong>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowPreviewModal(false)}
                  disabled={generatingServiciosSinLectura}
                >
                  <X className="w-4 h-4 mr-1.5" />
                  Cancelar
                </button>

                <button
                  type="button"
                  className="btn btn-primary btn-confirm-generate"
                  onClick={handleConfirmarGeneracionServicios}
                  disabled={generatingServiciosSinLectura || totalSeleccionadosPreview === 0}
                >
                  {generatingServiciosSinLectura ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Generando Facturas...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      <span>Confirmar y Generar Facturas ({totalSeleccionadosPreview})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default InvoicesSection;
