import * as XLSX from 'xlsx';
import type { DashboardData, DailyPnL, BetSplit, SportBreakdown, RejectionReason, UserSummary, MarketPattern, RiskAlert, KPISummary } from './types';

function num(v: any): number {
  if (v === null || v === undefined || v === '') return 0;
  const s = String(v).replace(/[€$,%]/g, '').replace(/\s/g, '').trim();
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function str(v: any): string {
  return v?.toString?.()?.trim() ?? '';
}

/**
 * Read a sheet as a 2D array of values (handles non-tabular Report sheets).
 */
function sheetToGrid(workbook: XLSX.WorkBook, sheetName: string): any[][] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];
}

function getRows(workbook: XLSX.WorkBook, sheetName: string): Record<string, any>[] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

/**
 * Extract report date from Report sheet title.
 * Looks for patterns like "07 Mar 2026", "2026-03-07", "March 7, 2026", etc.
 */
function extractReportDate(grid: any[][]): { iso: string; label: string } {
  const now = new Date();
  const fallback = {
    iso: now.toISOString().split('T')[0],
    label: now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
  };

  // Search first 10 rows for a date
  for (let r = 0; r < Math.min(grid.length, 10); r++) {
    for (let c = 0; c < Math.min((grid[r]?.length || 0), 10); c++) {
      const cell = str(grid[r][c]);
      if (!cell) continue;

      // Pattern: "07 Mar 2026" or "7 Mar 2026"
      const match1 = cell.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i);
      if (match1) {
        const d = new Date(`${match1[2]} ${match1[1]}, ${match1[3]}`);
        if (!isNaN(d.getTime())) {
          return {
            iso: d.toISOString().split('T')[0],
            label: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
          };
        }
      }

      // Pattern: "2026-03-07"
      const match2 = cell.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (match2) {
        const d = new Date(`${match2[1]}-${match2[2]}-${match2[3]}`);
        if (!isNaN(d.getTime())) {
          return {
            iso: d.toISOString().split('T')[0],
            label: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
          };
        }
      }

      // Pattern: "07/03/2026" or "03/07/2026"
      const match3 = cell.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (match3) {
        // Try DD/MM/YYYY first
        const d = new Date(`${match3[2]}/${match3[1]}/${match3[3]}`);
        if (!isNaN(d.getTime())) {
          return {
            iso: d.toISOString().split('T')[0],
            label: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
          };
        }
      }

      // Excel serial date number
      if (typeof grid[r][c] === 'number' && grid[r][c] > 40000 && grid[r][c] < 60000) {
        const d = XLSX.SSF.parse_date_code(grid[r][c]);
        if (d) {
          const date = new Date(d.y, d.m - 1, d.d);
          return {
            iso: date.toISOString().split('T')[0],
            label: date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
          };
        }
      }
    }
  }

  return fallback;
}

/**
 * Find a value in Report grid by searching for a label in column A.
 */
function findReportValue(grid: any[][], label: string): number {
  const labelLower = label.toLowerCase();
  for (const row of grid) {
    const cellLabel = str(row[0]).toLowerCase();
    if (cellLabel.includes(labelLower)) {
      // Return the first numeric value in the row
      for (let c = 1; c < row.length; c++) {
        const v = num(row[c]);
        if (v !== 0 || str(row[c]).trim() === '0') return v;
      }
    }
  }
  return 0;
}

/**
 * Extract risk alerts from the Report sheet.
 */
function extractRiskAlerts(grid: any[][]): RiskAlert[] {
  const alerts: RiskAlert[] = [];

  // Rows 4-7 in Excel = 0-indexed rows 3-6, column B = index 1
  for (let r = 3; r <= 6; r++) {
    const colB = str(grid[r]?.[1]).trim();
    if (!colB) continue;
    // Determine type based on content
    const upper = colB.toUpperCase();
    const isWarning = upper.includes('CONCENTRATION') || upper.includes('CCF');
    alerts.push({ type: isWarning ? 'warning' : 'info', message: colB });
  }

  return alerts;
}

/**
 * Count high risk users from Report sheet "Per User Summary" section (users >50% share).
 */
