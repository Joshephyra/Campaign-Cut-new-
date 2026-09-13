import fs from 'node:fs';
import path from 'node:path';
import { openDb } from './db/index';
import { paths } from './paths';
import { renderComposition } from './render';
import { buildProjectProps } from './renderProject';

// Render a saved project with the server-side runner:
//   npm run render:project -- --id 1 [--out name.mp4]
// The dev server must be running: the renderer fetches footage, images and
// template files from it over HTTP (which is why the media route needs CORS).

const args = process.argv.slice(2);
const argValue = (flag: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const id = Number(argValue('--id'));
if (!id) {
  console.error('usage: npm run render:project -- --id <projectId> [--out name.mp4]');
  process.exit(2);
}

const port = Number(process.env.CAMPAIGNCUT_SERVER_PORT ?? 3001);
const serverBase = `http://127.0.0.1:${port}`;
const db = openDb(paths.db);

const props = buildProjectProps({ db, templatesDir: paths.templates, projectId: id, serverBase });
db.close();

const outDir = path.join(paths.media, 'renders');
fs.mkdirSync(outDir, { recursive: true });
const outputPath = path.join(outDir, argValue('--out') ?? `project-${id}.mp4`);

console.log(`[render] project ${id}`);
console.log(`[render] footage: ${props.elements.map((e) => e.media?.src ?? '(none)').join(', ')}`);
console.log('[render] bundling and rendering…');
const started = Date.now();
let lastShown = -1;

const finalPath = await renderComposition({
  outputPath,
  inputProps: props,
  onProgress: (p) => {
    const pct = Math.floor(p * 100);
    if (pct !== lastShown && pct % 10 === 0) {
      lastShown = pct;
      console.log(`[render] ${pct}%`);
    }
  },
});

console.log(`[render] done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
console.log(`[render] ${finalPath}`);
