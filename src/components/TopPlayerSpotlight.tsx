import type { TopPlayerSpotlight as TopPlayerData } from '@/lib/types';
import { User, TrendingUp, BarChart3, Target } from 'lucide-react';

interface TopPlayerSpotlightProps {
  player: TopPlayerData | null | undefined;
}

const fmt = (v: number) => `€${Math.round(Math.abs(v)).toLocaleString()}`;

const TopPlayerSpotlightPanel = ({ player }: TopPlayerSpotlightProps) => {
  if (!player) {
    return (
      <div className="kpi-card">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Top Player — Highest Turnover Share
        </h3>
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-sm font-semibold">
          No player data available
        </div>
      </div>
    );
  }

  const isHighRisk = player.turnoverSharePct > 50;
  const displayName = player.nickname && player.nickname !== '—' && player.nickname !== '-'
    ? player.nickname
    : player.sourceId;

  return (
    <div className={`kpi-card border-2 ${
      isHighRisk
        ? 'border-destructive/40 bg-destructive/5'
        : 'border-border'
    }`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Top Player — Highest Turnover Share
        </h3>
        {isHighRisk && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-destructive/15 text-destructive text-xs font-bold">
            ⚠ High Concentration
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Nickname */}
        <div className="flex items-start gap-2">
          <User className={`w-4 h-4 mt-0.5 shrink-0 ${isHighRisk ? 'text-destructive' : 'text-primary'}`} />
          <div>
            <p className="text-xs text-muted-foreground">Player</p>
            <p className={`text-sm font-bold ${isHighRisk ? 'text-destructive' : 'text-foreground'}`}>
              {displayName}
            </p>
          </div>
        </div>

        {/* Bets */}
        <div className="flex items-start gap-2">
          <BarChart3 className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Bets</p>
            <p className="text-sm font-bold text-foreground">{player.bets.toLocaleString()}</p>
          </div>
        </div>

        {/* Turnover */}
        <div className="flex items-start gap-2">
          <TrendingUp className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Turnover</p>
            <p className="text-sm font-bold text-foreground">{fmt(player.turnover)}</p>
          </div>
        </div>

        {/* Share */}
        <div className="flex items-start gap-2">
          <Target className={`w-4 h-4 mt-0.5 shrink-0 ${isHighRisk ? 'text-destructive' : 'text-amber-500'}`} />
          <div>
            <p className="text-xs text-muted-foreground">Turnover Share</p>
            <p className={`text-sm font-bold ${
              isHighRisk ? 'text-destructive' : player.turnoverSharePct > 30 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'
            }`}>
              {player.turnoverSharePct.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* CCF */}
        <div className="flex items-start gap-2">
          <div className="w-4 h-4 mt-0.5 shrink-0 flex items-center justify-center text-muted-foreground text-xs font-bold">
            CCF
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Customer Factor</p>
            <p className="text-sm font-bold text-foreground">
              {player.ccf !== null ? player.ccf.toFixed(2) : '—'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopPlayerSpotlightPanel;
