import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findBinary, makePoster, makeProxy, probe } from './ffmpeg';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.resolve(here, '..', '..', 'fixtures', 'clip-1280x720-25fps-2s.mp4');

describe('findBinary', () => {
  it('locates ffmpeg and ffprobe', () => {
    expect(findBinary('ffmpeg')).toBeTruthy();
    expect(findBinary('ffprobe')).toBeTruthy();
  });
});

describe('probe', () => {
  it('matches the known fixture', async () => {
    const info = await probe(fixture);
    expect(info.width).toBe(1280);
    expect(info.height).toBe(720);
    expect(info.fps).toBeCloseTo(25, 3);
    expect(info.durationS).toBeCloseTo(2, 1);
    expect(info.hasAudio).toBe(true);
  });

  it('rejects a file that is not media, naming it', async () => {
    const tmp = path.join(os.tmpdir(), `cc-notmedia-${Date.now()}.mp4`);
    fs.writeFileSync(tmp, 'this is not a video');
    await expect(probe(tmp)).rejects.toThrow(/cc-notmedia/);
    fs.rmSync(tmp);
  });
});

describe('makeProxy and makePoster', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-ffmpeg-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('writes a 960-wide H.264 proxy with faststart', async () => {
    const out = path.join(tmp, 'proxy.mp4');
    await makeProxy(fixture, out);
    const info = await probe(out);
    expect(info.width).toBe(960);
    expect(info.height).toBe(540);
    expect(info.codec).toBe('h264');
    // faststart puts the moov atom before mdat
    const bytes = fs.readFileSync(out);
    expect(bytes.indexOf('moov')).toBeGreaterThan(-1);
    expect(bytes.indexOf('moov')).toBeLessThan(bytes.indexOf('mdat'));
  });

  it('writes a poster frame', async () => {
    const out = path.join(tmp, 'poster.jpg');
    await makePoster(fixture, out, 1);
    expect(fs.existsSync(out)).toBe(true);
    const info = await probe(out);
    expect(info.width).toBe(480);
    expect(info.height).toBe(270);
  });
});
