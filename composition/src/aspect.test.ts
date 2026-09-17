import { describe, expect, it } from 'vitest';
import { ASPECTS, aspectKey, autoFitBox, frameFor, isAspect, aspectOfFrame } from './aspect';

/** M36: 16:9 is the master; a spot is versioned into 1:1, 4:5 and 9:16. */
describe('aspects', () => {
  it('names the four ratios and their frames', () => {
    expect(ASPECTS).toEqual(['16:9', '1:1', '4:5', '9:16']);
    expect(frameFor('16:9')).toEqual({ width: 1920, height: 1080 });
    expect(frameFor('1:1')).toEqual({ width: 1080, height: 1080 });
    expect(frameFor('4:5')).toEqual({ width: 1080, height: 1350 });
    expect(frameFor('9:16')).toEqual({ width: 1080, height: 1920 });
    expect(isAspect('9:16')).toBe(true);
    expect(isAspect('16:10')).toBe(false);
    expect(aspectKey('9:16')).toBe('9x16');
    expect(aspectKey('16:9')).toBe('16x9');
  });

  it('M57: names the aspect a frame size is, exactly', () => {
    expect(aspectOfFrame(1920, 1080)).toBe('16:9');
    expect(aspectOfFrame(1080, 1080)).toBe('1:1');
    expect(aspectOfFrame(1080, 1350)).toBe('4:5');
    expect(aspectOfFrame(1080, 1920)).toBe('9:16');
    expect(aspectOfFrame(1280, 720)).toBeNull();
  });

  it('auto-fit contains and centres the authored frame in the new one, and is the identity when they match', () => {
    expect(autoFitBox({ width: 1920, height: 1080 }, { width: 1080, height: 1920 })).toEqual({ left: 0, top: 656.25, width: 1080, height: 607.5, scale: 0.5625 });
    expect(autoFitBox({ width: 1920, height: 1080 }, { width: 1080, height: 1080 })).toEqual({ left: 0, top: 236.25, width: 1080, height: 607.5, scale: 0.5625 });
    expect(autoFitBox({ width: 1920, height: 1080 }, { width: 1920, height: 1080 })).toEqual({ left: 0, top: 0, width: 1920, height: 1080, scale: 1 });
    expect(autoFitBox({ width: 1080, height: 1920 }, { width: 1920, height: 1080 })).toEqual({ left: 656.25, top: 0, width: 607.5, height: 1080, scale: 0.5625 });
  });
});
