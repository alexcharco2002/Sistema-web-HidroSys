// src/components/HomeSection.js
// Página de Inicio Universal adaptada al estilo del sistema
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './HomeSection.css';
import authService from '../services/authServices';



import { 
  Users, UserPlus, Shield, Settings, Bell, 
  FileText, DollarSign, Activity, Map, Edit, 
  Plus, Clock, AlertCircle, CheckCircle,
  BarChart3, Download, Search, Grid, List, Home, Droplets, Package,
  RefreshCw
} from 'lucide-react';

// ============================================================================
// CONFIGURACIÓN DE PÁGINA DE INICIO POR ROL
// ============================================================================
export const homePageConfig = {
  administrador: {
    welcomeMessage: '¡Bienvenido de nuevo!',
    subtitle: 'Panel de Administración del Sistema',
    primaryActions: [
      {
        id: 'create-user',
        label: 'Crear Usuario',
        icon: UserPlus,
        color: 'blue',
        description: 'Agregar nuevo usuario al sistema',
        requiredPermission: { module: 'usuarios', action: 'crear' },
        modulePath: 'users', // 🔥 Usa la ruta del módulo
        action: 'navigate'
      },
      {
        id: 'manage-roles',
        label: 'Gestionar Roles',
        icon: Shield,
        color: 'purple',
        description: 'Administrar roles y permisos',
        requiredPermission: { module: 'roles', action: 'lectura' },
        modulePath: 'roles', // 🔥 Usa la ruta del módulo
        action: 'navigate'
      },
      {
        id: 'view-affiliates',
        label: 'Ver Afiliados',
        icon: Users,
        color: 'green',
        description: 'Gestionar información de afiliados',
        requiredPermission: { module: 'afiliados', action: 'lectura' },
        modulePath: 'affiliates', // 🔥 Usa la ruta del módulo
        action: 'navigate'
      },
      {
        id: 'system-config',
        label: 'Configuración',
        icon: Settings,
        color: 'orange',
        description: 'Configurar parámetros del sistema',
        requiredPermission: { module: 'configuracion', action: 'lectura' },
        modulePath: 'settings', // 🔥 Usa la ruta del módulo
        action: 'navigate'
      }
    ],
    quickLinks: [
      { label: 'Usuarios del Sistema', icon: Users, modulePath: 'users' },
      { label: 'Sectores', icon: Map, modulePath: 'sectors' },
      { label: 'Medidores', icon: Activity, modulePath: 'meters' },
      { label: 'Tarifas', icon: DollarSign, modulePath: 'rates' },
      { label: 'Geolocalización', icon: Map, modulePath: 'geolocation' },
      { label: 'Reportes', icon: FileText, modulePath: 'reports' }
    ],
    showStats: true
  },
  
  cliente: {
    welcomeMessage: '¡Hola!',
    subtitle: 'Portal del Cliente',
    primaryActions: [
      {
        id: 'view-consumption',
        label: 'Mi Consumo',
        icon: Activity,
        color: 'blue',
        description: 'Consultar consumo de agua del mes',
        modulePath: 'meters', // 🔥 Usa la ruta del módulo
        action: 'navigate'
      },
      {
        id: 'pay-bill',
        label: 'Pagar Factura',
        icon: DollarSign,
        color: 'green',
        description: 'Realizar pago de mi factura',
        modulePath: 'payments', // 🔥 Usa la ruta del módulo
        action: 'navigate'
      },
      {
        id: 'view-history',
        label: 'Historial de Pagos',
        icon: Clock,
        color: 'purple',
        description: 'Ver historial de mis pagos',
        modulePath: 'payments', // 🔥 Usa la ruta del módulo
        action: 'navigate'
      },
      {
        id: 'report-issue',
        label: 'Reportar Problema',
        icon: AlertCircle,
        color: 'red',
        description: 'Reportar una avería o problema',
        modulePath: 'reports', // 🔥 Usa la ruta del módulo
        action: 'navigate'
      }
    ],
    quickLinks: [
      { label: 'Mi Perfil', icon: Edit, modulePath: 'profile' },
      { label: 'Mis Notificaciones', icon: Bell, modulePath: 'notifications' },
      { label: 'Descargar Factura', icon: Download, modulePath: 'invoices' },
      { label: 'Reportes', icon: AlertCircle, modulePath: 'reports' }
    ],
    showStats: false
  },
  
  lector: {
    welcomeMessage: '¡Listo para trabajar!',
    subtitle: 'Panel del Lector de Medidores',
    primaryActions: [
      {
        id: 'record-reading',
        label: 'Nueva Lectura',
        icon: Plus,
        color: 'blue',
        description: 'Registrar lectura de medidor',
        requiredPermission: { module: 'lecturas', action: 'crear' },
        modulePath: 'readings', // 🔥 Usa la ruta del módulo
        action: 'navigate'
      },
      {
        id: 'view-route',
        label: 'Mi Ruta',
        icon: Map,
        color: 'green',
        description: 'Ver ruta de lecturas asignada',
        modulePath: 'geolocation', // 🔥 Usa la ruta del módulo
        action: 'navigate'
      },
      {
        id: 'pending-readings',
        label: 'Lecturas Pendientes',
        icon: Clock,
        color: 'orange',
        description: 'Ver lecturas pendientes del día',
        modulePath: 'meters', // 🔥 Usa la ruta del módulo
        action: 'navigate'
      },
      {
        id: 'reading-history',
        label: 'Mis Lecturas',
        icon: FileText,
        color: 'purple',
        description: 'Historial de lecturas realizadas',
        modulePath: 'readings', // 🔥 Usa la ruta del módulo
        action: 'navigate'
      }
    ],
    quickLinks: [
      { label: 'Todos los Medidores', icon: Activity, modulePath: 'meters' },
      { label: 'Reportar Anomalía', icon: AlertCircle, modulePath: 'reports' },
      { label: 'Mi Perfil', icon: Edit, modulePath: 'profile' },
      { label: 'Notificaciones', icon: Bell, modulePath: 'notifications' }
    ],
    showStats: true
  },
  
  cajero: {
    welcomeMessage: '¡Buenos días!',
    subtitle: 'Sistema de Caja y Pagos',
    primaryActions: [
      {
        id: 'new-payment',
        label: 'Registrar Pago',
        icon: DollarSign,
        color: 'green',
        description: 'Registrar nuevo pago de cliente',
        requiredPermission: { module: 'pagos', action: 'crear' },
        modulePath: 'payments', // 🔥 Usa la ruta del módulo
        action: 'navigate'
      },
      {
        id: 'search-client',
        label: 'Buscar Cliente',
        icon: Search,
        color: 'blue',
        description: 'Buscar cliente por cédula o código',
        modulePath: 'affiliates', // 🔥 Usa la ruta del módulo
        action: 'navigate'
      },
      {
        id: 'daily-cash',
        label: 'Caja del Día',
        icon: BarChart3,
        color: 'purple',
        description: 'Ver resumen de caja actual',
        modulePath: 'cashboxes', // 🔥 Usa la ruta del módulo
        action: 'navigate'
      },
      {
        id: 'print-receipt',
        label: 'Imprimir Recibo',
        icon: FileText,
        color: 'orange',
        description: 'Reimprimir último recibo',
        action: 'function',
        target: 'handlePrintReceipt'
      }
    ],
    quickLinks: [
      { label: 'Historial de Pagos', icon: Clock, modulePath: 'payments' },
      { label: 'Cajas', icon: CheckCircle, modulePath: 'cashboxes' },
      { label: 'Reportes', icon: FileText, modulePath: 'reports' },
      { label: 'Mi Perfil', icon: Edit, modulePath: 'profile' }
    ],
    showStats: true
  },
  
  default: {
    welcomeMessage: '¡Bienvenido!',
    subtitle: 'Panel de Usuario',
    primaryActions: [
      {
        id: 'view-dashboard',
        label: 'Ver Dashboard',
        icon: Grid,
        color: 'blue',
        description: 'Acceder al panel principal',
        modulePath: 'home', // 🔥 Usa la ruta del módulo
        action: 'navigate'
      },
      {
        id: 'my-profile',
        label: 'Mi Perfil',
        icon: Users,
        color: 'purple',
        description: 'Ver y editar mi información',
        modulePath: 'profile', // 🔥 Usa la ruta del módulo
        action: 'navigate'
      },
      {
        id: 'notifications',
        label: 'Notificaciones',
        icon: Bell,
        color: 'orange',
        description: 'Ver mis notificaciones',
        modulePath: 'notifications', // 🔥 Usa la ruta del módulo
        action: 'navigate'
      },
      {
        id: 'help',
        label: 'Ayuda',
        icon: AlertCircle,
        color: 'cyan',
        description: 'Centro de ayuda y soporte',
        modulePath: 'reports', // 🔥 Usa la ruta del módulo (puedes cambiar esto si tienes un módulo de ayuda)
        action: 'navigate'
      }
    ],
    quickLinks: [
      { label: 'Mi Perfil', icon: Edit, modulePath: 'profile' },
      { label: 'Notificaciones', icon: Bell, modulePath: 'notifications' }
    ],
    showStats: false
  }
};

