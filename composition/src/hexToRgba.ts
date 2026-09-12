/** Normalised RGBA as Lottie stores it: each channel 0 to 1. */
export type Rgba = [number, number, number, number];

/**
 * "#RRGGBB" or "#RGB" (either case) to normalised RGBA with alpha 1.
 * Returns null for anything else, so a half-typed colour in an input box
 * leaves the authored colour alone instead of throwing on every keystroke.
 */
export function hexToRgba(hex: string): Rgba | null {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  let digits = match[1]!;
  if (digits.length === 3) {
    digits = digits
      .split('')
      .map((d) => d + d)
      .join('');
  }
  const r = parseInt(digits.slice(0, 2), 16) / 255;
  const g = parseInt(digits.slice(2, 4), 16) / 255;
  const b = parseInt(digits.slice(4, 6), 16) / 255;
  return [r, g, b, 1];
}

/** Normalised RGBA back to "#RRGGBB" (upper case). Alpha is dropped. */
export function rgbaToHex([r, g, b]: Rgba | number[]): string {
  const byte = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v ?? 0)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${byte(r!)}${byte(g!)}${byte(b!)}`.toUpperCase();
}
