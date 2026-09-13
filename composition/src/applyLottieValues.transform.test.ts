import { describe, expect, it } from 'vitest';
import { applyLottieValues } from './applyLottieValues';
import type { LottieAnimationData } from './config';
import type { TemplateParam } from './schema';
import { DEFAULT_TRANSFORM, isTransformValue } from './transform';

/**
 * M18: a `transform` param moves, scales and rotates a tagged layer by an
 * OFFSET from what the designer authored. x and y are fractions of the
 * frame; scale is a multiplier; rotation is degrees. The authored
 * animation (keyframes, easing) is kept: every keyframe gets the same
 * offset. Same code in both runners.
 */
type AnyRecord = Record<string, unknown>;

const w = 1920;
const h = 1080;

function lottie(layers: AnyRecord[]): LottieAnimationData {
  return { fr: 30, ip: 0, op: 60, w, h, layers };
}

const staticLayer = {
  ty: 5,
  nm: 'cc.headline',
  ks: { p: { a: 0, k: [160, 500, 0] }, s: { a: 0, k: [100, 100, 100] }, r: { a: 0, k: 0 }, a: { a: 0, k: [0, 0, 0] }, o: { a: 0, k: 100 } },
};

const animatedLayer = {
  ty: 5,
  nm: 'cc.headline',
  ks: {
    p: {
      a: 1,
      k: [
        { t: 15, s: [160, 560, 0], e: [160, 500, 0], to: [0, -10, 0], ti: [0, 10, 0] },
        { t: 35, s: [160, 500, 0] },
      ],
    },
    s: { a: 1, k: [{ t: 0, s: [0, 100, 100] }, { t: 20, s: [100, 100, 100] }] },
    r: { a: 1, k: [{ t: 0, s: [0] }, { t: 20, s: [10] }] },
  },
};

/** Bodymovin's "separate dimensions" position: p.s true with x and y properties. */
const splitLayer = {
  ty: 5,
  nm: 'cc.headline',
  ks: { p: { s: true, x: { a: 0, k: 160 }, y: { a: 1, k: [{ t: 0, s: [560] }, { t: 20, s: [500] }] } }, s: { a: 0, k: [100, 100, 100] }, r: { a: 0, k: 0 } },
};

const schema: TemplateParam[] = [
  { key: 'headline', role: 'headline', kind: 'text', label: 'Headline', default: '', path: '/layers/0' },
  { key: 'headline.transform', role: 'headline', kind: 'transform', label: 'Headline placement', default: DEFAULT_TRANSFORM, path: '/layers/0', for: 'headline' },
];

const ks = (out: LottieAnimationData) => (out.layers[0] as AnyRecord).ks as AnyRecord;

describe('transform values', () => {
  it('recognises the shape and the identity default', () => {
    expect(DEFAULT_TRANSFORM).toEqual({ x: 0, y: 0, scale: 1, rotation: 0 });
    expect(isTransformValue({ x: 0.1, y: -0.2, scale: 1.5, rotation: 12 })).toBe(true);
    expect(isTransformValue({ x: '1', y: 0, scale: 1, rotation: 0 })).toBe(false);
    expect(isTransformValue(null)).toBe(false);
  });
});

describe('applyLottieValues: transform', () => {
  it('offsets a static position by fractions of the frame, in pixels', () => {
    const out = applyLottieValues(lottie([staticLayer]), { 'headline.transform': { x: 0.1, y: -0.05, scale: 1, rotation: 0 } }, schema);
    expect((ks(out).p as AnyRecord).k).toEqual([160 + 0.1 * w, 500 - 0.05 * h, 0]);
  });

  it('offsets every keyframe (start and end values) and leaves tangents alone', () => {
    const out = applyLottieValues(lottie([animatedLayer]), { 'headline.transform': { x: 0.25, y: 0.1, scale: 1, rotation: 0 } }, schema);
    const keys = (ks(out).p as AnyRecord).k as AnyRecord[];
    expect(keys[0]!.s).toEqual([160 + 480, 560 + 108, 0]);
    expect(keys[0]!.e).toEqual([160 + 480, 500 + 108, 0]);
    expect(keys[0]!.to).toEqual([0, -10, 0]);
    expect(keys[1]!.s).toEqual([160 + 480, 500 + 108, 0]);
  });

  it('handles separate x and y dimensions', () => {
    const out = applyLottieValues(lottie([splitLayer]), { 'headline.transform': { x: 0.5, y: 0.5, scale: 1, rotation: 0 } }, schema);
    const p = ks(out).p as AnyRecord;
    expect((p.x as AnyRecord).k).toBe(160 + 960);
    expect(((p.y as AnyRecord).k as AnyRecord[]).map((k) => k.s)).toEqual([[560 + 540], [500 + 540]]);
  });

  it('multiplies scale on x and y only, static and animated, and adds rotation', () => {
    const out = applyLottieValues(lottie([staticLayer]), { 'headline.transform': { x: 0, y: 0, scale: 1.5, rotation: -7 } }, schema);
    expect((ks(out).s as AnyRecord).k).toEqual([150, 150, 100]);
    expect((ks(out).r as AnyRecord).k).toBe(-7);

    const animated = applyLottieValues(lottie([animatedLayer]), { 'headline.transform': { x: 0, y: 0, scale: 2, rotation: 5 } }, schema);
    expect(((ks(animated).s as AnyRecord).k as AnyRecord[]).map((k) => k.s)).toEqual([
      [0, 200, 100],
      [200, 200, 100],
    ]);
    expect(((ks(animated).r as AnyRecord).k as AnyRecord[]).map((k) => k.s)).toEqual([[5], [15]]);
  });

  it('the identity is a no-op and the source is never mutated', () => {
    const source = lottie([animatedLayer]);
    const before = JSON.stringify(source);
    const out = applyLottieValues(source, { 'headline.transform': { ...DEFAULT_TRANSFORM } }, schema);
    expect(JSON.stringify(out)).toBe(before);
    applyLottieValues(source, { 'headline.transform': { x: 0.3, y: 0.3, scale: 3, rotation: 90 } }, schema);
    expect(JSON.stringify(source)).toBe(before);
  });

  it('ignores a value that is not a transform', () => {
    const out = applyLottieValues(lottie([staticLayer]), { 'headline.transform': 'left' }, schema);
    expect((ks(out).p as AnyRecord).k).toEqual([160, 500, 0]);
  });
});
