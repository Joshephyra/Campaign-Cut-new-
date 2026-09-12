import fastifyStatic from '@fastify/static';
import type { TemplateParam } from '@campaigncut/composition';
import Fastify from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import { openDb, type Db } from './db/index';
import { paths } from './paths';

export type AppOptions = {
  db?: Db;
  templatesDir?: string;
};

function readJson<T>(file: string): T | undefined {
  if (!fs.existsSync(file)) return undefined;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

/** Builds the Fastify app without listening, so tests can inject requests. */
export function buildApp(options: AppOptions = {}) {
  const db = options.db ?? openDb(paths.db);
  const templatesDir = options.templatesDir ?? paths.templates;
  const app = Fastify({ logger: false });

  app.get('/health', async () => ({ status: 'ok' }));

  // ---- templates -------------------------------------------------------

  // Template files (template.json, thumb.png, images/) served as-is.
  fs.mkdirSync(templatesDir, { recursive: true });
  app.register(fastifyStatic, { root: templatesDir, prefix: '/templates/', index: false, list: false });

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

  return app;
}
