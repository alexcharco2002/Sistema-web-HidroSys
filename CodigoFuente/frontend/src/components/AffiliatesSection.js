// src/components/AffiliatesSection.js
// MÓDULO DE AFILIADOS - Con creación simultánea de medidor

import React, { useState, useEffect, useCallback  } from 'react';
import './AffiliatesSection.css';
import affiliatesService from '../services/affiliatesServices';
import sectorsService from '../services/sectorServices';
import authService from '../services/authServices';
import * as XLSX from "xlsx";

import {
  UserPlus, Search, Edit, Trash2, Eye, UserCheck, UserX, Phone, MapPin, Calendar, X, Save, RefreshCw, AlertCircle, 
  CheckCircle, XCircle, Map, ArrowUpDown, Gauge, IdCard, Plus, FileSpreadsheet
} from 'lucide-react';

const AffiliatesSection = () => {
  // ==================== ESTADOS ====================
  const [affiliates, setAffiliates] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm] = useState(searchTerm);
  const [filterSector, setFilterSector] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('create');
  const [selectedAffiliate, setSelectedAffiliate] = useState(null);
  const [error, setError] = useState(null);
  
  const [sortOption, setSortOption] = useState('codigo');
  const [sortOrder, setSortOrder] = useState('asc');

  // Estado para controlar si se quiere crear medidor junto con el afiliado
  const [createWithMeter, setCreateWithMeter] = useState(false);
  
  // ===== Variables para carga desde Excel =====
  const [selectedExcel, setSelectedExcel] = useState(null);
  const [excelPreview, setExcelPreview] = useState([]);
  const [, setLoadingExcel] = useState(false); // ✅ CORREGIDO: remover la coma inicial

  // ==== Función para leer Excel ====
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

      // 🔥 Normalizar todas las filas
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

  // Limpia claves del Excel (quita espacios, saltos, unicode raro)
const normalizeKeys = (obj) => {
  const newObj = {};
  Object.keys(obj).forEach((key) => {
    const cleanKey = key
      .toString()
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^\w]/g, "") // Solo letras, números y _
      .toLowerCase();

    newObj[cleanKey] = obj[key];
  });

  return newObj;
};



