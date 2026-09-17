import { DEFAULT_TRANSFORM, layerClassFor } from '@campaigncut/composition';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Editor } from './Editor';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * M28: press on an editable layer on the monitor and drag it. Nothing has
 * to be switched on first. The layer's box comes from the rendered SVG
 * (here: stand-in nodes placed inside the stubbed Player); the Player's
 * props (what both runners render) carry the moved position, and the
 * transform value is saved with its element.
 */
const lottie = {
  fr: 30,
  ip: 0,
  op: 60,
  w: 1920,
  h: 1080,
  layers: [{ ty: 5, nm: 'cc.headline', ks: { p: { a: 0, k: [100, 200, 0] }, s: { a: 0, k: [100, 100, 100] }, r: { a: 0, k: 0 } }, t: { d: { k: [{ s: { t: 'HI', f: 'X', s: 10 }, t: 0 }] } } }],
};

const schema = [
  { key: 'headline', role: 'headline', kind: 'text', label: 'Headline', default: 'HI', path: '/layers/0' },
  { key: 'headline.transform', role: 'headline', kind: 'transform', label: 'Headline placement', default: DEFAULT_TRANSFORM, path: '/layers/0', for: 'headline' },
];

const detail = {
  project: { id: 7, name: 'Demo project', templateId: 1, templateSlug: 'demo', templateName: 'Demo' },
  template: { id: 1, slug: 'demo', name: 'Demo', durationFrames: 120, fps: 30, width: 1920, height: 1080, thumbUrl: '' },
  elements: [
    { id: 3, slug: 'open', name: 'Open', zIndex: 0, startFrame: 0, endFrame: 60, enabled: true, lottieUrl: '/templates/demo/elements/open/template.json', schema },
    { id: 4, slug: 'end', name: 'End card', zIndex: 1, startFrame: 60, endFrame: 120, enabled: true, lottieUrl: '/templates/demo/elements/end/template.json', schema },
  ],
  transitions: [],
  meta: { fonts: [], fontFiles: [] },
  values: [
    { elementId: 3, key: 'headline', value: 'HI' },
    { elementId: 4, key: 'headline', value: 'BYE' },
  ],
};

function mockApi() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    if (url === '/api/projects/7' && !init?.method) return new Response(JSON.stringify(detail), { status: 200 });
    if (url.endsWith('/template.json')) return new Response(JSON.stringify(lottie), { status: 200 });
    if (url === '/api/projects/7/values' && init?.method === 'PUT') return new Response(JSON.stringify({ ok: true }), { status: 200 });
    if (url === '/api/media') return new Response('[]', { status: 200 });
    return new Response('not found', { status: 404 });
  });
}

const rect = (left: number, top: number, width: number, height: number) =>
  ({ x: left, y: top, left, top, right: left + width, bottom: top + height, width, height, toJSON: () => ({}) }) as DOMRect;

/** jsdom has no layout: the monitor is 800x450 at the origin, and the stand-in layers sit where each test puts them. */
function mockMonitorSize() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 800, 450));
}

/** Stand in for what lottie-web renders: one tagged layer per element, at a known box. */
function placeLayers(boxes: { elementId: number; box: DOMRect }[]) {
  const player = screen.getByTestId('player');
  for (const { elementId, box } of boxes) {
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-cc-element', String(elementId));
    const layer = document.createElement('div');
    layer.className = `cc-layer ${layerClassFor('headline.transform')}`;
    // Assigned, not spied: spying an inherited method re-mocks the prototype spy, so every layer would share one box.
    layer.getBoundingClientRect = () => box;
    wrapper.appendChild(layer);
    player.appendChild(wrapper);
  }
}

const playerPosition = (index = 0) => {
  const props = JSON.parse(screen.getByTestId('player').getAttribute('data-props')!) as {
    elements: { lottie: { layers: { ks: { p: { k: number[] } } }[] } }[];
  };
  return props.elements[index]!.lottie.layers[0]!.ks.p.k;
};

async function open() {
  render(<Editor projectId={7} onBack={() => {}} />);
  await waitFor(() => expect(screen.getByLabelText('Headline')).toBeTruthy());
  placeLayers([
    { elementId: 3, box: rect(100, 100, 200, 100) },
    { elementId: 4, box: rect(500, 300, 200, 100) },
  ]);
  return screen.getByTestId('monitor');
}

