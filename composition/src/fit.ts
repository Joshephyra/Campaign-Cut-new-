/// <reference lib="dom" />
import type { LottieAnimationData } from './config';
import { faceFor } from './fonts';
import { resolvePointer } from './jsonPointer';
import type { TemplateParam } from './schema';

/**
 * M60 / M61: the copy changes, the design follows.
 *
 * A designer tags a plate or an underline as belonging to a line of text
 * (`cc.headline.1.plate`, `cc.headline.3.underline`). When the user's copy
 * is wider or narrower than what was authored, the composition measures
 * both in the real font and moves the follower's geometry by the
 * difference, in the direction the text grows (its justification). Box
 * text first shrinks to its box (M61), never below half size and never
 * below what the designer's own copy needed, so a long line stays on one
 * line the way a designer would set it by hand.
 *
 * Both runners run this in Chrome with the same font files, after the
 * faces have loaded, so the preview and the export move the same pixels.
 */
export type FollowKind = 'plate' | 'underline';
export const FOLLOW_KINDS: readonly FollowKind[] = ['plate', 'underline'];
export function isFollowKind(v: unknown): v is FollowKind {
  return v === 'plate' || v === 'underline';
}

/** One text of an element and the layers that follow it. */
export type FitSpec = { key: string; textPath: string; authored: string; followers: { path: string; follows: FollowKind }[] };

/** What a text is set in, for measuring: family and style as the Lottie names them, size and tracking in the layer's units. */
export type FontSpec = { family: string; style: string; size: number; tracking: number };
/** The width of one line of text, in the layer's units. */
export type Measure = (text: string, font: FontSpec) => number;

/** Box text is never shrunk below half its authored size. */
export const MIN_SHRINK = 0.5;

type AnyRecord = Record<string, unknown>;

/** The fit specs an element's schema implies: one per text param, with its followers. */
export function fitSpecsFrom(schema: TemplateParam[]): FitSpec[] {
  return schema
    .filter((p) => p.kind === 'text')
    .map((p) => ({
      key: p.key,
      textPath: p.path,
      authored: String(p.default ?? ''),
      followers: schema.filter((f) => f.kind === 'follow' && f.for === p.key && isFollowKind(f.follows)).map((f) => ({ path: f.path, follows: f.follows as FollowKind })),
    }));
}

function keyframesOf(layer: AnyRecord | null): AnyRecord[] {
  const doc = (layer?.t as AnyRecord | undefined)?.d as AnyRecord | undefined;
  const k = doc?.k;
  return Array.isArray(k) ? (k as AnyRecord[]).filter((kf) => kf && typeof kf.s === 'object' && kf.s !== null) : [];
}

function fontSpecFor(lottie: LottieAnimationData, style: AnyRecord): FontSpec | null {
  const size = Number(style.s);
  if (!(size > 0)) return null;
  const list = ((lottie.fonts as { list?: { fName?: string; fFamily?: string; fStyle?: string }[] } | undefined)?.list) ?? [];
  const entry = list.find((f) => f.fName === style.f);
  return { family: entry?.fFamily ?? String(style.f ?? ''), style: entry?.fStyle ?? 'Regular', size, tracking: ((Number(style.tr) || 0) / 1000) * size };
}

/** The widest line, in the layer's units. */
export function textWidth(text: string, font: FontSpec, measure: Measure): number {
  let w = 0;
  for (const line of text.split(/\r\n|\r|\n/)) w = Math.max(w, measure(line, font));
  return w;
}

