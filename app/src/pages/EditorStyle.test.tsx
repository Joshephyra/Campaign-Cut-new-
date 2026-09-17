import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Editor } from './Editor';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** M32: a colour changed in the Style panel reaches every scene in the Player and is saved through the style route. */
const lottie = (fill: number[]) => ({
  fr: 30,
  ip: 0,
  op: 90,
  w: 1920,
  h: 1080,
  layers: [{ ty: 4, nm: 'cc.accent', shapes: [{ ty: 'gr', it: [{ ty: 'rc' }, { ty: 'fl', c: { a: 0, k: fill } }] }] }],
});
const accent = { key: 'accent', role: 'accent', kind: 'color', label: 'Accent colour', default: '#F05929', path: '/layers/0/shapes/0/it/1' };

const detail = {
  project: { id: 7, name: 'Two part project', templateId: 1, templateSlug: 'two', templateName: 'Two' },
  template: { id: 1, slug: 'two', name: 'Two', durationFrames: 180, fps: 30, width: 1920, height: 1080, thumbUrl: '' },
  elements: [
    { id: 3, slug: 'open', name: 'Open', type: 'open', templateSlug: 'two', added: false, zIndex: 0, startFrame: 0, endFrame: 90, enabled: true, lottieUrl: '/templates/two/elements/open/template.json', schema: [accent] },
    { id: 4, slug: 'end-card', name: 'End card', type: 'end-card', templateSlug: 'two', added: false, zIndex: 0, startFrame: 90, endFrame: 180, enabled: true, lottieUrl: '/templates/two/elements/end-card/template.json', schema: [accent] },
  ],
  transitions: [],
  meta: { fonts: [], fontFiles: [] },
  values: [
    { elementId: 3, key: 'accent', value: '#F05929' },
    { elementId: 4, key: 'accent', value: '#F05929' },
  ],
};

type Call = { url: string; init?: RequestInit };
function mockApi() {
  const calls: Call[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    if (url === '/api/projects/7' && !init?.method) return new Response(JSON.stringify(detail), { status: 200 });
    if (url.endsWith('/template.json')) return new Response(JSON.stringify(lottie([0.94, 0.35, 0.16, 1])), { status: 200 });
    if (url === '/api/media') return new Response('[]', { status: 200 });
    if (url === '/api/themes' && !init?.method) return new Response('[]', { status: 200 });
    if (url === '/api/projects/7/style' && init?.method === 'POST') {
      const { colors } = JSON.parse(init.body as string) as { colors: Record<string, string> };
      return new Response(JSON.stringify({ values: [3, 4].map((elementId) => ({ elementId, key: 'accent', value: colors.accent })) }), { status: 200 });
    }
    if (init?.method === 'PUT') return new Response(init.body as string, { status: 200 });
    return new Response('not found', { status: 404 });
  });
  return calls;
}

const playerFills = () =>
  (JSON.parse(screen.getByTestId('player').getAttribute('data-props')!) as { elements: { lottie: { layers: { shapes: { it: { c?: { k: number[] } }[] }[] }[] } }[] }).elements.map(
    (e) => e.lottie.layers[0]!.shapes[0]!.it[1]!.c!.k,
  );

describe('Editor style (M32)', () => {
  it('changing the accent across the spot recolours both scenes in the Player and saves through the style route, once', async () => {
    const calls = mockApi();
    render(<Editor projectId={7} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByLabelText('Accent colour across the spot')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Accent colour across the spot'), { target: { value: '#0000FF' } });
    await waitFor(() => expect(playerFills()).toEqual([[0, 0, 1, 1], [0, 0, 1, 1]]));
    await waitFor(() => expect(calls.some((c) => c.url === '/api/projects/7/style' && c.init?.method === 'POST')).toBe(true));
    expect((screen.getByLabelText('Accent colour') as HTMLInputElement).value).toBe('#0000FF');
    await new Promise((r) => setTimeout(r, 600));
    expect(calls.filter((c) => c.url === '/api/projects/7/values' && c.init?.method === 'PUT')).toHaveLength(0); // the style route already saved it
  });
});