describe('Editor: drag a layer on the monitor', () => {
  it('draws nothing over the monitor at rest', async () => {
    mockApi();
    mockMonitorSize();
    await open();
    expect(screen.queryByTestId('layer-outline')).toBeNull();
    expect(screen.queryByTestId('drag-surface')).toBeNull();
  });

  it('press, drag and release moves the layer by the fraction of the monitor travelled and saves the transform', async () => {
    const fetchMock = mockApi();
    mockMonitorSize();
    const monitor = await open();

    fireEvent.pointerDown(monitor, { clientX: 150, clientY: 150, buttons: 1, pointerId: 1 });
    fireEvent.pointerMove(monitor, { clientX: 230, clientY: 195, buttons: 1, pointerId: 1 });
    fireEvent.pointerUp(monitor, { clientX: 230, clientY: 195, pointerId: 1 });

    // 80px of 800 is 0.1 of the frame width (192px); 45px of 450 is 0.1 of the height (108px).
    await waitFor(() => expect(playerPosition(0)).toEqual([100 + 192, 200 + 108, 0]));
    expect(playerPosition(1)).toEqual([100, 200, 0]);

    await waitFor(() => {
      const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT');
      expect(put).toBeTruthy();
      const body = JSON.parse((put![1] as RequestInit).body as string) as { values: unknown[] };
      expect(body.values).toEqual([{ elementId: 3, key: 'headline.transform', value: { x: 0.1, y: 0.1, scale: 1, rotation: 0 } }]);
    });
  });

  it('a press on another element selects it without moving anything', async () => {
    const fetchMock = mockApi();
    mockMonitorSize();
    const monitor = await open();
    expect(screen.getByTestId('element-tab-3').getAttribute('aria-selected')).toBe('true');

    fireEvent.pointerDown(monitor, { clientX: 600, clientY: 350, buttons: 1, pointerId: 1 });
    fireEvent.pointerUp(monitor, { clientX: 600, clientY: 350, pointerId: 1 });

    await waitFor(() => expect(screen.getByTestId('element-tab-4').getAttribute('aria-selected')).toBe('true'));
    expect(screen.getByTestId('param-headline').getAttribute('data-active')).toBe('true');
    await new Promise((r) => setTimeout(r, 500));
    expect(playerPosition(1)).toEqual([100, 200, 0]);
    expect(fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')).toBeUndefined();
  });

  it('a press on empty monitor does nothing', async () => {
    mockApi();
    mockMonitorSize();
    const monitor = await open();
    fireEvent.pointerDown(monitor, { clientX: 400, clientY: 50, buttons: 1, pointerId: 1 });
    fireEvent.pointerMove(monitor, { clientX: 480, clientY: 95, buttons: 1, pointerId: 1 });
    fireEvent.pointerUp(monitor, { clientX: 480, clientY: 95, pointerId: 1 });
    await new Promise((r) => setTimeout(r, 200));
    expect(playerPosition(0)).toEqual([100, 200, 0]);
    expect(screen.getByTestId('element-tab-3').getAttribute('aria-selected')).toBe('true');
  });

  it('Shift keeps the drag to one axis', async () => {
    mockApi();
    mockMonitorSize();
    const monitor = await open();
    fireEvent.pointerDown(monitor, { clientX: 150, clientY: 150, buttons: 1, pointerId: 1 });
    fireEvent.pointerMove(monitor, { clientX: 230, clientY: 160, buttons: 1, pointerId: 1, shiftKey: true });
    fireEvent.pointerUp(monitor, { clientX: 230, clientY: 160, pointerId: 1, shiftKey: true });
    await waitFor(() => expect(playerPosition(0)).toEqual([100 + 192, 200, 0]));
  });

  it('outlines an editable layer while the pointer hovers it, and not otherwise', async () => {
    mockApi();
    mockMonitorSize();
    const monitor = await open();
    fireEvent.pointerMove(monitor, { clientX: 150, clientY: 150, buttons: 0, pointerId: 1 });
    const outline = await screen.findByTestId('layer-outline');
    expect(outline.style.pointerEvents).toBe('none');
    fireEvent.pointerMove(monitor, { clientX: 400, clientY: 50, buttons: 0, pointerId: 1 });
    await waitFor(() => expect(screen.queryByTestId('layer-outline')).toBeNull());
  });
});

describe('Editor: arrow keys nudge the active placement (M25, M28)', () => {
  it('moves by half a percent, 2% with Shift, only after a press on the monitor and not inside a text field', async () => {
    mockApi();
    mockMonitorSize();
    const monitor = await open();

    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    await new Promise((r) => setTimeout(r, 100));
    expect(playerPosition(0)).toEqual([100, 200, 0]); // nothing active yet

    fireEvent.pointerDown(monitor, { clientX: 150, clientY: 150, buttons: 1, pointerId: 1 });
    fireEvent.pointerUp(monitor, { clientX: 150, clientY: 150, pointerId: 1 });
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    fireEvent.keyDown(document.body, { key: 'ArrowDown', shiftKey: true });
    await waitFor(() => expect(playerPosition(0)).toEqual([100 + 0.005 * 1920, 200 + 0.02 * 1080, 0]));

    fireEvent.keyDown(screen.getByLabelText('Headline'), { key: 'ArrowLeft' });
    await new Promise((r) => setTimeout(r, 100));
    expect(playerPosition(0)).toEqual([100 + 0.005 * 1920, 200 + 0.02 * 1080, 0]);
  });
});
