import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import type { AppContext } from './context.js';
import { registerMarketRoutes } from './api/market.routes.js';
import { registerPositionRoutes } from './api/positions.routes.js';
import { registerBetRoutes } from './api/bet.routes.js';
import { registerOracleRoutes } from './api/oracle.routes.js';
import { registerFaucetRoutes } from './api/faucet.routes.js';
import { registerAdminRoutes } from './api/admin.routes.js';
import { registerMMRoutes } from './api/mm.routes.js';
import type { WsStateSync } from './api/types.js';

export async function buildApp(ctx: AppContext) {
  const app = Fastify({ logger: false });

  // Enable CORS for frontend
  await app.register(cors, {
    origin: true, // Allow all origins in development
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  await app.register(websocket);

  // Request/response lifecycle logging
  app.addHook('onRequest', async (req) => {
    (req as any).__startTime = process.hrtime.bigint();
  });

  app.addHook('onResponse', async (req, reply) => {
    const start = (req as any).__startTime as bigint | undefined;
    const durationMs = start
      ? Number(process.hrtime.bigint() - start) / 1_000_000
      : 0;
    ctx.log.request(req.method, req.url, reply.statusCode, Math.round(durationMs));
  });

  // WebSocket route
  app.get('/ws', { websocket: true }, (socket, req) => {
    const address = (req.query as any)?.address as string | undefined;
    ctx.ws.addConnection(socket, address);
    ctx.log.wsConnect(address ?? null, ctx.ws.getConnectionCount());

    // Send initial state sync to the new client
    const market = ctx.marketManager.getCurrentMarket();
    const marketResp = market
      ? {
          id: market.id,
          status: market.status,
          outcome: market.outcome,
          qBall: market.qBall,
          qStrike: market.qStrike,
          b: market.b,
        }
      : null;

    const positions = market
      ? ctx.positionTracker.getPositionsByMarket(market.id)
      : [];

    const stateSync: WsStateSync = {
      type: 'STATE_SYNC',
      state: {
        market: marketResp,
        gameState: ctx.oracle.getGameState(),
        positionCount: positions.length,
        connectionCount: ctx.ws.getConnectionCount(),
      },
      positions,
    };
    ctx.ws.sendToSocket(socket, stateSync);

    socket.on('close', () => {
      ctx.log.wsDisconnect(address ?? null, ctx.ws.getConnectionCount());
    });
  });

  // REST routes
  registerMarketRoutes(app, ctx);
  registerPositionRoutes(app, ctx);
  registerBetRoutes(app, ctx);
  registerOracleRoutes(app, ctx);
  registerFaucetRoutes(app, ctx);
  registerAdminRoutes(app, ctx);
  registerMMRoutes(app, ctx);

  return app;
}
