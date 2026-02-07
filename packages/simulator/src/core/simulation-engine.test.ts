import { SimulationEngine } from './simulation-engine.js';
import type { SimEvent, SimConfig } from '../types.js';

// ── Mocks ──

function createMockWalletManager() {
  const wallets: Array<{
    index: number;
    address: string;
    privateKey: string;
    balance: string;
    funded: boolean;
    side: string | null;
    maxBets: number;
    betAmount: number;
    delayMs: number;
    betCount: number;
    clearnodeStatus: string;
  }> = [];

  return {
    generateWallets: jest.fn((count: number) => {
      for (let i = 0; i < count; i++) {
        wallets.push({
          index: wallets.length + 1,
          address: `0x${String(wallets.length + 1).padStart(40, '0')}`,
          privateKey: `0x${String(wallets.length + 1).padStart(64, '0')}`,
          balance: '10000000',
          funded: true,
          side: null,
          maxBets: 0,
          betAmount: 0,
          delayMs: 0,
          betCount: 0,
          clearnodeStatus: 'idle',
        });
      }
      return [...wallets];
    }),
    getAll: jest.fn(() => [...wallets]),
    get: jest.fn((index: number) => wallets.find((w) => w.index === index)),
    getByAddress: jest.fn(),
    updateBalance: jest.fn(),
    markFunded: jest.fn(),
    incrementBetCount: jest.fn((index: number) => {
      const w = wallets.find((w) => w.index === index);
      if (w) w.betCount++;
    }),
    updateClearnodeStatus: jest.fn(),
    clear: jest.fn(),
    count: 0,
    generateProfiles: jest.fn((config: SimConfig) => {
      const bias = config.outcomeBias ?? config.ballBias ?? 0.5;
      const ballCount = Math.round(wallets.length * bias);
      for (let i = 0; i < wallets.length; i++) {
        wallets[i].side = i < ballCount ? 'BALL' : 'STRIKE';
        wallets[i].maxBets = config.maxBetsPerWallet;
        wallets[i].betAmount = (config.betAmountMin + config.betAmountMax) / 2;
        wallets[i].delayMs = (config.delayMinMs + config.delayMaxMs) / 2;
        wallets[i].betCount = 0;
      }
    }),
  };
}

function createMockHubClient() {
  return {
    placeBet: jest.fn().mockResolvedValue({ accepted: true, shares: 2.5 }),
    fundUser: jest.fn(),
    fundMM: jest.fn(),
    setGameState: jest.fn(),
    openMarket: jest.fn(),
    closeMarket: jest.fn(),
    resolveMarket: jest.fn(),
    getState: jest.fn(),
    getMMInfo: jest.fn(),
    getPositions: jest.fn(),
    resetBackend: jest.fn(),
  };
}

function createMockClearnodePool() {
  return {
    addWallet: jest.fn(),
    removeWallet: jest.fn(),
    ensureConnected: jest.fn().mockResolvedValue(undefined),
    createAppSession: jest.fn().mockResolvedValue({
      appSessionId: '0xSESSION',
      version: 1,
      status: 'open',
    }),
    getBalance: jest.fn().mockResolvedValue('45000000'),
    getStatus: jest.fn().mockReturnValue('connected'),
    getStats: jest.fn().mockReturnValue({ total: 0, connected: 0, error: 0 }),
    disconnectAll: jest.fn(),
    clear: jest.fn(),
  };
}

// ── Tests ──

