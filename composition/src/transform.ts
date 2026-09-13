type AnyRecord = Record<string, unknown>;

/**
 * M18: how far a tagged layer has been moved, scaled and rotated away from
 * what the designer authored. x and y are FRACTIONS of the frame (CLAUDE.md:
 * positions are fractions, never pixels); scale is a multiplier; rotation
 * is degrees. The identity leaves the Lottie byte-identical.
 */
export type TransformValue = { x: number; y: number; scale: number; rotation: number };

export const DEFAULT_TRANSFORM: TransformValue = Object.freeze({ x: 0, y: 0, scale: 1, rotation: 0 }) as TransformValue;

export function isTransformValue(v: unknown): v is TransformValue {
  if (!v || typeof v !== 'object') return false;
  const t = v as AnyRecord;
  return ['x', 'y', 'scale', 'rotation'].every((k) => typeof t[k] === 'number' && Number.isFinite(t[k] as number));
}

/**
 * Apply a transform to a layer's `ks` in place (the caller hands us a
 * clone). The authored animation is kept: a static value is changed once
 * and an animated one gets the same change on every keyframe, start and
 * end values alike, so easing and tangents survive.
 */
export function applyTransform(layer: AnyRecord, value: TransformValue, frameWidth: number, frameHeight: number): void {
  const ks = layer.ks as AnyRecord | undefined;
  if (!ks || typeof ks !== 'object') return;
  const dx = value.x * frameWidth;
  const dy = value.y * frameHeight;
  if (dx !== 0 || dy !== 0) offsetPosition(ks.p as AnyRecord | undefined, dx, dy);
  if (value.scale !== 1) mapProperty(ks.s as AnyRecord | undefined, (v) => (Array.isArray(v) ? v.map((n, i) => (i < 2 ? n * value.scale : n)) : v));
  if (value.rotation !== 0) mapProperty(ks.r as AnyRecord | undefined, (v) => (Array.isArray(v) ? v.map((n) => n + value.rotation) : typeof v === 'number' ? v + value.rotation : v));
}

function offsetPosition(p: AnyRecord | undefined, dx: number, dy: number): void {
  if (!p || typeof p !== 'object') return;
  if (p.s === true) {
    // Separate dimensions: one-dimensional x and y properties.
    mapProperty(p.x as AnyRecord | undefined, (v) => shift1d(v, dx));
    mapProperty(p.y as AnyRecord | undefined, (v) => shift1d(v, dy));
    return;
  }
  mapProperty(p, (v) => (Array.isArray(v) ? v.map((n, i) => (i === 0 ? n + dx : i === 1 ? n + dy : n)) : v));
}

function shift1d(v: unknown, d: number): unknown {
  if (Array.isArray(v)) return v.map((n, i) => (i === 0 ? (n as number) + d : n));
  return typeof v === 'number' ? v + d : v;
}

/** Change a Lottie property's value: the static `k`, or every keyframe's `s` and `e`. */
function mapProperty(prop: AnyRecord | undefined, fn: (v: unknown) => unknown): void {
  if (!prop || typeof prop !== 'object') return;
  if (prop.a === 1 && Array.isArray(prop.k)) {
    for (const keyframe of prop.k as AnyRecord[]) {
      if (!keyframe || typeof keyframe !== 'object') continue;
      if (keyframe.s !== undefined) keyframe.s = fn(keyframe.s);
      if (keyframe.e !== undefined) keyframe.e = fn(keyframe.e);
    }
    return;
  }
  prop.k = fn(prop.k);
}
