import { HubClient } from './hub-client.js';

// Mock global fetch
const mockFetch = jest.fn();
globalThis.fetch = mockFetch;

function mockOk(body: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) };
}

function mockError(status: number, message: string) {
  return { ok: false, status, json: () => Promise.resolve({ error: message }), text: () => Promise.resolve(message) };
}

describe('HubClient', () => {
  let client: HubClient;

  beforeEach(() => {
    client = new HubClient({ restUrl: 'http://localhost:3001' });
    mockFetch.mockReset();
  });

  describe('placeBet', () => {
    it('posts to /api/bet and returns response', async () => {
      const betResponse = { accepted: true, shares: 2.5, newPriceBall: 0.6, newPriceStrike: 0.4 };
      mockFetch.mockResolvedValue(mockOk(betResponse));

      const result = await client.placeBet({
        address: '0xABC',
        marketId: 'market-1',
        outcome: 'BALL',
        amount: 2.0,
        appSessionId: '0xSESSION',
        appSessionVersion: 1,
      });

      expect(result).toEqual(betResponse);
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: '0xABC',
          marketId: 'market-1',
          outcome: 'BALL',
          amount: 2.0,
          appSessionId: '0xSESSION',
          appSessionVersion: 1,
        }),
      });
    });

    it('throws on error response', async () => {
      mockFetch.mockResolvedValue(mockError(400, 'Market is not open'));
      await expect(client.placeBet({
        address: '0xABC',
        marketId: 'market-1',
        outcome: 'BALL',
        amount: 2.0,
        appSessionId: '0xSESSION',
        appSessionVersion: 1,
      })).rejects.toThrow('Hub /api/bet failed (400): Market is not open');
    });
  });

  describe('fundUser', () => {
    it('posts to /api/faucet/user with address and count', async () => {
      mockFetch.mockResolvedValue(mockOk({ success: true, funded: 5 }));

      const result = await client.fundUser('0xABC', 5);
      expect(result).toEqual({ success: true, funded: 5 });
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/faucet/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: '0xABC', count: 5 }),
      });
    });

    it('defaults count to 1', async () => {
      mockFetch.mockResolvedValue(mockOk({ success: true, funded: 1 }));

      await client.fundUser('0xABC');
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.count).toBe(1);
    });
  });

  describe('fundMM', () => {
    it('posts to /api/faucet/mm with count', async () => {
      mockFetch.mockResolvedValue(mockOk({ success: true, funded: 3 }));

      const result = await client.fundMM(3);
      expect(result).toEqual({ success: true, funded: 3 });
    });
  });

  describe('setGameState', () => {
    it('posts to /api/oracle/game-state', async () => {
      mockFetch.mockResolvedValue(mockOk({ active: true }));

      const result = await client.setGameState(true);
      expect(result).toEqual({ active: true });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.active).toBe(true);
    });
  });

  describe('openMarket', () => {
    it('posts to /api/oracle/market/open with gameId and categoryId', async () => {
      mockFetch.mockResolvedValue(mockOk({ success: true, marketId: 'game1-pitching-1' }));

      const result = await client.openMarket('game1', 'pitching');
      expect(result.marketId).toBe('game1-pitching-1');
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/oracle/market/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: 'game1', categoryId: 'pitching' }),
      });
    });
  });

  describe('closeMarket', () => {
    it('posts to /api/oracle/market/close with empty body by default', async () => {
      mockFetch.mockResolvedValue(mockOk({ success: true, marketId: 'game1-pitching-1' }));

      const result = await client.closeMarket();
      expect(result.success).toBe(true);
      expect(result.marketId).toBe('game1-pitching-1');
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body).toEqual({});
    });

    it('passes gameId and categoryId when provided', async () => {
      mockFetch.mockResolvedValue(mockOk({ success: true, marketId: 'game1-pitching-1' }));

      await client.closeMarket('game1', 'pitching');
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body).toEqual({ gameId: 'game1', categoryId: 'pitching' });
    });
  });

  describe('resolveMarket', () => {
    it('posts outcome to /api/oracle/outcome', async () => {
      mockFetch.mockResolvedValue(mockOk({ success: true, marketId: 'game1-pitching-1', outcome: 'BALL', winners: 2, losers: 1, totalPayout: 15 }));

      const result = await client.resolveMarket('BALL');
      expect(result.outcome).toBe('BALL');
      expect(result.winners).toBe(2);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.outcome).toBe('BALL');
    });

    it('passes gameId and categoryId when provided', async () => {
      mockFetch.mockResolvedValue(mockOk({ success: true, marketId: 'game1-pitching-1', outcome: 'BALL', winners: 1, losers: 0, totalPayout: 5 }));

      await client.resolveMarket('BALL', 'game1', 'pitching');
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body).toEqual({ outcome: 'BALL', gameId: 'game1', categoryId: 'pitching' });
    });
  });

  describe('createGame', () => {
    it('posts to /api/games', async () => {
      mockFetch.mockResolvedValue(mockOk({ success: true, game: { id: 'game-1', status: 'SCHEDULED' } }));

      const result = await client.createGame('baseball', 'nyy', 'bos');
      expect(result.game.id).toBe('game-1');
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sportId: 'baseball', homeTeamId: 'nyy', awayTeamId: 'bos' }),
      });
    });
  });

  describe('activateGame', () => {
    it('posts to /api/games/:gameId/activate', async () => {
      mockFetch.mockResolvedValue(mockOk({ success: true, game: { id: 'game-1', status: 'ACTIVE' } }));

      const result = await client.activateGame('game-1');
      expect(result.game.id).toBe('game-1');
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/games/game-1/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
    });
  });

  describe('getGames', () => {
    it('fetches /api/games with no params by default', async () => {
      mockFetch.mockResolvedValue(mockOk({ games: [{ id: 'g1', sportId: 'baseball', status: 'ACTIVE' }] }));

      const result = await client.getGames();
      expect(result.games).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/games');
    });

    it('passes sportId and status as query params', async () => {
      mockFetch.mockResolvedValue(mockOk({ games: [] }));

      await client.getGames({ sportId: 'baseball', status: 'ACTIVE' });
      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain('sportId=baseball');
      expect(url).toContain('status=ACTIVE');
    });
  });

  describe('getTeams', () => {
    it('fetches /api/teams with no params by default', async () => {
      mockFetch.mockResolvedValue(mockOk({ teams: [{ id: 'nyy', name: 'Yankees', abbreviation: 'NYY', sportId: 'baseball' }] }));

      const result = await client.getTeams();
      expect(result.teams).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/teams');
    });

    it('passes sportId as query param', async () => {
      mockFetch.mockResolvedValue(mockOk({ teams: [] }));

      await client.getTeams('baseball');
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/teams?sportId=baseball');
    });
  });

  describe('getState', () => {
    it('fetches /api/admin/state', async () => {
      const state = {
        market: { id: 'market-1', status: 'OPEN', outcome: null, qBall: 0, qStrike: 0, b: 100 },
        gameState: { active: true },
        positionCount: 5,
        connectionCount: 2,
        sessionCounts: { open: 3, settled: 2 },
      };
      mockFetch.mockResolvedValue(mockOk(state));

      const result = await client.getState();
      expect(result).toEqual(state);
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/admin/state');
    });
  });

  describe('getMMInfo', () => {
    it('fetches /api/mm/info', async () => {
      const info = { address: '0xMM', balance: '50000000', isConnected: true };
      mockFetch.mockResolvedValue(mockOk(info));

      const result = await client.getMMInfo();
      expect(result).toEqual(info);
    });
  });

  describe('getPositions', () => {
    it('fetches /api/admin/positions/:marketId', async () => {
      const positions = { positions: [{ marketId: 'market-1', address: '0xA', outcome: 'BALL', shares: 2, costPaid: 1 }] };
      mockFetch.mockResolvedValue(mockOk(positions));

      const result = await client.getPositions('market-1');
      expect(result.positions).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/admin/positions/market-1');
    });
  });

  describe('resetBackend', () => {
    it('posts to /api/admin/reset', async () => {
      mockFetch.mockResolvedValue(mockOk({ success: true }));

      const result = await client.resetBackend();
      expect(result).toEqual({ success: true });
    });
  });

  describe('error handling', () => {
    it('throws when fetch itself rejects', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      await expect(client.getState()).rejects.toThrow('Network error');
    });

    it('strips trailing slash from restUrl', async () => {
      const client2 = new HubClient({ restUrl: 'http://localhost:3001/' });
      mockFetch.mockResolvedValue(mockOk({ success: true }));

      await client2.resetBackend();
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/admin/reset', expect.any(Object));
    });

    it('extracts error field from JSON error response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('{"error":"Market not found"}'),
      });

      await expect(client.getState()).rejects.toThrow('Market not found');
    });

    it('extracts reason field from JSON error response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('{"reason":"Invalid outcome"}'),
      });

      await expect(client.placeBet({
        address: '0xABC',
        marketId: 'market-1',
        outcome: 'BALL',
        amount: 2.0,
        appSessionId: '0xSESSION',
        appSessionVersion: 1,
      })).rejects.toThrow('Invalid outcome');
    });

    it('falls back to raw text for non-JSON errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      await expect(client.getState()).rejects.toThrow('Hub /api/admin/state failed (500): Internal Server Error');
    });
  });

  // ── P2P Order Book Methods ──

  describe('placeP2POrder', () => {
    it('posts to /api/orderbook/order and returns response', async () => {
      const orderResponse = { orderId: 'order-1', status: 'OPEN', fills: [], order: {} };
      mockFetch.mockResolvedValue(mockOk(orderResponse));

      const result = await client.placeP2POrder({
        marketId: 'market-1',
        gameId: 'game-1',
        userAddress: '0xABC',
        outcome: 'BALL',
        mcps: 0.60,
        amount: 6,
        appSessionId: '0xSESSION',
        appSessionVersion: 1,
      });

      expect(result).toEqual(orderResponse);
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/orderbook/order', expect.objectContaining({
        method: 'POST',
      }));
    });
  });

  describe('cancelP2POrder', () => {
    it('sends DELETE to /api/orderbook/order/:orderId', async () => {
      mockFetch.mockResolvedValue(mockOk({ order: { orderId: 'order-1', status: 'CANCELLED' } }));

      const result = await client.cancelP2POrder('order-1');

      expect(result.order.status).toBe('CANCELLED');
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/orderbook/order/order-1', { method: 'DELETE' });
    });
  });

  describe('getOrderBookDepth', () => {
    it('fetches depth for a market', async () => {
      const depth = { marketId: 'market-1', outcomes: { BALL: [{ price: 0.60, shares: 10, orderCount: 2 }] }, updatedAt: 123 };
      mockFetch.mockResolvedValue(mockOk(depth));

      const result = await client.getOrderBookDepth('market-1');

      expect(result.marketId).toBe('market-1');
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/orderbook/depth/market-1');
    });
  });

  describe('getUserP2POrders', () => {
    it('fetches user orders', async () => {
      mockFetch.mockResolvedValue(mockOk({ orders: [{ orderId: 'order-1' }] }));

      const result = await client.getUserP2POrders('0xABC');

      expect(result.orders).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/orderbook/orders/0xABC');
    });

    it('includes marketId query param when provided', async () => {
      mockFetch.mockResolvedValue(mockOk({ orders: [] }));

      await client.getUserP2POrders('0xABC', 'market-5');

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/orderbook/orders/0xABC?marketId=market-5');
    });
  });
});
