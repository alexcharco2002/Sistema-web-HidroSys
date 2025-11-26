// src/pages/admin/Dashboard.js
// Dashboard con Rutas Anidadas y Modal de Cambio de Contraseña para Primer Login
import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import authService from '../../services/authServices';
import userService from '../../services/userServices';

// Importar configuración de módulos
import { buildModulesFromPermissions } from '../../utils/modulesDefinitions';

// Componentes
import NotificationDropdown from '../../components/NotificationDropdown';
import UserProfile from '../../components/UserProfile';
import UsersSection from '../../components/UsersSection';
import ProfileSection from '../../components/ProfileSection';
import RolesSection from '../../components/RolesSection'; 
import SectorsSection from '../../components/SectorsSection';
import ChangePasswordModal from '../../components/ChangePasswordModal';
import NotificationsSection from '../../components/NotificationsSection';
import AffiliatesSection from '../../components/AffiliatesSection';
import MetersSection from '../../components/MetersSection';
import ConfigSection from '../../components/ConfigSection';
import TarifasSection from '../../components/TarifasSection';
import GeolocationSection from '../../components/GeolocationSection';

// Estilos
import './style.css';

// Iconos
import { 
  Search, RefreshCw, AlertCircle, TrendingUp,
  ChevronDown, ChevronRight, Droplets,
  Users, DollarSign, Activity, Shield
} from 'lucide-react';