describe('SimulationEngine', () => {
  let engine: SimulationEngine;
  let walletManager: ReturnType<typeof createMockWalletManager>;
  let hubClient: ReturnType<typeof createMockHubClient>;
  let clearnodePool: ReturnType<typeof createMockClearnodePool>;
  let events: SimEvent[];

  beforeEach(() => {
    jest.useFakeTimers();
    walletManager = createMockWalletManager();
    hubClient = createMockHubClient();
    clearnodePool = createMockClearnodePool();
    events = [];

    engine = new SimulationEngine(
      {
        walletManager: walletManager as any,
        hubClient: hubClient as any,
        clearnodePool: clearnodePool as any,
      },
      (event) => events.push(event),
    );

    // Generate some wallets first
    walletManager.generateWallets(3);
  });

  afterEach(() => {
    engine.stop();
    jest.useRealTimers();
  });

  describe('config', () => {
    it('has default config', () => {
      const config = engine.getConfig();
      expect(config.outcomeBias).toBe(0.5);
      expect(config.maxBetsPerWallet).toBe(3);
    });

    it('merges partial config', () => {
      engine.setConfig({ outcomeBias: 0.7, maxBetsPerWallet: 5 });
      const config = engine.getConfig();
      expect(config.outcomeBias).toBe(0.7);
      expect(config.maxBetsPerWallet).toBe(5);
      // Others stay default
      expect(config.betAmountMin).toBe(1.0);
    });
  });

  describe('start / stop lifecycle', () => {
    it('starts with running status', () => {
      engine.start('market-1', '0xMM');
      expect(engine.getStatus()).toBe('running');
    });

    it('stops and clears timers', () => {
      engine.start('market-1', '0xMM');
      engine.stop();
      expect(engine.getStatus()).toBe('idle');
    });

    it('emits sim-started event on start', () => {
      engine.start('market-1', '0xMM');
      expect(events).toContainEqual(expect.objectContaining({ type: 'sim-started' }));
    });

    it('emits sim-stopped event on stop', () => {
      engine.start('market-1', '0xMM');
      engine.stop();
      expect(events).toContainEqual(expect.objectContaining({ type: 'sim-stopped' }));
    });

    it('does not double-start', () => {
      engine.start('market-1', '0xMM');
      engine.start('market-1', '0xMM');
      const startEvents = events.filter((e) => e.type === 'sim-started');
      expect(startEvents).toHaveLength(1);
    });

    it('does nothing if stop called when idle', () => {
      engine.stop();
      const stopEvents = events.filter((e) => e.type === 'sim-stopped');
      expect(stopEvents).toHaveLength(0);
    });
  });

  describe('profile generation', () => {
    it('calls walletManager.generateProfiles on start', () => {
      engine.start('market-1', '0xMM');
      expect(walletManager.generateProfiles).toHaveBeenCalledWith(engine.getConfig());
    });
  });

  describe('bet execution', () => {
    it('creates app session and places bet after timer fires', async () => {
      engine.setConfig({ delayMinMs: 100, delayMaxMs: 200, maxBetsPerWallet: 1 });
      engine.start('market-1', '0xMM');

      // Advance timers to fire the first batch
      jest.advanceTimersByTime(200);
      // Allow async operations to complete
      await jest.advanceTimersByTimeAsync(200);

      expect(clearnodePool.createAppSession).toHaveBeenCalled();
      expect(hubClient.placeBet).toHaveBeenCalled();
    });

    it('passes V1 sessionData to createAppSession', async () => {
      engine.setConfig({ delayMinMs: 10, delayMaxMs: 20, maxBetsPerWallet: 1 });
      engine.start('market-1', '0xMM');

      jest.advanceTimersByTime(50);
      await jest.advanceTimersByTimeAsync(50);

      expect(clearnodePool.createAppSession).toHaveBeenCalledWith(
        expect.any(String),   // bettorAddress
        expect.any(String),   // mmAddress
        expect.any(String),   // amount
        expect.stringContaining('"v":1'),  // V1 sessionData
      );

      // Verify sessionData content
      const sessionDataArg = clearnodePool.createAppSession.mock.calls[0][3];
      const parsed = JSON.parse(sessionDataArg);
      expect(parsed.v).toBe(1);
      expect(parsed.marketId).toBe('market-1');
      expect(parsed.outcome).toMatch(/^(BALL|STRIKE)$/);
      expect(parsed.amount).toBeGreaterThan(0);
      expect(parsed.timestamp).toEqual(expect.any(Number));
    });

    it('enforces maxBetsPerWallet limit', async () => {
      engine.setConfig({ delayMinMs: 10, delayMaxMs: 20, maxBetsPerWallet: 1 });
      engine.start('market-1', '0xMM');

      // Fire enough timers for multiple rounds
      for (let i = 0; i < 10; i++) {
        jest.advanceTimersByTime(50);
        await jest.advanceTimersByTimeAsync(50);
      }

      // Each wallet should place at most 1 bet
      for (const [, count] of engine.getBetCounts()) {
        expect(count).toBeLessThanOrEqual(1);
      }
    });

    it('handles bet rejection gracefully', async () => {
      hubClient.placeBet.mockResolvedValue({ accepted: false, reason: 'Market closed' });
      engine.setConfig({ delayMinMs: 10, delayMaxMs: 20, maxBetsPerWallet: 2 });
      engine.start('market-1', '0xMM');

      jest.advanceTimersByTime(50);
      await jest.advanceTimersByTimeAsync(50);

      const rejections = events.filter((e) => e.type === 'bet-rejected');
      expect(rejections.length).toBeGreaterThan(0);
    });

    it('handles session errors and continues simulation', async () => {
      clearnodePool.createAppSession.mockRejectedValueOnce(new Error('WebSocket failed'));
      engine.setConfig({ delayMinMs: 10, delayMaxMs: 20, maxBetsPerWallet: 2 });
      engine.start('market-1', '0xMM');

      jest.advanceTimersByTime(50);
      await jest.advanceTimersByTimeAsync(50);

      const errors = events.filter((e) => e.type === 'session-error');
      expect(errors.length).toBeGreaterThan(0);

      // Engine should still be running
      expect(engine.getStatus()).toBe('running');
    });

    it('refreshes wallet balance after successful bet', async () => {
      engine.setConfig({ delayMinMs: 10, delayMaxMs: 20, maxBetsPerWallet: 1 });
      engine.start('market-1', '0xMM');

      jest.advanceTimersByTime(50);
      await jest.advanceTimersByTimeAsync(50);

      expect(clearnodePool.getBalance).toHaveBeenCalled();
      expect(walletManager.updateBalance).toHaveBeenCalled();
    });

    it('continues gracefully when balance refresh fails', async () => {
      clearnodePool.getBalance.mockRejectedValue(new Error('Balance fetch failed'));
      engine.setConfig({ delayMinMs: 10, delayMaxMs: 20, maxBetsPerWallet: 1 });
      engine.start('market-1', '0xMM');

      jest.advanceTimersByTime(50);
      await jest.advanceTimersByTimeAsync(50);

      // Bet should still be placed successfully
      const placed = events.filter((e) => e.type === 'bet-placed');
      expect(placed.length).toBeGreaterThan(0);
      expect(engine.getStatus()).toBe('running');
    });

    it('handles generic bet errors and continues', async () => {
      hubClient.placeBet.mockRejectedValueOnce(new Error('Network error'));
      engine.setConfig({ delayMinMs: 10, delayMaxMs: 20, maxBetsPerWallet: 2 });
      engine.start('market-1', '0xMM');

      jest.advanceTimersByTime(50);
      await jest.advanceTimersByTimeAsync(50);

      const errors = events.filter((e) => e.type === 'bet-failed');
      expect(errors.length).toBeGreaterThan(0);
      expect(engine.getStatus()).toBe('running');
    });
  });

  describe('betCounts', () => {
    it('starts with empty counts', () => {
      expect(engine.getBetCounts().size).toBe(0);
    });

    it('tracks counts per wallet after bets', async () => {
      engine.setConfig({ delayMinMs: 10, delayMaxMs: 20, maxBetsPerWallet: 1 });
      engine.start('market-1', '0xMM');

      for (let i = 0; i < 5; i++) {
        jest.advanceTimersByTime(50);
        await jest.advanceTimersByTimeAsync(50);
      }

      const counts = engine.getBetCounts();
      // Should have entries for each wallet
      expect(counts.size).toBeGreaterThan(0);
    });
  });
});
