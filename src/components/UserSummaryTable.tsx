import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { UserSummary } from '@/lib/types';

interface UserSummaryTableProps {
  data: UserSummary[];
}

const UserSummaryTable = ({ data }: UserSummaryTableProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="kpi-card !p-0 overflow-hidden">
      <button onClick={() => setIsOpen(!isOpen)} className="section-toggle w-full flex items-center justify-between px-5 py-3.5">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">User Summary</h3>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="px-5 pb-4">
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
      )}
    </div>
  );
};

export default UserSummaryTable;
