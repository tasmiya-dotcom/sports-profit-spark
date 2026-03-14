import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Upload, Users, TrendingUp, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

type DateCount = { date: string; count: number };
type ProviderCount = { name: string; value: number };

type SignupSummary = {
  total: number;
  byDate: DateCount[];
  byProvider: ProviderCount[];
  spikeDay: DateCount;
};

const MAX_INDIVIDUAL_RENDER_ITEMS = 10;
const PROVIDER_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--muted-foreground))',
];

function normalizeDate(raw: string): string {
  if (!raw) return '';

  const dmy = raw.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;

  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;

  return raw;
}

function buildSummaryFromPairs(dateValues: string[], providerValues: string[]): SignupSummary | null {
  if (dateValues.length === 0) return null;

  const byDateMap: Record<string, number> = {};
  const byProviderMap: Record<string, number> = {};

  dateValues.forEach((rawDate, index) => {
    const date = normalizeDate(rawDate);
    if (date) byDateMap[date] = (byDateMap[date] || 0) + 1;

    const provider = providerValues[index]?.trim() || 'Unknown';
    byProviderMap[provider] = (byProviderMap[provider] || 0) + 1;
  });

  const byDate = Object.entries(byDateMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  const byProvider = Object.entries(byProviderMap)
    .sort(([, a], [, b]) => b - a)
    .map(([name, value]) => ({ name, value }));

  let spikeDay: DateCount = { date: '', count: 0 };
  byDate.forEach((entry) => {
    if (entry.count > spikeDay.count) spikeDay = entry;
  });

  return {
    total: dateValues.length,
    byDate,
    byProvider,
    spikeDay,
  };
}

function parseCsvToSummary(text: string): SignupSummary | null {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return null;

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const joinedIdx = headers.findIndex((h) => h.includes('joined') || h.includes('join'));
  const providerIdx = headers.findIndex((h) => h.includes('provider'));

  if (joinedIdx === -1) return null;

  const dateValues: string[] = [];
  const providerValues: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(',').map((c) => c.trim());
    const joined = cols[joinedIdx] || '';
    if (!joined) continue;

    dateValues.push(joined);
    providerValues.push(providerIdx >= 0 ? cols[providerIdx] || 'Unknown' : 'Unknown');
  }

  return buildSummaryFromPairs(dateValues, providerValues);
}

function isSignupSummary(data: unknown): data is SignupSummary {
  if (!data || typeof data !== 'object') return false;
  const maybe = data as Partial<SignupSummary>;
  return (
    typeof maybe.total === 'number' &&
    Array.isArray(maybe.byDate) &&
    Array.isArray(maybe.byProvider) &&
    !!maybe.spikeDay &&
    typeof maybe.spikeDay === 'object'
  );
}

function coerceLegacyArrayToSummary(items: unknown[]): SignupSummary | null {
  // Hard guard requested: never render individual elements when array is large.
  // Any array payload (especially >10) is forced into aggregated summary only.
  if (items.length > MAX_INDIVIDUAL_RENDER_ITEMS) {
    // Explicitly block any individual-record rendering path.
  }

  const dateValues: string[] = [];
  const providerValues: string[] = [];

  items.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const row = item as Record<string, unknown>;
    const joinedRaw =
      (typeof row.joinedOn === 'string' && row.joinedOn) ||
      (typeof row['User Joined On'] === 'string' && row['User Joined On']) ||
      '';

    if (!joinedRaw) return;

    dateValues.push(joinedRaw);

    const providerRaw =
      (typeof row.provider === 'string' && row.provider) ||
      (typeof row.Provider === 'string' && row.Provider) ||
      'Unknown';

    providerValues.push(providerRaw);
  });

  return buildSummaryFromPairs(dateValues, providerValues);
}

function coerceToSummary(payload: unknown): SignupSummary | null {
  if (isSignupSummary(payload)) return payload;
  if (Array.isArray(payload)) return coerceLegacyArrayToSummary(payload);
  return null;
}

