import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ChevronDown } from 'lucide-react';
import type { SportBreakdown } from '@/lib/types';
import { useCurrency } from '@/contexts/CurrencyContext';

interface SportsTableProps {
  data: SportBreakdown[];
}

const SportsTable = ({ data }: SportsTableProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const { convert, symbol } = useCurrency();

  return (
    <div className="kpi-card !p-0 overflow-hidden">
      <button onClick={() => setIsOpen(!isOpen)} className="section-toggle w-full flex items-center justify-between px-5 py-3.5">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Sports Breakdown</h3>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="px-5 pb-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-muted-foreground mb-2">Turnover by Sport</p>
              <ResponsiveContainer width="100%" height={Math.max(200, data.length * 36)}>
                <BarChart data={data} layout="vertical" margin={{ left: 80, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
                  <XAxis type="number" tick={{ fill: 'hsl(215 12% 52%)', fontSize: 11 }} tickFormatter={(v) => `${symbol}${(Math.abs(convert(v)) / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="sport" tick={{ fill: 'hsl(215 12% 52%)', fontSize: 11 }} width={75} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e1e1e', border: '1px solid #00e554', borderRadius: '8px' }}
                    labelStyle={{ color: '#ffffff' }}
                    itemStyle={{ color: '#ffffff' }}
                    formatter={(v: number) => [`${symbol}${Math.round(convert(v)).toLocaleString()}`, 'Turnover']}
                  />
                  <Bar dataKey="turnover" fill="#00e554" radius={[0, 4, 4, 0]} name="Turnover" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-2">P&L by Sport</p>
              <ResponsiveContainer width="100%" height={Math.max(200, data.length * 36)}>
                <BarChart data={data} layout="vertical" margin={{ left: 80, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
                  <XAxis type="number" tick={{ fill: 'hsl(215 12% 52%)', fontSize: 11 }} tickFormatter={(v) => `${symbol}${(Math.abs(convert(v)) / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="sport" tick={{ fill: 'hsl(215 12% 52%)', fontSize: 11 }} width={75} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e1e1e', border: '1px solid #00e554', borderRadius: '8px' }}
                    labelStyle={{ color: '#ffffff' }}
                    itemStyle={{ color: '#ffffff' }}
                    formatter={(v: number) => [`${symbol}${Math.round(convert(v)).toLocaleString()}`, 'P&L']}
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
      )}
    </div>
  );
};

export default SportsTable;
