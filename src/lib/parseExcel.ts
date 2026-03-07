import * as XLSX from 'xlsx';
import type { DashboardData, DailyPnL, BetSplit, SportBreakdown, RejectionReason, UserSummary, MarketPattern } from './types';

function getRows(workbook: XLSX.WorkBook, sheetName: string): Record<string, any>[] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

function num(v: any): number {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function str(v: any): string {
  return v?.toString?.() ?? '';
}

export function parseExcelFile(buffer: ArrayBuffer): DashboardData {
  const workbook = XLSX.read(buffer, { type: 'array' });

  // Parse Report sheet
  const reportRows = getRows(workbook, 'Report');
  
  const dailyPnL: DailyPnL[] = [];
  const betSplit: BetSplit[] = [];
  const sportsBreakdown: SportBreakdown[] = [];
  const rejectionReasons: RejectionReason[] = [];
  const userSummaries: UserSummary[] = [];

  // Try to extract daily P&L from Report sheet
  for (const row of reportRows) {
    const keys = Object.keys(row);
    // Look for date-like first column
    const dateVal = row[keys[0]];
    if (dateVal && (keys.some(k => k.toLowerCase().includes('pnl') || k.toLowerCase().includes('p&l') || k.toLowerCase().includes('profit')))) {
      dailyPnL.push({
        date: str(dateVal),
        pnl: num(row[keys.find(k => k.toLowerCase().includes('pnl') || k.toLowerCase().includes('p&l') || k.toLowerCase().includes('profit')) || keys[1]]),
        margin: num(row[keys.find(k => k.toLowerCase().includes('margin')) || keys[2]]) * 100,
        turnover: num(row[keys.find(k => k.toLowerCase().includes('turnover') || k.toLowerCase().includes('stake')) || keys[3]]),
      });
    }
  }

  // Parse Raw Data for bet splits and user summaries
  const rawRows = getRows(workbook, 'Raw Data');
  const userMap = new Map<string, { bets: number; turnover: number; pnl: number }>();
  const sportMap = new Map<string, { bets: number; turnover: number; pnl: number }>();
  let liveBets = 0, prematchBets = 0, liveTurnover = 0, prematchTurnover = 0;

  for (const row of rawRows) {
    const keys = Object.keys(row);
    const isLive = keys.some(k => {
      const v = str(row[k]).toLowerCase();
      return v === 'live' || v === 'in-play' || v === 'inplay';
    });

    const stakeKey = keys.find(k => k.toLowerCase().includes('stake') || k.toLowerCase().includes('turnover')) || keys[3];
    const pnlKey = keys.find(k => k.toLowerCase().includes('pnl') || k.toLowerCase().includes('profit') || k.toLowerCase().includes('result')) || keys[4];
    const userKey = keys.find(k => k.toLowerCase().includes('user') || k.toLowerCase().includes('customer') || k.toLowerCase().includes('player')) || keys[0];
    const sportKey = keys.find(k => k.toLowerCase().includes('sport')) || keys[1];

    const stake = num(row[stakeKey]);
    const pnl = num(row[pnlKey]);
    const user = str(row[userKey]);
    const sport = str(row[sportKey]);

    if (isLive) {
      liveBets++;
      liveTurnover += stake;
    } else {
      prematchBets++;
      prematchTurnover += stake;
    }

    if (user) {
      const existing = userMap.get(user) || { bets: 0, turnover: 0, pnl: 0 };
      existing.bets++;
      existing.turnover += stake;
      existing.pnl += pnl;
      userMap.set(user, existing);
    }

    if (sport) {
      const existing = sportMap.get(sport) || { bets: 0, turnover: 0, pnl: 0 };
      existing.bets++;
      existing.turnover += stake;
      existing.pnl += pnl;
      sportMap.set(sport, existing);
    }
  }

  if (liveBets + prematchBets > 0) {
    betSplit.push({
      date: new Date().toLocaleDateString(),
      liveBets, prematchBets, liveTurnover, prematchTurnover,
    });
  }

  const totalTurnover = liveTurnover + prematchTurnover;

  for (const [sport, data] of sportMap) {
    sportsBreakdown.push({
      sport,
      bets: data.bets,
      turnover: data.turnover,
      pnl: data.pnl,
      margin: data.turnover > 0 ? (data.pnl / data.turnover) * 100 : 0,
    });
  }

  for (const [userId, data] of userMap) {
    const concentrationPct = totalTurnover > 0 ? (data.turnover / totalTurnover) * 100 : 0;
    userSummaries.push({
      userId: userId.slice(0, 8),
      username: userId,
      bets: data.bets,
      turnover: data.turnover,
      pnl: data.pnl,
      margin: data.turnover > 0 ? (data.pnl / data.turnover) * 100 : 0,
      concentrationRisk: concentrationPct > 20 ? 'high' : concentrationPct > 10 ? 'medium' : 'low',
    });
  }

  // Parse Rejection Detail
  const rejectionRows = getRows(workbook, 'Rejection Detail');
  const rejectionMap = new Map<string, { count: number; turnover: number }>();

  for (const row of rejectionRows) {
    const keys = Object.keys(row);
    const reasonKey = keys.find(k => k.toLowerCase().includes('reason') || k.toLowerCase().includes('type')) || keys[0];
    const stakeKey = keys.find(k => k.toLowerCase().includes('stake') || k.toLowerCase().includes('turnover') || k.toLowerCase().includes('amount')) || keys[1];
    
    const reason = str(row[reasonKey]);
    const stake = num(row[stakeKey]);

    if (reason) {
      const existing = rejectionMap.get(reason) || { count: 0, turnover: 0 };
      existing.count++;
      existing.turnover += stake;
      rejectionMap.set(reason, existing);
    }
  }

  const totalRejections = Array.from(rejectionMap.values()).reduce((sum, v) => sum + v.count, 0);
  for (const [reason, data] of rejectionMap) {
    rejectionReasons.push({
      reason,
      count: data.count,
      blockedTurnover: data.turnover,
      percentage: totalRejections > 0 ? (data.count / totalRejections) * 100 : 0,
    });
  }

  // Parse Market Pattern
  const marketRows = getRows(workbook, 'Market Pattern');
  const marketPatterns: MarketPattern[] = [];

  for (const row of marketRows) {
    const keys = Object.keys(row);
    const marketKey = keys.find(k => k.toLowerCase().includes('market') || k.toLowerCase().includes('type') || k.toLowerCase().includes('name')) || keys[0];
    const countKey = keys.find(k => k.toLowerCase().includes('count') || k.toLowerCase().includes('bets') || k.toLowerCase().includes('number')) || keys[1];
    const turnoverKey = keys.find(k => k.toLowerCase().includes('turnover') || k.toLowerCase().includes('stake')) || keys[2];
    const pnlKey = keys.find(k => k.toLowerCase().includes('pnl') || k.toLowerCase().includes('profit') || k.toLowerCase().includes('result')) || keys[3];

    const market = str(row[marketKey]);
    if (market) {
      marketPatterns.push({
        market,
        count: num(row[countKey]),
        turnover: num(row[turnoverKey]),
        pnl: num(row[pnlKey]),
      });
    }
  }

  return {
    dailyPnL,
    betSplit,
    sportsBreakdown: sportsBreakdown.sort((a, b) => b.turnover - a.turnover),
    rejectionReasons: rejectionReasons.sort((a, b) => b.count - a.count),
    userSummaries: userSummaries.sort((a, b) => b.turnover - a.turnover),
    marketPatterns: marketPatterns.sort((a, b) => b.count - a.count),
    uploadDate: new Date().toISOString(),
  };
}

// Generate demo data for preview
export function generateDemoData(): DashboardData {
  const sports = ['Football', 'Basketball', 'Tennis', 'Ice Hockey', 'Baseball', 'MMA', 'Esports'];
  const markets = ['Match Winner', 'Over/Under', 'Asian Handicap', 'Both Teams Score', 'Correct Score', 'First Goalscorer', 'Half Time Result', 'Draw No Bet'];
  const reasons = ['Odds Changed', 'Max Stake Exceeded', 'Market Suspended', 'Account Restricted', 'Price Error', 'Event Started'];

  const dailyPnL: DailyPnL[] = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const turnover = 50000 + Math.random() * 150000;
    const pnl = (Math.random() - 0.4) * turnover * 0.08;
    return {
      date: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      pnl: Math.round(pnl),
      margin: (pnl / turnover) * 100,
      turnover: Math.round(turnover),
    };
  });

  const betSplit: BetSplit[] = [{
    date: new Date().toLocaleDateString(),
    liveBets: 1847,
    prematchBets: 3254,
    liveTurnover: 287500,
    prematchTurnover: 412300,
  }];

  const sportsBreakdown: SportBreakdown[] = sports.map(sport => {
    const turnover = 20000 + Math.random() * 180000;
    const pnl = (Math.random() - 0.35) * turnover * 0.06;
    return {
      sport,
      bets: Math.round(100 + Math.random() * 1500),
      turnover: Math.round(turnover),
      pnl: Math.round(pnl),
      margin: (pnl / turnover) * 100,
    };
  }).sort((a, b) => b.turnover - a.turnover);

  const totalRej = reasons.length;
  const rejectionReasons: RejectionReason[] = reasons.map(reason => {
    const count = Math.round(20 + Math.random() * 200);
    return {
      reason,
      count,
      blockedTurnover: Math.round(count * (50 + Math.random() * 300)),
      percentage: (count / (totalRej * 100)) * 100,
    };
  }).sort((a, b) => b.count - a.count);

  // Recalculate percentages
  const totalRejCount = rejectionReasons.reduce((s, r) => s + r.count, 0);
  rejectionReasons.forEach(r => r.percentage = (r.count / totalRejCount) * 100);

  const usernames = ['shark_player', 'high_roller_42', 'casual_joe', 'arb_hunter', 'weekend_punter', 'vip_client_3', 'new_user_891', 'steady_eddie', 'bonus_abuser_x', 'sharp_mike'];
  const totalTO = 699800;
  const userSummaries: UserSummary[] = usernames.map((username, i) => {
    const turnover = i === 0 ? 185000 : i === 1 ? 142000 : 10000 + Math.random() * 80000;
    const pnl = (Math.random() - (i < 2 ? 0.6 : 0.35)) * turnover * 0.05;
    const concPct = (turnover / totalTO) * 100;
    return {
      userId: `USR${String(1000 + i).slice(1)}`,
      username,
      bets: Math.round(20 + Math.random() * 500),
      turnover: Math.round(turnover),
      pnl: Math.round(pnl),
      margin: (pnl / turnover) * 100,
      concentrationRisk: (concPct > 20 ? 'high' : concPct > 10 ? 'medium' : 'low') as 'high' | 'medium' | 'low',
    };
  }).sort((a, b) => b.turnover - a.turnover);

  const marketPatterns: MarketPattern[] = markets.map(market => {
    const count = Math.round(50 + Math.random() * 800);
    const turnover = count * (30 + Math.random() * 200);
    const pnl = (Math.random() - 0.4) * turnover * 0.05;
    return { market, count, turnover: Math.round(turnover), pnl: Math.round(pnl) };
  }).sort((a, b) => b.count - a.count);

  return {
    dailyPnL,
    betSplit,
    sportsBreakdown,
    rejectionReasons,
    userSummaries,
    marketPatterns,
    uploadDate: new Date().toISOString(),
  };
}
