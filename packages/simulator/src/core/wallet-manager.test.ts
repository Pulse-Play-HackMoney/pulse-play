import { WalletManager } from './wallet-manager.js';
import type { SimConfig } from '../types.js';

describe('WalletManager', () => {
  let manager: WalletManager;

  beforeEach(() => {
    manager = new WalletManager();
  });

  describe('generateWallets', () => {
    it('generates N wallets with unique addresses', () => {
      const wallets = manager.generateWallets(5);
      expect(wallets).toHaveLength(5);
      const addresses = new Set(wallets.map((w) => w.address));
      expect(addresses.size).toBe(5);
    });

    it('assigns 1-based sequential indices', () => {
      const wallets = manager.generateWallets(3);
      expect(wallets.map((w) => w.index)).toEqual([1, 2, 3]);
    });

    it('continues index sequence when called again', () => {
      manager.generateWallets(2);
      const wallets = manager.generateWallets(2);
      expect(wallets.map((w) => w.index)).toEqual([3, 4]);
      expect(manager.count).toBe(4);
    });

    it('initializes wallets with default values', () => {
      const wallets = manager.generateWallets(1);
      expect(wallets[0]).toMatchObject({
        balance: '0',
        funded: false,
        side: null,
        maxBets: 0,
        betAmount: 0,
        delayMs: 0,
        betCount: 0,
        clearnodeStatus: 'idle',
      });
      expect(wallets[0].privateKey).toMatch(/^0x[a-f0-9]{64}$/);
      expect(wallets[0].address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });
  });

  describe('getAll', () => {
    it('returns a copy of all wallets', () => {
      manager.generateWallets(3);
      const all = manager.getAll();
      expect(all).toHaveLength(3);
      // Verify it's a copy
      all.pop();
      expect(manager.getAll()).toHaveLength(3);
    });
  });

  describe('get', () => {
    it('retrieves wallet by 1-based index', () => {
      manager.generateWallets(3);
      const wallet = manager.get(2);
      expect(wallet).toBeDefined();
      expect(wallet!.index).toBe(2);
    });

    it('returns undefined for non-existent index', () => {
      manager.generateWallets(1);
      expect(manager.get(99)).toBeUndefined();
    });
  });

  describe('getByAddress', () => {
    it('finds wallet by address (case-insensitive)', () => {
      manager.generateWallets(3);
      const target = manager.get(2)!;
      const found = manager.getByAddress(target.address.toLowerCase());
      expect(found).toBeDefined();
      expect(found!.index).toBe(2);
    });

    it('returns undefined for unknown address', () => {
      manager.generateWallets(1);
      expect(manager.getByAddress('0x0000000000000000000000000000000000000000')).toBeUndefined();
    });
  });

  describe('updateBalance', () => {
    it('updates balance for an existing wallet', () => {
      manager.generateWallets(2);
      manager.updateBalance(1, '5000000');
      expect(manager.get(1)!.balance).toBe('5000000');
    });

    it('does nothing for non-existent index', () => {
      manager.generateWallets(1);
      manager.updateBalance(99, '5000000'); // should not throw
    });
  });

  describe('markFunded', () => {
    it('marks a wallet as funded', () => {
      manager.generateWallets(2);
      expect(manager.get(1)!.funded).toBe(false);
      manager.markFunded(1);
      expect(manager.get(1)!.funded).toBe(true);
    });
  });

  describe('incrementBetCount', () => {
    it('increments bet count for a wallet', () => {
      manager.generateWallets(1);
      expect(manager.get(1)!.betCount).toBe(0);
      manager.incrementBetCount(1);
      manager.incrementBetCount(1);
      expect(manager.get(1)!.betCount).toBe(2);
    });
  });

  describe('updateClearnodeStatus', () => {
    it('updates clearnode connection status', () => {
      manager.generateWallets(1);
      manager.updateClearnodeStatus(1, 'connected');
      expect(manager.get(1)!.clearnodeStatus).toBe('connected');
    });
  });

  describe('clear', () => {
    it('removes all wallets', () => {
      manager.generateWallets(5);
      expect(manager.count).toBe(5);
      manager.clear();
      expect(manager.count).toBe(0);
      expect(manager.getAll()).toEqual([]);
    });
  });

  describe('generateProfiles', () => {
    const config: SimConfig = {
      outcomeBias: 0.6,
      outcomes: ['BALL', 'STRIKE'],
      betAmountMin: 1.0,
      betAmountMax: 5.0,
      delayMinMs: 1000,
      delayMaxMs: 3000,
      maxBetsPerWallet: 3,
    };

    it('assigns BALL or STRIKE to every wallet', () => {
      manager.generateWallets(10);
      manager.generateProfiles(config);
      const wallets = manager.getAll();
      for (const w of wallets) {
        expect(['BALL', 'STRIKE']).toContain(w.side);
      }
    });

    it('respects ballBias approximately', () => {
      manager.generateWallets(10);
      manager.generateProfiles(config);
      const wallets = manager.getAll();
      const ballCount = wallets.filter((w) => w.side === 'BALL').length;
      // With 0.6 bias and 10 wallets, expect 6 BALL
      expect(ballCount).toBe(6);
    });

    it('sets maxBets from config', () => {
      manager.generateWallets(3);
      manager.generateProfiles(config);
      for (const w of manager.getAll()) {
        expect(w.maxBets).toBe(3);
      }
    });

    it('sets betAmount within config range', () => {
      manager.generateWallets(20);
      manager.generateProfiles(config);
      for (const w of manager.getAll()) {
        expect(w.betAmount).toBeGreaterThanOrEqual(1.0);
        expect(w.betAmount).toBeLessThanOrEqual(5.0);
      }
    });

    it('sets delayMs within config range', () => {
      manager.generateWallets(20);
      manager.generateProfiles(config);
      for (const w of manager.getAll()) {
        expect(w.delayMs).toBeGreaterThanOrEqual(1000);
        expect(w.delayMs).toBeLessThanOrEqual(3000);
      }
    });

    it('resets betCount to 0', () => {
      manager.generateWallets(2);
      manager.incrementBetCount(1);
      manager.incrementBetCount(1);
      manager.generateProfiles(config);
      expect(manager.get(1)!.betCount).toBe(0);
    });
  });
});
