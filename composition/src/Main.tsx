import { AbsoluteFill } from 'remotion';
import type { MainProps } from './config';
import { LottieLayer } from './LottieLayer';

/**
 * The one composition's root component. Both runners render THIS:
 *   - <Player>      in the browser (app)
 *   - renderMedia   on the server
 * Nothing in here may branch on which runner is calling it.
 */
export function Main({ background, lottie }: MainProps) {
  return (
    <AbsoluteFill style={{ backgroundColor: background }}>
      <LottieLayer animationData={lottie} />
    </AbsoluteFill>
  );
}
