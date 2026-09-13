import type { LottieAnimationData, TemplateFontFile, TemplateParam, TransitionPreset } from '@campaigncut/composition';

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

/** A project as listed in the library (M22). */
export type ProjectRow = {
  id: number;
  templateId: number;
  templateSlug: string;
  templateName: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

/** One element of a project: its own Lottie (at lottieUrl), its own schema, and this project's in/out and toggle. */
export type ProjectElement = {
  id: number;
  slug: string;
  name: string;
  zIndex: number;
  startFrame: number;
  endFrame: number;
  enabled: boolean;
  schema: TemplateParam[];
  /** Server-relative, e.g. /templates/two/elements/open/template.json. */
  lottieUrl: string;
};

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
  meta?: { fonts?: string[]; fontFiles?: TemplateFontFile[] } | null;
  elements: ProjectElement[];
  transitions?: ProjectTransition[];
  /** The music bed, or null (M20). */
  audio?: ProjectAudio | null;
  values: ProjectValue[];
};

/** M20: a project's music bed. */
export type ProjectAudio = { assetId: number; volume: number; inS: number };

export type MediaAsset = {
  id: number;
  /** 'video' footage, or an 'audio' track (M20). */
  kind: 'video' | 'audio';
  originalName: string;
  originalUrl: string;
  proxyUrl: string;
  /** Null for audio. */
  thumbUrl: string | null;
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

  /** M22: every project, newest first. */
  projects: () => fetch(`${API}/projects`).then((r) => json<ProjectRow[]>(r)),

  renameProject: (id: number, name: string) =>
    fetch(`${API}/projects/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    }).then((r) => json<ProjectRow>(r)),

  duplicateProject: (id: number) => fetch(`${API}/projects/${id}/duplicate`, { method: 'POST' }).then((r) => json<{ id: number }>(r)),

  deleteProject: async (id: number) => {
    const res = await fetch(`${API}/projects/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  },

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

  /** M20: set the music bed, or clear it with null. */
  saveAudio: (projectId: number, audio: ProjectAudio | null) =>
    fetch(`${API}/projects/${projectId}/audio`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(audio ?? { assetId: null }),
    }).then((r) => json<ProjectAudio | null>(r)),

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

  /** An element's Lottie, at the server-relative lottieUrl the project detail gave for it. */
  elementLottie: (lottieUrl: string) => fetch(`${API}${lottieUrl}`).then((r) => json<LottieAnimationData>(r)),

  /** Absolute URL for a server-relative file path such as /templates/x/thumb.png. */
  fileUrl: (serverPath: string) => `${API}${serverPath}`,
};
