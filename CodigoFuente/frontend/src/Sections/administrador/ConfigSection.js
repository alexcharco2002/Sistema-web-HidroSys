// src/sections/ConfigSection.js
// MÓDULO DE CONFIGURACIÓN - Solo Backups
import React, { useState, useEffect, useMemo, useCallback } from 'react';

//import './RolesSection.css';
import configService from '../../services/configServices';
import authService from '../../services/authServices';
// Importar el servicio de limitesgeograficos
import limitesService from '../../services/limitesServices';

// imporatr servicos de iva
import ivaService from '../../services/ivaServices';

// importar servicios de mora
import moraService from '../../services/moraServices';


import './ConfigSection.css';

import {
  Settings, Database, Download, Upload, Trash2, Map, 
  DollarSign,
  AlertCircle, CheckCircle, RefreshCw, Calendar, FileText, Clock, Edit, XCircle, Percent, ToggleRight, ToggleLeft
} from 'lucide-react';

const ConfigSection = () => {
  const [selectedSection, setSelectedSection] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);


  // Estado para backups
  const [backups, setBackups] = useState([]);
  const [loadingBackups, setLoadingBackups] = useState(false);

  // Estados para limites geograficos
  const [limites, setLimites] = useState([]);
  const [loadingLimites, setLoadingLimites] = useState(false);
  const [editingLimite, setEditingLimite] = useState(null);
  const [showLimiteModal, setShowLimiteModal] = useState(false);
  const [limiteFormData, setLimiteFormData] = useState({
    nombre: '',
    norte: '',
    sur: '',
    este: '',
    oeste: '',
    altitud_min: '',
    altitud_max: '',
    activo: true
  });
  // ======================================
  // ESTADOS PARA IVA
  // ======================================
  const [ivas, setIvas] = useState([]);
  const [loadingIVAs, setLoadingIVAs] = useState(false);
  const [editingIVA, setEditingIVA] = useState(null);
  const [showIVAModal, setShowIVAModal] = useState(false);
  const [ivaActivo, setIvaActivo] = useState(null); // IVA activo actual
  const [ivasAplicables, setIvasAplicables] = useState([]); // IVAs con es_aplicable=true
  const [ivaFormData, setIVAFormData] = useState({
      codigo: '',
      descripcion: '',
      porcentaje: '',
      es_aplicable: false, // ⚠️ CAMBIADO: es_aplicable (no es_no_aplicable)
      observaciones: ''
  });
  const [aplicarIVA, setAplicarIVA] = useState(false); // Toggle para activar/desactivar IVA

  // ====================================== 
  // ESTADOS PARA MORA
  // ======================================
  const [moras, setMoras] = useState([]);
  const [loadingMoras, setLoadingMoras] = useState(false);
  const [editingMora, setEditingMora] = useState(null);
  const [showMoraModal, setShowMoraModal] = useState(false);
  const [moraActiva, setMoraActiva] = useState(null); // Configuración activa actual
  const [moraFormData, setMoraFormData] = useState({
    nombre: '',
    descripcion: '',
    dias_gracia: 0,
    tipo_periodo: 'dias',
    meses_gracia: 0,
    tipo_calculo: 'porcentaje',
    porcentaje_mora: '',
    valor_fijo: '',
    interes_diario: '',
    vigencia_desde: '',
    vigencia_hasta: '',
    es_vigente: true,
    mora_maxima: '',
    aplicar_sobre: 'total'
  });
  const [aplicarMora, setAplicarMora] = useState(false); // Toggle para activar/desactivar mora


  // 🔑 PERMISOS DEL USUARIO ACTUAL
  const [permissions, setPermissions] = useState({
    canRead: false,
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    canManageBackups: false
  });

  // 🔑 Cargar permisos al montar el componente
  useEffect(() => {
    loadUserPermissions();
  }, []);

  const loadUserPermissions = () => {
    const canCreate = authService.hasPermission('configuracion', 'crear') || 
                     authService.hasPermission('configuracion', 'operaciones crud');
  
    const canUpdate = authService.hasPermission('configuracion', 'actualizar') || 
                     authService.hasPermission('configuracion', 'operaciones crud');
    
    const canDelete = authService.hasPermission('configuracion', 'eliminar') || 
                     authService.hasPermission('configuracion', 'operaciones crud');

    const canRead = authService.hasPermission('configuracion', 'lectura') ||
                   canCreate || canUpdate || canDelete ||
                   authService.hasPermission('configuracion', 'operaciones crud');

    const canManageBackups = canCreate || canUpdate || canDelete;

    setPermissions({
      canRead,
      canCreate,
      canUpdate,
      canDelete,
      canManageBackups
    });

    console.log('🔐 Permisos del usuario en módulo Configuración:', {
      canRead,
      canCreate,
      canUpdate,
      canDelete,
      canManageBackups
    });
  };

  // Definición de secciones disponibles (solo backups)
  const configSections = useMemo(() => [
    {
      id: 'backups',
      nombre: 'Respaldos',
      descripcion: 'Gestión de backups de la base de datos',
      icon: Database,
      visible: permissions.canManageBackups
    },
    {
      id: 'limites',
      nombre: 'Límites Geográficos',
      descripcion: 'Gestión de límites geográficos para el sistema',
      icon: Map, 
      visible: permissions.canManageBackups 
    },
    {
      id: 'iva',
      nombre: 'IVA',
      descripcion: 'Gestión de tasas de IVA para facturación',
      icon: Percent,
      visible: permissions.canManageBackups
    },
    {
      id: 'mora',
      nombre: 'Mora',
      descripcion: 'Gestión de intereses por pago tardío',
      icon: DollarSign,
      visible: permissions.canManageBackups
    }

  ], [permissions]);

  // ========================================
  // GESTIÓN DE BACKUPS
  // ========================================

  const loadBackups = useCallback(async () => {
    if (!permissions.canManageBackups) {
      setError('No tienes permiso para gestionar backups');
      return;
    }

    setLoadingBackups(true);
    setError(null);

    try {
      const result = await configService.listBackups();

      if (result.success) {
        setBackups(result.data);
        console.log('✅ Backups cargados:', result.data.length);
      } else {
        setError(result.message);
      }

    } catch (err) {
      setError('Error al cargar la lista de backups');
      console.error('Error:', err);
    } finally {
      setLoadingBackups(false);
    }
  }, [permissions.canManageBackups]);

  useEffect(() => {
    if (selectedSection === 'backups' && permissions.canManageBackups) {
      loadBackups();
    }
  }, [selectedSection, permissions.canManageBackups, loadBackups]);

  const handleCreateBackup = async () => {
  // 🔑 Verificar permisos
  if (!permissions.canCreate) {
    window.alert("❌ No tienes permiso para crear backups.");
    return;
  }

  // 🔥 Confirmación nativa
  const confirmed = window.confirm("¿Deseas crear un nuevo backup de la base de datos?");
    if (!confirmed) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await configService.createBackup();

      if (result.success) {
        // 🎉 Éxito nativo
        window.alert(`✔ Backup creado:\n${result.message}`);

        await loadBackups();
        setSuccess(result.message);

        setTimeout(() => setSuccess(null), 5000);
      } else {
        // ❌ Error nativo
        window.alert(`❌ Error al crear el backup:\n${result.message}`);
        setError(result.message);
      }

    } catch (err) {
      window.alert("❌ Error inesperado al crear el backup.");
      setError("Error al crear el backup");
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreBackup = async (filename) => {
    // 🔑 Verificar permisos
    if (!permissions.canUpdate) {
      window.alert("❌ No tienes permiso para restaurar backups.");
      return;
    }

    // ⚠️ Advertencia seria (nativo)
    const confirmed = window.confirm(
      `⚠ Esta acción restaurará la base de datos y reemplazará todos los datos actuales.\n\n` +
      `¿Deseas restaurar el backup:\n"${filename}"?`
    );

    if (!confirmed) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await configService.restoreBackup(filename);

      if (result.success) {
        // 🎉 Mensaje de éxito nativo
        window.alert(`✔ Base de datos restaurada:\n${result.message}`);
      } else {
        // ❌ Error nativo
        window.alert(`❌ Error al restaurar el backup:\n${result.message}`);
        setError(result.message);
      }

    } catch (err) {
      window.alert("❌ Error inesperado al restaurar el backup.");
      setError("Error al restaurar el backup");
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBackup = async (filename) => {
    // 🔑 Verificar permisos
    if (!permissions.canDelete) {
      window.alert("❌ No tienes permiso para eliminar backups.");
      return;
    }

    // ⚠ Confirmación nativa
    const confirmed = window.confirm(
      `¿Estás seguro de que deseas eliminar el backup "${filename}"?`
    );

    if (!confirmed) return;

    try {
      const result = await configService.deleteBackup(filename);

      if (result.success) {
        // 🎉 Éxito nativo
        window.alert(`✔ Backup eliminado:\n${result.message}`);

        setSuccess(result.message);
        await loadBackups();
        setTimeout(() => setSuccess(null), 3000);

      } else {
        // ❌ Error nativo
        window.alert(`❌ Error al eliminar el backup:\n${result.message}`);
        setError(result.message);
      }

    } catch (err) {
      window.alert("❌ Error inesperado al eliminar el backup.");
      setError("Error al eliminar el backup");
      console.error("Error:", err);
    }
  };


  const handleDownloadBackup = async (filename) => {
    if (!permissions.canRead) {
      alert('❌ No tienes permiso para descargar backups');
      return;
    }

    try {
      const result = await configService.downloadBackup(filename);

      if (result.success) {
        setSuccess(result.message);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.message);
      }

    } catch (err) {
      setError('Error al descargar el backup');
      console.error('Error:', err);
    }
  };

  // ========================================
  // GESTION DE LIMITES GEOGRAFICOS
  // ========================================
  
  // Cargar límites cuando se seleccione la sección
  const loadLimites = useCallback(async () => {
    setLoadingLimites(true);
    setError(null);

    try {
      const result = await limitesService.listLimites();

      if (result.success) {
        const limitesOrdenados = [...result.data].sort(
          (a, b) => Number(b.activo) - Number(a.activo)
        );

        setLimites(limitesOrdenados);
        console.log('✅ Límites cargados:', limitesOrdenados.length);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Error al cargar la lista de límites');
      console.error('Error:', err);
    } finally {
      setLoadingLimites(false);
    }
  }, []);


  useEffect(() => {
    if (selectedSection === 'limites') {
      loadLimites();
    }
  }, [selectedSection, loadLimites]);

  // Función para abrir modal de crear/editar
  const openLimiteModal = (limite = null) => {
    if (limite) {
      setEditingLimite(limite);
      setLimiteFormData({
        nombre: limite.nombre || '',
        norte: limite.norte || '',
        sur: limite.sur || '',
        este: limite.este || '',
        oeste: limite.oeste || '',
        altitud_min: limite.altitud_min || '',
        altitud_max: limite.altitud_max || '',
        activo: limite.activo !== undefined ? limite.activo : true
      });
    } else {
      setEditingLimite(null);
      setLimiteFormData({
        nombre: '',
        norte: '',
        sur: '',
        este: '',
        oeste: '',
        altitud_min: '',
        altitud_max: '',
        activo: true
      });
    }
    setShowLimiteModal(true);
  };

  const closeLimiteModal = () => {
    setShowLimiteModal(false);
    setEditingLimite(null);
    setLimiteFormData({
      nombre: '',
      norte: '',
      sur: '',
      este: '',
      oeste: '',
      altitud_min: '',
      altitud_max: '',
      activo: true
    });
  };

  // Guardar límite (crear o actualizar)
  const handleSaveLimite = async (e) => {
    e.preventDefault(); // ✅ Prevenir el comportamiento por defecto del form
    
    if (!permissions.canCreate && !editingLimite) {
      window.alert("❌ No tienes permiso para crear límites geográficos.");
      return;
    }

    if (!permissions.canUpdate && editingLimite) {
      window.alert("❌ No tienes permiso para actualizar límites geográficos.");
      return;
    }

    // ✅ Validaciones personalizadas adicionales
    const norte = parseFloat(limiteFormData.norte);
    const sur = parseFloat(limiteFormData.sur);
    const este = parseFloat(limiteFormData.este);
    const oeste = parseFloat(limiteFormData.oeste);
    
    // Validar que Sur < Norte
    if (sur >= norte) {
      window.alert("❌ El límite Sur debe ser menor que el límite Norte");
      return;
    }
    
    // Validar altitudes si están presentes
    if (limiteFormData.altitud_min !== '' && limiteFormData.altitud_max !== '') {
      const altMin = parseFloat(limiteFormData.altitud_min);
      const altMax = parseFloat(limiteFormData.altitud_max);
      if (altMin > altMax) {
        window.alert("❌ La altitud mínima debe ser menor o igual a la altitud máxima");
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      // Preparar datos
      const dataToSend = {
        nombre: limiteFormData.nombre.trim(),
        norte: norte,
        sur: sur,
        este: este,
        oeste: oeste,
        activo: limiteFormData.activo
      };

      // Agregar altitudes solo si tienen valor
      if (limiteFormData.altitud_min !== '') {
        dataToSend.altitud_min = parseFloat(limiteFormData.altitud_min);
      }
      if (limiteFormData.altitud_max !== '') {
        dataToSend.altitud_max = parseFloat(limiteFormData.altitud_max);
      }

      let result;
      if (editingLimite) {
        result = await limitesService.updateLimite(editingLimite.id, dataToSend);
      } else {
        result = await limitesService.createLimite(dataToSend);
      }

      if (result.success) {
        window.alert(`✔ Límite geográfico ${editingLimite ? 'actualizado' : 'creado'} exitosamente`);
        setSuccess(result.message);
        
        // ✅ Cerrar modal primero
        closeLimiteModal();
        
        // ✅ Recargar los límites con loading spinner
        await loadLimites();
        
        // ✅ Limpiar mensaje de éxito después de 3 segundos
        setTimeout(() => setSuccess(null), 3000);
      } else {
        window.alert(`❌ Error: ${result.message}`);
        setError(result.message);
      }
    } catch (err) {
      window.alert("❌ Error inesperado al guardar el límite.");
      setError("Error al guardar el límite");
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };


  // Activar límite
  const handleActivateLimite = async (id, nombre) => {
    if (!permissions.canUpdate) {
      window.alert("❌ No tienes permiso para activar límites geográficos.");
      return;
    }

    const confirmed = window.confirm(
      `¿Deseas activar el límite geográfico "${nombre}"?\n\nEsto desactivará cualquier otro límite activo.`
    );
    if (!confirmed) return;

    setLoading(true);
    setError(null);

    try {
      const result = await limitesService.activateLimite(id);
      if (result.success) {
        window.alert(`✔ Límite "${nombre}" activado exitosamente`);
        setSuccess(result.message);
        await loadLimites();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        window.alert(`❌ Error: ${result.message}`);
        setError(result.message);
      }
    } catch (err) {
      window.alert("❌ Error inesperado al activar el límite.");
      setError("Error al activar el límite");
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Eliminar límite
  const handleDeleteLimite = async (id, nombre) => {
    if (!permissions.canDelete) {
      window.alert("❌ No tienes permiso para eliminar límites geográficos.");
      return;
    }

    const confirmed = window.confirm(
      `¿Estás seguro de que deseas eliminar el límite "${nombre}"?`
    );
    if (!confirmed) return;

    setLoading(true); // ✅ Agregado para consistencia
    setError(null); // ✅ Agregado para limpiar errores previos

    try {
      const result = await limitesService.deleteLimite(id);
      if (result.success) {
        window.alert(`✔ Límite "${nombre}" eliminado exitosamente`);
        setSuccess(result.message);
        
        // ✅ Recargar automáticamente con spinner
        await loadLimites();
        
        setTimeout(() => setSuccess(null), 3000);
      } else {
        window.alert(`❌ Error: ${result.message}`);
        setError(result.message);
      }
    } catch (err) {
      window.alert("❌ Error inesperado al eliminar el límite.");
      setError("Error al eliminar el límite");
      console.error("Error:", err);
    } finally {
      setLoading(false); // ✅ Agregado para desactivar loading
    }
  };

  // ======================================
  // GESTIÓN DE IVA
  // ======================================

  // Cargar TODOS los IVAs (activos e inactivos)
  const loadIVAs = useCallback(async () => {
      setLoadingIVAs(true);
      setError(null);
      
      try {
          // Cargar TODOS los IVAs
          const result = await ivaService.listIVAs({});
          
          if (result.success) {
              // Ordenar: aplicables primero, luego por porcentaje descendente
              const ivasOrdenados = [...result.data].sort((a, b) => {
                  // Primero por estado activo
                  if (a.activo !== b.activo) return b.activo ? 1 : -1;
                  // Luego aplicables primero (es_aplicable=true primero)
                  if (a.es_aplicable !== b.es_aplicable) {
                      return Number(b.es_aplicable) - Number(a.es_aplicable);
                  }
                  // Finalmente por porcentaje descendente
                  return parseFloat(b.porcentaje) - parseFloat(a.porcentaje);
              });
              
              setIvas(ivasOrdenados);
              
              // ✅ Filtrar IVAs aplicables (es_aplicable=true)
              const aplicables = ivasOrdenados.filter(iva => iva.es_aplicable === true);
              setIvasAplicables(aplicables);
              
              // ✅ Cargar estado del toggle
              const estadoToggle = await ivaService.obtenerEstadoToggle();
              if (estadoToggle.success) {
                  setAplicarIVA(estadoToggle.aplicar_iva);
                  setIvaActivo(estadoToggle.iva_activo);
                  console.log('✅ Estado toggle IVA:', estadoToggle.aplicar_iva ? 'ACTIVADO' : 'DESACTIVADO');
              }
              
              console.log('✅ IVAs cargados:', ivasOrdenados.length);
              console.log('✅ IVAs aplicables:', aplicables.length);
          } else {
              setError(result.message);
          }
      } catch (err) {
          setError('Error al cargar la lista de IVAs');
          console.error('Error:', err);
      } finally {
          setLoadingIVAs(false);
      }
  }, []);


  // Handler para el toggle de aplicar IVA
  const handleToggleAplicarIVA = async () => {
      if (!permissions.canUpdate) {
          window.alert("❌ No tienes permiso para cambiar la configuración de IVA.");
          return;
      }
      
      const nuevoEstado = !aplicarIVA;
      
      if (nuevoEstado) {
          // ========================================
          // ACTIVAR IVA APLICABLE
          // ========================================
          if (ivasAplicables.length === 0) {
              window.alert(
                  "❌ No hay IVAs aplicables configurados.\n\n" +
                  "Primero debes crear un IVA aplicable con:\n" +
                  "• es_aplicable = true\n" +
                  "• porcentaje > 0"
              );
              return;
          }
          
          // Buscar el IVA aplicable con es_aplicable=true
          const ivaParaActivar = ivasAplicables.find(iva => iva.es_aplicable === true);
          
          if (!ivaParaActivar) {
              window.alert("❌ No se encontró un IVA aplicable válido.");
              return;
          }
          
          const confirmar = window.confirm(
              `¿Deseas ACTIVAR la aplicación de IVA en facturación?\n\n` +
              `IVA a activar: ${ivaParaActivar.codigo} (${ivaParaActivar.porcentaje}%)\n\n` +
              `Las nuevas facturas incluirán este IVA automáticamente.`
          );
          
          if (!confirmar) return;
          
          setLoading(true);
          setError(null);
          
          try {
              // Usar el nuevo endpoint toggle
              const result = await ivaService.toggleIVA(true);
              
              if (result.success) {
                  window.alert(`✔ IVA activado: ${ivaParaActivar.codigo}`);
                  setSuccess('IVA activado para facturación');
                  
                  // Recargar para actualizar estados
                  await loadIVAs();
                  
                  setTimeout(() => setSuccess(null), 3000);
              } else {
                  window.alert(`❌ Error: ${result.message}`);
                  setError(result.message);
              }
          } catch (err) {
              window.alert("❌ Error inesperado al activar IVA.");
              setError("Error al cambiar configuración de IVA");
              console.error("Error:", err);
          } finally {
              setLoading(false);
          }
          
      } else {
          // ========================================
          // DESACTIVAR TODOS LOS IVAs
          // ========================================
          const confirmar = window.confirm(
              `⚠️ ¿Deseas DESACTIVAR todos los IVAs?\n\n` +
              `Las nuevas facturas NO incluirán IVA automáticamente.\n\n` +
              `Todos los IVAs quedarán inactivos.\n\n` +
              `¿Continuar?`
          );
          
          if (!confirmar) return;
          
          setLoading(true);
          setError(null);
          
          try {
              // Usar el nuevo endpoint toggle para desactivar todos
              const result = await ivaService.toggleIVA(false);
              
              if (result.success) {
                  window.alert("✔ Todos los IVAs han sido desactivados");
                  setSuccess('IVAs desactivados correctamente');
                  
                  // Recargar para actualizar estados
                  await loadIVAs();
                  
                  setTimeout(() => setSuccess(null), 3000);
              } else {
                  window.alert(`❌ Error: ${result.message}`);
                  setError(result.message);
              }
          } catch (err) {
              window.alert("❌ Error inesperado al desactivar IVAs.");
              setError("Error al cambiar configuración de IVA");
              console.error("Error:", err);
          } finally {
              setLoading(false);
          }
      }
  };

  useEffect(() => {
      if (selectedSection === 'iva') {
          loadIVAs();
      }
  }, [selectedSection, loadIVAs]);

  // Función para abrir modal de crear/editar
  const openIVAModal = (iva = null) => {
      if (iva) {
          setEditingIVA(iva);
          setIVAFormData({
              codigo: iva.codigo || '',
              descripcion: iva.descripcion || '',
              porcentaje: iva.porcentaje || '',
              es_aplicable: iva.es_aplicable || false, // ⚠️ CAMBIADO
              observaciones: iva.observaciones || ''
          });
      } else {
          setEditingIVA(null);
          setIVAFormData({
              codigo: '',
              descripcion: '',
              porcentaje: '0',
              es_aplicable: false, // ⚠️ CAMBIADO: Por defecto no aplicable
              observaciones: ''
          });
      }
      setShowIVAModal(true);
  };


  const closeIVAModal = () => {
      setShowIVAModal(false);
      setEditingIVA(null);
      setIVAFormData({
          codigo: '',
          descripcion: '',
          porcentaje: '0',
          es_aplicable: false, // ⚠️ CAMBIADO
          observaciones: ''
      });
  };

  // Guardar IVA (crear o actualizar)
  const handleSaveIVA = async (e) => {
      e.preventDefault();

      if (!permissions.canCreate && !editingIVA) {
          window.alert("❌ No tienes permiso para crear IVAs.");
          return;
      }

      if (!permissions.canUpdate && editingIVA) {
          window.alert("❌ No tienes permiso para actualizar IVAs.");
          return;
      }

      // ⚠️ VALIDACIÓN ACTUALIZADA: lógica invertida
      // es_aplicable=true  → porcentaje debe ser > 0
      // es_aplicable=false → porcentaje puede ser cualquiera
      if (ivaFormData.es_aplicable && parseFloat(ivaFormData.porcentaje) <= 0) {
          window.alert("❌ Si es aplicable (true), el porcentaje debe ser mayor a 0");
          return;
      }

      setLoading(true);
      setError(null);

      try {
          const dataToSend = {
              codigo: ivaFormData.codigo.trim().toUpperCase(),
              descripcion: ivaFormData.descripcion.trim(),
              porcentaje: parseFloat(ivaFormData.porcentaje),
              es_aplicable: ivaFormData.es_aplicable, // ⚠️ CAMBIADO
              observaciones: ivaFormData.observaciones.trim() || null
          };

          let result;
          if (editingIVA) {
              result = await ivaService.updateIVA(editingIVA.id_iva, dataToSend);
          } else {
              result = await ivaService.createIVA(dataToSend);
          }

          if (result.success) {
              const accion = editingIVA ? 'actualizado' : 'creado';
              window.alert(
                  `✔ IVA ${accion} exitosamente` +
                  (!editingIVA ? '\n\n(Creado como desactivado y no aplicable por defecto)' : '')
              );
              setSuccess(result.message);
              closeIVAModal();
              await loadIVAs();
              setTimeout(() => setSuccess(null), 3000);
          } else {
              window.alert(`❌ Error: ${result.message}`);
              setError(result.message);
          }
      } catch (err) {
          window.alert("❌ Error inesperado al guardar el IVA.");
          setError("Error al guardar el IVA");
          console.error("Error:", err);
      } finally {
          setLoading(false);
      }
  };


  // Activar IVA
  const handleActivarIVA = async (id, codigo, esAplicable) => {
      if (!permissions.canUpdate) {
          window.alert("❌ No tienes permiso para activar IVAs.");
          return;
      }

      // Mensaje diferenciado según el tipo
      let mensajeConfirmacion = 
          `¿Deseas activar el IVA "${codigo}"?\n\n` +
          `Tipo: ${esAplicable ? 'Aplicable' : 'No Aplicable'}\n\n`;

      if (esAplicable) {
          mensajeConfirmacion += 
              `⚠️ ATENCIÓN: Este IVA es APLICABLE\n` +
              `Al activarlo, se desactivarán automáticamente todos los demás IVAs.\n` +
              `Solo puede haber un IVA activo a la vez.\n\n`;
      }

      mensajeConfirmacion += `¿Continuar?`;

      const confirmarActivacion = window.confirm(mensajeConfirmacion);
      if (!confirmarActivacion) return;

      setLoading(true);
      setError(null);

      try {
          const result = await ivaService.activarIVA(id);
          
          if (result.success) {
              const mensaje = result.data?.ivas_desactivados > 0
                  ? `✔ IVA "${codigo}" activado\n\n` +
                    `Se desactivaron ${result.data.ivas_desactivados} IVA(s) automáticamente.`
                  : `✔ IVA "${codigo}" activado exitosamente`;
              
              window.alert(mensaje);
              setSuccess(result.message);
              await loadIVAs();
              setTimeout(() => setSuccess(null), 3000);
          } else {
              window.alert(`❌ Error: ${result.message}`);
              setError(result.message);
          }
      } catch (err) {
          window.alert("❌ Error inesperado al activar el IVA.");
          setError("Error al activar el IVA");
          console.error("Error:", err);
      } finally {
          setLoading(false);
      }
  };

  // Desactivar IVA
  const handleDesactivarIVA = async (id, codigo, esAplicable) => {
      if (!permissions.canUpdate) {
          window.alert("❌ No tienes permiso para desactivar IVAs.");
          return;
      }

      // Mensaje diferenciado según el tipo
      let mensajeConfirmacion = `¿Deseas desactivar el IVA "${codigo}"?\n\n`;
      
      if (esAplicable) {
          // Verificar si es el único aplicable
          const cantidadAplicables = ivasAplicables.length;
          
          if (cantidadAplicables <= 1) {
              window.alert(
                  `❌ NO SE PUEDE DESACTIVAR\n\n` +
                  `"${codigo}" es el único IVA con es_aplicable=true en el sistema.\n\n` +
                  `Debe existir al menos un IVA aplicable.\n\n` +
                  `Primero crea o configura otro IVA como aplicable.`
              );
              return;
          }
          
          mensajeConfirmacion += 
              `⚠️ ATENCIÓN: Este es un IVA APLICABLE\n\n` +
              `Al desactivarlo:\n` +
              `• No habrá IVA activo en el sistema\n` +
              `• Las nuevas facturas no tendrán IVA por defecto\n` +
              `• Deberás activar otro IVA manualmente\n\n` +
              `Todavía habrá ${cantidadAplicables - 1} IVA(s) aplicable(s) en el sistema.\n\n`;
      }

      mensajeConfirmacion += `¿Estás seguro de continuar?`;

      const confirmed = window.confirm(mensajeConfirmacion);
      if (!confirmed) return;

      setLoading(true);
      setError(null);

      try {
          const result = await ivaService.desactivarIVA(id);
          
          if (result.success) {
              window.alert(`✔ IVA "${codigo}" desactivado exitosamente`);
              setSuccess(result.message);
              await loadIVAs();
              setTimeout(() => setSuccess(null), 3000);
          } else {
              window.alert(`❌ Error: ${result.message}`);
              setError(result.message);
          }
      } catch (err) {
          window.alert("❌ Error inesperado al desactivar el IVA.");
          setError("Error al desactivar el IVA");
          console.error("Error:", err);
      } finally {
          setLoading(false);
      }
  };

  // Eliminar IVA
  const handleDeleteIVA = async (id, codigo, esAplicable, activo) => {
      if (!permissions.canDelete) {
          window.alert("❌ No tienes permiso para eliminar IVAs.");
          return;
      }

      // Verificar si es el único aplicable
      if (esAplicable) {
          const cantidadAplicables = ivasAplicables.length;
          
          if (cantidadAplicables <= 1) {
              window.alert(
                  `❌ NO SE PUEDE ELIMINAR\n\n` +
                  `"${codigo}" es el único IVA con es_aplicable=true en el sistema.\n\n` +
                  `Debe existir al menos un IVA aplicable.\n\n` +
                  `Primero crea otro IVA aplicable antes de eliminar este.`
              );
              return;
          }
      }

      // Mensaje de confirmación más detallado
      let mensajeConfirmacion = 
          `⚠️ ELIMINAR IVA\n\n` +
          `IVA: "${codigo}"\n` +
          `Estado: ${activo ? 'ACTIVO' : 'Inactivo'}\n` +
          `Tipo: ${esAplicable ? 'Aplicable' : 'No Aplicable'}\n\n`;

      if (activo && esAplicable) {
          mensajeConfirmacion += 
              `⚠️ Este es el IVA APLICABLE ACTIVO\n` +
              `Al eliminarlo, no habrá IVA por defecto en las facturas.\n\n`;
      }

      mensajeConfirmacion += 
          `Esta acción es IRREVERSIBLE y puede afectar:\n` +
          `• Facturas existentes\n` +
          `• Reportes históricos\n` +
          `• Registros contables\n\n` +
          `¿Estás COMPLETAMENTE SEGURO?`;

      const confirmed = window.confirm(mensajeConfirmacion);
      if (!confirmed) return;

      // Confirmación adicional para IVAs activos
      if (activo) {
          const confirmarFinal = window.confirm(
              `⚠️ ÚLTIMA CONFIRMACIÓN\n\n` +
              `Vas a eliminar un IVA ACTIVO: "${codigo}"\n\n` +
              `¿Realmente deseas continuar?`
          );
          
          if (!confirmarFinal) return;
          
          const palabraConfirmacion = window.prompt(
              `Escribe "ELIMINAR" para confirmar la eliminación de "${codigo}"`
          );
          
          if (palabraConfirmacion !== "ELIMINAR") {
              window.alert("❌ Eliminación cancelada. La palabra no coincide.");
              return;
          }
      }

      setLoading(true);
      setError(null);

      try {
          const result = await ivaService.deleteIVA(id);
          
          if (result.success) {
              window.alert(`✔ IVA "${codigo}" eliminado exitosamente`);
              setSuccess(result.message);
              await loadIVAs();
              setTimeout(() => setSuccess(null), 3000);
          } else {
              window.alert(`❌ Error: ${result.message}`);
              setError(result.message);
          }
      } catch (err) {
          window.alert("❌ Error inesperado al eliminar el IVA.");
          setError("Error al eliminar el IVA");
          console.error("Error:", err);
      } finally {
          setLoading(false);
      }
  };


  // ======================================
  // GESTIÓN DE MORA
  // ======================================

  // Cargar TODAS las configuraciones de mora
  const loadMoras = useCallback(async () => {
    setLoadingMoras(true);
    setError(null);

    try {
      // Cargar todas las configuraciones
      const result = await moraService.listConfiguraciones({});

      if (result.success) {
        // Ordenar: activas primero, luego por fecha de creación descendente
        const morasOrdenadas = [...result.data].sort((a, b) => {
          // Primero por estado activo
          if (a.activo !== b.activo) return b.activo ? 1 : -1;
          
          // Luego vigentes primero
          if (a.es_vigente !== b.es_vigente) {
            return Number(b.es_vigente) - Number(a.es_vigente);
          }
          
          // Finalmente por fecha de creación descendente
          return new Date(b.fecha_creacion) - new Date(a.fecha_creacion);
        });

        setMoras(morasOrdenadas);

        // ✅ Cargar estado del toggle
        const estadoMora = await moraService.obtenerEstadoMora();
        if (estadoMora.success) {
          setAplicarMora(estadoMora.aplicar_mora);
          setMoraActiva(estadoMora.configuracion_activa);
          console.log('✅ Estado mora:', estadoMora.aplicar_mora ? 'ACTIVADO' : 'DESACTIVADO');
        }

        console.log('✅ Configuraciones de mora cargadas:', morasOrdenadas.length);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Error al cargar las configuraciones de mora');
      console.error('Error:', err);
    } finally {
      setLoadingMoras(false);
    }
  }, []);

  // Handler para el toggle de aplicar Mora
  const handleToggleAplicarMora = async () => {
    if (!permissions.canUpdate) {
      window.alert("❌ No tienes permiso para cambiar la configuración de mora.");
      return;
    }

    const nuevoEstado = !aplicarMora;

    if (nuevoEstado) {
      // ======================================== 
      // ACTIVAR MORA
      // ========================================
      if (moras.length === 0) {
        window.alert(
          "❌ No hay configuraciones de mora creadas.\n\n" +
          "Primero debes crear al menos una configuración de mora."
        );
        return;
      }

      // Buscar una configuración vigente y activa, o la primera vigente
      let moraParaActivar = moras.find(m => m.es_vigente && m.activo);
      
      if (!moraParaActivar) {
        moraParaActivar = moras.find(m => m.es_vigente);
      }

      if (!moraParaActivar) {
        window.alert(
          "❌ No hay configuraciones vigentes.\n\n" +
          "Marca al menos una configuración como vigente antes de activar la mora."
        );
        return;
      }

      const confirmar = window.confirm(
        `¿Deseas ACTIVAR la aplicación de mora?\n\n` +
        `Configuración a activar: ${moraParaActivar.nombre}\n` +
        `Tipo: ${moraService.formatTipoCalculo(moraParaActivar.tipo_calculo)}\n` +
        `Valor: ${moraService.formatValorMora(moraParaActivar)}\n` +
        `Días de gracia: ${moraParaActivar.dias_gracia}\n\n` +
        `Las facturas vencidas empezarán a acumular mora automáticamente.`
      );

      if (!confirmar) return;

      setLoading(true);
      setError(null);

      try {
        // Activar la configuración seleccionada
        const result = await moraService.activarConfiguracion(moraParaActivar.id_configuracion_mora);

        if (result.success) {
          window.alert(`✔ Mora activada: ${moraParaActivar.nombre}`);
          setSuccess('Mora activada correctamente');
          // Recargar para actualizar estados
          await loadMoras();
          setTimeout(() => setSuccess(null), 3000);
        } else {
          window.alert(`❌ Error: ${result.message}`);
          setError(result.message);
        }
      } catch (err) {
        window.alert("❌ Error inesperado al activar mora.");
        setError("Error al cambiar configuración de mora");
        console.error("Error:", err);
      } finally {
        setLoading(false);
      }
    } else {
      // ======================================== 
      // DESACTIVAR MORA
      // ========================================
      const confirmar = window.confirm(
        `⚠️ ¿Deseas DESACTIVAR la mora?\n\n` +
        `Las facturas vencidas NO acumularán mora automáticamente.\n\n` +
        `¿Continuar?`
      );

      if (!confirmar) return;

      setLoading(true);
      setError(null);

      try {
        // Desactivar la configuración activa actual
        if (moraActiva) {
          const result = await moraService.desactivarConfiguracion(moraActiva.id_configuracion_mora);

          if (result.success) {
            window.alert("✔ Mora desactivada correctamente");
            setSuccess('Mora desactivada');
            // Recargar para actualizar estados
            await loadMoras();
            setTimeout(() => setSuccess(null), 3000);
          } else {
            window.alert(`❌ Error: ${result.message}`);
            setError(result.message);
          }
        }
      } catch (err) {
        window.alert("❌ Error inesperado al desactivar mora.");
        setError("Error al cambiar configuración de mora");
        console.error("Error:", err);
      } finally {
        setLoading(false);
      }
    }
  };


  useEffect(() => {
    if (selectedSection === 'mora') {
      loadMoras();
    }
  }, [selectedSection, loadMoras]);

  // Función para abrir modal de crear/editar
  const openMoraModal = (mora = null) => {
    if (mora) {
      setEditingMora(mora);
      setMoraFormData({
        nombre: mora.nombre || '',
        descripcion: mora.descripcion || '',
        tipo_periodo: mora.tipo_periodo || 'dias',
        dias_gracia: mora.dias_gracia || 0,
        meses_gracia: mora.meses_gracia || 0, 
        tipo_calculo: mora.tipo_calculo || 'porcentaje',
        porcentaje_mora: mora.porcentaje_mora || '',
        valor_fijo: mora.valor_fijo || '',
        interes_diario: mora.interes_diario || '',
        vigencia_desde: mora.vigencia_desde || '',
        vigencia_hasta: mora.vigencia_hasta || '',
        es_vigente: mora.es_vigente !== undefined ? mora.es_vigente : true,
        mora_maxima: mora.mora_maxima || '',
        aplicar_sobre: mora.aplicar_sobre || 'total'
      });
    } else {
      setEditingMora(null);
      // Obtener fecha actual para vigencia_desde por defecto
      const hoy = new Date().toISOString().split('T')[0];
      setMoraFormData({
        nombre: '',
        descripcion: '',
        tipo_periodo: 'dias',
        dias_gracia: 0,
        meses_gracia: 0, 
        tipo_calculo: 'porcentaje',
        porcentaje_mora: '',
        valor_fijo: '',
        interes_diario: '',
        vigencia_desde: hoy,
        vigencia_hasta: '',
        es_vigente: true,
        mora_maxima: '',
        aplicar_sobre: 'total'
      });
    }
    setShowMoraModal(true);
  };

  const closeMoraModal = () => {
    setShowMoraModal(false);
    setEditingMora(null);
    const hoy = new Date().toISOString().split('T')[0];
    setMoraFormData({
      nombre: '',
      descripcion: '',
      dias_gracia: 0,
      tipo_calculo: 'porcentaje',
      porcentaje_mora: '',
      valor_fijo: '',
      interes_diario: '',
      vigencia_desde: hoy,
      vigencia_hasta: '',
      es_vigente: true,
      mora_maxima: '',
      aplicar_sobre: 'total'
    });
  };

  // Guardar configuración de mora (crear o actualizar)
const handleSaveMora = async (e) => {
  e.preventDefault();
  
  if (!permissions.canCreate && !editingMora) {
    window.alert("❌ No tienes permiso para crear configuraciones de mora.");
    return;
  }
  
  if (!permissions.canUpdate && editingMora) {
    window.alert("❌ No tienes permiso para actualizar configuraciones de mora.");
    return;
  }

  setLoading(true);
  setError(null);

  try {
    const dataToSend = {
      nombre: moraFormData.nombre.trim(),
      descripcion: moraFormData.descripcion.trim() || null,
      tipo_periodo: moraFormData.tipo_periodo, // ✅ NUEVO
      tipo_calculo: moraFormData.tipo_calculo,
      vigencia_desde: moraFormData.vigencia_desde,
      vigencia_hasta: moraFormData.vigencia_hasta || null,
      es_vigente: moraFormData.es_vigente,
      mora_maxima: moraFormData.mora_maxima ? parseFloat(moraFormData.mora_maxima) : null,
      aplicar_sobre: moraFormData.aplicar_sobre
    };

    // ✅ Incluir días o meses según el tipo_periodo
    if (moraFormData.tipo_periodo === 'dias') {
      dataToSend.dias_gracia = parseInt(moraFormData.dias_gracia) || 0;
      dataToSend.meses_gracia = null; // Limpiar meses
    } else {
      dataToSend.meses_gracia = parseInt(moraFormData.meses_gracia) || 0;
      dataToSend.dias_gracia = null; // Limpiar días
    }

    // Agregar valores según tipo de cálculo
    if (moraFormData.tipo_calculo === 'porcentaje') {
      dataToSend.porcentaje_mora = parseFloat(moraFormData.porcentaje_mora);
    } else if (moraFormData.tipo_calculo === 'fijo') {
      dataToSend.valor_fijo = parseFloat(moraFormData.valor_fijo);
    } else if (moraFormData.tipo_calculo === 'interes_diario') {
      dataToSend.interes_diario = parseFloat(moraFormData.interes_diario);
    }

    let result;
    if (editingMora) {
      result = await moraService.updateConfiguracion(editingMora.id_configuracion_mora, dataToSend);
    } else {
      result = await moraService.createConfiguracion(dataToSend);
    }

    if (result.success) {
      const accion = editingMora ? 'actualizada' : 'creada';
      window.alert(
        `✔ Configuración de mora ${accion} exitosamente` +
        (!editingMora ? '\n\n(Creada como desactivada por defecto)' : '')
      );
      setSuccess(result.message);
      closeMoraModal();
      await loadMoras();
      setTimeout(() => setSuccess(null), 3000);
    } else {
      window.alert(`❌ Error: ${result.message}`);
      setError(result.message);
    }
  } catch (err) {
    window.alert("❌ Error inesperado al guardar la configuración de mora.");
    setError("Error al guardar la configuración de mora");
    console.error("Error:", err);
  } finally {
    setLoading(false);
  }
};

  // Activar configuración de mora
  const handleActivarMora = async (id, nombre) => {
    if (!permissions.canUpdate) {
      window.alert("❌ No tienes permiso para activar configuraciones de mora.");
      return;
    }

    const confirmed = window.confirm(
      `¿Deseas activar la configuración de mora "${nombre}"?\n\n` +
      `Esto desactivará automáticamente cualquier otra configuración activa.\n\n` +
      `Las facturas vencidas empezarán a acumular mora según esta configuración.`
    );

    if (!confirmed) return;

    setLoading(true);
    setError(null);

    try {
      const result = await moraService.activarConfiguracion(id);

      if (result.success) {
        const mensaje = result.data?.configs_desactivadas > 0
          ? `✔ Configuración "${nombre}" activada\n\n` +
            `Se desactivaron ${result.data.configs_desactivadas} configuración(es) automáticamente.`
          : `✔ Configuración "${nombre}" activada exitosamente`;

        window.alert(mensaje);
        setSuccess(result.message);
        await loadMoras();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        window.alert(`❌ Error: ${result.message}`);
        setError(result.message);
      }
    } catch (err) {
      window.alert("❌ Error inesperado al activar la configuración de mora.");
      setError("Error al activar la configuración de mora");
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Desactivar configuración de mora
  const handleDesactivarMora = async (id, nombre) => {
    if (!permissions.canUpdate) {
      window.alert("❌ No tienes permiso para desactivar configuraciones de mora.");
      return;
    }

    const confirmed = window.confirm(
      `¿Deseas desactivar la configuración de mora "${nombre}"?\n\n` +
      `Las facturas vencidas dejarán de acumular mora.`
    );

    if (!confirmed) return;

    setLoading(true);
    setError(null);

    try {
      const result = await moraService.desactivarConfiguracion(id);

      if (result.success) {
        window.alert(`✔ Configuración "${nombre}" desactivada exitosamente`);
        setSuccess(result.message);
        await loadMoras();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        window.alert(`❌ Error: ${result.message}`);
        setError(result.message);
      }
    } catch (err) {
      window.alert("❌ Error inesperado al desactivar la configuración de mora.");
      setError("Error al desactivar la configuración de mora");
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Eliminar configuración de mora
  const handleDeleteMora = async (id, nombre, activo) => {
    if (!permissions.canDelete) {
      window.alert("❌ No tienes permiso para eliminar configuraciones de mora.");
      return;
    }

    let mensajeConfirmacion = `⚠️ ELIMINAR CONFIGURACIÓN DE MORA\n\n` +
      `Configuración: "${nombre}"\n` +
      `Estado: ${activo ? 'ACTIVA' : 'Inactiva'}\n\n`;

    if (activo) {
      mensajeConfirmacion += `⚠️ Esta configuración está ACTIVA\n` +
        `Al eliminarla, no habrá mora aplicable en las facturas.\n\n`;
    }

    mensajeConfirmacion += `Esta acción es IRREVERSIBLE y puede afectar:\n` +
      `• Cálculos de mora en facturas vencidas\n` +
      `• Reportes históricos\n` +
      `• Registros contables\n\n` +
      `¿Estás COMPLETAMENTE SEGURO?`;

    const confirmed = window.confirm(mensajeConfirmacion);
    if (!confirmed) return;

    // Confirmación adicional para configuraciones activas
    if (activo) {
      const confirmarFinal = window.confirm(
        `⚠️ ÚLTIMA CONFIRMACIÓN\n\n` +
        `Vas a eliminar una configuración ACTIVA: "${nombre}"\n\n` +
        `¿Realmente deseas continuar?`
      );
      if (!confirmarFinal) return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await moraService.deleteConfiguracion(id);

      if (result.success) {
        window.alert(`✔ Configuración "${nombre}" eliminada exitosamente`);
        setSuccess(result.message);
        await loadMoras();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        window.alert(`❌ Error: ${result.message}`);
        setError(result.message);
      }
    } catch (err) {
      window.alert("❌ Error inesperado al eliminar la configuración de mora.");
      setError("Error al eliminar la configuración de mora");
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };


  // ========================================
  // RENDER  PRINCIPAL 
  // ========================================

  if (!permissions.canRead && !permissions.canManageBackups) {
    return (
      <div className="section-placeholder">
        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
        <h2>Acceso Denegado</h2>
        <p>No tienes permiso para acceder al módulo de configuración.</p>
      </div>
    );
  }

  if (loading && !selectedSection) {
    return (
      <div className="section-placeholder">
        <RefreshCw className="w-16 h-16 mx-auto mb-4 text-gray-400 animate-spin" />
        <h2>Cargando Configuración</h2>
        <p>Por favor espera mientras cargamos la información...</p>
      </div>
    );
  }

  const stats = {
    secciones: configSections.filter(s => s.visible).length,
    backupsTotal: backups.length,
    ultimoBackup: backups.length > 0 ? backups[0].filename : 'N/A'
  };

  const currentSection = configSections.find(
    (section) => section.id === selectedSection
  );

  return (
    <div className="roles-section">
      {/* Header */}
      <div className="section-header">
        <div className="section-title">
          <Settings className="w-6 h-6 text-blue-600" />
          <h2>Configuración del Sistema</h2>
        </div>
      </div>

      {/* Stats */}
      <div className="users-stats">
        <div className="stat-item">
          <Settings className="stat-icon text-blue-600" />
          <div>
            <p className="stat-label">Secciones</p>
            <p className="stat-value">{stats.secciones}</p>
          </div>
        </div>

        <div className="stat-item">
          <Database className="stat-icon text-green-600" />
          <div>
            <p className="stat-label">Backups Totales</p>
            <p className="stat-value">{stats.backupsTotal}</p>
          </div>
        </div>

        <div className="stat-item">
          <Clock className="stat-icon text-purple-600" />
          <div>
            <p className="stat-label">Último Backup</p>
              <p className="text-[30px] font-bold truncate max-w-[150px]">
                {stats.ultimoBackup}
              </p>
          </div>
        </div>
      </div>

      {/* Mensajes globales */}
      {error && (
        <div className="alert alert-error mb-4">
          <AlertCircle className="w-5 h-5 mr-2" />
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success mb-4">
          <CheckCircle className="w-5 h-5 mr-2" />
          {success}
        </div>
      )}

      {/* Layout de dos columnas */}
      <div className="roles-layout">
        {/* Panel de Secciones (Izquierda) */}
        <div className="roles-list-panel">
          <h3 className="panel-title">
            <Settings className="w-5 h-5" />
            Secciones de Configuración
          </h3>
          
          <div className="roles-list">
            {configSections
              .filter(section => section.visible)
              .map(section => {
                const Icon = section.icon;
                return (
                  <div
                    key={section.id}
                    className={`role-item ${selectedSection === section.id ? 'selected' : ''}`}
                    onClick={() => setSelectedSection(section.id)}
                  >
                    <div className="role-item-header">
                      <div className="role-item-title">
                        <Icon className="w-5 h-5 mr-2" />
                        {section.nombre}
                      </div>
                    </div>
                    
                    <div className="role-item-description">
                      {section.descripcion}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Panel de Contenido (Derecha) */}
        <div className="actions-panel">
          {currentSection ? (
            <>
              {/* SECCIÓN: BACKUPS */}
              {selectedSection === 'backups' && permissions.canManageBackups && (
                <>
                  <div className="actions-header">
                    <div>
                      <h3 className="panel-title">
                        <Database className="w-5 h-5 mr-2" />
                        Gestión de Respaldos
                      </h3>
                      <p className="panel-subtitle">
                        {backups.length} backup{backups.length !== 1 ? 's' : ''} disponible{backups.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div style={{display: 'flex', gap: '0.5rem'}}>
                      <button
                        className="btn-secondary"
                        onClick={loadBackups}
                        disabled={loadingBackups}
                        title="Recargar lista"
                      >
                        <RefreshCw className={`w-4 h-4 ${loadingBackups ? 'animate-spin' : ''}`} />
                      </button>
                      {permissions.canCreate && (
                        <button
                          className="btn-primary"
                          onClick={handleCreateBackup}
                          disabled={loading}
                        >
                          <Database className="w-4 h-4 mr-2" />
                          Nuevo Backup
                        </button>
                      )}
                    </div>
                  </div>

                  {loadingBackups ? (
                    <div className="section-placeholder">
                      <RefreshCw className="w-8 h-8 mx-auto mb-2 text-blue-600 animate-spin" />
                      <p>Cargando backups...</p>
                    </div>
                  ) : backups.length === 0 ? (
                    <div className="empty-state">
                      <Database className="w-16 h-16 text-gray-300 mx-auto mb-2" />
                      <h3>No hay backups disponibles</h3>
                      <p>Crea tu primer backup haciendo clic en el botón superior</p>
                    </div>
                  ) : (
                    <>
                      <div className="actions-grid">
                        {backups.map((backup, index) => (
                          <div key={index} className="action-card">
                            <div className="action-card-header">
                              <div className="action-info">
                                <FileText className="w-6 h-6 text-blue-600 mr-3" />
                                <div>
                                  <div className="action-name">{backup.filename}</div>
                                  <div className="action-type">
                                    {configService.formatFileSize(backup.size)}
                                  </div>
                                </div>
                              </div>
                              <div className="action-buttons">
                                {permissions.canRead && (
                                  <button
                                    className="action-btn view"
                                    onClick={() => handleDownloadBackup(backup.filename)}
                                    title="Descargar"
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                )}
                                {permissions.canUpdate && (
                                  <button
                                    className="action-btn edit"
                                    onClick={() => handleRestoreBackup(backup.filename)}
                                    title="Restaurar"
                                    disabled={loading}
                                  >
                                    <Upload className="w-4 h-4" />
                                  </button>
                                )}
                                {permissions.canDelete && (
                                  <button
                                    className="action-btn delete"
                                    onClick={() => handleDeleteBackup(backup.filename)}
                                    title="Eliminar"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="action-card-footer">
                              <span className="date-badge">
                                <Calendar className="w-3 h-3" />
                                {configService.formatBackupDate(backup.created_at)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Advertencia */}
                      <div className="alert alert-warning" style={{marginTop: '1.5rem'}}>
                        <AlertCircle className="w-5 h-5 mr-2" />
                        <div>
                          <strong>⚠️ Advertencia Importante:</strong>
                          <p style={{marginTop: '0.5rem', fontSize: '0.875rem'}}>
                            Restaurar un backup reemplazará todos los datos actuales de la base de datos.
                            Asegúrate de crear un backup reciente antes de restaurar uno antiguo.
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
              {selectedSection === 'limites' && (
              <div className="content-section">
                {/* SECCIÓN: LÍMITES GEOGRÁFICOS */}
                <div className="section-header">
                  <div className="section-title-group">
                    <h2>Límites Geográficos</h2>
                    <p className="section-subtitle">
                      Gestiona los límites geográficos del sistema
                    </p>
                  </div>
                  <div style={{display: 'flex', gap: '0.5rem'}}>
                    <button
                      className="btn-secondary"
                      onClick={loadLimites}
                      disabled={loadingLimites}
                      title="Recargar lista de límites"
                    >
                      <RefreshCw className={`w-4 h-4 ${loadingLimites ? 'animate-spin' : ''}`} />
                    </button>
                    
                    {permissions.canCreate && (
                      <button 
                        className="btn-primary"
                        onClick={() => openLimiteModal()}
                        disabled={loading}
                      >
                        <Map className='w-4 h-4 mr-2'/>
                        Nuevo Límite
                      </button>
                    )}
                 </div>
                </div>

                {/* Alertas */}
                {error && (
                  <div className="alert alert-error">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                  </div>
                )}

                {success && (
                  <div className="alert alert-success">
                    <CheckCircle size={18} />
                    <span>{success}</span>
                  </div>
                )}

                {/* Información */}
                <div className="info-card">
                  <div className="info-item">
                    <span className="info-label">Total de Límites</span>
                    <span className="info-value">{limites.length}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Límite Activo</span>
                    <span className="info-value">
                      {limites.find(l => l.activo)?.nombre || 'Ninguno'}
                    </span>
                  </div>
                </div>

                {/* Lista de límites */}
                {loadingLimites ? (
                  <div className="loading-container">
                    <RefreshCw className="spinner" size={32} />
                    <p>Cargando límites...</p>
                  </div>
                ) : limites.length === 0 ? (
                  <div className="empty-state">
                    <Database size={48} />
                    <p>No hay límites geográficos configurados</p>
                    {permissions.canCreate && (
                      <button 
                        className="btn-primary"
                        onClick={() => openLimiteModal()}
                      >
                        Crear Primer Límite
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Nombre</th>
                          <th>Coordenadas</th>
                          <th>Altitud (m)</th>
                          <th>Estado</th>
                          <th>Creado</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {limites.map(limite => (
                          <tr key={limite.id}>
                            <td>
                              <div className="limite-nombre">
                                {limite.nombre}
                                
                              </div>
                            </td>
                            <td>
                              <div className="coordenadas-cell">
                                <div>N: {limite.norte}°</div>
                                <div>S: {limite.sur}°</div>
                                <div>E: {limite.este}°</div>
                                <div>O: {limite.oeste}°</div>
                              </div>
                            </td>
                            <td>
                              {limite.altitud_min !== null && limite.altitud_max !== null
                                ? `${limite.altitud_min} - ${limite.altitud_max}`
                                : 'No definida'}
                            </td>
                            <td>
                              {limite.activo ? (
                                <span className="badge badge-success flex items-center gap-1">
                                  <CheckCircle className="w-4 h-4" />
                                  Activo
                                </span>
                              ) : (
                                <span className="badge badge-inactive flex items-center gap-1">
                                  <XCircle className="w-4 h-4" />
                                  Inactivo
                                </span>
                              )}
                            </td>

                            <td>
                              {new Date(limite.creado_en).toLocaleDateString('es-EC')}
                            </td>
                            <td>
                              <div className="action-buttons">
                                {!limite.activo && permissions.canUpdate && (
                                  <button
                                    className="btn-icon btn-success"
                                    onClick={() => handleActivateLimite(limite.id, limite.nombre)}
                                    title="Activar límite"
                                  >
                                    <CheckCircle size={16} />
                                  </button>
                                )}
                                {permissions.canUpdate && (
                                  <button
                                    className="btn-icon btn-primary"
                                    onClick={() => openLimiteModal(limite)}
                                    title="Editar"
                                  >
                                    <Edit size={16} />
                                  </button>
                                )}
                                {permissions.canDelete && (
                                  <button
                                    className="btn-icon btn-danger"
                                    onClick={() => handleDeleteLimite(limite.id, limite.nombre)}
                                    title="Eliminar"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* MODAL DE CREACIÓN / EDICIÓN DE LÍMITE */}
                {showLimiteModal && (
                  <div className="modal-overlay" onClick={closeLimiteModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                      <div className="modal-header">
                        <h3>{editingLimite ? 'Editar' : 'Nuevo'} Límite Geográfico</h3>
                        <button type="button" className="btn-close" onClick={closeLimiteModal}>×</button>
                      </div>
                      
                      <form onSubmit={handleSaveLimite} className="limite-form">
                        <div className="modal-body">
                          <div className="form-group">
                            <label>Nombre del Límite *</label>
                            <input
                              type="text"
                              className="form-input"
                              value={limiteFormData.nombre}
                              onChange={(e) => setLimiteFormData({...limiteFormData, nombre: e.target.value})}
                              placeholder="Ej: Ecuador Continental"
                              required
                              minLength={3}
                              maxLength={150}
                            />
                          </div>

                          <div className="form-row">
                            <div className="form-group">
                              <label>Límite Norte (Latitud) *</label>
                              <input
                                type="number"
                                step="0.0000001"
                                min="-90"
                                max="90"
                                className="form-input"
                                value={limiteFormData.norte}
                                onChange={(e) => setLimiteFormData({...limiteFormData, norte: e.target.value})}
                                placeholder="-90 a 90"
                                required
                              />
                            </div>
                            <div className="form-group">
                              <label>Límite Sur (Latitud) *</label>
                              <input
                                type="number"
                                step="0.0000001"
                                min="-90"
                                max="90"
                                className="form-input"
                                value={limiteFormData.sur}
                                onChange={(e) => setLimiteFormData({...limiteFormData, sur: e.target.value})}
                                placeholder="-90 a 90"
                                required
                              />
                            </div>
                          </div>

                          <div className="form-row">
                            <div className="form-group">
                              <label>Límite Este (Longitud) *</label>
                              <input
                                type="number"
                                step="0.0000001"
                                min="-180"
                                max="180"
                                className="form-input"
                                value={limiteFormData.este}
                                onChange={(e) => setLimiteFormData({...limiteFormData, este: e.target.value})}
                                placeholder="-180 a 180"
                                required
                              />
                            </div>
                            <div className="form-group">
                              <label>Límite Oeste (Longitud) *</label>
                              <input
                                type="number"
                                step="0.0000001"
                                min="-180"
                                max="180"
                                className="form-input"
                                value={limiteFormData.oeste}
                                onChange={(e) => setLimiteFormData({...limiteFormData, oeste: e.target.value})}
                                placeholder="-180 a 180"
                                required
                              />
                            </div>
                          </div>

                          <div className="form-row">
                            <div className="form-group">
                              <label>Altitud Mínima (m)</label>
                              <input
                                type="number"
                                step="0.01"
                                className="form-input"
                                value={limiteFormData.altitud_min}
                                onChange={(e) => setLimiteFormData({...limiteFormData, altitud_min: e.target.value})}
                                placeholder="Opcional"
                              />
                            </div>
                            <div className="form-group">
                              <label>Altitud Máxima (m)</label>
                              <input
                                type="number"
                                step="0.01"
                                className="form-input"
                                value={limiteFormData.altitud_max}
                                onChange={(e) => setLimiteFormData({...limiteFormData, altitud_max: e.target.value})}
                                placeholder="Opcional"
                              />
                            </div>
                          </div>

                          <div className="form-group">
                            <label className="checkbox-label">
                              <input
                                type="checkbox"
                                checked={limiteFormData.activo}
                                onChange={(e) => setLimiteFormData({...limiteFormData, activo: e.target.checked})}
                              />
                              <span>Activar este límite</span>
                            </label>
                          </div>
                        </div>

                        <div className="modal-footer">
                          <button 
                            type="button"
                            className="btn-secondary" 
                            onClick={closeLimiteModal}
                            disabled={loading}
                          >
                            Cancelar
                          </button>
                          <button 
                            type="submit"
                            className="btn-primary" 
                            disabled={loading}
                          >
                            {loading ? 'Guardando...' : 'Guardar'}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}



              </div>
              )}
              {selectedSection === 'iva' && (
                <div className="content-section">
                  {/* SECCIÓN: IVA */}
                  <div className="section-header">
                    <div className="section-title-group">
                      <h2>Gestión de IVA</h2>
                      <p className="section-subtitle">
                        Configura las tasas de IVA para tu sistema de facturación
                      </p>
                    </div>
                    <div style={{display: 'flex', gap: '0.5rem'}}>
                      <button
                        className="btn-secondary"
                        onClick={loadIVAs}
                        disabled={loadingIVAs}
                        title="Recargar lista de IVAs"
                      >
                        <RefreshCw className={`w-4 h-4 ${loadingIVAs ? 'animate-spin' : ''}`} />
                      </button>
                      
                      {permissions.canCreate && (
                        <button 
                          className="btn-primary"
                          onClick={() => openIVAModal()}
                          disabled={loading}
                        >
                          <Percent className='w-4 h-4 mr-2'/>
                          Nuevo IVA
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Alertas */}
                  {error && (
                    <div className="alert alert-error">
                      <AlertCircle size={18} />
                      <span>{error}</span>
                    </div>
                  )}

                  {success && (
                    <div className="alert alert-success">
                      <CheckCircle size={18} />
                      <span>{success}</span>
                    </div>
                  )}

                  {/* Toggle para activar/desactivar IVA */}
                  <div className="info-card" style={{marginBottom: '1.5rem'}}>
                    <div className="info-item" style={{flex: 1}}>
                      <span className="info-label">Aplicar IVA en facturación</span>
                      <button
                        className={`toggle-button ${aplicarIVA ? 'active' : ''}`}
                        onClick={handleToggleAplicarIVA}
                        type="button"
                        style={{marginTop: '0.5rem'}}
                        disabled={loading}
                      >
                        {aplicarIVA ? (
                          <>
                            <ToggleRight size={20} />
                            <span>Activado</span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft size={20} />
                            <span>Desactivado</span>
                          </>
                        )}
                      </button>
                      {/* Mostrar IVA activo actual */}
                      {aplicarIVA && ivaActivo && (
                        <div style={{marginTop: '0.5rem', fontSize: '0.875rem', color: '#666'}}>
                          IVA actual: {ivaActivo.codigo} ({ivaActivo.porcentaje}%)
                        </div>
                      )}
                      {!aplicarIVA && (
                        <div style={{marginTop: '0.5rem', fontSize: '0.875rem', color: '#999'}}>
                          Todos los IVAs están desactivados
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ⚠️ CONTENIDO DINÁMICO: Solo se muestra si aplicarIVA está activado */}
                  {aplicarIVA ? (
                    <>
                      {/* Información */}
                      <div className="info-card">
                        <div className="info-item">
                          <span className="info-label">Total de IVAs</span>
                          <span className="info-value">{ivas.length}</span>
                        </div>
                        <div className="info-item">
                          <span className="info-label">IVAs Activos</span>
                          <span className="info-value">
                            {ivas.filter(i => i.activo).length}
                          </span>
                        </div>
                        <div className="info-item">
                          <span className="info-label">IVAs Aplicables</span>
                          <span className="info-value">
                            {ivas.filter(i => i.es_aplicable === true).length}
                          </span>
                        </div>
                      </div>

                      {/* Lista de IVAs */}
                      {loadingIVAs ? (
                        <div className="loading-container">
                          <RefreshCw className="spinner" size={32} />
                          <p>Cargando IVAs...</p>
                        </div>
                      ) : ivas.length === 0 ? (
                        <div className="empty-state">
                          <Database size={48} />
                          <p>No hay IVAs configurados</p>
                          {permissions.canCreate && (
                            <button 
                              className="btn-primary"
                              onClick={() => openIVAModal()}
                            >
                              Crear Primer IVA
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="table-container">
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>Código</th>
                                <th>Descripción</th>
                                <th>Porcentaje</th>
                                <th>Tipo</th>
                                <th>Estado</th>
                                <th>Observaciones</th>
                                <th>Acciones</th>
                              </tr>
                            </thead>
                            <tbody>
                              {ivas.map((iva) => (
                                <tr key={iva.id_iva}>
                                  <td>
                                    <strong>{iva.codigo}</strong>
                                  </td>
                                  <td>{iva.descripcion}</td>
                                  <td className="text-center">
                                    <span className="badge badge-info">
                                      {parseFloat(iva.porcentaje).toFixed(2)}%
                                    </span>
                                  </td>
                                  <td>
                                    {iva.es_aplicable ? (
                                      <span className="badge badge-success">Aplicable</span>
                                    ) : (
                                      <span className="badge badge-inactive">No Aplicable</span>
                                    )}
                                  </td>
                                  <td>
                                    {iva.activo ? (
                                      <span className="badge badge-success flex items-center gap-1">
                                        <CheckCircle className="w-4 h-4" />
                                        Activo
                                      </span>
                                    ) : (
                                      <span className="badge badge-inactive flex items-center gap-1">
                                        <XCircle className="w-4 h-4" />
                                        Inactivo
                                      </span>
                                    )}
                                  </td>
                                  <td>{iva.observaciones || '-'}</td>
                                  <td>
                                    <div className="action-buttons">
                                      {!iva.activo && permissions.canUpdate && (
                                        <button
                                          className="btn-icon btn-success"
                                          onClick={() => handleActivarIVA(
                                            iva.id_iva, 
                                            iva.codigo, 
                                            iva.es_aplicable
                                          )}
                                          title="Activar IVA"
                                        >
                                          <CheckCircle size={16} />
                                        </button>
                                      )}
                                      {iva.activo && permissions.canUpdate && (
                                        <button
                                          className="btn-icon btn-warning"
                                          onClick={() => handleDesactivarIVA(
                                            iva.id_iva, 
                                            iva.codigo, 
                                            iva.es_aplicable
                                          )}
                                          title="Desactivar IVA"
                                        >
                                          <XCircle size={16} />
                                        </button>
                                      )}
                                      {permissions.canUpdate && (
                                        <button
                                          className="btn-icon btn-primary"
                                          onClick={() => openIVAModal(iva)}
                                          title="Editar"
                                        >
                                          <Edit size={16} />
                                        </button>
                                      )}
                                      {permissions.canDelete && (
                                        <button
                                          className="btn-icon btn-danger"
                                          onClick={() => handleDeleteIVA(
                                            iva.id_iva, 
                                            iva.codigo, 
                                            iva.es_aplicable,
                                            iva.activo
                                          )}
                                          title="Eliminar"
                                        >
                                          <Trash2 size={16} />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Información adicional */}
                      <div className="alert alert-info">
                        <AlertCircle size={18} />
                        <div>
                          <strong>Información importante:</strong>
                          <ul style={{marginTop: '0.5rem', paddingLeft: '1.25rem'}}>
                            <li>Solo puede haber <strong>un IVA activo</strong> a la vez en el sistema.</li>
                            <li>Los IVAs con <strong>"Aplicable"</strong> se usan para facturación con IVA.</li>
                            <li>Los IVAs <strong>"No Aplicable"</strong> representan facturación sin IVA.</li>
                            <li>Siempre debe existir al menos <strong>un IVA aplicable</strong> en el sistema.</li>
                            <li>Al activar un IVA, todos los demás se desactivan automáticamente.</li>
                          </ul>
                        </div>
                      </div>
                    </>
                  ) : (
                    // ⚠️ ESTADO DESACTIVADO: Mostrar mensaje cuando toggle está off
                    <div className="empty-state">
                      <ToggleLeft size={48} style={{color: '#94a3b8'}} />
                      <p style={{fontSize: '1.125rem', fontWeight: '500', color: '#64748b'}}>
                        La aplicación de IVA está desactivada
                      </p>
                      <p style={{fontSize: '0.875rem', color: '#94a3b8', marginTop: '0.5rem'}}>
                        Activa el interruptor de arriba para gestionar y configurar los IVAs del sistema.
                      </p>
                      {permissions.canUpdate && (
                        <button 
                          className="btn-primary"
                          onClick={handleToggleAplicarIVA}
                          style={{marginTop: '1rem'}}
                        >
                          <ToggleRight className="w-4 h-4 mr-2" />
                          Activar IVA
                        </button>
                      )}
                    </div>
                  )}

                  {/* MODAL DE CREACIÓN / EDICIÓN DE IVA */}
                  {showIVAModal && (
                    <div className="modal-overlay" onClick={closeIVAModal}>
                      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                          <h3>{editingIVA ? 'Editar' : 'Nuevo'} IVA</h3>
                          <button type="button" className="btn-close" onClick={closeIVAModal}>×</button>
                        </div>
                        
                        <form onSubmit={handleSaveIVA} className="limite-form">
                          <div className="modal-body">
                            <div className="form-group">
                              <label>Código *</label>
                              <input
                                type="text"
                                className="form-input"
                                value={ivaFormData.codigo}
                                onChange={(e) =>
                                  setIVAFormData({ ...ivaFormData, codigo: e.target.value.toUpperCase() })
                                }
                                placeholder="Ej: IVA12, IVA15, IVA0"
                                required
                                maxLength={10}
                                disabled={editingIVA}
                              />
                              <small className="form-help">Código único identificador del IVA (2-10 caracteres)</small>
                            </div>

                            <div className="form-group">
                              <label>Descripción *</label>
                              <input
                                type="text"
                                className="form-input"
                                value={ivaFormData.descripcion}
                                onChange={(e) =>
                                  setIVAFormData({ ...ivaFormData, descripcion: e.target.value })
                                }
                                placeholder="Ej: IVA 12%, IVA 15%, Sin IVA"
                                required
                                maxLength={100}
                              />
                            </div>

                            <div className="form-group">
                              <label>Porcentaje *</label>
                              <input
                                type="number"
                                className="form-input"
                                value={ivaFormData.porcentaje}
                                onChange={(e) =>
                                  setIVAFormData({ ...ivaFormData, porcentaje: e.target.value })
                                }
                                placeholder="0.00"
                                required
                                min="0"
                                max="100"
                                step="0.01"
                                disabled={!ivaFormData.es_aplicable}
                              />
                              <small className="form-help">
                                Porcentaje de IVA (0-100). 
                                {ivaFormData.es_aplicable 
                                  ? ' Debe ser mayor a 0 si es aplicable.' 
                                  : ' Puede ser cualquier valor si no es aplicable.'}
                              </small>
                            </div>

                            <div className="form-group">
                              <label className="checkbox-label">
                                <input
                                  type="checkbox"
                                  checked={ivaFormData.es_aplicable}
                                  onChange={(e) => {
                                    const isAplicable = e.target.checked;
                                    setIVAFormData({
                                      ...ivaFormData,
                                      es_aplicable: isAplicable,
                                      porcentaje: isAplicable ? ivaFormData.porcentaje : '0'
                                    });
                                  }}
                                />
                                <span>IVA Aplicable</span>
                              </label>
                              <small className="form-help">
                                Marcar si este IVA <strong>se aplica</strong> a las facturas (porcentaje {'>'} 0).
                                <br />
                                Desmarcar si NO se aplica IVA (ej: exento, 0%).
                              </small>
                            </div>

                            <div className="form-group">
                              <label>Observaciones</label>
                              <textarea
                                className="form-input"
                                value={ivaFormData.observaciones}
                                onChange={(e) =>
                                  setIVAFormData({ ...ivaFormData, observaciones: e.target.value })
                                }
                                placeholder="Notas adicionales sobre este IVA"
                                rows={3}
                                maxLength={500}
                              />
                            </div>

                            {!editingIVA && (
                              <div className="alert alert-info" style={{fontSize: '0.875rem'}}>
                                <AlertCircle size={16} />
                                <div>
                                  <strong>Nota:</strong> El IVA se creará <strong>desactivado</strong> y como <strong>no aplicable</strong> por defecto. 
                                  Podrás activarlo y configurarlo después de crearlo.
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="modal-footer">
                            <button 
                              type="button"
                              className="btn-secondary" 
                              onClick={closeIVAModal}
                              disabled={loading}
                            >
                              Cancelar
                            </button>
                            <button 
                              type="submit"
                              className="btn-primary" 
                              disabled={loading}
                            >
                              {loading ? 'Guardando...' : 'Guardar'}
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}

                </div>
              )}
{/* ========================================
    SECCIÓN: CONFIGURACIÓN DE MORA
    ======================================== */}
{selectedSection === 'mora' && (
  <div className="content-section">
    {/* SECCIÓN: MORA */}
    <div className="section-header">
      <div className="section-title-group">
        <h2>Gestión de Mora</h2>
        <p className="section-subtitle">
          Configura los intereses por pago tardío de facturas
        </p>
      </div>
      <div style={{display: 'flex', gap: '0.5rem'}}>
        <button
          className="btn-secondary"
          onClick={loadMoras}
          disabled={loadingMoras}
          title="Recargar lista de configuraciones"
        >
          <RefreshCw className={`w-4 h-4 ${loadingMoras ? 'animate-spin' : ''}`} />
        </button>
        
        {permissions.canCreate && (
          <button 
            className="btn-primary"
            onClick={() => openMoraModal()}
            disabled={loading}
          >
            <DollarSign className='w-4 h-4 mr-2'/>
            Nueva Configuración
          </button>
        )}
      </div>
    </div>

    {/* Alertas */}
    {error && (
      <div className="alert alert-error">
        <AlertCircle size={18} />
        <span>{error}</span>
      </div>
    )}

    {success && (
      <div className="alert alert-success">
        <CheckCircle size={18} />
        <span>{success}</span>
      </div>
    )}

    {/* Toggle para activar/desactivar Mora */}
    <div className="info-card" style={{marginBottom: '1.5rem'}}>
      <div className="info-item" style={{flex: 1}}>
        <span className="info-label">Aplicar Mora por Pago Tardío</span>
        <button
          className={`toggle-button ${aplicarMora ? 'active' : ''}`}
          onClick={handleToggleAplicarMora}
          type="button"
          style={{marginTop: '0.5rem'}}
          disabled={loading}
        >
          {aplicarMora ? (
            <>
              <ToggleRight size={20} />
              <span>Activado</span>
            </>
          ) : (
            <>
              <ToggleLeft size={20} />
              <span>Desactivado</span>
            </>
          )}
        </button>
        {/* Mostrar configuración activa actual */}
        {aplicarMora && moraActiva && (
          <div style={{marginTop: '0.75rem', fontSize: '0.875rem', color: '#666', lineHeight: '1.6'}}>
            <strong>Configuración actual:</strong> {moraActiva.nombre}
            <br />
            <span style={{color: '#999'}}>
              Tipo: {moraService.formatTipoCalculo(moraActiva.tipo_calculo)} | 
              Valor: {moraService.formatValorMora(moraActiva)} | 
              Días de gracia: {moraActiva.dias_gracia}
            </span>
          </div>
        )}
        {!aplicarMora && (
          <div style={{marginTop: '0.5rem', fontSize: '0.875rem', color: '#999'}}>
            Todas las configuraciones de mora están desactivadas
          </div>
        )}
      </div>
    </div>

    {/* CONTENIDO DINÁMICO: Solo se muestra si aplicarMora está activado */}
    {aplicarMora ? (
      <>
        {/* Información */}
        <div className="info-card">
          <div className="info-item">
            <span className="info-label">Total de Configuraciones</span>
            <span className="info-value">{moras.length}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Configuraciones Activas</span>
            <span className="info-value">
              {moras.filter(m => m.activo).length}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Vigentes</span>
            <span className="info-value">
              {moras.filter(m => m.es_vigente).length}
            </span>
          </div>
        </div>

        {/* Lista de Configuraciones de Mora */}
        {loadingMoras ? (
          <div className="loading-container">
            <RefreshCw className="spinner" size={32} />
            <p>Cargando configuraciones de mora...</p>
          </div>
        ) : moras.length === 0 ? (
          <div className="empty-state">
            <DollarSign size={48} />
            <p>No hay configuraciones de mora</p>
            {permissions.canCreate && (
              <button 
                className="btn-primary"
                onClick={() => openMoraModal()}
              >
                Crear Primera Configuración
              </button>
            )}
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Tipo Cálculo</th>
                  <th>Valor/Tasa</th>
                  <th>Días Gracia</th>
                  <th>Meses Gracia</th>
                  <th>Aplicar Sobre</th>
                  <th>Vigencia</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {moras.map((mora) => (
                  <tr key={mora.id_configuracion_mora}>
                    <td>
                      <strong>{mora.nombre}</strong>
                      {mora.descripcion && (
                        <><br /><small style={{color: '#666'}}>{mora.descripcion}</small></>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-info">
                        {moraService.formatTipoCalculo(mora.tipo_calculo)}
                      </span>
                    </td>
                    <td className="text-center">
                      <strong style={{color: '#1e40af', fontSize: '0.95rem'}}>
                        {mora.tipo_calculo === 'porcentaje' && mora.porcentaje_mora && (
                          `${parseFloat(mora.porcentaje_mora).toFixed(2)}%`
                        )}
                        {mora.tipo_calculo === 'fijo' && mora.valor_fijo && (
                          `$${parseFloat(mora.valor_fijo).toFixed(2)}`
                        )}
                        {mora.tipo_calculo === 'interes_diario' && mora.interes_diario && (
                          `${parseFloat(mora.interes_diario).toFixed(4)}%`
                        )}
                      </strong>
                      {mora.mora_maxima && (
                        <><br /><small style={{color: '#999'}}>Máx: ${parseFloat(mora.mora_maxima).toFixed(2)}</small></>
                      )}
                    </td>
                    <td className="text-center">
                      <span className="badge badge-warning">
                        {mora.dias_gracia} {mora.dias_gracia === 1 ? 'día' : 'días'}
                      </span>
                    </td>

                                        <td>
  {mora.tipo_periodo === 'meses' ? (
    <span className="badge badge-info">
      {mora.meses_gracia || 0} {mora.meses_gracia === 1 ? 'mes' : 'meses'}
    </span>
  ) : (
    <span className="badge badge-secondary">
      {mora.dias_gracia || 0} {mora.dias_gracia === 1 ? 'día' : 'días'}
    </span>
  )}
</td>

                    <td>
                      {mora.aplicar_sobre === 'total' && (
                        <span className="badge badge-success">Total Factura</span>
                      )}
                      {mora.aplicar_sobre === 'consumo' && (
                        <span className="badge badge-info">Solo Consumo</span>
                      )}
                      {mora.aplicar_sobre === 'base' && (
                        <span className="badge badge-secondary">Base</span>
                      )}
                    </td>
                    <td>
                      <small>
                        <strong>Desde:</strong> {new Date(mora.vigencia_desde).toLocaleDateString('es-EC')}
                        {mora.vigencia_hasta && (
                          <><br /><strong>Hasta:</strong> {new Date(mora.vigencia_hasta).toLocaleDateString('es-EC')}</>
                        )}
                        {!mora.vigencia_hasta && (
                          <><br /><span style={{color: '#10b981'}}>Sin límite</span></>
                        )}
                      </small>
                    </td>


                    <td>
                      {mora.activo && mora.aplicar_mora ? (
                        <span className="badge badge-success flex items-center gap-1">
                          <CheckCircle className="w-4 h-4" />
                          Activa
                        </span>
                      ) : (
                        <span className="badge badge-inactive flex items-center gap-1">
                          <XCircle className="w-4 h-4" />
                          Inactiva
                        </span>
                      )}
                      {!mora.es_vigente && (
                        <><br /><span className="badge badge-warning">No Vigente</span></>
                      )}
                    </td>
                    <td>
                      <div className="action-buttons">
                        {!mora.activo && permissions.canUpdate && (
                          <button
                            className="btn-icon btn-success"
                            onClick={() => handleActivarMora(mora.id_configuracion_mora, mora.nombre)}
                            title="Activar Configuración"
                          >
                            <CheckCircle size={16} />
                          </button>
                        )}
                        {mora.activo && permissions.canUpdate && (
                          <button
                            className="btn-icon btn-warning"
                            onClick={() => handleDesactivarMora(mora.id_configuracion_mora, mora.nombre)}
                            title="Desactivar Configuración"
                          >
                            <XCircle size={16} />
                          </button>
                        )}
                        {permissions.canUpdate && (
                          <button
                            className="btn-icon btn-primary"
                            onClick={() => openMoraModal(mora)}
                            title="Editar"
                          >
                            <Edit size={16} />
                          </button>
                        )}
                        {permissions.canDelete && (
                          <button
                            className="btn-icon btn-danger"
                            onClick={() => handleDeleteMora(
                              mora.id_configuracion_mora,
                              mora.nombre,
                              mora.activo
                            )}
                            title="Eliminar"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Información adicional */}
        <div className="alert alert-info">
          <AlertCircle size={18} />
          <div>
            <strong>Información importante:</strong>
            <ul style={{marginTop: '0.5rem', paddingLeft: '1.25rem'}}>
              <li>Solo puede haber <strong>una configuración de mora activa</strong> a la vez.</li>
              <li>La mora se aplicará automáticamente a facturas vencidas según los días de gracia.</li>
              <li>Los <strong>días de gracia</strong> son el período después del vencimiento sin aplicar mora.</li>
              <li>Puedes establecer un <strong>límite máximo</strong> para el monto de mora calculado.</li>
              <li>Al activar una configuración, todas las demás se desactivan automáticamente.</li>
            </ul>
          </div>
        </div>
      </>
    ) : (
      // ESTADO DESACTIVADO: Mostrar mensaje cuando toggle está off
      <div className="empty-state">
        <ToggleLeft size={48} style={{color: '#94a3b8'}} />
        <p style={{fontSize: '1.125rem', fontWeight: '500', color: '#64748b'}}>
          La aplicación de mora está desactivada
        </p>
        <p style={{fontSize: '0.875rem', color: '#94a3b8', marginTop: '0.5rem'}}>
          Activa el interruptor de arriba para gestionar y configurar las moras del sistema.
        </p>
        {permissions.canUpdate && (
          <button 
            className="btn-primary"
            onClick={handleToggleAplicarMora}
            style={{marginTop: '1rem'}}
          >
            <ToggleRight className="w-4 h-4 mr-2" />
            Activar Mora
          </button>
        )}
      </div>
    )}

    {/* MODAL DE CREACIÓN / EDICIÓN DE MORA */}
    {showMoraModal && (
      <div className="modal-overlay" onClick={closeMoraModal}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>{editingMora ? 'Editar' : 'Nueva'} Configuración de Mora</h3>
            <button type="button" className="btn-close" onClick={closeMoraModal}>×</button>
          </div>
          
          <form onSubmit={handleSaveMora} className="limite-form">
            <div className="modal-body">
              {/* Nombre */}
              <div className="form-group">
                <label>Nombre de la Configuración *</label>
                <input
                  type="text"
                  className="form-input"
                  value={moraFormData.nombre}
                  onChange={(e) => setMoraFormData({ ...moraFormData, nombre: e.target.value })}
                  placeholder="Ej: Mora Estándar 3.75%, Mora Residencial"
                  required
                  maxLength={100}
                />
                <small className="form-help">Nombre descriptivo para identificar esta configuración</small>
              </div>

              {/* Descripción */}
              <div className="form-group">
                <label>Descripción</label>
                <textarea
                  className="form-input"
                  value={moraFormData.descripcion}
                  onChange={(e) => setMoraFormData({ ...moraFormData, descripcion: e.target.value })}
                  placeholder="Descripción detallada de cuándo y cómo se aplica esta mora"
                  rows={3}
                  maxLength={500}
                />
              </div>

{/* ✅ SELECTOR DE TIPO DE PERIODO */}
<div className="form-group">
  <label className="form-label">
    <Clock size={16} />
    Tipo de Periodo de Gracia *
  </label>
  <div className="radio-group">
    <label className="radio-option">
      <input
        type="radio"
        name="tipo_periodo"
        value="dias"
        checked={moraFormData.tipo_periodo === 'dias'}
        onChange={(e) => setMoraFormData({ 
          ...moraFormData, 
          tipo_periodo: e.target.value,
          // Limpiar el campo no usado
          meses_gracia: 0
        })}
      />
      <span>Por Días</span>
    </label>
    <label className="radio-option">
      <input
        type="radio"
        name="tipo_periodo"
        value="meses"
        checked={moraFormData.tipo_periodo === 'meses'}
        onChange={(e) => setMoraFormData({ 
          ...moraFormData, 
          tipo_periodo: e.target.value,
          // Limpiar el campo no usado
          dias_gracia: 0
        })}
      />
      <span>Por Meses (Cambio de mes)</span>
    </label>
  </div>
  <small className="form-help">
    {moraFormData.tipo_periodo === 'dias' 
      ? 'La mora se calculará después de X días de vencida la factura'
      : 'La mora se aplicará cuando la factura vencida pase al siguiente mes calendario'}
  </small>
</div>

{/* ✅ CAMPO CONDICIONAL: DÍAS O MESES */}
{moraFormData.tipo_periodo === 'dias' ? (
  <div className="form-group">
    <label className="form-label">
      <Calendar size={16} />
      Días de Gracia
    </label>
    <input
      type="number"
      className="form-input"
      value={moraFormData.dias_gracia}
      onChange={(e) => setMoraFormData({ 
        ...moraFormData, 
        dias_gracia: parseInt(e.target.value) || 0 
      })}
      min="0"
      placeholder="0"
    />
    <small className="form-help">
      Días de tolerancia antes de aplicar mora (0 = aplica desde el día siguiente del vencimiento)
    </small>
  </div>
) : (
  <div className="form-group">
    <label className="form-label">
      <Calendar size={16} />
      Meses de Gracia
    </label>
    <input
      type="number"
      className="form-input"
      value={moraFormData.meses_gracia}
      onChange={(e) => setMoraFormData({ 
        ...moraFormData, 
        meses_gracia: parseInt(e.target.value) || 0 
      })}
      min="0"
      max="12"
      placeholder="0"
    />
    <small className="form-help">
      Meses de tolerancia. Ejemplo: si vence el 15/Enero y meses_gracia=0, la mora aplica el 1/Febrero. Si meses_gracia=1, aplica el 1/Marzo.
    </small>
  </div>
)}

              {/* Tipo de Cálculo */}
              <div className="form-group">
                <label>Tipo de Cálculo *</label>
                <select
                  className="form-input"
                  value={moraFormData.tipo_calculo}
                  onChange={(e) => setMoraFormData({ 
                    ...moraFormData, 
                    tipo_calculo: e.target.value,
                    // Limpiar valores previos
                    porcentaje_mora: '',
                    valor_fijo: '',
                    interes_diario: ''
                  })}
                  required
                >
                  <option value="porcentaje">Porcentaje del Monto</option>
                  <option value="fijo">Valor Fijo</option>
                  <option value="interes_diario">Interés Diario Acumulado</option>
                </select>
                <small className="form-help">
                  {moraFormData.tipo_calculo === 'porcentaje' && '📊 Se aplicará un porcentaje sobre el monto de la factura'}
                  {moraFormData.tipo_calculo === 'fijo' && '💵 Se aplicará un valor fijo sin importar el monto'}
                  {moraFormData.tipo_calculo === 'interes_diario' && '📈 El interés se acumula día a día: Deuda × (días/365) × tasa'}
                </small>
              </div>

              {/* Valores según tipo de cálculo - En fila */}
              <div className="form-row" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                {/* Valor según tipo */}
                {moraFormData.tipo_calculo === 'porcentaje' && (
                  <div className="form-group">
                    <label>Porcentaje de Mora (%) *</label>
                    <input
                      type="number"
                      className="form-input"
                      value={moraFormData.porcentaje_mora}
                      onChange={(e) => setMoraFormData({ ...moraFormData, porcentaje_mora: e.target.value })}
                      placeholder="3.75"
                      step="0.01"
                      min="0.01"
                      max="100"
                      required
                    />
                    <small className="form-help">Ej: 3.75 para aplicar 3.75% sobre el monto</small>
                  </div>
                )}

                {moraFormData.tipo_calculo === 'fijo' && (
                  <div className="form-group">
                    <label>Valor Fijo ($) *</label>
                    <input
                      type="number"
                      className="form-input"
                      value={moraFormData.valor_fijo}
                      onChange={(e) => setMoraFormData({ ...moraFormData, valor_fijo: e.target.value })}
                      placeholder="5.00"
                      step="0.01"
                      min="0.01"
                      required
                    />
                    <small className="form-help">Monto fijo que se aplicará como mora</small>
                  </div>
                )}

                {moraFormData.tipo_calculo === 'interes_diario' && (
                  <div className="form-group">
                    <label>Tasa de Interés Diario (%) *</label>
                    <input
                      type="number"
                      className="form-input"
                      value={moraFormData.interes_diario}
                      onChange={(e) => setMoraFormData({ ...moraFormData, interes_diario: e.target.value })}
                      placeholder="0.1027"
                      step="0.0001"
                      min="0.0001"
                      required
                    />
                    <small className="form-help">Tasa anualizada dividida entre 365</small>
                  </div>
                )}

                {/* Días de Gracia */}
                <div className="form-group">
                  <label>Días de Gracia *</label>
                  <input
                    type="number"
                    className="form-input"
                    value={moraFormData.dias_gracia}
                    onChange={(e) => setMoraFormData({ ...moraFormData, dias_gracia: e.target.value })}
                    placeholder="0"
                    min="0"
                    max="365"
                    required
                  />
                  <small className="form-help">Días después del vencimiento sin aplicar mora</small>
                </div>
              </div>

              {/* Vigencia */}
              <div className="form-row" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                <div className="form-group">
                  <label>Vigencia Desde *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={moraFormData.vigencia_desde}
                    onChange={(e) => setMoraFormData({ ...moraFormData, vigencia_desde: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Vigencia Hasta</label>
                  <input
                    type="date"
                    className="form-input"
                    value={moraFormData.vigencia_hasta}
                    onChange={(e) => setMoraFormData({ ...moraFormData, vigencia_hasta: e.target.value })}
                    min={moraFormData.vigencia_desde}
                  />
                  <small className="form-help">Dejar vacío para vigencia indefinida</small>
                </div>
              </div>

              {/* Configuración adicional */}
              <div className="form-row" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                <div className="form-group">
                  <label>Aplicar Mora Sobre *</label>
                  <select
                    className="form-input"
                    value={moraFormData.aplicar_sobre}
                    onChange={(e) => setMoraFormData({ ...moraFormData, aplicar_sobre: e.target.value })}
                    required
                  >
                    <option value="total">Total de la Factura</option>
                    <option value="consumo">Solo Consumo de Agua</option>
                    <option value="base">Tarifa Base</option>
                  </select>
                  <small className="form-help">Sobre qué monto se calcula la mora</small>
                </div>

                <div className="form-group">
                  <label>Mora Máxima ($)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={moraFormData.mora_maxima}
                    onChange={(e) => setMoraFormData({ ...moraFormData, mora_maxima: e.target.value })}
                    placeholder="Sin límite"
                    step="0.01"
                    min="0"
                  />
                  <small className="form-help">Límite máximo del monto de mora (opcional)</small>
                </div>
              </div>

              {/* Checkbox es_vigente */}
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={moraFormData.es_vigente}
                    onChange={(e) => setMoraFormData({ ...moraFormData, es_vigente: e.target.checked })}
                  />
                  <span>Marcar como vigente</span>
                </label>
                <small className="form-help">
                  Una configuración vigente puede ser activada. Las no vigentes son históricas.
                </small>
              </div>

              {!editingMora && (
                <div className="alert alert-info" style={{fontSize: '0.875rem'}}>
                  <AlertCircle size={16} />
                  <div>
                    <strong>Nota:</strong> La configuración se creará <strong>desactivada</strong> por defecto. 
                    Podrás activarla después de crearla para que empiece a aplicarse a las facturas vencidas.
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button 
                type="button"
                className="btn-secondary" 
                onClick={closeMoraModal}
                disabled={loading}
              >
                Cancelar
              </button>
              <button 
                type="submit"
                className="btn-primary" 
                disabled={loading}
              >
                {loading ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}
  </div>
)}

            </>
          ) : (
            <div className="empty-state">
              <Settings className="w-16 h-16 text-gray-300 mx-auto mb-2" />
              <h3>Selecciona una Sección</h3>
              <p>Selecciona una sección de configuración de la lista para ver su contenido.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConfigSection;