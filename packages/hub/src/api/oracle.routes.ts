import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../context.js';
import type { GameStateRequest, OutcomeRequest } from './types.js';
import type { Outcome } from '../modules/lmsr/types.js';
import { getPrices } from '../modules/lmsr/engine.js';
import { toMicroUnits, ASSET } from '../utils/units.js';
import { eq } from 'drizzle-orm';
import { marketCategories } from '../db/schema.js';
import { encodeSessionData, type SessionDataV3, type SessionDataV3P2P } from '../modules/clearnode/session-data.js';
import { broadcastPoolUpdate } from './pool-update.js';

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

    // Check if there's already an OPEN or CLOSED market for this stream
    const current = ctx.marketManager.getCurrentMarket(gameId, categoryId);
    if (current && current.status === 'OPEN') {
      return reply.status(400).send({ error: 'A market is already OPEN' });
    }
    if (current && current.status === 'CLOSED') {
      return reply.status(400).send({ error: 'A CLOSED market must be resolved before opening a new one' });
    }

    // Auto-scale b parameter from pool value
    let bParam: number | undefined;
    try {
      const balance = await ctx.clearnodeClient.getBalance();
      const poolValue = parseFloat(balance) / 1_000_000;
      if (poolValue > 0) {
        bParam = poolValue * ctx.lmsrSensitivityFactor;
      }
    } catch {
      // Balance unavailable — use default b
    }

    const created = ctx.marketManager.createMarket(gameId, categoryId, bParam);
    const market = ctx.marketManager.openMarket(created.id);

    ctx.ws.broadcast({
      type: 'MARKET_STATUS',
      status: 'OPEN',
      marketId: market.id,
      gameId: market.gameId,
      categoryId: market.categoryId,
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

    await broadcastPoolUpdate(ctx);

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
      gameId: current.gameId,
      categoryId: current.categoryId,
    });

    ctx.log.marketClosed(current.id);
    ctx.log.broadcast('MARKET_STATUS', ctx.ws.getConnectionCount());

    await broadcastPoolUpdate(ctx);

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

    const allPositions = ctx.positionTracker.getPositionsByMarket(current.id);
    // Only LMSR positions go through the LMSR resolution path
    const positions = allPositions.filter(p => (p.mode ?? 'lmsr') === 'lmsr');
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
        mode: 'lmsr',
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

      ctx.userTracker.recordLoss(loser.address, pos ? pos.costPaid : loser.loss);

      ctx.ws.sendTo(loser.address, {
        type: 'BET_RESULT',
        result: 'LOSS',
        marketId: current.id,
        loss: loser.loss,
      });
      ctx.log.sendTo(loser.address, 'BET_RESULT:LOSS');

      await broadcastPoolUpdate(ctx);
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
        mode: 'lmsr',
        resolution: outcome as Outcome,
        result: 'WIN',
        payout: winner.payout,
        profit: winner.payout - costPaid,
        shares: pos ? pos.shares : 0,
        costPaid,
        timestamp: Date.now(),
      };
      const v3SessionData = encodeSessionData(v3Data);

      // Submit V3 state before closing (Fix 10: winners get V3 data like losers)
      const winnerVersion = pos ? pos.appSessionVersion + 1 : 2;
      try {
        await ctx.clearnodeClient.submitAppState({
          appSessionId: sessionId,
          intent: 'operate',
          version: winnerVersion,
          allocations: [
            { participant: winnerAddr, asset: ASSET, amount: toMicroUnits(netAmount) },
            { participant: mm, asset: ASSET, amount: toMicroUnits(fee) },
          ],
          sessionData: v3SessionData,
        });
        ctx.positionTracker.updateAppSessionVersion(winner.appSessionId, winnerVersion);
        ctx.positionTracker.updateSessionData(winner.appSessionId, v3SessionData);
        ctx.ws.broadcast({
          type: 'SESSION_VERSION_UPDATED',
          appSessionId: winner.appSessionId,
          version: winnerVersion,
          sessionData: v3SessionData,
        });
        ctx.log.resolutionStateUpdate(winner.address, winner.appSessionId, winnerVersion);
      } catch (err) {
        ctx.log.error(`resolution-winner-submitAppState-${winner.address}`, err);
      }

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

      ctx.userTracker.recordWin(winner.address, winner.payout, costPaid);

      ctx.ws.sendTo(winner.address, {
        type: 'BET_RESULT',
        result: 'WIN',
        marketId: current.id,
        payout: winner.payout,
      });
      ctx.log.sendTo(winner.address, 'BET_RESULT:WIN');

      await broadcastPoolUpdate(ctx);
    }

    // ── P2P Resolution ─────────────────────────────────────────────────
    const filledP2POrders = ctx.orderBookManager.getFilledOrdersForResolution(current.id);
    if (filledP2POrders.length > 0) {
      ctx.log.p2pResolutionStart(current.id, filledP2POrders.length);

      const p2pLosers = filledP2POrders.filter(o => o.outcome !== outcome);
      const p2pWinners = filledP2POrders.filter(o => o.outcome === outcome);

      // Settle P2P losers first (MM needs funds for winners)
      for (const order of p2pLosers) {
        const filledCost = order.filledAmount;
        const unfilled = order.unfilledAmount;
        const sessionId = order.appSessionId as `0x${string}`;
        const loserAddr = order.userAddress as `0x${string}`;
        const mm = mmAddress as `0x${string}`;
        const pos = ctx.positionTracker.getPositionBySession(order.appSessionId);
        const p2pLoserVersion = pos ? pos.appSessionVersion + 1 : 2;

        const v3p2p: SessionDataV3P2P = {
          v: 3,
          mode: 'p2p',
          resolution: outcome as Outcome,
          result: 'LOSS',
          orderId: order.orderId,
          filledShares: order.filledShares,
          filledCost,
          payout: 0,
          profit: -filledCost,
          refunded: unfilled,
          timestamp: Date.now(),
        };
        const sessionData = encodeSessionData(v3p2p);

        // Submit V3P2P state before closing (mirrors LMSR loser pattern)
        try {
          await ctx.clearnodeClient.submitAppState({
            appSessionId: sessionId,
            intent: 'operate',
            version: p2pLoserVersion,
            allocations: [
              { participant: loserAddr, asset: ASSET, amount: toMicroUnits(unfilled) },
              { participant: mm, asset: ASSET, amount: toMicroUnits(filledCost) },
            ],
            sessionData,
          });
          ctx.positionTracker.updateAppSessionVersion(order.appSessionId, p2pLoserVersion);
          ctx.positionTracker.updateSessionData(order.appSessionId, sessionData);
          ctx.ws.broadcast({
            type: 'SESSION_VERSION_UPDATED',
            appSessionId: order.appSessionId,
            version: p2pLoserVersion,
            sessionData,
          });
          ctx.log.resolutionStateUpdate(order.userAddress, order.appSessionId, p2pLoserVersion);
        } catch (err) {
          ctx.log.error(`p2p-resolution-loser-submitAppState-${order.userAddress}`, err);
        }

        try {
          await ctx.clearnodeClient.closeSession({
            appSessionId: sessionId,
            allocations: [
              { participant: loserAddr, asset: ASSET, amount: toMicroUnits(unfilled) },
              { participant: mm, asset: ASSET, amount: toMicroUnits(filledCost) },
            ],
            sessionData,
          });
          ctx.log.resolutionSessionClosed(order.userAddress, order.appSessionId);
        } catch (err) {
          ctx.log.error(`p2p-resolution-loser-${order.userAddress}`, err);
        }

        ctx.positionTracker.updateSessionStatus(order.appSessionId, 'settled');
        ctx.ws.broadcast({
          type: 'SESSION_SETTLED',
          appSessionId: order.appSessionId,
          status: 'settled' as const,
          address: order.userAddress,
        });

        ctx.userTracker.recordLoss(order.userAddress, filledCost);
        ctx.orderBookManager.settleOrder(order.orderId);
        ctx.log.p2pLoserSettled(order.userAddress, filledCost);

        ctx.ws.sendTo(order.userAddress, {
          type: 'P2P_BET_RESULT',
          result: 'LOSS',
          orderId: order.orderId,
          marketId: current.id,
          loss: filledCost,
          refunded: unfilled,
        });
      }

      // Settle P2P winners
      for (const order of p2pWinners) {
        const filledCost = order.filledAmount;
        const unfilled = order.unfilledAmount;
        const filledShares = order.filledShares;
        const payout = filledShares * 1.0; // $1 per share
        const feePercent = ctx.transactionFeePercent;
        const fee = payout * (feePercent / 100);
        const netPayout = payout - fee;
        const profit = netPayout - filledCost;
        const sessionId = order.appSessionId as `0x${string}`;
        const winnerAddr = order.userAddress as `0x${string}`;
        const mm = mmAddress as `0x${string}`;
        const winPos = ctx.positionTracker.getPositionBySession(order.appSessionId);
        const p2pWinnerVersion = winPos ? winPos.appSessionVersion + 1 : 2;

        const v3p2p: SessionDataV3P2P = {
          v: 3,
          mode: 'p2p',
          resolution: outcome as Outcome,
          result: 'WIN',
          orderId: order.orderId,
          filledShares,
          filledCost,
          payout: netPayout,
          profit,
          refunded: unfilled,
          timestamp: Date.now(),
        };
        const sessionData = encodeSessionData(v3p2p);

        // Submit V3P2P state before closing (mirrors LMSR winner pattern)
        try {
          await ctx.clearnodeClient.submitAppState({
            appSessionId: sessionId,
            intent: 'operate',
            version: p2pWinnerVersion,
            allocations: [
              { participant: winnerAddr, asset: ASSET, amount: toMicroUnits(filledCost + unfilled - fee) },
              { participant: mm, asset: ASSET, amount: toMicroUnits(fee) },
            ],
            sessionData,
          });
          ctx.positionTracker.updateAppSessionVersion(order.appSessionId, p2pWinnerVersion);
          ctx.positionTracker.updateSessionData(order.appSessionId, sessionData);
          ctx.ws.broadcast({
            type: 'SESSION_VERSION_UPDATED',
            appSessionId: order.appSessionId,
            version: p2pWinnerVersion,
            sessionData,
          });
          ctx.log.resolutionStateUpdate(order.userAddress, order.appSessionId, p2pWinnerVersion);
        } catch (err) {
          ctx.log.error(`p2p-resolution-winner-submitAppState-${order.userAddress}`, err);
        }

        // Close session: return unfilled + fee to MM
        try {
          await ctx.clearnodeClient.closeSession({
            appSessionId: sessionId,
            allocations: [
              { participant: winnerAddr, asset: ASSET, amount: toMicroUnits(filledCost + unfilled - fee) },
              { participant: mm, asset: ASSET, amount: toMicroUnits(fee) },
            ],
            sessionData,
          });
          ctx.log.resolutionSessionClosed(order.userAddress, order.appSessionId);
        } catch (err) {
          ctx.log.error(`p2p-resolution-winner-closeSession-${order.userAddress}`, err);
        }

        // Transfer profit from MM to winner
        if (profit > 0) {
          try {
            await ctx.clearnodeClient.transfer({
              destination: winnerAddr,
              asset: ASSET,
              amount: toMicroUnits(profit),
            });
            ctx.log.resolutionTransfer(order.userAddress, profit);
          } catch (err) {
            ctx.log.error(`p2p-resolution-winner-transfer-${order.userAddress}`, err);
          }
        }

        ctx.positionTracker.updateSessionStatus(order.appSessionId, 'settled');
        ctx.ws.broadcast({
          type: 'SESSION_SETTLED',
          appSessionId: order.appSessionId,
          status: 'settled' as const,
          address: order.userAddress,
        });

        ctx.userTracker.recordWin(order.userAddress, payout, filledCost);
        ctx.orderBookManager.settleOrder(order.orderId);
        ctx.log.p2pWinnerSettled(order.userAddress, netPayout, profit);

        ctx.ws.sendTo(order.userAddress, {
          type: 'P2P_BET_RESULT',
          result: 'WIN',
          orderId: order.orderId,
          marketId: current.id,
          payout: netPayout,
          profit,
        });
      }

    }

    // Expire fully unfilled P2P orders + refund (always runs, not just when fills exist)
    const expiredOrders = ctx.orderBookManager.expireUnfilledOrders(current.id);
    for (const order of expiredOrders) {
      try {
        await ctx.clearnodeClient.closeSession({
          appSessionId: order.appSessionId as `0x${string}`,
          allocations: [
            { participant: order.userAddress as `0x${string}`, asset: ASSET, amount: toMicroUnits(order.amount) },
            { participant: mmAddress as `0x${string}`, asset: ASSET, amount: '0' },
          ],
        });
      } catch (err) {
        ctx.log.error(`p2p-expire-close-${order.userAddress}`, err);
      }

      // Update position status + broadcast so simulator/frontend reflect settled state
      ctx.positionTracker.updateSessionStatus(order.appSessionId, 'settled');
      ctx.ws.broadcast({
        type: 'SESSION_SETTLED',
        appSessionId: order.appSessionId,
        status: 'settled' as const,
        address: order.userAddress,
      });

      ctx.log.orderExpired(order.orderId);
    }

    // Clear positions for this market (archives to settlements)
    ctx.positionTracker.clearPositions(current.id);

    // Broadcast market resolved
    ctx.ws.broadcast({
      type: 'MARKET_STATUS',
      status: 'RESOLVED',
      marketId: current.id,
      outcome: outcome as Outcome,
      gameId: current.gameId,
      categoryId: current.categoryId,
    });

    ctx.log.broadcast('MARKET_STATUS', ctx.ws.getConnectionCount());

    // Broadcast pool update after resolution (authoritative final state)
    await broadcastPoolUpdate(ctx);

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
