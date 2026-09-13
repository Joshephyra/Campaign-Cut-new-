import fastifyCors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { TRANSITION_PRESETS, type TemplateParam } from '@campaigncut/composition';
import Fastify from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { openDb, type Db, type MediaAssetRow } from './db/index';
import { makePoster, makeProxy, probe, probeAudio } from './media/ffmpeg';
import { paths } from './paths';
import { renderComposition } from './render';
import { RenderQueue, type RenderFn } from './renderQueue';
import { elementLottieUrl, loadElementSchema } from './templateFiles';

export type AppOptions = {
  db?: Db;
  templatesDir?: string;
  mediaDir?: string;
  /** Absolute origin the renderer fetches media from. Defaults to this server's own port. */
  serverBase?: string;
  /** The render function; tests inject a fast stand-in. Defaults to renderMedia. */
  render?: RenderFn;
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
export function buildApp(options: AppOptions = {}) {
  const db = options.db ?? openDb(paths.db);
  const templatesDir = options.templatesDir ?? paths.templates;
  const mediaDir = options.mediaDir ?? paths.media;
  const app = Fastify({ logger: false });

  // CORS on everything. The render process fetches template files and media
  // over HTTP from a different origin; a missing header here was the
  // missing-export bug (CLAUDE.md). media.test.ts guards it.
  app.register(fastifyCors, { origin: true });
  app.register(fastifyMultipart, { limits: { fileSize: 8 * 1024 * 1024 * 1024, files: 1 } });

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
      let group = groups.find((g) => g.adType === t.adType);
      if (!group) {
        group = { adType: t.adType, sort: t.adTypeSort, templates: [] };
        groups.push(group);
      }
      group.templates.push(templateJson(t));
    }
    return groups;
  });

  /** An element as the app sees it: its DB row plus its own schema and Lottie URL (M17). */
  const withElementFiles = <E extends { slug: string }>(templateSlug: string, e: E) => ({
    ...e,
    schema: loadElementSchema(templatesDir, templateSlug, e.slug),
    lottieUrl: elementLottieUrl(templatesDir, templateSlug, e.slug),
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

  // ---- projects --------------------------------------------------------

  app.get('/projects', async () => db.listProjects());

  // ---- project management (M22) ---------------------------------------

  app.patch<{ Params: { id: string }; Body: { name?: string } }>('/projects/:id', async (req, reply) => {
    const id = Number(req.params.id);
    if (!db.getProject(id)) return reply.code(404).send({ error: `No project ${id}` });
    const name = String(req.body?.name ?? '').trim();
    if (!name) return reply.code(400).send({ error: 'name must not be empty' });
    db.renameProject(id, name);
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
  app.post<{ Body: { templateSlug?: string; name?: string } }>('/projects', async (req, reply) => {
    const slug = req.body?.templateSlug;
    if (!slug) return reply.code(400).send({ error: 'templateSlug is required' });
    const t = db.getTemplateBySlug(slug);
    if (!t) return reply.code(404).send({ error: `No template with slug "${slug}"` });

    let elements = db.listTemplateElements(t.id);
    if (elements.length === 0) {
      db.upsertTemplateElement({ templateId: t.id, slug: t.slug, name: t.name, zIndex: 0, startFrame: 0, endFrame: t.durationFrames });
      elements = db.listTemplateElements(t.id);
    }

    const { id } = db.createProject({
      templateId: t.id,
      name: req.body?.name?.trim() || `${t.name} project`,
      values: elements.flatMap((element) =>
        loadElementSchema(templatesDir, t.slug, element.slug).map((p: TemplateParam) => ({ elementId: element.id, key: p.key, value: p.default })),
      ),
    });
    return reply.code(201).send({ id });
  });

  app.get<{ Params: { id: string } }>('/projects/:id', async (req, reply) => {
    const project = db.getProject(Number(req.params.id));
    if (!project) return reply.code(404).send({ error: `No project ${req.params.id}` });
    const t = db.getTemplateBySlug(project.templateSlug)!;
    const dir = path.join(templatesDir, t.slug);
    const { values, ...rest } = project;
    return {
      project: rest,
      template: templateJson(t),
      meta: readJson(path.join(dir, 'meta.json')) ?? null,
      elements: db.getProjectElements(project.id).map((e) => withElementFiles(t.slug, e)),
      transitions: db.getProjectTransitions(project.id),
      audio: db.getProjectAudio(project.id),
      values,
    };
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
      const info = await probe(originalFile);
      await makeProxy(originalFile, path.join(mediaDir, proxyPath));
      await makePoster(originalFile, path.join(mediaDir, thumbPath), Math.min(1, info.durationS / 2));
      const { id } = db.insertMediaAsset({
        originalName: part.filename,
        originalPath,
        proxyPath,
        thumbPath,
        width: info.width,
        height: info.height,
        durationS: info.durationS,
        fps: info.fps,
      });
      return reply.code(201).send(assetJson(db.getMediaAsset(id)!));
    } catch (err) {
      for (const p of [originalPath, proxyPath, thumbPath]) fs.rmSync(path.join(mediaDir, p), { force: true });
      return reply.code(400).send({ error: (err as Error).message });
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
    if (!db.getProject(projectId)) return reply.code(404).send({ error: `No project ${projectId}` });
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
