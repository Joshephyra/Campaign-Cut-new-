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
      { slug: 'open', name: 'Open', startFrame: 0, endFrame: 90, zIndex: 0, durationInFrames: 90, fonts: ['IBM Plex Sans'] },
      { slug: 'lower-third', name: 'Lower third', startFrame: 60, endFrame: 120, zIndex: 1, durationInFrames: 60, fonts: ['IBM Plex Sans'] },
      { slug: 'end-card', name: 'End card', startFrame: 150, endFrame: 240, zIndex: 0, durationInFrames: 90, fonts: ['IBM Plex Sans'] },
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
    expect(meta.fontFiles).toEqual([{ family: 'IBM Plex Sans', file: 'IBMPlexSans-Regular.ttf' }]);

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
    expect(meta.elements).toEqual([{ slug: 'solo', name: 'Solo', startFrame: 0, endFrame: 90, zIndex: 0, durationInFrames: 90, fonts: ['IBM Plex Sans'] }]);
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
