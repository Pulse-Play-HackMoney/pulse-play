// ── Shared types for the simulator ──

import type { Address, Hex } from 'viem';

// ── Outcome / Market / Session ──

export type Outcome = string;
export type MarketStatus = 'PENDING' | 'OPEN' | 'CLOSED' | 'RESOLVED';
export type SessionStatus = 'open' | 'settling' | 'settled';

// ── WebSocket message types (mirrors hub) ──

export interface WsOddsUpdate {
  type: 'ODDS_UPDATE';
  prices: number[];
  quantities: number[];
  outcomes: string[];
  marketId: string;
  // Backward compat
  priceBall?: number;
  priceStrike?: number;
  qBall?: number;
  qStrike?: number;
}

export interface WsMarketStatus {
  type: 'MARKET_STATUS';
  status: MarketStatus;
  marketId: string;
  outcome?: Outcome;
}

export interface WsGameState {
  type: 'GAME_STATE';
  active: boolean;
}

export interface WsBetResult {
  type: 'BET_RESULT';
  result: 'WIN' | 'LOSS';
  marketId: string;
  payout?: number;
  loss?: number;
}

export interface WsPositionAdded {
  type: 'POSITION_ADDED';
  position: Position;
  positionCount: number;
}

export interface WsConnectionCount {
  type: 'CONNECTION_COUNT';
  count: number;
}

export interface WsStateSync {
  type: 'STATE_SYNC';
  state: AdminStateResponse;
  positions: Position[];
}

export interface WsSessionSettled {
  type: 'SESSION_SETTLED';
  appSessionId: string;
  status: 'settled';
  address: string;
}

export interface WsSessionVersionUpdated {
  type: 'SESSION_VERSION_UPDATED';
  appSessionId: string;
  version: number;
  sessionData?: string;
}

export type WsMessage =
  | WsOddsUpdate
  | WsMarketStatus
  | WsGameState
  | WsBetResult
  | WsPositionAdded
  | WsConnectionCount
  | WsStateSync
  | WsSessionSettled
  | WsSessionVersionUpdated;

// ── Admin state response ──

export interface AdminStateResponse {
  market: {
    id: string;
    status: MarketStatus;
    outcome: Outcome | null;
    quantities: number[];
    outcomes: string[];
    b: number;
    // Backward compat
    qBall?: number;
    qStrike?: number;
    gameId?: string;
    categoryId?: string;
  } | null;
  prices: number[];
  outcomes: string[];
  gameState: { active: boolean };
  positionCount: number;
  connectionCount: number;
  sessionCounts?: { open: number; settled: number };
}

// ── Position ──

export interface Position {
  marketId: string;
  address: string;
  outcome: Outcome;
  shares: number;
  costPaid: number;
  fee?: number;
  appSessionId: string;
  appSessionVersion: number;
  sessionStatus?: SessionStatus;
  sessionData?: string;
  timestamp: number;
}

// ── Market summary (for :markets overlay) ──

export interface MarketSummary {
  id: string;
  gameId: string;
  categoryId: string;
  status: MarketStatus;
  outcome: string | null;
  createdAt: number;
}

// ── Hub API types ──

export interface BetRequest {
  address: string;
  marketId: string;
  outcome: Outcome;
  amount: number;
  appSessionId: string;
  appSessionVersion: number;
}

export interface BetResponse {
  accepted: boolean;
  reason?: string;
  shares?: number;
  newPrices?: number[];
  // Backward compat
  newPriceBall?: number;
  newPriceStrike?: number;
}

export interface MMInfoResponse {
  address: string;
  balance: string;
  isConnected: boolean;
}

// ── Event log entry ──

export interface EventLogEntry {
  timestamp: Date;
  type: string;
  message: string;
  raw?: WsMessage | SimEvent;
}

// ── Simulator-specific types ──

export type ClearnodeConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

export interface SimWalletRow {
  index: number;
  address: Address;
  privateKey: Hex;
  balance: string;
  funded: boolean;
  side: Outcome | null;
  maxBets: number;
  betAmount: number;
  delayMs: number;
  betCount: number;
  clearnodeStatus: ClearnodeConnectionStatus;
}

export interface SimConfig {
  outcomeBias: number; // fraction of wallets betting on first outcome
  betAmountMin: number;
  betAmountMax: number;
  delayMinMs: number;
  delayMaxMs: number;
  maxBetsPerWallet: number;
  outcomes: string[];
  // Backward compat alias
  ballBias?: number;
}

export const DEFAULT_SIM_CONFIG: SimConfig = {
  outcomeBias: 0.5,
  betAmountMin: 1.0,
  betAmountMax: 5.0,
  delayMinMs: 1500,
  delayMaxMs: 4000,
  maxBetsPerWallet: 3,
  outcomes: ['BALL', 'STRIKE'],
};

export type SimStatus = 'idle' | 'running' | 'stopping';

export interface SimEvent {
  type: 'bet-placed' | 'bet-failed' | 'bet-rejected' | 'session-error' | 'sim-started' | 'sim-stopped' | 'wallet-funded' | 'fund-error';
  walletIndex: number;
  message: string;
  timestamp: Date;
}

export interface SimResults {
  marketId: string;
  outcome: Outcome;
  winners: Array<{
    walletIndex: number;
    address: string;
    payout: number;
    profit: number;
  }>;
  losers: Array<{
    walletIndex: number;
    address: string;
    loss: number;
  }>;
  totalPayout: number;
  totalLoss: number;
}
