// @vitest-environment node

import { bundle } from '@remotion/bundler';
import { getCompositions } from '@remotion/renderer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compositionConfig } from './config';

// T3 (slow): bundle the package exactly the way the server does and ask
// Remotion which compositions it registers. This is the literal
// "composition builds and exports a valid Composition" test from M0.
// First run downloads Remotion's headless Chrome.
describe('Remotion root', () => {
  it('registers exactly one composition matching compositionConfig', async () => {
    const entry = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'entry.ts');
    const serveUrl = await bundle({ entryPoint: entry });
    const comps = await getCompositions(serveUrl);

    expect(comps).toHaveLength(1);
    const main = comps[0]!;
    expect(main.id).toBe(compositionConfig.id);
    expect(main.width).toBe(compositionConfig.width);
    expect(main.height).toBe(compositionConfig.height);
    expect(main.fps).toBe(compositionConfig.fps);
    expect(main.durationInFrames).toBe(compositionConfig.durationInFrames);
  });
});
