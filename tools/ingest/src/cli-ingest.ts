import { openDb } from '@campaigncut/server/db';
import { paths } from '@campaigncut/server/paths';
import { renderThumbnail } from '@campaigncut/server/render';
import path from 'node:path';
import { IngestFailure, ingestTemplate } from './ingest';

// Usage:
//   npm run ingest -- <handover-folder-or-lottie.json> --ad-type "Contrast" --name "Split Record" [--slug split-record]
//
// This is AT-1: one command turns a Bodymovin export (or, since M17, a
// folder of exports, one per element) into a template the app can see. It
// prints every cc.* tag it found, per element. On any problem it prints all
// of them, names the element, layer or font, and writes nothing.

const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith('--') && !isFlagValue(a));
function isFlagValue(a: string): boolean {
  const i = args.indexOf(a);
  return i > 0 && args[i - 1]!.startsWith('--');
}
const argValue = (flag: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};

const adType = argValue('--ad-type');
const name = argValue('--name');
const slug = argValue('--slug');

if (!input || !adType || !name) {
  console.error('usage: npm run ingest -- <handover-folder-or-lottie.json> --ad-type "Contrast" --name "..." [--slug ...]');
  process.exit(2);
}

// npm runs workspace scripts inside the workspace; INIT_CWD is where the user typed the command.
const baseDir = process.env.INIT_CWD ?? process.cwd();
const db = openDb(paths.db);

try {
  const result = await ingestTemplate({
    input: path.resolve(baseDir, input),
    adType,
    name,
    slug,
    templatesDir: paths.templates,
    fontsDir: paths.fonts,
    db,
    renderThumbnail: ({ elements, outputPath, frame, fonts }) =>
      renderThumbnail({ outputPath, inputProps: { background: '#000000', elements, fonts }, frame }).then(() => undefined),
    log: (line) => console.log(`  ${line}`),
  });

  console.log('');
  for (const element of result.elements) {
    console.log(`Element "${element.name}" (${element.slug}): frames ${element.startFrame}-${element.endFrame}, z ${element.zIndex}, ${element.report.length} tag(s)`);
    for (const entry of element.report) {
      console.log(`  ${entry.layer.padEnd(24)} ${entry.status.padEnd(6)} ${entry.path ?? ''}`);
    }
  }
  console.log(`Fonts: ${result.fonts.join(', ') || '(none)'}`);
  console.log('');
  console.log(
    `Ingested "${result.meta.name}" as ${result.slug}: ${result.meta.width}x${result.meta.height} @ ${result.meta.fps} fps, ${result.meta.durationInFrames} frames, ${result.elements.length} element(s)`,
  );
  console.log(`  ${result.dir}`);
  process.exit(0);
} catch (err) {
  if (err instanceof IngestFailure) {
    if (err.report.length > 0) {
      console.log('');
      console.log(`Tags found: ${err.report.length}`);
      for (const entry of err.report) {
        console.log(`  ${`${entry.element} › ${entry.layer}`.padEnd(36)} ${entry.status === 'error' ? 'ERROR' : entry.status}`);
      }
    }
    console.error('');
    console.error(`Ingest rejected. ${err.problems.length} problem${err.problems.length === 1 ? '' : 's'}. Nothing written.`);
    for (const p of err.problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  throw err;
} finally {
  db.close();
}
