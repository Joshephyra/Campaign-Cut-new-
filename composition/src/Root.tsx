import { Composition } from 'remotion';
import { compositionConfig, defaultProps } from './config';
import { FrameCounter } from './FrameCounter';

/** Registers the single composition with Remotion for the server renderer. */
export function RemotionRoot() {
  return (
    <Composition
      id={compositionConfig.id}
      component={FrameCounter}
      width={compositionConfig.width}
      height={compositionConfig.height}
      fps={compositionConfig.fps}
      durationInFrames={compositionConfig.durationInFrames}
      defaultProps={defaultProps}
    />
  );
}
