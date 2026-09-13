import { compositionConfig } from '@campaigncut/composition';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { findBinary, probe } from './media/ffmpeg';
import { compareFrames, PARITY_THRESHOLD, type FrameComparison } from './parity';

/**
 * M19: the fidelity harness. AT-2 is Germain's call; this puts numbers,
 * side-by-side frames and a difference map in front of him. The reference
 * (After Effects) and our render are sampled at the same POINTS IN TIME, so
 * a reference at another frame rate still lines up, and the reference is
 * scaled to the composition size before comparing.
 */
export const FIDELITY_THRESHOLD = PARITY_THRESHOLD;

/** Where the differences are, as fractions of the frame. Null when nothing differs. */
export type Region = { x: number; y: number; w: number; h: number } | null;

export type FidelitySample = {
  time: number;
  comparison: FrameComparison;
  region: Region;
  referenceFrame: string;
  renderFrame: string;
  diffFrame: string;
  /** reference | render | difference, side by side. */
  strip: string;
};

export type FidelityReport = {
  template: string;
  reference: string;
  render: string;
  threshold: number;
  samples: FidelitySample[];
  worst: { time: number; meanAbsDiff: number; region: Region } | null;
  passed: boolean;
  text: string;
  json: string;
};

/** Evenly spaced sample times: the middle of `count` equal slices, so the very end is never hit. */
export function sampleTimes(durationS: number, count: number): number[] {
  if (!(durationS > 0) || count <= 0) return [];
  return Array.from({ length: count }, (_, i) => ((i + 0.5) / count) * durationS);
}

/** A pixel counts as different when some channel differs by more than this. */
const PIXEL_DIFF = 40;

/**
 * Compare two frames and write a difference map: black where they match,
 * brighter the more they differ, full white where a channel differs by 255.
 * Returns the comparison and the bounding region of differing pixels.
 */
export function diffFrames(aPath: string, bPath: string, outPng: string): { comparison: FrameComparison; region: Region } {
  const comparison = compareFrames(aPath, bPath);
  const a = PNG.sync.read(fs.readFileSync(aPath));
  const b = PNG.sync.read(fs.readFileSync(bPath));
  const width = Math.min(a.width, b.width);
  const height = Math.min(a.height, b.height);
  const map = new PNG({ width, height });
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ia = (y * a.width + x) * 4;
      const ib = (y * b.width + x) * 4;
      let d = 0;
      for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(a.data[ia + c]! - b.data[ib + c]!));
      const io = (y * width + x) * 4;
      map.data[io] = d;
      map.data[io + 1] = d;
      map.data[io + 2] = d;
      map.data[io + 3] = 255;
      if (d > PIXEL_DIFF) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  fs.mkdirSync(path.dirname(outPng), { recursive: true });
  fs.writeFileSync(outPng, PNG.sync.write(map));
  const region: Region = maxX < 0 ? null : { x: minX / width, y: minY / height, w: (maxX - minX + 1) / width, h: (maxY - minY + 1) / height };
  return { comparison, region };
}

