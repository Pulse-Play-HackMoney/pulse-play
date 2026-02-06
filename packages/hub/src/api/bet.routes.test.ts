import { buildApp } from '../app.js';
import { createTestContext } from '../context.js';
import type { AppContext } from '../context.js';
import type { FastifyInstance } from 'fastify';

describe('Bet Routes', () => {
  let app: FastifyInstance;
  let ctx: AppContext;

  beforeEach(async () => {
    ctx = createTestContext();
    app = await buildApp(ctx);
  });

  afterEach(async () => {
    await app.close();
  });

  const validBet = {
    address: '0xAlice',
    marketId: 'm1',
    outcome: 'BALL',
    amount: 10,
    appSessionId: 'sess1',
    appSessionVersion: 1,
  };

  function openMarket() {
    ctx.marketManager.createMarket('m1');
    ctx.marketManager.openMarket('m1');
  }

  async function postBet(body: any) {
    return app.inject({
      method: 'POST',
      url: '/api/bet',
      payload: body,
    });
  }

  test('returns accepted: false when no market exists', async () => {
    const res = await postBet(validBet);
    expect(res.json().accepted).toBe(false);
  });

  test('returns accepted: false when market is PENDING', async () => {
    ctx.marketManager.createMarket('m1');
    const res = await postBet(validBet);
    expect(res.json().accepted).toBe(false);
  });

  test('returns accepted: false when market is CLOSED', async () => {
    openMarket();
    ctx.marketManager.closeMarket('m1');
    const res = await postBet(validBet);
    expect(res.json().accepted).toBe(false);
  });

  test('returns accepted: false when market is RESOLVED', async () => {
    openMarket();
    ctx.marketManager.closeMarket('m1');
    ctx.marketManager.resolveMarket('m1', 'BALL');
    const res = await postBet(validBet);
    expect(res.json().accepted).toBe(false);
  });

  test('accepts bet on OPEN market and returns shares + new prices', async () => {
    openMarket();
    const res = await postBet(validBet);
    const body = res.json();
    expect(body.accepted).toBe(true);
    expect(body.shares).toBeGreaterThan(0);
    expect(body.newPriceBall).toBeGreaterThan(0.5);
    expect(body.newPriceStrike).toBeLessThan(0.5);
  });

  test('records position in PositionTracker after accepted bet', async () => {
    openMarket();
    await postBet(validBet);
    const positions = ctx.positionTracker.getPositionsByUser('0xAlice');
    expect(positions).toHaveLength(1);
    expect(positions[0].outcome).toBe('BALL');
    expect(positions[0].costPaid).toBe(10);
  });

  test('updates market quantities after accepted bet', async () => {
    openMarket();
    await postBet(validBet);
    const market = ctx.marketManager.getMarket('m1')!;
    expect(market.qBall).toBeGreaterThan(0);
  });

  test('returns 400 for invalid outcome (not BALL or STRIKE)', async () => {
    openMarket();
    const res = await postBet({ ...validBet, outcome: 'HOME_RUN' });
    expect(res.statusCode).toBe(400);
    expect(res.json().accepted).toBe(false);
  });

  test('returns 400 for missing required fields', async () => {
    openMarket();
    const res = await postBet({ address: '0xAlice' });
    expect(res.statusCode).toBe(400);
  });

  test('returns 400 for amount <= 0', async () => {
    openMarket();
    const res = await postBet({ ...validBet, amount: 0 });
    expect(res.statusCode).toBe(400);
  });

  test('returns 400 for negative amount', async () => {
    openMarket();
    const res = await postBet({ ...validBet, amount: -5 });
    expect(res.statusCode).toBe(400);
  });

  test('accepts multiple sequential bets and prices shift correctly', async () => {
    openMarket();
    const res1 = await postBet(validBet);
    const p1 = res1.json().newPriceBall;

    const res2 = await postBet({ ...validBet, address: '0xBob', appSessionId: 'sess2' });
    const p2 = res2.json().newPriceBall;

    // Second bet on BALL should push price even higher
    expect(p2).toBeGreaterThan(p1);
  });

  test('accepts bet for correct marketId', async () => {
    openMarket();
    const res = await postBet(validBet);
    expect(res.json().accepted).toBe(true);
  });

  test('rejects bet for wrong marketId', async () => {
    openMarket();
    const res = await postBet({ ...validBet, marketId: 'wrong-id' });
    expect(res.json().accepted).toBe(false);
  });

  test('broadcasts ODDS_UPDATE via WebSocket after accepted bet', async () => {
    openMarket();
    const broadcastSpy = jest.spyOn(ctx.ws, 'broadcast');
    await postBet(validBet);

    expect(broadcastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ODDS_UPDATE',
        marketId: 'm1',
        qBall: expect.any(Number),
        qStrike: expect.any(Number),
      }),
    );
  });

  // ── Bet rejection → closeSession ──

  test('calls closeSession when market is not OPEN', async () => {
    ctx.marketManager.createMarket('m1');
    // market is PENDING, not OPEN
    const closeSession = ctx.clearnodeClient.closeSession as jest.Mock;
    await postBet(validBet);

    expect(closeSession).toHaveBeenCalledWith({
      appSessionId: 'sess1',
      allocations: [
        { participant: '0xAlice', asset: 'ytest.usd', amount: '10000000' },
        { participant: '0xMM', asset: 'ytest.usd', amount: '0' },
      ],
    });
  });

  test('still returns rejection if closeSession fails', async () => {
    ctx.marketManager.createMarket('m1');
    (ctx.clearnodeClient.closeSession as jest.Mock).mockRejectedValueOnce(new Error('Clearnode down'));
    const res = await postBet(validBet);
    const body = res.json();
    expect(body.accepted).toBe(false);
    expect(body.reason).toContain('PENDING');
  });

  test('does not call closeSession for validation errors', async () => {
    openMarket();
    const closeSession = ctx.clearnodeClient.closeSession as jest.Mock;
    // Missing required fields (no address)
    await postBet({ marketId: 'm1', outcome: 'BALL', amount: 10 });
    expect(closeSession).not.toHaveBeenCalled();
  });
});
