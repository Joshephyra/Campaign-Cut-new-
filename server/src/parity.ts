import { compositionConfig, type MainProps } from '@campaigncut/composition';
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import type { Db } from './db/index';
import { findBinary } from './media/ffmpeg';
import { renderStillFrame } from './render';
import { buildProjectProps } from './renderProject';
import { spawn } from 'node:child_process';

/**
 * Mean absolute difference per channel (0..255) above which two frames are
 * considered different. H.264 at a sane bitrate, plus the proxy's downscale,
 * lands well under this; a missing layer or wrong text lands far over it.
 */
export const PARITY_THRESHOLD = 6;

export type FrameComparison = {
  meanAbsDiff: number;
  maxAbsDiff: number;
  /** Fraction of pixels where some channel differs by more than 40. */
  differingFraction: number;
  withinThreshold: boolean;
};

function sampleTo(png: PNG, width: number, height: number): Uint8Array {
  const out = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    const sy = Math.min(png.height - 1, Math.floor((y / height) * png.height));
    for (let x = 0; x < width; x++) {
      const sx = Math.min(png.width - 1, Math.floor((x / width) * png.width));
      const si = (sy * png.width + sx) * 4;
      const oi = (y * width + x) * 3;
      out[oi] = png.data[si]!;
      out[oi + 1] = png.data[si + 1]!;
      out[oi + 2] = png.data[si + 2]!;
    }
  }
  return out;
}

/** Compare two PNG frames. Different sizes are sampled down to the smaller. */
export function compareFrames(aPath: string, bPath: string): FrameComparison {
  const a = PNG.sync.read(fs.readFileSync(aPath));
  const b = PNG.sync.read(fs.readFileSync(bPath));
  const width = Math.min(a.width, b.width);
  const height = Math.min(a.height, b.height);
  const pa = sampleTo(a, width, height);
  const pb = sampleTo(b, width, height);

  let total = 0;
  let max = 0;
  let differing = 0;
  const pixels = width * height;
  for (let i = 0; i < pixels; i++) {
    let pixelMax = 0;
    for (let c = 0; c < 3; c++) {
      const d = Math.abs(pa[i * 3 + c]! - pb[i * 3 + c]!);
      total += d;
      if (d > max) max = d;
      if (d > pixelMax) pixelMax = d;
    }
    if (pixelMax > 40) differing++;
  }
  const meanAbsDiff = total / (pixels * 3);
  return { meanAbsDiff, maxAbsDiff: max, differingFraction: differing / pixels, withinThreshold: meanAbsDiff <= PARITY_THRESHOLD };
}

/** One frame of a video file as a PNG, by frame index. */
export function extractFrame(video: string, frame: number, outPng: string): Promise<void> {
  fs.mkdirSync(path.dirname(outPng), { recursive: true });
  return new Promise((resolve, reject) => {
    const child = spawn(findBinary('ffmpeg'), ['-y', '-v', 'error', '-i', video, '-vf', `select=eq(n\\,${frame})`, '-frames:v', '1', outPng], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
    child.on('error', reject);
    child.on('close', (code) => (code === 0 && fs.existsSync(outPng) ? resolve() : reject(new Error(`ffmpeg failed on frame ${frame}: ${stderr.trim()}`))));
  });
}

export type ParityResult = { frame: number; comparison: FrameComparison; exportFrame: string; previewFrame: string };

/**
 * The automated half of AT-5. For each frame: pull that frame out of the
 * exported MP4, render the same frame with the PREVIEW runner's props (proxy
 * footage, same composition), and compare. The human half is watching the file.
 */
export async function runParity(options: {
  db: Db;
  templatesDir: string;
  projectId: number;
  serverBase: string;
  exportPath: string;
  frames: number[];
  workDir: string;
}): Promise<ParityResult[]> {
  const { db, templatesDir, projectId, serverBase, exportPath, frames, workDir } = options;
  fs.mkdirSync(workDir, { recursive: true });
  const previewProps: MainProps = buildProjectProps({ db, templatesDir, projectId, serverBase, runner: 'preview' });

  const results: ParityResult[] = [];
  for (const frame of frames) {
    const exportFrame = path.join(workDir, `export-${frame}.png`);
    const previewFrame = path.join(workDir, `preview-${frame}.png`);
    await extractFrame(exportPath, frame, exportFrame);
    await renderStillFrame({ outputPath: previewFrame, inputProps: previewProps, frame });
    results.push({ frame, comparison: compareFrames(exportFrame, previewFrame), exportFrame, previewFrame });
  }
  return results;
}

export const parityFps = compositionConfig.fps;
