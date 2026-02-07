import type { Outcome } from '../modules/lmsr/types.js';
import type { MarketStatus } from '../modules/market/types.js';
import type { SessionStatus } from '../modules/position/types.js';

// ── Request DTOs ──

export interface BetRequest {
  address: string;
  marketId: string;
  outcome: Outcome;
  amount: number;
  appSessionId: string;
  appSessionVersion: number;
}

export interface GameStateRequest {
  active: boolean;
}

export interface MarketOpenRequest {
  pitchId?: string;
}

export interface OutcomeRequest {
  outcome: Outcome;
}

export interface FaucetRequest {
  address: string;
  count?: number;
}

export interface MMFaucetRequest {
  count?: number;
}

// ── MM Response DTOs ──

export interface MMInfoResponse {
  address: string;
  balance: string;
  isConnected: boolean;
}

// ── Response DTOs ──

export interface BetResponse {
  accepted: boolean;
  reason?: string;
  shares?: number;
  newPriceBall?: number;
  newPriceStrike?: number;
}

export interface MarketResponse {
  market: {
    id: string;
    gameId: string;
    categoryId: string;
    status: MarketStatus;
    outcome: Outcome | null;
    quantities: number[];
    b: number;
    // backward compat
    qBall: number;
    qStrike: number;
  } | null;
  prices: number[];
  outcomes: string[];
  // backward compat
  priceBall: number;
  priceStrike: number;
}

export interface PositionsResponse {
  positions: Array<{
    marketId: string;
    outcome: Outcome;
    shares: number;
    costPaid: number;
    appSessionId: string;
    appSessionVersion: number;
    sessionStatus: SessionStatus;
    timestamp: number;
  }>;
}

export interface AdminStateResponse {
  market: MarketResponse['market'];
  gameState: { active: boolean };
  positionCount: number;
  connectionCount: number;
  sessionCounts: { open: number; settled: number };
  // new fields
  prices: number[];
  outcomes: string[];
  // backward compat
  priceBall: number;
  priceStrike: number;
}

// ── WebSocket message types ──

export type WsMessageType =
  | 'ODDS_UPDATE'
  | 'MARKET_STATUS'
  | 'GAME_STATE'
  | 'BET_RESULT'
  | 'POSITION_ADDED'
  | 'CONNECTION_COUNT'
  | 'STATE_SYNC'
  | 'SESSION_SETTLED'
  | 'SESSION_VERSION_UPDATED'
  | 'CONFIG_UPDATED';

export interface WsOddsUpdate {
  type: 'ODDS_UPDATE';
  prices: number[];
  quantities: number[];
  outcomes: string[];
  marketId: string;
  // backward compat
  priceBall: number;
  priceStrike: number;
  qBall: number;
  qStrike: number;
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
  position: {
    address: string;
    marketId: string;
    outcome: Outcome;
    shares: number;
    costPaid: number;
    appSessionId: string;
    appSessionVersion: number;
    sessionStatus: SessionStatus;
    timestamp: number;
  };
  positionCount: number;
}

export interface WsConnectionCount {
  type: 'CONNECTION_COUNT';
  count: number;
}

export interface WsStateSync {
  type: 'STATE_SYNC';
  state: AdminStateResponse;
  positions: Array<{
    address: string;
    marketId: string;
    outcome: Outcome;
    shares: number;
    costPaid: number;
    appSessionId: string;
    appSessionVersion: number;
    sessionStatus: SessionStatus;
    timestamp: number;
  }>;
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

export interface WsConfigUpdated {
  type: 'CONFIG_UPDATED';
  transactionFeePercent: number;
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
  | WsSessionVersionUpdated
  | WsConfigUpdated;
