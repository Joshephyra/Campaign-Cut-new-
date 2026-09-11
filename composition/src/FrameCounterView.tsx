import type { CSSProperties } from 'react';

export type FrameCounterViewProps = {
  frame: number;
  fps: number;
  background: string;
};

/** mm:ss:ff, the way an editor's timecode reads. */
export function formatTimecode(frame: number, fps: number): string {
  const totalSeconds = Math.floor(frame / fps);
  const frames = frame % fps;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(minutes)}:${pad(seconds)}:${pad(frames)}`;
}

/**
 * The pure, Remotion-free view. It is given a frame and draws it. This is
 * what the unit tests exercise; FrameCounter.tsx is the thin Remotion
 * wrapper that supplies the live frame.
 *
 * All sizes are fractions of the frame (CLAUDE.md: never hardcoded pixels),
 * expressed through viewport-relative units on the wrapper.
 */
export function FrameCounterView({ frame, fps, background }: FrameCounterViewProps) {
  const wrapper: CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    backgroundColor: background,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#FFFFFF',
    fontFamily: 'ui-monospace, "IBM Plex Mono", Consolas, monospace',
  };

  return (
    <div data-testid="frame-counter" style={wrapper}>
      <div data-testid="frame-number" style={{ fontSize: '30cqh', lineHeight: 1, fontWeight: 700 }}>
        {frame}
      </div>
      <div data-testid="timecode" style={{ fontSize: '6cqh', marginTop: '3cqh', opacity: 0.8 }}>
        {formatTimecode(frame, fps)}
      </div>
      <div style={{ fontSize: '3cqh', marginTop: '2cqh', opacity: 0.5 }}>
        CampaignCut · M0 · {fps} fps
      </div>
    </div>
  );
}
