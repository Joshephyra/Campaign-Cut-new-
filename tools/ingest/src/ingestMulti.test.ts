import { openDb, type Db } from '@campaigncut/server/db';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IngestFailure, ingestTemplate, thumbnailFrame, type ThumbnailRenderer } from './ingest';

/**
 * M17: a handover folder with one sub-folder per element (each a Bodymovin
 * export) becomes one template with several elements already placed on the
 * timeline. tools/ingest/fixtures/multi is open (90f) + lower third (60f,
 * overlapping from frame 60) + end card (90f from frame 150) = 240 frames.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.resolve(here, '..', 'fixtures', 'multi');

type AnyRecord = Record<string, unknown>;

function copyFixture(tmp: string, mutate?: (dir: string) => void): string {
  const dir = path.join(tmp, 'handover');
  fs.cpSync(fixtureDir, dir, { recursive: true });
  mutate?.(dir);
  return dir;
}

function editLottie(dir: string, folder: string, fn: (l: AnyRecord) => void) {
  const file = path.join(dir, folder, 'data.json');
  const l = JSON.parse(fs.readFileSync(file, 'utf8')) as AnyRecord;
  fn(l);
  fs.writeFileSync(file, JSON.stringify(l));
}

const fakeThumbnail: ThumbnailRenderer = async ({ outputPath }) => {
  fs.writeFileSync(outputPath, 'PNG');
};

describe('ingestTemplate: multi-element handover', () => {
  let tmp: string;
  let templatesDir: string;
  let fontsDir: string;
  let db: Db;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-multi-'));
    templatesDir = path.join(tmp, 'templates');
    fontsDir = path.join(tmp, 'fonts');
    fs.mkdirSync(fontsDir, { recursive: true });
    fs.writeFileSync(path.join(fontsDir, 'IBMPlexSans-Regular.ttf'), 'plex');
    db = openDb(':memory:');
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  const run = (input: string, overrides: Partial<Parameters<typeof ingestTemplate>[0]> = {}) =>
    ingestTemplate({ input, adType: 'Contrast', name: 'Three Part', slug: 'three', templatesDir, fontsDir, db, renderThumbnail: fakeThumbnail, ...overrides });

  it('writes one element directory per export, a meta with the timeline, and three element rows', async () => {
    const result = await run(copyFixture(tmp));
    const dir = path.join(templatesDir, 'three');
    for (const slug of ['open', 'lower-third', 'end-card']) {
      expect(fs.existsSync(path.join(dir, 'elements', slug, 'template.json')), `${slug} template.json`).toBe(true);
      expect(fs.existsSync(path.join(dir, 'elements', slug, 'schema.json')), `${slug} schema.json`).toBe(true);
    }
    expect(fs.existsSync(path.join(dir, 'elements', 'lower-third', 'images', 'logo.png'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'elements', 'end-card', 'images', 'logo.png'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'template.json'))).toBe(false); // no template-level Lottie any more
    expect(fs.existsSync(path.join(dir, 'thumb.png'))).toBe(true);

    const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8')) as AnyRecord;
    expect(meta).toMatchObject({ slug: 'three', durationInFrames: 240, fps: 30, width: 1920, height: 1080, fonts: ['IBM Plex Sans'] });
    expect(meta.elements).toEqual([
      { slug: 'open', name: 'Open', type: 'open', startFrame: 0, endFrame: 90, zIndex: 0, durationInFrames: 90, fonts: ['IBM Plex Sans'] },
      { slug: 'lower-third', name: 'Lower third', type: 'lower-third', startFrame: 60, endFrame: 120, zIndex: 1, durationInFrames: 60, fonts: ['IBM Plex Sans'] },
      { slug: 'end-card', name: 'End card', type: 'end-card', startFrame: 150, endFrame: 240, zIndex: 0, durationInFrames: 90, fonts: ['IBM Plex Sans'] },
    ]);

    const template = db.listTemplates()[0]!;
    expect(template).toMatchObject({ slug: 'three', durationFrames: 240 });
    expect(db.listTemplateElements(template.id).map(({ slug, name, startFrame, endFrame, zIndex }) => ({ slug, name, startFrame, endFrame, zIndex }))).toEqual([
      { slug: 'open', name: 'Open', startFrame: 0, endFrame: 90, zIndex: 0 },
      { slug: 'end-card', name: 'End card', startFrame: 150, endFrame: 240, zIndex: 0 },
      { slug: 'lower-third', name: 'Lower third', startFrame: 60, endFrame: 120, zIndex: 1 },
    ]);

    // each element has its own schema
    const open = JSON.parse(fs.readFileSync(path.join(dir, 'elements', 'open', 'schema.json'), 'utf8')) as { key: string }[];
    const lower = JSON.parse(fs.readFileSync(path.join(dir, 'elements', 'lower-third', 'schema.json'), 'utf8')) as { key: string }[];
    expect(open.map((p) => p.key).sort()).toEqual(['accent', 'headline', 'headline.transform', 'mediaFill', 'surface']);
    expect(lower.map((p) => p.key).sort()).toEqual(['logo', 'logo.transform', 'subhead', 'subhead.transform']);
    expect(result.elements.map((e) => e.slug)).toEqual(['open', 'lower-third', 'end-card']);
    expect(result.elements[1]!.params.map((p) => p.key).sort()).toEqual(['logo', 'logo.transform', 'subhead', 'subhead.transform']);
  });

  it('without a manifest, orders elements alphabetically, lays them end to end, and derives slugs from folder names', async () => {
    const input = copyFixture(tmp, (dir) => fs.rmSync(path.join(dir, 'elements.json')));
    await run(input);
    const meta = JSON.parse(fs.readFileSync(path.join(templatesDir, 'three', 'meta.json'), 'utf8')) as { elements: AnyRecord[]; durationInFrames: number };
    expect(meta.elements.map((e) => [e.slug, e.name, e.startFrame, e.endFrame, e.zIndex])).toEqual([
      ['open', 'Open', 0, 90, 0],
      ['lower-third', 'Lower third', 90, 150, 1],
      ['end-card', 'End card', 150, 240, 2],
    ]);
    expect(meta.durationInFrames).toBe(240);
  });

  it('fails naming the element and the layer when one export has a bad tag, and writes nothing', async () => {
    const input = copyFixture(tmp, (dir) =>
      editLottie(dir, '02-lower-third', (l) => {
        (l.layers as AnyRecord[])[0]!.nm = 'cc.tagline';
      }),
    );
    await expect(run(input)).rejects.toThrow(IngestFailure);
    await expect(run(input)).rejects.toThrow(/lower-third.*cc\.tagline/s);
    expect(fs.existsSync(path.join(templatesDir, 'three'))).toBe(false);
    expect(db.listTemplates()).toHaveLength(0);
  });

  it('fails naming the element when its frame rate or size differs from the first element', async () => {
    const input = copyFixture(tmp, (dir) =>
      editLottie(dir, '03-end-card', (l) => {
        l.fr = 25;
      }),
    );
    await expect(run(input)).rejects.toThrow(/end-card.*25/s);
    expect(fs.existsSync(path.join(templatesDir, 'three'))).toBe(false);
  });

  it('rejects duplicate element slugs in the manifest', async () => {
    const input = copyFixture(tmp, (dir) => {
      const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'elements.json'), 'utf8')) as AnyRecord[];
      manifest[1]!.slug = 'open';
      fs.writeFileSync(path.join(dir, 'elements.json'), JSON.stringify(manifest));
    });
    await expect(run(input)).rejects.toThrow(/duplicate.*open/i);
  });

  it('rejects a manifest entry whose folder does not exist, naming it', async () => {
    const input = copyFixture(tmp, (dir) => {
      const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'elements.json'), 'utf8')) as AnyRecord[];
      manifest[0]!.folder = '00-missing';
      fs.writeFileSync(path.join(dir, 'elements.json'), JSON.stringify(manifest));
    });
    await expect(run(input)).rejects.toThrow(/00-missing/);
  });

  it('ships the union of fonts once at template level and fails naming the element when one is missing', async () => {
    await run(copyFixture(tmp));
    expect(fs.existsSync(path.join(templatesDir, 'three', 'fonts', 'IBMPlexSans-Regular.ttf'))).toBe(true);
    const meta = JSON.parse(fs.readFileSync(path.join(templatesDir, 'three', 'meta.json'), 'utf8')) as AnyRecord;
    expect(meta.fontFiles).toEqual([{ family: 'IBM Plex Sans', style: 'Regular', file: 'IBMPlexSans-Regular.ttf' }]);

    fs.rmSync(path.join(fontsDir, 'IBMPlexSans-Regular.ttf'));
    const input = copyFixture(path.join(tmp, 'b'), (dir) =>
      editLottie(dir, '02-lower-third', (l) => {
        (l.fonts as { list: AnyRecord[] }).list[0]!.fFamily = 'Nowhere Sans';
        (l.fonts as { list: AnyRecord[] }).list[0]!.fName = 'NowhereSans-Regular';
        ((l.layers as AnyRecord[])[0]!.t as { d: { k: { s: { f: string } }[] } }).d.k[0]!.s.f = 'NowhereSans-Regular';
      }),
    );
    await expect(run(input, { slug: 'three-b' })).rejects.toThrow(/Nowhere Sans/);
  });

  it('renders the thumbnail through the composition with every element in place at the middle frame', async () => {
    let seen: Parameters<ThumbnailRenderer>[0] | undefined;
    await run(copyFixture(tmp), {
      renderThumbnail: async (opts) => {
        seen = opts;
        await fakeThumbnail(opts);
      },
    });
    // Frame 120 (the middle) falls in the gap before the end card; the busiest frame nearest it is 89 (open + lower third).
    expect(seen!.frame).toBe(89);
    expect(seen!.elements.map((e) => [e.id, e.startFrame, e.endFrame, e.zIndex])).toEqual([
      ['open', 0, 90, 0],
      ['lower-third', 60, 120, 1],
      ['end-card', 150, 240, 0],
    ]);
    // images are embedded so the thumbnail needs no server
    const logo = (seen!.elements[1]!.lottie.assets as AnyRecord[]).find((a) => a.id === 'image_0')!;
    expect(String(logo.p).startsWith('data:image/png;base64,')).toBe(true);
    expect(seen!.fonts[0]!.url.startsWith('data:font/ttf;base64,')).toBe(true);
  });

  it('a single-export handover becomes a one-element template under elements/<slug>/', async () => {
    const single = path.join(tmp, 'single');
    fs.cpSync(path.join(fixtureDir, '01-open'), single, { recursive: true });
    await run(single, { slug: 'solo', name: 'Solo' });
    const dir = path.join(templatesDir, 'solo');
    expect(fs.existsSync(path.join(dir, 'elements', 'solo', 'template.json'))).toBe(true);
    const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8')) as { elements: AnyRecord[] };
    expect(meta.elements).toEqual([{ slug: 'solo', name: 'Solo', type: 'overlay', startFrame: 0, endFrame: 90, zIndex: 0, durationInFrames: 90, fonts: ['IBM Plex Sans'] }]);
    const t = db.getTemplateBySlug('solo')!;
    expect(db.listTemplateElements(t.id)).toHaveLength(1);
  });

  it('re-ingesting removes elements that are no longer in the handover', async () => {
    await run(copyFixture(tmp));
    const input = copyFixture(path.join(tmp, 'b'), (dir) => {
      fs.rmSync(path.join(dir, '03-end-card'), { recursive: true });
      const manifest = (JSON.parse(fs.readFileSync(path.join(dir, 'elements.json'), 'utf8')) as AnyRecord[]).slice(0, 2);
      fs.writeFileSync(path.join(dir, 'elements.json'), JSON.stringify(manifest));
    });
    await run(input);
    const t = db.getTemplateBySlug('three')!;
    expect(db.listTemplateElements(t.id).map((e) => e.slug).sort()).toEqual(['lower-third', 'open']);
    expect(fs.existsSync(path.join(templatesDir, 'three', 'elements', 'end-card'))).toBe(false);
    expect(t.durationFrames).toBe(120);
  });
});

describe('thumbnailFrame', () => {
  it('is the middle frame when an element covers it', () => {
    expect(thumbnailFrame([{ startFrame: 0, endFrame: 150 }], 150)).toBe(75);
  });
  it('prefers the busiest moment, nearest the middle, and never a gap', () => {
    const elements = [
      { startFrame: 0, endFrame: 90 },
      { startFrame: 60, endFrame: 120 },
      { startFrame: 150, endFrame: 240 },
    ];
    expect(thumbnailFrame(elements, 240)).toBe(89);
    expect(thumbnailFrame([{ startFrame: 0, endFrame: 30 }, { startFrame: 200, endFrame: 240 }], 240)).toBe(200);
  });
});

describe('ingestTemplate: reference render (M19)', () => {
  it('copies reference.mp4 from the handover into the template directory when present', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-ref-'));
    const templatesDir = path.join(tmp, 'templates');
    const fontsDir = path.join(tmp, 'fonts');
    fs.mkdirSync(fontsDir, { recursive: true });
    fs.writeFileSync(path.join(fontsDir, 'IBMPlexSans-Regular.ttf'), 'plex');
    const db = openDb(':memory:');
    const input = copyFixture(tmp, (dir) => fs.writeFileSync(path.join(dir, 'reference.mp4'), 'mp4-bytes'));
    await ingestTemplate({ input, adType: 'Contrast', name: 'Three Part', slug: 'three', templatesDir, fontsDir, db, renderThumbnail: fakeThumbnail });
    expect(fs.readFileSync(path.join(templatesDir, 'three', 'reference.mp4'), 'utf8')).toBe('mp4-bytes');
    const meta = JSON.parse(fs.readFileSync(path.join(templatesDir, 'three', 'meta.json'), 'utf8')) as { reference?: string };
    expect(meta.reference).toBe('reference.mp4');
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});

describe('ingestTemplate: font faces and the comp background (M27, found by the first real template)', () => {
  let tmp: string;
  let templatesDir: string;
  let fontsDir: string;
  let db: Db;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-faces-'));
    templatesDir = path.join(tmp, 'templates');
    fontsDir = path.join(tmp, 'fonts');
    fs.mkdirSync(fontsDir, { recursive: true });
    fs.writeFileSync(path.join(fontsDir, 'IBMPlexSans-Regular.ttf'), 'plex');
    db = openDb(':memory:');
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  const run = (input: string) =>
    ingestTemplate({ input, adType: 'Contrast', name: 'Faces', slug: 'faces', templatesDir, fontsDir, db, renderThumbnail: fakeThumbnail });

  /** Give the open comp's headline a Bold face while the lower third stays Regular. */
  const twoFaces = (dir: string) =>
    editLottie(dir, '01-open', (l) => {
      (l.fonts as { list: AnyRecord[] }).list = [{ fName: 'IBMPlexSans-Bold', fFamily: 'IBM Plex Sans', fStyle: 'Bold', ascent: 74.5 }];
      ((l.layers as AnyRecord[])[0]!.t as { d: { k: { s: { f: string } }[] } }).d.k[0]!.s.f = 'IBMPlexSans-Bold';
    });

  it('ships one file per family AND style, each with its style in meta', async () => {
    fs.writeFileSync(path.join(fontsDir, 'IBMPlexSans-Bold.ttf'), 'plex-bold');
    await run(copyFixture(tmp, twoFaces));
    const meta = JSON.parse(fs.readFileSync(path.join(templatesDir, 'faces', 'meta.json'), 'utf8')) as { fonts: string[]; fontFiles: AnyRecord[] };
    expect(meta.fonts).toEqual(['IBM Plex Sans']);
    expect(meta.fontFiles).toEqual([
      { family: 'IBM Plex Sans', style: 'Bold', file: 'IBMPlexSans-Bold.ttf' },
      { family: 'IBM Plex Sans', style: 'Regular', file: 'IBMPlexSans-Regular.ttf' },
    ]);
    expect(fs.existsSync(path.join(templatesDir, 'faces', 'fonts', 'IBMPlexSans-Bold.ttf'))).toBe(true);
    expect(fs.existsSync(path.join(templatesDir, 'faces', 'fonts', 'IBMPlexSans-Regular.ttf'))).toBe(true);
  });

  it('fails naming the family, the style and the element when a face has no file, even though the regular file exists', async () => {
    const input = copyFixture(tmp, twoFaces);
    await expect(run(input)).rejects.toThrow(/"IBM Plex Sans" style "Bold".*"open"/s);
    expect(fs.existsSync(path.join(templatesDir, 'faces'))).toBe(false);
  });

  it('reads the comp background from the object form of elements.json and rejects a bad colour', async () => {
    const withBackground = (dir: string, value: unknown) => {
      const list = JSON.parse(fs.readFileSync(path.join(dir, 'elements.json'), 'utf8')) as unknown[];
      fs.writeFileSync(path.join(dir, 'elements.json'), JSON.stringify({ background: value, elements: list }));
    };
    await run(copyFixture(tmp, (dir) => withBackground(dir, '#0f1729')));
    const meta = JSON.parse(fs.readFileSync(path.join(templatesDir, 'faces', 'meta.json'), 'utf8')) as { background?: string; elements: unknown[] };
    expect(meta.background).toBe('#0F1729');
    expect(meta.elements).toHaveLength(3);

    await expect(run(copyFixture(path.join(tmp, 'b'), (dir) => withBackground(dir, 'navy')))).rejects.toThrow(/background.*#rrggbb/);
  });

  it('leaves the background out when the manifest is the plain list', async () => {
    await run(copyFixture(tmp));
    const meta = JSON.parse(fs.readFileSync(path.join(templatesDir, 'faces', 'meta.json'), 'utf8')) as { background?: string };
    expect(meta.background).toBeUndefined();
  });
});

