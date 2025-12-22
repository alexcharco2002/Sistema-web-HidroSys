// src/pages/UniversalDashboard.js
import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';

import authService from '../services/authServices';
import userService from '../services/userServices';

// Estilos
import './UniversalDashboard.css';

// Importar configuración de módulos
import { buildModulesFromPermissions, getModuleByPath } from '../utils/modulesDefinitions';

// Componentes compartidos
import NotificationDropdown from '../sections/NotificationDropdown';
import UserProfile from '../sections/UserProfile';
import ChangePasswordModal from '../sections/ChangePasswordModal';
import ProfileSection from '../sections/ProfileSection';
import NotificationsSection from '../sections/NotificationsSection';
import HomeSection from '../sections/HomeSection'; //  COMPONENTE HOME UNIVERSAL

// Componentes de secciones
import UsersSection from '../sections/UsersSection';
import RolesSection from '../sections/RolesSection';
import SectorsSection from '../sections/SectorsSection';
import AffiliatesSection from '../sections/AffiliatesSection';
import MetersSection from '../sections/MetersSection';
import GeolocationSection from '../sections/GeolocationSection';
import InvoicesSection from '../sections/InvoicesSection';
import TarifasSection from '../sections/TarifasSection';
import ConfigSection from '../sections/ConfigSection';
import ServiciosSection from '../sections/ServiciosSection';
import ReadingsSection from '../sections/ReadingsSection';
import FinesSection from '../sections/FinesSection';
import FinesAffiliatesSection from '../sections/FinesAffiliatesSection';  
import HistorialConsumos from '../sections/HistorialConsumos';
import PaymentsSection from '../sections/PaymentsSection';

import MiniMapaBurbuja from '../sections/MiniMapaBurbuja'; 

// Iconos
import { 
  Activity, 
  Droplets,
  RefreshCw,
  Shield,
  ChevronDown,
  ChevronRight,
  Menu, 
  X, 
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
  PaymentsSection
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

    // Verificar si el usuario tiene acceso al módulo
    // Asegúrate de que organizedModules esté definido y sea un array
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
  const [loading] = useState(false);
  const [user, setUser] = useState(null);
  const [userPermissions, setUserPermissions] = useState([]);
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
      console.log('❌ Usuario no autenticado');
      navigate('/login');
      return;
    }

    setUser(currentUser);
    const permissions = authService.getUserPermissions();
    setUserPermissions(permissions);

    if (currentUser.primer_login === true || currentUser.primer_login === 1) {
      console.log('🔐 Primer login detectado');
      setShowChangePasswordModal(true);
    }
    
    const modules = buildModulesFromPermissions(permissions);
    setOrganizedModules(modules);
    
    const initialExpanded = {};
    modules.forEach(category => {
      initialExpanded[category.id] = category.defaultOpen !== false;
    });
    setExpandedCategories(initialExpanded);
    
    console.log('✅ Dashboard cargado:', {
      usuario: currentUser.nombres,
      rol: currentUser.rol?.nombre_rol,
      rolePath: roleBasePath,
      permisos: permissions.length,
      categorias: modules.length
    });

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

      //  Aquí puedes cargar datos reales desde tu API
      // Por ahora uso datos de ejemplo
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

      //  Si tienes permisos para ver usuarios, cargar datos reales
      if (authService.hasPermission('usuarios', 'lectura')) {
        try {
          const result = await userService.getUsers({ limit: 1000 });
          
          if (result.success) {
            const usersData = Array.isArray(result.data) 
              ? result.data 
              : result.data.usuarios || [];

            const totalUsers = usersData.length;
            const activeUsers = usersData.filter(u => u.activo).length;
            const inactiveUsers = totalUsers - activeUsers;

            const usersByRole = usersData.reduce((acc, user) => {
              const rol = user.rol?.nombre_rol.toLowerCase() || 'sin_rol';
              acc[rol] = (acc[rol] || 0) + 1;
              return acc;
            }, {
              administrador: 0,
              cliente: 0,
              lector: 0,
              cajero: 0
            });

            setDashboardStats(prev => ({
              ...prev,
              totalUsers,
              activeUsers,
              inactiveUsers,
              usersByRole
            }));
          }
        } catch (error) {
          console.error('Error cargando usuarios:', error);
        }
      }

    } catch (error) {
      console.error('❌ Error cargando datos:', error);
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
    console.log('Marcar como leída:', notificationId);
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
    console.log('✅ Contraseña cambiada exitosamente');
    
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

      {/* 🔥 BOTÓN HAMBURGUESA MÓVIL */}
      <button
        className="mobile-menu-toggle"
        onClick={toggleSidebarMobile}
        aria-label="Abrir menú"
      >
        <Menu size={24} />
      </button>

      {/* SIDEBAR */}
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${sidebarMobileOpen ? 'mobile-open' : ''}`}>

        {/* Overlay para cerrar en móvil */}
        {sidebarMobileOpen && (
          <div
            className="sidebar-overlay"
            onClick={toggleSidebarMobile}
          />
        )}
        {/* 🔥 Botón cerrar móvil */}
        <button 
          className="sidebar-close-btn-mobile" 
          onClick={toggleSidebarMobile}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header del Sidebar */}
        <div className="sidebar-header">
          <div className="logo-container">
            <div className="logo-icon">
              <Droplets className="text-white" size={32} />
            </div>

            {!sidebarCollapsed && (
              <div className="logo-text">
                <h2>TecniCobro</h2>
                <p>JAAP Sanjapamba</p>
              </div>
            )}
          </div>

          {/* 🔥 BOTÓN TOGGLE PARA COLAPSAR/EXPANDIR SIDEBAR */}
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

          <button
            className="sidebar-close-btn-mobile"
            onClick={toggleSidebarMobile}
            aria-label="Cerrar menú"
          >
            <X size={24} />
          </button>
          {/* 🔥 CATEGORÍAS REALES DEL SISTEMA */}
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


        {/* Footer del Sidebar */}
        {!sidebarCollapsed && (
          <div className="sidebar-footer">
            <div className="user-permissions-info">
              <Shield size={16} />
              <span>{userPermissions.length} permisos activos</span>
            </div>
          </div>
        )}
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
              <p>Bienvenido 👋, {user.nombres} {user.apellidos}</p>
            </div>

            <div className="header-actions">
              <button
                className={`refresh-btn ${loading ? 'loading' : ''}`}
                onClick={handleRefresh}
                disabled={loading}
                title="Actualizar datos"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>

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
                    modulePath={module.path}zz
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
              <p>© 2025 TecniCobro. Todos los derechos reservados.</p>
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
          userEmail={user.email}
          isPrimerLogin={user.primer_login === true || user.primer_login === 1}
          onSuccess={handlePasswordChangeSuccess}
        />
      )}

    </div>
    <MiniMapaBurbuja />
    </>
  );

};

export default UniversalDashboard;