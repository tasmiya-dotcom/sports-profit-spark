import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { BetSplit } from '@/lib/types';

interface BetSplitChartProps {
  data: BetSplit[];
}

const BetSplitChart = ({ data }: BetSplitChartProps) => {
  if (!data.length) return null;

  const d = data[0];
  const betsData = [
    { name: 'Live', value: d.liveBets },
    { name: 'Pre-match', value: d.prematchBets },
  ];
  const turnoverData = [
    { name: 'Live', value: d.liveTurnover },
    { name: 'Pre-match', value: d.prematchTurnover },
  ];

  const COLORS = ['#00e554', '#444444'];

  return (
    <div className="kpi-card">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Live vs Pre-Match</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-muted-foreground text-center mb-2">Bets</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={betsData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" strokeWidth={0}>
                {betsData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#1e1e1e', border: '1px solid #00e554', borderRadius: 8, color: '#ffffff' }} labelStyle={{ color: '#888888' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div>
          <p className="text-xs text-muted-foreground text-center mb-2">Turnover</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={turnoverData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" strokeWidth={0}>
                {turnoverData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: 'hsl(220 18% 10%)', border: '1px solid hsl(220 14% 18%)', borderRadius: 8, color: '#ffffff' }} labelStyle={{ color: '#ffffff' }} formatter={(v: number) => `€${v.toLocaleString()}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="flex justify-center gap-6 mt-2">
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ background: COLORS[0] }} /><span className="text-xs text-muted-foreground">Live</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ background: COLORS[1] }} /><span className="text-xs text-muted-foreground">Pre-match</span></div>
      </div>
    </div>
  );
};

export default BetSplitChart;
