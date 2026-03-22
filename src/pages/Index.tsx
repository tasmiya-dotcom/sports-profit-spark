import { useState, useRef, useCallback } from 'react';

import { parseExcelFile } from '@/lib/parseExcel';
import type { DashboardData } from '@/lib/types';
import { useDashboardHistory } from '@/hooks/useDashboardHistory';
import { useCurrency } from '@/contexts/CurrencyContext';
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
import PostMatchReports from '@/components/PostMatchReports';
import IplMatchTracker from '@/components/IplMatchTracker';

import AudienceInsights from '@/components/AudienceInsights';
import PerformanceTrends from '@/components/PerformanceTrends';
import ExecutiveOverview from '@/components/ExecutiveOverview';
import KPIDetailModal from '@/components/KPIDetailModal';
import SevenDaySummary from '@/components/SevenDaySummary';
import CurrencyToggle from '@/components/CurrencyToggle';
import ShareToSlack from '@/components/ShareToSlack';
import { Activity, RefreshCw, CheckCircle2, AlertCircle, X, Loader2, Download } from 'lucide-react';

const Index = () => {
  const { history, selectedId, setSelectedId, addEntry, deleteEntry, resetAll, activeData } = useDashboardHistory();
  const { fmt, fmtSigned } = useCurrency();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [kpiModal, setKpiModal] = useState<'pnl' | 'turnover' | 'margin' | 'bets' | 'rejections' | 'highRisk' | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const dashboardRef = useRef<HTMLElement>(null);

  const data: DashboardData | null = activeData ?? (history.length > 0 ? history[history.length - 1].data : null);

  // For Slack share: use selected day, or most recently uploaded day
  const slackData: DashboardData | null = activeData ?? (history.length > 0 ? history[history.length - 1].data : null);

  const kpi = data?.kpiSummary ?? null;

  const handleDownloadPDF = useCallback(async () => {
    if (!dashboardRef.current || isExporting) return;
    setIsExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const element = dashboardRef.current;
      const canvas = await html2canvas(element, {
        backgroundColor: '#0a0a0a',
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: 1600,
      });

      const imgWidth = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      const pageHeight = 210;
      let position = 0;
      let remainingHeight = imgHeight;
      let page = 0;

      while (remainingHeight > 0) {
        if (page > 0) pdf.addPage();

        const sourceY = (position / imgHeight) * canvas.height;
        const sourceH = Math.min((pageHeight / imgHeight) * canvas.height, canvas.height - sourceY);

        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = sourceH;
        const ctx = pageCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#0a0a0a';
          ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          ctx.drawImage(canvas, 0, sourceY, canvas.width, sourceH, 0, 0, canvas.width, sourceH);
        }

        const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.92);
        const sliceHeight = (sourceH / canvas.width) * imgWidth;
        pdf.addImage(pageImgData, 'JPEG', 0, 0, imgWidth, sliceHeight);

        position += pageHeight;
        remainingHeight -= pageHeight;
        page++;
      }

      const dateLabel = activeData
        ? activeData.reportDate.replace(/-/g, '')
        : 'AllDays';
      pdf.save(`Arena365_Dashboard_${dateLabel}.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setIsExporting(false);
    }
  }, [activeData, isExporting]);

  const handleFileLoad = useCallback((buffer: ArrayBuffer, fileName: string) => {
    setUploadError(null);
    setUploadSuccess(null);
    setIsLoading(true);

    setTimeout(async () => {
      try {
        const parsed = parseExcelFile(buffer);
        await addEntry(parsed, fileName);
        // Always select the newly uploaded day so dashboard updates immediately
        setSelectedId(parsed.reportDate);
        setUploadSuccess(`"${fileName}" loaded — ${parsed.reportLabel}`);
        setTimeout(() => setUploadSuccess(null), 4000);
      } catch (e: any) {
        console.error('Failed to parse Excel:', e);
        setUploadError(`Failed to load "${fileName}": ${e?.message || 'Unknown error. Ensure the file has sheets: Report, Raw Data, Market Pattern, Rejection Detail.'}`);
      } finally {
        setIsLoading(false);
      }
    }, 50);
  }, [addEntry, setSelectedId]);

  const handleResetAll = useCallback(() => {
    resetAll();
    setUploadError(null);
    setUploadSuccess(null);
  }, [resetAll]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-lg font-bold tracking-tight uppercase">
                <span className="text-foreground">ARENA</span>
                <span style={{ color: '#7ed321' }}>365</span>
              </h1>
              <p className="text-xs text-muted-foreground">
                {activeData
                  ? `Viewing: ${activeData.reportLabel}`
                  : selectedId === null
                  ? `${history.length} days loaded`
                  : 'Select a day'}
              </p>
              <p className="text-[10px] text-muted-foreground/60">
                {(() => {
                  if (history.length === 0) return 'No data uploaded yet';
                  const latest = history.reduce((a, b) => a.uploadedAt > b.uploadedAt ? a : b);
                  const d = new Date(latest.uploadedAt);
                  return `Last updated: ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} at ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
                })()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <CurrencyToggle />
            {slackData && <ShareToSlack data={slackData} />}
            <button
              onClick={handleDownloadPDF}
              disabled={isExporting}
              className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-md border transition-all hover:scale-105 hover:brightness-125 disabled:opacity-50 cursor-pointer"
              style={{ borderColor: '#00e554', color: '#00e554', background: 'transparent' }}
            >
              {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              {isExporting ? 'Generating…' : 'Download Report'}
            </button>
            {history.length > 0 && (
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

      <main ref={dashboardRef} className="max-w-[1600px] mx-auto p-6 space-y-6">
        <ExecutiveOverview history={history} />
        <UploadHistoryPanel
          history={history}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onDelete={deleteEntry}
          onResetAll={handleResetAll}
        />

        {/* KPI Row */}
        {kpi && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <KPICard
              title="Total P&L"
              value={fmtSigned(kpi.pnl)}
              trend={kpi.pnl >= 0 ? 'up' : 'down'}
              icon="profit"
              subtitle={activeData ? activeData.reportLabel : `${history.length} days`}
              onClick={() => setKpiModal('pnl')}
            />
            <KPICard title="Turnover" value={fmt(kpi.turnover)} icon="bets" onClick={() => setKpiModal('turnover')} />
            <KPICard
              title="Avg Margin"
              value={`${isNaN(kpi.margin) ? '0.00' : kpi.margin.toFixed(2)}%`}
              trend={kpi.margin >= 0 ? 'up' : 'down'}
              icon="margin"
              onClick={() => setKpiModal('margin')}
            />
            <KPICard title="Total Bets" value={kpi.bets.toLocaleString()} icon="bets" onClick={() => setKpiModal('bets')} />
            <KPICard title="Rejections" value={kpi.rejections.toLocaleString()} icon="warning" trend="neutral" onClick={() => setKpiModal('rejections')} />
            <KPICard
              title="High Risk Users"
              value={kpi.highRiskUsers.toString()}
              icon="warning"
              trend={kpi.highRiskUsers > 0 ? 'down' : 'neutral'}
              onClick={() => setKpiModal('highRisk')}
            />
          </div>
        )}

        <SevenDaySummary history={history} />
        <PerformanceTrends history={history} />
        {data && <TopPlayerSpotlightPanel player={data.topPlayer} />}
        <AudienceInsights history={history} />
        <PostMatchReports />
        <IplMatchTracker />

        {data && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <PnLChart history={history} selectedId={selectedId} onSelectDay={setSelectedId} />
              </div>
              <BetSplitChart data={data.betSplit} />
            </div>
            <SportsTable data={data.sportsBreakdown} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RejectionsTable data={data.rejectionReasons} />
              <UserSummaryTable data={data.userSummaries} />
            </div>
            <MarketPatternChart data={data.marketPatterns} />
          </>
        )}
      </main>

      {kpiModal && data && <KPIDetailModal type={kpiModal} data={data} onClose={() => setKpiModal(null)} />}
    </div>
  );
};

export default Index;
