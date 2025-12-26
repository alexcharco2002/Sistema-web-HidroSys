import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

class InvoicePDF {
  static generate(invoiceData) {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;
      let y = 20;

      // ================== ENCABEZADO ==================
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(31, 41, 55);
      doc.text("JUNTA ADMINISTRADORA DE AGUA POTABLE", pageWidth / 2, y, { align: "center" });

      y += 7;
      doc.setFontSize(14);
      doc.setTextColor(59, 130, 246);
      doc.text("SANJAPAMBA", pageWidth / 2, y, { align: "center" });

      y += 5;
      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128);
      doc.text(
        "Sanjapamba, Chimborazo, Ecuador",
        pageWidth / 2,
        y,
        { align: "center" }
      );

      y += 6;
      doc.setDrawColor(209, 213, 219);
      doc.line(margin, y, pageWidth - margin, y);

      // ================== TÍTULO ==================
      y += 10;
      doc.setFontSize(16);
      doc.setTextColor(220, 38, 38);
      doc.text(
        "FACTURA DE TRASPASO DE MEDIDOR",
        pageWidth / 2,
        y,
        { align: "center" }
      );

      // ================== INFO FACTURA ==================
      y += 10;
      doc.setFontSize(10);
      doc.setTextColor(0);

      doc.setFont("helvetica", "bold");
      doc.text("Factura:", margin, y);
      doc.setFont("helvetica", "normal");
      doc.text(invoiceData.invoiceNumber || "N/A", margin + 25, y);

      doc.setFont("helvetica", "bold");
      doc.text("Fecha:", pageWidth - margin - 40, y);
      doc.setFont("helvetica", "normal");
      doc.text(invoiceData.date || "N/A", pageWidth - margin - 20, y);

      // ================== DATOS MEDIDOR ==================
      y += 10;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(31, 41, 55);
      doc.text("DATOS DEL MEDIDOR", margin, y);

      autoTable(doc, {
        startY: y + 5,
        head: [["Campo", "Valor"]],
        body: [
          ["No. Medidor", invoiceData.meter?.nummedidor ?? "N/A"],
          ["Sector", invoiceData.meter?.nombresector ?? "N/A"],
          [
            "Ubicación",
            invoiceData.meter?.latitud && invoiceData.meter?.longitud
              ? `${Number(invoiceData.meter.latitud).toFixed(4)}, ${Number(
                  invoiceData.meter.longitud
                ).toFixed(4)}`
              : "No disponible",
          ],
        ],
        theme: "striped",
        styles: { fontSize: 9 },
        headStyles: { fillColor: [59, 130, 246] },
        margin: { left: margin, right: margin },
      });

      y = doc.lastAutoTable.finalY + 10;

      // ================== TRASPASO ==================
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(220, 38, 38);
      doc.text("INFORMACIÓN DEL TRASPASO", margin, y);

      autoTable(doc, {
        startY: y + 5,
        head: [["Concepto", "Detalle"]],
        body: [
          ["Afiliado Anterior", invoiceData.oldAffiliate?.nombre ?? "N/A"],
          ["Código Anterior", invoiceData.oldAffiliate?.codigo ?? "N/A"],
          ["Nuevo Afiliado", invoiceData.newAffiliate?.nombre ?? "N/A"],
          ["Nuevo Código", invoiceData.newAffiliate?.codigo ?? "N/A"],
        ],
        theme: "striped",
        styles: { fontSize: 9 },
        headStyles: { fillColor: [220, 38, 38] },
        margin: { left: margin, right: margin },
      });

      y = doc.lastAutoTable.finalY + 10;

      // ================== SERVICIO ==================
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(31, 41, 55);
      doc.text("SERVICIOS APLICADOS", margin, y);

      const monto = Number(invoiceData.service?.monto ?? 0).toFixed(2);

      autoTable(doc, {
        startY: y + 5,
        head: [["Descripción", "Cantidad", "Precio", "Total"]],
        body: [[invoiceData.service?.nombre ?? "Servicio", "1", `$${monto}`, `$${monto}`]],
        foot: [["", "", "TOTAL", `$${monto}`]],
        theme: "striped",
        styles: { fontSize: 10 },
        headStyles: { fillColor: [34, 197, 94] },
        footStyles: { fontStyle: "bold" },
        margin: { left: margin, right: margin },
      });

      y = doc.lastAutoTable.finalY + 15;

      // ================== PIE ==================
      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(107, 114, 128);
      doc.text(
        "Documento válido como comprobante de pago del servicio de traspaso.",
        pageWidth / 2,
        y,
        { align: "center" }
      );

      // ================== GUARDAR ==================
      const fileName = `Factura_Traspaso_${invoiceData.meter?.nummedidor ?? "SIN_NUM"}.pdf`;
      doc.save(fileName);

      return { success: true, fileName };

    } catch (error) {
      console.error("Error PDF:", error);
      return { success: false, error: error.message };
    }
  }
}

export default InvoicePDF;
