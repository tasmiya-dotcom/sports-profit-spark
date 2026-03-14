import { TrendingUp, TrendingDown, BarChart3, AlertTriangle } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: 'profit' | 'bets' | 'margin' | 'warning';
  onClick?: () => void;
}

const iconMap = {
  profit: TrendingUp,
  bets: BarChart3,
  margin: TrendingUp,
  warning: AlertTriangle,
};

const KPICard = ({ title, value, subtitle, trend, icon = 'profit', onClick }: KPICardProps) => {
  const Icon = iconMap[icon];

  return (
    <div className="kpi-card clickable-card" onClick={onClick}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">{title}</span>
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <p className={`text-2xl font-bold font-mono ${trend === 'up' ? 'value-positive' : trend === 'down' ? 'value-negative' : 'text-foreground'}`}>
        {value}
      </p>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
};

export default KPICard;
