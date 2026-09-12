import { linearTiming, TransitionSeries, type TransitionPresentation } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { wipe } from '@remotion/transitions/wipe';
import { AbsoluteFill, OffthreadVideo, Sequence } from 'remotion';
import { PREMOUNT_FRAMES, type MainProps } from './config';
import type { ElementProps } from './elements';
import { LottieLayer } from './LottieLayer';
import { TemplateFonts } from './fonts';
import { effectiveTimeline, type TransitionPreset } from './transitions';

/** Each preset carries its own props type; the series only needs the common shape. */
type AnyPresentation = TransitionPresentation<Record<string, unknown>>;

function presentationFor(preset: TransitionPreset): AnyPresentation {
  switch (preset) {
    case 'fade':
      return fade() as unknown as AnyPresentation;
    case 'wipe':
      return wipe({ direction: 'from-left' }) as unknown as AnyPresentation;
    case 'slide':
      return slide({ direction: 'from-right' }) as unknown as AnyPresentation;
    case 'cut':
      return fade() as unknown as AnyPresentation; // never reached: cuts do not form chains
  }
}

/**
 * The one composition's root component. Both runners render THIS:
 *   - <Player>      in the browser (app), handed the proxy footage
 *   - renderMedia   on the server, handed the original footage
 * Nothing in here may branch on which runner is calling it.
 *
 * Layer order, bottom to top: background colour, footage in the
 * cc.mediaFill slot, then the element chains in start order. A chain is
 * either one element in a Sequence at its in/out points, or several
 * elements joined by transitions, rendered with TransitionSeries.
 */
export function Main({ background, media, elements, transitions = [], fonts = [] }: MainProps) {
  const byId = new Map(elements.map((e) => [e.id, e] as const));
  const { chains } = effectiveTimeline(elements, transitions);

  return (
    <AbsoluteFill style={{ backgroundColor: background }}>
      <TemplateFonts key={fonts.map((f) => f.url).join('|')} fonts={fonts} />
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

      {chains.map((chain) => {
        const members = chain.elementIds.map((id) => byId.get(id)).filter((e): e is ElementProps => !!e);
        const first = members[0]!;
        if (members.length === 1) {
          return (
            <Sequence
              key={first.id}
              name={first.id}
              from={chain.startFrame}
              durationInFrames={chain.durationInFrames}
              premountFor={PREMOUNT_FRAMES}
            >
              <LottieLayer animationData={first.lottie} />
            </Sequence>
          );
        }
        return (
          <Sequence
            key={first.id}
            name={chain.elementIds.join('+')}
            from={chain.startFrame}
            durationInFrames={chain.durationInFrames}
            premountFor={PREMOUNT_FRAMES}
          >
            <TransitionSeries>
              {members.flatMap((element, index) => {
                const parts = [
                  <TransitionSeries.Sequence key={element.id} durationInFrames={element.endFrame - element.startFrame}>
                    <LottieLayer animationData={element.lottie} />
                  </TransitionSeries.Sequence>,
                ];
                const t = chain.transitions[index];
                if (t && index < members.length - 1) {
                  parts.push(
                    <TransitionSeries.Transition
                      key={`${element.id}-transition`}
                      presentation={presentationFor(t.preset)}
                      timing={linearTiming({ durationInFrames: t.durationInFrames })}
                    />,
                  );
                }
                return parts;
              })}
            </TransitionSeries>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
