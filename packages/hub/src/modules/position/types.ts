import type { Outcome } from '../lmsr/types.js';

export type SessionStatus = 'open' | 'settling' | 'settled';

export interface Position {
  address: string;
  marketId: string;
  outcome: Outcome;
  shares: number;
  costPaid: number;
  appSessionId: string;
  appSessionVersion: number;
  sessionStatus: SessionStatus;
  timestamp: number;
}