// ============================================================================
// COMPONENTE: Overview Section (Dashboard Principal)
// ============================================================================
const OverviewSection = ({ user, stats, dataLoading, dataError, canViewUserStats, statCards, handleRefresh, organizedModules, setActiveSection }) => {
  const navigate = useNavigate();

  return (
    <div>
      {/* Error Message */}
      {dataError && (
        <div className="error-banner">
          <AlertCircle className="w-5 h-5" />
          <span>{dataError}</span>
          <button onClick={handleRefresh} className="btn-link">
            Reintentar
          </button>
        </div>
      )}

      {/* Stats Grid - Solo si tiene permisos */}
      {canViewUserStats && statCards.length > 0 && (
        <div className="stats-grid">
          {statCards.map((stat, index) => (
            <StatCard key={index} stat={stat} />
          ))}
        </div>
      )}

      {/* Mensaje si no tiene permisos para ver estadísticas */}
      {!canViewUserStats && (
        <div className="info-banner">
          <AlertCircle className="w-5 h-5" />
          <span>Bienvenido al sistema. Usa el menú lateral para acceder a tus módulos disponibles.</span>
        </div>
      )}

      {/* Content Grid */}
      <div className="content-grid">
        {/* Distribución de Usuarios - Solo si tiene permisos */}
        {canViewUserStats && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Usuarios por Rol</h3>
              {authService.hasPermission('usuarios', 'leer') && (
                <button className="btn-link" onClick={() => navigate('/admin/dashboard/users')}>
                  Ver todos
                </button>
              )}
            </div>
            <div className="role-distribution">
              {dataLoading ? (
                <div className="loading-state">
                  <RefreshCw className="w-6 h-6 animate-spin" />
                  <p>Cargando datos...</p>
                </div>
              ) : (
                <div className="role-stats-list">
                  <div className="role-stat-item">
                    <div className="role-stat-label">
                      <Shield className="w-4 h-4 text-red-500" />
                      <span>Administradores</span>
                    </div>
                    <span className="role-stat-value">{stats.usersByRole.administrador || 0}</span>
                  </div>
                  <div className="role-stat-item">
                    <div className="role-stat-label">
                      <Users className="w-4 h-4 text-blue-500" />
                      <span>Clientes</span>
                    </div>
                    <span className="role-stat-value">{stats.usersByRole.cliente || 0}</span>
                  </div>
                  <div className="role-stat-item">
                    <div className="role-stat-label">
                      <Activity className="w-4 h-4 text-green-500" />
                      <span>Lectores</span>
                    </div>
                    <span className="role-stat-value">{stats.usersByRole.lector || 0}</span>
                  </div>
                  <div className="role-stat-item">
                    <div className="role-stat-label">
                      <DollarSign className="w-4 h-4 text-yellow-500" />
                      <span>Cajeros</span>
                    </div>
                    <span className="role-stat-value">{stats.usersByRole.cajero || 0}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Resumen de Módulos Disponibles */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Módulos Disponibles</h3>
          </div>
          <div className="modules-summary">
            {organizedModules.map(category => (
              <div key={category.id} className="module-category-summary">
                <div className="category-summary-header">
                  <category.icon className="w-4 h-4" />
                  <span>{category.label}</span>
                  <span className="module-count">{category.modules.length}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// COMPONENTE: StatCard
// ============================================================================
const StatCard = ({ stat }) => {
  const IconComponent = stat.icon;
  const TrendIcon = TrendingUp;
  
  return (
    <div className="stat-card">
      <div className="stat-card-content">
        <div className="stat-info">
          <p className="stat-title">{stat.title}</p>
          <p className="stat-value">{stat.value}</p>
          <div className="stat-change">
            <TrendIcon className={`stat-trend-icon ${stat.trend === 'up' ? 'trend-up' : 'trend-down'}`} />
            <span className={`stat-change-text ${stat.trend === 'up' ? 'change-positive' : 'change-negative'}`}>
              {stat.change} vs mes anterior
            </span>
          </div>
        </div>
        <div className={`stat-icon-wrapper bg-${stat.color}`}>
          <IconComponent className={`stat-icon text-${stat.color}`} />
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// COMPONENTE PRINCIPAL: AdminDashboard
// ============================================================================
const AdminDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [notifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [userPermissions, setUserPermissions] = useState([]);
  const [organizedModules, setOrganizedModules] = useState([]);
  const [expandedCategories, setExpandedCategories] = useState({});
  
  // Estados para el modal de cambio de contraseña
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    inactiveUsers: 0,
    usersByRole: {
      administrador: 0,
      cliente: 0,
      lector: 0,
      cajero: 0
    }
  });
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState(null);

  // ============================================================================
  // 🔥 Obtener la sección actual desde la URL
  // ============================================================================
  const getCurrentSection = () => {
    const paths = location.pathname.split('/');
    return paths[paths.length - 1] || 'home';
  };

  const currentSection = getCurrentSection();

  // ============================================================================
  // EFECTOS Y CARGA DE DATOS
  // ============================================================================
  
  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    
    if (!currentUser || !authService.isAuthenticated()) {
      console.log('Usuario no autenticado, redirigiendo al login');
      navigate('/login');
      return;
    }

    setUser(currentUser);
    const permissions = authService.getUserPermissions();
    setUserPermissions(permissions);

    // 🔥 VERIFICAR SI ES PRIMER LOGIN Y MOSTRAR MODAL
    if (currentUser.primer_login === true || currentUser.primer_login === 1) {
      console.log('🟢 Es el primer login, mostrando modal de cambio de contraseña');
      setShowChangePasswordModal(true);
    }
    
    // Construir módulos organizados por categorías
    const modules = buildModulesFromPermissions(permissions);
    setOrganizedModules(modules);
    
    // Inicializar categorías expandidas
    const initialExpanded = {};
    modules.forEach(category => {
      initialExpanded[category.id] = category.defaultOpen !== false;
    });
    setExpandedCategories(initialExpanded);
    
    console.log('✅ Usuario autenticado:', {
      nombre: currentUser.nombres,
      rol: currentUser.rol?.nombre_rol,
      permisos: permissions.length,
      categorias: modules.length,
      primer_login: currentUser.primer_login
    });

    // Verificar sesión
    const verifySession = async () => {
      const result = await authService.verifySession();
      if (!result.success) {
        console.log('Sesión inválida, redirigiendo al login');
        navigate('/login');
      }
    };

    verifySession();
  }, [navigate]);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);
  
  useEffect(() => {
  if (!organizedModules.length) return;

  // Detectar qué módulo está activo según URL
  const paths = location.pathname.split('/');
  const current = paths[paths.length - 1];

  // Buscar en qué categoría se encuentra este módulo
  const categoryFound = organizedModules.find(cat =>
    cat.modules.some(mod => mod.id === current)
  );

  // Abrir automáticamente la categoría
  if (categoryFound) {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryFound.id]: true
    }));
  }
}, [location.pathname, organizedModules]);


  const loadDashboardData = async () => {
    try {
      setDataLoading(true);
      setDataError(null);

      if (authService.hasPermission('usuarios', 'lectura')) {
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

          setStats({
            totalUsers,
            activeUsers,
            inactiveUsers,
            usersByRole
          });
        }
      }
    } catch (error) {
      console.error('Error cargando datos del dashboard:', error);
      setDataError('Error al cargar datos del dashboard');
    } finally {
      setDataLoading(false);
    }
  };

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleLogout = async () => {
    if (window.confirm('¿Estás seguro de que deseas cerrar sesión?')) {
      try {
        await authService.logout();
        navigate('/login');
      } catch (error) {
        console.error('Error en logout:', error);
        navigate('/login');
      }
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    await loadDashboardData();
    setLoading(false);
  };

  const handleMarkAsRead = (notificationId) => {
    console.log('Marcar como leída:', notificationId);
  };

  const handleViewAllNotifications = () => {
    navigate('/admin/dashboard/notifications');
    setExpandedCategories(prev => ({
      ...prev,
      SYSTEM: true
    }));
  };

  const handleSettingsClick = () => {
    navigate('/admin/dashboard/settings');
  };

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

  // 🔥 HANDLER PARA CERRAR EL MODAL DE CAMBIO DE CONTRASEÑA
  const handleClosePasswordModal = () => {
    if (!user?.primer_login) {
      setShowChangePasswordModal(false);
    }
  };

  // 🔥 HANDLER PARA ÉXITO EN CAMBIO DE CONTRASEÑA
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

  // 🔥 NAVEGAR A UNA SECCIÓN POR URL
  const navigateToSection = (moduleId) => {
    navigate(`/admin/dashboard/${moduleId}`);

    // Abrir la categoría a la que pertenece
  const categoryFound = organizedModules.find(cat =>
    cat.modules.some(m => m.id === moduleId)
  );

  if (categoryFound) {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryFound.id]: true
    }));
  }
  };

  const calculatePercentageChange = (current, previous = 0) => {
    if (previous === 0) return '+100%';
    const change = ((current - previous) / previous) * 100;
    return change >= 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;
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

  // Verificar si tiene acceso a estadísticas de usuarios
  const canViewUserStats = authService.hasPermission('usuarios', 'lectura');

  // Tarjetas de estadísticas (solo si tiene permisos)
  const statCards = canViewUserStats ? [
    { 
      title: 'Total Usuarios', 
      value: dataLoading ? '...' : stats.totalUsers.toString(), 
      change: calculatePercentageChange(stats.totalUsers), 
      color: 'blue',
      icon: Users,
      trend: 'up'
    },
    { 
      title: 'Usuarios Activos', 
      value: dataLoading ? '...' : stats.activeUsers.toString(), 
      change: calculatePercentageChange(stats.activeUsers), 
      color: 'green',
      icon: Activity,
      trend: 'up'
    },
    { 
      title: 'Clientes', 
      value: dataLoading ? '...' : (stats.usersByRole.cliente || 0).toString(), 
      change: calculatePercentageChange(stats.usersByRole.cliente), 
      color: 'emerald',
      icon: Users,
      trend: 'up'
    },
    { 
      title: 'Usuarios Inactivos', 
      value: dataLoading ? '...' : stats.inactiveUsers.toString(), 
      change: calculatePercentageChange(stats.inactiveUsers), 
      color: 'orange',
      icon: AlertCircle,
      trend: stats.inactiveUsers > 0 ? 'down' : 'up'
    }
  ] : [];

  // ============================================================================
  // RENDER PRINCIPAL
  // ============================================================================

  return (
    <div className="dashboard">
      {/* Sidebar con Categorías */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="logo-container">
            <div className="logo-icon">
              <Droplets className="w-6 h-6 text-white" />
            </div>
            <div className="logo-text">
              <h2>JAAP Sanjapamba</h2>
              <p>Sistema Facturación</p>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {organizedModules.map((category) => (
            <div key={category.id} className="nav-category">
              {/* Header de categoría */}
              {category.collapsible ? (
                <button
                  className="category-header"
                  onClick={() => toggleCategory(category.id)}
                >
                  <div className="category-header-content">
                    <category.icon className="w-4 h-4" />
                    <span className="category-label">{category.label}</span>
                  </div>
                  {expandedCategories[category.id] ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
              ) : (
                <div className="category-header-static">
                  <category.icon className="w-4 h-4" />
                  <span className="category-label">{category.label}</span>
                </div>
              )}

              {/* Módulos de la categoría */}
              {(!category.collapsible || expandedCategories[category.id]) && (
                <div className="category-modules">
                  {category.modules.map((module) => {
                    const IconComponent = module.icon;
                    const isActive = currentSection === module.id;
                    
                    return (
                      <button
                        key={module.id}
                        onClick={() => navigateToSection(module.id)}
                        className={`nav-item ${isActive ? 'active' : ''}`}
                        title={module.description || module.label}
                      >
                        <IconComponent className="w-5 h-5" />
                        <span>{module.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Información de permisos del usuario */}
        <div className="sidebar-footer">
          <div className="user-permissions-info">
            <Shield className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-500">
              {userPermissions.length} permisos activos
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {/* Header */}
        <header className="header">
          <div className="header-content">
            <div className="header-title">
              <h1>Panel de {user.rol?.nombre_rol || 'Usuario'}</h1>
              <p>Bienvenido, {user.nombres || `${user.nombres} ${user.apellidos}`}</p>
            </div>

            <div className="header-actions">
              {/* Search */}
              <div className="search-container">
                <Search className="search-icon" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  className="search-input"
                />
              </div>

              {/* Refresh Button */}
              <button 
                className={`refresh-btn ${loading ? 'loading' : ''}`}
                onClick={handleRefresh}
                title="Actualizar datos"
                disabled={loading}
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>

              {/* Notifications */}
              <NotificationDropdown
                notifications={notifications}
                onMarkAsRead={handleMarkAsRead}
                onViewAll={handleViewAllNotifications}
                setActiveSection={() => {}} // No usado con rutas
                organizedModules={organizedModules}
                setExpandedCategories={setExpandedCategories}
              />

              {/* User Profile */}
              <UserProfile
                user={user}
                onLogout={handleLogout}
                onViewProfile={() => navigate('/admin/dashboard/profile')}
                onSettingsClick={handleSettingsClick}
              />
            </div>
          </div>
        </header>

        {/* Content con Rutas Anidadas */}
        <main className="content">
          <Routes>
            {/* Ruta por defecto - redirige a home */}
            <Route index element={<Navigate to="home" replace />} />
            
            {/* Ruta Overview */}
            <Route 
              path="home" 
              element={
                <OverviewSection 
                  user={user}
                  stats={stats}
                  dataLoading={dataLoading}
                  dataError={dataError}
                  canViewUserStats={canViewUserStats}
                  statCards={statCards}
                  handleRefresh={handleRefresh}
                  organizedModules={organizedModules}
                  setActiveSection={navigateToSection}
                />
              } 
            />
            
            {/* Rutas de Módulos Dinámicos */}
            <Route path="profile" element={<ProfileSection user={user} onUpdateProfile={handleUpdateProfile} />} />
            <Route path="users" element={<UsersSection user={user} />} />
            <Route path="notifications" element={<NotificationsSection notifications={notifications} onMarkAsRead={handleMarkAsRead} />} />
            <Route path="roles" element={<RolesSection user={user} />} />
            <Route path="sectors" element={<SectorsSection user={user} />} />
            <Route path="affiliates" element={<AffiliatesSection user={user} />} />
            <Route path="meters" element={<MetersSection user={user} />} />
            <Route path="settings" element={<ConfigSection user={user} />} />
            <Route path="rates" element={<TarifasSection user={user} />} />
            <Route path="geolocation" element={<GeolocationSection user={user} />} />
            
            {/* Ruta 404 para módulos no encontrados */}
            <Route path="*" element={
              <div className="section-placeholder">
                <Activity className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <h2>Módulo no encontrado</h2>
                <p>Esta sección no está disponible o no existe.</p>
                <button 
                  onClick={() => navigate('/admin/dashboard/home')}
                  className="btn-link mt-4"
                >
                  Volver al inicio
                </button>
              </div>
            } />
          </Routes>
        </main>
      </div>

      {/* 🔥 MODAL DE CAMBIO DE CONTRASEÑA */}
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
  );
};

export default AdminDashboard;