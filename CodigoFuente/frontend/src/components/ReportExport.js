// src/components/ReportExport.js


import * as XLSX from 'xlsx-js-style';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const isLecturasReport = (moduleName = '') =>
  String(moduleName).toLowerCase().includes('lectura');

const isFacturasReport = (moduleName = '') =>
  String(moduleName).toLowerCase().includes('factura');

const isPagosReport = (moduleName = '') =>
  String(moduleName).toLowerCase().includes('pago');

const isCompactFinancialReport = (moduleName = '') =>
  isFacturasReport(moduleName) || isPagosReport(moduleName);

const getLecturasTakenBy = (data = []) => {
  const lectores = data
    .map(row => row?.lector)
    .filter(value => value !== null && value !== undefined && String(value).trim())
    .map(value => String(value).trim());

  const unicos = [...new Set(lectores)];
  if (unicos.length === 0) return 'Sin lector';
  if (unicos.length === 1) return unicos[0];
  return unicos.join(', ');
};

const sanitizePdfText = (value) => {
  return String(value ?? '')
    .replace(/[\uD800-\uDFFF]/g, '')
    .replace(/[\uFE00-\uFE0F\u200D]/g, '')
    .replace(/[\u2600-\u27BF]/g, '')
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const formatCellValue = (value, { forPdf = false } = {}) => {
  let formatted;

  if (value === null || value === undefined) {
    formatted = 'N/A';
  } else if (typeof value === 'boolean') {
    formatted = value ? 'Si' : 'No';
  } else if (Array.isArray(value)) {
    formatted = value.length > 0 ? value.join(', ') : 'N/A';
  } else if (typeof value === 'object') {
    formatted = JSON.stringify(value);
  } else {
    formatted = String(value);
  }

  return forPdf ? sanitizePdfText(formatted) : formatted;
};

const prepareReportRows = (data, moduleName) => {
  const shouldRemoveLector = isLecturasReport(moduleName);

  return data.map(row => {
    if (!shouldRemoveLector) return row;

    const { lector, ...rowWithoutLector } = row;
    return rowWithoutLector;
  });
};

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const buildPdfColumnStyles = (rawHeaders, moduleName, includeRowNumber) => {
  const offset = includeRowNumber ? 1 : 0;
  const styles = {};

  if (includeRowNumber) {
    styles[0] = { cellWidth: 9, halign: 'center' };
  }

  rawHeaders.forEach((header, index) => {
    const key = String(header).toLowerCase();
    const columnIndex = index + offset;

    if (['observacion', 'observaciones'].includes(key)) {
      styles[columnIndex] = {
        cellWidth: 58,
        overflow: 'linebreak',
        valign: 'top'
      };
      return;
    }

    if (!isCompactFinancialReport(moduleName)) return;

    if (key === 'periodo') {
      styles[columnIndex] = { cellWidth: 16, halign: 'center' };
    } else if (key === 'nombres' || key === 'nombre' || key === 'afiliado') {
      styles[columnIndex] = { cellWidth: isPagosReport(moduleName) ? 36 : 42, overflow: 'linebreak', valign: 'top' };
    } else if (key === 'conceptos_facturacion') {
      styles[columnIndex] = { cellWidth: 28, overflow: 'linebreak', valign: 'top' };
    } else if (key === 'observaciones') {
      styles[columnIndex] = { cellWidth: 24, overflow: 'linebreak', valign: 'top' };
    } else if (key === 'metodo_pago' || key === 'estado_factura') {
      styles[columnIndex] = { cellWidth: 16, overflow: 'linebreak', halign: 'center' };
    } else if (key === 'sector') {
      styles[columnIndex] = { cellWidth: 18, overflow: 'linebreak' };
    } else if (key === 'cedula' || key === 'fecha_emision' || key === 'fecha_pago') {
      styles[columnIndex] = { cellWidth: 15, halign: 'center' };
    } else if (key === 'num_factura') {
      styles[columnIndex] = { cellWidth: 22, halign: 'center' };
    } else if (key === 'estado') {
      styles[columnIndex] = { cellWidth: 14, halign: 'center' };
    } else if (key === 'cod_usuario_afi' || key === 'cod_afiliado' || key === 'num_medidor') {
      styles[columnIndex] = { cellWidth: 14, halign: 'center' };
    } else if (key.includes('_m3')) {
      styles[columnIndex] = { cellWidth: 13, halign: 'right' };
    } else if (key === 'tiene_mora' || key === 'tiene_comprobante' || key === 'pago_completo') {
      styles[columnIndex] = { cellWidth: 14, halign: 'center' };
    } else if (
      key.includes('valor') ||
      key.includes('total') ||
      key.includes('subtotal') ||
      key.includes('descuento') ||
      key.includes('monto') ||
      key.includes('impuesto') ||
      key === 'iva' ||
      key.includes('saldo')
    ) {
      styles[columnIndex] = { cellWidth: isPagosReport(moduleName) ? 16 : 17, halign: 'right' };
    }
  });

  return styles;
};

/**
 * Componente para exportación de reportes a Excel e impresión
 */
export const ReportExport = {
  /**
   * Exportar a PDF
   */
  exportarPDF: (data, moduleName, moduleDescription = '') => {
    if (!data || data.length === 0) {
      alert('No hay datos para exportar');
      return;
    }

    try {
      const preparedData = prepareReportRows(data, moduleName);
      const lecturaTomadaPor = isLecturasReport(moduleName)
        ? getLecturasTakenBy(data)
        : null;
      const includeRowNumber = !isCompactFinancialReport(moduleName);

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const fecha = new Date().toLocaleDateString('es-EC', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const rawHeaders = Object.keys(preparedData[0]);
      const headers = rawHeaders.map(h =>
        h.replace(/_/g, ' ').toUpperCase()
      );

      const dataRows = preparedData.map((row, index) => {
        const values = Object.values(row).map(v => formatCellValue(v, { forPdf: true }));
        return includeRowNumber ? [index + 1, ...values] : values;
      });

      // Título principal
      const columnStyles = buildPdfColumnStyles(rawHeaders, moduleName, includeRowNumber);

      doc.setFontSize(18);
      doc.setTextColor(31, 71, 136);
      doc.text('JAAP - SANJAPAMBA', 148.5, 15, { align: 'center' });

      // Subtítulo
      doc.setFontSize(11);
      doc.setTextColor(64, 64, 64);
      doc.text('SANJAPAMBA - San Andrés - Chimborazo', 148.5, 22, { align: 'center' });

      // Título del reporte
      doc.setFontSize(14);
      doc.setTextColor(31, 71, 136);
      doc.text(` ${moduleDescription || moduleName}`.toUpperCase(), 148.5, 30, { align: 'center' });

      // Fecha de generación
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Fecha de generación: ${fecha}`, 148.5, 37, { align: 'center' });

      // Tabla de datos
      autoTable(doc, {
        startY: 45,
        head: [includeRowNumber ? ['#', ...headers] : headers],
        body: dataRows,
        theme: 'grid',
        headStyles: {
          fillColor: [68, 114, 196],
          textColor: [255, 255, 255],
          fontSize: isCompactFinancialReport(moduleName) ? 6.5 : 9,
          halign: 'center',
          valign: 'middle'
        },
        bodyStyles: {
          fontSize: isCompactFinancialReport(moduleName) ? 6.2 : 8,
          textColor: [50, 50, 50],
          valign: 'middle',
          overflow: 'linebreak',
          minCellHeight: 6
        },
        styles: {
          overflow: 'linebreak',
          cellPadding: isCompactFinancialReport(moduleName) ? 1 : 1.8,
          lineWidth: 0.1
        },
        columnStyles,
        alternateRowStyles: {
          fillColor: [248, 249, 250]
        },
        margin: { top: 12, bottom: 20 },
        didDrawPage: (data) => {
          // Footer
          const str = `Página ${doc.internal.getNumberOfPages()}`;
          doc.setFontSize(8);
          doc.setTextColor(150, 150, 150);
          doc.text(str, 280, 200, { align: 'right' });
          doc.text('Sistema web de Facturación HidroSys', 15, 200);
        }
      });

      if (lecturaTomadaPor) {
        const finalY = doc.lastAutoTable?.finalY || 45;
        const pageHeight = doc.internal.pageSize.getHeight();
        if (finalY > pageHeight - 28) {
          doc.addPage();
        }
        const y = finalY > pageHeight - 28 ? 18 : finalY + 9;
        doc.setFontSize(10);
        doc.setTextColor(50, 50, 50);
        doc.text(`Lecturas tomadas por: ${sanitizePdfText(lecturaTomadaPor)}`, 15, y);
      }

      const fechaArchivo = new Date().toISOString().split('T')[0];
      const filename = `JAAP_${moduleName}_${fechaArchivo}.pdf`;
      doc.save(filename);

      console.log(`✅ PDF exportado correctamente: ${filename}`);

    } catch (error) {
      console.error('❌ Error al exportar PDF:', error);
      alert('Error al exportar el archivo PDF. Por favor, intente nuevamente.');
    }
  },

   /**
   * Exportar a Excel 
   */
  exportarExcel: (data, moduleName, moduleDescription = '') => {
    if (!data || data.length === 0) {
      alert('No hay datos para exportar');
      return;
    }

    try {
      const preparedData = prepareReportRows(data, moduleName);
      const lecturaTomadaPor = isLecturasReport(moduleName)
        ? getLecturasTakenBy(data)
        : null;
      const wb = XLSX.utils.book_new();
      
      // ==================== PREPARAR DATOS ====================
      const fecha = new Date().toLocaleDateString('es-EC', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const headers = Object.keys(preparedData[0]).map(h => 
        h.replace(/_/g, ' ').toUpperCase()
      );
      
      const dataRows = preparedData.map(row => 
        Object.values(row).map(v => formatCellValue(v))
      );
      const footerRows = lecturaTomadaPor
        ? [[], [`Lecturas tomadas por: ${lecturaTomadaPor}`]]
        : [];

      // ==================== CONSTRUIR HOJA ====================
      const wsData = [
        // Fila 1: Título de la institución
        ['JAAP - SANJAPAMBA'],
        
        // Fila 2: Ubicación
        ['SANJAPAMBA - San Andrés - Chimborazo'],
        
        // Fila 3: Título del reporte
        [`REPORTE DE ${moduleDescription || moduleName}`.toUpperCase()],
        
        // Fila 4: Fecha de generación
        [`Fecha de generación: ${fecha}`],
        
        // Fila 5: Vacía (separador)
        [],
        
        // Fila 6: Encabezados de la tabla
        headers,
        
        // Filas 7+: Datos
        ...dataRows,

        // Nota inferior especifica para lecturas
        ...footerRows
      ];

      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // ==================== ESTILOS ====================
      
      // Estilo para título principal (fila 1)
      const tituloStyle = {
        font: { 
          bold: true, 
          sz: 16, 
          color: { rgb: '1F4788' },
          name: 'Arial'
        },
        alignment: { 
          horizontal: 'center', 
          vertical: 'center'
        },
        fill: {
          fgColor: { rgb: 'E7F3FF' }
        }
      };

      // Estilo para subtítulo y ubicación (filas 2-4)
      const subtituloStyle = {
        font: { 
          bold: false, 
          sz: 11, 
          color: { rgb: '404040' },
          name: 'Arial'
        },
        alignment: { 
          horizontal: 'center', 
          vertical: 'center'
        }
      };

      // Estilo para el título del reporte (fila 3)
      const reporteTituloStyle = {
        font: { 
          bold: true, 
          sz: 13, 
          color: { rgb: '1F4788' },
          name: 'Arial'
        },
        alignment: { 
          horizontal: 'center', 
          vertical: 'center'
        }
      };

      // Estilo para encabezados de tabla (fila 6)
      const headerStyle = {
        fill: { 
          fgColor: { rgb: '4472C4' }
        },
        font: { 
          bold: true, 
          color: { rgb: 'FFFFFF' }, 
          sz: 11,
          name: 'Arial'
        },
        alignment: { 
          horizontal: 'center', 
          vertical: 'center', 
          wrapText: true 
        },
        border: {
          top: { style: 'medium', color: { rgb: '2F5496' } },
          bottom: { style: 'medium', color: { rgb: '2F5496' } },
          left: { style: 'thin', color: { rgb: '2F5496' } },
          right: { style: 'thin', color: { rgb: '2F5496' } }
        }
      };

      // Estilo para celdas de datos
      const cellStyle = {
        font: {
          sz: 10,
          name: 'Arial'
        },
        alignment: { 
          horizontal: 'left', 
          vertical: 'center', 
          wrapText: true 
        },
        border: {
          top: { style: 'thin', color: { rgb: 'D0D0D0' } },
          bottom: { style: 'thin', color: { rgb: 'D0D0D0' } },
          left: { style: 'thin', color: { rgb: 'D0D0D0' } },
          right: { style: 'thin', color: { rgb: 'D0D0D0' } }
        }
      };

      // Estilo alternado para filas (zebra striping)
      const cellStyleAlt = {
        ...cellStyle,
        fill: { 
          fgColor: { rgb: 'F8F9FA' }
        }
      };

      // ==================== APLICAR ESTILOS ====================
      const range = XLSX.utils.decode_range(ws['!ref']);
      
      // Fusionar celdas para el encabezado
      const numCols = Math.max(headers.length, 1);
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: numCols - 1 } }, // Fila 1: Título
        { s: { r: 1, c: 0 }, e: { r: 1, c: numCols - 1 } }, // Fila 2: Ubicación
        { s: { r: 2, c: 0 }, e: { r: 2, c: numCols - 1 } }, // Fila 3: Reporte
        { s: { r: 3, c: 0 }, e: { r: 3, c: numCols - 1 } }  // Fila 4: Fecha
      ];

      if (lecturaTomadaPor) {
        ws['!merges'].push({
          s: { r: 7 + dataRows.length, c: 0 },
          e: { r: 7 + dataRows.length, c: numCols - 1 }
        });
      }

      // Aplicar estilos a encabezado institucional
      for (let C = 0; C < numCols; C++) {
        // Fila 1: Título JAAP
        const cell1 = XLSX.utils.encode_cell({ r: 0, c: C });
        if (ws[cell1]) ws[cell1].s = tituloStyle;
        
        // Fila 2: Ubicación
        const cell2 = XLSX.utils.encode_cell({ r: 1, c: C });
        if (ws[cell2]) ws[cell2].s = subtituloStyle;
        
        // Fila 3: Título del reporte
        const cell3 = XLSX.utils.encode_cell({ r: 2, c: C });
        if (ws[cell3]) ws[cell3].s = reporteTituloStyle;
        
        // Fila 4: Fecha
        const cell4 = XLSX.utils.encode_cell({ r: 3, c: C });
        if (ws[cell4]) ws[cell4].s = subtituloStyle;
      }

      // Aplicar estilos a encabezados de tabla (fila 6, índice 5)
      for (let C = 0; C < numCols; C++) {
        const address = XLSX.utils.encode_cell({ r: 5, c: C });
        if (ws[address]) ws[address].s = headerStyle;
      }

      // Aplicar estilos a datos (filas 7+, índice 6+)
      for (let R = 6; R <= range.e.r; R++) {
        const isAltRow = (R - 6) % 2 === 1; // Alternar color
        for (let C = 0; C < numCols; C++) {
          const address = XLSX.utils.encode_cell({ r: R, c: C });
          if (ws[address]) {
            ws[address].s = isAltRow ? cellStyleAlt : cellStyle;
          }
        }
      }

      // ==================== AJUSTAR DIMENSIONES ====================
      
      // Anchos de columna optimizados
      const colWidths = headers.map((h, idx) => {
        const maxLen = Math.max(
          h.length,
          ...preparedData.map(row => {
            const val = Object.values(row)[idx];
            return String(val || '').length;
          })
        );
        return { wch: Math.min(Math.max(maxLen + 2, 12), 50) };
      });
      ws['!cols'] = colWidths;

      // Alturas de filas
      ws['!rows'] = [
        { hpx: 30 },  // Fila 1: Título principal
        { hpx: 20 },  // Fila 2: Ubicación
        { hpx: 25 },  // Fila 3: Título reporte
        { hpx: 20 },  // Fila 4: Fecha
        { hpx: 10 },  // Fila 5: Separador
        { hpx: 28 },  // Fila 6: Headers
        ...dataRows.map(() => ({ hpx: 22 })),
        ...footerRows.map(row => ({ hpx: row.length ? 24 : 10 }))
      ];

      // ==================== GUARDAR ARCHIVO ====================
      XLSX.utils.book_append_sheet(wb, ws, 'Reporte');

      const fechaArchivo = new Date().toISOString().split('T')[0];
      const filename = `JAAP_${moduleName}_${fechaArchivo}.xlsx`;
      
      XLSX.writeFile(wb, filename);
      
      console.log(`✅ Excel exportado correctamente: ${filename}`);

    } catch (error) {
      console.error('❌ Error al exportar Excel:', error);
      alert('Error al exportar el archivo Excel. Por favor, intente nuevamente.');
    }
  },

  /**
   * Versión alternativa con configuración personalizada
   */
  exportarExcelCustom: (data, config = {}) => {
    const {
      moduleName = 'Datos',
      moduleDescription = '',
      
    } = config;

    return ReportExport.exportarExcel(data, moduleName, moduleDescription);
  },
    /**
     * Imprimir reporte con diseño profesional
     */
    imprimirReporte: (data, moduleName, moduleDescription = '') => {
        if (!data || data.length === 0) {
        alert('No hay datos para imprimir');
        return;
        }

        const preparedData = prepareReportRows(data, moduleName);
        const lecturaTomadaPor = isLecturasReport(moduleName)
        ? getLecturasTakenBy(data)
        : null;
        const includeRowNumber = !isCompactFinancialReport(moduleName);
        const headers = Object.keys(preparedData[0]).map(h => h.replace(/_/g, ' ').toUpperCase());
        const usuario = localStorage.getItem('usuario') || 'Sistema';
        const fechaGeneracion = new Date().toLocaleString('es-EC', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
        });

        // Crear contenido HTML
        const printContent = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reporte - ${moduleName}</title>
            <style>
            @media print {
                @page {
                size: landscape;
                margin: 0.5cm;
                }
                body {
                margin: 0;
                padding: 0;
                }
            }

            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }

            body {
                font-family: 'Segoe UI', 'Arial', sans-serif;
                background: #f5f5f5;
                padding: 20px;
                color: #333;
            }

            .report-container {
                background: white;
                padding: 30px;
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                max-width: 1400px;
                margin: 0 auto;
            }

            /* ========== ENCABEZADO ========== */
            .report-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 30px;
                padding-bottom: 20px;
                border-bottom: 3px solid #4472C4;
            }

            .header-left h1 {
                font-size: 28px;
                color: #4472C4;
                margin-bottom: 8px;
            }

            .header-left p {
                font-size: 13px;
                color: #666;
                margin: 5px 0;
                line-height: 1.6;
            }

            .header-right {
                text-align: right;
            }

            .header-right .info-row {
                display: flex;
                gap: 30px;
                margin-bottom: 8px;
                font-size: 12px;
            }

            .header-right .info-label {
                color: #666;
                min-width: 120px;
            }

            .header-right .info-value {
                color: #333;
                font-weight: 600;
                min-width: 150px;
            }

            /* ========== TABLA ========== */
            table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 20px;
                font-size: 11px;
            }

            .compact-financial-report table {
                table-layout: fixed;
                font-size: 9px;
            }

            .compact-financial-report th,
            .compact-financial-report td {
                padding: 6px 4px;
                line-height: 1.25;
            }

            thead {
                background: linear-gradient(135deg, #4472C4 0%, #5B8FDB 100%);
                color: white;
            }

            th {
                padding: 12px 8px;
                text-align: left;
                font-weight: 600;
                border: 1px solid #2F5496;
                word-break: break-word;
                white-space: normal;
                line-height: 1.4;
            }

            td {
                padding: 9px 8px;
                border: 1px solid #ddd;
                word-break: break-word;
                overflow-wrap: anywhere;
                vertical-align: top;
            }

            tbody tr:nth-child(even) {
                background-color: #f9f9f9;
            }

            tbody tr:hover {
                background-color: #f0f4ff;
            }

            .text-center {
                text-align: center;
            }

            .text-right {
                text-align: right;
            }

            .font-bold {
                font-weight: 600;
            }

            .text-true {
                color: #22c55e;
                font-weight: 600;
            }

            .text-false {
                color: #ef4444;
                font-weight: 600;
            }

            /* ========== FOOTER ========== */
            .report-footer {
                margin-top: 40px;
                padding-top: 20px;
                border-top: 2px solid #ddd;
                display: flex;
                justify-content: space-between;
                font-size: 11px;
                color: #666;
            }

            .footer-item {
                flex: 1;
            }

            .footer-item strong {
                display: block;
                color: #333;
                margin-bottom: 4px;
            }

            .reader-note {
                margin-top: 18px;
                padding-top: 12px;
                border-top: 1px solid #ddd;
                font-size: 12px;
                color: #333;
            }

            @media print {
                body {
                background: white;
                padding: 0;
                }
                .report-container {
                box-shadow: none;
                border-radius: 0;
                }
                .no-print {
                display: none !important;
                }
            }
            </style>
        </head>
        <body>
            <div class="report-container ${isCompactFinancialReport(moduleName) ? 'compact-financial-report' : ''}">
            <!-- ENCABEZADO -->
            <div class="report-header">
                <div class="header-left">
	                <h1>${escapeHtml(moduleName)}</h1>
	                <p>${escapeHtml(moduleDescription)}</p>
                </div>
                <div class="header-right">
                <div class="info-row">
                    <span class="info-label">Generado por:</span>
	                    <span class="info-value">${escapeHtml(usuario)}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Fecha:</span>
	                    <span class="info-value">${escapeHtml(fechaGeneracion)}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Total de registros:</span>
	                    <span class="info-value">${preparedData.length}</span>
                </div>
                </div>
            </div>

            <!-- TABLA -->
            <table>
                <thead>
                <tr>
                    ${includeRowNumber ? '<th width="5%">#</th>' : ''}
	                    ${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}
                </tr>
                </thead>
                <tbody>
	                ${preparedData.map((row, index) => `
                    <tr>
                    ${includeRowNumber ? `<td class="text-center font-bold">${index + 1}</td>` : ''}
                    ${Object.entries(row).map(([key, value]) => {
                        let cellContent = 'N/A';
                        let cellClass = '';
                        
                        if (value !== null && value !== undefined) {
                        if (typeof value === 'boolean') {
                            cellContent = value ? 'Sí' : 'No';
                            cellClass = value ? 'text-true' : 'text-false';
                        } else {
                            cellContent = String(value);
                        }
                        }
                        
	                        return `<td class="${cellClass}">${escapeHtml(cellContent)}</td>`;
                    }).join('')}
                    </tr>
                `).join('')}
                </tbody>
            </table>

            ${lecturaTomadaPor ? `
            <div class="reader-note">
                <strong>Lecturas tomadas por:</strong> ${escapeHtml(lecturaTomadaPor)}
            </div>
            ` : ''}

            <!-- FOOTER -->
            <div class="report-footer">
                <div class="footer-item">
                <strong>Período:</strong>
                ${fechaGeneracion.split(' ')[0]}
                </div>
                <div class="footer-item">
                <strong>Sistema:</strong>
                Sistema web de Facturación HidroSys
                </div>
                <div class="footer-item">
                <strong>Documento:</strong>
                Reporte_${moduleName}_${new Date().toISOString().split('T')[0]}
                </div>
            </div>
            </div>
        </body>
        </html>
        `;

        // Abrir ventana de impresión
        const printWindow = window.open('', '_blank', 'width=1400,height=800');
        if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();

        // Esperar a que cargue e imprimir
        setTimeout(() => {
            printWindow.print();
        }, 500);
        } else {
        alert('Por favor, habilita las ventanas emergentes para imprimir');
        }
    }
};

export default ReportExport;
