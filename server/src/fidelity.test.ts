import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PNG } from 'pngjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildFidelityReport, diffFrames, runFidelity, sampleTimes, type FidelitySample } from './fidelity';
import { findBinary } from './media/ffmpeg';

/**
 * M19: the fidelity harness compares our render with the After Effects
 * reference at the same points in time and tells Germain where they differ.
 */
function png(width: number, height: number, paint: (x: number, y: number) => [number, number, number]): PNG {
  const img = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const [r, g, b] = paint(x, y);
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  return img;
}

function ffmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(findBinary('ffmpeg'), ['-y', '-v', 'error', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    child.stderr.on('data', (d: Buffer) => (err += d.toString()));
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(err))));
  });
}

describe('sampleTimes', () => {
  it('spaces samples evenly through the clip and never lands on the very end', () => {
    expect(sampleTimes(8, 4)).toEqual([1, 3, 5, 7]);
    expect(sampleTimes(2, 1)).toEqual([1]);
    expect(sampleTimes(0, 5)).toEqual([]);
  });
});

describe('diffFrames', () => {
  let tmp: string;
  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-diff-'));
  });
  afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('identical frames give a black map and no region', () => {
    const a = path.join(tmp, 'a.png');
    fs.writeFileSync(a, PNG.sync.write(png(160, 90, () => [20, 30, 40])));
    const out = path.join(tmp, 'diff-a.png');
    const r = diffFrames(a, a, out);
    expect(r.comparison.meanAbsDiff).toBe(0);
    expect(r.region).toBeNull();
    const map = PNG.sync.read(fs.readFileSync(out));
    expect(map.width).toBe(160);
    expect(Array.from(map.data.filter((_, i) => i % 4 !== 3)).every((v) => v === 0)).toBe(true);
  });

  it('a drawn box shows up as a region in fractions of the frame, with its share of pixels', () => {
    const base = png(160, 90, () => [20, 30, 40]);
    // box from x 40..80 (0.25..0.5), y 45..67 (0.5..0.75)
    const boxed = png(160, 90, (x, y) => (x >= 40 && x < 80 && y >= 45 && y < 67 ? [255, 0, 0] : [20, 30, 40]));
    const a = path.join(tmp, 'base.png');
    const b = path.join(tmp, 'boxed.png');
    fs.writeFileSync(a, PNG.sync.write(base));
    fs.writeFileSync(b, PNG.sync.write(boxed));
    const out = path.join(tmp, 'diff-box.png');
    const r = diffFrames(a, b, out);
    expect(r.region).toEqual({ x: 0.25, y: 0.5, w: 0.25, h: 22 / 90 });
    expect(r.comparison.differingFraction).toBeCloseTo((40 * 22) / (160 * 90), 5);
    expect(r.comparison.withinThreshold).toBe(false);
    const map = PNG.sync.read(fs.readFileSync(out));
    const at = (x: number, y: number) => map.data[(y * 160 + x) * 4]!;
    expect(at(60, 55)).toBeGreaterThan(200); // inside the box: bright
    expect(at(10, 10)).toBe(0); // outside: black
  });
});

describe('buildFidelityReport', () => {
  const sample = (time: number, mean: number, region: FidelitySample['region']): FidelitySample => ({
    time,
    comparison: { meanAbsDiff: mean, maxAbsDiff: mean * 10, differingFraction: mean / 100, withinThreshold: mean <= 6 },
    region,
    referenceFrame: `reference-${time}.png`,
    renderFrame: `render-${time}.png`,
    diffFrame: `diff-${time}.png`,
    strip: `strip-${time}.png`,
  });

  it('passes when every sample is within threshold', () => {
    const r = buildFidelityReport({ template: 'three', reference: 'ref.mp4', render: 'out.mp4', threshold: 6 }, [sample(1, 0.5, null), sample(3, 1.2, null)]);
    expect(r.passed).toBe(true);
    expect(r.worst).toEqual({ time: 3, meanAbsDiff: 1.2, region: null });
    expect(r.text).toMatch(/VERDICT: WITHIN THRESHOLD/);
    expect(r.text).toMatch(/1\.000s\s+mean 0\.50/);
    expect(JSON.parse(r.json).samples).toHaveLength(2);
  });

  it('names the worst sample and where it differs when over threshold', () => {
    const r = buildFidelityReport({ template: 'three', reference: 'ref.mp4', render: 'out.mp4', threshold: 6 }, [
      sample(1, 0.5, null),
      sample(3, 14, { x: 0.1, y: 0.6, w: 0.4, h: 0.2 }),
    ]);
    expect(r.passed).toBe(false);
    expect(r.text).toMatch(/VERDICT: DIFFERENCES FOUND/);
    expect(r.text).toMatch(/worst at 3\.000s.*x 10%.*y 60%.*w 40%.*h 20%/);
    expect(r.text).toMatch(/1 of 2 samples over threshold/);
  });
});

describe('runFidelity end to end (ffmpeg-made clips)', () => {
  let tmp: string;
  let plain: string;
  let boxed: string;

  beforeAll(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-fid-'));
    plain = path.join(tmp, 'plain.mp4');
    boxed = path.join(tmp, 'boxed.mp4');
    await ffmpeg(['-f', 'lavfi', '-i', 'color=c=navy:s=320x180:d=2:r=30', '-pix_fmt', 'yuv420p', plain]);
    // a red box at x 0.25, y 0.5, w 0.25, h 0.25 of the frame
    await ffmpeg(['-i', plain, '-vf', 'drawbox=x=80:y=90:w=80:h=45:color=red:t=fill', '-pix_fmt', 'yuv420p', boxed]);
  }, 60_000);

  afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('flags the box region on every sample and writes frames, strips and the report', async () => {
    const workDir = path.join(tmp, 'run');
    const report = await runFidelity({ template: 'test', referencePath: boxed, renderPath: plain, workDir, samples: 3, size: { width: 320, height: 180 } });
    expect(report.samples.map((s) => s.time)).toEqual(sampleTimes(2, 3));
    expect(report.passed).toBe(false);
    for (const s of report.samples) {
      expect(s.comparison.withinThreshold).toBe(false);
      expect(s.region!.x).toBeCloseTo(0.25, 1);
      expect(s.region!.y).toBeCloseTo(0.5, 1);
      expect(s.region!.w).toBeCloseTo(0.25, 1);
      expect(s.region!.h).toBeCloseTo(0.25, 1);
      for (const f of [s.referenceFrame, s.renderFrame, s.diffFrame, s.strip]) expect(fs.existsSync(f), f).toBe(true);
    }
    const strip = PNG.sync.read(fs.readFileSync(report.samples[0]!.strip));
    expect(strip.width).toBe(3 * 320);
    expect(fs.existsSync(path.join(workDir, 'report.txt'))).toBe(true);
    expect(JSON.parse(fs.readFileSync(path.join(workDir, 'report.json'), 'utf8')).passed).toBe(false);
  }, 60_000);

  it('passes a clip against itself', async () => {
    const report = await runFidelity({ template: 'test', referencePath: plain, renderPath: plain, workDir: path.join(tmp, 'same'), samples: 2, size: { width: 320, height: 180 } });
    expect(report.passed).toBe(true);
  }, 60_000);
});
