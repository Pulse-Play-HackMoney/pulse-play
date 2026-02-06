import { buildApp } from '../app.js';
import { createTestContext } from '../context.js';
import type { AppContext } from '../context.js';
import type { FastifyInstance } from 'fastify';

describe('Position Routes', () => {
  let app: FastifyInstance;
  let ctx: AppContext;

  beforeEach(async () => {
    ctx = createTestContext();
    app = await buildApp(ctx);
  });

  afterEach(async () => {
    await app.close();
  });

  test('returns empty array when user has no positions', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/positions/0xAlice' });
    expect(res.json().positions).toEqual([]);
  });

  test('returns positions for user with one bet', async () => {
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

    const res = await app.inject({ method: 'GET', url: '/api/positions/0xAlice' });
    const body = res.json();
    expect(body.positions).toHaveLength(1);
    expect(body.positions[0].marketId).toBe('m1');
    expect(body.positions[0].outcome).toBe('BALL');
  });

  test('returns positions for user with multiple bets across markets', async () => {
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
      address: '0xAlice',
      marketId: 'm2',
      outcome: 'STRIKE',
      shares: 3,
      costPaid: 1.5,
      appSessionId: 'sess2',
      appSessionVersion: 1,
      sessionStatus: 'open',
      timestamp: 2000,
    });

    const res = await app.inject({ method: 'GET', url: '/api/positions/0xAlice' });
    expect(res.json().positions).toHaveLength(2);
  });

  test('returns only positions for requested address', async () => {
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

    const res = await app.inject({ method: 'GET', url: '/api/positions/0xAlice' });
    const positions = res.json().positions;
    expect(positions).toHaveLength(1);
    expect(positions[0].outcome).toBe('BALL');
  });

  test('position objects contain all required fields', async () => {
    ctx.positionTracker.addPosition({
      address: '0xAlice',
      marketId: 'm1',
      outcome: 'BALL',
      shares: 5.5,
      costPaid: 2.75,
      appSessionId: 'sess1',
      appSessionVersion: 1,
      sessionStatus: 'open',
      timestamp: 12345,
    });

    const res = await app.inject({ method: 'GET', url: '/api/positions/0xAlice' });
    const pos = res.json().positions[0];
    expect(pos).toEqual({
      marketId: 'm1',
      outcome: 'BALL',
      shares: 5.5,
      costPaid: 2.75,
      appSessionId: 'sess1',
      appSessionVersion: 1,
      sessionStatus: 'open',
      timestamp: 12345,
    });
  });
});
