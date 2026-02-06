import { MarketManager } from './manager';
import type { Position } from '../position/types';

describe('MarketManager', () => {
  let manager: MarketManager;

  beforeEach(() => {
    manager = new MarketManager(100);
  });

  // ─── Market creation ───────────────────────────────────────────

  describe('createMarket', () => {
    test('1. createMarket() returns market with status PENDING', () => {
      const market = manager.createMarket('m1');
      expect(market.status).toBe('PENDING');
    });

    test('2. New market has qBall=0, qStrike=0, configured b', () => {
      const market = manager.createMarket('m1');
      expect(market.qBall).toBe(0);
      expect(market.qStrike).toBe(0);
      expect(market.b).toBe(100);
    });

    test('3. New market has null outcome and null timestamps', () => {
      const market = manager.createMarket('m1');
      expect(market.outcome).toBeNull();
      expect(market.openedAt).toBeNull();
      expect(market.closedAt).toBeNull();
      expect(market.resolvedAt).toBeNull();
    });
  });

  // ─── Valid state transitions ───────────────────────────────────

  describe('valid state transitions', () => {
    test('4. PENDING → OPEN via openMarket()', () => {
      manager.createMarket('m1');
      const market = manager.openMarket('m1');
      expect(market.status).toBe('OPEN');
    });

    test('5. OPEN → CLOSED via closeMarket()', () => {
      manager.createMarket('m1');
      manager.openMarket('m1');
      const market = manager.closeMarket('m1');
      expect(market.status).toBe('CLOSED');
    });

    test('6. CLOSED → RESOLVED via resolveMarket(outcome)', () => {
      manager.createMarket('m1');
      manager.openMarket('m1');
      manager.closeMarket('m1');
      manager.resolveMarket('m1', 'BALL');
      const market = manager.getMarket('m1');
      expect(market!.status).toBe('RESOLVED');
    });
  });

  // ─── Invalid state transitions ─────────────────────────────────

  describe('invalid state transitions', () => {
    test('7. PENDING → CLOSED throws error', () => {
      manager.createMarket('m1');
      expect(() => manager.closeMarket('m1')).toThrow('Invalid transition');
    });

    test('8. PENDING → RESOLVED throws error', () => {
      manager.createMarket('m1');
      expect(() => manager.resolveMarket('m1', 'BALL')).toThrow('Invalid transition');
    });

    test('9. OPEN → RESOLVED throws error (must close first)', () => {
      manager.createMarket('m1');
      manager.openMarket('m1');
      expect(() => manager.resolveMarket('m1', 'BALL')).toThrow('Invalid transition');
    });

    test('10. OPEN → PENDING throws error (no going back)', () => {
      manager.createMarket('m1');
      manager.openMarket('m1');
      // There's no "pendMarket" method, but we can verify the transition table
      // by trying openMarket again (OPEN → OPEN is also invalid)
      expect(() => manager.openMarket('m1')).toThrow('Invalid transition');
    });

    test('11. CLOSED → OPEN throws error', () => {
      manager.createMarket('m1');
      manager.openMarket('m1');
      manager.closeMarket('m1');
      expect(() => manager.openMarket('m1')).toThrow('Invalid transition');
    });

    test('12. RESOLVED → any state throws error (terminal)', () => {
      manager.createMarket('m1');
      manager.openMarket('m1');
      manager.closeMarket('m1');
      manager.resolveMarket('m1', 'BALL');
      expect(() => manager.openMarket('m1')).toThrow('Invalid transition');
      expect(() => manager.closeMarket('m1')).toThrow('Invalid transition');
      expect(() => manager.resolveMarket('m1', 'STRIKE')).toThrow('Invalid transition');
    });
  });

  // ─── Market operations ─────────────────────────────────────────

  describe('market operations', () => {
    test('13. openMarket() sets openedAt timestamp', () => {
      manager.createMarket('m1');
      const before = Date.now();
      const market = manager.openMarket('m1');
      expect(market.openedAt).toBeGreaterThanOrEqual(before);
      expect(market.openedAt).toBeLessThanOrEqual(Date.now());
    });

    test('14. closeMarket() sets closedAt timestamp', () => {
      manager.createMarket('m1');
      manager.openMarket('m1');
      const before = Date.now();
      const market = manager.closeMarket('m1');
      expect(market.closedAt).toBeGreaterThanOrEqual(before);
    });

    test('15. resolveMarket() sets outcome and resolvedAt timestamp', () => {
      manager.createMarket('m1');
      manager.openMarket('m1');
      manager.closeMarket('m1');
      const before = Date.now();
      manager.resolveMarket('m1', 'STRIKE');
      const market = manager.getMarket('m1')!;
      expect(market.outcome).toBe('STRIKE');
      expect(market.resolvedAt).toBeGreaterThanOrEqual(before);
    });

    test('16. getCurrentMarket() returns the active market', () => {
      manager.createMarket('m1');
      const current = manager.getCurrentMarket();
      expect(current).not.toBeNull();
      expect(current!.id).toBe('m1');
    });

    test('17. updateQuantities() updates qBall and qStrike', () => {
      manager.createMarket('m1');
      manager.updateQuantities('m1', 42, 58);
      const market = manager.getMarket('m1')!;
      expect(market.qBall).toBe(42);
      expect(market.qStrike).toBe(58);
    });
  });

  // ─── Resolution logic ──────────────────────────────────────────

  describe('resolution logic', () => {
    const positions: Position[] = [
      { address: '0xAAA', marketId: 'm1', outcome: 'BALL', shares: 12, costPaid: 8, appSessionId: 's1', appSessionVersion: 1, sessionStatus: 'open', timestamp: 1 },
      { address: '0xBBB', marketId: 'm1', outcome: 'STRIKE', shares: 15, costPaid: 10, appSessionId: 's2', appSessionVersion: 1, sessionStatus: 'open', timestamp: 2 },
      { address: '0xCCC', marketId: 'm1', outcome: 'BALL', shares: 20, costPaid: 14, appSessionId: 's3', appSessionVersion: 1, sessionStatus: 'open', timestamp: 3 },
    ];

    test('18. resolveMarket(BALL) correctly identifies Ball bettors as winners', () => {
      manager.createMarket('m1');
      manager.openMarket('m1');
      manager.closeMarket('m1');
      const result = manager.resolveMarket('m1', 'BALL', positions);
      expect(result.winners).toHaveLength(2);
      expect(result.winners.map((w) => w.address)).toEqual(['0xAAA', '0xCCC']);
    });

    test('19. resolveMarket(STRIKE) correctly identifies Strike bettors as winners', () => {
      manager = new MarketManager(100);
      manager.createMarket('m1');
      manager.openMarket('m1');
      manager.closeMarket('m1');
      const result = manager.resolveMarket('m1', 'STRIKE', positions);
      expect(result.winners).toHaveLength(1);
      expect(result.winners[0].address).toBe('0xBBB');
    });

    test('20. Resolution returns payout amounts (shares) for winners', () => {
      manager.createMarket('m1');
      manager.openMarket('m1');
      manager.closeMarket('m1');
      const result = manager.resolveMarket('m1', 'BALL', positions);
      expect(result.winners[0].payout).toBe(12);
      expect(result.winners[1].payout).toBe(20);
      expect(result.totalPayout).toBe(32);
    });

    test('21. Resolution returns loss amounts (costPaid) for losers', () => {
      manager.createMarket('m1');
      manager.openMarket('m1');
      manager.closeMarket('m1');
      const result = manager.resolveMarket('m1', 'BALL', positions);
      expect(result.losers).toHaveLength(1);
      expect(result.losers[0].loss).toBe(10);
    });
  });
});
