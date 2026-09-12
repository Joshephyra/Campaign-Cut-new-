import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AD_TYPES, openDb, type Db } from './index';

describe('database', () => {
  let db: Db;

  beforeEach(() => {
    db = openDb(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  it('creates the ad_type and template tables', () => {
    const names = db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`)
      .all()
      .map((r) => (r as { name: string }).name);
    expect(names).toContain('ad_type');
    expect(names).toContain('template');
  });

  it('seeds the five ad types in SPEC order', () => {
    const rows = db.prepare(`SELECT name, sort FROM ad_type ORDER BY sort`).all() as { name: string; sort: number }[];
    expect(rows.map((r) => r.name)).toEqual([...AD_TYPES]);
    expect(rows.map((r) => r.sort)).toEqual([1, 2, 3, 4, 5]);
  });

  it('is idempotent: opening twice does not duplicate seeds', () => {
    const again = openDb(':memory:');
    again.close();
    const count = (db.prepare(`SELECT COUNT(*) AS n FROM ad_type`).get() as { n: number }).n;
    expect(count).toBe(5);
  });

  it('upserts a template by slug', () => {
    const first = db.upsertTemplate({
      slug: 'demo',
      name: 'Demo',
      adType: 'Contrast',
      durationFrames: 150,
      fps: 30,
      width: 1920,
      height: 1080,
      thumbPath: 'templates/demo/thumb.png',
    });
    const second = db.upsertTemplate({
      slug: 'demo',
      name: 'Demo renamed',
      adType: 'Bio',
      durationFrames: 90,
      fps: 24,
      width: 1920,
      height: 1080,
      thumbPath: 'templates/demo/thumb.png',
    });
    expect(second.id).toBe(first.id);
    const rows = db.listTemplates();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.name).toBe('Demo renamed');
    expect(rows[0]!.adType).toBe('Bio');
    expect(rows[0]!.durationFrames).toBe(90);
  });

  it('creates an unknown ad type on demand, appended after the seeds', () => {
    db.upsertTemplate({
      slug: 'x',
      name: 'X',
      adType: 'Fundraising',
      durationFrames: 1,
      fps: 30,
      width: 1920,
      height: 1080,
      thumbPath: '',
    });
    const rows = db.prepare(`SELECT name, sort FROM ad_type ORDER BY sort`).all() as { name: string; sort: number }[];
    expect(rows[5]).toEqual({ name: 'Fundraising', sort: 6 });
  });
});
