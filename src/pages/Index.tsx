import { useState } from 'react';
import { parseExcelFile, generateDemoData } from '@/lib/parseExcel';
import type { DashboardData } from '@/lib/types';
import { useDashboardHistory } from '@/hooks/useDashboardHistory';
import FileUpload from '@/components/FileUpload';
import UploadHistoryPanel from '@/components/UploadHistoryPanel';
import KPICard from '@/components/KPICard';
import PnLChart from '@/components/PnLChart';
import BetSplitChart from '@/components/BetSplitChart';
import SportsTable from '@/components/SportsTable';
import RejectionsTable from '@/components/RejectionsTable';
import UserSummaryTable from '@/components/UserSummaryTable';
import MarketPatternChart from '@/components/MarketPatternChart';
import { Activity, RefreshCw, CheckCircle2, AlertCircle, X } from 'lucide-react';

const Index = () => {
  const { history, selectedId, setSelectedId, addEntry, deleteEntry, resetAll, activeData } = useDashboardHistory();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // Use history data if available, otherwise demo
  const isUsingHistory = history.length > 0 && activeData !== null;
  const data: DashboardData = isUsingHistory ? activeData : generateDemoData();

  const handleFileLoad = (buffer: ArrayBuffer, fileName: string) => {
    setUploadError(null);
    setUploadSuccess(null);
    try {
      const parsed = parseExcelFile(buffer);
      addEntry(parsed, fileName);
      setUploadSuccess(`"${fileName}" loaded successfully`);
      setTimeout(() => setUploadSuccess(null), 4000);
    } catch (e: any) {
      console.error('Failed to parse Excel:', e);
      setUploadError(`Failed to load "${fileName}": ${e?.message || 'Unknown error. Ensure the file has sheets: Raw Data, Market Pattern, Rejection Detail.'}`);
    }
  };

  const handleResetAll = () => {
    resetAll();
    setUploadError(null);
    setUploadSuccess(null);
  };

  const totalPnL = data.dailyPnL.reduce((s, d) => s + d.pnl, 0);
  const totalTurnover = data.dailyPnL.reduce((s, d) => s + d.turnover, 0);
  const totalBets = data.betSplit.reduce((s, d) => s + d.liveBets + d.prematchBets, 0);
  const avgMargin = totalTurnover > 0 ? (totalPnL / totalTurnover) * 100 : 0;
  const highRiskUsers = data.userSummaries.filter(u => u.concentrationRisk === 'high').length;
  const totalRejections = data.rejectionReasons.reduce((s, r) => s + r.count, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-lg font-bold tracking-tight">Sportsbook Dashboard</h1>
              <p className="text-xs text-muted-foreground">
                {isUsingHistory
                  ? selectedId
                    ? `Viewing: ${history.find(e => e.id === selectedId)?.label}`
                    : `All Days (${history.length} uploads merged)`
                  : 'Demo Data'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {isUsingHistory && (
              <button
                onClick={handleResetAll}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reset All
              </button>
            )}
            <div className="w-64">
              <FileUpload onFileLoad={handleFileLoad} />
            </div>
          </div>
        </div>
      </header>

      {/* Success banner */}
      {uploadSuccess && (
        <div className="max-w-[1600px] mx-auto px-6 pt-4">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {uploadSuccess}
          </div>
        </div>
      )}

      {/* Error banner */}
      {uploadError && (
        <div className="max-w-[1600px] mx-auto px-6 pt-4">
          <div className="flex items-center justify-between gap-2 px-4 py-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {uploadError}
            </div>
            <button onClick={() => setUploadError(null)} className="hover:opacity-70">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <main className="max-w-[1600px] mx-auto p-6 space-y-6">
        {/* Upload History Panel */}
        <UploadHistoryPanel
          history={history}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onDelete={deleteEntry}
          onResetAll={handleResetAll}
        />

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KPICard
            title="Total P&L"
            value={`${totalPnL >= 0 ? '+' : ''}$${totalPnL.toLocaleString()}`}
            trend={totalPnL >= 0 ? 'up' : 'down'}
            icon="profit"
            subtitle={selectedId ? 'Single day' : `${history.length || 14}-day period`}
          />
          <KPICard title="Turnover" value={`$${totalTurnover.toLocaleString()}`} icon="bets" />
          <KPICard title="Avg Margin" value={`${avgMargin.toFixed(2)}%`} trend={avgMargin >= 0 ? 'up' : 'down'} icon="margin" />
          <KPICard title="Total Bets" value={totalBets.toLocaleString()} icon="bets" />
          <KPICard title="Rejections" value={totalRejections.toLocaleString()} icon="warning" trend="neutral" />
          <KPICard title="High Risk Users" value={highRiskUsers.toString()} icon="warning" trend={highRiskUsers > 0 ? 'down' : 'neutral'} />
        </div>

        {/* P&L + Bet Split row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <PnLChart data={data.dailyPnL} />
          </div>
          <BetSplitChart data={data.betSplit} />
        </div>

        {/* Sports Breakdown */}
        <SportsTable data={data.sportsBreakdown} />

        {/* Rejections + Users */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RejectionsTable data={data.rejectionReasons} />
          <UserSummaryTable data={data.userSummaries} />
        </div>

        {/* Market Patterns */}
        <MarketPatternChart data={data.marketPatterns} />
      </main>
    </div>
  );
};

export default Index;
