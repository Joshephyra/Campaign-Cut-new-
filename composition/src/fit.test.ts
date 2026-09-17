import { describe, expect, it } from 'vitest';
import type { LottieAnimationData } from './config';
import { fitLottie, fitSpecsFrom, MIN_SHRINK, textWidth, type FitSpec, type Measure } from './fit';
import type { TemplateParam } from './schema';

/** M60/M61: plates and underlines follow the copy; box text shrinks to its box. Widths here: 10 per character, plus tracking. */
const measure: Measure = (text, font) => text.length * 10 * (font.size / 16) + font.tracking * Math.max(0, text.length - 1);

type AnyRecord = Record<string, unknown>;

function fixture(opts: { text?: string; j?: number; sz?: [number, number]; textScale?: number; plateParented?: boolean; plateScale?: number; animatedRect?: boolean } = {}): LottieAnimationData {
  const rectSize = opts.animatedRect ? { a: 1, k: [{ t: 0, s: [0, 40], e: [60, 40] }, { t: 10, s: [60, 40] }] } : { a: 0, k: [60, 40] };
  return {
    v: '5', fr: 30, ip: 0, op: 30, w: 1000, h: 1000,
    assets: [{ id: 'img', w: 100, h: 40, u: 'images/', p: 'plate.png' }],
    fonts: { list: [{ fName: 'Test-Regular', fFamily: 'Test', fStyle: 'Regular' }] },
    layers: [
      { ind: 1, ty: 5, nm: 'cc.headline', ks: { s: { a: 0, k: [opts.textScale ?? 100, opts.textScale ?? 100, 100] }, p: { a: 0, k: [100, 100, 0] } },
        t: { d: { k: [{ t: 0, s: { s: 16, f: 'Test-Regular', t: opts.text ?? 'VOTE', j: opts.j ?? 0, tr: 0, lh: 20, ...(opts.sz ? { sz: opts.sz } : {}) } }] } } },
      { ind: 2, ty: 4, nm: 'cc.headline.plate', ...(opts.plateParented === false ? {} : { parent: 1 }), ks: { s: { a: 0, k: [opts.plateScale ?? 100, opts.plateScale ?? 100, 100] }, p: { a: 0, k: [0, 0, 0] } },
        shapes: [{ ty: 'gr', it: [{ ty: 'rc', s: rectSize, p: { a: 0, k: [20, 0] }, r: { a: 0, k: 0 } }, { ty: 'fl', c: { a: 0, k: [1, 0, 0, 1] } }] }] },
      { ind: 3, ty: 4, nm: 'cc.headline.underline', ks: { s: { a: 0, k: [100, 100, 100] }, p: { a: 0, k: [100, 120, 0] } },
        shapes: [{ ty: 'sh', ks: { a: 0, k: { c: false, v: [[0, 10], [40, 10]], i: [[0, 0], [0, 0]], o: [[0, 0], [0, 0]] } } }, { ty: 'st', c: { a: 0, k: [1, 0, 0, 1] }, w: { a: 0, k: 4 } }] },
      { ind: 4, ty: 2, nm: 'cc.headline.plate', refId: 'img', ks: { s: { a: 0, k: [100, 100, 100] }, p: { a: 0, k: [150, 100, 0] }, a: { a: 0, k: [50, 20, 0] } } },
    ],
  };
}

const schema: TemplateParam[] = [
  { key: 'headline', role: 'headline', kind: 'text', label: 'Headline', default: 'VOTE', path: '/layers/0' },
  { key: 'headline.plate', role: 'headline', kind: 'follow', label: 'Headline plate', default: null, path: '/layers/1', for: 'headline', follows: 'plate' },
  { key: 'headline.underline', role: 'headline', kind: 'follow', label: 'Headline underline', default: null, path: '/layers/2', for: 'headline', follows: 'underline' },
  { key: 'headline.plate.2', role: 'headline', kind: 'follow', label: 'Headline plate', default: null, path: '/layers/3', for: 'headline', follows: 'plate' },
];
const specs = fitSpecsFrom(schema);

const rect = (l: LottieAnimationData, i = 1) => ((((l.layers[i] as AnyRecord).shapes as AnyRecord[])[0]!.it as AnyRecord[])[0] as AnyRecord);
const pathV = (l: LottieAnimationData) => ((((l.layers[2] as AnyRecord).shapes as AnyRecord[])[0]!.ks as AnyRecord).k as AnyRecord).v;
const image = (l: LottieAnimationData) => (l.layers[3] as AnyRecord).ks as AnyRecord;
const textStyle = (l: LottieAnimationData) => ((((l.layers[0] as AnyRecord).t as AnyRecord).d as AnyRecord).k as AnyRecord[])[0]!.s as AnyRecord;

