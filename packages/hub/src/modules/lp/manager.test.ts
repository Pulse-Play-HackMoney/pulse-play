import { createTestDb, type DrizzleDB } from '../../db/index.js';
import { LPManager } from './manager.js';

describe('LPManager', () => {
  let db: DrizzleDB;
  let lp: LPManager;

  beforeEach(() => {
    db = createTestDb();
    lp = new LPManager(db);
  });

  // ── getSharePrice ─────────────────────────────────────────────────────

  describe('getSharePrice', () => {
    it('returns 1.0 when pool is empty (no shares)', () => {
      expect(lp.getSharePrice(0)).toBe(1.0);
      expect(lp.getSharePrice(1000)).toBe(1.0);
    });

    it('returns poolValue / totalShares after deposits', () => {
      lp.recordDeposit('0xA', 500, 0);
      // Pool now has 500 shares at price 1.0 → pool value = 500
      expect(lp.getSharePrice(500)).toBe(1.0);
      expect(lp.getSharePrice(1000)).toBe(2.0);
    });
  });

  // ── recordDeposit ─────────────────────────────────────────────────────

  describe('recordDeposit', () => {
    it('first deposit: 1 share per dollar at price 1.0', () => {
      const result = lp.recordDeposit('0xA', 1000, 0);
      expect(result.shares).toBe(1000);
      expect(result.sharePrice).toBe(1.0);
      expect(result.poolValueBefore).toBe(0);
      expect(result.poolValueAfter).toBe(1000);
    });

    it('creates LP share record on first deposit', () => {
      lp.recordDeposit('0xA', 1000, 0);
      const share = lp.getShare('0xA');
      expect(share).not.toBeNull();
      expect(share!.shares).toBe(1000);
      expect(share!.totalDeposited).toBe(1000);
      expect(share!.totalWithdrawn).toBe(0);
    });

    it('subsequent deposit accumulates shares', () => {
      lp.recordDeposit('0xA', 1000, 0);
      // Pool is now worth 1000 with 1000 shares → price = 1.0
      const result = lp.recordDeposit('0xA', 500, 1000);
      expect(result.shares).toBe(500);
      expect(result.sharePrice).toBe(1.0);

      const share = lp.getShare('0xA');
      expect(share!.shares).toBe(1500);
      expect(share!.totalDeposited).toBe(1500);
    });

    it('deposit at appreciated share price gives fewer shares', () => {
      lp.recordDeposit('0xA', 1000, 0);
      // Pool appreciated to 2000 (MM earned) → price = 2.0
      const result = lp.recordDeposit('0xB', 1000, 2000);
      expect(result.sharePrice).toBe(2.0);
      expect(result.shares).toBe(500); // 1000 / 2.0

      const shareA = lp.getShare('0xA');
      const shareB = lp.getShare('0xB');
      expect(shareA!.shares).toBe(1000);
      expect(shareB!.shares).toBe(500);
    });

    it('deposit at depreciated share price gives more shares', () => {
      lp.recordDeposit('0xA', 1000, 0);
      // Pool lost value → 500 with 1000 shares → price = 0.5
      const result = lp.recordDeposit('0xB', 500, 500);
      expect(result.sharePrice).toBe(0.5);
      expect(result.shares).toBe(1000); // 500 / 0.5
    });

    it('rejects zero or negative amount', () => {
      expect(() => lp.recordDeposit('0xA', 0, 0)).toThrow('Deposit amount must be positive');
      expect(() => lp.recordDeposit('0xA', -100, 0)).toThrow('Deposit amount must be positive');
    });

    it('creates deposit event', () => {
      lp.recordDeposit('0xA', 1000, 0);
      const events = lp.getEvents('0xA');
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('DEPOSIT');
      expect(events[0].amount).toBe(1000);
      expect(events[0].shares).toBe(1000);
      expect(events[0].sharePrice).toBe(1.0);
      expect(events[0].poolValueBefore).toBe(0);
      expect(events[0].poolValueAfter).toBe(1000);
    });
  });

  // ── recordWithdrawal ──────────────────────────────────────────────────

  describe('recordWithdrawal', () => {
    it('withdraws proportional amount at current share price', () => {
      lp.recordDeposit('0xA', 1000, 0);
      const result = lp.recordWithdrawal('0xA', 500, 1000);
      expect(result.amount).toBe(500);
      expect(result.sharePrice).toBe(1.0);
      expect(result.poolValueBefore).toBe(1000);
      expect(result.poolValueAfter).toBe(500);

      const share = lp.getShare('0xA');
      expect(share!.shares).toBe(500);
      expect(share!.totalWithdrawn).toBe(500);
    });

    it('full withdrawal removes the LP record', () => {
      lp.recordDeposit('0xA', 1000, 0);
      lp.recordWithdrawal('0xA', 1000, 1000);

      const share = lp.getShare('0xA');
      expect(share).toBeNull();
    });

    it('withdraws at appreciated price (profit)', () => {
      lp.recordDeposit('0xA', 1000, 0);
      // Pool appreciated to 2000 → price = 2.0
      const result = lp.recordWithdrawal('0xA', 500, 2000);
      expect(result.sharePrice).toBe(2.0);
      expect(result.amount).toBe(1000); // 500 shares * $2.0
    });

    it('withdraws at depreciated price (loss)', () => {
      lp.recordDeposit('0xA', 1000, 0);
      // Pool depreciated to 500 → price = 0.5
      const result = lp.recordWithdrawal('0xA', 500, 500);
      expect(result.sharePrice).toBe(0.5);
      expect(result.amount).toBe(250); // 500 shares * $0.5
    });

    it('throws on insufficient shares', () => {
      lp.recordDeposit('0xA', 1000, 0);
      expect(() => lp.recordWithdrawal('0xA', 1500, 1000)).toThrow('Insufficient shares');
    });

    it('throws on unknown address', () => {
      expect(() => lp.recordWithdrawal('0xUnknown', 100, 1000)).toThrow('No LP position found');
    });

    it('rejects zero or negative shares', () => {
      lp.recordDeposit('0xA', 1000, 0);
      expect(() => lp.recordWithdrawal('0xA', 0, 1000)).toThrow('Shares to burn must be positive');
      expect(() => lp.recordWithdrawal('0xA', -10, 1000)).toThrow('Shares to burn must be positive');
    });

    it('creates withdrawal event', () => {
      lp.recordDeposit('0xA', 1000, 0);
      lp.recordWithdrawal('0xA', 500, 1000);
      const events = lp.getEvents('0xA');
      expect(events).toHaveLength(2);
      // Events are desc by timestamp — withdrawal first
      expect(events[0].type).toBe('WITHDRAWAL');
      expect(events[0].amount).toBe(500);
      expect(events[0].shares).toBe(500);
    });
  });

  // ── Multi-user scenarios ──────────────────────────────────────────────

  describe('multi-user', () => {
    it('multiple LPs share pool proportionally', () => {
      lp.recordDeposit('0xA', 1000, 0);       // 1000 shares at $1
      lp.recordDeposit('0xB', 1000, 1000);     // 1000 shares at $1

      expect(lp.getTotalShares()).toBe(2000);

      // Pool appreciates to 4000 → each share worth $2
      const shareA = lp.getShare('0xA');
      const shareB = lp.getShare('0xB');
      expect(shareA!.shares).toBe(1000);
      expect(shareB!.shares).toBe(1000);
      // At pool value 4000, each LP's value = 1000 * (4000/2000) = 2000
      expect(lp.getSharePrice(4000)).toBe(2.0);
    });

    it('getAllShares returns all LP positions', () => {
      lp.recordDeposit('0xA', 1000, 0);
      lp.recordDeposit('0xB', 500, 1000);
      const all = lp.getAllShares();
      expect(all).toHaveLength(2);
      const addresses = all.map(s => s.address).sort();
      expect(addresses).toEqual(['0xA', '0xB']);
    });
  });

  // ── canWithdraw ───────────────────────────────────────────────────────

  describe('canWithdraw', () => {
    it('allows withdrawal when no open markets and no unsettled positions', () => {
      const result = lp.canWithdraw(false, false);
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('locks when markets are open', () => {
      const result = lp.canWithdraw(true, false);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('OPEN');
    });

    it('locks when positions are unsettled', () => {
      const result = lp.canWithdraw(false, true);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('unsettled');
    });

    it('locks when both conditions present', () => {
      const result = lp.canWithdraw(true, true);
      expect(result.allowed).toBe(false);
    });
  });

  // ── getPoolStats ──────────────────────────────────────────────────────

  describe('getPoolStats', () => {
    it('returns empty stats for empty pool', () => {
      const stats = lp.getPoolStats(0, false, false);
      expect(stats.poolValue).toBe(0);
      expect(stats.totalShares).toBe(0);
      expect(stats.sharePrice).toBe(1.0);
      expect(stats.lpCount).toBe(0);
      expect(stats.canWithdraw).toBe(true);
    });

    it('returns correct stats with deposits', () => {
      lp.recordDeposit('0xA', 1000, 0);
      lp.recordDeposit('0xB', 500, 1000);
      const stats = lp.getPoolStats(1500, false, false);
      expect(stats.poolValue).toBe(1500);
      expect(stats.totalShares).toBe(1500);
      expect(stats.sharePrice).toBe(1.0);
      expect(stats.lpCount).toBe(2);
      expect(stats.canWithdraw).toBe(true);
    });

    it('includes lock reason when locked', () => {
      lp.recordDeposit('0xA', 1000, 0);
      const stats = lp.getPoolStats(1000, true, false);
      expect(stats.canWithdraw).toBe(false);
      expect(stats.withdrawLockReason).toBeDefined();
    });
  });

  // ── getEvents ─────────────────────────────────────────────────────────

  describe('getEvents', () => {
    it('returns events for a specific address', () => {
      lp.recordDeposit('0xA', 1000, 0);
      lp.recordDeposit('0xB', 500, 1000);
      const eventsA = lp.getEvents('0xA');
      const eventsB = lp.getEvents('0xB');
      expect(eventsA).toHaveLength(1);
      expect(eventsB).toHaveLength(1);
    });

    it('returns all events when no address provided', () => {
      lp.recordDeposit('0xA', 1000, 0);
      lp.recordDeposit('0xB', 500, 1000);
      const events = lp.getEvents();
      expect(events).toHaveLength(2);
    });

    it('respects limit parameter', () => {
      lp.recordDeposit('0xA', 100, 0);
      lp.recordDeposit('0xA', 200, 100);
      lp.recordDeposit('0xA', 300, 300);
      const events = lp.getEvents('0xA', 2);
      expect(events).toHaveLength(2);
    });

    it('returns events in descending timestamp order', () => {
      lp.recordDeposit('0xA', 100, 0);
      lp.recordDeposit('0xA', 200, 100);
      const events = lp.getEvents('0xA');
      // The later deposit should be first
      expect(events[0].amount).toBe(200);
      expect(events[1].amount).toBe(100);
    });
  });
});
