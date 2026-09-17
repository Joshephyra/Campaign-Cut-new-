import fastifyCors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { ASPECTS, carriesDisclaimer, disclaimerCheck, frameFor, isAspect, isTreatment, TREATMENTS, TRANSITION_PRESETS, type TemplateParam } from '@campaigncut/composition';
import Fastify from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { openDb, type Db, type MediaAssetRow } from './db/index';
import { makePoster, makeProxy, probe, probeAudio } from './media/ffmpeg';
import { paths } from './paths';
import { renderComposition } from './render';
import { RenderQueue, type RenderFn } from './renderQueue';
import { pexelsClient, type StockOptions } from './stock';
import { elementLottieUrl, hasVariant, loadElementSchema, projectFontFiles } from './templateFiles';
import { defaultUploadsDir, makeStagingDir, problemsFrom, runIngestCommand, stagedRelativePath, type RunIngest } from './ingestUpload';

export type { RunIngest } from './ingestUpload';

export type AppOptions = {
  db?: Db;
  templatesDir?: string;
  mediaDir?: string;
  /** Absolute origin the renderer fetches media from. Defaults to this server's own port. */
  serverBase?: string;
  /** The render function; tests inject a fast stand-in. Defaults to renderMedia. */
  render?: RenderFn;
  /** M24: runs the ingest command on a staged folder; tests inject a stand-in. */
  runIngest?: RunIngest;
  /** M24: where uploaded handover folders are staged before ingest. */
  uploadsDir?: string;
  /** M34: the stock provider's key and (in tests) fetch. Defaults to PEXELS_API_KEY from the environment. */
  stock?: StockOptions;
};

declare module 'fastify' {
  interface FastifyInstance {
    renderQueue: RenderQueue;
  }
}

const defaultRender: RenderFn = async ({ props, outputPath, onProgress }) => {
  await renderComposition({ outputPath, inputProps: props, onProgress });
};

