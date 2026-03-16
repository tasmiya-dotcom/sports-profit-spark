import { useState } from 'react';
import { Hash, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { DashboardData } from '@/lib/types';

interface Props {
  data: DashboardData;
}

const DASHBOARD_URL = 'https://sports-profit-spark.lovable.app';

const EXCLUDED_NICKNAMES = new Set([
  'tasmiya', 'hayk', 'khushi', 'arsen', 'misho', 'test_ind', 'test', 'zhen', 'palig', 'misak', 'talin',
]);

const EXCLUDED_SOURCE_IDS = new Set([
  '699813cd7749714e8452a7ae', '6991910c884d39a90db0230c', '68edfe6eb9c15cc4a434b6bf',
  '69b54321bfd22b8a60441324', '69b568615896a627d0d644fd', '68dd2f1a0248bf6fbf55b76f',
  '698daf9e7f9e02f9cd1b01a9', '68dcfd350248bf6fbf55b5d8', '68e7a5e3b9c15cc4a43347e2',
  '698e0a11804ffd2d5e39fd0a', '691ef4d9ccdc738cf6f16913', '694bb5f359357c0c7a67ba20',
  '6936da2c643a78fbc17128ce', '691844e6d60b248ae163e729', '690a0dbbfb5142c26cb91268',
  '68de64710248bf6fbf55c311', '690b4fd6fb5142c26cb9426b', '6911b743eb274fdacf09b9e1',
  '697caf962976abb87549f74d', '69737f5416708fae8997d640', '6970a41a97b572a4505cfd10',
  '68e7aacbb9c15cc4a4334bcb', '68e7b936b9c15cc4a4334f23', '68df773b0248bf6fbf55ce12',
]);

const SPORT_ABBREVS: Record<string, string> = {
  cric: 'Cricket', cricket: 'Cricket',
  foot: 'Football', football: 'Football', soccer: 'Soccer',
  bask: 'Basketball', basketball: 'Basketball',
  tenn: 'Tennis', tennis: 'Tennis',
  base: 'Baseball', baseball: 'Baseball',
  hock: 'Hockey', hockey: 'Hockey',
  tabl: 'Table Tennis', tt: 'Table Tennis',
  vol: 'Volleyball', volleyball: 'Volleyball',
  hand: 'Handball', handball: 'Handball',
  espo: 'Esports', esports: 'Esports',
  kab: 'Kabaddi', kabaddi: 'Kabaddi',
  rugby: 'Rugby', rug: 'Rugby',
  mma: 'MMA', box: 'Boxing',
  ice: 'Ice Hockey',
};

function expandSportAbbrev(abbrev: string): string {
  const lower = abbrev.toLowerCase().trim();
  return SPORT_ABBREVS[lower] || abbrev;
}

function formatMarketEntry(market: string, count: number): string {
  // Market field may be "Sport:MarketGroup" e.g. "Cric:Other"
  const colonIdx = market.indexOf(':');
  if (colonIdx > 0) {
    const sport = expandSportAbbrev(market.slice(0, colonIdx));
    const group = market.slice(colonIdx + 1).trim();
    return `${sport}: ${count.toLocaleString()} bets on ${group}`;
  }
  return `${market}: ${count.toLocaleString()} bets`;
}

function isTestUser(userId: string, username: string): boolean {
  if (EXCLUDED_SOURCE_IDS.has(userId)) return true;
  if (EXCLUDED_SOURCE_IDS.has(username)) return true;
  if (EXCLUDED_NICKNAMES.has(username.toLowerCase())) return true;
  if (EXCLUDED_NICKNAMES.has(userId.toLowerCase())) return true;
  return false;
}

function isFooterRow(userId: string, username: string): boolean {
  const combined = `${userId} ${username}`.toLowerCase();
  return combined.includes('generated:') || combined.includes('generated ') || /^\d{4}-\d{2}-\d{2}/.test(userId);
}

function isValidRejectionReason(reason: string): boolean {
  const lower = reason.toLowerCase().trim();
  // Reject section headers, column labels, usernames, and junk
  const junkPatterns = /^(rejection reason|reason|sport|nickname|user|source|bets|turnover|stake|p&l|pnl|total|count|generated|rejected bets|summary|overview|risk)/i;
  if (junkPatterns.test(lower)) return false;
  if (reason.toUpperCase() === reason && reason.length > 15) return false;
  if (!reason.includes(' ') && reason.length < 15 && !/limit|exceed|restrict|block|suspend|error|fail|invalid|duplicate|cancel|ccf|odds|price|delay/i.test(reason)) return false;
  // Exclude internal test rejections
  if (/test|arsen|internal|dummy/i.test(lower)) return false;
  return true;
}

function buildSlackMessage(d: DashboardData): string {
  const kpi = d.kpiSummary;
  const date = d.reportLabel;
  const fmt = (v: number) => `€${Math.round(Math.abs(v)).toLocaleString()}`;
  const fmtSigned = (v: number) => `${v >= 0 ? '' : '-'}€${Math.round(Math.abs(v)).toLocaleString()}`;

  const totalLiveTo = d.betSplit.reduce((s, b) => s + b.liveTurnover, 0);
  const totalPreTo = d.betSplit.reduce((s, b) => s + b.prematchTurnover, 0);
  const avgStake = kpi.bets > 0 ? kpi.turnover / kpi.bets : 0;
  const validRejections = d.rejectionReasons.filter(r => r.count > 0 && isValidRejectionReason(r.reason));
  const rejBets = kpi.rejections || validRejections.reduce((s, r) => s + r.count, 0);
  const rejTurnover = kpi.rejectedTurnover || validRejections.reduce((s, r) => s + r.blockedTurnover, 0);
  const rejPotentialPnl = kpi.potentialPnl;

  const sports = [...d.sportsBreakdown].filter(s => s.bets > 0 || s.turnover > 0).sort((a, b) => b.turnover - a.turnover);
  const users = [...d.userSummaries]
    .filter(u => !isTestUser(u.userId, u.username) && !isFooterRow(u.userId, u.username))
    .sort((a, b) => b.turnover - a.turnover);
  
  const marketLines = d.rawMarkets.filter(m => m.count > 0).sort((a, b) => b.count - a.count).slice(0, 5);

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
  lines.push(`Rejected Bets: ${rejBets.toLocaleString()} | Rejected Turnover: ${fmt(rejTurnover)} | Potential P&L: ${fmtSigned(rejPotentialPnl)}`);
  lines.push('');

  if (validRejections.length > 0) {
    lines.push('*Rejection Reasons*');
    for (const r of validRejections) {
      lines.push(`• ${r.reason}: ${r.count.toLocaleString()} bets`);
    }
    lines.push('');
  }

  if (users.length > 0) {
    lines.push('*Real User Activity*');
    for (const u of users) {
      const hasNick = u.username && u.username !== u.userId && u.username !== '—' && u.username !== '-' && u.username.trim() !== '';
      const userLabel = hasNick ? `${u.username} (${u.userId.slice(0, 8)}...)` : u.userId;
      lines.push(`• ${userLabel}, bets: ${u.bets.toLocaleString()}, turnover: ${fmt(u.turnover)}`);
    }
    lines.push('');
  }

  if (marketLines.length > 0) {
    lines.push(`*Market Pattern (Top ${marketLines.length})*`);
    for (const m of marketLines) {
      lines.push(`• ${m.market}: ${m.count.toLocaleString()} ${m.count === 1 ? 'bet' : 'bets'}`);
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
