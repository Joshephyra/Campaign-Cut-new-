import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Editor } from './Editor';

/** M37: previews are drawn by lottie-web; here it only records what it was asked to draw. */
const drawn: { animationData: { layers: { t?: { d: { k: { s: { t: string } }[] } } }[] } }[] = [];
vi.mock('lottie-web', () => ({ default: { loadAnimation: (args: (typeof drawn)[number]) => { drawn.push(args); return { goToAndStop: () => {}, destroy: () => {} }; } } }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * M31: the element library in the editor. An "Add" chip at the end of the
 * scene strip opens the library, grouped by type; pressing an element adds
 * it at the playhead, selects it and shows its controls. Added elements can
 * be removed from the spot; the spot's own cannot.
 */
const textLottie = (text: string) => ({ fr: 30, ip: 0, op: 90, w: 1920, h: 1080, layers: [{ ty: 5, nm: 'cc.headline', t: { d: { k: [{ s: { t: text, f: 'X', s: 10 }, t: 0 }] } } }] });

const detail = {
  project: { id: 7, name: 'Bio project', templateId: 1, templateSlug: 'bio', templateName: 'Bio' },
  template: { id: 1, slug: 'bio', name: 'Bio', durationFrames: 90, fps: 30, width: 1920, height: 1080, thumbUrl: '' },
  elements: [
    { id: 3, slug: 'open', name: 'Open', type: 'open', templateSlug: 'bio', added: false, zIndex: 0, startFrame: 0, endFrame: 90, enabled: true, lottieUrl: '/templates/bio/elements/open/template.json', schema: [{ key: 'headline', role: 'headline', kind: 'text', label: 'Headline', default: 'OPEN', path: '/layers/0' }] },
  ],
  transitions: [],
  meta: { fonts: [], fontFiles: [] },
  values: [],
};

const previewable = (lottieUrl: string, key: string) => ({ lottieUrl, schema: [{ key, role: key, kind: 'text', label: key, default: 'X', path: '/layers/0' }], fontFiles: [] });
const library = [
  { id: 3, slug: 'open', name: 'Open', type: 'open', durationInFrames: 90, templateId: 1, templateSlug: 'bio', templateName: 'Bio', thumbUrl: '/templates/bio/thumb.png', ...previewable('/templates/bio/elements/open/template.json', 'headline') },
  { id: 9, slug: 'lower-third', name: 'Lower third', type: 'lower-third', durationInFrames: 150, templateId: 2, templateSlug: 'contrast', templateName: 'Contrast :30', thumbUrl: '/templates/contrast/thumb.png', ...previewable('/templates/contrast/elements/lower-third/template.json', 'subhead') },
  { id: 10, slug: 'end-card', name: 'End card', type: 'end-card', durationInFrames: 150, templateId: 2, templateSlug: 'contrast', templateName: 'Contrast :30', thumbUrl: '/templates/contrast/thumb.png', ...previewable('/templates/contrast/elements/end-card/template.json', 'headline') },
];

const added = {
  id: 9, slug: 'lower-third', name: 'Lower third', type: 'lower-third', templateSlug: 'contrast', added: true, zIndex: 1, startFrame: 30, endFrame: 180, enabled: true,
  lottieUrl: '/templates/contrast/elements/lower-third/template.json',
  schema: [{ key: 'subhead', role: 'subhead', kind: 'text', label: 'Subhead', default: 'LOWER', path: '/layers/0' }],
};

type Call = { url: string; init?: RequestInit };
function mockApi() {
  const calls: Call[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    if (url === '/api/projects/7' && !init?.method) return new Response(JSON.stringify(detail), { status: 200 });
    if (url === '/api/elements') return new Response(JSON.stringify(library), { status: 200 });
    if (url.endsWith('/template.json')) return new Response(JSON.stringify(textLottie('X')), { status: 200 });
    if (url === '/api/media') return new Response('[]', { status: 200 });
    if (url === '/api/projects/7/elements' && init?.method === 'POST') return new Response(JSON.stringify(added), { status: 201 });
    if (url === '/api/projects/7/elements/9' && init?.method === 'DELETE') return new Response(JSON.stringify({ ok: true }), { status: 200 });
    if (init?.method === 'PUT') return new Response(init.body as string, { status: 200 });
    return new Response('not found', { status: 404 });
  });
  return calls;
}

const playerElementIds = () => (JSON.parse(screen.getByTestId('player').getAttribute('data-props')!) as { elements: { id: string }[] }).elements.map((e) => e.id);

describe('Editor element library (M31)', () => {
  it('previews every text element with the copy typed in the composer (M37)', async () => {
    mockApi();
    render(<Editor projectId={7} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByLabelText('Headline')).toBeTruthy());
    fireEvent.click(screen.getByLabelText('Add a scene'));
    await screen.findByLabelText('Preview every text element with your copy');
    const composer = screen.getByLabelText('Preview every text element with your copy') as HTMLInputElement;
    await waitFor(() => expect(screen.getByTestId('element-preview-9')).toBeTruthy());
    drawn.length = 0;
    fireEvent.change(composer, { target: { value: 'A NEW DIRECTION' } });
    await waitFor(() => expect(drawn.length).toBeGreaterThanOrEqual(2));
    const texts = drawn.map((d) => d.animationData.layers[0]!.t!.d.k[0]!.s.t);
    expect(texts.every((t) => t === 'A NEW DIRECTION')).toBe(true);
  });

  it('the copy typed in the composer lands with the element and is saved (M42)', async () => {
    const calls = mockApi();
    render(<Editor projectId={7} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByLabelText('Headline')).toBeTruthy());
    fireEvent.click(screen.getByLabelText('Add a scene'));
    await screen.findByLabelText('Preview every text element with your copy');
    fireEvent.change(screen.getByLabelText('Preview every text element with your copy'), { target: { value: 'A NEW DIRECTION' } });
    fireEvent.click(screen.getByLabelText('Add Lower third from Contrast :30'));
    await waitFor(() => expect(screen.getByLabelText('Subhead')).toBeTruthy());
    expect((screen.getByLabelText('Subhead') as HTMLInputElement).value).toBe('A NEW DIRECTION');
    await waitFor(() => {
      const put = calls.find((c) => c.url === '/api/projects/7/values' && c.init?.method === 'PUT' && (c.init.body as string).includes('A NEW DIRECTION'));
      expect(put).toBeTruthy();
    });
  });

  it('the Add chip opens the library grouped by type; pressing an element adds it at the playhead, selects it and shows its controls', async () => {
    const calls = mockApi();
    render(<Editor projectId={7} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByLabelText('Headline')).toBeTruthy());
    expect(screen.queryByLabelText('Add Lower third from Contrast :30')).toBeNull(); // M66: the shelves are folded until asked for

    fireEvent.change(screen.getByLabelText('Scrub'), { target: { value: '30' } });
    fireEvent.click(screen.getByLabelText('Add a scene'));
    await screen.findByLabelText('Add Lower third from Contrast :30'); // M66: the Add card opens every shelf
    const picker = screen.getByTestId('library-browser');
    expect(picker.textContent).toContain('Lower third');
    expect(picker.textContent).toContain('End card');
    expect(picker.textContent).toContain('Contrast :30');
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Openings', 'End cards', 'Lower thirds']); // M51: the spot's shape first, then what sits on a scene

    fireEvent.click(screen.getByRole('button', { name: 'Add Lower third from Contrast :30' }));
    await waitFor(() => expect(screen.getByTestId('scene-9')).toBeTruthy());
    const post = calls.find((c) => c.url === '/api/projects/7/elements' && c.init?.method === 'POST')!;
    expect(JSON.parse(post.init!.body as string)).toEqual({ elementId: 9, startFrame: 30 });
    expect(screen.getByTestId('scene-9').getAttribute('data-selected')).toBe('true');
    await waitFor(() => expect(screen.getByLabelText('Subhead')).toBeTruthy());
    expect((screen.getByLabelText('Subhead') as HTMLInputElement).value).toBe('LOWER');
    await waitFor(() => expect(playerElementIds()).toEqual(['3', '9']));
  });

  it('an added element offers Remove from spot; the spot\'s own does not', async () => {
    const calls = mockApi();
    render(<Editor projectId={7} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByLabelText('Headline')).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Remove from spot' })).toBeNull();

    fireEvent.click(screen.getByLabelText('Add a scene'));
    fireEvent.click(await screen.findByRole('button', { name: 'Add Lower third from Contrast :30' }));
    await waitFor(() => expect(screen.getByLabelText('Subhead')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Remove from spot' }));
    await waitFor(() => expect(screen.queryByTestId('scene-9')).toBeNull());
    expect(calls.some((c) => c.url === '/api/projects/7/elements/9' && c.init?.method === 'DELETE')).toBe(true);
    await waitFor(() => expect(playerElementIds()).toEqual(['3']));
    expect(screen.getByLabelText('Headline')).toBeTruthy();
  });
});

