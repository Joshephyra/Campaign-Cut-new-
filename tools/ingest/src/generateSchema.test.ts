import type { LottieAnimationData, TemplateParam } from '@campaigncut/composition';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { generateSchema } from './generateSchema';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..');

// ---- fixture builders --------------------------------------------------

const textLayer = (nm: string, text: string, extra: Record<string, unknown> = {}) => ({
  ty: 5,
  nm,
  ks: {},
  t: { d: { k: [{ s: { t: text, f: 'Arial-Regular', s: 60, lh: 72, ...extra }, t: 0 }] } },
});

const fillShapeLayer = (nm: string, rgba: number[]) => ({
  ty: 4,
  nm,
  ks: {},
  shapes: [
    {
      ty: 'gr',
      it: [
        { ty: 'rc', s: { a: 0, k: [10, 10] } },
        { ty: 'fl', c: { a: 0, k: rgba }, o: { a: 0, k: 100 } },
        { ty: 'tr' },
      ],
    },
  ],
});

const strokeOnlyShapeLayer = (nm: string, rgba: number[]) => ({
  ty: 4,
  nm,
  ks: {},
  shapes: [{ ty: 'gr', it: [{ ty: 'el' }, { ty: 'st', c: { a: 0, k: rgba }, w: { a: 0, k: 4 } }, { ty: 'tr' }] }],
});

const noFillShapeLayer = (nm: string) => ({
  ty: 4,
  nm,
  ks: {},
  shapes: [{ ty: 'gr', it: [{ ty: 'rc', s: { a: 0, k: [10, 10] } }, { ty: 'tr' }] }],
});

const imageLayer = (nm: string, refId: string) => ({ ty: 2, nm, ks: {}, refId });
const solidLayer = (nm: string) => ({ ty: 1, nm, ks: {}, sc: '#000000', sw: 1920, sh: 1080 });

const lottie = (layers: unknown[], extra: Partial<LottieAnimationData> = {}): LottieAnimationData => ({
  v: '5.12.2',
  fr: 30,
  ip: 0,
  op: 150,
  w: 1920,
  h: 1080,
  nm: 'fixture',
  ddd: 0,
  assets: [],
  layers,
  fonts: { list: [{ fName: 'Arial-Regular', fFamily: 'Arial', fStyle: 'Regular', ascent: 71 }] },
  ...extra,
});

// ---- tests -------------------------------------------------------------

describe('generateSchema: every role', () => {
  const source = lottie(
    [
      textLayer('cc.headline', 'Headline here'),
      textLayer('cc.subhead', 'Subhead here'),
      textLayer('cc.body', 'Body here'),
      fillShapeLayer('cc.accent', [1, 0, 0, 1]),
      fillShapeLayer('cc.surface', [0, 0, 1, 1]),
      imageLayer('cc.logo', 'image_0'),
      solidLayer('cc.mediaFill'),
      textLayer('cc.safe.disclaimer', 'Paid for by X'),
      fillShapeLayer('untagged-craft', [0, 1, 0, 1]),
    ],
    { assets: [{ id: 'image_0', w: 100, h: 50, u: 'images/', p: 'logo.png', e: 0 }] },
  );
  const out = generateSchema(source);

  it('has no errors', () => {
    expect(out.errors).toEqual([]);
  });

  it('emits one param per tagged layer and none for untagged layers', () => {
    // M18: text and image params each carry a placement param right after them.
    expect(out.params.map((p) => p.key)).toEqual([
      'headline',
      'headline.transform',
      'subhead',
      'subhead.transform',
      'body',
      'body.transform',
      'accent',
      'surface',
      'logo',
      'logo.transform',
      'mediaFill',
      'disclaimer',
    ]);
  });

  it('maps roles to kinds per SPEC 1.1', () => {
    const kinds = Object.fromEntries(out.params.filter((p) => p.kind !== 'transform').map((p) => [p.key, p.kind]));
    expect(kinds).toEqual({
      headline: 'text',
      subhead: 'text',
      body: 'text',
      accent: 'color',
      surface: 'color',
      logo: 'image',
      mediaFill: 'media',
      disclaimer: 'text',
    });
  });

  it('points text params at the text layer and reads the authored text as default', () => {
    const headline = out.params.find((p) => p.key === 'headline')!;
    expect(headline.path).toBe('/layers/0');
    expect(headline.default).toBe('Headline here');
    expect(headline.label).toBe('Headline');
  });

  it('points colour params at the fill item and reads the authored colour as hex', () => {
    const accent = out.params.find((p) => p.key === 'accent')!;
    expect(accent.path).toBe('/layers/3/shapes/0/it/1');
    expect(accent.default).toBe('#FF0000');
  });

  it('points image params at the asset and reads its source as default', () => {
    const logo = out.params.find((p) => p.key === 'logo')!;
    expect(logo.path).toBe('/assets/0');
    expect(logo.default).toBe('images/logo.png');
  });

  it('locks the disclaimer', () => {
    const disclaimer = out.params.find((p) => p.key === 'disclaimer')!;
    expect(disclaimer.role).toBe('safe.disclaimer');
    expect(disclaimer.locked).toBe(true);
    expect(disclaimer.path).toBe('/layers/7');
  });

  it('reports every tag it found, in layer order', () => {
    expect(out.report.map((r) => `${r.layer} -> ${r.status}`)).toEqual([
      'cc.headline -> text',
      'cc.subhead -> text',
      'cc.body -> text',
      'cc.accent -> color',
      'cc.surface -> color',
      'cc.logo -> image',
      'cc.mediaFill -> media',
      'cc.safe.disclaimer -> text',
    ]);
  });

  it('extracts referenced font families, de-duplicated', () => {
    expect(out.fonts).toEqual(['Arial']);
  });
});

