import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env from packages/hub directory
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });

import { buildApp } from './app.js';
import { MarketManager } from './modules/market/manager.js';
import { PositionTracker } from './modules/position/tracker.js';
import { ClearnodeClient } from './modules/clearnode/client.js';
import { OracleService } from './modules/oracle/oracle.js';
import { WsManager } from './api/ws.js';
import { logger } from './logger.js';
import type { AppContext } from './context.js';

const PORT = parseInt(process.env.PORT ?? '3001', 10);

async function main() {
  const clearnodeClient = new ClearnodeClient({
    url: process.env.CLEARNODE_URL ?? 'wss://clearnode.yellow.com/ws',
    mmPrivateKey: (process.env.MM_PRIVATE_KEY ?? '0x') as `0x${string}`,
    application: process.env.APPLICATION_NAME ?? '0x',
    allowances: [],
    faucetUrl: process.env.FAUCET_URL ?? 'https://faucet.yellow.com',
  });

  const ctx: AppContext = {
    marketManager: new MarketManager(),
    positionTracker: new PositionTracker(),
    clearnodeClient,
    oracle: new OracleService(),
    ws: new WsManager(),
    log: logger,
  };

  const app = await buildApp(ctx);

  await app.listen({ port: PORT, host: '0.0.0.0' });
  logger.startup(PORT);

  // Connect to Clearnode (non-fatal — server stays up if it fails)
  try {
    await clearnodeClient.connect();
    logger.clearnodeConnected(clearnodeClient.getAddress());
  } catch (err) {
    logger.error('clearnode-connect', err);
    logger.clearnodeDisconnected();
  }
}

main().catch((err) => {
  logger.error('startup', err);
  process.exit(1);
});
