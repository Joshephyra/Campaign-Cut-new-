import type { LottieAnimationData } from '@campaigncut/composition';
import { openDb, type Db } from '@campaigncut/server/db';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IngestFailure, ingestTemplate, slugify, type ThumbnailRenderer } from './ingest';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.resolve(here, '..', 'fixtures', 'standin');

type AnyRecord = Record<string, unknown>;

/** Copy the stand-in handover folder into a temp dir, optionally mutating the Lottie. */
function makeHandover(tmp: string, mutate?: (lottie: LottieAnimationData) => void): string {
  const dir = path.join(tmp, 'handover');
  fs.mkdirSync(dir, { recursive: true });
  const lottie = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'data.json'), 'utf8')) as LottieAnimationData;
  mutate?.(lottie);
  fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify(lottie));
  return dir;
}

/** A stand-in for the Remotion thumbnail render: writes a tiny file. */
const fakeThumbnail = async ({ outputPath }: { outputPath: string }) => {
  fs.writeFileSync(outputPath, 'PNG');
};

describe('ingestTemplate', () => {
  let tmp: string;
  let templatesDir: string;
  let fontsDir: string;
  let db: Db;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-ingest-'));
    templatesDir = path.join(tmp, 'templates');
    fontsDir = path.join(tmp, 'fonts');
    fs.mkdirSync(fontsDir, { recursive: true });
    fs.writeFileSync(path.join(fontsDir, 'IBMPlexSans-Regular.ttf'), 'x');
    db = openDb(':memory:');
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  const run = (input: string, overrides: Partial<Parameters<typeof ingestTemplate>[0]> = {}) =>
    ingestTemplate({
      input,
      adType: 'Contrast',
      name: 'Stand-in',
      slug: 'standin',
      templatesDir,
      fontsDir,
      db,
      renderThumbnail: fakeThumbnail,
      ...overrides,
    });

  // T1
  it('a valid handover produces template.json, schema.json, meta.json, thumb.png and one DB row', async () => {
    const result = await run(makeHandover(tmp));
    const dir = path.join(templatesDir, 'standin');
    expect(result.dir).toBe(dir);
    for (const f of ['elements/standin/template.json', 'elements/standin/schema.json', 'meta.json', 'thumb.png']) {
      expect(fs.existsSync(path.join(dir, f)), f).toBe(true);
    }
    const schema = JSON.parse(fs.readFileSync(path.join(dir, 'elements', 'standin', 'schema.json'), 'utf8')) as AnyRecord[];
    expect(schema.map((p) => p.key).sort()).toEqual(['accent', 'disclaimer', 'headline', 'headline.transform', 'logo', 'logo.transform', 'mediaFill', 'surface']);

    const rows = db.listTemplates();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ slug: 'standin', name: 'Stand-in', adType: 'Contrast', fps: 30, width: 1920, height: 1080, durationFrames: 150 });
    expect(result.report).toHaveLength(6);
  });

  // T5
  it('meta.json has every field present and non-zero', async () => {
    await run(makeHandover(tmp));
    const meta = JSON.parse(fs.readFileSync(path.join(templatesDir, 'standin', 'meta.json'), 'utf8')) as AnyRecord;
    expect(meta).toMatchObject({
      slug: 'standin',
      name: 'Stand-in',
      adType: 'Contrast',
      durationInFrames: 150,
      fps: 30,
      width: 1920,
      height: 1080,
      fonts: ['IBM Plex Sans'],
    });
  });

  // T2
  it('fails naming the font when a referenced font has no file', async () => {
    fs.rmSync(path.join(fontsDir, 'IBMPlexSans-Regular.ttf'));
    const input = makeHandover(tmp);
    await expect(run(input)).rejects.toThrow(IngestFailure);
    await expect(run(input)).rejects.toThrow(/IBM Plex Sans/);
    expect(fs.existsSync(path.join(templatesDir, 'standin'))).toBe(false);
    expect(db.listTemplates()).toHaveLength(0);
  });

  it('copies font files handed over in the export folder into the fonts dir', async () => {
    fs.rmSync(path.join(fontsDir, 'IBMPlexSans-Regular.ttf'));
    const input = makeHandover(tmp);
    fs.mkdirSync(path.join(input, 'fonts'));
    fs.writeFileSync(path.join(input, 'fonts', 'IBMPlexSans-Regular.ttf'), 'font-bytes');
    await run(input);
    expect(fs.readFileSync(path.join(fontsDir, 'IBMPlexSans-Regular.ttf'), 'utf8')).toBe('font-bytes');
  });

  // T3
  it('fails naming the layer when a tag is unknown', async () => {
    const input = makeHandover(tmp, (l) => {
      (l.layers[1] as AnyRecord).nm = 'cc.tagline';
    });
    await expect(run(input)).rejects.toThrow(/cc\.tagline/);
    expect(fs.existsSync(path.join(templatesDir, 'standin'))).toBe(false);
  });

  // T4
  it('ingesting twice updates the row instead of duplicating it', async () => {
    await run(makeHandover(tmp));
    await run(makeHandover(tmp), { name: 'Stand-in v2' });
    const rows = db.listTemplates();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.name).toBe('Stand-in v2');
  });

  it('copies an images folder alongside the template', async () => {
    const input = makeHandover(tmp);
    fs.mkdirSync(path.join(input, 'images'));
    fs.writeFileSync(path.join(input, 'images', 'logo.png'), 'img');
    await run(input);
    expect(fs.existsSync(path.join(templatesDir, 'standin', 'elements', 'standin', 'images', 'logo.png'))).toBe(true);
  });

  it('rejects a Lottie with zero dimensions, naming the field', async () => {
    const input = makeHandover(tmp, (l) => {
      l.w = 0;
    });
    await expect(run(input)).rejects.toThrow(/width/);
  });

  it('accepts a path to the JSON file itself as well as a folder', async () => {
    const input = makeHandover(tmp);
    await run(path.join(input, 'data.json'));
    expect(db.listTemplates()).toHaveLength(1);
  });
});

