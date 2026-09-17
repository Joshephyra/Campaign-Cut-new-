import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BLANK_TEMPLATE, buildApp } from './app';
import { openDb, type Db } from './db/index';
import { buildProjectProps } from './renderProject';

/**
 * M41: a spot from nothing. The blank template exists on every start, is
 * never offered in the grid, and a spot on it has no elements until the
 * library fills it. Nothing else changes: the detail, the render props and
 * the disclaimer rule all take an empty spot in their stride.
 */
describe('a spot from nothing (M41)', () => {
  let tmp: string;
  let db: Db;
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-blank-'));
    db = openDb(':memory:');
    app = buildApp({ db, templatesDir: tmp, mediaDir: path.join(tmp, 'media'), render: async () => {} });
  });

  afterEach(async () => {
    await app.close();
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('the blank template exists, library only, and is not in the grid', async () => {
    expect(db.getTemplateBySlug('blank')).toMatchObject({ slug: 'blank', name: 'Blank spot', libraryOnly: true });
    const groups = (await app.inject({ method: 'GET', url: '/templates' })).json() as { templates: { slug: string }[] }[];
    expect(groups.flatMap((g) => g.templates.map((t) => t.slug))).not.toContain('blank');
    expect((await app.inject({ method: 'GET', url: '/elements' })).json()).toEqual([]);
  });

  it('a spot on it starts with no elements, named "New spot", and reads as a whole', async () => {
    const res = await app.inject({ method: 'POST', url: '/projects', payload: { templateSlug: BLANK_TEMPLATE.slug } });
    expect(res.statusCode).toBe(201);
    const id = (res.json() as { id: number }).id;
    const detail = (await app.inject({ method: 'GET', url: `/projects/${id}` })).json() as { project: { name: string; templateSlug: string }; elements: unknown[]; values: unknown[]; meta: { fontFiles: unknown[] }; frame: { width: number } };
    expect(detail.project).toMatchObject({ name: 'New spot', templateSlug: 'blank' });
    expect(detail.elements).toEqual([]);
    expect(detail.values).toEqual([]);
    expect(detail.meta.fontFiles).toEqual([]);
    expect(detail.frame.width).toBe(1920);
    expect(db.listTemplateElements(db.getTemplateBySlug('blank')!.id)).toEqual([]);
    const props = buildProjectProps({ db, templatesDir: tmp, projectId: id, serverBase: 'http://x' });
    expect(props.elements).toEqual([]);
    expect(props.fonts).toEqual([]);
  });

  it('for a client the spot is named after them, and an empty spot cannot be exported (no disclaimer yet)', async () => {
    const client = (await app.inject({ method: 'POST', url: '/clients', payload: { name: 'Jane for Senate', colors: {} } })).json() as { id: number };
    const id = ((await app.inject({ method: 'POST', url: '/projects', payload: { templateSlug: 'blank', clientId: client.id } })).json() as { id: number }).id;
    expect(db.getProject(id)!.name).toBe('Jane for Senate: New spot');
    const render = await app.inject({ method: 'POST', url: '/render', payload: { projectId: id } });
    expect(render.statusCode).toBe(400);
    expect((render.json() as { error: string }).error).toMatch(/disclaimer/i);
  });
});
