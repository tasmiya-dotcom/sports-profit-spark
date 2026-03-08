import { useState, useCallback, useEffect } from 'react';
import type { DashboardData } from '@/lib/types';

export interface HistoryEntry {
  id: string; // reportDate ISO e.g. "2026-03-07"
  label: string; // e.g. "07 Mar 2026"
  fileName: string;
  uploadedAt: string;
  data: DashboardData;
}

const STORAGE_KEY = 'sportsbook_history';

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const entries: HistoryEntry[] = JSON.parse(raw);
    // Filter out stale entries that lack the new kpiSummary field
    return entries.filter(e => e.data?.kpiSummary);
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

export function useDashboardHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    saveHistory(history);
  }, [history]);

  const addEntry = useCallback((data: DashboardData, fileName: string) => {
    const id = data.reportDate;
    const label = data.reportLabel;

    setHistory(prev => {
      // Check for duplicate date — reject if already exists
      if (prev.find(e => e.id === id)) {
        // Replace existing entry for that date (re-upload)
        return prev.map(e =>
          e.id === id
            ? { ...e, data, fileName, uploadedAt: new Date().toISOString() }
            : e
        ).sort((a, b) => a.id.localeCompare(b.id));
      }
      return [...prev, { id, label, fileName, uploadedAt: new Date().toISOString(), data }]
        .sort((a, b) => a.id.localeCompare(b.id));
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
    : null;

  return { history, selectedId, setSelectedId, addEntry, deleteEntry, resetAll, activeData };
}
