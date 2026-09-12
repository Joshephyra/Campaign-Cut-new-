import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app';
import { openDb, type Db } from './db/index';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.resolve(here, '..', 'fixtures', 'clip-1280x720-25fps-2s.mp4');

/** Build a multipart body by hand so the test does not depend on a form library. */
function multipart(fieldName: string, filename: string, bytes: Buffer, contentType: string) {
  const boundary = `----cc${Date.now()}`;
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return { payload: Buffer.concat([head, bytes, tail]), headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } };
}

describe('media API', () => {
  let tmp: string;
  let mediaDir: string;
  let db: Db;
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-media-'));
    mediaDir = path.join(tmp, 'media');
    db = openDb(':memory:');
    app = buildApp({ db, templatesDir: path.join(tmp, 'templates'), mediaDir });
  });

  afterEach(async () => {
    await app.close();
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  // REGRESSION GUARD for the missing-export bug (CLAUDE.md): the render
  // process fetches media over HTTP and a missing CORS header made ingested
  // designs vanish from exports while the preview looked fine.
  it('the media route sends Access-Control-Allow-Origin', async () => {
    fs.mkdirSync(path.join(mediaDir, 'proxies'), { recursive: true });
    fs.writeFileSync(path.join(mediaDir, 'proxies', 'x.mp4'), 'bytes');
    const res = await app.inject({ method: 'GET', url: '/media/proxies/x.mp4', headers: { origin: 'http://localhost:5173' } });
    expect(res.statusCode).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeTruthy();
  });

  it('template files also send CORS headers (fonts and images are fetched by the renderer)', async () => {
    fs.mkdirSync(path.join(tmp, 'templates', 't'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'templates', 't', 'template.json'), '{}');
    const res = await app.inject({ method: 'GET', url: '/templates/t/template.json', headers: { origin: 'http://localhost:5173' } });
    expect(res.headers['access-control-allow-origin']).toBeTruthy();
  });

  it('POST /media stores the original, a proxy and a thumbnail, and a DB row', async () => {
    const { payload, headers } = multipart('file', 'My Clip.mp4', fs.readFileSync(fixture), 'video/mp4');
    const res = await app.inject({ method: 'POST', url: '/media', payload, headers });
    expect(res.statusCode).toBe(201);
    const asset = res.json() as {
      id: number;
      originalName: string;
      originalUrl: string;
      proxyUrl: string;
      thumbUrl: string;
      width: number;
      height: number;
      durationS: number;
      fps: number;
    };
    expect(asset).toMatchObject({ originalName: 'My Clip.mp4', width: 1280, height: 720, fps: 25 });
    expect(asset.durationS).toBeCloseTo(2, 1);
    expect(asset.originalUrl).toMatch(/^\/media\/originals\//);
    expect(asset.proxyUrl).toMatch(/^\/media\/proxies\/.*\.mp4$/);
    expect(asset.thumbUrl).toMatch(/^\/media\/thumbs\/.*\.jpg$/);

    for (const url of [asset.originalUrl, asset.proxyUrl, asset.thumbUrl]) {
      const file = path.join(mediaDir, url.replace(/^\/media\//, ''));
      expect(fs.existsSync(file), url).toBe(true);
      expect(fs.statSync(file).size).toBeGreaterThan(0);
    }

    const rows = db.listMediaAssets();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.width).toBe(1280);

    const list = await app.inject({ method: 'GET', url: '/media' });
    expect(list.json()).toHaveLength(1);
    const one = await app.inject({ method: 'GET', url: `/media/${asset.id}` });
    expect(one.statusCode).toBe(200);
  }, 60_000);

  it('rejects an upload that is not a video, and leaves nothing behind', async () => {
    const { payload, headers } = multipart('file', 'notes.txt', Buffer.from('hello'), 'text/plain');
    const res = await app.inject({ method: 'POST', url: '/media', payload, headers });
    expect(res.statusCode).toBe(400);
    expect(db.listMediaAssets()).toHaveLength(0);
    expect(fs.existsSync(path.join(mediaDir, 'originals')) ? fs.readdirSync(path.join(mediaDir, 'originals')) : []).toHaveLength(0);
  });

  it('GET /media/:id is 404 for a missing asset', async () => {
    const res = await app.inject({ method: 'GET', url: '/media/999' });
    expect(res.statusCode).toBe(404);
  });
});
