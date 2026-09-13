import { DEFAULT_TRANSFORM } from '@campaigncut/composition';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Editor } from './Editor';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * M18: with "Drag on monitor" on, dragging across the monitor moves the
 * chosen layer by the same fraction of the frame the pointer travelled.
 * The Player's props (what both runners render) carry the moved position,
 * and the transform value is saved with its element.
 */
const lottie = {
  fr: 30,
  ip: 0,
  op: 60,
  w: 1920,
  h: 1080,
  layers: [{ ty: 5, nm: 'cc.headline', ks: { p: { a: 0, k: [100, 200, 0] }, s: { a: 0, k: [100, 100, 100] }, r: { a: 0, k: 0 } }, t: { d: { k: [{ s: { t: 'HI', f: 'X', s: 10 }, t: 0 }] } } }],
};

const detail = {
  project: { id: 7, name: 'Demo project', templateId: 1, templateSlug: 'demo', templateName: 'Demo' },
  template: { id: 1, slug: 'demo', name: 'Demo', durationFrames: 60, fps: 30, width: 1920, height: 1080, thumbUrl: '' },
  elements: [
    {
      id: 3,
      slug: 'demo',
      name: 'Demo',
      zIndex: 0,
      startFrame: 0,
      endFrame: 60,
      enabled: true,
      lottieUrl: '/templates/demo/template.json',
      schema: [
        { key: 'headline', role: 'headline', kind: 'text', label: 'Headline', default: 'HI', path: '/layers/0' },
        { key: 'headline.transform', role: 'headline', kind: 'transform', label: 'Headline placement', default: DEFAULT_TRANSFORM, path: '/layers/0', for: 'headline' },
      ],
    },
  ],
  transitions: [],
  meta: { fonts: [], fontFiles: [] },
  values: [
    { elementId: 3, key: 'headline', value: 'HI' },
    { elementId: 3, key: 'headline.transform', value: DEFAULT_TRANSFORM },
  ],
};

function mockApi() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    if (url === '/api/projects/7' && !init?.method) return new Response(JSON.stringify(detail), { status: 200 });
    if (url === '/api/templates/demo/template.json') return new Response(JSON.stringify(lottie), { status: 200 });
    if (url === '/api/projects/7/values' && init?.method === 'PUT') return new Response(JSON.stringify({ ok: true }), { status: 200 });
    if (url === '/api/media') return new Response('[]', { status: 200 });
    return new Response('not found', { status: 404 });
  });
}

/** jsdom has no layout: the monitor is 800x450 for this test. */
function mockMonitorSize() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 450, width: 800, height: 450, toJSON: () => ({}),
  } as DOMRect);
}

const playerPosition = () => {
  const props = JSON.parse(screen.getByTestId('player').getAttribute('data-props')!) as {
    elements: { lottie: { layers: { ks: { p: { k: number[] } } }[] } }[];
  };
  return props.elements[0]!.lottie.layers[0]!.ks.p.k;
};

describe('Editor: drag on monitor', () => {
  it('is off by default: no capture surface over the Player', async () => {
    mockApi();
    render(<Editor projectId={7} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByLabelText('Headline')).toBeTruthy());
    expect(screen.queryByTestId('drag-surface')).toBeNull();
  });

  it('dragging moves the layer by the fraction of the monitor travelled and saves the transform', async () => {
    const fetchMock = mockApi();
    mockMonitorSize();
    render(<Editor projectId={7} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByLabelText('Headline')).toBeTruthy());

    fireEvent.click(screen.getByLabelText('Drag Headline on monitor'));
    const surface = screen.getByTestId('drag-surface');
    fireEvent.pointerDown(surface, { clientX: 100, clientY: 100, buttons: 1, pointerId: 1 });
    fireEvent.pointerMove(surface, { clientX: 180, clientY: 145, buttons: 1, pointerId: 1 });
    fireEvent.pointerUp(surface, { clientX: 180, clientY: 145, pointerId: 1 });

    // 80px of 800 is 0.1 of the frame width (192px); 45px of 450 is 0.1 of the height (108px).
    await waitFor(() => expect(playerPosition()).toEqual([100 + 192, 200 + 108, 0]));
    expect((screen.getByLabelText('Headline X') as HTMLInputElement).value).toBe('10');

    await waitFor(() => {
      const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT');
      expect(put).toBeTruthy();
      const body = JSON.parse((put![1] as RequestInit).body as string) as { values: unknown[] };
      expect(body.values).toEqual([{ elementId: 3, key: 'headline.transform', value: { x: 0.1, y: 0.1, scale: 1, rotation: 0 } }]);
    });

    // toggling off removes the surface
    fireEvent.click(screen.getByLabelText('Drag Headline on monitor'));
    expect(screen.queryByTestId('drag-surface')).toBeNull();
  });
});
