import { AbsoluteFill, OffthreadVideo, Sequence } from 'remotion';
import type { MainProps } from './config';
import { visibleElementsInOrder } from './elements';
import { LottieLayer } from './LottieLayer';

/**
 * The one composition's root component. Both runners render THIS:
 *   - <Player>      in the browser (app), handed the proxy footage
 *   - renderMedia   on the server, handed the original footage
 * Nothing in here may branch on which runner is calling it.
 *
 * Layer order, bottom to top: background colour, footage in the
 * cc.mediaFill slot, then each enabled element in z order, each inside a
 * Sequence so its Lottie starts at its in point and ends at its out point.
 */
export function Main({ background, media, elements }: MainProps) {
  return (
    <AbsoluteFill style={{ backgroundColor: background }}>
      {media && (
        <div
          data-testid="media-slot"
          style={{
            position: 'absolute',
            left: `${media.rect.x * 100}%`,
            top: `${media.rect.y * 100}%`,
            width: `${media.rect.w * 100}%`,
            height: `${media.rect.h * 100}%`,
            overflow: 'hidden',
            backgroundColor: '#000000',
          }}
        >
          <OffthreadVideo src={media.src} style={{ width: '100%', height: '100%', objectFit: media.fit }} />
        </div>
      )}
      {visibleElementsInOrder(elements).map((element) => (
        <Sequence
          key={element.id}
          name={element.id}
          from={element.startFrame}
          durationInFrames={element.endFrame - element.startFrame}
          layout="none"
        >
          <LottieLayer animationData={element.lottie} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
