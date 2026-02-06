// Mirror of hub WsMessage and AdminState types

export type Outcome = 'BALL' | 'STRIKE';
export type MarketStatus = 'PENDING' | 'OPEN' | 'CLOSED' | 'RESOLVED';
export type SessionStatus = 'open' | 'settling' | 'settled';

// ── WebSocket message types ──

export interface WsOddsUpdate {
  type: 'ODDS_UPDATE';
  priceBall: number;
  priceStrike: number;
  qBall: number;
  qStrike: number;
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

export interface WsSessionSettled {
  type: 'SESSION_SETTLED';
  appSessionId: string;
  status: 'settled';
  address: string;
}

export type WsMessage =
  | WsOddsUpdate
  | WsMarketStatus
  | WsGameState
  | WsBetResult
  | WsPositionAdded
  | WsConnectionCount
  | WsStateSync
  | WsSessionSettled;

// ── Admin state response ──

export interface AdminStateResponse {
  market: {
    id: string;
    status: MarketStatus;
    outcome: Outcome | null;
    qBall: number;
    qStrike: number;
    b: number;
  } | null;
  gameState: { active: boolean };
  positionCount: number;
  connectionCount: number;
  sessionCounts?: { open: number; settled: number };
}

// ── Positions response ──

export interface Position {
  marketId: string;
  address: string;
  outcome: Outcome;
  shares: number;
  costPaid: number;
  appSessionId: string;
  appSessionVersion: number;
  sessionStatus?: SessionStatus;
  timestamp: number;
}

export interface PositionsResponse {
  positions: Position[];
}

// ── Event log entry ──

export interface EventLogEntry {
  timestamp: Date;
  type: string;
  message: string;
  raw: WsMessage;
}
