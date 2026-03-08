export interface DailyPnL {
  date: string;
  pnl: number;
  margin: number;
  turnover: number;
}

export interface BetSplit {
  date: string;
  liveBets: number;
  prematchBets: number;
  liveTurnover: number;
  prematchTurnover: number;
}

export interface SportBreakdown {
  sport: string;
  bets: number;
  turnover: number;
  pnl: number;
  margin: number;
}

export interface RejectionReason {
  reason: string;
  count: number;
  blockedTurnover: number;
  potentialPnl: number;
  percentage: number;
}

export interface UserSummary {
  userId: string;
  username: string;
  bets: number;
  turnover: number;
  pnl: number;
  margin: number;
  concentrationRisk: 'low' | 'medium' | 'high';
}

export interface MarketPattern {
  market: string;
  count: number;
  turnover: number;
  pnl: number;
}

export interface RiskAlert {
  type: 'warning' | 'info';
  message: string;
}

export interface KPISummary {
  pnl: number;
  turnover: number;
  bets: number;
  margin: number;
  rejections: number;
  highRiskUsers: number;
}

export interface DashboardData {
  reportDate: string; // ISO date string e.g. "2026-03-07"
  reportLabel: string; // e.g. "07 Mar 2026"
  kpiSummary: KPISummary;
  dailyPnL: DailyPnL[];
  betSplit: BetSplit[];
  sportsBreakdown: SportBreakdown[];
  rejectionReasons: RejectionReason[];
  userSummaries: UserSummary[];
  marketPatterns: MarketPattern[];
  riskAlerts: RiskAlert[];
  uploadDate: string;
}
