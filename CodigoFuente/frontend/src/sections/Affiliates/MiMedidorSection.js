// src/sections/MiMedidorSection.js
import React, { useState, useEffect } from 'react';
import affiliateGeneralServices from '../../services/affiliateGeneralServices';
import {
  Gauge, MapPin, Calendar, CheckCircle, XCircle, AlertCircle,
  RefreshCw, Home, Activity, IdCard, User, Mail, Phone, Map, FileText, Layers
} from 'lucide-react';
import './MiMedidorSection.css';

const MiMedidorSection = () => {
  const [medidorData, setMedidorData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [medidorActivo, setMedidorActivo] = useState(0); // índice del medidor seleccionado

  useEffect(() => {
    fetchMiMedidor();
  }, []);

  const fetchMiMedidor = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await affiliateGeneralServices.getMiMedidor();
      if (result.success) {
        setMedidorData(result.data);
        setMedidorActivo(0);
      } else {
        setError(result.message);
      }
    } catch (err) {
      console.error('Error al cargar informacion del medidor:', err);
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

  const openGoogleMaps = (medidor) => {
    if (medidor?.latitud && medidor?.longitud) {
      const url = `https://www.google.com/maps?q=${medidor.latitud},${medidor.longitud}`;
      window.open(url, '_blank');
    }
  };

  // ─── LOADING ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="section-placeholder">
        <RefreshCw className="w-16 h-16 mx-auto mb-4 text-gray-400 animate-spin" />
        <h2>Cargando mi medidor</h2>
        <p>Por favor espera mientras cargamos la información...</p>
      </div>
    );
  }

  // ─── ERROR ───────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="medidor-container">
        <div className="section-header">
          <div className="section-title">
            <Gauge className="w-7 h-7 text-blue-600" />
            <div>
              <h2>Información de Mis Medidores</h2>
              <p className="section-subtitle">Visualiza los datos de tus medidores de agua</p>
            </div>
          </div>
          <button className="btn-secondary" onClick={fetchMiMedidor} title="Actualizar información">
            <RefreshCw className="w-4 h-4" />
          </button>
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

  // ─── SIN DATOS ───────────────────────────────────────────────────────────────
  if (!medidorData || !medidorData.medidores || medidorData.medidores.length === 0) {
    return (
      <div className="medidor-container">
        <div className="section-header">
          <div className="section-title">
            <Gauge className="w-7 h-7 text-blue-600" />
            <div>
              <h2>Información de Mis Medidores</h2>
              <p className="section-subtitle">Visualiza los datos de tus medidores de agua</p>
            </div>
          </div>
          <button className="btn-secondary" onClick={fetchMiMedidor} title="Actualizar información">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <div className="medidor-empty-state">
          <Gauge size={64} />
          <h3>Sin medidores asignados</h3>
          <p>Contacta con el administrador para que te asigne un medidor</p>
        </div>
      </div>
    );
  }

  // ─── CONSTANTES PRINCIPALES ──────────────────────────────────────────────────
  const usuario = medidorData.afiliado?.usuario_sistema;
  const afiliado = medidorData.afiliado;
  const medidores = medidorData.medidores;
  const totalMedidores = medidorData.total_medidores;
  const medidor = medidores[medidorActivo]; // medidor actualmente seleccionado

  // ─── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div className="users-section">

      {/* HEADER */}
      <div className="section-header">
        <div className="section-title">
          <FileText className="w-7 h-7 text-blue-600" />
          <div>
            <h2>Información de Mis Medidores</h2>
            <p className="section-subtitle">
              Visualiza los datos de tus medidores de agua
              <span className="medidor-count-badge">{totalMedidores} medidor{totalMedidores !== 1 ? 'es' : ''}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-secondary" onClick={fetchMiMedidor} title="Actualizar información">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* TABS DE MEDIDORES (si hay más de uno) */}
      {medidores.length > 1 && (
        <div className="medidor-tabs">
          {medidores.map((m, idx) => (
            <button
              key={m.id_medidor}
              className={`medidor-tab ${medidorActivo === idx ? 'medidor-tab--active' : ''}`}
              onClick={() => setMedidorActivo(idx)}
            >
              <Gauge size={16} />
              <span>Medidor {m.num_medidor}</span>
              {m.activo
                ? <span className="tab-dot tab-dot--active" />
                : <span className="tab-dot tab-dot--inactive" />
              }
            </button>
          ))}
        </div>
      )}

      {/* LAYOUT PRINCIPAL */}
      <div className="medidor-layout">

        {/* SIDEBAR */}
        <div className="medidor-sidebar">
          <div className="medidor-sidebar-card">

            {/* Icono */}
            <div className="medidor-icon-container">
              <div className="medidor-icon-wrapper">
                <Gauge size={64} />
              </div>
            </div>

            {/* Código */}
            <div className="medidor-header-info">
              <h3 className="medidor-code">{medidor?.num_medidor || 'N/A'}</h3>
              <p className="medidor-label">Número de Medidor</p>
            </div>

            {/* Estado */}
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

            {/* Detalles */}
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
                  <span className="detail-value">
                    {medidor?.altitud ? `${medidor.altitud} m` : 'No especificado'}
                  </span>
                </div>
              </div>

              {medidores.length > 1 && (
                <div className="medidor-detail-item">
                  <Layers size={16} className="detail-icon" />
                  <div className="detail-content">
                    <span className="detail-label">Total de Medidores</span>
                    <span className="detail-value">{totalMedidores} medidor{totalMedidores !== 1 ? 'es' : ''} asignado{totalMedidores !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              )}
            </div>

            {/* GPS */}
            {medidor?.latitud && medidor?.longitud ? (
              <div className="medidor-gps-section">
                <h4 className="gps-title">
                  <MapPin size={16} />
                  Ubicación GPS
                </h4>
                <div className="gps-coordinates">
                  <div className="gps-coord">
                    <span className="gps-label">Latitud</span>
                    <span className="gps-value">{Number(medidor.latitud).toFixed(5)}</span>
                  </div>
                  <div className="gps-coord">
                    <span className="gps-label">Longitud</span>
                    <span className="gps-value">{Number(medidor.longitud).toFixed(5)}</span>
                  </div>
                </div>
                <button onClick={() => openGoogleMaps(medidor)} className="btn-map">
                  <Map size={16} />
                  Ver en Google Maps
                </button>
              </div>
            ) : (
              <div className="medidor-gps-section">
                <h4 className="gps-title">
                  <MapPin size={16} />
                  Ubicación GPS
                </h4>
                <div className="gps-no-coords">
                  <AlertCircle size={16} />
                  <span>Sin coordenadas registradas</span>
                </div>
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
                    <IdCard className="w-4 h-4" />
                    Cédula
                  </label>
                  <div className="info-values-medidor">{usuario?.cedula || 'N/A'}</div>
                </div>

                <div className="info-field">
                  <label className="info-label">
                    <User className="w-4 h-4" />
                    Nombre afiliado
                  </label>
                  <div className="info-values-medidor">
                    {usuario?.nombres && usuario?.apellidos
                      ? `${usuario.nombres} ${usuario.apellidos}`
                      : 'No especificado'}
                  </div>
                </div>

                <div className="info-field">
                  <label className="info-label">
                    <Mail className="w-4 h-4" />
                    Correo Electrónico
                  </label>
                  <div className="info-values-medidor">{usuario?.email || 'No especificado'}</div>
                </div>

                <div className="info-field">
                  <label className="info-label">
                    <Phone className="w-4 h-4" />
                    Teléfono
                  </label>
                  <div className="info-values-medidor">{usuario?.telefono || 'No especificado'}</div>
                </div>

                <div className="info-field info-field-full">
                  <label className="info-label">
                    <MapPin className="w-4 h-4" />
                    Dirección
                  </label>
                  <div className="info-values-medidor">{usuario?.direccion || 'No especificada'}</div>
                </div>

                <div className="info-field">
                  <label className="info-label">
                    <Map className="w-4 h-4" />
                    Sector del Afiliado
                  </label>
                  <div className="info-values-medidor">{afiliado?.sector?.nombre_sector || 'No especificado'}</div>
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
                    <IdCard className="w-4 h-4" />
                    Código de Afiliado
                  </label>
                  <div className="info-values-medidor">{afiliado?.cod_usuario_afi || 'N/A'}</div>
                </div>

                <div className="info-field">
                  <label className="info-label">
                    <Gauge className="w-4 h-4" />
                    Número de Medidor (actual)
                  </label>
                  <div className="info-values-medidor">{medidor?.num_medidor || 'No especificado'}</div>
                </div>

                <div className="info-field">
                  <label className="info-label">
                    <MapPin className="w-4 h-4" />
                    Sector del medidor
                  </label>
                  <div className="info-values-medidor">{medidor?.sector?.nombre_sector || 'No especificado'}</div>
                </div>

                <div className="info-field">
                  <label className="info-label">
                    <Calendar className="w-4 h-4" />
                    Fecha de Afiliación
                  </label>
                  <div className="info-values-medidor">{formatDate(afiliado?.fecha_afiliacion)}</div>
                </div>

                <div className="info-field">
                  <label className="info-label">
                    <Activity className="w-4 h-4" />
                    Estado
                  </label>
                  <div className="info-values-medidor">
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

          {/* Resumen de todos los medidores (mini-cards) */}
          {medidores.length > 1 && (
            <div className="medidor-info-card">
              <div className="info-card-header">
                <Layers size={20} />
                <h3>Todos mis Medidores</h3>
              </div>
              <div className="info-card-body">
                <div className="medidores-grid">
                  {medidores.map((m, idx) => (
                    <div
                      key={m.id_medidor}
                      className={`medidor-mini-card ${medidorActivo === idx ? 'medidor-mini-card--active' : ''}`}
                      onClick={() => setMedidorActivo(idx)}
                    >
                      <div className="mini-card-header">
                        <Gauge size={18} />
                        <span className="mini-card-num">{m.num_medidor}</span>
                        {m.activo
                          ? <span className="badge badge--success badge-sm"><CheckCircle size={10} /> Activo</span>
                          : <span className="badge badge--error badge-sm"><XCircle size={10} /> Inactivo</span>
                        }
                      </div>
                      <div className="mini-card-details">
                        <span><MapPin size={12} /> {m.sector?.nombre_sector || 'Sin sector'}</span>
                        <span><Activity size={12} /> {m.altitud ? `${m.altitud} m` : 'Sin altitud'}</span>
                        <span>
                          <Map size={12} />
                          {m.latitud && m.longitud ? 'GPS disponible' : 'Sin GPS'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Nota informativa */}
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
