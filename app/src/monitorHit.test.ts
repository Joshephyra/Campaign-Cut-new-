import { describe, expect, it } from 'vitest';
import { pickLayer, type LayerBox } from './monitorHit';

/**
 * M28: which editable layer is under the pointer. Boxes come from the
 * rendered SVG (so they are wherever the animation put them on this
 * frame), in paint order: later is on top.
 */
const box = (elementId: number, key: string, left: number, top: number, width: number, height: number): LayerBox => ({
  elementId,
  key,
  rect: { left, top, width, height, right: left + width, bottom: top + height },
});

describe('pickLayer', () => {
  it('returns the layer whose box contains the point', () => {
    const boxes = [box(1, 'headline.transform', 10, 10, 100, 40), box(1, 'logo.transform', 300, 300, 50, 50)];
    expect(pickLayer(boxes, 50, 20)).toEqual(boxes[0]);
    expect(pickLayer(boxes, 320, 340)).toEqual(boxes[1]);
  });

  it('returns null on a miss and skips hidden (zero-size) boxes', () => {
    const boxes = [box(1, 'headline.transform', 0, 0, 0, 0), box(2, 'stat.transform', 10, 10, 20, 20)];
    expect(pickLayer(boxes, 5, 5)).toBeNull();
    expect(pickLayer(boxes, 0, 0)).toBeNull();
  });

  it('the topmost (last painted) of overlapping boxes wins', () => {
    const boxes = [box(1, 'a.transform', 0, 0, 500, 500), box(2, 'b.transform', 100, 100, 50, 50)];
    expect(pickLayer(boxes, 120, 120)).toEqual(boxes[1]);
    expect(pickLayer(boxes, 400, 400)).toEqual(boxes[0]);
  });
});
