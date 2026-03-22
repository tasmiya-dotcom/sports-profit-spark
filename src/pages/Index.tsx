import { useState, useCallback, useEffect, useMemo } from 'react';
import type { DashboardData } from '@/lib/types';
import { supabase } from '@/lib/supabase';

export interface HistoryEntry {
  id: string;
  label: string;
  fileName: string;
  uploadedAt: string;
  data: DashboardData;
}

export function useDashboardHistory() {
  const [uploadedHistory, setUploadedHistory] = useState<HistoryEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Track whether initial load is done so we don't override selectedId after upload
  const [initialLoadDone, setInitialLoadDone] = useState(false);

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
          // Only auto-select on very first load when nothing is selected
          // Do NOT override selectedId if user has already selected something
          setInitialLoadDone(true);
        }
      } catch (e) {
        console.error('Failed to fetch daily_reports:', e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const history = useMemo(() => {
    return [...uploadedHistory].sort((a, b) => a.id.localeCompare(b.id));
  }, [uploadedHistory]);

  const addEntry = useCallback(async (data: DashboardData, fileName: string) => {
    const id = data.reportDate;
    const label = data.reportLabel;

    const entry: HistoryEntry = {
      id,
      label,
      fileName,
      uploadedAt: new Date().toISOString(),
      data,
    };

    // Update local state immediately — don't wait for Supabase
    setUploadedHistory(prev => {
      const filtered = prev.filter(e => e.id !== id);
      return [...filtered, entry].sort((a, b) => a.id.localeCompare(b.id));
    });

    // Save to Supabase in background
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
