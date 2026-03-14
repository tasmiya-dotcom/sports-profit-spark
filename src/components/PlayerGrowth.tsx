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

const normalizeHeader = (value: string) => value
  .replace(/^\uFEFF/, '')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .replace(/[^a-z0-9_/ ]/g, '');

const normalizeSheetName = (value: string) => value
  .replace(/^\uFEFF/, '')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, ' ');

const toDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const parseJoinedOnDate = (value: unknown): Date | null => {
  if (value instanceof Date && !isNaN(value.getTime())) return value;

  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      const seconds = Math.floor(parsed.S || 0);
      return new Date(parsed.y, parsed.m - 1, parsed.d, parsed.H || 0, parsed.M || 0, seconds);
    }
    const fallback = new Date((value - 25569) * 86400 * 1000);
    return isNaN(fallback.getTime()) ? null : fallback;
  }

  if (typeof value !== 'string') return null;

  const raw = value.trim().replace(/^"|"$/g, '');
  if (!raw) return null;

  // MM/DD/YYYY, hh:mm:ss AM/PM (explicit format requested)
  const usDateTime = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/i);
  if (usDateTime) {
    const month = Number(usDateTime[1]) - 1;
    const day = Number(usDateTime[2]);
    const year = Number(usDateTime[3]);
    const minute = Number(usDateTime[5]);
    const second = Number(usDateTime[6]);
    const ampm = usDateTime[7].toUpperCase();
    let hour = Number(usDateTime[4]) % 12;
    if (ampm === 'PM') hour += 12;
    const parsed = new Date(year, month, day, hour, minute, second);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  // MM/DD/YYYY
  const usDateOnly = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usDateOnly) {
    const month = Number(usDateOnly[1]) - 1;
    const day = Number(usDateOnly[2]);
    const year = Number(usDateOnly[3]);
    const parsed = new Date(year, month, day);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? null : parsed;
};

/* ─── CSV parser (manual, handles commas inside quoted fields) ─── */
function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsv(text: string): AggDay[] {
  try {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) { console.warn('[PlayerGrowth] CSV has fewer than 2 lines'); return []; }

    const headers = splitCsvLine(lines[0]);
    console.log('[PlayerGrowth] CSV headers:', headers);

    const iJoined = headers.findIndex(h => {
      const n = normalizeHeader(h);
      return n.includes('user joined on') || n.includes('joined on') || n.includes('user joined') || n.includes('joined');
    });
    const iProvider = headers.findIndex(h => normalizeHeader(h).includes('provider'));
    const iCountry = headers.findIndex(h => normalizeHeader(h).includes('country'));

    console.log('[PlayerGrowth] CSV column indices — joined:', iJoined, 'provider:', iProvider, 'country:', iCountry);
    if (iJoined < 0) { console.warn('[PlayerGrowth] No "joined" column found in CSV headers'); return []; }

    const dayMap = new Map<string, AggDay>();

    for (let i = 1; i < lines.length; i++) {
      const cols = splitCsvLine(lines[i]);
      const rawVal = cols[iJoined];
      if (!rawVal) continue;

      const dt = parseJoinedOnDate(rawVal);
      if (!dt) {
        if (i <= 3) console.warn('[PlayerGrowth] Could not parse date on row', i, ':', rawVal);
        continue;
      }

      const dateKey = toDateKey(dt);
      const hour = dt.getHours();
      const provider = (iProvider >= 0 ? cols[iProvider] : '') || 'Unknown';
      const country = (iCountry >= 0 ? cols[iCountry] : '') || 'Unknown';

      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, { date: dateKey, count: 0, byProvider: {}, byCountry: {}, byHour: {} });
      }
      const day = dayMap.get(dateKey)!;
      day.count++;
      day.byProvider[provider] = (day.byProvider[provider] || 0) + 1;
      day.byCountry[country] = (day.byCountry[country] || 0) + 1;
      day.byHour[hour] = (day.byHour[hour] || 0) + 1;
    }

    console.log('[PlayerGrowth] CSV parsed', dayMap.size, 'days');
    return Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  } catch (err) {
    console.error('[PlayerGrowth] CSV parse error:', err);
    return [];
  }
}

/* ─── component ─── */
interface PlayerGrowthProps {
  externalData?: PlayerGrowthDay[];
}

