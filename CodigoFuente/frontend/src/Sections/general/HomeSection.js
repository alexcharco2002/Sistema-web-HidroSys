// src/sections/HomeSection.js
// Página de Inicio Universal con módulos dinámicos según permisos
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './HomeSection.css';
import authService from '../../services/authServices';
import { MODULE_DEFINITIONS } from '../../utils/modulesDefinitions';

import { 
  RefreshCw, Grid, List, Home
} from 'lucide-react';

// ============================================================================
// COMPONENTE PRINCIPAL: HomeSection
// ============================================================================
const HomeSection = ({ user, stats, dataLoading }) => {
  const navigate = useNavigate();
  const [layout, setLayout] = useState('grid');
  const [loading, setLoading] = useState(true);
  const [availableModules, setAvailableModules] = useState([]);

  // Obtener saludo según hora
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Buenos días' : currentHour < 18 ? 'Buenas tardes' : 'Buenas noches';

  useEffect(() => {
    // Construir módulos disponibles según permisos del usuario
    const buildAvailableModules = () => {
      const modules = [];
      
      // 🔥 Obtener permisos igual que UniversalDashboard
      const userPermissions = authService.getUserPermissions() || [];
      
      console.log('🔍 HomeSection - Analizando permisos:', {
        total: userPermissions.length,
        permisos: userPermissions.map(p => p.nombre_accion)
      });

      // Iterar sobre todos los módulos definidos
      Object.entries(MODULE_DEFINITIONS).forEach(([key, module]) => {
        // Incluir módulos siempre visibles (home, profile)
        if (module.alwaysVisible) {
          modules.push(module);
          console.log('✅ Módulo siempre visible:', module.label);
          return;
        }

        // 🔥 Verificar permisos usando la misma lógica que buildModulesFromPermissions
        const hasPermission = userPermissions.some(perm => {
          if (!perm.nombre_accion) return false;
          
          // Extraer el nombre del módulo del permiso (ejemplo: "usuarios.crear" -> "usuarios")
          const [moduleName] = perm.nombre_accion.split('.');
          const normalizedModuleName = moduleName.toLowerCase();
          const normalizedKey = key.toLowerCase();
          
          return normalizedModuleName === normalizedKey;
        });

        if (hasPermission) {
          modules.push(module);
          console.log('✅ Módulo con permiso:', module.label);
        } else {
          console.log('❌ Sin permiso para:', module.label, '(key:', key, ')');
        }
      });

      // Ordenar por orden definido
      modules.sort((a, b) => a.order - b.order);
      
      console.log('📦 Módulos disponibles en HomeSection:', modules.length, modules.map(m => m.label));
      
      return modules;
    };

    const modules = buildAvailableModules();
    setAvailableModules(modules);
    
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, [user]);

  // Handler para navegar a un módulo
  const handleModuleClick = (module) => {
    console.log('🎯 Navegando al módulo:', module.label);
    
    // 🔥 Obtener el nombre del rol y convertirlo a minúsculas para la URL
    const rolePath = user?.rol?.nombre_rol?.toLowerCase() || 'usuario';
    const targetPath = `/${rolePath}/${module.path}`;
    
    console.log('📍 Ruta dinámica:', targetPath);
    console.log('👤 Rol del usuario:', user?.rol?.nombre_rol);
    
    navigate(targetPath);
  };


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
            <p className="subtitle">Panel de Control - {user?.rol?.nombre_rol || 'Usuario'}</p>
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

      {/* MÓDULOS DISPONIBLES DINÁMICOS */}
      <div className="modules-section">
        <div className="modules-header">
          <h3>Módulos Disponibles</h3>
          <span className="modules-count">{availableModules.length} módulos</span>
        </div>

        <div className={`home-actions-${layout}`}>
          {availableModules.map(module => {
            const Icon = module.icon;
            return layout === 'grid' ? (
              <div 
                key={module.id} 
                className={`user-card action-card-home ${module.color}`}
                onClick={() => handleModuleClick(module)}
              >
                <div className="user-card-header">
                  <div className="user-info">
                    <div className={`action-icon-wrapper bg-${module.color}-50`}>
                      <Icon className={`w-6 h-6 text-${module.color}-600`} />
                    </div>
                    <div>
                      <h3 className="user-name">{module.label}</h3>
                      <p className="action-description">{module.description}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div 
                key={module.id} 
                className={`action-list-item-home ${module.color}`}
                onClick={() => handleModuleClick(module)}
              >
                <div className={`action-list-icon bg-${module.color}-50`}>
                  <Icon className={`w-5 h-5 text-${module.color}-600`} />
                </div>
                <div className="action-list-content">
                  <span className="action-list-label">{module.label}</span>
                  <span className="action-list-description">{module.description}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MENSAJE SI NO HAY MÓDULOS */}
      {availableModules.length === 0 && (
        <div className="empty-state">
          <Home className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3>No hay módulos disponibles</h3>
          <p>Contacta al administrador para obtener permisos de acceso</p>
        </div>
      )}
    </div>
  );
};

export default HomeSection;
