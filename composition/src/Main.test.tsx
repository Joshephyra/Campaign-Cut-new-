import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_LOTTIE } from './config';
import { Main } from './Main';

vi.mock('@remotion/lottie', () => ({ Lottie: () => <div data-testid="lottie-stub" /> }));
vi.mock('remotion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('remotion')>();
  return {
    ...actual,
    OffthreadVideo: (props: { src: string; style?: React.CSSProperties }) => (
      <video data-testid="video" src={props.src} style={props.style} />
    ),
    // Sequence needs a registered composition; timing is covered by elements.render.test.ts.
    Sequence: (props: { children?: React.ReactNode }) => <>{props.children}</>,
  };
});

afterEach(cleanup);

const rect = { x: 0.5, y: 0, w: 0.5, h: 1 };

// THE two-runners test: the same component, two props. Nothing inside
// Main may know which runner it is in.
describe('Main with footage', () => {
  it('renders the proxy when handed proxy props', () => {
    render(<Main background="#000" elements={[{ id: 'e', lottie: EMPTY_LOTTIE, startFrame: 0, endFrame: 1, zIndex: 0, enabled: true }]} media={{ src: '/media/proxies/1.mp4', rect, fit: 'cover' }} />);
    expect(screen.getByTestId('video').getAttribute('src')).toBe('/media/proxies/1.mp4');
  });

  it('renders the original when handed original props', () => {
    render(<Main background="#000" elements={[{ id: 'e', lottie: EMPTY_LOTTIE, startFrame: 0, endFrame: 1, zIndex: 0, enabled: true }]} media={{ src: 'http://127.0.0.1:3001/media/originals/1.mp4', rect, fit: 'cover' }} />);
    expect(screen.getByTestId('video').getAttribute('src')).toBe('http://127.0.0.1:3001/media/originals/1.mp4');
  });

  it('places the footage in the slot rectangle as fractions of the frame, under the Lottie', () => {
    render(<Main background="#000" elements={[{ id: 'e', lottie: EMPTY_LOTTIE, startFrame: 0, endFrame: 1, zIndex: 0, enabled: true }]} media={{ src: 'x.mp4', rect, fit: 'contain' }} />);
    const slot = screen.getByTestId('media-slot');
    expect(slot.style.left).toBe('50%');
    expect(slot.style.top).toBe('0%');
    expect(slot.style.width).toBe('50%');
    expect(slot.style.height).toBe('100%');
    expect(screen.getByTestId('video').style.objectFit).toBe('contain');
    // DOM order: footage first (below), Lottie wrapper after (above)
    const video = screen.getByTestId('video');
    const lottie = screen.getByTestId('lottie-wrapper');
    expect(video.compareDocumentPosition(lottie) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders no video when there is no footage', () => {
    render(<Main background="#000" elements={[{ id: 'e', lottie: EMPTY_LOTTIE, startFrame: 0, endFrame: 1, zIndex: 0, enabled: true }]} media={null} />);
    expect(screen.queryByTestId('video')).toBeNull();
  });
});
