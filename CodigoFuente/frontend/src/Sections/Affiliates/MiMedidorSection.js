// src/sections/MiMedidorSection.js
/**
 * MÓDULO DE VISUALIZACIÓN DE MI MEDIDOR
 * Muestra información del medidor asignado al usuario logueado
 * Solo visualización, sin permisos de edición
 */

import React, { useState, useEffect } from 'react';
import affiliateGeneralServices from '../../services/affiliateGeneralServices';

import {
  Gauge,
  MapPin,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Home,
  Droplet,
  Activity,
  IdCard,
} from 'lucide-react';
import './MiMedidorSection.css';

const MiMedidorSection = () => {
  // ============================================================
  // ESTADOS
  // ============================================================
  const [medidorData, setMedidorData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ============================================================
  // EFECTOS
  // ============================================================
  useEffect(() => {
    fetchMiMedidor();
  }, []);

  // ============================================================
  // FUNCIONES DE CARGA
  // ============================================================
  const fetchMiMedidor = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await affiliateGeneralServices.getMiMedidor();
      
      if (result.success) {
        console.log('✅ Datos del medidor:', result.data);
        setMedidorData(result.data);
      } else {
        setError(result.message);
      }
    } catch (err) {
      console.error('❌ Error cargando información del medidor:', err);
      setError('Error al cargar la información de tu medidor');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // FUNCIONES DE UTILIDAD
  // ============================================================
  const formatDate = (dateString) => {
    if (!dateString) return 'No disponible';
    return new Date(dateString + 'T00:00:00').toLocaleDateString('es-EC', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const openGoogleMaps = () => {
    const { medidor } = medidorData;
    if (medidor?.latitud && medidor?.longitud) {
      const url = `https://www.google.com/maps?q=${medidor.latitud},${medidor.longitud}`;
      window.open(url, '_blank');
    }
  };

  // ============================================================
  // RENDERIZADO - ESTADOS ESPECIALES
  // ============================================================
  if (loading) {
    return (
      <div className="mi-medidor-section">
        <div className="empty-state">
          <RefreshCw className="w-16 h-16 text-blue-400 mx-auto mb-4 animate-spin" />
          <h3>Cargando información de tu medidor...</h3>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mi-medidor-section">
        <div className="empty-state">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h3>Error al cargar información</h3>
          <p>{error}</p>
          <button className="btn-primary mt-4" onClick={fetchMiMedidor}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!medidorData || !medidorData.medidor) {
    return (
      <div className="mi-medidor-section">
        <div className="empty-state">
          <Gauge className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3>No tienes un medidor asignado</h3>
          <p>Contacta con el administrador para que te asigne un medidor</p>
        </div>
      </div>
    );
  }

  // 🔥 Destructurar datos
  const { medidor, afiliado } = medidorData;

  // ============================================================
  // RENDERIZADO PRINCIPAL
  // ============================================================
  return (
    <div className="users-section">

    {/* HEADER */}
    <div className="section-header">
        <div className="section-title">
        <Gauge className="w-7 h-7 text-blue-600" />
        <div>
            <h2>Información de Mi Medidor</h2>
            <p className="section-subtitle">
            Visualiza los datos de tu medidor de agua
            </p>
        </div>
        </div>

        <div className="flex items-center gap-3">
        <button
            className="btn-secondary"
            onClick={fetchMiMedidor}
            title="Actualizar información"
        >
            <RefreshCw className="w-4 h-4" />
        </button>
        </div>
    </div>

        {/* INFORMACIÓN DEL AFILIADO */}
        {afiliado && (
          <div className="mi-medidor-section afiliado">
            <div className="mi-medidor-section-title">
              <Droplet />
              <h2>Datos de Afiliación</h2>
              <div style={{ marginLeft: 'auto' }}>
                <span className={`mi-medidor-status ${afiliado.activo ? 'active' : 'inactive'}`}>
                  {afiliado.activo ? <CheckCircle /> : <XCircle />}
                  {afiliado.activo ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            </div>
            
            <div className="mi-medidor-data-grid">
              <div className="mi-medidor-field highlight">
                <div className="mi-medidor-field-label">
                  <IdCard />
                  Código de Afiliado
                </div>
                <div className="mi-medidor-field-value">
                  {afiliado.cod_usuario_afi}
                </div>
              </div>

              <div className="mi-medidor-field">
                <div className="mi-medidor-field-label">
                  <Calendar />
                  Fecha de Afiliación
                </div>
                <div className="mi-medidor-field-value">
                  {formatDate(afiliado.fecha_afiliacion)}
                </div>
              </div>

              {afiliado.sector && (
                <div className="mi-medidor-field full">
                  <div className="mi-medidor-field-label">
                    <Home />
                    Sector Asignado
                  </div>
                  <div className="mi-medidor-field-value">
                    {afiliado.sector.nombre_sector}
                  </div>
                </div>
              )}

              {afiliado.num_medidor && (
                <div className="mi-medidor-field full">
                  <div className="mi-medidor-field-label">
                    <Gauge />
                    Número de Medidor (Registro)
                  </div>
                  <div className="mi-medidor-field-value">
                    {afiliado.num_medidor}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* INFORMACIÓN DEL MEDIDOR */}
        <div className="mi-medidor-section medidor">
          <div className="mi-medidor-section-title">
            <Gauge />
            <h2>Datos del Medidor</h2>
            <div style={{ marginLeft: 'auto' }}>
              <span className={`mi-medidor-status ${medidor.activo ? 'active' : 'inactive'}`}>
                {medidor.activo ? <CheckCircle /> : <XCircle />}
                {medidor.activo ? 'En servicio' : 'Fuera de servicio'}
              </span>
            </div>
          </div>
          
          <div className="mi-medidor-data-grid">
            <div className="mi-medidor-field highlight">
              <div className="mi-medidor-field-label">
                <Gauge />
                Número de Medidor
              </div>
              <div className="mi-medidor-field-value">
                {medidor.num_medidor}
              </div>
            </div>

            <div className="mi-medidor-field">
              <div className="mi-medidor-field-label">
                <Activity />
                Estado Operativo
              </div>
              <div className="mi-medidor-field-value">
                {medidor.activo ? 'En servicio' : 'Fuera de servicio'}
              </div>
            </div>

            {medidor.sector && (
              <div className="mi-medidor-field full">
                <div className="mi-medidor-field-label">
                  <Home />
                  Sector del Medidor
                </div>
                <div className="mi-medidor-field-value">
                  {medidor.sector.nombre_sector}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* INFORMACIÓN DE UBICACIÓN GPS */}
        <div className="mi-medidor-section location featured">
          <div className="mi-medidor-section-title">
            <MapPin />
            <h2>Ubicación GPS</h2>
          </div>
          
          {medidor.latitud && medidor.longitud ? (
            <>
              <div className="mi-medidor-coordinates">
                <div className="mi-medidor-coord">
                  <div className="mi-medidor-coord-label">Latitud</div>
                  <div className="mi-medidor-coord-value">
                    {medidor.latitud.toFixed(6)}°
                  </div>
                </div>
                
                <div className="mi-medidor-coord">
                  <div className="mi-medidor-coord-label">Longitud</div>
                  <div className="mi-medidor-coord-value">
                    {medidor.longitud.toFixed(6)}°
                  </div>
                </div>

                {medidor.altitud && (
                  <div className="mi-medidor-coord">
                    <div className="mi-medidor-coord-label">Altitud</div>
                    <div className="mi-medidor-coord-value">
                      {medidor.altitud} m
                    </div>
                  </div>
                )}
              </div>

              <button 
                className="mi-medidor-map-button"
                onClick={openGoogleMaps}
              >
                <MapPin />
                Ver Ubicación en Google Maps
              </button>
            </>
          ) : (
            <div className="mi-medidor-info-message">
              <AlertCircle />
              <span>Este medidor aún no tiene coordenadas GPS registradas</span>
            </div>
          )}
        </div>


      

    </div>
  );


};

export default MiMedidorSection;
