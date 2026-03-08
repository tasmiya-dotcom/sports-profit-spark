import type { UserSummary } from '@/lib/types';

interface UserSummaryTableProps {
  data: UserSummary[];
}

const UserSummaryTable = ({ data }: UserSummaryTableProps) => {
  return (
    <div className="kpi-card">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">User Summary</h3>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Bets</th>
              <th>Turnover</th>
              <th>P&L</th>
              <th>Margin</th>
              <th>Risk</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.userId} className={row.concentrationRisk === 'high' ? 'concentration-high' : row.concentrationRisk === 'medium' ? 'concentration-medium' : ''}>
                <td>
                  <div className="font-sans">
                    <span className="font-medium">{row.username}</span>
                    <span className="text-muted-foreground text-xs ml-2">{row.userId}</span>
                  </div>
                </td>
                <td>{row.bets.toLocaleString()}</td>
                <td>€{row.turnover.toLocaleString()}</td>
                <td className={row.pnl >= 0 ? 'value-positive' : 'value-negative'}>
                  {row.pnl >= 0 ? '+' : ''}€{Math.abs(row.pnl).toLocaleString()}
                </td>
                <td className={row.margin >= 0 ? 'value-positive' : 'value-negative'}>
                  {row.margin.toFixed(1)}%
                </td>
                <td>
                  <span className={
                    row.concentrationRisk === 'high' ? 'value-negative font-medium' :
                    row.concentrationRisk === 'medium' ? 'value-warning' :
                    'text-muted-foreground'
                  }>
                    {row.concentrationRisk.toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserSummaryTable;
