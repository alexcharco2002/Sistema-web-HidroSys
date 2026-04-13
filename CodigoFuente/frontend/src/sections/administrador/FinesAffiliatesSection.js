// src/sections/FinesAffiliatesSection.js
// MÓDULO DE MULTAS — VERSIÓN CORREGIDA

import React, { useState, useEffect, useCallback } from 'react';
import './FinesAffiliatesSection.css';
import finesAffiliatesServices from '../../services/finesAffiliatesServices';
import fineService from '../../services/fineServices';
import authService from '../../services/authServices';
import {
  DollarSign, Search, Edit, Eye, Calendar, X, Save,
  RefreshCw, AlertCircle, CheckCircle, XCircle, Ban,
  FileText, UserCheck, Clock, ArrowUpDown, Receipt,
  User, IdCard, MapPin, Trash2, CalendarDays,
  ChevronDown
} from 'lucide-react';

const FinesAffiliatesSection = () => {

  // ── ESTADOS PRINCIPALES ─────────────────────────────────────
  const [multas, setMultas]               = useState([]);
  const [affiliates, setAffiliates]       = useState([]);
  const [tiposMulta, setTiposMulta]       = useState([]);
  const [stats, setStats]                 = useState(null);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState(null);

  // ── SELECCIÓN DE PERÍODO (flujo de dos pasos) ────────────────
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState(null);
  const [periodosData, setPeriodosData]               = useState([]);
  const [resumenPeriodos, setResumenPeriodos]          = useState({}); // { "2025-3": {total,pendientes,pagadas} }
  const [aniosExpandidos, setAniosExpandidos]          = useState({});
  const [loadingPeriodos, setLoadingPeriodos]          = useState(true);

  // ── MODAL ────────────────────────────────────────────────────
  const [showModal, setShowModal]             = useState(false);
  const [modalType, setModalType]             = useState('create');
  const [selectedMulta, setSelectedMulta]     = useState(null);
  const [affiliateSearchTerm, setAffiliateSearchTerm] = useState('');
  const [, setSelectedAffiliateInfo] = useState(null);

  const [formData, setFormData] = useState({
    id_usuario_afi: null, id_tipo_multa: null,
    monto: '', fecha_multa: '', observaciones: ''
  });
  const [pagoData, setPagoData]         = useState({ fecha_pago: '', observaciones: '' });
  const [anulacionData, setAnulacionData] = useState({ motivo: '', motivoPersonalizado: '' });

  const motivosAnulacion = [
    'Error en el registro de la multa', 'Multa duplicada', 'Afiliado incorrecto',
    'Monto incorrecto', 'Decisión administrativa', 'Apelación aceptada', 'Otro (especificar)'
  ];

  // ── FILTROS ──────────────────────────────────────────────────
  const [searchTerm, setSearchTerm]         = useState('');
  const [filterEstado, setFilterEstado]     = useState('all');
  const [filterTipoMulta, setFilterTipoMulta] = useState('all');
  const [sortBy, setSortBy]                 = useState('fecha');
  const [sortOrder, setSortOrder]           = useState('desc');

  // ── PERMISOS ─────────────────────────────────────────────────
  const [permissions, setPermissions] = useState({
    canCreate: false, canRead: false, canUpdate: false, canDelete: false
  });

  // ════════════════════════════════════════════════════════════
  //  HELPERS
  // ════════════════════════════════════════════════════════════
  const getAfiliadoNombre  = (m) => m.afiliado?.nombre_completo || 'N/A';
  const getAfiliadoCodigo  = (m) => m.afiliado?.cod_usuario_afi || 'N/A';
  const getAfiliadoCedula  = (m) => m.afiliado?.cedula || 'N/A';
  const getSectorNombre    = (m) => m.afiliado?.nombre_sector || 'N/A';
  const getTipoMultaNombre = (m) => m.tipo_multa?.nombre_multa || 'N/A';

  const formatCurrency = (v) =>
    new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(v || 0);

  const formatDate = (s) => {
    if (!s) return 'N/A';
    const [y, mo, d] = s.split('-');
    return new Date(y, mo - 1, d).toLocaleDateString('es-EC', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  const getMesNombre = (mes) => {
    const n = { 1:'Enero',2:'Febrero',3:'Marzo',4:'Abril',5:'Mayo',6:'Junio',
                7:'Julio',8:'Agosto',9:'Septiembre',10:'Octubre',11:'Noviembre',12:'Diciembre' };
    return n[parseInt(mes)] || '';
  };

  const getMesCorto = (mes) => {
    const n = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    return n[mes] || '';
  };

  // Texto + color por estado
  const estadoConfig = {
    pendiente:  { label: 'Pendiente',  color: '#d97706', bg: '#fef3c7', icon: Clock },
    pagada:     { label: 'Pagada',     color: '#059669', bg: '#d1fae5', icon: CheckCircle },
    anulada:    { label: 'Anulada',    color: '#dc2626', bg: '#fee2e2', icon: XCircle },
    exonerada:  { label: 'Exonerada',  color: '#4f46e5', bg: '#e0e7ff', icon: Ban },
    facturado:  { label: 'Facturado',  color: '#0369a1', bg: '#e0f2fe', icon: Receipt },
  };

  const EstadoBadge = ({ estado }) => {
    const cfg = estadoConfig[estado] || estadoConfig.pendiente;
    const Icon = cfg.icon;
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        padding: '3px 8px', borderRadius: '99px', fontSize: '0.75rem',
        fontWeight: 500, backgroundColor: cfg.bg, color: cfg.color,
        whiteSpace: 'nowrap'
      }}>
        <Icon style={{ width: 12, height: 12 }} />
        {cfg.label}
      </span>
    );
  };

  // ════════════════════════════════════════════════════════════
  //  PERMISOS
  // ════════════════════════════════════════════════════════════
  const loadUserPermissions = () => {
    const canCreate = authService.hasPermission('multasafiliados','crear')  || authService.hasPermission('multasafiliados','crud');
    const canUpdate = authService.hasPermission('multasafiliados','actualizar') || authService.hasPermission('multasafiliados','crud');
    const canDelete = authService.hasPermission('multasafiliados','eliminar') || authService.hasPermission('multasafiliados','crud');
    const canRead   = authService.hasPermission('multasafiliados','lectura') || canCreate || canUpdate || canDelete || authService.hasPermission('multas','crud');
    setPermissions({ canCreate, canRead, canUpdate, canDelete });
  };

  // ════════════════════════════════════════════════════════════
  //  CARGA DE PERÍODOS CON RESUMEN INCLUIDO
  // ════════════════════════════════════════════════════════════
  const loadPeriodosData = async () => {
    setLoadingPeriodos(true);
    try {
      const aniosResult = await finesAffiliatesServices.getAnios();
      if (!aniosResult.success || !aniosResult.data.length) { setLoadingPeriodos(false); return; }

      const todosLosPeriodos = [];

      for (const anio of aniosResult.data) {
        const mesesResult = await finesAffiliatesServices.getMesesPorAnio(anio);
        if (!mesesResult.success) continue;

        for (const mes of mesesResult.data) {
          todosLosPeriodos.push({ anio, mes: mes.mes, mes_nombre: mes.mes_nombre });
        }
      }

      setPeriodosData(todosLosPeriodos);

      // Cargar resúmenes de cada período en paralelo
      const resumenes = {};
      await Promise.all(
        todosLosPeriodos.map(async (p) => {
          try {
            const r = await finesAffiliatesServices.getResumenPeriodo(p.anio, p.mes);
            if (r.success) {
              resumenes[`${p.anio}-${p.mes}`] = r.data;
            }
          } catch (_) { /* silencioso */ }
        })
      );
      setResumenPeriodos(resumenes);

    } catch (e) {
      console.error('Error cargando períodos:', e);
    } finally {
      setLoadingPeriodos(false);
    }
  };

  const getResumen = (anio, mes) => resumenPeriodos[`${anio}-${mes}`] || null;

  // ════════════════════════════════════════════════════════════
  //  FETCH MULTAS (con filtro tipo_multa al backend)
  // ════════════════════════════════════════════════════════════
  const fetchMultas = useCallback(async () => {
    if (!permissions.canRead || !periodoSeleccionado) return;
    setLoading(true);
    setError(null);
    try {
      const filters = {
        anio: periodoSeleccionado.anio,
        mes:  periodoSeleccionado.mes,
      };
      if (filterEstado !== 'all')    filters.estado        = filterEstado;
      if (filterTipoMulta !== 'all') filters.id_tipo_multa = parseInt(filterTipoMulta);

      const result = await finesAffiliatesServices.getMultas(filters);
      if (result.success) setMultas(result.data);
      else setError(result.message);
    } catch (e) {
      setError('Error al cargar multas desde el servidor');
    } finally {
      setLoading(false);
    }
  }, [permissions.canRead, periodoSeleccionado, filterEstado, filterTipoMulta]);

  const fetchStats = useCallback(async () => {
    if (!periodoSeleccionado) return;
    try {
      const result = await finesAffiliatesServices.getMultasStats({
        anio: periodoSeleccionado.anio,
        mes:  periodoSeleccionado.mes,
      });
      if (result.success) setStats(result.data);
    } catch (e) { console.error('Error stats:', e); }
  }, [periodoSeleccionado]);

  const loadTiposMulta = async () => {
    try {
      const r = await fineService.getTiposMulta({ activo: true, esvigente: true });
      if (r.success) setTiposMulta(r.data);
    } catch (e) { console.error('Error tipos multa:', e); }
  };

  const loadAffiliates = async () => {
    try {
      const r = await finesAffiliatesServices.getAvailableAffiliates();
      if (r.success) setAffiliates(r.data);
    } catch (e) { console.error('Error afiliados:', e); }
  };

  // ════════════════════════════════════════════════════════════
  //  EFECTOS
  // ════════════════════════════════════════════════════════════
  useEffect(() => {
    loadUserPermissions();
    loadTiposMulta();
    loadPeriodosData();
  }, []);

  useEffect(() => {
    if (permissions.canRead && periodoSeleccionado) {
      fetchMultas();
      fetchStats();
    }
  }, [permissions.canRead, periodoSeleccionado, filterEstado, filterTipoMulta, fetchMultas, fetchStats]);

  // ════════════════════════════════════════════════════════════
  //  SELECCIÓN DE PERÍODO
  // ════════════════════════════════════════════════════════════
  const handlePeriodoChange = (mes, anio) => {
    setPeriodoSeleccionado({ mes, anio });
    setSearchTerm('');
    setFilterEstado('all');
    setFilterTipoMulta('all');
  };

  const toggleAnio = (anio) =>
    setAniosExpandidos(prev => ({ ...prev, [anio]: prev[anio] === false ? true : false }));

  // ════════════════════════════════════════════════════════════
  //  FILTRADO LOCAL (búsqueda de texto + sort)
  // ════════════════════════════════════════════════════════════
  const filteredMultas = multas
    .filter(m => {
      if (!searchTerm) return true;
      const q = searchTerm.toLowerCase();
      return (
        m.id_multa_afi.toString().includes(q) ||
        m.afiliado?.nombre_completo?.toLowerCase().includes(q) ||
        m.afiliado?.cedula?.includes(q) ||
        m.afiliado?.cod_usuario_afi?.toString().includes(q) ||
        m.afiliado?.nombre_sector?.toLowerCase().includes(q) ||
        m.tipo_multa?.nombre_multa?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const prio = { pagada:1, pendiente:2, exonerada:3, anulada:4 };
      const pa = prio[a.estado] || 5, pb = prio[b.estado] || 5;
      if (pa !== pb) return pa - pb;

      let cmp = 0;
      if (sortBy === 'fecha')    cmp = new Date(a.fecha_multa) - new Date(b.fecha_multa);
      else if (sortBy === 'monto') cmp = parseFloat(a.monto) - parseFloat(b.monto);
      else if (sortBy === 'afiliado') cmp = getAfiliadoNombre(a).localeCompare(getAfiliadoNombre(b), 'es');
      else cmp = a.id_multa_afi - b.id_multa_afi;
      return sortOrder === 'asc' ? cmp : -cmp;
    });

  const filteredAffiliates = affiliates.filter(aff => {
    if (!affiliateSearchTerm.trim()) return true;
    const q = affiliateSearchTerm.toLowerCase();
    return (
      `${aff.nombres} ${aff.apellidos}`.toLowerCase().includes(q) ||
      (aff.cedula || '').toLowerCase().includes(q) ||
      String(aff.cod_usuario_afi || '').includes(q)
    );
  });

  // ════════════════════════════════════════════════════════════
  //  ELIMINAR
  // ════════════════════════════════════════════════════════════
  const handleEliminar = async (multa) => {
    if (multa.estado !== 'anulada') { alert('⚠️ Solo se pueden eliminar multas anuladas'); return; }
    if (!permissions.canDelete)      { alert('❌ Sin permiso'); return; }
    if (!window.confirm(
      `¿Eliminar permanentemente la multa #${multa.id_multa_afi}?\n` +
      `Afiliado: ${getAfiliadoNombre(multa)}\nMonto: ${formatCurrency(multa.monto)}\n\nEsta acción NO se puede deshacer.`
    )) return;

    try {
      const r = await finesAffiliatesServices.deleteMulta(multa.id_multa_afi);
      if (r.success) {
        alert(`✅ Multa #${multa.id_multa_afi} eliminada.`);
        await fetchMultas(); await fetchStats();
      } else alert(r.message || '⚠️ No se pudo eliminar');
    } catch (e) { alert('❌ Error: ' + e.message); }
  };

  // ════════════════════════════════════════════════════════════
  //  MODAL HANDLERS (abrir, cerrar, cambios en formulario)
  // ════════════════════════════════════════════════════════════
  const openModal = async (type, multa = null) => {
    if (type === 'create' && !permissions.canCreate) { alert('❌ Sin permiso para crear'); return; }
    if ((type === 'edit' || type === 'pagar') && !permissions.canUpdate) { alert('❌ Sin permiso'); return; }
    if (type === 'anular' && !permissions.canDelete) { alert('❌ Sin permiso para anular'); return; }

    setModalType(type); setSelectedMulta(multa); setError(null);

    if (type === 'create') {
      await loadAffiliates();
      setFormData({
        id_usuario_afi: null, id_tipo_multa: tiposMulta[0]?.id_tipo_multa || null,
        monto: tiposMulta[0]?.monto || '', fecha_multa: new Date().toLocaleDateString('en-CA'),
        observaciones: ''
      });
      setAffiliateSearchTerm(''); setSelectedAffiliateInfo(null);
    } else if (type === 'edit' && multa) {
      setFormData({ id_tipo_multa: multa.id_tipo_multa, observaciones: multa.observaciones || '', activo: multa.activo });
    } else if (type === 'pagar') {
      setPagoData({ fecha_pago: new Date().toISOString().split('T')[0], observaciones: '' });
    } else if (type === 'anular') {
      setAnulacionData({ motivo: '', motivoPersonalizado: '' });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false); setSelectedMulta(null); setError(null);
    setAffiliateSearchTerm(''); setSelectedAffiliateInfo(null);
  };

  const handleAffiliateChange = (id) => {
    const aff = affiliates.find(a => a.id_usuario_afi === parseInt(id));
    setFormData(f => ({ ...f, id_usuario_afi: parseInt(id) }));
    setSelectedAffiliateInfo(aff || null);
  };

  // ════════════════════════════════════════════════════════════
  //  CRUD HANDLERS
  // ════════════════════════════════════════════════════════════
  const handleSubmit = async (e) => {
    e.preventDefault(); setError(null);
    try {
      let r;
      if (modalType === 'create') {
        r = await finesAffiliatesServices.createMulta(formData);
        if (r.success) { alert(`✅ Multa creada. ID: ${r.data.id_multa_afi}`); await fetchMultas(); await fetchStats(); closeModal(); }
        else setError(r.message || 'Error al crear');
      } else if (modalType === 'edit') {
        r = await finesAffiliatesServices.updateMulta(selectedMulta.id_multa_afi, formData);
        if (r.success) { alert('✅ Multa actualizada'); await fetchMultas(); await fetchStats(); closeModal(); }
        else setError(r.message || 'Error al actualizar');
      }
    } catch (e) { setError(e.message || 'Error al guardar'); }
  };

  const handlePago = async (e) => {
    e.preventDefault(); setError(null);
    if (!permissions.canUpdate) { setError('Sin permiso'); return; }
    try {
      const r = await finesAffiliatesServices.registrarPago(selectedMulta.id_multa_afi, pagoData);
      if (r.success) { alert(`✅ Pago registrado para multa #${selectedMulta.id_multa_afi}`); await fetchMultas(); await fetchStats(); closeModal(); }
      else setError(r.message || 'Error al registrar pago');
    } catch (e) { setError(e.message); }
  };

  const handleAnular = async (e) => {
    e.preventDefault();
    if (!permissions.canDelete) { alert('❌ Sin permiso'); return; }
    const motivoFinal = anulacionData.motivo === 'Otro (especificar)'
      ? anulacionData.motivoPersonalizado : anulacionData.motivo;
    if (!motivoFinal || motivoFinal.trim().length < 10) { setError('El motivo debe tener al menos 10 caracteres'); return; }
    try {
      const r = await finesAffiliatesServices.anularMulta(selectedMulta.id_multa_afi, motivoFinal);
      if (r.success) { alert('✅ Multa anulada'); await fetchMultas(); await fetchStats(); closeModal(); }
      else setError(r.message || 'Error al anular');
    } catch (e) { setError(e.message); }
  };

  // ════════════════════════════════════════════════════════════
  //  GUARD
  // ════════════════════════════════════════════════════════════
  if (!permissions.canRead) {
    return (
      <div className="section-placeholder">
        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
        <h2>Acceso Denegado</h2>
        <p>No tienes permiso para acceder al módulo de multas.</p>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════════════════
  return (
    <div className="affiliates-section">

      {/* ══════════════ PASO 1: SELECCIÓN DE PERÍODO ══════════════ */}
      {!periodoSeleccionado && (
        <div className="periodo-selection-page">

          {/* Header */}
          <div className="section-header">
            <div className="section-title">
              <Receipt className="w-7 h-7 text-blue-600" />
              <div>
                <h2>Gestión de Multas a Afiliados</h2>
                <p className="section-subtitle">Selecciona un período para gestionar las multas</p>
              </div>
            </div>
          </div>

          {/* ── Períodos recientes ── */}
          <div className="periodo-selector-container">
            <div className="periodo-selector-header">
              <div>
                <h3><CalendarDays className="w-5 h-5 text-blue-600 mr-2" />Períodos Recientes</h3>
                <p className="periodo-selector-subtitle">Mes actual ± 2 meses</p>
              </div>
            </div>

            {loadingPeriodos ? (
              <div className="empty-state" style={{ padding: '2rem' }}>
                <RefreshCw className="w-10 h-10 text-blue-400 mx-auto mb-2 animate-spin" />
                <p>Cargando períodos...</p>
              </div>
            ) : (
              <div className="periodos-grid">
                {(() => {
                  const hoy = new Date();
                  const mesActual  = hoy.getMonth() + 1;
                  const anioActual = hoy.getFullYear();
                  const diff = (mes, anio) => (anio - anioActual) * 12 + (mes - mesActual);

                  const recientes = periodosData
                    .filter(p => diff(p.mes, p.anio) >= -2 && diff(p.mes, p.anio) <= 2)
                    .sort((a, b) => a.anio !== b.anio ? b.anio - a.anio : b.mes - a.mes);

                  if (!recientes.length) return (
                    <div className="periodo-historial-empty">
                      <AlertCircle className="w-12 h-12 text-gray-300 mb-2" />
                      <p>No hay períodos recientes con multas</p>
                    </div>
                  );

                  return recientes.map(p => {
                    const esActual = p.mes === mesActual && p.anio === anioActual;
                    const res      = getResumen(p.anio, p.mes);
                    return (
                      <button
                        key={`${p.mes}-${p.anio}`}
                        onClick={() => handlePeriodoChange(p.mes, p.anio)}
                        className={`periodo-card hoverable ${esActual ? 'mes-actual' : ''}`}
                      >
                        <div className="periodo-card-header">
                          <span className="periodo-card-title">{p.mes_nombre} {p.anio}</span>
                          {esActual && <span className="periodo-badge-actual">Actual</span>}
                        </div>

                        {/* Resumen de multas dentro de la card */}
                        {res ? (
                          <div className="periodo-card-resumen">
                            <span className="resumen-item total">
                              <FileText style={{ width: 12, height: 12 }} />
                              {res.total} multas
                            </span>
                            {res.pendientes > 0 && (
                              <span className="resumen-item pendiente">
                                <Clock style={{ width: 12, height: 12 }} />
                                {res.pendientes} pend.
                              </span>
                            )}
                            {res.pagadas > 0 && (
                              <span className="resumen-item pagada">
                                <CheckCircle style={{ width: 12, height: 12 }} />
                                {res.pagadas} pag.
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="periodo-card-resumen">
                            <span className="resumen-item total">Sin multas</span>
                          </div>
                        )}

                        <div className="periodo-card-action"><span>Ver multas</span></div>
                      </button>
                    );
                  });
                })()}
              </div>
            )}
          </div>

          {/* ── Historial ── */}
          <div className="periodo-historial-container">
            <div className="periodo-historial-header">
              <div>
                <h3 className="font-semibold text-[16px] flex items-center">
                  <Clock className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0" />
                  Historial de Períodos
                </h3>
                <p className="periodo-historial-subtitle text-[14px]">Períodos anteriores con multas registradas</p>
              </div>
            </div>

            {(() => {
              const hoy = new Date();
              const mesActual  = hoy.getMonth() + 1;
              const anioActual = hoy.getFullYear();
              const diff = (mes, anio) => (anio - anioActual) * 12 + (mes - mesActual);

              const historial = periodosData.filter(p => diff(p.mes, p.anio) < -2);

              if (!historial.length) return (
                <div className="periodo-historial-empty">
                  <AlertCircle className="w-12 h-12 text-gray-300 mb-2" />
                  <p>No hay períodos anteriores con multas</p>
                </div>
              );

              const agrupado = historial.reduce((acc, p) => {
                if (!acc[p.anio]) acc[p.anio] = [];
                acc[p.anio].push(p);
                return acc;
              }, {});
              const aniosOrdenados = Object.keys(agrupado).map(Number).sort((a, b) => b - a);

              return (
                <div className="historial-anios-lista">
                  {aniosOrdenados.map(anio => {
                    const meses       = agrupado[anio].sort((a, b) => b.mes - a.mes);
                    const expandido   = aniosExpandidos[anio] !== false;
                    return (
                      <div key={anio} className="historial-anio-bloque">
                        <button className="historial-anio-header" onClick={() => toggleAnio(anio)}>
                          <span className="historial-anio-label">
                            <Calendar className="w-4 h-4" />
                            {anio}
                            <span className="historial-anio-badge">
                              {meses.length} período{meses.length !== 1 ? 's' : ''}
                            </span>
                          </span>
                          <ChevronDown className={`w-4 h-4 historial-chevron ${expandido ? 'open' : ''}`} />
                        </button>

                        {expandido && (
                          <div className="historial-meses-grid">
                            {meses.map(p => {
                              const res = getResumen(p.anio, p.mes);
                              return (
                                <button
                                  key={`${p.mes}-${p.anio}`}
                                  className="historial-mes-chip completo"
                                  onClick={() => handlePeriodoChange(p.mes, p.anio)}
                                  title={res ? `${res.total} multas · ${res.pendientes} pend.` : `${p.mes_nombre} ${p.anio}`}
                                >
                                  <span className="historial-mes-dot completo" />
                                  <span className="historial-mes-nombre">{getMesCorto(p.mes)}</span>
                                  {res && res.total > 0 && (
                                    <span className="historial-mes-pct">{res.total}</span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ══════════════ PASO 2: GESTIÓN DE MULTAS ══════════════ */}
      {periodoSeleccionado && (
        <div className="periodo-management-page">

          {/* Header con volver */}
          <div className="section-header">
            <div className="section-title-with-back">
              <button className="btn-back" onClick={() => setPeriodoSeleccionado(null)}>
                <ArrowUpDown className="w-5 h-5" style={{ transform: 'rotate(90deg)' }} />
                <span>Volver</span>
              </button>
              <div className="section-title">
                <Receipt className="w-7 h-7 text-blue-600" />
                <div>
                  <h2>Multas — {getMesNombre(periodoSeleccionado.mes)} {periodoSeleccionado.anio}</h2>
                  <p className="section-subtitle">Gestiona las multas de este período</p>
                </div>
              </div>
            </div>
            {permissions.canCreate && (
              <button className="btn-primary" onClick={() => openModal('create')}>
                <DollarSign className="w-4 h-4 mr-2" />Nueva Multa
              </button>
            )}
          </div>

          {/* Stats */}
          {stats && (
            <div className="periodo-stats-container">
              <div className="periodo-stats-header">
                <FileText className="w-5 h-5 text-blue-600 mr-2" /><h3>Resumen del Período</h3>
              </div>
              <div className="users-stats">
                <div className="stat-item">
                  <FileText className="stat-icon text-blue-600" />
                  <div><p className="stat-label">Total</p><p className="stat-value">{stats.total_multas||0}</p>
                  <span className="stat-detail">{formatCurrency(stats.monto_total)}</span></div>
                </div>
                <div className="stat-item active orange">
                  <Clock className="stat-icon text-orange-600" />
                  <div><p className="stat-label">Pendientes</p><p className="stat-value">{stats.pendientes||0}</p>
                  <span className="stat-detail">{formatCurrency(stats.monto_pendiente)}</span></div>
                </div>
                <div className="stat-item active green">
                  <CheckCircle className="stat-icon text-green-600" />
                  <div><p className="stat-label">Pagadas</p><p className="stat-value">{stats.pagadas||0}</p>
                  <span className="stat-detail">{formatCurrency(stats.monto_pagado)}</span></div>
                </div>
                <div className="stat-item active red">
                  <XCircle className="stat-icon text-red-600" />
                  <div><p className="stat-label">Anuladas</p><p className="stat-value">{stats.anuladas||0}</p></div>
                </div>
                <div className="stat-item active purple">
                  <Ban className="stat-icon text-purple-600" />
                  <div><p className="stat-label">Exoneradas</p><p className="stat-value">{stats.exoneradas||0}</p></div>
                </div>
                <div className="stat-item active blue">
                  <Receipt className="stat-icon text-blue-600" />
                  <div><p className="stat-label">Facturadas</p><p className="stat-value">{stats.facturadas||0}</p>
                  <span className="stat-detail">{formatCurrency(stats.monto_facturado)}</span></div>
                </div>
              </div>
            </div>
          )}

          {/* Filtros */}
          <div className="filters-section">
            <div className="search-container">
              <Search className="search-icon" />
              <input
                type="text"
                placeholder="Buscar por nombre, código, cédula, sector, tipo..."
                className="search-input"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="filters-right">
              <select className="filter-select" value={filterEstado} onChange={e => setFilterEstado(e.target.value)}>
                <option value="all">Todos los estados</option>
                <option value="pendiente">Pendiente</option>
                <option value="pagada">Pagada</option>
                <option value="anulada">Anulada</option>
                <option value="exonerada">Exonerada</option>
                <option value="facturado">Facturado</option>
              </select>

              {/* FILTRO TIPO MULTA — ahora sí funciona (va al backend) */}
              <select className="filter-select" value={filterTipoMulta} onChange={e => setFilterTipoMulta(e.target.value)}>
                <option value="all">Todos los tipos</option>
                {tiposMulta.map(t => (
                  <option key={t.id_tipo_multa} value={t.id_tipo_multa}>{t.nombre_multa}</option>
                ))}
              </select>

              <select className="filter-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                <option value="fecha">Por Fecha</option>
                <option value="monto">Por Monto</option>
                <option value="afiliado">Por Afiliado</option>
              </select>

              <button className="btn-secondary" onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}>
                <ArrowUpDown className="w-4 h-4" />
                <span className="ml-1 text-xs">{sortOrder === 'asc' ? '↑' : '↓'}</span>
              </button>

              <button className="btn-secondary" onClick={fetchMultas} title="Recargar">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="alert alert-error mb-4">
              <AlertCircle className="w-5 h-5 mr-2" />{error}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="empty-state">
              <RefreshCw className="w-12 h-12 text-blue-400 mx-auto mb-4 animate-spin" />
              <h3>Cargando multas...</h3>
            </div>
          )}
{/* Tabla */}
{!loading && (
  <div className="fines-table-container">
    <div className="fines-table-inner">

      <div className="fines-table-header">
        <span>#</span>
        <span><User className="w-4 h-4" /> Afiliado</span>
        <span>Código</span>
        <span><IdCard className="w-4 h-4" /> Cédula</span>
        <span><MapPin className="w-4 h-4" /> Sector</span>
        <span>Tipo Multa</span>
        <span><DollarSign className="w-4 h-4" /> Monto</span>
        <span><Calendar className="w-4 h-4" /> Fecha</span>
        <span>Estado</span>
        <span>Acciones</span>
      </div>

      <div className="fines-table-body">
        {filteredMultas.length > 0 ? filteredMultas.map((m, i) => (
          <div
            key={m.id_multa_afi}
            className={`fines-table-item ${m.estado === 'anulada' ? 'inactive' : ''}`}
          >
            <div className="fines-col-id">{i + 1}</div>

            <div className="fines-col-nombre">
              <User className="w-4 h-4" />{getAfiliadoNombre(m)}
            </div>

            <div className="fines-col-codigo">{getAfiliadoCodigo(m)}</div>

            <div className="fines-col-codigo">{getAfiliadoCedula(m)}</div>

            <div className="fines-col-sector">
              <MapPin className="w-4 h-4" />{getSectorNombre(m)}
            </div>

            <div className="fines-col-tipo">{getTipoMultaNombre(m)}</div>

            <div className={`fines-col-monto ${m.estado}`}>
              {formatCurrency(m.monto)}
            </div>

            <div className="fines-col-fecha">
              <Calendar className="w-3 h-3" />
              {formatDate(m.fecha_multa)}
            </div>

            <div className="fines-status-wrapper">
              <EstadoBadge estado={m.estado} />
            </div>

            <div className="fines-actions">
              <button className="fines-action-btn view" onClick={() => openModal('view', m)} title="Ver detalles">
                <Eye className="w-4 h-4" />
              </button>
              {m.estado === 'pendiente' && permissions.canUpdate && (
                <>
                  <button className="fines-action-btn edit" onClick={() => openModal('pagar', m)} title="Registrar pago">
                    <CheckCircle className="w-4 h-4" />
                  </button>
                  <button className="fines-action-btn confirm" onClick={() => openModal('edit', m)} title="Editar">
                    <Edit className="w-4 h-4" />
                  </button>
                </>
              )}
              {m.estado === 'pendiente' && permissions.canDelete && (
                <button className="fines-action-btn delete" onClick={() => openModal('anular', m)} title="Anular">
                  <Ban className="w-4 h-4" />
                </button>
              )}
              {permissions.canDelete && m.estado === 'anulada' && (
                <button className="fines-action-btn delete" onClick={() => handleEliminar(m)} title="Eliminar permanentemente">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )) : (
          <div className="fines-table-empty">
            <Receipt />
            <h3>No hay multas en este período</h3>
            <p>No se encontraron multas para {getMesNombre(periodoSeleccionado.mes)} {periodoSeleccionado.anio}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      {filteredMultas.length > 0 && (
        <div className="fines-table-footer">
          <button className="btn-secondary" onClick={() => setPeriodoSeleccionado(null)}>
            <ArrowUpDown className="w-4 h-4 mr-2" style={{ transform: 'rotate(90deg)' }} />
            Cambiar período
          </button>
          <div className="fines-table-footer-stats">
            <span>Mostrando <strong>{filteredMultas.length}</strong> multas</span>
            <span>Pendiente: <strong style={{ color: '#dc2626' }}>
              {formatCurrency(filteredMultas.filter(m => m.estado === 'pendiente').reduce((s, m) => s + parseFloat(m.monto || 0), 0))}
            </strong></span>
            <span>Cobrado: <strong style={{ color: '#059669' }}>
              {formatCurrency(filteredMultas.filter(m => m.estado === 'pagada').reduce((s, m) => s + parseFloat(m.monto || 0), 0))}
            </strong></span>
          </div>
        </div>
      )}

    </div>
  </div>
)}
             
        </div>
      
      )}

      {/* ══════════════ MODALES ══════════════ */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>
                {modalType === 'create' && 'Nueva Multa'}
                {modalType === 'edit'   && 'Editar Multa'}
                {modalType === 'pagar'  && 'Registrar Pago'}
                {modalType === 'anular' && 'Anular Multa'}
                {modalType === 'view'   && 'Detalles de Multa'}
              </h3>
              <button className="modal-close" onClick={closeModal}><X className="w-5 h-5" /></button>
            </div>

            <div className="modal-body">
              {error && <div className="alert alert-error mb-4"><AlertCircle className="w-5 h-5 mr-2" />{error}</div>}

              {/* VIEW */}
              {modalType === 'view' && selectedMulta && (
                <div className="user-details">
                  <div className="detail-group"><label>ID Multa:</label><p className="font-semibold text-blue-600">#{selectedMulta.id_multa_afi}</p></div>
                  <div className="detail-group"><label>Estado:</label><EstadoBadge estado={selectedMulta.estado} /></div>
                  <div className="detail-group" style={{gridColumn:'1/-1',marginTop:'1rem'}}>
                    <label className="text-blue-600 font-semibold flex items-center gap-2"><UserCheck className="w-4 h-4" />Información del Afiliado</label>
                  </div>
                  <div className="detail-group"><label>Nombre:</label><p className="font-semibold">{getAfiliadoNombre(selectedMulta)}</p></div>
                  <div className="detail-group"><label>Código:</label><p className="font-semibold">{getAfiliadoCodigo(selectedMulta)}</p></div>
                  <div className="detail-group"><label>Cédula:</label><p className="font-semibold">{getAfiliadoCedula(selectedMulta)}</p></div>
                  <div className="detail-group"><label>Sector:</label><p className="font-semibold">{getSectorNombre(selectedMulta)}</p></div>
                  <div className="detail-group" style={{gridColumn:'1/-1',marginTop:'1rem'}}>
                    <label className="text-orange-600 font-semibold flex items-center gap-2"><FileText className="w-4 h-4" />Detalles de la Multa</label>
                  </div>
                  <div className="detail-group"><label>Tipo:</label><p className="font-semibold">{getTipoMultaNombre(selectedMulta)}</p></div>
                  <div className="detail-group"><label>Monto:</label><p className="text-xl font-bold text-red-600">{formatCurrency(selectedMulta.monto)}</p></div>
                  <div className="detail-group"><label>Fecha Multa:</label><p className="font-semibold">{formatDate(selectedMulta.fecha_multa)}</p></div>
                  <div className="detail-group">
                    <label>Fecha Pago:</label>
                    <p className={selectedMulta.fecha_pago ? 'font-semibold text-green-600' : 'text-gray-400'}>
                      {formatDate(selectedMulta.fecha_pago)}
                    </p>
                  </div>
                  {selectedMulta.observaciones && (
                    <div className="detail-group" style={{gridColumn:'1/-1'}}>
                      <label>Observaciones:</label>
                      <p className="text-sm text-gray-700 bg-yellow-50 p-3 rounded border-l-4 border-yellow-400">{selectedMulta.observaciones}</p>
                    </div>
                  )}
                  {selectedMulta.estado === 'pendiente' && permissions.canUpdate && (
                    <div style={{gridColumn:'1/-1',marginTop:'1.5rem'}}>
                      <button className="btn-primary w-full" onClick={() => { closeModal(); openModal('pagar', selectedMulta); }}>
                        <CheckCircle className="w-4 h-4 mr-2" />Registrar Pago de {formatCurrency(selectedMulta.monto)}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* CREATE */}
              {modalType === 'create' && (
                <form onSubmit={handleSubmit} className="user-form">
                  <div className="form-grid">
                    <div className="form-group form-group-full">
                      <label>Afiliado: *</label>
                      <div className="meter-search-container">
                        <div className="meter-search-input-wrapper">
                          <Search className="w-4 h-4 text-gray-400" />
                          <input type="text" placeholder="Buscar por código, nombre o cédula..."
                            value={affiliateSearchTerm} onChange={e => setAffiliateSearchTerm(e.target.value)} />
                          {affiliateSearchTerm && (
                            <button type="button" onClick={() => setAffiliateSearchTerm('')} className="meter-search-clear-btn">
                              <X className="w-4 h-4 text-gray-400" />
                            </button>
                          )}
                        </div>
                      </div>
                      <select value={formData.id_usuario_afi || ''} onChange={e => handleAffiliateChange(e.target.value)} required>
                        <option value="">Seleccionar afiliado</option>
                        {filteredAffiliates.map(a => (
                          <option key={a.id_usuario_afi} value={a.id_usuario_afi}>
                            {a.cod_usuario_afi} — {a.nombres} {a.apellidos} · CI: {a.cedula}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Tipo de Multa: *</label>
                      <select value={formData.id_tipo_multa || ''} onChange={e => {
                        const id = parseInt(e.target.value);
                        const t  = tiposMulta.find(x => x.id_tipo_multa === id);
                        setFormData(f => ({ ...f, id_tipo_multa: id, monto: t?.monto || '' }));
                      }} required>
                        <option value="">Seleccionar tipo</option>
                        {tiposMulta.map(t => (
                          <option key={t.id_tipo_multa} value={t.id_tipo_multa}>
                            {t.nombre_multa} — {formatCurrency(t.monto)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Monto: *</label>
                      <input type="number" step="0.01" min="0" value={formData.monto} readOnly className="bg-gray-100 font-semibold" />
                      <small className="text-gray-500 text-xs mt-1">Se establece automáticamente según el tipo</small>
                    </div>

                    <div className="form-group">
                      <label>Fecha Multa:</label>
                      <input type="date" value={formData.fecha_multa} onChange={e => setFormData(f => ({ ...f, fecha_multa: e.target.value }))} />
                    </div>

                    <div className="form-group form-group-full">
                      <label>Observaciones:</label>
                      <textarea value={formData.observaciones} onChange={e => setFormData(f => ({ ...f, observaciones: e.target.value }))} rows="3" placeholder="Observaciones sobre la multa..." />
                    </div>
                  </div>
                  <div className="form-actions">
                    <button type="button" className="btn-secondary" onClick={closeModal}><X className="w-4 h-4 mr-2" />Cancelar</button>
                    <button type="submit" className="btn-primary"><Save className="w-4 h-4 mr-2" />Crear Multa</button>
                  </div>
                </form>
              )}

              {/* EDIT */}
              {modalType === 'edit' && selectedMulta && (
                <form onSubmit={handleSubmit} className="user-form">
                  <div className="alert alert-info mb-4">
                    <AlertCircle className="w-5 h-5 mr-2" />
                    <p className="text-sm">Solo puedes modificar el tipo de multa y las observaciones.</p>
                  </div>
                  <div className="user-details mb-4">
                    <div className="detail-group"><label>Afiliado:</label><p>{getAfiliadoNombre(selectedMulta)}</p></div>
                    <div className="detail-group"><label>Cédula:</label><p>{getAfiliadoCedula(selectedMulta)}</p></div>
                    <div className="detail-group"><label>Monto Actual:</label><p className="text-lg font-bold">{formatCurrency(selectedMulta.monto)}</p></div>
                    <div className="detail-group"><label>Fecha Multa:</label><p>{formatDate(selectedMulta.fecha_multa)}</p></div>
                  </div>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Tipo de Multa: *</label>
                      <select value={formData.id_tipo_multa || ''} onChange={e => setFormData(f => ({ ...f, id_tipo_multa: parseInt(e.target.value) }))} required>
                        <option value="">Seleccionar tipo</option>
                        {tiposMulta.map(t => (
                          <option key={t.id_tipo_multa} value={t.id_tipo_multa}>{t.nombre_multa} — {formatCurrency(t.monto)}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Estado:</label>
                      <select value={formData.activo} onChange={e => setFormData(f => ({ ...f, activo: e.target.value === 'true' }))}>
                        <option value="true">Activo</option>
                        <option value="false">Inactivo</option>
                      </select>
                    </div>
                    <div className="form-group form-group-full">
                      <label>Observaciones:</label>
                      <textarea value={formData.observaciones} onChange={e => setFormData(f => ({ ...f, observaciones: e.target.value }))} rows="3" />
                    </div>
                  </div>
                  <div className="form-actions">
                    <button type="button" className="btn-secondary" onClick={closeModal}>Cancelar</button>
                    <button type="submit" className="btn-primary"><Save className="w-4 h-4 mr-2" />Guardar Cambios</button>
                  </div>
                </form>
              )}

              {/* PAGAR */}
              {modalType === 'pagar' && selectedMulta && (
                <form onSubmit={handlePago} className="user-form">
                  <div className="alert alert-info mb-4">
                    <FileText className="w-5 h-5 mr-2" />
                    <div>
                      <h4 className="font-semibold">Resumen de Pago</h4>
                      <p className="text-sm mt-1"><strong>Afiliado:</strong> {getAfiliadoNombre(selectedMulta)}</p>
                      <p className="text-sm"><strong>Tipo:</strong> {getTipoMultaNombre(selectedMulta)}</p>
                      <p className="text-sm"><strong>Monto:</strong> <span className="font-bold text-lg">{formatCurrency(selectedMulta.monto)}</span></p>
                    </div>
                  </div>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Fecha de Pago:</label>
                      <input type="date" value={pagoData.fecha_pago} onChange={e => setPagoData(p => ({ ...p, fecha_pago: e.target.value }))} max={new Date().toISOString().split('T')[0]} />
                    </div>
                    <div className="form-group form-group-full">
                      <label>Observaciones del Pago:</label>
                      <textarea value={pagoData.observaciones} onChange={e => setPagoData(p => ({ ...p, observaciones: e.target.value }))} rows="3" placeholder="Número de comprobante, método de pago, etc..." />
                    </div>
                  </div>
                  <div className="form-actions">
                    <button type="button" className="btn-secondary" onClick={closeModal}>Cancelar</button>
                    <button type="submit" className="btn-primary"><CheckCircle className="w-4 h-4 mr-2" />Confirmar Pago</button>
                  </div>
                </form>
              )}

              {/* ANULAR */}
              {modalType === 'anular' && selectedMulta && (
                <form onSubmit={handleAnular} className="user-form">
                  <div className="alert alert-error mb-4">
                    <AlertCircle className="w-6 h-6 mr-3" />
                    <div>
                      <h4 className="font-semibold text-lg mb-2">¿Anular esta multa?</h4>
                      <p className="text-sm"><strong>ID:</strong> #{selectedMulta.id_multa_afi}</p>
                      <p className="text-sm"><strong>Afiliado:</strong> {getAfiliadoNombre(selectedMulta)}</p>
                      <p className="text-sm"><strong>Tipo:</strong> {getTipoMultaNombre(selectedMulta)}</p>
                      <p className="text-sm"><strong>Monto:</strong> {formatCurrency(selectedMulta.monto)}</p>
                      <p className="text-sm font-semibold mt-2 text-red-700">Esta acción no se puede deshacer.</p>
                    </div>
                  </div>
                  <div className="form-grid">
                    <div className="form-group form-group-full">
                      <label>Motivo de Anulación: *</label>
                      <select value={anulacionData.motivo} onChange={e => setAnulacionData(a => ({ ...a, motivo: e.target.value }))} required>
                        <option value="">Seleccione un motivo</option>
                        {motivosAnulacion.map((m, i) => <option key={i} value={m}>{m}</option>)}
                      </select>
                    </div>
                    {anulacionData.motivo === 'Otro (especificar)' && (
                      <div className="form-group form-group-full">
                        <label>Especifique el motivo: *</label>
                        <textarea value={anulacionData.motivoPersonalizado} onChange={e => setAnulacionData(a => ({ ...a, motivoPersonalizado: e.target.value }))}
                          rows="4" placeholder="Mínimo 10 caracteres..." required minLength={10} />
                        <small className="text-gray-500 text-xs">{anulacionData.motivoPersonalizado.length}/10 mín.</small>
                      </div>
                    )}
                    {anulacionData.motivo && anulacionData.motivo !== 'Otro (especificar)' && (
                      <div className="form-group form-group-full">
                        <label>Observaciones adicionales (opcional):</label>
                        <textarea value={anulacionData.motivoPersonalizado} onChange={e => setAnulacionData(a => ({ ...a, motivoPersonalizado: e.target.value }))} rows="3" />
                      </div>
                    )}
                  </div>
                  <div className="form-actions">
                    <button type="button" className="btn-secondary" onClick={closeModal}>Cancelar</button>
                    <button type="submit" className="btn-danger"
                      disabled={!anulacionData.motivo || (anulacionData.motivo === 'Otro (especificar)' && anulacionData.motivoPersonalizado.length < 10)}>
                      <Ban className="w-4 h-4 mr-2" />Confirmar Anulación
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinesAffiliatesSection;