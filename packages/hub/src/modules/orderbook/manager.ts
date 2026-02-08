import { eq, and, inArray, desc, asc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import type { DrizzleDB } from '../../db/connection.js';
import { p2pOrders, p2pFills, marketCategories } from '../../db/schema.js';
import { matchOrder } from './matcher.js';
import type {
  P2POrder,
  P2PFill,
  OrderBookDepth,
  DepthLevel,
  OrderStatus,
  OrderRequest,
  OrderResponse,
} from './types.js';

// ── Row mappers ─────────────────────────────────────────────────────────────

function toOrder(row: typeof p2pOrders.$inferSelect): P2POrder {
  return {
    orderId: row.orderId,
    marketId: row.marketId,
    gameId: row.gameId,
    userAddress: row.userAddress,
    outcome: row.outcome,
    mcps: row.mcps,
    amount: row.amount,
    filledAmount: row.filledAmount,
    unfilledAmount: row.unfilledAmount,
    maxShares: row.maxShares,
    filledShares: row.filledShares,
    unfilledShares: row.unfilledShares,
    appSessionId: row.appSessionId,
    appSessionVersion: row.appSessionVersion,
    status: row.status as OrderStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toFill(row: typeof p2pFills.$inferSelect): P2PFill {
  return {
    fillId: row.fillId,
    orderId: row.orderId,
    counterpartyOrderId: row.counterpartyOrderId,
    counterpartyAddress: row.counterpartyAddress,
    shares: row.shares,
    effectivePrice: row.effectivePrice,
    cost: row.cost,
    filledAt: row.filledAt,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Get the opposite outcome for a binary market. */
function getOppositeOutcome(outcome: string, outcomes: string[]): string {
  if (outcomes.length !== 2) {
    throw new Error('P2P order book only supports binary markets (exactly 2 outcomes)');
  }
  const opposite = outcomes.find(o => o !== outcome);
  if (!opposite) {
    throw new Error(`Outcome "${outcome}" not found in market outcomes: [${outcomes.join(', ')}]`);
  }
  return opposite;
}

// ── OrderBookManager ────────────────────────────────────────────────────────

export class OrderBookManager {
  private db: DrizzleDB;

  constructor(db: DrizzleDB) {
    this.db = db;
  }

  /**
   * Places a new P2P order. Matches against resting orders on the opposite
   * outcome, records fills, and inserts/updates orders in a single transaction.
   */
  placeOrder(request: OrderRequest, outcomes: string[]): OrderResponse {
    const {
      marketId, gameId, userAddress, outcome, mcps, amount,
      appSessionId, appSessionVersion,
    } = request;

    // Validate binary market
    if (outcomes.length !== 2) {
      throw new Error('P2P order book only supports binary markets (exactly 2 outcomes)');
    }
    if (!outcomes.includes(outcome)) {
      throw new Error(`Invalid outcome "${outcome}". Must be one of: ${outcomes.join(', ')}`);
    }
    if (mcps <= 0 || mcps >= 1) {
      throw new Error(`MCPS must be between 0 and 1 (exclusive), got ${mcps}`);
    }
    if (amount <= 0) {
      throw new Error(`Amount must be positive, got ${amount}`);
    }

    const orderId = randomUUID();
    const maxShares = amount / mcps;
    const now = Date.now();
    const oppositeOutcome = getOppositeOutcome(outcome, outcomes);

    // Get resting orders on the opposite side, sorted by MCPS desc then createdAt asc
    const restingRows = this.db.select().from(p2pOrders)
      .where(and(
        eq(p2pOrders.marketId, marketId),
        eq(p2pOrders.outcome, oppositeOutcome),
        inArray(p2pOrders.status, ['OPEN', 'PARTIALLY_FILLED']),
      ))
      .orderBy(desc(p2pOrders.mcps), asc(p2pOrders.createdAt))
      .all();

    const restingOrders = restingRows.map(r => ({
      orderId: r.orderId,
      mcps: r.mcps,
      unfilledShares: r.unfilledShares,
    }));

    // Run matching engine
    const matchResult = matchOrder(mcps, maxShares, restingOrders);

    // Process results in a transaction
    const fills: P2PFill[] = [];

    this.db.transaction((tx) => {
      // Insert incoming order first (fills reference it via FK)
      tx.insert(p2pOrders).values({
        orderId,
        marketId,
        gameId,
        userAddress,
        outcome,
        mcps,
        amount,
        filledAmount: 0,
        unfilledAmount: amount,
        maxShares,
        filledShares: 0,
        unfilledShares: maxShares,
        appSessionId,
        appSessionVersion,
        status: 'OPEN',
        createdAt: now,
        updatedAt: now,
      }).run();

      let totalFilledShares = 0;
      let totalFilledCost = 0;

      for (const mf of matchResult.fills) {
        const fillId = randomUUID();
        const counterFillId = randomUUID();
        const incomingCost = mf.shares * mf.incomingPrice;
        const restingCost = mf.shares * mf.restingPrice;

        // Look up resting order for counterparty address
        const restingOrder = restingRows.find(r => r.orderId === mf.restingOrderId)!;

        totalFilledShares += mf.shares;
        totalFilledCost += incomingCost;

        // Record fill for incoming order
        tx.insert(p2pFills).values({
          fillId,
          orderId,
          counterpartyOrderId: mf.restingOrderId,
          counterpartyAddress: restingOrder.userAddress,
          shares: mf.shares,
          effectivePrice: mf.incomingPrice,
          cost: incomingCost,
          filledAt: now,
        }).run();

        // Record fill for resting order
        tx.insert(p2pFills).values({
          fillId: counterFillId,
          orderId: mf.restingOrderId,
          counterpartyOrderId: orderId,
          counterpartyAddress: userAddress,
          shares: mf.shares,
          effectivePrice: mf.restingPrice,
          cost: restingCost,
          filledAt: now,
        }).run();

        // Update resting order
        const newRestingFilledShares = restingOrder.filledShares + mf.shares;
        const newRestingFilledAmount = restingOrder.filledAmount + restingCost;
        const newRestingUnfilledShares = restingOrder.unfilledShares - mf.shares;
        const newRestingUnfilledAmount = restingOrder.unfilledAmount - restingCost;
        const restingFullyFilled = newRestingUnfilledShares <= 0;

        tx.update(p2pOrders)
          .set({
            filledShares: newRestingFilledShares,
            filledAmount: newRestingFilledAmount,
            unfilledShares: Math.max(0, newRestingUnfilledShares),
            unfilledAmount: Math.max(0, newRestingUnfilledAmount),
            status: restingFullyFilled ? 'FILLED' : 'PARTIALLY_FILLED',
            updatedAt: now,
          })
          .where(eq(p2pOrders.orderId, mf.restingOrderId))
          .run();

        fills.push({
          fillId,
          orderId,
          counterpartyOrderId: mf.restingOrderId,
          counterpartyAddress: restingOrder.userAddress,
          shares: mf.shares,
          effectivePrice: mf.incomingPrice,
          cost: incomingCost,
          filledAt: now,
        });
      }

      // Update incoming order with final fill totals
      if (totalFilledShares > 0) {
        const unfilledShares = maxShares - totalFilledShares;
        const unfilledAmount = amount - totalFilledCost;
        const status: OrderStatus = unfilledShares <= 0 ? 'FILLED' : 'PARTIALLY_FILLED';

        tx.update(p2pOrders)
          .set({
            filledAmount: totalFilledCost,
            unfilledAmount: Math.max(0, unfilledAmount),
            filledShares: totalFilledShares,
            unfilledShares: Math.max(0, unfilledShares),
            status,
            updatedAt: now,
          })
          .where(eq(p2pOrders.orderId, orderId))
          .run();
      }
    });

    const order = this.getOrder(orderId)!;
    return { orderId, fills, order };
  }

  /**
   * Cancels an order. Only OPEN or PARTIALLY_FILLED orders can be cancelled.
   * The filled portion is preserved for resolution.
   */
  cancelOrder(orderId: string): P2POrder {
    const order = this.getOrder(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }
    if (order.status !== 'OPEN' && order.status !== 'PARTIALLY_FILLED') {
      throw new Error(`Cannot cancel order with status ${order.status}`);
    }

    this.db.update(p2pOrders)
      .set({ status: 'CANCELLED', updatedAt: Date.now() })
      .where(eq(p2pOrders.orderId, orderId))
      .run();

    return this.getOrder(orderId)!;
  }

  /**
   * Returns aggregated depth for each outcome in the market.
   * Depth levels are grouped by price (MCPS) with total shares and order count.
   */
  getDepth(marketId: string, outcomes: string[]): OrderBookDepth {
    const depthByOutcome: Record<string, DepthLevel[]> = {};

    for (const outcome of outcomes) {
      const orders = this.db.select().from(p2pOrders)
        .where(and(
          eq(p2pOrders.marketId, marketId),
          eq(p2pOrders.outcome, outcome),
          inArray(p2pOrders.status, ['OPEN', 'PARTIALLY_FILLED']),
        ))
        .orderBy(desc(p2pOrders.mcps))
        .all();

      // Aggregate by price level
      const levelMap = new Map<number, { shares: number; orderCount: number }>();
      for (const o of orders) {
        const existing = levelMap.get(o.mcps);
        if (existing) {
          existing.shares += o.unfilledShares;
          existing.orderCount += 1;
        } else {
          levelMap.set(o.mcps, { shares: o.unfilledShares, orderCount: 1 });
        }
      }

      depthByOutcome[outcome] = Array.from(levelMap.entries())
        .map(([price, data]) => ({ price, shares: data.shares, orderCount: data.orderCount }))
        .sort((a, b) => b.price - a.price); // best price first
    }

    return {
      marketId,
      outcomes: depthByOutcome,
      updatedAt: Date.now(),
    };
  }

  getOrder(orderId: string): P2POrder | null {
    const row = this.db.select().from(p2pOrders)
      .where(eq(p2pOrders.orderId, orderId))
      .get();
    return row ? toOrder(row) : null;
  }

  getOrdersByUser(address: string, marketId?: string): P2POrder[] {
    const conditions = [eq(p2pOrders.userAddress, address)];
    if (marketId) {
      conditions.push(eq(p2pOrders.marketId, marketId));
    }
    return this.db.select().from(p2pOrders)
      .where(and(...conditions))
      .orderBy(desc(p2pOrders.createdAt))
      .all()
      .map(toOrder);
  }

  getOrdersByMarket(marketId: string): P2POrder[] {
    return this.db.select().from(p2pOrders)
      .where(eq(p2pOrders.marketId, marketId))
      .orderBy(desc(p2pOrders.createdAt))
      .all()
      .map(toOrder);
  }

  getFills(orderId: string): P2PFill[] {
    return this.db.select().from(p2pFills)
      .where(eq(p2pFills.orderId, orderId))
      .all()
      .map(toFill);
  }

  /**
   * Returns all orders with filledShares > 0 for a given market,
   * for use during market resolution.
   */
  getFilledOrdersForResolution(marketId: string): P2POrder[] {
    return this.db.select().from(p2pOrders)
      .where(and(
        eq(p2pOrders.marketId, marketId),
        inArray(p2pOrders.status, ['FILLED', 'PARTIALLY_FILLED', 'CANCELLED']),
      ))
      .all()
      .filter(row => row.filledShares > 0)
      .map(toOrder);
  }

  /**
   * Marks all remaining OPEN/PARTIALLY_FILLED orders as EXPIRED.
   * Called when a market closes.
   * Returns the expired orders for refund processing.
   */
  expireUnfilledOrders(marketId: string): P2POrder[] {
    const orders = this.db.select().from(p2pOrders)
      .where(and(
        eq(p2pOrders.marketId, marketId),
        inArray(p2pOrders.status, ['OPEN', 'PARTIALLY_FILLED']),
      ))
      .all()
      .map(toOrder);

    const now = Date.now();
    for (const order of orders) {
      this.db.update(p2pOrders)
        .set({ status: 'EXPIRED', updatedAt: now })
        .where(eq(p2pOrders.orderId, order.orderId))
        .run();
    }

    return orders;
  }

  /**
   * Marks an order as SETTLED after resolution.
   */
  settleOrder(orderId: string): void {
    this.db.update(p2pOrders)
      .set({ status: 'SETTLED', updatedAt: Date.now() })
      .where(eq(p2pOrders.orderId, orderId))
      .run();
  }
}
