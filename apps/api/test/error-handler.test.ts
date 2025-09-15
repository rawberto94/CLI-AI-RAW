import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { AppError } from '../src/errors';
import { registerErrorHandling } from '../src/plugins/error-handler';

describe('error handler plugin', () => {
  it('formats AppError correctly', async () => {
    const app = Fastify();
    await registerErrorHandling(app as any);
    app.get('/boom', async () => { throw new AppError(400, 'Bad', true, { foo: 'bar' }); });
    const res = await app.inject({ method: 'GET', url: '/boom' });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toBe('Bad');
  });

  it('returns 500 for generic errors', async () => {
    const app = Fastify();
    await registerErrorHandling(app as any);
    app.get('/err', async () => { throw new Error('nope'); });
    const res = await app.inject({ method: 'GET', url: '/err' });
    expect(res.statusCode).toBe(500);
  });
});
