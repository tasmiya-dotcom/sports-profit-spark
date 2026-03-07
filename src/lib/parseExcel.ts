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
  console.log('Sheet names:', workbook.SheetNames);

  // === RAW DATA (main source of truth) ===
  const rawRows = getRows(workbook, 'Raw Data');
  console.log('Raw Data rows:', rawRows.length, 'Sample:', rawRows[0]);

  const userMap = new Map<string, { bets: number; turnover: number; pnl: number }>();
  const sportMap = new Map<string, { bets: number; turnover: number; pnl: number }>();
  let liveBets = 0, prematchBets = 0, liveTurnover = 0, prematchTurnover = 0;
  let totalPnL = 0, totalTurnover = 0;

  for (const row of rawRows) {
    const preMatchOrLive = str(row['Pre-Match or Live']).toUpperCase();
    const isLive = preMatchOrLive === 'L';

    const stake = num(row['Stake']) || num(row['Unit Stake (EUR)']) || num(row['Total Stake (EUR)']);
    const pnl = num(row['Pnl']) || num(row['P&L']) || num(row['Distributed P&L']);
    const sport = str(row['Sport']);
    const nickname = str(row['Nickname']);

    totalPnL += pnl;
    totalTurnover += stake;

    if (isLive) {
      liveBets++;
      liveTurnover += stake;
    } else {
      prematchBets++;
      prematchTurnover += stake;
    }

    // Sport breakdown
    if (sport) {
      const existing = sportMap.get(sport) || { bets: 0, turnover: 0, pnl: 0 };
      existing.bets++;
      existing.turnover += stake;
      existing.pnl += pnl;
      sportMap.set(sport, existing);
    }

    // User summary
    if (nickname) {
      const existing = userMap.get(nickname) || { bets: 0, turnover: 0, pnl: 0 };
      existing.bets++;
      existing.turnover += stake;
      existing.pnl += pnl;
      userMap.set(nickname, existing);
    }
  }

  // Build daily P&L (single day from this file)
  const dailyPnL: DailyPnL[] = [{
    date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
    pnl: Math.round(totalPnL),
    margin: totalTurnover > 0 ? (totalPnL / totalTurnover) * 100 : 0,
    turnover: Math.round(totalTurnover),
  }];

  // Build bet split
  const betSplit: BetSplit[] = [{
    date: new Date().toLocaleDateString(),
    liveBets, prematchBets, liveTurnover, prematchTurnover,
  }];

  // Build sports breakdown
  const sportsBreakdown: SportBreakdown[] = [];
  for (const [sport, data] of sportMap) {
    sportsBreakdown.push({
      sport,
      bets: data.bets,
      turnover: Math.round(data.turnover),
      pnl: Math.round(data.pnl),
      margin: data.turnover > 0 ? (data.pnl / data.turnover) * 100 : 0,
    });
  }
  sportsBreakdown.sort((a, b) => b.turnover - a.turnover);

  // Build user summaries
  const userSummaries: UserSummary[] = [];
  for (const [username, data] of userMap) {
    const concPct = totalTurnover > 0 ? (data.turnover / totalTurnover) * 100 : 0;
    userSummaries.push({
      userId: username.slice(0, 8),
      username,
      bets: data.bets,
      turnover: Math.round(data.turnover),
      pnl: Math.round(data.pnl),
      margin: data.turnover > 0 ? (data.pnl / data.turnover) * 100 : 0,
      concentrationRisk: (concPct > 20 ? 'high' : concPct > 10 ? 'medium' : 'low') as 'high' | 'medium' | 'low',
    });
  }
  userSummaries.sort((a, b) => b.turnover - a.turnover);

  // === REJECTION DETAIL ===
  // This sheet has formatted headers. Look for rows with rejection-like data.
  const rejectionRows = getRows(workbook, 'Rejection Detail');
  console.log('Rejection Detail rows:', rejectionRows.length, 'First 5:', rejectionRows.slice(0, 5));
  
  const rejectionMap = new Map<string, { count: number; turnover: number }>();
  for (const row of rejectionRows) {
    const keys = Object.keys(row).filter(k => !k.startsWith('__'));
    // Try to find reason and stake in any column
    let reason = '';
    let stake = 0;
    
    for (const k of keys) {
      const val = str(row[k]);
      const numVal = num(row[k]);
      
      if (k.toLowerCase().includes('reason') || k.toLowerCase().includes('rejection')) {
        reason = val;
      } else if (k.toLowerCase().includes('stake') || k.toLowerCase().includes('turnover') || k.toLowerCase().includes('amount')) {
        stake = numVal;
      }
    }
    
    // Fallback: if no labeled columns, try positional from non-empty values
    if (!reason) {
      const nonEmpty = keys.filter(k => str(row[k]).trim() !== '' && k !== '__rowNum__');
      if (nonEmpty.length >= 2) {
        const firstVal = str(row[nonEmpty[0]]);
        // Skip header-like rows
        if (firstVal && !firstVal.includes('REJECTION') && !firstVal.includes('REJECTED') && !firstVal.includes('RISK')) {
          reason = firstVal;
          stake = num(row[nonEmpty[1]]) || num(row[nonEmpty[2]]) || 0;
        }
      }
    }
    
    if (reason && reason.length > 1) {
      const existing = rejectionMap.get(reason) || { count: 0, turnover: 0 };
      existing.count++;
      existing.turnover += stake;
      rejectionMap.set(reason, existing);
    }
  }

  const rejectionReasons: RejectionReason[] = [];
  const totalRejCount = Array.from(rejectionMap.values()).reduce((s, v) => s + v.count, 0);
  for (const [reason, data] of rejectionMap) {
    rejectionReasons.push({
      reason,
      count: data.count,
      blockedTurnover: Math.round(data.turnover),
      percentage: totalRejCount > 0 ? (data.count / totalRejCount) * 100 : 0,
    });
  }
  rejectionReasons.sort((a, b) => b.count - a.count);

  // === MARKET PATTERN ===
  const marketRows = getRows(workbook, 'Market Pattern');
  console.log('Market Pattern rows:', marketRows.length, 'First 3:', marketRows.slice(0, 3));
  
  const marketPatterns: MarketPattern[] = [];
  for (const row of marketRows) {
    const market = str(row['Market Group'] || row['Mg'] || '');
    const turnover = num(row['Turnover']);
    const pnl = num(row['P&L'] || row['Pnl'] || row['PnL']);

    if (market && market.length > 0 && !market.includes('MARKET PATTERN')) {
      marketPatterns.push({
        market,
        count: 0, // Not in this sheet, will derive from Raw Data
        turnover: Math.round(turnover),
        pnl: Math.round(pnl),
      });
    }
  }

  // Enrich market pattern counts from Raw Data using Mg column
  const mgCountMap = new Map<string, number>();
  for (const row of rawRows) {
    const mg = str(row['Mg']);
    if (mg) {
      mgCountMap.set(mg, (mgCountMap.get(mg) || 0) + 1);
    }
  }
  for (const mp of marketPatterns) {
    // Try to match by partial name
    for (const [mg, count] of mgCountMap) {
      if (mp.market.toLowerCase().includes(mg.toLowerCase()) || mg.toLowerCase().includes(mp.market.toLowerCase())) {
        mp.count += count;
      }
    }
  }

  marketPatterns.sort((a, b) => b.turnover - a.turnover);

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
    liveBets: 1847, prematchBets: 3254,
    liveTurnover: 287500, prematchTurnover: 412300,
  }];

  const sportsBreakdown: SportBreakdown[] = sports.map(sport => {
    const turnover = 20000 + Math.random() * 180000;
    const pnl = (Math.random() - 0.35) * turnover * 0.06;
    return { sport, bets: Math.round(100 + Math.random() * 1500), turnover: Math.round(turnover), pnl: Math.round(pnl), margin: (pnl / turnover) * 100 };
  }).sort((a, b) => b.turnover - a.turnover);

  const totalRej = reasons.length;
  const rejectionReasons: RejectionReason[] = reasons.map(reason => {
    const count = Math.round(20 + Math.random() * 200);
    return { reason, count, blockedTurnover: Math.round(count * (50 + Math.random() * 300)), percentage: (count / (totalRej * 100)) * 100 };
  }).sort((a, b) => b.count - a.count);
  const totalRejCount = rejectionReasons.reduce((s, r) => s + r.count, 0);
  rejectionReasons.forEach(r => r.percentage = (r.count / totalRejCount) * 100);

  const usernames = ['shark_player', 'high_roller_42', 'casual_joe', 'arb_hunter', 'weekend_punter', 'vip_client_3', 'new_user_891', 'steady_eddie', 'bonus_abuser_x', 'sharp_mike'];
  const totalTO = 699800;
  const userSummaries: UserSummary[] = usernames.map((username, i) => {
    const turnover = i === 0 ? 185000 : i === 1 ? 142000 : 10000 + Math.random() * 80000;
    const pnl = (Math.random() - (i < 2 ? 0.6 : 0.35)) * turnover * 0.05;
    const concPct = (turnover / totalTO) * 100;
    return {
      userId: `USR${String(1000 + i).slice(1)}`, username,
      bets: Math.round(20 + Math.random() * 500), turnover: Math.round(turnover), pnl: Math.round(pnl),
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

  return { dailyPnL, betSplit, sportsBreakdown, rejectionReasons, userSummaries, marketPatterns, uploadDate: new Date().toISOString() };
}
