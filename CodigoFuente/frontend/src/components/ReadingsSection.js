// src/components/ReadingsSection.js
// MÓDULO DE LECTURAS - Con funcionalidad de Excel

import React, { useState, useEffect, useCallback } from 'react';
import './AffiliatesSection.css'; // Usa los mismos estilos
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
  FileText,
  User,
  Download,
  Upload,
  MapPin
} from 'lucide-react';

const ReadingsSection = () => {
  // ==================== ESTADOS ====================
  const [readings, setReadings] = useState([]);
  const [meters, setMeters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm] = useState(searchTerm);
  const [filterStatus, setFilterStatus] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('create');
  const [selectedReading, setSelectedReading] = useState(null);
  const [error, setError] = useState(null);
  const [sortOption, setSortOption] = useState('fecha');
  const [sortOrder, setSortOrder] = useState('desc');

  // ===== Variables para carga desde Excel =====
  const [selectedExcel, setSelectedExcel] = useState(null);
  const [excelPreview, setExcelPreview] = useState([]);
  const [loadingExcel, setLoadingExcel] = useState(false);

  const [formData, setFormData] = useState({
    id_medidor: null,
    lectura_actual: '',
    lectura_anterior: '',
    consumo_m3: '',
    fecha_lectura: new Date().toISOString().split('T')[0],
    observacion: '',
    activo: true
  });

  // Información adicional del medidor seleccionado
  const [selectedMeterInfo, setSelectedMeterInfo] = useState(null);

  const [permissions, setPermissions] = useState({
    canCreate: false,
    canRead: false,
    canUpdate: false,
    canDelete: false,
    canToggleStatus: false
  });

  // ==================== EFECTOS ====================
  useEffect(() => {
    loadUserPermissions();
    fetchMeters();
  }, []);

  // ==================== FUNCIONES DE PERMISOS ====================
  const loadUserPermissions = () => {
    const canCreate = authService.hasPermission('lecturas', 'crear') || authService.hasPermission('lecturas', 'crud');
    const canUpdate = authService.hasPermission('lecturas', 'actualizar') || authService.hasPermission('lecturas', 'crud');
    const canDelete = authService.hasPermission('lecturas', 'eliminar') || authService.hasPermission('lecturas', 'crud');
    const canRead = authService.hasPermission('lecturas', 'lectura') || canCreate || canUpdate || canDelete || authService.hasPermission('lecturas', 'crud');
    const canToggleStatus = canUpdate;

    setPermissions({
      canCreate,
      canRead,
      canUpdate,
      canDelete,
      canToggleStatus
    });
  };

  // ==================== FUNCIONES DE CARGA DE DATOS ====================
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

    // Reemplazar la función fetchMeters:
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


  // ==================== FUNCIONES DE EXCEL ====================
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

  // Limpia claves del Excel (quita espacios, saltos, unicode raro)
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

      const cleanedRows = rows.map((row) => normalizeKeys(row));
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

  // ==================== FUNCIONES DE FILTRADO Y ORDENAMIENTO ====================
  const filteredReadings = readings.filter(reading => {
    const matchesSearch =
      reading.medidor?.num_medidor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reading.observacion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reading.id_lectura.toString().includes(searchTerm);

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

  // ==================== FUNCIONES DE MODAL ====================
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

      // Cargar información del medidor
      const medidor = meters.find(m => m.id_medidor === reading.id_medidor);
      if (medidor) {
        setSelectedMeterInfo({
          medidor: medidor,
          afiliado: medidor.usuario_afiliado,
          sector: medidor.sector
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
  };

  // ==================== MANEJO DE CAMBIO DE MEDIDOR ====================
  const handleMedidorChange = async (id_medidor) => {
  if (!id_medidor) {
    setFormData(prev => ({ ...prev, id_medidor: null, lectura_anterior: '' }));
    setSelectedMeterInfo(null);
    return;
  }

  const medidor = meters.find(m => m.id_medidor === parseInt(id_medidor));

  if (medidor) {

    // ⬅️ EL CAMBIO IMPORTANTE: Guardar el medidor tal como viene
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


  // ==================== CALCULAR CONSUMO AUTOMÁTICAMENTE ====================
  useEffect(() => {
    if (formData.lectura_actual && formData.lectura_anterior !== '') {
      const consumo = parseInt(formData.lectura_actual) - parseInt(formData.lectura_anterior);
      setFormData(prev => ({ ...prev, consumo_m3: consumo }));
    }
  }, [formData.lectura_actual, formData.lectura_anterior]);

  // ==================== FUNCIONES DE CRUD ====================
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validaciones
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
          alert(`✅ Lectura creada exitosamente.\n\nMedidor: ${selectedMeterInfo?.medidor?.num_medidor}\nConsumo: ${formData.consumo_m3} m³\nID Lectura: ${result.data.id_lectura}`);
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

  const toggleReadingStatus = async (readingId) => {
    if (!permissions.canToggleStatus) {
      alert('❌ No tienes permiso para cambiar el estado de lecturas');
      return;
    }

    try {
      const result = await readingsServices.toggleLecturaStatus(readingId);

      if (result.success) {
        await fetchReadings();
      } else {
        alert('Error: ' + result.message);
      }
    } catch (error) {
      alert('Error al cambiar estado de la lectura');
    }
  };

  // ==================== RENDERIZADO ====================
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
              <button
                className="btn-primary"
                onClick={() => openModal('create')}
              >
                <Plus className="w-4 h-4 mr-2" />
                Nueva Lectura
              </button>

              <button
                className="btn-primary"
                onClick={() => openModal('excel')}
              >
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
            placeholder="Buscar por medidor, ID o observación..."
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filters-right">
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
            <span className="ml-1 text-xs">
              {sortOrder === 'asc' ? '↑' : '↓'}
            </span>
          </button>

          <button
            className="btn-secondary"
            onClick={fetchReadings}
            title="Recargar lista"
          >
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

     {/* ==================== GRID DE LECTURAS ==================== */}
<div className="users-grid">
  {sortedReadings.map(reading => (
    <div key={reading.id_lectura} className={`user-card ${!reading.activo ? 'inactive' : ''}`}>

      {/* HEADER */}
      <div className="user-card-header">
        <div className="user-info">
          <div className="user-avatar user-avatar-empty">
            <Gauge className="w-6 h-6" />
          </div>

          <div>
            <h3 className="user-name">
              {reading.medidor?.num_medidor || 'Medidor desconocido'}
            </h3>

            <div className="user-meta">
              <span className="status-badge-code">ID: {reading.id_lectura}</span>

              <span className={`status-badge ${reading.activo ? 'active' : 'inactive'}`}>
                {reading.activo ? (
                  <>
                    <CheckCircle className="w-3 h-3" />
                    Activa
                  </>
                ) : (
                  <>
                    <XCircle className="w-3 h-3" />
                    Inactiva
                  </>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* ACCIONES */}
        <div className="user-actions">
          <button className="action-btn view" onClick={() => openModal('view', reading)} title="Ver detalles">
            <Eye className="w-4 h-4 icon-view" />
          </button>

          {permissions.canUpdate && (
            <button className="action-btn edit" onClick={() => openModal('edit', reading)} title="Editar lectura">
              <Edit className="w-4 h-4" />
            </button>
          )}

          {permissions.canToggleStatus && (
            <button className="action-btn toggle" onClick={() => toggleReadingStatus(reading.id_lectura)}
              title={reading.activo ? 'Desactivar' : 'Activar'}>
              {reading.activo ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
            </button>
          )}

          {permissions.canDelete && (
            <button className="action-btn delete" onClick={() => handleDelete(reading.id_lectura)} title="Eliminar lectura">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* BODY */}
      <div className="user-card-body">

        {/* --- Lecturas --- */}
        <div className="user-contact">
          <div className="contact-item">
            <Gauge className="w-4 h-4 text-gray-400" />
            <span><strong>Lectura Anterior:</strong> {reading.lectura_anterior} m³</span>
          </div>

          <div className="contact-item">
            <Gauge className="w-4 h-4 text-gray-400" />
            <span><strong>Lectura Actual:</strong> {reading.lectura_actual} m³</span>
          </div>

          <div className="contact-item">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <span className="font-semibold text-green-700">
              <strong>Consumo:</strong> {reading.consumo_m3} m³
            </span>
          </div>

          <div className="contact-item">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span>{new Date(reading.fecha_lectura + 'T00:00:00').toLocaleDateString('es-EC')}</span>
          </div>
        </div>

        {/* --- NUEVA INFO: PROPIETARIO --- */}
        <div className="contact-item">
          <User className="w-4 h-4 text-blue-500" />
          <span>
            <strong>Propietario:</strong>{" "}
            {reading.medidor?.usuario_afiliado?.nombre_afiliado || "No registrado"}
          </span>
        </div>

        {/* --- NUEVA INFO: SECTOR --- */}
        <div className="contact-item">
          <MapPin className="w-4 h-4 text-red-500" />
          <span>
            <strong>Sector:</strong>{" "}
            {reading.medidor?.sector?.nombre_sector || "Sin sector"}
          </span>
        </div>

        {/* Observación */}
        {reading.observacion && (
          <div className="user-dates">
            <div className="date-item">
              <FileText className="w-4 h-4 text-gray-400" />
              <span>{reading.observacion}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  ))}
</div>


      {/* ==================== ESTADO VACÍO ==================== */}
      {sortedReadings.length === 0 && (
        <div className="empty-state">
          <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3>No se encontraron lecturas</h3>
          <p>No hay lecturas que coincidan con los criterios de búsqueda.</p>
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
                    {/* Botón para descargar plantilla */}
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

                    {/* Selector de archivo */}
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
                        &nbsp;&nbsp;&nbsp;• num_medidor<br />
                        &nbsp;&nbsp;&nbsp;• sector<br />
                        &nbsp;&nbsp;&nbsp;• codigo_afiliado<br />
                        &nbsp;&nbsp;&nbsp;• nombre_afiliado<br />
                        &nbsp;&nbsp;&nbsp;• lectura_anterior<br />
                        &nbsp;&nbsp;&nbsp;• lectura_actual<br />
                        &nbsp;&nbsp;&nbsp;• observacion (opcional)
                      </small>
                    </div>

                    {/* Archivo seleccionado */}
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

                    {/* Vista previa */}
                    {excelPreview.length > 0 && (
                      <div className="form-group form-group-full">
                        <label>
                          📊 Vista previa ({excelPreview.length} lecturas)
                          {excelPreview.length > 500 && (
                            <span className="text-red-600 ml-2">⚠️ Excede el límite de 500 lecturas</span>
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
                                <th style={{ padding: '8px', textAlign: 'left' }}>Cód. Afiliado</th>
                                <th style={{ padding: '8px', textAlign: 'left' }}>Nombre Afiliado</th>
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

                        <div style={{
                          marginTop: '12px',
                          padding: '12px',
                          backgroundColor: '#f9fafb',
                          borderRadius: '6px',
                          fontSize: '13px'
                        }}>
                          <strong>ℹ️ Información:</strong>
                          <ul style={{ marginTop: '8px', marginLeft: '20px' }}>
                            <li>Las lecturas se registrarán con la fecha actual.</li>
                            <li>El consumo se calculará automáticamente.</li>
                            <li>Límite máximo: 500 lecturas por carga.</li>
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Botones */}
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
                    <label>Fecha:</label>
                    <p>{new Date(selectedReading.fecha_lectura + 'T00:00:00').toLocaleDateString('es-EC')}</p>
                  </div>
                  <div className="detail-group">
                    <label>Lector:</label>
                    <p>{selectedReading.lector ? `${selectedReading.lector.nombres} ${selectedReading.lector.apellidos}` : 'N/A'}</p>
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
                        <>
                          <CheckCircle className="w-3 h-3" />
                          Activa
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3" />
                          Inactiva
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
                      <select
                        required
                        value={formData.id_medidor || ''}
                        onChange={(e) => handleMedidorChange(e.target.value)}
                        disabled={modalType === 'edit'}
                      >
                        <option value="">Seleccione un medidor</option>
                        {meters.map(medidor => {
                          const nombreAfiliado = medidor.nombre_afiliado || 'Sin afiliado';
                          const sector = medidor.sector || 'Sin sector';
                          return (
                            <option key={medidor.id_medidor} value={medidor.id_medidor}>
                            {medidor.num_medidor} | {nombreAfiliado} | {sector}
                            </option>
                          );
                        })}
                      </select>

                      {/* Información adicional del medidor seleccionado */}
                      {selectedMeterInfo && (
                        <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <h4 className="font-semibold text-blue-900 mb-2 flex items-center">
                            <Gauge className="w-4 h-4 mr-2" />
                            Información del Medidor
                          </h4>
                          <div className="space-y-1 text-sm text-blue-800">
                            <p className="flex items-center">
                              <User className="w-4 h-4 mr-2" />
                              <strong className="mr-2">Propietario: </strong>
                              <span className="ml-1">
                                {selectedMeterInfo.nombre_afiliado || "Sin afiliado"}


                              </span>
                            </p>
                            <p className="flex items-center">
                              <Map className="w-4 h-4 mr-2" />
                              <strong className="mr-2">Sector: </strong>
                              <span className="ml-1">
                                {selectedMeterInfo.sector || 'Sin sector'}
                              </span>
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
                      <small className="text-gray-500 mt-1">
                        Calculado automáticamente
                      </small>
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
