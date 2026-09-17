import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app';
import { openDb, type Db } from './db/index';
import { buildProjectProps } from './renderProject';

/** M52: a spot has a fixed length. A template's spot takes the template's; a spot from nothing is a :30; PATCH changes it; the render props carry it. */
describe('spot length (M52)', () => {
  let tmp: string;
  let db: Db;
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-len-'));
    const dir = path.join(tmp, 't', 'elements', 'open');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'schema.json'), '[]');
    fs.writeFileSync(path.join(dir, 'template.json'), JSON.stringify({ fr: 30, ip: 0, op: 450, w: 1920, h: 1080, layers: [] }));
    db = openDb(':memory:');
    const t = db.upsertTemplate({ slug: 't', name: 'T', adType: 'Bio', durationFrames: 450, fps: 30, width: 1920, height: 1080, thumbPath: '' });
    db.upsertTemplateElement({ templateId: t.id, slug: 'open', zIndex: 0, startFrame: 0, endFrame: 450 });
    app = buildApp({ db, templatesDir: tmp });
  });

  afterEach(async () => {
    await app.close();
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('takes the template\'s length, 30 for a spot from nothing, and PATCH sets it within 1 to 120', async () => {
    const fromTemplate = ((await app.inject({ method: 'POST', url: '/projects', payload: { templateSlug: 't' } })).json() as { id: number }).id;
    const fromNothing = ((await app.inject({ method: 'POST', url: '/projects', payload: { templateSlug: 'blank' } })).json() as { id: number }).id;
    expect(db.getProject(fromTemplate)!.lengthS).toBe(15);
    expect(db.getProject(fromNothing)!.lengthS).toBe(30);
    expect(((await app.inject({ method: 'GET', url: `/projects/${fromTemplate}` })).json() as { project: { lengthS: number } }).project.lengthS).toBe(15);
    expect((await app.inject({ method: 'PATCH', url: `/projects/${fromTemplate}`, payload: { lengthS: 30 } })).statusCode).toBe(200);
    expect(db.getProject(fromTemplate)!.lengthS).toBe(30);
    expect((await app.inject({ method: 'PATCH', url: `/projects/${fromTemplate}`, payload: { lengthS: 0 } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'PATCH', url: `/projects/${fromTemplate}`, payload: { lengthS: 7.5 } })).statusCode).toBe(400);
    const copy = ((await app.inject({ method: 'POST', url: `/projects/${fromTemplate}/duplicate` })).json() as { id: number }).id;
    expect(db.getProject(copy)!.lengthS).toBe(30);
    expect(buildProjectProps({ db, templatesDir: tmp, projectId: fromTemplate, serverBase: 'http://x' }).lengthFrames).toBe(900);
  });
});
