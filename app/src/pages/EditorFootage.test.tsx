import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Editor } from './Editor';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * M21: footage belongs to an element. Choosing a clip in the Footage panel
 * puts it on the SELECTED element's slot (or the first element with a slot
 * when the selected one has none), and the Player gets one clip per element.
 */
const slotLottie = {
  fr: 30,
  ip: 0,
  op: 90,
  w: 1920,
  h: 1080,
  layers: [{ ty: 1, nm: 'cc.mediaFill', sw: 960, sh: 1080, ks: { o: { a: 0, k: 100 }, p: { a: 0, k: [1440, 540, 0] }, a: { a: 0, k: [480, 540, 0] }, s: { a: 0, k: [100, 100, 100] } } }],
};
const mediaSchema = [{ key: 'mediaFill', role: 'mediaFill', kind: 'media', label: 'Footage', default: null, path: '/layers/0' }];

const detail = {
  project: { id: 7, name: 'Two part', templateId: 1, templateSlug: 'two', templateName: 'Two' },
  template: { id: 1, slug: 'two', name: 'Two', durationFrames: 180, fps: 30, width: 1920, height: 1080, thumbUrl: '' },
  elements: [
    { id: 3, slug: 'open', name: 'Open', zIndex: 0, startFrame: 0, endFrame: 90, enabled: true, lottieUrl: '/templates/two/elements/open/template.json', schema: mediaSchema },
    { id: 4, slug: 'end-card', name: 'End card', zIndex: 0, startFrame: 90, endFrame: 180, enabled: true, lottieUrl: '/templates/two/elements/end-card/template.json', schema: mediaSchema },
  ],
  transitions: [],
  meta: { fonts: [], fontFiles: [] },
  audio: null,
  values: [
    { elementId: 3, key: 'mediaFill', value: null },
    { elementId: 4, key: 'mediaFill', value: null },
  ],
};

const clip = { id: 1, kind: 'video', originalName: 'rally.mp4', originalUrl: '/media/originals/rally.mp4', proxyUrl: '/media/proxies/rally.mp4', thumbUrl: '/media/thumbs/rally.jpg', width: 1920, height: 1080, durationS: 10, fps: 30 };

function mockApi() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    if (url === '/api/projects/7' && !init?.method) return new Response(JSON.stringify(detail), { status: 200 });
    if (url.endsWith('/template.json')) return new Response(JSON.stringify(slotLottie), { status: 200 });
    if (url === '/api/media') return new Response(JSON.stringify([clip]), { status: 200 });
    if (url === '/api/projects/7/values' && init?.method === 'PUT') return new Response(JSON.stringify({ ok: true }), { status: 200 });
    return new Response('not found', { status: 404 });
  });
}

const playerMedia = () =>
  (JSON.parse(screen.getByTestId('player').getAttribute('data-props')!) as { elements: { id: string; media: { src: string } | null }[] }).elements.map((e) => [e.id, e.media?.src ?? null]);

describe('Editor footage per element', () => {
  it('puts the chosen clip on the selected element and hands the Player one clip per element', async () => {
    const fetchMock = mockApi();
    render(<Editor projectId={7} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByLabelText('Select End card')).toBeTruthy());
    await waitFor(() => expect(screen.getAllByText('rally.mp4').length).toBeGreaterThan(0));

    fireEvent.click(screen.getByLabelText('Select End card'));
    // the Footage panel row (a button holding the clip name)
    const row = screen.getAllByText('rally.mp4').map((n) => n.closest('button')).find((b) => b && b.getAttribute('type') === 'button')!;
    fireEvent.click(row);

    await waitFor(() =>
      expect(playerMedia()).toEqual([
        ['3', null],
        ['4', '/api/media/proxies/rally.mp4'],
      ]),
    );
    await waitFor(() => {
      const put = fetchMock.mock.calls.find(([u, init]) => String(u) === '/api/projects/7/values' && init?.method === 'PUT');
      expect(put).toBeTruthy();
      expect(JSON.parse((put![1] as RequestInit).body as string)).toEqual({ values: [{ elementId: 4, key: 'mediaFill', value: { assetId: 1, fit: 'cover' } }] });
    });
  });
});
