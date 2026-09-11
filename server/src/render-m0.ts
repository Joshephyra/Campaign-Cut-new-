import { defaultProps } from '@campaigncut/composition';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderComposition } from './render';

// M0 smoke render: the same composition the Player shows, written to an MP4.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const outDir = path.join(repoRoot, 'media', 'renders');
fs.mkdirSync(outDir, { recursive: true });

const outputPath = path.join(outDir, 'm0-frame-counter.mp4');

console.log('[render:m0] bundling and rendering…');
const started = Date.now();
let lastShown = -1;

const finalPath = await renderComposition({
  outputPath,
  inputProps: defaultProps,
  onProgress: (p) => {
    const pct = Math.floor(p * 100);
    if (pct !== lastShown && pct % 10 === 0) {
      lastShown = pct;
      console.log(`[render:m0] ${pct}%`);
    }
  },
});

const seconds = ((Date.now() - started) / 1000).toFixed(1);
console.log(`[render:m0] done in ${seconds}s`);
console.log(`[render:m0] ${finalPath}`);
