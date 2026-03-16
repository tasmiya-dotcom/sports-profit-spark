import * as XLSX from 'xlsx';
import type { DashboardData, DailyPnL, BetSplit, SportBreakdown, RejectionReason, UserSummary, MarketPattern, TopPlayerSpotlight, KPISummary } from './types';

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
 * Extract top player from "Per User Summary" section of Report sheet.
 * Finds the player with the highest turnover share.
 */
function extractTopPlayerFromReport(grid: any[][]): { nickname: string; sourceId: string; bets: number; turnover: number; turnoverSharePct: number } | null {
  let inUserSection = false;
  let headerRow: any[] | null = null;
  let colMap: Record<string, number> = {};
  let bestPlayer: { nickname: string; sourceId: string; bets: number; turnover: number; turnoverSharePct: number } | null = null;
  let bestShare = -1;

  for (let r = 0; r < grid.length; r++) {
    const cell0 = str(grid[r]?.[0]).toLowerCase();

    if (cell0.includes('per user') || cell0.includes('user summary')) {
      inUserSection = true;
      continue;
    }

    if (inUserSection && !headerRow) {
      // Detect header row by looking for recognizable column names
      const row = grid[r];
      for (let c = 0; c < (row?.length || 0); c++) {
        const h = str(row[c]).toLowerCase();
        if (h.includes('nickname') || h.includes('nick')) colMap['nickname'] = c;
        if (h.includes('source') || h.includes('id')) colMap['sourceId'] = c;
        if (h.includes('bet') && !h.includes('turnover')) colMap['bets'] = c;
        if (h.includes('turnover') || h.includes('stake')) colMap['turnover'] = c;
        if (h.includes('%') || h.includes('share') || h.includes('concentration') || h.includes('percent')) colMap['share'] = c;
      }
      if (Object.keys(colMap).length >= 2) {
        headerRow = row;
        continue;
      } else {
        colMap = {};
      }
    }

    if (inUserSection && headerRow) {
      const row = grid[r];
      // Stop at next section
      const c0 = str(row?.[0]).toLowerCase();
      if (c0 && (c0.includes('risk') || c0.includes('market') || c0.includes('sport') || c0.includes('rejection'))) break;

      const share = num(row?.[colMap['share']]);
      const sharePct = share > 1 ? share : share * 100;
      if (sharePct > bestShare && sharePct > 0) {
        bestShare = sharePct;
        const nick = str(row?.[colMap['nickname']]);
        const srcId = str(row?.[colMap['sourceId']]);
        bestPlayer = {
          nickname: nick || '—',
          sourceId: srcId || nick || 'Unknown',
          bets: Math.round(num(row?.[colMap['bets']])),
          turnover: Math.round(num(row?.[colMap['turnover']])),
          turnoverSharePct: Math.round(sharePct * 10) / 10,
        };
      }
    }
  }

  return bestPlayer;
}

/**
 * Count high risk users from Report sheet "Per User Summary" section (users >50% share).
 */
function countHighRiskUsersFromReport(grid: any[][]): number {
  const users = extractAllUsersFromReport(grid);
  return users.filter(u => u.concentrationRisk === 'high').length;
}

/**
 * Extract ALL users from "Per User Summary" section of Report sheet.
 */
