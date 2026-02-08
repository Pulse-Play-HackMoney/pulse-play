import type { Outcome } from '../lmsr/types.js';
import type { PositionMode } from '../orderbook/types.js';

export type SessionStatus = 'open' | 'settling' | 'settled';

export interface Position {
  address: string;
  marketId: string;
  outcome: Outcome;
  shares: number;
  costPaid: number;
  fee?: number;
  appSessionId: string;
  appSessionVersion: number;
  sessionStatus: SessionStatus;
  sessionData?: string;
  mode?: PositionMode;
  timestamp: number;
}
