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

export interface TopPlayerSpotlight {
  nickname: string;
  sourceId: string;
  bets: number;
  turnover: number;
  turnoverSharePct: number;
  ccf: number | null;
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
  reportDate: string;
  reportLabel: string;
  kpiSummary: KPISummary;
  dailyPnL: DailyPnL[];
  betSplit: BetSplit[];
  sportsBreakdown: SportBreakdown[];
  rejectionReasons: RejectionReason[];
  userSummaries: UserSummary[];
  marketPatterns: MarketPattern[];
  topPlayer: TopPlayerSpotlight | null;
  uploadDate: string;
}
