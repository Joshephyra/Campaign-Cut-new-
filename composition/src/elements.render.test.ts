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

const here = path.dirname(fileURLToPath(import.meta.url));
const entry = path.resolve(here, 'entry.ts');

/** A Lottie that is a solid red rectangle over the whole frame. */
const RED_FULL_FRAME: LottieAnimationData = {
  v: '5.12.2', fr: 30, ip: 0, op: 300, w: 1920, h: 1080, nm: 'red', ddd: 0, assets: [],
  layers: [
    {
      ddd: 0, ind: 1, ty: 4, nm: 'red', sr: 1,
      ks: { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, p: { a: 0, k: [960, 540, 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] } },
      ao: 0,
      shapes: [{ ty: 'gr', it: [{ ty: 'rc', d: 1, s: { a: 0, k: [1920, 1080] }, p: { a: 0, k: [0, 0] }, r: { a: 0, k: 0 } }, { ty: 'fl', c: { a: 0, k: [1, 0, 0, 1] }, o: { a: 0, k: 100 }, r: 1 }, { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, sk: { a: 0, k: 0 }, sa: { a: 0, k: 0 } }] }],
      ip: 0, op: 300, st: 0, bm: 0,
    },
  ],
};

let serveUrl: string;
let tmp: string;

beforeAll(async () => {
  serveUrl = await bundle({ entryPoint: entry });
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-elements-'));
}, 300_000);

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

async function centrePixel(props: MainProps, frame: number): Promise<[number, number, number]> {
  const composition = await selectComposition({ serveUrl, id: compositionConfig.id, inputProps: props });
  const output = path.join(tmp, `f${frame}-${Math.random().toString(36).slice(2)}.png`);
  await renderStill({ composition, serveUrl, output, inputProps: props, frame, imageFormat: 'png', scale: 0.1 });
  const png = PNG.sync.read(fs.readFileSync(output));
  const idx = (Math.floor(png.height / 2) * png.width + Math.floor(png.width / 2)) * 4;
  return [png.data[idx]!, png.data[idx + 1]!, png.data[idx + 2]!];
}

const props = (startFrame: number, enabled: boolean): MainProps => ({
  background: '#000000',
  elements: [{ id: 'red', lottie: RED_FULL_FRAME, startFrame, endFrame: startFrame + 60, zIndex: 0, enabled }],
});

// These are the two M9 tests from MILESTONES.md, at the level of real
// rendered pixels: nothing mocked between the props and the PNG.
describe('elements in the rendered output', () => {
  it("moving an element's in point changes when it appears", async () => {
    const early = props(0, true);
    const late = props(20, true);
    expect(await centrePixel(early, 5)).toEqual([255, 0, 0]);
    expect(await centrePixel(late, 5)).toEqual([0, 0, 0]);
    expect(await centrePixel(late, 25)).toEqual([255, 0, 0]);
  }, 300_000);

  it('toggling an element off removes it from the composition', async () => {
    // Two elements: one stays on (it is off-centre so the centre pixel is not
    // affected by it), one full-frame red is toggled off. Frame 5 is inside both.
    const p: MainProps = {
      background: '#000000',
      elements: [
        { id: 'keeper', lottie: { ...RED_FULL_FRAME, layers: [] }, startFrame: 0, endFrame: 60, zIndex: 0, enabled: true },
        { id: 'red', lottie: RED_FULL_FRAME, startFrame: 0, endFrame: 60, zIndex: 1, enabled: false },
      ],
    };
    expect(await centrePixel(p, 5)).toEqual([0, 0, 0]);
    expect(await centrePixel({ ...p, elements: p.elements.map((e) => ({ ...e, enabled: true })) }, 5)).toEqual([255, 0, 0]);
  }, 300_000);

  it('the composition is as long as the latest enabled out point', async () => {
    const composition = await selectComposition({ serveUrl, id: compositionConfig.id, inputProps: props(20, true) });
    expect(composition.durationInFrames).toBe(80);
  }, 300_000);
});
