import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChevronDown } from 'lucide-react';
import type { MarketPattern } from '@/lib/types';
import { useCurrency } from '@/contexts/CurrencyContext';

interface MarketPatternChartProps {
  data: MarketPattern[];
}

const MarketPatternChart = ({ data }: MarketPatternChartProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { convert, symbol } = useCurrency();

  return (
    <div className="kpi-card !p-0 overflow-hidden">
      <button onClick={() => setIsOpen(!isOpen)} className="section-toggle w-full flex items-center justify-between px-5 py-3.5">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Market Patterns</h3>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="px-5 pb-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-muted-foreground mb-2">By Count</p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data} layout="vertical" margin={{ left: 100 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
                  <XAxis type="number" tick={{ fill: 'hsl(215 12% 52%)', fontSize: 11 }} />
                  <YAxis type="category" dataKey="market" tick={{ fill: 'hsl(215 12% 52%)', fontSize: 11 }} width={95} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e1e1e', border: '1px solid #00e554', borderRadius: '8px' }} labelStyle={{ color: '#ffffff' }} itemStyle={{ color: '#ffffff' }} />
                  <Bar dataKey="count" fill="hsl(142 72% 45%)" radius={[0, 4, 4, 0]} name="Count" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2">By Turnover</p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data} layout="vertical" margin={{ left: 100 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
                  <XAxis type="number" tick={{ fill: 'hsl(215 12% 52%)', fontSize: 11 }} tickFormatter={(v) => `${symbol}${(Math.abs(convert(v)) / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="market" tick={{ fill: 'hsl(215 12% 52%)', fontSize: 11 }} width={95} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e1e1e', border: '1px solid #00e554', borderRadius: '8px' }} labelStyle={{ color: '#ffffff' }} itemStyle={{ color: '#ffffff' }} formatter={(v: number) => `${symbol}${Math.round(convert(v)).toLocaleString()}`} />
                  <Bar dataKey="turnover" fill="hsl(38 92% 55%)" radius={[0, 4, 4, 0]} name="Turnover" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketPatternChart;
