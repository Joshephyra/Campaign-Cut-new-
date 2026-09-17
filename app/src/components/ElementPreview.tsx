import { applyLottieValues, resolveLottieAssets, type LottieAnimationData, type ParamValues, type TemplateParam } from '@campaigncut/composition';
import lottie from 'lottie-web';
import { useEffect, useMemo, useRef } from 'react';

/**
 * M37: the values that preview an element with the user's copy: the first
 * text role gets it, the rest keep the designer's words. A disclaimer is
 * never rewritten by a preview.
 */
export function previewValues(schema: TemplateParam[], copy: string): ParamValues {
  const text = copy.trim();
  if (!text) return {};
  const first = schema.find((p) => p.kind === 'text' && p.role !== 'safe.disclaimer');
  return first ? { [first.key]: text } : {};
}

type Props = {
  lottie: LottieAnimationData;
  schema: TemplateParam[];
  values: ParamValues;
  /** The Lottie frame to hold on. */
  frame: number;
  /** The URL base the element's relative images resolve against. */
  assetBase?: string;
  className?: string;
  testId?: string;
};

/**
 * A still of one element at one frame, values applied, drawn once by
 * lottie-web into a box. Used for the library picker (the composer's copy)
 * and the scene chips (the scene's own values). No Player: a still needs
 * no clock, and a dozen of these are cheap.
 */
export function ElementPreview({ lottie: source, schema, values, frame, assetBase, className = '', testId }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const data = useMemo(() => {
    const resolved = assetBase ? resolveLottieAssets(source, assetBase) : source;
    return applyLottieValues(resolved, values, schema);
  }, [source, schema, values, assetBase]);

  useEffect(() => {
    const container = box.current;
    if (!container) return;
    let animation: ReturnType<typeof lottie.loadAnimation>;
    try {
      animation = lottie.loadAnimation({ container, renderer: 'svg', loop: false, autoplay: false, animationData: data, rendererSettings: { preserveAspectRatio: 'xMidYMid meet' } });
      animation.goToAndStop(frame, true);
    } catch (err) {
      // A preview that will not draw is reported, not fatal: the editor stays up.
      console.error('ElementPreview: could not draw', testId ?? '(element)', err);
      return;
    }
    return () => animation.destroy();
  }, [data, frame]);

  return <div ref={box} data-testid={testId} aria-hidden="true" className={`overflow-hidden ${className}`} style={{ aspectRatio: `${Number(source.w) || 16} / ${Number(source.h) || 9}` }} />;
}
