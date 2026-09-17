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
import { compositionConfig, type LottieAnimationData, type MainProps } from './config';
import { fitSpecsFrom } from './fit';
import type { TemplateParam } from './schema';

/**
 * M60/M61 in real pixels: the composition measures the copy in the real
 * font once it has loaded, widens the tagged plate by the difference, and
 * shrinks box text to its box instead of wrapping it.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const entry = path.resolve(here, 'entry.ts');
const repoRoot = path.resolve(here, '..', '..');
const fontFile = path.join(repoRoot, 'app', 'public', 'fonts', 'IBMPlexSans-Regular.ttf');

const textLayer = (nm: string, text: string, y: number, sz?: [number, number]) => ({
  ddd: 0, ind: nm === 'cc.headline' ? 1 : 2, ty: 5, nm, sr: 1,
  ks: { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, p: { a: 0, k: [200, y, 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] } },
  ao: 0,
  t: { d: { k: [{ s: { s: 120, f: 'IBMPlexSans-Regular', t: text, j: 0, tr: 0, lh: 144, ls: 0, fc: [1, 1, 1], ...(sz ? { sz, ps: [0, -110] } : {}) }, t: 0 }] }, p: {}, m: { g: 1, a: { a: 0, k: [0, 0] } }, a: [] },
  ip: 0, op: 90, st: 0, bm: 0,
});

/** A red plate behind the headline, parented to it: 600 wide, from x 0 to 600 in the text's space, 160 tall around the glyphs. */
const PLATE = {
  ddd: 0, ind: 3, ty: 4, nm: 'cc.headline.plate', sr: 1, parent: 1,
  ks: { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, p: { a: 0, k: [0, 0, 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] } },
  shapes: [{ ty: 'gr', it: [{ ty: 'rc', s: { a: 0, k: [600, 160] }, p: { a: 0, k: [300, -40] }, r: { a: 0, k: 0 } }, { ty: 'fl', c: { a: 0, k: [1, 0, 0, 1] }, o: { a: 0, k: 100 } }, { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } }] }],
  ip: 0, op: 90, st: 0, bm: 0,
};

const LOTTIE: LottieAnimationData = {
  v: '5.12.2', fr: 30, ip: 0, op: 90, w: 1920, h: 1080, nm: 'fit', ddd: 0, assets: [],
  fonts: { list: [{ fName: 'IBMPlexSans-Regular', fFamily: 'IBM Plex Sans', fStyle: 'Regular', ascent: 74.5 }] },
  // the plate is listed first so it draws under the text (Lottie draws the last layer first)
  layers: [textLayer('cc.headline', 'VOTE NOW', 300), textLayer('cc.subhead', 'VOTE NOW', 800, [700, 150]), PLATE],
};
const schema: TemplateParam[] = [
  { key: 'headline', role: 'headline', kind: 'text', label: 'Headline', default: 'VOTE NOW', path: '/layers/0' },
  { key: 'subhead', role: 'subhead', kind: 'text', label: 'Subhead', default: 'VOTE NOW', path: '/layers/1' },
  { key: 'headline.plate', role: 'headline', kind: 'follow', label: 'Headline plate', default: null, path: '/layers/2', for: 'headline', follows: 'plate' },
];

let tmp: string;
let serveUrl: string;
let server: http.Server;
let fontUrl: string;

beforeAll(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-fit-'));
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
  // CC_KEEP_FRAMES=1 keeps the rendered stills under .impeccable/review/ for a human to look at.
  if (process.env.CC_KEEP_FRAMES) {
    const keep = path.join(repoRoot, '.impeccable', 'review');
    fs.mkdirSync(keep, { recursive: true });
    for (const f of fs.readdirSync(tmp)) fs.copyFileSync(path.join(tmp, f), path.join(keep, `fit-${f}`));
  }
  fs.rmSync(tmp, { recursive: true, force: true });
});

type Extent = { red: number; redMaxX: number; whiteRows: number };

/** Red pixels (the plate) and how far right they reach; rows holding white pixels (the lines of text) below y 150 at quarter scale. */
async function sample(props: MainProps, name = 'frame'): Promise<Extent> {
  const composition = await selectComposition({ serveUrl, id: compositionConfig.id, inputProps: props });
  const output = path.join(tmp, `${name}-${Math.random().toString(36).slice(2, 6)}.png`);
  await renderStill({ composition, serveUrl, output, inputProps: props, frame: 10, imageFormat: 'png', scale: 0.25 });
  const png = PNG.sync.read(fs.readFileSync(output));
  let red = 0;
  let redMaxX = 0;
  const rows = new Set<number>();
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const i = (y * png.width + x) * 4;
      const [r, g, b] = [png.data[i]!, png.data[i + 1]!, png.data[i + 2]!];
      if (r > 150 && g < 90 && b < 90) {
        red++;
        redMaxX = Math.max(redMaxX, x);
      }
      if (r > 200 && g > 200 && b > 200 && y > 150) rows.add(y);
    }
  }
  return { red, redMaxX, whiteRows: rows.size };
}

const props = (values: Record<string, unknown>, withFit = true): MainProps => ({
  background: '#000000',
  fonts: [{ family: 'IBM Plex Sans', style: 'Regular', url: fontUrl }],
  elements: [{ id: 't', lottie: applyLottieValues(LOTTIE, values, schema), startFrame: 0, endFrame: 90, zIndex: 0, enabled: true, fit: withFit ? fitSpecsFrom(schema) : [] }],
});

describe('the design follows the copy in the rendered output (M60, M61)', () => {
  it('a longer headline widens its tagged plate, measured in the real font; the authored one leaves it alone', async () => {
    const authored = await sample(props({}), 'plate-authored');
    const longer = await sample(props({ headline: 'VOTE NOW FOR MARIA' }), 'plate-longer');
    const untagged = await sample(props({ headline: 'VOTE NOW FOR MARIA' }, false), 'plate-untagged');
    expect(authored.red).toBeGreaterThan(1000);
    expect(untagged.red).toBeLessThanOrEqual(authored.red); // without the fit the plate stays; the longer white text covers a little more of it
    expect(longer.red).toBeGreaterThan(authored.red * 1.6);
    expect(longer.redMaxX).toBeGreaterThan(authored.redMaxX + 60);
  }, 300_000);

  it('box text too long for its box shrinks onto one line instead of wrapping', async () => {
    const wrapped = await sample(props({ subhead: 'VOTE NOW FOR MARIA' }, false), 'box-wrapped');
    const fitted = await sample(props({ subhead: 'VOTE NOW FOR MARIA' }), 'box-fitted');
    expect(wrapped.whiteRows).toBeGreaterThan(fitted.whiteRows * 1.6); // two lines against one
  }, 300_000);
});
