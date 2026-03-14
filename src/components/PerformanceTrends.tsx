import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { HistoryEntry } from '@/hooks/useDashboardHistory';

interface Props {
  history: HistoryEntry[];
}

interface TrendPoint {
  label: string;
  value: number;
}

function getTrendLabel(points: TrendPoint[]): { text: string; improving: boolean } {
  if (points.length < 4) return { text: '', improving: true };
  const recent = points.slice(-3);
  const previous = points.slice(-6, -3);
  if (previous.length === 0) return { text: '', improving: true };
  const recentAvg = recent.reduce((s, p) => s + p.value, 0) / recent.length;
  const prevAvg = previous.reduce((s, p) => s + p.value, 0) / previous.length;
  const improving = recentAvg >= prevAvg;
  return { text: improving ? '↑ Improving' : '↓ Declining', improving };
}

const tooltipStyle = { backgroundColor: '#1e1e1e', border: '1px solid #00e554', borderRadius: '8px' };

const MiniTrend = ({ title, data, color, formatter }: {
  title: string;
  data: TrendPoint[];
  color: string;
  formatter?: (v: number) => string;
}) => {
  const trend = getTrendLabel(data);
  const fmt = formatter ?? ((v: number) => v.toLocaleString());

  return (
    <div className="kpi-card !p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
        {trend.text && (
          <span className={`text-[10px] font-semibold ${trend.improving ? 'text-primary' : 'text-destructive'}`}>
            {trend.text}
          </span>
        )}
      </div>
      <div className="h-28">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-${title.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} tickLine={false} axisLine={false} width={40} tickFormatter={(v) => fmt(v)} />
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={{ color: '#ffffff' }}
              itemStyle={{ color: '#ffffff' }}
              formatter={(v: number) => [fmt(v), title]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#grad-${title.replace(/\s/g, '')})`}
              dot={{ r: 3, fill: color, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: color, strokeWidth: 2, stroke: '#fff' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const PerformanceTrends = ({ history }: Props) => {
  const sorted = useMemo(() =>
    [...history]
      .filter(e => e.data?.kpiSummary)
      .sort((a, b) => a.id.localeCompare(b.id)),
    [history]
  );

  const pnlData = useMemo(() => sorted.map(e => ({ label: e.label?.slice(0, 6) || e.id.slice(0, 6), value: e.data.kpiSummary.pnl })), [sorted]);
  const turnoverData = useMemo(() => sorted.map(e => ({ label: e.label?.slice(0, 6) || e.id.slice(0, 6), value: e.data.kpiSummary.turnover })), [sorted]);
  const betsData = useMemo(() => sorted.map(e => ({ label: e.label?.slice(0, 6) || e.id.slice(0, 6), value: e.data.kpiSummary.bets })), [sorted]);
  const rejectionData = useMemo(() => sorted.map(e => {
    const kpi = e.data.kpiSummary;
    const rate = kpi.bets > 0 ? (kpi.rejections / (kpi.bets + kpi.rejections)) * 100 : 0;
    return { label: e.label?.slice(0, 6) || e.id.slice(0, 6), value: parseFloat(rate.toFixed(1)) };
  }), [sorted]);

  if (sorted.length < 2) return null;

  const fmtEuro = (v: number) => `€${Math.round(Math.abs(v)).toLocaleString()}`;
  const fmtPct = (v: number) => `${v.toFixed(1)}%`;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-bold tracking-wider uppercase text-muted-foreground">📈 Performance Trends</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <MiniTrend title="Daily P&L" data={pnlData} color="#00e554" formatter={fmtEuro} />
        <MiniTrend title="Daily Turnover" data={turnoverData} color="#00e554" formatter={fmtEuro} />
        <MiniTrend title="Daily Bets" data={betsData} color="#00e554" />
        <MiniTrend title="Rejection Rate" data={rejectionData} color="#f59e0b" formatter={fmtPct} />
      </div>
    </div>
  );
};

export default PerformanceTrends;
