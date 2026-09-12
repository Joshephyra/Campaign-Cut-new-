import type { LottieAnimationData, TemplateParam } from '@campaigncut/composition';

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

export type ProjectDetail = {
  project: { id: number; name: string; templateId: number; templateSlug: string; templateName: string };
  template: TemplateSummary;
  schema: TemplateParam[];
  elements: { id: number; slug: string; zIndex: number; startFrame: number; endFrame: number }[];
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

  media: () => fetch(`${API}/media`).then((r) => json<MediaAsset[]>(r)),

  uploadMedia: (file: File) => {
    const body = new FormData();
    body.append('file', file, file.name);
    return fetch(`${API}/media`, { method: 'POST', body }).then((r) => json<MediaAsset>(r));
  },

  templateLottie: (slug: string) => fetch(`${API}/templates/${slug}/template.json`).then((r) => json<LottieAnimationData>(r)),

  /** Absolute URL for a server-relative file path such as /templates/x/thumb.png. */
  fileUrl: (serverPath: string) => `${API}${serverPath}`,
};
