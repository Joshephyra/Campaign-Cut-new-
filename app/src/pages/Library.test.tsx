import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Library } from './Library';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const groups = [
  {
    adType: 'Contrast',
    sort: 1,
    templates: [
      { id: 1, slug: 'split', name: 'Split Record', durationFrames: 900, fps: 30, width: 1920, height: 1080, thumbUrl: '/templates/split/thumb.png' },
    ],
  },
  {
    adType: 'GOTV',
    sort: 4,
    templates: [
      { id: 2, slug: 'turnout', name: 'Turnout Push', durationFrames: 150, fps: 30, width: 1920, height: 1080, thumbUrl: '/templates/turnout/thumb.png' },
    ],
  },
];

/** Route by URL: the library loads templates and (since M22) projects. */
function mockApi(projects: unknown[] = []) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    if (url === '/api/templates') return new Response(JSON.stringify(groups), { status: 200 });
    if (url === '/api/projects' && !init?.method) return new Response(JSON.stringify(projects), { status: 200 });
    if (url === '/api/projects' && init?.method === 'POST') return new Response(JSON.stringify({ id: 42 }), { status: 201 });
    return new Response('not found', { status: 404 });
  });
}

describe('Library', () => {
  it('renders ad type groups in order with template facts', async () => {
    mockApi();
    render(<Library onOpenProject={() => {}} />);

    await waitFor(() => expect(screen.getByText('Split Record')).toBeTruthy());
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['Contrast', 'GOTV', 'From nothing', 'Clients']); // M41 adds the blank spot after the templates, M33 the clients section
    // duration in timecode, dimensions in mono facts
    expect(screen.getByText('00:30:00')).toBeTruthy();
    expect(screen.getByText('00:05:00')).toBeTruthy();
    expect(screen.getAllByText('1920×1080')).toHaveLength(2);
  });

  it('clicking a template creates a project and opens it', async () => {
    const fetchMock = mockApi();
    const onOpenProject = vi.fn();
    render(<Library onOpenProject={onOpenProject} />);

    await waitFor(() => expect(screen.getByText('Turnout Push')).toBeTruthy());
    screen.getByRole('button', { name: /Turnout Push/ }).click();

    await waitFor(() => expect(onOpenProject).toHaveBeenCalledWith(42));
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')!;
    expect(String(post[0])).toBe('/api/projects');
    expect(JSON.parse((post[1] as RequestInit).body as string)).toEqual({ templateSlug: 'turnout' });
  });
});


/** M41: a spot from nothing, on the blank template, for the chosen client. */
describe('Library: start from nothing (M41)', () => {
  it('creates a spot on the blank template and opens it', async () => {
    const fetchMock = mockApi();
    const onOpenProject = vi.fn();
    render(<Library onOpenProject={onOpenProject} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start a spot from nothing' })).toBeTruthy());
    screen.getByRole('button', { name: 'Start a spot from nothing' }).click();
    await waitFor(() => expect(onOpenProject).toHaveBeenCalledWith(42));
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')!;
    expect(JSON.parse((post[1] as RequestInit).body as string)).toEqual({ templateSlug: 'blank' });
  });
});
