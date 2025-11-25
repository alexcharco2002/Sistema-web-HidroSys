// src/utils/modulesDefinitions.js
/**
 * Definiciones de módulos del sistema
 * Mapea los nombres de permisos del backend a configuración de UI
 */
import {
  BarChart3,
  Shield,
  Users,
  FileText,
  DollarSign,
  Gauge,
  Calendar,
  Settings,
  Activity,
  Package,
  Map,
  Clock,
  Bell,
  TrendingUp,
  Database,
  Home,
  Briefcase,
  PieChart,
  Cog,
  AlertCircle
} from "lucide-react";

// ============================================================================
// DEFINICIÓN DE CATEGORÍAS
// ============================================================================

export const CATEGORIES = {
  HOME: {
    id: "HOME",
    label: "Inicio",
    icon: Home,
    order: 0,
    collapsible: false,
    defaultOpen: true,
  },
  USER_MANAGEMENT: {
    id: "USER_MANAGEMENT",
    label: "Gestión de Usuarios",
    icon: Users,
    order: 1,
    collapsible: true,
    defaultOpen: false,
  },
  OPERATIONS: {
    id: "OPERATIONS",
    label: "Operaciones",
    icon: Briefcase,
    order: 2,
    collapsible: true,
    defaultOpen: false,
  },
  FINANCIAL: {
    id: "FINANCIAL",
    label: "Financiero",
    icon: DollarSign,
    order: 3,
    collapsible: true,
    defaultOpen: false,
  },
  REPORTS_ANALYSIS: {
    id: "REPORTS_ANALYSIS",
    label: "Reportes y Análisis",
    icon: PieChart,
    order: 4,
    collapsible: true,
    defaultOpen: false,
  },
  SYSTEM: {
    id: "SYSTEM",
    label: "Sistema",
    icon: Cog,
    order: 5,
    collapsible: true,
    defaultOpen: false,
  },
};

// ============================================================================
// DEFINICIÓN DE MÓDULOS
// ============================================================================

