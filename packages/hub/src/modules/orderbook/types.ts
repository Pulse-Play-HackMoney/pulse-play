import type { Outcome } from '../lmsr/types.js';

// ── Order Status Machine ────────────────────────────────────────────────────
// OPEN → PARTIALLY_FILLED → FILLED     (normal lifecycle)
//      → CANCELLED                      (user cancels)
//      → EXPIRED                        (market closes before fill)
// PARTIALLY_FILLED → CANCELLED          (user cancels unfilled portion)
//                  → EXPIRED            (market closes)
// FILLED → SETTLED                      (after market resolution)
// PARTIALLY_FILLED → SETTLED            (filled portion settles)

export type OrderStatus =
  | 'OPEN'
  | 'PARTIALLY_FILLED'
  | 'FILLED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'SETTLED';

export type PositionMode = 'lmsr' | 'p2p';

// ── P2P Order ───────────────────────────────────────────────────────────────

export interface P2POrder {
  orderId: string;
  marketId: string;
  gameId: string;
  userAddress: string;
  outcome: Outcome;
  /** Max cost per share — the most this user will pay per share (0 < mcps < 1) */
  mcps: number;
  /** Total amount locked in the order (denominated in USDC) */
  amount: number;
  /** Amount that has been matched and filled */
  filledAmount: number;
  /** Amount remaining unfilled (amount - filledAmount) */
  unfilledAmount: number;
  /** Maximum shares this order could buy (amount / mcps) */
  maxShares: number;
  /** Shares that have been filled */
  filledShares: number;
  /** Shares remaining unfilled */
  unfilledShares: number;
  appSessionId: string;
  appSessionVersion: number;
  status: OrderStatus;
  createdAt: number;
  updatedAt: number;
}

// ── P2P Fill ────────────────────────────────────────────────────────────────

export interface P2PFill {
  fillId: string;
  orderId: string;
  counterpartyOrderId: string;
  counterpartyAddress: string;
  shares: number;
  /** Effective price per share after price improvement */
  effectivePrice: number;
  /** Total cost of this fill (shares * effectivePrice) */
  cost: number;
  filledAt: number;
}

// ── Order Book Depth ────────────────────────────────────────────────────────

export interface DepthLevel {
  /** Price level (MCPS) */
  price: number;
  /** Total shares available at this price level */
  shares: number;
  /** Number of orders at this price level */
  orderCount: number;
}

export interface OrderBookDepth {
  marketId: string;
  /** Depth levels per outcome, keyed by outcome name */
  outcomes: Record<string, DepthLevel[]>;
  updatedAt: number;
}

// ── Request / Response ──────────────────────────────────────────────────────

export interface OrderRequest {
  marketId: string;
  gameId: string;
  userAddress: string;
  outcome: Outcome;
  mcps: number;
  amount: number;
  appSessionId: string;
  appSessionVersion: number;
}

export interface OrderResponse {
  orderId: string;
  fills: P2PFill[];
  order: P2POrder;
}

// ── Matcher Types ───────────────────────────────────────────────────────────

export interface RestingOrder {
  orderId: string;
  mcps: number;
  unfilledShares: number;
}

export interface MatchFill {
  restingOrderId: string;
  shares: number;
  incomingPrice: number;
  restingPrice: number;
}

export interface MatchResult {
  fills: MatchFill[];
  remainingShares: number;
}
