import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PNG } from 'pngjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { compareFrames, extractFrame, PARITY_THRESHOLD } from './parity';

function writePng(file: string, width: number, height: number, rgb: (x: number, y: number) => [number, number, number]) {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = rgb(x, y);
      const i = (y * width + x) * 4;
      png.data[i] = r;
      png.data[i + 1] = g;
      png.data[i + 2] = b;
      png.data[i + 3] = 255;
    }
  }
  fs.writeFileSync(file, PNG.sync.write(png));
}

describe('compareFrames', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-parity-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('identical frames differ by 0', () => {
    const a = path.join(tmp, 'a.png');
    const b = path.join(tmp, 'b.png');
    writePng(a, 64, 36, () => [200, 30, 30]);
    writePng(b, 64, 36, () => [200, 30, 30]);
    const r = compareFrames(a, b);
    expect(r.meanAbsDiff).toBe(0);
    expect(r.maxAbsDiff).toBe(0);
    expect(r.withinThreshold).toBe(true);
  });

  it('a small codec-like difference is within threshold', () => {
    const a = path.join(tmp, 'a.png');
    const b = path.join(tmp, 'b.png');
    writePng(a, 64, 36, () => [200, 30, 30]);
    writePng(b, 64, 36, (x) => [200 + (x % 3), 30, 31]);
    const r = compareFrames(a, b);
    expect(r.meanAbsDiff).toBeLessThan(PARITY_THRESHOLD);
    expect(r.withinThreshold).toBe(true);
  });

  it('a different picture is flagged', () => {
    const a = path.join(tmp, 'a.png');
    const b = path.join(tmp, 'b.png');
    writePng(a, 64, 36, () => [200, 30, 30]);
    writePng(b, 64, 36, (x) => (x < 32 ? [200, 30, 30] : [30, 30, 200]));
    const r = compareFrames(a, b);
    expect(r.withinThreshold).toBe(false);
    expect(r.differingFraction).toBeGreaterThan(0.4);
  });

  it('resizes when the two frames are different sizes', () => {
    const a = path.join(tmp, 'a.png');
    const b = path.join(tmp, 'b.png');
    writePng(a, 64, 36, () => [10, 200, 10]);
    writePng(b, 32, 18, () => [10, 200, 10]);
    expect(compareFrames(a, b).withinThreshold).toBe(true);
  });
});

describe('extractFrame (ffmpeg)', () => {
  it('pulls one frame of the fixture clip as a PNG of the right size', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-extract-'));
    const fixture = path.resolve(__dirname, '..', 'fixtures', 'clip-1280x720-25fps-2s.mp4');
    const out = path.join(tmp, 'f10.png');
    await extractFrame(fixture, 10, out);
    const png = PNG.sync.read(fs.readFileSync(out));
    expect(png.width).toBe(1280);
    expect(png.height).toBe(720);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
