import { buildApp } from '../app.js';
import { createTestContext } from '../context.js';
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
    ctx.marketManager.createMarket('m1');
    ctx.marketManager.openMarket('m1');
    ctx.positionTracker.addPosition({
      address: '0xAlice',
      marketId: 'm1',
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
    expect(body.market.id).toBe('m1');
    expect(body.positionCount).toBe(1);
  });

  test('includes gameState in response', async () => {
    ctx.oracle.setGameActive(true);
    const res = await app.inject({ method: 'GET', url: '/api/admin/state' });
    expect(res.json().gameState).toEqual({ active: true });
  });

  test('reset clears all state to clean', async () => {
    ctx.marketManager.createMarket('m1');
    ctx.marketManager.openMarket('m1');
    ctx.oracle.setGameActive(true);

    await app.inject({ method: 'POST', url: '/api/admin/reset' });

    const res = await app.inject({ method: 'GET', url: '/api/admin/state' });
    const body = res.json();
    expect(body.market).toBeNull();
    expect(body.gameState.active).toBe(false);
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
      ctx.positionTracker.addPosition({
        address: '0xAlice',
        marketId: 'm1',
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
        marketId: 'm1',
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
        marketId: 'm2', // Different market
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
        url: '/api/admin/positions/m1',
      });
      expect(res.statusCode).toBe(200);
      const { positions } = res.json();
      expect(positions).toHaveLength(2);
      expect(positions[0].address).toBe('0xAlice');
      expect(positions[1].address).toBe('0xBob');
    });

    test('returns all position fields', async () => {
      ctx.positionTracker.addPosition({
        address: '0xAlice',
        marketId: 'm1',
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
        url: '/api/admin/positions/m1',
      });
      const { positions } = res.json();
      expect(positions[0]).toEqual({
        address: '0xAlice',
        marketId: 'm1',
        outcome: 'BALL',
        shares: 5.5,
        costPaid: 2.75,
        appSessionId: 'sess1',
        appSessionVersion: 1,
        sessionStatus: 'open',
        timestamp: 1234567890,
      });
    });
  });
});
