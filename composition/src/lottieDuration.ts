import type { LottieAnimationData } from './config';

/**
 * How many composition frames a Lottie occupies when played at authored
 * speed. Rescales if the Lottie was authored at a different frame rate
 * than the composition. Never less than one frame.
 */
export function lottieDurationInFrames(
  lottie: Pick<LottieAnimationData, 'fr' | 'ip' | 'op'>,
  compositionFps: number,
): number {
  const seconds = (lottie.op - lottie.ip) / lottie.fr;
  return Math.max(1, Math.round(seconds * compositionFps));
}
