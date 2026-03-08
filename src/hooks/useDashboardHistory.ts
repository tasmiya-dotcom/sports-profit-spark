import { useState, useCallback, useEffect } from 'react';
import type { DashboardData } from '@/lib/types';

export interface HistoryEntry {
  id: string; // ISO date string used as key
  label: string; // display label e.g. "08 Mar 2026"
  fileName: string;
  uploadedAt: string; // ISO
  data: DashboardData;
}

const STORAGE_KEY = 'sportsbook_history';

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (e) {
    console.warn('Failed to save history to localStorage:', e);
  }
}

export function mergeManyDashboardData(entries: DashboardData[]): DashboardData | null {
  if (entries.length === 0) return null;
  if (entries.length === 1) return entries[0];

  let merged = structuredClone(entries[0]);
  for (let i = 1; i < entries.length; i++) {
    merged = mergeTwo(merged, entries[i]);
  }
  return merged;
}

function mergeTwo(a: DashboardData, b: DashboardData): DashboardData {
  const pnlMap = new Map(a.dailyPnL.map(d => [d.date, { ...d }]));
  for (const d of b.dailyPnL) {
    const ex = pnlMap.get(d.date);
    if (ex) { ex.pnl += d.pnl; ex.turnover += d.turnover; ex.margin = ex.turnover > 0 ? (ex.pnl / ex.turnover) * 100 : 0; }
    else pnlMap.set(d.date, { ...d });
  }

  const betSplit = [...a.betSplit];
  for (const bs of b.betSplit) {
    const ex = betSplit.find(e => e.date === bs.date);
    if (ex) { ex.liveBets += bs.liveBets; ex.prematchBets += bs.prematchBets; ex.liveTurnover += bs.liveTurnover; ex.prematchTurnover += bs.prematchTurnover; }
    else betSplit.push({ ...bs });
  }

  const sportMap = new Map(a.sportsBreakdown.map(s => [s.sport, { ...s }]));
  for (const s of b.sportsBreakdown) {
    const ex = sportMap.get(s.sport);
    if (ex) { ex.bets += s.bets; ex.turnover += s.turnover; ex.pnl += s.pnl; ex.margin = ex.turnover > 0 ? (ex.pnl / ex.turnover) * 100 : 0; }
    else sportMap.set(s.sport, { ...s });
  }

  const rejMap = new Map(a.rejectionReasons.map(r => [r.reason, { ...r }]));
  for (const r of b.rejectionReasons) {
    const ex = rejMap.get(r.reason);
    if (ex) { ex.count += r.count; ex.blockedTurnover += r.blockedTurnover; }
    else rejMap.set(r.reason, { ...r });
  }
  const rejections = Array.from(rejMap.values());
  const totalRejCount = rejections.reduce((s, r) => s + r.count, 0);
  rejections.forEach(r => r.percentage = totalRejCount > 0 ? (r.count / totalRejCount) * 100 : 0);
  rejections.sort((a, b) => b.count - a.count);

  const userMap = new Map(a.userSummaries.map(u => [u.username, { ...u }]));
  for (const u of b.userSummaries) {
    const ex = userMap.get(u.username);
    if (ex) { ex.bets += u.bets; ex.turnover += u.turnover; ex.pnl += u.pnl; ex.margin = ex.turnover > 0 ? (ex.pnl / ex.turnover) * 100 : 0; }
    else userMap.set(u.username, { ...u });
  }
  const users = Array.from(userMap.values());
  const totalTO = users.reduce((s, u) => s + u.turnover, 0);
  users.forEach(u => { const pct = totalTO > 0 ? (u.turnover / totalTO) * 100 : 0; u.concentrationRisk = pct > 20 ? 'high' : pct > 10 ? 'medium' : 'low'; });
  users.sort((a, b) => b.turnover - a.turnover);

  const mktMap = new Map(a.marketPatterns.map(m => [m.market, { ...m }]));
  for (const m of b.marketPatterns) {
    const ex = mktMap.get(m.market);
    if (ex) { ex.count += m.count; ex.turnover += m.turnover; ex.pnl += m.pnl; }
    else mktMap.set(m.market, { ...m });
  }

  return {
    dailyPnL: Array.from(pnlMap.values()),
    betSplit,
    sportsBreakdown: Array.from(sportMap.values()).sort((a, b) => b.turnover - a.turnover),
    rejectionReasons: rejections,
    userSummaries: users,
    marketPatterns: Array.from(mktMap.values()).sort((a, b) => b.turnover - a.turnover),
    uploadDate: b.uploadDate,
  };
}

export function useDashboardHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const [selectedId, setSelectedId] = useState<string | null>(null); // null = "All Days"

  useEffect(() => {
    saveHistory(history);
  }, [history]);

  const addEntry = useCallback((data: DashboardData, fileName: string) => {
    const now = new Date();
    const id = now.toISOString().split('T')[0]; // e.g. "2026-03-08"
    const label = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    setHistory(prev => {
      // If same date ID exists, merge into it
      const existing = prev.find(e => e.id === id);
      if (existing) {
        return prev.map(e =>
          e.id === id
            ? { ...e, data: mergeTwo(e.data, data), fileName: `${e.fileName}, ${fileName}`, uploadedAt: now.toISOString() }
            : e
        );
      }
      return [...prev, { id, label, fileName, uploadedAt: now.toISOString(), data }].sort((a, b) => a.id.localeCompare(b.id));
    });
  }, []);

  const deleteEntry = useCallback((id: string) => {
    setHistory(prev => prev.filter(e => e.id !== id));
    if (selectedId === id) setSelectedId(null);
  }, [selectedId]);

  const resetAll = useCallback(() => {
    setHistory([]);
    setSelectedId(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const activeData: DashboardData | null = selectedId
    ? history.find(e => e.id === selectedId)?.data ?? null
    : mergeManyDashboardData(history.map(e => e.data));

  return { history, selectedId, setSelectedId, addEntry, deleteEntry, resetAll, activeData };
}
