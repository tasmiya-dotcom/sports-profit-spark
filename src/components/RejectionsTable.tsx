import type { RejectionReason } from '@/lib/types';

interface RejectionsTableProps {
  data: RejectionReason[];
}

const RejectionsTable = ({ data }: RejectionsTableProps) => {
  return (
    <div className="kpi-card">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Rejection Reasons</h3>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Reason</th>
              <th>Count</th>
              <th>Blocked Turnover</th>
              <th>% of Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.reason}>
                <td className="font-sans font-medium">{row.reason}</td>
                <td>{row.count.toLocaleString()}</td>
                <td className="value-warning">${row.blockedTurnover.toLocaleString()}</td>
                <td>{row.percentage.toFixed(1)}%</td>
                <td className="w-32">
                  <div className="w-full bg-secondary rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full"
                      style={{
                        width: `${Math.min(row.percentage, 100)}%`,
                        background: 'hsl(var(--chart-warning))',
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RejectionsTable;
