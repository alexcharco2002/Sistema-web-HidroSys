// ============================================================================
// 🌐 UNIVERSAL DASHBOARD
// ============================================================================

// ============================================================================
// IMPORTACIONES BASE DE REACT Y ROUTER
// ============================================================================
import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';

// ============================================================================
// 🔐 SERVICIOS DE AUTENTICACIÓN Y USUARIO
// ============================================================================
import authService from '../services/authServices';
import userService from '../services/userServices';

// ============================================================================
// 🎨 ESTILOS DEL DASHBOARD
// ============================================================================
import './UniversalDashboard.css';

// ============================================================================
// 🧠 DEFINICIÓN DINÁMICA DE MÓDULOS
// ============================================================================
import { buildModulesFromPermissions, getModuleByPath } from '../utils/modulesDefinitions';
import ChangePasswordModal from '../components/ChangePasswordModal'; // Cambio de contraseña

// ============================================================================
// 🧩 COMPONENTES GENERALES (COMPARTIDOS POR TODOS LOS ROLES)
// ============================================================================
import HomeSection from '../sections/general/HomeSection';            // Inicio universal
import NotificationDropdown from '../sections/general/NotificationDropdown'; // Dropdown de notificaciones
import UserProfile from '../sections/general/UserProfile';            // Info del usuario
import ProfileSection from '../sections/general/ProfileSection';      // Perfil
import GeolocationSection from '../sections/general/GeolocationSection'; // Geolocalización
import NotificationsSection from '../sections/general/NotificationsSection'; // Historial notificaciones
import MiniMapaBurbuja from '../sections/general/MiniMapaBurbuja';    // Mini mapa visual

// ============================================================================
// 🛠️ COMPONENTES DE SECCIÓN - ADMINISTRADOR
// ============================================================================
import UsersSection from '../sections/administrador/UsersSection';          // Usuarios
import AffiliatesSection from '../sections/administrador/AffiliatesSection';// Afiliados
import MetersSection from '../sections/administrador/MetersSection';        //  Medidores
import FinesSection from '../sections/administrador/FinesSection';          //  Multas
import FinesAffiliatesSection from '../sections/administrador/FinesAffiliatesSection'; // Multas a afiliados
import InvoicesSection from '../sections/administrador/InvoicesSection';    //  Facturación
import RolesSection from '../sections/administrador/RolesSection';          // Roles
import SectorsSection from '../sections/administrador/SectorsSection';      // Sectores
import ConfigSection from '../sections/administrador/ConfigSection';        // Configuración
import ServiciosSection from '../sections/administrador/ServiciosSection';  // Servicios
import TarifasSection from '../sections/administrador/TarifasSection';      // Tarifas
import ReportsSection from '../sections/administrador/ReportsSection';      // Reportes

// ============================================================================
// 📋 COMPONENTES DE SECCIÓN - LECTOR
// ============================================================================
import ReadingsSection from '../sections/lector/ReadingsSection';

// ============================================================================
// 🧑‍🤝‍🧑 COMPONENTES DE SECCIÓN - AFILIADOS
// ============================================================================
import HistorialConsumos from '../sections/Affiliates/HistorialConsumos';     // 📈 Historial de consumo
import AffiliateBillingSection from '../sections/Affiliates/AffiliateBillingSection'; // 🧾 Facturación afiliado
import MiMedidorSection from '../sections/Affiliates/MiMedidorSection';

// ============================================================================
// 💰 COMPONENTES DE SECCIÓN - CAJERO
// ============================================================================
import PaymentsSection from '../sections/cajero/PaymentsSection';

// ============================================================================
// 🎨 ICONOS (LUCIDE)
// ============================================================================
import { 
  Activity, 
  RefreshCw,
  Shield,
  ChevronDown,
  ChevronRight,
  Menu, 
  ChevronLeft
} from 'lucide-react';

// ============================================================================
// 📦 MAPEO DE COMPONENTES
// ============================================================================

