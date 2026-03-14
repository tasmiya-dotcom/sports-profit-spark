import { useState, useCallback, useEffect, useMemo } from 'react';
import type { DashboardData } from '@/lib/types';
import { DEFAULT_ENTRIES } from '@/lib/defaultData';
import { supabase } from '@/lib/supabase';

export interface HistoryEntry {
  id: string;
  label: string;
  fileName: string;
  uploadedAt: string;
  data: DashboardData;
  isDefault?: boolean;
}

const DEFAULT_IDS = new Set(DEFAULT_ENTRIES.map(e => e.id));

export function useDashboardHistory() {
  const [uploadedHistory, setUploadedHistory] = useState<HistoryEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch from Supabase on mount
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const { data, error } = await supabase
          .from('daily_reports')
          .select('*')
          .order('id', { ascending: true });

        if (error) {
          console.error('Failed to fetch daily_reports:', error);
          return;
        }

        if (data) {
          const entries: HistoryEntry[] = data.map((row: any) => ({
            id: row.id,
            label: row.label,
            fileName: row.file_name,
            uploadedAt: row.uploaded_at,
            data: row.data as DashboardData,
          }));
          setUploadedHistory(entries);
        }
      } catch (e) {
        console.error('Failed to fetch daily_reports:', e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, []);

  // Always merge defaults + uploaded, sorted by date
  const history = useMemo(() => {
    const merged = [...DEFAULT_ENTRIES, ...uploadedHistory];
    return merged.sort((a, b) => a.id.localeCompare(b.id));
  }, [uploadedHistory]);

  const addEntry = useCallback(async (data: DashboardData, fileName: string) => {
    const id = data.reportDate;
    const label = data.reportLabel;

    // Don't overwrite default entries
    if (DEFAULT_IDS.has(id)) return;

    const entry: HistoryEntry = {
      id,
      label,
      fileName,
      uploadedAt: new Date().toISOString(),
      data,
    };

    // Optimistic local update
    setUploadedHistory(prev => {
      const filtered = prev.filter(e => e.id !== id);
      return [...filtered, entry].sort((a, b) => a.id.localeCompare(b.id));
    });

    // Persist to Supabase
    const { error } = await supabase
      .from('daily_reports')
      .upsert({
        id,
        label,
        file_name: fileName,
        uploaded_at: entry.uploadedAt,
        data,
      }, { onConflict: 'id' });

    if (error) console.error('Failed to save daily report:', error);
  }, []);

  const deleteEntry = useCallback(async (id: string) => {
    if (DEFAULT_IDS.has(id)) return;
    setUploadedHistory(prev => prev.filter(e => e.id !== id));
    if (selectedId === id) setSelectedId(null);

    const { error } = await supabase.from('daily_reports').delete().eq('id', id);
    if (error) console.error('Failed to delete daily report:', error);
  }, [selectedId]);

  const resetAll = useCallback(async () => {
    setUploadedHistory([]);
    setSelectedId(null);

    const { error } = await supabase.from('daily_reports').delete().neq('id', '');
    if (error) console.error('Failed to reset daily reports:', error);
  }, []);

  const activeData: DashboardData | null = selectedId
    ? history.find(e => e.id === selectedId)?.data ?? null
    : null;

  return { history, selectedId, setSelectedId, addEntry, deleteEntry, resetAll, activeData, isLoading };
}
