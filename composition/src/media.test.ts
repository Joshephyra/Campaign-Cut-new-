import { mediaTiming } from './media';
import { describe, expect, it } from 'vitest';
import { applyLottieValues } from './applyLottieValues';
import type { LottieAnimationData } from './config';
import { mediaFillRect, mediaSourceFor, resolveLottieAssets, withBaseUrl } from './media';
import type { TemplateParam } from './schema';

const base = (layers: unknown[]): LottieAnimationData => ({ fr: 30, ip: 0, op: 30, w: 1920, h: 1080, layers });

describe('mediaFillRect', () => {
  it('reads a solid layer as fractions of the frame', () => {
    // A 960x1080 solid whose anchor is its centre, placed at x=1440 (right half).
    const lottie = base([
      { ty: 1, nm: 'cc.mediaFill', sw: 960, sh: 1080, ks: { p: { a: 0, k: [1440, 540, 0] }, a: { a: 0, k: [480, 540, 0] }, s: { a: 0, k: [100, 100, 100] } } },
    ]);
    expect(mediaFillRect(lottie, '/layers/0')).toEqual({ x: 0.5, y: 0, w: 0.5, h: 1 });
  });

  it('reads a rectangle shape layer, applying the layer transform and scale', () => {
    // Rect 800x450 centred at the group origin; layer anchored at its centre, placed at (960,540), scaled 200%.
    const lottie = base([
      {
        ty: 4,
        nm: 'cc.mediaFill',
        ks: { p: { a: 0, k: [960, 540, 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [200, 200, 100] } },
        shapes: [{ ty: 'gr', it: [{ ty: 'rc', s: { a: 0, k: [800, 450] }, p: { a: 0, k: [0, 0] } }, { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] } }] }],
      },
    ]);
    const r = mediaFillRect(lottie, '/layers/0')!;
    expect(r.w).toBeCloseTo(1600 / 1920, 6);
    expect(r.h).toBeCloseTo(900 / 1080, 6);
    expect(r.x).toBeCloseTo((960 - 800) / 1920, 6);
    expect(r.y).toBeCloseTo((540 - 450) / 1080, 6);
  });

  it('uses the first keyframe when the position is animated', () => {
    const lottie = base([
      { ty: 1, nm: 'cc.mediaFill', sw: 1920, sh: 1080, ks: { p: { a: 1, k: [{ t: 0, s: [960, 540, 0] }, { t: 10, s: [0, 0, 0] }] }, a: { a: 0, k: [960, 540, 0] } } },
    ]);
    expect(mediaFillRect(lottie, '/layers/0')).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it('returns null when the path is not a solid or a shape with a rectangle', () => {
    const lottie = base([{ ty: 5, nm: 'cc.headline' }]);
    expect(mediaFillRect(lottie, '/layers/0')).toBeNull();
    expect(mediaFillRect(lottie, '/layers/9')).toBeNull();
  });
});

describe('applyLottieValues for a media param', () => {
  const lottie = base([{ ty: 1, nm: 'cc.mediaFill', sw: 960, sh: 1080, ks: { o: { a: 0, k: 100 }, p: { a: 0, k: [0, 0, 0] }, a: { a: 0, k: [0, 0, 0] } } }]);
  const schema: TemplateParam[] = [{ key: 'mediaFill', role: 'mediaFill', kind: 'media', label: 'Footage', default: null, path: '/layers/0' }];

  it('makes the slot layer transparent when footage is assigned, so the video shows through', () => {
    const out = applyLottieValues(lottie, { mediaFill: { assetId: 1, fit: 'cover' } }, schema);
    const layer = out.layers[0] as { ks: { o: { a: number; k: number } } };
    expect(layer.ks.o).toEqual({ a: 0, k: 0 });
  });

  it('leaves the slot alone when no footage is assigned', () => {
    const out = applyLottieValues(lottie, { mediaFill: null }, schema);
    expect(JSON.stringify(out)).toBe(JSON.stringify(lottie));
  });
});

describe('mediaSourceFor: the two-runners split', () => {
  const asset = { proxyUrl: '/media/proxies/1.mp4', originalUrl: '/media/originals/1-rally.mp4' };

  it('preview gets the proxy, export gets the original', () => {
    expect(mediaSourceFor(asset, 'preview')).toBe('/media/proxies/1.mp4');
    expect(mediaSourceFor(asset, 'export')).toBe('/media/originals/1-rally.mp4');
  });
});

describe('withBaseUrl', () => {
  it('prefixes server-relative image values and leaves everything else alone', () => {
    const schema: TemplateParam[] = [
      { key: 'logo', role: 'logo', kind: 'image', label: 'Logo', default: 'images/logo.png', path: '/assets/0' },
      { key: 'headline', role: 'headline', kind: 'text', label: 'H', default: 'x', path: '/layers/0' },
    ];
    const out = withBaseUrl({ logo: '/media/images/new.png', headline: 'VOTE' }, schema, 'http://127.0.0.1:3001');
    expect(out).toEqual({ logo: 'http://127.0.0.1:3001/media/images/new.png', headline: 'VOTE' });
  });

  it('does not touch a template-relative default or a data URI', () => {
    const schema: TemplateParam[] = [{ key: 'logo', role: 'logo', kind: 'image', label: 'Logo', default: 'images/logo.png', path: '/assets/0' }];
    expect(withBaseUrl({ logo: 'images/logo.png' }, schema, 'http://x')).toEqual({ logo: 'images/logo.png' });
    expect(withBaseUrl({ logo: 'data:image/png;base64,AA' }, schema, 'http://x')).toEqual({ logo: 'data:image/png;base64,AA' });
  });
});

describe('resolveLottieAssets', () => {
  it('points template-relative image assets at the template folder on the server', () => {
    const lottie: LottieAnimationData = {
      fr: 30, ip: 0, op: 1, w: 10, h: 10, layers: [],
      assets: [
        { id: 'image_0', u: 'images/', p: 'logo.png', e: 0 },
        { id: 'image_1', u: '', p: 'data:image/png;base64,AA', e: 1 },
        { id: 'image_2', u: '', p: 'http://elsewhere/x.png', e: 0 },
        { id: 'comp_0', layers: [] },
      ],
    };
    const out = resolveLottieAssets(lottie, '/api/templates/standin');
    const assets = out.assets as { id: string; u?: string; p?: string }[];
    expect(assets[0]).toEqual({ id: 'image_0', u: '/api/templates/standin/images/', p: 'logo.png', e: 0 });
    expect(assets[1]).toEqual(lottie.assets![1]);
    expect(assets[2]).toEqual(lottie.assets![2]);
    expect(assets[3]).toEqual(lottie.assets![3]);
    expect(lottie.assets![0]).toEqual({ id: 'image_0', u: 'images/', p: 'logo.png', e: 0 }); // untouched
  });

  it('returns the same object when there are no assets', () => {
    const lottie = base([]);
    expect(resolveLottieAssets(lottie, '/x')).toBe(lottie);
  });
});

describe('mediaTiming (M20)', () => {
  it('turns in and out seconds into frames for the composition', () => {
    expect(mediaTiming({ inS: 1.5, outS: 4 }, 30)).toEqual({ startFrom: 45, endAt: 120 });
    expect(mediaTiming({ inS: 2 }, 25)).toEqual({ startFrom: 50 });
  });
  it('ignores empty, zero, negative and backwards values', () => {
    expect(mediaTiming({}, 30)).toEqual({});
    expect(mediaTiming({ inS: 0, outS: 0 }, 30)).toEqual({});
    expect(mediaTiming({ inS: -3 }, 30)).toEqual({});
    expect(mediaTiming({ inS: 5, outS: 2 }, 30)).toEqual({ startFrom: 150 });
  });
});
