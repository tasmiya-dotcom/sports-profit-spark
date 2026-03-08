import type { RiskAlert } from '@/lib/types';

interface RiskAlertsPanelProps {
  alerts: RiskAlert[] | undefined;
}

const RiskAlertsPanel = ({ alerts }: RiskAlertsPanelProps) => {
  console.log('RiskAlertsPanel receiving alerts:', JSON.stringify(alerts, null, 2));
  if (!alerts) return null;

  const hasAlerts = alerts.length > 0;

  return (
    <div className="kpi-card">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Risk Alerts</h3>
      {!hasAlerts ? (
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/15 text-primary text-sm font-semibold">
          ✓ All Clear — No risk flags today
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <div
              key={i}
              className={`px-3 py-2.5 rounded-lg border text-sm ${
                alert.type === 'warning'
                  ? 'bg-destructive/15 border-destructive/25 text-destructive font-bold'
                  : 'bg-amber-500/15 border-amber-500/25 text-amber-700 dark:text-amber-400'
              }`}
            >
              {alert.type === 'warning' ? '⚠ ' : 'ℹ '}
              {alert.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RiskAlertsPanel;
