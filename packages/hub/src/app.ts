import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import type { AppContext } from './context.js';
import { registerMarketRoutes } from './api/market.routes.js';
import { registerPositionRoutes } from './api/positions.routes.js';
import { registerBetRoutes } from './api/bet.routes.js';
import { registerOracleRoutes } from './api/oracle.routes.js';
import { registerFaucetRoutes } from './api/faucet.routes.js';
import { registerAdminRoutes } from './api/admin.routes.js';
import { registerMMRoutes } from './api/mm.routes.js';
import { registerSportRoutes } from './api/sport.routes.js';
import { registerGameRoutes } from './api/game.routes.js';
import { registerUserRoutes } from './api/user.routes.js';
import { registerTeamRoutes } from './api/team.routes.js';
import { registerOrderBookRoutes } from './api/orderbook.routes.js';
import { registerLPRoutes } from './api/lp.routes.js';
import type { WsStateSync } from './api/types.js';
import { getPrices } from './modules/lmsr/engine.js';
import { eq, sql } from 'drizzle-orm';
import { marketCategories } from './db/schema.js';

export async function buildApp(ctx: AppContext) {
  const app = Fastify({ logger: false });

  // Enable CORS for frontend
  await app.register(cors, {
    origin: true, // Allow all origins in development
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  await app.register(websocket);
  await app.register(multipart, { limits: { fileSize: 2 * 1024 * 1024 } });

  // Serve uploaded files statically (only in production/dev, skip in tests)
  if (ctx.uploadsDir) {
    await app.register(fastifyStatic, {
      root: ctx.uploadsDir,
      prefix: '/uploads/',
      decorateReply: false,
    });
  }

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
  app.get('/ws', { websocket: true }, async (socket, req) => {
    const address = (req.query as any)?.address as string | undefined;
    ctx.ws.addConnection(socket, address);
    ctx.log.wsConnect(address ?? null, ctx.ws.getConnectionCount());

    // Send initial state sync to the new client
    const market = ctx.marketManager.getCurrentMarket();

    let marketResp = null;
    let prices = [0.5, 0.5];
    let outcomes: string[] = [];

    if (market) {
      prices = getPrices(market.quantities, market.b);

      // Look up category outcomes
      const category = ctx.db.select().from(marketCategories)
        .where(eq(marketCategories.id, market.categoryId))
        .get();
      outcomes = category ? JSON.parse(category.outcomes) : [];

      marketResp = {
        id: market.id,
        gameId: market.gameId,
        categoryId: market.categoryId,
        status: market.status,
        outcome: market.outcome,
        quantities: market.quantities,
        b: market.b,
        // backward compat
        qBall: market.quantities[0] ?? 0,
        qStrike: market.quantities[1] ?? 0,
      };
    }

    const positions = market
      ? ctx.positionTracker.getPositionsByMarket(market.id)
      : [];

    const openSessions = positions.filter((p) => p.sessionStatus === 'open').length;
    const settledSessions = positions.filter((p) => p.sessionStatus === 'settled').length;

    // Compute pool stats (non-critical — STATE_SYNC still works without it)
    let poolStats: import('./modules/lp/types.js').PoolStats | undefined;
    try {
      const balance = await ctx.clearnodeClient.getBalance();
      const poolValue = parseFloat(balance) / 1_000_000;
      const allMarkets = ctx.marketManager.getAllMarkets();
      const openMarkets = allMarkets.some((m) => m.status === 'OPEN');
      const unsettledResult = ctx.db.all<{ c: number }>(
        sql`SELECT COUNT(*) as c FROM positions WHERE session_status = 'open'`
      );
      const unsettled = (unsettledResult[0]?.c ?? 0) > 0;
      poolStats = ctx.lpManager.getPoolStats(poolValue, openMarkets, unsettled);
    } catch {
      // Pool stats unavailable — not critical for STATE_SYNC
    }

    const stateSync: WsStateSync = {
      type: 'STATE_SYNC',
      state: {
        market: marketResp,
        gameState: ctx.oracle.getGameState(),
        positionCount: positions.length,
        connectionCount: ctx.ws.getConnectionCount(),
        sessionCounts: { open: openSessions, settled: settledSessions },
        prices,
        outcomes,
        // backward compat
        priceBall: prices[0] ?? 0.5,
        priceStrike: prices[1] ?? 0.5,
        ...(poolStats ? { pool: poolStats } : {}),
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
  registerSportRoutes(app, ctx);
  registerGameRoutes(app, ctx);
  registerTeamRoutes(app, ctx);
  registerUserRoutes(app, ctx);
  registerOrderBookRoutes(app, ctx);
  registerLPRoutes(app, ctx);

  return app;
}
