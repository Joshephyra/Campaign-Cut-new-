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

/** M24: what POST /templates/ingest answers. */
export type IngestAnswer = { ok: true; slug: string; output: string } | { ok: false; output: string; problems: string[] };

/** A project as listed in the library (M22). */
export type ProjectRow = {
  id: number;
  templateId: number;
  templateSlug: string;
  templateName: string;
  name: string;
  /** M33: the client this spot is for, or null. */
  clientId?: number | null;
  clientName?: string | null;
  createdAt: string;
  updatedAt: string;
};

/** M34: one stock search result. */
export type StockResult = { provider: 'pexels'; id: string; title: string; thumbUrl: string; durationS: number; width: number; height: number; credit: string; pageUrl: string };

/** M33: a client profile: the brand guide a spot is made for. */
export type Client = { id: number; name: string; logoUrl: string; colors: Record<string, string>; disclaimer: string; createdAt: string };
export type ClientInput = Omit<Client, 'id' | 'createdAt'>;

/** One element of a project: its own Lottie (at lottieUrl), its own schema, and this project's in/out and toggle. */
export type ProjectElement = {
  id: number;
  slug: string;
  name: string;
  /** M31: what the element is (ELEMENT_TYPES). */
  type: string;
  /** M31: the template whose files this element uses. */
  templateSlug: string;
  /** M31: added from the library rather than part of the spot's template. Removable. */
  added: boolean;
  zIndex: number;
  startFrame: number;
  endFrame: number;
  enabled: boolean;
  schema: TemplateParam[];
  /** Server-relative, e.g. /templates/two/elements/open/template.json. */
  lottieUrl: string;
};

/** M32: a saved theme: colours by role. */
export type Theme = { id: number; name: string; colors: Record<string, string>; createdAt: string };

/** M31: one element of the library: any template's element, with its template. */
export type LibraryElement = {
  id: number;
  slug: string;
  name: string;
  type: string;
  durationInFrames: number;
  templateId: number;
  templateSlug: string;
  templateName: string;
  thumbUrl: string;
};

export type RenderJob = {
  id: number;
  projectId: number;
  status: 'queued' | 'rendering' | 'done' | 'failed';
  progress: number;
  outputUrl: string | null;
  error: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type ProjectTransition = { afterElementId: number; preset: TransitionPreset; durationInFrames: number };

export type ProjectDetail = {
  project: { id: number; name: string; templateId: number; templateSlug: string; templateName: string; clientId?: number | null; clientName?: string | null };
  template: TemplateSummary;
  meta?: { fonts?: string[]; fontFiles?: TemplateFontFile[]; background?: string } | null;
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

  createProject: (templateSlug: string, clientId?: number) =>
    fetch(`${API}/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(clientId === undefined ? { templateSlug } : { templateSlug, clientId }),
    }).then((r) => json<{ id: number }>(r)),

  /** M33: clients, by name. */
  clients: () => fetch(`${API}/clients`).then((r) => json<Client[]>(r)),
  createClient: (input: ClientInput) =>
    fetch(`${API}/clients`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) }).then((r) => json<Client>(r)),
  updateClient: (id: number, input: Partial<ClientInput>) =>
    fetch(`${API}/clients/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) }).then((r) => json<Client>(r)),
  deleteClient: async (id: number) => {
    const res = await fetch(`${API}/clients/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  },
  /** M34: search the stock site. The server's own message comes back as the error (for example, the key is not set). */
  searchStock: async (q: string): Promise<StockResult[]> => {
    const res = await fetch(`${API}/stock/search?q=${encodeURIComponent(q)}`);
    const body = (await res.json()) as { results?: StockResult[]; error?: string };
    if (!res.ok) throw new Error(body.error ?? `${res.status} ${res.statusText}`);
    return body.results ?? [];
  },
  /** M34: pull a stock clip into the footage. Answers the new asset. */
  importStock: async (provider: string, id: string): Promise<MediaAsset> => {
    const res = await fetch(`${API}/stock/import`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provider, id }) });
    const body = (await res.json()) as MediaAsset & { error?: string };
    if (!res.ok) throw new Error(body.error ?? `${res.status} ${res.statusText}`);
    return body;
  },

  /** M33: apply the spot's client brand again. Answers the values written. */
  applyBrand: (projectId: number) => fetch(`${API}/projects/${projectId}/brand`, { method: 'POST' }).then((r) => json<{ values: ProjectValue[] }>(r)),

  project: (id: number) => fetch(`${API}/projects/${id}`).then((r) => json<ProjectDetail>(r)),

  /** M31: every element of every template. */
  libraryElements: () => fetch(`${API}/elements`).then((r) => json<LibraryElement[]>(r)),

  /** M32: write colours by role into every scene of a project. Answers the values written. */
  applyStyle: (projectId: number, colors: Record<string, string>) =>
    fetch(`${API}/projects/${projectId}/style`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ colors }),
    }).then((r) => json<{ values: ProjectValue[] }>(r)),

  /** M32: saved themes, newest first. */
  themes: () => fetch(`${API}/themes`).then((r) => json<Theme[]>(r)),
  saveTheme: (name: string, colors: Record<string, string>) =>
    fetch(`${API}/themes`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, colors }) }).then((r) => json<Theme>(r)),
  deleteTheme: async (id: number) => {
    const res = await fetch(`${API}/themes/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  },

  /** M31: add a library element to a project at a frame. Answers the new project element with its files. */
  addElement: (projectId: number, elementId: number, startFrame: number) =>
    fetch(`${API}/projects/${projectId}/elements`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ elementId, startFrame }),
    }).then((r) => json<ProjectElement>(r)),

  /** M31: remove an added element from a project. */
  removeElement: async (projectId: number, elementId: number) => {
    const res = await fetch(`${API}/projects/${projectId}/elements/${elementId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  },

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

  /** M25: every render of a project, newest first. */
  renders: (projectId: number) => fetch(`${API}/renders?projectId=${projectId}`).then((r) => json<RenderJob[]>(r)),

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

  /**
   * M24: ingest a handover folder from the browser. Each file is sent with
   * its path inside the picked folder. Resolves with the server's answer
   * whether it succeeded (ok true) or the ingest rejected it (ok false with
   * the problems); throws only when the request itself fails.
   */
  ingestTemplate: async (files: { path: string; file: File }[], meta: { name: string; adType: string; slug?: string }) => {
    const body = new FormData();
    body.append('name', meta.name);
    body.append('adType', meta.adType);
    if (meta.slug) body.append('slug', meta.slug);
    for (const f of files) body.append('file', f.file, f.path);
    const res = await fetch(`${API}/templates/ingest`, { method: 'POST', body });
    const answer = (await res.json()) as IngestAnswer | { error: string };
    if ('error' in answer) throw new Error(answer.error);
    return answer;
  },

  /** Absolute URL for a server-relative file path such as /templates/x/thumb.png. */
  fileUrl: (serverPath: string) => `${API}${serverPath}`,
};
