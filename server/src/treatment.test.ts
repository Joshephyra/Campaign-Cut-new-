import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app';
import { openDb, type Db } from './db/index';
import { buildProjectProps } from './renderProject';

/**
 * M39: a spot's style treatment. Stored on the project, set through PATCH,
 * carried in the detail and in the render props (glow with the spot's own
 * accent), copied by duplicate.
 */
const lottie = { fr: 30, ip: 0, op: 150, w: 1920, h: 1080, layers: [{ ty: 4, nm: 'cc.accent', shapes: [{ ty: 'gr', it: [{ ty: 'rc' }, { ty: 'fl', c: { a: 0, k: [0.94, 0.35, 0.16, 1] } }] }] }] };
const schema = [{ key: 'accent', role: 'accent', kind: 'color', label: 'Accent colour', default: '#F05929', path: '/layers/0/shapes/0/it/1' }];

describe('style treatment (M39)', () => {
  let tmp: string;
  let db: Db;
  let app: ReturnType<typeof buildApp>;
  let projectId: number;
  let elementId: number;

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-treat-'));
    const dir = path.join(tmp, 't', 'elements', 'open');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'schema.json'), JSON.stringify(schema));
    fs.writeFileSync(path.join(dir, 'template.json'), JSON.stringify(lottie));
    db = openDb(':memory:');
    const t = db.upsertTemplate({ slug: 't', name: 'T', adType: 'Bio', durationFrames: 150, fps: 30, width: 1920, height: 1080, thumbPath: '' });
    elementId = db.upsertTemplateElement({ templateId: t.id, slug: 'open', zIndex: 0, startFrame: 0, endFrame: 150 }).id;
    app = buildApp({ db, templatesDir: tmp });
    projectId = ((await app.inject({ method: 'POST', url: '/projects', payload: { templateSlug: 't' } })).json() as { id: number }).id;
  });

  afterEach(async () => {
    await app.close();
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('is clean by default; PATCH sets it and refuses an unknown one; the detail and a duplicate carry it', async () => {
    expect(db.getProject(projectId)!.treatment).toBe('clean');
    const res = await app.inject({ method: 'PATCH', url: `/projects/${projectId}`, payload: { treatment: 'grit' } });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { treatment: string }).treatment).toBe('grit');
    expect((await app.inject({ method: 'PATCH', url: `/projects/${projectId}`, payload: { treatment: 'bubbly' } })).statusCode).toBe(400);
    const detail = (await app.inject({ method: 'GET', url: `/projects/${projectId}` })).json() as { project: { treatment: string } };
    expect(detail.project.treatment).toBe('grit');
    const copy = ((await app.inject({ method: 'POST', url: `/projects/${projectId}/duplicate` })).json() as { id: number }).id;
    expect(db.getProject(copy)!.treatment).toBe('grit');
    const columns = (db.prepare(`PRAGMA table_info(project)`).all() as { name: string }[]).map((c) => c.name);
    expect(columns).toContain('treatment');
  });

  it('render props carry the treatment; glow takes the accent the spot has set, so both runners glow alike', async () => {
    expect(buildProjectProps({ db, templatesDir: tmp, projectId, serverBase: 'http://x' }).treatment).toBeNull();
    await app.inject({ method: 'PATCH', url: `/projects/${projectId}`, payload: { treatment: 'glow' } });
    expect(buildProjectProps({ db, templatesDir: tmp, projectId, serverBase: 'http://x' }).treatment).toEqual({ name: 'glow', accent: '#F05929' });
    await app.inject({ method: 'PUT', url: `/projects/${projectId}/values`, payload: { values: [{ elementId, key: 'accent', value: '#00ff00' }] } });
    expect(buildProjectProps({ db, templatesDir: tmp, projectId, serverBase: 'http://x' }).treatment).toEqual({ name: 'glow', accent: '#00FF00' });
    await app.inject({ method: 'PATCH', url: `/projects/${projectId}`, payload: { treatment: 'opaque' } });
    expect(buildProjectProps({ db, templatesDir: tmp, projectId, serverBase: 'http://x' }).treatment).toEqual({ name: 'opaque' });
  });
});
