import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Library } from './Library';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** M22: the library lists projects so a spot can be found again, renamed, copied and deleted. */
const groups = [{ adType: 'Contrast', sort: 1, templates: [{ id: 1, slug: 'three', name: 'Three Part', durationFrames: 240, fps: 30, width: 1920, height: 1080, thumbUrl: '/templates/three/thumb.png' }] }];

const projects = [
  { id: 8, templateId: 1, templateSlug: 'three', templateName: 'Three Part', name: 'Tuesday spot', createdAt: '2026-09-13 10:00:00', updatedAt: '2026-09-13 12:30:00' },
  { id: 3, templateId: 1, templateSlug: 'three', templateName: 'Three Part', name: 'Three Part project', createdAt: '2026-09-12 09:00:00', updatedAt: '2026-09-12 09:05:00' },
];

function mockApi() {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    calls.push({ url, init: init ?? undefined });
    if (url === '/api/templates') return new Response(JSON.stringify(groups), { status: 200 });
    if (url === '/api/projects' && !init?.method) return new Response(JSON.stringify(projects), { status: 200 });
    if (url === '/api/projects/8' && init?.method === 'PATCH') return new Response(JSON.stringify({ ...projects[0], name: 'Wednesday spot' }), { status: 200 });
    if (url === '/api/projects/8/duplicate' && init?.method === 'POST') return new Response(JSON.stringify({ id: 9 }), { status: 201 });
    if (url === '/api/projects/3' && init?.method === 'DELETE') return new Response(null, { status: 204 });
    return new Response('not found', { status: 404 });
  });
  return calls;
}

describe('Library projects', () => {
  it('lists projects newest first with template and last change, and opens one', async () => {
    mockApi();
    const onOpenProject = vi.fn();
    render(<Library onOpenProject={onOpenProject} />);
    await waitFor(() => expect(screen.getByText('Tuesday spot')).toBeTruthy());
    const rows = screen.getAllByTestId(/^project-row-/);
    expect(rows.map((r) => r.getAttribute('data-testid'))).toEqual(['project-row-8', 'project-row-3']);
    expect(rows[0]!.textContent).toContain('Three Part');
    expect(rows[0]!.textContent).toContain('2026-09-13 12:30');
    fireEvent.click(screen.getByLabelText('Open Tuesday spot'));
    expect(onOpenProject).toHaveBeenCalledWith(8);
  });

  it('renames a project in place', async () => {
    const calls = mockApi();
    render(<Library onOpenProject={() => {}} />);
    await waitFor(() => expect(screen.getByText('Tuesday spot')).toBeTruthy());
    fireEvent.click(screen.getByLabelText('Rename Tuesday spot'));
    const input = screen.getByLabelText('New name for Tuesday spot') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Wednesday spot' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(screen.getByText('Wednesday spot')).toBeTruthy());
    const patch = calls.find((c) => c.init?.method === 'PATCH')!;
    expect(patch.url).toBe('/api/projects/8');
    expect(JSON.parse(patch.init!.body as string)).toEqual({ name: 'Wednesday spot' });
  });

  it('duplicates a project and opens the copy', async () => {
    mockApi();
    const onOpenProject = vi.fn();
    render(<Library onOpenProject={onOpenProject} />);
    await waitFor(() => expect(screen.getByText('Tuesday spot')).toBeTruthy());
    fireEvent.click(screen.getByLabelText('Duplicate Tuesday spot'));
    await waitFor(() => expect(onOpenProject).toHaveBeenCalledWith(9));
  });

  it('deletes only after a second, confirming click', async () => {
    const calls = mockApi();
    render(<Library onOpenProject={() => {}} />);
    await waitFor(() => expect(screen.getByText('Three Part project')).toBeTruthy());
    fireEvent.click(screen.getByLabelText('Delete Three Part project'));
    expect(calls.some((c) => c.init?.method === 'DELETE')).toBe(false);
    fireEvent.click(screen.getByLabelText('Confirm delete Three Part project'));
    await waitFor(() => expect(calls.some((c) => c.init?.method === 'DELETE' && c.url === '/api/projects/3')).toBe(true));
    await waitFor(() => expect(screen.queryByText('Three Part project')).toBeNull());
    expect(screen.getByText('Tuesday spot')).toBeTruthy();
  });
});
