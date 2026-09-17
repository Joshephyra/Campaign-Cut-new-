import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app';
import { openDb, type Db } from './db/index';

/**
 * M32: one change recolours every scene. POST /projects/:id/style writes a
 * colour into every element that carries that colour role; the values are
 * ordinary project values afterwards, so both runners are untouched.
 */
const lottie = { fr: 30, ip: 0, op: 150, w: 1920, h: 1080, layers: [] };
const schemaOf = (roles: string[]) => roles.map((role) => ({ key: role, role, kind: 'color', label: `${role} colour`, default: '#000000', path: `/layers/0` }));

describe('style and themes routes (M32)', () => {
  let tmp: string;
  let db: Db;
  let app: ReturnType<typeof buildApp>;
  let projectId: number;
  let open: number;
  let card: number;

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-style-'));
    for (const [el, roles] of [
      ['open', ['accent', 'surface']],
      ['end-card', ['accent']],
    ] as const) {
      const dir = path.join(tmp, 't', 'elements', el);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'schema.json'), JSON.stringify(schemaOf([...roles])));
      fs.writeFileSync(path.join(dir, 'template.json'), JSON.stringify(lottie));
    }
    db = openDb(':memory:');
    const t = db.upsertTemplate({ slug: 't', name: 'T', adType: 'Bio', durationFrames: 300, fps: 30, width: 1920, height: 1080, thumbPath: '' });
    open = db.upsertTemplateElement({ templateId: t.id, slug: 'open', zIndex: 0, startFrame: 0, endFrame: 150 }).id;
    card = db.upsertTemplateElement({ templateId: t.id, slug: 'end-card', zIndex: 0, startFrame: 150, endFrame: 300 }).id;
    app = buildApp({ db, templatesDir: tmp });
    projectId = ((await app.inject({ method: 'POST', url: '/projects', payload: { templateSlug: 't' } })).json() as { id: number }).id;
  });

  afterEach(async () => {
    await app.close();
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('POST /projects/:id/style writes a colour into every element with that role and answers the values written', async () => {
    const res = await app.inject({ method: 'POST', url: `/projects/${projectId}/style`, payload: { colors: { accent: '#1d4ed8', nonsense: '#FFFFFF' } } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      values: expect.arrayContaining([
        { elementId: open, key: 'accent', value: '#1D4ED8' },
        { elementId: card, key: 'accent', value: '#1D4ED8' },
      ]),
    });
    expect((res.json() as { values: unknown[] }).values).toHaveLength(2);
    const detail = (await app.inject({ method: 'GET', url: `/projects/${projectId}` })).json() as { values: { elementId: number; key: string; value: unknown }[] };
    expect(detail.values.filter((v) => v.key === 'accent').map((v) => v.value)).toEqual(['#1D4ED8', '#1D4ED8']);
    expect(detail.values.find((v) => v.elementId === open && v.key === 'surface')!.value).toBe('#000000');
  });

  it('rejects a colour that is not #rrggbb, naming the role', async () => {
    const res = await app.inject({ method: 'POST', url: `/projects/${projectId}/style`, payload: { colors: { accent: 'blue' } } });
    expect(res.statusCode).toBe(400);
    expect((res.json() as { error: string }).error).toMatch(/accent/);
    expect((await app.inject({ method: 'POST', url: `/projects/999/style`, payload: { colors: {} } })).statusCode).toBe(404);
  });

  it('themes: POST saves, GET lists, DELETE removes; a theme needs a name and #rrggbb colours', async () => {
    const created = await app.inject({ method: 'POST', url: '/themes', payload: { name: 'Union blue', colors: { accent: '#1D4ED8', surface: '#0b1220' } } });
    expect(created.statusCode).toBe(201);
    const theme = created.json() as { id: number; name: string; colors: Record<string, string> };
    expect(theme).toMatchObject({ name: 'Union blue', colors: { accent: '#1D4ED8', surface: '#0B1220' } });
    expect((await app.inject({ method: 'GET', url: '/themes' })).json()).toEqual([expect.objectContaining({ id: theme.id, name: 'Union blue' })]);
    expect((await app.inject({ method: 'POST', url: '/themes', payload: { name: '', colors: { accent: '#1D4ED8' } } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/themes', payload: { name: 'Bad', colors: { accent: 'red' } } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'DELETE', url: `/themes/${theme.id}` })).statusCode).toBe(200);
    expect((await app.inject({ method: 'DELETE', url: `/themes/${theme.id}` })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/themes' })).json()).toEqual([]);
  });
});
