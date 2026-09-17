import type { LottieAnimationData } from './config';
import { hexToRgba } from './hexToRgba';
import { resolvePointer } from './jsonPointer';
import type { ParamValues, TemplateParam } from './schema';
import { applyTransform, isTransformValue, LAYER_CLASS, TEXT_CLASS, layerClassFor } from './transform';
import { ACCENT_CLASS } from './treatments';

type AnyRecord = Record<string, unknown>;

/**
 * The mutation layer (SPEC.md section 2).
 *
 * @remotion/lottie gives no API to change text, colours or images inside a
 * Lottie, so we deep-clone the JSON and edit the clone before handing it
 * to the renderer.
 *
 * Pure: never mutates `source`. Memoized on the `values` object identity
 * (and on `source` and `schema` identity), because it is called on every
 * keystroke in the editor.
 *
 * Unknown keys are ignored. Values that cannot be applied (for example a
 * half-typed colour) are ignored and the authored value is kept.
 */
export function applyLottieValues(
  source: LottieAnimationData,
  values: ParamValues,
  schema: TemplateParam[],
): LottieAnimationData {
  const hit = memo.get(values);
  if (hit && hit.source === source && hit.schema === schema) return hit.result;

  const result = structuredClone(source);
  const byKey = new Map(schema.map((p) => [p.key, p] as const));

  for (const [key, value] of Object.entries(values)) {
    const param = byKey.get(key);
    if (!param) continue;
    const node = resolvePointer(result, param.path);
    if (node === null || typeof node !== 'object') continue;
    applyOne(param, node as AnyRecord, value, result);
  }

  // M28: tag every placement layer so the editor can find it in the rendered
  // SVG. Done whether or not a value is set: a layer is draggable before it
  // has ever been moved. Changes no pixel.
  for (const param of schema) {
    if (param.kind !== 'transform') continue;
    const layer = resolvePointer(result, param.path);
    if (layer && typeof layer === 'object') (layer as AnyRecord).cl = `${LAYER_CLASS} ${layerClassFor(param.key)}`;
  }
  // M39: tag every text layer and every accent-coloured layer too, so a
  // treatment can address them (glow is a shadow on these; the opaque
  // plate is an SVG filter on the text). Changes no pixel.
  const addClass = (pointer: string, classes: string) => {
    const layer = resolvePointer(result, pointer);
    if (!layer || typeof layer !== 'object') return;
    const existing = typeof (layer as AnyRecord).cl === 'string' ? ((layer as AnyRecord).cl as string).split(' ').filter(Boolean) : [];
    for (const c of classes.split(' ')) if (!existing.includes(c)) existing.push(c);
    (layer as AnyRecord).cl = existing.join(' ');
  };
  for (const param of schema) {
    if (param.kind === 'text') addClass(param.path, `${TEXT_CLASS} ${layerClassFor(param.key)}`);
    if (param.kind === 'color' && param.role === 'accent') {
      const layerPath = param.path.match(/^\/layers\/\d+/)?.[0];
      if (layerPath) addClass(layerPath, ACCENT_CLASS);
    }
  }

  memo.set(values, { source, schema, result });
  return result;
}

const memo = new WeakMap<ParamValues, { source: LottieAnimationData; schema: TemplateParam[]; result: LottieAnimationData }>();

function applyOne(param: TemplateParam, node: AnyRecord, value: unknown, root: LottieAnimationData): void {
  switch (param.kind) {
    case 'text':
      applyText(node, value);
      return;
    case 'color':
      applyColor(node, value);
      return;
    case 'image':
      applyImage(node, value);
      return;
    case 'media':
      applyMedia(node, value);
      return;
    case 'transform':
      // Offsets are fractions of the frame; the Lottie works in its own pixels.
      if (isTransformValue(value)) applyTransform(node, value, Number(root.w), Number(root.h));
      return;
  }
}

/**
 * Footage is rendered by the composition UNDER the Lottie, in the slot's
 * rectangle. All the Lottie has to do is get out of the way: the slot layer
 * becomes fully transparent so the video shows through it.
 */
function applyMedia(layer: AnyRecord, value: unknown): void {
  if (!value || typeof value !== 'object') return;
  const ks = (layer.ks && typeof layer.ks === 'object' ? layer.ks : (layer.ks = {})) as AnyRecord;
  ks.o = { a: 0, k: 0 };
}

/** Text lives at layer.t.d.k[].s.t on text layers (ty 5). */
function applyText(layer: AnyRecord, value: unknown): void {
  if (typeof value !== 'string') return;
  const doc = (layer.t as AnyRecord | undefined)?.d as AnyRecord | undefined;
  const keyframes = doc?.k;
  if (!Array.isArray(keyframes)) return;
  for (const keyframe of keyframes as AnyRecord[]) {
    const style = keyframe.s as AnyRecord | undefined;
    if (style && typeof style === 'object') style.t = value;
  }
}

/** Fill (ty "fl") and stroke (ty "st") colour at item.c.k as normalised RGBA. */
function applyColor(item: AnyRecord, value: unknown): void {
  if (typeof value !== 'string') return;
  const rgba = hexToRgba(value);
  if (!rgba) return;
  const colour = item.c as AnyRecord | undefined;
  if (!colour || typeof colour !== 'object') return;
  if (colour.a === 1 && Array.isArray(colour.k)) {
    // Animated colour: write the same value into every keyframe.
    for (const keyframe of colour.k as AnyRecord[]) {
      if (Array.isArray(keyframe.s)) keyframe.s = [...rgba];
      if (Array.isArray(keyframe.e)) keyframe.e = [...rgba];
    }
  } else {
    colour.k = [...rgba];
  }
}

/**
 * Images are referenced through the top-level assets array.
 *
 *   - An absolute URL or a data URI replaces the source outright: `p` is the
 *     value, the directory `u` is cleared, and a data URI is marked embedded.
 *   - A relative value (the template's own default, e.g. "images/logo.png")
 *     names a file inside the template's asset directory: only the file name
 *     goes into `p`; `u` is left alone so the directory that
 *     resolveLottieAssets() pointed at the server is kept. Clobbering `u`
 *     here produced a broken image in exports for untouched defaults.
 */
function applyImage(asset: AnyRecord, value: unknown): void {
  if (typeof value !== 'string' || value.length === 0) return;
  const absolute = /^(https?:|data:|blob:|\/)/.test(value);
  if (absolute) {
    asset.p = value;
    asset.u = '';
    asset.e = value.startsWith('data:') ? 1 : 0;
    return;
  }
  asset.p = value.slice(value.lastIndexOf('/') + 1);
  asset.e = 0;
}
