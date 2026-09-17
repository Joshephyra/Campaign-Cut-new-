import { describe, expect, it } from 'vitest';
import { DISCLAIMER_MIN_SECONDS, disclaimerCheck, disclaimerSeconds } from './compliance';

/**
 * M35: the one compliance check. A disclaimer must be on screen for at
 * least four seconds: the union of the enabled scenes that carry a
 * non-empty disclaimer text. The wording is never checked.
 */
const scene = (startFrame: number, endFrame: number, hasDisclaimer = true, enabled = true) => ({ startFrame, endFrame, enabled, hasDisclaimer });

describe('disclaimerSeconds', () => {
  it('sums the scenes that carry a disclaimer, as a union of their time on screen', () => {
    expect(disclaimerSeconds([scene(0, 60), scene(90, 150)], 30)).toBe(4);
    expect(disclaimerSeconds([scene(0, 90), scene(60, 150)], 30)).toBe(5); // overlap counted once
    expect(disclaimerSeconds([scene(0, 150, false), scene(120, 180)], 30)).toBe(2);
  });

  it('skips hidden scenes and scenes without a disclaimer, and is zero with none', () => {
    expect(disclaimerSeconds([scene(0, 150, true, false)], 30)).toBe(0);
    expect(disclaimerSeconds([scene(0, 150, false)], 30)).toBe(0);
    expect(disclaimerSeconds([], 30)).toBe(0);
  });
});

describe('disclaimerCheck', () => {
  it('passes at four seconds and above, and says what to do below', () => {
    expect(DISCLAIMER_MIN_SECONDS).toBe(4);
    expect(disclaimerCheck([scene(0, 120)], 30)).toEqual({ ok: true, seconds: 4, message: 'Disclaimer on screen for 4.0 s' });
    const short = disclaimerCheck([scene(0, 75)], 30);
    expect(short.ok).toBe(false);
    expect(short.seconds).toBe(2.5);
    expect(short.message).toMatch(/2\.5 s.*4\.0 s/);
    expect(short.message).toMatch(/lengthen/i);
    const none = disclaimerCheck([scene(0, 75, false)], 30);
    expect(none.ok).toBe(false);
    expect(none.message).toMatch(/no disclaimer/i);
  });
});
