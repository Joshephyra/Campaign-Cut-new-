import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StockPanel } from './StockPanel';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** M34: search a stock site from the library column and pull a clip into the footage. */
const result = { provider: 'pexels', id: '3571264', title: 'A crowd at a rally', thumbUrl: 'https://images.pexels.com/videos/3571264/free-video-3571264.jpg', durationS: 12, width: 3840, height: 2160, credit: 'Ana Photographer on Pexels', pageUrl: 'https://www.pexels.com/video/a-crowd-at-a-rally-3571264/' };
const asset = { id: 5, kind: 'video', originalName: 'A crowd at a rally (Ana Photographer on Pexels).mp4', originalUrl: '/media/originals/5.mp4', proxyUrl: '/media/proxies/5.mp4', thumbUrl: '/media/thumbs/5.jpg', width: 1280, height: 720, durationS: 12, fps: 25 };

describe('StockPanel', () => {
  it('searches on Enter, lists results with credit and length, and imports one into the footage', async () => {
    const calls: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      if (url === '/api/stock/search?q=rally%20crowd') return new Response(JSON.stringify({ results: [result] }), { status: 200 });
      if (url === '/api/stock/import' && init?.method === 'POST') return new Response(JSON.stringify(asset), { status: 201 });
      return new Response('not found', { status: 404 });
    });
    const onImported = vi.fn();
    render(<StockPanel onImported={onImported} />);
    const search = screen.getByLabelText('Search stock footage');
    fireEvent.change(search, { target: { value: 'rally crowd' } });
    fireEvent.keyDown(search, { key: 'Enter' });
    const card = await screen.findByTestId('stock-result-3571264');
    expect(card.textContent).toContain('A crowd at a rally');
    expect(card.textContent).toContain('Ana Photographer on Pexels');
    expect(card.textContent).toContain('12.0 s');
    expect(card.querySelector('img')!.getAttribute('src')).toBe(result.thumbUrl);

    fireEvent.click(screen.getByRole('button', { name: 'Add A crowd at a rally to footage' }));
    await waitFor(() => expect(onImported).toHaveBeenCalledWith(asset));
    expect(calls).toContain('POST /api/stock/import');
    await waitFor(() => expect(card.textContent).toContain('In footage'));
  });

  it('shows the server\'s message when no key is set, and says when nothing matched', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('q=nothing')) return new Response(JSON.stringify({ results: [] }), { status: 200 });
      return new Response(JSON.stringify({ error: 'Stock footage is off: set PEXELS_API_KEY in .env and restart the server' }), { status: 503 });
    });
    render(<StockPanel onImported={vi.fn()} />);
    const search = screen.getByLabelText('Search stock footage');
    fireEvent.change(search, { target: { value: 'rally' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(screen.getByText(/PEXELS_API_KEY/)).toBeTruthy());
    fireEvent.change(search, { target: { value: 'nothing' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(screen.getByText(/nothing matched/i)).toBeTruthy());
  });
});


/** M54: the outlets are there to choose; only Pexels searches for real until the other keys arrive. */
describe('stock outlets (M54)', () => {
  it('lists the five outlets, remembers the choice, and says an unconnected one is not connected instead of searching', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('[]', { status: 200 }));
    const { unmount } = render(<StockPanel onImported={() => {}} />);
    const group = screen.getByRole('group', { name: 'Stock outlet' });
    expect(Array.from(group.querySelectorAll('button')).map((b) => b.textContent?.replace(' · soon', ''))).toEqual(['Pexels', 'Shutterstock', 'Filmpac', 'Filmsupply', 'Envato']);
    expect(screen.getByRole('button', { name: 'Pexels' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /Shutterstock/ }));
    expect(screen.getByTestId('stock-licence').textContent).toContain('Not connected yet');
    fireEvent.change(screen.getByLabelText('Search stock footage'), { target: { value: 'rally' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(screen.getByText(/Shutterstock is not connected yet/)).toBeTruthy());
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes('/stock/search'))).toBe(false);
    unmount();
    render(<StockPanel onImported={() => {}} />);
    expect(screen.getByRole('button', { name: /Shutterstock/ }).getAttribute('aria-pressed')).toBe('true'); // remembered
    try {
      window.localStorage.removeItem('cc.stock.outlet');
    } catch {
      /* no storage */
    }
  });
});
