import { createElement, forwardRef, useImperativeHandle, useRef } from 'react';
import { vi } from 'vitest';

// lottie-web touches a canvas at import time, which jsdom does not provide.
// App tests are about pages and controls, not Lottie rendering.
vi.mock('@remotion/lottie', () => ({
  Lottie: () => null,
}));

// The Player is stubbed to expose the inputProps it was handed, so tests can
// assert that typing reaches the composition without rendering video. Its
// ref answers the PlayerRef calls the editor makes: a seek lands in
// data-seek, play/pause in data-playing (with the matching events), mute in
// data-muted, and frame listeners attach to the div.
vi.mock('@remotion/player', () => ({
  Player: forwardRef<unknown, { inputProps: unknown }>(function PlayerStub(props, ref) {
    const div = useRef<HTMLDivElement>(null);
    const setPlaying = (on: boolean) => {
      div.current?.setAttribute('data-playing', String(on));
      div.current?.dispatchEvent(new Event(on ? 'play' : 'pause'));
    };
    useImperativeHandle(ref, () => ({
      seekTo: (frame: number) => div.current?.setAttribute('data-seek', String(frame)),
      pause: () => setPlaying(false),
      play: () => setPlaying(true),
      toggle: () => setPlaying(div.current?.getAttribute('data-playing') !== 'true'),
      isPlaying: () => div.current?.getAttribute('data-playing') === 'true',
      mute: () => div.current?.setAttribute('data-muted', 'true'),
      unmute: () => div.current?.setAttribute('data-muted', 'false'),
      isMuted: () => div.current?.getAttribute('data-muted') === 'true',
      requestFullscreen: () => div.current?.setAttribute('data-fullscreen', 'true'),
      getCurrentFrame: () => Number(div.current?.getAttribute('data-seek') ?? 0),
      addEventListener: (...args: [string, EventListener]) => div.current?.addEventListener(...args),
      removeEventListener: (...args: [string, EventListener]) => div.current?.removeEventListener(...args),
    }));
    return createElement('div', { ref: div, 'data-testid': 'player', 'data-props': JSON.stringify(props.inputProps) });
  }),
}));
