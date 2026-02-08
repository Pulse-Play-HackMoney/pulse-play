import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../context.js';
import { toMicroUnits, ASSET } from '../utils/units.js';
import { hasOpenMarkets, hasUnsettledPositions, broadcastPoolUpdate } from './pool-update.js';

export function registerLPRoutes(app: FastifyInstance, ctx: AppContext): void {

  // ── Pool stats ──────────────────────────────────────────────────────────

  app.get('/api/lp/stats', async (_req, reply) => {
    try {
      const balance = await ctx.clearnodeClient.getBalance();
      const poolValue = parseFloat(balance) / 1_000_000;
      const stats = ctx.lpManager.getPoolStats(
        poolValue,
        hasOpenMarkets(ctx),
        hasUnsettledPositions(ctx),
      );
      return stats;
    } catch (err) {
      ctx.log.error('lp-stats', err);
      return reply.status(500).send({ error: 'Failed to fetch pool stats' });
    }
  });

  // ── Individual LP share ─────────────────────────────────────────────────

  app.get<{ Params: { address: string } }>('/api/lp/share/:address', async (req, reply) => {
    const { address } = req.params;
    const share = ctx.lpManager.getShare(address);
    if (!share) {
      return reply.status(404).send({ error: 'No LP position found' });
    }

    // Compute current value based on pool balance
    try {
      const balance = await ctx.clearnodeClient.getBalance();
      const poolValue = parseFloat(balance) / 1_000_000;
      const sharePrice = ctx.lpManager.getSharePrice(poolValue);
      const currentValue = share.shares * sharePrice;
      const pnl = currentValue - share.totalDeposited + share.totalWithdrawn;

      return { ...share, currentValue, pnl, sharePrice };
    } catch {
      // Return share without derived fields if balance unavailable
      return { ...share, currentValue: null, pnl: null, sharePrice: null };
    }
  });

  // ── LP events ───────────────────────────────────────────────────────────

  app.get<{ Querystring: { address?: string; limit?: string } }>('/api/lp/events', async (req) => {
    const { address, limit } = req.query;
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const events = ctx.lpManager.getEvents(address, limitNum);
    return { events };
  });

  // ── Deposit ─────────────────────────────────────────────────────────────

  app.post<{ Body: { address: string; amount: number } }>('/api/lp/deposit', async (req, reply) => {
    const { address, amount } = req.body ?? {} as any;

    if (!address || typeof address !== 'string') {
      return reply.status(400).send({ error: 'address is required' });
    }
    if (typeof amount !== 'number' || amount <= 0) {
      return reply.status(400).send({ error: 'amount must be a positive number' });
    }

    try {
      const balance = await ctx.clearnodeClient.getBalance();
      const poolValue = parseFloat(balance) / 1_000_000;

      const result = ctx.lpManager.recordDeposit(address, amount, poolValue);

      ctx.log.lpDeposit(address, amount, result.shares, result.sharePrice);

      // Broadcast LP_DEPOSIT
      ctx.ws.broadcast({
        type: 'LP_DEPOSIT',
        address,
        amount,
        shares: result.shares,
        sharePrice: result.sharePrice,
      });

      // Broadcast POOL_UPDATE with accurate pool value (deposit is accounting-only, not yet on Clearnode)
      await broadcastPoolUpdate(ctx, result.poolValueAfter);

      return {
        success: true,
        shares: result.shares,
        sharePrice: result.sharePrice,
        poolValueAfter: result.poolValueAfter,
      };
    } catch (err) {
      ctx.log.error('lp-deposit', err);
      const msg = err instanceof Error ? err.message : 'Deposit failed';
      return reply.status(500).send({ error: msg });
    }
  });

  // ── Withdraw ────────────────────────────────────────────────────────────

  app.post<{ Body: { address: string; shares: number } }>('/api/lp/withdraw', async (req, reply) => {
    const { address, shares } = req.body ?? {} as any;

    if (!address || typeof address !== 'string') {
      return reply.status(400).send({ error: 'address is required' });
    }
    if (typeof shares !== 'number' || shares <= 0) {
      return reply.status(400).send({ error: 'shares must be a positive number' });
    }

    // Check withdrawal lock
    const openMarkets = hasOpenMarkets(ctx);
    const unsettled = hasUnsettledPositions(ctx);
    const { allowed, reason } = ctx.lpManager.canWithdraw(openMarkets, unsettled);
    if (!allowed) {
      return reply.status(403).send({ error: reason });
    }

    try {
      const balance = await ctx.clearnodeClient.getBalance();
      const poolValue = parseFloat(balance) / 1_000_000;

      const result = ctx.lpManager.recordWithdrawal(address, shares, poolValue);

      // Transfer funds from MM to user
      await ctx.clearnodeClient.transfer({
        destination: address as `0x${string}`,
        asset: ASSET,
        amount: toMicroUnits(result.amount),
      });

      ctx.log.lpWithdrawal(address, result.amount, shares, result.sharePrice);

      // Broadcast LP_WITHDRAWAL
      ctx.ws.broadcast({
        type: 'LP_WITHDRAWAL',
        address,
        amount: result.amount,
        shares,
        sharePrice: result.sharePrice,
      });

      // Broadcast POOL_UPDATE with accurate pool value post-withdrawal
      await broadcastPoolUpdate(ctx, result.poolValueAfter);

      return {
        success: true,
        amount: result.amount,
        sharePrice: result.sharePrice,
        poolValueAfter: result.poolValueAfter,
      };
    } catch (err) {
      ctx.log.error('lp-withdraw', err);
      const msg = err instanceof Error ? err.message : 'Withdrawal failed';
      const status = msg.includes('Insufficient') || msg.includes('No LP position') ? 400 : 500;
      return reply.status(status).send({ error: msg });
    }
  });
}
