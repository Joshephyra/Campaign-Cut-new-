import type { Callout } from './callouts';
import type { FitSpec } from './fit';
import type { LottieAnimationData, MainMedia } from './config';

/**
 * One element on the timeline: an ingested piece (open, lower third, end
 * card...) with its own Lottie, placed at [startFrame, endFrame) in the
 * composition. The composition renders each enabled element in a Sequence.
 * Since M21 an element carries its own footage for its cc.mediaFill slot.
 */
export type ElementProps = {
  id: string;
  lottie: LottieAnimationData;
  startFrame: number;
  endFrame: number;
  zIndex: number;
  enabled: boolean;
  /** Footage under this element's Lottie, in its slot, or none. Trim is relative to the element's in point. */
  media?: MainMedia | null;
  /** M56: callouts on words of this element's text. */
  callouts?: Callout[];
  /** M60: the texts whose plates and underlines follow the copy, and box text to shrink to its box (M61). */
  fit?: FitSpec[];
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
