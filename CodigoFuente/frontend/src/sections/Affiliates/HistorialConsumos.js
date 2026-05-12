// src/sections/HistorialConsumos.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import affiliateGeneralServices from '../../services/affiliateGeneralServices';
import authService from '../../services/authServices';
import {
  Droplet, Eye, Calendar, Activity, AlertCircle, FileText,
  BarChart3, TrendingUp, RefreshCw, X, TrendingDown,
  CheckCircle, XCircle, Clock, Gauge, ArrowUpDown, SlidersHorizontal, Printer, FileDown 
} from 'lucide-react';
import './HistorialConsumos.css';

// IMPORT PARA EXPORTAR A PDF
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const HistorialConsumos = () => {

  // ============================================================
  // ESTADOS PRINCIPALES
  // ============================================================
  const [lecturas, setLecturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [, setCurrentUser] = useState(null);
  const [permissions, setPermissions] = useState({ canRead: false });
  const [isInitialized, setIsInitialized] = useState(false);

  // ============================================================
  // ESTADOS DE MEDIDORES Y PESTAÑA ACTIVA
  // ============================================================
  const [medidores, setMedidores] = useState([]);
  const [selectedMedidorId, setSelectedMedidorId] = useState(null); // null = todos

  // ============================================================
  // ESTADOS DE FILTROS Y BÚSQUEDA
  // ============================================================
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFechaDesde, setFilterFechaDesde] = useState('');
  const [filterFechaHasta, setFilterFechaHasta] = useState('');
  const [filterTipoLectura, setFilterTipoLectura] = useState('todas');
  const [filterConsumoMin, setFilterConsumoMin] = useState('');
  const [filterConsumoMax, setFilterConsumoMax] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [sortBy, setSortBy] = useState('fecha');

  // ============================================================
  // ESTADOS DE PERIODOS (AÑO/MES)
  // ============================================================
  const [aniosDisponibles, setAniosDisponibles] = useState([]);
  const [periodosDisponibles, setPeriodosDisponibles] = useState({});
  const currentYear = new Date().getFullYear();
  const [selectedAnio, setSelectedAnio] = useState(currentYear);
  const [selectedMes, setSelectedMes] = useState('');
  const [mesesDelAnio, setMesesDelAnio] = useState([]);

  // ============================================================
  // ESTADOS DE MODAL Y ESTADÍSTICAS
  // ============================================================
  const [showModal, setShowModal] = useState(false);
  const [selectedLectura, setSelectedLectura] = useState(null);
  const [stats, setStats] = useState({
    total_lecturas: 0,
    consumo_promedio: 0,
    consumo_total: 0,
    mes_mayor_consumo: null,
    mes_menor_consumo: null,
    tendencia: null
  });

  // ESTADO: Tarifas vigentes
  const [tarifasVigentes, setTarifasVigentes] = useState({
    tarifa_basica: null,
    tarifa_exceso: null
  });

  // ============================================================
  // INICIALIZACIÓN - PERMISOS Y USUARIO
  // ============================================================
  useEffect(() => {
    loadUserPermissions();
    loadCurrentUser();
  }, []);

  const loadUserPermissions = () => {
    const canRead =
      authService.hasPermission('historialconsumo', 'lectura') ||
      authService.hasPermission('historialconsumo', 'crud');
    setPermissions({ canRead });
  };

  const loadCurrentUser = () => {
    const user = authService.getStoredUser();
    if (user) setCurrentUser(user);
  };

  // ============================================================
  // FETCH MEDIDORES
  // ============================================================
  const fetchMisMedidores = useCallback(async () => {
    try {
      const result = await affiliateGeneralServices.getMisMedidores();
      if (result.success) {
        const lista = result.data.medidores || [];
        setMedidores(lista);
        return lista;
      }
      return [];
    } catch (error) {
      console.error('❌ Error obteniendo medidores:', error);
      return [];
    }
  }, []);

  // ============================================================
  // FETCH PERIODOS
  // ============================================================
  const fetchPeriodosDisponibles = useCallback(async () => {
    try {
      const result = await affiliateGeneralServices.getPeriodosMisLecturas();
      if (result.success) {
        setAniosDisponibles(result.data.anios_disponibles || []);
        setPeriodosDisponibles(result.data.periodos || {});
        if (result.data.anios_disponibles?.length > 0) {
          return result.data.anios_disponibles[0];
        }
      }
      return null;
    } catch (error) {
      console.error('❌ Error obteniendo periodos:', error);
      return null;
    }
  }, []);

  // ============================================================
  // FETCH TARIFAS
  // ============================================================
  const cargarTarifasVigentes = useCallback(async () => {
    try {
      const result = await affiliateGeneralServices.getTarifasVigentes();
      if (result.success) setTarifasVigentes(result.data);
    } catch (error) {
      console.error('Error cargando tarifas', error);
    }
  }, []);

  // ============================================================
  // INICIALIZACIÓN: carga medidores, periodos y tarifas
  // Se ejecuta solo cuando permissions.canRead cambia a true
  // ============================================================
  useEffect(() => {
    const inicializar = async () => {
      if (!permissions.canRead || isInitialized) return;

      // Cargar todo en paralelo
      const [anioReciente] = await Promise.all([
        fetchPeriodosDisponibles(),
        fetchMisMedidores(),
        cargarTarifasVigentes(),
      ]);

      if (anioReciente) {
        setSelectedAnio(anioReciente);
      }

      setIsInitialized(true);
    };

    inicializar();
  }, [permissions.canRead, isInitialized, fetchPeriodosDisponibles, fetchMisMedidores, cargarTarifasVigentes]);

  // Sincronizar meses cuando periodosDisponibles o selectedAnio cambian
  useEffect(() => {
    if (selectedAnio && periodosDisponibles[selectedAnio]) {
      setMesesDelAnio(periodosDisponibles[selectedAnio]);
    } else {
      setMesesDelAnio([]);
    }
  }, [selectedAnio, periodosDisponibles]);

  // ============================================================
  // CARGAR LECTURAS — se dispara cuando cambian filtros reales
  // NOTA: NO filtra por medidor en el backend porque queremos
  // tener TODAS las lecturas y filtrar por pestaña en el frontend.
  // Esto evita recargar cada vez que el usuario cambia de pestaña.
  // ============================================================
  useEffect(() => {
    const cargarLecturas = async () => {
      if (!permissions.canRead || !isInitialized) return;

      setLoading(true);
      setError(null);

      try {
        const result = await affiliateGeneralServices.getMisLecturasPorPeriodo(
          selectedAnio || null,
          selectedMes || null,
          { tipo_lectura: filterTipoLectura }
          // NO pasamos id_medidor aquí a propósito — el filtro por medidor
          // se hace en el frontend (filteredLecturas) para que las pestañas
          // respondan instantáneamente sin llamadas extra a la API.
        );

        if (result.success) {
          setLecturas(result.data);
          calcularEstadisticas(result.data);
        } else {
          setError(result.message);
        }
      } catch (err) {
        setError('Error al cargar tu historial de consumos');
        console.error('❌ Error cargando lecturas:', err);
      } finally {
        setLoading(false);
      }
    };

    cargarLecturas();
  }, [permissions.canRead, isInitialized, selectedAnio, selectedMes, filterTipoLectura]);

  // ============================================================
  // CALCULAR ESTADÍSTICAS — sobre las lecturas del medidor activo
  // ============================================================
  const calcularEstadisticas = (lecturasData) => {
    if (!lecturasData || lecturasData.length === 0) {
      setStats({ totallecturas: 0, consumopromedio: 0, consumototal: 0,
                mesmayorconsumo: null, mesmenorconsumo: null, tendencia: null })
      return
    }
    // Helper para leer campos en ambos formatos
    const gf = (obj, snake, camel) => obj?.[snake] ?? obj?.[camel] ?? null

    const total        = lecturasData.length
    const consumoTotal = lecturasData.reduce((sum, l) =>
      sum + (gf(l, 'consumo_m3', 'consumom3') || 0), 0)
    const consumoPromedio = total > 0 ? (consumoTotal / total).toFixed(2) : 0

    const lecturaMayor = lecturasData.reduce((max, l) =>
      (gf(l, 'consumo_m3', 'consumom3') || 0) > (gf(max, 'consumo_m3', 'consumom3') || 0) ? l : max,
      lecturasData[0])
    const lecturaMenor = lecturasData.reduce((min, l) =>
      (gf(l, 'consumo_m3', 'consumom3') || 0) < (gf(min, 'consumo_m3', 'consumom3') || 0) ? l : min,
      lecturasData[0])

    const lecturasOrdenadas = [...lecturasData].sort((a, b) =>
      new Date(gf(b, 'fecha_lectura', 'fechalectura')) -
      new Date(gf(a, 'fecha_lectura', 'fechalectura')))

    let tendencia = null
    if (lecturasOrdenadas.length >= 6) {
      const ultimos3    = lecturasOrdenadas.slice(0, 3)
      const anteriores3 = lecturasOrdenadas.slice(3, 6)
      const promedioUltimos    = ultimos3.reduce((s, l)    => s + (gf(l, 'consumo_m3', 'consumom3') || 0), 0) / 3
      const promedioAnteriores = anteriores3.reduce((s, l) => s + (gf(l, 'consumo_m3', 'consumom3') || 0), 0) / 3
      if (promedioAnteriores > 0) {
        const diferencia = ((promedioUltimos - promedioAnteriores) / promedioAnteriores * 100).toFixed(1)
        tendencia = {
          direccion: promedioUltimos > promedioAnteriores ? 'aumento' : 'disminucion',
          porcentaje: Math.abs(diferencia)
        }
      }
    }

    setStats({
      totallecturas:  total,
      consumopromedio: parseFloat(consumoPromedio),
      consumototal:   consumoTotal.toFixed(2),
      mesmayorconsumo: lecturaMayor,
      mesmenorconsumo: lecturaMenor,
      tendencia
    })
  }

  //
  // ── DESCARGAR PDF ─────────────────────────────────────────────
const descargarPDF = () => {
  if (filteredLecturas.length === 0) return

  try {
    const gf = (obj, snake, camel) => obj?.[snake] ?? obj?.[camel] ?? null

    // ── Stats inline ──────────────────────────────────────────
    const totalF        = filteredLecturas.length
    const consumoTotalF = filteredLecturas.reduce((s, l) =>
      s + (gf(l, 'consumo_m3', 'consumom3') || 0), 0)
    const consumoPromedioF = totalF > 0 ? (consumoTotalF / totalF).toFixed(2) : 0
    const mayorF = filteredLecturas.reduce((max, l) =>
      (gf(l, 'consumo_m3', 'consumom3') || 0) > (gf(max, 'consumo_m3', 'consumom3') || 0) ? l : max,
      filteredLecturas[0])
    const menorF = filteredLecturas.reduce((min, l) =>
      (gf(l, 'consumo_m3', 'consumom3') || 0) < (gf(min, 'consumo_m3', 'consumom3') || 0) ? l : min,
      filteredLecturas[0])

    // ── Nombre del afiliado (de la primera lectura) ───────────
    const primeraLectura  = filteredLecturas[0]
    const nombreAfiliado  = gf(primeraLectura, 'nombre_afiliado',  'nombreafiliado')  || 'N/A'
    const codigoAfiliado  = gf(primeraLectura, 'codigo_afiliado',  'codigoafiliado')  || ''
    const numMedidor      = gf(medidorActivo,  'num_medidor',      'nummedidor')      || ''

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const fecha = new Date().toLocaleDateString('es-EC', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })

    // ── Encabezado ────────────────────────────────────────────
    doc.setFontSize(18)
    doc.setTextColor(31, 71, 136)
    doc.text('JAAP - SANJAPAMBA', 148.5, 15, { align: 'center' })

    doc.setFontSize(11)
    doc.setTextColor(64, 64, 64)
    doc.text('SANJAPAMBA - San Andrés - Chimborazo', 148.5, 22, { align: 'center' })

    doc.setFontSize(14)
    doc.setTextColor(31, 71, 136)
    const subtitulo = numMedidor
      ? `HISTORIAL DE LECTURAS DE CONSUMO — Medidor: ${numMedidor}`
      : 'HISTORIAL DE LECTURAS DE CONSUMO'
    doc.text(subtitulo, 148.5, 30, { align: 'center' })

    // ── Afiliado ──────────────────────────────────────────────
    doc.setFontSize(10)
    doc.setTextColor(64, 64, 64)
    doc.text(
      `Afiliado: ${nombreAfiliado}${codigoAfiliado ? `  |  Código: ${codigoAfiliado}` : ''}`,
      148.5, 37, { align: 'center' }
    )

    doc.setFontSize(9)
    doc.setTextColor(100, 100, 100)
    doc.text(`Fecha de generación: ${fecha}`, 148.5, 43, { align: 'center' })

    // ── Resumen ───────────────────────────────────────────────
    doc.setFontSize(9)
    doc.setTextColor(50, 50, 50)
    doc.text(
      `Total: ${totalF}   Consumo total: ${consumoTotalF.toFixed(2)} m³   Promedio: ${consumoPromedioF} m³   Mayor: ${gf(mayorF,'consumo_m3','consumom3') ?? 0} m³   Menor: ${gf(menorF,'consumo_m3','consumom3') ?? 0} m³`,
      148.5, 49, { align: 'center' }
    )

    // ── Filas ─────────────────────────────────────────────────
    const headers = [
      'Fecha Lectura', 'Medidor', 'Sector',
      'Lect. Anterior', 'Lect. Actual', 'Consumo (m³)',
      'Tipo', 'Clasificación', 'Afiliado'
    ]

    const dataRows = filteredLecturas.map((l, i) => {
      const esEstimada    = gf(l, 'es_estimada', 'esestimada')
      const clasificacion = gf(l, 'clasificacion_consumo', 'clasificacionconsumo')
      return [
        i + 1,
        formatDateShort(gf(l, 'fecha_lectura', 'fechalectura')),
        gf(l, 'medidor', 'medidor')?.num_medidor || gf(l, 'medidor', 'medidor')?.nummedidor || 'N/A',
        l.sector || gf(l, 'medidor', 'medidor')?.sector || 'N/A',
        `${gf(l, 'lectura_anterior', 'lecturaanterior') ?? 0} m³`,
        `${gf(l, 'lectura_actual',   'lecturaactual')   ?? 0} m³`,
        `${gf(l, 'consumo_m3',       'consumom3')       ?? 0} m³`,
        esEstimada ? 'Estimada' : 'Real',
        clasificacion?.descripcion || 'N/A',
        gf(l, 'nombre_afiliado', 'nombreafiliado') || 'N/A',
      ]
    })

    autoTable(doc, {
      startY: 53,
      head: [['#', ...headers]],
      body: dataRows,
      theme: 'grid',
      headStyles: {
        fillColor: [68, 114, 196], textColor: [255, 255, 255],
        fontSize: 9, halign: 'center', valign: 'middle'
      },
      bodyStyles: { fontSize: 8, textColor: [50, 50, 50], valign: 'middle' },
      alternateRowStyles: { fillColor: [248, 249, 250] },
      didParseCell(data) {
        if (data.section === 'body') {
          const val = String(data.cell.raw || '').toLowerCase()
          // Columna Tipo
          if (data.column.index === 7) {
            if (val === 'estimada') data.cell.styles.textColor = [202, 138, 4]
            if (val === 'real')     data.cell.styles.textColor = [21, 128, 61]
          }
          // Columna Clasificación
          if (data.column.index === 8) {
            if (val.includes('exceso'))  data.cell.styles.textColor = [185, 28, 28]
            if (val.includes('normal'))  data.cell.styles.textColor = [21, 128, 61]
            if (val.includes('bajo'))    data.cell.styles.textColor = [37, 99, 235]
          }
        }
      },
      didDrawPage() {
        doc.setFontSize(8)
        doc.setTextColor(150, 150, 150)
        doc.text(
          `Página ${doc.internal.getCurrentPageInfo().pageNumber} de ${doc.internal.getNumberOfPages()}`,
          280, 200, { align: 'right' }
        )
        doc.text('Sistema web de Facturación HidroSys - JAAP Sanjapamba', 15, 200)
      },
      margin: { top: 53, bottom: 20 },
    })

    const fechaArchivo = new Date().toISOString().split('T')[0]
    doc.save(`JAAP_Lecturas_${selectedAnio || 'todos'}_${selectedMes || 'todos'}_${fechaArchivo}.pdf`)

  } catch (error) {
    console.error('Error al exportar PDF:', error)
    alert('Error al exportar el archivo PDF. Por favor, intente nuevamente.')
  }
}

