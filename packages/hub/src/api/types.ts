import type { Outcome } from '../modules/lmsr/types.js';
import type { MarketStatus } from '../modules/market/types.js';

// ── Request DTOs ──

export interface BetRequest {
  address: string;
  marketId: string;
  outcome: Outcome;
  amount: number;
  appSessionId: string;
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
    status: MarketStatus;
    outcome: Outcome | null;
    qBall: number;
    qStrike: number;
    b: number;
  } | null;
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
    timestamp: number;
  }>;
}

export interface AdminStateResponse {
  market: MarketResponse['market'];
  gameState: { active: boolean };
  positionCount: number;
  connectionCount: number;
}

// ── WebSocket message types ──

export type WsMessageType =
  | 'ODDS_UPDATE'
  | 'MARKET_STATUS'
  | 'GAME_STATE'
  | 'BET_RESULT'
  | 'POSITION_ADDED'
  | 'CONNECTION_COUNT'
  | 'STATE_SYNC';

export interface WsOddsUpdate {
  type: 'ODDS_UPDATE';
  priceBall: number;
  priceStrike: number;
  marketId: string;
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
    timestamp: number;
  }>;
}

export type WsMessage =
  | WsOddsUpdate
  | WsMarketStatus
  | WsGameState
  | WsBetResult
  | WsPositionAdded
  | WsConnectionCount
  | WsStateSync;
