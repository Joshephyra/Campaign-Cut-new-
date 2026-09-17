import { describe, expect, it } from 'vitest';
import { applyLottieValues } from './applyLottieValues';
import { biggerAnimator, CALLOUT_DELAY_FRAMES, CALLOUT_DRAW_FRAMES, calloutKey, calloutsFrom, isCalloutValue, wordRanges } from './callouts';
import type { LottieAnimationData } from './config';
import type { TemplateParam } from './schema';

/** M56: a callout on one word: stored beside the text, drawn by the composition. */
const headline: TemplateParam = { key: 'headline', role: 'headline', kind: 'text', label: 'Headline', default: 'LOWER COSTS NOW', path: '/layers/0' };
const disclaimer: TemplateParam = { key: 'disclaimer', role: 'safe.disclaimer', kind: 'text', label: 'Disclaimer', default: 'Paid for', path: '/layers/1', locked: true };

describe('callouts', () => {
  it('finds the words and where their characters sit', () => {
    expect(wordRanges('LOWER  COSTS NOW')).toEqual([
      { word: 'LOWER', start: 0, end: 5 },
      { word: 'COSTS', start: 7, end: 12 },
      { word: 'NOW', start: 13, end: 16 },
    ]);
    expect(wordRanges('')).toEqual([]);
  });

  it('reads a callout from <key>.callout, in the accent, only for a word the text has, never on the disclaimer', () => {
    expect(isCalloutValue({ word: 1, style: 'circle' })).toBe(true);
    expect(isCalloutValue({ word: -1, style: 'circle' })).toBe(false);
    expect(isCalloutValue({ word: 1, style: 'wiggle' })).toBe(false);
    expect(calloutKey('headline')).toBe('headline.callout');
    const values = { headline: 'COSTS DOWN', 'headline.callout': { word: 1, style: 'underline' }, 'disclaimer.callout': { word: 0, style: 'circle' } };
    expect(calloutsFrom([headline, disclaimer], values, '#1D4ED8')).toEqual([{ key: 'headline', word: 1, style: 'underline', color: '#1D4ED8', startFrame: CALLOUT_DELAY_FRAMES }]);
    expect(calloutsFrom([headline], { 'headline.callout': { word: 5, style: 'circle' } }, '#1D4ED8')).toEqual([]);
    expect(calloutsFrom([headline], { 'headline.callout': { word: 2, style: 'bigger' } }, '#1D4ED8')).toHaveLength(1); // the default text has three words
  });

  it('"bigger" is a text animator on the word\'s characters, scaling up over the draw-on', () => {
    const a = biggerAnimator('LOWER COSTS NOW', 1, 0)!;
    expect(a.s).toMatchObject({ r: 2, b: 1, s: { k: 6 }, e: { k: 11 } });
    expect((a.a as { s: { k: { t: number; s: number[] }[] } }).s.k.map((k) => [k.t, k.s])).toEqual([[CALLOUT_DELAY_FRAMES, [100, 100]], [CALLOUT_DELAY_FRAMES + CALLOUT_DRAW_FRAMES, [135, 135]]]);
    expect(biggerAnimator('ONE', 3, 0)).toBeNull();
  });

  it('applyLottieValues puts the "bigger" animator on the text layer, and nothing for the other styles', () => {
    const lottie: LottieAnimationData = { v: '5', fr: 30, ip: 0, op: 90, w: 1920, h: 1080, layers: [{ ty: 5, nm: 'cc.headline', t: { d: { k: [{ s: { t: 'X' }, t: 0 }] }, a: [] } }] };
    const bigger = applyLottieValues(lottie, { headline: 'LOWER COSTS NOW', 'headline.callout': { word: 2, style: 'bigger' } }, [headline]);
    const animators = ((bigger.layers[0] as { t: { a: { nm: string }[] } }).t.a);
    expect(animators.map((x) => x.nm)).toEqual(['cc-callout-bigger']);
    const circled = applyLottieValues(lottie, { headline: 'LOWER COSTS NOW', 'headline.callout': { word: 2, style: 'circle' } }, [headline]);
    expect((circled.layers[0] as { t: { a: unknown[] } }).t.a).toEqual([]);
  });
});
