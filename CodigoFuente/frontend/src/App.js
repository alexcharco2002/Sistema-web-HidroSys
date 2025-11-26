// App.js
// Archivo principal con rutas anidadas para navegación por URL
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/login.js';
import Forgotpassword from './pages/forgotPassword.js';
import ResetPassword from './pages/ResetPassword.js';
import { useEffect } from 'react';

// Importar los paneles de cada rol con rutas anidadas
import AdminDashboard from './pages/admin/Dashboard';
import LectorDashboard from './pages/lector/Dashboard';
import ClienteDashboard from './pages/cliente/Dashboard';
import CajeroDashboard from './pages/cajero/Dashboard.js';

//IMPOTAR SERVICIOS
import authService from './services/authServices.js';

const App = () => {
    
  useEffect(() => {
    const handleExpired = () => {
      authService.clearLocalData();
      window.location.href = "/login";
    };

    window.addEventListener("sessionExpired", handleExpired);

    return () => {
      window.removeEventListener("sessionExpired", handleExpired);
    };
  }, []);

  return (
    <Router>
      <Routes>
        {/* Redirige la ruta raíz "/" hacia "/login" */}
        <Route path="/" element={<Navigate to="/login" />} />
       
        {/* Página de inicio de sesión */}
        <Route path="/login" element={<Login />} />

        {/* Ruta para la recuperación de contraseña */}
        <Route path="/forgot-password" element={<Forgotpassword />} />
        
        {/* Ruta para restablecer la contraseña con token */}
        <Route path="/reset-password/:token" element={<ResetPassword />} />

        {/* 
          🔥 RUTAS ANIDADAS PARA ADMIN 
          Ahora el Dashboard funciona como Layout y las subsecciones son rutas hijas
        */}
        <Route path="/admin/dashboard/*" element={<AdminDashboard />} />

        {/* Rutas anidadas para otros roles */}
        <Route path="/lector/dashboard/*" element={<LectorDashboard />} />
        <Route path="/cajero/dashboard/*" element={<CajeroDashboard />} />
        <Route path="/cliente/dashboard/*" element={<ClienteDashboard />} />
      </Routes>
    </Router>
  );
};

export default App;