import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../context.js';
import type { GameStateRequest, OutcomeRequest } from './types.js';
import type { Outcome } from '../modules/lmsr/types.js';
import { getPrices } from '../modules/lmsr/engine.js';
import { toMicroUnits, ASSET } from '../utils/units.js';
import { eq } from 'drizzle-orm';
import { marketCategories } from '../db/schema.js';
import { encodeSessionData, type SessionDataV3 } from '../modules/clearnode/session-data.js';

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

  app.post<{ Body: { gameId?: string; categoryId?: string } }>('/api/oracle/market/open', async (req, reply) => {
    const { gameId, categoryId } = req.body ?? {} as any;
    if (!gameId || !categoryId) {
      return reply.status(400).send({ error: 'gameId and categoryId are required' });
    }

    // Validate game exists and is active
    const game = ctx.gameManager.getGame(gameId);
    if (!game) {
      return reply.status(400).send({ error: `Game ${gameId} not found` });
    }
    if (game.status !== 'ACTIVE') {
      return reply.status(400).send({ error: 'Game is not active' });
    }

    // Check if there's already an OPEN market for this stream
    const current = ctx.marketManager.getCurrentMarket(gameId, categoryId);
    if (current && current.status === 'OPEN') {
      return reply.status(400).send({ error: 'A market is already OPEN' });
    }

    const created = ctx.marketManager.createMarket(gameId, categoryId);
    const market = ctx.marketManager.openMarket(created.id);

    ctx.ws.broadcast({
      type: 'MARKET_STATUS',
      status: 'OPEN',
      marketId: market.id,
    });

    // Broadcast fresh equal odds for the new market
    const prices = getPrices(market.quantities, market.b);

    // Look up category outcomes
    const category = ctx.db.select().from(marketCategories)
      .where(eq(marketCategories.id, market.categoryId))
      .get();
    const outcomes: string[] = category ? JSON.parse(category.outcomes) : [];

    ctx.ws.broadcast({
      type: 'ODDS_UPDATE',
      prices,
      quantities: market.quantities,
      outcomes,
      marketId: market.id,
      // backward compat
      priceBall: prices[0] ?? 0.5,
      priceStrike: prices[1] ?? 0.5,
      qBall: market.quantities[0] ?? 0,
      qStrike: market.quantities[1] ?? 0,
    });

    ctx.log.marketOpened(market.id);
    ctx.log.broadcast('MARKET_STATUS', ctx.ws.getConnectionCount());

    return { success: true, marketId: market.id };
  });

  app.post<{ Body: { gameId?: string; categoryId?: string } }>('/api/oracle/market/close', async (req, reply) => {
    const { gameId, categoryId } = req.body ?? {} as any;

    const current = (gameId && categoryId)
      ? ctx.marketManager.getCurrentMarket(gameId, categoryId)
      : ctx.marketManager.getCurrentMarket();

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

  app.post<{ Body: OutcomeRequest & { gameId?: string; categoryId?: string } }>('/api/oracle/outcome', async (req, reply) => {
    const { gameId, categoryId } = req.body ?? {} as any;

    const current = (gameId && categoryId)
      ? ctx.marketManager.getCurrentMarket(gameId, categoryId)
      : ctx.marketManager.getCurrentMarket();

    if (!current || current.status !== 'CLOSED') {
      const reason = !current ? 'No market to resolve' : `Market is ${current.status}`;
      return reply.status(400).send({ error: reason });
    }

    const { outcome } = req.body ?? {} as any;

    // Validate outcome against the market's category outcomes array
    const category = ctx.db.select().from(marketCategories)
      .where(eq(marketCategories.id, current.categoryId))
      .get();

    if (category) {
      const outcomes: string[] = JSON.parse(category.outcomes);
      if (!outcomes.includes(outcome)) {
        return reply.status(400).send({
          error: `Invalid outcome (must be one of: ${outcomes.join(', ')})`,
        });
      }
    } else if (!outcome || typeof outcome !== 'string') {
      return reply.status(400).send({ error: 'Invalid outcome' });
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
      const pos = positionMap.get(loser.appSessionId);
      const version = pos ? pos.appSessionVersion + 1 : 2;
      const lossAmount = toMicroUnits(loser.loss);
      const sessionId = loser.appSessionId as `0x${string}`;
      const loserAddr = loser.address as `0x${string}`;
      const mm = mmAddress as `0x${string}`;

      const v3Data: SessionDataV3 = {
        v: 3,
        resolution: outcome as Outcome,
        result: 'LOSS',
        payout: 0,
        profit: -loser.loss,
        shares: pos ? pos.shares : 0,
        costPaid: pos ? pos.costPaid : 0,
        timestamp: Date.now(),
      };
      const v3SessionData = encodeSessionData(v3Data);

      try {
        // Update state: reallocate user funds to MM
        await ctx.clearnodeClient.submitAppState({
          appSessionId: sessionId,
          intent: 'operate',
          version,
          allocations: [
            { participant: loserAddr, asset: ASSET, amount: '0' },
            { participant: mm, asset: ASSET, amount: lossAmount },
          ],
          sessionData: v3SessionData,
        });
        ctx.log.resolutionStateUpdate(loser.address, loser.appSessionId, version);
        ctx.positionTracker.updateAppSessionVersion(loser.appSessionId, version);
        ctx.positionTracker.updateSessionData(loser.appSessionId, v3SessionData);
        ctx.ws.broadcast({
          type: 'SESSION_VERSION_UPDATED',
          appSessionId: loser.appSessionId,
          version,
          sessionData: v3SessionData,
        });

        // Close the session
        await ctx.clearnodeClient.closeSession({
          appSessionId: sessionId,
          allocations: [
            { participant: loserAddr, asset: ASSET, amount: '0' },
            { participant: mm, asset: ASSET, amount: lossAmount },
          ],
          sessionData: v3SessionData,
        });
        ctx.log.resolutionSessionClosed(loser.address, loser.appSessionId);
      } catch (err) {
        ctx.log.error(`resolution-loser-${loser.address}`, err);
      }

      // Always update status + notify (outside try/catch so losers are settled even if Clearnode fails)
      ctx.positionTracker.updateSessionStatus(loser.appSessionId, 'settled');
      ctx.ws.broadcast({
        type: 'SESSION_SETTLED',
        appSessionId: loser.appSessionId,
        status: 'settled' as const,
        address: loser.address,
      });

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
      const pos = positionMap.get(winner.appSessionId);
      const costPaid = pos ? pos.costPaid : 0;
      const fee = pos?.fee ?? 0;
      const netAmount = costPaid - fee;
      const sessionId = winner.appSessionId as `0x${string}`;
      const winnerAddr = winner.address as `0x${string}`;
      const mm = mmAddress as `0x${string}`;

      const v3Data: SessionDataV3 = {
        v: 3,
        resolution: outcome as Outcome,
        result: 'WIN',
        payout: winner.payout,
        profit: winner.payout - costPaid,
        shares: pos ? pos.shares : 0,
        costPaid,
        timestamp: Date.now(),
      };
      const v3SessionData = encodeSessionData(v3Data);

      // Close session: return user's net funds (fee stays with MM)
      try {
        await ctx.clearnodeClient.closeSession({
          appSessionId: sessionId,
          allocations: [
            { participant: winnerAddr, asset: ASSET, amount: toMicroUnits(netAmount) },
            { participant: mm, asset: ASSET, amount: toMicroUnits(fee) },
          ],
          sessionData: v3SessionData,
        });
        ctx.positionTracker.updateSessionData(winner.appSessionId, v3SessionData);
        ctx.log.resolutionSessionClosed(winner.address, winner.appSessionId);
      } catch (err) {
        ctx.log.error(`resolution-winner-closeSession-${winner.address}`, err);
      }

      // Transfer profit (payout - costPaid) from MM to winner
      const profit = winner.payout - costPaid;
      if (profit > 0) {
        try {
          await ctx.clearnodeClient.transfer({
            destination: winnerAddr,
            asset: ASSET,
            amount: toMicroUnits(profit),
          });
          ctx.log.resolutionTransfer(winner.address, profit);
        } catch (err) {
          ctx.log.error(`resolution-winner-transfer-${winner.address}`, err);
        }
      }

      // Always update status + notify (outside try/catch so winners are settled even if Clearnode fails)
      ctx.positionTracker.updateSessionStatus(winner.appSessionId, 'settled');
      ctx.ws.broadcast({
        type: 'SESSION_SETTLED',
        appSessionId: winner.appSessionId,
        status: 'settled' as const,
        address: winner.address,
      });

      ctx.ws.sendTo(winner.address, {
        type: 'BET_RESULT',
        result: 'WIN',
        marketId: current.id,
        payout: winner.payout,
      });
      ctx.log.sendTo(winner.address, 'BET_RESULT:WIN');
    }

    // Clear positions for this market (archives to settlements)
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
