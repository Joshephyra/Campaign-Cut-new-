import { applyLottieValues, compositionConfig, lottieDurationInFrames, type LottieAnimationData, type ParamValues, type TemplateParam } from '@campaigncut/composition';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderComposition } from './render';

// Smoke render: the same composition the Player shows, with the same
// hardcoded stand-in template, written to an MP4 by the server-side runner.
//
//   npm run render:standin                      authored values
//   npm run render:standin -- --values v.json   with edits applied via applyLottieValues
//   npm run render:standin -- --out name.mp4    choose the output file name
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const standinDir = path.join(repoRoot, 'templates', 'standin');
const outDir = path.join(repoRoot, 'media', 'renders');
fs.mkdirSync(outDir, { recursive: true });

const args = process.argv.slice(2);
const argValue = (flag: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};

const source = JSON.parse(fs.readFileSync(path.join(standinDir, 'elements', 'standin', 'template.json'), 'utf8')) as LottieAnimationData;
const schema = JSON.parse(fs.readFileSync(path.join(standinDir, 'elements', 'standin', 'schema.json'), 'utf8')) as TemplateParam[];

const valuesPath = argValue('--values');
const values: ParamValues = valuesPath ? (JSON.parse(fs.readFileSync(path.resolve(valuesPath), 'utf8')) as ParamValues) : {};
const lottie = applyLottieValues(source, values, schema);

const outputPath = path.join(outDir, argValue('--out') ?? 'm1-standin.mp4');

console.log(`[render] template: ${standinDir}`);
if (valuesPath) console.log(`[render] values: ${JSON.stringify(values)}`);
console.log('[render] bundling and rendering…');
const started = Date.now();
let lastShown = -1;

const finalPath = await renderComposition({
  outputPath,
  inputProps: {
    background: '#0F4C5C',
    media: null,
    elements: [{ id: 'standin', lottie, startFrame: 0, endFrame: lottieDurationInFrames(lottie, compositionConfig.fps), zIndex: 0, enabled: true }],
  },
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
