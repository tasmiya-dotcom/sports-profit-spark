import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { HistoryEntry } from '@/hooks/useDashboardHistory';
import { useCurrency } from '@/contexts/CurrencyContext';

interface Props {
  history: HistoryEntry[];
}

const SevenDaySummary = ({ history }: Props) => {
  const { fmt, fmtSigned } = useCurrency();

  const stats = useMemo(() => {
    if (history.length < 2) return null;

    const sorted = [...history].sort((a, b) => a.id.localeCompare(b.id));
    const recent7 = sorted.slice(-7);

    const avg = (entries: typeof recent7) => {
      const n = entries.length;
      if (n === 0) return { bets: 0, turnover: 0, pnl: 0, margin: 0 };
      const totals = entries.reduce(
        (acc, e) => ({
          bets: acc.bets + e.data.kpiSummary.bets,
          turnover: acc.turnover + e.data.kpiSummary.turnover,
          pnl: acc.pnl + e.data.kpiSummary.pnl,
          margin: acc.margin + e.data.kpiSummary.margin,
        }),
        { bets: 0, turnover: 0, pnl: 0, margin: 0 }
      );
      return {
        bets: Math.round(totals.bets / n),
        turnover: totals.turnover / n,
        pnl: totals.pnl / n,
        margin: totals.margin / n,
      };
    };

    const current = avg(recent7);

    let trend: Record<string, 'up' | 'down' | 'neutral'> | null = null;
    if (sorted.length >= 14) {
      const prev7 = sorted.slice(-14, -7);
      const previous = avg(prev7);
      trend = {
        bets: current.bets > previous.bets ? 'up' : current.bets < previous.bets ? 'down' : 'neutral',
        turnover: current.turnover > previous.turnover ? 'up' : current.turnover < previous.turnover ? 'down' : 'neutral',
        pnl: current.pnl > previous.pnl ? 'up' : current.pnl < previous.pnl ? 'down' : 'neutral',
        margin: current.margin > previous.margin ? 'up' : current.margin < previous.margin ? 'down' : 'neutral',
      };
    }

    return { current, trend, days: recent7.length };
  }, [history]);

  if (!stats) return null;

  const items = [
    { label: 'Avg Daily Bets', value: stats.current.bets.toLocaleString(), key: 'bets' },
    { label: 'Avg Daily Turnover', value: fmt(stats.current.turnover), key: 'turnover' },
    { label: 'Avg Daily P&L', value: fmtSigned(stats.current.pnl), key: 'pnl', color: stats.current.pnl >= 0 },
    { label: 'Avg Margin', value: `${stats.current.margin.toFixed(2)}%`, key: 'margin', color: stats.current.margin >= 0 },
  ];

  const TrendIcon = ({ dir }: { dir: 'up' | 'down' | 'neutral' }) => {
    if (dir === 'up') return <TrendingUp className="w-3 h-3 text-primary" />;
    if (dir === 'down') return <TrendingDown className="w-3 h-3 text-destructive" />;
    return <Minus className="w-3 h-3 text-muted-foreground" />;
  };

  return (
    <div className="flex items-center gap-6 px-5 py-2.5 rounded-xl border border-border bg-card/80">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
        {stats.days}-Day Avg
      </span>
      <div className="flex items-center gap-6 flex-wrap">
        {items.map((item) => (
          <div key={item.key} className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</span>
            <span
              className={`text-sm font-mono font-bold ${
                item.color !== undefined
                  ? item.color
                    ? 'text-primary'
                    : 'text-destructive'
                  : 'text-foreground'
              }`}
            >
              {item.value}
            </span>
            {stats.trend && <TrendIcon dir={stats.trend[item.key] as 'up' | 'down' | 'neutral'} />}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SevenDaySummary;
