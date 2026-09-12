import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Editor } from './Editor';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const lottie = {
  fr: 30,
  ip: 0,
  op: 60,
  w: 1920,
  h: 1080,
  layers: [{ ty: 5, nm: 'cc.headline', t: { d: { k: [{ s: { t: 'AUTHORED', f: 'X', s: 10 }, t: 0 }] } } }],
};

const detail = {
  project: { id: 7, name: 'Demo project', templateId: 1, templateSlug: 'demo', templateName: 'Demo' },
  template: { id: 1, slug: 'demo', name: 'Demo', durationFrames: 60, fps: 30, width: 1920, height: 1080, thumbUrl: '' },
  schema: [{ key: 'headline', role: 'headline', kind: 'text', label: 'Headline', default: 'AUTHORED', path: '/layers/0' }],
  elements: [{ id: 3, slug: 'demo', zIndex: 0, startFrame: 0, endFrame: 60, enabled: true }],
  values: [{ elementId: 3, key: 'headline', value: 'SAVED EARLIER' }],
};

function mockApi() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    if (url === '/api/projects/7' && !init?.method) return new Response(JSON.stringify(detail), { status: 200 });
    if (url === '/api/templates/demo/template.json') return new Response(JSON.stringify(lottie), { status: 200 });
    if (url === '/api/projects/7/values' && init?.method === 'PUT') return new Response(JSON.stringify({ ok: true }), { status: 200 });
    return new Response('not found', { status: 404 });
  });
}

/** The Player is stubbed in test-setup to expose its inputProps as JSON. */
const playerHeadline = () => {
  const props = JSON.parse(screen.getByTestId('player').getAttribute('data-props')!) as {
    elements: { lottie: { layers: { t: { d: { k: { s: { t: string } }[] } } }[] } }[];
  };
  return props.elements[0]!.lottie.layers[0]!.t.d.k[0]!.s.t;
};

describe('Editor', () => {
  it('restores saved values on load, into the inspector and the composition', async () => {
    mockApi();
    render(<Editor projectId={7} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByLabelText('Headline')).toBeTruthy());
    expect((screen.getByLabelText('Headline') as HTMLInputElement).value).toBe('SAVED EARLIER');
    await waitFor(() => expect(playerHeadline()).toBe('SAVED EARLIER'));
  });

  it('typing updates the rendered composition and persists the values', async () => {
    const fetchMock = mockApi();
    render(<Editor projectId={7} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByLabelText('Headline')).toBeTruthy());

    fireEvent.change(screen.getByLabelText('Headline'), { target: { value: 'VOTE TUESDAY' } });
    await waitFor(() => expect(playerHeadline()).toBe('VOTE TUESDAY'));

    await waitFor(() => {
      const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT');
      expect(put).toBeTruthy();
      const body = JSON.parse((put![1] as RequestInit).body as string) as { values: { elementId: number; key: string; value: unknown }[] };
      expect(body.values).toEqual([{ elementId: 3, key: 'headline', value: 'VOTE TUESDAY' }]);
    });
    await waitFor(() => expect(screen.getByText('Saved')).toBeTruthy());
  });
});
