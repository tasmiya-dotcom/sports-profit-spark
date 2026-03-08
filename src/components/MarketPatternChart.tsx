import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { MarketPattern } from '@/lib/types';

interface MarketPatternChartProps {
  data: MarketPattern[];
}

const MarketPatternChart = ({ data }: MarketPatternChartProps) => {
  return (
    <div className="kpi-card">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Market Patterns</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <p className="text-xs text-muted-foreground mb-2">By Count</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data} layout="vertical" margin={{ left: 100 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
              <XAxis type="number" tick={{ fill: 'hsl(215 12% 52%)', fontSize: 11 }} />
              <YAxis type="category" dataKey="market" tick={{ fill: 'hsl(215 12% 52%)', fontSize: 11 }} width={95} />
              <Tooltip contentStyle={{ background: 'hsl(220 18% 10%)', border: '1px solid hsl(220 14% 18%)', borderRadius: 8, color: 'hsl(210 20% 92%)' }} />
              <Bar dataKey="count" fill="hsl(142 72% 45%)" radius={[0, 4, 4, 0]} name="Count" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-2">By Turnover</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data} layout="vertical" margin={{ left: 100 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
              <XAxis type="number" tick={{ fill: 'hsl(215 12% 52%)', fontSize: 11 }} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="market" tick={{ fill: 'hsl(215 12% 52%)', fontSize: 11 }} width={95} />
              <Tooltip contentStyle={{ background: 'hsl(220 18% 10%)', border: '1px solid hsl(220 14% 18%)', borderRadius: 8, color: 'hsl(210 20% 92%)' }} formatter={(v: number) => `€${v.toLocaleString()}`} />
              <Bar dataKey="turnover" fill="hsl(38 92% 55%)" radius={[0, 4, 4, 0]} name="Turnover" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default MarketPatternChart;