describe('generateSchema: repeated slots', () => {
  it('produces N distinct params in index order even if authored out of order', () => {
    const out = generateSchema(
      lottie([textLayer('cc.stat.3', 'C'), textLayer('cc.stat.1', 'A'), textLayer('cc.stat.2', 'B')]),
    );
    expect(out.errors).toEqual([]);
    expect(out.params.filter((p) => p.kind !== 'transform').map((p) => [p.key, p.role, p.default, p.label])).toEqual([
      ['stat.1', 'stat', 'A', 'Stat 1'],
      ['stat.2', 'stat', 'B', 'Stat 2'],
      ['stat.3', 'stat', 'C', 'Stat 3'],
    ]);
  });
});

describe('generateSchema: loud failures naming the layer', () => {
  it('unknown role', () => {
    const out = generateSchema(lottie([textLayer('cc.tagline', 'x')]));
    expect(out.errors).toHaveLength(1);
    expect(out.errors[0]!.layer).toBe('cc.tagline');
    expect(out.errors[0]!.message).toMatch(/unknown role "tagline"/i);
    expect(out.params).toEqual([]);
  });

  it('cc.accent on a layer with no fill or stroke', () => {
    const out = generateSchema(lottie([noFillShapeLayer('cc.accent')]));
    expect(out.errors).toHaveLength(1);
    expect(out.errors[0]!.layer).toBe('cc.accent');
    expect(out.errors[0]!.message).toMatch(/no fill or stroke/i);
  });

  it('cc.accent on a text layer', () => {
    const out = generateSchema(lottie([textLayer('cc.accent', 'x')]));
    expect(out.errors).toHaveLength(1);
    expect(out.errors[0]!.layer).toBe('cc.accent');
  });

  it('is case-sensitive: cc.Headline is unknown', () => {
    const out = generateSchema(lottie([textLayer('cc.Headline', 'x')]));
    expect(out.errors).toHaveLength(1);
    expect(out.errors[0]!.layer).toBe('cc.Headline');
    expect(out.errors[0]!.message).toMatch(/unknown role "Headline"/);
  });

  it('a text role on a shape layer', () => {
    const out = generateSchema(lottie([fillShapeLayer('cc.headline', [0, 0, 0, 1])]));
    expect(out.errors).toHaveLength(1);
    expect(out.errors[0]!.layer).toBe('cc.headline');
    expect(out.errors[0]!.message).toMatch(/not a text layer/i);
  });

  it('cc.logo on a layer with no image asset', () => {
    const out = generateSchema(lottie([solidLayer('cc.logo')]));
    expect(out.errors).toHaveLength(1);
    expect(out.errors[0]!.layer).toBe('cc.logo');
  });

  it('two layers with the same tag', () => {
    const out = generateSchema(lottie([textLayer('cc.headline', 'a'), textLayer('cc.headline', 'b')]));
    expect(out.errors).toHaveLength(1);
    expect(out.errors[0]!.message).toMatch(/duplicate/i);
  });

  it('errored tags still appear in the report', () => {
    const out = generateSchema(lottie([textLayer('cc.tagline', 'x'), textLayer('cc.headline', 'y')]));
    expect(out.report.map((r) => r.layer)).toEqual(['cc.tagline', 'cc.headline']);
    expect(out.report[0]!.status).toBe('error');
  });
});

