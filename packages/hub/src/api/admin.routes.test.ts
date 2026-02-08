import { buildApp } from '../app.js';
import { createTestContext, DEFAULT_TEST_GAME_ID } from '../context.js';
import type { AppContext } from '../context.js';
import type { FastifyInstance } from 'fastify';

describe('Admin Routes', () => {
  let app: FastifyInstance;
  let ctx: AppContext;

  beforeEach(async () => {
    ctx = createTestContext();
    app = await buildApp(ctx);
  });

  afterEach(async () => {
    await app.close();
  });

  test('returns full state with no market', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/state' });
    const body = res.json();
    expect(body.market).toBeNull();
    expect(body.positionCount).toBe(0);
    expect(body.connectionCount).toBe(0);
  });

  test('returns full state with active market and positions', async () => {
    const market = ctx.marketManager.createMarket(DEFAULT_TEST_GAME_ID, 'pitching');
    ctx.marketManager.openMarket(market.id);
    ctx.positionTracker.addPosition({
      address: '0xAlice',
      marketId: market.id,
      outcome: 'BALL',
      shares: 5,
      costPaid: 2.5,
      appSessionId: 'sess1',
      appSessionVersion: 1,
      sessionStatus: 'open',
      timestamp: 1000,
    });

    const res = await app.inject({ method: 'GET', url: '/api/admin/state' });
    const body = res.json();
    expect(body.market).not.toBeNull();
    expect(body.market.id).toBe('test-game-pitching-1');
    expect(body.positionCount).toBe(1);
  });

  test('includes gameState in response', async () => {
    ctx.oracle.setGameActive(true);
    const res = await app.inject({ method: 'GET', url: '/api/admin/state' });
    expect(res.json().gameState).toEqual({ active: true });
  });

  test('reset clears all state to clean', async () => {
    const market = ctx.marketManager.createMarket(DEFAULT_TEST_GAME_ID, 'pitching');
    ctx.marketManager.openMarket(market.id);
    ctx.oracle.setGameActive(true);

    await app.inject({ method: 'POST', url: '/api/admin/reset' });

    const res = await app.inject({ method: 'GET', url: '/api/admin/state' });
    const body = res.json();
    expect(body.market).toBeNull();
    expect(body.gameState.active).toBe(false);
  });

  test('reset re-seeds sports and categories so new markets can be created', async () => {
    await app.inject({ method: 'POST', url: '/api/admin/reset' });

    // After reset, the game is gone but sports+categories are re-seeded.
    // Re-create the game so we can create a new market.
    ctx.gameManager.createGame('baseball', 'nyy', 'bos', 'post-reset-game');

    // Market sequence resets because all markets were deleted
    const market = ctx.marketManager.createMarket('post-reset-game', 'pitching');
    expect(market.id).toBe('post-reset-game-pitching-1');
    expect(market.status).toBe('PENDING');
  });

  test('reset returns success', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/admin/reset' });
    expect(res.json().success).toBe(true);
  });

  test('reset stops auto-play if running', async () => {
    const spy = jest.spyOn(ctx.oracle, 'stopAutoPlay');
    await app.inject({ method: 'POST', url: '/api/admin/reset' });
    expect(spy).toHaveBeenCalled();
  });

  describe('GET /api/admin/positions/:marketId', () => {
    test('returns empty array for non-existent market', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/positions/non-existent',
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().positions).toEqual([]);
    });

    test('returns positions for market', async () => {
      // Create two markets so positions can reference them via FK
      const m1 = ctx.marketManager.createMarket(DEFAULT_TEST_GAME_ID, 'pitching');
      const m2 = ctx.marketManager.createMarket(DEFAULT_TEST_GAME_ID, 'pitching');

      ctx.positionTracker.addPosition({
        address: '0xAlice',
        marketId: m1.id,
        outcome: 'BALL',
        shares: 5,
        costPaid: 2.5,
        appSessionId: 'sess1',
        appSessionVersion: 1,
        sessionStatus: 'open',
        timestamp: 1000,
      });
      ctx.positionTracker.addPosition({
        address: '0xBob',
        marketId: m1.id,
        outcome: 'STRIKE',
        shares: 3,
        costPaid: 1.5,
        appSessionId: 'sess2',
        appSessionVersion: 1,
        sessionStatus: 'open',
        timestamp: 2000,
      });
      ctx.positionTracker.addPosition({
        address: '0xCharlie',
        marketId: m2.id, // Different market
        outcome: 'BALL',
        shares: 10,
        costPaid: 5.0,
        appSessionId: 'sess3',
        appSessionVersion: 1,
        sessionStatus: 'open',
        timestamp: 3000,
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/admin/positions/${m1.id}`,
      });
      expect(res.statusCode).toBe(200);
      const { positions } = res.json();
      expect(positions).toHaveLength(2);
      expect(positions[0].address).toBe('0xAlice');
      expect(positions[1].address).toBe('0xBob');
    });

    test('returns all position fields', async () => {
      const market = ctx.marketManager.createMarket(DEFAULT_TEST_GAME_ID, 'pitching');

      ctx.positionTracker.addPosition({
        address: '0xAlice',
        marketId: market.id,
        outcome: 'BALL',
        shares: 5.5,
        costPaid: 2.75,
        appSessionId: 'sess1',
        appSessionVersion: 1,
        sessionStatus: 'open',
        timestamp: 1234567890,
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/admin/positions/${market.id}`,
      });
      const { positions } = res.json();
      expect(positions[0]).toEqual({
        address: '0xAlice',
        marketId: market.id,
        outcome: 'BALL',
        shares: 5.5,
        costPaid: 2.75,
        fee: 0,
        appSessionId: 'sess1',
        appSessionVersion: 1,
        sessionStatus: 'open',
        mode: 'lmsr',
        timestamp: 1234567890,
      });
    });
  });

  // ── Config endpoints ──

  describe('config endpoints', () => {
    test('GET /api/admin/config returns transactionFeePercent', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/admin/config' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ transactionFeePercent: 1 });
    });

    test('POST /api/admin/config updates transactionFeePercent', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/config',
        payload: { transactionFeePercent: 2.5 },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ success: true, transactionFeePercent: 2.5 });
      expect(ctx.transactionFeePercent).toBe(2.5);
    });

    test('POST /api/admin/config broadcasts CONFIG_UPDATED', async () => {
      const spy = jest.spyOn(ctx.ws, 'broadcast');
      await app.inject({
        method: 'POST',
        url: '/api/admin/config',
        payload: { transactionFeePercent: 0.5 },
      });
      expect(spy).toHaveBeenCalledWith({
        type: 'CONFIG_UPDATED',
        transactionFeePercent: 0.5,
      });
    });

    test('POST /api/admin/config returns 400 for invalid value', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/config',
        payload: { transactionFeePercent: -1 },
      });
      expect(res.statusCode).toBe(400);
    });

    test('POST /api/admin/config returns 400 for value > 100', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/config',
        payload: { transactionFeePercent: 101 },
      });
      expect(res.statusCode).toBe(400);
    });

    test('POST /api/admin/config returns 400 for non-number', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/config',
        payload: { transactionFeePercent: 'abc' },
      });
      expect(res.statusCode).toBe(400);
    });
  });
});
