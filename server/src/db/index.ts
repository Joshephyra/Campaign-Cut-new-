import { inferElementType } from '@campaigncut/composition';
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
  /** M38: feeds the element library only; left out of the "start a spot" grid. */
  libraryOnly?: boolean;
};

export type TemplateRow = TemplateInput & { id: number; adTypeSort: number; libraryOnly: boolean };

export type TemplateElementInput = {
  templateId: number;
  slug: string;
  /** Shown in the scene strip and panel; defaults to the slug. */
  name?: string;
  /** M31: what the element is (tools/ingest ELEMENT_TYPES); overlay when not given. */
  type?: string;
  zIndex: number;
  startFrame: number;
  endFrame: number;
};

export type TemplateElementRow = Omit<TemplateElementInput, 'name' | 'type'> & { id: number; name: string; type: string };

/** M31: one element of the library: any template's element, with its template. */
export type LibraryElement = {
  id: number;
  slug: string;
  name: string;
  type: string;
  durationInFrames: number;
  templateId: number;
  templateSlug: string;
  templateName: string;
  thumbPath: string;
};

export type ProjectValue = { elementId: number; key: string; value: unknown };

export type ProjectInput = { templateId: number; name: string; values: ProjectValue[]; clientId?: number | null };

export type ProjectRow = {
  id: number;
  templateId: number;
  templateSlug: string;
  templateName: string;
  name: string;
  /** M33: the client this spot is for, or null. */
  clientId: number | null;
  clientName: string | null;
  /** M36: the version's aspect ratio; 16:9 is the master. */
  aspect: string;
  /** M39: the style treatment across the spot; clean by default. */
  treatment: string;
  createdAt: string;
  updatedAt: string;
};

/** M33: a client profile: the brand guide a spot is made for. A record, not an account. */
export type ClientInput = { name: string; logoUrl: string; colors: Record<string, string>; disclaimer: string };
export type ClientRow = ClientInput & { id: number; createdAt: string };

export type ProjectDetail = ProjectRow & { values: ProjectValue[] };

/**
 * A scene as it stands in one project: template defaults with the project's
 * own in/out and toggle applied. M45: `id` is the scene's id in this spot.
 * The first time an element is used it is the template element's id (so
 * values, transitions and older spots need no translation); a second use of
 * the same element gets a fresh id of its own. `elementId` is always the
 * template element.
 */
export type ProjectElement = {
  id: number;
  elementId: number;
  slug: string;
  name: string;
  /** M31 */
  type: string;
  /** M31: the template whose files this element uses; the spot's own, or an added library element's. */
  templateSlug: string;
  zIndex: number;
  startFrame: number;
  endFrame: number;
  enabled: boolean;
  /** M31: true when the element was added from the library rather than coming with the spot's template. */
  added: boolean;
};

export type ProjectElementPatch = Partial<Pick<ProjectElement, 'startFrame' | 'endFrame' | 'enabled'>>;

/** A transition stored on the boundary after an element, for one project. */
export type ProjectTransition = { afterElementId: number; preset: string; durationInFrames: number };

export type RenderStatus = 'queued' | 'rendering' | 'done' | 'failed';

