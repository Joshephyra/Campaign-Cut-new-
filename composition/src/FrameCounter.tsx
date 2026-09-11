import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { MainProps } from './config';
import { FrameCounterView } from './FrameCounterView';

/**
 * The one composition's root component. Both runners render THIS:
 *   - <Player>      in the browser (app)
 *   - renderMedia   on the server
 * Nothing in here may branch on which runner is calling it.
 */
export function FrameCounter({ background }: MainProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ containerType: 'size' }}>
      <FrameCounterView frame={frame} fps={fps} background={background} />
    </AbsoluteFill>
  );
}
