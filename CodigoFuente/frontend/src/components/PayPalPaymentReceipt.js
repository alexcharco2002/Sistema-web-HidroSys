import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle, Download, Printer, X } from 'lucide-react';
import jsPDF from 'jspdf';
import './PaymentReceipt.css';
import affiliateBillingServices from '../services/affiliateBillingServices';

const PayPalPaymentReceipt = ({ payment, factura, onClose }) => {
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const hasSavedPdfRef = useRef(false);

  const formatCurrency = (value) =>
    new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD'
    }).format(Number(value || 0));

  const formatDate = (value) => {
    if (!value) return new Date().toLocaleString('es-EC');
    return new Date(value).toLocaleString('es-EC', {
      year: 'numeric',
      month: 'long',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPdf = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;
    const usuario = factura?.usuario_afiliado?.usuario_sistema || {};

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('JUNTA DE AGUA POTABLE', pageWidth / 2, y, { align: 'center' });
    y += 8;
    doc.setFontSize(14);
    doc.text('SANJAPAMBA', pageWidth / 2, y, { align: 'center' });
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Sanjapamba, Chimborazo, Ecuador', pageWidth / 2, y, { align: 'center' });

    y += 18;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('COMPROBANTE DE PAGO PAYPAL', pageWidth / 2, y, { align: 'center' });
    y += 7;
    doc.setFontSize(10);
    doc.text(`No. ${String(payment?.id_pago || '').padStart(6, '0')}`, pageWidth / 2, y, { align: 'center' });

    const section = (title) => {
      y += 14;
      doc.setFillColor(239, 246, 255);
      doc.rect(16, y - 5, pageWidth - 32, 9, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(30, 64, 175);
      doc.text(title, 20, y + 1);
      doc.setTextColor(17, 24, 39);
      y += 10;
    };

    const row = (label, value) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(label, 20, y);
      doc.setFont('helvetica', 'normal');
      doc.text(String(value || 'N/A'), 65, y);
      y += 7;
    };

    section('DATOS DEL AFILIADO');
    row('Nombre:', usuario.nombre_completo);
    row('Cedula:', usuario.cedula);
    row('Codigo:', factura?.usuario_afiliado?.cod_usuario_afi);
    row('Medidor:', factura?.usuario_afiliado?.num_medidor);

    section('DATOS DE FACTURA');
    row('Factura:', factura?.num_factura || payment?.num_factura);
    row('Periodo:', factura?.periodo);
    row('Total factura:', formatCurrency(factura?.total));

    section('DATOS DEL PAGO');
    row('Metodo:', 'PAYPAL');
    row('Monto pagado:', formatCurrency(payment?.monto_pago));
    row('Fecha:', formatDate(payment?.fecha_pago));
    row('Order ID:', payment?.paypal_order_id);
    row('Capture ID:', payment?.paypal_capture_id);

    doc.setDrawColor(226, 232, 240);
    doc.line(16, 268, pageWidth - 16, 268);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Este comprobante certifica el pago realizado mediante PayPal.', pageWidth / 2, 275, { align: 'center' });
    doc.text(`Generado el ${new Date().toLocaleString('es-EC')}`, pageWidth / 2, 281, { align: 'center' });

    return doc;
  };

  const getPdfFile = () => {
    const doc = getPdf();
    const blob = doc.output('blob');
    return new File(
      [blob],
      `Comprobante_PayPal_${String(payment?.id_pago || '').padStart(6, '0')}.pdf`,
      { type: 'application/pdf' }
    );
  };

  const savePdfToDatabase = async ({ silent = false } = {}) => {
    if (!payment?.id_pago) return;

    try {
      if (!silent) {
        setError('');
        setSuccessMessage('');
        setIsGenerating(true);
      }

      const file = getPdfFile();
      const result = await affiliateBillingServices.guardarComprobantePago(payment.id_pago, file);

      if (!result.success) {
        throw new Error(result.message || 'No se pudo guardar el comprobante');
      }

      hasSavedPdfRef.current = true;
      if (!silent) {
        setSuccessMessage('Comprobante guardado correctamente');
      }
    } catch (err) {
      if (!silent) {
        setError(err.message || 'Error al guardar el PDF');
      } else {
        console.error('Error guardando comprobante PayPal:', err);
      }
    } finally {
      if (!silent) {
        setIsGenerating(false);
      }
    }
  };

  useEffect(() => {
    if (!payment?.id_pago || hasSavedPdfRef.current) return;
    savePdfToDatabase({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payment?.id_pago]);

  const handleDownload = () => {
    try {
      setError('');
      setIsGenerating(true);
      const doc = getPdf();
      doc.save(`Comprobante_PayPal_${String(payment?.id_pago || '').padStart(6, '0')}.pdf`);
    } catch (err) {
      setError('Error al descargar el PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    try {
      setError('');
      setIsGenerating(true);
      const doc = getPdf();
      doc.autoPrint();
      window.open(doc.output('bloburl'), '_blank');
    } catch (err) {
      setError('Error al imprimir el comprobante');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!payment) return null;

  return (
    <div className="modal-overlay">
      <div className="modal modal-receipt">
        <div className="modal-header">
          <h3><CheckCircle className="w-5 h-5 inline mr-2" />Comprobante PayPal</h3>
          <button className="modal-close" onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        <div className="modal-body receipt-body">
          <div className="receipt-header">
            <h2 className="receipt-company-name">
              JUNTA DE AGUA POTABLE
            </h2>

            <h3 className="receipt-company-location">
              SANJAPAMBA
            </h3>

            <p className="receipt-company-info">
              Sanjapamba, Chimborazo, Ecuador
            </p>
          </div>

          <div className="receipt-divider" />

          <div className="receipt-title-section">
            <h4 className="receipt-title">COMPROBANTE DE PAGO PAYPAL</h4>
            <p className="receipt-number">No. {String(payment.id_pago).padStart(6, '0')}</p>
          </div>

          <div className="receipt-section">
            <div className="receipt-section-header"><h5>RESUMEN</h5></div>
            <div className="receipt-info-grid">
              <div className="receipt-info-item"><span className="receipt-label">Factura:</span><span className="receipt-value">{factura?.num_factura || payment.num_factura}</span></div>
              <div className="receipt-info-item"><span className="receipt-label">Metodo:</span><span className="receipt-value">PAYPAL</span></div>
              <div className="receipt-info-item"><span className="receipt-label">Fecha:</span><span className="receipt-value">{formatDate(payment.fecha_pago)}</span></div>
              <div className="receipt-info-item"><span className="receipt-label">Monto:</span><span className="receipt-value">{formatCurrency(payment.monto_pago)}</span></div>
              <div className="receipt-info-item"><span className="receipt-label">Order ID:</span><span className="receipt-value">{payment.paypal_order_id}</span></div>
              <div className="receipt-info-item"><span className="receipt-label">Capture ID:</span><span className="receipt-value">{payment.paypal_capture_id}</span></div>
            </div>
          </div>

          {error && (
            <div className="receipt-alert error">
              <AlertCircle className="w-4 h-4" />{error}
            </div>
          )}

          {successMessage && (
            <div className="receipt-alert success">
              <CheckCircle className="w-4 h-4" />{successMessage}
            </div>
          )}
        </div>
          <div className="modal-footer paypal-receipt-footer">
            <button
              type="button"
              className="btn-secondary flex items-center gap-2"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
              Cerrar
            </button>

            <button
              type="button"
              className="btn-primary flex items-center gap-2"
              onClick={handlePrint}
              disabled={isGenerating}
            >
              <Printer className="w-4 h-4" />
              Imprimir A4
            </button>

            <button
              type="button"
              className="btn-primary flex items-center gap-2"
              onClick={handleDownload}
              disabled={isGenerating}
            >
              <Download className="w-4 h-4" />
              Descargar PDF
            </button>
          </div>

      </div>
    </div>
  );
};

export default PayPalPaymentReceipt;
