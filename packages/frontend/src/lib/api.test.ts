import {
  placeBet,
  getMarket,
  getMarketById,
  getPositions,
  getSports,
  getSportCategories,
  getGames,
  getGame,
  createGame,
  activateGame,
  completeGame,
  setGameState,
  openMarket,
  closeMarket,
  resolveOutcome,
  getAdminState,
  getAdminPositions,
  getUserStats,
  getUserHistory,
  getLeaderboard,
  getMMInfo,
  requestMMFaucet,
  requestUserFaucet,
  placeP2POrder,
  cancelP2POrder,
  getOrderBookDepth,
  getUserP2POrders,
  getLPStats,
  getLPShare,
  getLPEvents,
  depositLP,
  withdrawLP,
  ApiError,
} from './api';
import type { BetRequest, MarketResponse, PositionsResponse } from './types';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('api', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('placeBet', () => {
    it('sends bet request and returns response', async () => {
      const request: BetRequest = {
        address: '0x123',
        marketId: 'market-1',
        outcome: 'BALL',
        amount: 10,
        appSessionId: 'session-1',
        appSessionVersion: 1,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          accepted: true,
          shares: 9.5,
          newPriceBall: 0.55,
          newPriceStrike: 0.45,
        }),
      });

      const result = await placeBet(request);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/bet',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        })
      );
      expect(result.accepted).toBe(true);
      expect(result.shares).toBe(9.5);
    });

    it('throws ApiError on failed request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'Market not open',
      });

      await expect(
        placeBet({
          address: '0x123',
          marketId: 'market-1',
          outcome: 'BALL',
          amount: 10,
          appSessionId: 'session-1',
          appSessionVersion: 1,
        })
      ).rejects.toThrow(ApiError);
    });
  });

  describe('getMarket', () => {
    it('fetches current market state', async () => {
      const marketResponse: MarketResponse = {
        market: {
          id: 'market-1',
          gameId: 'game-1',
          categoryId: 'pitching',
          status: 'OPEN',
          outcome: null,
          quantities: [0, 0],
          b: 100,
          qBall: 0,
          qStrike: 0,
        },
        prices: [0.5, 0.5],
        outcomes: ['BALL', 'STRIKE'],
        priceBall: 0.5,
        priceStrike: 0.5,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => marketResponse,
      });

      const result = await getMarket();

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/market');
      expect(result.market?.id).toBe('market-1');
      expect(result.prices).toEqual([0.5, 0.5]);
      expect(result.outcomes).toEqual(['BALL', 'STRIKE']);
    });
  });

  describe('getMarketById', () => {
    it('fetches a specific market by id', async () => {
      const marketResponse: MarketResponse = {
        market: {
          id: 'game1-pitching-1',
          gameId: 'game1',
          categoryId: 'pitching',
          status: 'OPEN',
          outcome: null,
          quantities: [10, 5],
          b: 100,
          qBall: 10,
          qStrike: 5,
        },
        prices: [0.52, 0.48],
        outcomes: ['BALL', 'STRIKE'],
        priceBall: 0.52,
        priceStrike: 0.48,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => marketResponse,
      });

      const result = await getMarketById('game1-pitching-1');

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/market/game1-pitching-1');
      expect(result.market?.gameId).toBe('game1');
      expect(result.market?.categoryId).toBe('pitching');
      expect(result.market?.quantities).toEqual([10, 5]);
    });

    it('throws ApiError when market not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'Market not found',
      });

      await expect(getMarketById('nonexistent')).rejects.toThrow(ApiError);
    });
  });

  describe('getPositions', () => {
    it('fetches positions for address', async () => {
      const positionsResponse: PositionsResponse = {
        positions: [
          {
            address: '0xabc',
            marketId: 'market-1',
            outcome: 'BALL',
            shares: 10,
            costPaid: 5,
            appSessionId: 'session-1',
            appSessionVersion: 1,
            timestamp: Date.now(),
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => positionsResponse,
      });

      const result = await getPositions('0xabc');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/positions/0xabc'
      );
      expect(result.positions).toHaveLength(1);
      expect(result.positions[0].outcome).toBe('BALL');
    });
  });

  describe('sport & category endpoints', () => {
    it('getSports fetches all sports', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sports: [
            { id: 'baseball', name: 'Baseball', description: null, createdAt: 1000 },
            { id: 'basketball', name: 'Basketball', description: null, createdAt: 1000 },
          ],
        }),
      });

      const result = await getSports();

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/sports');
      expect(result.sports).toHaveLength(2);
      expect(result.sports[0].id).toBe('baseball');
    });

    it('getSportCategories fetches categories for a sport', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sportId: 'baseball',
          categories: [
            { id: 'pitching', sportId: 'baseball', name: 'Pitching', outcomes: ['BALL', 'STRIKE'], description: null, createdAt: 1000 },
          ],
        }),
      });

      const result = await getSportCategories('baseball');

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/sports/baseball/categories');
      expect(result.sportId).toBe('baseball');
      expect(result.categories[0].outcomes).toEqual(['BALL', 'STRIKE']);
    });
  });

  describe('game endpoints', () => {
    it('getGames fetches all games', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          games: [
            { id: 'g1', sportId: 'baseball', homeTeamId: 'a', awayTeamId: 'b', status: 'ACTIVE', startedAt: 1000, completedAt: null, imagePath: null, metadata: null, createdAt: 1000 },
          ],
        }),
      });

      const result = await getGames();

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/games');
      expect(result.games).toHaveLength(1);
    });

    it('getGames passes query filters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ games: [] }),
      });

      await getGames({ sportId: 'basketball', status: 'ACTIVE' });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/games?sportId=basketball&status=ACTIVE'
      );
    });

    it('getGame fetches a specific game with markets', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          game: { id: 'g1', sportId: 'baseball', homeTeamId: 'a', awayTeamId: 'b', status: 'ACTIVE', startedAt: 1000, completedAt: null, imagePath: null, metadata: null, createdAt: 1000 },
          markets: [],
        }),
      });

      const result = await getGame('g1');

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/games/g1');
      expect(result.game.id).toBe('g1');
      expect(result.markets).toEqual([]);
    });

    it('createGame sends sportId, homeTeam, awayTeam', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          game: { id: 'g2', sportId: 'baseball', homeTeamId: 'x', awayTeamId: 'y', status: 'SCHEDULED', startedAt: null, completedAt: null, imagePath: null, metadata: null, createdAt: 1000 },
        }),
      });

      const result = await createGame('baseball', 'x', 'y');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/games',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ sportId: 'baseball', homeTeamId: 'x', awayTeamId: 'y' }),
        })
      );
      expect(result.success).toBe(true);
      expect(result.game.homeTeamId).toBe('x');
    });

    it('activateGame posts to activate endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          game: { id: 'g1', status: 'ACTIVE' },
        }),
      });

      const result = await activateGame('g1');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/games/g1/activate',
        expect.objectContaining({ method: 'POST' })
      );
      expect(result.success).toBe(true);
    });

    it('completeGame posts to complete endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          game: { id: 'g1', status: 'COMPLETED' },
        }),
      });

      const result = await completeGame('g1');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/games/g1/complete',
        expect.objectContaining({ method: 'POST' })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('oracle endpoints', () => {
    it('setGameState sends active state', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const result = await setGameState({ active: true });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/oracle/game-state',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ active: true }),
        })
      );
      expect(result.success).toBe(true);
    });

    it('openMarket returns marketId', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, marketId: 'game1-pitching-1' }),
      });

      const result = await openMarket({ gameId: 'game1', categoryId: 'pitching' });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/oracle/market/open',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ gameId: 'game1', categoryId: 'pitching' }),
        })
      );
      expect(result.marketId).toBe('game1-pitching-1');
    });

    it('closeMarket sends empty body by default', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, marketId: 'market-2' }),
      });

      const result = await closeMarket();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/oracle/market/close',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({}),
        })
      );
      expect(result.success).toBe(true);
    });

    it('closeMarket sends gameId and categoryId when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, marketId: 'game1-pitching-1' }),
      });

      await closeMarket({ gameId: 'game1', categoryId: 'pitching' });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/oracle/market/close',
        expect.objectContaining({
          body: JSON.stringify({ gameId: 'game1', categoryId: 'pitching' }),
        })
      );
    });

    it('resolveOutcome returns winners and losers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          marketId: 'market-1',
          outcome: 'BALL',
          winners: 1,
          losers: 1,
          totalPayout: 15,
        }),
      });

      const result = await resolveOutcome({ outcome: 'BALL' });

      expect(result.winners).toBe(1);
      expect(result.losers).toBe(1);
      expect(result.totalPayout).toBe(15);
    });

    it('resolveOutcome sends gameId and categoryId when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          marketId: 'game1-pitching-1',
          outcome: 'STRIKE',
          winners: 0,
          losers: 0,
          totalPayout: 0,
        }),
      });

      await resolveOutcome({ outcome: 'STRIKE', gameId: 'game1', categoryId: 'pitching' });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/oracle/outcome',
        expect.objectContaining({
          body: JSON.stringify({ outcome: 'STRIKE', gameId: 'game1', categoryId: 'pitching' }),
        })
      );
    });
  });

  describe('admin endpoints', () => {
    it('getAdminState fetches admin state', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          market: null,
          gameState: { active: false },
          positionCount: 0,
          connectionCount: 2,
          prices: [0.5, 0.5],
          outcomes: [],
          priceBall: 0.5,
          priceStrike: 0.5,
        }),
      });

      const result = await getAdminState();

      expect(result.gameState.active).toBe(false);
      expect(result.connectionCount).toBe(2);
      expect(result.prices).toEqual([0.5, 0.5]);
    });

    it('getAdminPositions fetches positions for a market', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          positions: [
            { address: '0xabc', marketId: 'market-1', outcome: 'BALL', shares: 10, costPaid: 5, appSessionId: 's1', appSessionVersion: 1, sessionStatus: 'open', timestamp: 1000 },
          ],
        }),
      });

      const result = await getAdminPositions('market-1');

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/admin/positions/market-1');
      expect(result.positions).toHaveLength(1);
      expect(result.positions[0].address).toBe('0xabc');
    });
  });

  describe('user endpoints', () => {
    it('getUserStats fetches user stats', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: {
            address: '0xAlice',
            totalBets: 5,
            totalWins: 3,
            totalLosses: 2,
            totalWagered: 50,
            totalPayout: 60,
            netPnl: 10,
            firstSeenAt: 1000,
            lastActiveAt: 2000,
          },
        }),
      });

      const result = await getUserStats('0xAlice');

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/users/0xAlice');
      expect(result.user.totalBets).toBe(5);
      expect(result.user.netPnl).toBe(10);
    });

    it('getUserHistory fetches settlement history', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          history: [
            { id: 1, marketId: 'm1', address: '0xAlice', outcome: 'BALL', result: 'WIN', shares: 10, costPaid: 5, payout: 10, profit: 5, appSessionId: 's1', settledAt: 1000 },
          ],
        }),
      });

      const result = await getUserHistory('0xAlice');

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/users/0xAlice/history');
      expect(result.history).toHaveLength(1);
      expect(result.history[0].result).toBe('WIN');
    });

    it('getLeaderboard fetches ranked users', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          leaderboard: [
            { address: '0xAlice', totalBets: 10, totalWins: 7, totalLosses: 3, totalWagered: 100, totalPayout: 120, netPnl: 20, firstSeenAt: 1000, lastActiveAt: 2000 },
          ],
        }),
      });

      const result = await getLeaderboard(5);

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/leaderboard?limit=5');
      expect(result.leaderboard).toHaveLength(1);
      expect(result.leaderboard[0].netPnl).toBe(20);
    });

    it('getLeaderboard works without limit', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ leaderboard: [] }),
      });

      await getLeaderboard();

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/leaderboard');
    });
  });

  describe('getMMInfo', () => {
    it('makes GET to /api/mm/info', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          address: '0xMM',
          balance: '10000000',
        }),
      });

      const result = await getMMInfo();

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/mm/info');
      expect(result.address).toBe('0xMM');
      expect(result.balance).toBe('10000000');
    });
  });

  describe('requestMMFaucet', () => {
    it('makes POST to /api/faucet/mm with count', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, funded: 5 }),
      });

      const result = await requestMMFaucet(5);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/faucet/mm',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ count: 5 }),
        })
      );
      expect(result.success).toBe(true);
      expect(result.funded).toBe(5);
    });

    it('defaults count to 1', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, funded: 1 }),
      });

      await requestMMFaucet();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/faucet/mm',
        expect.objectContaining({
          body: JSON.stringify({ count: 1 }),
        })
      );
    });
  });

  describe('requestUserFaucet', () => {
    it('makes POST to /api/faucet/user with address and count', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, funded: 5 }),
      });

      const result = await requestUserFaucet('0xAlice', 5);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/faucet/user',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: '0xAlice', count: 5 }),
        })
      );
      expect(result.success).toBe(true);
      expect(result.funded).toBe(5);
    });

    it('defaults count to 1', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, funded: 1 }),
      });

      await requestUserFaucet('0xAlice');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/faucet/user',
        expect.objectContaining({
          body: JSON.stringify({ address: '0xAlice', count: 1 }),
        })
      );
    });
  });

  // ── P2P Order Book ──

  describe('placeP2POrder', () => {
    it('sends P2P order request and returns response', async () => {
      const mockResponse = {
        orderId: 'order-1',
        status: 'OPEN',
        fills: [],
        order: { orderId: 'order-1', status: 'OPEN' },
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await placeP2POrder({
        marketId: 'market-1',
        gameId: 'game-1',
        userAddress: '0xAlice',
        outcome: 'BALL',
        mcps: 0.60,
        amount: 6,
        appSessionId: 'sess-1',
        appSessionVersion: 1,
      });

      expect(result.orderId).toBe('order-1');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/orderbook/order',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('cancelP2POrder', () => {
    it('sends DELETE request for order cancellation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ order: { orderId: 'order-1', status: 'CANCELLED' } }),
      });

      const result = await cancelP2POrder('order-1');
      expect(result.order.status).toBe('CANCELLED');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/orderbook/order/order-1',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('getOrderBookDepth', () => {
    it('fetches depth for a market', async () => {
      const mockDepth = {
        marketId: 'market-1',
        outcomes: { BALL: [], STRIKE: [] },
        updatedAt: Date.now(),
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDepth),
      });

      const result = await getOrderBookDepth('market-1');
      expect(result.marketId).toBe('market-1');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/orderbook/depth/market-1'
      );
    });
  });

  describe('getUserP2POrders', () => {
    it('fetches user P2P orders with optional marketId', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ orders: [] }),
      });

      const result = await getUserP2POrders('0xAlice', 'market-1');
      expect(result.orders).toEqual([]);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/orderbook/orders/0xAlice?marketId=market-1'
      );
    });
  });

  // ── LP Endpoints ──

  describe('getLPStats', () => {
    it('fetches pool stats', async () => {
      const stats = { poolValue: 5000, totalShares: 4800, sharePrice: 1.042, lpCount: 3, canWithdraw: true };
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => stats });

      const result = await getLPStats();
      expect(result).toEqual(stats);
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/lp/stats');
    });
  });

  describe('getLPShare', () => {
    it('fetches LP share for address', async () => {
      const share = { address: '0xLP', shares: 1000, totalDeposited: 1000, totalWithdrawn: 0 };
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => share });

      const result = await getLPShare('0xLP');
      expect(result.address).toBe('0xLP');
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/lp/share/0xLP');
    });
  });

  describe('getLPEvents', () => {
    it('fetches events with address and limit', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ events: [] }) });

      await getLPEvents('0xLP', 10);
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/lp/events?address=0xLP&limit=10');
    });

    it('fetches all events when no params', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ events: [] }) });

      await getLPEvents();
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/lp/events');
    });
  });

  describe('depositLP', () => {
    it('sends deposit request', async () => {
      const resp = { success: true, shares: 500, sharePrice: 1.0, poolValueAfter: 1500 };
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => resp });

      const result = await depositLP('0xLP', 500);
      expect(result.success).toBe(true);
      expect(result.shares).toBe(500);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/lp/deposit',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ address: '0xLP', amount: 500 }),
        })
      );
    });
  });

  describe('withdrawLP', () => {
    it('sends withdraw request', async () => {
      const resp = { success: true, amount: 500, sharePrice: 1.0, poolValueAfter: 500 };
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => resp });

      const result = await withdrawLP('0xLP', 500);
      expect(result.success).toBe(true);
      expect(result.amount).toBe(500);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/lp/withdraw',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ address: '0xLP', shares: 500 }),
        })
      );
    });
  });
});
