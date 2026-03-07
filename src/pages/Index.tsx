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
import { Activity, RefreshCw, FileSpreadsheet, X } from 'lucide-react';

const mergeDashboardData = (existing: DashboardData, incoming: DashboardData): DashboardData => {
  // Merge daily P&L (combine by date, add new dates)
  const pnlMap = new Map(existing.dailyPnL.map(d => [d.date, { ...d }]));
  for (const d of incoming.dailyPnL) {
    const ex = pnlMap.get(d.date);
    if (ex) {
      ex.pnl += d.pnl;
      ex.turnover += d.turnover;
      ex.margin = ex.turnover > 0 ? (ex.pnl / ex.turnover) * 100 : 0;
    } else {
      pnlMap.set(d.date, { ...d });
    }
  }

  // Merge bet splits
  const betSplit = [...existing.betSplit];
  for (const b of incoming.betSplit) {
    const ex = betSplit.find(e => e.date === b.date);
    if (ex) {
      ex.liveBets += b.liveBets;
      ex.prematchBets += b.prematchBets;
      ex.liveTurnover += b.liveTurnover;
      ex.prematchTurnover += b.prematchTurnover;
    } else {
      betSplit.push({ ...b });
    }
  }

  // Merge sports breakdown
  const sportMap = new Map(existing.sportsBreakdown.map(s => [s.sport, { ...s }]));
  for (const s of incoming.sportsBreakdown) {
    const ex = sportMap.get(s.sport);
    if (ex) {
      ex.bets += s.bets;
      ex.turnover += s.turnover;
      ex.pnl += s.pnl;
      ex.margin = ex.turnover > 0 ? (ex.pnl / ex.turnover) * 100 : 0;
    } else {
      sportMap.set(s.sport, { ...s });
    }
  }

  // Merge rejections
  const rejMap = new Map(existing.rejectionReasons.map(r => [r.reason, { ...r }]));
  for (const r of incoming.rejectionReasons) {
    const ex = rejMap.get(r.reason);
    if (ex) {
      ex.count += r.count;
      ex.blockedTurnover += r.blockedTurnover;
    } else {
      rejMap.set(r.reason, { ...r });
    }
  }
  const rejections = Array.from(rejMap.values());
  const totalRejCount = rejections.reduce((s, r) => s + r.count, 0);
  rejections.forEach(r => r.percentage = totalRejCount > 0 ? (r.count / totalRejCount) * 100 : 0);
  rejections.sort((a, b) => b.count - a.count);

  // Merge user summaries
  const userMap = new Map(existing.userSummaries.map(u => [u.username, { ...u }]));
  for (const u of incoming.userSummaries) {
    const ex = userMap.get(u.username);
    if (ex) {
      ex.bets += u.bets;
      ex.turnover += u.turnover;
      ex.pnl += u.pnl;
      ex.margin = ex.turnover > 0 ? (ex.pnl / ex.turnover) * 100 : 0;
    } else {
      userMap.set(u.username, { ...u });
    }
  }
  const users = Array.from(userMap.values());
  const totalTO = users.reduce((s, u) => s + u.turnover, 0);
  users.forEach(u => {
    const pct = totalTO > 0 ? (u.turnover / totalTO) * 100 : 0;
    u.concentrationRisk = pct > 20 ? 'high' : pct > 10 ? 'medium' : 'low';
  });
  users.sort((a, b) => b.turnover - a.turnover);

  // Merge market patterns
  const mktMap = new Map(existing.marketPatterns.map(m => [m.market, { ...m }]));
  for (const m of incoming.marketPatterns) {
    const ex = mktMap.get(m.market);
    if (ex) {
      ex.count += m.count;
      ex.turnover += m.turnover;
      ex.pnl += m.pnl;
    } else {
      mktMap.set(m.market, { ...m });
    }
  }

  return {
    dailyPnL: Array.from(pnlMap.values()),
    betSplit,
    sportsBreakdown: Array.from(sportMap.values()).sort((a, b) => b.turnover - a.turnover),
    rejectionReasons: rejections,
    userSummaries: users,
    marketPatterns: Array.from(mktMap.values()).sort((a, b) => b.turnover - a.turnover),
    uploadDate: incoming.uploadDate,
  };
};

const Index = () => {
  const [data, setData] = useState<DashboardData>(generateDemoData);
  const [isFirstUpload, setIsFirstUpload] = useState(true);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);

  const handleFileLoad = (buffer: ArrayBuffer, fileName: string) => {
    try {
      const parsed = parseExcelFile(buffer);
      if (isFirstUpload) {
        setData(parsed);
        setIsFirstUpload(false);
        setUploadedFiles([fileName]);
      } else {
        setData(prev => mergeDashboardData(prev, parsed));
        setUploadedFiles(prev => [...prev, fileName]);
      }
    } catch (e) {
      console.error('Failed to parse Excel:', e);
    }
  };

  const removeFile = (index: number) => {
    // Can only reset all files (re-parse would need stored buffers)
    setUploadedFiles([]);
    setData(generateDemoData());
    setIsFirstUpload(true);
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
              onClick={() => { setData(generateDemoData()); setIsFirstUpload(true); setUploadedFiles([]); }}
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
