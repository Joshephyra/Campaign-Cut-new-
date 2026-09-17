import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Editor } from './Editor';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * M20: the editor hands the Player the project's music bed (as the preview
 * runner's /api URL, start in frames) and saves changes to it.
 */
const lottie = { fr: 30, ip: 0, op: 60, w: 1920, h: 1080, layers: [{ ty: 5, nm: 'cc.headline', t: { d: { k: [{ s: { t: 'HI', f: 'X', s: 10 }, t: 0 }] } } }] };

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
      schema: [{ key: 'headline', role: 'headline', kind: 'text', label: 'Headline', default: 'HI', path: '/layers/0' }],
    },
  ],
  transitions: [],
  meta: { fonts: [], fontFiles: [] },
  values: [{ elementId: 3, key: 'headline', value: 'HI' }],
  audio: { assetId: 9, volume: 0.4, inS: 1 },
};

const assets = [
  { id: 9, kind: 'audio', originalName: 'bed.wav', originalUrl: '/media/originals/bed.wav', proxyUrl: '/media/originals/bed.wav', thumbUrl: null, width: 0, height: 0, durationS: 2, fps: 0 },
];

function mockApi() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    if (url === '/api/projects/7' && !init?.method) return new Response(JSON.stringify(detail), { status: 200 });
    if (url === '/api/templates/demo/template.json') return new Response(JSON.stringify(lottie), { status: 200 });
    if (url === '/api/media') return new Response(JSON.stringify(assets), { status: 200 });
    if (url === '/api/projects/7/audio' && init?.method === 'PUT') return new Response(init.body as string, { status: 200 });
    return new Response('not found', { status: 404 });
  });
}

const playerAudio = () => (JSON.parse(screen.getByTestId('player').getAttribute('data-props')!) as { audio: unknown }).audio;

describe('Editor music bed', () => {
  it('hands the Player the saved music bed at the preview runner URL, start in frames', async () => {
    mockApi();
    render(<Editor projectId={7} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Use bed.wav' })).toBeTruthy());
    await waitFor(() => expect(playerAudio()).toEqual({ src: '/api/media/originals/bed.wav', volume: 0.4, startFrom: 30 }));
    expect(screen.getByRole('button', { name: 'Use bed.wav' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('changing the volume updates the Player and saves the music bed', async () => {
    const fetchMock = mockApi();
    render(<Editor projectId={7} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByLabelText('Music volume')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Music volume'), { target: { value: '70' } });
    await waitFor(() => expect(playerAudio()).toEqual({ src: '/api/media/originals/bed.wav', volume: 0.7, startFrom: 30 }));
    await waitFor(() => {
      const put = fetchMock.mock.calls.find(([u, init]) => String(u) === '/api/projects/7/audio' && init?.method === 'PUT');
      expect(put).toBeTruthy();
      expect(JSON.parse((put![1] as RequestInit).body as string)).toEqual({ assetId: 9, volume: 0.7, inS: 1 });
    });
  });
});
