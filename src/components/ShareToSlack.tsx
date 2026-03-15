import { useState } from 'react';
import { Hash, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { DashboardData } from '@/lib/types';

interface Props {
  data: DashboardData;
}

const DASHBOARD_URL = 'https://sports-profit-spark.lovable.app';

function buildSlackMessage(d: DashboardData): string {
  const kpi = d.kpiSummary;
  const date = d.reportLabel;
  const fmt = (v: number) => `€${Math.round(Math.abs(v)).toLocaleString()}`;
  const fmtSigned = (v: number) => `${v >= 0 ? '' : '-'}€${Math.round(Math.abs(v)).toLocaleString()}`;

  const totalLiveTo = d.betSplit.reduce((s, b) => s + b.liveTurnover, 0);
  const totalPreTo = d.betSplit.reduce((s, b) => s + b.prematchTurnover, 0);
  const avgStake = kpi.bets > 0 ? kpi.turnover / kpi.bets : 0;
  const rejBets = d.rejectionReasons.reduce((s, r) => s + r.count, 0);
  const rejTurnover = d.rejectionReasons.reduce((s, r) => s + r.blockedTurnover, 0);

  const sports = [...d.sportsBreakdown].filter(s => s.bets > 0 || s.turnover > 0).sort((a, b) => b.turnover - a.turnover);
  const users = [...d.userSummaries].sort((a, b) => b.turnover - a.turnover);
  const marketLines = d.marketPatterns.filter(m => m.count > 0).sort((a, b) => b.count - a.count).slice(0, 10);

  const lines: string[] = [];
  lines.push(`📊 *Sportsbook Performance Report: ${date} (00:00 - 23:59)*`);
  lines.push(`_(Excluding Test Users)_`);
  lines.push('');
  lines.push('*Accepted*');
  lines.push(`• Accepted Bets: ${kpi.bets.toLocaleString()} | Accepted Turnover: ${fmt(kpi.turnover)}`);
  lines.push(`• Live: ${fmt(totalLiveTo)} | Pre-Match: ${fmt(totalPreTo)} | Avg Stake: ${fmt(avgStake)}`);
  lines.push('');
  lines.push('*Performance*');
  lines.push(`• P&L: ${fmtSigned(kpi.pnl)} | Margin: ${kpi.margin.toFixed(2)}%`);
  lines.push('');

  if (sports.length > 0) {
    lines.push('*Sports (Bets | Turnover | P&L | Avg Stake)*');
    for (const s of sports) {
      const sAvg = s.bets > 0 ? s.turnover / s.bets : 0;
      lines.push(`• ${s.sport}: ${s.bets.toLocaleString()} | ${fmt(s.turnover)} | ${fmtSigned(s.pnl)} | ${fmt(sAvg)}`);
    }
    lines.push('');
  }

  lines.push('*Risk & Controls*');
  lines.push(`Rejected Bets: ${rejBets.toLocaleString()} | Rejected Turnover: ${fmt(rejTurnover)}`);
  lines.push('');

  if (d.rejectionReasons.length > 0) {
    lines.push('*Rejection Reasons*');
    for (const r of d.rejectionReasons.filter(r => r.count > 0)) {
      lines.push(`• ${r.reason}: ${r.count.toLocaleString()} bets`);
    }
    lines.push('');
  }

  if (users.length > 0) {
    lines.push('*Real User Activity*');
    for (const u of users) {
      const nick = u.username && u.username !== u.userId ? ` (${u.username})` : '';
      lines.push(`• ${u.userId}${nick}, bets: ${u.bets.toLocaleString()}, turnover: ${fmt(u.turnover)}`);
    }
    lines.push('');
  }

  if (marketLines.length > 0) {
    lines.push('*Market Pattern*');
    for (const m of marketLines) {
      lines.push(`• ${m.market}: ${m.count.toLocaleString()} bets`);
    }
    lines.push('');
  }

  lines.push(`📊 View full dashboard: ${DASHBOARD_URL}`);

  return lines.join('\n');
}

const ShareToSlack = ({ data }: Props) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildSlackMessage(data));
      setCopied(true);
      toast({ title: 'Copied to clipboard — paste into Slack', duration: 3000 });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast({ title: 'Failed to copy', variant: 'destructive', duration: 3000 });
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-md border transition-all hover:scale-105 hover:brightness-125 cursor-pointer"
      style={{
        borderColor: copied ? '#00e554' : '#e01e5a',
        color: copied ? '#00e554' : '#e01e5a',
        background: 'transparent',
      }}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Hash className="w-3.5 h-3.5" />}
      {copied ? 'Copied!' : 'Share to Slack'}
    </button>
  );
};

export default ShareToSlack;
