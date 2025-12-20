// src/components/PaymentReceipt.js
import React, { useRef } from 'react';
import { X, Printer, CheckCircle } from 'lucide-react';
import './PaymentReceipt.css';

const PaymentReceipt = ({ pago, factura, onClose }) => {
  const receiptRef = useRef(null);

  const handlePrint = () => {
    const printContent = receiptRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '', 'height=800,width=800');
    printWindow.document.write(`
      <html>
        <head>
          <title>Comprobante de Pago</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 10px;
              font-size: 12px;
            }
            .receipt-body {
              max-width: 700px;
              margin: 0 auto;
            }
            .receipt-company-header {
              text-align: center;
              margin-bottom: 10px;
            }
            .receipt-company-header h1 {
              margin: 0;
              font-size: 18px;
              color: #1f2937;
            }
            .receipt-company-header h2 {
              margin: 3px 0;
              font-size: 15px;
              color: #3b82f6;
            }
            .receipt-company-header p {
              margin: 2px 0;
              font-size: 11px;
              color: #6b7280;
            }
            .receipt-divider {
              height: 1px;
              background: #d1d5db;
              margin: 8px 0;
            }
            .receipt-title {
              text-align: center;
              margin-bottom: 12px;
            }
            .receipt-title h3 {
              margin: 0;
              font-size: 16px;
              color: #1f2937;
            }
            .receipt-number {
              margin: 3px 0 0 0;
              font-size: 12px;
              color: #6b7280;
            }
            .receipt-section {
              margin-bottom: 10px;
            }
            .receipt-section h4 {
              margin: 0 0 6px 0;
              font-size: 13px;
              color: #374151;
              border-bottom: 1px solid #e5e7eb;
              padding-bottom: 3px;
            }
            .receipt-info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 6px;
            }
            .receipt-info-item {
              display: flex;
              justify-content: space-between;
              padding: 5px 7px;
              background: #f9fafb;
              border-radius: 4px;
              font-size: 11px;
            }
            .receipt-info-item .label {
              font-weight: 600;
              color: #6b7280;
            }
            .receipt-info-item .value {
              font-weight: 500;
              color: #1f2937;
              text-align: right;
            }
            .status-pagada {
              color: #10b981 !important;
              font-weight: bold !important;
            }
            .status-pendiente {
              color: #f59e0b !important;
            }
            .status-vencida {
              color: #ef4444 !important;
            }
            .receipt-amount-section {
              background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
              padding: 10px 15px;
              border-radius: 6px;
              margin: 10px 0;
            }
            .receipt-amount-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              color: white;
            }
            .receipt-amount-row .label {
              font-size: 13px;
              font-weight: 600;
            }
            .receipt-amount-row .amount {
              font-size: 22px;
              font-weight: bold;
            }
            .receipt-notes {
              background: #fef3c7;
              padding: 8px;
              border-radius: 4px;
              border-left: 3px solid #f59e0b;
              margin: 0;
              color: #78350f;
              font-style: italic;
              font-size: 11px;
            }
            .receipt-footer {
              margin-top: 15px;
              text-align: center;
              color: #6b7280;
              font-size: 10px;
            }
            .receipt-footer p {
              margin: 2px 0;
            }
            .receipt-signature {
              display: flex;
              justify-content: space-around;
              margin: 20px 0 10px;
            }
            .signature-line {
              text-align: center;
            }
            .signature-line hr {
              width: 140px;
              border: none;
              border-top: 1px solid #000;
              margin: 25px auto 3px;
            }
            .signature-line p {
              margin-top: 3px;
              font-size: 10px;
              color: #9ca3af;
            }
            .receipt-print-date {
              margin-top: 10px;
              font-size: 9px;
              color: #9ca3af;
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-EC', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return '$0.00';
    return `$${parseFloat(amount).toFixed(2)}`;
  };

  const getStatusClass = (estado) => {
    if (estado === 'pagada' || estado === 'Pagada') return 'status-pagada';
    if (estado === 'pendiente' || estado === 'Pendiente') return 'status-pendiente';
    if (estado === 'vencida' || estado === 'Vencida') return 'status-vencida';
    return '';
  };

  return (
    <div className="receipt-modal-overlay" onClick={onClose}>
      <div className="receipt-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header del modal */}
        <div className="receipt-header no-print">
          <h2>
            <CheckCircle size={22} />
            Comprobante de Pago
          </h2>
          <div className="receipt-actions">
            <button className="btn-print" onClick={handlePrint}>
              <Printer size={16} />
              Imprimir
            </button>
            <button className="btn-close" onClick={onClose}>
              <X size={16} />
              Cerrar
            </button>
          </div>
        </div>

        {/* Cuerpo del comprobante */}
        <div className="receipt-body" ref={receiptRef}>
          {/* Encabezado de la empresa */}
          <div className="receipt-company-header">
            <h1>Sistema de Facturación y Cobros</h1>
            <h2>Junta de Agua Potable</h2>
            <p>Sanjapamba, Chimborazo, Ecuador</p>
            <p>Teléfono: (593) 3-XXX-XXXX</p>
          </div>

          <div className="receipt-divider"></div>

          {/* Título del comprobante */}
          <div className="receipt-title">
            <h3>COMPROBANTE DE PAGO</h3>
            <p className="receipt-number">N° {String(pago.id_pago).padStart(8, '0')}</p>
          </div>

          {/* Información del cliente */}
          <div className="receipt-section">
            <h4>Datos del Cliente</h4>
            <div className="receipt-info-grid">
              <div className="receipt-info-item">
                <span className="label">Cliente:</span>
                <span className="value">{factura.nombre_cliente || 'N/A'}</span>
              </div>
              <div className="receipt-info-item">
                <span className="label">Cédula:</span>
                <span className="value">{factura.cedula || 'N/A'}</span>
              </div>
              <div className="receipt-info-item">
                <span className="label">Código Medidor:</span>
                <span className="value">{factura.codigo_medidor || 'N/A'}</span>
              </div>
              <div className="receipt-info-item">
                <span className="label">Dirección:</span>
                <span className="value">{factura.direccion || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Información de la factura */}
          <div className="receipt-section">
            <h4>Datos de Factura</h4>
            <div className="receipt-info-grid">
              <div className="receipt-info-item">
                <span className="label">N° Factura:</span>
                <span className="value">{String(factura.id_factura).padStart(8, '0')}</span>
              </div>
              <div className="receipt-info-item">
                <span className="label">Período:</span>
                <span className="value">{factura.periodo || 'N/A'}</span>
              </div>
              <div className="receipt-info-item">
                <span className="label">Fecha Emisión:</span>
                <span className="value">{formatDate(factura.fecha_emision)}</span>
              </div>
              <div className="receipt-info-item">
                <span className="label">Fecha Vencimiento:</span>
                <span className="value">{formatDate(factura.fecha_vencimiento)}</span>
              </div>
              <div className="receipt-info-item">
                <span className="label">Estado:</span>
                <span className={`value ${getStatusClass(factura.estado)}`}>
                  {factura.estado || 'N/A'}
                </span>
              </div>
              <div className="receipt-info-item">
                <span className="label">Total Factura:</span>
                <span className="value">{formatCurrency(factura.total)}</span>
              </div>
            </div>
          </div>

          {/* Información del pago */}
          <div className="receipt-section">
            <h4>Datos del Pago</h4>
            <div className="receipt-info-grid">
              <div className="receipt-info-item">
                <span className="label">Fecha de Pago:</span>
                <span className="value">{formatDate(pago.fecha_pago)}</span>
              </div>
              <div className="receipt-info-item">
                <span className="label">Método:</span>
                <span className="value">{pago.metodo_pago || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Monto pagado destacado */}
          <div className="receipt-amount-section">
            <div className="receipt-amount-row">
              <span className="label">MONTO PAGADO:</span>
              <span className="amount">{formatCurrency(pago.monto)}</span>
            </div>
          </div>

          {/* Observaciones */}
          {pago.observaciones && (
            <div className="receipt-section">
              <p className="receipt-notes">
                <strong>Observaciones:</strong> {pago.observaciones}
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="receipt-footer">
            <p>Este comprobante certifica el pago realizado</p>
            <p>Gracias por su pago puntual</p>
          </div>

          {/* Firmas */}
          <div className="receipt-signature">
            <div className="signature-line">
              <hr />
              <p>Firma del Cajero</p>
            </div>
            <div className="signature-line">
              <hr />
              <p>Firma del Cliente</p>
            </div>
          </div>

          <div className="receipt-print-date">
            <p>Impreso el: {new Date().toLocaleString('es-EC')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentReceipt;