export const MODULE_DEFINITIONS = {
  // 🏠 INICIO
  overview: {
    id: "overview",
    label: "Panel General",
    icon: BarChart3,
    color: "blue",
    category: "HOME",
    order: 0,
    alwaysVisible: true,
    componentName: "OverviewSection",
    description: "Resumen general del sistema y estadísticas rápidas."
  },
  profile: {
    id: "profile",
    label: "Mi Perfil",
    icon: Shield,
    color: "purple",
    category: "HOME",
    order: 1,
    alwaysVisible: true,
    componentName: "ProfileSection",
    description: "Configuración de la cuenta personal del usuario."
  },

  // 👥 GESTIÓN DE USUARIOS
  usuarios: {
    id: "users",
    label: "Usuarios",
    icon: Users,
    color: "blue",
    category: "USER_MANAGEMENT",
    order: 1,
    componentName: "UsersSection",
    description: "Administración de usuarios del sistema."
  },
  clientes: {
    id: "customers",
    label: "Clientes",
    icon: Users,
    color: "teal",
    category: "USER_MANAGEMENT",
    order: 2,
    componentName: "CustomersSection",
    description: "Gestión de clientes y afiliaciones."
  },
  afiliados: {
    id: "affiliates",
    label: "Afiliados",
    icon: Users,
    color: "cyan",
    category: "USER_MANAGEMENT",
    order: 3,
    componentName: "AffiliatesSection",
    description: "Administración de afiliados al sistema."
  },
  roles: {
    id: "roles",
    label: "Roles",
    icon: Shield,
    color: "indigo",
    category: "USER_MANAGEMENT",
    order: 4,
    componentName: "RolesSection",
    description: "Gestión de roles y permisos de acceso."
  },
 

  // ⚙️ OPERACIONES
  lecturas: {
    id: "readings",
    label: "Lecturas",
    icon: Gauge,
    color: "indigo",
    category: "OPERATIONS",
    order: 1,
    componentName: "ReadingsSection",
    description: "Registro y control de lecturas de medidores."
  },
  medidores: {
    id: "meters",
    label: "Medidores",
    icon: Activity,
    color: "cyan",
    category: "OPERATIONS",
    order: 2,
    componentName: "MetersSection",
    description: "Administración de medidores asignados a usuarios."
  },
  geolocalizacion: {
    id: "geolocalizacion",
    label: "Geolocalización",
    icon: Map,
    color: "rose",
    category: "OPERATIONS",
    order: 3,
    componentName: "GeolocationSection",
    description: "Geolocalización en el mapa."
  },
  sectores: {
    id: "sectors",
    label: "Sectores",
    icon: Map,
    color: "purple",
    category: "OPERATIONS",
    order: 4,
    componentName: "SectorsSection",
    description: "Gestión de sectores geográficos."
  },
  inventario: {
    id: "inventory",
    label: "Inventario",
    icon: Package,
    color: "amber",
    category: "OPERATIONS",
    order: 5,
    componentName: "InventorySection",
    description: "Control de materiales, equipos y existencias."
  },

  // 💰 FINANCIERO
  facturas: {
    id: "invoices",
    label: "Facturación",
    icon: FileText,
    color: "green",
    category: "FINANCIAL",
    order: 1,
    componentName: "InvoicesSection",
    description: "Generación y control de facturas."
  },
  pagos: {
    id: "payments",
    label: "Pagos",
    icon: DollarSign,
    color: "emerald",
    category: "FINANCIAL",
    order: 2,
    componentName: "PaymentsSection",
    description: "Registro y administración de pagos."
  },
  multas: {
    id: "fines",
    label: "Multas",
    icon: AlertCircle,
    color: "red",
    category: "FINANCIAL",
    order: 3,
    componentName: "FinesSection",
    description: "Gestión de multas y penalizaciones."
  },
  cobranzas: {
    id: "collections",
    label: "Cobranzas",
    icon: DollarSign,
    color: "lime",
    category: "FINANCIAL",
    order: 4,
    componentName: "CollectionsSection",
    description: "Gestión de cobranzas y estados de cuenta."
  },
  cajas: {
    id: "cashboxes",
    label: "Cajas",
    icon: DollarSign,
    color: "yellow",
    category: "FINANCIAL",
    order: 5,
    componentName: "CashboxesSection",
    description: "Control de ingresos y egresos de caja."
  },
  tarifas: {
    id: "rates",
    label: "Tarifas",
    icon: DollarSign,
    color: "orange",
    category: "FINANCIAL",
    order: 6,
    componentName: "TarifasSection",
    description: "Configuración de tarifas y precios."
  },
  servicios: {
    id: "services",
    label: "Servicios",
    icon: Briefcase,
    color: "violet",
    category: "FINANCIAL",
    order: 7,
    componentName: "ServicesSection",
    description: "Gestión de servicios ofrecidos."
  },

  // 📈 REPORTES Y ANÁLISIS
  reportes: {
    id: "reports",
    label: "Reportes",
    icon: Calendar,
    color: "orange",
    category: "REPORTS_ANALYSIS",
    order: 1,
    componentName: "ReportsSection",
    description: "Generación de reportes administrativos."
  },
  estadisticas: {
    id: "statistics",
    label: "Estadísticas",
    icon: TrendingUp,
    color: "fuchsia",
    category: "REPORTS_ANALYSIS",
    order: 2,
    componentName: "StatisticsSection",
    description: "Análisis visual de datos y rendimiento."
  },
  auditoria: {
    id: "audit",
    label: "Auditoría",
    icon: Clock,
    color: "slate",
    category: "REPORTS_ANALYSIS",
    order: 3,
    componentName: "AuditSection",
    description: "Registro de cambios y acciones del sistema."
  },
  historico: {
    id: "historical",
    label: "Histórico",
    icon: Clock,
    color: "stone",
    category: "REPORTS_ANALYSIS",
    order: 4,
    componentName: "HistoricalSection",
    description: "Consulta de datos históricos del sistema."
  },

  // ⚙️ SISTEMA
  configuracion: {
    id: "settings",
    label: "Configuración",
    icon: Settings,
    color: "gray",
    category: "SYSTEM",
    order: 1,
    componentName: "ConfigSection",
    description: "Ajustes del sistema y opciones generales."
  },
  notificaciones: {
    id: "notifications",
    label: "Notificaciones",
    icon: Bell,
    color: "violet",
    category: "SYSTEM",
    order: 2,
    componentName: "NotificationsSection",
    description: "Gestión de alertas y mensajes del sistema."
  },
  base_datos: {
    id: "database",
    label: "Base de Datos",
    icon: Database,
    color: "zinc",
    category: "SYSTEM",
    order: 3,
    componentName: "DatabaseSection",
    description: "Mantenimiento y respaldo de la base de datos."
  },
  empresas: {
    id: "companies",
    label: "Empresas",
    icon: Settings,
    color: "sky",
    category: "SYSTEM",
    order: 4,
    componentName: "CompaniesSection",
    description: "Gestión de la información de la empresa."
  }
};

// ============================================================================
// FUNCIÓN: Construir módulos organizados por categorías desde permisos
// ============================================================================

