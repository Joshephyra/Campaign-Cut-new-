import { describe, expect, it } from 'vitest';
import { proofPointsFor, structureOf } from './structure';

/** M51: opening, proof points, end card; overlays belong to the scene they start on. */
const el = (id: number, type: string, startFrame: number, endFrame: number, enabled = true) => ({ id, type, startFrame, endFrame, enabled });

describe('structureOf', () => {
  it('names the scenes for their place and hangs each overlay on the scene it starts on', () => {
    const s = structureOf([
      el(1, 'background', 0, 150),
      el(2, 'lower-third', 30, 150),
      el(3, 'stat', 150, 270),
      el(4, 'caption', 150, 240),
      el(5, 'stat', 270, 420),
      el(6, 'end-card', 420, 570),
      el(7, 'disclaimer', 420, 570),
      el(8, 'caption', 900, 960),
    ]);
    expect(s.groups.map((g) => [g.label, g.scene.id, g.overlays.map((o) => o.id)])).toEqual([
      ['Opening', 1, [2]],
      ['Proof point 1', 3, [4]],
      ['Proof point 2', 5, []],
      ['End card', 6, [7, 8]],
    ]);
    expect(s.stray).toEqual([]);
  });

  it('calls the last scene a proof point when it is not an end card, skips hidden elements, and keeps overlays with no scene as stray', () => {
    const s = structureOf([el(1, 'open', 0, 90), el(2, 'background', 90, 180), el(3, 'stat', 180, 270, false), el(4, 'caption', 0, 30)]);
    expect(s.groups.map((g) => g.label)).toEqual(['Opening', 'Proof point 1']);
    expect(structureOf([el(9, 'lower-third', 0, 60)])).toEqual({ groups: [], stray: [el(9, 'lower-third', 0, 60)] });
    expect(structureOf([])).toEqual({ groups: [], stray: [] });
  });

  it('says how many proof points a length usually carries', () => {
    expect(proofPointsFor(30)).toBe('three or four proof points');
    expect(proofPointsFor(15)).toBe('one or two proof points');
    expect(proofPointsFor(6)).toBe('one proof point');
    expect(proofPointsFor(60)).toBe('six to eight proof points');
  });
});
