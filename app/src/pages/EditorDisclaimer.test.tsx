import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Editor } from './Editor';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** M35: the disclaimer line beside Export, red and blocking under four seconds, green above. */
const lottie = { fr: 30, ip: 0, op: 300, w: 1920, h: 1080, layers: [{ ty: 5, nm: 'cc.headline', t: { d: { k: [{ s: { t: 'X', f: 'X', s: 10 }, t: 0 }] } } }] };
const disclaimer = { key: 'disclaimer', role: 'safe.disclaimer', kind: 'text', label: 'Disclaimer', default: 'Paid for by Example Committee', path: '/layers/0', locked: true };

const detail = {
  project: { id: 7, name: 'Demo', templateId: 1, templateSlug: 'demo', templateName: 'Demo' },
  template: { id: 1, slug: 'demo', name: 'Demo', durationFrames: 300, fps: 30, width: 1920, height: 1080, thumbUrl: '' },
  elements: [
    { id: 3, slug: 'open', name: 'Open', type: 'open', templateSlug: 'demo', added: false, zIndex: 0, startFrame: 0, endFrame: 225, enabled: true, lottieUrl: '/templates/demo/elements/open/template.json', schema: [{ key: 'headline', role: 'headline', kind: 'text', label: 'Headline', default: 'HI', path: '/layers/0' }] },
    { id: 4, slug: 'end-card', name: 'End card', type: 'end-card', templateSlug: 'demo', added: false, zIndex: 0, startFrame: 225, endFrame: 300, enabled: true, lottieUrl: '/templates/demo/elements/end-card/template.json', schema: [disclaimer] },
  ],
  transitions: [],
  meta: { fonts: [], fontFiles: [] },
  values: [{ elementId: 4, key: 'disclaimer', value: 'Paid for by Example Committee' }],
};

function mockApi() {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    if (url === '/api/projects/7' && !init?.method) return new Response(JSON.stringify(detail), { status: 200 });
    if (url.endsWith('/template.json')) return new Response(JSON.stringify(lottie), { status: 200 });
    if (url === '/api/media') return new Response('[]', { status: 200 });
    if (url === '/api/themes') return new Response('[]', { status: 200 });
    if (init?.method === 'PUT') return new Response(init.body as string, { status: 200 });
    return new Response('not found', { status: 404 });
  });
}

describe('Editor disclaimer check (M35)', () => {
  it('blocks Export under four seconds with the reason, and frees it once the end card is long enough', async () => {
    mockApi();
    render(<Editor projectId={7} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('readiness')).toBeTruthy());
    const pill = screen.getByTestId('readiness');
    expect(pill.getAttribute('data-blocked')).toBe('true');
    fireEvent.click(pill);
    expect(screen.getByTestId('check-disclaimer').getAttribute('data-ok')).toBe('false');
    expect(screen.getByTestId('check-disclaimer').textContent).toMatch(/2\.5 s/);
    expect((screen.getByRole('button', { name: /export mp4/i }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByLabelText('Select End card'));
    await waitFor(() => expect(screen.getByLabelText('End card length')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('End card length'), { target: { value: '5' } });
    await waitFor(() => expect(screen.getByTestId('check-disclaimer').getAttribute('data-ok')).toBe('true'));
    expect(screen.getByTestId('check-disclaimer').textContent).toMatch(/5\.0 s/);
    expect(screen.getByTestId('readiness').getAttribute('data-blocked')).toBe('false');
    expect((screen.getByRole('button', { name: /export mp4/i }) as HTMLButtonElement).disabled).toBe(false);
  });
});