export const buildModulesFromPermissions = (permissions) => {
  console.log('🔧 Construyendo módulos desde permisos:', permissions?.length || 0);
  
  // Paso 1: Recopilar todos los módulos disponibles
  const availableModules = new Set();
  
  // Agregar módulos que siempre están visibles
  Object.entries(MODULE_DEFINITIONS).forEach(([key, module]) => {
    if (module.alwaysVisible) {
      availableModules.add(module);
    }
  });

  // Paso 2: Agregar módulos basados en permisos
  if (permissions && permissions.length > 0) {
    permissions.forEach(perm => {
      if (!perm.nombre_accion) return;
      
      const [moduleName] = perm.nombre_accion.split('.');
      const normalizedName = moduleName.toLowerCase();
      
      const moduleConfig = MODULE_DEFINITIONS[normalizedName];
      
      if (moduleConfig && !moduleConfig.alwaysVisible) {
        availableModules.add(moduleConfig);
      } else if (!moduleConfig) {
        // Crear módulo genérico si no existe en la definición
        console.warn(`⚠️ Módulo no definido en frontend: ${normalizedName}, creando genérico`);
        
        availableModules.add({
          id: normalizedName,
          label: normalizedName.charAt(0).toUpperCase() + normalizedName.slice(1),
          icon: Activity,
          color: 'gray',
          category: 'SYSTEM',
          order: 999,
          componentName: 'GenericSection',
          isGeneric: true,
          description: `Módulo ${normalizedName}`
        });
      }
    });
  }

  // Paso 3: Organizar módulos por categorías
  const categoriesMap = {};
  
  // Inicializar todas las categorías
  Object.values(CATEGORIES).forEach(category => {
    categoriesMap[category.id] = {
      ...category,
      modules: []
    };
  });

  // Asignar módulos a sus categorías
  Array.from(availableModules).forEach(module => {
    const categoryId = module.category || 'SYSTEM';
    
    if (categoriesMap[categoryId]) {
      categoriesMap[categoryId].modules.push(module);
    } else {
      // Si la categoría no existe, agregarlo a SYSTEM
      console.warn(`⚠️ Categoría no encontrada: ${categoryId}, agregando a SYSTEM`);
      categoriesMap['SYSTEM'].modules.push(module);
    }
  });

  // Paso 4: Ordenar módulos dentro de cada categoría
  Object.values(categoriesMap).forEach(category => {
    category.modules.sort((a, b) => a.order - b.order);
  });

  // Paso 5: Filtrar categorías vacías y ordenar
  const organizedCategories = Object.values(categoriesMap)
    .filter(category => category.modules.length > 0)
    .sort((a, b) => a.order - b.order);

  console.log('✅ Módulos organizados por categorías:', 
    organizedCategories.map(c => ({ 
      category: c.label, 
      modules: c.modules.length 
    }))
  );

  return organizedCategories;
};

// ============================================================================
// FUNCIÓN: Obtener acciones disponibles por módulo
// ============================================================================

export const getModuleActions = (moduleName, permissions) => {
  if (!permissions || permissions.length === 0) return [];

  moduleName = moduleName.toLowerCase();
  const actions = new Set();

  permissions.forEach(perm => {
    if (!perm.nombre_accion) return;

    const [permModule, permAction] = perm.nombre_accion.split('.');
    
    if (permModule.toLowerCase() === moduleName) {
      const action = permAction.toLowerCase();
      
      if (action === 'crud') {
        actions.add('crear');
        actions.add('leer');
        actions.add('actualizar');
        actions.add('eliminar');
      } else {
        actions.add(action);
      }
    }
  });

  return Array.from(actions);
};

// ============================================================================
// ACCIONES RÁPIDAS DINÁMICAS
// ============================================================================

export const QUICK_ACTION_DEFINITIONS = {
  'usuarios.crear': {
    id: 'create-user',
    label: 'Nuevo Usuario',
    icon: Users,
    section: 'users',
    color: 'blue'
  },
  'facturas.crear': {
    id: 'create-invoice',
    label: 'Nueva Factura',
    icon: FileText,
    section: 'invoices',
    color: 'green'
  },
  'pagos.crear': {
    id: 'register-payment',
    label: 'Registrar Pago',
    icon: DollarSign,
    section: 'payments',
    color: 'emerald'
  },
  'lecturas.crear': {
    id: 'new-reading',
    label: 'Nueva Lectura',
    icon: Gauge,
    section: 'readings',
    color: 'indigo'
  },
  'reportes.leer': {
    id: 'view-reports',
    label: 'Ver Reportes',
    icon: Calendar,
    section: 'reports',
    color: 'orange'
  }
};

export const buildQuickActionsFromPermissions = (permissions) => {
  if (!permissions || permissions.length === 0) return [];

  const quickActions = [];

  permissions.forEach(perm => {
    if (!perm.nombre_accion) return;

    const permKey = perm.nombre_accion.toLowerCase();
    const [module, action] = permKey.split('.');

    if (QUICK_ACTION_DEFINITIONS[permKey]) {
      quickActions.push(QUICK_ACTION_DEFINITIONS[permKey]);
    } else if (action === 'crud' || action === 'crear') {
      const moduleConfig = MODULE_DEFINITIONS[module];
      
      if (moduleConfig && !quickActions.some(qa => qa.section === moduleConfig.id)) {
        quickActions.push({
          id: `create-${module}`,
          label: `Nuevo ${moduleConfig.label}`,
          icon: moduleConfig.icon,
          section: moduleConfig.id,
          color: moduleConfig.color
        });
      }
    }
  });

  return quickActions;
};