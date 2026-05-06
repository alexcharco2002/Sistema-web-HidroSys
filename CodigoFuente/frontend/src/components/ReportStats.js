// src/components/ReportStats.js
import React, { useState, useMemo } from 'react';
import { 
  BarChart3 , Activity, 
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
      case 'MultasAfiliados':
        return calculateMultasCharts(data);
      case 'Caja':
        return calculateCajaCharts(data);
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

      {/* Gráfico de Pastel 1 */}
      {chartData.pieChart && chartData.pieChart.data && chartData.pieChart.data.length > 0 && (
        <div className="chart-card">
          <h4 className="chart-title">{chartData.pieChart.title}</h4>
          <PieChartCustom data={chartData.pieChart.data} />
        </div>
      )}

      {/* ✅ NUEVO: Gráfico de Pastel 2 (Montos por Estado) */}
      {chartData.pieChart2 && chartData.pieChart2.data && chartData.pieChart2.data.length > 0 && (
        <div className="chart-card">
          <h4 className="chart-title">{chartData.pieChart2.title}</h4>
          <PieChartCustom data={chartData.pieChart2.data} />
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

      {/* Gráfico de Barras Verticales */}
      {chartData.barChart && (
        <div className="chart-card">
          <h4 className="chart-title">{chartData.barChart.title}</h4>
          <BarChart data={chartData.barChart.data} />
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

      {/* ✅ NUEVO: Gráfico de Pastel - Facturas con/sin Mora */}
      {chartData.pieChartMora && chartData.pieChartMora.data && chartData.pieChartMora.data.length > 0 && (
        <div className="chart-card">
          <h4 className="chart-title">{chartData.pieChartMora.title}</h4>
          <PieChartCustom data={chartData.pieChartMora.data} />
        </div>
      )}

      {/* ✅ NUEVO: Gráfico de Pastel - Monto Mora */}
      {chartData.pieChartMoraMonto && chartData.pieChartMoraMonto.data && chartData.pieChartMoraMonto.data.length > 0 && (
        <div className="chart-card">
          <h4 className="chart-title">{chartData.pieChartMoraMonto.title}</h4>
          <PieChartCustom data={chartData.pieChartMoraMonto.data} />
        </div>
      )}

      {/* ✅ NUEVO: Gráfico de Barras - Meses de Adeudo */}
      {chartData.barChartMora && chartData.barChartMora.data && chartData.barChartMora.data.length > 0 && (
        <div className="chart-card">
          <h4 className="chart-title">{chartData.barChartMora.title}</h4>
          <BarChart data={chartData.barChartMora.data} />
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
      case 'MultasAfiliados':
        return generateMultasTable(data);
      case 'Caja':
        return generateCajaTable(data);
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

// CAJA GENERAL — Gráficos y Tablas
// ── CAJA GENERAL — Gráficos y Tablas ──────────────────────────────────────

const calculateCajaCharts = (data) => {
  const esMeses = data.length > 0 && data[0].mes !== undefined && data[0].dia === undefined;
  const esDias  = data.length > 0 && data[0].dia !== undefined;

  const MESES = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const mesLabel = (m) => MESES[parseInt(m)] || `M${m}`;

  // ── DATOS COMUNES ──────────────────────────────────────────────────────────
  const totalAgua    = data.reduce((s, r) => s + parseFloat(r.total_agua    || 0), 0);
  const totalMultas  = data.reduce((s, r) => s + parseFloat(r.total_multas  || 0), 0);
  const totalMora    = data.reduce((s, r) => s + parseFloat(r.total_mora    || 0), 0);
  const totalGeneral = totalAgua + totalMultas + totalMora;
  const totalFacturado = data.reduce((s, r) => s + parseFloat(r.total_facturado || 0), 0);
  const totalPendiente = totalFacturado > 0
    ? data.reduce((s, r) => s + parseFloat(r.total_pendiente || 0), 0)
    : Math.max(0, totalFacturado - totalAgua);

  // ── GRÁFICO 1: Composición de ingresos (Pie) ──────────────────────────────
  const pieComposicion = [
    { label: 'Cobros de Agua',  value: parseFloat(totalAgua.toFixed(2)),   color: '#3b82f6' },
    { label: 'Multas Cobradas', value: parseFloat(totalMultas.toFixed(2)),  color: '#ef4444' },
    { label: 'Mora Cobrada',    value: parseFloat(totalMora.toFixed(2)),    color: '#f97316' },
  ].filter(d => d.value > 0);

  // ── GRÁFICO 2: Recaudación por período (AreaChart) ────────────────────────
  let areaData = [];
  if (esMeses) {
    areaData = data.map(m => ({
      label: mesLabel(m.mes),
      value: parseFloat(parseFloat(m.total_general || 0).toFixed(2)),
    }));
  } else if (esDias) {
    areaData = data.map(d => ({
      label: String(d.dia).slice(-2),
      value: parseFloat(parseFloat(d.total_general || 0).toFixed(2)),
    }));
  }

  // ── GRÁFICO 3: Agua vs Multas vs Mora por período (GroupedBarChart) ────────
  let groupedData = [];
  if (esMeses) {
    groupedData = data.map(m => ({
      category: mesLabel(m.mes),
      series: [
        { name: 'Agua',   value: Math.round(parseFloat(m.total_agua   || 0)), color: '#3b82f6' },
        { name: 'Multas', value: Math.round(parseFloat(m.total_multas || 0)), color: '#ef4444' },
        { name: 'Mora',   value: Math.round(parseFloat(m.total_mora   || 0)), color: '#f97316' },
      ],
    }));
  } else if (esDias) {
    groupedData = data.map(d => ({
      category: String(d.dia).slice(-2),
      series: [
        { name: 'Agua',   value: Math.round(parseFloat(d.total_agua   || 0)), color: '#3b82f6' },
        { name: 'Multas', value: Math.round(parseFloat(d.total_multas || 0)), color: '#ef4444' },
        { name: 'Mora',   value: Math.round(parseFloat(d.total_mora   || 0)), color: '#f97316' },
      ],
    }));
  }

  // ── GRÁFICO 4: Facturación por mes (HorizontalBarChart) ───────────────────
  let facturacionData = [];
  if (esMeses) {
    facturacionData = data
      .filter(m => parseFloat(m.totalfacturado || 0) > 0)
      .map(m => ({
        label:    mesLabel(m.mes),
        value:    Math.round(parseFloat(m.total_facturado || 0)),
        color:    '#6366f1',
        subtitle: `Cobrado: $${parseFloat(m.total_agua || 0).toFixed(2)}`,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }

  // ── GRÁFICO 5: % Cobrado por mes (BarChart vertical) ──────────────────────
  let porcentajeData = [];
  if (esMeses) {
    porcentajeData = data
      .filter(m => parseFloat(m.porcentajecobrado || 0) > 0)
      .map(m => {
        const pct = parseFloat(m.porcentajecobrado || 0);
        return {
          label: mesLabel(m.mes),
          value: pct,
          color: pct >= 80 ? '#22c55e' : pct >= 50 ? '#f97316' : '#ef4444',
        };
      });
  }

  // ── GRÁFICO 6: Cobrado vs Pendiente (PieChart) ────────────────────────────
  const pieCobrado = [
    { label: 'Cobrado',   value: parseFloat(totalAgua.toFixed(2)),     color: '#22c55e' },
    { label: 'Pendiente', value: parseFloat(totalPendiente.toFixed(2)), color: '#ef4444' },
  ].filter(d => d.value > 0);

  return {
    pieChart:         pieComposicion.length > 0   ? { title: 'Composición de Ingresos',          data: pieComposicion  } : null,
    pieChart2:        pieCobrado.length > 0        ? { title: 'Cobrado vs Pendiente',             data: pieCobrado      } : null,
    areaChart:        areaData.length > 0          ? { title: 'Evolución de Recaudación',         data: areaData        } : null,
    groupedBarChart:  groupedData.length > 0       ? { title: 'Agua · Multas · Mora por Período', data: groupedData,
                        series: [{ name: 'Agua', color: '#3b82f6' }, { name: 'Multas', color: '#ef4444' }, { name: 'Mora', color: '#f97316' }] } : null,
    horizontalBarChart: facturacionData.length > 0 ? { title: 'Facturación por Mes',             data: facturacionData } : null,
    barChart:         porcentajeData.length > 0    ? { title: '% Cobrado por Mes',               data: porcentajeData  } : null,
  };
};

const generateCajaTable = (data) => {
  const tables = [];
  if (!data || data.length === 0) return tables;

  const esMeses = data[0].mes !== undefined && data[0].dia === undefined;
  const MESES_CORTOS = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const MESES_LARGOS = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const mesLabel = (m) => MESES_CORTOS[parseInt(m)] || `M${m}`;

  // ── Totales generales ──────────────────────────────────────────────────────
  const totalAgua      = data.reduce((s, r) => s + parseFloat(r.total_agua      || 0), 0);
  const totalMultas    = data.reduce((s, r) => s + parseFloat(r.total_multas    || 0), 0);
  const totalMora      = data.reduce((s, r) => s + parseFloat(r.total_mora      || 0), 0);
  const totalGeneral   = totalAgua + totalMultas + totalMora;
  const totalFacturado = data.reduce((s, r) => s + parseFloat(r.total_facturado || 0), 0);
  const totalPendiente = data.reduce((s, r) => s + parseFloat(r.total_pendiente || 0), 0);
  const totalPagos      = data.reduce((s, r) => s + parseInt(r.cantidad_pagos   || 0), 0);
  const totalCantMultas = data.reduce((s, r) => s + parseInt(r.cantidad_multas  || 0), 0);


  // ── TABLA 1: Resumen General ───────────────────────────────────────────────
  tables.push({
    title: 'Resumen General de Caja',
    headers: ['Concepto', 'Monto', '% del Total'],
    rows: [
      ['Cobros de Agua',  `$${totalAgua.toFixed(2)}`,    totalGeneral > 0 ? `${(totalAgua   / totalGeneral * 100).toFixed(1)}%` : '0%'],
      ['Multas Cobradas', `$${totalMultas.toFixed(2)}`,  totalGeneral > 0 ? `${(totalMultas / totalGeneral * 100).toFixed(1)}%` : '0%'],
      ['Mora Cobrada',    `$${totalMora.toFixed(2)}`,    totalGeneral > 0 ? `${(totalMora   / totalGeneral * 100).toFixed(1)}%` : '0%'],
      ['TOTAL INGRESOS',  `$${totalGeneral.toFixed(2)}`, '100%'],
    ],
  });

  // ── TABLA 2: Facturación vs Recaudación ────────────────────────────────────
  if (totalFacturado > 0) {
    const pctCobrado  = (totalAgua    / totalFacturado * 100).toFixed(1);
    const pctPendiente = (totalPendiente / totalFacturado * 100).toFixed(1);
    tables.push({
      title: 'Facturación vs Recaudación',
      headers: ['Métrica', 'Monto'],
      rows: [
        ['Total Facturado',   `$${totalFacturado.toFixed(2)}`],
        ['Total Cobrado',     `$${totalAgua.toFixed(2)}`],
        ['Total Pendiente',   `$${totalPendiente.toFixed(2)}`],
        ['% Cobrado',         `${pctCobrado}%`],
        ['% Pendiente',       `${pctPendiente}%`],
        ['N° Pagos de Agua',  totalPagos.toString()],
        ['N° Multas Cobradas',totalCantMultas.toString()],
      ],
    });
  }

  // ── TABLA 3: Detalle por Período ───────────────────────────────────────────
  if (esMeses && data.length > 0) {
    tables.push({
      title: 'Detalle por Mes',
      headers: ['Mes', 'Total Agua', 'Multas', 'Mora', 'Total General', 'Facturado', '% Cobrado'],
      rows: data.map(m => [
        MESES_LARGOS[parseInt(m.mes)] || `Mes ${m.mes}`,
        `$${parseFloat(m.total_agua      || 0).toFixed(2)}`,
        `$${parseFloat(m.total_multas    || 0).toFixed(2)}`,
        `$${parseFloat(m.total_mora      || 0).toFixed(2)}`,
        `$${parseFloat(m.total_general   || 0).toFixed(2)}`,
        `$${parseFloat(m.total_facturado || 0).toFixed(2)}`,
        `${parseFloat(m.porcentaje_cobrado || 0).toFixed(1)}%`,
      ]),
    });
  } else if (!esMeses && data.length > 0) {
    tables.push({
      title: 'Detalle Diario',
      headers: ['Día', 'Total Agua', 'Multas', 'Total General', 'N° Pagos', 'N° Multas'],
      rows: data.map(d => [
        d.dia,
        `$${parseFloat(d.total_agua    || 0).toFixed(2)}`,
        `$${parseFloat(d.total_multas  || 0).toFixed(2)}`,
        `$${parseFloat(d.total_general || 0).toFixed(2)}`,
        d.cantidad_pagos  || 0,
        d.cantidad_multas || 0,
      ]),
    });
  }

  // ── TABLA 4: Estadísticas de Recaudación ───────────────────────────────────
  if (data.length > 0) {
    const valores    = data.map(r => parseFloat(r.total_general || 0)).filter(v => v > 0);
    const promedio   = valores.length > 0 ? (valores.reduce((a, b) => a + b, 0) / valores.length) : 0;
    const maximo     = valores.length > 0 ? Math.max(...valores) : 0;
    const minimo     = valores.length > 0 ? Math.min(...valores) : 0;
    const mejorPeriodo = data.length > 0
      ? data.reduce((max, r) =>
          parseFloat(r.total_general || 0) > parseFloat(max.total_general || 0) ? r : max,
          data[0])
      : null;
    const labelMejor = mejorPeriodo
      ? (esMeses
          ? `${MESES_LARGOS[parseInt(mejorPeriodo.mes)] || mejorPeriodo.mes} — $${parseFloat(mejorPeriodo.total_general || 0).toFixed(2)}`
          : `Día ${mejorPeriodo.dia} — $${parseFloat(mejorPeriodo.total_general || 0).toFixed(2)}`)
      : 'Sin datos';

    tables.push({
      title: 'Estadísticas de Recaudación',
      headers: ['Métrica', 'Valor'],
      rows: [
        ['Períodos con movimiento',  data.length.toString()],
        ['Total General',            `$${totalGeneral.toFixed(2)}`],
        ['Promedio por Período',     `$${promedio.toFixed(2)}`],
        ['Mejor Período',            labelMejor],
        ['Máximo Recaudado',         `$${maximo.toFixed(2)}`],
        ['Mínimo Recaudado',         `$${minimo.toFixed(2)}`],
        ['Total N° Pagos Agua',      totalPagos.toString()],
        ['Total N° Multas Cobradas', totalCantMultas.toString()],
      ],
    });
  }

  return tables;
};


// ============================================================================
// FUNCIONES DE CÁLCULO DE DATOS PARA GRÁFICOS
// ============================================================================

const calculateLecturasCharts = (data) => {
  // Distribución por tipo de lectura
  const reales = data.filter(l => 
    l.tipo_lectura === 'Real' || l.es_estimada === false || l.es_estimada === 'No'
  ).length;
  const estimadas = data.filter(l => 
    l.tipo_lectura === 'Estimada' || l.es_estimada === true || l.es_estimada === 'Sí'
  ).length;
  
  // Top 10 consumos más altos
  const topConsumos = [...data]
    .sort((a, b) => (parseFloat(b.consumo_m3 || b.consumo) || 0) - (parseFloat(a.consumo_m3 || a.consumo) || 0))
    .slice(0, 10)
    .map(l => ({
      label: l.Nombre || l.nombres || l.Nombres || l.num_medidor || 'N/A',
      value: parseFloat(l.consumo_m3 || l.consumo) || 0,
      color: '#3b82f6',
      subtitle: `Medidor: ${l.num_medidor || 'N/A'}`
    }));
  
  // ✅ NUEVO: Consumo Promedio por Sector (Barras Verticales)
  const consumoPorSector = {};
  data.forEach(l => {
    const sector = l.sector || 'Sin sector';
    if (!consumoPorSector[sector]) {
      consumoPorSector[sector] = { total: 0, count: 0 };
    }
    consumoPorSector[sector].total += (parseFloat(l.consumo_m3 || l.consumo) || 0);
    consumoPorSector[sector].count += 1;
  });
  
  const sectorConsumoData = Object.entries(consumoPorSector)
    .map(([label, data]) => ({
      label,
      value: Math.round(data.total / data.count), // Promedio
      color: '#10b981'
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8); // Top 8 sectores
  
  // ✅ NUEVO: Top 10 Medidores con Mayor Consumo Total
  const consumoPorMedidor = {};
  data.forEach(l => {
    const medidor = l.num_medidor || 'Sin medidor';
    if (!consumoPorMedidor[medidor]) {
      consumoPorMedidor[medidor] = 0;
    }
    consumoPorMedidor[medidor] += (parseFloat(l.consumo_m3 || l.consumo) || 0);
  });
  
  const topMedidores = Object.entries(consumoPorMedidor)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([label, value]) => ({
      label,
      value: Math.round(value),
      color: '#6366f1'
    }));
  
  // ✅ NUEVO: Distribución de Consumo (Muy Bajo, Bajo, Normal, Alto, Muy Alto)
  const categorias = [
    { min: 0, max: 5, label: 'Muy Bajo (0-5 m³)', color: '#22c55e' },
    { min: 5, max: 10, label: 'Bajo (5-10 m³)', color: '#84cc16' },
    { min: 10, max: 20, label: 'Normal (10-20 m³)', color: '#eab308' },
    { min: 20, max: 50, label: 'Alto (20-50 m³)', color: '#f97316' },
    { min: 50, max: Infinity, label: 'Muy Alto (50+ m³)', color: '#ef4444' }
  ];
  
  const distribucionConsumo = categorias.map(cat => {
    const count = data.filter(l => {
      const consumo = parseFloat(l.consumo_m3 || l.consumo) || 0;
      return consumo >= cat.min && consumo < cat.max;
    }).length;
    
    return {
      label: cat.label,
      value: count,
      color: cat.color
    };
  }).filter(item => item.value > 0);
  
  // Distribución por sector (cantidad)
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
  
  // Comparación por rango de consumo (Reales vs Estimadas)
  const rangos = [
    { min: 0, max: 10, label: '0-10' },
    { min: 10, max: 20, label: '10-20' },
    { min: 20, max: 50, label: '20-50' },
    { min: 50, max: Infinity, label: '50+' }
  ];
  
  const rangoData = rangos.map(rango => {
    const realesEnRango = data.filter(l => {
      const esReal = l.tipo_lectura === 'Real' || l.es_estimada === false || l.es_estimada === 'No';
      const consumo = parseFloat(l.consumo_m3 || l.consumo) || 0;
      return esReal && consumo >= rango.min && consumo < rango.max;
    }).length;
    
    const estimadasEnRango = data.filter(l => {
      const esEstimada = l.tipo_lectura === 'Estimada' || l.es_estimada === true || l.es_estimada === 'Sí';
      const consumo = parseFloat(l.consumo_m3 || l.consumo) || 0;
      return esEstimada && consumo >= rango.min && consumo < rango.max;
    }).length;
    
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
      title: 'Top 10 Mayores Consumos por Afiliado',
      data: topConsumos
    },
    pieChart: {
      title: 'Distribución por Tipo de Lectura',
      data: [
        { label: 'Reales', value: reales, color: '#22c55e' },
        { label: 'Estimadas', value: estimadas, color: '#f97316' }
      ].filter(item => item.value > 0)
    },
    pieChart2: {
      title: 'Distribución por Nivel de Consumo',
      data: distribucionConsumo
    },
    distribution: {
      title: 'Cantidad de Lecturas por Sector',
      data: sectoresData
    },
    barChart: sectorConsumoData.length > 0 ? {
      title: 'Consumo Promedio por Sector (m³)',
      data: sectorConsumoData
    } : null,
    barChart2: topMedidores.length > 0 ? {
      title: 'Top 10 Medidores - Consumo Acumulado (m³)',
      data: topMedidores
    } : null,
    groupedBarChart: {
      title: 'Lecturas Reales vs Estimadas por Rango',
      data: rangoData,
      series: [
        { name: 'Reales', color: '#22c55e' },
        { name: 'Estimadas', color: '#f97316' }
      ]
    }
  };
};

const calculateFacturasCharts = (data) => {
  // Estados de facturas - INCLUIR ANULADAS
  const pagadas = data.filter(f => 
    f.estado?.toLowerCase() === 'pagada' || f.estado_factura?.toLowerCase() === 'pagada'
  );
  const pendientes = data.filter(f => 
    f.estado?.toLowerCase() === 'pendiente' || f.estado_factura?.toLowerCase() === 'pendiente'
  );
  const vencidas = data.filter(f => 
    f.estado?.toLowerCase() === 'vencida' || f.estado_factura?.toLowerCase() === 'vencida'
  );
  const anuladas = data.filter(f => 
    f.estado?.toLowerCase() === 'anulada' || f.estado_factura?.toLowerCase() === 'anulada'
  );
  
  // Calcular montos
  const montoPagado = pagadas.reduce((sum, f) => sum + (parseFloat(f.total_factura || f.total) || 0), 0);
  const montoPendiente = pendientes.reduce((sum, f) => sum + (parseFloat(f.total_factura || f.total) || 0), 0);
  const montoVencido = vencidas.reduce((sum, f) => sum + (parseFloat(f.total_factura || f.total) || 0), 0);
  const montoAnulado = anuladas.reduce((sum, f) => sum + (parseFloat(f.total_factura || f.total) || 0), 0);
  
  // 🚨 ESTADÍSTICAS DE MORA
  const facturasConMora = data.filter(f => f.tiene_mora === true);
  const totalMora = facturasConMora.reduce((sum, f) => sum + (parseFloat(f.valor_mora) || 0), 0);
  const facturasSinMora = data.filter(f => !f.tiene_mora);
  
  const cantidadConMora = facturasConMora.length;
  const cantidadSinMora = facturasSinMora.length;
  
  // Meses de adeudo promedio
  const mesesAdeudoData = {};
  facturasConMora.forEach(f => {
    const meses = f.meses_adeudo || 0;
    const rangoLabel = meses === 0 ? '0 meses' : 
                       meses <= 2 ? '1-2 meses' : 
                       meses <= 4 ? '3-4 meses' : 
                       meses <= 6 ? '5-6 meses' : '6+ meses';
    mesesAdeudoData[rangoLabel] = (mesesAdeudoData[rangoLabel] || 0) + 1;
  });
  
  // Top 10 facturas más altas - CON NOMBRE DE AFILIADO
  const topFacturas = [...data]
    .sort((a, b) => (parseFloat(b.total_factura || b.total) || 0) - (parseFloat(a.total_factura || a.total) || 0))
    .slice(0, 10)
    .map(f => ({
      label: f.Nombres || f.nombres || f.Nombre || f.num_factura || 'N/A',
      value: parseFloat(f.total_factura || f.total) || 0,
      color: f.tiene_mora ? '#ef4444' : '#3b82f6',
      subtitle: `${f.num_factura}${f.tiene_mora ? ' (CON MORA)' : ''}`
    }));
  
  // Facturación mensual - Ordenar por fecha correctamente
  const facturasPorMes = {};
  const mesesOrdenados = [];
  
  data.forEach(f => {
    const fechaStr = f.fecha_emision || f.fecha_factura;
    if (fechaStr) {
      try {
        let fecha;
        if (fechaStr.includes('/')) {
          const [dia, mes, anio] = fechaStr.split('/');
          fecha = new Date(anio, mes - 1, dia);
        } else if (fechaStr.includes('-')) {
          fecha = new Date(fechaStr);
        } else {
          fecha = new Date(fechaStr);
        }
        
        if (!isNaN(fecha.getTime())) {
          const mesKey = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
          const mesLabel = fecha.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
          
          if (!facturasPorMes[mesKey]) {
            facturasPorMes[mesKey] = { valor: 0, label: mesLabel, fecha: fecha };
            mesesOrdenados.push(mesKey);
          }
          facturasPorMes[mesKey].valor += (parseFloat(f.total_factura || f.total) || 0);
        }
      } catch (e) {
        console.error('Error al parsear fecha:', fechaStr, e);
      }
    }
  });
  
  const facturacionMensual = mesesOrdenados
    .sort()
    .slice(-6)
    .map(key => ({
      label: facturasPorMes[key].label,
      value: Math.round(facturasPorMes[key].valor)
    }));
  
  // ✅ ARREGLADO: Rangos de 0 a 10, de 10 en 10
  const rangos = [
    { min: 0, max: 10, label: '$0-10' },
    { min: 10, max: 20, label: '$10-20' },
    { min: 20, max: 30, label: '$20-30' },
    { min: 30, max: 40, label: '$30-40' },
    { min: 40, max: 50, label: '$40-50' },
    { min: 50, max: 60, label: '$50-60' },
    { min: 50, max: Infinity, label: '$50+' }
  ];
  
  const rangoData = rangos.map(rango => {
    const pagadasEnRango = pagadas.filter(f => {
      const total = parseFloat(f.total_factura || f.total) || 0;
      return total >= rango.min && total < rango.max;
    }).length;
    
    const pendientesEnRango = pendientes.filter(f => {
      const total = parseFloat(f.total_factura || f.total) || 0;
      return total >= rango.min && total < rango.max;
    }).length;
    
    const vencidasEnRango = vencidas.filter(f => {
      const total = parseFloat(f.total_factura || f.total) || 0;
      return total >= rango.min && total < rango.max;
    }).length;
    
    const anuladasEnRango = anuladas.filter(f => {
      const total = parseFloat(f.total_factura || f.total) || 0;
      return total >= rango.min && total < rango.max;
    }).length;
    
    return {
      category: rango.label,
      series: [
        { name: 'Pagadas', value: pagadasEnRango, color: '#22c55e' },
        { name: 'Pendientes', value: pendientesEnRango, color: '#f97316' },
        { name: 'Vencidas', value: vencidasEnRango, color: '#ef4444' },
        { name: 'Anuladas', value: anuladasEnRango, color: '#6b7280' }
      ]
    };
  });
  
  // ✅ ARREGLADO: Distribución por sector - SOLO TOTAL DE FACTURA (SIN MORA)
  const facturasPorSector = {};
  data.forEach(f => {
    const sector = f.sector || f.zona || f.nombre_sector || 'Sin sector';
    if (!facturasPorSector[sector]) {
      facturasPorSector[sector] = 0;
    }
    // ✅ SOLO USAR total_factura (sin incluir valor_mora)
    facturasPorSector[sector] += (parseFloat(f.total_factura || f.total) || 0);
  });
  
  const sectoresData = Object.entries(facturasPorSector)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, value]) => ({
      label,
      value: parseFloat(value.toFixed(2)),
      displayValue: `$${value.toFixed(2)}`
    }));
  
  return {
    horizontalBarChart: {
      title: 'Top 10 Afiliados - Facturas Más Altas',
      data: topFacturas
    },
    pieChart: {
      title: 'Distribución por Estado (Cantidad)',
      data: [
        { label: 'Pagadas', value: pagadas.length, color: '#22c55e' },
        { label: 'Pendientes', value: pendientes.length, color: '#f97316' },
        { label: 'Vencidas', value: vencidas.length, color: '#ef4444' },
        { label: 'Anuladas', value: anuladas.length, color: '#6b7280' }
      ].filter(item => item.value > 0)
    },
    pieChart2: {
      title: 'Montos por Estado ($)',
      data: [
        { label: 'Pagado', value: Math.round(montoPagado), color: '#22c55e' },
        { label: 'Pendiente', value: Math.round(montoPendiente), color: '#f97316' },
        { label: 'Vencido', value: Math.round(montoVencido), color: '#ef4444' },
        { label: 'Anulado', value: Math.round(montoAnulado), color: '#6b7280' }
      ].filter(item => item.value > 0)
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
        { name: 'Vencidas', color: '#ef4444' },
        { name: 'Anuladas', color: '#6b7280' }
      ]
    },
    barChart: sectoresData.length > 0 ? {
      title: 'Facturación por Sector ($)',
      data: sectoresData
    } : null,
    // 🚨 GRÁFICOS DE MORA
    pieChartMora: cantidadConMora > 0 ? {
      title: 'Facturas con/sin Mora',
      data: [
        { label: 'Con Mora', value: cantidadConMora, color: '#ef4444' },
        { label: 'Sin Mora', value: cantidadSinMora, color: '#22c55e' }
      ]
    } : null,
    pieChartMoraMonto: cantidadConMora > 0 ? {
      title: 'Distribución de Mora ($)',
      data: [
        { label: 'Total Facturado', value: Math.round(data.reduce((sum, f) => sum + (parseFloat(f.total_factura || f.total) || 0), 0)), color: '#3b82f6' },
        { label: 'Total Mora', value: Math.round(totalMora), color: '#ef4444' }
      ]
    } : null,
    barChartMora: Object.keys(mesesAdeudoData).length > 0 ? {
      title: 'Facturas por Meses de Adeudo',
      data: Object.entries(mesesAdeudoData)
        .map(([label, value]) => ({
          label,
          value,
          color: '#ef4444'
        }))
    } : null
  };
};

const calculatePagosCharts = (data) => {
  // Métodos de pago
  const efectivo = data.filter(p => 
    p.metodo_pago?.toLowerCase().includes('efectivo') || p.metodopago?.toLowerCase().includes('efectivo')
  );
  const transferencia = data.filter(p => 
    p.metodo_pago?.toLowerCase().includes('transferencia') || p.metodopago?.toLowerCase().includes('transferencia')
  );
  const tarjeta = data.filter(p => 
    p.metodo_pago?.toLowerCase().includes('tarjeta') || p.metodopago?.toLowerCase().includes('tarjeta')
  );
  const otros = data.filter(p => {
    const metodo = (p.metodo_pago || p.metodopago || '').toLowerCase();
    return !metodo.includes('efectivo') && !metodo.includes('transferencia') && !metodo.includes('tarjeta') && metodo !== '';
  });
  
  // Calcular montos (usar monto_pagado del backend)
  const montoEfectivo = efectivo.reduce((sum, p) => sum + (parseFloat(p.monto_pagado || p.monto || p.valor) || 0), 0);
  const montoTransferencia = transferencia.reduce((sum, p) => sum + (parseFloat(p.monto_pagado || p.monto || p.valor) || 0), 0);
  const montoTarjeta = tarjeta.reduce((sum, p) => sum + (parseFloat(p.monto_pagado || p.monto || p.valor) || 0), 0);
  const montoOtros = otros.reduce((sum, p) => sum + (parseFloat(p.monto_pagado || p.monto || p.valor) || 0), 0);
  
  // 🚨 ESTADÍSTICAS DE MORA EN PAGOS
  const pagosConMora = data.filter(p => p.tiene_mora === true);
  const pagosSinMora = data.filter(p => !p.tiene_mora);
  const totalMoraPagos = pagosConMora.reduce((sum, p) => sum + (parseFloat(p.valor_mora) || 0), 0);
  
  // Meses de adeudo en pagos
  const mesesAdeudoPagosData = {};
  pagosConMora.forEach(p => {
    const meses = p.meses_adeudo || 0;
    const rangoLabel = meses === 0 ? '0 meses' : 
                       meses <= 2 ? '1-2 meses' : 
                       meses <= 4 ? '3-4 meses' : 
                       meses <= 6 ? '5-6 meses' : '6+ meses';
    mesesAdeudoPagosData[rangoLabel] = (mesesAdeudoPagosData[rangoLabel] || 0) + 1;
  });
  
  // ✅ Top 10 pagos más altos - CON NOMBRE DE AFILIADO
  const topPagos = [...data]
    .sort((a, b) => (parseFloat(b.monto_pagado || b.monto || b.valor) || 0) - (parseFloat(a.monto_pagado || a.monto || a.valor) || 0))
    .slice(0, 10)
    .map(p => ({
      label: p.Nombre || p.nombres || p.Nombres || p.num_factura || 'N/A',
      value: parseFloat(p.monto_pagado || p.monto || p.valor) || 0,
      color: p.tiene_mora ? '#ef4444' : '#10b981', // Rojo si tiene mora, verde si no
      subtitle: `${p.num_factura || 'N/A'}${p.tiene_mora ? ' (CON MORA)' : ''}`
    }));
  
  // Recaudación mensual (últimos 6 meses) - Para AreaChart
  const pagosPorMes = {};
  data.forEach(p => {
    if (p.fecha_pago || p.fecha) {
      const fecha = new Date(p.fecha_pago || p.fecha);
      const mes = fecha.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
      pagosPorMes[mes] = (pagosPorMes[mes] || 0) + (parseFloat(p.monto_pagado || p.monto || p.valor) || 0);
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
      const monto = parseFloat(p.monto_pagado || p.monto || p.valor) || 0;
      return monto >= rango.min && monto < rango.max;
    }).length;
    
    const transferenciaEnRango = transferencia.filter(p => {
      const monto = parseFloat(p.monto_pagado || p.monto || p.valor) || 0;
      return monto >= rango.min && monto < rango.max;
    }).length;
    
    const tarjetaEnRango = tarjeta.filter(p => {
      const monto = parseFloat(p.monto_pagado || p.monto || p.valor) || 0;
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
      pagosPorDia[dia] = (pagosPorDia[dia] || 0) + (parseFloat(p.monto_pagado || p.monto || p.valor) || 0);
    }
  });
  
  const diasData = Object.entries(pagosPorDia)
    .filter(([_, value]) => value > 0)
    .map(([label, value]) => ({
      label,
      value: Math.round(value),
      color: '#3b82f6'
    }));
  
  return {
    horizontalBarChart: {
      title: 'Top 10 Afiliados - Pagos Más Altos',
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
    pieChart2: {
      title: 'Montos por Método de Pago ($)',
      data: [
        { label: 'Efectivo', value: Math.round(montoEfectivo), color: '#10b981' },
        { label: 'Transferencia', value: Math.round(montoTransferencia), color: '#6366f1' },
        { label: 'Tarjeta', value: Math.round(montoTarjeta), color: '#f59e0b' },
        { label: 'Otros', value: Math.round(montoOtros), color: '#8b5cf6' }
      ].filter(item => item.value > 0)
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
      data: diasData
    } : null,
    // 🚨 GRÁFICOS DE MORA EN PAGOS
    pieChartMora: pagosConMora.length > 0 ? {
      title: 'Pagos con/sin Mora',
      data: [
        { label: 'Con Mora', value: pagosConMora.length, color: '#ef4444' },
        { label: 'Sin Mora', value: pagosSinMora.length, color: '#22c55e' }
      ]
    } : null,
    pieChartMoraMonto: pagosConMora.length > 0 ? {
      title: 'Monto Total vs Mora ($)',
      data: [
        { label: 'Pagado', value: Math.round(data.reduce((sum, p) => sum + (parseFloat(p.monto_pagado || p.monto) || 0), 0)), color: '#10b981' },
        { label: 'Mora', value: Math.round(totalMoraPagos), color: '#ef4444' }
      ]
    } : null,
    barChartMora: Object.keys(mesesAdeudoPagosData).length > 0 ? {
      title: 'Pagos por Meses de Adeudo',
      data: Object.entries(mesesAdeudoPagosData)
        .map(([label, value]) => ({
          label,
          value,
          color: '#ef4444'
        }))
    } : null
  };
};

const calculateMultasCharts = (data) => {
  // Estados de multas
  const pendientes = data.filter(m => m.estado === 'pendiente');
  const pagadas = data.filter(m => m.estado === 'pagada');
  const anuladas = data.filter(m => m.estado === 'anulada');
  
  // Montos
  const montoPendiente = pendientes.reduce((sum, m) => sum + (parseFloat(m.monto) || 0), 0);
  const montoPagado = pagadas.reduce((sum, m) => sum + (parseFloat(m.monto) || 0), 0);
  const montoAnulado = anuladas.reduce((sum, m) => sum + (parseFloat(m.monto) || 0), 0);
  
  // Top 10 afiliados con mayores multas
  const multasPorAfiliado = {};
  data.forEach(m => {
    const cod = m.cod_usuario_afi || 'N/A';
    const nombre = m.nombre_completo || 'N/A';
    const medidor = m.medidor || 'Sin medidor';
    const sector = m.sector || 'Sin sector';
    
    if (!multasPorAfiliado[cod]) {
      multasPorAfiliado[cod] = {
        nombre,
        medidor,
        sector,
        monto: 0,
        cantidad: 0,
        pendientes: 0
      };
    }
    
    multasPorAfiliado[cod].monto += (parseFloat(m.monto) || 0);
    multasPorAfiliado[cod].cantidad += 1;
    if (m.estado === 'pendiente') {
      multasPorAfiliado[cod].pendientes += 1;
    }
  });
  
  const topAfiliados = Object.values(multasPorAfiliado)
    .sort((a, b) => b.monto - a.monto)
    .slice(0, 10)
    .map(a => ({
      label: a.nombre,
      value: Math.round(a.monto),
      color: a.pendientes > 0 ? '#ef4444' : '#10b981',
      subtitle: `${a.sector} - ${a.medidor}`
    }));
  
  // Tipos de multa
  const tiposMulta = {};
  data.forEach(m => {
    const tipo = m.nombre_multa || 'Sin tipo';
    if (!tiposMulta[tipo]) {
      tiposMulta[tipo] = { cantidad: 0, monto: 0 };
    }
    tiposMulta[tipo].cantidad += 1;
    tiposMulta[tipo].monto += (parseFloat(m.monto) || 0);
  });
  
  const tiposMultaData = Object.entries(tiposMulta)
    .sort((a, b) => b[1].monto - a[1].monto)
    .slice(0, 6)
    .map(([label, data], idx) => ({
      label,
      value: data.cantidad,
      color: `hsl(${idx * 60}, 70%, 60%)`
    }));
  
  // Multas por sector
  const multasPorSector = {};
  data.forEach(m => {
    const sector = m.sector || 'Sin sector';
    if (!multasPorSector[sector]) {
      multasPorSector[sector] = { cantidad: 0, monto: 0 };
    }
    multasPorSector[sector].cantidad += 1;
    multasPorSector[sector].monto += (parseFloat(m.monto) || 0);
  });
  
  const sectoresData = Object.entries(multasPorSector)
    .sort((a, b) => b[1].cantidad - a[1].cantidad)
    .map(([label, data]) => ({
      label,
      value: data.cantidad,
      color: '#3b82f6'
    }));
  
  // Distribución por rango de monto
  const rangos = [
    { min: 0, max: 10, label: '$0-10' },
    { min: 10, max: 20, label: '$10-20' },
    { min: 20, max: 50, label: '$20-50' },
    { min: 50, max: 100, label: '$50-100' },
    { min: 100, max: Infinity, label: '$100+' }
  ];
  
  const rangoData = rangos.map(rango => {
    const pendientesEnRango = pendientes.filter(m => {
      const monto = parseFloat(m.monto) || 0;
      return monto >= rango.min && monto < rango.max;
    }).length;
    
    const pagadasEnRango = pagadas.filter(m => {
      const monto = parseFloat(m.monto) || 0;
      return monto >= rango.min && monto < rango.max;
    }).length;
    
    return {
      category: rango.label,
      series: [
        { name: 'Pendientes', value: pendientesEnRango, color: '#f97316' },
        { name: 'Pagadas', value: pagadasEnRango, color: '#22c55e' }
      ]
    };
  });
  
  // Multas por mes (últimos 6 meses)
  const multasPorMes = {};
  const mesesOrdenados = [];
  
  data.forEach(m => {
    if (m.fecha_multa) {
      try {
        const fecha = new Date(m.fecha_multa);
        if (!isNaN(fecha.getTime())) {
          const mesKey = fecha.getFullYear() + '-' + String(fecha.getMonth() + 1).padStart(2, '0');
          const mesLabel = fecha.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
          
          if (!multasPorMes[mesKey]) {
            multasPorMes[mesKey] = { valor: 0, label: mesLabel };
            mesesOrdenados.push(mesKey);
          }
          
          multasPorMes[mesKey].valor += (parseFloat(m.monto) || 0);
        }
      } catch (e) {
        console.warn('Fecha inválida en multa:', m);
      }
    }
  });
  
  
  return {
    horizontalBarChart: {
      title: 'Top 10 Afiliados - Mayor Monto en Multas',
      data: topAfiliados
    },
    pieChart: {
      title: 'Distribución por Estado',
      data: [
        { label: 'Pendientes', value: pendientes.length, color: '#f97316' },
        { label: 'Pagadas', value: pagadas.length, color: '#22c55e' },
        { label: 'Anuladas', value: anuladas.length, color: '#6b7280' }
      ].filter(item => item.value > 0)
    },
    pieChart2: {
      title: 'Montos por Estado ($)',
      data: [
        { label: 'Pendiente', value: Math.round(montoPendiente), color: '#f97316' },
        { label: 'Pagado', value: Math.round(montoPagado), color: '#22c55e' },
        { label: 'Anulado', value: Math.round(montoAnulado), color: '#6b7280' }
      ].filter(item => item.value > 0)
    },
    distribution: {
      title: 'Distribución por Tipo de Multa',
      data: tiposMultaData
    },
    barChart: sectoresData.length > 0 ? {
      title: 'Multas por Sector',
      data: sectoresData
    } : null,
    groupedBarChart: {
      title: 'Estados por Rango de Monto',
      data: rangoData,
      series: [
        { name: 'Pendientes', color: '#f97316' },
        { name: 'Pagadas', color: '#22c55e' }
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
      l.num_medidor || 'N/A',
      l.sector || 'N/A',
      `${(l.consumo_m3 || 0).toFixed(2)} m³`,
      l.tipo_lectura || 'N/A'
    ]);
  
  tables.push({
    title: 'Top 10 Mayores Consumos',
    headers: ['#', 'Usuario', 'Medidor', 'Sector', 'Consumo', 'Tipo'],
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
  
  // Filtrar por estado - INCLUIR ANULADAS
  const pagadas = data.filter(f => 
    f.estado?.toLowerCase() === 'pagada' || f.estado_factura?.toLowerCase() === 'pagada'
  );
  const pendientes = data.filter(f => 
    f.estado?.toLowerCase() === 'pendiente' || f.estado_factura?.toLowerCase() === 'pendiente'
  );
  const vencidas = data.filter(f => 
    f.estado?.toLowerCase() === 'vencida' || f.estado_factura?.toLowerCase() === 'vencida'
  );
  const anuladas = data.filter(f => 
    f.estado?.toLowerCase() === 'anulada' || f.estado_factura?.toLowerCase() === 'anulada'
  );
  
  const montoPagado = pagadas.reduce((sum, f) => sum + (parseFloat(f.total_factura || f.total) || 0), 0);
  const montoPendiente = pendientes.reduce((sum, f) => sum + (parseFloat(f.total_factura || f.total) || 0), 0);
  const montoVencido = vencidas.reduce((sum, f) => sum + (parseFloat(f.total_factura || f.total) || 0), 0);
  const montoAnulado = anuladas.reduce((sum, f) => sum + (parseFloat(f.total_factura || f.total) || 0), 0);
  const totalFacturado = montoPagado + montoPendiente + montoVencido + montoAnulado;
  
  // 🚨 CALCULAR DATOS DE MORA
  const facturasConMora = data.filter(f => f.tiene_mora === true);
  const totalMora = facturasConMora.reduce((sum, f) => sum + (parseFloat(f.valor_mora) || 0), 0);
  
  // ============================================
  // TABLA 1: Resumen de Facturación (CON MORA)
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
        'Anuladas',
        anuladas.length,
        `$${montoAnulado.toFixed(2)}`,
        `$${(montoAnulado / (anuladas.length || 1)).toFixed(2)}`,
        `${((montoAnulado / totalFacturado) * 100).toFixed(1)}%`
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
  // 🚨 TABLA 2: Resumen de Mora
  // ============================================
  if (facturasConMora.length > 0) {
    const mesesAdeudoPromedio = facturasConMora.reduce((sum, f) => 
      sum + (parseInt(f.meses_adeudo) || 0), 0
    ) / facturasConMora.length;
    
    const moraPromedio = totalMora / facturasConMora.length;
    const totalConMora = totalFacturado + totalMora;
    
    tables.push({
      title: '🚨 Resumen de Mora',
      headers: ['Métrica', 'Valor'],
      rows: [
        ['Facturas con Mora', facturasConMora.length],
        ['% Facturas con Mora', `${((facturasConMora.length / data.length) * 100).toFixed(1)}%`],
        ['Total Mora Acumulada', `$${totalMora.toFixed(2)}`],
        ['Mora Promedio', `$${moraPromedio.toFixed(2)}`],
        ['Meses Adeudo Promedio', `${mesesAdeudoPromedio.toFixed(1)} meses`],
        ['Total Facturado (sin mora)', `$${totalFacturado.toFixed(2)}`],
        ['Total con Mora', `$${totalConMora.toFixed(2)}`],
        ['Impacto de Mora', `${((totalMora / totalFacturado) * 100).toFixed(1)}%`]
      ]
    });
  }
  
  // ============================================
  // TABLA 3: Rangos de Montos (MEJORADO: 0-10, 10-20...)
  // ============================================
  const rangos = [
    { min: 0, max: 10, label: '$0-10' },
    { min: 10, max: 20, label: '$10-20' },
    { min: 20, max: 30, label: '$20-30' },
    { min: 30, max: 40, label: '$30-40' },
    { min: 40, max: 50, label: '$40-50' },
    { min: 50, max: 100, label: '$50-100' },
    { min: 100, max: Infinity, label: '$100+' }
  ];
  
  const rangosRows = rangos.map(rango => {
    const facturas = data.filter(f => {
      const total = parseFloat(f.total_factura || f.total) || 0;
      return total >= rango.min && total < rango.max;
    });
    const porcentaje = ((facturas.length / data.length) * 100).toFixed(1);
    const montoTotal = facturas.reduce((sum, f) => sum + (parseFloat(f.total_factura || f.total) || 0), 0);
    
    return [
      rango.label,
      facturas.length,
      `${porcentaje}%`,
      `$${montoTotal.toFixed(2)}`
    ];
  }).filter(row => row[1] > 0); // Solo mostrar rangos con datos
  
  tables.push({
    title: 'Distribución por Rangos de Monto',
    headers: ['Rango', 'Cantidad', '% del Total', 'Monto Total'],
    rows: rangosRows
  });
  
  // ============================================
  // 🚨 TABLA 4: Top 10 Facturas con Mayor Mora
  // ============================================
  if (facturasConMora.length > 0) {
    const topMora = [...facturasConMora]
      .sort((a, b) => (parseFloat(b.valor_mora) || 0) - (parseFloat(a.valor_mora) || 0))
      .slice(0, 10)
      .map((f, idx) => [
        idx + 1,
        f.num_factura || 'N/A',
        f.Nombres || f.nombres || 'N/A',
        `$${(parseFloat(f.total_factura || f.total) || 0).toFixed(2)}`,
        `$${(parseFloat(f.valor_mora) || 0).toFixed(2)}`,
        f.meses_adeudo || 0,
        `$${(parseFloat(f.total_con_mora) || 0).toFixed(2)}`
      ]);
    
    tables.push({
      title: '🚨 Top 10 Facturas con Mayor Mora',
      headers: ['#', 'N° Factura', 'Cliente', 'Monto Base', 'Mora', 'Meses', 'Total c/Mora'],
      rows: topMora
    });
  }
  
  // ============================================
  // TABLA 5: Top 10 Facturas Pendientes
  // ============================================
  const topPendientes = pendientes
    .sort((a, b) => (parseFloat(b.total_factura || b.total) || 0) - (parseFloat(a.total_factura || a.total) || 0))
    .slice(0, 10)
    .map((f, idx) => [
      idx + 1,
      f.num_factura || 'N/A',
      f.Nombres || f.nombres || 'N/A',
      `$${(parseFloat(f.total_factura || f.total) || 0).toFixed(2)}`,
      f.tiene_mora ? `$${(parseFloat(f.valor_mora) || 0).toFixed(2)}` : 'Sin mora',
      f.fecha_emision || 'N/A',
      f.sector || 'Sin sector'
    ]);
  
  if (topPendientes.length > 0) {
    tables.push({
      title: 'Top 10 Facturas Pendientes',
      headers: ['#', 'N° Factura', 'Cliente', 'Monto', 'Mora', 'Fecha', 'Sector'],
      rows: topPendientes
    });
  }
  
  // ============================================
  // TABLA 6: Top 10 Facturas Vencidas
  // ============================================
  const topVencidas = vencidas
    .sort((a, b) => (parseFloat(b.total_factura || b.total) || 0) - (parseFloat(a.total_factura || a.total) || 0))
    .slice(0, 10)
    .map((f, idx) => [
      idx + 1,
      f.num_factura || 'N/A',
      f.Nombres || f.nombres || 'N/A',
      `$${(parseFloat(f.total_factura || f.total) || 0).toFixed(2)}`,
      f.tiene_mora ? `$${(parseFloat(f.valor_mora) || 0).toFixed(2)}` : 'Sin mora',
      f.meses_adeudo || 0,
      f.sector || 'Sin sector'
    ]);
  
  if (topVencidas.length > 0) {
    tables.push({
      title: 'Top 10 Facturas Vencidas',
      headers: ['#', 'N° Factura', 'Cliente', 'Monto', 'Mora', 'Meses', 'Sector'],
      rows: topVencidas
    });
  }
  
  // ============================================
  // TABLA 7: Facturación por Mes
  // ============================================
  const meses = {};
  data.forEach(f => {
    const fechaStr = f.fecha_emision || f.fecha_factura;
    if (fechaStr) {
      try {
        let fecha;
        if (fechaStr.includes('/')) {
          const [dia, mes, anio] = fechaStr.split('/');
          fecha = new Date(anio, mes - 1, dia);
        } else {
          fecha = new Date(fechaStr);
        }
        
        if (!isNaN(fecha.getTime())) {
          const mes = fecha.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
          
          if (!meses[mes]) {
            meses[mes] = { count: 0, monto: 0, mora: 0, pagadas: 0, pendientes: 0, vencidas: 0 };
          }
          
          meses[mes].count++;
          meses[mes].monto += (parseFloat(f.total_factura || f.total) || 0);
          meses[mes].mora += (parseFloat(f.valor_mora) || 0);
          
          const estado = (f.estado || f.estado_factura || '').toLowerCase();
          if (estado === 'pagada') meses[mes].pagadas++;
          else if (estado === 'pendiente') meses[mes].pendientes++;
          else if (estado === 'vencida') meses[mes].vencidas++;
        }
      } catch (e) {
        console.error('Error al parsear fecha:', fechaStr);
      }
    }
  });
  
  const mesesRows = Object.entries(meses)
    .sort((a, b) => new Date(b[0]) - new Date(a[0]))
    .slice(0, 6)
    .map(([mes, stats]) => [
      mes,
      stats.count,
      `$${stats.monto.toFixed(2)}`,
      stats.mora > 0 ? `$${stats.mora.toFixed(2)}` : '-',
      stats.pagadas,
      stats.pendientes,
      stats.vencidas
    ]);
  
  if (mesesRows.length > 0) {
    tables.push({
      title: 'Facturación por Mes (Últimos 6 Meses)',
      headers: ['Mes', 'Total', 'Monto', 'Mora', 'Pagadas', 'Pendientes', 'Vencidas'],
      rows: mesesRows
    });
  }
  
  // ============================================
  // TABLA 8: Facturación por Sector
  // ============================================
  const sectores = {};
  data.forEach(f => {
    const sector = f.sector || f.nombre_sector || 'Sin sector';
    if (!sectores[sector]) {
      sectores[sector] = { count: 0, monto: 0, mora: 0 };
    }
    sectores[sector].count++;
    sectores[sector].monto += (parseFloat(f.total_factura || f.total) || 0);
    sectores[sector].mora += (parseFloat(f.valor_mora) || 0);
  });
  
  const sectoresRows = Object.entries(sectores)
    .sort((a, b) => b[1].monto - a[1].monto)
    .slice(0, 10)
    .map(([sector, stats]) => [
      sector,
      stats.count,
      `$${stats.monto.toFixed(2)}`,
      stats.mora > 0 ? `$${stats.mora.toFixed(2)}` : '-',
      `$${(stats.monto / stats.count).toFixed(2)}`
    ]);
  
  if (sectoresRows.length > 0) {
    tables.push({
      title: 'Top 10 Facturación por Sector',
      headers: ['Sector', 'Facturas', 'Monto Total', 'Mora Total', 'Promedio'],
      rows: sectoresRows
    });
  }
  
  // ============================================
  // TABLA 9: Estadísticas Generales
  // ============================================
  const montos = data.map(f => parseFloat(f.total_factura || f.total) || 0).filter(m => m > 0);
  const montoPromedio = montos.length > 0 ? montos.reduce((a, b) => a + b, 0) / montos.length : 0;
  const montoMax = Math.max(...montos, 0);
  const montoMin = Math.min(...montos.filter(m => m > 0), 0);
  
  const montosOrdenados = [...montos].sort((a, b) => a - b);
  const mediana = montosOrdenados.length > 0
    ? montosOrdenados.length % 2 === 0
      ? (montosOrdenados[montosOrdenados.length / 2 - 1] + montosOrdenados[montosOrdenados.length / 2]) / 2
      : montosOrdenados[Math.floor(montosOrdenados.length / 2)]
    : 0;
  
  const tasaCobro = data.length > 0 ? ((pagadas.length / data.length) * 100).toFixed(1) : 0;
  const tasaMorosidad = data.length > 0 ? ((vencidas.length / data.length) * 100).toFixed(1) : 0;
  const tasaAnulacion = data.length > 0 ? ((anuladas.length / data.length) * 100).toFixed(1) : 0;
  
  tables.push({
    title: 'Estadísticas Generales',
    headers: ['Métrica', 'Valor'],
    rows: [
      ['Total de Facturas', data.length],
      ['Facturación Total (sin mora)', `$${totalFacturado.toFixed(2)}`],
      ['Total con Mora', `$${(totalFacturado + totalMora).toFixed(2)}`],
      ['Monto Promedio', `$${montoPromedio.toFixed(2)}`],
      ['Monto Mediano', `$${mediana.toFixed(2)}`],
      ['Monto Máximo', `$${montoMax.toFixed(2)}`],
      ['Monto Mínimo', `$${montoMin.toFixed(2)}`],
      ['Tasa de Cobro', `${tasaCobro}%`],
      ['Tasa de Morosidad', `${tasaMorosidad}%`],
      ['Tasa de Anulación', `${tasaAnulacion}%`],
      ['Por Cobrar', `$${(montoPendiente + montoVencido).toFixed(2)}`],
      ['Sectores Únicos', Object.keys(sectores).length]
    ]
  });
  
  return tables;
};

const generatePagosTable = (data) => {
  const tables = [];
  
  // Filtrar por método
  const efectivo = data.filter(p => 
    p.metodo_pago?.toLowerCase().includes('efectivo') || p.metodopago?.toLowerCase().includes('efectivo')
  );
  const transferencia = data.filter(p => 
    p.metodo_pago?.toLowerCase().includes('transferencia') || p.metodopago?.toLowerCase().includes('transferencia')
  );
  const tarjeta = data.filter(p => 
    p.metodo_pago?.toLowerCase().includes('tarjeta') || p.metodopago?.toLowerCase().includes('tarjeta')
  );
  const otros = data.filter(p => {
    const metodo = (p.metodo_pago || p.metodopago || '').toLowerCase();
    return !metodo.includes('efectivo') && !metodo.includes('transferencia') && !metodo.includes('tarjeta') && metodo !== '';
  });
  
  const montoEfectivo = efectivo.reduce((sum, p) => sum + (parseFloat(p.monto_pagado || p.monto || p.valor) || 0), 0);
  const montoTransferencia = transferencia.reduce((sum, p) => sum + (parseFloat(p.monto_pagado || p.monto || p.valor) || 0), 0);
  const montoTarjeta = tarjeta.reduce((sum, p) => sum + (parseFloat(p.monto_pagado || p.monto || p.valor) || 0), 0);
  const montoOtros = otros.reduce((sum, p) => sum + (parseFloat(p.monto_pagado || p.monto || p.valor) || 0), 0);
  const totalRecaudado = montoEfectivo + montoTransferencia + montoTarjeta + montoOtros;
  
  // 🚨 CALCULAR DATOS DE MORA
  const pagosConMora = data.filter(p => p.tiene_mora === true);
  const totalMoraPagos = pagosConMora.reduce((sum, p) => sum + (parseFloat(p.valor_mora) || 0), 0);
  
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
  // 🚨 TABLA 2: Resumen de Mora en Pagos
  // ============================================
  if (pagosConMora.length > 0) {
    const mesesAdeudoPromedio = pagosConMora.reduce((sum, p) => 
      sum + (parseInt(p.meses_adeudo) || 0), 0
    ) / pagosConMora.length;
    
    const moraPromedio = totalMoraPagos / pagosConMora.length;
    const totalFacturado = data.reduce((sum, p) => sum + (parseFloat(p.total_factura || p.total) || 0), 0);
    
    tables.push({
      title: '🚨 Resumen de Mora en Pagos',
      headers: ['Métrica', 'Valor'],
      rows: [
        ['Pagos con Mora', pagosConMora.length],
        ['% Pagos con Mora', `${((pagosConMora.length / data.length) * 100).toFixed(1)}%`],
        ['Total Mora', `$${totalMoraPagos.toFixed(2)}`],
        ['Mora Promedio', `$${moraPromedio.toFixed(2)}`],
        ['Meses Adeudo Promedio', `${mesesAdeudoPromedio.toFixed(1)} meses`],
        ['Total Recaudado', `$${totalRecaudado.toFixed(2)}`],
        ['Total Facturado', `$${totalFacturado.toFixed(2)}`],
        ['Impacto Mora vs Recaudado', `${((totalMoraPagos / totalRecaudado) * 100).toFixed(1)}%`]
      ]
    });
  }
  
  // ============================================
  // TABLA 3: Rangos de Montos
  // ============================================
  const rangos = [
    { min: 0, max: 10, label: '$0-10' },
    { min: 10, max: 20, label: '$10-20' },
    { min: 20, max: 30, label: '$20-30' },
    { min: 30, max: 50, label: '$30-50' },
    { min: 50, max: 100, label: '$50-100' },
    { min: 100, max: Infinity, label: '$100+' }
  ];
  
  const rangosRows = rangos.map(rango => {
    const pagos = data.filter(p => {
      const monto = parseFloat(p.monto_pagado || p.monto || p.valor) || 0;
      return monto >= rango.min && monto < rango.max;
    });
    const porcentaje = data.length > 0 ? ((pagos.length / data.length) * 100).toFixed(1) : '0.0';
    const montoTotal = pagos.reduce((sum, p) => sum + (parseFloat(p.monto_pagado || p.monto || p.valor) || 0), 0);
    
    return [
      rango.label,
      pagos.length,
      `${porcentaje}%`,
      `$${montoTotal.toFixed(2)}`
    ];
  }).filter(row => row[1] > 0);
  
  tables.push({
    title: 'Distribución por Rangos de Monto',
    headers: ['Rango', 'Cantidad', '% del Total', 'Monto Total'],
    rows: rangosRows
  });
  
  // ============================================
  // 🚨 TABLA 4: Top 10 Pagos con Mayor Mora
  // ============================================
  if (pagosConMora.length > 0) {
    const topMoraPagos = [...pagosConMora]
      .sort((a, b) => (parseFloat(b.valor_mora) || 0) - (parseFloat(a.valor_mora) || 0))
      .slice(0, 10)
      .map((p, idx) => [
        idx + 1,
        p.num_factura || 'N/A',
        p.Nombre || p.nombres || 'N/A',
        `$${(parseFloat(p.monto_pagado) || 0).toFixed(2)}`,
        `$${(parseFloat(p.valor_mora) || 0).toFixed(2)}`,
        p.meses_adeudo || 0,
        p.metodo_pago || 'N/A'
      ]);
    
    tables.push({
      title: '🚨 Top 10 Pagos con Mayor Mora',
      headers: ['#', 'N° Factura', 'Cliente', 'Monto Pagado', 'Mora', 'Meses', 'Método'],
      rows: topMoraPagos
    });
  }
  
  // ============================================
  // TABLA 5: Top 10 Pagos Más Altos
  // ============================================
  const topPagos = [...data]
    .sort((a, b) => (parseFloat(b.monto_pagado || b.monto || b.valor) || 0) - (parseFloat(a.monto_pagado || a.monto || a.valor) || 0))
    .slice(0, 10)
    .map((p, idx) => [
      idx + 1,
      p.num_factura || p.numero_recibo || 'N/A',
      p.Nombre || p.nombres || 'N/A',
      `$${(parseFloat(p.monto_pagado || p.monto || p.valor) || 0).toFixed(2)}`,
      p.tiene_mora ? `$${(parseFloat(p.valor_mora) || 0).toFixed(2)}` : '-',
      p.metodo_pago || p.metodopago || 'N/A',
      p.fecha_pago || p.fecha || 'N/A'
    ]);
  
  tables.push({
    title: 'Top 10 Pagos Más Altos',
    headers: ['#', 'N° Factura', 'Cliente', 'Monto', 'Mora', 'Método', 'Fecha'],
    rows: topPagos.length > 0 ? topPagos : [['Sin datos', '', '', '', '', '', '']]
  });
  
  // ============================================
  // TABLA 6: Recaudación por Mes
  // ============================================
  const meses = {};
  data.forEach(p => {
    const fechaStr = p.fecha_pago || p.fecha;
    if (fechaStr) {
      try {
        let fecha;
        if (fechaStr.includes('/')) {
          const [dia, mes, anio] = fechaStr.split('/');
          fecha = new Date(anio, mes - 1, dia);
        } else {
          fecha = new Date(fechaStr);
        }
        
        if (!isNaN(fecha.getTime())) {
          const mes = fecha.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
          
          if (!meses[mes]) {
            meses[mes] = { count: 0, monto: 0, mora: 0, efectivo: 0, transferencia: 0, tarjeta: 0 };
          }
          
          meses[mes].count++;
          meses[mes].monto += (parseFloat(p.monto_pagado || p.monto || p.valor) || 0);
          meses[mes].mora += (parseFloat(p.valor_mora) || 0);
          
          const metodo = (p.metodo_pago || p.metodopago || '').toLowerCase();
          if (metodo.includes('efectivo')) meses[mes].efectivo++;
          else if (metodo.includes('transferencia')) meses[mes].transferencia++;
          else if (metodo.includes('tarjeta')) meses[mes].tarjeta++;
        }
      } catch (e) {
        console.error('Error al parsear fecha:', fechaStr);
      }
    }
  });
  
  const mesesRows = Object.entries(meses)
    .sort((a, b) => new Date(b[0]) - new Date(a[0]))
    .slice(0, 6)
    .map(([mes, stats]) => [
      mes,
      stats.count,
      `$${stats.monto.toFixed(2)}`,
      stats.mora > 0 ? `$${stats.mora.toFixed(2)}` : '-',
      stats.efectivo,
      stats.transferencia,
      stats.tarjeta
    ]);
  
  if (mesesRows.length > 0) {
    tables.push({
      title: 'Recaudación por Mes (Últimos 6 Meses)',
      headers: ['Mes', 'Total', 'Monto', 'Mora', 'Efectivo', 'Transf.', 'Tarjeta'],
      rows: mesesRows
    });
  }
  
  // ============================================
  // TABLA 7: Recaudación por Día de la Semana
  // ============================================
  const diasSemana = {};
  const diasNombres = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  
  diasNombres.forEach(dia => {
    diasSemana[dia] = { count: 0, monto: 0 };
  });
  
  data.forEach(p => {
    const fechaStr = p.fecha_pago || p.fecha;
    if (fechaStr) {
      try {
        let fecha;
        if (fechaStr.includes('/')) {
          const [dia, mes, anio] = fechaStr.split('/');
          fecha = new Date(anio, mes - 1, dia);
        } else {
          fecha = new Date(fechaStr);
        }
        
        if (!isNaN(fecha.getTime())) {
          const dia = diasNombres[fecha.getDay()];
          if (diasSemana[dia]) {
            diasSemana[dia].count++;
            diasSemana[dia].monto += (parseFloat(p.monto_pagado || p.monto || p.valor) || 0);
          }
        }
      } catch (error) {
        console.warn('Fecha inválida en pago:', p);
      }
    }
  });
  
  const diasRows = Object.entries(diasSemana)
    .filter(([_, stats]) => stats && stats.count > 0)
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
  // TABLA 8: Estadísticas Generales
  // ============================================
  const montos = data.map(p => parseFloat(p.monto_pagado || p.monto || p.valor) || 0).filter(m => m > 0);
  const montoPromedio = montos.length > 0 ? montos.reduce((a, b) => a + b, 0) / montos.length : 0;
  const montoMax = montos.length > 0 ? Math.max(...montos) : 0;
  const montoMin = montos.length > 0 ? Math.min(...montos.filter(m => m > 0)) : 0;
  
  const montosOrdenados = [...montos].sort((a, b) => a - b);
  const mediana = montosOrdenados.length > 0
    ? montosOrdenados.length % 2 === 0
      ? (montosOrdenados[montosOrdenados.length / 2 - 1] + montosOrdenados[montosOrdenados.length / 2]) / 2
      : montosOrdenados[Math.floor(montosOrdenados.length / 2)]
    : 0;
  
  const metodosCount = {
    'Efectivo': efectivo.length,
    'Transferencia': transferencia.length,
    'Tarjeta': tarjeta.length,
    'Otros': otros.length
  };
  const metodoMasUsado = Object.entries(metodosCount)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])[0];
  
  const pagosCompletos = data.filter(p => p.pago_completo === true).length;
  const pagosParciales = data.filter(p => p.pago_completo === false).length;
  
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
      ['Método Más Usado', metodoMasUsado ? `${metodoMasUsado[0]} (${metodoMasUsado[1]})` : 'N/A'],
      ['Pagos Completos', `${pagosCompletos} (${((pagosCompletos / data.length) * 100).toFixed(1)}%)`],
      ['Pagos Parciales', `${pagosParciales} (${((pagosParciales / data.length) * 100).toFixed(1)}%)`],
      ['Efectivo Promedio', `$${(montoEfectivo / (efectivo.length || 1)).toFixed(2)}`],
      ['Transferencia Promedio', `$${(montoTransferencia / (transferencia.length || 1)).toFixed(2)}`],
      ['Tarjeta Promedio', `$${(montoTarjeta / (tarjeta.length || 1)).toFixed(2)}`]
    ]
  });
  
  return tables;
};

const generateMultasTable = (data) => {
  const tables = [];
  
  // ============================================
  // TABLA 1: Resumen por Estado
  // ============================================
  const pendientes = data.filter(m => m.estado === 'pendiente');
  const pagadas = data.filter(m => m.estado === 'pagada');
  const anuladas = data.filter(m => m.estado === 'anulada');
  
  const montoPendiente = pendientes.reduce((sum, m) => sum + (parseFloat(m.monto) || 0), 0);
  const montoPagado = pagadas.reduce((sum, m) => sum + (parseFloat(m.monto) || 0), 0);
  const montoAnulado = anuladas.reduce((sum, m) => sum + (parseFloat(m.monto) || 0), 0);
  const montoTotal = montoPendiente + montoPagado + montoAnulado;
  
  tables.push({
    title: 'Resumen por Estado',
    headers: ['Estado', 'Cantidad', 'Monto Total', 'Promedio', '% del Total'],
    rows: [
      [
        'Pendientes',
        pendientes.length,
        `$${montoPendiente.toFixed(2)}`,
        `$${(pendientes.length > 0 ? montoPendiente / pendientes.length : 0).toFixed(2)}`,
        `${((pendientes.length / data.length) * 100).toFixed(1)}%`
      ],
      [
        'Pagadas',
        pagadas.length,
        `$${montoPagado.toFixed(2)}`,
        `$${(pagadas.length > 0 ? montoPagado / pagadas.length : 0).toFixed(2)}`,
        `${((pagadas.length / data.length) * 100).toFixed(1)}%`
      ],
      [
        'Anuladas',
        anuladas.length,
        `$${montoAnulado.toFixed(2)}`,
        `$${(anuladas.length > 0 ? montoAnulado / anuladas.length : 0).toFixed(2)}`,
        `${((anuladas.length / data.length) * 100).toFixed(1)}%`
      ],
      [
        'TOTAL',
        data.length,
        `$${montoTotal.toFixed(2)}`,
        `$${(data.length > 0 ? montoTotal / data.length : 0).toFixed(2)}`,
        '100%'
      ]
    ]
  });
  
  // ============================================
  // TABLA 2: Resumen por Tipo de Multa
  // ============================================
  const tiposMulta = {};
  data.forEach(m => {
    const tipo = m.nombre_multa || 'Sin tipo';
    if (!tiposMulta[tipo]) {
      tiposMulta[tipo] = { count: 0, montoTotal: 0, pendientes: 0 };
    }
    tiposMulta[tipo].count++;
    tiposMulta[tipo].montoTotal += (parseFloat(m.monto) || 0);
    if (m.estado === 'pendiente') {
      tiposMulta[tipo].pendientes++;
    }
  });
  
  const tiposMultaRows = Object.entries(tiposMulta)
    .sort((a, b) => b[1].montoTotal - a[1].montoTotal)
    .map(([tipo, stats]) => [
      tipo,
      stats.count,
      `$${stats.montoTotal.toFixed(2)}`,
      `$${(stats.montoTotal / stats.count).toFixed(2)}`,
      stats.pendientes
    ]);
  
  tables.push({
    title: 'Resumen por Tipo de Multa',
    headers: ['Tipo de Multa', 'Cantidad', 'Monto Total', 'Promedio', 'Pendientes'],
    rows: tiposMultaRows
  });
  
  // ============================================
  // TABLA 3: Top 10 Afiliados con Mayores Multas
  // ============================================
  const multasPorAfiliado = {};
  data.forEach(m => {
    const cod = m.cod_usuario_afi || 'N/A';
    const nombre = m.nombre_completo || 'N/A';
    const medidor = m.medidor || 'Sin medidor';
    const sector = m.sector || 'Sin sector';
    
    if (!multasPorAfiliado[cod]) {
      multasPorAfiliado[cod] = {
        nombre,
        medidor,
        sector,
        monto: 0,
        cantidad: 0,
        pendientes: 0
      };
    }
    
    multasPorAfiliado[cod].monto += (parseFloat(m.monto) || 0);
    multasPorAfiliado[cod].cantidad += 1;
    if (m.estado === 'pendiente') {
      multasPorAfiliado[cod].pendientes += 1;
    }
  });
  
  const topAfiliados = Object.entries(multasPorAfiliado)
    .sort((a, b) => b[1].monto - a[1].monto)
    .slice(0, 10)
    .map(([cod, stats], idx) => [
      idx + 1,
      cod,
      stats.nombre,
      stats.medidor,
      stats.sector,
      stats.cantidad,
      `$${stats.monto.toFixed(2)}`,
      stats.pendientes
    ]);
  
  tables.push({
    title: 'Top 10 Afiliados con Mayores Multas',
    headers: ['#', 'Código', 'Afiliado', 'Medidor', 'Sector', 'Total Multas', 'Monto Total', 'Pendientes'],
    rows: topAfiliados.length > 0 ? topAfiliados : [['Sin datos', '', '', '', '', '', '', '']]
  });
  
  // ============================================
  // TABLA 4: Multas por Sector
  // ============================================
  const multasPorSector = {};
  data.forEach(m => {
    const sector = m.sector || 'Sin sector';
    if (!multasPorSector[sector]) {
      multasPorSector[sector] = { count: 0, monto: 0, pendientes: 0 };
    }
    multasPorSector[sector].count++;
    multasPorSector[sector].monto += (parseFloat(m.monto) || 0);
    if (m.estado === 'pendiente') {
      multasPorSector[sector].pendientes++;
    }
  });
  
  const sectoresRows = Object.entries(multasPorSector)
    .sort((a, b) => b[1].monto - a[1].monto)
    .map(([sector, stats]) => [
      sector,
      stats.count,
      `$${stats.monto.toFixed(2)}`,
      `$${(stats.monto / stats.count).toFixed(2)}`,
      stats.pendientes,
      `${((stats.count / data.length) * 100).toFixed(1)}%`
    ]);
  
  tables.push({
    title: 'Multas por Sector',
    headers: ['Sector', 'Cantidad', 'Monto Total', 'Promedio', 'Pendientes', '% del Total'],
    rows: sectoresRows
  });
  
  // ============================================
  // TABLA 5: Rangos de Montos
  // ============================================
  const rangos = [
    { min: 0, max: 10, label: 'Muy Bajo ($0-10)' },
    { min: 10, max: 20, label: 'Bajo ($10-20)' },
    { min: 20, max: 50, label: 'Medio ($20-50)' },
    { min: 50, max: 100, label: 'Alto ($50-100)' },
    { min: 100, max: Infinity, label: 'Muy Alto ($100+)' }
  ];
  
  const rangosRows = rangos.map(rango => {
    const multasEnRango = data.filter(m => {
      const monto = parseFloat(m.monto) || 0;
      return monto >= rango.min && monto < rango.max;
    });
    
    const pendientesEnRango = multasEnRango.filter(m => m.estado === 'pendiente').length;
    const porcentaje = ((multasEnRango.length / data.length) * 100).toFixed(1);
    const montoTotal = multasEnRango.reduce((sum, m) => sum + (parseFloat(m.monto) || 0), 0);
    
    return [
      rango.label,
      multasEnRango.length,
      `${porcentaje}%`,
      `$${montoTotal.toFixed(2)}`,
      pendientesEnRango
    ];
  });
  
  tables.push({
    title: 'Distribución por Rangos de Monto',
    headers: ['Rango', 'Cantidad', '% del Total', 'Monto Total', 'Pendientes'],
    rows: rangosRows
  });
  
  // ============================================
  // TABLA 6: Estado de Facturación
  // ============================================
  const facturadas = data.filter(m => m.facturado === true);
  const noFacturadas = data.filter(m => m.facturado === false);
  
  const montoFacturado = facturadas.reduce((sum, m) => sum + (parseFloat(m.monto) || 0), 0);
  const montoNoFacturado = noFacturadas.reduce((sum, m) => sum + (parseFloat(m.monto) || 0), 0);
  
  tables.push({
    title: 'Estado de Facturación',
    headers: ['Estado', 'Cantidad', 'Monto Total', '% del Total'],
    rows: [
      [
        'Facturadas',
        facturadas.length,
        `$${montoFacturado.toFixed(2)}`,
        `${((facturadas.length / data.length) * 100).toFixed(1)}%`
      ],
      [
        'No Facturadas',
        noFacturadas.length,
        `$${montoNoFacturado.toFixed(2)}`,
        `${((noFacturadas.length / data.length) * 100).toFixed(1)}%`
      ]
    ]
  });
  
  // ============================================
  // TABLA 7: Estadísticas Generales
  // ============================================
  const montos = data.map(m => parseFloat(m.monto) || 0).filter(m => m > 0);
  const montoTotalGeneral = montos.reduce((sum, m) => sum + m, 0);
  const montoPromedio = montos.length > 0 ? montoTotalGeneral / montos.length : 0;
  const montoMax = Math.max(...montos, 0);
  const montoMin = Math.min(...montos.filter(m => m > 0), 0);
  
  // Calcular mediana
  const montosOrdenados = [...montos].sort((a, b) => a - b);
  const mediana = montosOrdenados.length > 0
    ? montosOrdenados.length % 2 === 0
      ? (montosOrdenados[montosOrdenados.length / 2 - 1] + montosOrdenados[montosOrdenados.length / 2]) / 2
      : montosOrdenados[Math.floor(montosOrdenados.length / 2)]
    : 0;
  
  const tasaCobro = data.length > 0 ? ((pagadas.length / data.length) * 100).toFixed(1) : '0.0';
  const tasaFacturacion = data.length > 0 ? ((facturadas.length / data.length) * 100).toFixed(1) : '0.0';
  
  tables.push({
    title: 'Estadísticas Generales',
    headers: ['Métrica', 'Valor'],
    rows: [
      ['Total de Multas', data.length],
      ['Multas Activas', data.filter(m => m.activo === true).length],
      ['Monto Total', `$${montoTotalGeneral.toFixed(2)}`],
      ['Monto Promedio', `$${montoPromedio.toFixed(2)}`],
      ['Monto Mediano', `$${mediana.toFixed(2)}`],
      ['Monto Máximo', `$${montoMax.toFixed(2)}`],
      ['Monto Mínimo', `$${montoMin.toFixed(2)}`],
      ['Tasa de Cobro', `${tasaCobro}%`],
      ['Tasa de Facturación', `${tasaFacturacion}%`],
      ['Tipos de Multa Únicos', Object.keys(tiposMulta).length],
      ['Sectores con Multas', Object.keys(multasPorSector).length],
      ['Afiliados con Multas', Object.keys(multasPorAfiliado).length]
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
