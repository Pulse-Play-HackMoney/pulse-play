import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../context.js';
import type { BetRequest, BetResponse } from './types.js';
import { getShares, getNewQuantities, getPrices } from '../modules/lmsr/engine.js';
import { toMicroUnits, ASSET } from '../utils/units.js';
import { eq } from 'drizzle-orm';
import { marketCategories } from '../db/schema.js';
import { encodeSessionData, type SessionDataV2 } from '../modules/clearnode/session-data.js';

export function registerBetRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.post<{ Body: BetRequest }>('/api/bet', async (req, reply) => {
    const { address, marketId, outcome, amount, appSessionId, appSessionVersion } = req.body ?? {} as any;

    // Validate required fields
    if (!address || !marketId || !outcome || amount === undefined || !appSessionId || appSessionVersion === undefined) {
      return reply.status(400).send({ accepted: false, reason: 'Missing required fields' });
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

    // Look up category to get outcomes array
    const category = ctx.db.select().from(marketCategories)
      .where(eq(marketCategories.id, market.categoryId))
      .get();

    const outcomes: string[] = category ? JSON.parse(category.outcomes) : [];

    // Validate outcome against category outcomes
    if (outcomes.length > 0 && !outcomes.includes(outcome)) {
      return reply.status(400).send({ accepted: false, reason: 'Invalid outcome' });
    }

    // Find the outcome index for LMSR
    const outcomeIndex = outcomes.indexOf(outcome);
    if (outcomeIndex === -1) {
      return reply.status(400).send({ accepted: false, reason: 'Invalid outcome' });
    }

    // Compute fee
    const feePercent = ctx.transactionFeePercent;
    const feeAmount = amount * (feePercent / 100);
    const netAmount = amount - feeAmount;

    // Capture pre-bet odds (N-outcome)
    const preBetPrices = getPrices(market.quantities, market.b);

    // Calculate shares from LMSR using netAmount (fee reduces shares received)
    const shares = getShares(market.quantities, market.b, outcomeIndex, netAmount);
    const newQuantities = getNewQuantities(market.quantities, outcomeIndex, shares);

    // Update market quantities
    ctx.marketManager.updateQuantities(marketId, newQuantities);

    // Record position
    const timestamp = Date.now();
    const position = {
      address,
      marketId,
      outcome,
      shares,
      costPaid: amount,
      fee: feeAmount,
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
    const prices = getPrices(newQuantities, market.b);

    // Broadcast odds update (both new and backward-compat fields)
    ctx.ws.broadcast({
      type: 'ODDS_UPDATE',
      prices,
      quantities: newQuantities,
      outcomes,
      marketId,
      // backward compat
      priceBall: prices[0] ?? 0.5,
      priceStrike: prices[1] ?? 0.5,
      qBall: newQuantities[0] ?? 0,
      qStrike: newQuantities[1] ?? 0,
    });

    ctx.log.betPlaced(address, amount, outcome, marketId, shares, prices[0] ?? 0.5, prices[1] ?? 0.5);
    ctx.log.broadcast('ODDS_UPDATE', ctx.ws.getConnectionCount());

    // V2 sessionData: enrich app session with LMSR confirmation (non-fatal)
    try {
      const mmAddress = ctx.clearnodeClient.getAddress();
      const v2Data: SessionDataV2 = {
        v: 2,
        marketId,
        outcome,
        amount,
        shares,
        effectivePricePerShare: netAmount / shares,
        preBetOdds: { ball: preBetPrices[0] ?? 0.5, strike: preBetPrices[1] ?? 0.5 },
        postBetOdds: { ball: prices[0] ?? 0.5, strike: prices[1] ?? 0.5 },
        fee: feeAmount,
        feePercent,
        timestamp,
      };
      await ctx.clearnodeClient.submitAppState({
        appSessionId: appSessionId as `0x${string}`,
        intent: 'operate',
        version: appSessionVersion + 1,
        allocations: [
          { participant: address as `0x${string}`, asset: ASSET, amount: toMicroUnits(netAmount) },
          { participant: mmAddress as `0x${string}`, asset: ASSET, amount: toMicroUnits(feeAmount) },
        ],
        sessionData: encodeSessionData(v2Data),
      });
      const v2SessionDataStr = encodeSessionData(v2Data);
      ctx.positionTracker.updateAppSessionVersion(appSessionId, appSessionVersion + 1);
      ctx.positionTracker.updateSessionData(appSessionId, v2SessionDataStr);
      ctx.ws.broadcast({
        type: 'SESSION_VERSION_UPDATED',
        appSessionId,
        version: appSessionVersion + 1,
        sessionData: v2SessionDataStr,
      });
      ctx.log.betSessionDataUpdated(address, appSessionId, appSessionVersion + 1);
    } catch (err) {
      ctx.log.betSessionDataFailed(address, appSessionId, err);
    }

    return {
      accepted: true,
      shares,
      newPriceBall: prices[0] ?? 0.5,
      newPriceStrike: prices[1] ?? 0.5,
    } as BetResponse;
  });
}
