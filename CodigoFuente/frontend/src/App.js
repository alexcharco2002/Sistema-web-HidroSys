// src/App.js

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Páginas públicas
import Login from './pages/login';
import Forgotpassword from './pages/forgotPassword';

// Dashboard Universal
import UniversalDashboard from './pages/UniversalDashboard';

// Componente de ruta protegida
import ProtectedRoute from './sections/ProtectedRoute';


// Handler de sesión expirada
import SessionExpiredHandler from './components/SessionExpiredHandler';

const App = () => {
  return (
    <div className="App-scale">
      <Router>
      <SessionExpiredHandler />
      
      <Routes>
        {/* PÁGINA DE INICIO - Login */}
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<Forgotpassword />} />

        {/* RUTAS PROTEGIDAS POR ROL */}
        <Route 
          path="/:rolePath/*" 
          element={
            <ProtectedRoute>
              <UniversalDashboard />
            </ProtectedRoute>
          } 
        />

        {/* 404 - Redirigir al login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
    </div>
  );
};

export default App;
