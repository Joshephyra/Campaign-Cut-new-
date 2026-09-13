import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Editor } from './Editor';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** M23: a wrong edit is one Undo away; the preview follows and the earlier state is saved. */
const lottie = { fr: 30, ip: 0, op: 60, w: 1920, h: 1080, layers: [{ ty: 5, nm: 'cc.headline', t: { d: { k: [{ s: { t: 'HI', f: 'X', s: 10 }, t: 0 }] } } }] };
const detail = {
  project: { id: 7, name: 'Demo project', templateId: 1, templateSlug: 'demo', templateName: 'Demo' },
  template: { id: 1, slug: 'demo', name: 'Demo', durationFrames: 60, fps: 30, width: 1920, height: 1080, thumbUrl: '' },
  elements: [{ id: 3, slug: 'demo', name: 'Demo', zIndex: 0, startFrame: 0, endFrame: 60, enabled: true, lottieUrl: '/templates/demo/template.json', schema: [{ key: 'headline', role: 'headline', kind: 'text', label: 'Headline', default: 'HI', path: '/layers/0' }] }],
  transitions: [],
  meta: { fonts: [], fontFiles: [] },
  audio: null,
  values: [{ elementId: 3, key: 'headline', value: 'HI' }],
};

function mockApi() {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    calls.push({ url, init: init ?? undefined });
    if (url === '/api/projects/7' && !init?.method) return new Response(JSON.stringify(detail), { status: 200 });
    if (url === '/api/templates/demo/template.json') return new Response(JSON.stringify(lottie), { status: 200 });
    if (url === '/api/media') return new Response('[]', { status: 200 });
    if (url === '/api/projects/7/values' && init?.method === 'PUT') return new Response(JSON.stringify({ ok: true }), { status: 200 });
    if (url.startsWith('/api/projects/7/elements/') && init?.method === 'PUT') return new Response(init.body as string, { status: 200 });
    return new Response('not found', { status: 404 });
  });
  return calls;
}

const playerHeadline = () => {
  const props = JSON.parse(screen.getByTestId('player').getAttribute('data-props')!) as { elements: { lottie: { layers: { t: { d: { k: { s: { t: string } }[] } } }[] } }[] };
  return props.elements[0]!.lottie.layers[0]!.t.d.k[0]!.s.t;
};
const valuePuts = (calls: { url: string; init?: RequestInit }[]) =>
  calls.filter((c) => c.url === '/api/projects/7/values' && c.init?.method === 'PUT').map((c) => (JSON.parse(c.init!.body as string) as { values: { value: unknown }[] }).values[0]!.value);

describe('Editor undo and redo', () => {
  it('starts with nothing to undo or redo', async () => {
    mockApi();
    render(<Editor projectId={7} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByLabelText('Headline')).toBeTruthy());
    expect((screen.getByLabelText('Undo') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText('Redo') as HTMLButtonElement).disabled).toBe(true);
  });

  it('undoes a text edit in the field and the Player, saves the earlier text, and redoes it', async () => {
    const calls = mockApi();
    render(<Editor projectId={7} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByLabelText('Headline')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Headline'), { target: { value: 'VOTE' } });
    await waitFor(() => expect(playerHeadline()).toBe('VOTE'));
    await waitFor(() => expect(valuePuts(calls)).toContain('VOTE'));

    fireEvent.click(screen.getByLabelText('Undo'));
    expect((screen.getByLabelText('Headline') as HTMLInputElement).value).toBe('HI');
    await waitFor(() => expect(playerHeadline()).toBe('HI'));
    await waitFor(() => expect(valuePuts(calls).at(-1)).toBe('HI'));
    expect((screen.getByLabelText('Redo') as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(screen.getByLabelText('Redo'));
    expect((screen.getByLabelText('Headline') as HTMLInputElement).value).toBe('VOTE');
    await waitFor(() => expect(playerHeadline()).toBe('VOTE'));
  });

  it('undoes a timeline move and saves the old in and out points', async () => {
    const calls = mockApi();
    render(<Editor projectId={7} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByLabelText('Toggle demo')).toBeTruthy());
    fireEvent.click(screen.getByLabelText('Toggle demo')); // off
    await waitFor(() => expect(calls.some((c) => c.url === '/api/projects/7/elements/3' && (c.init!.body as string).includes('"enabled":false'))).toBe(true));

    fireEvent.click(screen.getByLabelText('Undo'));
    expect((screen.getByLabelText('Toggle demo') as HTMLInputElement).checked).toBe(true);
    await waitFor(() => {
      const last = calls.filter((c) => c.url === '/api/projects/7/elements/3').at(-1)!;
      expect(JSON.parse(last.init!.body as string)).toMatchObject({ enabled: true });
    });
  });

  it('Ctrl+Z from the page undoes, but inside a text field it is left to the browser', async () => {
    mockApi();
    render(<Editor projectId={7} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByLabelText('Headline')).toBeTruthy());
    const input = screen.getByLabelText('Headline') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'VOTE' } });
    await waitFor(() => expect(playerHeadline()).toBe('VOTE'));

    fireEvent.keyDown(input, { key: 'z', ctrlKey: true });
    expect(input.value).toBe('VOTE');

    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true });
    await waitFor(() => expect((screen.getByLabelText('Headline') as HTMLInputElement).value).toBe('HI'));
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true, shiftKey: true });
    await waitFor(() => expect((screen.getByLabelText('Headline') as HTMLInputElement).value).toBe('VOTE'));
  });
});
