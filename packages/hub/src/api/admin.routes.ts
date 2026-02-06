import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../context.js';
import { MarketManager } from '../modules/market/manager.js';
import { PositionTracker } from '../modules/position/tracker.js';
import { getPrice } from '../modules/lmsr/engine.js';

interface PositionsParams {
  marketId: string;
}

export function registerAdminRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get('/api/admin/state', async () => {
    const market = ctx.marketManager.getCurrentMarket();
    let marketResp = null;
    let priceBall = 0.5;
    let priceStrike = 0.5;

    if (market) {
      priceBall = getPrice(market.qBall, market.qStrike, market.b, 'BALL');
      priceStrike = getPrice(market.qBall, market.qStrike, market.b, 'STRIKE');
      marketResp = {
        id: market.id,
        status: market.status,
        outcome: market.outcome,
        qBall: market.qBall,
        qStrike: market.qStrike,
        b: market.b,
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
    };
  });

  app.post('/api/admin/reset', async () => {
    // Stop auto-play if running
    ctx.oracle.stopAutoPlay();

    // Replace with fresh instances
    ctx.marketManager = new MarketManager();
    ctx.positionTracker = new PositionTracker();
    ctx.oracle.reset();
    ctx.ws.clear();

    ctx.log.adminReset();
    return { success: true };
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
