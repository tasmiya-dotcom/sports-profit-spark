import { useState, useMemo } from 'react';
import { ChevronDown, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { HistoryEntry } from '@/hooks/useDashboardHistory';
import { useCurrency } from '@/contexts/CurrencyContext';

interface Props {
  history: HistoryEntry[];
}

/* ── Performance Score (0-100) ── */
function calcScore(history: HistoryEntry[]): number {
  const valid = history.filter(e => e.data?.kpiSummary);
  if (valid.length === 0) return 50;

  const sorted = [...valid].sort((a, b) => a.id.localeCompare(b.id));
  const last3 = sorted.slice(-3);
  const prev3 = sorted.slice(-6, -3);

  let marginPts = 15;
  if (last3.length >= 2 && prev3.length >= 1) {
    const recentMargin = last3.reduce((s, e) => s + e.data.kpiSummary.margin, 0) / last3.length;
    const prevMargin = prev3.reduce((s, e) => s + e.data.kpiSummary.margin, 0) / prev3.length;
    marginPts = recentMargin >= prevMargin ? 30 : recentMargin >= 0 ? 15 : 5;
  } else {
    const avgMargin = valid.reduce((s, e) => s + e.data.kpiSummary.margin, 0) / valid.length;
    marginPts = avgMargin >= 5 ? 30 : avgMargin >= 0 ? 20 : 5;
  }

  const totalBets = valid.reduce((s, e) => s + e.data.kpiSummary.bets, 0);
  const totalRej = valid.reduce((s, e) => s + e.data.kpiSummary.rejections, 0);
  const rejRate = (totalBets + totalRej) > 0 ? totalRej / (totalBets + totalRej) * 100 : 0;
  const rejPts = rejRate < 5 ? 20 : rejRate < 15 ? 14 : rejRate < 30 ? 8 : 2;

  const maxHR = Math.max(...valid.map(e => e.data.kpiSummary.highRiskUsers));
  const hrPts = maxHR === 0 ? 20 : maxHR <= 2 ? 14 : maxHR <= 5 ? 8 : 2;

  let toPts = 10;
  if (last3.length >= 2 && prev3.length >= 1) {
    const recentTO = last3.reduce((s, e) => s + e.data.kpiSummary.turnover, 0) / last3.length;
    const prevTO = prev3.reduce((s, e) => s + e.data.kpiSummary.turnover, 0) / prev3.length;
    toPts = recentTO >= prevTO ? 20 : 6;
  }

  const totalPnl = valid.reduce((s, e) => s + e.data.kpiSummary.pnl, 0);
  const pnlPts = totalPnl > 0 ? 10 : totalPnl === 0 ? 5 : 2;

  return Math.min(100, Math.max(0, Math.round(marginPts + rejPts + hrPts + toPts + pnlPts)));
}

function getScoreColor(score: number): string {
  if (score >= 70) return '#00e554';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

const ScoreGauge = ({ score }: { score: number }) => {
  const color = getScoreColor(score);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative w-32 h-32 flex-shrink-0">
      <svg viewBox="0 0 128 128" className="w-full h-full -rotate-90">
        <circle cx="64" cy="64" r={radius} fill="none" stroke="hsl(0 0% 15%)" strokeWidth="8" />
        <circle
          cx="64" cy="64" r={radius} fill="none"
          stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold font-mono" style={{ color }}>{score}</span>
        <span className="text-[9px] text-muted-foreground uppercase tracking-widest">Score</span>
      </div>
    </div>
  );
};

const IplCountdown = () => {
  const iplDate = new Date('2026-03-28T00:00:00');
  const now = new Date();
  const diff = Math.ceil((iplDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const isLive = diff <= 0;

  if (isLive) {
    return (
      <div className="rounded-xl px-4 py-3 border border-primary/30 bg-primary/10 flex items-center gap-3">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
        </span>
        <span className="text-sm font-bold text-primary">IPL 2026 LIVE 🟢</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl px-4 py-3 border flex items-center gap-3" style={{ borderColor: 'hsl(24 100% 50% / 0.4)', background: 'hsl(24 100% 50% / 0.08)' }}>
      <span className="text-2xl font-bold font-mono" style={{ color: 'hsl(24 100% 50%)' }}>{diff}</span>
      <div>
        <p className="text-xs font-semibold" style={{ color: 'hsl(24 100% 50%)' }}>Days to IPL 2026</p>
        <p className="text-[10px] text-muted-foreground">Starts 28 March 2026</p>
      </div>
    </div>
  );
};

const TrendArrow = ({ improving }: { improving: boolean | null }) => {
  if (improving === null) return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
  return improving
    ? <TrendingUp className="w-3.5 h-3.5 text-primary" />
    : <TrendingDown className="w-3.5 h-3.5 text-destructive" />;
};

const ExecutiveOverview = ({ history }: Props) => {
  const [isOpen, setIsOpen] = useState(true);
  const { fmt, fmtSigned } = useCurrency();

  const valid = useMemo(() => history.filter(e => e.data?.kpiSummary), [history]);
  const sorted = useMemo(() => [...valid].sort((a, b) => a.id.localeCompare(b.id)), [valid]);

  const score = useMemo(() => calcScore(history), [history]);
  const dayCount = valid.length;

  const totals = useMemo(() => {
    const t = { turnover: 0, pnl: 0, bets: 0, rejections: 0, highRisk: 0 };
    for (const e of valid) {
      const k = e.data.kpiSummary;
      t.turnover += k.turnover;
      t.pnl += k.pnl;
      t.bets += k.bets;
      t.rejections += k.rejections;
      t.highRisk = Math.max(t.highRisk, k.highRiskUsers);
    }
    return t;
  }, [valid]);

  const overallMargin = totals.turnover > 0 ? (totals.pnl / totals.turnover) * 100 : 0;
  const rejRate = (totals.bets + totals.rejections) > 0 ? (totals.rejections / (totals.bets + totals.rejections)) * 100 : 0;

  const marginTrend = useMemo(() => {
    const last3 = sorted.slice(-3);
    const prev3 = sorted.slice(-6, -3);
    if (last3.length < 2 || prev3.length < 1) return null;
    const r = last3.reduce((s, e) => s + e.data.kpiSummary.margin, 0) / last3.length;
    const p = prev3.reduce((s, e) => s + e.data.kpiSummary.margin, 0) / prev3.length;
    return r >= p;
  }, [sorted]);

  const sportsAgg = useMemo(() => {
    const map = new Map<string, { bets: number; turnover: number; pnl: number }>();
    for (const e of valid) {
      for (const s of e.data.sportsBreakdown ?? []) {
        const cur = map.get(s.sport) || { bets: 0, turnover: 0, pnl: 0 };
        cur.bets += s.bets;
        cur.turnover += s.turnover;
        cur.pnl += s.pnl;
        map.set(s.sport, cur);
      }
    }
    return Array.from(map, ([sport, d]) => ({ sport, ...d })).sort((a, b) => b.pnl - a.pnl);
  }, [valid]);

  const bestSport = sportsAgg[0] ?? null;
  const worstSport = sportsAgg.length > 1 ? sportsAgg[sportsAgg.length - 1] : null;

  const biggestDay = useMemo(() => {
    if (valid.length === 0) return null;
    return valid.reduce((best, e) => e.data.kpiSummary.turnover > best.data.kpiSummary.turnover ? e : best);
  }, [valid]);

  const peakHour = useMemo(() => {
    const hourMap = new Map<number, number>();
    let days = 0;
    for (const e of valid) {
      if (!e.data.hourlyBets?.length) continue;
      days++;
      for (const h of e.data.hourlyBets) {
        hourMap.set(h.hour, (hourMap.get(h.hour) || 0) + h.count);
      }
    }
    if (hourMap.size === 0) return null;
    let maxH = 0, maxV = 0;
    for (const [h, v] of hourMap) { if (v > maxV) { maxH = h; maxV = v; } }
    return { hour: maxH, avgBets: days > 0 ? Math.round(maxV / days) : 0 };
  }, [valid]);

  const topSportByBets = sportsAgg.length > 0
    ? [...sportsAgg].sort((a, b) => b.bets - a.bets)[0].sport
    : null;

  const cricketShare = useMemo(() => {
    const totalBets = sportsAgg.reduce((s, sp) => s + sp.bets, 0);
    const cricket = sportsAgg.find(s => s.sport.toLowerCase().includes('cricket'));
    if (!cricket || totalBets === 0) return null;
    return Math.round((cricket.bets / totalBets) * 100);
  }, [sportsAgg]);

  const watchList = useMemo(() => {
    const last3 = sorted.slice(-3);
    const prev3 = sorted.slice(-6, -3);
    if (last3.length < 2 || prev3.length < 1) return null;
    const recentRej = last3.reduce((s, e) => s + e.data.kpiSummary.rejections, 0);
    const recentBets = last3.reduce((s, e) => s + e.data.kpiSummary.bets, 0);
    const prevRej = prev3.reduce((s, e) => s + e.data.kpiSummary.rejections, 0);
    const prevBets = prev3.reduce((s, e) => s + e.data.kpiSummary.bets, 0);
    const rRate = (recentBets + recentRej) > 0 ? recentRej / (recentBets + recentRej) * 100 : 0;
    const pRate = (prevBets + prevRej) > 0 ? prevRej / (prevBets + prevRej) * 100 : 0;
    if (rRate > pRate + 1) return `Rejection rate rising (${pRate.toFixed(1)}% → ${rRate.toFixed(1)}%)`;
    return null;
  }, [sorted]);

  const summary = useMemo(() => {
    const parts: string[] = [];
    if (cricketShare) parts.push(`Cricket leads volume at ${cricketShare}%`);
    if (marginTrend !== null) parts.push(marginTrend ? 'margin improving over last 3 days' : 'margin declining over last 3 days');
    if (totals.highRisk > 0) parts.push(`${totals.highRisk} high risk player${totals.highRisk > 1 ? 's' : ''} flagged`);
    else parts.push('no high risk players');
    return parts.join(' — ');
  }, [cricketShare, marginTrend, totals.highRisk]);

  if (dayCount === 0) return null;

  return (
    <div className="rounded-xl overflow-hidden" style={{
      background: 'linear-gradient(135deg, hsl(0 0% 7%) 0%, hsl(0 0% 5%) 100%)',
      border: '1px solid transparent',
      backgroundClip: 'padding-box',
      boxShadow: '0 0 0 1px hsl(145 100% 45% / 0.15), 0 4px 24px hsl(0 0% 0% / 0.4)',
    }}>
      <div className="h-[2px]" style={{ background: 'linear-gradient(90deg, #00e554 0%, #00e554 40%, #f59e0b 100%)' }} />

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="section-toggle w-full flex items-center justify-between px-6 py-4"
      >
        <div>
          <h2 className="text-base font-bold tracking-wide text-foreground">
            📊 EXECUTIVE OVERVIEW
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Management dashboard — {dayCount} day{dayCount !== 1 ? 's' : ''} of data
          </p>
        </div>
        <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="px-6 pb-6 space-y-5">
          <div className="flex items-center gap-6">
            <ScoreGauge score={score} />
            <div className="flex-1 space-y-2">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Performance Score</p>
                <p className="text-sm font-semibold" style={{ color: getScoreColor(score) }}>
                  {score >= 70 ? 'Strong' : score >= 40 ? 'Moderate' : 'Needs Attention'}
                </p>
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed">{summary}</p>
            </div>
            <IplCountdown />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Total Turnover', value: fmt(totals.turnover), color: 'text-foreground' },
              { label: 'Total P&L', value: fmtSigned(totals.pnl), color: totals.pnl >= 0 ? 'text-primary' : 'text-destructive' },
              { label: 'Overall Margin', value: `${overallMargin.toFixed(2)}%`, color: overallMargin >= 0 ? 'text-primary' : 'text-destructive', trend: marginTrend },
              { label: 'Total Bets', value: totals.bets.toLocaleString(), color: 'text-foreground' },
              { label: 'Rejection Rate', value: `${rejRate.toFixed(1)}%`, color: rejRate > 15 ? 'text-destructive' : rejRate > 5 ? 'text-chart-warning' : 'text-primary' },
              { label: 'High Risk Players', value: totals.highRisk.toString(), color: totals.highRisk > 0 ? 'text-destructive' : 'text-primary' },
            ].map(s => (
              <div key={s.label} className="bg-card/60 border border-border rounded-lg px-3 py-2.5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <p className={`text-lg font-bold font-mono ${s.color}`}>{s.value}</p>
                  {'trend' in s && s.trend !== undefined && <TrendArrow improving={s.trend} />}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {bestSport && (
              <div className="bg-card/60 border border-border rounded-lg px-3 py-2.5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Best Sport</p>
                <p className="text-sm font-semibold text-foreground mt-0.5">{bestSport.sport}</p>
                <p className="text-xs font-mono text-primary">{fmtSigned(bestSport.pnl)} P&L</p>
              </div>
            )}
            {worstSport && (
              <div className="bg-card/60 border border-border rounded-lg px-3 py-2.5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Worst Sport</p>
                <p className="text-sm font-semibold text-foreground mt-0.5">{worstSport.sport}</p>
                <p className={`text-xs font-mono ${worstSport.pnl >= 0 ? 'text-primary' : 'text-destructive'}`}>{fmtSigned(worstSport.pnl)} P&L</p>
              </div>
            )}
            {biggestDay && (
              <div className="bg-card/60 border border-border rounded-lg px-3 py-2.5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Biggest Day Turnover</p>
                <p className="text-sm font-semibold text-foreground mt-0.5">{fmt(biggestDay.data.kpiSummary.turnover)}</p>
                <p className="text-xs text-muted-foreground">{biggestDay.label}</p>
              </div>
            )}
            {peakHour && (
              <div className="bg-card/60 border border-border rounded-lg px-3 py-2.5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Peak Betting Hour</p>
                <p className="text-sm font-semibold text-foreground mt-0.5">{String(peakHour.hour).padStart(2, '0')}:00</p>
                <p className="text-xs text-muted-foreground">~{peakHour.avgBets} avg bets/day</p>
              </div>
            )}
          </div>

          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">🔮 Predictive Insights</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {peakHour && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
                  <p className="text-xs font-semibold text-primary">Expected Peak Today</p>
                  <p className="text-sm font-bold text-foreground mt-0.5">{String(peakHour.hour).padStart(2, '0')}:00</p>
                  <p className="text-[10px] text-muted-foreground">Based on {dayCount}-day average</p>
                </div>
              )}
              {topSportByBets && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
                  <p className="text-xs font-semibold text-primary">Projected Busiest Sport</p>
                  <p className="text-sm font-bold text-foreground mt-0.5">{topSportByBets}</p>
                  <p className="text-[10px] text-muted-foreground">Based on historical volume</p>
                </div>
              )}
              {watchList ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5">
                  <p className="text-xs font-semibold text-destructive">⚠️ Watch List</p>
                  <p className="text-sm font-medium text-foreground mt-0.5">{watchList}</p>
                  <p className="text-[10px] text-muted-foreground">Last 3 days vs prior 3</p>
                </div>
              ) : (
                <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
                  <p className="text-xs font-semibold text-primary">✅ All Clear</p>
                  <p className="text-sm font-medium text-foreground mt-0.5">No rising rejection trends</p>
                  <p className="text-[10px] text-muted-foreground">Rejection rates stable</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExecutiveOverview;
