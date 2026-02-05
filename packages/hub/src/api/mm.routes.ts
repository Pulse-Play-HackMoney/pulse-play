import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../context.js';

export function registerMMRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get('/api/mm/info', async (_req, reply) => {
    try {
      const address = ctx.clearnodeClient.getAddress();
      const isConnected = ctx.clearnodeClient.isConnected();
      const balance = isConnected ? await ctx.clearnodeClient.getBalance() : '0';

      ctx.log.mmInfoFetched();
      return { address, balance, isConnected };
    } catch (err: any) {
      ctx.log.error('mm-info', err);
      return reply.status(500).send({ error: err.message ?? 'Failed to fetch MM info' });
    }
  });
}
