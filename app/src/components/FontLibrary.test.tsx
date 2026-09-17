import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FontLibrary } from './FontLibrary';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** M59: the fonts on hand, listed when opened; an upload adds to the list. */
describe('FontLibrary', () => {
  it('fetches nothing until opened, then lists the uploaded faces and uploads new ones', async () => {
    const calls: { url: string; method?: string; body?: FormData }[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      calls.push({ url: String(input), method: init?.method, body: init?.body as FormData });
      if (init?.method === 'POST') return new Response(JSON.stringify([{ file: 'Knockout-Bold.otf', family: 'Knockout', style: 'Bold' }]), { status: 201 });
      return new Response(JSON.stringify([{ file: 'plexb.ttf', family: 'IBM Plex Sans', style: 'Bold' }]), { status: 200 });
    });
    render(<FontLibrary />);
    expect(calls).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: /Fonts on hand/ }));
    await waitFor(() => expect(screen.getByText('IBM Plex Sans · Bold')).toBeTruthy());
    expect(calls[0]!.url).toBe('/api/fonts');

    const file = new File(['otf'], 'Knockout-Bold.otf');
    fireEvent.change(screen.getByLabelText('Font files'), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText('Knockout · Bold')).toBeTruthy());
    expect(calls[1]!.url).toBe('/api/fonts');
    expect(calls[1]!.method).toBe('POST');
    expect(((calls[1]!.body as FormData).getAll('file') as File[]).map((f) => f.name)).toEqual(['Knockout-Bold.otf']);
    expect(screen.getByText('IBM Plex Sans · Bold')).toBeTruthy();
  });
});
