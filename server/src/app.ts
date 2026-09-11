import Fastify from 'fastify';

/** Builds the Fastify app without listening, so tests can inject requests. */
export function buildApp() {
  const app = Fastify({ logger: false });

  app.get('/health', async () => ({ status: 'ok' }));

  return app;
}
