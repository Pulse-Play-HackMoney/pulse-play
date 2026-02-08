import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env from packages/hub directory
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });

import { buildApp } from './app.js';
import { MarketManager } from './modules/market/manager.js';
import { PositionTracker } from './modules/position/tracker.js';
import { GameManager } from './modules/game/manager.js';
import { TeamManager } from './modules/team/manager.js';
import { UserTracker } from './modules/user/tracker.js';
import { OrderBookManager } from './modules/orderbook/manager.js';
import { ClearnodeClient } from './modules/clearnode/client.js';
import { OracleService } from './modules/oracle/oracle.js';
import { WsManager } from './api/ws.js';
import { logger } from './logger.js';
import { createDb, seedDefaults } from './db/index.js';
import type { AppContext } from './context.js';

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const DB_PATH = process.env.DB_PATH ?? resolve(__dirname, '../data/pulseplay.db');

async function main() {
  // Initialize SQLite database
  const db = createDb(DB_PATH);
  seedDefaults(db);

  const clearnodeClient = new ClearnodeClient({
    url: process.env.CLEARNODE_URL ?? 'wss://clearnode.yellow.com/ws',
    mmPrivateKey: (process.env.MM_PRIVATE_KEY ?? '0x') as `0x${string}`,
    application: process.env.APPLICATION_NAME ?? '0x',
    allowances: [{ asset: 'ytest.usd', amount: String(100_000 * 1_000_000) }],
    faucetUrl: process.env.FAUCET_URL ?? 'https://faucet.yellow.com',
  });

  const marketManager = new MarketManager(db);

  const ctx: AppContext = {
    db,
    marketManager,
    positionTracker: new PositionTracker(db),
    gameManager: new GameManager(db, marketManager),
    teamManager: new TeamManager(db),
    userTracker: new UserTracker(db),
    orderBookManager: new OrderBookManager(db),
    clearnodeClient,
    oracle: new OracleService(),
    ws: new WsManager(),
    log: logger,
    transactionFeePercent: parseInt(process.env.TRANSACTION_FEE_PERCENT ?? '1', 10),
    uploadsDir: resolve(__dirname, '../uploads'),
  };

  const app = await buildApp(ctx);

  await app.listen({ port: PORT, host: '0.0.0.0' });
  logger.startup(PORT);
}

main().catch((err) => {
  logger.error('startup', err);
  process.exit(1);
});
