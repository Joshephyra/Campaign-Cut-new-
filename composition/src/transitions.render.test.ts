// @vitest-environment node

import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { compositionConfig, type LottieAnimationData, type MainProps } from './config';
import type { TransitionPreset } from './transitions';

const here = path.dirname(fileURLToPath(import.meta.url));
const entry = path.resolve(here, 'entry.ts');

function solid(name: string, rgba: number[]): LottieAnimationData {
  return {
    v: '5.12.2', fr: 30, ip: 0, op: 300, w: 1920, h: 1080, nm: name, ddd: 0, assets: [],
    layers: [
      {
        ddd: 0, ind: 1, ty: 4, nm: name, sr: 1,
        ks: { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, p: { a: 0, k: [960, 540, 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] } },
        ao: 0,
        shapes: [{ ty: 'gr', it: [{ ty: 'rc', d: 1, s: { a: 0, k: [1920, 1080] }, p: { a: 0, k: [0, 0] }, r: { a: 0, k: 0 } }, { ty: 'fl', c: { a: 0, k: rgba }, o: { a: 0, k: 100 }, r: 1 }, { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, sk: { a: 0, k: 0 }, sa: { a: 0, k: 0 } }] }],
        ip: 0, op: 300, st: 0, bm: 0,
      },
    ],
  };
}
const RED = solid('red', [1, 0, 0, 1]);
const BLUE = solid('blue', [0, 0, 1, 1]);

let serveUrl: string;
let tmp: string;

beforeAll(async () => {
  serveUrl = await bundle({ entryPoint: entry });
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-transitions-'));
}, 300_000);

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

type Rgb = [number, number, number];

/** Render one frame at 10% scale and sample pixels at fractions of the frame. */
async function samples(props: MainProps, frame: number, points: [number, number][]): Promise<Rgb[]> {
  const composition = await selectComposition({ serveUrl, id: compositionConfig.id, inputProps: props });
  const output = path.join(tmp, `f${frame}-${Math.random().toString(36).slice(2)}.png`);
  await renderStill({ composition, serveUrl, output, inputProps: props, frame, imageFormat: 'png', scale: 0.1 });
  const png = PNG.sync.read(fs.readFileSync(output));
  return points.map(([fx, fy]) => {
    const idx = (Math.floor(png.height * fy) * png.width + Math.floor(png.width * fx)) * 4;
    return [png.data[idx]!, png.data[idx + 1]!, png.data[idx + 2]!];
  });
}

const props = (preset: TransitionPreset): MainProps => ({
  background: '#000000',
  elements: [
    { id: 'red', lottie: RED, startFrame: 0, endFrame: 60, zIndex: 0, enabled: true },
    { id: 'blue', lottie: BLUE, startFrame: 60, endFrame: 120, zIndex: 1, enabled: true },
  ],
  transitions: [{ afterElementId: 'red', preset, durationInFrames: 20 }],
});

// With a 20-frame transition, blue starts at 40 and the boundary runs 40..60.
// Frame 50 is the middle of it.
describe('transitions in the rendered output', () => {
  it('a cut shows red then blue with nothing in between', async () => {
    const before = (await samples(props('cut'), 50, [[0.5, 0.5]]))[0]!;
    const after = (await samples(props('cut'), 70, [[0.5, 0.5]]))[0]!;
    expect(before).toEqual([255, 0, 0]);
    expect(after).toEqual([0, 0, 255]);
  }, 300_000);

  it('a fade appears at the boundary as a blend of both', async () => {
    const mid = (await samples(props('fade'), 50, [[0.5, 0.5]]))[0]!;
    expect(mid[0]).toBeGreaterThan(40);
    expect(mid[2]).toBeGreaterThan(40);
    expect(mid[1]).toBeLessThan(20);
  }, 300_000);

  it('changing the transition to a wipe changes the output: one side blue, the other red', async () => {
    const [left, right] = (await samples(props('wipe'), 50, [[0.1, 0.5], [0.9, 0.5]])) as [Rgb, Rgb];
    expect(left).not.toEqual(right);
    const pure = (p: Rgb) => (p[0] > 200 && p[2] < 50) || (p[2] > 200 && p[0] < 50);
    expect(pure(left) && pure(right)).toBe(true);
  }, 300_000);

  it('the composition shrinks by the overlap', async () => {
    const composition = await selectComposition({ serveUrl, id: compositionConfig.id, inputProps: props('slide') });
    expect(composition.durationInFrames).toBe(100);
  }, 300_000);
});
