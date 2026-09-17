import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Editor } from './Editor';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * M52: timing is locked and a spot is exactly its length. Length chips in
 * the top bar; a gauge under the monitor; the readiness list blocks until
 * the content fits, and "Cut down" hides proof points from the end.
 */
const lottie = { fr: 30, ip: 0, op: 300, w: 1920, h: 1080, layers: [] };
const disclaimer = { key: 'disclaimer', role: 'safe.disclaimer', kind: 'text', label: 'Disclaimer', default: 'Paid for by Example', path: '/layers/0', locked: true };
const element = (id: number, slug: string, type: string, startFrame: number, endFrame: number, schema: unknown[] = []) => ({
  id, elementId: id, slug, name: slug, type, templateSlug: 'pack', added: true, zIndex: 0, startFrame, endFrame, enabled: true,
  lottieUrl: `/templates/pack/elements/${slug}/template.json`, schema,
});
const detail = {
  project: { id: 7, name: 'A thirty', templateId: 1, templateSlug: 'blank', templateName: 'Blank spot', lengthS: 30 },
  template: { id: 1, slug: 'blank', name: 'Blank spot', durationFrames: 0, fps: 30, width: 1920, height: 1080, thumbUrl: '' },
  elements: [
    element(1, 'opening', 'open', 0, 150),
    element(2, 'lower', 'lower-third', 30, 150),
    element(3, 'proof-a', 'background', 150, 330),
    element(4, 'proof-b', 'background', 330, 510),
    element(5, 'proof-c', 'stat', 510, 690),
    element(6, 'end', 'end-card', 690, 900, [disclaimer]),
  ],
  transitions: [],
  meta: { fonts: [], fontFiles: [] },
  values: [{ elementId: 6, key: 'disclaimer', value: 'Paid for by Us' }],
};

function mockApi() {
  const calls: { url: string; method: string; body: Record<string, unknown> }[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    if (init?.method && init.method !== 'GET') calls.push({ url, method: init.method, body: init.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : {} });
    if (url === '/api/projects/7' && !init?.method) return new Response(JSON.stringify(detail), { status: 200 });
    if (url === '/api/projects/7' && init?.method === 'PATCH') return new Response(JSON.stringify({ id: 7, ...(JSON.parse(init.body as string) as object) }), { status: 200 });
    if (url.endsWith('/template.json')) return new Response(JSON.stringify(lottie), { status: 200 });
    if (url === '/api/media' || url === '/api/themes' || url === '/api/elements') return new Response('[]', { status: 200 });
    if (init?.method === 'PUT') return new Response(init.body as string, { status: 200 });
    return new Response('not found', { status: 404 });
  });
  return calls;
}
const props = () => JSON.parse(screen.getByTestId('player').getAttribute('data-props')!) as { lengthFrames: number; elements: { id: string; startFrame: number; endFrame: number; enabled: boolean }[] };

describe('Editor: the spot\'s length (M52)', () => {
  it('shows the length chips and the gauge, plays exactly the length, and has no Length slider', async () => {
    mockApi();
    render(<Editor projectId={7} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByRole('group', { name: 'Spot length' })).toBeTruthy());
    expect(Array.from(screen.getByRole('group', { name: 'Spot length' }).querySelectorAll('button')).map((b) => b.textContent)).toEqual([':06', ':15', ':30', ':60']);
    expect(screen.getByRole('button', { name: 'Length :30' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('length-gauge').textContent).toBe('30.0 s of 30.0 s');
    expect(props().lengthFrames).toBe(900);
    expect(screen.queryByRole('slider', { name: / length$/ })).toBeNull();
    expect(screen.getByTestId('readiness').getAttribute('data-ok')).toBe('true');
  });

  it('switching to :15 saves it, blocks the export as over, and Cut down hides proof points from the end until it fits', async () => {
    const calls = mockApi();
    render(<Editor projectId={7} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Length :15' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Length :15' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH' && c.body.lengthS === 15)).toBe(true));
    expect(screen.getByTestId('length-gauge').textContent).toBe('30.0 s of 15.0 s');
    expect(props().lengthFrames).toBe(450);
    expect(screen.getByTestId('readiness').getAttribute('data-blocked')).toBe('true');
    fireEvent.click(screen.getByTestId('readiness'));
    expect(screen.getByTestId('check-length').textContent).toContain('Cut 15.0 s of scenes');
    fireEvent.click(screen.getByRole('button', { name: 'Cut down to :15' }));
    // the three proof points go (hidden), the end card moves back: opening 5 s + end card 7 s
    await waitFor(() => expect(props().elements.filter((e) => e.enabled).map((e) => [e.id, e.startFrame, e.endFrame])).toEqual([['1', 0, 150], ['2', 30, 150], ['6', 150, 360]]));
    expect(screen.getByTestId('length-gauge').textContent).toBe('12.0 s of 15.0 s');
    expect(screen.getByTestId('check-length').textContent).toContain('Add 3.0 s of scenes');
    await waitFor(() => expect(calls.some((c) => c.url === '/api/projects/7/elements/5' && c.method === 'PUT' && c.body.enabled === false)).toBe(true), { timeout: 4000 });
    expect(calls.find((c) => c.url === '/api/projects/7/elements/6' && c.method === 'PUT')?.body).toMatchObject({ startFrame: 150, endFrame: 360 });
  });
});
