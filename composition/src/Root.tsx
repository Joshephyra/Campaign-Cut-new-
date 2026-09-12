import { Composition } from 'remotion';
import { compositionConfig, defaultProps, type MainProps } from './config';
import { lottieDurationInFrames } from './lottieDuration';
import { Main } from './Main';

/**
 * Registers the single composition with Remotion for the server renderer.
 * Duration comes from the Lottie handed in as props, so the animation
 * plays at authored speed and ends when it ends.
 */
export function RemotionRoot() {
  return (
    <Composition
      id={compositionConfig.id}
      component={Main}
      width={compositionConfig.width}
      height={compositionConfig.height}
      fps={compositionConfig.fps}
      durationInFrames={lottieDurationInFrames(defaultProps.lottie, compositionConfig.fps)}
      defaultProps={defaultProps}
      calculateMetadata={({ props }: { props: MainProps }) => ({
        durationInFrames: lottieDurationInFrames(props.lottie, compositionConfig.fps),
      })}
    />
  );
}