describe('fit specs', () => {
  it('one spec per text param, carrying its followers', () => {
    expect(specs).toEqual<FitSpec[]>([{ key: 'headline', textPath: '/layers/0', authored: 'VOTE', followers: [{ path: '/layers/1', follows: 'plate' }, { path: '/layers/2', follows: 'underline' }, { path: '/layers/3', follows: 'plate' }] }]);
  });
  it('the widest line counts', () => {
    expect(textWidth('AB\rABCD', { family: 'Test', style: 'Regular', size: 16, tracking: 0 }, measure)).toBe(40);
  });
});

describe('followers move with the copy (M60)', () => {
  it('the authored copy leaves the Lottie untouched, identity included', () => {
    const src = fixture();
    expect(fitLottie(src, specs, measure)).toBe(src);
  });

  it('left-justified: a rectangle grows to the right, a path stretches its right end, an image stretches keeping its left edge', () => {
    const out = fitLottie(fixture({ text: 'VOTE NOW' }), specs, measure); // 40 -> 80: delta 40
    expect((rect(out).s as AnyRecord).k).toEqual([100, 40]);
    expect((rect(out).p as AnyRecord).k).toEqual([40, 0]);
    expect(pathV(out)).toEqual([[0, 10], [80, 10]]);
    expect((image(out).s as AnyRecord).k).toEqual([140, 100, 100]); // 100 px wide, 40 wider: 140%
    expect((image(out).p as AnyRecord).k).toEqual([170, 100, 0]); // anchor 50 × 0.4 keeps the left edge where it was
  });

  it('centred text grows both ways; right-justified text grows to the left', () => {
    const centred = fitLottie(fixture({ text: 'VOTE NOW', j: 2 }), specs, measure);
    expect((rect(centred).s as AnyRecord).k).toEqual([100, 40]);
    expect((rect(centred).p as AnyRecord).k).toEqual([20, 0]);
    expect(pathV(centred)).toEqual([[-20, 10], [60, 10]]);
    expect((image(centred).p as AnyRecord).k).toEqual([150, 100, 0]);
    const right = fitLottie(fixture({ text: 'VOTE NOW', j: 1 }), specs, measure);
    expect((rect(right).p as AnyRecord).k).toEqual([0, 0]);
    expect(pathV(right)).toEqual([[-40, 10], [40, 10]]);
    expect((image(right).p as AnyRecord).k).toEqual([130, 100, 0]);
  });

  it('shorter copy pulls the followers in', () => {
    const out = fitLottie(fixture({ text: 'VO' }), specs, measure); // delta -20
    expect((rect(out).s as AnyRecord).k).toEqual([40, 40]);
    expect(pathV(out)).toEqual([[0, 10], [20, 10]]);
  });

  it('scales are honoured: the text at 200%, a plate not parented to it at 50%', () => {
    const out = fitLottie(fixture({ text: 'VOTE NOW', textScale: 200, plateParented: false, plateScale: 50 }), specs, measure);
    expect((rect(out).s as AnyRecord).k).toEqual([220, 40]); // 40 × 2 in the comp, ÷ 0.5 in the plate's units: 160 more
    expect(pathV(out)).toEqual([[0, 10], [120, 10]]); // the underline at 100%, unparented: 80 more
  });

  it('an animated rectangle grows in every keyframe', () => {
    const out = fitLottie(fixture({ text: 'VOTE NOW', animatedRect: true }), specs, measure);
    const k = (rect(out).s as AnyRecord).k as AnyRecord[];
    expect(k[0]!.s).toEqual([40, 40]);
    expect(k[0]!.e).toEqual([100, 40]);
    expect(k[1]!.s).toEqual([100, 40]);
  });
});

describe('box text shrinks to its box (M61)', () => {
  it('copy wider than the box shrinks to fit it, line height with it, and the plate follows the shrunk width', () => {
    const out = fitLottie(fixture({ text: 'VOTE NOW', sz: [50, 40] }), specs, measure); // 80 into 50: 0.625
    expect(textStyle(out).s).toBe(10);
    expect(textStyle(out).lh).toBe(12.5);
    expect((rect(out).s as AnyRecord).k).toEqual([70, 40]); // 50 - 40 = 10 wider
  });

  it('never shrinks below what the authored copy needed, never below half size, and never when the copy fits', () => {
    const tightBox = fitLottie(fixture({ text: 'VOTE NOW', sz: [30, 40] }), specs, measure); // the authored VOTE was 40 wide in a 30 box: 40 is the room
    expect(textStyle(tightBox).s).toBe(8);
    const tooLong = fitLottie(fixture({ text: 'VOTE NOW VOTE NOW VOTE NOW', sz: [50, 40] }), specs, measure);
    expect(textStyle(tooLong).s).toBe(16 * MIN_SHRINK);
    const fits = fitLottie(fixture({ text: 'VOTES', sz: [50, 40] }), specs, measure);
    expect(textStyle(fits).s).toBe(16);
    expect((rect(fits).s as AnyRecord).k).toEqual([70, 40]);
  });

  it('point text has no box and is never shrunk', () => {
    const out = fitLottie(fixture({ text: 'VOTE NOW VOTE NOW VOTE NOW' }), specs, measure);
    expect(textStyle(out).s).toBe(16);
  });
});
