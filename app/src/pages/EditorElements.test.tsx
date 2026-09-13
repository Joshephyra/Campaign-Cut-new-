import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Editor } from './Editor';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * M17: a project has several elements, each with its own Lottie, schema and
 * values. The inspector shows the SELECTED element's controls (SPEC section
 * 4) and the preview runner hands the Player one Lottie per element, built
 * exactly as the export runner builds them.
 */
const textLottie = (text: string) => ({
  fr: 30,
  ip: 0,
  op: 90,
  w: 1920,
  h: 1080,
  layers: [{ ty: 5, nm: 'cc.headline', t: { d: { k: [{ s: { t: text, f: 'X', s: 10 }, t: 0 }] } } }],
});

const detail = {
  project: { id: 7, name: 'Two part project', templateId: 1, templateSlug: 'two', templateName: 'Two' },
  template: { id: 1, slug: 'two', name: 'Two', durationFrames: 180, fps: 30, width: 1920, height: 1080, thumbUrl: '' },
  elements: [
    {
      id: 3,
      slug: 'open',
      name: 'Open',
      zIndex: 0,
      startFrame: 0,
      endFrame: 90,
      enabled: true,
      lottieUrl: '/templates/two/elements/open/template.json',
      schema: [{ key: 'headline', role: 'headline', kind: 'text', label: 'Headline', default: 'OPEN', path: '/layers/0' }],
    },
    {
      id: 4,
      slug: 'lower-third',
      name: 'Lower third',
      zIndex: 1,
      startFrame: 60,
      endFrame: 120,
      enabled: true,
      lottieUrl: '/templates/two/elements/lower-third/template.json',
      schema: [{ key: 'subhead', role: 'subhead', kind: 'text', label: 'Subhead', default: 'LOWER', path: '/layers/0' }],
    },
  ],
  transitions: [],
  meta: { fonts: [], fontFiles: [] },
  values: [
    { elementId: 3, key: 'headline', value: 'OPEN SAVED' },
    { elementId: 4, key: 'subhead', value: 'LOWER SAVED' },
  ],
};

function mockApi() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    if (url === '/api/projects/7' && !init?.method) return new Response(JSON.stringify(detail), { status: 200 });
    if (url === '/api/templates/two/elements/open/template.json') return new Response(JSON.stringify(textLottie('OPEN')), { status: 200 });
    if (url === '/api/templates/two/elements/lower-third/template.json') return new Response(JSON.stringify(textLottie('LOWER')), { status: 200 });
    if (url === '/api/projects/7/values' && init?.method === 'PUT') return new Response(JSON.stringify({ ok: true }), { status: 200 });
    if (url === '/api/media') return new Response('[]', { status: 200 });
    return new Response('not found', { status: 404 });
  });
}

const playerTexts = () => {
  const props = JSON.parse(screen.getByTestId('player').getAttribute('data-props')!) as {
    elements: { id: string; lottie: { layers: { t: { d: { k: { s: { t: string } }[] } } }[] } }[];
  };
  return props.elements.map((e) => [e.id, e.lottie.layers[0]!.t.d.k[0]!.s.t]);
};

describe('Editor with several elements', () => {
  it('loads every element\'s Lottie, applies each element\'s saved values, and shows the first element\'s controls', async () => {
    mockApi();
    render(<Editor projectId={7} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByLabelText('Headline')).toBeTruthy());
    expect(screen.queryByLabelText('Subhead')).toBeNull();
    expect((screen.getByLabelText('Headline') as HTMLInputElement).value).toBe('OPEN SAVED');
    await waitFor(() =>
      expect(playerTexts()).toEqual([
        ['3', 'OPEN SAVED'],
        ['4', 'LOWER SAVED'],
      ]),
    );
  });

  it('selecting the lower third in the timeline switches the inspector to its controls', async () => {
    mockApi();
    render(<Editor projectId={7} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByLabelText('Headline')).toBeTruthy());
    fireEvent.click(screen.getByLabelText('Select Lower third'));
    await waitFor(() => expect(screen.getByLabelText('Subhead')).toBeTruthy());
    expect(screen.queryByLabelText('Headline')).toBeNull();
    expect((screen.getByLabelText('Subhead') as HTMLInputElement).value).toBe('LOWER SAVED');
    expect(screen.getByTestId('element-row-4').getAttribute('data-selected')).toBe('true');
  });

  it('the element tabs above the inspector select too, and edits save with that element\'s id', async () => {
    const fetchMock = mockApi();
    render(<Editor projectId={7} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByLabelText('Headline')).toBeTruthy());
    fireEvent.click(screen.getByTestId('element-tab-4'));
    await waitFor(() => expect(screen.getByLabelText('Subhead')).toBeTruthy());

    fireEvent.change(screen.getByLabelText('Subhead'), { target: { value: 'NEW LOWER' } });
    await waitFor(() =>
      expect(playerTexts()).toEqual([
        ['3', 'OPEN SAVED'],
        ['4', 'NEW LOWER'],
      ]),
    );
    await waitFor(() => {
      const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT');
      expect(put).toBeTruthy();
      const body = JSON.parse((put![1] as RequestInit).body as string) as { values: unknown[] };
      expect(body.values).toEqual([{ elementId: 4, key: 'subhead', value: 'NEW LOWER' }]);
    });
  });
});
