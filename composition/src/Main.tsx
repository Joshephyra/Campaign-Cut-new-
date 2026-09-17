import { linearTiming, TransitionSeries, type TransitionPresentation } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { wipe } from '@remotion/transitions/wipe';
import type { CSSProperties } from 'react';
import { AbsoluteFill, Audio, OffthreadVideo, Sequence } from 'remotion';
import { autoFitBox, frameFor, isFullBleed, type AutoFitBox, type Frame } from './aspect';
import { chromaFilter } from './chroma';
import { PREMOUNT_FRAMES, type MainMedia, type MainProps } from './config';
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
 * Footage in an element's cc.mediaFill slot: a rectangle in fractions of
 * the frame, the clip fitted into it, optionally chroma-keyed. Rendered
 * inside the element's Sequence, so it starts with the element and its
 * trim is relative to the element's in point.
 */
function MediaSlot({ media, box }: { media: MainMedia; box: AutoFitBox | null }) {
  const key = media.key ? chromaFilter(media.key) : null;
  // M36: in an auto-fitted element, a slot that filled the authored frame
  // fills the new one; any other slot maps into the element's box.
  const geometry: CSSProperties =
    box === null || isFullBleed(media.rect)
      ? { left: `${media.rect.x * 100}%`, top: `${media.rect.y * 100}%`, width: `${media.rect.w * 100}%`, height: `${media.rect.h * 100}%` }
      : { left: `${box.left + media.rect.x * box.width}px`, top: `${box.top + media.rect.y * box.height}px`, width: `${media.rect.w * box.width}px`, height: `${media.rect.h * box.height}px` };
  return (
    <div
      data-testid="media-slot"
      style={{
        position: 'absolute',
        ...geometry,
        overflow: 'hidden',
        // Letterbox bars are black; with a key the background must show through the keyed pixels.
        backgroundColor: key ? 'transparent' : '#000000',
      }}
    >
      {key && (
        <svg width={0} height={0} style={{ position: 'absolute' }} aria-hidden="true">
          <filter id={key.id} colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
            <feColorMatrix type="matrix" values={key.alphaMatrix} result="keyed" />
            <feColorMatrix in="keyed" type="matrix" values={key.spillMatrix} result="despilled" />
            <feComponentTransfer in="despilled">
              <feFuncA type="linear" slope="3" intercept="-1" />
            </feComponentTransfer>
          </filter>
        </svg>
      )}
      <div data-testid="media-key" style={{ width: '100%', height: '100%', filter: key ? `url(#${key.id})` : undefined }}>
        <OffthreadVideo
          src={media.src}
          style={{ width: '100%', height: '100%', objectFit: media.fit }}
          startFrom={media.startFrom}
          endAt={media.endAt}
          muted={media.muted ?? false}
        />
      </div>
    </div>
  );
}

/**
 * One element as it plays: its footage (below) and its Lottie (above).
 * M36: an element authored at another size than the frame (a 16:9 element
 * in a 9:16 spot with no designer variant) is auto-fitted: contained and
 * centred in a box, in pixels of the frame. Authored at the frame's size,
 * it draws full-frame as always.
 */
function ElementView({ element, frame }: { element: ElementProps; frame: Frame }) {
  const authored = { width: Number(element.lottie.w) || frame.width, height: Number(element.lottie.h) || frame.height };
  const fitted = authored.width !== frame.width || authored.height !== frame.height;
  const box = fitted ? autoFitBox(authored, frame) : null;
  return (
    <>
      {element.media && <MediaSlot media={element.media} box={box} />}
      {box ? (
        <div data-testid="autofit" style={{ position: 'absolute', left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px`, overflow: 'hidden' }}>
          <LottieLayer animationData={element.lottie} elementId={element.id} />
        </div>
      ) : (
        <LottieLayer animationData={element.lottie} elementId={element.id} />
      )}
    </>
  );
}

/**
 * The one composition's root component. Both runners render THIS:
 *   - <Player>      in the browser (app), handed the proxy footage
 *   - renderMedia   on the server, handed the original footage
 * Nothing in here may branch on which runner is calling it.
 *
 * Layer order, bottom to top: background colour, then the element chains
 * in start order, each element carrying its own footage under its Lottie.
 * A chain is either one element in a Sequence at its in/out points, or
 * several elements joined by transitions, rendered with TransitionSeries.
 */
export function Main({ background, audio = null, elements, transitions = [], fonts = [], frame = frameFor('16:9') }: MainProps) {
  const byId = new Map(elements.map((e) => [e.id, e] as const));
  const { chains } = effectiveTimeline(elements, transitions);

  return (
    <AbsoluteFill style={{ backgroundColor: background }}>
      {audio && <Audio src={audio.src} volume={audio.volume} startFrom={audio.startFrom} />}

      {/* M38: the elements mount once the faces are ready, so lottie-web measures text in the right font. */}
      <TemplateFonts key={fonts.map((f) => f.url).join('|')} fonts={fonts}>
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
              <ElementView element={first} frame={frame} />
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
                    <ElementView element={element} frame={frame} />
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
      </TemplateFonts>
    </AbsoluteFill>
  );
}
