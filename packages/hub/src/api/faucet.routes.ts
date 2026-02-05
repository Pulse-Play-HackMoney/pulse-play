import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../context.js';
import type { FaucetRequest, MMFaucetRequest } from './types.js';

export function registerFaucetRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.post<{ Body: FaucetRequest }>('/api/faucet/user', async (req, reply) => {
    const { address, amount } = req.body ?? {} as any;

    if (!address) {
      return reply.status(400).send({ error: 'address is required' });
    }
    if (typeof amount !== 'number' || amount <= 0) {
      return reply.status(400).send({ error: 'amount must be a positive number' });
    }

    // Stub: user funding happens frontend-side via Clearnode
    ctx.log.faucetUser(address, amount);
    return { success: true, address, amount };
  });

  app.post<{ Body: MMFaucetRequest }>('/api/faucet/mm', async (req, reply) => {
    const body = req.body ?? {} as any;
    const count = body.count ?? 1;

    if (typeof count !== 'number' || !Number.isInteger(count) || count < 1) {
      return reply.status(400).send({ error: 'count must be a positive integer' });
    }
    if (count > 50) {
      return reply.status(400).send({ error: 'count must not exceed 50' });
    }

    let funded = 0;
    try {
      for (let i = 0; i < count; i++) {
        await ctx.clearnodeClient.requestFaucet();
        funded++;
      }
      ctx.log.faucetMM(true, funded);
      return { success: true, funded };
    } catch (err: any) {
      const errorMsg = err.message ?? 'Faucet request failed';
      ctx.log.faucetMM(false, count, errorMsg);
      if (funded > 0) {
        return { success: true, funded, requested: count, error: errorMsg };
      }
      return reply.status(500).send({ error: errorMsg });
    }
  });
}
