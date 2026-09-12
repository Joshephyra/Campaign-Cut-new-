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

function addTemplate(db: Db, templatesDir: string, slug: string, name: string, adType: string) {
  const dir = path.join(templatesDir, slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'schema.json'), JSON.stringify(schema));
  fs.writeFileSync(path.join(dir, 'template.json'), JSON.stringify({ fr: 30, ip: 0, op: 150, w: 1920, h: 1080, layers: [] }));
  fs.writeFileSync(path.join(dir, 'thumb.png'), 'PNG');
  const { id } = db.upsertTemplate({
    slug,
    name,
    adType,
    durationFrames: 150,
    fps: 30,
    width: 1920,
    height: 1080,
    thumbPath: `templates/${slug}/thumb.png`,
  });
  db.upsertTemplateElement({ templateId: id, slug, zIndex: 0, startFrame: 0, endFrame: 150 });
  return id;
}

describe('templates and projects API', () => {
  let tmp: string;
  let db: Db;
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-routes-'));
    db = openDb(':memory:');
    addTemplate(db, tmp, 'gotv-1', 'Turnout Push', 'GOTV');
    addTemplate(db, tmp, 'contrast-b', 'Split Record', 'Contrast');
    addTemplate(db, tmp, 'contrast-a', 'Head to Head', 'Contrast');
    app = buildApp({ db, templatesDir: tmp });
  });

  afterEach(async () => {
    await app.close();
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('GET /templates groups by ad type in sort order, templates by name', async () => {
    const res = await app.inject({ method: 'GET', url: '/templates' });
    expect(res.statusCode).toBe(200);
    const groups = res.json() as { adType: string; templates: { slug: string; name: string; thumbUrl: string; durationFrames: number }[] }[];
    expect(groups.map((g) => g.adType)).toEqual(['Contrast', 'GOTV']);
    expect(groups[0]!.templates.map((t) => t.name)).toEqual(['Head to Head', 'Split Record']);
    expect(groups[1]!.templates[0]).toMatchObject({ slug: 'gotv-1', durationFrames: 150, thumbUrl: '/templates/gotv-1/thumb.png' });
  });

  it('GET /templates/:slug returns meta, schema and elements', async () => {
    const res = await app.inject({ method: 'GET', url: '/templates/contrast-a' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { template: { slug: string }; schema: unknown[]; elements: { slug: string }[] };
    expect(body.template.slug).toBe('contrast-a');
    expect(body.schema).toEqual(schema);
    expect(body.elements).toHaveLength(1);
  });

  it('GET /templates/:slug is 404 for an unknown slug', async () => {
    const res = await app.inject({ method: 'GET', url: '/templates/nope' });
    expect(res.statusCode).toBe(404);
  });

  it('serves template files statically', async () => {
    const res = await app.inject({ method: 'GET', url: '/templates/contrast-a/template.json' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ w: 1920 });
  });

  it('POST /projects copies the schema defaults into project_value and returns the id', async () => {
    const res = await app.inject({ method: 'POST', url: '/projects', payload: { templateSlug: 'contrast-a' } });
    expect(res.statusCode).toBe(201);
    const { id } = res.json() as { id: number };

    const project = db.getProject(id)!;
    expect(project.name).toMatch(/Head to Head/);
    expect(project.values.map((v) => [v.key, v.value])).toEqual([
      ['accent', '#FF0000'],
      ['headline', 'Hello'],
    ]);
  });

  it('POST /projects is 404 for an unknown template', async () => {
    const res = await app.inject({ method: 'POST', url: '/projects', payload: { templateSlug: 'nope' } });
    expect(res.statusCode).toBe(404);
  });

  it('GET /projects/:id returns the project with template, schema and values', async () => {
    const created = await app.inject({ method: 'POST', url: '/projects', payload: { templateSlug: 'gotv-1', name: 'Tuesday' } });
    const { id } = created.json() as { id: number };
    const res = await app.inject({ method: 'GET', url: `/projects/${id}` });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { project: { name: string }; template: { slug: string }; schema: unknown[]; values: unknown[] };
    expect(body.project.name).toBe('Tuesday');
    expect(body.template.slug).toBe('gotv-1');
    expect(body.schema).toHaveLength(2);
    expect(body.values).toHaveLength(2);
  });

  it('GET /projects lists projects', async () => {
    await app.inject({ method: 'POST', url: '/projects', payload: { templateSlug: 'gotv-1' } });
    const res = await app.inject({ method: 'GET', url: '/projects' });
    expect(res.json()).toHaveLength(1);
  });
});
