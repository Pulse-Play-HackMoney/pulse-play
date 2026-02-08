import { buildApp } from '../app.js';
import { createTestContext, DEFAULT_TEST_GAME_ID, DEFAULT_TEST_CATEGORY_ID } from '../context.js';
import type { AppContext } from '../context.js';
import type { FastifyInstance } from 'fastify';

const GAME_ID = DEFAULT_TEST_GAME_ID;
const CATEGORY_ID = DEFAULT_TEST_CATEGORY_ID;

describe('LP Integration Tests', () => {
  let app: FastifyInstance;
  let ctx: AppContext;

  beforeEach(async () => {
    ctx = createTestContext();
    app = await buildApp(ctx);
    await app.listen({ port: 0 });
  });

  afterEach(async () => {
    await app.close();
  });

  async function post(url: string, body?: any) {
    return app.inject({ method: 'POST', url, payload: body });
  }
  async function get(url: string) {
    return app.inject({ method: 'GET', url });
  }

  async function activateAndOpen() {
    await post('/api/oracle/game-state', { active: true });
    const res = await post('/api/oracle/market/open', { gameId: GAME_ID, categoryId: CATEGORY_ID });
    return res.json().marketId as string;
  }

  // ── Test 1: Deposit → verify shares → deposit again → verify accumulation ──

  test('deposit creates shares and subsequent deposits accumulate', async () => {
    // First deposit
    const dep1 = await post('/api/lp/deposit', { address: '0xLP1', amount: 1000 });
    expect(dep1.statusCode).toBe(200);
    const dep1Body = dep1.json();
    expect(dep1Body.success).toBe(true);
    expect(dep1Body.shares).toBe(1000); // First deposit: sharePrice=1, shares=1000

    // Verify share
    const share1 = await get('/api/lp/share/0xLP1');
    expect(share1.statusCode).toBe(200);
    const share1Body = share1.json();
    expect(share1Body.shares).toBe(1000);
    expect(share1Body.totalDeposited).toBe(1000);

    // Second deposit
    const dep2 = await post('/api/lp/deposit', { address: '0xLP1', amount: 500 });
    expect(dep2.statusCode).toBe(200);
    const dep2Body = dep2.json();
    expect(dep2Body.success).toBe(true);

    // Verify accumulated shares
    const share2 = await get('/api/lp/share/0xLP1');
    const share2Body = share2.json();
    expect(share2Body.totalDeposited).toBe(1500);
    expect(share2Body.shares).toBeGreaterThan(1000); // Should have more shares now
  });

  // ── Test 2: Multiple LPs → pool stats reflect all ──

  test('multiple LPs tracked in pool stats', async () => {
    // Mock getBalance to reflect cumulative deposits (user transfers before calling deposit route)
    let poolBalance = 0;
    (ctx.clearnodeClient.getBalance as jest.Mock).mockImplementation(() => {
      return Promise.resolve(String(poolBalance * 1_000_000));
    });

    // LP1 transfers $1000 → balance = 1000
    poolBalance = 1000;
    await post('/api/lp/deposit', { address: '0xLP1', amount: 1000 });
    // LP2 transfers $500 → balance = 1500
    poolBalance = 1500;
    await post('/api/lp/deposit', { address: '0xLP2', amount: 500 });
    // LP3 transfers $250 → balance = 1750
    poolBalance = 1750;
    await post('/api/lp/deposit', { address: '0xLP3', amount: 250 });

    const stats = await get('/api/lp/stats');
    const statsBody = stats.json();
    expect(statsBody.lpCount).toBe(3);
    // All deposits at sharePrice=1.0 since pool grows proportionally:
    // LP1: 1000 shares @ $1.00, LP2: 500 shares @ $1.00, LP3: 250 shares @ $1.00
    expect(statsBody.totalShares).toBe(1750);
    expect(statsBody.sharePrice).toBe(1.0);
  });

  // ── Test 3: Withdrawal lock — deposit → open market → withdraw rejected → resolve → withdraw succeeds ──

  test('withdrawals locked during open market, unlocked after resolution', async () => {
    // Deposit
    await post('/api/lp/deposit', { address: '0xLP1', amount: 1000 });

    // Open a market
    await activateAndOpen();

    // Verify withdrawals are locked
    const stats1 = await get('/api/lp/stats');
    expect(stats1.json().canWithdraw).toBe(false);

    // Attempt withdrawal — should fail (403 = locked)
    const withdrawRes = await post('/api/lp/withdraw', { address: '0xLP1', shares: 100 });
    expect(withdrawRes.statusCode).toBe(403);

    // Close and resolve market
    await post('/api/oracle/market/close', { gameId: GAME_ID, categoryId: CATEGORY_ID });
    await post('/api/oracle/outcome', { outcome: 'BALL', gameId: GAME_ID, categoryId: CATEGORY_ID });

    // Now withdrawals should be allowed
    const stats2 = await get('/api/lp/stats');
    expect(stats2.json().canWithdraw).toBe(true);

    // Withdrawal succeeds
    const withdrawRes2 = await post('/api/lp/withdraw', { address: '0xLP1', shares: 100 });
    expect(withdrawRes2.statusCode).toBe(200);
    expect(withdrawRes2.json().success).toBe(true);
  });

  // ── Test 4: b-parameter auto-scaling ──

  test('market open auto-scales b from pool value', async () => {
    // Deposit to set pool value
    await post('/api/lp/deposit', { address: '0xLP1', amount: 5000 });

    // Open a market — b should be scaled from pool value
    await post('/api/oracle/game-state', { active: true });
    const openRes = await post('/api/oracle/market/open', { gameId: GAME_ID, categoryId: CATEGORY_ID });
    const marketId = openRes.json().marketId;

    // Get market details to verify b
    const marketRes = await get(`/api/market/${marketId}`);
    const market = marketRes.json().market;

    // Mock getBalance returns '1000000000' = $1000
    // b = poolValue * sensitivityFactor = 1000 * 0.01 = 10
    expect(market.b).toBe(10);
  });

  // ── Test 5: Events audit trail ──

  test('events recorded for deposit/withdrawal sequence', async () => {
    await post('/api/lp/deposit', { address: '0xLP1', amount: 1000 });
    await post('/api/lp/deposit', { address: '0xLP1', amount: 500 });
    await post('/api/lp/withdraw', { address: '0xLP1', shares: 200 });

    const eventsRes = await get('/api/lp/events?address=0xLP1');
    expect(eventsRes.statusCode).toBe(200);
    const events = eventsRes.json().events;

    expect(events).toHaveLength(3);
    // Events ordered by id desc (most recent first)
    expect(events[0].type).toBe('WITHDRAWAL');
    expect(events[1].type).toBe('DEPOSIT');
    expect(events[2].type).toBe('DEPOSIT');

    // Verify audit trail values
    expect(events[2].amount).toBe(1000); // First deposit
    expect(events[1].amount).toBe(500);  // Second deposit
    expect(events[0].shares).toBe(200);  // Withdrawal shares
  });

  // ── Test 6: Pool stats with no LPs ──

  test('pool stats returns zero values with no LPs', async () => {
    const stats = await get('/api/lp/stats');
    const body = stats.json();
    expect(body.poolValue).toBeGreaterThanOrEqual(0);
    expect(body.totalShares).toBe(0);
    expect(body.sharePrice).toBe(1);
    expect(body.lpCount).toBe(0);
    expect(body.canWithdraw).toBe(true);
  });

  // ── Test 7: Share not found returns 404 ──

  test('share for unknown address returns 404', async () => {
    const res = await get('/api/lp/share/0xUnknown');
    expect(res.statusCode).toBe(404);
  });

  // ── Test 8: Withdrawal with insufficient shares ──

  test('withdrawal with insufficient shares returns 400', async () => {
    await post('/api/lp/deposit', { address: '0xLP1', amount: 100 });

    const res = await post('/api/lp/withdraw', { address: '0xLP1', shares: 999 });
    expect(res.statusCode).toBe(400);
  });
});
