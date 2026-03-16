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

  return {
    reportDate: date,
    reportLabel: label,
    kpiSummary: { pnl, turnover, bets, margin, rejections, highRiskUsers, rejectedTurnover: 0, potentialPnl: 0 },
    dailyPnL: [{ date: label.slice(0, 6), pnl, margin, turnover }],
    betSplit: [{ date: label, liveBets: 0, prematchBets: 0, liveTurnover: 0, prematchTurnover: 0 }],
    sportsBreakdown: [],
    rejectionReasons: [],
    userSummaries: [],
    marketPatterns: [],
    topPlayer,
    uploadDate: new Date().toISOString(),
    hourlyBets: [],
    rawMarkets: [],
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
