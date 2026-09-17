import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExportHistory } from './ExportHistory';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const renders = [
  { id: 9, projectId: 3, status: 'done', progress: 1, outputUrl: '/media/renders/project-3-9.mp4', error: null, createdAt: '2026-09-13 18:53:06', updatedAt: '2026-09-13 18:53:13' },
  { id: 8, projectId: 3, status: 'failed', progress: 0, outputUrl: null, error: 'Chrome exploded', createdAt: '2026-09-13 18:40:00', updatedAt: '2026-09-13 18:40:30' },
  { id: 7, projectId: 3, status: 'rendering', progress: 0.4, outputUrl: null, error: null, createdAt: '2026-09-13 18:30:00', updatedAt: '2026-09-13 18:30:10' },
];

describe('ExportHistory (M25)', () => {
  it('lists finished exports with a download link or the error, and reloads when asked', async () => {
    let served: unknown[] = renders;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (String(input) === '/api/renders?projectId=3') return new Response(JSON.stringify(served), { status: 200 });
      return new Response('not found', { status: 404 });
    });
    const { rerender } = render(<ExportHistory projectId={3} refreshKey={0} projectName="Jane for Senate: Bio" />);
    await waitFor(() => expect(screen.getByTestId('export-history')).toBeTruthy());
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2); // the one still rendering is not history
    expect(rows[0]!.textContent).toContain('2026-09-13 18:53');
    expect((screen.getByRole('link', { name: 'Download' }) as HTMLAnchorElement).getAttribute('href')).toBe('/api/media/renders/project-3-9.mp4');
    expect((screen.getByRole('link', { name: 'Download' }) as HTMLAnchorElement).getAttribute('download')).toBe('jane-for-senate-bio-16x9.mp4');
    expect(rows[1]!.textContent).toContain('Chrome exploded');

    served = [{ ...renders[0]!, id: 10, updatedAt: '2026-09-13 19:00:00', outputUrl: '/media/renders/project-3-10.mp4' }, ...renders];
    rerender(<ExportHistory projectId={3} refreshKey={1} />);
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(3));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('says so when there are none', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('[]', { status: 200 }));
    render(<ExportHistory projectId={3} />);
    await waitFor(() => expect(screen.getByText(/No exports yet/)).toBeTruthy());
  });
});
