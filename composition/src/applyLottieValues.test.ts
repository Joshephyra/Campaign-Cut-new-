import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { applyLottieValues } from './applyLottieValues';
import type { LottieAnimationData } from './config';
import { resolvePointer } from './jsonPointer';
import type { TemplateParam } from './schema';

const here = path.dirname(fileURLToPath(import.meta.url));
const standinDir = path.resolve(here, '..', '..', 'templates', 'standin');
const loadStandin = () =>
  JSON.parse(fs.readFileSync(path.join(standinDir, 'template.json'), 'utf8')) as LottieAnimationData;
const schema = JSON.parse(fs.readFileSync(path.join(standinDir, 'schema.json'), 'utf8')) as TemplateParam[];

type AnyRecord = Record<string, unknown>;
const textOf = (lottie: LottieAnimationData, layerIndex: number) =>
  ((((lottie.layers[layerIndex] as AnyRecord).t as AnyRecord).d as AnyRecord).k as AnyRecord[])[0]!.s as AnyRecord;
const colourOf = (lottie: LottieAnimationData, pointer: string) =>
  ((resolvePointer(lottie, pointer) as AnyRecord).c as AnyRecord).k as number[];

describe('applyLottieValues', () => {
  // T1
  it('changes only the headline text and leaves everything else byte-identical', () => {
    const source = loadStandin();
    const result = applyLottieValues(source, { headline: 'VOTE TUESDAY' }, schema);

    expect(textOf(result, 1).t).toBe('VOTE TUESDAY');

    // Put the original string back into a copy of the result; it must then
    // equal the source exactly.
    const restored = structuredClone(result) as LottieAnimationData;
    textOf(restored, 1).t = 'STAND-IN HEADLINE';
    expect(JSON.stringify(restored)).toBe(JSON.stringify(source));
  });

  // T2
  it('does not mutate the source', () => {
    const source = loadStandin();
    const before = JSON.stringify(source);
    applyLottieValues(source, { headline: 'CHANGED', accent: '#000000', surface: '#FFFFFF' }, schema);
    expect(JSON.stringify(source)).toBe(before);
  });

  // T4
  it('ignores a key that is not in the schema', () => {
    const source = loadStandin();
    const result = applyLottieValues(source, { nonsense: 'whatever' }, schema);
    expect(JSON.stringify(result)).toBe(JSON.stringify(source));
  });

  it('ignores an invalid colour string and keeps the authored colour', () => {
    const source = loadStandin();
    const result = applyLottieValues(source, { accent: '#12' }, schema);
    expect(colourOf(result, '/layers/2/shapes/0/it/1')).toEqual([0.94, 0.35, 0.16, 1]);
  });

  // T5
  it('is memoized on the values object', () => {
    const source = loadStandin();
    const values = { headline: 'SAME' };
    const a = applyLottieValues(source, values, schema);
    const b = applyLottieValues(source, values, schema);
    expect(b).toBe(a);

    const c = applyLottieValues(source, { headline: 'SAME' }, schema);
    expect(c).not.toBe(a);
    expect(JSON.stringify(c)).toBe(JSON.stringify(a));
  });

  // T6
  it('writes fill colours as normalised RGBA at .c.k', () => {
    const source = loadStandin();
    const result = applyLottieValues(source, { accent: '#2B54E6', surface: '#FFFFFF' }, schema);
    const [r, g, b, a] = colourOf(result, '/layers/2/shapes/0/it/1');
    expect(r).toBeCloseTo(0x2b / 255, 6);
    expect(g).toBeCloseTo(0x54 / 255, 6);
    expect(b).toBeCloseTo(0xe6 / 255, 6);
    expect(a).toBe(1);
    expect(colourOf(result, '/layers/4/shapes/0/it/1')).toEqual([1, 1, 1, 1]);
  });

  it('writes stroke colours the same way', () => {
    const source: LottieAnimationData = {
      fr: 30, ip: 0, op: 30, w: 100, h: 100,
      layers: [
        { ty: 4, nm: 'cc.accent', shapes: [{ ty: 'gr', it: [{ ty: 'st', c: { a: 0, k: [0, 0, 0, 1] }, w: { a: 0, k: 2 } }] }] },
      ],
    };
    const strokeSchema: TemplateParam[] = [
      { key: 'accent', role: 'accent', kind: 'color', label: 'Accent', default: '#000000', path: '/layers/0/shapes/0/it/0' },
    ];
    const result = applyLottieValues(source, { accent: '#FFFFFF' }, strokeSchema);
    expect(colourOf(result, '/layers/0/shapes/0/it/0')).toEqual([1, 1, 1, 1]);
  });

  it('replaces an image asset and leaves the rest of the JSON identical', () => {
    const source: LottieAnimationData = {
      fr: 30, ip: 0, op: 30, w: 100, h: 100,
      assets: [
        { id: 'image_0', w: 200, h: 100, u: 'images/', p: 'logo.png', e: 0 },
        { id: 'image_1', w: 50, h: 50, u: 'images/', p: 'other.png', e: 0 },
      ],
      layers: [{ ty: 2, nm: 'cc.logo', refId: 'image_0' }],
    };
    const logoSchema: TemplateParam[] = [
      { key: 'logo', role: 'logo', kind: 'image', label: 'Logo', default: 'images/logo.png', path: '/assets/0' },
    ];
    const result = applyLottieValues(source, { logo: 'data:image/png;base64,AAAA' }, logoSchema);
    const asset = (result.assets as AnyRecord[])[0]!;
    expect(asset.p).toBe('data:image/png;base64,AAAA');
    expect(asset.u).toBe('');
    expect(asset.e).toBe(1);
    expect(asset.id).toBe('image_0');
    expect((result.assets as AnyRecord[])[1]).toEqual(source.assets![1]);
    expect(result.layers).toEqual(source.layers);
  });

  it('writes text into every keyframe of an animated text document', () => {
    const source: LottieAnimationData = {
      fr: 30, ip: 0, op: 30, w: 100, h: 100,
      layers: [
        {
          ty: 5,
          nm: 'cc.headline',
          t: { d: { k: [{ s: { t: 'A', f: 'Arial', s: 10 }, t: 0 }, { s: { t: 'A', f: 'Arial', s: 20 }, t: 15 }] } },
        },
      ],
    };
    const s: TemplateParam[] = [{ key: 'headline', role: 'headline', kind: 'text', label: 'H', default: 'A', path: '/layers/0' }];
    const result = applyLottieValues(source, { headline: 'B' }, s);
    const keys = (((result.layers[0] as AnyRecord).t as AnyRecord).d as AnyRecord).k as AnyRecord[];
    expect((keys[0]!.s as AnyRecord).t).toBe('B');
    expect((keys[1]!.s as AnyRecord).t).toBe('B');
    expect((keys[1]!.s as AnyRecord).s).toBe(20);
  });
});

// T7
describe('stand-in schema', () => {
  it('every path resolves to a node of the right shape in the stand-in template', () => {
    const source = loadStandin();
    for (const param of schema) {
      const node = resolvePointer(source, param.path) as AnyRecord | undefined;
      expect(node, `${param.key} at ${param.path}`).toBeDefined();
      if (param.kind === 'text') expect(node!.ty, `${param.key} should be a text layer`).toBe(5);
      if (param.kind === 'color') expect(['fl', 'st'], `${param.key} should be a fill or stroke`).toContain(node!.ty);
      if (param.kind === 'image') expect(node!.p, `${param.key} should be an asset with p`).toBeDefined();
    }
  });

  it('defaults match what is authored in the template', () => {
    const source = loadStandin();
    expect(textOf(source, 1).t).toBe(schema.find((p) => p.key === 'headline')!.default);
    expect(textOf(source, 0).t).toBe(schema.find((p) => p.key === 'disclaimer')!.default);
  });
});
