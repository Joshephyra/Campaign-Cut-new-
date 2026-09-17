import { cleanup, createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Editor } from './Editor';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * M43: scene chips drag to reorder. Dropping a scene on the left half of
 * another puts it before, on the right half after; the scenes are re-laid
 * with their lengths and the gaps between positions; overlays stay put;
 * the Player takes the new order at once and every moved scene is saved.
 */
const lottie = { fr: 30, ip: 0, op: 300, w: 1920, h: 1080, layers: [] };
const element = (id: number, slug: string, type: string, startFrame: number, endFrame: number, zIndex = 0) => ({
  id, slug, name: slug, type, templateSlug: 'three', added: false, zIndex, startFrame, endFrame, enabled: true,
  lottieUrl: `/templates/three/elements/${slug}/template.json`,
  schema: [{ key: 'headline', role: 'headline', kind: 'text', label: 'Headline', default: slug, path: '/layers/0' }],
});
const detail = {
  project: { id: 7, name: 'Three part project', templateId: 1, templateSlug: 'three', templateName: 'Three' },
  template: { id: 1, slug: 'three', name: 'Three', durationFrames: 270, fps: 30, width: 1920, height: 1080, thumbUrl: '' },
  elements: [element(3, 'open', 'open', 0, 90), element(4, 'lower-third', 'lower-third', 60, 120, 1), element(5, 'end-card', 'end-card', 180, 270)],
  transitions: [],
  meta: { fonts: [], fontFiles: [] },
  values: [],
};

function mockApi() {
  const puts: { url: string; body: Record<string, unknown> }[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    if (url === '/api/projects/7' && !init?.method) return new Response(JSON.stringify(detail), { status: 200 });
    if (url.endsWith('/template.json')) return new Response(JSON.stringify(lottie), { status: 200 });
    if (url === '/api/media' || url === '/api/themes' || url === '/api/elements') return new Response('[]', { status: 200 });
    if (init?.method === 'PUT') {
      puts.push({ url, body: JSON.parse(init.body as string) as Record<string, unknown> });
      return new Response(init.body as string, { status: 200 });
    }
    return new Response('not found', { status: 404 });
  });
  return puts;
}

const playerOrder = () =>
  (JSON.parse(screen.getByTestId('player').getAttribute('data-props')!) as { elements: { id: string; startFrame: number; endFrame: number }[] }).elements
    .map((e) => [e.id, e.startFrame, e.endFrame] as const)
    .sort((a, b) => a[1] - b[1] || Number(a[0]) - Number(b[0]));

/** A drag with the scene type on it, dropped at the given x on the target chip (jsdom has no layout: the box is 0 wide, so x < 0 is "before"). jsdom's drag events drop clientX, so it is set on the event by hand. */
function dragScene(from: HTMLElement, to: HTMLElement, place: 'before' | 'after') {
  const store: Record<string, string> = {};
  const dataTransfer = { setData: (t: string, v: string) => { store[t] = v; }, getData: (t: string) => store[t] ?? '', types: [] as string[], effectAllowed: '', dropEffect: '' };
  fireEvent.dragStart(from, { dataTransfer });
  dataTransfer.types = Object.keys(store);
  const clientX = place === 'before' ? -10 : 10;
  for (const kind of ['dragOver', 'drop'] as const) {
    const ev = createEvent[kind](to, { dataTransfer });
    Object.defineProperty(ev, 'clientX', { value: clientX });
    fireEvent(to, ev);
  }
}

