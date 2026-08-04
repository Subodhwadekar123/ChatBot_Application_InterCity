import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  TooltipProps,
} from 'recharts';

interface BarChartComponentProps {
  data: Array<{ name: string; value: number }>;
  xLabel?: string;
  yLabel?: string;
  color?: string;
  height?: number;
}

interface CustomTooltipPayload {
  name: string;
  value: number;
}

const CustomTooltip: React.FC<TooltipProps<any, any>> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const item = payload[0] as { payload: CustomTooltipPayload; value: number };
    return (
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: '8px',
          padding: '8px 12px',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <p style={{ color: 'var(--text-secondary)', fontSize: '11px', margin: 0, marginBottom: '2px', fontWeight: 600 }}>{label}</p>
        <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 700, margin: 0 }}>
          {typeof item.value === 'number' ? item.value.toLocaleString(undefined, { maximumFractionDigits: 4 }) : item.value}
        </p>
      </div>
    );
  }
  return null;
};

const BarChartComponent: React.FC<BarChartComponentProps> = ({
  data,
  xLabel,
  yLabel,
  color = '#0284c7',
  height = 320,
}) => {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        margin={{ top: 10, right: 20, left: 10, bottom: xLabel ? 30 : 10 }}
      >
        <defs>
          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={1} />
            <stop offset="100%" stopColor={color} stopOpacity={0.75} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
          axisLine={{ stroke: 'var(--border-default)' }}
          tickLine={false}
          label={
            xLabel
              ? { value: xLabel, position: 'insideBottom', offset: -16, fill: 'var(--text-secondary)', fontSize: 11 }
              : undefined
          }
        />
        <YAxis
          tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={yLabel ? 60 : 45}
          label={
            yLabel
              ? { value: yLabel, angle: -90, position: 'insideLeft', fill: 'var(--text-secondary)', fontSize: 11 }
              : undefined
          }
          tickFormatter={(v: number) =>
            v >= 1_000_000
              ? `${(v / 1_000_000).toFixed(1)}M`
              : v >= 1_000
              ? `${(v / 1_000).toFixed(1)}k`
              : String(v)
          }
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--accent-primary-light)' }} />
        <Bar
          dataKey="value"
          fill="url(#barGradient)"
          radius={[4, 4, 0, 0]}
          maxBarSize={48}
        />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default BarChartComponent;
