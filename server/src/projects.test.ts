import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app';
import { openDb, type Db } from './db/index';

/** M22: projects can be renamed, duplicated and deleted. One shared list; no accounts. */
const schema = [{ key: 'headline', role: 'headline', kind: 'text', label: 'Headline', default: 'Hello', path: '/layers/0' }];

describe('project management (M22)', () => {
  let tmp: string;
  let db: Db;
  let app: ReturnType<typeof buildApp>;
  let projectId: number;
  let elementId: number;
  let bedId: number;

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-projects-'));
    fs.mkdirSync(path.join(tmp, 't'));
    fs.writeFileSync(path.join(tmp, 't', 'schema.json'), JSON.stringify(schema));
    fs.writeFileSync(path.join(tmp, 't', 'template.json'), JSON.stringify({ fr: 30, ip: 0, op: 150, w: 1920, h: 1080, layers: [] }));
    db = openDb(':memory:');
    const t = db.upsertTemplate({ slug: 't', name: 'T', adType: 'Bio', durationFrames: 150, fps: 30, width: 1920, height: 1080, thumbPath: '' });
    elementId = db.upsertTemplateElement({ templateId: t.id, slug: 't', zIndex: 0, startFrame: 0, endFrame: 150 }).id;
    bedId = db.insertMediaAsset({ kind: 'audio', originalName: 'bed.wav', originalPath: 'originals/bed.wav', proxyPath: 'originals/bed.wav', thumbPath: '', width: 0, height: 0, durationS: 10, fps: 0 }).id;
    app = buildApp({ db, templatesDir: tmp, mediaDir: path.join(tmp, 'media') });
    projectId = ((await app.inject({ method: 'POST', url: '/projects', payload: { templateSlug: 't', name: 'Tuesday spot' } })).json() as { id: number }).id;
    db.setProjectValues(projectId, [{ elementId, key: 'headline', value: 'VOTE' }]);
    db.setProjectElement(projectId, elementId, { startFrame: 10, endFrame: 100, enabled: true });
    db.setProjectTransition(projectId, elementId, { preset: 'fade', durationInFrames: 12 });
    db.setProjectAudio(projectId, { assetId: bedId, volume: 0.5, inS: 2 });
  });

  afterEach(async () => {
    await app.close();
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('PATCH renames a project and refuses an empty name', async () => {
    const res = await app.inject({ method: 'PATCH', url: `/projects/${projectId}`, payload: { name: '  Wednesday spot  ' } });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { name: string }).name).toBe('Wednesday spot');
    expect(db.getProject(projectId)!.name).toBe('Wednesday spot');
    expect((await app.inject({ method: 'PATCH', url: `/projects/${projectId}`, payload: { name: '   ' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'PATCH', url: `/projects/999`, payload: { name: 'x' } })).statusCode).toBe(404);
  });

  it('POST duplicate copies values, timeline overrides, transitions and the music bed into a new project', async () => {
    const res = await app.inject({ method: 'POST', url: `/projects/${projectId}/duplicate` });
    expect(res.statusCode).toBe(201);
    const { id } = res.json() as { id: number };
    expect(id).not.toBe(projectId);
    const copy = db.getProject(id)!;
    expect(copy.name).toBe('Tuesday spot copy');
    expect(copy.templateId).toBe(db.getProject(projectId)!.templateId);
    expect(copy.values).toEqual([{ elementId, key: 'headline', value: 'VOTE' }]);
    expect(db.getProjectElements(id)[0]).toMatchObject({ startFrame: 10, endFrame: 100, enabled: true });
    expect(db.getProjectTransitions(id)).toEqual([{ afterElementId: elementId, preset: 'fade', durationInFrames: 12 }]);
    expect(db.getProjectAudio(id)).toEqual({ assetId: bedId, volume: 0.5, inS: 2 });
    // the original is untouched and edits to the copy stay on the copy
    db.setProjectValues(id, [{ elementId, key: 'headline', value: 'COPY' }]);
    expect(db.getProject(projectId)!.values[0]!.value).toBe('VOTE');
    expect((await app.inject({ method: 'POST', url: `/projects/999/duplicate` })).statusCode).toBe(404);
  });

  it('DELETE removes the project and everything that hangs off it', async () => {
    db.insertRender(projectId);
    const res = await app.inject({ method: 'DELETE', url: `/projects/${projectId}` });
    expect(res.statusCode).toBe(204);
    expect(db.getProject(projectId)).toBeUndefined();
    expect(db.getProjectElements(projectId)).toEqual([]);
    expect(db.getProjectTransitions(projectId)).toEqual([]);
    expect(db.getProjectAudio(projectId)).toBeNull();
    expect(db.listRenders(projectId)).toEqual([]);
    expect(db.prepare(`SELECT COUNT(*) AS n FROM project_value WHERE project_id = ?`).get(projectId)).toEqual({ n: 0 });
    expect((await app.inject({ method: 'GET', url: `/projects/${projectId}` })).statusCode).toBe(404);
    expect((await app.inject({ method: 'DELETE', url: `/projects/${projectId}` })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/projects' })).json()).toEqual([]);
  });
});
