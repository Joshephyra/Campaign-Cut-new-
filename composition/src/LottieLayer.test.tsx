import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LottieLayer } from './LottieLayer';

// The Lottie renderer itself is stubbed: this test is about the wrapper.
vi.mock('@remotion/lottie', () => ({
  Lottie: () => <div data-testid="lottie-stub" />,
}));

afterEach(cleanup);

const tinyLottie = { v: '5.12.2', fr: 30, ip: 0, op: 30, w: 1920, h: 1080, nm: 'tiny', ddd: 0, assets: [], layers: [] };

// REGRESSION GUARD for the positioning bug (CLAUDE.md): ingested designs
// rendered BELOW the video frame instead of overlaying it. The fix is a
// full-frame absolutely positioned wrapper around the Lottie layer.
describe('LottieLayer wrapper (positioning-bug guard)', () => {
  it('is absolutely positioned at the origin', () => {
    render(<LottieLayer animationData={tinyLottie} />);
    const wrapper = screen.getByTestId('lottie-wrapper');
    expect(wrapper.style.position).toBe('absolute');
    expect(wrapper.style.top).toBe('0px');
    expect(wrapper.style.left).toBe('0px');
  });

  it('fills the full composition width and height', () => {
    render(<LottieLayer animationData={tinyLottie} />);
    const wrapper = screen.getByTestId('lottie-wrapper');
    expect(wrapper.style.width).toBe('100%');
    expect(wrapper.style.height).toBe('100%');
  });

  it('mounts the Lottie renderer inside the wrapper', () => {
    render(<LottieLayer animationData={tinyLottie} />);
    const wrapper = screen.getByTestId('lottie-wrapper');
    expect(wrapper.contains(screen.getByTestId('lottie-stub'))).toBe(true);
  });
});

/** M28: the wrapper names its element so the editor can map a layer on screen back to its element. */
describe('LottieLayer element id (M28)', () => {
  it('carries data-cc-element when given an element id, and nothing otherwise', () => {
    render(<LottieLayer animationData={tinyLottie} elementId="e7" />);
    expect(screen.getByTestId('lottie-wrapper').getAttribute('data-cc-element')).toBe('e7');
    cleanup();
    render(<LottieLayer animationData={tinyLottie} />);
    expect(screen.getByTestId('lottie-wrapper').getAttribute('data-cc-element')).toBeNull();
  });
});
