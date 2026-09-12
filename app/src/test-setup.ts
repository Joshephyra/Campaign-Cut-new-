import { createElement, forwardRef } from 'react';
import { vi } from 'vitest';

// lottie-web touches a canvas at import time, which jsdom does not provide.
// App tests are about pages and controls, not Lottie rendering.
vi.mock('@remotion/lottie', () => ({
  Lottie: () => null,
}));

// The Player is stubbed to expose the inputProps it was handed, so tests can
// assert that typing reaches the composition without rendering video.
vi.mock('@remotion/player', () => ({
  Player: forwardRef<HTMLDivElement, { inputProps: unknown }>(function PlayerStub(props, ref) {
    return createElement('div', { ref, 'data-testid': 'player', 'data-props': JSON.stringify(props.inputProps) });
  }),
}));
