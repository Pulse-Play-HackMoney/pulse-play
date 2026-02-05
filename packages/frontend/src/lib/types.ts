// Outcome type (matches hub)
export type Outcome = 'BALL' | 'STRIKE';

// Market status (matches hub)
export type MarketStatus = 'PENDING' | 'OPEN' | 'CLOSED' | 'RESOLVED';

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

// ── Response DTOs ──

export interface BetResponse {
  accepted: boolean;
  reason?: string;
  shares?: number;
  newPriceBall?: number;
  newPriceStrike?: number;
}

export interface MarketData {
  id: string;
  status: MarketStatus;
  outcome: Outcome | null;
  qBall: number;
  qStrike: number;
  b: number;
}

export interface MarketResponse {
  market: MarketData | null;
  priceBall: number;
  priceStrike: number;
}

export interface Position {
  address: string;
  marketId: string;
  outcome: Outcome;
  shares: number;
  costPaid: number;
  appSessionId: string;
  timestamp: number;
}

export interface PositionsResponse {
  positions: Position[];
}

export interface GameStateResponse {
  success: boolean;
}

export interface MarketOpenResponse {
  success: boolean;
  marketId: string;
}

export interface MarketCloseResponse {
  success: boolean;
  marketId: string;
}

export interface OutcomeResponse {
  success: boolean;
  winners: string[];
  losers: string[];
  totalPayout: number;
}

export interface AdminStateResponse {
  market: MarketData | null;
  gameState: { active: boolean };
  positionCount: number;
  connectionCount: number;
}

// ── WebSocket message types ──

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

export type WsMessage =
  | WsOddsUpdate
  | WsMarketStatus
  | WsGameState
  | WsBetResult
  | WsPositionAdded
  | WsConnectionCount
  | WsStateSync;

// ── Market Maker DTOs ──

export interface MMInfoResponse {
  address: string;
  balance: string;
  isConnected: boolean;
}

export interface MMFaucetResponse {
  success: boolean;
  funded: number;
  requested?: number;
  error?: string;
}
