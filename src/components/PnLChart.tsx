import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { DailyPnL } from '@/lib/types';

interface PnLChartProps {
  data: DailyPnL[];
}

const PnLChart = ({ data }: PnLChartProps) => {
  return (
    <div className="kpi-card">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Daily P&L</h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
          <XAxis dataKey="date" tick={{ fill: 'hsl(215 12% 52%)', fontSize: 11 }} />
          <YAxis tick={{ fill: 'hsl(215 12% 52%)', fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
          <Tooltip
            contentStyle={{ background: 'hsl(220 18% 10%)', border: '1px solid hsl(220 14% 18%)', borderRadius: 8, color: 'hsl(210 20% 92%)' }}
            formatter={(value: number) => [`$${value.toLocaleString()}`, 'P&L']}
          />
          <ReferenceLine y={0} stroke="hsl(215 12% 52%)" strokeDasharray="3 3" />
          <Bar
            dataKey="pnl"
            radius={[4, 4, 0, 0]}
            fill="hsl(142 72% 45%)"
            name="P&L"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PnLChart;
