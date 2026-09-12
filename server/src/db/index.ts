import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

/** SPEC.md section 3. No user table. No workspace table. No permissions table. */
export const AD_TYPES = ['Contrast', 'Bio', 'Issue', 'GOTV', 'Endorsement'] as const;

export type TemplateInput = {
  slug: string;
  name: string;
  adType: string;
  durationFrames: number;
  fps: number;
  width: number;
  height: number;
  thumbPath: string;
};

export type TemplateRow = TemplateInput & { id: number; adTypeSort: number };

export type Db = Database.Database & {
  upsertTemplate(t: TemplateInput): { id: number };
  listTemplates(): TemplateRow[];
};

const MIGRATIONS = `
CREATE TABLE IF NOT EXISTS ad_type (
  id    INTEGER PRIMARY KEY,
  name  TEXT    NOT NULL UNIQUE,
  sort  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS template (
  id              INTEGER PRIMARY KEY,
  slug            TEXT    NOT NULL UNIQUE,
  name            TEXT    NOT NULL,
  ad_type_id      INTEGER NOT NULL REFERENCES ad_type(id),
  duration_frames INTEGER NOT NULL,
  fps             INTEGER NOT NULL,
  width           INTEGER NOT NULL,
  height          INTEGER NOT NULL,
  thumb_path      TEXT    NOT NULL DEFAULT '',
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);
`;

/**
 * Open (creating if needed) the SQLite database, apply migrations, and
 * seed the ad types. Safe to call repeatedly. Pass ':memory:' for tests.
 */
export function openDb(file: string): Db {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('foreign_keys = ON');
  if (file !== ':memory:') db.pragma('journal_mode = WAL');
  db.exec(MIGRATIONS);

  const seed = db.prepare(`INSERT OR IGNORE INTO ad_type (name, sort) VALUES (?, ?)`);
  AD_TYPES.forEach((name, i) => seed.run(name, i + 1));

  return Object.assign(db, {
    upsertTemplate: (t: TemplateInput) => upsertTemplate(db, t),
    listTemplates: () => listTemplates(db),
  });
}

function ensureAdType(db: Database.Database, name: string): number {
  const existing = db.prepare(`SELECT id FROM ad_type WHERE name = ?`).get(name) as { id: number } | undefined;
  if (existing) return existing.id;
  const next = (db.prepare(`SELECT COALESCE(MAX(sort), 0) + 1 AS n FROM ad_type`).get() as { n: number }).n;
  const info = db.prepare(`INSERT INTO ad_type (name, sort) VALUES (?, ?)`).run(name, next);
  return Number(info.lastInsertRowid);
}

function upsertTemplate(db: Database.Database, t: TemplateInput): { id: number } {
  const adTypeId = ensureAdType(db, t.adType);
  const row = db
    .prepare(
      `INSERT INTO template (slug, name, ad_type_id, duration_frames, fps, width, height, thumb_path)
       VALUES (@slug, @name, @adTypeId, @durationFrames, @fps, @width, @height, @thumbPath)
       ON CONFLICT(slug) DO UPDATE SET
         name = excluded.name,
         ad_type_id = excluded.ad_type_id,
         duration_frames = excluded.duration_frames,
         fps = excluded.fps,
         width = excluded.width,
         height = excluded.height,
         thumb_path = excluded.thumb_path,
         updated_at = datetime('now')
       RETURNING id`,
    )
    .get({ ...t, adTypeId }) as { id: number };
  return row;
}

function listTemplates(db: Database.Database): TemplateRow[] {
  const rows = db
    .prepare(
      `SELECT t.id, t.slug, t.name, a.name AS adType, a.sort AS adTypeSort,
              t.duration_frames AS durationFrames, t.fps, t.width, t.height, t.thumb_path AS thumbPath
       FROM template t JOIN ad_type a ON a.id = t.ad_type_id
       ORDER BY a.sort, t.name`,
    )
    .all() as TemplateRow[];
  return rows;
}
