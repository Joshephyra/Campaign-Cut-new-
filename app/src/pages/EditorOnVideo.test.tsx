import { layerClassFor } from '@campaigncut/composition';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Editor } from './Editor';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * M30: editing on the video itself. Double-click a text layer to type into
 * it where it sits; drag a clip from the library onto the video to drop it
 * into the footage slot. The layer boxes come from the rendered SVG (here,
 * stand-in nodes inside the stubbed Player).
 */
const lottie = {
  fr: 30,
  ip: 0,
  op: 60,
  w: 1920,
  h: 1080,
  layers: [
    { ty: 5, nm: 'cc.headline', ks: { p: { a: 0, k: [100, 200, 0] }, s: { a: 0, k: [100, 100, 100] }, r: { a: 0, k: 0 } }, t: { d: { k: [{ s: { t: 'HI', f: 'X', s: 10 }, t: 0 }] } } },
    { ty: 4, nm: 'cc.mediaFill', ks: { p: { a: 0, k: [960, 540, 0] }, a: { a: 0, k: [960, 540, 0] }, s: { a: 0, k: [100, 100, 100] }, o: { a: 0, k: 100 } }, shapes: [{ ty: 'rc', s: { a: 0, k: [1920, 1080] }, p: { a: 0, k: [960, 540] } }] },
  ],
};

const schema = [
  { key: 'headline', role: 'headline', kind: 'text', label: 'Headline', default: 'HI', path: '/layers/0' },
  { key: 'headline.transform', role: 'headline', kind: 'transform', label: 'Headline placement', default: { x: 0, y: 0, scale: 1, rotation: 0 }, path: '/layers/0', for: 'headline' },
  { key: 'mediaFill', role: 'mediaFill', kind: 'media', label: 'Footage', default: null, path: '/layers/1' },
];

const detail = {
  project: { id: 7, name: 'Demo project', templateId: 1, templateSlug: 'demo', templateName: 'Demo' },
  template: { id: 1, slug: 'demo', name: 'Demo', durationFrames: 60, fps: 30, width: 1920, height: 1080, thumbUrl: '' },
  elements: [{ id: 3, slug: 'open', name: 'Open', zIndex: 0, startFrame: 0, endFrame: 60, enabled: true, lottieUrl: '/templates/demo/elements/open/template.json', schema }],
  transitions: [],
  meta: { fonts: [], fontFiles: [] },
  values: [{ elementId: 3, key: 'headline', value: 'HI' }],
};

const assets = [{ id: 4, kind: 'video', originalName: 'rally.mp4', originalUrl: '/media/originals/4.mp4', proxyUrl: '/media/proxies/4.mp4', thumbUrl: '/media/thumbs/4.jpg', width: 1920, height: 1080, durationS: 5, fps: 30 }];

function mockApi() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    if (url === '/api/projects/7' && !init?.method) return new Response(JSON.stringify(detail), { status: 200 });
    if (url.endsWith('/template.json')) return new Response(JSON.stringify(lottie), { status: 200 });
    if (url === '/api/projects/7/values' && init?.method === 'PUT') return new Response(JSON.stringify({ ok: true }), { status: 200 });
    if (url === '/api/media') return new Response(JSON.stringify(assets), { status: 200 });
    return new Response('not found', { status: 404 });
  });
}

const rect = (left: number, top: number, width: number, height: number) =>
  ({ x: left, y: top, left, top, right: left + width, bottom: top + height, width, height, toJSON: () => ({}) }) as DOMRect;

function mockMonitorSize() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 800, 450));
}

function placeHeadline() {
  const player = screen.getByTestId('player');
  const wrapper = document.createElement('div');
  wrapper.setAttribute('data-cc-element', '3');
  const layer = document.createElement('div');
  layer.className = `cc-layer ${layerClassFor('headline.transform')}`;
  layer.getBoundingClientRect = () => rect(100, 100, 200, 100);
  wrapper.appendChild(layer);
  player.appendChild(wrapper);
}

const playerProps = () => JSON.parse(screen.getByTestId('player').getAttribute('data-props')!) as { elements: { media: { src: string } | null; lottie: { layers: { t?: { d: { k: { s: { t: string } }[] } } }[] } }[] };
const headlineText = () => playerProps().elements[0]!.lottie.layers[0]!.t!.d.k[0]!.s.t;