// ── IMPRIMIR REPORTE ──────────────────────────────────────────
const imprimirReporte = () => {
  if (filteredLecturas.length === 0) return

  const gf = (obj, snake, camel) => obj?.[snake] ?? obj?.[camel] ?? null

  const fechaGeneracion = new Date().toLocaleString('es-EC', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  })

  // ── Stats inline ──────────────────────────────────────────
  const totalF        = filteredLecturas.length
  const consumoTotalF = filteredLecturas.reduce((s, l) =>
    s + (gf(l, 'consumo_m3', 'consumom3') || 0), 0)
  const consumoPromedioF = totalF > 0 ? (consumoTotalF / totalF).toFixed(2) : 0
  const mayorF = filteredLecturas.reduce((max, l) =>
    (gf(l, 'consumo_m3', 'consumom3') || 0) > (gf(max, 'consumo_m3', 'consumom3') || 0) ? l : max,
    filteredLecturas[0])
  const menorF = filteredLecturas.reduce((min, l) =>
    (gf(l, 'consumo_m3', 'consumom3') || 0) < (gf(min, 'consumo_m3', 'consumom3') || 0) ? l : min,
    filteredLecturas[0])

  // ── Nombre del afiliado ───────────────────────────────────
  const primeraLectura = filteredLecturas[0]
  const nombreAfiliado = gf(primeraLectura, 'nombre_afiliado', 'nombreafiliado') || 'N/A'
  const codigoAfiliado = gf(primeraLectura, 'codigo_afiliado', 'codigoafiliado') || ''
  const numMedidor     = gf(medidorActivo, 'num_medidor', 'nummedidor') || ''

  const headers = ['N°', 'Fecha', 'Medidor', 'Sector',
                   'Ant. (m³)', 'Act. (m³)', 'Consumo (m³)',
                   'Tipo', 'Clasificación', 'Afiliado']

  const filas = filteredLecturas.map((l, i) => {
    const esEstimada    = gf(l, 'es_estimada', 'esestimada')
    const clasificacion = gf(l, 'clasificacion_consumo', 'clasificacionconsumo')
    return [
      i + 1,
      formatDateShort(gf(l, 'fecha_lectura', 'fechalectura')),
      gf(l, 'medidor', 'medidor')?.num_medidor || gf(l, 'medidor', 'medidor')?.nummedidor || 'N/A',
      l.sector || gf(l, 'medidor', 'medidor')?.sector || 'N/A',
      `${gf(l, 'lectura_anterior', 'lecturaanterior') ?? 0}`,
      `${gf(l, 'lectura_actual',   'lecturaactual')   ?? 0}`,
      `${gf(l, 'consumo_m3',       'consumom3')       ?? 0}`,
      esEstimada ? 'Estimada' : 'Real',
      clasificacion?.descripcion || 'N/A',
      gf(l, 'nombre_afiliado', 'nombreafiliado') || 'N/A',
    ]
  })

  const printContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Historial de Lecturas - JAAP Sanjapamba</title>
  <style>
    @media print { @page { size: landscape; margin: 0.5cm; } }
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; padding: 20px; color: #333; margin: 0; }
    .report-container { background: white; padding: 30px; border-radius: 8px; max-width: 1400px; margin: 0 auto; }
    .report-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 3px solid #1d6fb8; }
    .header-left h1 { font-size: 22px; color: #1d6fb8; margin: 0 0 4px; }
    .header-left p { font-size: 12px; color: #666; margin: 2px 0; }
    .header-right { text-align: right; font-size: 12px; }
    .header-right .info-value { font-weight: 600; color: #333; }
    .stats-bar { display: flex; gap: 14px; background: #eff6ff; padding: 8px 14px; border-radius: 6px; margin-bottom: 16px; font-size: 12px; flex-wrap: wrap; }
    .stats-bar strong { color: #1d4ed8; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    thead { background: linear-gradient(135deg, #1d6fb8, #2b8fd4); color: white; }
    th { padding: 9px 6px; text-align: left; font-weight: 600; border: 1px solid #1558a0; }
    td { padding: 7px 6px; border: 1px solid #ddd; }
    tbody tr:nth-child(even) { background: #f9f9f9; }
    .tipo-real      { color: #15803d; font-weight: 600; }
    .tipo-estimada  { color: #ca8a04; font-weight: 600; }
    .cls-exceso     { color: #b91c1c; font-weight: 600; }
    .cls-normal     { color: #15803d; }
    .cls-bajo       { color: #2563eb; }
    .report-footer { margin-top: 24px; padding-top: 14px; border-top: 2px solid #ddd; display: flex; justify-content: space-between; font-size: 10px; color: #666; }
    @media print { body { background: white; padding: 0; } .report-container { box-shadow: none; } }
  </style>
</head>
<body>
  <div class="report-container">
    <div class="report-header">
      <div class="header-left">
        <h1>JAAP - SANJAPAMBA</h1>
        <p>Historial de Lecturas de Consumo</p>
        <p>Afiliado: <strong>${nombreAfiliado}</strong>${codigoAfiliado ? ` &nbsp;|&nbsp; Código: <strong>${codigoAfiliado}</strong>` : ''}</p>
        ${numMedidor ? `<p>Medidor: <strong>${numMedidor}</strong></p>` : ''}
      </div>
      <div class="header-right">
        <p>Generado: <span class="info-value">${fechaGeneracion}</span></p>
        <p>Total registros: <span class="info-value">${totalF}</span></p>
        ${selectedAnio ? `<p>Período: <span class="info-value">${selectedAnio}${selectedMes ? ` / Mes ${selectedMes}` : ''}</span></p>` : ''}
      </div>
    </div>

    <div class="stats-bar">
      <span>Total lecturas: <strong>${totalF}</strong></span>
      <span>Consumo total: <strong>${consumoTotalF.toFixed(2)} m³</strong></span>
      <span>Promedio mensual: <strong>${consumoPromedioF} m³</strong></span>
      <span>Mayor consumo: <strong>${gf(mayorF,'consumo_m3','consumom3') ?? 0} m³</strong></span>
      <span>Menor consumo: <strong>${gf(menorF,'consumo_m3','consumom3') ?? 0} m³</strong></span>
    </div>

    <table>
      <thead>
        <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${filas.map(fila => {
          const tipo     = String(fila[7] || '').toLowerCase()
          const clasif   = String(fila[8] || '').toLowerCase()
          const tipoCls  = tipo === 'real' ? 'tipo-real' : 'tipo-estimada'
          const clasifCls = clasif.includes('exceso') ? 'cls-exceso'
                           : clasif.includes('normal') ? 'cls-normal'
                           : clasif.includes('bajo')   ? 'cls-bajo' : ''
          return `<tr>${fila.map((c, ci) => {
            const cls = ci === 7 ? tipoCls : ci === 8 ? clasifCls : ''
            return `<td${cls ? ` class="${cls}"` : ''}>${c ?? 'N/A'}</td>`
          }).join('')}</tr>`
        }).join('')}
      </tbody>
    </table>

    <div class="report-footer">
      <div>Sistema web de Facturación HidroSys</div>
      <div>JAAP Sanjapamba — San Andrés, Chimborazo</div>
      <div>Reporte generado: ${new Date().toISOString().split('T')[0]}</div>
    </div>
  </div>
</body>
</html>`

  const printWindow = window.open('', '_blank', 'width=1400,height=800')
  if (printWindow) {
    printWindow.document.write(printContent)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => printWindow.print(), 500)
  } else {
    alert('Por favor, habilita las ventanas emergentes para imprimir.')
  }
}

  // ============================================================
  // RECALCULAR ESTADÍSTICAS cuando cambia la pestaña de medidor
  // ============================================================
  useEffect(() => {
    if (lecturas.length === 0) return;
    const base = selectedMedidorId
      ? lecturas.filter(l => l.id_medidor === selectedMedidorId)
      : lecturas;
    calcularEstadisticas(base);
  }, [selectedMedidorId, lecturas]);

  // ============================================================
  // CONTEO DE LECTURAS POR MEDIDOR (para los badges de las pestañas)
  // ============================================================
  const conteoPorMedidor = useMemo(() => {
    const mapa = {};
    lecturas.forEach(l => {
      mapa[l.id_medidor] = (mapa[l.id_medidor] || 0) + 1;
    });
    return mapa;
  }, [lecturas]);

  // ============================================================
  // FILTRADO Y ORDENAMIENTO — incluye filtro por medidor activo
  // ============================================================
  const filteredLecturas = useMemo(() => {
    return lecturas
      .filter(lectura => {
        // ✅ FILTRO POR PESTAÑA DE MEDIDOR
        if (selectedMedidorId !== null && lectura.id_medidor !== selectedMedidorId) {
          return false;
        }

        // Filtro de búsqueda por texto
        const matchesSearch =
          lectura.medidor?.num_medidor?.toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
          lectura.observacion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          lectura.medidor?.sector?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          lectura.id_lectura?.toString().includes(searchTerm);

        // Filtro por rango de fechas
        const fechaLectura = new Date(lectura.fecha_lectura);
        const matchesFechaDesde = !filterFechaDesde || fechaLectura >= new Date(filterFechaDesde);
        const matchesFechaHasta = !filterFechaHasta || fechaLectura <= new Date(filterFechaHasta);

        // Filtros por rango de consumo
        const matchesConsumoMin = !filterConsumoMin || lectura.consumo_m3 >= parseFloat(filterConsumoMin);
        const matchesConsumoMax = !filterConsumoMax || lectura.consumo_m3 <= parseFloat(filterConsumoMax);

        return matchesSearch && matchesFechaDesde && matchesFechaHasta &&
          matchesConsumoMin && matchesConsumoMax;
      })
      .sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case 'fecha':
            comparison = new Date(a.fecha_lectura) - new Date(b.fecha_lectura);
            break;
          case 'consumo':
            comparison = (a.consumo_m3 || 0) - (b.consumo_m3 || 0);
            break;
          case 'medidor':
            comparison = (a.medidor?.num_medidor || '').localeCompare(b.medidor?.num_medidor || '');
            break;
          default:
            comparison = new Date(a.fecha_lectura) - new Date(b.fecha_lectura);
        }
        return sortOrder === 'asc' ? comparison : -comparison;
      });
  }, [
    lecturas, selectedMedidorId, searchTerm,
    filterFechaDesde, filterFechaHasta,
    filterConsumoMin, filterConsumoMax,
    sortBy, sortOrder
  ]);

  // ============================================================
  // INFO DEL MEDIDOR ACTIVO (para la barra de info)
  // ============================================================
  const medidorActivo = useMemo(() => {
    if (selectedMedidorId === null) return null;
    return medidores.find(m => m.id_medidor === selectedMedidorId) || null;
  }, [selectedMedidorId, medidores]);

  // ============================================================
  // FUNCIONES DE PERIODOS
  // ============================================================
  const handleAnioChange = (e) => {
    const anio = e.target.value;
    setSelectedAnio(anio);
    setSelectedMes('');
    if (anio && periodosDisponibles[anio]) {
      setMesesDelAnio(periodosDisponibles[anio]);
    } else {
      setMesesDelAnio([]);
    }
  };

  const toggleSortOrder = () => setSortOrder(o => o === 'asc' ? 'desc' : 'asc');

  const limpiarFiltros = () => {
    setSearchTerm('');
    setFilterFechaDesde('');
    setFilterFechaHasta('');
    setFilterTipoLectura('todas');
    setFilterConsumoMin('');
    setFilterConsumoMax('');
    setSortBy('fecha');
    setSortOrder('desc');
    setSelectedAnio('');
    setSelectedMes('');
    setSelectedMedidorId(null);
  };

  // ============================================================
  // FUNCIÓN RECARGA
  // ============================================================
  const handleRecargar = async () => {
    setLoading(true);
    setError(null);
    try {
      const [result] = await Promise.all([
        affiliateGeneralServices.getMisLecturasPorPeriodo(
          selectedAnio || null,
          selectedMes || null,
          { tipo_lectura: filterTipoLectura }
        ),
        fetchMisMedidores(),
      ]);
      if (result.success) {
        setLecturas(result.data);
        calcularEstadisticas(result.data);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Error al recargar los datos');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // MODAL
  // ============================================================
  const verDetalle = (lectura) => { setSelectedLectura(lectura); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setSelectedLectura(null); };

  // ============================================================
  // UTILIDADES
  // ============================================================
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString + 'T00:00:00').toLocaleDateString('es-EC', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  };

  const formatDateShort = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString + 'T00:00:00').toLocaleDateString('es-EC', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  // ============================================================
  // BADGE DE CLASIFICACIÓN
  // ============================================================
  const renderClasificacionBadge = (clasificacion) => {
    if (!clasificacion) return null;
    const iconMap = {
      'arrow-down': TrendingDown,
      'check-circle': CheckCircle,
      'alert-triangle': AlertCircle
    };
    const Icon = iconMap[clasificacion.icono] || Activity;
    return (
      <div className={`lectura-badge lectura-badge-${clasificacion.tipo}`}>
        <Icon className="w-3 h-3" />
        <span>{clasificacion.descripcion}</span>
      </div>
    );
  };

  // ============================================================
  // COLORES POR ÍNDICE DE MEDIDOR (para las pestañas)
  // ============================================================
  const MEDIDOR_COLORS = ['green', 'amber', 'purple', 'coral', 'teal'];

  // ============================================================
  // ESTADOS ESPECIALES DE RENDERIZADO
  // ============================================================
  if (!permissions.canRead) {
    return (
      <div className="users-section">
        <div className="empty-state">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3>Sin permisos</h3>
          <p>No tienes permiso para acceder al historial de consumos.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="affiliates-section">
        <div className="empty-state">
          <RefreshCw className="w-16 h-16 text-blue-400 mx-auto mb-4 animate-spin" />
          <h3>Espere mientras cargamos su historial de consumos...</h3>
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDERIZADO PRINCIPAL
  // ============================================================
  return (
    <div className="users-section">

      {/* HEADER */}
      <div className="section-header">
        <div className="section-title">
          <Clock className="w-7 h-7 text-blue-600" />
          <div>
            <h2>Mi Historial de Lecturas</h2>
            <p className="section-subtitle">Información de mi historial de Lecturas</p>
          </div>
        </div>
        {/* BOTONES DE ACCIÓN */}
        <div className="flex items-center gap-3">

          {/* PDF */}
          <button
            className="btn-secondary btn-export btn-export-pdf"
            onClick={descargarPDF}
            disabled={filteredLecturas.length === 0}
            title={`Descargar ${filteredLecturas.length} lecturas en PDF`}
          >
            <FileDown className="w-4 h-4" />
            <span className="btn-export-label">PDF</span>
          </button>

          {/* Imprimir */}
          <button
            className="btn-secondary btn-export"
            onClick={imprimirReporte}
            disabled={filteredLecturas.length === 0}
            title="Imprimir lecturas"
          >
            <Printer className="w-4 h-4" />
            <span className="btn-export-label">Imprimir</span>
          </button>

        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="alert alert-error mb-4">
          <AlertCircle className="w-5 h-5 mr-2" />
          {error}
        </div>
      )}

      {/* ESTADÍSTICAS */}
      {stats && (
        <div className="periodo-stats-container">
          <div className="periodo-stats-header">
            <FileText className="w-5 h-5 text-blue-600 mr-2" />
            <h3>
              Resumen de mis Lecturas
              {medidorActivo && (
                <span className="stats-medidor-tag">
                  — Medidor {medidorActivo.num_medidor}
                </span>
              )}
            </h3>
          </div>
          <div className="users-stats">
            <div className="stat-item">
              <FileText className="stat-icon text-blue-600" />
              <div>
                <p className="stat-label">Total Lecturas</p>
                <p className="stat-value">{stats.total_lecturas}</p>
              </div>
            </div>
            <div className="stat-item active green">
              <Activity className="stat-icon text-green-600" />
              <div>
                <p className="stat-label">Consumo Total</p>
                <p className="stat-value">{stats.consumo_total} m³</p>
              </div>
            </div>
            <div className="stat-item active yellow">
              <BarChart3 className="stat-icon text-yellow-600" />
              <div>
                <p className="stat-label">Promedio Mensual</p>
                <p className="stat-value">{stats.consumo_promedio} m³</p>
              </div>
            </div>
            <div className="stat-item active red">
              <TrendingUp className="stat-icon text-red-600" />
              <div>
                <p className="stat-label">Mayor Consumo</p>
                <p className="stat-value">
                  {stats.mes_mayor_consumo ? `${stats.mes_mayor_consumo.consumo_m3} m³` : 'N/A'}
                </p>
              </div>
            </div>
            <div className="stat-item active blue">
              <TrendingDown className="stat-icon text-blue-600" />
              <div>
                <p className="stat-label">Menor Consumo</p>
                <p className="stat-value">
                  {stats.mes_menor_consumo ? `${stats.mes_menor_consumo.consumo_m3} m³` : 'N/A'}
                </p>
              </div>
            </div>
            {stats.tendencia && (
              <div className={`stat-item active ${stats.tendencia.direccion === 'aumento' ? 'orange' : 'green'}`}>
                {stats.tendencia.direccion === 'aumento'
                  ? <TrendingUp className="stat-icon text-orange-600" />
                  : <TrendingDown className="stat-icon text-green-600" />}
                <div>
                  <p className="stat-label">Tendencia (3 meses)</p>
                  <p className="stat-value text-sm">
                    {stats.tendencia.direccion === 'aumento' ? '↑' : '↓'} {stats.tendencia.porcentaje}%
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FILTROS */}
      <div className="filters-main-container">
        <div className="filters-section-card">
          <div className="filters-section-header">
            <Calendar className="w-4 h-4 text-blue-600" />
            <h4 className="filters-section-title">Filtrar por Periodo</h4>
          </div>
          <div className="filters-section-content-full">
            <div className="filter-group-row">
              <div className="filter-group">
                <label className="filter-label">Año</label>
                <select className="filter-select" value={selectedAnio} onChange={handleAnioChange}>
                  <option value="">Todos los años</option>
                  {aniosDisponibles.map(anio => (
                    <option key={anio} value={anio}>{anio}</option>
                  ))}
                </select>
              </div>
              <div className="filter-group">
                <label className="filter-label">Mes</label>
                <select
                  className="filter-select"
                  value={selectedMes}
                  onChange={(e) => setSelectedMes(e.target.value)}
                  disabled={!selectedAnio}
                >
                  <option value="">Todos los meses</option>
                  {mesesDelAnio.map(periodo => (
                    <option key={periodo.mes} value={periodo.mes}>
                      {periodo.nombre_mes} ({periodo.total_lecturas})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="filters-section-card">
          <div className="filters-section-header">
            <SlidersHorizontal className="w-4 h-4 text-purple-600" />
            <h4 className="filters-section-title">Filtros y Ordenamiento</h4>
          </div>
          <div className="filters-section-content">
            <div className="filter-group">
              <label className="filter-label">Tipo de Lectura</label>
              <select
                className="filter-select"
                value={filterTipoLectura}
                onChange={(e) => setFilterTipoLectura(e.target.value)}
              >
                <option value="todas">Todas</option>
                <option value="reales">Reales</option>
                <option value="estimadas">Estimadas</option>
              </select>
            </div>
            <div className="filter-group">
              <label className="filter-label">Ordenar por</label>
              <select className="filter-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="fecha">Fecha</option>
                <option value="consumo">Consumo</option>
              </select>
            </div>
            <div className="filter-group">
              <label className="filter-label">Dirección</label>
              <button className="filter-btn-toggle" onClick={toggleSortOrder}
                title={sortOrder === 'asc' ? 'Ascendente' : 'Descendente'}>
                <ArrowUpDown className="w-4 h-4" />
                <span>{sortOrder === 'asc' ? 'Ascendente' : 'Descendente'}</span>
              </button>
            </div>
            <div className="filter-actions-group">
              <button className="filter-btn-action filter-btn-clear" onClick={limpiarFiltros}>
                <X className="w-4 h-4" />
                <span>Limpiar</span>
              </button>
              <button className="filter-btn-action filter-btn-reload" onClick={handleRecargar} disabled={loading}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Recargar</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ==================== REGISTRO DE LECTURAS CON PESTAÑAS ==================== */}
      <div className="lecturas-container">

        {/* PESTAÑAS DE MEDIDORES — solo si hay más de uno */}
        {medidores.length > 0 && (
          <div className="medidor-tabs-wrapper">
            {/* Pestaña "Todos" */}
            <button
              className={`medidor-tab ${selectedMedidorId === null ? 'active' : ''}`}
              onClick={() => setSelectedMedidorId(null)}
            >
              <span className="medidor-tab-icon medidor-tab-icon-all">
                <Droplet style={{ width: 11, height: 11 }} />
              </span>
              <span className="medidor-tab-label">
                {medidores.length > 1 ? 'Todos' : 'Lecturas'}
              </span>
              <span className={`medidor-tab-badge ${selectedMedidorId === null ? 'active' : ''}`}>
                {lecturas.length}
              </span>
            </button>

            {/* Una pestaña por medidor */}
            {medidores.map((med, idx) => {
              const color = MEDIDOR_COLORS[idx % MEDIDOR_COLORS.length];
              const conteo = conteoPorMedidor[med.id_medidor] || 0;
              const isActive = selectedMedidorId === med.id_medidor;
              return (
                <button
                  key={med.id_medidor}
                  className={`medidor-tab ${isActive ? 'active' : ''}`}
                  onClick={() => setSelectedMedidorId(med.id_medidor)}
                  title={med.sector ? `Sector: ${med.sector.nombre_sector}` : ''}
                >
                  <span className={`medidor-tab-icon medidor-tab-icon-${color}`}>
                    <Gauge style={{ width: 11, height: 11 }} />
                  </span>
                  <div className="medidor-tab-text">
                    <span className="medidor-tab-label">{med.num_medidor}</span>
                    {med.sector && (
                      <span className="medidor-tab-sector">{med.sector.nombre_sector}</span>
                    )}
                  </div>
                  <span className={`medidor-tab-badge ${isActive ? 'active' : ''}`}>
                    {conteo}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* BARRA DE INFO DEL MEDIDOR ACTIVO */}
        <div className="medidor-info-bar">
          <span className="medidor-info-dot" />
          {selectedMedidorId === null ? (
            <span>
              Mostrando lecturas de <strong>todos los medidores</strong>
              {medidores.length > 0 && (
                <> · <strong>{medidores.length}</strong> medidor{medidores.length !== 1 ? 'es' : ''} activo{medidores.length !== 1 ? 's' : ''}</>
              )}
            </span>
          ) : (
            <span>
              Medidor <strong>{medidorActivo?.num_medidor}</strong>
              {medidorActivo?.sector && (
                <> · Sector: <strong>{medidorActivo.sector.nombre_sector}</strong></>
              )}
              {medidorActivo?.latitud && medidorActivo?.longitud && (
                <> · Lat: {medidorActivo.latitud.toFixed(4)}, Lng: {medidorActivo.longitud.toFixed(4)}</>
              )}
            </span>
          )}
          <span className="medidor-info-sep">|</span>
          <span>
            <strong>{filteredLecturas.length}</strong>{' '}
            {filteredLecturas.length === 1 ? 'lectura' : 'lecturas'}
          </span>
        </div>

        {/* HEADER DE LA LISTA */}
        <div className="lecturas-header-row">
          <div className="lecturas-header-title">
            <Droplet className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-lg">Registro de Lecturas</h3>
          </div>
        </div>

        {/* ENCABEZADOS DE COLUMNAS */}
        {filteredLecturas.length > 0 && (
          <div className="lec-cols-header">
            <div className="lec-ch">
              <Calendar className="w-3 h-3" />
              <span>Fecha / Medidor</span>
            </div>
            <div className="lec-ch lec-ch-center">
              <Gauge className="w-3 h-3" />
              <span>Consumo</span>
            </div>
            <div className="lec-ch lec-ch-center">
              <Activity className="w-3 h-3" />
              <span>Lecturas</span>
            </div>
            <div className="lec-ch lec-ch-center">
              <TrendingUp className="w-3 h-3" />
              <span>Clasificación</span>
            </div>
            <div className="lec-ch lec-ch-center">
              <FileText className="w-3 h-3" />
              <span>Tipo</span>
            </div>
            <div className="lec-ch" />
          </div>
        )}


        {/* LISTA */}
        {filteredLecturas.length === 0 ? (
          <div className="lecturas-empty-state">
            <Droplet className="w-12 h-12 text-gray-300 mb-2" />
            <p>
              {lecturas.length === 0
                ? 'No tienes lecturas registradas aún.'
                : selectedMedidorId !== null
                  ? `No hay lecturas registradas para el medidor ${medidorActivo?.num_medidor || ''}.`
                  : 'No hay lecturas que coincidan con los filtros aplicados.'}
            </p>
          </div>
        ) : (
          <div className="lecturas-grid-list">
            {filteredLecturas.map(lectura => (
              <div key={lectura.id_lectura} className="lectura-card-item">

                {/* Columna 1: Fecha y Medidor */}
                <div className="lectura-info-section lectura-clickable" onClick={() => verDetalle(lectura)}>
                  <Calendar className="w-5 h-5 text-blue-500 flex-shrink-0" />
                  <div className="lectura-info-text">
                    <span className="lectura-fecha">{formatDateShort(lectura.fecha_lectura)}</span>
                    <span className="lectura-medidor">Medidor: {lectura.medidor?.num_medidor || 'N/A'}</span>
                  </div>
                </div>

                {/* Columna 2: Consumo */}
                <div className="lectura-consumo-section lectura-clickable" onClick={() => verDetalle(lectura)}>
                  <div className="lectura-consumo-box">
                    <Gauge className="w-5 h-5 text-blue-600" />
                    <div className="lectura-consumo-text">
                      <span className="lectura-consumo-valor">{lectura.consumo_m3} m³</span>
                      <span className="lectura-consumo-label">Consumo</span>
                    </div>
                  </div>
                </div>

                {/* Columna 3: Lecturas Actual/Anterior */}
                <div className="lectura-valores-section lectura-clickable" onClick={() => verDetalle(lectura)}>
                  <div className="lectura-valor-item">
                    <Activity className="w-4 h-4 text-green-600" />
                    <div className="lectura-valor-text">
                      <span className="lectura-valor-numero">{lectura.lectura_actual}</span>
                      <span className="lectura-valor-label">Actual</span>
                    </div>
                  </div>
                  <div className="lectura-separador">→</div>
                  <div className="lectura-valor-item">
                    <Activity className="w-4 h-4 text-gray-500" />
                    <div className="lectura-valor-text">
                      <span className="lectura-valor-numero">{lectura.lectura_anterior}</span>
                      <span className="lectura-valor-label">Anterior</span>
                    </div>
                  </div>
                </div>

                {/* Columna 4: Clasificación */}
                <div className="lectura-clasificacion-section lectura-clickable" onClick={() => verDetalle(lectura)}>
                  {renderClasificacionBadge(lectura.clasificacion_consumo)}
                </div>

                {/* Columna 5: Estado Real/Estimada */}
                <div className="lectura-estado-section lectura-clickable" onClick={() => verDetalle(lectura)}>
                  {lectura.es_estimada ? (
                    <div className="lectura-badge lectura-badge-estimada">
                      <AlertCircle className="w-4 h-4" />
                      <span>Estimada</span>
                    </div>
                  ) : (
                    <div className="lectura-badge lectura-badge-real">
                      <CheckCircle className="w-4 h-4" />
                      <span>Real</span>
                    </div>
                  )}
                </div>

                {/* Columna 6: Botón Ver */}
                <div className="lectura-actions-section">
                  <button
                    onClick={(e) => { e.stopPropagation(); verDetalle(lectura); }}
                    className="lectura-btn-ver"
                  >
                    <Eye className="w-4 h-4" />
                    <span>Ver</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

{/* MODAL DE DETALLES */}
{showModal && selectedLectura && (
  <div className="modal-overlay">
    <div className="modal">
      <div className="modal-header">
        <h3>Detalles de la Lectura</h3>
        <button className="modal-close" onClick={closeModal}>
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="modal-body">
        <div className="user-details">

          {/* CLASIFICACIÓN */}
          {selectedLectura.clasificacion_consumo && tarifasVigentes.tarifa_basica && (
            <div className="detail-group" style={{
              padding: '16px', borderRadius: '8px', marginBottom: '4px',
              border: '2px solid', borderColor: selectedLectura.clasificacion_consumo.color,
              backgroundColor: `${selectedLectura.clasificacion_consumo.color}08`
            }}>
              <label>Análisis de Consumo:</label>
              <div style={{ marginBottom: '8px' }}>
                {renderClasificacionBadge(selectedLectura.clasificacion_consumo)}
              </div>

              {selectedLectura.clasificacion_consumo.tipo === 'bajo' && (
                <div style={{ backgroundColor: '#dbeafe', padding: '12px', borderRadius: '6px', border: '1px solid #60a5fa' }}>
                  <p style={{ margin: 0, color: '#1e40af', fontSize: '14px', lineHeight: '1.6' }}>
                    <strong>Tu consumo está por debajo del mínimo establecido.</strong>
                  </p>
                  <p style={{ margin: '8px 0 0', color: '#1e40af', fontSize: '13px' }}>
                    • Consumo: <strong>{selectedLectura.consumo_m3} m³</strong><br />
                    • Mínimo esperado: <strong>{tarifasVigentes.tarifa_basica.limite_min_m3} m³</strong><br />
                    • Diferencia: <strong>{(tarifasVigentes.tarifa_basica.limite_min_m3 - selectedLectura.consumo_m3).toFixed(2)} m³ menos</strong>
                  </p>
                </div>
              )}

              {selectedLectura.clasificacion_consumo.tipo === 'normal' && (
                <div style={{ backgroundColor: '#dcfce7', padding: '12px', borderRadius: '6px', border: '1px solid #4ade80' }}>
                  <p style={{ margin: 0, color: '#166534', fontSize: '14px', lineHeight: '1.6' }}>
                    <strong>✓ Tu consumo está dentro del rango normal.</strong>
                  </p>
                  <p style={{ margin: '8px 0 0', color: '#166534', fontSize: '13px' }}>
                    • Consumo: <strong>{selectedLectura.consumo_m3} m³</strong><br />
                    • Rango permitido: <strong>{tarifasVigentes.tarifa_basica.limite_min_m3} - {tarifasVigentes.tarifa_basica.limite_max_m3} m³</strong><br />
                    • Tarifa aplicada: <strong>${tarifasVigentes.tarifa_basica.precio_por_m3}/m³</strong><br />
                    • Margen restante: <strong>{(tarifasVigentes.tarifa_basica.limite_max_m3 - selectedLectura.consumo_m3).toFixed(2)} m³</strong>
                  </p>
                </div>
              )}

              {selectedLectura.clasificacion_consumo.tipo === 'exceso' && (
                <div style={{ backgroundColor: '#fee2e2', padding: '12px', borderRadius: '6px', border: '1px solid #f87171' }}>
                  <p style={{ margin: 0, color: '#991b1b', fontSize: '14px', fontWeight: 600, lineHeight: '1.6' }}>
                    ⚠️ Tu consumo supera el límite normal
                  </p>
                  <div style={{ marginTop: '12px', padding: '12px', backgroundColor: 'white', borderRadius: '6px', border: '1px dashed #f87171' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                      <div>
                        <p style={{ margin: 0, color: '#6b7280', fontWeight: 500 }}>Consumo Total:</p>
                        <p style={{ margin: '4px 0 0', color: '#991b1b', fontWeight: 700, fontSize: '16px' }}>{selectedLectura.consumo_m3} m³</p>
                      </div>
                      <div>
                        <p style={{ margin: 0, color: '#6b7280', fontWeight: 500 }}>Límite Normal:</p>
                        <p style={{ margin: '4px 0 0', color: '#166534', fontWeight: 700, fontSize: '16px' }}>{tarifasVigentes.tarifa_basica.limite_max_m3} m³</p>
                      </div>
                      <div>
                        <p style={{ margin: 0, color: '#6b7280', fontWeight: 500 }}>Exceso:</p>
                        <p style={{ margin: '4px 0 0', color: '#dc2626', fontWeight: 700, fontSize: '16px' }}>
                          +{(selectedLectura.consumo_m3 - tarifasVigentes.tarifa_basica.limite_max_m3).toFixed(2)} m³
                        </p>
                      </div>
                      {tarifasVigentes.tarifa_exceso && (
                        <div>
                          <p style={{ margin: 0, color: '#6b7280', fontWeight: 500 }}>Tarifa Exceso:</p>
                          <p style={{ margin: '4px 0 0', color: '#dc2626', fontWeight: 700, fontSize: '16px' }}>
                            ${tarifasVigentes.tarifa_exceso.precio_por_m3}/m³
                          </p>
                        </div>
                      )}
                    </div>
                    {tarifasVigentes.tarifa_exceso && (
                      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #fecaca' }}>
                        <p style={{ margin: 0, color: '#991b1b', fontSize: '12px', lineHeight: '1.5' }}>
                          <strong>Costo estimado del exceso:</strong> ${(
                            (selectedLectura.consumo_m3 - tarifasVigentes.tarifa_basica.limite_max_m3) *
                            tarifasVigentes.tarifa_exceso.precio_por_m3
                          ).toFixed(2)}
                        </p>
                        <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '11px', fontStyle: 'italic' }}>
                          Este valor se suma a la tarifa básica en tu factura.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="detail-group">
            <label>Medidor:</label>
            <p>{selectedLectura.medidor?.num_medidor || 'N/A'}</p>
          </div>

          <div className="detail-group">
            <label>Sector:</label>
            <p>{selectedLectura.sector || 'Sin sector'}</p>
          </div>

          <div className="detail-group">
            <label>Código de Afiliado:</label>
            <p>{selectedLectura.codigo_afiliado || 'N/A'}</p>
          </div>

          <div className="detail-group">
            <label>Nombre Afiliado:</label>
            <p>{selectedLectura.nombre_afiliado || 'Sin afiliado'}</p>
          </div>

          <div className="detail-group">
            <label>Lectura Anterior:</label>
            <p>{selectedLectura.lectura_anterior} m³</p>
          </div>

          <div className="detail-group">
            <label>Lectura Actual:</label>
            <p>{selectedLectura.lectura_actual} m³</p>
          </div>

          <div className="detail-group">
            <label>Consumo:</label>
            <p className="text-green-700 font-semibold">{selectedLectura.consumo_m3} m³</p>
          </div>

          <div className="detail-group">
            <label>Fecha lectura:</label>
            <p>{formatDate(selectedLectura.fecha_lectura)}</p>
          </div>

          <div className="detail-group">
            <label>Lector:</label>
            <p>{selectedLectura.lector ? `${selectedLectura.lector.nombres} ${selectedLectura.lector.apellidos}` : 'No registrado'}</p>
          </div>

          <div className="detail-group">
            <label>Observación:</label>
            <p>{selectedLectura.observacion || 'Sin observaciones'}</p>
          </div>

          <div className="detail-group">
            <label>Estado:</label>
            <span className={`status-badge ${selectedLectura.activo ? 'active' : 'inactive'}`}>
              {selectedLectura.activo ? (
                <><CheckCircle className="w-3 h-3 mr-1" />Activo</>
              ) : (
                <><XCircle className="w-3 h-3 mr-1" />Inactivo</>
              )}
            </span>
          </div>

          {selectedLectura.es_estimada && (
            <div className="detail-group">
              <label>Tipo:</label>
              <span className="status-badge" style={{ backgroundColor: '#fbbf24', color: '#92400e' }}>
                <AlertCircle className="w-3 h-3 mr-1" />
                Lectura Estimada
              </span>
            </div>
          )}

        </div>
      </div>
    </div>
  </div>
)}

    </div>
  );
};

export default HistorialConsumos;