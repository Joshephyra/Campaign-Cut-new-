import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app';
import { openDb, type Db } from './db/index';

const schema = [
  { key: 'headline', role: 'headline', kind: 'text', label: 'Headline', default: 'Hello', path: '/layers/0' },
  { key: 'accent', role: 'accent', kind: 'color', label: 'Accent colour', default: '#FF0000', path: '/layers/1/shapes/0/it/1' },
];

describe('PUT /projects/:id/values', () => {
  let tmp: string;
  let db: Db;
  let app: ReturnType<typeof buildApp>;
  let projectId: number;
  let elementId: number;

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-values-'));
    fs.mkdirSync(path.join(tmp, 't'));
    fs.writeFileSync(path.join(tmp, 't', 'schema.json'), JSON.stringify(schema));
    db = openDb(':memory:');
    const { id } = db.upsertTemplate({ slug: 't', name: 'T', adType: 'Bio', durationFrames: 10, fps: 30, width: 1920, height: 1080, thumbPath: '' });
    elementId = db.upsertTemplateElement({ templateId: id, slug: 't', zIndex: 0, startFrame: 0, endFrame: 10 }).id;
    app = buildApp({ db, templatesDir: tmp });
    const created = await app.inject({ method: 'POST', url: '/projects', payload: { templateSlug: 't' } });
    projectId = (created.json() as { id: number }).id;
  });

  afterEach(async () => {
    await app.close();
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('saves values and a reload returns them', async () => {
    const put = await app.inject({
      method: 'PUT',
      url: `/projects/${projectId}/values`,
      payload: { values: [{ elementId, key: 'headline', value: 'VOTE TUESDAY' }] },
    });
    expect(put.statusCode).toBe(200);

    const get = await app.inject({ method: 'GET', url: `/projects/${projectId}` });
    const values = (get.json() as { values: { key: string; value: unknown }[] }).values;
    expect(values.find((v) => v.key === 'headline')!.value).toBe('VOTE TUESDAY');
    // untouched values survive
    expect(values.find((v) => v.key === 'accent')!.value).toBe('#FF0000');
  });

  it('bumps updated_at', async () => {
    const before = db.getProject(projectId)!.updatedAt;
    db.prepare(`UPDATE project SET updated_at = '2000-01-01 00:00:00' WHERE id = ?`).run(projectId);
    await app.inject({ method: 'PUT', url: `/projects/${projectId}/values`, payload: { values: [{ elementId, key: 'accent', value: '#000000' }] } });
    const after = db.getProject(projectId)!.updatedAt;
    expect(after).not.toBe('2000-01-01 00:00:00');
    expect(after >= before).toBe(true);
  });

  it('is 404 for a missing project and 400 for a bad body', async () => {
    expect((await app.inject({ method: 'PUT', url: `/projects/999/values`, payload: { values: [] } })).statusCode).toBe(404);
    expect((await app.inject({ method: 'PUT', url: `/projects/${projectId}/values`, payload: { nope: 1 } })).statusCode).toBe(400);
  });
});
