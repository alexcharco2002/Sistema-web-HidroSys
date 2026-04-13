// src/components/ReportExport.js


import * as XLSX from 'xlsx-js-style';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

      const headers = Object.keys(data[0]).map(h =>
        h.replace(/_/g, ' ').toUpperCase()
      );

      const dataRows = data.map((row, index) => [
        index + 1,
        ...Object.values(row).map(v =>
          v === null || v === undefined ? 'N/A' :
          typeof v === 'boolean' ? (v ? 'Sí' : 'No') :
          Array.isArray(v) ? (v.length > 0 ? v.join(', ') : 'N/A') :
          typeof v === 'object' ? JSON.stringify(v) :
          String(v)
        )
      ]);

      // Título principal
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
        head: [['#', ...headers]],
        body: dataRows,
        theme: 'grid',
        headStyles: {
          fillColor: [68, 114, 196],
          textColor: [255, 255, 255],
          fontSize: 9,
          halign: 'center',
          valign: 'middle'
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [50, 50, 50],
          valign: 'middle'
        },
        alternateRowStyles: {
          fillColor: [248, 249, 250]
        },
        margin: { top: 45, bottom: 20 },
        didDrawPage: (data) => {
          // Footer
          const str = `Página ${doc.internal.getNumberOfPages()}`;
          doc.setFontSize(8);
          doc.setTextColor(150, 150, 150);
          doc.text(str, 280, 200, { align: 'right' });
          doc.text('Sistema web de Facturación TecniCobro 2.0', 15, 200);
        }
      });

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
      const wb = XLSX.utils.book_new();
      
      // ==================== PREPARAR DATOS ====================
      const fecha = new Date().toLocaleDateString('es-EC', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const headers = Object.keys(data[0]).map(h => 
        h.replace(/_/g, ' ').toUpperCase()
      );
      
      const dataRows = data.map(row => 
        Object.values(row)
        .map(v =>
          v === null || v === undefined ? 'N/A' :
          typeof v === 'boolean' ? (v ? 'Sí' : 'No') :
          Array.isArray(v) ? (v.length > 0 ? v.join(', ') : 'N/A') :
          typeof v === 'object' ? JSON.stringify(v) :
          String(v)
        )
      );

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
        ...dataRows
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
      const numCols = headers.length;
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: numCols - 1 } }, // Fila 1: Título
        { s: { r: 1, c: 0 }, e: { r: 1, c: numCols - 1 } }, // Fila 2: Ubicación
        { s: { r: 2, c: 0 }, e: { r: 2, c: numCols - 1 } }, // Fila 3: Reporte
        { s: { r: 3, c: 0 }, e: { r: 3, c: numCols - 1 } }  // Fila 4: Fecha
      ];

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
          ...data.map(row => {
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
        ...dataRows.map(() => ({ hpx: 22 })) // Filas de datos
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

        const headers = Object.keys(data[0]).map(h => h.replace(/_/g, ' ').toUpperCase());
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
            <div class="report-container">
            <!-- ENCABEZADO -->
            <div class="report-header">
                <div class="header-left">
                <h1>${moduleName}</h1>
                <p>${moduleDescription}</p>
                </div>
                <div class="header-right">
                <div class="info-row">
                    <span class="info-label">Generado por:</span>
                    <span class="info-value">${usuario}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Fecha:</span>
                    <span class="info-value">${fechaGeneracion}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Total de registros:</span>
                    <span class="info-value">${data.length}</span>
                </div>
                </div>
            </div>

            <!-- TABLA -->
            <table>
                <thead>
                <tr>
                    <th width="5%">#</th>
                    ${headers.map(h => `<th>${h}</th>`).join('')}
                </tr>
                </thead>
                <tbody>
                ${data.map((row, index) => `
                    <tr>
                    <td class="text-center font-bold">${index + 1}</td>
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
                        
                        return `<td class="${cellClass}">${cellContent}</td>`;
                    }).join('')}
                    </tr>
                `).join('')}
                </tbody>
            </table>

            <!-- FOOTER -->
            <div class="report-footer">
                <div class="footer-item">
                <strong>Período:</strong>
                ${fechaGeneracion.split(' ')[0]}
                </div>
                <div class="footer-item">
                <strong>Sistema:</strong>
                Sistema web de Facturación TecniCobro 2.0
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
