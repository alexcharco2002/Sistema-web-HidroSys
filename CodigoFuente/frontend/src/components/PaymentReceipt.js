// src/components/PaymentReceipt.js

import React, { useState } from 'react';
import { X, Printer, Download, CheckCircle, AlertCircle } from 'lucide-react';
import './PaymentReceipt.css';
import jsPDF from 'jspdf';

const PaymentReceipt = ({ pago, factura, onClose, onSave }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  // ============================================================
  // 1. FUNCIONES AUXILIARES DE FORMATEO
  // ============================================================
  
  const parseLocalDate = (dateString) => {
    if (!dateString) return new Date();
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
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

  const formatDateShort = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = parseLocalDate(dateString);
      return date.toLocaleDateString('es-EC', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
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
// 2. EXTRACCIÓN Y PREPARACIÓN DE DATOS
// ============================================================

const extraerDatos = () => {
  const usuario = factura?.usuario_afiliado?.usuario_sistema;
  const afiliado = factura?.usuario_afiliado;

  // 👉 PAGO REAL (primer pago)
  const pagoActual = factura?.pagos?.[0];

  // ✅ CONVERTIR TODOS LOS VALORES A STRING
  const nombreCliente = String(usuario?.nombre_completo || 'N/A');
  const cedulaCliente = String(usuario?.cedula || 'N/A');
  const direccionCliente = String(usuario?.direccion || 'N/A');
  const telefonoCliente = String(usuario?.telefono || 'N/A');
  const codigoAfiliado = String(afiliado?.cod_usuario_afi || 'N/A');
  const numMedidor = String(afiliado?.num_medidor || 'N/A');
  const nombreSector = String(afiliado?.sector?.nombre_sector || 'N/A');

  const nombreCajero = String(pagoActual?.cajero || 'N/A');

  const detalles = factura?.detalles || [];
  const detallesConsumo = detalles.filter(d => d.tipo_detalle === 'consumo');
  const detallesServicios = detalles.filter(d => d.tipo_detalle === 'servicio');
  const detallesMultas = detalles.filter(d => d.tipo_detalle === 'multa');

  // 🆕 Detectar servicios específicos
  const serviciosCambioMedidor = detallesServicios.filter(d => 
    d.descripcion?.toLowerCase().includes('cambio') && 
    d.descripcion?.toLowerCase().includes('medidor')
  );
  
  const otrosServicios = detallesServicios.filter(d => 
    !(d.descripcion?.toLowerCase().includes('cambio') && 
      d.descripcion?.toLowerCase().includes('medidor'))
  );

  // Calcular totales
  const totalConsumo = detallesConsumo.reduce((sum, d) => 
    sum + parseFloat(d.subtotal_detalle || 0), 0
  );
  
  const totalCambioMedidor = serviciosCambioMedidor.reduce((sum, d) => 
    sum + parseFloat(d.subtotal_detalle || 0), 0
  );
  
  const totalOtrosServicios = otrosServicios.reduce((sum, d) => 
    sum + parseFloat(d.subtotal_detalle || 0), 0
  );
  
  const totalServicios = detallesServicios.reduce((sum, d) => 
    sum + parseFloat(d.subtotal_detalle || 0), 0
  );
  
  const totalMultas = detallesMultas.reduce((sum, d) => 
    sum + parseFloat(d.subtotal_detalle || 0), 0
  );

  const totalMora = parseFloat(pago?.mora_aplicada || 0);
  const saldoPendiente = parseFloat(factura?.saldo_pendiente || 0);

  return {
    // Cliente
    nombreCliente,
    cedulaCliente,
    direccionCliente,
    telefonoCliente,
    
    // Afiliado
    codigoAfiliado,
    numMedidor,
    nombreSector,
    
    // Cajero
    nombreCajero,
    
    // Detalles
    detallesConsumo,
    detallesServicios,
    detallesMultas,
    serviciosCambioMedidor,
    otrosServicios,
    
    // Totales
    totalConsumo,
    totalServicios,
    totalCambioMedidor,
    totalOtrosServicios,
    totalMultas,
    totalMora,
    saldoPendiente
  };
};

const datos = extraerDatos();


  // ============================================================
  // 3. GENERAR PDF A4 (COMPROBANTE COMPLETO)
  // ============================================================
  
  const generatePDF = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
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

      
      y += 5;
      // ===== TÍTULO =====
      y += 10;
      doc.setFontSize(14);
      doc.setTextColor(31, 41, 55);
      doc.setFont('helvetica', 'bold');
      doc.text('COMPROBANTE DE PAGO', pageWidth / 2, y, { align: 'center' });

      // Número debajo del título
      y += 6;
      doc.setFontSize(10);
      doc.setTextColor(107, 114, 128);
      doc.setFont('helvetica', 'normal');
      doc.text(`No. ${String(pago.id_pago).padStart(6, '0')}`, pageWidth / 2, y, { align: 'center' });
      y += 12;

      // ===== DATOS DEL CLIENTE =====
      // Fila 1
      doc.text(`Nombre Afiliado:`, margin, y);
      doc.setFont('helvetica', 'bold');
      doc.text(String(datos.nombreCliente), margin + 30, y);  // ✅
      doc.setFont('helvetica', 'normal');
      doc.text(`Cédula:`, pageWidth / 2, y);
      doc.setFont('helvetica', 'bold');
      doc.text(String(datos.cedulaCliente), pageWidth / 2 + 20, y);  // ✅
      y += 5;
      doc.setFont('helvetica', 'normal');

      // Fila 2
      doc.text(`Código Afiliado:`, margin, y);
      doc.setFont('helvetica', 'bold');
      doc.text(String(datos.codigoAfiliado), margin + 30, y);  // ✅
      doc.setFont('helvetica', 'normal');
      doc.text(`No. Medidor:`, pageWidth / 2, y);
      doc.setFont('helvetica', 'bold');
      doc.text(String(datos.numMedidor), pageWidth / 2 + 25, y);  // ✅
      y += 5;
      doc.setFont('helvetica', 'normal');

      // Fila 3
      doc.text(`Dirección:`, margin, y);
      doc.text(String(datos.direccionCliente), margin + 20, y);  // ✅
      y += 5;

      // Fila 4 - Teléfono / Sector
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');

      doc.text('Teléfono:', margin, y);
      doc.setFont('helvetica', 'normal');
      doc.text(String(datos.telefonoCliente || 'N/A'), margin + 25, y);

      doc.setFont('helvetica', 'normal');
      doc.text('Sector:', pageWidth / 2, y);
      doc.setFont('helvetica', 'normal');
      doc.text(String(datos.nombreSector || 'N/A'), pageWidth / 2 + 22, y);

      // ⬇️ MUY IMPORTANTE
      y += 8;
      doc.setFont('helvetica', 'normal');


      // ===== DATOS DE LA FACTURA =====
      // Fila 1
      doc.text(`Factura No.:`, margin, y);
      doc.setFont('helvetica', 'bold');
      doc.text(String(factura?.num_factura || 'N/A'), margin + 25, y);  // ✅
      doc.setFont('helvetica', 'normal');
      doc.text(`Periodo:`, pageWidth / 2, y);
      doc.setFont('helvetica', 'bold');
      doc.text(String(factura?.periodo || 'N/A'), pageWidth / 2 + 20, y);  // ✅
      y += 5;
      doc.setFont('helvetica', 'normal');

      // Fila 2
      doc.text(`Fecha Emisión:`, margin, y);
      doc.text(formatDateShort(factura?.fecha_emision), margin + 30, y);
      doc.text(`Estado:`, pageWidth / 2, y);

      // Estado dinámico
      const estadoFinal = datos.saldoPendiente <= 0.01 
        ? 'PAGADA' 
        : factura?.estado_factura?.toUpperCase() || 'PENDIENTE';
        
      if (estadoFinal === 'PAGADA') {
        doc.setTextColor(22, 163, 74);
      } else if (estadoFinal === 'VENCIDA') {
        doc.setTextColor(239, 68, 68);
      }
      doc.setFont('helvetica', 'bold');
      doc.text(estadoFinal, pageWidth / 2 + 15, y);
      doc.setTextColor(31, 41, 55);
      y += 5;
      doc.setFont('helvetica', 'normal');

      // Fila 3
      doc.text(`Consumo:`, margin, y);
      doc.text(`${String(factura?.consumo_m3 || 0)} m³`, margin + 20, y);  // ✅
      doc.text(`Total Factura:`, pageWidth / 2, y);
      doc.setFont('helvetica', 'bold');
      doc.text(formatCurrency(factura?.total), pageWidth / 2 + 25, y);


      // ===== CONCEPTOS =====
      y += 12;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(55, 65, 81);
      doc.text('CONCEPTOS', margin, y);
      
      y += 7;
      doc.setFontSize(8);

      // Consumos
      if (datos.detallesConsumo.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(22, 163, 74);
        doc.text('Consumo de Agua', margin, y);
        y += 5;
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(31, 41, 55);
        
        datos.detallesConsumo.forEach(detalle => {
          const descripcion = doc.splitTextToSize(
            `• ${detalle.descripcion}`, 
            pageWidth - margin * 2 - 35
          );
          doc.text(descripcion, margin + 3, y);
          doc.text(
            formatCurrency(detalle.subtotal_detalle), 
            pageWidth - margin, 
            y, 
            { align: 'right' }
          );
          y += descripcion.length * 4;
        });
        
        y += 2;
        doc.setFont('helvetica', 'bold');
        doc.text('Subtotal Consumo:', pageWidth - 55, y);
        doc.text(formatCurrency(datos.totalConsumo), pageWidth - margin, y, { align: 'right' });
        y += 6;
      }

      // Servicios
      if (datos.detallesServicios.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(59, 130, 246);
        doc.text('Servicios Adicionales', margin, y);
        y += 5;
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(31, 41, 55);
        
        datos.detallesServicios.forEach(detalle => {
          const descripcion = doc.splitTextToSize(
            `• ${detalle.descripcion}`, 
            pageWidth - margin * 2 - 35
          );
          doc.text(descripcion, margin + 3, y);
          doc.text(
            formatCurrency(detalle.subtotal_detalle), 
            pageWidth - margin, 
            y, 
            { align: 'right' }
          );
          y += descripcion.length * 4;
        });
        
        y += 2;
        doc.setFont('helvetica', 'bold');
        doc.text('Subtotal Servicios:', pageWidth - 55, y);
        doc.text(formatCurrency(datos.totalServicios), pageWidth - margin, y, { align: 'right' });
        y += 6;
      }

      // Multas
      if (datos.detallesMultas.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(239, 68, 68);
        doc.text('Multas', margin, y);
        y += 5;
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(31, 41, 55);
        
        datos.detallesMultas.forEach(detalle => {
          const descripcion = doc.splitTextToSize(
            `• ${detalle.descripcion}`, 
            pageWidth - margin * 2 - 35
          );
          doc.text(descripcion, margin + 3, y);
          doc.text(
            formatCurrency(detalle.subtotal_detalle), 
            pageWidth - margin, 
            y, 
            { align: 'right' }
          );
          y += descripcion.length * 4;
        });
        
        y += 2;
        doc.setFont('helvetica', 'bold');
        doc.text('Subtotal Multas:', pageWidth - 55, y);
        doc.text(formatCurrency(datos.totalMultas), pageWidth - margin, y, { align: 'right' });
        y += 6;
      }

      // Mora
      if (datos.totalMora > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(251, 146, 60);
        doc.text('Mora por Pago Tardío', margin, y);
        doc.text(formatCurrency(datos.totalMora), pageWidth - margin, y, { align: 'right' });
        y += 6;
      }

      // ===== RESUMEN FINAL =====
      y += 3;
      doc.setDrawColor(209, 213, 219);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(107, 114, 128);

      doc.text('Subtotal:', pageWidth - 55, y);
      doc.text(formatCurrency(factura?.subtotal || 0), pageWidth - margin, y, { align: 'right' });
      y += 5;

      if (factura?.descuento && parseFloat(factura.descuento) > 0) {
        doc.setTextColor(22, 163, 74);
        doc.text('Descuento:', pageWidth - 55, y);
        doc.text(`-${formatCurrency(factura.descuento)}`, pageWidth - margin, y, { align: 'right' });
        y += 5;
        doc.setTextColor(107, 114, 128);
      }

      const porcentajeIVA = factura?.impuesto && factura?.subtotal
        ? ((factura.impuesto / factura.subtotal) * 100).toFixed(1)
        : '0';

      doc.text(`IVA (${porcentajeIVA}%):`, pageWidth - 55, y);
      doc.text(formatCurrency(factura?.impuesto || 0), pageWidth - margin, y, { align: 'right' });
      y += 8;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(31, 41, 55);
      doc.text('TOTAL FACTURA:', pageWidth - 75, y);
      doc.text(formatCurrency(factura?.total || 0), pageWidth - margin, y, { align: 'right' });
      y += 5;

      // ===== DETALLES DEL PAGO =====
      doc.text(`Fecha de Pago:`, margin, y);
      doc.text(formatDate(pago?.fecha_pago), margin + 30, y);
      y += 5;

      doc.text(`Método de Pago:`, margin, y);
      doc.setFont('helvetica', 'bold');
      doc.text(String(pago?.metodo_pago || 'N/A'), margin + 35, y);  // ✅
      y += 5;

      doc.setFont('helvetica', 'normal');
      doc.text(`Recibido por:`, margin, y);
      doc.text(String(datos.nombreCajero), margin + 28, y);  // ✅


      // ===== MONTO PAGADO (DESTACADO) =====
      y += 12;
      doc.setFillColor(34, 197, 94);
      doc.roundedRect(margin, y - 5, pageWidth - (margin * 2), 18, 3, 3, 'F');
      
      y += 4;
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('MONTO PAGADO:', margin + 5, y);
      
      doc.setFontSize(18);
      doc.text(formatCurrency(pago?.monto_pago), pageWidth - margin - 5, y, { align: 'right' });

      // Saldo pendiente
      y += 14;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      
      if (datos.saldoPendiente <= 0.01) {
        doc.setTextColor(22, 163, 74);
        doc.text('FACTURA PAGADA COMPLETAMENTE', margin, y);
      } else {
        doc.setTextColor(239, 68, 68);
        doc.text(`Saldo Pendiente: ${formatCurrency(datos.saldoPendiente)}`, margin, y);
      }

      // ===== OBSERVACIONES =====
      if (pago?.observaciones && pago.observaciones.trim() !== '') {
        y += 12;
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
      y += 25;
      if (y > pageHeight - 50) {
        doc.addPage();
        y = 20;
      }

      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      doc.line(margin + 10, y, margin + 70, y);
      doc.line(pageWidth - margin - 70, y, pageWidth - margin - 10, y);
      
      y += 4;
      doc.setFontSize(8);
      doc.setTextColor(107, 114, 128);
      doc.setFont('helvetica', 'normal');
      doc.text('Firma del Cajero', margin + 40, y, { align: 'center' });
      doc.text('Firma del Cliente', pageWidth - margin - 40, y, { align: 'center' });

      // ===== PIE DE PÁGINA =====
      y += 15;
      doc.setFontSize(7);
      doc.setTextColor(156, 163, 175);
      doc.text('Este comprobante certifica el pago realizado', pageWidth / 2, y, { align: 'center' });
      
      y += 4;
      doc.text(`Generado el: ${new Date().toLocaleString('es-EC')}`, pageWidth / 2, y, { align: 'center' });

      // ===== VALIDAR TAMAÑO =====
      const pdfOutput = doc.output('datauristring');
      const pdfBase64 = pdfOutput.split(',')[1];
      const sizeInBytes = (pdfBase64.length * 3) / 4;
      const sizeInMB = sizeInBytes / (1024 * 1024);

      console.log(`📄 PDF generado: ${sizeInMB.toFixed(2)} MB`);

      if (sizeInMB > 5) {
        throw new Error(
          `El PDF generado (${sizeInMB.toFixed(2)} MB) excede el límite de 5 MB`
        );
      }

      setIsGenerating(false);
      return { pdf: doc, base64: pdfBase64, size: sizeInMB };

    } catch (err) {
      console.error('❌ Error al generar PDF:', err);
      setError(err.message || 'Error desconocido al generar PDF');
      setIsGenerating(false);
      throw err;
    }
  };

  // ============================================================
  // 4. ACCIONES (Descargar, Imprimir, Guardar)
  // ============================================================

  const handleDownload = async () => {
    try {
      setError(null);
      setSuccessMessage('');
      
      const { pdf } = await generatePDF();
      const fileName = `Comprobante_${String(pago.id_pago).padStart(6, '0')}_${factura.num_factura}.pdf`;
      pdf.save(fileName);
      
      setSuccessMessage('✅ PDF descargado exitosamente');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Error al descargar PDF:', err);
    }
  };

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

  const handlePrintThermal = () => {
    try {
      setError(null);
      printThermalTicket(pago, factura, datos);
      setSuccessMessage('✅ Enviando a impresora térmica...');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Error al imprimir ticket:', err);
      setError('Error al imprimir ticket térmico');
    }
  };

  // ============================================================
  // 5. VALIDACIONES
  // ============================================================

  if (!pago || !factura) {
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
              No se proporcionaron los datos del pago o factura.
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
            Comprobante de Pago
          </h3>
          <button className="modal-close" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CUERPO */}
        <div className="modal-body receipt-body">
          {/* ENCABEZADO */}
          <div className="receipt-header">
            <h2 className="receipt-company-name">JUNTA DE AGUA POTABLE</h2>
            <h3 className="receipt-company-location">SANJAPAMBA</h3>
            <p className="receipt-company-info">Sanjapamba, Chimborazo, Ecuador</p>
            <p className="receipt-company-info">Teléfono: (593) 3-XXX-XXXX</p>
          </div>

          <div className="receipt-divider"></div>

          {/* TÍTULO */}
          <div className="receipt-title-section">
            <h4 className="receipt-title">COMPROBANTE DE PAGO</h4>
            <p className="receipt-number">No. {String(pago.id_pago).padStart(6, '0')}</p>
          </div>

          {/* DATOS DEL CLIENTE */}
          <div className="receipt-section">
            <div className="receipt-section-header">
              <h5>DATOS DEL CLIENTE</h5>
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

          {/* DATOS DE LA FACTURA */}
          <div className="receipt-section">
            <div className="receipt-section-header">
              <h5>DATOS DE LA FACTURA</h5>
            </div>
            <div className="receipt-info-grid">
              <div className="receipt-info-item">
                <span className="receipt-label">Factura No.:</span>
                <span className="receipt-value">{factura.num_factura}</span>
              </div>
              <div className="receipt-info-item">
                <span className="receipt-label">Periodo:</span>
                <span className="receipt-value">{factura.periodo}</span>
              </div>
              <div className="receipt-info-item">
                <span className="receipt-label">Fecha Emisión:</span>
                <span className="receipt-value">{formatDateShort(factura.fecha_emision)}</span>
              </div>
              <div className="receipt-info-item">
                <span className="receipt-label">Estado:</span>
                <span className={`receipt-status receipt-status-${factura.estado_factura}`}>
                  {factura.estado_factura?.toUpperCase()}
                </span>
              </div>
              <div className="receipt-info-item">
                <span className="receipt-label">Consumo:</span>
                <span className="receipt-value">{factura.consumo_m3 || 0} m³</span>
              </div>
              <div className="receipt-info-item">
                <span className="receipt-label">Total Factura:</span>
                <span className="receipt-value">{formatCurrency(factura.total)}</span>
              </div>
            </div>
          </div>

          {/* CONCEPTOS */}
          <div className="receipt-section">
            <div className="receipt-section-header">
              <h5>CONCEPTOS</h5>
            </div>

            {/* Consumo */}
            {datos.detallesConsumo.length > 0 && (
              <div className="receipt-concept-group">
                <div className="receipt-concept-header">
                  <span>💧 Consumo de Agua</span>
                  <span className="receipt-concept-total">
                    {formatCurrency(datos.totalConsumo)}
                  </span>
                </div>
                {datos.detallesConsumo.map((detalle, idx) => (
                  <div key={idx} className="receipt-concept-item">
                    <span className="receipt-concept-desc">{detalle.descripcion}</span>
                    <span className="receipt-concept-amount">
                      {formatCurrency(detalle.subtotal_detalle)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Servicios */}
            {datos.detallesServicios.length > 0 && (
              <div className="receipt-concept-group">
                <div className="receipt-concept-header">
                  <span>🔧 Servicios Adicionales</span>
                  <span className="receipt-concept-total">
                    {formatCurrency(datos.totalServicios)}
                  </span>
                </div>
                {datos.detallesServicios.map((detalle, idx) => (
                  <div key={idx} className="receipt-concept-item">
                    <span className="receipt-concept-desc">{detalle.descripcion}</span>
                    <span className="receipt-concept-amount">
                      {formatCurrency(detalle.subtotal_detalle)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Multas */}
            {datos.detallesMultas.length > 0 && (
              <div className="receipt-concept-group receipt-concept-danger">
                <div className="receipt-concept-header">
                  <span>⚠️ Multas</span>
                  <span className="receipt-concept-total">
                    {formatCurrency(datos.totalMultas)}
                  </span>
                </div>
                {datos.detallesMultas.map((detalle, idx) => (
                  <div key={idx} className="receipt-concept-item">
                    <span className="receipt-concept-desc">{detalle.descripcion}</span>
                    <span className="receipt-concept-amount">
                      {formatCurrency(detalle.subtotal_detalle)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Mora */}
            {datos.totalMora > 0 && (
              <div className="receipt-concept-group receipt-concept-warning">
                <div className="receipt-concept-header">
                  <span>⏰ Mora por Pago Tardío</span>
                  <span className="receipt-concept-total">
                    {formatCurrency(datos.totalMora)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* RESUMEN */}
          <div className="receipt-section">
            <div className="receipt-summary">
              <div className="receipt-summary-row">
                <span>Subtotal</span>
                <span>{formatCurrency(factura.subtotal || 0)}</span>
              </div>
              
              {factura.descuento && parseFloat(factura.descuento) > 0 && (
                <div className="receipt-summary-row receipt-summary-discount">
                  <span>Descuento</span>
                  <span>-{formatCurrency(factura.descuento)}</span>
                </div>
              )}
              
              <div className="receipt-summary-row">
                <span>
                  IVA (
                  {factura.impuesto && factura.subtotal
                    ? ((factura.impuesto / factura.subtotal) * 100).toFixed(1)
                    : '0'}
                  %)
                </span>
                <span>{formatCurrency(factura.impuesto || 0)}</span>
              </div>
              
              <div className="receipt-summary-row receipt-summary-total">
                <span>TOTAL FACTURA</span>
                <span>{formatCurrency(factura.total || 0)}</span>
              </div>
            </div>
          </div>

          {/* DETALLES DEL PAGO */}
          <div className="receipt-section">
            <div className="receipt-info-grid">
              <div className="receipt-info-item">
                <span className="receipt-label">Fecha de Pago:</span>
                <span className="receipt-value">{formatDate(pago.fecha_pago)}</span>
              </div>
              <div className="receipt-info-item">
                <span className="receipt-label">Método de Pago:</span>
                <span className="receipt-value">{pago.metodo_pago}</span>
              </div>
              <div className="receipt-info-item">
                <span className="receipt-label">Recibido por:</span>
                <span className="receipt-value">{datos.nombreCajero}</span>
              </div>
            </div>
          </div>

          {/* MONTO PAGADO */}
          <div className="receipt-payment-amount">
            <span className="receipt-payment-label">MONTO PAGADO</span>
            <span className="receipt-payment-value">{formatCurrency(pago.monto_pago)}</span>
          </div>

          {/* SALDO */}
          {datos.saldoPendiente > 0 && (
            <div className="receipt-pending-balance">
              <span>Saldo Pendiente: {formatCurrency(datos.saldoPendiente)}</span>
            </div>
          )}

          {/* OBSERVACIONES */}
          {pago.observaciones && (
            <div className="receipt-observations">
              <strong>Observaciones:</strong> {pago.observaciones}
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

          {/* PIE */}
          <div className="receipt-footer">
            <p>Este comprobante certifica el pago realizado</p>
            <p>Generado el: {new Date().toLocaleString('es-EC')}</p>
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

        {/* ACCIONES */}
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            <X className="w-4 h-4" />
            Cerrar
          </button>

          <button
            className="btn-primary"
            onClick={handlePrintThermal}
            style={{ backgroundColor: '#10b981' }}
            title="Imprimir ticket en impresora térmica 58mm"
          >
            <Printer className="w-4 h-4" />
            Ticket 58mm
          </button>

          <button
            className="btn-primary"
            onClick={handlePrint}
            disabled={isGenerating}
          >
            <Printer className="w-4 h-4" />
            Imprimir A4
          </button>

          <button
            className="btn-primary"
            onClick={handleDownload}
            disabled={isGenerating}
          >
            <Download className="w-4 h-4" />
            Descargar PDF
          </button>

          {onSave && (
            <button
              className="btn-success"
              onClick={handleSaveToDatabase}
              disabled={isGenerating}
            >
              <CheckCircle className="w-4 h-4" />
              Guardar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// 7. FUNCIÓN PARA TICKET TÉRMICO 58mm
// ============================================================

export const printThermalTicket = (pago, factura, datos) => {
  const formatCurrency = (v) =>
    new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD',
    }).format(v || 0);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('es-EC', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 🆕 Extraer fecha de cambio de medidor si existe
  const extraerFechaCambio = (descripcion) => {
    if (!descripcion) return '';
    // Buscar fecha en formato DD/MM/YYYY o similar
    const match = descripcion.match(/(\d{2}\/\d{2}\/\d{4})/);
    return match ? ` (${match[1]})` : '';
  };

  const win = window.open('', 'PRINT', 'height=600,width=900');

  win.document.write(`
    <html>
    <head>
      <title>Comprobante de Pago</title>
      <meta charset="UTF-8">
      <style>
        @page {
          size: 58mm auto;
          margin: 0;
        }
        
        body {
          font-family: 'Courier New', monospace;
          font-size: 11px;
          width: 58mm;
          margin: 0;
          padding: 3mm;
          line-height: 1.3;
        }
        
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .line { border-top: 1px dashed #000; margin: 4px 0; }
        
        .row {
          display: flex;
          justify-content: space-between;
          margin: 2px 0;
        }
        
        .header {
          font-size: 13px;
          font-weight: bold;
          margin-bottom: 3px;
        }
        
        .subheader {
          font-size: 10px;
          margin-bottom: 2px;
        }
        
        .total-box {
          background: #000;
          color: #fff;
          padding: 4px;
          margin: 6px 0;
          text-align: center;
          font-weight: bold;
        }
        
        .small { font-size: 9px; }
        
        @media print {
          body { width: 58mm; }
        }
      </style>
    </head>
    <body>
      <!-- ENCABEZADO -->
      <div class="center">
        <div class="header">JUNTA DE AGUA POTABLE</div>
        <div class="subheader">SANJAPAMBA</div>
        <div class="small">Chimborazo, Ecuador</div>
      </div>

      <div class="line"></div>

      <!-- INFO DEL COMPROBANTE -->
      <div class="center">
        <div class="bold">COMPROBANTE DE PAGO</div>
        <div>No. ${String(pago.id_pago).padStart(6, '0')}</div>
        <div class="small">${formatDate(pago.fecha_pago)}</div>
      </div>

      <div class="line"></div>

      <!-- DATOS DEL CLIENTE -->
      <div>
        <div class="bold">AFILIADO:</div>
        <div>${datos.nombreCliente}</div>
        <div class="row">
          <span>Codigo:</span>
          <span>${datos.codigoAfiliado}</span>
        </div>
        <div class="row">
          <span>Medidor:</span>
          <span>${datos.numMedidor}</span>
        </div>
      </div>

      <div class="line"></div>

      <!-- FACTURA -->
      <div>
        <div class="row">
          <span>Factura:</span>
          <span>${factura.num_factura}</span>
        </div>
        <div class="row">
          <span>Periodo:</span>
          <span>${factura.periodo}</span>
        </div>
        <div class="row">
          <span>Consumo:</span>
          <span>${factura.consumo_m3 || 0} m³</span>
        </div>
      </div>

      <div class="line"></div>

      <!-- CONCEPTOS -->
      <div class="bold center">DETALLE</div>
      
      ${datos.totalConsumo > 0 ? `
        <div class="row">
          <span>Consumo Agua:</span>
          <span>${formatCurrency(datos.totalConsumo)}</span>
        </div>
      ` : ''}
      
      ${/* 🆕 CAMBIO DE MEDIDOR - Formato especial */''}
      ${datos.totalCambioMedidor > 0 ? `
        <div class="row">
          <span>Cambio Medidor${extraerFechaCambio(datos.serviciosCambioMedidor[0]?.descripcion)}:</span>
          <span>${formatCurrency(datos.totalCambioMedidor)}</span>
        </div>
      ` : ''}
      
      ${/* 🆕 OTROS SERVICIOS */''}
      ${datos.totalOtrosServicios > 0 ? `
        <div class="row">
          <span>Servicios:</span>
          <span>${formatCurrency(datos.totalOtrosServicios)}</span>
        </div>
      ` : ''}
      
      ${datos.totalMultas > 0 ? `
        <div class="row">
          <span>Multas:</span>
          <span>${formatCurrency(datos.totalMultas)}</span>
        </div>
      ` : ''}
      
      ${datos.totalMora > 0 ? `
        <div class="row">
          <span>Mora:</span>
          <span>${formatCurrency(datos.totalMora)}</span>
        </div>
      ` : ''}
      
      ${parseFloat(factura.impuesto || 0) > 0 ? `
        <div class="row">
          <span>IVA:</span>
          <span>${formatCurrency(factura.impuesto)}</span>
        </div>
      ` : ''}

      <div class="line"></div>

      <!-- TOTALES -->
      <div class="row bold">
        <span>TOTAL FACTURA:</span>
        <span>${formatCurrency(factura.total)}</span>
      </div>

      <div class="total-box">
        <div>PAGADO</div>
        <div style="font-size: 16px;">${formatCurrency(pago.monto_pago)}</div>
      </div>

      <div class="row">
        <span>Saldo Pendiente:</span>
        <span class="bold">${formatCurrency(datos.saldoPendiente)}</span>
      </div>

      <div class="line"></div>

      <!-- PAGO -->
      <div>
        <div class="row">
          <span>Metodo:</span>
          <span class="bold">${pago.metodo_pago}</span>
        </div>
        <div class="row small">
          <span>Cajero:</span>
          <span>${datos.nombreCajero}</span>
        </div>
      </div>

      ${pago.observaciones ? `
        <div class="line"></div>
        <div class="small">
          <div class="bold">Observaciones:</div>
          <div>${pago.observaciones}</div>
        </div>
      ` : ''}

      <div class="line"></div>

      <!-- PIE -->
      <div class="center small">
        <div>Gracias por su pago</div>
        <div style="margin-top: 4px;">
          Documento interno 
        </div>
      </div>

      <script>
        window.onload = function() {
          window.print();
          setTimeout(function() {
            window.close();
          }, 100);
        }
      </script>
    </body>
    </html>
  `);

  win.document.close();
};


// ============================================================
// 8. FUNCIÓN EXPORTABLE PARA GENERAR PDF
// ============================================================

export const generatePaymentPDF = async (pago, factura) => {
  // Funciones auxiliares locales
  const parseLocalDate = (dateString) => {
    if (!dateString) return new Date();
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
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

  const formatDateShort = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = parseLocalDate(dateString);
      return date.toLocaleDateString('es-EC', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
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

  // ✅ FUNCIÓN AUXILIAR PARA CONVERTIR TODO A STRING
  const toString = (value) => {
    if (value === null || value === undefined) return 'N/A';
    return String(value);
  };

  // Extraer datos
  const usuario = factura?.usuario_afiliado?.usuario_sistema;
  const afiliado = factura?.usuario_afiliado;
  const pagoActual = factura?.pagos?.[0];

  // ✅ CONVERTIR TODOS LOS VALORES A STRING
  const nombreCliente = toString(usuario?.nombre_completo || 'N/A');
  const cedulaCliente = toString(usuario?.cedula || 'N/A');
  const direccionCliente = toString(usuario?.direccion || 'N/A');
  const telefonoCliente = toString(usuario?.telefono || 'N/A');
  const codigoAfiliado = toString(afiliado?.cod_usuario_afi || 'N/A');
  const numMedidor = toString(afiliado?.num_medidor || 'N/A');
  const nombreSector = toString(afiliado?.sector?.nombre_sector || 'N/A');
  const nombreCajero = String(pagoActual?.cajero || 'N/A');

  const detalles = factura?.detalles || [];
  const detallesConsumo = detalles.filter(d => d.tipo_detalle === 'consumo');
  const detallesServicios = detalles.filter(d => d.tipo_detalle === 'servicio');
  const detallesMultas = detalles.filter(d => d.tipo_detalle === 'multa');

  const totalConsumo = detallesConsumo.reduce((sum, d) => sum + parseFloat(d.subtotal_detalle || 0), 0);
  const totalServicios = detallesServicios.reduce((sum, d) => sum + parseFloat(d.subtotal_detalle || 0), 0);
  const totalMultas = detallesMultas.reduce((sum, d) => sum + parseFloat(d.subtotal_detalle || 0), 0);
  const totalMora = parseFloat(pago?.mora_aplicada || 0);
  const saldoPendiente = parseFloat(factura?.saldo_pendiente || 0);

  // Generar PDF
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
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
  doc.text(`No. ${String(pago.id_pago).padStart(6, '0')}`, pageWidth / 2, y, { align: 'center' });

  // ===== DATOS DEL CLIENTE =====
  y += 12;
  doc.setFontSize(11);
  doc.setTextColor(55, 65, 81);
  doc.setFont('helvetica', 'bold');
  doc.text('DATOS DEL CLIENTE', margin, y);
  
  y += 7;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(31, 41, 55);
  
  doc.text('Cliente:', margin, y);
  doc.setFont('helvetica', 'bold');
  doc.text(nombreCliente, margin + 20, y);
  doc.setFont('helvetica', 'normal');
  doc.text('Cedula:', pageWidth / 2, y);
  doc.setFont('helvetica', 'bold');
  doc.text(cedulaCliente, pageWidth / 2 + 20, y);
  
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.text('Codigo Afiliado:', margin, y);
  doc.setFont('helvetica', 'bold');
  doc.text(codigoAfiliado, margin + 30, y);
  doc.setFont('helvetica', 'normal');
  doc.text('No. Medidor:', pageWidth / 2, y);
  doc.setFont('helvetica', 'bold');
  doc.text(numMedidor, pageWidth / 2 + 25, y);
  
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.text('Direccion:', margin, y);
  doc.text(direccionCliente, margin + 20, y);
  
  y += 5;
  doc.text('Telefono:', margin, y);
  doc.text(telefonoCliente, margin + 20, y);
  doc.text('Sector:', pageWidth / 2, y);
  doc.text(nombreSector, pageWidth / 2 + 15, y);

  // ===== DATOS DE LA FACTURA =====
  y += 12;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(55, 65, 81);
  doc.text('DATOS DE LA FACTURA', margin, y);
  
  y += 7;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(31, 41, 55);
  
  doc.text('Factura No.:', margin, y);
  doc.setFont('helvetica', 'bold');
  doc.text(toString(factura?.num_factura || 'N/A'), margin + 25, y);
  doc.setFont('helvetica', 'normal');
  doc.text('Periodo:', pageWidth / 2, y);
  doc.setFont('helvetica', 'bold');
  doc.text(toString(factura?.periodo || 'N/A'), pageWidth / 2 + 20, y);
  
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.text('Fecha Emision:', margin, y);
  doc.text(formatDateShort(factura?.fecha_emision), margin + 30, y);
  doc.text('Estado:', pageWidth / 2, y);
  
  const estadoFinal = saldoPendiente <= 0.01 ? 'PAGADA' : 
                      toString(factura?.estado_factura || 'PENDIENTE').toUpperCase();
  
  if (estadoFinal === 'PAGADA') {
    doc.setTextColor(22, 163, 74);
  } else if (estadoFinal === 'VENCIDA') {
    doc.setTextColor(239, 68, 68);
  }
  doc.setFont('helvetica', 'bold');
  doc.text(estadoFinal, pageWidth / 2 + 15, y);
  doc.setTextColor(31, 41, 55);
  
  y += 5;
  doc.setFont('helvetica', 'normal');
doc.text('Consumo:', margin, y);
doc.text(toString(factura?.consumo_m3 || 0) + ' m3', margin + 20, y);

  doc.text('Total Factura:', pageWidth / 2, y);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(factura?.total), pageWidth / 2 + 25, y);

  // ===== CONCEPTOS =====
  y += 12;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(55, 65, 81);
  doc.text('CONCEPTOS', margin, y);
  
  y += 7;
  doc.setFontSize(8);

  // Consumos
  if (detallesConsumo.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 163, 74);
    doc.text('Consumo de Agua', margin, y);
    y += 5;
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(31, 41, 55);
    
    detallesConsumo.forEach(detalle => {
      const descripcion = doc.splitTextToSize(
        toString(detalle.descripcion), 
        pageWidth - margin * 2 - 35
      );
      doc.text(descripcion, margin + 3, y);
      doc.text(formatCurrency(detalle.subtotal_detalle), pageWidth - margin, y, { align: 'right' });
      y += descripcion.length * 4;
    });
    
    y += 2;
    doc.setFont('helvetica', 'bold');
    doc.text('Subtotal Consumo:', pageWidth - 55, y);
    doc.text(formatCurrency(totalConsumo), pageWidth - margin, y, { align: 'right' });
    y += 6;
  }

  // Servicios
  if (detallesServicios.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(59, 130, 246);
    doc.text('Servicios Adicionales', margin, y);
    y += 5;
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(31, 41, 55);
    
    detallesServicios.forEach(detalle => {
      const descripcion = doc.splitTextToSize(
        toString(detalle.descripcion), 
        pageWidth - margin * 2 - 35
      );
      doc.text(descripcion, margin + 3, y);
      doc.text(formatCurrency(detalle.subtotal_detalle), pageWidth - margin, y, { align: 'right' });
      y += descripcion.length * 4;
    });
    
    y += 2;
    doc.setFont('helvetica', 'bold');
    doc.text('Subtotal Servicios:', pageWidth - 55, y);
    doc.text(formatCurrency(totalServicios), pageWidth - margin, y, { align: 'right' });
    y += 6;
  }

  // Multas
  if (detallesMultas.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(239, 68, 68);
    doc.text('Multas', margin, y);
    y += 5;
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(31, 41, 55);
    
    detallesMultas.forEach(detalle => {
      const descripcion = doc.splitTextToSize(
        toString(detalle.descripcion), 
        pageWidth - margin * 2 - 35
      );
      doc.text(descripcion, margin + 3, y);
      doc.text(formatCurrency(detalle.subtotal_detalle), pageWidth - margin, y, { align: 'right' });
      y += descripcion.length * 4;
    });
    
    y += 2;
    doc.setFont('helvetica', 'bold');
    doc.text('Subtotal Multas:', pageWidth - 55, y);
    doc.text(formatCurrency(totalMultas), pageWidth - margin, y, { align: 'right' });
    y += 6;
  }

  // Mora
  if (totalMora > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(251, 146, 60);
    doc.text('Mora por Pago Tardio', margin, y);
    doc.text(formatCurrency(totalMora), pageWidth - margin, y, { align: 'right' });
    y += 6;
  }

// ===== RESUMEN FINAL =====
y += 3;
doc.setDrawColor(209, 213, 219);
doc.line(margin, y, pageWidth - margin, y);
y += 6;

doc.setFontSize(9);
doc.setFont('helvetica', 'normal');
doc.setTextColor(107, 114, 128);

doc.text('Subtotal:', pageWidth - 55, y);
doc.text(toString(formatCurrency(factura?.subtotal || 0)), pageWidth - margin, y, { align: 'right' });
y += 5;

if (factura?.descuento && parseFloat(factura.descuento) > 0) {
  doc.setTextColor(22, 163, 74);
  doc.text('Descuento:', pageWidth - 55, y);
  doc.text('-' + toString(formatCurrency(factura.descuento)), pageWidth - margin, y, { align: 'right' });
  y += 5;
  doc.setTextColor(107, 114, 128);
}

const porcentajeIVANum = factura?.impuesto && factura?.subtotal
  ? ((factura.impuesto / factura.subtotal) * 100).toFixed(1)
  : 0;
const porcentajeIVA = toString(porcentajeIVANum);

doc.text('IVA (' + porcentajeIVA + '%):', pageWidth - 55, y);
doc.text(toString(formatCurrency(factura?.impuesto || 0)), pageWidth - margin, y, { align: 'right' });
y += 8;

doc.setFontSize(11);
doc.setFont('helvetica', 'bold');
doc.setTextColor(31, 41, 55);
doc.text('TOTAL FACTURA:', pageWidth - 75, y);
doc.text(toString(formatCurrency(factura?.total || 0)), pageWidth - margin, y, { align: 'right' });


  // ===== DETALLES DEL PAGO =====
  y += 15;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(55, 65, 81);
  doc.text('DETALLES DEL PAGO', margin, y);
  
  y += 7;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(31, 41, 55);
  
  doc.text('Fecha de Pago:', margin, y);
  doc.text(formatDate(pago?.fecha_pago), margin + 30, y);
  
  y += 5;
  doc.text('Metodo de Pago:', margin, y);
  doc.setFont('helvetica', 'bold');
  doc.text(toString(pago?.metodo_pago || 'N/A'), margin + 35, y);
  
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.text('Recibido por:', margin, y);
  doc.text(nombreCajero, margin + 28, y);

  // ===== MONTO PAGADO =====
  y += 12;
  doc.setFillColor(34, 197, 94);
  doc.roundedRect(margin, y - 5, pageWidth - (margin * 2), 18, 3, 3, 'F');
  
  y += 4;
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('MONTO PAGADO:', margin + 5, y);
  
  doc.setFontSize(18);
  doc.text(formatCurrency(pago?.monto_pago), pageWidth - margin - 5, y, { align: 'right' });

  // Saldo
  y += 12;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  
  if (saldoPendiente <= 0.01) {
    doc.setTextColor(22, 163, 74);
    doc.text('FACTURA PAGADA COMPLETAMENTE', margin, y);
  } else {
    doc.setTextColor(239, 68, 68);
    doc.text(`Saldo Pendiente: ${formatCurrency(saldoPendiente)}`, margin, y);
  }

  // ===== OBSERVACIONES =====
  if (pago?.observaciones && pago.observaciones.trim() !== '') {
    y += 12;
    doc.setFillColor(254, 243, 199);
    const obsHeight = 12;
    doc.roundedRect(margin, y - 3, pageWidth - (margin * 2), obsHeight, 2, 2, 'F');
    
    y += 3;
    doc.setTextColor(120, 53, 15);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    
    const obsTexto = `Observaciones: ${toString(pago.observaciones)}`;
    const obsLineas = doc.splitTextToSize(obsTexto, pageWidth - (margin * 2) - 10);
    doc.text(obsLineas, margin + 5, y);
    y += obsLineas.length * 4;
  }

  // ===== FIRMAS =====
  y += 25;
  if (y > pageHeight - 50) {
    doc.addPage();
    y = 20;
  }

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(margin + 10, y, margin + 70, y);
  doc.line(pageWidth - margin - 70, y, pageWidth - margin - 10, y);
  
  y += 4;
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.setFont('helvetica', 'normal');
  doc.text('Firma del Cajero', margin + 40, y, { align: 'center' });
  doc.text('Firma del Cliente', pageWidth - margin - 40, y, { align: 'center' });

  // ===== PIE =====
  y += 15;
  doc.setFontSize(7);
  doc.setTextColor(156, 163, 175);
  doc.text('Este comprobante certifica el pago realizado', pageWidth / 2, y, { align: 'center' });
  
  y += 4;
  doc.text(`Generado el: ${new Date().toLocaleString('es-EC')}`, pageWidth / 2, y, { align: 'center' });

  // Convertir a File
  const pdfBlob = doc.output('blob');
  const pdfFile = new File(
    [pdfBlob], 
    `Comprobante_${String(pago.id_pago).padStart(6, '0')}.pdf`,
    { type: 'application/pdf' }
  );
  
  return pdfFile;
};

// ============================================================
// GENERAR PDF PARA PAGO MÚLTIPLE
// ============================================================
export const generateMultiplePaymentPDF = async (pagoMultiple, facturas, afiliado) => {
  const { jsPDF } = window.jspdf || require('jspdf');
  
  // Funciones auxiliares
  const formatCurrency = (value) => {
    const numValue = parseFloat(value) || 0;
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(numValue);
  };

  const formatDateShort = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-EC', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return 'N/A';
    }
  };

  const toString = (value) => {
    if (value === null || value === undefined) return 'N/A';
    return String(value);
  };

  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let y = 20;

    // ========================================
    // ENCABEZADO
    // ========================================
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
    doc.text('Teléfono: 593 3-XXX-XXXX', pageWidth / 2, y, { align: 'center' });

    // Línea divisoria
    y += 6;
    doc.setDrawColor(209, 213, 219);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);

    // ========================================
    // TÍTULO - COMPROBANTE MÚLTIPLE
    // ========================================
    y += 10;
    doc.setFontSize(16);
    doc.setTextColor(31, 41, 55);
    doc.setFont('helvetica', 'bold');
    doc.text('COMPROBANTE DE PAGO MÚLTIPLE', pageWidth / 2, y, { align: 'center' });

    y += 6;
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.setFont('helvetica', 'normal');
    doc.text(`No. ${String(pagoMultiple.id_pago).padStart(6, '0')}`, pageWidth / 2, y, { align: 'center' });

    y += 4;
    doc.setFontSize(9);
    doc.setTextColor(59, 130, 246);
    doc.setFont('helvetica', 'bold');
    doc.text(`${facturas.length} FACTURAS PAGADAS`, pageWidth / 2, y, { align: 'center' });

    // ========================================
    // DATOS DEL AFILIADO
    // ========================================
    y += 12;
    doc.setFontSize(11);
    doc.setTextColor(55, 65, 81);
    doc.setFont('helvetica', 'bold');
    doc.text('DATOS DEL AFILIADO', margin, y);

    y += 7;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(31, 41, 55);

    const nombreCliente = toString(afiliado?.usuario_sistema?.nombre_completo);
    const cedulaCliente = toString(afiliado?.usuario_sistema?.cedula);
    const codigoAfiliado = toString(afiliado?.cod_usuario_afi);
    const numMedidor = toString(afiliado?.num_medidor);
    const direccion = toString(afiliado?.usuario_sistema?.direccion);

    doc.text('Cliente:', margin, y);
    doc.setFont('helvetica', 'bold');
    doc.text(nombreCliente, margin + 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text('Cédula:', pageWidth / 2, y);
    doc.setFont('helvetica', 'bold');
    doc.text(cedulaCliente, pageWidth / 2 + 20, y);

    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.text('Código Afiliado:', margin, y);
    doc.setFont('helvetica', 'bold');
    doc.text(codigoAfiliado, margin + 30, y);
    doc.setFont('helvetica', 'normal');
    doc.text('No. Medidor:', pageWidth / 2, y);
    doc.setFont('helvetica', 'bold');
    doc.text(numMedidor, pageWidth / 2 + 25, y);

    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.text('Dirección:', margin, y);
    doc.text(direccion, margin + 20, y);

    // ========================================
    // TABLA DE FACTURAS PAGADAS
    // ========================================
    y += 12;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(55, 65, 81);
    doc.text('DETALLE DE FACTURAS PAGADAS', margin, y);

    y += 7;

    // Encabezados de tabla
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(59, 130, 246);
    doc.setTextColor(255, 255, 255);
    doc.roundedRect(margin, y - 4, pageWidth - margin * 2, 8, 2, 2, 'F');

    doc.text('#', margin + 3, y);
    doc.text('Factura', margin + 10, y);
    doc.text('Periodo', margin + 35, y);
    doc.text('F. Emisión', margin + 60, y);
    doc.text('Consumo', margin + 85, y);
    doc.text('Mora', margin + 105, y);
    doc.text('Total', pageWidth - margin - 20, y, { align: 'right' });

    y += 6;

    // Filas de facturas
    let totalGeneral = 0;
    let totalMoraGeneral = 0;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(31, 41, 55);

    facturas.forEach((factura, idx) => {
      const totalFactura = parseFloat(factura.saldo_pendiente || factura.total_con_mora || 0);
      const moraFactura = parseFloat(factura.mora_monto || 0);
      totalGeneral += totalFactura;
      totalMoraGeneral += moraFactura;

      // Alternar color de fila
      if (idx % 2 === 0) {
        doc.setFillColor(249, 250, 251);
        doc.rect(margin, y - 4, pageWidth - margin * 2, 6, 'F');
      }

      doc.text(String(idx + 1), margin + 3, y);
      doc.text(toString(factura.num_factura), margin + 10, y);
      doc.text(toString(factura.periodo), margin + 35, y);
      doc.text(formatDateShort(factura.fecha_emision), margin + 60, y);
      doc.text(`${factura.consumo_m3 || 0} m³`, margin + 85, y);
      doc.text(moraFactura > 0 ? formatCurrency(moraFactura) : '-', margin + 105, y);
      doc.text(formatCurrency(totalFactura), pageWidth - margin - 3, y, { align: 'right' });

      y += 6;

      // Nueva página si es necesario
      if (y > pageHeight - 60) {
        doc.addPage();
        y = 20;
      }
    });

    // Línea de separación
    y += 2;
    doc.setDrawColor(209, 213, 219);
    doc.line(margin, y, pageWidth - margin, y);

    // ========================================
    // RESUMEN TOTAL
    // ========================================
    y += 8;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);

    doc.text('Cantidad de facturas:', pageWidth - 70, y);
    doc.text(String(facturas.length), pageWidth - margin, y, { align: 'right' });

    if (totalMoraGeneral > 0) {
      y += 5;
      doc.text('Total Mora aplicada:', pageWidth - 70, y);
      doc.text(formatCurrency(totalMoraGeneral), pageWidth - margin, y, { align: 'right' });
    }

    y += 8;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(31, 41, 55);
    doc.text('TOTAL PAGADO:', pageWidth - 70, y);
    doc.text(formatCurrency(totalGeneral), pageWidth - margin, y, { align: 'right' });

    // ========================================
    // DETALLES DEL PAGO
    // ========================================
    y += 15;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(55, 65, 81);
    doc.text('DETALLES DEL PAGO', margin, y);

    y += 7;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(31, 41, 55);

    doc.text('Fecha de Pago:', margin, y);
    doc.text(formatDateShort(pagoMultiple.fecha_pago), margin + 30, y);

    y += 5;
    doc.text('Método de Pago:', margin, y);
    doc.setFont('helvetica', 'bold');
    doc.text(toString(pagoMultiple.metodo_pago), margin + 35, y);

    // ========================================
    // MONTO PAGADO DESTACADO
    // ========================================
    y += 15;
    doc.setFillColor(16, 185, 129);
    doc.roundedRect(margin, y - 5, pageWidth - margin * 2, 18, 3, 3, 'F');

    y += 4;
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('MONTO TOTAL PAGADO', margin + 5, y);

    doc.setFontSize(18);
    doc.text(formatCurrency(pagoMultiple.monto_pago), pageWidth - margin - 5, y, { align: 'right' });

    // ========================================
    // OBSERVACIONES
    // ========================================
    if (pagoMultiple.observaciones && pagoMultiple.observaciones.trim() !== '') {
      y += 15;
      doc.setFillColor(254, 243, 199);
      const obsHeight = 12;
      doc.roundedRect(margin, y - 3, pageWidth - margin * 2, obsHeight, 2, 2, 'F');

      y += 3;
      doc.setTextColor(120, 53, 15);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      
      const obsTexto = `Observaciones: ${pagoMultiple.observaciones}`;
      const obsLineas = doc.splitTextToSize(obsTexto, pageWidth - margin * 2 - 10);
      doc.text(obsLineas, margin + 5, y);
    }

    // ========================================
    // FIRMAS
    // ========================================
    y += 25;
    if (y > pageHeight - 50) {
      doc.addPage();
      y = 20;
    }

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.line(margin + 10, y, margin + 70, y);
    doc.line(pageWidth - margin - 70, y, pageWidth - margin - 10, y);

    y += 4;
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.setFont('helvetica', 'normal');
    doc.text('Firma del Cajero', margin + 40, y, { align: 'center' });
    doc.text('Firma del Cliente', pageWidth - margin - 40, y, { align: 'center' });

    // ========================================
    // PIE DE PÁGINA
    // ========================================
    y += 15;
    doc.setFontSize(7);
    doc.setTextColor(156, 163, 175);
    doc.text('Este comprobante certifica el pago múltiple realizado', pageWidth / 2, y, { align: 'center' });
    y += 4;
    doc.text(`Generado el ${new Date().toLocaleString('es-EC')}`, pageWidth / 2, y, { align: 'center' });

    // ========================================
    // CONVERTIR A FILE
    // ========================================
    const pdfBlob = doc.output('blob');
    const pdfFile = new File(
      [pdfBlob],
      `Comprobante_Multiple_${String(pagoMultiple.id_pago).padStart(6, '0')}.pdf`,
      { type: 'application/pdf' }
    );

    return pdfFile;

  } catch (error) {
    console.error('❌ Error al generar PDF múltiple:', error);
    throw error;
  }
};

// ============================================================
// FUNCIÓN MEJORADA PARA TICKET TÉRMICO MÚLTIPLE 58mm
// ============================================================
export const printMultipleThermalTicket = (pagoMultiple, facturas, afiliado) => {
  const formatCurrency = (v) => new Intl.NumberFormat('es-EC', { 
    style: 'currency', 
    currency: 'USD' 
  }).format(v || 0);
  
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('es-EC', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // ✅ CALCULAR TOTALES GENERALES Y POR CONCEPTO
  let totalGeneral = 0;
  let totalConsumo = 0;
  let totalServicios = 0;
  let totalMultas = 0;
  let totalMora = 0;
  let totalConsumoM3 = 0;

  // Procesar cada factura para extraer detalles
  const facturasDetalladas = facturas.map((f) => {
    const totalFactura = parseFloat(f.saldo_pendiente || f.total_con_mora || 0);
    const moraFactura = parseFloat(f.mora_monto || f.mora?.monto || 0);
    const consumoM3 = parseFloat(f.consumo_m3 || 0);
    
    // Extraer desglose de conceptos
    const desglose = f.desglose || {};
    const consumoTotal = desglose.consumo?.total || 0;
    const serviciosTotal = desglose.servicios?.total || 0;
    const multasTotal = desglose.multas?.total || 0;
    
    // Acumular totales generales
    totalGeneral += totalFactura;
    totalConsumo += consumoTotal;
    totalServicios += serviciosTotal;
    totalMultas += multasTotal;
    totalMora += moraFactura;
    totalConsumoM3 += consumoM3;
    
    return {
      ...f,
      totalFactura,
      moraFactura,
      consumoM3,
      consumoTotal,
      serviciosTotal,
      multasTotal
    };
  });

  const win = window.open('', 'PRINT', 'height=600,width=900');
  
  win.document.write(`
    <html>
    <head>
      <title>Comprobante Múltiple</title>
      <meta charset="UTF-8">
      <style>
        @page { 
          size: 58mm auto; 
          margin: 0; 
        }
        body {
          font-family: 'Courier New', monospace;
          font-size: 11px;
          width: 58mm;
          margin: 0;
          padding: 3mm;
          line-height: 1.3;
        }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .line { 
          border-top: 1px dashed #000; 
          margin: 4px 0; 
        }
        .row { 
          display: flex; 
          justify-content: space-between; 
          margin: 2px 0; 
        }
        .header { 
          font-size: 13px; 
          font-weight: bold; 
          margin-bottom: 3px; 
        }
        .subheader { 
          font-size: 10px; 
          margin-bottom: 2px; 
        }
        .total-box {
          background: #000;
          color: #fff;
          padding: 4px;
          margin: 6px 0;
          text-align: center;
          font-weight: bold;
        }
        .small { font-size: 9px; }
        .factura-item {
          background: #f5f5f5;
          padding: 4px;
          margin: 3px 0;
          border-radius: 2px;
          border: 1px solid #ddd;
        }
        .concepto-row {
          display: flex;
          justify-content: space-between;
          font-size: 9px;
          padding: 1px 0;
        }
        .concepto-label {
          color: #666;
        }
        .resumen-box {
          background: #f9f9f9;
          padding: 4px;
          margin: 4px 0;
          border: 1px solid #ddd;
          border-radius: 2px;
        }
        @media print {
          body { width: 58mm; }
        }
      </style>
    </head>
    <body>
      
      <!-- ENCABEZADO -->
      <div class="center">
        <div class="header">JUNTA DE AGUA POTABLE</div>
        <div class="subheader">SANJAPAMBA</div>
        <div class="small">Chimborazo, Ecuador</div>
      </div>
      <div class="line"></div>
      
      <!-- INFO DEL COMPROBANTE -->
      <div class="center">
        <div class="bold">PAGO MÚLTIPLE</div>
        <div>No. ${String(pagoMultiple.id_pago).padStart(6, '0')}</div>
        <div class="small">${formatDate(pagoMultiple.fecha_pago)}</div>
      </div>
      <div class="line"></div>
      
      <!-- DATOS DEL AFILIADO -->
      <div>
        <div class="bold">AFILIADO</div>
        <div>${String(afiliado?.usuario_sistema?.nombre_completo || 'N/A')}</div>
        <div class="row">
          <span>Código:</span>
          <span>${String(afiliado?.cod_usuario_afi || 'N/A')}</span>
        </div>
        <div class="row">
          <span>Medidor:</span>
          <span>${String(afiliado?.num_medidor || 'N/A')}</span>
        </div>
      </div>
      <div class="line"></div>
      
      <!-- ✅ RESUMEN GENERAL POR CONCEPTOS -->
      <div class="bold center">RESUMEN GENERAL</div>
      <div class="resumen-box">
        <div class="concepto-row">
          <span class="concepto-label">Consumo Total:</span>
          <span class="bold">${formatCurrency(totalConsumo)}</span>
        </div>
        ${totalConsumoM3 > 0 ? `
        <div class="concepto-row small">
          <span class="concepto-label">${totalConsumoM3.toFixed(2)} m³ consumidos</span>
        </div>
        ` : ''}
        
        ${totalServicios > 0 ? `
        <div class="concepto-row">
          <span class="concepto-label"> Servicios:</span>
          <span class="bold">${formatCurrency(totalServicios)}</span>
        </div>
        ` : ''}
        
        ${totalMultas > 0 ? `
        <div class="concepto-row">
          <span class="concepto-label">Multas:</span>
          <span class="bold">${formatCurrency(totalMultas)}</span>
        </div>
        ` : ''}
        
        ${totalMora > 0 ? `
        <div class="concepto-row">
          <span class="concepto-label"> Mora:</span>
          <span class="bold">${formatCurrency(totalMora)}</span>
        </div>
        ` : ''}
      </div>
      <div class="line"></div>
      
      <!-- ✅ FACTURAS DETALLADAS (${facturas.length}) -->
      <div class="bold center">FACTURAS (${facturas.length})</div>
      
      ${facturasDetalladas.map((f, idx) => `
        <div class="factura-item">
          <!-- Header de factura -->
          <div class="row bold">
            <span>${idx + 1}. ${f.num_factura}</span>
            <span>${formatCurrency(f.totalFactura)}</span>
          </div>
          
          <div class="concepto-row small">
            <span>${f.periodo}</span>
            ${f.consumoM3 > 0 ? `<span>${f.consumoM3} m³</span>` : ''}
          </div>
          
          <!-- Desglose de conceptos -->
          ${f.consumoTotal > 0 ? `
          <div class="concepto-row">
            <span class="concepto-label">💧 Consumo:</span>
            <span>${formatCurrency(f.consumoTotal)}</span>
          </div>
          ` : ''}
          
          ${f.serviciosTotal > 0 ? `
          <div class="concepto-row">
            <span class="concepto-label">🔧 Servicios:</span>
            <span>${formatCurrency(f.serviciosTotal)}</span>
          </div>
          ` : ''}
          
          ${f.multasTotal > 0 ? `
          <div class="concepto-row">
            <span class="concepto-label">🚨 Multas:</span>
            <span>${formatCurrency(f.multasTotal)}</span>
          </div>
          ` : ''}
          
          ${f.moraFactura > 0 ? `
          <div class="concepto-row">
            <span class="concepto-label">⏰ Mora:</span>
            <span>${formatCurrency(f.moraFactura)}</span>
          </div>
          ` : ''}
        </div>
      `).join('')}
      
      <div class="line"></div>
      
      <!-- TOTALES FINALES -->
      <div class="row small">
        <span>Cantidad facturas:</span>
        <span class="bold">${facturas.length}</span>
      </div>
      
      ${totalMora > 0 ? `
      <div class="row small">
        <span>Total Mora:</span>
        <span>${formatCurrency(totalMora)}</span>
      </div>
      ` : ''}
      
      <div class="line"></div>
      
      <!-- TOTAL PAGADO -->
      <div class="total-box">
        <div>TOTAL PAGADO</div>
        <div style="font-size: 16px">${formatCurrency(pagoMultiple.monto_pago)}</div>
      </div>
      
      <!-- MÉTODO DE PAGO -->
      <div>
        <div class="row">
          <span>Método:</span>
          <span class="bold">${String(pagoMultiple.metodo_pago)}</span>
        </div>
      </div>
      
      <div class="line"></div>
      
      ${pagoMultiple.observaciones ? `
      <div class="small">
        <div class="bold">Observaciones:</div>
        <div>${pagoMultiple.observaciones}</div>
      </div>
      <div class="line"></div>
      ` : ''}
      
      <!-- PIE -->
      <div class="center small">
        <div>Gracias por su pago</div>
        <div style="margin-top: 4px">Documento interno</div>
      </div>
      
      <script>
        window.onload = function() {
          window.print();
          setTimeout(function() { window.close(); }, 100);
        };
      </script>
    </body>
    </html>
  `);
  
  win.document.close();
};



export default PaymentReceipt;
