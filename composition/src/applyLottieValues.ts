import type { LottieAnimationData } from './config';
import { hexToRgba } from './hexToRgba';
import { resolvePointer } from './jsonPointer';
import type { ParamValues, TemplateParam } from './schema';

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
    applyOne(param, node as AnyRecord, value);
  }

  memo.set(values, { source, schema, result });
  return result;
}

const memo = new WeakMap<ParamValues, { source: LottieAnimationData; schema: TemplateParam[]; result: LottieAnimationData }>();

function applyOne(param: TemplateParam, node: AnyRecord, value: unknown): void {
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
      // Reserved for M8 (cc.mediaFill). Nothing to write into the Lottie.
      return;
  }
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
 * Images are referenced through the top-level assets array. We point the
 * asset at the new source. A data URI is marked embedded (e: 1) with an
 * empty directory so lottie-web loads it directly.
 */
function applyImage(asset: AnyRecord, value: unknown): void {
  if (typeof value !== 'string' || value.length === 0) return;
  asset.p = value;
  asset.u = '';
  asset.e = value.startsWith('data:') ? 1 : 0;
}
