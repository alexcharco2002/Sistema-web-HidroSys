// src/components/ReportStats.js
import React, { useState, useMemo } from 'react';
import { 
  BarChart3, PieChart, Activity, 
  ChevronDown, ChevronUp, Maximize2, X 
} from 'lucide-react';
import './ReportStats.css';

const ReportStats = ({ data, moduloInfo, stats }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState('graficos'); // 'graficos' | 'tablas' | 'metricas'
  
  // Calcular datos para gráficos según el módulo
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null;
    
    const modulo = moduloInfo?.value;
    
    switch (modulo) {
      case 'Lecturas':
        return calculateLecturasCharts(data);
      case 'Facturas':
        return calculateFacturasCharts(data);
      case 'Pagos':
        return calculatePagosCharts(data);
      case 'Usuarios':
        return calculateUsuariosCharts(data);
      default:
        return null;
    }
  }, [data, moduloInfo]);
  
  if (!data || data.length === 0) return null;
  
  return (
    <div className={`report-stats-container ${isExpanded ? 'expanded' : ''} ${isFullscreen ? 'fullscreen' : ''}`}>
      {/* Header del panel */}
      <div className="report-stats-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="report-stats-title">
          <BarChart3 className="w-5 h-5 text-blue-600" />
          <span className="font-semibold">Estadísticas Avanzadas</span>
          <span className="stats-badge">{data.length} registros</span>
        </div>
        
        <div className="report-stats-actions">
          {isExpanded && (
            <button 
              className="btn-icon" 
              onClick={(e) => {
                e.stopPropagation();
                setIsFullscreen(!isFullscreen);
              }}
              title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
            >
              {isFullscreen ? <X className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </div>
      
      {/* Contenido del panel */}
      {isExpanded && (
        <div className="report-stats-content">
          {/* Tabs */}
          <div className="stats-tabs">
            <button 
              className={`stats-tab ${activeTab === 'graficos' ? 'active' : ''}`}
              onClick={() => setActiveTab('graficos')}
            >
              <PieChart className="w-4 h-4" />
              <span>Gráficos</span>
            </button>
            <button 
              className={`stats-tab ${activeTab === 'tablas' ? 'active' : ''}`}
              onClick={() => setActiveTab('tablas')}
            >
              <Activity className="w-4 h-4" />
              <span>Tablas</span>
            </button>
          </div>
          
          {/* Contenido según tab activa */}
          <div className="stats-tab-content">
            {activeTab === 'graficos' && chartData && (
              <GraphicsView chartData={chartData} moduloInfo={moduloInfo} />
            )}
            {activeTab === 'tablas' && (
              <TablesView data={data} moduloInfo={moduloInfo} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// VISTA DE GRÁFICOS
// ============================================================================
const GraphicsView = ({ chartData, moduloInfo }) => {
  return (
    <div className="graphics-grid">
      {/* Gráfico de Barras */}
      {chartData.barChart && (
        <div className="chart-card">
          <h4 className="chart-title">{chartData.barChart.title}</h4>
          <BarChart data={chartData.barChart.data} />
        </div>
      )}
      
      {/* Gráfico de Dona */}
      {chartData.donutChart && chartData.donutChart.data && chartData.donutChart.data.length > 0 && (
        <div className="chart-card">
          <h4 className="chart-title">{chartData.donutChart.title}</h4>
          <DonutChart data={chartData.donutChart.data} />
        </div>
      )}

      
      {/* Gráfico de Líneas */}
      {chartData.lineChart && (
        <div className="chart-card">
          <h4 className="chart-title">{chartData.lineChart.title}</h4>
          <LineChart data={chartData.lineChart.data} />
        </div>
      )}
      
      {/* Distribución */}
      {chartData.distribution && (
        <div className="chart-card">
          <h4 className="chart-title">{chartData.distribution.title}</h4>
          <DistributionChart data={chartData.distribution.data} />
        </div>
      )}
      
      {/* Segunda Distribución (para Facturas y Pagos) */}
      {chartData.distribution2 && (
        <div className="chart-card">
          <h4 className="chart-title">{chartData.distribution2.title}</h4>
          <DistributionChart data={chartData.distribution2.data} />
        </div>
      )}
    </div>
  );
};

// ============================================================================
// VISTA DE TABLAS
// ============================================================================
const TablesView = ({ data, moduloInfo }) => {
  const tableData = useMemo(() => {
    const modulo = moduloInfo?.value;
    
    switch (modulo) {
      case 'Lecturas':
        return generateLecturasTable(data);
      case 'Facturas':
        return generateFacturasTable(data);
      case 'Pagos':
        return generatePagosTable(data);
      default:
        return generateGenericTable(data);
    }
  }, [data, moduloInfo]);
  
  return (
    <div className="tables-container">
      {tableData.map((table, idx) => (
        <div key={idx} className="stats-table-card">
          <h4 className="table-title">{table.title}</h4>
          <div className="stats-table-wrapper">
            <table className="stats-table">
              <thead>
                <tr>
                  {table.headers.map((header, i) => (
                    <th key={i}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// COMPONENTES DE GRÁFICOS SVG
// ============================================================================

const BarChart = ({ data }) => {
  const maxValue = Math.max(...data.map(d => d.value));
  const chartHeight = 200;
  const barWidth = 40;
  const spacing = 20;
  
  return (
    <div className="chart-container">
      <svg 
        width="100%" 
        height={chartHeight + 40}
        viewBox={`0 0 ${(barWidth + spacing) * data.length} ${chartHeight + 40}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {data.map((item, idx) => {
          const barHeight = (item.value / maxValue) * chartHeight;
          const x = idx * (barWidth + spacing);
          const y = chartHeight - barHeight;
          
          return (
            <g key={idx}>
              {/* Barra */}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={item.color || '#3b82f6'}
                rx="4"
                className="bar-animated"
              />
              {/* Valor */}
              <text
                x={x + barWidth / 2}
                y={y - 5}
                textAnchor="middle"
                fontSize="12"
                fill="#374151"
                fontWeight="600"
              >
                {item.value}
              </text>
              {/* Label */}
              <text
                x={x + barWidth / 2}
                y={chartHeight + 20}
                textAnchor="middle"
                fontSize="11"
                fill="#6b7280"
              >
                {item.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

const DonutChart = ({ data }) => {
  const size = 200;
  const center = size / 2;
  const radius = 70;
  const innerRadius = 45;
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (!total || total <= 0) {
    return (
      <div className="chart-container">
        <p style={{ fontSize: 13, color: '#6b7280' }}>
          Sin datos suficientes para mostrar el gráfico.
        </p>
      </div>
    );
  }

  let currentAngle = -90;

  return (
    <div className="chart-container">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {data.map((item, idx) => {
          const percentage = (item.value / total) * 100;
          const angle = (percentage / 100) * 360;

          const startAngle = (currentAngle * Math.PI) / 180;
          const endAngle = ((currentAngle + angle) * Math.PI) / 180;

          const x1 = center + radius * Math.cos(startAngle);
          const y1 = center + radius * Math.sin(startAngle);
          const x2 = center + radius * Math.cos(endAngle);
          const y2 = center + radius * Math.sin(endAngle);

          const x3 = center + innerRadius * Math.cos(endAngle);
          const y3 = center + innerRadius * Math.sin(endAngle);
          const x4 = center + innerRadius * Math.cos(startAngle);
          const y4 = center + innerRadius * Math.sin(startAngle);

          const largeArc = angle > 180 ? 1 : 0;

          const pathData = [
            `M ${x1} ${y1}`,
            `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
            `L ${x3} ${y3}`,
            `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4}`,
            'Z'
          ].join(' ');

          currentAngle += angle;

          return (
            <path
              key={idx}
              d={pathData}
              fill={item.color || `hsl(${idx * 60}, 70%, 60%)`}
              className="donut-segment"
            />
          );
        })}

        <text
          x={center}
          y={center - 5}
          textAnchor="middle"
          fontSize="24"
          fontWeight="700"
          fill="#111827"
        >
          {total}
        </text>
        <text
          x={center}
          y={center + 15}
          textAnchor="middle"
          fontSize="12"
          fill="#6b7280"
        >
          Total
        </text>
      </svg>

      <div className="chart-legend">
        {data.map((item, idx) => (
          <div key={idx} className="legend-item">
            <div
              className="legend-color"
              style={{ backgroundColor: item.color || `hsl(${idx * 60}, 70%, 60%)` }}
            />
            <span className="legend-label">{item.label}</span>
            <span className="legend-value">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const LineChart = ({ data }) => {
  const chartWidth = 400;
  const chartHeight = 200;
  const padding = 30;
  
  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));
  const range = maxValue - minValue || 1;
  
  const points = data.map((item, idx) => {
    const x = padding + (idx / (data.length - 1)) * (chartWidth - 2 * padding);
    const y = chartHeight - padding - ((item.value - minValue) / range) * (chartHeight - 2 * padding);
    return { x, y, ...item };
  });
  
  const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  
  return (
    <div className="chart-container">
      <svg width="100%" height={chartHeight + 20} viewBox={`0 0 ${chartWidth} ${chartHeight + 20}`}>
        {/* Línea */}
        <path
          d={pathData}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="line-animated"
        />
        
        {/* Puntos */}
        {points.map((point, idx) => (
          <g key={idx}>
            <circle
              cx={point.x}
              cy={point.y}
              r="5"
              fill="#fff"
              stroke="#3b82f6"
              strokeWidth="2"
              className="point-animated"
            />
            <text
              x={point.x}
              y={chartHeight - 5}
              textAnchor="middle"
              fontSize="10"
              fill="#6b7280"
            >
              {point.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};

const DistributionChart = ({ data }) => {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  
  return (
    <div className="distribution-chart">
      {data.map((item, idx) => {
        const percentage = ((item.value / total) * 100).toFixed(1);
        
        return (
          <div key={idx} className="distribution-item">
            <div className="distribution-header">
              <span className="distribution-label">{item.label}</span>
              <span className="distribution-value">{item.value} ({percentage}%)</span>
            </div>
            <div className="distribution-bar-container">
              <div 
                className="distribution-bar" 
                style={{ 
                  width: `${percentage}%`, 
                  backgroundColor: item.color || '#3b82f6' 
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ============================================================================
// FUNCIONES DE CÁLCULO DE DATOS PARA GRÁFICOS
// ============================================================================

const calculateLecturasCharts = (data) => {
  // Distribución por tipo de lectura
  const reales = data.filter(l => l.tipo_lectura === 'Real').length;
  const estimadas = data.filter(l => l.tipo_lectura === 'Estimada').length;
  
  // Top 5 consumos
  const topConsumos = [...data]
    .sort((a, b) => (b.consumo_m3 || 0) - (a.consumo_m3 || 0))
    .slice(0, 5)
    .map(l => ({
      label: l.nombres?.split(' ')[0] || 'N/A',
      value: l.consumo_m3 || 0,
      color: '#3b82f6'
    }));
  
  // Distribución por sector
  const sectores = {};
  data.forEach(l => {
    const sector = l.sector || 'Sin sector';
    sectores[sector] = (sectores[sector] || 0) + 1;
  });
  
  const sectoresData = Object.entries(sectores).map(([label, value]) => ({
    label,
    value,
    color: `hsl(${Math.random() * 360}, 70%, 60%)`
  }));
  
  return {
    barChart: {
      title: 'Top 5 Mayores Consumos',
      data: topConsumos
    },
    donutChart: {
      title: 'Distribución por Tipo',
      data: [
        { label: 'Reales', value: reales, color: '#22c55e' },
        { label: 'Estimadas', value: estimadas, color: '#f97316' }
      ]
    },
    distribution: {
      title: 'Lecturas por Sector',
      data: sectoresData
    }
  };
};

const calculateFacturasCharts = (data) => {
  // Estados de facturas
  const pagadas = data.filter(f => 
    f.estado?.toLowerCase() === 'pagada' || f.estado_factura?.toLowerCase() === 'pagada'
  ).length;
  const pendientes = data.filter(f => 
    f.estado?.toLowerCase() === 'pendiente' || f.estado_factura?.toLowerCase() === 'pendiente'
  ).length;
  const vencidas = data.filter(f => 
    f.estado?.toLowerCase() === 'vencida' || f.estado_factura?.toLowerCase() === 'vencida'
  ).length;
  
  // Top 5 facturas más altas
  const topFacturas = [...data]
    .sort((a, b) => (parseFloat(b.total) || 0) - (parseFloat(a.total) || 0))
    .slice(0, 5)
    .map(f => ({
      label: `${f.num_factura}`,
      value: parseFloat(f.total) || 0,
      color: '#3b82f6'
    }));
  
  // Distribución de montos por estado
  const montoPagado = data
    .filter(f => f.estado?.toLowerCase() === 'pagada' || f.estado_factura?.toLowerCase() === 'pagada')
    .reduce((sum, f) => sum + (parseFloat(f.total) || 0), 0);
    
  const montoPendiente = data
    .filter(f => f.estado?.toLowerCase() === 'pendiente' || f.estado_factura?.toLowerCase() === 'pendiente')
    .reduce((sum, f) => sum + (parseFloat(f.total) || 0), 0);
    
  const montoVencido = data
    .filter(f => f.estado?.toLowerCase() === 'vencida' || f.estado_factura?.toLowerCase() === 'vencida')
    .reduce((sum, f) => sum + (parseFloat(f.total) || 0), 0);
  
  return {
    barChart: {
      title: 'Top 5 Facturas Más Altas',
      data: topFacturas
    },
    donutChart: {
      title: 'Estado de Facturas (Cantidad)',
      data: [
        { label: 'Pagadas', value: pagadas, color: '#22c55e' },
        { label: 'Pendientes', value: pendientes, color: '#f97316' },
        { label: 'Vencidas', value: vencidas, color: '#ef4444' }
      ].filter(item => item.value > 0)
    },
    distribution: {
      title: 'Montos por Estado',
      data: [
        { label: 'Pagado', value: montoPagado.toFixed(2), color: '#22c55e' },
        { label: 'Pendiente', value: montoPendiente.toFixed(2), color: '#f97316' },
        { label: 'Vencido', value: montoVencido.toFixed(2), color: '#ef4444' }
      ].filter(item => parseFloat(item.value) > 0)
    }
  };
};

const calculatePagosCharts = (data) => {
  // Métodos de pago
  const efectivo = data.filter(p => 
    p.metodo_pago?.toLowerCase() === 'efectivo' || p.metodopago?.toLowerCase() === 'efectivo'
  ).length;
  const transferencia = data.filter(p => 
    p.metodo_pago?.toLowerCase() === 'transferencia' || p.metodopago?.toLowerCase() === 'transferencia'
  ).length;
  const tarjeta = data.filter(p => 
    p.metodo_pago?.toLowerCase() === 'tarjeta' || p.metodopago?.toLowerCase() === 'tarjeta'
  ).length;
  const otros = data.length - efectivo - transferencia - tarjeta;
  
  // Top 5 pagos más altos
  const topPagos = [...data]
    .sort((a, b) => (parseFloat(b.monto || b.valor) || 0) - (parseFloat(a.monto || a.valor) || 0))
    .slice(0, 5)
    .map(p => ({
      label: `${p.num_factura || 'N/A'}`,
      value: parseFloat(p.monto || p.valor) || 0,
      color: '#3b82f6'
    }));
  
  // Distribución de montos por método
  const montoEfectivo = data
    .filter(p => p.metodo_pago?.toLowerCase() === 'efectivo' || p.metodopago?.toLowerCase() === 'efectivo')
    .reduce((sum, p) => sum + (parseFloat(p.monto || p.valor) || 0), 0);
    
  const montoTransferencia = data
    .filter(p => p.metodo_pago?.toLowerCase() === 'transferencia' || p.metodopago?.toLowerCase() === 'transferencia')
    .reduce((sum, p) => sum + (parseFloat(p.monto || p.valor) || 0), 0);
    
  const montoTarjeta = data
    .filter(p => p.metodo_pago?.toLowerCase() === 'tarjeta' || p.metodopago?.toLowerCase() === 'tarjeta')
    .reduce((sum, p) => sum + (parseFloat(p.monto || p.valor) || 0), 0);
  
  return {
    barChart: {
      title: 'Top 5 Pagos Más Altos',
      data: topPagos
    },
    donutChart: {
      title: 'Métodos de Pago (Cantidad)',
      data: [
        { label: 'Efectivo', value: efectivo, color: '#10b981' },
        { label: 'Transferencia', value: transferencia, color: '#6366f1' },
        { label: 'Tarjeta', value: tarjeta, color: '#f59e0b' },
        { label: 'Otros', value: otros, color: '#8b5cf6' }
      ].filter(item => item.value > 0)
    },
    distribution: {
      title: 'Montos por Método de Pago',
      data: [
        { label: 'Efectivo', value: montoEfectivo.toFixed(2), color: '#10b981' },
        { label: 'Transferencia', value: montoTransferencia.toFixed(2), color: '#6366f1' },
        { label: 'Tarjeta', value: montoTarjeta.toFixed(2), color: '#f59e0b' }
      ].filter(item => parseFloat(item.value) > 0)
    }
  };
};

const calculateUsuariosCharts = (data) => {
  const activos = data.filter(u => u.activo === true || u.activo === 'Sí').length;
  const inactivos = data.length - activos;
  
  return {
    donutChart: {
      title: 'Estado de Usuarios',
      data: [
        { label: 'Activos', value: activos, color: '#22c55e' },
        { label: 'Inactivos', value: inactivos, color: '#ef4444' }
      ]
    }
  };
};

// ============================================================================
// FUNCIONES DE GENERACIÓN DE TABLAS
// ============================================================================

const generateLecturasTable = (data) => {
  // Tabla de resumen por sector
  const sectores = {};
  data.forEach(l => {
    const sector = l.sector || 'Sin sector';
    if (!sectores[sector]) {
      sectores[sector] = { count: 0, consumoTotal: 0 };
    }
    sectores[sector].count++;
    sectores[sector].consumoTotal += (l.consumo_m3 || 0);
  });
  
  const sectoresRows = Object.entries(sectores).map(([sector, stats]) => [
    sector,
    stats.count,
    `${stats.consumoTotal.toFixed(2)} m³`,
    `${(stats.consumoTotal / stats.count).toFixed(2)} m³`
  ]);
  
  return [{
    title: 'Resumen por Sector',
    headers: ['Sector', 'Lecturas', 'Consumo Total', 'Promedio'],
    rows: sectoresRows
  }];
};

const generateFacturasTable = (data) => {
  const totalFacturado = data.reduce((sum, f) => sum + (parseFloat(f.total) || 0), 0);
  const pagadas = data.filter(f => 
    f.estado?.toLowerCase() === 'pagada' || f.estado_factura?.toLowerCase() === 'pagada'
  );
  const pendientes = data.filter(f => 
    f.estado?.toLowerCase() === 'pendiente' || f.estado_factura?.toLowerCase() === 'pendiente'
  );
  const vencidas = data.filter(f => 
    f.estado?.toLowerCase() === 'vencida' || f.estado_factura?.toLowerCase() === 'vencida'
  );
  
  const montoPagado = pagadas.reduce((sum, f) => sum + (parseFloat(f.total) || 0), 0);
  const montoPendiente = pendientes.reduce((sum, f) => sum + (parseFloat(f.total) || 0), 0);
  const montoVencido = vencidas.reduce((sum, f) => sum + (parseFloat(f.total) || 0), 0);
  
  return [{
    title: 'Resumen de Facturación',
    headers: ['Estado', 'Cantidad', 'Monto Total', 'Promedio'],
    rows: [
      ['Pagadas', pagadas.length, `$${montoPagado.toFixed(2)}`, `$${(montoPagado / (pagadas.length || 1)).toFixed(2)}`],
      ['Pendientes', pendientes.length, `$${montoPendiente.toFixed(2)}`, `$${(montoPendiente / (pendientes.length || 1)).toFixed(2)}`],
      ['Vencidas', vencidas.length, `$${montoVencido.toFixed(2)}`, `$${(montoVencido / (vencidas.length || 1)).toFixed(2)}`],
      ['TOTAL', data.length, `$${totalFacturado.toFixed(2)}`, `$${(totalFacturado / data.length).toFixed(2)}`]
    ]
  }];
};

const generatePagosTable = (data) => {
  const totalRecaudado = data.reduce((sum, p) => sum + (parseFloat(p.monto || p.valor) || 0), 0);
  
  const efectivo = data.filter(p => 
    p.metodo_pago?.toLowerCase() === 'efectivo' || p.metodopago?.toLowerCase() === 'efectivo'
  );
  const transferencia = data.filter(p => 
    p.metodo_pago?.toLowerCase() === 'transferencia' || p.metodopago?.toLowerCase() === 'transferencia'
  );
  const tarjeta = data.filter(p => 
    p.metodo_pago?.toLowerCase() === 'tarjeta' || p.metodopago?.toLowerCase() === 'tarjeta'
  );
  
  const montoEfectivo = efectivo.reduce((sum, p) => sum + (parseFloat(p.monto || p.valor) || 0), 0);
  const montoTransferencia = transferencia.reduce((sum, p) => sum + (parseFloat(p.monto || p.valor) || 0), 0);
  const montoTarjeta = tarjeta.reduce((sum, p) => sum + (parseFloat(p.monto || p.valor) || 0), 0);
  
  return [{
    title: 'Resumen por Método de Pago',
    headers: ['Método', 'Cantidad', 'Monto Total', 'Promedio'],
    rows: [
      ['Efectivo', efectivo.length, `$${montoEfectivo.toFixed(2)}`, `$${(montoEfectivo / (efectivo.length || 1)).toFixed(2)}`],
      ['Transferencia', transferencia.length, `$${montoTransferencia.toFixed(2)}`, `$${(montoTransferencia / (transferencia.length || 1)).toFixed(2)}`],
      ['Tarjeta', tarjeta.length, `$${montoTarjeta.toFixed(2)}`, `$${(montoTarjeta / (tarjeta.length || 1)).toFixed(2)}`],
      ['TOTAL', data.length, `$${totalRecaudado.toFixed(2)}`, `$${(totalRecaudado / data.length).toFixed(2)}`]
    ]
  }];
};

const generateGenericTable = (data) => {
  return [{
    title: 'Resumen General',
    headers: ['Métrica', 'Valor'],
    rows: [
      ['Total Registros', data.length]
    ]
  }];
};

export default ReportStats;
