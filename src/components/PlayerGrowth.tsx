import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ChevronDown, Upload, Users, CalendarDays, Globe, Zap, TrendingUp, Crown, Clock, AlertCircle } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, LineChart, Line, Area, AreaChart, CartesianGrid,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import type { PlayerGrowthDay } from '@/lib/types';

/* ─── country code → name ─── */
const CC: Record<string, string> = {
  IN: 'India', US: 'United States', GB: 'United Kingdom', AE: 'UAE', AU: 'Australia',
  CA: 'Canada', DE: 'Germany', FR: 'France', SG: 'Singapore', ZA: 'South Africa',
  KE: 'Kenya', NG: 'Nigeria', GH: 'Ghana', BD: 'Bangladesh', PK: 'Pakistan',
  NP: 'Nepal', LK: 'Sri Lanka', MY: 'Malaysia', PH: 'Philippines', BR: 'Brazil',
  MX: 'Mexico', JP: 'Japan', KR: 'South Korea', IT: 'Italy', ES: 'Spain',
  NL: 'Netherlands', SE: 'Sweden', NO: 'Norway', DK: 'Denmark', FI: 'Finland',
};
const countryName = (code: string) => CC[code?.toUpperCase()] || code || 'Unknown';

/* ─── types ─── */
interface AggDay {
  date: string;          // YYYY-MM-DD
  count: number;
  byProvider: Record<string, number>;
  byCountry: Record<string, number>;
  byHour: Record<number, number>;
}

interface StoredAgg {
  id?: string;
  date: string;
  count: number;
  by_provider: Record<string, number>;
  by_country: Record<string, number>;
  by_hour: Record<number, number>;
  uploaded_at?: string;
}

type FilterMode = 'all' | 'today' | 'week' | 'since8am' | 'matchStart' | 'custom';

const PROVIDER_COLORS = [
  '#00e554', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#a855f7',
];

/* ─── CSV parser ─── */
function parseCsv(text: string): AggDay[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const hdr = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9_/ ]/g, ''));
  const iJoined = hdr.findIndex(h => h.includes('joined') || h.includes('user joined'));
  const iProvider = hdr.findIndex(h => h.includes('provider'));
  const iCountry = hdr.findIndex(h => h.includes('country'));

  if (iJoined < 0) return [];

  const dayMap = new Map<string, AggDay>();

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    if (!cols[iJoined]) continue;

    // Parse date — handle multiple formats
    let dt: Date | null = null;
    const raw = cols[iJoined].replace(/"/g, '');
    // Try ISO
    dt = new Date(raw);
    if (isNaN(dt.getTime())) {
      // Try DD/MM/YYYY or DD-MM-YYYY
      const parts = raw.split(/[\/\-]/);
      if (parts.length === 3) {
        const d = parseInt(parts[0]), m = parseInt(parts[1]) - 1, y = parseInt(parts[2]);
        dt = new Date(y < 100 ? y + 2000 : y, m, d);
      }
    }
    if (!dt || isNaN(dt.getTime())) continue;

    const dateKey = dt.toISOString().slice(0, 10);
    const hour = dt.getHours();
    const provider = iProvider >= 0 ? (cols[iProvider] || 'Unknown') : 'Unknown';
    const country = iCountry >= 0 ? (cols[iCountry] || 'Unknown') : 'Unknown';

    if (!dayMap.has(dateKey)) {
      dayMap.set(dateKey, { date: dateKey, count: 0, byProvider: {}, byCountry: {}, byHour: {} });
    }
    const day = dayMap.get(dateKey)!;
    day.count++;
    day.byProvider[provider] = (day.byProvider[provider] || 0) + 1;
    day.byCountry[country] = (day.byCountry[country] || 0) + 1;
    day.byHour[hour] = (day.byHour[hour] || 0) + 1;
  }

  return Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/* ─── component ─── */
interface PlayerGrowthProps {
  externalData?: PlayerGrowthDay[];
}

