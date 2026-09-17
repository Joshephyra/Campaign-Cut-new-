import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_LOTTIE } from './config';
import type { ElementProps } from './elements';
import { Main } from './Main';

vi.mock('@remotion/lottie', () => ({ Lottie: () => <div data-testid="lottie-stub" /> }));
vi.mock('remotion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('remotion')>();
  return {
    ...actual,
    OffthreadVideo: (props: { src: string; style?: React.CSSProperties; startFrom?: number; endAt?: number; muted?: boolean }) => (
      <video data-testid="video" src={props.src} style={props.style} data-start-from={props.startFrom} data-end-at={props.endAt} data-muted={props.muted} />
    ),
    Audio: (props: { src: string; volume?: number; startFrom?: number }) => (
      <audio data-testid="audio" src={props.src} data-volume={props.volume} data-start-from={props.startFrom} />
    ),
    // Sequence needs a registered composition; timing is covered by elements.render.test.ts.
    Sequence: (props: { children?: React.ReactNode }) => <>{props.children}</>,
  };
});

afterEach(cleanup);

const rect = { x: 0.5, y: 0, w: 0.5, h: 1 };

const element = (id: string, media: ElementProps['media']): ElementProps => ({ id, lottie: EMPTY_LOTTIE, startFrame: 0, endFrame: 1, zIndex: 0, enabled: true, media });

// THE two-runners test: the same component, two props. Nothing inside
// Main may know which runner it is in. Since M21 footage belongs to an element.
describe('Main with footage', () => {
  it('renders the proxy when handed proxy props', () => {
    render(<Main background="#000" elements={[element('e', { src: '/media/proxies/1.mp4', rect, fit: 'cover' })]} />);
    expect(screen.getByTestId('video').getAttribute('src')).toBe('/media/proxies/1.mp4');
  });

  it('renders the original when handed original props', () => {
    render(<Main background="#000" elements={[element('e', { src: 'http://127.0.0.1:3001/media/originals/1.mp4', rect, fit: 'cover' })]} />);
    expect(screen.getByTestId('video').getAttribute('src')).toBe('http://127.0.0.1:3001/media/originals/1.mp4');
  });

  it('places the footage in the slot rectangle as fractions of the frame, under the element\'s Lottie', () => {
    render(<Main background="#000" elements={[element('e', { src: 'x.mp4', rect, fit: 'contain' })]} />);
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

  it('renders no video for an element without footage', () => {
    render(<Main background="#000" elements={[element('e', null)]} />);
    expect(screen.queryByTestId('video')).toBeNull();
  });

  it('renders one video per element that has footage, each in its own slot (M21)', () => {
    render(
      <Main
        background="#000"
        elements={[
          element('open', { src: 'open.mp4', rect: { x: 0, y: 0, w: 0.5, h: 1 }, fit: 'cover' }),
          element('mid', null),
          element('end', { src: 'end.mp4', rect: { x: 0.5, y: 0, w: 0.5, h: 1 }, fit: 'contain' }),
        ]}
      />,
    );
    const videos = screen.getAllByTestId('video');
    expect(videos.map((v) => v.getAttribute('src'))).toEqual(['open.mp4', 'end.mp4']);
    const slots = screen.getAllByTestId('media-slot');
    expect(slots.map((s) => s.style.left)).toEqual(['0%', '50%']);
    expect(screen.getAllByTestId('lottie-wrapper')).toHaveLength(3);
  });
});

describe('Main footage trim and audio (M20)', () => {
  it('hands the video its start, end and mute', () => {
    render(<Main background="#000" elements={[element('e', { src: 'x.mp4', rect, fit: 'cover', startFrom: 45, endAt: 120, muted: true })]} />);
    const video = screen.getByTestId('video');
    expect(video.getAttribute('data-start-from')).toBe('45');
    expect(video.getAttribute('data-end-at')).toBe('120');
    expect(video.getAttribute('data-muted')).toBe('true');
  });
  it('renders the music bed with its source, volume and start, and nothing without one', () => {
    render(<Main background="#000" elements={[element('e', null)]} audio={{ src: 'http://x/media/originals/bed.mp3', volume: 0.4, startFrom: 30 }} />);
    const audio = screen.getByTestId('audio');
    expect(audio.getAttribute('src')).toBe('http://x/media/originals/bed.mp3');
    expect(audio.getAttribute('data-volume')).toBe('0.4');
    expect(audio.getAttribute('data-start-from')).toBe('30');
    cleanup();
    render(<Main background="#000" elements={[element('e', null)]} audio={null} />);
    expect(screen.queryByTestId('audio')).toBeNull();
  });
});

/** M28: each element's Lottie wrapper names its element so the editor can map a layer on screen back to it. */
describe('Main names each element wrapper (M28)', () => {
  it('sets data-cc-element to the element id', () => {
    render(<Main background="#000" elements={[element('e', null)]} />);
    expect(screen.getByTestId('lottie-wrapper').getAttribute('data-cc-element')).toBe('e');
  });
});
