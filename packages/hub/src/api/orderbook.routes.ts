import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../context.js';
import { eq } from 'drizzle-orm';
import { marketCategories } from '../db/schema.js';
import { toMicroUnits, ASSET } from '../utils/units.js';

// ── Request/Response types ──────────────────────────────────────────────────

interface PlaceOrderBody {
  marketId: string;
  gameId: string;
  userAddress: string;
  outcome: string;
  mcps: number;
  amount: number;
  appSessionId: string;
  appSessionVersion: number;
}

interface CancelOrderParams {
  orderId: string;
}

interface DepthParams {
  marketId: string;
}

interface UserOrdersParams {
  address: string;
}

interface UserOrdersQuery {
  marketId?: string;
}

// ── Route registration ──────────────────────────────────────────────────────

export function registerOrderBookRoutes(app: FastifyInstance, ctx: AppContext): void {
  // ── POST /api/orderbook/order — Place a P2P order ─────────────────────
  app.post<{ Body: PlaceOrderBody }>('/api/orderbook/order', async (req, reply) => {
    const {
      marketId, gameId, userAddress, outcome, mcps, amount,
      appSessionId, appSessionVersion,
    } = req.body ?? {} as any;

    // Validate required fields
    if (!marketId || !gameId || !userAddress || !outcome || mcps === undefined || amount === undefined || !appSessionId || appSessionVersion === undefined) {
      return reply.status(400).send({ error: 'Missing required fields' });
    }

    // Validate MCPS range
    if (typeof mcps !== 'number' || mcps <= 0 || mcps >= 1) {
      try {
        const mmAddress = ctx.clearnodeClient.getAddress();
        await ctx.clearnodeClient.closeSession({
          appSessionId: appSessionId as `0x${string}`,
          allocations: [
            { participant: userAddress as `0x${string}`, asset: ASSET, amount: toMicroUnits(amount) },
            { participant: mmAddress as `0x${string}`, asset: ASSET, amount: '0' },
          ],
        });
      } catch (err) {
        ctx.log.error('p2p-order-rejection-close', err);
      }
      return reply.status(400).send({ error: 'MCPS must be between 0 and 1 (exclusive)' });
    }

    // Validate amount
    if (typeof amount !== 'number' || amount <= 0) {
      try {
        const mmAddress = ctx.clearnodeClient.getAddress();
        await ctx.clearnodeClient.closeSession({
          appSessionId: appSessionId as `0x${string}`,
          allocations: [
            { participant: userAddress as `0x${string}`, asset: ASSET, amount: toMicroUnits(amount > 0 ? amount : 0) },
            { participant: mmAddress as `0x${string}`, asset: ASSET, amount: '0' },
          ],
        });
      } catch (err) {
        ctx.log.error('p2p-order-rejection-close', err);
      }
      return reply.status(400).send({ error: 'Amount must be positive' });
    }

    // Check market exists and is OPEN
    const market = ctx.marketManager.getMarket(marketId);
    if (!market || market.status !== 'OPEN') {
      const reason = !market ? 'Market not found' : `Market is ${market.status}`;
      try {
        const mmAddress = ctx.clearnodeClient.getAddress();
        await ctx.clearnodeClient.closeSession({
          appSessionId: appSessionId as `0x${string}`,
          allocations: [
            { participant: userAddress as `0x${string}`, asset: ASSET, amount: toMicroUnits(amount) },
            { participant: mmAddress as `0x${string}`, asset: ASSET, amount: '0' },
          ],
        });
      } catch (err) {
        ctx.log.error('p2p-order-rejection-close', err);
      }
      return reply.status(400).send({ error: reason });
    }

    // Look up category to get outcomes
    const category = ctx.db.select().from(marketCategories)
      .where(eq(marketCategories.id, market.categoryId))
      .get();
    const outcomes: string[] = category ? JSON.parse(category.outcomes) : [];

    // Validate binary market
    if (outcomes.length !== 2) {
      try {
        const mmAddress = ctx.clearnodeClient.getAddress();
        await ctx.clearnodeClient.closeSession({
          appSessionId: appSessionId as `0x${string}`,
          allocations: [
            { participant: userAddress as `0x${string}`, asset: ASSET, amount: toMicroUnits(amount) },
            { participant: mmAddress as `0x${string}`, asset: ASSET, amount: '0' },
          ],
        });
      } catch (err) {
        ctx.log.error('p2p-order-rejection-close', err);
      }
      return reply.status(400).send({ error: 'P2P order book only supports binary markets' });
    }

    // Validate outcome
    if (!outcomes.includes(outcome)) {
      try {
        const mmAddress = ctx.clearnodeClient.getAddress();
        await ctx.clearnodeClient.closeSession({
          appSessionId: appSessionId as `0x${string}`,
          allocations: [
            { participant: userAddress as `0x${string}`, asset: ASSET, amount: toMicroUnits(amount) },
            { participant: mmAddress as `0x${string}`, asset: ASSET, amount: '0' },
          ],
        });
      } catch (err) {
        ctx.log.error('p2p-order-rejection-close', err);
      }
      return reply.status(400).send({ error: `Invalid outcome. Must be one of: ${outcomes.join(', ')}` });
    }

    try {
    // Place order via OrderBookManager
    const result = ctx.orderBookManager.placeOrder({
      marketId, gameId, userAddress, outcome, mcps, amount,
      appSessionId, appSessionVersion,
    }, outcomes);

    // Create position (mode='p2p')
    ctx.positionTracker.addPosition({
      address: userAddress,
      marketId,
      outcome,
      shares: result.order.filledShares,
      costPaid: result.order.filledAmount,
      appSessionId,
      appSessionVersion,
      sessionStatus: 'open',
      mode: 'p2p',
      timestamp: Date.now(),
    });

    // Broadcast position added (Fix 7)
    const positionCount = ctx.positionTracker.getPositionsByMarket(marketId).length;
    ctx.ws.broadcast({
      type: 'POSITION_ADDED',
      position: {
        address: userAddress,
        marketId,
        outcome,
        shares: result.order.filledShares,
        costPaid: result.order.filledAmount,
        appSessionId,
        appSessionVersion,
        sessionStatus: 'open',
        mode: 'p2p',
        timestamp: Date.now(),
      },
      positionCount,
    });

    // Record user bet stat
    ctx.userTracker.recordBet(userAddress, amount);

    // Log
    ctx.log.orderPlaced(userAddress, outcome, mcps, amount, result.orderId);

    // For each fill, update Clearnode sessions and log
    for (const fill of result.fills) {
      try {
        const mmAddress = ctx.clearnodeClient.getAddress();
        // Update incoming user's session: reallocate filled cost to MM
        await ctx.clearnodeClient.submitAppState({
          appSessionId: appSessionId as `0x${string}`,
          intent: 'operate',
          version: appSessionVersion + 1,
          allocations: [
            { participant: userAddress as `0x${string}`, asset: ASSET, amount: toMicroUnits(amount - fill.cost) },
            { participant: mmAddress as `0x${string}`, asset: ASSET, amount: toMicroUnits(fill.cost) },
          ],
        });
      } catch (err) {
        ctx.log.error('p2p-fill-session-update', err);
      }

      ctx.log.orderFilled(result.orderId, fill.shares, fill.effectivePrice, fill.counterpartyAddress);
    }

    // Broadcast order placed
    ctx.ws.broadcast({
      type: 'ORDER_PLACED',
      orderId: result.orderId,
      marketId,
      outcome,
      mcps,
      amount,
      maxShares: result.order.maxShares,
      status: result.order.status,
    });

    // Broadcast depth update
    const depth = ctx.orderBookManager.getDepth(marketId, outcomes);
    ctx.ws.broadcast({
      type: 'ORDERBOOK_UPDATE',
      marketId,
      outcomes: depth.outcomes,
    });

    // Send fill notifications to matched users
    for (const fill of result.fills) {
      ctx.ws.sendTo(fill.counterpartyAddress, {
        type: 'ORDER_FILLED',
        orderId: fill.counterpartyOrderId,
        fillId: fill.fillId,
        counterpartyOrderId: result.orderId,
        shares: fill.shares,
        effectivePrice: fill.effectivePrice,
        cost: fill.cost,
      });
    }

    return {
      orderId: result.orderId,
      status: result.order.status,
      fills: result.fills,
      order: result.order,
    };
    } catch (err) {
      ctx.log.error('p2p-place-order', err);
      return reply.status(400).send({ error: (err as Error).message ?? 'Order placement failed' });
    }
  });

  // ── DELETE /api/orderbook/order/:orderId — Cancel order ───────────────
  app.delete<{ Params: CancelOrderParams }>('/api/orderbook/order/:orderId', async (req, reply) => {
    const { orderId } = req.params;

    const order = ctx.orderBookManager.getOrder(orderId);
    if (!order) {
      return reply.status(404).send({ error: 'Order not found' });
    }

    if (order.status !== 'OPEN' && order.status !== 'PARTIALLY_FILLED') {
      return reply.status(400).send({ error: `Cannot cancel order with status ${order.status}` });
    }

    const cancelled = ctx.orderBookManager.cancelOrder(orderId);

    // If fully unfilled, close session to return all funds
    if (cancelled.filledShares === 0) {
      try {
        const mmAddress = ctx.clearnodeClient.getAddress();
        await ctx.clearnodeClient.closeSession({
          appSessionId: cancelled.appSessionId as `0x${string}`,
          allocations: [
            { participant: cancelled.userAddress as `0x${string}`, asset: ASSET, amount: toMicroUnits(cancelled.amount) },
            { participant: mmAddress as `0x${string}`, asset: ASSET, amount: '0' },
          ],
        });
      } catch (err) {
        ctx.log.error('p2p-cancel-close-session', err);
      }
    }

    ctx.log.orderCancelled(orderId, cancelled.userAddress);

    // Look up category for depth broadcast
    const market = ctx.marketManager.getMarket(cancelled.marketId);
    if (market) {
      const category = ctx.db.select().from(marketCategories)
        .where(eq(marketCategories.id, market.categoryId))
        .get();
      const outcomes: string[] = category ? JSON.parse(category.outcomes) : [];

      const depth = ctx.orderBookManager.getDepth(cancelled.marketId, outcomes);
      ctx.ws.broadcast({
        type: 'ORDERBOOK_UPDATE',
        marketId: cancelled.marketId,
        outcomes: depth.outcomes,
      });
    }

    ctx.ws.broadcast({
      type: 'ORDER_CANCELLED',
      orderId,
      marketId: cancelled.marketId,
    });

    return { order: cancelled };
  });

  // ── GET /api/orderbook/depth/:marketId — Get depth ────────────────────
  app.get<{ Params: DepthParams }>('/api/orderbook/depth/:marketId', async (req, reply) => {
    const { marketId } = req.params;

    const market = ctx.marketManager.getMarket(marketId);
    if (!market) {
      return reply.status(404).send({ error: 'Market not found' });
    }

    const category = ctx.db.select().from(marketCategories)
      .where(eq(marketCategories.id, market.categoryId))
      .get();
    const outcomes: string[] = category ? JSON.parse(category.outcomes) : [];

    const depth = ctx.orderBookManager.getDepth(marketId, outcomes);
    return depth;
  });

  // ── GET /api/orderbook/orders/:address — Get user's P2P orders ────────
  app.get<{ Params: UserOrdersParams; Querystring: UserOrdersQuery }>('/api/orderbook/orders/:address', async (req) => {
    const { address } = req.params;
    const { marketId } = req.query;

    const orders = ctx.orderBookManager.getOrdersByUser(address, marketId);
    return { orders };
  });
}