function extractAllUsersFromReport(grid: any[][]): UserSummary[] {
  let inUserSection = false;
  let headerRow: any[] | null = null;
  let colMap: Record<string, number> = {};
  const users: UserSummary[] = [];

  for (let r = 0; r < grid.length; r++) {
    const cell0 = str(grid[r]?.[0]).toLowerCase();

    if (cell0.includes('per user') || cell0.includes('user summary')) {
      inUserSection = true;
      continue;
    }

    if (inUserSection && !headerRow) {
      const row = grid[r];
      for (let c = 0; c < (row?.length || 0); c++) {
        const h = str(row[c]).toLowerCase();
        if (h.includes('nickname') || h.includes('nick')) colMap['nickname'] = c;
        if (h.includes('source') || h.includes('id')) colMap['sourceId'] = c;
        if (h.includes('bet') && !h.includes('turnover')) colMap['bets'] = c;
        if (h.includes('turnover') || h.includes('stake')) colMap['turnover'] = c;
        if (h.includes('p&l') || h.includes('pnl') || h.includes('profit')) colMap['pnl'] = c;
        if (h.includes('margin')) colMap['margin'] = c;
        if (h.includes('%') || h.includes('share') || h.includes('concentration') || h.includes('percent')) colMap['share'] = c;
      }
      if (Object.keys(colMap).length >= 2) {
        headerRow = row;
        continue;
      } else {
        colMap = {};
      }
    }

    if (inUserSection && headerRow) {
      const row = grid[r];
      const c0 = str(row?.[0]).toLowerCase();
      if (c0 && (c0.includes('risk') || c0.includes('market') || c0.includes('sport') || c0.includes('rejection'))) break;
      // Skip empty rows
      const nick = str(row?.[colMap['nickname']]);
      const srcId = str(row?.[colMap['sourceId']]);
      if (!nick && !srcId) continue;

      const share = num(row?.[colMap['share']]);
      const sharePct = share > 1 ? share : share * 100;
      const userTurnover = Math.round(num(row?.[colMap['turnover']]));
      const userPnl = Math.round(num(row?.[colMap['pnl']]));
      const userMargin = colMap['margin'] !== undefined ? num(row?.[colMap['margin']]) : (userTurnover > 0 ? (userPnl / userTurnover) * 100 : 0);

      users.push({
        userId: srcId || nick.slice(0, 8),
        username: nick || srcId,
        bets: Math.round(num(row?.[colMap['bets']])),
        turnover: userTurnover,
        pnl: userPnl,
        margin: userMargin > 1 || userMargin < -1 ? userMargin : userMargin * 100,
        concentrationRisk: (sharePct > 50 ? 'high' : sharePct > 20 ? 'medium' : 'low') as 'high' | 'medium' | 'low',
      });
    }
  }

  return users;
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

  const topPlayerFromReport = extractTopPlayerFromReport(reportGrid);

  const kpiSummary: KPISummary = {
    pnl: Math.round(kpiPnl),
    turnover: Math.round(kpiTurnover),
    bets: Math.round(kpiBets),
    margin: Math.abs(kpiMargin) > 0 && Math.abs(kpiMargin) < 1 ? kpiMargin * 100 : kpiMargin,
    rejections: Math.round(kpiRejections),
    highRiskUsers: kpiHighRiskUsers,
  };

  console.log('KPI Summary:', kpiSummary);

  // === RAW DATA ===
  const rawRows = getRows(workbook, 'Raw Data');
  console.log('Raw Data rows:', rawRows.length);

  const userMap = new Map<string, { bets: number; turnover: number; pnl: number }>();
  const sportMap = new Map<string, { bets: number; turnover: number; pnl: number }>();
  const hourMap = new Map<number, number>();
  const rawMarketMap = new Map<string, number>();
  let liveBets = 0, prematchBets = 0, liveTurnover = 0, prematchTurnover = 0;
  let rawTotalPnL = 0, rawTotalTurnover = 0;

  for (const row of rawRows) {
    const preMatchOrLive = str(row['Pre-Match or Live']).toUpperCase();
    const isLive = preMatchOrLive === 'L';

    const stake = num(row['Stake']) || num(row['Unit Stake (EUR)']) || num(row['Total Stake (EUR)']);
    const pnl = num(row['Distributed P&L']) || num(row['P&L']) || num(row['Pnl']);
    const sport = str(row['Sport']);
    const nickname = str(row['Nickname']);
    const market = str(row['Market'] || row['Market Group'] || row['Mg'] || '');

    // Extract hour from Date/Time column
    const dtRaw = row['Date/Time'] || row['Date'] || row['DateTime'] || row['Timestamp'] || '';
    if (dtRaw) {
      let hour = -1;
      if (typeof dtRaw === 'number') {
        // Excel serial date — fractional part is time
        const frac = dtRaw % 1;
        hour = Math.floor(frac * 24);
      } else {
        const timeMatch = String(dtRaw).match(/(\d{1,2}):(\d{2})/);
        if (timeMatch) hour = parseInt(timeMatch[1], 10);
      }
      if (hour >= 0 && hour < 24) hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
    }

    if (market) rawMarketMap.set(market, (rawMarketMap.get(market) || 0) + 1);

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

  // User summaries — prefer Report sheet "Per User Summary" section, fallback to Raw Data
  const reportUsers = extractAllUsersFromReport(reportGrid);
  let userSummaries: UserSummary[];
  if (reportUsers.length > 0) {
    userSummaries = reportUsers;
  } else {
    userSummaries = [];
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

    // Filter out section headers, column headers, usernames, and non-reason entries
    const rejectionJunkPatterns = /^(rejection reason|reason|sport|nickname|user|source|bets|turnover|stake|p&l|pnl|total|count|generated:|rejected bets|summary|overview|\d{4}-\d{2}-\d{2})/i;
    const isLikelyHeader = reason.toUpperCase() === reason && reason.length > 15; // ALL-CAPS section headers
    const isSingleWord = !reason.includes(' ') && reason.length < 20 && !/limit|exceed|restrict|block|suspend|error|fail|invalid|duplicate|cancel/i.test(reason);

    if (reason && reason.length > 1 && !rejectionJunkPatterns.test(reason) && !isLikelyHeader && !isSingleWord) {
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

  // === TOP PLAYER with CCF ===
  let topPlayer: TopPlayerSpotlight | null = null;
  if (topPlayerFromReport) {
    // Try to find CCF from Raw Data for this player
    let ccf: number | null = null;
    const playerKey = topPlayerFromReport.nickname !== '—' ? topPlayerFromReport.nickname : topPlayerFromReport.sourceId;
    for (const row of rawRows) {
      const nickname = str(row['Nickname']);
      const sourceId = str(row['Source ID'] || row['SourceID'] || row['Source']);
      if (nickname === playerKey || sourceId === playerKey || sourceId === topPlayerFromReport.sourceId) {
        const ccfVal = num(row['CCF'] || row['Customer Factor'] || row['CustomerFactor']);
        if (ccfVal !== 0) { ccf = ccfVal; break; }
      }
    }
    topPlayer = { ...topPlayerFromReport, ccf };
  }

  const hourlyBets = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: hourMap.get(h) || 0 }));
  const rawMarkets = Array.from(rawMarketMap, ([market, count]) => ({ market, count })).sort((a, b) => b.count - a.count);

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
    topPlayer,
    uploadDate: new Date().toISOString(),
    hourlyBets,
    rawMarkets,
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

  const hourlyBets = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    count: Math.round(h >= 8 && h <= 23 ? (30 + Math.random() * 200) * (h >= 18 && h <= 21 ? 2.5 : 1) : Math.random() * 20),
  }));
  const rawMarkets = ['Match Winner', 'Over/Under 2.5', 'Asian Handicap', 'Both Teams to Score', 'Total Goals', 'First Goalscorer', 'Innings Runs', 'Handicap -1.5']
    .map(m => ({ market: m, count: Math.round(30 + Math.random() * 500) }))
    .sort((a, b) => b.count - a.count);

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
    topPlayer: {
      nickname: 'shark_player',
      sourceId: 'USR000',
      bets: 347,
      turnover: 185000,
      turnoverSharePct: 26.4,
      ccf: 0.85,
    },
    uploadDate: new Date().toISOString(),
    hourlyBets,
    rawMarkets,
  };
}