describe('ingestTemplate: element types (M31)', () => {
  let tmp: string;
  let templatesDir: string;
  let fontsDir: string;
  let db: Db;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-types-'));
    templatesDir = path.join(tmp, 'templates');
    fontsDir = path.join(tmp, 'fonts');
    fs.mkdirSync(fontsDir, { recursive: true });
    fs.writeFileSync(path.join(fontsDir, 'IBMPlexSans-Regular.ttf'), 'plex');
    db = openDb(':memory:');
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  const run = (input: string) => ingestTemplate({ input, adType: 'Contrast', name: 'Three Part', slug: 'three', templatesDir, fontsDir, db, renderThumbnail: fakeThumbnail });

  it('infers each element type from its slug when the manifest is silent, and records it in meta and the database', async () => {
    await run(copyFixture(tmp));
    const meta = JSON.parse(fs.readFileSync(path.join(templatesDir, 'three', 'meta.json'), 'utf8')) as { elements: { slug: string; type: string }[] };
    expect(meta.elements.map((e) => [e.slug, e.type])).toEqual([
      ['open', 'open'],
      ['lower-third', 'lower-third'],
      ['end-card', 'end-card'],
    ]);
    const template = db.listTemplates()[0]!;
    expect(db.listTemplateElements(template.id).map((e) => [e.slug, e.type]).sort()).toEqual([
      ['end-card', 'end-card'],
      ['lower-third', 'lower-third'],
      ['open', 'open'],
    ]);
  });

  it('keeps an explicit type from the manifest', async () => {
    const input = copyFixture(tmp, (dir) => {
      const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'elements.json'), 'utf8')) as { slug: string; type?: string }[];
      manifest[1]!.type = 'caption';
      fs.writeFileSync(path.join(dir, 'elements.json'), JSON.stringify(manifest));
    });
    await run(input);
    const meta = JSON.parse(fs.readFileSync(path.join(templatesDir, 'three', 'meta.json'), 'utf8')) as { elements: { slug: string; type: string }[] };
    expect(meta.elements.find((e) => e.slug === 'lower-third')!.type).toBe('caption');
  });

  it('rejects an unknown type naming the element and the allowed list, and writes nothing', async () => {
    const input = copyFixture(tmp, (dir) => {
      const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'elements.json'), 'utf8')) as { slug: string; type?: string }[];
      manifest[0]!.type = 'banner';
      fs.writeFileSync(path.join(dir, 'elements.json'), JSON.stringify(manifest));
    });
    await expect(run(input)).rejects.toMatchObject({ problems: [expect.stringMatching(/Element "open".*type "banner".*lower-third/)] });
    expect(fs.existsSync(path.join(templatesDir, 'three'))).toBe(false);
  });
});

