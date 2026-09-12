import { describe, expect, it } from 'vitest';
import { chromaFilter, DEFAULT_CHROMA_KEY, isChromaKey, type ChromaKey } from './chroma';

const rows = (matrix: string) => matrix.trim().split(/\s+/).map(Number);

describe('chromaFilter', () => {
  it('for a green screen, the alpha row subtracts greenness: pure green goes fully transparent', () => {
    const f = chromaFilter({ color: 'green', threshold: 0.5, spill: 0 });
    const m = rows(f.alphaMatrix);
    expect(m).toHaveLength(20);
    // alpha' = m[15]*R + m[16]*G + m[17]*B + m[18]*A + m[19]
    const alphaOf = (r: number, g: number, b: number) => Math.min(1, Math.max(0, m[15]! * r + m[16]! * g + m[17]! * b + m[18]! * 1 + m[19]!));
    expect(alphaOf(0, 1, 0)).toBe(0); // pure green: keyed out
    expect(alphaOf(0.5, 0.5, 0.5)).toBe(1); // grey: kept
    expect(alphaOf(1, 0, 0)).toBe(1); // red: kept
    expect(alphaOf(0.9, 0.7, 0.6)).toBe(1); // skin: kept
  });

  it('a blue screen swaps the roles of green and blue', () => {
    const f = chromaFilter({ color: 'blue', threshold: 0.5, spill: 0 });
    const m = rows(f.alphaMatrix);
    const alphaOf = (r: number, g: number, b: number) => Math.min(1, Math.max(0, m[15]! * r + m[16]! * g + m[17]! * b + m[18]! * 1 + m[19]!));
    expect(alphaOf(0, 0, 1)).toBe(0);
    expect(alphaOf(0, 1, 0)).toBe(1);
  });

  it('a higher threshold keys out more of the near-green shades', () => {
    const soft = rows(chromaFilter({ color: 'green', threshold: 0.2, spill: 0 }).alphaMatrix);
    const hard = rows(chromaFilter({ color: 'green', threshold: 0.8, spill: 0 }).alphaMatrix);
    const alphaWith = (m: number[], r: number, g: number, b: number) => Math.min(1, Math.max(0, m[15]! * r + m[16]! * g + m[17]! * b + m[18]! + m[19]!));
    const darkGreen = [0.1, 0.55, 0.15] as const;
    expect(alphaWith(hard, ...darkGreen)).toBeLessThan(alphaWith(soft, ...darkGreen));
  });

  it('spill suppression pulls the key colour channel toward the other two', () => {
    const none = rows(chromaFilter({ color: 'green', threshold: 0.5, spill: 0 }).spillMatrix);
    const some = rows(chromaFilter({ color: 'green', threshold: 0.5, spill: 0.5 }).spillMatrix);
    // green row: [r g b a offset]
    expect(none.slice(5, 10)).toEqual([0, 1, 0, 0, 0]);
    expect(some[6]).toBeLessThan(1);
    expect(some[5]).toBeGreaterThan(0);
    expect(some[7]).toBeGreaterThan(0);
  });

  it('exposes a stable filter id and clamps the controls', () => {
    const f = chromaFilter({ color: 'green', threshold: 5, spill: -1 });
    expect(f.id).toMatch(/^cc-chroma-/);
    expect(f.threshold).toBe(1);
    expect(f.spill).toBe(0);
  });
});

describe('isChromaKey and defaults', () => {
  it('recognises a stored key and rejects junk', () => {
    const key: ChromaKey = { color: 'green', threshold: 0.5, spill: 0.2 };
    expect(isChromaKey(key)).toBe(true);
    expect(isChromaKey(null)).toBe(false);
    expect(isChromaKey({ color: 'pink', threshold: 0.5, spill: 0 })).toBe(false);
    expect(DEFAULT_CHROMA_KEY).toEqual({ color: 'green', threshold: 0.5, spill: 0.3 });
  });
});
