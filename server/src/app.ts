import fastifyCors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import type { TemplateParam } from '@campaigncut/composition';
import Fastify from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { openDb, type Db, type MediaAssetRow } from './db/index';
import { makePoster, makeProxy, probe } from './media/ffmpeg';
import { paths } from './paths';

export type AppOptions = {
  db?: Db;
  templatesDir?: string;
  mediaDir?: string;
};

function readJson<T>(file: string): T | undefined {
  if (!fs.existsSync(file)) return undefined;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v', '.webm', '.mkv', '.avi', '.mxf', '.mts', '.m2ts']);

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

  app.get<{ Params: { slug: string } }>('/templates/:slug', async (req, reply) => {
    const t = db.getTemplateBySlug(req.params.slug);
    if (!t) return reply.code(404).send({ error: `No template with slug "${req.params.slug}"` });
    const dir = path.join(templatesDir, t.slug);
    return {
      template: templateJson(t),
      meta: readJson(path.join(dir, 'meta.json')) ?? null,
      schema: readJson<TemplateParam[]>(path.join(dir, 'schema.json')) ?? [],
      elements: db.listTemplateElements(t.id),
    };
  });

  // ---- projects --------------------------------------------------------

  app.get('/projects', async () => db.listProjects());

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

    const schema = readJson<TemplateParam[]>(path.join(templatesDir, t.slug, 'schema.json')) ?? [];
    let elements = db.listTemplateElements(t.id);
    if (elements.length === 0) {
      db.upsertTemplateElement({ templateId: t.id, slug: t.slug, zIndex: 0, startFrame: 0, endFrame: t.durationFrames });
      elements = db.listTemplateElements(t.id);
    }
    const element = elements[0]!;

    const { id } = db.createProject({
      templateId: t.id,
      name: req.body?.name?.trim() || `${t.name} project`,
      values: schema.map((p) => ({ elementId: element.id, key: p.key, value: p.default })),
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
      schema: readJson<TemplateParam[]>(path.join(dir, 'schema.json')) ?? [],
      elements: db.listTemplateElements(t.id),
      values,
    };
  });

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

  // ---- media -----------------------------------------------------------

  for (const sub of ['originals', 'proxies', 'thumbs']) fs.mkdirSync(path.join(mediaDir, sub), { recursive: true });
  app.register(fastifyStatic, { root: mediaDir, prefix: '/media/', index: false, list: false, decorateReply: false });

  const assetJson = (a: MediaAssetRow) => ({
    id: a.id,
    originalName: a.originalName,
    originalUrl: `/media/${a.originalPath}`,
    proxyUrl: `/media/${a.proxyPath}`,
    thumbUrl: `/media/${a.thumbPath}`,
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
    if (!part.mimetype.startsWith('video/') && !VIDEO_EXTENSIONS.has(ext)) {
      part.file.resume();
      return reply.code(400).send({ error: `${part.filename} is not a video file` });
    }

    const stem = `${Date.now()}-${part.filename.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 60) || 'clip'}`;
    const originalPath = `originals/${stem}${ext || '.mp4'}`;
    const proxyPath = `proxies/${stem}.mp4`;
    const thumbPath = `thumbs/${stem}.jpg`;
    const originalFile = path.join(mediaDir, originalPath);

    await pipeline(part.file, fs.createWriteStream(originalFile));
    if (part.file.truncated) {
      fs.rmSync(originalFile, { force: true });
      return reply.code(413).send({ error: 'File too large' });
    }

    try {
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

  return app;
}
