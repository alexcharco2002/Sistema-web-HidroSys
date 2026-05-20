// src/sections/users/UsersSection.js
// MODULO DE USUARIOS de sistema - Con control de permisos 
import React, { useState, useEffect, useCallback, useRef } from 'react';

import './UserSection.css';
import usersService from '../../services/userServices'; // 🔑 Importar usersService
import authService from '../../services/authServices'; // 🔑 Importar authService
import * as   XLSX from "xlsx"; // Librería para leer Excel

import { 
  Users, Plus, Search, Edit, Trash2, Eye, UserCheck, UserX,
  Mail, Phone, MapPin, Calendar, X, Save, RefreshCw, Key,
  Image as ImageIcon, AlertCircle, ArrowUpDown, IdCard, CheckCircle, XCircle,
  UserCog, Wallet, BookOpen, User, FileSpreadsheet, Download, Unlock,
  ChevronLeft, ChevronRight
  
} from 'lucide-react';

const EXCEL_PREVIEW_PAGE_SIZE = 50;

const toIsoDate = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeExcelDate = (value) => {
  if (value === null || value === undefined || value === '') return '';

  if (value instanceof Date) {
    return toIsoDate(value);
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    excelEpoch.setUTCDate(excelEpoch.getUTCDate() + Math.floor(value));
    return toIsoDate(new Date(excelEpoch.getUTCFullYear(), excelEpoch.getUTCMonth(), excelEpoch.getUTCDate()));
  }

  const text = String(value).trim();
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const slashMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s.*)?$/);
  if (slashMatch) {
    return `${slashMatch[3]}-${slashMatch[2].padStart(2, '0')}-${slashMatch[1].padStart(2, '0')}`;
  }

  return text;
};

const normalizeDigits = (value, padToLength = 10) => {
  if (value === null || value === undefined || value === '') return '';
  let text = String(value).trim();
  if (/^\d+\.0+$/.test(text)) text = text.split('.')[0];
  const digits = text.replace(/\D/g, '');
  if (digits.length > 0 && digits.length < padToLength) {
    return digits.padStart(padToLength, '0');
  }
  return digits;
};

const normalizeExcelUserRow = (row, index) => ({
  __fila: index + 2,
  nombres: String(row.nombres || '').trim(),
  apellidos: String(row.apellidos || '').trim(),
  sexo: String(row.sexo || 'O').trim().toUpperCase(),
  fecha_nac: normalizeExcelDate(row.fecha_nac),
  cedula: normalizeDigits(row.cedula),
  email: String(row.email || '').trim().toLowerCase(),
  telefono: normalizeDigits(row.telefono),
  direccion: String(row.direccion || 'Sanjapamba').trim()
});

const getExcelUserIssues = (user) => {
  const issues = [];

  if (!user.nombres) issues.push('Falta nombres');
  if (!user.apellidos) issues.push('Falta apellidos');
  if (!['M', 'F', 'O'].includes(user.sexo)) issues.push('Sexo debe ser M, F u O');

  if (!user.fecha_nac) {
    issues.push('Falta fecha_nac');
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(user.fecha_nac)) {
    issues.push('fecha_nac debe estar en formato YYYY-MM-DD, sin hora');
  }

  if (!user.cedula) {
    issues.push('Falta cedula');
  } else if (!/^\d{10}$/.test(user.cedula)) {
    issues.push('cedula debe tener exactamente 10 digitos');
  }

  if (!user.email) {
    issues.push('Falta email');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) {
    issues.push('email no tiene un formato valido');
  }

  if (user.telefono && !/^\d{10}$/.test(user.telefono)) {
    issues.push('telefono debe tener exactamente 10 digitos');
  }

  return issues;
};

