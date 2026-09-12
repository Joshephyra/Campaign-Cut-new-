import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app';
import { openDb, type Db } from './db/index';
import { buildProjectProps } from './renderProject';

const lottie = { fr: 30, ip: 0, op: 150, w: 1920, h: 1080, layers: [] };

describe('transitions per element boundary', () => {
  let tmp: string;
  let db: Db;
  let app: ReturnType<typeof buildApp>;
  let projectId: number;
  let open: number;
  let card: number;

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-tr-'));
    fs.mkdirSync(path.join(tmp, 't'));
    fs.writeFileSync(path.join(tmp, 't', 'schema.json'), '[]');
    fs.writeFileSync(path.join(tmp, 't', 'template.json'), JSON.stringify(lottie));
    db = openDb(':memory:');
    const t = db.upsertTemplate({ slug: 't', name: 'T', adType: 'Bio', durationFrames: 300, fps: 30, width: 1920, height: 1080, thumbPath: '' });
    open = db.upsertTemplateElement({ templateId: t.id, slug: 'open', zIndex: 0, startFrame: 0, endFrame: 150 }).id;
    card = db.upsertTemplateElement({ templateId: t.id, slug: 'card', zIndex: 1, startFrame: 150, endFrame: 300 }).id;
    app = buildApp({ db, templatesDir: tmp });
    projectId = ((await app.inject({ method: 'POST', url: '/projects', payload: { templateSlug: 't' } })).json() as { id: number }).id;
  });

  afterEach(async () => {
    await app.close();
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('a new project has no transitions (every boundary is a cut)', async () => {
    const detail = (await app.inject({ method: 'GET', url: `/projects/${projectId}` })).json() as { transitions: unknown[] };
    expect(detail.transitions).toEqual([]);
  });

  it('stores a transition after an element and reports it', async () => {
    const res = await app.inject({ method: 'PUT', url: `/projects/${projectId}/transitions/${open}`, payload: { preset: 'fade', durationInFrames: 15 } });
    expect(res.statusCode).toBe(200);
    const detail = (await app.inject({ method: 'GET', url: `/projects/${projectId}` })).json() as { transitions: { afterElementId: number; preset: string; durationInFrames: number }[] };
    expect(detail.transitions).toEqual([{ afterElementId: open, preset: 'fade', durationInFrames: 15 }]);
  });

  it('changing it replaces rather than duplicates, and cut removes it', async () => {
    await app.inject({ method: 'PUT', url: `/projects/${projectId}/transitions/${open}`, payload: { preset: 'fade', durationInFrames: 15 } });
    await app.inject({ method: 'PUT', url: `/projects/${projectId}/transitions/${open}`, payload: { preset: 'wipe', durationInFrames: 20 } });
    expect(db.getProjectTransitions(projectId)).toEqual([{ afterElementId: open, preset: 'wipe', durationInFrames: 20 }]);
    await app.inject({ method: 'PUT', url: `/projects/${projectId}/transitions/${open}`, payload: { preset: 'cut' } });
    expect(db.getProjectTransitions(projectId)).toEqual([]);
  });

  it('rejects unknown presets, bad durations and unknown elements', async () => {
    expect((await app.inject({ method: 'PUT', url: `/projects/${projectId}/transitions/${open}`, payload: { preset: 'sparkle', durationInFrames: 10 } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'PUT', url: `/projects/${projectId}/transitions/${open}`, payload: { preset: 'fade', durationInFrames: 0 } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'PUT', url: `/projects/${projectId}/transitions/999`, payload: { preset: 'fade', durationInFrames: 10 } })).statusCode).toBe(404);
  });

  it('the export runner carries transitions with string element ids', async () => {
    await app.inject({ method: 'PUT', url: `/projects/${projectId}/transitions/${open}`, payload: { preset: 'slide', durationInFrames: 12 } });
    const props = buildProjectProps({ db, templatesDir: tmp, projectId, serverBase: 'http://x' });
    expect(props.transitions).toEqual([{ afterElementId: String(open), preset: 'slide', durationInFrames: 12 }]);
    expect(props.elements.map((e) => e.id)).toEqual([String(open), String(card)]);
  });
});
