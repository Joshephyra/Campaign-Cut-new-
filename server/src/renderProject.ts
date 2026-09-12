import {
  applyLottieValues,
  isMediaValue,
  mediaFillRect,
  mediaSourceFor,
  resolveLottieAssets,
  withBaseUrl,
  type LottieAnimationData,
  type MainProps,
  type ParamValues,
  type TemplateParam,
  type TransitionPreset,
} from '@campaigncut/composition';
import fs from 'node:fs';
import path from 'node:path';
import type { Db } from './db/index';

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
 */
export function buildProjectProps({ db, templatesDir, projectId, serverBase, runner = 'export' }: BuildProjectPropsOptions): MainProps {
  const project = db.getProject(projectId);
  if (!project) throw new Error(`No project ${projectId}`);

  const dir = path.join(templatesDir, project.templateSlug);
  const source = JSON.parse(fs.readFileSync(path.join(dir, 'template.json'), 'utf8')) as LottieAnimationData;
  const schema = JSON.parse(fs.readFileSync(path.join(dir, 'schema.json'), 'utf8')) as TemplateParam[];

  const raw: ParamValues = {};
  for (const v of project.values) raw[v.key] = v.value;

  let media: MainProps['media'] = null;
  const mediaParam = schema.find((p) => p.kind === 'media');
  const mediaValue = mediaParam ? raw[mediaParam.key] : null;
  if (mediaParam && isMediaValue(mediaValue)) {
    const asset = db.getMediaAsset(mediaValue.assetId);
    const rect = mediaFillRect(source, mediaParam.path);
    if (asset && rect) {
      const src = mediaSourceFor({ proxyUrl: `/media/${asset.proxyPath}`, originalUrl: `/media/${asset.originalPath}` }, runner);
      media = { src: `${serverBase}${src}`, rect, fit: mediaValue.fit };
    }
  }

  const resolvedSource = resolveLottieAssets(source, `${serverBase}/templates/${project.templateSlug}`);
  const values = withBaseUrl(raw, schema, serverBase);
  const lottie = applyLottieValues(resolvedSource, values, schema);

  // One Bodymovin export is one element today, so every element shares the
  // template's Lottie. Per-element Lotties arrive with multi-element ingest.
  const elements = db.getProjectElements(projectId).map((e) => ({
    id: String(e.id),
    lottie,
    startFrame: e.startFrame,
    endFrame: e.endFrame,
    zIndex: e.zIndex,
    enabled: e.enabled,
  }));

  const transitions = db.getProjectTransitions(projectId).map((t) => ({
    afterElementId: String(t.afterElementId),
    preset: t.preset as TransitionPreset,
    durationInFrames: t.durationInFrames,
  }));

  return { background: '#000000', media, elements, transitions };
}
