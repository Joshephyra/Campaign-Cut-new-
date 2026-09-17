import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from './app';
import { openDb, type Db } from './db/index';
import { parsePexelsVideos, pickPexelsFile } from './stock';

/**
 * M34: stock footage from Pexels. Search answers normalised results;
 * import downloads the best file at or under 1080p and registers it
 * through the same pipeline as an upload (original, proxy, thumbnail,
 * row), so it drags onto the video like any clip. The key lives in the
 * environment, never in source.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.resolve(here, '..', 'fixtures', 'clip-1280x720-25fps-2s.mp4');

const pexelsVideo = {
  id: 3571264,
  width: 3840,
  height: 2160,
  duration: 12,
  image: 'https://images.pexels.com/videos/3571264/free-video-3571264.jpg',
  url: 'https://www.pexels.com/video/a-crowd-at-a-rally-3571264/',
  user: { id: 1, name: 'Ana Photographer', url: 'https://www.pexels.com/@ana' },
  video_files: [
    { id: 1, quality: 'uhd', file_type: 'video/mp4', width: 3840, height: 2160, link: 'https://player.pexels.com/uhd.mp4' },
    { id: 2, quality: 'hd', file_type: 'video/mp4', width: 1920, height: 1080, link: 'https://player.pexels.com/hd1080.mp4' },
    { id: 3, quality: 'hd', file_type: 'video/mp4', width: 1280, height: 720, link: 'https://player.pexels.com/hd720.mp4' },
    { id: 4, quality: 'sd', file_type: 'video/mp4', width: 640, height: 360, link: 'https://player.pexels.com/sd.mp4' },
  ],
};

describe('Pexels parsing', () => {
  it('normalises a search answer', () => {
    expect(parsePexelsVideos({ videos: [pexelsVideo], total_results: 1 })).toEqual([
      {
        provider: 'pexels',
        id: '3571264',
        title: 'A crowd at a rally',
        thumbUrl: 'https://images.pexels.com/videos/3571264/free-video-3571264.jpg',
        durationS: 12,
        width: 3840,
        height: 2160,
        credit: 'Ana Photographer on Pexels',
        pageUrl: 'https://www.pexels.com/video/a-crowd-at-a-rally-3571264/',
      },
    ]);
  });

  it('picks the largest mp4 at or under 1080p', () => {
    expect(pickPexelsFile(pexelsVideo.video_files)!.link).toBe('https://player.pexels.com/hd1080.mp4');
    expect(pickPexelsFile(pexelsVideo.video_files.filter((f) => f.height > 1080))!.link).toBe('https://player.pexels.com/uhd.mp4'); // nothing smaller: take what there is
    expect(pickPexelsFile([])).toBeUndefined();
  });
});

describe('stock routes (M34)', () => {
  let tmp: string;
  let db: Db;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-stock-'));
    db = openDb(':memory:');
  });
  afterEach(() => {
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('without a key, search says which variable to set and imports nothing', async () => {
    const app = buildApp({ db, templatesDir: path.join(tmp, 'templates'), mediaDir: path.join(tmp, 'media'), stock: { apiKey: '' } });
    const res = await app.inject({ method: 'GET', url: '/stock/search?q=rally' });
    expect(res.statusCode).toBe(503);
    expect((res.json() as { error: string }).error).toMatch(/PEXELS_API_KEY/);
    expect((await app.inject({ method: 'POST', url: '/stock/import', payload: { provider: 'pexels', id: '1' } })).statusCode).toBe(503);
    await app.close();
  });

  it('search calls Pexels with the key and answers normalised results; an empty query is 400', async () => {
    const fetchStock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe('https://api.pexels.com/videos/search?query=rally%20crowd&per_page=24&orientation=landscape');
      expect((init?.headers as Record<string, string>).Authorization).toBe('test-key');
      return new Response(JSON.stringify({ videos: [pexelsVideo] }), { status: 200 });
    });
    const app = buildApp({ db, templatesDir: path.join(tmp, 'templates'), mediaDir: path.join(tmp, 'media'), stock: { apiKey: 'test-key', fetch: fetchStock as unknown as typeof fetch } });
    const res = await app.inject({ method: 'GET', url: '/stock/search?q=rally%20crowd' });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { results: { id: string }[] }).results.map((r) => r.id)).toEqual(['3571264']);
    expect((await app.inject({ method: 'GET', url: '/stock/search?q=' })).statusCode).toBe(400);
    await app.close();
  });

  it('import downloads the best file and registers it like an upload, crediting the photographer', async () => {
    const fetchStock = vi.fn(async (url: string) => {
      if (url === 'https://api.pexels.com/videos/videos/3571264') return new Response(JSON.stringify(pexelsVideo), { status: 200 });
      if (url === 'https://player.pexels.com/hd1080.mp4') return new Response(fs.readFileSync(fixture), { status: 200, headers: { 'content-type': 'video/mp4' } });
      return new Response('nope', { status: 404 });
    });
    const mediaDir = path.join(tmp, 'media');
    const app = buildApp({ db, templatesDir: path.join(tmp, 'templates'), mediaDir, stock: { apiKey: 'test-key', fetch: fetchStock as unknown as typeof fetch } });
    const res = await app.inject({ method: 'POST', url: '/stock/import', payload: { provider: 'pexels', id: '3571264' } });
    expect(res.statusCode).toBe(201);
    const asset = res.json() as { id: number; kind: string; originalName: string; width: number; height: number; proxyUrl: string; thumbUrl: string };
    expect(asset).toMatchObject({ kind: 'video', originalName: 'A crowd at a rally (Ana Photographer on Pexels).mp4', width: 1280, height: 720 });
    expect(fs.existsSync(path.join(mediaDir, asset.proxyUrl.replace(/^\/media\//, '')))).toBe(true);
    expect(fs.existsSync(path.join(mediaDir, asset.thumbUrl.replace(/^\/media\//, '')))).toBe(true);
    expect(db.listMediaAssets()).toHaveLength(1);
    expect((await app.inject({ method: 'POST', url: '/stock/import', payload: { provider: 'pexels', id: '999' } })).statusCode).toBe(404);
    expect((await app.inject({ method: 'POST', url: '/stock/import', payload: { provider: 'other', id: '1' } })).statusCode).toBe(400);
    await app.close();
  }, 60000);
});
