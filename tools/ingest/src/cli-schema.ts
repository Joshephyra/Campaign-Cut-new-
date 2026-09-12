import type { LottieAnimationData } from '@campaigncut/composition';
import fs from 'node:fs';
import path from 'node:path';
import { generateSchema } from './generateSchema';

// Usage:
//   npm run schema -- <path-to-lottie.json> [--out schema.json] [--dry-run]
//
// Reads a Bodymovin export, prints every cc.* tag it found and what it
// resolved to, and writes schema.json next to the input (or to --out).
// Exits non-zero and writes nothing if any tag is invalid.

const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith('--'));
const argValue = (flag: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const dryRun = args.includes('--dry-run');

if (!input) {
  console.error('usage: npm run schema -- <path-to-lottie.json> [--out schema.json] [--dry-run]');
  process.exit(2);
}

// npm runs workspace scripts inside the workspace; INIT_CWD is where the user actually typed the command.
const baseDir = process.env.INIT_CWD ?? process.cwd();
const inputPath = path.resolve(baseDir, input);
const outArg = argValue('--out');
const outPath = outArg ? path.resolve(baseDir, outArg) : path.join(path.dirname(inputPath), 'schema.json');

const lottie = JSON.parse(fs.readFileSync(inputPath, 'utf8')) as LottieAnimationData;
const { params, fonts, report, errors } = generateSchema(lottie);

console.log(`Template: ${String(lottie.nm ?? path.basename(inputPath))}`);
console.log(`  ${lottie.w}x${lottie.h} @ ${lottie.fr} fps, frames ${lottie.ip}-${lottie.op}`);
console.log('');
console.log(`Tags found: ${report.length}`);
if (report.length === 0) {
  console.log('  (none) - no layer name starts with "cc."');
}
for (const entry of report) {
  const status = entry.status === 'error' ? 'ERROR' : entry.status;
  const where = entry.path ? `  ${entry.path}` : '';
  console.log(`  ${entry.layer.padEnd(24)} ${status.padEnd(6)}${where}`);
}
console.log('');
console.log(`Fonts referenced: ${fonts.length ? fonts.join(', ') : '(none)'}`);
console.log('');

if (errors.length > 0) {
  console.error(`${errors.length} problem${errors.length === 1 ? '' : 's'}. Nothing written.`);
  for (const e of errors) console.error(`  - ${e.message}`);
  process.exit(1);
}

console.log(`Editable params: ${params.length}`);
for (const p of params) {
  const extras = [p.maxChars !== undefined ? `max ${p.maxChars} chars` : null, p.locked ? 'locked' : null].filter(Boolean).join(', ');
  console.log(`  ${p.key.padEnd(14)} ${p.kind.padEnd(6)} ${JSON.stringify(p.default)}${extras ? `  (${extras})` : ''}`);
}

if (dryRun) {
  console.log('\n--dry-run: schema not written');
} else {
  fs.writeFileSync(outPath, JSON.stringify(params, null, 2) + '\n');
  console.log(`\nWrote ${outPath}`);
}
