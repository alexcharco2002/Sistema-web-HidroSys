// src/sections/ReadingsSection.js
// MÓDULO DE LECTURAS - Con sistema de periodos mensuales REORGANIZADO

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './ReadingsList.css';
import readingsServices from '../../services/readingsServices';
import authService from '../../services/authServices';
import * as XLSX from "xlsx";

import {
  BookOpen, Search, Edit, Trash2, Eye, CheckCircle, XCircle, Calendar, X, Save,
  RefreshCw, AlertCircle, ArrowUpDown, Gauge, Plus, FileSpreadsheet, TrendingUp,
  User, Download, Upload, MapPin, CalendarDays, Clock, Check, Activity, ChevronDown,
  ChevronLeft, ChevronRight
} from 'lucide-react';

const ReadingsSection = () => {
  const pageSizeOptions = [10, 20, 50, 100];

  // ============================================================
  // ESTADOS PRINCIPALES
  // ============================================================
  const [readings, setReadings] = useState([]);
  const [meters, setMeters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ loadingMeters, setLoadingMeters] = useState(false); 
  const [error, setError] = useState(null);

  // estado para controlar qué años están expandidos en la sección de periodos
  const [aniosExpandidos, setAniosExpandidos] = useState({});

  // función para alternar la expansión de un año específico
  const toggleAnio = (anio) => {
        setAniosExpandidos(prev => ({ ...prev, [anio]: !prev[anio] }));
      }; 
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
  const [filterConsumo, setFilterConsumo] = useState('all');
  const [filterSector, setFilterSector] = useState('all');
  const [sortOption, setSortOption] = useState('periodo');
  const [sortOrder, setSortOrder] = useState('desc');
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [showSearchAdvice, setShowSearchAdvice] = useState(true);

  // ============================================================
  // ESTADOS DE MODAL
  // ============================================================
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('create');
  const [selectedReading, setSelectedReading] = useState(null);
  const [selectedMeterInfo, setSelectedMeterInfo] = useState(null);
  const [meterSearchTerm, setMeterSearchTerm] = useState('');

  // ============================================================
  // ESTADOS DE EXCEL CON PERIODO
  // ============================================================
  const [selectedExcel, setSelectedExcel] = useState(null);
  const [excelPreview, setExcelPreview] = useState([]);
  const [loadingExcel, setLoadingExcel] = useState(false);
  const [excelMesSeleccionado, setExcelMesSeleccionado] = useState('');
  const [excelAnioSeleccionado, setExcelAnioSeleccionado] = useState('');
  const [excelPreviewPage, setExcelPreviewPage] = useState(0);

  // ESTADOS DE LECTURAS ESTIMADAS
  const [showEstimadasModal, setShowEstimadasModal] = useState(false);
  const [loadingEstimadas, setLoadingEstimadas] = useState(false);
  const [estimadasResult, setEstimadasResult] = useState(null);
  const [, setShowConfirmacionModal] = useState(false);
  const [, setConfirmacionResult] = useState(null);

  const getPeriodoConsumo = (reading) => reading?.periodo_consumo || '';

  const formatFechaLectura = (fecha) => {
    if (!fecha) return 'N/A';
    return new Date(`${fecha}T00:00:00`).toLocaleDateString('es-EC', {
      day: '2-digit',
      month: 'short'
    });
  };

  const EXCEL_PREVIEW_PAGE_SIZE = 50;

  const isValidExcelReading = (lectura) => {
    const esNumerico = /^\d{1,13}$/.test(lectura.lectura_actual);
    return Boolean(
      lectura.num_medidor &&
      lectura.lectura_actual &&
      esNumerico &&
      parseInt(lectura.lectura_actual) >= parseInt(lectura.lectura_anterior || 0)
    );
  };

  const getExcelReadingError = (lectura) => {
    const esNumerico = /^\d{1,13}$/.test(lectura.lectura_actual);
    if (!lectura.num_medidor) return 'Sin medidor';
    if (!lectura.lectura_actual) return 'Sin lectura';
    if (!esNumerico) return 'Solo números (máx 13 dígitos)';
    if (parseInt(lectura.lectura_actual) < parseInt(lectura.lectura_anterior || 0)) {
      return 'Lectura menor que anterior';
    }
    return '';
  };

  const excelPreviewPages = useMemo(() => {
    const pages = [];
    for (let start = 0; start < excelPreview.length; start += EXCEL_PREVIEW_PAGE_SIZE) {
      const items = excelPreview.slice(start, start + EXCEL_PREVIEW_PAGE_SIZE);
      const validas = items.filter(isValidExcelReading).length;
      pages.push({
        start,
        end: start + items.length,
        items,
        validas,
        invalidas: items.length - validas
      });
    }
    return pages;
  }, [excelPreview]);

  const currentExcelPreviewPage = excelPreviewPages[excelPreviewPage] || excelPreviewPages[0];
  const excelValidCount = useMemo(
    () => excelPreview.filter(isValidExcelReading).length,
    [excelPreview]
  );
  const excelInvalidCount = excelPreview.length - excelValidCount;

  const estimatedReadingsCount = useMemo(
    () => readings.filter(reading => reading.es_estimada).length,
    [readings]
  );
  

  // FUNCIÓN PARA GENERAR LECTURAS ESTIMADAS
  const handleGenerarEstimadas = async () => {
      if (!periodoSeleccionado) {
          alert('Debe seleccionar un periodo primero');
          return;
      }

      // 1️⃣ Validar que existan medidores sin lectura
      try {
          const validacion = await readingsServices.validarPeriodoCompleto(
              periodoSeleccionado.mes,
              periodoSeleccionado.anio
          );

          if (!validacion.success) {
              alert(validacion.message || 'Error validando el periodo');
              return;
          }

          const { completo, porcentaje, total_lecturas, total_medidores } = validacion.data;

          // Si ya está completo → No generar estimadas
          if (completo) {
              alert(
                  `⚠️ No hay lecturas faltantes.\n` +
                  `El periodo seleccionado está COMPLETO (${porcentaje}%).\n` +
                  `Total lecturas: ${total_lecturas} / ${total_medidores}`
              );
              return;
          }

          // Si faltan lecturas → continuar
      } catch (err) {
          alert(err.message || 'Error al validar el periodo');
          return;
      }

      // 2️⃣ Confirmación
      const confirmado = window.confirm(
          `¿Generar lecturas estimadas para ${readingsServices.formatearPeriodo(
              periodoSeleccionado.mes,
              periodoSeleccionado.anio
          )}?\n\nEsto creará lecturas sugeridas basadas en consumos anteriores para los medidores que no tienen lectura registrada.`
      );

      if (!confirmado) return;

      // 3️⃣ Ejecutar generación
      setLoadingEstimadas(true);
      setError(null);

      try {
          const result = await readingsServices.generarLecturasEstimadas(
              periodoSeleccionado.mes,
              periodoSeleccionado.anio,
              3 // Promedio de 3 meses
          );

          if (result.success) {
              setEstimadasResult(result.data);
              setShowEstimadasModal(true);

              await fetchReadingsByPeriodo();
              await fetchPeriodosDisponibles();
          } else {
              setError(result.message);
          }
      } catch (error) {
          setError(error.message || 'Error al generar lecturas estimadas');
      } finally {
          setLoadingEstimadas(false);
      }
  };


  /**
 * FUNCIÓN PARA CONFIRMAR LECTURA ESTIMADA
 */
const handleConfirmarEstimada = async (reading) => {
  try {
    // Validar que sea estimada
    if (!reading.es_estimada) {
      alert('⚠️ Esta lectura no es estimada');
      return;
    }

    // Mostrar información y solicitar lectura real
    const mensaje = `📊 CONFIRMAR LECTURA ESTIMADA\n\n` +
      `Medidor: ${reading.num_medidor || 'N/A'}\n` +
      `Afiliado: ${reading.nombre_afiliado || 'N/A'}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Lectura anterior: ${reading.lectura_anterior} m³\n` +
      `Lectura estimada: ${reading.lectura_actual} m³\n` +
      `Consumo estimado: ${reading.consumo_m3} m³\n\n` +
      `Ingresa la LECTURA REAL:`;
    
    const lecturaRealStr = prompt(mensaje, reading.lectura_actual);

    // Usuario canceló
    if (lecturaRealStr === null) return;

    // Validar que sea un número
    const lecturaReal = parseInt(lecturaRealStr.trim());
    
    if (isNaN(lecturaReal)) {
      alert('❌ Debes ingresar un número válido');
      return;
    }

    // Validar que no sea menor a la lectura anterior
    if (lecturaReal < reading.lectura_anterior) {
      alert(`❌ La lectura real (${lecturaReal}m³) no puede ser menor que la lectura anterior (${reading.lectura_anterior}m³)`);
      return;
    }

    // Calcular nuevo consumo para mostrar
    const nuevoConsumo = lecturaReal - reading.lectura_anterior;

    // Confirmación final
    const confirmado = window.confirm(
      `✅ CONFIRMAR CAMBIOS\n\n` +
      `Lectura anterior: ${reading.lectura_anterior} m³\n` +
      `Lectura real: ${lecturaReal} m³\n` +
      `Nuevo consumo: ${nuevoConsumo} m³\n\n` +
      `Se generará la factura automáticamente.\n\n` +
      `¿Confirmar?`
    );

    if (!confirmado) return;


    // Ejecutar confirmación
    const result = await readingsServices.confirmarLecturaEstimada(
      reading.id_lectura,
      lecturaReal,
      null  // observación opcional
    );
    
    if (result.success) {
      const data = result.data;
      
      // Construir mensaje de éxito
      let mensajeExito = `✅ Lectura confirmada exitosamente\n\n`;
      mensajeExito += `📊 Lectura real: ${lecturaReal} m³\n`;
      mensajeExito += `💧 Consumo real: ${nuevoConsumo} m³\n`;
      
      // Si se generó factura
      if (data.factura_generada) {
        mensajeExito += `\n📄 FACTURA GENERADA\n`;
        mensajeExito += `Número: ${data.factura_generada.num_factura}\n`;
        mensajeExito += `Total: $${data.factura_generada.total.toFixed(2)}\n`;
        mensajeExito += `Tarifa: ${data.factura_generada.tarifa_aplicada}`;
      } else if (data.mensaje_factura) {
        mensajeExito += `\n⚠️ ${data.mensaje_factura}`;
      }
      
      alert(mensajeExito);
      
      // Recargar datos
      await fetchReadingsByPeriodo(); 
      await fetchPeriodosDisponibles();
      
    } else {
      alert(`❌ Error: ${result.message || 'No se pudo confirmar la lectura'}`);
    }
    
  } catch (error) {
    console.error('Error al confirmar lectura estimada:', error);
    alert(`❌ Error al confirmar lectura estimada\n\n${error.message || 'Error desconocido'}`);
  }
};

  const filteredMeters = useMemo(() => {
    if (!meterSearchTerm.trim()) return meters;
    
    const searchLower = meterSearchTerm.toLowerCase().trim();
    
    return meters.filter(afiliado => {
      const numMedidor = afiliado.num_medidor?.toLowerCase() || '';
      const nombreCompleto = afiliado.nombre_completo?.toLowerCase() || '';
      const codigoAfiliado = String(afiliado.cod_usuario_afi || '').toLowerCase();
      const sector = String(afiliado.nombre_sector || afiliado.sector || '').toLowerCase();
      
      return numMedidor.includes(searchLower) || 
            nombreCompleto.includes(searchLower) || 
            codigoAfiliado.includes(searchLower) ||
            sector.includes(searchLower);
    });
  }, [meters, meterSearchTerm]);

  // FUNCIÓN PARA CONFIRMAR TODAS LAS LECTURAS ESTIMADAS
  const handleConfirmarTodas = async () => {
      if (!periodoSeleccionado) {
          alert('Debe seleccionar un periodo primero');
          return;
      }
      
      // Verificar si hay lecturas estimadas
      const lecturasEstimadas = sortedReadings.filter(r => r.es_estimada);
      
      if (lecturasEstimadas.length === 0) {
          alert('No hay lecturas estimadas para confirmar en este periodo');
          return;
      }
      
      const confirmado = window.confirm(
          `¿Confirmar ${lecturasEstimadas.length} lecturas estimadas del periodo ${readingsServices.formatearPeriodo(periodoSeleccionado.mes, periodoSeleccionado.anio)}?\n\n` +
          `Las lecturas estimadas se convertirán en lecturas reales con los valores actuales.\n\n` +
          `Esta acción no se puede deshacer.`
      );
      
      if (!confirmado) return;
      
      setLoading(true);
      setError(null);
      
      try {
          const result = await readingsServices.confirmarTodasLecturasEstimadas(
              periodoSeleccionado.mes,
              periodoSeleccionado.anio
          );
          
          if (result.success) {
              setConfirmacionResult(result.data);
              setShowConfirmacionModal(true);
              await fetchReadingsByPeriodo();
              await fetchPeriodosDisponibles();
          } else {
              setError(result.message);
              alert(result.message || 'Error al confirmar lecturas');
          }
      } catch (error) {
          setError(error.message || 'Error al confirmar lecturas estimadas');
          alert(error.message || 'Error al confirmar lecturas estimadas');
      } finally {
          setLoading(false);
      }
  };
  
  // ============================================================
  // ESTADOS DE FORMULARIO
  // ============================================================
  const [formData, setFormData] = useState({
    id_medidor: null,
    lectura_actual: '',
    lectura_anterior: '',
    consumo_m3: '',
    fecha_lectura: new Date().toISOString().split('T')[0],
    periodo_consumo: '',
    observacion: '',
    activo: true
  });

  // VALIDACIÓN EN TIEMPO REAL 
  const lecturaActualNum = parseFloat(formData.lectura_actual);
  const lecturaAnteriorNum = parseFloat(formData.lectura_anterior) || 0;

  const lecturaActualInvalida =
    formData.lectura_actual !== '' &&
    (isNaN(lecturaActualNum) || lecturaActualNum < lecturaAnteriorNum);

  const lecturaActualNegativa =
    formData.lectura_actual !== '' && lecturaActualNum < 0;

  // Bloquear el botón submit si la lectura actual es inválida
  const formInvalido = lecturaActualInvalida || lecturaActualNegativa;



  // ============================================================
  // ESTADOS DE PERMISOS
  // ============================================================
  const [permissions, setPermissions] = useState({
    canCreate: false,
    canRead: false,
    canUpdate: false,
    canDelete: false,
    canToggleStatus: false
  });

  // ============================================================
  // EFECTOS
  // ============================================================


  useEffect(() => {
    if (formData.lectura_actual && formData.lectura_anterior !== '') {
      const consumo = parseInt(formData.lectura_actual) - parseInt(formData.lectura_anterior);
      setFormData(prev => ({ ...prev, consumo_m3: consumo }));
    }
  }, [formData.lectura_actual, formData.lectura_anterior]);

  // ============================================================
  // FUNCIONES DE PERIODOS
  // ============================================================
  const fetchPeriodosDisponibles = async () => {
    setLoadingPeriodos(true);
    try {
      const result = await readingsServices.getPeriodosDisponibles();
      
      if (result.success) {
        setPeriodos(result.data.periodos_disponibles);
        setPeriodoActual(result.data.periodo_actual);

        // Solo configurar valores para Excel
        setExcelMesSeleccionado(result.data.periodo_actual.mes.toString());
        setExcelAnioSeleccionado(result.data.periodo_actual.anio.toString());
      } else {
        setError(result.message);
      }
    } catch (error) {
      console.error('Error al cargar periodos:', error);
      setError('Error al cargar periodos disponibles');
    } finally {
      setLoadingPeriodos(false);
    }
  };

const fetchReadingsByPeriodo = useCallback(async () => {
  if (!periodoSeleccionado) return;

  setLoading(true);
  setError(null);

  try {
    // 🔥 Pasar filtros de periodo al backend
    const periodoConsumo = `${periodoSeleccionado.anio}-${String(periodoSeleccionado.mes).padStart(2, '0')}`;
    const result = await readingsServices.getLecturas({
      periodo_consumo: periodoConsumo
    });

    if (result.success) {
      setReadings(result.data);  
    } else {
      setError(result.message);
    }
  } catch (err) {
    console.error('Error al cargar lecturas del periodo:', err);
    setError('Error al cargar lecturas del periodo');
  } finally {
    setLoading(false);
  }
}, [periodoSeleccionado]);



  // efecto solo se ejecuta cuando hay periodo seleccionado
  useEffect(() => {
    if (permissions.canRead && periodoSeleccionado) {
      fetchReadingsByPeriodo();
    }
  }, [periodoSeleccionado, permissions.canRead, fetchReadingsByPeriodo]);

  const handlePeriodoChange = (mes, anio) => {
    setPeriodoSeleccionado({ mes, anio });
  };

  const getPorcentajeCompletado = (periodo) => {
    if (!periodo) return 0;
    return periodo.porcentaje_completado || 0;
  };

  // ============================================================
  // FUNCIONES DE PERMISOS
  // ============================================================
  const loadUserPermissions = () => {
    const canCreate = authService.hasPermission('lecturas', 'crear') || authService.hasPermission('lecturas', 'crud');
    const canUpdate = authService.hasPermission('lecturas', 'actualizar') || authService.hasPermission('lecturas', 'crud');
    const canDelete = authService.hasPermission('lecturas', 'eliminar') || authService.hasPermission('lecturas', 'crud');
    const canRead = authService.hasPermission('lecturas', 'lectura') || canCreate || canUpdate || canDelete || authService.hasPermission('lecturas', 'crud');
    const canToggleStatus = canUpdate;

    setPermissions({ canCreate, canRead, canUpdate, canDelete, canToggleStatus });
  };

  // ============================================================
  // FUNCIONES DE CARGA DE DATOS
  // ============================================================

  // Fetch meters con filtro de periodo
const fetchMeters = useCallback(async () => {
  if (!periodoSeleccionado?.mes || !periodoSeleccionado?.anio) {
    return;
  }
  
  try {
    setLoadingMeters(true);
    
    const result = await readingsServices.getMedidoresParaLecturas(
      periodoSeleccionado.mes,
      periodoSeleccionado.anio,
      false // No incluir medidores con lectura
    );
    
    if (result.success) {
      setMeters(result.data);
      
      // Mensaje informativo si no hay medidores
      if (result.data.length === 0 && result.mensaje) {
        setError(null);
        window.alert(
          `✅📋 Lecturas completadas\n\n${result.mensaje}\n\nAceptar para continuar.`
        );
      }
    } else {
      setError(result.message || 'Error al cargar medidores');
      setMeters([]);
    }
  } catch (error) {
    console.error('Error al cargar medidores para lecturas:', error);
    setError("Error al cargar medidores");
    setMeters([]);
  } finally {
    setLoadingMeters(false);
  }
}, [periodoSeleccionado]);

  useEffect(() => {
    loadUserPermissions();
    fetchMeters();
    fetchPeriodosDisponibles();
  }, [fetchMeters]);

  // ============================================================
  // FUNCIONES DE FILTRADO Y ORDENAMIENTO
  // ============================================================

  const sectorOptions = useMemo(() => {
    const sectors = new Set();
    readings.forEach(reading => {
      const sector = String(reading.sector || '').trim();
      if (sector) sectors.add(sector);
    });
    return Array.from(sectors).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [readings]);

  const filteredReadings = readings.filter(reading => {
    const searchLower = searchTerm.toLowerCase();
    
    // 🔥 Cambios: usar campos directos en vez de reading.medidor?.campo
    const matchesSearch = 
      reading.num_medidor?.toLowerCase().includes(searchLower) ||
      reading.observacion?.toLowerCase().includes(searchLower) ||
      reading.id_lectura.toString().includes(searchTerm) ||
      reading.codigo_afiliado?.toString().toLowerCase().includes(searchLower) ||
      reading.nombre_afiliado?.toLowerCase().includes(searchLower);
    
    const matchesStatus = 
      filterStatus === 'all' || 
      (filterStatus === 'active' && reading.activo) || 
      (filterStatus === 'inactive' && !reading.activo);

    const matchesConsumo =
      filterConsumo === 'all' ||
      (filterConsumo === 'exceso' && reading.tiene_exceso) ||
      (filterConsumo === 'normal' && !reading.tiene_exceso);

    const matchesSector =
      filterSector === 'all' ||
      String(reading.sector || '').trim() === filterSector;
    
    return matchesSearch && matchesStatus && matchesConsumo && matchesSector;
  });


const sortedReadings = [...filteredReadings].sort((a, b) => {
  // PRIMERA PRIORIDAD: Lecturas estimadas siempre al final
  if (a.es_estimada !== b.es_estimada) {
    return a.es_estimada ? 1 : -1;
  }

  // SEGUNDA PRIORIDAD: Ordenamiento según la opción seleccionada
  let comparison = 0;
  
  if (sortOption === 'periodo') {
    comparison = getPeriodoConsumo(a).localeCompare(getPeriodoConsumo(b));
    if (comparison === 0) {
      comparison = new Date(a.fecha_lectura) - new Date(b.fecha_lectura);
    }
  } else if (sortOption === 'fecha') {
    comparison = new Date(a.fecha_lectura) - new Date(b.fecha_lectura);
  } else if (sortOption === 'medidor') {
    // 🔥 CAMBIO: usar campos planos
    const medidorA = a.num_medidor?.toLowerCase() || '';
    const medidorB = b.num_medidor?.toLowerCase() || '';
    comparison = medidorA.localeCompare(medidorB);
  } else if (sortOption === 'codigo') {
    const codigoA = String(a.codigo_afiliado || '');
    const codigoB = String(b.codigo_afiliado || '');
    comparison = codigoA.localeCompare(codigoB, 'es', { numeric: true, sensitivity: 'base' });
  } else if (sortOption === 'consumo') {
    comparison = a.consumo_m3 - b.consumo_m3;
  }
  
  return sortOrder === 'asc' ? comparison : -comparison;
});

  const totalPages = Math.max(1, Math.ceil(sortedReadings.length / pageSize));
  const normalizedCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (normalizedCurrentPage - 1) * pageSize;
  const pageEndIndex = pageStartIndex + pageSize;
  const paginatedReadings = sortedReadings.slice(pageStartIndex, pageEndIndex);
  const showingFrom = sortedReadings.length === 0 ? 0 : pageStartIndex + 1;
  const showingTo = Math.min(pageEndIndex, sortedReadings.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterConsumo, filterSector, sortOption, sortOrder, pageSize, periodoSeleccionado]);

  useEffect(() => {
    if (readings.length <= 100) {
      setShowSearchAdvice(false);
      return undefined;
    }

    setShowSearchAdvice(true);
    const timer = setTimeout(() => setShowSearchAdvice(false), 12000);
    return () => clearTimeout(timer);
  }, [readings.length, searchTerm, filterStatus, filterConsumo, filterSector, periodoSeleccionado]);

  const toggleSortOrder = () => {
    setSortOrder(prevOrder => prevOrder === 'asc' ? 'desc' : 'asc');
  };

  const handleStatusFilterClick = (status) => {
    setFilterStatus(status);
  };


  // ============================================================
  // FUNCIONES DE MODAL
  // ============================================================
  const openModal = async (type, reading = null) => {
    if (type === 'create' && !permissions.canCreate) {
      alert('❌ No tienes permiso para crear lecturas');
      return;
    }
    if (type === 'edit' && !permissions.canUpdate) {
      alert('❌ No tienes permiso para editar lecturas');
      return;
    }
    if (type === 'excel' && !permissions.canCreate) {
      alert('❌ No tienes permiso para crear lecturas');
      return;
    }

    setModalType(type);
    setSelectedReading(reading);
    setError(null);
    setMeterSearchTerm('');

    if (type === 'create') {
      setFormData({
        id_medidor: null,
        lectura_actual: '',
        lectura_anterior: '',
        consumo_m3: '',
        fecha_lectura: new Date().toISOString().split('T')[0],
        periodo_consumo: periodoSeleccionado
          ? `${periodoSeleccionado.anio}-${String(periodoSeleccionado.mes).padStart(2, '0')}`
          : '',
        observacion: '',
        activo: true,
      });
      setSelectedMeterInfo(null);
    }else if (type === 'edit' && reading) {
      setFormData({
        id_lectura: reading.id_lectura,
        id_medidor: reading.id_medidor,
        lectura_actual: reading.lectura_actual,
        lectura_anterior: reading.lectura_anterior,
        consumo_m3: reading.consumo_m3,
        fecha_lectura: reading.fecha_lectura,
        periodo_consumo: reading.periodo_consumo || '',
        observacion: reading.observacion || '',
        activo: reading.activo,
      });

      // 🔥 BUSCAR AFILIADO EN METERS PARA MOSTRAR INFO
      const afiliado = meters.find(m => m.id_medidor === reading.id_medidor);
      
      if (afiliado) {
        setSelectedMeterInfo(afiliado);
      } else {
        // 🔥 Si no está en meters, crear objeto con datos de la lectura
        setSelectedMeterInfo({
          id_medidor: reading.id_medidor,
          num_medidor: reading.num_medidor,
          cod_usuario_afi: reading.codigo_afiliado,
          nombre_completo: reading.nombre_afiliado,
          lectura_anterior: reading.lectura_anterior
        });
      }
    } else if (type === 'excel') {
      setExcelPreview([]);
      setExcelPreviewPage(0);
      setSelectedExcel(null);
      setLoadingExcel(false);

      if (periodoSeleccionado) {
        setExcelMesSeleccionado(periodoSeleccionado.mes.toString());
        setExcelAnioSeleccionado(periodoSeleccionado.anio.toString());
      } else if (periodoActual) {
        setExcelMesSeleccionado(periodoActual.mes.toString());
        setExcelAnioSeleccionado(periodoActual.anio.toString());
      }
    }

    setShowModal(true);
  };


  const closeModal = () => {
    setExcelPreview([]);
    setExcelPreviewPage(0);
    setSelectedExcel(null);
    setLoadingExcel(false);
    setShowModal(false);
    setSelectedReading(null);
    setError(null);
    setSelectedMeterInfo(null);
    setMeterSearchTerm('');
  };

  // ============================================================
  // MANEJO DE MEDIDOR
  // ============================================================
 
  const handleMedidorChange = async (id_medidor) => {
    if (!id_medidor) {
      setFormData(prev => ({ ...prev, id_medidor: null, lectura_anterior: '' }));
      setSelectedMeterInfo(null);
      return;
    }

    const medidor = meters.find(m => m.id_medidor === parseInt(id_medidor));

    if (medidor) {
      setSelectedMeterInfo(medidor);
  
      setFormData(prev => ({
        ...prev,
        id_medidor: parseInt(id_medidor),
        lectura_anterior: medidor.lectura_anterior ?? 0,   
        lectura_actual: '',
        consumo_m3: 0,
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        id_medidor: parseInt(id_medidor),
        lectura_anterior: 0,
      }));
    }
  };


  // ============================================================
  // FUNCIONES DE CRUD
  // ============================================================
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.id_medidor) {
      setError('Debe seleccionar un medidor');
      return;
    }

    if (parseInt(formData.lectura_actual) < parseInt(formData.lectura_anterior)) {
      setError('La lectura actual no puede ser menor que la lectura anterior');
      return;
    }

    try {
      let result;
      if (modalType === 'create') {
     
        const dataToSend = {
          ...formData,
          periodo_consumo: periodoSeleccionado
            ? `${periodoSeleccionado.anio}-${String(periodoSeleccionado.mes).padStart(2, '0')}`
            : formData.periodo_consumo,
        };
        
        result = await readingsServices.createLectura(dataToSend);
        
        if (result.success) {
          alert(`✅ Lectura creada exitosamente.\n\nMedidor: ${selectedMeterInfo?.num_medidor}\nConsumo: ${formData.consumo_m3} m³`);
          await fetchReadingsByPeriodo();
          await fetchPeriodosDisponibles();
          closeModal();
        } else {
          setError(result.message || 'Error al crear la lectura');
        }
      } else if (modalType === 'edit') {
      
        const dataToSend = {
          ...formData,
        };
        
        result = await readingsServices.updateLectura(selectedReading.id_lectura, dataToSend);
        
        if (result.success) {
          alert('✅ Cambios guardados correctamente');
          await fetchReadingsByPeriodo();
          await fetchPeriodosDisponibles();
          closeModal();
        } else {
          setError(result.message || 'Error al actualizar lectura');
        }
      }
    } catch (error) {
      setError(error.message || 'Error al guardar lectura');
    }
  };

  const handleDelete = async (readingId) => {
    if (!permissions.canDelete) {
      alert("❌ No tienes permiso para eliminar lecturas");
      return;
    }

    // ✅ Confirmación simple
    const confirmed = window.confirm("¿Estás seguro de que deseas eliminar esta lectura?");
    if (!confirmed) return; // Usuario canceló

    try {
      const result = await readingsServices.deleteLectura(readingId);

      if (result.success) {
        // 🎉 Éxito simple
        alert("Lectura Eliminada: " + result.message);
        closeModal();
        await fetchReadingsByPeriodo();
        await fetchPeriodosDisponibles();
      } else {
        alert("Error: " + result.message);
      }

    } catch (error) {
      alert("Error inesperado al eliminar lectura: " + error.message);
    }
  };



  // ============================================================
  // FUNCIONES DE EXCEL CON PERIODO
  // ============================================================
