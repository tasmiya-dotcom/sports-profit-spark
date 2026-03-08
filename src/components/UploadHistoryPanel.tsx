import type { HistoryEntry } from '@/hooks/useDashboardHistory';
import { Calendar, Trash2, RotateCcw, Eye } from 'lucide-react';

interface Props {
  history: HistoryEntry[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDelete: (id: string) => void;
  onResetAll: () => void;
}

const fmt = (v: number) => `€${Math.round(v).toLocaleString()}`;

const UploadHistoryPanel = ({ history, selectedId, onSelect, onDelete, onResetAll }: Props) => {
  if (history.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold tracking-tight">Upload History</h2>
          <span className="text-xs text-muted-foreground">({history.length} day{history.length !== 1 ? 's' : ''})</span>
        </div>
        <button
          onClick={onResetAll}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          Reset All
        </button>
      </div>

      {/* All Days row */}
      <button
        onClick={() => onSelect(null)}
        className={`w-full text-left px-3 py-2 rounded-lg mb-1 text-xs transition-colors ${
          selectedId === null
            ? 'bg-primary/10 border border-primary/20 text-primary'
            : 'hover:bg-muted/50 text-muted-foreground'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="font-medium">All Days Overview</span>
          {selectedId === null && <Eye className="w-3 h-3" />}
        </div>
      </button>

      {/* Per-day rows */}
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {history.map(entry => {
          const kpi = entry.data?.kpiSummary;
          if (!kpi) return null;
          const isActive = selectedId === entry.id;

          return (
            <div
              key={entry.id}
              onClick={() => onSelect(entry.id)}
              className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-xs transition-colors ${
                isActive
                  ? 'bg-primary/10 border border-primary/20'
                  : 'hover:bg-muted/50'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${isActive ? 'text-primary' : 'text-foreground'}`}>
                    {entry.label}
                  </span>
                  {isActive && <Eye className="w-3 h-3 text-primary" />}
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-muted-foreground">
                  <span className={kpi.pnl >= 0 ? 'text-primary' : 'text-destructive'}>
                    P&L: {kpi.pnl >= 0 ? '+' : ''}{fmt(kpi.pnl)}
                  </span>
                  <span>TO: {fmt(kpi.turnover)}</span>
                  <span>Bets: {kpi.bets.toLocaleString()}</span>
                  <span>Margin: {kpi.margin.toFixed(2)}%</span>
                </div>
                <div className="text-muted-foreground/60 truncate mt-0.5">{entry.fileName}</div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(entry.id); }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive text-muted-foreground transition-all"
                title="Delete this day"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default UploadHistoryPanel;
