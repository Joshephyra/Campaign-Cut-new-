/**
 * SPEC.md section 7, step 1: chroma key first. This one is an SVG colour
 * matrix filter applied to the footage inside the composition, so the
 * Player and the server render key the footage the SAME way. No preview /
 * export split, no exception to one-composition-two-runners.
 *
 * It is a proof-of-concept key: it removes a clean green (or blue) screen
 * and keeps skin, greys and most colours. Yellows and cyans lose some
 * alpha because they contain green. ML matting (step 2) was not attempted.
 */
export type ChromaKey = {
  color: 'green' | 'blue';
  /** 0..1. Higher keys out more near-screen shades. */
  threshold: number;
  /** 0..1. How much of the screen colour is pulled out of the kept pixels. */
  spill: number;
};

export const DEFAULT_CHROMA_KEY: ChromaKey = { color: 'green', threshold: 0.5, spill: 0.3 };

export function isChromaKey(v: unknown): v is ChromaKey {
  if (!v || typeof v !== 'object') return false;
  const k = v as ChromaKey;
  return (k.color === 'green' || k.color === 'blue') && typeof k.threshold === 'number' && typeof k.spill === 'number';
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));
const fmt = (n: number) => String(Math.round(n * 1000) / 1000);

export type ChromaFilter = {
  id: string;
  threshold: number;
  spill: number;
  /** feColorMatrix (5x4, row-major) that writes "not screen-coloured" into alpha. */
  alphaMatrix: string;
  /** feColorMatrix that pulls the screen colour out of the kept pixels; identity alpha row. */
  spillMatrix: string;
};

/**
 * alpha = 1 - k * (S - (A + B) / 2) where S is the screen channel and A, B the
 * other two; k = 1 + threshold. Pure screen colour -> 0; grey and most
 * colours -> 1. A feComponentTransfer after it hardens the edge.
 */
export function chromaFilter(key: ChromaKey): ChromaFilter {
  const threshold = clamp01(key.threshold);
  const spill = clamp01(key.spill);
  const k = 1 + threshold;
  const s = spill;

  // channel indexes: R=0, G=1, B=2
  const screen = key.color === 'blue' ? 2 : 1;
  const others = [0, 1, 2].filter((c) => c !== screen) as [number, number];

  const alphaRow = [0, 0, 0, 0, 1];
  alphaRow[screen] = -k;
  alphaRow[others[0]] = k / 2;
  alphaRow[others[1]] = k / 2;

  const identity = [
    [1, 0, 0, 0, 0],
    [0, 1, 0, 0, 0],
    [0, 0, 1, 0, 0],
  ];
  const alphaMatrix = [...identity, alphaRow].map((r) => r.map(fmt).join(' ')).join('  ');

  const spillRows = identity.map((r) => [...r]);
  const screenRow = [0, 0, 0, 0, 0];
  screenRow[screen] = 1 - s;
  screenRow[others[0]] = s / 2;
  screenRow[others[1]] = s / 2;
  spillRows[screen] = screenRow;
  const spillMatrix = [...spillRows, [0, 0, 0, 1, 0]].map((r) => r.map(fmt).join(' ')).join('  ');

  const id = `cc-chroma-${key.color}-${fmt(threshold).replace('.', 'p')}-${fmt(spill).replace('.', 'p')}`;
  return { id, threshold, spill, alphaMatrix, spillMatrix };
}
