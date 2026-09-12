import { describe, expect, it } from 'vitest';
import { EMPTY_LOTTIE } from './config';
import { compositionDurationFor, visibleElementsInOrder, type ElementProps } from './elements';

const el = (id: string, startFrame: number, endFrame: number, extra: Partial<ElementProps> = {}): ElementProps => ({
  id,
  lottie: EMPTY_LOTTIE,
  startFrame,
  endFrame,
  zIndex: 0,
  enabled: true,
  ...extra,
});

describe('compositionDurationFor', () => {
  it('is the latest out point among enabled elements', () => {
    expect(compositionDurationFor([el('a', 0, 150), el('b', 100, 200)])).toBe(200);
  });

  it('ignores disabled elements and never returns less than 1', () => {
    expect(compositionDurationFor([el('a', 0, 150), el('b', 100, 400, { enabled: false })])).toBe(150);
    expect(compositionDurationFor([])).toBe(1);
    expect(compositionDurationFor([el('a', 0, 0)])).toBe(1);
  });
});

describe('visibleElementsInOrder', () => {
  it('drops disabled elements and sorts bottom to top by zIndex', () => {
    const out = visibleElementsInOrder([el('top', 0, 10, { zIndex: 2 }), el('off', 0, 10, { enabled: false }), el('bottom', 0, 10, { zIndex: 0 })]);
    expect(out.map((e) => e.id)).toEqual(['bottom', 'top']);
  });
});
