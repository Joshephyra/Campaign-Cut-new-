// @vitest-environment node

import { bundle } from '@remotion/bundler';
import { getCompositions, selectComposition } from '@remotion/renderer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compositionConfig } from './config';
import { lottieDurationInFrames } from './lottieDuration';

const here = path.dirname(fileURLToPath(import.meta.url));
const entry = path.resolve(here, 'entry.ts');
const fixturePath = path.resolve(here, '..', '..', 'templates', 'standin', 'elements', 'standin', 'template.json');

// Slow: bundle the package exactly the way the server does. Downloads
// Remotion's headless Chrome on the first run.
describe('Remotion root', () => {
  it('registers exactly one composition matching compositionConfig', async () => {
    const serveUrl = await bundle({ entryPoint: entry });
    const comps = await getCompositions(serveUrl);

    expect(comps).toHaveLength(1);
    const main = comps[0]!;
    expect(main.id).toBe(compositionConfig.id);
    expect(main.width).toBe(compositionConfig.width);
    expect(main.height).toBe(compositionConfig.height);
    expect(main.fps).toBe(compositionConfig.fps);
  });

  it('accepts a valid Lottie as input and takes its duration from it', async () => {
    const lottie = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const serveUrl = await bundle({ entryPoint: entry });
    const comp = await selectComposition({
      serveUrl,
      id: compositionConfig.id,
      inputProps: { background: '#0F4C5C', elements: [{ id: 'standin', lottie, startFrame: 0, endFrame: lottieDurationInFrames(lottie, compositionConfig.fps), zIndex: 0, enabled: true }] },
    });

    expect(comp.durationInFrames).toBe(lottieDurationInFrames(lottie, compositionConfig.fps));
    expect(comp.durationInFrames).toBe(150);
  });

  it('takes a different duration from a different Lottie (duration is not hardcoded)', async () => {
    const tiny = { v: '5.12.2', fr: 30, ip: 0, op: 90, w: 1920, h: 1080, nm: 'tiny', ddd: 0, assets: [], layers: [] };
    const serveUrl = await bundle({ entryPoint: entry });
    const comp = await selectComposition({
      serveUrl,
      id: compositionConfig.id,
      inputProps: { background: '#000000', elements: [{ id: 'tiny', lottie: tiny, startFrame: 0, endFrame: 90, zIndex: 0, enabled: true }] },
    });
    expect(comp.durationInFrames).toBe(90);
  });
});
