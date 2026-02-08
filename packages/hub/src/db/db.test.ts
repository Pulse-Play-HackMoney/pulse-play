import { createTestDb, seedDefaults, type DrizzleDB } from './index.js';
import { sports, marketCategories, games, markets, positions, users, settlements } from './schema.js';
import { eq, sql } from 'drizzle-orm';

describe('DB Module', () => {
  let db: DrizzleDB;

  beforeEach(() => {
    db = createTestDb();
  });

  describe('createTestDb', () => {
    it('creates an in-memory database with all tables', () => {
      // Query sqlite_master for table names
      const tables = db.all<{ name: string }>(
        sql`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
      );
      const names = tables.map((t) => t.name).sort();
      expect(names).toEqual([
        'games',
        'lp_events',
        'lp_shares',
        'market_categories',
        'markets',
        'p2p_fills',
        'p2p_orders',
        'positions',
        'settlements',
        'sports',
        'teams',
        'users',
      ]);
    });

    it('creates indexes on markets table', () => {
      const indexes = db.all<{ name: string }>(
        sql`SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='markets' AND name NOT LIKE 'sqlite_%'`
      );
      const names = indexes.map((i) => i.name).sort();
      expect(names).toContain('idx_markets_game_category_status');
      expect(names).toContain('idx_markets_game_status');
    });

    it('creates indexes on positions table', () => {
      const indexes = db.all<{ name: string }>(
        sql`SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='positions' AND name NOT LIKE 'sqlite_%'`
      );
      const names = indexes.map((i) => i.name).sort();
      expect(names).toContain('idx_positions_market');
      expect(names).toContain('idx_positions_address');
      expect(names).toContain('idx_positions_session');
    });

    it('creates indexes on p2p_orders table', () => {
      const indexes = db.all<{ name: string }>(
        sql`SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='p2p_orders' AND name NOT LIKE 'sqlite_%'`
      );
      const names = indexes.map((i) => i.name).sort();
      expect(names).toContain('idx_p2p_orders_market_outcome_status');
      expect(names).toContain('idx_p2p_orders_user');
    });

    it('creates indexes on p2p_fills table', () => {
      const indexes = db.all<{ name: string }>(
        sql`SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='p2p_fills' AND name NOT LIKE 'sqlite_%'`
      );
      const names = indexes.map((i) => i.name).sort();
      expect(names).toContain('idx_p2p_fills_order');
    });

    it('creates indexes on lp_events table', () => {
      const indexes = db.all<{ name: string }>(
        sql`SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='lp_events' AND name NOT LIKE 'sqlite_%'`
      );
      const names = indexes.map((i) => i.name).sort();
      expect(names).toContain('idx_lp_events_address');
      expect(names).toContain('idx_lp_events_type');
    });

    it('creates indexes on users and settlements tables', () => {
      const userIndexes = db.all<{ name: string }>(
        sql`SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='users' AND name NOT LIKE 'sqlite_%'`
      );
      expect(userIndexes.map((i) => i.name)).toContain('idx_users_pnl');

      const settlementIndexes = db.all<{ name: string }>(
        sql`SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='settlements' AND name NOT LIKE 'sqlite_%'`
      );
      expect(settlementIndexes.map((i) => i.name)).toContain('idx_settlements_market');
      expect(settlementIndexes.map((i) => i.name)).toContain('idx_settlements_address');
    });

    it('enforces foreign key constraints', () => {
      // Try inserting a game with a non-existent sport_id
      expect(() => {
        db.insert(games).values({
          id: 'test-game',
          sportId: 'nonexistent-sport',
          homeTeamId: 'nonexistent-team',
          awayTeamId: 'nonexistent-team-2',
          status: 'SCHEDULED',
          createdAt: Date.now(),
        }).run();
      }).toThrow();
    });

    it('provides isolated databases per call', () => {
      const db2 = createTestDb();

      // Seed db1 but not db2
      seedDefaults(db);
      const sportsInDb1 = db.select().from(sports).all();
      const sportsInDb2 = db2.select().from(sports).all();

      expect(sportsInDb1.length).toBe(3);
      expect(sportsInDb2.length).toBe(0);
    });
  });

  describe('seedDefaults', () => {
    it('inserts default sports', () => {
      seedDefaults(db);
      const allSports = db.select().from(sports).all();
      expect(allSports).toHaveLength(3);
      expect(allSports.map((s) => s.id).sort()).toEqual(['baseball', 'basketball', 'soccer']);
    });

    it('inserts default market categories with correct outcomes', () => {
      seedDefaults(db);
      const allCategories = db.select().from(marketCategories).all();
      expect(allCategories).toHaveLength(5);

      const pitching = allCategories.find((c) => c.id === 'pitching');
      expect(pitching).toBeDefined();
      expect(pitching!.sportId).toBe('baseball');
      expect(JSON.parse(pitching!.outcomes)).toEqual(['BALL', 'STRIKE']);

      const freeThrow = allCategories.find((c) => c.id === 'free_throw');
      expect(freeThrow).toBeDefined();
      expect(freeThrow!.sportId).toBe('basketball');
      expect(JSON.parse(freeThrow!.outcomes)).toEqual(['MAKE', 'MISS']);

      const penalty = allCategories.find((c) => c.id === 'penalty');
      expect(penalty).toBeDefined();
      expect(penalty!.sportId).toBe('soccer');
      expect(JSON.parse(penalty!.outcomes)).toEqual(['GOAL', 'SAVE']);
    });

    it('is idempotent — calling twice does not duplicate data', () => {
      seedDefaults(db);
      seedDefaults(db);
      const allSports = db.select().from(sports).all();
      const allCategories = db.select().from(marketCategories).all();
      expect(allSports).toHaveLength(3);
      expect(allCategories).toHaveLength(5);
    });

    it('links categories to correct sports via foreign keys', () => {
      seedDefaults(db);
      const baseballCategories = db.select().from(marketCategories)
        .where(eq(marketCategories.sportId, 'baseball')).all();
      expect(baseballCategories).toHaveLength(2);
      expect(baseballCategories.map((c) => c.id).sort()).toEqual(['batting', 'pitching']);

      const basketballCategories = db.select().from(marketCategories)
        .where(eq(marketCategories.sportId, 'basketball')).all();
      expect(basketballCategories).toHaveLength(2);

      const soccerCategories = db.select().from(marketCategories)
        .where(eq(marketCategories.sportId, 'soccer')).all();
      expect(soccerCategories).toHaveLength(1);
    });
  });
});
