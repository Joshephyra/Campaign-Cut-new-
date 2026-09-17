import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Editor } from './Editor';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * M36: the version chips in the top bar. Choosing 9:16 saves the aspect,
 * reloads the spot at its 9:16 files, hands the Player the new frame, and
 * says in the panel when a scene is auto-fitted from 16:9.
 */
const lottie = (w: number, h: number) => ({ fr: 30, ip: 0, op: 90, w, h, layers: [{ ty: 5, nm: 'cc.headline', t: { d: { k: [{ s: { t: 'X', f: 'X', s: 10 }, t: 0 }] } } }] });
const schema = [
  { key: 'headline', role: 'headline', kind: 'text', label: 'Headline', default: 'HI', path: '/layers/0' },
  { key: 'disclaimer', role: 'safe.disclaimer', kind: 'text', label: 'Disclaimer', default: 'Paid for by X', path: '/layers/0', locked: true },
];
const element = (id: number, slug: string, name: string, lottieUrl: string, variant: boolean) => ({ id, slug, name, type: 'open', templateSlug: 'demo', added: false, variant, zIndex: 0, startFrame: 0, endFrame: 150, enabled: true, lottieUrl, schema });

const wideDetail = {
  project: { id: 7, name: 'Demo', templateId: 1, templateSlug: 'demo', templateName: 'Demo', aspect: '16:9' },
  template: { id: 1, slug: 'demo', name: 'Demo', durationFrames: 150, fps: 30, width: 1920, height: 1080, thumbUrl: '' },
  frame: { width: 1920, height: 1080 },
  elements: [element(3, 'open', 'Open', '/templates/demo/elements/open/template.json', true), element(4, 'end-card', 'End card', '/templates/demo/elements/end-card/template.json', true)],
  transitions: [],
  meta: { fonts: [], fontFiles: [] },
  values: [],
};
const tallDetail = {
  ...wideDetail,
  project: { ...wideDetail.project, aspect: '9:16' },
  frame: { width: 1080, height: 1920 },
  elements: [element(3, 'open', 'Open', '/templates/demo/elements/open/variants/9x16/template.json', true), element(4, 'end-card', 'End card', '/templates/demo/elements/end-card/template.json', false)],
};

function mockApi() {
  let aspect = '16:9';
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    if (url === '/api/projects/7' && !init?.method) return new Response(JSON.stringify(aspect === '9:16' ? tallDetail : wideDetail), { status: 200 });
    if (url === '/api/projects/7' && init?.method === 'PATCH') {
      aspect = (JSON.parse(init.body as string) as { aspect: string }).aspect;
      return new Response(JSON.stringify({ ...wideDetail.project, aspect }), { status: 200 });
    }
    if (url.includes('/variants/9x16/')) return new Response(JSON.stringify(lottie(1080, 1920)), { status: 200 });
    if (url.endsWith('/template.json')) return new Response(JSON.stringify(lottie(1920, 1080)), { status: 200 });
    if (url === '/api/media') return new Response('[]', { status: 200 });
    if (url === '/api/themes') return new Response('[]', { status: 200 });
    return new Response('not found', { status: 404 });
  });
  return calls;
}

const playerProps = () => JSON.parse(screen.getByTestId('player').getAttribute('data-props')!) as { frame?: { width: number; height: number }; elements: { lottie: { w: number; h: number } }[] };

describe('Editor aspect versions (M36)', () => {
  it('offers the four versions, saves the chosen one, reloads at its files and hands the Player the frame', async () => {
    const calls = mockApi();
    render(<Editor projectId={7} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByLabelText('Version 16:9')).toBeTruthy());
    expect(screen.getByLabelText('Version 16:9').getAttribute('aria-pressed')).toBe('true');
    expect(['Version 16:9', 'Version 1:1', 'Version 4:5', 'Version 9:16'].every((l) => screen.getByLabelText(l))).toBe(true);
    expect(playerProps().frame).toEqual({ width: 1920, height: 1080 });

    fireEvent.click(screen.getByLabelText('Version 9:16'));
    await waitFor(() => expect(screen.getByLabelText('Version 9:16').getAttribute('aria-pressed')).toBe('true'));
    const patch = calls.find((c) => c.url === '/api/projects/7' && c.init?.method === 'PATCH')!;
    expect(JSON.parse(patch.init!.body as string)).toEqual({ aspect: '9:16' });
    await waitFor(() => expect(playerProps().frame).toEqual({ width: 1080, height: 1920 }));
    await waitFor(() => expect(playerProps().elements.map((e) => [e.lottie.w, e.lottie.h])).toEqual([[1080, 1920], [1920, 1080]]));

    fireEvent.click(screen.getByLabelText('Select End card'));
    await waitFor(() => expect(screen.getByTestId('autofit-note')).toBeTruthy());
    expect(screen.getByTestId('autofit-note').textContent).toMatch(/auto-fitted from 16:9/i);
    fireEvent.click(screen.getByLabelText('Select Open'));
    await waitFor(() => expect(screen.queryByTestId('autofit-note')).toBeNull());
  });
});
