import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExportPanel } from './ExportPanel';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ExportPanel', () => {
  it('starts a render, shows progress while polling, then offers the download', async () => {
    const polls = [
      { id: 5, projectId: 1, status: 'queued', progress: 0, outputUrl: null, error: null },
      { id: 5, projectId: 1, status: 'rendering', progress: 0.5, outputUrl: null, error: null },
      { id: 5, projectId: 1, status: 'done', progress: 1, outputUrl: '/media/renders/project-1-5.mp4', error: null },
    ];
    let poll = 0;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === '/api/render' && init?.method === 'POST') return new Response(JSON.stringify({ id: 5, status: 'queued' }), { status: 202 });
      if (url === '/api/render/5') return new Response(JSON.stringify(polls[Math.min(poll++, polls.length - 1)]), { status: 200 });
      return new Response('not found', { status: 404 });
    });

    render(<ExportPanel projectId={1} pollIntervalMs={10} />);
    fireEvent.click(screen.getByRole('button', { name: /export mp4/i }));

    await waitFor(() => expect(screen.getByText(/rendering/i)).toBeTruthy());
    await waitFor(() => expect(screen.getByText('50%')).toBeTruthy());
    await waitFor(() => expect(screen.getByRole('link', { name: /download/i })).toBeTruthy());
    expect((screen.getByRole('link', { name: /download/i }) as HTMLAnchorElement).getAttribute('href')).toBe('/api/media/renders/project-1-5.mp4');

    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')!;
    expect(JSON.parse((post[1] as RequestInit).body as string)).toEqual({ projectId: 1 });
  });

  it('shows the error when a render fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === '/api/render' && init?.method === 'POST') return new Response(JSON.stringify({ id: 6, status: 'queued' }), { status: 202 });
      if (url === '/api/render/6') return new Response(JSON.stringify({ id: 6, projectId: 1, status: 'failed', progress: 0, outputUrl: null, error: 'Chrome exploded' }), { status: 200 });
      return new Response('not found', { status: 404 });
    });
    render(<ExportPanel projectId={1} pollIntervalMs={10} />);
    fireEvent.click(screen.getByRole('button', { name: /export mp4/i }));
    await waitFor(() => expect(screen.getByText(/Chrome exploded/)).toBeTruthy());
  });
});


describe('empty footage slots (M48)', () => {
  it('notes the scenes with no clip yet, as a note, without disabling Export', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('[]', { status: 200 }));
    render(<ExportPanel projectId={1} check={{ ok: true, seconds: 5, message: 'Disclaimer on screen for 5.0 s' }} emptySlots={['Headline', 'Vote end card']} />);
    const note = screen.getByTestId('empty-slots');
    expect(note.textContent).toBe('No clip yet in 2 scenes');
    expect(note.getAttribute('title')).toContain('Headline, Vote end card');
    expect((screen.getByRole('button', { name: /Export MP4/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('says the one scene by name, and nothing when every slot has a clip', () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('[]', { status: 200 }));
    const { unmount } = render(<ExportPanel projectId={1} emptySlots={['Headline']} />);
    expect(screen.getByTestId('empty-slots').textContent).toBe('No clip yet in Headline');
    unmount();
    render(<ExportPanel projectId={1} emptySlots={[]} />);
    expect(screen.queryByTestId('empty-slots')).toBeNull();
  });
});
