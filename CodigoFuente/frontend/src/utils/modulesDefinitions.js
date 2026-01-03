// src/utils/modulesDefinitions.js
/**
 * Definiciones de módulos SEGUN LOS PERMISOS DE ROLE-SECTION
 * del sistema con soporte para rutas URL
 */
import {
  BarChart3, Users, FileText, DollarSign, Gauge, UserCircle,
  Calendar, Settings, Bell, BookOpen, UserX,
  TrendingUp, Home, Briefcase, PieChart, Cog, AlertTriangle, MapPin, Layers, ShieldCheck, Handshake, UserCheck
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
// DEFINICIÓN DE MÓDULOS CON RUTAS
// ============================================================================

export const MODULE_DEFINITIONS = {
  // 🏠 INICIO
  home: {
    id: "home",
    path: "home", // 🔥 Ruta URL
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
    path: "profile", // 🔥 Ruta URL
    label: "Mi Perfil",
    icon: UserCircle,
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
    path: "users", // 🔥 Ruta URL: /admin/dashboard/users
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
    path: "customers", // 🔥 Ruta URL: /admin/dashboard/customers
    label: "Clientes",
    icon: Handshake,
    color: "teal",
    category: "USER_MANAGEMENT",
    order: 2,
    componentName: "CustomersSection",
    description: "Gestión de clientes y afiliaciones."
  },
  afiliados: {
    id: "affiliates",
    path: "affiliates", // 🔥 Ruta URL: /admin/dashboard/affiliates
    label: "Afiliados",
    icon: UserCheck,
    color: "cyan",
    category: "USER_MANAGEMENT",
    order: 3,
    componentName: "AffiliatesSection",
    description: "Administración de afiliados al sistema."
  },
  roles: {
    id: "roles",
    path: "roles", // 🔥 Ruta URL: /admin/dashboard/roles
    label: "Roles",
    icon: ShieldCheck,
    color: "indigo",
    category: "USER_MANAGEMENT",
    order: 4,
    componentName: "RolesSection",
    description: "Gestión de roles y permisos de acceso."
  },

  // ⚙️ OPERACIONES
  lecturas: {
    id: "readings",
    path: "readings", // 🔥 Ruta URL: /admin/dashboard/readings
    label: "Lecturas",
    icon: BookOpen,
    color: "indigo",
    category: "OPERATIONS",
    order: 1,
    componentName: "ReadingsSection",
    description: "Registro y control de lecturas de medidores."
  },
  medidores: {
    id: "meters",
    path: "meters",
    label: "Medidores",
    icon: Gauge,
    color: "cyan",
    category: "OPERATIONS",
    order: 2,
    componentName: "MetersSection",
    description: "Administración de medidores asignados a usuarios."
  },
  geolocalizacion: {
    id: "geolocation",
    path: "geolocation",
    label: "Geolocalización",
    icon: MapPin,
    color: "rose",
    category: "OPERATIONS",
    order: 3,
    componentName: "GeolocationSection",
    description: "Geolocalización en el mapa."
  },
  sectores: {
    id: "sectors",
    path: "sectors",
    label: "Sectores",
    icon: Layers,
    color: "purple",
    category: "OPERATIONS",
    order: 4,
    componentName: "SectorsSection",
    description: "Gestión de sectores geográficos."
  },
  mi_medidor: {
    id: "my_meter",
    path: "my-meter",
    label: "Mi Medidor",
    icon: Home,
    color: "blue",
    category: "OPERATIONS",
    order: 5,
    componentName: "MiMedidorSection",
    description: "Visualización y gestión del medidor personal."
  },


  // 💰 FINANCIERO
  facturas: {
    id: "invoices",
    path: "invoices",
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
    path: "payments",
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
    path: "fines",
    label: "Multas",
    icon: AlertTriangle,
    color: "red",
    category: "FINANCIAL",
    order: 3,
    componentName: "FinesSection",
    description: "Gestión de multas y penalizaciones."
  },
  multasafiliados: {
    id: "fines_affiliates",
    path: "fines-affiliates",
    label: "Multas Afiliados",
    icon: UserX,              
    color: "orange",
    category: "FINANCIAL",
    order: 4,
    componentName: "FinesAffiliatesSection",
    description: "Asignación y gestión de multas aplicadas a usuarios afiliados."
  },
  cobranzas: {
    id: "collections",
    path: "collections",
    label: "Cobranzas",
    icon: DollarSign,
    color: "lime",
    category: "FINANCIAL",
    order: 5,
    componentName: "CollectionsSection",
    description: "Gestión de cobranzas y estados de cuenta."
  },
  cajas: {
    id: "cashboxes",
    path: "cashboxes",
    label: "Cajas",
    icon: DollarSign,
    color: "yellow",
    category: "FINANCIAL",
    order: 6,
    componentName: "CashboxesSection",
    description: "Control de ingresos y egresos de caja."
  },
  tarifas: {
    id: "rates",
    path: "rates",
    label: "Tarifas",
    icon: DollarSign,
    color: "orange",
    category: "FINANCIAL",
    order: 7,
    componentName: "TarifasSection",
    description: "Configuración de tarifas y precios."
  },
  servicios: {
    id: "services",
    path: "services",
    label: "Servicios",
    icon: Briefcase,
    color: "violet",
    category: "FINANCIAL",
    order: 8,
    componentName: "ServiciosSection",
    description: "Gestión de servicios ofrecidos."
  },

  // 📈 REPORTES Y ANÁLISIS
  reportes: {
    id: "reports",
    path: "reports",
    label: "Reportes",
    icon: Calendar,
    color: "orange",
    category: "REPORTS_ANALYSIS",
    order: 1,
    componentName: "ReportsSection",
    description: "Generación de reportes administrativos."
  },
  historialconsumo: {
    id: "historials",
    path: "historials",
    label: "Historial Consumo", 
    icon: TrendingUp,
    color: "blue",
    category: "REPORTS_ANALYSIS",
    order: 3,
    componentName: "HistorialConsumos",
  },
  estadisticas: {
    id: "statistics",
    path: "statistics",
    label: "Estadísticas",
    icon: TrendingUp,
    color: "fuchsia",
    category: "REPORTS_ANALYSIS",
    order: 9,
    componentName: "StatisticsSection",
    description: "Análisis visual de datos y rendimiento."
  },
  facturas_pagos: {
    id: "facturas-pagos",
    path: "facturas-pagos",
    label: "Facturas y Pagos",
    icon: FileText,
    color: "indigo",
    category: "REPORTS_ANALYSIS",
    order: 10,
    componentName: "AffiliateBillingSection",
    description: "Estadísticas y análisis de facturas y pagos."
  },
  // ⚙️ SISTEMA
  configuracion: {
    id: "settings",
    path: "settings",
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
    path: "notifications",
    label: "Notificaciones",
    icon: Bell,
    color: "violet",
    category: "SYSTEM",
    order: 2,
    componentName: "NotificationsSection",
    description: "Gestión de alertas y mensajes del sistema."
  }
  
};

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

export const buildModulesFromPermissions = (permissions) => {
  console.log('🔧 Construyendo módulos desde permisos:', permissions?.length || 0);
  
  const availableModules = new Set();
  
  // Agregar módulos siempre visibles
  Object.entries(MODULE_DEFINITIONS).forEach(([key, module]) => {
    if (module.alwaysVisible) {
      availableModules.add(module);
    }
  });

  // Agregar módulos basados en permisos
  if (permissions && permissions.length > 0) {
    permissions.forEach(perm => {
      if (!perm.nombre_accion) return;
      
      const [moduleName] = perm.nombre_accion.split('.');
      const normalizedName = moduleName.toLowerCase();
      
      const moduleConfig = MODULE_DEFINITIONS[normalizedName];
      
      if (moduleConfig && !moduleConfig.alwaysVisible) {
        availableModules.add(moduleConfig);
      }
    });
  }

  // Organizar por categorías
  const categoriesMap = {};
  
  Object.values(CATEGORIES).forEach(category => {
    categoriesMap[category.id] = {
      ...category,
      modules: []
    };
  });

  Array.from(availableModules).forEach(module => {
    const categoryId = module.category || 'SYSTEM';
    
    if (categoriesMap[categoryId]) {
      categoriesMap[categoryId].modules.push(module);
    }
  });

  Object.values(categoriesMap).forEach(category => {
    category.modules.sort((a, b) => a.order - b.order);
  });

  const organizedCategories = Object.values(categoriesMap)
    .filter(category => category.modules.length > 0)
    .sort((a, b) => a.order - b.order);

  return organizedCategories;
};

// 🔥 NUEVO: Obtener configuración de módulo por su ruta
export const getModuleByPath = (path) => {
  return Object.values(MODULE_DEFINITIONS).find(module => module.path === path);
};

// 🔥 NUEVO: Obtener todas las rutas disponibles
export const getAllModulePaths = () => {
  return Object.values(MODULE_DEFINITIONS).map(module => module.path);
};