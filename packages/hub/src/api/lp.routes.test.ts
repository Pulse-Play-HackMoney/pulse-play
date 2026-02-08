import { buildApp } from '../app.js';
import { createTestContext, DEFAULT_TEST_GAME_ID } from '../context.js';
import type { AppContext } from '../context.js';
import type { FastifyInstance } from 'fastify';

describe('LP Routes', () => {
  let app: FastifyInstance;
  let ctx: AppContext;

  beforeEach(async () => {
    ctx = createTestContext();
    app = await buildApp(ctx);
  });

  afterEach(async () => {
    await app.close();
  });

  // ── GET /api/lp/stats ───────────────────────────────────────────────────

  describe('GET /api/lp/stats', () => {
    it('returns empty pool stats', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/lp/stats' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.poolValue).toBeDefined();
      expect(body.totalShares).toBe(0);
      expect(body.sharePrice).toBe(1.0);
      expect(body.lpCount).toBe(0);
      expect(body.canWithdraw).toBe(true);
    });

    it('returns stats reflecting deposits', async () => {
      // Mock balance: 1000 (returned as micro units string)
      (ctx.clearnodeClient.getBalance as jest.Mock).mockResolvedValue('1500000000');
      ctx.lpManager.recordDeposit('0xLP1', 1000, 0);
      ctx.lpManager.recordDeposit('0xLP2', 500, 1000);

      const res = await app.inject({ method: 'GET', url: '/api/lp/stats' });
      const body = res.json();
      expect(body.totalShares).toBe(1500);
      expect(body.lpCount).toBe(2);
      expect(body.poolValue).toBe(1500);
    });

    it('returns canWithdraw=false when market is OPEN', async () => {
      const market = ctx.marketManager.createMarket(DEFAULT_TEST_GAME_ID, 'pitching');
      ctx.marketManager.openMarket(market.id);

      const res = await app.inject({ method: 'GET', url: '/api/lp/stats' });
      const body = res.json();
      expect(body.canWithdraw).toBe(false);
      expect(body.withdrawLockReason).toBeDefined();
    });

    it('returns 500 when getBalance fails', async () => {
      (ctx.clearnodeClient.getBalance as jest.Mock).mockRejectedValue(new Error('disconnected'));
      const res = await app.inject({ method: 'GET', url: '/api/lp/stats' });
      expect(res.statusCode).toBe(500);
    });
  });

  // ── GET /api/lp/share/:address ──────────────────────────────────────────

  describe('GET /api/lp/share/:address', () => {
    it('returns 404 for unknown address', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/lp/share/0xUnknown' });
      expect(res.statusCode).toBe(404);
    });

    it('returns share with derived fields', async () => {
      ctx.lpManager.recordDeposit('0xLP1', 1000, 0);
      (ctx.clearnodeClient.getBalance as jest.Mock).mockResolvedValue('2000000000');

      const res = await app.inject({ method: 'GET', url: '/api/lp/share/0xLP1' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.shares).toBe(1000);
      expect(body.totalDeposited).toBe(1000);
      expect(body.currentValue).toBe(2000); // 1000 shares * $2/share
      expect(body.pnl).toBe(1000); // 2000 - 1000
      expect(body.sharePrice).toBe(2.0);
    });

    it('returns share without derived fields when balance fails', async () => {
      ctx.lpManager.recordDeposit('0xLP1', 1000, 0);
      (ctx.clearnodeClient.getBalance as jest.Mock).mockRejectedValue(new Error('fail'));

      const res = await app.inject({ method: 'GET', url: '/api/lp/share/0xLP1' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.shares).toBe(1000);
      expect(body.currentValue).toBeNull();
    });
  });

  // ── GET /api/lp/events ──────────────────────────────────────────────────

  describe('GET /api/lp/events', () => {
    it('returns empty events', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/lp/events' });
      expect(res.statusCode).toBe(200);
      expect(res.json().events).toEqual([]);
    });

    it('returns events filtered by address', async () => {
      ctx.lpManager.recordDeposit('0xLP1', 1000, 0);
      ctx.lpManager.recordDeposit('0xLP2', 500, 1000);

      const res = await app.inject({ method: 'GET', url: '/api/lp/events?address=0xLP1' });
      const body = res.json();
      expect(body.events).toHaveLength(1);
      expect(body.events[0].address).toBe('0xLP1');
    });

    it('respects limit parameter', async () => {
      ctx.lpManager.recordDeposit('0xLP1', 100, 0);
      ctx.lpManager.recordDeposit('0xLP1', 200, 100);
      ctx.lpManager.recordDeposit('0xLP1', 300, 300);

      const res = await app.inject({ method: 'GET', url: '/api/lp/events?limit=2' });
      expect(res.json().events).toHaveLength(2);
    });
  });

  // ── POST /api/lp/deposit ────────────────────────────────────────────────

  describe('POST /api/lp/deposit', () => {
    it('records deposit and returns shares', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/lp/deposit',
        payload: { address: '0xLP1', amount: 500 },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.shares).toBe(500);
      expect(body.sharePrice).toBe(1.0);
    });

    it('broadcasts LP_DEPOSIT and POOL_UPDATE', async () => {
      const spy = jest.spyOn(ctx.ws, 'broadcast');
      await app.inject({
        method: 'POST',
        url: '/api/lp/deposit',
        payload: { address: '0xLP1', amount: 500 },
      });

      const calls = spy.mock.calls.map((c) => (c[0] as any).type);
      expect(calls).toContain('LP_DEPOSIT');
      expect(calls).toContain('POOL_UPDATE');
    });

    it('returns 400 for missing address', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/lp/deposit',
        payload: { amount: 500 },
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 for non-positive amount', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/lp/deposit',
        payload: { address: '0xLP1', amount: 0 },
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 500 when getBalance fails', async () => {
      (ctx.clearnodeClient.getBalance as jest.Mock).mockRejectedValue(new Error('disconnected'));
      const res = await app.inject({
        method: 'POST',
        url: '/api/lp/deposit',
        payload: { address: '0xLP1', amount: 500 },
      });
      expect(res.statusCode).toBe(500);
    });
  });

  // ── POST /api/lp/withdraw ──────────────────────────────────────────────

  describe('POST /api/lp/withdraw', () => {
    beforeEach(() => {
      // Seed an LP position
      ctx.lpManager.recordDeposit('0xLP1', 1000, 0);
    });

    it('withdraws shares and calls transfer', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/lp/withdraw',
        payload: { address: '0xLP1', shares: 500 },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.amount).toBeGreaterThan(0);

      // Verify Clearnode transfer was called
      expect(ctx.clearnodeClient.transfer).toHaveBeenCalledWith(
        expect.objectContaining({
          destination: '0xLP1',
          asset: 'ytest.usd',
        }),
      );
    });

    it('broadcasts LP_WITHDRAWAL and POOL_UPDATE', async () => {
      const spy = jest.spyOn(ctx.ws, 'broadcast');
      await app.inject({
        method: 'POST',
        url: '/api/lp/withdraw',
        payload: { address: '0xLP1', shares: 500 },
      });

      const calls = spy.mock.calls.map((c) => (c[0] as any).type);
      expect(calls).toContain('LP_WITHDRAWAL');
      expect(calls).toContain('POOL_UPDATE');
    });

    it('returns 403 when withdrawals are locked (open market)', async () => {
      const market = ctx.marketManager.createMarket(DEFAULT_TEST_GAME_ID, 'pitching');
      ctx.marketManager.openMarket(market.id);

      const res = await app.inject({
        method: 'POST',
        url: '/api/lp/withdraw',
        payload: { address: '0xLP1', shares: 500 },
      });
      expect(res.statusCode).toBe(403);
    });

    it('returns 400 for insufficient shares', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/lp/withdraw',
        payload: { address: '0xLP1', shares: 5000 },
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 for missing address', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/lp/withdraw',
        payload: { shares: 500 },
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 for non-positive shares', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/lp/withdraw',
        payload: { address: '0xLP1', shares: -10 },
      });
      expect(res.statusCode).toBe(400);
    });
  });
});
