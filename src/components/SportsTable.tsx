import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { SportBreakdown } from '@/lib/types';

interface SportsTableProps {
  data: SportBreakdown[];
}

const SportsTable = ({ data }: SportsTableProps) => {
  return (
    <div className="kpi-card">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Sports Breakdown</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Sport</th>
                <th>Bets</th>
                <th>Turnover</th>
                <th>P&L</th>
                <th>Margin</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.sport}>
                  <td className="font-sans font-medium">{row.sport}</td>
                  <td>{row.bets.toLocaleString()}</td>
                  <td>${row.turnover.toLocaleString()}</td>
                  <td className={row.pnl >= 0 ? 'value-positive' : 'value-negative'}>
                    {row.pnl >= 0 ? '+' : ''}${row.pnl.toLocaleString()}
                  </td>
                  <td className={row.margin >= 0 ? 'value-positive' : 'value-negative'}>
                    {row.margin.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} layout="vertical" margin={{ left: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
            <XAxis type="number" tick={{ fill: 'hsl(215 12% 52%)', fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <YAxis type="category" dataKey="sport" tick={{ fill: 'hsl(215 12% 52%)', fontSize: 11 }} width={60} />
            <Tooltip contentStyle={{ background: 'hsl(220 18% 10%)', border: '1px solid hsl(220 14% 18%)', borderRadius: 8, color: 'hsl(210 20% 92%)' }} formatter={(v: number) => `$${v.toLocaleString()}`} />
            <Bar dataKey="turnover" fill="hsl(199 89% 48%)" radius={[0, 4, 4, 0]} name="Turnover" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default SportsTable;
