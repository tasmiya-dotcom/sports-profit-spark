import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Upload, Users, TrendingUp, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

/* ── Aggregated types only — no individual user data ── */
interface DateCount {
  date: string;
  count: number;
}

interface ProviderCount {
  name: string;
  value: number;
}

interface SignupSummary {
  total: number;
  byDate: DateCount[];
  byProvider: ProviderCount[];
  spikeDay: DateCount;
}

interface StoredSummary {
  id: string;
  uploaded_at: string;
  data: SignupSummary;
}

const PROVIDER_COLORS = ['#00e554', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

/* ── Parse CSV into aggregated summary — individual rows are never stored ── */
function parseCsvToSummary(text: string): SignupSummary | null {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return null;

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const joinedIdx = headers.findIndex(h => h.includes('joined') || h.includes('join'));
  const providerIdx = headers.findIndex(h => h.includes('provider'));

  if (joinedIdx === -1) return null;

  const byDate: Record<string, number> = {};
  const byProvider: Record<string, number> = {};
  let total = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(',').map(c => c.trim());

    total++;

    const rawDate = cols[joinedIdx] || '';
    const normDate = normalizeDate(rawDate);
    if (normDate) byDate[normDate] = (byDate[normDate] || 0) + 1;

    const provider = (providerIdx >= 0 ? cols[providerIdx] : '') || 'Unknown';
    byProvider[provider] = (byProvider[provider] || 0) + 1;
  }

  if (total === 0) return null;

  const dateArr = Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  const providerArr = Object.entries(byProvider)
    .sort(([, a], [, b]) => b - a)
    .map(([name, value]) => ({ name, value }));

  let spikeDay: DateCount = { date: '', count: 0 };
  dateArr.forEach(d => { if (d.count > spikeDay.count) spikeDay = d; });

  return { total, byDate: dateArr, byProvider: providerArr, spikeDay };
}

function normalizeDate(raw: string): string {
  if (!raw) return '';
  const dmy = raw.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
  return raw;
}

function mergeSummaries(summaries: SignupSummary[]): SignupSummary | null {
  if (summaries.length === 0) return null;
  if (summaries.length === 1) return summaries[0];

  const byDate: Record<string, number> = {};
  const byProvider: Record<string, number> = {};
  let total = 0;

  summaries.forEach(s => {
    total += s.total;
    s.byDate.forEach(d => { byDate[d.date] = (byDate[d.date] || 0) + d.count; });
    s.byProvider.forEach(p => { byProvider[p.name] = (byProvider[p.name] || 0) + p.value; });
  });

  const dateArr = Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));
  const providerArr = Object.entries(byProvider).sort(([, a], [, b]) => b - a).map(([name, value]) => ({ name, value }));
  let spikeDay: DateCount = { date: '', count: 0 };
  dateArr.forEach(d => { if (d.count > spikeDay.count) spikeDay = d; });

  return { total, byDate: dateArr, byProvider: providerArr, spikeDay };
}

/* ── Component ── */
const PlayerGrowth = () => {
  const [summary, setSummary] = useState<SignupSummary | null>(null);
  const [isOpen, setIsOpen] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load aggregated summaries from Supabase
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('signup_data').select('*').order('uploaded_at');
      if (data && data.length > 0) {
        const summaries = (data as StoredSummary[]).map(r => r.data).filter(Boolean);
        setSummary(mergeSummaries(summaries));
      }
    })();
  }, []);

  const handleFile = useCallback(async (file: File) => {
    const text = await file.text();
    const parsed = parseCsvToSummary(text);
    if (!parsed) {
      setStatus('No valid data found. Ensure CSV has a "User Joined On" column.');
      return;
    }

    // Store only the aggregated summary — never individual rows
    const id = `signup-${Date.now()}`;
    const { error } = await supabase
      .from('signup_data')
      .insert({ id, uploaded_at: new Date().toISOString(), data: parsed });

    if (error) {
      setStatus(`Upload failed: ${error.message}`);
    } else {
      setStatus(`${parsed.total} signups loaded from ${file.name}`);
      setTimeout(() => setStatus(null), 3000);
    }

    setSummary(prev => prev ? mergeSummaries([prev, parsed]) : parsed);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) handleFile(file);
  }, [handleFile]);

  const fmtDate = (d: string) => {
    try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }); }
    catch { return d; }
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setIsOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold uppercase tracking-wider text-foreground">Player Growth</span>
          {summary && (
            <span className="text-xs text-muted-foreground ml-2">{summary.total.toLocaleString()} signups</span>
          )}
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {isOpen && (
        <div className="px-5 pb-5 space-y-4">
          {/* Upload */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-dashed cursor-pointer transition-colors text-xs ${
              dragging ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Drop signup CSV or click to upload
            <input ref={fileRef} type="file" accept=".csv" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
          </div>

          {status && (
            <div className={`text-xs px-3 py-2 rounded-lg border ${
              status.includes('failed') || status.includes('No valid')
                ? 'border-destructive/30 bg-destructive/10 text-destructive'
                : 'border-primary/30 bg-primary/10 text-primary'
            }`}>{status}</div>
          )}

          {summary && (
            <>
              {/* 1) Total Signups + 4) Biggest Spike */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg border border-border bg-background p-4">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Signups</div>
                  <div className="text-3xl font-mono font-bold text-foreground mt-1">{summary.total.toLocaleString()}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">{summary.byDate.length} unique days</div>
                </div>
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-primary" />
                    <span className="text-[10px] text-primary uppercase tracking-wider font-semibold">Biggest Single-Day Spike</span>
                  </div>
                  <div className="text-3xl font-mono font-bold text-primary mt-1">{summary.spikeDay.count}</div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                    <Calendar className="w-2.5 h-2.5" />
                    {fmtDate(summary.spikeDay.date)}
                  </div>
                </div>
              </div>

              {/* 2) Bar chart + 3) Donut chart */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 rounded-lg border border-border bg-background p-4">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Signups by Date</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={summary.byDate}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} tickFormatter={fmtDate} />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11, color: 'hsl(var(--foreground))' }}
                        labelFormatter={fmtDate}
                      />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="rounded-lg border border-border bg-background p-4">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">By Provider</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={summary.byProvider} cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                        dataKey="value" nameKey="name" paddingAngle={2}>
                        {summary.byProvider.map((_, i) => (
                          <Cell key={i} fill={PROVIDER_COLORS[i % PROVIDER_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11, color: 'hsl(var(--foreground))' }} />
                      <Legend wrapperStyle={{ fontSize: 10 }}
                        formatter={(value: string) => <span style={{ color: 'hsl(var(--muted-foreground))' }}>{value}</span>} />
                    </PieChart>
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

export default PlayerGrowth;
