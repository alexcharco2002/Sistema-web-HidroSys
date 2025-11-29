// src/App.js - VERSIÓN CORREGIDA
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';

// Páginas públicas
import Login from './pages/login.js';
import Forgotpassword from './pages/forgotPassword.js';

// Dashboard Universal
import UniversalDashboard from './pages/UniversalDashboard.js';

// Componente de ruta protegida
import ProtectedRoute from './components/ProtectedRoute.js';

// Servicios
import authService from './services/authServices.js';

/**
 * 🔥 Redirección inteligente
 */
const SmartRedirect = () => {
  if (authService.isAuthenticated()) {
    const roleRoute = authService.getRoleBasedRoute();
    console.log(`🔀 SmartRedirect -> ${roleRoute}`);
    return <Navigate to={roleRoute} replace />;
  }
  return <Navigate to="/login" replace />;
};

/**
 * 🔥 Dashboard dinámico por rol - VERSIÓN CORREGIDA
 */
const DynamicRoleDashboard = () => {
  const isAuthenticated = authService.isAuthenticated();
  
  if (!isAuthenticated) {
    console.log('❌ No autenticado, redirigiendo a login');
    return <Navigate to="/login" replace />;
  }

  const currentPath = window.location.pathname;
  const userRoleBase = authService.getRoleBasePath(); // /administrador
  const userRoleHome = authService.getRoleBasedRoute(); // /administrador/home
  
  // Extraer el segmento del rol de la URL actual
  const pathSegments = currentPath.split('/').filter(Boolean);
  const currentRoleSegment = pathSegments[0] ? `/${pathSegments[0]}` : '/';

  console.log('🔍 Debug DynamicRoleDashboard:', {
    currentPath,
    userRoleBase,
    userRoleHome,
    currentRoleSegment,
    pathSegments
  });

  // ✅ CASO 1: Usuario accede solo a /administrador (sin /home)
  // Redirigir a /administrador/home
  if (currentPath === userRoleBase) {
    console.log('📍 Redirigiendo de base a /home');
    return <Navigate to={userRoleHome} replace />;
  }

  // ✅ CASO 2: Usuario intenta acceder a un rol diferente
  // Ejemplo: su rol es /administrador pero intenta acceder a /lector
  if (currentRoleSegment !== userRoleBase) {
    console.log(`⚠️ Rol incorrecto. Esperado: ${userRoleBase}, Actual: ${currentRoleSegment}`);
    return <Navigate to={userRoleHome} replace />;
  }

  // ✅ CASO 3: Todo está bien, renderizar el dashboard
  console.log('✅ Renderizando UniversalDashboard');
  return (
    <ProtectedRoute>
      <UniversalDashboard />
    </ProtectedRoute>
  );
};

const App = () => {
  // Manejar sesiones expiradas
  useEffect(() => {
    const handleExpired = () => {
      console.log('⏰ Sesión expirada');
      authService.clearLocalData();
      window.location.href = "/login";
    };

    window.addEventListener("sessionExpired", handleExpired);
    return () => window.removeEventListener("sessionExpired", handleExpired);
  }, []);

  return (
    <Router>
      <Routes>
        {/* RUTAS PÚBLICAS */}
        <Route path="/" element={<SmartRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<Forgotpassword />} />

        {/* RUTAS DINÁMICAS POR ROL */}
        <Route path="/:rolePath/*" element={<DynamicRoleDashboard />} />

        {/* REDIRECCIÓN GENÉRICA */}
        <Route path="/dashboard/*" element={<SmartRedirect />} />

        {/* RUTA 404 */}
        <Route path="*" element={<SmartRedirect />} />
      </Routes>
    </Router>
  );
};

export default App;
