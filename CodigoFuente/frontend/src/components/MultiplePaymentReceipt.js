// src/components/MultiplePaymentReceipt.js
import React, { useState, useEffect, useRef } from 'react';
import {
  X, CheckCircle, AlertCircle,
  User, FileText, DollarSign,
  CreditCard, Printer, Download, Receipt
} from 'lucide-react';
import './PaymentReceipt.css';
import { generateMultiplePaymentPDF, printMultipleThermalTicket } from './PaymentReceipt';
import paymentsServices from '../services/paymentsServices';

const MultiplePaymentReceipt = ({ pagoMultiple, facturas, afiliado, onClose, autoSaveComprobante = false }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError]               = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const autoSaveStartedRef = useRef(false);

  // ── Formateo ────────────────────────────────────────────────
  const parseLocalDate = (dateString) => {
    if (!dateString) return new Date();
    if (dateString.includes('T')) return new Date(dateString);
    const [y, m, d] = dateString.split('-');
    return new Date(y, m - 1, d);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return parseLocalDate(dateString).toLocaleDateString('es-EC', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return 'N/A'; }
  };

  const fmt = (value) =>
    new Intl.NumberFormat('es-EC', {
      style: 'currency', currency: 'USD', minimumFractionDigits: 2,
    }).format(parseFloat(value) || 0);

  // ── Extracción de datos ──────────────────────────────────────
  const extraerDatos = () => {
    // Afiliado
    const nombreCliente    = afiliado?.nombre_completo ?? afiliado?.nombreCompleto ?? 'N/A';
    const cedulaCliente    = afiliado?.cedula ?? afiliado?.usuario_sistema?.cedula ?? 'N/A';
    const direccionCliente = afiliado?.direccion ?? afiliado?.usuario_sistema?.direccion ?? 'N/A';
    const telefonoCliente  = afiliado?.telefono ?? afiliado?.usuario_sistema?.telefono ?? 'N/A';
    const codigoAfiliado   = afiliado?.cod_usuario_afi ?? afiliado?.codUsuarioAfi ?? 'N/A';
    const numMedidor       = afiliado?.num_medidor ?? afiliado?.numMedidor ?? 'N/A';
    const nombreSector     = afiliado?.nombre_sector ?? afiliado?.sector?.nombre_sector ?? 'N/A';
    const nombreCajero     = pagoMultiple?.cajero ?? pagoMultiple?.nombre_cajero ?? 'N/A';

    // Normalizar facturas y calcular totales
    let totalConsumo = 0, totalServicios = 0, totalMultas = 0;
    let totalMoraCalculada = 0, totalSubtotal = 0, totalIVA = 0, totalDescuento = 0;

    const facturasNorm = (facturas || []).map((f, idx) => {
      const numFactura   = f.num_factura ?? f.numfactura ?? f.numero_factura ?? 'S/N';
      const periodo      = f.periodo ?? f.periodo_factura ?? 'S/P';
      const fechaEmision = f.fecha_emision ?? f.fechaemision ?? '';
      const fechaVencimiento = f.fecha_vencimiento ?? f.fechavencimiento ?? '';
      const estadoFact   = f.estado_factura ?? f.estadofactura ?? 'pagada';
      const consumom3    = parseFloat(f.consumo_m3 ?? f.consumom3 ?? 0);

      const totalConMora = parseFloat(
        f.totalconmora ?? f.total_con_mora ?? f.saldo_pendiente ?? f.saldopendiente ?? f.total ?? 0
      );
      const saldoSinMora = parseFloat(
        f.saldopendiente ?? f.saldo_pendiente ?? f.totalfactura ?? f.total_factura ?? f.total ?? 0
      );

      // Mora: usar campo explícito; si no viene, calcularla por diferencia.
      const moraExplicita = parseFloat(
        f.mora?.monto ??
        f.mora_monto ??
        f.moramonto ??
        f.monto_mora ??
        f.mora_calculada ??
        f.recargo_mora ??
        f.interes_mora ??
        f.mora ??
        NaN
      );
      const moraPorDiferencia = totalConMora > saldoSinMora
        ? totalConMora - saldoSinMora
        : 0;
      const moraFactura = Number.isNaN(moraExplicita)
        ? moraPorDiferencia
        : moraExplicita;
      const diasMora = parseInt(
        f.mora?.dias_mora_efectivos ?? f.mora?.diasmoraefectivos ?? f.dias_transcurridos ?? 0
      );

      // Desglose desde f.desglose (estructura del modal anterior)
      const desglose    = f.desglose || {};
      const consumoVal  = parseFloat(desglose.consumo?.total  ?? f.subtotal_consumo  ?? 0);
      const servicioVal = parseFloat(desglose.servicios?.total ?? f.subtotal_servicios ?? 0);
      const multasVal   = parseFloat(desglose.multas?.total   ?? f.subtotal_multas   ?? 0);
      const cantMultas  = parseInt(desglose.multas?.cantidad ?? f.cantidad_multas ?? 0);

      const subtotal   = parseFloat(f.subtotal ?? (consumoVal + servicioVal + multasVal) ?? 0);
      const ivaPorc    = parseFloat(f.iva?.porcentaje ?? f.iva_porcentaje ?? 0);
      const ivaMonto   = parseFloat(f.impuesto ?? f.iva?.monto ?? 0);
      const descuento  = parseFloat(f.descuento ?? 0);

      totalConsumo        += consumoVal;
      totalServicios      += servicioVal;
      totalMultas         += multasVal;
      totalMoraCalculada  += moraFactura;
      totalSubtotal       += subtotal;
      totalIVA            += ivaMonto;
      totalDescuento      += descuento;

      return {
        idx: idx + 1,
        numFactura,
        periodo,
        fechaEmision,
        fechaVencimiento,
        estadoFact,
        consumom3,
        moraFactura,
        diasMora,
        consumoVal,
        servicioVal,
        multasVal,
        cantMultas,
        subtotal,
        ivaPorc,
        ivaMonto,
        descuento,
        totalConMora,
      };
    });

    // Mora total: preferir campo del back, si no sumar mora de cada factura
    const totalMora = parseFloat(pagoMultiple?.detalle_mora_total || 0) || totalMoraCalculada;
    const totalPagado = parseFloat(pagoMultiple?.monto_pago || 0)
      || facturasNorm.reduce((s, f) => s + f.totalConMora, 0);

    return {
      nombreCliente, cedulaCliente, direccionCliente,
      telefonoCliente, codigoAfiliado, numMedidor,
      nombreSector, nombreCajero,
      cantidadFacturas: facturasNorm.length,
      facturasNorm,
      totalConsumo, totalServicios, totalMultas,
      totalMora, totalSubtotal, totalIVA, totalDescuento,
      totalPagado,
    };
  };

  const datos = extraerDatos();

  // ── Auto-guardado ────────────────────────────────────────────
  useEffect(() => {
    const autoSave = async () => {
      if (!autoSaveComprobante) return;
      if (autoSaveStartedRef.current) {
        console.log('[PAGO MULT FRONT] auto-guardado omitido: ya estaba en proceso');
        return;
      }
      autoSaveStartedRef.current = true;
      try {
        const t0 = performance.now();
        const pdfFile = await generateMultiplePaymentPDF(pagoMultiple, facturas, afiliado);
        if (!pdfFile || pdfFile.size === 0) return;
        const idsPagos = [...new Set((pagoMultiple.ids_pagos || [pagoMultiple.id_pago]).filter(Boolean))];
        if (!Array.isArray(idsPagos) || idsPagos.length === 0) return;
        console.log('[PAGO MULT FRONT] auto-guardado comprobante:', {
          idsPagos,
          archivo: pdfFile.name,
          kb: (pdfFile.size / 1024).toFixed(2),
        });
        const resultados = await Promise.all(
          idsPagos.map(id => paymentsServices.uploadComprobante(id, pdfFile)
            .then(() => ({ id, ok: true }))
            .catch(() => ({ id, ok: false }))
          )
        );
        const ok = resultados.filter(r => r.ok).length;
        if (ok > 0) {
          setSuccessMessage(`Comprobante guardado (${ok}/${idsPagos.length})`);
          setTimeout(() => setSuccessMessage(null), 4000);
        }
        console.log(`[PAGO MULT FRONT] auto-guardado TOTAL: ${((performance.now() - t0) / 1000).toFixed(3)}s`);
      } catch (err) {
        console.warn('Auto-guardado:', err);
      }
    };
    autoSave();
  }, [autoSaveComprobante]); // eslint-disable-line

  // ── Acciones ─────────────────────────────────────────────────
  const handleDownload = async () => {
    try {
      setError(null); setIsGenerating(true);
      const pdfFile = await generateMultiplePaymentPDF(pagoMultiple, facturas, afiliado);
      if (!pdfFile || pdfFile.size === 0) throw new Error('PDF vacío');
      const url = URL.createObjectURL(pdfFile);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Comprobante_Multiple_${String(pagoMultiple.id_pago).padStart(6, '0')}.pdf`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
      setSuccessMessage('PDF descargado'); setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) { setError('Error al descargar PDF'); }
    finally { setIsGenerating(false); }
  };

  const handlePrintA4 = async () => {
    try {
      setError(null); setIsGenerating(true);
      const pdfFile = await generateMultiplePaymentPDF(pagoMultiple, facturas, afiliado);
      if (!pdfFile || pdfFile.size === 0) throw new Error('PDF vacío');
      const url = URL.createObjectURL(pdfFile);
      const w = window.open(url, '_blank');
      if (w) w.addEventListener('load', () => w.print());
      setSuccessMessage('Abriendo impresión...'); setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) { setError('Error al imprimir'); }
    finally { setIsGenerating(false); }
  };

  const handlePrintThermal = () => {
    try {
      setError(null);
      printMultipleThermalTicket(pagoMultiple, facturas, afiliado);
      setSuccessMessage('Enviando a impresora...'); setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) { setError('Error al imprimir ticket'); }
  };

  if (!pagoMultiple || !facturas || !afiliado) {
    return (
      <div className="modal-overlay">
        <div className="modal">
          <div className="modal-header">
            <h3><AlertCircle className="w-5 h-5 inline mr-2" />Error</h3>
            <button className="modal-close" onClick={onClose}><X className="w-5 h-5" /></button>
          </div>
          <div className="modal-body">
            <p style={{ color: '#dc2626', padding: '20px', textAlign: 'center' }}>
              No se proporcionaron datos del pago.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="modal-overlay">
      <div className="modal modal-receipt" style={{ maxWidth: '760px' }}>

        {/* HEADER */}
        <div className="modal-header">
          <h3>
            Pago múltiple registrado
          </h3>
          <button className="modal-close" onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        <div className="modal-body receipt-body">

          {/* ── CABECERA EMPRESA ── */}
          <div className="receipt-header" style={{ textAlign: 'center', paddingBottom: '18px', borderBottom: '2px solid #e5e7eb', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: '0 0 2px' }}>
              JUNTA DE AGUA POTABLE
            </h2>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1d4ed8', margin: '0 0 6px' }}>SANJAPAMBA</h3>
            <div style={{ display: 'grid', gap: '3px', marginTop: '8px', color: '#334155', fontSize: '12px', lineHeight: '1.35' }}>
              <span>Sanjapamba, Chimborazo, Ecuador</span>
              <span>Teléfono: 593 3-XXX-XXXX</span>
            </div>

            {/* Badge comprobante */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              marginTop: '14px', padding: '8px 18px',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              borderRadius: '99px', color: 'white',
            }}>
              <span style={{ fontWeight: '700', fontSize: '13px', letterSpacing: '0.5px' }}>
                COMPROBANTE DE PAGO MÚLTIPLE
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px', marginTop: '12px' }}>
              {[
                ['No.', String(pagoMultiple.id_pago).padStart(6, '0')],
                ['Facturas', datos.cantidadFacturas],
                ['Fecha', formatDate(pagoMultiple.fecha_pago)],
              ].map(([label, value]) => (
                <div key={label} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 10px', minWidth: 0 }}>
                  <div style={{ fontSize: '10px', color: '#475569', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
                  <div style={{ fontSize: '12px', color: '#0f172a', fontWeight: '700', marginTop: '2px', overflowWrap: 'anywhere' }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── DOS COLUMNAS: AFILIADO + PAGO ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>

            {/* Afiliado */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 14px', background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                fontSize: '12px', fontWeight: '700', color: '#475569',
                textTransform: 'uppercase', letterSpacing: '0.5px',
              }}>
                <User style={{ width: '14px', height: '14px' }} />
                Datos del Afiliado
              </div>
              <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { label: 'Nombre',    value: datos.nombreCliente },
                  { label: 'Cédula',    value: datos.cedulaCliente },
                  { label: 'Cód. Afiliado', value: datos.codigoAfiliado },
                  { label: 'Medidor',   value: datos.numMedidor },
                  { label: 'Sector',    value: datos.nombreSector },
                  { label: 'Dirección', value: datos.direccionCliente },
                  { label: 'Teléfono', value: datos.telefonoCliente },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', gap: '8px' }}>
                    <span style={{ color: '#475569', fontWeight: '700', flexShrink: 0 }}>{label}</span>
                    <span style={{ color: '#1e293b', fontWeight: '500', textAlign: 'right', wordBreak: 'break-word' }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Datos del pago */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

              {/* Info pago */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 14px', background: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                  fontSize: '12px', fontWeight: '700', color: '#475569',
                  textTransform: 'uppercase', letterSpacing: '0.5px',
                }}>
                  <CreditCard style={{ width: '14px', height: '14px' }} />
                  Datos del Pago
                </div>
                <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { label: 'Método',   value: pagoMultiple.metodo_pago ?? 'N/A' },
                    { label: 'Cajero',   value: datos.nombreCajero },
                    { label: 'Ref.',     value: pagoMultiple.referencia ?? pagoMultiple.numero_transaccion ?? '—' },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', gap: '8px' }}>
                      <span style={{ color: '#475569', fontWeight: '700' }}>{label}</span>
                      <span style={{ color: '#1e293b', fontWeight: '500', textAlign: 'right' }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Resumen conceptos */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', flex: 1 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 14px', background: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                  fontSize: '12px', fontWeight: '700', color: '#475569',
                  textTransform: 'uppercase', letterSpacing: '0.5px',
                }}>
                  <DollarSign style={{ width: '14px', height: '14px' }} />
                  Resumen de Conceptos
                </div>
                <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {[
                    { label: 'Consumo de agua', note: `${datos.facturasNorm.reduce((s, f) => s + f.consumom3, 0).toFixed(2)} m³ facturados`, val: datos.totalConsumo, color: '#047857', show: datos.totalConsumo > 0 },
                    { label: 'Servicios adicionales', note: 'Cargos operativos incluidos en las facturas', val: datos.totalServicios, color: '#1d4ed8', show: datos.totalServicios > 0 },
                    { label: 'Multas', note: `${datos.facturasNorm.reduce((s, f) => s + f.cantMultas, 0)} multa(s) aplicadas`, val: datos.totalMultas, color: '#b91c1c', show: datos.totalMultas > 0 },
                    { label: 'Mora', note: 'Recargos por atraso incluidos en el pago', val: datos.totalMora, color: '#b45309', show: datos.totalMora > 0 },
                    { label: 'IVA', note: 'Impuestos calculados en las facturas', val: datos.totalIVA, color: '#475569', show: datos.totalIVA > 0 },
                    { label: 'Descuentos', note: 'Valores descontados del total', val: datos.totalDescuento, color: '#047857', show: datos.totalDescuento > 0 },
                  ].filter(r => r.show).map(({ label, note, val, color }) => (
                    <div key={label} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'start', fontSize: '12px', padding: '7px 0', borderBottom: '1px solid #e5e7eb' }}>
                      <span style={{ color: '#334155' }}>
                        <strong style={{ display: 'block', color: '#0f172a' }}>{label}</strong>
                        <span style={{ fontSize: '11px', color: '#475569' }}>{note}</span>
                      </span>
                      <span style={{ fontWeight: '800', color, fontFamily: 'monospace' }}>{fmt(val)}</span>
                    </div>
                  ))}
                  {datos.totalConsumo === 0 && datos.totalServicios === 0 &&
                   datos.totalMultas  === 0 && datos.totalMora      === 0 && (
                    <span style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
                      Sin desglose disponible
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── TABLA DE FACTURAS ── */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', marginBottom: '20px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '12px 16px',
              background: 'linear-gradient(135deg, #1e40af, #3b82f6)',
              color: 'white', fontSize: '13px', fontWeight: '700',
            }}>
              <FileText style={{ width: '16px', height: '16px' }} />
              Detalle de Facturas Pagadas ({datos.cantidadFacturas})
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    {['#', 'Factura', 'Periodo', 'Emisión', 'Estado', 'm³', 'Consumo', 'Servicios', 'Multas', 'Mora', 'IVA', 'Subtotal', 'Desc.', 'Total'].map(h => (
                      <th key={h} style={{
                        padding: '8px 10px', textAlign: h === '#' ? 'center' : ['Total', 'Mora', 'IVA', 'Consumo', 'Servicios', 'Multas', 'Subtotal', 'Desc.', 'm³'].includes(h) ? 'right' : 'left',
                        fontWeight: '700', color: '#475569', fontSize: '11px',
                        textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {datos.facturasNorm.map((f, i) => (
                    <tr key={i} style={{
                      borderBottom: '1px solid #f1f5f9',
                      background: i % 2 === 0 ? 'white' : '#fafbfc',
                    }}>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        <span style={{
                          background: '#eff6ff', color: '#2563eb',
                          fontWeight: '700', fontSize: '11px',
                          padding: '2px 7px', borderRadius: '4px',
                        }}>{f.idx}</span>
                      </td>
                      <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontWeight: '700', color: '#1e293b', whiteSpace: 'nowrap' }}>
                        {f.numFactura}
                      </td>
                      <td style={{ padding: '8px 10px', color: '#475569', whiteSpace: 'nowrap' }}>{f.periodo}</td>
                      <td style={{ padding: '8px 10px', color: '#475569', whiteSpace: 'nowrap' }}>{f.fechaEmision ? formatDate(f.fechaEmision) : 'N/A'}</td>
                      <td style={{ padding: '8px 10px', color: '#047857', fontWeight: '700', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>{f.estadoFact}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: '#059669', fontWeight: '600' }}>
                        {f.consumom3}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#059669' }}>
                        {f.consumoVal > 0 ? fmt(f.consumoVal) : '—'}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#2563eb' }}>
                        {f.servicioVal > 0 ? fmt(f.servicioVal) : '—'}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#dc2626' }}>
                        {f.multasVal > 0 ? fmt(f.multasVal) : '—'}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#d97706', fontWeight: f.moraFactura > 0 ? '700' : '400' }}>
                        {f.moraFactura > 0 ? fmt(f.moraFactura) : '—'}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#6b7280' }}>
                        {f.ivaMonto > 0 ? fmt(f.ivaMonto) : f.ivaPorc > 0 ? `${f.ivaPorc}%` : 'Exento'}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#334155' }}>
                        {fmt(f.subtotal)}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#047857' }}>
                        {f.descuento > 0 ? fmt(f.descuento) : '—'}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700', color: '#1e293b' }}>
                        {fmt(f.totalConMora)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Totales */}
                <tfoot>
                  <tr style={{ borderTop: '2px solid #e2e8f0', background: '#f8fafc' }}>
                    <td colSpan={6} style={{ padding: '10px 10px', fontWeight: '700', color: '#374151', fontSize: '12px' }}>
                      TOTALES ({datos.cantidadFacturas} facturas)
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700', color: '#059669' }}>
                      {datos.totalConsumo > 0 ? fmt(datos.totalConsumo) : '—'}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700', color: '#2563eb' }}>
                      {datos.totalServicios > 0 ? fmt(datos.totalServicios) : '—'}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700', color: '#dc2626' }}>
                      {datos.totalMultas > 0 ? fmt(datos.totalMultas) : '—'}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700', color: '#d97706' }}>
                      {datos.totalMora > 0 ? fmt(datos.totalMora) : '—'}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace', color: '#6b7280' }}>
                      {datos.totalIVA > 0 ? fmt(datos.totalIVA) : '—'}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700', color: '#334155' }}>
                      {fmt(datos.totalSubtotal)}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700', color: '#047857' }}>
                      {datos.totalDescuento > 0 ? fmt(datos.totalDescuento) : '—'}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '800', color: '#1e293b', fontSize: '13px' }}>
                      {fmt(datos.totalPagado)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ── TOTAL DESTACADO ── */}
          <div style={{
            background: 'linear-gradient(135deg, #1e293b, #334155)',
            borderRadius: '12px', padding: '16px 20px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: '16px',
          }}>
            <div>
              <div style={{ fontSize: '11px', color: '#cbd5e1', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>
                Total pagado — {datos.cantidadFacturas} facturas
              </div>
              <div style={{ fontSize: '12px', color: '#e2e8f0' }}>
                Incluye mora{datos.totalMora > 0 ? ` (${fmt(datos.totalMora)})` : ' ($0.00)'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '28px', fontWeight: '800', color: '#10b981', fontFamily: 'monospace', letterSpacing: '-0.5px' }}>
                {fmt(datos.totalPagado)}
              </div>
            </div>
          </div>

          {/* Observaciones */}
          {pagoMultiple.observaciones && (
            <div style={{
              background: '#fef3c7', border: '1px solid #fde68a',
              borderLeft: '4px solid #f59e0b', borderRadius: '8px',
              padding: '12px 14px', marginBottom: '16px', fontSize: '13px', color: '#78350f',
            }}>
              <strong style={{ display: 'block', marginBottom: '4px', color: '#92400e' }}>Observaciones:</strong>
              {pagoMultiple.observaciones}
            </div>
          )}

          {/* Firmas */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '24px', padding: '0 20px' }}>
            {['Firma del Cajero', 'Firma del Afiliado'].map(label => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ height: '1px', background: '#94a3b8', marginBottom: '6px' }} />
                <span style={{ fontSize: '11px', color: '#475569', fontWeight: '600' }}>{label}</span>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '11px', color: '#475569', paddingTop: '12px', borderTop: '1px dashed #e2e8f0' }}>
            <p style={{ margin: '2px 0' }}>Este comprobante certifica el pago múltiple realizado.</p>
            <p style={{ margin: '2px 0' }}>Generado el {new Date().toLocaleString('es-EC')}</p>
          </div>

          {/* Alertas */}
          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px',
              padding: '10px 14px', background: '#fee2e2', border: '1px solid #fecaca',
              borderRadius: '8px', fontSize: '13px', color: '#dc2626', fontWeight: '600',
            }}>
              <AlertCircle style={{ width: '16px', flexShrink: 0 }} />{error}
            </div>
          )}

          {successMessage && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px',
              padding: '10px 14px', background: '#d1fae5', border: '1px solid #a7f3d0',
              borderRadius: '8px', fontSize: '13px', color: '#059669', fontWeight: '600',
            }}>
              <CheckCircle style={{ width: '16px', flexShrink: 0 }} />{successMessage}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="modal-footer" style={{ justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn-secondary" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            Cerrar
          </button>
          <button className="btn-primary" onClick={handlePrintThermal}
            style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none' }}>
            <Receipt className="w-4 h-4 mr-2" />
            Ticket 58mm
          </button>
          <button className="btn-primary" onClick={handlePrintA4} disabled={isGenerating}>
            <Printer className="w-4 h-4 mr-2" />
            Imprimir A4
          </button>
          <button className="btn-primary" onClick={handleDownload} disabled={isGenerating}>
            <Download className="w-4 h-4 mr-2" />
            Descargar PDF
          </button>
        </div>
      </div>
    </div>
  );
};

export default MultiplePaymentReceipt;