// T6
describe('slugify', () => {
  it('lower-cases and hyphenates', () => {
    expect(slugify('Contrast :30 / Split Record')).toBe('contrast-30-split-record');
    expect(slugify('  Bio  ')).toBe('bio');
    expect(slugify('GOTV!!')).toBe('gotv');
  });
});

describe('ingestTemplate: shipping fonts with the template (M13)', () => {
  let tmp: string;
  let templatesDir: string;
  let fontsDir: string;
  let db: Db;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-ingest-fonts-'));
    templatesDir = path.join(tmp, 'templates');
    fontsDir = path.join(tmp, 'fonts');
    fs.mkdirSync(fontsDir, { recursive: true });
    fs.writeFileSync(path.join(fontsDir, 'IBMPlexSans-Regular.ttf'), 'plex-bytes');
    db = openDb(':memory:');
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('copies every referenced font file into templates/<slug>/fonts and lists it in meta.fontFiles', async () => {
    await ingestTemplate({
      input: makeHandover(tmp),
      adType: 'Contrast',
      name: 'Stand-in',
      slug: 'standin',
      templatesDir,
      fontsDir,
      db,
      renderThumbnail: fakeThumbnail,
    });
    const shipped = path.join(templatesDir, 'standin', 'fonts', 'IBMPlexSans-Regular.ttf');
    expect(fs.existsSync(shipped)).toBe(true);
    expect(fs.readFileSync(shipped, 'utf8')).toBe('plex-bytes');
    const meta = JSON.parse(fs.readFileSync(path.join(templatesDir, 'standin', 'meta.json'), 'utf8')) as AnyRecord;
    expect(meta.fonts).toEqual(['IBM Plex Sans']);
    expect(meta.fontFiles).toEqual([{ family: 'IBM Plex Sans', style: 'Regular', file: 'IBMPlexSans-Regular.ttf' }]);
  });
});

describe('ingestTemplate: thumbnail render gets embedded fonts and images', () => {
  it('hands the thumbnail renderer data-URI fonts and data-URI images (no server needed at ingest time)', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-ingest-thumb-'));
    const templatesDir = path.join(tmp, 'templates');
    const fontsDir = path.join(tmp, 'fonts');
    fs.mkdirSync(fontsDir, { recursive: true });
    fs.writeFileSync(path.join(fontsDir, 'IBMPlexSans-Regular.ttf'), 'plex-bytes');
    const input = makeHandover(tmp);
    fs.mkdirSync(path.join(input, 'images'));
    fs.writeFileSync(path.join(input, 'images', 'logo.png'), Buffer.from('89504e47', 'hex'));
    const db = openDb(':memory:');
    let seen: Parameters<ThumbnailRenderer>[0] | undefined;
    await ingestTemplate({
      input,
      adType: 'Contrast',
      name: 'Stand-in',
      slug: 'standin',
      templatesDir,
      fontsDir,
      db,
      renderThumbnail: async (opts) => {
        seen = opts;
        await fakeThumbnail(opts);
      },
    });
    expect(seen!.fonts).toEqual([{ family: 'IBM Plex Sans', style: 'Regular', url: `data:font/ttf;base64,${Buffer.from('plex-bytes').toString('base64')}` }]);
    expect(seen!.elements.map((e) => [e.id, e.startFrame, e.endFrame])).toEqual([['standin', 0, 150]]);
    const logo = (seen!.elements[0]!.lottie.assets as AnyRecord[]).find((a) => a.id === 'image_0')!;
    expect(logo.e).toBe(1);
    expect(logo.u).toBe('');
    expect(String(logo.p).startsWith('data:image/png;base64,')).toBe(true);
    // the template on disk is untouched: it still references images/logo.png
    const written = JSON.parse(fs.readFileSync(path.join(templatesDir, 'standin', 'elements', 'standin', 'template.json'), 'utf8')) as { assets: AnyRecord[] };
    expect(written.assets.find((a) => a.id === 'image_0')).toMatchObject({ u: 'images/', p: 'logo.png' });
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
