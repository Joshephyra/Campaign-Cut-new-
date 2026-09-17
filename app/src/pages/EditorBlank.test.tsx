import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Editor } from './Editor';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * M41: a spot from nothing. The editor opens empty and says so; the first
 * scene lands at 0 and the playhead moves on to its end, so the next scene
 * follows it; an overlay added past the end lands on the last scene.
 */
const textLottie = (t: string) => ({ fr: 30, ip: 0, op: 120, w: 1920, h: 1080, layers: [{ ty: 5, nm: 'cc.headline', t: { d: { k: [{ s: { t, f: 'X', s: 10 }, t: 0 }] } } }] });
const schema = (key: string) => [{ key, role: key, kind: 'text', label: key, default: 'X', path: '/layers/0' }];
const detail = {
  project: { id: 7, name: 'New spot', templateId: 1, templateSlug: 'blank', templateName: 'Blank spot' },
  template: { id: 1, slug: 'blank', name: 'Blank spot', durationFrames: 0, fps: 30, width: 1920, height: 1080, thumbUrl: '' },
  elements: [],
  transitions: [],
  meta: { fonts: [], fontFiles: [] },
  values: [],
};
const item = (id: number, slug: string, type: string, frames: number) => ({
  id, slug, name: slug, type, durationInFrames: frames, templateId: 2, templateSlug: 'pack', templateName: 'Starter pack', thumbUrl: '',
  lottieUrl: `/templates/pack/elements/${slug}/template.json`, schema: schema('headline'), fontFiles: [],
});
const library = [item(20, 'background', 'background', 150), item(21, 'headline', 'headline', 120), item(22, 'lower-third', 'lower-third', 150)];

function mockApi() {
  const adds: { elementId: number; startFrame: number }[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    if (url === '/api/projects/7' && !init?.method) return new Response(JSON.stringify(detail), { status: 200 });
    if (url === '/api/elements') return new Response(JSON.stringify(library), { status: 200 });
    if (url.endsWith('/template.json')) return new Response(JSON.stringify(textLottie('X')), { status: 200 });
    if (url === '/api/media' || url === '/api/themes') return new Response('[]', { status: 200 });
    if (url === '/api/projects/7/elements' && init?.method === 'POST') {
      const body = JSON.parse(init.body as string) as { elementId: number; startFrame: number };
      adds.push(body);
      const it = library.find((l) => l.id === body.elementId)!;
      return new Response(JSON.stringify({ id: it.id, slug: it.slug, name: it.name, type: it.type, templateSlug: 'pack', added: true, zIndex: 0, startFrame: body.startFrame, endFrame: body.startFrame + it.durationInFrames, enabled: true, lottieUrl: it.lottieUrl, schema: it.schema }), { status: 201 });
    }
    if (init?.method === 'PUT') return new Response(init.body as string, { status: 200 });
    return new Response('not found', { status: 404 });
  });
  return adds;
}

describe('Editor: a spot from nothing (M41)', () => {
  it('opens empty and says so; scenes land one after another; an overlay past the end lands on the last scene', async () => {
    const adds = mockApi();
    render(<Editor projectId={7} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('empty-spot')).toBeTruthy());
    expect(screen.getByTestId('empty-panel')).toBeTruthy();
    expect(screen.queryAllByTestId(/^scene-\d+$/)).toHaveLength(0);

    fireEvent.click(screen.getAllByRole('button', { name: 'Add the first scene' })[0]!);
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Add to the spot' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Add background from Starter pack' }));
    await waitFor(() => expect(adds).toHaveLength(1));
    expect(adds[0]).toEqual({ elementId: 20, startFrame: 0 });
    await waitFor(() => expect(screen.queryByTestId('empty-spot')).toBeNull());
    // the playhead moved on to the end of the scene
    await waitFor(() => expect(screen.getByTestId('player').getAttribute('data-seek')).toBe('150'));

    fireEvent.click(screen.getByRole('button', { name: 'Add a scene' }));
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Add to the spot' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Add headline from Starter pack' }));
    await waitFor(() => expect(adds).toHaveLength(2));
    expect(adds[1]).toEqual({ elementId: 21, startFrame: 150 });
    await waitFor(() => expect(screen.getByTestId('player').getAttribute('data-seek')).toBe('270'));

    fireEvent.click(screen.getByRole('button', { name: 'Add a scene' }));
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Add to the spot' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Add lower-third from Starter pack' }));
    await waitFor(() => expect(adds).toHaveLength(3));
    // past the end, an overlay lands on the start of the last scene, and the playhead stays on it
    expect(adds[2]).toEqual({ elementId: 22, startFrame: 150 });
    expect(screen.getAllByTestId(/^scene-\d+$/)).toHaveLength(3);
  });
});
