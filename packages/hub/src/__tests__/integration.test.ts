import { buildApp } from '../app.js';
import { createTestContext } from '../context.js';
import { resetMarketCounter } from '../api/oracle.routes.js';
import type { AppContext } from '../context.js';
import type { FastifyInstance } from 'fastify';
import WebSocket from 'ws';

describe('Integration Tests', () => {
  let app: FastifyInstance;
  let ctx: AppContext;
  let baseUrl: string;
  let openSockets: WebSocket[];

  beforeEach(async () => {
    openSockets = [];
    resetMarketCounter();
    ctx = createTestContext();
    app = await buildApp(ctx);
    await app.listen({ port: 0 });
    const addr = app.server.address() as { port: number };
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterEach(async () => {
    for (const ws of openSockets) {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    }
    await app.close();
  });

  // Helper methods using fetch-style via inject (app is listening but we can still inject)
  async function post(url: string, body?: any) {
    return app.inject({ method: 'POST', url, payload: body });
  }
  async function get(url: string) {
    return app.inject({ method: 'GET', url });
  }

  async function activateAndOpen() {
    await post('/api/oracle/game-state', { active: true });
    const res = await post('/api/oracle/market/open');
    return res.json().marketId as string;
  }

  async function placeBet(address: string, marketId: string, outcome: string, amount: number) {
    return post('/api/bet', {
      address,
      marketId,
      outcome,
      amount,
      appSessionId: `sess-${address}`,
      appSessionVersion: 1,
    });
  }

  test('complete flow: open → bet → close → resolve winner', async () => {
    const marketId = await activateAndOpen();
    const betRes = await placeBet('0xAlice', marketId, 'BALL', 10);
    expect(betRes.json().accepted).toBe(true);

    await post('/api/oracle/market/close');
    const resolveRes = await post('/api/oracle/outcome', { outcome: 'BALL' });
    const body = resolveRes.json();
    expect(body.success).toBe(true);
    expect(body.winners).toBe(1);
    expect(body.losers).toBe(0);
  });

  test('complete flow: open → bet → close → resolve loser', async () => {
    const marketId = await activateAndOpen();
    await placeBet('0xAlice', marketId, 'BALL', 10);
    await post('/api/oracle/market/close');

    const resolveRes = await post('/api/oracle/outcome', { outcome: 'STRIKE' });
    expect(resolveRes.json().winners).toBe(0);
    expect(resolveRes.json().losers).toBe(1);
  });

  test('multiple bets: 2 winners and 1 loser (correct counts + payout)', async () => {
    const marketId = await activateAndOpen();
    await placeBet('0xAlice', marketId, 'BALL', 10);
    await placeBet('0xBob', marketId, 'BALL', 5);
    await placeBet('0xCharlie', marketId, 'STRIKE', 8);

    await post('/api/oracle/market/close');
    const res = await post('/api/oracle/outcome', { outcome: 'BALL' });
    const body = res.json();
    expect(body.winners).toBe(2);
    expect(body.losers).toBe(1);
    expect(body.totalPayout).toBeGreaterThan(0);
  });

  test('prices shift correctly through multiple bets', async () => {
    const marketId = await activateAndOpen();

    const m0 = await get('/api/market');
    expect(m0.json().priceBall).toBeCloseTo(0.5);

    await placeBet('0xAlice', marketId, 'BALL', 10);
    const m1 = await get('/api/market');
    expect(m1.json().priceBall).toBeGreaterThan(0.5);

    await placeBet('0xBob', marketId, 'STRIKE', 20);
    const m2 = await get('/api/market');
    // STRIKE bet should pull ball price back down
    expect(m2.json().priceBall).toBeLessThan(m1.json().priceBall);
  });

  test('market cycles: resolve one market, open a new one', async () => {
    const mId1 = await activateAndOpen();
    await post('/api/oracle/market/close');
    await post('/api/oracle/outcome', { outcome: 'BALL' });

    // Open a second market
    const res = await post('/api/oracle/market/open');
    const mId2 = res.json().marketId;
    expect(mId2).not.toBe(mId1);

    const market = (await get('/api/market')).json();
    expect(market.market.id).toBe(mId2);
    expect(market.market.status).toBe('OPEN');
  });

  test('positions are cleared after resolution', async () => {
    const marketId = await activateAndOpen();
    await placeBet('0xAlice', marketId, 'BALL', 10);

    // Positions exist before resolve
    const before = (await get(`/api/positions/0xAlice`)).json();
    expect(before.positions).toHaveLength(1);

    await post('/api/oracle/market/close');
    await post('/api/oracle/outcome', { outcome: 'BALL' });

    const after = (await get(`/api/positions/0xAlice`)).json();
    expect(after.positions).toHaveLength(0);
  });

  test('GET /api/market reflects state throughout full lifecycle', async () => {
    // No market
    expect((await get('/api/market')).json().market).toBeNull();

    const marketId = await activateAndOpen();
    expect((await get('/api/market')).json().market.status).toBe('OPEN');

    await post('/api/oracle/market/close');
    expect((await get('/api/market')).json().market.status).toBe('CLOSED');

    await post('/api/oracle/outcome', { outcome: 'STRIKE' });
    expect((await get('/api/market')).json().market.status).toBe('RESOLVED');
  });

  test('reset clears everything and allows fresh start', async () => {
    const marketId = await activateAndOpen();
    await placeBet('0xAlice', marketId, 'BALL', 10);

    await post('/api/admin/reset');
    const state = (await get('/api/admin/state')).json();
    expect(state.market).toBeNull();
    expect(state.gameState.active).toBe(false);
  });

  test('WebSocket ODDS_UPDATE broadcast on bet (real WS client)', async () => {
    const marketId = await activateAndOpen();
    const addr = app.server.address() as { port: number };
    const wsUrl = `ws://127.0.0.1:${addr.port}/ws`;

    const ws = new WebSocket(wsUrl);
    openSockets.push(ws);
    const messages: any[] = [];

    await new Promise<void>((resolve) => {
      ws.on('open', () => resolve());
    });

    ws.on('message', (data) => {
      messages.push(JSON.parse(data.toString()));
    });

    // Small delay to ensure WS is registered
    await new Promise((r) => setTimeout(r, 50));

    await placeBet('0xAlice', marketId, 'BALL', 10);

    // Wait for message delivery
    await new Promise((r) => setTimeout(r, 50));

    ws.close();
    expect(messages.some((m) => m.type === 'ODDS_UPDATE')).toBe(true);
  });

  test('WebSocket MARKET_STATUS broadcast on open/close/resolve', async () => {
    const addr = app.server.address() as { port: number };
    const ws = new WebSocket(`ws://127.0.0.1:${addr.port}/ws`);
    openSockets.push(ws);
    const messages: any[] = [];

    await new Promise<void>((resolve) => ws.on('open', () => resolve()));
    ws.on('message', (data) => messages.push(JSON.parse(data.toString())));
    await new Promise((r) => setTimeout(r, 50));

    await post('/api/oracle/game-state', { active: true });
    await post('/api/oracle/market/open');
    await post('/api/oracle/market/close');
    await post('/api/oracle/outcome', { outcome: 'BALL' });

    await new Promise((r) => setTimeout(r, 50));
    ws.close();

    const statuses = messages.filter((m) => m.type === 'MARKET_STATUS').map((m) => m.status);
    expect(statuses).toEqual(['OPEN', 'CLOSED', 'RESOLVED']);
  });

  test('concurrent bets processed correctly (Promise.all of 5 bets)', async () => {
    const marketId = await activateAndOpen();

    const bets = Array.from({ length: 5 }, (_, i) =>
      placeBet(`0xUser${i}`, marketId, i % 2 === 0 ? 'BALL' : 'STRIKE', 5),
    );

    const results = await Promise.all(bets);
    for (const res of results) {
      expect(res.json().accepted).toBe(true);
    }

    // All 5 positions should be recorded
    const market = ctx.marketManager.getMarket(marketId)!;
    expect(market.qBall).toBeGreaterThan(0);
    expect(market.qStrike).toBeGreaterThan(0);
  });

  test('betting on a resolved market is rejected', async () => {
    const marketId = await activateAndOpen();
    await post('/api/oracle/market/close');
    await post('/api/oracle/outcome', { outcome: 'BALL' });

    const res = await placeBet('0xAlice', marketId, 'BALL', 10);
    expect(res.json().accepted).toBe(false);
  });
});
