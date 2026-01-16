// src/components/MultiplePaymentReceipt.js
import React, { useState, useEffect } from 'react';
import { X, Printer, Download, CheckCircle, AlertCircle } from 'lucide-react';
import './PaymentReceipt.css';
import { generateMultiplePaymentPDF, printMultipleThermalTicket } from './PaymentReceipt';
import paymentsServices from '../services/paymentsServices';

const MultiplePaymentReceipt = ({ pagoMultiple, facturas, afiliado, onClose }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // ============================================================
  // 1. FUNCIONES AUXILIARES DE FORMATEO
  // ============================================================
  const parseLocalDate = (dateString) => {
    if (!dateString) return new Date();
    if (/^\d{4}-\d{2}-\d{2}/.test(dateString)) {
      const [year, month, day] = dateString.split('-');
      return new Date(year, month - 1, day);
    }
    return new Date(dateString);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = parseLocalDate(dateString);
      return date.toLocaleDateString('es-EC', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'N/A';
    }
  };

  const formatCurrency = (value) => {
    const numValue = parseFloat(value) || 0;
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(numValue);
  };

  // ============================================================
  // 2. EXTRACCIÓN Y PREPARACIÓN DE DATOS DETALLADOS
  // ============================================================
  const extraerDatos = () => {
    const usuario = afiliado?.usuario_sistema || afiliado?.usuarioSistema;

    // Calcular totales generales
    let totalGeneral = 0;
    let totalConsumo = 0;
    let totalServicios = 0;
    let totalMultas = 0;
    let totalMora = 0;
    let totalSubtotal = 0;
    let totalIVA = 0;
    let totalDescuento = 0;

    // Procesar cada factura para extraer detalles
    const facturasConDetalles = facturas.map(factura => {
      const consumoFactura = parseFloat(factura.consumo_m3 || 0);
      const montoFactura = parseFloat(factura.saldo_pendiente || factura.total_con_mora || factura.total || 0);
      const moraFactura = parseFloat(factura.mora_monto || 0);
      const subtotalFactura = parseFloat(factura.subtotal || 0);
      const ivaFactura = parseFloat(factura.impuesto || 0);
      const descuentoFactura = parseFloat(factura.descuento || 0);

      // Extraer detalles de consumo, servicios y multas
      const detalles = factura.detalles || [];
      const detallesConsumo = detalles.filter(d => d.tipo_detalle === 'consumo');
      const detallesServicios = detalles.filter(d => d.tipo_detalle === 'servicio');
      const detallesMultas = detalles.filter(d => d.tipo_detalle === 'multa');

      const consumoDetalleTotal = detallesConsumo.reduce((sum, d) => sum + parseFloat(d.subtotal_detalle || 0), 0);
      const serviciosDetalleTotal = detallesServicios.reduce((sum, d) => sum + parseFloat(d.subtotal_detalle || 0), 0);
      const multasDetalleTotal = detallesMultas.reduce((sum, d) => sum + parseFloat(d.subtotal_detalle || 0), 0);

      totalGeneral += montoFactura;
      totalConsumo += consumoDetalleTotal;
      totalServicios += serviciosDetalleTotal;
      totalMultas += multasDetalleTotal;
      totalMora += moraFactura;
      totalSubtotal += subtotalFactura;
      totalIVA += ivaFactura;
      totalDescuento += descuentoFactura;

      return {
        ...factura,
        consumo: consumoFactura,
        montoTotal: montoFactura,
        mora: moraFactura,
        detallesConsumo,
        detallesServicios,
        detallesMultas,
        subtotalConsumo: consumoDetalleTotal,
        subtotalServicios: serviciosDetalleTotal,
        subtotalMultas: multasDetalleTotal
      };
    });

    return {
      nombreCliente: String(usuario?.nombre_completo || 'N/A'),
      cedulaCliente: String(usuario?.cedula || 'N/A'),
      direccionCliente: String(usuario?.direccion || 'N/A'),
      telefonoCliente: String(usuario?.telefono || 'N/A'),
      codigoAfiliado: String(afiliado?.cod_usuario_afi || afiliado?.codUsuarioAfi || 'N/A'),
      numMedidor: String(afiliado?.num_medidor || afiliado?.numMedidor || 'N/A'),
      nombreSector: String(afiliado?.sector?.nombre_sector || afiliado?.sector?.nombreSector || 'N/A'),
      nombreCajero: String(pagoMultiple?.cajero || 'N/A'),
      cantidadFacturas: facturas.length,
      totalGeneral,
      totalConsumo,
      totalServicios,
      totalMultas,
      totalMora,
      totalSubtotal,
      totalIVA,
      totalDescuento,
      facturasConDetalles
    };
  };

  const datos = extraerDatos();

// ============================================================
// 3. AUTO-GUARDADO AL CARGAR EL COMPONENTE - MEJORADO
// ============================================================
useEffect(() => {
  const autoSave = async () => {
    try {
      console.log('🔄 Auto-guardando comprobante múltiple...');
      
      // Generar PDF
      const pdfFile = await generateMultiplePaymentPDF(pagoMultiple, facturas, afiliado);
      
      if (!pdfFile || pdfFile.size === 0) {
        console.error('❌ No se pudo generar el PDF');
        return;
      }
      
      // ✅ OBTENER TODOS LOS IDs DE PAGO
      const idsPagos = pagoMultiple.ids_pagos || [pagoMultiple.id_pago];
      
      console.log(`📤 Subiendo comprobante a ${idsPagos.length} pagos:`, idsPagos);
      
      if (!Array.isArray(idsPagos) || idsPagos.length === 0) {
        console.error('❌ No se encontraron IDs de pagos');
        setError('No se pudieron identificar los pagos');
        return;
      }
      
      // ✅ SUBIR COMPROBANTE A TODOS LOS PAGOS
      const uploadPromises = idsPagos.map(async (idPago) => {
        try {
          await paymentsServices.uploadComprobante(idPago, pdfFile);
          console.log(`✅ Comprobante guardado en pago ${idPago}`);
          return { idPago, success: true };
        } catch (error) {
          console.error(`❌ Error al guardar en pago ${idPago}:`, error);
          return { idPago, success: false, error: error.message };
        }
      });
      
      // Esperar a que todas las subidas terminen
      const resultados = await Promise.all(uploadPromises);
      
      // Contar éxitos y fallos
      const exitosos = resultados.filter(r => r.success).length;
      const fallidos = resultados.filter(r => !r.success).length;
      
      console.log(`📊 Resultado: ${exitosos}/${idsPagos.length} comprobantes guardados`);
      
      // Mostrar mensaje de éxito
      if (exitosos > 0) {
        const mensaje = fallidos > 0 
          ? `Comprobante guardado en ${exitosos}/${idsPagos.length} pagos`
          : `Comprobante guardado en todos los pagos (${exitosos})`;
        
        setSuccessMessage(mensaje);
        setTimeout(() => setSuccessMessage(null), 4000);
      } else {
        setError('No se pudo guardar ningún comprobante');
      }
      
    } catch (err) {
      console.error('⚠️ Error crítico al auto-guardar comprobante:', err);
      // No mostramos error al usuario, no es crítico
    }
  };

  autoSave();
}, [afiliado, facturas, pagoMultiple]); // Solo ejecutar una vez al montar



  // ============================================================
  // 4. ACCIONES CORREGIDAS
  // ============================================================
  const handleDownload = async () => {
    try {
      setError(null);
      setIsGenerating(true);
      
      const pdfFile = await generateMultiplePaymentPDF(pagoMultiple, facturas, afiliado);
      
      if (!pdfFile || pdfFile.size === 0) {
        throw new Error('No se pudo generar el PDF');
      }

      // Crear enlace de descarga
      const url = URL.createObjectURL(pdfFile);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Comprobante_Multiple_${String(pagoMultiple.id_pago).padStart(6, '0')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccessMessage('PDF descargado exitosamente');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error al descargar PDF:', err);
      setError('Error al descargar PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrintA4 = async () => {
    try {
      setError(null);
      setIsGenerating(true);
      
      const pdfFile = await generateMultiplePaymentPDF(pagoMultiple, facturas, afiliado);
      
      if (!pdfFile || pdfFile.size === 0) {
        throw new Error('No se pudo generar el PDF');
      }

      // Abrir PDF en nueva ventana para imprimir
      const pdfBlobUrl = URL.createObjectURL(pdfFile);
      const printWindow = window.open(pdfBlobUrl, '_blank');
      
      if (printWindow) {
        printWindow.addEventListener('load', () => {
          printWindow.print();
        });
      }

      setSuccessMessage('Abriendo vista de impresión...');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error al imprimir:', err);
      setError('Error al imprimir PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrintThermal = () => {
    try {
      setError(null);
      printMultipleThermalTicket(pagoMultiple, facturas, afiliado);
      setSuccessMessage('Enviando a impresora térmica...');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error al imprimir ticket:', err);
      setError('Error al imprimir ticket térmico');
    }
  };

  // ============================================================
  // 5. VALIDACIONES
  // ============================================================
  if (!pagoMultiple || !facturas || !afiliado) {
    return (
      <div className="modal-overlay">
        <div className="modal modal-receipt">
          <div className="modal-header">
            <h3>
              <AlertCircle className="w-5 h-5 inline mr-2" />
              Error
            </h3>
            <button className="modal-close" onClick={onClose}>
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="modal-body">
            <p className="receipt-error">
              No se proporcionaron los datos del pago múltiple o facturas.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // 6. RENDERIZADO DEL COMPROBANTE VISUAL
  // ============================================================
  return (
    <div className="modal-overlay">
      <div className="modal modal-receipt">
        {/* ENCABEZADO */}
        <div className="modal-header">
          <h3>
            <CheckCircle className="w-5 h-5 inline mr-2" />
            Comprobante de Pago Múltiple
          </h3>
          <button className="modal-close" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CUERPO */}
        <div className="modal-body receipt-body">
          {/* ENCABEZADO EMPRESA */}
          <div className="receipt-header">
            <h2 className="receipt-company-name">JUNTA DE AGUA POTABLE</h2>
            <h3 className="receipt-company-location">SANJAPAMBA</h3>
            <p className="receipt-company-info">Sanjapamba, Chimborazo, Ecuador</p>
            <p className="receipt-company-info">Teléfono: 593 3-XXX-XXXX</p>
          </div>

          <div className="receipt-divider"></div>

          {/* TÍTULO */}
          <div className="receipt-title-section">
            <h4 className="receipt-title">COMPROBANTE DE PAGO MÚLTIPLE</h4>
            <p className="receipt-number">No. {String(pagoMultiple.id_pago).padStart(6, '0')}</p>
            <p className="receipt-subtitle">{datos.cantidadFacturas} FACTURAS PAGADAS</p>
          </div>

          {/* DATOS DEL CLIENTE */}
          <div className="receipt-section">
            <div className="receipt-section-header">
              <h5>DATOS DEL AFILIADO</h5>
            </div>
            <div className="receipt-info-grid">
              <div className="receipt-info-item">
                <span className="receipt-label">Nombre Afiliado:</span>
                <span className="receipt-value">{datos.nombreCliente}</span>
              </div>
              <div className="receipt-info-item">
                <span className="receipt-label">Cédula:</span>
                <span className="receipt-value">{datos.cedulaCliente}</span>
              </div>
              <div className="receipt-info-item">
                <span className="receipt-label">Código Afiliado:</span>
                <span className="receipt-value">{datos.codigoAfiliado}</span>
              </div>
              <div className="receipt-info-item">
                <span className="receipt-label">No. Medidor:</span>
                <span className="receipt-value">{datos.numMedidor}</span>
              </div>
              <div className="receipt-info-item">
                <span className="receipt-label">Dirección:</span>
                <span className="receipt-value">{datos.direccionCliente}</span>
              </div>
              <div className="receipt-info-item">
                <span className="receipt-label">Teléfono:</span>
                <span className="receipt-value">{datos.telefonoCliente}</span>
              </div>
              <div className="receipt-info-item">
                <span className="receipt-label">Sector:</span>
                <span className="receipt-value">{datos.nombreSector}</span>
              </div>
            </div>
          </div>

          {/* DETALLES DEL PAGO */}
          <div className="receipt-section">
            <div className="receipt-section-header">
              <h5>DETALLES DEL PAGO</h5>
            </div>
            <div className="receipt-info-grid">
              <div className="receipt-info-item">
                <span className="receipt-label">Fecha de Pago:</span>
                <span className="receipt-value">{formatDate(pagoMultiple.fecha_pago)}</span>
              </div>
              <div className="receipt-info-item">
                <span className="receipt-label">Método de Pago:</span>
                <span className="receipt-value">{pagoMultiple.metodo_pago}</span>
              </div>
              <div className="receipt-info-item">
                <span className="receipt-label">Recibido por:</span>
                <span className="receipt-value">{datos.nombreCajero}</span>
              </div>
            </div>
          </div>

          {/* TABLA DE FACTURAS PAGADAS */}
          <div className="receipt-section">
            <div className="receipt-section-header">
              <h5>FACTURAS PAGADAS</h5>
            </div>
            <div className="receipt-invoices-table">
              <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                <thead style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #d1d5db' }}>
                  <tr>
                    <th style={{ padding: '8px 4px', textAlign: 'left' }}>#</th>
                    <th style={{ padding: '8px 4px', textAlign: 'left' }}>Factura</th>
                    <th style={{ padding: '8px 4px', textAlign: 'left' }}>Periodo</th>
                    <th style={{ padding: '8px 4px', textAlign: 'center' }}>Consumo</th>
                    <th style={{ padding: '8px 4px', textAlign: 'right' }}>Mora</th>
                    <th style={{ padding: '8px 4px', textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.facturasConDetalles.map((factura, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '8px 4px' }}>{idx + 1}</td>
                      <td style={{ padding: '8px 4px' }}>{factura.num_factura}</td>
                      <td style={{ padding: '8px 4px' }}>{factura.periodo}</td>
                      <td style={{ padding: '8px 4px', textAlign: 'center' }}>{factura.consumo} m³</td>
                      <td style={{ padding: '8px 4px', textAlign: 'right' }}>
                        {factura.mora > 0 ? formatCurrency(factura.mora) : '-'}
                      </td>
                      <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 'bold' }}>
                        {formatCurrency(factura.montoTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* RESUMEN DE CONCEPTOS */}
          <div className="receipt-section">
            <div className="receipt-section-header">
              <h5>RESUMEN DE CONCEPTOS</h5>
            </div>
            
            {/* Consumo de Agua */}
            {datos.totalConsumo > 0 && (
              <div className="receipt-concept-group">
                <div className="receipt-concept-header">
                  <span>💧 Consumo de Agua</span>
                  <span className="receipt-concept-total">{formatCurrency(datos.totalConsumo)}</span>
                </div>
              </div>
            )}

            {/* Servicios Adicionales */}
            {datos.totalServicios > 0 && (
              <div className="receipt-concept-group">
                <div className="receipt-concept-header">
                  <span>🔧 Servicios Adicionales</span>
                  <span className="receipt-concept-total">{formatCurrency(datos.totalServicios)}</span>
                </div>
              </div>
            )}

            {/* Multas */}
            {datos.totalMultas > 0 && (
              <div className="receipt-concept-group receipt-concept-danger">
                <div className="receipt-concept-header">
                  <span>🚨 Multas</span>
                  <span className="receipt-concept-total">{formatCurrency(datos.totalMultas)}</span>
                </div>
              </div>
            )}

            {/* Mora */}
            {datos.totalMora > 0 && (
              <div className="receipt-concept-group receipt-concept-warning">
                <div className="receipt-concept-header">
                  <span>⏰ Mora por Pago Tardío</span>
                  <span className="receipt-concept-total">{formatCurrency(datos.totalMora)}</span>
                </div>
              </div>
            )}
          </div>

          {/* RESUMEN FINANCIERO */}
          <div className="receipt-section">
            <div className="receipt-summary">
              <div className="receipt-summary-row">
                <span>Subtotal:</span>
                <span>{formatCurrency(datos.totalSubtotal)}</span>
              </div>
              {datos.totalDescuento > 0 && (
                <div className="receipt-summary-row receipt-summary-discount">
                  <span>Descuento:</span>
                  <span>-{formatCurrency(datos.totalDescuento)}</span>
                </div>
              )}
              <div className="receipt-summary-row">
                <span>IVA ({datos.totalIVA > 0 ? ((datos.totalIVA / datos.totalSubtotal) * 100).toFixed(1) : '0'}%):</span>
                <span>{formatCurrency(datos.totalIVA)}</span>
              </div>
              <div className="receipt-summary-row receipt-summary-total">
                <span>TOTAL PAGADO:</span>
                <span>{formatCurrency(datos.totalGeneral)}</span>
              </div>
            </div>
          </div>

          {/* MONTO PAGADO DESTACADO */}
          <div className="receipt-payment-amount">
            <span className="receipt-payment-label">MONTO TOTAL PAGADO</span>
            <span className="receipt-payment-value">{formatCurrency(pagoMultiple.monto_pago)}</span>
          </div>

          {/* OBSERVACIONES */}
          {pagoMultiple.observaciones && (
            <div className="receipt-observations">
              <strong>Observaciones:</strong> {pagoMultiple.observaciones}
            </div>
          )}

          {/* FIRMAS */}
          <div className="receipt-signatures">
            <div className="receipt-signature">
              <div className="receipt-signature-line"></div>
              <span>Firma del Cajero</span>
            </div>
            <div className="receipt-signature">
              <div className="receipt-signature-line"></div>
              <span>Firma del Cliente</span>
            </div>
          </div>

          {/* PIE DE PÁGINA */}
          <div className="receipt-footer">
            <p>Este comprobante certifica el pago múltiple realizado</p>
            <p>Generado el {new Date().toLocaleString('es-EC')}</p>
          </div>

          {/* MENSAJES */}
          {error && (
            <div className="receipt-alert receipt-alert-error">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {successMessage && (
            <div className="receipt-alert receipt-alert-success">
              <CheckCircle className="w-4 h-4" />
              {successMessage}
            </div>
          )}
        </div>

        {/* FOOTER CON ACCIONES (SIN BOTÓN GUARDAR) */}
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            Cerrar
          </button>

          <button
            className="btn-primary"
            onClick={handlePrintThermal}
            style={{ backgroundColor: '#10b981' }}
            title="Imprimir ticket en impresora térmica 58mm"
          >
            <Printer className="w-4 h-4 mr-2" />
            Ticket 58mm
          </button>

          <button
            className="btn-primary"
            onClick={handlePrintA4}
            disabled={isGenerating}
          >
            <Printer className="w-4 h-4 mr-2" />
            Imprimir A4
          </button>

          <button
            className="btn-primary"
            onClick={handleDownload}
            disabled={isGenerating}
          >
            <Download className="w-4 h-4 mr-2" />
            Descargar PDF
          </button>
        </div>
      </div>
    </div>
  );
};

export default MultiplePaymentReceipt;
