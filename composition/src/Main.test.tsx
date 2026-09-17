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

/**
 * M36: a spot in another ratio. An element whose Lottie was authored at
 * the frame's size draws full-frame; one authored at another size (a 16:9
 * element in a 9:16 spot with no designer variant) is auto-fitted:
 * contained and centred in a box, its footage slot mapped into the box,
 * except a slot that filled the 16:9 frame, which fills the new frame.
 */
describe('Main in another aspect ratio (M36)', () => {
  const wide = { ...EMPTY_LOTTIE, w: 1920, h: 1080 };
  const tall = { ...EMPTY_LOTTIE, w: 1080, h: 1920 };
  const frame = { width: 1080, height: 1920 };

  it('draws an element authored at the frame size full-frame, with no auto-fit box', () => {
    render(<Main background="#000" frame={frame} elements={[{ ...element('e', null), lottie: tall }]} />);
    expect(screen.queryByTestId('autofit')).toBeNull();
    expect(screen.getByTestId('lottie-wrapper').style.width).toBe('100%');
  });

  it('auto-fits a 16:9 element into a 9:16 frame: contained, centred, in pixels of the frame', () => {
    render(<Main background="#000" frame={frame} elements={[{ ...element('e', null), lottie: wide }]} />);
    const box = screen.getByTestId('autofit');
    expect(box.style.left).toBe('0px');
    expect(box.style.top).toBe('656.25px');
    expect(box.style.width).toBe('1080px');
    expect(box.style.height).toBe('607.5px');
    expect(box.contains(screen.getByTestId('lottie-wrapper'))).toBe(true);
  });

  it('maps a partial footage slot into the box, and lets a full-bleed slot fill the whole frame', () => {
    const partial = { src: 'x.mp4', rect: { x: 0.5, y: 0, w: 0.5, h: 1 }, fit: 'cover' as const };
    const { unmount } = render(<Main background="#000" frame={frame} elements={[{ ...element('e', partial), lottie: wide }]} />);
    let slot = screen.getByTestId('media-slot');
    expect(slot.style.left).toBe('540px');
    expect(slot.style.top).toBe('656.25px');
    expect(slot.style.width).toBe('540px');
    expect(slot.style.height).toBe('607.5px');
    unmount();

    const full = { src: 'x.mp4', rect: { x: 0, y: 0, w: 1, h: 1 }, fit: 'cover' as const };
    render(<Main background="#000" frame={frame} elements={[{ ...element('e', full), lottie: wide }]} />);
    slot = screen.getByTestId('media-slot');
    expect(slot.style.left).toBe('0%');
    expect(slot.style.top).toBe('0%');
    expect(slot.style.width).toBe('100%');
    expect(slot.style.height).toBe('100%');
  });

  it('without a frame prop the composition is 16:9 and a 16:9 element is not boxed', () => {
    render(<Main background="#000" elements={[{ ...element('e', null), lottie: wide }]} />);
    expect(screen.queryByTestId('autofit')).toBeNull();
  });
});

// M38: an element mounted before its font face is ready measures its text
// in the fallback font and keeps those widths. The elements therefore mount
// only once the faces have loaded. Found by the starter pack's Arial Narrow.
describe('Main holds the elements until the template fonts are ready (M38)', () => {
  const fonts = [{ family: 'Arial Narrow', style: 'Bold', url: 'http://x/templates/pack/fonts/ArialNarrow-Bold.ttf' }];

  it('mounts no element while a face is loading, and all of them once every face has loaded', async () => {
    let resolveLoad: (v: unknown) => void = () => {};
    const load = vi.fn(() => new Promise((r) => (resolveLoad = r)));
    Object.defineProperty(document, 'fonts', { configurable: true, value: { load, ready: Promise.resolve() } });
    try {
      render(<Main background="#000" fonts={fonts} elements={[element('a', null), element('b', null)]} />);
      expect(load).toHaveBeenCalledWith('normal 700 1em "Arial Narrow"');
      expect(screen.queryAllByTestId('lottie-stub')).toHaveLength(0);
      expect(document.querySelector('style[data-template-fonts]')?.textContent).toContain('Arial Narrow');
      resolveLoad(undefined);
      await screen.findAllByTestId('lottie-stub');
      expect(screen.getAllByTestId('lottie-stub')).toHaveLength(2);
    } finally {
      delete (document as { fonts?: unknown }).fonts;
    }
  });

  it('mounts the elements at once when the template has no fonts', () => {
    render(<Main background="#000" elements={[element('a', null)]} />);
    expect(screen.getAllByTestId('lottie-stub')).toHaveLength(1);
  });
});


/**
 * M39: style treatments over the whole spot. The composition draws them,
 * so preview and export agree: a filter on each design (never on the
 * footage), grain over the frame for grit, a plate filter on text for opaque.
 */
describe('Main style treatments (M39)', () => {
  it('draws the design as authored when there is no treatment', () => {
    render(<Main background="#000" elements={[element('e', null)]} />);
    expect(screen.getByTestId('lottie-wrapper').style.filter).toBe('');
    expect(screen.queryByTestId('grit')).toBeNull();
    expect(screen.queryByTestId('opaque-plate')).toBeNull();
  });

  it('grit: grain over the whole frame, above the elements, and more contrast on each design', () => {
    render(<Main background="#000" treatment={{ name: 'grit' }} elements={[element('e', null)]} />);
    expect(screen.getByTestId('lottie-wrapper').style.filter).toBe('contrast(1.12)');
    const grain = screen.getByTestId('grit');
    expect(grain.style.mixBlendMode).toBe('overlay');
    expect(grain.style.pointerEvents).toBe('none');
    // last child: over every element
    expect(grain.parentElement!.lastElementChild).toBe(grain);
  });

  it('glow: the design glows in the accent, the footage does not', () => {
    render(<Main background="#000" treatment={{ name: 'glow', accent: '#00FF00' }} elements={[element('e', { src: '/media/proxies/1.mp4', rect, fit: 'cover' })]} />);
    expect(screen.getByTestId('lottie-wrapper').style.filter).toContain('#00FF00');
    expect(screen.getByTestId('video').style.filter).toBe('');
  });

  it('opaque: one plate filter, addressed to every editable text layer but the disclaimer', () => {
    const { container } = render(<Main background="#000" treatment={{ name: 'opaque' }} elements={[element('e', null)]} />);
    expect(screen.getByTestId('opaque-plate').querySelector('filter#cc-opaque-plate feMorphology')).toBeTruthy();
    const css = [...container.querySelectorAll('style')].map((s) => s.textContent).join('');
    expect(css).toContain('[data-treatment="opaque"] .cc-text:not(.cc-key-disclaimer) { filter: url(#cc-opaque-plate)');
    expect(screen.getByTestId('lottie-wrapper').style.filter).toBe('');
  });
});
