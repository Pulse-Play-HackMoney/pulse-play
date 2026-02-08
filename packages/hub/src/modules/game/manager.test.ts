import { GameManager } from './manager';
import { MarketManager } from '../market/manager';
import { createTestDb, seedDefaults, type DrizzleDB } from '../../db';

describe('GameManager', () => {
  let db: DrizzleDB;
  let manager: GameManager;

  beforeEach(() => {
    db = createTestDb();
    seedDefaults(db);
    manager = new GameManager(db);
  });

  describe('createGame', () => {
    test('creates a game with SCHEDULED status using team IDs', () => {
      const game = manager.createGame('baseball', 'nyy', 'bos', 'nyy-bos-1');
      expect(game.status).toBe('SCHEDULED');
      expect(game.sportId).toBe('baseball');
      expect(game.homeTeamId).toBe('nyy');
      expect(game.awayTeamId).toBe('bos');
    });

    test('auto-generates ID from team abbreviations if not provided', () => {
      const game = manager.createGame('baseball', 'nyy', 'bos');
      expect(game.id).toContain('nyy-bos-');
    });

    test('sets createdAt timestamp', () => {
      const before = Date.now();
      const game = manager.createGame('baseball', 'nyy', 'bos', 'test-1');
      expect(game.createdAt).toBeGreaterThanOrEqual(before);
    });

    test('new game has null startedAt, completedAt, and imagePath', () => {
      const game = manager.createGame('baseball', 'nyy', 'bos', 'test-1');
      expect(game.startedAt).toBeNull();
      expect(game.completedAt).toBeNull();
      expect(game.imagePath).toBeNull();
    });

    test('throws if home team does not exist', () => {
      expect(() => manager.createGame('baseball', 'nonexistent', 'bos'))
        .toThrow("Home team 'nonexistent' not found");
    });

    test('throws if away team does not exist', () => {
      expect(() => manager.createGame('baseball', 'nyy', 'nonexistent'))
        .toThrow("Away team 'nonexistent' not found");
    });

    test('throws if home team does not belong to sport', () => {
      expect(() => manager.createGame('basketball', 'nyy', 'lal'))
        .toThrow("Home team 'nyy' does not belong to sport 'basketball'");
    });

    test('throws if away team does not belong to sport', () => {
      expect(() => manager.createGame('baseball', 'nyy', 'lal'))
        .toThrow("Away team 'lal' does not belong to sport 'baseball'");
    });
  });

  describe('activateGame', () => {
    test('transitions SCHEDULED → ACTIVE', () => {
      manager.createGame('baseball', 'nyy', 'bos', 'test-1');
      const game = manager.activateGame('test-1');
      expect(game.status).toBe('ACTIVE');
      expect(game.startedAt).not.toBeNull();
    });

    test('throws when game is already ACTIVE', () => {
      manager.createGame('baseball', 'nyy', 'bos', 'test-1');
      manager.activateGame('test-1');
      expect(() => manager.activateGame('test-1')).toThrow('Cannot activate');
    });

    test('throws when game is COMPLETED', () => {
      manager.createGame('baseball', 'nyy', 'bos', 'test-1');
      manager.activateGame('test-1');
      manager.completeGame('test-1');
      expect(() => manager.activateGame('test-1')).toThrow('Cannot activate');
    });
  });

  describe('completeGame', () => {
    test('transitions ACTIVE → COMPLETED', () => {
      manager.createGame('baseball', 'nyy', 'bos', 'test-1');
      manager.activateGame('test-1');
      const game = manager.completeGame('test-1');
      expect(game.status).toBe('COMPLETED');
      expect(game.completedAt).not.toBeNull();
    });

    test('throws when game is SCHEDULED', () => {
      manager.createGame('baseball', 'nyy', 'bos', 'test-1');
      expect(() => manager.completeGame('test-1')).toThrow('Cannot complete');
    });
  });

  describe('getGame', () => {
    test('returns game by ID', () => {
      manager.createGame('baseball', 'nyy', 'bos', 'test-1');
      const game = manager.getGame('test-1');
      expect(game).not.toBeNull();
      expect(game!.id).toBe('test-1');
    });

    test('returns null for non-existent game', () => {
      expect(manager.getGame('nonexistent')).toBeNull();
    });
  });

  describe('getActiveGames', () => {
    test('returns only ACTIVE games', () => {
      manager.createGame('baseball', 'nyy', 'bos', 'g1');
      manager.createGame('baseball', 'lad', 'chc', 'g2');
      manager.activateGame('g1');

      const active = manager.getActiveGames();
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe('g1');
    });
  });

  describe('getGamesBySport', () => {
    test('filters by sport', () => {
      manager.createGame('baseball', 'nyy', 'bos', 'g1');
      manager.createGame('basketball', 'lal', 'gsw', 'g2');

      const baseballGames = manager.getGamesBySport('baseball');
      expect(baseballGames).toHaveLength(1);
      expect(baseballGames[0].id).toBe('g1');
    });
  });

  describe('getAllGames', () => {
    test('returns all games without filter', () => {
      manager.createGame('baseball', 'nyy', 'bos', 'g1');
      manager.createGame('basketball', 'lal', 'gsw', 'g2');
      expect(manager.getAllGames()).toHaveLength(2);
    });

    test('filters by status', () => {
      manager.createGame('baseball', 'nyy', 'bos', 'g1');
      manager.createGame('baseball', 'lad', 'chc', 'g2');
      manager.activateGame('g1');
      expect(manager.getAllGames('ACTIVE')).toHaveLength(1);
      expect(manager.getAllGames('SCHEDULED')).toHaveLength(1);
    });
  });

  describe('setImagePath', () => {
    test('sets image path on a game', () => {
      manager.createGame('baseball', 'nyy', 'bos', 'g1');
      const game = manager.setImagePath('g1', '/uploads/games/g1.jpg');
      expect(game.imagePath).toBe('/uploads/games/g1.jpg');
    });

    test('throws if game does not exist', () => {
      expect(() => manager.setImagePath('nonexistent', '/x.jpg'))
        .toThrow('Game nonexistent not found');
    });
  });

  describe('completeGame with market validation', () => {
    let marketManager: MarketManager;
    let validatedManager: GameManager;

    beforeEach(() => {
      marketManager = new MarketManager(db);
      validatedManager = new GameManager(db, marketManager);
    });

    test('throws when game has unresolved (OPEN) markets', () => {
      validatedManager.createGame('baseball', 'nyy', 'bos', 'g1');
      validatedManager.activateGame('g1');

      // Create and open a market for the game
      const market = marketManager.createMarket('g1', 'pitching');
      marketManager.openMarket(market.id);

      expect(() => validatedManager.completeGame('g1'))
        .toThrow('Cannot complete game: 1 market(s) are not resolved');
    });

    test('throws when game has CLOSED (but not resolved) markets', () => {
      validatedManager.createGame('baseball', 'nyy', 'bos', 'g1');
      validatedManager.activateGame('g1');

      const market = marketManager.createMarket('g1', 'pitching');
      marketManager.openMarket(market.id);
      marketManager.closeMarket(market.id);

      expect(() => validatedManager.completeGame('g1'))
        .toThrow('Cannot complete game: 1 market(s) are not resolved');
    });

    test('succeeds when all markets are resolved', () => {
      validatedManager.createGame('baseball', 'nyy', 'bos', 'g1');
      validatedManager.activateGame('g1');

      const market = marketManager.createMarket('g1', 'pitching');
      marketManager.openMarket(market.id);
      marketManager.closeMarket(market.id);
      marketManager.resolveMarket(market.id, 'BALL', []);

      const game = validatedManager.completeGame('g1');
      expect(game.status).toBe('COMPLETED');
    });

    test('succeeds when game has no markets', () => {
      validatedManager.createGame('baseball', 'nyy', 'bos', 'g1');
      validatedManager.activateGame('g1');

      const game = validatedManager.completeGame('g1');
      expect(game.status).toBe('COMPLETED');
    });

    test('throws with correct count for multiple unresolved markets', () => {
      validatedManager.createGame('baseball', 'nyy', 'bos', 'g1');
      validatedManager.activateGame('g1');

      const m1 = marketManager.createMarket('g1', 'pitching');
      marketManager.openMarket(m1.id);

      const m2 = marketManager.createMarket('g1', 'pitching');
      marketManager.openMarket(m2.id);

      expect(() => validatedManager.completeGame('g1'))
        .toThrow('Cannot complete game: 2 market(s) are not resolved');
    });
  });
});
