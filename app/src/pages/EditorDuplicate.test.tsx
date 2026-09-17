import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Editor } from './Editor';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * M46: "Duplicate scene" makes a second copy of the selected scene right
 * after it, with its words; what follows moves on. The copy is a new scene
 * of the same element (M45).
 */
const lottie = { fr: 30, ip: 0, op: 300, w: 1920, h: 1080, layers: [] };
const element = (id: number, slug: string, type: string, startFrame: number, endFrame: number) => ({
  id, elementId: id, slug, name: slug, type, templateSlug: 'three', added: false, zIndex: 0, startFrame, endFrame, enabled: true,
  lottieUrl: `/templates/three/elements/${slug}/template.json`,
  schema: [{ key: 'headline', role: 'headline', kind: 'text', label: 'Headline', default: slug, path: '/layers/0' }],
});
const detail = {
  project: { id: 7, name: 'Three part project', templateId: 1, templateSlug: 'three', templateName: 'Three' },
  template: { id: 1, slug: 'three', name: 'Three', durationFrames: 270, fps: 30, width: 1920, height: 1080, thumbUrl: '' },
  elements: [element(3, 'open', 'open', 0, 90), element(5, 'end-card', 'end-card', 180, 270)],
  transitions: [],
  meta: { fonts: [], fontFiles: [] },
  values: [{ elementId: 3, key: 'headline', value: 'THE WORDS' }],
};

function mockApi() {
  const calls: { url: string; method: string; body: unknown }[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    if (init?.method && init.method !== 'GET') calls.push({ url, method: init.method, body: init.body ? JSON.parse(init.body as string) : null });
    if (url === '/api/projects/7' && !init?.method) return new Response(JSON.stringify(detail), { status: 200 });
    if (url.endsWith('/template.json')) return new Response(JSON.stringify(lottie), { status: 200 });
    if (url === '/api/media' || url === '/api/themes' || url === '/api/elements') return new Response('[]', { status: 200 });
    if (url === '/api/projects/7/elements' && init?.method === 'POST') {
      const body = JSON.parse(init.body as string) as { elementId: number; startFrame: number };
      return new Response(JSON.stringify({ ...element(10_000_001, 'open', 'open', body.startFrame, body.startFrame + 90), elementId: body.elementId, added: true }), { status: 201 });
    }
    if (init?.method === 'PUT') return new Response(init.body as string, { status: 200 });
    return new Response('not found', { status: 404 });
  });
  return calls;
}

const playerOrder = () =>
  (JSON.parse(screen.getByTestId('player').getAttribute('data-props')!) as { elements: { id: string; startFrame: number; endFrame: number }[] }).elements
    .map((e) => [e.id, e.startFrame, e.endFrame] as const)
    .sort((a, b) => a[1] - b[1] || Number(a[0]) - Number(b[0]));

describe('Editor: duplicate a scene (M46)', () => {
  it('copies the open right after itself with its words, moves the end card on, selects the copy and saves everything', async () => {
    const calls = mockApi();
    render(<Editor projectId={7} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('scene-3')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate scene' }));
    await waitFor(() => expect(screen.getByTestId('scene-10000001')).toBeTruthy());
    // open 0-90, the copy right after it 90-180, the end card moved on by the copy's length to 270-360
    await waitFor(() => expect(playerOrder()).toEqual([['3', 0, 90], ['10000001', 90, 180], ['5', 270, 360]]));
    expect(screen.getByTestId('scene-10000001').getAttribute('data-selected')).toBe('true');
    expect((screen.getByLabelText('Headline') as HTMLInputElement).value).toBe('THE WORDS');
    const add = calls.find((c) => c.url === '/api/projects/7/elements' && c.method === 'POST');
    expect(add?.body).toEqual({ elementId: 3, startFrame: 90 });
    expect(calls.find((c) => c.url === '/api/projects/7/values' && c.method === 'PUT')?.body).toEqual({ values: [{ elementId: 10_000_001, key: 'headline', value: 'THE WORDS' }] });
    await waitFor(() => expect(calls.some((c) => c.url === '/api/projects/7/elements/5' && c.method === 'PUT')).toBe(true), { timeout: 4000 });
    expect(calls.find((c) => c.url === '/api/projects/7/elements/5' && c.method === 'PUT')?.body).toMatchObject({ startFrame: 270, endFrame: 360 });
  });
});
