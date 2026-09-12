import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { summarizePlayback, TARGET_FPS } from './perf';

describe('summarizePlayback', () => {
  it('reports frames per second over the measured window', () => {
    // 30 frame updates spread evenly over one second
    const timestamps = Array.from({ length: 31 }, (_, i) => 1000 + (i * 1000) / 30);
    const s = summarizePlayback(timestamps, 30);
    expect(s.fps).toBeCloseTo(30, 0);
    expect(s.frames).toBe(31);
    expect(s.meetsTarget).toBe(true);
  });

  it('counts long gaps as dropped frames and flags a slow run', () => {
    // 12 updates in one second at 30 fps nominal: half the frames are missing
    const timestamps = Array.from({ length: 13 }, (_, i) => 1000 + (i * 1000) / 12);
    const s = summarizePlayback(timestamps, 30);
    expect(s.fps).toBeCloseTo(12, 0);
    expect(s.droppedFrames).toBeGreaterThan(10);
    expect(s.meetsTarget).toBe(false);
  });

  it('handles a run with fewer than two samples', () => {
    expect(summarizePlayback([], 30)).toMatchObject({ fps: 0, frames: 0, meetsTarget: false });
    expect(summarizePlayback([1000], 30)).toMatchObject({ fps: 0, frames: 1, meetsTarget: false });
  });
});

type Baseline = {
  date: string;
  template: string;
  machine: string;
  target: number;
  runs: { lever: string; environment: string; fps: number; frames: number; seconds: number }[];
  attempted: { lever: string; result: string }[];
};

describe('recorded performance baseline (docs/perf-baseline.json)', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const file = path.resolve(here, '..', '..', 'docs', 'perf-baseline.json');
  const baseline = JSON.parse(fs.readFileSync(file, 'utf8')) as Baseline;

  it('records what was measured, on what, and every lever tried', () => {
    expect(baseline.template).toBeTruthy();
    expect(baseline.machine).toBeTruthy();
    expect(baseline.target).toBe(TARGET_FPS);
    expect(baseline.runs.length).toBeGreaterThan(0);
    for (const run of baseline.runs) {
      expect(run.lever).toBeTruthy();
      expect(run.environment).toBeTruthy();
      expect(run.fps).toBeGreaterThan(0);
      expect(run.seconds).toBeGreaterThan(0);
    }
    expect(baseline.attempted.length).toBeGreaterThan(0);
  });

  // AT-4 is judged on a visible tab on a normal laptop. Runs from an occluded
  // browser pane do not count either way; this only passes or fails once a
  // visible-tab run has been recorded.
  const visibleRuns = baseline.runs.filter((r) => r.environment.toLowerCase().startsWith('visible'));
  it.skipIf(visibleRuns.length === 0)('the latest visible-tab run sustains 24 fps or better', () => {
    expect(visibleRuns.at(-1)!.fps).toBeGreaterThanOrEqual(TARGET_FPS);
  });

  it('says plainly when the target has not been verified yet', () => {
    if (visibleRuns.length === 0) {
      console.warn('perf: no visible-tab run recorded yet; open /projects/1?perf=8 in a normal browser tab and add the result to docs/perf-baseline.json');
    }
    expect(true).toBe(true);
  });
});
