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
import { compositionConfig, type LottieAnimationData, type MainProps } from './config';

const here = path.dirname(fileURLToPath(import.meta.url));
const entry = path.resolve(here, 'entry.ts');
const repoRoot = path.resolve(here, '..', '..');
const fontFile = path.join(repoRoot, 'app', 'public', 'fonts', 'IBMPlexSans-Regular.ttf');

/** A Lottie with one big line of text in IBM Plex Sans across the middle of the frame. */
const TEXT: LottieAnimationData = {
  v: '5.12.2', fr: 30, ip: 0, op: 30, w: 1920, h: 1080, nm: 'text', ddd: 0, assets: [],
  fonts: { list: [{ fName: 'IBMPlexSans-Regular', fFamily: 'IBM Plex Sans', fStyle: 'Regular', ascent: 74.5 }] },
  layers: [
    {
      ddd: 0, ind: 1, ty: 5, nm: 'cc.headline', sr: 1,
      ks: { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, p: { a: 0, k: [100, 600, 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] } },
      ao: 0,
      t: { d: { k: [{ s: { s: 160, f: 'IBMPlexSans-Regular', t: 'WWWWWWWWWW', j: 0, tr: 0, lh: 192, ls: 0, fc: [1, 1, 1] }, t: 0 }] }, p: {}, m: { g: 1, a: { a: 0, k: [0, 0] } }, a: [] },
      ip: 0, op: 30, st: 0, bm: 0,
    },
  ],
};

let serveUrl: string;
let tmp: string;
let server: http.Server;
let fontUrl: string;

beforeAll(async () => {
  serveUrl = await bundle({ entryPoint: entry });
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-fonts-'));
  // A tiny font server with CORS, standing in for the app server's /templates route.
  server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.url === '/font.ttf') {
      res.setHeader('Content-Type', 'font/ttf');
      fs.createReadStream(fontFile).pipe(res);
    } else {
      res.statusCode = 404;
      res.end();
    }
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const address = server.address() as { port: number };
  fontUrl = `http://127.0.0.1:${address.port}/font.ttf`;
}, 300_000);

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  fs.rmSync(tmp, { recursive: true, force: true });
});

/** Row of pixels through the middle of the text line, as a string, for exact comparison. */
async function textRow(props: MainProps, tag: string): Promise<{ row: string; inkPixels: number }> {
  const composition = await selectComposition({ serveUrl, id: compositionConfig.id, inputProps: props });
  const output = path.join(tmp, `${tag}-${Math.random().toString(36).slice(2)}.png`);
  await renderStill({ composition, serveUrl, output, inputProps: props, frame: 5, imageFormat: 'png', scale: 0.5 });
  const png = PNG.sync.read(fs.readFileSync(output));
  const y = Math.floor(png.height * (560 / 1080));
  let row = '';
  let ink = 0;
  for (let x = 0; x < png.width; x++) {
    const i = (y * png.width + x) * 4;
    const v = png.data[i]! > 128 ? 1 : 0;
    ink += v;
    row += v;
  }
  return { row, inkPixels: ink };
}

const props = (withFont: boolean): MainProps => ({
  background: '#000000',
  media: null,
  elements: [{ id: 't', lottie: TEXT, startFrame: 0, endFrame: 30, zIndex: 0, enabled: true }],
  fonts: withFont ? [{ family: 'IBM Plex Sans', url: fontUrl }] : [],
});

describe('template fonts in the rendered output', () => {
  it('renders identical text metrics across two fresh renders (font is loaded before the first frame)', async () => {
    const a = await textRow(props(true), 'a');
    const b = await textRow(props(true), 'b');
    expect(a.inkPixels).toBeGreaterThan(20);
    expect(a.row).toBe(b.row);
  }, 300_000);

  it('renders different metrics without the font (so the loader is doing real work)', async () => {
    const withFont = await textRow(props(true), 'with');
    const without = await textRow(props(false), 'without');
    expect(without.row).not.toBe(withFont.row);
  }, 300_000);
});
