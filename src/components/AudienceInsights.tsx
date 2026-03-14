import { useState, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import type { DashboardData } from '@/lib/types';
import type { HistoryEntry } from '@/hooks/useDashboardHistory';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';

interface Props {
  history: HistoryEntry[];
}

/* ── Cricket market grouping ── */
const CRICKET_KEYWORDS = ['innings', 'over', 'wicket', 'runs', 'dismissal', 'total', 'powerplay', 'player'];

const CRICKET_GROUPS: { label: string; keywords: string[] }[] = [
  { label: 'Powerplay (overs 0-6)', keywords: ['powerplay'] },
  { label: 'Over-by-over', keywords: ['over'] },
  { label: 'Player runs / milestones', keywords: ['player', 'runs'] },
  { label: 'Wickets & dismissals', keywords: ['wicket', 'dismissal'] },
  { label: 'Innings totals', keywords: ['innings', 'total'] },
  { label: 'Match winner', keywords: ['winner', '1x2'] },
];

function isCricketMarket(m: string) {
  const l = m.toLowerCase();
  return CRICKET_KEYWORDS.some((k) => l.includes(k));
}

function groupCricketMarkets(raw: { market: string; count: number }[]) {
  const cricketOnly = raw.filter((r) => isCricketMarket(r.market));
  const totalCricket = cricketOnly.reduce((s, r) => s + r.count, 0);
  const grouped = new Map<string, number>();

  for (const { market, count } of cricketOnly) {
    const lower = market.toLowerCase();
    let matched = false;
    for (const g of CRICKET_GROUPS) {
      if (g.keywords.some((k) => lower.includes(k))) {
        grouped.set(g.label, (grouped.get(g.label) || 0) + count);
        matched = true;
        break;
      }
    }
    if (!matched) grouped.set('Other cricket', (grouped.get('Other cricket') || 0) + count);
  }

  return {
    totalCricket,
    groups: Array.from(grouped, ([label, count]) => ({ label, count, pct: totalCricket ? (count / totalCricket) * 100 : 0 }))
      .sort((a, b) => b.count - a.count),
    topGroup: Array.from(grouped, ([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count)[0] ?? null,
  };
}

/* ── General market grouping (kept for suggestions) ── */
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
  for (const [m, c] of unmatched) grouped.set(m, (grouped.get(m) || 0) + c);
  return Array.from(grouped, ([market, count]) => ({ market, count })).sort((a, b) => b.count - a.count);
}

const DONUT_COLORS_DIM = [
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  '#6366f1',
  '#f59e0b',
  '#ec4899',
];

const tooltipContentStyle = { backgroundColor: '#1e1e1e', border: '1px solid #00e554', borderRadius: '8px' };
const tooltipLabelStyle = { color: '#ffffff' };
const tooltipItemStyle = { color: '#ffffff' };

const AudienceInsights = ({ history }: Props) => {
  const [open, setOpen] = useState(true);

  // Filter entries that have valid data
  const validEntries = useMemo(() =>
    history.filter(e => e.data?.hourlyBets || e.data?.rawMarkets || e.data?.sportsBreakdown),
    [history]
  );

  const dayCount = validEntries.length;

  // Aggregate hourly bets: average across all days
  const hourly = useMemo(() => {
    if (dayCount === 0) return [];
    const hourMap = new Map<number, { total: number; days: number }>();
    for (const entry of validEntries) {
      const hb = entry.data?.hourlyBets ?? [];
      for (const { hour, count } of hb) {
        const existing = hourMap.get(hour) || { total: 0, days: 0 };
        existing.total += count;
        existing.days += 1;
        hourMap.set(hour, existing);
      }
    }
    // Fill all 24 hours
    return Array.from({ length: 24 }, (_, h) => {
      const d = hourMap.get(h);
      return { hour: h, count: d ? Math.round(d.total / dayCount) : 0 };
    });
  }, [validEntries, dayCount]);

  // Aggregate raw markets across all days (cumulative)
  const allRawMarkets = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of validEntries) {
      for (const { market, count } of entry.data?.rawMarkets ?? []) {
        map.set(market, (map.get(market) || 0) + count);
      }
    }
    return Array.from(map, ([market, count]) => ({ market, count }));
  }, [validEntries]);

  // Aggregate sports breakdown across all days (cumulative)
  const allSportsBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of validEntries) {
      for (const s of entry.data?.sportsBreakdown ?? []) {
        map.set(s.sport, (map.get(s.sport) || 0) + s.bets);
      }
    }
    return Array.from(map, ([sport, bets]) => ({ sport, bets }));
  }, [validEntries]);

  const sorted = [...hourly].sort((a, b) => b.count - a.count);
  const peakHour = sorted[0] ?? { hour: 0, count: 0 };
  const secondHour = sorted[1] ?? { hour: 0, count: 0 };

  const marketData = groupMarkets(allRawMarkets);
  const cricket = groupCricketMarkets(allRawMarkets);

  const totalBets = allSportsBreakdown.reduce((s, sp) => s + sp.bets, 0);
  const sportPie = allSportsBreakdown
    .filter((s) => s.bets > 0)
    .map((s) => ({ name: s.sport, value: s.bets, pct: totalBets ? ((s.bets / totalBets) * 100).toFixed(1) : '0' }));

  const cricketSport = sportPie.find((s) => s.name.toLowerCase().includes('cricket'));
  const cricketPct = cricketSport?.pct ?? '0';

  const topMarket = marketData[0];
  const hasData = hourly.length > 0 && hourly.some(h => h.count > 0) || marketData.length > 0;

  const pad = (h: number) => String(h).padStart(2, '0');

  return (
    <div className="kpi-card !p-0 overflow-hidden">
      {/* IPL accent stripe */}
      <div className="ipl-header-stripe h-1" />

      <div className="p-5">
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
            {dayCount > 0 && (
              <p className="text-xs mt-1" style={{ color: 'hsl(var(--primary))' }}>
                Based on {dayCount} day{dayCount !== 1 ? 's' : ''} of data — recommendations improve as more days are uploaded
              </p>
            )}
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
                {/* ── Three panels ── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                  {/* Panel 1 — Peak Betting Windows */}
                  <div className="kpi-card !p-4 space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      When your audience is most active
                    </h3>
                    <p className="text-[10px] text-muted-foreground -mt-2">Avg bets/hour across {dayCount} day{dayCount !== 1 ? 's' : ''}</p>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={hourly} margin={{ top: 10, right: 5, left: -15, bottom: 0 }}>
                          <XAxis dataKey="hour" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} tickFormatter={(h) => `${h}:00`} interval={3} />
                          <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                          <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} formatter={(v: number) => [`${v} avg bets`, 'Avg Bets']} labelFormatter={(h) => `${h}:00`} />
                          <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                            {hourly.map((entry) => (
                              <Cell key={entry.hour} fill={entry.hour === peakHour.hour ? '#00e554' : '#1a4a1a'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Optimal post time callout */}
                    {peakHour.count > 0 && (
                      <div className="rounded-lg bg-card border border-border p-3 space-y-1">
                        <p className="text-lg font-bold text-primary">📱 Optimal Post Time: {pad(peakHour.hour)}:00</p>
                        {secondHour.count > 0 && (
                          <p className="text-sm text-foreground">Secondary window: <span className="text-primary font-semibold">{pad(secondHour.hour)}:00</span></p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">Post match previews 1 hour before peak. Post result content at peak.</p>
                      </div>
                    )}
                  </div>

                  {/* Panel 2 — Cricket Market Breakdown */}
                  <div className="kpi-card !p-4 space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      🏏 Cricket Bet Type Breakdown — IPL Content Guide
                    </h3>
                    <p className="text-[10px] text-muted-foreground -mt-2">Cumulative across {dayCount} day{dayCount !== 1 ? 's' : ''}</p>
                    {cricket.groups.length > 0 ? (
                      <div className="space-y-2.5">
                        {cricket.groups.map((g) => (
                          <div key={g.label}>
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-foreground">{g.label}</span>
                              <span className="text-muted-foreground">{g.count.toLocaleString()} bets ({g.pct.toFixed(1)}%)</span>
                            </div>
                            <div className="h-2 rounded-full bg-border overflow-hidden">
                              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(g.pct, 2)}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-8">No cricket market data in uploaded files</p>
                    )}
                  </div>

                  {/* Panel 3 — Sport Popularity */}
                  <div className="kpi-card !p-4 space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Sport popularity by bet volume
                    </h3>
                    <p className="text-[10px] text-muted-foreground -mt-2">Total across {dayCount} day{dayCount !== 1 ? 's' : ''}</p>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={sportPie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="50%" outerRadius="80%" strokeWidth={0}>
                            {sportPie.map((entry, i) => (
                              <Cell
                                key={i}
                                fill={entry.name.toLowerCase().includes('cricket') ? 'hsl(var(--primary))' : DONUT_COLORS_DIM[i % DONUT_COLORS_DIM.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} formatter={(v: number, name: string) => {
                            const pct = totalBets ? ((v / totalBets) * 100).toFixed(1) : '0';
                            return [`${v.toLocaleString()} bets (${pct}%)`, name];
                          }} />
                          <Legend formatter={(value) => <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: 10 }}>{value}</span>} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    {/* Cricket dominance stat */}
                    <div className="rounded-lg bg-card border border-border p-3 text-center">
                      <p className="text-2xl font-bold text-primary">{cricketPct}%</p>
                      <p className="text-xs text-muted-foreground">Cricket dominance across all data</p>
                    </div>
                  </div>
                </div>

                {/* ── Content Suggestions ── */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-primary">💡 Content Suggestions</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {peakHour.count > 0 && (
                      <div className="rounded-xl bg-card border border-border p-4 border-l-4 border-l-primary">
                        <p className="text-sm font-bold text-foreground">Post at {pad(peakHour.hour)}:00</p>
                        <p className="text-xs text-muted-foreground">Highest avg betting activity across {dayCount} day{dayCount !== 1 ? 's' : ''} — schedule key content here</p>
                      </div>
                    )}
                    {topMarket && (
                      <div className="rounded-xl bg-card border border-border p-4 border-l-4 border-l-primary">
                        <p className="text-sm font-bold text-foreground">Feature {topMarket.market} content</p>
                        <p className="text-xs text-muted-foreground">Most popular bet type with {topMarket.count.toLocaleString()} total bets across all days</p>
                      </div>
                    )}
                    {cricketSport && (
                      <div className="rounded-xl bg-card border border-border p-4 border-l-4 border-l-primary">
                        <p className="text-sm font-bold text-foreground">Feature Cricket content — {cricketPct}% of all bets</p>
                        <p className="text-xs text-muted-foreground">Cricket dominates betting volume — lead with cricket stories</p>
                      </div>
                    )}
                    {cricket.topGroup && (
                      <div className="rounded-xl bg-card border border-border p-4 border-l-4 border-l-primary">
                        <p className="text-sm font-bold text-foreground">Create {cricket.topGroup.label.toLowerCase()} prediction content</p>
                        <p className="text-xs text-muted-foreground">{cricket.topGroup.count.toLocaleString()} bets on {cricket.topGroup.label.toLowerCase()} markets across all data</p>
                      </div>
                    )}
                    {peakHour.count > 0 && (
                      <div className="rounded-xl bg-card border border-border p-4 border-l-4 border-l-primary">
                        <p className="text-sm font-bold text-foreground">Go live at {pad(peakHour.hour)}:00</p>
                        <p className="text-xs text-muted-foreground">Cricket betting spikes at this hour — maximise engagement with live content</p>
                      </div>
                    )}
                  </div>

                  {/* IPL callout */}
                  <div className="rounded-xl p-4 border-l-4" style={{ borderLeftColor: 'hsl(var(--ipl-orange))', background: 'hsla(var(--ipl-orange) / 0.08)' }}>
                    <p className="text-sm font-bold" style={{ color: 'hsl(var(--ipl-orange))' }}>
                      🏆 IPL Season tip
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Schedule your match preview posts 60 minutes before the identified peak window for maximum reach.
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AudienceInsights;
