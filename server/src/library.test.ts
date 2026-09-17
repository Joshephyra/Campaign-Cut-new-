import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app';
import { openDb, type Db } from './db/index';
import { buildProjectProps } from './renderProject';

/**
 * M31: the element library over HTTP, and a project made of elements from
 * more than one template: files resolve per element, fonts merge.
 */
const lottie = (op: number) => ({ fr: 30, ip: 0, op, w: 1920, h: 1080, layers: [{ ty: 5, nm: 'cc.headline', t: { d: { k: [{ s: { t: 'X', f: 'Plex', s: 10 }, t: 0 }] } } }] });
const schema = (key: string, dflt: string) => [{ key, role: key, kind: 'text', label: key, default: dflt, path: '/layers/0' }];

describe('element library routes (M31)', () => {
  let tmp: string;
  let db: Db;
  let app: ReturnType<typeof buildApp>;
  let projectId: number;
  let bioOpen: number;
  let contrastLower: number;

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-lib-'));
    const element = (template: string, el: string, key: string, op: number) => {
      const dir = path.join(tmp, template, 'elements', el);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'schema.json'), JSON.stringify(schema(key, `${el} default`)));
      fs.writeFileSync(path.join(dir, 'template.json'), JSON.stringify(lottie(op)));
    };
    element('bio', 'open', 'headline', 150);
    element('contrast', 'lower-third', 'subhead', 150);
    fs.writeFileSync(path.join(tmp, 'bio', 'meta.json'), JSON.stringify({ fontFiles: [{ family: 'Plex', style: 'Regular', file: 'Plex.ttf' }], background: '#111111' }));
    fs.writeFileSync(path.join(tmp, 'contrast', 'meta.json'), JSON.stringify({ fontFiles: [{ family: 'Arial', style: 'Bold', file: 'Arial-Bold.ttf' }] }));

    db = openDb(':memory:');
    const bio = db.upsertTemplate({ slug: 'bio', name: 'Bio :30', adType: 'Bio', durationFrames: 150, fps: 30, width: 1920, height: 1080, thumbPath: 'templates/bio/thumb.png' });
    const contrast = db.upsertTemplate({ slug: 'contrast', name: 'Contrast :30', adType: 'Contrast', durationFrames: 300, fps: 30, width: 1920, height: 1080, thumbPath: 'templates/contrast/thumb.png' });
    bioOpen = db.upsertTemplateElement({ templateId: bio.id, slug: 'open', name: 'Open', type: 'open', zIndex: 0, startFrame: 0, endFrame: 150 }).id;
    contrastLower = db.upsertTemplateElement({ templateId: contrast.id, slug: 'lower-third', name: 'Lower third', type: 'lower-third', zIndex: 1, startFrame: 90, endFrame: 240 }).id;
    app = buildApp({ db, templatesDir: tmp });
    projectId = ((await app.inject({ method: 'POST', url: '/projects', payload: { templateSlug: 'bio' } })).json() as { id: number }).id;
  });

  afterEach(async () => {
    await app.close();
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('GET /elements lists every template\'s elements, typed, with the template and its thumbnail URL', async () => {
    const res = await app.inject({ method: 'GET', url: '/elements' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([
      {
        id: bioOpen, slug: 'open', name: 'Open', type: 'open', durationInFrames: 150, templateId: expect.any(Number), templateSlug: 'bio', templateName: 'Bio :30', thumbUrl: '/templates/bio/thumb.png',
        // M37: enough to draw a preview of the element with the user's copy
        lottieUrl: '/templates/bio/elements/open/template.json',
        schema: [expect.objectContaining({ key: 'headline' })],
        fontFiles: [{ family: 'Plex', style: 'Regular', file: 'Plex.ttf', templateSlug: 'bio' }],
      },
      {
        id: contrastLower, slug: 'lower-third', name: 'Lower third', type: 'lower-third', durationInFrames: 150, templateId: expect.any(Number), templateSlug: 'contrast', templateName: 'Contrast :30', thumbUrl: '/templates/contrast/thumb.png',
        lottieUrl: '/templates/contrast/elements/lower-third/template.json',
        schema: [expect.objectContaining({ key: 'subhead' })],
        fontFiles: [{ family: 'Arial', style: 'Bold', file: 'Arial-Bold.ttf', templateSlug: 'contrast' }],
      },
    ]);
  });

  it('POST adds a library element at a frame with its schema defaults, and the project reports it from its own template', async () => {
    const res = await app.inject({ method: 'POST', url: `/projects/${projectId}/elements`, payload: { elementId: contrastLower, startFrame: 30 } });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ id: contrastLower, slug: 'lower-third', type: 'lower-third', templateSlug: 'contrast', startFrame: 30, endFrame: 180, added: true, lottieUrl: '/templates/contrast/elements/lower-third/template.json' });
    expect((res.json() as { schema: { key: string }[] }).schema.map((p) => p.key)).toEqual(['subhead']);

    const detail = (await app.inject({ method: 'GET', url: `/projects/${projectId}` })).json() as { elements: { slug: string; templateSlug: string; added: boolean }[]; values: { elementId: number; key: string; value: unknown }[]; meta: { fontFiles: unknown[] } };
    expect(detail.elements.map((e) => [e.slug, e.templateSlug, e.added])).toEqual([
      ['open', 'bio', false],
      ['lower-third', 'contrast', true],
    ]);
    expect(detail.values).toContainEqual({ elementId: contrastLower, key: 'subhead', value: 'lower-third default' });
    // fonts from both templates, each file against its own template
    expect(detail.meta.fontFiles).toEqual([
      { family: 'Plex', style: 'Regular', file: 'Plex.ttf', templateSlug: 'bio' },
      { family: 'Arial', style: 'Bold', file: 'Arial-Bold.ttf', templateSlug: 'contrast' },
    ]);
  });

  it('the export runner builds each element from its own template and merges the fonts', async () => {
    await app.inject({ method: 'POST', url: `/projects/${projectId}/elements`, payload: { elementId: contrastLower, startFrame: 30 } });
    const props = buildProjectProps({ db, templatesDir: tmp, projectId, serverBase: 'http://x' });
    expect(props.elements.map((e) => e.id)).toEqual([String(bioOpen), String(contrastLower)]);
    expect(props.background).toBe('#111111');
    expect(props.fonts).toEqual([
      { family: 'Plex', style: 'Regular', url: 'http://x/templates/bio/fonts/Plex.ttf' },
      { family: 'Arial', style: 'Bold', url: 'http://x/templates/contrast/fonts/Arial-Bold.ttf' },
    ]);
  });

  it('DELETE removes an added element; the spot\'s own elements and unknown ones are refused', async () => {
    await app.inject({ method: 'POST', url: `/projects/${projectId}/elements`, payload: { elementId: contrastLower, startFrame: 30 } });
    expect((await app.inject({ method: 'DELETE', url: `/projects/${projectId}/elements/${bioOpen}` })).statusCode).toBe(400);
    expect((await app.inject({ method: 'DELETE', url: `/projects/${projectId}/elements/999` })).statusCode).toBe(404);
    expect((await app.inject({ method: 'DELETE', url: `/projects/${projectId}/elements/${contrastLower}` })).statusCode).toBe(200);
    const detail = (await app.inject({ method: 'GET', url: `/projects/${projectId}` })).json() as { elements: { slug: string }[] };
    expect(detail.elements.map((e) => e.slug)).toEqual(['open']);
    expect((await app.inject({ method: 'POST', url: `/projects/${projectId}/elements`, payload: { elementId: 999, startFrame: 0 } })).statusCode).toBe(404);
  });
});