const PlayerGrowth = ({ externalData }: PlayerGrowthProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [days, setDays] = useState<AggDay[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
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

  /* ─── parse Excel "Player Growth" sheet ─── */
  const parseExcelPlayerGrowth = useCallback((buffer: ArrayBuffer): AggDay[] => {
    try {
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
      console.log('[PlayerGrowth] Excel sheets found:', workbook.SheetNames);

      // Flexible sheet name matching: exact match first, then includes
      let sheetName = workbook.SheetNames.find(name => normalizeSheetName(name) === 'player growth');
      if (!sheetName) {
        sheetName = workbook.SheetNames.find(name => normalizeSheetName(name).includes('player growth'));
      }
      if (!sheetName) {
        sheetName = workbook.SheetNames.find(name => normalizeSheetName(name).includes('player') || normalizeSheetName(name).includes('signup') || normalizeSheetName(name).includes('growth'));
      }

      if (!sheetName) {
        console.warn('[PlayerGrowth] No matching sheet. Available:', workbook.SheetNames.map(s => `"${s}"`).join(', '));
        return [];
      }

      console.log('[PlayerGrowth] Using sheet:', sheetName);
      const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '', raw: true });
      if (!rows.length) { console.warn('[PlayerGrowth] Sheet is empty'); return []; }

      const headers = Object.keys(rows[0]);
      console.log('[PlayerGrowth] Excel headers:', headers);

      const joinedKey = headers.find(h => {
        const n = normalizeHeader(h);
        return n.includes('user joined on') || n.includes('joined on') || n.includes('user joined') || n.includes('joined');
      });
      const providerKey = headers.find(h => normalizeHeader(h).includes('provider'));
      const countryKey = headers.find(h => normalizeHeader(h).includes('country'));

      console.log('[PlayerGrowth] Excel keys — joined:', joinedKey, 'provider:', providerKey, 'country:', countryKey);

      if (joinedKey) {
        // Row-per-user: aggregate without storing PII
        const dayMap = new Map<string, AggDay>();
        let parseFailCount = 0;
        for (const row of rows) {
          const dt = parseJoinedOnDate(row[joinedKey]);
          if (!dt) { parseFailCount++; continue; }

          const dateKey = toDateKey(dt);
          const hour = dt.getHours();
          const providerRaw = providerKey ? String(row[providerKey] ?? '').trim() : '';
          const countryRaw = countryKey ? String(row[countryKey] ?? '').trim() : '';
          const provider = providerRaw || 'Unknown';
          const country = countryRaw || 'Unknown';

          if (!dayMap.has(dateKey)) {
            dayMap.set(dateKey, { date: dateKey, count: 0, byProvider: {}, byCountry: {}, byHour: {} });
          }
          const day = dayMap.get(dateKey)!;
          day.count++;
          day.byProvider[provider] = (day.byProvider[provider] || 0) + 1;
          day.byCountry[country] = (day.byCountry[country] || 0) + 1;
          day.byHour[hour] = (day.byHour[hour] || 0) + 1;
        }
        if (parseFailCount > 0) console.warn('[PlayerGrowth] Excel: failed to parse date for', parseFailCount, 'rows. Sample value:', rows[0]?.[joinedKey]);
        console.log('[PlayerGrowth] Excel parsed', dayMap.size, 'days from', rows.length, 'rows');
        return Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
      }

      // Summary format fallback
      console.log('[PlayerGrowth] No joined column, trying summary format');
      const dayMap = new Map<string, AggDay>();
      for (const row of rows) {
        const values = Object.values(row);
        let rowDate: Date | null = null;
        let rowCount = 0;

        for (const value of values) {
          if (!rowDate) rowDate = parseJoinedOnDate(value);
          if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
            rowCount = Math.max(rowCount, Math.floor(value));
          } else if (typeof value === 'string') {
            const parsed = parseInt(value.replace(/[^0-9]/g, ''), 10);
            if (!Number.isNaN(parsed) && parsed > 0) rowCount = Math.max(rowCount, parsed);
          }
        }
        if (!rowDate || rowCount <= 0) continue;
        const dateKey = toDateKey(rowDate);
        if (!dayMap.has(dateKey)) dayMap.set(dateKey, { date: dateKey, count: 0, byProvider: {}, byCountry: {}, byHour: {} });
        dayMap.get(dateKey)!.count += rowCount;
      }
      return Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    } catch (err) {
      console.error('[PlayerGrowth] Excel parse error:', err);
      return [];
    }
  }, []);

  /* ─── handle file (CSV or Excel) ─── */
  const handleFile = useCallback(async (file: File) => {
    setUploadError(null);
    console.log('[PlayerGrowth] Processing file:', file.name, 'size:', file.size);

    const name = file.name.toLowerCase();
    const isCsv = name.endsWith('.csv');
    const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls');

    if (!isCsv && !isExcel) {
      setUploadError('Unsupported file type. Please upload a .csv or .xlsx file.');
      return;
    }

    let parsed: AggDay[] = [];

    try {
      if (isCsv) {
        const text = await file.text();
        console.log('[PlayerGrowth] CSV text length:', text.length, 'first 200 chars:', text.slice(0, 200));
        parsed = parseCsv(text);
        if (!parsed.length) {
          setUploadError('No signup data found. Check console for details. Ensure the CSV has a "User Joined On" column with dates in MM/DD/YYYY format.');
          return;
        }
      } else {
        const buffer = await file.arrayBuffer();
        parsed = parseExcelPlayerGrowth(buffer);
        if (!parsed.length) {
          setUploadError('No "Player Growth" sheet found in this Excel file, or the sheet data could not be parsed. Check console for sheet names detected.');
          return;
        }
      }
    } catch (err) {
      console.error('[PlayerGrowth] File processing error:', err);
      setUploadError(`Error processing file: ${err instanceof Error ? err.message : 'Unknown error'}`);
      return;
    }

    console.log('[PlayerGrowth] Successfully parsed', parsed.length, 'days, total signups:', parsed.reduce((s, d) => s + d.count, 0));

    // Merge with existing
    const map = new Map<string, AggDay>();
    days.forEach(d => map.set(d.date, d));
    parsed.forEach(d => map.set(d.date, d));
    const merged = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
    setDays(merged);
    await persist(parsed);
  }, [days, persist, parseExcelPlayerGrowth]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
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
          {/* File Upload */}
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
              Drop a <span className="text-primary font-medium">CSV</span> or <span className="text-primary font-medium">Excel</span> file or click to upload
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              CSV columns: Username, Country Code, Phone, User Joined On, Provider — or Excel with "Player Growth" sheet
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
            />
          </div>

          {uploadError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          {days.length === 0 && !uploadError && (
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
