import type { DashboardData } from './types';

function makeDemoDay(overrides: {
  date: string;
  label: string;
  pnl: number;
  turnover: number;
  bets: number;
  margin: number;
  rejections: number;
  highRiskUsers: number;
  topPlayer: DashboardData['topPlayer'];
}): DashboardData {
  const { date, label, pnl, turnover, bets, margin, rejections, highRiskUsers, topPlayer } = overrides;

  const sports = ['Cricket', 'Football', 'Tennis', 'Basketball', 'Ice Hockey'];
  const sportsBreakdown = sports.map((sport, i) => {
    const share = [0.34, 0.28, 0.18, 0.12, 0.08][i];
    const t = Math.round(turnover * share);
    const p = Math.round(pnl * share);
    return { sport, bets: Math.round(bets * share), turnover: t, pnl: p, margin: t > 0 ? (p / t) * 100 : 0 };
  });

  const rejReasons = ['Odds Changed', 'Max Stake Exceeded', 'Market Suspended', 'Account Restricted'];
  const rejPer = [0.4, 0.3, 0.2, 0.1];
  const rejectionReasons = rejReasons.map((reason, i) => {
    const count = Math.round(rejections * rejPer[i]);
    return { reason, count, blockedTurnover: count * 150, potentialPnl: count * 30, percentage: rejPer[i] * 100 };
  });

  const userSummaries = [
    { userId: 'USR001', username: '777harsh', bets: Math.round(bets * 0.3), turnover: Math.round(turnover * 0.4), pnl: Math.round(pnl * 0.5), margin: margin * 1.2, concentrationRisk: 'high' as const },
  ];

  const hourlyBets = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    count: Math.round(h >= 8 && h <= 23 ? (bets / 24) * (h >= 18 && h <= 21 ? 2.5 : 1) : bets * 0.01),
  }));

  const rawMarkets = [
    { market: 'Over/Under 2.5', count: Math.round(bets * 0.22) },
    { market: 'Innings Runs Over', count: Math.round(bets * 0.18) },
    { market: 'Match Winner', count: Math.round(bets * 0.16) },
    { market: 'Total Goals', count: Math.round(bets * 0.12) },
    { market: 'Handicap -1.5', count: Math.round(bets * 0.10) },
    { market: 'Player Runs Over', count: Math.round(bets * 0.08) },
    { market: 'Wicket Method', count: Math.round(bets * 0.07) },
    { market: 'Powerplay Runs', count: Math.round(bets * 0.07) },
  ].sort((a, b) => b.count - a.count);

  return {
    reportDate: date,
    reportLabel: label,
    kpiSummary: { pnl, turnover, bets, margin, rejections, highRiskUsers, rejectedTurnover: Math.round(rejections * 150), potentialPnl: Math.round(rejections * 30) },
    dailyPnL: [{ date: label.slice(0, 6), pnl, margin, turnover }],
    betSplit: [{ date: label, liveBets: Math.round(bets * 0.45), prematchBets: Math.round(bets * 0.55), liveTurnover: Math.round(turnover * 0.4), prematchTurnover: Math.round(turnover * 0.6) }],
    sportsBreakdown,
    rejectionReasons,
    userSummaries,
    marketPatterns: rawMarkets.map(m => ({ market: m.market, count: m.count, turnover: m.count * 500, pnl: Math.round(m.count * 20 * (Math.random() - 0.4)) })),
    topPlayer,
    uploadDate: new Date().toISOString(),
    hourlyBets,
    rawMarkets,
  };
}

export const DEFAULT_DAY_06: DashboardData = makeDemoDay({
  date: '2026-03-06',
  label: '06 Mar 2026',
  pnl: -20966,
  turnover: 88554,
  bets: 89,
  margin: -0.24,
  rejections: 73,
  highRiskUsers: 1,
  topPlayer: {
    nickname: '777harsh',
    sourceId: '777harsh',
    bets: 89,
    turnover: 88554,
    turnoverSharePct: 100,
    ccf: 3.66,
  },
});

export const DEFAULT_DAY_07: DashboardData = makeDemoDay({
  date: '2026-03-07',
  label: '07 Mar 2026',
  pnl: 512,
  turnover: 39256,
  bets: 70,
  margin: 1.30,
  rejections: 71,
  highRiskUsers: 0,
  topPlayer: null,
});

export const DEFAULT_ENTRIES = [
  { id: '2026-03-06', label: '06 Mar 2026', fileName: 'Default Data', uploadedAt: '2026-03-06T00:00:00Z', data: DEFAULT_DAY_06, isDefault: true },
  { id: '2026-03-07', label: '07 Mar 2026', fileName: 'Default Data', uploadedAt: '2026-03-07T00:00:00Z', data: DEFAULT_DAY_07, isDefault: true },
];