/** M45: the same element added twice is two scenes, each its own; the picker says how many times it is in the spot. */
describe('Editor: the same element twice (M45)', () => {
  it('adds a lower third twice: two chips, the second with a fresh id, and the picker says "in the spot ×2"', async () => {
    let adds = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === '/api/projects/7' && !init?.method) return new Response(JSON.stringify(detail), { status: 200 });
      if (url === '/api/elements') return new Response(JSON.stringify(library), { status: 200 });
      if (url.endsWith('/template.json')) return new Response(JSON.stringify(textLottie('X')), { status: 200 });
      if (url === '/api/media' || url === '/api/themes') return new Response('[]', { status: 200 });
      if (url === '/api/projects/7/elements' && init?.method === 'POST') {
        adds += 1;
        const id = adds === 1 ? 9 : 10_000_000 + adds;
        return new Response(JSON.stringify({ ...added, id, elementId: 9 }), { status: 201 });
      }
      if (init?.method === 'PUT') return new Response(init.body as string, { status: 200 });
      return new Response('not found', { status: 404 });
    });
    render(<Editor projectId={7} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByLabelText('Headline')).toBeTruthy());
    for (const n of [1, 2]) {
      fireEvent.click(screen.getByLabelText('Add a scene'));
      await screen.findByLabelText('Preview every text element with your copy');
      const button = screen.getByLabelText('Add Lower third from Contrast :30');
      expect((button as HTMLButtonElement).disabled).toBe(false);
      if (n === 2) expect(button.textContent).toContain('in the spot');
      fireEvent.click(button);
      await waitFor(() => expect(screen.getAllByTestId(/^scene-[0-9]+$/)).toHaveLength(1 + n));
    }
    expect(screen.getByTestId('scene-9')).toBeTruthy();
    expect(screen.getByTestId('scene-10000002')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Add a scene'));
    await screen.findByLabelText('Preview every text element with your copy');
    expect(screen.getByLabelText('Add Lower third from Contrast :30').textContent).toContain('in the spot ×2');
  });
});
