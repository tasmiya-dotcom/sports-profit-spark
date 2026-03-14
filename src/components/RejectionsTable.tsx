import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { RejectionReason } from '@/lib/types';

interface RejectionsTableProps {
  data: RejectionReason[];
}

const RejectionsTable = ({ data }: RejectionsTableProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const topReason = data.length > 0 ? data[0].reason : null;

  return (
    <div className="kpi-card !p-0 overflow-hidden">
      <button onClick={() => setIsOpen(!isOpen)} className="section-toggle w-full flex items-center justify-between px-5 py-3.5">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Rejection Reasons</h3>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="px-5 pb-4">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reason</th>
                  <th>Bets</th>
                  <th>Blocked Turnover</th>
                  <th>Potential P&L</th>
                  <th>% of Total</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.reason} className={row.reason === topReason ? 'bg-destructive/10' : ''}>
                    <td className={`font-sans font-medium ${row.reason === topReason ? 'text-destructive' : ''}`}>
                      {row.reason}
                    </td>
                    <td>{row.count.toLocaleString()}</td>
                    <td className="value-warning">€{row.blockedTurnover.toLocaleString()}</td>
                    <td className={(row.potentialPnl ?? 0) >= 0 ? 'value-positive' : 'value-negative'}>
                      {(row.potentialPnl ?? 0) >= 0 ? '+' : ''}€{(row.potentialPnl ?? 0).toLocaleString()}
                    </td>
                    <td>{row.percentage.toFixed(2)}%</td>
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

export default RejectionsTable;
