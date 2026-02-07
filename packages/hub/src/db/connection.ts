import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sql } from 'drizzle-orm';
import * as schema from './schema.js';

export type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Creates a Drizzle DB instance backed by a file-based SQLite database.
 * Enables WAL mode and foreign key enforcement for production use.
 */
export function createDb(path: string): DrizzleDB {
  const sqlite = new Database(path);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  const db = drizzle(sqlite, { schema });
  pushSchema(db);
  return db;
}

/**
 * Creates a Drizzle DB instance backed by an in-memory SQLite database.
 * Ideal for testing — fast, isolated, no cleanup needed.
 */
export function createTestDb(): DrizzleDB {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');

  const db = drizzle(sqlite, { schema });
  pushSchema(db);
  return db;
}

/**
 * Creates all tables from schema using raw SQL (push, not migrations).
 * Simpler for hackathon — no migration files to manage.
 */
function pushSchema(db: DrizzleDB): void {
  db.run(sql`CREATE TABLE IF NOT EXISTS sports (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at INTEGER NOT NULL
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS market_categories (
    id TEXT PRIMARY KEY,
    sport_id TEXT NOT NULL REFERENCES sports(id),
    name TEXT NOT NULL,
    outcomes TEXT NOT NULL,
    description TEXT,
    created_at INTEGER NOT NULL
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    sport_id TEXT NOT NULL REFERENCES sports(id),
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'SCHEDULED',
    started_at INTEGER,
    completed_at INTEGER,
    metadata TEXT,
    created_at INTEGER NOT NULL
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS markets (
    id TEXT PRIMARY KEY,
    game_id TEXT NOT NULL REFERENCES games(id),
    category_id TEXT NOT NULL REFERENCES market_categories(id),
    sequence_num INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    quantities TEXT NOT NULL DEFAULT '[]',
    b REAL NOT NULL DEFAULT 100,
    outcome TEXT,
    created_at INTEGER NOT NULL,
    opened_at INTEGER,
    closed_at INTEGER,
    resolved_at INTEGER
  )`);

  db.run(sql`CREATE INDEX IF NOT EXISTS idx_markets_game_category_status
    ON markets(game_id, category_id, status)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_markets_game_status
    ON markets(game_id, status)`);

  db.run(sql`CREATE TABLE IF NOT EXISTS positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    address TEXT NOT NULL,
    market_id TEXT NOT NULL REFERENCES markets(id),
    outcome TEXT NOT NULL,
    shares REAL NOT NULL,
    cost_paid REAL NOT NULL,
    fee REAL NOT NULL DEFAULT 0,
    app_session_id TEXT NOT NULL,
    app_session_version INTEGER NOT NULL,
    session_status TEXT NOT NULL DEFAULT 'open',
    session_data TEXT,
    created_at INTEGER NOT NULL
  )`);

  db.run(sql`CREATE INDEX IF NOT EXISTS idx_positions_market ON positions(market_id)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_positions_address ON positions(address)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_positions_session ON positions(app_session_id)`);

  db.run(sql`CREATE TABLE IF NOT EXISTS users (
    address TEXT PRIMARY KEY,
    total_bets INTEGER NOT NULL DEFAULT 0,
    total_wins INTEGER NOT NULL DEFAULT 0,
    total_losses INTEGER NOT NULL DEFAULT 0,
    total_wagered REAL NOT NULL DEFAULT 0,
    total_payout REAL NOT NULL DEFAULT 0,
    net_pnl REAL NOT NULL DEFAULT 0,
    first_seen_at INTEGER NOT NULL,
    last_active_at INTEGER NOT NULL
  )`);

  db.run(sql`CREATE INDEX IF NOT EXISTS idx_users_pnl ON users(net_pnl)`);

  db.run(sql`CREATE TABLE IF NOT EXISTS settlements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    market_id TEXT NOT NULL REFERENCES markets(id),
    address TEXT NOT NULL,
    outcome TEXT NOT NULL,
    result TEXT NOT NULL,
    shares REAL NOT NULL,
    cost_paid REAL NOT NULL,
    payout REAL NOT NULL,
    profit REAL NOT NULL,
    app_session_id TEXT NOT NULL,
    settled_at INTEGER NOT NULL
  )`);

  db.run(sql`CREATE INDEX IF NOT EXISTS idx_settlements_market ON settlements(market_id)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_settlements_address ON settlements(address)`);
}
