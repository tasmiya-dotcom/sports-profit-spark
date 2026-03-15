import { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronDown, Upload, Trophy, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '@/lib/supabase';
import { useCurrency } from '@/contexts/CurrencyContext';

interface MarketPatternRow {
  market: string;
  bets: number;
  turnover: number;
  pnl: number;
  margin: number;
}

interface PostMatch {
  id: string;
  matchName: string;
  tournament: string;
  date: string;
  bets: number;
  turnover: number;
  prematchTurnover: number;
  liveTurnover: number;
  avgStake: number;
  pnl: number;
  margin: number;
  rejectedBets: number;
  rejectedTurnover: number;
  rejectedRatio: number;
  unsettledBets: number;
  unsettledTurnover: number;
  marketPatterns: MarketPatternRow[];
  uploadedAt: string;
}

function num(v: any): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const s = String(v).replace(/[€,%\s]/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function makeMatchId(matchName: string, date: string): string {
  const slug = `${matchName}-${date}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug || `match-${Date.now()}`;
}

function parsePostMatchExcel(buffer: ArrayBuffer): Omit<PostMatch, 'id' | 'uploadedAt'> {
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets['Report'];
  if (!ws) throw new Error('Sheet "Report" not found');

  const cell = (r: number, c: number) => {
    const addr = XLSX.utils.encode_cell({ r: r - 1, c: c - 1 });
    return ws[addr]?.v ?? '';
  };

  let matchName = String(cell(1, 1)).replace(/^POST-MATCH REPORT\s*[—–-]\s*/i, '').trim();
  if (!matchName) matchName = 'Unknown Match';

  const a2 = String(cell(2, 1)).trim();
  let tournament = a2;
  let date = '';
  const dateParts = a2.match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/);
  if (dateParts) {
    date = dateParts[1];
    tournament = a2.replace(date, '').replace(/[|,\-–—]\s*$/, '').replace(/^\s*[|,\-–—]/, '').trim();
  }

  const bets = num(cell(6, 3));
  const turnover = num(cell(7, 3));
  const liveTurnover = num(cell(8, 3));
  const prematchTurnover = num(cell(9, 3));
  const avgStake = num(cell(10, 3));
  const pnl = num(cell(15, 3));
  const margin = num(cell(16, 3));
  const rejectedBets = num(cell(21, 3));
  const rejectedTurnover = num(cell(22, 3));
  const rejectedRatio = num(cell(23, 3));
  const unsettledBets = num(cell(29, 3));
  const unsettledTurnover = num(cell(30, 3));

  const marketPatterns: MarketPatternRow[] = [];
  for (let r = 35; r < 200; r++) {
    const market = String(cell(r, 2)).trim();
    if (!market) break;
    marketPatterns.push({
      market,
      bets: num(cell(r, 3)),
      turnover: num(cell(r, 4)),
      pnl: num(cell(r, 5)),
      margin: num(cell(r, 6)),
    });
  }

  return { matchName, tournament, date, bets, turnover, prematchTurnover, liveTurnover, avgStake, pnl, margin, rejectedBets, rejectedTurnover, rejectedRatio, unsettledBets, unsettledTurnover, marketPatterns };
}

const PostMatchReports = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [matches, setMatches] = useState<PostMatch[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { fmt, fmtSigned, convert, symbol } = useCurrency();

  useEffect(() => {
    const fetchMatches = async () => {
      const { data, error } = await supabase
        .from('match_reports')
        .select('*')
        .order('uploaded_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch match_reports:', error);
        return;
      }

      if (data) {
        const byId = new Map<string, PostMatch>();
        for (const row of data) {
          const m = row.data as PostMatch;
          if (!byId.has(m.id)) byId.set(m.id, m);
        }
        setMatches(Array.from(byId.values()).sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()));
      }
    };

    fetchMatches();
  }, []);

  const handleFile = useCallback((file: File) => {
    setError(null);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = parsePostMatchExcel(reader.result as ArrayBuffer);
        const id = makeMatchId(parsed.matchName, parsed.date);
        const entry: PostMatch = { ...parsed, id, uploadedAt: new Date().toISOString() };

        setMatches(prev => {
          const filtered = prev.filter(m => m.id !== entry.id);
          return [entry, ...filtered];
        });

        const { error: delErr } = await supabase.from('match_reports').delete().eq('id', id);
        if (delErr) console.error('Failed to delete old match report:', delErr);

        const { error: dbError } = await supabase
          .from('match_reports')
          .insert({ id: entry.id, uploaded_at: entry.uploadedAt, data: entry });

        if (dbError) console.error('Failed to save match report:', dbError);
      } catch (e: any) {
        setError(e?.message || 'Failed to parse file');
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    setMatches(prev => prev.filter(m => m.id !== id));
    setConfirmDeleteId(null);
    if (expandedId === id) setExpandedId(null);

    const { error } = await supabase.from('match_reports').delete().eq('id', id);
    if (error) console.error('Failed to delete match report:', error);
  }, [expandedId]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const chartData = [...matches].reverse().map(m => ({ name: m.matchName.length > 18 ? m.matchName.slice(0, 18) + '…' : m.matchName, turnover: m.turnover }));

  return (
    <div className="kpi-card !p-0 overflow-hidden">
      <button onClick={() => setIsOpen(!isOpen)} className="section-toggle w-full flex items-center justify-between px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <Trophy className="w-5 h-5 text-primary" />
          <span className="text-sm font-bold tracking-wider uppercase text-foreground">🏆 POST-MATCH REPORTS</span>
          <span className="text-xs text-muted-foreground ml-1">({matches.length})</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="px-5 pb-5 space-y-4">
          <div
            onDrop={onDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-border rounded-xl p-5 text-center cursor-pointer hover:border-primary/50 transition-colors"
          >
            <Upload className="w-5 h-5 text-muted-foreground mx-auto mb-1.5" />
            <p className="text-xs text-muted-foreground">Drop Post-Match Report Excel</p>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">.xlsx files only</p>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          {matches.length === 0 ? (
            <div className="border border-dashed border-border rounded-xl py-10 text-center">
              <p className="text-sm text-muted-foreground">No post-match reports yet — drop your first match report to begin</p>
            </div>
          ) : (
            <>
              {matches.length > 1 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Turnover per Match</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} tickFormatter={v => `${symbol}${(Math.abs(convert(v)) / 1000).toFixed(0)}k`} />
                      <Tooltip contentStyle={{ backgroundColor: '#1e1e1e', border: '1px solid #00e554', borderRadius: '8px' }} labelStyle={{ color: '#ffffff' }} itemStyle={{ color: '#ffffff' }} formatter={(v: number) => [`${symbol}${Math.round(convert(v)).toLocaleString()}`, 'Turnover']} />
                      <Bar dataKey="turnover" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="space-y-3">
                {matches.map(m => {
                  const isExpanded = expandedId === m.id;
                  const isConfirming = confirmDeleteId === m.id;
                  return (
                    <div key={m.id} className="bg-background border border-border rounded-xl overflow-hidden transition-all duration-200 hover:border-primary/50 hover:shadow-[0_0_12px_hsl(145_100%_45%/0.12)]">
                      <div className="flex items-center">
                        <button onClick={() => setExpandedId(isExpanded ? null : m.id)} className="flex-1 text-left px-4 py-3 hover:bg-primary/5 transition-colors cursor-pointer">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-semibold text-foreground">{m.matchName}</p>
                              <p className="text-[11px] text-muted-foreground">{m.tournament}{m.date ? ` — ${m.date}` : ''}</p>
                            </div>
                            <div className="flex items-center gap-4 text-right">
                              <div>
                                <p className="text-xs text-muted-foreground">Turnover</p>
                                <p className="text-sm font-mono font-semibold text-foreground">{fmt(m.turnover)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">P&L</p>
                                <p className={`text-sm font-mono font-semibold ${m.pnl >= 0 ? 'text-primary' : 'text-destructive'}`}>{fmtSigned(m.pnl)}</p>
                              </div>
                              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </div>
                          </div>
                        </button>
                        <div className="pr-3 flex items-center">
                          {isConfirming ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleDelete(m.id)}
                                className="text-[10px] font-medium text-destructive hover:text-destructive/80 transition-colors px-1.5 py-0.5 rounded border border-destructive/30 hover:bg-destructive/10"
                              >
                                Yes, delete
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(m.id)}
                              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              title="Delete match report"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="px-4 pb-4 space-y-3 border-t border-border">
                          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 pt-3">
                            {[
                              { label: 'Bets', value: m.bets.toLocaleString() },
                              { label: 'Turnover', value: fmt(m.turnover) },
                              { label: 'Pre-Match', value: fmt(m.prematchTurnover) },
                              { label: 'Live', value: fmt(m.liveTurnover) },
                              { label: 'Avg Stake', value: fmt(m.avgStake) },
                              { label: 'P&L', value: fmtSigned(m.pnl), color: m.pnl >= 0 ? 'text-primary' : 'text-destructive' },
                              { label: 'Margin', value: `${m.margin.toFixed(2)}%`, color: m.margin >= 0 ? 'text-primary' : 'text-destructive' },
                              { label: 'Rejected Bets', value: m.rejectedBets.toLocaleString() },
                              { label: 'Rejected TO', value: fmt(m.rejectedTurnover) },
                              { label: 'Reject Ratio', value: `${m.rejectedRatio.toFixed(1)}%` },
                              { label: 'Unsettled Bets', value: m.unsettledBets.toLocaleString() },
                              { label: 'Unsettled TO', value: fmt(m.unsettledTurnover) },
                            ].map(k => (
                              <div key={k.label} className="bg-card border border-border rounded-lg px-3 py-2">
                                <p className="text-[10px] text-muted-foreground uppercase">{k.label}</p>
                                <p className={`text-sm font-mono font-semibold ${k.color || 'text-foreground'}`}>{k.value}</p>
                              </div>
                            ))}
                          </div>

                          {m.marketPatterns.length > 0 && (
                            <div>
                              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Market Pattern Breakdown</p>
                              <div className="overflow-x-auto">
                                <table className="data-table w-full">
                                  <thead>
                                    <tr>
                                      <th className="text-left">Market</th>
                                      <th className="text-right">Bets</th>
                                      <th className="text-right">Turnover</th>
                                      <th className="text-right">P&L</th>
                                      <th className="text-right">Margin</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {m.marketPatterns.map((mp, i) => (
                                      <tr key={i}>
                                        <td className="text-left text-foreground">{mp.market}</td>
                                        <td className="text-right font-mono">{mp.bets.toLocaleString()}</td>
                                        <td className="text-right font-mono">{fmt(mp.turnover)}</td>
                                        <td className={`text-right font-mono ${mp.pnl >= 0 ? 'text-primary' : 'text-destructive'}`}>{fmtSigned(mp.pnl)}</td>
                                        <td className={`text-right font-mono ${mp.margin >= 0 ? 'text-primary' : 'text-destructive'}`}>{mp.margin.toFixed(2)}%</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default PostMatchReports;
