/** MILESTONES M12 / SPEC 5: smooth enough to judge an edit. 24 fps sustained, not 60. */
export const TARGET_FPS = 24;

export type PlaybackSummary = {
  /** Frame updates observed per second over the window. */
  fps: number;
  frames: number;
  seconds: number;
  /** Frames the Player skipped, estimated from gaps longer than 1.5 nominal frames. */
  droppedFrames: number;
  /** Longest gap between two frame updates, in ms. */
  worstGapMs: number;
  meetsTarget: boolean;
};

/**
 * Turn a list of frame-update timestamps (ms) into a rate. The Player fires
 * 'frameupdate' once per frame it actually shows, so counting those over a
 * window is the honest number: what the eye sees.
 */
export function summarizePlayback(timestamps: number[], nominalFps: number): PlaybackSummary {
  if (timestamps.length < 2) {
    return { fps: 0, frames: timestamps.length, seconds: 0, droppedFrames: 0, worstGapMs: 0, meetsTarget: false };
  }
  const first = timestamps[0]!;
  const last = timestamps[timestamps.length - 1]!;
  const seconds = (last - first) / 1000;
  const fps = seconds > 0 ? (timestamps.length - 1) / seconds : 0;
  const nominalGap = 1000 / nominalFps;
  let dropped = 0;
  let worst = 0;
  for (let i = 1; i < timestamps.length; i++) {
    const gap = timestamps[i]! - timestamps[i - 1]!;
    if (gap > worst) worst = gap;
    if (gap > nominalGap * 1.5) dropped += Math.round(gap / nominalGap) - 1;
  }
  return { fps, frames: timestamps.length, seconds, droppedFrames: dropped, worstGapMs: worst, meetsTarget: fps >= TARGET_FPS };
}

type FrameEventTarget = {
  addEventListener: (name: 'frameupdate', cb: (e: { detail: { frame: number } }) => void) => void;
  removeEventListener: (name: 'frameupdate', cb: (e: { detail: { frame: number } }) => void) => void;
  play: () => void;
  pause: () => void;
  seekTo: (frame: number) => void;
};

/** Play from the start for `seconds` and measure what the Player actually shows. */
export function measurePlayback(player: FrameEventTarget, seconds: number, nominalFps: number): Promise<PlaybackSummary> {
  return new Promise((resolve) => {
    const stamps: number[] = [];
    const onFrame = () => stamps.push(performance.now());
    player.addEventListener('frameupdate', onFrame);
    player.seekTo(0);
    player.play();
    setTimeout(() => {
      player.pause();
      player.removeEventListener('frameupdate', onFrame);
      resolve(summarizePlayback(stamps, nominalFps));
    }, seconds * 1000);
  });
}
