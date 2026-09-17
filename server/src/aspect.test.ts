import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app';
import { openDb, type Db } from './db/index';
import { buildProjectProps } from './renderProject';
import { elementDir, elementLottieUrl } from './templateFiles';

/**
 * M36: a spot has an aspect. The frame follows it in both runners; each
 * element renders its designer variant for that ratio where one exists,
 * and is auto-fitted (and says so) where none does.
 */
const lottie = (w: number, h: number) => ({ fr: 30, ip: 0, op: 150, w, h, layers: [] });
const schema = [{ key: 'headline', role: 'headline', kind: 'text', label: 'Headline', default: 'HI', path: '/layers/0' }];

describe('aspect versions (M36)', () => {
  let tmp: string;
  let db: Db;
  let app: ReturnType<typeof buildApp>;
  let projectId: number;
  let open: number;
  let card: number;

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-aspect-'));
    const write = (dir: string, l: object) => {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'schema.json'), JSON.stringify(schema));
      fs.writeFileSync(path.join(dir, 'template.json'), JSON.stringify(l));
    };
    write(path.join(tmp, 't', 'elements', 'open'), lottie(1920, 1080));
    write(path.join(tmp, 't', 'elements', 'open', 'variants', '9x16'), lottie(1080, 1920));
    write(path.join(tmp, 't', 'elements', 'end-card'), lottie(1920, 1080));
    db = openDb(':memory:');
    const t = db.upsertTemplate({ slug: 't', name: 'T', adType: 'Bio', durationFrames: 300, fps: 30, width: 1920, height: 1080, thumbPath: '' });
    open = db.upsertTemplateElement({ templateId: t.id, slug: 'open', zIndex: 0, startFrame: 0, endFrame: 150 }).id;
    card = db.upsertTemplateElement({ templateId: t.id, slug: 'end-card', zIndex: 0, startFrame: 150, endFrame: 300 }).id;
    app = buildApp({ db, templatesDir: tmp, mediaDir: path.join(tmp, 'media'), render: async ({ outputPath }) => fs.writeFileSync(outputPath, 'x') });
    projectId = ((await app.inject({ method: 'POST', url: '/projects', payload: { templateSlug: 't' } })).json() as { id: number }).id;
  });

  afterEach(async () => {
    await app.close();
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('element files resolve to the variant for a ratio when it exists, else the master', () => {
    expect(elementDir(tmp, 't', 'open', '9:16')).toBe(path.join(tmp, 't', 'elements', 'open', 'variants', '9x16'));
    expect(elementDir(tmp, 't', 'open', '1:1')).toBe(path.join(tmp, 't', 'elements', 'open'));
    expect(elementDir(tmp, 't', 'end-card', '9:16')).toBe(path.join(tmp, 't', 'elements', 'end-card'));
    expect(elementLottieUrl(tmp, 't', 'open', '9:16')).toBe('/templates/t/elements/open/variants/9x16/template.json');
    expect(elementLottieUrl(tmp, 't', 'open', '16:9')).toBe('/templates/t/elements/open/template.json');
  });

  it('a spot is 16:9 by default; PATCH sets the aspect and refuses an unknown one; duplicates keep it', async () => {
    expect(db.getProject(projectId)!.aspect).toBe('16:9');
    const detail0 = (await app.inject({ method: 'GET', url: `/projects/${projectId}` })).json() as { project: { aspect: string }; frame: { width: number; height: number } };
    expect(detail0.project.aspect).toBe('16:9');
    expect(detail0.frame).toEqual({ width: 1920, height: 1080 });

    const res = await app.inject({ method: 'PATCH', url: `/projects/${projectId}`, payload: { aspect: '9:16' } });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { aspect: string }).aspect).toBe('9:16');
    expect((await app.inject({ method: 'PATCH', url: `/projects/${projectId}`, payload: { aspect: '3:2' } })).statusCode).toBe(400);
    const copy = ((await app.inject({ method: 'POST', url: `/projects/${projectId}/duplicate` })).json() as { id: number }).id;
    expect(db.getProject(copy)!.aspect).toBe('9:16');
    const columns = (db.prepare(`PRAGMA table_info(project)`).all() as { name: string }[]).map((c) => c.name);
    expect(columns).toContain('aspect');
  });

  it('in 9:16 the detail names the frame, points the open at its variant and marks the end card auto-fitted; render props carry the frame and the variant', async () => {
    await app.inject({ method: 'PATCH', url: `/projects/${projectId}`, payload: { aspect: '9:16' } });
    const detail = (await app.inject({ method: 'GET', url: `/projects/${projectId}` })).json() as { frame: { width: number; height: number }; elements: { id: number; lottieUrl: string; variant: boolean }[] };
    expect(detail.frame).toEqual({ width: 1080, height: 1920 });
    expect(detail.elements.find((e) => e.id === open)).toMatchObject({ lottieUrl: '/templates/t/elements/open/variants/9x16/template.json', variant: true });
    expect(detail.elements.find((e) => e.id === card)).toMatchObject({ lottieUrl: '/templates/t/elements/end-card/template.json', variant: false });

    const props = buildProjectProps({ db, templatesDir: tmp, projectId, serverBase: 'http://x' });
    expect(props.frame).toEqual({ width: 1080, height: 1920 });
    expect([props.elements[0]!.lottie.w, props.elements[0]!.lottie.h]).toEqual([1080, 1920]);
    expect([props.elements[1]!.lottie.w, props.elements[1]!.lottie.h]).toEqual([1920, 1080]);
  });

  it('an export in another ratio carries the ratio in its file name', async () => {
    fs.mkdirSync(path.join(tmp, 't', 'elements', 'disc'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 't', 'elements', 'disc', 'schema.json'), JSON.stringify([{ key: 'disclaimer', role: 'safe.disclaimer', kind: 'text', label: 'Disclaimer', default: 'Paid for by X', path: '/layers/0', locked: true }]));
    fs.writeFileSync(path.join(tmp, 't', 'elements', 'disc', 'template.json'), JSON.stringify(lottie(1920, 1080)));
    const t = db.getTemplateBySlug('t')!;
    const disc = db.upsertTemplateElement({ templateId: t.id, slug: 'disc', zIndex: 2, startFrame: 0, endFrame: 150 }).id;
    const branded = ((await app.inject({ method: 'POST', url: '/projects', payload: { templateSlug: 't' } })).json() as { id: number }).id;
    expect(db.getProjectElements(branded).some((e) => e.id === disc)).toBe(true);
    await app.inject({ method: 'PATCH', url: `/projects/${branded}`, payload: { aspect: '4:5' } });
    const started = (await app.inject({ method: 'POST', url: '/render', payload: { projectId: branded } })).json() as { id: number };
    await new Promise((r) => setTimeout(r, 200));
    const done = (await app.inject({ method: 'GET', url: `/render/${started.id}` })).json() as { status: string; outputUrl: string | null };
    expect(done.status).toBe('done');
    expect(done.outputUrl).toMatch(/-4x5\.mp4$/);
  });
});
