import { useState, useCallback, useEffect, useMemo } from 'react';
import type { DashboardData } from '@/lib/types';
import { DEFAULT_ENTRIES } from '@/lib/defaultData';

export interface HistoryEntry {
  id: string;
  label: string;
  fileName: string;
  uploadedAt: string;
  data: DashboardData;
  isDefault?: boolean;
}

const STORAGE_KEY = 'sportsbook_history';
const DEFAULT_IDS = new Set(DEFAULT_ENTRIES.map(e => e.id));

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const entries: HistoryEntry[] = JSON.parse(raw);
    return entries.filter(e => e.data?.kpiSummary && !DEFAULT_IDS.has(e.id));
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]) {
  try {
    // Only persist non-default entries
    const toSave = entries.filter(e => !e.isDefault);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.warn('Failed to save history to localStorage:', e);
  }
}

export function useDashboardHistory() {
  const [uploadedHistory, setUploadedHistory] = useState<HistoryEntry[]>(loadHistory);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Always merge defaults + uploaded, sorted by date
  const history = useMemo(() => {
    const merged = [...DEFAULT_ENTRIES, ...uploadedHistory];
    return merged.sort((a, b) => a.id.localeCompare(b.id));
  }, [uploadedHistory]);

  useEffect(() => {
    saveHistory(uploadedHistory);
  }, [uploadedHistory]);

  const addEntry = useCallback((data: DashboardData, fileName: string) => {
    const id = data.reportDate;
    const label = data.reportLabel;

    // Don't overwrite default entries
    if (DEFAULT_IDS.has(id)) return;

    setUploadedHistory(prev => {
      if (prev.find(e => e.id === id)) {
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
    // Don't delete default entries
    if (DEFAULT_IDS.has(id)) return;
    setUploadedHistory(prev => prev.filter(e => e.id !== id));
    if (selectedId === id) setSelectedId(null);
  }, [selectedId]);

  const resetAll = useCallback(() => {
    setUploadedHistory([]);
    setSelectedId(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const activeData: DashboardData | null = selectedId
    ? history.find(e => e.id === selectedId)?.data ?? null
    : null;

  return { history, selectedId, setSelectedId, addEntry, deleteEntry, resetAll, activeData };
}
