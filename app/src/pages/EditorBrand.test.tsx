import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import { Editor } from './Editor';

/** M66: the left column is tabbed; these tests live on the brand tab. */
beforeEach(() => {
  window.localStorage.setItem('cc.left.tab', 'brand');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** M33: a spot names its client in the top bar, and its brand can be applied again from the Style panel. */
const lottie = { fr: 30, ip: 0, op: 90, w: 1920, h: 1080, layers: [{ ty: 4, nm: 'cc.accent', shapes: [{ ty: 'gr', it: [{ ty: 'rc' }, { ty: 'fl', c: { a: 0, k: [0.94, 0.35, 0.16, 1] } }] }] }] };
const accent = { key: 'accent', role: 'accent', kind: 'color', label: 'Accent colour', default: '#F05929', path: '/layers/0/shapes/0/it/1' };

const detail = {
  project: { id: 7, name: 'Rivera: Two', templateId: 1, templateSlug: 'two', templateName: 'Two', clientId: 1, clientName: 'Rivera for Senate' },
  template: { id: 1, slug: 'two', name: 'Two', durationFrames: 90, fps: 30, width: 1920, height: 1080, thumbUrl: '' },
  elements: [{ id: 3, slug: 'open', name: 'Open', type: 'open', templateSlug: 'two', added: false, zIndex: 0, startFrame: 0, endFrame: 90, enabled: true, lottieUrl: '/templates/two/elements/open/template.json', schema: [accent] }],
  transitions: [],
  meta: { fonts: [], fontFiles: [] },
  values: [{ elementId: 3, key: 'accent', value: '#000000' }],
};

function mockApi() {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    if (url === '/api/projects/7' && !init?.method) return new Response(JSON.stringify(detail), { status: 200 });
    if (url.endsWith('/template.json')) return new Response(JSON.stringify(lottie), { status: 200 });
    if (url === '/api/media') return new Response('[]', { status: 200 });
    if (url === '/api/themes') return new Response('[]', { status: 200 });
    if (url === '/api/projects/7/brand' && init?.method === 'POST') return new Response(JSON.stringify({ values: [{ elementId: 3, key: 'accent', value: '#1D4ED8' }] }), { status: 200 });
    return new Response('not found', { status: 404 });
  });
  return calls;
}

describe('Editor brand (M33)', () => {
  it('names the client in the top bar and applies its brand again from the Style panel', async () => {
    const calls = mockApi();
    render(<Editor projectId={7} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Rivera for Senate'));
    fireEvent.click(screen.getByRole('button', { name: "Apply Rivera for Senate's brand" }));
    await waitFor(() => expect(calls.some((c) => c.url === '/api/projects/7/brand' && c.init?.method === 'POST')).toBe(true));
    await waitFor(() => expect((screen.getByLabelText('Accent colour') as HTMLInputElement).value).toBe('#1D4ED8'));
  });
});
