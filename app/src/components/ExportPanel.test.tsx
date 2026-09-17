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


describe('ready to export (M49)', () => {
  const ok = (key: 'disclaimer' | 'footage' | 'logo' | 'words', message: string, blocking = false) => ({ key, ok: true, blocking, message, scenes: [] });
  const not = (key: 'disclaimer' | 'footage' | 'logo' | 'words', message: string, blocking = false) => ({ key, ok: false, blocking, message, scenes: [] });

  it('shows one pill; notes do not block Export; the list opens on press with every item', () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('[]', { status: 200 }));
    render(<ExportPanel projectId={1} readiness={{ ok: false, blocked: false, todo: 2, items: [ok('disclaimer', 'Disclaimer on screen 5.0 s', true), not('footage', 'No clip yet in Headline'), not('words', "Still the designer's words in Open")] }} />);
    const pill = screen.getByTestId('readiness');
    expect(pill.textContent).toBe('2 to check');
    expect(pill.getAttribute('data-blocked')).toBe('false');
    expect((screen.getByRole('button', { name: /Export MP4/ }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole('region', { name: 'Ready to export?' })).toBeNull();
    fireEvent.click(pill);
    const list = screen.getByRole('region', { name: 'Ready to export?' });
    expect(list.querySelectorAll('li')).toHaveLength(3);
    expect(screen.getByTestId('check-footage').getAttribute('data-ok')).toBe('false');
    expect(screen.getByTestId('check-disclaimer').textContent).toContain('5.0 s');
    fireEvent.click(pill);
    expect(screen.queryByRole('region', { name: 'Ready to export?' })).toBeNull();
    // Escape and a press outside close it too
    fireEvent.click(pill);
    expect(screen.getByRole('region', { name: 'Ready to export?' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('region', { name: 'Ready to export?' })).toBeNull();
    fireEvent.click(pill);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('region', { name: 'Ready to export?' })).toBeNull();
  });

  it('a blocking item reddens the pill and disables Export with its reason; all ok reads "Ready to export"', () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('[]', { status: 200 }));
    const { unmount } = render(<ExportPanel projectId={1} readiness={{ ok: false, blocked: true, todo: 1, items: [not('disclaimer', 'Disclaimer on screen for 2.0 s; it must be at least 4.0 s.', true)] }} />);
    expect(screen.getByTestId('readiness').getAttribute('data-blocked')).toBe('true');
    const button = screen.getByRole('button', { name: /Export MP4/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('title')).toMatch(/4\.0 s/);
    unmount();
    render(<ExportPanel projectId={1} readiness={{ ok: true, blocked: false, todo: 0, items: [ok('disclaimer', 'Disclaimer on screen 5.0 s', true)] }} />);
    expect(screen.getByTestId('readiness').textContent).toBe('Ready to export');
    expect(screen.getByTestId('readiness').getAttribute('data-ok')).toBe('true');
  });
});


/** M50: every version in one go. The menu beside Export queues one render per version and follows them all. */
describe('export every version (M50)', () => {
  it('"All four versions" posts the four aspects, shows the batch progress, then says they are in Exports', async () => {
    const jobs = (status: string, progress: number) => [1, 2, 3, 4].map((id, i) => ({ id, projectId: 1, status, progress, outputUrl: status === 'done' ? `/media/renders/project-1-${id}.mp4` : null, error: null, aspect: ['16:9', '1:1', '4:5', '9:16'][i] }));
    let polls = 0;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === '/api/render' && init?.method === 'POST') return new Response(JSON.stringify({ ...jobs('queued', 0)[0], jobs: jobs('queued', 0) }), { status: 202 });
      const m = url.match(/\/api\/render\/(\d+)$/);
      if (m) {
        polls += 1;
        const round = polls <= 4 ? jobs('rendering', 0.5) : jobs('done', 1);
        return new Response(JSON.stringify(round[Number(m[1]) - 1]), { status: 200 });
      }
      return new Response('not found', { status: 404 });
    });
    const onFinished = vi.fn();
    render(<ExportPanel projectId={1} pollIntervalMs={10} aspect="16:9" onFinished={onFinished} />);
    fireEvent.click(screen.getByRole('button', { name: 'Export options' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /All four versions/ }));
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')!;
    expect(JSON.parse((post[1] as RequestInit).body as string)).toEqual({ projectId: 1, aspects: ['16:9', '1:1', '4:5', '9:16'] });
    await waitFor(() => expect(screen.getByTestId('batch-progress').textContent).toMatch(/Exporting 1 of 4/));
    await waitFor(() => expect(screen.getByTestId('batch-done').textContent).toBe('4 versions exported · in Exports below'), { timeout: 3000 });
    expect(onFinished).toHaveBeenCalled();
  });

  it('"This version" posts only the project, as the main button does', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (String(input) === '/api/render' && init?.method === 'POST') return new Response(JSON.stringify({ id: 9, projectId: 1, status: 'done', progress: 1, outputUrl: '/media/renders/project-1-9.mp4', error: null, aspect: '9:16' }), { status: 202 });
      return new Response('not found', { status: 404 });
    });
    render(<ExportPanel projectId={1} aspect="9:16" />);
    fireEvent.click(screen.getByRole('button', { name: 'Export options' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'This version (9:16)' }));
    await waitFor(() => expect(screen.getByRole('link', { name: /download/i })).toBeTruthy());
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')!;
    expect(JSON.parse((post[1] as RequestInit).body as string)).toEqual({ projectId: 1 });
  });
});
