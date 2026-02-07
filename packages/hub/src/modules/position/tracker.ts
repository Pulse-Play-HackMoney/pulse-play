import { eq, and } from 'drizzle-orm';
import type { Position, SessionStatus } from './types.js';
import type { DrizzleDB } from '../../db/connection.js';
import { positions, settlements, markets } from '../../db/schema.js';

/** Maps a DB row to the Position TypeScript interface. */
function toPosition(row: typeof positions.$inferSelect): Position {
  return {
    address: row.address,
    marketId: row.marketId,
    outcome: row.outcome,
    shares: row.shares,
    costPaid: row.costPaid,
    fee: row.fee,
    appSessionId: row.appSessionId,
    appSessionVersion: row.appSessionVersion,
    sessionStatus: row.sessionStatus as SessionStatus,
    sessionData: row.sessionData ?? undefined,
    timestamp: row.createdAt,
  };
}

export interface Settlement {
  id: number;
  marketId: string;
  address: string;
  outcome: string;
  result: 'WIN' | 'LOSS';
  shares: number;
  costPaid: number;
  payout: number;
  profit: number;
  appSessionId: string;
  settledAt: number;
}

function toSettlement(row: typeof settlements.$inferSelect): Settlement {
  return {
    id: row.id,
    marketId: row.marketId,
    address: row.address,
    outcome: row.outcome,
    result: row.result as 'WIN' | 'LOSS',
    shares: row.shares,
    costPaid: row.costPaid,
    payout: row.payout,
    profit: row.profit,
    appSessionId: row.appSessionId,
    settledAt: row.settledAt,
  };
}

export class PositionTracker {
  private db: DrizzleDB;

  constructor(db: DrizzleDB) {
    this.db = db;
  }

  addPosition(position: Position): void {
    this.db.insert(positions).values({
      address: position.address,
      marketId: position.marketId,
      outcome: position.outcome,
      shares: position.shares,
      costPaid: position.costPaid,
      fee: position.fee ?? 0,
      appSessionId: position.appSessionId,
      appSessionVersion: position.appSessionVersion,
      sessionStatus: position.sessionStatus,
      createdAt: position.timestamp,
    }).run();
  }

  updateSessionStatus(appSessionId: string, status: SessionStatus): void {
    this.db.update(positions)
      .set({ sessionStatus: status })
      .where(eq(positions.appSessionId, appSessionId))
      .run();
  }

  updateAppSessionVersion(appSessionId: string, version: number): void {
    this.db.update(positions)
      .set({ appSessionVersion: version })
      .where(eq(positions.appSessionId, appSessionId))
      .run();
  }

  updateSessionData(appSessionId: string, data: string): void {
    this.db.update(positions)
      .set({ sessionData: data })
      .where(eq(positions.appSessionId, appSessionId))
      .run();
  }

  getPositionsByMarket(marketId: string): Position[] {
    return this.db.select().from(positions)
      .where(eq(positions.marketId, marketId))
      .all()
      .map(toPosition);
  }

  getPositionsByUser(address: string): Position[] {
    return this.db.select().from(positions)
      .where(eq(positions.address, address))
      .all()
      .map(toPosition);
  }

  getPosition(address: string, marketId: string): Position | null {
    const row = this.db.select().from(positions)
      .where(and(eq(positions.address, address), eq(positions.marketId, marketId)))
      .limit(1)
      .get();
    return row ? toPosition(row) : null;
  }

  /**
   * Archives positions for a market to the settlements table, then deletes them.
   * Requires the market to be RESOLVED to determine win/loss results.
   */
  clearPositions(marketId: string): void {
    const marketPositions = this.getPositionsByMarket(marketId);
    if (marketPositions.length === 0) return;

    // Look up the market's resolved outcome
    const market = this.db.select().from(markets)
      .where(eq(markets.id, marketId))
      .get();

    const resolvedOutcome = market?.outcome;
    const now = Date.now();

    // Archive each position to settlements
    for (const pos of marketPositions) {
      const isWin = resolvedOutcome ? pos.outcome === resolvedOutcome : false;
      const payout = isWin ? pos.shares : 0;
      const profit = payout - pos.costPaid;

      this.db.insert(settlements).values({
        marketId: pos.marketId,
        address: pos.address,
        outcome: pos.outcome,
        result: isWin ? 'WIN' : 'LOSS',
        shares: pos.shares,
        costPaid: pos.costPaid,
        payout,
        profit,
        appSessionId: pos.appSessionId,
        settledAt: now,
      }).run();
    }

    // Delete positions from the active table
    this.db.delete(positions)
      .where(eq(positions.marketId, marketId))
      .run();
  }

  getSettlementsByUser(address: string): Settlement[] {
    return this.db.select().from(settlements)
      .where(eq(settlements.address, address))
      .all()
      .map(toSettlement);
  }

  getSettlementsByMarket(marketId: string): Settlement[] {
    return this.db.select().from(settlements)
      .where(eq(settlements.marketId, marketId))
      .all()
      .map(toSettlement);
  }
}
