import { buildApp } from '../app.js';
import { createTestContext } from '../context.js';
import type { AppContext } from '../context.js';
import type { FastifyInstance } from 'fastify';

describe('Faucet Routes', () => {
  let app: FastifyInstance;
  let ctx: AppContext;

  beforeEach(async () => {
    ctx = createTestContext();
    app = await buildApp(ctx);
  });

  afterEach(async () => {
    await app.close();
  });

  // ── User faucet ──

  test('POST /api/faucet/user returns success (stub)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/faucet/user',
      payload: { address: '0xAlice', amount: 100 },
    });
    expect(res.json().success).toBe(true);
  });

  test('returns 400 when address is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/faucet/user',
      payload: { amount: 100 },
    });
    expect(res.statusCode).toBe(400);
  });

  test('returns 400 when amount is missing or <= 0', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/faucet/user',
      payload: { address: '0xAlice', amount: 0 },
    });
    expect(res.statusCode).toBe(400);

    const res2 = await app.inject({
      method: 'POST',
      url: '/api/faucet/user',
      payload: { address: '0xAlice' },
    });
    expect(res2.statusCode).toBe(400);
  });

  // ── MM faucet ──

  test('POST /api/faucet/mm calls clearnodeClient.requestFaucet()', async () => {
    await app.inject({ method: 'POST', url: '/api/faucet/mm' });
    expect(ctx.clearnodeClient.requestFaucet).toHaveBeenCalled();
  });

  test('POST /api/faucet/mm returns success', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/faucet/mm' });
    expect(res.json().success).toBe(true);
    expect(res.json().funded).toBe(1);
  });

  test('returns 500 when faucet fails', async () => {
    (ctx.clearnodeClient.requestFaucet as jest.Mock).mockRejectedValueOnce(
      new Error('Faucet down'),
    );
    const res = await app.inject({ method: 'POST', url: '/api/faucet/mm' });
    expect(res.statusCode).toBe(500);
    expect(res.json().error).toBe('Faucet down');
  });

  test('POST /api/faucet/mm with no body defaults to count=1', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/faucet/mm' });
    expect(ctx.clearnodeClient.requestFaucet).toHaveBeenCalledTimes(1);
    expect(res.json().funded).toBe(1);
  });

  test('POST /api/faucet/mm with count=3 calls requestFaucet 3 times', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/faucet/mm',
      payload: { count: 3 },
    });
    expect(ctx.clearnodeClient.requestFaucet).toHaveBeenCalledTimes(3);
    expect(res.json()).toEqual({ success: true, funded: 3 });
  });

  test('POST /api/faucet/mm with count > 50 returns 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/faucet/mm',
      payload: { count: 51 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('must not exceed 50');
  });

  test('POST /api/faucet/mm partial failure returns funded count', async () => {
    let callCount = 0;
    (ctx.clearnodeClient.requestFaucet as jest.Mock).mockImplementation(async () => {
      callCount++;
      if (callCount === 3) throw new Error('Faucet limit reached');
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/faucet/mm',
      payload: { count: 5 },
    });

    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.funded).toBe(2);
    expect(body.requested).toBe(5);
    expect(body.error).toBe('Faucet limit reached');
  });
});
