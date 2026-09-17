import type { ParamValues, TemplateParam } from './schema';
import { layerClassFor } from './transform';

/**
 * M56: animated callouts on one word of a text: circle it, underline it,
 * highlight it, or make it bigger. The user picks a word and a style; the
 * callout is stored beside the text's value as `<key>.callout` and drawn
 * by the composition, the same in both runners. Nothing in the designer's
 * Lottie changes except, for "bigger", a text animator on that word.
 */
export const CALLOUT_STYLES = ['circle', 'underline', 'highlight', 'bigger'] as const;
export type CalloutStyle = (typeof CALLOUT_STYLES)[number];

export const CALLOUT_LABELS: Record<CalloutStyle, string> = { circle: 'Circle it', underline: 'Underline it', highlight: 'Highlight it', bigger: 'Make it bigger' };

/** What a text param's `<key>.callout` value holds. */
export type CalloutValue = { word: number; style: CalloutStyle };

/** A callout as the composition draws it. */
export type Callout = {
  /** The text param's key; its layer carries the class `layerClassFor(key)`. */
  key: string;
  /** The word's index in the text, counting words split on whitespace. */
  word: number;
  style: CalloutStyle;
  /** #RRGGBB: the spot's accent. */
  color: string;
  /** Frames after the element's start when the callout starts to draw. */
  startFrame: number;
};

export function isCalloutStyle(v: unknown): v is CalloutStyle {
  return typeof v === 'string' && (CALLOUT_STYLES as readonly string[]).includes(v);
}

export function isCalloutValue(v: unknown): v is CalloutValue {
  return !!v && typeof v === 'object' && Number.isInteger((v as CalloutValue).word) && (v as CalloutValue).word >= 0 && isCalloutStyle((v as CalloutValue).style);
}

/** The key a text param's callout is stored under. */
export function calloutKey(textKey: string): string {
  return `${textKey}.callout`;
}

/** Frames into the element before a callout draws: after the text has arrived. */
export const CALLOUT_DELAY_FRAMES = 15;
/** Frames the draw-on takes. */
export const CALLOUT_DRAW_FRAMES = 12;

/** The words of a text and where each one's characters sit, for the text animator and the overlay. */
export function wordRanges(text: string): { word: string; start: number; end: number }[] {
  const out: { word: string; start: number; end: number }[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.push({ word: m[0], start: m.index, end: m.index + m[0].length });
  return out;
}

/**
 * The callouts a spot's element carries: one per text param (never the
 * disclaimer) whose `<key>.callout` names a word the text actually has.
 */
export function calloutsFrom(schema: TemplateParam[], values: ParamValues, color: string): Callout[] {
  const out: Callout[] = [];
  for (const p of schema) {
    if (p.kind !== 'text' || p.role === 'safe.disclaimer') continue;
    const raw = values[calloutKey(p.key)];
    if (!isCalloutValue(raw)) continue;
    const text = String(values[p.key] ?? p.default ?? '');
    if (raw.word >= wordRanges(text).length) continue;
    out.push({ key: p.key, word: raw.word, style: raw.style, color, startFrame: CALLOUT_DELAY_FRAMES });
  }
  return out;
}

/** The class the callout's text layer carries in the rendered SVG. */
export function calloutLayerClass(key: string): string {
  return layerClassFor(key);
}

/**
 * "Bigger" lives in the Lottie itself: a text animator that scales the
 * word's characters up over the draw-on frames. Returns the animator to
 * push onto the layer's `t.a`.
 */
export function biggerAnimator(text: string, word: number, ip: number): Record<string, unknown> | null {
  const range = wordRanges(text)[word];
  if (!range) return null;
  const from = ip + CALLOUT_DELAY_FRAMES;
  const to = from + CALLOUT_DRAW_FRAMES;
  return {
    nm: 'cc-callout-bigger',
    s: { t: 0, xe: { a: 0, k: 0 }, ne: { a: 0, k: 0 }, a: { a: 0, k: 100 }, b: 1, rn: 0, sh: 1, r: 2, s: { a: 0, k: range.start }, e: { a: 0, k: range.end }, o: { a: 0, k: 0 } },
    a: {
      s: {
        a: 1,
        k: [
          { t: from, s: [100, 100], e: [135, 135], i: { x: [0.2, 0.2], y: [1, 1] }, o: { x: [0.3, 0.3], y: [0, 0] } },
          { t: to, s: [135, 135] },
        ],
      },
    },
  };
}
