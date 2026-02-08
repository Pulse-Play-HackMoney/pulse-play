import { MarketManager } from './manager';
import type { Position } from '../position/types';
import { createTestDb, seedDefaults, type DrizzleDB } from '../../db';
import { games } from '../../db/schema';

describe('MarketManager', () => {
  let db: DrizzleDB;
  let manager: MarketManager;

  const GAME_ID = 'test-game-1';
  const CATEGORY_ID = 'pitching';

  beforeEach(() => {
    db = createTestDb();
    seedDefaults(db);

    // Seed a default game for tests
    db.insert(games).values({
      id: GAME_ID,
      sportId: 'baseball',
      homeTeamId: 'nyy',
      awayTeamId: 'bos',
      status: 'ACTIVE',
      createdAt: Date.now(),
    }).run();

    manager = new MarketManager(db, 100);
  });

  // ─── Market creation ───────────────────────────────────────────

  describe('createMarket', () => {
    test('1. createMarket() returns market with status PENDING', () => {
      const market = manager.createMarket(GAME_ID, CATEGORY_ID);
      expect(market.status).toBe('PENDING');
    });

    test('2. New market has correct initial quantities and configured b', () => {
      const market = manager.createMarket(GAME_ID, CATEGORY_ID);
      expect(market.quantities).toEqual([0, 0]); // pitching has 2 outcomes
      expect(market.b).toBe(100);
    });

    test('3. New market has null outcome and null timestamps', () => {
      const market = manager.createMarket(GAME_ID, CATEGORY_ID);
      expect(market.outcome).toBeNull();
      expect(market.openedAt).toBeNull();
      expect(market.closedAt).toBeNull();
      expect(market.resolvedAt).toBeNull();
    });

    test('auto-generates market ID from gameId-categoryId-sequenceNum', () => {
      const m1 = manager.createMarket(GAME_ID, CATEGORY_ID);
      expect(m1.id).toBe(`${GAME_ID}-${CATEGORY_ID}-1`);
      expect(m1.gameId).toBe(GAME_ID);
      expect(m1.categoryId).toBe(CATEGORY_ID);
      expect(m1.sequenceNum).toBe(1);
    });

    test('auto-increments sequence number per game+category', () => {
      const m1 = manager.createMarket(GAME_ID, CATEGORY_ID);
      // Resolve m1 so we can create m2
      manager.openMarket(m1.id);
      manager.closeMarket(m1.id);
      manager.resolveMarket(m1.id, 'BALL');

      const m2 = manager.createMarket(GAME_ID, CATEGORY_ID);
      expect(m2.sequenceNum).toBe(2);
      expect(m2.id).toBe(`${GAME_ID}-${CATEGORY_ID}-2`);
    });

    test('sequence numbers are independent across categories', () => {
      const pitching = manager.createMarket(GAME_ID, 'pitching');
      const batting = manager.createMarket(GAME_ID, 'batting');
      expect(pitching.sequenceNum).toBe(1);
      expect(batting.sequenceNum).toBe(1);
    });

    test('createMarket with explicit b uses that value', () => {
      const market = manager.createMarket(GAME_ID, CATEGORY_ID, 42);
      expect(market.b).toBe(42);
    });

    test('createMarket without b uses defaultB', () => {
      const market = manager.createMarket(GAME_ID, CATEGORY_ID);
      expect(market.b).toBe(100); // defaultB = 100 from constructor
    });

    test('initializes quantities length from category outcomes', () => {
      // pitching has ["BALL","STRIKE"] → 2 outcomes
      const pitchingMarket = manager.createMarket(GAME_ID, 'pitching');
      expect(pitchingMarket.quantities).toEqual([0, 0]);

      // batting has ["HIT","OUT"] → 2 outcomes
      const battingMarket = manager.createMarket(GAME_ID, 'batting');
      expect(battingMarket.quantities).toEqual([0, 0]);
    });
  });

  // ─── Valid state transitions ───────────────────────────────────

  describe('valid state transitions', () => {
    let marketId: string;

    beforeEach(() => {
      marketId = manager.createMarket(GAME_ID, CATEGORY_ID).id;
    });

    test('4. PENDING → OPEN via openMarket()', () => {
      const market = manager.openMarket(marketId);
      expect(market.status).toBe('OPEN');
    });

    test('5. OPEN → CLOSED via closeMarket()', () => {
      manager.openMarket(marketId);
      const market = manager.closeMarket(marketId);
      expect(market.status).toBe('CLOSED');
    });

    test('6. CLOSED → RESOLVED via resolveMarket(outcome)', () => {
      manager.openMarket(marketId);
      manager.closeMarket(marketId);
      manager.resolveMarket(marketId, 'BALL');
      const market = manager.getMarket(marketId);
      expect(market!.status).toBe('RESOLVED');
    });
  });

  // ─── Invalid state transitions ─────────────────────────────────

  describe('invalid state transitions', () => {
    let marketId: string;

    beforeEach(() => {
      marketId = manager.createMarket(GAME_ID, CATEGORY_ID).id;
    });

    test('7. PENDING → CLOSED throws error', () => {
      expect(() => manager.closeMarket(marketId)).toThrow('Invalid transition');
    });

    test('8. PENDING → RESOLVED throws error', () => {
      expect(() => manager.resolveMarket(marketId, 'BALL')).toThrow('Invalid transition');
    });

    test('9. OPEN → RESOLVED throws error (must close first)', () => {
      manager.openMarket(marketId);
      expect(() => manager.resolveMarket(marketId, 'BALL')).toThrow('Invalid transition');
    });

    test('10. OPEN → PENDING throws error (no going back)', () => {
      manager.openMarket(marketId);
      expect(() => manager.openMarket(marketId)).toThrow('Invalid transition');
    });

    test('11. CLOSED → OPEN throws error', () => {
      manager.openMarket(marketId);
      manager.closeMarket(marketId);
      expect(() => manager.openMarket(marketId)).toThrow('Invalid transition');
    });

    test('12. RESOLVED → any state throws error (terminal)', () => {
      manager.openMarket(marketId);
      manager.closeMarket(marketId);
      manager.resolveMarket(marketId, 'BALL');
      expect(() => manager.openMarket(marketId)).toThrow('Invalid transition');
      expect(() => manager.closeMarket(marketId)).toThrow('Invalid transition');
      expect(() => manager.resolveMarket(marketId, 'STRIKE')).toThrow('Invalid transition');
    });
  });

  // ─── Market operations ─────────────────────────────────────────

  describe('market operations', () => {
    let marketId: string;

    beforeEach(() => {
      marketId = manager.createMarket(GAME_ID, CATEGORY_ID).id;
    });

    test('13. openMarket() sets openedAt timestamp', () => {
      const before = Date.now();
      const market = manager.openMarket(marketId);
      expect(market.openedAt).toBeGreaterThanOrEqual(before);
      expect(market.openedAt).toBeLessThanOrEqual(Date.now());
    });

    test('14. closeMarket() sets closedAt timestamp', () => {
      manager.openMarket(marketId);
      const before = Date.now();
      const market = manager.closeMarket(marketId);
      expect(market.closedAt).toBeGreaterThanOrEqual(before);
    });

    test('15. resolveMarket() sets outcome and resolvedAt timestamp', () => {
      manager.openMarket(marketId);
      manager.closeMarket(marketId);
      const before = Date.now();
      manager.resolveMarket(marketId, 'STRIKE');
      const market = manager.getMarket(marketId)!;
      expect(market.outcome).toBe('STRIKE');
      expect(market.resolvedAt).toBeGreaterThanOrEqual(before);
    });

    test('16. getCurrentMarket() returns the active market', () => {
      const current = manager.getCurrentMarket(GAME_ID, CATEGORY_ID);
      expect(current).not.toBeNull();
      expect(current!.id).toBe(marketId);
    });

    test('getCurrentMarket() without args returns most recent non-RESOLVED', () => {
      const current = manager.getCurrentMarket();
      expect(current).not.toBeNull();
      expect(current!.id).toBe(marketId);
    });

    test('getCurrentMarket() returns null when all markets are resolved', () => {
      manager.openMarket(marketId);
      manager.closeMarket(marketId);
      manager.resolveMarket(marketId, 'BALL');
      expect(manager.getCurrentMarket(GAME_ID, CATEGORY_ID)).toBeNull();
    });

    test('17. updateQuantities() updates quantities array', () => {
      manager.updateQuantities(marketId, [42, 58]);
      const market = manager.getMarket(marketId)!;
      expect(market.quantities).toEqual([42, 58]);
    });

    test('updateQuantities() works with 3-element arrays', () => {
      manager.updateQuantities(marketId, [10, 20, 30]);
      const market = manager.getMarket(marketId)!;
      expect(market.quantities).toEqual([10, 20, 30]);
    });
  });

  // ─── Multi-game queries ─────────────────────────────────────────

  describe('multi-game queries', () => {
    test('getMarketsByGame returns all markets for a game', () => {
      manager.createMarket(GAME_ID, 'pitching');
      manager.createMarket(GAME_ID, 'batting');
      const gameMarkets = manager.getMarketsByGame(GAME_ID);
      expect(gameMarkets).toHaveLength(2);
    });

    test('getMarketHistory returns markets in reverse sequence order', () => {
      const m1 = manager.createMarket(GAME_ID, CATEGORY_ID);
      manager.openMarket(m1.id);
      manager.closeMarket(m1.id);
      manager.resolveMarket(m1.id, 'BALL');

      const m2 = manager.createMarket(GAME_ID, CATEGORY_ID);
      const history = manager.getMarketHistory(GAME_ID, CATEGORY_ID);
      expect(history).toHaveLength(2);
      expect(history[0].sequenceNum).toBe(2);
      expect(history[1].sequenceNum).toBe(1);
    });

    test('getMarketHistory respects limit parameter', () => {
      const m1 = manager.createMarket(GAME_ID, CATEGORY_ID);
      manager.openMarket(m1.id);
      manager.closeMarket(m1.id);
      manager.resolveMarket(m1.id, 'BALL');

      manager.createMarket(GAME_ID, CATEGORY_ID);
      const history = manager.getMarketHistory(GAME_ID, CATEGORY_ID, 1);
      expect(history).toHaveLength(1);
    });
  });

  // ─── Resolution logic ──────────────────────────────────────────

  describe('resolution logic', () => {
    let marketId: string;

    const makePositions = (mid: string): Position[] => [
      { address: '0xAAA', marketId: mid, outcome: 'BALL', shares: 12, costPaid: 8, appSessionId: 's1', appSessionVersion: 1, sessionStatus: 'open', timestamp: 1 },
      { address: '0xBBB', marketId: mid, outcome: 'STRIKE', shares: 15, costPaid: 10, appSessionId: 's2', appSessionVersion: 1, sessionStatus: 'open', timestamp: 2 },
      { address: '0xCCC', marketId: mid, outcome: 'BALL', shares: 20, costPaid: 14, appSessionId: 's3', appSessionVersion: 1, sessionStatus: 'open', timestamp: 3 },
    ];

    beforeEach(() => {
      marketId = manager.createMarket(GAME_ID, CATEGORY_ID).id;
      manager.openMarket(marketId);
      manager.closeMarket(marketId);
    });

    test('18. resolveMarket(BALL) correctly identifies Ball bettors as winners', () => {
      const result = manager.resolveMarket(marketId, 'BALL', makePositions(marketId));
      expect(result.winners).toHaveLength(2);
      expect(result.winners.map((w) => w.address)).toEqual(['0xAAA', '0xCCC']);
    });

    test('19. resolveMarket(STRIKE) correctly identifies Strike bettors as winners', () => {
      const result = manager.resolveMarket(marketId, 'STRIKE', makePositions(marketId));
      expect(result.winners).toHaveLength(1);
      expect(result.winners[0].address).toBe('0xBBB');
    });

    test('20. Resolution returns payout amounts (shares) for winners', () => {
      const result = manager.resolveMarket(marketId, 'BALL', makePositions(marketId));
      expect(result.winners[0].payout).toBe(12);
      expect(result.winners[1].payout).toBe(20);
      expect(result.totalPayout).toBe(32);
    });

    test('21. Resolution returns loss amounts (costPaid) for losers', () => {
      const result = manager.resolveMarket(marketId, 'BALL', makePositions(marketId));
      expect(result.losers).toHaveLength(1);
      expect(result.losers[0].loss).toBe(10);
    });
  });

  describe('volume tracking', () => {
    test('new market starts with zero volume', () => {
      const m = manager.createMarket(GAME_ID, CATEGORY_ID);
      expect(m.volume).toBe(0);
    });

    test('addVolume increments market volume', () => {
      const m = manager.createMarket(GAME_ID, CATEGORY_ID);
      manager.addVolume(m.id, 10);
      manager.addVolume(m.id, 25);
      expect(manager.getMarketVolume(m.id)).toBe(35);
    });

    test('getGameVolume aggregates all markets in a game', () => {
      const m1 = manager.createMarket(GAME_ID, CATEGORY_ID);
      const m2 = manager.createMarket(GAME_ID, CATEGORY_ID);
      manager.addVolume(m1.id, 10);
      manager.addVolume(m2.id, 20);
      expect(manager.getGameVolume(GAME_ID)).toBe(30);
    });

    test('getCategoryVolume aggregates markets by category', () => {
      const m1 = manager.createMarket(GAME_ID, CATEGORY_ID);
      const m2 = manager.createMarket(GAME_ID, CATEGORY_ID);
      manager.addVolume(m1.id, 15);
      manager.addVolume(m2.id, 5);
      expect(manager.getCategoryVolume(GAME_ID, CATEGORY_ID)).toBe(20);
    });

    test('getMarketVolume returns 0 for nonexistent market', () => {
      expect(manager.getMarketVolume('nonexistent')).toBe(0);
    });
  });
});
