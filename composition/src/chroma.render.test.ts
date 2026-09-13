// @vitest-environment node

import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { compositionConfig, type MainProps } from './config';
import type { ChromaKey } from './chroma';

const here = path.dirname(fileURLToPath(import.meta.url));
const entry = path.resolve(here, 'entry.ts');
const fixture = path.resolve(here, '..', 'fixtures', 'greenscreen-2s.mp4');

let serveUrl: string;
let tmp: string;
let server: http.Server;
let videoUrl: string;

beforeAll(async () => {
  serveUrl = await bundle({ entryPoint: entry });
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-chroma-'));
  // Serve the fixture over HTTP with CORS, like the app server's media route.
  server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.url?.startsWith('/green.mp4')) {
      const stat = fs.statSync(fixture);
      const range = req.headers.range;
      if (range) {
        const [s, e] = range.replace('bytes=', '').split('-');
        const start = Number(s);
        const end = e ? Number(e) : stat.size - 1;
        res.writeHead(206, { 'Content-Type': 'video/mp4', 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
        fs.createReadStream(fixture, { start, end }).pipe(res);
      } else {
        res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': stat.size, 'Accept-Ranges': 'bytes' });
        fs.createReadStream(fixture).pipe(res);
      }
    } else {
      res.statusCode = 404;
      res.end();
    }
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  videoUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}/green.mp4`;
}, 300_000);

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  fs.rmSync(tmp, { recursive: true, force: true });
});

type Rgb = [number, number, number];

async function sample(props: MainProps, points: [number, number][]): Promise<Rgb[]> {
  const composition = await selectComposition({ serveUrl, id: compositionConfig.id, inputProps: props });
  const output = path.join(tmp, `f-${Math.random().toString(36).slice(2)}.png`);
  await renderStill({ composition, serveUrl, output, inputProps: props, frame: 10, imageFormat: 'png', scale: 0.5 });
  const png = PNG.sync.read(fs.readFileSync(output));
  return points.map(([fx, fy]) => {
    const i = (Math.floor(png.height * fy) * png.width + Math.floor(png.width * fx)) * 4;
    return [png.data[i]!, png.data[i + 1]!, png.data[i + 2]!];
  });
}

// Full-frame footage over a dark blue background, so keyed-out pixels show blue.
const props = (key: ChromaKey | null): MainProps => ({
  background: '#0000AA',
  elements: [
    {
      id: 'e',
      lottie: { fr: 30, ip: 0, op: 60, w: 1920, h: 1080, layers: [] },
      startFrame: 0,
      endFrame: 60,
      zIndex: 0,
      enabled: true,
      media: { src: videoUrl, rect: { x: 0, y: 0, w: 1, h: 1 }, fit: 'cover', key },
    },
  ],
});

const GREEN_AREA: [number, number] = [0.08, 0.5]; // left edge: green screen
const RED_SQUARE: [number, number] = [0.5, 0.5]; // centre: the red square

describe('chroma key in the rendered output', () => {
  it('without a key, the green screen is green', async () => {
    const [green, red] = (await sample(props(null), [GREEN_AREA, RED_SQUARE])) as [Rgb, Rgb];
    expect(green[1]).toBeGreaterThan(120);
    expect(green[2]).toBeLessThan(90);
    expect(red[0]).toBeGreaterThan(150);
  }, 300_000);

  it('with the key, the green screen becomes transparent (background shows through) and the red square stays', async () => {
    const [keyed, red] = (await sample(props({ color: 'green', threshold: 0.5, spill: 0.3 }), [GREEN_AREA, RED_SQUARE])) as [Rgb, Rgb];
    // background #0000AA shows through the keyed green
    expect(keyed[2]).toBeGreaterThan(100);
    expect(keyed[1]).toBeLessThan(60);
    // the red square survives the key
    expect(red[0]).toBeGreaterThan(150);
    expect(red[1]).toBeLessThan(80);
  }, 300_000);
});
