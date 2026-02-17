// src/sections/MiMedidorSection.js
import React, { useState, useEffect } from 'react';
import affiliateGeneralServices from '../../services/affiliateGeneralServices';
import {
  Gauge, MapPin, Calendar, CheckCircle, XCircle, AlertCircle,
  RefreshCw, Home, Activity, IdCard, User, Mail, Phone, Map, FileText
} from 'lucide-react';
import './MiMedidorSection.css';

const MiMedidorSection = () => {
  const [medidorData, setMedidorData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMiMedidor();
  }, []);

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

  const formatDate = (dateString) => {
    if (!dateString) return 'No disponible';
    return new Date(dateString + 'T00:00:00').toLocaleDateString('es-EC', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const openGoogleMaps = () => {
    if (medidorData?.medidor?.latitud && medidorData?.medidor?.longitud) {
      const url = `https://www.google.com/maps?q=${medidorData.medidor.latitud},${medidorData.medidor.longitud}`;
      window.open(url, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="affiliates-section">
        <div className="empty-state">
          <RefreshCw className="w-16 h-16 text-blue-400 mx-auto mb-4 animate-spin" />
          <h3>Cargando la información del medidor...</h3>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="medidor-container">
        <div className="section-header">
          <div className="section-title">
            <Gauge className="w-7 h-7 text-blue-600" />
            <div>
              <h2>Información de Mi Medidor</h2>
              <p className="section-subtitle">Visualiza los datos de tu medidor de agua</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="btn-secondary" onClick={fetchMiMedidor} title="Actualizar información">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="medidor-error-state">
          <AlertCircle size={64} />
          <h3>No se pudo cargar la información</h3>
          <p>{error}</p>
          <button onClick={fetchMiMedidor} className="btn-primary">
            <RefreshCw size={16} />
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!medidorData) {
    return (
      <div className="medidor-container">
        <div className="section-header">
          <div className="section-title">
            <Gauge className="w-7 h-7 text-blue-600" />
            <div>
              <h2>Información de Mi Medidor</h2>
              <p className="section-subtitle">Visualiza los datos de tu medidor de agua</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="btn-secondary" onClick={fetchMiMedidor} title="Actualizar información">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="medidor-empty-state">
          <Gauge size={64} />
          <h3>Sin medidor asignado</h3>
          <p>Contacta con el administrador para que te asigne un medidor</p>
        </div>
      </div>
    );
  }

  // CONSTANTES PRINCIPALES
  const usuario = medidorData.afiliado?.usuario_sistema;
  const afiliado = medidorData.afiliado;
  const medidor = medidorData.medidor;

  return (
    <div className="users-section">
      {/* HEADER */}
      <div className="section-header">
          <div className="section-title">
          <FileText className="w-7 h-7 text-blue-600" />
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
              title="Actualizar informaciÃ³n"
          >
              <RefreshCw className="w-4 h-4" />
          </button>
          </div>
      </div>

      {/* LAYOUT DE CONTENIDO */}
      <div className="medidor-layout">
        {/* SIDEBAR CON INFO DEL MEDIDOR */}
        <div className="medidor-sidebar">
          <div className="medidor-sidebar-card">
            {/* Icono del medidor */}
            <div className="medidor-icon-container">
              <div className="medidor-icon-wrapper">
                <Gauge size={64} />
              </div>
            </div>

            {/* Código del medidor */}
            <div className="medidor-header-info">
              <h3 className="medidor-code">{medidor?.num_medidor || 'N/A'}</h3>
              <p className="medidor-label">Número de Medidor</p>
            </div>

            {/* Estado del medidor */}
            <div className="medidor-status-container">
              {medidor?.activo ? (
                <span className="badge badge--success">
                  <CheckCircle size={16} />
                  <span>Activo</span>
                </span>
              ) : (
                <span className="badge badge--error">
                  <XCircle size={16} />
                  <span>Inactivo</span>
                </span>
              )}
            </div>

            {/* Detalles del medidor */}
            <div className="medidor-details-list">
              <div className="medidor-detail-item">
                <MapPin size={16} className="detail-icon" />
                <div className="detail-content">
                  <span className="detail-label">Sector</span>
                  <span className="detail-value">{medidor?.sector?.nombre_sector || 'No especificado'}</span>
                </div>
              </div>

              <div className="medidor-detail-item">
                <Activity size={16} className="detail-icon" />
                <div className="detail-content">
                  <span className="detail-label">Altitud</span>
                  <span className="detail-value">{medidor?.altitud ? `${medidor.altitud} m` : 'No especificado'}</span>
                </div>
              </div>

            </div>

           {/* Coordenadas GPS */}
          {medidor?.latitud && medidor?.longitud && (
            <div className="medidor-gps-section">
              <h4 className="gps-title">
                <MapPin size={16} />
                Ubicación GPS
              </h4>

              <div className="gps-coordinates">
                <div className="gps-coord">
                  <span className="gps-label">Latitud</span>
                  <span className="gps-value">
                    {Number(medidor.latitud).toFixed(5)}
                  </span>
                </div>

                <div className="gps-coord">
                  <span className="gps-label">Longitud</span>
                  <span className="gps-value">
                    {Number(medidor.longitud).toFixed(5)}
                  </span>
                </div>
              </div>

              <button onClick={openGoogleMaps} className="btn-map">
                <Map size={16} />
                Ver en Google Maps
              </button>
            </div>
          )}

          </div>
        </div>

        {/* PANEL PRINCIPAL */}
        <div className="medidor-main">
          {/* Información del Usuario */}
          <div className="medidor-info-card">
            <div className="info-card-header">
              <User size={20} />
              <h3>Información del Usuario</h3>
            </div>
            <div className="info-card-body">
              <div className="info-grid">
                <div className="info-field">
                  <label className="info-label">
                    <IdCard className="w-4 h-4"  />
                    Cédula
                  </label>
                  <div className="info-values-medidor ">{usuario?.cedula || 'N/A'}</div>
                </div>

                <div className="info-field">
                  <label className="info-label">
                    <User className="w-4 h-4"  />
                    Nombre afiliado
                  </label>
                  <div className="info-values-medidor ">
                    {usuario?.nombres && usuario?.apellidos 
                      ? `${usuario.nombres} ${usuario.apellidos}`
                      : 'No especificado'}
                  </div>
                </div>

                <div className="info-field">
                  <label className="info-label">
                    <Mail className="w-4 h-4"  />
                    Correo Electrónico
                  </label>
                  <div className="info-values-medidor ">{usuario?.email || 'No especificado'}</div>
                </div>

                <div className="info-field">
                  <label className="info-label">
                    <Phone className="w-4 h-4"  />
                    Teléfono
                  </label>
                  <div className="info-values-medidor ">{usuario?.telefono || 'No especificado'}</div>
                </div>

                <div className="info-field info-field-full">
                  <label className="info-label">
                    <MapPin className="w-4 h-4"  />
                    Dirección
                  </label>
                  <div className="info-values-medidor ">{usuario?.direccion || 'No especificada'}</div>
                </div>
                {/* Sector del afiliado  */}
                <div className="info-field">
                  <label className="info-label">
                    <Map className="w-4 h-4"  />
                    Sector del Afiliado
                  </label>
                  <div className="info-values-medidor ">{afiliado?.sector?.nombre_sector || 'No especificado'}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Información del Afiliado */}
          <div className="medidor-info-card">
            <div className="info-card-header">
              <Home size={20} />
              <h3>Información del Afiliado</h3>
            </div>
            <div className="info-card-body">
              <div className="info-grid">
                <div className="info-field">
                  <label className="info-label">
                    <IdCard className="w-4 h-4"  />
                    Código de Afiliado
                  </label>
                  <div className="info-values-medidor ">{afiliado?.cod_usuario_afi || 'N/A'}</div>
                </div>

                <div className="info-field">
                  <label className="info-label">
                    <Gauge className="w-4 h-4"  />
                    Número de Medidor
                  </label>
                  <div className="info-values-medidor ">{afiliado?.num_medidor || 'No especificado'}</div>
                </div>

                <div className="info-field">
                  <label className="info-label">
                    <MapPin className="w-4 h-4"  />
                    Sector del medidor
                  </label>
                  <div className="info-values-medidor ">{medidor?.sector?.nombre_sector || 'No especificado'}</div>
                </div>

                <div className="info-field">
                  <label className="info-label">
                    <Calendar className="w-4 h-4"  />
                    Fecha de Afiliación
                  </label>
                  <div className="info-values-medidor ">{formatDate(afiliado?.fecha_afiliacion)}</div>
                </div>

                <div className="info-field">
                  <label className="info-label">
                    <Activity className="w-4 h-4"  />
                    Estado
                  </label>
                  <div className="info-values-medidor ">
                    {afiliado?.activo ? (
                      <span className="badge badge--success badge-sm">
                        <CheckCircle size={12} />
                        Activo
                      </span>
                    ) : (
                      <span className="badge badge--error badge-sm">
                        <XCircle size={12} />
                        Inactivo
                      </span>
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Información Adicional */}
          <div className="medidor-info-message">
            <AlertCircle size={20} />
            <div>
              <strong>Nota importante:</strong>
              <p>
                Si encuentras algún error en los datos o necesitas actualizar información,
                por favor contacta con el administrador del sistema.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MiMedidorSection;
