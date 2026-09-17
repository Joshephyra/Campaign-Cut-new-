import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Editor } from './Editor';

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

const library = [
  { id: 3, slug: 'open', name: 'Open', type: 'open', durationInFrames: 90, templateId: 1, templateSlug: 'bio', templateName: 'Bio', thumbUrl: '/templates/bio/thumb.png' },
  { id: 9, slug: 'lower-third', name: 'Lower third', type: 'lower-third', durationInFrames: 150, templateId: 2, templateSlug: 'contrast', templateName: 'Contrast :30', thumbUrl: '/templates/contrast/thumb.png' },
  { id: 10, slug: 'end-card', name: 'End card', type: 'end-card', durationInFrames: 150, templateId: 2, templateSlug: 'contrast', templateName: 'Contrast :30', thumbUrl: '/templates/contrast/thumb.png' },
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
  it('the Add chip opens the library grouped by type; pressing an element adds it at the playhead, selects it and shows its controls', async () => {
    const calls = mockApi();
    render(<Editor projectId={7} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByLabelText('Headline')).toBeTruthy());
    expect(screen.queryByRole('dialog', { name: 'Add to the spot' })).toBeNull();

    fireEvent.change(screen.getByLabelText('Scrub'), { target: { value: '30' } });
    fireEvent.click(screen.getByLabelText('Add a scene'));
    const picker = await screen.findByRole('dialog', { name: 'Add to the spot' });
    expect(picker.textContent).toContain('Lower third');
    expect(picker.textContent).toContain('End card');
    expect(picker.textContent).toContain('Contrast :30');
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Open', 'Lower thirds', 'End cards']);

    fireEvent.click(screen.getByRole('button', { name: 'Add Lower third from Contrast :30' }));
    await waitFor(() => expect(screen.getByTestId('scene-9')).toBeTruthy());
    const post = calls.find((c) => c.url === '/api/projects/7/elements' && c.init?.method === 'POST')!;
    expect(JSON.parse(post.init!.body as string)).toEqual({ elementId: 9, startFrame: 30 });
    expect(screen.getByTestId('scene-9').getAttribute('data-selected')).toBe('true');
    await waitFor(() => expect(screen.getByLabelText('Subhead')).toBeTruthy());
    expect((screen.getByLabelText('Subhead') as HTMLInputElement).value).toBe('LOWER');
    await waitFor(() => expect(playerElementIds()).toEqual(['3', '9']));
    expect(screen.queryByRole('dialog', { name: 'Add to the spot' })).toBeNull();
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
