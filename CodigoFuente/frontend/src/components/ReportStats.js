// src/components/ReportStats.js
import React, { useState, useMemo } from 'react';
import { 
  BarChart3, PieChart , Activity, 
  ChevronDown, ChevronUp, Maximize2, X 
} from 'lucide-react';
import './ReportStats.css';

// Componente principal de Estadísticas del Reporte
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
              <pieChart  className="w-4 h-4" />
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
      {/* Gráfico de Barras Horizontales */}
      {chartData.horizontalBarChart && (
        <div className="chart-card">
          <h4 className="chart-title">{chartData.horizontalBarChart.title}</h4>
          <HorizontalBarChart data={chartData.horizontalBarChart.data} />
        </div>
      )}

      {/* Gráfico de Barras Verticales (original) */}
      {chartData.barChart && (
        <div className="chart-card">
          <h4 className="chart-title">{chartData.barChart.title}</h4>
          <BarChart data={chartData.barChart.data} />
        </div>
      )}


      {/* Gráfico de Pastel - USA EL NUEVO NOMBRE */}
      {chartData.pieChart && chartData.pieChart.data && chartData.pieChart.data.length > 0 && (
        <div className="chart-card">
          <h4 className="chart-title">{chartData.pieChart.title}</h4>
          <PieChartCustom data={chartData.pieChart.data} />
        </div>
      )}

      {/* Gráfico de Área */}
      {chartData.areaChart && chartData.areaChart.data && chartData.areaChart.data.length > 0 && (
        <div className="chart-card">
          <h4 className="chart-title">{chartData.areaChart.title}</h4>
          <AreaChart data={chartData.areaChart.data} />
        </div>
      )}

      {/* Gráfico de Barras Agrupadas */}
      {chartData.groupedBarChart && chartData.groupedBarChart.data && (
        <div className="chart-card">
          <h4 className="chart-title">{chartData.groupedBarChart.title}</h4>
          <GroupedBarChart data={chartData.groupedBarChart.data} />
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

      {/* Segunda Distribución */}
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


const PieChartCustom = ({ data }) => {
  const size = 200;
  const center = size / 2;
  const radius = 80;
  
  // Filtrar datos con valor > 0
  const validData = data.filter(item => item.value > 0);
  const total = validData.reduce((sum, d) => sum + d.value, 0);

  if (!total || total <= 0 || validData.length === 0) {
    return (
      <div className="chart-container">
        <p style={{ fontSize: 13, color: '#6b7280' }}>
          Sin datos suficientes para mostrar el gráfico.
        </p>
      </div>
    );
  }

  // Si solo hay UN valor, mostrar un círculo completo
  if (validData.length === 1) {
    return (
      <div className="chart-container">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Círculo completo para un solo valor */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill={validData[0].color || '#3b82f6'}
            stroke="#fff"
            strokeWidth="2"
          />
          
          {/* Texto en el centro */}
          <text
            x={center}
            y={center - 5}
            textAnchor="middle"
            fontSize="24"
            fontWeight="700"
            fill="#fff"
          >
            {validData[0].value}
          </text>
          <text
            x={center}
            y={center + 15}
            textAnchor="middle"
            fontSize="12"
            fill="#fff"
          >
            100%
          </text>
        </svg>

        <div className="chart-legend">
          {data.map((item, idx) => {
            const percentage = item.value > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0';
            return (
              <div key={idx} className="legend-item">
                <div
                  className="legend-color"
                  style={{ backgroundColor: item.color || `hsl(${idx * 60}, 70%, 60%)` }}
                />
                <span className="legend-label">{item.label}</span>
                <span className="legend-value">{item.value} ({percentage}%)</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Para múltiples valores, usar el gráfico de pastel normal
  let currentAngle = -90;

  return (
    <div className="chart-container">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {validData.map((item, idx) => {
          const percentage = (item.value / total) * 100;
          const angle = (percentage / 100) * 360;

          const startAngle = (currentAngle * Math.PI) / 180;
          const endAngle = ((currentAngle + angle) * Math.PI) / 180;

          const x1 = center + radius * Math.cos(startAngle);
          const y1 = center + radius * Math.sin(startAngle);
          const x2 = center + radius * Math.cos(endAngle);
          const y2 = center + radius * Math.sin(endAngle);

          // Si el ángulo es casi 360°, reducirlo ligeramente
          const largeArc = angle > 180 && angle < 359.99 ? 1 : 0;

          const pathData = [
            `M ${center} ${center}`,
            `L ${x1} ${y1}`,
            `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
            'Z'
          ].join(' ');

          currentAngle += angle;

          return (
            <path
              key={idx}
              d={pathData}
              fill={item.color || `hsl(${idx * 60}, 70%, 60%)`}
              stroke="#fff"
              strokeWidth="2"
              className="pie-segment"
            />
          );
        })}

        <circle cx={center} cy={center} r="3" fill="#fff" />
      </svg>

      <div className="chart-legend">
        {data.map((item, idx) => {
          const percentage = item.value > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0';
          return (
            <div key={idx} className="legend-item">
              <div
                className="legend-color"
                style={{ backgroundColor: item.color || `hsl(${idx * 60}, 70%, 60%)` }}
              />
              <span className="legend-label">{item.label}</span>
              <span className="legend-value">{item.value} ({percentage}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};


// Gráfico de Líneas
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

// Gráfico de Distribución
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

// Gráfico de Área (ideal para tendencias de consumo)
const AreaChart = ({ data }) => {
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
  
  // Crear path para la línea
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  
  // Crear path para el área (cerrar el polígono)
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${chartHeight - padding} L ${padding} ${chartHeight - padding} Z`;
  
  return (
    <div className="chart-container">
      <svg width="100%" height={chartHeight + 20} viewBox={`0 0 ${chartWidth} ${chartHeight + 20}`}>
        {/* Área rellena */}
        <path
          d={areaPath}
          fill="url(#areaGradient)"
          opacity="0.3"
        />
        
        {/* Gradiente para el área */}
        <defs>
          <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#3b82f6', stopOpacity: 0.8 }} />
            <stop offset="100%" style={{ stopColor: '#3b82f6', stopOpacity: 0.1 }} />
          </linearGradient>
        </defs>
        
        {/* Línea superior */}
        <path
          d={linePath}
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
            {/* Valor sobre el punto */}
            <text
              x={point.x}
              y={point.y - 10}
              textAnchor="middle"
              fontSize="10"
              fill="#374151"
              fontWeight="600"
            >
              {point.value}
            </text>
            {/* Label debajo del gráfico */}
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

// Gráfico de Columnas Agrupadas (ideal para comparar múltiples series)
const GroupedBarChart = ({ data }) => {
  const chartWidth = 400;
  const chartHeight = 200;
  const padding = 40;
  
  // Obtener todas las series y categorías
  const categories = data.map(d => d.category);
  const series = data[0]?.series || [];
  const maxValue = Math.max(...data.flatMap(d => d.series.map(s => s.value)));
  
  const barGroupWidth = (chartWidth - 2 * padding) / categories.length;
  const barWidth = (barGroupWidth * 0.8) / series.length;
  const barSpacing = barGroupWidth * 0.1;
  
  return (
    <div className="chart-container">
      <svg width="100%" height={chartHeight + 40} viewBox={`0 0 ${chartWidth} ${chartHeight + 40}`}>
        {/* Barras agrupadas */}
        {data.map((group, groupIdx) => {
          const groupX = padding + groupIdx * barGroupWidth;
          
          return (
            <g key={groupIdx}>
              {group.series.map((item, seriesIdx) => {
                const barHeight = (item.value / maxValue) * (chartHeight - 2 * padding);
                const x = groupX + barSpacing + seriesIdx * barWidth;
                const y = chartHeight - padding - barHeight;
                
                return (
                  <g key={seriesIdx}>
                    {/* Barra */}
                    <rect
                      x={x}
                      y={y}
                      width={barWidth - 2}
                      height={barHeight}
                      fill={item.color || `hsl(${seriesIdx * 120}, 70%, 60%)`}
                      rx="4"
                      className="bar-animated"
                    />
                    {/* Valor sobre la barra */}
                    <text
                      x={x + (barWidth - 2) / 2}
                      y={y - 5}
                      textAnchor="middle"
                      fontSize="10"
                      fill="#374151"
                      fontWeight="600"
                    >
                      {item.value}
                    </text>
                  </g>
                );
              })}
              
              {/* Label de categoría */}
              <text
                x={groupX + barGroupWidth / 2}
                y={chartHeight + 5}
                textAnchor="middle"
                fontSize="11"
                fill="#6b7280"
              >
                {group.category}
              </text>
            </g>
          );
        })}
      </svg>
      
      {/* Leyenda */}
      <div className="chart-legend">
        {series.map((item, idx) => (
          <div key={idx} className="legend-item">
            <div
              className="legend-color"
              style={{ backgroundColor: item.color || `hsl(${idx * 120}, 70%, 60%)` }}
            />
            <span className="legend-label">{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Gráfico de Barras Horizontales (ideal para rankings y comparaciones)
const HorizontalBarChart = ({ data }) => {
  const chartWidth = 400;
  const chartHeight = Math.max(200, data.length * 40);
  const padding = { top: 20, right: 60, bottom: 20, left: 120 };
  
  const maxValue = Math.max(...data.map(d => d.value));
  const barHeight = 25;
  const barSpacing = 15;
  
  return (
    <div className="chart-container">
      <svg 
        width="100%" 
        height={chartHeight} 
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {data.map((item, idx) => {
          const barWidth = ((item.value / maxValue) * (chartWidth - padding.left - padding.right));
          const y = padding.top + idx * (barHeight + barSpacing);
          
          return (
            <g key={idx}>
              {/* Fondo de la barra (guía) */}
              <rect
                x={padding.left}
                y={y}
                width={chartWidth - padding.left - padding.right}
                height={barHeight}
                fill="#f3f4f6"
                rx="4"
              />
              
              {/* Barra de valor */}
              <rect
                x={padding.left}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={item.color || '#3b82f6'}
                rx="4"
                className="bar-animated"
              />
              
              {/* Label del item (izquierda) */}
              <text
                x={padding.left - 10}
                y={y + barHeight / 2}
                textAnchor="end"
                fontSize="12"
                fill="#374151"
                dominantBaseline="middle"
              >
                {item.label}
              </text>
              
              {/* Valor (derecha de la barra) */}
              <text
                x={padding.left + barWidth + 5}
                y={y + barHeight / 2}
                textAnchor="start"
                fontSize="12"
                fill="#374151"
                fontWeight="600"
                dominantBaseline="middle"
              >
                {item.value}
              </text>
            </g>
          );
        })}
      </svg>
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
  
  // Top 5 consumos (Barra Horizontal)
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
  
  const sectoresData = Object.entries(sectores).map(([label, value], idx) => ({
    label,
    value,
    color: `hsl(${idx * 60}, 70%, 60%)`
  }));
  
  // Consumo promedio por mes (últimos 6 meses) - Para AreaChart
  const consumoPorMes = {};
  data.forEach(l => {
    if (l.fecha_lectura) {
      const fecha = new Date(l.fecha_lectura);
      const mes = fecha.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
      consumoPorMes[mes] = (consumoPorMes[mes] || 0) + (l.consumo_m3 || 0);
    }
  });
  
  const consumoMensual = Object.entries(consumoPorMes)
    .slice(-6)
    .map(([label, value]) => ({
      label,
      value: Math.round(value)
    }));
  
  // Comparación por rango de consumo - Para GroupedBarChart
  const rangos = [
    { min: 0, max: 10, label: '0-10' },
    { min: 10, max: 20, label: '10-20' },
    { min: 20, max: 50, label: '20-50' },
    { min: 50, max: Infinity, label: '50+' }
  ];
  
  const rangoData = rangos.map(rango => {
    const realesEnRango = data.filter(l => 
      l.tipo_lectura === 'Real' && 
      l.consumo_m3 >= rango.min && 
      l.consumo_m3 < rango.max
    ).length;
    
    const estimadasEnRango = data.filter(l => 
      l.tipo_lectura === 'Estimada' && 
      l.consumo_m3 >= rango.min && 
      l.consumo_m3 < rango.max
    ).length;
    
    return {
      category: rango.label + ' m³',
      series: [
        { name: 'Reales', value: realesEnRango, color: '#22c55e' },
        { name: 'Estimadas', value: estimadasEnRango, color: '#f97316' }
      ]
    };
  });
  
  return {
    horizontalBarChart: {
      title: 'Top 5 Mayores Consumos',
      data: topConsumos
    },
    pieChart: {
      title: 'Distribución por Tipo',
      data: [
        { label: 'Reales', value: reales, color: '#22c55e' },
        { label: 'Estimadas', value: estimadas, color: '#f97316' }
      ]
    },
    distribution: {
      title: 'Lecturas por Sector',
      data: sectoresData
    },
    areaChart: {
      title: 'Consumo Mensual (m³)',
      data: consumoMensual.length > 0 ? consumoMensual : [
        { label: 'Sin datos', value: 0 }
      ]
    },
    groupedBarChart: {
      title: 'Lecturas por Rango de Consumo',
      data: rangoData,
      series: [
        { name: 'Reales', color: '#22c55e' },
        { name: 'Estimadas', color: '#f97316' }
      ]
    }
  };
};

const calculateFacturasCharts = (data) => {
  // Estados de facturas
  const pagadas = data.filter(f => 
    f.estado?.toLowerCase() === 'pagada' || f.estado_factura?.toLowerCase() === 'pagada'
  );
  const pendientes = data.filter(f => 
    f.estado?.toLowerCase() === 'pendiente' || f.estado_factura?.toLowerCase() === 'pendiente'
  );
  const vencidas = data.filter(f => 
    f.estado?.toLowerCase() === 'vencida' || f.estado_factura?.toLowerCase() === 'vencida'
  );
  
  // Calcular montos
  const montoPagado = pagadas.reduce((sum, f) => sum + (parseFloat(f.total) || 0), 0);
  const montoPendiente = pendientes.reduce((sum, f) => sum + (parseFloat(f.total) || 0), 0);
  const montoVencido = vencidas.reduce((sum, f) => sum + (parseFloat(f.total) || 0), 0);
  
  // Top 10 facturas más altas (Barra Horizontal)
  const topFacturas = [...data]
    .sort((a, b) => (parseFloat(b.total) || 0) - (parseFloat(a.total) || 0))
    .slice(0, 10)
    .map(f => ({
      label: f.num_factura || 'N/A',
      value: parseFloat(f.total) || 0,
      color: '#3b82f6'
    }));
  
  // Facturación mensual (últimos 6 meses) - Para AreaChart
  const facturasPorMes = {};
  data.forEach(f => {
    if (f.fecha_emision || f.fecha_factura) {
      const fecha = new Date(f.fecha_emision || f.fecha_factura);
      const mes = fecha.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
      facturasPorMes[mes] = (facturasPorMes[mes] || 0) + (parseFloat(f.total) || 0);
    }
  });
  
  const facturacionMensual = Object.entries(facturasPorMes)
    .slice(-6)
    .map(([label, value]) => ({
      label,
      value: Math.round(value)
    }));
  
  // Comparación de estados por rango de monto - Para GroupedBarChart
  const rangos = [
    { min: 0, max: 50, label: '$0-50' },
    { min: 50, max: 100, label: '$50-100' },
    { min: 100, max: 200, label: '$100-200' },
    { min: 200, max: 500, label: '$200-500' },
    { min: 500, max: Infinity, label: '$500+' }
  ];
  
  const rangoData = rangos.map(rango => {
    const pagadasEnRango = pagadas.filter(f => {
      const total = parseFloat(f.total) || 0;
      return total >= rango.min && total < rango.max;
    }).length;
    
    const pendientesEnRango = pendientes.filter(f => {
      const total = parseFloat(f.total) || 0;
      return total >= rango.min && total < rango.max;
    }).length;
    
    const vencidasEnRango = vencidas.filter(f => {
      const total = parseFloat(f.total) || 0;
      return total >= rango.min && total < rango.max;
    }).length;
    
    return {
      category: rango.label,
      series: [
        { name: 'Pagadas', value: pagadasEnRango, color: '#22c55e' },
        { name: 'Pendientes', value: pendientesEnRango, color: '#f97316' },
        { name: 'Vencidas', value: vencidasEnRango, color: '#ef4444' }
      ]
    };
  });
  
  // Distribución por sector/zona (si existe)
  const facturasPorSector = {};
  data.forEach(f => {
    const sector = f.sector || f.zona || 'Sin sector';
    if (!facturasPorSector[sector]) {
      facturasPorSector[sector] = 0;
    }
    facturasPorSector[sector] += (parseFloat(f.total) || 0);
  });
  
  const sectoresData = Object.entries(facturasPorSector)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, value]) => ({
      label,
      value: Math.round(value)
    }));
  
  return {
    horizontalBarChart: {
      title: 'Top 10 Facturas Más Altas',
      data: topFacturas
    },
    pieChart: {
      title: 'Distribución por Estado (Cantidad)',
      data: [
        { label: 'Pagadas', value: pagadas.length, color: '#22c55e' },
        { label: 'Pendientes', value: pendientes.length, color: '#f97316' },
        { label: 'Vencidas', value: vencidas.length, color: '#ef4444' }
      ].filter(item => item.value > 0)
    },
    distribution: {
      title: 'Montos por Estado ($)',
      data: [
        { label: 'Pagado', value: montoPagado.toFixed(2), color: '#22c55e' },
        { label: 'Pendiente', value: montoPendiente.toFixed(2), color: '#f97316' },
        { label: 'Vencido', value: montoVencido.toFixed(2), color: '#ef4444' }
      ].filter(item => parseFloat(item.value) > 0)
    },
    areaChart: {
      title: 'Facturación Mensual ($)',
      data: facturacionMensual.length > 0 ? facturacionMensual : [
        { label: 'Sin datos', value: 0 }
      ]
    },
    groupedBarChart: {
      title: 'Estados por Rango de Monto',
      data: rangoData,
      series: [
        { name: 'Pagadas', color: '#22c55e' },
        { name: 'Pendientes', color: '#f97316' },
        { name: 'Vencidas', color: '#ef4444' }
      ]
    },
    distribution2: sectoresData.length > 0 ? {
      title: 'Facturación por Sector ($)',
      data: sectoresData
    } : null
  };
};


const calculatePagosCharts = (data) => {
  // Métodos de pago
  const efectivo = data.filter(p => 
    p.metodo_pago?.toLowerCase() === 'efectivo' || p.metodopago?.toLowerCase() === 'efectivo'
  );
  const transferencia = data.filter(p => 
    p.metodo_pago?.toLowerCase() === 'transferencia' || p.metodopago?.toLowerCase() === 'transferencia'
  );
  const tarjeta = data.filter(p => 
    p.metodo_pago?.toLowerCase() === 'tarjeta' || p.metodopago?.toLowerCase() === 'tarjeta'
  );
  const otros = data.filter(p => {
    const metodo = (p.metodo_pago || p.metodopago || '').toLowerCase();
    return metodo !== 'efectivo' && metodo !== 'transferencia' && metodo !== 'tarjeta' && metodo !== '';
  });
  
  // Calcular montos
  const montoEfectivo = efectivo.reduce((sum, p) => sum + (parseFloat(p.monto || p.valor) || 0), 0);
  const montoTransferencia = transferencia.reduce((sum, p) => sum + (parseFloat(p.monto || p.valor) || 0), 0);
  const montoTarjeta = tarjeta.reduce((sum, p) => sum + (parseFloat(p.monto || p.valor) || 0), 0);
  const montoOtros = otros.reduce((sum, p) => sum + (parseFloat(p.monto || p.valor) || 0), 0);
  
  // Top 10 pagos más altos (Barra Horizontal)
  const topPagos = [...data]
    .sort((a, b) => (parseFloat(b.monto || b.valor) || 0) - (parseFloat(a.monto || a.valor) || 0))
    .slice(0, 10)
    .map(p => ({
      label: p.num_factura || p.numero_recibo || 'N/A',
      value: parseFloat(p.monto || p.valor) || 0,
      color: '#3b82f6'
    }));
  
  // Recaudación mensual (últimos 6 meses) - Para AreaChart
  const pagosPorMes = {};
  data.forEach(p => {
    if (p.fecha_pago || p.fecha) {
      const fecha = new Date(p.fecha_pago || p.fecha);
      const mes = fecha.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
      pagosPorMes[mes] = (pagosPorMes[mes] || 0) + (parseFloat(p.monto || p.valor) || 0);
    }
  });
  
  const recaudacionMensual = Object.entries(pagosPorMes)
    .slice(-6)
    .map(([label, value]) => ({
      label,
      value: Math.round(value)
    }));
  
  // Comparación de métodos por rango de monto - Para GroupedBarChart
  const rangos = [
    { min: 0, max: 50, label: '$0-50' },
    { min: 50, max: 100, label: '$50-100' },
    { min: 100, max: 200, label: '$100-200' },
    { min: 200, max: 500, label: '$200-500' },
    { min: 500, max: Infinity, label: '$500+' }
  ];
  
  const rangoData = rangos.map(rango => {
    const efectivoEnRango = efectivo.filter(p => {
      const monto = parseFloat(p.monto || p.valor) || 0;
      return monto >= rango.min && monto < rango.max;
    }).length;
    
    const transferenciaEnRango = transferencia.filter(p => {
      const monto = parseFloat(p.monto || p.valor) || 0;
      return monto >= rango.min && monto < rango.max;
    }).length;
    
    const tarjetaEnRango = tarjeta.filter(p => {
      const monto = parseFloat(p.monto || p.valor) || 0;
      return monto >= rango.min && monto < rango.max;
    }).length;
    
    return {
      category: rango.label,
      series: [
        { name: 'Efectivo', value: efectivoEnRango, color: '#10b981' },
        { name: 'Transferencia', value: transferenciaEnRango, color: '#6366f1' },
        { name: 'Tarjeta', value: tarjetaEnRango, color: '#f59e0b' }
      ]
    };
  });
  
  // Recaudación por día de la semana
  const pagosPorDia = {
    'Lun': 0, 'Mar': 0, 'Mié': 0, 'Jue': 0, 'Vie': 0, 'Sáb': 0, 'Dom': 0
  };
  const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  
  data.forEach(p => {
    if (p.fecha_pago || p.fecha) {
      const fecha = new Date(p.fecha_pago || p.fecha);
      const dia = dias[fecha.getDay()];
      pagosPorDia[dia] = (pagosPorDia[dia] || 0) + (parseFloat(p.monto || p.valor) || 0);
    }
  });
  
  const diasData = Object.entries(pagosPorDia)
    .filter(([_, value]) => value > 0)
    .map(([label, value]) => ({
      label,
      value: Math.round(value)
    }));
  
  return {
    horizontalBarChart: {
      title: 'Top 10 Pagos Más Altos',
      data: topPagos
    },
    pieChart: {
      title: 'Distribución por Método (Cantidad)',
      data: [
        { label: 'Efectivo', value: efectivo.length, color: '#10b981' },
        { label: 'Transferencia', value: transferencia.length, color: '#6366f1' },
        { label: 'Tarjeta', value: tarjeta.length, color: '#f59e0b' },
        { label: 'Otros', value: otros.length, color: '#8b5cf6' }
      ].filter(item => item.value > 0)
    },
    distribution: {
      title: 'Montos por Método de Pago ($)',
      data: [
        { label: 'Efectivo', value: montoEfectivo.toFixed(2), color: '#10b981' },
        { label: 'Transferencia', value: montoTransferencia.toFixed(2), color: '#6366f1' },
        { label: 'Tarjeta', value: montoTarjeta.toFixed(2), color: '#f59e0b' },
        { label: 'Otros', value: montoOtros.toFixed(2), color: '#8b5cf6' }
      ].filter(item => parseFloat(item.value) > 0)
    },
    areaChart: {
      title: 'Recaudación Mensual ($)',
      data: recaudacionMensual.length > 0 ? recaudacionMensual : [
        { label: 'Sin datos', value: 0 }
      ]
    },
    groupedBarChart: {
      title: 'Métodos por Rango de Monto',
      data: rangoData,
      series: [
        { name: 'Efectivo', color: '#10b981' },
        { name: 'Transferencia', color: '#6366f1' },
        { name: 'Tarjeta', color: '#f59e0b' }
      ]
    },
    barChart: diasData.length > 0 ? {
      title: 'Recaudación por Día de la Semana',
      data: diasData.map(d => ({ ...d, color: '#3b82f6' }))
    } : null
  };
};



const calculateUsuariosCharts = (data) => {
  const activos = data.filter(u => u.activo === true || u.activo === 'Sí').length;
  const inactivos = data.length - activos;
  
  return {
    pieChart: {
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
  const tables = [];
  
  // ============================================
  // TABLA 1: Resumen por Sector
  // ============================================
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
  
  tables.push({
    title: 'Resumen por Sector',
    headers: ['Sector', 'Lecturas', 'Consumo Total', 'Promedio'],
    rows: sectoresRows
  });
  
  // ============================================
  // TABLA 2: Comparación Real vs Estimada
  // ============================================
  const reales = data.filter(l => l.tipo_lectura === 'Real');
  const estimadas = data.filter(l => l.tipo_lectura === 'Estimada');
  
  const consumoReales = reales.reduce((sum, l) => sum + (l.consumo_m3 || 0), 0);
  const consumoEstimadas = estimadas.reduce((sum, l) => sum + (l.consumo_m3 || 0), 0);
  
  tables.push({
    title: 'Comparación por Tipo de Lectura',
    headers: ['Tipo', 'Cantidad', 'Consumo Total', 'Consumo Promedio', '% del Total'],
    rows: [
      [
        'Reales',
        reales.length,
        `${consumoReales.toFixed(2)} m³`,
        `${reales.length > 0 ? (consumoReales / reales.length).toFixed(2) : '0.00'} m³`,
        `${((reales.length / data.length) * 100).toFixed(1)}%`
      ],
      [
        'Estimadas',
        estimadas.length,
        `${consumoEstimadas.toFixed(2)} m³`,
        `${estimadas.length > 0 ? (consumoEstimadas / estimadas.length).toFixed(2) : '0.00'} m³`,
        `${((estimadas.length / data.length) * 100).toFixed(1)}%`
      ],
      [
        'TOTAL',
        data.length,
        `${(consumoReales + consumoEstimadas).toFixed(2)} m³`,
        `${((consumoReales + consumoEstimadas) / data.length).toFixed(2)} m³`,
        '100%'
      ]
    ]
  });
  
  // ============================================
  // TABLA 3: Rangos de Consumo
  // ============================================
  const rangos = [
    { min: 0, max: 5, label: 'Muy Bajo (0-5 m³)' },
    { min: 5, max: 10, label: 'Bajo (5-10 m³)' },
    { min: 10, max: 20, label: 'Normal (10-20 m³)' },
    { min: 20, max: 50, label: 'Alto (20-50 m³)' },
    { min: 50, max: Infinity, label: 'Muy Alto (50+ m³)' }
  ];
  
  const rangosRows = rangos.map(rango => {
    const lecturas = data.filter(l => 
      (l.consumo_m3 || 0) >= rango.min && (l.consumo_m3 || 0) < rango.max
    );
    const porcentaje = ((lecturas.length / data.length) * 100).toFixed(1);
    const consumoTotal = lecturas.reduce((sum, l) => sum + (l.consumo_m3 || 0), 0);
    
    return [
      rango.label,
      lecturas.length,
      `${porcentaje}%`,
      `${consumoTotal.toFixed(2)} m³`
    ];
  });
  
  tables.push({
    title: 'Distribución por Rangos de Consumo',
    headers: ['Rango', 'Cantidad', '% del Total', 'Consumo Total'],
    rows: rangosRows
  });
  
  // ============================================
  // TABLA 4: Top 10 Mayores Consumos
  // ============================================
  const topConsumos = [...data]
    .sort((a, b) => (b.consumo_m3 || 0) - (a.consumo_m3 || 0))
    .slice(0, 10)
    .map((l, idx) => [
      idx + 1,
      l.nombres || 'N/A',
      l.direccion || 'N/A',
      l.sector || 'N/A',
      `${(l.consumo_m3 || 0).toFixed(2)} m³`,
      l.tipo_lectura || 'N/A'
    ]);
  
  tables.push({
    title: 'Top 10 Mayores Consumos',
    headers: ['#', 'Usuario', 'Dirección', 'Sector', 'Consumo', 'Tipo'],
    rows: topConsumos.length > 0 ? topConsumos : [['Sin datos', '', '', '', '', '']]
  });
  
  
  // ============================================
  // TABLA 6: Estadísticas Generales
  // ============================================
  const consumos = data.map(l => l.consumo_m3 || 0).filter(c => c > 0);
  const consumoTotal = consumos.reduce((sum, c) => sum + c, 0);
  const consumoPromedio = consumos.length > 0 ? consumoTotal / consumos.length : 0;
  const consumoMax = Math.max(...consumos, 0);
  const consumoMin = Math.min(...consumos.filter(c => c > 0), 0);
  
  // Calcular mediana
  const consumosOrdenados = [...consumos].sort((a, b) => a - b);
  const mediana = consumosOrdenados.length > 0
    ? consumosOrdenados.length % 2 === 0
      ? (consumosOrdenados[consumosOrdenados.length / 2 - 1] + consumosOrdenados[consumosOrdenados.length / 2]) / 2
      : consumosOrdenados[Math.floor(consumosOrdenados.length / 2)]
    : 0;
  
  tables.push({
    title: 'Estadísticas Generales',
    headers: ['Métrica', 'Valor'],
    rows: [
      ['Total de Lecturas', data.length],
      ['Consumo Total', `${consumoTotal.toFixed(2)} m³`],
      ['Consumo Promedio', `${consumoPromedio.toFixed(2)} m³`],
      ['Consumo Mediano', `${mediana.toFixed(2)} m³`],
      ['Consumo Máximo', `${consumoMax.toFixed(2)} m³`],
      ['Consumo Mínimo', `${consumoMin.toFixed(2)} m³`],
      ['Lecturas Reales', `${reales.length} (${((reales.length / data.length) * 100).toFixed(1)}%)`],
      ['Lecturas Estimadas', `${estimadas.length} (${((estimadas.length / data.length) * 100).toFixed(1)}%)`],
      ['Sectores Únicos', Object.keys(sectores).length]
    ]
  });
  
  
  return tables;
};


const generateFacturasTable = (data) => {
  const tables = [];
  
  // Filtrar por estado
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
  const totalFacturado = montoPagado + montoPendiente + montoVencido;
  
  // ============================================
  // TABLA 1: Resumen de Facturación
  // ============================================
  tables.push({
    title: 'Resumen de Facturación',
    headers: ['Estado', 'Cantidad', 'Monto Total', 'Promedio', '% del Total'],
    rows: [
      [
        'Pagadas',
        pagadas.length,
        `$${montoPagado.toFixed(2)}`,
        `$${(montoPagado / (pagadas.length || 1)).toFixed(2)}`,
        `${((montoPagado / totalFacturado) * 100).toFixed(1)}%`
      ],
      [
        'Pendientes',
        pendientes.length,
        `$${montoPendiente.toFixed(2)}`,
        `$${(montoPendiente / (pendientes.length || 1)).toFixed(2)}`,
        `${((montoPendiente / totalFacturado) * 100).toFixed(1)}%`
      ],
      [
        'Vencidas',
        vencidas.length,
        `$${montoVencido.toFixed(2)}`,
        `$${(montoVencido / (vencidas.length || 1)).toFixed(2)}`,
        `${((montoVencido / totalFacturado) * 100).toFixed(1)}%`
      ],
      [
        'TOTAL',
        data.length,
        `$${totalFacturado.toFixed(2)}`,
        `$${(totalFacturado / data.length).toFixed(2)}`,
        '100%'
      ]
    ]
  });
  
  // ============================================
  // TABLA 2: Rangos de Montos
  // ============================================
  const rangos = [
    { min: 0, max: 50, label: 'Muy Bajo ($0-50)' },
    { min: 50, max: 100, label: 'Bajo ($50-100)' },
    { min: 100, max: 200, label: 'Normal ($100-200)' },
    { min: 200, max: 500, label: 'Alto ($200-500)' },
    { min: 500, max: Infinity, label: 'Muy Alto ($500+)' }
  ];
  
  const rangosRows = rangos.map(rango => {
    const facturas = data.filter(f => {
      const total = parseFloat(f.total) || 0;
      return total >= rango.min && total < rango.max;
    });
    const porcentaje = ((facturas.length / data.length) * 100).toFixed(1);
    const montoTotal = facturas.reduce((sum, f) => sum + (parseFloat(f.total) || 0), 0);
    
    return [
      rango.label,
      facturas.length,
      `${porcentaje}%`,
      `$${montoTotal.toFixed(2)}`
    ];
  });
  
  tables.push({
    title: 'Distribución por Rangos de Monto',
    headers: ['Rango', 'Cantidad', '% del Total', 'Monto Total'],
    rows: rangosRows
  });
  
  // ============================================
  // TABLA 3: Top 10 Facturas Pendientes
  // ============================================
  const topPendientes = pendientes
    .sort((a, b) => (parseFloat(b.total) || 0) - (parseFloat(a.total) || 0))
    .slice(0, 10)
    .map((f, idx) => [
      idx + 1,
      f.num_factura || 'N/A',
      f.nombres || f.cliente || 'N/A',
      `$${(parseFloat(f.total) || 0).toFixed(2)}`,
      f.fecha_emision || f.fecha_factura || 'N/A',
      f.fecha_vencimiento || 'N/A'
    ]);
  
  if (topPendientes.length > 0) {
    tables.push({
      title: 'Top 10 Facturas Pendientes',
      headers: ['#', 'N° Factura', 'Cliente', 'Monto', 'Fecha Emisión', 'Vencimiento'],
      rows: topPendientes
    });
  }
  
  // ============================================
  // TABLA 4: Top 10 Facturas Vencidas
  // ============================================
  const topVencidas = vencidas
    .sort((a, b) => (parseFloat(b.total) || 0) - (parseFloat(a.total) || 0))
    .slice(0, 10)
    .map((f, idx) => {
      const fechaVenc = f.fecha_vencimiento ? new Date(f.fecha_vencimiento) : null;
      const diasVencidos = fechaVenc ? Math.floor((new Date() - fechaVenc) / (1000 * 60 * 60 * 24)) : 0;
      
      return [
        idx + 1,
        f.num_factura || 'N/A',
        f.nombres || f.cliente || 'N/A',
        `$${(parseFloat(f.total) || 0).toFixed(2)}`,
        f.fecha_vencimiento || 'N/A',
        diasVencidos > 0 ? `${diasVencidos} días` : 'N/A'
      ];
    });
  
  if (topVencidas.length > 0) {
    tables.push({
      title: 'Top 10 Facturas Vencidas',
      headers: ['#', 'N° Factura', 'Cliente', 'Monto', 'Vencimiento', 'Días Vencidos'],
      rows: topVencidas
    });
  }
  
  // ============================================
  // TABLA 5: Facturación por Mes
  // ============================================
  const meses = {};
  data.forEach(f => {
    if (f.fecha_emision || f.fecha_factura) {
      const fecha = new Date(f.fecha_emision || f.fecha_factura);
      const mes = fecha.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
      
      if (!meses[mes]) {
        meses[mes] = { count: 0, monto: 0, pagadas: 0, pendientes: 0, vencidas: 0 };
      }
      
      meses[mes].count++;
      meses[mes].monto += (parseFloat(f.total) || 0);
      
      const estado = (f.estado || f.estado_factura || '').toLowerCase();
      if (estado === 'pagada') meses[mes].pagadas++;
      else if (estado === 'pendiente') meses[mes].pendientes++;
      else if (estado === 'vencida') meses[mes].vencidas++;
    }
  });
  
  const mesesRows = Object.entries(meses)
    .sort((a, b) => new Date(b[0]) - new Date(a[0]))
    .slice(0, 6)
    .map(([mes, stats]) => [
      mes,
      stats.count,
      `$${stats.monto.toFixed(2)}`,
      `$${(stats.monto / stats.count).toFixed(2)}`,
      stats.pagadas,
      stats.pendientes,
      stats.vencidas
    ]);
  
  if (mesesRows.length > 0) {
    tables.push({
      title: 'Facturación por Mes (Últimos 6 Meses)',
      headers: ['Mes', 'Total', 'Monto', 'Promedio', 'Pagadas', 'Pendientes', 'Vencidas'],
      rows: mesesRows
    });
  }
  
  // ============================================
  // TABLA 6: Estadísticas Generales
  // ============================================
  const montos = data.map(f => parseFloat(f.total) || 0).filter(m => m > 0);
  const montoPromedio = montos.length > 0 ? montos.reduce((a, b) => a + b, 0) / montos.length : 0;
  const montoMax = Math.max(...montos, 0);
  const montoMin = Math.min(...montos.filter(m => m > 0), 0);
  
  // Calcular mediana
  const montosOrdenados = [...montos].sort((a, b) => a - b);
  const mediana = montosOrdenados.length > 0
    ? montosOrdenados.length % 2 === 0
      ? (montosOrdenados[montosOrdenados.length / 2 - 1] + montosOrdenados[montosOrdenados.length / 2]) / 2
      : montosOrdenados[Math.floor(montosOrdenados.length / 2)]
    : 0;
  
  // Tasa de cobro
  const tasaCobro = data.length > 0 ? ((pagadas.length / data.length) * 100).toFixed(1) : 0;
  const tasaMorosidad = data.length > 0 ? ((vencidas.length / data.length) * 100).toFixed(1) : 0;
  
  tables.push({
    title: 'Estadísticas Generales',
    headers: ['Métrica', 'Valor'],
    rows: [
      ['Total de Facturas', data.length],
      ['Facturación Total', `$${totalFacturado.toFixed(2)}`],
      ['Monto Promedio', `$${montoPromedio.toFixed(2)}`],
      ['Monto Mediano', `$${mediana.toFixed(2)}`],
      ['Monto Máximo', `$${montoMax.toFixed(2)}`],
      ['Monto Mínimo', `$${montoMin.toFixed(2)}`],
      ['Tasa de Cobro', `${tasaCobro}%`],
      ['Tasa de Morosidad', `${tasaMorosidad}%`],
      ['Por Cobrar', `$${(montoPendiente + montoVencido).toFixed(2)}`]
    ]
  });
  
  return tables;
};

const generatePagosTable = (data) => {
  const tables = [];
  
  // Filtrar por método
  const efectivo = data.filter(p => 
    p.metodo_pago?.toLowerCase() === 'efectivo' || p.metodopago?.toLowerCase() === 'efectivo'
  );
  const transferencia = data.filter(p => 
    p.metodo_pago?.toLowerCase() === 'transferencia' || p.metodopago?.toLowerCase() === 'transferencia'
  );
  const tarjeta = data.filter(p => 
    p.metodo_pago?.toLowerCase() === 'tarjeta' || p.metodopago?.toLowerCase() === 'tarjeta'
  );
  const otros = data.filter(p => {
    const metodo = (p.metodo_pago || p.metodopago || '').toLowerCase();
    return metodo !== 'efectivo' && metodo !== 'transferencia' && metodo !== 'tarjeta' && metodo !== '';
  });
  
  const montoEfectivo = efectivo.reduce((sum, p) => sum + (parseFloat(p.monto || p.valor) || 0), 0);
  const montoTransferencia = transferencia.reduce((sum, p) => sum + (parseFloat(p.monto || p.valor) || 0), 0);
  const montoTarjeta = tarjeta.reduce((sum, p) => sum + (parseFloat(p.monto || p.valor) || 0), 0);
  const montoOtros = otros.reduce((sum, p) => sum + (parseFloat(p.monto || p.valor) || 0), 0);
  const totalRecaudado = montoEfectivo + montoTransferencia + montoTarjeta + montoOtros;
  
  // ============================================
  // TABLA 1: Resumen por Método de Pago
  // ============================================
  tables.push({
    title: 'Resumen por Método de Pago',
    headers: ['Método', 'Cantidad', 'Monto Total', 'Promedio', '% del Total'],
    rows: [
      [
        'Efectivo',
        efectivo.length,
        `$${montoEfectivo.toFixed(2)}`,
        `$${(montoEfectivo / (efectivo.length || 1)).toFixed(2)}`,
        `${totalRecaudado > 0 ? ((montoEfectivo / totalRecaudado) * 100).toFixed(1) : 0}%`
      ],
      [
        'Transferencia',
        transferencia.length,
        `$${montoTransferencia.toFixed(2)}`,
        `$${(montoTransferencia / (transferencia.length || 1)).toFixed(2)}`,
        `${totalRecaudado > 0 ? ((montoTransferencia / totalRecaudado) * 100).toFixed(1) : 0}%`
      ],
      [
        'Tarjeta',
        tarjeta.length,
        `$${montoTarjeta.toFixed(2)}`,
        `$${(montoTarjeta / (tarjeta.length || 1)).toFixed(2)}`,
        `${totalRecaudado > 0 ? ((montoTarjeta / totalRecaudado) * 100).toFixed(1) : 0}%`
      ],
      [
        'Otros',
        otros.length,
        `$${montoOtros.toFixed(2)}`,
        `$${(montoOtros / (otros.length || 1)).toFixed(2)}`,
        `${totalRecaudado > 0 ? ((montoOtros / totalRecaudado) * 100).toFixed(1) : 0}%`
      ],
      [
        'TOTAL',
        data.length,
        `$${totalRecaudado.toFixed(2)}`,
        `$${(totalRecaudado / (data.length || 1)).toFixed(2)}`,
        '100%'
      ]
    ]
  });
  
  // ============================================
  // TABLA 2: Rangos de Montos
  // ============================================
  const rangos = [
    { min: 0, max: 50, label: 'Muy Bajo ($0-50)' },
    { min: 50, max: 100, label: 'Bajo ($50-100)' },
    { min: 100, max: 200, label: 'Normal ($100-200)' },
    { min: 200, max: 500, label: 'Alto ($200-500)' },
    { min: 500, max: Infinity, label: 'Muy Alto ($500+)' }
  ];
  
  const rangosRows = rangos.map(rango => {
    const pagos = data.filter(p => {
      const monto = parseFloat(p.monto || p.valor) || 0;
      return monto >= rango.min && monto < rango.max;
    });
    const porcentaje = data.length > 0 ? ((pagos.length / data.length) * 100).toFixed(1) : '0.0';
    const montoTotal = pagos.reduce((sum, p) => sum + (parseFloat(p.monto || p.valor) || 0), 0);
    
    return [
      rango.label,
      pagos.length,
      `${porcentaje}%`,
      `$${montoTotal.toFixed(2)}`
    ];
  });
  
  tables.push({
    title: 'Distribución por Rangos de Monto',
    headers: ['Rango', 'Cantidad', '% del Total', 'Monto Total'],
    rows: rangosRows
  });
  
  // ============================================
  // TABLA 3: Top 10 Pagos Más Altos
  // ============================================
  const topPagos = [...data]
    .sort((a, b) => (parseFloat(b.monto || b.valor) || 0) - (parseFloat(a.monto || a.valor) || 0))
    .slice(0, 10)
    .map((p, idx) => [
      idx + 1,
      p.num_factura || p.numero_recibo || 'N/A',
      p.nombres || p.cliente || 'N/A',
      `$${(parseFloat(p.monto || p.valor) || 0).toFixed(2)}`,
      p.metodo_pago || p.metodopago || 'N/A',
      p.fecha_pago || p.fecha || 'N/A'
    ]);
  
  tables.push({
    title: 'Top 10 Pagos Más Altos',
    headers: ['#', 'N° Factura/Recibo', 'Cliente', 'Monto', 'Método', 'Fecha'],
    rows: topPagos.length > 0 ? topPagos : [['Sin datos', '', '', '', '', '']]
  });
  
  // ============================================
  // TABLA 4: Recaudación por Mes
  // ============================================
  const meses = {};
  data.forEach(p => {
    if (p.fecha_pago || p.fecha) {
      const fecha = new Date(p.fecha_pago || p.fecha);
      const mes = fecha.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
      
      if (!meses[mes]) {
        meses[mes] = { count: 0, monto: 0, efectivo: 0, transferencia: 0, tarjeta: 0 };
      }
      
      meses[mes].count++;
      meses[mes].monto += (parseFloat(p.monto || p.valor) || 0);
      
      const metodo = (p.metodo_pago || p.metodopago || '').toLowerCase();
      if (metodo === 'efectivo') meses[mes].efectivo++;
      else if (metodo === 'transferencia') meses[mes].transferencia++;
      else if (metodo === 'tarjeta') meses[mes].tarjeta++;
    }
  });
  
  const mesesRows = Object.entries(meses)
    .sort((a, b) => new Date(b[0]) - new Date(a[0]))
    .slice(0, 6)
    .map(([mes, stats]) => [
      mes,
      stats.count,
      `$${stats.monto.toFixed(2)}`,
      `$${(stats.monto / stats.count).toFixed(2)}`,
      stats.efectivo,
      stats.transferencia,
      stats.tarjeta
    ]);
  
  if (mesesRows.length > 0) {
    tables.push({
      title: 'Recaudación por Mes (Últimos 6 Meses)',
      headers: ['Mes', 'Total', 'Monto', 'Promedio', 'Efectivo', 'Transferencia', 'Tarjeta'],
      rows: mesesRows
    });
  }
  
  // ============================================
  // TABLA 5: Recaudación por Día de la Semana (CORREGIDA)
  // ============================================
  const diasSemana = {};
  const diasNombres = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  
  // Inicializar todos los días
  diasNombres.forEach(dia => {
    diasSemana[dia] = { count: 0, monto: 0 };
  });
  
  // Contar pagos por día
  data.forEach(p => {
    if (p.fecha_pago || p.fecha) {
      try {
        const fecha = new Date(p.fecha_pago || p.fecha);
        if (!isNaN(fecha.getTime())) { // Validar que la fecha sea válida
          const dia = diasNombres[fecha.getDay()];
          if (diasSemana[dia]) { // Verificar que el día existe
            diasSemana[dia].count++;
            diasSemana[dia].monto += (parseFloat(p.monto || p.valor) || 0);
          }
        }
      } catch (error) {
        console.warn('Fecha inválida en pago:', p);
      }
    }
  });
  
  const diasRows = Object.entries(diasSemana)
    .filter(([_, stats]) => stats && stats.count > 0) // Filtrar días con datos
    .map(([dia, stats]) => [
      dia,
      stats.count,
      `$${stats.monto.toFixed(2)}`,
      `$${(stats.monto / stats.count).toFixed(2)}`,
      `${data.length > 0 ? ((stats.count / data.length) * 100).toFixed(1) : '0.0'}%`
    ]);
  
  if (diasRows.length > 0) {
    tables.push({
      title: 'Recaudación por Día de la Semana',
      headers: ['Día', 'Cantidad', 'Monto Total', 'Promedio', '% del Total'],
      rows: diasRows
    });
  }
  
  // ============================================
  // TABLA 6: Estadísticas Generales
  // ============================================
  const montos = data.map(p => parseFloat(p.monto || p.valor) || 0).filter(m => m > 0);
  const montoPromedio = montos.length > 0 ? montos.reduce((a, b) => a + b, 0) / montos.length : 0;
  const montoMax = montos.length > 0 ? Math.max(...montos) : 0;
  const montoMin = montos.length > 0 ? Math.min(...montos.filter(m => m > 0)) : 0;
  
  // Calcular mediana
  const montosOrdenados = [...montos].sort((a, b) => a - b);
  const mediana = montosOrdenados.length > 0
    ? montosOrdenados.length % 2 === 0
      ? (montosOrdenados[montosOrdenados.length / 2 - 1] + montosOrdenados[montosOrdenados.length / 2]) / 2
      : montosOrdenados[Math.floor(montosOrdenados.length / 2)]
    : 0;
  
  // Método más usado
  const metodosCount = {
    'Efectivo': efectivo.length,
    'Transferencia': transferencia.length,
    'Tarjeta': tarjeta.length,
    'Otros': otros.length
  };
  const metodoMasUsado = Object.entries(metodosCount)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])[0];
  
  tables.push({
    title: 'Estadísticas Generales',
    headers: ['Métrica', 'Valor'],
    rows: [
      ['Total de Pagos', data.length],
      ['Recaudación Total', `$${totalRecaudado.toFixed(2)}`],
      ['Monto Promedio', `$${montoPromedio.toFixed(2)}`],
      ['Monto Mediano', `$${mediana.toFixed(2)}`],
      ['Monto Máximo', `$${montoMax.toFixed(2)}`],
      ['Monto Mínimo', `$${montoMin.toFixed(2)}`],
      ['Método Más Usado', metodoMasUsado ? `${metodoMasUsado[0]} (${metodoMasUsado[1]} pagos)` : 'N/A'],
      ['Pago Promedio Efectivo', `$${(montoEfectivo / (efectivo.length || 1)).toFixed(2)}`],
      ['Pago Promedio Transferencia', `$${(montoTransferencia / (transferencia.length || 1)).toFixed(2)}`],
      ['Pago Promedio Tarjeta', `$${(montoTarjeta / (tarjeta.length || 1)).toFixed(2)}`]
    ]
  });
  
  return tables;
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
