// Outcome type (matches hub)
export type Outcome = string;

// Market status (matches hub)
export type MarketStatus = 'PENDING' | 'OPEN' | 'CLOSED' | 'RESOLVED';
export type SessionStatus = 'open' | 'settling' | 'settled';

// Game status (matches hub)
export type GameStatus = 'SCHEDULED' | 'ACTIVE' | 'COMPLETED';

// ── Domain Models ──

export interface Sport {
  id: string;
  name: string;
  description: string | null;
  createdAt: number;
}

export interface MarketCategory {
  id: string;
  sportId: string;
  name: string;
  outcomes: string[];
  description: string | null;
  createdAt: number;
}

export interface Team {
  id: string;
  sportId: string;
  name: string;
  abbreviation: string;
  logoPath: string | null;
  createdAt: number;
}

export interface Game {
  id: string;
  sportId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeam?: Team;
  awayTeam?: Team;
  status: GameStatus;
  startedAt: number | null;
  completedAt: number | null;
  imagePath: string | null;
  metadata: string | null;
  volume?: number;
  createdAt: number;
  marketCount?: number;
}

export interface UserStats {
  address: string;
  totalBets: number;
  totalWins: number;
  totalLosses: number;
  totalWagered: number;
  totalPayout: number;
  netPnl: number;
  firstSeenAt: number;
  lastActiveAt: number;
}

export interface Settlement {
  id: number;
  marketId: string;
  address: string;
  outcome: string;
  result: 'WIN' | 'LOSS';
  shares: number;
  costPaid: number;
  payout: number;
  profit: number;
  appSessionId: string;
  settledAt: number;
}

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
  gameId: string;
  categoryId: string;
}

export interface MarketCloseRequest {
  gameId?: string;
  categoryId?: string;
}

export interface OutcomeRequest {
  outcome: Outcome;
  gameId?: string;
  categoryId?: string;
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
  gameId: string;
  categoryId: string;
  status: MarketStatus;
  outcome: Outcome | null;
  quantities: number[];
  b: number;
  volume?: number;
  // backward compat
  qBall: number;
  qStrike: number;
}

export interface MarketResponse {
  market: MarketData | null;
  prices: number[];
  outcomes: string[];
  // backward compat
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
  appSessionVersion: number;
  sessionStatus?: SessionStatus;
  mode?: 'lmsr' | 'p2p';
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
  marketId: string;
  outcome: string;
  winners: number;
  losers: number;
  totalPayout: number;
}

export interface AdminStateResponse {
  market: MarketData | null;
  gameState: { active: boolean };
  positionCount: number;
  connectionCount: number;
  sessionCounts?: { open: number; settled: number };
  prices: number[];
  outcomes: string[];
  // backward compat
  priceBall: number;
  priceStrike: number;
  pool?: PoolStats;
}

// ── WebSocket message types ──

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
}

export interface WsGameCreated {
  type: 'GAME_CREATED';
  game: { id: string; sportId: string; status: string };
}

export interface WsOrderPlaced {
  type: 'ORDER_PLACED';
  orderId: string;
  marketId: string;
  outcome: string;
  mcps: number;
  amount: number;
  maxShares: number;
  status: string;
}

export interface WsOrderFilled {
  type: 'ORDER_FILLED';
  orderId: string;
  fillId: string;
  counterpartyOrderId: string;
  shares: number;
  effectivePrice: number;
  cost: number;
}

export interface WsOrderBookUpdate {
  type: 'ORDERBOOK_UPDATE';
  marketId: string;
  outcomes: Record<string, DepthLevel[]>;
}

export interface WsOrderCancelled {
  type: 'ORDER_CANCELLED';
  orderId: string;
  marketId: string;
}

export interface WsP2PBetResult {
  type: 'P2P_BET_RESULT';
  result: 'WIN' | 'LOSS';
  orderId: string;
  marketId: string;
  payout?: number;
  profit?: number;
  loss?: number;
  refunded?: number;
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
  | WsGameCreated
  | WsOrderPlaced
  | WsOrderFilled
  | WsOrderBookUpdate
  | WsOrderCancelled
  | WsP2PBetResult
  | WsLPDeposit
  | WsLPWithdrawal
  | WsPoolUpdate
  | WsVolumeUpdate;

// ── P2P Order Book Types ──

export type OrderStatus =
  | 'OPEN'
  | 'PARTIALLY_FILLED'
  | 'FILLED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'SETTLED';

export interface P2POrder {
  orderId: string;
  marketId: string;
  gameId: string;
  userAddress: string;
  outcome: Outcome;
  mcps: number;
  amount: number;
  filledAmount: number;
  unfilledAmount: number;
  maxShares: number;
  filledShares: number;
  unfilledShares: number;
  appSessionId: string;
  appSessionVersion: number;
  status: OrderStatus;
  createdAt: number;
  updatedAt: number;
}

export interface P2PFill {
  fillId: string;
  orderId: string;
  counterpartyOrderId: string;
  counterpartyAddress: string;
  shares: number;
  effectivePrice: number;
  cost: number;
  filledAt: number;
}

export interface DepthLevel {
  price: number;
  shares: number;
  orderCount: number;
}

export interface OrderBookDepth {
  marketId: string;
  outcomes: Record<string, DepthLevel[]>;
  updatedAt: number;
}

export interface P2POrderRequest {
  marketId: string;
  gameId: string;
  userAddress: string;
  outcome: string;
  mcps: number;
  amount: number;
  appSessionId: string;
  appSessionVersion: number;
}

export interface P2POrderResponse {
  orderId: string;
  status: OrderStatus;
  fills: P2PFill[];
  order: P2POrder;
}

// ── LP (Liquidity Pool) DTOs ──

export interface LPShare {
  address: string;
  shares: number;
  totalDeposited: number;
  totalWithdrawn: number;
  firstDepositAt: number;
  lastActionAt: number;
  currentValue?: number | null;
  pnl?: number | null;
  sharePrice?: number | null;
}

export type LPEventType = 'DEPOSIT' | 'WITHDRAWAL';

export interface LPEvent {
  id: number;
  address: string;
  type: LPEventType;
  amount: number;
  shares: number;
  sharePrice: number;
  poolValueBefore: number;
  poolValueAfter: number;
  timestamp: number;
}

export interface PoolStats {
  poolValue: number;
  totalShares: number;
  sharePrice: number;
  lpCount: number;
  canWithdraw: boolean;
  withdrawLockReason?: string;
}

export interface LPDepositResponse {
  success: boolean;
  shares: number;
  sharePrice: number;
  poolValueAfter: number;
}

export interface LPWithdrawResponse {
  success: boolean;
  amount: number;
  sharePrice: number;
  poolValueAfter: number;
}

// ── Market Maker DTOs ──

export interface MMInfoResponse {
  address: string;
  balance: string;
}

export interface MMFaucetResponse {
  success: boolean;
  funded: number;
  requested?: number;
  error?: string;
}

// ── User Faucet DTOs ──

export interface UserFaucetResponse {
  success: boolean;
  funded: number;
  requested?: number;
  error?: string;
}
