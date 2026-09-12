import { describe, expect, it } from 'vitest';
import { hexToRgba, rgbaToHex } from './hexToRgba';

// Lottie stores colours as normalised RGBA (0 to 1), not 0 to 255.
describe('hexToRgba', () => {
  it('black is all zeros with full alpha', () => {
    expect(hexToRgba('#000000')).toEqual([0, 0, 0, 1]);
  });

  it('white is all ones', () => {
    expect(hexToRgba('#FFFFFF')).toEqual([1, 1, 1, 1]);
  });

  it('a mid value divides by 255 (cobalt #2B54E6 from DESIGN.md)', () => {
    const [r, g, b, a] = hexToRgba('#2B54E6')!;
    expect(r).toBeCloseTo(0x2b / 255, 6);
    expect(g).toBeCloseTo(0x54 / 255, 6);
    expect(b).toBeCloseTo(0xe6 / 255, 6);
    expect(a).toBe(1);
  });

  it('accepts lower case and the short #RGB form', () => {
    expect(hexToRgba('#ffffff')).toEqual([1, 1, 1, 1]);
    expect(hexToRgba('#fff')).toEqual([1, 1, 1, 1]);
  });

  it('returns null for anything that is not a colour', () => {
    expect(hexToRgba('#12')).toBeNull();
    expect(hexToRgba('red')).toBeNull();
    expect(hexToRgba('')).toBeNull();
    expect(hexToRgba('#GGGGGG')).toBeNull();
  });
});

describe('rgbaToHex', () => {
  it('round-trips the boundaries', () => {
    expect(rgbaToHex([0, 0, 0, 1])).toBe('#000000');
    expect(rgbaToHex([1, 1, 1, 1])).toBe('#FFFFFF');
  });

  it('rounds a mid value to the nearest byte', () => {
    expect(rgbaToHex(hexToRgba('#2B54E6')!)).toBe('#2B54E6');
  });
});
