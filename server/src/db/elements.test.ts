import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from './index';

describe('per-project element timing', () => {
  let db: Db;
  let templateId: number;
  let projectId: number;
  let open: number;
  let card: number;

  beforeEach(() => {
    db = openDb(':memory:');
    templateId = db.upsertTemplate({ slug: 't', name: 'T', adType: 'Bio', durationFrames: 300, fps: 30, width: 1920, height: 1080, thumbPath: '' }).id;
    open = db.upsertTemplateElement({ templateId, slug: 'open', zIndex: 0, startFrame: 0, endFrame: 150 }).id;
    card = db.upsertTemplateElement({ templateId, slug: 'end-card', zIndex: 1, startFrame: 150, endFrame: 300 }).id;
    projectId = db.createProject({ templateId, name: 'P', values: [] }).id;
  });

  afterEach(() => db.close());

  it('starts from the template defaults, all enabled', () => {
    expect(db.getProjectElements(projectId)).toEqual([
      { id: open, slug: 'open', name: 'open', type: 'overlay', templateSlug: 't', added: false, zIndex: 0, startFrame: 0, endFrame: 150, enabled: true },
      { id: card, slug: 'end-card', name: 'end-card', type: 'overlay', templateSlug: 't', added: false, zIndex: 1, startFrame: 150, endFrame: 300, enabled: true },
    ]);
  });

  it('stores an in/out move and a toggle per project without touching the template', () => {
    db.setProjectElement(projectId, card, { startFrame: 120, endFrame: 270 });
    db.setProjectElement(projectId, open, { enabled: false });
    expect(db.getProjectElements(projectId)).toEqual([
      { id: open, slug: 'open', name: 'open', type: 'overlay', templateSlug: 't', added: false, zIndex: 0, startFrame: 0, endFrame: 150, enabled: false },
      { id: card, slug: 'end-card', name: 'end-card', type: 'overlay', templateSlug: 't', added: false, zIndex: 1, startFrame: 120, endFrame: 270, enabled: true },
    ]);
    expect(db.listTemplateElements(templateId).find((e) => e.id === card)!.startFrame).toBe(150);

    const other = db.createProject({ templateId, name: 'Q', values: [] }).id;
    expect(db.getProjectElements(other).every((e) => e.enabled)).toBe(true);
  });

  it('a partial patch keeps the other fields', () => {
    db.setProjectElement(projectId, card, { startFrame: 100 });
    db.setProjectElement(projectId, card, { enabled: false });
    expect(db.getProjectElements(projectId)[1]).toMatchObject({ startFrame: 100, endFrame: 300, enabled: false });
  });
});
