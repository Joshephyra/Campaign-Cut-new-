import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MediaPanel } from './MediaPanel';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const assets = [
  {
    id: 1,
    kind: 'video' as const,
    originalName: 'rally.mp4',
    originalUrl: '/media/originals/1-rally.mp4',
    proxyUrl: '/media/proxies/1.mp4',
    thumbUrl: '/media/thumbs/1.jpg',
    width: 1920,
    height: 1080,
    durationS: 12.5,
    fps: 29.97,
  },
];

describe('MediaPanel', () => {
  it('lists uploaded clips with thumbnail, duration and dimensions', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(assets), { status: 200 }));
    const { container } = render(<MediaPanel />);
    await waitFor(() => expect(screen.getByText('rally.mp4')).toBeTruthy());
    expect(screen.getByText('00:12:15')).toBeTruthy(); // 12.5 s at 29.97 fps -> 12 s and 15 frames
    expect(screen.getByText('1920×1080')).toBeTruthy();
    expect(container.querySelector('img')!.getAttribute('src')).toBe('/api/media/thumbs/1.jpg');
  });

  it('uploads a chosen file as multipart and refreshes the list', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(assets[0]), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(assets), { status: 200 }));
    render(<MediaPanel />);
    await waitFor(() => expect(screen.getByText(/no footage yet/i)).toBeTruthy());

    const file = new File([new Uint8Array([0, 1, 2])], 'rally.mp4', { type: 'video/mp4' });
    fireEvent.change(screen.getByTestId('media-file-input'), { target: { files: [file] } });

    await waitFor(() => expect(screen.getByText('rally.mp4')).toBeTruthy());
    const [url, init] = fetchMock.mock.calls[1]!;
    expect(url).toBe('/api/media');
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).body).toBeInstanceOf(FormData);
  });
});
