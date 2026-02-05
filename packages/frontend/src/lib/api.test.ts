import {
  placeBet,
  getMarket,
  getPositions,
  setGameState,
  openMarket,
  closeMarket,
  resolveOutcome,
  getAdminState,
  getMMInfo,
  requestMMFaucet,
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
        })
      ).rejects.toThrow(ApiError);
    });
  });

  describe('getMarket', () => {
    it('fetches current market state', async () => {
      const marketResponse: MarketResponse = {
        market: {
          id: 'market-1',
          status: 'OPEN',
          outcome: null,
          qBall: 0,
          qStrike: 0,
          b: 100,
        },
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
      expect(result.priceBall).toBe(0.5);
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
        json: async () => ({ success: true, marketId: 'market-2' }),
      });

      const result = await openMarket({ pitchId: 'pitch-1' });

      expect(result.marketId).toBe('market-2');
    });

    it('closeMarket returns marketId', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, marketId: 'market-2' }),
      });

      const result = await closeMarket();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/oracle/market/close',
        expect.objectContaining({ method: 'POST' })
      );
      expect(result.success).toBe(true);
    });

    it('resolveOutcome returns winners and losers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          winners: ['0x111'],
          losers: ['0x222'],
          totalPayout: 15,
        }),
      });

      const result = await resolveOutcome({ outcome: 'BALL' });

      expect(result.winners).toContain('0x111');
      expect(result.losers).toContain('0x222');
      expect(result.totalPayout).toBe(15);
    });
  });

  describe('getAdminState', () => {
    it('fetches admin state', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          market: null,
          gameState: { active: false },
          positionCount: 0,
          connectionCount: 2,
        }),
      });

      const result = await getAdminState();

      expect(result.gameState.active).toBe(false);
      expect(result.connectionCount).toBe(2);
    });
  });

  describe('getMMInfo', () => {
    it('makes GET to /api/mm/info', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          address: '0xMM',
          balance: '10000000',
          isConnected: true,
        }),
      });

      const result = await getMMInfo();

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/mm/info');
      expect(result.address).toBe('0xMM');
      expect(result.balance).toBe('10000000');
      expect(result.isConnected).toBe(true);
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
});