const COMPONENT_MAP = {
  UsersSection,
  ProfileSection,
  NotificationsSection,
  RolesSection,
  SectorsSection,
  AffiliatesSection,
  MetersSection,
  GeolocationSection,
  InvoicesSection,
  TarifasSection,
  ConfigSection,
  HomeSection,
  ServiciosSection,
  ReadingsSection,
  FinesSection,
  FinesAffiliatesSection ,
  HistorialConsumos,
  PaymentsSection,
  ReportsSection,
  AffiliateBillingSection,
  MiMedidorSection
};
 // ============================================================================
  // COMPONENTE: RENDERIZADOR DINÁMICO DE MÓDULOS
  // ============================================================================
  const DynamicModuleRenderer = ({ 
    modulePath, 
    user, 
    roleBasePath, 
    organizedModules, 
    dashboardStats, 
    dataLoading, 
    onRefresh, 
    onUpdateProfile, 
    notifications, 
    onMarkAsRead 
  }) => {
    const navigate = useNavigate(); // Usar hook aquí dentro

    // CASO ESPECIAL: HOME
    if (modulePath === 'home') {
      return (
        <HomeSection 
          user={user}
          stats={dashboardStats}
          dataLoading={dataLoading}
          onRefresh={onRefresh}
        />
      );
    }

    // Caso especial: Profile
    if (modulePath === 'profile') {
      return <ProfileSection user={user} onUpdateProfile={onUpdateProfile} />;
    }

    // Caso especial: Notifications
    if (modulePath === 'notifications') {
      return (
        <NotificationsSection 
          notifications={notifications}
          onMarkAsRead={onMarkAsRead}
        />
      );
    }

    // Buscar módulo en la configuración
    const moduleConfig = getModuleByPath(modulePath);
    
    if (!moduleConfig) {
      return (
        <div className="section-placeholder">
          <Activity className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h2>Módulo no encontrado</h2>
          <p>La ruta <code>/{modulePath}</code> no existe.</p>
          <button 
            onClick={() => navigate(`${roleBasePath}/home`)}
            className="btn-link mt-4"
          >
            Volver al inicio
          </button>
        </div>
      );
    }

    // Verificar si el usuario tiene acceso al módul
    const hasAccess = organizedModules && organizedModules
      .flatMap(cat => cat.modules)
      .some(mod => mod.path === modulePath);

    if (!hasAccess && !moduleConfig.alwaysVisible) {
      return (
        <div className="section-placeholder">
          <Shield className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h2>Acceso Denegado</h2>
          <p>No tienes permisos para acceder a este módulo.</p>
          <button 
            onClick={() => navigate(`${roleBasePath}/home`)}
            className="btn-link mt-4"
          >
            Volver al inicio
          </button>
        </div>
      );
    }

    // Renderizar componente dinámico
    const Component = COMPONENT_MAP[moduleConfig.componentName];
    
    if (Component) {
      return <Component user={user} />;
    }

    // Componente no implementado
    return (
      <div className="section-placeholder">
        <Activity className="w-16 h-16 mx-auto mb-4 text-gray-400" />
        <h2>{moduleConfig.label}</h2>
        <p>Componente en desarrollo.</p>
        <button 
          onClick={() => navigate(`${roleBasePath}/home`)}
          className="btn-link mt-4"
        >
          Volver al inicio
        </button>
      </div>
    );
  };

// ============================================================================
// 🎯 COMPONENTE PRINCIPAL
// ============================================================================
const UniversalDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [notifications] = useState([]);
  const [user, setUser] = useState(null);
  const [, setUserPermissions] = useState([]);
  const [organizedModules, setOrganizedModules] = useState([]);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [dashboardStats, setDashboardStats] = useState({});
  const [dataLoading, setDataLoading] = useState(true);
 
  
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false); // 🔥 NUEVO

const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

