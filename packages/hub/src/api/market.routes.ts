import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../context.js';
import { getPrices } from '../modules/lmsr/engine.js';
import { eq } from 'drizzle-orm';
import { marketCategories } from '../db/schema.js';
import type { Market } from '../modules/market/types.js';

function buildMarketResponse(market: Market | null, ctx: AppContext) {
  if (!market) {
    return {
      market: null,
      prices: [0.5, 0.5],
      outcomes: [],
      priceBall: 0.5,
      priceStrike: 0.5,
    };
  }

  const prices = getPrices(market.quantities, market.b);

  // Look up category outcomes
  const category = ctx.db.select().from(marketCategories)
    .where(eq(marketCategories.id, market.categoryId))
    .get();
  const outcomes: string[] = category ? JSON.parse(category.outcomes) : [];

  return {
    market: {
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
    },
    prices,
    outcomes,
    // backward compat
    priceBall: prices[0] ?? 0.5,
    priceStrike: prices[1] ?? 0.5,
  };
}

export function registerMarketRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get('/api/markets', async () => {
    const allMarkets = ctx.marketManager.getAllMarkets();
    return {
      markets: allMarkets.map((m) => ({
        id: m.id,
        gameId: m.gameId,
        categoryId: m.categoryId,
        status: m.status,
        outcome: m.outcome,
        createdAt: m.createdAt,
      })),
    };
  });

  app.get('/api/market', async () => {
    const market = ctx.marketManager.getCurrentMarket();
    return buildMarketResponse(market, ctx);
  });

  app.get<{ Params: { marketId: string } }>('/api/market/:marketId', async (req, reply) => {
    const market = ctx.marketManager.getMarket(req.params.marketId);
    if (!market) {
      return reply.status(404).send({ error: 'Market not found' });
    }
    return buildMarketResponse(market, ctx);
  });
}
