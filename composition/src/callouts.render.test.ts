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
import { applyLottieValues } from './applyLottieValues';
import { calloutsFrom } from './callouts';
import { compositionConfig, type LottieAnimationData, type MainProps } from './config';
import type { TemplateParam } from './schema';

/**
 * M56: a callout on one word reaches the rendered pixels, drawn by the
 * composition itself, so the export runner draws what the Player showed.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const entry = path.resolve(here, 'entry.ts');
const repoRoot = path.resolve(here, '..', '..');
const fontFile = path.join(repoRoot, 'app', 'public', 'fonts', 'IBMPlexSans-Regular.ttf');

const TEXT: LottieAnimationData = {
  v: '5.12.2', fr: 30, ip: 0, op: 90, w: 1920, h: 1080, nm: 'text', ddd: 0, assets: [],
  fonts: { list: [{ fName: 'IBMPlexSans-Regular', fFamily: 'IBM Plex Sans', fStyle: 'Regular', ascent: 74.5 }] },
  layers: [
    {
      ddd: 0, ind: 1, ty: 5, nm: 'cc.headline', sr: 1,
      ks: { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, p: { a: 0, k: [200, 600, 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] } },
      ao: 0,
      t: { d: { k: [{ s: { s: 160, f: 'IBMPlexSans-Regular', t: 'VOTE NOW', j: 0, tr: 0, lh: 192, ls: 0, fc: [1, 1, 1] }, t: 0 }] }, p: {}, m: { g: 1, a: { a: 0, k: [0, 0] } }, a: [] },
      ip: 0, op: 90, st: 0, bm: 0,
    },
  ],
};
const schema: TemplateParam[] = [{ key: 'headline', role: 'headline', kind: 'text', label: 'Headline', default: 'VOTE NOW', path: '/layers/0' }];

let tmp: string;
let serveUrl: string;
let server: http.Server;
let fontUrl: string;

beforeAll(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-callout-'));
  server = http.createServer((req, res) => {
    if (req.url === '/font.ttf') {
      res.setHeader('content-type', 'font/ttf');
      res.setHeader('access-control-allow-origin', '*');
      fs.createReadStream(fontFile).pipe(res);
    } else {
      res.statusCode = 404;
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  fontUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}/font.ttf`;
  serveUrl = await bundle({ entryPoint: entry });
}, 300_000);

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  fs.rmSync(tmp, { recursive: true, force: true });
});

/** Red-ish pixels in the frame: the callout's colour, which the white text and black ground never make. */
async function redPixels(props: MainProps, frame: number): Promise<number> {
  const composition = await selectComposition({ serveUrl, id: compositionConfig.id, inputProps: props });
  const output = path.join(tmp, `f${frame}-${Math.random().toString(36).slice(2)}.png`);
  await renderStill({ composition, serveUrl, output, inputProps: props, frame, imageFormat: 'png', scale: 0.25 });
  const png = PNG.sync.read(fs.readFileSync(output));
  let n = 0;
  for (let i = 0; i < png.data.length; i += 4) if (png.data[i]! > 150 && png.data[i + 1]! < 90 && png.data[i + 2]! < 90) n++;
  return n;
}

const props = (values: Record<string, unknown>): MainProps => ({
  background: '#000000',
  fonts: [{ family: 'IBM Plex Sans', style: 'Regular', url: fontUrl }],
  elements: [{ id: 't', lottie: applyLottieValues(TEXT, values, schema), startFrame: 0, endFrame: 90, zIndex: 0, enabled: true, callouts: calloutsFrom(schema, values, '#FF0000') }],
});

describe('callouts in the rendered output (M56)', () => {
  it('a circle, an underline and a highlight on a word are drawn in the accent once the draw-on has run; none without a callout', async () => {
    expect(await redPixels(props({}), 40)).toBe(0);
    for (const style of ['circle', 'underline', 'highlight'] as const) {
      const n = await redPixels(props({ 'headline.callout': { word: 1, style } }), 40);
      expect(n, style).toBeGreaterThan(20);
    }
  }, 300_000);

  it('before its draw-on starts there is nothing yet', async () => {
    expect(await redPixels(props({ 'headline.callout': { word: 0, style: 'circle' } }), 5)).toBe(0);
  }, 300_000);
});
