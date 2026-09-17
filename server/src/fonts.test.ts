import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app';
import { openDb, type Db } from './db/index';
import { buildProjectProps } from './renderProject';

const lottie = { fr: 30, ip: 0, op: 30, w: 1920, h: 1080, layers: [] };
const meta = {
  slug: 't', name: 'T', adType: 'Bio', durationInFrames: 30, fps: 30, width: 1920, height: 1080,
  fonts: ['IBM Plex Sans'],
  fontFiles: [{ family: 'IBM Plex Sans', file: 'IBMPlexSans-Regular.ttf' }],
};

describe('template fonts reach both runners', () => {
  let tmp: string;
  let db: Db;
  let app: ReturnType<typeof buildApp>;
  let projectId: number;

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-fonts-api-'));
    fs.mkdirSync(path.join(tmp, 't', 'fonts'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 't', 'template.json'), JSON.stringify(lottie));
    fs.writeFileSync(path.join(tmp, 't', 'schema.json'), '[]');
    fs.writeFileSync(path.join(tmp, 't', 'meta.json'), JSON.stringify(meta));
    fs.writeFileSync(path.join(tmp, 't', 'fonts', 'IBMPlexSans-Regular.ttf'), 'bytes');
    db = openDb(':memory:');
    const t = db.upsertTemplate({ slug: 't', name: 'T', adType: 'Bio', durationFrames: 30, fps: 30, width: 1920, height: 1080, thumbPath: '' });
    db.upsertTemplateElement({ templateId: t.id, slug: 't', zIndex: 0, startFrame: 0, endFrame: 30 });
    app = buildApp({ db, templatesDir: tmp });
    projectId = ((await app.inject({ method: 'POST', url: '/projects', payload: { templateSlug: 't' } })).json() as { id: number }).id;
  });

  afterEach(async () => {
    await app.close();
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('GET /projects/:id includes the template meta with fontFiles, and the font is served with CORS', async () => {
    const detail = (await app.inject({ method: 'GET', url: `/projects/${projectId}` })).json() as { meta: typeof meta };
    expect(detail.meta.fontFiles).toEqual(meta.fontFiles.map((f) => ({ ...f, templateSlug: 't' }))); // M31: each file tagged with its template
    const font = await app.inject({ method: 'GET', url: '/templates/t/fonts/IBMPlexSans-Regular.ttf', headers: { origin: 'http://localhost:5173' } });
    expect(font.statusCode).toBe(200);
    expect(font.headers['access-control-allow-origin']).toBeTruthy();
  });

  it('the export runner gets absolute font URLs', () => {
    const props = buildProjectProps({ db, templatesDir: tmp, projectId, serverBase: 'http://127.0.0.1:3001' });
    expect(props.fonts).toEqual([{ family: 'IBM Plex Sans', url: 'http://127.0.0.1:3001/templates/t/fonts/IBMPlexSans-Regular.ttf' }]);
  });
});
