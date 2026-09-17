import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Editor } from './Editor';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** M27: the template's comp background colour reaches the preview runner, same as the export runner. */
const lottie = { fr: 30, ip: 0, op: 60, w: 1920, h: 1080, layers: [] };
const detailFor = (meta: Record<string, unknown>) => ({
  project: { id: 7, name: 'Demo project', templateId: 1, templateSlug: 'demo', templateName: 'Demo' },
  template: { id: 1, slug: 'demo', name: 'Demo', durationFrames: 60, fps: 30, width: 1920, height: 1080, thumbUrl: '' },
  elements: [{ id: 3, slug: 'demo', name: 'Demo', zIndex: 0, startFrame: 0, endFrame: 60, enabled: true, lottieUrl: '/templates/demo/template.json', schema: [] }],
  transitions: [],
  meta,
  audio: null,
  values: [],
});

function mockApi(meta: Record<string, unknown>) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    if (url === '/api/projects/7' && !init?.method) return new Response(JSON.stringify(detailFor(meta)), { status: 200 });
    if (url === '/api/templates/demo/template.json') return new Response(JSON.stringify(lottie), { status: 200 });
    if (url === '/api/media') return new Response('[]', { status: 200 });
    return new Response('not found', { status: 404 });
  });
}

const playerBackground = () => (JSON.parse(screen.getByTestId('player').getAttribute('data-props')!) as { background: string }).background;

describe('Editor template background', () => {
  it('hands the Player the meta background, or black when the template has none', async () => {
    mockApi({ fonts: [], fontFiles: [], background: '#0F1729' });
    render(<Editor projectId={7} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('player')).toBeTruthy());
    expect(playerBackground()).toBe('#0F1729');
    cleanup();
    vi.restoreAllMocks();

    mockApi({ fonts: [], fontFiles: [] });
    render(<Editor projectId={7} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('player')).toBeTruthy());
    expect(playerBackground()).toBe('#000000');
  });
});
