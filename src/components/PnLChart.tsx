import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import type { HistoryEntry } from '@/hooks/useDashboardHistory';

interface PnLChartProps {
  history: HistoryEntry[];
  selectedId: string | null;
  onSelectDay: (id: string) => void;
}

const PnLChart = ({ history, selectedId, onSelectDay }: PnLChartProps) => {
  const chartData = history
    .filter(entry => entry.data?.kpiSummary)
    .map(entry => ({
      date: entry.data.dailyPnL?.[0]?.date ?? entry.label,
      pnl: entry.data.kpiSummary.pnl,
      id: entry.id,
    }));

  const handleClick = (data: any) => {
    if (data?.activePayload?.[0]?.payload?.id) {
      onSelectDay(data.activePayload[0].payload.id);
    }
  };

  return (
    <div className="kpi-card">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Daily P&L</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }} onClick={handleClick} style={{ cursor: 'pointer' }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
          <XAxis dataKey="date" tick={{ fill: 'hsl(215 12% 52%)', fontSize: 11 }} />
          <YAxis tick={{ fill: 'hsl(215 12% 52%)', fontSize: 11 }} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
          <Tooltip
            contentStyle={{ background: '#1e1e1e', border: '1px solid #00e554', borderRadius: 8, color: '#ffffff' }}
            labelStyle={{ color: '#888888' }}
            formatter={(value: number) => [`€${value.toLocaleString()}`, 'P&L']}
            cursor={{ fill: 'hsl(220 14% 18% / 0.5)' }}
          />
          <ReferenceLine y={0} stroke="hsl(215 12% 52%)" strokeDasharray="3 3" />
          <Bar dataKey="pnl" radius={[4, 4, 0, 0]} name="P&L">
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.pnl >= 0 ? 'hsl(142 72% 45%)' : 'hsl(0 72% 55%)'}
                opacity={selectedId && selectedId !== entry.id ? 0.3 : 1}
                stroke={selectedId === entry.id ? 'hsl(210 20% 92%)' : 'none'}
                strokeWidth={selectedId === entry.id ? 2 : 0}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-muted-foreground text-center mt-2">Click a bar to view that day</p>
    </div>
  );
};

export default PnLChart;
