import React from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface ChartConfig {
  type: 'line' | 'bar' | 'pie' | 'table';
  title: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  colors: string[];
}

interface ReportChartProps {
  data: ChartDataPoint[];
  config: ChartConfig;
  loading?: boolean;
  error?: string | null;
  height?: number;
}

const CHART_COLORS = [
  '#E8B4A8', '#C9A87C', '#8B7355', '#6B5344', '#4A3728',
  '#D4A574', '#B8860B', '#CD853F', '#D2691E', '#A0522D',
];

export function ReportChart({
  data,
  config,
  loading = false,
  error = null,
  height = 400,
}: ReportChartProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[400px] bg-nilin-blush/20 rounded-xl">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-nilin-coral border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-nilin-warmGray font-sans">Loading chart...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[400px] bg-red-50 rounded-xl border border-red-200">
        <div className="flex flex-col items-center gap-2 text-center px-6">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-red-800 font-sans">{error}</p>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] bg-nilin-blush/20 rounded-xl">
        <div className="flex flex-col items-center gap-2 text-center px-6">
          <div className="w-12 h-12 rounded-full bg-nilin-blush flex items-center justify-center">
            <svg className="w-6 h-6 text-nilin-warmGray" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-sm text-nilin-warmGray font-sans">No data available for this report</p>
          <p className="text-xs text-nilin-warmGray/80 font-sans">Try adjusting your filters or date range</p>
        </div>
      </div>
    );
  }

  const colors = config.colors?.length > 0 ? config.colors : CHART_COLORS;

  const renderChart = () => {
    switch (config.type) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E0D8" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#6B5344' }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#6B5344' }}
                label={{ value: config.yAxisLabel || 'Value', angle: -90, position: 'insideLeft', style: { fill: '#6B5344', fontSize: 11 } }}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid #E8E0D8',
                  fontFamily: 'system-ui',
                }}
                formatter={(value: number) => [value.toLocaleString(), config.yAxisLabel || 'Value']}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#C9A87C"
                strokeWidth={2}
                dot={{ fill: '#C9A87C', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: '#E8B4A8' }}
                name={config.title}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E0D8" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#6B5344' }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#6B5344' }}
                label={{ value: config.yAxisLabel || 'Value', angle: -90, position: 'insideLeft', style: { fill: '#6B5344', fontSize: 11 } }}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid #E8E0D8',
                  fontFamily: 'system-ui',
                }}
                formatter={(value: number) => [value.toLocaleString(), config.yAxisLabel || 'Value']}
              />
              <Legend />
              <Bar dataKey="value" fill="#C9A87C" radius={[4, 4, 0, 0]} name={config.title} />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ label, percent }) => `${label}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
                nameKey="label"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color || colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid #E8E0D8',
                  fontFamily: 'system-ui',
                }}
                formatter={(value: number) => [value.toLocaleString(), 'Value']}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'table':
      default:
        return (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-sans">
              <thead>
                <tr className="border-b border-nilin-border/50">
                  <th className="text-left py-3 px-4 font-medium text-nilin-warmGray">Label</th>
                  <th className="text-right py-3 px-4 font-medium text-nilin-warmGray">Value</th>
                  <th className="text-right py-3 px-4 font-medium text-nilin-warmGray">Percentage</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item, index) => {
                  const total = data.reduce((sum, d) => sum + d.value, 0);
                  const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0';
                  return (
                    <tr key={index} className="border-b border-nilin-border/30 hover:bg-nilin-blush/20 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: item.color || colors[index % colors.length] }}
                          />
                          <span className="text-nilin-charcoal">{item.label}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right text-nilin-charcoal font-medium">
                        {item.value.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right text-nilin-warmGray">
                        {percentage}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl border border-nilin-border/50 p-4">
      {config.title && (
        <h3 className="text-lg font-serif text-nilin-charcoal mb-4">{config.title}</h3>
      )}
      {renderChart()}
    </div>
  );
}

export default ReportChart;