/**
 * M36: a designer may hand over a variant of an element for another ratio
 * (`variants` in elements.json, one export folder per ratio). It ships
 * beside the element with the same tags, so the same values apply.
 */
describe('ingestTemplate: aspect variants (M36)', () => {
  let tmp: string;
  let templatesDir: string;
  let fontsDir: string;
  let db: Db;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-variants-'));
    templatesDir = path.join(tmp, 'templates');
    fontsDir = path.join(tmp, 'fonts');
    fs.mkdirSync(fontsDir, { recursive: true });
    fs.writeFileSync(path.join(fontsDir, 'IBMPlexSans-Regular.ttf'), 'plex');
    db = openDb(':memory:');
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  const run = (input: string) => ingestTemplate({ input, adType: 'Contrast', name: 'Three Part', slug: 'three', templatesDir, fontsDir, db, renderThumbnail: fakeThumbnail });

  /** A 9:16 variant of the open: the same export, resized to 1080x1920. */
  const withVariant = (dir: string, mutateVariant?: (l: AnyRecord) => void, manifestVariant: Record<string, string> = { '9:16': '01-open-9x16' }) => {
    fs.cpSync(path.join(dir, '01-open'), path.join(dir, '01-open-9x16'), { recursive: true });
    editLottie(dir, '01-open-9x16', (l) => {
      l.w = 1080;
      l.h = 1920;
      mutateVariant?.(l);
    });
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'elements.json'), 'utf8')) as AnyRecord[];
    manifest[0]!.variants = manifestVariant;
    fs.writeFileSync(path.join(dir, 'elements.json'), JSON.stringify(manifest));
  };

  it('ships a 9:16 variant beside the element with its own Lottie and schema, and records it in meta', async () => {
    await run(copyFixture(tmp, (dir) => withVariant(dir)));
    const variantDir = path.join(templatesDir, 'three', 'elements', 'open', 'variants', '9x16');
    expect(fs.existsSync(path.join(variantDir, 'template.json'))).toBe(true);
    expect(fs.existsSync(path.join(variantDir, 'schema.json'))).toBe(true);
    const lottie = JSON.parse(fs.readFileSync(path.join(variantDir, 'template.json'), 'utf8')) as AnyRecord;
    expect([lottie.w, lottie.h]).toEqual([1080, 1920]);
    const meta = JSON.parse(fs.readFileSync(path.join(templatesDir, 'three', 'meta.json'), 'utf8')) as { elements: { slug: string; variants?: string[] }[] };
    expect(meta.elements.find((e) => e.slug === 'open')!.variants).toEqual(['9:16']);
    expect(meta.elements.find((e) => e.slug === 'lower-third')!.variants).toBeUndefined();
  });

  it('rejects a variant whose size is not the ratio\'s frame, naming the element and the ratio', async () => {
    const input = copyFixture(tmp, (dir) => withVariant(dir, (l) => (l.h = 1900)));
    await expect(run(input)).rejects.toMatchObject({ problems: [expect.stringMatching(/Element "open".*9:16.*1080x1900.*1080x1920/)] });
  });

  it('rejects a variant whose tags differ from the master, and an unknown ratio', async () => {
    const dropped = copyFixture(tmp, (dir) => withVariant(dir, (l) => ((l.layers as AnyRecord[]).find((x) => x.nm === 'cc.headline')!.nm = 'plain')));
    await expect(run(dropped)).rejects.toMatchObject({ problems: [expect.stringMatching(/Element "open".*9:16.*headline/)] });
    const unknown = copyFixture(tmp, (dir) => withVariant(dir, undefined, { '2:3': '01-open-9x16' }));
    await expect(run(unknown)).rejects.toMatchObject({ problems: [expect.stringMatching(/Element "open".*"2:3".*16:9, 1:1, 4:5, 9:16/)] });
  });
});