/**
 * M45: the same element used twice in one spot. The first use keeps the
 * element's id as its scene id; the second gets a fresh id of its own, with
 * its own values, timing and removal. Duplicates carry both.
 */
describe('an element used twice (M45)', () => {
  let tmp: string;
  let db: Db;
  let app: ReturnType<typeof buildApp>;
  let projectId: number;
  let lower: number;

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-twice-'));
    for (const [template, el, key] of [['bio', 'open', 'headline'], ['contrast', 'lower-third', 'subhead']] as const) {
      const dir = path.join(tmp, template, 'elements', el);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'schema.json'), JSON.stringify(schema(key, `${el} default`)));
      fs.writeFileSync(path.join(dir, 'template.json'), JSON.stringify(lottie(150)));
    }
    db = openDb(':memory:');
    const bio = db.upsertTemplate({ slug: 'bio', name: 'Bio :30', adType: 'Bio', durationFrames: 150, fps: 30, width: 1920, height: 1080, thumbPath: '' });
    const contrast = db.upsertTemplate({ slug: 'contrast', name: 'Contrast :30', adType: 'Contrast', durationFrames: 300, fps: 30, width: 1920, height: 1080, thumbPath: '' });
    db.upsertTemplateElement({ templateId: bio.id, slug: 'open', name: 'Open', type: 'open', zIndex: 0, startFrame: 0, endFrame: 150 });
    lower = db.upsertTemplateElement({ templateId: contrast.id, slug: 'lower-third', name: 'Lower third', type: 'lower-third', zIndex: 1, startFrame: 90, endFrame: 240 }).id;
    app = buildApp({ db, templatesDir: tmp });
    projectId = ((await app.inject({ method: 'POST', url: '/projects', payload: { templateSlug: 'bio' } })).json() as { id: number }).id;
  });

  afterEach(async () => {
    await app.close();
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('a second add makes a second scene with a fresh id and its own values; each is timed, valued and removed on its own', async () => {
    const first = (await app.inject({ method: 'POST', url: `/projects/${projectId}/elements`, payload: { elementId: lower, startFrame: 0 } })).json() as { id: number; elementId: number };
    const second = (await app.inject({ method: 'POST', url: `/projects/${projectId}/elements`, payload: { elementId: lower, startFrame: 300 } })).json() as { id: number; elementId: number; startFrame: number; added: boolean };
    expect(first).toMatchObject({ id: lower, elementId: lower });
    expect(second.id).not.toBe(lower);
    expect(second.id).toBeGreaterThanOrEqual(10_000_000);
    expect(second).toMatchObject({ elementId: lower, startFrame: 300, added: true });

    let detail = (await app.inject({ method: 'GET', url: `/projects/${projectId}` })).json() as { elements: { id: number; elementId: number; slug: string }[]; values: { elementId: number; key: string; value: unknown }[] };
    expect(detail.elements.map((e) => [e.id, e.elementId, e.slug])).toEqual([[expect.any(Number), expect.any(Number), 'open'], [lower, lower, 'lower-third'], [second.id, lower, 'lower-third']]);
    expect(detail.values.filter((v) => v.key === 'subhead').map((v) => v.elementId).sort()).toEqual([lower, second.id].sort());

    // its own words, its own timing, its own transition
    await app.inject({ method: 'PUT', url: `/projects/${projectId}/values`, payload: { values: [{ elementId: second.id, key: 'subhead', value: 'Second' }] } });
    await app.inject({ method: 'PUT', url: `/projects/${projectId}/elements/${second.id}`, payload: { startFrame: 400, endFrame: 550 } });
    await app.inject({ method: 'PUT', url: `/projects/${projectId}/transitions/${second.id}`, payload: { preset: 'fade', durationInFrames: 10 } });
    detail = (await app.inject({ method: 'GET', url: `/projects/${projectId}` })).json() as typeof detail;
    expect(detail.values.find((v) => v.elementId === second.id && v.key === 'subhead')?.value).toBe('Second');
    expect(detail.values.find((v) => v.elementId === lower && v.key === 'subhead')?.value).toBe('lower-third default');
    expect(detail.elements.find((e) => e.id === second.id)).toMatchObject({ startFrame: 400, endFrame: 550 });
    const props = buildProjectProps({ db, templatesDir: tmp, projectId, serverBase: 'http://x' });
    expect(props.elements.map((e) => e.id)).toContain(String(second.id));
    expect(props.transitions).toEqual([{ afterElementId: String(second.id), preset: 'fade', durationInFrames: 10 }]);

    // a duplicate carries both; removing the second leaves the first
    const copy = ((await app.inject({ method: 'POST', url: `/projects/${projectId}/duplicate` })).json() as { id: number }).id;
    expect(db.getProjectElements(copy).filter((e) => e.slug === 'lower-third')).toHaveLength(2);
    expect((await app.inject({ method: 'DELETE', url: `/projects/${projectId}/elements/${second.id}` })).statusCode).toBe(200);
    detail = (await app.inject({ method: 'GET', url: `/projects/${projectId}` })).json() as typeof detail;
    expect(detail.elements.map((e) => e.slug)).toEqual(['open', 'lower-third']);
    expect(detail.values.some((v) => v.elementId === second.id)).toBe(false);
  });

  it('an old database with project_element rows moves them over as scenes', () => {
    // The migration path only shows on a file: build the old shape there, close, reopen.
    const file = path.join(tmp, 'old.db');
    const filed = openDb(file);
    const t = filed.upsertTemplate({ slug: 'old', name: 'Old', adType: 'Bio', durationFrames: 150, fps: 30, width: 1920, height: 1080, thumbPath: '' });
    const el = filed.upsertTemplateElement({ templateId: t.id, slug: 'open', zIndex: 0, startFrame: 0, endFrame: 150 }).id;
    const pid = filed.createProject({ templateId: t.id, name: 'Old spot', values: [] }).id;
    filed.exec(
      `DROP TABLE project_scene; DROP TABLE project_value; DROP TABLE project_transition;
       CREATE TABLE project_value (project_id INTEGER NOT NULL REFERENCES project(id) ON DELETE CASCADE, element_id INTEGER NOT NULL REFERENCES template_element(id), param_key TEXT NOT NULL, value_json TEXT NOT NULL, PRIMARY KEY (project_id, element_id, param_key));
       CREATE TABLE project_transition (project_id INTEGER NOT NULL REFERENCES project(id) ON DELETE CASCADE, after_element_id INTEGER NOT NULL REFERENCES template_element(id), preset TEXT NOT NULL, duration_frames INTEGER NOT NULL, PRIMARY KEY (project_id, after_element_id));
       INSERT INTO project_value VALUES (${pid}, ${el}, 'headline', '"Old"');
       CREATE TABLE project_element (project_id INTEGER NOT NULL, element_id INTEGER NOT NULL, start_frame INTEGER, end_frame INTEGER, enabled INTEGER NOT NULL DEFAULT 1, PRIMARY KEY (project_id, element_id));
       INSERT INTO project_element VALUES (${pid}, ${el}, 30, 90, 0)`,
    );
    filed.close();
    const reopened = openDb(file);
    expect(reopened.prepare(`SELECT project_id, scene_id, element_id, start_frame, end_frame, enabled FROM project_scene`).all()).toEqual([
      { project_id: pid, scene_id: el, element_id: el, start_frame: 30, end_frame: 90, enabled: 0 },
    ]);
    expect(reopened.prepare(`SELECT name FROM sqlite_master WHERE name = 'project_element'`).get()).toBeUndefined();
    expect(reopened.getProjectElements(pid)).toMatchObject([{ id: el, elementId: el, startFrame: 30, endFrame: 90, enabled: false, added: false }]);
    // the old value and transition tables referenced template_element; a second use of an element must be storable
    expect((reopened.prepare(`PRAGMA foreign_key_list(project_value)`).all() as { table: string }[]).some((r) => r.table === 'template_element')).toBe(false);
    reopened.setProjectValues(pid, [{ elementId: 10_000_001, key: 'headline', value: 'Fresh' }]);
    reopened.setProjectTransition(pid, 10_000_001, { preset: 'fade', durationInFrames: 10 });
    expect(reopened.getProject(pid)!.values).toContainEqual({ elementId: 10_000_001, key: 'headline', value: 'Fresh' });
    reopened.close();
  });
});
