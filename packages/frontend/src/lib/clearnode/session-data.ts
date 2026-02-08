import type { Outcome } from '@/lib/types';

/** V1 — Written by bettor at createAppSession. */
export interface SessionDataV1 {
  v: 1;
  mode?: 'lmsr' | 'p2p';
  marketId: string;
  outcome: Outcome;
  amount: number;
  timestamp: number;
}

/** Encode session data for Clearnode transport. */
export function encodeSessionData(data: SessionDataV1): string {
  return JSON.stringify(data);
}
