import { describe, expect, it } from 'vitest';
import { moveOverlayToScene, reorderScenes } from './reorder';

/** M43: scenes move in the play order; lengths and the gaps between positions stay; overlays stay put. */
const el = (id: number, type: string, startFrame: number, endFrame: number, enabled = true) => ({ id, type, startFrame, endFrame, enabled });
const spot = [el(1, 'open', 0, 120), el(2, 'lower-third', 35, 185), el(3, 'stat', 300, 450), el(4, 'end-card', 750, 825)];

describe('reorderScenes', () => {
  it('moves a scene before another, re-laying the scenes with their lengths and the gaps by position', () => {
    const patches = reorderScenes(spot, 4, 1, 'before');
    // order: end card (75), open (120), stat (150); gaps stay 180 then 300 by position
    expect([...patches.entries()]).toEqual([
      [4, { startFrame: 0, endFrame: 75 }],
      [1, { startFrame: 255, endFrame: 375 }],
      [3, { startFrame: 675, endFrame: 825 }],
    ]);
    expect(patches.has(2)).toBe(false); // the lower third, an overlay, stays where it is
  });

  it('moves a scene after another; a scene whose frames do not change is not in the patches', () => {
    const patches = reorderScenes(spot, 1, 3, 'after');
    // order: stat (150), open (120), end card (75); gaps 180 then 300: the end card lands where it was
    expect([...patches.entries()]).toEqual([
      [3, { startFrame: 0, endFrame: 150 }],
      [1, { startFrame: 330, endFrame: 450 }],
    ]);
  });

  it('keeps an end-to-end spot end to end', () => {
    const built = [el(10, 'background', 0, 150), el(11, 'stat', 150, 270), el(12, 'end-card', 270, 420)];
    expect([...reorderScenes(built, 12, 10, 'before').entries()]).toEqual([
      [12, { startFrame: 0, endFrame: 150 }],
      [10, { startFrame: 150, endFrame: 300 }],
      [11, { startFrame: 300, endFrame: 420 }],
    ]);
  });

  it('does nothing for a scene dropped on itself, an overlay, a hidden scene or an unknown id', () => {
    expect(reorderScenes(spot, 1, 1, 'before').size).toBe(0);
    expect(reorderScenes(spot, 2, 1, 'before').size).toBe(0);
    expect(reorderScenes([...spot, el(5, 'open', 900, 960, false)], 5, 1, 'before').size).toBe(0);
    expect(reorderScenes(spot, 99, 1, 'before').size).toBe(0);
  });
});

describe('moveOverlayToScene (M44)', () => {
  it('starts the overlay where the scene starts, keeping its length, and moves nothing else', () => {
    const patches = moveOverlayToScene(spot, 2, 3);
    expect([...patches.entries()]).toEqual([[2, { startFrame: 300, endFrame: 450 }]]);
  });

  it('does nothing for a scene, an overlay already on that scene, a hidden element, or a target that is not a scene', () => {
    expect(moveOverlayToScene(spot, 1, 3).size).toBe(0);
    expect(moveOverlayToScene([el(1, 'open', 0, 120), el(2, 'caption', 0, 60)], 2, 1).size).toBe(0);
    expect(moveOverlayToScene([...spot, el(6, 'caption', 0, 30, false)], 6, 3).size).toBe(0);
    expect(moveOverlayToScene(spot, 2, 2).size).toBe(0);
  });
});