describe('Editor: reorder scenes by dragging chips (M43)', () => {
  it('dropping the end card before the open re-lays the scenes, leaves the lower third, and saves the moved ones', async () => {
    const puts = mockApi();
    render(<Editor projectId={7} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('scene-5')).toBeTruthy());
    expect(screen.getByTestId('scene-3').getAttribute('draggable')).toBe('true');
    expect(screen.getByTestId('scene-4').getAttribute('draggable')).toBe('true'); // M44: an overlay drags onto a scene

    dragScene(screen.getByTestId('scene-5'), screen.getByTestId('scene-3'), 'before');
    // end card (90) first, then the gap of 90, then open (90): lower third untouched
    await waitFor(() => expect(playerOrder()).toEqual([['5', 0, 90], ['4', 60, 120], ['3', 180, 270]]));
    await waitFor(() => expect(puts.filter((p) => p.url.includes('/elements/')).length).toBeGreaterThanOrEqual(2), { timeout: 4000 });
    expect(puts.find((p) => p.url === '/api/projects/7/elements/5')?.body).toMatchObject({ startFrame: 0, endFrame: 90 });
    expect(puts.find((p) => p.url === '/api/projects/7/elements/3')?.body).toMatchObject({ startFrame: 180, endFrame: 270 });
    expect(puts.find((p) => p.url === '/api/projects/7/elements/4')).toBeUndefined();
    expect(screen.getByTestId('scene-3').getAttribute('data-drop-edge')).toBeNull();
  });

  it('dropping on the right half puts the scene after; dropping a scene on itself changes nothing', async () => {
    const puts = mockApi();
    render(<Editor projectId={7} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('scene-5')).toBeTruthy());
    dragScene(screen.getByTestId('scene-3'), screen.getByTestId('scene-5'), 'after');
    await waitFor(() => expect(playerOrder()).toEqual([['5', 0, 90], ['4', 60, 120], ['3', 180, 270]]));
    dragScene(screen.getByTestId('scene-3'), screen.getByTestId('scene-3'), 'before');
    await new Promise((r) => setTimeout(r, 50));
    expect(playerOrder().map((e) => e[0])).toEqual(['5', '4', '3']);
    await waitFor(() => expect(puts.some((p) => p.url.includes('/elements/'))).toBe(true), { timeout: 4000 });
  });
});

/** M44: an overlay chip dropped on a scene chip lands on that scene, keeping its length; a scene chip is the only drop target. */
describe('Editor: move an overlay onto a scene (M44)', () => {
  it('drops the lower third on the end card: it starts where the end card starts, nothing else moves, and it is saved', async () => {
    const puts = mockApi();
    render(<Editor projectId={7} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('scene-5')).toBeTruthy());
    dragScene(screen.getByTestId('scene-4'), screen.getByTestId('scene-5'), 'after');
    await waitFor(() => expect(playerOrder()).toEqual([['3', 0, 90], ['4', 180, 240], ['5', 180, 270]]));
    await waitFor(() => expect(puts.find((p) => p.url === '/api/projects/7/elements/4')?.body).toMatchObject({ startFrame: 180, endFrame: 240 }), { timeout: 4000 });
    expect(puts.find((p) => p.url === '/api/projects/7/elements/5')).toBeUndefined();
    // an overlay is not a drop target: dropping the open on the lower third changes nothing
    dragScene(screen.getByTestId('scene-3'), screen.getByTestId('scene-4'), 'before');
    await new Promise((r) => setTimeout(r, 50));
    expect(playerOrder()).toEqual([['3', 0, 90], ['4', 180, 240], ['5', 180, 270]]);
  });
});

/** The keyboard's route: Move earlier / Move later in the panel do what a chip drag does, and stop at the ends. */
describe('Editor: move a scene with buttons', () => {
  it('Move later on the open swaps it after the end card; Move later is then disabled and Move earlier brings it back', async () => {
    const puts = mockApi();
    render(<Editor projectId={7} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('scene-3')).toBeTruthy());
    fireEvent.click(screen.getByLabelText('Select open'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Move later' })).toBeTruthy());
    expect((screen.getByRole('button', { name: 'Move earlier' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Move later' }));
    await waitFor(() => expect(playerOrder()).toEqual([['5', 0, 90], ['4', 60, 120], ['3', 180, 270]]));
    await waitFor(() => expect((screen.getByRole('button', { name: 'Move later' }) as HTMLButtonElement).disabled).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: 'Move earlier' }));
    await waitFor(() => expect(playerOrder()).toEqual([['3', 0, 90], ['4', 60, 120], ['5', 180, 270]]));
    await waitFor(() => expect(puts.some((p) => p.url.includes('/elements/'))).toBe(true), { timeout: 4000 });
    // an overlay has no move buttons
    fireEvent.click(screen.getByLabelText('Select lower-third'));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Move later' })).toBeNull());
  });
});
