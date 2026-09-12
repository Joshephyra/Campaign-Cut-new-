import { Composition } from 'remotion';
import { compositionConfig, defaultProps, type MainProps } from './config';
import { compositionDurationFor } from './elements';
import { Main } from './Main';

/**
 * Registers the single composition with Remotion for the server renderer.
 * Duration comes from the elements handed in as props, so the timeline
 * ends when its last enabled element ends.
 */
export function RemotionRoot() {
  return (
    <Composition
      id={compositionConfig.id}
      component={Main}
      width={compositionConfig.width}
      height={compositionConfig.height}
      fps={compositionConfig.fps}
      durationInFrames={compositionDurationFor(defaultProps.elements)}
      defaultProps={defaultProps}
      calculateMetadata={({ props }: { props: MainProps }) => ({
        durationInFrames: compositionDurationFor(props.elements),
      })}
    />
  );
}
