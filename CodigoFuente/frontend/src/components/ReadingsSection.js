// src/components/ReadingsSection.js
// MÓDULO DE LECTURAS - Con sistema de periodos mensuales REORGANIZADO

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useModal } from '../context/ModalContext';
import './ReadingsList.css';
import readingsServices from '../services/readingsServices';
import authService from '../services/authServices';
import * as XLSX from "xlsx";
import {
  BookOpen,
  Search,
  Edit,
  Trash2,
  Eye,
  CheckCircle,
  XCircle,
  Calendar,
  X,
  Save,
  RefreshCw,
  AlertCircle,
  ArrowUpDown,
  Gauge,
  Plus,
  FileSpreadsheet,
  TrendingUp,
  User,
  Download,
  Upload,
  MapPin,
  CalendarDays,
  Clock
} from 'lucide-react';

const ReadingsSection = () => {
  // ============================================================
  // ESTADOS PRINCIPALES
  // ============================================================
  const [readings, setReadings] = useState([]);
  const [meters, setMeters] = useState([]);
  const [loading, setLoading] = useState(false); // 🔴 Cambiado a false
  const [error, setError] = useState(null);

  // ============================================================
  // ESTADOS DE PERIODOS
  // ============================================================
  const [periodos, setPeriodos] = useState([]);
  const [periodoActual, setPeriodoActual] = useState(null);
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState(null); // 🔴 Inicia como null
  const [loadingPeriodos, setLoadingPeriodos] = useState(false);

  // ============================================================
  // ESTADOS DE BÚSQUEDA Y FILTROS
  // ============================================================
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortOption, setSortOption] = useState('fecha');
  const [sortOrder, setSortOrder] = useState('desc');

  // ============================================================
  // ESTADOS DE MODAL
  // ============================================================
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('create');
  const [selectedReading, setSelectedReading] = useState(null);
  const [selectedMeterInfo, setSelectedMeterInfo] = useState(null);
  const [meterSearchTerm, setMeterSearchTerm] = useState('');
  const { showConfirm, showAlert, showSuccess } = useModal();

  // ============================================================
  // ESTADOS DE EXCEL CON PERIODO
  // ============================================================
  const [selectedExcel, setSelectedExcel] = useState(null);
  const [excelPreview, setExcelPreview] = useState([]);
  const [loadingExcel, setLoadingExcel] = useState(false);
  const [excelMesSeleccionado, setExcelMesSeleccionado] = useState('');
  const [excelAnioSeleccionado, setExcelAnioSeleccionado] = useState('');

  // ============================================================
  // ESTADOS DE FORMULARIO
  // ============================================================
  const [formData, setFormData] = useState({
    id_medidor: null,
    lectura_actual: '',
    lectura_anterior: '',
    consumo_m3: '',
    fecha_lectura: new Date().toISOString().split('T')[0],
    observacion: '',
    activo: true
  });

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
    loadUserPermissions();
    fetchMeters();
    fetchPeriodosDisponibles();
  }, []);

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
        
        // 🔴 NO establecer periodo seleccionado automáticamente
        // El usuario debe seleccionar manualmente
        // setPeriodoSeleccionado permanece null

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
      const result = await readingsServices.getLecturas();

      if (result.success) {
        const lecturasFiltradas = result.data.filter(lectura => {
          const fecha = new Date(lectura.fecha_lectura + 'T00:00:00');
          return (
            fecha.getMonth() + 1 === periodoSeleccionado.mes &&
            fecha.getFullYear() === periodoSeleccionado.anio
          );
        });

        setReadings(lecturasFiltradas);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Error al cargar lecturas del periodo');
    } finally {
      setLoading(false);
    }
  }, [periodoSeleccionado]);

  // 🔴 Este efecto solo se ejecuta cuando hay periodo seleccionado
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
  const fetchMeters = async () => {
    try {
      const result = await readingsServices.getMedidoresParaLecturas();
      if (result.success) {
        setMeters(result.data || []);
      } else {
        setError(result.message);
      }
    } catch (error) {
      setError('Error al cargar medidores');
    }
  };

  // ============================================================
  // FUNCIONES AUXILIARES
  // ============================================================
  const filteredMeters = useMemo(() => {
    if (!meterSearchTerm.trim()) return meters;
    
    const searchLower = meterSearchTerm.toLowerCase().trim();
    return meters.filter(medidor => {
      const numMedidor = medidor.num_medidor?.toLowerCase() || '';
      const nombreAfiliado = medidor.nombre_afiliado?.toLowerCase() || '';
      const codigoAfiliado = String(medidor.codigo_afiliado || '').toLowerCase();
      
      return numMedidor.includes(searchLower) ||
             nombreAfiliado.includes(searchLower) ||
             codigoAfiliado.includes(searchLower);
    });
  }, [meters, meterSearchTerm]);

  // ============================================================
  // FUNCIONES DE FILTRADO Y ORDENAMIENTO
  // ============================================================
  const filteredReadings = readings.filter(reading => {
    const searchLower = searchTerm.toLowerCase();
    
    const matchesSearch =
      reading.medidor?.num_medidor?.toLowerCase().includes(searchLower) ||
      reading.observacion?.toLowerCase().includes(searchLower) ||
      reading.id_lectura.toString().includes(searchTerm) ||
      (reading.medidor?.codigo_afiliado + '').toLowerCase().includes(searchLower) ||
      (reading.medidor?.nombre_afiliado || '').toLowerCase().includes(searchLower);

    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && reading.activo) ||
      (filterStatus === 'inactive' && !reading.activo);

    return matchesSearch && matchesStatus;
  });

  const sortedReadings = [...filteredReadings].sort((a, b) => {
    let comparison = 0;

    if (sortOption === 'fecha') {
      comparison = new Date(a.fecha_lectura) - new Date(b.fecha_lectura);
    } else if (sortOption === 'medidor') {
      const medidorA = a.medidor?.num_medidor?.toLowerCase() || '';
      const medidorB = b.medidor?.num_medidor?.toLowerCase() || '';
      comparison = medidorA.localeCompare(medidorB);
    } else if (sortOption === 'consumo') {
      comparison = a.consumo_m3 - b.consumo_m3;
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

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
        observacion: '',
        activo: true
      });
      setSelectedMeterInfo(null);
    } else if (type === 'edit' && reading) {
      setFormData({
        id_medidor: reading.id_medidor,
        lectura_actual: reading.lectura_actual,
        lectura_anterior: reading.lectura_anterior,
        consumo_m3: reading.consumo_m3,
        fecha_lectura: reading.fecha_lectura,
        observacion: reading.observacion || '',
        activo: reading.activo
      });

      const medidor = meters.find(m => m.id_medidor === reading.id_medidor);
      if (medidor) {
        setSelectedMeterInfo(medidor);
      }
    } else if (type === 'excel') {
      setExcelPreview([]);
      setSelectedExcel(null);
      setLoadingExcel(false);
      
      // Usar periodo seleccionado o periodo actual
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

      try {
        const result = await readingsServices.getLecturas({ id_medidor: parseInt(id_medidor) });

        if (result.success && result.data?.length > 0) {
          const ultimaLectura = result.data.sort(
            (a, b) => new Date(b.fecha_lectura) - new Date(a.fecha_lectura)
          )[0];

          setFormData(prev => ({
            ...prev,
            id_medidor: parseInt(id_medidor),
            lectura_anterior: ultimaLectura.lectura_actual
          }));
        } else {
          setFormData(prev => ({
            ...prev,
            id_medidor: parseInt(id_medidor),
            lectura_anterior: 0
          }));
        }
      } catch (error) {
        console.error('Error al obtener última lectura:', error);
        setFormData(prev => ({
          ...prev,
          id_medidor: parseInt(id_medidor),
          lectura_anterior: 0
        }));
      }
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
        result = await readingsServices.createLectura(formData);

        if (result.success) {
          alert(`✅ Lectura creada exitosamente.\n\nMedidor: ${selectedMeterInfo?.num_medidor}\nConsumo: ${formData.consumo_m3} m³`);
          await fetchReadingsByPeriodo();
          await fetchPeriodosDisponibles();
          closeModal();
        } else {
          setError(result.message || 'Error al crear la lectura');
        }
      } else if (modalType === 'edit') {
        result = await readingsServices.updateLectura(selectedReading.id_lectura, formData);

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
      showAlert({
        title: "Permiso denegado",
        message: "❌ No tienes permiso para eliminar lecturas",
        confirmText: "Entendido"
      });
      return;
    }

    // 🔥 Modal de confirmación
    const confirmed = await showConfirm({
      title: "Eliminar Lectura",
      message: "¿Estás seguro de que deseas eliminar esta lectura?",
      confirmText: "Sí, eliminar",
      cancelText: "Cancelar"
    });

    if (!confirmed) return; // Usuario canceló

    try {
      const result = await readingsServices.deleteLectura(readingId);

      if (result.success) {

        // 🎉 Modal de éxito
        await showSuccess({
          title: "Lectura Eliminada",
          message: result.message,
          confirmText: "OK"
        });

        await fetchReadingsByPeriodo();
        await fetchPeriodosDisponibles();

      } else {
        showAlert({
          title: "Error",
          message: result.message
        });
      }

    } catch (error) {
      showAlert({
        title: "Error inesperado",
        message: "Error al eliminar lectura: " + error.message
      });
    }
  };


  // ============================================================
  // FUNCIONES DE EXCEL CON PERIODO
  // ============================================================
  const handleDownloadTemplate = async () => {
    try {
      const result = await readingsServices.exportarPlantilla();
      if (result.success) {
        alert('✅ Plantilla descargada correctamente');
      } else {
        alert('❌ Error: ' + result.message);
      }
    } catch (error) {
      alert('❌ Error al descargar plantilla');
    }
  };

  // funcion para normalizar las llaves del excel
  const normalizeKeys = (obj) => {
    const newObj = {};
    Object.keys(obj).forEach((key) => {
      const cleanKey = key
        .toString()
        .trim()
        .replace(/\s+/g, "_")
        .replace(/[^\w]/g, "")
        .toLowerCase();
      newObj[cleanKey] = obj[key];
    });
    return newObj;
  };

  // funcion para previsualizar el excel
  const handleExcelPreview = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoadingExcel(true);
    setError(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);

      const cleanedRows = rows.map((row) => {
        const r = normalizeKeys(row);
        return {
          num_medidor: r.num_medidor || "",
          sector: r.sector || "",
          codigo_afiliado: r.codigo_usuarioafiliado || "",
          nombre_afiliado: r.nombre_usuarioafiliado || "",
          lectura_anterior: r.lectura_anterior || 0,
          lectura_actual: r.lectura_actual || "",
          observacion: r.observacion || ""
        };
      });

      setExcelPreview(cleanedRows);
      setSelectedExcel(file);
    } catch (error) {
      setError("Error al leer el archivo Excel");
      setExcelPreview([]);
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

    setLoadingExcel(true);
    setError(null);

    try {
      const result = await readingsServices.importarExcelConPeriodo(
        selectedExcel,
        parseInt(excelMesSeleccionado),
        parseInt(excelAnioSeleccionado)
      );

      if (result.success) {
        const { exitosos, fallidos, total_procesados } = result.data;

        let mensaje = `📊 RESULTADO DE LA IMPORTACIÓN\n`;
        mensaje += `Periodo: ${readingsServices.formatearPeriodo(parseInt(excelMesSeleccionado), parseInt(excelAnioSeleccionado))}\n`;
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
        await fetchReadingsByPeriodo();
        await fetchPeriodosDisponibles();
        
        setPeriodoSeleccionado({
          mes: parseInt(excelMesSeleccionado),
          anio: parseInt(excelAnioSeleccionado)
        });
      } else {
        setError(result.message || "Error al procesar lecturas");
      }
    } catch (error) {
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
      <div className="affiliates-section">
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
      <div className="affiliates-section">
        <div className="empty-state">
          <RefreshCw className="w-16 h-16 text-blue-400 mx-auto mb-4 animate-spin" />
          <h3>Cargando periodos...</h3>
        </div>
      </div>
    );
  }

 // ============================================================
