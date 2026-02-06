import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../context.js';
import type { BetRequest, BetResponse } from './types.js';
import { getPrice, getShares, getNewQuantities } from '../modules/lmsr/engine.js';
import { toMicroUnits, ASSET } from '../utils/units.js';

export function registerBetRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.post<{ Body: BetRequest }>('/api/bet', async (req, reply) => {
    const { address, marketId, outcome, amount, appSessionId, appSessionVersion } = req.body ?? {} as any;

    // Validate required fields
    if (!address || !marketId || !outcome || amount === undefined || !appSessionId || appSessionVersion === undefined) {
      return reply.status(400).send({ accepted: false, reason: 'Missing required fields' });
    }

    // Validate outcome
    if (outcome !== 'BALL' && outcome !== 'STRIKE') {
      return reply.status(400).send({ accepted: false, reason: 'Invalid outcome' });
    }

    // Validate amount
    if (typeof amount !== 'number' || amount <= 0) {
      return reply.status(400).send({ accepted: false, reason: 'Amount must be positive' });
    }

    // Check market exists and is OPEN
    const market = ctx.marketManager.getMarket(marketId);
    if (!market || market.status !== 'OPEN') {
      const reason = !market ? 'Market not found' : `Market is ${market.status}`;
      ctx.log.betRejected(address, reason);

      // Close the app session to return user funds
      try {
        const mmAddress = ctx.clearnodeClient.getAddress();
        await ctx.clearnodeClient.closeSession({
          appSessionId: appSessionId as `0x${string}`,
          allocations: [
            { participant: address as `0x${string}`, asset: ASSET, amount: toMicroUnits(amount) },
            { participant: mmAddress as `0x${string}`, asset: ASSET, amount: '0' },
          ],
        });
        ctx.log.betRejectionSessionClosed(appSessionId);
      } catch (err) {
        ctx.log.error('bet-rejection-close-session', err);
      }

      return { accepted: false, reason } as BetResponse;
    }

    // Calculate shares from LMSR
    const shares = getShares(market.qBall, market.qStrike, market.b, outcome, amount);
    const { qBall, qStrike } = getNewQuantities(market.qBall, market.qStrike, outcome, shares);

    // Update market quantities
    ctx.marketManager.updateQuantities(marketId, qBall, qStrike);

    // Record position
    const timestamp = Date.now();
    const position = {
      address,
      marketId,
      outcome,
      shares,
      costPaid: amount,
      appSessionId,
      appSessionVersion,
      sessionStatus: 'open' as const,
      timestamp,
    };
    ctx.positionTracker.addPosition(position);

    // Broadcast position added
    const positionCount = ctx.positionTracker.getPositionsByMarket(marketId).length;
    ctx.ws.broadcast({
      type: 'POSITION_ADDED',
      position,
      positionCount,
    });

    // Compute new prices
    const newPriceBall = getPrice(qBall, qStrike, market.b, 'BALL');
    const newPriceStrike = getPrice(qBall, qStrike, market.b, 'STRIKE');

    // Broadcast odds update
    ctx.ws.broadcast({
      type: 'ODDS_UPDATE',
      priceBall: newPriceBall,
      priceStrike: newPriceStrike,
      qBall,
      qStrike,
      marketId,
    });

    ctx.log.betPlaced(address, amount, outcome, marketId, shares, newPriceBall, newPriceStrike);
    ctx.log.broadcast('ODDS_UPDATE', ctx.ws.getConnectionCount());

    return {
      accepted: true,
      shares,
      newPriceBall,
      newPriceStrike,
    } as BetResponse;
  });
}
