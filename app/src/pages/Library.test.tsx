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

describe('Library', () => {
  it('renders ad type groups in order with template facts', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(groups), { status: 200 }));
    render(<Library onOpenProject={() => {}} />);

    await waitFor(() => expect(screen.getByText('Split Record')).toBeTruthy());
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['Contrast', 'GOTV']);
    // duration in timecode, dimensions in mono facts
    expect(screen.getByText('00:30:00')).toBeTruthy();
    expect(screen.getByText('00:05:00')).toBeTruthy();
    expect(screen.getAllByText('1920×1080')).toHaveLength(2);
  });

  it('clicking a template creates a project and opens it', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(groups), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 42 }), { status: 201 }));
    const onOpenProject = vi.fn();
    render(<Library onOpenProject={onOpenProject} />);

    await waitFor(() => expect(screen.getByText('Turnout Push')).toBeTruthy());
    screen.getByRole('button', { name: /Turnout Push/ }).click();

    await waitFor(() => expect(onOpenProject).toHaveBeenCalledWith(42));
    const [url, init] = fetchMock.mock.calls[1]!;
    expect(url).toBe('/api/projects');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ templateSlug: 'turnout' });
  });
});
