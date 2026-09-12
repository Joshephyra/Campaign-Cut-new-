import { type LottieAnimationData } from '@campaigncut/composition';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderComposition } from './render';

// M1 smoke render: the same composition the Player shows, with the same
// hardcoded stand-in template, written to an MP4 by the server-side runner.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const templatePath = path.join(repoRoot, 'templates', 'standin', 'template.json');
const outDir = path.join(repoRoot, 'media', 'renders');
fs.mkdirSync(outDir, { recursive: true });

const lottie = JSON.parse(fs.readFileSync(templatePath, 'utf8')) as LottieAnimationData;
const outputPath = path.join(outDir, 'm1-standin.mp4');

console.log(`[render] template: ${templatePath}`);
console.log('[render] bundling and rendering…');
const started = Date.now();
let lastShown = -1;

const finalPath = await renderComposition({
  outputPath,
  inputProps: { background: '#0F4C5C', lottie },
  onProgress: (p) => {
    const pct = Math.floor(p * 100);
    if (pct !== lastShown && pct % 10 === 0) {
      lastShown = pct;
      console.log(`[render] ${pct}%`);
    }
  },
});

const seconds = ((Date.now() - started) / 1000).toFixed(1);
console.log(`[render] done in ${seconds}s`);
console.log(`[render] ${finalPath}`);
