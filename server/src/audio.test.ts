import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app';
import { openDb, type Db } from './db/index';
import { findBinary } from './media/ffmpeg';
import { buildProjectProps } from './renderProject';

/**
 * M20: audio uploads become media assets of kind "audio"; a project can
 * carry one music bed (project_audio); footage can be trimmed and muted.
 * The export runner carries all of it in the composition's props.
 */
function ffmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(findBinary('ffmpeg'), ['-y', '-v', 'error', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    child.stderr.on('data', (d: Buffer) => (err += d.toString()));
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(err))));
  });
}

function multipart(filename: string, bytes: Buffer, contentType: string) {
  const boundary = `----cc${Date.now()}`;
  const head = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`);
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return { payload: Buffer.concat([head, bytes, tail]), headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } };
}

const lottie = {
  fr: 30, ip: 0, op: 60, w: 1920, h: 1080,
  layers: [{ ty: 1, nm: 'cc.mediaFill', sw: 960, sh: 1080, ks: { o: { a: 0, k: 100 }, p: { a: 0, k: [1440, 540, 0] }, a: { a: 0, k: [480, 540, 0] }, s: { a: 0, k: [100, 100, 100] } } }],
};
const schema = [{ key: 'mediaFill', role: 'mediaFill', kind: 'media', label: 'Footage', default: null, path: '/layers/0' }];

describe('audio uploads and the music bed (M20)', () => {
  let fixtures: string;
  let wav: string;
  let tmp: string;
  let db: Db;
  let app: ReturnType<typeof buildApp>;
  let projectId: number;
  let elementId: number;

  beforeAll(async () => {
    fixtures = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-audio-fx-'));
    wav = path.join(fixtures, 'bed.wav');
    await ffmpeg(['-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', wav]);
  }, 60_000);

  afterAll(() => fs.rmSync(fixtures, { recursive: true, force: true }));

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-audio-'));
    fs.mkdirSync(path.join(tmp, 'templates', 't'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'templates', 't', 'template.json'), JSON.stringify(lottie));
    fs.writeFileSync(path.join(tmp, 'templates', 't', 'schema.json'), JSON.stringify(schema));
    db = openDb(':memory:');
    const t = db.upsertTemplate({ slug: 't', name: 'T', adType: 'Bio', durationFrames: 60, fps: 30, width: 1920, height: 1080, thumbPath: '' });
    elementId = db.upsertTemplateElement({ templateId: t.id, slug: 't', zIndex: 0, startFrame: 0, endFrame: 60 }).id;
    app = buildApp({ db, templatesDir: path.join(tmp, 'templates'), mediaDir: path.join(tmp, 'media'), serverBase: 'http://x' });
    projectId = ((await app.inject({ method: 'POST', url: '/projects', payload: { templateSlug: 't' } })).json() as { id: number }).id;
  });

  afterEach(async () => {
    await app.close();
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  async function uploadWav() {
    const { payload, headers } = multipart('bed.wav', fs.readFileSync(wav), 'audio/wav');
    const res = await app.inject({ method: 'POST', url: '/media', payload, headers });
    expect(res.statusCode).toBe(201);
    return res.json() as { id: number; kind: string; durationS: number; originalUrl: string; proxyUrl: string; thumbUrl: string; width: number };
  }

  it('an uploaded wav becomes an asset of kind audio with its duration, no proxy and no poster', async () => {
    const a = await uploadWav();
    expect(a.kind).toBe('audio');
    expect(a.durationS).toBeCloseTo(2, 0);
    expect(a.width).toBe(0);
    expect(a.originalUrl).toMatch(/^\/media\/originals\/.*\.wav$/);
    expect(a.proxyUrl).toBe(a.originalUrl); // both runners play the original
    expect(a.thumbUrl).toBeNull();
    const served = await app.inject({ method: 'GET', url: a.originalUrl });
    expect(served.statusCode).toBe(200);
    expect(fs.existsSync(path.join(tmp, 'media', 'proxies'))).toBe(true);
    expect(fs.readdirSync(path.join(tmp, 'media', 'proxies'))).toHaveLength(0);
    const list = (await app.inject({ method: 'GET', url: '/media' })).json() as { kind: string }[];
    expect(list.map((x) => x.kind)).toEqual(['audio']);
  });

  it('still rejects a file that is neither video nor audio', async () => {
    const { payload, headers } = multipart('notes.txt', Buffer.from('hello'), 'text/plain');
    const res = await app.inject({ method: 'POST', url: '/media', payload, headers });
    expect(res.statusCode).toBe(400);
  });

  it('a project starts with no music bed; PUT sets it, GET returns it, null clears it', async () => {
    const a = await uploadWav();
    let detail = (await app.inject({ method: 'GET', url: `/projects/${projectId}` })).json() as { audio: unknown };
    expect(detail.audio).toBeNull();

    const put = await app.inject({ method: 'PUT', url: `/projects/${projectId}/audio`, payload: { assetId: a.id, volume: 0.4, inS: 1.5 } });
    expect(put.statusCode).toBe(200);
    expect(put.json()).toEqual({ assetId: a.id, volume: 0.4, inS: 1.5 });
    detail = (await app.inject({ method: 'GET', url: `/projects/${projectId}` })).json() as { audio: unknown };
    expect(detail.audio).toEqual({ assetId: a.id, volume: 0.4, inS: 1.5 });

    const clear = await app.inject({ method: 'PUT', url: `/projects/${projectId}/audio`, payload: { assetId: null } });
    expect(clear.statusCode).toBe(200);
    expect(clear.json()).toBeNull();
    detail = (await app.inject({ method: 'GET', url: `/projects/${projectId}` })).json() as { audio: unknown };
    expect(detail.audio).toBeNull();
  });

  it('refuses a video asset as the music bed, an unknown asset, and a bad volume', async () => {
    const video = db.insertMediaAsset({ originalName: 'v.mp4', originalPath: 'originals/v.mp4', proxyPath: 'proxies/v.mp4', thumbPath: 'thumbs/v.jpg', width: 1920, height: 1080, durationS: 5, fps: 30 });
    expect((await app.inject({ method: 'PUT', url: `/projects/${projectId}/audio`, payload: { assetId: video.id } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'PUT', url: `/projects/${projectId}/audio`, payload: { assetId: 999 } })).statusCode).toBe(404);
    const a = await uploadWav();
    expect((await app.inject({ method: 'PUT', url: `/projects/${projectId}/audio`, payload: { assetId: a.id, volume: 7 } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'PUT', url: `/projects/999/audio`, payload: { assetId: a.id } })).statusCode).toBe(404);
  });

  it('the export runner carries the trim and mute on the footage and the music bed at an absolute URL', async () => {
    const a = await uploadWav();
    const clip = db.insertMediaAsset({ originalName: 'v.mp4', originalPath: 'originals/v.mp4', proxyPath: 'proxies/v.mp4', thumbPath: 'thumbs/v.jpg', width: 1920, height: 1080, durationS: 10, fps: 30 });
    db.setProjectValues(projectId, [{ elementId, key: 'mediaFill', value: { assetId: clip.id, fit: 'cover', inS: 1.5, outS: 4, muted: true } }]);
    await app.inject({ method: 'PUT', url: `/projects/${projectId}/audio`, payload: { assetId: a.id, volume: 0.4, inS: 1 } });

    const props = buildProjectProps({ db, templatesDir: path.join(tmp, 'templates'), projectId, serverBase: 'http://x' });
    expect(props.elements[0]!.media).toMatchObject({ src: 'http://x/media/originals/v.mp4', startFrom: 45, endAt: 120, muted: true });
    expect(props.audio).toEqual({ src: `http://x${a.originalUrl}`, volume: 0.4, startFrom: 30 });

    const preview = buildProjectProps({ db, templatesDir: path.join(tmp, 'templates'), projectId, serverBase: 'http://x', runner: 'preview' });
    expect(preview.elements[0]!.media).toMatchObject({ src: 'http://x/media/proxies/v.mp4', startFrom: 45 });
    expect(preview.audio?.src).toBe(`http://x${a.originalUrl}`);
  });
});
