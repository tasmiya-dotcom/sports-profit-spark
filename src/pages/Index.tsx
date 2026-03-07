import { useState } from 'react';
import { parseExcelFile, generateDemoData } from '@/lib/parseExcel';
import type { DashboardData } from '@/lib/types';
import FileUpload from '@/components/FileUpload';
import KPICard from '@/components/KPICard';
import PnLChart from '@/components/PnLChart';
import BetSplitChart from '@/components/BetSplitChart';
import SportsTable from '@/components/SportsTable';
import RejectionsTable from '@/components/RejectionsTable';
import UserSummaryTable from '@/components/UserSummaryTable';
import MarketPatternChart from '@/components/MarketPatternChart';
import { Activity, RefreshCw } from 'lucide-react';

const Index = () => {
  const [data, setData] = useState<DashboardData>(generateDemoData);

  const handleFileLoad = (buffer: ArrayBuffer) => {
    try {
      const parsed = parseExcelFile(buffer);
      setData(parsed);
    } catch (e) {
      console.error('Failed to parse Excel:', e);
    }
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
                Last updated: {new Date(data.uploadDate).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setData(generateDemoData())}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Demo Data
            </button>
            <div className="w-64">
              <FileUpload onFileLoad={handleFileLoad} />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-6 space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KPICard
            title="Total P&L"
            value={`${totalPnL >= 0 ? '+' : ''}$${totalPnL.toLocaleString()}`}
            trend={totalPnL >= 0 ? 'up' : 'down'}
            icon="profit"
            subtitle="14-day period"
          />
          <KPICard
            title="Turnover"
            value={`$${totalTurnover.toLocaleString()}`}
            icon="bets"
          />
          <KPICard
            title="Avg Margin"
            value={`${avgMargin.toFixed(2)}%`}
            trend={avgMargin >= 0 ? 'up' : 'down'}
            icon="margin"
          />
          <KPICard
            title="Total Bets"
            value={totalBets.toLocaleString()}
            icon="bets"
          />
          <KPICard
            title="Rejections"
            value={totalRejections.toLocaleString()}
            icon="warning"
            trend="neutral"
          />
          <KPICard
            title="High Risk Users"
            value={highRiskUsers.toString()}
            icon="warning"
            trend={highRiskUsers > 0 ? 'down' : 'neutral'}
          />
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
