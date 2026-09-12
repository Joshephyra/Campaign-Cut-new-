import { describe, expect, it } from 'vitest';
import { lottieDurationInFrames } from './lottieDuration';

const lottie = (fr: number, ip: number, op: number) => ({ fr, ip, op, w: 1920, h: 1080, layers: [] });

// The composition derives its own length from the Lottie so the animation
// plays at authored speed and ends when it ends.
describe('lottieDurationInFrames', () => {
  it('is the frame span when the Lottie fps matches the composition fps', () => {
    expect(lottieDurationInFrames(lottie(30, 0, 150), 30)).toBe(150);
  });

  it('respects a non-zero in point', () => {
    expect(lottieDurationInFrames(lottie(30, 30, 150), 30)).toBe(120);
  });

  it('rescales when the Lottie was authored at a different fps', () => {
    // 5 seconds at 24 fps is 120 frames; at 30 fps it is 150.
    expect(lottieDurationInFrames(lottie(24, 0, 120), 30)).toBe(150);
    // 2 seconds at 60 fps is 120 frames; at 30 fps it is 60.
    expect(lottieDurationInFrames(lottie(60, 0, 120), 30)).toBe(60);
  });

  it('rounds to a whole frame and never returns less than 1', () => {
    expect(lottieDurationInFrames(lottie(24, 0, 1), 30)).toBe(1);
    expect(lottieDurationInFrames(lottie(30, 0, 0), 30)).toBe(1);
  });
});
