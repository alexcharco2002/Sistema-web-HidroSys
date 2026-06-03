// src/sections/HomeSection.js
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import './HomeSection.css';
import authService from '../../services/authServices';
import { buildModulesFromPermissions } from '../../utils/modulesDefinitions';
import { RefreshCw, Grid, List, Home, Cloud, CloudRain, Sun, Wind, Droplets, Thermometer, MapPin, Search } from 'lucide-react';

const HomeSection = ({ user, stats, dataLoading }) => {
  const navigate = useNavigate();
  const [layout, setLayout] = useState('grid');
  const [loading, setLoading] = useState(true);
  const [availableModules, setAvailableModules] = useState([]);
  const [moduleSearchTerm, setModuleSearchTerm] = useState('');
  
  // 👇 NUEVO: Estados para clima y hora
  const [currentTime, setCurrentTime] = useState(new Date());
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherLocation, setWeatherLocation] = useState('Ubicacion del dispositivo');

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Buenos días' : currentHour < 18 ? 'Buenas tardes' : 'Buenas noches';

  // 👇 NUEVO: Reloj
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 👇 NUEVO: Clima
  useEffect(() => {
    const formatCoords = (latitude, longitude) =>
      `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;

    const resolveLocationName = async (latitude, longitude) => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=14&addressdetails=1`
        );
        const data = await response.json();
        const address = data?.address || {};
        const place =
          address.city ||
          address.town ||
          address.village ||
          address.parish ||
          address.suburb ||
          address.county;
        const province = address.state || address.region;
        const country = address.country;
        const parts = [place, province, country].filter(Boolean);
        return parts.length > 0 ? parts.join(', ') : formatCoords(latitude, longitude);
      } catch (error) {
        console.error('Error resolviendo ubicacion del dispositivo:', error);
        return formatCoords(latitude, longitude);
      }
    };

    const fetchWeather = async (latitude, longitude) => {
      try {
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=America/Guayaquil`
        );
        const data = await response.json();
        if (data?.current) {
          setWeather({
            temperature: Math.round(data.current.temperature_2m),
            feelsLike: Math.round(data.current.apparent_temperature),
            humidity: data.current.relative_humidity_2m,
            windSpeed: Math.round(data.current.wind_speed_10m),
            weatherCode: data.current.weather_code
          });
        }
        setWeatherLoading(false);
      } catch (error) {
        console.error('Error cargando clima del panel general:', error);
        setWeatherLoading(false);
      }
    };
    const loadDeviceWeather = (latitude, longitude) => {
      fetchWeather(latitude, longitude);
      resolveLocationName(latitude, longitude).then(setWeatherLocation);
      return setInterval(() => fetchWeather(latitude, longitude), 600000);
    };

    let interval = null;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          interval = loadDeviceWeather(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          console.error('No se pudo obtener ubicacion del dispositivo:', error);
          const fallback = { latitude: -1.6667, longitude: -78.65 };
          setWeatherLocation(`Ubicacion referencial: ${formatCoords(fallback.latitude, fallback.longitude)}`);
          interval = loadDeviceWeather(fallback.latitude, fallback.longitude);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
      );
    } else {
      const fallback = { latitude: -1.6667, longitude: -78.65 };
      setWeatherLocation(`Ubicacion referencial: ${formatCoords(fallback.latitude, fallback.longitude)}`);
      interval = loadDeviceWeather(fallback.latitude, fallback.longitude);
    }

    return () => clearInterval(interval);
  }, []);

  const getWeatherDesc = (code) => {
    const codes = {0:'Despejado',1:'Mayormente despejado',2:'Parcialmente nublado',3:'Nublado',
      45:'Neblina',51:'Llovizna',61:'Lluvia ligera',63:'Lluvia moderada',65:'Lluvia intensa',
      71:'Nevada',80:'Chubascos',95:'Tormenta'};
    return codes[code] || 'Desconocido';
  };

  const getWeatherIcon = (code) => {
    if (code <= 1) return <Sun className="w-8 h-8" />;
    if (code <= 3) return <Cloud className="w-8 h-8" />;
    if (code >= 51) return <CloudRain className="w-8 h-8" />;
    return <Cloud className="w-8 h-8" />;
  };

  useEffect(() => {
    const buildAvailableModules = () => {
      const userPermissions = authService.getUserPermissions() || [];
      return buildModulesFromPermissions(userPermissions)
        .flatMap(category => category.modules);
    };

    const modules = buildAvailableModules();
    setAvailableModules(modules);
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, [user]);

  const filteredModules = useMemo(() => {
    const searchValue = moduleSearchTerm.trim().toLowerCase();
    if (!searchValue) return availableModules;

    return availableModules.filter(module =>
      module.label?.toLowerCase().includes(searchValue) ||
      module.description?.toLowerCase().includes(searchValue)
    );
  }, [availableModules, moduleSearchTerm]);

  const handleModuleClick = (module) => {
    const rolePath = user?.rol?.nombre_rol?.toLowerCase() || 'usuario';
    const targetPath = `/${rolePath}/${module.path}`;
    navigate(targetPath);
  };

  if (loading) {
    return (
      <div className="affiliates-section">
        <div className="empty-state">
          <RefreshCw className="w-16 h-16 text-blue-400 mx-auto mb-4 animate-spin" />
          <h3> Espere mientras cargamos su información...</h3>
        </div>
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

      {/* 👇 NUEVO: WIDGETS DE CLIMA Y HORA */}
      <div className="home-widgets-container">
        <div className="home-widget-clock">
          <div className="home-widget-icon">
            <Sun className="w-7 h-7" />
          </div>
          <div className="home-widget-content">
            <div className="home-widget-value">
              {currentTime.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </div>
            <div className="home-widget-label">
              {currentTime.toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
          </div>
        </div>

        <div className="home-widget-weather">
          {weatherLoading ? (
            <div className="home-widget-loading">
              <RefreshCw className="spinner w-5 h-5" />
              <span>Cargando...</span>
            </div>
          ) : weather ? (
            <>
              <div className="home-widget-icon">
                {getWeatherIcon(weather.weatherCode)}
              </div>
              <div className="home-widget-content">
                <div className="home-widget-value">{weather.temperature}°C</div>
                <div className="home-widget-label">{getWeatherDesc(weather.weatherCode)}</div>
                <div className="home-widget-location" title={weatherLocation}>
                  <MapPin className="w-3 h-3" />
                  <span>{weatherLocation}</span>
                </div>
                <div className="home-widget-details">
                  <span><Thermometer className="w-3 h-3" /> {weather.feelsLike}°C</span>
                  <span><Droplets className="w-3 h-3" /> {weather.humidity}%</span>
                  <span><Wind className="w-3 h-3" /> {weather.windSpeed} km/h</span>
                </div>
              </div>
            </>
          ) : (
            <div className="home-widget-error">Clima no disponible</div>
          )}
        </div>
      </div>

      {/* MÓDULOS DISPONIBLES DINÁMICOS */}
      <div className="modules-section">
        <div className="modules-header">
          <h3>Módulos Disponibles</h3>
          <div className="modules-header-actions">
            <div className="modules-search">
              <Search className="modules-search-icon" />
              <input
                type="text"
                value={moduleSearchTerm}
                onChange={(e) => setModuleSearchTerm(e.target.value)}
                placeholder="Buscar modulos"
              />
            </div>
            <span className="modules-count">
              {filteredModules.length} de {availableModules.length} módulos
            </span>
          </div>
        </div>

        <div className={`home-actions-${layout}`}>
          {filteredModules.length === 0 && (
            <div className="modules-empty-search">
              <Search className="w-10 h-10" />
              <p>No hay módulos que coincidan con la búsqueda.</p>
            </div>
          )}
          {filteredModules.map(module => {
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
