import { buildApp } from '../app.js';
import { createTestContext, DEFAULT_TEST_GAME_ID, DEFAULT_TEST_CATEGORY_ID } from '../context.js';
import type { AppContext } from '../context.js';
import type { FastifyInstance } from 'fastify';

describe('OrderBook Routes', () => {
  let app: FastifyInstance;
  let ctx: AppContext;
  let marketId: string;

  beforeEach(async () => {
    ctx = createTestContext();
    app = await buildApp(ctx);
    marketId = '';
  });

  afterEach(async () => {
    await app.close();
  });

  function openMarket(): string {
    const market = ctx.marketManager.createMarket(DEFAULT_TEST_GAME_ID, DEFAULT_TEST_CATEGORY_ID);
    ctx.marketManager.openMarket(market.id);
    marketId = market.id;
    return marketId;
  }

  function validOrder(overrides: Record<string, any> = {}) {
    return {
      marketId,
      gameId: DEFAULT_TEST_GAME_ID,
      userAddress: '0xAlice',
      outcome: 'BALL',
      mcps: 0.60,
      amount: 6,
      appSessionId: `sess-${Math.random().toString(36).slice(2, 8)}`,
      appSessionVersion: 1,
      ...overrides,
    };
  }

  async function placeOrder(body: any) {
    return app.inject({
      method: 'POST',
      url: '/api/orderbook/order',
      payload: body,
    });
  }

  async function cancelOrder(orderId: string) {
    return app.inject({
      method: 'DELETE',
      url: `/api/orderbook/order/${orderId}`,
    });
  }

  async function getDepth(mId: string) {
    return app.inject({
      method: 'GET',
      url: `/api/orderbook/depth/${mId}`,
    });
  }

  async function getUserOrders(address: string, mId?: string) {
    const url = mId
      ? `/api/orderbook/orders/${address}?marketId=${mId}`
      : `/api/orderbook/orders/${address}`;
    return app.inject({ method: 'GET', url });
  }

  // ── Validation ──────────────────────────────────────────────────────────

  describe('POST /api/orderbook/order — validation', () => {
    test('rejects missing required fields', async () => {
      openMarket();
      const res = await placeOrder({});
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatch(/Missing required fields/);
    });

    test('rejects MCPS out of range (0)', async () => {
      openMarket();
      const res = await placeOrder(validOrder({ mcps: 0 }));
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatch(/MCPS/);
    });

    test('rejects MCPS out of range (1)', async () => {
      openMarket();
      const res = await placeOrder(validOrder({ mcps: 1 }));
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatch(/MCPS/);
    });

    test('rejects negative amount', async () => {
      openMarket();
      const res = await placeOrder(validOrder({ amount: -5 }));
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatch(/Amount/);
    });

    test('rejects when market not found', async () => {
      const res = await placeOrder(validOrder({ marketId: 'nonexistent' }));
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatch(/Market not found/);
    });

    test('rejects when market is not OPEN', async () => {
      openMarket();
      ctx.marketManager.closeMarket(marketId);
      const res = await placeOrder(validOrder());
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatch(/CLOSED/);
    });

    test('rejects invalid outcome', async () => {
      openMarket();
      const res = await placeOrder(validOrder({ outcome: 'FOUL' }));
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatch(/Invalid outcome/);
    });

    test('closes session on rejection', async () => {
      openMarket();
      ctx.marketManager.closeMarket(marketId);
      await placeOrder(validOrder());
      expect(ctx.clearnodeClient.closeSession).toHaveBeenCalled();
    });
  });

  // ── Successful placement ─────────────────────────────────────────────

  describe('POST /api/orderbook/order — success', () => {
    test('places order into empty book', async () => {
      openMarket();
      const res = await placeOrder(validOrder());
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.orderId).toBeDefined();
      expect(body.status).toBe('OPEN');
      expect(body.fills).toHaveLength(0);
      expect(body.order.mcps).toBe(0.60);
    });

    test('creates position with mode p2p', async () => {
      openMarket();
      await placeOrder(validOrder());
      const positions = ctx.positionTracker.getPositionsByUser('0xAlice');
      expect(positions).toHaveLength(1);
      expect(positions[0].mode).toBe('p2p');
    });

    test('records user bet stat', async () => {
      openMarket();
      await placeOrder(validOrder({ amount: 10 }));
      const user = ctx.userTracker.getUser('0xAlice');
      expect(user).toBeDefined();
      expect(user!.totalBets).toBe(1);
      expect(user!.totalWagered).toBe(10);
    });

    test('fills immediately when matching order exists', async () => {
      openMarket();
      // Place BALL order
      await placeOrder(validOrder({
        userAddress: '0xAlice',
        outcome: 'BALL',
        mcps: 0.60,
        amount: 6,
      }));

      // Place matching STRIKE order
      const res = await placeOrder(validOrder({
        userAddress: '0xBob',
        outcome: 'STRIKE',
        mcps: 0.40,
        amount: 4,
      }));

      const body = res.json();
      expect(body.status).toBe('FILLED');
      expect(body.fills).toHaveLength(1);
      expect(body.fills[0].shares).toBe(10);
    });

    test('broadcasts ORDER_PLACED and ORDERBOOK_UPDATE', async () => {
      openMarket();
      const broadcastSpy = jest.spyOn(ctx.ws, 'broadcast');

      await placeOrder(validOrder());

      const types = broadcastSpy.mock.calls.map(([msg]) => msg.type);
      expect(types).toContain('ORDER_PLACED');
      expect(types).toContain('ORDERBOOK_UPDATE');
    });

    test('sends ORDER_FILLED to matched user', async () => {
      openMarket();
      const sendToSpy = jest.spyOn(ctx.ws, 'sendTo');

      await placeOrder(validOrder({
        userAddress: '0xAlice',
        outcome: 'BALL',
        mcps: 0.50,
        amount: 5,
      }));

      await placeOrder(validOrder({
        userAddress: '0xBob',
        outcome: 'STRIKE',
        mcps: 0.50,
        amount: 5,
      }));

      // Alice should receive ORDER_FILLED notification
      const aliceCalls = sendToSpy.mock.calls.filter(
        ([addr]) => addr === '0xAlice'
      );
      expect(aliceCalls.length).toBeGreaterThan(0);
      expect(aliceCalls[0][1]).toMatchObject({ type: 'ORDER_FILLED' });
    });
  });

  // ── Cancel ──────────────────────────────────────────────────────────

  describe('DELETE /api/orderbook/order/:orderId', () => {
    test('cancels an open order', async () => {
      openMarket();
      const placeRes = await placeOrder(validOrder());
      const { orderId } = placeRes.json();

      const res = await cancelOrder(orderId);
      expect(res.statusCode).toBe(200);
      expect(res.json().order.status).toBe('CANCELLED');
    });

    test('returns 404 for nonexistent order', async () => {
      const res = await cancelOrder('nonexistent');
      expect(res.statusCode).toBe(404);
    });

    test('returns 400 for already filled order', async () => {
      openMarket();
      const r1 = await placeOrder(validOrder({
        userAddress: '0xAlice',
        outcome: 'BALL',
        mcps: 0.50,
        amount: 5,
      }));

      await placeOrder(validOrder({
        userAddress: '0xBob',
        outcome: 'STRIKE',
        mcps: 0.50,
        amount: 5,
      }));

      const res = await cancelOrder(r1.json().orderId);
      expect(res.statusCode).toBe(400);
    });

    test('closes session for fully unfilled cancel', async () => {
      openMarket();
      const placeRes = await placeOrder(validOrder());
      const { orderId } = placeRes.json();

      // Reset mock to track cancel-specific call
      (ctx.clearnodeClient.closeSession as jest.Mock).mockClear();

      await cancelOrder(orderId);
      expect(ctx.clearnodeClient.closeSession).toHaveBeenCalled();
    });

    test('broadcasts ORDER_CANCELLED and ORDERBOOK_UPDATE', async () => {
      openMarket();
      const placeRes = await placeOrder(validOrder());
      const { orderId } = placeRes.json();
      const broadcastSpy = jest.spyOn(ctx.ws, 'broadcast');
      broadcastSpy.mockClear();

      await cancelOrder(orderId);

      const types = broadcastSpy.mock.calls.map(([msg]) => msg.type);
      expect(types).toContain('ORDER_CANCELLED');
      expect(types).toContain('ORDERBOOK_UPDATE');
    });
  });

  // ── Depth ─────────────────────────────────────────────────────────

  describe('GET /api/orderbook/depth/:marketId', () => {
    test('returns empty depth for empty book', async () => {
      openMarket();
      const res = await getDepth(marketId);
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.outcomes.BALL).toEqual([]);
      expect(body.outcomes.STRIKE).toEqual([]);
    });

    test('returns depth after orders placed', async () => {
      openMarket();
      await placeOrder(validOrder({ mcps: 0.60, amount: 6 }));

      const res = await getDepth(marketId);
      const body = res.json();
      expect(body.outcomes.BALL).toHaveLength(1);
      expect(body.outcomes.BALL[0].price).toBe(0.60);
    });

    test('returns 404 for nonexistent market', async () => {
      const res = await getDepth('nonexistent');
      expect(res.statusCode).toBe(404);
    });
  });

  // ── User orders ───────────────────────────────────────────────────

  describe('GET /api/orderbook/orders/:address', () => {
    test('returns user orders', async () => {
      openMarket();
      await placeOrder(validOrder({ userAddress: '0xAlice' }));
      await placeOrder(validOrder({ userAddress: '0xAlice', outcome: 'STRIKE' }));

      const res = await getUserOrders('0xAlice');
      expect(res.statusCode).toBe(200);
      expect(res.json().orders).toHaveLength(2);
    });

    test('returns empty for user with no orders', async () => {
      const res = await getUserOrders('0xNobody');
      expect(res.json().orders).toHaveLength(0);
    });

    test('filters by marketId query param', async () => {
      openMarket();
      await placeOrder(validOrder({ userAddress: '0xAlice' }));

      const res = await getUserOrders('0xAlice', marketId);
      expect(res.json().orders).toHaveLength(1);

      const res2 = await getUserOrders('0xAlice', 'other-market');
      expect(res2.json().orders).toHaveLength(0);
    });
  });
});
