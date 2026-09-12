import type { LottieAnimationData, TemplateParam, TransitionPreset } from '@campaigncut/composition';

/** All API calls go through Vite's /api proxy in dev. */
export const API = '/api';

export type TemplateSummary = {
  id: number;
  slug: string;
  name: string;
  adType?: string;
  durationFrames: number;
  fps: number;
  width: number;
  height: number;
  thumbUrl: string;
};

export type LibraryGroup = { adType: string; sort: number; templates: TemplateSummary[] };

export type ProjectValue = { elementId: number; key: string; value: unknown };

export type ProjectElement = { id: number; slug: string; zIndex: number; startFrame: number; endFrame: number; enabled: boolean };

export type RenderJob = {
  id: number;
  projectId: number;
  status: 'queued' | 'rendering' | 'done' | 'failed';
  progress: number;
  outputUrl: string | null;
  error: string | null;
};

export type ProjectTransition = { afterElementId: number; preset: TransitionPreset; durationInFrames: number };

export type ProjectDetail = {
  project: { id: number; name: string; templateId: number; templateSlug: string; templateName: string };
  template: TemplateSummary;
  schema: TemplateParam[];
  elements: ProjectElement[];
  transitions?: ProjectTransition[];
  values: ProjectValue[];
};

export type MediaAsset = {
  id: number;
  originalName: string;
  originalUrl: string;
  proxyUrl: string;
  thumbUrl: string;
  width: number;
  height: number;
  durationS: number;
  fps: number;
};

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export const api = {
  library: () => fetch(`${API}/templates`).then((r) => json<LibraryGroup[]>(r)),

  createProject: (templateSlug: string) =>
    fetch(`${API}/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ templateSlug }),
    }).then((r) => json<{ id: number }>(r)),

  project: (id: number) => fetch(`${API}/projects/${id}`).then((r) => json<ProjectDetail>(r)),

  saveValues: (id: number, values: ProjectValue[]) =>
    fetch(`${API}/projects/${id}/values`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ values }),
    }).then((r) => json<{ ok: boolean }>(r)),

  saveElement: (projectId: number, elementId: number, patch: Partial<Pick<ProjectElement, 'startFrame' | 'endFrame' | 'enabled'>>) =>
    fetch(`${API}/projects/${projectId}/elements/${elementId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    }).then((r) => json<ProjectElement>(r)),

  saveTransition: (projectId: number, afterElementId: number, t: { preset: TransitionPreset; durationInFrames: number }) =>
    fetch(`${API}/projects/${projectId}/transitions/${afterElementId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(t),
    }).then((r) => json<{ transitions: ProjectTransition[] }>(r)),

  startRender: (projectId: number) =>
    fetch(`${API}/render`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId }),
    }).then((r) => json<RenderJob>(r)),

  renderStatus: (id: number) => fetch(`${API}/render/${id}`).then((r) => json<RenderJob>(r)),

  media: () => fetch(`${API}/media`).then((r) => json<MediaAsset[]>(r)),

  uploadMedia: (file: File) => {
    const body = new FormData();
    body.append('file', file, file.name);
    return fetch(`${API}/media`, { method: 'POST', body }).then((r) => json<MediaAsset>(r));
  },

  uploadImage: (file: File) => {
    const body = new FormData();
    body.append('file', file, file.name);
    return fetch(`${API}/images`, { method: 'POST', body }).then((r) => json<{ url: string }>(r));
  },

  templateLottie: (slug: string) => fetch(`${API}/templates/${slug}/template.json`).then((r) => json<LottieAnimationData>(r)),

  /** Absolute URL for a server-relative file path such as /templates/x/thumb.png. */
  fileUrl: (serverPath: string) => `${API}${serverPath}`,
};
