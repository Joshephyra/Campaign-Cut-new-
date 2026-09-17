import { describe, expect, it } from 'vitest';
import { cutDownToFit } from './cutdown';

/** M52: a :30 becomes a :15 by taking proof points out from the end, with their overlays, and closing the gaps. */
const el = (id: number, type: string, startFrame: number, endFrame: number, enabled = true) => ({ id, type, startFrame, endFrame, enabled });
const thirty = [
  el(1, 'open', 0, 150),
  el(2, 'lower-third', 30, 150),
  el(3, 'background', 150, 330),
  el(4, 'caption', 180, 300),
  el(5, 'background', 330, 510),
  el(6, 'stat', 510, 690),
  el(7, 'end-card', 690, 900),
  el(8, 'disclaimer', 690, 900),
];

describe('cutDownToFit', () => {
  it('hides proof points from the end with what sits on them, closes the gaps, keeps the opening and the end card', () => {
    const { hide, patches, left } = cutDownToFit(thirty, 450); // a :15
    expect(hide).toEqual([6, 5, 3, 4]); // the stat, then the second background, then the first with its caption
    expect([...patches.entries()]).toEqual([
      [7, { startFrame: 150, endFrame: 360 }],
      [8, { startFrame: 150, endFrame: 360 }],
    ]);
    expect(left).toBe(0); // 5 s opening + 7 s end card = 12 s, under 15
  });

  it('stops when only the opening and the end card are left and says what still runs over', () => {
    const { hide, left } = cutDownToFit(thirty, 180); // a :06
    expect(hide).toEqual([6, 5, 3, 4]);
    expect(left).toBe(360 - 180);
  });

  it('does nothing when the content already fits', () => {
    expect(cutDownToFit(thirty, 900)).toEqual({ hide: [], patches: new Map(), left: 0 });
  });
});
