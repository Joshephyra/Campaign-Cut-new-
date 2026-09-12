import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from './index';

const templateInput = {
  slug: 'standin',
  name: 'Stand-in',
  adType: 'Contrast',
  durationFrames: 150,
  fps: 30,
  width: 1920,
  height: 1080,
  thumbPath: 'templates/standin/thumb.png',
};

describe('template elements, projects and values', () => {
  let db: Db;
  let templateId: number;
  let elementId: number;

  beforeEach(() => {
    db = openDb(':memory:');
    templateId = db.upsertTemplate(templateInput).id;
    elementId = db.upsertTemplateElement({ templateId, slug: 'standin', zIndex: 0, startFrame: 0, endFrame: 150 }).id;
  });

  afterEach(() => db.close());

  it('creates the template_element, project and project_value tables', () => {
    const names = db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`)
      .all()
      .map((r) => (r as { name: string }).name);
    expect(names).toEqual(expect.arrayContaining(['template_element', 'project', 'project_value']));
  });

  it('upserts an element by (template, slug) and lists them in z order', () => {
    const again = db.upsertTemplateElement({ templateId, slug: 'standin', zIndex: 0, startFrame: 0, endFrame: 120 });
    expect(again.id).toBe(elementId);
    db.upsertTemplateElement({ templateId, slug: 'lower-third', zIndex: 2, startFrame: 30, endFrame: 90 });
    db.upsertTemplateElement({ templateId, slug: 'end-card', zIndex: 1, startFrame: 120, endFrame: 150 });
    const elements = db.listTemplateElements(templateId);
    expect(elements.map((e) => [e.slug, e.zIndex, e.endFrame])).toEqual([
      ['standin', 0, 120],
      ['end-card', 1, 150],
      ['lower-third', 2, 90],
    ]);
  });

  it('creates a project with initial values and reads it back', () => {
    const { id } = db.createProject({
      templateId,
      name: 'My spot',
      values: [
        { elementId, key: 'headline', value: 'STAND-IN HEADLINE' },
        { elementId, key: 'accent', value: '#F05929' },
      ],
    });
    const project = db.getProject(id)!;
    expect(project.name).toBe('My spot');
    expect(project.templateId).toBe(templateId);
    expect(project.templateSlug).toBe('standin');
    expect(project.values).toEqual([
      { elementId, key: 'accent', value: '#F05929' },
      { elementId, key: 'headline', value: 'STAND-IN HEADLINE' },
    ]);
  });

  it('stores any JSON value, not just strings', () => {
    const { id } = db.createProject({ templateId, name: 'x', values: [{ elementId, key: 'n', value: { a: 1, b: [true] } }] });
    expect(db.getProject(id)!.values[0]!.value).toEqual({ a: 1, b: [true] });
  });

  it('returns undefined for a missing project', () => {
    expect(db.getProject(999)).toBeUndefined();
  });

  it('lists projects newest first', () => {
    const a = db.createProject({ templateId, name: 'first', values: [] }).id;
    const b = db.createProject({ templateId, name: 'second', values: [] }).id;
    expect(db.listProjects().map((p) => p.id)).toEqual([b, a]);
  });
});
