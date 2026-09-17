import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from './index';

/**
 * M31: elements are a library. Every template's elements are typed and
 * listable together; a project can add any of them, from any template, and
 * remove the ones it added. The spot's own elements stay put.
 */
describe('element library (M31)', () => {
  let db: Db;
  let bio: number;
  let contrast: number;
  let bioOpen: number;
  let contrastLower: number;
  let projectId: number;

  beforeEach(() => {
    db = openDb(':memory:');
    bio = db.upsertTemplate({ slug: 'bio', name: 'Bio :30', adType: 'Bio', durationFrames: 300, fps: 30, width: 1920, height: 1080, thumbPath: 'templates/bio/thumb.png' }).id;
    contrast = db.upsertTemplate({ slug: 'contrast', name: 'Contrast :30', adType: 'Contrast', durationFrames: 900, fps: 30, width: 1920, height: 1080, thumbPath: 'templates/contrast/thumb.png' }).id;
    bioOpen = db.upsertTemplateElement({ templateId: bio, slug: 'open', name: 'Open', type: 'open', zIndex: 0, startFrame: 0, endFrame: 150 }).id;
    db.upsertTemplateElement({ templateId: bio, slug: 'end-card', name: 'End card', type: 'end-card', zIndex: 1, startFrame: 150, endFrame: 300 });
    contrastLower = db.upsertTemplateElement({ templateId: contrast, slug: 'lower-third', name: 'Lower third', type: 'lower-third', zIndex: 1, startFrame: 90, endFrame: 240 }).id;
    projectId = db.createProject({ templateId: bio, name: 'P', values: [] }).id;
  });

  afterEach(() => db.close());

  it('gives every element a type (overlay when none was given) and keeps it on re-upsert', () => {
    const untyped = db.upsertTemplateElement({ templateId: bio, slug: 'sparkle', zIndex: 2, startFrame: 0, endFrame: 30 }).id;
    expect(db.listTemplateElements(bio).find((e) => e.id === untyped)!.type).toBe('overlay');
    db.upsertTemplateElement({ templateId: bio, slug: 'open', name: 'Open', type: 'open', zIndex: 0, startFrame: 0, endFrame: 150 });
    expect(db.listTemplateElements(bio).find((e) => e.id === bioOpen)!.type).toBe('open');
    const columns = (db.prepare(`PRAGMA table_info(template_element)`).all() as { name: string }[]).map((c) => c.name);
    expect(columns).toContain('type');
  });

  it('lists the library across templates with each element\'s template and type', () => {
    expect(db.listLibraryElements()).toEqual([
      { id: bioOpen, slug: 'open', name: 'Open', type: 'open', durationInFrames: 150, templateId: bio, templateSlug: 'bio', templateName: 'Bio :30', thumbPath: 'templates/bio/thumb.png' },
      { id: expect.any(Number), slug: 'end-card', name: 'End card', type: 'end-card', durationInFrames: 150, templateId: bio, templateSlug: 'bio', templateName: 'Bio :30', thumbPath: 'templates/bio/thumb.png' },
      { id: contrastLower, slug: 'lower-third', name: 'Lower third', type: 'lower-third', durationInFrames: 150, templateId: contrast, templateSlug: 'contrast', templateName: 'Contrast :30', thumbPath: 'templates/contrast/thumb.png' },
    ]);
  });

  it('a project\'s elements carry their template; adding a library element places it at a frame with its authored length', () => {
    const before = db.getProjectElements(projectId);
    expect(before.map((e) => [e.slug, e.templateSlug, e.type, e.added])).toEqual([
      ['open', 'bio', 'open', false],
      ['end-card', 'bio', 'end-card', false],
    ]);

    db.addProjectElement(projectId, contrastLower, 60);
    const after = db.getProjectElements(projectId);
    expect(after.find((e) => e.id === contrastLower)).toEqual({
      id: contrastLower,
      elementId: contrastLower,
      slug: 'lower-third',
      name: 'Lower third',
      type: 'lower-third',
      templateSlug: 'contrast',
      zIndex: 1,
      startFrame: 60,
      endFrame: 210,
      enabled: true,
      added: true,
    });
    expect(after).toHaveLength(3);
  });

  it('adding the same element twice is one element; timing patches apply to added elements too', () => {
    db.addProjectElement(projectId, contrastLower, 60);
    db.addProjectElement(projectId, contrastLower, 90);
    expect(db.getProjectElements(projectId).filter((e) => e.id === contrastLower)).toHaveLength(1);
    db.setProjectElement(projectId, contrastLower, { startFrame: 100, endFrame: 250 });
    expect(db.getProjectElements(projectId).find((e) => e.id === contrastLower)).toMatchObject({ startFrame: 100, endFrame: 250 });
  });

  it('removes an added element with its values, refuses to remove the spot\'s own elements, and duplicates copy added ones', () => {
    db.addProjectElement(projectId, contrastLower, 60);
    db.setProjectValues(projectId, [{ elementId: contrastLower, key: 'subhead', value: 'Hi' }]);
    expect(db.removeProjectElement(projectId, bioOpen)).toBe(false);
    expect(db.getProjectElements(projectId)).toHaveLength(3);

    const copy = db.duplicateProject(projectId, 'Copy').id;
    expect(db.getProjectElements(copy).map((e) => e.slug)).toEqual(['open', 'end-card', 'lower-third']);

    expect(db.removeProjectElement(projectId, contrastLower)).toBe(true);
    expect(db.getProjectElements(projectId).map((e) => e.slug)).toEqual(['open', 'end-card']);
    expect(db.getProject(projectId)!.values.find((v) => v.elementId === contrastLower)).toBeUndefined();
    expect(db.getProjectElements(copy)).toHaveLength(3);
  });
});
