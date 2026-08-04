import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  TooltipProps,
} from 'recharts';

interface LineChartComponentProps {
  data: Array<{ name: string | number; value: number }>;
  xLabel?: string;
  yLabel?: string;
  color?: string;
  height?: number;
}

const CustomTooltip: React.FC<TooltipProps<any, any>> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
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
          {typeof payload[0].value === 'number'
            ? payload[0].value.toLocaleString(undefined, { maximumFractionDigits: 4 })
            : payload[0].value}
        </p>
      </div>
    );
  }
  return null;
};

const LineChartComponent: React.FC<LineChartComponentProps> = ({
  data,
  xLabel,
  yLabel,
  color = '#0284c7',
  height = 320,
}) => {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
        data={data}
        margin={{ top: 10, right: 20, left: 10, bottom: xLabel ? 30 : 10 }}
      >
        <defs>
          <linearGradient id="lineAreaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.12} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
          axisLine={{ stroke: 'var(--border-default)' }}
          tickLine={false}
          interval="preserveStartEnd"
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
          domain={['auto', 'auto']}
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
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={{ r: 3, fill: color, stroke: 'var(--bg-surface)', strokeWidth: 1.5 }}
          activeDot={{ r: 5, fill: color, stroke: 'var(--bg-surface)', strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default LineChartComponent;
