import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PNG } from 'pngjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from './app';
import { openDb, type Db } from './db/index';
import { extractFrame } from './parity';
import { paths } from './paths';
import { renderComposition } from './render';
import { buildProjectProps } from './renderProject';

/**
 * REGRESSION GUARD for the missing-export bug (CLAUDE.md): ingested designs
 * were absent from exports because the render process fetched media over
 * HTTP and a missing CORS header failed silently. Preview looked fine.
 *
 * This test exports a project built on the real ingested stand-in, with its
 * logo image served over real HTTP from a live server, then reads pixels
 * out of the MP4: the Lottie's panel AND its HTTP-fetched logo must be there.
 */
describe('export contains the ingested Lottie layer', () => {
  let tmp: string;
  let db: Db;
  let app: ReturnType<typeof buildApp>;
  let serverBase: string;
  let projectId: number;

  beforeAll(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-export-'));
    db = openDb(':memory:');
    // The real, committed stand-in template on disk; a throwaway DB.
    const meta = JSON.parse(fs.readFileSync(path.join(paths.templates, 'standin', 'meta.json'), 'utf8')) as { durationInFrames: number };
    const t = db.upsertTemplate({ slug: 'standin', name: 'Stand-in', adType: 'Contrast', durationFrames: meta.durationInFrames, fps: 30, width: 1920, height: 1080, thumbPath: '' });
    db.upsertTemplateElement({ templateId: t.id, slug: 'standin', zIndex: 0, startFrame: 0, endFrame: meta.durationInFrames });
    app = buildApp({ db, templatesDir: paths.templates, mediaDir: path.join(tmp, 'media') });
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    serverBase = address;
    projectId = ((await app.inject({ method: 'POST', url: '/projects', payload: { templateSlug: 'standin' } })).json() as { id: number }).id;
  }, 60_000);

  afterAll(async () => {
    await app.close();
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('the exported MP4 shows the panel and the HTTP-served logo at frame 75', async () => {
    const props = buildProjectProps({ db, templatesDir: paths.templates, projectId, serverBase });
    const out = path.join(tmp, 'export.mp4');
    await renderComposition({ outputPath: out, inputProps: props });

    const frame = path.join(tmp, 'f75.png');
    await extractFrame(out, 75, frame);
    const png = PNG.sync.read(fs.readFileSync(frame));
    const at = (fx: number, fy: number): [number, number, number] => {
      const i = (Math.floor(png.height * fy) * png.width + Math.floor(png.width * fx)) * 4;
      return [png.data[i]!, png.data[i + 1]!, png.data[i + 2]!];
    };

    // Panel (cc.surface #0F1729) fills the left 55%: sample well inside it.
    const panel = at(0.3, 0.2);
    expect(panel[2]).toBeGreaterThan(panel[0]); // navy: more blue than red
    expect(panel[2]).toBeLessThan(90); // and dark, not the black background? (black would be ~0)
    expect(panel[2]).toBeGreaterThan(20);

    // Logo (orange #F05929, fetched over HTTP from /templates/standin/images/logo.png) at x 1560..1800, y 900..1020.
    const logo = at(1680 / 1920, 960 / 1080);
    expect(logo[0]).toBeGreaterThan(180);
    expect(logo[1]).toBeLessThan(140);
    expect(logo[2]).toBeLessThan(100);
  }, 300_000);
});
