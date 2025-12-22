// src/components/PaymentReceipt.js
import React, { useRef } from 'react';
import { X, Printer, CheckCircle } from 'lucide-react';
import './PaymentReceipt.css';

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const PaymentReceipt = ({ pago, factura, onClose }) => {
  const receiptRef = useRef(null);

  const handlePrint = () => {
    const printContent = receiptRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '', 'height=800,width=800');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Comprobante de Pago</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .receipt-container { max-width: 600px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
            .info-row { display: flex; justify-content: space-between; margin: 8px 0; }
            .label { font-weight: bold; }
            .footer { margin-top: 30px; text-align: center; font-size: 12px; border-top: 1px solid #ccc; padding-top: 10px; }
          </style>
        </head>
        <body>
          ${receiptRef.current.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="receipt-overlay">
      <div className="receipt-container">
        <div className="receipt-header">
          <h2>Comprobante de Pago</h2>
          <button className="close-button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div ref={receiptRef} className="receipt-content">
          <div className="receipt-body">
            <div className="success-icon">
              <CheckCircle size={48} color="#10b981" />
            </div>

            <h3>Sistema de Agua Potable</h3>
            <p>Sanjapamba, Chimborazo, Ecuador</p>
            <p>Teléfono: (593) 3-XXX-XXXX</p>

            <div className="divider"></div>

            <div className="receipt-details">
              <div className="detail-row">
                <span className="label">Comprobante N°:</span>
                <span className="value">{String(pago.id_pago).padStart(8, '0')}</span>
              </div>
              
              <div className="detail-row">
                <span className="label">Fecha de Pago:</span>
                <span className="value">
                  {new Date(pago.fecha_pago).toLocaleDateString('es-EC')}
                </span>
              </div>

              <div className="detail-row">
                <span className="label">Factura N°:</span>
                <span className="value">{factura?.num_factura || 'N/A'}</span>
              </div>

              <div className="divider"></div>

              <div className="detail-row">
                <span className="label">Cliente:</span>
                <span className="value">
                  {factura?.usuario_afiliado?.usuario_sistema?.nombres}{' '}
                  {factura?.usuario_afiliado?.usuario_sistema?.apellidos}
                </span>
              </div>

              <div className="detail-row">
                <span className="label">Cédula:</span>
                <span className="value">
                  {factura?.usuario_afiliado?.usuario_sistema?.cedula || 'N/A'}
                </span>
              </div>

              <div className="detail-row">
                <span className="label">Código Usuario:</span>
                <span className="value">
                  {factura?.usuario_afiliado?.cod_usuario_afi || 'N/A'}
                </span>
              </div>

              <div className="divider"></div>

              <div className="detail-row highlight">
                <span className="label">Monto Pagado:</span>
                <span className="value amount">
                  ${parseFloat(pago.monto_pago).toFixed(2)}
                </span>
              </div>

              <div className="detail-row">
                <span className="label">Método de Pago:</span>
                <span className="value">{pago.metodo_pago}</span>
              </div>

              {pago.observaciones && (
                <div className="detail-row">
                  <span className="label">Observaciones:</span>
                  <span className="value">{pago.observaciones}</span>
                </div>
              )}

              <div className="divider"></div>

              <p className="info-text">
                Este comprobante certifica el pago realizado
              </p>

              <div className="signatures">
                <div className="signature-box">
                  <div className="signature-line"></div>
                  <p>Firma del Cajero</p>
                </div>
                <div className="signature-box">
                  <div className="signature-line"></div>
                  <p>Firma del Cliente</p>
                </div>
              </div>

              <p className="print-date">
                Impreso el: {new Date().toLocaleString('es-EC')}
              </p>
            </div>
          </div>
        </div>

        <div className="receipt-actions">
          <button className="btn-print" onClick={handlePrint}>
            <Printer size={18} />
            Imprimir
          </button>
          <button className="btn-close" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export const generatePaymentPDF = async (pago, factura) => {
  try {
    console.log('📄 Iniciando generación de PDF...');

    // Crear el contenido HTML del comprobante
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Courier New', monospace;
            padding: 20px;
            background: white;
            color: #000;
            line-height: 1.5;
            width: 210mm;
            height: 297mm;
          }
          .receipt-container {
            max-width: 100%;
            margin: 0 auto;
            padding: 15px;
            background: white;
            min-height: 297mm;
          }
          .header {
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 2px solid #000;
            padding-bottom: 10px;
          }
          .header h1 {
            font-size: 16px;
            margin: 5px 0;
          }
          .header p {
            font-size: 11px;
            margin: 3px 0;
          }
          .section {
            margin: 15px 0;
            border: 1px solid #ccc;
            padding: 10px;
          }
          .section-title {
            font-weight: bold;
            font-size: 12px;
            margin-bottom: 8px;
            border-bottom: 1px solid #000;
            padding-bottom: 5px;
          }
          .row {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            padding: 5px 0;
            border-bottom: 1px dotted #ccc;
          }
          .row:last-child {
            border-bottom: none;
          }
          .label {
            font-weight: bold;
            width: 40%;
          }
          .value {
            text-align: right;
            width: 55%;
          }
          .amount-box {
            background: #f0f0f0;
            border: 2px solid #000;
            padding: 15px;
            text-align: center;
            margin: 20px 0;
            font-size: 18px;
            font-weight: bold;
          }
          .signatures {
            display: flex;
            justify-content: space-around;
            margin-top: 30px;
            padding-top: 20px;
          }
          .signature {
            width: 150px;
            text-align: center;
          }
          .sig-line {
            border-top: 1px solid #000;
            margin-bottom: 5px;
            height: 40px;
          }
          .sig-label {
            font-size: 10px;
          }
          .footer {
            text-align: center;
            font-size: 9px;
            margin-top: 20px;
            border-top: 1px solid #ccc;
            padding-top: 10px;
          }
        </style>
      </head>
      <body>
        <div class="receipt-container">
          <!-- ENCABEZADO -->
          <div class="header">
            <h1>COMPROBANTE DE PAGO</h1>
            <p>Junta de Agua Potable Sanjapamba</p>
            <p>Chimborazo, Ecuador</p>
            <p>Tel: (593) 3-XXX-XXXX</p>
          </div>

          <!-- DATOS GENERALES -->
          <div class="section">
            <div class="section-title">DATOS DEL COMPROBANTE</div>
            <div class="row">
              <span class="label">Número:</span>
              <span class="value">${String(pago.id_pago).padStart(8, '0')}</span>
            </div>
            <div class="row">
              <span class="label">Fecha:</span>
              <span class="value">${new Date(pago.fecha_pago).toLocaleDateString('es-EC')}</span>
            </div>
            <div class="row">
              <span class="label">Hora:</span>
              <span class="value">${new Date(pago.fecha_pago).toLocaleTimeString('es-EC')}</span>
            </div>
          </div>

          <!-- DATOS DEL CLIENTE -->
          <div class="section">
            <div class="section-title">DATOS DEL CLIENTE</div>
            <div class="row">
              <span class="label">Cliente:</span>
              <span class="value">${factura?.usuario_afiliado?.usuario_sistema?.nombres || ''} ${factura?.usuario_afiliado?.usuario_sistema?.apellidos || ''}</span>
            </div>
            <div class="row">
              <span class="label">Cédula:</span>
              <span class="value">${factura?.usuario_afiliado?.usuario_sistema?.cedula || 'N/A'}</span>
            </div>
            <div class="row">
              <span class="label">Usuario:</span>
              <span class="value">${factura?.usuario_afiliado?.cod_usuario_afi || 'N/A'}</span>
            </div>
            ${factura?.usuario_afiliado?.medidores?.[0]?.num_medidor ? `
            <div class="row">
              <span class="label">Medidor:</span>
              <span class="value">${factura.usuario_afiliado.medidores[0].num_medidor}</span>
            </div>
            ` : ''}
          </div>

          <!-- DATOS DE LA FACTURA -->
          ${factura?.num_factura ? `
          <div class="section">
            <div class="section-title">DATOS DE LA FACTURA</div>
            <div class="row">
              <span class="label">Número Factura:</span>
              <span class="value">${factura.num_factura}</span>
            </div>
            <div class="row">
              <span class="label">Fecha Emisión:</span>
              <span class="value">${factura?.fecha_emision ? new Date(factura.fecha_emision).toLocaleDateString('es-EC') : 'N/A'}</span>
            </div>
            <div class="row">
              <span class="label">Total Factura:</span>
              <span class="value">$ ${parseFloat(factura?.total || 0).toFixed(2)}</span>
            </div>
          </div>
          ` : ''}

          <!-- MONTO PAGADO -->
          <div class="amount-box">
            PAGO: $ ${parseFloat(pago.monto_pago).toFixed(2)}
          </div>

          <!-- DATOS DEL PAGO -->
          <div class="section">
            <div class="section-title">DETALLES DEL PAGO</div>
            <div class="row">
              <span class="label">Método:</span>
              <span class="value">${pago.metodo_pago || 'N/A'}</span>
            </div>
            ${pago.cajero ? `
            <div class="row">
              <span class="label">Cajero:</span>
              <span class="value">${pago.cajero.nombres} ${pago.cajero.apellidos}</span>
            </div>
            ` : ''}
            ${pago.observaciones ? `
            <div class="row">
              <span class="label">Observaciones:</span>
              <span class="value">${pago.observaciones}</span>
            </div>
            ` : ''}
          </div>

          <!-- FIRMAS -->
          <div class="signatures">
            <div class="signature">
              <div class="sig-line"></div>
              <div class="sig-label">Firma del Cajero</div>
            </div>
            <div class="signature">
              <div class="sig-line"></div>
              <div class="sig-label">Firma del Cliente</div>
            </div>
          </div>

          <!-- FOOTER -->
          <div class="footer">
            <p>Documento generado electrónicamente el ${new Date().toLocaleString('es-EC')}</p>
            <p>Gracias por su pago</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Crear elemento temporal
    const container = document.createElement('div');
    container.innerHTML = htmlContent;
    container.style.position = 'absolute';
    container.style.left = '-99999px';
    container.style.top = '0';
    container.style.width = '210mm';
    document.body.appendChild(container);

    // ⏱️ Esperar a que se renderice
    await new Promise(resolve => setTimeout(resolve, 500));

    // Convertir HTML a Canvas
    console.log('🎨 Convirtiendo HTML a imagen...');
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowHeight: container.scrollHeight,
      windowWidth: 800
    });

    // Limpiar elemento temporal
    document.body.removeChild(container);

    // Crear PDF
    console.log('📝 Creando PDF...');
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const imgWidth = 210; // Ancho A4 en mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

    // Generar blob
    const pdfBlob = pdf.output('blob');

    // Validación
    if (!pdfBlob || pdfBlob.size === 0) {
      throw new Error('PDF generado está vacío');
    }

    console.log('✅ PDF generado:', `${pdfBlob.size} bytes`);

    // Convertir a File
    const fileName = `comprobante_${String(pago.id_pago).padStart(8, '0')}_${Date.now()}.pdf`;
    const file = new File([pdfBlob], fileName, {
      type: 'application/pdf',
      lastModified: Date.now()
    });

    return file;

  } catch (error) {
    console.error('❌ Error generando PDF:', error);
    throw error;
  }
};

export default PaymentReceipt;
