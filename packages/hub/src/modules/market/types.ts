import type { Outcome } from '../lmsr/types.js';

export type MarketStatus = 'PENDING' | 'OPEN' | 'CLOSED' | 'RESOLVED';

export interface Market {
  id: string;
  gameId: string;
  categoryId: string;
  sequenceNum: number;
  status: MarketStatus;
  quantities: number[];
  b: number;
  volume: number;
  outcome: Outcome | null;
  createdAt: number;
  openedAt: number | null;
  closedAt: number | null;
  resolvedAt: number | null;
}

export interface ResolutionResult {
  winners: Array<{ address: string; payout: number; appSessionId: string }>;
  losers: Array<{ address: string; loss: number; appSessionId: string }>;
  totalPayout: number;
}