// ==== Función para subir Excel ====
  const handleExcelUpload = async () => {
    if (excelPreview.length === 0) {
      setError("No hay datos para enviar");
      return;
    }

    if (excelPreview.length > 100) {
      setError("Máximo 100 afiliados por carga");
      return;
    }

    setLoadingExcel(true);
    setError(null);

    try {
      const result = await affiliatesService.createManyAffiliates(excelPreview);

      if (result.success) {
        const { exitosos, fallidos, total_procesados } = result.data;
        
        let mensaje = `📊 RESULTADO DE LA CARGA MASIVA\n`;
        mensaje += `${'='.repeat(60)}\n\n`;
        mensaje += `✅ Afiliados creados: ${exitosos.length}/${total_procesados}\n`;
        mensaje += `❌ Errores: ${fallidos.length}/${total_procesados}\n\n`;
        
        if (exitosos.length > 0) {
          mensaje += `${'='.repeat(60)}\n`;
          mensaje += `📋 AFILIADOS Y MEDIDORES CREADOS:\n`;
          mensaje += `${'='.repeat(60)}\n\n`;
          
          exitosos.forEach((a, idx) => {
            mensaje += `${idx + 1}. ${a.nombre_usuario} (${a.cedula})\n`;
            mensaje += `   🔢 Código Afiliado: ${a.cod_usuario_afi}\n`;
            mensaje += `   📍 Sector: ${a.sector}\n`;
            mensaje += `   📟 Medidor: ${a.num_medidor}\n`;
            mensaje += `   🆔 ID Afiliado: ${a.id_usuario_afi}\n`;
            mensaje += `   🆔 ID Medidor: ${a.id_medidor}\n\n`;
          });
        }
        
        if (fallidos.length > 0) {
          mensaje += `${'='.repeat(60)}\n`;
          mensaje += `❌ ERRORES ENCONTRADOS:\n`;
          mensaje += `${'='.repeat(60)}\n\n`;
          
          fallidos.forEach((f, idx) => {
            mensaje += `${idx + 1}. Fila ${f.fila}\n`;
            if (f.nombre_usuario) mensaje += `   Usuario: ${f.nombre_usuario}\n`;
            if (f.id_usuario_sistema) mensaje += `   ID Usuario: ${f.id_usuario_sistema}\n`;
            if (f.num_medidor) mensaje += `   Medidor: ${f.num_medidor}\n`;
            mensaje += `   ⚠️ Error: ${f.error}\n\n`;
          });
        }
        
        alert(mensaje);
        
        // ✅ Cerrar modal y limpiar ANTES de recargar
        closeModal();
        setExcelPreview([]);
        setSelectedExcel(null);
        
        // ✅ Recargar después de limpiar
        await fetchAffiliates();
        
      } else {
        setError(result.message || "Error al procesar afiliados");
      }

    } catch (error) {
      console.error('Error en carga masiva:', error);
      setError(error.message || "Error al enviar afiliados");
    } finally {
      setLoadingExcel(false);
    }
  };



  const [formData, setFormData] = useState({
    id_usuario_sistema: null,
    id_sector: null,
    activo: true
  });

  // Estado para datos del medidor
  const [meterFormData, setMeterFormData] = useState({
    num_medidor: '',
    latitud: '',
    longitud: '',
    altitud: '',
    id_sector: null,
    activo: true
  });

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
    loadSectors();
  }, []);

  

  // ==================== FUNCIONES DE PERMISOS ====================
  
  const loadUserPermissions = () => {
    const canCreate = authService.hasPermission('afiliados', 'crear') || 
                     authService.hasPermission('afiliados', 'crud');
    
    const canUpdate = authService.hasPermission('afiliados', 'actualizar') || 
                     authService.hasPermission('afiliados', 'crud');
    
    const canDelete = authService.hasPermission('afiliados', 'eliminar') || 
                     authService.hasPermission('afiliados', 'crud');

    const canRead = authService.hasPermission('afiliados', 'lectura') || canCreate || canUpdate || canDelete ||
                    authService.hasPermission('afiliados', 'crud'); 
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
  
  const loadSectors = async () => {
    try {
      const result = await sectorsService.getSectors();
      if (result.success) {
        setSectors(result.data.filter(s => s.activo));
      }
    } catch (error) {
      console.error('Error al cargar sectores:', error);
    }
  };

  const fetchAffiliates = useCallback(async () => {
    if (!permissions.canRead) {
      setError('No tienes permiso para ver afiliados');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const result = await affiliatesService.getAffiliates({
        search: debouncedSearchTerm,
        id_sector: filterSector === 'all' ? undefined : filterSector,
        activo: filterStatus === 'all' ? undefined : filterStatus === 'active'
      });

      if (result.success) {
        setAffiliates(result.data);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Error al cargar afiliados desde el servidor');
    } finally {
      setLoading(false);
    }
  }, [filterSector, filterStatus, debouncedSearchTerm, permissions.canRead]);

  useEffect(() => {
    if (permissions.canRead) {
      fetchAffiliates();
    }
  }, [debouncedSearchTerm, filterSector, filterStatus, permissions.canRead, fetchAffiliates]);

  const fetchAvailableUsers = async (search = '') => {
    try {
      const result = await affiliatesService.getAvailableUsers(search);
      if (result.success) {
        setAvailableUsers(result.data);
      }
    } catch (error) {
      console.error('Error al cargar usuarios disponibles:', error);
    }
  };

  // ==================== FUNCIONES DE EXCEL ====================

  const handleDownloadTemplate = async () => {
    try {
      const result = await affiliatesService.downloadTemplate();
      if (result.success) {
        alert('✅ Plantilla descargada correctamente');
      } else {
        alert('❌ Error: ' + result.message);
      }
    } catch (error) {
      alert('❌ Error al descargar plantilla');
    }
  };

  // ==================== FUNCIONES AUXILIARES ====================

  const hasMeter = (affiliate) => {
    return affiliate?.medidores && 
           Array.isArray(affiliate.medidores) && 
           affiliate.medidores.length > 0 &&
           affiliate.medidores.some(m => m.activo);
  };

  const getMeterInfo = (affiliate) => {
    if (!affiliate?.medidores || !Array.isArray(affiliate.medidores)) {
      return null;
    }

    const activeMeters = affiliate.medidores.filter(m => m.activo);
    
    if (activeMeters.length === 0) {
      return null;
    }

    if (activeMeters.length === 1) {
      return {
        count: 1,
        primary: activeMeters[0],
        all: activeMeters
      };
    }

    return {
      count: activeMeters.length,
      primary: activeMeters[0],
      all: activeMeters
    };
  };

  const getMeterNumber = (affiliate) => {
    const meterInfo = getMeterInfo(affiliate);
    
    if (!meterInfo) {
      return null;
    }

    if (meterInfo.count === 1) {
      return meterInfo.primary.num_medidor;
    }

    return `${meterInfo.count} medidores`;
  };

  // ==================== FUNCIONES DE FILTRADO Y ORDENAMIENTO ====================
  
  const filteredAffiliates = affiliates.filter(aff => {
    const matchesSearch = 
      aff.usuario?.nombres.toLowerCase().includes(searchTerm.toLowerCase()) ||
      aff.usuario?.apellidos.toLowerCase().includes(searchTerm.toLowerCase()) ||
      aff.usuario?.cedula.includes(searchTerm) ||
      aff.cod_usuario_afi.toString().includes(searchTerm);
    
    const matchesSector = filterSector === 'all' || aff.id_sector === parseInt(filterSector);
    
    const matchesStatus = filterStatus === 'all' || 
                          (filterStatus === 'active' && aff.activo) ||
                          (filterStatus === 'inactive' && !aff.activo);
    
    return matchesSearch && matchesSector && matchesStatus;
  });

  const sortedAffiliates = [...filteredAffiliates].sort((a, b) => {
    let comparison = 0;
    
    if (sortOption === 'codigo') {
      comparison = a.cod_usuario_afi - b.cod_usuario_afi;
    } 
    else if (sortOption === 'nombre') {
      const nombreA = a.usuario ? `${a.usuario.nombres} ${a.usuario.apellidos}`.toLowerCase() : '';
      const nombreB = b.usuario ? `${b.usuario.nombres} ${b.usuario.apellidos}`.toLowerCase() : '';
      comparison = nombreA.localeCompare(nombreB);
    } 
    else if (sortOption === 'fecha') {
      const fechaA = new Date(a.fecha_afiliacion || 0);
      const fechaB = new Date(b.fecha_afiliacion || 0);
      comparison = fechaA - fechaB;
    }
    else if (sortOption === 'sector') {
      const sectorA = a.sector?.nombre_sector?.toLowerCase() || '';
      const sectorB = b.sector?.nombre_sector?.toLowerCase() || '';
      comparison = sectorA.localeCompare(sectorB);
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
  
  const openModal = async (type, affiliate = null) => {
    if (type === 'create' && !permissions.canCreate) {
      alert('❌ No tienes permiso para crear afiliados');
      return;
    }
    if (type === 'edit' && !permissions.canUpdate) {
      alert('❌ No tienes permiso para editar afiliados');
      return;
    }
    if (type === 'assignMeter' && !permissions.canUpdate) {
      alert('❌ No tienes permiso para asignar medidores');
      return;
    }
    if (type === 'excel' && !permissions.canCreate) {
      alert('❌ No tienes permiso para crear afiliados');
      return;
    }

    if (type === 'assignMeter' && affiliate && hasMeter(affiliate)) {
      const meterNum = getMeterNumber(affiliate);
      alert(`⚠️ Este afiliado ya tiene un medidor asignado: ${meterNum}\n\nPara hacer cambios, diríjase al módulo de Medidores.`);
      return;
    }

    setModalType(type);
    setSelectedAffiliate(affiliate);
    setError(null);
    
    if (type === 'create') {
      await fetchAvailableUsers();
      setFormData({
        id_usuario_sistema: null,
        id_sector: sectors.length > 0 ? sectors[0].id_sector : null,
        activo: true
      });
      setCreateWithMeter(false);
      setMeterFormData({
        num_medidor: '',
        latitud: '',
        longitud: '',
        altitud: '',
        id_sector: sectors.length > 0 ? sectors[0].id_sector : null,
        activo: true
      });
    } else if (type === 'edit' && affiliate) {
      setFormData({
        id_sector: affiliate.id_sector,
        activo: affiliate.activo
      });
    } else if (type === 'assignMeter' && affiliate) {
      setMeterFormData({
        num_medidor: '',
        latitud: '',
        longitud: '',
        altitud: '',
        id_sector: affiliate.id_sector,
        activo: true
      });
    } else if (type === 'excel') {
      setExcelPreview([]);
      setSelectedExcel(null);
      setLoadingExcel(false);
    }
    
    setShowModal(true);
  };

 const closeModal = () => {
  // 🔥 Limpia en el orden correcto
  setExcelPreview([]);
  setSelectedExcel(null);
  setLoadingExcel(false);
  
  setShowModal(false);
  setSelectedAffiliate(null);
  setError(null);
  setAvailableUsers([]);
  setCreateWithMeter(false);
};

  // ==================== FUNCIONES DE CRUD ====================
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      let result;

      if (modalType === 'create') {
        if (!permissions.canCreate) {
          setError('No tienes permiso para crear afiliados');
          return;
        }

        if (!formData.id_usuario_sistema) {
          setError('Debe seleccionar un usuario');
          return;
        }

        if (!formData.id_sector) {
          setError('Debe seleccionar un sector');
          return;
        }

        if (createWithMeter) {
          if (!meterFormData.num_medidor.trim()) {
            setError('Debe ingresar un número de medidor');
            return;
          }
        }

        result = await affiliatesService.createAffiliate(formData);

        if (result.success) {
          const nuevoAfiliado = result.data;
          
          if (createWithMeter) {
            try {
              const metersService = (await import('../services/metersServices')).default;

              const dataToSend = {
                num_medidor: meterFormData.num_medidor.trim(),
                latitud: meterFormData.latitud ? parseFloat(meterFormData.latitud) : null,
                longitud: meterFormData.longitud ? parseFloat(meterFormData.longitud) : null,
                altitud: meterFormData.altitud ? parseFloat(meterFormData.altitud) : null,
                id_usuario_afi: nuevoAfiliado.id_usuario_afi,
                id_sector: meterFormData.id_sector || formData.id_sector,
                activo: true
              };

              const meterResult = await metersService.createMeter(dataToSend);

              if (meterResult.success) {
                alert(`✅ Afiliado y Medidor creados exitosamente.\n\nCódigo Afiliado: ${nuevoAfiliado.cod_usuario_afi}\nNúmero de Medidor: ${meterFormData.num_medidor}\nID Medidor: ${meterResult.data.id_medidor}`);
              } else {
                alert(`⚠️ Afiliado creado (Código: ${nuevoAfiliado.cod_usuario_afi}), pero hubo un error al crear el medidor:\n${meterResult.message}\n\nPuede asignar el medidor después desde el módulo de Medidores.`);
              }
            } catch (meterError) {
              console.error('Error al crear medidor:', meterError);
              alert(`⚠️ Afiliado creado (Código: ${nuevoAfiliado.cod_usuario_afi}), pero hubo un error al crear el medidor.\n\nPuede asignar el medidor después desde el módulo de Medidores.`);
            }
          } else {
            alert(`✅ Afiliado creado exitosamente.\nCódigo: ${nuevoAfiliado.cod_usuario_afi}`);
          }
          
          await fetchAffiliates();
          closeModal();
        } else {
          setError(result.message || 'Error al crear el afiliado');
        }

      } else if (modalType === 'edit') {
        if (!permissions.canUpdate) {
          setError('No tienes permiso para editar afiliados');
          return;
        }

        result = await affiliatesService.updateAffiliate(selectedAffiliate.id_usuario_afi, formData);
        
        if (result.success) {
          alert('✅ Cambios guardados correctamente');
          await fetchAffiliates();
          closeModal();
        } else {
          setError(result.message || 'Error al actualizar afiliado');
        }
      }

    } catch (error) {
      console.error('Error al guardar afiliado:', error);
      setError(error.message || 'Error al guardar afiliado');
    }
  };
  // 🔥 Memoriza la tabla para evitar re-renders innecesarios

  const handleMeterAssignment = async (e) => {
    e.preventDefault();
    setError(null);

    if (!permissions.canUpdate) {
      setError('No tienes permiso para asignar medidores');
      return;
    }

    if (hasMeter(selectedAffiliate)) {
      setError(`Este afiliado ya tiene el medidor ${getMeterNumber(selectedAffiliate)} asignado. Diríjase al módulo de Medidores para hacer cambios.`);
      return;
    }

    if (!meterFormData.num_medidor.trim()) {
      setError('Debe ingresar un número de medidor');
      return;
    }

    try {
      const metersService = (await import('../services/metersServices')).default;

      const dataToSend = {
        num_medidor: meterFormData.num_medidor.trim(),
        latitud: meterFormData.latitud ? parseFloat(meterFormData.latitud) : null,
        longitud: meterFormData.longitud ? parseFloat(meterFormData.longitud) : null,
        altitud: meterFormData.altitud ? parseFloat(meterFormData.altitud) : null,
        id_usuario_afi: selectedAffiliate.id_usuario_afi,
        id_sector: meterFormData.id_sector || selectedAffiliate.id_sector,
        activo: true
      };

      const result = await metersService.createMeter(dataToSend);

      if (result.success) {
        alert(`✅ Medidor asignado exitosamente al afiliado ${selectedAffiliate.usuario?.nombres} ${selectedAffiliate.usuario?.apellidos}.\n\nNúmero de Medidor: ${meterFormData.num_medidor}\nID Medidor: ${result.data.id_medidor}`);
        await fetchAffiliates();
        closeModal();
      } else {
        setError(result.message || 'Error al asignar el medidor');
      }

    } catch (error) {
      console.error('Error al asignar medidor:', error);
      setError(error.message || 'Error al asignar medidor');
    }
  };

  const handleDelete = async (affiliateId) => {
    if (!permissions.canDelete) {
      alert('❌ No tienes permiso para eliminar afiliados');
      return;
    }

    if (window.confirm('¿Estás seguro de que deseas eliminar este afiliado?')) {
      try {
        const result = await affiliatesService.deleteAffiliate(affiliateId);
        
        if (result.success) {
          alert(result.message);
          await fetchAffiliates();
        } else {
          alert('Error: ' + result.message);
        }
      } catch (error) {
        alert('Error al eliminar afiliado: ' + error.message);
      }
    }
  };

  const toggleAffiliateStatus = async (affiliateId) => {
    if (!permissions.canToggleStatus) {
      alert('❌ No tienes permiso para cambiar el estado de afiliados');
      return;
    }

    try {
      const result = await affiliatesService.toggleAffiliateStatus(affiliateId);
      
      if (result.success) {
        await fetchAffiliates();
      } else {
        alert('Error: ' + result.message);
      }
    } catch (error) {
      alert('Error al cambiar estado del afiliado');
    }
  };

  // ==================== RENDERIZADO ====================
  
  if (!permissions.canRead) {
    return (
      <div className="section-placeholder">
        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
        <h2>Acceso Denegado</h2>
        <p>No tienes permiso para acceder al módulo de afiliados.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="section-placeholder">
        <RefreshCw className="w-16 h-16 mx-auto mb-4 text-gray-400 animate-spin" />
        <h2>Cargando Afiliados</h2>
        <p>Por favor espera mientras cargamos la información...</p>
      </div>
    );
  }

  if (error && affiliates.length === 0) {
    return (
      <div className="section-placeholder">
        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
        <h2>Error al Cargar Afiliados</h2>
        <p>{error}</p>
        <button onClick={fetchAffiliates} className="btn-primary mt-4">
          <RefreshCw className="w-4 h-4 mr-2" />
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="affiliates-section">
      {/* ==================== ENCABEZADO ==================== */}
      <div className="section-header">
        <div className="section-title">
          <UserCheck className="w-7 h-7 text-blue-600" />
          <h2>Gestión de Afiliados</h2>
        </div>

        <div className="actions">
          {permissions.canCreate && (
            <button 
              className="btn-primary"
              onClick={() => openModal('create')}
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuevo afiliado
            </button>
          )}

          {permissions.canCreate && (
            <button 
              className="btn-primary"
              onClick={() => openModal('excel')}
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Crear desde Excel
            </button>
          )}
        </div>
      </div>

      {/* ==================== BARRA DE BÚSQUEDA Y FILTROS ==================== */}
      <div className="filters-section">

        {/* IZQUIERDA — Barra de búsqueda */}
        <div className="search-container">
          <Search className="search-icon" />
          <input
            type="text"
            placeholder="Buscar por nombre, cédula o código..."
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* DERECHA — Agrupamos todos los filtros */}
        <div className="filters-right">

          {/* 🏷️ Filtro por sector */}
          <select 
            className="filter-select"
            value={filterSector}
            onChange={(e) => setFilterSector(e.target.value)}
          >
            <option value="all">Todos los sectores</option>
            {sectors.map(sector => (
              <option key={sector.id_sector} value={sector.id_sector}>
                {sector.nombre_sector}
              </option>
            ))}
          </select>

          {/* 🔀 Ordenamiento */}
          <select
            className="filter-select"
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
          >
            <option value="codigo">Ordenar por Código</option>
            <option value="nombre">Ordenar por Nombre</option>
            <option value="fecha">Ordenar por Fecha</option>
            <option value="sector">Ordenar por Sector</option>
          </select>

          {/* ⬆⬇ Botón orden */}
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

          {/* 🔄 Recargar */}
          <button 
            className="btn-secondary"
            onClick={fetchAffiliates}
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
          <UserPlus className="stat-icon text-blue-600" />
          <div>
            <p className="stat-label">Total Afiliados</p>
            <p className="stat-value">{affiliates.length}</p>
          </div>
        </div>

        <div
          className={`stat-item ${filterStatus === 'active' ? 'active green' : ''}`}
          onClick={() => handleStatusFilterClick('active')}
        >
          <UserCheck className="stat-icon text-green-600" />
          <div>
            <p className="stat-label">Afiliados Activos</p>
            <p className="stat-value">{affiliates.filter(a => a.activo).length}</p>
          </div>
        </div>

        <div
          className={`stat-item ${filterStatus === 'inactive' ? 'active red' : ''}`}
          onClick={() => handleStatusFilterClick('inactive')}
        >
          <UserX className="stat-icon text-red-600" />
          <div>
            <p className="stat-label">Afiliados Inactivos</p>
            <p className="stat-value">{affiliates.filter(a => !a.activo).length}</p>
          </div>
        </div>

        <div className="stat-item">
          <Map className="stat-icon text-purple-600" />
          <div>
            <p className="stat-label">Sectores con Afiliados</p>
            <p className="stat-value">
              {new Set(affiliates.filter(a => a.activo).map(a => a.id_sector)).size}
            </p>
          </div>
        </div>
      </div>

      {/* ==================== GRID DE AFILIADOS ==================== */}
      <div className="users-grid">
        {sortedAffiliates.map(affiliate => (
          <div key={affiliate.id_usuario_afi} className={`user-card ${!affiliate.activo ? 'inactive' : ''}`}>
            <div className="user-card-header">
              <div className="user-info">
                {affiliate.usuario.foto ? (
                  <div className="user-avatar">
                    <img
                      src={affiliate.usuario.foto}
                      alt={affiliate.usuario.nombres}
                      className="user-avatar-img"
                    />
                  </div>
                ) : (
                  <div className="user-avatar user-avatar-empty">
                    <span>
                      {`${affiliate.usuario.nombres?.[0]?.toUpperCase() || ''}${affiliate.usuario.apellidos?.[0]?.toUpperCase() || ''}`}
                    </span>
                  </div>
                )}
                
                <div>
                  <h3 className="user-name">
                    {affiliate.usuario ? `${affiliate.usuario.nombres} ${affiliate.usuario.apellidos}` : 'Usuario no disponible'}
                  </h3>
                  <div className="user-meta">
                    <span className="status-badge-code">
                      Código: {affiliate.cod_usuario_afi}
                    </span>
                    <span className={`status-badge ${affiliate.activo ? 'active' : 'inactive'}`}>
                      {affiliate.activo ? (
                        <>
                          <CheckCircle className="w-3 h-3" />
                          Activo
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3" />
                          Inactivo
                        </>
                      )}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="user-actions">
                <button 
                  className="action-btn view"
                  onClick={() => openModal('view', affiliate)}
                  title="Ver detalles"
                >
                  <Eye className="w-4 h-4 icon-view" />
                </button>

                {permissions.canUpdate && (
                  <button 
                    className="action-btn view"
                    onClick={() => openModal('assignMeter', affiliate)}
                    title={hasMeter(affiliate) ? "Ya tiene medidor asignado" : "Asignar medidor"}
                    disabled={hasMeter(affiliate)}
                    style={hasMeter(affiliate) ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                  >
                    <Gauge className="w-4 h-4" />
                  </button>
                )}

                {permissions.canUpdate && (
                  <button 
                    className="action-btn edit"
                    onClick={() => openModal('edit', affiliate)}
                    title="Editar afiliado"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                )}

                {permissions.canToggleStatus && (
                  <button 
                    className="action-btn toggle"
                    onClick={() => toggleAffiliateStatus(affiliate.id_usuario_afi)}
                    title={affiliate.activo ? 'Desactivar' : 'Activar'}
                  >
                    {affiliate.activo ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                  </button>
                )}

                {permissions.canDelete && (
                  <button 
                    className="action-btn delete"
                    onClick={() => handleDelete(affiliate.id_usuario_afi)}
                    title="Eliminar afiliado"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            
            <div className="user-card-body">
              <div className="user-contact">
                <div className="contact-item flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-gray-400" />
                  <span className="font-semibold text-blue-700 meter-value">
                    <strong>Nº Medidor:</strong> {getMeterNumber(affiliate) || 'Sin medidor'}
                  </span>
                </div>

                <div className="contact-item">
                  <IdCard className="w-4 h-4 text-gray-400" />
                  <span>{affiliate.usuario?.cedula || 'N/A'}</span>
                </div>
               
                {affiliate.usuario?.telefono && (
                  <div className="contact-item">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span>{affiliate.usuario.telefono}</span>
                  </div>
                )}
                <div className="contact-item">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span>{affiliate.sector?.nombre_sector || 'Sin sector'}</span>
                </div>
                
              </div>
              
              {affiliate.fecha_afiliacion && (
                <div className="user-dates">
                  <div className="date-item">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span>Afiliado: {new Date(affiliate.fecha_afiliacion + 'T00:00:00').toLocaleDateString('es-EC')}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ==================== ESTADO VACÍO ==================== */}
      {sortedAffiliates.length === 0 && (
        <div className="empty-state">
          <UserPlus className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3>No se encontraron afiliados</h3>
          <p>No hay afiliados que coincidan con los criterios de búsqueda.</p>
        </div>
      )}

      {/* ==================== MODALES ==================== */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>
                {modalType === 'create' && 'Crear Nuevo Afiliado'}
                {modalType === 'edit' && 'Editar Afiliado'}
                {modalType === 'view' && 'Detalles del Afiliado'}
                {modalType === 'assignMeter' && 'Asignar Medidor al Afiliado'}
                {modalType === 'excel' && 'Crear afiliados desde Excel'}
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

              {/* ==================== MODAL DE CARGA DE AFILIADOS DESDE EXCEL ==================== */}
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
                        📥 Descargar plantilla Excel
                      </button>

                      <small className="text-gray-500 mt-1">
                        Descarga la plantilla para garantizar que el formato de columnas sea el correcto.
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
                        &nbsp;&nbsp;&nbsp;• id_usuario_sistema<br />
                        &nbsp;&nbsp;&nbsp;• nombres<br />
                        &nbsp;&nbsp;&nbsp;• apellidos<br />
                        &nbsp;&nbsp;&nbsp;• id_sector<br />
                        &nbsp;&nbsp;&nbsp;• num_medidor<br />
                        <br />
                        🗺️ <strong>Campos opcionales:</strong><br />
                        &nbsp;&nbsp;&nbsp;• latitud, longitud, altitud
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
                          📊 Vista previa ({excelPreview.length} filas)
                          {excelPreview.length > 100 && (
                            <span className="text-red-600 ml-2">⚠️ Excede el límite de 100 afiliados</span>
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
                                <th>#</th>
                                <th>ID Usuario Sistema</th>
                                <th>Nombres</th>
                                <th>Apellidos</th>
                                <th>ID Sector</th>
                                <th>Medidor</th>
                                <th>Lat</th>
                                <th>Lng</th>
                                <th>Alt</th>
                                <th>Estado</th>
                              </tr>
                            </thead>

                            <tbody>
  {excelPreview.map((a, idx) => {

    // 🟦 VALIDACIÓN DE CAMPOS OBLIGATORIOS
    const camposObligatorios =
      a.id_usuario_sistema &&
      a.nombres &&
      a.apellidos &&
      a.id_sector;

    // 🟩 Validación longitud mínima
    const medidorTieneMinLongitud =
      a.num_medidor &&
      String(a.num_medidor).trim().length >= 3;

    // 🟨 Validación caracteres permitidos (solo letras y números)
    const medidorSoloAlfanumerico =
      /^[A-Za-z0-9]+$/.test(String(a.num_medidor || '').trim());

    // 🟥 Validación de duplicados dentro del archivo
    const medidorDuplicado =
      excelPreview.filter(x => String(x.num_medidor).trim() === String(a.num_medidor).trim()).length > 1;

    // Resultado final
    const esMedidorValido =
      a.num_medidor &&
      medidorTieneMinLongitud &&
      medidorSoloAlfanumerico &&
      !medidorDuplicado;

    const esValidaFila =
      camposObligatorios && esMedidorValido;

    return (
      <tr
        key={idx}
        style={{
          borderBottom: '1px solid #f3f4f6',
          backgroundColor: esValidaFila ? 'transparent' : '#fef2f2'
        }}
      >

        <td style={{ padding: '8px', color: '#6b7280' }}>{idx + 1}</td>

        {/* id_usuario_sistema */}
        <td style={{ padding: '8px' }}>
          {a.id_usuario_sistema || <span style={{ color: '#ef4444' }}>❌ Falta</span>}
        </td>

        {/* nombres */}
        <td style={{ padding: '8px' }}>
          {a.nombres || <span style={{ color: '#ef4444' }}>❌ Falta</span>}
        </td>

        {/* apellidos */}
        <td style={{ padding: '8px' }}>
          {a.apellidos || <span style={{ color: '#ef4444' }}>❌ Falta</span>}
        </td>

        {/* id_sector */}
        <td style={{ padding: '8px' }}>
          {a.id_sector || <span style={{ color: '#ef4444' }}>❌ Falta</span>}
        </td>

        {/* num_medidor – VALIDACIONES COMPLETAS */}
        <td style={{ padding: '8px' }}>
          {!a.num_medidor ? (
            <span style={{ color: '#ef4444' }}>❌ Falta</span>
          ) : !medidorTieneMinLongitud ? (
            <span style={{ color: '#ef4444' }}>❌ Min 3 caracteres</span>
          ) : !medidorSoloAlfanumerico ? (
            <span style={{ color: '#ef4444' }}>
              ❌ Solo letras y números
            </span>
          ) : medidorDuplicado ? (
            <span style={{ color: '#ef4444' }}>
              ❌ Duplicado
            </span>
          ) : (
            a.num_medidor
          )}
        </td>

        <td style={{ padding: '8px' }}>{a.latitud || '-'}</td>
        <td style={{ padding: '8px' }}>{a.longitud || '-'}</td>
        <td style={{ padding: '8px' }}>{a.altitud || '-'}</td>

        {/* Estado */}
        <td style={{ padding: '8px' }}>
          {esValidaFila ? (
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
                            <li>Los afiliados se vincularán al usuario seleccionado.</li>
                            <li>El medidor será registrado automáticamente.</li>
                            <li>Límite máximo: 100 filas por carga.</li>
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
                      disabled={excelPreview.length === 0 || excelPreview.length > 100}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Crear {excelPreview.length} afiliado{excelPreview.length !== 1 ? 's' : ''}
                    </button>
                  </div>
                </div>
              )}



              {/* ==================== MODAL DE VISTA ==================== */}
              {modalType === 'view' && selectedAffiliate && (
                <div className="user-details">
                  <div className="detail-group">
                    <label>Código de Afiliado:</label>
                    <p>{selectedAffiliate.cod_usuario_afi}</p>
                  </div>
                  <div className="detail-group">
                    <label>Nombre Completo:</label>
                    <p>{selectedAffiliate.usuario ? `${selectedAffiliate.usuario.nombres} ${selectedAffiliate.usuario.apellidos}` : 'N/A'}</p>
                  </div>
                  <div className="detail-group">
                    <label>Cédula:</label>
                    <p>{selectedAffiliate.usuario?.cedula || 'N/A'}</p>
                  </div>
                  <div className="detail-group">
                    <label>Email:</label>
                    <p>{selectedAffiliate.usuario?.email || 'N/A'}</p>
                  </div>
                  <div className="detail-group">
                    <label>Teléfono:</label>
                    <p>{selectedAffiliate.usuario?.telefono || 'N/A'}</p>
                  </div>
                  <div className="detail-group">
                    <label>Sector:</label>
                    <p>{selectedAffiliate.sector?.nombre_sector || 'N/A'}</p>
                  </div>
                  <div className="detail-group">
                    <label>Fecha de Afiliación:</label>
                    <p>{selectedAffiliate.fecha_afiliacion ? new Date(selectedAffiliate.fecha_afiliacion).toLocaleDateString('es-EC') : 'N/A'}</p>
                  </div>
                  
                  {hasMeter(selectedAffiliate) && (() => {
                    const meterInfo = getMeterInfo(selectedAffiliate);
                    return (
                      <div className="contact-item">
                        <Gauge className="w-4 h-4 text-green-600" />
                        {meterInfo.count === 1 ? (
                          <span className="font-semibold text-green-700">
                            Medidor: {meterInfo.primary.num_medidor}
                          </span>
                        ) : (
                          <span className="font-semibold text-green-700">
                            {meterInfo.count} medidores asignados
                          </span>
                        )}
                      </div>
                    );
                  })()}
                  <div className="detail-group">
                    <label>Estado:</label>
                    <span className={`status-badge ${selectedAffiliate.activo ? 'active' : 'inactive'}`}>
                      {selectedAffiliate.activo ? (
                        <>
                          <CheckCircle className="w-3 h-3" />
                          Activo
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3" />
                          Inactivo
                        </>
                      )}
                    </span>
                  </div>
                </div>
              )}

              {/* ==================== MODAL DE CREACIÓN ==================== */}
              {modalType === 'create' && (
                <form onSubmit={handleSubmit} className="user-form">
                  <div className="form-grid">
                    <div className="form-group form-group-full">
                      <label>Seleccionar Usuario *</label>
                      <select
                        required
                        value={formData.id_usuario_sistema || ''}
                        onChange={(e) => setFormData({ ...formData, id_usuario_sistema: parseInt(e.target.value) })}
                      >
                        <option value="">Seleccione un usuario</option>
                        {availableUsers.map(user => (
                          <option key={user.id_usuario_sistema} value={user.id_usuario_sistema}>
                            {user.nombres} {user.apellidos} - {user.cedula}
                          </option>
                        ))}
                      </select>
                      <small className="text-gray-500 mt-1">
                        Solo se muestran usuarios no afiliados
                      </small>
                    </div>

                    <div className="form-group form-group-full">
                      <label>Sector *</label>
                      <select
                        required
                        value={formData.id_sector || ''}
                        onChange={(e) => setFormData({ ...formData, id_sector: parseInt(e.target.value) })}
                      >
                        <option value="">Seleccione un sector</option>
                        {sectors.map(sector => (
                          <option key={sector.id_sector} value={sector.id_sector}>
                            {sector.nombre_sector}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* CHECKBOX PARA CREAR MEDIDOR */}
                    <div className="form-group form-group-full">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={createWithMeter}
                          onChange={(e) => setCreateWithMeter(e.target.checked)}
                          className="w-4 h-4"
                        />
                        <Gauge className="w-5 h-5 text-blue-600" />
                        <span className="font-semibold">¿Crear medidor junto con el afiliado?</span>
                      </label>
                    </div>

                    {/* CAMPOS DEL MEDIDOR */}
                    {createWithMeter && (
                      <>
                        <div className="form-group form-group-full">
                          <hr className="my-2" />
                          <h4 className="font-semibold text-blue-700 flex items-center gap-2 mb-3">
                            <Gauge className="w-5 h-5" />
                            Datos del Medidor
                          </h4>
                        </div>

                        <div className="form-group form-group-full">
                          <label>Número de Medidor *</label>
                          <input
                            type="text"
                            required={createWithMeter}
                            value={meterFormData.num_medidor}
                            onChange={(e) => setMeterFormData({ ...meterFormData, num_medidor: e.target.value })}
                            placeholder="Ej: MED-001"
                          />
                        </div>

                        <div className="form-group form-group-full">
                          <label>Sector del Medidor</label>
                          <select
                            value={meterFormData.id_sector || formData.id_sector || ''}
                            onChange={(e) => setMeterFormData({ 
                              ...meterFormData, 
                              id_sector: e.target.value ? parseInt(e.target.value) : null 
                            })}
                          >
                            <option value="">Mismo sector del afiliado</option>
                            {sectors.map(sector => (
                              <option key={sector.id_sector} value={sector.id_sector}>
                                {sector.nombre_sector}
                              </option>
                            ))}
                          </select>
                          <small className="text-gray-500 mt-1">
                            Por defecto se usa el sector del afiliado
                          </small>
                        </div>

                        <div className="form-group">
                          <label>Latitud</label>
                          <input
                            type="number"
                            step="0.000001"
                            value={meterFormData.latitud}
                            onChange={(e) => setMeterFormData({ ...meterFormData, latitud: e.target.value })}
                            placeholder="Ej: -1.234567"
                          />
                        </div>

                        <div className="form-group">
                          <label>Longitud</label>
                          <input
                            type="number"
                            step="0.000001"
                            value={meterFormData.longitud}
                            onChange={(e) => setMeterFormData({ ...meterFormData, longitud: e.target.value })}
                            placeholder="Ej: -78.123456"
                          />
                        </div>

                        <div className="form-group form-group-full">
                          <label>Altitud (metros)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={meterFormData.altitud}
                            onChange={(e) => setMeterFormData({ ...meterFormData, altitud: e.target.value })}
                            placeholder="Ej: 2850"
                          />
                        </div>
                      </>
                    )}
                  </div>

                  <div className="form-actions">
                    <button type="button" className="btn-secondary" onClick={closeModal}>
                      Cancelar
                    </button>
                    <button type="submit" className="btn-primary">
                      <Save className="w-4 h-4 mr-2" />
                      {createWithMeter ? 'Crear Afiliado y Medidor' : 'Crear Afiliado'}
                    </button>
                  </div>
                </form>
              )}

              {/* ==================== MODAL DE EDICIÓN ==================== */}
              {modalType === 'edit' && (
                <form onSubmit={handleSubmit} className="user-form">
                  <div className="form-grid">
                    <div className="form-group form-group-full">
                      <label>Sector *</label>
                      <select
                        required
                        value={formData.id_sector || ''}
                        onChange={(e) => setFormData({ ...formData, id_sector: parseInt(e.target.value) })}
                      >
                        <option value="">Seleccione un sector</option>
                        {sectors.map(sector => (
                          <option key={sector.id_sector} value={sector.id_sector}>
                            {sector.nombre_sector}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Estado</label>
                      <select
                        value={formData.activo}
                        onChange={(e) => setFormData({ ...formData, activo: e.target.value === "true" })}
                      >
                        <option value="true">Activo</option>
                        <option value="false">Inactivo</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-actions">
                    <button type="button" className="btn-secondary" onClick={closeModal}>
                      Cancelar
                    </button>
                    <button type="submit" className="btn-primary">
                      <Save className="w-4 h-4 mr-2" />
                      Guardar Cambios
                    </button>
                  </div>
                </form>
              )}

              {/* ==================== MODAL DE ASIGNACIÓN DE MEDIDOR ==================== */}
              {modalType === 'assignMeter' && selectedAffiliate && (
                <>
                  {hasMeter(selectedAffiliate) ? (
                    <div className="p-6">
                      <div className="text-center mb-4">
                        <AlertCircle className="w-16 h-16 mx-auto text-yellow-500 mb-4" />
                        <h4 className="text-lg font-semibold text-gray-800 mb-2">
                          Medidor Ya Asignado
                        </h4>
                        <p className="text-gray-600 mb-4">
                          Este afiliado ya tiene el medidor <strong className="text-green-700">{getMeterNumber(selectedAffiliate)}</strong> asignado.
                        </p>
                      </div>
                      
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                        <p className="text-sm text-blue-800">
                          <strong>Afiliado:</strong> {selectedAffiliate.usuario?.nombres} {selectedAffiliate.usuario?.apellidos}
                          <br />
                          <strong>Código:</strong> {selectedAffiliate.cod_usuario_afi}
                          <br />
                          <strong>Medidor:</strong> {getMeterNumber(selectedAffiliate)}
                        </p>
                      </div>
                      
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                        <p className="text-sm text-yellow-800 flex items-center">
                          <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                          Para realizar cambios en el medidor, debe dirigirse al módulo de <strong className="ml-1">Medidores</strong>.
                        </p>
                      </div>
                      
                      <div className="form-actions">
                        <button type="button" className="btn-secondary" onClick={closeModal}>
                          Cerrar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleMeterAssignment} className="user-form">
                      <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <h4 className="font-semibold text-blue-900 mb-2 flex items-center">
                          <UserCheck className="w-5 h-5 mr-2" />
                          Afiliado Seleccionado
                        </h4>
                        <div className="space-y-1 text-sm text-blue-800">
                          <p><strong>Código:</strong> {selectedAffiliate.cod_usuario_afi}</p>
                          <p><strong>Nombre:</strong> {selectedAffiliate.usuario ? `${selectedAffiliate.usuario.nombres} ${selectedAffiliate.usuario.apellidos}` : 'N/A'}</p>
                          <p><strong>Sector:</strong> {selectedAffiliate.sector?.nombre_sector || 'N/A'}</p>
                        </div>
                      </div>

                      <div className="form-grid">
                        <div className="form-group form-group-full">
                          <label>Número de Medidor *</label>
                          <input
                            type="text"
                            required
                            value={meterFormData.num_medidor}
                            onChange={(e) => setMeterFormData({ ...meterFormData, num_medidor: e.target.value })}
                            placeholder="Ej: MED-001"
                          />
                        </div>

                        <div className="form-group form-group-full">
                          <label>Sector del Medidor</label>
                          <select
                            value={meterFormData.id_sector || selectedAffiliate.id_sector || ''}
                            onChange={(e) => setMeterFormData({ 
                              ...meterFormData, 
                              id_sector: e.target.value ? parseInt(e.target.value) : null 
                            })}
                          >
                            <option value="">Seleccione un sector</option>
                            {sectors.map(sector => (
                              <option key={sector.id_sector} value={sector.id_sector}>
                                {sector.nombre_sector}
                              </option>
                            ))}
                          </select>
                          <small className="text-gray-500 mt-1">
                            Por defecto se usa el sector del afiliado
                          </small>
                        </div>

                        <div className="form-group">
                          <label>Latitud</label>
                          <input
                            type="number"
                            step="0.000001"
                            value={meterFormData.latitud}
                            onChange={(e) => setMeterFormData({ ...meterFormData, latitud: e.target.value })}
                            placeholder="Ej: -1.234567"
                          />
                        </div>

                        <div className="form-group">
                          <label>Longitud</label>
                          <input
                            type="number"
                            step="0.000001"
                            value={meterFormData.longitud}
                            onChange={(e) => setMeterFormData({ ...meterFormData, longitud: e.target.value })}
                            placeholder="Ej: -78.123456"
                          />
                        </div>

                        <div className="form-group form-group-full">
                          <label>Altitud (metros)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={meterFormData.altitud}
                            onChange={(e) => setMeterFormData({ ...meterFormData, altitud: e.target.value })}
                            placeholder="Ej: 2850"
                          />
                        </div>
                      </div>

                      <div className="form-actions">
                        <button type="button" className="btn-secondary" onClick={closeModal}>
                          Cancelar
                        </button>
                        <button type="submit" className="btn-primary">
                          <Gauge className="w-4 h-4 mr-2" />
                          Asignar Medidor
                        </button>
                      </div>
                    </form>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
};

export default AffiliatesSection;