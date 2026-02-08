import type { Outcome } from '../modules/lmsr/types.js';
import type { MarketStatus } from '../modules/market/types.js';
import type { SessionStatus } from '../modules/position/types.js';
import type { PoolStats } from '../modules/lp/types.js';

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
  pool?: PoolStats;
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
  | 'CONFIG_UPDATED'
  | 'GAME_CREATED'
  | 'LP_DEPOSIT'
  | 'LP_WITHDRAWAL'
  | 'POOL_UPDATE'
  | 'VOLUME_UPDATE';

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
  gameId?: string;
  categoryId?: string;
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

export interface WsGameCreated {
  type: 'GAME_CREATED';
  game: { id: string; sportId: string; status: string };
}

export interface WsLPDeposit {
  type: 'LP_DEPOSIT';
  address: string;
  amount: number;
  shares: number;
  sharePrice: number;
}

export interface WsLPWithdrawal {
  type: 'LP_WITHDRAWAL';
  address: string;
  amount: number;
  shares: number;
  sharePrice: number;
}

export interface WsPoolUpdate {
  type: 'POOL_UPDATE';
  poolValue: number;
  totalShares: number;
  sharePrice: number;
  lpCount: number;
  canWithdraw: boolean;
}

export interface WsVolumeUpdate {
  type: 'VOLUME_UPDATE';
  marketId: string;
  marketVolume: number;
  categoryId: string;
  categoryVolume: number;
  gameId: string;
  gameVolume: number;
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
  | WsConfigUpdated
  | WsGameCreated
  | WsLPDeposit
  | WsLPWithdrawal
  | WsPoolUpdate
  | WsVolumeUpdate;
