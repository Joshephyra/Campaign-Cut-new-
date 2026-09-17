import { describe, expect, it } from 'vitest';
import { EMPTY_LOTTIE } from './config';
import type { ElementProps } from './elements';
import { compositionDurationWithTransitions, effectiveTimeline, TRANSITION_PRESETS, type TransitionProps } from './transitions';

const el = (id: string, startFrame: number, endFrame: number, extra: Partial<ElementProps> = {}): ElementProps => ({
  id,
  lottie: EMPTY_LOTTIE,
  startFrame,
  endFrame,
  zIndex: 0,
  enabled: true,
  ...extra,
});

describe('TRANSITION_PRESETS', () => {
  it('is the small list from MILESTONES M10', () => {
    expect(TRANSITION_PRESETS).toEqual(['cut', 'fade', 'wipe', 'slide']);
  });
});

describe('effectiveTimeline', () => {
  it('with no transitions, every element keeps its own in/out and stands alone', () => {
    const out = effectiveTimeline([el('a', 0, 100), el('b', 120, 200)], []);
    expect(out.chains).toHaveLength(2);
    expect(out.elements).toEqual([
      { id: 'a', startFrame: 0, endFrame: 100 },
      { id: 'b', startFrame: 120, endFrame: 200 },
    ]);
  });

  it('a cut is the same as no transition', () => {
    const out = effectiveTimeline([el('a', 0, 100), el('b', 120, 200)], [{ afterElementId: 'a', preset: 'cut', durationInFrames: 15 }]);
    expect(out.chains).toHaveLength(2);
  });

  it('a fade joins two elements into one chain, overlapping by the transition length', () => {
    const t: TransitionProps[] = [{ afterElementId: 'a', preset: 'fade', durationInFrames: 10 }];
    const out = effectiveTimeline([el('a', 0, 100), el('b', 120, 200)], t);
    expect(out.chains).toHaveLength(1);
    expect(out.chains[0]!.startFrame).toBe(0);
    expect(out.chains[0]!.elementIds).toEqual(['a', 'b']);
    // b's own start is ignored inside a chain: it begins where a ends, minus the overlap.
    expect(out.elements).toEqual([
      { id: 'a', startFrame: 0, endFrame: 100 },
      { id: 'b', startFrame: 90, endFrame: 170 },
    ]);
    expect(out.chains[0]!.durationInFrames).toBe(170);
  });

  it('chains follow start order and skip disabled elements', () => {
    const t: TransitionProps[] = [
      { afterElementId: 'a', preset: 'wipe', durationInFrames: 10 },
      { afterElementId: 'b', preset: 'slide', durationInFrames: 10 },
    ];
    const out = effectiveTimeline([el('c', 300, 400), el('a', 0, 100), el('b', 100, 200, { enabled: false })], t);
    // b is disabled, so the boundary after a now leads into c: a's transition joins a and c.
    // (The timeline UI computes boundaries between consecutive ENABLED elements the same way.)
    expect(out.chains.map((c) => c.elementIds)).toEqual([['a', 'c']]);
    expect(out.chains[0]!.transitions[0]!.preset).toBe('wipe');
  });

  it('caps a transition at less than the shorter neighbour so both still show', () => {
    const t: TransitionProps[] = [{ afterElementId: 'a', preset: 'fade', durationInFrames: 500 }];
    const out = effectiveTimeline([el('a', 0, 30), el('b', 30, 60)], t);
    expect(out.chains[0]!.transitions[0]!.durationInFrames).toBeLessThan(30);
    expect(out.chains[0]!.durationInFrames).toBeGreaterThan(30);
  });
});

describe('compositionDurationWithTransitions', () => {
  it('shrinks by the overlap', () => {
    const t: TransitionProps[] = [{ afterElementId: 'a', preset: 'fade', durationInFrames: 10 }];
    expect(compositionDurationWithTransitions([el('a', 0, 100), el('b', 100, 200)], t)).toBe(190);
    expect(compositionDurationWithTransitions([el('a', 0, 100), el('b', 100, 200)], [])).toBe(200);
  });
});

/**
 * M31: an element added over another (a lower third over the open) is not
 * the open's successor. The open's transition leads into the next element
 * that actually follows it; the lower third keeps its own in and out.
 */
describe('transitions skip overlapping elements (M31)', () => {
  it('a fade after the open joins the end card, not the lower third sitting over the open', () => {
    const t: TransitionProps[] = [{ afterElementId: 'open', preset: 'fade', durationInFrames: 10 }];
    const out = effectiveTimeline([el('open', 0, 100), el('lower', 30, 90, { zIndex: 1 }), el('card', 100, 200)], t);
    expect(out.chains.map((c) => c.elementIds)).toEqual([['open', 'card'], ['lower']]);
    expect(out.elements).toEqual([
      { id: 'open', startFrame: 0, endFrame: 100 },
      { id: 'card', startFrame: 90, endFrame: 190 },
      { id: 'lower', startFrame: 30, endFrame: 90 },
    ]);
    expect(compositionDurationWithTransitions([el('open', 0, 100), el('lower', 30, 90, { zIndex: 1 }), el('card', 100, 200)], t)).toBe(190);
  });

  it('with nothing following, a transition after the last real scene does nothing', () => {
    const t: TransitionProps[] = [{ afterElementId: 'open', preset: 'fade', durationInFrames: 10 }];
    const out = effectiveTimeline([el('open', 0, 100), el('lower', 30, 90, { zIndex: 1 })], t);
    expect(out.chains.map((c) => c.elementIds)).toEqual([['open'], ['lower']]);
  });
});
