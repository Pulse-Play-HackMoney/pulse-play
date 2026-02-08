import type { Outcome } from '../lmsr/types.js';

// ── V1: Bettor creates session — bet intent ──

export interface SessionDataV1 {
  v: 1;
  mode?: 'lmsr' | 'p2p';
  marketId: string;
  outcome: Outcome;
  amount: number;
  timestamp: number;
}

// ── V2: Hub accepts bet — LMSR confirmation ──

export interface SessionDataV2 {
  v: 2;
  mode?: 'lmsr' | 'p2p';
  marketId: string;
  outcome: Outcome;
  amount: number;
  shares: number;
  effectivePricePerShare: number;
  preBetOdds: { ball: number; strike: number };
  postBetOdds: { ball: number; strike: number };
  fee?: number;
  feePercent?: number;
  timestamp: number;
}

// ── V2-P2P: Hub confirms P2P order placement ──

export interface SessionDataV2P2P {
  v: 2;
  mode: 'p2p';
  marketId: string;
  outcome: Outcome;
  amount: number;
  mcps: number;
  maxShares: number;
  filledShares: number;
  filledAmount: number;
  fillCount: number;
  status: string;
  timestamp: number;
}

// ── V3: Hub settles — resolution ──

export interface SessionDataV3 {
  v: 3;
  mode?: 'lmsr' | 'p2p';
  resolution: Outcome;
  result: 'WIN' | 'LOSS';
  payout: number;
  profit: number;
  shares: number;
  costPaid: number;
  timestamp: number;
}

// ── V3-P2P: Hub settles P2P order — resolution ──

export interface SessionDataV3P2P {
  v: 3;
  mode: 'p2p';
  resolution: Outcome;
  result: 'WIN' | 'LOSS';
  orderId: string;
  filledShares: number;
  filledCost: number;
  payout: number;
  profit: number;
  refunded: number;
  timestamp: number;
}

export type SessionData = SessionDataV1 | SessionDataV2 | SessionDataV2P2P | SessionDataV3 | SessionDataV3P2P;

/** Encode session data for Clearnode transport. */
export function encodeSessionData(data: SessionData): string {
  return JSON.stringify(data);
}

/** Decode session data from Clearnode transport. */
export function decodeSessionData(raw: string): SessionData {
  return JSON.parse(raw) as SessionData;
}
