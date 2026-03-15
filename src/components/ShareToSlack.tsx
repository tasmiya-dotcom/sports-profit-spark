import { useState } from 'react';
import { Hash, Check, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { DashboardData } from '@/lib/types';

interface Props {
  data: DashboardData;
}

const DASHBOARD_URL = 'https://sports-profit-spark.lovable.app';

const SPORT_COLORS: Record<string, string> = {
  Cricket: '#00e554',
  Football: '#3b82f6',
  Tennis: '#f59e0b',
  Basketball: '#ef4444',
  'Ice Hockey': '#8b5cf6',
  Soccer: '#f97316',
  Volleyball: '#ec4899',
};

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

async function generateImageCard(d: DashboardData): Promise<void> {
  const html2canvas = (await import('html2canvas')).default;
  const kpi = d.kpiSummary;
  const fmt = (v: number) => `€${Math.round(Math.abs(v)).toLocaleString()}`;
  const fmtSigned = (v: number) => `${v >= 0 ? '+' : '-'}€${Math.round(Math.abs(v)).toLocaleString()}`;
  const rejRate = kpi.bets > 0 ? ((kpi.rejections / (kpi.bets + kpi.rejections)) * 100).toFixed(1) : '0.0';

  const sports = [...d.sportsBreakdown].filter(s => s.turnover > 0).sort((a, b) => b.turnover - a.turnover).slice(0, 6);
  const maxTo = Math.max(...sports.map(s => s.turnover), 1);
  const topSport = sports.length > 0 ? sports[0].sport : '—';

  // Build off-screen container
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;';
  document.body.appendChild(container);

  const card = document.createElement('div');
  card.style.cssText = `width:720px;padding:36px;background:#0a0a0a;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;border-radius:16px;border:1px solid #1a1a1a;`;

  // Header
  card.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:28px;">
      <div style="font-size:22px;font-weight:800;letter-spacing:1px;">
        <span style="color:#fff;">ARENA</span><span style="color:#7ed321;">365</span>
      </div>
      <div style="font-size:13px;color:#888;">${d.reportLabel} · 00:00–23:59</div>
    </div>

    <!-- KPI Grid -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px;">
      <div style="background:#111;border-radius:10px;padding:16px;border-left:3px solid ${kpi.pnl >= 0 ? '#00e554' : '#ff4444'};">
        <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">P&L</div>
        <div style="font-size:26px;font-weight:700;color:${kpi.pnl >= 0 ? '#00e554' : '#ff4444'};">${fmtSigned(kpi.pnl)}</div>
      </div>
      <div style="background:#111;border-radius:10px;padding:16px;">
        <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Turnover</div>
        <div style="font-size:26px;font-weight:700;">${fmt(kpi.turnover)}</div>
      </div>
      <div style="background:#111;border-radius:10px;padding:16px;border-left:3px solid ${kpi.margin >= 0 ? '#00e554' : '#ff4444'};">
        <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Margin</div>
        <div style="font-size:26px;font-weight:700;color:${kpi.margin >= 0 ? '#00e554' : '#ff4444'};">${kpi.margin.toFixed(2)}%</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px;">
      <div style="background:#111;border-radius:8px;padding:12px;text-align:center;">
        <div style="font-size:10px;color:#888;text-transform:uppercase;margin-bottom:2px;">Total Bets</div>
        <div style="font-size:18px;font-weight:600;">${kpi.bets.toLocaleString()}</div>
      </div>
      <div style="background:#111;border-radius:8px;padding:12px;text-align:center;">
        <div style="font-size:10px;color:#888;text-transform:uppercase;margin-bottom:2px;">Rejection Rate</div>
        <div style="font-size:18px;font-weight:600;color:#f59e0b;">${rejRate}%</div>
      </div>
      <div style="background:#111;border-radius:8px;padding:12px;text-align:center;">
        <div style="font-size:10px;color:#888;text-transform:uppercase;margin-bottom:2px;">Top Sport</div>
        <div style="font-size:18px;font-weight:600;color:#00e554;">${topSport}</div>
      </div>
      <div style="background:#111;border-radius:8px;padding:12px;text-align:center;">
        <div style="font-size:10px;color:#888;text-transform:uppercase;margin-bottom:2px;">High Risk</div>
        <div style="font-size:18px;font-weight:600;color:${kpi.highRiskUsers > 0 ? '#ff4444' : '#00e554'};">${kpi.highRiskUsers}</div>
      </div>
    </div>

    <!-- Sports Chart -->
    ${sports.length > 0 ? `
    <div style="margin-bottom:28px;">
      <div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">Sports by Turnover</div>
      ${sports.map(s => {
        const pct = (s.turnover / maxTo) * 100;
        const color = SPORT_COLORS[s.sport] || '#06b6d4';
        return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
          <div style="width:80px;font-size:12px;color:#ccc;text-align:right;flex-shrink:0;">${s.sport}</div>
          <div style="flex:1;height:20px;background:#1a1a1a;border-radius:4px;overflow:hidden;">
            <div style="width:${pct}%;height:100%;background:${color};border-radius:4px;"></div>
          </div>
          <div style="width:70px;font-size:11px;color:#888;flex-shrink:0;">${fmt(s.turnover)}</div>
        </div>`;
      }).join('')}
    </div>` : ''}

    <!-- Footer CTA -->
    <div style="background:linear-gradient(135deg,#00e554,#00c248);border-radius:10px;padding:14px 20px;text-align:center;margin-top:8px;">
      <div style="font-size:14px;font-weight:700;color:#0a0a0a;">📊 View Full Dashboard →</div>
      <div style="font-size:10px;color:rgba(0,0,0,0.5);margin-top:2px;">${DASHBOARD_URL}</div>
    </div>
  `;

  container.appendChild(card);

  const canvas = await html2canvas(card, {
    backgroundColor: '#0a0a0a',
    scale: 2,
    useCORS: true,
    logging: false,
  });

  document.body.removeChild(container);

  // Download
  const link = document.createElement('a');
  link.download = `Arena365_${d.reportDate.replace(/-/g, '')}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

const ShareToSlack = ({ data }: Props) => {
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const handleShare = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const text = buildSlackMessage(data);
      await Promise.all([
        generateImageCard(data),
        navigator.clipboard.writeText(text),
      ]);
      toast({ title: 'Image saved + text copied — paste into Slack with the image attached', duration: 4000 });
    } catch (err) {
      console.error('Share to Slack failed:', err);
      toast({ title: 'Failed to generate share content', variant: 'destructive', duration: 3000 });
    } finally {
      setTimeout(() => setBusy(false), 1500);
    }
  };

  return (
    <button
      onClick={handleShare}
      disabled={busy}
      className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-md border transition-all hover:scale-105 hover:brightness-125 disabled:opacity-50 cursor-pointer"
      style={{
        borderColor: '#e01e5a',
        color: '#e01e5a',
        background: 'transparent',
      }}
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Hash className="w-3.5 h-3.5" />}
      {busy ? 'Generating…' : 'Share to Slack'}
    </button>
  );
};

export default ShareToSlack;