const PlayerGrowth = ({ externalData }: PlayerGrowthProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [days, setDays] = useState<AggDay[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [customTime, setCustomTime] = useState('');
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [selectedBarDate, setSelectedBarDate] = useState<string | null>(null);

  /* ─── load from supabase ─── */
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('signup_data').select('*').order('date');
      if (data && data.length) {
        setDays(data.map((r: StoredAgg) => ({
          date: r.date,
          count: r.count,
          byProvider: r.by_provider || {},
          byCountry: r.by_country || {},
          byHour: r.by_hour || {},
        })));
      }
    })();
  }, []);

  /* ─── merge external data from Excel uploads ─── */
  useEffect(() => {
    if (!externalData?.length) return;
    setDays(prev => {
      const map = new Map<string, AggDay>();
      prev.forEach(d => map.set(d.date, d));
      externalData.forEach(d => map.set(d.date, d)); // newer upload replaces
      return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
    });
    // Persist the new external data
    (async () => {
      for (const d of externalData) {
        await supabase.from('signup_data').upsert({
          date: d.date,
          count: d.count,
          by_provider: d.byProvider,
          by_country: d.byCountry,
          by_hour: d.byHour,
        }, { onConflict: 'date' });
      }
    })();
  }, [externalData]);

  /* ─── persist to supabase ─── */
  const persist = useCallback(async (newDays: AggDay[]) => {
    // Upsert aggregated rows only
    for (const d of newDays) {
      await supabase.from('signup_data').upsert({
        date: d.date,
        count: d.count,
        by_provider: d.byProvider,
        by_country: d.byCountry,
        by_hour: d.byHour,
      }, { onConflict: 'date' });
    }
  }, []);

  /* ─── handle CSV ─── */
  const handleFile = useCallback(async (file: File) => {
    const text = await file.text();
    const parsed = parseCsv(text);
    if (!parsed.length) return;

    // Merge with existing
    const map = new Map<string, AggDay>();
    days.forEach(d => map.set(d.date, d));
    parsed.forEach(d => {
      if (map.has(d.date)) {
        // Replace with new upload for that date
        map.set(d.date, d);
      } else {
        map.set(d.date, d);
      }
    });
    const merged = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
    setDays(merged);
    await persist(parsed);
  }, [days, persist]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith('.csv')) handleFile(f);
  }, [handleFile]);

  /* ─── filtering ─── */
  const filtered = useMemo(() => {
    if (selectedBarDate) return days.filter(d => d.date === selectedBarDate);

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    switch (filterMode) {
      case 'today':
        return days.filter(d => d.date === todayStr);
      case 'week': {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        const wStr = weekAgo.toISOString().slice(0, 10);
        return days.filter(d => d.date >= wStr);
      }
      case 'since8am':
        // We only have daily aggregates; show today
        return days.filter(d => d.date === todayStr);
      case 'matchStart':
        // Show today — custom time is informational
        return days.filter(d => d.date === todayStr);
      case 'custom':
        if (dateRange.from && dateRange.to) {
          const f = dateRange.from.toISOString().slice(0, 10);
          const t = dateRange.to.toISOString().slice(0, 10);
          return days.filter(d => d.date >= f && d.date <= t);
        }
        if (dateRange.from) {
          const f = dateRange.from.toISOString().slice(0, 10);
          return days.filter(d => d.date >= f);
        }
        return days;
      default:
        return days;
    }
  }, [days, filterMode, dateRange, selectedBarDate]);

  /* ─── aggregations ─── */
  const totalSignups = filtered.reduce((s, d) => s + d.count, 0);
  const uniqueDays = filtered.length;

  const providerTotals = useMemo(() => {
    const m: Record<string, number> = {};
    filtered.forEach(d => Object.entries(d.byProvider).forEach(([k, v]) => { m[k] = (m[k] || 0) + v; }));
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const countryTotals = useMemo(() => {
    const m: Record<string, number> = {};
    filtered.forEach(d => Object.entries(d.byCountry).forEach(([k, v]) => { m[k] = (m[k] || 0) + v; }));
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const topProvider = providerTotals[0];
  const topCountry = countryTotals[0];

  const peakDay = useMemo(() => {
    if (!filtered.length) return null;
    const peak = filtered.reduce((a, b) => b.count > a.count ? b : a, filtered[0]);
    return { ...peak, pct: totalSignups ? ((peak.count / totalSignups) * 100).toFixed(1) : '0' };
  }, [filtered, totalSignups]);

  const barData = filtered.map(d => ({ date: d.date, label: d.date.slice(5), count: d.count }));

  const donutData = providerTotals.map(([name, value], i) => ({
    name, value, fill: PROVIDER_COLORS[i % PROVIDER_COLORS.length],
  }));

  const cumulativeData = useMemo(() => {
    let cum = 0;
    return filtered.map(d => { cum += d.count; return { date: d.date, label: d.date.slice(5), cumulative: cum }; });
  }, [filtered]);

  if (!isOpen && days.length === 0) {
    // Collapsed with no data — show minimal
  }

  const filterBtns: { mode: FilterMode; label: string }[] = [
    { mode: 'all', label: 'All Time' },
    { mode: 'today', label: 'Today' },
    { mode: 'week', label: 'This Week' },
    { mode: 'since8am', label: 'Since 8am' },
    { mode: 'matchStart', label: 'Since Match Start' },
    { mode: 'custom', label: 'Custom Range' },
  ];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="section-toggle w-full flex items-center justify-between px-5 py-4"
      >
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Player Growth</h2>
          {totalSignups > 0 && (
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {totalSignups.toLocaleString()} signups
            </span>
          )}
        </div>
        <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="px-5 pb-5 space-y-5">
          {/* CSV Upload */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
              isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Drop a <span className="text-primary font-medium">CSV</span> file or click to upload
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Columns: Username, Country Code, Phone, User Joined On, ACS/Click ID, Provider
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
            />
          </div>

          {days.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No signup data yet. Upload a CSV to get started.</p>
          )}

          {days.length > 0 && (
            <>
              {/* Filter bar */}
              <div className="flex flex-wrap items-center gap-2">
                {filterBtns.map(({ mode, label }) => (
                  <button
                    key={mode}
                    onClick={() => { setFilterMode(mode); setSelectedBarDate(null); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      filterMode === mode && !selectedBarDate
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground hover:bg-primary/20'
                    }`}
                  >
                    {label}
                  </button>
                ))}
                {filterMode === 'matchStart' && (
                  <input
                    type="time"
                    value={customTime}
                    onChange={(e) => setCustomTime(e.target.value)}
                    className="px-2 py-1 rounded-md border border-border bg-background text-foreground text-xs"
                    placeholder="Match start time"
                  />
                )}
                {filterMode === 'custom' && (
                  <div className="flex items-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="px-3 py-1.5 rounded-lg text-xs border border-border bg-background text-foreground cursor-pointer">
                          {dateRange.from ? format(dateRange.from, 'dd MMM') : 'From'}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateRange.from}
                          onSelect={(d) => setDateRange(prev => ({ ...prev, from: d || undefined }))}
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                    <span className="text-xs text-muted-foreground">→</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="px-3 py-1.5 rounded-lg text-xs border border-border bg-background text-foreground cursor-pointer">
                          {dateRange.to ? format(dateRange.to, 'dd MMM') : 'To'}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateRange.to}
                          onSelect={(d) => setDateRange(prev => ({ ...prev, to: d || undefined }))}
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
                {selectedBarDate && (
                  <button
                    onClick={() => setSelectedBarDate(null)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/20 text-primary cursor-pointer"
                  >
                    Showing {selectedBarDate} — Click to clear
                  </button>
                )}
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SummaryCard icon={<Users className="w-4 h-4" />} label="Total Signups" value={totalSignups.toLocaleString()} />
                <SummaryCard icon={<CalendarDays className="w-4 h-4" />} label="Unique Days" value={uniqueDays.toString()} />
                <SummaryCard icon={<Zap className="w-4 h-4" />} label="Top Channel" value={topProvider ? topProvider[0] : '—'} sub={topProvider ? `${topProvider[1]} signups` : undefined} />
                <SummaryCard icon={<Globe className="w-4 h-4" />} label="Primary Market" value={topCountry ? countryName(topCountry[0]) : '—'} sub={topCountry ? `${topCountry[1]} signups` : undefined} />
              </div>

              {/* Charts row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Bar chart */}
                <div className="lg:col-span-2 bg-secondary/30 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Signups by Date</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={barData} onClick={(e) => { if (e?.activePayload?.[0]) setSelectedBarDate(e.activePayload[0].payload.date); }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 15%)" />
                      <XAxis dataKey="label" tick={{ fill: 'hsl(0 0% 53%)', fontSize: 11 }} />
                      <YAxis tick={{ fill: 'hsl(0 0% 53%)', fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ background: 'hsl(0 0% 8%)', border: '1px solid hsl(0 0% 12%)', borderRadius: 8, color: '#fff' }}
                        labelFormatter={(l) => `Date: ${l}`}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]} cursor="pointer">
                        {barData.map((entry, i) => (
                          <Cell key={i} fill={entry.date === selectedBarDate ? '#f59e0b' : '#00e554'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Donut chart */}
                <div className="bg-secondary/30 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Signups by Provider</h3>
                  {donutData.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={160}>
                        <PieChart>
                          <Pie
                            data={donutData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={65}
                            paddingAngle={2}
                          >
                            {donutData.map((entry, i) => (
                              <Cell key={i} fill={entry.fill} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ background: 'hsl(0 0% 8%)', border: '1px solid hsl(0 0% 12%)', borderRadius: 8, color: '#fff' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {donutData.map((d, i) => (
                          <span key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="w-2 h-2 rounded-full inline-block" style={{ background: d.fill }} />
                            {d.name} ({d.value})
                          </span>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-8">No provider data</p>
                  )}
                </div>
              </div>

              {/* Peak Day + Cumulative Trend */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Peak day */}
                {peakDay && (
                  <div className="bg-secondary/30 rounded-xl p-4 border border-primary/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Crown className="w-4 h-4 text-primary" />
                      <h3 className="text-sm font-semibold text-foreground">Peak Signup Day</h3>
                    </div>
                    <p className="text-2xl font-bold font-mono text-primary">{peakDay.count.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {peakDay.date} · {peakDay.pct}% of total signups
                    </p>
                  </div>
                )}

                {/* Cumulative trend */}
                <div className="lg:col-span-2 bg-secondary/30 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Cumulative Signups</h3>
                  </div>
                  <ResponsiveContainer width="100%" height={140}>
                    <AreaChart data={cumulativeData}>
                      <defs>
                        <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#00e554" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#00e554" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 15%)" />
                      <XAxis dataKey="label" tick={{ fill: 'hsl(0 0% 53%)', fontSize: 11 }} />
                      <YAxis tick={{ fill: 'hsl(0 0% 53%)', fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ background: 'hsl(0 0% 8%)', border: '1px solid hsl(0 0% 12%)', borderRadius: 8, color: '#fff' }}
                      />
                      <Area type="monotone" dataKey="cumulative" stroke="#00e554" fill="url(#cumGrad)" strokeWidth={2} dot={{ r: 3, fill: '#00e554' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

/* ─── Summary card sub-component ─── */
const SummaryCard = ({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) => (
  <div className="bg-secondary/30 rounded-xl p-4 border border-border">
    <div className="flex items-center gap-2 mb-1">
      <span className="text-primary">{icon}</span>
      <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
    </div>
    <p className="text-lg font-bold font-mono text-foreground">{value}</p>
    {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
  </div>
);

export default PlayerGrowth;
