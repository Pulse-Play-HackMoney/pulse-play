import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../context.js';
import type { GameStateRequest, OutcomeRequest } from './types.js';
import type { Outcome } from '../modules/lmsr/types.js';
import { getPrice } from '../modules/lmsr/engine.js';

let marketCounter = 0;

export function registerOracleRoutes(app: FastifyInstance, ctx: AppContext): void {

  app.post<{ Body: GameStateRequest }>('/api/oracle/game-state', async (req, reply) => {
    const { active } = req.body ?? {} as any;
    if (typeof active !== 'boolean') {
      return reply.status(400).send({ error: 'active field is required (boolean)' });
    }

    ctx.oracle.setGameActive(active);

    ctx.ws.broadcast({ type: 'GAME_STATE', active });
    ctx.log.gameStateChanged(active);

    return { success: true, active };
  });

  app.post('/api/oracle/market/open', async (_req, reply) => {
    if (!ctx.oracle.isActive()) {
      return reply.status(400).send({ error: 'Game is not active' });
    }

    // Check if there's already an OPEN market
    const current = ctx.marketManager.getCurrentMarket();
    if (current && current.status === 'OPEN') {
      return reply.status(400).send({ error: 'A market is already OPEN' });
    }

    marketCounter++;
    const marketId = `market-${marketCounter}`;
    ctx.marketManager.createMarket(marketId);
    const market = ctx.marketManager.openMarket(marketId);

    ctx.ws.broadcast({
      type: 'MARKET_STATUS',
      status: 'OPEN',
      marketId: market.id,
    });

    // Broadcast fresh 50/50 odds for the new market
    const priceBall = getPrice(market.qBall, market.qStrike, market.b, 'BALL');
    const priceStrike = getPrice(market.qBall, market.qStrike, market.b, 'STRIKE');
    ctx.ws.broadcast({
      type: 'ODDS_UPDATE',
      priceBall,
      priceStrike,
      marketId: market.id,
    });

    ctx.log.marketOpened(market.id);
    ctx.log.broadcast('MARKET_STATUS', ctx.ws.getConnectionCount());

    return { success: true, marketId: market.id };
  });

  app.post('/api/oracle/market/close', async (_req, reply) => {
    const current = ctx.marketManager.getCurrentMarket();
    if (!current || current.status !== 'OPEN') {
      const reason = !current ? 'No market to close' : `Market is ${current.status}`;
      return reply.status(400).send({ error: reason });
    }

    ctx.marketManager.closeMarket(current.id);

    ctx.ws.broadcast({
      type: 'MARKET_STATUS',
      status: 'CLOSED',
      marketId: current.id,
    });

    ctx.log.marketClosed(current.id);
    ctx.log.broadcast('MARKET_STATUS', ctx.ws.getConnectionCount());

    return { success: true, marketId: current.id };
  });

  app.post<{ Body: OutcomeRequest }>('/api/oracle/outcome', async (req, reply) => {
    const current = ctx.marketManager.getCurrentMarket();
    if (!current || current.status !== 'CLOSED') {
      const reason = !current ? 'No market to resolve' : `Market is ${current.status}`;
      return reply.status(400).send({ error: reason });
    }

    const { outcome } = req.body ?? {} as any;
    if (outcome !== 'BALL' && outcome !== 'STRIKE') {
      return reply.status(400).send({ error: 'Invalid outcome (must be BALL or STRIKE)' });
    }

    const positions = ctx.positionTracker.getPositionsByMarket(current.id);
    const result = ctx.marketManager.resolveMarket(current.id, outcome as Outcome, positions);

    ctx.log.marketResolved(
      current.id,
      outcome,
      result.winners.length,
      result.losers.length,
      result.totalPayout,
    );

    // Send individual results to bettors
    for (const winner of result.winners) {
      ctx.ws.sendTo(winner.address, {
        type: 'BET_RESULT',
        result: 'WIN',
        marketId: current.id,
        payout: winner.payout,
      });
      ctx.log.sendTo(winner.address, 'BET_RESULT:WIN');
    }

    for (const loser of result.losers) {
      ctx.ws.sendTo(loser.address, {
        type: 'BET_RESULT',
        result: 'LOSS',
        marketId: current.id,
        loss: loser.loss,
      });
      ctx.log.sendTo(loser.address, 'BET_RESULT:LOSS');
    }

    // Clear positions for this market
    ctx.positionTracker.clearPositions(current.id);

    // Broadcast market resolved
    ctx.ws.broadcast({
      type: 'MARKET_STATUS',
      status: 'RESOLVED',
      marketId: current.id,
      outcome: outcome as Outcome,
    });

    ctx.log.broadcast('MARKET_STATUS', ctx.ws.getConnectionCount());

    return {
      success: true,
      marketId: current.id,
      outcome,
      winners: result.winners.length,
      losers: result.losers.length,
      totalPayout: result.totalPayout,
    };
  });
}

/** Reset market counter (for testing) */
export function resetMarketCounter(): void {
  marketCounter = 0;
}
