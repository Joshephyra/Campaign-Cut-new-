import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app';

// T4: the health endpoint, exercised in-process without opening a port.
describe('GET /health', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 200 with {"status":"ok"}', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});