// ============================================================================
// COMPONENTE PRINCIPAL: HomeSection
// ============================================================================
const HomeSection = ({ user, stats, dataLoading }) => {
  const navigate = useNavigate();
  const [layout, setLayout] = useState('grid');
  const [loading, setLoading] = useState(true);

  // Obtener rol y configuración
  const userRole = user?.rol?.nombre_rol?.toLowerCase() || 'default';
  const config = homePageConfig[userRole] || homePageConfig.default;

  // Obtener saludo según hora
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Buenos días' : currentHour < 18 ? 'Buenas tardes' : 'Buenas noches';

  useEffect(() => {
    // Simular carga inicial
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  // Filtrar acciones según permisos
  const filterByPermissions = (actions) => {
    return actions.filter(action => {
      if (!action.requiredPermission) return true;
      return authService.hasPermission(
        action.requiredPermission.module,
        action.requiredPermission.action
      );
    });
  };

  const filteredActions = filterByPermissions(config.primaryActions);

  // Handler para ejecutar acciones
  const handleActionClick = (action) => {
    console.log('🎯 Acción ejecutada:', action.label);
    
    switch (action.action) {
      case 'navigate':
        if (action.modulePath) {
          // 🔥 Navegar usando la ruta del módulo desde MODULE_DEFINITIONS
          const targetPath = `/administrador/${action.modulePath}`;
          console.log('📍 Navegando a:', targetPath);
          navigate(targetPath);
        }
        break;
      case 'modal':
        console.log('📋 Abriendo modal:', action.target);
        break;
      case 'function':
        console.log('⚡ Ejecutando función:', action.target);
        if (action.target === 'handlePrintReceipt') {
          alert('Imprimiendo recibo...');
        }
        break;
      default:
        console.log('Acción no definida');
    }
  };

  // Estadísticas específicas por rol
  const getRoleStats = () => {
    switch (userRole) {
      case 'administrador':
        return [
          { title: 'Total Usuarios', value: stats?.totalUsers || 0, icon: Users, color: 'blue' },
          { title: 'Usuarios Activos', value: stats?.activeUsers || 0, icon: Activity, color: 'green' },
          { title: 'Afiliados', value: stats?.totalAffiliates || 0, icon: Droplets, color: 'purple' },
          { title: 'Medidores', value: stats?.totalMeters || 0, icon: Activity, color: 'orange' }
        ];
      case 'lector':
        return [
          { title: 'Lecturas Hoy', value: stats?.todayReadings || 0, icon: Activity, color: 'blue' },
          { title: 'Pendientes', value: stats?.pendingReadings || 12, icon: Clock, color: 'orange' },
          { title: 'Completadas', value: stats?.completedReadings || 45, icon: CheckCircle, color: 'green' }
        ];
      case 'cajero':
        return [
          { title: 'Pagos Hoy', value: stats?.todayPayments || 15, icon: DollarSign, color: 'green' },
          { title: 'Total Recaudado', value: `$${stats?.totalAmount || '1,250'}`, icon: BarChart3, color: 'blue' },
          { title: 'Última Transacción', value: '10:45 AM', icon: Clock, color: 'purple' }
        ];
      default:
        return [];
    }
  };

  const roleStats = getRoleStats();

  if (loading) {
    return (
      <div className="section-placeholder">
        <RefreshCw className="w-16 h-16 mx-auto mb-4 text-gray-400 animate-spin" />
        <h2>Cargando Panel de Inicio</h2>
        <p>Por favor espera mientras cargamos la información...</p>
      </div>
    );
  }

  return (
    <div className="users-section">
      {/* HEADER CON BIENVENIDA */}
      <div className="section-header">
        <div className="section-title">
          <Home className="w-6 h-6 text-blue-600" />
          <div>
            <h2>{greeting}, {user.nombres}</h2>
            <p className="subtitle">{config.subtitle}</p>
          </div>
        </div>
        <div className="actions">
          <button
            onClick={() => setLayout('grid')}
            className={`btn-secondary ${layout === 'grid' ? 'active' : ''}`}
            title="Vista en cuadrícula"
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setLayout('list')}
            className={`btn-secondary ${layout === 'list' ? 'active' : ''}`}
            title="Vista en lista"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ESTADÍSTICAS (si aplica al rol) */}
      {config.showStats && roleStats.length > 0 && (
        <div className="users-stats">
          {roleStats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div key={index} className="stat-item">
                <Icon className={`stat-icon text-${stat.color}-600`} />
                <div>
                  <p className="stat-label">{stat.title}</p>
                  <p className="stat-value">{stat.value}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ACCIONES PRINCIPALES */}
      <div className={`home-actions-${layout}`}>
        {filteredActions.map(action => {
          const Icon = action.icon;
          return layout === 'grid' ? (
            <div 
              key={action.id} 
              className={`user-card action-card-home ${action.color}`}
              onClick={() => handleActionClick(action)}
            >
              <div className="user-card-header">
                <div className="user-info">
                  <div className={`action-icon-wrapper bg-${action.color}-50`}>
                    <Icon className={`w-6 h-6 text-${action.color}-600`} />
                  </div>
                  <div>
                    <h3 className="user-name">{action.label}</h3>
                    <p className="action-description">{action.description}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div 
              key={action.id} 
              className={`action-list-item-home ${action.color}`}
              onClick={() => handleActionClick(action)}
            >
              <div className={`action-list-icon bg-${action.color}-50`}>
                <Icon className={`w-5 h-5 text-${action.color}-600`} />
              </div>
              <div className="action-list-content">
                <span className="action-list-label">{action.label}</span>
                <span className="action-list-description">{action.description}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ENLACES RÁPIDOS */}
      {config.quickLinks && config.quickLinks.length > 0 && (
        <div className="quick-links-section">
          <div className="quick-links-header">
            <h3>Accesos Rápidos</h3>
            <Package className="w-5 h-5 text-gray-400" />
          </div>
          <div className="quick-links-grid">
            {config.quickLinks.map((link, index) => {
              const Icon = link.icon;
              return (
                <button
                  key={index}
                  onClick={() => {
                    if (link.modulePath) {
                      // 🔥 Navegar usando la ruta del módulo
                      const targetPath = `/administrador/${link.modulePath}`;

                      console.log('📍 Enlace rápido - Navegando a:', targetPath);
                      navigate(targetPath);
                    }
                  }}
                  className="quick-link-item"
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default HomeSection;