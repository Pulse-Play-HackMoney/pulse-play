import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../context.js';

export function registerPositionRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get<{ Params: { address: string } }>('/api/positions/:address', async (req) => {
    const positions = ctx.positionTracker.getPositionsByUser(req.params.address);
    return {
      positions: positions.map((p) => ({
        marketId: p.marketId,
        outcome: p.outcome,
        shares: p.shares,
        costPaid: p.costPaid,
        appSessionId: p.appSessionId,
        appSessionVersion: p.appSessionVersion,
        sessionStatus: p.sessionStatus,
        mode: p.mode ?? 'lmsr',
        timestamp: p.timestamp,
      })),
    };
  });
}
