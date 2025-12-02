// src/components/ReadingsSection.js
// MÓDULO DE LECTURAS - Con funcionalidad de Excel

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Map,
  ArrowUpDown,
  Gauge,
  Plus,
  FileSpreadsheet,
  TrendingUp,
  User,
  Download,
  Upload,
  MapPin
} from 'lucide-react';

const ReadingsSection = () => {
  // ============================================================
  // ESTADOS PRINCIPALES
  // ============================================================
  const [readings, setReadings] = useState([]);
  const [meters, setMeters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ============================================================
  // ESTADOS DE BÚSQUEDA Y FILTROS
  // ============================================================
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm] = useState(searchTerm);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterYear, setFilterYear] = useState('all');
  const [sortOption, setSortOption] = useState('fecha');
  const [sortOrder, setSortOrder] = useState('desc');

  // ============================================================
  // ESTADOS DE MODAL
  // ============================================================
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('create');
  const [selectedReading, setSelectedReading] = useState(null);
  const [selectedMeterInfo, setSelectedMeterInfo] = useState(null);
  
  // ✅ NUEVO: Estado para búsqueda de medidores en el modal
  const [meterSearchTerm, setMeterSearchTerm] = useState('');

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
  // ESTADOS DE EXCEL
  // ============================================================
  const [selectedExcel, setSelectedExcel] = useState(null);
  const [excelPreview, setExcelPreview] = useState([]);
  const [loadingExcel, setLoadingExcel] = useState(false);

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
  }, []);

  

  useEffect(() => {
    if (formData.lectura_actual && formData.lectura_anterior !== '') {
      const consumo = parseInt(formData.lectura_actual) - parseInt(formData.lectura_anterior);
      setFormData(prev => ({ ...prev, consumo_m3: consumo }));
    }
  }, [formData.lectura_actual, formData.lectura_anterior]);

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
  const fetchReadings = useCallback(async () => {
    if (!permissions.canRead) {
      setError('No tienes permiso para ver lecturas');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await readingsServices.getLecturas({
        search: debouncedSearchTerm,
        activo: filterStatus === 'all' ? undefined : filterStatus === 'active'
      });

      if (result.success) {
        setReadings(result.data);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Error al cargar lecturas desde el servidor');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, debouncedSearchTerm, permissions.canRead]);

  useEffect(() => {
    if (permissions.canRead) {
      fetchReadings();
    }
  }, [debouncedSearchTerm, filterStatus, permissions.canRead, fetchReadings]);
  
  const fetchMeters = async () => {
    try {
      const result = await readingsServices.getMedidoresParaLecturas();
      if (result.success) {
        setMeters(result.data || []);
        console.log('✅ Medidores cargados:', result.data.length);
      } else {
        console.error('Error al cargar medidores:', result.message);
        setError(result.message);
      }
    } catch (error) {
      console.error('Error al cargar medidores:', error);
      setError('Error al cargar medidores');
    }
  };

  // ============================================================
  // FUNCIONES AUXILIARES
  // ============================================================
  const getAvailableYears = () => {
    const years = new Set();
    readings.forEach(reading => {
      if (reading.fecha_lectura) {
        const year = new Date(reading.fecha_lectura + 'T00:00:00').getFullYear();
        years.add(year);
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  };

  // ✅ NUEVO: Medidores filtrados para el modal
  const filteredMeters = useMemo(() => {
    if (!meterSearchTerm.trim()) return meters;
    
    const searchLower = meterSearchTerm.toLowerCase().trim();
    return meters.filter(medidor => {
      const numMedidor = medidor.num_medidor?.toLowerCase() || '';
      const nombreAfiliado = medidor.nombre_afiliado?.toLowerCase() || '';
       // 🔥 codigo_afiliado es INTEGER → convertir a string primero
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
        (reading.medidor?.nombre_afiliado || '').toLowerCase().includes(searchLower)


    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && reading.activo) ||
      (filterStatus === 'inactive' && !reading.activo);

    let matchesMonth = true;
    if (filterMonth !== 'all' && reading.fecha_lectura) {
      const readingMonth = new Date(reading.fecha_lectura + 'T00:00:00').getMonth() + 1;
      matchesMonth = readingMonth === parseInt(filterMonth);
    }

    let matchesYear = true;
    if (filterYear !== 'all' && reading.fecha_lectura) {
      const readingYear = new Date(reading.fecha_lectura + 'T00:00:00').getFullYear();
      matchesYear = readingYear === parseInt(filterYear);
    }

    return matchesSearch && matchesStatus && matchesMonth && matchesYear;
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
    setMeterSearchTerm(''); // ✅ Limpiar búsqueda de medidores

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
      } else {
        setSelectedMeterInfo({
          nombre_afiliado: reading.medidor?.nombre_afiliado || null,
          sector: reading.medidor?.sector || null,
          num_medidor: reading.medidor?.num_medidor || null
        });
      }
    } else if (type === 'excel') {
      setExcelPreview([]);
      setSelectedExcel(null);
      setLoadingExcel(false);
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
    setMeterSearchTerm(''); // ✅ Limpiar búsqueda
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
        if (!permissions.canCreate) {
          setError('No tienes permiso para crear lecturas');
          return;
        }

        result = await readingsServices.createLectura(formData);

        if (result.success) {
          alert(`✅ Lectura creada exitosamente.\n\nMedidor: ${selectedMeterInfo?.num_medidor}\nConsumo: ${formData.consumo_m3} m³\nID Lectura: ${result.data.id_lectura}`);
          await fetchReadings();
          closeModal();
        } else {
          setError(result.message || 'Error al crear la lectura');
        }
      } else if (modalType === 'edit') {
        if (!permissions.canUpdate) {
          setError('No tienes permiso para editar lecturas');
          return;
        }

        result = await readingsServices.updateLectura(selectedReading.id_lectura, formData);

        if (result.success) {
          alert('✅ Cambios guardados correctamente');
          await fetchReadings();
          closeModal();
        } else {
          setError(result.message || 'Error al actualizar lectura');
        }
      }
    } catch (error) {
      console.error('Error al guardar lectura:', error);
      setError(error.message || 'Error al guardar lectura');
    }
  };

  const handleDelete = async (readingId) => {
    if (!permissions.canDelete) {
      alert('❌ No tienes permiso para eliminar lecturas');
      return;
    }

    if (window.confirm('¿Estás seguro de que deseas eliminar esta lectura?')) {
      try {
        const result = await readingsServices.deleteLectura(readingId);

        if (result.success) {
          alert(result.message);
          await fetchReadings();
        } else {
          alert('Error: ' + result.message);
        }
      } catch (error) {
        alert('Error al eliminar lectura: ' + error.message);
      }
    }
  };

  // ============================================================
  // FUNCIONES DE EXCEL
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
      console.error(error);
      setError("Error al leer el archivo Excel");
      setExcelPreview([]);
      setSelectedExcel(null);
    } finally {
      setLoadingExcel(false);
    }
  };

  const handleExcelUpload = async () => {
    if (excelPreview.length === 0) {
      setError("No hay datos para enviar");
      return;
    }

    if (excelPreview.length > 500) {
      setError("Máximo 500 lecturas por carga");
      return;
    }

    setLoadingExcel(true);
    setError(null);

    try {
      const result = await readingsServices.importarExcel(selectedExcel);

      if (result.success) {
        const { exitosos, fallidos, total_procesados } = result.data;

        let mensaje = `📊 RESULTADO DE LA IMPORTACIÓN DE LECTURAS\n`;
        mensaje += `${'='.repeat(60)}\n\n`;
        mensaje += `✅ Lecturas creadas: ${exitosos.length}/${total_procesados}\n`;
        mensaje += `❌ Errores: ${fallidos.length}/${total_procesados}\n\n`;

        if (exitosos.length > 0) {
          mensaje += `${'='.repeat(60)}\n`;
          mensaje += `📋 LECTURAS CREADAS:\n`;
          mensaje += `${'='.repeat(60)}\n\n`;

          exitosos.forEach((l, idx) => {
            mensaje += `${idx + 1}. Medidor: ${l.num_medidor}\n`;
            mensaje += `   📊 Lectura Anterior: ${l.lectura_anterior} m³\n`;
            mensaje += `   📊 Lectura Actual: ${l.lectura_actual} m³\n`;
            mensaje += `   💧 Consumo: ${l.consumo_m3} m³\n`;
            mensaje += `   🆔 ID Lectura: ${l.id_lectura}\n\n`;
          });
        }

        if (fallidos.length > 0) {
          mensaje += `${'='.repeat(60)}\n`;
          mensaje += `❌ ERRORES ENCONTRADOS:\n`;
          mensaje += `${'='.repeat(60)}\n\n`;

          fallidos.forEach((f, idx) => {
            mensaje += `${idx + 1}. Fila ${f.fila}\n`;
            if (f.num_medidor) mensaje += `   Medidor: ${f.num_medidor}\n`;
            mensaje += `   ⚠️ Error: ${f.error}\n\n`;
          });
        }

        alert(mensaje);
        closeModal();
        setExcelPreview([]);
        setSelectedExcel(null);
        await fetchReadings();
      } else {
        setError(result.message || "Error al procesar lecturas");
      }
    } catch (error) {
      console.error('Error en carga masiva:', error);
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

  if (loading) {
    return (
      <div className="affiliates-section">
        <div className="empty-state">
          <RefreshCw className="w-16 h-16 text-blue-400 mx-auto mb-4 animate-spin" />
          <h3>Cargando lecturas...</h3>
          <p>Por favor espera mientras cargamos la información...</p>
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDERIZADO PRINCIPAL
  // ============================================================
  return (
    <div className="affiliates-section">
      
      {/* ==================== ENCABEZADO ==================== */}
      <div className="section-header">
        <div className="section-title">
          <BookOpen className="w-7 h-7 text-blue-600" />
          <h2>Gestión de Lecturas</h2>
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

      {/* ==================== BARRA DE BÚSQUEDA Y FILTROS ==================== */}
      <div className="filters-section">
        <div className="search-container">
          <Search className="search-icon" />
          <input
            type="text"
            placeholder="Buscar por medidor, código, nombre, ID u observación..."
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filters-right">
          <select
            className="filter-select"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
          >
            <option value="all">Todos los meses</option>
            <option value="1">Enero</option>
            <option value="2">Febrero</option>
            <option value="3">Marzo</option>
            <option value="4">Abril</option>
            <option value="5">Mayo</option>
            <option value="6">Junio</option>
            <option value="7">Julio</option>
            <option value="8">Agosto</option>
            <option value="9">Septiembre</option>
            <option value="10">Octubre</option>
            <option value="11">Noviembre</option>
            <option value="12">Diciembre</option>
          </select>

          <select
            className="filter-select"
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
          >
            <option value="all">Todos los años</option>
            {getAvailableYears().map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
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

          <button className="btn-secondary" onClick={fetchReadings} title="Recargar lista">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ==================== ESTADÍSTICAS ==================== */}
      <div className="users-stats">
        <div
          className={`stat-item ${filterStatus === 'all' ? 'active' : ''}`}
          onClick={() => handleStatusFilterClick('all')}
        >
          <BookOpen className="stat-icon text-blue-600" />
          <div>
            <p className="stat-label">Total Lecturas</p>
            <p className="stat-value">{readings.length}</p>
          </div>
        </div>

        <div
          className={`stat-item ${filterStatus === 'active' ? 'active green' : ''}`}
          onClick={() => handleStatusFilterClick('active')}
        >
          <CheckCircle className="stat-icon text-green-600" />
          <div>
            <p className="stat-label">Lecturas Activas</p>
            <p className="stat-value">{readings.filter(r => r.activo).length}</p>
          </div>
        </div>

        <div
          className={`stat-item ${filterStatus === 'inactive' ? 'active red' : ''}`}
          onClick={() => handleStatusFilterClick('inactive')}
        >
          <XCircle className="stat-icon text-red-600" />
          <div>
            <p className="stat-label">Lecturas Inactivas</p>
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

      {/* ==================== MENSAJE DE ERROR ==================== */}
      {error && (
        <div className="alert alert-error mb-4">
          <AlertCircle className="w-5 h-5 mr-2" />
          {error}
        </div>
      )}

      {/* ==================== LISTA DE LECTURAS ==================== */}
      <div className="readings-list-container">
        <div className="readings-list-header">
          <span>#</span>
          <span><Gauge className="w-4 h-4" /> Medidor</span>
          <span><User className="w-4 h-4" /> Nombre</span>
          <span>Código</span>
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
            sortedReadings.map((reading) => {
              const consumoClass = reading.consumo_m3 > 100 ? 'alto' : reading.consumo_m3 > 50 ? 'medio' : '';
              
              return (
                <div 
                  key={reading.id_lectura} 
                  className={`readings-list-item ${!reading.activo ? 'inactive' : ''}`}
                >
                  <div className="list-col-id">{reading.id_lectura}</div>

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
              <h3>No se encontraron lecturas</h3>
              <p>No hay lecturas que coincidan con los criterios de búsqueda.</p>
            </div>
          )}
        </div>

        {sortedReadings.length > 0 && (
          <div className="readings-list-footer">
            <span>
              Mostrando <strong>{sortedReadings.length}</strong> de <strong>{readings.length}</strong> lecturas
            </span>
            <span>
              Consumo total: <strong>{sortedReadings.reduce((sum, r) => sum + (r.consumo_m3 || 0), 0)} m³</strong>
            </span>
          </div>
        )}
      </div>

      {/* ==================== MODALES ==================== */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>
                {modalType === 'create' && 'Crear Nueva Lectura'}
                {modalType === 'edit' && 'Editar Lectura'}
                {modalType === 'view' && 'Detalles de la Lectura'}
                {modalType === 'excel' && 'Crear lecturas desde Excel'}
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

              {/* ==================== MODAL DE EXCEL ==================== */}
              {modalType === 'excel' && (
                <div className="user-form">
                  <div className="form-grid">
                    <div className="form-group form-group-full" style={{ marginBottom: "12px" }}>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={handleDownloadTemplate}
                        style={{ display: "flex", alignItems: "center" }}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Descargar plantilla Excel
                      </button>
                      <small className="text-gray-500 mt-1">
                        Descarga la plantilla con los medidores y sus últimas lecturas.
                      </small>
                    </div>

                    <div className="form-group form-group-full">
                      <label>Seleccionar archivo Excel *</label>
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleExcelPreview}
                        className="file-input"
                      />
                      <small className="text-gray-500 mt-1">
                        📋 <strong>Formato requerido:</strong> Excel (.xlsx, .xls)
                        <br /><br />
                        📝 <strong>Columnas obligatorias:</strong><br />
                        &nbsp;&nbsp;&nbsp;• num_medidor, sector, codigo_afiliado<br />
                        &nbsp;&nbsp;&nbsp;• nombre_afiliado, lectura_anterior<br />
                        &nbsp;&nbsp;&nbsp;• lectura_actual, observacion (opcional)
                      </small>
                    </div>

                    {selectedExcel && (
                      <div className="form-group form-group-full">
                        <div className="alert alert-info">
                          <AlertCircle className="w-5 h-5 mr-2" />
                          <div>
                            <strong>Archivo seleccionado:</strong> {selectedExcel.name}
                            <br />
                            <small>Tamaño: {(selectedExcel.size / 1024).toFixed(2)} KB</small>
                          </div>
                        </div>
                      </div>
                    )}

                    {excelPreview.length > 0 && (
                      <div className="form-group form-group-full">
                        <label>
                          📊 Vista previa ({excelPreview.length} lecturas)
                          {excelPreview.length > 500 && (
                            <span className="text-red-600 ml-2">⚠️ Excede el límite de 500</span>
                          )}
                        </label>

                        <div style={{
                          maxHeight: '400px',
                          overflowY: 'auto',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          backgroundColor: '#fff'
                        }}>
                          <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                            <thead style={{
                              position: 'sticky',
                              top: 0,
                              backgroundColor: '#f9fafb',
                              borderBottom: '2px solid #e5e7eb',
                              zIndex: 1
                            }}>
                              <tr>
                                <th style={{ padding: '8px', textAlign: 'left' }}>#</th>
                                <th style={{ padding: '8px', textAlign: 'left' }}>Medidor</th>
                                <th style={{ padding: '8px', textAlign: 'left' }}>Sector</th>
                                <th style={{ padding: '8px', textAlign: 'left' }}>Código</th>
                                <th style={{ padding: '8px', textAlign: 'left' }}>Nombre</th>
                                <th style={{ padding: '8px', textAlign: 'right' }}>Lect. Ant.</th>
                                <th style={{ padding: '8px', textAlign: 'right' }}>Lect. Act.</th>
                                <th style={{ padding: '8px', textAlign: 'right' }}>Consumo</th>
                                <th style={{ padding: '8px', textAlign: 'center' }}>Estado</th>
                              </tr>
                            </thead>
                            <tbody>
                              {excelPreview.map((lectura, idx) => {
                                const esValido =
                                  lectura.num_medidor &&
                                  lectura.lectura_actual &&
                                  parseInt(lectura.lectura_actual) >= parseInt(lectura.lectura_anterior || 0);
                                const consumo = parseInt(lectura.lectura_actual || 0) - parseInt(lectura.lectura_anterior || 0);

                                return (
                                  <tr
                                    key={idx}
                                    style={{
                                      borderBottom: '1px solid #f3f4f6',
                                      backgroundColor: esValido ? 'transparent' : '#fef2f2'
                                    }}
                                  >
                                    <td style={{ padding: '8px', color: '#6b7280' }}>{idx + 1}</td>
                                    <td style={{ padding: '8px' }}>
                                      {lectura.num_medidor || <span style={{ color: '#ef4444' }}>❌ Falta</span>}
                                    </td>
                                    <td style={{ padding: '8px' }}>{lectura.sector || '-'}</td>
                                    <td style={{ padding: '8px' }}>{lectura.codigo_afiliado || '-'}</td>
                                    <td style={{ padding: '8px' }}>{lectura.nombre_afiliado || '-'}</td>
                                    <td style={{ padding: '8px', textAlign: 'right' }}>{lectura.lectura_anterior || 0}</td>
                                    <td style={{ padding: '8px', textAlign: 'right' }}>
                                      {lectura.lectura_actual || <span style={{ color: '#ef4444' }}>❌ Falta</span>}
                                    </td>
                                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold', color: '#10b981' }}>
                                      {consumo} m³
                                    </td>
                                    <td style={{ padding: '8px', textAlign: 'center' }}>
                                      {esValido ? (
                                        <span style={{ color: '#10b981', fontSize: '12px' }}>✓ OK</span>
                                      ) : (
                                        <span style={{ color: '#ef4444', fontSize: '12px' }}>✗ Error</span>
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
                      disabled={excelPreview.length === 0 || excelPreview.length > 500 || loadingExcel}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {loadingExcel ? 'Procesando...' : `Crear ${excelPreview.length} lectura${excelPreview.length !== 1 ? 's' : ''}`}
                    </button>
                  </div>
                </div>
              )}

              {/* ==================== MODAL DE VISTA ==================== */}
              {modalType === 'view' && selectedReading && (
                <div className="user-details">
                  <div className="detail-group">
                    <label>ID Lectura:</label>
                    <p>{selectedReading.id_lectura}</p>
                  </div>
                  <div className="detail-group">
                    <label>Medidor:</label>
                    <p>{selectedReading.medidor?.num_medidor || 'N/A'}</p>
                  </div>
                  <div className="detail-group">
                    <label>Nombre Afiliado:</label>
                    <p>{selectedReading.medidor?.nombre_afiliado || 'Sin afiliado'}</p>
                  </div>
                  <div className="detail-group">
                    <label>Código Afiliado:</label>
                    <p>{selectedReading.medidor?.codigo_afiliado || '---'}</p>
                  </div>
                  <div className="detail-group">
                    <label>Sector:</label>
                    <p>{selectedReading.medidor?.sector || 'Sin sector'}</p>
                  </div>
                  <div className="detail-group">
                    <label>Lectura Anterior:</label>
                    <p>{selectedReading.lectura_anterior} m³</p>
                  </div>
                  <div className="detail-group">
                    <label>Lectura Actual:</label>
                    <p>{selectedReading.lectura_actual} m³</p>
                  </div>
                  <div className="detail-group">
                    <label>Consumo:</label>
                    <p className="text-green-700 font-semibold">{selectedReading.consumo_m3} m³</p>
                  </div>
                  <div className="detail-group">
                    <label>Fecha de Lectura:</label>
                    <p>{new Date(selectedReading.fecha_lectura + 'T00:00:00').toLocaleDateString('es-EC')}</p>
                  </div>
                  <div className="detail-group">
                    <label>Lector:</label>
                    <p>
                      {selectedReading.lector
                        ? `${selectedReading.lector.nombres} ${selectedReading.lector.apellidos}`
                        : 'N/A'}
                    </p>
                  </div>
                  {selectedReading.observacion && (
                    <div className="detail-group">
                      <label>Observación:</label>
                      <p>{selectedReading.observacion}</p>
                    </div>
                  )}
                  <div className="detail-group">
                    <label>Estado:</label>
                    <span className={`status-badge ${selectedReading.activo ? 'active' : 'inactive'}`}>
                      {selectedReading.activo ? (
                        <><CheckCircle className="w-3 h-3" /> Activa</>
                      ) : (
                        <><XCircle className="w-3 h-3" /> Inactiva</>
                      )}
                    </span>
                  </div>
                </div>
              )}

              {/* ==================== MODAL DE CREACIÓN/EDICIÓN ==================== */}
              {(modalType === 'create' || modalType === 'edit') && (
                <form onSubmit={handleSubmit} className="user-form">
                  <div className="form-grid">
                    
                    {/* ✅ NUEVO: Sección de medidor con buscador */}
                    <div className="form-group form-group-full">
                      <label>Medidor *</label>
                      
                      {/* ✅ Buscador de medidores (solo en crear) */}
                      {modalType === 'create' && (
                        <div className="meter-search-container" style={{ marginBottom: '10px' }}>
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px',
                            padding: '8px 12px',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            backgroundColor: '#f8fafc'
                          }}>
                            <Search className="w-4 h-4 text-gray-400" />
                            <input
                              type="text"
                              placeholder="Buscar por nombre, código o número de medidor..."
                              value={meterSearchTerm}
                              onChange={(e) => setMeterSearchTerm(e.target.value)}
                              style={{
                                border: 'none',
                                outline: 'none',
                                background: 'transparent',
                                width: '100%',
                                fontSize: '14px'
                              }}
                            />
                            {meterSearchTerm && (
                              <button
                                type="button"
                                onClick={() => setMeterSearchTerm('')}
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  cursor: 'pointer',
                                  padding: '2px'
                                }}
                              >
                                <X className="w-4 h-4 text-gray-400" />
                              </button>
                            )}
                          </div>
                          {meterSearchTerm && (
                            <small style={{ color: '#6b7280', marginTop: '4px', display: 'block' }}>
                              {filteredMeters.length} medidor(es) encontrado(s)
                            </small>
                          )}
                        </div>
                      )}

                      <select
                        required
                        value={formData.id_medidor || ''}
                        onChange={(e) => handleMedidorChange(e.target.value)}
                        disabled={modalType === 'edit'}
                        style={{ 
                          maxHeight: '200px',
                          fontSize: '14px'
                        }}
                      >
                        <option value="">Seleccione un medidor</option>
                        {filteredMeters.map(medidor => {
                          const nombreAfiliado = medidor.nombre_afiliado || 'Sin afiliado';
                          const codigoAfiliado = medidor.codigo_afiliado || 'S/C';
                          const sector = medidor.sector || 'Sin sector';
                          return (
                            <option key={medidor.id_medidor} value={medidor.id_medidor}>
                              {medidor.num_medidor} | {codigoAfiliado} | {nombreAfiliado} | {sector}
                            </option>
                          );
                        })}
                      </select>

                      {/* Información del medidor seleccionado */}
                      {selectedMeterInfo && (
                        <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <h4 className="font-semibold text-blue-900 mb-2 flex items-center">
                            <Gauge className="w-4 h-4 mr-2" />
                            Información del Medidor
                          </h4>
                          <div className="space-y-1 text-sm text-blue-800">
                            <p className="flex items-center">
                              <User className="w-4 h-4 mr-2" />
                              <strong className="mr-2">Afiliado: </strong>
                              <span>{selectedMeterInfo.nombre_afiliado ?? "Sin afiliado"}</span>
                            </p>
                            <p className="flex items-center">
                              <span className="w-4 h-4 mr-2 text-center font-bold">#</span>
                              <strong className="mr-2">Código: </strong>
                              <span>{selectedMeterInfo.codigo_afiliado ?? "---"}</span>
                            </p>
                            <p className="flex items-center">
                              <Map className="w-4 h-4 mr-2" />
                              <strong className="mr-2">Sector: </strong>
                              <span>{selectedMeterInfo.sector || 'Sin sector'}</span>
                            </p>
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
                      <small className="text-gray-500 mt-1">
                        {modalType === 'create' ? 'Autocompletado con la última lectura' : 'Puede modificar este valor'}
                      </small>
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
                      <small className="text-gray-500 mt-1">Calculado automáticamente</small>
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
