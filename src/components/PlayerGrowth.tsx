import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Upload, Users, TrendingUp, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

interface SignupRow {
  username: string;
  countryCode: string;
  phone: string;
  joinedOn: string;
  clickId: string;
  provider: string;
}

interface StoredSignup {
  id: string;
  uploaded_at: string;
  data: SignupRow[];
}

const PROVIDER_COLORS = ['#00e554', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

function parseCsv(text: string): SignupRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

  const idx = {
    username: headers.findIndex(h => h.includes('username') || h.includes('user name')),
    country: headers.findIndex(h => h.includes('country')),
    phone: headers.findIndex(h => h.includes('phone')),
    joined: headers.findIndex(h => h.includes('joined') || h.includes('join')),
    click: headers.findIndex(h => h.includes('acs') || h.includes('click')),
    provider: headers.findIndex(h => h.includes('provider')),
  };

  return lines.slice(1).filter(l => l.trim()).map(line => {
    const cols = line.split(',').map(c => c.trim());
    return {
      username: cols[idx.username] || '',
      countryCode: cols[idx.country] || '',
      phone: cols[idx.phone] || '',
      joinedOn: cols[idx.joined] || '',
      clickId: cols[idx.click] || '',
      provider: cols[idx.provider] || 'Unknown',
    };
  });
}

function normalizeDate(raw: string): string {
  if (!raw) return '';
  // Try DD/MM/YYYY or DD-MM-YYYY
  const dmy = raw.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  // Try YYYY-MM-DD
  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
  return raw;
}

const PlayerGrowth = () => {
  const [allRows, setAllRows] = useState<SignupRow[]>([]);
  const [isOpen, setIsOpen] = useState(true);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load from Supabase
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('signup_data').select('*').order('uploaded_at');
      if (data && data.length > 0) {
        const merged = data.flatMap((r: StoredSignup) => r.data || []);
        setAllRows(merged);
      }
    })();
  }, []);

  const handleFile = useCallback(async (file: File) => {
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length === 0) return;

    const id = `signup-${Date.now()}`;
    await supabase.from('signup_data').insert({ id, uploaded_at: new Date().toISOString(), data: rows });
    setAllRows(prev => [...prev, ...rows]);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) handleFile(file);
  }, [handleFile]);

  // Computed stats
  const stats = useMemo(() => {
    if (allRows.length === 0) return null;

    const total = allRows.length;

    // Signups by date
    const byDate: Record<string, number> = {};
    allRows.forEach(r => {
      const d = normalizeDate(r.joinedOn);
      if (d) byDate[d] = (byDate[d] || 0) + 1;
    });
    const dateChart = Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    // Biggest spike
    let spikeDay = { date: '', count: 0 };
    dateChart.forEach(d => { if (d.count > spikeDay.count) spikeDay = d; });

    // Signups by provider
    const byProvider: Record<string, number> = {};
    allRows.forEach(r => {
      const p = r.provider || 'Unknown';
      byProvider[p] = (byProvider[p] || 0) + 1;
    });
    const providerChart = Object.entries(byProvider)
      .sort(([, a], [, b]) => b - a)
      .map(([name, value]) => ({ name, value }));

    return { total, dateChart, spikeDay, providerChart };
  }, [allRows]);

  const fmtDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    } catch { return d; }
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold uppercase tracking-wider text-foreground">Player Growth</span>
          {stats && (
            <span className="text-xs text-muted-foreground ml-2">{stats.total.toLocaleString()} signups</span>
          )}
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {isOpen && (
        <div className="px-5 pb-5 space-y-4">
          {/* Upload zone */}
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
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = '';
              }}
            />
          </div>

          {stats && (
            <>
              {/* KPI row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-lg border border-border bg-background p-3">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Signups</div>
                  <div className="text-xl font-mono font-bold text-foreground mt-1">{stats.total.toLocaleString()}</div>
                </div>
                <div className="rounded-lg border border-border bg-background p-3">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Unique Days</div>
                  <div className="text-xl font-mono font-bold text-foreground mt-1">{stats.dateChart.length}</div>
                </div>
                <div className="rounded-lg border border-border bg-background p-3">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Providers</div>
                  <div className="text-xl font-mono font-bold text-foreground mt-1">{stats.providerChart.length}</div>
                </div>
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-primary" />
                    <span className="text-[10px] text-primary uppercase tracking-wider font-semibold">Biggest Spike</span>
                  </div>
                  <div className="text-xl font-mono font-bold text-primary mt-1">{stats.spikeDay.count}</div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Calendar className="w-2.5 h-2.5" />
                    {fmtDate(stats.spikeDay.date)}
                  </div>
                </div>
              </div>

              {/* Charts row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Signups by date bar chart */}
                <div className="lg:col-span-2 rounded-lg border border-border bg-background p-4">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Signups by Date</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={stats.dateChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} tickFormatter={fmtDate} />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }}
                        labelFormatter={fmtDate}
                      />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Provider donut */}
                <div className="rounded-lg border border-border bg-background p-4">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">By Provider</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={stats.providerChart}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={75}
                        dataKey="value"
                        nameKey="name"
                        paddingAngle={2}
                      >
                        {stats.providerChart.map((_, i) => (
                          <Cell key={i} fill={PROVIDER_COLORS[i % PROVIDER_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: 10 }}
                        formatter={(value: string) => <span className="text-muted-foreground">{value}</span>}
                      />
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
