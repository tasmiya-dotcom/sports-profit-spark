import { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronDown, Upload, Trophy, TrendingUp, TrendingDown, BarChart3, ShieldAlert, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface IplMatch {
  id: string;
  fileName: string;
  date: string;
  sport: string;
  bets: number;
  turnover: number;
  pnl: number;
  margin: number;
  rejections: number;
  rejectionRatio: number;
  unsettledBets: number;
  uploadedAt: string;
}

const fmt = (v: number) => `€${Math.round(Math.abs(v)).toLocaleString()}`;
const fmtSigned = (v: number) => `${v >= 0 ? '+' : '-'}€${Math.round(Math.abs(v)).toLocaleString()}`;

function parseIplCsv(text: string): Omit<IplMatch, 'id' | 'fileName' | 'uploadedAt'> {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row');

  const header = lines[0].split(',').map(h => h.trim().toLowerCase());

  const colIndex = (names: string[]) => {
    for (const n of names) {
      const idx = header.indexOf(n.toLowerCase());
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const betsIdx = colIndex(['accepted bets', 'bets']);
  const turnoverIdx = colIndex(['accepted turnover', 'turnover']);
  const pnlIdx = colIndex(['p&l', 'pnl', 'profit', 'profit & loss']);
  const marginIdx = colIndex(['margin', 'margin %']);
  const rejectionsIdx = colIndex(['total rejected bets', 'rejected bets', 'rejections']);
  const rejRatioIdx = colIndex(['rejection ratio', 'rejection %']);
  const unsettledIdx = colIndex(['unsettled bets', 'unsettled']);
  const dateIdx = colIndex(['date', 'match date', 'event date']);
  const sportIdx = colIndex(['sport', 'sport name']);

  let totalBets = 0, totalTurnover = 0, totalPnl = 0, totalRejections = 0, totalUnsettled = 0;
  let marginSum = 0, marginCount = 0;
  let rejRatioSum = 0, rejRatioCount = 0;
  let firstDate = '';
  let firstSport = 'Cricket';

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    if (cols.length < 2) continue;

    const num = (idx: number) => {
      if (idx === -1) return 0;
      const raw = cols[idx]?.replace(/[€%,\s]/g, '') || '0';
      return parseFloat(raw) || 0;
    };

    totalBets += num(betsIdx);
    totalTurnover += num(turnoverIdx);
    totalPnl += num(pnlIdx);
    totalRejections += num(rejectionsIdx);
    totalUnsettled += num(unsettledIdx);

    if (marginIdx !== -1) { marginSum += num(marginIdx); marginCount++; }
    if (rejRatioIdx !== -1) { rejRatioSum += num(rejRatioIdx); rejRatioCount++; }

    if (!firstDate && dateIdx !== -1 && cols[dateIdx]) firstDate = cols[dateIdx];
    if (sportIdx !== -1 && cols[sportIdx]) firstSport = cols[sportIdx];
  }

  return {
    date: firstDate || new Date().toISOString().slice(0, 10),
    sport: firstSport,
    bets: totalBets,
    turnover: totalTurnover,
    pnl: totalPnl,
    margin: marginCount > 0 ? marginSum / marginCount : (totalTurnover > 0 ? (totalPnl / totalTurnover) * 100 : 0),
    rejections: totalRejections,
    rejectionRatio: rejRatioCount > 0 ? rejRatioSum / rejRatioCount : (totalBets > 0 ? (totalRejections / (totalBets + totalRejections)) * 100 : 0),
    unsettledBets: totalUnsettled,
  };
}

const IplMatchTracker = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [matches, setMatches] = useState<IplMatch[]>([]);

  // Fetch from Supabase on mount
  useEffect(() => {
    const fetchMatches = async () => {
      const { data, error } = await supabase
        .from('ipl_tracker')
        .select('*')
        .order('uploaded_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch ipl_tracker:', error);
        return;
      }

      if (data) {
        setMatches(data.map((row: any) => row.data as IplMatch));
      }
    };

    fetchMatches();
  }, []);

  const fileLoadRef = useRef<(text: string, fileName: string) => void>(() => {});
  fileLoadRef.current = (text: string, fileName: string) => {
    try {
      const parsed = parseIplCsv(text);
      const entry: IplMatch = {
        ...parsed,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        fileName,
        uploadedAt: new Date().toISOString(),
      };
      setMatches(prev => [entry, ...prev]);

      // Persist to Supabase
      supabase
        .from('ipl_tracker')
        .insert({ id: entry.id, uploaded_at: entry.uploadedAt, data: entry })
        .then(({ error }) => {
          if (error) console.error('Failed to save IPL match:', error);
        });
    } catch (e: any) {
      alert(`Failed to parse "${fileName}": ${e?.message || 'Unknown error'}`);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => { if (ev.target?.result) fileLoadRef.current(ev.target.result as string, file.name); };
      reader.readAsText(file);
    }
  }, []);

  const handleClick = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => { if (ev.target?.result) fileLoadRef.current(ev.target.result as string, file.name); };
        reader.readAsText(file);
      }
    };
    input.click();
  }, []);

  const hasMatches = matches.length > 0;

  const totals = matches.reduce((acc, m) => ({
    bets: acc.bets + m.bets,
    turnover: acc.turnover + m.turnover,
    pnl: acc.pnl + m.pnl,
    rejections: acc.rejections + m.rejections,
    unsettled: acc.unsettled + m.unsettledBets,
  }), { bets: 0, turnover: 0, pnl: 0, rejections: 0, unsettled: 0 });

  const avgMargin = totals.turnover > 0 ? (totals.pnl / totals.turnover) * 100 : 0;
  const rejRatio = (totals.bets + totals.rejections) > 0 ? (totals.rejections / (totals.bets + totals.rejections)) * 100 : 0;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="ipl-header-stripe" />
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="section-toggle w-full flex items-center justify-between px-5 py-3.5 bg-card"
      >
        <span className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
          🏏 IPL 2026 — MATCH TRACKER
        </span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="px-5 pb-5 space-y-5">
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onClick={handleClick}
            className="border-2 border-dashed border-ipl-orange/40 rounded-xl p-5 text-center hover:border-ipl-orange/70 transition-colors cursor-pointer bg-background/50"
          >
            <Upload className="w-7 h-7 mx-auto mb-2 text-ipl-orange" />
            <p className="text-sm text-muted-foreground">
              Drop IPL Cricket Report <span className="text-ipl-orange font-medium">(.csv)</span>
            </p>
          </div>

          {!hasMatches ? (
            <div className="border-2 border-dashed border-border rounded-xl p-10 text-center">
              <p className="text-sm text-muted-foreground">Awaiting first IPL match report</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                <KpiTile icon={<BarChart3 className="w-4 h-4" />} label="Total Bets" value={totals.bets.toLocaleString()} />
                <KpiTile icon={<TrendingUp className="w-4 h-4" />} label="Total Turnover" value={fmt(totals.turnover)} />
                <KpiTile
                  icon={totals.pnl >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  label="P&L"
                  value={fmtSigned(totals.pnl)}
                  valueClass={totals.pnl >= 0 ? 'value-positive' : 'value-negative'}
                />
                <KpiTile
                  icon={<Trophy className="w-4 h-4" />}
                  label="Margin"
                  value={`${avgMargin.toFixed(2)}%`}
                  valueClass={avgMargin >= 0 ? 'value-positive' : 'value-negative'}
                />
                <KpiTile icon={<ShieldAlert className="w-4 h-4" />} label="Rejections" value={totals.rejections.toLocaleString()} />
                <KpiTile icon={<ShieldAlert className="w-4 h-4" />} label="Rejection Ratio" value={`${rejRatio.toFixed(1)}%`} />
                <KpiTile icon={<Clock className="w-4 h-4" />} label="Unsettled Bets" value={totals.unsettled.toLocaleString()} />
              </div>

              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Sport</th>
                      <th className="text-right">Bets</th>
                      <th className="text-right">Turnover</th>
                      <th className="text-right">P&L</th>
                      <th className="text-right">Margin</th>
                      <th className="text-right">Rejections</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matches.map((m) => (
                      <tr key={m.id}>
                        <td>{m.date}</td>
                        <td>{m.sport}</td>
                        <td className="text-right">{m.bets.toLocaleString()}</td>
                        <td className="text-right">{fmt(m.turnover)}</td>
                        <td className={`text-right ${m.pnl >= 0 ? 'value-positive' : 'value-negative'}`}>{fmtSigned(m.pnl)}</td>
                        <td className={`text-right ${m.margin >= 0 ? 'value-positive' : 'value-negative'}`}>{m.margin.toFixed(2)}%</td>
                        <td className="text-right">{m.rejections.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const KpiTile = ({ icon, label, value, valueClass = '' }: { icon: React.ReactNode; label: string; value: string; valueClass?: string }) => (
  <div className="bg-background border border-border rounded-xl p-3 space-y-1">
    <div className="flex items-center gap-1.5 text-muted-foreground">{icon}<span className="text-[10px] uppercase tracking-wider font-medium">{label}</span></div>
    <p className={`text-base font-bold font-mono ${valueClass}`}>{value}</p>
  </div>
);

export default IplMatchTracker;