/** One frame of a video at a time in seconds, scaled to `size`, as a PNG. */
export function extractFrameAt(video: string, seconds: number, outPng: string, size: { width: number; height: number }): Promise<void> {
  fs.mkdirSync(path.dirname(outPng), { recursive: true });
  return new Promise((resolve, reject) => {
    const args = ['-y', '-v', 'error', '-i', video, '-ss', seconds.toFixed(3), '-frames:v', '1', '-vf', `scale=${size.width}:${size.height}`, outPng];
    const child = spawn(findBinary('ffmpeg'), args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
    child.on('error', reject);
    child.on('close', (code) => (code === 0 && fs.existsSync(outPng) ? resolve() : reject(new Error(`ffmpeg failed at ${seconds}s of ${video}: ${stderr.trim()}`))));
  });
}

/** reference | render | difference side by side, each at its full size. */
export function makeStrip(parts: string[], outPng: string): void {
  const images = parts.map((p) => PNG.sync.read(fs.readFileSync(p)));
  const height = Math.max(...images.map((i) => i.height));
  const width = images.reduce((sum, i) => sum + i.width, 0);
  const strip = new PNG({ width, height });
  let offset = 0;
  for (const img of images) {
    for (let y = 0; y < img.height; y++) {
      img.data.copy(strip.data, (y * width + offset) * 4, y * img.width * 4, (y + 1) * img.width * 4);
    }
    offset += img.width;
  }
  fs.writeFileSync(outPng, PNG.sync.write(strip));
}

const pct = (f: number) => `${Math.round(f * 100)}%`;
const regionText = (r: Region) => (r ? `x ${pct(r.x)}, y ${pct(r.y)}, w ${pct(r.w)}, h ${pct(r.h)}` : 'nowhere');

export function buildFidelityReport(meta: { template: string; reference: string; render: string; threshold: number }, samples: FidelitySample[]): FidelityReport {
  const over = samples.filter((s) => s.comparison.meanAbsDiff > meta.threshold);
  const worstSample = samples.reduce<FidelitySample | null>((w, s) => (!w || s.comparison.meanAbsDiff > w.comparison.meanAbsDiff ? s : w), null);
  const worst = worstSample ? { time: worstSample.time, meanAbsDiff: worstSample.comparison.meanAbsDiff, region: worstSample.region } : null;
  const passed = over.length === 0;

  const lines: string[] = [];
  lines.push('CampaignCut fidelity report');
  lines.push('===========================');
  lines.push(`Template:  ${meta.template}`);
  lines.push(`Reference: ${meta.reference}`);
  lines.push(`Render:    ${meta.render}`);
  lines.push(`Threshold: mean difference <= ${meta.threshold} of 255 per channel`);
  lines.push('');
  lines.push('SAMPLES');
  for (const s of samples) {
    const c = s.comparison;
    const flag = c.meanAbsDiff <= meta.threshold ? 'OK  ' : 'DIFF';
    lines.push(`  ${flag} ${s.time.toFixed(3)}s  mean ${c.meanAbsDiff.toFixed(2)}  max ${c.maxAbsDiff}  differing ${(c.differingFraction * 100).toFixed(2)}%  at ${regionText(s.region)}`);
    lines.push(`       ${path.basename(s.strip)}`);
  }
  lines.push('');
  if (passed) {
    lines.push('VERDICT: WITHIN THRESHOLD on every sample. Open the strips and look anyway; numbers are not taste.');
  } else {
    lines.push(`VERDICT: DIFFERENCES FOUND. ${over.length} of ${samples.length} samples over threshold; worst at ${worst!.time.toFixed(3)}s (mean ${worst!.meanAbsDiff.toFixed(2)}) at ${regionText(worst!.region)}.`);
    lines.push('Open the strip for that sample: reference on the left, our render in the middle, the difference on the right.');
  }
  const report: Omit<FidelityReport, 'text' | 'json'> = { ...meta, samples, worst, passed };
  return { ...report, text: lines.join('\n'), json: JSON.stringify(report, null, 2) };
}

export type RunFidelityOptions = {
  template: string;
  referencePath: string;
  renderPath: string;
  workDir: string;
  /** Number of evenly spaced samples (default 12), unless `times` is given. */
  samples?: number;
  times?: number[];
  threshold?: number;
  /** Frame size to compare at; defaults to the composition's. */
  size?: { width: number; height: number };
};

/** Sample both videos, compare, write frames, strips and the report into workDir. */
export async function runFidelity(options: RunFidelityOptions): Promise<FidelityReport> {
  const { template, referencePath, renderPath, workDir } = options;
  const threshold = options.threshold ?? FIDELITY_THRESHOLD;
  const size = options.size ?? { width: compositionConfig.width, height: compositionConfig.height };
  fs.mkdirSync(workDir, { recursive: true });

  const [ref, out] = await Promise.all([probe(referencePath), probe(renderPath)]);
  const duration = Math.min(ref.durationS, out.durationS);
  const times = options.times ?? sampleTimes(duration, options.samples ?? 12);

  const samples: FidelitySample[] = [];
  for (const time of times) {
    const tag = time.toFixed(3).replace('.', '_');
    const referenceFrame = path.join(workDir, `reference-${tag}.png`);
    const renderFrame = path.join(workDir, `render-${tag}.png`);
    const diffFrame = path.join(workDir, `diff-${tag}.png`);
    const strip = path.join(workDir, `strip-${tag}.png`);
    await extractFrameAt(referencePath, time, referenceFrame, size);
    await extractFrameAt(renderPath, time, renderFrame, size);
    const { comparison, region } = diffFrames(referenceFrame, renderFrame, diffFrame);
    makeStrip([referenceFrame, renderFrame, diffFrame], strip);
    samples.push({ time, comparison, region, referenceFrame, renderFrame, diffFrame, strip });
  }

  const report = buildFidelityReport({ template, reference: referencePath, render: renderPath, threshold }, samples);
  const notes: string[] = [];
  if (Math.abs(ref.durationS - out.durationS) > 1 / compositionConfig.fps) {
    notes.push(`NOTE: durations differ: reference ${ref.durationS.toFixed(3)}s, render ${out.durationS.toFixed(3)}s; sampled the first ${duration.toFixed(3)}s.`);
  }
  if (ref.width !== size.width || ref.height !== size.height) notes.push(`NOTE: reference is ${ref.width}x${ref.height}; scaled to ${size.width}x${size.height} for comparison.`);
  const text = notes.length ? `${report.text}\n\n${notes.join('\n')}` : report.text;
  fs.writeFileSync(path.join(workDir, 'report.txt'), `${text}\n`);
  fs.writeFileSync(path.join(workDir, 'report.json'), `${report.json}\n`);
  return { ...report, text };
}