describe('generateSchema: stroke, pre-comps, maxChars', () => {
  it('accepts a stroke as the colour target when there is no fill', () => {
    const out = generateSchema(lottie([strokeOnlyShapeLayer('cc.accent', [0, 0, 0, 1])]));
    expect(out.errors).toEqual([]);
    expect(out.params[0]!.path).toBe('/layers/0/shapes/0/it/1');
  });

  it('finds tags inside a pre-comp with paths into the assets list', () => {
    const source = lottie([{ ty: 0, nm: 'lower-third', refId: 'comp_0', ks: {}, w: 1920, h: 1080 }], {
      assets: [{ id: 'comp_0', layers: [textLayer('cc.subhead', 'Inside precomp')] }],
    });
    const out = generateSchema(source);
    expect(out.errors).toEqual([]);
    expect(out.params).toHaveLength(2); // the param and its placement
    expect(out.params[0]!.key).toBe('subhead');
    expect(out.params[0]!.path).toBe('/assets/0/layers/0');
    expect(out.params[1]).toMatchObject({ key: 'subhead.transform', path: '/assets/0/layers/0' });
    expect(out.params[0]!.default).toBe('Inside precomp');
  });

  it('derives maxChars from a box-text size when present', () => {
    // 600px wide box, one line, 60px font: roughly 600 / (0.55 * 60) = 18 chars on the line, twice that since box text shrinks to half (M61).
    const out = generateSchema(lottie([textLayer('cc.headline', 'x', { sz: [600, 72] })]));
    expect(out.params[0]!.maxChars).toBe(36);
  });

  it('gives a two-line box twice the characters', () => {
    const out = generateSchema(lottie([textLayer('cc.body', 'x', { sz: [600, 144] })]));
    expect(out.params[0]!.maxChars).toBe(72); // M61: twice the box, since the text may shrink to half
  });

  it('omits maxChars for point text (no box)', () => {
    const out = generateSchema(lottie([textLayer('cc.headline', 'x')]));
    expect(out.params[0]!.maxChars).toBeUndefined();
  });
});

describe('generateSchema: the stand-in template', () => {
  it('generates the schema M2 has been using', () => {
    const source = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'templates', 'standin', 'elements', 'standin', 'template.json'), 'utf8'),
    ) as LottieAnimationData;
    const expected = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'templates', 'standin', 'elements', 'standin', 'schema.json'), 'utf8'),
    ) as TemplateParam[];
    const out = generateSchema(source);
    expect(out.errors).toEqual([]);
    const byKey = (a: TemplateParam, b: TemplateParam) => a.key.localeCompare(b.key);
    expect([...out.params].sort(byKey)).toEqual([...expected].sort(byKey));
    expect(out.fonts).toEqual(["IBM Plex Sans"]);
  });
});

describe('generateSchema: numbered lines (M57)', () => {
  it('cc.headline.1 and cc.headline.2 are two params, Headline 1 and Headline 2, in index order; cc.stat still needs its index', () => {
    const out = generateSchema(lottie([textLayer('cc.headline.2', 'A LOS'), textLayer('cc.headline.1', 'AYUDA'), textLayer('cc.body.1', 'MULTIMILLONARIOS.')]));
    expect(out.errors).toEqual([]);
    expect(out.params.filter((p) => p.kind === 'text').map((p) => [p.key, p.role, p.default, p.label])).toEqual([
      ['headline.1', 'headline', 'AYUDA', 'Headline 1'],
      ['headline.2', 'headline', 'A LOS', 'Headline 2'],
      ['body.1', 'body', 'MULTIMILLONARIOS.', 'Body 1'],
    ]);
    const stat = generateSchema(lottie([textLayer('cc.stat', '1')]));
    expect(stat.errors[0]!.message).toMatch(/needs an index/);
    const logo = generateSchema(lottie([textLayer('cc.accent.1', 'x')]));
    expect(logo.errors[0]!.message).toMatch(/not repeatable/);
  });
});

