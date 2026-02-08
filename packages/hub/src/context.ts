import { MarketManager } from './modules/market/manager.js';
import { PositionTracker } from './modules/position/tracker.js';
import { ClearnodeClient } from './modules/clearnode/client.js';
import { OracleService } from './modules/oracle/oracle.js';
import { GameManager } from './modules/game/manager.js';
import { TeamManager } from './modules/team/manager.js';
import { UserTracker } from './modules/user/tracker.js';
import { WsManager } from './api/ws.js';
import { logger as defaultLogger } from './logger.js';
import { createTestDb, seedDefaults, type DrizzleDB } from './db/index.js';
import { games } from './db/schema.js';

export type Logger = typeof defaultLogger;

export interface AppContext {
  db: DrizzleDB;
  marketManager: MarketManager;
  positionTracker: PositionTracker;
  gameManager: GameManager;
  teamManager: TeamManager;
  userTracker: UserTracker;
  clearnodeClient: ClearnodeClient;
  oracle: OracleService;
  ws: WsManager;
  log: Logger;
  transactionFeePercent: number;
  uploadsDir?: string;
}

/**
 * Default game ID used by createTestContext for backward compatibility.
 * Existing tests that don't care about multi-game can keep working without changes.
 */
export const DEFAULT_TEST_GAME_ID = 'test-game';
export const DEFAULT_TEST_CATEGORY_ID = 'pitching';

/**
 * Creates an AppContext suitable for testing.
 * Uses real DB-backed MarketManager/PositionTracker/GameManager/TeamManager/UserTracker
 * with an in-memory SQLite database, seeded with defaults + a default game.
 * ClearnodeClient is mocked.
 */
export function createTestContext(
  overrides: Partial<AppContext> = {},
): AppContext {
  const db = createTestDb();
  seedDefaults(db);

  // Seed a default game for backward compatibility (uses seeded team IDs)
  db.insert(games).values({
    id: DEFAULT_TEST_GAME_ID,
    sportId: 'baseball',
    homeTeamId: 'nyy',
    awayTeamId: 'bos',
    status: 'ACTIVE',
    createdAt: Date.now(),
  }).run();

  const mockClearnode = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(),
    isConnected: jest.fn().mockReturnValue(true),
    getBalance: jest.fn().mockResolvedValue('1000'),
    requestFaucet: jest.fn().mockResolvedValue(undefined),
    submitAppState: jest.fn().mockResolvedValue({ version: 1 }),
    closeSession: jest.fn().mockResolvedValue(undefined),
    transfer: jest.fn().mockResolvedValue(undefined),
    createAppSession: jest.fn().mockResolvedValue({ appSessionId: '0xSESSION', version: 1, status: 'open' }),
    getAppSessions: jest.fn().mockResolvedValue([]),
    getAddress: jest.fn().mockReturnValue('0xMM'),
  } as unknown as ClearnodeClient;

  const marketManager = new MarketManager(db);

  return {
    db,
    marketManager,
    positionTracker: new PositionTracker(db),
    gameManager: new GameManager(db, marketManager),
    teamManager: new TeamManager(db),
    userTracker: new UserTracker(db),
    clearnodeClient: mockClearnode,
    oracle: new OracleService(),
    ws: new WsManager(),
    log: defaultLogger,
    transactionFeePercent: 1,
    ...overrides,
  };
}
