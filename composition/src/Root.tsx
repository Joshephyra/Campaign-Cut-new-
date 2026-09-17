import { Composition } from 'remotion';
import { frameFor } from './aspect';
import { compositionConfig, defaultProps, type MainProps } from './config';
import { Main } from './Main';
import { compositionDurationWithTransitions } from './transitions';

/**
 * What the props decide about the composition: its length (from the
 * elements and transitions) and, since M36, its frame (from the spot's
 * aspect). Both runners call this through Remotion's calculateMetadata.
 */
export function metadataFor(props: MainProps): { durationInFrames: number; width: number; height: number } {
  const frame = props.frame ?? frameFor('16:9');
  return { durationInFrames: compositionDurationWithTransitions(props.elements, props.transitions ?? []), width: frame.width, height: frame.height };
}

/**
 * Registers the single composition with Remotion for the server renderer.
 * Duration comes from the elements and transitions handed in as props, so
 * the timeline ends when its last chain ends; the frame comes from the
 * spot's aspect.
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
      calculateMetadata={({ props }: { props: MainProps }) => metadataFor(props)}
    />
  );
}
