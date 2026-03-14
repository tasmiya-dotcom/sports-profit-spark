import { useCallback, useRef, useState } from 'react';
import { Upload, Users, TrendingUp, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

interface DateCount { date: string; count: number }
interface ProviderCount { name: string; value: number }
interface SignupSummary { total: number; byDate: DateCount[]; byProvider: ProviderCount[]; peak: DateCount }

const COLORS = [
  'hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))',
  'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(var(--muted-foreground))',
];

function parseCsv(text: string): SignupSummary | null {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return null;

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const dateIdx = headers.findIndex(h => h.includes('joined') || h.includes('join'));
  const provIdx = headers.findIndex(h => h.includes('provider'));
  if (dateIdx === -1) return null;

  const dateCounts: Record<string, number> = {};
  const provCounts: Record<string, number> = {};
  let total = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    const raw = cols[dateIdx];
    if (!raw) continue;
    total++;

    // normalize date
    let date = raw;
    const dmy = raw.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
    if (dmy) date = `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (ymd) date = `${ymd[1]}-${ymd[2]}-${ymd[3]}`;

    dateCounts[date] = (dateCounts[date] || 0) + 1;
    const prov = (provIdx >= 0 ? cols[provIdx] : '') || 'Unknown';
    provCounts[prov] = (provCounts[prov] || 0) + 1;
  }

  if (total === 0) return null;

  const byDate = Object.entries(dateCounts).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));
  const byProvider = Object.entries(provCounts).sort(([, a], [, b]) => b - a).map(([name, value]) => ({ name, value }));
  const peak = byDate.reduce((best, cur) => cur.count > best.count ? cur : best, { date: '', count: 0 });

  return { total, byDate, byProvider, peak };
}

const fmtDate = (v: string) => {
  try { return new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }); }
  catch { return v; }
};

const PlayerGrowth = () => {
  const [data, setData] = useState<SignupSummary | null>(null);
  const [open, setOpen] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const process = useCallback((file: File) => {
    file.text().then(text => {
      const result = parseCsv(text);
      if (!result) { setMsg('Invalid CSV — needs a "User Joined On" column'); return; }
      setData(prev => {
        if (!prev) return result;
        const dm: Record<string, number> = {};
        const pm: Record<string, number> = {};
        [...prev.byDate, ...result.byDate].forEach(e => dm[e.date] = (dm[e.date] || 0) + e.count);
        [...prev.byProvider, ...result.byProvider].forEach(e => pm[e.name] = (pm[e.name] || 0) + e.value);
        const byDate = Object.entries(dm).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));
        const byProvider = Object.entries(pm).sort(([, a], [, b]) => b - a).map(([name, value]) => ({ name, value }));
        const peak = byDate.reduce((best, cur) => cur.count > best.count ? cur : best, { date: '', count: 0 });
        return { total: prev.total + result.total, byDate, byProvider, peak };
      });
      setMsg(`${result.total.toLocaleString()} signups loaded`);
      setTimeout(() => setMsg(null), 2500);
    });
  }, []);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold uppercase tracking-wider text-foreground">Player Growth</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4">
          {/* Upload button */}
          <button
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload Signups CSV
          </button>
          <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) process(f); e.target.value = ''; }} />

          {msg && (
            <div className={`text-xs px-3 py-2 rounded-lg border ${msg.includes('Invalid') ? 'border-destructive/30 bg-destructive/10 text-destructive' : 'border-primary/30 bg-primary/10 text-primary'}`}>
              {msg}
            </div>
          )}

          {data && (
            <>
              {/* Row 1: Total + Peak */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg border border-border bg-background p-4">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Signups</div>
                  <div className="text-3xl font-mono font-bold text-foreground mt-1">{data.total.toLocaleString()}</div>
                </div>
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-primary" />
                    <span className="text-[10px] text-primary uppercase tracking-wider font-semibold">Peak Day</span>
                  </div>
                  <div className="text-3xl font-mono font-bold text-primary mt-1">{data.peak.count}</div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                    <Calendar className="w-2.5 h-2.5" />{fmtDate(data.peak.date)}
                  </div>
                </div>
              </div>

              {/* Row 2: Bar + Donut */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 rounded-lg border border-border bg-background p-4">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Signups by Date</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.byDate}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} tickFormatter={fmtDate} />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} allowDecimals={false} />
                      <Tooltip labelFormatter={fmtDate} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11, color: 'hsl(var(--foreground))' }} />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="rounded-lg border border-border bg-background p-4">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">By Provider</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={data.byProvider} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" nameKey="name" paddingAngle={2}>
                        {data.byProvider.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number, n: string) => [`${v}`, n]} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11, color: 'hsl(var(--foreground))' }} />
                      <Legend wrapperStyle={{ fontSize: 10 }} formatter={(value: string) => <span style={{ color: 'hsl(var(--muted-foreground))' }}>{value}</span>} />
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