const handleDownloadTemplate = async () => {
  try {
    if (!periodoSeleccionado?.mes || !periodoSeleccionado?.anio) {
      alert('⚠️ Por favor selecciona un periodo');
      return;
    }
    
    setLoading(true);
    
    const result = await readingsServices.exportarPlantilla(
      periodoSeleccionado.mes,
      periodoSeleccionado.anio
    );
    
    if (result.success) {
      // Mensaje informativo según el caso
      if (result.message.includes('completas')) {
        alert(
          `ℹ️ ${result.message}\n\n` +
          `📊 Todas las lecturas del periodo ${periodoSeleccionado.mes}/${periodoSeleccionado.anio} están registradas.\n\n` +
          `💡 Opciones:\n` +
          `• Ver las lecturas existentes en la tabla\n` +
          `• Seleccionar otro periodo\n` +
          `• Descargar reporte de lecturas`
        );
      } else {
        alert(`✅ ${result.message}`);
      }
    } else {
      alert('❌ Error: ' + result.message);
    }
  } catch (error) {
    console.error('Error al descargar plantilla de lecturas:', error);
    alert('❌ Error al descargar plantilla');
  } finally {
    setLoading(false);
  }
};


  // funcion para normalizar las llaves del excel
  const normalizeKeys = (obj) => {
    const newObj = {};
    Object.keys(obj).forEach((key) => {
      const cleanKey = key
        .toString()
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "_")
        .replace(/[^\w]/g, "")
        .toLowerCase();
      newObj[cleanKey] = obj[key];
    });
    return newObj;
  };

  const pickExcelValue = (row, keys, fallback = "") => {
    for (const key of keys) {
      const value = row[key];
      if (value !== undefined && value !== null && value !== "") {
        return value;
      }
    }
    return fallback;
  };

  // funcion para previsualizar el excel
  const handleExcelPreview = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoadingExcel(true);
    setError(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true });

      const cleanedRows = rows.map((row) => {
        const r = normalizeKeys(row);
        return {
          num_medidor: pickExcelValue(r, ["num_medidor", "medidor", "numero_medidor", "n_medidor"]),
          sector: pickExcelValue(r, ["sector"]),
          codigo_afiliado: pickExcelValue(r, [
            "codigo_afiliado",
            "cod_usuario_afi",
            "codigo_usuarioafi",
            "codigo_usuarioafiliado",
            "codigo"
          ]),
          nombre_afiliado: pickExcelValue(r, [
            "nombre_afiliado",
            "nombre_usuarioafi",
            "nombre_usuarioafiliado",
            "nombre"
          ]),
          lectura_anterior: pickExcelValue(r, ["lectura_anterior", "lect_ant"], 0),
          lectura_actual: pickExcelValue(r, ["lectura_actual", "lect_act"]),
          observacion: pickExcelValue(r, ["observacion", "observaciones"])
        };
      });

      setExcelPreview(cleanedRows);
      setExcelPreviewPage(0);
      setSelectedExcel(file);
    } catch (error) {
      setError("Error al leer el archivo Excel");
      setExcelPreview([]);
      setExcelPreviewPage(0);
      setSelectedExcel(null);
    } finally {
      setLoadingExcel(false);
    }
  };

  // funcion para enviar el excel al backend
  const handleExcelUpload = async () => {
    if (excelPreview.length === 0) {
      setError("No hay datos para enviar");
      return;
    }

    if (!excelMesSeleccionado || !excelAnioSeleccionado) {
      setError("Debe seleccionar mes y año");
      return;
    }

    if (excelPreview.length > 500) {
      setError("Máximo 500 lecturas por carga");
      return;
    }


    // ⛔ VALIDACIÓN MEJORADA — ADVERTENCIA SI EL PERIODO NO COINCIDE
    const mesExcel = parseInt(excelMesSeleccionado);
    const anioExcel = parseInt(excelAnioSeleccionado);

    
    // Obtener mes/año actual del sistema
    const hoy = new Date();
    const mesActual = hoy.getMonth() + 1;
    const anioActual = hoy.getFullYear();

    let debeAdvertir = false;
    let mensajeAdvertencia = '';

    // CASO 1: Si hay un período seleccionado, verificar coincidencia
    if (periodoSeleccionado) {
      const mismoMes = mesExcel === periodoSeleccionado.mes;
      const mismoAnio = anioExcel === periodoSeleccionado.anio;

      if (!mismoMes || !mismoAnio) {
        debeAdvertir = true;
        mensajeAdvertencia = 
          `⚠️ ADVERTENCIA: PERÍODO NO COINCIDE\n\n` +
          `📁 Archivo Excel: ${readingsServices.formatearPeriodo(mesExcel, anioExcel)}\n` +
          `📍 Período actualmente seleccionado: ${readingsServices.formatearPeriodo(periodoSeleccionado.mes, periodoSeleccionado.anio)}\n\n` +
          `Las lecturas se cargarán para ${readingsServices.formatearPeriodo(mesExcel, anioExcel)}, ` +
          `NO para el período que está visualizando actualmente.\n\n` +
          `¿Está seguro que desea continuar?`;
      }
    } 
    // CASO 2: No hay período seleccionado, pero el Excel no es del mes actual
    else {
      const esMesActual = mesExcel === mesActual && anioExcel === anioActual;
      
      if (!esMesActual) {
        debeAdvertir = true;
        
        // Calcular si es mes futuro o pasado
        const fechaExcel = new Date(anioExcel, mesExcel - 1);
        const fechaActual = new Date(anioActual, mesActual - 1);
        const esFuturo = fechaExcel > fechaActual;
        
        mensajeAdvertencia = 
          `⚠️ ADVERTENCIA: PERÍODO ${esFuturo ? 'FUTURO' : 'ANTERIOR'}\n\n` +
          `📁 Archivo Excel: ${readingsServices.formatearPeriodo(mesExcel, anioExcel)}\n` +
          `📅 Mes actual del sistema: ${readingsServices.formatearPeriodo(mesActual, anioActual)}\n\n` +
          `Está cargando lecturas para un período ${esFuturo ? 'futuro' : 'anterior'} al mes actual.\n\n` +
          `¿Está seguro que desea continuar?`;
      }
    }

    // Mostrar advertencia si es necesario
    if (debeAdvertir) {
      const confirmar = window.confirm(mensajeAdvertencia);
      if (!confirmar) {
        return;
      }
    }

    setLoadingExcel(true);
    setError(null);

    try {
      const result = await readingsServices.importarExcelConPeriodo(
        selectedExcel,
        mesExcel,
        anioExcel,
      );

      if (result.success) {
        const { exitosos, fallidos, total_procesados } = result.data;

        let mensaje = `📊 RESULTADO DE LA IMPORTACIÓN\n`;
        mensaje += `Periodo: ${readingsServices.formatearPeriodo(mesExcel, anioExcel)}\n`;
        mensaje += `${'='.repeat(60)}\n\n`;
        mensaje += `✅ Lecturas creadas: ${exitosos.length}/${total_procesados}\n`;
        mensaje += `❌ Errores: ${fallidos.length}/${total_procesados}\n\n`;

        if (exitosos.length > 0) {
          mensaje += `${'='.repeat(60)}\n`;
          mensaje += `📋 LECTURAS CREADAS:\n`;
          mensaje += `${'='.repeat(60)}\n\n`;

          exitosos.slice(0, 10).forEach((l, idx) => {
            mensaje += `${idx + 1}. Medidor: ${l.num_medidor} - Consumo: ${l.consumo_m3} m³\n`;
          });

          if (exitosos.length > 10) {
            mensaje += `\n... y ${exitosos.length - 10} más\n`;
          }
        }

        if (fallidos.length > 0) {
          mensaje += `\n${'='.repeat(60)}\n`;
          mensaje += `❌ ERRORES:\n`;
          mensaje += `${'='.repeat(60)}\n\n`;

          fallidos.slice(0, 5).forEach((f, idx) => {
            mensaje += `${idx + 1}. Fila ${f.fila}: ${f.error}\n`;
          });

          if (fallidos.length > 5) {
            mensaje += `\n... y ${fallidos.length - 5} errores más\n`;
          }
        }

        alert(mensaje);
        closeModal();
        
        // Recargar datos del período correspondiente
        await fetchPeriodosDisponibles();
        
        // Cambiar automáticamente al período donde se cargaron las lecturas
        setPeriodoSeleccionado({
          mes: mesExcel,
          anio: anioExcel
        });
        
      } else {
        setError(result.message || "Error al procesar lecturas");
      }
    } catch (error) {
      console.error('Error al importar lecturas desde Excel:', error);
      setError(error.message || "Error al enviar lecturas");
    } finally {
      setLoadingExcel(false);
    }
  };



  // ============================================================
  // RENDERIZADO - ESTADOS DE CARGA Y ERROR
  // ============================================================
  if (!permissions.canRead) {
    return (
      <div className="affiliates-section readings-section">
        <div className="empty-state">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h3>Sin Acceso</h3>
          <p>No tienes permiso para acceder al módulo de lecturas.</p>
        </div>
      </div>
    );
  }

  if (loadingPeriodos) {
    return (
      <div className="affiliates-section readings-section">
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
  <div className="affiliates-section readings-section">
    
    {/* ==================== PASO 1: SELECCIÓN DE PERIODO ==================== */}
    {/* Parte 1: SELECCIÓN DE PERIODO */}
    {!periodoSeleccionado && (
      <div className="periodo-selection-page">
        <div className="section-header">
          <div className="section-title">
            <BookOpen className="w-7 h-7 text-blue-600" />
            <div>
              <h2>Gestión de lecturas </h2>
              <p className="section-subtitle">
                Gestiona la lecturas de los afiliado
              </p>
            </div>
          </div>
        </div>

        {/* SECCIÓN 1: PERÍODOS RECIENTES (Mes actual ± 2 meses) */}
        <div className="periodo-selector-container">
          <div className="periodo-selector-header">
            <div>
              <h3>
                <CalendarDays className="w-5 h-5 text-blue-600 mr-2" />
                Períodos Recientes</h3>
              <p className="periodo-selector-subtitle">
                Selecciona el período actual o próximo para cargar lecturas
              </p>
            </div>
          </div>

          <div className="periodos-grid">
            {(() => {
              // Filtrar solo períodos recientes: mes actual ± 2 meses
              const hoy = new Date();
              const mesActual = hoy.getMonth() + 1;
              const anioActual = hoy.getFullYear();
              
              // Función para calcular diferencia de meses
              const calcularDiferenciaMeses = (mes, anio) => {
                return (anio - anioActual) * 12 + (mes - mesActual);
              };
              
              const periodosRecientes = periodos
                .filter(periodo => {
                  const diff = calcularDiferenciaMeses(periodo.mes, periodo.anio);
                  return diff >= -2 && diff <= 2; // ± 2 meses
                })
                .sort((a, b) => {
                  // Ordenar de más reciente a más antiguo
                  if (a.anio !== b.anio) return b.anio - a.anio;
                  return b.mes - a.mes;
                });

              return periodosRecientes.map(periodo => {
                const porcentaje = getPorcentajeCompletado(periodo);
                const esCompleto = porcentaje >= 100;
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
                      {periodo.sugerido && !esMesActual && (
                        <span className="periodo-badge-sugerido">Sugerido</span>
                      )}
                    </div>

                    <div className="periodo-card-info">
                      {periodo.total_lecturas} / {periodo.total_medidores} lecturas
                    </div>

                    <div className="periodo-progress-bar">
                      <div
                        className={`periodo-progress-fill ${esCompleto ? 'complete' : ''}`}
                        style={{ width: `${porcentaje}%` }}
                      />
                    </div>

                    <div className={`periodo-percentage ${esCompleto ? 'complete' : ''}`}>
                      {porcentaje.toFixed(0)}% completado
                    </div>

                    <div className="periodo-card-action">
                      <span>{esCompleto ? 'Ver lecturas' : 'Cargar lecturas'}</span>
                    </div>
                  </button>
                );
              });
            })()}
          </div>
        </div>
        
        {/* SECCIÓN 2: HISTORIAL DE PERÍODOS CON LECTURAS */}
        <div className="periodo-historial-container">
        
          {/* ENCABEZADO */}
          <div className="periodo-historial-header">
            <div>
              <h3 className="font-semibold text-[16px] leading-[1.2] flex items-center">
                <Clock className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0" />
                Historial de Períodos
              </h3>
              <p className="periodo-historial-subtitle text-[14px]">
                Períodos anteriores con lecturas registradas
              </p>
            </div>
          </div>
        
          {(() => {
            const hoy = new Date();
            const mesActual = hoy.getMonth() + 1;
            const anioActual = hoy.getFullYear();
        
            const calcularDiferenciaMeses = (mes, anio) =>
              (anio - anioActual) * 12 + (mes - mesActual);
        
            // 1. Filtrar solo periodos históricos con lecturas
            const periodosHistorial = periodos.filter(periodo => {
              const diff = calcularDiferenciaMeses(periodo.mes, periodo.anio);
              return diff < -2 && periodo.tiene_lecturas;
            });
        
            if (periodosHistorial.length === 0) {
              return (
                <div className="periodo-historial-empty">
                  <AlertCircle className="w-12 h-12 text-gray-300 mb-2" />
                  <p>No hay períodos anteriores con lecturas registradas</p>
                </div>
              );
            }
        
            // 2. Agrupar por año
            const agrupado = periodosHistorial.reduce((acc, periodo) => {
              const anio = periodo.anio;
              if (!acc[anio]) acc[anio] = [];
              acc[anio].push(periodo);
              return acc;
            }, {});
        
            // 3. Ordenar años de mayor a menor
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
                  const estaExpandido = aniosExpandidos[anio] !== false; // expandido por defecto
                  const totalCompletos = mesesDelAnio.filter(
                    p => getPorcentajeCompletado(p) >= 100
                  ).length;
        
                  return (
                    <div key={anio} className="historial-anio-bloque">
        
                      {/* CABECERA DEL AÑO — clic para colapsar */}
                      <button
                        className="historial-anio-header"
                        onClick={() => toggleAnio(anio)}
                      >
                        <span className="historial-anio-label">
                          <Calendar className="w-4 h-4" />
                          {anio}
                          <span className="historial-anio-badge">
                            {mesesDelAnio.length} periodos · {totalCompletos} completos
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
                            const porcentaje = getPorcentajeCompletado(periodo);
                            const esCompleto = porcentaje >= 100;
        
                            return (
                              <button
                                key={`${periodo.mes}-${periodo.anio}`}
                                className={`historial-mes-chip ${esCompleto ? 'completo' : 'incompleto'}`}
                                onClick={() => handlePeriodoChange(periodo.mes, periodo.anio)}
                                title={`${periodo.total_lecturas} / ${periodo.total_medidores} lecturas`}
                              >
                                <span className={`historial-mes-dot ${esCompleto ? 'completo' : 'incompleto'}`} />
                                <span className="historial-mes-nombre">
                                  {nombresMeses[periodo.mes]}
                                </span>
                                <span className="historial-mes-pct">
                                  {esCompleto ? '✓' : `${porcentaje.toFixed(0)}%`}
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

    {/* ==================== PASO 2: GESTIÓN DE LECTURAS DEL PERIODO ==================== */}
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
              <BookOpen className="w-7 h-7 text-blue-600" />
              <div>
                <h2>Lecturas de {readingsServices.formatearPeriodo(periodoSeleccionado.mes, periodoSeleccionado.anio)}</h2>
                <p className="section-subtitle">
                  Gestiona las lecturas de este periodo
                </p>
              </div>
            </div>
          </div>

          <div className="actions">
            {permissions.canCreate && (
              <>
                <button className="btn-primary" onClick={() => openModal('create')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nueva Lectura
                </button>

                <button className="btn-primary" onClick={() => openModal('excel')}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Crear desde Excel
                </button>
                {/*boton para generar lecturas estimadas*/}
                <button 
                    className="btn-primary"
                    onClick={handleGenerarEstimadas}
                    disabled={loadingEstimadas}
                    title="Generar lecturas estimadas para medidores sin lectura"
                >
                    {loadingEstimadas ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                        <TrendingUp className="w-4 h-4 mr-2" />
                    )}
                    Generar Estimadas
                </button>
              </>
            )}
          </div>
        </div>
        {/* ESTADÍSTICAS DEL PERIODO */}
        <div className="periodo-stats-container">
          <div className="periodo-stats-header">
            <Clock className="w-5 h-5 text-blue-600 mr-2" />
            <h3>Resumen del Periodo</h3>
          </div>

          <div className="users-stats">
            <div className="stat-item">
              <BookOpen className="stat-icon text-blue-600" />
              <div>
                <p className="stat-label">Total Lecturas</p>
                <p className="stat-value">{readings.length}</p>
              </div>
            </div>

            <div className="stat-item">
              <CheckCircle className="stat-icon text-green-600" />
              <div>
                <p className="stat-label">Activas</p>
                <p className="stat-value">{readings.filter(r => r.activo).length}</p>
              </div>
            </div>

            <div className="stat-item">
              <XCircle className="stat-icon text-red-600" />
              <div>
                <p className="stat-label">Inactivas</p>
                <p className="stat-value">{readings.filter(r => !r.activo).length}</p>
              </div>
            </div>

            <div className="stat-item">
              <TrendingUp className="stat-icon text-purple-600" />
              <div>
                <p className="stat-label">Consumo Total (m³)</p>
                <p className="stat-value">
                  {readings.reduce((sum, r) => sum + (r.consumo_m3 || 0), 0)}
                </p>
              </div>
            </div>

            {/* 🆕 CARD 1: LECTURAS PENDIENTES */}
            {(() => {
              const periodoActualData = periodos.find(
                p => p.mes === periodoSeleccionado.mes && p.anio === periodoSeleccionado.anio
              );
              
              if (!periodoActualData) return null;
              
              const totalLecturas = periodoActualData.total_lecturas || 0;
              const totalMedidores = periodoActualData.total_medidores || 0;
              const pendientes = totalMedidores - totalLecturas;
              
              return (
                <div className={`stat-item ${pendientes === 0 ? 'stat-complete' : 'stat-pending'}`}>
                  {pendientes === 0 ? (
                    <CheckCircle className="stat-icon text-green-600" />
                  ) : (
                    <AlertCircle className="stat-icon text-orange-600" />
                  )}
                  <div>
                    <p className="stat-label">Lecturas Pendientes</p>
                    <p className="stat-value">{pendientes}</p>
                    {pendientes === 0 && (
                      <span className="stat-badge success">✓ Completo</span>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* 🆕 CARD 2: PORCENTAJE DE AVANCE */}
            {(() => {
              const periodoActualData = periodos.find(
                p => p.mes === periodoSeleccionado.mes && p.anio === periodoSeleccionado.anio
              );
              
              if (!periodoActualData) return null;
              
              const porcentaje = getPorcentajeCompletado(periodoActualData);
              const esCompleto = porcentaje >= 100;
              
              return (
                <div className={`stat-item ${esCompleto ? 'stat-complete' : ''}`}>
                  <Activity className={`stat-icon ${esCompleto ? 'text-green-600' : 'text-blue-600'}`} />
                  <div>
                    <p className="stat-label">Progreso del Periodo</p>
                    <p className="stat-value">{porcentaje.toFixed(0)}%</p>
                    <div className="stat-progress-bar">
                      <div 
                        className={`stat-progress-fill ${esCompleto ? 'complete' : ''}`}
                        style={{ width: `${porcentaje}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* BARRA DE BÚSQUEDA Y FILTROS */}
        <div className="filters-section">
          <div className="search-container">
            <Search className="search-icon" />
            <input
              type="text"
              placeholder="Buscar por medidor, código, nombre..."
              className="search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="filters-right">
            {/* NUEVO FILTRO DE ESTADOS */}
            <select
              className="filter-select"
              value={filterStatus}
              onChange={(e) => handleStatusFilterClick(e.target.value)}
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
            <select
              className="filter-select"
              value={filterConsumo}
              onChange={(e) => setFilterConsumo(e.target.value)}
            >
              <option value="all">Todos los consumos</option>
              <option value="exceso">Con exceso</option>
              <option value="normal">Consumo normal</option>
            </select>
            <select
              className="filter-select"
              value={filterSector}
              onChange={(e) => setFilterSector(e.target.value)}
            >
              <option value="all">Todos los sectores</option>
              {sectorOptions.map(sector => (
                <option key={sector} value={sector}>
                  {sector}
                </option>
              ))}
            </select>
            <select
              className="filter-select"
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value)}
            >
              <option value="periodo">Ordenar por Periodo de consumo</option>
              <option value="fecha">Ordenar por Fecha de lectura</option>
              <option value="medidor">Ordenar por Medidor</option>
              <option value="codigo">Ordenar por Codigo afiliado</option>
              <option value="consumo">Ordenar por Consumo</option>
            </select>

            <select
              className="filter-select page-size-select"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              title="Lecturas por página"
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
              onClick={fetchReadingsByPeriodo} 
              title="Recargar"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {readings.length > 100 && showSearchAdvice && (
          <div className="readings-search-advice">
            <AlertCircle className="w-4 h-4" />
            <span>
              Hay {readings.length} lecturas cargadas en este período. Para listas grandes, busca por medidor, código, nombre o usa los filtros para encontrar el registro más rápido.
            </span>
          </div>
        )}

        <div className="readings-list-summary">
          <span>
            Mostrando {showingFrom}-{showingTo} de {sortedReadings.length} lectura{sortedReadings.length !== 1 ? 's' : ''}
          </span>
          {searchTerm.trim() && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => setSearchTerm('')}
            >
              Limpiar búsqueda
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

        {estimatedReadingsCount > 0 && (
          <div className="alert alert-warning mb-4">
            <AlertCircle className="alert-icon w-5 h-5" />
            <div className="alert-content">
              <p className="alert-title">Lecturas estimadas pendientes</p>
              <p className="alert-message">
                Hay {estimatedReadingsCount} lectura{estimatedReadingsCount === 1 ? '' : 's'} estimada{estimatedReadingsCount === 1 ? '' : 's'} en la tabla. Debe confirmarlas para continuar con la facturación y demás acciones del periodo.
              </p>
            </div>
          </div>
        )}

        {/* INDICADOR DE CARGA */}
        {loading && (
          <div className="empty-state">
            <RefreshCw className="w-12 h-12 text-blue-400 mx-auto mb-4 animate-spin" />
            <h3>Cargando lecturas...</h3>
          </div>
        )}

        {/* ✅ MODAL DE RESULTADOS DE ESTIMADAS */}
        {showEstimadasModal && estimadasResult && (
          <div className="modal-overlay">
            <div className="modal">

              {/* HEADER */}
              <div className="modal-header">
                <h3>Lecturas Estimadas Generadas</h3>
                <button className="modal-close" onClick={() => setShowEstimadasModal(false)}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* BODY */}
              <div className="modal-body"> 
                <div className="alert alert-info mb-4"> 
                  <TrendingUp className="w-5 h-5 mr-2" /> 
                  <div> 
                    <strong>Periodo:</strong> {estimadasResult.periodo}<br /> 
                    <strong>Lecturas generadas:</strong> {estimadasResult.lecturas_generadas}<br /> 
                    <strong>Fallidas:</strong> {estimadasResult.lecturas_fallidas} 
                  </div> 
                </div>

                {/* DETALLES CORRECTOS */}
                {estimadasResult.detalles?.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Lecturas generadas correctamente:</h4>

                    <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                      <table className="excel-preview-table">
                        <thead>
                          <tr>
                            <th>Medidor</th>
                            <th>Afiliado</th>
                            <th className="align-right">Lect. Ant.</th>
                            <th className="align-right">Lect. Est.</th>
                            <th className="align-right">Consumo</th>
                          </tr>
                        </thead>

                        <tbody>
                          {estimadasResult.detalles.map((det, idx) => (
                            <tr key={idx}>
                              <td>{det.medidor}</td>
                              <td className="text-small">{det.nombre_afiliado}</td>
                              <td className="align-right">{det.lectura_anterior} m³</td>
                              <td className="align-right text-success">{det.lectura_estimada} m³</td>
                              <td className="align-right text-bold">{det.consumo_estimado} m³</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* DETALLES FALLIDOS */}
                {estimadasResult.fallidas?.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-semibold mb-2 text-red-600">Medidores sin generar:</h4>

                    <ul className="ml-4 space-y-1">
                      {estimadasResult.fallidas.slice(0, 5).map((fal, idx) => (
                        <li key={idx} className="text-small">
                          <strong>{fal.medidor}:</strong> {fal.razon}
                        </li>
                      ))}

                      {estimadasResult.fallidas.length > 5 && (
                        <li className="text-muted">
                          ... y {estimadasResult.fallidas.length - 5} más
                        </li>
                      )}
                    </ul>
                  </div>
                )}

              </div>

              {/* FOOTER */}
              <div className="form-actions"
                style={{
                  display: "flex",
                  justifyContent: "flex-end",  
                  alignItems: "center",
                  gap: "12px",
                  padding: "16px 20px",
                  borderTop: "1px solid rgba(0,0,0,0.08)",
                }}
              >
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setShowEstimadasModal(false)}
                >
                  Aceptar
                </button>
              </div>

            </div>
          </div>
        )}


        {/* LISTA DE LECTURAS */}
        {!loading && (
          <div className="readings-list-container">
            <div className="readings-list-header">
              <span>#</span>
              <span><Gauge className="w-4 h-4" /> Medidor</span>
              <span>Código Afi</span>
              <span><User className="w-4 h-4" /> Nombre Afi</span>
              <span><MapPin className="w-4 h-4" /> Sector</span>
              <span>Lect. Ant.</span>
              <span>Lect. Act.</span>
              <span>Consumo</span>
              <span> Fecha Lectura</span>
              <span>Estado</span>
              <span>Acciones</span>
            </div>


            <div className="readings-list-body">
              {sortedReadings.length > 0 ? (
                paginatedReadings.map((reading, index) => {
                  const consumoClass = reading.tiene_exceso
                    ? 'alto'
                    : reading.consumo_m3 > 100
                      ? 'alto'
                      : reading.consumo_m3 > 50
                        ? 'medio'
                        : '';
                  return (
                    <div 
                      key={reading.id_lectura} 
                      className={`readings-list-item ${!reading.activo ? 'inactive' : ''} ${reading.es_estimada ? 'estimated' : ''}`}
                    >
                      <div className="list-col-id">{pageStartIndex + index + 1}</div>

                      <div className="list-col-medidor">
                        <div className="medidor-icon">
                          <Gauge className="w-4 h-4" />
                        </div>
                        <span className="medidor-numero">
                          {reading.num_medidor || 'N/A'}
                        </span>
                      </div>

                      <div className={`list-col-codigo ${!reading.codigo_afiliado ? 'empty' : ''}`}>
                        {reading.codigo_afiliado || '---'}
                      </div>

                      <div className={`list-col-nombre ${!reading.nombre_afiliado ? 'empty' : ''}`}>
                        <User className="w-4 h-4" />
                        {reading.nombre_afiliado || 'No registrado'}
                      </div>

                      <div className={`list-col-sector ${!reading.sector ? 'empty' : ''}`}>
                        <MapPin className="w-4 h-4" />
                        {reading.sector || 'Sin sector'}
                      </div>

                      <div className="list-col-lectura">
                        {reading.lectura_anterior}<span className="unidad">m³</span>
                      </div>

                      <div className="list-col-lectura">
                        {reading.lectura_actual}<span className="unidad">m³</span>
                      </div>

                      <div
                        className={`list-col-consumo ${consumoClass}`}
                        title={reading.observacion_exceso || undefined}
                      >
                        {reading.consumo_m3} m³
                      </div>

                      <div className="list-col-fecha">
                        <Calendar className="w-4 h-4" />
                        {formatFechaLectura(reading.fecha_lectura)}
                      </div>

                      <div className="status-wrapper">
                        {reading.es_estimada ? (
                          <span 
                            className={`list-status-badge combined ${reading.activo ? 'active' : 'inactive'}`}
                            title={`${reading.activo ? 'Activo' : 'Inactivo'} - Estimada`}
                          >
                            {reading.activo ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                            <TrendingUp className="w-4 h-4" />
                          </span>
                        ) : (
                          <span className={`list-status-badge ${reading.activo ? 'active' : 'inactive'}`}>
                            {reading.activo ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                          </span>
                        )}
                      </div>

                      <div className="list-actions">
                        <button 
                          className="list-action-btn view" 
                          onClick={() => openModal('view', reading)} 
                          title="Ver detalles"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {permissions.canUpdate && !reading.es_estimada && (
                          <button 
                            className="list-action-btn edit" 
                            onClick={() => openModal('edit', reading)} 
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}

                        {permissions.canUpdate && reading.es_estimada && (
                          <button 
                            className="list-action-btn confirm" 
                            onClick={() => handleConfirmarEstimada(reading)} 
                            title="Confirmar lectura estimada"
                            disabled={loading}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="readings-list-empty">
                  <BookOpen />
                  <h3>No hay lecturas en este periodo</h3>
                  <p>
                    No se encontraron lecturas para {readingsServices.formatearPeriodo(periodoSeleccionado.mes, periodoSeleccionado.anio)}
                  </p>
                </div>
              )}
            </div>

            {/* 🔥 FOOTER ACTUALIZADO CON NOMBRE DEL LECTOR */}
            {sortedReadings.length > 0 && (
              <div className="readings-list-footer">
                <button 
                  className="btn-secondary"
                  onClick={() => setPeriodoSeleccionado(null)}
                >
                  <ArrowUpDown className="w-4 h-4 mr-2" style={{ transform: 'rotate(90deg)' }} />
                  Cambiar periodo
                </button>

                {sortedReadings.some(r => r.es_estimada) && permissions.canUpdate && (
                  <button 
                    className="btn-primary"
                    onClick={handleConfirmarTodas}
                    title="Confirmar todas las lecturas estimadas"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Confirmar lecturas estimadas ({sortedReadings.filter(r => r.es_estimada).length})
                  </button>
                )}
                
                <div className="readings-list-footer-stats">
                  <span>
                    Mostrando <strong>{showingFrom}-{showingTo}</strong> de <strong>{sortedReadings.length}</strong> lecturas
                  </span>
                  <span>
                    Consumo total: <strong>{sortedReadings.reduce((sum, r) => sum + (r.consumo_m3 || 0), 0)} m³</strong>
                  </span>
                  {/* 🔥 MOSTRAR NOMBRE DEL LECTOR */}
                  {sortedReadings.length > 0 && sortedReadings[0].lector_nombre && sortedReadings[0].lector_nombre !== 'No registrado' && (
                    <span>
                      <User className="w-4 h-4 inline mr-1" />
                      Lecturas tomadas por: <strong>{sortedReadings[0].lector_nombre}</strong>
                    </span>
                  )}
                </div>
              </div>
            )}

            {sortedReadings.length > 0 && (
              <div className="readings-pagination-controls">
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
                  Página {normalizedCurrentPage} de {totalPages}
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

    {/* ==================== MODALES ==================== */}
    {showModal && (
      <div className="modal-overlay">
        <div className={`modal ${modalType === 'excel' ? 'modal-excel' : ''}`}>
          <div className="modal-header">
            <h3>
              {modalType === 'create' && 'Crear Nueva Lectura'}
              {modalType === 'edit' && 'Editar Lectura'}
              {modalType === 'view' && 'Detalles de la Lectura'}
              {modalType === 'excel' && 'Importar Lecturas desde Excel'}
            </h3>
            <button className="modal-close" onClick={closeModal}>
              <X className="w-5 h-5" />
            </button>
          </div>


          <div className="modal-body">
            {error && (
              <div className="alert alert-error mb-4">
                <AlertCircle className="w-5 h-5 mr-2" />
                {error}
              </div>
            )}

            {/* ==================== MODAL DE EXCEL  ==================== */}
            {modalType === 'excel' && (
              <div className="user-form">
                <div className="form-grid">
                  
                  {/* Selección de Periodo */}
                  <div className="form-group form-group-full">
                    <div className="excel-periodo-selector">
                      <label className="excel-periodo-label">
                        📅 Seleccionar Periodo para las Lecturas *
                      </label>
                      
                      <div className="excel-periodo-grid">
                        <div className="excel-periodo-field">
                          <label>Mes:</label>
                          <select
                            required
                            value={excelMesSeleccionado}
                            onChange={(e) => setExcelMesSeleccionado(e.target.value)}
                          >
                            <option value="">Seleccione mes</option>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(mes => (
                              <option key={mes} value={mes}>
                                {readingsServices.getNombreMes(mes)}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="excel-periodo-field">
                          <label>Año:</label>
                          <select
                            required
                            value={excelAnioSeleccionado}
                            onChange={(e) => setExcelAnioSeleccionado(e.target.value)}
                          >
                            <option value="">Seleccione año</option>
                            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 + i).map(anio => (
                              <option key={anio} value={anio}>{anio}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {excelMesSeleccionado && excelAnioSeleccionado && (
                        <div className="excel-periodo-selected">
                          ✓ Periodo seleccionado: {readingsServices.formatearPeriodo(
                            parseInt(excelMesSeleccionado), 
                            parseInt(excelAnioSeleccionado)
                          )}
                        </div>
                      )}

                      <small className="excel-periodo-warning">
                        ⚠️ Las lecturas se registrarán para el periodo seleccionado. 
                        No se pueden duplicar lecturas en el mismo periodo.
                      </small>
                    </div>
                  </div>

                  {/* Descargar Plantilla */}
                  <div className="form-group form-group-full">
                    <button
                      type="button"
                      className="btn-plantilla"
                      onClick={handleDownloadTemplate}
                      disabled={!periodoSeleccionado || loading}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      {loading ? 'Generando...' : 'Descargar plantilla Excel'}
                    </button>
                    <small className="text-gray-500 mt-1">
                      {periodoSeleccionado 
                        ? `📅 Periodo: ${periodoSeleccionado.mes}/${periodoSeleccionado.anio} - Solo medidores sin lectura en este periodo`
                        : '⚠️ Selecciona un periodo primero'
                      }
                    </small>
                  </div>


                  {/* Seleccionar Archivo */}
                  <div className="form-group form-group-full">
                    <label>Seleccionar archivo Excel *</label>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleExcelPreview}
                      className="file-input"
                    />
                    <small className="text-gray-500 mt-1">
                      📋 Formato: Excel (.xlsx, .xls) con las columnas de la plantilla
                    </small>
                  </div>

                  {/* Archivo Seleccionado */}
                  {selectedExcel && (
                    <div className="form-group form-group-full">
                      <div className="alert alert-info">
                        <AlertCircle className="w-5 h-5 mr-2" />
                        <div>
                          <strong>Archivo:</strong> {selectedExcel.name}
                          <br />
                          <small>Tamaño: {(selectedExcel.size / 1024).toFixed(2)} KB</small>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Vista Previa */}
                  {excelPreview.length > 0 && (
                    <div className="form-group form-group-full">
                      <label>
                        📊 Vista previa ({excelPreview.length} lecturas)
                        <ul className="ml-4 space-y-1">
                          <li className="text-green-600">✓ {excelValidCount} válidas</li>
                          {excelInvalidCount > 0 && (
                            <li className="text-red-600">⚠️ {excelInvalidCount} inválidas (serán omitidas)</li>
                          )}
                          {currentExcelPreviewPage && (
                            <li className="text-gray-500">
                              Mostrando {currentExcelPreviewPage.start + 1}-{currentExcelPreviewPage.end} de {excelPreview.length}
                            </li>
                          )}
                        </ul>
                      </label>

                      <div className="excel-preview-container">
                        <table className="excel-preview-table">
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>Medidor</th>
                              <th>Código Afiliado</th> 
                              <th>Nombre</th>
                              <th className="align-right">Lect. Ant.</th>
                              <th className="align-right">Lect. Act.</th>
                              <th className="align-right">Consumo</th>
                              <th className="align-center">Estado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(currentExcelPreviewPage?.items || []).map((lectura, idx) => {
                              const rowNumber = (currentExcelPreviewPage?.start || 0) + idx + 1;
                              // ✅ Validación mejorada con regex para números
                              const esNumerico = /^\d{1,13}$/.test(lectura.lectura_actual);
                              const esValido = isValidExcelReading(lectura);
                              
                              const consumo = esValido 
                                ? parseInt(lectura.lectura_actual) - parseInt(lectura.lectura_anterior || 0)
                                : 0;

                              // Determinar error específico
                              let errorMsg = '';
                              if (!lectura.num_medidor) errorMsg = 'Sin medidor';
                              else if (!lectura.lectura_actual) errorMsg = 'Sin lectura';
                              else if (!esNumerico) errorMsg = 'Solo números (máx 13 dígitos)';
                              else if (parseInt(lectura.lectura_actual) < parseInt(lectura.lectura_anterior || 0)) 
                                errorMsg = 'Lectura menor que anterior';
                              errorMsg = getExcelReadingError(lectura);

                              return (
                                <tr key={rowNumber} className={!esValido ? 'invalid' : ''}>
                                  <td className="text-muted">{rowNumber}</td>
                                  <td>
                                    {lectura.num_medidor || <span className="excel-preview-error">❌ Falta</span>}
                                  </td>
                                  {/* ✅ Nueva columna código afiliado */}
                                  <td className="text-small">
                                    {lectura.codigo_afiliado || '-'}
                                  </td>
                                  <td className="text-small">
                                    {lectura.nombre_afiliado || '-'}
                                  </td>
                                  <td className="align-right">
                                    {lectura.lectura_anterior || 0}
                                  </td>
                                  <td className="align-right">
                                    {lectura.lectura_actual ? (
                                      esNumerico ? (
                                        lectura.lectura_actual
                                      ) : (
                                        <span className="excel-preview-error" title={errorMsg}>
                                          ❌ {lectura.lectura_actual}
                                        </span>
                                      )
                                    ) : (
                                      <span className="excel-preview-error">❌</span>
                                    )}
                                  </td>
                                  <td className="align-right text-bold text-success">
                                    {consumo} m³
                                  </td>
                                  <td className="align-center">
                                    {esValido ? (
                                      <span className="excel-preview-success" title="Válido">✓</span>
                                    ) : (
                                      <span className="excel-preview-error" title={errorMsg}>✗</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {excelPreviewPages.length > 1 && (
                        <div className="excel-preview-pagination">
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setExcelPreviewPage(page => Math.max(0, page - 1))}
                            disabled={excelPreviewPage === 0}
                          >
                            Anterior
                          </button>
                          <span>
                            Página {excelPreviewPage + 1} de {excelPreviewPages.length}
                          </span>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setExcelPreviewPage(page => Math.min(excelPreviewPages.length - 1, page + 1))}
                            disabled={excelPreviewPage >= excelPreviewPages.length - 1}
                          >
                            Siguiente
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  
                </div>

                <div className="form-actions">
                  <button type="button" className="btn-secondary" onClick={closeModal}>
                    <X className="w-4 h-4 mr-2" />
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleExcelUpload}
                    disabled={
                      !excelMesSeleccionado || 
                      !excelAnioSeleccionado ||
                      excelPreview.length === 0 ||
                      excelValidCount === 0 ||
                      excelValidCount > 500 ||
                      loadingExcel
                    }
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {loadingExcel 
                      ? 'Procesando...' 
                      : `Crear ${excelValidCount} lectura${excelValidCount !== 1 ? 's' : ''} válida${excelValidCount !== 1 ? 's' : ''}`
                    }
                  </button>
                </div>
              </div>
            )}

            {/* ==================== MODAL DE VISTA ==================== */}
            {modalType === 'view' && selectedReading && (
              <div className="user-details">

                {/* Medidor */}
                <div className="detail-group">
                  <label>Medidor:</label>
                  <p>{selectedReading.num_medidor || 'N/A'}</p>
                </div>

                {/* 🔥 SECTOR */}
                <div className="detail-group">
                  <label>Sector:</label>
                  <p>{selectedReading.sector || 'Sin sector'}</p>
                </div>

                {/* Código de Afiliado */}
                <div className="detail-group">
                  <label>Código de Afiliado:</label>
                  <p>{selectedReading.codigo_afiliado || 'N/A'}</p>
                </div>

                {/* Nombre Afiliado */}
                <div className="detail-group">
                  <label>Nombre Afiliado:</label>
                  <p>{selectedReading.nombre_afiliado || 'Sin afiliado'}</p>
                </div>

                {/* Lecturas */}
                <div className="detail-group">
                  <label>Lectura Anterior:</label>
                  <p>{selectedReading.lectura_anterior} m³</p>
                </div>

                <div className="detail-group">
                  <label>Lectura Actual:</label>
                  <p>{selectedReading.lectura_actual} m³</p>
                </div>

                {/* Consumo */}
                <div className="detail-group">
                  <label>Consumo:</label>
                  <p className="text-green-700 font-semibold">{selectedReading.consumo_m3} m³</p>
                </div>

                {/* Periodo de consumo */}
                <div className="detail-group">
                  <label>Periodo consumo:</label>
                  <p>{selectedReading.periodo_consumo || 'N/A'}</p>
                </div>

                {/* Fecha real de lectura */}
                <div className="detail-group">
                  <label>Fecha lectura:</label>
                  <p>{new Date(selectedReading.fecha_lectura + 'T00:00:00').toLocaleDateString('es-EC')}</p>
                </div>

                {/* LECTOR */}
                <div className="detail-group">
                  <label>Lector:</label>
                  <p>{selectedReading.lector_nombre || 'No registrado'}</p>
                </div>

                {/* Observación */}
                <div className="detail-group">
                  <label>Observación:</label>
                  <p>{selectedReading.observacion || 'Sin observaciones'}</p>
                  {selectedReading.observacion_exceso && (
                    <p className="text-red-700 font-semibold">
                      {selectedReading.observacion_exceso}
                    </p>
                  )}
                </div>

                {/* Estado */}
                <div className="detail-group">
                  <label>Estado:</label>
                  <span className={`status-badge ${selectedReading.activo ? 'active' : 'inactive'}`}>
                    {selectedReading.activo ? (
                      <>
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Activo
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3 mr-1" />
                        Inactivo
                      </>
                    )}
                  </span>
                </div>

                {/* Tipo de Lectura */}
                {selectedReading.es_estimada && (
                  <div className="detail-group">
                    <label>Tipo:</label>
                    <span className="status-badge" style={{ backgroundColor: '#fbbf24', color: '#92400e' }}>
                      <TrendingUp className="w-3 h-3 mr-1" />
                      Lectura Estimada
                    </span>
                  </div>
                )}

              </div>
            )}

            {/* ==================== MODAL DE CREACIÓN/EDICIÓN ==================== */}
            {(modalType === 'create' || modalType === 'edit') && (
              <form onSubmit={handleSubmit} className="user-form">
                <div className="form-grid">

                  <div className="form-group form-group-full">
                    <label>Afiliado / Medidor *</label>

                    {/* ✅ SELECTOR DE AFILIADO MODERNO — Estilo Reportes */}
                    {modalType === 'create' && (
                      <div className="form-group form-group-full">
                        {/* Búsqueda moderna */}
                        <div className="meter-search-container mb-3">
                          <div className="meter-search-input-wrapper">
                            <Search className="w-4 h-4 text-gray-400" />
                            <input
                              type="text"
                              placeholder="Buscar por código, nombre o medidor..."
                              value={meterSearchTerm}
                              onChange={(e) => setMeterSearchTerm(e.target.value)}
                              disabled={meters.length === 0 || loadingMeters}
                            />
                            {meterSearchTerm && (
                              <button
                                type="button"
                                onClick={() => setMeterSearchTerm('')}
                                className="meter-search-clear-btn"
                              >
                                <X className="w-4 h-4 text-gray-400" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* MENSAJE DE PERIODO COMPLETO */}
                        {meters.length === 0 && periodoSeleccionado && !loadingMeters && (
                          <div className="alert alert-success mb-3">
                            <h4 className="alert-title flex items-center gap-2">
                              <CheckCircle className="w-5 h-5" /> Periodo Completo
                            </h4>
                            <p className="alert-message mt-1">
                              Todos los medidores ya tienen lectura registrada para este periodo.
                            </p>
                          </div>
                        )}

                        {/* MENSAJE DE CARGA */}
                        {loadingMeters && (
                          <div className="alert alert-info mb-3 py-2">
                            <Activity className="w-4 h-4 animate-spin mr-2 inline" />
                            <span>Cargando medidores disponibles...</span>
                          </div>
                        )}

                        {/* Lista moderna de medidores con scroll interno */}
                        <div className="affiliates-modal-list" style={{ maxHeight: '220px' }}>
                          {filteredMeters.map(afiliado => (
                            <div 
                              key={afiliado.id_medidor}
                              className={`affiliate-modal-item ${formData.id_medidor === afiliado.id_medidor ? 'selected' : ''}`}
                              onClick={() => handleMedidorChange(afiliado.id_medidor)}
                            >
                              <div className="avatar-circle">
                                {afiliado.nombre_completo.split(' ').map(n => n[0]).join('').substring(0, 2)}
                              </div>
                              <div className="affiliate-info">
                                <div className="flex justify-between items-start">
                                  <p className="affiliate-name">{afiliado.nombre_completo}</p>
                                  <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                    Md: {afiliado.num_medidor}
                                  </span>
                                </div>
                                <p className="affiliate-meta">
                                  Cód: {afiliado.cod_usuario_afi || 'S/C'} | {afiliado.nombre_sector || afiliado.sector || 'Sin sector'}
                                </p>
                              </div>
                            </div>
                          ))}

                          {filteredMeters.length === 0 && meterSearchTerm && !loadingMeters && (
                            <div className="p-6 text-center text-gray-500">
                              <Search className="w-8 h-8 mx-auto mb-2 opacity-20" />
                              <p className="text-sm">No se encontraron medidores con "{meterSearchTerm}"</p>
                            </div>
                          )}

                          {!meterSearchTerm && filteredMeters.length === 0 && !loadingMeters && meters.length > 0 && (
                            <div className="p-4 text-center text-gray-400 text-xs italic">
                              Empieza a escribir para buscar...
                            </div>
                          )}
                        </div>

                        {/* INFO DEL MEDIDOR SELECCIONADO */}
                        {selectedMeterInfo && (
                          <div className="selected-affiliate-card mt-3 py-2 px-3 animate-fadeIn border-blue-200 bg-blue-50">
                            <div className="avatar-circle" style={{ width: '28px', height: '28px', fontSize: '10px' }}>✓</div>
                            <div className="affiliate-info">
                              <p className="affiliate-name" style={{ fontSize: '13px' }}>
                                Seleccionado: {selectedMeterInfo.nombre_completo}
                              </p>
                              <p className="affiliate-meta" style={{ fontSize: '11px' }}>
                                Medidor: {selectedMeterInfo.num_medidor} | Lectura Anterior: {selectedMeterInfo.lectura_anterior || 0} m³
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* SELECT DE MEDIDOR (Solo visible en EDIT para mantener funcionalidad base) */}
                    {modalType === 'edit' && (
                      <div className="form-group">
                        <select
                          required
                          value={formData.id_medidor || ''}
                          onChange={(e) => handleMedidorChange(e.target.value)}
                          disabled={true}
                          className="disabled"
                        >
                          <option value={formData.id_medidor}>
                            🏠 {selectedMeterInfo?.num_medidor} | 👤 {selectedMeterInfo?.nombre_completo}
                          </option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* LECTURA ANTERIOR */}
                  <div className="form-group">
                    <label>Lectura Anterior * (m³)</label>
                    <input
                      type="number"
                      required
                      value={formData.lectura_anterior}
                      onChange={(e) => setFormData({ ...formData, lectura_anterior: e.target.value })}
                      readOnly={modalType === 'create'}
                      className={modalType === 'create' ? 'bg-gray-100' : ''}
                    />
                    <small className="text-gray-500">Auto-cargada al seleccionar afiliado</small>
                  </div>

                  {/* ✅ LECTURA ACTUAL CON VALIDACIÓN EN TIEMPO REAL */}
                  <div className="form-group">
                    <label>Lectura Actual * (m³)</label>
                    <input
                      type="number"
                      required
                      value={formData.lectura_actual}
                      onChange={(e) => setFormData({ ...formData, lectura_actual: e.target.value })}
                      min={lecturaAnteriorNum}
                      // ✅ Borde rojo cuando el valor es inválido
                      className={lecturaActualInvalida ? 'input-error' : ''}
                    />

                    {/* ✅ MENSAJE INFORMATIVO EN TIEMPO REAL */}
                    {lecturaActualNegativa ? (
                      <small className="text-red-600 mt-1 flex items-center gap-1 font-medium">
                        <AlertCircle className="w-3 h-3" />
                        La lectura no puede ser un valor negativo
                      </small>
                    ) : lecturaActualInvalida ? (
                      <small className="text-red-600 mt-1 flex items-center gap-1 font-medium">
                        <AlertCircle className="w-3 h-3" />
                        Debe ser mayor o igual a la lectura anterior ({lecturaAnteriorNum} m³)
                      </small>
                    ) : formData.lectura_actual !== '' && !isNaN(lecturaActualNum) ? (
                      <small className="text-green-600 mt-1 flex items-center gap-1 font-medium">
                        <CheckCircle className="w-3 h-3" />
                        Valor válido ✓
                      </small>
                    ) : (
                      <small className="text-gray-500">Debe ser mayor o igual a lectura anterior</small>
                    )}
                  </div>

                  {/* CONSUMO */}
                  <div className="form-group">
                    <label>Consumo (m³)</label>
                    <input
                      type="number"
                      value={formData.consumo_m3}
                      readOnly
                      className="bg-gray-100 font-semibold text-green-700"
                    />
                    <small className="text-gray-500">Calculado automáticamente</small>
                  </div>

                  {/* PERIODO DE CONSUMO */}
                  <div className="form-group">
                    <label>Periodo de Consumo *</label>
                    <input
                      type="text"
                      required
                      value={
                        modalType === 'create' && periodoSeleccionado
                          ? `${periodoSeleccionado.anio}-${String(periodoSeleccionado.mes).padStart(2, '0')}`
                          : formData.periodo_consumo
                      }
                      onChange={(e) => setFormData({ ...formData, periodo_consumo: e.target.value })}
                      readOnly={modalType === 'create'}
                      pattern="\d{4}-\d{2}"
                      className={modalType === 'create' ? 'bg-gray-100' : ''}
                    />
                    <small className="text-gray-500">Mes real al que corresponde el consumo</small>
                  </div>

                  {/* FECHA */}
                  <div className="form-group">
                    <label>Fecha de Lectura *</label>
                    <input
                      type="date"
                      required
                      value={formData.fecha_lectura}
                      onChange={(e) => setFormData({ ...formData, fecha_lectura: e.target.value })}
                    />
                  </div>

                  {/* OBSERVACIÓN */}
                  <div className="form-group form-group-full">
                    <label>Observación</label>
                    <textarea
                      rows="3"
                      value={formData.observacion}
                      onChange={(e) => setFormData({ ...formData, observacion: e.target.value })}
                      placeholder="Observaciones opcionales (ej: medidor dañado, lectura irregular, etc.)..."
                    />
                  </div>

                  {modalType === 'edit' && (
                    <div className="form-group">
                      <label>Estado</label>
                      <select
                        value={formData.activo}
                        onChange={(e) => setFormData({ ...formData, activo: e.target.value === 'true' })}
                      >
                        <option value="true">Activa</option>
                        <option value="false">Inactiva</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="form-actions">
                  <button type="button" className="btn-secondary" onClick={closeModal}>
                    <X className="w-4 h-4 mr-2" />
                    Cancelar
                  </button>

                  {modalType === 'edit' && permissions.canDelete && (
                    <button
                      type="button"
                      className="btn-delete"
                      onClick={() => handleDelete(formData.id_lectura)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Eliminar
                    </button>
                  )}

                  {/* ✅ BOTÓN BLOQUEADO EN TIEMPO REAL */}
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={formInvalido}
                    title={formInvalido ? `La lectura actual debe ser ≥ ${lecturaAnteriorNum} m³` : ''}
                    style={{ opacity: formInvalido ? 0.5 : 1, cursor: formInvalido ? 'not-allowed' : 'pointer' }}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {modalType === 'create' ? 'Crear Lectura' : 'Guardar Cambios'}
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      </div>
  )}
  </div>
  );
};

export default ReadingsSection;
