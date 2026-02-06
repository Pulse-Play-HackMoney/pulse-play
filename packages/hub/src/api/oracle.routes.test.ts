import { buildApp } from '../app.js';
import { createTestContext } from '../context.js';
import { resetMarketCounter } from './oracle.routes.js';
import type { AppContext } from '../context.js';
import type { FastifyInstance } from 'fastify';

describe('Oracle Routes', () => {
  let app: FastifyInstance;
  let ctx: AppContext;

  beforeEach(async () => {
    resetMarketCounter();
    ctx = createTestContext();
    app = await buildApp(ctx);
  });

  afterEach(async () => {
    await app.close();
  });

  // Helper to set game active and open a market
  async function activateAndOpenMarket() {
    await app.inject({ method: 'POST', url: '/api/oracle/game-state', payload: { active: true } });
    const res = await app.inject({ method: 'POST', url: '/api/oracle/market/open' });
    return res.json().marketId as string;
  }

  async function placeBet(address: string, marketId: string, outcome: string, amount: number) {
    return app.inject({
      method: 'POST',
      url: '/api/bet',
      payload: { address, marketId, outcome, amount, appSessionId: `sess-${address}`, appSessionVersion: 1 },
    });
  }

  // ── Game State ──

  describe('game state', () => {
    test('sets game to active', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/oracle/game-state',
        payload: { active: true },
      });
      expect(res.json()).toEqual({ success: true, active: true });
      expect(ctx.oracle.isActive()).toBe(true);
    });

    test('sets game to inactive', async () => {
      ctx.oracle.setGameActive(true);
      const res = await app.inject({
        method: 'POST',
        url: '/api/oracle/game-state',
        payload: { active: false },
      });
      expect(res.json().active).toBe(false);
      expect(ctx.oracle.isActive()).toBe(false);
    });

    test('returns 400 when active field is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/oracle/game-state',
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });

    test('broadcasts GAME_STATE via WebSocket', async () => {
      const spy = jest.spyOn(ctx.ws, 'broadcast');
      await app.inject({
        method: 'POST',
        url: '/api/oracle/game-state',
        payload: { active: true },
      });
      expect(spy).toHaveBeenCalledWith({ type: 'GAME_STATE', active: true });
    });
  });

  // ── Market Open ──

  describe('market open', () => {
    test('opens a new market when game is active', async () => {
      ctx.oracle.setGameActive(true);
      const res = await app.inject({ method: 'POST', url: '/api/oracle/market/open' });
      expect(res.json().success).toBe(true);
      expect(res.json().marketId).toBeDefined();
    });

    test('returns 400 when game is not active', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/oracle/market/open' });
      expect(res.statusCode).toBe(400);
    });

    test('returns 400 when a market is already OPEN', async () => {
      await activateAndOpenMarket();
      const res = await app.inject({ method: 'POST', url: '/api/oracle/market/open' });
      expect(res.statusCode).toBe(400);
    });

    test('broadcasts MARKET_STATUS(OPEN) via WebSocket', async () => {
      const spy = jest.spyOn(ctx.ws, 'broadcast');
      ctx.oracle.setGameActive(true);
      await app.inject({ method: 'POST', url: '/api/oracle/market/open' });
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'MARKET_STATUS', status: 'OPEN' }),
      );
    });

    test('broadcasts ODDS_UPDATE with 50/50 prices on market open', async () => {
      const spy = jest.spyOn(ctx.ws, 'broadcast');
      ctx.oracle.setGameActive(true);
      await app.inject({ method: 'POST', url: '/api/oracle/market/open' });
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ODDS_UPDATE',
          priceBall: 0.5,
          priceStrike: 0.5,
          qBall: 0,
          qStrike: 0,
          marketId: 'market-1',
        }),
      );
    });

    test('created market is accessible via GET /api/market', async () => {
      const marketId = await activateAndOpenMarket();
      const res = await app.inject({ method: 'GET', url: '/api/market' });
      expect(res.json().market.id).toBe(marketId);
    });
  });

  // ── Market Close ──

  describe('market close', () => {
    test('closes an OPEN market', async () => {
      await activateAndOpenMarket();
      const res = await app.inject({ method: 'POST', url: '/api/oracle/market/close' });
      expect(res.json().success).toBe(true);
    });

    test('returns 400 when no market is open', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/oracle/market/close' });
      expect(res.statusCode).toBe(400);
    });

    test('returns 400 when market is already CLOSED', async () => {
      await activateAndOpenMarket();
      await app.inject({ method: 'POST', url: '/api/oracle/market/close' });
      const res = await app.inject({ method: 'POST', url: '/api/oracle/market/close' });
      expect(res.statusCode).toBe(400);
    });

    test('broadcasts MARKET_STATUS(CLOSED) via WebSocket', async () => {
      await activateAndOpenMarket();
      const spy = jest.spyOn(ctx.ws, 'broadcast');
      await app.inject({ method: 'POST', url: '/api/oracle/market/close' });
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'MARKET_STATUS', status: 'CLOSED' }),
      );
    });
  });

  // ── Outcome / Resolution ──

  describe('outcome/resolution', () => {
    test('resolves a CLOSED market with BALL outcome', async () => {
      const marketId = await activateAndOpenMarket();
      await app.inject({ method: 'POST', url: '/api/oracle/market/close' });

      const res = await app.inject({
        method: 'POST',
        url: '/api/oracle/outcome',
        payload: { outcome: 'BALL' },
      });
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.outcome).toBe('BALL');
    });

    test('resolves a CLOSED market with STRIKE outcome', async () => {
      await activateAndOpenMarket();
      await app.inject({ method: 'POST', url: '/api/oracle/market/close' });

      const res = await app.inject({
        method: 'POST',
        url: '/api/oracle/outcome',
        payload: { outcome: 'STRIKE' },
      });
      expect(res.json().outcome).toBe('STRIKE');
    });

    test('returns 400 when market is not CLOSED', async () => {
      await activateAndOpenMarket();
      const res = await app.inject({
        method: 'POST',
        url: '/api/oracle/outcome',
        payload: { outcome: 'BALL' },
      });
      expect(res.statusCode).toBe(400);
    });

    test('returns 400 for invalid outcome value', async () => {
      await activateAndOpenMarket();
      await app.inject({ method: 'POST', url: '/api/oracle/market/close' });

      const res = await app.inject({
        method: 'POST',
        url: '/api/oracle/outcome',
        payload: { outcome: 'FOUL' },
      });
      expect(res.statusCode).toBe(400);
    });

    test('resolution summary has correct winner/loser counts', async () => {
      const marketId = await activateAndOpenMarket();
      await placeBet('0xAlice', marketId, 'BALL', 10);
      await placeBet('0xBob', marketId, 'STRIKE', 10);
      await app.inject({ method: 'POST', url: '/api/oracle/market/close' });

      const res = await app.inject({
        method: 'POST',
        url: '/api/oracle/outcome',
        payload: { outcome: 'BALL' },
      });
      const body = res.json();
      expect(body.winners).toBe(1);
      expect(body.losers).toBe(1);
    });

    test('clears positions after resolution', async () => {
      const marketId = await activateAndOpenMarket();
      await placeBet('0xAlice', marketId, 'BALL', 10);
      await app.inject({ method: 'POST', url: '/api/oracle/market/close' });

      await app.inject({
        method: 'POST',
        url: '/api/oracle/outcome',
        payload: { outcome: 'BALL' },
      });

      const positions = ctx.positionTracker.getPositionsByMarket(marketId);
      expect(positions).toHaveLength(0);
    });

    test('broadcasts MARKET_STATUS(RESOLVED) via WebSocket', async () => {
      await activateAndOpenMarket();
      await app.inject({ method: 'POST', url: '/api/oracle/market/close' });

      const spy = jest.spyOn(ctx.ws, 'broadcast');
      await app.inject({
        method: 'POST',
        url: '/api/oracle/outcome',
        payload: { outcome: 'BALL' },
      });
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'MARKET_STATUS', status: 'RESOLVED' }),
      );
    });

    test('sends BET_RESULT(WIN) to winners via sendTo', async () => {
      const marketId = await activateAndOpenMarket();
      await placeBet('0xAlice', marketId, 'BALL', 10);
      await app.inject({ method: 'POST', url: '/api/oracle/market/close' });

      const spy = jest.spyOn(ctx.ws, 'sendTo');
      await app.inject({
        method: 'POST',
        url: '/api/oracle/outcome',
        payload: { outcome: 'BALL' },
      });
      expect(spy).toHaveBeenCalledWith(
        '0xAlice',
        expect.objectContaining({ type: 'BET_RESULT', result: 'WIN' }),
      );
    });

    test('sends BET_RESULT(LOSS) to losers via sendTo', async () => {
      const marketId = await activateAndOpenMarket();
      await placeBet('0xBob', marketId, 'STRIKE', 10);
      await app.inject({ method: 'POST', url: '/api/oracle/market/close' });

      const spy = jest.spyOn(ctx.ws, 'sendTo');
      await app.inject({
        method: 'POST',
        url: '/api/oracle/outcome',
        payload: { outcome: 'BALL' },
      });
      expect(spy).toHaveBeenCalledWith(
        '0xBob',
        expect.objectContaining({ type: 'BET_RESULT', result: 'LOSS' }),
      );
    });

    test('handles market with no positions (no bets placed)', async () => {
      await activateAndOpenMarket();
      await app.inject({ method: 'POST', url: '/api/oracle/market/close' });

      const res = await app.inject({
        method: 'POST',
        url: '/api/oracle/outcome',
        payload: { outcome: 'BALL' },
      });
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.winners).toBe(0);
      expect(body.losers).toBe(0);
    });

    // ── Clearnode settlement ──

    test('calls submitAppState + closeSession for losers', async () => {
      const marketId = await activateAndOpenMarket();
      await placeBet('0xBob', marketId, 'STRIKE', 10);
      await app.inject({ method: 'POST', url: '/api/oracle/market/close' });

      const submitAppState = ctx.clearnodeClient.submitAppState as jest.Mock;
      const closeSession = ctx.clearnodeClient.closeSession as jest.Mock;

      await app.inject({
        method: 'POST',
        url: '/api/oracle/outcome',
        payload: { outcome: 'BALL' },
      });

      // Loser: Bob bet STRIKE, outcome is BALL
      expect(submitAppState).toHaveBeenCalledWith(
        expect.objectContaining({
          appSessionId: 'sess-0xBob',
          intent: 'operate',
          version: 2,
          allocations: expect.arrayContaining([
            expect.objectContaining({ participant: '0xBob', amount: '0' }),
            expect.objectContaining({ participant: '0xMM', amount: '10000000' }),
          ]),
        }),
      );

      expect(closeSession).toHaveBeenCalledWith(
        expect.objectContaining({
          appSessionId: 'sess-0xBob',
          allocations: expect.arrayContaining([
            expect.objectContaining({ participant: '0xBob', amount: '0' }),
            expect.objectContaining({ participant: '0xMM', amount: '10000000' }),
          ]),
        }),
      );
    });

    test('calls closeSession + transfer for winners', async () => {
      const marketId = await activateAndOpenMarket();
      await placeBet('0xAlice', marketId, 'BALL', 10);
      await app.inject({ method: 'POST', url: '/api/oracle/market/close' });

      const closeSession = ctx.clearnodeClient.closeSession as jest.Mock;
      const transfer = ctx.clearnodeClient.transfer as jest.Mock;

      await app.inject({
        method: 'POST',
        url: '/api/oracle/outcome',
        payload: { outcome: 'BALL' },
      });

      // Winner: Alice bet BALL, outcome is BALL
      // closeSession returns user's costPaid
      expect(closeSession).toHaveBeenCalledWith(
        expect.objectContaining({
          appSessionId: 'sess-0xAlice',
          allocations: expect.arrayContaining([
            expect.objectContaining({ participant: '0xAlice', amount: '10000000' }),
            expect.objectContaining({ participant: '0xMM', amount: '0' }),
          ]),
        }),
      );

      // Transfer profit (payout - costPaid). Shares > costPaid in LMSR, so there is profit.
      expect(transfer).toHaveBeenCalledWith(
        expect.objectContaining({
          destination: '0xAlice',
          asset: 'ytest.usd',
          amount: expect.any(String),
        }),
      );
    });

    test('does not call transfer when profit is zero', async () => {
      const marketId = await activateAndOpenMarket();
      // Place a large bet that pushes price near 1, then shares ≈ costPaid
      // For a simpler approach: we'll mock a position directly with costPaid = shares
      ctx.positionTracker.addPosition({
        address: '0xEve',
        marketId,
        outcome: 'BALL',
        shares: 10,
        costPaid: 10,  // costPaid equals shares → profit = 0
        appSessionId: 'sess-even',
        appSessionVersion: 1,
        sessionStatus: 'open',
        timestamp: Date.now(),
      });
      await app.inject({ method: 'POST', url: '/api/oracle/market/close' });

      const transfer = ctx.clearnodeClient.transfer as jest.Mock;
      transfer.mockClear();

      await app.inject({
        method: 'POST',
        url: '/api/oracle/outcome',
        payload: { outcome: 'BALL' },
      });

      // Since payout (shares=10) - costPaid (10) = 0, no transfer
      expect(transfer).not.toHaveBeenCalled();
    });

    test('continues resolution if one position Clearnode call fails', async () => {
      const marketId = await activateAndOpenMarket();
      await placeBet('0xAlice', marketId, 'BALL', 10);
      await placeBet('0xBob', marketId, 'STRIKE', 10);
      await app.inject({ method: 'POST', url: '/api/oracle/market/close' });

      // Make loser's submitAppState fail
      (ctx.clearnodeClient.submitAppState as jest.Mock).mockRejectedValueOnce(new Error('Clearnode down'));

      const sendToSpy = jest.spyOn(ctx.ws, 'sendTo');

      const res = await app.inject({
        method: 'POST',
        url: '/api/oracle/outcome',
        payload: { outcome: 'BALL' },
      });

      // Should still succeed overall
      expect(res.json().success).toBe(true);
      // Both users should still get their BET_RESULT messages
      expect(sendToSpy).toHaveBeenCalledWith('0xBob', expect.objectContaining({ result: 'LOSS' }));
      expect(sendToSpy).toHaveBeenCalledWith('0xAlice', expect.objectContaining({ result: 'WIN' }));
    });

    test('processes losers before winners', async () => {
      const marketId = await activateAndOpenMarket();
      await placeBet('0xAlice', marketId, 'BALL', 10);
      await placeBet('0xBob', marketId, 'STRIKE', 10);
      await app.inject({ method: 'POST', url: '/api/oracle/market/close' });

      const callOrder: string[] = [];
      (ctx.clearnodeClient.submitAppState as jest.Mock).mockImplementation(async () => {
        callOrder.push('submitAppState');
        return { version: 2 };
      });
      (ctx.clearnodeClient.closeSession as jest.Mock).mockImplementation(async () => {
        callOrder.push('closeSession');
      });
      (ctx.clearnodeClient.transfer as jest.Mock).mockImplementation(async () => {
        callOrder.push('transfer');
      });

      await app.inject({
        method: 'POST',
        url: '/api/oracle/outcome',
        payload: { outcome: 'BALL' },
      });

      // Loser operations (submitAppState + closeSession) should come before winner operations
      const loserSubmitIdx = callOrder.indexOf('submitAppState');
      const lastLoserIdx = callOrder.indexOf('closeSession');
      // Winner closeSession is the second closeSession call
      const winnerCloseIdx = callOrder.lastIndexOf('closeSession');

      expect(loserSubmitIdx).toBeLessThan(winnerCloseIdx);
      expect(lastLoserIdx).toBeLessThan(winnerCloseIdx);
    });

    test('no Clearnode calls when no positions exist', async () => {
      await activateAndOpenMarket();
      await app.inject({ method: 'POST', url: '/api/oracle/market/close' });

      const submitAppState = ctx.clearnodeClient.submitAppState as jest.Mock;
      const closeSession = ctx.clearnodeClient.closeSession as jest.Mock;
      const transfer = ctx.clearnodeClient.transfer as jest.Mock;
      submitAppState.mockClear();
      closeSession.mockClear();
      transfer.mockClear();

      await app.inject({
        method: 'POST',
        url: '/api/oracle/outcome',
        payload: { outcome: 'BALL' },
      });

      expect(submitAppState).not.toHaveBeenCalled();
      expect(closeSession).not.toHaveBeenCalled();
      expect(transfer).not.toHaveBeenCalled();
    });
  });
});
