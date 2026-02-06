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
    it('posts to /api/oracle/market/open', async () => {
      mockFetch.mockResolvedValue(mockOk({ market: { id: 'market-1', status: 'OPEN' } }));

      const result = await client.openMarket();
      expect(result.market.id).toBe('market-1');
    });
  });

  describe('closeMarket', () => {
    it('posts to /api/oracle/market/close', async () => {
      mockFetch.mockResolvedValue(mockOk({ market: { id: 'market-1', status: 'CLOSED' } }));

      const result = await client.closeMarket();
      expect(result.market.status).toBe('CLOSED');
    });
  });

  describe('resolveMarket', () => {
    it('posts outcome to /api/oracle/outcome', async () => {
      mockFetch.mockResolvedValue(mockOk({ market: { id: 'market-1', status: 'RESOLVED', outcome: 'BALL' } }));

      const result = await client.resolveMarket('BALL');
      expect(result.market.outcome).toBe('BALL');
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.outcome).toBe('BALL');
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
  });
});
