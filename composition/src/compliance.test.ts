import { describe, expect, it } from 'vitest';
import { DISCLAIMER_MIN_SECONDS, disclaimerCheck, disclaimerSeconds, emptySlots, readiness } from './compliance';

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


describe('emptySlots (M48)', () => {
  const media = { kind: 'media', key: 'footage' };
  it('names the enabled scenes whose footage slot has no clip, in play order, and nothing for scenes without a slot', () => {
    const scenes = [
      { name: 'End card', enabled: true, startFrame: 300, schema: [media], values: {} },
      { name: 'Open', enabled: true, startFrame: 0, schema: [media], values: { footage: { assetId: 4, fit: 'cover' } } },
      { name: 'Headline', enabled: true, startFrame: 150, schema: [media], values: { footage: null } },
      { name: 'Lower third', enabled: true, startFrame: 60, schema: [{ kind: 'text', key: 'subhead' }], values: {} },
      { name: 'Hidden', enabled: false, startFrame: 900, schema: [media], values: {} },
    ];
    expect(emptySlots(scenes)).toEqual(['Headline', 'End card']);
    expect(emptySlots([])).toEqual([]);
  });
});


describe('readiness (M49)', () => {
  const text = (key: string, dflt: string) => ({ kind: 'text', role: key, key, default: dflt });
  const media = { kind: 'media', role: 'mediaFill', key: 'footage', default: null };
  const logo = { kind: 'image', role: 'logo', key: 'logo', default: 'images/logo.png' };
  const disclaimer = { kind: 'text', role: 'safe.disclaimer', key: 'disclaimer', default: 'Paid for by Example' };

  it('lists the disclaimer (blocking), footage, logo and words, each ok or not, naming the scenes', () => {
    const r = readiness([
      { name: 'Open', enabled: true, startFrame: 0, endFrame: 150, schema: [text('headline', 'THE DESIGNER'), media], values: { headline: 'THE DESIGNER', footage: { assetId: 2 } } },
      { name: 'End card', enabled: true, startFrame: 150, endFrame: 300, schema: [text('headline', 'VOTE'), media, logo, disclaimer], values: { headline: 'VOTE TUESDAY', logo: 'images/logo.png', disclaimer: 'Paid for by Us' } },
    ], 30);
    expect(r.items.map((i) => [i.key, i.ok, i.blocking, i.message])).toEqual([
      ['disclaimer', true, true, 'Disclaimer on screen 5.0 s'],
      ['footage', false, false, 'No clip yet in End card'],
      ['logo', false, false, "The designer's stand-in logo in End card"],
      ['words', false, false, "Still the designer's words in Open"],
    ]);
    expect(r).toMatchObject({ ok: false, blocked: false, todo: 3 });
  });

  it('is ready when everything is in, blocked when the disclaimer is short, and leaves out what does not apply', () => {
    const ready = readiness([{ name: 'Card', enabled: true, startFrame: 0, endFrame: 150, schema: [text('headline', 'X'), disclaimer], values: { headline: 'Ours', disclaimer: 'Paid for by Us' } }], 30);
    expect(ready).toMatchObject({ ok: true, blocked: false, todo: 0 });
    expect(ready.items.map((i) => i.key)).toEqual(['disclaimer', 'words']);
    const short = readiness([{ name: 'Card', enabled: true, startFrame: 0, endFrame: 60, schema: [disclaimer], values: { disclaimer: 'Paid for by Us' } }], 30);
    expect(short).toMatchObject({ ok: false, blocked: true, todo: 1 });
    expect(short.items[0]!.message).toMatch(/2\.0 s; it must be at least 4\.0 s/);
  });

  it('names up to three scenes and counts the rest', () => {
    const scene = (name: string, i: number) => ({ name, enabled: true, startFrame: i * 10, endFrame: i * 10 + 10, schema: [text('headline', 'X')], values: {} });
    const r = readiness(['A', 'B', 'C', 'D', 'E'].map(scene), 30);
    expect(r.items.find((i) => i.key === 'words')!.message).toBe("Still the designer's words in 5 scenes: A, B, C and 2 more");
  });
});
