import { eq, desc, sql, count } from 'drizzle-orm';
import type { DrizzleDB } from '../../db/connection.js';
import { lpShares, lpEvents } from '../../db/schema.js';
import type { LPShare, LPEvent, PoolStats, DepositResult, WithdrawalResult } from './types.js';

function toShare(row: typeof lpShares.$inferSelect): LPShare {
  return {
    address: row.address,
    shares: row.shares,
    totalDeposited: row.totalDeposited,
    totalWithdrawn: row.totalWithdrawn,
    firstDepositAt: row.firstDepositAt,
    lastActionAt: row.lastActionAt,
  };
}

function toEvent(row: typeof lpEvents.$inferSelect): LPEvent {
  return {
    id: row.id,
    address: row.address,
    type: row.type as LPEvent['type'],
    amount: row.amount,
    shares: row.shares,
    sharePrice: row.sharePrice,
    poolValueBefore: row.poolValueBefore,
    poolValueAfter: row.poolValueAfter,
    timestamp: row.timestamp,
  };
}

export class LPManager {
  private db: DrizzleDB;

  constructor(db: DrizzleDB) {
    this.db = db;
  }

  getShare(address: string): LPShare | null {
    const row = this.db.select().from(lpShares)
      .where(eq(lpShares.address, address))
      .get();
    return row ? toShare(row) : null;
  }

  getAllShares(): LPShare[] {
    return this.db.select().from(lpShares).all().map(toShare);
  }

  getTotalShares(): number {
    const result = this.db
      .select({ total: sql<number>`COALESCE(SUM(${lpShares.shares}), 0)` })
      .from(lpShares)
      .get();
    return result?.total ?? 0;
  }

  getSharePrice(poolValue: number): number {
    const totalShares = this.getTotalShares();
    if (totalShares === 0) return 1.0;
    return poolValue / totalShares;
  }

  getPoolStats(
    poolValue: number,
    hasOpenMarkets: boolean,
    hasUnsettledPositions: boolean,
  ): PoolStats {
    const totalShares = this.getTotalShares();
    const sharePrice = totalShares === 0 ? 1.0 : poolValue / totalShares;
    const { allowed, reason } = this.canWithdraw(hasOpenMarkets, hasUnsettledPositions);

    const lpCountResult = this.db
      .select({ value: count() })
      .from(lpShares)
      .get();

    return {
      poolValue,
      totalShares,
      sharePrice,
      lpCount: lpCountResult?.value ?? 0,
      canWithdraw: allowed,
      ...(reason ? { withdrawLockReason: reason } : {}),
    };
  }

  canWithdraw(
    hasOpenMarkets: boolean,
    hasUnsettledPositions: boolean,
  ): { allowed: boolean; reason?: string } {
    if (hasOpenMarkets) {
      return { allowed: false, reason: 'Withdrawals locked while markets are OPEN' };
    }
    if (hasUnsettledPositions) {
      return { allowed: false, reason: 'Withdrawals locked while positions are unsettled' };
    }
    return { allowed: true };
  }

  recordDeposit(address: string, amount: number, poolValue: number): DepositResult {
    if (amount <= 0) {
      throw new Error('Deposit amount must be positive');
    }

    const totalShares = this.getTotalShares();
    const sharePrice = totalShares === 0 ? 1.0 : poolValue / totalShares;
    const newShares = amount / sharePrice;
    const now = Date.now();

    const existing = this.getShare(address);
    if (existing) {
      this.db.update(lpShares)
        .set({
          shares: existing.shares + newShares,
          totalDeposited: existing.totalDeposited + amount,
          lastActionAt: now,
        })
        .where(eq(lpShares.address, address))
        .run();
    } else {
      this.db.insert(lpShares).values({
        address,
        shares: newShares,
        totalDeposited: amount,
        totalWithdrawn: 0,
        firstDepositAt: now,
        lastActionAt: now,
      }).run();
    }

    this.db.insert(lpEvents).values({
      address,
      type: 'DEPOSIT',
      amount,
      shares: newShares,
      sharePrice,
      poolValueBefore: poolValue,
      poolValueAfter: poolValue + amount,
      timestamp: now,
    }).run();

    return {
      shares: newShares,
      sharePrice,
      poolValueBefore: poolValue,
      poolValueAfter: poolValue + amount,
    };
  }

  recordWithdrawal(address: string, sharesToBurn: number, poolValue: number): WithdrawalResult {
    if (sharesToBurn <= 0) {
      throw new Error('Shares to burn must be positive');
    }

    const existing = this.getShare(address);
    if (!existing) {
      throw new Error(`No LP position found for ${address}`);
    }
    if (existing.shares < sharesToBurn) {
      throw new Error(
        `Insufficient shares: have ${existing.shares}, requested ${sharesToBurn}`
      );
    }

    const totalShares = this.getTotalShares();
    const sharePrice = totalShares === 0 ? 1.0 : poolValue / totalShares;
    const amount = sharesToBurn * sharePrice;
    const now = Date.now();

    const remainingShares = existing.shares - sharesToBurn;
    if (remainingShares < 1e-10) {
      // Effectively zero — remove the record
      this.db.delete(lpShares)
        .where(eq(lpShares.address, address))
        .run();
    } else {
      this.db.update(lpShares)
        .set({
          shares: remainingShares,
          totalWithdrawn: existing.totalWithdrawn + amount,
          lastActionAt: now,
        })
        .where(eq(lpShares.address, address))
        .run();
    }

    this.db.insert(lpEvents).values({
      address,
      type: 'WITHDRAWAL',
      amount,
      shares: sharesToBurn,
      sharePrice,
      poolValueBefore: poolValue,
      poolValueAfter: poolValue - amount,
      timestamp: now,
    }).run();

    return {
      amount,
      sharePrice,
      poolValueBefore: poolValue,
      poolValueAfter: poolValue - amount,
    };
  }

  getEvents(address?: string, limit: number = 50): LPEvent[] {
    if (address) {
      return this.db.select().from(lpEvents)
        .where(eq(lpEvents.address, address))
        .orderBy(desc(lpEvents.id))
        .limit(limit)
        .all()
        .map(toEvent);
    }
    return this.db.select().from(lpEvents)
      .orderBy(desc(lpEvents.id))
      .limit(limit)
      .all()
      .map(toEvent);
  }
}
