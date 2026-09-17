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
  type LottieAnimationData,
  type MainMedia,
  type MainProps,
  type ParamValues,
  type TemplateParam,
  type TransitionPreset,
} from '@campaigncut/composition';
import type { Db } from './db/index';
import { elementBaseUrl, loadElementFiles, projectFontFiles, readTemplateMeta } from './templateFiles';

/** Shown wherever no element covers the frame, unless the template's meta carries its own (M27). */
export const DEFAULT_BACKGROUND = '#000000';

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

  const meta = readTemplateMeta(templatesDir, project.templateSlug);
  const rows = db.getProjectElements(projectId);
  // M31: fonts from every template an element came from, each against its own folder.
  const fonts = fontsFor(projectFontFiles(templatesDir, project.templateSlug, rows), project.templateSlug, serverBase);
  const background = meta.background ?? DEFAULT_BACKGROUND;

  const files = new Map(rows.map((e) => [e.id, loadElementFiles(templatesDir, e.templateSlug, e.slug)] as const));
  const valuesFor = (elementId: number): ParamValues => {
    const raw: ParamValues = {};
    for (const v of project.values) if (v.elementId === elementId) raw[v.key] = v.value;
    return raw;
  };

  /** M21: each element's own footage, from its own cc.mediaFill value, or null. */
  const mediaFor = (elementId: number, source: LottieAnimationData, schema: TemplateParam[]): MainMedia | null => {
    const mediaParam = schema.find((p) => p.kind === 'media');
    const mediaValue = mediaParam ? valuesFor(elementId)[mediaParam.key] : null;
    if (!mediaParam || !isMediaValue(mediaValue)) return null;
    const asset = db.getMediaAsset(mediaValue.assetId);
    const rect = mediaFillRect(source, mediaParam.path);
    if (!asset || !rect) return null;
    const src = mediaSourceFor({ proxyUrl: `/media/${asset.proxyPath}`, originalUrl: `/media/${asset.originalPath}` }, runner);
    return {
      src: `${serverBase}${src}`,
      rect,
      fit: mediaValue.fit,
      key: isChromaKey(mediaValue.key) ? mediaValue.key : null,
      ...mediaTiming(mediaValue, compositionConfig.fps),
      muted: mediaValue.muted === true,
    };
  };

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
    const resolvedSource = resolveLottieAssets(source, `${serverBase}${elementBaseUrl(templatesDir, e.templateSlug, e.slug)}`);
    const values = withBaseUrl(valuesFor(e.id), schema, serverBase);
    const lottie = applyLottieValues(resolvedSource, values, schema);
    return { id: String(e.id), lottie, startFrame: e.startFrame, endFrame: e.endFrame, zIndex: e.zIndex, enabled: e.enabled, media: mediaFor(e.id, source, schema) };
  });

  const transitions = db.getProjectTransitions(projectId).map((t) => ({
    afterElementId: String(t.afterElementId),
    preset: t.preset as TransitionPreset,
    durationInFrames: t.durationInFrames,
  }));

  return { background, audio, elements, transitions, fonts };
}

/**
 * The template exactly as the designer authored it, no project: every
 * element with its schema defaults, no footage. What the fidelity harness
 * (M19) renders to hold against the After Effects reference.
 */
export function buildTemplateDefaultProps({ db, templatesDir, slug, serverBase }: { db: Db; templatesDir: string; slug: string; serverBase: string }): MainProps {
  const template = db.getTemplateBySlug(slug);
  if (!template) throw new Error(`No template with slug "${slug}"`);
  const meta = readTemplateMeta(templatesDir, slug);
  const fonts = fontsFor(meta.fontFiles, slug, serverBase);

  const elements = db.listTemplateElements(template.id).map((e) => {
    const { lottie: source, schema } = loadElementFiles(templatesDir, slug, e.slug);
    const defaults: ParamValues = {};
    for (const p of schema) defaults[p.key] = p.default;
    const resolvedSource = resolveLottieAssets(source, `${serverBase}${elementBaseUrl(templatesDir, slug, e.slug)}`);
    const lottie = applyLottieValues(resolvedSource, withBaseUrl(defaults, schema, serverBase), schema);
    return { id: e.slug, lottie, startFrame: e.startFrame, endFrame: e.endFrame, zIndex: e.zIndex, enabled: true, media: null };
  });

  return { background: meta.background ?? DEFAULT_BACKGROUND, elements, transitions: [], fonts };
}
