import type { RiskAlert } from '@/lib/types';
import { AlertTriangle, Info, CheckCircle2 } from 'lucide-react';

interface RiskAlertsPanelProps {
  alerts: RiskAlert[];
}

const RiskAlertsPanel = ({ alerts }: RiskAlertsPanelProps) => {
  const hasAlerts = alerts.length > 0;

  return (
    <div className="kpi-card">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Risk Alerts</h3>
      {!hasAlerts ? (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-primary/10 border border-primary/20">
          <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm font-medium text-primary">All Clear — No active risk alerts</span>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 px-3 py-2.5 rounded-lg border text-sm ${
                alert.type === 'warning'
                  ? 'bg-destructive/10 border-destructive/20'
                  : 'bg-accent/10 border-accent/20'
              }`}
            >
              {alert.type === 'warning' ? (
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              ) : (
                <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              )}
              <span className={alert.type === 'warning' ? 'text-destructive' : 'text-accent'}>
                {alert.message}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RiskAlertsPanel;
