import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Editor } from './Editor';

vi.mock('lottie-web', () => ({ default: { loadAnimation: () => ({ goToAndStop: () => {}, destroy: () => {} }) } }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * M30: there is no timeline. The elements are a strip of scene chips under
 * the monitor: pressing one selects it and moves the player to its start so
 * the user sees what they are about to edit. Timing is the designer's,
 * except a Length slider in the element's panel that ripples the elements
 * that follow. Show/hide and "how it ends" live in the panel too.
 */
const textLottie = (text: string) => ({ fr: 30, ip: 0, op: 90, w: 1920, h: 1080, layers: [{ ty: 5, nm: 'cc.headline', t: { d: { k: [{ s: { t: text, f: 'X', s: 10 }, t: 0 }] } } }] });

const detail = {
  project: { id: 7, name: 'Three part project', templateId: 1, templateSlug: 'three', templateName: 'Three' },
  template: { id: 1, slug: 'three', name: 'Three', durationFrames: 270, fps: 30, width: 1920, height: 1080, thumbUrl: '' },
  elements: [
    { id: 3, slug: 'open', name: 'Open', zIndex: 0, startFrame: 0, endFrame: 90, enabled: true, lottieUrl: '/templates/three/elements/open/template.json', schema: [{ key: 'headline', role: 'headline', kind: 'text', label: 'Headline', default: 'OPEN', path: '/layers/0' }] },
    { id: 4, slug: 'lower-third', name: 'Lower third', zIndex: 1, startFrame: 60, endFrame: 120, enabled: true, lottieUrl: '/templates/three/elements/lower/template.json', schema: [{ key: 'subhead', role: 'subhead', kind: 'text', label: 'Subhead', default: 'LOWER', path: '/layers/0' }] },
    { id: 5, slug: 'end-card', name: 'End card', zIndex: 0, startFrame: 180, endFrame: 270, enabled: true, lottieUrl: '/templates/three/elements/end/template.json', schema: [{ key: 'headline', role: 'headline', kind: 'text', label: 'Headline', default: 'END', path: '/layers/0' }] },
  ],
  transitions: [{ afterElementId: 4, preset: 'fade', durationInFrames: 15 }],
  meta: { fonts: [], fontFiles: [] },
  values: [],
};

type Call = { url: string; init?: RequestInit };
function mockApi() {
  const calls: Call[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    if (url === '/api/projects/7' && !init?.method) return new Response(JSON.stringify(detail), { status: 200 });
    if (url.endsWith('/template.json')) return new Response(JSON.stringify(textLottie('X')), { status: 200 });
    if (url === '/api/media') return new Response('[]', { status: 200 });
    if (init?.method === 'PUT' || init?.method === 'PATCH') return new Response(init.body as string, { status: 200 });
    return new Response('not found', { status: 404 });
  });
  return calls;
}

const playerElements = () =>
  (JSON.parse(screen.getByTestId('player').getAttribute('data-props')!) as { elements: { id: string; startFrame: number; endFrame: number; enabled: boolean }[] }).elements.map((e) => [
    e.id,
    e.startFrame,
    e.endFrame,
    e.enabled,
  ]);

async function open() {
  render(<Editor projectId={7} onBack={() => {}} />);
  await waitFor(() => expect(screen.getByLabelText('Headline')).toBeTruthy());
}

describe('Editor transport (M30)', () => {
  it('draws play, a scrub slider and mute under the monitor instead of the Player chrome, and drives the Player', async () => {
    mockApi();
    await open();
    const play = screen.getByLabelText('Play');
    fireEvent.click(play);
    await waitFor(() => expect(screen.getByLabelText('Pause')).toBeTruthy(), { timeout: 4000 }); // the editor is heavy under a full parallel run
    expect(screen.getByTestId('player').getAttribute('data-playing')).toBe('true');
    fireEvent.keyDown(document.body, { key: ' ' });
    await waitFor(() => expect(screen.getByLabelText('Play')).toBeTruthy(), { timeout: 4000 });

    const scrub = screen.getByLabelText('Scrub') as HTMLInputElement;
    expect(scrub.type).toBe('range');
    fireEvent.change(scrub, { target: { value: '150' } });
    expect(screen.getByTestId('player').getAttribute('data-seek')).toBe('150');

    fireEvent.click(screen.getByLabelText('Mute'));
    expect(screen.getByTestId('player').getAttribute('data-muted')).toBe('true');
    await waitFor(() => expect(screen.getByLabelText('Unmute')).toBeTruthy(), { timeout: 4000 });
  });
});

describe('Editor scenes (M30)', () => {
  it('shows one chip per element in play order, no timeline, and pressing a chip selects it and seeks to where its design is on screen', async () => {
    mockApi();
    await open();
    expect(screen.queryByTestId('timeline')).toBeNull();
    const chips = screen.getAllByTestId(/^scene-[0-9]+$/);
    expect(chips.map((c) => c.textContent)).toEqual([expect.stringContaining('Open'), expect.stringContaining('Lower third'), expect.stringContaining('End card')]);
    expect(screen.getByTestId('scene-3').getAttribute('data-selected')).toBe('true');
    expect(screen.getAllByTestId(/^scene-thumb-/)).toHaveLength(3); // M37: each chip draws its scene

    fireEvent.click(screen.getByLabelText('Select End card'));
    await waitFor(() => expect(screen.getByTestId('scene-5').getAttribute('data-selected')).toBe('true'));
    expect(screen.getByTestId('player').getAttribute('data-seek')).toBe('210'); // a second into the end card, not the empty first frame of its entrance
    expect((screen.getByLabelText('Headline') as HTMLInputElement).value).toBe('END');
  });

  it('the panel has a Show switch; turning it off hides the element in the Player and saves', async () => {
    const calls = mockApi();
    await open();
    const show = screen.getByLabelText('Toggle Open') as HTMLInputElement;
    expect(show.checked).toBe(true);
    fireEvent.click(show);
    await waitFor(() => expect(playerElements()[0]).toEqual(['3', 0, 90, false]));
    await waitFor(() => expect(calls.some((c) => c.url === '/api/projects/7/elements/3' && (c.init!.body as string).includes('"enabled":false'))).toBe(true));
  });

  it('"how it ends" shows the transition after an element that has one following, and reports a change', async () => {
    const calls = mockApi();
    await open();
    fireEvent.click(screen.getByLabelText('Select Lower third'));
    await waitFor(() => expect(screen.getByLabelText('Subhead')).toBeTruthy());
    const group = screen.getByRole('group', { name: 'Transition after lower-third' });
    expect(Array.from(group.querySelectorAll('button')).filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent)).toEqual(['Fade']);
    fireEvent.click(screen.getByRole('button', { name: 'Wipe' }));
    await waitFor(() => expect(calls.some((c) => c.url === '/api/projects/7/transitions/4' && (c.init!.body as string).includes('"preset":"wipe"'))).toBe(true));

    fireEvent.click(screen.getByLabelText('Select End card'));
    await waitFor(() => expect(screen.queryByRole('group', { name: /Transition after/ })).toBeNull()); // the last element ends the spot
  });

  it('the Length slider changes an element\'s length in seconds and ripples the elements that start after it', async () => {
    const calls = mockApi();
    await open();
    const length = screen.getByLabelText('Open length') as HTMLInputElement;
    expect(length.type).toBe('range');
    expect(length.value).toBe('3');
    fireEvent.change(length, { target: { value: '4' } });
    await waitFor(() =>
      expect(playerElements()).toEqual([
        ['3', 0, 120, true],
        ['4', 60, 120, true], // overlaps the open: untouched
        ['5', 210, 300, true], // started after the open ended: moved by a second
      ]),
    );
    await waitFor(() => {
      const patches = calls.filter((c) => c.init?.method === 'PUT' && c.url.includes('/elements/')).map((c) => [c.url, JSON.parse(c.init!.body as string)]);
      expect(patches).toEqual(expect.arrayContaining([['/api/projects/7/elements/3', { startFrame: 0, endFrame: 120 }], ['/api/projects/7/elements/5', { startFrame: 210, endFrame: 300 }]]));
    });
  });
});
