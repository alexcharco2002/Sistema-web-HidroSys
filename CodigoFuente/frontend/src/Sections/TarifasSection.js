// src/sections/TarifasSection.js
// MÓDULO DE TARIFAS - Con control de versiones y vigencia
import React, { useState, useEffect, useCallback } from 'react';

import tarifasService from '../services/tarifasServices';
import authService from '../services/authServices';

import { 
  DollarSign, Plus, Search, Edit, Trash2, Eye, CheckCircle, XCircle,
  X, Save, RefreshCw, AlertCircle, Receipt, ArrowUpDown, FileText, Tag,
  Calendar, Clock, History, AlertTriangle, Ban, Star
} from 'lucide-react';

// Tipos de tarifas permitidios 
const TIPOS_TARIFA_PERMITIDOS = [
  { value: 'basico', label: 'Básico' },
  { value: 'exceso', label: 'Exceso' },
  { value: 'especial', label: 'Especial' },
  { value: 'otro', label: 'Otro' }
];

const TIPOS_TARIFA_OBLIGATORIOS = ['basico', 'exceso'];


const TarifasSection = () => {
  const [tarifas, setTarifas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm] = useState(searchTerm);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterVigencia, setFilterVigencia] = useState('all'); // Nuevo filtro
  const [filterTipo, setFilterTipo] = useState('all');
  const [sortOrder, setSortOrder] = useState('asc');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('create');
  const [selectedTarifa, setSelectedTarifa] = useState(null);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [historialVersiones, setHistorialVersiones] = useState([]);
  const [showHistorialModal, setShowHistorialModal] = useState(false);
 
  const [formData, setFormData] = useState({
    nombre: '',
    detalle: '',
    precio_por_m3: '',
    limite_min_m3: '',
    limite_max_m3: '',
    tipo_tarifa: '',
    vigencia_desde: '',
    activo: true
  });

  // 🔑 PERMISOS DEL USUARIO ACTUAL
  const [permissions, setPermissions] = useState({
    canCreate: false,
    canRead: false,
    canUpdate: false,
    canDelete: false,
    canToggleStatus: false,
    canViewHistory: false
  });

  // 🔑 Cargar permisos al montar el componente
  useEffect(() => {
    loadUserPermissions();
  }, []);

  const loadUserPermissions = () => {
    const canCreate = authService.hasPermission('tarifas', 'crear') || 
                     authService.hasPermission('tarifas', 'operaciones crud');
  
    const canUpdate = authService.hasPermission('tarifas', 'actualizar') || 
                     authService.hasPermission('tarifas', 'operaciones crud');
    
    const canDelete = authService.hasPermission('tarifas', 'eliminar') || 
                     authService.hasPermission('tarifas', 'operaciones crud');

    const canRead = authService.hasPermission('tarifas', 'lectura') ||
               canCreate || canUpdate || canDelete ||
               authService.hasPermission('tarifas', 'operaciones crud');

    const canToggleStatus = canUpdate;
    const canViewHistory = canRead;

    setPermissions({
      canCreate,
      canRead,
      canUpdate,
      canDelete,
      canToggleStatus,
      canViewHistory
    });

    console.log('🔐 Permisos del usuario en módulo Tarifas:', {
      canCreate,
      canRead,
      canUpdate,
      canDelete,
      canViewHistory
    });
  };

  // Fetch tarifas con filtro de vigencia
  const fetchTarifas = useCallback(async () => {
    if (!permissions.canRead) {
      setError('No tienes permiso para ver tarifas');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const filters = { search: debouncedSearchTerm };

      // ✅ SOLO agregar es_vigente si NO es 'all'
      if (filterVigencia === 'vigentes') {
        filters.es_vigente = true;
      } else if (filterVigencia === 'vencidas') {
        filters.es_vigente = false;
      }
      // ❌ NO hacer esto: else { filters.es_vigente = 'all'; }

      console.log('🔍 Filtros enviados:', filters); // Debe mostrar {search: ''} sin es_vigente

      const result = await tarifasService.getTarifas(filters);
      if (result.success) {
        setTarifas(result.data);
        console.log('✅ Tarifas cargadas:', result.data.length);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Error al cargar tarifas desde el servidor');
      console.error('Error en fetchTarifas:', err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearchTerm, filterVigencia, permissions.canRead]);


  // Fetch estadísticas
  const fetchStats = useCallback(async () => {
    if (!permissions.canRead) return;

    try {
      const result = await tarifasService.getTarifaStats();
      if (result.success) {
        setStats(result.data);
      }
    } catch (err) {
      console.error('Error al cargar estadísticas:', err);
    }
  }, [permissions.canRead]);

  useEffect(() => {
    if (permissions.canRead) {
      console.log('🔄 Componente montado, cargando tarifas...');
      fetchTarifas();
      fetchStats();
    }
  }, [fetchTarifas, fetchStats, permissions.canRead]);

  useEffect(() => {
    if (permissions.canRead) {
      fetchTarifas();
    }
  }, [debouncedSearchTerm, filterVigencia, fetchTarifas, permissions.canRead]);

  // 🔄 Cambiar el orden de clasificación
  const toggleSortOrder = () => {
    setSortOrder(prevOrder => prevOrder === 'asc' ? 'desc' : 'asc');
  };

  // Filtrar y ordenar tarifas
  const filteredTarifas = tarifas
    .filter(tarifa => {
      const matchesSearch = tarifa.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (tarifa.detalle && tarifa.detalle.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (tarifa.tipo_tarifa && tarifa.tipo_tarifa.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesStatus = filterStatus === 'all' ||
        (filterStatus === 'active' && tarifa.activo) ||
        (filterStatus === 'inactive' && !tarifa.activo);
      
      const matchesTipo = filterTipo === 'all' || tarifa.tipo_tarifa === filterTipo;
      
      const matchesVigencia = filterVigencia === 'all' ||
        (filterVigencia === 'vigentes' && tarifa.es_vigente === true) ||
        (filterVigencia === 'vencidas' && tarifa.es_vigente === false);

      return matchesSearch && matchesStatus && matchesTipo && matchesVigencia;
    })
    .sort((a, b) => {
      // 🚨 PRIMERO: ordenar por vigencia (vigentes primero)
      if (a.es_vigente !== b.es_vigente) {
        return a.es_vigente ? -1 : 1; // Vigentes antes que vencidas
      }

      // 👇 SI AMBAS tienen misma vigencia, ordenar por nombre
      const nameA = a.nombre.toLowerCase();
      const nameB = b.nombre.toLowerCase();

      return sortOrder === 'asc'
        ? nameA.localeCompare(nameB, 'es', { sensitivity: 'base' })
        : nameB.localeCompare(nameA, 'es', { sensitivity: 'base' });
    });

  // Obtener tipos únicos para el filtro
  const tiposTarifa = [...new Set(tarifas.map(t => t.tipo_tarifa).filter(Boolean))];

  // 📜 Ver historial de versiones
  const verHistorial = async (nombreTarifa) => {
    if (!permissions.canViewHistory) {
      alert('❌ No tienes permiso para ver el historial');
      return;
    }

    try {
      const result = await tarifasService.getHistorialTarifa(nombreTarifa);
      if (result.success) {
        setHistorialVersiones(result.data);
        setShowHistorialModal(true);
      } else {
        alert('Error: ' + result.message);
      }
    } catch (error) {
      alert('Error al cargar historial: ' + error.message);
    }
  };

  // Finalizar vigencia de una tarifa 
  const finalizarVigencia = async (tarifaId, nombreTarifa, tipoTarifa) => {
    if (!permissions.canUpdate) {
      alert("❌ No tienes permiso para finalizar vigencia.");
      return;
    }

    const tarifa = tarifas.find(t => t.id_tarifa === tarifaId);
    
    if (!tarifa) {
      alert('❌ Tarifa no encontrada');
      return;
    }

    // ✅ VALIDAR: Si intenta finalizar vigencia de una tarifa obligatoria
    if (tarifa.es_vigente && 
        tarifa.activo && 
        TIPOS_TARIFA_OBLIGATORIOS.includes(tarifa.tipo_tarifa)) {
      
      // Contar cuántas tarifas vigentes hay del mismo tipo
      const tarifasVigentesMismoTipo = tarifas.filter(
        t => t.tipo_tarifa === tarifa.tipo_tarifa &&
            t.es_vigente === true &&
            t.activo === true &&
            t.id_tarifa !== tarifaId
      ).length;

      if (tarifasVigentesMismoTipo === 0) {
        alert(
          `❌ NO SE PUEDE FINALIZAR VIGENCIA\n\n` +
          `La tarifa "${nombreTarifa}" es de tipo "${tipoTarifa}" y es la única vigente.\n\n` +
          `Siempre debe existir al menos UNA tarifa vigente de tipo "básico" y UNA de tipo "exceso" ` +
          `para realizar los cálculos de facturación.\n\n` +
          `💡 Solución: Crea una nueva versión de "${tipoTarifa}"`
        );
        return;
      }

      // Si hay otra vigente, advertir antes de continuar
      const confirmar = window.confirm(
        `⚠️ ADVERTENCIA\n\n` +
        `Estás a punto de finalizar la vigencia de "${nombreTarifa}" de tipo "${tipoTarifa}".\n\n` +
        `Existe ${tarifasVigentesMismoTipo} tarifa(s) vigente(s) más de este tipo.\n\n` +
        `Esta acción no se puede deshacer. ¿Deseas continuar?`
      );

      if (!confirmar) return;
    } else {
      const confirmado = window.confirm(
        `¿Estás seguro de finalizar la vigencia de "${nombreTarifa}"?\n\nEsta acción no se puede deshacer.`
      );
      if (!confirmado) return;
    }

    try {
      const result = await tarifasService.finalizarVigenciaTarifa(tarifaId);
      
      if (result.success) {
        alert("✅ Vigencia finalizada correctamente.");
        await fetchTarifas();
        await fetchStats();
      } else {
        alert("❌ Error: " + result.message);
      }
    } catch (error) {
      alert("❌ Error al finalizar vigencia: " + error.message);
    }
  };


  const openModal = (type, tarifa = null) => {
    if (type === 'create' && !permissions.canCreate) {
      alert('❌ No tienes permiso para crear tarifas');
      return;
    }
    if (type === 'edit' && !permissions.canUpdate) {
      alert('❌ No tienes permiso para editar tarifas');
      return;
    }

    setModalType(type);
    setSelectedTarifa(tarifa);
    setError(null);
    
    if (type === 'create') {
      setFormData({
        nombre: '',
        detalle: '',
        precio_por_m3: '',
        limite_min_m3: '',
        limite_max_m3: '',
        tipo_tarifa: 'basico',
        vigencia_desde: new Date().toISOString().split('T')[0],
        activo: true
      });
    } else if (type === 'edit' && tarifa) {
      setFormData({
        nombre: tarifa.nombre,
        detalle: tarifa.detalle || '',
        precio_por_m3: tarifa.precio_por_m3,
        limite_min_m3: tarifa.limite_min_m3,
        limite_max_m3: tarifa.limite_max_m3 || '',
        tipo_tarifa: tarifa.tipo_tarifa,
        vigencia_desde: tarifa.vigencia_desde ? new Date(tarifa.vigencia_desde).toISOString().split('T')[0] : '',
        activo: tarifa.activo
      });
    }
    
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedTarifa(null);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      let result;

      if (modalType === 'create') {
        if (!permissions.canCreate) {
          setError('No tienes permiso para crear tarifas');
          return;
        }

        result = await tarifasService.createTarifa(formData);

        if (result.success) {
          await fetchTarifas();
          await fetchStats();
          closeModal();
          alert('✅ Tarifa creada exitosamente');
        } else {
          setError(result.message || 'Error al crear la tarifa');
        }

      } else if (modalType === 'edit') {
        if (!permissions.canUpdate) {
          setError('No tienes permiso para editar tarifas');
          return;
        }

        result = await tarifasService.updateTarifa(selectedTarifa.id_tarifa, formData);
        
        if (result.success) {
          alert('✅ Nueva versión creada correctamente');
          await fetchTarifas();
          await fetchStats();
          closeModal();
        } else {
          setError(result.message || 'Error al actualizar tarifa');
        }
      }

    } catch (error) {
      console.error('Error al guardar tarifa:', error);
      setError(error.message || 'Error al guardar tarifa');
    }
  };

  const handleDelete = async (tarifaId) => {
    if (!permissions.canDelete) {
      alert("❌ No tienes permiso para eliminar tarifas.");
      return;
    }

    const tarifa = tarifas.find(t => t.id_tarifa === tarifaId);
    
    // ✅ Validar si es tarifa obligatoria
    if (tarifa && 
        TIPOS_TARIFA_OBLIGATORIOS.includes(tarifa.tipo_tarifa) && 
        tarifa.es_vigente && 
        tarifa.activo) {
      alert(`❌ No puedes eliminar la tarifa "${tarifa.nombre}" porque es de tipo "${tarifa.tipo_tarifa}" ` +
            `y está activa y vigente. Las tarifas de tipo "básico" y "exceso" son obligatorias para la facturación.`);
      return;
    }

    const confirmado = window.confirm(
      `¿Estás seguro de que deseas eliminar la tarifa "${tarifa?.nombre}"?`
    );
    if (!confirmado) return;

    try {
      const result = await tarifasService.deleteTarifa(tarifaId);

      if (result.success) {
        alert("✅ Tarifa eliminada: " + result.message);
        await fetchTarifas();
        await fetchStats();
      } else {
        alert("❌ Advertencia: " + result.message);
      }
    } catch (error) {
      alert("❌ Error al eliminar tarifa: " + error.message);
    }
  };

  const toggleTarifaStatus = async (tarifaId) => {
    if (!permissions.canToggleStatus) {
      alert('❌ No tienes permiso para cambiar el estado de tarifas');
      return;
    }

    const tarifa = tarifas.find(t => t.id_tarifa === tarifaId);
    
    if (!tarifa) {
      alert('❌ Tarifa no encontrada');
      return;
    }

    // ✅ CASO 1: Intentando DESACTIVAR
    if (tarifa.activo) {
      // Validar si es tarifa obligatoria
      if (tarifa.es_vigente && TIPOS_TARIFA_OBLIGATORIOS.includes(tarifa.tipo_tarifa)) {
        const tarifasActivasMismoTipo = tarifas.filter(
          t => t.tipo_tarifa === tarifa.tipo_tarifa &&
              t.activo === true &&
              t.es_vigente === true &&
              t.id_tarifa !== tarifaId
        ).length;

        if (tarifasActivasMismoTipo === 0) {
          alert(
            `❌ NO SE PUEDE DESACTIVAR\n\n` +
            `La tarifa "${tarifa.nombre}" es de tipo "${tarifa.tipo_tarifa}" y es la única activa.\n\n` +
            `Siempre debe existir al menos UNA tarifa activa de tipo "básico" y UNA de tipo "exceso" ` +
            `para realizar los cálculos de facturación.\n\n` +
            `💡 Solución: Activa otra tarifa de tipo "${tarifa.tipo_tarifa}" primero.`
          );
          return;
        }
      }

      // ⚠️ ADVERTENCIA: Desactivar también finaliza vigencia
      const confirmar = window.confirm(
        `⚠️ DESACTIVAR TARIFA\n\n` +
        `Tarifa: "${tarifa.nombre}"\n` +
        `Tipo: "${tarifa.tipo_tarifa}"\n\n` +
        `⚠️ IMPORTANTE: Al desactivar esta tarifa, también se FINALIZARÁ SU VIGENCIA.\n\n` +
        `Esto significa que:\n` +
        `• Se marcará como inactiva (activo = No)\n` +
        `• Se finalizará su vigencia (es_vigente = No)\n` +
        `• Se registrará la fecha de finalización\n\n` +
        `¿Deseas continuar con la desactivación?`
      );

      if (!confirmar) return;
    } 
    // ✅ CASO 2: Intentando ACTIVAR
    else {
      const confirmar = window.confirm(
        `✅ ACTIVAR TARIFA\n\n` +
        `Tarifa: "${tarifa.nombre}"\n\n` +
        `Esto cambiará el estado a activo, pero NO activará automáticamente la vigencia.\n\n` +
        `Si deseas que sea la tarifa vigente actual, usa la opción "Activar Vigencia" después.\n\n` +
        `¿Deseas activar esta tarifa?`
      );

      if (!confirmar) return;
    }

    try {
      const result = await tarifasService.toggleTarifaStatus(tarifaId);
      
      if (result.success) {
        const nuevoEstado = result.data.activo ? 'activada' : 'desactivada';
        alert(`✅ Tarifa ${nuevoEstado} correctamente`);
        await fetchTarifas();
        await fetchStats();
      } else {
        alert('❌ Error: ' + result.message);
      }
    } catch (error) {
      alert('❌ Error: ' + error.message);
    }
  };


  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-EC', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // función para activar tarifa con confirmación:
  const activarVigencia = async (tarifaId, nombreTarifa, tipoTarifa) => {
    if (!permissions.canUpdate) {
      alert("❌ No tienes permiso para activar vigencia.");
      return;
    }

    const tarifa = tarifas.find(t => t.id_tarifa === tarifaId);
    
    if (!tarifa) {
      alert('❌ Tarifa no encontrada');
      return;
    }

    // Si ya está vigente, no hacer nada
    if (tarifa.es_vigente && tarifa.activo) {
      alert(`ℹ️ La tarifa "${nombreTarifa}" ya está activa y vigente.`);
      return;
    }

    // ✅ Verificar si hay otra tarifa vigente del mismo tipo
    const tarifaVigenteExistente = tarifas.find(
      t => t.tipo_tarifa === tipoTarifa &&
          t.es_vigente === true &&
          t.activo === true &&
          t.id_tarifa !== tarifaId
    );

    let mensaje = `✅ ACTIVAR VIGENCIA\n\nTarifa: "${nombreTarifa}"\nTipo: "${tipoTarifa}"\n\n`;

    // ⚠️ Si existe tarifa vigente del mismo tipo, mostrar advertencia
    if (tarifaVigenteExistente && TIPOS_TARIFA_OBLIGATORIOS.includes(tipoTarifa)) {
      mensaje = 
        `⚠️ ATENCIÓN: YA EXISTE UNA TARIFA VIGENTE\n\n` +
        `Tipo: "${tipoTarifa}"\n\n` +
        `TARIFA ACTUAL VIGENTE:\n` +
        `"${tarifaVigenteExistente.nombre}"\n\n ` +
        `NUEVA TARIFA A ACTIVAR:\n` +
        `"${nombreTarifa}"\n\n ` +
        `Si continúas:\n` +
        `• "${nombreTarifa}" se activará y será la vigente\n` +
        `• "${tarifaVigenteExistente.nombre}" se DESACTIVARÁ automáticamente\n` +
        `• Los cálculos de facturación usarán la nueva tarifa\n\n` +
        `¿Estás seguro de que deseas continuar?`;
    } else {
      mensaje += 
        `Esta tarifa se activará y será la vigente para los cálculos de facturación.\n\n` +
        `¿Deseas continuar?`;
    }

    const confirmado = window.confirm(mensaje);
    if (!confirmado) return;

    try {
      await tarifasService.makeRequest(
        `/tarifas/${tarifaId}/activar-vigencia`,
        { method: 'PATCH' }
      );

      if (tarifaVigenteExistente && TIPOS_TARIFA_OBLIGATORIOS.includes(tipoTarifa)) {
        alert(
          `✅ VIGENCIA ACTIVADA\n\n` +
          `✓ "${nombreTarifa}" está ahora ACTIVA y VIGENTE\n` +
          `✗ "${tarifaVigenteExistente.nombre}" fue DESACTIVADA\n\n` +
          `Los cálculos de facturación usarán la nueva tarifa.`
        );
      } else {
        alert(`✅ Vigencia activada correctamente para "${nombreTarifa}".`);
      }

      await fetchTarifas();
      await fetchStats();
    } catch (error) {
      alert("❌ Error al activar vigencia: " + error.message);
    }
  };




  if (!permissions.canRead) {
    return (
      <div className="section-placeholder">
        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
        <h2>Acceso Denegado</h2>
        <p>No tienes permiso para acceder al módulo de tarifas.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="section-placeholder">
        <RefreshCw className="w-16 h-16 mx-auto mb-4 text-gray-400 animate-spin" />
        <h2>Cargando Tarifas</h2>
        <p>Por favor espera mientras cargamos la información...</p>
      </div>
    );
  }

  if (error && tarifas.length === 0) {
    return (
      <div className="section-placeholder">
        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
        <h2>Error al Cargar Tarifas</h2>
        <p>{error}</p>
        <button onClick={fetchTarifas} className="btn-primary mt-4">
          <RefreshCw className="w-4 h-4 mr-2" />
          Reintentar
        </button>
      </div>
    );
  }
 
  return (
    <div className="users-section">
      <div className="section-header">
        <div className="section-title">
          <DollarSign className="w-6 h-6 text-blue-600" />
          <h2>Gestión de Tarifas</h2>
        </div>
        {permissions.canCreate && (
          <button 
            className="btn-primary"
            onClick={() => openModal('create')}
          >
            <Plus className="w-4 h-4 mr-2" />
            Nueva Tarifa
          </button>
        )}
      </div>

      <div className="filters-section">
        {/* IZQUIERDA — Barra de búsqueda */}
        <div className="search-container">
          <Search className="search-icon" />
          <input
            type="text"
            placeholder="Buscar tarifas..."
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* DERECHA — Filtros y acciones */}
        <div className="filters-right">
          {/* 🟢 Vigencia */}
          <select 
            className="filter-select"
            value={filterVigencia}
            onChange={(e) => setFilterVigencia(e.target.value)}
          >
            <option value="all">Todas las vigencias</option>
            <option value="vigentes">Solo vigentes</option>
            <option value="vencidas">Solo vencidas</option>
          </select>

          {/* 🔧 Estado */}
          <select 
            className="filter-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>

          {/* 🏷️ Tipo de tarifa */}
          <select 
            className="filter-select"
            value={filterTipo}
            onChange={(e) => setFilterTipo(e.target.value)}
          >
            <option value="all">Todos los tipos</option>
            {tiposTarifa.map(tipo => (
              <option key={tipo} value={tipo}>{tipo}</option>
            ))}
          </select>

          {/* ⬆⬇ Ordenamiento */}
          <button 
            className="btn-secondary"
            onClick={toggleSortOrder}
            title={`Ordenar ${sortOrder === 'asc' ? 'descendente' : 'ascendente'}`}
          >
            <ArrowUpDown className="w-4 h-4" />
            <span className="ml-1 text-xs">
              {sortOrder === 'asc' ? '↑' : '↓'}
            </span>
          </button>

          {/* 🔄 Recargar */}
          <button 
            className="btn-secondary"
            onClick={() => {
              fetchTarifas();
              fetchStats();
            }}
            title="Recargar lista"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tarjetas de estadísticas */}
      {stats && (
        <div className="users-stats">
          <div className="stat-item">
            <DollarSign className="stat-icon text-blue-600" />
            <div>
              <p className="stat-label">Total Versiones</p>
              <p className="stat-value">{stats.total_versiones}</p>
            </div>
          </div>
          <div className="stat-item">
            <CheckCircle className="stat-icon text-green-600" />
            <div>
              <p className="stat-label">Tarifas Vigentes</p>
              <p className="stat-value">{stats.tarifas_vigentes}</p>
            </div>
          </div>
          <div className="stat-item">
            <Clock className="stat-icon text-orange-600" />
            <div>
              <p className="stat-label">Tarifas Vencidas</p>
              <p className="stat-value">{stats.tarifas_vencidas}</p>
            </div>
          </div>
          <div className="stat-item">
            <Tag className="stat-icon text-purple-600" />
            <div>
              <p className="stat-label">Tipos Únicos</p>
              <p className="stat-value">{stats.tipos_unicos}</p>
            </div>
          </div>
        </div>
      )}

      <div className="users-grid">
        {filteredTarifas.map(tarifa => (
          <div key={tarifa.id_tarifa} className={`user-card ${!tarifa.activo ? 'inactive' : ''} ${!tarifa.es_vigente ? 'vencida' : ''}`}>
            <div className="user-card-header">
              <div className="user-info">
                <div className="user-icon">
                  <DollarSign className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="user-name">{tarifa.nombre}</h3>
                  <div className="flex gap-2 items-center mt-1 flex-wrap">
                    <span className={`status-badge ${tarifa.activo ? 'active' : 'inactive'}`}>
                      {tarifa.activo ? (
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
                    <span className={`status-badge ${tarifa.es_vigente ? 'vigente' : 'vencida'}`} 
                          style={{
                            backgroundColor: tarifa.es_vigente ? '#f0fdf4' : '#fef2f2',
                            color: tarifa.es_vigente ? '#16a34a' : '#dc2626'
                          }}>
                      {tarifa.es_vigente ? (
                        <>
                          <CheckCircle className="w-3 h-3" />
                          Vigente
                        </>
                      ) : (
                        <>
                          <Clock className="w-3 h-3" />
                          Vencida
                        </>
                      )}
                    </span>
                    {tarifa.tipo_tarifa && (
                      <span className="status-badge" style={{backgroundColor: '#f0f9ff', color: '#0369a1'}}>
                        <Tag className="w-3 h-3" />
                        {tarifa.tipo_tarifa}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="user-actions">
                <button 
                  className="action-btn view"
                  onClick={() => openModal('view', tarifa)}
                  title="Ver detalles"
                >
                  <Eye className="w-4 h-4 icon-view" />
                </button>

                {permissions.canViewHistory && (
                  <button 
                    className="action-btn history"
                    onClick={() => verHistorial(tarifa.nombre)}
                    title="Ver historial de versiones"
                  >
                    <History className="w-4 h-4" />
                  </button>
                )}

                {permissions.canUpdate && tarifa.es_vigente && (
                  <button 
                    className="action-btn edit"
                    onClick={() => openModal('edit', tarifa)}
                    title="Editar tarifa (crear nueva versión)"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                )}

                {permissions.canUpdate && tarifa.es_vigente && (
                  <button 
                    className="action-btn warning"
                    onClick={() => finalizarVigencia(tarifa.id_tarifa, tarifa.nombre, tarifa.tipo_tarifa)}
                    title="Finalizar vigencia"
                  >
                    <Ban className="w-4 h-4" />
                  </button>
                )}

                {permissions.canToggleStatus && (
                  <button 
                    className="action-btn toggle"
                    onClick={() => toggleTarifaStatus(tarifa.id_tarifa)}
                    title={tarifa.activo ? 'Desactivar' : 'Activar'}
                  >
                    {tarifa.activo ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                  </button>
                )}

                {permissions.canUpdate && !tarifa.es_vigente && (
                  <button
                    className="action-btn success"
                    onClick={() =>
                      activarVigencia(
                        tarifa.id_tarifa,
                        tarifa.nombre,
                        tarifa.tipo_tarifa
                      )
                    }
                    title="Activar vigencia (establecer como tarifa actual)"
                  >
                    <Star className="w-4 h-4" />
                  </button>
                )}


                {permissions.canDelete && (
                  <button 
                    className="action-btn delete"
                    onClick={() => handleDelete(tarifa.id_tarifa)}
                    title="Eliminar tarifa"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="user-card-body">
              <p className="user-description flex items-center gap-2 text-gray-700 mb-2">
                <FileText className="w-4 h-4 text-gray-400" />
                {tarifa.detalle?.trim() ? tarifa.detalle : 'Sin descripción'}
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                <div>
                  <span className="text-gray-500">Precio/m³: </span>
                  <span className="font-semibold ml-1">{formatCurrency(tarifa.precio_por_m3)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Rango: </span>
                  <span className="font-semibold ml-1">
                    {tarifa.limite_min_m3} - {tarifa.limite_max_m3 || '∞'} m³
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500 border-t pt-2">
                <Calendar className="w-3 h-3" />
                <span>
                  Desde: {formatDate(tarifa.vigencia_desde)}
                  {tarifa.vigencia_hasta && ` | Hasta: ${formatDate(tarifa.vigencia_hasta)}`}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredTarifas.length === 0 && (
        <div className="empty-state">
          <Receipt className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3>No se encontraron tarifas</h3>
          <p>No hay tarifas que coincidan con los criterios de búsqueda.</p>
        </div>
      )}

      {/* MODAL DE DETALLES/CREAR/EDITAR */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>
                {modalType === 'create' && 'Crear Nueva Tarifa'}
                {modalType === 'edit' && 'Editar Tarifa (Nueva Versión)'}
                {modalType === 'view' && 'Detalles de la Tarifa'}
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

              {modalType === 'view' && selectedTarifa && (
                <div className="user-details">
                  <div className="detail-group">
                    <label>ID Tarifa:</label>
                    <p>{selectedTarifa.id_tarifa}</p>
                  </div>
                  <div className="detail-group">
                    <label>Nombre:</label>
                    <p>{selectedTarifa.nombre}</p>
                  </div>
                  {selectedTarifa.detalle && (
                    <div className="detail-group">
                      <label>Detalle:</label>
                      <p>{selectedTarifa.detalle}</p>
                    </div>
                  )}
                  <div className="detail-group">
                    <label>Tipo de Tarifa:</label>
                    <p>{selectedTarifa.tipo_tarifa}</p>
                  </div>
                  <div className="detail-group">
                    <label>Precio por m³:</label>
                    <p>{formatCurrency(selectedTarifa.precio_por_m3)}</p>
                  </div>
                  <div className="detail-group">
                    <label>Rango de consumo:</label>
                    <p>{selectedTarifa.limite_min_m3} - {selectedTarifa.limite_max_m3 || '∞'} m³</p>
                  </div>
                  <div className="detail-group">
                    <label>Vigencia Desde:</label>
                    <p>{formatDate(selectedTarifa.vigencia_desde)}</p>
                  </div>
                  {selectedTarifa.vigencia_hasta && (
                    <div className="detail-group">
                      <label>Vigencia Hasta:</label>
                      <p>{formatDate(selectedTarifa.vigencia_hasta)}</p>
                    </div>
                  )}
                  <div className="detail-group">
                    <label>Estado de Vigencia:</label>
                    <span className={`status-badge ${selectedTarifa.es_vigente ? 'active' : 'inactive'}`}>
                      {selectedTarifa.es_vigente ? 'Vigente' : 'Vencida'}
                    </span>
                  </div>
                  <div className="detail-group">
                    <label>Estado Activo:</label>
                    <span className={`status-badge ${selectedTarifa.activo ? 'active' : 'inactive'}`}>
                      {selectedTarifa.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <div className="detail-group">
                    <label>Fecha de Creación:</label>
                    <p>{formatDate(selectedTarifa.fecha_creacion)}</p>
                  </div>
                </div>
              )}

              {(modalType === 'create' || modalType === 'edit') && (
                <form onSubmit={handleSubmit} className="user-form">
                  {modalType === 'edit' && (
                    <div className="alert alert-info mb-4">
                      <AlertTriangle className="w-5 h-5 mr-2" />
                      Al guardar, se creará una nueva versión de esta tarifa. La versión actual quedará marcada como vencida.
                    </div>
                  )}
                  
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Nombre de la Tarifa *</label>
                      <input
                        type="text"
                        required
                        minLength="3"
                        value={formData.nombre}
                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                        placeholder="Ej: Tarifa Residencial"
                      />
                    </div>

                   <div className="form-group">
  <label>Tipo de Tarifa *</label>
  {modalType === 'create' ? (
    <select
      required
      value={formData.tipo_tarifa}
      onChange={(e) => setFormData({ ...formData, tipo_tarifa: e.target.value })}
      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
    >
      <option value="">Seleccionar tipo</option>
      {TIPOS_TARIFA_PERMITIDOS.map(tipo => (
        <option key={tipo.value} value={tipo.value}>
          {tipo.label}
          {TIPOS_TARIFA_OBLIGATORIOS.includes(tipo.value) ? ' ⭐ (Obligatorio)' : ''}
        </option>
      ))}
    </select>
  ) : (
    <input
      type="text"
      value={formData.tipo_tarifa}
      disabled
      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
      title="El tipo de tarifa no se puede cambiar al editar"
    />
  )}
  
  {/* Advertencia para tipos obligatorios */}
  {TIPOS_TARIFA_OBLIGATORIOS.includes(formData.tipo_tarifa) && (
    <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
      <AlertTriangle size={14} />
      Solo puede existir una tarifa activa de tipo "{formData.tipo_tarifa}". 
      Si creas una nueva, deberás activarla manualmente.
    </p>
  )}
  
  {/* Información adicional */}
  {formData.tipo_tarifa && (
    <p className="text-xs text-gray-500 mt-1">
      {TIPOS_TARIFA_OBLIGATORIOS.includes(formData.tipo_tarifa) 
        ? '💡 Esta tarifa es necesaria para la facturación y no se puede eliminar cuando está activa.'
        : '💡 Este tipo de tarifa es opcional y puede tener múltiples versiones activas.'}
    </p>
  )}
</div>


                    <div className="form-group form-group-full">
                      <label>Detalle</label>
                      <textarea
                        value={formData.detalle}
                        onChange={(e) => setFormData({ ...formData, detalle: e.target.value })}
                        placeholder="Descripción de la tarifa (opcional)"
                        rows="3"
                      />
                    </div>

                    <div className="form-group">
                      <label>Precio por m³ ($) *</label>
                      <input
                        type="number"
                        required
                        step="0.01"
                        min="0"
                        value={formData.precio_por_m3}
                        onChange={(e) => setFormData({ ...formData, precio_por_m3: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>

                    <div className="form-group">
                      <label>Límite Mínimo (m³) *</label>
                      <input
                        type="number"
                        required
                        step="0.01"
                        min="0"
                        value={formData.limite_min_m3}
                        onChange={(e) => setFormData({ ...formData, limite_min_m3: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>

                    <div className="form-group">
                      <label>Límite Máximo (m³)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.limite_max_m3}
                        onChange={(e) => setFormData({ ...formData, limite_max_m3: e.target.value })}
                        placeholder="Dejar vacío si no tiene límite"
                      />
                    </div>

                    <div className="form-group">
                      <label>Fecha de Vigencia *</label>
                      <input
                        type="date"
                        required
                        value={formData.vigencia_desde}
                        onChange={(e) => setFormData({ ...formData, vigencia_desde: e.target.value })}
                      />
                      <small className="text-gray-500 text-xs mt-1">
                        {modalType === 'create' 
                          ? 'Fecha desde la cual esta tarifa estará vigente'
                          : 'Fecha de inicio de la nueva versión'}
                      </small>
                    </div>

                    <div className="form-group">
                      <label>Estado</label>
                      <select
                        value={formData.activo}
                        onChange={(e) => setFormData({ ...formData, activo: e.target.value === 'true' })}
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
                      {modalType === 'create' ? 'Crear Tarifa' : 'Crear Nueva Versión'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE HISTORIAL DE VERSIONES */}
      {showHistorialModal && (
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <div className="modal-header">
              <h3>
                <History className="w-5 h-5 inline mr-2" />
                Historial de Versiones
              </h3>
              <button className="modal-close" onClick={() => setShowHistorialModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="modal-body">
              {historialVersiones.length > 0 ? (
                <div className="space-y-4">
                  {historialVersiones.map((version, index) => (
                    <div 
                      key={version.id_tarifa} 
                      className={`border rounded-lg p-4 ${version.es_vigente ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-gray-50'}`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-semibold text-lg">{version.nombre}</h4>
                          <p className="text-sm text-gray-600">{version.tipo_tarifa}</p>
                        </div>
                        <div className="flex gap-2">
                          <span className={`status-badge ${version.es_vigente ? 'active' : 'inactive'}`}>
                            {version.es_vigente ? 'Vigente' : 'Vencida'}
                          </span>
                          <span className="status-badge" style={{backgroundColor: '#f0f9ff', color: '#0369a1'}}>
                            Versión {historialVersiones.length - index}
                          </span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-gray-600">Precio/m³:</span>
                          <span className="font-semibold ml-2">{formatCurrency(version.precio_por_m3)}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Rango:</span>
                          <span className="font-semibold ml-2">
                            {version.limite_min_m3} - {version.limite_max_m3 || '∞'} m³
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Vigencia Desde:</span>
                          <span className="font-semibold ml-2">{formatDate(version.vigencia_desde)}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Vigencia Hasta:</span>
                          <span className="font-semibold ml-2">
                            {version.vigencia_hasta ? formatDate(version.vigencia_hasta) : 'Actual'}
                          </span>
                        </div>
                      </div>
                      
                      {version.detalle && (
                        <p className="text-sm text-gray-700 mt-2 pt-2 border-t">
                          {version.detalle}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <History className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p>No hay historial disponible</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TarifasSection;