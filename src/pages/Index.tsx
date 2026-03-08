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
import TopPlayerSpotlightPanel from '@/components/TopPlayerSpotlight';
import { Activity, RefreshCw, CheckCircle2, AlertCircle, X, Loader2 } from 'lucide-react';

const fmt = (v: number) => `€${Math.round(Math.abs(v)).toLocaleString()}`;
const fmtSigned = (v: number) => `${v >= 0 ? '+' : '-'}€${Math.round(Math.abs(v)).toLocaleString()}`;

const Index = () => {
  const { history, selectedId, setSelectedId, addEntry, deleteEntry, resetAll, activeData } = useDashboardHistory();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const hasHistory = history.length > 0;
  const demo = generateDemoData();

  // When a specific day is selected show it; when "All Days" show first day; otherwise demo
  const data: DashboardData = activeData
    ? activeData
    : hasHistory
      ? history[0].data
      : demo;

  // Safety: if data somehow lacks kpiSummary, fall back to demo
  const kpiSafe = data?.kpiSummary ?? demo.kpiSummary;

  const handleFileLoad = (buffer: ArrayBuffer, fileName: string) => {
    setUploadError(null);
    setUploadSuccess(null);
    setIsLoading(true);

    // Use setTimeout to let the loading spinner render
    setTimeout(() => {
      try {
        const parsed = parseExcelFile(buffer);
        addEntry(parsed, fileName);
        setUploadSuccess(`"${fileName}" loaded — ${parsed.reportLabel}`);
        setTimeout(() => setUploadSuccess(null), 4000);
      } catch (e: any) {
        console.error('Failed to parse Excel:', e);
        setUploadError(`Failed to load "${fileName}": ${e?.message || 'Unknown error. Ensure the file has sheets: Report, Raw Data, Market Pattern, Rejection Detail.'}`);
      } finally {
        setIsLoading(false);
      }
    }, 50);
  };

  const handleResetAll = () => {
    resetAll();
    setUploadError(null);
    setUploadSuccess(null);
  };

  const kpi = kpiSafe;

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
                {activeData
                  ? `Viewing: ${activeData.reportLabel}`
                  : hasHistory
                    ? selectedId === null ? 'All Days Overview' : 'Select a day'
                    : 'Demo Data'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {hasHistory && (
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

      {/* Loading overlay */}
      {isLoading && (
        <div className="max-w-[1600px] mx-auto px-6 pt-4">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            Parsing Excel file…
          </div>
        </div>
      )}

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
            value={fmtSigned(kpi.pnl)}
            trend={kpi.pnl >= 0 ? 'up' : 'down'}
            icon="profit"
            subtitle={activeData ? activeData.reportLabel : hasHistory ? `${history.length} days` : 'Demo'}
          />
          <KPICard title="Turnover" value={fmt(kpi.turnover)} icon="bets" />
          <KPICard title="Avg Margin" value={`${kpi.margin.toFixed(2)}%`} trend={kpi.margin >= 0 ? 'up' : 'down'} icon="margin" />
          <KPICard title="Total Bets" value={kpi.bets.toLocaleString()} icon="bets" />
          <KPICard title="Rejections" value={kpi.rejections.toLocaleString()} icon="warning" trend="neutral" />
          <KPICard title="High Risk Users" value={kpi.highRiskUsers.toString()} icon="warning" trend={kpi.highRiskUsers > 0 ? 'down' : 'neutral'} />
        </div>

        {/* Risk Alerts */}
        <RiskAlertsPanel alerts={data.riskAlerts} />

        {/* P&L + Bet Split row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {hasHistory ? (
              <PnLChart history={history} selectedId={selectedId} onSelectDay={setSelectedId} />
            ) : (
              <div className="kpi-card">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Daily P&L</h3>
                <p className="text-xs text-muted-foreground text-center py-16">Upload Excel files to see daily P&L bars</p>
              </div>
            )}
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