async function open() {
  render(<Editor projectId={7} onBack={() => {}} />);
  await waitFor(() => expect(screen.getByLabelText('Headline')).toBeTruthy());
  placeHeadline();
  return screen.getByTestId('monitor');
}

describe('Editor: type on the video (M30)', () => {
  it('double-clicking a text layer opens an in-place editor over it; Enter commits to the composition and the panel', async () => {
    const fetchMock = mockApi();
    mockMonitorSize();
    const monitor = await open();
    expect(screen.queryByLabelText('Edit Headline on the video')).toBeNull();

    fireEvent.doubleClick(monitor, { clientX: 150, clientY: 150 });
    const field = (await screen.findByLabelText('Edit Headline on the video')) as HTMLTextAreaElement;
    expect(field.value).toBe('HI');
    fireEvent.change(field, { target: { value: 'VOTE TUESDAY' } });
    fireEvent.keyDown(field, { key: 'Enter' });

    await waitFor(() => expect(headlineText()).toBe('VOTE TUESDAY'));
    expect((screen.getByLabelText('Headline') as HTMLInputElement).value).toBe('VOTE TUESDAY');
    expect(screen.queryByLabelText('Edit Headline on the video')).toBeNull();
    await waitFor(() => {
      const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT');
      expect(put).toBeTruthy();
      expect(JSON.parse((put![1] as RequestInit).body as string)).toEqual({ values: [{ elementId: 3, key: 'headline', value: 'VOTE TUESDAY' }] });
    });
  });

  it('Escape closes the in-place editor and keeps the old text; a double-click on empty video does nothing', async () => {
    mockApi();
    mockMonitorSize();
    const monitor = await open();
    fireEvent.doubleClick(monitor, { clientX: 150, clientY: 150 });
    const field = (await screen.findByLabelText('Edit Headline on the video')) as HTMLTextAreaElement;
    fireEvent.change(field, { target: { value: 'NOPE' } });
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(screen.queryByLabelText('Edit Headline on the video')).toBeNull();
    await new Promise((r) => setTimeout(r, 150));
    expect(headlineText()).toBe('HI');

    fireEvent.doubleClick(monitor, { clientX: 400, clientY: 30 });
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByLabelText(/Edit .* on the video/)).toBeNull();
  });
});

describe('Editor: drop a clip on the video (M30)', () => {
  it('library clips are draggable; dragging over the video lights the footage slot; dropping assigns the clip and saves', async () => {
    const fetchMock = mockApi();
    mockMonitorSize();
    const monitor = await open();
    await waitFor(() => expect(screen.getAllByText('rally.mp4').length).toBeGreaterThan(0));
    const clip = screen.getByTestId('library-asset-4');
    expect(clip.getAttribute('draggable')).toBe('true');

    const dataTransfer = { data: {} as Record<string, string>, setData(k: string, v: string) { this.data[k] = v; }, getData(k: string) { return this.data[k] ?? ''; }, types: ['application/x-campaigncut-asset'], effectAllowed: 'copy', dropEffect: 'none' };
    fireEvent.dragStart(clip, { dataTransfer });
    expect(dataTransfer.getData('application/x-campaigncut-asset')).toBe('4');

    expect(screen.queryByTestId('drop-target')).toBeNull();
    fireEvent.dragOver(monitor, { dataTransfer, clientX: 400, clientY: 225 });
    expect(screen.getByTestId('drop-target')).toBeTruthy();
    fireEvent.drop(monitor, { dataTransfer, clientX: 400, clientY: 225 });
    await waitFor(() => expect(screen.queryByTestId('drop-target')).toBeNull());

    await waitFor(() => expect(playerProps().elements[0]!.media?.src).toBe('/api/media/proxies/4.mp4'));
    await waitFor(() => {
      const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT');
      expect(put).toBeTruthy();
      expect(JSON.parse((put![1] as RequestInit).body as string)).toEqual({ values: [{ elementId: 3, key: 'mediaFill', value: { assetId: 4, fit: 'cover' } }] });
    });
  });
});
