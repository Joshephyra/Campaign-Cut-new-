import {
  applyLottieValues,
  compositionConfig,
  fontsFor,
  isChromaKey,
  isMediaValue,
  mediaFillRect,
  mediaSourceFor,
  mediaTiming,
  resolveLottieAssets,
  withBaseUrl,
  type MainProps,
  type ParamValues,
  type TemplateFontFile,
  type TransitionPreset,
} from '@campaigncut/composition';
import fs from 'node:fs';
import path from 'node:path';
import type { Db } from './db/index';
import { elementBaseUrl, loadElementFiles } from './templateFiles';

export type BuildProjectPropsOptions = {
  db: Db;
  templatesDir: string;
  projectId: number;
  /** Absolute origin of this server, e.g. http://127.0.0.1:3001. The renderer fetches media from it. */
  serverBase: string;
  /** 'export' (default) hands the composition the original footage; 'preview' the proxy, as the Player does. */
  runner?: 'preview' | 'export';
};

/**
 * The SERVER-SIDE RUNNER's props for a project: the same composition the
 * Player shows, handed the ORIGINAL footage and absolute URLs. The browser
 * does the same thing with 'preview' and its /api base (see Editor.tsx).
 *
 * Every element is built from its own Lottie, schema and values (M17).
 * Footage comes from the first element, in start order, that has a media
 * slot and a clip chosen.
 */
export function buildProjectProps({ db, templatesDir, projectId, serverBase, runner = 'export' }: BuildProjectPropsOptions): MainProps {
  const project = db.getProject(projectId);
  if (!project) throw new Error(`No project ${projectId}`);

  const metaFile = path.join(templatesDir, project.templateSlug, 'meta.json');
  const meta = fs.existsSync(metaFile) ? (JSON.parse(fs.readFileSync(metaFile, 'utf8')) as { fontFiles?: TemplateFontFile[] }) : {};
  const fonts = fontsFor(meta.fontFiles, project.templateSlug, serverBase);

  const rows = db.getProjectElements(projectId);
  const files = new Map(rows.map((e) => [e.id, loadElementFiles(templatesDir, project.templateSlug, e.slug)] as const));
  const valuesFor = (elementId: number): ParamValues => {
    const raw: ParamValues = {};
    for (const v of project.values) if (v.elementId === elementId) raw[v.key] = v.value;
    return raw;
  };

  let media: MainProps['media'] = null;
  for (const e of [...rows].sort((a, b) => a.startFrame - b.startFrame || a.zIndex - b.zIndex)) {
    const { lottie: source, schema } = files.get(e.id)!;
    const mediaParam = schema.find((p) => p.kind === 'media');
    const mediaValue = mediaParam ? valuesFor(e.id)[mediaParam.key] : null;
    if (!mediaParam || !isMediaValue(mediaValue)) continue;
    const asset = db.getMediaAsset(mediaValue.assetId);
    const rect = mediaFillRect(source, mediaParam.path);
    if (!asset || !rect) continue;
    const src = mediaSourceFor({ proxyUrl: `/media/${asset.proxyPath}`, originalUrl: `/media/${asset.originalPath}` }, runner);
    media = {
      src: `${serverBase}${src}`,
      rect,
      fit: mediaValue.fit,
      key: isChromaKey(mediaValue.key) ? mediaValue.key : null,
      ...mediaTiming(mediaValue, compositionConfig.fps),
      muted: mediaValue.muted === true,
    };
    break;
  }

  // M20: the music bed. Both runners play the original file.
  let audio: MainProps['audio'] = null;
  const bed = db.getProjectAudio(projectId);
  if (bed) {
    const asset = db.getMediaAsset(bed.assetId);
    if (asset) {
      audio = { src: `${serverBase}/media/${asset.originalPath}`, volume: bed.volume, ...(bed.inS > 0 ? { startFrom: Math.round(bed.inS * compositionConfig.fps) } : {}) };
    }
  }

  const elements = rows.map((e) => {
    const { lottie: source, schema } = files.get(e.id)!;
    const resolvedSource = resolveLottieAssets(source, `${serverBase}${elementBaseUrl(templatesDir, project.templateSlug, e.slug)}`);
    const values = withBaseUrl(valuesFor(e.id), schema, serverBase);
    const lottie = applyLottieValues(resolvedSource, values, schema);
    return { id: String(e.id), lottie, startFrame: e.startFrame, endFrame: e.endFrame, zIndex: e.zIndex, enabled: e.enabled };
  });

  const transitions = db.getProjectTransitions(projectId).map((t) => ({
    afterElementId: String(t.afterElementId),
    preset: t.preset as TransitionPreset,
    durationInFrames: t.durationInFrames,
  }));

  return { background: '#000000', media, audio, elements, transitions, fonts };
}

/**
 * The template exactly as the designer authored it, no project: every
 * element with its schema defaults, no footage. What the fidelity harness
 * (M19) renders to hold against the After Effects reference.
 */
export function buildTemplateDefaultProps({ db, templatesDir, slug, serverBase }: { db: Db; templatesDir: string; slug: string; serverBase: string }): MainProps {
  const template = db.getTemplateBySlug(slug);
  if (!template) throw new Error(`No template with slug "${slug}"`);
  const metaFile = path.join(templatesDir, slug, 'meta.json');
  const meta = fs.existsSync(metaFile) ? (JSON.parse(fs.readFileSync(metaFile, 'utf8')) as { fontFiles?: TemplateFontFile[] }) : {};
  const fonts = fontsFor(meta.fontFiles, slug, serverBase);

  const elements = db.listTemplateElements(template.id).map((e) => {
    const { lottie: source, schema } = loadElementFiles(templatesDir, slug, e.slug);
    const defaults: ParamValues = {};
    for (const p of schema) defaults[p.key] = p.default;
    const resolvedSource = resolveLottieAssets(source, `${serverBase}${elementBaseUrl(templatesDir, slug, e.slug)}`);
    const lottie = applyLottieValues(resolvedSource, withBaseUrl(defaults, schema, serverBase), schema);
    return { id: e.slug, lottie, startFrame: e.startFrame, endFrame: e.endFrame, zIndex: e.zIndex, enabled: true };
  });

  return { background: '#000000', media: null, elements, transitions: [], fonts };
}
