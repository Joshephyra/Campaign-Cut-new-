import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app';
import { openDb, type Db } from './db/index';
import { buildProjectProps } from './renderProject';

const lottie = { fr: 30, ip: 0, op: 150, w: 1920, h: 1080, layers: [] };

describe('PUT /projects/:id/elements/:elementId', () => {
  let tmp: string;
  let db: Db;
  let app: ReturnType<typeof buildApp>;
  let projectId: number;
  let elementId: number;

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-el-'));
    fs.mkdirSync(path.join(tmp, 't'));
    fs.writeFileSync(path.join(tmp, 't', 'schema.json'), '[]');
    fs.writeFileSync(path.join(tmp, 't', 'template.json'), JSON.stringify(lottie));
    db = openDb(':memory:');
    const t = db.upsertTemplate({ slug: 't', name: 'T', adType: 'Bio', durationFrames: 150, fps: 30, width: 1920, height: 1080, thumbPath: '' });
    elementId = db.upsertTemplateElement({ templateId: t.id, slug: 't', zIndex: 0, startFrame: 0, endFrame: 150 }).id;
    app = buildApp({ db, templatesDir: tmp });
    const created = await app.inject({ method: 'POST', url: '/projects', payload: { templateSlug: 't' } });
    projectId = (created.json() as { id: number }).id;
  });

  afterEach(async () => {
    await app.close();
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('moves an element in time and the project reports it', async () => {
    const res = await app.inject({ method: 'PUT', url: `/projects/${projectId}/elements/${elementId}`, payload: { startFrame: 30, endFrame: 180 } });
    expect(res.statusCode).toBe(200);
    const detail = (await app.inject({ method: 'GET', url: `/projects/${projectId}` })).json() as { elements: { startFrame: number; endFrame: number; enabled: boolean }[] };
    expect(detail.elements[0]).toMatchObject({ startFrame: 30, endFrame: 180, enabled: true });
  });

  it('toggles an element off and the export runner drops it', async () => {
    await app.inject({ method: 'PUT', url: `/projects/${projectId}/elements/${elementId}`, payload: { enabled: false } });
    const props = buildProjectProps({ db, templatesDir: tmp, projectId, serverBase: 'http://x' });
    expect(props.elements).toHaveLength(1);
    expect(props.elements[0]!.enabled).toBe(false);
  });

  it('the export runner carries the moved in/out points', async () => {
    await app.inject({ method: 'PUT', url: `/projects/${projectId}/elements/${elementId}`, payload: { startFrame: 30, endFrame: 180 } });
    const props = buildProjectProps({ db, templatesDir: tmp, projectId, serverBase: 'http://x' });
    expect(props.elements[0]).toMatchObject({ startFrame: 30, endFrame: 180 });
  });

  it('rejects an out point before the in point, and unknown elements', async () => {
    expect((await app.inject({ method: 'PUT', url: `/projects/${projectId}/elements/${elementId}`, payload: { startFrame: 50, endFrame: 40 } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'PUT', url: `/projects/${projectId}/elements/999`, payload: { enabled: false } })).statusCode).toBe(404);
  });
});
