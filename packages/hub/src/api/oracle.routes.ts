import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../context.js';
import type { GameStateRequest, OutcomeRequest } from './types.js';
import type { Outcome } from '../modules/lmsr/types.js';
import { getPrice } from '../modules/lmsr/engine.js';
import { toMicroUnits, ASSET } from '../utils/units.js';

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
      qBall: market.qBall,
      qStrike: market.qStrike,
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

    // Build lookup from appSessionId → position (for costPaid + version)
    const positionMap = new Map(positions.map((p) => [p.appSessionId, p]));
    const mmAddress = ctx.clearnodeClient.getAddress();

    ctx.log.marketResolved(
      current.id,
      outcome,
      result.winners.length,
      result.losers.length,
      result.totalPayout,
    );

    // ── Settle losers first (MM needs funds before paying winners) ──
    for (const loser of result.losers) {
      try {
        const pos = positionMap.get(loser.appSessionId);
        const version = pos ? pos.appSessionVersion + 1 : 2;
        const lossAmount = toMicroUnits(loser.loss);
        const sessionId = loser.appSessionId as `0x${string}`;
        const loserAddr = loser.address as `0x${string}`;
        const mm = mmAddress as `0x${string}`;

        // Update state: reallocate user funds to MM
        await ctx.clearnodeClient.submitAppState({
          appSessionId: sessionId,
          intent: 'operate',
          version,
          allocations: [
            { participant: loserAddr, asset: ASSET, amount: '0' },
            { participant: mm, asset: ASSET, amount: lossAmount },
          ],
        });
        ctx.log.resolutionStateUpdate(loser.address, loser.appSessionId, version);

        // Close the session
        await ctx.clearnodeClient.closeSession({
          appSessionId: sessionId,
          allocations: [
            { participant: loserAddr, asset: ASSET, amount: '0' },
            { participant: mm, asset: ASSET, amount: lossAmount },
          ],
        });
        ctx.log.resolutionSessionClosed(loser.address, loser.appSessionId);

        ctx.positionTracker.updateSessionStatus(loser.appSessionId, 'settled');
        ctx.ws.broadcast({
          type: 'SESSION_SETTLED',
          appSessionId: loser.appSessionId,
          status: 'settled' as const,
          address: loser.address,
        });
      } catch (err) {
        ctx.log.error(`resolution-loser-${loser.address}`, err);
      }

      ctx.ws.sendTo(loser.address, {
        type: 'BET_RESULT',
        result: 'LOSS',
        marketId: current.id,
        loss: loser.loss,
      });
      ctx.log.sendTo(loser.address, 'BET_RESULT:LOSS');
    }

    // ── Settle winners ──
    for (const winner of result.winners) {
      try {
        const pos = positionMap.get(winner.appSessionId);
        const costPaid = pos ? pos.costPaid : 0;
        const sessionId = winner.appSessionId as `0x${string}`;
        const winnerAddr = winner.address as `0x${string}`;
        const mm = mmAddress as `0x${string}`;

        // Close session: return user's original funds
        await ctx.clearnodeClient.closeSession({
          appSessionId: sessionId,
          allocations: [
            { participant: winnerAddr, asset: ASSET, amount: toMicroUnits(costPaid) },
            { participant: mm, asset: ASSET, amount: '0' },
          ],
        });
        ctx.log.resolutionSessionClosed(winner.address, winner.appSessionId);

        // Transfer profit (payout - costPaid) from MM to winner
        const profit = winner.payout - costPaid;
        if (profit > 0) {
          await ctx.clearnodeClient.transfer({
            destination: winnerAddr,
            asset: ASSET,
            amount: toMicroUnits(profit),
          });
          ctx.log.resolutionTransfer(winner.address, profit);
        }

        ctx.positionTracker.updateSessionStatus(winner.appSessionId, 'settled');
        ctx.ws.broadcast({
          type: 'SESSION_SETTLED',
          appSessionId: winner.appSessionId,
          status: 'settled' as const,
          address: winner.address,
        });
      } catch (err) {
        ctx.log.error(`resolution-winner-${winner.address}`, err);
      }

      ctx.ws.sendTo(winner.address, {
        type: 'BET_RESULT',
        result: 'WIN',
        marketId: current.id,
        payout: winner.payout,
      });
      ctx.log.sendTo(winner.address, 'BET_RESULT:WIN');
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