function readJson<T>(file: string): T | undefined {
  if (!fs.existsSync(file)) return undefined;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v', '.webm', '.mkv', '.avi', '.mxf', '.mts', '.m2ts']);
/** M20: music beds. */
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac', '.aif', '.aiff']);

/** Builds the Fastify app without listening, so tests can inject requests. */
/**
 * M41: the template a spot from nothing is made on. It has no elements and
 * no files; a spot on it starts empty and is built from the library. It is
 * library-only so the grid never offers it as a design.
 */
export const BLANK_TEMPLATE = { slug: 'blank', name: 'Blank spot', adType: 'Blank', durationFrames: 0, fps: 30, width: 1920, height: 1080, thumbPath: '', libraryOnly: true } as const;

export function buildApp(options: AppOptions = {}) {
  const db = options.db ?? openDb(paths.db);
  const templatesDir = options.templatesDir ?? paths.templates;
  const mediaDir = options.mediaDir ?? paths.media;
  const app = Fastify({ logger: false });
  db.upsertTemplate(BLANK_TEMPLATE);

  // CORS on everything. The render process fetches template files and media
  // over HTTP from a different origin; a missing header here was the
  // missing-export bug (CLAUDE.md). media.test.ts guards it.
  app.register(fastifyCors, { origin: true });
  // M24 raised files from 1: a handover folder arrives as many parts.
  app.register(fastifyMultipart, { limits: { fileSize: 8 * 1024 * 1024 * 1024, files: 500 }, preservePath: true });

  app.get('/health', async () => ({ status: 'ok' }));

  // ---- templates -------------------------------------------------------

  fs.mkdirSync(templatesDir, { recursive: true });
  app.register(fastifyStatic, { root: templatesDir, prefix: '/templates/', index: false, list: false, decorateReply: true });

  const templateJson = (t: ReturnType<Db['listTemplates']>[number]) => ({
    id: t.id,
    slug: t.slug,
    name: t.name,
    adType: t.adType,
    durationFrames: t.durationFrames,
    fps: t.fps,
    width: t.width,
    height: t.height,
    thumbUrl: `/templates/${t.slug}/thumb.png`,
  });

  /** The library: ad type > ad example, in ad type sort order. */
  app.get('/templates', async () => {
    const groups: { adType: string; sort: number; templates: ReturnType<typeof templateJson>[] }[] = [];
    for (const t of db.listTemplates()) {
      if (t.libraryOnly) continue; // M38: a pack feeds the picker, not the grid
      let group = groups.find((g) => g.adType === t.adType);
      if (!group) {
        group = { adType: t.adType, sort: t.adTypeSort, templates: [] };
        groups.push(group);
      }
      group.templates.push(templateJson(t));
    }
    return groups;
  });

  /** An element as the app sees it: its DB row plus its own schema and Lottie URL (M17), for the spot's aspect (M36). */
  const withElementFiles = <E extends { slug: string }>(templateSlug: string, e: E, aspect = '16:9') => ({
    ...e,
    schema: loadElementSchema(templatesDir, templateSlug, e.slug, aspect),
    lottieUrl: elementLottieUrl(templatesDir, templateSlug, e.slug, aspect),
    /** M36: true when a designer variant for this aspect is in use, or the spot is 16:9; false means auto-fitted. */
    variant: aspect === '16:9' || hasVariant(templatesDir, templateSlug, e.slug, aspect),
  });

  app.get<{ Params: { slug: string } }>('/templates/:slug', async (req, reply) => {
    const t = db.getTemplateBySlug(req.params.slug);
    if (!t) return reply.code(404).send({ error: `No template with slug "${req.params.slug}"` });
    const dir = path.join(templatesDir, t.slug);
    return {
      template: templateJson(t),
      meta: readJson(path.join(dir, 'meta.json')) ?? null,
      elements: db.listTemplateElements(t.id).map((e) => withElementFiles(t.slug, e)),
    };
  });

  // ---- ingest from the browser (M24) -----------------------------------

  const runIngest = options.runIngest ?? runIngestCommand;
  const uploadsDir = options.uploadsDir ?? defaultUploadsDir();

  /**
   * A handover folder as multipart: fields name, adType, optional slug, and
   * every file with its path inside the picked folder as the filename. The
   * files are staged under a temporary folder and the ingest COMMAND runs on
   * it; its output comes back verbatim, with the problems picked out on 400.
   */
  app.post('/templates/ingest', async (req, reply) => {
    const fields: Record<string, string> = {};
    const staged: string[] = [];
    const dir = makeStagingDir(uploadsDir);
    try {
      for await (const part of req.parts()) {
        if (part.type === 'field') {
          fields[part.fieldname] = String(part.value ?? '').trim();
          continue;
        }
        const rel = stagedRelativePath(part.filename);
        if (rel === null) {
          part.file.resume();
          return reply.code(400).send({ error: `Refused file path "${part.filename}": paths must stay inside the picked folder` });
        }
        const target = path.join(dir, ...rel.split('/'));
        fs.mkdirSync(path.dirname(target), { recursive: true });
        await pipeline(part.file, fs.createWriteStream(target));
        staged.push(rel);
      }
      const name = fields.name ?? '';
      const adType = fields.adType ?? '';
      if (!name) return reply.code(400).send({ error: 'A template name is required' });
      if (!adType) return reply.code(400).send({ error: 'An ad type is required' });
      if (staged.length === 0) return reply.code(400).send({ error: 'No files were sent; pick the handover folder' });
      const slug = (fields.slug || name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      if (!slug) return reply.code(400).send({ error: 'The name produces an empty slug' });

      const result = await runIngest({ dir, name, adType, slug });
      if (result.code !== 0) return reply.code(400).send({ ok: false, output: result.output, problems: problemsFrom(result.output) });
      return { ok: true, slug, output: result.output };
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  // ---- projects --------------------------------------------------------

  app.get('/projects', async () => db.listProjects());

  // ---- project management (M22) ---------------------------------------

  app.patch<{ Params: { id: string }; Body: { name?: string; aspect?: string; treatment?: string } }>('/projects/:id', async (req, reply) => {
    const id = Number(req.params.id);
    if (!db.getProject(id)) return reply.code(404).send({ error: `No project ${id}` });
    if (req.body?.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) return reply.code(400).send({ error: 'name must not be empty' });
      db.renameProject(id, name);
    }
    // M36: the version's aspect ratio.
    if (req.body?.aspect !== undefined) {
      if (!isAspect(req.body.aspect)) return reply.code(400).send({ error: `Unknown aspect "${String(req.body.aspect)}"; use one of ${ASPECTS.join(', ')}` });
      db.setProjectAspect(id, req.body.aspect);
    }
    // M39: the style treatment across the spot.
    if (req.body?.treatment !== undefined) {
      if (!isTreatment(req.body.treatment)) return reply.code(400).send({ error: `Unknown treatment "${String(req.body.treatment)}"; use one of ${TREATMENTS.join(', ')}` });
      db.setProjectTreatment(id, req.body.treatment);
    }
    if (req.body?.name === undefined && req.body?.aspect === undefined && req.body?.treatment === undefined) return reply.code(400).send({ error: 'Send a name, an aspect or a treatment' });
    const { values: _values, ...project } = db.getProject(id)!;
    return project;
  });

  app.post<{ Params: { id: string } }>('/projects/:id/duplicate', async (req, reply) => {
    const id = Number(req.params.id);
    const source = db.getProject(id);
    if (!source) return reply.code(404).send({ error: `No project ${id}` });
    const copy = db.duplicateProject(id, `${source.name} copy`);
    return reply.code(201).send(copy);
  });

  app.delete<{ Params: { id: string } }>('/projects/:id', async (req, reply) => {
    const id = Number(req.params.id);
    if (!db.getProject(id)) return reply.code(404).send({ error: `No project ${id}` });
    db.deleteProject(id);
    return reply.code(204).send();
  });

  /**
   * Create a project from a template. The user starts from a finished spot:
   * every schema default is copied into project_value so the editor opens
   * with the designer's authored values.
   */
  app.post<{ Body: { templateSlug?: string; name?: string; clientId?: number | null } }>('/projects', async (req, reply) => {
    const slug = req.body?.templateSlug;
    if (!slug) return reply.code(400).send({ error: 'templateSlug is required' });
    const t = db.getTemplateBySlug(slug);
    if (!t) return reply.code(404).send({ error: `No template with slug "${slug}"` });
    // M33: a spot made for a client opens already branded.
    const clientId = req.body?.clientId ?? null;
    const client = clientId === null ? undefined : db.getClient(Number(clientId));
    if (clientId !== null && !client) return reply.code(404).send({ error: `No client ${String(clientId)}` });

    let elements = db.listTemplateElements(t.id);
    // A single-element template is its own element; a blank spot (M41) has none until the library fills it.
    if (elements.length === 0 && t.slug !== BLANK_TEMPLATE.slug) {
      db.upsertTemplateElement({ templateId: t.id, slug: t.slug, name: t.name, zIndex: 0, startFrame: 0, endFrame: t.durationFrames });
      elements = db.listTemplateElements(t.id);
    }

    const baseName = t.slug === BLANK_TEMPLATE.slug ? 'New spot' : t.name;
    const { id } = db.createProject({
      templateId: t.id,
      name: req.body?.name?.trim() || (client ? `${client.name}: ${baseName}` : t.slug === BLANK_TEMPLATE.slug ? baseName : `${t.name} project`),
      clientId: client?.id ?? null,
      values: elements.flatMap((element) =>
        loadElementSchema(templatesDir, t.slug, element.slug).map((p: TemplateParam) => ({ elementId: element.id, key: p.key, value: p.default })),
      ),
    });
    if (client) applyBrand(id, client);
    return reply.code(201).send({ id });
  });

  app.get<{ Params: { id: string } }>('/projects/:id', async (req, reply) => {
    const project = db.getProject(Number(req.params.id));
    if (!project) return reply.code(404).send({ error: `No project ${req.params.id}` });
    const t = db.getTemplateBySlug(project.templateSlug)!;
    const dir = path.join(templatesDir, t.slug);
    const { values, ...rest } = project;
    const elements = db.getProjectElements(project.id);
    const meta = (readJson(path.join(dir, 'meta.json')) as Record<string, unknown> | undefined) ?? {};
    const aspect = isAspect(project.aspect) ? project.aspect : '16:9';
    return {
      project: rest,
      template: templateJson(t),
      // M36: the frame this version renders at.
      frame: frameFor(aspect),
      // M31: the font files of every template an element came from, each tagged with its template.
      meta: { ...meta, fontFiles: projectFontFiles(templatesDir, t.slug, elements) },
      elements: elements.map((e) => withElementFiles(e.templateSlug, e, aspect)),
      transitions: db.getProjectTransitions(project.id),
      audio: db.getProjectAudio(project.id),
      values,
    };
  });

  // ---- style and themes (M32) -----------------------------------------

  const HEX = /^#[0-9a-fA-F]{6}$/;
  /** Colours by role, each #RRGGBB upper-cased, or the name of the first bad one. */
  const readColors = (raw: unknown): { colors: Record<string, string> } | { bad: string } => {
    if (!raw || typeof raw !== 'object') return { bad: 'colors' };
    const colors: Record<string, string> = {};
    for (const [role, value] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof value !== 'string' || !HEX.test(value)) return { bad: role };
      colors[role] = value.toUpperCase();
    }
    return { colors };
  };

  /**
   * Write a brand into a project: colours into every colour param by role,
   * the logo into every logo slot, the disclaimer into every disclaimer
   * field. Empty parts leave the designer's values alone. The values are
   * ordinary project values afterwards; both runners are untouched.
   */
  const applyBrand = (id: number, brand: { colors: Record<string, string>; logoUrl?: string; disclaimer?: string }) => {
    const values: { elementId: number; key: string; value: string }[] = [];
    for (const e of db.getProjectElements(id)) {
      for (const p of loadElementSchema(templatesDir, e.templateSlug, e.slug)) {
        if (p.kind === 'color' && brand.colors[p.role]) values.push({ elementId: e.id, key: p.key, value: brand.colors[p.role]! });
        else if (p.kind === 'image' && p.role === 'logo' && brand.logoUrl) values.push({ elementId: e.id, key: p.key, value: brand.logoUrl });
        else if (p.kind === 'text' && p.role === 'safe.disclaimer' && brand.disclaimer) values.push({ elementId: e.id, key: p.key, value: brand.disclaimer });
      }
    }
    if (values.length > 0) db.setProjectValues(id, values);
    return values;
  };

  /** One change recolours every scene (M32). */
  app.post<{ Params: { id: string }; Body: { colors?: Record<string, string> } }>('/projects/:id/style', async (req, reply) => {
    const id = Number(req.params.id);
    if (!db.getProject(id)) return reply.code(404).send({ error: `No project ${id}` });
    const read = readColors(req.body?.colors);
    if ('bad' in read) return reply.code(400).send({ error: `Colour for "${read.bad}" must be #rrggbb` });
    return { values: applyBrand(id, { colors: read.colors }) };
  });

  // ---- clients (M33) ---------------------------------------------------

  const readClient = (body: Partial<{ name: string; logoUrl: string; colors: Record<string, string>; disclaimer: string }> | undefined, current?: ReturnType<Db['getClient']>) => {
    const name = (body?.name ?? current?.name ?? '').trim();
    if (!name) return { error: 'A client needs a name' };
    const read = body?.colors !== undefined ? readColors(body.colors) : { colors: current?.colors ?? {} };
    if ('bad' in read) return { error: `Colour for "${read.bad}" must be #rrggbb` };
    return {
      client: {
        name,
        logoUrl: typeof body?.logoUrl === 'string' ? body.logoUrl.trim() : (current?.logoUrl ?? ''),
        colors: read.colors,
        disclaimer: typeof body?.disclaimer === 'string' ? body.disclaimer.trim() : (current?.disclaimer ?? ''),
      },
    };
  };

  app.get('/clients', async () => db.listClients());

  app.post<{ Body: Partial<{ name: string; logoUrl: string; colors: Record<string, string>; disclaimer: string }> }>('/clients', async (req, reply) => {
    const read = readClient(req.body);
    if ('error' in read) return reply.code(400).send({ error: read.error });
    const { id } = db.insertClient(read.client);
    return reply.code(201).send(db.getClient(id));
  });

  app.patch<{ Params: { id: string }; Body: Partial<{ name: string; logoUrl: string; colors: Record<string, string>; disclaimer: string }> }>('/clients/:id', async (req, reply) => {
    const id = Number(req.params.id);
    const current = db.getClient(id);
    if (!current) return reply.code(404).send({ error: `No client ${id}` });
    const read = readClient(req.body, current);
    if ('error' in read) return reply.code(400).send({ error: read.error });
    db.updateClient(id, read.client);
    return db.getClient(id);
  });

  app.delete<{ Params: { id: string } }>('/clients/:id', async (req, reply) => {
    if (!db.deleteClient(Number(req.params.id))) return reply.code(404).send({ error: `No client ${req.params.id}` });
    return { ok: true };
  });

  /** Apply the spot's client brand again (after edits, or after the client changed). */
  app.post<{ Params: { id: string } }>('/projects/:id/brand', async (req, reply) => {
    const id = Number(req.params.id);
    const project = db.getProject(id);
    if (!project) return reply.code(404).send({ error: `No project ${id}` });
    const client = project.clientId === null ? undefined : db.getClient(project.clientId);
    if (!client) return reply.code(400).send({ error: `Project ${id} has no client` });
    return { values: applyBrand(id, client) };
  });

  app.get('/themes', async () => db.listThemes());

  app.post<{ Body: { name?: string; colors?: Record<string, string> } }>('/themes', async (req, reply) => {
    const name = req.body?.name?.trim() ?? '';
    if (!name) return reply.code(400).send({ error: 'A theme needs a name' });
    const read = readColors(req.body?.colors);
    if ('bad' in read) return reply.code(400).send({ error: `Colour for "${read.bad}" must be #rrggbb` });
    const { id } = db.insertTheme({ name, colors: read.colors });
    return reply.code(201).send(db.listThemes().find((t) => t.id === id));
  });

  app.delete<{ Params: { id: string } }>('/themes/:id', async (req, reply) => {
    if (!db.deleteTheme(Number(req.params.id))) return reply.code(404).send({ error: `No theme ${req.params.id}` });
    return { ok: true };
  });

  // ---- the element library (M31) ---------------------------------------

  /** Every element of every template, typed, with its template and thumbnail, and (M37) what a preview needs: its Lottie URL, schema and fonts. */
  app.get('/elements', async () =>
    db.listLibraryElements().map(({ thumbPath, ...e }) => ({
      ...e,
      thumbUrl: thumbPath ? `/${thumbPath.replace(/^\/+/, '')}` : '',
      lottieUrl: elementLottieUrl(templatesDir, e.templateSlug, e.slug),
      schema: loadElementSchema(templatesDir, e.templateSlug, e.slug),
      fontFiles: projectFontFiles(templatesDir, e.templateSlug, []),
    })),
  );

  /** Add a library element to a project at a frame, with its authored length and its schema defaults. */
  app.post<{ Params: { id: string }; Body: { elementId?: number; startFrame?: number } }>('/projects/:id/elements', async (req, reply) => {
    const id = Number(req.params.id);
    if (!db.getProject(id)) return reply.code(404).send({ error: `No project ${id}` });
    const elementId = Number(req.body?.elementId);
    const library = db.listLibraryElements().find((e) => e.id === elementId);
    if (!library) return reply.code(404).send({ error: `No element ${String(req.body?.elementId)} in the library` });
    const startFrame = Math.max(0, Math.round(Number(req.body?.startFrame ?? 0)));
    if (!Number.isFinite(startFrame)) return reply.code(400).send({ error: 'startFrame must be a number' });
    // M45: every add is a new scene with its own values; the first use of an element keeps the element's id.
    const sceneId = db.addProjectElement(id, elementId, startFrame);
    const defaults = loadElementSchema(templatesDir, library.templateSlug, library.slug).map((p: TemplateParam) => ({ elementId: sceneId, key: p.key, value: p.default }));
    if (defaults.length > 0) db.setProjectValues(id, defaults);
    const element = db.getProjectElements(id).find((e) => e.id === sceneId)!;
    const projectAspect = db.getProject(id)!.aspect;
    return reply.code(201).send(withElementFiles(element.templateSlug, element, isAspect(projectAspect) ? projectAspect : '16:9'));
  });

  /** Remove an added element from a project. The spot's own elements can be hidden, not removed. */
  app.delete<{ Params: { id: string; elementId: string } }>('/projects/:id/elements/:elementId', async (req, reply) => {
    const id = Number(req.params.id);
    const elementId = Number(req.params.elementId);
    if (!db.getProject(id)) return reply.code(404).send({ error: `No project ${id}` });
    const current = db.getProjectElements(id).find((e) => e.id === elementId);
    if (!current) return reply.code(404).send({ error: `No element ${elementId} in project ${id}` });
    if (!current.added) return reply.code(400).send({ error: `Element ${elementId} came with the spot's template; hide it instead of removing it` });
    db.removeProjectElement(id, elementId);
    return { ok: true };
  });

  /** Choose the transition on the boundary after an element. 'cut' clears it. */
  app.put<{ Params: { id: string; afterElementId: string }; Body: { preset?: string; durationInFrames?: number } }>(
    '/projects/:id/transitions/:afterElementId',
    async (req, reply) => {
      const id = Number(req.params.id);
      const afterElementId = Number(req.params.afterElementId);
      const preset = req.body?.preset;
      if (!preset || !(TRANSITION_PRESETS as readonly string[]).includes(preset)) {
        return reply.code(400).send({ error: `preset must be one of ${TRANSITION_PRESETS.join(', ')}` });
      }
      const durationInFrames = preset === 'cut' ? 0 : Math.round(Number(req.body?.durationInFrames));
      if (preset !== 'cut' && (!Number.isFinite(durationInFrames) || durationInFrames < 1)) {
        return reply.code(400).send({ error: 'durationInFrames must be a whole number of at least 1' });
      }
      if (!db.getProject(id)) return reply.code(404).send({ error: `No project ${id}` });
      if (!db.getProjectElements(id).some((e) => e.id === afterElementId)) {
        return reply.code(404).send({ error: `No element ${afterElementId} in project ${id}` });
      }
      db.setProjectTransition(id, afterElementId, { preset, durationInFrames });
      return { transitions: db.getProjectTransitions(id) };
    },
  );

  /** Move an element in time or toggle it, for this project only. */
  app.put<{ Params: { id: string; elementId: string }; Body: { startFrame?: number; endFrame?: number; enabled?: boolean } }>(
    '/projects/:id/elements/:elementId',
    async (req, reply) => {
      const id = Number(req.params.id);
      const elementId = Number(req.params.elementId);
      const body = req.body ?? {};
      const patch: { startFrame?: number; endFrame?: number; enabled?: boolean } = {};
      if (body.startFrame !== undefined) patch.startFrame = Math.max(0, Math.round(Number(body.startFrame)));
      if (body.endFrame !== undefined) patch.endFrame = Math.max(0, Math.round(Number(body.endFrame)));
      if (body.enabled !== undefined) patch.enabled = Boolean(body.enabled);
      if ([patch.startFrame, patch.endFrame].some((v) => v !== undefined && !Number.isFinite(v))) {
        return reply.code(400).send({ error: 'startFrame and endFrame must be numbers' });
      }
      if (!db.getProject(id)) return reply.code(404).send({ error: `No project ${id}` });
      const current = db.getProjectElements(id).find((e) => e.id === elementId);
      if (!current) return reply.code(404).send({ error: `No element ${elementId} in project ${id}` });
      const start = patch.startFrame ?? current.startFrame;
      const end = patch.endFrame ?? current.endFrame;
      if (end <= start) return reply.code(400).send({ error: `endFrame (${end}) must be after startFrame (${start})` });
      db.setProjectElement(id, elementId, patch);
      return db.getProjectElements(id).find((e) => e.id === elementId);
    },
  );

  /** Save edited values. Only the given keys change; the rest are untouched. */
  app.put<{ Params: { id: string }; Body: { values?: { elementId: number; key: string; value: unknown }[] } }>(
    '/projects/:id/values',
    async (req, reply) => {
      const id = Number(req.params.id);
      const values = req.body?.values;
      if (!Array.isArray(values) || values.some((v) => !v || typeof v.elementId !== 'number' || typeof v.key !== 'string')) {
        return reply.code(400).send({ error: 'body must be { values: [{ elementId, key, value }] }' });
      }
      if (!db.getProject(id)) return reply.code(404).send({ error: `No project ${id}` });
      db.setProjectValues(id, values);
      return { ok: true, saved: values.length };
    },
  );

  /** M20: set or clear the project's music bed. { assetId: null } clears it. */
  app.put<{ Params: { id: string }; Body: { assetId?: number | null; volume?: number; inS?: number } }>('/projects/:id/audio', async (req, reply) => {
    const id = Number(req.params.id);
    if (!db.getProject(id)) return reply.code(404).send({ error: `No project ${id}` });
    const body = req.body ?? {};
    if (body.assetId === null || body.assetId === undefined) {
      db.setProjectAudio(id, null);
      return reply.send(null);
    }
    const asset = db.getMediaAsset(Number(body.assetId));
    if (!asset) return reply.code(404).send({ error: `No media asset ${String(body.assetId)}` });
    if (asset.kind !== 'audio') return reply.code(400).send({ error: `${asset.originalName} is footage, not an audio track` });
    const volume = body.volume === undefined ? 1 : Number(body.volume);
    const inS = body.inS === undefined ? 0 : Number(body.inS);
    if (!Number.isFinite(volume) || volume < 0 || volume > 1) return reply.code(400).send({ error: 'volume must be between 0 and 1' });
    if (!Number.isFinite(inS) || inS < 0) return reply.code(400).send({ error: 'inS must be zero or more seconds' });
    const audio = { assetId: asset.id, volume, inS };
    db.setProjectAudio(id, audio);
    return audio;
  });

  // ---- media -----------------------------------------------------------

  for (const sub of ['originals', 'proxies', 'thumbs']) fs.mkdirSync(path.join(mediaDir, sub), { recursive: true });
  app.register(fastifyStatic, { root: mediaDir, prefix: '/media/', index: false, list: false, decorateReply: false });

  const assetJson = (a: MediaAssetRow) => ({
    id: a.id,
    kind: a.kind,
    originalName: a.originalName,
    originalUrl: `/media/${a.originalPath}`,
    proxyUrl: `/media/${a.proxyPath}`,
    thumbUrl: a.thumbPath ? `/media/${a.thumbPath}` : null,
    width: a.width,
    height: a.height,
    durationS: a.durationS,
    fps: a.fps,
    createdAt: a.createdAt,
  });

  app.get('/media', async () => db.listMediaAssets().map(assetJson));

  app.get<{ Params: { id: string } }>('/media/:id', async (req, reply) => {
    const a = db.getMediaAsset(Number(req.params.id));
    if (!a) return reply.code(404).send({ error: `No media asset ${req.params.id}` });
    return assetJson(a);
  });

  /**
   * Upload footage. The original lands in /media/originals; ffprobe reads
   * its metadata; ffmpeg writes a 960-wide proxy (what the Player uses) and
   * a poster. Processing happens inline: one clip at a time is fine here.
   */
  app.post('/media', async (req, reply) => {
    const part = await req.file();
    if (!part) return reply.code(400).send({ error: 'Send one file in a multipart field named "file"' });

    const ext = path.extname(part.filename).toLowerCase();
    const isVideo = part.mimetype.startsWith('video/') || VIDEO_EXTENSIONS.has(ext);
    const isAudio = !isVideo && (part.mimetype.startsWith('audio/') || AUDIO_EXTENSIONS.has(ext));
    if (!isVideo && !isAudio) {
      part.file.resume();
      return reply.code(400).send({ error: `${part.filename} is not a video or audio file` });
    }

    const stem = `${Date.now()}-${part.filename.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 60) || 'clip'}`;
    const originalPath = `originals/${stem}${ext || (isAudio ? '.mp3' : '.mp4')}`;
    const proxyPath = `proxies/${stem}.mp4`;
    const thumbPath = `thumbs/${stem}.jpg`;
    const originalFile = path.join(mediaDir, originalPath);

    await pipeline(part.file, fs.createWriteStream(originalFile));
    if (part.file.truncated) {
      fs.rmSync(originalFile, { force: true });
      return reply.code(413).send({ error: 'File too large' });
    }

    try {
      if (isAudio) {
        // M20: a music bed. No proxy, no poster; both runners play the original.
        const info = await probeAudio(originalFile);
        const { id } = db.insertMediaAsset({
          kind: 'audio',
          originalName: part.filename,
          originalPath,
          proxyPath: originalPath,
          thumbPath: '',
          width: 0,
          height: 0,
          durationS: info.durationS,
          fps: 0,
        });
        return reply.code(201).send(assetJson(db.getMediaAsset(id)!));
      }
      const { id } = await registerVideo(originalFile, { originalPath, proxyPath, thumbPath }, part.filename);
      return reply.code(201).send(assetJson(db.getMediaAsset(id)!));
    } catch (err) {
      for (const p of [originalPath, proxyPath, thumbPath]) fs.rmSync(path.join(mediaDir, p), { force: true });
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  /** A video file already at its original path becomes an asset: proxy, poster, row. Uploads and stock imports share this. */
  async function registerVideo(originalFile: string, rel: { originalPath: string; proxyPath: string; thumbPath: string }, originalName: string): Promise<{ id: number }> {
    const info = await probe(originalFile);
    await makeProxy(originalFile, path.join(mediaDir, rel.proxyPath));
    await makePoster(originalFile, path.join(mediaDir, rel.thumbPath), Math.min(1, info.durationS / 2));
    return db.insertMediaAsset({
      originalName,
      originalPath: rel.originalPath,
      proxyPath: rel.proxyPath,
      thumbPath: rel.thumbPath,
      width: info.width,
      height: info.height,
      durationS: info.durationS,
      fps: info.fps,
    });
  }

  // ---- stock footage (M34) --------------------------------------------

  const stock = pexelsClient(options.stock ?? { apiKey: process.env.PEXELS_API_KEY ?? '' });
  const STOCK_OFF = 'Stock footage is off: set PEXELS_API_KEY in .env and restart the server';

  app.get<{ Querystring: { q?: string } }>('/stock/search', async (req, reply) => {
    if (!stock.enabled) return reply.code(503).send({ error: STOCK_OFF });
    const q = (req.query.q ?? '').trim();
    if (!q) return reply.code(400).send({ error: 'Say what to search for' });
    try {
      return { results: await stock.search(q) };
    } catch (err) {
      return reply.code(502).send({ error: (err as Error).message });
    }
  });

  /** Download a stock clip and register it like an upload. */
  app.post<{ Body: { provider?: string; id?: string } }>('/stock/import', async (req, reply) => {
    if (!stock.enabled) return reply.code(503).send({ error: STOCK_OFF });
    if (req.body?.provider !== 'pexels') return reply.code(400).send({ error: `Unknown stock provider "${String(req.body?.provider)}"` });
    const id = String(req.body?.id ?? '').trim();
    if (!id) return reply.code(400).send({ error: 'id is required' });
    let found: Awaited<ReturnType<typeof stock.video>>;
    try {
      found = await stock.video(id);
    } catch (err) {
      return reply.code(502).send({ error: (err as Error).message });
    }
    if (!found) return reply.code(404).send({ error: `Pexels has no video ${id}` });
    const { result, file } = found;
    const stem = `${Date.now()}-pexels-${id}`;
    const rel = { originalPath: `originals/${stem}.mp4`, proxyPath: `proxies/${stem}.mp4`, thumbPath: `thumbs/${stem}.jpg` };
    const originalFile = path.join(mediaDir, rel.originalPath);
    try {
      fs.writeFileSync(originalFile, await stock.download(file.link));
      const asset = await registerVideo(originalFile, rel, `${result.title} (${result.credit}).mp4`);
      return reply.code(201).send(assetJson(db.getMediaAsset(asset.id)!));
    } catch (err) {
      for (const p of Object.values(rel)) fs.rmSync(path.join(mediaDir, p), { force: true });
      return reply.code(502).send({ error: (err as Error).message });
    }
  });

  // ---- render (export) -------------------------------------------------

  const serverBase = options.serverBase ?? `http://127.0.0.1:${process.env.CAMPAIGNCUT_SERVER_PORT ?? 3001}`;
  const queue = new RenderQueue({
    db,
    templatesDir,
    rendersDir: path.join(mediaDir, 'renders'),
    serverBase,
    render: options.render ?? defaultRender,
  });

  app.decorate('renderQueue', queue);

  const renderJson = (r: NonNullable<ReturnType<Db['getRender']>>) => ({
    id: r.id,
    projectId: r.projectId,
    status: r.status,
    progress: r.progress,
    outputUrl: r.status === 'done' && r.outputPath ? `/media/${r.outputPath}` : null,
    error: r.error,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  });

  /** Queue an export of a project. One render at a time; poll GET /render/:id. */
  app.post<{ Body: { projectId?: number } }>('/render', async (req, reply) => {
    const projectId = Number(req.body?.projectId);
    if (!projectId) return reply.code(400).send({ error: 'projectId is required' });
    const project = db.getProject(projectId);
    if (!project) return reply.code(404).send({ error: `No project ${projectId}` });
    // M35: the one compliance check. A disclaimer must be on screen for four seconds.
    const template = db.getTemplateBySlug(project.templateSlug)!;
    const scenes = db.getProjectElements(projectId).map((e) => {
      const values: Record<string, unknown> = {};
      for (const v of project.values) if (v.elementId === e.id) values[v.key] = v.value;
      return { startFrame: e.startFrame, endFrame: e.endFrame, enabled: e.enabled, hasDisclaimer: carriesDisclaimer(loadElementSchema(templatesDir, e.templateSlug, e.slug), values) };
    });
    const check = disclaimerCheck(scenes, template.fps);
    if (!check.ok) return reply.code(400).send({ error: check.message });
    const { id } = queue.enqueue(projectId);
    return reply.code(202).send(renderJson(db.getRender(id)!));
  });

  app.get<{ Params: { id: string } }>('/render/:id', async (req, reply) => {
    const r = db.getRender(Number(req.params.id));
    if (!r) return reply.code(404).send({ error: `No render ${req.params.id}` });
    return renderJson(r);
  });

  app.get<{ Querystring: { projectId?: string } }>('/renders', async (req) => {
    const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
    return db.listRenders(projectId).map(renderJson);
  });

  // ---- images (logo replacement) --------------------------------------

  fs.mkdirSync(path.join(mediaDir, 'images'), { recursive: true });

  app.post('/images', async (req, reply) => {
    const part = await req.file();
    if (!part) return reply.code(400).send({ error: 'Send one file in a multipart field named "file"' });
    const ext = path.extname(part.filename).toLowerCase();
    if (!part.mimetype.startsWith('image/') && !IMAGE_EXTENSIONS.has(ext)) {
      part.file.resume();
      return reply.code(400).send({ error: `${part.filename} is not an image file` });
    }
    const stem = `${Date.now()}-${part.filename.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 60) || 'image'}`;
    const rel = `images/${stem}${ext || '.png'}`;
    await pipeline(part.file, fs.createWriteStream(path.join(mediaDir, rel)));
    return reply.code(201).send({ url: `/media/${rel}` });
  });

  return app;
}

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);
