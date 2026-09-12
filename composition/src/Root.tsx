import { Composition } from 'remotion';
import { compositionConfig, defaultProps, type MainProps } from './config';
import { Main } from './Main';
import { compositionDurationWithTransitions } from './transitions';

/**
 * Registers the single composition with Remotion for the server renderer.
 * Duration comes from the elements and transitions handed in as props, so
 * the timeline ends when its last chain ends.
 */
export function RemotionRoot() {
  return (
    <Composition
      id={compositionConfig.id}
      component={Main}
      width={compositionConfig.width}
      height={compositionConfig.height}
      fps={compositionConfig.fps}
      durationInFrames={compositionDurationWithTransitions(defaultProps.elements, defaultProps.transitions ?? [])}
      defaultProps={defaultProps}
      calculateMetadata={({ props }: { props: MainProps }) => ({
        durationInFrames: compositionDurationWithTransitions(props.elements, props.transitions ?? []),
      })}
    />
  );
}
