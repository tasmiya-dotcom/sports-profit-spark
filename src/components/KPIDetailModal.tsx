import { X } from 'lucide-react';
import type { DashboardData } from '@/lib/types';

type KPIType = 'pnl' | 'turnover' | 'margin' | 'bets' | 'rejections' | 'highRisk';

interface KPIDetailModalProps {
  type: KPIType;
  data: DashboardData;
  onClose: () => void;
}

const KPIDetailModal = ({ type, data, onClose }: KPIDetailModalProps) => {
  const kpi = data.kpiSummary;

  const renderContent = () => {
    switch (type) {
      case 'pnl':
        return (
          <>
            <h2 className="text-lg font-bold text-white mb-1">Total P&L Breakdown</h2>
            <p className="text-sm text-[#888] mb-4">Total profit or loss across all accepted bets for the selected period.</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#333]">
                  <th className="text-left py-2 text-[#888] font-medium">Sport</th>
                  <th className="text-right py-2 text-[#888] font-medium">Turnover</th>
                  <th className="text-right py-2 text-[#888] font-medium">P&L</th>
                </tr>
              </thead>
              <tbody>
                {data.sportsBreakdown.map(s => (
                  <tr key={s.sport} className="border-b border-[#222]">
                    <td className="py-2 text-white">{s.sport}</td>
                    <td className="py-2 text-right text-[#ccc]">€{s.turnover.toLocaleString()}</td>
                    <td className={`py-2 text-right font-medium ${s.pnl >= 0 ? 'text-[#00e554]' : 'text-[#ff4444]'}`}>
                      {s.pnl >= 0 ? '+' : ''}€{s.pnl.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-[#444]">
                  <td className="py-2 text-white font-bold">Total</td>
                  <td className="py-2 text-right text-white font-bold">€{kpi.turnover.toLocaleString()}</td>
                  <td className={`py-2 text-right font-bold ${kpi.pnl >= 0 ? 'text-[#00e554]' : 'text-[#ff4444]'}`}>
                    {kpi.pnl >= 0 ? '+' : ''}€{kpi.pnl.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </>
        );

      case 'turnover': {
        const split = data.betSplit[0];
        const totalTO = split ? split.liveTurnover + split.prematchTurnover : kpi.turnover;
        const livePct = totalTO > 0 ? ((split?.liveTurnover ?? 0) / totalTO * 100) : 0;
        const prePct = totalTO > 0 ? ((split?.prematchTurnover ?? 0) / totalTO * 100) : 0;
        const avgStake = kpi.bets > 0 ? kpi.turnover / kpi.bets : 0;
        return (
          <>
            <h2 className="text-lg font-bold text-white mb-1">Turnover Breakdown</h2>
            <p className="text-sm text-[#888] mb-4">Total stakes accepted across all bets. Live = in-play bets. Pre-match = bets placed before the event started.</p>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-[#222]">
                <span className="text-white">Live Turnover</span>
                <span className="text-[#00e554] font-mono font-medium">€{(split?.liveTurnover ?? 0).toLocaleString()} <span className="text-[#888] text-xs">({livePct.toFixed(1)}%)</span></span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-[#222]">
                <span className="text-white">Pre-Match Turnover</span>
                <span className="text-[#ccc] font-mono font-medium">€{(split?.prematchTurnover ?? 0).toLocaleString()} <span className="text-[#888] text-xs">({prePct.toFixed(1)}%)</span></span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-[#222]">
                <span className="text-white">Total Turnover</span>
                <span className="text-white font-mono font-bold">€{kpi.turnover.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-white">Average Stake</span>
                <span className="text-white font-mono font-medium">€{Math.round(avgStake).toLocaleString()}</span>
              </div>
            </div>
          </>
        );
      }

      case 'margin':
        return (
          <>
            <h2 className="text-lg font-bold text-white mb-1">Margin by Sport</h2>
            <p className="text-sm text-[#888] mb-4">Margin = P&L divided by Turnover. Positive means the book made money. Negative means players won more than they staked.</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#333]">
                  <th className="text-left py-2 text-[#888] font-medium">Sport</th>
                  <th className="text-right py-2 text-[#888] font-medium">Turnover</th>
                  <th className="text-right py-2 text-[#888] font-medium">Margin</th>
                </tr>
              </thead>
              <tbody>
                {data.sportsBreakdown.map(s => (
                  <tr key={s.sport} className="border-b border-[#222]">
                    <td className="py-2 text-white">{s.sport}</td>
                    <td className="py-2 text-right text-[#ccc]">€{s.turnover.toLocaleString()}</td>
                    <td className={`py-2 text-right font-medium ${s.margin >= 0 ? 'text-[#00e554]' : 'text-[#ff4444]'}`}>
                      {s.margin.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-[#444]">
                  <td className="py-2 text-white font-bold">Overall</td>
                  <td className="py-2 text-right text-white font-bold">€{kpi.turnover.toLocaleString()}</td>
                  <td className={`py-2 text-right font-bold ${kpi.margin >= 0 ? 'text-[#00e554]' : 'text-[#ff4444]'}`}>
                    {kpi.margin.toFixed(2)}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </>
        );

      case 'bets': {
        const hourlyTop = [...data.hourlyBets].sort((a, b) => b.count - a.count).filter(h => h.count > 0).slice(0, 8);
        return (
          <>
            <h2 className="text-lg font-bold text-white mb-1">Total Bets Breakdown</h2>
            <p className="text-sm text-[#888] mb-4">Total number of individual bets accepted after excluding internal test accounts.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-xs text-[#888] uppercase tracking-wider mb-2">By Sport</h3>
                <table className="w-full text-sm">
                  <tbody>
                    {data.sportsBreakdown.map(s => (
                      <tr key={s.sport} className="border-b border-[#222]">
                        <td className="py-1.5 text-white">{s.sport}</td>
                        <td className="py-1.5 text-right text-[#ccc] font-mono">{s.bets}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-[#444]">
                      <td className="py-1.5 text-white font-bold">Total</td>
                      <td className="py-1.5 text-right text-white font-bold font-mono">{kpi.bets}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div>
                <h3 className="text-xs text-[#888] uppercase tracking-wider mb-2">Peak Hours</h3>
                <table className="w-full text-sm">
                  <tbody>
                    {hourlyTop.map(h => (
                      <tr key={h.hour} className="border-b border-[#222]">
                        <td className="py-1.5 text-white">{String(h.hour).padStart(2, '0')}:00</td>
                        <td className="py-1.5 text-right text-[#ccc] font-mono">{h.count} bets</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        );
      }

      case 'rejections':
        return (
          <>
            <h2 className="text-lg font-bold text-white mb-1">Rejections Breakdown</h2>
            <p className="text-sm text-[#888] mb-4">Bets our system declined to accept. Blocked turnover is money we chose not to risk.</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#333]">
                  <th className="text-left py-2 text-[#888] font-medium">Reason</th>
                  <th className="text-right py-2 text-[#888] font-medium">Bets</th>
                  <th className="text-right py-2 text-[#888] font-medium">Blocked TO</th>
                  <th className="text-right py-2 text-[#888] font-medium">% of Total</th>
                </tr>
              </thead>
              <tbody>
                {data.rejectionReasons.map(r => (
                  <tr key={r.reason} className="border-b border-[#222]">
                    <td className="py-2 text-white">{r.reason}</td>
                    <td className="py-2 text-right text-[#ccc] font-mono">{r.count}</td>
                    <td className="py-2 text-right text-[#ccc] font-mono">€{r.blockedTurnover.toLocaleString()}</td>
                    <td className="py-2 text-right text-[#ccc] font-mono">{r.percentage.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-[#444]">
                  <td className="py-2 text-white font-bold">Total</td>
                  <td className="py-2 text-right text-white font-bold font-mono">{kpi.rejections}</td>
                  <td className="py-2 text-right text-white font-bold font-mono">€{data.rejectionReasons.reduce((s, r) => s + r.blockedTurnover, 0).toLocaleString()}</td>
                  <td className="py-2 text-right text-white font-bold font-mono">100%</td>
                </tr>
              </tfoot>
            </table>
          </>
        );

      case 'highRisk': {
        const highRiskUsers = data.userSummaries.filter(u => u.concentrationRisk === 'high');
        return (
          <>
            <h2 className="text-lg font-bold text-white mb-1">High Risk Users</h2>
            <p className="text-sm text-[#888] mb-4">Users flagged due to high concentration of turnover or elevated CCF customer factor score.</p>
            {highRiskUsers.length === 0 ? (
              <p className="text-[#888] text-sm py-4 text-center">No high-risk users flagged for this period.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#333]">
                    <th className="text-left py-2 text-[#888] font-medium">User</th>
                    <th className="text-right py-2 text-[#888] font-medium">Turnover</th>
                    <th className="text-right py-2 text-[#888] font-medium">Share</th>
                    <th className="text-right py-2 text-[#888] font-medium">CCF</th>
                  </tr>
                </thead>
                <tbody>
                  {highRiskUsers.map(u => {
                    const totalTO = data.kpiSummary.turnover;
                    const sharePct = totalTO > 0 ? (u.turnover / totalTO * 100) : 0;
                    // Try to get CCF from top player if nickname matches
                    const ccf = data.topPlayer?.nickname === u.username ? data.topPlayer.ccf : null;
                    return (
                      <tr key={u.userId} className="border-b border-[#222]">
                        <td className="py-2">
                          <span className="text-white font-medium">{u.username}</span>
                          <span className="text-[#666] text-xs ml-2">{u.userId}</span>
                        </td>
                        <td className="py-2 text-right text-[#ccc] font-mono">€{u.turnover.toLocaleString()}</td>
                        <td className="py-2 text-right text-[#ff4444] font-mono font-medium">{sharePct.toFixed(1)}%</td>
                        <td className="py-2 text-right text-[#ccc] font-mono">{ccf !== null ? ccf.toFixed(2) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </>
        );
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />
      <div
        className="relative w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-xl p-6"
        style={{ background: '#1a1a1a', border: '1px solid #00e554' }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#888] hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        {renderContent()}
      </div>
    </div>
  );
};

export default KPIDetailModal;
