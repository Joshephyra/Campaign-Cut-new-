import fs from 'node:fs';
import path from 'node:path';
import { openDb } from './db/index';
import { FIDELITY_THRESHOLD, runFidelity } from './fidelity';
import { paths } from './paths';
import { renderComposition } from './render';
import { buildProjectProps, buildTemplateDefaultProps } from './renderProject';

// M19: the fidelity harness behind AT-2.
//
//   npm run fidelity -- --template three
//   npm run fidelity -- --template three --project 3
//   npm run fidelity -- --template three --reference path/to/ref.mp4 --render path/to/out.mp4 --samples 12 --threshold 6
//
// Renders the template as authored (or a project) through the export
// runner, samples it and the reference at the same times, and writes frames,
// side-by-side strips and a report to media/fidelity/<slug>-<time>/.
// Exit 1 when any sample is over threshold. The dev server must be running.

const args = process.argv.slice(2);
const argValue = (flag: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const slug = argValue('--template');
if (!slug) {
  console.error('usage: npm run fidelity -- --template <slug> [--project <id>] [--reference ref.mp4] [--render out.mp4] [--samples 12] [--threshold 6]');
  process.exit(2);
}

const baseDir = process.env.INIT_CWD ?? process.cwd();
const port = Number(process.env.CAMPAIGNCUT_SERVER_PORT ?? 3001);
const serverBase = `http://127.0.0.1:${port}`;
const db = openDb(paths.db);
const stamp = Date.now();
const workDir = path.join(paths.media, 'fidelity', `${slug}-${stamp}`);

const referencePath = argValue('--reference') ? path.resolve(baseDir, argValue('--reference')!) : path.join(paths.templates, slug, 'reference.mp4');
if (!fs.existsSync(referencePath)) {
  console.error(`[fidelity] no reference render at ${referencePath}. Hand over reference.mp4 with the template, or pass --reference.`);
  process.exit(2);
}

let renderPath = argValue('--render') ? path.resolve(baseDir, argValue('--render')!) : undefined;
if (!renderPath) {
  renderPath = path.join(paths.media, 'renders', `fidelity-${slug}-${stamp}.mp4`);
  fs.mkdirSync(path.dirname(renderPath), { recursive: true });
  const projectId = argValue('--project') ? Number(argValue('--project')) : undefined;
  const props = projectId
    ? buildProjectProps({ db, templatesDir: paths.templates, projectId, serverBase })
    : buildTemplateDefaultProps({ db, templatesDir: paths.templates, slug, serverBase });
  console.log(`[fidelity] rendering ${projectId ? `project ${projectId}` : `template "${slug}" as authored`} -> ${renderPath}`);
  await renderComposition({ outputPath: renderPath, inputProps: props });
}
db.close();

const samples = Number(argValue('--samples') ?? 12);
const threshold = Number(argValue('--threshold') ?? FIDELITY_THRESHOLD);
console.log(`[fidelity] reference ${referencePath}`);
console.log(`[fidelity] ${samples} samples, threshold ${threshold}`);

const report = await runFidelity({ template: slug, referencePath, renderPath, workDir, samples, threshold });
console.log('');
console.log(report.text);
console.log('');
console.log(`[fidelity] frames, strips and report written to ${workDir}`);
process.exit(report.passed ? 0 : 1);
