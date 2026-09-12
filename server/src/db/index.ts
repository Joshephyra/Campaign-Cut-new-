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

export type TemplateElementInput = {
  templateId: number;
  slug: string;
  zIndex: number;
  startFrame: number;
  endFrame: number;
};

export type TemplateElementRow = TemplateElementInput & { id: number };

export type ProjectValue = { elementId: number; key: string; value: unknown };

export type ProjectInput = { templateId: number; name: string; values: ProjectValue[] };

export type ProjectRow = {
  id: number;
  templateId: number;
  templateSlug: string;
  templateName: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type ProjectDetail = ProjectRow & { values: ProjectValue[] };

/** An element as it stands in one project: template defaults with the project's own in/out and toggle applied. */
export type ProjectElement = {
  id: number;
  slug: string;
  zIndex: number;
  startFrame: number;
  endFrame: number;
  enabled: boolean;
};

export type ProjectElementPatch = Partial<Pick<ProjectElement, 'startFrame' | 'endFrame' | 'enabled'>>;

export type MediaAssetInput = {
  originalName: string;
  /** Paths relative to the media directory. */
  originalPath: string;
  proxyPath: string;
  thumbPath: string;
  width: number;
  height: number;
  durationS: number;
  fps: number;
};

export type MediaAssetRow = MediaAssetInput & { id: number; createdAt: string };

export type Db = Database.Database & {
  insertMediaAsset(a: MediaAssetInput): { id: number };
  getMediaAsset(id: number): MediaAssetRow | undefined;
  listMediaAssets(): MediaAssetRow[];
  upsertTemplate(t: TemplateInput): { id: number };
  listTemplates(): TemplateRow[];
  getTemplateBySlug(slug: string): TemplateRow | undefined;
  upsertTemplateElement(e: TemplateElementInput): { id: number };
  listTemplateElements(templateId: number): TemplateElementRow[];
  createProject(p: ProjectInput): { id: number };
  getProject(id: number): ProjectDetail | undefined;
  listProjects(): ProjectRow[];
  /** Upsert the given values (others untouched) and bump updated_at. */
  setProjectValues(projectId: number, values: ProjectValue[]): void;
  /** The project's timeline: template elements with this project's overrides, in z order. */
  getProjectElements(projectId: number): ProjectElement[];
  /** Move or toggle one element in one project. The template is untouched. */
  setProjectElement(projectId: number, elementId: number, patch: ProjectElementPatch): void;
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

CREATE TABLE IF NOT EXISTS template_element (
  id           INTEGER PRIMARY KEY,
  template_id  INTEGER NOT NULL REFERENCES template(id) ON DELETE CASCADE,
  slug         TEXT    NOT NULL,
  z_index      INTEGER NOT NULL DEFAULT 0,
  start_frame  INTEGER NOT NULL DEFAULT 0,
  end_frame    INTEGER NOT NULL,
  UNIQUE (template_id, slug)
);

CREATE TABLE IF NOT EXISTS project (
  id           INTEGER PRIMARY KEY,
  template_id  INTEGER NOT NULL REFERENCES template(id),
  name         TEXT    NOT NULL,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS project_value (
  project_id  INTEGER NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  element_id  INTEGER NOT NULL REFERENCES template_element(id),
  param_key   TEXT    NOT NULL,
  value_json  TEXT    NOT NULL,
  PRIMARY KEY (project_id, element_id, param_key)
);

CREATE TABLE IF NOT EXISTS project_element (
  project_id   INTEGER NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  element_id   INTEGER NOT NULL REFERENCES template_element(id),
  start_frame  INTEGER,
  end_frame    INTEGER,
  enabled      INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (project_id, element_id)
);

CREATE TABLE IF NOT EXISTS media_asset (
  id             INTEGER PRIMARY KEY,
  original_name  TEXT    NOT NULL,
  original_path  TEXT    NOT NULL,
  proxy_path     TEXT    NOT NULL,
  thumb_path     TEXT    NOT NULL,
  width          INTEGER NOT NULL,
  height         INTEGER NOT NULL,
  duration_s     REAL    NOT NULL,
  fps            REAL    NOT NULL,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
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
    getTemplateBySlug: (slug: string) => getTemplateBySlug(db, slug),
    upsertTemplateElement: (e: TemplateElementInput) => upsertTemplateElement(db, e),
    listTemplateElements: (templateId: number) => listTemplateElements(db, templateId),
    createProject: (p: ProjectInput) => createProject(db, p),
    getProject: (id: number) => getProject(db, id),
    listProjects: () => listProjects(db),
    setProjectValues: (projectId: number, values: ProjectValue[]) => setProjectValues(db, projectId, values),
    getProjectElements: (projectId: number) => getProjectElements(db, projectId),
    setProjectElement: (projectId: number, elementId: number, patch: ProjectElementPatch) =>
      setProjectElement(db, projectId, elementId, patch),
    insertMediaAsset: (a: MediaAssetInput) => insertMediaAsset(db, a),
    getMediaAsset: (id: number) => getMediaAsset(db, id),
    listMediaAssets: () => listMediaAssets(db),
  });
}

// ---- project timeline --------------------------------------------------

function getProjectElements(db: Database.Database, projectId: number): ProjectElement[] {
  const rows = db
    .prepare(
      `SELECT e.id, e.slug, e.z_index AS zIndex,
              COALESCE(pe.start_frame, e.start_frame) AS startFrame,
              COALESCE(pe.end_frame, e.end_frame) AS endFrame,
              COALESCE(pe.enabled, 1) AS enabledInt
       FROM project p
       JOIN template_element e ON e.template_id = p.template_id
       LEFT JOIN project_element pe ON pe.project_id = p.id AND pe.element_id = e.id
       WHERE p.id = ?
       ORDER BY e.z_index, e.id`,
    )
    .all(projectId) as (Omit<ProjectElement, 'enabled'> & { enabledInt: number })[];
  return rows.map(({ enabledInt, ...r }) => ({ ...r, enabled: enabledInt === 1 }));
}

function setProjectElement(db: Database.Database, projectId: number, elementId: number, patch: ProjectElementPatch): void {
  db.prepare(
    `INSERT INTO project_element (project_id, element_id, start_frame, end_frame, enabled)
     VALUES (@projectId, @elementId, @startFrame, @endFrame, COALESCE(@enabled, 1))
     ON CONFLICT(project_id, element_id) DO UPDATE SET
       start_frame = COALESCE(excluded.start_frame, project_element.start_frame),
       end_frame = COALESCE(excluded.end_frame, project_element.end_frame),
       enabled = COALESCE(@enabled, project_element.enabled)`,
  ).run({
    projectId,
    elementId,
    startFrame: patch.startFrame ?? null,
    endFrame: patch.endFrame ?? null,
    enabled: patch.enabled === undefined ? null : patch.enabled ? 1 : 0,
  });
  db.prepare(`UPDATE project SET updated_at = datetime('now') WHERE id = ?`).run(projectId);
}

// ---- media -------------------------------------------------------------

const MEDIA_SELECT = `
  SELECT id, original_name AS originalName, original_path AS originalPath, proxy_path AS proxyPath,
         thumb_path AS thumbPath, width, height, duration_s AS durationS, fps, created_at AS createdAt
  FROM media_asset`;

function insertMediaAsset(db: Database.Database, a: MediaAssetInput): { id: number } {
  const info = db
    .prepare(
      `INSERT INTO media_asset (original_name, original_path, proxy_path, thumb_path, width, height, duration_s, fps)
       VALUES (@originalName, @originalPath, @proxyPath, @thumbPath, @width, @height, @durationS, @fps)`,
    )
    .run(a);
  return { id: Number(info.lastInsertRowid) };
}

function getMediaAsset(db: Database.Database, id: number): MediaAssetRow | undefined {
  return db.prepare(`${MEDIA_SELECT} WHERE id = ?`).get(id) as MediaAssetRow | undefined;
}

function listMediaAssets(db: Database.Database): MediaAssetRow[] {
  return db.prepare(`${MEDIA_SELECT} ORDER BY id DESC`).all() as MediaAssetRow[];
}

// ---- ad types and templates -------------------------------------------

function ensureAdType(db: Database.Database, name: string): number {
  const existing = db.prepare(`SELECT id FROM ad_type WHERE name = ?`).get(name) as { id: number } | undefined;
  if (existing) return existing.id;
  const next = (db.prepare(`SELECT COALESCE(MAX(sort), 0) + 1 AS n FROM ad_type`).get() as { n: number }).n;
  const info = db.prepare(`INSERT INTO ad_type (name, sort) VALUES (?, ?)`).run(name, next);
  return Number(info.lastInsertRowid);
}

function upsertTemplate(db: Database.Database, t: TemplateInput): { id: number } {
  const adTypeId = ensureAdType(db, t.adType);
  return db
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
}

const TEMPLATE_SELECT = `
  SELECT t.id, t.slug, t.name, a.name AS adType, a.sort AS adTypeSort,
         t.duration_frames AS durationFrames, t.fps, t.width, t.height, t.thumb_path AS thumbPath
  FROM template t JOIN ad_type a ON a.id = t.ad_type_id`;

function listTemplates(db: Database.Database): TemplateRow[] {
  return db.prepare(`${TEMPLATE_SELECT} ORDER BY a.sort, t.name`).all() as TemplateRow[];
}

function getTemplateBySlug(db: Database.Database, slug: string): TemplateRow | undefined {
  return db.prepare(`${TEMPLATE_SELECT} WHERE t.slug = ?`).get(slug) as TemplateRow | undefined;
}

// ---- elements ----------------------------------------------------------

function upsertTemplateElement(db: Database.Database, e: TemplateElementInput): { id: number } {
  return db
    .prepare(
      `INSERT INTO template_element (template_id, slug, z_index, start_frame, end_frame)
       VALUES (@templateId, @slug, @zIndex, @startFrame, @endFrame)
       ON CONFLICT(template_id, slug) DO UPDATE SET
         z_index = excluded.z_index,
         start_frame = excluded.start_frame,
         end_frame = excluded.end_frame
       RETURNING id`,
    )
    .get(e) as { id: number };
}

function listTemplateElements(db: Database.Database, templateId: number): TemplateElementRow[] {
  return db
    .prepare(
      `SELECT id, template_id AS templateId, slug, z_index AS zIndex, start_frame AS startFrame, end_frame AS endFrame
       FROM template_element WHERE template_id = ? ORDER BY z_index, id`,
    )
    .all(templateId) as TemplateElementRow[];
}

// ---- projects ----------------------------------------------------------

function createProject(db: Database.Database, p: ProjectInput): { id: number } {
  const insertProject = db.prepare(`INSERT INTO project (template_id, name) VALUES (?, ?)`);
  const insertValue = db.prepare(
    `INSERT INTO project_value (project_id, element_id, param_key, value_json) VALUES (?, ?, ?, ?)`,
  );
  const run = db.transaction((): { id: number } => {
    const id = Number(insertProject.run(p.templateId, p.name).lastInsertRowid);
    for (const v of p.values) insertValue.run(id, v.elementId, v.key, JSON.stringify(v.value ?? null));
    return { id };
  });
  return run();
}

const PROJECT_SELECT = `
  SELECT p.id, p.template_id AS templateId, t.slug AS templateSlug, t.name AS templateName,
         p.name, p.created_at AS createdAt, p.updated_at AS updatedAt
  FROM project p JOIN template t ON t.id = p.template_id`;

function getProject(db: Database.Database, id: number): ProjectDetail | undefined {
  const row = db.prepare(`${PROJECT_SELECT} WHERE p.id = ?`).get(id) as ProjectRow | undefined;
  if (!row) return undefined;
  const values = (
    db
      .prepare(`SELECT element_id AS elementId, param_key AS key, value_json AS json FROM project_value WHERE project_id = ? ORDER BY element_id, param_key`)
      .all(id) as { elementId: number; key: string; json: string }[]
  ).map((v) => ({ elementId: v.elementId, key: v.key, value: JSON.parse(v.json) as unknown }));
  return { ...row, values };
}

function listProjects(db: Database.Database): ProjectRow[] {
  return db.prepare(`${PROJECT_SELECT} ORDER BY p.id DESC`).all() as ProjectRow[];
}

function setProjectValues(db: Database.Database, projectId: number, values: ProjectValue[]): void {
  const upsert = db.prepare(
    `INSERT INTO project_value (project_id, element_id, param_key, value_json) VALUES (?, ?, ?, ?)
     ON CONFLICT(project_id, element_id, param_key) DO UPDATE SET value_json = excluded.value_json`,
  );
  const touch = db.prepare(`UPDATE project SET updated_at = datetime('now') WHERE id = ?`);
  db.transaction(() => {
    for (const v of values) upsert.run(projectId, v.elementId, v.key, JSON.stringify(v.value ?? null));
    touch.run(projectId);
  })();
}
