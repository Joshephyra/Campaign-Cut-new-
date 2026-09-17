import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from './index';

/** M32: a saved theme is a name and a set of colours by role, kept in the library. */
describe('themes (M32)', () => {
  let db: Db;
  beforeEach(() => {
    db = openDb(':memory:');
  });
  afterEach(() => db.close());

  it('saves, lists newest first, and deletes', () => {
    const a = db.insertTheme({ name: 'Union blue', colors: { accent: '#1D4ED8', surface: '#0B1220' } }).id;
    const b = db.insertTheme({ name: 'Sunrise', colors: { accent: '#F59E0B' } }).id;
    expect(db.listThemes()).toEqual([
      { id: b, name: 'Sunrise', colors: { accent: '#F59E0B' }, createdAt: expect.any(String) },
      { id: a, name: 'Union blue', colors: { accent: '#1D4ED8', surface: '#0B1220' }, createdAt: expect.any(String) },
    ]);
    expect(db.deleteTheme(a)).toBe(true);
    expect(db.deleteTheme(a)).toBe(false);
    expect(db.listThemes().map((t) => t.id)).toEqual([b]);
  });
});
