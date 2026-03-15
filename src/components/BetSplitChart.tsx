import { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { ChevronDown } from 'lucide-react';
import type { BetSplit } from '@/lib/types';
import { useCurrency } from '@/contexts/CurrencyContext';

interface BetSplitChartProps {
  data: BetSplit[];
}

const BetSplitChart = ({ data }: BetSplitChartProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { convert, symbol } = useCurrency();

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
    <div className="kpi-card !p-0 overflow-hidden">
      <button onClick={() => setIsOpen(!isOpen)} className="section-toggle w-full flex items-center justify-between px-5 py-3.5">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Live vs Pre-Match</h3>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="px-5 pb-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground text-center mb-2">Bets</p>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={betsData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" strokeWidth={0}>
                    {betsData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1e1e1e', border: '1px solid #00e554', borderRadius: '8px' }} labelStyle={{ color: '#ffffff' }} itemStyle={{ color: '#ffffff' }} />
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
                  <Tooltip contentStyle={{ backgroundColor: '#1e1e1e', border: '1px solid #00e554', borderRadius: '8px' }} labelStyle={{ color: '#ffffff' }} itemStyle={{ color: '#ffffff' }} formatter={(v: number) => `${symbol}${Math.round(convert(v)).toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="flex justify-center gap-6 mt-2">
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ background: COLORS[0] }} /><span className="text-xs text-muted-foreground">Live</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ background: COLORS[1] }} /><span className="text-xs text-muted-foreground">Pre-match</span></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BetSplitChart;
