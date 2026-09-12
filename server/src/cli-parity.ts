import fs from 'node:fs';
import path from 'node:path';
import { openDb } from './db/index';
import { PARITY_THRESHOLD, runParity } from './parity';
import { paths } from './paths';
import { renderComposition } from './render';
import { buildProjectProps } from './renderProject';

// The automated half of AT-5 (SPEC.md section 6):
//   npm run parity -- --id 1 [--frames 10,75,140] [--export media/renders/x.mp4]
// Extracts frames from the export and compares them with the same frames
// rendered from the PREVIEW runner's props. Exit 1 if any frame is over
// threshold. The dev server must be running (media is fetched over HTTP).

const args = process.argv.slice(2);
const argValue = (flag: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const id = Number(argValue('--id'));
if (!id) {
  console.error('usage: npm run parity -- --id <projectId> [--frames 10,75,140] [--export path.mp4]');
  process.exit(2);
}

const port = Number(process.env.CAMPAIGNCUT_SERVER_PORT ?? 3001);
const serverBase = `http://127.0.0.1:${port}`;
const baseDir = process.env.INIT_CWD ?? process.cwd();
const db = openDb(paths.db);
const workDir = path.join(paths.media, 'parity', `project-${id}-${Date.now()}`);

let exportPath = argValue('--export') ? path.resolve(baseDir, argValue('--export')!) : undefined;
if (!exportPath) {
  exportPath = path.join(paths.media, 'renders', `parity-project-${id}.mp4`);
  fs.mkdirSync(path.dirname(exportPath), { recursive: true });
  console.log(`[parity] rendering export -> ${exportPath}`);
  const props = buildProjectProps({ db, templatesDir: paths.templates, projectId: id, serverBase });
  await renderComposition({ outputPath: exportPath, inputProps: props });
}

const frames = (argValue('--frames') ?? '10,75,140').split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n));
console.log(`[parity] project ${id}, frames ${frames.join(', ')}, threshold mean diff <= ${PARITY_THRESHOLD}/255`);

const results = await runParity({ db, templatesDir: paths.templates, projectId: id, serverBase, exportPath, frames, workDir });
db.close();

let failed = 0;
for (const r of results) {
  const c = r.comparison;
  const flag = c.withinThreshold ? 'OK  ' : 'FAIL';
  if (!c.withinThreshold) failed++;
  console.log(`  ${flag} frame ${String(r.frame).padStart(4)}  mean ${c.meanAbsDiff.toFixed(2)}  max ${c.maxAbsDiff}  differing ${(c.differingFraction * 100).toFixed(2)}%`);
}
console.log(`[parity] frames written to ${workDir}`);
if (failed > 0) {
  console.error(`[parity] ${failed} frame${failed === 1 ? '' : 's'} over threshold`);
  process.exit(1);
}
console.log('[parity] all frames within threshold');
