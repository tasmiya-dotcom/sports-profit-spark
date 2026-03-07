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

export interface DashboardData {
  dailyPnL: DailyPnL[];
  betSplit: BetSplit[];
  sportsBreakdown: SportBreakdown[];
  rejectionReasons: RejectionReason[];
  userSummaries: UserSummary[];
  marketPatterns: MarketPattern[];
  uploadDate: string;
}
