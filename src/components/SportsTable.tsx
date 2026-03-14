import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { SportBreakdown } from '@/lib/types';

interface SportsTableProps {
  data: SportBreakdown[];
}

const SportsTable = ({ data }: SportsTableProps) => {
  return (
    <div className="kpi-card">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Sports Breakdown</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Turnover per sport */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Turnover by Sport</p>
          <ResponsiveContainer width="100%" height={Math.max(200, data.length * 36)}>
            <BarChart data={data} layout="vertical" margin={{ left: 80, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
              <XAxis type="number" tick={{ fill: 'hsl(215 12% 52%)', fontSize: 11 }} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="sport" tick={{ fill: 'hsl(215 12% 52%)', fontSize: 11 }} width={75} />
              <Tooltip
                contentStyle={{ background: '#1e1e1e', border: '1px solid #00e554', borderRadius: 8, color: '#ffffff' }}
                labelStyle={{ color: '#ffffff' }}
                formatter={(v: number) => [`€${v.toLocaleString()}`, 'Turnover']}
              />
              <Bar dataKey="turnover" fill="#00e554" radius={[0, 4, 4, 0]} name="Turnover" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* P&L per sport */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">P&L by Sport</p>
          <ResponsiveContainer width="100%" height={Math.max(200, data.length * 36)}>
            <BarChart data={data} layout="vertical" margin={{ left: 80, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
              <XAxis type="number" tick={{ fill: 'hsl(215 12% 52%)', fontSize: 11 }} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="sport" tick={{ fill: 'hsl(215 12% 52%)', fontSize: 11 }} width={75} />
              <Tooltip
                contentStyle={{ background: '#1e1e1e', border: '1px solid #00e554', borderRadius: 8, color: '#ffffff' }}
                labelStyle={{ color: '#ffffff' }}
                formatter={(v: number) => [`€${v.toLocaleString()}`, 'P&L']}
              />
              <Bar dataKey="pnl" radius={[0, 4, 4, 0]} name="P&L">
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.pnl >= 0 ? '#00e554' : '#ff4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default SportsTable;
