import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Library } from './Library';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * M33: in the library, an agency picks which client a new spot is for.
 * The chosen client rides on the create call, and project rows name their
 * client.
 */
const groups = [{ adType: 'Contrast', sort: 1, templates: [{ id: 1, slug: 'three', name: 'Three Part', durationFrames: 240, fps: 30, width: 1920, height: 1080, thumbUrl: '/templates/three/thumb.png' }] }];
const clients = [
  { id: 1, name: 'Rivera for Senate', logoUrl: '', colors: { accent: '#1D4ED8' }, disclaimer: 'Paid for by Rivera for Senate', createdAt: '2026-09-17 10:00:00' },
  { id: 2, name: 'Ahmed for Mayor', logoUrl: '', colors: {}, disclaimer: '', createdAt: '2026-09-17 11:00:00' },
];
const projects = [{ id: 8, templateId: 1, templateSlug: 'three', templateName: 'Three Part', name: 'Tuesday spot', clientId: 1, clientName: 'Rivera for Senate', createdAt: '2026-09-13 10:00:00', updatedAt: '2026-09-13 12:30:00' }];

function mockApi() {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    calls.push({ url, init: init ?? undefined });
    if (url === '/api/templates') return new Response(JSON.stringify(groups), { status: 200 });
    if (url === '/api/projects' && !init?.method) return new Response(JSON.stringify(projects), { status: 200 });
    if (url === '/api/clients' && !init?.method) return new Response(JSON.stringify(clients), { status: 200 });
    if (url === '/api/projects' && init?.method === 'POST') return new Response(JSON.stringify({ id: 42 }), { status: 201 });
    return new Response('not found', { status: 404 });
  });
  return calls;
}

describe('Library clients (M33)', () => {
  it('offers the clients as chips; the chosen one rides on the new spot; project rows name their client', async () => {
    const calls = mockApi();
    const onOpenProject = vi.fn();
    render(<Library onOpenProject={onOpenProject} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'New spots for Rivera for Senate' })).toBeTruthy());
    expect(screen.getByRole('button', { name: 'New spots for no client' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('project-row-8').textContent).toContain('Rivera for Senate');

    fireEvent.click(screen.getByRole('button', { name: 'New spots for Ahmed for Mayor' }));
    expect(screen.getByRole('button', { name: 'New spots for Ahmed for Mayor' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /Three Part/ }));
    await waitFor(() => expect(onOpenProject).toHaveBeenCalledWith(42));
    const post = calls.find((c) => c.url === '/api/projects' && c.init?.method === 'POST')!;
    expect(JSON.parse(post.init!.body as string)).toEqual({ templateSlug: 'three', clientId: 2 });
  });

  it('with no clients, creates a spot with no client and shows no chips', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === '/api/templates') return new Response(JSON.stringify(groups), { status: 200 });
      if (url === '/api/projects' && !init?.method) return new Response('[]', { status: 200 });
      if (url === '/api/clients') return new Response('[]', { status: 200 });
      if (url === '/api/projects' && init?.method === 'POST') {
        expect(JSON.parse(init.body as string)).toEqual({ templateSlug: 'three' });
        return new Response(JSON.stringify({ id: 43 }), { status: 201 });
      }
      return new Response('not found', { status: 404 });
    });
    const onOpenProject = vi.fn();
    render(<Library onOpenProject={onOpenProject} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /Three Part/ })).toBeTruthy());
    expect(screen.queryByRole('button', { name: /New spots for/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Three Part/ }));
    await waitFor(() => expect(onOpenProject).toHaveBeenCalledWith(43));
  });
});
