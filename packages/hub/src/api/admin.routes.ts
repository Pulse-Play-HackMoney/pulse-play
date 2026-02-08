import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../context.js';
import { getPrices } from '../modules/lmsr/engine.js';
import { sql, eq } from 'drizzle-orm';
import { seedDefaults } from '../db/seed.js';
import { marketCategories } from '../db/schema.js';

interface PositionsParams {
  marketId: string;
}

export function registerAdminRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get('/api/admin/state', async () => {
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

    return {
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
    };
  });

  app.post('/api/admin/reset', async () => {
    // Stop auto-play if running
    ctx.oracle.stopAutoPlay();

    // Truncate all data tables (order matters for FK constraints)
    ctx.db.run(sql`DELETE FROM lp_events`);
    ctx.db.run(sql`DELETE FROM lp_shares`);
    ctx.db.run(sql`DELETE FROM settlements`);
    ctx.db.run(sql`DELETE FROM positions`);
    ctx.db.run(sql`DELETE FROM markets`);
    ctx.db.run(sql`DELETE FROM games`);
    ctx.db.run(sql`DELETE FROM teams`);
    ctx.db.run(sql`DELETE FROM market_categories`);
    ctx.db.run(sql`DELETE FROM sports`);
    ctx.db.run(sql`DELETE FROM users`);

    // Re-seed defaults
    seedDefaults(ctx.db);

    ctx.oracle.reset();
    ctx.ws.clear();

    ctx.log.adminReset();
    return { success: true };
  });

  // ── Fee config ──

  app.get('/api/admin/config', async () => {
    return {
      transactionFeePercent: ctx.transactionFeePercent,
      lmsrSensitivityFactor: ctx.lmsrSensitivityFactor,
    };
  });

  app.post<{ Body: { transactionFeePercent?: number; lmsrSensitivityFactor?: number } }>('/api/admin/config', async (req, reply) => {
    const { transactionFeePercent, lmsrSensitivityFactor } = req.body ?? {} as any;

    if (transactionFeePercent !== undefined) {
      if (typeof transactionFeePercent !== 'number' || transactionFeePercent < 0 || transactionFeePercent > 100) {
        return reply.status(400).send({ error: 'transactionFeePercent must be a number between 0 and 100' });
      }
      ctx.transactionFeePercent = transactionFeePercent;
      ctx.ws.broadcast({ type: 'CONFIG_UPDATED', transactionFeePercent });
      ctx.log.configUpdated('transactionFeePercent', transactionFeePercent);
    }

    if (lmsrSensitivityFactor !== undefined) {
      if (typeof lmsrSensitivityFactor !== 'number' || lmsrSensitivityFactor <= 0 || lmsrSensitivityFactor > 1) {
        return reply.status(400).send({ error: 'lmsrSensitivityFactor must be a number between 0 (exclusive) and 1' });
      }
      ctx.lmsrSensitivityFactor = lmsrSensitivityFactor;
      ctx.log.configUpdated('lmsrSensitivityFactor', lmsrSensitivityFactor);
    }

    return {
      success: true,
      transactionFeePercent: ctx.transactionFeePercent,
      lmsrSensitivityFactor: ctx.lmsrSensitivityFactor,
    };
  });

  // Get positions for a specific market
  app.get<{ Params: PositionsParams }>(
    '/api/admin/positions/:marketId',
    async (request) => {
      const { marketId } = request.params;
      const positions = ctx.positionTracker.getPositionsByMarket(marketId);
      return { positions };
    }
  );
}
