import { Lottie } from '@remotion/lottie';
import { useRef, type CSSProperties } from 'react';
import { CalloutOverlay } from './CalloutOverlay';
import type { Callout } from './callouts';
import { LOTTIE_RENDERER, type LottieAnimationData } from './config';

export type LottieLayerProps = {
  animationData: LottieAnimationData;
  /** M28: the element this Lottie belongs to, so the editor can map a layer on screen back to it. */
  elementId?: string;
  /** M39: a CSS filter a treatment puts on the design (never on the footage). */
  filter?: string;
  /** M56: callouts drawn on words of this design's text layers. */
  callouts?: Callout[];
  /** M56: the element's start, so a callout's draw-on counts from it. */
  startFrame?: number;
};

/**
 * FULL-FRAME ABSOLUTELY POSITIONED WRAPPER.
 *
 * This wrapper is the fix for the positioning bug in the previous build,
 * where ingested designs rendered BELOW the video frame instead of over it.
 * Do not remove it, do not make it relative, do not size it in pixels.
 * LottieLayer.test.tsx guards it.
 */
const fullFrame: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  overflow: 'hidden',
};

export function LottieLayer({ animationData, elementId, filter, callouts = [], startFrame = 0 }: LottieLayerProps) {
  const wrap = useRef<HTMLDivElement>(null);
  return (
    <div ref={wrap} data-testid="lottie-wrapper" data-cc-element={elementId} style={filter ? { ...fullFrame, filter } : fullFrame}>
      {callouts.length > 0 && <CalloutOverlay host={wrap} callouts={callouts} startFrame={startFrame} version={animationData} />}
      <Lottie
        // @remotion/lottie's type is the lottie-web AnimationItem data shape;
        // ours is a structural subset with the fields we read.
        animationData={animationData as never}
        renderer={LOTTIE_RENDERER}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