// RENDERIZADO PRINCIPAL - CON NAVEGACIÓN POR PASOS
// ============================================================
return (
  <div className="affiliates-section">
    
    {/* ==================== PASO 1: SELECCIÓN DE PERIODO ==================== */}
    {!periodoSeleccionado && (
      <div className="periodo-selection-page">
        <div className="section-header">
          <div className="section-title">
            <BookOpen className="w-7 h-7 text-blue-600" />
            <h2>Gestión de Lecturas</h2>
          </div>
        </div>

        <div className="periodo-selector-container">
          <div className="periodo-selector-header flex items-start">
            <CalendarDays className="w-5 h-5 text-blue-600 mr-2 mt-1" />
            <div>
              <h3 className="font-semibold">Seleccionar Periodo</h3>
              <p className="periodo-selector-subtitle">
                Selecciona un periodo para gestionar sus lecturas
              </p>
            </div>
          </div>
          <div className="periodos-grid">
            {periodos.map(periodo => {
              const porcentaje = getPorcentajeCompletado(periodo);
              const esCompleto = porcentaje >= 100;
              
              return (
                <button
                  key={`${periodo.mes}-${periodo.anio}`}
                  onClick={() => handlePeriodoChange(periodo.mes, periodo.anio)}
                  className="periodo-card hoverable"
                >
                  <div className="periodo-card-header">
                    <span className="periodo-card-title">
                      {periodo.nombre_mes} {periodo.anio}
                    </span>
                    {periodo.sugerido && (
                      <span className="periodo-badge-sugerido">Sugerido</span>
                    )}
                  </div>

                  <div className="periodo-card-info">
                    {periodo.total_lecturas} / {periodo.total_medidores} lecturas
                  </div>

                  <div className="periodo-progress-bar">
                    <div className={`periodo-progress-fill ${esCompleto ? 'complete' : ''}`}
                      style={{ width: `${porcentaje}%` }}
                    />
                  </div>

                  <div className={`periodo-percentage ${esCompleto ? 'complete' : ''}`}>
                    {porcentaje.toFixed(0)}% completado
                  </div>

                  <div className="periodo-card-action">
                    <span>Ver lecturas →</span>
                  </div>
                </button>
              );
            })}
          </div>
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
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value)}
            >
              <option value="fecha">Ordenar por Fecha</option>
              <option value="medidor">Ordenar por Medidor</option>
              <option value="consumo">Ordenar por Consumo</option>
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
            <h3>Cargando lecturas...</h3>
          </div>
        )}

        {/* LISTA DE LECTURAS */}
        {!loading && (
          <div className="readings-list-container">
            <div className="readings-list-header">
              <span>#</span>
              <span><Gauge className="w-4 h-4" /> Medidor</span>
              <span><User className="w-4 h-4" /> Nombre Afi</span>
              <span>Código Afi</span>
              <span><MapPin className="w-4 h-4" /> Sector</span>
              <span>Lect. Ant.</span>
              <span>Lect. Act.</span>
              <span>Consumo</span>
              <span><Calendar className="w-4 h-4" /> Fecha</span>
              <span>Estado</span>
              <span>Acciones</span>
            </div>

            <div className="readings-list-body">
              {sortedReadings.length > 0 ? (
                sortedReadings.map((reading, index) => {
                  const consumoClass = reading.consumo_m3 > 100 ? 'alto' : reading.consumo_m3 > 50 ? 'medio' : '';
                  return (
                    <div 
                      key={reading.id_lectura} 
                      className={`readings-list-item ${!reading.activo ? 'inactive' : ''}`}
                    >
                      <div className="list-col-id">{index + 1}</div>

                      <div className="list-col-medidor">
                        <div className="medidor-icon">
                          <Gauge className="w-4 h-4" />
                        </div>
                        <span className="medidor-numero">
                          {reading.medidor?.num_medidor || 'N/A'}
                        </span>
                      </div>

                      <div className={`list-col-nombre ${!reading.medidor?.nombre_afiliado ? 'empty' : ''}`}>
                        <User className="w-4 h-4" />
                        {reading.medidor?.nombre_afiliado || 'No registrado'}
                      </div>

                      <div className={`list-col-codigo ${!reading.medidor?.codigo_afiliado ? 'empty' : ''}`}>
                        {reading.medidor?.codigo_afiliado || '---'}
                      </div>

                      <div className={`list-col-sector ${!reading.medidor?.sector ? 'empty' : ''}`}>
                        <MapPin className="w-4 h-4" />
                        {reading.medidor?.sector || 'Sin sector'}
                      </div>

                      <div className="list-col-lectura">
                        {reading.lectura_anterior}<span className="unidad">m³</span>
                      </div>

                      <div className="list-col-lectura">
                        {reading.lectura_actual}<span className="unidad">m³</span>
                      </div>

                      <div className={`list-col-consumo ${consumoClass}`}>
                        {reading.consumo_m3} m³
                      </div>

                      <div className="list-col-fecha">
                        <Calendar className="w-3 h-3" />
                        {new Date(reading.fecha_lectura + 'T00:00:00').toLocaleDateString('es-EC', {
                          day: '2-digit',
                          month: 'short'
                        })}
                      </div>

                      <div>
                        <span className={`list-status-badge ${reading.activo ? 'active' : 'inactive'}`}>
                          {reading.activo ? (
                            <><CheckCircle className="w-4 h-4" /> Act</>
                          ) : (
                            <><XCircle className="w-4 h-4" /> Inact</>
                          )}
                        </span>
                      </div>

                      <div className="list-actions">
                        <button 
                          className="list-action-btn view" 
                          onClick={() => openModal('view', reading)} 
                          title="Ver detalles"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {permissions.canUpdate && (
                          <button 
                            className="list-action-btn edit" 
                            onClick={() => openModal('edit', reading)} 
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        
                        {permissions.canDelete && (
                          <button 
                            className="list-action-btn delete" 
                            onClick={() => handleDelete(reading.id_lectura)} 
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
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

            {sortedReadings.length > 0 && (
              <div className="readings-list-footer">
                <button 
                  className="btn-secondary"
                  onClick={() => setPeriodoSeleccionado(null)}
                >
                  <ArrowUpDown className="w-4 h-4 mr-2" style={{ transform: 'rotate(90deg)' }} />
                  Cambiar periodo
                </button>
                
                <div className="readings-list-footer-stats">
                  <span>
                    Mostrando <strong>{sortedReadings.length}</strong> lecturas
                  </span>
                  <span>
                    Consumo total: <strong>{sortedReadings.reduce((sum, r) => sum + (r.consumo_m3 || 0), 0)} m³</strong>
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )}

    {/* ==================== MODALES ==================== */}
    {showModal && (
      <div className="modal-overlay">
        <div className="modal">
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
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Descargar plantilla Excel
                  </button>
                  <small className="text-gray-500 mt-1">
                    Descarga la plantilla con los medidores y sus últimas lecturas.
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
                      {(() => {
                        const validas = excelPreview.filter(lectura => {
                          const esNumerico = /^\d{1,13}$/.test(lectura.lectura_actual);
                          return (
                            lectura.num_medidor &&
                            lectura.lectura_actual &&
                            esNumerico &&
                            parseInt(lectura.lectura_actual) >= parseInt(lectura.lectura_anterior || 0)
                          );
                        }).length;

                        const invalidas = excelPreview.length - validas;

                       return (
                          <ul className="ml-4 space-y-1">
                            <li className="text-green-600">{validas} válidas</li>

                            {invalidas > 0 && (
                              <li className="text-red-600">{invalidas} inválidas (serán omitidas)</li>
                            )}
                          </ul>
                        );
                      })()}
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
                          {excelPreview.map((lectura, idx) => {
                            // ✅ Validación mejorada con regex para números
                            const esNumerico = /^\d{1,13}$/.test(lectura.lectura_actual);
                            const esValido =
                              lectura.num_medidor &&
                              lectura.lectura_actual &&
                              esNumerico &&
                              parseInt(lectura.lectura_actual) >= parseInt(lectura.lectura_anterior || 0);
                            
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

                            return (
                              <tr key={idx} className={!esValido ? 'invalid' : ''}>
                                <td className="text-muted">{idx + 1}</td>
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
                    (() => {
                      // ✅ Contar solo filas válidas
                      const validas = excelPreview.filter(lectura => {
                        const esNumerico = /^\d{1,13}$/.test(lectura.lectura_actual);
                        return (
                          lectura.num_medidor &&
                          lectura.lectura_actual &&
                          esNumerico &&
                          parseInt(lectura.lectura_actual) >= parseInt(lectura.lectura_anterior || 0)
                        );
                      }).length;
                      return validas === 0 || validas > 500;
                    })() ||
                    loadingExcel
                  }
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {loadingExcel 
                    ? 'Procesando...' 
                    : (() => {
                        const validas = excelPreview.filter(lectura => {
                          const esNumerico = /^\d{1,13}$/.test(lectura.lectura_actual);
                          return (
                            lectura.num_medidor &&
                            lectura.lectura_actual &&
                            esNumerico &&
                            parseInt(lectura.lectura_actual) >= parseInt(lectura.lectura_anterior || 0)
                          );
                        }).length;
                        return `Crear ${validas} lectura${validas !== 1 ? 's' : ''} válida${validas !== 1 ? 's' : ''}`;
                      })()
                  }
                </button>
              </div>
            </div>
          )}

          {/* ==================== MODAL DE VISTA ==================== */}
          {modalType === 'view' && selectedReading && (
            <div className="user-details">

              {/* ID Lectura */}
              <div className="detail-group">
                <label>ID Lectura:</label>
                <p>{selectedReading.id_lectura}</p>
              </div>

              {/* Código de Usuario */}
              <div className="detail-group">
                <label>Código de Usuario:</label>
                <p>{selectedReading.medidor?.codigo_afiliado || 'N/A'}</p>
              </div>

              {/* Medidor */}
              <div className="detail-group">
                <label>Medidor:</label>
                <p>{selectedReading.medidor?.num_medidor || 'N/A'}</p>
              </div>

              {/* Sector */}
              <div className="detail-group">
                <label>Sector:</label>
                <p>{selectedReading.medidor?.sector || 'Sin sector'}</p>
              </div>

              {/* Nombre Afiliado */}
              <div className="detail-group">
                <label>Nombre Afiliado:</label>
                <p>{selectedReading.medidor?.nombre_afiliado || 'Sin afiliado'}</p>
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

              {/* Fecha */}
              <div className="detail-group">
                <label>Fecha:</label>
                <p>{new Date(selectedReading.fecha_lectura + 'T00:00:00').toLocaleDateString('es-EC')}</p>
              </div>

              {/* Lector */}
              <div className="detail-group">
                <label>Lector:</label>
                <p>
                  {selectedReading.lector
                    ? `${selectedReading.lector.nombres} ${selectedReading.lector.apellidos}`
                    : 'No registrado'}
                </p>
              </div>

              {/* Observación */}
              <div className="detail-group">
                <label>Observación:</label>
                <p>{selectedReading.observacion || 'Sin observaciones'}</p>
              </div>

              {/* Estado  */}
              <div className="detail-group">
                <label>Estado:</label>

                <span
                  className={`status-badge ${selectedReading.activo ? 'active' : 'inactive'}`}
                >
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

            </div>
          )}

          {/* ==================== MODAL DE CREACIÓN/EDICIÓN ==================== */}
          {(modalType === 'create' || modalType === 'edit') && (
            <form onSubmit={handleSubmit} className="user-form">
              <div className="form-grid">
                
                <div className="form-group form-group-full">
                  <label>Medidor *</label>
                  
                  {modalType === 'create' && (
                    <div className="meter-search-container">
                      <div className="meter-search-input-wrapper">
                        <Search className="w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Buscar medidor..."
                          value={meterSearchTerm}
                          onChange={(e) => setMeterSearchTerm(e.target.value)}
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
                  )}

                  <select
                    required
                    value={formData.id_medidor || ''}
                    onChange={(e) => handleMedidorChange(e.target.value)}
                    disabled={modalType === 'edit'}
                  >
                    <option value="">Seleccione un medidor</option>
                    {filteredMeters.map(medidor => (
                      <option key={medidor.id_medidor} value={medidor.id_medidor}>
                        {medidor.num_medidor} | {medidor.codigo_afiliado || 'S/C'} | {medidor.nombre_afiliado || 'Sin afiliado'}
                      </option>
                    ))}
                  </select>

                  {selectedMeterInfo && (
                    <div className="meter-info-card">
                      <h4 className="meter-info-title">
                        <Gauge className="w-4 h-4 mr-2" />
                        Información del Medidor
                      </h4>
                      <div className="meter-info-content">
                        <p><strong>Afiliado:</strong> {selectedMeterInfo.nombre_afiliado ?? "Sin afiliado"}</p>
                        <p><strong>Sector:</strong> {selectedMeterInfo.sector || 'Sin sector'}</p>
                      </div>
                    </div>
                  )}
                </div>

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
                </div>

                <div className="form-group">
                  <label>Lectura Actual * (m³)</label>
                  <input
                    type="number"
                    required
                    value={formData.lectura_actual}
                    onChange={(e) => setFormData({ ...formData, lectura_actual: e.target.value })}
                    min={formData.lectura_anterior || 0}
                  />
                </div>

                <div className="form-group">
                  <label>Consumo (m³)</label>
                  <input
                    type="number"
                    value={formData.consumo_m3}
                    readOnly
                    className="bg-gray-100 font-semibold text-green-700"
                  />
                </div>

                <div className="form-group">
                  <label>Fecha de Lectura *</label>
                  <input
                    type="date"
                    required
                    value={formData.fecha_lectura}
                    onChange={(e) => setFormData({ ...formData, fecha_lectura: e.target.value })}
                  />
                </div>

                <div className="form-group form-group-full">
                  <label>Observación</label>
                  <textarea
                    rows="3"
                    value={formData.observacion}
                    onChange={(e) => setFormData({ ...formData, observacion: e.target.value })}
                    placeholder="Observaciones opcionales..."
                  />
                </div>

                {modalType === 'edit' && (
                  <div className="form-group">
                    <label>Estado</label>
                    <select
                      value={formData.activo}
                      onChange={(e) => setFormData({ ...formData, activo: e.target.value === "true" })}
                    >
                      <option value="true">Activa</option>
                      <option value="false">Inactiva</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={closeModal}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
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