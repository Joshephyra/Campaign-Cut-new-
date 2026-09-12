import type { LottieAnimationData } from './config';

/**
 * One element on the timeline: an ingested piece (open, lower third, end
 * card...) with its own Lottie, placed at [startFrame, endFrame) in the
 * composition. The composition renders each enabled element in a Sequence.
 */
export type ElementProps = {
  id: string;
  lottie: LottieAnimationData;
  startFrame: number;
  endFrame: number;
  zIndex: number;
  enabled: boolean;
};

/** The composition lasts until the latest enabled element ends. Never less than one frame. */
export function compositionDurationFor(elements: ElementProps[]): number {
  let end = 0;
  for (const e of elements) if (e.enabled) end = Math.max(end, e.endFrame);
  return Math.max(1, Math.round(end));
}

/** Enabled elements, bottom of the stack first, so later ones paint on top. */
export function visibleElementsInOrder(elements: ElementProps[]): ElementProps[] {
  return elements.filter((e) => e.enabled && e.endFrame > e.startFrame).sort((a, b) => a.zIndex - b.zIndex);
}
