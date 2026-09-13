import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app';
import { openDb, type Db } from './db/index';
import { buildProjectProps, buildTemplateDefaultProps } from './renderProject';

const lottie = {
  fr: 30, ip: 0, op: 30, w: 1920, h: 1080,
  assets: [{ id: 'image_0', w: 100, h: 50, u: 'images/', p: 'logo.png', e: 0 }],
  layers: [
    { ty: 5, nm: 'cc.headline', t: { d: { k: [{ s: { t: 'A', f: 'X', s: 10 }, t: 0 }] } } },
    { ty: 2, nm: 'cc.logo', refId: 'image_0' },
    { ty: 1, nm: 'cc.mediaFill', sw: 960, sh: 1080, ks: { o: { a: 0, k: 100 }, p: { a: 0, k: [1440, 540, 0] }, a: { a: 0, k: [480, 540, 0] }, s: { a: 0, k: [100, 100, 100] } } },
  ],
};
const schema = [
  { key: 'headline', role: 'headline', kind: 'text', label: 'Headline', default: 'A', path: '/layers/0' },
  { key: 'logo', role: 'logo', kind: 'image', label: 'Logo', default: 'images/logo.png', path: '/assets/0' },
  { key: 'mediaFill', role: 'mediaFill', kind: 'media', label: 'Footage', default: null, path: '/layers/2' },
];

describe('buildProjectProps (server-side runner)', () => {
  let tmp: string;
  let db: Db;
  let projectId: number;
  let elementId: number;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-rp-'));
    fs.mkdirSync(path.join(tmp, 'templates', 't'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'templates', 't', 'template.json'), JSON.stringify(lottie));
    fs.writeFileSync(path.join(tmp, 'templates', 't', 'schema.json'), JSON.stringify(schema));
    db = openDb(':memory:');
    const t = db.upsertTemplate({ slug: 't', name: 'T', adType: 'Bio', durationFrames: 30, fps: 30, width: 1920, height: 1080, thumbPath: '' });
    elementId = db.upsertTemplateElement({ templateId: t.id, slug: 't', zIndex: 0, startFrame: 0, endFrame: 30 }).id;
    const asset = db.insertMediaAsset({ originalName: 'r.mp4', originalPath: 'originals/1-r.mp4', proxyPath: 'proxies/1.mp4', thumbPath: 'thumbs/1.jpg', width: 1920, height: 1080, durationS: 5, fps: 30 });
    projectId = db.createProject({
      templateId: t.id,
      name: 'P',
      values: [
        { elementId, key: 'headline', value: 'VOTE' },
        { elementId, key: 'logo', value: '/media/images/new-logo.png' },
        { elementId, key: 'mediaFill', value: { assetId: asset.id, fit: 'contain' } },
      ],
    }).id;
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('resolves footage to the ORIGINAL at an absolute server URL, and the logo likewise', () => {
    const props = buildProjectProps({ db, templatesDir: path.join(tmp, 'templates'), projectId, serverBase: 'http://127.0.0.1:3001' });
    expect(props.media).toEqual({
      src: 'http://127.0.0.1:3001/media/originals/1-r.mp4',
      rect: { x: 0.5, y: 0, w: 0.5, h: 1 },
      fit: 'contain',
      key: null,
      muted: false,
    });
    const lottie = props.elements[0]!.lottie;
    const asset = (lottie.assets as { p: string }[])[0]!;
    expect(asset.p).toBe('http://127.0.0.1:3001/media/images/new-logo.png');
    const text = (lottie.layers[0] as { t: { d: { k: { s: { t: string } }[] } } }).t.d.k[0]!.s.t;
    expect(text).toBe('VOTE');
    // the slot layer is transparent so the footage shows through
    expect((lottie.layers[2] as { ks: { o: { k: number } } }).ks.o.k).toBe(0);
    expect(props.elements[0]).toMatchObject({ startFrame: 0, endFrame: 30, enabled: true });
  });

  it('has no media when the project has no footage assigned', () => {
    db.setProjectValues(projectId, [{ elementId, key: 'mediaFill', value: null }]);
    const props = buildProjectProps({ db, templatesDir: path.join(tmp, 'templates'), projectId, serverBase: 'http://x' });
    expect(props.media).toBeNull();
  });

  it('throws naming the project when it does not exist', () => {
    expect(() => buildProjectProps({ db, templatesDir: tmp, projectId: 999, serverBase: 'http://x' })).toThrow(/999/);
  });
});

