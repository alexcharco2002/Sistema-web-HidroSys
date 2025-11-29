// src/components/ProtectedRoute.js
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import authService from '../services/authServices';

/**
 * 🔥 Componente de protección de rutas mejorado
 * Verifica autenticación y permisos de rol
 */
const ProtectedRoute = ({ children }) => {
  const location = useLocation();
  const isAuthenticated = authService.isAuthenticated();

  // =====================================================
  // 1️⃣ Verificar autenticación
  // =====================================================
  if (!isAuthenticated) {
    console.warn('⚠️ Usuario no autenticado, redirigiendo a login');
    
    // Guardar la ruta intentada para redirigir después del login
    return (
      <Navigate 
        to="/login" 
        state={{ from: location }} 
        replace 
      />
    );
  }

  // =====================================================
  // 2️⃣ Verificar que el usuario tiene datos válidos
  // =====================================================
  const currentUser = authService.getCurrentUser();
  
  if (!currentUser || !currentUser.rol) {
    console.error('❌ Usuario sin datos de rol válidos');
    authService.clearLocalData();
    return <Navigate to="/login" replace />;
  }

  // =====================================================
  // 3️⃣ Verificar acceso a la ruta actual
  // =====================================================
  const currentPath = location.pathname;
  const userRoleRoute = authService.getRoleBasedRoute();
  
  // Extraer la base de la ruta (sin subrutas)
  const currentBase = '/' + currentPath.split('/').filter(Boolean)[0];
  const userBase = '/' + userRoleRoute.split('/').filter(Boolean)[0];
  
  // Rutas públicas que cualquier usuario autenticado puede ver
  const publicPaths = ['/perfil', '/configuracion', '/ayuda'];
  const isPublicPath = publicPaths.some(path => currentPath.startsWith(path));
  
  // Si es una ruta pública, permitir acceso
  if (isPublicPath) {
    return children;
  }
  
  // Si es administrador, permitir acceso a todo
  const isAdmin = authService.isAdmin();
  if (isAdmin) {
    console.log('✅ Acceso de administrador concedido a:', currentPath);
    return children;
  }
  
  // Verificar si la ruta base coincide con el rol del usuario
  if (currentBase !== userBase) {
    console.warn(`⚠️ Acceso denegado:`);
    console.warn(`   Ruta intentada: ${currentPath}`);
    console.warn(`   Ruta permitida: ${userRoleRoute}`);
    console.warn(`   Rol: ${currentUser.rol.nombre_rol}`);
    
    return <Navigate to={userRoleRoute} replace />;
  }

  // =====================================================
  // 4️⃣ Acceso concedido
  // =====================================================
  console.log('✅ Acceso concedido:', {
    usuario: currentUser.nombre_completo,
    rol: currentUser.rol.nombre_rol,
    ruta: currentPath
  });

  return children;
};

export default ProtectedRoute;