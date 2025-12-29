// src/components/PaymentReceipt.js
import React, { useState } from 'react';
import { X, Printer, Download, CheckCircle, AlertCircle, Save } from 'lucide-react';
import './PaymentReceipt.css';
import jsPDF from 'jspdf';

const PaymentReceipt = ({ pago, factura, onClose, onSave }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  // ============================================
  // FUNCIONES DE FORMATEO (SIN BUG DE ZONA HORARIA)
  // ============================================

  const parseLocalDate = (dateString) => {
    // YYYY-MM-DD → fecha local segura
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [year, month, day] = dateString.split('-');
      return new Date(year, month - 1, day);
    }
    // Fechas con hora
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

  const formatDateShort = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = parseLocalDate(dateString);
      return date.toLocaleDateString('es-EC');
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

  // ============================================
  // GENERAR PDF OPTIMIZADO (LIGERO < 5MB)
  // ============================================
  const generatePDF = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      // Crear documento PDF con compresión
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;
      let y = 20;

      // ===== ENCABEZADO =====
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(31, 41, 55);
      doc.text('JUNTA DE AGUA POTABLE', pageWidth / 2, y, { align: 'center' });
      
      y += 7;
      doc.setFontSize(14);
      doc.setTextColor(59, 130, 246);
      doc.text('SANJAPAMBA', pageWidth / 2, y, { align: 'center' });
      
      y += 5;
      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128);
      doc.text('Sanjapamba, Chimborazo, Ecuador', pageWidth / 2, y, { align: 'center' });
      
      y += 4;
      doc.text('Teléfono: (593) 3-XXX-XXXX', pageWidth / 2, y, { align: 'center' });

      // Línea divisoria
      y += 6;
      doc.setDrawColor(209, 213, 219);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);

      // ===== TÍTULO =====
      y += 10;
      doc.setFontSize(14);
      doc.setTextColor(31, 41, 55);
      doc.setFont('helvetica', 'bold');
      doc.text('COMPROBANTE DE PAGO', pageWidth / 2, y, { align: 'center' });
      
      y += 6;
      doc.setFontSize(10);
      doc.setTextColor(107, 114, 128);
      doc.text(`No. ${pago.id_pago || 'N/A'}`, pageWidth / 2, y, { align: 'center' });

      // ===== DATOS DEL CLIENTE =====
      y += 10;
      doc.setFontSize(11);
      doc.setTextColor(55, 65, 81);
      doc.setFont('helvetica', 'bold');
      doc.text('DATOS DEL CLIENTE', margin, y);
      
      y += 7;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(31, 41, 55);
      
      const nombreCliente = factura?.usuario_afiliado?.usuario_sistema 
        ? `${factura.usuario_afiliado.usuario_sistema.nombres || ''} ${factura.usuario_afiliado.usuario_sistema.apellidos || ''}`.trim()
        : 'N/A';
      const cedulaCliente = factura?.usuario_afiliado?.usuario_sistema?.cedula || 'N/A';
      const codigoCliente = factura?.usuario_afiliado?.cod_usuario_afi || 'N/A';
      const numMedidor = factura?.usuario_afiliado?.medidores?.[0]?.num_medidor || 'N/A';
      const nombreSector = factura?.usuario_afiliado?.sector?.nombre_sector || 'N/A';

      doc.text(`Cliente: ${nombreCliente}`, margin, y);
      y += 5;
      doc.text(`Cédula: ${cedulaCliente}`, margin, y);
      doc.text(`Código: ${codigoCliente}`, pageWidth / 2, y);
      y += 5;
      doc.text(`Medidor: ${numMedidor}`, margin, y);
      doc.text(`Sector: ${nombreSector}`, pageWidth / 2, y);

      // ===== DATOS DE LA FACTURA =====
      y += 10;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(55, 65, 81);
      doc.text('DATOS DE LA FACTURA', margin, y);
      
      y += 7;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(31, 41, 55);
      
      doc.text(`Factura No.: ${factura?.num_factura || 'N/A'}`, margin, y);
      y += 5;
      doc.text(`Fecha Emisión: ${formatDateShort(factura?.fecha_emision)}`, margin, y);
      y += 5;
      doc.text(`Fecha Vencimiento: ${formatDateShort(factura?.fecha_vencimiento)}`, margin, y);
      y += 5;
      doc.text(`Total Factura: ${formatCurrency(factura?.total)}`, margin, y);
      doc.text(`Estado: ${(factura?.estado_factura || 'N/A').toUpperCase()}`, pageWidth / 2, y);

      // ===== DETALLES DEL PAGO =====
      y += 10;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(55, 65, 81);
      doc.text('DETALLES DEL PAGO', margin, y);
      
      y += 7;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      
      doc.text(`Fecha de Pago: ${formatDate(pago?.fecha_pago)}`, margin, y);
      y += 5;
      doc.text(`Método de Pago: ${pago?.metodo_pago || 'N/A'}`, margin, y);
      y += 5;
      
      const nombreCajero = pago?.usuario_cajero 
        ? `${pago.usuario_cajero.nombres || ''} ${pago.usuario_cajero.apellidos || ''}`.trim()
        : 'N/A';
      doc.text(`Recibido por: ${nombreCajero}`, margin, y);

      // ===== MONTO PAGADO (DESTACADO) =====
      y += 12;
      doc.setFillColor(59, 130, 246);
      doc.roundedRect(margin, y - 5, pageWidth - (margin * 2), 18, 3, 3, 'F');
      
      y += 4;
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('MONTO PAGADO:', margin + 5, y);
      
      doc.setFontSize(18);
      const montoPagadoStr = formatCurrency(pago?.monto_pago);
      doc.text(montoPagadoStr, pageWidth - margin - 5, y, { align: 'right' });

      // ===== OBSERVACIONES =====
      if (pago?.observaciones && pago.observaciones.trim() !== '') {
        y += 15;
        doc.setFillColor(254, 243, 199);
        const obsHeight = 12;
        doc.roundedRect(margin, y - 3, pageWidth - (margin * 2), obsHeight, 2, 2, 'F');
        
        y += 3;
        doc.setTextColor(120, 53, 15);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        const obsTexto = `Observaciones: ${pago.observaciones}`;
        const obsLineas = doc.splitTextToSize(obsTexto, pageWidth - (margin * 2) - 10);
        doc.text(obsLineas, margin + 5, y);
        y += obsLineas.length * 4;
      }

      // ===== FIRMAS =====
      y += 30;
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      doc.line(margin + 10, y, margin + 70, y);
      doc.line(pageWidth - margin - 70, y, pageWidth - margin - 10, y);
      
      y += 4;
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175);
      doc.setFont('helvetica', 'normal');
      doc.text('Firma del Cajero', margin + 40, y, { align: 'center' });
      doc.text('Firma del Cliente', pageWidth - margin - 40, y, { align: 'center' });

      // ===== PIE DE PÁGINA =====
      y += 15;
      doc.setFontSize(7);
      doc.text('Este comprobante certifica el pago realizado', pageWidth / 2, y, { align: 'center' });
      y += 4;
      doc.text(`Impreso el: ${new Date().toLocaleString('es-EC')}`, pageWidth / 2, y, { align: 'center' });

      // ===== GENERAR BASE64 Y VALIDAR TAMAÑO =====
      const pdfOutput = doc.output('datauristring');
      const pdfBase64 = pdfOutput.split(',')[1];
      
      // Calcular tamaño en MB
      const sizeInBytes = (pdfBase64.length * 3) / 4;
      const sizeInMB = sizeInBytes / (1024 * 1024);
      
      console.log(`📄 PDF generado: ${sizeInMB.toFixed(2)} MB`);
      
      // Validar tamaño máximo de 5MB
      if (sizeInMB > 5) {
        throw new Error(`El PDF generado (${sizeInMB.toFixed(2)} MB) excede el límite de 5 MB`);
      }

      setIsGenerating(false);
      
      return {
        pdf: doc,
        base64: pdfBase64,
        size: sizeInMB
      };

    } catch (err) {
      console.error('❌ Error al generar PDF:', err);
      setError(err.message || 'Error desconocido al generar PDF');
      setIsGenerating(false);
      throw err;
    }
  };

  // ============================================
  // DESCARGAR PDF
  // ============================================
  const handleDownload = async () => {
    try {
      setError(null);
      setSuccessMessage('');
      
      const { pdf } = await generatePDF();
      const fileName = `Comprobante_Pago_${pago.id_pago}_Factura_${factura.num_factura}.pdf`;
      pdf.save(fileName);
      
      setSuccessMessage('✅ PDF descargado exitosamente');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Error al descargar PDF:', err);
    }
  };

  // ============================================
  // GUARDAR EN BASE DE DATOS
  // ============================================
  const handleSaveToDatabase = async () => {
    try {
      setError(null);
      setSuccessMessage('');
      
      const { base64, size } = await generatePDF();
      
      if (onSave) {
        await onSave({
          id_pago: pago.id_pago,
          pdf_base64: base64,
          pdf_size_mb: size,
          fecha_generacion: new Date().toISOString()
        });
        
        setSuccessMessage(`✅ Comprobante guardado (${size.toFixed(2)} MB)`);
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        throw new Error('No se proporcionó la función onSave');
      }
    } catch (err) {
      setError(`Error al guardar: ${err.message}`);
    }
  };

  // ============================================
  // IMPRIMIR PDF
  // ============================================
  const handlePrint = async () => {
    try {
      setError(null);
      setSuccessMessage('');
      
      const { pdf } = await generatePDF();
      pdf.autoPrint();
      window.open(pdf.output('bloburl'), '_blank');
      
      setSuccessMessage('✅ Abriendo vista de impresión...');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Error al imprimir:', err);
    }
  };

  // ============================================
  // VALIDACIONES
  // ============================================
  if (!pago || !factura) {
    return (
      <div className="receipt-modal-overlay">
        <div className="receipt-modal-content" style={{ maxWidth: '400px' }}>
          <div className="receipt-header">
            <h2>Error</h2>
            <button className="btn-close" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
          <div className="receipt-body" style={{ padding: '20px', textAlign: 'center' }}>
            <AlertCircle size={48} color="#ef4444" style={{ margin: '0 auto 10px' }} />
            <p>No se proporcionaron los datos del pago o factura.</p>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDERIZADO DEL COMPONENTE
  // ============================================
  return (
    <div className="receipt-modal-overlay" onClick={onClose}>
      <div className="receipt-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* HEADER CON BOTONES */}
        <div className="receipt-header">
          <h2>
            <CheckCircle size={22} style={{ color: '#10b981' }} />
            Comprobante de Pago
          </h2>
          <div className="receipt-actions">
            <button 
              className="btn-print" 
              onClick={handlePrint}
              disabled={isGenerating}
              title="Imprimir comprobante"
            >
              <Printer size={16} />
              Imprimir
            </button>
            <button 
              className="btn-download" 
              onClick={handleDownload}
              disabled={isGenerating}
              title="Descargar PDF"
            >
              <Download size={16} />
              Descargar
            </button>
            {onSave && (
              <button 
                className="btn-download" 
                onClick={handleSaveToDatabase}
                disabled={isGenerating}
                style={{ background: '#8b5cf6' }}
                title="Guardar en base de datos"
              >
                <Save size={16} />
                Guardar BD
              </button>
            )}
            <button className="btn-close" onClick={onClose} title="Cerrar">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* MENSAJES DE ERROR Y ÉXITO */}
        <div className="receipt-body">
          {error && (
            <div style={{ 
              padding: '12px', 
              background: '#fee2e2', 
              borderRadius: '6px',
              marginBottom: '15px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              border: '1px solid #fca5a5'
            }}>
              <AlertCircle size={18} color="#dc2626" />
              <span style={{ color: '#dc2626', fontSize: '13px', fontWeight: '500' }}>
                {error}
              </span>
            </div>
          )}

          {successMessage && (
            <div style={{ 
              padding: '12px', 
              background: '#d1fae5', 
              borderRadius: '6px',
              marginBottom: '15px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              border: '1px solid #6ee7b7'
            }}>
              <CheckCircle size={18} color="#059669" />
              <span style={{ color: '#059669', fontSize: '13px', fontWeight: '500' }}>
                {successMessage}
              </span>
            </div>
          )}

          {isGenerating && (
            <div style={{ 
              padding: '20px', 
              textAlign: 'center',
              color: '#6b7280',
              fontSize: '14px'
            }}>
              ⏳ Generando comprobante...
            </div>
          )}

          {/* VISTA PREVIA DEL COMPROBANTE */}
          <div className="receipt-company-header">
            <h1>JUNTA DE AGUA POTABLE</h1>
            <h2>SANJAPAMBA</h2>
            <p>Sanjapamba, Chimborazo, Ecuador</p>
            <p>Teléfono: (593) 3-XXX-XXXX</p>
          </div>

          <div className="receipt-divider"></div>

          <div className="receipt-title">
            <h3>COMPROBANTE DE PAGO</h3>
            <p className="receipt-number">No. {pago.id_pago}</p>
          </div>

          {/* DATOS DEL CLIENTE */}
          <div className="receipt-section">
            <h4>Datos del Cliente</h4>
            <div className="receipt-info-grid">
              <div className="receipt-info-item">
                <span className="label">Cliente:</span>
                <span className="value">
                  {factura.usuario_afiliado?.usuario_sistema?.nombres || ''}{' '}
                  {factura.usuario_afiliado?.usuario_sistema?.apellidos || ''}
                </span>
              </div>
              <div className="receipt-info-item">
                <span className="label">Cédula:</span>
                <span className="value">
                  {factura.usuario_afiliado?.usuario_sistema?.cedula || 'N/A'}
                </span>
              </div>
              <div className="receipt-info-item">
                <span className="label">Código:</span>
                <span className="value">
                  {factura.usuario_afiliado?.cod_usuario_afi || 'N/A'}
                </span>
              </div>
              <div className="receipt-info-item">
                <span className="label">Medidor:</span>
                <span className="value">
                  {factura.usuario_afiliado?.medidores?.[0]?.num_medidor || 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* DATOS DE LA FACTURA */}
          <div className="receipt-section">
            <h4>Datos de la Factura</h4>
            <div className="receipt-info-grid">
              <div className="receipt-info-item">
                <span className="label">Factura No.:</span>
                <span className="value">{factura.num_factura || 'N/A'}</span>
              </div>
              <div className="receipt-info-item">
                <span className="label">Fecha Emisión:</span>
                <span className="value">{formatDateShort(factura.fecha_emision)}</span>
              </div>
              <div className="receipt-info-item">
                <span className="label">Total Factura:</span>
                <span className="value">{formatCurrency(factura.total)}</span>
              </div>
              <div className="receipt-info-item">
                <span className="label">Estado:</span>
                <span className={`value status-${factura.estado_factura}`}>
                  {(factura.estado_factura || 'N/A').toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* DETALLES DEL PAGO */}
          <div className="receipt-section">
            <h4>Detalles del Pago</h4>
            <div className="receipt-info-grid">
              <div className="receipt-info-item">
                <span className="label">Fecha de Pago:</span>
                <span className="value">{formatDateShort(pago.fecha_pago)}</span>
              </div>
              <div className="receipt-info-item">
                <span className="label">Método de Pago:</span>
                <span className="value">{pago.metodo_pago || 'N/A'}</span>
              </div>
              <div className="receipt-info-item" style={{ gridColumn: '1 / -1' }}>
                <span className="label">Recibido por:</span>
                <span className="value">
                  {pago.usuario_cajero?.nombres || ''}{' '}
                  {pago.usuario_cajero?.apellidos || ''}
                </span>
              </div>
            </div>
          </div>

          {/* MONTO PAGADO */}
          <div className="receipt-amount-section">
            <div className="receipt-amount-row">
              <span className="label">MONTO PAGADO:</span>
              <span className="amount">{formatCurrency(pago.monto_pago)}</span>
            </div>
          </div>

          {/* OBSERVACIONES */}
          {pago.observaciones && pago.observaciones.trim() !== '' && (
            <p className="receipt-notes">
              <strong>Observaciones:</strong> {pago.observaciones}
            </p>
          )}

          {/* FIRMAS */}
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

          {/* PIE DE PÁGINA */}
          <div className="receipt-footer">
            <p>Este comprobante certifica el pago realizado</p>
            <p className="receipt-print-date">
              Generado el: {new Date().toLocaleString('es-EC')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// FUNCIÓN EXPORTABLE PARA GENERAR PDF
// ============================================

export const generatePaymentPDF = async (pago, factura) => {
  console.log('🔧 Generando PDF para pago:', pago.id_pago);
  
  try {
    // Validaciones
    if (!pago || !factura) {
      throw new Error('Faltan datos del pago o factura');
    }

    // 📅 Fecha corta (solo fecha)
    const formatDateShort = (dateString) => {
      if (!dateString) return 'N/A';

      try {
        // Si viene como YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
          const [year, month, day] = dateString.split('-');
          const date = new Date(year, month - 1, day); // LOCAL
          return date.toLocaleDateString('es-EC');
        }

        // Si viene con hora
        const date = new Date(dateString);
        return date.toLocaleDateString('es-EC');
      } catch {
        return 'N/A';
      }
    };

    // 📅 Fecha larga (fecha + hora)
    const formatDate = (dateString) => {
      if (!dateString) return 'N/A';

      try {
        let date;

        // YYYY-MM-DD → fecha local sin UTC
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
          const [year, month, day] = dateString.split('-');
          date = new Date(year, month - 1, day);
        } else {
          date = new Date(dateString);
        }

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

    // ===== CREAR DOCUMENTO PDF =====
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let y = 20;

    // ===== ENCABEZADO =====
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(31, 41, 55);
    doc.text('JUNTA DE AGUA POTABLE', pageWidth / 2, y, { align: 'center' });
    
    y += 7;
    doc.setFontSize(14);
    doc.setTextColor(59, 130, 246);
    doc.text('SANJAPAMBA', pageWidth / 2, y, { align: 'center' });
    
    y += 5;
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text('Sanjapamba, Chimborazo, Ecuador', pageWidth / 2, y, { align: 'center' });
    
    y += 4;
    doc.text('Teléfono: (593) 3-XXX-XXXX', pageWidth / 2, y, { align: 'center' });

    // Línea divisoria
    y += 6;
    doc.setDrawColor(209, 213, 219);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);

    // ===== TÍTULO =====
    y += 10;
    doc.setFontSize(14);
    doc.setTextColor(31, 41, 55);
    doc.setFont('helvetica', 'bold');
    doc.text('COMPROBANTE DE PAGO', pageWidth / 2, y, { align: 'center' });
    
    y += 6;
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.text(`No. ${pago.id_pago || 'N/A'}`, pageWidth / 2, y, { align: 'center' });

    // ===== DATOS DEL CLIENTE =====
    y += 10;
    doc.setFontSize(11);
    doc.setTextColor(55, 65, 81);
    doc.setFont('helvetica', 'bold');
    doc.text('DATOS DEL CLIENTE', margin, y);
    
    y += 7;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(31, 41, 55);
    
    const nombreCliente = factura?.usuario_afiliado?.usuario_sistema 
      ? `${factura.usuario_afiliado.usuario_sistema.nombres || ''} ${factura.usuario_afiliado.usuario_sistema.apellidos || ''}`.trim()
      : 'N/A';
    const cedulaCliente = factura?.usuario_afiliado?.usuario_sistema?.cedula || 'N/A';
    const codigoCliente = factura?.usuario_afiliado?.cod_usuario_afi || 'N/A';
    const numMedidor = factura?.usuario_afiliado?.medidores?.[0]?.num_medidor || 'N/A';
    const nombreSector = factura?.usuario_afiliado?.sector?.nombre_sector || 'N/A';

    doc.text(`Cliente: ${nombreCliente}`, margin, y);
    y += 5;
    doc.text(`Cédula: ${cedulaCliente}`, margin, y);
    doc.text(`Código: ${codigoCliente}`, pageWidth / 2, y);
    y += 5;
    doc.text(`Medidor: ${numMedidor}`, margin, y);
    doc.text(`Sector: ${nombreSector}`, pageWidth / 2, y);

    // ===== DATOS DE LA FACTURA =====
    y += 10;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(55, 65, 81);
    doc.text('DATOS DE LA FACTURA', margin, y);
    
    y += 7;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(31, 41, 55);
    
    doc.text(`Factura No.: ${factura?.num_factura || 'N/A'}`, margin, y);
    y += 5;
    doc.text(`Fecha Emisión: ${formatDateShort(factura?.fecha_emision)}`, margin, y);
    y += 5;
    doc.text(`Fecha Vencimiento: ${formatDateShort(factura?.fecha_vencimiento)}`, margin, y);
    y += 5;
    doc.text(`Total Factura: ${formatCurrency(factura?.total)}`, margin, y);
    doc.text(`Estado: ${(factura?.estado_factura || 'N/A').toUpperCase()}`, pageWidth / 2, y);

    // ===== DETALLES DEL PAGO =====
    y += 10;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(55, 65, 81);
    doc.text('DETALLES DEL PAGO', margin, y);
    
    y += 7;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    doc.text(`Fecha de Pago: ${formatDate(pago?.fecha_pago)}`, margin, y);
    y += 5;
    doc.text(`Método de Pago: ${pago?.metodo_pago || 'N/A'}`, margin, y);
    y += 5;
    
    const nombreCajero = pago?.usuario_cajero 
      ? `${pago.usuario_cajero.nombres || ''} ${pago.usuario_cajero.apellidos || ''}`.trim()
      : 'N/A';
    doc.text(`Recibido por: ${nombreCajero}`, margin, y);

    // ===== MONTO PAGADO (DESTACADO) =====
    y += 12;
    doc.setFillColor(59, 130, 246);
    doc.roundedRect(margin, y - 5, pageWidth - (margin * 2), 18, 3, 3, 'F');
    
    y += 4;
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('MONTO PAGADO:', margin + 5, y);
    
    doc.setFontSize(18);
    const montoPagadoStr = formatCurrency(pago?.monto_pago);
    doc.text(montoPagadoStr, pageWidth - margin - 5, y, { align: 'right' });

    // ===== OBSERVACIONES =====
    if (pago?.observaciones && pago.observaciones.trim() !== '') {
      y += 15;
      doc.setFillColor(254, 243, 199);
      const obsHeight = 12;
      doc.roundedRect(margin, y - 3, pageWidth - (margin * 2), obsHeight, 2, 2, 'F');
      
      y += 3;
      doc.setTextColor(120, 53, 15);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      const obsTexto = `Observaciones: ${pago.observaciones}`;
      const obsLineas = doc.splitTextToSize(obsTexto, pageWidth - (margin * 2) - 10);
      doc.text(obsLineas, margin + 5, y);
      y += obsLineas.length * 4;
    }

    // ===== FIRMAS =====
    y += 30;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.line(margin + 10, y, margin + 70, y);
    doc.line(pageWidth - margin - 70, y, pageWidth - margin - 10, y);
    
    y += 4;
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.setFont('helvetica', 'normal');
    doc.text('Firma del Cajero', margin + 40, y, { align: 'center' });
    doc.text('Firma del Cliente', pageWidth - margin - 40, y, { align: 'center' });

    // ===== PIE DE PÁGINA =====
    y += 15;
    doc.setFontSize(7);
    doc.text('Este comprobante certifica el pago realizado', pageWidth / 2, y, { align: 'center' });
    y += 4;
    doc.text(`Impreso el: ${new Date().toLocaleString('es-EC')}`, pageWidth / 2, y, { align: 'center' });

    // ===== GENERAR BLOB Y FILE =====
    const pdfBlob = doc.output('blob');
    const fileName = `Comprobante_Pago_${pago.id_pago}_Factura_${factura.num_factura}.pdf`;
    
    // Crear un objeto File desde el Blob
    const pdfFile = new File([pdfBlob], fileName, { 
      type: 'application/pdf',
      lastModified: Date.now()
    });

    // Validar tamaño (máximo 5MB)
    const sizeInMB = pdfFile.size / (1024 * 1024);
    console.log(`📄 PDF generado: ${fileName} (${sizeInMB.toFixed(2)} MB)`);
    
    if (sizeInMB > 5) {
      throw new Error(`El PDF generado (${sizeInMB.toFixed(2)} MB) excede el límite de 5 MB`);
    }

    // Retornar el archivo File (compatible con FormData y createObjectURL)
    return pdfFile;

  } catch (error) {
    console.error('❌ Error en generatePaymentPDF:', error);
    throw new Error(`Error al generar PDF: ${error.message}`);
  }
};


export default PaymentReceipt;