describe('POST /images', () => {
  let tmp: string;
  let db: Db;
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-img-'));
    db = openDb(':memory:');
    app = buildApp({ db, templatesDir: path.join(tmp, 'templates'), mediaDir: path.join(tmp, 'media') });
  });

  afterEach(async () => {
    await app.close();
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  function multipart(filename: string, bytes: Buffer, contentType: string) {
    const boundary = `----cc${Date.now()}`;
    const head = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`);
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
    return { payload: Buffer.concat([head, bytes, tail]), headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } };
  }

  it('stores an image under /media/images and returns its URL', async () => {
    const png = Buffer.from('89504e470d0a1a0a', 'hex');
    const { payload, headers } = multipart('Logo Final.PNG', png, 'image/png');
    const res = await app.inject({ method: 'POST', url: '/images', payload, headers });
    expect(res.statusCode).toBe(201);
    const { url } = res.json() as { url: string };
    expect(url).toMatch(/^\/media\/images\/.*\.png$/);
    expect(fs.existsSync(path.join(tmp, 'media', url.replace(/^\/media\//, '')))).toBe(true);
    const served = await app.inject({ method: 'GET', url, headers: { origin: 'http://localhost:5173' } });
    expect(served.statusCode).toBe(200);
    expect(served.headers['access-control-allow-origin']).toBeTruthy();
  });

  it('rejects a non-image', async () => {
    const { payload, headers } = multipart('clip.mp4', Buffer.from('x'), 'video/mp4');
    const res = await app.inject({ method: 'POST', url: '/images', payload, headers });
    expect(res.statusCode).toBe(400);
  });
});

describe('buildProjectProps: chroma key travels to the export runner', () => {
  it('passes the stored key through in media.key', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-rp-key-'));
    fs.mkdirSync(path.join(tmp, 't'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 't', 'template.json'), JSON.stringify(lottie));
    fs.writeFileSync(path.join(tmp, 't', 'schema.json'), JSON.stringify(schema));
    const db = openDb(':memory:');
    const t = db.upsertTemplate({ slug: 't', name: 'T', adType: 'Bio', durationFrames: 30, fps: 30, width: 1920, height: 1080, thumbPath: '' });
    const elementId = db.upsertTemplateElement({ templateId: t.id, slug: 't', zIndex: 0, startFrame: 0, endFrame: 30 }).id;
    const asset = db.insertMediaAsset({ originalName: 'g.mp4', originalPath: 'originals/g.mp4', proxyPath: 'proxies/g.mp4', thumbPath: 'thumbs/g.jpg', width: 1920, height: 1080, durationS: 2, fps: 25 });
    const projectId = db.createProject({
      templateId: t.id,
      name: 'P',
      values: [{ elementId, key: 'mediaFill', value: { assetId: asset.id, fit: 'cover', key: { color: 'green', threshold: 0.6, spill: 0.2 } } }],
    }).id;
    const props = buildProjectProps({ db, templatesDir: tmp, projectId, serverBase: 'http://x' });
    expect(props.media?.key).toEqual({ color: 'green', threshold: 0.6, spill: 0.2 });
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});

describe('buildProjectProps: multi-element templates (M17)', () => {
  const textLayer = (name: string, text: string) => ({ ty: 5, nm: name, t: { d: { k: [{ s: { t: text, f: 'X', s: 10 }, t: 0 }] } } });
  const openLottie = { fr: 30, ip: 0, op: 90, w: 1920, h: 1080, layers: [textLayer('cc.headline', 'OPEN')] };
  const endLottie = {
    fr: 30, ip: 0, op: 90, w: 1920, h: 1080,
    assets: [{ id: 'image_0', w: 100, h: 50, u: 'images/', p: 'logo.png', e: 0 }],
    layers: [
      textLayer('cc.headline', 'END'),
      { ty: 2, nm: 'cc.logo', refId: 'image_0' },
      { ty: 1, nm: 'cc.mediaFill', sw: 960, sh: 1080, ks: { o: { a: 0, k: 100 }, p: { a: 0, k: [1440, 540, 0] }, a: { a: 0, k: [480, 540, 0] }, s: { a: 0, k: [100, 100, 100] } } },
    ],
  };
  const openSchema = [{ key: 'headline', role: 'headline', kind: 'text', label: 'Headline', default: 'OPEN', path: '/layers/0' }];
  const endSchema = [
    { key: 'headline', role: 'headline', kind: 'text', label: 'Headline', default: 'END', path: '/layers/0' },
    { key: 'logo', role: 'logo', kind: 'image', label: 'Logo', default: 'images/logo.png', path: '/assets/0' },
    { key: 'mediaFill', role: 'mediaFill', kind: 'media', label: 'Footage', default: null, path: '/layers/2' },
  ];

  let tmp: string;
  let db: Db;
  let projectId: number;
  let openId: number;
  let endId: number;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-rp-multi-'));
    for (const [slug, lottie, schema] of [['open', openLottie, openSchema], ['end-card', endLottie, endSchema]] as const) {
      const dir = path.join(tmp, 'two', 'elements', slug);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'template.json'), JSON.stringify(lottie));
      fs.writeFileSync(path.join(dir, 'schema.json'), JSON.stringify(schema));
    }
    db = openDb(':memory:');
    const t = db.upsertTemplate({ slug: 'two', name: 'Two', adType: 'Bio', durationFrames: 180, fps: 30, width: 1920, height: 1080, thumbPath: '' });
    openId = db.upsertTemplateElement({ templateId: t.id, slug: 'open', name: 'Open', zIndex: 0, startFrame: 0, endFrame: 90 }).id;
    endId = db.upsertTemplateElement({ templateId: t.id, slug: 'end-card', name: 'End card', zIndex: 0, startFrame: 90, endFrame: 180 }).id;
    const asset = db.insertMediaAsset({ originalName: 'r.mp4', originalPath: 'originals/r.mp4', proxyPath: 'proxies/r.mp4', thumbPath: 'thumbs/r.jpg', width: 1920, height: 1080, durationS: 5, fps: 30 });
    projectId = db.createProject({
      templateId: t.id,
      name: 'P',
      values: [
        { elementId: openId, key: 'headline', value: 'OPEN EDITED' },
        { elementId: endId, key: 'headline', value: 'END EDITED' },
        { elementId: endId, key: 'logo', value: 'images/logo.png' },
        { elementId: endId, key: 'mediaFill', value: { assetId: asset.id, fit: 'cover' } },
      ],
    }).id;
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  const headlineOf = (lottie: { layers: unknown[] }) => (lottie.layers[0] as { t: { d: { k: { s: { t: string } }[] } } }).t.d.k[0]!.s.t;

  it('gives every element its own Lottie with its own values applied, in the DB order', () => {
    const props = buildProjectProps({ db, templatesDir: tmp, projectId, serverBase: 'http://x' });
    expect(props.elements.map((e) => [e.id, e.startFrame, e.endFrame])).toEqual([
      [String(openId), 0, 90],
      [String(endId), 90, 180],
    ]);
    expect(headlineOf(props.elements[0]!.lottie)).toBe('OPEN EDITED');
    expect(headlineOf(props.elements[1]!.lottie)).toBe('END EDITED');
  });

  it('resolves an element\'s own images against its element directory', () => {
    const props = buildProjectProps({ db, templatesDir: tmp, projectId, serverBase: 'http://x' });
    const asset = (props.elements[1]!.lottie.assets as { u: string; p: string }[])[0]!;
    expect(`${asset.u}${asset.p}`).toBe('http://x/templates/two/elements/end-card/images/logo.png');
  });

  it('takes the footage from the element that has a media slot and a clip chosen', () => {
    const props = buildProjectProps({ db, templatesDir: tmp, projectId, serverBase: 'http://x' });
    expect(props.media).toMatchObject({ src: 'http://x/media/originals/r.mp4', rect: { x: 0.5, y: 0, w: 0.5, h: 1 }, fit: 'cover' });
    // the slot layer in THAT element is made transparent
    expect((props.elements[1]!.lottie.layers[2] as { ks: { o: { k: number } } }).ks.o.k).toBe(0);
  });
});

describe('buildTemplateDefaultProps: the template as authored, no project (M19)', () => {
  it('carries every element with its schema defaults applied', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-tdp-'));
    const textLayer = (name: string, text: string) => ({ ty: 5, nm: name, t: { d: { k: [{ s: { t: text, f: 'X', s: 10 }, t: 0 }] } } });
    for (const [slug, text] of [['open', 'AUTHORED OPEN'], ['end-card', 'AUTHORED END']] as const) {
      const dir = path.join(tmp, 'two', 'elements', slug);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'template.json'), JSON.stringify({ fr: 30, ip: 0, op: 90, w: 1920, h: 1080, layers: [textLayer('cc.headline', 'placeholder')] }));
      fs.writeFileSync(path.join(dir, 'schema.json'), JSON.stringify([{ key: 'headline', role: 'headline', kind: 'text', label: 'Headline', default: text, path: '/layers/0' }]));
    }
    const db = openDb(':memory:');
    const t = db.upsertTemplate({ slug: 'two', name: 'Two', adType: 'Bio', durationFrames: 180, fps: 30, width: 1920, height: 1080, thumbPath: '' });
    db.upsertTemplateElement({ templateId: t.id, slug: 'open', name: 'Open', zIndex: 0, startFrame: 0, endFrame: 90 });
    db.upsertTemplateElement({ templateId: t.id, slug: 'end-card', name: 'End card', zIndex: 0, startFrame: 90, endFrame: 180 });

    const props = buildTemplateDefaultProps({ db, templatesDir: tmp, slug: 'two', serverBase: 'http://x' });
    const headlineOf = (lottie: { layers: unknown[] }) => (lottie.layers[0] as { t: { d: { k: { s: { t: string } }[] } } }).t.d.k[0]!.s.t;
    expect(props.elements.map((e) => [e.id, e.startFrame, e.endFrame, headlineOf(e.lottie)])).toEqual([
      ['open', 0, 90, 'AUTHORED OPEN'],
      ['end-card', 90, 180, 'AUTHORED END'],
    ]);
    expect(props.media).toBeNull();
    expect(() => buildTemplateDefaultProps({ db, templatesDir: tmp, slug: 'nope', serverBase: 'http://x' })).toThrow(/nope/);
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
