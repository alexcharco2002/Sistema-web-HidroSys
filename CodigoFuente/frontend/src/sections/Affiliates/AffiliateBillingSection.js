// src/sections/AffiliateBillingSection.js
// MÓDULO DE FACTURAS Y PAGOS - Para afiliados

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import affiliateBillingServices from '../../services/affiliateBillingServices';
import affiliateGeneralServices from '../../services/affiliateGeneralServices';
import authService from '../../services/authServices';
import PayPalPaymentReceipt from '../../components/PayPalPaymentReceipt';

// Agregar junto a los demás imports (arriba del todo)
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

import {
  FileText, Eye, Calendar, DollarSign, AlertCircle, TrendingUp,
  RefreshCw, X, Upload, CheckCircle, Clock, Receipt, Paperclip,
  User, MapPin, Activity, CreditCard, Ban, BarChart3, TrendingDown,
  XCircle, Gauge, ArrowUpDown, FileCheck, Search, SlidersHorizontal, Droplet, Printer, FileDown
} from 'lucide-react';

import './AffiliateBillingSection.css';
import './HistorialConsumos.css'; // Para estilos compartidos de tablas y filtros

const AffiliateBillingSection = () => {

  // ============================================================
  // ESTADOS PRINCIPALES
  // ============================================================
  const [facturas, setFacturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [, setCurrentUser] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const [permissions, setPermissions] = useState({
    canRead: false,
    canUpload: false
  });

  // ============================================================
  // ESTADOS DE MEDIDORES Y PESTAÑA ACTIVA
  // ============================================================
  const [medidores, setMedidores] = useState([]);
  const [selectedMedidor, setSelectedMedidor] = useState(null); 

  // ============================================================
  // ESTADOS DE FILTROS Y BÚSQUEDA
  // ============================================================
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFechaDesde, setFilterFechaDesde] = useState('');
  const [filterFechaHasta, setFilterFechaHasta] = useState('');
  const [filterEstadoFactura, setFilterEstadoFactura] = useState('todos');
  const [filterMontoMin, setFilterMontoMin] = useState('');
  const [filterMontoMax, setFilterMontoMax] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [sortBy, setSortBy] = useState('fecha_emision');

  // ============================================================
  // ESTADOS DE PERIODOS (AÑO/MES)
  // ============================================================
  const [aniosDisponibles, setAniosDisponibles] = useState([]);
  const [periodosDisponibles, setPeriodosDisponibles] = useState({});
  const [selectedAnio, setSelectedAnio] = useState('');
  const [selectedMes, setSelectedMes] = useState('');
  const [mesesDelAnio, setMesesDelAnio] = useState([]);

  // ============================================================
  // ESTADOS DE MODAL
  // ============================================================
  const [showModal, setShowModal] = useState(false);
  const [selectedFactura, setSelectedFactura] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadingPago, setUploadingPago] = useState(null);
  const [comprobante, setComprobante] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [paypalConfig, setPaypalConfig] = useState(null);
  const [paypalLoading, setPaypalLoading] = useState(false);
  const [paypalMessage, setPaypalMessage] = useState('');
  const [paypalReceipt, setPaypalReceipt] = useState(null);
  const [showPaypalModal, setShowPaypalModal] = useState(false);
  const [paypalFactura, setPaypalFactura] = useState(null);
  const [downloadingComprobanteId, setDownloadingComprobanteId] = useState(null);

  // ============================================================
  // ESTADÍSTICAS
  // ============================================================
  const [stats, setStats] = useState({
    total_facturas: 0,
    total_pagadas: 0,
    total_pendientes: 0,
    monto_total: 0,
    monto_pagado: 0,
    monto_pendiente: 0,
    promedio_mensual: 0
  });

  // ============================================================
  // COLORES ROTATIVOS PARA PESTAÑAS
  // ============================================================
  const MEDIDOR_COLORS = ['green', 'amber', 'purple', 'coral', 'teal'];

  // ============================================================
  // INICIALIZACIÓN - PERMISOS Y USUARIO
  // ============================================================
  useEffect(() => {
    const canRead =
      authService.hasPermission('Facturas_pagos', 'lectura') ||
      authService.hasPermission('Facturas_pagos', 'crud');
    const canUpload =
      authService.hasPermission('Facturas_pagos', 'escritura') ||
      authService.hasPermission('Facturas_pagos', 'crud');
    setPermissions({ canRead, canUpload });

    const user = authService.getStoredUser();
    if (user) setCurrentUser(user);
  }, []);

  // ============================================================
  // FETCH MEDIDORES — igual que en HistorialConsumos
  // ============================================================
  const fetchMisMedidores = useCallback(async () => {
    try {
      const result = await affiliateGeneralServices.getMisMedidores();
      if (result.success) {
        const lista = result.data.medidores || [];
        setMedidores(lista);
        return lista;
      }
      return [];
    } catch (error) {
      console.error('Error al obtener medidores:', error);
      return [];
    }
  }, []);

  // ============================================================
  // FETCH PERIODOS DE FACTURAS
  // ============================================================
  const fetchPeriodosDisponibles = useCallback(async () => {
    try {
      const result = await affiliateBillingServices.getPeriodosFacturasDisponibles();
      if (result.success) {
        setAniosDisponibles(result.data.anios_disponibles || []);
        setPeriodosDisponibles(result.data.periodos || {});
        if (result.data.anios_disponibles?.length > 0) {
          return result.data.anios_disponibles[0];
        }
      }
      return null;
    } catch (error) {
      console.error('Error al obtener periodos:', error);
      return null;
    }
  }, []);

  // para cargar el comprobante desde el modal de PayPal
  useEffect(() => {
      if (!permissions.canRead) return;
      const cargarPaypalConfig = async () => {
          const result = await affiliateBillingServices.getPaypalConfig();
          if (result.success) setPaypalConfig(result.data);
      };
      cargarPaypalConfig();
  }, [permissions.canRead]);

  // ============================================================
  // INICIALIZACIÓN: carga medidores + periodos en paralelo
  // ============================================================
  useEffect(() => {
      const inicializar = async () => {
          if (!permissions.canRead || isInitialized) return;

          const [anioReciente] = await Promise.all([
              fetchPeriodosDisponibles(),
              fetchMisMedidores(),
          ]);

          if (anioReciente) setSelectedAnio(anioReciente);
          setIsInitialized(true);
      };
      inicializar();
  }, [permissions.canRead, isInitialized, fetchPeriodosDisponibles, fetchMisMedidores]);


  // Sincronizar meses cuando cambia año o periodos disponibles
  useEffect(() => {
    if (selectedAnio && periodosDisponibles[selectedAnio]) {
      setMesesDelAnio(periodosDisponibles[selectedAnio]);
    } else {
      setMesesDelAnio([]);
    }
  }, [selectedAnio, periodosDisponibles]);

  // cargar facturas cada vez que cambian los periodos seleccionados o el filtro de estado
  useEffect(() => {
      const cargarFacturas = async () => {
          if (!permissions.canRead || !isInitialized) return;
          
          setLoading(true);
          setError(null);
          try {
              const result = await affiliateBillingServices.getMisFacturasPorPeriodo(
                  selectedAnio === '' ? null : selectedAnio,
                  selectedMes === '' ? null : selectedMes,
                  { estadofactura: filterEstadoFactura }
              );
              if (result.success) {
                  setFacturas(result.data);
                  calcularEstadisticas(result.data);
              } else {
                  setError(result.message);
              }
          } catch (err) {
              console.error('Error al cargar facturas:', err);
              setError('Error al cargar tus facturas');
          } finally {
              setLoading(false);
          }
      };
      cargarFacturas();
  }, [permissions.canRead, isInitialized, selectedAnio, selectedMes, filterEstadoFactura]);


  // Recalcular estadísticas cuando cambian facturas o medidor activo (aunque el cálculo no dependa del medidor, así se actualizan al cambiar de pestaña)
  useEffect(() => {
    if (facturas.length === 0) return;
    const base = selectedMedidor
      ? facturas.filter(f => f.usuario_afiliado?.num_medidor === selectedMedidor)
      : facturas;
    calcularEstadisticas(base);
  }, [selectedMedidor, facturas]);

  // función para contar facturas por medidor — se usa para mostrar el conteo en cada pestaña
  const conteoPorMedidor = useMemo(() => {
    const mapa = {};
    facturas.forEach(f => {
      const num = f.usuario_afiliado?.num_medidor;
      if (num) mapa[num] = (mapa[num] || 0) + 1;
    });
    return mapa;
  }, [facturas]);

  // ============================================================
  // FILTRADO + ORDENAMIENTO — incluye filtro por medidor activo
  // ============================================================
  const filteredFacturas = useMemo(() => {
    return facturas
      .filter(factura => {
        if (
          selectedMedidor !== null &&
          factura.usuario_afiliado?.num_medidor !== selectedMedidor
        ) {
          return false;
        }

        const matchesSearch =
          factura.num_factura?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          factura.id_factura?.toString().includes(searchTerm) ||
          factura.usuario_afiliado?.usuario_sistema?.nombre_completo
            ?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          factura.usuario_afiliado?.num_medidor?.includes(searchTerm) ||
          factura.usuario_afiliado?.sector?.nombre_sector
            ?.toLowerCase().includes(searchTerm.toLowerCase());

        const fechaEmision = new Date(factura.fecha_emision);

        const matchesFechaDesde =
          !filterFechaDesde || fechaEmision >= new Date(filterFechaDesde);

        const matchesFechaHasta =
          !filterFechaHasta || fechaEmision <= new Date(filterFechaHasta);

        const matchesMontoMin =
          !filterMontoMin || factura.total >= parseFloat(filterMontoMin);

        const matchesMontoMax =
          !filterMontoMax || factura.total <= parseFloat(filterMontoMax);

        return (
          matchesSearch &&
          matchesFechaDesde &&
          matchesFechaHasta &&
          matchesMontoMin &&
          matchesMontoMax
        );
      })
      .sort((a, b) => {
        let comparison = 0;

        switch (sortBy) {
          case 'fecha_emision':
            comparison =
              new Date(a.fecha_emision) - new Date(b.fecha_emision);
            break;

          case 'monto':
            comparison = a.total - b.total;
            break;

          case 'numero':
            comparison = (a.num_factura || '').localeCompare(
              b.num_factura || ''
            );
            break;

          default:
            comparison =
              new Date(a.fecha_emision) - new Date(b.fecha_emision);
        }

        return sortOrder === 'asc' ? comparison : -comparison;
      });
  }, [
    facturas,
    selectedMedidor,
    searchTerm,
    filterFechaDesde,
    filterFechaHasta,
    filterMontoMin,
    filterMontoMax,
    sortBy,
    sortOrder
  ]);

  // Info del medidor activo
  const medidorActivo = useMemo(
    () => selectedMedidor
      ? medidores.find(m => m.num_medidor === selectedMedidor) || null
      : null,
    [selectedMedidor, medidores]
  );

  // ============================================================
  // CALCULAR ESTADÍSTICAS
  // ============================================================
  const calcularEstadisticas = (facturasData) => {
    if (!facturasData || facturasData.length === 0) {
      setStats({ total_facturas: 0, total_pagadas: 0, total_pendientes: 0,
                monto_total: 0, monto_pagado: 0, monto_pendiente: 0, promedio_mensual: 0 })
      return
    }
    const total    = facturasData.length
    const pagadas  = facturasData.filter(f =>
      f.esta_totalmente_pagada || f.estatotalmentepagada
    ).length
    const pendientes = total - pagadas
    const montoTotal    = facturasData.reduce((sum, f) => sum + (f.total || 0), 0)
    const montoPagado   = facturasData.reduce((sum, f) => sum + (f.monto_pagado   || f.montopagado   || 0), 0)
    const montoPendiente = facturasData.reduce((sum, f) => sum + (f.saldo_pendiente || f.saldopendiente || 0), 0)

    setStats({
      total_facturas:  total,
      total_pagadas:   pagadas,
      total_pendientes: pendientes,
      monto_total:      montoTotal.toFixed(2),
      monto_pagado:     montoPagado.toFixed(2),
      monto_pendiente:  montoPendiente.toFixed(2),
      promedio_mensual: total > 0 ? (montoTotal / total).toFixed(2) : 0
    })
  }

  // ============================================================
  // PERIODOS
  // ============================================================
  const handleAnioChange = (e) => {
    const anio = e.target.value;
    setSelectedAnio(anio);
    setSelectedMes('');
    if (anio && periodosDisponibles[anio]) {
      setMesesDelAnio(periodosDisponibles[anio]);
    } else {
      setMesesDelAnio([]);
    }
  };

  const toggleSortOrder = () => setSortOrder(o => o === 'asc' ? 'desc' : 'asc');

  const limpiarFiltros = () => {
    setSearchTerm('');
    setFilterFechaDesde('');
    setFilterFechaHasta('');
    setFilterEstadoFactura('todos');
    setFilterMontoMin('');
    setFilterMontoMax('');
    setSortBy('fecha_emision');
    setSortOrder('desc');
    setSelectedMedidor(null);
    if (aniosDisponibles.length > 0) {
      const anioReciente = aniosDisponibles[0];
      setSelectedAnio(anioReciente);
      setMesesDelAnio(periodosDisponibles[anioReciente] || []);
      setSelectedMes('');
    }
  };

  // ============================================================
  // RECARGA
  // ============================================================
  const handleRecargar = async () => {
    setLoading(true);
    setError(null);
    try {
      const [result] = await Promise.all([
        affiliateBillingServices.getMisFacturasPorPeriodo(
          selectedAnio || null,
          selectedMes || null,
          { estadofactura: filterEstadoFactura }
        ),
        fetchMisMedidores(),
      ]);
      if (result.success) {
        setFacturas(result.data);
        calcularEstadisticas(result.data);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Error al recargar los datos');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // MODAL
  // ============================================================
  const verDetalle = async (factura) => {
    setPaypalMessage('');
    setSelectedFactura({ ...factura, cargando_detalle: true });
    setShowModal(true);

    try {
      const result = await affiliateBillingServices.getDetalleFactura(factura.id_factura);
      if (result.success) {
        setSelectedFactura(result.data);
      } else {
        setSelectedFactura({ ...factura, cargando_detalle: false });
      }
    } catch (error) {
      setSelectedFactura({ ...factura, cargando_detalle: false });
    }
  };
  const closeModal = () => { setShowModal(false); setSelectedFactura(null); };
  const closePaypalModal = () => {
    setShowPaypalModal(false);
    setPaypalFactura(null);
    setPaypalMessage('');
    setPaypalLoading(false);
  };
  const abrirPagoPaypal = async (factura) => {
    setPaypalMessage('');
    setPaypalFactura({ ...factura, cargando_detalle: true });
    setShowPaypalModal(true);

    try {
      const result = await affiliateBillingServices.getDetalleFactura(factura.id_factura);
      if (result.success) {
        setPaypalFactura(result.data);
      } else {
        setPaypalFactura({ ...factura, cargando_detalle: false });
        setPaypalMessage(result.message || 'No se pudo cargar la factura');
      }
    } catch (error) {
      setPaypalFactura({ ...factura, cargando_detalle: false });
      setPaypalMessage('No se pudo cargar la factura');
    }
  };
  const closeUploadModal = () => {
    setShowUploadModal(false);
    setUploadingPago(null);
    setComprobante(null);
    setUploadProgress(0);
  };

  const cargarPaypalSdk = useCallback((clientId, currency = 'USD') => {
    return new Promise((resolve, reject) => {
      if (window.paypal) {
        resolve(window.paypal);
        return;
      }

      const script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=${currency}&intent=capture`;
      script.async = true;
      script.onload = () => resolve(window.paypal);
      script.onerror = () => reject(new Error('No se pudo cargar PayPal'));
      document.body.appendChild(script);
    });
  }, []);

  useEffect(() => {
    const saldoPendiente = Number(paypalFactura?.saldo_pendiente || 0);
    if (!showPaypalModal || !paypalFactura || paypalFactura.cargando_detalle || saldoPendiente <= 0) return;
    if (!paypalConfig?.enabled || !paypalConfig?.client_id) return;

    let cancelado = false;
    const containerId = 'paypal-button-container-afiliado';

    const renderPaypal = async () => {
      try {
        const paypal = await cargarPaypalSdk(paypalConfig.client_id, paypalConfig.currency || 'USD');
        const container = document.getElementById(containerId);
        if (!container || cancelado) return;
        container.innerHTML = '';

        paypal.Buttons({
          style: {
            layout: 'vertical',
            color: 'gold',
            shape: 'rect',
            label: 'pay'
          },
          createOrder: async () => {
            setPaypalLoading(true);
            setPaypalMessage('');
            const result = await affiliateBillingServices.crearOrdenPaypal(paypalFactura.id_factura);
            if (!result.success) {
              setPaypalLoading(false);
              setPaypalMessage(result.message || 'No se pudo crear la orden de PayPal');
              throw new Error(result.message || 'No se pudo crear la orden de PayPal');
            }
            return result.data.order_id;
          },
          onApprove: async (data) => {
            setPaypalLoading(true);
            setPaypalMessage('Confirmando pago con PayPal...');
            const result = await affiliateBillingServices.capturarOrdenPaypal(data.orderID);
            setPaypalLoading(false);

            if (!result.success) {
              setPaypalMessage(result.message || 'No se pudo registrar el pago');
              return;
            }

            setPaypalMessage('Pago registrado correctamente.');
            setPaypalReceipt({
              payment: result.data,
              factura: paypalFactura
            });
            const detalle = await affiliateBillingServices.getDetalleFactura(paypalFactura.id_factura);
            if (detalle.success) {
              setPaypalFactura(detalle.data);
              if (selectedFactura?.id_factura === detalle.data.id_factura) {
                setSelectedFactura(detalle.data);
              }
            }
            handleRecargar();
          },
          onCancel: () => {
            setPaypalLoading(false);
            setPaypalMessage('Pago cancelado.');
          },
          onError: (err) => {
            console.error('PayPal error:', err);
            setPaypalLoading(false);
            setPaypalMessage('No se pudo procesar el pago con PayPal.');
          }
        }).render(`#${containerId}`);
      } catch (error) {
        setPaypalMessage(error.message || 'No se pudo cargar PayPal');
      }
    };

    renderPaypal();

    return () => {
      cancelado = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPaypalModal, paypalFactura, paypalConfig, cargarPaypalSdk]);

  // ============================================================
  // COMPROBANTE
  // ============================================================
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      alert('Solo se permiten archivos JPG, PNG o PDF');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('El archivo no debe superar los 5MB');
      return;
    }
    setComprobante(file);
  };

  const subirComprobante = async () => {
    if (!comprobante || !uploadingPago) { alert('Debes seleccionar un archivo'); return; }
    setLoading(true);
    setUploadProgress(10);
    try {
      const result = await affiliateBillingServices.subirComprobantePago(
        uploadingPago.id_factura,
        comprobante,
        (progress) => setUploadProgress(progress)
      );
      if (result.success) {
        alert('Comprobante subido exitosamente. Será verificado por el administrador.');
        closeUploadModal();
        handleRecargar();
      } else {
        alert(result.message || 'Error al subir el comprobante');
      }
    } catch (error) {
      alert('Error al subir el comprobante');
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const descargarComprobante = async (idPago, nombreArchivo = null) => {
    if (!idPago || downloadingComprobanteId === idPago) return;
    setDownloadingComprobanteId(idPago);
    try {
      const result = await affiliateBillingServices.descargarComprobante(idPago);
      if (!result.success) alert(`❌ ${result.message}`);
    } catch (error) {
      alert('Error al descargar el comprobante');
    } finally {
      setDownloadingComprobanteId(null);
    }
  };

  // ─── DESCARGAR PDF ────────────────────────────────────────────
  const descargarPDF = () => {
    if (filteredFacturas.length === 0) return

    try {
      // ── Helpers para leer campos en ambos formatos ──────────
      const gf = (obj, snake, camel) =>
        obj?.[snake] ?? obj?.[camel] ?? null

      // ── Stats calculados directo de filteredFacturas ────────
      const totalF      = filteredFacturas.length
      const pagadasF    = filteredFacturas.filter(f =>
        gf(f, 'esta_totalmente_pagada', 'estatotalmentepagada')
      ).length
      const pendientesF = totalF - pagadasF
      const montoTotalF    = filteredFacturas.reduce((s, f) => s + (f.total || 0), 0)
      const montoPagadoF   = filteredFacturas.reduce((s, f) => s + (gf(f,'monto_pagado','montopagado') || 0), 0)
      const montoPendienteF = filteredFacturas.reduce((s, f) => s + (gf(f,'saldo_pendiente','saldopendiente') || 0), 0)

      // ── Nombre del usuario (del primer afiliado o currentUser) ──
      const primerAfiliado = filteredFacturas[0]
      const usuarioSistema = gf(primerAfiliado, 'usuario_afiliado', 'usuarioafiliado')
      const usuarioInfo    = gf(usuarioSistema,  'usuario_sistema',  'usuariosistema')
      const nombreUsuario  = gf(usuarioInfo, 'nombre_completo', 'nombrecompleto') || 'N/A'
      const cedulaUsuario  = usuarioInfo?.cedula || ''

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const fecha = new Date().toLocaleDateString('es-EC', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      })

      // ── Encabezado ──────────────────────────────────────────
      doc.setFontSize(18)
      doc.setTextColor(31, 71, 136)
      doc.text('JAAP - SANJAPAMBA', 148.5, 15, { align: 'center' })

      doc.setFontSize(11)
      doc.setTextColor(64, 64, 64)
      doc.text('SANJAPAMBA - San Andrés - Chimborazo', 148.5, 22, { align: 'center' })

      doc.setFontSize(14)
      doc.setTextColor(31, 71, 136)
      const numMedidor = gf(medidorActivo, 'num_medidor', 'nummedidor')
      const subtitulo = numMedidor
        ? `REPORTE DE FACTURAS Y PAGOS — Medidor: ${numMedidor}`
        : 'REPORTE DE FACTURAS Y PAGOS'
      doc.text(subtitulo, 148.5, 30, { align: 'center' })

      // ── Afiliado ────────────────────────────────────────────
      doc.setFontSize(10)
      doc.setTextColor(64, 64, 64)
      doc.text(
        `Afiliado: ${nombreUsuario}${cedulaUsuario ? `  |  Cédula: ${cedulaUsuario}` : ''}`,
        148.5, 37, { align: 'center' }
      )

      // ── Fecha ───────────────────────────────────────────────
      doc.setFontSize(9)
      doc.setTextColor(100, 100, 100)
      doc.text(`Fecha de generación: ${fecha}`, 148.5, 43, { align: 'center' })

      // ── Resumen estadísticas ────────────────────────────────
      doc.setFontSize(9)
      doc.setTextColor(50, 50, 50)
      doc.text(
        `Total: ${totalF}   Pagadas: ${pagadasF}   Pendientes: ${pendientesF}   Monto total: ${formatCurrency(montoTotalF)}   Pagado: ${formatCurrency(montoPagadoF)}   Por pagar: ${formatCurrency(montoPendienteF)}`,
        148.5, 49, { align: 'center' }
      )

      // ── Filas de datos ──────────────────────────────────────
      const headers = [
        'N° Factura', 'Fecha Emisión', 'Período', 'Medidor',
        'Sector', 'Consumo (m³)', 'Total', 'Pagado', 'Saldo', 'Estado'
      ]

      const dataRows = filteredFacturas.map((f, index) => {
        const afi    = gf(f, 'usuario_afiliado',  'usuarioafiliado')
        const sector = gf(afi, 'sector', 'sector')
        return [
          index + 1,
          gf(f, 'num_factura', 'numfactura') || gf(f, 'id_factura', 'idfactura') || 'N/A',
          formatDateShort(gf(f, 'fecha_emision', 'fechaemision')),
          formatPeriodoDisplay(f.periodo),
          gf(afi, 'num_medidor', 'nummedidor') || 'N/A',
          gf(sector, 'nombre_sector', 'nombresector') || 'N/A',
          `${gf(f, 'consumo_m3', 'consumom3') ?? 0} m³`,
          formatCurrency(f.total),
          formatCurrency(gf(f, 'monto_pagado',    'montopagado')),
          formatCurrency(gf(f, 'saldo_pendiente', 'saldopendiente')),
          (gf(f, 'estado_factura', 'estadofactura') || 'N/A').toUpperCase(),
        ]
      })

      autoTable(doc, {
        startY: 53,
        head: [['#', ...headers]],
        body: dataRows,
        theme: 'grid',
        headStyles: { fillColor: [68, 114, 196], textColor: [255, 255, 255], fontSize: 9, halign: 'center', valign: 'middle' },
        bodyStyles: { fontSize: 8, textColor: [50, 50, 50], valign: 'middle' },
        alternateRowStyles: { fillColor: [248, 249, 250] },
        didParseCell(data) {
          if (data.section === 'body' && data.column.index === dataRows[0]?.length - 1) {
            const val = String(data.cell.raw || '').toLowerCase()
            if (val === 'pagada')    data.cell.styles.textColor = [21, 128, 61]
            if (val === 'pendiente') data.cell.styles.textColor = [202, 138, 4]
            if (val === 'vencida')   data.cell.styles.textColor = [185, 28, 28]
            if (val === 'anulada')   data.cell.styles.textColor = [107, 114, 128]
          }
        },
        didDrawPage() {
          doc.setFontSize(8)
          doc.setTextColor(150, 150, 150)
          doc.text(`Página ${doc.internal.getCurrentPageInfo().pageNumber} de ${doc.internal.getNumberOfPages()}`, 280, 200, { align: 'right' })
          doc.text('Sistema web de Facturación HidroSys - JAAP Sanjapamba', 15, 200)
        },
        margin: { top: 53, bottom: 20 },
      })

      const fechaArchivo = new Date().toISOString().split('T')[0]
      doc.save(`JAAP_Facturas_${selectedAnio || 'todos'}_${selectedMes || 'todos'}_${fechaArchivo}.pdf`)

    } catch (error) {
      console.error('Error al exportar PDF:', error)
      alert('Error al exportar el archivo PDF. Por favor, intente nuevamente.')
    }
  }

  // ─── IMPRIMIR REPORTE ─────────────────────────────────────────
  const imprimirReporte = () => {
    if (filteredFacturas.length === 0) return

    // ── Helper campos dual-format ─────────────────────────────
    const gf = (obj, snake, camel) => obj?.[snake] ?? obj?.[camel] ?? null

    const fechaGeneracion = new Date().toLocaleString('es-EC', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    })

    // ── Stats inline ──────────────────────────────────────────
    const totalF         = filteredFacturas.length
    const pagadasF       = filteredFacturas.filter(f =>
      gf(f, 'esta_totalmente_pagada', 'estatotalmentepagada')
    ).length
    const pendientesF    = totalF - pagadasF
    const montoTotalF    = filteredFacturas.reduce((s, f) => s + (f.total || 0), 0)
    const montoPagadoF   = filteredFacturas.reduce((s, f) => s + (gf(f,'monto_pagado','montopagado') || 0), 0)
    const montoPendienteF = filteredFacturas.reduce((s, f) => s + (gf(f,'saldo_pendiente','saldopendiente') || 0), 0)

    // ── Nombre del afiliado ───────────────────────────────────
    const primerAfiliado  = filteredFacturas[0]
    const usuarioSistema  = gf(primerAfiliado, 'usuario_afiliado', 'usuarioafiliado')
    const usuarioInfo     = gf(usuarioSistema,  'usuario_sistema',  'usuariosistema')
    const nombreUsuario   = gf(usuarioInfo, 'nombre_completo', 'nombrecompleto') || 'N/A'
    const cedulaUsuario   = usuarioInfo?.cedula || ''
    const numMedidor      = gf(medidorActivo, 'num_medidor', 'nummedidor') || ''

    const headers = ['N°', 'Factura', 'Fecha Emisión', 'Período', 'Medidor',
                    'Sector', 'Consumo', 'Total', 'Pagado', 'Saldo', 'Estado']

    // ✅ Filas con helper dual-format
    const filas = filteredFacturas.map((f, i) => {
      const afi    = gf(f, 'usuario_afiliado',  'usuarioafiliado')
      const sector = gf(afi, 'sector', 'sector')
      return [
        i + 1,
        gf(f, 'num_factura', 'numfactura') || gf(f, 'id_factura', 'idfactura') || 'N/A',
        formatDateShort(gf(f, 'fecha_emision', 'fechaemision')),
        formatPeriodoDisplay(f.periodo),
        gf(afi, 'num_medidor', 'nummedidor') || 'N/A',
        gf(sector, 'nombre_sector', 'nombresector') || 'N/A',
        `${gf(f, 'consumo_m3', 'consumom3') ?? 0} m³`,
        formatCurrency(f.total),
        formatCurrency(gf(f, 'monto_pagado',    'montopagado')),
        formatCurrency(gf(f, 'saldo_pendiente', 'saldopendiente')),
        (gf(f, 'estado_factura', 'estadofactura') || 'N/A').toUpperCase(),
      ]
    })

    // ── Stats para el HTML (reemplaza ${stats.xxx} por variables inline) ──
    const printContent = `<!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8">
    <title>Reporte de Facturas - JAAP Sanjapamba</title>
    <style>
      @media print { @page { size: landscape; margin: 0.5cm; } }
      *, *::before, *::after { box-sizing: border-box; }
      body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; padding: 20px; color: #333; margin: 0; }
      .report-container { background: white; padding: 30px; border-radius: 8px; max-width: 1400px; margin: 0 auto; }
      .report-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 3px solid #4472C4; }
      .header-left h1 { font-size: 22px; color: #4472C4; margin: 0 0 4px; }
      .header-left p { font-size: 12px; color: #666; margin: 2px 0; }
      .header-right { text-align: right; font-size: 12px; }
      .header-right .info-value { font-weight: 600; color: #333; }
      .stats-bar { display: flex; gap: 16px; background: #f0f4ff; padding: 8px 14px; border-radius: 6px; margin-bottom: 16px; font-size: 12px; flex-wrap: wrap; }
      .stats-bar strong { color: #1d4ed8; }
      table { width: 100%; border-collapse: collapse; font-size: 10px; }
      thead { background: linear-gradient(135deg, #4472C4, #5B8FDB); color: white; }
      th { padding: 9px 6px; text-align: left; font-weight: 600; border: 1px solid #2F5496; }
      td { padding: 7px 6px; border: 1px solid #ddd; }
      tbody tr:nth-child(even) { background: #f9f9f9; }
      .est-pagada { color: #15803d; font-weight: 600; }
      .est-pendiente { color: #ca8a04; font-weight: 600; }
      .est-vencida { color: #b91c1c; font-weight: 600; }
      .est-anulada { color: #6b7280; }
      .report-footer { margin-top: 24px; padding-top: 14px; border-top: 2px solid #ddd; display: flex; justify-content: space-between; font-size: 10px; color: #666; }
      @media print { body { background: white; padding: 0; } .report-container { box-shadow: none; } }
    </style>
  </head>
  <body>
    <div class="report-container">
      <div class="report-header">
        <div class="header-left">
          <h1>JAAP - SANJAPAMBA</h1>
          <p>Reporte de Facturas y Pagos</p>
          <p>Afiliado: <strong>${nombreUsuario}</strong>${cedulaUsuario ? ` &nbsp;|&nbsp; Cédula: <strong>${cedulaUsuario}</strong>` : ''}</p>
          ${numMedidor ? `<p>Medidor: <strong>${numMedidor}</strong></p>` : ''}
        </div>
        <div class="header-right">
          <p>Generado: <span class="info-value">${fechaGeneracion}</span></p>
          <p>Total de registros: <span class="info-value">${totalF}</span></p>
          ${selectedAnio ? `<p>Período: <span class="info-value">${selectedAnio}${selectedMes ? ` / Mes ${selectedMes}` : ''}</span></p>` : ''}
        </div>
      </div>

      <div class="stats-bar">
        <span>Total: <strong>${totalF}</strong></span>
        <span>Pagadas: <strong>${pagadasF}</strong></span>
        <span>Pendientes: <strong>${pendientesF}</strong></span>
        <span>Monto total: <strong>${formatCurrency(montoTotalF)}</strong></span>
        <span>Pagado: <strong>${formatCurrency(montoPagadoF)}</strong></span>
        <span>Por pagar: <strong>${formatCurrency(montoPendienteF)}</strong></span>
      </div>

      <table>
        <thead>
          <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${filas.map(fila => {
            const estado = String(fila[fila.length - 1]).toLowerCase()
            const cls = estado === 'pagada' ? 'est-pagada'
                      : estado === 'pendiente' ? 'est-pendiente'
                      : estado === 'vencida'   ? 'est-vencida'
                      : estado === 'anulada'   ? 'est-anulada' : ''
            return `<tr>${fila.map((c, ci) =>
              `<td${ci === fila.length - 1 ? ` class="${cls}"` : ''}>${c ?? 'N/A'}</td>`
            ).join('')}</tr>`
          }).join('')}
        </tbody>
      </table>

      <div class="report-footer">
        <div>Sistema web de Facturación HidroSys</div>
        <div>JAAP Sanjapamba — San Andrés, Chimborazo</div>
        <div>Documento: Facturas_${new Date().toISOString().split('T')[0]}</div>
      </div>
    </div>
  </body>
  </html>`

    const printWindow = window.open('', '_blank', 'width=1400,height=800')
    if (printWindow) {
      printWindow.document.write(printContent)
      printWindow.document.close()
      printWindow.focus()
      setTimeout(() => printWindow.print(), 500)
    } else {
      alert('Por favor, habilita las ventanas emergentes para imprimir.')
    }
  }


  // ============================================================
  // UTILIDADES
  // ============================================================
  const parseSafeDate = (dateString) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [year, month, day] = dateString.split('-');
      return new Date(year, month - 1, day);
    }
    return new Date(dateString);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return parseSafeDate(dateString).toLocaleDateString('es-EC', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  };

  const formatDateShort = (dateString) => {
    if (!dateString) return 'N/A';
    return parseSafeDate(dateString).toLocaleDateString('es-EC', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(amount || 0);

  const formatearPeriodo = (mes, anio) => {
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return `${meses[mes - 1]} ${anio}`;
  };

  const formatPeriodoDisplay = (periodo) => {
    if (!periodo) return 'N/A';
    const [anio, mes] = periodo.split('-');
    return formatearPeriodo(parseInt(mes), anio);
  };

  const getMetodoIcon = (metodo) => {
    switch (metodo?.toLowerCase()) {
      case 'transferencia': return <CreditCard className="w-3 h-3" />;
      case 'tarjeta': return <CreditCard className="w-3 h-3" />;
      default: return <DollarSign className="w-3 h-3" />;
    }
  };

  // ============================================================
  // BADGES
  // ============================================================
  const getStatusBadge = (estado) => {
    const configs = {
      pendiente: { icon: Clock, texto: 'Pendiente' },
      pagada: { icon: CheckCircle, texto: 'Pagada' },
      vencida: { icon: XCircle, texto: 'Vencida' },
      anulada: { icon: Ban, texto: 'Anulada' }
    };
    const config = configs[estado] || configs.pendiente;
    const IconComponent = config.icon;
    return (
      <span className={`status-badge ${estado}`}>
        <IconComponent className="status-icon" />
        {config.texto}
      </span>
    );
  };

  const getEstadoPagoBadge = (factura) => {
    if (factura.estado_factura === 'anulada')
      return <span className="status-badge anulada"><Ban className="w-3 h-3" />Anulada</span>;
    if (factura.estado_factura === 'pagada')
      return <span className="status-badge pagada"><CheckCircle className="w-3 h-3" />Pagada</span>;

    const saldo = factura.saldo_pendiente || 0;
    const totalPagado = factura.monto_pagado || 0;

    if (totalPagado > 0 && saldo > 0)
      return (
        <span className="status-badge parcial" style={{ backgroundColor: '#f59e0b', color: 'white' }}>
          <Clock className="w-3 h-3" />Parcial
        </span>
      );
    if (factura.estado_factura === 'vencida')
      return <span className="status-badge vencida"><XCircle className="w-3 h-3" />Vencida</span>;
    return <span className="status-badge pendiente"><Clock className="w-3 h-3" />Pendiente</span>;
  };

  const getEstadoPagoBadgeForPayment = (estadoPago) => {
    const estadoUpper = estadoPago?.toUpperCase();
    switch (estadoUpper) {
      case 'REGISTRADO':
        return <span className="status-badge pagada"><CheckCircle className="w-3 h-3" />Registrado</span>;
      case 'ANULADO':
        return <span className="status-badge anulada"><Ban className="w-3 h-3" />Anulado</span>;
      case 'VERIFICADO':
        return <span className="status-badge pagada"><CheckCircle className="w-3 h-3" />Verificado</span>;
      default:
        return <span className="status-badge pendiente"><Clock className="w-3 h-3" />{estadoPago || 'Sin estado'}</span>;
    }
  };

  // ============================================================
  // ESTADOS ESPECIALES DE RENDERIZADO
  // ============================================================
  if (!permissions.canRead) {
    return (
      <div className="error-state">
        <div className="error-content">
          <AlertCircle className="error-icon" />
          <p>No tienes permiso para acceder a tus facturas.</p>
        </div>
      </div>
    );
  }

  if (loading && facturas.length === 0) {
    return (
      <div className="affiliates-section">
        <div className="empty-state">
          <RefreshCw className="w-16 h-16 text-blue-400 mx-auto mb-4 animate-spin" />
          <h3>Espere mientras cargamos sus facturas...</h3>
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDERIZADO PRINCIPAL
  // ============================================================
  return (
    <div className="users-section">
      {/* HEADER */}
      <div className="section-header">
        <div className="section-title">
          <FileText className="w-7 h-7 text-blue-600" />
          <div>
            <h2>Mis Facturas y Pagos</h2>
            <p className="section-subtitle">Consulta y gestiona tus facturas de consumo de agua</p>
          </div>
        </div>

        {/* BOTONES DE ACCIÓN */}
        <div className="actions">

          {filteredFacturas.length > 0 && (
            <>
              {/* Botón PDF */}
              <button
                onClick={descargarPDF}
                className="btn-secondary btn-export btn-export-pdf"
                title={`Descargar ${filteredFacturas.length} facturas en PDF`}
              >
                <FileDown className="w-4 h-4" />
                <span className="btn-export-label">PDF</span>
              </button>

              {/* Botón Imprimir */}
              <button
                onClick={imprimirReporte}
                className="btn-secondary btn-export"
                title="Imprimir facturas"
              >
                <Printer className="w-4 h-4" />
                <span className="btn-export-label">Imprimir</span>
              </button>
            </>
          )}

        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="alert alert-error mb-4">
          <AlertCircle className="w-5 h-5 mr-2" />
          {error}
        </div>
      )}

      {/* ==================== ESTADÍSTICAS ==================== */}
      {stats && (
        <div className="periodo-stats-container">
          <div className="periodo-stats-header">
            <BarChart3 className="w-5 h-5 text-blue-600 mr-2" />
            <h3>
              Resumen de mis Facturas
              {medidorActivo && (
                <span className="stats-medidor-tag">
                  — Medidor {medidorActivo.num_medidor}
                </span>
              )}
            </h3>
          </div>
          <div className="users-stats">
            <div className="stat-item">
              <FileText className="stat-icon text-blue-600" />
              <div>
                <p className="stat-label">Total Facturas</p>
                <p className="stat-value">{stats.total_facturas}</p>
              </div>
            </div>
            <div className="stat-item">
              <CheckCircle className="stat-icon text-green-600" />
              <div>
                <p className="stat-label">Pagadas</p>
                <p className="stat-value">{stats.total_pagadas}</p>
              </div>
            </div>
            <div className="stat-item">
              <Clock className="stat-icon text-yellow-600" />
              <div>
                <p className="stat-label">Pendientes</p>
                <p className="stat-value">{stats.total_pendientes}</p>
              </div>
            </div>
            <div className="stat-item">
              <DollarSign className="stat-icon text-blue-600" />
              <div>
                <p className="stat-label">Monto Total</p>
                <p className="stat-value">{formatCurrency(stats.monto_total)}</p>
              </div>
            </div>
            <div className="stat-item">
              <TrendingUp className="stat-icon text-green-600" />
              <div>
                <p className="stat-label">Pagado</p>
                <p className="stat-value">{formatCurrency(stats.monto_pagado)}</p>
              </div>
            </div>
            <div className="stat-item">
              <TrendingDown className="stat-icon text-red-600" />
              <div>
                <p className="stat-label">Por Pagar</p>
                <p className="stat-value">{formatCurrency(stats.monto_pendiente)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== FILTROS ==================== */}
      <div className="filters-main-container">

        {/* Sección 1: Periodo */}
        <div className="filters-section-card">
          <div className="filters-section-header">
            <Search className="w-4 h-4 text-blue-600" />
            <h4 className="filters-section-title">Filtro por periodo</h4>
          </div>
          <div className="filters-section-content-full">
            <div className="filter-group-row">
              <div className="filter-group">
                <label className="filter-label">Año</label>
                <select className="filter-select" value={selectedAnio} onChange={handleAnioChange}>
                  <option value="">Todos los años</option>
                  {aniosDisponibles.map(anio => (
                    <option key={anio} value={anio}>{anio}</option>
                  ))}
                </select>
              </div>
              <div className="filter-group">
                <label className="filter-label">Mes</label>
                <select
                  className="filter-select"
                  value={selectedMes}
                  onChange={(e) => setSelectedMes(e.target.value)}
                  disabled={!selectedAnio}
                >
                  <option value="">Todos los meses</option>
                  {mesesDelAnio.map(periodo => (
                    <option key={periodo.mes} value={periodo.mes}>
                      {periodo.nombre_mes} ({periodo.total_facturas})
                    </option>
                  ))}
                </select>
                {!selectedAnio && (
                  <p className="text-xs text-gray-500 mt-1">
                    Selecciona un año para filtrar por mes
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sección 2: Filtros y Ordenamiento */}
        <div className="filters-section-card">
          <div className="filters-section-header">
            <SlidersHorizontal className="w-4 h-4 text-purple-600" />
            <h4 className="filters-section-title">Filtros y Ordenamiento</h4>
          </div>
          <div className="filters-section-content">
            <div className="filter-group">
              <label className="filter-label">Estado</label>
              <select
                className="filter-select"
                value={filterEstadoFactura}
                onChange={(e) => setFilterEstadoFactura(e.target.value)}
              >
                <option value="todos">Todos</option>
                <option value="pendiente">Pendiente</option>
                <option value="pagada">Pagada</option>
                <option value="vencida">Vencida</option>
                <option value="anulada">Anulada</option>
              </select>
            </div>
            <div className="filter-group">
              <label className="filter-label">Ordenar por</label>
              <select className="filter-select" value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}>
                <option value="fecha_emision">Fecha</option>
                <option value="monto">Monto</option>
                <option value="numero">Número</option>
              </select>
            </div>
            <div className="filter-group">
              <label className="filter-label">Dirección</label>
              <button className="filter-btn-toggle" onClick={toggleSortOrder}>
                <ArrowUpDown className="w-4 h-4" />
                <span>{sortOrder === 'asc' ? 'Ascendente' : 'Descendente'}</span>
              </button>
            </div>
            <div />
            <div className="filter-actions-group">
              <button className="filter-btn-action filter-btn-clear" onClick={limpiarFiltros}>
                <X className="w-4 h-4" /><span>Limpiar</span>
              </button>
              <button className="filter-btn-action filter-btn-reload"
                onClick={handleRecargar} disabled={loading}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Recargar</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ==================== REGISTRO DE FACTURAS CON PESTAÑAS ==================== */}
      <div className="facturas-container">

        {/* PESTAÑAS DE MEDIDORES */}
        {medidores.length > 1 && (
          <div className="medidor-tabs-wrapper">

            {/* Pestaña "Todos" */}
            <button
              className={`medidor-tab ${selectedMedidor === null ? 'active' : ''}`}
              onClick={() => setSelectedMedidor(null)}
            >
              <span className="medidor-tab-icon medidor-tab-icon-all">
                <Droplet style={{ width: 11, height: 11 }} />
              </span>
              <span className={`medidor-tab-badge ${selectedMedidor === null ? 'active' : ''}`}>
                {facturas.length}
              </span>
            </button>

            {/* Una pestaña por medidor */}
            {medidores.map((med, idx) => {
              const color = MEDIDOR_COLORS[idx % MEDIDOR_COLORS.length];
               const conteo = conteoPorMedidor[med.num_medidor] || 0;
              const isActive = selectedMedidor === med.num_medidor; 
              return (
                <button
                  key={med.id_medidor}
                  className={`medidor-tab ${isActive ? 'active' : ''}`}
                  onClick={() => setSelectedMedidor(med.num_medidor)} // ← guarda número
                  title={med.sector ? `Sector: ${med.sector.nombre_sector}` : ''}
                >
                  <span className={`medidor-tab-icon medidor-tab-icon-${color}`}>
                    <Gauge style={{ width: 11, height: 11 }} />
                  </span>
                  <div className="medidor-tab-text">
                    <span className="medidor-tab-label">{med.num_medidor}</span>
                    {med.sector && (
                      <span className="medidor-tab-sector">{med.sector.nombre_sector}</span>
                    )}
                  </div>
                  <span className={`medidor-tab-badge ${isActive ? 'active' : ''}`}>
                    {conteo}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Barra info del medidor activo */}
        {medidorActivo && (
          <div className="medidor-info-bar">
            <span className="medidor-info-dot" />
            <Receipt style={{ width: 13, height: 13 }} />
            <span>Medidor: <strong>{medidorActivo.num_medidor}</strong></span>
            {medidorActivo.sector && (
              <>
                <span className="medidor-info-sep">·</span>
                <MapPin style={{ width: 12, height: 12 }} />
                <span>Sector: <strong>{medidorActivo.sector.nombre_sector}</strong></span>
              </>
            )}
            <span className="medidor-info-sep">·</span>
            <span>
              {filteredFacturas.length} {filteredFacturas.length === 1 ? 'factura' : 'facturas'}
            </span>
          </div>
        )}

{/* HEADER DE LA LISTA */}
<div className="facturas-header-row">
  <div className="facturas-header-title">
    <Receipt className="w-5 h-5 text-blue-600" />
    <h3 className="font-semibold text-lg">Registro de Facturas</h3>
  </div>
</div>

{/* ENCABEZADOS DE COLUMNAS */}
{filteredFacturas.length > 0 && (
  <div className="fcols-header">
    <div className="fcol-h"><Calendar className="w-3 h-3" /><span>Fecha emisión</span></div>
    <div className="fcol-h"><Gauge className="w-3 h-3" /><span>Medidor</span></div>
    <div className="fcol-h"><Activity className="w-3 h-3" /><span>Consumo</span></div>
    <div className="fcol-h fcol-h-right"><DollarSign className="w-3 h-3" /><span>Total</span></div>
    <div className="fcol-h fcol-h-center"><FileText className="w-3 h-3" /><span>Estado</span></div>
    <div className="fcol-h fcol-h-center"><Paperclip className="w-3 h-3" /><span>Comprobante</span></div>
    <div className="fcol-h" />
  </div>
)}

{/* LISTA */}
{filteredFacturas.length === 0 ? (
  <div className="facturas-empty-state">
    <Receipt className="w-12 h-12 text-gray-300 mb-2" />
    <p>
      {facturas.length === 0
        ? 'No tienes facturas registradas aún.'
        : selectedMedidor !== null
          ? `No hay facturas para el medidor ${medidorActivo?.num_medidor || ''}.`
          : 'No hay facturas que coincidan con los filtros aplicados.'}
    </p>
  </div>
) : (
  <div className="facturas-grid-list">
    {filteredFacturas.map(factura => {
      const pagosRegistrados = factura.pagos?.filter(p => p.estado_pago === 'REGISTRADO') || [];
      const ultimoPago = pagosRegistrados[0] || null;
      const pagosConComprobantes = pagosRegistrados.filter(p => p.tiene_comprobante);
      const estaPagada = factura.estado_factura === 'pagada';
      const puedePagarPaypal = Number(factura.saldo_pendiente || 0) > 0 &&
        ['pendiente', 'vencida', 'parcial'].includes((factura.estado_factura || '').toLowerCase());

      return (
        <div key={factura.id_factura} className="factura-card-item">

          {/* Col 1: Fecha principal + número secundario */}
          <div className="fc-fecha factura-clickable" onClick={() => verDetalle(factura)}>
            <span className="fc-fecha-dia">{formatDateShort(factura.fecha_emision)}</span>
            <span className="fc-fact-num">{factura.num_factura || `#${factura.id_factura}`}</span>
            {estaPagada && ultimoPago?.fecha_pago && (
              <span className="fc-pago-fecha">
                <CheckCircle className="w-3 h-3" />
                Pago: {formatDateShort(ultimoPago.fecha_pago)}
              </span>
            )}
          </div>

          {/* Col 2: Medidor */}
          <div className="fc-medidor factura-clickable" onClick={() => verDetalle(factura)}>
            <div className="fc-med-pill">
              <Gauge className="w-3 h-3" />
              <span>{factura.usuario_afiliado?.num_medidor || 'N/A'}</span>
            </div>
            {factura.usuario_afiliado?.sector && (
              <span className="fc-sector">
                <MapPin className="w-3 h-3" />
                {factura.usuario_afiliado.sector.nombre_sector}
              </span>
            )}
          </div>
          
          {/* Col 3: Consumo */}
          <div
            className="fc-consumo lectura-clickable"
            onClick={() => verDetalle(factura)}
          >
            <div className="lectura-consumo-box">
              <Gauge className="w-5 h-5 text-blue-600" />

              <div className="lectura-consumo-text">
                <span className="lectura-consumo-valor">
                  {factura.consumo_m3} m³
                </span>

                <span className="lectura-consumo-label">
                  {factura.exceso_m3 > 0
                    ? `+${factura.exceso_m3} m³ exceso`
                    : 'Consumo'}
                </span>
              </div>
            </div>
          </div>



          {/* Col 4: Total */}
          <div className="fc-total factura-clickable" onClick={() => verDetalle(factura)}>
            <span className="fc-total-num">{formatCurrency(factura.total)}</span>
            {factura.saldo_pendiente > 0 && factura.monto_pagado > 0 && (
              <span className="fc-saldo">Saldo: {formatCurrency(factura.saldo_pendiente)}</span>
            )}
          </div>

          {/* Col 5: Estado */}
          <div className="fc-estado factura-clickable" onClick={() => verDetalle(factura)}>
            {getStatusBadge(factura.estado_factura)}
          </div>

          {/* Col 6: Comprobante */}
          <div className="fc-comprobante">
            {pagosRegistrados.length > 0 ? (
              pagosConComprobantes.length === 0 ? (
                <span className="fc-comp-none">
                  <Paperclip className="w-3.5 h-3.5" />Sin comprobante
                </span>
              ) : pagosConComprobantes.length === 1 ? (
                <button
                  className="fc-comp-dl"
                  disabled={downloadingComprobanteId === pagosConComprobantes[0].id_pago}
                  onClick={(e) => { e.stopPropagation(); descargarComprobante(pagosConComprobantes[0].id_pago, pagosConComprobantes[0].nombre_archivo); }}
                >
                  <FileCheck className="w-3.5 h-3.5" />{downloadingComprobanteId === pagosConComprobantes[0].id_pago ? 'Descargando...' : 'Descargar'}
                </button>
              ) : (
                <button
                  className="fc-comp-dl"
                  onClick={(e) => { e.stopPropagation(); verDetalle(factura); }}
                >
                  <FileCheck className="w-3.5 h-3.5" />{pagosConComprobantes.length} comp.
                </button>
              )
            ) : (
              <span className="fc-comp-none">
                <Ban className="w-3.5 h-3.5" />Sin pago
              </span>
            )}
          </div>

          {/* Col 7: Ver */}
          <div className="fc-accion">
            {puedePagarPaypal && (
              <button
                className="factura-btn-ver factura-btn-paypal"
                title="Pagar con PayPal"
                onClick={(e) => { e.stopPropagation(); abrirPagoPaypal(factura); }}
              >
                <CreditCard className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              className="factura-btn-ver"
              onClick={(e) => { e.stopPropagation(); verDetalle(factura); }}
              title="Ver detalle"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>
      );
    })}
  </div>
)}
      </div>

      {/* ==================== MODAL DE DETALLE ==================== */}
      {showModal && selectedFactura && (
        <div className="modal-overlay">
          <div className="modal fp-detalles-modal">
            <div className="modal-header">
              <h3>
                <FileText className="w-5 h-5 inline mr-2" />
                Detalle de Factura {selectedFactura.num_factura}
              </h3>
              <button className="modal-close" onClick={closeModal}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="modal-body fp-detalles-body">
              {/* Info factura */}
              <div className="factura-section">
                <h4 className="section-title"><FileText className="w-4 h-4" />Información de la Factura</h4>
                <br />
                <div className="user-details">
                  <div className="detail-group">
                    <label>Número de Factura</label>
                    <p className="font-mono font-semibold">{selectedFactura.num_factura}</p>
                  </div>
                  <div className="detail-group">
                    <label>Fecha de Emisión</label>
                    <p>{formatDateShort(selectedFactura.fecha_emision)}</p>
                  </div>
                  <div className="detail-group">
                    <label>Periodo</label>
                    <p>{formatPeriodoDisplay(selectedFactura.periodo)}</p>
                  </div>
                  <div className="detail-group">
                    <label>Estado</label>
                    {getEstadoPagoBadge(selectedFactura)}
                  </div>
                </div>
              </div>

              {/* Afiliado */}
              {selectedFactura.usuario_afiliado && (
                <div className="factura-section">
                  <br />
                  <h4 className="section-title"><User className="w-4 h-4" />Datos del Afiliado</h4>
                  <br />
                  <div className="user-details">
                    <div className="detail-group form-group-full">
                      <label>Nombre Afiliado:</label>
                      <p>
                        {selectedFactura.usuario_afiliado.usuario_sistema?.nombre_completo || 'Sin nombre'}{' '}
                        - {selectedFactura.usuario_afiliado.usuario_sistema?.cedula || 'N/A'}
                      </p>
                    </div>
                    <div className="detail-group">
                      <label>Código Afiliado:</label>
                      <p className="font-mono">{selectedFactura.usuario_afiliado.cod_usuario_afi}</p>
                    </div>
                    <div className="detail-group">
                      <label>Medidor:</label>
                      <p className="font-mono font-semibold text-green-600">
                        {selectedFactura.usuario_afiliado.num_medidor}
                      </p>
                    </div>
                    {/* Mostrar todos los medidores si hay más de uno */}
                    {selectedFactura.usuario_afiliado.medidores?.length > 1 && (
                      <div className="detail-group form-group-full">
                        <label>Todos los medidores:</label>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {selectedFactura.usuario_afiliado.medidores.map(num => (
                            <span key={num} style={{
                              padding: '2px 10px', borderRadius: 999,
                              background: '#dbeafe', color: '#1d4ed8',
                              fontSize: 12, fontFamily: 'monospace', fontWeight: 600
                            }}>{num}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="detail-group">
                      <label>Email:</label>
                      <p>{selectedFactura.usuario_afiliado.usuario_sistema?.email || 'N/A'}</p>
                    </div>
                    <div className="detail-group">
                      <label>Teléfono:</label>
                      <p>{selectedFactura.usuario_afiliado.usuario_sistema?.telefono || 'N/A'}</p>
                    </div>
                    {selectedFactura.usuario_afiliado.sector && (
                      <div className="detail-group form-group-full">
                        <label>Sector</label>
                        <p className="flex items-center gap-1">
                          <MapPin className="w-4 h-4 text-blue-500" />
                          {selectedFactura.usuario_afiliado.sector.nombre_sector}
                        </p>
                      </div>
                    )}
                    {selectedFactura.usuario_afiliado.usuario_sistema?.direccion && (
                      <div className="detail-group form-group-full">
                        <label>Dirección</label>
                        <p>{selectedFactura.usuario_afiliado.usuario_sistema.direccion}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Consumo */}
              <div className="factura-section">
                <br />
                <h4 className="section-title"><Activity className="w-4 h-4" />Consumo del Periodo</h4>
                <br />
                <div className="user-details">
                  <div className="detail-group">
                    <label>Consumo Total</label>
                    <p className="font-bold text-lg">{selectedFactura.consumo_m3} m³</p>
                  </div>
                  <div className="detail-group">
                    <label>Exceso</label>
                    <p className="font-bold text-lg">{selectedFactura.exceso_m3 || 0} m³</p>
                  </div>
                  <div className="detail-group">
                    <label>Valor Consumo</label>
                    <p>{formatCurrency(selectedFactura.valor_consumo)}</p>
                  </div>
                  <div className="detail-group">
                    <label>Valor Exceso</label>
                    <p>{formatCurrency(selectedFactura.valor_exceso)}</p>
                  </div>
                </div>                
              </div>

              <div className="fp-detalles-conceptos">
              {/* Conceptos */}
              {selectedFactura.detalles && selectedFactura.detalles.length > 0 && (
                <div className="conceptos-section">
                  <h4 className="conceptos-section-title">
                    <FileText className="w-4 h-4" />Conceptos de Facturación ({selectedFactura.detalles.length})
                  </h4>
                  <div className="conceptos-factura-lista">
                    {selectedFactura.detalles.map((detalle, index) => {
                      const getTipoConfig = (tipo) => {
                        switch (tipo?.toLowerCase()) {
                          case 'consumo': return { icon: <DollarSign className="w-4 h-4" />, color: '#10b981', label: 'Consumo' };
                          case 'servicio': return { icon: <CreditCard className="w-4 h-4" />, color: '#3b82f6', label: 'Servicio' };
                          case 'multa': return { icon: <AlertCircle className="w-4 h-4" />, color: '#ef4444', label: 'Multa' };
                          default: return { icon: <FileText className="w-4 h-4" />, color: '#6b7280', label: tipo || 'Concepto' };
                        }
                      };
                      const tc = getTipoConfig(detalle.tipo_detalle);
                      return (
                        <div key={detalle.id_detalle} className="concepto-item">
                          <div className="concepto-header">
                            <div className="concepto-tipo" style={{ color: tc.color }}>
                              {tc.icon}<span className="concepto-tipo-label">{tc.label}</span>
                            </div>
                            <span className="concepto-numero">#{index + 1}</span>
                          </div>
                          <div className="concepto-body">
                            <p className="concepto-descripcion">{detalle.descripcion}</p>
                            <div className="concepto-footer">
                              <span className="concepto-subtotal-label">Subtotal:</span>
                              <span className="concepto-subtotal-value" style={{ color: tc.color }}>
                                {formatCurrency(detalle.subtotal_detalle)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div className="conceptos-totales">
                      <div className="conceptos-total-row">
                        <span>Subtotal:</span>
                        <span>{formatCurrency(selectedFactura.subtotal)}</span>
                      </div>
                      {parseFloat(selectedFactura.descuento) > 0 && (
                        <div className="conceptos-total-row descuento">
                          <span>Descuento:</span>
                          <span className="text-green-600">- {formatCurrency(selectedFactura.descuento)}</span>
                        </div>
                      )}
                      {parseFloat(selectedFactura.impuesto) > 0 && (
                        <div className="conceptos-total-row">
                          <span>Impuesto (IVA):</span>
                          <span>{formatCurrency(selectedFactura.impuesto)}</span>
                        </div>
                      )}
                      <div className="conceptos-total-row total">
                        <span>Total:</span>
                        <span className="font-bold text-xl">{formatCurrency(selectedFactura.total)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Historial de pagos */}
              {selectedFactura.pagos && selectedFactura.pagos.length > 0 && (
                <div className="historial-pagos-section">
                  <h4 className="historial-pagos-title">
                    <DollarSign className="w-4 h-4" />
                    Historial de Pagos ({selectedFactura.pagos.length})
                  </h4>
                  <div className="historial-pagos-lista">
                    {selectedFactura.pagos.map((pago, index) => (
                      <div key={pago.id_pago}
                        className={`historial-pago-item ${pago.estado_pago === 'ANULADO' ? 'anulado' : ''}`}>
                        <div className="historial-pago-header">
                          <div className="historial-pago-header-left">
                            <span className="historial-pago-numero">Pago #{index + 1}</span>
                          </div>
                          {getEstadoPagoBadgeForPayment(pago.estado_pago)}
                        </div>
                        <div className="historial-pago-detalles">
                          <div className="historial-pago-detalle">
                            <span className="historial-pago-label"><Calendar className="w-3 h-3" /> Fecha</span>
                            <span className="historial-pago-value">{formatDate(pago.fecha_pago)}</span>
                          </div>
                          <div className="historial-pago-detalle">
                            <span className="historial-pago-label"><DollarSign className="w-3 h-3" /> Monto</span>
                            <span className="historial-pago-value font-bold text-green-600">
                              {formatCurrency(pago.monto_pago)}
                            </span>
                          </div>
                          <div className="historial-pago-detalle">
                            <span className="historial-pago-label">{getMetodoIcon(pago.metodo_pago)} Método</span>
                            <span className="historial-pago-value">{pago.metodo_pago}</span>
                          </div>
                          {pago.cajero && (
                            <div className="historial-pago-detalle">
                              <span className="historial-pago-label"><User className="w-3 h-3" /> Cajero</span>
                              <span className="historial-pago-value">{pago.cajero}</span>
                            </div>
                          )}
                        </div>
                        {pago.observaciones && (
                          <div className="historial-pago-observaciones">
                            <span className="historial-pago-obs-label">
                              <FileText className="w-3 h-3" /> Observaciones
                            </span>
                            <p className="historial-pago-obs-text">{pago.observaciones}</p>
                          </div>
                        )}
                        {pago.estado_pago === 'ANULADO' && (
                          <div className="historial-pago-anulacion-info">
                            <div className="historial-anulacion-header">
                              <Ban className="w-4 h-4" /><span>Pago Anulado</span>
                            </div>
                            {pago.fecha_anulacion && (
                              <div className="historial-anulacion-detalle">
                                <span className="historial-anulacion-label">Fecha de anulación</span>
                                <span className="historial-anulacion-value">{formatDate(pago.fecha_anulacion)}</span>
                              </div>
                            )}
                            {pago.motivo_anulacion && (
                              <div className="historial-anulacion-detalle">
                                <span className="historial-anulacion-label">Motivo</span>
                                <span className="historial-anulacion-value">{pago.motivo_anulacion}</span>
                              </div>
                            )}
                          </div>
                        )}
                        {pago.tiene_comprobante && (
                          <div className="historial-pago-comprobante-btn">
                            <button className="btn-secondary"
                              disabled={downloadingComprobanteId === pago.id_pago}
                              onClick={(e) => { e.stopPropagation(); descargarComprobante(pago.id_pago, pago.nombre_archivo); }}>
                              <FileCheck className="w-4 h-4 mr-2" />{downloadingComprobanteId === pago.id_pago ? 'Descargando...' : 'Descargar Comprobante'}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Resumen pagos */}
                  <div className="historial-pagos-resumen">
                    <div className="resumen-header">
                      <TrendingUp className="w-4 h-4" /><span>Resumen de Pagos</span>
                    </div>
                    <div className="resumen-row">
                      <span>Total Factura</span>
                      <span className="font-bold">{formatCurrency(selectedFactura.total)}</span>
                    </div>
                    <div className="resumen-row pagado">
                      <span>
                        Total Pagado ({selectedFactura.cantidad_pagos}{' '}
                        {selectedFactura.cantidad_pagos === 1 ? 'pago' : 'pagos'})
                      </span>
                      <span className="font-bold text-green-600">
                        {formatCurrency(selectedFactura.monto_pagado)}
                      </span>
                    </div>
                    <div className="resumen-row total">
                      <span>Saldo Pendiente</span>
                      <span className={`font-bold ${selectedFactura.saldo_pendiente > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(selectedFactura.saldo_pendiente)}
                      </span>
                    </div>
                    <div className="historial-payment-progress">
                      <div className="historial-progress-bar">
                        <div className="historial-progress-fill"
                          style={{ width: `${Math.min(100, (selectedFactura.monto_pagado / parseFloat(selectedFactura.total)) * 100)}%` }} />
                      </div>
                      <span className="historial-progress-percentage">
                        {((selectedFactura.monto_pagado / parseFloat(selectedFactura.total)) * 100).toFixed(1)}% pagado
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Sin pagos */}
              {(!selectedFactura.pagos || selectedFactura.pagos.length === 0) && (
                <div className="factura-section">
                  <div className="empty-state-small">
                    <AlertCircle className="w-8 h-8 text-gray-400" />
                    <p>No hay pagos registrados para esta factura</p>
                  </div>
                </div>
              )}

              {Number(selectedFactura.saldo_pendiente || 0) > 0 && (
                <div className="factura-section fp-detalles-pay-action">
                  <div>
                    <h4 className="section-title">
                      <CreditCard className="w-4 h-4" />Pago en línea
                    </h4>
                    <p>Saldo pendiente: <strong>{formatCurrency(selectedFactura.saldo_pendiente)}</strong></p>
                  </div>
                    
                  <button className="btn-primary" onClick={() => abrirPagoPaypal(selectedFactura)}>
                    <CreditCard className="w-4 h-4 mr-2" />Pagar con PayPal
                  </button>
                </div>
              )}

              </div>
            </div>

          </div>
        </div>
      )}

      {/* ==================== MODAL PAGO PAYPAL ==================== */}
      {showPaypalModal && paypalFactura && (
        <div className="modal-overlay">
          <div className="modal fp-paypal-modal">
            <div className="modal-header">
              <h3>
                <CreditCard className="w-5 h-5 inline mr-2" />
                Pagar con PayPal
              </h3>
              <button className="modal-close" onClick={closePaypalModal} title="Cerrar">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="modal-body fp-paypal-body">
              <div className="fp-paypal-summary">
                <div>
                  <span>Factura: </span>
                  <strong>{paypalFactura.num_factura || `#${paypalFactura.id_factura}`}</strong>
                </div>
                <div>
                  <span>Periodo: </span>
                  <strong>{formatPeriodoDisplay(paypalFactura.periodo)}</strong>
                </div>
                <div>
                  <span>Saldo pendiente: </span>
                  <strong>{formatCurrency(paypalFactura.saldo_pendiente)}</strong>
                </div>
              </div>

              {paypalFactura.cargando_detalle ? (
                <p className="paypal-status">
                  <RefreshCw className="w-4 h-4 spin-animation" />Cargando factura...
                </p>
              ) : paypalConfig?.enabled ? (
                <>
                  <div id="paypal-button-container-afiliado" className="paypal-button-container" />
                  {paypalLoading && (
                    <p className="paypal-status">
                      <RefreshCw className="w-4 h-4 spin-animation" />Procesando pago...
                    </p>
                  )}
                </>
              ) : (
                <div className="alert alert-warning">
                  <AlertCircle className="w-4 h-4" />
                  <p className="text-sm">PayPal todavía no está configurado en el servidor.</p>
                </div>
              )}

              {paypalMessage && <p className="paypal-message">{paypalMessage}</p>}
            </div>

            <div className="modal-footer fp-paypal-footer">
              <button className="btn-secondary" onClick={closePaypalModal}>
                <X className="w-4 h-4" />Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL SUBIDA COMPROBANTE ==================== */}
      {showUploadModal && uploadingPago && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3><Upload className="w-5 h-5 inline mr-2" />Subir Comprobante de Pago</h3>
              <button className="modal-close" onClick={closeUploadModal}><X className="w-5 h-5" /></button>
            </div>
            <div className="modal-body">
              <div className="detail-group">
                <label>Factura:</label>
                <p className="font-medium">{uploadingPago.num_factura || `#${uploadingPago.id_factura}`}</p>
              </div>
              <div className="detail-group">
                <label>Monto a pagar:</label>
                <p className="font-bold text-lg text-blue-600">{formatCurrency(uploadingPago.saldo_pendiente)}</p>
              </div>
              <div className="detail-group">
                <label className="filter-label">Seleccionar comprobante (JPG, PNG, PDF - máx. 5MB)</label>
                <input type="file" accept="image/jpeg,image/jpg,image/png,application/pdf"
                  onChange={handleFileSelect} className="filter-input" />
                {comprobante && (
                  <p className="mt-2 text-sm text-green-600 flex items-center gap-1">
                    <Paperclip className="w-4 h-4" />{comprobante.name}
                  </p>
                )}
              </div>
              {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
                </div>
              )}
              <div className="alert alert-warning">
                <AlertCircle className="w-4 h-4" />
                <p className="text-sm">
                  <strong>Importante:</strong> El comprobante será revisado por el administrador
                  antes de aprobar tu pago.
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={closeUploadModal} className="btn-secondary" disabled={loading}>Cancelar</button>
              <button onClick={subirComprobante} disabled={!comprobante || loading} className="btn-primary">
                {loading
                  ? <><RefreshCw className="w-4 h-4 spin-animation" />Subiendo...</>
                  : <><Upload className="w-4 h-4" />Subir Comprobante</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {paypalReceipt && (
        <PayPalPaymentReceipt
          payment={paypalReceipt.payment}
          factura={paypalReceipt.factura}
          onClose={() => setPaypalReceipt(null)}
        />
      )}

    </div>
  );
};

export default AffiliateBillingSection;
