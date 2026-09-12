import type { LottieAnimationData } from './config';
import { resolvePointer } from './jsonPointer';
import type { ParamValues, TemplateParam } from './schema';

type AnyRecord = Record<string, unknown>;

export type Fit = 'cover' | 'contain';

/** A rectangle as FRACTIONS of the frame (CLAUDE.md: never hardcoded pixels). */
export type Rect = { x: number; y: number; w: number; h: number };

/** What the composition needs to show footage: where it goes and which file. */
export type MediaProps = { src: string; rect: Rect; fit: Fit };

/** What is stored in project_value for a cc.mediaFill param. */
export type MediaValue = { assetId: number; fit: Fit };

export function isMediaValue(v: unknown): v is MediaValue {
  return !!v && typeof v === 'object' && typeof (v as MediaValue).assetId === 'number';
}

/**
 * THE TWO-RUNNERS SPLIT. The Player gets the proxy; renderMedia gets the
 * original. This is the only place that decides, and both runners call it.
 */
export function mediaSourceFor(asset: { proxyUrl: string; originalUrl: string }, runner: 'preview' | 'export'): string {
  return runner === 'preview' ? asset.proxyUrl : asset.originalUrl;
}

/** Image values stored as server-relative paths (/media/images/x.png) get the runner's base URL. */
export function withBaseUrl(values: ParamValues, schema: TemplateParam[], baseUrl: string): ParamValues {
  const out: ParamValues = { ...values };
  for (const p of schema) {
    if (p.kind !== 'image') continue;
    const v = out[p.key];
    if (typeof v === 'string' && v.startsWith('/')) out[p.key] = `${baseUrl}${v}`;
  }
  return out;
}

/**
 * Bodymovin references embedded images relative to the JSON ("images/" +
 * "logo.png"). In the browser they would resolve against the page URL, and
 * on the server against nothing. Point them at the template's folder on
 * the server instead. Pure; returns a new object.
 */
export function resolveLottieAssets(lottie: LottieAnimationData, templateBaseUrl: string): LottieAnimationData {
  if (!Array.isArray(lottie.assets) || lottie.assets.length === 0) return lottie;
  const base = templateBaseUrl.endsWith('/') ? templateBaseUrl : `${templateBaseUrl}/`;
  const assets = (lottie.assets as AnyRecord[]).map((a) => {
    if (typeof a.p !== 'string' || a.e === 1 || /^(https?:|data:|\/)/.test(a.p)) return a;
    const dir = typeof a.u === 'string' ? a.u : '';
    if (/^(https?:|\/)/.test(dir)) return a;
    return { ...a, u: `${base}${dir}` };
  });
  return { ...lottie, assets };
}

// ---- the slot rectangle -----------------------------------------------

/** First keyframe value for an animated property, or the static value. */
function staticValue(prop: unknown): number[] | undefined {
  if (!prop || typeof prop !== 'object') return undefined;
  const p = prop as { a?: number; k?: unknown };
  if (p.a === 1 && Array.isArray(p.k) && p.k.length > 0) {
    const first = p.k[0] as { s?: unknown };
    return Array.isArray(first.s) ? (first.s as number[]) : undefined;
  }
  return Array.isArray(p.k) ? (p.k as number[]) : undefined;
}

type Transform = { p: number[]; a: number[]; s: number[] };

function transformOf(ks: unknown): Transform {
  const k = (ks ?? {}) as AnyRecord;
  return {
    p: staticValue(k.p) ?? [0, 0, 0],
    a: staticValue(k.a) ?? [0, 0, 0],
    s: staticValue(k.s) ?? [100, 100, 100],
  };
}

/** A centre and size, in the coordinate space of whoever owns the transform. */
type Box = { cx: number; cy: number; w: number; h: number };

function applyTransform(box: Box, t: Transform): Box {
  const sx = (t.s[0] ?? 100) / 100;
  const sy = (t.s[1] ?? 100) / 100;
  return {
    cx: (t.p[0] ?? 0) + (box.cx - (t.a[0] ?? 0)) * sx,
    cy: (t.p[1] ?? 0) + (box.cy - (t.a[1] ?? 0)) * sy,
    w: box.w * sx,
    h: box.h * sy,
  };
}

/** First rectangle in a shape tree, with group transforms applied. Rotation is ignored. */
function firstRectBox(items: unknown): Box | undefined {
  if (!Array.isArray(items)) return undefined;
  for (const item of items as AnyRecord[]) {
    if (!item || typeof item !== 'object') continue;
    if (item.ty === 'rc') {
      const size = staticValue(item.s) ?? [0, 0];
      const pos = staticValue(item.p) ?? [0, 0];
      return { cx: pos[0] ?? 0, cy: pos[1] ?? 0, w: size[0] ?? 0, h: size[1] ?? 0 };
    }
    if (item.ty === 'gr') {
      const inner = firstRectBox(item.it);
      if (inner) {
        const tr = (item.it as AnyRecord[]).find((i) => i?.ty === 'tr');
        return tr ? applyTransform(inner, transformOf(tr)) : inner;
      }
    }
  }
  return undefined;
}

/**
 * Where the cc.mediaFill slot sits, as fractions of the frame. Supports a
 * solid layer or a shape layer whose first shape is a rectangle. Static
 * transforms only (first keyframe if animated); rotation is not applied.
 */
export function mediaFillRect(lottie: LottieAnimationData, path: string): Rect | null {
  const layer = resolvePointer(lottie, path) as AnyRecord | undefined;
  if (!layer || typeof layer !== 'object') return null;
  const W = Number(lottie.w) || 0;
  const H = Number(lottie.h) || 0;
  if (!W || !H) return null;

  let box: Box | undefined;
  if (layer.ty === 1 && typeof layer.sw === 'number' && typeof layer.sh === 'number') {
    // A solid's own coordinate space has its top-left at (0,0).
    box = { cx: layer.sw / 2, cy: layer.sh / 2, w: layer.sw, h: layer.sh };
  } else if (layer.ty === 4) {
    box = firstRectBox(layer.shapes);
  }
  if (!box) return null;

  const placed = applyTransform(box, transformOf(layer.ks));
  return {
    x: (placed.cx - placed.w / 2) / W,
    y: (placed.cy - placed.h / 2) / H,
    w: placed.w / W,
    h: placed.h / H,
  };
}