function mergeSummaries(summaries: SignupSummary[]): SignupSummary | null {
  if (summaries.length === 0) return null;
  if (summaries.length === 1) return summaries[0];

  const byDateMap: Record<string, number> = {};
  const byProviderMap: Record<string, number> = {};
  let total = 0;

  summaries.forEach((summary) => {
    total += summary.total;
    summary.byDate.forEach((entry) => {
      byDateMap[entry.date] = (byDateMap[entry.date] || 0) + entry.count;
    });
    summary.byProvider.forEach((entry) => {
      byProviderMap[entry.name] = (byProviderMap[entry.name] || 0) + entry.value;
    });
  });

  const byDate = Object.entries(byDateMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  const byProvider = Object.entries(byProviderMap)
    .sort(([, a], [, b]) => b - a)
    .map(([name, value]) => ({ name, value }));

  let spikeDay: DateCount = { date: '', count: 0 };
  byDate.forEach((entry) => {
    if (entry.count > spikeDay.count) spikeDay = entry;
  });

  return { total, byDate, byProvider, spikeDay };
}

const PlayerGrowth = () => {
  const [summary, setSummary] = useState<SignupSummary | null>(null);
  const [isOpen, setIsOpen] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('signup_data').select('data').order('uploaded_at');

      if (error) {
        setStatus(`Load failed: ${error.message}`);
        return;
      }

      const summaries = (data || [])
        .map((row) => coerceToSummary((row as { data: unknown }).data))
        .filter((item): item is SignupSummary => !!item);

      setSummary(mergeSummaries(summaries));
    })();
  }, []);

  const handleFile = useCallback(async (file: File) => {
    const text = await file.text();
    const parsed = parseCsvToSummary(text);

    if (!parsed) {
      setStatus('No valid data found. Ensure CSV has "User Joined On" and optional "Provider" columns.');
      return;
    }

    const id = `signup-${Date.now()}`;
    const { error } = await supabase
      .from('signup_data')
      .insert({ id, uploaded_at: new Date().toISOString(), data: parsed });

    if (error) {
      setStatus(`Upload failed: ${error.message}`);
      return;
    }

    setStatus(`${parsed.total.toLocaleString()} signups processed`);
    setTimeout(() => setStatus(null), 2500);
    setSummary((prev) => (prev ? mergeSummaries([prev, parsed]) : parsed));
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setDragging(false);
      const file = event.dataTransfer.files[0];
      if (file && file.name.endsWith('.csv')) handleFile(file);
    },
    [handleFile],
  );

  const fmtDate = (value: string) => {
    try {
      return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    } catch {
      return value;
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setIsOpen((open) => !open)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold uppercase tracking-wider text-foreground">Player Growth</span>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {isOpen && (
        <div className="px-5 pb-5 space-y-4">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
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
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) handleFile(file);
                event.target.value = '';
              }}
            />
          </div>

          {status && (
            <div
              className={`text-xs px-3 py-2 rounded-lg border ${
                status.includes('failed') || status.includes('No valid')
                  ? 'border-destructive/30 bg-destructive/10 text-destructive'
                  : 'border-primary/30 bg-primary/10 text-primary'
              }`}
            >
              {status}
            </div>
          )}

          {summary && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg border border-border bg-background p-4">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Signups</div>
                  <div className="text-3xl font-mono font-bold text-foreground mt-1">{summary.total.toLocaleString()}</div>
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

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 rounded-lg border border-border bg-background p-4">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Signups by Date</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={summary.byDate}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }}
                        tickFormatter={fmtDate}
                      />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} allowDecimals={false} />
                      <Tooltip
                        labelFormatter={fmtDate}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 8,
                          fontSize: 11,
                          color: 'hsl(var(--foreground))',
                        }}
                      />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="rounded-lg border border-border bg-background p-4">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Signups by Provider</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={summary.byProvider}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={75}
                        dataKey="value"
                        nameKey="name"
                        paddingAngle={2}
                      >
                        {summary.byProvider.map((_, index) => (
                          <Cell key={index} fill={PROVIDER_COLORS[index % PROVIDER_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number, name: string) => [`${value}`, name]}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 8,
                          fontSize: 11,
                          color: 'hsl(var(--foreground))',
                        }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: 10 }}
                        formatter={(value: string, entry: unknown) => {
                          const payload = entry as { payload?: { value?: number } };
                          const count = payload?.payload?.value ?? 0;
                          return (
                            <span style={{ color: 'hsl(var(--muted-foreground))' }}>
                              {value} ({count})
                            </span>
                          );
                        }}
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
