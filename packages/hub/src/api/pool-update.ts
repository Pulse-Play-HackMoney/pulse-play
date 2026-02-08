import type { AppContext } from '../context.js';
import { sql } from 'drizzle-orm';

export function hasOpenMarkets(ctx: AppContext): boolean {
  const allMarkets = ctx.marketManager.getAllMarkets();
  return allMarkets.some((m) => m.status === 'OPEN');
}

export function hasUnsettledPositions(ctx: AppContext): boolean {
  const result = ctx.db.all<{ c: number }>(
    sql`SELECT COUNT(*) as c FROM positions WHERE session_status = 'open'`
  );
  return (result[0]?.c ?? 0) > 0;
}

/**
 * Broadcast a POOL_UPDATE message with current pool stats.
 * Non-critical — errors are logged but not thrown.
 */
export async function broadcastPoolUpdate(ctx: AppContext, poolValueOverride?: number): Promise<void> {
  try {
    let poolValue: number;
    if (poolValueOverride !== undefined) {
      poolValue = poolValueOverride;
    } else {
      const balance = await ctx.clearnodeClient.getBalance();
      poolValue = parseFloat(balance) / 1_000_000;
    }
    const stats = ctx.lpManager.getPoolStats(
      poolValue,
      hasOpenMarkets(ctx),
      hasUnsettledPositions(ctx),
    );
    ctx.ws.broadcast({
      type: 'POOL_UPDATE',
      poolValue: stats.poolValue,
      totalShares: stats.totalShares,
      sharePrice: stats.sharePrice,
      lpCount: stats.lpCount,
      canWithdraw: stats.canWithdraw,
    });
    ctx.log.lpPoolUpdate(stats.poolValue, stats.totalShares, stats.sharePrice);
  } catch (err) {
    ctx.log.error('pool-update-broadcast', err);
  }
}
