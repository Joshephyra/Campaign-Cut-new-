import { buildApp } from './app';

// Deliberately NOT the generic PORT variable: dev-server launchers set that for the app.
const port = Number(process.env.CAMPAIGNCUT_SERVER_PORT ?? 3001);
const host = process.env.HOST ?? '127.0.0.1';

// The render worker fetches footage, images and template files from this
// same server over HTTP, so it needs to know its own origin.
const app = buildApp({ serverBase: `http://127.0.0.1:${port}` });

app.listen({ port, host }).then(
  () => console.log(`[server] listening on http://${host}:${port}`),
  (err) => {
    console.error('[server] failed to start', err);
    process.exit(1);
  },
);