describe('generateSchema: photo slots (M58)', () => {
  it('cc.image.1 and cc.image.2 are two image params, Photo 1 and Photo 2, each with a placement; cc.image alone needs its index', () => {
    const assets = [{ id: 'img_0', u: 'images/', p: 'lombardo.png' }, { id: 'img_1', u: 'images/', p: 'musk.png' }, { id: 'img_2', u: 'images/', p: 'logo.png' }];
    const out = generateSchema(lottie([imageLayer('cc.image.2', 'img_1'), imageLayer('cc.image.1', 'img_0'), imageLayer('cc.logo', 'img_2')], { assets }));
    expect(out.errors).toEqual([]);
    expect(out.params.filter((p) => p.kind === 'image').map((p) => [p.key, p.role, p.label, p.default])).toEqual([
      ['image.1', 'image', 'Photo 1', 'images/lombardo.png'],
      ['image.2', 'image', 'Photo 2', 'images/musk.png'],
      ['logo', 'logo', 'Logo', 'images/logo.png'],
    ]);
    expect(out.params.filter((p) => p.kind === 'transform').map((p) => p.for)).toEqual(['image.1', 'image.2', 'logo']);
    expect(generateSchema(lottie([imageLayer('cc.image', 'img_0')], { assets })).errors[0]!.message).toMatch(/needs an index/);
  });
});

describe('generateSchema: plates and underlines that follow a text (M60)', () => {
  const plate = (nm: string, extra: Record<string, unknown> = {}) => ({ ty: 4, nm, ks: {}, shapes: [{ ty: 'gr', it: [{ ty: 'rc', s: { a: 0, k: [10, 10] } }, { ty: 'fl', c: { a: 0, k: [1, 0, 0, 1] } }] }], ...extra });

  it('a shape or image layer named <text tag>.plate / .underline becomes a follow param bound to that text, whichever is listed first', () => {
    const out = generateSchema(lottie([plate('cc.headline.1.plate'), textLayer('cc.headline.1', 'AYUDA'), plate('cc.headline.1.underline'), plate('cc.headline.1.plate'), imageLayer('cc.headline.2.plate', 'img_0'), textLayer('cc.headline.2', 'A LOS')], { assets: [{ id: 'img_0', u: 'images/', p: 'plate.png', w: 100, h: 40 }] }));
    expect(out.errors).toEqual([]);
    expect(out.params.filter((p) => p.kind === 'follow').map((p) => [p.key, p.for, p.follows, p.path, p.label])).toEqual([
      ['headline.1.plate', 'headline.1', 'plate', '/layers/0', 'Headline 1 plate'],
      ['headline.1.underline', 'headline.1', 'underline', '/layers/2', 'Headline 1 underline'],
      ['headline.1.plate.2', 'headline.1', 'plate', '/layers/3', 'Headline 1 plate'],
      ['headline.2.plate', 'headline.2', 'plate', '/layers/4', 'Headline 2 plate'],
    ]);
    expect(out.params.filter((p) => p.kind === 'transform').map((p) => p.for)).toEqual(['headline.1', 'headline.2']); // followers get no placement of their own
    expect(out.report.map((r) => [r.layer, r.status])).toContainEqual(['cc.headline.1.plate', 'follow']);
  });

  it('names the layer when a follower has no text, sits on a text layer, or follows a colour', () => {
    const orphan = generateSchema(lottie([plate('cc.headline.3.plate')]));
    expect(orphan.errors[0]!.message).toMatch(/follows cc.headline.3, but no text layer carries that tag/);
    const onText = generateSchema(lottie([textLayer('cc.headline', 'x'), textLayer('cc.headline.plate', 'y')]));
    expect(onText.errors[0]!.message).toMatch(/must be a shape layer or an image layer/);
    const colour = generateSchema(lottie([plate('cc.accent.plate')]));
    expect(colour.errors[0]!.message).toMatch(/only a text can have a plate/);
  });
});

describe('generateSchema: a tall one-line box (M65)', () => {
  it('counts lines at no less than the type size, so a tight leading does not multiply the limit', () => {
    // the designer's box: 477 wide, 297 tall, 180 px type at 44 leading: one line of 4 characters, twice that for the shrink
    const out = generateSchema(lottie([textLayer('cc.headline', 'A LOS', { s: 180, lh: 44, sz: [477, 297] })]));
    expect(out.params[0]!.maxChars).toBe(8);
  });
});