function countHighRiskUsersFromReport(grid: any[][]): number {
  let inUserSection = false;
  let pctColIdx = -1;
  let count = 0;

  for (const row of grid) {
    const cell0 = str(row[0]).toLowerCase();

    if (cell0.includes('per user') || cell0.includes('user summary')) {
      inUserSection = true;
      continue;
    }

    if (inUserSection && pctColIdx === -1) {
      // Find header row with percentage column
      for (let c = 0; c < row.length; c++) {
        const h = str(row[c]).toLowerCase();
        if (h.includes('%') || h.includes('share') || h.includes('concentration') || h.includes('percent')) {
          pctColIdx = c;
          break;
        }
      }
      if (pctColIdx >= 0) continue;
    }

    if (inUserSection && pctColIdx >= 0) {
      const val = num(row[pctColIdx]);
      // If value > 1, it's already a percentage; if <= 1, multiply by 100
      const pct = val > 1 ? val : val * 100;
      if (pct > 50) count++;
    }

    // Stop at next section
    if (inUserSection && cell0 && !cell0.includes('user') && (cell0.includes('risk') || cell0.includes('market') || cell0.includes('sport')) && pctColIdx >= 0) {
      break;
    }
  }

  return count;
}

export function parseExcelFile(buffer: ArrayBuffer): DashboardData {
  const workbook = XLSX.read(buffer, { type: 'array' });
  console.log('Sheet names:', workbook.SheetNames);

  // === REPORT SHEET (KPI source of truth) ===
  const reportGrid = sheetToGrid(workbook, 'Report');
  console.log('Report grid rows:', reportGrid.length);

  const { iso: reportDate, label: reportLabel } = extractReportDate(reportGrid);
  console.log('Extracted report date:', reportDate, reportLabel);

  // Read KPIs from Report sheet
  const kpiPnl = findReportValue(reportGrid, 'p&l') || findReportValue(reportGrid, 'profit') || findReportValue(reportGrid, 'net');
  const kpiTurnover = findReportValue(reportGrid, 'accepted turnover') || findReportValue(reportGrid, 'turnover');
  const kpiBets = findReportValue(reportGrid, 'accepted bets') || findReportValue(reportGrid, 'total bets') || findReportValue(reportGrid, 'bets');
  const kpiMargin = findReportValue(reportGrid, 'margin');
  const kpiRejections = findReportValue(reportGrid, 'risk & controls') || findReportValue(reportGrid, 'rejected') || findReportValue(reportGrid, 'rejection');
  const kpiHighRiskUsers = countHighRiskUsersFromReport(reportGrid);

  const riskAlerts = extractRiskAlerts(reportGrid);

  const kpiSummary: KPISummary = {
    pnl: Math.round(kpiPnl),
    turnover: Math.round(kpiTurnover),
    bets: Math.round(kpiBets),
    margin: kpiMargin,
    rejections: Math.round(kpiRejections),
    highRiskUsers: kpiHighRiskUsers,
  };

  console.log('KPI Summary:', kpiSummary);

  // === RAW DATA ===
  const rawRows = getRows(workbook, 'Raw Data');
  console.log('Raw Data rows:', rawRows.length);

  const userMap = new Map<string, { bets: number; turnover: number; pnl: number }>();
  const sportMap = new Map<string, { bets: number; turnover: number; pnl: number }>();
  let liveBets = 0, prematchBets = 0, liveTurnover = 0, prematchTurnover = 0;
  let rawTotalPnL = 0, rawTotalTurnover = 0;

  for (const row of rawRows) {
    const preMatchOrLive = str(row['Pre-Match or Live']).toUpperCase();
    const isLive = preMatchOrLive === 'L';

    const stake = num(row['Stake']) || num(row['Unit Stake (EUR)']) || num(row['Total Stake (EUR)']);
    const pnl = num(row['Pnl']) || num(row['P&L']) || num(row['Distributed P&L']);
    const sport = str(row['Sport']);
    const nickname = str(row['Nickname']);

    rawTotalPnL += pnl;
    rawTotalTurnover += stake;

    if (isLive) { liveBets++; liveTurnover += stake; }
    else { prematchBets++; prematchTurnover += stake; }

    if (sport) {
      const existing = sportMap.get(sport) || { bets: 0, turnover: 0, pnl: 0 };
      existing.bets++; existing.turnover += stake; existing.pnl += pnl;
      sportMap.set(sport, existing);
    }

    if (nickname) {
      const existing = userMap.get(nickname) || { bets: 0, turnover: 0, pnl: 0 };
      existing.bets++; existing.turnover += stake; existing.pnl += pnl;
      userMap.set(nickname, existing);
    }
  }

  // Use report KPIs if available, fallback to raw data aggregation
  const finalPnl = kpiSummary.pnl || Math.round(rawTotalPnL);
  const finalTurnover = kpiSummary.turnover || Math.round(rawTotalTurnover);
  const finalBets = kpiSummary.bets || (liveBets + prematchBets);
  const finalMargin = kpiSummary.margin || (finalTurnover > 0 ? (finalPnl / finalTurnover) * 100 : 0);

  // Override KPI summary with best available
  kpiSummary.pnl = finalPnl;
  kpiSummary.turnover = finalTurnover;
  kpiSummary.bets = finalBets;
  kpiSummary.margin = finalMargin;

  const shortDate = new Date(reportDate + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

  const dailyPnL: DailyPnL[] = [{
    date: shortDate,
    pnl: finalPnl,
    margin: finalMargin,
    turnover: finalTurnover,
  }];

  const betSplit: BetSplit[] = [{
    date: shortDate,
    liveBets, prematchBets, liveTurnover, prematchTurnover,
  }];

  // Sports breakdown
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

  // User summaries
  const userSummaries: UserSummary[] = [];
  const totalUserTO = Array.from(userMap.values()).reduce((s, u) => s + u.turnover, 0);
  for (const [username, data] of userMap) {
    const concPct = totalUserTO > 0 ? (data.turnover / totalUserTO) * 100 : 0;
    userSummaries.push({
      userId: username.slice(0, 8),
      username,
      bets: data.bets,
      turnover: Math.round(data.turnover),
      pnl: Math.round(data.pnl),
      margin: data.turnover > 0 ? (data.pnl / data.turnover) * 100 : 0,
      concentrationRisk: (concPct > 50 ? 'high' : concPct > 20 ? 'medium' : 'low') as 'high' | 'medium' | 'low',
    });
  }
  userSummaries.sort((a, b) => b.turnover - a.turnover);

  // If no high risk users found in Report, count from raw data
  if (kpiSummary.highRiskUsers === 0) {
    kpiSummary.highRiskUsers = userSummaries.filter(u => u.concentrationRisk === 'high').length;
  }

  // === REJECTION DETAIL ===
  const rejectionRows = getRows(workbook, 'Rejection Detail');
  const rejectionMap = new Map<string, { count: number; turnover: number; pnl: number }>();
  for (const row of rejectionRows) {
    const keys = Object.keys(row).filter(k => !k.startsWith('__'));
    let reason = '';
    let stake = 0;
    let pnl = 0;

    for (const k of keys) {
      const val = str(row[k]);
      const numVal = num(row[k]);
      const kl = k.toLowerCase();

      if (kl.includes('reason') || kl.includes('rejection')) reason = val;
      else if (kl.includes('stake') || kl.includes('turnover') || kl.includes('amount')) stake = numVal;
      else if (kl.includes('p&l') || kl.includes('pnl') || kl.includes('potential')) pnl = numVal;
    }

    if (!reason) {
      const nonEmpty = keys.filter(k => str(row[k]).trim() !== '' && k !== '__rowNum__');
      if (nonEmpty.length >= 2) {
        const firstVal = str(row[nonEmpty[0]]);
        if (firstVal && !firstVal.includes('REJECTION') && !firstVal.includes('REJECTED') && !firstVal.includes('RISK')) {
          reason = firstVal;
          stake = num(row[nonEmpty[1]]) || num(row[nonEmpty[2]]) || 0;
          pnl = num(row[nonEmpty[2]]) || num(row[nonEmpty[3]]) || 0;
        }
      }
    }

    if (reason && reason.length > 1) {
      const existing = rejectionMap.get(reason) || { count: 0, turnover: 0, pnl: 0 };
      existing.count++;
      existing.turnover += stake;
      existing.pnl += pnl;
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
      potentialPnl: Math.round(data.pnl),
      percentage: totalRejCount > 0 ? (data.count / totalRejCount) * 100 : 0,
    });
  }
  rejectionReasons.sort((a, b) => b.count - a.count);

  // If no rejections count from report, use parsed count
  if (kpiSummary.rejections === 0) {
    kpiSummary.rejections = totalRejCount;
  }

  // === MARKET PATTERN ===
  const marketRows = getRows(workbook, 'Market Pattern');
  const marketPatterns: MarketPattern[] = [];
  for (const row of marketRows) {
    const market = str(row['Market Group'] || row['Mg'] || '');
    const turnover = num(row['Turnover']);
    const pnl = num(row['P&L'] || row['Pnl'] || row['PnL']);

    if (market && market.length > 0 && !market.toUpperCase().includes('MARKET PATTERN')) {
      marketPatterns.push({ market, count: 0, turnover: Math.round(turnover), pnl: Math.round(pnl) });
    }
  }

  // Enrich counts from Raw Data
  const mgCountMap = new Map<string, number>();
  for (const row of rawRows) {
    const mg = str(row['Mg']);
    if (mg) mgCountMap.set(mg, (mgCountMap.get(mg) || 0) + 1);
  }
  for (const mp of marketPatterns) {
    for (const [mg, count] of mgCountMap) {
      if (mp.market.toLowerCase().includes(mg.toLowerCase()) || mg.toLowerCase().includes(mp.market.toLowerCase())) {
        mp.count += count;
      }
    }
  }
  marketPatterns.sort((a, b) => b.turnover - a.turnover);

  return {
    reportDate,
    reportLabel,
    kpiSummary,
    dailyPnL,
    betSplit,
    sportsBreakdown,
    rejectionReasons,
    userSummaries,
    marketPatterns,
    riskAlerts,
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

  const totalPnL = dailyPnL.reduce((s, d) => s + d.pnl, 0);
  const totalTO = dailyPnL.reduce((s, d) => s + d.turnover, 0);
  const totalBets = 5101;

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
    return { reason, count, blockedTurnover: Math.round(count * (50 + Math.random() * 300)), potentialPnl: Math.round(count * (10 + Math.random() * 50)), percentage: (count / (totalRej * 100)) * 100 };
  }).sort((a, b) => b.count - a.count);
  const totalRejCount = rejectionReasons.reduce((s, r) => s + r.count, 0);
  rejectionReasons.forEach(r => r.percentage = (r.count / totalRejCount) * 100);

  const usernames = ['shark_player', 'high_roller_42', 'casual_joe', 'arb_hunter', 'weekend_punter', 'vip_client_3', 'new_user_891', 'steady_eddie', 'bonus_abuser_x', 'sharp_mike'];
  const userSummaries: UserSummary[] = usernames.map((username, i) => {
    const turnover = i === 0 ? 185000 : i === 1 ? 142000 : 10000 + Math.random() * 80000;
    const pnl = (Math.random() - (i < 2 ? 0.6 : 0.35)) * turnover * 0.05;
    const concPct = (turnover / 699800) * 100;
    return {
      userId: `USR${String(1000 + i).slice(1)}`, username,
      bets: Math.round(20 + Math.random() * 500), turnover: Math.round(turnover), pnl: Math.round(pnl),
      margin: (pnl / turnover) * 100,
      concentrationRisk: (concPct > 50 ? 'high' : concPct > 20 ? 'medium' : 'low') as 'high' | 'medium' | 'low',
    };
  }).sort((a, b) => b.turnover - a.turnover);

  const marketPatterns: MarketPattern[] = markets.map(market => {
    const count = Math.round(50 + Math.random() * 800);
    const turnover = count * (30 + Math.random() * 200);
    const pnl = (Math.random() - 0.4) * turnover * 0.05;
    return { market, count, turnover: Math.round(turnover), pnl: Math.round(pnl) };
  }).sort((a, b) => b.count - a.count);

  return {
    reportDate: new Date().toISOString().split('T')[0],
    reportLabel: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    kpiSummary: {
      pnl: totalPnL,
      turnover: totalTO,
      bets: totalBets,
      margin: totalTO > 0 ? (totalPnL / totalTO) * 100 : 0,
      rejections: totalRejCount,
      highRiskUsers: userSummaries.filter(u => u.concentrationRisk === 'high').length,
    },
    dailyPnL, betSplit, sportsBreakdown, rejectionReasons, userSummaries, marketPatterns,
    riskAlerts: [
      { type: 'warning', message: 'shark_player turnover concentration at 26.4%' },
      { type: 'info', message: 'Tennis margin below threshold at -2.1%' },
    ],
    uploadDate: new Date().toISOString(),
  };
}