const toggleSidebar = () => {
  setSidebarCollapsed(!sidebarCollapsed);
};
  //  Obtener ruta base del rol actual
  const roleBasePath = authService.getRoleBasePath();

  const toggleSidebarMobile = () => {
    setSidebarMobileOpen(!sidebarMobileOpen);
  };

  //  Obtener ruta activa (relativa al dashboard)
  const getActivePath = useCallback(() => {
    const pathParts = location.pathname.split('/').filter(Boolean);

    // Si está en la raíz del rol o en /home, retornar 'home'
    if (pathParts.length <= 1 || pathParts[1] === 'home') {
      return 'home';
    }

    // Retornar la subruta actual
    return pathParts[1] || 'home';
  }, [location.pathname]);

  const currentPath = getActivePath();

  // ============================================================================
  // EFECTOS Y CARGA DE DATOS
  // ============================================================================
  
  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    
    if (!currentUser || !authService.isAuthenticated()) {
      navigate('/login');
      return;
    }

    setUser(currentUser);
    const permissions = authService.getUserPermissions();
    setUserPermissions(permissions);

    if (currentUser.primer_login === true || currentUser.primer_login === 1) {
      setShowChangePasswordModal(true);
    }
    
    const modules = buildModulesFromPermissions(permissions);
    setOrganizedModules(modules);
    
    const initialExpanded = {};
    modules.forEach(category => {
      initialExpanded[category.id] = category.defaultOpen !== false;
    });
    setExpandedCategories(initialExpanded);
    
    const verifySession = async () => {
      const result = await authService.verifySession();
      if (!result.success) {
        navigate('/login');
      }
    };

    verifySession();
  }, [navigate, roleBasePath]);

  // Mantener abierta la categoría donde está el módulo activo
  useEffect(() => {
    if (!organizedModules.length) return;

    const activePath = getActivePath();

    // Buscar la categoría que contiene el módulo activo
    const categoryFound = organizedModules.find(cat =>
      cat.modules.some(mod => mod.path === activePath)
    );

    if (categoryFound) {
      setExpandedCategories(prev => ({
        ...prev,
        [categoryFound.id]: true
      }));
    }
  }, [location.pathname, organizedModules, getActivePath]);

  // ============================================================================
  // CARGA DE DATOS SEGÚN ROL
  // ============================================================================
  const loadDashboardData = useCallback(async () => {
    try {
      setDataLoading(true);

      const mockStats = {
        administrador: {
          totalUsers: 156,
          activeUsers: 142,
          totalAffiliates: 89,
          totalMeters: 95,
          todayReadings: 28,
          pendingReadings: 12,
          completedReadings: 45,
          todayPayments: 15,
          totalAmount: '1,250',
          usersByRole: {
            administrador: 5,
            cliente: 89,
            lector: 8,
            cajero: 4
          }
        },
        lector: {
          todayReadings: 12,
          lecturasMes: 380,
          pendingReadings: 8,
          completedReadings: 45,
          rutas: 3
        },
        contador: {
          facturasMes: 320,
          pagosPendientes: 45,
          ingresosMes: 15420.50,
          cajas: 2
        },
        cajero: {
          todayPayments: 15,
          totalAmount: '2,340',
          transacciones: 28,
          cajaActual: 3450.00,
          pendientes: 12
        },
        cliente: {
          consumoMes: 45,
          ultimoPago: '15/11/2024',
          saldoPendiente: 0
        }
      };

      const roleName = user?.rol?.nombre_rol?.toLowerCase() || 'administrador';
      setDashboardStats(mockStats[roleName] || mockStats.administrador);

    } catch (error) {
      console.error('Error cargando datos del panel general:', error);
    } finally {
      setDataLoading(false);
    }
  }, [user]); 

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user, loadDashboardData]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleUpdateProfile = async (profileData) => {
    try {
      if (!user?.id_usuario_sistema) {
        throw new Error('No se encontró el ID del usuario');
      }

      const dataToUpdate = {
        nombres: profileData.nombres,
        apellidos: profileData.apellidos,
        sexo: profileData.sexo,
        fecha_nac: profileData.fecha_nac,
        email: profileData.email,
        telefono: profileData.telefono || null,
        direccion: profileData.direccion || null,
      };

      const result = await userService.updateUser(user.id_usuario_sistema, dataToUpdate);
      
      if (result.success) {
        setUser(prevUser => ({
          ...prevUser,
          ...result.data
        }));
        
        return { 
          success: true,
          message: 'Perfil actualizado correctamente'
        };
      } else {
        return { 
          success: false, 
          message: result.message || 'Error al actualizar el perfil'
        };
      }
      
    } catch (error) {
      console.error('❌ Error al actualizar perfil:', error);
      return { 
        success: false, 
        message: error.message || 'Error al actualizar el perfil'
      };
    }
  };

  const handleLogout = async () => {
    const confirmed = window.confirm("¿Seguro que deseas cerrar sesión?");
    if (!confirmed) return;

    // Logout y redirección
    await authService.logout();
    navigate('/login');
  };


  const handleMarkAsRead = (notificationId) => {
  };
  
  const handleViewAllNotifications = () => {
    navigate(`${roleBasePath}/notifications`);
    setExpandedCategories(prev => ({
      ...prev,
      SYSTEM: true
    }));
  };

  const handleProfileClick = () => {
    navigate(`${roleBasePath}/profile`);
  };

  const handleSettingsClick = () => {
    navigate(`${roleBasePath}/settings`);
  };

  const handleClosePasswordModal = () => {
    if (!user?.primer_login) {
      setShowChangePasswordModal(false);
    }
  };

  const handlePasswordChangeSuccess = async () => {
    setUser(prevUser => ({
      ...prevUser,
      primer_login: false
    }));

    const currentUser = authService.getCurrentUser();
    if (currentUser) {
      currentUser.primer_login = false;
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
    }

    setShowChangePasswordModal(false);
    await loadDashboardData();
  };

  const toggleCategory = (categoryId) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  //  Navegación entre módulos con ruta base dinámica
  const handleNavigateToModule = (modulePath) => {
    navigate(`${roleBasePath}/${modulePath}`);
  };

  const handleRefresh = async () => {
    await loadDashboardData();
  };

 
  // ============================================================================
  // RENDER LOADING
  // ============================================================================
  if (!user) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner">
          <RefreshCw className="w-8 h-8 animate-spin" />
          <p>Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER PRINCIPAL
  // ============================================================================
  return (
    <>
    <div className="dashboard">

      {/* SIDEBAR */}
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${sidebarMobileOpen ? 'mobile-open' : ''}`}>

        {/* Overlay para cerrar en móvil */}
        {sidebarMobileOpen && (
          <div
            className="sidebar-overlay"
            onClick={toggleSidebarMobile}
          />
        )}

        {/* Header del Sidebar */}
        <div className="sidebar-header">
          <div className="logo-container">
            <div className="logo-icon">
              <img
                src="/quality.ico"
                alt="HidroSys Logo"
                className="logo-img"
              />
            </div>

            {!sidebarCollapsed && (
              <div className="logo-text">
                <h2>HidroSys</h2>
                <p>JAAP Sanjapamba</p>
              </div>
            )}
          </div>

          {/* BOTÓN TOGGLE PARA COLAPSAR/EXPANDIR SIDEBAR MEJORADO */}
          <button
            className="sidebar-toggle-btn"
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? "Expandir menú" : "Contraer menú"}
            title={sidebarCollapsed ? "Expandir menú" : "Contraer menú"}
          >
            {sidebarCollapsed ? (
              <ChevronRight size={20} />
            ) : (
              <ChevronLeft size={20} />
            )}
          </button>
        </div>

        {/* Navegación */}
        <nav className="sidebar-nav">
          {/* CATEGORÍAS REALES DEL SISTEMA */}
          {organizedModules.map((category) => (
            <div key={category.id} className="nav-category">

              {/* Header */}
              {!sidebarCollapsed && (
                <button
                  className="category-header"
                  onClick={() => toggleCategory(category.id)}
                >
                  <div className="category-header-content">
                    <category.icon size={16} />
                    <span>{category.label}</span>
                    {expandedCategories[category.id] ? (
                      <ChevronDown size={16} />
                    ) : (
                      <ChevronRight size={16} />
                    )}
                  </div>
                </button>
              )}

              {/* Módulos */}
              {(expandedCategories[category.id] || sidebarCollapsed) && (
                <div className="category-modules">
                  {category.modules.map((module) => {
                    const ModuleIcon = module.icon;
                    const isActive = currentPath === module.path;

                    return (
                      <button
                        key={module.id}
                        className={`nav-item ${isActive ? 'active' : ''}`}
                        onClick={() => {
                          handleNavigateToModule(module.path);
                          if (window.innerWidth <= 1024) {
                            setSidebarMobileOpen(false);
                          }
                        }}
                        title={sidebarCollapsed ? module.label : ''}
                      >
                        <ModuleIcon size={20} />
                        {!sidebarCollapsed && <span>{module.label}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </nav>

      </aside>

      {/* MAIN CONTENT */}
      <main className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>

        {/* HEADER */}
        <header className="header">
          <div className="header-content">
            {/* 🔥 BOTÓN HAMBURGUESA MÓVIL */}
            <button 
              className="mobile-menu-toggle" 
              onClick={toggleSidebarMobile}
              aria-label="Toggle menu"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="header-title">
              <h1>Panel de {user?.rol?.nombre_rol || 'Usuario'}</h1>
              <p>Bienvenido 👋</p>
            </div>

            <div className="header-actions">

              <NotificationDropdown
                notifications={notifications}
                onMarkAsRead={handleMarkAsRead}
                onViewAll={handleViewAllNotifications}
              />

              <UserProfile
                user={user}
                onLogout={handleLogout}
                onViewProfile={handleProfileClick}
                onSettingsClick={handleSettingsClick}
                onNotificationsClick={handleViewAllNotifications}
              />
            </div>
          </div>
        </header>

        {/* CONTENIDO */}
       <div className="content">
        <Routes>
          <Route path="/" element={<Navigate to="home" replace />} />

          {/* Pasar todas las props necesarias */}
          <Route path="home" element={
            <DynamicModuleRenderer 
              modulePath="home" 
              user={user}
              roleBasePath={roleBasePath}
              organizedModules={organizedModules}
              dashboardStats={dashboardStats}
              dataLoading={dataLoading}
              onRefresh={handleRefresh}
            />
          } />
          
          <Route path="profile" element={
            <DynamicModuleRenderer 
              modulePath="profile" 
              user={user}
              roleBasePath={roleBasePath}
              onUpdateProfile={handleUpdateProfile}
            />
          } />
          
          <Route path="notifications" element={
            <DynamicModuleRenderer 
              modulePath="notifications" 
              user={user}
              roleBasePath={roleBasePath}
              notifications={notifications}
              onMarkAsRead={handleMarkAsRead}
            />
          } />

          {/* Rutas dinámicas de módulos */}
          {organizedModules.flatMap(category =>
            category.modules.map(module => (
              <Route
                key={module.path}
                path={module.path}
                element={
                  <DynamicModuleRenderer 
                    modulePath={module.path}
                    user={user}
                    roleBasePath={roleBasePath}
                    organizedModules={organizedModules}
                    // Pasa otras props si los componentes internos las necesitan
                  />
                }
              />
            ))
          )}

          <Route path="*" element={<Navigate to="home" replace />} />
        </Routes>
          
          {/* 🔥 FOOTER  */}
          <footer className="dashboard-footer">
            <div className="footer-bottom">
              <p>© 2025 HidroSys. Todos los derechos reservados.</p>
            </div>
          </footer>
        </div>
        
      </main>

      {/* 🔐 MODAL DE CAMBIO DE CONTRASEÑA */}
      {user && (
        <ChangePasswordModal
          isOpen={showChangePasswordModal}
          onClose={handleClosePasswordModal}
          userId={user.id_usuario_sistema}
          username={user.usuario}
          userEmail={user.email}
          isPrimerLogin={user.primer_login === true || user.primer_login === 1}
          onSuccess={handlePasswordChangeSuccess}
        />
      )}

    </div>
    {/* MINI-MAPA */}
    {!location.pathname.includes('geolocation') && <MiniMapaBurbuja />}
    </>
  );

};

export default UniversalDashboard;
