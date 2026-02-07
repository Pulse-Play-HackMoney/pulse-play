import { eq, and, ne, desc, max } from 'drizzle-orm';
import type { Outcome } from '../lmsr/types.js';
import type { Market, MarketStatus, ResolutionResult } from './types.js';
import type { Position } from '../position/types.js';
import type { DrizzleDB } from '../../db/connection.js';
import { markets, marketCategories } from '../../db/schema.js';

const VALID_TRANSITIONS: Record<MarketStatus, MarketStatus[]> = {
  PENDING: ['OPEN'],
  OPEN: ['CLOSED'],
  CLOSED: ['RESOLVED'],
  RESOLVED: [],
};

/** Maps a DB row to the Market TypeScript interface. */
function toMarket(row: typeof markets.$inferSelect): Market {
  return {
    id: row.id,
    gameId: row.gameId,
    categoryId: row.categoryId,
    sequenceNum: row.sequenceNum,
    status: row.status as MarketStatus,
    quantities: JSON.parse(row.quantities) as number[],
    b: row.b,
    outcome: row.outcome,
    createdAt: row.createdAt,
    openedAt: row.openedAt,
    closedAt: row.closedAt,
    resolvedAt: row.resolvedAt,
  };
}

export class MarketManager {
  private db: DrizzleDB;
  private defaultB: number;

  constructor(db: DrizzleDB, defaultB: number = 100) {
    this.db = db;
    this.defaultB = defaultB;
  }

  createMarket(gameId: string, categoryId: string): Market {
    // Look up category to determine outcome count
    const category = this.db.select().from(marketCategories)
      .where(eq(marketCategories.id, categoryId))
      .get();

    let outcomeCount = 2; // default
    if (category) {
      const outcomes = JSON.parse(category.outcomes) as string[];
      outcomeCount = outcomes.length;
    }

    const maxSeqResult = this.db
      .select({ maxSeq: max(markets.sequenceNum) })
      .from(markets)
      .where(and(eq(markets.gameId, gameId), eq(markets.categoryId, categoryId)))
      .get();

    const sequenceNum = (maxSeqResult?.maxSeq ?? 0) + 1;
    const marketId = `${gameId}-${categoryId}-${sequenceNum}`;
    const now = Date.now();

    const initialQuantities = new Array(outcomeCount).fill(0);

    this.db.insert(markets).values({
      id: marketId,
      gameId,
      categoryId,
      sequenceNum,
      status: 'PENDING',
      quantities: JSON.stringify(initialQuantities),
      b: this.defaultB,
      outcome: null,
      createdAt: now,
      openedAt: null,
      closedAt: null,
      resolvedAt: null,
    }).run();

    return this.getMarketOrThrow(marketId);
  }

  openMarket(marketId: string): Market {
    const market = this.getMarketOrThrow(marketId);
    this.validateTransition(market.status, 'OPEN');

    this.db.update(markets)
      .set({ status: 'OPEN', openedAt: Date.now() })
      .where(eq(markets.id, marketId))
      .run();

    return this.getMarketOrThrow(marketId);
  }

  closeMarket(marketId: string): Market {
    const market = this.getMarketOrThrow(marketId);
    this.validateTransition(market.status, 'CLOSED');

    this.db.update(markets)
      .set({ status: 'CLOSED', closedAt: Date.now() })
      .where(eq(markets.id, marketId))
      .run();

    return this.getMarketOrThrow(marketId);
  }

  resolveMarket(
    marketId: string,
    outcome: Outcome,
    positions: Position[] = [],
  ): ResolutionResult {
    const market = this.getMarketOrThrow(marketId);
    this.validateTransition(market.status, 'RESOLVED');

    this.db.update(markets)
      .set({ status: 'RESOLVED', outcome, resolvedAt: Date.now() })
      .where(eq(markets.id, marketId))
      .run();

    const winners: ResolutionResult['winners'] = [];
    const losers: ResolutionResult['losers'] = [];

    for (const pos of positions) {
      if (pos.outcome === outcome) {
        winners.push({
          address: pos.address,
          payout: pos.shares,
          appSessionId: pos.appSessionId,
        });
      } else {
        losers.push({
          address: pos.address,
          loss: pos.costPaid,
          appSessionId: pos.appSessionId,
        });
      }
    }

    const totalPayout = winners.reduce((sum, w) => sum + w.payout, 0);
    return { winners, losers, totalPayout };
  }

  updateQuantities(marketId: string, quantities: number[]): void {
    this.getMarketOrThrow(marketId);
    this.db.update(markets)
      .set({ quantities: JSON.stringify(quantities) })
      .where(eq(markets.id, marketId))
      .run();
  }

  getMarket(marketId: string): Market | null {
    const row = this.db.select().from(markets).where(eq(markets.id, marketId)).get();
    return row ? toMarket(row) : null;
  }

  getCurrentMarket(gameId?: string, categoryId?: string): Market | null {
    if (!gameId || !categoryId) {
      const row = this.db.select().from(markets)
        .where(ne(markets.status, 'RESOLVED'))
        .orderBy(desc(markets.createdAt))
        .limit(1)
        .get();
      return row ? toMarket(row) : null;
    }

    const row = this.db.select().from(markets)
      .where(
        and(
          eq(markets.gameId, gameId),
          eq(markets.categoryId, categoryId),
          ne(markets.status, 'RESOLVED'),
        ),
      )
      .orderBy(desc(markets.sequenceNum))
      .limit(1)
      .get();

    return row ? toMarket(row) : null;
  }

  getAllMarkets(): Market[] {
    const rows = this.db.select().from(markets)
      .orderBy(desc(markets.createdAt))
      .all();
    return rows.map(toMarket);
  }

  getMarketsByGame(gameId: string): Market[] {
    const rows = this.db.select().from(markets)
      .where(eq(markets.gameId, gameId))
      .orderBy(desc(markets.createdAt))
      .all();
    return rows.map(toMarket);
  }

  getMarketHistory(gameId: string, categoryId: string, limit: number = 50): Market[] {
    const rows = this.db.select().from(markets)
      .where(and(eq(markets.gameId, gameId), eq(markets.categoryId, categoryId)))
      .orderBy(desc(markets.sequenceNum))
      .limit(limit)
      .all();
    return rows.map(toMarket);
  }

  private getMarketOrThrow(marketId: string): Market {
    const market = this.getMarket(marketId);
    if (!market) {
      throw new Error(`Market ${marketId} not found`);
    }
    return market;
  }

  private validateTransition(from: MarketStatus, to: MarketStatus): void {
    const allowed = VALID_TRANSITIONS[from];
    if (!allowed.includes(to)) {
      throw new Error(`Invalid transition: ${from} → ${to}`);
    }
  }
}
