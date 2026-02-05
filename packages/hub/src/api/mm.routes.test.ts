import { buildApp } from '../app.js';
import { createTestContext } from '../context.js';
import type { AppContext } from '../context.js';
import type { FastifyInstance } from 'fastify';

describe('MM Routes', () => {
  let app: FastifyInstance;
  let ctx: AppContext;

  beforeEach(async () => {
    ctx = createTestContext();
    app = await buildApp(ctx);
  });

  afterEach(async () => {
    await app.close();
  });

  test('GET /api/mm/info returns address, balance, isConnected', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/mm/info',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.address).toBe('0xMM');
    expect(body.balance).toBe('1000');
    expect(body.isConnected).toBe(true);
  });

  test('GET /api/mm/info returns balance "0" when disconnected', async () => {
    (ctx.clearnodeClient.isConnected as jest.Mock).mockReturnValue(false);

    const res = await app.inject({
      method: 'GET',
      url: '/api/mm/info',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.address).toBe('0xMM');
    expect(body.balance).toBe('0');
    expect(body.isConnected).toBe(false);
    expect(ctx.clearnodeClient.getBalance).not.toHaveBeenCalled();
  });

  test('GET /api/mm/info handles getBalance error gracefully', async () => {
    (ctx.clearnodeClient.getBalance as jest.Mock).mockRejectedValueOnce(
      new Error('Balance unavailable'),
    );

    const res = await app.inject({
      method: 'GET',
      url: '/api/mm/info',
    });

    expect(res.statusCode).toBe(500);
    expect(res.json().error).toBe('Balance unavailable');
  });
});