/** A layer's static horizontal scale as a fraction (the first keyframe's when animated). */
function staticScale(layer: AnyRecord | null): number {
  const s = (layer?.ks as AnyRecord | undefined)?.s as AnyRecord | undefined;
  const k = s?.k;
  let v: unknown = k;
  if (s?.a === 1 && Array.isArray(k)) v = (k[0] as AnyRecord | undefined)?.s;
  const x = Array.isArray(v) ? Number(v[0]) : NaN;
  return Number.isFinite(x) && x !== 0 ? x / 100 : 1;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Change a Lottie property's value in place: the static `k`, or every keyframe's `s` and `e`. */
function eachValue(prop: AnyRecord | undefined, fn: (v: unknown) => unknown): void {
  if (!prop || typeof prop !== 'object') return;
  if (prop.a === 1 && Array.isArray(prop.k)) {
    for (const kf of prop.k as AnyRecord[]) {
      if (!kf || typeof kf !== 'object') continue;
      if (kf.s !== undefined) kf.s = fn(kf.s);
      if (kf.e !== undefined) kf.e = fn(kf.e);
    }
    return;
  }
  if (prop.k !== undefined) prop.k = fn(prop.k);
}

/** 0 left, 1 right, 2 centre: how much of a width change lands on the left edge, as a fraction. */
function leftShare(justify: number): number {
  return justify === 1 ? 1 : justify === 2 ? 0.5 : 0;
}

/** Move a shape layer's rectangles, ellipses and paths so they are `delta` wider, growing the way the text grows. */
function followInShapes(items: unknown, delta: number, justify: number): void {
  if (!Array.isArray(items)) return;
  const left = leftShare(justify);
  for (const item of items as AnyRecord[]) {
    if (!item || typeof item !== 'object') continue;
    if (item.ty === 'gr') followInShapes(item.it, delta, justify);
    if (item.ty === 'rc' || item.ty === 'el') {
      eachValue(item.s as AnyRecord | undefined, (v) => (Array.isArray(v) ? [round(Number(v[0]) + delta), ...v.slice(1)] : v));
      // the shape is centred on p: its centre moves by half of what lands on the right, minus half of what lands on the left
      eachValue(item.p as AnyRecord | undefined, (v) => (Array.isArray(v) ? [round(Number(v[0]) + delta * (0.5 - left)), ...v.slice(1)] : v));
    }
    if (item.ty === 'sh') {
      eachValue(item.ks as AnyRecord | undefined, (v) => {
        const paths = Array.isArray(v) ? v : [v];
        for (const p of paths as AnyRecord[]) {
          if (!p || !Array.isArray(p.v)) continue;
          const xs = (p.v as number[][]).map((pt) => Number(pt[0]));
          const centre = (Math.min(...xs) + Math.max(...xs)) / 2;
          p.v = (p.v as number[][]).map((pt) => {
            const x = Number(pt[0]);
            const shift = x < centre ? -delta * left : x > centre ? delta * (1 - left) : delta * (0.5 - left);
            return [round(x + shift), ...pt.slice(1)];
          });
        }
        return Array.isArray(v) ? paths : paths[0];
      });
    }
  }
}

/** Stretch an image layer `deltaParent` wider (in its parent's units) about the edge the text keeps still. */
function followAsImage(layer: AnyRecord, lottie: LottieAnimationData, deltaParent: number, justify: number): void {
  const assets = Array.isArray(lottie.assets) ? (lottie.assets as AnyRecord[]) : [];
  const asset = assets.find((a) => a?.id === layer.refId);
  const width = Number(asset?.w);
  if (!(width > 0)) return;
  const ks = layer.ks as AnyRecord | undefined;
  if (!ks) return;
  const anchorX = (() => {
    const a = (ks.a as AnyRecord | undefined)?.k;
    return Array.isArray(a) ? Number(a[0]) || 0 : 0;
  })();
  const grow = deltaParent / width; // as a fraction of the layer's scale
  eachValue(ks.s as AnyRecord | undefined, (v) => (Array.isArray(v) ? [round(Number(v[0]) + grow * 100), ...v.slice(1)] : v));
  // scaling happens about the anchor: put the kept edge back where it was
  const shift = anchorX * grow - deltaParent * leftShare(justify);
  const p = ks.p as AnyRecord | undefined;
  if (p?.s === true) eachValue(p.x as AnyRecord | undefined, (v) => (Array.isArray(v) ? [round(Number(v[0]) + shift), ...v.slice(1)] : typeof v === 'number' ? round(v + shift) : v));
  else eachValue(p, (v) => (Array.isArray(v) ? [round(Number(v[0]) + shift), ...v.slice(1)] : v));
}

/**
 * The Lottie with every follower moved to the user's copy, and box text
 * shrunk to its box. Returns `source` itself when nothing needs to move,
 * so an untouched element costs nothing and keeps its identity.
 */
export function fitLottie(source: LottieAnimationData, specs: FitSpec[], measure: Measure): LottieAnimationData {
  let result: LottieAnimationData | null = null;
  const target = (): LottieAnimationData => (result ??= structuredClone(source));
  for (const spec of specs) {
    const layer = resolvePointer(source, spec.textPath) as AnyRecord | null;
    const style = keyframesOf(layer)[0]?.s as AnyRecord | undefined;
    if (!layer || !style) continue;
    const text = typeof style.t === 'string' ? style.t : '';
    if (text === spec.authored) continue; // the designer's own copy: their geometry stands, measured or not
    const font = fontSpecFor(source, style);
    if (!font) continue;
    const authoredWidth = textWidth(spec.authored, font, measure);
    let width = textWidth(text, font, measure);

    // M61: box text shrinks to its box first, never below half size, never below what the authored copy needed
    const box = Array.isArray(style.sz) ? Number(style.sz[0]) : 0;
    if (box > 0 && width > 0) {
      const room = Math.max(box, authoredWidth);
      if (width > room) {
        const scale = Math.max(MIN_SHRINK, room / width);
        const t = resolvePointer(target(), spec.textPath) as AnyRecord;
        for (const kf of keyframesOf(t)) {
          const s = kf.s as AnyRecord;
          s.s = round(font.size * scale);
          if (typeof s.lh === 'number') s.lh = round(s.lh * scale);
        }
        width = textWidth(text, { ...font, size: font.size * scale, tracking: font.tracking * scale }, measure);
      }
    }

    const delta = width - authoredWidth;
    if (Math.abs(delta) < 0.5 || spec.followers.length === 0) continue;
    const justify = Number(style.j) || 0;
    const textScale = staticScale(layer);
    for (const f of spec.followers) {
      const follower = resolvePointer(target(), f.path) as AnyRecord | null;
      if (!follower || typeof follower !== 'object') continue;
      const parented = follower.parent !== undefined && follower.parent === layer.ind;
      // the change in the follower's parent space: the text's own space when parented to it, else the comp's
      const deltaParent = parented ? delta : delta * textScale;
      if (follower.ty === 4) followInShapes(follower.shapes, deltaParent / staticScale(follower), justify);
      else if (follower.ty === 2) followAsImage(follower, source, deltaParent, justify);
    }
  }
  return result ?? source;
}

let canvas: CanvasRenderingContext2D | null | undefined;

/**
 * Measures in the browser, character by character the way lottie-web lays
 * text out, with the tracking between. Both runners are Chrome, and the
 * faces are loaded before an element mounts, so the widths are the real ones.
 */
export const canvasMeasure: Measure = (text, font) => {
  if (canvas === undefined) canvas = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  if (!canvas) return 0;
  const face = faceFor(font.style);
  canvas.font = `${face.fontStyle} ${face.weight} ${font.size}px "${font.family.replace(/"/g, '\\"')}"`;
  const chars = Array.from(text);
  let w = 0;
  for (const ch of chars) w += canvas.measureText(ch).width;
  return w + font.tracking * Math.max(0, chars.length - 1);
};
