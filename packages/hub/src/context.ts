import { MarketManager } from './modules/market/manager.js';
import { PositionTracker } from './modules/position/tracker.js';
import { ClearnodeClient } from './modules/clearnode/client.js';
import { OracleService } from './modules/oracle/oracle.js';
import { WsManager } from './api/ws.js';
import { logger as defaultLogger } from './logger.js';

export type Logger = typeof defaultLogger;

export interface AppContext {
  marketManager: MarketManager;
  positionTracker: PositionTracker;
  clearnodeClient: ClearnodeClient;
  oracle: OracleService;
  ws: WsManager;
  log: Logger;
}

/**
 * Creates an AppContext suitable for testing.
 * Uses real MarketManager/PositionTracker/OracleService/WsManager
 * but a mocked ClearnodeClient.
 */
export function createTestContext(
  overrides: Partial<AppContext> = {},
): AppContext {
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

  return {
    marketManager: new MarketManager(),
    positionTracker: new PositionTracker(),
    clearnodeClient: mockClearnode,
    oracle: new OracleService(),
    ws: new WsManager(),
    log: defaultLogger,
    ...overrides,
  };
}