export type RenderRow = {
  id: number;
  projectId: number;
  /** M50: the version this render is of. */
  aspect: string;
  status: RenderStatus;
  progress: number;
  /** Relative to the media directory, e.g. renders/project-1-5.mp4. Empty until done. */
  outputPath: string;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RenderPatch = Partial<Pick<RenderRow, 'status' | 'progress' | 'outputPath' | 'error'>>;

export type MediaAssetKind = 'video' | 'audio';

export type MediaAssetInput = {
  /** M20: 'video' (default) or 'audio'. Audio has no proxy or poster; width, height and fps are 0. */
  kind?: MediaAssetKind;
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

export type MediaAssetRow = Omit<MediaAssetInput, 'kind'> & { id: number; kind: MediaAssetKind; createdAt: string };

/** M20: a project's music bed. */
export type ProjectAudio = { assetId: number; volume: number; inS: number };

/** M32: a saved theme: colours by role (#RRGGBB), kept in the library. */
export type ThemeInput = { name: string; colors: Record<string, string> };
export type ThemeRow = ThemeInput & { id: number; createdAt: string };

export type Db = Database.Database & {
  /** M50: a render is of one version; the aspect is fixed when it is queued. */
  insertRender(projectId: number, aspect?: string): { id: number };
  updateRender(id: number, patch: RenderPatch): void;
  getRender(id: number): RenderRow | undefined;
  listRenders(projectId?: number): RenderRow[];
  insertMediaAsset(a: MediaAssetInput): { id: number };
  getMediaAsset(id: number): MediaAssetRow | undefined;
  listMediaAssets(): MediaAssetRow[];
  getProjectAudio(projectId: number): ProjectAudio | null;
  /** null clears the music bed. */
  setProjectAudio(projectId: number, audio: ProjectAudio | null): void;
  /** M32 */
  insertTheme(t: ThemeInput): { id: number };
  listThemes(): ThemeRow[];
  deleteTheme(id: number): boolean;
  /** M33 */
  insertClient(c: ClientInput): { id: number };
  listClients(): ClientRow[];
  getClient(id: number): ClientRow | undefined;
  updateClient(id: number, patch: Partial<ClientInput>): void;
  /** Spots made for the client stay, with no client. */
  deleteClient(id: number): boolean;
  upsertTemplate(t: TemplateInput): { id: number };
  listTemplates(): TemplateRow[];
  getTemplateBySlug(slug: string): TemplateRow | undefined;
  upsertTemplateElement(e: TemplateElementInput): { id: number };
  listTemplateElements(templateId: number): TemplateElementRow[];
  /** M31: every element of every template. */
  listLibraryElements(): LibraryElement[];
  /** M31: add a library element to a project at a frame, with its authored length. M45: adding twice makes a second scene; returns the scene id. */
  addProjectElement(projectId: number, elementId: number, startFrame: number): number;
  /** M31: remove an added scene and its values. False when the scene is the spot's own (or absent). */
  removeProjectElement(projectId: number, sceneId: number): boolean;
  /** Drop a template's elements whose slug is not in `keep` (a re-ingest that lost an element). */
  deleteTemplateElementsExcept(templateId: number, keep: string[]): void;
  createProject(p: ProjectInput): { id: number };
  getProject(id: number): ProjectDetail | undefined;
  listProjects(): ProjectRow[];
  /** M22 */
  renameProject(id: number, name: string): void;
  /** M36 */
  setProjectAspect(id: number, aspect: string): void;
  /** M39: the style treatment across the spot. */
  setProjectTreatment(id: number, treatment: string): void;
  /** M22: copy values, timeline overrides, transitions and the music bed into a new project. */
  duplicateProject(id: number, name: string): { id: number };
  /** M22: the project and everything that hangs off it (rendered files stay on disk). */
  deleteProject(id: number): void;
  /** Upsert the given values (others untouched) and bump updated_at. */
  setProjectValues(projectId: number, values: ProjectValue[]): void;
  /** The project's timeline: template elements with this project's overrides, in z order. */
  getProjectElements(projectId: number): ProjectElement[];
  /** Move or toggle one scene in one project. The template is untouched. */
  setProjectElement(projectId: number, sceneId: number, patch: ProjectElementPatch): void;
  getProjectTransitions(projectId: number): ProjectTransition[];
  /** 'cut' removes the row; anything else upserts it. */
  setProjectTransition(projectId: number, afterElementId: number, t: { preset: string; durationInFrames: number }): void;
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
  name         TEXT    NOT NULL DEFAULT '',
  type         TEXT    NOT NULL DEFAULT 'overlay',
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
  element_id  INTEGER NOT NULL,
  param_key   TEXT    NOT NULL,
  value_json  TEXT    NOT NULL,
  PRIMARY KEY (project_id, element_id, param_key)
);

CREATE TABLE IF NOT EXISTS project_scene (
  project_id   INTEGER NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  scene_id     INTEGER NOT NULL,
  element_id   INTEGER NOT NULL REFERENCES template_element(id),
  start_frame  INTEGER,
  end_frame    INTEGER,
  enabled      INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (project_id, scene_id)
);

CREATE TABLE IF NOT EXISTS project_transition (
  project_id        INTEGER NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  after_element_id  INTEGER NOT NULL,
  preset            TEXT    NOT NULL,
  duration_frames   INTEGER NOT NULL,
  PRIMARY KEY (project_id, after_element_id)
);

CREATE TABLE IF NOT EXISTS render (
  id           INTEGER PRIMARY KEY,
  project_id   INTEGER NOT NULL REFERENCES project(id),
  status       TEXT    NOT NULL,
  progress     REAL    NOT NULL DEFAULT 0,
  output_path  TEXT    NOT NULL DEFAULT '',
  error        TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS project_audio (
  project_id  INTEGER PRIMARY KEY REFERENCES project(id) ON DELETE CASCADE,
  asset_id    INTEGER NOT NULL REFERENCES media_asset(id),
  volume      REAL    NOT NULL DEFAULT 1,
  in_s        REAL    NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS client (
  id           INTEGER PRIMARY KEY,
  name         TEXT    NOT NULL,
  logo_url     TEXT    NOT NULL DEFAULT '',
  colors_json  TEXT    NOT NULL DEFAULT '{}',
  disclaimer   TEXT    NOT NULL DEFAULT '',
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS theme (
  id           INTEGER PRIMARY KEY,
  name         TEXT    NOT NULL,
  colors_json  TEXT    NOT NULL,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS media_asset (
  id             INTEGER PRIMARY KEY,
  kind           TEXT    NOT NULL DEFAULT 'video',
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

  // M17: elements gained a display name. Add the column to databases created before it.
  const templateColumns = (db.prepare(`PRAGMA table_info(template)`).all() as { name: string }[]).map((c) => c.name);
  if (!templateColumns.includes('library_only')) db.exec(`ALTER TABLE template ADD COLUMN library_only INTEGER NOT NULL DEFAULT 0`);
  const elementColumns = (db.prepare(`PRAGMA table_info(template_element)`).all() as { name: string }[]).map((c) => c.name);
  if (!elementColumns.includes('name')) db.exec(`ALTER TABLE template_element ADD COLUMN name TEXT NOT NULL DEFAULT ''`);
  // M31: elements gained a type. Elements ingested before then are typed from their slug, the way the ingest would.
  if (!elementColumns.includes('type')) {
    db.exec(`ALTER TABLE template_element ADD COLUMN type TEXT NOT NULL DEFAULT 'overlay'`);
    backfillElementTypes(db);
  }
  // M33: a project may belong to a client.
  const projectColumns = (db.prepare(`PRAGMA table_info(project)`).all() as { name: string }[]).map((c) => c.name);
  if (!projectColumns.includes('client_id')) db.exec(`ALTER TABLE project ADD COLUMN client_id INTEGER REFERENCES client(id)`);
  // M36: a project has an aspect; everything before was 16:9.
  if (!projectColumns.includes('aspect')) db.exec(`ALTER TABLE project ADD COLUMN aspect TEXT NOT NULL DEFAULT '16:9'`);
  // M39: a project has a style treatment; everything before was clean.
  if (!projectColumns.includes('treatment')) db.exec(`ALTER TABLE project ADD COLUMN treatment TEXT NOT NULL DEFAULT 'clean'`);
  // M45: scenes replaced per-project element rows. A scene's id is its element's id the first time (so nothing
  // else needs translating); the old rows move over with scene_id = element_id.
  const hadElementRows = (db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'project_element'`).get() as { name: string } | undefined) !== undefined;
  if (hadElementRows) {
    db.exec(`INSERT INTO project_scene (project_id, scene_id, element_id, start_frame, end_frame, enabled)
             SELECT project_id, element_id, element_id, start_frame, end_frame, enabled FROM project_element;
             DROP TABLE project_element;`);
  }
  // M45: values and transitions are keyed by scene id, which for a second use of an element is not a template
  // element id. Databases whose tables still reference template_element are rebuilt without that constraint.
  for (const [table, columns] of [
    ['project_value', 'project_id, element_id, param_key, value_json'],
    ['project_transition', 'project_id, after_element_id, preset, duration_frames'],
  ] as const) {
    const refs = db.prepare(`PRAGMA foreign_key_list(${table})`).all() as { table: string }[];
    if (!refs.some((r) => r.table === 'template_element')) continue;
    const create = (db.prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?`).get(table) as { sql: string }).sql;
    const rebuilt = create.replace(/\s+REFERENCES template_element\(id\)/g, '').replace(new RegExp(`TABLE (IF NOT EXISTS )?${table}`), `TABLE ${table}_new`);
    db.pragma('foreign_keys = OFF');
    db.exec(`${rebuilt};
             INSERT INTO ${table}_new (${columns}) SELECT ${columns} FROM ${table};
             DROP TABLE ${table};
             ALTER TABLE ${table}_new RENAME TO ${table};`);
    db.pragma('foreign_keys = ON');
  }
  // M50: a render is of one version. Renders before then were of the spot's aspect at the time; 16:9 is the safe reading.
  const renderColumns = (db.prepare(`PRAGMA table_info(render)`).all() as { name: string }[]).map((c) => c.name);
  if (!renderColumns.includes('aspect')) db.exec(`ALTER TABLE render ADD COLUMN aspect TEXT NOT NULL DEFAULT '16:9'`);
  // M20: media assets gained a kind (video or audio).
  const mediaColumns = (db.prepare(`PRAGMA table_info(media_asset)`).all() as { name: string }[]).map((c) => c.name);
  if (!mediaColumns.includes('kind')) db.exec(`ALTER TABLE media_asset ADD COLUMN kind TEXT NOT NULL DEFAULT 'video'`);

  const seed = db.prepare(`INSERT OR IGNORE INTO ad_type (name, sort) VALUES (?, ?)`);
  AD_TYPES.forEach((name, i) => seed.run(name, i + 1));

  return Object.assign(db, {
    upsertTemplate: (t: TemplateInput) => upsertTemplate(db, t),
    listTemplates: () => listTemplates(db),
    getTemplateBySlug: (slug: string) => getTemplateBySlug(db, slug),
    upsertTemplateElement: (e: TemplateElementInput) => upsertTemplateElement(db, e),
    listTemplateElements: (templateId: number) => listTemplateElements(db, templateId),
    listLibraryElements: () => listLibraryElements(db),
    addProjectElement: (projectId: number, elementId: number, startFrame: number) => addProjectElement(db, projectId, elementId, startFrame),
    removeProjectElement: (projectId: number, elementId: number) => removeProjectElement(db, projectId, elementId),
    deleteTemplateElementsExcept: (templateId: number, keep: string[]) => deleteTemplateElementsExcept(db, templateId, keep),
    createProject: (p: ProjectInput) => createProject(db, p),
    getProject: (id: number) => getProject(db, id),
    listProjects: () => listProjects(db),
    renameProject: (id: number, name: string) => renameProject(db, id, name),
    setProjectAspect: (id: number, aspect: string) => setProjectAspect(db, id, aspect),
    setProjectTreatment: (id: number, treatment: string) => setProjectTreatment(db, id, treatment),
    duplicateProject: (id: number, name: string) => duplicateProject(db, id, name),
    deleteProject: (id: number) => deleteProject(db, id),
    setProjectValues: (projectId: number, values: ProjectValue[]) => setProjectValues(db, projectId, values),
    getProjectElements: (projectId: number) => getProjectElements(db, projectId),
    setProjectElement: (projectId: number, elementId: number, patch: ProjectElementPatch) =>
      setProjectElement(db, projectId, elementId, patch),
    getProjectTransitions: (projectId: number) => getProjectTransitions(db, projectId),
    setProjectTransition: (projectId: number, afterElementId: number, t: { preset: string; durationInFrames: number }) =>
      setProjectTransition(db, projectId, afterElementId, t),
    insertRender: (projectId: number, aspect?: string) => insertRender(db, projectId, aspect),
    updateRender: (id: number, patch: RenderPatch) => updateRender(db, id, patch),
    getRender: (id: number) => getRender(db, id),
    listRenders: (projectId?: number) => listRenders(db, projectId),
    insertMediaAsset: (a: MediaAssetInput) => insertMediaAsset(db, a),
    getMediaAsset: (id: number) => getMediaAsset(db, id),
    listMediaAssets: () => listMediaAssets(db),
    getProjectAudio: (projectId: number) => getProjectAudio(db, projectId),
    setProjectAudio: (projectId: number, audio: ProjectAudio | null) => setProjectAudio(db, projectId, audio),
    insertTheme: (t: ThemeInput) => insertTheme(db, t),
    listThemes: () => listThemes(db),
    deleteTheme: (id: number) => deleteTheme(db, id),
    insertClient: (c: ClientInput) => insertClient(db, c),
    listClients: () => listClients(db),
    getClient: (id: number) => getClient(db, id),
    updateClient: (id: number, patch: Partial<ClientInput>) => updateClient(db, id, patch),
    deleteClient: (id: number) => deleteClient(db, id),
  });
}

// ---- clients (M33) -----------------------------------------------------

const CLIENT_SELECT = `SELECT id, name, logo_url AS logoUrl, colors_json AS colorsJson, disclaimer, created_at AS createdAt FROM client`;
type ClientRaw = { id: number; name: string; logoUrl: string; colorsJson: string; disclaimer: string; createdAt: string };
const clientRow = ({ colorsJson, ...r }: ClientRaw): ClientRow => ({ ...r, colors: JSON.parse(colorsJson) as Record<string, string> });

function insertClient(db: Database.Database, c: ClientInput): { id: number } {
  const id = Number(db.prepare(`INSERT INTO client (name, logo_url, colors_json, disclaimer) VALUES (?, ?, ?, ?)`).run(c.name, c.logoUrl, JSON.stringify(c.colors), c.disclaimer).lastInsertRowid);
  return { id };
}

function listClients(db: Database.Database): ClientRow[] {
  return (db.prepare(`${CLIENT_SELECT} ORDER BY name COLLATE NOCASE, id`).all() as ClientRaw[]).map(clientRow);
}

function getClient(db: Database.Database, id: number): ClientRow | undefined {
  const raw = db.prepare(`${CLIENT_SELECT} WHERE id = ?`).get(id) as ClientRaw | undefined;
  return raw ? clientRow(raw) : undefined;
}

function updateClient(db: Database.Database, id: number, patch: Partial<ClientInput>): void {
  const current = getClient(db, id);
  if (!current) throw new Error(`No client ${id}`);
  const next = { ...current, ...patch };
  db.prepare(`UPDATE client SET name = ?, logo_url = ?, colors_json = ?, disclaimer = ? WHERE id = ?`).run(next.name, next.logoUrl, JSON.stringify(next.colors), next.disclaimer, id);
}

function deleteClient(db: Database.Database, id: number): boolean {
  const run = db.transaction((): boolean => {
    db.prepare(`UPDATE project SET client_id = NULL WHERE client_id = ?`).run(id);
    return db.prepare(`DELETE FROM client WHERE id = ?`).run(id).changes > 0;
  });
  return run();
}

// ---- themes (M32) ------------------------------------------------------

function insertTheme(db: Database.Database, t: ThemeInput): { id: number } {
  const id = Number(db.prepare(`INSERT INTO theme (name, colors_json) VALUES (?, ?)`).run(t.name, JSON.stringify(t.colors)).lastInsertRowid);
  return { id };
}

function listThemes(db: Database.Database): ThemeRow[] {
  const rows = db.prepare(`SELECT id, name, colors_json AS colorsJson, created_at AS createdAt FROM theme ORDER BY id DESC`).all() as { id: number; name: string; colorsJson: string; createdAt: string }[];
  return rows.map(({ colorsJson, ...r }) => ({ ...r, colors: JSON.parse(colorsJson) as Record<string, string> }));
}

function deleteTheme(db: Database.Database, id: number): boolean {
  return db.prepare(`DELETE FROM theme WHERE id = ?`).run(id).changes > 0;
}

// ---- music bed (M20) ---------------------------------------------------

function getProjectAudio(db: Database.Database, projectId: number): ProjectAudio | null {
  const row = db.prepare(`SELECT asset_id AS assetId, volume, in_s AS inS FROM project_audio WHERE project_id = ?`).get(projectId) as ProjectAudio | undefined;
  return row ?? null;
}

function setProjectAudio(db: Database.Database, projectId: number, audio: ProjectAudio | null): void {
  if (!audio) {
    db.prepare(`DELETE FROM project_audio WHERE project_id = ?`).run(projectId);
  } else {
    db.prepare(
      `INSERT INTO project_audio (project_id, asset_id, volume, in_s) VALUES (?, ?, ?, ?)
       ON CONFLICT(project_id) DO UPDATE SET asset_id = excluded.asset_id, volume = excluded.volume, in_s = excluded.in_s`,
    ).run(projectId, audio.assetId, audio.volume, audio.inS);
  }
  db.prepare(`UPDATE project SET updated_at = datetime('now') WHERE id = ?`).run(projectId);
}

// ---- project timeline --------------------------------------------------

function getProjectElements(db: Database.Database, projectId: number): ProjectElement[] {
  // The spot's own elements (its template's, each once, with any per-project
  // overrides on the scene whose id is the element's id), then every other
  // scene: elements added from the library (M31) and second uses of any
  // element (M45). Own elements first, then the rest.
  const rows = db
    .prepare(
      `SELECT e.id AS id, e.id AS elementId, e.slug AS slug, COALESCE(NULLIF(e.name, ''), e.slug) AS name, e.type AS type, t.slug AS templateSlug, e.z_index AS zIndex,
              COALESCE(ps.start_frame, e.start_frame) AS startFrame,
              COALESCE(ps.end_frame, e.end_frame) AS endFrame,
              COALESCE(ps.enabled, 1) AS enabledInt,
              0 AS addedInt
       FROM project p
       JOIN template_element e ON e.template_id = p.template_id
       JOIN template t ON t.id = e.template_id
       LEFT JOIN project_scene ps ON ps.project_id = p.id AND ps.scene_id = e.id AND ps.element_id = e.id
       WHERE p.id = @projectId
       UNION ALL
       SELECT ps.scene_id AS id, e.id AS elementId, e.slug AS slug, COALESCE(NULLIF(e.name, ''), e.slug) AS name, e.type AS type, t.slug AS templateSlug, e.z_index AS zIndex,
              ps.start_frame AS startFrame, ps.end_frame AS endFrame, ps.enabled AS enabledInt, 1 AS addedInt
       FROM project p
       JOIN project_scene ps ON ps.project_id = p.id
       JOIN template_element e ON e.id = ps.element_id
       JOIN template t ON t.id = e.template_id
       WHERE p.id = @projectId AND (e.template_id <> p.template_id OR ps.scene_id <> ps.element_id)
       ORDER BY addedInt, zIndex, id`,
    )
    .all({ projectId }) as (Omit<ProjectElement, 'enabled' | 'added'> & { enabledInt: number; addedInt: number })[];
  return rows.map(({ enabledInt, addedInt, ...r }) => ({ ...r, enabled: enabledInt === 1, added: addedInt === 1 }));
}

/** M31: give untyped elements the type their slug suggests. Safe to run again: only 'overlay' rows change, and only to something better. */
export function backfillElementTypes(db: Database.Database): number {
  const rows = db.prepare(`SELECT id, slug FROM template_element WHERE type = 'overlay'`).all() as { id: number; slug: string }[];
  const update = db.prepare(`UPDATE template_element SET type = ? WHERE id = ?`);
  let changed = 0;
  for (const r of rows) {
    const type = inferElementType(r.slug);
    if (type !== 'overlay') {
      update.run(type, r.id);
      changed++;
    }
  }
  return changed;
}

function listLibraryElements(db: Database.Database): LibraryElement[] {
  return db
    .prepare(
      `SELECT e.id, e.slug, COALESCE(NULLIF(e.name, ''), e.slug) AS name, e.type, e.end_frame - e.start_frame AS durationInFrames,
              t.id AS templateId, t.slug AS templateSlug, t.name AS templateName, t.thumb_path AS thumbPath
       FROM template_element e JOIN template t ON t.id = e.template_id
       ORDER BY t.id, e.z_index, e.id`,
    )
    .all() as LibraryElement[];
}

/** M45: scene ids for second uses start here, above any template element id. */
const FRESH_SCENE_FROM = 10_000_000;

function addProjectElement(db: Database.Database, projectId: number, elementId: number, startFrame: number): number {
  const element = db.prepare(`SELECT start_frame AS startFrame, end_frame AS endFrame, template_id AS templateId FROM template_element WHERE id = ?`).get(elementId) as
    | { startFrame: number; endFrame: number; templateId: number }
    | undefined;
  if (!element) throw new Error(`No template element ${elementId}`);
  const start = Math.max(0, Math.round(startFrame));
  const run = db.transaction((): number => {
    // The first use of an element keeps the element's id as its scene id; the spot's own elements count as used.
    const own = (db.prepare(`SELECT template_id AS templateId FROM project WHERE id = ?`).get(projectId) as { templateId: number } | undefined)?.templateId === element.templateId;
    const used = own || db.prepare(`SELECT 1 FROM project_scene WHERE project_id = ? AND scene_id = ?`).get(projectId, elementId) !== undefined;
    let sceneId = elementId;
    if (used) {
      const max = (db.prepare(`SELECT MAX(scene_id) AS max FROM project_scene`).get() as { max: number | null }).max ?? 0;
      sceneId = Math.max(FRESH_SCENE_FROM, max + 1);
    }
    db.prepare(`INSERT INTO project_scene (project_id, scene_id, element_id, start_frame, end_frame, enabled) VALUES (?, ?, ?, ?, ?, 1)`).run(
      projectId,
      sceneId,
      elementId,
      start,
      start + (element.endFrame - element.startFrame),
    );
    db.prepare(`UPDATE project SET updated_at = datetime('now') WHERE id = ?`).run(projectId);
    return sceneId;
  });
  return run();
}

function removeProjectElement(db: Database.Database, projectId: number, sceneId: number): boolean {
  // The spot's own elements (scene id = element id, from the spot's template) stay; hide them instead.
  const own = db.prepare(`SELECT 1 FROM project p JOIN template_element e ON e.template_id = p.template_id WHERE p.id = ? AND e.id = ?`).get(projectId, sceneId);
  if (own) return false;
  const run = db.transaction((): boolean => {
    const gone = db.prepare(`DELETE FROM project_scene WHERE project_id = ? AND scene_id = ?`).run(projectId, sceneId).changes;
    if (gone === 0) return false;
    db.prepare(`DELETE FROM project_value WHERE project_id = ? AND element_id = ?`).run(projectId, sceneId);
    db.prepare(`DELETE FROM project_transition WHERE project_id = ? AND after_element_id = ?`).run(projectId, sceneId);
    db.prepare(`UPDATE project SET updated_at = datetime('now') WHERE id = ?`).run(projectId);
    return true;
  });
  return run();
}

function setProjectElement(db: Database.Database, projectId: number, sceneId: number, patch: ProjectElementPatch): void {
  // A scene row exists for every added scene; an own element gets one on its first change, keyed by its own id.
  db.prepare(
    `INSERT INTO project_scene (project_id, scene_id, element_id, start_frame, end_frame, enabled)
     VALUES (@projectId, @sceneId, @sceneId, @startFrame, @endFrame, COALESCE(@enabled, 1))
     ON CONFLICT(project_id, scene_id) DO UPDATE SET
       start_frame = COALESCE(excluded.start_frame, project_scene.start_frame),
       end_frame = COALESCE(excluded.end_frame, project_scene.end_frame),
       enabled = COALESCE(@enabled, project_scene.enabled)`,
  ).run({
    projectId,
    sceneId,
    startFrame: patch.startFrame ?? null,
    endFrame: patch.endFrame ?? null,
    enabled: patch.enabled === undefined ? null : patch.enabled ? 1 : 0,
  });
  db.prepare(`UPDATE project SET updated_at = datetime('now') WHERE id = ?`).run(projectId);
}

// ---- transitions -------------------------------------------------------

function getProjectTransitions(db: Database.Database, projectId: number): ProjectTransition[] {
  return db
    .prepare(
      `SELECT after_element_id AS afterElementId, preset, duration_frames AS durationInFrames
       FROM project_transition WHERE project_id = ? ORDER BY after_element_id`,
    )
    .all(projectId) as ProjectTransition[];
}

function setProjectTransition(
  db: Database.Database,
  projectId: number,
  afterElementId: number,
  t: { preset: string; durationInFrames: number },
): void {
  if (t.preset === 'cut') {
    db.prepare(`DELETE FROM project_transition WHERE project_id = ? AND after_element_id = ?`).run(projectId, afterElementId);
  } else {
    db.prepare(
      `INSERT INTO project_transition (project_id, after_element_id, preset, duration_frames) VALUES (?, ?, ?, ?)
       ON CONFLICT(project_id, after_element_id) DO UPDATE SET preset = excluded.preset, duration_frames = excluded.duration_frames`,
    ).run(projectId, afterElementId, t.preset, Math.round(t.durationInFrames));
  }
  db.prepare(`UPDATE project SET updated_at = datetime('now') WHERE id = ?`).run(projectId);
}

// ---- renders -----------------------------------------------------------

const RENDER_SELECT = `
  SELECT id, project_id AS projectId, status, progress, output_path AS outputPath, error, aspect,
         created_at AS createdAt, updated_at AS updatedAt
  FROM render`;

function insertRender(db: Database.Database, projectId: number, aspect = '16:9'): { id: number } {
  const info = db.prepare(`INSERT INTO render (project_id, status, aspect) VALUES (?, 'queued', ?)`).run(projectId, aspect);
  return { id: Number(info.lastInsertRowid) };
}

function updateRender(db: Database.Database, id: number, patch: RenderPatch): void {
  const sets: string[] = [`updated_at = datetime('now')`];
  const params: Record<string, unknown> = { id };
  if (patch.status !== undefined) {
    sets.push('status = @status');
    params.status = patch.status;
  }
  if (patch.progress !== undefined) {
    sets.push('progress = @progress');
    params.progress = patch.progress;
  }
  if (patch.outputPath !== undefined) {
    sets.push('output_path = @outputPath');
    params.outputPath = patch.outputPath;
  }
  if (patch.error !== undefined) {
    sets.push('error = @error');
    params.error = patch.error;
  }
  db.prepare(`UPDATE render SET ${sets.join(', ')} WHERE id = @id`).run(params);
}

function getRender(db: Database.Database, id: number): RenderRow | undefined {
  return db.prepare(`${RENDER_SELECT} WHERE id = ?`).get(id) as RenderRow | undefined;
}

function listRenders(db: Database.Database, projectId?: number): RenderRow[] {
  if (projectId === undefined) return db.prepare(`${RENDER_SELECT} ORDER BY id DESC`).all() as RenderRow[];
  return db.prepare(`${RENDER_SELECT} WHERE project_id = ? ORDER BY id DESC`).all(projectId) as RenderRow[];
}

// ---- media -------------------------------------------------------------

const MEDIA_SELECT = `
  SELECT id, kind, original_name AS originalName, original_path AS originalPath, proxy_path AS proxyPath,
         thumb_path AS thumbPath, width, height, duration_s AS durationS, fps, created_at AS createdAt
  FROM media_asset`;

function insertMediaAsset(db: Database.Database, a: MediaAssetInput): { id: number } {
  const info = db
    .prepare(
      `INSERT INTO media_asset (kind, original_name, original_path, proxy_path, thumb_path, width, height, duration_s, fps)
       VALUES (@kind, @originalName, @originalPath, @proxyPath, @thumbPath, @width, @height, @durationS, @fps)`,
    )
    .run({ ...a, kind: a.kind ?? 'video' });
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
      `INSERT INTO template (slug, name, ad_type_id, duration_frames, fps, width, height, thumb_path, library_only)
       VALUES (@slug, @name, @adTypeId, @durationFrames, @fps, @width, @height, @thumbPath, @libraryOnly)
       ON CONFLICT(slug) DO UPDATE SET
         name = excluded.name,
         library_only = excluded.library_only,
         ad_type_id = excluded.ad_type_id,
         duration_frames = excluded.duration_frames,
         fps = excluded.fps,
         width = excluded.width,
         height = excluded.height,
         thumb_path = excluded.thumb_path,
         updated_at = datetime('now')
       RETURNING id`,
    )
    .get({ ...t, adTypeId, libraryOnly: t.libraryOnly ? 1 : 0 }) as { id: number };
}

const TEMPLATE_SELECT = `
  SELECT t.id, t.slug, t.name, a.name AS adType, a.sort AS adTypeSort,
         t.duration_frames AS durationFrames, t.fps, t.width, t.height, t.thumb_path AS thumbPath,
         t.library_only AS libraryOnly
  FROM template t JOIN ad_type a ON a.id = t.ad_type_id`;

const templateRow = (r: unknown): TemplateRow => ({ ...(r as TemplateRow), libraryOnly: Boolean((r as { libraryOnly: number }).libraryOnly) });

function listTemplates(db: Database.Database): TemplateRow[] {
  return (db.prepare(`${TEMPLATE_SELECT} ORDER BY a.sort, t.name`).all() as unknown[]).map(templateRow);
}

function getTemplateBySlug(db: Database.Database, slug: string): TemplateRow | undefined {
  const r = db.prepare(`${TEMPLATE_SELECT} WHERE t.slug = ?`).get(slug);
  return r ? templateRow(r) : undefined;
}

// ---- elements ----------------------------------------------------------

function upsertTemplateElement(db: Database.Database, e: TemplateElementInput): { id: number } {
  return db
    .prepare(
      `INSERT INTO template_element (template_id, slug, name, type, z_index, start_frame, end_frame)
       VALUES (@templateId, @slug, @name, @type, @zIndex, @startFrame, @endFrame)
       ON CONFLICT(template_id, slug) DO UPDATE SET
         name = excluded.name,
         type = excluded.type,
         z_index = excluded.z_index,
         start_frame = excluded.start_frame,
         end_frame = excluded.end_frame
       RETURNING id`,
    )
    .get({ ...e, name: e.name ?? e.slug, type: e.type ?? 'overlay' }) as { id: number };
}

function listTemplateElements(db: Database.Database, templateId: number): TemplateElementRow[] {
  return db
    .prepare(
      `SELECT id, template_id AS templateId, slug, COALESCE(NULLIF(name, ''), slug) AS name, type,
              z_index AS zIndex, start_frame AS startFrame, end_frame AS endFrame
       FROM template_element WHERE template_id = ? ORDER BY z_index, id`,
    )
    .all(templateId) as TemplateElementRow[];
}

function deleteTemplateElementsExcept(db: Database.Database, templateId: number, keep: string[]): void {
  const rows = db.prepare(`SELECT id, slug FROM template_element WHERE template_id = ?`).all(templateId) as { id: number; slug: string }[];
  const gone = rows.filter((r) => !keep.includes(r.slug));
  if (gone.length === 0) return;
  const run = db.transaction(() => {
    for (const { id } of gone) {
      db.prepare(`DELETE FROM project_value WHERE element_id = ?`).run(id);
      db.prepare(`DELETE FROM project_scene WHERE element_id = ?`).run(id);
      db.prepare(`DELETE FROM project_transition WHERE after_element_id = ?`).run(id);
      db.prepare(`DELETE FROM template_element WHERE id = ?`).run(id);
    }
  });
  run();
}

// ---- projects ----------------------------------------------------------

function createProject(db: Database.Database, p: ProjectInput): { id: number } {
  const insertProject = db.prepare(`INSERT INTO project (template_id, name, client_id) VALUES (?, ?, ?)`);
  const insertValue = db.prepare(
    `INSERT INTO project_value (project_id, element_id, param_key, value_json) VALUES (?, ?, ?, ?)`,
  );
  const run = db.transaction((): { id: number } => {
    const id = Number(insertProject.run(p.templateId, p.name, p.clientId ?? null).lastInsertRowid);
    for (const v of p.values) insertValue.run(id, v.elementId, v.key, JSON.stringify(v.value ?? null));
    return { id };
  });
  return run();
}

const PROJECT_SELECT = `
  SELECT p.id, p.template_id AS templateId, t.slug AS templateSlug, t.name AS templateName,
         p.name, p.client_id AS clientId, c.name AS clientName, p.aspect AS aspect, p.treatment AS treatment, p.created_at AS createdAt, p.updated_at AS updatedAt
  FROM project p JOIN template t ON t.id = p.template_id LEFT JOIN client c ON c.id = p.client_id`;

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

// ---- project management (M22) ------------------------------------------

function renameProject(db: Database.Database, id: number, name: string): void {
  db.prepare(`UPDATE project SET name = ?, updated_at = datetime('now') WHERE id = ?`).run(name, id);
}

function setProjectAspect(db: Database.Database, id: number, aspect: string): void {
  db.prepare(`UPDATE project SET aspect = ?, updated_at = datetime('now') WHERE id = ?`).run(aspect, id);
}

function setProjectTreatment(db: Database.Database, id: number, treatment: string): void {
  db.prepare(`UPDATE project SET treatment = ?, updated_at = datetime('now') WHERE id = ?`).run(treatment, id);
}

function duplicateProject(db: Database.Database, id: number, name: string): { id: number } {
  const run = db.transaction((): { id: number } => {
    const source = db.prepare(`SELECT template_id AS templateId, client_id AS clientId, aspect, treatment FROM project WHERE id = ?`).get(id) as { templateId: number; clientId: number | null; aspect: string; treatment: string } | undefined;
    if (!source) throw new Error(`No project ${id}`);
    const copy = Number(db.prepare(`INSERT INTO project (template_id, name, client_id, aspect, treatment) VALUES (?, ?, ?, ?, ?)`).run(source.templateId, name, source.clientId, source.aspect, source.treatment).lastInsertRowid);
    db.prepare(`INSERT INTO project_value (project_id, element_id, param_key, value_json) SELECT ?, element_id, param_key, value_json FROM project_value WHERE project_id = ?`).run(copy, id);
    db.prepare(`INSERT INTO project_scene (project_id, scene_id, element_id, start_frame, end_frame, enabled) SELECT ?, scene_id, element_id, start_frame, end_frame, enabled FROM project_scene WHERE project_id = ?`).run(copy, id);
    db.prepare(`INSERT INTO project_transition (project_id, after_element_id, preset, duration_frames) SELECT ?, after_element_id, preset, duration_frames FROM project_transition WHERE project_id = ?`).run(copy, id);
    db.prepare(`INSERT INTO project_audio (project_id, asset_id, volume, in_s) SELECT ?, asset_id, volume, in_s FROM project_audio WHERE project_id = ?`).run(copy, id);
    return { id: copy };
  });
  return run();
}

function deleteProject(db: Database.Database, id: number): void {
  const run = db.transaction(() => {
    db.prepare(`DELETE FROM render WHERE project_id = ?`).run(id);
    db.prepare(`DELETE FROM project_value WHERE project_id = ?`).run(id);
    db.prepare(`DELETE FROM project_scene WHERE project_id = ?`).run(id);
    db.prepare(`DELETE FROM project_transition WHERE project_id = ?`).run(id);
    db.prepare(`DELETE FROM project_audio WHERE project_id = ?`).run(id);
    db.prepare(`DELETE FROM project WHERE id = ?`).run(id);
  });
  run();
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
