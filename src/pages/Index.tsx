import { useState, useCallback } from 'react';
import { parseExcelFile } from '@/lib/parseExcel';
import { useDashboardHistory } from '@/hooks/useDashboardHistory';
import { useCurrency } from '@/contexts/CurrencyContext';
import FileUpload from '@/components/FileUpload';
import KPICard from '@/components/KPICard';
import KPIDetailModal from '@/components/KPIDetailModal';
import PnLChart from '@/components/PnLChart';
import BetSplitChart from '@/components/BetSplitChart';
import SportsTable from '@/components/SportsTable';
import RejectionsTable from '@/components/RejectionsTable';
import UserSummaryTable from '@/components/UserSummaryTable';
import MarketPatternChart from '@/components/MarketPatternChart';
import TopPlayerSpotlight from '@/components/TopPlayerSpotlight';
import UploadHistoryPanel from '@/components/UploadHistoryPanel';
import SevenDaySummary from '@/components/SevenDaySummary';
import ExecutiveOverview from '@/components/ExecutiveOverview';
import PerformanceTrends from '@/components/PerformanceTrends';
import AudienceInsights from '@/components/AudienceInsights';
import ShareToSlack from '@/components/ShareToSlack';
import CurrencyToggle from '@/components/CurrencyToggle';
import IplMatchTracker from '@/components/IplMatchTracker';
import PostMatchReports from '@/components/PostMatchReports';

import type { KPISummary, DashboardData } from '@/lib/types';

type KPIType = 'pnl' | 'turnover' | 'margin' | 'bets' | 'rejections' | 'highRisk';

const Index = () => {
  const { history, selectedId, setSelectedId, addEntry, deleteEntry, resetAll, activeData, isLoading } = useDashboardHistory();
  const { fmt, fmtSigned } = useCurrency();

  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [kpiModal, setKpiModal] = useState<KPIType | null>(null);

  const handleFileLoad = useCallback((buffer: ArrayBuffer, fileName: string) => {
    try {
      const parsed = parseExcelFile(buffer);
      addEntry(parsed, fileName);
      setSelectedId(parsed.reportDate);
      setUploadSuccess(`"${fileName}" loaded — ${parsed.reportLabel}`);
      setTimeout(() => setUploadSuccess(null), 5000);
    } catch (e) {
      console.error('Failed to parse Excel:', e);
    }
  }, [addEntry, setSelectedId]);

  const data = activeData;
  const kpi: KPISummary | null = data?.kpiSummary ?? null;

  const rejectionRate = kpi
    ? (kpi.bets + kpi.rejections > 0
        ? (kpi.rejections / (kpi.bets + kpi.rejections)) * 100
        : 0)
    : 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold tracking-tight">ARENA365</h1>
          {data && <span className="text-sm text-muted-foreground">{data.reportLabel}</span>}
        </div>
        <div className="flex items-center gap-3">
          <CurrencyToggle />
          {data && <ShareToSlack data={data} />}
          <button onClick={resetAll} className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded border border-border">
            Reset All
          </button>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">
        {/* Upload */}
        <FileUpload onFileLoad={handleFileLoad} />

        {uploadSuccess && (
          <div className="px-4 py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary text-sm">
            ✅ {uploadSuccess}
          </div>
        )}

        {/* Upload History */}
        <UploadHistoryPanel
          history={history}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onDelete={deleteEntry}
          onResetAll={resetAll}
        />

        {/* Executive Overview */}
        {history.length > 0 && <ExecutiveOverview history={history} />}

        {/* Seven Day Summary */}
        {history.length >= 2 && <SevenDaySummary history={history} />}

        {data && kpi && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <KPICard title="Turnover" value={fmt(kpi.turnover)} icon="profit" onClick={() => setKpiModal('turnover')} />
              <KPICard title="P&L" value={fmtSigned(kpi.pnl)} trend={kpi.pnl >= 0 ? 'up' : 'down'} icon="profit" onClick={() => setKpiModal('pnl')} />
              <KPICard title="Margin" value={`${kpi.margin.toFixed(2)}%`} trend={kpi.margin >= 0 ? 'up' : 'down'} icon="margin" onClick={() => setKpiModal('margin')} />
              <KPICard title="Bets" value={kpi.bets.toLocaleString()} icon="bets" onClick={() => setKpiModal('bets')} />
              <KPICard title="Rejection Rate" value={`${rejectionRate.toFixed(1)}%`} subtitle={`${kpi.rejections} rejected`} icon="warning" onClick={() => setKpiModal('rejections')} />
              <KPICard title="High Risk" value={kpi.highRiskUsers.toString()} icon="warning" onClick={() => setKpiModal('highRisk')} />
            </div>

            {/* KPI Detail Modal */}
            {kpiModal && <KPIDetailModal type={kpiModal} data={data} onClose={() => setKpiModal(null)} />}

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PnLChart history={history} selectedId={selectedId} onSelectDay={setSelectedId} />
              <BetSplitChart data={data.betSplit} />
            </div>

            {/* Tables */}
            <SportsTable data={data.sportsBreakdown} />
            <RejectionsTable data={data.rejectionReasons} />
            <UserSummaryTable data={data.userSummaries} />
            <MarketPatternChart data={data.marketPatterns} />

            {/* Top Player */}
            {data.topPlayer && <TopPlayerSpotlight player={data.topPlayer} />}

            {/* Performance Trends */}
            {history.length >= 2 && <PerformanceTrends history={history} />}

            {/* Audience Insights */}
            <AudienceInsights history={history} />
          </>
        )}

        {/* IPL Match Tracker */}
        <IplMatchTracker />

        {/* Post Match Reports */}
        <PostMatchReports />

        {isLoading && !data && (
          <div className="text-center py-12 text-muted-foreground">Loading dashboard data...</div>
        )}
      </div>
    </div>
  );
};

export default Index;
