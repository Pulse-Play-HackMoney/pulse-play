import { buildApp } from '../app.js';
import { createTestContext, DEFAULT_TEST_GAME_ID, DEFAULT_TEST_CATEGORY_ID } from '../context.js';
import type { AppContext } from '../context.js';
import type { FastifyInstance } from 'fastify';

describe('Oracle Routes', () => {
  let app: FastifyInstance;
  let ctx: AppContext;

  beforeEach(async () => {
    ctx = createTestContext();
    app = await buildApp(ctx);
  });

  afterEach(async () => {
    await app.close();
  });

  // Helper to open a market (test game is already ACTIVE from seed)
  async function activateAndOpenMarket() {
    const res = await app.inject({
      method: 'POST',
      url: '/api/oracle/market/open',
      payload: { gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
    });
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
      const res = await app.inject({
        method: 'POST',
        url: '/api/oracle/market/open',
        payload: { gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });
      expect(res.json().success).toBe(true);
      expect(res.json().marketId).toBeDefined();
    });

    test('returns 400 when game is not active', async () => {
      // Complete the game so it's no longer ACTIVE
      ctx.gameManager.completeGame(DEFAULT_TEST_GAME_ID);
      const res = await app.inject({
        method: 'POST',
        url: '/api/oracle/market/open',
        payload: { gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('Game is not active');
    });

    test('returns 400 when gameId or categoryId is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/oracle/market/open',
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });

    test('returns 400 when a market is already OPEN', async () => {
      await activateAndOpenMarket();
      const res = await app.inject({
        method: 'POST',
        url: '/api/oracle/market/open',
        payload: { gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });
      expect(res.statusCode).toBe(400);
    });

    test('returns 400 when a CLOSED market exists (must be resolved first)', async () => {
      await activateAndOpenMarket();
      await app.inject({
        method: 'POST',
        url: '/api/oracle/market/close',
        payload: { gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/oracle/market/open',
        payload: { gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('A CLOSED market must be resolved before opening a new one');
    });

    test('broadcasts MARKET_STATUS(OPEN) via WebSocket', async () => {
      const spy = jest.spyOn(ctx.ws, 'broadcast');
      ctx.oracle.setGameActive(true);
      await app.inject({
        method: 'POST',
        url: '/api/oracle/market/open',
        payload: { gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'MARKET_STATUS', status: 'OPEN' }),
      );
    });

    test('broadcasts ODDS_UPDATE with 50/50 prices on market open', async () => {
      const spy = jest.spyOn(ctx.ws, 'broadcast');
      ctx.oracle.setGameActive(true);
      await app.inject({
        method: 'POST',
        url: '/api/oracle/market/open',
        payload: { gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ODDS_UPDATE',
          prices: [0.5, 0.5],
          quantities: [0, 0],
          outcomes: ['BALL', 'STRIKE'],
          priceBall: 0.5,
          priceStrike: 0.5,
          qBall: 0,
          qStrike: 0,
          marketId: `${DEFAULT_TEST_GAME_ID}-${DEFAULT_TEST_CATEGORY_ID}-1`,
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
      const res = await app.inject({
        method: 'POST',
        url: '/api/oracle/market/close',
        payload: { gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });
      expect(res.json().success).toBe(true);
    });

    test('returns 400 when no market is open', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/oracle/market/close',
        payload: { gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });
      expect(res.statusCode).toBe(400);
    });

    test('returns 400 when market is already CLOSED', async () => {
      await activateAndOpenMarket();
      await app.inject({
        method: 'POST',
        url: '/api/oracle/market/close',
        payload: { gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });
      const res = await app.inject({
        method: 'POST',
        url: '/api/oracle/market/close',
        payload: { gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });
      expect(res.statusCode).toBe(400);
    });

    test('broadcasts MARKET_STATUS(CLOSED) via WebSocket', async () => {
      await activateAndOpenMarket();
      const spy = jest.spyOn(ctx.ws, 'broadcast');
      await app.inject({
        method: 'POST',
        url: '/api/oracle/market/close',
        payload: { gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'MARKET_STATUS', status: 'CLOSED' }),
      );
    });
  });

  // ── Outcome / Resolution ──

  describe('outcome/resolution', () => {
    test('resolves a CLOSED market with BALL outcome', async () => {
      const marketId = await activateAndOpenMarket();
      await app.inject({
        method: 'POST',
        url: '/api/oracle/market/close',
        payload: { gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/oracle/outcome',
        payload: { outcome: 'BALL', gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.outcome).toBe('BALL');
    });

    test('resolves a CLOSED market with STRIKE outcome', async () => {
      await activateAndOpenMarket();
      await app.inject({
        method: 'POST',
        url: '/api/oracle/market/close',
        payload: { gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/oracle/outcome',
        payload: { outcome: 'STRIKE', gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });
      expect(res.json().outcome).toBe('STRIKE');
    });

    test('returns 400 when market is not CLOSED', async () => {
      await activateAndOpenMarket();
      const res = await app.inject({
        method: 'POST',
        url: '/api/oracle/outcome',
        payload: { outcome: 'BALL', gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });
      expect(res.statusCode).toBe(400);
    });

    test('returns 400 for invalid outcome value', async () => {
      await activateAndOpenMarket();
      await app.inject({
        method: 'POST',
        url: '/api/oracle/market/close',
        payload: { gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/oracle/outcome',
        payload: { outcome: 'FOUL', gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });
      expect(res.statusCode).toBe(400);
    });

    test('resolution summary has correct winner/loser counts', async () => {
      const marketId = await activateAndOpenMarket();
      await placeBet('0xAlice', marketId, 'BALL', 10);
      await placeBet('0xBob', marketId, 'STRIKE', 10);
      await app.inject({
        method: 'POST',
        url: '/api/oracle/market/close',
        payload: { gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/oracle/outcome',
        payload: { outcome: 'BALL', gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });
      const body = res.json();
      expect(body.winners).toBe(1);
      expect(body.losers).toBe(1);
    });

    test('clears positions after resolution', async () => {
      const marketId = await activateAndOpenMarket();
      await placeBet('0xAlice', marketId, 'BALL', 10);
      await app.inject({
        method: 'POST',
        url: '/api/oracle/market/close',
        payload: { gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });

      await app.inject({
        method: 'POST',
        url: '/api/oracle/outcome',
        payload: { outcome: 'BALL', gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });

      const positions = ctx.positionTracker.getPositionsByMarket(marketId);
      expect(positions).toHaveLength(0);
    });

    test('broadcasts MARKET_STATUS(RESOLVED) via WebSocket', async () => {
      await activateAndOpenMarket();
      await app.inject({
        method: 'POST',
        url: '/api/oracle/market/close',
        payload: { gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });

      const spy = jest.spyOn(ctx.ws, 'broadcast');
      await app.inject({
        method: 'POST',
        url: '/api/oracle/outcome',
        payload: { outcome: 'BALL', gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'MARKET_STATUS', status: 'RESOLVED' }),
      );
    });

    test('sends BET_RESULT(WIN) to winners via sendTo', async () => {
      const marketId = await activateAndOpenMarket();
      await placeBet('0xAlice', marketId, 'BALL', 10);
      await app.inject({
        method: 'POST',
        url: '/api/oracle/market/close',
        payload: { gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });

      const spy = jest.spyOn(ctx.ws, 'sendTo');
      await app.inject({
        method: 'POST',
        url: '/api/oracle/outcome',
        payload: { outcome: 'BALL', gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });
      expect(spy).toHaveBeenCalledWith(
        '0xAlice',
        expect.objectContaining({ type: 'BET_RESULT', result: 'WIN' }),
      );
    });

    test('sends BET_RESULT(LOSS) to losers via sendTo', async () => {
      const marketId = await activateAndOpenMarket();
      await placeBet('0xBob', marketId, 'STRIKE', 10);
      await app.inject({
        method: 'POST',
        url: '/api/oracle/market/close',
        payload: { gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });

      const spy = jest.spyOn(ctx.ws, 'sendTo');
      await app.inject({
        method: 'POST',
        url: '/api/oracle/outcome',
        payload: { outcome: 'BALL', gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });
      expect(spy).toHaveBeenCalledWith(
        '0xBob',
        expect.objectContaining({ type: 'BET_RESULT', result: 'LOSS' }),
      );
    });

    test('handles market with no positions (no bets placed)', async () => {
      await activateAndOpenMarket();
      await app.inject({
        method: 'POST',
        url: '/api/oracle/market/close',
        payload: { gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/oracle/outcome',
        payload: { outcome: 'BALL', gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
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
      await app.inject({
        method: 'POST',
        url: '/api/oracle/market/close',
        payload: { gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });

      const submitAppState = ctx.clearnodeClient.submitAppState as jest.Mock;
      const closeSession = ctx.clearnodeClient.closeSession as jest.Mock;
      submitAppState.mockClear();
      closeSession.mockClear();

      await app.inject({
        method: 'POST',
        url: '/api/oracle/outcome',
        payload: { outcome: 'BALL', gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });

      // Loser: Bob bet STRIKE, outcome is BALL — V3 submitAppState (resolution)
      expect(submitAppState).toHaveBeenCalledWith(
        expect.objectContaining({
          appSessionId: 'sess-0xBob',
          intent: 'operate',
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
      await app.inject({
        method: 'POST',
        url: '/api/oracle/market/close',
        payload: { gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });

      const closeSession = ctx.clearnodeClient.closeSession as jest.Mock;
      const transfer = ctx.clearnodeClient.transfer as jest.Mock;

      await app.inject({
        method: 'POST',
        url: '/api/oracle/outcome',
        payload: { outcome: 'BALL', gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });

      // Winner: Alice bet BALL, outcome is BALL
      // closeSession returns user's net funds (fee stays with MM)
      // With 1% fee on $10: fee = $0.1, net = $9.9
      expect(closeSession).toHaveBeenCalledWith(
        expect.objectContaining({
          appSessionId: 'sess-0xAlice',
          allocations: expect.arrayContaining([
            expect.objectContaining({ participant: '0xAlice', amount: '9900000' }),
            expect.objectContaining({ participant: '0xMM', amount: '100000' }),
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
      // Place a large bet that pushes price near 1, then shares = costPaid
      // For a simpler approach: we'll mock a position directly with costPaid = shares
      ctx.positionTracker.addPosition({
        address: '0xEve',
        marketId,
        outcome: 'BALL',
        shares: 10,
        costPaid: 10,  // costPaid equals shares -> profit = 0
        appSessionId: 'sess-even',
        appSessionVersion: 1,
        sessionStatus: 'open',
        timestamp: Date.now(),
      });
      await app.inject({
        method: 'POST',
        url: '/api/oracle/market/close',
        payload: { gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });

      const transfer = ctx.clearnodeClient.transfer as jest.Mock;
      transfer.mockClear();

      await app.inject({
        method: 'POST',
        url: '/api/oracle/outcome',
        payload: { outcome: 'BALL', gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });

      // Since payout (shares=10) - costPaid (10) = 0, no transfer
      expect(transfer).not.toHaveBeenCalled();
    });

    test('continues resolution if one position Clearnode call fails', async () => {
      const marketId = await activateAndOpenMarket();
      await placeBet('0xAlice', marketId, 'BALL', 10);
      await placeBet('0xBob', marketId, 'STRIKE', 10);
      await app.inject({
        method: 'POST',
        url: '/api/oracle/market/close',
        payload: { gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });

      // Make loser's submitAppState fail
      (ctx.clearnodeClient.submitAppState as jest.Mock).mockRejectedValueOnce(new Error('Clearnode down'));

      const sendToSpy = jest.spyOn(ctx.ws, 'sendTo');
      const broadcastSpy = jest.spyOn(ctx.ws, 'broadcast');

      const res = await app.inject({
        method: 'POST',
        url: '/api/oracle/outcome',
        payload: { outcome: 'BALL', gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });

      // Should still succeed overall
      expect(res.json().success).toBe(true);
      // Both users should still get their BET_RESULT messages
      expect(sendToSpy).toHaveBeenCalledWith('0xBob', expect.objectContaining({ result: 'LOSS' }));
      expect(sendToSpy).toHaveBeenCalledWith('0xAlice', expect.objectContaining({ result: 'WIN' }));
      // Loser session should still be marked settled even though Clearnode failed
      expect(broadcastSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'SESSION_SETTLED', appSessionId: 'sess-0xBob', status: 'settled' }),
      );
    });

    test('processes losers before winners', async () => {
      const marketId = await activateAndOpenMarket();
      await placeBet('0xAlice', marketId, 'BALL', 10);
      await placeBet('0xBob', marketId, 'STRIKE', 10);
      await app.inject({
        method: 'POST',
        url: '/api/oracle/market/close',
        payload: { gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });

      // Clear call order to only track resolution calls (not V2 from bet placement)
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
        payload: { outcome: 'BALL', gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });

      // Loser operations (submitAppState + closeSession) should come before winner operations
      const loserSubmitIdx = callOrder.indexOf('submitAppState');
      const firstCloseIdx = callOrder.indexOf('closeSession');
      // Winner closeSession is the second closeSession call
      const winnerCloseIdx = callOrder.lastIndexOf('closeSession');

      expect(loserSubmitIdx).toBeLessThan(winnerCloseIdx);
      expect(firstCloseIdx).toBeLessThan(winnerCloseIdx);
    });

    test('winner gets BET_RESULT even when transfer fails (closeSession succeeds)', async () => {
      const marketId = await activateAndOpenMarket();
      await placeBet('0xAlice', marketId, 'BALL', 10);
      await app.inject({ method: 'POST', url: '/api/oracle/market/close' });

      // closeSession succeeds, but transfer fails
      const transfer = ctx.clearnodeClient.transfer as jest.Mock;
      transfer.mockRejectedValueOnce(new Error('Allowance exceeded'));

      const sendToSpy = jest.spyOn(ctx.ws, 'sendTo');
      const errorSpy = jest.spyOn(ctx.log, 'error');

      const res = await app.inject({
        method: 'POST',
        url: '/api/oracle/outcome',
        payload: { outcome: 'BALL' },
      });

      expect(res.json().success).toBe(true);
      // Winner still gets BET_RESULT
      expect(sendToSpy).toHaveBeenCalledWith(
        '0xAlice',
        expect.objectContaining({ type: 'BET_RESULT', result: 'WIN' }),
      );
      // Transfer error is logged with specific label
      expect(errorSpy).toHaveBeenCalledWith(
        'resolution-winner-transfer-0xAlice',
        expect.any(Error),
      );
      // closeSession should have been called successfully (not blocked by transfer failure)
      expect(ctx.clearnodeClient.closeSession).toHaveBeenCalled();
    });

    test('loser submitAppState includes V3 sessionData with result LOSS', async () => {
      const marketId = await activateAndOpenMarket();
      await placeBet('0xBob', marketId, 'STRIKE', 10);
      await app.inject({ method: 'POST', url: '/api/oracle/market/close' });

      const submitAppState = ctx.clearnodeClient.submitAppState as jest.Mock;
      submitAppState.mockClear();

      await app.inject({
        method: 'POST',
        url: '/api/oracle/outcome',
        payload: { outcome: 'BALL' },
      });

      expect(submitAppState).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionData: expect.stringContaining('"v":3'),
        }),
      );

      const callArgs = submitAppState.mock.calls[submitAppState.mock.calls.length - 1][0];
      const data = JSON.parse(callArgs.sessionData);
      expect(data.v).toBe(3);
      expect(data.result).toBe('LOSS');
      expect(data.payout).toBe(0);
      expect(data.resolution).toBe('BALL');
    });

    test('loser closeSession includes V3 sessionData', async () => {
      const marketId = await activateAndOpenMarket();
      await placeBet('0xBob', marketId, 'STRIKE', 10);
      await app.inject({ method: 'POST', url: '/api/oracle/market/close' });

      const closeSession = ctx.clearnodeClient.closeSession as jest.Mock;
      closeSession.mockClear();

      await app.inject({
        method: 'POST',
        url: '/api/oracle/outcome',
        payload: { outcome: 'BALL' },
      });

      // The loser's closeSession should include V3 sessionData
      const loserClose = closeSession.mock.calls.find((call: unknown[]) => {
        const args = call[0] as { allocations: { participant: string }[] };
        return args.allocations.some((a) => a.participant === '0xBob');
      });
      expect(loserClose).toBeDefined();
      const data = JSON.parse(loserClose![0].sessionData);
      expect(data.v).toBe(3);
      expect(data.result).toBe('LOSS');
    });

    test('winner closeSession includes V3 sessionData with result WIN', async () => {
      const marketId = await activateAndOpenMarket();
      await placeBet('0xAlice', marketId, 'BALL', 10);
      await app.inject({ method: 'POST', url: '/api/oracle/market/close' });

      const closeSession = ctx.clearnodeClient.closeSession as jest.Mock;
      closeSession.mockClear();

      await app.inject({
        method: 'POST',
        url: '/api/oracle/outcome',
        payload: { outcome: 'BALL' },
      });

      expect(closeSession).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionData: expect.stringContaining('"v":3'),
        }),
      );

      const callArgs = closeSession.mock.calls[0][0];
      const data = JSON.parse(callArgs.sessionData);
      expect(data.v).toBe(3);
      expect(data.result).toBe('WIN');
      expect(data.payout).toBeGreaterThan(0);
      expect(data.resolution).toBe('BALL');
    });

    test('broadcasts SESSION_VERSION_UPDATED for losers after V3 submitAppState', async () => {
      const marketId = await activateAndOpenMarket();
      await placeBet('0xBob', marketId, 'STRIKE', 10);
      await app.inject({ method: 'POST', url: '/api/oracle/market/close' });

      const broadcastSpy = jest.spyOn(ctx.ws, 'broadcast');

      await app.inject({
        method: 'POST',
        url: '/api/oracle/outcome',
        payload: { outcome: 'BALL' },
      });

      // Loser (Bob bet STRIKE, outcome BALL) should get SESSION_VERSION_UPDATED with V3
      expect(broadcastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SESSION_VERSION_UPDATED',
          appSessionId: 'sess-0xBob',
          version: 3, // appSessionVersion was 2 (after V2 bet acceptance), so V3 = 2 + 1
        }),
      );

      // Position tracker should also have the updated version
      // (positions are cleared after resolution, so we check via the broadcast)
    });

    test('does not broadcast SESSION_VERSION_UPDATED for losers when V3 submitAppState fails', async () => {
      const marketId = await activateAndOpenMarket();
      await placeBet('0xBob', marketId, 'STRIKE', 10);
      await app.inject({ method: 'POST', url: '/api/oracle/market/close' });

      // Make submitAppState fail for the loser's V3 state update
      (ctx.clearnodeClient.submitAppState as jest.Mock).mockRejectedValueOnce(new Error('Clearnode down'));

      const broadcastSpy = jest.spyOn(ctx.ws, 'broadcast');

      await app.inject({
        method: 'POST',
        url: '/api/oracle/outcome',
        payload: { outcome: 'BALL' },
      });

      // SESSION_VERSION_UPDATED should NOT have been broadcast (submitAppState failed)
      const versionBroadcasts = broadcastSpy.mock.calls.filter(
        (call) => (call[0] as any).type === 'SESSION_VERSION_UPDATED',
      );
      expect(versionBroadcasts).toHaveLength(0);
    });

    test('no Clearnode calls when no positions exist', async () => {
      await activateAndOpenMarket();
      await app.inject({
        method: 'POST',
        url: '/api/oracle/market/close',
        payload: { gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });

      const submitAppState = ctx.clearnodeClient.submitAppState as jest.Mock;
      const closeSession = ctx.clearnodeClient.closeSession as jest.Mock;
      const transfer = ctx.clearnodeClient.transfer as jest.Mock;
      submitAppState.mockClear();
      closeSession.mockClear();
      transfer.mockClear();

      await app.inject({
        method: 'POST',
        url: '/api/oracle/outcome',
        payload: { outcome: 'BALL', gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });

      expect(submitAppState).not.toHaveBeenCalled();
      expect(closeSession).not.toHaveBeenCalled();
      expect(transfer).not.toHaveBeenCalled();
    });

    // ── User tracking on resolution ──

    test('records win in userTracker for winners', async () => {
      const marketId = await activateAndOpenMarket();
      await placeBet('0xAlice', marketId, 'BALL', 10);
      await app.inject({
        method: 'POST',
        url: '/api/oracle/market/close',
        payload: { gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });

      await app.inject({
        method: 'POST',
        url: '/api/oracle/outcome',
        payload: { outcome: 'BALL', gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });

      const user = ctx.userTracker.getUser('0xAlice');
      expect(user).toBeDefined();
      expect(user!.totalWins).toBe(1);
      expect(user!.totalPayout).toBeGreaterThan(0);
    });

    test('records loss in userTracker for losers', async () => {
      const marketId = await activateAndOpenMarket();
      await placeBet('0xBob', marketId, 'STRIKE', 10);
      await app.inject({
        method: 'POST',
        url: '/api/oracle/market/close',
        payload: { gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });

      await app.inject({
        method: 'POST',
        url: '/api/oracle/outcome',
        payload: { outcome: 'BALL', gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });

      const user = ctx.userTracker.getUser('0xBob');
      expect(user).toBeDefined();
      expect(user!.totalLosses).toBe(1);
    });

    test('winner close session allocates fee to MM (not all to user)', async () => {
      const marketId = await activateAndOpenMarket();
      await placeBet('0xAlice', marketId, 'BALL', 10);
      await app.inject({
        method: 'POST',
        url: '/api/oracle/market/close',
        payload: { gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });

      const closeSession = ctx.clearnodeClient.closeSession as jest.Mock;
      closeSession.mockClear();

      await app.inject({
        method: 'POST',
        url: '/api/oracle/outcome',
        payload: { outcome: 'BALL', gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });

      // Winner's session close: net to user, fee to MM
      const winnerClose = closeSession.mock.calls.find((call: unknown[]) => {
        const args = call[0] as { allocations: { participant: string; amount: string }[] };
        return args.allocations.some((a) => a.participant === '0xAlice' && a.amount !== '0');
      });
      expect(winnerClose).toBeDefined();
      const allocs = winnerClose![0].allocations;
      const aliceAlloc = allocs.find((a: any) => a.participant === '0xAlice');
      const mmAlloc = allocs.find((a: any) => a.participant === '0xMM');
      // 1% fee on $10: user gets $9.9 = 9900000, MM gets $0.1 = 100000
      expect(aliceAlloc.amount).toBe('9900000');
      expect(mmAlloc.amount).toBe('100000');
    });
  });

  // ── P2P Resolution ──────────────────────────────────────────────────

  describe('P2P resolution', () => {
    async function placeP2POrder(userAddress: string, outcome: string, mcps: number, amount: number, marketId: string) {
      return app.inject({
        method: 'POST',
        url: '/api/orderbook/order',
        payload: {
          marketId,
          gameId: DEFAULT_TEST_GAME_ID,
          userAddress,
          outcome,
          mcps,
          amount,
          appSessionId: `p2p-sess-${userAddress}-${Math.random().toString(36).slice(2, 6)}`,
          appSessionVersion: 1,
        },
      });
    }

    async function resolveMarket(outcome: string) {
      await app.inject({
        method: 'POST',
        url: '/api/oracle/market/close',
        payload: { gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });
      return app.inject({
        method: 'POST',
        url: '/api/oracle/outcome',
        payload: { outcome, gameId: DEFAULT_TEST_GAME_ID, categoryId: DEFAULT_TEST_CATEGORY_ID },
      });
    }

    test('settles P2P loser — closeSession with loss to MM', async () => {
      const marketId = await activateAndOpenMarket();

      await placeP2POrder('0xAlice', 'BALL', 0.60, 6, marketId);
      await placeP2POrder('0xBob', 'STRIKE', 0.40, 4, marketId);

      (ctx.clearnodeClient.closeSession as jest.Mock).mockClear();

      const res = await resolveMarket('BALL');
      expect(res.json().success).toBe(true);

      // Bob (STRIKE) is the loser — closeSession should be called
      expect(ctx.clearnodeClient.closeSession).toHaveBeenCalled();
    });

    test('settles P2P winner — transfers profit', async () => {
      const marketId = await activateAndOpenMarket();

      await placeP2POrder('0xAlice', 'BALL', 0.60, 6, marketId);
      await placeP2POrder('0xBob', 'STRIKE', 0.40, 4, marketId);

      (ctx.clearnodeClient.transfer as jest.Mock).mockClear();

      await resolveMarket('BALL');

      // Alice (BALL) is the winner — should receive profit transfer
      expect(ctx.clearnodeClient.transfer).toHaveBeenCalled();
    });

    test('sends P2P_BET_RESULT to winner and loser', async () => {
      const marketId = await activateAndOpenMarket();

      await placeP2POrder('0xAlice', 'BALL', 0.60, 6, marketId);
      await placeP2POrder('0xBob', 'STRIKE', 0.40, 4, marketId);

      const sendToSpy = jest.spyOn(ctx.ws, 'sendTo');

      await resolveMarket('BALL');

      // Alice should get WIN
      const aliceCalls = sendToSpy.mock.calls.filter(([addr]) => addr === '0xAlice');
      const aliceP2P = aliceCalls.find(([, msg]) => msg.type === 'P2P_BET_RESULT');
      expect(aliceP2P).toBeDefined();
      expect(aliceP2P![1]).toMatchObject({ result: 'WIN' });

      // Bob should get LOSS
      const bobCalls = sendToSpy.mock.calls.filter(([addr]) => addr === '0xBob');
      const bobP2P = bobCalls.find(([, msg]) => msg.type === 'P2P_BET_RESULT');
      expect(bobP2P).toBeDefined();
      expect(bobP2P![1]).toMatchObject({ result: 'LOSS' });
    });

    test('marks P2P orders as SETTLED after resolution', async () => {
      const marketId = await activateAndOpenMarket();

      const r1 = await placeP2POrder('0xAlice', 'BALL', 0.60, 6, marketId);
      const r2 = await placeP2POrder('0xBob', 'STRIKE', 0.40, 4, marketId);

      await resolveMarket('BALL');

      const aliceOrder = ctx.orderBookManager.getOrder(r1.json().orderId);
      const bobOrder = ctx.orderBookManager.getOrder(r2.json().orderId);
      expect(aliceOrder?.status).toBe('SETTLED');
      expect(bobOrder?.status).toBe('SETTLED');
    });

    test('updates user stats for P2P bets', async () => {
      const marketId = await activateAndOpenMarket();

      await placeP2POrder('0xAlice', 'BALL', 0.60, 6, marketId);
      await placeP2POrder('0xBob', 'STRIKE', 0.40, 4, marketId);

      await resolveMarket('BALL');

      const alice = ctx.userTracker.getUser('0xAlice');
      expect(alice!.totalWins).toBe(1);

      const bob = ctx.userTracker.getUser('0xBob');
      expect(bob!.totalLosses).toBe(1);
    });

    test('expires unfilled P2P orders and refunds', async () => {
      const marketId = await activateAndOpenMarket();

      // Place order that won't match (no counterparty)
      const r = await placeP2POrder('0xAlice', 'BALL', 0.30, 3, marketId);

      (ctx.clearnodeClient.closeSession as jest.Mock).mockClear();

      await resolveMarket('BALL');

      const order = ctx.orderBookManager.getOrder(r.json().orderId);
      expect(order?.status).toBe('EXPIRED');
      // Session should be closed with full refund
      expect(ctx.clearnodeClient.closeSession).toHaveBeenCalled();
    });

    test('mixed LMSR + P2P resolution works together', async () => {
      const marketId = await activateAndOpenMarket();

      // LMSR bet
      await placeBet('0xCharlie', marketId, 'BALL', 10);

      // P2P bets
      await placeP2POrder('0xAlice', 'BALL', 0.60, 6, marketId);
      await placeP2POrder('0xBob', 'STRIKE', 0.40, 4, marketId);

      const res = await resolveMarket('BALL');
      expect(res.json().success).toBe(true);

      // LMSR winner (Charlie) should have win recorded
      const charlie = ctx.userTracker.getUser('0xCharlie');
      expect(charlie!.totalWins).toBe(1);

      // P2P winner (Alice) should have win recorded
      const alice = ctx.userTracker.getUser('0xAlice');
      expect(alice!.totalWins).toBe(1);
    });
  });
});