const UsersSection = () => {
  const pageSizeOptions = [10, 20, 50];

  // ==================== ESTADOS ====================
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [showSearchAdvice, setShowSearchAdvice] = useState(true);
  const adviceTimerRef = useRef(null);
  const hasShownInitialAdviceRef = useRef(false);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('create');
  const [selectedUser, setSelectedUser] = useState(null);
  const [error, setError] = useState(null);

  // Cargar mi perfil para marcarlo en la lista
  const [miPerfil, setMiPerfil] = useState(null);
  
  // ===== Variables para carga desde Excel =====
  const [ selectedExcel,setSelectedExcel] = useState(null);   // archivo subido
  const [excelPreview, setExcelPreview] = useState([]);        // filas leídas
  const [, setLoadingExcel] = useState(false);     // loading
  const [excelPreviewPage, setExcelPreviewPage] = useState(1);
  // ==== Estados para carga de EXCEL ====
  const handleExcelPreview = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setLoadingExcel(true);
      setError(null);

      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true });
      const normalizedRows = rows.map(normalizeExcelUserRow);

      setExcelPreview(normalizedRows);
      setExcelPreviewPage(1);
      setSelectedExcel(file);
      setLoadingExcel(false);

    } catch (error) {
      console.error(error);
      setError("Error al leer el archivo Excel");
      setLoadingExcel(false);
    }
  };
  
  // función para enviar datos al servidor
  const handleExcelUpload = async () => {
    if (excelPreview.length === 0) {
      setError("⚠️ No hay datos cargados para enviar.");
      return;
    }

    // Filtrar solo usuarios válidos
    const usuariosValidos = excelPreview.filter(
      u => getExcelUserIssues(u).length === 0
    );

    if (usuariosValidos.length === 0) {
      setError(
        "❌ No hay usuarios válidos para importar.\n\n" +
        "📅 Verifica que las fechas estén en formato YYYY-MM-DD.\n" +
        "🆔 La cédula debe tener exactamente 10 dígitos.\n" +
        "📞 El teléfono debe tener exactamente 10 dígitos."
      );
      return;
    }

    if (usuariosValidos.length > 500) {
      setError("⚠️ Máximo permitido: 500 usuarios válidos por carga masiva.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Enviar solo usuarios válidos
      const result = await usersService.createManyUsers(usuariosValidos);

      if (result.success) {
        const { exitosos, fallidos, total_procesados } = result.data;
        const omitidos = excelPreview.length - usuariosValidos.length;

        const totalLeidos = excelPreview.length;
        const totalFallidos = fallidos.length + omitidos;
        const estadoCarga = totalFallidos === 0
          ? '✅ Carga completada correctamente'
          : exitosos.length > 0
            ? '⚠️ Carga completada con observaciones'
            : '❌ No se pudo importar ningún usuario';

        const mensajePartes = [
          '📊 RESULTADO DE LA CARGA MASIVA',
          '────────────────────────────────',
          estadoCarga,
          '',
          '📌 Resumen',
          `• Filas leídas del Excel: ${totalLeidos}`,
          `• Filas válidas enviadas al servidor: ${total_procesados}`,
          `• Usuarios creados: ${exitosos.length}`,
          `• Errores del servidor: ${fallidos.length}`,
          `• Filas omitidas por validación previa: ${omitidos}`,
          ''
        ];

        if (omitidos > 0) {
          mensajePartes.push(
            'ℹ️ Las filas omitidas no se enviaron porque tenían datos incompletos o inválidos en la vista previa.',
            ''
          );
        }

        if (exitosos.length > 0) {
          mensajePartes.push('🔐 Credenciales generadas', '');

          exitosos.slice(0, 10).forEach((u, idx) => {
            mensajePartes.push(
              `${idx + 1}. 👤 ${u.nombre || 'Usuario creado'}`,
              `   🧑 Usuario: ${u.usuario || u.cedula || 'No disponible'}`,
              `   🔑 Contraseña: ${u['contraseña'] || u.contrasena || u.cedula || 'No disponible'}`,
              `   📧 Email: ${u.email || 'No registrado'}`,
              `   🆔 Cédula: ${u.cedula || 'No registrada'}`,
              ''
            );
          });

          if (exitosos.length > 10) {
            mensajePartes.push(`➕ Se crearon ${exitosos.length - 10} usuarios adicionales.`, '');
          }
        }

        if (fallidos.length > 0) {
          mensajePartes.push('🚨 Errores que debe corregir', '');

          fallidos.slice(0, 8).forEach((f, idx) => {
            mensajePartes.push(
              `${idx + 1}. ❌ Fila ${f.fila || 'sin número'}: ${f.nombre || 'Sin nombre'}`,
              `   ⚠️ Problema: ${usersService.formatUserImportError(f.error)}`,
              f.email ? `   📧 Email: ${f.email}` : null,
              f.cedula ? `   🆔 Cédula: ${f.cedula}` : null,
              ''
            );
          });

          if (fallidos.length > 8) {
            mensajePartes.push(`➕ Hay ${fallidos.length - 8} errores adicionales. Revise el Excel y vuelva a cargarlo.`);
          }
        }

        alert(mensajePartes.filter(Boolean).join('\n'));

        // Recargar usuarios y cerrar modal
        await fetchUsers();
        closeModal();
        setExcelPreview([]);
        setSelectedExcel(null);

      } else {
        setError(
          result.message ||
          "❌ Ocurrió un error al procesar los usuarios."
        );
      }

    } catch (error) {
      console.error("Error en carga masiva:", error);

      setError(
        error.message ||
        "🚨 Error al enviar los usuarios al servidor."
      );

    } finally {
      setLoading(false);
    }
  };

  // 🔽 Estados de ordenamiento mejorados
  const [sortOption, setSortOption] = useState('rol');
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' o 'desc'
  
  // 🔽 Estado de filtro de estado (activo/inactivo)
  const [statusFilter, setStatusFilter] = useState('all');
  
  const [formData, setFormData] = useState({
    nombres: '',
    apellidos: '',
    sexo: '',
    fecha_nac: '',
    cedula: '',
    email: '',
    telefono: '',
    direccion: '',
    id_rol: null,
    activo: true
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [selectedFile, setSelectedFile] = useState(null);

  const showLargeListAdvice = useCallback(() => {
    if (users.length <= 100) return;

    if (adviceTimerRef.current) {
      clearTimeout(adviceTimerRef.current);
    }

    setShowSearchAdvice(true);
    adviceTimerRef.current = setTimeout(() => {
      setShowSearchAdvice(false);
    }, 12000);
  }, [users.length]);

  // 🔑 PERMISOS DEL USUARIO ACTUAL
  const [permissions, setPermissions] = useState({
    canCreate: false,
    canRead: false,
    canUpdate: false,
    canDelete: false,
    canChangePassword: false,
    canChangePhoto: false,
    canToggleStatus: false
  });

  // ==================== EFECTOS ====================
  
  // 🔑 Cargar permisos y roles al montar el componente
  useEffect(() => {
    loadUserPermissions();
    loadRoles();
  }, []);

  // ==================== FUNCIONES DE PERMISOS ====================
  
  /**
   * 🔑 Carga los permisos del usuario actual para el módulo de usuarios
   */
  const loadUserPermissions = () => {
    // Verificar permisos sobre el módulo 'usuarios'
    const canCreate = authService.hasPermission('usuarios', 'crear') || 
                     authService.hasPermission('usuarios', 'operaciones crud');
    
    const canUpdate = authService.hasPermission('usuarios', 'actualizar') || 
                     authService.hasPermission('usuarios', 'operaciones crud');
    
    const canDelete = authService.hasPermission('usuarios', 'eliminar') || 
                     authService.hasPermission('usuarios', 'operaciones crud');
    
    // ✅ Si puede crear, actualizar o eliminar, también debe poder leer
    const canRead = authService.hasPermission('usuarios', 'lectura') ||
               canCreate || canUpdate || canDelete ||
               authService.hasPermission('usuarios', 'operaciones crud');
    
    // Permisos adicionales 
    const canChangePassword = canUpdate; // Cambiar contraseña requiere actualizar
    const canChangePhoto = canUpdate; // Cambiar foto requiere actualizar
    const canToggleStatus = canUpdate; // Cambiar estado requiere actualizar

  

    setPermissions({
      canCreate,
      canRead,
      canUpdate,
      canDelete,
      canChangePassword,
      canChangePhoto,
      canToggleStatus
    });

    console.log('🔐 Permisos del usuario en módulo Usuarios:', {
      canCreate,
      canRead,
      canUpdate,
      canDelete
    });
  };

  // ==================== FUNCIONES DE CARGA DE DATOS ====================
  
  /**
   * 📋 Carga la lista de roles disponibles desde el servidor
   */
  const loadRoles = async () => {
    try {
      const result = await usersService.getRoles();
      if (result.success) {
        setRoles(result.data);
        console.log('✅ Roles cargados:', result.data);
      } else {
        console.error('Error cargando roles:', result.message);
      }
    } catch (error) {
      console.error('Error al cargar roles:', error);
    }
  };

  /**
   * Obtiene la lista de usuarios del servidor con filtros aplicados
   */

  const fetchUsers = useCallback(async () => {
    if (!permissions.canRead) {
      setError('No tienes permiso para ver usuarios');
      setLoading(false);
      return;
    }
  
    setLoading(true);
    setError(null);
  
    try {
      const pageLimit = 100;
      let skip = 0;
      let allUsers = [];
      let usersResult = { success: true, data: [] };

      do {
        usersResult = await usersService.getUsers({
          skip,
          limit: pageLimit
        });

        if (!usersResult.success) break;

        const pageData = Array.isArray(usersResult.data) ? usersResult.data : [];
        allUsers = [...allUsers, ...pageData];
        skip += pageLimit;

        if (pageData.length < pageLimit) break;
      } while (skip < 10000);

      const [result, miPerfilResult] = await Promise.all([
        Promise.resolve({ ...usersResult, data: allUsers }),
        usersService.getMiPerfil(),   
      ]);
  
      if (result.success) {
        setUsers(result.data);
      } else {
        setError(result.message);
      }
  
      if (miPerfilResult.success) {
        setMiPerfil(miPerfilResult.data);
      }
  
    } catch (err) {
      setError('Error al cargar usuarios desde el servidor');
    } finally {
      setLoading(false);
    }
  }, [permissions.canRead]);
  

  // 🔄 Cargar usuarios cuando cambian los filtros
  useEffect(() => {
    if (permissions.canRead) {
      fetchUsers();
    }
  }, [permissions.canRead, fetchUsers]);

  // ==================== FUNCIONES DE FILTRADO Y ORDENAMIENTO ====================
  
  /**
   * 🔍 Filtra usuarios según los criterios de búsqueda, rol y estado
   */
  const isUserBlocked = (user) => {
    if (!user) return false;

    if (user.bloqueado_permanente) {
      return true;
    }

    if (user.bloqueado_hasta) {
      const ahora = new Date();
      const bloqueadoHasta = new Date(user.bloqueado_hasta);
      return bloqueadoHasta > ahora;
    }

    return false;
  };

  const blockedUsersCount = users.filter(isUserBlocked).length;

  const filteredUsers = users.filter(user => {
    const searchValue = searchTerm.trim().toLowerCase();
    // Filtro por búsqueda de texto
    const matchesSearch =
      searchValue === '' ||
      `${user.nombres || ''} ${user.apellidos || ''}`.toLowerCase().includes(searchValue) ||
      (user.usuario || '').toLowerCase().includes(searchValue) ||
      (user.cedula || '').includes(searchTerm.trim())

    // Filtro por rol
    const matchesRole =
      filterRole === 'all' || user.id_rol === parseInt(filterRole);

    // Filtro por estado (activo/inactivo)
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && user.activo) ||
      (statusFilter === 'inactive' && !user.activo) ||
      (statusFilter === 'blocked' && isUserBlocked(user));

    return matchesSearch && matchesRole && matchesStatus;
  });

  /**
   * 🔀 Ordena los usuarios filtrados según el criterio y orden seleccionados
   */
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    let comparison = 0;
    
    if (sortOption === 'nombre') {
      // Ordenar por nombre completo
      const nombreA = `${a.nombres} ${a.apellidos}`.toLowerCase();
      const nombreB = `${b.nombres} ${b.apellidos}`.toLowerCase();
      comparison = nombreA.localeCompare(nombreB);
    } 
    else if (sortOption === 'fecha') {
      // Ordenar por fecha de registro
      const fechaA = new Date(a.fecha_registro || a.fecha_creacion);
      const fechaB = new Date(b.fecha_registro || b.fecha_creacion);
      comparison = fechaA - fechaB;
    } 
    else if (sortOption === 'rol') {
      // Ordenar por id_rol (1=Admin, 2=Cajero, etc.)
      comparison = a.id_rol - b.id_rol;
    }
    
    // Aplicar orden ascendente o descendente
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const totalPages = Math.max(1, Math.ceil(sortedUsers.length / pageSize));
  const normalizedCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (normalizedCurrentPage - 1) * pageSize;
  const pageEndIndex = pageStartIndex + pageSize;

  /**
   * 🔄 Cambia el orden de clasificación (ascendente/descendente)
   */
  const toggleSortOrder = () => {
    setSortOrder(prevOrder => prevOrder === 'asc' ? 'desc' : 'asc');
  };

  /**
   * 🎯 Cambia el filtro de estado y aplica el filtro
   * @param {string} status - 'all', 'active' o 'inactive'
   */
  const handleStatusFilterClick = (status) => {
    setStatusFilter(status);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterRole, statusFilter, sortOption, sortOrder, pageSize]);

  useEffect(() => {
    if (users.length <= 100) {
      setShowSearchAdvice(false);
      return;
    }

    if (!hasShownInitialAdviceRef.current) {
      hasShownInitialAdviceRef.current = true;
      showLargeListAdvice();
    }
  }, [users.length, showLargeListAdvice]);

  useEffect(() => () => {
    if (adviceTimerRef.current) {
      clearTimeout(adviceTimerRef.current);
    }
  }, []);

  // ==================== FUNCIONES DE MODAL ====================
  
  /**
   * 📝 Abre el modal según el tipo de operación
   * @param {string} type - 'create', 'edit', 'view', 'password', 'photo'
   * @param {object} user - Usuario seleccionado (opcional)
   */
  const openModal = (type, user = null) => {
    // 🔑 Verificar permisos antes de abrir modal
    if (type === 'create' && !permissions.canCreate) {
      alert('❌ No tienes permiso para crear usuarios');
      return;
    }
    if (type === 'edit' && !permissions.canUpdate) {
      alert('❌ No tienes permiso para editar usuarios');
      return;
    }
    if (type === 'password' && !permissions.canChangePassword) {
      alert('❌ No tienes permiso para cambiar contraseñas');
      return;
    }
    if (type === 'photo' && !permissions.canChangePhoto) {
      alert('❌ No tienes permiso para cambiar fotos de perfil');
      return;
    }

    setModalType(type);
    setSelectedUser(user);
    setError(null);
    
    if (type === 'create') {
      // Resetear formulario para crear nuevo usuario
      setFormData({
        nombres: '',
        apellidos: '',
        sexo: '',
        fecha_nac: '',
        cedula: '',
        email: '',
        telefono: '',
        direccion: '',
        id_rol: roles.length > 0 ? roles[0].id_rol : null,
        activo: true
      });
    } else if (type === 'edit' && user) {
      // Cargar datos del usuario a editar
      setFormData({
        nombres: user.nombres,
        apellidos: user.apellidos,
        sexo: user.sexo || '',
        fecha_nac: user.fecha_nac || '',
        cedula: user.cedula,
        email: user.email,
        telefono: user.telefono || '',
        direccion: user.direccion || '',
        id_rol: user.id_rol,
        activo: user.activo
      });
    } else if (type === 'password' && user) {
      // Resetear formulario de cambio de contraseña
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } else if (type === 'photo' && user) {
      // Resetear selección de archivo
      setSelectedFile(null);
    }
    
    setShowModal(true);
  };

  /**
   * ❌ Cierra el modal y limpia los estados
   */
  const closeModal = () => {
    setShowModal(false);
    setSelectedUser(null);
    setError(null);
    setSelectedFile(null);
    // 🔥 Limpiar estados del Excel
    setSelectedExcel(null);
    setExcelPreview([]);
    setExcelPreviewPage(1);
  };

  // ==================== FUNCIONES DE CRUD ====================
  
  /**
   * 💾 Maneja el envío del formulario de crear/editar usuario
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      let result;

      if (modalType === "create") {
        // 🔑 Verificar permiso para crear
        if (!permissions.canCreate) {
          setError('No tienes permiso para crear usuarios');
          return;
        }

        result = await usersService.createUser(formData);

        if (result.success) {
          const passwordGenerada = result.data?.contraseña_generada;
          const nombreUsuario = result.data?.usuario;

          await fetchUsers();
          closeModal();

          alert(
            `✅ Usuario creado exitosamente.\n\n` +
            `👤 Usuario: ${nombreUsuario}\n` +
            (passwordGenerada ? `🔑 Contraseña generada: ${passwordGenerada}` : "")
          );
        } else {
          setError(result.message || "Error al crear el usuario");
        }

      } else if (modalType === "edit") {
        // 🔑 Verificar permiso para editar
        if (!permissions.canUpdate) {
          setError('No tienes permiso para editar usuarios');
          return;
        }

        result = await usersService.updateUser(selectedUser.id, formData);
        
        if (result.success) {
          alert("✅ Cambios guardados correctamente");
          await fetchUsers();
          closeModal();
        } else {
          setError(result.message || "Error al actualizar usuario");
        }
      }

    } catch (error) {
      console.error("Error al guardar usuario:", error);
      setError(error.message || "Error al guardar usuario");
    }
  };

  /**
   * 🔐 Maneja el cambio de contraseña de un usuario
   */
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError(null);

    // 🔑 Verificar permiso
    if (!permissions.canChangePassword) {
      setError('No tienes permiso para cambiar contraseñas');
      return;
    }

    // Validar que las contraseñas coincidan
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    // Validar longitud mínima
    if (passwordData.newPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    try {
      const result = await usersService.changeUserPassword(selectedUser.id, {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });

      if (result.success) {
        alert(result.message);
        closeModal();
      } else {
        setError(result.message);
      }
    } catch (error) {
      setError(error.message || 'Error al cambiar contraseña');
    }
  };

  /**
   * 📸 Maneja la subida de foto de perfil
   */
  const handleUploadPhoto = async (e) => {
    e.preventDefault();
    setError(null);

    // 🔑 Verificar permiso
    if (!permissions.canChangePhoto) {
      setError('No tienes permiso para cambiar fotos de perfil');
      return;
    }

    if (!selectedFile) {
      setError('Debe seleccionar una imagen');
      return;
    }

    try {
      const result = await usersService.uploadUserPhoto(selectedUser.id, selectedFile);

      if (result.success) {
        alert(result.message);
        await fetchUsers();
        closeModal();
      } else {
        setError(result.message);
      }
    } catch (error) {
      setError(error.message || 'Error al subir foto');
    }
  };

  /**
 * 🗑️ Elimina un usuario del sistema
 */
 
  const handleDelete = async (userId) => {

    // 🔑 Verificar permisos
    if (!permissions.canDelete) {
      window.alert("❌ No tienes permiso para eliminar usuarios.");
      return;
    }

    // Confirmación nativa de Windows
    const confirmado = window.confirm("¿Estás seguro de que deseas eliminar este usuario?");

    if (!confirmado) return;

    try {
      const result = await usersService.deleteUser(userId);

      if (result.success) {
        window.alert("✔ Usuario eliminado correctamente.");
        await fetchUsers();
      } else {
        window.alert(`❌ Error: ${result.message}`);
      }

    } catch (error) {
      window.alert(`❌ Error al eliminar usuario: ${error.message}`);
    }
  };



  /**
   * 🔄 Activa o desactiva un usuario
   */
  const toggleUserStatus = async (userId) => {
    // 🔑 Verificar permiso antes de cambiar estado
    if (!permissions.canToggleStatus) {
      alert('❌ No tienes permiso para cambiar el estado de usuarios');
      return;
    }

    try {
      const result = await usersService.toggleUserStatus(userId);
      
      if (result.success) {
        await fetchUsers();
      } else {
        alert('Error: ' + result.message);
      }
    } catch (error) {
      alert('Error al cambiar estado del usuario');
    }
  };

  /**
 * 🔓 Desbloquear usuario
 */
const handleUnlockUser = async (userId, usuario) => {
  // 🔑 Verificar permiso
  if (!permissions.canUpdate) {
    alert('❌ No tienes permiso para desbloquear usuarios');
    return;
  }

  const confirmado = window.confirm(
    `¿Estás seguro de que deseas desbloquear al usuario '${usuario}'?\n\n` +
    `Esto reseteará:\n` +
    `- Intentos fallidos\n` +
    `- Bloqueo temporal\n` +
    `- Bloqueo permanente`
  );
  
  if (!confirmado) return;

  try {
    setLoading(true);
    const result = await usersService.unlockUser(userId);
    
    if (result.success) {
      alert(`✅ ${result.message}`);
      await fetchUsers(); // Recargar lista
    } else {
      alert(`❌ Error: ${result.message}`);
    }
  } catch (error) {
    alert(`❌ Error al desbloquear usuario: ${error.message}`);
  } finally {
    setLoading(false);
  }
};



  // ==================== FUNCIONES AUXILIARES ====================
  
  /**
   * 🏷️ Obtiene el nombre del rol de un usuario
   */
  const getRoleName = (user) => {
    if (user.rol && user.rol.nombre_rol) {
      return user.rol.nombre_rol;
    }
    return 'Sin rol';
  };

  // función para calcular edad a partir de fecha de nacimiento
  const calculateAge = (fechaNac) => {
    if (!fechaNac) return '';
    const birthDate = new Date(fechaNac);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  /**
   * 🎨 Genera el badge visual del rol con colores específicos
   */
  const roleIcons = {
    administrador: <UserCog className="w-4 h-4" />,
    cajero: <Wallet className="w-4 h-4" />,
    lector: <BookOpen className="w-4 h-4" />,
    cliente: <User className="w-4 h-4" />,
  };

  const getRoleBadge = (user) => {
    const roleName = getRoleName(user).toLowerCase();

    const colors = {
      administrador: 'blue',
      cajero: 'orange',
      lector: 'purple',
      cliente: 'gray',
    };

    const colorClass = colors[roleName]
      ? `role-${colors[roleName]}`
      : 'role-default';

    return (
      <span className={`role-badge ${colorClass}`}>
        <span className="mr-1 flex items-center">
          {roleIcons[roleName] || <User className="w-4 h-4" />}
        </span>
        {roleName.charAt(0).toUpperCase() + roleName.slice(1)}
      </span>
    );
  };

  /**
 * 🔐 Verificar si un usuario está bloqueado
 */
/**
 * 🏷️ Obtener texto del estado de bloqueo
 */
const getBlockStatusText = (user) => {
  if (!user) return '';
  
  if (user.bloqueado_permanente) {
    return '🔒 Bloqueado Permanente';
  }
  
  if (user.bloqueado_hasta) {
    const ahora = new Date();
    const bloqueadoHasta = new Date(user.bloqueado_hasta);
    
    if (bloqueadoHasta > ahora) {
      const minutos = Math.ceil((bloqueadoHasta - ahora) / 60000);
      return `⏱️ Bloqueado (${minutos} min)`;
    }
  }
  
  if (user.intentos_fallidos > 0) {
    return `⚠️ ${user.intentos_fallidos} intentos fallidos`;
  }
  
  return '';
};


  // ==================== RENDERIZADO ====================
  
  // 🔑 Mostrar mensaje si no tiene permiso de lectura
  if (!permissions.canRead) {
    return (
      <div className="section-placeholder">
        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
        <h2>Acceso Denegado</h2>
        <p>No tienes permiso para acceder al módulo de usuarios.</p>
      </div>
    );
  }

  // ⏳ Mostrar indicador de carga
  if (loading) {
    return (
      <div className="section-placeholder">
        <RefreshCw className="w-16 h-16 mx-auto mb-4 text-gray-400 animate-spin" />
        <h2>Cargando Usuarios</h2>
        <p>Por favor espera mientras cargamos la información...</p>
      </div>
    );
  }

  // ❌ Mostrar error si no se pudieron cargar usuarios
  if (error && users.length === 0) {
    return (
      <div className="section-placeholder">
        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
        <h2>Error al Cargar Usuarios</h2>
        <p>{error}</p>
        <button onClick={fetchUsers} className="btn-primary mt-4">
          <RefreshCw className="w-4 h-4 mr-2" />
          Reintentar
        </button>
      </div>
    );
  }

  const isFullListView =
    searchTerm.trim() === '' &&
    filterRole === 'all' &&
    statusFilter === 'all';

  // Mover el perfil del usuario logeado al inicio solo cuando se muestra toda la lista
  const usuariosConMiPerfil = miPerfil && isFullListView
  ? [
      // Mi perfil siempre primero con el flag
      { ...miPerfil, esMiPerfil: true },
      // El resto sin duplicar — compara por id_usuario_sistema
      ...sortedUsers.filter(u => u.id !== miPerfil.id),
    ]
  : sortedUsers;
  const paginatedUsers = usuariosConMiPerfil.slice(pageStartIndex, pageEndIndex);
  const showingFrom = sortedUsers.length === 0 ? 0 : pageStartIndex + 1;
  const showingTo = Math.min(pageEndIndex, sortedUsers.length);
  const excelTotalPages = Math.max(1, Math.ceil(excelPreview.length / EXCEL_PREVIEW_PAGE_SIZE));
  const normalizedExcelPreviewPage = Math.min(excelPreviewPage, excelTotalPages);
  const excelPreviewStart = (normalizedExcelPreviewPage - 1) * EXCEL_PREVIEW_PAGE_SIZE;
  const excelPreviewEnd = excelPreviewStart + EXCEL_PREVIEW_PAGE_SIZE;
  const paginatedExcelPreview = excelPreview.slice(excelPreviewStart, excelPreviewEnd);
  const excelValidCount = excelPreview.filter(u => getExcelUserIssues(u).length === 0).length;
  const excelInvalidCount = excelPreview.length - excelValidCount;

  // Renderizado principal
  return (
    <div className="users-section">
      {/* ==================== ENCABEZADO ==================== */}
      <div className="section-header">
            <div className="section-title">
              <Users className="w-7 h-7 text-blue-600" />
              <div>
                <h2>Gestión de Usuarios </h2>
                <p className="section-subtitle">
                  Gestiona la información de los usuarios
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
              Nuevo Usuario
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
      
      {/* ==================== ESTADÍSTICAS DE USUARIOS ==================== */}
      <div className="periodo-stats-container">

        {/* Header */}
        <div className="periodo-stats-header">
          <Users className="w-5 h-5 text-blue-600 mr-2" />
          <h3>Resumen de Usuarios</h3>
        </div>

        {/* Grid de estadísticas */}
        <div className="users-stats">

          {/* 📊 Total de usuarios */}
          <div
            className={`stat-item ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => handleStatusFilterClick('all')}
          >
            <Users className="stat-icon text-blue-600" />
            <div>
              <p className="stat-label">Total Usuarios</p>
              <p className="stat-value">{users.length}</p>
            </div>
          </div>

          {/* ✅ Usuarios activos */}
          <div
            className={`stat-item ${statusFilter === 'active' ? 'active green' : ''}`}
            onClick={() => handleStatusFilterClick('active')}
          >
            <UserCheck className="stat-icon text-green-600" />
            <div>
              <p className="stat-label">Usuarios Activos</p>
              <p className="stat-value">
                {users.filter(u => u.activo).length}
              </p>
            </div>
          </div>

          {/* ❌ Usuarios inactivos */}
          <div
            className={`stat-item ${statusFilter === 'inactive' ? 'active red' : ''}`}
            onClick={() => handleStatusFilterClick('inactive')}
          >
            <UserX className="stat-icon text-red-600" />
            <div>
              <p className="stat-label">Usuarios Inactivos</p>
              <p className="stat-value">
                {users.filter(u => !u.activo).length}
              </p>
            </div>
          </div>

          <div
            className={`stat-item ${statusFilter === 'blocked' ? 'active orange' : ''}`}
            onClick={() => handleStatusFilterClick('blocked')}
          >
            <Unlock className="stat-icon text-orange-600" />
            <div>
              <p className="stat-label">Usuarios Bloqueados</p>
              <p className="stat-value">{blockedUsersCount}</p>
            </div>
          </div>

        </div>
      </div>

      {/* ==================== FILTROS ==================== */}
      <div className="filters-section">

        {/* IZQUIERDA — Barra de búsqueda */}
        <div className="search-container">
          <Search className="search-icon" />
          <input
            type="text"
            placeholder="Buscar por nombre, código o cédula..."
            className="search-input"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
            }}
          />
        </div>

        {/* DERECHA — Agrupamos todos los filtros */}
        <div className="filters-right">

          {/* 🔀 Ordenamiento */}
          <select
            className="filter-select page-size-select"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            title="Usuarios por página"
          >
            {pageSizeOptions.map(size => (
              <option key={size} value={size}>
                {size} por página
              </option>
            ))}
          </select>
          
          
          {/* 🏷️ Filtro por rol */}
          <select 
            className="filter-select"
            value={filterRole}
            onChange={(e) => {
              setFilterRole(e.target.value);
            }}
          >
            <option value="all">Todos los roles</option>
            {roles.map(rol => (
              <option key={rol.id_rol} value={rol.id_rol}>
                {rol.nombre_rol}
              </option>
            ))}
          </select>

          

          <select
            className="filter-select"
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
          >
            <option value="rol">Ordenar por Rol</option>
            <option value="nombre">Ordenar por Nombre</option>
            <option value="fecha">Ordenar por Fecha</option>
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
            onClick={fetchUsers}
            title="Recargar lista"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

        </div>
     </div>

      {users.length > 100 && showSearchAdvice && (
        <div className="users-search-advice">
          <AlertCircle className="w-4 h-4" />
          <span>
            Hay {users.length} usuarios cargados. Para listas grandes, busca por nombre, código o cédula y usa los filtros para encontrar el registro más rápido.
          </span>
        </div>
      )}

      <div className="users-list-summary">
        <span>
          Mostrando {showingFrom}-{showingTo} de {sortedUsers.length} usuario{sortedUsers.length !== 1 ? 's' : ''}
        </span>
        {(searchTerm.trim() || filterRole !== 'all' || statusFilter !== 'all') && (
          <button
            type="button"
            className="clear-search-btn"
            onClick={() => {
              setSearchTerm('');
              setFilterRole('all');
              setStatusFilter('all');
            }}
          >
            Limpiar búsqueda
          </button>
        )}
      </div>

      {/* ==================== GRID DE USUARIOS ==================== */}
      <div className="users-grid">
        {paginatedUsers.map(user=> (
           <div key={user.id} className={`user-card ${!user.activo ? 'inactive' : ''} ${user.esMiPerfil ? 'mi-perfil' : ''}`}>
            {user.esMiPerfil && (
              <div className="mi-perfil-badge">
                👤 Mi Perfil
              </div>
            )}

            {/* Encabezado de la tarjeta */}
            <div className="user-card-header">
              <div className="user-info">
                {/* Avatar del usuario */}
                {user.foto ? (
                  <div className="user-avatar">
                    <img
                      src={user.foto}
                      alt={user.nombres}
                      className="user-avatar-img"
                    />
                  </div>
                ) : (
                  <div className="user-avatar user-avatar-empty">
                    <span>
                      {`${user.nombres?.[0]?.toUpperCase() || ''}${user.apellidos?.[0]?.toUpperCase() || ''}`}
                    </span>
                  </div>
                )}
                
                {/* Información básica del usuario */}
                <div>
                  <h3 className="user-name">{user.nombres} {user.apellidos}</h3>
                  <div className="user-meta">
                    {getRoleBadge(user)}
                    <span className={`status-badge ${user.activo ? 'active' : 'inactive'}`}>
                      {user.activo ? (
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
                    {/* ✅ AGREGAR BADGE DE BLOQUEO */}
                    {isUserBlocked(user) && (
                      <span className="status-badge" style={{
                        backgroundColor: '#fef2f2',
                        color: '#dc2626',
                        border: '1px solid #fca5a5'
                      }}>
                        <AlertCircle className="w-3 h-3" />
                        {getBlockStatusText(user)}
                      </span>
                    )}
                  </div>
                </div>
                
              </div>
              
              {/* Botones de acción */}
              <div className="user-actions">
                {/* 🔑 Botón "Ver detalles" - siempre visible si tiene permiso de lectura */}
                <button 
                  className="action-btn view"
                  onClick={() => openModal('view', user)}
                  title="Ver detalles"
                >
                  <Eye className="w-4 h-4 icon-view" />
                </button>

                {/* 🔑 Botón "Editar" - solo si tiene permiso de actualizar */}
                {permissions.canUpdate && (
                  <button 
                    className="action-btn edit"
                    onClick={() => openModal('edit', user)}
                    title="Editar usuario"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                )}

                {/* 🔑 Botón "Cambiar contraseña" - solo si tiene permiso */}
                {permissions.canChangePassword && (
                  <button 
                    className="action-btn"
                    onClick={() => openModal('password', user)}
                    title="Cambiar contraseña"
                  >
                    <Key className="w-4 h-4" />
                  </button>
                )}

                {/* 🔑 Botón "Cambiar foto" - solo si tiene permiso */}
                {permissions.canChangePhoto && (
                  <button 
                    className="action-btn"
                    onClick={() => openModal('photo', user)}
                    title="Cambiar foto"
                  >
                    <ImageIcon className="w-4 h-4" />
                  </button>
                )}

                {/* 🔑 Botón "Activar/Desactivar" - solo si tiene permiso */}
                {permissions.canToggleStatus && (
                  <button 
                    className="action-btn toggle"
                    onClick={() => toggleUserStatus(user.id)}
                    title={user.activo ? 'Desactivar' : 'Activar'}
                  >
                    {user.activo ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                  </button>
                )}

                {/* 🔑 Botón "Eliminar" - solo si tiene permiso de eliminar */}
                {permissions.canDelete && (
                  <button 
                    className="action-btn delete"
                    onClick={() => handleDelete(user.id)}
                    title="Eliminar usuario"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}

                {/* 🔐 Botón "Desbloquear" si el usuario está bloqueado */}
                {isUserBlocked(user) && permissions.canUpdate && (
                  <button
                    className="action-btn unlock"
                    onClick={() => handleUnlockUser(user.id, user.usuario)}
                    title="Desbloquear usuario"
                  >
                    <Unlock className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            
            {/* Cuerpo de la tarjeta con información de contacto */}
            <div className="user-card-body">
              <div className="user-contact">
                <div className="contact-item">
                  <IdCard  className="w-4 h-4 text-gray-400" />
                  <span>{user?.cedula || 'N/A'}</span>
                </div>
                <div className="contact-item">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span>{user.email}</span>
                </div>
                {user.telefono && (
                  <div className="contact-item">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span>{user.telefono}</span>
                  </div>
                )}
                {user.direccion && (
                  <div className="contact-item">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span>{user.direccion}</span>
                  </div>
                )}
              </div>
              
              {/* Fechas de registro y último acceso */}
              <div className="user-dates">
                {user.fecha_registro && (
                  <div className="date-item">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span>Registro: {new Date(user.fecha_registro).toLocaleDateString()}</span>
                  </div>
                )}
                {user.ultimo_acceso && (
                  <div className="date-item">
                    <span>Último acceso: {new Date(user.ultimo_acceso).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ==================== ESTADO VACÍO ==================== */}
      {sortedUsers.length === 0 && (
        <div className="empty-state">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3>No se encontraron usuarios</h3>
          <p>No hay usuarios que coincidan con los criterios de búsqueda.</p>
        </div>
      )}

      {sortedUsers.length > 0 && (
        <div className="pagination-controls">
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

      {/* ==================== MODALES ==================== */}
      {showModal && (
        <div className="modal-overlay">
          <div className={`modal ${modalType === 'excel' ? 'modal-excel' : ''}`}>
            <div className="modal-header">
              <h3>
                {modalType === 'create' && 'Crear Nuevo Usuario'}
                {modalType === 'edit' && 'Editar Usuario'}
                {modalType === 'view' && 'Detalles del Usuario'}
                {modalType === 'password' && 'Cambiar Contraseña'}
                {modalType === 'photo' && 'Cambiar Foto de Perfil'}
                {modalType === 'excel' && 'Crear usuarios desde excel'}
              </h3>
              <button className="modal-close" onClick={closeModal}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="modal-body">
              {/* Mensaje de error */}
              {error && (
                <div className="alert alert-error mb-4">
                  <AlertCircle className="w-5 h-5 mr-2" />
                  {error}
                </div>
              )}
              
              {/* ==================== MODAL DE CARGA DESDE EXCEL ==================== */}
              {modalType === 'excel' && (
                <div className="user-form">
                  {/* 📥 BOTÓN DE DESCARGA DE PLANTILLA */}
                  <div className="form-group form-group-full" style={{ marginBottom: "20px" }}>
                    <button className='btn-plantilla'
                      onClick={() => usersService.ExcelTemplate.generateTemplate()}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Descargar plantilla Excel
                    </button>

                    <small className="text-gray-500 mt-1 block">
                      La plantilla incluye: nombres, apellidos, sexo, fecha_nac, cedula, email, telefono, direccion
                    </small>
                  </div>
                  <div className="form-grid">
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
                        <br />
                        📝 <strong>Columnas obligatorias:</strong>
                        <br />
                        &nbsp;&nbsp;&nbsp;• nombres, apellidos, sexo , fecha_nac 
                        <br />
                        &nbsp;&nbsp;&nbsp;• cedula , email, telefono, direccion
                        <br />
                        <br />
                        ℹ️ <strong>Notas importantes:</strong>
                        <br />
                        &nbsp;&nbsp;&nbsp;• Todos los usuarios se crearán con <strong>rol Afiliado</strong>
                        <br />
                        &nbsp;&nbsp;&nbsp;• Estado: <strong>Activo</strong>
                        <br />
                        &nbsp;&nbsp;&nbsp;• Usuario: <strong>Su número de cédula</strong>
                        <br />
                        &nbsp;&nbsp;&nbsp;• Contraseña: <strong>Su número de cédula</strong>
                        <br />
                        &nbsp;&nbsp;&nbsp;• Máximo: <strong>500 usuarios por carga</strong>
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
                          📊 Vista previa ({excelPreview.length} usuario{excelPreview.length !== 1 ? 's' : ''})
                          <ul className="ml-4 space-y-1">
                            <li className="text-green-600">✓ {excelValidCount} válidos</li>
                            {excelInvalidCount > 0 && (
                              <li className="text-red-600">⚠️ {excelInvalidCount} inválidos (serán omitidos)</li>
                            )}
                            <li className="text-gray-500">
                              Mostrando {excelPreviewStart + 1}-{Math.min(excelPreviewEnd, excelPreview.length)} de {excelPreview.length}
                            </li>
                          </ul>
                        </label>
                        
                        <div style={{ 
                          maxHeight: '400px', 
                          overflow: 'auto',
                          border: '1px solid #e5e7eb', 
                          borderRadius: '8px',
                          backgroundColor: '#fff'
                        }}>
                          <table style={{ 
                            minWidth: '920px',
                            width: '100%',
                            fontSize: '13px', 
                            borderCollapse: 'collapse' 
                          }}>
                            <thead style={{ 
                              position: 'sticky', 
                              top: 0, 
                              backgroundColor: '#f9fafb', 
                              borderBottom: '2px solid #e5e7eb',
                              zIndex: 1
                            }}>
                              <tr>
                                <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: '600' }}>#</th>
                                <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: '600' }}>Nombres</th>
                                <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: '600' }}>Apellidos</th>
                                <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: '600' }}>Sexo</th>
                                <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: '600' }}>F. Nac.</th>
                                <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: '600' }}>Cédula</th>
                                <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: '600' }}>Email</th>
                                <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: '600' }}>Teléfono</th>
                                <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: '600' }}>Estado</th>
                              </tr>
                            </thead>
                            <tbody>
                              {paginatedExcelPreview.map((u, idx) => {
                                const issues = getExcelUserIssues(u);
                                const esValido = issues.length === 0;
                                const tieneErrores = !esValido;
                                
                                return (
                                  <tr 
                                    key={`${u.__fila || excelPreviewStart + idx + 1}-${idx}`}
                                    style={{ 
                                      borderBottom: '1px solid #f3f4f6',
                                      backgroundColor: tieneErrores ? '#fef2f2' : 'transparent'
                                    }}
                                  >
                                    <td style={{ padding: '8px', color: '#6b7280' }}>{u.__fila || excelPreviewStart + idx + 1}</td>
                                    <td style={{ padding: '8px' }}>
                                      {u.nombres || <span style={{ color: '#ef4444' }}>❌ Falta</span>}
                                    </td>
                                    <td style={{ padding: '8px' }}>
                                      {u.apellidos || <span style={{ color: '#ef4444' }}>❌ Falta</span>}
                                    </td>
                                    <td style={{ padding: '8px' }}>
                                      {u.sexo || <span style={{ color: '#f59e0b' }}>⚠️ O</span>}
                                    </td>
                                    <td style={{ padding: '8px', fontSize: '12px' }}>
                                      {u.fecha_nac || <span style={{ color: '#f59e0b' }}>⚠️ Sin fecha</span>}
                                    </td>
                                    <td style={{ padding: '8px' }}>
                                      {u.cedula || <span style={{ color: '#ef4444' }}>❌ Falta</span>}
                                    </td>
                                    <td style={{ padding: '8px', fontSize: '12px' }}>
                                      {u.email || <span style={{ color: '#ef4444' }}>❌ Falta</span>}
                                    </td>
                                    <td style={{ padding: '8px' }}>
                                      {u.telefono || <span style={{ color: '#9ca3af' }}>-</span>}
                                    </td>
                                    <td style={{ padding: '8px' }}>
                                      {esValido ? (
                                        <span style={{ color: '#10b981', fontSize: '12px' }}>✓ OK</span>
                                      ) : (
                                        <span style={{ color: '#ef4444', fontSize: '12px' }}>{issues.join('; ')}</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {excelTotalPages > 1 && (
                          <div className="excel-preview-pagination">
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => setExcelPreviewPage(page => Math.max(1, page - 1))}
                              disabled={normalizedExcelPreviewPage === 1}
                            >
                              Anterior
                            </button>
                            <span>
                              Página {normalizedExcelPreviewPage} de {excelTotalPages}
                            </span>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => setExcelPreviewPage(page => Math.min(excelTotalPages, page + 1))}
                              disabled={normalizedExcelPreviewPage === excelTotalPages}
                            >
                              Siguiente
                            </button>
                          </div>
                        )}
                        
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
                            <li>Usuario y contraseña inicial serán el número de cédula</li>
                            <li>Rol asignado: <strong>Afiliado</strong></li>
                            <li>Estado: <strong>Activo</strong></li>
                            <li>Usuario inicial: <strong>Número de cédula</strong></li>
                            <li>Contraseña inicial: <strong>Número de cédula</strong></li>
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Botones */}
                  <div className="form-actions">
                    <button 
                      type="button" 
                      className="btn-secondary" 
                      onClick={closeModal}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancelar
                    </button>

                    <button 
                      type="button" 
                      className="btn-primary"
                      onClick={handleExcelUpload}
                      disabled={
                        excelPreview.length === 0 || 
                        excelValidCount === 0 ||
                        excelValidCount > 500 ||
                        loading
                      }
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {loading 
                        ? 'Procesando...' 
                        : `Crear ${excelValidCount} usuario${excelValidCount !== 1 ? 's' : ''} válido${excelValidCount !== 1 ? 's' : ''}`
                      }
                    </button>
                  </div>
                </div>
              )}

    
              {/* ==================== MODAL DE VISTA ==================== */}
              {modalType === 'view' && selectedUser && (
                <div className="user-details">
                  {/* Foto de perfil */}
                  <div className="user-photo-container mb-5">
                    {selectedUser.foto ? (
                      <img 
                        src={selectedUser.foto} 
                        alt={selectedUser.nombres}
                        className="user-photo-img"
                      />
                    ) : (
                      <div className="user-photo-placeholder">
                        {`${selectedUser.nombres?.[0]?.toUpperCase() || ''}${selectedUser.apellidos?.[0]?.toUpperCase() || ''}`}
                      </div>
                    )}
                  </div>
                  
                  {/* Información detallada del usuario */}
                  <div className="detail-group">
                    <label>Usuario:</label>
                    <p>{selectedUser.usuario}</p>
                  </div>
                  <div className="detail-group">
                    <label>Nombre Completo:</label>
                    <p>{selectedUser.nombres} {selectedUser.apellidos}</p>
                  </div>
                  <div className="detail-group">
                    <label>Cédula:</label>
                    <p>{selectedUser.cedula}</p>
                  </div>
                  <div className="detail-group">
                    <label>Sexo:</label>
                    <p>
                      {selectedUser.sexo === "M" ? "Masculino" :
                       selectedUser.sexo === "F" ? "Femenino" : "Otro"}
                    </p>
                  </div>
                  <div className="detail-group">
                    <label>Fecha Nacimiento:</label>
                    <p>{selectedUser.fecha_nac}</p>
                  </div>
                  <div className="detail-group">
                    <label>Edad:</label>
                    <p>{calculateAge(selectedUser.fecha_nac)} años</p>
                  </div>
                  <div className="detail-group">
                    <label>Email:</label>
                    <p>{selectedUser.email}</p>
                  </div>
                  {selectedUser.telefono && (
                    <div className="detail-group">
                      <label>Teléfono:</label>
                      <p>{selectedUser.telefono}</p>
                    </div>
                  )}
                  {selectedUser.direccion && (
                    <div className="detail-group">
                      <label>Dirección:</label>
                      <p>{selectedUser.direccion}</p>
                    </div>
                  )}
                  <div className="detail-group">
                    <label>Rol:</label>
                    <p>{getRoleBadge(selectedUser)}</p>
                  </div>
                  <div className="detail-group">
                    <label>Estado:</label>
                    <span className={`status-badge ${selectedUser.activo ? 'active' : 'inactive'}`}>
                      {selectedUser.activo ? (
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

              {/* ==================== MODAL DE CREACIÓN/EDICIÓN ==================== */}
              {(modalType === 'create' || modalType === 'edit') && (
                <form onSubmit={handleSubmit} className="user-form">
                  <div className="form-grid">
                    {/* Nombres */}
                    <div className="form-group">
                      <label>Nombres *</label>
                      <input
                        type="text"
                        required
                        value={formData.nombres}
                        onChange={(e) => setFormData({ ...formData, nombres: e.target.value })}
                        placeholder="Nombres del usuario"
                      />
                    </div>

                    {/* Apellidos */}
                    <div className="form-group">
                      <label>Apellidos *</label>
                      <input
                        type="text"
                        required
                        value={formData.apellidos}
                        onChange={(e) => setFormData({ ...formData, apellidos: e.target.value })}
                        placeholder="Apellidos del usuario"
                      />
                    </div>

                    {/* Sexo */}
                    <div className="form-group">
                      <label>Sexo *</label>
                      <select
                        required
                        value={formData.sexo}
                        onChange={(e) => setFormData({ ...formData, sexo: e.target.value })}
                      >
                        <option value="">Seleccione una opción</option>
                        <option value="M">Masculino</option>
                        <option value="F">Femenino</option>
                        <option value="O">Otro</option>
                      </select>
                    </div>

                    {/* Fecha de Nacimiento */}
                    <div className="form-group">
                      <label>Fecha de Nacimiento *</label>
                      <input
                        type="date"
                        required
                        value={formData.fecha_nac}
                        onChange={(e) => setFormData({ ...formData, fecha_nac: e.target.value })}
                      />
                    </div>

                    {/* Cédula */}
                    <div className="form-group">
                      <label>Cédula *</label>
                      <input
                        type="text"
                        required
                        value={formData.cedula}
                        onChange={(e) => setFormData({ ...formData, cedula: e.target.value })}
                        placeholder="Número de cédula"
                      />
                    </div>

                    {/* Email */}
                    <div className="form-group">
                      <label>Correo Electrónico *</label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="email@ejemplo.com"
                      />
                    </div>

                    {/* Teléfono */}
                    <div className="form-group">
                      <label>Teléfono</label>
                      <input
                        type="tel"
                        value={formData.telefono}
                        onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                        placeholder="Número de teléfono"
                      />
                    </div>

                    {/* Dirección */}
                    <div className="form-group form-group-full">
                      <label>Dirección</label>
                      <textarea
                        value={formData.direccion}
                        onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                        placeholder="Dirección completa"
                        rows="3"
                      />
                    </div>

                    {/* Rol */}
                    <div className="form-group">
                      <label>Rol *</label>
                      <select
                        required
                        value={formData.id_rol || ''}
                        onChange={(e) => setFormData({ ...formData, id_rol: parseInt(e.target.value) })}
                      >
                        <option value="">Seleccione un rol</option>
                        {roles.map(rol => (
                          <option key={rol.id_rol} value={rol.id_rol}>
                            {rol.nombre_rol}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Estado */}
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

                  {/* Botones de acción del formulario */}
                  <div className="form-actions">
                    <button type="button" className="btn-secondary" onClick={closeModal}>
                      <X className="w-4 h-4 mr-2" />
                      Cancelar
                    </button>
                    <button type="submit" className="btn-primary">
                      <Save className="w-4 h-4 mr-2" />
                      {modalType === "create" ? "Crear Usuario" : "Guardar Cambios"}
                    </button>
                  </div>
                </form>
              )}

              {/* ==================== MODAL DE CAMBIO DE CONTRASEÑA ==================== */}
              {modalType === 'password' && (
                <form onSubmit={handleChangePassword} className="user-form">
                  <div className="form-grid">
                    {/* Contraseña actual */}
                    <div className="form-group form-group-full">
                      <label>Contraseña Actual *</label>
                      <input
                        type="password"
                        required
                        value={passwordData.currentPassword}
                        onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                        placeholder="Contraseña actual"
                      />
                    </div>
                    
                    {/* Nueva contraseña */}
                    <div className="form-group form-group-full">
                      <label>Nueva Contraseña *</label>
                      <input
                        type="password"
                        required
                        minLength="8"
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                        placeholder="Nueva contraseña (min. 8 caracteres)"
                      />
                    </div>
                    
                    {/* Confirmar contraseña */}
                    <div className="form-group form-group-full">
                      <label>Confirmar Nueva Contraseña *</label>
                      <input
                        type="password"
                        required
                        minLength="8"
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                        placeholder="Confirmar nueva contraseña"
                      />
                    </div>
                  </div>
                  
                  {/* Botones de acción */}
                  <div className="form-actions">
                    <button type="button" className="btn-secondary" onClick={closeModal}>
                      <X className="w-4 h-4 mr-2" />
                      Cancelar
                    </button>
                    <button type="submit" className="btn-primary">
                      <Key className="w-4 h-4 mr-2" />
                      Cambiar Contraseña
                    </button>
                  </div>
                </form>
              )}

              {/* ==================== MODAL DE CAMBIO DE FOTO ==================== */}
              {modalType === 'photo' && (
                <form onSubmit={handleUploadPhoto} className="user-form">
                  <div className="form-grid">
                    {/* Selector de archivo */}
                    <div className="form-group form-group-full">
                      <label>Seleccionar Imagen *</label>
                      <input
                        type="file"
                        accept="image/*"
                        required
                        onChange={(e) => setSelectedFile(e.target.files[0])}
                      />
                      <small className="text-gray-500 mt-1">
                        Formatos permitidos: JPG, PNG, GIF. Tamaño máximo: 2MB
                      </small>
                    </div>
                    
                    {/* Vista previa del archivo seleccionado */}
                    {selectedFile && (
                      <div className="form-group form-group-full">
                        <p className="text-sm text-gray-600">
                          Archivo seleccionado: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {/* Botones de acción */}
                  <div className="form-actions">
                    <button type="button" className="btn-secondary" onClick={closeModal}>
                      <X className="w-4 h-4 mr-2" />
                      Cancelar
                    </button>
                    <button type="submit" className="btn-primary">
                      <ImageIcon className="w-4 h-4 mr-2" />
                      Subir Foto
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

export default UsersSection;
