import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { DashboardData } from '@/lib/types';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';

interface Props {
  data: DashboardData;
}

const MARKET_GROUPS: { label: string; keywords: string[] }[] = [
  { label: 'Over/Innings', keywords: ['over', 'innings'] },
  { label: 'Match Winner', keywords: ['winner', '1x2'] },
  { label: 'Handicap', keywords: ['handicap'] },
  { label: 'Totals', keywords: ['total'] },
  { label: 'Goal Markets', keywords: ['goal'] },
];

function groupMarkets(raw: { market: string; count: number }[]) {
  const grouped = new Map<string, number>();
  const unmatched = new Map<string, number>();

  for (const { market, count } of raw) {
    const lower = market.toLowerCase();
    let matched = false;
    for (const g of MARKET_GROUPS) {
      if (g.keywords.some((k) => lower.includes(k))) {
        grouped.set(g.label, (grouped.get(g.label) || 0) + count);
        matched = true;
        break;
      }
    }
    if (!matched) unmatched.set(market, (unmatched.get(market) || 0) + count);
  }

  // merge ungrouped
  for (const [m, c] of unmatched) grouped.set(m, (grouped.get(m) || 0) + c);

  return Array.from(grouped, ([market, count]) => ({ market, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

const DONUT_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  '#6366f1',
  '#f59e0b',
  '#ec4899',
];

const AudienceInsights = ({ data }: Props) => {
  const [open, setOpen] = useState(true);

  const hourly = data.hourlyBets ?? [];
  const peakHour = hourly.reduce((max, h) => (h.count > max.count ? h : max), { hour: 0, count: 0 });
  const marketData = groupMarkets(data.rawMarkets ?? []);
  const topMarket = marketData[0];

  const totalBets = data.sportsBreakdown.reduce((s, sp) => s + sp.bets, 0);
  const sportPie = data.sportsBreakdown
    .filter((s) => s.bets > 0)
    .map((s) => ({ name: s.sport, value: s.bets, pct: totalBets ? ((s.bets / totalBets) * 100).toFixed(1) : '0' }));
  const topSport = sportPie[0];

  const hasData = hourly.length > 0 || marketData.length > 0;

  return (
    <div className="kpi-card">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between"
      >
        <div>
          <h2 className="text-base font-bold tracking-wide text-foreground">
            📱 AUDIENCE & ENGAGEMENT INSIGHTS
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Data-driven inputs for content planning and social media strategy
          </p>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="mt-6 space-y-6">
          {!hasData ? (
            <div className="border border-dashed border-border rounded-xl flex items-center justify-center py-16">
              <p className="text-muted-foreground text-sm">
                Upload a sportsbook Excel file to generate audience insights
              </p>
            </div>
          ) : (
            <>
              {/* Three panels */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Panel 1 — Peak Betting Windows */}
                <div className="kpi-card !p-4 space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    When your audience is most active
                  </h3>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={hourly} margin={{ top: 10, right: 5, left: -15, bottom: 0 }}>
                        <XAxis
                          dataKey="hour"
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                          tickFormatter={(h) => `${h}:00`}
                          interval={3}
                        />
                        <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{
                            background: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: 8,
                            color: 'hsl(var(--foreground))',
                            fontSize: 12,
                          }}
                          formatter={(v: number) => [`${v} bets`, 'Bets']}
                          labelFormatter={(h) => `${h}:00`}
                        />
                        <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                          {hourly.map((entry) => (
                            <Cell
                              key={entry.hour}
                              fill={
                                entry.hour === peakHour.hour
                                  ? 'hsl(var(--primary))'
                                  : 'hsl(var(--muted-foreground) / 0.3)'
                              }
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  {peakHour.count > 0 && (
                    <p className="text-xs text-primary font-medium text-center">
                      📱 Best posting window: {peakHour.hour}:00
                    </p>
                  )}
                </div>

                {/* Panel 2 — Most Popular Bet Types */}
                <div className="kpi-card !p-4 space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    What your audience bets on most
                  </h3>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={marketData}
                        layout="vertical"
                        margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
                      >
                        <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                        <YAxis
                          type="category"
                          dataKey="market"
                          width={100}
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                        />
                        <Tooltip
                          contentStyle={{
                            background: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: 8,
                            color: 'hsl(var(--foreground))',
                            fontSize: 12,
                          }}
                          formatter={(v: number) => [`${v} bets`, 'Bets']}
                        />
                        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 3, 3, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Panel 3 — Sport Popularity */}
                <div className="kpi-card !p-4 space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Sport popularity by bet volume
                  </h3>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={sportPie}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius="50%"
                          outerRadius="80%"
                          strokeWidth={0}
                        >
                          {sportPie.map((_, i) => (
                            <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            background: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: 8,
                            color: 'hsl(var(--foreground))',
                            fontSize: 12,
                          }}
                          formatter={(v: number, name: string) => {
                            const pct = totalBets ? ((v / totalBets) * 100).toFixed(1) : '0';
                            return [`${v} bets (${pct}%)`, name];
                          }}
                        />
                        <Legend
                          formatter={(value) => (
                            <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: 10 }}>{value}</span>
                          )}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  {topSport && (
                    <p className="text-xs text-primary font-medium text-center">
                      🏆 #{1} {topSport.name} — {topSport.pct}% of all bets
                    </p>
                  )}
                </div>
              </div>

              {/* Content Suggestions */}
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-2">
                <h3 className="text-sm font-bold text-primary">💡 Today's Content Suggestions</h3>
                <ul className="space-y-1.5 text-sm text-foreground">
                  {peakHour.count > 0 && (
                    <li>
                      • Post at{' '}
                      <span className="text-primary font-semibold">
                        {String(peakHour.hour).padStart(2, '0')}:00
                      </span>{' '}
                      — highest betting activity of the day
                    </li>
                  )}
                  {topMarket && (
                    <li>
                      • Feature{' '}
                      <span className="text-primary font-semibold">{topMarket.market}</span> content —
                      most popular bet type ({topMarket.count.toLocaleString()} bets)
                    </li>
                  )}
                  {topSport && (
                    <li>
                      • Feature{' '}
                      <span className="text-primary font-semibold">{topSport.name}</span> content —{' '}
                      {topSport.pct}% of all bets today
                    </li>
                  )}
                </ul>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AudienceInsights;
