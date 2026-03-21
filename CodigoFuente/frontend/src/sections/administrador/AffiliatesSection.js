// src/sections/AffiliatesSection.js
// MÓDULO DE AFILIADOS - Con creación simultánea de medidor

import React, { useState, useEffect, useCallback  } from 'react';


import './AffiliatesSection.css';
import affiliatesService from '../../services/affiliatesServices';
import sectorsService from '../../services/sectorServices';
import authService from '../../services/authServices';
import * as XLSX from "xlsx";

import {
  UserPlus, Search, Edit, Trash2, Eye, UserCheck, UserX, Phone, MapPin, Calendar, X, Save, RefreshCw, AlertCircle, 
  CheckCircle, XCircle, Map, ArrowUpDown, Gauge, IdCard, Plus, FileSpreadsheet, Download, Users
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
  const [loadingExcel, setLoadingExcel] = useState(false); // ✅ CORREGIDO: remover la coma inicial

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

// ✅ FILTRAR: Solo filas válidas
const afiliadosValidos = excelPreview.filter((a) => {
  // Validar campos obligatorios
  const camposObligatorios = a.id_usuario_sistema && a.nombres && a.apellidos && a.id_sector;
  
  // ✅ Validación código de afiliado OPCIONAL pero si existe debe ser válido
  let codigoValido = true;
  if (a.cod_usuario_afi) {
    const codigo = String(a.cod_usuario_afi).trim().toUpperCase();
    if (codigo !== '') {
      // Verificar longitud
      if (codigo.length > 6) {
        codigoValido = false;
      }
      // Verificar caracteres (solo letras y números)
      if (!/^[A-Z0-9]+$/.test(codigo)) {
        codigoValido = false;
      }
    }
  }
  
  // Validar medidor
  const medidorTieneMinLongitud = a.num_medidor && String(a.num_medidor).trim().length >= 3;
  const medidorSoloAlfanumerico = /^[A-Za-z0-9]+$/.test(String(a.num_medidor).trim());
  const medidorDuplicado = excelPreview.filter(x => 
    String(x.num_medidor).trim() === String(a.num_medidor).trim()
  ).length > 1;
  const esMedidorValido = a.num_medidor && medidorTieneMinLongitud && medidorSoloAlfanumerico && !medidorDuplicado;

  return camposObligatorios && esMedidorValido && codigoValido;
});


    if (afiliadosValidos.length === 0) {
      setError("No hay afiliados válidos para importar");
      return;
    }

    if (afiliadosValidos.length > 500) {
      setError("Máximo 500 afiliados válidos por carga");
      return;
    }

    setLoadingExcel(true);
    setError(null);

    try {
      // ✅ Enviar solo afiliados válidos
      const result = await affiliatesService.createManyAffiliates(afiliadosValidos);

      if (result.success) {
        const { exitosos, fallidos, total_procesados } = result.data;
        const omitidos = excelPreview.length - afiliadosValidos.length;
        
        let mensaje = `📊 RESULTADO DE LA CARGA MASIVA\n`;
        mensaje += `${'='.repeat(60)}\n\n`;
        
        if (omitidos > 0) {
          mensaje += `⚠️ Filas omitidas (inválidas): ${omitidos}\n`;
        }
        
        mensaje += `✅ Afiliados + Medidores creados: ${exitosos.length}/${total_procesados}\n`;
        mensaje += `❌ Errores: ${fallidos.length}/${total_procesados}\n\n`;
        
        if (exitosos.length > 0) {
          mensaje += `${'='.repeat(60)}\n`;
          mensaje += `📋 AFILIADOS Y MEDIDORES CREADOS:\n`;
          mensaje += `${'='.repeat(60)}\n\n`;
          
          exitosos.slice(0, 10).forEach((a, idx) => {
            mensaje += `${idx + 1}. ${a.nombre_usuario} (${a.cedula})\n`;
            mensaje += `   🔢 Código Afiliado: ${a.cod_usuario_afi}\n`;
            mensaje += `   📍 Sector: ${a.sector}\n`;
            mensaje += `   📟 Medidor: ${a.num_medidor}\n`;
            mensaje += `   🆔 ID Afiliado: ${a.id_usuario_afi}\n`;
            mensaje += `   🆔 ID Medidor: ${a.id_medidor}\n\n`;
          });
          
          if (exitosos.length > 10) {
            mensaje += `... y ${exitosos.length - 10} más\n\n`;
          }
        }
        
        if (fallidos.length > 0) {
          mensaje += `${'='.repeat(60)}\n`;
          mensaje += `❌ ERRORES ENCONTRADOS:\n`;
          mensaje += `${'='.repeat(60)}\n\n`;
          
          fallidos.slice(0, 5).forEach((f, idx) => {
            mensaje += `${idx + 1}. Fila ${f.fila}\n`;
            if (f.nombre_usuario) mensaje += `   Usuario: ${f.nombre_usuario}\n`;
            if (f.id_usuario_sistema) mensaje += `   ID Usuario: ${f.id_usuario_sistema}\n`;
            if (f.num_medidor) mensaje += `   Medidor: ${f.num_medidor}\n`;
            mensaje += `   ⚠️ Error: ${f.error}\n\n`;
          });
          
          if (fallidos.length > 5) {
            mensaje += `... y ${fallidos.length - 5} errores más\n`;
          }
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
    cod_usuario_afi: '',
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

    setModalType(type);
    setSelectedAffiliate(affiliate);
    setError(null);
    
    if (type === 'create') {
      await fetchAvailableUsers();
      setFormData({
        id_usuario_sistema: '',
        id_sector: sectors.length > 0 ? sectors[0].id_sector : '',
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
        cod_usuario_afi: affiliate.cod_usuario_afi || '',
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

        // ✅ Validar código de afiliado si fue proporcionado
        if (formData.cod_usuario_afi && formData.cod_usuario_afi.trim() !== '') {
          const codigo = formData.cod_usuario_afi.trim().toUpperCase();
          
          // Validar formato
          if (codigo.length > 6) {
            setError('El código de afiliado no puede tener más de 6 caracteres');
            return;
          }
          
          if (!/^[A-Z0-9]+$/.test(codigo)) {
            setError('El código de afiliado solo puede contener letras y números');
            return;
          }
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
              const metersService = (await import('../../services/metersServices')).default;

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


  // ==================== FUNCIONES DE ASIGNACIÓN DE MEDIDOR Y ELIMINACIÓN ====================
  const handleMeterAssignment = async (e) => {
    e.preventDefault();
    setError(null);

    if (!permissions.canUpdate) {
      setError('No tienes permiso para asignar medidores');
      return;
    }

    if (!meterFormData.num_medidor.trim()) {
      setError('Debe ingresar un número de medidor');
      return;
    }

    try {
      const metersService = (await import('../../services/metersServices')).default;

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
      alert("❌ No tienes permiso para eliminar afiliados");
      return;
    }

    const confirmed = window.confirm(
      "¿Estás seguro de que deseas eliminar este afiliado? Esta acción no se puede deshacer."
    );
    if (!confirmed) return;

    try {
      const result = await affiliatesService.deleteAffiliate(affiliateId);

      if (result.success) {
        alert("✅ Afiliado eliminado: " + result.message);
        await fetchAffiliates();
      } else {
        alert("❌ Error al eliminar: " + result.message);
      }

    } catch (error) {
      alert("❌ Error al eliminar afiliado: " + error.message);
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
 
  // ==================== RENDER PRINCIPAL ====================
  return (
    <div className="affiliates-section">
      {/* ==================== ENCABEZADO ==================== */}
      <div className="section-header">
        <div className="section-title">
          <UserCheck className="w-7 h-7 text-blue-600" />
          <div>
            <h2>Gestión de Afiliados</h2>
            <p className="section-subtitle">
              Gestiona la información de los afiliados
            </p>
            </div>
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

      {/* ==================== ESTADÍSTICAS DE AFILIADOS ==================== */}
      <div className="periodo-stats-container">

        {/* Header */}
        <div className="periodo-stats-header">
          <UserPlus className="w-5 h-5 text-blue-600 mr-2" />
          <h3>Resumen de Afiliados</h3>
        </div>

        {/* Grid de estadísticas */}
        <div className="users-stats">

          {/* 📊 Total afiliados */}
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

          {/* ✅ Afiliados activos */}
          <div
            className={`stat-item ${filterStatus === 'active' ? 'active green' : ''}`}
            onClick={() => handleStatusFilterClick('active')}
          >
            <UserCheck className="stat-icon text-green-600" />
            <div>
              <p className="stat-label">Afiliados Activos</p>
              <p className="stat-value">
                {affiliates.filter(a => a.activo).length}
              </p>
            </div>
          </div>

          {/* ❌ Afiliados inactivos */}
          <div
            className={`stat-item ${filterStatus === 'inactive' ? 'active red' : ''}`}
            onClick={() => handleStatusFilterClick('inactive')}
          >
            <UserX className="stat-icon text-red-600" />
            <div>
              <p className="stat-label">Afiliados Inactivos</p>
              <p className="stat-value">
                {affiliates.filter(a => !a.activo).length}
              </p>
            </div>
          </div>

          {/* 🗺️ Sectores con afiliados activos */}
          <div className="stat-item">
            <Map className="stat-icon text-purple-600" />
            <div>
              <p className="stat-label">Sectores con Afiliados</p>
              <p className="stat-value">
                {
                  new Set(
                    affiliates
                      .filter(a => a.activo)
                      .map(a => a.id_sector)
                  ).size
                }
              </p>
            </div>
          </div>

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


     

      {/* ==================== GRID DE AFILIADOS ==================== */}
      <div className="users-grid">
        {sortedAffiliates.map(affiliate => (
          <div key={affiliate.id_usuario_afi} className={`user-card ${!affiliate.activo ? 'inactive' : ''}`}>
            <div className="user-card-header">
              <div className="user-info">
                {affiliate.usuario?.foto ? (
                  <div className="user-avatar">
                    <img
                      src={affiliate.usuario.foto}
                      alt={affiliate.usuario?.nombres}
                      className="user-avatar-img"
                    />
                  </div>
                ) : (
                  <div className="user-avatar user-avatar-empty">
                    <span>
                      {affiliate.usuario?.nombres?.charAt(0)?.toUpperCase() ?? '?'}
                      {affiliate.usuario?.apellidos?.charAt(0)?.toUpperCase() ?? ''}
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

                {permissions.canUpdate && !affiliate.num_medidor && (
                  <button 
                    className="action-btn view"
                    onClick={() => openModal('assignMeter', affiliate)}
                    title="Asignar medidor"
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
                    <strong>Medidores:</strong>{' '}
                    {affiliate.total_medidores > 0 ? (
                      <span>
                        {affiliate.total_medidores}{' '}
                        <span className="text-xs text-gray-500">
                          ({affiliate.medidores_activos} activo{affiliate.medidores_activos !== 1 ? 's' : ''})
                        </span>
                      </span>
                    ) : (
                      <span className="text-gray-400 italic">Sin medidores</span>
                    )}
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
                        className="btn-plantilla"
                        onClick={handleDownloadTemplate}
                        style={{ display: "flex", alignItems: "center" }}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Descargar plantilla Excel
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
                        <br /><br />
                        <strong>Límite máximo: 500 afiliados por carga</strong>
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
                          {(() => {
                            const validas = excelPreview.filter(a => {
                              const camposObligatorios =
                                a.id_usuario_sistema &&
                                a.nombres &&
                                a.apellidos &&
                                a.id_sector;

                              const medidorTieneMinLongitud =
                                a.num_medidor &&
                                String(a.num_medidor).trim().length >= 3;

                              const medidorSoloAlfanumerico =
                                /^[A-Za-z0-9]+$/.test(String(a.num_medidor || '').trim());

                              const medidorDuplicado =
                                excelPreview.filter(x => String(x.num_medidor).trim() === String(a.num_medidor).trim()).length > 1;

                              const esMedidorValido =
                                a.num_medidor &&
                                medidorTieneMinLongitud &&
                                medidorSoloAlfanumerico &&
                                !medidorDuplicado;

                              return camposObligatorios && esMedidorValido;
                            }).length;

                            const invalidas = excelPreview.length - validas;

                            return (
                              <ul className="ml-4 space-y-1">
                                <li className="text-green-600">✓ {validas} válidas</li>
                                {invalidas > 0 && (
                                  <li className="text-red-600">⚠️ {invalidas} inválidas (serán omitidas)</li>
                                )}
                              </ul>
                            );
                          })()}
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
                                <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: '600' }}>#</th>
                                <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: '600' }}>ID Usuario</th>
                                <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: '600' }}>Nombres</th>
                                <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: '600' }}>Apellidos</th>
                                <th style={{padding: '10px 8px', textAlign: 'left', fontWeight: '600'}}>Cód. Afiliado</th> {/* ✅ NUEVA COLUMNA */}
                                <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: '600' }}>ID Sector</th>
                                <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: '600' }}>Medidor</th>
                                <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: '600' }}>Lat</th>
                                <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: '600' }}>Lng</th>
                                <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: '600' }}>Alt</th>
                                <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: '600' }}>Estado</th>
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
                                
                                // Validación código de afiliado (OPCIONAL)
                                const codigoValido = !a.cod_usuario_afi || (
                                  String(a.cod_usuario_afi).trim().length <= 6 &&
                                  /^[A-Za-z0-9]+$/.test(String(a.cod_usuario_afi).trim())
                                );

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

                                    {/* cod_usuario_afi */}
                                    <td style={{padding: '8px'}}>
                                      {!a.cod_usuario_afi ? (
                                        <span style={{color: '#10b981'}}>AUTO</span>
                                      ) : !codigoValido ? (
                                        <span style={{color: '#ef4444'}}>
                                          {String(a.cod_usuario_afi).trim().length > 6 ? '❌ >6 caracteres' : '❌ Caracteres inválidos'}
                                        </span>
                                      ) : (
                                        <span style={{color: '#10b981'}}>{String(a.cod_usuario_afi).trim().toUpperCase()}</span>
                                      )}
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
                                          ❌ Solo letras/números
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

                        {/* ✅ RESUMEN MEJORADO */}
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
                            <li>Se generará código de afiliado secuencialmente.</li>
                            <li>Límite máximo: 500 filas válidas por carga.</li>
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
                      disabled={
                        excelPreview.length === 0 || 
                        (() => {
                          // ✅ Contar solo filas válidas
                          const validas = excelPreview.filter(a => {
                            const camposObligatorios =
                              a.id_usuario_sistema &&
                              a.nombres &&
                              a.apellidos &&
                              a.id_sector;

                            const medidorTieneMinLongitud =
                              a.num_medidor &&
                              String(a.num_medidor).trim().length >= 3;

                            const medidorSoloAlfanumerico =
                              /^[A-Za-z0-9]+$/.test(String(a.num_medidor || '').trim());

                            const medidorDuplicado =
                              excelPreview.filter(x => String(x.num_medidor).trim() === String(a.num_medidor).trim()).length > 1;

                            const esMedidorValido =
                              a.num_medidor &&
                              medidorTieneMinLongitud &&
                              medidorSoloAlfanumerico &&
                              !medidorDuplicado;

                            return camposObligatorios && esMedidorValido;
                          }).length;
                          return validas === 0 || validas > 500;
                        })() ||
                        loadingExcel
                      }
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {loadingExcel 
                        ? 'Procesando...' 
                        : (() => {
                            const validas = excelPreview.filter(a => {
                              const camposObligatorios =
                                a.id_usuario_sistema &&
                                a.nombres &&
                                a.apellidos &&
                                a.id_sector;

                              const medidorTieneMinLongitud =
                                a.num_medidor &&
                                String(a.num_medidor).trim().length >= 3;

                              const medidorSoloAlfanumerico =
                                /^[A-Za-z0-9]+$/.test(String(a.num_medidor || '').trim());

                              const medidorDuplicado =
                                excelPreview.filter(x => String(x.num_medidor).trim() === String(a.num_medidor).trim()).length > 1;

                              const esMedidorValido =
                                a.num_medidor &&
                                medidorTieneMinLongitud &&
                                medidorSoloAlfanumerico &&
                                !medidorDuplicado;

                              return camposObligatorios && esMedidorValido;
                            }).length;
                            return `Crear ${validas} afiliado${validas !== 1 ? 's' : ''} válido${validas !== 1 ? 's' : ''}`;
                          })()
                      }
                    </button>
                  </div>
                </div>
              )}
              
              {/* ==================== MODAL DE VISTA DE AFILIADO ==================== */}
              {modalType === 'view' && selectedAffiliate && (
                <div className="user-details">
                  <div className="detail-group">
                    <label>Código de Afiliado:</label>
                    <p>{selectedAffiliate.cod_usuario_afi}</p>
                  </div>
                  <div className="detail-group">
                    <label>Nombre Completo:</label>
                    <p>
                      {selectedAffiliate.usuario
                        ? `${selectedAffiliate.usuario.nombres} ${selectedAffiliate.usuario.apellidos}`
                        : 'N/A'}
                    </p>
                  </div>
                  <div className="detail-group">
                    <label>Cédula:</label>
                    <p>{selectedAffiliate.usuario?.cedula || 'N/A'}</p>
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
                    <p>
                      {selectedAffiliate.fecha_afiliacion
                        ? new Date(selectedAffiliate.fecha_afiliacion).toLocaleDateString('es-EC')
                        : 'N/A'}
                    </p>
                  </div>
                  <div className="detail-group">
                    <label>Estado:</label>
                    <span className={`status-badge ${selectedAffiliate.activo ? 'active' : 'inactive'}`}>
                      {selectedAffiliate.activo ? (
                        <><CheckCircle className="w-3 h-3" /> Activo</>
                      ) : (
                        <><XCircle className="w-3 h-3" /> Inactivo</>
                      )}
                    </span>
                  </div>

                  {/* ==================== SECCIÓN DE MEDIDORES ==================== */}
                  <div className="detail-group" style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Gauge className="w-4 h-4 text-green-600" />
                      Medidores Asignados
                      {selectedAffiliate.medidores?.length > 0 && (
                        <span style={{
                          background: '#d1fae5',
                          color: '#065f46',
                          borderRadius: '9999px',
                          padding: '1px 8px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                        }}>
                          {selectedAffiliate.medidores.length}
                        </span>
                      )}
                    </label>

                    {selectedAffiliate.medidores?.length > 0 ? (
                      <table style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: '0.875rem',
                        marginTop: '6px',
                      }}>
                        <thead>
                          <tr style={{ background: '#f0fdf4', borderBottom: '2px solid #bbf7d0' }}>
                            <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: '#065f46' }}>
                              # Medidor
                            </th>
                            <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: '#065f46' }}>
                              Sector
                            </th>
                            <th style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 600, color: '#065f46' }}>
                              Estado
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedAffiliate.medidores.map((medidor, index) => (
                            <tr
                              key={index}
                              style={{
                                borderBottom: '1px solid #d1fae5',
                                background: index % 2 === 0 ? '#fff' : '#f9fffe',
                              }}
                            >
                              <td style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Gauge className="w-3 h-3 text-gray-400" />
                                <span style={{ fontWeight: 500 }}>{medidor.num_medidor}</span>
                              </td>
                              <td style={{ padding: '6px 10px', color: '#374151' }}>
                                {medidor.sector || 'Sin sector'}
                              </td>
                              <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                                {medidor.activo ? (
                                  <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                    background: '#d1fae5', color: '#065f46',
                                    borderRadius: '9999px', padding: '2px 10px',
                                    fontSize: '0.75rem', fontWeight: 600,
                                  }}>
                                    <CheckCircle className="w-3 h-3" /> Activo
                                  </span>
                                ) : (
                                  <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                    background: '#fee2e2', color: '#991b1b',
                                    borderRadius: '9999px', padding: '2px 10px',
                                    fontSize: '0.75rem', fontWeight: 600,
                                  }}>
                                    <XCircle className="w-3 h-3" /> Inactivo
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p style={{
                        color: '#9ca3af',
                        fontStyle: 'italic',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginTop: '6px',
                      }}>
                        <Gauge className="w-4 h-4" />
                        Sin medidores asignados
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* ==================== MODAL DE CREACIÓN ==================== */}
              {modalType === 'create' && (
                <form onSubmit={handleSubmit} className="user-form">
                  <div className="form-grid">
                  
                  {/* Seleccionar Usuario */}
                  <div className="form-group form-group-full">
                    <label>Seleccionar Usuario *</label>
                    <select
                      required
                      value={formData.id_usuario_sistema || ''}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        id_usuario_sistema: e.target.value ? parseInt(e.target.value) : null 
                      })}
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

                  {/* CAMPO: Código de Afiliado */}
                  <div className="form-group form-group-full">
                    <label>Código de Afiliado (opcional)</label>
                    <input
                      type="text"
                      value={formData.cod_usuario_afi || ''}
                      onChange={(e) => {
                        const value = e.target.value.trim().toUpperCase();
                        // Validar: máximo 6 caracteres alfanuméricos
                        if (value === '' || /^[A-Z0-9]{1,6}$/.test(value)) {
                          setFormData({
                            ...formData,
                            cod_usuario_afi: value
                          });
                        }
                      }}
                      placeholder="Ej: AFI001 o 12345"
                      maxLength={6}
                    />
                    <small className="text-gray-500 mt-1">
                      Déjalo vacío para generar automáticamente. Máximo 6 caracteres (letras y números).
                    </small>
                  </div>

                  {/* Seleccionar Sector */}
                  <div className="form-group form-group-full">
                    <label>Sector *</label>
                    <select
                      required
                      value={formData.id_sector || ''}
                      onChange={(e) => setFormData({ 
                        ...formData, 
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
                      <X className="w-4 h-4 mr-2" />
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
                    {/* ✅ NUEVO CAMPO: Código de Afiliado */}
                    <div className="form-group form-group-full">
                      <label>Código de Afiliado</label>
                      <input
                        type="text"
                        value={formData.cod_usuario_afi || ''}
                        onChange={(e) => {
                          const value = e.target.value.trim().toUpperCase();
                          // Validar: máximo 6 caracteres alfanuméricos
                          if (value === '' || /^[A-Z0-9]{1,6}$/.test(value)) {
                            setFormData({
                              ...formData,
                              cod_usuario_afi: value
                            });
                          }
                        }}
                        placeholder="Ej: AFI001 o 12345"
                        maxLength={6}
                      />
                      <small className="text-gray-500 mt-1">
                        Máximo 6 caracteres (letras y números). Déjalo vacío para mantener el actual.
                      </small>
                    </div>

                    <div className="form-group form-group-full">
                      <label>Sector *</label>
                      <select
                        required
                        value={formData.id_sector || ''}
                        onChange={(e) => setFormData({ ...formData, id_sector: e.target.value})}
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
                      <X className="w-4 h-4 mr-2" />
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
                <form onSubmit={handleMeterAssignment} className="user-form">
                {/*  INFO DEL AFILIADO */}
                {selectedAffiliate && (
                  <div className="meter-info-card mt-3">
                    <h4 className="meter-info-title">
                      <Users className="w-4 h-4 mr-2" />
                      Información del Afiliado
                    </h4>

                    <div className="meter-info-content">
                      <div className="grid grid-cols-2 gap-2">
                        <p>
                          <strong>Código:</strong>{' '}
                          {selectedAffiliate.cod_usuario_afi || '—'}
                        </p>

                        <p>
                          <strong>Nombre:</strong>{' '}
                          {selectedAffiliate.usuario
                            ? `${selectedAffiliate.usuario.nombres || ''} ${selectedAffiliate.usuario.apellidos || ''}`
                            : '—'}
                        </p>

                        <p className="col-span-2">
                          <strong>Sector:</strong>{' '}
                          {selectedAffiliate.sector
                            ? selectedAffiliate.sector.nombre_sector
                            : '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                  {/* Formulario de asignación */}
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
                      <X className="w-4 h-4 mr-2" />
                      Cancelar
                    </button>
                    <button type="submit" className="btn-primary">
                      <Gauge className="w-4 h-4 mr-2" />
                      Asignar Medidor
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

export default AffiliatesSection;